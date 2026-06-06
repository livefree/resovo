> **ARCHIVED 2026-06-05**（CHORE-DOCS-CLEANUP-20260605）：本方案已全部落地——ADR-168/170/171/172（含 AMENDMENT）+ META-07..22 系列（SEQ-20260529-02 / SEQ-20260530-01..07 全 ✅）。真源以 docs/decisions.md 对应 ADR 为准。

# 外部元数据（豆瓣 / Bangumi）接入与体验整改 — 完整设计方案

> 状态：**R1 决策已锁定 · 可进入 ADR 阶段** · 日期：2026-05-29 · 作者：主循环（claude-opus-4-8）
> 范围：6 项功能（API key 管理 / 富集反馈图标 / topbar 通知 / 外部数据 tab / 基础信息重设计 / 拼音英文标题）
> 用途：落盘供下一步审核。审核通过后拆分为 ADR + tasks 卡片落地。

> **R1 修订摘要（2026-05-29，针对 5 项审核反馈，逐条已核实代码）**：
> 1. 删除「密文」错误表述（`system_settings.value` 实为明文 KV）；ADR-A 增**审计/响应 secret redaction 硬规则**（含修复现有 `notification_webhook_secret` 明文入审计，`siteConfig.ts:156`）。
> 2. ADR-C 补全 `bangumi_status` **所有写入方**（含手动 `confirmMatch`，`BangumiService.ts:114`）+ 新 `BangumiStatus` 类型 + 专用 query（`updateVideoEnrichStatus`，`videos.status.ts:256` 不支持 bangumi）。
> 3. ADR-D 富集事件写入**移到 worker try/catch/finally**（`enrich()` 抛错时末尾不执行，`enrichmentWorker.ts:16`）；`enrich()` 改为返回结果；trigger/status 加 CHECK + 保留策略。
> 4. 先定义 **`EnrichmentSummary` API shape**（服务端展开 `meta_quality` JSON，**admin 路径注入**非 public mapVideoRow）；`VIDEO_FULL_SELECT`（`videos.internal.ts:185`）补 `v.bangumi_status / mc.bangumi_subject_id`（两列）。〔ADR-170 终值〕
> 5. provenance `source_method` 加 **union 类型 + DB CHECK + 旧记录 backfill 策略**（NULL→「未知」，不让 UI 猜）。

---

## 0. 现状基线（设计前提，已逐文件核实）

| 能力 | 现状 | 关键位置 |
|---|---|---|
| 自动富集链路 | 采集入库后延迟 5min 入队 `enrichment-queue`，跑 5 步（本地豆瓣→网络豆瓣→Bangumi→源检验→meta_score） | `MetadataEnrichService.ts:69`、`CrawlerService.ts:300` |
| Bangumi token | **直读 `process.env.BANGUMI_API_TOKEN`**，无 DB 配置 | `lib/bangumi.ts:15` |
| 站点设置基建 | `system_settings`（KV 表）+ `SettingsTab`（含豆瓣 cookie/proxy 区）+ `ApiWebhookTab`（空壳占位） | `005_system_settings.sql`、`systemSettings.ts`、`SettingsContainer.tsx:42` |
| 富集状态信号 | `videos.douban_status / source_check_status / meta_score / meta_quality(jsonb)`；`video_external_refs`（多源候选/置信度） | `032_videos_pipeline_status_fields.sql`、`041_video_external_refs.sql` |
| 字段来源 provenance | `video_metadata_provenance(source_kind, source_ref)`，**只记 provider 不记获取形式** | `043_video_metadata_provenance.sql` |
| 多源 ID 映射 | `media_catalog.douban_id(TEXT) / bangumi_subject_id(INT)` + `video_external_refs(provider, external_id)` 统一表 | `026_create_media_catalog.sql` |
| 逐集元数据 | `catalog_episodes`（source='bangumi'）有数据，**无任何前端消费** | `077_bangumi_metadata.sql` |
| 编辑抽屉 | 4 tab：基础信息 / 线路管理 / 图片素材 / **豆瓣·元数据**；无 Bangumi tab；逐字段「使用豆瓣」是死按钮 | `VideoEditDrawer.tsx:67`、`TabDouban.tsx:164` |
| Bangumi 后端端点 | `bangumi-sync / bangumi-candidates / bangumi-confirm / bangumi/seed / bangumi/gaps` 全在，**server-next 零消费** | `routes/admin/moderation.bangumi.ts` |
| topbar 通知 | `BackgroundEventService`（采集run/调度/高危审计）→ `background-events` → 铃铛；**未含富集** | `BackgroundEventService.ts`、`admin-shell-notifications.ts` |
| 拼音检测 | `meta_quality.title_en_is_pinyin = isPinyin(titleEn)` 已算，**未暴露 UI** | `MetadataEnrichService.ts:85`、`PinyinDetector` |

---

## 1. 总体策略

- **复用优先**：6 项功能大部分是「接通已有后端能力到前端」，而非新建。重点是补 UI、补 1 个字段维度（获取形式）、补 1 张事件表（富集历史）。
- **统一徽标 + 统一来源摘要**：富集反馈在 4 个面（编辑/审核/视频库/线路）出现 → 必须沉淀为 1 个共享组件（CLAUDE.md「3 处以上必提取」），定义 Props 契约需 Opus 评审。
- **后端分层不破坏**：lib 层保持纯 HTTP，凭证解析下沉到 Service；Route 不含业务逻辑。
- **新增 admin 端点必须先起独立 ADR**（CLAUDE.md MUST-8 / `verify:endpoint-adr`）。本方案尽量复用既有端点 / 折叠进 `getVideo`，把新端点收敛到最少。

### 拟拆分的 ADR（待审核确认）

| ADR | 主题 | 触发原因 |
|---|---|---|
| ADR-A | 外部数据源凭证统一管理 + **secret redaction 规则**（Bangumi token 入 `system_settings`；审计 before/after & GET 响应对 `*_token`/`*_cookie`/`*_secret` 统一遮罩；含修复现有 webhook secret 明文入审计） | 跨 lib/service/route/UI + 安全 |
| ADR-B | `video_metadata_provenance` 增 `source_method`（**union 类型 + DB CHECK + 旧记录策略**） | schema 变更 + 6 写入方 |
| ADR-C | `videos.bangumi_status` 列 + `BangumiStatus` 类型 + 专用 query + **全部写入方枚举** + `EnrichmentSummary` 对外契约 | schema + 列表/详情/审核 3+ 消费方 |
| ADR-D | `enrichment_events` 表（trigger/status CHECK + 保留策略）+ **worker 层事件写入** + topbar 富集通知 | 新表 + 新事件 kind |
| ADR-E | `EnrichmentBadge` 共享组件 API 契约 | 共享组件 Props（强制 Opus） |
| ADR-F | 新增 admin 端点 bundle（bangumi 连接测试 / 逐集分页 / 富集重跑）；**ADR 聚合一份，实施拆 F-A/F-B/F-C** | 新 route（强制 Opus PASS；`verify:endpoint-adr` 非 1:1） |

---

## 2. Feature 1 — Bangumi 公共 API key 管理（动漫走 API 取数）

### 2.1 目标
站点设置中可配置 Bangumi 凭证，配置后动漫富集自动从 dump 降级模式升级为 REST rich 详情 + 逐集（该升级链路在 `BangumiService.gatherEnrichmentData` 已实装，仅缺凭证来源）。

### 2.2 数据库 / 字段
- **无需建表**，复用 `system_settings`（KV）。新增 keys：
  - `bangumi_api_token`（**明文存储** ⚠ — `system_settings.value` 是 TEXT KV，本身不加密；安全由 §2.3 的 redaction + UI 遮罩保证；at-rest 加密列为 §11.1 待决策的 follow-up）
  - `bangumi_user_agent`（默认 `resovo/1.0 (+...)`）
  - `bangumi_api_timeout_ms`（默认 8000）
- 类型层：`packages/types/src/system.types.ts` 的 `SystemSettingKey` union 追加上述 3 个 key；`SiteSettings` 接口 + `deserializeSiteSettings`（`systemSettings.ts:81`）追加 `bangumiApiToken / bangumiUserAgent / bangumiApiTimeoutMs`。

### 2.3 流程 / 后端改造
1. **凭证解析下沉到 Service 层**：`lib/bangumi.ts` 现为模块级直读 env 的纯 HTTP。改造为接受可选 `BangumiClientConfig { token?, userAgent?, timeoutMs? }`：
   - `getSubject(id, cfg?)` / `getEpisodes(id, cfg?)` / `searchSubjects(kw, limit, cfg?)` / `isBangumiApiConfigured(cfg?)`。
   - 缺省 cfg 时回退 `process.env`（向后兼容，测试注入不破坏）。
2. **`BangumiService` 持有凭证**：构造或方法入口经新增 `getBangumiConfig(db)` 从 `system_settings` 读取（**进程内缓存 60s**，避免每 job 查库），传入 lib 函数。
   - `MetadataEnrichService.step3` 与手动确认路径共用同一解析。
3. **凭证遮罩（ADR-A 核心，含修复既存隐患）**：
   - **审计 redaction（硬要求）**：当前保存逻辑 `auditSvc.write({ beforeJsonb: beforeSubset, afterJsonb: pairs })`（`siteConfig.ts:155-156`）把所有 KV 新旧值**原样写入 `admin_audit_log`**——这意味着 `notification_webhook_secret`（现有）、`bangumi_api_token`（新增）、`douban_cookie` 都会明文落审计表。**ADR-A 必须先定义 secret redaction**：
     - 定义敏感键模式 `SECRET_KEY_PATTERNS = [/_token$/, /_cookie$/, /_secret$/]`（覆盖三者）。
     - 构建 `beforeJsonb/afterJsonb` 时，命中模式的键值替换为状态标记 —— 推荐**只记 `'<set>'` / `'<cleared>'`**（不暴露任何字符），而非遮罩后 4 位（审计场景下后 4 位也不该留）。
     - 此修复对**现有 webhook secret 同样生效**（修既存隐患），需回归 `system.settings_update` 审计测试。
   - **GET 响应遮罩**：读取站点设置接口返回时，敏感键遮罩为 `••••<后4位>` + 布尔 `<key>Set`；PATCH 时若提交值等于遮罩占位则跳过写入（仅当提交明文新值才覆盖）。同范式应用于 `bangumi_api_token` 与既有 `douban_cookie`（`deserializeSiteSettings` 现明文回传 — 一并修）。
   - ⚠️ 触碰既有 secret 处理 → 需谨慎回归 webhook/douban 既有流程，避免「保存即清空」回归。

### 2.4 UI/UX
- **位置**：`SettingsTab`（站点设置 tab，已含豆瓣区）内新增「**外部数据源**」分组卡，与豆瓣 cookie/proxy 并列。理由：Bangumi token 与 douban cookie/proxy 同属「Resovo 消费的外部服务凭证」，语义对称；`ApiWebhookTab` 面向「Resovo 对外暴露的 API Key」，语义相反，不混放。
- 字段：
  - `Bangumi API Token`：password input，显示遮罩值，附「显示/隐藏」「测试连接」。
  - `User-Agent` / `超时(ms)`：text/number。
  - 状态行：未配置 → 「未配置（动漫走本地 dump 降级，字段较少）」灰条；已配置 → 「已启用 REST 详情」绿条。
- **测试连接**：`POST /admin/system/settings/bangumi/test`（新端点 → ADR-F），后端用提交/已存 token 拉一个已知 subject（如 8）验证，返回 ok/失败原因。

### 2.5 验收
- 配置 token 后，对一个 anime 视频触发富集 → catalog 出现 REST 字段（jp 原名、制作公司 tag、逐集写入 `catalog_episodes`）、`degraded=false`。

---

## 3. Feature 2 — 富集反馈小图标（编辑 / 审核 / 视频库 / 线路区）

### 3.1 目标
被外部源校验/丰富过的视频，在 4 个面以小图标直观反馈：豆瓣状态、Bangumi 状态（动漫）、源活性、元数据完整度、拼音警告。

### 3.2 数据库 / 字段
- **新增 `videos.bangumi_status`**（迁移，ADR-C）：`TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','matched','candidate','unmatched')`，与 `douban_status`（`032`）完全对称。
- **新增类型 `BangumiStatus`**（`packages/types`）：`'pending' | 'matched' | 'candidate' | 'unmatched'`（镜像 `DoubanStatus`）。
- **新增专用 query**：现有 `updateVideoEnrichStatus`（`videos.status.ts:256`）签名只含 `doubanStatus/metaScore/metaQuality`，**不支持 bangumi**，且手动确认路径根本不经过它。故新增 `updateVideoBangumiStatus(db: Pool | PoolClient, videoId, status: BangumiStatus)`（接受 `PoolClient` 以便在 `confirmMatch` 事务内原子写入）。
- **写入方枚举（必须全覆盖，否则 UI 徽标停在 pending/candidate）**：

  > 以下经 arch-reviewer（ADR-170）修订：状态写入**下沉进 `BangumiService.matchAndEnrich` 自身**，一次覆盖 step3 自动流 / `bangumi-sync` 直调 / VideoService 改类型三条路径（见 R-1）。

  | 写入路径 | 位置 | bangumi_status |
  |---|---|---|
  | 自动匹配 auto | `matchAndEnrich` 的 `applyAutoMatchAtomic` **事务内**（R-3，与 catalog+ref 原子） | `matched` |
  | 自动匹配 candidate | `matchAndEnrich` candidate 分支（Pool，无事务，写失败记录不吞） | `candidate` |
  | 自动匹配 none | `matchAndEnrich` none 分支（Pool） | `unmatched`（覆盖默认 pending） |
  | **手动确认** | `BangumiService.confirmMatch`（`:114`，**不经 matchAndEnrich**）→ **其 BEGIN/COMMIT 事务内** `updateVideoBangumiStatus(client, id, 'matched')` | `matched` |
  | sync 端点 `bangumi-sync` | **直调 `matchAndEnrich`**（`moderation.bangumi.ts:52`，不入队/不经 step3）→ 由下沉的状态写自动覆盖 | matched/candidate/unmatched |
  | ignore / retry（预留） | 未来 ignore 端点 | `unmatched` / 重跑 |

  - **R-1 关键修正**：草案原「auto 流在 `step3` 单点写」**错误** —— `bangumi-sync` 直调 `matchAndEnrich` 不经 step3，会漏写。下沉到 `matchAndEnrich` 后三路径统一覆盖。`confirmMatch` 仍独立写（它不经 matchAndEnrich）。
  - **R-3 原子性**：auto 的 status 写入 `applyAutoMatchAtomic` 事务内（PoolClient），消除「catalog/ref 已提交、status 未写」窗口；candidate/none 无事务走 Pool。
- 非 anime 视频保持 `pending`；UI 据 `type !== 'anime'` 不渲染 Bangumi 徽标（不依赖 status 值）。
- 理由：列表页徽标/筛选/排序需要去规范化列（性能），与现有 `douban_status` 去规范化先例一致；`video_external_refs` 保留为「候选明细」真源，`bangumi_status` 是其投影。
- 其余信号已存在，无需建表：`douban_status / source_check_status / meta_score / meta_quality.title_en_is_pinyin / meta_quality.enriched_at`。

### 3.3 对外契约 — 先定义 `EnrichmentSummary` shape（ADR-C，避免前端解析零散 JSON）

> **以 ADR-170（decisions.md）终值为准**：下方为草案口径，正式决定为 —— SELECT **只加 `v.bangumi_status, mc.bangumi_subject_id` 两列**（`release_date` 推迟 feature-5）；`enrichmentSummary` 经 **`buildEnrichmentSummary` 在 admin 路径注入**（非 public `mapVideoRow`，见 R-5）。

**现状问题**（已核实）：
- `VIDEO_FULL_SELECT`（`videos.internal.ts:185`）选了 `v.meta_quality`（整块 JSON）但**未选** `mc.bangumi_subject_id`。
- `enriched_at` / `title_en_is_pinyin` / `douban_confidence` **埋在 `meta_quality` JSON 内**，无扁平字段。
- `VideoAdminDetail`（`types.ts:65`）无 bangumi_subject_id / enrichmentSummary。
- admin 列表/详情（`VideoService.adminList/adminFindById`）返回 **raw `DbVideoRow`，不经 `mapVideoRow`**（后者是 public 路径）。

**设计**：服务端展开 `meta_quality`，统一返回一个结构化对象（**前端不解析 JSON**）：
```ts
// packages/types — 三方共享（API / server-next / EnrichmentBadge 组件）
interface EnrichmentSummary {
  doubanStatus: DoubanStatus
  bangumiStatus: BangumiStatus            // 非 anime 恒为 'pending'，UI 据 type 不渲染
  sourceCheckStatus: SourceCheckStatus
  metaScore: number                        // 0–100
  enrichedAt: string | null                // ← meta_quality.enriched_at
  titleEnIsPinyin: boolean                 // ← meta_quality.title_en_is_pinyin
  doubanConfidence: number | null          // ← meta_quality.douban_confidence
  bangumiSubjectId: number | null          // ← mc.bangumi_subject_id
}
```
**改动清单**（以 ADR-170 为准）：
- `VIDEO_FULL_SELECT` 增 **`v.bangumi_status, mc.bangumi_subject_id`**（两列；admin 查询 `listAdminVideos`/`findAdminVideoById` 复用此 SELECT，自动带列）。
- 新增纯函数 `buildEnrichmentSummary(row)`；在 **`VideoService.adminList/adminFindById`（admin 路径）注入** `enrichmentSummary`，**不挂 `mapVideoRow`/public `Video`**。
- barrel 出口：`packages/types/src/index.ts` runtime export `BANGUMI_STATUSES`；`videos.ts` re-export `updateVideoBangumiStatus`。
- `VideoAdminRow`（列表）+ `VideoAdminDetail`（详情）增 `enrichmentSummary` 字段；feature-5 详情字段（`release_date / title_original / rating_votes / total/current_episodes`）归 feature-5 卡，不在本 ADR。
- `EnrichmentBadgeCluster`（§3.4）直接吃 `EnrichmentSummary`，无需各页自解析。

### 3.4 共享组件（必须沉淀 — ADR-E，Opus 评审 Props）
新建 `packages/admin-ui/src/components/enrichment-badge/`：
- `<EnrichmentBadge kind="douban|bangumi|source|meta|pinyin" status=... size="sm|md" showLabel? />` — 单徽标。
- `<EnrichmentBadgeCluster summary={EnrichmentSummary} type={VideoType} density="row|header" />` — 组合簇（列表行紧凑 / 抽屉头部稍宽）。
- `EnrichmentSummary` 类型（放 `packages/types`）：上述字段聚合。
- 视觉：复用现有状态色变量（`--state-success/warning/error-*`），**零硬编码颜色**；meta_score 用环形/分段指示；pinyin 用 ⚠ tooltip。anime 才渲染 Bangumi 徽标。

### 3.5 四个消费面
| 面 | 接入点 | 形式 |
|---|---|---|
| 视频库列表 | `lib/videos/columns.ts` 新增 `enrichment` 列（替代/合并 `douban_status`+`meta_score` 两列），用 `EnrichmentBadgeCluster density="row"` | 图标簇，hover tooltip |
| 视频编辑 | `VideoEditDrawer.tsx` 的 `QUICK_HEAD`（`:240`）追加簇 | 抽屉头部 |
| 审核台 | server-next 审核行/详情（对接现有 moderation 视图） | 行内簇 |
| 线路区 | `TabLines`：每条源用 `sources.is_active`（Step4 写入）渲染源活性点；区头汇总 `source_check_status` | 逐源健康点 |

---

## 4. Feature 3 — 后台自动化任务 topbar 通知（批量 + 单个）

### 4.1 目标
富集任务（采集后自动批量 / 单视频手动）完成后在 topbar 铃铛通知；进行中显示任务进度。

### 4.2 数据库 / 字段（ADR-D）
富集当前**无运行历史**，需持久化。新增 `enrichment_events`：
```sql
CREATE TABLE enrichment_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  batch_id      TEXT,              -- 批次聚合键（采集 run 用 crawler_run_id；手动单个为 NULL）
  trigger       TEXT NOT NULL CHECK (trigger IN ('crawl','type_change','manual','backfill')),
  douban_status TEXT, bangumi_status TEXT, source_check_status TEXT,
  meta_score    SMALLINT,
  status        TEXT NOT NULL CHECK (status IN ('done','failed')),
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_enrichment_events_created ON enrichment_events (created_at DESC);
CREATE INDEX idx_enrichment_events_batch ON enrichment_events (batch_id) WHERE batch_id IS NOT NULL;
```
- **`EnrichJobData` 扩字段**：增 `trigger: 'crawl'|'type_change'|'manual'|'backfill'` 与 `batchId?: string`。三个入队点对应传值：`CrawlerService`（`trigger='crawl'`, `batchId=crawler_run_id`）、`VideoService` 改类型（`'type_change'`）、`DoubanService` 同步（`'manual'`）、回扫（`'backfill'`）。
- **保留策略**：`enrichment_events` 增长快 → 维护任务（maintenanceScheduler）定期 `DELETE WHERE created_at < NOW() - 30 days`，与通知窗口对齐（§11.4）。

> **⚠ 关键修正（审核反馈 3）**：草案原写「在 `MetadataEnrichService.enrich()` 末尾成功/失败各写一行」**不可落地** —— `enrich()` 无 try/catch，任一 step 抛错时函数末尾根本不会执行（`enrichmentWorker.ts:16` 的 `processEnrichJob` 只是 `await service.enrich()`，失败仅进 Bull `failed` 事件）。修正如下：

- **`enrich()` 改为返回结果**：签名从 `Promise<void>` 改为 `Promise<EnrichResult>`（`{ doubanStatus, bangumiStatus, sourceCheckStatus, metaScore }` —— 这些值 `enrich()` 内部已全部算出，只是没返回）。
- **事件写入下沉到 worker 的 try/catch**：
  ```ts
  // enrichmentWorker.processEnrichJob（伪码）
  try {
    const result = await service.enrich(job.data)
    await recordEnrichmentEvent({ ...job.data, ...result, status: 'done' }) // best-effort
  } catch (err) {
    // 仅最后一次尝试写 failed，避免 Bull 重试期间写多行
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await recordEnrichmentEvent({ ...job.data, status: 'failed', error: msg }) // best-effort
    }
    throw err   // 保留 Bull 重试语义
  }
  ```
  - `recordEnrichmentEvent` 自带 try/catch（best-effort），失败只 `stderr`，**绝不掩盖原始错误、不阻断重试**。
  - 失败去重：`attemptsMade + 1 >= attempts` 判定「最终失败」，避免每次重试各写一行 failed。

### 4.3 流程
1. `BackgroundEventService.list` 新增**源 F**：聚合 `enrichment_events`（窗口内）：
   - `batch_id` 非空 → 按 batch 聚合成 1 条「批量富集：N 项（匹配 a / 候选 b / 未匹配 c）」finished 事件。
   - `batch_id` 空（手动单个）→ 单条「《标题》已富集」finished 事件。
   - 进行中：读 `enrichment-queue` 的 active/waiting 计数 → upcoming/active「富集中 N 项」（bull 不可用则按 ADR-152 软降级 `degraded=true`）。
2. `admin-shell-notifications.ts` 增 `kind:'enrichment'` → NotificationItem（完成）/ TaskItem（进行中带进度）映射。
3. 新增 `AdminBackgroundEvent` 的 `kind:'enrichment'` 变体类型（`packages/types`）。

### 4.4 UI/UX
- 铃铛沿用现有三栏（upcoming/active/finished），富集事件嵌入。
- 批量：「✅ 批量富集完成 · 120 项（匹配 95 / 候选 18 / 未匹配 7）· 2 分钟前」，点击跳富集结果筛选视图。
- 单个：「✨《某动画》已富集 · 豆瓣✓ Bangumi✓ · 刚刚」，点击打开该视频编辑抽屉。
- 失败：danger 级，「⚠ 富集失败 N 项」。

---

## 5. Feature 4 — 元数据 tab 改名「外部数据」+ 显示来源与获取形式

### 5.1 目标
tab「豆瓣·元数据」→「**外部数据**」；展示各外部源已获取的数据 + **获取形式**（网页抓取 / API / local dump / 手动）。

### 5.2 数据库 / 字段（ADR-B）
`video_metadata_provenance` 增列（**带 CHECK，允许 NULL 兼容旧记录**）：
```sql
ALTER TABLE video_metadata_provenance
  ADD COLUMN IF NOT EXISTS source_method TEXT
  CHECK (source_method IS NULL OR source_method IN
         ('local_dump','api','web_scrape','manual','crawler'));
```
- **新增类型 `SourceMethod`**（`packages/types`）：`'local_dump' | 'api' | 'web_scrape' | 'manual' | 'crawler'`。
- **旧记录策略（审核反馈 5）**：
  - 既有行 `source_method` 为 `NULL` —— **UI 显式显示「未知来源形式」，不推断、不让前端猜**。
  - 可选一次性 backfill：**仅回填可无歧义判定的** —— `source_kind='manual' → 'manual'`、`source_kind='crawler' → 'crawler'`；`douban/bangumi/tmdb` 历史行无法区分 dump/api/scrape，**保持 NULL**（不臆造）。
  - `mapProvenance` / `ProvenanceRow` / `batchUpsertFieldProvenance` 同步加 `sourceMethod`。
- `MediaCatalogService.safeUpdate` 的 `provenanceCtx` 增 `method: SourceMethod` 字段；`batchUpsertFieldProvenance` 写入。
- 各写入方标注 method：
  | 写入方 | source_kind | source_method |
  |---|---|---|
  | `MetadataEnrichService.step1`（本地 dump 召回） | douban | `local_dump` |
  | `step2`（网络搜索 `getDoubanDetailRich`） | douban | `web_scrape` |
  | `BangumiService` REST subject 命中 | bangumi | `api` |
  | `BangumiService` dump 降级（无 token） | bangumi | `local_dump` |
  | 手动确认（confirmSubject/confirmMatch） | douban/bangumi | `manual` |
  | 采集首次写入 | crawler | `crawler` |

### 5.3 流程 / 数据获取
- 读取：把 provenance 折叠进 `getVideo` 详情响应（`VideoService.getDetail` 调 `getProvenanceByCatalogId`），**避免新增端点**。返回 `provenance: { [field]: { sourceKind, sourceMethod, sourceRef, updatedAt } }`。

### 5.4 UI/UX
- tab 重命名 + 组件 `TabDouban` → `TabExternalData`，内部分区：
  1. **概览**：富集时间 `enriched_at`、`EnrichmentBadgeCluster`、各源 primary ref（豆瓣 ID / Bangumi subject 链接）。
  2. **豆瓣**：现有候选/diff/confirm（修复死按钮，见 §5.5）。
  3. **Bangumi**（anime）：复用同范式，对接已有 `bangumi-candidates / bangumi-confirm` 端点（feature 见 §6 前端）。
  4. **字段来源表**：逐字段一行 →「简介 · 豆瓣（网页抓取）· 2026-05-29」「话数 · Bangumi（API）」「标题 · 手动」。获取形式用小标签 + 图标（🌐 网页 / 🔌 API / 📦 dump / ✍ 手动）。
- 文案：`i18n/messages/zh-CN/videos-edit.ts` 的 `VE.douban` → `VE.external`，新增 method 标签词条。

### 5.5 顺带修复
- `TabDouban.tsx:164` 逐字段「使用豆瓣」死按钮 → 接通已存在的 `POST /admin/moderation/:id/douban-confirm-fields`（`moderation.douban.ts:144`），实现逐字段采纳。

---

## 6. Feature 5 — 基础信息页重设计（动漫显示对应字段）

### 6.1 目标
`TabBasicInfo` 重设计为分组结构；`type==='anime'` 时显示动画专属字段（含逐集）。

### 6.2 数据库 / 字段
- 无新增。复用 `media_catalog`：`title_original`、`bangumi_subject_id`、`release_date`、`rating_votes`、`tags`（含 `制作:` 前缀公司）、`episode_count`、`current/total_episodes`；逐集 `catalog_episodes`。
- 对外契约（§3.3 已含 `bangumi_subject_id`）补 `title_original / release_date / rating_votes / total_episodes / current_episodes`。
- **逐集读取走独立端点**（已定，§11.6）：`GET /admin/videos/:id/episodes?page&limit`（ADR-F）。`getVideo` 只返回**逐集摘要**（如本篇计数 + 前几条预览）；明细按需分页拉取，避免抽屉初次加载变重。前端默认仅在动画分区展开时请求。

### 6.3 UI/UX（分组重设计）
- **通用分区**（卡片化，替代当前扁平堆叠）：
  1. 基本信息：标题 / 英文标题（+拼音警告，feature 6）/ 类型 / 年份 / 地区 / 连载状态
  2. 内容信息：简介 / 题材 / 评分(+评分人数) / 集数
  3. 制作人员：导演 / 演员 / 编剧
- **动画专属分区**（`type==='anime'` 才渲染，「动画信息」卡）：
  - 日文原名（title_original）、Bangumi Subject（只读 + 跳 bangumi.tv 链接）、放送开始日、制作公司（从 `tags` 解析 `制作:` 前缀）、话数（current/total）。
  - **逐集列表**：可折叠表（ep / 标题 / 中文名 / 放送日 / 时长），只读，数据源 `catalog_episodes`。
- 外部标识（豆瓣 ID / Bangumi ID）从基础信息**移至「外部数据」tab**（feature 4），消除当前底部裸 doubanId 输入框的割裂感。
- 每字段右侧可选 provenance 角标（来自 §5）：显示该字段是外部源填充还是手动，hover 看来源/形式。

### 6.4 兼容
- 非 anime 视频不渲染动画分区；创建模式（无 catalog/episodes）隐藏逐集。

---

## 7. Feature 6 — 「英文标题」实为拼音的治理

### 7.1 根因与定位
- 采集源常把拼音塞进 `title_en`。`meta_quality.title_en_is_pinyin` 已在富集时算出（`isPinyin`），但无 UI、无修复路径。
- 大量「空白基础信息」本质是富集未生效（无 Bangumi token / 未匹配）→ **feature 1+5 落地后大部分自动填充**，本 feature 聚焦「识别 + 修正拼音英文标题」这一具体残留。

### 7.2 数据库 / 字段
- 无新增字段（复用 `meta_quality.title_en_is_pinyin`）。
- **首批不扩字段**（已定，§11.5）。若未来产品需保留拼音用于 URL/SEO：**先审计现有 `videos.slug` 字段语义**（代码已有该列，见 `VIDEO_FULL_SELECT` `v.slug`），评估复用/扩展其语义，而非新引入字段。首批仅做：识别（`title_en_is_pinyin`）+ 清除/替换建议 + provenance 记录。

### 7.3 流程 / UI
1. **识别暴露**：`TabBasicInfo`「英文标题」字段，当 `title_en_is_pinyin` → 输入框旁 ⚠ 图标 + tooltip「检测到疑似拼音，非真实英文/原名」。视频库行徽标簇也含此 pinyin 警告（§3.4）。
2. **修正路径**：
   - **自动建议**：富集命中豆瓣 aliases / 外文名或 Bangumi `name`(日文原名) 时，若当前 title_en 为拼音 → 在「外部数据」tab 提供「用外部源原名替换英文标题」操作（写 catalog + provenance method=manual/api）。
   - **手动**：字段旁「清除」快捷按钮。
3. **批量回扫**（可选，归入 feature 3 的 trigger='backfill'）：维护任务扫描 `meta_quality->>'title_en_is_pinyin'='true'` 的视频，配置 Bangumi token 后重跑富集；结果走 topbar 批量通知。

---

## 8. 数据库变更汇总

| 变更 | 类型 | 迁移 | 影响 | ADR |
|---|---|---|---|---|
| `system_settings` 增 bangumi_* keys | KV（无 DDL） | 否 | 类型 union + 序列化；**审计/响应 redaction**（含修现有 webhook secret） | A |
| `video_metadata_provenance.source_method`（**+CHECK，允许 NULL**） | 加列 | 是 | safeUpdate + 6 写入方 + 旧记录 NULL 策略 | B |
| `videos.bangumi_status` | 加列 | 是 | 富集写入（含 `confirmMatch` 事务内）+ 列表/详情 | C |
| `BangumiStatus` 类型 + `updateVideoBangumiStatus` query | 类型/query | 否 | 全部 bangumi 写入方 | C |
| `EnrichmentSummary` 类型 + `VIDEO_FULL_SELECT` 增 2 列 + `buildEnrichmentSummary`（admin 注入）| 类型/SQL | 否 | API 展开 meta_quality + DTO | C |
| `enrichment_events` 表（**trigger/status CHECK** + 30d 保留） | 建表 | 是 | worker 写 + BackgroundEventService 读 | D |
| `EnrichJobData` 增 `trigger` + `batchId?` | 类型 | 否 | 3 入队点透传 → worker 落库 | D |
| `enrich()` 返回值 `void → EnrichResult` | 签名 | 否 | worker 据返回写事件 | D |

> ⚠️ 所有 migration 遵循项目幂等范式（`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` + `DO $$ 验证 $$`），并同步 `docs/architecture.md`（CLAUDE.md 硬约束）。

---

## 9. 端点汇总（新增最小化）

| 端点 | 状态 | 说明 |
|---|---|---|
| `bangumi-candidates / bangumi-confirm / bangumi-sync` | **已存在** | 仅缺 server-next 前端消费（feature 4/5） |
| `douban-confirm-fields` | **已存在** | 接通死按钮（§5.5） |
| `getVideo` 详情 | 扩展响应 | 加 provenance / 富集字段（EnrichmentSummary）/ **逐集摘要**（明细走独立端点） |
| `GET /admin/videos/:id/episodes?page&limit` | **新增** | 逐集明细分页 → ADR-F/F-B（依赖 ADR-C）；只读无 audit |
| `background-events` | 扩展 | 加富集事件源（feature 3） |
| `POST /admin/system/settings/bangumi/test` | **新增** | 连接测试 → ADR-F/F-A（依赖 ADR-A）；贴合 `/admin/system/settings` 前缀 |
| `POST /admin/videos/:id/enrich` | **新增** | 手动重跑/回扫 → ADR-F/F-C（依赖 ADR-D）；**必写 audit `video.enrich_trigger`** |

> 新增 route 须先起 ADR 并过 `npm run verify:endpoint-adr`（CLAUDE.md MUST-8）。脚本**非 1:1**（聚合所有 ADR 端点契约表匹配；先例 ADR-104/105/124 一 ADR 多端点）→ ADR-F 聚合一份，实施拆 F-A/F-B/F-C。

---

## 10. 落地阶段建议（拆卡顺序）

1. **P1 地基**（解锁其余）：ADR-A（Bangumi 凭证）+ feature 1 后端（token 解析/缓存 + settings 读写 + 遮罩/redaction + **UI 输入**）+ ADR-B（provenance source_method）+ ADR-C（bangumi_status + 契约扩展）。**注：「测试连接」端点 F-A 不在 P1**（依赖末位 Accepted 的 ADR-F，见下）。
2. **P2 共享层**：ADR-E `EnrichmentBadge` 组件（Opus 评审 Props）+ 富集摘要类型。
3. **P3 前端消费**：feature 2（四面徽标）+ feature 4（外部数据 tab + Bangumi 前端 + 死按钮修复）+ feature 6（拼音暴露/修正）。
4. **P4 重设计**：feature 5（基础信息分组 + 动画分区 + 逐集，含端点 **F-B** 逐集分页）。
5. **P5 通知**：ADR-D + `enrichment_events` + topbar 富集通知（批量/单个）+ 端点 **F-C**（手动 enrich + `video.enrich_trigger` audit）+ 回扫。
6. **P-后续**：端点 **F-A**（bangumi 测试 + UI「测试连接」按钮）—— 须等 ADR-F Accepted（末位），故晚于 P1 token 后端落地，不阻塞 feature 1 token 配置。

> 每张卡 PATCH 范围 ≤ 5 项（CLAUDE.md M-SN-5），超出拆 `-A/-B` 子卡。
> **ADR-F 末位 Accepted**（bundle 含依赖 ADR-D 的 F-C）→ 其 3 端点均在 ADR-F Accepted 后落地：F-A（晚于 P1，**测试端点延后**）/ F-B（随 P4）/ F-C（随 P5）。**若要 F-A 在 P1 落地，须改拆 `ADR-173-A/B/C`**；本方案选「聚合 ADR + 延后 F-A」，避免文档分叉。

---

## 11. 风险与待决策（请审核时拍板）

> **R1 决策已定（2026-05-29 审核确认）**：以下 6 项已拍板锁定，进入 ADR 阶段。

1. **凭证存储安全** — ✅ **已定**：
   - 首批**必做**（ADR-A 硬要求）：审计 before/after redaction、GET 遮罩、PATCH 遮罩占位跳过、audit 不落明文、**现有 webhook secret / douban cookie 回归测试**。
   - at-rest 应用层加密 → **首批不做**，列 follow-up ADR（理由：引入密钥管理/轮换/迁移/启动失败策略，会拖大 P1；当前无合规强制 & 无 DB dump 外发风险）。
2. **`bangumi_status` 列 vs 纯派生** — ✅ **已定：加列**（与 douban_status 去规范化对称，列表性能优先；refs 仍为候选明细真源）。
3. **provenance 获取形式粒度** — ✅ **已定：五值起步**（local_dump/api/web_scrape/manual/crawler），不细分到「豆瓣移动 API vs HTML」。
4. **富集事件持久化范围** — ✅ **已定：保留 30 天**。maintenance job 每日 `DELETE WHERE created_at < NOW() - INTERVAL '30 days'`；长期统计另建聚合表，不拿事件明细表硬扛。
5. **拼音「英文标题」字段定位** — ✅ **已定：首批不扩字段**。仅做识别 + 清除/替换建议 + provenance 记录；若未来需保留拼音用于 URL/SEO，**先审计现有 `videos.slug` 语义再决定复用/扩展**（代码已有该列），不新引入字段。
6. **逐集数据读取** — ✅ **已定：独立端点**。`GET /admin/videos/:id/episodes?page&limit`，默认仅在动画分区展开时请求；`getVideo` 只返回**逐集摘要**（计数/前几条），明细走独立端点。新端点按 ADR-F 走 endpoint ADR。

---

## 12. 与 CLAUDE.md 约束对照

- ✅ 复用优先（system_settings / provenance / video_external_refs / BackgroundEventService 全复用）。
- ✅ 共享组件 3+ 消费方 → 提取 `EnrichmentBadge`（Props 契约走 Opus，ADR-E）。
- ✅ schema 变更同步 architecture.md；migration 幂等。
- ✅ 新增 admin 端点先起 ADR（ADR-F）+ Opus PASS。
- ✅ 后端分层：lib 纯 HTTP、凭证解析在 Service、Route 无业务逻辑。
- ✅ 零硬编码颜色（徽标用 state 色变量）。
- ⚠️ 本方案为草案，**实装前需将 ADR-A~F 正式起草**（决策文档需 Opus 子代理产出，CLAUDE.md 模型路由）。

---

## 13. ADR 骨架（A~F · 待 Opus arch-reviewer 起草）

> **性质**：以下为 ADR **边界 + 决策点（D-编号）占位骨架**，用于锁定编号、范围与交叉引用，**非最终决策内容**。
> 正式 ADR 内容（含 Accepted 状态、字段映射、端点契约、zod schema、偏离登记终值）须经 Opus 子代理（`arch-reviewer`）产出后写入 `docs/decisions.md`。
> **建议编号（待确认）**：现有最大 `ADR-166`，`ADR-167` 已被 CHORE-11/PR#4 预留 → 本套从 **ADR-168** 起。
> **每份统一字段**：状态 / 背景 / 决策要点(D-NNN-N) / 影响文件 / 端点契约(如适用) / Migration(如适用) / 依赖 / 偏离登记。

### 起草顺序与依赖图

```
P1 地基（可并行起草）         P2 共享        P3/4/5 消费
  ADR-A(168) ─┐
  ADR-B(169) ─┼──────────────────────────────► ADR-F(173) 端点
  ADR-C(170) ─┴──► ADR-E(172) 组件
                └──► ADR-D(171) 事件/通知 ──► ADR-F(173)
```
- **ADR-C** 是契约核心（`EnrichmentSummary` / `bangumi_status`），ADR-D/E 均依赖其类型 → **C 必须先 Accepted**。
- **ADR-F** 聚合所有新端点，依赖 A（bangumi 测试）+ D（enrich 重跑）→ 最后起草。

---

### ADR-168（=ADR-A）：外部数据源凭证统一管理 + Secret Redaction 协议
- **状态**：Draft（待 arch-reviewer Opus）
- **SEQ/Track**：SEQ-EXT-META-A
- **背景**：Bangumi token 现直读 `process.env`（`lib/bangumi.ts:15`）；`system_settings` 为明文 KV，保存逻辑把 `pairs` 原样写 `admin_audit_log.afterJsonb`（`siteConfig.ts:156`）→ 现有 `notification_webhook_secret` 已明文入审计。
- **决策要点（占位）**：
  - **D-168-1**：敏感键模式 `SECRET_KEY_PATTERNS = [/_token$/, /_cookie$/, /_secret$/]`（覆盖 bangumi_api_token / douban_cookie / notification_webhook_secret）。
  - **D-168-2**：审计 redaction 形态 → **只记 `'<set>'`/`'<cleared>'`**（不留任何字符；before/after 同规则）。
  - **D-168-3**：GET 响应遮罩 `••••<后4位>` + 布尔 `<key>Set`。
  - **D-168-4**：PATCH 提交值 == 遮罩占位 → 跳过写入（仅明文新值覆盖）。
  - **D-168-5**：凭证解析下沉 Service —— `lib/bangumi.ts` 函数接受可选 `BangumiClientConfig`，缺省回退 env；`BangumiService` 经 `getBangumiConfig(db)` 读 `system_settings`（进程内缓存 ~60s）。
  - **D-168-6**：at-rest 加密 **NEGATED for P1**（follow-up ADR；理由见 §11.1）。
- **影响文件**：`lib/bangumi.ts`、`BangumiService.ts`、`routes/admin/siteConfig.ts`、`db/queries/systemSettings.ts`、`packages/types/src/system.types.ts`、`SettingsTab.tsx`、`AuditLogService`（redaction helper）。
- **端点**：`POST /admin/system/settings/bangumi/test`（连接测试 → 实际契约登记在 ADR-F）。
- **依赖**：无（P1 地基）。
- **回归红线**：webhook secret / douban cookie 既有「保存即清空」回归测试必过。
- **偏离登记**：D-168-* 终值待定。

---

### ADR-169（=ADR-B）：字段来源 `source_method` 维度
- **状态**：Draft
- **SEQ/Track**：SEQ-EXT-META-B
- **背景**：`video_metadata_provenance.source_kind` 只记 provider（`043`），无法区分 dump/api/scrape → feature 4「获取形式」无数据源。
- **决策要点（占位）**：
  - **D-169-1**：`SourceMethod = 'local_dump'|'api'|'web_scrape'|'manual'|'crawler'`（`packages/types`）。
  - **D-169-2**：`ALTER TABLE ... ADD COLUMN source_method TEXT CHECK (NULL OR IN(...))`（允许 NULL 兼容旧行；幂等迁移）。
  - **D-169-3**：6 写入方 method 标注映射（step1=local_dump / step2=web_scrape / bangumi REST=api / bangumi dump 降级=local_dump / manual=manual / crawler=crawler）。
  - **D-169-4**：旧记录 NULL → UI「未知来源形式」**不推断**；有限 backfill 仅 manual/crawler，douban/bangumi/tmdb 历史行保持 NULL。
- **影响文件**：新 migration（仿 `043`）、`db/queries/metadataProvenance.ts`（`ProvenanceRow`/`mapProvenance`/`batchUpsertFieldProvenance` 加 `sourceMethod`）、`MediaCatalogService.safeUpdate`（`provenanceCtx.method`）、`MetadataEnrichService`、`BangumiService`。
- **依赖**：无（P1 地基）。
- **偏离登记**：待定。

---

### ADR-170（=ADR-C）：`bangumi_status` 列 + `BangumiStatus` 类型 + `EnrichmentSummary` 对外契约 ★契约核心
- **状态**：✅ **Accepted**（已写入 `docs/decisions.md`；arch-reviewer claude-opus-4-8 CONDITIONAL → 消化 R1/R2/R3 + Y1–Y4：状态写下沉 matchAndEnrich + auto 入 applyAutoMatchAtomic 事务 + EnrichmentSummary 仅挂后台 + 仅加 `bangumi_status/bangumi_subject_id` 两列）。下方骨架为历史草案，**以 decisions.md 终值为准**。
- ~~**状态**：Draft~~
- **SEQ/Track**：SEQ-EXT-META-C
- **背景**：`videos` 无 bangumi 状态列；`updateVideoEnrichStatus`（`videos.status.ts:256`）不支持 bangumi；`confirmMatch`（`BangumiService.ts:114`）不写 videos 状态；`VIDEO_FULL_SELECT`（`videos.internal.ts:185`）未选 `bangumi_subject_id/release_date`；`enriched_at/title_en_is_pinyin` 埋 `meta_quality` JSON。
- **决策要点（占位）**：
  - **D-170-1**：`videos.bangumi_status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','matched','candidate','unmatched')`（对称 `douban_status`）。
  - **D-170-2**：`BangumiStatus` 类型（镜像 `DoubanStatus`）。
  - **D-170-3**：新 query `updateVideoBangumiStatus(db: Pool|PoolClient, videoId, status)`。
  - **D-170-4**：全部写入方枚举 —— auto/candidate/none（step3 单点）、**manual confirmMatch（其事务内写 matched）**、sync（间接）、ignore/retry（预留）。
  - **D-170-5**：`EnrichmentSummary` shape（服务端展开 meta_quality）+ `VIDEO_FULL_SELECT` 增 `v.bangumi_status, mc.bangumi_subject_id`（两列）+ `buildEnrichmentSummary` 在 **admin 路径**注入（非 mapVideoRow）+ `VideoAdminRow/Detail` 增 `enrichmentSummary`。〔终值见 decisions.md ADR-170〕
- **影响文件**：新 migration、`videos.status.ts`、`BangumiService.ts`、`MetadataEnrichService.ts`、`videos.internal.ts`、`VideoService.ts`、`packages/types`、`lib/videos/types.ts`。
- **依赖**：无（**最优先 Accepted**，D/E 依赖其类型）。
- **偏离登记**：待定。

---

### ADR-171（=ADR-D）：`enrichment_events` 表 + Worker 事件落库 + topbar 富集通知
- **状态**：Draft
- **SEQ/Track**：SEQ-EXT-META-D
- **背景**：富集无运行历史；`enrich()` 无 try/catch，抛错末尾不执行（`enrichmentWorker.ts:16` 仅 `await`）→ 失败不可见；`BackgroundEventService` 未含富集。
- **决策要点（占位）**：
  - **D-171-1**：`enrichment_events` schema（`trigger`/`status` 带 CHECK；`batch_id` 索引）。
  - **D-171-2**：`EnrichJobData` 增 `trigger`('crawl'|'type_change'|'manual'|'backfill') + `batchId?`；3 入队点传值。
  - **D-171-3**：`enrich()` 签名 `void → Promise<EnrichResult>`。
  - **D-171-4**：事件写入下沉 worker `try/catch`；失败仅在 `attemptsMade+1>=attempts` 写一行；`recordEnrichmentEvent` best-effort（不掩盖原错、不阻断 Bull 重试）。
  - **D-171-5**：`BackgroundEventService` 源 F —— `batch_id` 非空聚合「批量富集 N 项(匹配/候选/未匹配)」，空则单条；进行中读队列计数（bull 不可用 → `degraded`，对齐 ADR-152）。
  - **D-171-6**：保留 30 天，maintenance job 每日 `DELETE WHERE created_at < NOW()-INTERVAL '30 days'`。
- **影响文件**：新 migration、`enrichmentWorker.ts`、`MetadataEnrichService.ts`、`CrawlerService.ts`/`VideoService.ts`/`DoubanService.ts`（入队透传）、`BackgroundEventService.ts`、`admin-shell-notifications.ts`、`maintenanceScheduler`、`packages/types`（`AdminBackgroundEvent` 增 `kind:'enrichment'`）。
- **依赖**：ADR-C（复用 `bangumi_status`/`EnrichResult` 字段）。
- **偏离登记**：待定。

---

### ADR-172（=ADR-E）：`EnrichmentBadge` 共享组件 API 契约 ★强制 Opus
- **状态**：Draft（**Props 契约必须 Opus 评审**，CLAUDE.md 共享组件 API 强制）
- **SEQ/Track**：SEQ-EXT-META-E
- **背景**：富集反馈需在编辑/审核/视频库/线路 4 面出现（3+ 消费方）→ 必须提取共享组件（`packages/admin-ui`）。
- **决策要点（占位）**：
  - **D-172-1**：`<EnrichmentBadge kind="douban|bangumi|source|meta|pinyin" status size="sm|md" showLabel? />` Props。
  - **D-172-2**：`<EnrichmentBadgeCluster summary={EnrichmentSummary} type density="row|header" />` Props。
  - **D-172-3**：状态→色 token 映射（复用 `--state-*`，**零硬编码颜色**）；meta_score 指示形态；anime-only 渲染 bangumi。
  - **D-172-4**：4 消费面接入点（`columns.ts` / `VideoEditDrawer` QUICK_HEAD / moderation / `TabLines` 逐源）。
- **影响文件**：`packages/admin-ui/src/components/enrichment-badge/*`、`packages/types`（EnrichmentSummary 复用）、4 消费面文件。
- **依赖**：ADR-C（`EnrichmentSummary` 类型）。
- **偏离登记**：待定。

---

### ADR-173（=ADR-F）：新增 admin 端点协议（endpoint contract bundle）★强制 Opus PASS + `verify:endpoint-adr`
- **状态**：Draft
- **SEQ/Track**：SEQ-EXT-META-F
- **背景**：本套引入 3 个新 admin route，按 CLAUDE.md MUST-8 须先起 ADR + Opus PASS。
- **拆分结论（审核已定）**：**ADR 不强拆，实施强拆。**
  - `verify:endpoint-adr` **非 1:1** —— 脚本聚合所有 ADR 的 `### 端点契约` 表后整体匹配路由；先例 **ADR-104 / 105 / 124** 均为「一 ADR 多端点」。故「是否拆」是**工程边界/审查复杂度**问题，不是脚本要求。
  - 正式 ADR-173 保持**聚合**（一份 endpoint contract bundle），`### 端点契约` 表逐行写清 Method/Path/用途/Request/Response/错误码/权限/**audit**。
  - **实施必须拆 3 张后端子卡**（依赖各异，见下）：`F-A` / `F-B` / `F-C`。
  - （可选降险路径：若审查压力大，可改拆 `ADR-173/174/175` 三份正式 ADR；当前范围**非必须**，徒增文档开销。）
- **端点契约（占位，每行须标依赖 + audit，待补 req/resp/错误码表）**：

  | # | 端点 | 用途 | 依赖 ADR | audit |
  |---|---|---|---|---|
  | D-173-1 | `POST /admin/system/settings/bangumi/test` | 用提交/已存 token 拉已知 subject 验证连接 | **ADR-A** | **不写 audit**（只读连通性探测；凭证保存本身已由 `system.settings_update` 审计覆盖） |
  | D-173-2 | `GET /admin/videos/:id/episodes?page&limit` | 逐集明细分页（getVideo 仅摘要） | **ADR-C** | 只读，无 audit |
  | D-173-3 | `POST /admin/videos/:id/enrich` | 手动重跑/回扫触发（写/队列操作） | **ADR-D** | **必写 audit**（见下） |
  - **路径锚定**：D-173-1 用 `/admin/system/settings/...` 前缀贴合现有 `siteConfig` 路由（`GET/POST /admin/system/settings`，`siteConfig.ts:89,97`），避免 `/admin/settings/*` 命名空间分叉。
  - **D-173-3 audit 决策（R-MID-1 一致性，审核已定）**：新增 `AdminAuditActionType = 'video.enrich_trigger'`（`packages/types/src/admin-moderation.types.ts:150`，沿用 `domain.action` 模式），记录 `{ trigger, videoId, actorId, jobId/reason }`。否则违反审计一致性红线。
- **实施子卡拆分**：
  - **F-A**：Bangumi 连接测试端点 + settings API/client/UI「测试连接」按钮（依赖 ADR-A；**因 ADR-F 末位 Accepted，落地晚于 P1 token 后端**，不阻塞 feature 1 token 配置）。
  - **F-B**：逐集分页只读端点 + query/service + UI 动画分区按需加载（依赖 ADR-C）。
  - **F-C**：手动 enrich 触发端点 + queue 入队 + `video.enrich_trigger` audit + topbar 失效刷新（依赖 ADR-D）。
- **影响文件**：`routes/admin/*`（新 route）、对应 Service、`packages/types`（req/resp 类型 + `AdminAuditActionType` 扩 `video.enrich_trigger`）、`AuditLogService` 覆盖测试。
- **依赖**：A（F-A）/ C（F-B）/ D（F-C）—— **逐端点标注于上表**，非笼统末尾依赖。
- **偏离登记**：待定（D-173-1 audit 已定：**不写**）。

---

> **下一步**：确认编号（168–173）后，按「C → A/B 并行 → D/E → F」顺序，经 `arch-reviewer`（Opus）逐份起草正式 ADR 写入 `docs/decisions.md`；ADR-F 保持聚合一份，落地时拆 F-A/F-B/F-C 三张实施卡。
