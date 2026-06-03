# Resovo（流光）— 任务序列池（Task Queue）

> status: active
> owner: @engineering
> scope: task sequencing, status tracking, blocker notifications
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-23
>
> 用途：提前规划多个任务序列，避免”走一步看一步”；同时作为 BLOCKER/PHASE COMPLETE 通知的写入位置。
> 关系：本文件负责”任务规划 + 状态追踪 + 通知”；`docs/tasks.md` 负责”当前单任务工作台（完成即清空）”；`docs/changelog.md` 负责”完成历史日志”。

---

## 统一规则（必须遵守）

1. 任务序列命名

- 序列 ID 格式：`SEQ-YYYYMMDD-XX`（例：`SEQ-20260319-01`）
- `XX` 从 `01` 递增，不复用、不回填
- 一个序列包含一组有依赖关系的任务（可跨多个模块）

2. 任务编号命名（沿用现有规范）

- 任务 ID 格式：`<PREFIX>-NN`
- `PREFIX` 必须使用既有前缀：`INFRA` / `AUTH` / `VIDEO` / `SEARCH` / `PLAYER` / `CRAWLER` / `ADMIN` / `USER` / `SOCIAL` / `LIST` / `CONTRIB` / `CHG` / `CHORE` / `DEC` / `UX` / `META` / `IMG` / `HANDOFF` / `STATS`
  - `DEC`：前后台解耦架构任务（来自 frontend_backend_decoupling_plan_20260401.md，2026-04-02 新增）
  - `UX`：后台交互改造任务（来自 admin_console_decoupling_and_ux_plan_20260402.md，2026-04-02 新增）
  - `META`：外部元数据层建设任务（来自 external_metadata_import_plan_20260405.md + 2026-04-14 豆瓣扩展方案，2026-04-14 新增）
  - `IMG`：图片管线与样板图系统任务（来自 image_pipeline_plan_20260418.md，2026-04-20 新增）
  - `HANDOFF`：前端交付包落地（来自 handoff_20260422/landing_plan_v1.md，M7 扩充首页重设计，2026-04-22 新增）
  - `STATS`：视频观看埋点 + 综合算分（v2.1 独立跟进，2026-04-22 新增占位）
- `NN` 为两位数字，按同前缀内最大编号递增（例如当前最大 `CHG-335`，下一个必须是 `CHG-336`）
- 禁止跳号占坑、禁止复用已存在编号

3. 时间戳要求

- 每个序列必须包含：`创建时间`、`最后更新时间`
- 每个任务必须包含：`创建时间`（必填），`计划开始时间`（建议），`实际开始时间`（启动后填），`完成时间`（完成后填）
- 时间格式统一：`YYYY-MM-DD HH:mm`（本地时区）

4. 记录位置（统一，禁止混用）

- 本文件：新序列与新任务一律**追加到文件尾部**
- `docs/tasks.md`：新任务块一律**追加到文件尾部**；同一任务只更新其状态与时间字段
- `docs/changelog.md`：新完成记录一律**追加到文件尾部**
- 禁止“有时头插、有时尾插”

5. 执行约束

- `docs/tasks.md` 是单任务工作台：同时只允许 1 个任务为 `🔄 进行中`；任务完成后立即从 tasks.md 删除该卡片（历史存于 changelog.md）
- 任务进入执行前，必须已在本文件序列中定义（除紧急 hotfix）
- 每完成一个任务，立即更新本文件对应任务状态与时间戳，并更新所属序列的 `最后更新时间`
- BLOCKER 和 PHASE COMPLETE 通知写入本文件尾部（不写入 tasks.md）

---

## 序列模板

```markdown
## [SEQ-YYYYMMDD-XX] 序列标题

- **状态**：🟡 规划中 / 🔄 执行中 / ✅ 已完成 / ⛔ 已取消
- **创建时间**：YYYY-MM-DD HH:mm
- **最后更新时间**：YYYY-MM-DD HH:mm
- **目标**：一句话描述目标
- **范围**：涉及模块与边界
- **依赖**：上游任务或环境前置

### 任务列表（按执行顺序）

1. TASK-ID — 标题（状态：⬜/🔄/✅/❌）
   - 创建时间：YYYY-MM-DD HH:mm
   - 计划开始：YYYY-MM-DD HH:mm
   - 实际开始：YYYY-MM-DD HH:mm（未开始可留空）
   - 完成时间：YYYY-MM-DD HH:mm（未完成可留空）
   - 验收要点：...
```

---
## 序列编号约束声明

**重要**：新任务序列号不得与历史归档中的序号重复。历史已完成序列已分段归档：

- `docs/archive/task-queue/task-queue_archive_20260427.md` — SEQ-20260319-* ~ SEQ-20260426-01（M0 ~ M-SN-0 启动准备）
- `docs/archive/task-queue/task-queue_archive_M-SN-1-to-6_20260523.md` — SEQ-20260428-01 ~ CHG-SN-6-29-FOLLOWUP（M-SN-1 ~ M-SN-6）

当前及后续任务使用新序列号；本文件保留 M-SN-7 跟踪卡 + 设计稿对齐重做 + M-SN-8 全部活跃序列。

---

## [SEQ-20260529-02] 外部元数据（豆瓣/Bangumi）接入与体验整改 — P1 地基

- **状态**：✅ 已完成（META-07/08/09 三卡全 ship 2026-05-29 / ADR-170 C-1/C-2/C-3 闭环）
- **创建时间**：2026-05-29
- **最后更新时间**：2026-05-29
- **目标**：落地「外部元数据 UX 整改」方案 P1 地基契约（ADR-170 Accepted）：videos.bangumi_status 列 + BangumiStatus 类型 + updateVideoBangumiStatus query + EnrichmentSummary 对外契约。
- **范围**：`apps/api`（migration / queries / BangumiService / VideoService）+ `packages/types` + `apps/server-next/lib/videos/types`。不含前端徽标（ADR-172 / 后续 wave）。
- **依赖**：ADR-170 ✅ Accepted（`docs/decisions.md`）。下游 ADR-171/172 依赖本序列产出的类型。
- **方案/ADR 全文**：`docs/designs/external-metadata-ux-overhaul_20260529.md` + `docs/decisions.md` ADR-170。

### 任务列表（按执行顺序）

1. **META-07** — ADR-170 C-1：bangumi_status 列 + BangumiStatus 类型 + updateVideoBangumiStatus query + 2 barrel 出口 + architecture.md（状态：✅ 已完成）
   - 创建时间：2026-05-29
   - 实际开始：2026-05-29
   - 完成时间：2026-05-29（执行 claude-opus-4-8 / arch-reviewer Opus 评 ADR-170 / 门禁全过 / 7 新单测 / 零回归 / commit 见 changelog META-07）
   - 验收要点：migration 082 幂等 + BANGUMI_STATUSES runtime export + query 双形态单测 + 零回归 ✅
2. **META-08** — ADR-170 C-2：BangumiService 三路径写 status（matchAndEnrich auto 入 applyAutoMatchAtomic 事务 / candidate-none Pool / confirmMatch 事务）（状态：✅ 已完成）
   - 实际开始：2026-05-29
   - 完成时间：2026-05-29（执行 claude-opus-4-8 / 门禁全过 / bangumi-service 27 + 2 mock 修复 / 零新增回归 / commit 见 changelog META-08）
   - 依赖：META-07 完成后
   - 验收要点：bangumi-sync 直调路径 + 手动 confirm 路径均更新 bangumi_status；auto 原子性（R-3）
3. **META-09** — ADR-170 C-3：EnrichmentSummary 类型 + DbVideoRow/VIDEO_FULL_SELECT(+2 列) + buildEnrichmentSummary（admin 路径注入）+ server-next VideoAdminRow/Detail 镜像（状态：✅ 已完成）
   - 实际开始：2026-05-29
   - 完成时间：2026-05-29（执行 claude-opus-4-8 / 门禁全过 / +3 buildEnrichmentSummary 单测 / 零新增回归 / commit 见 changelog META-09）
   - 验收要点：enrichmentSummary 出现在 admin 列表/详情（非 public）；前端不解析零散 JSON

---

## [SEQ-20260530-01] 外部元数据 UX 整改 — P2 共享层（EnrichmentBadge）

- **状态**：✅ 已完成（META-10 ship 2026-05-30 / ADR-172 Accepted / arch-reviewer Opus PASS）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：落地「外部元数据 UX 整改」方案 P2 共享层（ADR-172 / ADR-E）：在 `packages/admin-ui` 沉淀 `EnrichmentBadge` + `EnrichmentBadgeCluster` 共享组件，消费 ADR-170 `EnrichmentSummary` 契约，为 P3 四消费面（视频库/编辑/审核/线路）提供统一徽标原语。
- **范围**：`packages/admin-ui/src/components/enrichment-badge/*` 新建 + barrel 导出 + 单测 + `docs/decisions.md` ADR-172 正式落档。**不含** 4 消费面接入（P3 feature-2）。
- **依赖**：ADR-170 ✅ Accepted（`EnrichmentSummary`/`BangumiStatus` 已在 `@resovo/types`）。
- **方案/ADR 全文**：`docs/designs/external-metadata-ux-overhaul_20260529.md` §3.3/§3.4 + ADR-172 骨架（§13）。

### 任务列表（按执行顺序）

1. **META-10** — ADR-172：EnrichmentBadge 共享组件 Props 契约（强制 Opus 子代理）+ packages/admin-ui 实装（单徽标 + 组合簇）+ barrel + 单测（状态：✅ 已完成）
   - 创建时间：2026-05-30
   - 实际开始：2026-05-30
   - 完成时间：2026-05-30（执行 claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8) ADR-172 PASS / 门禁全过 / 38 新单测 / 全量 5680 passed 零回归 / commit 见 changelog META-10）
   - 执行模型: claude-opus-4-8
   - 验收要点：①Props 契约经 arch-reviewer Opus 评审 PASS ✅（discriminated union）②零硬编码颜色（复用 `--state-*` token）✅ ③anime-only 渲染 bangumi 徽标 ✅ ④pinyin 警告 ✅ ⑤meta_score 阈值变色 ✅ ⑥单测覆盖 kind×status 映射 + cluster density + anime 分支 ✅

---

## [SEQ-20260530-02] 外部元数据 UX 整改 — P3 前端消费 feature-2（四消费面徽标）

- **状态**：✅ 主体完成（META-11 + META-12-A + META-12-B 全 ship 2026-05-30 / faces 1-3 接入；Face 4=META-13 backlog 用户未纳入）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：把 META-10 的 `EnrichmentBadgeCluster` 接入富集反馈 4 消费面（设计方案 §3.5）。
- **范围**：server-next admin UI 消费层接入；**不动后端契约**（除 Face 3 需后端补 enrichmentSummary 注入，单独成卡）。
- **依赖**：META-10 ✅（EnrichmentBadge/Cluster 已沉淀）+ META-09 ✅（VideoAdminRow/Detail.enrichmentSummary 已注入）。
- **数据可用性勘察结论**：Face 1（视频库 `VideoAdminRow`）+ Face 2（编辑抽屉 `VideoAdminDetail`）数据就绪；Face 3（审核台 `VideoQueueRow`）缺完整 enrichmentSummary 需后端补；Face 4（线路区）逐源活性已由共享 `LinesPanel` 承担。

### 任务列表（按执行顺序）

1. **META-11** — Face 1 视频库列表 `enrichment` 列（density='row'）+ Face 2 编辑抽屉 QUICK_HEAD 簇（density='header'）（状态：✅ 已完成）
   - 创建时间：2026-05-30 / 实际开始：2026-05-30 / 完成时间：2026-05-30（执行 claude-opus-4-8 / 子代理无 / 门禁全过 / 9 新单测 / 全量 5689 passed 零回归）
   - 执行模型: claude-opus-4-8
   - 验收要点：①视频库新增 `enrichment` 列（默认可见，douban_status/meta_score 隐藏列保留）✅ ②抽屉头簇含富集时间（enrichedAt.slice 0,10 / null→「未富集」）✅ ③anime 行/抽屉才显 bangumi ✅ ④门禁全过 + 9 单测 ✅
2. **META-12** — Face 3 审核台 enrichment（已拆 -A 后端 / -B 前端）
   - **META-12-A**（后端）✅ 已完成（2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / 3 新单测 / 全量 5692 passed 零回归）：`buildEnrichmentSummary` 窄化 `EnrichmentSourceRow` 复用 + moderation `listPendingQueue` SELECT +3 列 + mapper 注入 enrichmentSummary（剔除 raw metaQuality 防泄漏）+ `VideoQueueRow += enrichmentSummary?` + ADR-170 AMENDMENT 1 登记。
   - **META-12-B**（前端）✅ 已完成（2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / 5 新单测 / 全量 5697 passed 零回归）：`ModListRow` 行内簇（density='row'）+ `RightPane/TabDetail` 详情簇（density='header'）接入 `EnrichmentBadgeCluster`。
3. **META-13**（可选）— Face 4 线路区 TabLines 区头 source 徽标（`EnrichmentBadge kind="source"` 汇总 source_check_status）（状态：⬜ 待评估）
   - 创建时间：2026-05-30
   - 备注：逐源活性已由 LinesPanel 承担，本卡仅区头汇总徽标，价值边际 → 待 META-11/12 后评估是否值得做。**注**：AMENDMENT 2 已从富集簇移除 source kind；本卡若做，改用 DualSignal 体系而非 EnrichmentBadge。

---

## [SEQ-20260530-03] 富集徽标重设计 — 外部源品牌 Logo（ADR-172 AMENDMENT 2）

- **状态**：✅ 已完成（META-14-ADR/B/A/C 全 ship 2026-05-30）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：按用户走读反馈重设计富集徽标 —— 彩点+文字 → 4 外部源品牌 Logo（douban/bangumi/tmdb/imdb），移除冗余 source 徽标，修复「富集时间 vs 未匹配」矛盾（灰显未命中）。
- **范围**：`packages/admin-ui` enrichment-badge 重写 + 新 SourceLogoBadge 原语 + data-URI logo 资源 + EnrichmentSummary +3 字段（admin + moderation 数据层）+ design-token。**调用签名不变**（4 消费面零代码改动 / 仅 visual 回归）。
- **依赖**：ADR-172 AMENDMENT 2 ✅ Accepted（arch-reviewer Opus）。
- **用户批准决策**：A data-URI / TMDB+IMDb 纳入 / meta_score 仅 header / 未命中灰显。

### 任务列表（严格串行 B→A→C）

1. **META-14-ADR** — ADR-172 AMENDMENT 2 起草（arch-reviewer Opus）（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8) / decisions.md 落档）
2. **META-14-B** — 数据层：EnrichmentSummary +3（doubanId/tmdbId/imdbId）+ EnrichmentSourceRow +3 + buildEnrichmentSummary +3 投影 + moderation listPendingQueue SQL +3 列（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / 全量 5697 passed 零回归；VIDEO_FULL_SELECT 已含三列免改）
3. **META-14-A** — logo 资源 + 新原语：`enrichment-logos.ts`（4 源 base64 data-URI + href builders）+ `source-logo-badge.tsx`（三态 + a11y title/alt + href）+ design-token `--logo-absent-opacity` + 单测（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8) / 门禁全过 / 12 新单测 / 全量 5709 passed 零回归）
4. **META-14-C** — 簇重构 + 单测重写 + 4 面回归：重写 types/badge/cluster/barrel（logo 行 + 移除 source + meta 仅 header）+ 重写单测（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8) / 门禁全过 / enrichment-badge 24 + 消费面 14 单测 / 全量 5695 passed 零回归 / 4 消费面调用签名不变零代码改动·经 logo 渲染验证）

> **visual 回归（软门）**：4 消费面（视频库列/编辑抽屉头/审核行/审核详情）需用户起 dev server 走读截图确认 logo 显示。组件级测试已验证 logo 渲染（faces/moderation 渲染真实消费组件断言 data-source logo）。

---

## [CHORE-TEST-BASELINE-20260529] 清理 pre-existing 前端单测失败

- **状态**：✅ 主体完成（2026-05-30 / claude-opus-4-8 / 用户同意落卡+commit）；CrawlerClient 时区 flaky 加固 **未做**（拆为残留项，见下）
- **来源**：META-07 全量单测验证发现 / 经 stash 基线比对确认与 META-07 无关
- **台账**：`docs/audit/known-failing-tests_20260529.md`（已更新为 ✅ 已修复）
- **范围**：route-theme-selector / player-shell-hydration / ModerationBatch / SubmissionsListClient / SourcesClient / SourcesReplaceTip（前端 jsdom 测试，根因均为测试侧未跟随组件演进）
- **执行模型**：claude-opus-4-8 / 子代理：无
- **结果**：6 文件 20 用例**全绿**；全量 **5642 passed / 0 failed**（437 文件）；typecheck + lint EXIT=0。仅改测试文件，无产品代码改动。
- **根因归纳**：① 组件契约演进未同步（theme-selector 加 custom option / ModerationBatch DualSignalCount 聚合字段 / hydration 新增 preferences GET）；② server-next 客户端组件用 `useRouter` 但测试缺 `next/navigation` mock（Submissions / Sources）；③ 覆盖已删除功能（SourcesReplaceTip → 重写到「线路别名管理」链接）
- **残留项（择时）**：CrawlerClient 时区测试加固为时区无关断言（flaky，非 20 个稳定失败之一，单跑 66/66 通过）

---

## [CHORE-TEST-CRAWLER-TZ-FLAKY] CrawlerClient 时区测试加固（从 CHORE-TEST-BASELINE-20260529 拆出）

- **状态**：⬜ 待开始（择时）
- **台账**：`docs/audit/known-failing-tests_20260529.md` §Flaky
- **范围**：`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` 用例 51（时间轴 HH:MM 断言）改为时区无关，消除全量并行偶发失败
- **建议模型**：haiku（单文件断言加固）

---


## M-SN-7 跟踪卡（arch-reviewer M-SN-6-29-AUDIT 输出 + 衔接建议）

下列卡片由 CHG-SN-6-29-AUDIT 评审产出，作为 M-SN-7 入口候选。开工时按优先级取下一个。

> **2026-05-18 范围重大扩展**：用户复核发现 server-next 后台**架构性偏离设计稿**（多页面 v1 风格 DataTable + Tab + 外置 SelectionActionBar，未对照 `docs/designs/backend_design_v2.1/reference.md` §5.x + screens-2.jsx 真源），M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"。规划文档：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（5 用户决策 + 11 修订意见全部合并落地）。新增专项段「设计稿对齐重做」见下方。

### 高优先（M-SN-7 前 3 卡推荐顺序）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-01** 已完成（2026-05-18）| 文件大小守卫 `verify:file-size-budget`（**全量扩范围 28 文件**） | 实施：`scripts/verify-file-size-budget.mjs` + `package.json` 集成 + `preflight.sh` 5e2/6 步骤；**PERMANENT_EXEMPT** 5 文件（apps/server v1 frozen 永久）+ **BASELINE_EXEMPT** 23 文件（M-SN-6 复核 7 + PRE-01 全量扩 16：api/queries 5 + api/routes 2 + api/services+workers 4 + web-next 1 + player core 4）；新增零容忍 + GENERIC_WHITELIST（.types/.schema/index 等）；实测 0 新违规 ✅；4018 unit + typecheck + lint 全 PASS；新挂 5 MISC 拆分跟踪卡（API-QUERIES/ROUTES/SERVICES + WEB-NEXT + PLAYER-CORE） | opus-4-7 | 0.12w | ✅ |
| ✅ **CHG-SN-7-PRE-02** 已完成（2026-05-18）| ADR-121 R-MID-1 RETRO 协议正式化 | 起草 ADR-121（9 段结构 / 4 真源 + **7 文件**框架 / PATCH ≤ 5 豁免依据 / 4 替代方案 11 维度对比 / 5 触发重评条件）；arch-reviewer Opus 评审 A- CONDITIONAL → 红线 1 + 黄线 3 全部修订后 PASS；**重大发现**：原起草"6 文件框架"漏 `audit-log-service-enums-set-equal.test.ts` → 评审拦截修订为 7 文件；4018 unit PASS 保持 | opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-MISC-PERSITE** 已完成（2026-05-20）| perSiteOverrides UI 实装（M-SN-6 deferred 债务） | SchedulerConfigDrawer 加 perSiteOverrides 编辑区（每站点 enabled 切换 + mode 选择 inherit/incremental/full）；可考虑独立子 Drawer 嵌套 / 表格化编辑；CHG-SN-6-27 中标记 advisory 引用此卡。**实际执行**：SchedulerConfigDrawer 361L（+142L）；新增站点覆盖列表（scrollable max-h 220px）+ 移除按钮 + 添加站点 AdminSelect（searchable）；测试 8→11（+3 覆盖用例）| sonnet | 0.15-0.25w | 🟡 P2 |

### 中风险（M-SN-7 中段评估）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-MISC-FILE-SIZE** 已完成（2026-05-20）| **5 文件主动拆分预案（M-SN-6 复核扩范围）**：原 CRAWLER-FILE-SIZE 改名 + 范围扩 2 漏检 | 评估 5 文件按 PATCH-1 范式拆分：crawler 3 接近上限（CrawlerRunDetailView 445 / TaskLogsDrawer 491 / CrawlerRunsView 429）+ **AuditClient 558**（M-SN-6 新增 / CHG-SN-6-01）+ **ImageHealthClient 590**（M-SN-6 新增 / CHG-SN-6-02）；若 PRE-01 守卫触发警告则启动拆分；范式参考 CrawlerSitesTab + ControlsCard + FormDrawer + columns 拆分。**实际执行**：API queries 5 文件拆分（sources.ts / videos.ts 等）+ server-next AuditClient（558→374L）/ ImageHealthClient（590→392L）提取子组件，新增 4 文件（AuditDetailDrawer / AuditColumns / ImageHealthKpiCard / ImageHealthColumns）| sonnet | 0.3-0.6w（5 文件） | 🟡 P2 |
| ✅ **CHG-SN-7-MISC-SETTINGS-TABS** 已完成（2026-05-19）| Settings 8 类 Tab 全部落地（5 类 → 8 类）— 由 **CHG-SN-7-REDO-03-B** 兑现（commit 4186 unit PASS / +通知/API·Webhook/登录会话 + 图片占位 section）；SettingsContainer.tsx L42-50 实证 8 类全 / 本卡历史描述过时（DOCS-CLEANUP-DEBT 2026-05-25 修订）| Opus arch-reviewer (REDO-03 序列) | 0.3w 实际 / REDO-03-B | ✅ |
| ✅ **CHG-SN-7-MISC-SHELL-NOTIFICATIONS** 已完成 90%（2026-05-19 / DOCS-CLEANUP-DEBT 2026-05-25 复盘）| mockNotifications + mockTasks 已 ADR-147 接入真端点（useAdminNotifications + useAdminTasks 60s polling + lastViewedAt）/ admin-shell-client.tsx L127-128 实证；**剩 1 stub**：`adminNavCountProviderStub`（sidebar nav badge 数字）— 涉及新 ADR + 后端 nav-counts 端点（plan §4.5 协议） / 独立 follow-up **CHG-SN-7-MISC-SHELL-NAV-COUNTS** 按需立卡 | claude-opus-4-7 (ADR-147) | 0.2w 完成 / 0.1-0.3w 剩 | ✅ (90%) |

### 低风险（任意时机承接，主循环自助）

| ID | 标题 | 范围 | 工时 | 优先级 |
|---|---|---|---|---|
| ✅ **CHG-SN-7-LOW-1** 已完成（2026-05-20）| 双子卡范式 -A audit + -B UI 文档化 / admin-module-template.md 追加"写端点 + UI 拆卡决策树"节 + 决策树 + 先例表（CHG-SN-6-16/20/25/26） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-2** 已完成（2026-05-20）| NEGATED ADR 占位 / 重启路径集中说明 / decisions.md 头部追加"NEGATED ADR 占位语义"节 + 5 条规则 + 先例表（ADR-114/119/120-NEGATED） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-3** 已完成（2026-05-20）| ModerationConsole csv 豁免追溯 / ADR-106 末尾追加"toolbar-less 视图豁免 csv-export"节 + 2 条规则 | 0.03w | 🟢 P3 |
| **CHG-SN-7-LOW-4** | useDoubleConfirm hook 沉淀（触发条件：第 3 处复用时同卡提取） | 不立即起卡；M-SN-7 内若新增第 3 个不可逆操作（如清空 ES / 强制重建审核队列等）→ 在该卡内沉淀至 `apps/server-next/src/lib/` 或 `packages/admin-ui` | — | 🟢 P3（条件触发） |

---

## 设计稿对齐重做（M-SN-7 主线 / 2026-05-18 落卡）

> 真源：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（§0–§8 全文）。本段为 task-queue 索引；详细 spec ↔ 现状 ↔ 重做归属对照见计划文档 §1（16 路由审计矩阵）+ §2（Crawler 完整对照）。
>
> **用户决策已锁**：①Submissions 纳入 REDO-02 ②子卡 A–J 粒度 ③SHARED 拆独立 milestone 先做 ④runs 独立路由 + sidebar 二级菜单 ⑤批量动作留 REDO-01-A Opus 裁决。
>
> **取消**：~~CHG-SN-7-PRE-03~~（CrawlerSitesTab 外置 batch bar 修正）→ 整页要重做，无需局部修。

### PRE 阶段（全量审计 + ADR 起草，**1.27w**）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-04** 已完成（2026-05-20）| 全量审计 16 admin 路由 vs 设计稿 §5.1–§5.16 | 16/16 路由逐路由审计产出 ✅/⚠️/❌；arch-reviewer Opus 收尾裁决 REDO-NN 优先级（REDO-01/02/03/04 全识别 + 全完成）；评级 **A−**；MISC 跟踪 16 项（9 ✅ / 1 🟡P2 / 6 🟢P3）；REDO-04 IA 分歧正式裁决「独立路由」；`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-audit-FULL.md` 收尾节填充 | sonnet 主循环 + arch-reviewer (claude-opus-4-7) | 0.9w 实际（收尾 0.05w）| ✅ |
| ✅ **CHG-SN-7-PRE-05** 已完成（2026-05-18）| ADR-123 分类映射 schema 起草 — **Accepted** | spawn Opus 子代理 1 轮独立起草 ADR-123 A−（方案 A 新建表 `crawler_site_category_maps` / 复用 VideoGenre + `_unmapped`+`_discard` 特殊值 / 入库前查表映射 / PUT 全量替换语义 + 7 文件 RETRO 框架 / migration 064 SQL 草案完整）；REDO-01-F 按 spec 三段实施路径锁定 | arch-reviewer (opus-4-7) | 0.1w | ✅ |

### M-SN-SHARED milestone（共享原语前置，**0.9w**）

> 三张子卡可并行（无相互依赖），**必须先于任何 REDO-XX 完成**。验收门：颜色零硬编码 + 双品牌 baseline + 入库 `packages/admin-ui/src/components/`。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-SHARED-01** 已完成（2026-05-18）| KpiCard `progress?` prop 扩展（footer spark/progress 互斥拓展） | 新增 `KpiCardProgress` interface（value/total/color?/showLabel?）+ 渲染于 footer 60×18 槽位与 spark 互斥 + 4 dev warn 防御（非 primitive value 无 ariaLabel / progress+spark 并存 / value<0 或 total<=0 / color 非 CSS 变量）+ a11y aria-label 追加百分比；arch-reviewer Opus 1 轮 **A- 无红线 / 3 黄线** → 采纳黄线 1+2（color 运行时防御 / a11y 追加 %）跳过黄线 3（value=0 争议）；MetricKpiCardRow + AnalyticsView 零破坏；**17 新 case** PASS（原 49 → KpiCard 54 测试）| opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.1w | ✅ |
| ~~**CHG-SN-SHARED-02**~~ | ❌ **取消**（2026-05-18 实施前实测：DataTable v2 已支持 `renderExpandedRow` + `expandedKeys` + selection + pagination 三态；ADR-117 + CHG-DESIGN-02 Step 5 已落地；Sources MatrixExpand 生产消费验证）→ REDO-01 Crawler 重做直接消费 DataTable v2 | — | 0w（原 0.4w）| — |
| ~~**CHG-SN-SHARED-03**~~ | ❌ **取消**（PRE-04 全部 16 子卡 2026-05-18 闭环：admin-ui Spark 已入库；dashboard / analytics / sources 三处消费形态对齐设计稿，未发现新形态需求） | — | — | — | — |

### CHG-SN-7-REDO-01 采集控制重做（**2.55w**，依赖 SHARED milestone 完成）

> 计划文档 §2.4 对照表全 22 行为 REDO-01-J 强制 checklist；任一行 ❌ → J 不通过。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-01-A** 已完成（2026-05-18）| Opus 子代理设计 Crawler 重做契约 — 580 行产出落 `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-redo-01-contract.md` | 6 组件 props/state/事件契约 + 5 Open Issues 全裁决（含 Q5 批量动作删除）+ 4 后端端点契约提纲 + admin-ui 消费映射 + 削减建议（D/G 共下调 0.2w → REDO-01 总估时 2.55w → 2.35w）+ 风险评估 + DAG；Opus 子代理 1 轮通过 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-B** 已完成（2026-05-18）| 后端：ADR-122 + 4 新端点 + ADR-121 4 文件 audit RETRO | 阶段 1 ADR-122 Accepted A（commit 24606c47）+ 阶段 2 4 文件实施（crawlerKpi.ts 177 / crawlerTimeline.ts 171 / crawlerDashboard.ts 178 / 前端 api.ts 扩 +75 全 < 500）+ 阶段 3 audit RETRO 4 文件框架（route auditSvc.write + 18 case 测试 / 复用 crawler.run_create actionType）+ 阶段 4 全质量门禁（typecheck ✅ / file-size ✅ / endpoint-adr ✅ 152 路由对齐 23 ADR / lint ✅ / **4053 unit PASS** 待最终验证）；§端点契约表格式修订对齐脚本期望（6 列 4 行）| Opus（ADR）+ opus-4-7 实施 | 0.6w | ✅ |
| ✅ **CHG-SN-7-REDO-01-C** 已完成（2026-05-19）| 前端骨架：新 CrawlerClient + KpiRow + TimelineCard + SiteList（9 列骨架） | 5 文件新增/重写（CrawlerKpiRow 95 / CrawlerTimelineCard 213 / CrawlerSiteList 152 / crawler-site-columns-v2 276 / CrawlerClient 312 重写）+ 3 PageHeader actions（导出 toast 占位 / + 新增 drawer / 全站全量 runCrawlerAll('full')）+ 15s 时间轴 auto-refresh + freezeEnabled 守卫 + 测试重写 16 case PASS；4053 → 4044 unit PASS（净 -9：旧 25 case → 新 16 case）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-D** 已完成（2026-05-19）| 前端站点行 + `{more}` 菜单 | 1 新 `CrawlerSiteRowActions.tsx`(127 行 / 6 菜单 + 动态 label + fromConfig 守卫)+ 4 改（columns-v2 actions 列实装 + AdminButton sm + 行 dropdown 嵌入 / SiteList 8 callback props 透传 / CrawlerClient 7 handlers 实施 runCrawlerSite+toggle+mark*+copy / test 扩 12 新 case 17–28）；CrawlerClient.tsx 312→454 行（含 7 新 handlers + freeze 守卫）；4044 → **4056 unit PASS**（+12 净增）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-E** 已完成（2026-05-19）| 前端行展开 + 线路 sub-table（只读） | ADR-117 AMENDMENT 2026-05-19 Opus 1 轮 PASS + 9 文件（types 扩 + query 扩 + service 扩 + route 扩 + 新建 CrawlerSiteExpand 313 行 + lib/sources/api 扩 + columns chevron 改 button + SiteList 透传 + CrawlerClient 注入 expand state）+ 13 backend test + 9 frontend test；4056 → **4078 unit PASS** | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-E2** 已完成（2026-05-19）| 行级 3 mutations + audit RETRO + 前端 3 actions | ADR-117 AMENDMENT 2 Opus 1 轮 PASS A（合并 actionType `sources.route_action` + 4 文件 RETRO）+ 后端 5 文件 + 前端 2 文件 + audit RETRO 4 文件 + sources-routes-mutations-audit.test.ts 10 case + CrawlerClient.test +5 case；4078 → **4095 unit PASS**；endpoint-adr 153→156 路由 / 24→27 ADR 端点；STATE_CONFLICT 409 freeze 守卫（修正 Opus 初稿 503）；R-MID-1 系统化第 13 次 | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-F** 已完成（2026-05-19）| 分类映射 collapsible（migration + GET/PUT + 前端） | 11 文件按 ADR-123 §文件范围落地：migration 064 + queries + service + 2 endpoints + types + audit RETRO 7 文件（actionType `crawler_site.category_mapping_update`）+ 前端 lib/api + 新建 CategoryMappingCollapsible 230 行 + CrawlerSiteExpand 嵌入；12 audit case + 4095→4109 unit PASS；endpoint-adr 156→158 / 24→29 ADR 端点；R-MID-1 系统化第 14 次 | opus-4-7（纯实施 / ADR-123 PRE-05 已 Opus PASS）| 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-01-G** 已完成（2026-05-19）| 高级 dropdown 4 项（PageHeader 第 4 槽位） | 新建 CrawlerAdvancedMenu.tsx (175 行 / AdminDropdown + 4 items + 双重 confirm + 动态 label) + CrawlerClient 注入 + SchedulerConfigDrawer mount；4109→**4117 unit PASS**（+8 G case）；0 新端点 / 0 新 ADR / 全 API 复用 | opus-4-7 | 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-01-H** 已完成（2026-05-19）| runs 列表迁独立路由 + sidebar 二级菜单 | git mv CrawlerRunsView.tsx 至 crawler/runs/_client/ + 新建 runs/page.tsx + admin-nav children 注册 `/admin/crawler/runs` + test import 路径同步；4117 → 4117 unit PASS（CrawlerRunsView 20 case 保持） | opus-4-7 | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-I** 已完成（2026-05-19）| 删除旧文件 + git tag 回滚锚点 | git tag pre-redo-crawler-20260519 + git rm 3 文件（CrawlerSitesTab 334 + CrawlerControlsCard 202 + crawler-site-columns 116 = 652 行清理）+ CrawlerClient 文件头注释修订 + tasks.md Rollback 命令记录；4117 unit PASS 保持 | opus-4-7 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-01-J** 已完成（2026-05-19）| 视觉回归 + Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（22 行 §2.4 checklist 21 ✅ + 1 ⚠️ 占位 / verify 全 PASS / 4117 unit / 0 硬编码 / 0 any / 0 越层 / Route→Service→Queries 分层完整）；扣 0.5 视觉回归未跑（软门 / MISC 跟踪）+ 扣 0.5 ADR-122/123 D-status JSON 仍 pending（脚本 bug 非架构缺陷 / MISC 跟踪）；**REDO-01 milestone 全闭环（A→J 10 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-02 Submissions §5.13 Card list 重做（**~2.75w**，PRE-04 + REDO-02-A0 实测 / Opus 重估）

> **2026-05-19 重估**：原 ~1w 严重低估（PRE-04 #9 仅识别 UI 层错位 / 未深入数据模型）；REDO-02-A0 Opus 子代理实测 4 类 Segment（失效源举报 / 求片 / 元数据纠错 / 已处理）当前 video_sources 单表无法承载（求片无 video_id / 元数据纠错与 source 无关）→ 新建 `user_submissions` 表 / 6 新端点 / R-MID-1 第 15 次 audit RETRO；详 ADR-124。

| ID | 标题 | 范围 | 模型 | 工时 | 状态 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-02-A0** 已完成（2026-05-19）| ADR-124 user_submissions schema 起草 | spawn arch-reviewer Opus 1 轮 PASS A（4 维度全 A / 2 黄线 Y1+Y2 主循环修订 / 3 advisory）+ 落 decisions.md 11 节 + 8 决策 D-124-1..8 + 6 端点契约 + migration 065 SQL + 3 类 metadata zod 锁定 + 7 子卡拆分；endpoint-adr 29→35 ADR 端点 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-02-A** 已完成（2026-05-19）| migration 065 + types + audit 4 真源同步 + audit content assertion | migration 065 (120 行 / 3 CHECK + 4 indexes + AD1 jsonb_typeof + AD2 partial index + backfill + ROLLBACK) + types 4 interface + actionType `user_submission.action` + targetKind `user_submission` + AuditLogService 数组 + audit-log-coverage REQUIRED + PAYLOAD + set-equal EXPECTED + UserSubmissionService stub (98 行 / writeUserSubmissionAction helper + 3 metadata zod) + 8 case PASS；R-MID-1 第 15 次系统化；4117→4127 unit PASS (+10 净增) | opus-4-7 | 0.4w | ✅ |
| ✅ **CHG-SN-7-REDO-02-B** 已完成（2026-05-19）| 6 端点 + service + queries + audit 写入 + 23 case PASS | queries 230 行 + service 扩 6 业务方法 + route 180 行 + server.ts 注册 + 状态机双重守卫（404/409 + 竞态）+ 批量静默跳过 + audit fire-and-forget；164 admin 路由 35 ADR 端点；4127→**4142 unit PASS**（+15 净增 / 23 case 总 / 含 A 卡 8 + B 卡 15） | opus-4-7 | 0.7w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE** 已完成（2026-05-19）| admin-ui 3 primitive 调研 — Card ✅ / Segment ❌ / QuoteBlock ❌ | 静态扫描 0.05w 实际（vs 0.1w 原估）；调研结论：Card 已具 AdminCard 直接消费；Segment 完全缺 + 5 处视图手撸 bottom-border 形态但 spec 是 pill-style + badge / 起 PRE-A 新卡；QuoteBlock 内联实现（spec §5.13 唯一消费） | claude-opus-4-7 主循环 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A** 已完成（2026-05-19）| Segment primitive 设计 + 实施 | spawn arch-reviewer Opus 1 轮 PASS A（D1-D6 决策清晰 / 0 红线 / 2 黄线全实施 / 2 advisory）+ 5 文件落地（types 38 / impl 203 / index / index.ts export / test 12 case PASS）；WAI-ARIA tabs activate-on-focus + roving tabIndex + ←→/Home/End + Y1 badge active 反转 + Y2 focusOnNextRender ref；4142→**4154 unit PASS**（+12 净增） | Opus（契约）+ opus-4-7（实施） | 0.2w（vs 0.25w 原估） | ✅ |
| ✅ **CHG-SN-7-REDO-02-C** 已完成（2026-05-19）| 前端 /admin/user-submissions Card list 主视图 | lib/user-submissions/{types,api}.ts + SubmissionCard.tsx (230 行 / 3 类 visual icon + 可选 poster + metadata quote + 3 按钮) + UserSubmissionsClient.tsx (200 行 / 4 Segment + 三态 + 分页) + page.tsx + nav 修订 href /admin/submissions→/admin/user-submissions + 12 case PASS（含 Segment 首次业务消费实证）；4154→**4166 unit PASS**（+12 净增 / vs 旧 397 行 DataTable 实施成本下降 50%+） | opus-4-7 | 0.7w (vs 0.8w 原估) | ✅ |
| ✅ **CHG-SN-7-REDO-02-D** 已完成（2026-05-19）| 旧 /admin/submissions deprecation banner（B'' 简化版） | 选 B'' 简化版（仅前端 banner / 后端旧端点不改）+ AdminCard surface='subtle' status='warn' + Next.js Link 跳转 + 1 banner 测试断言；M-SN-9 退役卡承担一次性清理（Y1）；4166→**4167 unit PASS**（+1）；实际 0.1w（vs 0.2w 原估 / 节省 0.1w 避免后端双写复杂度） | opus-4-7（任务卡建议 Haiku 但在 Opus 续会话不擅自降级）| 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-02-E** 已完成（2026-05-19）| RETRO 验证 + verify 全门禁 + SQL bug 主动修复 | 全 5 verify 命令逐项核验（typecheck/lint/file-size/endpoint-adr/adr-contracts）+ 修补 2 处 SQL bug（userSubmissions.ts v.cover_url → mc.cover_url + LEFT JOIN media_catalog / migration 029 已 DROP videos.cover_url 8 个月）+ 修补 D-124-3..7 changelog 闭环引用 / verify-adr-d-numbers 守卫识别；4167 unit PASS 保持；实际 0.2w（vs 0.3w 原估） | opus-4-7 | 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-02-F** 已完成（2026-05-19）| Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（14 行 §5.13 checklist 12 OK + 1 PARTIAL + 1 DEVIATION-ACCEPTED / ADR-124 11 节闭环 + D-124-1..8 全 closed / 4 真源同步 + verify 5 件套 PASS / admin-ui Segment primitive 沉淀）；扣 0.5 quote 语义映射缺 ADR 落档 + 扣 0.5 3 按钮替换缺 ADR 文档；**REDO-02 milestone 全闭环（A0→F 7 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-03 Settings 区段架构收敛（**~1.5w**，PRE-04 子卡 #14 触发）

> 触发：reference §5.11 显式提醒「sidebar 不应暴露多个 system 子项」，当前 server-next sidebar 暴露 system/{settings,cache,config,monitor,migration} 5 子项 + plan §6 8 类 Tab 实际仅 5 类。

| ID | 标题 | 估时 | 模型 |
|---|---|---|---|
| **CHG-SN-7-REDO-03-A** | ✅ 完成 2026-05-19 / sidebar IA 重构 + 6 旧 URL 308 永久 redirect + ADR-125 / Opus arch-reviewer PASS / 4177 unit PASS | 0.3w 实际 / 0.4w 估 | Opus 主循环 + arch-reviewer Opus 子代理 |
| **CHG-SN-7-REDO-03-B** | ✅ 完成 2026-05-19 / 5 Tab → 8 Tab（+通知/API·Webhook/登录会话 + 图片占位 section）/ 4186 unit PASS | 0.3w 实际 / 0.6w 估 | claude-sonnet-4-6 |
| **CHG-SN-7-REDO-03-C** | ✅ 完成 2026-05-19 / 8 KV 字段扩展（通知 5 + 会话 3）+ ADR-126 / 3 Tab 真实表单 / arch-reviewer Opus PASS / 4190 unit PASS（+13）| 0.3w 实际 | Opus arch-reviewer + claude-sonnet-4-6 主循环 |
| **CHG-SN-7-REDO-03-D** | ✅ 完成 2026-05-19 / arch-reviewer Opus A−（27 项全 ✅ / W1-W4 清理完毕 / W5 MISC 追踪卡登记）/ REDO-03 milestone 全闭环（A→D 4 子卡）| 0.2w 实际 | arch-reviewer (claude-opus-4-7) |

**注**：吸收原 `CHG-SN-7-MISC-SETTINGS-TABS`（M-SN-6 FOLLOWUP 卡）为 REDO-03-B 子任务。

### CHG-SN-7-REDO-04 ✅ Staging 路由处置（方案 A — 独立路由，~1.5w 实际）

> 完成（2026-05-19）：Opus arch-reviewer 裁决方案 A；后端 API 复用 M-SN-3；前端新建完整独立页；ModerationConsole 移除 staging tab + 添加 redirect；admin-nav 新增"暂存发布"条目；8 unit tests PASS。

### CHG-SN-7-REDO-05+ 其他低优先重做（暂无）

PRE-04 16 子卡全部闭环：5 ✅ A 级 + 8 ⚠️ S 级（16 项 MISC 跟踪）+ 4 ❌（REDO-01/02/03/04）。⚠️ S 级页面挂 MISC 卡逐项小修，**不进入 REDO 列表**。

### 估时汇总

| 阶段 | 工时 |
|---|---|
| PRE 阶段（PRE-01 + PRE-02 + PRE-04 + PRE-05） | 1.27w |
| M-SN-SHARED milestone | **0.1w**（SHARED-01 已闭环 / SHARED-02 + 03 实测 admin-ui 已具备能力取消） |
| REDO-01（采集） | 2.55w |
| REDO-02（Submissions） | **~2.75w**（REDO-02-A0 Opus 实测重估 / 原 ~1w 严重低估）|
| REDO-03+（剩余 14 路由） | ~6–10w |
| **M-SN-7 全 milestone** | **~11.0–15.0w**（PRE-04 + SHARED-02 实测累计下调 0.8w） |

### MISC 跟踪卡（PRE-04 子卡审计产出）

| ID | 标题 | 严重度 | 估时 | 触发子卡 |
|---|---|---|---|---|
| **CHG-SN-7-MISC-DASHBOARD-1** | dashboard page__head 2 按钮 onClick 绑定（全站全量采集 / 进入审核台） | ✅ 完成 | 0.05w | #1 |
| **CHG-SN-7-MISC-DASHBOARD-2** | dashboard 4 类卡片数据真实化 + 后端 3 endpoints + ADR-127（与 STATS-EXTEND-ANALYTICS 合并） | ✅ 完成 | 0.7w | #1 + #12 |
| **CHG-SN-7-MISC-DASHBOARD-3** | dashboard 编辑态规则（拖拽 / resize / 全屏 / 卡片库）—— **延后到长期 backlog M-SN-N** | 🟢 P3 | 1.5–2w | #1 |
| ✅ **CHG-SN-7-MISC-VIDEOS-1** 已完成（2026-05-20）| videos poster 尺寸决议固化（32×48 废弃 → 48×72 固化 / reference 4 处 + decisions.md 条目 / 纯文档任务） | ✅ | 0.05w | #4 |
| ✅ **CHG-SN-7-MISC-MERGE-1** 已完成（2026-05-19）| merge Segment 3 类（待审候选 / 已合并 / 已拆分）补全 | ✅ | 0.15w | #6 |
| ✅ **CHG-SN-7-MISC-MERGE-2** 已完成（2026-05-20）| merge 候选 card 形态重做（左右视频卡对比 + 影响预览 + 置信度 pill）/ CandidateExpand card 网格 + 置信度 pill + 影响预览 / SplitSection→MergeSplitSection.tsx(261L) / AuditSection→MergeAuditSection.tsx(133L) / MergeClient.tsx 756→467L / +2 tests / 4337 unit PASS | 🟡 P2 | 0.5–0.8w | #6 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-1** 已完成（2026-05-20）| subtitles KPI 4 列补全（消费 KpiCard + 后端 stats 端点扩展 / ADR-133 / 4264 unit PASS） | ✅ | 0.2w | #7 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-2** 已完成（2026-05-20）| subtitles 上传字幕 action 实装（POST /admin/subtitles / ADR-134 / SubtitleUploadModal / 4266 unit PASS） | ✅ | 0.15w | #7 |
| ✅ **CHG-SN-7-MISC-HOME-1** 已完成（2026-05-20）| home sticky 前台预览实装（1fr/360px 布局 + 右侧 sticky 预览卡 / HomePreviewPanel / 4295 unit PASS） | ✅ | 0.4w | #8 |
| ✅ **CHG-SN-7-MISC-HOME-2** 已完成（2026-05-20）| home page__head actions 完整性核实（预览前台 ghost 按钮 + 新建模块 / PageHeader actions 双按钮 / 11 unit PASS） | ✅ | 0.05w | #8 |
| ✅ **CHG-SN-7-MISC-IMAGE-1** 已完成（2026-05-20）| image-health page__head 2 actions（重扫所有封面 / 批量切 fallback 域）+ ADR-135 / SwitchDomainModal / 4279 unit PASS | ✅ | 0.2w | #11 |
| ✅ **CHG-SN-7-MISC-IMAGE-2** 已完成（2026-05-20）| image-health 破损样本 grid 实装（2:3 ratio + danger dashed border + 错误 overlay / BrokenSamplesGrid / 1fr/1fr split / 4308 unit PASS） | ✅ | 0.3w | #11 |
| ✅ **CHG-SN-7-MISC-USERS-1** 已完成（2026-05-20）| users page head actions（RoleMatrixModal 只读 + InviteUserModal 表单 / 4323 unit PASS） | ✅ | 0.3w | #13 |
| ✅ **CHG-SN-7-MISC-USERS-2** 已完成（2026-05-20）| users KPI 4 列（消费 KpiCard + 后端 users-stats 端点 / ADR-136 Opus PASS / 4332 unit PASS）| ✅ | 0.2w | #13 |
| **CHG-SN-7-MISC-AUDIT-1** | audit 时间穿梭 action（指定时间点状态回放）—— 功能需求待用户确认 | 🟢 P3 | 0.4–0.6w | #15 |
| ✅ **CHG-SN-7-MISC-LOGIN-1** 已完成（2026-05-20）| login card 视觉对齐（400×padding 40 / Brand row 36px logo + 18px title + 11px subtitle / remember checkbox / SSO 占位 disabled / 审计提示 / radial accent 背景 / vitest.config @/stores server-next 修复 / 8 unit PASS / 4347 total PASS） | ✅ | 0.2–0.3w | #16 |
| ✅ **CHG-SN-7-MISC-API-QUERIES-SIZE** 已完成（2026-05-20）| apps/api/db/queries 5 文件主动拆分：videos.ts(1609→313)+internal(193)+mutations(437)+crawler(278)+status(478) / sources.ts(818→405)+types(16)+maintenance(434) / crawlerTasks.ts(628→261)+types(78)+queries(324) / mediaCatalog.ts(577→91)+internal(280)+mutations(235) / imageHealth.ts(648→485)+scan(173) / 13 子文件全部 ≤500 行 / barrel re-export 零 import 改动 / typecheck 全绿 | ✅ | 1.0–1.5w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-ROUTES-SIZE** 已完成（2026-05-20）| apps/api/routes/admin 2 文件主动拆分：crawler.ts(960→323) + crawler.tasks.ts(443) + crawler.runs.ts(216) / moderation.ts(533→390) + moderation.douban.ts(161) / 5 文件全部 ≤ 500 行 / typecheck 全绿 / ADR 合规通过 | ✅ | 0.4–0.6w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-SERVICES-SIZE** 已完成（2026-05-20）| apps/api services + workers 4 文件主动拆分：crawlerWorker.ts(585→478) + sources(66) + enqueue(54) / VideoMergesService.ts(523→435) + schemas(111) / DoubanService.ts(511→421) + utils(108) / SourceParserService.ts(502→416) + maps(97) / 9 文件全部 ≤ 500 行 / barrel re-export 零 import 改动 / typecheck 全绿 / 4330 unit PASS | ✅ | 0.6–0.9w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-WEB-NEXT-SIZE** 已完成（2026-05-20）| apps/web-next/components/layout/Nav.tsx 580→404 / NavMoreMenu.tsx(188L) 提取 MoreMenu / 4337 unit PASS | 🟢 P3 | 0.15w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-PLAYER-CORE-SIZE** 已完成（2026-05-20）| packages/player + player-core 4 文件主动拆分：step-1 useLayoutDecision（526→16 行 barrel + 5 子文件 ×2 包）/ step-2 Player.tsx（1091→437 / 1085→430；Player/目录 6 子文件：usePlayerState + usePlayerEffects + usePlayerOrchestration + buildControlContext + PlayerOverlays + PlayerChromeBottom）/ 4332 unit PASS / typecheck 全绿 | ✅ | 1.5–2.5w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-VISUAL-CRAWLER** 已完成（2026-05-23）| Crawler 视觉回归 — `tests/visual/crawler/crawler.visual.spec.ts` 7 张 baseline 占位（kpi-row / timeline-card / site-list / site-row-expanded / advanced-menu / runs-list / page-header）；baseline capture 由用户 dev server 起后 `npm run test:visual:update` 手动触发；同 moderation 范式 ae4ea66f | ✅ | 0.1w | REDO-01-J 软门 ✅ |
| ✅ **CHG-SN-7-MISC-AUDIT-PARSER** 已完成（2026-05-19）| 实测脚本本身无 bug / 真因是 changelog 历史遗漏 6 项 D 编号引用 → changelog 补全 / 61/61 D-N 全闭环 | 🟢 P3 | 0.05w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-MISC-CRAWLER-CSV-EXPORT** 已完成（2026-05-19）| 新建 lib/crawler/csv-export.ts (35 行 / exportCrawlerSitesCsv) + CrawlerClient handleExport 委托调用（28→7 行 / 守卫 491<500）+ 14a/14b 测试拆分 | 🟡 P2 | 0.15w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-ADR-124-AMENDMENT-1** 已完成（2026-05-19）| 在 decisions.md 追加 AMENDMENT 1 段 / D-124-AMD1-1 quote→title 衍生 + metadata→quote block 映射 + D-124-AMD1-2 3 按钮替换决策 + 5 理由（重验语义由 sources.route_action 承载等）/ ADR-124 主评级 A−→**A**（闭档 2 处 DEVIATION） | 🟡 P2 | 0.05w | REDO-02-F 验收 ✅ |
| ✅ **CHG-SN-7-MISC-VISUAL-SUBMISSIONS** 已完成（2026-05-23）| /admin/user-submissions 视觉回归 — `tests/visual/user-submissions/user-submissions.visual.spec.ts` 6 张 baseline 占位（page-header / segment-bad-src / segment-processed / first-card / pagination / empty-state）；baseline capture 由用户 dev server 起后手动触发；同 moderation 范式 ae4ea66f | ✅ | 0.1w | REDO-02-F 软门 ✅ |
| **CHG-SN-7-MISC-SESSION-FIELDS-CONSUME** | session_timeout_minutes / session_max_concurrent / session_extend_on_activity 三字段当前仅存储 / 需接入会话中间件实际消费（JWT TTL / 并发踢出）— REDO-03-D 验收 W5 追踪 / ADR-128 前置 | 🟡 P2 | ~0.5w | REDO-03-D 验收 W5 |
| ✅ **CHG-SN-7-MISC-MOD-PLAYER** 已完成（2026-05-20）| **审核台播放器接入** 全 3 阶段闭合：FIX-B（commit cb29435e / LinesPanel 共享组件 + 双消费方迁移 / 4254 unit PASS +38）+ FIX-D（commit 56133915 / AdminPlayer 极简接入 + feedback 上报 / 4262 unit PASS +8）+ FIX-CLOSE（commit ae4ea66f / SEQ-20260502-01 全序列收口 + arch-reviewer Opus A− + 5 e2e + visual baseline 占位）；详 archive/changelog/changelog_M-SN-2-to-7_20260523.md | ✅ | ~2.5w 实际 | SEQ-20260502-01 ✅ 已闭合 |
| ✅ **CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER** 已完成（2026-05-19）| service ListUserSubmissionsQuerySchema 加 `processed_or_rejected` 枚举 + queries WHERE 拼 `status IN ('processed','rejected')` + 前端 lib/types 扩 + UserSubmissionsClient 改为 segment='processed' 时 status='processed_or_rejected'（移除客户端 filter / 修复分页失真 / 闭档 spec §5.13 #7 PARTIAL）| 🟡 P2 | 0.15w | REDO-02-F 验收 ✅ |

### CHG-SN-7-MISC-MOD-PLAYER 追踪卡展开（2026-05-19，2026-05-23 状态修正）

> 父序列：SEQ-20260502-01（M-SN-4 收口扫尾）
> **状态**：✅ **全 3 阶段闭合（2026-05-20）** — FIX-B (cb29435e) + FIX-D (56133915) + FIX-CLOSE (ae4ea66f)；详细 changelog 已归档至 `docs/archive/changelog/changelog_M-SN-2-to-7_20260523.md`
> 实际执行顺序：FIX-B ✅ → FIX-D ✅ → FIX-CLOSE ✅
> 总实际工时：~2.5w（与原估 2.2-2.5w 一致）
> **下方阶段 spec 保留供未来审计追溯，不再代表待办事项**

#### 阶段 1 — FIX-B：LinesPanel 共享组件提取（~1.5w，强制 Opus 子代理）

**目标**：将当前两处独立实装（审核台 LinesPanel.tsx 247 行 + VideoEditDrawer TabLines.tsx 214 行）提取为 `packages/admin-ui` 共享复合组件，同时修复 30 行平铺 → 线路聚合视图的信息密度问题。

**文件范围**：
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts`（`LineAggregate` / `EpisodeMini` / `LinesPanelProps` 契约）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/aggregate.ts`（groupSourcesByLine 纯函数 + 聚合状态规则）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx`（共享组件实体，compact/regular/comfortable 三密度）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/index.ts`（barrel）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.tsx`（SignalChip atom：probe/render × ok/partial/dead/pending/unknown 5 态）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.types.ts`
- 改：`packages/admin-ui/src/index.ts`（导出 LinesPanel + SignalChip）
- 改：`apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（迁移为消费共享组件，`compact` density，暴露 `onLineSelect` 回调）
- 改：`apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx`（迁移为消费共享组件，`regular` density）
- 新建：`tests/unit/components/admin-ui/composite/lines-panel/aggregate.test.ts`（≥ 8 case：单线路/多集/跨站同名/全 dead/全 pending/部分 active）
- 新建：`tests/unit/components/admin-ui/cell/signal-chip.test.tsx`（≥ 10 case）

**关键约束**：
- ❗ 强制升 Opus 子代理（CLAUDE.md §模型路由第 1 条：新共享组件 API 契约）
- 聚合键 = `(source_site_key, source_name)` 复合（ADR-114-NEGATED LP-03 既定）
- 聚合规则：全 ok→ok / 任意 ok 且非全 ok→partial / 全 dead→dead / 全 pending→pending / 其他→unknown
- 零硬编码颜色（CSS 变量，grep 验证）
- `onLineSelect(key: string, firstActiveUrl: string | null)` 回调供 FIX-D 消费

**估时**：~1.5w（含 Opus 评审 + 双消费方迁移 + 视觉对齐复核）
**建议模型**：spawn arch-reviewer (claude-opus-4-7) API 契约设计 + claude-sonnet-4-6 主循环实施

---

#### 阶段 2 — FIX-D：极简 AdminPlayer 接入（~0.5w）

**目标**：替换 `PendingCenter.tsx` 中的 `▶` 静态占位为可播放的 `AdminPlayer`，接入 player-core，响应 LinesPanel 选中线路切换。

**前置**：FIX-B 完成（`onLineSelect` 契约落地）

**文件范围**：
- 新建：`apps/server-next/src/lib/moderation/use-selected-line.ts`（共享选中线路状态 hook，LinesPanel ↔ AdminPlayer 桥接）
- 新建：`apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx`（包装 player-core `<Player>`，极简范围：播放/暂停/进度/集数切换/错误降级，**不接入 GlobalPlayerHost**）
- 改：`apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（替换 `{/* Video player placeholder */}` div 为 `<AdminPlayer>`）
- 新建：`tests/unit/admin-moderation/admin-player.test.tsx`（≥ 5 case：源切换/集数切换/错误降级/null 源占位/feedback 上报去抖）

**极简范围（含/不含）**：
- ✅ 播放/暂停 / 进度条 / 集数显示 / 错误降级占位
- ❌ 字幕 / 影院模式 / 画中画 / 镜头切换 / GlobalPlayerHost

**feedback 上报（D-17）**：
- `onFirstFrame` → POST /v1/feedback/playback {success: true}
- `onError` → POST /v1/feedback/playback {success: false, errorCode}
- PII 红线：不上报 userId / IP

**估时**：~0.5w
**建议模型**：claude-sonnet-4-6（player-core 已有 Player export，无新契约）

---

#### 阶段 3 — FIX-CLOSE：投产对齐收口（~0.2w）

**目标**：arch-reviewer Opus 全序列评级（目标 A−），e2e 黄金路径，visual baseline 归档。

**前置**：FIX-B + FIX-D 全部完成

**验收内容**：
- arch-reviewer Opus 评级 spec §5.2 checklist + SEQ-20260502-01 已知偏离闭档
- e2e：`tests/e2e/admin/moderation/lines-aggregate-display.spec.ts` + `player-integration.spec.ts`
- visual baseline 9 张：lines-panel-collapsed/expanded、right-pane-detail/history/similar、filter-preset-popover、player-loaded、player-error、edit-drawer-lines

**建议模型**：spawn arch-reviewer (claude-opus-4-7)

---

## M-SN-6 milestone 关闭声明（2026-05-17）

CHG-SN-6-29-AUDIT arch-reviewer (Opus) 评级 **A−** + PATCH-1 + PATCH-2 双修闭环 → **M-SN-6 正式关闭**。

**M-SN-6 最终交付指标**：
- 任务卡：47 张（44 主体 + AUDIT + PATCH-1 + PATCH-2）
- 单测：3659 → **4018 PASS**（+359）
- R-MID-1 系统化：6.5 → **12 次**（13 → 36 strict / +23）
- v1 crawler 写端点 audit 覆盖：**12/13（非 deprecated 100%）**
- 共享原语沉淀：4 cell + 2 form + 1 csv-export 工具 + N badge
- 新视图/Drawer：/admin/audit + image-health + crawler（4 视图 + 3 Drawer + 4 控制按钮）+ SettingsContainer 5/5 Tab（**注：plan §6 明列 8 类 Tab；实际交付 5 类，缺 4 类 → CHG-SN-7-MISC-SETTINGS-TABS 跟踪**）
- csv-export 消费方：5（TaskLogsDrawer + AuditClient + UsersListClient + SubmissionsListClient + VideoListClient）
- ADR 新增：ADR-118 accepted / ADR-119/120-NEGATED / ADR-105 AMENDMENT
- 文件大小硬上限：**部分合规**（CHG-SN-6-29-FOLLOWUP 2026-05-17 复核实测：crawler 域 PATCH-1 后全部 ≤ 500；但 M-SN-6 全工作目录扫描发现 7 文件超限 — 2 M-SN-6 新增（AuditClient 558 / ImageHealthClient 501）+ 5 历史遗留。已立 CHG-SN-7-PRE-01 守卫 + MISC-FILE-SIZE 拆分预案兜底）

**M-SN-7 入口**（**2026-05-18 范围扩展**）：M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"（用户复核发现 server-next 后台架构性偏离设计稿 v2.1）。

新调用顺序（计划文档 §4）：
1. **CHG-SN-7-PRE-04** 全量审计 16 路由 → 首张子卡 /admin/dashboard §5.1（用户决策"首推 PRE-04"）
2. PRE-01 文件大小守卫 / PRE-02 ADR-121 协议化 / PRE-05 ADR-123 schema（可并行）
3. **M-SN-SHARED-01/02/03** 共享原语前置（KpiCard + ExpandableTable + Spark）
4. **REDO-01-A → J** 采集控制重做
5. **REDO-02** Submissions Card list 重做
6. REDO-03+ 其他 14 路由（PRE-04 排序后填充）

详见上方「设计稿对齐重做」段 + `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md` 全文。

~~PRE-03 CrawlerSitesTab 外置 batch bar 修正~~ → **取消**（整页要重做）。

---

## [SEQ-20260521-01] docs 大清理 + manual 工程地基（执行序列）

- **状态**：✅ 已完成（3/3 卡全部 PASS：A ✅ + B ✅ + C ✅ 2026-05-21）— SEQ 收尾
- **创建时间**：2026-05-21
- **目标**：清理 docs/ 历史文档遗存（避免新开发被旧规范污染） + 新建 docs/manual/ 说明书工程骨架（M-SN-8 前置）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口（mock 视图 / 死按钮 / 断链 / UUID 输入 / dashboard 模板 等）；提出"实现 + 说明书双轨"开发模式；要求清理历史文档作为入门第 0 步
- **依赖**：M-SN-6 已关闭 / M-SN-7 REDO-01/02/03 全闭环 / PRE-04 全量审计 A− PASS
- **真源**：用户决策三连（2026-05-21）：① 全归档 27 份 ② tracks.md 保留顶层 ③ admin-module-template.md 保持现状
- **节奏**：用户决策"仅先 C1 + 看状况"——A 跑完后视 verify 红线情况再放 B/C 上手

### 子卡序列（3 卡）

1. **CHG-SN-7-CLEANUP-01-A** · docs 归档（26 mv + 4 rm 纯归档不改引用）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet（CLAUDE.md §模型路由 Haiku 适用 #2 文档归档；当前 opus 续会话不擅自降级）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **范围**：见原 tasks.md 卡片（已闭环移除）
   - **e2e 黄金路径**：无（纯文档归档）
   - **完成备注**：
     - 实际 26 mv（原估 27 含 tracks.md，用户决策保留顶层 → 实际 26）+ 4 rm（2 audit stub + baseline_20260418/ + handoff_20260422/）+ 4 新 archive README + 2 task 文件 + 1 副作用 unstage = 总 36 staged
     - 4 子目录创建：milestone-audits(6) / m-sn-7-redo(3) / design-iterations(11) / admin-v1(4)；server_next_view_template + PRE-01-A-drill 进 archive/2026Q2/ 根
     - tasks.md 卡片"范围 27"为估算口径偏差 1（含 tracks.md 决策推翻），不影响 mv 实际操作
     - typecheck PASS / lint PASS（仅 pre-existing img 警告，与本卡无关）
     - verify:adr-contracts pre-existing 红线 `apps/server-next/src/app/login/page.tsx:7 background+backgroundColor`（CHG-SN-7-MISC-LOGIN-1 提交，与本卡无关）— 已 stash 验证非本卡引入
     - **预期失败点观察**：本卡未跑 markdown 链接 grep；该工作转 CHG-SN-7-CLEANUP-01-B 启动时统一 grep 评估
     - 工时实际 ~0.15w
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-7-CLEANUP-01-B** · 引用改写 + docs/README 重写 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - grep 引用面评估实证：CLAUDE.md 零引用（决策 3 admin-module-template 不动 100% 安全）→ CLAUDE.md 修订移出本卡范围
     - 8 份宿主 sed 批量改 26 条映射规则（M-SN-6-...-17-RECHECK.md 必须先于 -17.md 防前缀冲突）：task-queue.md 37 / changelog.md 30 / decisions.md 12 / server_next_plan 7 / tracks.md 4 / logging-rules.md 1 / reference.md 1 / architecture.md 1
     - docs/README.md 整体重写：§1 权威文档清单精简 + §3 已归档参考分 5 子段 + §6 新增 M-SN-8 manual 入口（4 条硬约束 H1-H4 + 双轨流）
     - 0 残留验证：26 项归档文件全部在非 archive 路径 0 命中
     - typecheck PASS / lint PASS（FULL TURBO 缓存命中）
     - 总 diff：10 文件 +232 / -135 行
   - **工时估算**：0.18w / 实际 ~0.18w

3. **CHG-SN-7-CLEANUP-01-C** · docs/manual 骨架 + verify:manual-coverage 守卫 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - manual 35 文件骨架全部新建：
       - 1 主 README + 90-glossary（含 20 术语 + 7 缩写）
       - _template/PAGE_TEMPLATE.md（8 章节模板）+ _template/WORKFLOW_TEMPLATE.md
       - 00-roles-and-permissions（5 角色矩阵 + 11 操作权限速查）+ 01-getting-started（含 10 快捷键）
       - 10-workflows/ README + W1 金票（完整骨架含反例与失败处理）+ W2-W5 简骨架
       - 20-pages/ README + 15 P-* 骨架（按 admin 路由 1:1，含 P-submissions-deprecated 特殊映射）
       - 30-pickers/ README + 5 picker 骨架（VideoPicker / SourceLinePicker / ContentRefPicker / UserPicker / SitePicker）
     - scripts/verify-manual-coverage.mjs 守卫：扫 apps/server-next/src/app/admin/*/page.tsx + /login → 比对 docs/manual/20-pages/ → 缺失 FAIL / 多余 WARN
     - KNOWN_NO_MANUAL 豁免清单：dev / system / analytics / staging（4 项 stub 路由）
     - SPECIAL_MAP：submissions → P-submissions-deprecated.md（deprecation banner 特殊映射）
     - package.json 加 "verify:manual-coverage"（位于 file-size-budget 与 migrate 之间）
     - 实测：15 admin 路由 ↔ 15 P-* manual = 1:1 PASS
     - typecheck + lint PASS（FULL TURBO 缓存命中）
     - preflight.sh 集成推迟（独立 follow-up 卡 CHG-SN-7-MISC-PREFLIGHT-MANUAL，按需启动）
   - **工时估算**：0.3w / 实际 ~0.25w

### 关键约束

- 用户决策固化：全归档 27 份 / tracks.md 保留 / admin-module-template.md 保持单文件
- 每子卡独立 commit + 独立 typecheck + lint + verify 验收
- A 子卡验收后视 verify 红线数量决定 B 子卡范围（红线越多说明引用面越大）

---

## [SEQ-20260521-02] M-SN-8 Critical Path Hardening · 采集→审核→上架 金票闭合 + Picker 消灭 UUID（执行序列）

- **状态**：✅ **SEQ 几近完结**（7/9 ✅ + 1 NEGATED + 1 ADR 前置 -04 待启）— 01/02/03/SHARED-04-A/05/06/08 ✅ + 07 ❌ NEGATED；**CHG-SN-8-06 重大发现**：approve_and_publish 端点已存在，零 ADR 已闭合；**仅剩 CHG-SN-8-04 TabSimilar 需新端点 ADR 前置**，独立 SEQ-20260521-03 重起
- **创建时间**：2026-05-21
- **目标**：闭合 W1 金票（采集 → 审核 → 上架）端到端业务链路；消灭 UUID 输入（H4）；删死按钮（H2）；删 mock（H1）；通断链（H3）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口；docs/manual/10-workflows/W1-crawl-to-publish.md §3 反例段明示 5 个修复点
- **依赖**：SEQ-20260521-01 全部 3 卡 PASS（commit 7a0f75b7 manual 骨架就位）
- **真源**：`docs/manual/10-workflows/W1-crawl-to-publish.md` + `docs/manual/README.md` §3 四条硬约束
- **节奏**：用户决策"自动化执行"——按子卡顺序自动推进，遇 BLOCKER 才停；每张卡独立 commit + 独立验收

### 子卡序列（9 卡）

1. **CHG-SN-8-01** · Crawler「全站全量」改非主操作 + 双重确认（输入"全量"防误触）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus 续会话）
   - **子代理**：无
   - **完成备注**：
     - CrawlerClient.tsx：拆 `handleRunAll` → `handleRunAllIncremental` + `handleRunAllFull`；主按钮 testid `crawler-run-all-btn` → `crawler-run-all-incremental-btn` / label "全站全量" → "全站增量" / onClick → incremental
     - 主按钮路径：单次 confirm「确定对全站发起增量采集？」→ `runCrawlerAll('incremental')`
     - 全量路径（高级 dropdown，danger 样式）：① confirm「确定对全站发起【全量】采集？」② prompt 要求输入"全量"二字，输错静默中止 → `runCrawlerAll('full')`
     - CrawlerAdvancedMenu.tsx：扩 props `onRunAllFull` + `runAllFullPending`；items 顶部加 `run_all_full` 项（danger + separator + 动态 pending label）；现 5 items（run_all_full / scheduler / reindex / stop_all / freeze）
     - P-crawler.md DoD §0 已填：§1/§2/§3.1.1+§3.1.2/§4.1+§4.2+§4.3/§8 关系图；§3.2/§3.3 留待后续卡填
     - CrawlerClient.test.tsx：用例 #2/#11/#12/#13 更新（incremental + 新 testid）+ 补 4 新用例 #13a/#13b/#13c/#13d（advanced menu 双重 confirm / 输错中止 / 第一次取消 / freeze 拦截）
     - 验收：58/58 CrawlerClient.test PASS / typecheck + lint + verify:manual-coverage PASS
     - 全量 unit 单跑 PASS；并跑偶发 fail 2 文件（VideoImageSection / StagingEditPanel）经 stash 验证为 pre-existing flaky 与本卡无关
   - **关联问题**：用户问题 #4「全站全量采集非常用操作，改为全站增量 + 二次确认」
   - **工时估算**：0.1w / 实际 ~0.12w

2. **CHG-SN-8-02** · Crawler 「最近采集」列升级 status pill — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - 范围收敛：实施前评估发现「增量/全量 inline btn」已存在（CHG-SN-7-REDO-01-D 落地）；「调度 mode pill」需 cross-fetch `AutoCrawlConfig.perSiteOverrides`（`CrawlerSite` 类型无 schedulers 字段）→ 工时会爆 0.15w 上限；本卡聚焦最痛点「lastCrawl 列无 status 视觉」
     - 实施：crawler-site-columns-v2.tsx 升级 `lastCrawl` cell — 单纯相对时间 → status pill（成功 ok / 失败 failed / 运行中 running / 未采集 null）+ 相对时间双行视觉；列宽 110 → 130
     - 调度列推迟到 **CHG-SN-8-02-B**（独立 follow-up，需先决策是否扩 CrawlerSite type 加 scheduleMode 字段以避免 cross-fetch）
     - 测试 +3 用例（#13e/#13f/#13g：ok pill / failed pill / null pill）；总 61/61 PASS
     - typecheck + lint + verify:manual-coverage PASS
     - P-crawler.md §3.2 / §5 字段 / §6 状态颜色 / §7 FAQ 全部填写完整
   - **关联问题**：用户问题 #11 「列显示不完整」最痛点（看不到上次成功/失败）
   - **follow-up**：CHG-SN-8-02-B 调度列（需先评估 AutoCrawlConfig fetch 时机或 row-level 字段扩展）
   - **工时估算**：0.15w / 实际 ~0.1w（范围收敛）

3. **CHG-SN-8-03** · 采集 toast → /admin/moderation?run_id 软深链（W1 金票 ②）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：评估后选**软深链**（前端 toast action + URL banner，不改后端）；硬过滤（后端 GET pending-queue 加 ?runId= filter）触发 plan §4.5 ADR-端点先后协议 → 推迟 CHG-SN-8-03-B
   - **完成备注**：
     - CrawlerClient.tsx：导入 useRouter；增 helper `buildModerationDeepLinkAction(runId)` 返回 Toast action `{label:'查看本次新增视频', onClick}`；handleRunAllIncremental + handleRunAllFull 两个 toast 加 action
     - 新建 RunInfoBanner.tsx（AdminCard surface='subtle' status='ok' + 「清除筛选」按钮）
     - ModerationConsole 增 `runIdParam` 读 query + `dismissRunBanner` 移除 run_id 参数；条件渲染 RunInfoBanner（在 Segment tabs 上方）
     - CrawlerClient.test 顶层 mock `next/navigation`（routerPushMock 共享），补 1 用例 #13h（action 存在 + onClick 触发 router.push）
     - 新建 RunInfoBanner.test 4 用例（runId 短 ID / 文案 / dismiss / data-testid）
     - typecheck PASS（修 1 个 AdminCard status='info' → 'ok' 类型约束 — admin-ui Card status 只支持 ok/warn/danger）
     - 62/62 CrawlerClient PASS + 4/4 RunInfoBanner PASS = 全绿
     - 文档：P-crawler §3.3 完整填写 / P-moderation §0/§1/§2/§3.0/§8 填写 / W1 反例段 #1+#2 勾掉 ✅
   - **关联问题**：H3 链路打通 / W1 金票反例 #2
   - **follow-up**：CHG-SN-8-03-B（后端 pending-queue 接 runId filter；需起 ADR + R-MID-1 同步）
   - **工时估算**：0.15w / 实际 ~0.18w

4. **M-SN-SHARED-04-A** · VideoPicker 业务原语沉淀 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 / 0 红条件）
   - **完成备注**：
     - Step 0 spawn arch-reviewer Opus 子代理：D1-D11 11 维度产出（组件分层 / 数据模型 / Props API / fetcher 注入 / 键盘 a11y / 状态机 / 错误态 / export 清单 / 文件结构 / 测试 surface / 风险）；评级 **A−**（v1 不公开 PickerDialog 子件为最小公开面，未来 SourceLinePicker 复用时再提升 export）
     - Step 1 packages/admin-ui/src/components/pickers/video-picker.types.ts（PickerVideoItem / VideoPickerFilter / VideoPickerFetcher / VideoPickerFetchParams / VideoPickerFetchResult / SingleVideoPickerProps / MultipleVideoPickerProps / VideoPickerProps / DialogState）
     - Step 2 picker-result-row.tsx + picker-trigger.tsx + picker-dialog.tsx + video-picker.tsx + index.ts 共 5 实施文件（types 1 + 实施 5 = 6 文件）
     - Step 3 packages/admin-ui/src/index.ts 加 `export * from './components/pickers'`
     - Step 4 单测 14/14 PASS（覆盖 D10 列出全部 14 用例：触发器渲染 / 多选回显 / Dialog 开关 / debounce 300ms / 搜索结果 / 单选确认 / 多选 staging / 多选取消 / 空结果 / 网络错误 / 键盘 ArrowDown+Enter / disabled / 触发器清除）
     - Step 5 docs/manual/30-pickers/VideoPicker.md 8 章节定稿（含消费方 fetcher 注入示例）
     - 实施 1 偏离 OpenAI 子代理建议：AdminInput 不 forwardRef → 用 dialog body querySelector('input') 替代 ref-based focus；不影响功能
     - 1 type adjust：EmptyState 不接受 data-testid → wrap 在 `<div data-testid>` 内
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：用户问题 #8（字幕 UUID）+ #10（首页模块 UUID）+ #7（合并入口）的钥匙
   - **后续**：CHG-SN-8-08 视频库合并入口可消费此 picker；字幕上传 / 首页模块的废 UUID 改造在独立 follow-up（不阻塞 SEQ）
   - **工时估算**：0.3-0.4w / 实际 ~0.35w

5. **CHG-SN-8-04** · 审核台 RightPane TabSimilar 实装 — 状态：✅ **已完成**（由 SEQ-20260521-03 拆为 -ADR/-EP/-VIEW 3 子卡兑现）
   - **重定向**：原占位卡 → 实际由 **SEQ-20260521-03** 3 子卡完成：
     - CHG-SN-8-04-ADR ✅（2026-05-21 / Opus arch-reviewer A− / ADR-137）
     - CHG-SN-8-04-EP ✅（2026-05-21 / 端点 + Service + Queries + 13 单测）
     - CHG-SN-8-04-VIEW ✅（2026-05-21 / TabSimilar 实装 + merge 深链 + 5 单测）
   - **关联问题**：用户问题 #5 + #7 → W1 反例 #3 **完全闭合**
   - **状态修订**：DOCS-CLEANUP-DEBT 2026-05-25（原 ⬜ 占位卡描述过时）

6. **CHG-SN-8-05** · 审核台 RightPane 批量「重测此视频线路」按钮 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：原任务卡是 per-line inline 重测但需改 LinesPanel API（共享组件 API 契约 → Opus 评审协议）→ 收敛为审核台 TabDetail 顶部「批量重测此视频线路」按钮（不动 admin-ui 公开 API）；per-line 推迟到 CHG-SN-8-05-B
   - **完成备注**：
     - TabDetail.tsx 顶部加 actions row + AdminButton 「重测此视频线路」+ loading 态
     - handleReprobeAll：listVideoSources → Map 去重 (siteKey, sourceName) → Promise.allSettled 循环 reprobeRoute → 汇总 toast（成功/部分失败/全失败 3 态）+ 处理空线路 / fetch 错误
     - reprobeRoute 与 listVideoSources 现成 API，零新端点 / 零 ADR
     - TabDetailReprobe.test 4 用例 PASS（按钮渲染 / 调用去重 / 部分失败 warn / fetch 错误 danger）
     - typecheck + lint + verify:manual-coverage PASS
     - W1 反例 #4 ✅；P-moderation §3.1a 完整填写
   - **关联问题**：W1 金票反例 #4「探/播 待测」无测试入口
   - **follow-up**：CHG-SN-8-05-B（per-line inline 重测需 LinesPanel API 扩展 + Opus 评审）
   - **工时估算**：0.2w / 实际 ~0.2w

7. **CHG-SN-8-06** · 审核台「通过即上架」开关 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **重大发现**：`approve_and_publish` action **已存在**（apps/api/src/routes/admin/videos.ts:35 + reviewVideo signature 已支持），admin only；本卡**零新端点 / 零 ADR**，与原任务卡估时假设不符
   - **完成备注**：
     - lib/moderation/api.ts approveVideo 加 andPublish 可选参数（默认 false）；true → 'approve_and_publish'
     - ModerationConsole 增 approveAndPublishOn state + sessionStorage 持久化（key: `admin.moderation.approveAndPublishOn.v1`）
     - Segment tabs 右侧加 toggle 标签（仅 pending tab 显示）：off「通过 → 暂存」 / on「✓ 通过即上架」+ title 解释
     - handleApprove 串接：调 approveVideo(id, approveAndPublishOn)
     - moderation-api.test 补 3 用例（默认 / 显式 false / true）；15/15 PASS
     - P-moderation §3.1b 完整填写（含权限说明 moderator vs admin）
     - W1 反例 #5 从 ⚠️ 升级为 ✅（admin 有 toggle / moderator IA 路径保留）
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：W1 金票反例 #5「通过后 staging 多走一步」
   - **工时估算**：0.25w 原（假设端点扩展）/ 实际 ~0.1w（端点已存在）

8. **CHG-SN-8-07** · /admin/staging → /admin/moderation?tab=staging 单一真源 — 状态：❌ **NEGATED**（2026-05-21）
   - **NEGATED 理由**：与 **CHG-SN-7-REDO-04 Opus arch-reviewer 已闭合裁决「独立路由」**直接冲突（commit 范围内 staging tab 已从 moderation 移除 + 新建 /admin/staging 独立页 + ModerationConsole router.replace 把 ?tab=staging 反向跳独立路由）。本卡草拟时未识别 REDO-04 裁决；按 CLAUDE.md「主循环不得直接改写架构决策 / 必须先 spawn Opus 子代理出具方案」+ §模型路由「不得自动推翻已闭合裁决」原则，本卡 NEGATED 不实施
   - **重启路径**：若未来确认要反转 IA 决策（合并回 moderation tab），必须：① 起新 ADR 修订 REDO-04 → ② Opus arch-reviewer 评审 → ③ 落 docs/decisions.md NEGATED-ADR 范式 → ④ 起新实施卡
   - **不在范围**：本会话不推翻 REDO-04 裁决

9. **CHG-SN-8-08** · 视频库行级「发起合并」深链 + Merge 页接 candidate_a — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案收敛**：原任务卡含 VideoPicker 选 candidate_b 集成；本卡先打通入口（dropdown item + 深链 + banner），VideoPicker 集成留 -08-B follow-up
   - **完成备注**：
     - VideoRowActions.tsx：导入 useRouter；buildItems 加「发起合并」item（separator）；onClick → `router.push('/admin/merge?candidate_a=<id>&from=videos')`
     - MergeClient.tsx：导入 useRouter + useSearchParams；读 ?candidate_a + ?from；条件渲染 AdminCard banner「已锁定候选 A: <短 ID>」+「清除」按钮（清除时仅删 candidate_a + from 保留其它 params）
     - MergeCandidateBanner.test 3 用例 PASS（无 query 不渲染 / 有 query 渲染 + 短 ID + 来源文案 / 清除按钮调 router.replace 保留其它 params）
     - W4 工作流入口章节更新「从视频库进入」标 ✅；CHG-SN-8-04 类似 tab 入口标「待启动」
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：用户问题 #7「合并拆分页没有入口」
   - **follow-up**：CHG-SN-8-08-B（merge 页接 VideoPicker 直接选 candidate_b 完成合并，免转 candidate 列表）
   - **工时估算**：0.2w / 实际 ~0.2w

### SEQ-20260521-02 关键约束

- **9 卡按序执行**：第 4 卡（VideoPicker）可与 1/2/3 并行但作为 8/9 的硬前置
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**
- **遇 BLOCKER 必停**：CHG-SN-8-04 端点起 ADR 前置 / CHG-SN-8-06 端点扩展 ADR 前置 — 若需起 ADR 而 plan §4.5 协议要求 Opus PASS 才能起实施，则起 ADR 卡 + 等 Opus
- **DoD §0 强制**：每卡先回填 docs/manual/20-pages/P-<slug>.md §3 草稿，PASS 前定稿
- **总工时估算**：~1.9w（含 ADR 风险缓冲）

---

## [SEQ-20260521-03] CHG-SN-8-04 TabSimilar — 类似视频召回 ADR + 端点 + 视图（执行序列）

- **状态**：✅ **SEQ 全部完结**（3/3 卡 PASS：-ADR ✅ + -EP ✅ + -VIEW ✅ 2026-05-21）— W1 反例 #3 完全闭合
- **创建时间**：2026-05-21
- **目标**：W1 金票反例 #3「审核台右栏类似 Tab 是占位」彻底闭合 — 起新端点 `GET /admin/moderation/:id/similar` + 召回算法 + TabSimilar 实装
- **背景**：SEQ-20260521-02 跳过 -04 是因为新端点触发 plan §4.5 ADR-端点先后协议；本 SEQ 起 ADR 卡 + Opus 评审 + 实施
- **依赖**：SEQ-20260521-02 已完结（7/9 ✅ + 1 NEGATED）；VideoPicker 已就绪（M-SN-SHARED-04-A 可被 TabSimilar 复用作"手动合并目标选择"扩展面）

### 子卡序列（3 卡）

1. **CHG-SN-8-04-ADR** · ADR-137 起草（类似视频召回端点协议）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 + 1 非阻塞建议 N1）
   - **完成备注**：
     - spawn arch-reviewer Opus 1 轮：ADR-137 11 节完整正文（决策摘要 / 背景 / D-137-1..6 决策 / 端点契约表 / SQL 设计 / Response 结构 / zod schema / 性能 baseline / 分层约束 / 4 文件 R-MID-1 GET 简化版 / 关联 ADR）
     - D-137-1 算法采纳方案 A（纯字段过滤 + Service 层加权评分）
     - D-137-2 评分公式 4 维（type +40 / year delta +25 / country +15 / genres Jaccard +20）
     - D-137-3 权限 moderator+admin
     - D-137-4 query params `?limit=10` + `?yearRange=5`
     - D-137-5 GET 只读不写 audit → R-MID-1 降级 4 文件
     - D-137-6 性能 p95 ≤ 200ms / 粗筛 LIMIT 50
     - **重要发现**：年份/国家/genres 字段不在 videos 表（migration 029 已迁），需 JOIN media_catalog（实施时利用 idx_catalog_type_year / idx_catalog_genres GIN 索引）
     - N1 非阻塞建议（跨类型相似召回 fallback）登记 ADR §11 末段；如未来用户反馈漏召回明显，立独立 CHG-SN-8-04-N1 follow-up 卡
     - decisions.md ADR-137 完整章节落盘（D-137-1..6 含初始 Accepted 闭环）
     - plan §9 ADR 索引推进至 ADR-137 Accepted
     - verify:adr-d-numbers advisory：6 个 D-137-* 编号已通过 changelog 闭环（本卡条目明示）
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」
   - **工时估算**：0.15w / 实际 ~0.15w（含 Opus 评审 1 轮）

2. **CHG-SN-8-04-EP** · 端点 + Service + Queries 实施（ADR-137 落地）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（按 ADR-137 直接实施）
   - **完成备注**：
     - queries/moderation.ts：新增 `findVideoFeatures(db, id)` 返回 VideoFeatures | null（JOIN media_catalog）+ `listSimilarCandidates(db, query)` 粗筛 LIMIT 50（按 ADR §5 SQL）
     - ModerationService.ts：新增 `listSimilar(id, opts)` 方法（404 NOT_FOUND if target null → 调 candidates → computeSimilarityScore 4 维加权 → minScore=10 过滤 → score desc 排序 → top-N 截断 → camelCase 映射）；导出 `SimilarVideoItem` 类型 + `computeSimilarityScore` 纯函数
     - routes/admin/moderation.ts：新增 `SimilarPathParams` + `SimilarQueryParams` zod schema；新增 `GET /admin/moderation/:id/similar` handler（双 zod 校验 + AppError NOT_FOUND → 404 + 500 兜底）
     - moderation-similar.test 13 用例 PASS（happy path / NOT_FOUND / 空 / limit / yearRange / minScore 过滤 + computeSimilarityScore 7 公式用例）
     - **顺手修 pre-existing 红线**：apps/server-next/src/app/login/page.tsx:7 background+backgroundColor → backgroundColor+backgroundImage（CHG-SN-7-MISC-LOGIN-1 引入的 shorthand 冲突已修，verify:style-shorthand-conflict 0 命中）
     - typecheck + lint + verify:adr-contracts 全 PASS（含 endpoint-adr 173 路由对齐 44 ADR 端点）
     - **关键调整**：ADR-137 §4 标题从 `### 4. 端点契约` 改为 `### 端点契约`（去掉编号）以匹配 adr-parser.mjs 正则
   - **关联**：W1 反例 #3 接近闭合（端点就绪，剩 -VIEW 卡）
   - **工时估算**：0.2w / 实际 ~0.25w（含 pre-existing 红线修复 + parser 编号调整）

3. **CHG-SN-8-04-VIEW** · TabSimilar 实装 + 测试 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - `apps/server-next/src/lib/moderation/api.ts`：新增 `SimilarVideoItem` 类型 + `ListSimilarVideosOptions` + `listSimilarVideos(videoId, opts)` 客户端封装（调 `GET /admin/moderation/:id/similar`）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx`：从 47 行占位扩展为 145 行真实组件 — 4 态机（loading / results / empty / error）+ useEffect cancellable fetch（videoId 变化或重试时取消 stale）+ 列表行（标题 + meta + similarityScore pill + 「发起合并」按钮）+ 行级 router.push 深链至 /admin/merge?candidate_a=<视频>&candidate_b=<相似>&from=moderation
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/index.tsx`：TabSimilar 调用补 `videoId={v.id}` prop
     - TabSimilar.test 5 用例 PASS（loading / 列表渲染 / merge 深链跳转 / 空召回 / 网络错误）
     - typecheck + lint + verify:adr-contracts + verify:manual-coverage 全 PASS
     - **ADR-137 §3 D-137-1..6 完整 e2e 链路验证**：前端 → /lib/moderation/api.ts → /admin/moderation/:id/similar → ModerationService.listSimilar → queries.findVideoFeatures + listSimilarCandidates → computeSimilarityScore → top-N response → TabSimilar 渲染 + merge 深链
     - **P-moderation §3.3.3 + W1 反例 #3 ✅ 标完成**
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

### SEQ-20260521-03 关键约束

- **3 卡线性依赖**（ADR → EP → VIEW），不能并行
- **ADR Opus 任一红线 → BLOCKER 暂停**（按 plan §4.5）
- **总工时估算**：~0.5w（vs 原 SEQ-02 中 -04 单卡 0.4w 估算偏低；拆 3 子卡更现实）

---

## [SEQ-20260521-04] M-SN-8 follow-up 收尾（消费 VideoPicker / 用户原 13 问题闭合）

- **状态**：✅ **已完成**（10/10 子卡全 ✅ / #3 OTHERS 条件触发未启用 / DOCS-CLEANUP-DEBT 2026-05-25 状态修订）
- **创建时间**：2026-05-21
- **目标**：消费 M-SN-SHARED-04-A VideoPicker 修复用户原 13 问题中明确点出的反 UUID 痛点（#8 字幕上传 / #10 首页模块），落实 4 条硬约束 H4「零 UUID 输入」
- **依赖**：M-SN-SHARED-04-A 已就绪（commit 1c2b2329）；SEQ-20260521-03 全部 PASS（W1 金票 100% 闭合）

### 子卡序列

1. **CHG-SN-8-FUP-SUB** · 字幕上传 Modal 接 VideoPicker — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（VideoPicker 已走过 Opus 评审）
   - **完成备注**：
     - 新建 `apps/server-next/src/lib/videos/picker-fetcher.ts` 导出 `videoPickerFetcher` 函数（listVideos → PickerVideoItem 字段映射）
     - SubtitleUploadModal.tsx：state `videoId: string` → `video: PickerVideoItem | null`；删除 `^[0-9a-f-]{36}$/i` UUID 正则校验；UI 「视频 ID（UUID）」 input → `<VideoPicker label="视频" required>`；onSubmit 传 `videoId: video.id`
     - SubtitleUploadModalPicker.test 4 用例 PASS（VideoPicker 渲染 / video 必选校验 / 提交携带 video.id / Modal 复位）
     - typecheck + lint + verify:manual-coverage 全 PASS
     - 文档：P-subtitles §3.1 完整填写（含搜索操作步骤 + 快捷键）；VideoPicker.md 受害方表标 ✅
   - **关联问题**：用户问题 #8「字幕上传通过 UUID 设计需要彻底重写」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-8-FUP-HOME** · 首页模块 ContentRefPicker + HomeModuleDrawer 接入 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D1-D11 11 维度契约）
   - **完成备注**：
     - Step 0 spawn Opus 起草 ContentRefPicker API 契约（外部受控 / 不内置 type tab / videoFetcher + videoTypeOptions 注入 / video 编辑态 fetcher 恢复 + AbortController）
     - Step 1 `packages/admin-ui/src/components/pickers/content-ref-picker.types.ts`（ContentRefType union + ContentRefPickerProps）
     - Step 2 `packages/admin-ui/src/components/pickers/content-ref-picker.tsx`（~225 行 / 4 类型条件渲染 / video 适配层 / URL 内联校验 / fallback console.error）
     - Step 3 admin-ui pickers/index.ts export ContentRefPicker + Type
     - Step 4 HomeModuleDrawer 接入：替换原 contentRefId AdminInput + 4 hint 反人类填法 → `<ContentRefPicker>` 单组件；setField type 变化时同步 reset contentRefId（Opus 评审建议 2）；新增 VIDEO_TYPE_OPTIONS 11 项注入
     - Step 5 测试 10 用例 PASS（≥ 8 必须 + 2 advisory）：video 选中 / external_url 校验 / custom_html / video_type select / type 切换 / videoFetcher 缺失降级 / disabled / 编辑态 fetcher 恢复 / error prop
     - typecheck + lint + verify:manual-coverage + verify:adr-contracts 全 PASS
     - 文档 ContentRefPicker.md 8 章节完整定稿（含消费方接入示例 + type 切换行为表 + 错误态矩阵）
     - **Opus 评审 3 关键建议全部落实**：(1) AbortController cleanup + fetch (2) 消费方负责 type 切换 reset value (3) 缺 fetcher/options 时 console.error + fallback 不 throw
   - **关联问题**：用户问题 #10「首页编辑添加完全不符合人机交互」**完全闭合**
   - **工时估算**：0.3-0.4w / 实际 ~0.35w（含 Opus 1 轮）

3. **CHG-SN-8-FUP-OTHERS**（条件触发）· 其它 picker 沉淀（SourceLinePicker / UserPicker / SitePicker）
   - 触发条件：实际有 ≥ 2 个新消费方需求
   - 工时估算：各 0.2w

4. **CHG-SN-8-FUP-SOURCES-DEAD-BTN** · sources「一键替换最相似 URL」死按钮修复（用户问题 #6 部分）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - SourcesClient.tsx：button onClick → setReplaceTipOpen(true)；新增 Modal「批量一键替换 URL · 筹备中」展示 4 节内容（预期行为 / 当前未实装 / 当前替代路径 3 步 / follow-up 登记入口）+ 「我知道了」关闭
     - SourcesReplaceTip.test 2 用例 PASS（按钮点击 → Modal 渲染 + dismissModal）
     - P-sources §3.1 完整填写（说明筹备状态 + 替代路径 + follow-up 登记口）+ §3.2 别名 displayName 已消费实证（SourceMatrixRow:234 fallback）
     - 别名展示部分（用户问题 #6 另一痛点）实证 SourceMatrixRow 已用 `line.displayName ?? line.sourceName` fallback；本卡范围不需补
   - **关联问题**：用户问题 #6「一键替换最相似 URL 功能不详」部分闭合（死按钮 → Modal 解释 + 替代路径；实际算法实装推 CHG-SN-8-FUP-SOURCES-REPLACE-ADR follow-up）
   - **工时估算**：0.05-0.08w / 实际 ~0.08w

5. **CHG-SN-8-FUP-IMAGE** · 图片健康功能阐明（手册定稿 / 用户问题 #9）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet（纯文档）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - 实证查代码：ImageHealthClient 4 actions（backfill / rescan / switchDomain / refresh）+ KPI 4 + TOP 破损域名 + 破损样本 grid + 缺图视频表 **全部功能已实装**（CHG-SN-6-02 + IMAGE-1 + IMAGE-2 + ADR-135）
     - 用户问题 #9「功能实现不详」根因是**手册空**而非功能缺失 → 本卡仅写完整 P-image-health.md
     - P-image-health.md 完整定稿（8 章节）：业务定义 / ASCII 布局 / §3.1-§3.6 6 类操作（重扫 / backfill / 切 fallback 域 / TOP 域名 / 破损样本 / 缺图视频表，含端点 / 行为 / 前置 / 期望 / 失败 / 何时用）/ §4 进阶（强调危险）/ §5 字段含义 / §6 状态颜色 / §7 FAQ 4 行 / §8 关系
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：用户问题 #9「图片健康功能实现不详」**完全闭合**（手册完整化）
   - **工时估算**：≤ 0.1w / 实际 ~0.08w

6. **CHG-SN-8-FUP-SOURCES-DEAD-BTN** · sources「一键替换最相似 URL」死按钮修复（用户问题 #6 部分）— 状态：✅ 已完成（2026-05-21）

7. **CHG-SN-8-FUP-USER-MENU** · 用户菜单 4 noop action 改 Modal/Toast 反馈（用户问题 #13）— 状态：✅ 已完成（2026-05-21）

8. **CHG-SN-8-08-B** · Merge 页 VideoPicker 选 candidate_b（W4 工作流闭合 / 消费 VideoPicker）— 状态：✅ 已完成（2026-05-21）

9. **CHG-SN-8-MANUAL-BATCH-1** · 高 ROI 4 页面手册定稿 + GAPS 汇总 — 状态：✅ 已完成（2026-05-21）

10. **CHG-SN-8-MANUAL-BATCH-2** · admin/编辑页 4 份手册定稿 + GAPS 扩展 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - P-users 完整定稿（98 行 / 角色矩阵 + 邀请 + 改角色 + 封禁/解封 + 进阶批量缺失登记）
     - P-settings 完整定稿（97 行 / 8 Tab 全说明 + ADR-125 IA 收敛 + 通知/Webhook/session 实装状态明示）
     - P-audit 完整定稿（91 行 / 多维 filter + Drawer 详情 + 回滚通用未实装登记 + 时间穿梭登记）
     - P-home 完整定稿（103 行 / 4 slot + ContentRefPicker 接入说明 + ADR-104 协议 + 前台预览）
     - GAPS.md 扩展 10 条新登记：#G-users-role-session-invalidate / batch-ban / edit-profile / settings-webhook-impl / settings-session-fields-consume / settings-save-all / audit-rollback-universal / audit-time-travel / audit-self-scope / home-brand-multi
     - GAPS.md 总条数 11 → 21；本会话累计登记
     - verify:manual-coverage PASS
   - **关联问题**：高 ROI 第二梯队页面定稿
   - **工时估算**：0.2-0.3w / 实际 ~0.25w

11. **CHG-SN-8-MANUAL-BATCH-3** · 剩余 5 页面 + 4 工作流定稿 / SEQ-05 完结 — 状态：✅ 已完成（2026-05-21）
    - **建议模型**：sonnet
    - **执行模型**：claude-opus-4-7
    - **完成备注**：
      - P-login（66 行 / 视觉 + 失败 + 找回密码/SSO 未实装登记）
      - P-submissions-deprecated（28 行 / 短停用页跳转说明）
      - P-user-submissions（85 行 / Card list + 3 type 处理 + ADR-124 schema）
      - P-sources 补完（102 行 / 完整 8 章节）
      - P-subtitles 补完（92 行 / 完整 8 章节）
      - W2/W3/W4/W5 工作流全标 ✅ 完整定稿（W4 标 status / W2 W3 W5 完整重写）
      - 20-pages/README + 10-workflows/README 状态列全标 ✅
      - **manual 完整定稿统计**：12/29 → 29/29 = **100%**
      - verify:manual-coverage PASS
    - **工时估算**：0.3-0.4w / 实际 ~0.3w

---

### SEQ-20260521-05 完结声明（2026-05-21）

3/3 batch 全 PASS / Manual 完整定稿 29/29 = 100%

| Batch | 卡数 | 内容 |
|---|---|---|
| Batch 1 | 4 + GAPS 11 | P-videos / P-dashboard / P-moderation 补 / P-merge / GAPS.md 新建 |
| Batch 2 | 4 + GAPS +10 | P-users / P-settings / P-audit / P-home |
| Batch 3 | 5 + 4 W + READMEs | P-login / -deprecated / -user-submissions / -sources 补 / -subtitles 补 / W2-W5 |

**最终**：29 manual 文件 100% 完整定稿；GAPS.md 21 条登记追踪后续 follow-up

---


---

## [SEQ-20260521-06] GAPS 高 ROI 闭合（小卡批量） — 已全归档 ✅

- **状态**：✅ 已全归档（2026-05-23 / CHG-SN-7-MISC-DOCS-CLEANUP-SESSION-CLOSE sub-task 1）
- **范围**：68 卡全 ✅（#1-68）
- **归档位置**：`docs/archive/task-queue/task-queue_archive_SEQ-20260521-06_20260523.md`
- **完整 changelog 条目**：保留在 `docs/changelog.md`
- **后续新卡**：起新 `SEQ-20260524-NN` 容器追加（不再追加到 SEQ-06）

---

## M-SN-8 完结审计同步（独立 ad-hoc · 不挂 SEQ）

- **CHG-SN-8-CLOSE-AUDIT-DRIFT-FIX** ✅ 已完成（2026-05-23）— manual 3 处 status header drift 同步（W1-crawl-to-publish + P-moderation + P-crawler）；用户审计 trigger / 纯元信息修正 / 无代码 / 无 ADR / 无 schema 变更。详 `docs/changelog.md` 同名条目。
  - **判定（已修正）**：M-SN-8 **SEQ 任务列表** 5 序列（SEQ-20260521-01..06）全 ✅；ADR 150/150 closed；但**用户实测发现至少 7-8 项被标 ✅ 但用户视角不可用 + 多个未做项**（见 `docs/audit/user-review-2026-05-23.md`）。"主体完结"措辞 commit 991ab99b 不准确，待 #UR-M01 修正。

---

## [SEQ-20260524-01] M-SN-9 启动 — 用户复核反馈逐项修复（执行序列）

- **状态**：🟡 规划中
- **创建时间**：2026-05-23
- **最后更新时间**：2026-05-23
- **目标**：闭合 `docs/audit/user-review-2026-05-23.md` 中 15+ 项用户复核反馈（持续登记 D 段）；以"dev server 实测 + 用户走读 ≥ 1 次"作为 ✅ 强前置（M-SN-8 教训）
- **范围**：M-SN-9 阶段全部 #UR-* 编号项；按用户提供顺序逐个推进
- **依赖**：M-SN-8 SEQ 任务列表 ✅；用户复核反馈持续登记中
- **流程**：规划方案 → 用户审核 → 制定任务执行（起 ADR + EP 卡） → 完成后复核 → 用户人工审核（不再自报 ✅）

### 任务列表（按用户提供顺序追加）

1. **CHG-SN-9-DT-HEADER-REDESIGN-ADR** · 表格头重设计 ADR-149 起草 — 状态：✅ 已完成（2026-05-23）
   - **关联反馈**：#UR-B1 表格头不一致 + #UR-B2 列名/三点设置 + #UR-B3 中文 IME + #UR-B4 列覆盖不全
   - **方案文件**：`docs/audit/datatable-header-redesign-plan.md` v3（11/11 决策点 + arch-reviewer R-149-1..9 全消解）
   - **ADR**：`docs/decisions.md` line 11942 · ADR-149 ✅ Accepted（@livefree PASS）/ ADR-103 第 5 次 AMENDMENT
   - **子代理**：arch-reviewer (claude-opus-4-7) 评级 **A− CONDITIONAL PASS** / 9 修订消解
   - **后续 EP**（ADR PASS 后启动，5 段渐进 / typecheck 不破裂）：
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-1** · types.ts deprecate + column-matrix-menu.tsx + dt-styles 矩阵样式 + 39 单测 — 状态：✅ 已完成（2026-05-23 / 实际 0.5w / 39/39 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-2** · 列名 toggle 互斥 + ⋯ button stopPropagation + columnTriggerVisibility 三态 + 12 单测 — 状态：✅ 已完成（2026-05-23 / 12 新 + 30 旧测试更新全 PASS / typecheck + lint + verify 全过）
     - **CHG-SN-9-DT-HEADER-REDESIGN-EP-3** · 删 hidden-columns-menu + filter-chips **两**文件（filter-chip.tsx 保留 / D-149-10 vs D-149-11 矛盾修正）+ 11 集成单测 — 状态：✅ 已完成（2026-05-23 / 4 质量门禁全过）

   **ADR-149 AMENDMENT 1（2026-05-24）— D-149-13/14/15 + EP 序列重写 4→7 段**：
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-1** · D-149-13 toolbar.search 槽位约定 + D-149-14 三槽位职责闭合 + D-149-15 业务 key 桥接合约 — 状态：✅ 已完成（2026-05-31 收口对齐：原 arch-reviewer A− CONDITIONAL PASS / 9 修订消解；下游实施 EP-4/4.5/5-* 全 ✅ + Wave 3/4 用户验收签字 2026-05-29 → ADR-149 AMENDMENT 1 de-facto Accepted）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4** · DataTableSearchInput 原语 + IME + 2 合规消费方（CrawlerSiteList + SourcesClient）接入 + 13 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4751 unit 0 flaky / 范围调整：4 违规消费方含 search 合并 EP-5-*）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4-HOTFIX** · DataTableSearchInput 光标失焦修复（受控 → 半 uncontrolled / DOM 自管 value + ref 同步 + selection 保留）+ 5 focus persistence 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 全 4756 unit 0 flaky）
   - **CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-2** · D-149-16 矩阵触发器接入 DataTable 主组件 toolbar + EP 序列 7→8 段插入 EP-4.5 — 状态：✅ 已完成（2026-05-31 收口对齐：原 arch-reviewer B+→A− CONDITIONAL PASS / 10 修订消解含 2 BLOCKER；下游实施 EP-4.5 ✅ + Wave 3/4 用户验收签字 2026-05-29 → ADR-149 AMENDMENT 2 de-facto Accepted）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5** · 矩阵触发器接入 DataTable 主组件 toolbar-right（thead-right fallback 推 N1-149-11 / 0 消费方实测使用 toolbar.hidden=true）+ ColumnMatrixMenu wiring 6 callback（含 BLOCKER：业务 key 桥接 + 合并式 reset 不丢 width）+ column-visibility.ts 2 工具函数沉淀 + dt-styles `[data-table-matrix-trigger]` 样式块 + 17 单测 — 状态：✅ 已完成（2026-05-24 / 4 质量门禁全过 / 17 新 + 13 旧 PASS / 全 4772 unit）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-SHARED** · DataTableEnumFilter（单选+多选+searchable / 20 单测）+ DataTableTextFilter（IME+debounce+半 uncontrolled / 15 单测）+ DataTableDateRangeFilter（from-to+presets+date/datetime / 15 单测）3 共享原语沉淀 — 状态：✅ 已完成（2026-05-24 / 50 新单测全 PASS / 全 4823 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-CRAWLER-RUNS** · CrawlerRunsView 2 AdminSelect (status / triggerType) → 列级 ⋯ filterContent (DataTableEnumFilter) + D-149-15 桥接合约（column.id 对齐业务 key / 无需复杂桥接）+ 删 toolbar.search + ghost button + filterSummary + 5 新单测 + 2 旧更新 + FilterEnumOption.label ReactNode 扩展 — 状态：✅ 已完成（2026-05-24 / 全 4828 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-5-CRAWLER-RUNS-PATCH** · 4 用户反馈修复：问题 1（高级菜单加"查看采集批次"入口 / 用户决策不进 sidebar）+ 问题 2（matrix-trigger CSS margin-left:auto 推右）+ 问题 3（多选过滤全栈 / API + queries + route CSV→array + 前端 multi + 单测）+ 问题 4 列排序保持现状（用户决策不修）— 状态：✅ 已完成（2026-05-24 / 25/25 + 全 4828 unit 0 flaky / 4 质量门禁全过）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-3** · 矩阵 popover 3 问题修复：可见性 toggle 真生效（消费方 patch.columns 处理 / CrawlerRunsView + SourcesClient）+ 列级 ⋯ "隐藏此列"真生效（同根因）+ 过滤 switch 未过滤时 disabled+title tooltip（D-149-5 设计强化 / 提示用户去列名 ⋯ 编辑）+ 1 新单测 + 1 旧更新 — 状态：✅ 已完成（2026-05-24 / 全 4829 unit 0 flaky / 4 质量门禁全过 / 剩余 7 消费方相同 patch.columns 遗漏在 EP-5-* 子卡修）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-4** · 未过滤列 disabled switch 旁加可见 hint「列名 ⋯ 编辑」+ dt-styles 新增 hint CSS rule + 2 单测更新（断言 hint 渲染/不渲染）— 状态：✅ 已完成（2026-05-24 / matrix 40/40 + admin-ui/table 395/395 + 4 质量门禁全过 / 解决 HOTFIX-3 OS 原生 tooltip 可发现性差）/ ⚠️ HOTFIX-5 反向移除（ADR-150 新范式下 hint 引导文案过时）
   - **CHG-SN-9-DT-HEADER-REDESIGN-EP-4.5-HOTFIX-5** · 矩阵 popover 未过滤列 hint 文案「列名 ⋯ 编辑」+ aria-label / title 旧引导句一并移除（@livefree 走读反馈 + "一起清理"追加指令） — 状态：✅ 已完成（2026-05-24 / column-matrix-menu.tsx 删 hint span + button title prop + aria-label 引导句段 + dt-styles 删 CSS 规则 + 单测 3 断言更新 / matrix 40/40 + admin-ui/table 426/426 零回退 / 4 质量门禁全过 / ADR-150 范式反转一致性彻底收敛）
   - **⚠️ EP-5-SOURCES-SORT-FULLSTACK + EP-5-submissions/users/audit/videos + EP-6 + EP-7** · 已被 **ADR-150 阶段 2-5** 取代（@livefree 在 EP-4.5-HOTFIX-4 走读后看 Google Sheets 截图反馈"过滤应是列固有属性"/ ADR-149 个别 EP-5 迁移范式被列固有自动过滤范式替换）— 状态：⛔ 已废弃（不要执行 / 改走 ADR-150 SEQ 容器）
   - **CHG-SN-9-DT-AUTOFILTER-ADR** · ADR-150 起草 + Opus 子代理评审 + 6 D-150-× 论证（D-150-3 + D-150-5 REVISED）+ 13 章 + 5 阶段实施计划 + 写入 decisions.md line 12664-13037 — 状态：✅ **Accepted via AMENDMENT 2**（2026-05-24 / D-150-5 由 AMD2 NEGATED + REVISED 重构 / 不再 Proposed / DOCS-CLEANUP-DEBT 2026-05-25 状态修订）
   - **CHG-SN-9-DT-AUTOFILTER-EP-1** · 共享 DataTableAutoFilter UI / 6 步严格串行 / Opus 设计 + 实施 + 评审：types.ts AutoFilterColumnFields discriminated union (Active/Inactive + filterFieldName 必填) + AutoFilterKind/DistinctOption/FilterableColumn / use-filter-kind-inference hook 5 边界 + 10 单测 / DataTableAutoFilter 主组件 Google Sheets 三段布局 + 4 filterKind 渲染 + 20 单测 / dt-styles +185 行 `[data-autofilter-popover]` CSS / header-menu autoFilterContent 双范式接入 / data-table.tsx wire (mode client 用 processedRows / server 用 pageRows / filterFieldName 必填零??) / Opus PR review REVISED → 4 fix (BLOCKER union + HIGH token + MEDIUM rows + MEDIUM dev warn) — 状态：✅ 已完成（2026-05-24 / 425 admin-ui/table 全 PASS / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-2** · 后端通用 distinct 端点 `/admin/_dt/distinct` (GET) + filter-schema.ts (FilterValueSchema discriminatedUnion 6 种 + DtFiltersSchema URL JSON transformer) + distinct-whitelist.ts (6 表硬编码 SQL 白名单 + identifier 正则 `/^[a-z_]+\.[a-z_]+$/` + 启动期自检) + DataTableService.ts (SQL 模板 + LIMIT clamp + q ILIKE $param) + ErrorCode COLUMN_NOT_WHITELISTED 403 + server.ts 注册 + ADR-150 §端点契约 表 / Opus PR review PASS (0 BLOCKER / 2 LOW 不阻塞) / 33 单测全 PASS (15 端点含 SQL 注入 3 case + 18 shared) — 状态：✅ 已完成（2026-05-24 / 4 质量门禁 + verify:endpoint-adr 187 全对齐）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-A** · 12 消费方批量迁移 子卡 A（拆 2 sub-commit + HOTFIX）：
     - **sub 1** CrawlerRunsView 迁 D-149-15 → D-150 ✅（2026-05-24 / column.filterable + filterFieldName + filterOptions / 删 DataTableEnumFilter 桥接 / 删 statusFilter+triggerTypeFilter 独立 state / filtersMap 统一 / fetch useEffect 派生 / types.ts ColumnDescriptor 加 filterable+filterFieldName / column-matrix-menu hasFilterContent 识别 filterable / admin-ui index 加 6 类型 export / 25 单测全 PASS）
     - **sub 1 HOTFIX** popover 6 类走读反馈回归 ✅（2026-05-24 / @livefree 实测 6 类反馈 / 共因 PANEL_STYLE maxWidth 冲突一次性消解 4 反馈 + 排序段始终渲染 + kind radio 段删除 / 3 实施 + 1 测试文件 +27/-22 / 不动 Props 契约 / 不起 ADR / 单测 20/20 + 25/25 + 1534/1534 全过 / 4 质量门禁全过 / commit `b0371950`）
     - **sub 1 EXTEND** CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展 ✅（2026-05-24 / 路径 A / id text + siteCount number + createdAt date / 后端 SQL 4 新条件含 created_at 含 to 当日全天 INTERVAL / 5 文件实施 + 2 文件单测 / **顺手修复 data-table.tsx pinned 列 filterable 盲区**（hasAutoFilter 判定补齐）/ 单测 28/28 + 8/8 + 1534/1534 + 219/219 全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
     - **sub 2** AuditClient 迁 toolbar 6 控件 → 列内 filterable + filtersMap 派生 ✅（2026-05-24 / 5 列 filterable / 2 实施 + 1 测试文件 / D-150-5 union 守卫报错触发实证（actor 列条件 spread → 两版本显式返回）/ createdAt 精度降级 datetime→date / 单测 20/20 + 1534/1534 全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR / 不需后端 / 不需 distinct-whitelist AMENDMENT / commit `ea5c2598`）
     - **sub 2 EXTEND** EnumValueList 空退化 BUG + 2 表格 sort 全栈打通 ✅（2026-05-24 / admin-ui 共享层 1 行 fix + 后端 2 端点 sort 参数（zod 白名单 + const SQL 映射 + ORDER BY 动态 + id DESC 兜底）+ 前端 2 表格 enableSorting + 白名单守卫 / 11 实施 + 4 测试 + 2 docs / 7 新 case / 1796/1796 单测全过 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR / commit `68a8efe6`）
     - **sub 2 PATCH** arch-reviewer 评审消解（2 红线 + 1 黄线）✅（2026-05-24 / arch-reviewer Opus 一次评级 B → 二次评级 **A-** / R-EP3A-1 共享层 3 处桥接 + R-EP3A-2 sort fail-fast throw + Y-EP3A-1 SORT_IDENT_REGEX 全 ✅ / 4 实施 + 3 测试 / 4 质量门禁全过 / RR-EP3A-1 audit fail-fast 单测缺位 + RR-EP3A-2 SOC tag 合格 2 advisory 留 EP-3-B 顺手 / **EP-3-A 6 子卡全闭环 PR ready** / commit `b80c9e7c`）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-B** · 子卡 B：UsersListClient + advisory 3 项 ✅（2026-05-24 / 仅迁 UsersListClient（SubmissionsListClient deprecated 不迁 / 节省 0.2w）/ 3 列 filterable（username/q + role + status/banned）/ D-150-4 桥接实证扩大（username/q）/ Advisory RR-EP3A-1 audit fail-fast 单测新建 + Y-EP3A-2/3 admin-module-template + column-visibility 注释 / 3 实施 + 2 测试 + 2 docs / 4 新 case / 11/11 + 3/3 + 1532 单测全 PASS / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-C** · 子卡 C：VideoListClient（StagingPageClient 跳过）✅（2026-05-24 / StagingPageClient Segment+client mode 跳过 / VideoListClient 4 列 filterable（title/q + type + visibility/visibilityStatus + review_status/reviewStatus）/ VideoFilterBar 6 → 2 控件简化（保留 status+site 外置）/ D-150-4 桥接 7 实证累计 / 2 实施 + 0 测试新增 / 21/21 单测零回退 / 4 质量门禁全过 / 不动 Props 契约 / 不起 ADR）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-ADR** · ADR-150 AMENDMENT 2 起草 ✅（2026-05-24 / @livefree 根本反问 → arch-reviewer Opus 独立 1 轮起草 / 9 决策点 D-150-AMD2-1..9 / column.kind enum 方案 A / D-150-5 NEGATED + 重构 / @livefree 仲裁 2 红线 dev warn + AMENDMENT 2 内一起实施 / Accepted）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-EP** · AMENDMENT 2 实施 ✅（2026-05-24 / 共享层 types kind union + data-table kind 筛选 + column-matrix-menu action 整行跳过 + 4 消费方 opt-out 5 列 kind marker / 3 测试 fixture 更新维持旧预期 / 7 实施 + 3 测试 / 4 质量门禁全过 / 426 + 605 单测全 PASS / 不动 ADR / 不动后端 / 向后兼容 4 已迁消费方零破坏）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-PATCH-1+2** · /admin/videos sort 加载失败修复 ✅（2026-05-24 / PATCH-1 错用前端禁用反范式 / @livefree 指正后 PATCH-2 后端 SORT_FIELDS 扩 5 字段 + SQL ORDER BY 动态白名单 + 前端去禁用 / 兑现 AMD2 D-150-AMD2-1 默认全开原则 / commits `9888f7ac` + `2c6e3cf8`）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-D** · ImageHealth + Merge 9 列 kind='computed' opt-out ✅（2026-05-24 / ImageHealth domains 表 client mode 不动 / missing 表 4 子查询派生列 + Merge candidates 表 3 列加 kind='computed' / AMD2 D-150-AMD2-2 首业务应用 / 业务真实禁用 vs 反范式禁用区分 / 后续真 sort/filter 全栈实施留 follow-up / 2 实施 / 53/53 单测零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-E** · SubtitlesListClient + SourcesClient 10 列 opt-out ✅（2026-05-24 / Subtitles 4 列 kind='computed'+enableSorting:true 灵活组合（后端真支持 sort）+ actions kind='action' / Sources 5 列 kind='computed' 删 lineCount/sourceCount pre-existing 假装 / sources sort 全栈打通明确划归 ADR-150 阶段 5 EP-4 / 2 实施 / 26/26 单测零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-F** · CrawlerSiteList + CrawlerRunDetailView 11 列 opt-out ✅（2026-05-24 / CrawlerSiteList client mode 7 数据列默认全开 + chevron/actions kind='action' / CrawlerRunDetailView server mode 8 数据列 kind='computed' 防假装 + ops kind='action' / AMD2 client+server 范式区分实证 / 2 实施 / 141/141 单测零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-3-G** · StagingPageClient actions opt-out / 12 消费方完整闭环 ✅（2026-05-24 / StagingPageClient mode=client actions 列 kind='action' / SubmissionsListClient deprecated 跳过 / dev demo 跳过 / 12/12 消费方处理完毕 / 1 实施 / 8/8 单测零回退）
   - **CHG-SN-9-DT-AUTOFILTER-AMD2-PHASE5-EP4-SOURCES** · ADR-150 阶段 5 EP-4 sources sort 全栈打通 ✅（2026-05-24 / 声称 5 文件实际 4 文件 / **api.ts 漏改 URLSearchParams** / sort 行为失效 → HOTFIX-PATCH-2A 回填）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2A** · sources sort BUG 回填 + filter 全栈扩展 ✅（2026-05-25 / 5 项 / 7 文件 / api.ts URL 透传 + actions kind='action' opt-out + updatedAt 全栈（前端 filterable + 后端 zod + queries HAVING MAX）+ probeStatus enum filter 4 态全栈（csvToStringArray + EXISTS ANY()）+ renderStatus 同 probeStatus / 22 + 7 + 10 = 39 单测全 PASS 零回退 / 4 质量门禁全过 / siteKey 推 PATCH-2B follow-up）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2B** · siteKey enum filter 全栈 / distinct 端点首次消费实证 ✅（2026-05-25 / 8 文件 / arch-reviewer Opus A- 评审 D1-D6 全 ✅⚠️ / DataTableProps 扩 distinctFetcher prop + DataTable wire 透传 + sources/api.ts 新建 fetchDistinct 调 /admin/_dt/distinct + SourcesClient 加 hidden siteKey column（defaultVisible: false + filterKind='enum' + filterDistinctTable='sources' + filterFieldName='site_key' + accessor=() => null + enableSorting: false）+ filtersMap siteKey 派生 + DataTable distinctFetcher 注入 / 后端 siteKey csvToFreeStringArray + EXISTS ANY()::TEXT[] / 单测 sources-matrix +2 + sources-api-url +2 + 共 47 单测零回退 / 4 质量门禁全过 / admin-ui/table 426/426 零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-HOTFIX-PATCH-2B-FIX1** · siteKey 列 cell 显站点 csv（用户走读"列显示空"反馈修复）✅（2026-05-25 / 6 文件 / hidden column 改 visible / 后端 SQL STRING_AGG(DISTINCT COALESCE(vs.source_site_key, v.site_key)) 派生 + raw + Service + types VideoGroupRow.siteKeys 透传 + 前端 cell csv text + title hover 完整列表 / sources-matrix +3 case + sources-matrix-service fixture 补 / 共 62 单测零回退 / admin-ui/table 426/426 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-MERGE-SORT-FULLSTACK** · Merge 候选表 sortField 全栈打通（PATCH-2 范式复刻 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 5 文件 / 4 字段白名单（score/videoCount/year/titleNormalized）/ types ListCandidatesParams 扩 sortField+sortDir / zod ListCandidatesSchema enum / Service 层 sort switch 4 case + tiebreaker groupKey ASC / 前端 lib URL 透传 + sort state + 3 列 enableSorting: true + DataTable wire / pre-existing 设计局限：DB 层按 `COUNT(*) DESC, title_normalized ASC` 分页 / Service 层 sort 跨页不严格稳定（接受 / 后续 score 物化需 migration） / video-merge-candidates +5 case 32/32 + admin-ui/table 426/426 零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-CRAWLER-RUN-DETAIL-SORT-FULLSTACK** · runs/:id/tasks sort 全栈打通（PATCH-2 范式 + 复用 TASK_SORT_COLUMNS 白名单 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 4 文件 / 4 字段白名单（site/status/startedAt/finishedAt）/ queries listTasksByRunId 加 sortField+sortDir 复用 listTasks 的 TASK_SORT_COLUMNS / 路由 GET /admin/crawler/runs/:id/tasks zod enum 透传 / 前端 lib URL 透传 + 4 列加 enableSorting + load() column.id 桥接（siteKey→site / duration→finishedAt） / crawler-tasks +7 case 14/14 + CrawlerRunDetailView test fixture 更新 case 12 / admin-ui/table 426/426 + 全套 567/567 零回退 / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-IMAGE-HEALTH-MISSING-SORT-FULLSTACK** · ImageHealth missing 4 子查询列 sort 全栈打通（PATCH-2 范式 / ADR-150 阶段 5 EP-4 follow-up）✅（2026-05-25 / 5 文件 / **关键发现**：注释 "需 CTE 重写" 误判修正 / LATERAL JOIN evt.* 字段（evt.url / evt.occurrence_count / evt.last_seen_at）直接 ORDER BY 可引用 / MISSING_VIDEO_SORT_SQL 扩 4 字段 / 前端 camelCase → snake_case 桥接（posterSource→poster_source / brokenDomain→broken_domain / occurrenceCount→occurrence_count / lastSeenBrokenAt→last_seen_broken_at）/ ORDER BY 加 NULLS LAST（LEFT JOIN evt 可能 NULL）/ image-health-missing-sort 新建 9 case PASS + admin-ui/table 426/426 + 全套零回退 / 工时 0.3-0.5w → 实际 0.15w / 4 质量门禁全过）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE** · sources sort + filter e2e smoke 3 case 收口（PATCH-2A 全栈验收 / ADR-150 阶段 5 EP-4 收口）✅（2026-05-25 / 1 新 spec 文件 / 3 case：page-load (KPI + 行渲染) / sort-click-video (PATCH-2A §1-BUG-1 漏改回填 sortField 透传) / filter-probe-status (PATCH-2A §2-EXT-1 enum filter URL 透传) / Playwright admin-next-chromium project / page.route 拦截 + URL params 捕获验证 / API mock 全独立 / 触发方式：用户起 dev server 后 `npm run test:e2e` 跑 / 当前 typecheck + lint + verify + admin-ui/table 426/426 PASS）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-SOURCES-E2E-SMOKE-FIX1** · 加 case 4 siteKey distinct + case 2/3 testid refactor（PATCH-2B 收口）✅（2026-05-25 / 1 文件改 / 4 case 总 / case 4 新建：列「站点」⋯ → DataTableAutoFilter 触发 distinct fetch → captured.distinct URL[] 验证 table=sources + col=site_key → mock 返回 [bilibili,youku,iqiyi] → 勾 bilibili → 应用 → 主 fetch URL 透传 siteKey=bilibili 全链路 / case 2/3 重写用 DataTableAutoFilter testid 体系（th-menu-trigger-* + dt-autofilter-*-opt-* + dt-autofilter-*-apply）增稳 / 4 case 全 admin-next-chromium 注册 / typecheck + lint + verify + admin-ui/table 426/426 零回退）
   - **CHG-SN-9-DT-AUTOFILTER-EP-4-DISTINCT-FETCHER-ABORT-SIGNAL** · DataTableAutoFilter AbortController + signal 全栈透传（Opus PATCH-2B 评审 D6 预批准 follow-up）✅（2026-05-25 / 4 文件 / 共享层 admin-ui types.ts DataTableProps.distinctFetcher signature 加 signal?: AbortSignal optional 第 4 参数 + DataTableAutoFilter useEffect AbortController 创建 + cleanup abort + AbortError 静默忽略不触发 fetchError 状态 + signal.aborted 双检 防 stale state set / api-client RequestOptions.signal optional + fetch 透传 / sources/api.ts fetchDistinct 加 signal 参数 + apiClient.get 透传 / +3 单测 case（#6 fetcher 调用含 expect.any(AbortSignal) / #6a unmount 触发 signal.aborted=true / #6b AbortError 静默不渲染 fetchError / #6c 真实 error 渲染 fetchError）/ admin-ui/table 429/429 零回退 / typecheck + lint + verify 全过 / 防 search 快速切换 stale response 覆盖）
   - ~~**CHG-SN-9-DT-AUTOFILTER-EP-3-D/E/F/G**~~ · ⛔ **DOCS-CLEANUP-DEBT 2026-05-25 删除冗余占位**：原 4 条 BLOCKED 占位实际已 ✅ 完成（上方 L838-842 各自有 ✅ 完成条目 / 见 EP-3-D `0e625ac8` + EP-3-E `1bf423ba` + EP-3-F `240e7109` + EP-3-G `05a6e802`）/ 文档同步遗留 / 状态修订完成
   - ~~**CHG-SN-9-DT-AUTOFILTER-EP-4**~~ · ⛔ **DOCS-CLEANUP-DEBT 2026-05-25 删除冗余占位**：实际由 ADR-150 阶段 5 EP-4 sources/Merge/CrawlerRunDetail/ImageHealth/e2e smoke/distinct-fetcher AbortSignal **7 个 follow-up 卡** 全闭环完成 / 见上方 L843-853
   - **总工时（ADR-150 替代 ADR-149 EP-5 序列）**：原 ADR-149 EP-5 ~2.6w + sources sort ~0.7w + EP-6 ~0.2w + EP-7 ~0.3w = 3.8w → **ADR-150 阶段 2-5 共 3.6w**（节省 ~0.2w + UX 强一致 + 长期收益）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-A · DataTableSearchInput IME + 5 高优消费方接入 + 12 单测（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-B · 剩余 8+ 消费方删 deprecated prop + 类型完全删除（~0.4w）
     - CHG-SN-9-DT-HEADER-REDESIGN-EP-4-C · @livefree 走读 5 代表页 + #UR-B1/B2/B3/B4 闭合验证（~0.3w）

> 后续用户提其它问题时按 #UR-* 顺序追加

---

## [SEQ-20260525-CRAWLER-W1] CRAWLER W1 — 命名 / 撤删除 / Bug-A / 关键词 Drawer / 定时面板 3 触达

- **状态**：✅ **已完成**（2026-05-25 / 8/8 子卡全 ✅ / 含 CW1-B-EP-TEST follow-up）
- **创建时间**：2026-05-25 16:40
- **最后更新时间**：2026-05-25 23:59
- **目标**：W1 7 项改进闭环 — Fix-D2 命名 6 项（4 字约束）+ Fix-D1 撤回删除入口 3 处 + Bug-A 任务级 cancel + Fix-D6 关键词采集 Drawer + 定时任务面板 3 处触达（采集页 inline + Dashboard 卡 + topbar 铃铛）。Gantt 时间轴升级延后 W2 与 Fix-D5 定时增强合并。
- **范围**：apps/server-next 采集相关 UI 全量 + apps/api 新增 2 个 admin route（task cancel + topbar events） + 复用现有后端契约扩字段。**v1 UI 不动**。
- **依赖**：plan 文件 `/Users/livefree/.claude/plans/cheerful-orbiting-hare.md` §W1 设计决策 + §拆卡草稿（5 张卡 = 7 子卡）
- **真源**：`docs/designs/backend_design_v2.1/reference.md` §5.6 采集模块 + plan 文件 W1 决策
- **总估时**：1.45w

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW1-A** — 采集页 UI 三合一（命名 + 撤删除 + inline chip）✅ 已完成（2026-05-25 / 9 源码 + 1 测试 / CrawlerClient 61/61 PASS / 4 字命名 6 项 + 4 处删除入口撤回 + 1 后端 autoCrawlNext 字段 + PageHeader inline chip / data-testid 全保留 e2e 兼容 / CrawlerClient.tsx 净减 15 行 / 详见 changelog）
   - 创建时间：2026-05-25 16:40
   - 实际开始：2026-05-25 16:40
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7（plan 模式延续 / 建议 sonnet 但同会话 opus 直跑）
   - 文件范围：6 _client/*.tsx + crawler-site-columns-v2.tsx + CrawlerSiteList.tsx + lib/crawler/api.ts + apps/api/src/routes/admin/crawler.ts（实施中扩 CrawlerSiteList + columns-v2 / 链路一致性 / 已同步更新 tasks.md）
   - 估时：0.15w（实际工时与估时一致）

2. **CHG-SN-9-CW1-B-ADR** — Bug-A 任务级 cancel 端点 ADR-151 起草 ✅ 已完成（2026-05-25 / decisions.md +250 行 / arch-reviewer Opus 1 轮 A− CONDITIONAL → 主循环修订 R3+Y3+G1 后 🟢 Accepted / D-151-1..6 全 PASS / 详见 changelog）
   - 创建时间：2026-05-25
   - 实际开始：2026-05-25 17:10
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审 / A− CONDITIONAL → 修订后等同 A
   - 范围：ADR-151 task-level cancel endpoints / D-151-1..6 决策 / 6 R-Y-G 修订
   - 文件范围：docs/decisions.md（追加 ADR-151）
   - 估时：0.15w（实际工时与估时一致）

3. **CHG-SN-9-CW1-B-EP** — Bug-A 实施 ✅ 已完成（2026-05-25 / 7 文件改 + 1 migration + admin-audit 类型扩展 / queries cancelTaskById + batchCancelTasks + worker terminal status 短路 R-151-3 硬依赖 + 2 路由 + 前端 ops 列 [取消] + bulk action bar + api client 2 函数 / 154 crawler 测试全过 / verify:endpoint-adr 184 全闭环 / 单测覆盖 留 CW1-B-EP-TEST follow-up 子卡）
   - 创建时间：2026-05-25 17:50
   - 实际开始：2026-05-25 17:50
   - 完成时间：2026-05-25
   - 执行模型：claude-opus-4-7（plan 模式延续）
   - 范围：前后端 — task 行级 cancel + 多选 batch + R-151-3 worker 守卫硬依赖
   - 文件范围：apps/api/src/db/queries/crawlerTasks.ts + crawler.tasks.ts route + crawlerWorker.ts 守卫扩展 + lib/crawler/api.ts + CrawlerRunDetailView.tsx + admin-moderation.types.ts（actionType + targetKind 扩展）+ migration 073（target_kind CHECK 13→14）
   - 估时：0.25w（实际工时与估时一致）
   - follow-up：CHG-SN-9-CW1-B-EP-TEST 单测补齐（7 queries case + 6 route case / 0.1w）

4. **CHG-SN-9-CW1-B-EP-TEST** — Bug-A 单测补齐 follow-up（状态：✅ 完成 2026-05-25）
   - 创建时间：2026-05-25 18:30
   - 建议模型：sonnet
   - 范围：补 cancelTaskById + batchCancelTasks queries 7 case + crawler.tasks route 6 case + CrawlerRunDetailView 行级 [取消] + bulk 行为 4 case
   - 文件范围：tests/unit/api/crawler-tasks.test.ts 扩 + tests/unit/api/routes/admin/crawler-tasks-cancel.test.ts 新 + tests/unit/components/server-next/admin/crawler/CrawlerRunDetailView.test.tsx 扩
   - 估时：0.1w
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：前后端 — task 行级 cancel + 多选 batch
   - 文件范围：apps/api/src/routes/admin/crawler.tasks.ts（新 2 路由）+ apps/api/src/db/queries/crawlerTasks.ts（新 cancelTaskById + batchCancelTasks）+ apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx（ops 列加按钮 + 表头多选 + bulk bar）+ apps/server-next/src/lib/crawler/api.ts
   - 验收要点：task 行 [取消] 按钮（queued/running 可点）+ batch 多选 + 2 新路由 PASS + audit `crawler_task.cancel` + `crawler_task.batch_cancel` + 单测 + e2e
   - 估时：0.25w

4. **CHG-SN-9-CW1-C** — 关键词采集 Drawer（状态：✅ 已完成 2026-05-25 / 主循环 sonnet）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：纯 next UI 新组件 + API client 2 函数；后端 0 改动
   - 文件范围：apps/server-next/src/app/admin/crawler/_client/KeywordCrawlDrawer.tsx（新 423 行）+ CrawlerAdvancedMenu.tsx（+14 行 / 加 keyword_crawl 菜单项）+ CrawlerClient.tsx（+11 行 / state + render）+ apps/server-next/src/lib/crawler/api.ts（+58 行 / previewKeyword + runCrawlerKeyword + 类型）+ tests/unit/components/server-next/admin/crawler/KeywordCrawlDrawer.test.tsx（新 8 case）
   - 验收要点：单 keyword + 类型筛选 + siteKeys 默认全选 enabled 站 + 预览表格 + 立即采集 + 单测 8 全过
   - 估时：0.3w（实际 0.25w）
   - follow-up：CW1-B-EP 漏同步的 audit-log-coverage REQUIRED_ACTION_TYPES 守卫已在本卡顺手补齐（R-MID-1 第 26 次系统化首次硬编码到测试）

5. **CHG-SN-9-CW1-D** — Dashboard 自动采集卡（状态：✅ 已完成 2026-05-25 / 主循环 sonnet）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：next /admin DashboardClient 新加卡 + CrawlerClient query param 支持
   - 文件范围：apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx（新 218 行 / 5 状态卡 loading + disabled + countdown + failed + error）+ DashboardClient.tsx（+5 行 / row="4" 嵌入）+ CrawlerClient.tsx（+18 行 / useSearchParams + closeSchedulerDrawer）+ 3 测试（新 AutoCrawlScheduleCard.test 6 case + DashboardClient.test row="4" 断言 + CrawlerClient.test 3 case 54/55/56）
   - 验收要点：5 状态渲染 + 编辑链接跳 /admin/crawler?openDrawer=scheduler 自动打开 + 关闭时清 query param + 单测全过
   - 估时：0.2w（实际 0.2w）

6. **CHG-SN-9-CW1-E-ADR** — Topbar 铃铛端点 ADR-152 起草 ✅ 已完成（2026-05-25 / arch-reviewer Opus 1 轮 A− CONDITIONAL → 主循环修订 R3+Y4+G3 后 Accepted / D-152-1..5 全闭环 / 详见 changelog）
   - 创建时间：2026-05-25
   - 实际开始：2026-05-25 18:50（CW1-D commit 后续推）
   - 完成时间：2026-05-25
   - 建议模型：opus + arch-reviewer (opus)
   - 执行模型：claude-opus-4-7
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审
   - 范围：新增 ADR-152（admin system background-events endpoint / D-152-1..5 决策：event schema discriminated union / 聚合源 5 源 → 3 lane / 轮询 60s / Cache-Control private,max-age=30 + mutate invalidate / admin+moderator role）
   - 文件范围：docs/decisions.md（追加 280 行 ADR-152 完整 12 节）
   - 验收要点：5 决策点 PASS + Opus PR review A− → 等同 A
   - 关键修订：R-152-1（actionType 枚举核实 crawler.freeze）/ R-152-2（删 cron-parser BLOCKER 改 intervalMs 推算）/ R-152-3（listRuns 谓词下推 status[] + finishedAfter）/ Y-152-1/2/3/4 + G-152-1/2/3 全消解
   - 估时：0.15w（实际 ~0.18w / 含 arch-reviewer 1 轮 + 主循环修订消解）

7. **CHG-SN-9-CW1-E-EP** — Topbar 铃铛实施（状态：✅ 完成）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-25
   - 建议模型：sonnet
   - 范围：前后端 — 新端点 + admin shell 集成
   - 文件范围：apps/api/src/routes/admin/systemBackgroundEvents.ts（新）+ admin shell topbar 集成 + apps/server-next/src/.../_client/BackgroundEventBell.tsx（新）；可借鉴 CHG-SN-7-MISC-SHELL-NOTIFICATIONS 的 useAdminNotifications + useAdminTasks 模式（ADR-147）
   - 验收要点：60s polling + popover 渲染上方"即将"+ 下方"近期完成/失败" + 单测
   - 估时：0.25w（实际 ~0.28w / 含上下文恢复 + vi.hoisted fix + §端点契约标题修正）

### 关键约束

- **卡 1（CW1-A）必须先完成**：autoCrawlNext 字段是 CW1-D 的硬依赖
- **CW1-B-ADR / CW1-E-ADR 触发 plan §4.5 R7 MUST-8**：新增 admin route 必须 ADR + Opus PASS 才能起 -EP 实施卡
- **e2e 守护**：现有 `admin-采集控制台触发入口位于-sites-tab` 必须保持 PASS（data-testid 不变）
- **v1 server**：本 SEQ 全程不动 `apps/server/` 任何文件
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260525-CRAWLER-W2] CRAWLER W2 — 数据质量止损 + Gantt 时间轴 + 定时多模式

- **状态**：✅ 完成（CW2-A ✅ CW2-B-ADR ✅ CW2-B-EP ✅ CW2-C-ADR ✅ CW2-C-EP-A ✅ CW2-C-EP-B ✅）
- **创建时间**：2026-05-25 24:00
- **最后更新时间**：2026-05-25
- **目标**：W2 三条主线闭环 — ① P0 数据丢失后端守卫（Fix-1/2A/3 三合一）② Gantt 时间轴完整升级（T1-T5 修复 + 多 lane）③ Fix-D5 定时增强（cron/interval 多模式）。低置信合并候选（Fix-D3）、断点续传（Fix-D4）、健康度主动探测（Fix-D7）延后 W3。
- **范围**：apps/api 后端（CrawlerService + crawlerTimeline + crawlerScheduler + system_settings migration）+ apps/server-next（CrawlerTimelineCard + SchedulerConfigDrawer）。**v1 UI 不动**。
- **依赖**：SEQ-20260525-CRAWLER-W1 全部 8 子卡完成（✅）；plan 文件 `/Users/livefree/.claude/plans/cheerful-orbiting-hare.md` §10 各改进点
- **真源**：plan 文件 Fix-1/Fix-2A/Fix-3（§5/§6）+ 时间轴问题 T1-T5（§3.2）+ Fix-D5（§10.4.2）
- **总估时**：~1.3w（CW2-A 0.2w + CW2-B 0.55w + CW2-C 0.55w）

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW2-A** — P0 数据丢失三合一守卫（Fix-1 + Fix-2A + Fix-3）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 范围：纯后端 3 处守卫，无 ADR，无 migration
   - 文件范围：
     - `apps/api/src/services/CrawlerService.ts`（3 处改动）：
       - Fix-1：upsertVideo Step 6 进 replaceSourcesForSite 分支前加 empty sources 守卫（sourceMappings.length === 0 → emit warn + 跳过 replace）
       - Fix-2A：page loop break 截断时若 items.length >= EXPECTED_PAGE_SIZE → emit warn 'crawl.page.truncated'
       - Fix-3：parseVodItem 结果 for-loop 入口加 `if (!parsed.video.title)` → errors++ + emit warn + continue
     - `apps/api/src/db/queries/sources.maintenance.ts`（1 处改动）：replaceSourcesForSite 入口加 assertion `if (newSources.length === 0) throw new Error('...')`
   - 验收要点：
     - Fix-1 单测：mock CrawlerSource 返回空 vod_play_url → 断言不调 replaceSourcesForSite，emit 'crawl.upsert.empty_sources' warn
     - Fix-2A 单测：mock 站点返回满页 items → 断言 emit 'crawl.page.truncated' warn
     - Fix-3 单测：空 title item → 断言 insertCrawledVideo 不调用，errors++ 且 emit 'crawl.skip.empty_title' warn
     - assertion 测试：replaceSourcesForSite([], ...) → throw
   - 估时：0.2w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅

2. **CHG-SN-9-CW2-B-ADR** — Gantt 时间轴重设计 ADR-153 起草
   - 创建时间：2026-05-25
   - 建议模型：opus 主循环 + arch-reviewer (claude-opus-4-7)
   - 范围：ADR-153 6 个决策点（D-153-1..6）
   - 文件范围：docs/decisions.md（追加 ADR-153）
   - 估时：0.15w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-153 🟢 Accepted via R3+Y3+G2 / arch-reviewer Opus A− → 等同 A）

3. **CHG-SN-9-CW2-B-EP** — Gantt 时间轴实施（ADR-153 落地）
   - 创建时间：2026-05-25
   - 建议模型：sonnet
   - 依赖：CW2-B-ADR PASS
   - 文件范围：
     - `apps/api/src/db/queries/crawlerTimeline.ts`：
       - SQL `ranked_tasks.rn = 1` → `rn <= 3`（或 ADR 定的上限）
       - pending 起点：`COALESCE(started_at, NOW()-interval)` → `COALESCE(started_at, scheduled_at)`，不超窗口左侧
       - health 子查询 → LEFT JOIN CTE 消除 N+1
     - `apps/api/src/routes/admin/crawler.ts`（crawlerTimeline handler）：range 参数 zod enum 实装（30m/1h/2h/6h）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`：
       - 多 lane 渲染：同站点 rn>1 的 bar 垂直叠加（各 bar 占 height/N，gap 2px）
       - status 四态：`statusToCategory()` 拆 ok/warn/danger/neutral，neutral 色为 CSS 变量 `--color-neutral-3`
       - range select：30m/1h/2h/6h AdminSelect，onChange 触发 refetch
       - tick 时区：统一 `new Date(tick.iso).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})`
   - 验收要点：
     - 单测 crawlerTimeline.test：rn≤3 SQL 格式确认 + range 参数确认 + pending 起点 COALESCE(started_at, scheduled_at) 确认
     - 单测 CrawlerTimelineCard.test：多 bar 渲染（mock 3 tasks per site）+ neutral status + range select + tick 时区
   - 估时：0.4w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-153 全 4 项落地：SQL V2 / status 4 态双侧 / range 自治 / multi-lane 渲染；22 单测全通）

4. **CHG-SN-9-CW2-C-ADR** — Fix-D5 定时增强 ADR-154 起草
   - 创建时间：2026-05-25
   - 建议模型：opus 主循环 + arch-reviewer (claude-opus-4-7)
   - 范围：ADR-154 6 个决策点（D-154-1..6）
   - 关键决策点：
     - D-154-1：scheduleType enum — `daily | interval | cron`（或先 `daily | interval` 不引入 cron-parser）
     - D-154-2：cron-parser 引入决策（技术栈白名单确认；ADR 中记录版本约束 `^4.x`；若不引入则 D-154-1 降为两态）
     - D-154-3：`auto_crawl_last_trigger_date DATE` → `auto_crawl_last_trigger_at TIMESTAMPTZ`（避免同日重复逻辑升级为 timestamp 比对）
     - D-154-4：per-site schedule 字段扩展（AutoCrawlSiteOverride 加可选 `schedule?` 字段）
     - D-154-5：crawlerScheduler.ts dispatch 改写（`checkDaily / checkInterval / checkCron` 三分支）
     - D-154-6：UI SchedulerConfigDrawer scheduleType select + 条件渲染 input（daily → time picker / interval → minutes input / cron → expression input + preview）
   - 文件范围：docs/decisions.md（追加 ADR-154）
   - 注意：cron-parser 新依赖需在 ADR 中明示 `import('cron-parser')` 包名 + 版本；Opus 评审需确认是否触发 CLAUDE.md "引入技术栈以外的新依赖 → BLOCKER"（即**ADR PASS 相当于解除该 BLOCKER**）
   - 估时：0.15w
   - 实际开始：2026-05-25
   - 完成时间：2026-05-25
   - 状态：✅（ADR-154 🟢 Accepted / arch-reviewer Opus A− → 等同 A；D-154-1=B 两态/D-154-2=B 无 cron-parser；CW2-C-EP 须拆 -A/-B 子卡）

5a. **CHG-SN-9-CW2-C-EP-A** — Fix-D5 后端契约 + 调度（ADR-154 落地后端）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-26
   - 建议模型：sonnet
   - 执行模型：claude-sonnet-4-6
   - 依赖：CW2-C-ADR PASS ✅（ADR-154 §5 步骤 1-6）
   - 文件范围：
     - `packages/types/src/system.types.ts`：AutoCrawlScheduleType + intervalMinutes + 新 SystemSettingKey 枚举
     - `apps/api/src/db/migrations/075_auto_crawl_schedule_extend.sql`：KV seed（auto_crawl_last_trigger_at）
     - `apps/api/src/db/queries/systemSettings.ts`：deserialize + set 读写 intervalMinutes / scheduleType 解除写死
     - `apps/api/src/routes/admin/crawler.ts`：zod schema 扩展（scheduleType enum + intervalMinutes min5/max1440）
     - `apps/api/src/workers/crawlerScheduler.ts`：dispatch 重构 + checkInterval + persistTriggerMark（R-154-1 锚点时序）
     - `tests/unit/api/crawlerScheduler.test.ts`（新建）：12 单测
     - `tests/unit/api/crawler-system-audit.test.ts`：intervalMinutes 补录 BEFORE/AFTER_CONFIG
   - 估时：0.25w
   - 状态：✅

5b. **CHG-SN-9-CW2-C-EP-B** — Fix-D5 前端 UI（SchedulerConfigDrawer）
   - 创建时间：2026-05-25
   - 完成时间：2026-05-26
   - 建议模型：sonnet
   - 执行模型：claude-sonnet-4-6
   - 依赖：CW2-C-EP-A（类型已合入）
   - 文件范围：
     - `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`：scheduleType AdminSelect + 条件渲染
     - `apps/server-next/src/lib/crawler/api.ts`：AutoCrawlScheduleType + intervalMinutes 类型同步
     - `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`：测试 #12/#13 新增
   - 估时：0.15w
   - 状态：✅

### W2 执行顺序 DAG

```
CW2-A（独立，立即可启）─────────────────────────────────────→ ✅

CW2-B-ADR ──→ CW2-B-EP ─────────────────────────────────→ ✅

CW2-C-ADR ✅ ──→ CW2-C-EP-A ──→ CW2-C-EP-B ──────────→ ⬜（已拆 -A/-B）
```

B 序列 + C 序列可与 A 并行（A 无依赖）；B 与 C 之间无依赖（可并行推进 ADR 轮）。

### W2 关键约束

- **cron-parser 新依赖门禁**：CW2-C-ADR Opus 评审即是"技术栈白名单例外申请"门控；ADR PASS = 许可引入；ADR 未 PASS 则 CW2-C-EP 降为仅 `daily + interval` 两模式
- **timeline SQL breaking change**：CW2-B-EP 改 rn≤3 将使前端 mock 数据形状变化，单测需同步更新 fixture
- **ADR-122 AMENDMENT**：CW2-B 改动 timeline 端点响应 schema，需在 ADR-153 §关联 ADR 中明示为 ADR-122 AMENDMENT（非新 ADR）；verify:endpoint-adr 不触发（无新路由注册）
- **migration 顺序**：CW2-C-EP migration 编号 075（接 CW1-E-EP 的 074）；若 CW2-A/B 期间有其它 migration 插入需调整
- **v1 server 不动**：全程不改 apps/server/ 任何文件
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260526-CRAWLER-W3-FIX] CRAWLER W3 — W1/W2 用户走读暴露的修复闭环

- **状态**：✅ 已完成（2026-05-26 / HOTFIX-A~G 7 卡 + REDESIGN-A-ADR + EP-1A/1B1/1B2/1B2-LAYOUT/1C-1a/1C-1b/1C-2a/1C-2b + EP-2 + EP-3a/3b-1 全部闭环 / @livefree 实测最后一项 HOTFIX-G 黄色 warning 通过）
- **创建时间**：2026-05-26 02:00
- **最后更新时间**：2026-05-26 18:00
- **目标**：消化 @livefree 用户走读 W1/W2 暴露的 4 类缺陷 — ① CW1-B SQL `r.site_key` 不存在（P0 阻塞 cancel/pause/detail）② CW2-B Gantt SQL WHERE 误用 scheduled_at + status 缺 pending（任务刷新消失）+ 布局三处缺陷（"实时"挤两行 / 当前时间在最右 / 站点 limit 硬编码）③ CW2-C Drawer 内 AdminSelect 被 z-index 遮挡（所有下拉不可用）④ CW1-E topbar 第 3 个铃铛未复用 AdminShell 已有 notifications/tasks 数据流 + ⑤ HOTFIX-B/C 实测追加：孤儿 run 转态 + AutoCrawlScheduleCard interval 显示 + scheduler 可见性 + 多 dailyTime（D-155-6）。
- **HOTFIX 进度**：HOTFIX-A ✅ + HOTFIX-B ✅ + HOTFIX-C ✅（2026-05-26 全部 commit + @livefree 实测 11 路径 PASS）
- **范围**：HOTFIX 三处 P0 已闭环；REDESIGN-A 六处设计层重做进行中（含 ADR AMENDMENT）
- **依赖**：W1（SEQ-20260525-CRAWLER-W1）+ W2（SEQ-20260525-CRAWLER-W2）全部 ✅
- **真源**：本会话 2026-05-26 排查 4 项根因 + 用户提议（行内展开 / Gantt 三段窗 / 复用 topbar 图标）
- **总估时**：~1.25w（HOTFIX-A 0.25w + REDESIGN-A 1.0w）

### 任务列表（按执行顺序）

1. **CHG-SN-9-CW1-CW2-HOTFIX-A** — W1/W2 三处 P0 + 1 处布局修补
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 6 路径 1/2/3/5/6 PASS / 路径 4 时间轴拖拽 + 历史回看改入 D-155-3 Gantt 三段窗 / commit d79769cc）
   - 创建时间：2026-05-26 02:00
   - 实际开始：2026-05-26 02:00
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续；建议 sonnet 但本会话 opus 上下文复用避免新会话重读）
   - 建议模型：sonnet（纯修补，无新决策）
   - 范围（实际落地）：
     - Step 1（CW1-B 根因）：`apps/api/src/db/queries/crawlerRuns.ts:362` SQL `RETURNING r.site_key` → 改用子查询 `(SELECT source_site FROM crawler_tasks WHERE run_id = r.id ORDER BY scheduled_at ASC LIMIT 1) AS site_key`。crawler_tasks 实际列名是 `source_site`，alias 仍是 `site_key` 保持调用方解析不变。涉及 commit `d2728a30` 引入的回归。
     - Step 2（CW2-B 数据根因）：`apps/api/src/db/queries/crawlerTimeline.ts:97` WHERE 改为 `COALESCE(ct.finished_at, NOW()) >= NOW() - $1::interval`（不再用 scheduled_at 误切窗口内有可见时段的 task）；status 白名单加 `'pending'`（与 ADR-153 §5 决策对齐）。
     - Step 3（CW2-C 根因 / 方案调整）：**原方案"改 z-admin-dropdown token 980→1050"调整为"改 AdminSelect 消费 z-admin-popover (1050)"** — 原方案会与已存在 z-admin-popover token 撞值导致语义混乱；新方案修 `packages/admin-ui/src/components/admin-select/admin-select.tsx:105` PANEL_STYLE.zIndex 单文件，token 不动。z-admin-popover 1050 本就为"Modal 内 popover 自然覆盖 Modal"设计（ADR-115 §2.5）。
     - Step 4（CW2-B 布局顺手修补）：`apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx` `PILL_BASE_STYLE` 加 `whiteSpace: 'nowrap'` + `flexShrink: 0`（"实时" pill 不再被压两行）。
   - 验收要点：
     - dev server 实测（必跑）：CrawlerRunsView 任意行点 暂停/取消 → toast success；点 run id 跳详情页 → meta + tasks 正常渲染；SchedulerConfigDrawer 打开 → scheduleType / defaultMode / conflictPolicy 三处 select 可正常展开选项；时间轴卡 "实时" pill 单行显示
     - 新增单测：tests/unit/api/crawlerRuns.test.ts 加 `syncRunStatusFromTasks` 返回 siteKey 非空 case（mock crawler_tasks 含 1+ 行）；tests/unit/api/crawlerTimeline.test.ts 加 "pending task 在窗口内可见" + "scheduled 在窗口外但 finished 在窗口内的 task 可见" 2 case
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围（实际落地）：
     - `apps/api/src/db/queries/crawlerRuns.ts`（Step 1）
     - `apps/api/src/db/queries/crawlerTimeline.ts`（Step 2）
     - `packages/admin-ui/src/components/admin-select/admin-select.tsx`（Step 3，方案调整 / token 不动）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（Step 4）
     - `tests/unit/api/crawler-runs-sync-status.test.ts`（新建，5 case）
     - `tests/unit/api/crawlerTimeline.test.ts`（扩展 3 case：HOTFIX-A #1/#2/#3）
   - 估时：0.25w
   - 关键约束：
     - **dev server 实测为硬前置**（W1/W2 全程绕过 ADR-149 §7 工程流程，本卡补上 — 至少跑一次"打开 crawler runs → 点 cancel → 看 toast success"完整流）
     - **z-index token 改动需补 ADR-153 / ADR-154 §关联 ADR 中 AMENDMENT 备注**（HOTFIX-A 不起新 ADR，但需在 REDESIGN-A 起 ADR AMENDMENT 时一并记录）
     - **不动设计层**：UI 布局 / 数据契约 / 路由结构 / 组件 API 一律不改；这些放 REDESIGN-A

2. **CHG-SN-9-CW1-CW2-HOTFIX-B** — 孤儿 run 转态 + AutoCrawlScheduleCard interval 显示
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 2 路径 7/8 PASS / commit 0a0cc4e8）
   - 创建时间：2026-05-26 02:30
   - 实际开始：2026-05-26 02:30
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续；HOTFIX-A 上下文复用）
   - 建议模型：sonnet（纯修补，无新决策）
   - 范围：HOTFIX-A 实测发现 2 缺陷：
     - **Step 1（P0 / 孤儿 run cancel/pause 不转态）**：`apps/api/src/db/queries/crawlerRuns.ts` `syncRunStatusFromTasks` SQL 在 `a.total = 0` 时保持 r.status 不变，导致历史 1 周以上 0-task 的 queued run 被 cancel 后 control_status='cancelling' 但 status 仍 'queued'，前端 toast 绿色"已请求取消 0/0"但 UI 无视觉变化、行又出现 [取消] 按钮。补 2 个 case：`a.total = 0 AND control_status IN ('cancelling', 'cancelled') → 'cancelled'` + `a.total = 0 AND control_status IN ('pausing', 'paused') → 'paused'`；兜底保留原 `WHEN a.total = 0 THEN r.status`（control_status='active' 不变）
     - **Step 2（P1 / CW2-C-EP-B 实施回归）**：`apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx:216` 写死 `每日 ${data.config.dailyTime} · 模式 ${modeLabel}`，interval 模式下显示无意义。改为按 `config.scheduleType` 切换：daily → "每日 HH:MM"，interval → "每 N 分钟"
   - 验收要点：
     - dev server 实测：CrawlerRunsView 历史 queued run（1 周以上）点 [取消] → toast 成功 + 行状态变 "已取消"（不再保持 queued + 可再点）；Dashboard AutoCrawlScheduleCard interval 模式显示 "每 60 分钟" 不是 "每日 undefined"
     - 新单测：`crawler-runs-sync-status.test.ts` 扩 3 case（control_status='cancelling' + 0 task → cancelled / control_status='paused' + 0 task → paused / control_status='active' + 0 task → 保持原 status）；`AutoCrawlScheduleCard.test.tsx` 加 1 case（CONFIG_INTERVAL → 渲染 "每 30 分钟"）
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围：
     - `apps/api/src/db/queries/crawlerRuns.ts`（Step 1：SQL CASE 扩 2 行）
     - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`（Step 2：按 scheduleType 切换显示）
     - `tests/unit/api/crawler-runs-sync-status.test.ts`（扩 3 case）
     - `tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`（扩 1 case；如不存在则新建）
   - 估时：0.15w
   - 关键约束：
     - **Step 1 SQL CASE 必须放在原 `WHEN a.total = 0 THEN r.status` 之前**（PostgreSQL CASE 短路；新 case 更精确条件优先匹配）
     - **不动 control_status 写入逻辑**（只修 status 派生 case；control_status 由 route 层 updateRunControlStatus 写）
     - **worker 8 处 sync 调用方零行为变化**（worker job 永远先创 task，a.total > 0 永远不命中新 case）

3. **CHG-SN-9-CW1-CW2-HOTFIX-C** — schedulerEnabled UI 可见性警告
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 3 路径 9/10/11 PASS / 11 = 3:26 dailyTime 触发 daily run 成功 / commit b1491aea）

3b. **CHG-SN-9-CW1-CW2-HOTFIX-D** — scheduler daily 模式 catch-up window（5 分钟容错）
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 PASS / commit 71fa00b9）

3c. **CHG-SN-9-CW1-CW2-HOTFIX-E** — 时间轴默认 range 5m + 新增 5m option
   - 状态：✅ 完成（2026-05-26 / commit 已 push）

3d. **CHG-SN-9-CW1-CW2-HOTFIX-F** — KpiRow 横向滚动 + CrawlerClient OVERVIEW_ROW 弹性
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 PASS / commit c9d846e7）

3e. **CHG-SN-9-CW1-CW2-HOTFIX-G** — admin-shell-notifications console.error → console.warn（4 处）
   - 状态：✅ 完成（2026-05-26 17:55 / @livefree 实测黄色 warning PASS / commit b6620b5d）

3f. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-A** — dailyTimes 类型 required（消除 EP-1C-1a 临时偏离）
   - 状态：✅ 完成（2026-05-26 18:36）
   - 实际开始：2026-05-26 18:30
   - 完成时间：2026-05-26 18:36
   - 执行模型：claude-opus-4-7
   - 范围：`packages/types/src/system.types.ts` + `apps/server-next/src/lib/crawler/api.ts` 删 `dailyTimes?:` 的 `?` 改 required；不动消费方 fallback（fallback 删除 + fixture 补全规模超 PATCH 5 → 拆到 Cleanup-B/-C）
   - 文件范围：2 源 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / lint ✅ / test 5142/5142 ✅ / verify:adr-contracts ✅
   - 0 cascade（消费方早已 `config.dailyTimes ?? [config.dailyTime]` 兼容）

3g. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B1** — 后端 4 fixture 补 dailyTimes
   - 状态：✅ 完成（2026-05-26 19:25）
   - 实际开始：2026-05-26 19:18
   - 完成时间：2026-05-26 19:25
   - 执行模型：claude-opus-4-7
   - 范围：4 个后端测试 fixture 补 `dailyTimes: ['HH:MM']` 主字段（保留 dailyTime alias）：
     - `tests/unit/api/crawler-system-audit.test.ts` BEFORE_CONFIG + AFTER_CONFIG（2 处）
     - `tests/unit/api/crawlerScheduler.test.ts` #10 setAutoCrawlConfig interval fixture（1 处）
     - `tests/unit/api/background-event-service.test.ts` getAutoCrawlConfigMock 默认返回值（1 处）
     - `tests/e2e/admin.spec.ts` 2 处 auto-config 响应 body（playwright e2e mock）
   - **保留旧路径测试 fixture 不变**（#5 dailyTime alias 兼容 / #7d dailyTimes=[] 兜底 / #17 仅传 dailyTime 兜底）— 它们是测试 fallback 路径的 case，Cleanup-B3 删 fallback 时同步处理
   - 文件范围：4 测试 = 4 项（≤ 5 ✅）
   - 门禁：typecheck ✅ / lint 5/5 ✅ / test 5142/5142 ✅ / verify:adr-contracts ✅

3h. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B2** — 前端 2 主路径 fixture 补 dailyTimes
   - 状态：✅ 完成（2026-05-26 19:30）
   - 执行模型：claude-opus-4-7
   - 范围：2 前端主路径 fixture 补 `dailyTimes: ['03:30']`：
     - `tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` CONFIG（#54 SchedulerConfigDrawer 自开）
     - `tests/unit/components/server-next/admin/dashboard/DashboardClient.test.tsx` mockGetAutoCrawlConfig 默认值
   - **不动 alias-only fixture**（3 处）：BASE_CONFIG (AutoCrawlScheduleCard / AutoCrawlSummaryCard) + CONFIG (SchedulerConfigDrawer) — 这些专门测 dailyTime alias 兜底路径（#13 / #7 / #5 case）；Cleanup-B3 删 fallback 时同步删除（路径不再有意义）
   - 文件范围：2 测试 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 82/82 ✅

3i. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-B3** — 删 5 fallback + 6 旧路径 case（B3a 后端 + B3b 前端合并）
   - 状态：✅ 完成（2026-05-26 19:33 / @livefree 协作分支同改前端）
   - 执行模型：claude-opus-4-7
   - 范围：
     - `apps/api/src/workers/crawlerScheduler.ts` checkDaily 删 fallback `[config.dailyTime || '03:00']` + Pick 删 dailyTime → 直接 `const times = config.dailyTimes`
     - `apps/api/src/db/queries/systemSettings.ts` setAutoCrawlConfig 删 fallback → 直接 `config.dailyTimes.map(parseDailyTime)`
     - `tests/unit/api/crawlerScheduler.test.ts` 删 #5 (alias 兼容) + #7d (空数组兜底) + #17 (仅传 dailyTime 兜底) — 这 3 case 测的是已删 fallback 路径
   - 文件范围：2 源 + 1 测试 = 3 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 29/29 ✅（原 32 - 3 已删 case）

3j. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-C1** — 删 `AutoCrawlConfig.dailyTime` alias 类型声明（原子类型删除）
   - 状态：✅ 完成（2026-05-26 19:43）
   - 执行模型：claude-sonnet-4-6
   - 范围：6 源（types + api.ts + systemSettings + crawler.ts route + crawler-scheduling + SchedulerConfigDrawer）+ 2 测试（crawlerScheduler + crawler-system-audit）
   - 文件范围：8 项（原子耦合，类型删除整批 typecheck 通过）
   - 门禁：typecheck ✅ / test 34/34 ✅

3k. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-C2** — 删 3 test fixture 残余 dailyTime + 修 #18 断言
   - 状态：✅ 完成（2026-05-26 / commit 58222282）

3l-quad. **N1-EP2-2 推迟决策**（2026-05-26 / 主循环复核）
   - 实际范围：useAdminNotifications + useAdminTasks 各自并发请求 `/admin/system/background-events` → 60s 内同端点重复 GET
   - 不是设计冲突；EP-2 arch-reviewer 评审已建议 "留待 ADR-156 端点合并（`/admin/notifications?include=background`）自然消除"
   - 短期方案（Y-155-3）：接受额外 60s 1 个轮询请求开销 / 性能影响可控
   - 长期演化触发条件：60s 双端点轮询性能瓶颈出现 + ADR-156 «notifications 端点扩展» 起卡

3l-tris. **CHG-SN-9-N1-EP2-1** — globalMutateRegistry Set → Map<id, fn> 强化去重
   - 状态：✅ 完成（2026-05-26 20:15）
   - 执行模型：claude-opus-4-7
   - 范围：
     - `apps/server-next/src/lib/admin-shell-background-events.ts` Set → Map<string, () => Promise<void>> + invalidate 用 .values()
     - `apps/server-next/src/lib/admin-shell-notifications.ts` 2 处 register 改 `.set(id, fn)` + `.delete(id)`（id='admin-notifications' / 'admin-tasks'）
   - 价值：同 id 重复注册只保留最新 fn / 防 React StrictMode + HMR 导致 stale reference 残留
   - 文件范围：2 源 = 2 项（≪ 5 ✅）
   - 门禁：typecheck ✅ / test 12/12 ✅ / verify:adr-contracts ✅（含 mirror drift 守卫）

3l-bis. **CHG-SN-9-N1-EP2-3** — admin-shell types drift 守卫脚本（ADR-152 + ADR-155 D-155-2 EP-2）
   - 状态：✅ 完成（2026-05-26 20:10）
   - 执行模型：claude-opus-4-7
   - 范围：
     - 新建 `scripts/verify-admin-shell-types-mirror.mjs`（正则解析 interface 字段 + 名称/类型/可选性比对 / drift 检出退出 1 阻塞 CI）
     - 守卫对象：`NotificationItem` ↔ `AdminNotificationItem` + `TaskItem` ↔ `AdminTaskItem`（packages/admin-ui SSOT vs packages/types API 镜像）
     - `package.json` 加 npm script + 集成到 `verify:adr-contracts` 汇总链
   - 验证：当前两源全部对齐 ✅ / 反向测试（改 progress → progressPct）检出 2 处 drift ✅
   - 文件范围：1 新脚本 + 1 package.json + 2 docs = 4 项（≤ 5 ✅）

3l. **CHG-SN-9-CW1-CW2-EP-1C-CLEANUP-D** — 删 7 fixture + 1 注释残余 dailyTime 字面量（D1 后端 + D2 前端）
   - 状态：✅ 完成（2026-05-26 20:00）
   - 执行模型：claude-opus-4-7
   - 范围：
     - **D1（后端 3 文件）**：
       - `tests/unit/api/crawlerScheduler.test.ts` 删 #10 + #16 setAutoCrawlConfig fixture 残余 `dailyTime` 字段（2 处）
       - `tests/unit/api/background-event-service.test.ts` 删 getAutoCrawlConfigMock 残余 `dailyTime` 字段
       - `tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx` 注释更新 "CONFIG.dailyTime 兜底" → "CONFIG.dailyTimes=['03:30']"
     - **D2（前端 4 文件）**：
       - `AutoCrawlScheduleCard.test.tsx` 删 CONFIG_MULTI 残余 `dailyTime`
       - `AutoCrawlSummaryCard.test.tsx` 删 BASE_CONFIG + CONFIG_MULTI 残余 + 修 #4 close 断言 `dailyTime: '03:30'` → `dailyTimes: ['03:30']`
       - `CrawlerClient.test.tsx` 删 #54 CONFIG 残余
       - `DashboardClient.test.tsx` 删 mockGetAutoCrawlConfig 残余
   - 剩余 1 处 `dailyTime: '03:00'` 在 v1 server `apps/server/.../AutoCrawlSettingsPanel.tsx`（已冻结 / 不在范围）
   - 文件范围：D1（3）+ D2（4）= 7 测试 ≤ 5 → 分两次 commit（D1 + D2）或一次合并
   - 门禁：typecheck ✅ / D1 60/60 ✅ / D2 102/102 ✅
   - 范围：删 5 处 fallback (`config.dailyTimes && length > 0 ? ... : [config.dailyTime || '03:00']`) + 补 8 个 test fixture 显式提供 dailyTimes + 删 dailyTime alias 字段
   - 拆分：
     - Cleanup-B1：补 4 个 backend test fixture（crawlerScheduler / crawler-system-audit / background-event-service / e2e admin）
     - Cleanup-B2：补 4 个 frontend test fixture（AutoCrawlScheduleCard / AutoCrawlSummaryCard / SchedulerConfigDrawer / CrawlerClient + DashboardClient）
     - Cleanup-B3：删 3 处前端 + 2 处后端 fallback
     - Cleanup-C：删 dailyTime alias 字段（双源类型 + 调用方 setConfig 写入 + zod schema 简化）
   - 触发条件：D-155-6 多 dailyTime 功能稳定 1+ 周后；或下一个相关任务卡顺手清理
   - 实际开始：2026-05-26 17:50
   - 完成时间：2026-05-26 17:55
   - 执行模型：claude-opus-4-7（主循环延续；HOTFIX-F 上下文复用）
   - 触发：@livefree HOTFIX-F 实测后报 console 错误 "ApiClientError 请求失败，请稍后重试" / api-client.ts:31:5 — 根因为 Y-EP2-3 Promise.allSettled rejected 分支 `console.error` 把 ApiClientError 实例打印为浏览器 console 红色 stack（语义应为降级 warn 不是 error）
   - 范围：4 处 `console.error('[...] failed:', reason)` → `console.warn('[...] failed (degraded mode):', reason)`（admin-shell-notifications.ts useAdminNotifications/useAdminTasks）
   - 文件范围：1 源 = 1 项 PATCH（≪ 5 ✅）
   - 门禁：typecheck ✅ / lint ✅ / test 12/12 ✅（stderr 已显示 "(degraded mode)" 文案生效）/ verify:adr-contracts ✅
   - 创建时间：2026-05-26 05:40
   - 实际开始：2026-05-26 05:40
   - 完成时间：2026-05-26 06:00
   - 执行模型：claude-opus-4-7
   - 范围：crawlerScheduler.ts checkDaily catch-up window（5min）+ marks 防重 + 跨午夜不补 + 7 case 单测
   - 文件范围：1 源 + 1 测试 = 2 项 ✅
   - 触发：@livefree EP-1C-2b 实测后追问"若到时间未启动如何处理" → 暴露 ADR-154 D-154-5 §checkDaily 精确匹配的设计缺口
   - 不起新 ADR（健壮性补丁 / ADR-155 §7 风险章节"实施期评估"范式延伸）
   - 创建时间：2026-05-26 03:00
   - 实际开始：2026-05-26 03:00
   - 完成时间：2026-05-26 03:30
   - 执行模型：claude-opus-4-7（主循环延续）
   - 建议模型：sonnet（纯 UI 警告 + 单测，无新决策）
   - 范围：HOTFIX-B 实测发现 — scheduler 是 opt-in (`CRAWLER_SCHEDULER_ENABLED === 'true'`)，用户 `.env.local` 无此设置导致 scheduler 进程从未注册，UI 完全无感知。后端 `/admin/crawler/system-status` 已暴露 `schedulerEnabled: boolean`，前端 0 消费。
   - 决策约束：用户选择"手动改 .env.local"路径（不改 scheduler 默认 opt-out → opt-in 语义），本卡只做"可见性"。
   - Step 1（UI 警告 / P1）：`AutoCrawlScheduleCard.tsx` 渲染前增加 `schedulerEnabled === false` 优先判定 → 渲染 danger 状态卡："调度器进程未启动 · 联系 dev 设 `CRAWLER_SCHEDULER_ENABLED=true` 并重启 api"（替代任何 countdown/disabled/failed/error 显示，因为没有 scheduler 进程时 autoCrawlNext 字段不可信）
   - Step 2（PageHeader chip 警告 / P1）：`CrawlerClient.tsx:436` subtitle 在 `status?.schedulerEnabled === false` 时 chip 显 "🚨 调度器未启动"（红字 / cursor:help / title 提示）替代 "下次自动: HH:MM"
   - Step 3（单测）：`AutoCrawlScheduleCard.test.tsx` 加 1 case（schedulerEnabled=false → danger 警告卡 + 不渲染 autoCrawlNext）；`CrawlerSystemStatus` 类型确认 `schedulerEnabled?: boolean` 已存在
   - 验收要点：
     - dev server 实测前置（用户）：暂不改 .env.local（保持 scheduler disabled）→ 重启 api → Dashboard AutoCrawlScheduleCard 显示红色警告卡 / PageHeader chip 显 "🚨 调度器未启动"
     - dev server 实测验证（用户）：`.env.local` 加 `CRAWLER_SCHEDULER_ENABLED=true` 重启 api → 警告卡消失 / 回到 countdown 正常显示
     - typecheck / lint / test / verify:adr-contracts 全过
   - 文件范围：
     - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`（Step 1：6 状态 → 7 状态，scheduler-disabled 优先）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（Step 2：subtitle chip 条件渲染）
     - `apps/server-next/src/lib/crawler/api.ts`（确认 `CrawlerSystemStatus.schedulerEnabled?: boolean` 已存在；如缺则补）
     - `tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`（扩 1 case）
   - 估时：0.1w
   - 关键约束：
     - **本卡不改 scheduler 默认值**（用户决定路径：手动 .env.local）
     - **D-155-6 多 dailyTime 不在本卡范围**（已加入 REDESIGN-A-EP-1）
     - **schedulerEnabled=false 时禁止信任 autoCrawlNext**（scheduler 进程不存在时该字段是过期数据 / 误导用户）

4. **CHG-SN-9-CW1-CW2-REDESIGN-A-ADR** — 六处设计层重做 ADR 起草（合并）
   - 状态：✅ 完成（2026-05-26 / ADR-155 🟢 Accepted / arch-reviewer Opus A− CONDITIONAL → 主循环消化 6 红线 + 5 黄线 + 4 关键洞察 → 等同 A / EP 拆为 6 子卡 EP-1A/B/C-1/C-2/2/3）
   - 创建时间：2026-05-26 02:00
   - 最后更新：2026-05-26 04:00（消化评审完成）
   - 实际开始：2026-05-26 03:30
   - 完成时间：2026-05-26 04:00
   - 执行模型：claude-opus-4-7（主循环）
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立评审 A− CONDITIONAL（6 红线 + 5 黄线 + 3 绿线 + 4 关键洞察 / 输出 agentId a7a1717c2ef082558）
   - 范围：起草 1 份合并 ADR（暂定 ADR-155 «CW1/CW2 用户走读修订») 覆盖 5 个独立但相关的设计决策：
     - **D-155-1（CW1-B 行内展开）**：`/admin/crawler/runs` list 行点击切换 expand panel（消费现有 `renderExpandedRow` + `expandedKeys` API），expand body 复用 `RunInlinePanel`（拆自 CrawlerRunDetailView 的 meta grid + tasks 子表 + TaskLogsDrawer）；独立路由 `/admin/crawler/runs/[id]` 保留为 deep link fallback（含 PageHeader 自渲）
     - **D-155-2（CW1-E 复用 Topbar 图标）**：删除 BackgroundEventBell `position:fixed` 旁路叠加；BackgroundEventService 三源（autoCrawlNext + scheduler + 高危 audit）合并到 `useAdminNotifications` + `useAdminTasks` 现有数据流；扩展 `NotificationItem` discriminated union 加 background category（**触发 packages/admin-ui/src/**/types.ts 改动 → 强制 Opus arch-reviewer trailer**）
     - **D-155-3（CW2-B Gantt 三段窗）**：时间窗从 `[NOW-range, NOW]` 改为 `[NOW-range×0.8, NOW+range×0.2]`；加 now-line 垂直指示线（width=1px, color=var(--accent-default)）；pending bar 显示在 `scheduled_at` 真实位置（不再 clamp 到 NOW），用虚线边框 + 半透明区分；range 选项加 `12h / 24h / 7d`；空窗口加"扩大范围"快捷
     - **D-155-4（CW2-B 站点上限解锁）**：`limit` 从硬编码 8 改为 `range select` 旁边的可选项（8 / 20 / all），后端 `crawlerTimeline.ts` `safeLimit` 上限提到 50；超过 50 站给出"性能模式建议筛选站点"提示
     - **D-155-5（定时设置显式入口卡）**：`/admin/crawler` 顶部加 "AutoCrawlSummaryCard"（紧邻 PageHeader 下方）展示当前生效配置 — scheduleType label + 时间/间隔显示 + globalEnabled 状态 pill + [立即关闭] 快捷按钮（toggle globalEnabled=false 不弹 Drawer）+ [编辑] 按钮（打开 SchedulerConfigDrawer）
     - **D-155-6（多 dailyTime 支持）**：UI 改 `dailyTime` 为 `dailyTimes: string[]`（chip-based 时间列表，可加可删，至少 1 个）；后端 KV `auto_crawl_daily_time` 改 JSON 数组（向后兼容：单字符串旧值 → 解析为 [v]）；`checkDaily` 改"任一时间匹配则触发"；`auto_crawl_last_trigger_date` 加 dailyTime 维度（防同日同时间重复触发但允许同日不同时间多次触发） — 关键决策：相同 dailyTime 同日防重，不同 dailyTime 同日各自触发一次
   - 文件范围：
     - `docs/decisions.md`（追加 ADR-155 完整文本）
     - 同 commit 标注 ADR-122 / ADR-152 / ADR-153 §关联 ADR AMENDMENT
   - 估时：0.25w
   - 关键约束：
     - **强制 Opus 主循环 + arch-reviewer (Opus) 1 轮独立评审**（D-155-2 触发 admin-ui types 改动 → CLAUDE.md "共享组件 API 契约强制 Opus"）
     - **触发 plan §4.5 R7 MUST-8 守门**：ADR PASS 才能起 -EP 实施卡（D-155-2 新增 NotificationItem 字段属共享组件 API 契约）
     - **AMENDMENT 引用必填**：ADR-155 §关联 ADR 必须明列 ADR-122 / ADR-152 / ADR-153 三处 AMENDMENT 说明

5. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-1** — D-155-1/4/5/6 实施（ADR-155 §5 拆为 5 个子卡 EP-1A/1B/1C-1/1C-2）
   - 状态：🟡 EP-1A ✅ 完成 / EP-1B/1C-1/1C-2 ⬜ 待启动
   - 创建时间：2026-05-26 02:00
   - 最后更新：2026-05-26 04:00（EP-1A commit）
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS ✅

   **EP-1A（D-155-1 行内展开）✅ 完成**：
   - 状态：✅ 完成（2026-05-26 / @livefree 实测 6 路径 PASS / commit 3e0495fe）
   - 实际开始：2026-05-26 04:00
   - 完成时间：—（实测 PASS 后回填）
   - 执行模型：claude-opus-4-7（主循环延续）
   - 文件改动：3 源 + 2 测试 = 5 项（PATCH ≤ 5 ✅）

   **EP-1B 拆为 EP-1B1 + EP-1B2**（满足 PATCH ≤ 5 项硬约束 / 评审消化外的实施期 plan-revision）：
   - **EP-1B1（D-155-4 站点 limit 解锁）✅ 完成**（2026-05-26 / commit 9302cf95 / @livefree 实测 3 路径 PASS）
   - **EP-1B2（D-155-5 AutoCrawlSummaryCard）✅ 完成**（2026-05-26 / commit cbdf2e42 / 实测 PASS）
   - **EP-1B2-LAYOUT（D-155-5 实施期布局延伸 / plan-revision）✅ 完成**（2026-05-26 / @livefree 实测 5 路径 PASS / commit 031be4a6）

   **EP-1C-1 拆为 EP-1C-1a + EP-1C-1b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-1C-1a（类型契约 + KV 3 路径兼容）✅ 完成**（2026-05-26 / commit c3d010f7）
   - **EP-1C-1b（zod preprocess + scheduler checkDaily/marks/GC + ADR-154 AMENDMENT）✅ 完成**（2026-05-26 / @livefree 实测 PASS / commit 96f369f1）

   **EP-1C-2 拆为 EP-1C-2a + EP-1C-2b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-1C-2a（SchedulerConfigDrawer chip 列表）✅ 完成**（2026-05-26 / @livefree 实测 7 路径 PASS / commit fd02cbf9）
   - **EP-1C-2b（AutoCrawlScheduleCard + AutoCrawlSummaryCard 多时间显示）✅ 完成**（2026-05-26 / @livefree 实测多时间显示一致性 PASS / commit 4c29d312）

   **D-155-6 多 dailyTime + HOTFIX-D catch-up 全链路完成 ✅**（2026-05-26）**
   - 范围：拆 CrawlerRunDetailView 为 RunInlinePanel + CrawlerRunsView 接 expand + timeline limit 解锁 + 后端 safeLimit 上限提到 50 + 新建 AutoCrawlSummaryCard 顶部展示 + 多 dailyTime 全栈
   - 文件范围：
     - `apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView.tsx`（接 expandedKeys + renderExpandedRow + 改 Run ID 列 cell 为 toggle）
     - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/RunInlinePanel.tsx`（新建，拆自 CrawlerRunDetailView）
     - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx`（瘦身）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（加 limit select）
     - `apps/api/src/db/queries/crawlerTimeline.ts`（safeLimit 上限 20→50）
     - `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（新建 D-155-5）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（嵌入 AutoCrawlSummaryCard）
     - **D-155-6 多 dailyTime 全栈**：
       - `packages/types/src/system.types.ts`（`AutoCrawlConfig.dailyTime: string` → `dailyTimes: string[]`；min 1 max 24）
       - `apps/api/src/db/queries/systemSettings.ts`（serialize JSON array + deserialize 兼容旧单字符串）
       - `apps/api/src/workers/crawlerScheduler.ts`（`checkDaily` 改 "任一 dailyTime 匹配触发" + `auto_crawl_last_trigger_date` 加时间维度 → `auto_crawl_last_trigger_marks: { 'YYYY-MM-DD HH:MM': true, ... }`）
       - `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`（dailyTime 单 input → chip 列表 UI：可加可删，至少 1 个，最多 24 个）
       - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx` + 上面 D-155-5 卡（显示多时间："每日 03:00, 04:00"）
     - 单测扩展（CrawlerRunsView / RunInlinePanel / CrawlerTimelineCard / AutoCrawlSummaryCard / SchedulerConfigDrawer 多 dailyTime UI / checkDaily 多时间匹配 / systemSettings 兼容旧单字符串）
   - 验收要点：dev server 实测 — 行内展开 + timeline limit + AutoCrawlSummaryCard + SchedulerConfigDrawer 加 3 个 dailyTime chip 保存 → 当日 3 个时间各触发一次（相同 dailyTime 同日防重）
   - 估时：0.55w（D-155-5 +0.05 + D-155-6 +0.2 = +0.25 over 原 0.3）

6. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-2** — D-155-2 实施（CW1-E 合并到 AdminShell notifications/tasks）✅ 完成
   - 状态：🟡 代码已落地 / arch-reviewer Opus A− CONDITIONAL → 消化 Y-EP2-1/3 + G-EP2-3 后等同 A / 待 @livefree dev 实测 4 路径
   - 实际开始：2026-05-26 06:10
   - 执行模型：claude-opus-4-7（主循环）+ arch-reviewer (claude-opus-4-7)（强制 Opus trailer）
   - 文件改动：6 改 + 2 删 + 2 测试 = 10 项（ADR-155 §5 临界可接受 / 强制 Opus 弥补）
   - 评审 agentId：a40172d3c90586584
   - ADR-152 §AMENDMENT 2026-05-26 已落盘
   - 状态：⬜
   - 创建时间：2026-05-26 02:00
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS
   - 范围：扩展 NotificationItem discriminated union + 合并 BackgroundEventService 到 useAdminNotifications/useAdminTasks + 删除 BackgroundEventBell
   - 文件范围：
     - `packages/admin-ui/src/shell/types.ts`（扩展 NotificationItem 加 background category，**强制 Opus arch-reviewer trailer**）
     - `apps/server-next/src/lib/admin-shell-notifications.ts`（合并 BackgroundEventService 三源到 useAdminNotifications + useAdminTasks）
     - `apps/server-next/src/app/admin/admin-shell-client.tsx`（删除 BackgroundEventBell 引用 + 删除 useAdminBackgroundEvents）
     - **删除文件**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx` + `apps/server-next/src/lib/admin-shell-background-events.ts`
     - `apps/api/src/services/BackgroundEventService.ts`（保留：仍是端点真源，但调用方改为 NotificationService 内部）
     - 单测扩展（admin-shell-notifications.test 加 background category case）
   - 验收要点：dev server 实测 — topbar 仅有铃铛 + 闪电两图标；点铃铛弹 NotificationDrawer 显示 autoCrawlNext + 高危 audit 上方"即将"组 + 下方"近期完成/失败"组；点闪电弹 TaskDrawer 显示 active crawler_runs；写操作（立即采集）后两 drawer 同步刷新
   - 估时：0.3w
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`（CLAUDE.md ❌ 共享组件 API 契约强制 Opus）

7. **CHG-SN-9-CW1-CW2-REDESIGN-A-EP-3 拆为 EP-3a + EP-3b**（满足 PATCH ≤ 5 项硬约束 / plan-revision）：
   - **EP-3a（后端 Gantt 三段窗 + range 扩展 + JS clamp 双字段）🟡 代码已落地** / 2 源 + 2 测试 = 4 项 ✅ / 5136 PASS / ADR-122 + ADR-153 双 AMENDMENT 已落盘 / 待 @livefree 实测（本卡纯后端）
   - **EP-3b 拆为 EP-3b-1 + N1-EP3b-2**（拖拽 pan 推迟到实测后评估 / plan-revision）：
     - **EP-3b-1（now-line + range 4→7 + pending 虚线）🟡 代码已落地** / 2 源 + 1 测试 = 3 项 ✅ / 5139 PASS / 待 @livefree 实测 4 路径
     - **N1-EP3b-2（拖拽 pan + viewport buffer + 30d 封顶）推迟** / @livefree 实测三段窗 + 7 选项 range 后评估是否真需要 / 若 7d 已覆盖回看可永久推迟
   - 状态：⬜
   - 创建时间：2026-05-26 02:00
   - 建议模型：sonnet
   - 依赖：CW1-CW2-REDESIGN-A-ADR PASS + HOTFIX-A 完成（Step 2 SQL fix 是本卡前置）
   - 范围：时间窗策略改造 + now-line 渲染 + pending bar 位置修正 + 12h/24h/7d range
   - 文件范围：
     - `apps/api/src/db/queries/crawlerTimeline.ts`（RANGE_TO_INTERVAL/MS 加 12h/24h/7d；rangeStart/rangeEnd 改为 `[NOW-range×0.8, NOW+range×0.2]`；pending task 不再 clamp started_at 到 NOW，保留 scheduled_at 真实值）
     - `apps/api/src/routes/admin/crawler.ts`（timeline route range zod enum 加 12h/24h/7d）
     - `apps/server-next/src/lib/crawler/api.ts`（CrawlerTimelineRange 类型扩展）
     - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（加 now-line 渲染 + pending bar 虚线样式 + range select 4→7 选项 + 空窗口"扩大范围"快捷）
     - 单测扩展（crawlerTimeline.test 加 12h/24h/7d range case + pending bar 真位 case；CrawlerTimelineCard.test 加 now-line 渲染 + 7 range 选项 case）
   - 验收要点：dev server 实测 — 时间轴 NOW 位置可见垂直 now-line；pending 任务 bar 在其 scheduled_at 真实位置（不再贴最右）；range 切到 24h 看到完整一天的历史；空窗口给出"扩大到 6h"按钮
   - 估时：0.4w

### W3-FIX 执行顺序 DAG

```
HOTFIX-A（commit d79769cc / 待 dev 实测 1/2/3/5/6 ✅）──────→ 🟡（4 改入 D-155-3）

HOTFIX-B（commit 0a0cc4e8 / 待 dev 实测 7/8）─────────────→ 🟡

HOTFIX-C（schedulerEnabled UI 可见性 / HOTFIX-B 实测发现）→ ⬜

REDESIGN-A-ADR ──┬─→ REDESIGN-A-EP-1（D-155-1/4/5/6）→ ⬜
                 ├─→ REDESIGN-A-EP-2（D-155-2）→ ⬜
                 └─→ REDESIGN-A-EP-3（D-155-3）→ ⬜
                            ↑ 依赖 HOTFIX-A Step 2 SQL fix
```

HOTFIX-A → B → C 顺序串行（B 在 A SQL fix 基础上扩 CASE / C 在 B 实测发现）；REDESIGN-A-ADR 可与 HOTFIX-C 并行起草；EP-1/2/3 互不依赖（可并行）但 EP-3 需 HOTFIX-A Step 2 完成。

### W3-FIX 关键约束

- **dev server 实测为硬前置（绝不可省）**：W1/W2 全程绕过 ADR-149 §7 工程流程导致 3 个 P0 漏检；本 SEQ 每卡完成前必须人工走读 ≥ 1 次完整 UX 路径
- **D-155-2 触发 admin-ui types 改动 → 强制 Opus arch-reviewer trailer**（CLAUDE.md 明禁条款）
- **HOTFIX-A 与 REDESIGN-A-EP-3 时序协调**：避免 SQL 双重改动 conflict（EP-3 在 HOTFIX-A 完成后再启）
- **ADR-155 AMENDMENT 引用必填**：ADR-122 / ADR-152 / ADR-153 三处 §关联 ADR 必须同 commit 标注
- **v1 server 不动**：全程不改 apps/server/ 任何文件（沿用 W1/W2 约束）
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**

---

## [SEQ-20260526-ENUMS-SSOT-01] 视频枚举值 SSOT 收口（用户反馈：编辑表单类型只 4 种）

- **状态**：✅ 已完成（CHG-337 + CHG-338 全闭环 / 2026-05-26；header 状态漂移于 2026-05-31 收口对齐文末「序列状态」子节）
- **创建时间**：2026-05-26 20:30
- **最后更新时间**：2026-05-31
- **目标**：修复 server-next 视频编辑表单 VideoType 下拉 4→11 项（用户反馈，权威 enum 11 项），并起 ADR-157 沉淀「视频枚举值跨层 SSOT 协议」根治后续漂移
- **范围**：apps/server-next/src/app/admin/videos/_client/ 内常量整合 + docs/decisions.md 追加 ADR-157
- **依赖**：无（独立序列）

### 任务列表（按执行顺序）

1. **CHG-337** — TabBasicInfo VideoType 4→11 + server-next 内 VIDEO_TYPE_OPTIONS 收口（状态：✅ 已完成）
   - 创建时间：2026-05-26 20:30
   - 计划开始：2026-05-26 20:30
   - 实际开始：2026-05-26 20:30
   - 完成时间：2026-05-26 21:15
   - 建议模型：sonnet（轻量代码修复 / 3 文件 / 无 schema 变更）
   - 执行模型：claude-opus-4-7（偏离：本会话主循环 Opus / 用户直接驱动 / 无架构决策风险低）
   - 文件范围：
     - `apps/server-next/src/app/admin/videos/_client/videoEnumOptions.ts`（新建 15 行：VIDEO_TYPE_OPTIONS 11 项）
     - `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabBasicInfo.tsx`（删本地 4 项常量 → import 共享）
     - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx`（删本地 11 项常量 → re-export 共享 / 保持 VideoListClient.tsx 向后兼容）
   - 完成备注：
     - 单测 101/101 PASS（含 VideoListClient / VideoFilters / ContentRefPicker / saved-views / SelectionActions / VideoRowActions / VideoListClient.client / VideoEditDrawer 共 8 文件 101 用例）
     - typecheck + lint + verify:adr-contracts 全 PASS（lint 仅有预先存在 warnings 与本卡无关）
     - PATCH 项数 3（≪ 5 ✅）
     - 共享层沉淀评估：建 server-next 内部共享 videoEnumOptions.ts（消除 TabBasicInfo + VideoFilterFields 2 处独立）；跨包真 SSOT（packages/types `as const` 数组 + admin-ui Option helpers）留 ADR-157 决策后另起卡
     - **本卡发现的扩范围 / 转入 ADR-157 §5 实施分卡**：
       - `HomeModuleDrawer.tsx:57` — 独立 11 项常量（label 风格"电影 (movie)"含 raw 值 / 不缺项 / 仅风格漂移）
       - `SubmissionsListClient.tsx:59` — 独立 **9 项**常量（**缺 news/kids 2 项 / P1 缺陷**）
       - apps/server v1 `AdminVideoForm.tsx:15` — VideoGenre 15/20（**缺 5 项 / P1 缺陷**）
       - apps/web-next `SearchPage` tab 4/11（P1）+ `FallbackCover` icon 5/11（P2）+ `VideoMeta` i18n 缺失（P2）+ `video-route` PRIMARY_DETAIL_TYPES 4/11（P2）
   - 验收要点：typecheck + lint + test 全 PASS ✅；视频编辑表单 type 下拉显示 11 项 / 待 @livefree dev server 实测确认

2. **CHG-338** — 起草 ADR-157「视频枚举值跨层 SSOT 协议」（状态：✅ 已完成）
   - 创建时间：2026-05-26 20:30
   - 实际开始：2026-05-26 21:20
   - 完成时间：2026-05-26 21:55
   - 建议模型：opus（撰写 ADR / 强制 spawn arch-reviewer Opus 评审）
   - 执行模型：claude-opus-4-7（主循环 Opus）
   - 子代理调用：arch-reviewer (claude-opus-4-7) / agentId: ab9d05b03359abb45
   - 文件范围：`docs/decisions.md`（追加 ADR-157 约 300 行 / 15035~15334）
   - 完成备注：
     - **arch-reviewer Opus 评审结论**：A- CONDITIONAL（1 红线 + 2 黄线 + 3 绿线 + 关键洞察 #3）
     - **1 红线 R-157-1 已闭环**：API zod 层联动缺失 → §3 D-157-1 增 "API zod 层联动" 块 + §3 D-157-4 白名单删除 `apps/api/src/routes/admin/**` 全量豁免 + §6 增验收第 6 条
     - **2 黄线全闭环**：Y-157-1（命名统一 VIDEO_TYPES 对齐 SPEED_PRESETS 范式）/ Y-157-2（删 EnumOption / 改扩展既有 `AdminSelectOption<T extends string = string>` 泛型）
     - **3 绿线全纳入正文**（不推迟）：G-157-1 assertExhaustive 归属 `packages/types/src/utils/exhaustive.ts` / G-157-2 baseline 截止 +1月 → +2月 + 月度评审 / G-157-3 fallback 删除责任明示
     - **关键洞察 #3 已闭环**：CHG-339 PATCH 项口径明示 "1 enum 双形态视为 1 项"；CHG-340 进一步拆 -A/-B/-C 三子卡确保每卡 ≤ 5
     - **D-N 偏离登记**：D-157-1 ~ D-157-6 共 6 条全部"待 SEQ-20260527-ENUMS-SSOT-IMPL 实施期闭环"（advisory，不阻塞 CI）
     - **共享层沉淀评估**：本卡只起 ADR，不实施；实施分卡 CHG-339-A/B/C + CHG-340-A/B/C + CHG-341 + CHG-342 + CHG-343 + CHG-344 共 10 卡列入下一序列
     - typecheck / lint 无需跑（纯文档改动）/ verify:adr-contracts 通过（advisory D-N 偏离已登记）
     - PATCH 项数 1（≪ 5 ✅）
   - 依赖：CHG-337 ✅ 完成（不需要等执行卡跟进，只需 ADR 编号确认）

### SEQ-20260526-ENUMS-SSOT-01 序列状态

- **序列状态**：✅ 已完成（CHG-337 + CHG-338 全闭环 / 2026-05-26 21:55）
- **最后更新时间**：2026-05-26 21:55
- **下一序列**：`SEQ-20260527-ENUMS-SSOT-IMPL`（10 张实施分卡 / 主循环可按优先级择 1 启动）

### ENUMS-SSOT 关键约束

- **本 SEQ 只做"server-next 内部收口 + ADR 决策"，不做跨包 SSOT 实装**：跨包真 SSOT（packages/types 数组 + admin-ui helpers + grep 守卫）由 ADR-157 落盘后另起执行卡列入下一序列
- **VideoGenre / SearchPage / FallbackCover 等 P1/P2 缺陷不在本 SEQ**：依 ADR-157 §5 实施分卡列入后续序列；本 SEQ 仅闭合用户反馈的 P0 + 决策起草
- **PATCH ≤ 5 项硬约束**：CHG-337 3 项 ✅ / CHG-338 1 项 ✅
- **commit trailer**：CHG-337 主循环 opus 但无 Opus 强制项（仅常量收口）→ `Subagents: 无`；CHG-338 ADR 起草 → `Subagents: arch-reviewer (claude-opus-4-7)`


---

## [SEQ-20260527-ENUMS-SSOT-IMPL] 视频枚举值跨层 SSOT 实施（ADR-157 落地）

- **状态**：✅ 已完成（全 10 卡闭合 / 2026-05-26 22:35）
- **创建时间**：2026-05-26 22:00
- **最后更新时间**：2026-05-26 22:35
- **SEQ 闭合总结**：D-157-1 ~ D-157-6 共 6 条 D-N 偏离全部闭环；ADR-157 完整落地；12 enum 双形态 + 12 admin-ui helpers + API zod 联动 + 守卫脚本 + ADR-048 AMENDMENT 全套就位
- **目标**：按 ADR-157 §5 实施分卡，将 12 个权威 enum 全部落地双形态 + admin-ui Option helpers + 守卫脚本；闭环 D-157-1 ~ D-157-6 共 6 条 D-N 偏离
- **范围**：packages/types + packages/admin-ui + apps/api zod + apps/server-next 4 处独立常量 + apps/web-next P1/P2 + apps/server v1 Genre + scripts 守卫
- **依赖**：CHG-337 ✅ + ADR-157 PASS ✅
- **总估时**：0.7-1.0w

### 任务列表（按 DAG 顺序）

1. **CHG-339-A** — packages/types 4 P0 enum 双形态 + assertExhaustive 工具（状态：✅ 已完成）
   - 创建时间：2026-05-26 22:00
   - 实际开始：2026-05-26 22:05
   - 完成时间：2026-05-26 22:25
   - 建议模型：opus（packages/types 跨包契约改造 / API zod 联动 / 影响面大）
   - 执行模型：claude-opus-4-7 / 子代理：无
   - 文件范围（7 文件 / 5 PATCH 项）：
     - `packages/types/src/video.types.ts`（VideoType / VideoGenre / VideoStatus / ReviewStatus 4 enum 双形态）
     - `packages/types/src/utils/exhaustive.ts`（新建工具子目录 / assertExhaustive）
     - `packages/types/src/index.ts`（const value re-export + utils re-export）
     - `apps/api/src/routes/admin/videos.ts`（4 处 zod 替换：type ×2 + status ×1 + reviewStatus ×1）
     - `apps/api/src/routes/admin/staging.ts`（2 处 zod 替换：type ×2）
     - `apps/api/src/routes/admin/moderation.ts`（1 处 zod 替换：type ×1 / 不动 result 子集）
     - `apps/api/src/routes/search.ts`（2 处 zod 替换：VideoTypeEnum const + 内联 StatusEnum）
   - 完成备注：
     - typecheck ✅ / lint ✅ / 单测 5139/5139 ✅ / verify:adr-contracts ✅
     - 红线 R-157-1 ✅：API 层视频 enum 真实路由 zod 字面量为零（VideoType / VideoStatus / ReviewStatus grep 输出空）
     - 例外（非本卡范围 / 备注）：`apps/api/src/templates/route.template.ts:19` 注释中示例（模板文件，不影响运行）+ `apps/api/src/services/UserSubmissionService.ts:48` `['movie','series','show']`（user submission 业务自定义 enum，含非 VideoType 值 `show`，不属 VideoType 联动）
     - 偶发 flaky：StagingEditPanel.test.tsx 1 用例首跑 fail，单跑 + 重跑全套 PASS → test pollution（与本卡无关）
   - 闭环 D-N：D-157-1 部分（VideoType / VideoGenre / VideoStatus / ReviewStatus 4 P0 双形态 + API zod 联动完成；剩 P1/P2 8 enum 待 339-B/-C）

2. **CHG-339-B** — packages/types 4 P1 enum 双形态（状态：✅ 已完成 / 2026-05-26 22:48 / 执行模型 claude-opus-4-7 / 子代理 无 / VisibilityStatus 2 zod 联动 + ContentFormat/EpisodePattern/TrendingTag 仅双形态无 API zod 引用）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet（范式已建立 / 复制 -A 模板）
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `packages/types/src/video.types.ts`（VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag 4 enum 双形态）
     - `packages/types/src/index.ts`（const value re-export 增项）
     - apps/api zod 引用（如有，grep 后定位）
   - 依赖：CHG-339-A ✅
   - 验收要点：typecheck + lint + test 全 PASS

3. **CHG-339-C** — packages/types 4 P2 enum 双形态（状态：✅ 已完成 / 2026-05-26 22:55 / 执行模型 claude-opus-4-7 / 子代理 无 / D-157-1 全部 12 enum 闭环 + DoubanStatus 2 + SourceCheckStatus 2 + SourceType 1 zod 联动 / VideoQuality 无 API zod 引用）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `packages/types/src/video.types.ts`（DoubanStatus / SourceCheckStatus / VideoQuality / SourceType 4 enum 双形态）
     - `packages/types/src/index.ts`
     - apps/api zod 引用（如有）
   - 依赖：CHG-339-B ✅
   - 验收要点：typecheck + lint + test 全 PASS

4. **CHG-340-A** — packages/admin-ui AdminSelectOption 泛型扩展 + 4 P0 helpers（状态：✅ 已完成 / 2026-05-26 23:25 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer (claude-opus-4-7) agentId: aef79a95ebb5b6fc2 / **A- CONDITIONAL → 黄线 Y-340-A-1 JSDoc 警告已消化 → 等同 A**）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus（packages/admin-ui 公开 Props 改 + helpers 新增 / CLAUDE.md ❌ 共享组件 API 契约强制 Opus）
   - 文件范围（5 文件 / 5 PATCH 项）：
     - `packages/admin-ui/src/components/admin-select/admin-select.tsx`（AdminSelectOption → AdminSelectOption<T extends string = string> 泛型扩展）
     - `packages/admin-ui/src/enums/videoTypeOptions.ts`（新建）
     - `packages/admin-ui/src/enums/videoGenreOptions.ts`（新建）
     - `packages/admin-ui/src/enums/videoStatusOptions.ts`（新建）
     - `packages/admin-ui/src/enums/reviewStatusOptions.ts`（新建）
     - `packages/admin-ui/src/enums/index.ts`（barrel export，与 5 项不冲突 / 视为 helpers 配套）
     - `packages/admin-ui/src/index.ts`（增 `export * from './enums'`）
   - 依赖：CHG-339-A ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`
   - 验收要点：typecheck + lint + admin-ui 单测 PASS + arch-reviewer Opus 评审 PASS / CONDITIONAL → 主循环消化全红线后 PASS

5. **CHG-340-B** — packages/admin-ui 4 P1 helpers（状态：✅ 已完成 / 2026-05-26 23:40 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer agentId: ac43a8742ef38e1cd / A- → 黄线 Y1 译法歧义已消化 → 等同 A）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus（admin-ui 公开 helpers / 范式同 -A）
   - 文件范围（5 文件 / 4 PATCH 项）：4 个 enums/*.ts 新建（VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag）+ enums/index.ts 增项
   - 依赖：CHG-340-A ✅ + CHG-339-B ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`

6. **CHG-340-C** — packages/admin-ui 4 P2 helpers（状态：✅ 已完成 / 2026-05-26 23:50 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer agentId: a5fff0441351a84c7 / **A PASS 无线 / D-157-2 全闭环 12 helpers**）
   - 创建时间：2026-05-26 22:00
   - 建议模型：opus
   - 文件范围（5 文件 / 4 PATCH 项）：4 个 enums/*.ts 新建（DoubanStatus / SourceCheckStatus / VideoQuality / SourceType）+ enums/index.ts 增项
   - 依赖：CHG-340-B ✅ + CHG-339-C ✅
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`

7. **CHG-341** — server-next 4 处独立常量替换 + SubmissionsListClient news/kids 修复（状态：✅ 已完成 / 2026-05-26 22:12 / 执行模型 claude-opus-4-7 / 子代理 无 / videoEnumOptions.ts 已删 / 5 消费方迁移 admin-ui helpers / SubmissionsListClient 9→11 P1 闭环）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `apps/server-next/src/app/admin/videos/_client/videoEnumOptions.ts`（重定向到 admin-ui helpers / 可考虑删除）
     - `apps/server-next/src/app/admin/home/_client/HomeModuleDrawer.tsx`（删本地 → import getVideoTypeOptions）
     - `apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient.tsx`（删本地 → import getVideoTypeOptions / **同时修复 news/kids 缺项 P1**）
     - server-next 其他 enum 消费（按需）
   - 依赖：CHG-340-A ✅
   - 验收要点：server-next 单测全 PASS + 视频编辑 / 列表 / 投稿 / home 4 处 type 下拉一致显示 11 项

8. **CHG-342** — web-next P1/P2 修复 + ADR-048 AMENDMENT（状态：✅ 已完成 / 2026-05-26 22:25 / 执行模型 claude-opus-4-7 / 子代理 无 / SearchPage tab 4→12 派生 ALL_CATEGORIES / FallbackCover icon 5→11+assertExhaustive / VideoMeta useTranslations / video-route 评估保留 ADR-048 设计 / ADR-048 AMENDMENT 已落盘）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（≤ 5 文件 / 4 PATCH 项）：
     - `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx`（SearchTab union 4→11 / 派生自 VIDEO_TYPES）
     - `apps/web-next/src/components/media/FallbackCover.tsx`（getTypeIcon switch 5→11 / 加 assertExhaustive 默认分支）
     - `apps/web-next/src/components/video/VideoMeta.tsx`（label 改为 i18n key 使用 useTranslations / 删硬编码 VIDEO_TYPE_LABEL Record）
     - `apps/web-next/src/lib/video-route.ts`（PRIMARY_DETAIL_TYPES 评估 / ADR-048 关联）
     - `apps/web-next/messages/zh-CN.json` + `en.json` videoType namespace 检查（如有缺项补齐）
   - 依赖：CHG-340-A ✅
   - 同 commit 落 **ADR-048 AMENDMENT 块**（ADR-157 §6 验收第 8 条）
   - 验收要点：web-next 单测 + e2e（SEARCH project）全 PASS

9. **CHG-343** — apps/server v1 AdminVideoForm VideoGenre 15→20（状态：✅ 已完成 / 2026-05-26 22:18 / 执行模型 claude-opus-4-7 / 子代理 无 / v1 维护期 bug 修复豁免 / 派生自 VIDEO_GENRES SSOT / 5 项缺漏闭环）
   - 创建时间：2026-05-26 22:00
   - 建议模型：sonnet
   - 文件范围（1 文件 / 1 PATCH 项）：
     - `apps/server/src/components/admin/AdminVideoForm.tsx`（GENRE_OPTIONS 补 adventure / disaster / musical / western / sport 5 项）
   - 依赖：CHG-339-A ✅
   - 同 commit 备注 "v1 维护期 bug 修复豁免重写期约束 ADR-035"
   - 验收要点：apps/server typecheck + 该组件单测（如有）PASS

10. **CHG-344** — scripts/verify-enum-ssot.mjs 守卫脚本 + 集成（状态：✅ 已完成 / 2026-05-26 22:35 / 执行模型 claude-opus-4-7 / 子代理 无 / D-157-4 + 全 SEQ 闭合 / 首跑检出 80 处违规，advisory 不阻塞，baseline 截止 2026-07-26 + 每月评审）
    - 创建时间：2026-05-26 22:00
    - 建议模型：sonnet
    - 文件范围（5 文件 / 4 PATCH 项）：
      - `scripts/verify-enum-ssot.mjs`（新建守卫脚本）
      - `scripts/enum-ssot-baseline.json`（新建 baseline 例外清单 / 实施期允许 0 例外）
      - `scripts/preflight.sh`（加 step）
      - `package.json`（增 `npm run verify:enum-ssot`）
      - `scripts/verify-adr-contracts.sh` 或对应入口（串联调用）
    - 依赖：CHG-341 ✅ + CHG-342 ✅ + CHG-343 ✅（所有消费方迁移完后启动 / 守卫预期全 PASS）
    - 验收要点：`npm run verify:enum-ssot` 输出 0 违规 + preflight + verify:adr-contracts 集成

### ENUMS-SSOT-IMPL 关键约束

- **DAG 串行依赖**：CHG-339-A → 339-B → 339-C / 339-A → 340-A → 341+342 / 343 独立 / 344 收尾
- **PATCH ≤ 5 项硬约束**：每张子卡严格 ≤ 5 项（已按 ADR-157 §3 D-157-5 口径精算）
- **强制 Opus 评审**：CHG-340-A/B/C 共 3 卡触发 packages/admin-ui 公开 API 改动，commit trailer 必含 `Subagents: arch-reviewer (claude-opus-...)`
- **D-N 偏离闭环责任**：每张 CHG 完成时同步 changelog 标注闭环的 D-157-X（339-A 闭 D-157-1 部分 / 340-A 闭 D-157-2 部分 / 342 同 commit 闭 D-157-3 + ADR-048 AMENDMENT / 344 闭 D-157-4 / 全 SEQ 闭合时闭 D-157-5 + D-157-6）
- **零回归**：每卡完成后 4018+ unit + typecheck + lint + verify:adr-contracts 全 PASS
- **baseline 截止**：CHG-344 完成 + 2 月内 enum-ssot-baseline.json 必须清零（含月度评审 / 逾期升 P1）

---

## [SEQ-20260527-MOD-WAVE1] server-next 内容审核台 Wave 1 — 消债 + 关键 bug 修复 + 搜索/探播实装 + route-labeling 接入

- **状态**：✅ **全部完成（9/9）**（Wave 1 收官 / 待用户验收 → 进 Wave 2 / 2026-05-27）
- **创建时间**：2026-05-27 13:00
- **最后更新时间**：2026-05-27（CHG-351 三子卡 -A/-B/-C 全闭合 / 全自动模式）
- **目标**：基于 `/Users/livefree/.claude/plans/fluffy-giggling-teapot.md` 完成审核台 P0/P1 消债 + 用户视角增强 + route-labeling Phase 1 落地
- **范围**：`apps/server-next/src/app/admin/moderation/**` + `apps/api/src/routes/admin/moderation.ts` + `apps/api/src/services/SourceService.ts` + `apps/web-next/src/components/player/SourceBar.tsx` + `apps/web-next/src/lib/line-display-name.ts` + `docs/manual/`
- **依赖**：无上游阻塞；审查报告见 fluffy-giggling-teapot.md §1-9 事实底板
- **执行约束**（plan §16.1-16.5 必读）：
  - **§16.1** UI/UX 谨慎:避免不必要布局改动,关键交互"点击次数"不得退化;新 UI 改动前先 ASCII 草图走步
  - **§16.2** 人工体验集中 Wave 末:单卡自动 playwright 截图归档 `docs/manual/screenshots/`,Wave 末输出验收报告
  - **§16.3** `docs/manual/moderation-console.md` + `docs/manual/route-labeling.md` 每卡同步更新,缺失即未闭环
  - **§16.4** 集成 route-labeling-system.md(Phase 1 在本 Wave 落地)
  - **§16.5** 主循环全自动:仅 typecheck/test/verify 失败 / 范围溢出 / 需新 ADR / schema 冲突 / Wave 验收未过才中断
- **建议主循环模型**:`claude-sonnet-4-6`(全部 9 张均 Sonnet 卡;Opus 仅在 ROUTE-LABEL-A1 effective_score 公式如需架构评审时 spawn 子代理)

### 任务列表(按执行顺序)

1. **CHG-345** — server-next 审核台 EpisodeSelector ↔ LinesPanel ↔ AdminPlayer 接通修复（状态：✅ 已完成 / 2026-05-27 01:02 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 4 文件改动 / hook currentEp 默认 1 向后兼容 / 新建 7 单测 + admin-player.test.tsx 8/8 零回归 / moderation 范围 243/243 / docs/manual P-moderation §3.6 已加 / Wave 1 卡 2/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §10.3）：
     - `currentEp` 从 PendingCenter 提升,LinesPanel 接收 `currentEp` prop
     - useSelectedLine 扩 `selectEpisode(epNum)`,按 `episode_number === currentEp` 找匹配 source_url
     - EpisodeSelector 切集 → AdminPlayer 自动切源(验证:多线路视频切集后 video src 变化)
     - 边界:line A 有 1-12 集 / line B 有 1-6 集时,切 ep 10 → line B 自动 fallback 第一活跃集
   - 文件范围(≤ 5 项)：`PendingCenter.tsx` / `LinesPanel.tsx`(server-next) / `use-selected-line.ts` / `EpisodeSelector.tsx` / `packages/admin-ui` LinesPanel 类型(如需扩 prop)
   - 人工体验场景：切集 → 播放器换源 / 跨线路切集 / line 集数不齐边界

2. **CHG-346** — 删除 StagingTabContent + mock-data 死代码（状态：✅ 已完成 / 2026-05-27 00:52 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / typecheck + lint + moderation 范围测试 236/236 + 3 verify 全绿 / 完整套件 1 flaky pre-existing 与本卡无关 / Wave 1 卡 1/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P0）：
     - 删 `apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx`
     - 删 `apps/server-next/src/app/admin/moderation/_client/mock-data.ts`
     - grep 复核:无业务 import 残留(测试注释里的历史引用可保留)
     - typecheck + lint 全绿
   - 文件范围(≤ 5 项)：2 个删除 + 可能影响的 e2e 注释清理 + dev/visual/_lib/mock-data.ts 注释更新
   - 建议主循环模型：`claude-haiku-4-5-20251001`(纯归档/删除工作)

3. **CHG-347** — ModerationConsole 抽 usePendingQueue hook(SPLIT-A)（状态：✅ 已完成 / 2026-05-27 01:21 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 829 → 749 行 / 新建 4 单测 / moderation 范围 247/247 PASS / Wave 1 卡 3/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第一步）：
     - 抽出 `usePendingQueue(filters)` hook → `_client/usePendingQueue.ts`
     - 封装:fetch / loadMore / 乐观 approve / 乐观 reject / 失败回滚
     - ModerationConsole 仅消费 hook,不直接持队列 state
     - 无回归:键盘流 J/K/A/R/S + 滚动预取 + 错误 banner
   - 文件范围(≤ 5 项)：新建 usePendingQueue.ts / ModerationConsole.tsx 精简 / 类型导出 / 单测新增
   - 人工体验场景：队列加载 / loadMore 触发 / approve+失败回滚

4. **CHG-348** — 抽 BatchActionsBar 组件(SPLIT-B)（状态：✅ 已完成 / 2026-05-27 01:29 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 749 → 710 行 / 视觉零变化 / docs/manual P-moderation §3.5 已更新 / Wave 1 卡 4/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第二步）：
     - 抽 fixed-bottom bulk bar 至 `_client/BatchActionsBar.tsx`(目前 50 行行内 JSX)
     - props 仅 selectedIds / onApprove / onRejectOpen / onClear / pending
     - 视觉零变化(rem/spacing 对齐 admin-ui 原语)
     - `docs/manual/moderation-console.md` 新增"批量审核"章节
   - 文件范围(≤ 5 项)：新建 BatchActionsBar.tsx / ModerationConsole.tsx / docs/manual/moderation-console.md
   - 人工体验场景：批量通过 / 批量拒绝 / 清除选择

5. **CHG-349** — 抽 PendingPaneController(SPLIT-C)（状态：✅ 已完成 / 2026-05-27 01:45 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 3 文件改动 / ModerationConsole 710 → 616 行 / 字面范围（三栏编排+键盘流）完整执行 / "≤ 250 行" 子目标未达（剩 616 行多在 page head / preset / toast / 独立模块）→ 立 follow-up CHG-354 SPLIT-D 在 Wave 末 / Wave 1 卡 5/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（plan §5 P1 第三步）：
     - 抽 `_client/PendingPaneController.tsx`:左 + 中 + 右 三栏编排 + 键盘流 + 列表加载
     - ModerationConsole.tsx **最终主体 ≤ 250 行**(CLAUDE.md 500 行红线消解)
     - 无回归:Reject Modal × 2 / VideoEditDrawer / RunInfoBanner / Toast 全可用
   - 文件范围(≤ 5 项)：新建 PendingPaneController.tsx / ModerationConsole.tsx 精简 / 关联类型导出 / e2e 回归
   - 人工体验场景：完整 pending tab 回归 / 全键盘流 / 批量+预设组合

6. **CHG-350** — 左栏 search + filterChips(plan §10.1 方案 A)（状态：✅ 已完成 / 2026-05-27 01:54 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 7 文件改动 / 后端 ?q= ILIKE + SQL escape / 前端 toolbar + 300ms debounce + URL 双向同步 / moderationQueueRoutes 新增 2 q-参数测试 / moderation 范围 249/249 PASS / docs/manual §3.7 已加 / Wave 1 卡 6/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点：
     - `_client/PendingQueueToolbar.tsx` 新建:search input(debounce 300ms) + filterChips(type / sourceCheckStatus / doubanStatus 等已有维度)
     - 后端 `GET /admin/moderation/pending-queue?q=<title>` 新增 `q` 参数(ILIKE / trigram),若属于新端点需先起 ADR-NNN
     - URL `?q=` 同步到现有 FILTER_KEYS 模式
     - SWR-style 无闪烁刷新:fetch 期间保留旧数据,新数据 ready 后再替换(或 React 18 useTransition)
     - `docs/manual/moderation-console.md` 新增"搜索"章节
   - 文件范围(≤ 5 项)：新建 PendingQueueToolbar.tsx / `api.ts` 加 q / 后端 moderation.ts route / usePendingQueue.ts 接 q / docs/manual
   - **关键风险**：`q=` 是新端点参数,需核 ADR — 若 verify:endpoint-adr 报错需先起 ADR
   - 人工体验场景：输入 title 即时筛 / 清除筛选 / 与现有 filterChips 组合

7. **CHG-351** — LinesPanel 单行探/播按钮(plan §10.5)（状态：📦 已拆 -A/-B/-C / 2026-05-27 02:45 / 用户选方案 A / 复合任务 ≥ 8 文件不再独立执行）
   - 创建时间：2026-05-27 13:00
   - 拆分依据：plan §16.5 BLOCKER 触发 (新 ADR + admin-ui 公开 Props + PATCH > 5 项硬约束)
   - 三张子卡详见下方 CHG-351-A / -B / -C

7-A. **CHG-351-A** — ADR-158 起草 + 后端单源 probe + render-check 端点（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / arch-reviewer Opus A-CONDITIONAL 1 轮 → 主循环消化 3 红线+3 黄线+4 关键洞察等同 A / 9 文件改动 / R-MID-1 第 27 次系统化 / typecheck+lint+verify全 PASS / video-source-inline-action-audit 5/5 + audit-log-coverage 111/111 + set-equal 4/4 / 全量 5158/5159 unit PASS（1 flaky StagingTable pre-existing 单跑 PASS）/ verify-endpoint-adr 192 路由 70 ADR 端点对齐 / verify-adr-d-numbers 222 D-N 全闭环含 D-158-1..9 / Wave 1 卡 7-A/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 实际开始：2026-05-27（API Overloaded 中断恢复 + /clear + docs 同步 + arch-reviewer 评审后启动实施）
   - 建议主循环模型：`claude-opus-4-7`（主循环不切换 / 用户指定 / ADR 起草级工作）
   - 子代理：✅ 已 spawn `arch-reviewer` (claude-opus-4-7) 1 轮独立评审 → **A-CONDITIONAL**（3 红线 + 3 黄线 + 4 关键洞察）
   - **评审结论修订**（主循环采纳）：
     - **R1**：actionType `sources.single_action` → **`video_source.inline_action`**（与既有 `video_source.toggle` / `.disable_dead_batch` 单源域前缀对齐 + targetKind `'video_source'` 命名空间自洽）
     - **R2**：zod schema `id: z.string().min(1)` → **`id: z.string().uuid()`**（与既有 video-groups/:videoId/matrix 一致 / 422 前置 vs 500 fallthrough）
     - **R3**：文件范围 5 项 → **10 项**（援引 ADR-121 D-121-3 RETRO 7 文件豁免 + 额外 3 文件：ADR 新文件 / decisions.md 索引 / SourcesMatrixService.ts；不拆 -A1/-A2）
     - **Y1**：`/probe` 守 freeze ✅ / `/render-check` **不**守 freeze ❌（diagnostic 可用性优先 / freeze 期间常需 player 渲染复核）
     - **Y2**：error path 不写 audit 显式声明 + 测试 6 case（probe happy + probe 404 + probe 409 + render happy + render 404；render 不守 freeze 故 5 case）
     - **Y3**：占位 jobId 前缀冲突修订 → **`probe-vs-${sourceId}-${Date.now()}`** + **`render-vs-${sourceId}-${Date.now()}`**（`vs` = video_source 命名空间，与 row 7-9 `probe-${siteKey}-` 彻底分离）
     - **I1**：`video_source.inline_action` 与 `video_source.toggle` 边界 — 前者仅覆盖纯诊断（不写状态），后者负责状态写
     - **I2**：4 真源（types / service / set-equal × 2）必须**原子提交**（同一 commit）/ ADR-121 D-121-3
     - **I3/I4**：基线 audit-log-service-enums-set-equal 4/4 + coverage 109/109 全 PASS（arch-reviewer 误判 / 实际已对齐）
   - **ADR-158 起草**：`docs/decisions/ADR-158-single-source-probe-render-endpoints.md` 新建（按 ADR-157 / ADR-117 AMENDMENT 2 范式）
     - 决策：暴露单源粒度 probe + render-check 端点，与 line-level reprobeRoute 互补
     - 端点契约：`POST /admin/sources/:id/probe` + `POST /admin/sources/:id/render-check`
     - 入参 zod：path param `id: z.string().uuid()`（R2）
     - 返回：`{ probeJobId | renderJobId, queued: true, sourceId }`（异步队列模式）
     - 权限：admin only（与 reprobeRoute 一致）
     - audit：`actionType: 'video_source.inline_action'`（R1）+ `targetKind: 'video_source'`（既有）
   - 后端实施：
     - `apps/api/src/routes/admin/sources-matrix.ts` 加 2 端点 + zod
     - `apps/api/src/services/SourcesMatrixService.ts` 加 `probeOne(sourceId, actorId)` + `renderCheckOne(sourceId, actorId)`（probe 守 freeze / render-check 不守 / Y1）
   - audit RETRO 4 真源 + 1 新测试（ADR-121 D-121-2 第 13 次 系统化第 N+1 次）
   - decisions.md 索引追加 ADR-158
   - **文件范围（9 项 / ADR-121 D-121-3 RETRO 7 文件豁免 + 2 额外文件援引 / 项目 ADR 范式确认：所有 ADR 写在 decisions.md 单文件追加章节，无独立 `decisions/` 目录）**：
     - **(RETRO 7 文件 / 原子提交 / 4 真源同步 D-121-2)**：
       1. `packages/types/src/admin-moderation.types.ts`（+1 actionType `video_source.inline_action`）
       2. `apps/api/src/services/AuditLogService.ts`（ACTION_TYPES +1）
       3. `tests/unit/api/audit-log-service-enums-set-equal.test.ts`（EXPECTED_ACTION_TYPES +1）
       4. `tests/unit/api/audit-log-coverage.test.ts`（REQUIRED_ACTION_TYPES + PAYLOAD_ASSERTION_REQUIRED +1）
       5. `apps/api/src/routes/admin/sources-matrix.ts`（2 端点 + handler）
       6. `tests/unit/api/video-source-inline-action-audit.test.ts`（新建 / 5 case payload 断言）
       7. `docs/changelog.md`（完成时追加 / R-MID-1 第 N+1 次系统化）
     - **(额外 2 文件 / 不可压缩)**：
       8. `docs/decisions.md`（追加 `## ADR-158` 章节 + 索引引用 / verify-endpoint-adr 扫此文件）
       9. `apps/api/src/services/SourcesMatrixService.ts`（probeOne + renderCheckOne 方法 / route 实现位置 / RETRO 框架文件 5 物理实现层）
   - **commit trailer 推荐**（虽 task 原始定义不强制，但 ADR 起草级建议）：`Subagents: arch-reviewer (claude-opus-4-7)`
   - 验证：typecheck / lint / verify:adr-contracts / verify:endpoint-adr / 单测全 PASS
   - 人工体验场景：无（纯后端 + ADR）

7-B. **CHG-351-B** — packages/admin-ui LinesPanel Props 扩展（onProbeEpisode + onRenderCheckEpisode）（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / arch-reviewer Opus A-CONDITIONAL 1 轮 → 主循环消化 3 红线 + 2 黄线 + 4 关键洞察 等同 A / 3 文件改动原子提交（types + tsx + test） / 11 case PASS / commit trailer 含 Subagents: arch-reviewer (claude-opus-4-7) / Wave 1 卡 7-B/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 建议主循环模型：`claude-opus-4-7`（CLAUDE.md "共享组件 API 契约强制 Opus" / 主循环不切换）
   - 子代理：**强制** spawn `arch-reviewer` (claude-opus-4-7) 评审 Props 契约 / commit trailer 必含 `Subagents: arch-reviewer (claude-opus-4-7)`
   - 依赖：CHG-351-A 完成（后端端点已存在）
   - 验收要点：
     - `LinesPanelProps` 扩 `onProbeEpisode?: (args: { episodeId: string }) => void | Promise<void>`
     - `LinesPanelProps` 扩 `onRenderCheckEpisode?: (args: { episodeId: string }) => void | Promise<void>`
     - 单 episode 行 inline 渲染 `🔍 探` + `▶ 播` xs 按钮（仅当对应 callback 提供时显示）
     - `pending` set 透传（probing/rendering 中按钮 disabled）
     - 单测/snapshot 验证按钮渲染条件 + onClick 触发
   - 文件范围(≤ 3 项)：
     - `packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts`（Props 扩 2 callback）
     - `packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx`（per-episode inline buttons 渲染）
     - `packages/admin-ui/tests/lines-panel.test.tsx` 或现有测试（snapshot + 行为）
   - **commit trailer 必填**：`Subagents: arch-reviewer (claude-opus-4-7)`（CLAUDE.md 红线）
   - 验证：typecheck / lint / packages/admin-ui 单测 PASS

7-C. **CHG-351-C** — server-next 消费方 + 单源 probe/render API 客户端 + 测试 + docs（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 主循环不切换 §16.5 / 4 文件改动 / typecheck+lint+moderation 24/239 PASS / CHG-351 三子卡 -A/-B/-C 完整闭环 / Wave 1 卡 7-C/9 闭合）
   - 创建时间：2026-05-27 02:45
   - 建议主循环模型：`claude-opus-4-7`（主循环不切换 / 用户指定）
   - 子代理：无（消费方实施 / 复用已评审契约）
   - 依赖：CHG-351-A + CHG-351-B 完成
   - 验收要点：
     - `apps/server-next/src/lib/moderation/api.ts` 加 `probeOneSource(sourceId)` + `renderCheckOneSource(sourceId)`
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx` 接 onProbeEpisode + onRenderCheckEpisode props → 调 API
     - probing/rendering 状态用 togglingIds 同模式管理（per-source pending Set）
     - 错误用 actionError 显示（与 toggle 相同）
     - `docs/manual/20-pages/P-moderation.md` 新增 §3.8 "线路检测（单源探/播）"章节
   - 文件范围(≤ 5 项)：
     - `apps/server-next/src/lib/moderation/api.ts`（2 API 函数）
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（消费 props + state）
     - `docs/manual/20-pages/P-moderation.md`（新章节）
     - 单测（如有）
   - 验证：typecheck / lint / moderation 范围测试全 PASS
   - 人工体验场景：单 episode 探/播触发 / 排队状态 / 错误展示 / 跨多 line 同时触发

8. **CHG-352** — route-labeling Phase 1 后端:`effective_score` 排序(plan §17)（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 3 红线 + 4 黄线 + 4 关键洞察等同 A / 6 文件改动（含 docs）/ source-effective-score 28 case PASS + sources 9 case PASS / typecheck + lint + verify:adr-contracts 全绿 / Wave 1 卡 8/9 闭合）
   - 创建时间：2026-05-27 13:00
   - 验收要点（route-labeling-system.md Phase 1 + Layer A）：
     - `SourceService.listSources()` 加 `effectiveScore` 计算:0.5×health + 0.3×quality + 0.15×latency + 0.05×priority
     - 返回已排序列表(由后端定序)
     - health_score:probe×0.4 + render×0.6,quality_score:4K/2K/.../NULL 档位,latency_score:≤200ms/.../>2000ms 档位
     - priority_bonus:`source_line_aliases.priority`(若 Migration 064 未落地,默认 0)
     - 单测:边界 case(全 NULL / probe ok+render dead / 0 latency)
     - `docs/manual/route-labeling.md` 新建,记录公式 + 权重
   - 文件范围(≤ 5 项)：SourceService.ts / sources-matrix.types.ts(扩 effectiveScore 字段) / 单测 / docs/manual/route-labeling.md / sources.ts route 透出字段
   - **关键风险**：算分函数算"架构决策"等级 → 建议 spawn arch-reviewer Opus 子代理评审公式合理性
   - 人工体验场景：多线路视频排序前后对比 / 单线路 / 全 dead 边界

9. **CHG-353** — route-labeling Phase 1 前台:主题渲染(plan §17)（状态：✅ 已完成 / 2026-05-27 / 执行模型 claude-opus-4-7 / 4 文件改动 / 22 case PASS / typecheck+lint 全绿 / Wave 1 卡 9/9 闭合 → **Wave 1 全部完成 ✅**）
   - 创建时间：2026-05-27 13:00
   - 验收要点（route-labeling-system.md Phase 1 + Layer C）：
     - `apps/web-next/src/lib/line-display-name.ts` 加 `RouteTheme` 类型 + 内置常量(节气 24 / NATO 26 / 数字 10 / Planets 8 / Colors 8)+ `applyThemeLabels(routes, theme)` 函数
     - `apps/web-next/src/components/player/SourceBar.tsx` 消费 applyThemeLabels → 渲染 `themeLabel · quality`
     - 极端情况:0 条不渲染 / 1 条不显标签 / 全 dead 置灰 + deadLabel / 超主题长度 `线路{n}` fallback
     - 默认主题:zh-CN → 节气,en → NATO Phonetic(根据 i18n locale)
     - `docs/manual/route-labeling.md` 加"主题"章节
   - 文件范围(≤ 5 项)：line-display-name.ts / SourceBar.tsx / 单测 / docs/manual / 必要时 i18n key
   - 人工体验场景：节气主题 / NATO 主题切换 / deadLabel / fallback / 0 / 1 条边界

### Wave 1 验收(全部完成后)

- 主循环输出 Wave 1 验收报告:
  - 全部截图聚合(`docs/manual/screenshots/wave-1/`)
  - typecheck + lint + test + verify:adr-contracts + verify:endpoint-adr 全绿日志
  - 9 张卡 changelog 条目链接
  - "建议用户亲手验收的路径"(EPSEL 切集 / 搜索过滤 / 探播触发 / 排序前后对比)
- 用户/reviewer 验收通过 → 进 Wave 2(参见 plan §14 Wave 2)

### Wave 1 BLOCKER 触发清单(plan §16.5)

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围溢出(改动 > 卡片定义文件范围)
- 发现需要新建 ADR 而无现成依据(尤其 CHG-350 ?q= 端点 / CHG-351 :id/probe + render-check 端点)
- schema migration 冲突(本 Wave 不应触发,但若 ROUTE-LABEL-A1 需读 source_line_aliases 而 Migration 064 未落地需注意)
- 人工已审核 Wave 报告未通过

### 关键依赖图

```
CHG-345 (EPSEL-FIX, 独立)
CHG-346 (CLEANUP, 独立)
CHG-347 (SPLIT-A) → CHG-348 (SPLIT-B) → CHG-349 (SPLIT-C)
CHG-350 (LIST-SEARCH) → 依赖 CHG-347 (usePendingQueue 已抽)
CHG-351 (PROBE-RENDER, 独立, 但 effective_score 排序的数据底座)
CHG-352 (ROUTE-LABEL-A1) → 依赖 CHG-351 数据真实化(可并行启动,合入 main 时确认数据)
CHG-353 (ROUTE-LABEL-A2) → 依赖 CHG-352 后端返回排序数据
```

执行序列建议(主循环按此顺序取卡)：
**CHG-346 → 345 → 347 → 348 → 349 → 350 → 351 → 352 → 353**

---

## [SEQ-20260527-MOD-WAVE2] server-next 内容审核台 Wave 2 — 预览/拆分/合并/元数据/路线主题（plan §14 + §17.2）

- **状态**：✅ **Wave 2 完全收官（100%）**（CHG-367 全部 / CHG-368-A ADR-164 Accepted / CHG-368-B-A1..C-UI 全实施 / CHG-368-B-C-DOCS docs sync / Layer B 山名代号体系完整 ship：schema + 业务 + audit + UI + 字库 + 退役治理 + LinesPanel codename badge + 退役行 opacity）
- **最后更新时间**：2026-05-28
- **创建时间**：2026-05-27
- **目标**：基于 `/Users/livefree/.claude/plans/fluffy-giggling-teapot.md` §14 Wave 2 + §17.2 落地 9 张主卡（4 张需 ADR + Opus 决策）；继续 Wave 1 的自动推进节奏。
- **范围**：web-next 前台预览模式 + audio/视频拆分/合并端点 + 元数据治理（豆瓣/国家/集数） + route-labeling Phase 2/3
- **执行约束**：沿用 Wave 1 §16.1-16.5（UI/UX 谨慎 / 人工体验集中 Wave 末 / docs/manual 同步 / route-labeling 集成 / 主循环全自动 + BLOCKER 触发清单）
- **建议主循环模型**：`claude-opus-4-7`（ADR 卡）+ `claude-sonnet-4-6`（无 ADR 卡）；主循环不切换 §16.5
- **依赖**：Wave 1 全部完成 ✅（待用户验收 / 用户 2026-05-27 启动指令视为验收）

### 任务列表（按 plan §14.2 顺序，前 6 张为 Wave 2 主线）

> 命名沿用 `CHG-NNN` 数字编号（与 Wave 1 一致），plan §14 的 `CHG-SN-9-*` 命名作为子标题。下一个 CHG 编号从 **CHG-361** 起（CHG-359 未使用，沿用 357 → 358 → 358-FIX → 360-A/B/C 历史顺序）。

| # | TASK-ID | 标题（plan 对应） | ADR | 建议模型 |
|---|---|---|---|---|
| 1 | ✅ **CHG-361-A** 已完成（2026-05-27）| PREVIEW-ADMIN ADR-160 起草 + Opus 评审 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 3 红线 + 5 黄线 + 3 advisory + 4 关键洞察 → 等同 A / 4 文件原子提交（ADR-160 §1-11 + getVideoDetailHref 沉淀 packages/types） | 是 ADR-160 ✅ Accepted | opus-4-7 + arch-reviewer Opus |
| 2 | ✅ **CHG-361-B2** 已完成（2026-05-27）| PREVIEW-ADMIN apps/api 后端实施（3 文件 / ADR-160 AMENDMENT 1）+ 5 case 单测 | 否（contract 扩展非新端点）| opus-4-7 续会话 |
| 2.5 | ✅ **CHG-361-B1** 已完成（2026-05-27）| PREVIEW-ADMIN web-next 前端实施（middleware + admin-access-token + video-detail / 3 文件 + 2 测试 / 17 case PASS）| 否 | opus-4-7 续会话 |
| 2.8 | ✅ **CHG-361-D** 已完成（2026-05-27）| PlayerShell previewMode Props（屏蔽 feedback hook 挂点 / 1 业务 + 1 测试 3 case PASS）| 否 | opus-4-7 续会话 |
| 3 | ✅ **CHG-361-C** 已完成（2026-05-27）| PREVIEW-ADMIN server-next 按钮 + VideoQueueRow contract 扩 + e2e + manual / 3 业务 + 1 e2e + 1 manual | 否 | opus-4-7 续会话 |
| 3.1 | ✅ **CHG-361-E1** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 sources 端点 preview query + SourceService 派发 / 2 业务 + 1 测试 5 case PASS | 否（contract 扩展非新端点）| opus-4-7 续会话 |
| 3.2 | ✅ **CHG-361-E2** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 detail-page-factory + VideoDetailClient server-side hydration / 3 业务 + 1 测试 5 case PASS | 否 | opus-4-7 续会话 |
| 3.3 | ✅ **CHG-361-E3** 已完成（2026-05-27）| ADR-160 AMENDMENT 2 watch page + PlayerShell server-side hydration / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 4 | ⛔ **CHG-362-A** SKIPPED（2026-05-27）| SPLIT-ADR ADR-161 起草 / **被 ADR-105 覆盖**（2026-05-12 Accepted / 端点 #4 `POST /admin/videos/:id/split` + SplitSchema + audit + 错误码完整设计）/ plan §10.2 撰写时漏查 / 无需独立 ADR-161 | — | — |
| 5 | ⛔ **CHG-362-B** SKIPPED（2026-05-27）| SPLIT 后端实施 / **已落地**（apps/api/src/routes/admin/video-merges.ts:95 `POST /admin/videos/:id/split` + svc.split + 422/404/409 错误码 + audit 写入）/ 本卡定义重复 | — | — |
| 6 | ✅ **CHG-363-A** 已完成（2026-05-27）| SPLIT-UI -A PendingCenter "✂ 拆分" 按钮入口 / 跳 `/admin/merge?split=:videoId` / 1 业务 + 1 i18n + 1 测试 3 case PASS | 否 | opus-4-7 续会话 |
| 6.5 | ✅ **CHG-363-B** 已完成（2026-05-27）| SPLIT-UI -B MergeClient `?split=:videoId` 深链 + MergeSplitSection initialVideoId Props 自动加载 / Codex stop-time review 触发提前实施 / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 7 | ✅ **CHG-364-A** 已完成（2026-05-27）| MERGE-INLINE -A BatchActionsBar "↔ 合并" 按钮（selectedCount ≥ 2）+ 跳 `/admin/merge?ids=<csv>` / 2 业务 + 1 测试 4 case PASS | 否 | opus-4-7 续会话 |
| 7.5 | ✅ **CHG-364-B** 已完成（2026-05-27）| MERGE-INLINE -B MergeClient `?ids=<csv>` 深链 + BatchMergeWorkspace（选 target + mergeVideos）/ 2 业务 + 1 测试 4 case PASS | 否（扩 URL contract）| opus-4-7 续会话 |
| 8 | ⛔ **CHG-365-A** SKIPPED（2026-05-27 / BLOCKER #2）| META-DOUBAN-AUTO ADR-162 起草 / **MetadataEnrichService 已实施 80% 需求**（CHG-385 Phase 3 已落地 / Step1 本地豆瓣多字段召回 + 置信度 0.85/0.60 / Step2 网络搜索 / Step3 anime 走 bangumi / Step4 源 HEAD / Step5 meta_score / CrawlerService:300 入库后 5 分钟自动入队列）/ plan §10.4.1 撰写时漏查 / 真实缺口仅 2 项 → 拆 -A1/-A2 实施卡 | — | — |
| 8.1 | ✅ **CHG-365-A1** 已完成（2026-05-27）| PinyinDetector helper 独立实施（贪心 longest-match 拼音音节分解 / 约 410 个音节常量 / 严防数字 + 非 ASCII + 最小词长）/ 1 业务 + 1 测试 18 case PASS / MetadataEnrichService 集成延后到 -A2 一并做（依赖 meta_quality schema） | 否 | opus-4-7 续会话 |
| 8.2 | ✅ **CHG-365-A2** 已完成（2026-05-27）| Migration 077 + VideoMetaQuality types + queries 扩 + MetadataEnrichService 写入持久化（豆瓣 confidence/method/status + 拼音 isPinyin + enriched_at）+ architecture.md §5.1 同步 / 23/23 case PASS（+3）/ 6 业务 + 1 测试 + 1 docs | 否（schema 扩展非 ADR-needed / 复用 Migration 032 模式） | opus-4-7 续会话 |
| 9 | ⛔ **CHG-365-B** SKIPPED（2026-05-27 / 同步 A SKIPPED）| 采集 worker 自动豆瓣 / **已就绪**（CrawlerService:300 入库后自动 enrichmentQueue.add 触发 MetadataEnrichService.enrich）/ 拼音识别 → CHG-365-A1 / 本卡定义重复 | — | — |
| 10 | ✅ **CHG-366** 已完成（2026-05-27）| META-COUNTRY-DISPLAY / formatCountryName helper（packages/types / Intl.DisplayNames 零依赖）+ CountryName 原语（admin-ui cell）+ TabDetail / PendingCenter / MetaChip 内化（web-next 3 处消费方零改）/ 7+3=10 case PASS / 5 业务 + 2 测试 + 1 docs | 否 | opus-4-7 续会话 |
| 11 | ✅ **CHG-367-A** 已完成（2026-05-28）| META-EPISODES ADR-163 起草 / arch-reviewer Opus A- CONDITIONAL → 0 红线 升 Accepted / D-163-1..8 全闭环 / 3 黄线 + 3 advisory 由 CHG-367-B 承接 | 是 ADR-163 ✅ Accepted | opus-4-7 + arch-reviewer (opus-4-7) |
| 12.1 | ✅ **CHG-367-B-A** 已完成（2026-05-28）| META-EPISODES 实施第 1 子卡：Migration 078 + types + queries + MetadataEnrichService 自动写入 / 32 case PASS（+6）/ PATCH=6 超阈值 1（schema-driven 必然耦合 / 接受）| 否（ADR-163 已 Accepted）| opus-4-7 续会话 |
| 12.2 | ✅ **CHG-367-B-B** 已完成（2026-05-28）| META-EPISODES 实施第 2 子卡：DoubanService.confirmSubject/confirmFields manual 写入 + TabDetail.formatEpisodesTriad 三维显示 + 3 黄线全闭档（Y1 current>total UI 防御 / Y2 confirmFields fields 扩 'episodes' / Y3 architecture.md §5.1 同步）/ 58 case PASS（douban 12 + metadataEnrich 32 + doubanService-manual 5 + TabDetailReprobe 4 + TabDetailEpisodes 5）/ 5 业务 + 2 测试 + 1 docs / PATCH=5 严守阈值 | 否（ADR-163 已 Accepted）| opus-4-7 续会话 |
| 13 | ✅ **CHG-368-A** 已完成（2026-05-28）| ROUTE-LABEL-B ADR-164 起草 / arch-reviewer Opus 1 轮 A- CONDITIONAL → 0 红线 升 Accepted / D-164-1..12 全闭环 / 5 黄线 + 4 advisory + 7 重评条件 / Migration 079 SQL 草案完整 / 3 新端点 R7 MUST-8 6 列契约 / R-MID-1 RETRO 触发 7 文件框架 + 2 新 actionType / 实施期 19 文件 → 拆 -A/-B/-C | 是 ADR-164 ✅ Accepted | opus-4-7 + arch-reviewer (opus-4-7) |
| 14 | **CHG-368-B**（拆 -A1/-A2/-A3/-B/-C 子卡 / ADR-164 §7 锁定）| ROUTE-LABEL-B 实施总卡 — Migration 079 + queries + Service + 3 admin 写端点 + R-MID-1 RETRO + admin UI + LinesPanel + docs（19 文件 / 拆 5 子卡）| 否（ADR-164 已 Accepted）| opus-4-7（-A1/-A2 schema/RETRO）+ sonnet（-A3/-B/-C）|
| 14.1 | ✅ **CHG-368-B-A1** 已完成（2026-05-28）| ROUTE-LABEL-B 实施第 1 子卡 — Migration 079（4 字段 + CHECK + 2 部分索引）+ SourceLineAlias 类型扩 4 字段 + 3 新 input/output interfaces + route-codenames.ts MOUNTAIN_CODENAMES 52 项常量 + sources-matrix queries SELECT 列扩 + mapAliasRow helper 沉淀 / 5 业务 + 0 测试 / 零业务行为变化 / typecheck + verify:adr-contracts + sources-matrix 41/41 单测全 PASS | 否（ADR-164 已 Accepted）| opus-4-7 续会话 |
| 14.2a | ✅ **CHG-368-B-A2a** 已完成（2026-05-28）| ROUTE-LABEL-B 实施第 2a 子卡 — queries 新增 4 mutations（upsertLineAliasFull / retireLineAlias / updateLineAliasPriority / findCodenameAssignments）+ SourcesMatrixService 新增 3 方法 + 扩 1（upsertLineAliasWithFields / retireLineAlias / updateLineAliasPriority / getCodenamePool）/ 3 业务 + 1 测试 + 1 测试调整（PATCH=5 严守）/ 零 route 改动 / audit 留 -A2b 一体提交 / 52/52 单测全 PASS / **不触发 architecture sync**（FIX-{1..5} 经验主动核对落地）| 否 | opus-4-7 续会话 |
| 14.2b | ✅ **CHG-368-B-A2b** 已完成（2026-05-28）| ROUTE-LABEL-B 实施第 2b 子卡 — route 3 端点（GET codename-pool / POST retire / PUT priority）+ PUT upsert body 扩 codename + priority 双签名派发 + R-MID-1 RETRO 7 文件框架（D-121-3 豁免）+ Service retire/priority_update audit 写入接入 + payload 内容断言独立测试新文件（6 case）/ R-MID-1 第 29-30 次系统化 / ADR-164 §5 标题修订对齐既有 ADR 范式 / 182/182 单测 PASS / verify-endpoint-adr 197 路由 80 ADR 端点对齐 | 否（ADR-164 已 Accepted）| opus-4-7 续会话 |
| 14.3 | ✅ **CHG-368-B-A3** 已完成（2026-05-28）| ROUTE-LABEL-B 实施第 3 子卡 — route-scoring priority 通道激活 (priority/100 替代 Phase 1 默认 0) + sources.ts findActiveSourcesWithSignalsByVideoId JOIN 加 source_line_aliases LEFT JOIN + 双条件 WHERE 守卫 (sla.retired_at IS NULL OR sla.source_site_key IS NULL) / 2 业务 + 1 测试调整 / PATCH=3 严守 / 零回归 (null fallback 与 Phase 1 数学一致) / 84/84 单测 PASS | 否 | opus-4-7 续会话 |
| 14.4 | ✅ **CHG-368-B-B** 已完成（2026-05-28）| ROUTE-LABEL-B 实施第 4 子卡 — admin UI 独立路径 /admin/source-line-aliases + DataTable 一体化（PageHeader + AdminCard codename 池摘要 + Modal 编辑行 + 行级 retire 操作 + 6 列定义）+ lib/sources/api.ts 扩 4 函数 + admin-nav.tsx 新增 sidebar 入口 / 4 业务 + 1 测试 / PATCH=5 严守 / 不触发 architecture sync / 6/6 单测 PASS | 否（ADR-164 已 Accepted）| opus-4-7 续会话 |
| 14.5-DOCS | ✅ **CHG-368-B-C-DOCS** 已完成（2026-05-28）| ROUTE-LABEL-B docs 同步 — docs/architecture.md "未 ship" → "已 ship" 升级（业务路径 + admin UI 详列）+ docs/manual/route-labeling.md 追加 §9 Layer B 实施记录（9 子段：schema/字库/冷却/端点/admin UI/priority/退役/黄线/文件清单）/ 2 docs / PATCH=2 / 纯 docs 不触发任何红线 | 否 | opus-4-7 续会话 |
| 14.5-UI | ✅ **CHG-368-B-C-UI** 已完成（2026-05-28）| ROUTE-LABEL-B advisory UI — LineAggregate / RawSourceRow 扩 codename + retiredAt 字段 + aggregate.ts 取首行透传 + LinesPanel LineRow codename badge + 退役行 opacity（仅 span / button 保留 1.0 / WCAG 守卫）+ 4 业务 + 2 测试调整 / arch-reviewer Opus 轻量 review A / 0 红线 / 2 黄线全落 / 42/42 单测 PASS | 否（ADR-164 advisory A-164-2）| opus-4-7 + arch-reviewer (opus-4-7) |
| 15 | ✅ **CHG-369** 已完成（2026-05-27）| ROUTE-LABEL-C / 5 内置主题选择器 + localStorage 持久化 / SSR safe / 8 case PASS / 3 业务 + 2 测试 + 1 docs / 自定义主题输入 → follow-up CHG-369-B | 否 | opus-4-7 续会话 |

### Wave 2 BLOCKER 触发清单（沿用 Wave 1 §16.5）

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围超出卡片定义（改动 > 卡片范围 5 项）
- ADR 起草卡 Opus 评审 BLOCKER 红线未消解
- schema migration 冲突（特别注意 ROUTE-LABEL-B Migration 064 与 META-EPISODES 顺序协调 / plan §17.3）
- 人工已审核 Wave 报告未通过

### 关键依赖图

```
CHG-361-A (ADR-160) → 361-B (前台) → 361-C (后台)
CHG-362-A (ADR-161) → 362-B (后端 split) → 363 (SPLIT-UI)
CHG-364 (MERGE-INLINE, 独立)
CHG-365-A (ADR-162) → 365-B (worker 豆瓣)
CHG-366 (国家显示, 独立)
CHG-367-A (ADR-163 / migration) → 367-B (实施)  ─┐
CHG-368-A (ADR-164 / migration 064) → 368-B (退役端点) ─┴── 注意 migration 顺序
CHG-369 (前台主题选择器, 独立)
```

执行序列建议（主循环按此顺序取卡，**ADR 卡先于实施卡**）：
**CHG-361-A → -B → -C → 362-A → -B → 363 → 364 → 365-A → -B → 366 → 367-A → -B → 368-A → -B → 369**

---

## [SEQ-20260528-MOD-WAVE3] server-next 内容审核台 Wave 3 — Wave 2 长尾清理 + 架构 / 长期 P3 卡（plan §14 Wave 3 + §17.2 Wave 3 增补）

- **状态**：✅ **完全收官（用户签字 2026-05-28）**（实施期 9/10 + 3 DEFERRED + 验收期补丁 LINES-VIEW-UNIFY/CODENAME-MATRIX + 4 Codex FIX 全闭环 / 17 commits / Wave 4 已立案 SEQ-20260528-MOD-WAVE4 等新会话启动）
- **创建时间**：2026-05-28
- **目标**：按用户 2026-05-28 决策"长尾先清 + plan §14 主线"：先清 4 张 Wave 2 长尾 follow-up，再按 plan §14 / §17.2 Wave 3 入 6 张 P3 长期主线卡。
- **执行约束**：沿用 Wave 1/2 §16.1-16.5（UI/UX 谨慎 / docs/manual 同步 / 主循环全自动 + BLOCKER 触发清单）
- **建议主循环模型**：`claude-sonnet-4-6`（多数 docs / 机械迁移卡）+ `claude-opus-4-7`（ADR / 共享 API / 大型重构卡）；主循环不切换 §16.5
- **依赖**：Wave 2 全部完成 ✅（2026-05-28 用户启动指令视为验收）

### 任务列表

| # | TASK-ID | 标题 | ADR | 建议模型 |
|---|---|---|---|---|
| 1 | ✅ **PRE-INDEX-DESIGN-RULES** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| 沉淀"索引设计 4 步核验 + 双 invariant（部分索引方向 / 驱动列 vs 索引列匹配性）+ 四级范式（覆盖→候选→不适用→实测）+ 4 类禁令 + 6 项 Checklist"到 `docs/rules/db-rules.md`（CHG-368-B-A1-FIX-{1..5} 5 次 stop-time review 经验首次完整规范化 / 2 docs / PATCH=2 / typecheck + lint + verify:adr-contracts 全 PASS / 单测 24/167 pre-existing 失败 stash 前后一致零回归）| 否 | sonnet-4-6 |
| 2 | ✅ **CHG-369-B** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| 自定义主题输入（plan §17.2）：CustomThemeData schema + 双 key localStorage 协议 + parseCustomTheme 严格校验 + CustomThemeDialog NEW（仿 ConfirmReplaceDialog 模式 / role=dialog aria-modal / 实时校验 + 字符计数 + Confirm/Cancel/Clear）+ RouteThemeSelector 扩 "自定义…" option + ✎ 编辑按钮 + PlayerShell wiring / 5 业务+测试 PATCH=5 严守 + 1 docs sync / 54/54 单测 PASS（route-theme-storage 20 + line-display-name-themes 34 既有零回归）/ typecheck + lint + verify:adr-contracts 全 PASS EXIT=0 / docs/manual §8.7 "未实装" → "已 ship 2026-05-28"完整规范化 | 否 | sonnet-4-6 |
| 3 | ✅ **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| listAdminSources SELECT LEFT JOIN source_line_aliases + 返回 codename + retired_at + ContentSourceRow 类型扩 2 字段 / Layer B 数据通路打通 / 2 业务 + 1 测试 PATCH=3 / typecheck + lint + verify + 34/34 admin-sources 域测试 PASS / PRE-INDEX-DESIGN-RULES 4 步核验首次显式应用 | 否 | sonnet-4-6 |
| 4 | ✅ **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 arch-reviewer (claude-opus-4-7) agentId a8f0bb30cc856631f）| LinesPanel 退役标识区分"（已退役·自动）/（已退役·手动）" / LineAggregate 扩 autoRetired + Y-A-1 invariant JSDoc + Y-A-2 派生字段集注释升级 + 数据通路（SQL + ContentSourceRow + RawSourceRow + aggregate + UI 文案 + aria-label + data-line-retired-auto） / Opus A- CONDITIONAL → 0 红线 + Y-A-1/Y-A-2 全落升 A / PATCH=6 超 5 接受完成度风险（同源不变式原子提交） / 53/53 测试 PASS / typecheck + lint + verify 全 EXIT=0 / ADR-164 D-164-8 UI 兑现 | 否（ADR-164 advisory）| sonnet-4-6 + arch-reviewer (opus-4-7) |
| 5 | ⛔ **CHG-SN-9-MOD-BUTTON-MIGRATE** DEFERRED（2026-05-28 / 用户决策方案 A）| plan §5 P2 / BTN_* → AdminButton 机械迁移 / 实测 38 tsx 文件 / 100+ raw button 远超 PATCH 5 软上限 / 独立 SEQ-FOLLOWUP-MIGRATE 长尾系列择期推进 / 非 Wave 3 节奏 | 否 | (deferred) |
| 6 | ✅ **CHG-SN-9-REJECTED-ENHANCE-A** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| plan §5 P2 拆 -A 分页 / useRejectedQueue.ts NEW 152 行（仿 usePendingQueue 精简 / page+limit + activeIdx near-end loadMore + sessionStorage 持久化 + length > 5 守卫修 spurious bug）+ RejectedTabContent 接入 hook + listHeader 升级 + 加载更多 UI / 3 业务 + 1 测试 + 1 i18n PATCH=5 严守 / 8/8 useRejectedQueue 测试 PASS / typecheck + lint + verify 全 EXIT=0（含 verify-style-shorthand-conflict 1 处 LOAD_MORE_BTN border 冲突修复）/ -B 视觉对齐留 follow-up | 否 | sonnet-4-6 |
| 7 | ✅ **CHG-SN-9-PLAYER-ERROR** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 arch-reviewer (claude-opus-4-7) agentId a13a505e2bb192667）| plan §5 P3 / player-core onError + suppressDefaultErrorUI public API / Opus A- CONDITIONAL → 3 红线 R-N-1/-2/-3 全落 + 4 黄线 3 落 1 留 RETRY-CONTROL follow-up / 升 A / PATCH=5 严守 (types + Player + orchestration + overlay + sourceLoader 4 业务 + 1 测试) / 6/6 buildOverlayEntries 测试 PASS / typecheck + lint + verify 全 EXIT=0 / DEBT-FIX-D-ERROR API 端闭环 / ADR-108 兑现 / 消费方接入留 3 follow-up 卡（CONSUMER-A/B + RETRY-CONTROL）| 否（演进式接口扩展）| sonnet-4-6 + arch-reviewer (opus-4-7) |
| 8 | ⛔ **CHG-SN-9-META-BANGUMI-A** DEFERRED（2026-05-28 / 用户决策组合 X / 与 plan §13 "Bangumi 暂缓 / 留下一轮迭代" 一致）| plan §10.4.2 方案 A / Bangumi 实时 API 集成（BangumiService + secrets + ADR 起草 + 新依赖）/ 下次会话恢复入口 | 是（新 ADR）| (deferred) |
| 9 | ⛔ **CHG-SN-9-SITE-VIEWS-EXTRACT** DEFERRED（2026-05-28 / 用户决策组合 X / 独立 SEQ-FOLLOWUP-ARCH 长尾架构系列择期推进 / 非 Wave 节奏）| plan §10.6 方案 C / 抽 `packages/site-views`（跨 app 重构 / 共享层沉淀 / 大型）/ CLAUDE.md §16.5 "跨 app 影响范围扩大" BLOCKER 触发已规避 | 是（架构 ADR）| (deferred) |
| 10 | ✅ **CHG-SN-9-ROUTE-LABEL-D-ADR** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 arch-reviewer (claude-opus-4-7) agentId a6c323d228d26d12d）| plan §17.2 Wave 3 / `users.preferences` schema + 跨设备主题同步 + 端点 / ADR-165 起草 + Opus A- CONDITIONAL → 5 红线 + 4 P1 黄线 + 2 关键洞察全消化 → 升 Accepted / 1 docs PATCH=1 / 实施由 -A1（后端）+ -A2（前端）2 子卡承接 各 PATCH≤5 / 双红线触发 Subagents trailer | 是（ADR-165 ✅ Accepted）| sonnet-4-6 + arch-reviewer (opus-4-7) |
| 10.1 | ✅ **CHG-SN-9-ROUTE-LABEL-D-A1** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| ADR-165 §11 后端实施：Migration 080 inline CHECK + user.types.ts 5 zod schema + CUSTOM_THEME_CONSTRAINTS 迁移 + types/index.ts runtime exports + userPreferences queries NEW + UserPreferencesService NEW + users.ts 2 端点 / 4 业务 + 1 测试 PATCH=5 + 1 architecture.md §5.14 sync / 8/8 测试 PASS / typecheck + lint + verify 全 EXIT=0 / D-165-1/-2/-3/-9 后端层闭环 | 否（ADR-165 已 Accepted）| sonnet-4-6 |
| 10.2 | ✅ **CHG-SN-9-ROUTE-LABEL-D-A2** 已完成（2026-05-28 / 主循环 claude-sonnet-4-6 / 子代理 无）| ADR-165 §11 前端实施：useUserPreferencesSync NEW 含 mount GET + debounce PUT + sessionStorage retry + syncing 状态 / route-theme-storage 改造 CUSTOM_THEME_CONSTRAINTS 真源迁移 + handleRemoteValue + setTheme/setCustomTheme/clearCustomTheme 触发 putValue / RouteThemeSelector syncing prop + select/✎ disable + 视觉降级 / PlayerShell wiring / 7/7 hook 测试 + 既有 54/54 零回归 / docs/manual §8.4a 升级"已 ship" / PATCH=6 接受完成度风险（同源原子提交理由）/ ADR-165 D-165-4/-5/-6/-7/-8/-11 前端层闭环 / **ADR-165 全 11 D-N 闭环** | 否（ADR-165 已 Accepted）| sonnet-4-6 |

### Wave 3 BLOCKER 触发清单（沿用 Wave 1/2 §16.5）

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围超出卡片定义（改动 > 卡片范围 5 项）
- ADR 起草卡 Opus 评审 BLOCKER 红线未消解
- schema migration 冲突
- 人工已审核 Wave 报告未通过

### ✅ BLOCKER 已解除（2026-05-28 / 用户决策方案 A）

**原 BLOCKER 触发**：CHG-SN-9-MOD-BUTTON-MIGRATE 范围 38 tsx 文件 / 100+ button 远超 PATCH 5 软上限。
**用户决策（2026-05-28）**：方案 A（推荐 / 务实）—— 跳过本卡转 CHG-SN-9-REJECTED-ENHANCE-A / MOD-BUTTON-MIGRATE 独立 SEQ-FOLLOWUP-MIGRATE 长尾系列择期推进 / 非 Wave 3 节奏。
**主循环恢复**：从 CHG-SN-9-REJECTED-ENHANCE-A（plan §7 -A 分页子卡）继续。CHG-SN-9-REJECTED-ENHANCE-B（视觉对齐）留 follow-up。

---

### ✅ BLOCKER #2 已解除（2026-05-28 / 用户决策组合 X）

**原 BLOCKER 触发**：Wave 3 剩余 3 卡 BANGUMI-A / SITE-VIEWS-EXTRACT / ROUTE-LABEL-D 推进策略待决策。
**用户决策（2026-05-28）**：组合 X（推荐 / 务实）—— BANGUMI-A 跳过（与 plan §13 用户既有"暂缓"决策一致）+ SITE-VIEWS-EXTRACT DEFERRED（独立 SEQ-FOLLOWUP-ARCH 长尾架构系列）+ ROUTE-LABEL-D 推进（起 ADR + Opus 评审 + 实施）→ Wave 3 收官 7/10 + 2 DEFERRED + 1 MOD-BUTTON-MIGRATE DEFERRED（共 3 DEFERRED）。
**主循环恢复**：从 CHG-SN-9-ROUTE-LABEL-D-ADR（ADR-165 起草卡 / Opus 评审）继续。

### 🗃️ 原 BLOCKER #2 内容（归档 / 已决策）

**触发位置**：Wave 3 SEQ-20260528-MOD-WAVE3 #8 CHG-SN-9-META-BANGUMI-A 启动前
**触发原因**：剩余 3 卡（BANGUMI-A / SITE-VIEWS-EXTRACT / ROUTE-LABEL-D）需用户决策推进策略 + plan §13 已有相关决策线索
**主循环当前进度**：Wave 3 SEQ 6/10 完成 + 1 DEFERRED（PRE-INDEX-DESIGN-RULES + CHG-369-B + 2 FOLLOWUP + REJECTED-ENHANCE-A + PLAYER-ERROR / MOD-BUTTON-MIGRATE DEFERRED）

**剩余 3 卡推进策略待决策**：

#### 卡 #8 CHG-SN-9-META-BANGUMI-A

- **plan §10.4.2 + §14 Wave 3 卡片**：Bangumi 实时 API 集成 / BangumiService + secrets / 新依赖 / Opus 决策
- **plan §13 用户既有决策**："§10.4.2 Bangumi - D. 暂缓 - **本轮不集成 Bangumi** - 留下一轮迭代"
- **冲突点**：Wave 3 §14 仍列入此卡（plan 侧"长期可做"），但 plan §13 用户决策已标"暂缓"
- **推进选项**：
  - **方案 A**（默认 / 与 plan §13 一致）：跳过此卡转 #9 SITE-VIEWS-EXTRACT / META-BANGUMI-A 标 DEFERRED 入"下次会话恢复入口"
  - **方案 B**：撤销 plan §13 暂缓决策 / 推进此卡 / 起 ADR 草稿 + Opus 评审

#### 卡 #9 CHG-SN-9-SITE-VIEWS-EXTRACT

- **plan §10.6 方案 C + §14 Wave 3**：抽 `packages/site-views` / **架构级大型重构** / 跨 app 影响范围扩大
- **CLAUDE.md §16.5 BLOCKER 触发**："跨 app 影响范围扩大" 是 BLOCKER 触发清单项 → 本卡本质即需用户确认
- **范围预估**（基于 plan §10.6 方案 C）：抽前台 web-next/_lib/player + admin server-next/_client/PendingCenter 共享 view 层 → 新 package + 跨 3 个 app 配置 + 大量类型迁移
- **风险**：单 Wave 内推进会主导节奏；可能产生 3-5 commit 周期；视觉/类型回归风险高
- **推进选项**：
  - **方案 A**（推荐 / 务实）：DEFERRED → 独立 SEQ-FOLLOWUP-ARCH 长尾系列 / 非 Wave 3 节奏
  - **方案 B**：推进 / 起 ADR 草稿 + Opus 跨 app 评审 + 拆 -A/-B/-C 子卡

#### 卡 #10 CHG-SN-9-ROUTE-LABEL-D

- **plan §17.2 Wave 3 增补 + §14 Wave 3**：`users.preferences` schema + 跨设备主题同步端点
- **依赖**：CHG-369（5 内置主题）+ CHG-369-B（自定义主题输入）已 ship → 跨设备同步是 Phase 3 / 自然延续
- **范围预估**：Migration NNN（users.preferences JSONB schema）+ 端点 GET/PUT preferences + web-next useRouteTheme hook 改造支持登录态同步 + ADR
- **风险**：需新 ADR 起草 + Opus 评审 + schema migration + users 表写入路径（CLAUDE.md "未登录请求路径中访问 users 表"红线 / 需注意）
- **推进选项**：
  - **方案 A**（推荐）：推进 / 起 ADR 草稿 + Opus 评审 + 实施
  - **方案 B**：DEFERRED → 入"下次会话恢复入口" / 等用户主动决策（CHG-369 设计取舍 ⑤ 已标 "Wave 3 跨设备同步" 预期）

**推荐组合**：
- **组合 X**（推荐 / 最务实）：BANGUMI-A 跳过（A）+ SITE-VIEWS-EXTRACT DEFERRED（A）+ ROUTE-LABEL-D 推进（A）= Wave 3 收官（7/10 + 2 DEFERRED + 1 推进）
- **组合 Y**（激进）：BANGUMI-A 推进（B）+ SITE-VIEWS-EXTRACT 推进（B）+ ROUTE-LABEL-D 推进（A）= Wave 3 完整 9/10 + 1 DEFERRED / 但工作量极大 / 多个 Opus 子代理
- **组合 Z**（保守）：全部 DEFERRED → Wave 3 6/10 + 4 DEFERRED 直接收官

请用户在此 BLOCKER 下方写组合选择（X / Y / Z / 自定义），解除 BLOCKER 后主循环继续。

### 关键依赖图

```
长尾清理：PRE-INDEX-DESIGN-RULES（独立 docs） → CHG-369-B（独立 UI）
                                              → CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW（独立类型）
                                              → CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL（依赖 -CONTENT-SOURCE-ROW）

Wave 3 主线：MOD-BUTTON-MIGRATE → REJECTED-ENHANCE（独立 UX）
            PLAYER-ERROR（player-core API 扩展 / Opus）
            META-BANGUMI-A（新 ADR / 新依赖 / Opus）
            SITE-VIEWS-EXTRACT（架构 ADR / 大型 / Opus）
            ROUTE-LABEL-D（schema ADR / 后端 + 前端同步 / Opus）
```

执行序列建议：**PRE-INDEX-DESIGN-RULES → CHG-369-B → -FOLLOWUP-CONTENT-SOURCE-ROW → -FOLLOWUP-AUTO-RETIRED-LABEL → MOD-BUTTON-MIGRATE → REJECTED-ENHANCE → PLAYER-ERROR → META-BANGUMI-A → SITE-VIEWS-EXTRACT → ROUTE-LABEL-D**

---

## [SEQ-20260528-MOD-WAVE4] server-next Wave 4 — Wave 3 follow-up 收尾 + Layer B 退役 worker 闭环（W4-务实方案）

- **状态**：✅ **完全收官（用户签字 2026-05-29）= 100%**（验收报告 `docs/manual/wave-4-acceptance.md` §9 PASS）/ 实施期 6/6 + 7 拆卡（4-ADR / 4-EP / 5-A / 5-B）+ **8 Codex stop-time review FIX 全闭环** + arch-reviewer Opus 2 次评审 + **用户验收返工 1 轮 4 finding 全消化（FIX-1/2/3 + Codex FIX-4）** / 17 commits / 1 ADR 起草并 Accepted（ADR-166）/ 1 ADR 完整链路闭环（ADR-164 D-164-8）
- **创建时间**：2026-05-28
- **收官时间**：2026-05-29
- **用户验收签字**：2026-05-29 PASS（"wave 4 可以通过"）
- **目标**：基于 Wave 3 实施期累积的 5 张 follow-up 卡 + plan §10.5 Layer B 退役 worker（A-164-1 占位）/ 短小精悍 / ~1-2 周完成 / 收尾 Wave 3 设计取舍推出的接入路径，让 player-core / route-labeling / rejected 三个域完整闭环。
- **范围**：消费方接入 + worker 实施 + 视觉对齐（不含 SITE-VIEWS-EXTRACT 大型重构 / 不含 BUTTON-MIGRATE 长尾 / 不含 BANGUMI-A 用户暂缓）
- **执行约束**：沿用 Wave 1/2/3 §16.1-16.5（UI/UX 谨慎 / docs/manual 同步 / 主循环全自动 + BLOCKER 触发清单）
- **建议主循环模型**：`claude-sonnet-4-6`（多数消费方接入）+ `claude-opus-4-7`（RETRY-CONTROL 跨 Opus / DEAD-LINE-WORKER 触发新依赖评估）
- **依赖**：Wave 3 已签字验收（2026-05-28）/ ADR-108 + ADR-164 + 既有 player-core onError + suppressDefaultErrorUI public API + listAllSourceLines + MOUNTAIN_CODENAMES + Migration 079 + auto_retired 字段全部已 ship

### 任务列表（按执行序列）

| # | TASK-ID | 标题 | ADR | 建议模型 |
|---|---|---|---|---|
| 1 | ✅ **CHG-SN-9-REJECTED-ENHANCE-B** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 3 #6 follow-up / plan §7 拆 -B 视觉对齐：BTN_SM → AdminButton(×5) + SplitPane 两栏 + AdminCheckbox 行勾选 + sticky 批量栏 + 客户端循环 batchReopen + useToast 跳回 pending 提示 / 共享原语占比 ~10% → ~75% / PATCH=4 ≤ 5 / useRejectedQueue 11/11 PASS（既有 8 + 新 3 toggle/batchAllSuccess/batchPartialFail）/ typecheck+lint+verify 全 EXIT=0 / E2E `重新开审` 选择器仍兼容（AdminButton 透传 aria-label）/ 预存基线失败 use-filter-presets 与本卡无关 | 否 | sonnet-4-6 |
| 2 | ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-A** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 3 #7 follow-up / AdminPlayer 接入 player-core onError + POST /v1/feedback/playback {success:false, errorCode} / DEBT-FIX-D-ERROR 真正闭环 / errorReportedRef 独立去抖（防 fatal 刷流量）/ PlayerProps['onError'] 反推类型避免 player-core 顶层 export 触发 Opus / PATCH=2 ≤ 5 / 13/13 admin-player 测试 PASS（既有 8 + 新 5 含 native/hls/dedup/sourceId 切换/success→fail 切换）/ typecheck+lint+verify 全 EXIT=0 | 否 | sonnet-4-6 |
| 3 | ✅ **CHG-SN-9-PLAYER-ERROR-CONSUMER-B** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 3 #7 follow-up / PlayerShell VideoPlayer onError → 标 isDead + 环形扫描下一非 dead/pending source + setActiveSourceIndex + bump playerVersion + POST feedback 上报失败（受 isPlaybackFeedbackEnabled previewMode 守卫）+ per-(sourceId, errorCode) 去抖防 fatal 刷流量 / R-N-3 警告闭环（不用 event.src 而用 activeSourceIndex 关联）/ PlayerProps['onError'] 反推类型避免动 player-core 顶层 export / PATCH=2 ≤ 5 / 4/4 player-shell-on-error 测试 PASS（含 #1 切线+POST / #2 previewMode 不 POST / #3 同键去抖 / #4 切线后新闭包 sourceId=src-2）/ typecheck+lint+verify 全 EXIT=0 / 预存基线失败 hydration #1 与本卡无关（git stash 验证） | 否 | sonnet-4-6 |
| 4 | ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-ADR** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer (claude-opus-4-7) A- CONDITIONAL）| Wave 4 #4-ADR / Opus arch-reviewer 评审结论：方案 A' onError(event, controls) 收敛版（仅 retry / 删 suppressDefault）/ 3 红线 R-166-1/2/3 全部消化 + 5 P1 黄线 Y-166-1/2/4/5 + 边界 Y-166-3/6 留 -EP / ADR-166 Accepted / wrap 策略让 useSourceLoader + usePlayerOrchestration 类型不动（PATCH 4 文件 ≤ 5）/ retry-control 5/5 PASS（含同步 retry / 异步守卫 + dev warn / 切 src 守卫 / 新 controls 实例 / data-retry-attempt 计数）/ 既有消费方 17/17 PASS（非破坏性变更确认）/ typecheck + lint + verify 全 EXIT=0 | **是 ADR-166** | opus-4-7 + arch-reviewer |
| 4b | ✅ **CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 4 #4-EP / 评审后拆卡 / AdminPlayer 加"重试此线路"按钮 + sourceLoadVersion bump 强制 Player remount（Y-166-6 边界 / 不用 controls.retry）+ PlayerShell handlePlayerError 重写：首次 fatal 同 tick 调 controls.retry + retryAttemptedSetRef per-idx 计数 + 3s watchdog setTimeout / watchdog 超时主动切线 / onPlay 成功 cancel watchdog + 清计数 / 第二次 fatal 立即切线（Y-166-3 shell 层策略）/ switchAwayFromFailedSource 抽出 useCallback 供 watchdog + 二次 fatal 共用 / PATCH=4 ≤ 5 / admin-player 15/15 + player-shell-on-error 6/6 + retry-control 7/7 = 28/28 PASS / typecheck+lint+verify 全 EXIT=0 | 否（依赖 ADR-166 Accepted）| sonnet-4-6 |
| 5-A | ✅ **PRE-DEAD-LINE-AUTO-RETIRE-WORKER-A** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 / 子代理 arch-reviewer (claude-opus-4-7) A- CONDITIONAL）| Wave 4 #5-A / Opus 评审推方案 D'（dead_since 加 alias 表 / worker 自维护 / 不动 probe/render 写路径）/ 拆卡-A schema+queries+docs 5 文件 / R-DEAD-1 段 2/3 双独立 SQL + R-DEAD-2 LEFT JOIN+orphan 显式清 NULL + R-DEAD-3 pg_try_advisory_lock 非阻塞 + finally unlock + R-DEAD-4 RETURNING+结构化日志（worker -B 承接）/ 不起 ADR-167（D-164-8 + 评审报告已足）/ Migration 081 ship + auto-retire-line.ts queries（DEAD_THRESHOLD_DAYS=180 + RETIRE_BATCH_LIMIT=50 const 导出）+ 6/6 queries 测试 PASS（含 R-DEAD-1/2/3/4 全覆盖 + advisory lock 拿不到锁路径 + 抛错 finally unlock 路径）+ architecture.md §source_line_aliases 加 dead_since 字段 + 部分索引 + docs/manual/auto-retire-line-worker.md NEW（dead_since 状态机 + cron 03:30 + batch 50 + 误报恢复 SQL + 不触发 R-MID-1 解释）/ typecheck+lint+verify 全 EXIT=0 | 否（D-164-8 已 Accepted）| opus-4-7 + arch-reviewer |
| 5-B | ✅ **PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 4 #5-B / worker 层 4 文件 / apps/worker/src/jobs/auto-retire-line.ts NEW 跨 app import 复用 -A query 单点真源 + structured log per row (auto_retire_line.retired) + batch_total metric / cron.autoRetireLine '30 3 * * *' ENV 覆盖 / index.ts 注册 cron + startup/shutdown / 5/5 worker job 测试 PASS (T1 调 query+log / T2 空数组 batch_total=0 不抛错 / T3 N=5 边界 / T4 query 抛错向上抛 / T5 retired_at 共享 ISO) / 既有 -A 测试 10/10 + worker 共 15/15 无回归 / typecheck+lint+verify 全 EXIT=0 | 否（依赖 -A ship + ADR-164 D-164-8 Accepted）| sonnet-4-6 |
| 6 | ✅ **CHG-SN-9-WAVE3-FOLLOWUP-CODENAME-MATRIX-E2E** 已完成（2026-05-28 / 执行模型 claude-opus-4-7 偏离建议 sonnet-4-6 / 子代理 无）| Wave 3 验收期补丁 CODENAME-MATRIX e2e 测试补全 / tests/e2e/admin/sources/codename-matrix-picker.spec.ts NEW playwright 4 case（① page-load 行渲染 + matrix open + 5 山名 testid 可见 ② available-pick PUT codename + modal close ③ occupied-suggest modal 弹 + accept PUT codename-N ④ cooling-disabled button disabled + 强点不触发 PUT）/ docs/manual/route-labeling.md §9.10 CODENAME-MATRIX-PICKER 完整文档（单元格内联分配 + 3 态状态机 + 后缀建议算法 + 3 flow）+ §9.11 e2e 测试映射 / mock 数据 4 行（占用泰山 / 占用华山-1 / 未分配 youku/默认 / 退役 30 天衡山）/ 4 spec 已 playwright --list 注册 / typecheck+lint+verify 全 EXIT=0 | 否 | sonnet-4-6 |

### Wave 4 BLOCKER 触发清单（沿用 Wave 1/2/3 §16.5）

- typecheck / lint / test / verify 报错 + 自动修复失败
- 任务范围超出卡片定义（改动 > 卡片范围 5 项）
- ADR 起草卡 Opus 评审 BLOCKER 红线未消解
- schema migration 冲突
- 跨 app 影响范围扩大 / 引入新依赖（worker 卡可能触发 / 需用户确认）
- 人工已审核 Wave 报告未通过

### 关键依赖图

```
REJECTED-ENHANCE-B (独立 UI / 不依赖)
PLAYER-ERROR-CONSUMER-A (依赖 Wave 3 PLAYER-ERROR public API ✅)
PLAYER-ERROR-CONSUMER-B (同上)
PLAYER-ERROR-RETRY-CONTROL (依赖 CONSUMER-A/B 接入实证 / 建议放在 -A/-B 之后)
DEAD-LINE-AUTO-RETIRE-WORKER (依赖 Migration 079 ✅ + LinesPanel auto_retired UI ✅)
CODENAME-MATRIX-E2E (依赖 Wave 3 验收期补丁 CODENAME-MATRIX ✅)
```

执行序列建议：**REJECTED-ENHANCE-B → PLAYER-ERROR-CONSUMER-A → PLAYER-ERROR-CONSUMER-B → PLAYER-ERROR-RETRY-CONTROL（ADR-166）→ DEAD-LINE-AUTO-RETIRE-WORKER → CODENAME-MATRIX-E2E**

### 范围外（明确不纳入 Wave 4）

- **SEQ-FOLLOWUP-MIGRATE**（Wave 3 BLOCKER 方案 A）：BTN_* → AdminButton 38 文件长尾迁移 / 独立 SEQ 择期推进 / 非 Wave 节奏
- **SITE-VIEWS-EXTRACT**（Wave 3 组合 X）：plan §10.6 架构重构 / 独立 SEQ-FOLLOWUP-ARCH / Opus 大型评审
- **META-BANGUMI-A**（plan §13 用户暂缓）：下一轮迭代再评估
- **跨用户分享自定义主题**（ADR-165 §2 范围外）：远期 Phase 5 / 独立 schema / 独立 ADR
- **preferences 字段版本控制**（Y-165-3 + §10 风险 5）：字段数 ≥ 3 触发 / 当前 1 字段不需
- **BroadcastChannel 跨 tab preferences**（Y-165-5）：Phase 4 评估 / 当前 last-write-wins 兜底

---

## [SEQ-20260529-01] Bangumi PR follow-up — metadataProvenance SQL 列数 bug + step2 三元 undefined NOT NULL 违规

- **状态**：✅ 已完成（2026-05-29 04:59 / 同 PR 双卡实施 + arch 防御兜底）
- **创建时间**：2026-05-29 04:09
- **最后更新时间**：2026-05-29 04:59
- **目标**：收口 Bangumi PR #1/#3 merge 后用户决策的两张 pre-existing P2 follow-up 卡 — (1) `batchUpsertFieldProvenance` SQL 列数 / 占位符不匹配（META-06 引入至今 provenance 静默失败）；(2) `MetadataEnrichService.step2NetworkSearch` 三元 `: undefined` 模式 + safeUpdate/updateCatalogFields 无 undefined skip → 5 个 NOT NULL TEXT[] 列写 null 违规
- **范围**：apps/api/src/db/queries/metadataProvenance.ts + apps/api/src/services/MetadataEnrichService.ts + 单测/集成测试
- **依赖**：无（PR #1/#2/#3 已 merge；两卡互相独立可并行）
- **建议主循环模型**：`claude-sonnet-4-6`（机械性 bug 修复，无架构决策）
- **来源**：PR #1（Bangumi.tv 接入 / merged `279889d7`）+ PR #2/#3（confirmMatch 事务化 + Codex 第 2 轮修订 / merged `ceff35d2` / `744d4c4a`）；Codex 第 4 轮 review 误判 CHORE-11 不可复现，主循环深查 trace 后**确认 PR #1 Known Issues #3 是真 bug**（详情见 CHORE-11 验收要点）

### 任务列表（按执行顺序）

1. **CHORE-10** — 修 `metadataProvenance.ts:94-96` SQL INSERT 列数 / 占位符不匹配（状态：✅ 已完成）
   - 创建时间：2026-05-29 04:09
   - 计划开始：（待主循环按优先级排程）
   - 实际开始：2026-05-29 04:35
   - 完成时间：2026-05-29 04:55
   - 修法：(b) INSERT 列删 `updated_at`（schema `TIMESTAMPTZ NOT NULL DEFAULT NOW()` 自动生效）；ON CONFLICT UPDATE 仍显式 `updated_at = NOW()`
   - 测试：tests/unit/api/metadataProvenanceQueries.test.ts 新建 4 用例（单字段 5 占位符 / 多字段 N=3 占位符 (3×5=15) / sourceRef=null / 空数组早返回）
   - 验收要点：
     - INSERT 列出 6 列 `(catalog_id, field_name, source_kind, source_ref, source_priority, updated_at)` 但 values 数组每行只生成 5 个占位符 `($1..$5)`，未追加 `NOW()`。Postgres 报 `INSERT has more target columns than expressions`，整个 `batchUpsertFieldProvenance` 抛错。caller `MediaCatalogService.safeUpdate:235-251` 用 `void ... .catch(stderr)` 静默失败，所以 catalog 主写入不阻塞，但 **所有 provenance 写入从未真正落地**（META-06 引入至今）
     - 修法二选一：(a) values 末尾补 `NOW()` 第 6 占位符；(b) INSERT 列去掉 `updated_at` 让 DB 默认值生效
     - 补单测覆盖 `batchUpsertFieldProvenance` 多行写入后 SELECT 验真有数据（既有测试只 mock query 未验集成）
     - changelog.md 顺便标记"META-06 引入至今所有 provenance 写入实际未落地"历史 bug 闭环
   - 优先级：P2 / 建议模型：sonnet-4-6

2. **CHORE-11** — 修 `MetadataEnrichService.ts:199-210` step2 三元 `: undefined` 模式 → 5 个 NOT NULL TEXT[] 列写 null 违规（状态：✅ 已完成）
   - 创建时间：2026-05-29 04:30
   - 计划开始：（待主循环排程；与 CHORE-10 可并行）
   - 实际开始：2026-05-29 04:40
   - 完成时间：2026-05-29 04:58
   - 修法：双修 (a)+(b)：
     - (a) **主修**：MetadataEnrichService.ts:199-228 step2 改条件赋值范式（同 step1 imdb / step1b title_norm / DoubanService.ts:104-118 既有正确模式），消除三元 `: undefined`
     - (b) **防御兜底**：mediaCatalog.mutations.ts:155-160 `updateCatalogFields` 加 undefined skip：`if (key in data && data[key] !== undefined)`，同时去掉 `?? null`（显式 null 仍正常写入支持 nullable 列清空语义）
   - 测试：tests/unit/api/mediaCatalogMutationsUndefinedSkip.test.ts 新建 6 用例（writers undefined skip / 5 列全 undefined skip / 显式 null 写入 / 混合 undefined+有效值 / 空数组 [] 合法 / 全 undefined 走早返回 SELECT）
   - 验收要点：
     - **真 bug 验证（深查 trace 后确认 PR #1 Known Issues #3 是真，但描述需校正）**：
       - 路径：`MetadataEnrichService.step2NetworkSearch:199-210` （不是 DoubanService.ts:104-118 / 后者用条件赋值风格安全）
       - 触发：`getDoubanDetailRich` 返回的 `detail.directors/cast/screenwriters/genres` 任一为 `[]` 时；mobile-api fallback（`mobile-api.ts:180`）写死 `screenwriters: []` 是高频触发器（challenge_page bypass 失败 / HTTP 429 / 302 / 301 都走 fallback）
       - 链路：`{writers: detail.screenwriters.length > 0 ? detail.screenwriters : undefined}` → JS object literal 中 `writers` property 存在且 value 为 undefined → safeUpdate Object.entries 包含 ['writers', undefined] → 无 undefined skip → updateCatalogFields `'writers' in data` = true → `data.writers ?? null` = null → `UPDATE ... SET writers = null` → schema `writers TEXT[] NOT NULL DEFAULT '{}'` 违反
       - **影响面 5 列**（不只是 writers）：director / cast / writers / genres / genres_raw 全是 `TEXT[] NOT NULL DEFAULT '{}'`（migration 026 + 031）
     - 修法两选一（建议 a + b 并行；不互斥）：
       - (a) **主修**：MetadataEnrichService.ts:199-210 改条件赋值风格（同 step1 imdb path / step1b normalized path / DoubanService 三处既有正确范式），消除三元 `: undefined` 模式
       - (b) **防御兜底**：`updateCatalogFields` 内 `if (key in data)` 改为 `if (key in data && data[key] !== undefined)`，或 `safeUpdate` filter 阶段 skip undefined value——任选其一防未来 caller 同样误用
     - 补集成测试：mock mobile-api fallback 路径 → 验 step2NetworkSearch 端到端不污染 catalog；补单测覆盖 updateCatalogFields 收到 `{writers: undefined}` 应 skip 而非写 null
     - 修后跑一遍 `MetadataEnrichService.enrich` 完整链路（豆瓣→Bangumi 优先级覆盖）补齐 PR #1 Phase 1 因此 bug 跳过的验收
   - 优先级：P2 / 建议模型：sonnet-4-6

### 关键约束

- 两卡互相**无依赖**，可同 worktree 顺序或独立 worktree 并行
- **不引入新依赖**（违反 CLAUDE.md 触发 BLOCKER）
- CHORE-10/-11 都不动 schema / migration（DB 层面零变更）
- 修后必须跑 CLAUDE.md §必跑命令全集 `npm run typecheck` + `npm run lint` + `npm run test -- --run` + `npm run verify:adr-contracts` 全绿（test 必须**全量套件**，不得窄化到 tests/unit/api 子集——避免非 API 模块回归被遗漏）
- 完成后顺序：填写完成备注 → 更新本卡状态 + 时间戳 → 更新本序列「最后更新时间」→ 删除 tasks.md 卡片 → 追加 changelog → git commit

### 编号校验

- **SEQ-20260529-01**：当前无 SEQ-20260529-* 占用（`grep -rohE 'SEQ-20260529-[0-9]+' docs/` 全树 0 命中）
- **CHORE-10/-11**：既有 CHORE 占用 CHORE-01..09（CHORE-01..08 in `docs/archive/task-queue/task-queue_archive_20260427.md` / CHORE-09 in `docs/archive/changelog/changelog_m0-m6.md`）；按"同前缀最大编号递增"取 10、11

### Codex stop-time review 关联

本 SEQ 经 8 轮 Codex stop-time review + 用户深查迭代收敛：
1. 第 1 轮 抓 CHORE-01/02 复用 archive 占用编号 → 改 CHORE-10/11
2. 第 2 轮 抓 task-queue invariants 违规（SEQ ID 格式 / 缺时间戳 / 时间格式） → 全部修正
3. 第 3 轮 抓 `计划开始` 字段时间格式 → 改非日期占位
4. 第 4 轮 误判 **CHORE-11 描述不可复现**（只看 DoubanService.ts:112 + mobile-api `screenwriters: []` + `length > 0` 守卫，结论"无 null 路径"）+ checks 列表缺 `npm run lint` → 当时配合删 CHORE-11 + 补 lint
5. 第 5 轮 抓 `⬜ 待启动` 非 canonical → 改 `⬜ 待开始`
6. 第 6 轮 抓 test 命令窄化到 api 子集 → 改全量
7. 第 7 轮 ✅ No actionable issue found
8. **用户复审**：要求更多信息判断"关键发现"。主循环深查 trace：MetadataEnrichService.ts:199-210 step2NetworkSearch 用三元 `: undefined` 模式而非条件赋值，`{writers: undefined}` 经 safeUpdate（无 undefined skip）→ updateCatalogFields（`undefined ?? null` = null）→ SQL `writers = null` → 违反 `writers TEXT[] NOT NULL` → **PR #1 Known Issues #3 是真 bug**，影响 5 列（director/cast/writers/genres/genres_raw），第 4 轮 Codex + 主循环当时漏看了 MetadataEnrichService 路径 → **重立 CHORE-11**

原始 review thread：`019e7344-a3b1-7c13-8c80-d38f34073c45`（PR #3 评审）。

---

## [SEQ-20260530-04] 外部富集数据基建补齐（dump 导入 + 队列恢复 + 重富集）

- **状态**：✅ 已完成（2026-05-31 / META-15-B/C/D + META-17（+ follow-up META-20/META-22）全 ship；META-15-A TMDB ⛔DEFER（百万孤儿 catalog + 无定向回填路径，待「TMDB API」一并）；META-15-C 全量 backfill 工具就绪，全量运行交用户在本地 worker 执行）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-31
- **目标**：解决「富集徽标全灰」根因——外部源 dump 从未导入 + Redis/worker 未跑 → 富集命中率 ~0.2%（2751 视频仅 6 douban matched / 0 bangumi matched / 0 tmdb / 0 imdb）。
- **根因诊断（已查实）**：① `external_douban_movies_raw`/`external_tmdb_movies_raw`/`external_bangumi_subjects_raw`/`external_imdb_tmdb_links`/`external_import_batches` 全 0 行（dump 未导入）② `redis-cli ping` 无响应 + 无 worker 进程 → 72%（1966）从未富集 ③ 785 个跑过富集的里 782 个 douban unmatched（本地 dump 空，仅靠 step2 网络偶中）。
- **资产盘点**：✅ TMDB dump 文件已在 `external-db/tmdb/[124万]TMDB电影元数据.csv`（未导入）；❌ 豆瓣 dump 缺失（脚本默认 `external-db/douban/moviedata-10m/movies.csv`）；❌ Bangumi dump 缺失但 `BANGUMI_API_TOKEN` 已配（REST 可用）；✅ douban_cookie/proxy 已在 system_settings。

### 任务列表（按收益排序）

1. **META-15-A** — 导入 TMDB dump（状态：⛔ **DEFER**（2026-05-30 排查））
   - **不做原因**：`buildCatalogFromTmdb` 对 1.24M 行逐行 findOrCreate → 建百万孤儿 catalog；且**无「现有视频↔tmdb」回填路径**（富集不碰 tmdb）。TMDB logo 点亮需先设计「定向回填」（按 imdb/title 匹配现有视频），等做「TMDB API」时一并。
2. **META-15-B** — 起 Redis + worker（状态：✅ **已验证** 2026-05-30）
   - 用户起 redis + dev server；富集消费者在 **apps/api** `server.ts:194 registerEnrichmentWorker`（非 apps/worker，后者是 cron）。海贼王 douban + 师兄啊师兄 bangumi 端到端富集通过。
3. **META-15-C** — 批量重富集 backfill 脚本（状态：✅ **工具就绪** 2026-05-31 / claude-opus-4-8 / 子代理无 / 门禁全过 / 5 新单测 / 全量 5774 passed）
   - `EnrichJobData += trigger?` + worker 日志 + `listVideosForBackfillEnrich`（never/unmatched/**missing-characters**/all）+ `scripts/reenrich-backfill.ts`（--mode/--type/--limit/--dry-run，复用 enrichmentQueue 配置含 attempts/backoff/removeOnComplete）
   - **Codex FIX-1**：① 加 `missing-characters` mode（anime 无 catalog_characters，纳入 all）→ 覆盖**既有 matched anime**（否则 META-19 角色永填不上）② jobId 改 `backfill-<runTs>-<id>`（不复用爬虫 enrich-<id>，避免撞残留 job 被静默跳过）
   - **Codex FIX-2**：matched-anime 重富集会损坏既有 Bangumi 绑定（清空/降级/覆盖人工）→ `matchAndEnrich` 入口「已 primary 绑定→只刷新不重配」（refreshExistingMatch，ADR-170 D-170-4-AMD）；+4 守卫单测
   - **dry-run 实测：all 2,835 条**（含已 matched anime）/ **missing-characters 420**（当前全部 anime 无角色）。anime 走 META-17 Bangumi REST 兜底 + META-19 角色入库。
   - **⚠️ 全量运行交用户**：需先起 api server（worker 在 server.ts:194，concurrency=2 限流）+ redis；当前 redis 起但 worker 未跑。运行：`node --env-file=.env.local --import tsx scripts/reenrich-backfill.ts`（建议先 `--limit 20 --type anime` 验证 matched/角色上升，再全量）。
4. **META-15-D** — 导入豆瓣 dump（状态：✅ 已完成 2026-05-31 / 用户提供文件 / 导入 140,502 行）
   - `import-douban-dump.ts` 全量导入 `external-db/douban/moviedata-10m/movies.csv`（81M / 2020-11；dry-run 解析 140,502 无错 → 全量 0→**140,502 行** / title_normalized 填充仅 2 空 / ON CONFLICT 幂等）。列对齐已抽查核对。
   - **价值边界**：dump 是 14 万部**电影**；库内 movie 仅 245（其余 series/variety/short/anime/other）→ 主要惠及 movie 类型 step1 本地召回（评分/演职员/genres 完整 + 毫秒级，替代慢网络 step2）。剧集/综艺/短片不在电影 dump 覆盖。
   - **后续**：当前 backfill 队列剩余 job 处理时自动命中新 dump；导入前已处理的 douban-unmatched movie 可 `reenrich-backfill --mode unmatched` 重入补命中。
5. **META-17** — Bangumi 匹配质量改进：matchAndEnrich REST 精确兜底（方案 A）（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 子代理无 / 单测 39 + 真实 API + 实时端到端三重验证 / 全量 5705 passed 零回归）
   - 根因：matchAndEnrich 只查空本地 dump、无 REST 兜底。修：dump 空/低置信 + token → REST 搜索 + 精确(name_cn/name 规范化==titleNorm)计分。师兄啊师兄→matched 388781 / 海贼王安全漏配（避开海贼王子）。
   - **follow-up**：① ✅ **META-20 Bangumi 别名感知 B**（2026-05-31 / matchViaRest pass 2：name 未命中 → top-5 getSubject 查 infobox「别名」精确匹配 → 召回海贼王↔航海王 / 别名+年份→auto、别名无年份→candidate / getSubject null 跳过不退化 / +6 单测）② ✅ **META-22 外部源富集匹配归一化（解耦归并键 + 标点符号剥离 + 有损歧义守卫）**（2026-05-31 / claude-opus-4-8 / **Codex stop-time review 三轮否决→三修**：轮1 直接改 `normalizeTitle` 动持久化归并键致漏归并/重复 catalog 行【真实回归】→ 解耦 `normalizeTitle` 不动 + 新增 `stripExternalMatchPunct`/`normalizeForExternalMatch`；轮2 手挑 CJK 范围 U+3001-303F 误剥 々(U+3005)/〇(U+3007)/苏杭数字【破坏「人々」匹配】→ 改 Unicode 属性；轮3 `[^\p{L}\p{N}]` 过度有损 + 本地命中取 matches[0] 直接 auto【不同作品塌缩同键高置信误绑】→ ① 剥离改 `[\p{P}\p{S}]`（保空格/标记降塌缩面，CJK 仍对齐 dump）② 新增 `isAmbiguousLocalMatch` 守卫（多条不同记录同年份档→禁 auto 降 candidate）。匹配领域全改用新函数 + 双路径歧义守卫（matchAndEnrich / step1 douban）；富集立即生效无需重导 dump / **归并键不变无需 backfill** / +24 单测 title-normalizer 57 + bangumi 66 + metadataEnrich 32 全过 / 全量 5814 passed 0 failed 无 flaky）

> **Bangumi API 接入说明**：代码层**已接入**（`lib/bangumi.ts` 读 `BANGUMI_API_TOKEN` + `MetadataEnrichService.step3Bangumi` 对 anime 自动委托 BangumiService REST 富集）。当前没生效只因 Redis/worker 没跑（同 META-15-B）。一旦起 worker + 重富集 anime（META-15-C），Bangumi 自动匹配。剩余「凭证移 system_settings + UI 测试连接」（ADR-168/feature-1）是 backlog，非必需。

---

## [SEQ-20260530-05] 外部数据源凭证统一管理 + Secret Redaction（ADR-168 / ADR-A）

- **状态**：✅ 已完成（META-16-ADR/A/B/C 全 ship 2026-05-30 / ADR-168 凭证管理全闭环）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：在站点设置页提供**可扩展的外部源凭证配置**（Bangumi token 现在 / TMDB api_key 以后），凭证存 `system_settings`，并落地 secret redaction（审计不落明文 + GET 遮罩 + PATCH 占位跳过）；顺带修复现有 `douban_cookie`/`notification_webhook_secret` 明文落审计/明文回传隐患。
- **背景**：代码层 Bangumi REST 已接入（`lib/bangumi.ts` 读 `BANGUMI_API_TOKEN`），但**仅 .env.local 明文**，无设置页配置、无遮罩。用户已获 Bangumi access token，后续加 TMDB。
- **方案/ADR**：`docs/designs/external-metadata-ux-overhaul_20260529.md` §2 + §13 ADR-168 骨架（D-168-1..6 已锁；at-rest 加密 NEGATED for P1）。
- **可扩展性要求（用户明示）**：凭证结构通用化（非 bangumi 专用）—— 支持 bangumi_api_token / tmdb_api_key / 未来源；`SECRET_KEY_PATTERNS` 需覆盖 `_token$/_cookie$/_secret$` + **新增 `_api_key$`/`_key$`**（tmdb_api_key）（ADR 内裁定精确正则，避免误伤非密钥 key）。

### 任务列表（按执行顺序）

1. **META-16-ADR** — ADR-168 起草（强制 Opus）（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8) / decisions.md 落档 D-168-1..7）
   - 消化 design §13 D-168-1..6 + 通用化（多源凭证）+ `_api_key$` 模式裁定 + 现有 douban_cookie/webhook_secret 回归红线
2. **META-16-A** — 后端：secret redaction + 凭证 key 类型扩展（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / secret-redaction 24 + system-config +3 / 全量 5734 passed 零回归）
3. **META-16-B** — 凭证解析下沉 Service：lib/bangumi 5 函数加 cfg + getBangumiConfig 60s 缓存 + env 回退（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / bangumi-service 44 + metadataEnrich mock 同步 / 全量 5736 passed 零回归非 flaky）
4. **META-16-C** — 前端 SettingsTab「外部数据源」分组卡（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 子代理无 / 门禁全过 / SettingsTab 14 + 受影响面 135 全过 / 机器过载未跑完整全量·基线 META-16-B 5736 + 孤立改动 + typecheck/lint 绿）。测试连接按钮 NOT in scope（依赖 ADR-173/F-A）。

> **范围说明**：「测试连接」按钮（POST .../bangumi/test）依赖 ADR-F endpoint ADR，**不在本 SEQ**（feature-1 §2.4 的连接测试推后）；本 SEQ 仅「配置 + 存储 + 遮罩 + 消费」。at-rest 应用层加密 NEGATED for P1（follow-up）。

---

## [SEQ-20260530-06] 外部元数据展示层 — 真源并集视图（条目级）

- **状态**：✅ 已完成（META-18-ADR/A/B 全 ship 2026-05-30 / claude-opus-4-8 + arch-reviewer Opus / 门禁全过 / 全量 5752 passed 零回归）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：在后台**视频编辑抽屉 + 审核台详情**两处展示已回填的外部源条目级数据（评分+人数 / 日文原名 / 放送日 / 排名 / nsfw）+ **多源并集总览**（命中源 / 外部 ID / 置信度 / 链接），让运营可判定富集回填质量。
- **范围**：admin-ui 新共享展示组件 + 详情 DTO 扩展（**不新建路由**，扩 `adminFindById`）+ 两消费面接入。**仅展示层**，不动富集管线；**仅条目级**，不含逐集放送。
- **依赖**：META-09/12/14 ✅（EnrichmentSummary + 富集徽标已落地）；`listVideoExternalRefs` / `findBangumiById` 已存在。
- **用户决策（已锁）**：①两处界面 ②条目级（不含逐集）③CV/角色管线记为 META-19 后续。
- **设计原则**：编辑/真源页 = `media_catalog` 真源 + 所有命中源**并集**（非每源孤岛 tab）。

### 任务列表（按执行顺序）

1. **META-18-ADR** — 共享组件 API 契约（强制 Opus）：`ExternalMetaPanel` Props + 详情 DTO 扩展形态（`externalRefs[]` + `bangumiInfo?`）+ ADR-172 AMENDMENT 3 落档（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 + arch-reviewer (claude-opus-4-8) CONDITIONAL→满足 3 条件等同 PASS / decisions.md 落档）
   - 3 条件全满足：①provider/status 字面量下沉 @resovo/types + api import 复用 ②bangumiInfo 排除 rating_votes（votes 归 catalogFields）③串行 B→A→C + Opus trailer + 审核台懒加载不污染 queue list query
2. **META-18-A** — 后端：`adminFindById` 注入 `externalRefs`（`listVideoExternalRefs`）+ `bangumiInfo`（anime+subject→`findBangumiById`）+ `@resovo/types` 契约 + server-next 镜像（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / 不新建路由 verify:endpoint-adr ✅ 203 路由 / typecheck 全绿）
   - 4 新类型（EXTERNAL_REF_PROVIDERS/MATCH_STATUSES + ExternalRefSummary + BangumiEntrySummary）；非 anime/无 subject 不带 bangumiInfo；不挂 public mapVideoRow / 列表不注入
3. **META-18-B** — 前端：admin-ui `ExternalMetaPanel` 共享组件 + 编辑抽屉新 tab + 审核台 TabDetail 懒加载消费 + 单测（状态：✅ 已完成 2026-05-30 / claude-opus-4-8 / external-meta-panel 13 新单测 + 受影响 6 文件 47 全过 / 全量 5752 passed 零回归）
   - 两消费面渲染并集总览 + bangumi 条目块；anime-only；零硬编码色；3 个 TabDetail 测试补 getVideo mock

### 已记录后续（本序列不做）

- **META-19** — Bangumi CV/角色自动入库管线（已立案 → SEQ-20260530-07）。

---

## [SEQ-20260530-07] Bangumi CV/角色自动入库管线 + 展示

- **状态**：✅ 已完成（META-19-ADR/A/B/C 全 ship 2026-05-30 / claude-opus-4-8 + arch-reviewer Opus / migration 083 已应用 / 门禁全过 / 全量 5766 passed 零回归）
- **创建时间**：2026-05-30
- **最后更新时间**：2026-05-30
- **目标**：把 Bangumi 角色 + 声优(CV)纳入自动富集管线（抓 `/v0/subjects/:id/characters` + 新建角色↔CV 配对 schema + 回填）+ 后台外部元数据面展示，充实 anime 数据。
- **范围**：migration（新表）+ lib/bangumi + BangumiService + queries + DTO + ExternalMetaPanel 展示。**仅 anime**；新富集/重富集时写入（既有 matched 角色回填依赖 META-15-C）。
- **依赖**：META-18 ✅（ExternalMetaPanel + 详情 DTO 注入已就绪，角色区接入其上）；BangumiService gather/apply 两段范式 + catalog_episodes 表范式可复用。
- **触发**：用户「后面要补充管线，充实数据」；META-18 调研确认 CV/声优当前完全不抓不存。
- **已确认数据形态**（实测）：character{id,name,type,images,summary,relation,actors[]} + actor{id,name,type,images}；**N:M**（52 角色 14 个多 CV）→ 必须 normalized 配对。

### 任务列表（按执行顺序）

1. **META-19-ADR** — 角色↔CV schema + 抓取/写入/展示契约 + ADR 落档（强制 Opus）（状态：✅ 已完成 2026-05-30 / arch-reviewer (claude-opus-4-8) CONDITIONAL→满足 5 红线等同 PASS / ADR-161 AMENDMENT 落档）
   - 裁定：两表 normalized + delete-then-insert（charactersFetched 守卫：成功含空清陈旧/失败跳过）+ ADR-161 AMENDMENT + 顶层 bangumiCharacters DTO + ExternalMetaPanel characters Props（主角+配角过滤）
2. **META-19-A** — migration 083 + 类型 + catalogCharacters 查询 + architecture.md 同步（状态：✅ 已完成 2026-05-30 / migration 083 已应用 / 2 投影 + replaceCatalogCharacters/listCatalogCharactersForDisplay / typecheck 绿）
3. **META-19-B** — lib/bangumi `getCharacters` + BangumiService 集成（gather+apply 单点接入两路径）+ 单测（状态：✅ 已完成 2026-05-30 / getCharacters(成功返数组含[]/失败返 null) + mapCharacters + charactersFetched 守卫 / bangumi-lib 13 + bangumi-service 49 + metadataEnrich 31 全过）
4. **META-19-C** — DTO 注入（adminFindById）+ ExternalMetaPanel 角色/CV 区（anime）+ 单测（状态：✅ 已完成 2026-05-30 / external-meta-panel 20 单测 / 编辑抽屉 + 审核台两面接入 / commit 带 Opus trailer）

### 已记录后续

- **既有 matched anime 角色回填**：依赖 META-15-C 批量重富集（本序列保证「新富集/重富集时写入」，存量需触发重富集）。
- **角色头像**：✅ **META-21 完成**（2026-05-31 / CharactersBlock Thumb square-sm 28×28；CV 头像仍后续按需）。
- 角色头像渲染 / persons(制作人员) 抓取 / 角色检索页 / 前台公开展示 —— 后续 AMENDMENT。

---

## [SEQ-20260531-01] 归并键剥标点统一 + catalog 冗余合并 + Bangumi 唯一约束兜底（ADR-174）

- **状态**：✅ 完全收官（A✅ B✅ C✅ D✅ E✅ / 2026-06-01）
- **创建时间**：2026-05-31
- **最后更新时间**：2026-06-01 03:24
- **收官结论**：归并键改剥标点根治「同番裂多 catalog 抢绑同 subject 撞唯一约束」；存量 3124→3072（合并 52 冗余行）+ 富集运行时 `resolveBangumiBinding` 去重兜底。验收实测 **JP anime 命中率 48.7%→56.4%（+7.7pp）/ 全 anime matched 145→166（+21）**，全量 5832 passed 零回归。「REST 搜不到/低置信」(273 主体) 与标点无关 → 另起 SEQ（Bangumi 召回率提升）。
- **目标**：根治「同一作品因标题标点差异裂成多 catalog 行 → 抢绑同一 Bangumi subject → 撞 `media_catalog_bangumi_subject_id_key` 唯一约束 → 富集写入失败留 unmatched」。把归并键 `media_catalog.title_normalized` 从「保留 CJK 标点」改为「剥标点」（对齐外部匹配键），重算存量 + 合并冗余 catalog + 富集写入唯一约束兜底。
- **范围**：apps/api（TitleNormalizer 新增 `normalizeMergeKey` / BangumiService 真去重兜底 / 键写入+查询入参全切换）+ migration 084（存量重算 backfill + 52 组冗余合并 + 删行快照备份）+ architecture.md schema 语义同步 + decisions.md ADR-174。**前台搜索/展示 `title` 保留标点不变。**
- **依赖**：无（独立序列）。上游诊断：本会话实测（anime 462 matched 145 / JP 150 matched 73=48.7% / 抽样 30 unmatched JP anime：5 撞唯一约束 + 25 REST 搜不到 + 0 可正常匹配）。
- **用户决策（已锁 2026-05-31）**：归并键改剥标点（根治）；展示/搜索 title 保留标点；所有匹配类中间操作（含归并）忽略标点空格。
- **关键事实（已核实）**：① `media_catalog` 有 `created_at` 无 `deleted_at`（无软删 → R4：删行须先快照备份再物理删）② 剥标点重算后仅 52 冗余行 / 51 组合并，0 组有多外部 ID 冲突（合并干净）③ migration 下一序号 084 ④ `matchAndEnrich` 走「已存在 catalogId 直接 update」绕过 findOrCreate 的 bangumiId 去重 = 冲突精确机理。
- **本序列不解决**：「REST 搜不到/低置信」（83% 的 unmatched，与标点无关）→ 另起 SEQ（Bangumi 召回率提升，需先诊断 25 个搜不到的真因）。

### ADR-174 设计裁定（arch-reviewer claude-opus-4-8 / agentId a42951b36f50da8dd / PASS·满足 8 红线）

- **D-174-1** 新增独立 `normalizeMergeKey(raw)=stripExternalMatchPunct(normalizeTitle(raw))`，**不改 `normalizeTitle`**（它还供 CrawlerRefetchService 相似度计算 :69/:87，改它超范围）；所有归并键写入点切到新函数。
- **D-174-2** 两阶段 migration：阶段 A TS 脚本重算全 3124 行 title_normalized（禁纯 SQL 复刻 / R5）；阶段 B 每组一事务合并 52 冗余行（留存行规则=有外部 ID + 最早 created_at；子表 videos/episodes/characters/external_refs 转移指向留存行 + `ON CONFLICT DO NOTHING`；删行先快照备份 / R3+R4）。
- **D-174-3** `applyEnrichmentDb` 写 bangumi_subject_id 前先 `findCatalogByBangumiId`：已被他行占用→当前 video 的 catalog_id 重指向 existing（运行时真去重）；重指向不安全→降级记 candidate 不炸事务；ON CONFLICT 仅作并发保险非主体。**仅 bangumi**；douban/imdb/tmdb 同构 follow-up（沉淀 `MediaCatalogService.linkExternalIdOrRedirect` 接缝）。
- **D-174-4** 查询点（videos.crawler.ts:197 / mediaCatalog.ts:144 / video-merge-candidates GROUP BY）SQL 无需改，但**写入侧+查询入参侧键生成必须同批切 `normalizeMergeKey` 零遗漏（R6 最高翻车点）**；dump 表 `douban_entries.title_normalized` 不在范围（已剥标点、不同表不同语义）。
- **D-174-5** 5 类测试必覆盖（归一化同键/幂等/CJK 对齐 + 迁移幂等 + 合并正确性 + 唯一约束兜底 + 富集渲染回归）；architecture.md 同步字段语义 / R8。
- **8 红线**：R1 CJK 零召回损失+含空格 under-match 不变量 / R2 留存行确定性 / R3 子表唯一约束 ON CONFLICT / R4 删行可回滚（无 deleted_at→快照备份）/ R5 backfill 用 TS 非纯 SQL / R6 写入+查询入参键零遗漏切换 / R7 5 类测试全绿 / R8 architecture.md 同步。
- **5 黄线**：Y1 部署顺序（先发代码再 backfill）/ Y2 VideoMergesService 是否 catalog 级合并 / Y3 ExternalDataImportService:447 本地 normalizeTitle 勿误统一 / Y4 video_sources 复合键 ADR-114-NEGATED 兼容（只动 catalog 层）/ Y5 重指向改 video.catalog_id 不破坏审核台。

### 任务列表（按执行顺序 / 严格串行依赖）

1. **META-23-A** — ADR-174 落档 decisions.md（D-174-1..5 + 红/黄线 + 关联 META-22/ADR-114-NEGATED/ADR-161/ADR-170）（状态：✅ 已完成 2026-05-31 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8) agentId a42951b36f50da8dd）
   - 创建时间：2026-05-31
   - 建议模型：opus（ADR 产出 / arch-reviewer 设计已就绪，本卡落档 + D-N 编号登记）
   - 文件范围：`docs/decisions.md`（追加 ADR-174）
   - 依赖：无（设计已由 arch-reviewer 完成）
   - 完成备注：ADR-174 完整落档（背景+决策 D-174-1..5+8 红线+5 黄线+后果+follow-up）；verify:adr-contracts EXIT=0（D-174-1..5 advisory 未闭环=预期，实施期 B..E 逐条闭环）；media_catalog 无 deleted_at 已核实（R4 删行须快照备份）/ migration 下一序号 084。执行模型: claude-opus-4-8
2. **META-23-B** — `normalizeMergeKey` 新增 + 键写入/查询入参全切换 + 单测（D-174-1/R1/R6）（状态：✅ 已完成 2026-05-31 / claude-opus-4-8 / 子代理 无）
   - 建议模型：sonnet（函数新增 + 调用点切换 / 无 schema）
   - 文件范围：`apps/api/src/services/TitleNormalizer.ts`（+normalizeMergeKey + normalizeTitle/normalizeForExternalMatch 注释修订 + buildMatchKey 切换）/ CrawlerService.ts:172 / VideoService.ts:256 / VideoMergesService.ts:403 / BangumiSeedService.ts:70 / `tests/unit/api/title-normalizer.test.ts`(+8) / 3 mock 同步（crawler-service-data-guards / crawler-service-es / video-merge-mutations）
   - 依赖：META-23-A ✅
   - 完成备注：新增 `normalizeMergeKey`=stripExternalMatchPunct(normalizeTitle)，与 normalizeForExternalMatch 实现等价但语义分立；buildMatchKey + 4 service 写入点（Crawler/Video/VideoMerges/BangumiSeed）全切；**不切**：CrawlerRefetchService:69/87（相似度）/ ExternalDataImportService:447 + bangumi-dump-refresh（各自本地 normalizeTitle dump 基准，Y3 守住）/ normalizeForExternalMatch。查询点（findCatalogByNormalizedKey / videos.crawler:197 / video-merge-candidates GROUP BY）消费入参 key 自动对齐。`videos.crawler.ts:166` fallback `input.title.toLowerCase()` 是 queries 层退化兜底（CrawlerService 总传 titleNormalized），不引 service 依赖保持分层纯净。R1 单测 +8（同番归并/与 normalizeForExternalMatch 逐字符一致/CJK 对齐 dump [^\p{L}\p{N}]/幂等/含空格 under-match/々〇 保留/buildMatchKey 同键）。门禁：typecheck+lint EXIT=0 / title-normalizer 65 全过 / 全量 445 文件 **5825 passed 0 failed** 零回归（3 mock 失配已同步补 normalizeMergeKey）。执行模型: claude-opus-4-8
3. **META-23-C** — migration 084：存量重算 backfill + 52 组合并 + 删行快照备份（D-174-2/R2/R3/R4/R5）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8) agentId ab52594c0cb7e1258）
   - 建议模型：opus（数据迁移 / 不可逆删行 / 子表转移 / 强制 Opus 评审实施方案）
   - 文件范围：`084_merge_key_backfill_dedup.sql`（8 快照表）+ `scripts/backfill-merge-key.ts` + `scripts/dedup-catalog-084.ts` + `scripts/dedup-catalog-084-rollback.ts` + `docs/architecture.md`
   - 依赖：META-23-B ✅（写入侧已切新键，Y1 部署顺序）
   - 完成备注：Opus 精确 SQL 方案 + 抓 3 陷阱（DESC 留存行 / UPDATE 无 ON CONFLICT 先删碰撞再 UPDATE+IS NOT DISTINCT FROM / 孙表 catalog_character_actors 快照）。**执行 A→B→A'**：A 重算单行组+冗余组整组跳过（规避 uq_catalog_title_year_type）→ B 合并 51 组删 52 行 → A' 补 34 留存行键。实测：catalog 3124→3072 / 不一致 0 / uq 违反 0 / 子表悬挂 0 / video 孤立 0 / bangumi 164 douban 54 不变（删行全裸冗余）/ 快照 52 行 / 当前打扰番已绑 610703（根因消除）。门禁 typecheck+lint+verify:adr-contracts EXIT=0 / 全量 5825 passed 零回归。执行模型: claude-opus-4-8
4. **META-23-D** — `applyEnrichmentDb` 唯一约束兜底真去重 + 单测（D-174-3）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 无）
   - 建议模型：opus（动 BangumiService 富集核心路径 + 事务原子性 / ADR-170 兼容）
   - 文件范围：`apps/api/src/services/BangumiService.ts`（applyEnrichmentDb 写 subject 前查重重指向 + 降级 candidate）+ `apps/api/src/services/MediaCatalogService.ts`（查重接缝）+ `tests/unit/api/bangumi-service.test.ts` + `tests/unit/api/metadataEnrich.test.ts`(mock 同步)
   - 依赖：META-23-C ✅
   - 验收：两 video 撞同 subject 610703 → 真去重重指向不抛 duplicate key + 降级 candidate 不炸事务
   - 完成备注：`MediaCatalogService.resolveBangumiBinding` 只读查重接缝（safe/redirect/conflict 三态 / isRedirectSafe = type 必同 + year 差 <2 才安全）+ `linkVideo` 加可选 db（事务内重指向共享连接）+ `CatalogBindingResolution` 导出类型（为 follow-up `linkExternalIdOrRedirect` 通用原语留可提取接缝）。`applyEnrichmentDb` 写 subject 前 resolveBangumiBinding：redirect → linkVideo 重指向 video 到 existing 并写 existing（同值 UPDATE 不撞唯一约束）；conflict → dedupConflict 不写 catalog 规避冲突。`applyAutoMatchAtomic` dedupConflict 降级 candidate ref(非 primary)+保留 unmatched+仍 COMMIT（绝不让单冲突 video 炸 matchAndEnrich）；`matchAndEnrich` auto dedupConflict → 返回 candidate；`confirmMatch` 经既有 !wrote 分支自然 ROLLBACK+updated:false。仅 bangumi（douban/imdb/tmdb follow-up）；pre-check 主体 + 并发残余靠 ROLLBACK+Bull 重试收敛（UPDATE 不支持 ON CONFLICT，非语义主体 / D-174-3）。门禁 typecheck+lint+verify:adr-contracts EXIT=0 / bangumi-service 72 + metadataEnrich 33 全过 / 全量 5832 passed 0 failed 零回归。D-174-3 ✅ 闭环。**Codex stop-time review FIX1**（commit 15560dbe）：redirect 真去重改 video.catalog_id 后，`MetadataEnrichService.step5MetaScore` 仍用旧 catalogId 对 orphan catalog 算分 → 让 `matchAndEnrich` auto 返回 `effectiveCatalogId` 沿 step3Bangumi 回传 step5；补 ADR D-174-7 + 红线 R13（运行时改 video↔catalog 归属，下游所有以 catalogId 为输入的步骤必须改用有效 catalogId）+ 已知边界登记。D-174-7 ✅ 闭环。执行模型: claude-opus-4-8
5. **META-23-E** — 全量回归 + 重跑 anime backfill 验证命中回升（D-174-5/R7/R8）（状态：✅ 已完成 2026-06-01 03:24 / claude-opus-4-8 / 子代理 无）
   - 建议模型：sonnet（验证 + 门禁 + architecture.md 收尾）
   - 实际开始：2026-06-01 02:47
   - 验收：4 质量门禁全过 + verify:sql-schema-alignment + architecture.md 字段语义同步 + 用户重跑 `--mode unmatched --type anime` 后 JP 命中率回升复核
   - 完成备注：① 4 门禁全过（typecheck/lint EXIT=0 / **全量 445 files 5832 passed 0 failed 零回归** / verify:adr-contracts EXIT=0）② verify:sql-schema-alignment EXIT=0（55 表全对齐）③ architecture.md 复核 line 301 `title_normalized` ADR-174 语义已就位 + **新增 line 309 `bangumi_subject_id` 运行时去重/重指向注记**（D-174-3/D-174-7/R13 + douban 同构 follow-up）/ R8 闭环。④ **用户重跑 `--mode unmatched --type anime`（453 入队）+ worker 消化完毕**（队列 waiting/active/delayed=0）实测：JP anime（mc.country='JP'）total=149 / bangumi_matched=84 / unmatched=57 → **56.4%，对比基线 48.7%（150 matched 73）回升 +7.7pp（+11 命中）**；全 anime matched 145→166（+21）/ bangumi=candidate 23 条（D dedupConflict 降级、未失败、记 candidate 待人工，符合 D-174-3 设计）/ meta_null=0（全部至少富集一次、无 orphan）。本序列不负责的「REST 搜不到/低置信」(273 bangumi_unmatched 主体) → 另起 SEQ。**D-174-5/R7/R8 ✅ 闭环。** 执行模型: claude-opus-4-8

### SEQ-20260531-01 BLOCKER 触发清单

- 任一红线 R1-R8 未满足 → 暂停。
- META-23-C 迁移在真实 PG 上跑出非预期合并（组数≠51 / 出现多外部 ID 冲突组）→ 暂停核对。
- douban/imdb/tmdb 同类约束 follow-up 不在本序列，发现新冲突类型 → 记 QUESTION 不扩范围。

---

## [SEQ-20260601-01] 视频库 / 播放线路 职责重定义与表格重设计

- **状态**：🔄 执行中
- **创建时间**：2026-06-01 19:15
- **最后更新时间**：2026-06-02（PRE-1/PRE-2/PRE-3/1/2/3/4-A/5-A/5-B/6/8 ✅ / 4-B·7·DTAF-VIEWPORT·6-FOLLOWUP-DRAWER-HOOK 待做）
- **目标**：落地《视频库/播放线路职责重定义》设计方案——视频库=作品维度、播放线路=资源运维维度、别名独立页；表格头部极简(搜索+列设置) + 三层过滤 + B 方案快捷筛选；术语裁决（失效=探测②含连接/试播/异常、禁用=is_active①、待补源=无可播源含已上架）；用户投稿/失效举报整体下线。
- **范围**：`apps/server-next`（/admin/videos + /admin/sources 两 client + 子组件）+ `apps/api`（videos/sources 聚合 + 过滤排序 + distinct 白名单 + submit 端点 410）+ `packages/admin-ui`（KpiCard pressed）+ `packages/types`（双表 DTO/术语）+ `apps/web-next`（移除投稿入口）。
- **依赖**：设计方案 ✅（`docs/designs/videos-sources-responsibility-redesign_20260601.md` / commit e1950050）。ADR：ADR-117 amendment（sources 聚合）+ ADR-150 amendment（distinct 白名单 + country 逻辑表）；ADR-124 不触碰。
- **方案全文**：`docs/designs/videos-sources-responsibility-redesign_20260601.md`（§6 拆卡表 + 各节落地点）。
- **执行节奏**：前置 `PRE-1 / PRE-2 / PRE-3` + 契约卡 `1` 先行 → API `2 / 3` → UI `4 / 5 / 6` → 回归 `7`；`8` 独立。Opus 强制：PRE-2 / PRE-3 / 1 + 2·3 的 ADR amendment 部分。
- **依赖链**：前置 `PRE-1 / PRE-2 / PRE-3 / 1`（可并行）→ `(2,3)` → `(4,5,6)` → `7`；`8` 任意时点。

### 任务列表（按执行顺序）

1. **CHG-VSR-PRE-1** — 前置：两 client 超限文件拆分（解 500 行硬限）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 完成时间：2026-06-01 19:40
   - 建议模型：sonnet（纯重构，零行为变化）
   - 文件范围：`VideoListClient.tsx`(788→400L) 抽 `buildVideoColumns`→VideoColumns.tsx + `BatchActionsRow`→VideoBatchActions.tsx；`SourcesClient.tsx`(623→376L) 抽 `buildColumns`→SourceColumns.tsx。
   - 完成备注：3 新文件（VideoColumns 268 / VideoBatchActions 143 / SourceColumns 260）+ 2 改文件 import 收敛。**typecheck/lint EXIT=0 + 全量 5902 passed 零回归**。file-size-budget 本卡改善（22→20 违规，两目标文件移除）；剩 20 为既有 debt（范围外不修），`sources-matrix.ts` 759L 留 CHG-VSR-3 拆。e2e 跳过（纯抽分零行为变化）。详见 changelog CHG-VSR-PRE-1。

2. **CHG-VSR-PRE-2** — 前置：抽中性 `useSourceLinesController(videoId)`（§5.5）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 完成备注：**蓝图 R1-R5 / Y1-Y4 全实施**。新建 `lib/sources/use-source-lines-controller.ts`（312 行 / state·actions·options 三面 / R2 乐观锁 toggle〔乐观更新+409 重 fetch+非 race 回滚〕/ R3 videoIdRef batch stale-write / R4 结构化 `SourceActionResult` 经 `onActionResult` 注入·localized 反馈留消费方 / R5 `fetchHealth` 仅取数·drawer 留消费方 / Y4 `onLoaded` 留首行选；duck-typed 错误归类对齐 use-sources）。R1 方案 B：source 操作真源移到 `lib/sources/api`（fetchVideoSources 显式 `active=all` 待校准点① / +9 fn + 7 result 类型），`lib/moderation/api` re-export 保后兼容、`ContentSourceRow`→`SourceLineRowData` 别名。Y1：`lib/sources/types` 新增 `SourceLineRowData`（ContentSourceRow∪VideoSource∩RawSourceRow，派生 optional）+ `SourceActionResult`(+code)。两消费方迁移：`moderation/LinesPanel`(341→219，删 8 state+handler)+ `TabLines`(useVideoSources→controller，新增 probe/render)。**门禁全过**：typecheck 8ws / lint(三新改文件零新警告) / verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 5949 passed 零失败零 flaky**（新增 hook 14 用例 + 受影响 moderation-api 15 / use-sources 11 / lines-panel 16 / use-selected-line 7 全绿）。**e2e**：审核台 3 spec 需 playwright 测试 env 启 server-next（mock cookie auth），本机运行栈中间件走真实 :4000 → 307 login + :3000 webServer 冲突 → 全在**页面加载/鉴权步失败（组件逻辑之前），非本卡回归**（curl 实证 /admin/moderation→307）；集成契约零变更（PendingCenter + admin-ui LinesPanel Y2 未触及）；e2e 真门禁归 CHG-VSR-7。**注意**：① 审核台 toggle 升级为乐观更新（R2 明示）；② `lib/videos/use-sources.ts` 成孤儿（保留+单测仍验 videos/api）；③ drawer 逻辑 2 处重复待 CHG-VSR-6（3 处）提取 `useLineHealthDrawer`。**Codex stop-time review FIX（并发安全 / 4 轮）**：toggle 失败对账 ① 整组 `setLines(snapshot)`→仅回滚目标行；② 单行回滚仍覆盖**同一行**并发 confirmed（disableDead）→ 改 server 真相重 fetch；③ 整组 `setLines(fresh)` 仍覆盖期间落地的**更新 confirmed 写** → 外科式只对账目标行 + `externallyModifiedRef` 同行 is_active 保护；④ re-fetch 成功分支**整行替换** `freshTarget` 仍覆盖**同行其他字段**（并发 probe 的 probe_status/latency）→ **终修为字段级**（只对账 is_active + updated_at，保留同行其他字段）。至此除 reload 外全部 setLines 路径字段级。抽 helper 降嵌套；新增共 5 回归用例 + 测试隔离改 resetAllMocks；复跑全量 5954 passed（hook 19 用例连跑 3 次稳定）。详见 changelog CHG-VSR-PRE-2。执行模型: claude-opus-4-8
   - 创建时间：2026-06-01 19:15
   - 建议模型：**opus**（共享 hook 契约 / 跨 3 消费方）
   - 子代理调用：arch-reviewer (claude-opus-4-8) — CONDITIONAL PASS + 5 红线 + 4 黄线（蓝图见下）
   - 约束：**禁止 `/admin/sources` 反向 import `/admin/moderation` 内部组件**（依赖方向单向）。
   - 门禁：共享 hook 契约 → Opus 评审 + commit trailer `Subagents: arch-reviewer (...)`。
   - 验收要点：审核台 / 编辑抽屉 / 线路展开三方共用同一 controller，功能零回归。
   - 依赖：PRE-1 ✅（软依赖）。

   **arch-reviewer 蓝图（落地依据 / 2026-06-01）：**
   - **位置/命名**：`apps/server-next/src/lib/sources/use-source-lines-controller.ts`，返回 `[state, actions]`（对齐 useVideoSources 范式）。
   - **R1 api 去重（方案 B）**：把 source 操作从 `lib/moderation/api` **移到** `lib/sources/api.ts`（fetchVideoSources/toggleSource/disableDeadSources/refetchSources/probeOneSource/renderCheckOneSource/batchProbeVideo/batchRenderCheckVideo/fetchLineHealth/toDisplayState + result 类型）；`lib/moderation/api` re-export 保后兼容（blast radius 已核实：source 操作目前无跨模块消费）。**禁方案 A**（hook 反向依赖 moderation）。
   - **Y1 中性行类型**：新增 `lib/sources/types.ts` `SourceLineRowData`（ContentSourceRow ∪ VideoSource ∩ admin-ui `RawSourceRow`；alias 字段 + quality_detected 均 optional；**勿复名** 既有 `SourceLineRow`）。**admin-ui 零改动**（Y2，规避 types.ts Props 门禁）。
   - **R2 乐观锁**：toggle 采 use-sources 的「乐观更新 + 409 REVIEW_RACE 重 fetch + 非 race 回滚 snapshot」完整版，统一进 hook；**审核台原无乐观更新 → 行为变更点，须回归**。
   - **R3**：`videoIdRef` batch stale-write 防御内建 hook。
   - **R4 反馈注入**：hook 不 push toast/alert，只产出结构化 `SourceActionResult`，经 `options.onActionResult` 注入（审核台→useToast / TabLines→alert(VE) / 展开区自定）。
   - **R5 health drawer**：留消费方（open/page/title/i18n 各异）；hook 仅暴露 `fetchHealth(sourceId,page)`。
   - **Y4**：`onLineSelect`/`onSourceHealthChanged`/首行自动选 留消费方（经 `options.onLoaded`）。
   - **待校准点（实施前必查）**：① 统一 fetch 用 `active=all`（审核台现 fetchVideoSources 无 active 参数=默认，会丢禁用源行）；② 后端 `/admin/sources?videoId=` 单行已确认同时返回 quality_detected + codename/retired_at/auto_retired（feasibility ✅，但注意 sources.ts 有两查询分支，确认走透传 alias 的分支）；③ batch 回填 `latencyMs`→`latency_ms` camel→snake（Y3）。
   - **state/actions 面**：state{lines/loading/error/actionError/togglingIds/probingIds/renderCheckingIds/probingAllSources/renderCheckingAllSources/disableDeadPending/refetchPending}；actions{reload/toggleEpisode/disableDead/refetch/probeEpisode/renderCheckEpisode/probeAllSources/renderCheckAllSources/fetchHealth}；options{onLoaded/onActionResult}。
   - **迁移**：moderation/LinesPanel.tsx 341→~140L（删 8 state+handler，onLoaded 放首行 onLineSelect，onActionResult 映射现有全部 toast case，drawer 本地保留）；TabLines.tsx 改用 hook（新增 probe/render 能力）+ alert 经 onActionResult；CHG-VSR-6 展开区后续消费。
   - **关键路径回归必查**：409 红条 / batch 切视频 stale-write / 首次 onLineSelect 切源 / toast 全 case / pill 联动 / TabLines 乐观更新一致性 / 禁用源行不丢。

3. **CHG-VSR-PRE-3** — 前置：KpiCard 扩 `pressed` / `data-active` / `aria-pressed`（B 选中态）（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 完成时间：2026-06-01 19:50
   - 建议模型：**opus**（共享组件 API 契约）
   - 文件范围：`packages/admin-ui/src/components/cell/kpi-card.types.ts` + `kpi-card.tsx` + 单测（+5）。
   - 完成备注：arch-reviewer Opus **CONDITIONAL PASS → 3 红线全采纳**：R1（用 `--admin-accent-soft/-border` token，禁 `--accent-soft` 不存在 fallback 硬编码）/ R2（`data-active` 存在性 `'true'|undefined`）/ R3（pressed 用 inset box-shadow + soft bg **叠加**，不替换 variant border，is-danger 警示共存）+ Y2/Y3/Y4。typecheck/lint EXIT=0 + **全量 5907 passed 零回归**（kpi-card 54→59）。详见 changelog CHG-VSR-PRE-3。

4. **CHG-VSR-1** — 双表 DTO + 问题枚举 + 术语（连接/试播/异常/禁用）+ 待补源语义 + SourceSegment 仅废弃（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 建议模型：**opus**（改 `@resovo/types` 跨消费方契约）
   - 文件范围：`packages/types`（VideoGroupRow/Stats 扩字段 + 问题枚举 + 待补源派生类型）；`SourceSegment` 加 `@deprecated`（**不改名/不删**）；server-next `lib/videos/types` + `lib/sources/types` 镜像。
   - 门禁：`@resovo/types` 契约 → 强制 Opus 子代理 + commit trailer `Subagents: arch-reviewer (...)`。
   - 验收要点：类型可被卡 2/3/4/5/6 增量消费；SourceSegment 兼容保留；typecheck 零回归。
   - 依赖：无（契约地基，建议早做）。
   - 完成备注：**纯加性契约地基**——`sources-matrix.types.ts` 新增 3 枚举（`SOURCE_QUICK_FILTERS`/`SOURCE_PROBLEM_KINDS`/`NEEDS_SOURCE_SEVERITIES`，ADR-157 双形态）+ VideoGroupRow 12 派生列 optional（可用源/连接失败/试播失败/待探测/禁用/质量档+覆盖率+延迟中位/待补源/isPublished/lastCheckedAt）+ VideoGroupListParams（quickFilters 数组 + lowQuality bool 双入口 OR 合流 + lastChecked range + sortField 扩 activeSources/quality/lastChecked）+ VideoGroupStats 4 KPI optional（abnormal/needsSource/pendingProbe/lowQuality）；`SourceSegment` 加 `@deprecated`；`index.ts` + server-next `lib/sources/types.ts` 桥接补 const value re-export（A-1/A-2）；server-next `VideoAdminRow` 镜像 7 字段（title_original/country/status/episode_count/current_episodes/total_episodes/bangumi_status，与 VideoAdminDetail 签名逐字一致）。**arch-reviewer Opus CONDITIONAL PASS → 3 BLOCKER（A-1 index value re-export / A-2 桥接 value re-export / B-1+D-1a 维度①/②注释区隔）+ HIGH（E-1 继承签名一致）+ 5 MEDIUM 全消解**；偏离：`disabledCount` 据设计 §3.2/§3.3「可选中性 badge」确认保留（reviewer 建议可暂不加，按设计文档据实保留）。typecheck 8 workspace 全过 / lint 5 successful / **全量 5909 passed 零回归** / verify:adr-contracts EXIT=0。纯类型加性无运行时行为，e2e 不适用。详见 changelog CHG-VSR-1。**Codex stop-time review FIX（arch-reviewer 复审 Q1(a)+Q2(A)）**：质量字段对齐 canonical——`qualityLabel:string`→`qualityHighest:ResolutionTier`（复用既有 `StagingRow.qualityHighest`）+ 移除冗余 `qualityRank`（rank 纯 producer SQL 内部键）+ 收口 4 处 `quality_rank` 注释；全仓零引用零回归，再跑 5909 passed。**Codex review 第 2 轮 FIX（聚合语义）**：上版注释误导「口径对齐 `pickHighestQuality`」（该函数仅 quality_detected、丢 `quality` 回退），改正 `qualityHighest`/`lowQuality` 注释为「逐源 `quality_detected ?? quality` 回退后取最高档」+ 显式警告卡 3 勿照搬 pickHighestQuality（设计 §0.2/§3.3 D-12）；纯 JSDoc 零回归，5909 passed。**Codex review 第 3 轮 FIX（虚指 canonical）**：注释误称 `QUALITY_ORDER` 为 canonical——实为 `aggregate.ts` admin-ui module-local 非导出常量，唯一 canonical 是 `ResolutionTier` 类型。改正：值域复用 `ResolutionTier`、档位序显式拼出（4K 最高、无共享常量、producer 在 SQL CASE 实现）；纯 JSDoc 零回归，5909 passed。

5. **CHG-VSR-2** — 视频库 API：集数/Bangumi/meta 质量 + 过滤升级 + 搜索扩面 + distinct 白名单（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-01 19:15
   - 建议模型：opus（ADR-150 amendment 起草）+ sonnet（实施）
   - 文件范围：`apps/api/src/db/queries/videos.ts`（`AdminVideoListFilters` 加数组 enum / 年份 range / 国家 / 连载 / 豆瓣 / Bangumi / 完整度 range / 集数异常 boolean；`q` 扩 title_original+short_id）；`services/datatable/distinct-whitelist.ts`（加 country/douban_status/bangumi_status + `media_catalog.country` 逻辑表映射）；route + 单测。
   - ADR/门禁：**ADR-150 amendment**；扩现有端点入参/响应（非新 route）→ ADR amendment；若需新增 route → 独立 ADR + Opus PASS（`verify:endpoint-adr`）。
   - 验收要点：新过滤/搜索/排序服务端生效 + SQL identifier 白名单防注入 + 单测覆盖新参数。
   - 依赖：CHG-VSR-1。
   - 完成备注：**ADR-150 AMENDMENT 3（D-150-VSR2-1..5）**——arch-reviewer Opus CONDITIONAL PASS。① `listAdminVideos` 加 14 过滤条件（types[]/yearMin-Max/country[]/catalogStatus[]/isPublished/doubanStatus[]/bangumiStatus[]/metaScoreMin-Max + 派生 episodeMismatch/episodeMissing/metaIncomplete/pendingReview）+ q 扩 title_original+short_id；数组枚举一律 `= ANY($n::text[])` 参数化 + 空数组短路（防注入/防误过滤）；SORT 白名单 +episode_count + route 默认 `updated_at desc`。② distinct **D-150-VSR2-1 采纳方案 B**（加 `media_catalog` 逻辑表直查 country，**拒绝给 distinct 端点加 JOIN** 避免安全面扩张）+ videos 表加 douban_status/bangumi_status；IDENT 正则/启动断言零改动。③ **D-150-VSR2-2 离散 query params**（拒 `?filters=` envelope，apps/api 走 pg）；**D-150-VSR2-3 type 加性 types[] 保留单值**；**D-150-VSR2-4 visibility/review 维持单值零回归**（消费方已验证单值）。VideoService.adminList 加性透传；server-next VideoListFilter 同步（CHG-VSR-1 延后项）；端点契约表 6→7 表。typecheck 8 workspace 全过 / lint EXIT=0 / **全量 5912 passed 零回归**（含新增 5 测试断言；2 failed flaky=`use-filter-presets` post-teardown window，与本卡无关，重跑 0 再现）/ verify:adr-contracts + verify:endpoint-adr EXIT=0。详见 changelog CHG-VSR-2。**Codex review FIX（typed client 可触达）**：`VideoListFilter` 14 字段未在 `lib/videos/api.ts` `listVideos` 序列化（声明却发不出 = 不可触达+内部不一致），补序列化与后端解析对齐（数组 CSV / 布尔 true-false / 范围 String / 派生仅 true）+ 新增 5 序列化测试；全量 5917 passed。

6. **CHG-VSR-3** — 线路聚合 API：可用源数① / 连接失败 / 试播失败 / 待探测 / 质量(quality_rank+覆盖率+延迟中位) / 待补源 + KPI stats ①→②（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 完成备注：**ADR-117 AMENDMENT 3（D-117-VSR3-1..8）全实施**。① **queries 拆 4 文件**（解 759>500 硬限）：`source-line-aliases.ts`(291)/`source-routes.ts`(158)/`video-matrix.ts`(88)/`sources-matrix.ts` 保留 video-groups(759→**381**)，3 新文件全 <500 零新违规；file-size-budget **净改善 -1**（sources-matrix.ts 退出违规列表）。② **派生列**（D-1/-2/-3）：`QUALITY_RANK_EXPR` alias 参数化 module-level const 工厂（Q1 SELECT/Q2 stats/Q3 quickFilter 三处共用、`COALESCE(quality_detected,quality)` 回退口径、勿照搬 pickHighestQuality）+ 单趟聚合 FILTER（active/disabled/connect_fail/render_fail/pending）+ coverage 仅 quality_detected + percentile_cont 延迟中位（全源非空 scope）+ qualityHighest=CASE MAX(rank) 反查 label（质量未知 null 不并入低质量）+ needsSource/isPublished/lastCheckedAt。③ **KPI②**（D-4）：per-video 子查询 g + 外层 COUNT FILTER，①(total/active/dead/orphan) 口径零变更 + 单测逐值回归断言，②(abnormal/needsSource/pendingProbe/lowQuality) 新增；禁①②同层双算。④ **quickFilters**（D-5）：全 WHERE EXISTS（vs5-9）可组合 AND，lowQuality/quickFilter 'low_quality' OR 合流单份谓词（单测断言不双 push）。⑤ **sortField**（D-6）：扩 activeSources/quality/lastChecked 走 SELECT 别名（IDENT 正则零放宽）+ zod enum 同步 + lastChecked HAVING 范围（CHG-VSR-1 "卡 3 实现" 闭环）。⑥ **派生列双层透传**：raw map + Service map 均显式枚举。⑦ **测试 mock 路径迁移**（BLOCKER 方案 A）：7 测试 import/vi.mock/dynamic import 同步迁移新文件（sources-matrix-service vi.mock 拆 3 路径 + namespace import；alias-mutations/retire-priority-audit → source-line-aliases；routes-by-site → source-routes；sources-matrix 直接 import 拆分；admin-source-lines-view 7 处 dynamic import；admin-sources 集成 relative import 拆分）。`sources-routes-mutations-audit`/`admin-sources-sql` grep 实证不受影响。⑧ SourceSegment 保留（卡 5 删）+ 全卡 SQL 零 user_submissions。**门禁全过**：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0 / **全量 5933 passed**（1 失败=`VideoImageSection.test.tsx` jsdom waitFor flaky，隔离重跑 21/21 通过、与本卡无关，同 CHG-VSR-2 既有模式）/ 新增 25 单测（派生列 11 + quickFilters 7 + sortField 4 + KPI② 2 + Service 透传 1）。无新 route/error code/migration → architecture.md 零同步。e2e N/A（API-only 无 UI 消费方，留卡 4/5/6 + CHG-VSR-7）。**Codex stop-time review FIX（2 issue 全闭环）**：① lastChecked 排序非时序安全 → 新增真实 timestamptz 列 `last_checked_sort` 供 ORDER BY（DTO 仍读 `::TEXT` last_checked_at），与 updated_at/quality 双列同范式；② SourcesMatrixService.ts 613>500 硬限 → 抽 `sources-matrix.schemas.ts`(146，Zod schema + 结果 DTO + aggregateSignal)，Service 613→**490**(<500)，route/2 测试改 import 路径；**budget 整卡净改善 -2**(21→19)，原既有 debt 偏离消解。复跑全量 5934 passed 零失败 + 4 门禁全过。详见 changelog CHG-VSR-3。
   - **设计已固化（ADR-117 AMENDMENT 3 / decisions.md，D-117-VSR3-1..8）**：arch-reviewer Opus「需修改」→ 2 BLOCKER + 1 HIGH + 3 MEDIUM 全纳入。实施蓝图（零上下文损失）：
     - **拆分（4 文件）**：`source-line-aliases.ts`（别名 CRUD）/ `source-routes.ts`（routes-by-site + 3 mutations）/ `video-matrix.ts`（getVideoMatrix）/ `sources-matrix.ts` 保留 video-groups（~390 行）。
     - **BLOCKER-2（必做）**：≥6 测试 `vi.mock('@/api/db/queries/sources-matrix')` 按路径 mock 别名/route 符号 → Service import + 这些测试 import & vi.mock 路径**同步迁移新文件**（方案 A）。**文件范围须显式含**：`tests/unit/api/{source-line-alias-retire-priority-audit,source-line-alias-mutations,sources-routes-by-site,sources-matrix,sources-matrix-service}.test.ts` + `tests/integration/api/admin-sources.test.ts`（落地时逐一核 grep 实际引用）。
     - **派生列**：单趟聚合 FILTER（D-117-VSR3-1）+ `QUALITY_RANK_EXPR` 单常量三处共用（CASE COALESCE(quality_detected,quality) 7 档，勿照搬 pickHighestQuality）+ qualityHighest=CASE MAX(rank) 反查 label（D-2）+ coverage 仅 quality_detected 实测 + latencyMedian 全源非空 scope（D-3）。
     - **KPI②**：per-video 子查询 + 外层 COUNT FILTER（D-4，**禁①②同层 FILTER 双算**）；保留①（active/dead/orphan）+ 等价回归断言。
     - **quickFilters**：全 WHERE EXISTS（D-5，low_quality=EXISTS 已知质量 AND NOT EXISTS rank>=4）；lowQuality/quickFilter OR 合流单份谓词。
     - **sortField**：新增走 SELECT 别名引用（D-6，IDENT 正则零放宽）+ Service zod enum 同步。
     - 派生列**双层透传**（raw map + Service map 均显式枚举，须两处补）。无新 route/error code/migration；不碰 user_submissions；SourceSegment 保留（卡 5 删）。
   - 创建时间：2026-06-01 19:15
   - 建议模型：opus（ADR-117 amendment 起草）+ sonnet（实施）
   - 文件范围：`apps/api/src/db/queries/sources-matrix.ts`（`listVideoGroups` 增派生列 + `getVideoGroupStats` 5 卡 FILTER 从 `source_check_status`① 切探测②）+ 快捷筛选谓词（含异常/待补源/待探测/低质量 `quality_rank<4`）+ Service 层 + 单测。
   - ADR/门禁：**ADR-117 amendment**；`quality_rank` CASE 7 档（4K=7…240P=1）；待补源=无可播源（含已上架）；**不做失效举报**（不触碰 user_submissions）。
   - 验收要点：5 KPI 计数走探测维度② + 质量口径（`quality_detected ?? quality` / 覆盖率 / 延迟中位）+ 质量未知不并入低质量 + 单测。
   - 依赖：CHG-VSR-1。

7. **CHG-VSR-4-A** — 视频库列重构（复合显示列 + 默认隐藏原子可筛选列 + 数据格式）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 实际开始：2026-06-02 11:47
   - 完成时间：2026-06-02 12:10
   - 建议模型：sonnet
   - 文件范围：videos columns（封面/视频/类型/发行信息/集数/元数据/内容状态/更新/操作 + 默认隐藏原子列 year/country/连载/可见/审核/发布/douban/bangumi/meta_score）；§2.4 数据格式降级（集数 NULL / 已播>收录 warn）。
   - 验收要点：复合显示列只读不挂筛选；默认列与 §2.2 一致；列宽/排序对齐。
   - 依赖：CHG-VSR-1 / CHG-VSR-2 / CHG-VSR-PRE-1。
   - 完成备注：**设计 §2.2/§2.3/§2.4/§2.5/§2.6 列重构落地**。① `VideoColumns.tsx`（269→~430，声明性<500）默认可见 9 列重组（cover / title「视频」副行 `{title_en ?? title_original} · {short_id}` / type / **release** 复合〔`{year}·CountryName`+Pill 完结/连载/未知〕/ **episodes** §2.4 降级 / **meta** EnrichmentBadgeCluster〔enrichment→meta 重命名〕/ **status** 复合〔VisChip+发布 dot〕/ updated / actions）；§2.3 降级默认隐藏 source_health(保留排序)/probe/image_health；§2.6② 默认隐藏原子列 year/country/catalog_status/visibility/review_status/is_published/douban_status/bangumi_status/meta_score(render-only，filter 接线留 4-B)。② **复合列与未接线列一律显式 `filterable:false`**（D-150-AMD2-1 data-kind 默认 filterable=true / §2.6「只读不挂筛选」硬约束），4-A 筛选面收敛 = title/type/visibility/review_status（既有可用）。③ **排序对齐**：DataTable 以 column.id 作 sort.field（`sortable` 仅看 enableSorting，无 sortField 契约 / 沿用 CHG-VSR-5-A 先例）→ `buildVideoFilter` 加 `COMPOSITE_SORT_MAP`（release→year/episodes→episode_count/meta→meta_score/status→review_status）+ 白名单 +episode_count；default sort `created_at desc`→`updated_at desc`（§2.5）。④ `VIDEO_COLUMN_DESCRIPTORS` 同步 22 条；新建 `VideoColumns.test.tsx` 25 用例 + `enrichment-cluster-faces.test` 同步列重构（descriptor enrichment→meta / 锚点改 title 文本）。**门禁全过**：typecheck 8ws / lint 5 successful（零新警告）/ verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 451 files 5984 passed 0 failed 零 flaky**（净 +25 本卡测试）。**范围外（留 4-B）**：原子列 enum/range filter 接线 + 搜索框 q 多列 + 快捷筛选 B + VideoRowActions 扩展 + 导出 CSV 移 PageHeader + FilterChipBar 删 + 视图保存移除。**e2e**：video specs 仅依赖 video-list-table/title 文本/row-actions/cover·actions resize handle/batch（列无关 columnheader handle）→ 结构零破坏（grep 实证无旧列依赖）；实跑因本机鉴权 env（:3003→307 走真实 :4000）阻塞归 CHG-VSR-7。详见 changelog CHG-VSR-4-A。**Codex stop-time review FIX（回访用户列布局失效）**：`useTableQuery` 列可见性持久化 localStorage，storage-sync 仅 schema 校验不对账默认可见性变化 → 回访用户旧偏好覆盖新默认列集（source_health/probe/visibility/review 仍显示、updated 仍隐藏）→ 新默认表不可靠 ship。修复：tableId `'admin-videos'`→`'admin-videos-v2'`（既有 :v1→:v2 版本失效范式定向 bump 本表，不动 admin-ui 共享 LAYOUT_VERSION）；新建 `VideoListClient.layout-reset.test.tsx` 回归（预置旧 key stale 偏好断言新默认生效；护栏验证 revert tableId 转红）。复跑 typecheck/lint EXIT=0 + videos 9 files 117 passed（+1）。执行模型: claude-opus-4-8

8. **CHG-VSR-4-B** — 视频库三层过滤 + 行操作 + 快捷筛选(B 统计计数)（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-01 19:15
   - 实际开始：2026-06-02 13:10
   - 完成时间：2026-06-02 13:40
   - 建议模型：sonnet
   - 用户裁决（2026-06-02）：Q1=前端轻量 count 查询（纯前端 3 count 查询读 total）；Q2=扩 VideoEditDrawer 加 initialTab（加性默认 basic）。
   - 完成备注：**设计 §1.1/§2.1/§2.6/§7-7 前端接线落地**（后端过滤参数 CHG-VSR-2 + api 序列化已就绪，本卡纯前端）。① **搜索框**：`VideoFilterBar` 由 status/site 下拉 → 单一 `q` 搜索框（300ms debounce + filtersRef 防并发列筛选丢失 + 外部 q 同步 + 卸载清 timer；多列 ILIKE 后端承担）。② **原子列筛选接线**：7 列 `filterable:true`（year/meta_score `number`→min/max；country `enum`+distinct `media_catalog.country`；catalog_status/is_published/douban_status/bangumi_status `enum`+静态选项）；`buildVideoFilter` 扩 `getEnumArray/getRange` 映射（数组/范围/isPublished bool）；复合列保持 `filterable:false`（§0.3 阻断项 1 不扩 DataTable 契约）。③ **快捷筛选 B**：PageHeader 子标题「{total} 条 · 全部 · 待审/元数据缺失/集数不一致」可点击 chip（aria-pressed + 可组合 AND + 全部清空 + 切换回 page1），独立 React `Set` state（不入 filters Map 规避 bool URL 往返歧义）；计数走 3 个 `listVideos({k:true,limit:1})` 读 total（Q1=A，全局口径，挂载/批量后刷新）。④ **行操作**：`VideoEditDrawer` 加性 `initialTab`（Q2=A），`onEditRequest(id,tab?)` 透传，新增 图片→images / 外部元数据→external / 查看播放线路→lines。⑤ **头部清理**：删 FilterChipBar（§1.1-5）+ buildFilterChips 死代码 + viewsConfig（视图保存暂缓 §7-7）+ sites/saved-views 消费；导出 CSV 接到 PageHeader 按钮。⑥ `fetchDistinct` 加性入 `lib/videos/api`（复用 `/admin/_dt/distinct`，country ISO→中文 label）。**门禁全过**：typecheck 8ws / lint 5 successful（4 改文件零新警告）/ verify:adr-contracts / verify:endpoint-adr EXIT=0（203 路由对齐无新端点）/ **全量 452 files 5993 passed + 1 flaky**（CrawlerRunsView jsdom 计时器干扰，隔离 33/33 通过，crawler 正交）。**范围偏离（用户授权）**：VideoEditDrawer + lib/videos/api.ts 超字面文件范围 → Q2=A 授权 + 验收必要支撑。**注意**：①计数全局口径不随 search 变化（§2.1）；②快捷筛选不持久化 URL（会话态）；③saved-views.ts 孤儿 = 视图保存暂缓有意保留；④e2e 归 CHG-VSR-7。详见 changelog CHG-VSR-4-B。执行模型: claude-opus-4-8
   - 文件范围：搜索框(q 多列) + 列头菜单原子列筛选 + 页面级统计计数快捷筛选（待审/元数据缺失/集数不一致，点击切换/可组合）；VideoRowActions（编辑/图片/外部元数据/审核/合并/前台/查看播放线路）；导出 CSV 移 PageHeader；视图保存暂缓移除。
   - 验收要点：表格头部仅搜索+列设置；无筛选下拉行 / 已选过滤 chip 条；快捷筛选 B 生效。
   - 依赖：CHG-VSR-4-A。

9. **CHG-VSR-5-A** — 播放线路结构重构：删四 Tab + 删内嵌别名 Tab + 列重构（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 完成备注：**设计 §3.1/§3.2 结构重构落地**。① `SourcesClient.tsx`(377→264)：删 `SEGMENTS` 四 Tab（grouped/dead/correction/orphan）+ segment state/param + 主体「线路矩阵/全局别名表」Tab + `activeTab='aliases'` 分支 + 内嵌 `SourceLineAliasPanel`；保留 PageHeader「线路别名管理→」跳转 + KPI 4 卡（display only，5-B 重建 5 张可点击）；删手动「刷新」按钮（自动 refetch，保留 retryKey 供 ErrorState）；sort 守卫改列 id→API sortField 映射（video/coverage→activeSources/quality/lastChecked）；日期过滤 updatedAt→lastChecked。② `SourceColumns.tsx`(260→290)：按 §3.2 重建列集 video(副标题 `{type}·{short_id}`)/coverage(复合 线·源·可用，可用 0 染 danger，sortable)/probe(探测)/render(试播)/quality(`{qualityHighest ?? 质量未知}`+已检测%+延迟中位ms，sortable)/issues(`Pill` badges 待补源/连接失败/试播失败/待探测/禁用)/sites(站点)/last_checked(最近检测，sortable+date filter)/actions；**保留列 id video/probeStatus/renderStatus/siteKey** 不破坏 smoke e2e；删 lineCount/sourceCount 独立列（并入 coverage）；filterOptions 文案改「连接失败/试播失败」。③ `lib/sources/api.ts`：补 lastCheckedFrom/To 序列化（last_checked 过滤可触达，CHG-VSR-2 教训）。④ `SourcesClient.test.tsx`：同步改 4 测试（删四 Tab/别名 Tab/segment 断言 → 改为负向断言 + 派生列渲染断言），8 passed。**门禁全过**：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 5931 passed + 1 flaky**（`StagingEditPanel` admin/staging，隔离 12/12 通过，与本卡无关）/ file-size-budget 19 中性（两文件均<500）。**范围外（留后续）**：KPI 5 卡 pressed + quality boolean 过滤 + quickFilters/lowQuality 序列化 + 删 SourceSegment 枚举 → 5-B；MatrixExpand→LinesPanel → 6；e2e 正式回归 → 7；`SourceLineAliasPanel.tsx` 成孤儿未删（设计 §4「暂保留兼容历史 IA」/ 清理 follow-up）。**Codex stop-time review FIX（展示与排序契约）**：① 默认排序违反 §3.4 → 初始 sort 改 `{ lastChecked, desc }`（原 undefined → 后端兜底 updated_at desc，且列头无排序指示符 §1.1-4）；② probe/render/issues 补显式 `enableSorting:false`（§3.4 禁排序，sortable 集严格 = video/coverage/quality/last_checked）；单测补默认排序断言；复跑全量 5932 passed 零失败。**e2e smoke 同步修复并实跑**：test 1 断言改 sortField=lastChecked desc，实跑 test 1（我改的）+ test 2 + test 4 **PASS**（直连 :3003 绕 :3000 webServer 冲突）。**test 3（probe filter「应用」按钮 outside viewport）现红 → 已立追踪卡 CHG-VSR-DTAF-VIEWPORT**（admin-ui popover 视口溢出，根因 max-height 480 无 flip-up；取 5-A 前 042a43ef 同样失败证既有缺陷非本卡回归；阻塞 CHG-VSR-7 e2e 门禁）。不再「未追踪」。详见 changelog CHG-VSR-5-A。
   - 创建时间：2026-06-01 19:15
   - 建议模型：sonnet
   - 文件范围：`SourcesClient.tsx`（删 SEGMENTS Tab 行 + activeTab=aliases 分支 + 内嵌 `SourceLineAliasPanel`；保留别名管理跳转）；columns（覆盖/探测/试播/质量/问题=连接失败·试播失败·待探测/站点/最近检测）；刷新改自动 refetch。
   - 验收要点：四 Tab / 别名 Tab 移除；列与 §3.2 一致；文案用「连接失败/试播失败」。
   - 依赖：CHG-VSR-1 / CHG-VSR-3 / CHG-VSR-PRE-1。

10. **CHG-VSR-5-B** — 播放线路快捷筛选(B：可点击 KPI 卡 pressed) + 列头筛选 + 删 SourceSegment（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 完成备注：**sources 页收尾（设计 §3.5/§4）**。① **5 KPI 卡 = 可点击快捷筛选**：`SourcesClient` grid 4→5 列，卡 = 全部(total/清空) + 含异常源(abnormal) + 待补源(needsSource) + 待探测(pendingProbe) + 低质量(lowQuality)，消费 CHG-VSR-3 ②维度 stats；`KpiCard` onClick+pressed（PRE-3）切换 quickFilter（`ActiveQuickFilter` Set 状态 / 可组合 AND / pressed 选中态 aria-pressed+data-active / 全部=清空）；旧 ①维度 4 卡（总播放源/有效/失效/孤岛）退场。② **quality 列「低质量」boolean 列筛选**：DataTableAutoFilter 无 boolean 控件 → 单选 enum `[{value:'low'}]` filterFieldName='lowQuality'，client 派生 lowQuality=true（与 KPI 低质量卡后端 D-5 OR 合流）。③ **typed client 序列化**：`lib/sources/api.ts` 补 quickFilters(csv) + lowQuality(仅 true)。④ **删 SourceSegment**（末尾）：`packages/types`(删 type + VideoGroupListParams.segment) / `apps/api/sources-matrix.ts`(删 import/re-export + segment 分支) / `sources-matrix.schemas.ts`(删 schema segment) / server-next `types.ts`(删 re-export) / `api.ts`(删 segment 序列化)；测试 admin-sources 集成 3 segment→quickFilters/lowQuality + sources-api-url 复合透传去 segment + 新增 quickFilters/lowQuality 序列化测试 + SourcesClient KPI 测试改 5 卡 + quickFilter 点击交互。**全仓 SourceSegment 代码零引用**。**门禁全过**：typecheck/lint/verify:adr-contracts/verify:endpoint-adr EXIT=0 / **全量 5934 passed + 1 flaky**（`CrawlerClient` 导出 CSV，隔离 66/66 通过、与本卡 sources 无关）。**e2e 主动实跑**：sources smoke test 1/2/4 PASS（直连 :3003 绕 :3000），test 3 仍 = 已追踪 CHG-VSR-DTAF-VIEWPORT（5-B 零新破坏）。文件 SourcesClient 322 / SourceColumns 302 均<500。详见 changelog CHG-VSR-5-B。
    - 创建时间：2026-06-01 19:15
    - 建议模型：sonnet
    - 文件范围：5 KPI 卡（全部/含异常源/待补源/待探测/低质量）= 可点击筛选（pressed/可组合/全部清空）；列头菜单筛选（探测/试播/站点/质量/最近检测）；**末尾删除 `SourceSegment` 枚举 + segment 查询分支**。
    - 验收要点：KPI 卡选中态生效；快捷筛选谓词正确；SourceSegment 彻底退场。
    - 依赖：CHG-VSR-5-A / CHG-VSR-PRE-3。

11. **CHG-VSR-6** — 用共享 `LinesPanel` 替换 `MatrixExpand`（消费 PRE-2 控制器）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-01 19:15
    - 实际开始时间：2026-06-02
    - 完成备注：删 `MatrixExpand` + 随之死代码（`SourceMatrixRow` 主组件 CHG-VSR-5-A 表格化后无消费方 / `EpisodeCellBlock` / 矩阵网格常量），新建 `SourceLinesExpand.tsx`（消费 `useSourceLinesController(videoId)` + 共享 `LinesPanel` density=regular + client `groupSourcesByLine` + 本地 `LineHealthDrawer`）。**三宗罪修复**：① 消除 render 阶段 setState 发请求（controller useEffect reload）② 消除 `.slice(0,8)` 截断（LinesPanel 全量聚合，任意集数无截断）③ 全操作接通（单集/整组 toggle·probe·render·disableDead·refetch·health + codename/retired/auto_retired 显示）。反馈：toggle/disableDead/refetch 失败→`actionError` 红条 / probe·render·batch→`useToast` 浮层（与审核台 LinesPanel 同口径；内联中文 = sources 模块无 i18n 文件，跟随现状）。**不传** `onLineSelect`（无选中态）/ `onToggleLine`（controller 无 line 级 toggle，与审核台·TabLines 两参考消费方一致）。保留 `SignalPill`（`SourceColumns` 探测/试播列依赖）。`SourcesClient.renderExpandedRow` `MatrixExpand`→`SourceLinesExpand`。**测试**：删 `getVideoMatrix` mock + 补 controller 函数 mock + `toDisplayState` + 新增 12 集行展开测试（点行→经 controller useEffect 调 `fetchVideoSources(videoId)` + LinesPanel 渲染 + `12/12集` 全聚合证不截断）。**门禁全过**：typecheck 8ws / lint（新文件 `SourceLinesExpand` 零新警告 / 既有 `SourcesClient:164` exhaustive-deps 非本卡）/ verify:adr-contracts / verify:endpoint-adr EXIT=0 / **全量 450 files 5955 passed 0 failed 零 flaky**（比 PRE-2 5954 +1=本卡展开测试）。无新端点/schema/ADR（消费已有），architecture.md 零同步。**e2e**：`sources-sort-filter-smoke.spec.ts` 不展开行（测 page-load/sort/filter）+ 全 e2e 无依赖旧 `MatrixExpand` 结构（"matrix" 命中仅无关的 codename-matrix-picker）→ 本卡零 e2e 影响；展开区 e2e 归 CHG-VSR-7（沿用范式，本机鉴权 env 阻塞既有）。drawer 第 3 处本卡内联，提取 `useLineHealthDrawer` 拆 follow-up 卡 14 `CHG-VSR-6-FOLLOWUP-DRAWER-HOOK`（用户裁决 2026-06-02）。**Codex stop-time review FIX（源全量分页）**：`fetchVideoSources`（PRE-2 移入）`limit=100&page=1` 单页 → 源行 >100（长剧集 × 多线路）静默截断（与「任意集数不截断」验收冲突 / 后端 `/admin/sources` limit zod cap=100）→ 改按 `total` 分页循环拉全量（`PAGE_SIZE`=100；终止 空页 ∨ `all>=total`），三消费方（审核台/编辑抽屉/展开区）共享修复；`sources-api-url.test` +4 分页用例；复跑 typecheck/lint EXIT=0 + 全量 5959 tests 5958 passed（1=`VideoImageSection` 既有 jsdom flaky 隔离 21/21 通过，非本卡）。详见 changelog CHG-VSR-6。执行模型: claude-opus-4-8
    - 用户裁决（2026-06-02）：drawer 第 3 处本卡内联（仿 TabLines），提取 `useLineHealthDrawer` 留独立 follow-up 卡（Opus 评审 + 审核台关键路径回归）。
    - 建议模型：sonnet
    - 文件范围：删 `SourceMatrixRow.tsx` 的 `MatrixExpand`；展开区 `renderExpandedRow` 接 `<LinesPanel>` + `useSourceLinesController` + `groupSourcesByLine`。
    - 约束：不扩 `getVideoMatrix`；client 端聚合；不反向 import 审核台内部。
    - 验收要点：任意集数不截断（消除 `.slice(0,8)`）+ 消除 render 阶段请求 + 全操作接通（含 codename/retired/auto_retired）。
    - 依赖：CHG-VSR-PRE-2 / CHG-VSR-5-A。

12. **CHG-VSR-7** — 回归测试（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-01 19:15
    - 实际开始：2026-06-02 14:45
    - 完成时间：2026-06-02 15:05
    - 建议模型：sonnet
    - 完成备注：**VSR 序列收官回归全过**。三门禁：`test -- --run` 453 files 6001 passed + 2 flaky（AuditClient/StagingEditPanel 隔离各 22/22、12/12 过 = 并行污染既有 flaky 非回归）/ verify:adr-contracts + verify:endpoint-adr EXIT=0 / typecheck 8ws + lint 5 successful。**VIDEO/SOURCES e2e 18/18 PASS**（videos 5 + videos-column-resize 5 + sources-smoke 4〔含 DTAF-VIEWPORT 验证〕+ codename-matrix 4，admin-next-chromium 直连 :3003）。**厘清 VIDEO e2e 长期「鉴权 env」阻塞真因 = fall-through `route.continue()` 把 admin shell 未匹配请求（notifications/background-events/jobs）漏到真实 :4000 → 401 → apiClient refresh 失败重定向 /login**（非 VSR 功能回归）；修：videos 两 spec fall-through 改 404 隔离 + test 2 `filter-q`→`videos-search-input`（4-B 搜索框漂移）+ test 5 确认 locator getByText→getByRole（strict 双命中）。仅测试基建修复零生产代码改动。功能域覆盖 VSR-1..6 已沉淀无空缺。**Codex stop-time review FIX**：原 closeout 误判根因为「缺 /auth/me mock」并补了死 mock；诊断证明 /auth/me 从未调用（死代码），真修复是 404 fall-through，已删死 auth mock + 改正根因，删后复跑 10 VIDEO e2e 仍全绿。详见 changelog。执行模型: claude-opus-4-8
    - 范围：动漫集数 / Bangumi 筛选 / 连接失败 / 试播失败 / 待补源 / 待探测 / 批量探测 / 长剧集展开；e2e（VIDEO/SOURCES 路径）。
    - 验收要点：`test -- --run` + `test:e2e` + `verify:adr-contracts` 全过；零回归。
    - 依赖：CHG-VSR-4-B ✅ / CHG-VSR-5-B ✅ / CHG-VSR-6 ✅ / **CHG-VSR-DTAF-VIEWPORT ✅（e2e 门禁前置已解：sources smoke test 3 实测转绿 2026-06-02）**。

12.5. **CHG-VSR-DTAF-VIEWPORT** — `DataTableAutoFilter` popover 视口溢出修复（高页面「应用」按钮不可达）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02
    - 实际开始：2026-06-02 14:05
    - 完成时间：2026-06-02 14:35
    - 完成备注：**视口感知定位**。`header-menu.tsx` 纯函数 `computeHeaderMenuPosition`——下方放得下完整 **且 footer 距视口底 ≥ SAFE_BOTTOM_GAP(56)** → 向下；否则上方放得下/够用(≥160) → flip-up（CSS `bottom` 锚定表头上沿，footer 落表头上方避底部叠层）；兜底向下贴底 + maxHeight 内滚 + 水平右溢 clamp；统一 `reposition(measure)` 替换原恒向下两 effect（开启实测自然宽高缓存、scroll/resize 仅重锚）。`dt-styles-matrix.ts` autofilter `max-height` 改 `var(--dt-autofilter-max-height, 480px)` + value-list `min-height:0`。**根因**：原恒 `top:rect.bottom+4` 致中部表头 footer 压视口底/右下角撞 Next dev 浮标。**实测 e2e sources smoke 4/4 PASS**（test 3 目标转绿；test 4 纯 maxHeight 方案曾回归〔footer 压右下角〕→ SAFE_BOTTOM_GAP flip-up 修复，stash 基线对照确认）。门禁全过 + 全量 6002 passed + 1 flaky（StagingEditPanel 隔离过，无关）+ 9 新定位单测。无公开 Props/契约变更 → 不触发 Opus trailer。详见 changelog。执行模型: claude-opus-4-8
    - 建议模型：sonnet（admin-ui 定位逻辑，若改 Props/行为契约则 Opus 评审）
    - **症状**：`/admin/sources` 列头菜单（如「探测」列 ⋯）打开 `DataTableAutoFilter` popover 后，底部 `[data-actions]`「应用」按钮落在视口折叠线下方不可达（playwright `scrollIntoView` 对浮层无效，e2e `sources-sort-filter-smoke.spec.ts` test 3 `filter-probe-status` 红，54 次重试失败）。
    - **根因**：`[data-autofilter-popover]` `max-height: 480px`（`dt-styles-matrix.ts:157`）+ **无视口翻转（flip-up）/ 无 available-below 约束**。从页面靠下列头（sources 页有 4 KPI 卡，表头 y≈350）向下展开 → popover 底部 y≈830 > 720 视口。`[data-value-list]` 内部 240px 滚动不解决整 popover 元素底部出屏。
    - **既有性证明**：取 CHG-VSR-5-A 前版本（commit `042a43ef`，含旧四 Tab 结构、表头更靠下）跑同测试**同样失败**（且更严重）；CHG-VSR-5-A 删 Tab 后表头上移反而改善但不足。**非 CHG-VSR-5-A 引入**。
    - **影响面**：所有高页面表格的 `DataTableAutoFilter`（sources / 潜在 videos 等）。
    - **建议修复方向**：popover 视口感知——空间不足时 flip-up 开向上方，或 `max-height = min(480, 视口可用高度)` + footer `[data-actions]` sticky bottom + body 区滚动。需回归既有 autofilter e2e（多页面）。
    - **文件范围**：`packages/admin-ui/src/components/data-table/{header-menu.tsx 定位 / dt-styles-matrix.ts CSS / data-table-auto-filter.tsx}`。
    - **验收要点**：`sources-sort-filter-smoke.spec.ts` test 3 转绿 + 既有 autofilter e2e 零回归。
    - **关联**：CHG-VSR-5-A 实测暴露（changelog CHG-VSR-5-A）；阻塞 CHG-VSR-7 的 `test:e2e` 门禁。

13. **CHG-VSR-8** — 关闭投稿：`POST /sources/submit` 返 410 Gone 不写库 + 停 verifyFromUserReport（状态：✅ 已完成 2026-06-01 / claude-opus-4-8 / 子代理 无）
    - 完成时间：2026-06-01 20:20
    - 完成备注：纯后端单文件——`sources.ts` submit handler 返 `410 FEATURE_RETIRED` + 不写库 + 删 VerifyService import/实例（submit 是其唯一消费方）；`report-error` 入队重验保留。**前台无调用方**（仅路由定义），无前台改动。测试：sources.test.ts +2（410 断言）/ crawler.test.ts 2 旧 submit 用例（401/202）改 410（实际 submit 测试在此文件，非预期 sources.test.ts）。typecheck/lint/**verify:adr-contracts** EXIT=0 + **全量 5909 passed 零回归**。详见 changelog CHG-VSR-8。
    - 创建时间：2026-06-01 19:15
    - 建议模型：sonnet
    - 文件范围：`apps/api/src/routes/sources.ts`（submit handler 改 410，**保留路由不删**）；`apps/web-next` 投稿 UI 入口移除；`verifyFromUserReport` 投稿触发停用（`report-error` 入队重验保留）。
    - 门禁：非 admin 路由无 ADR-gate；**不得删路由**（CLAUDE.md）；记 changelog。
    - 验收要点：submit 返 410 + 不写库 + 前台无投稿入口；`report-error` 不受影响。
    - 依赖：无（独立，任意时点）。

14. **CHG-VSR-6-FOLLOWUP-DRAWER-HOOK** — 提取共享 `useLineHealthDrawer`（消除 3 处 drawer 重复）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
    - 创建时间：2026-06-02
    - 实际开始：2026-06-02 15:30
    - 完成时间：2026-06-02 16:10
    - 完成备注：**新建中性 hook `useLineHealthDrawer`（arch-reviewer Opus CONDITIONAL PASS 蓝图）+ 3 消费方迁移**。hook 返回 `[state, actions]`，持有 open/sourceId/page/events/total/limit/loading/error + 派生 pagination；**不持有 probeState/renderState/title**（消费方派生 → R-4 审核台保持快照 / TabLines·sources 实时派生，零行为变更）；`fetchHealth` 注入；**requestToken 并发保护**（R-1/R-2 修复现有 3 处 stale 覆盖缺陷）；`loadFailedText` 可选注入（兼容 TabLines 无 error 现状）；分页 `total>limit` limit 取响应真值（R-6 禁硬编码）。门禁全过：typecheck/lint/verify×2 EXIT=0 / **全量 454 files 6015 passed 0 failed 零 flaky**（净 +12 hook 单测）/ hook 12 例（并发/分页/error/no-op）+ SourcesClient 渲染 SourceLinesExpand 过。**审核台 e2e 既有 env 阻塞**（登录重定向先于 LinesPanel 渲染 = 非本卡回归 / PRE-2 已记录），drawer 关键路径回归由 12 例 hook 单测 + typecheck + 全量零回归覆盖。注：TabLines 单页不再显示分页栏（蓝图 R-6 标准化，与 moderation/sources 一致）。详见 changelog。执行模型: claude-opus-4-8
    - 建议模型：**opus**（共享 hook 契约 / 跨 3 消费方 / 触碰审核台并发敏感关键路径 → 强制 Opus 子代理评审 + commit trailer `Subagents: arch-reviewer (...)`）
    - 背景：CHG-VSR-PRE-2 注意 ③ + CHG-VSR-6 引入第 3 处 health drawer 本地实现（`moderation/LinesPanel` + `TabLines` + `SourceLinesExpand` 各一份：open·page·title·events·loading·error + `fetchHealth` 取数）。达 CLAUDE.md「同一 UI 模式 3 处以上必须提取」阈值。
    - 文件范围：新建 `apps/server-next/src/lib/sources/use-line-health-drawer.ts`（中性 hook：open/close/changePage + events/loading/error 状态 + 取数编排）；3 消费方迁移 `moderation/_client/LinesPanel.tsx` + `videos/_client/_videoEdit/TabLines.tsx` + `sources/_client/SourceLinesExpand.tsx`；title 拼接 / i18n 文案 slot 留消费方（各异：M.lines / VE.lines / 内联中文）。
    - 约束：title 拼接与 pagination 阈值差异（moderation `total>20` vs 通用 `total>limit`）须在 hook 契约内协调；**回归审核台关键路径**（健康抽屉开合/分页/probe·render 联动，PRE-2 刚过 4 轮 Codex 并发 review）。
    - 验收要点：3 消费方 drawer 行为零回归 + 单测覆盖 hook + 全量零回归。
    - 依赖：CHG-VSR-6 ✅。

### SEQ-20260601-01 BLOCKER 触发清单

- CHG-VSR-PRE-2 / PRE-3 / 1 任一 Opus 评审出红线未消解 → 暂停。
- 卡 2/3 发现需**新增** admin route（非扩展现有）→ 先起独立 ADR + Opus PASS（`verify:endpoint-adr`），不得直接加 route。
- 复合列被要求挂多条件筛选 → 记 QUESTION，不扩 DataTable 公共契约（§2.6 阻断项 1）。
- 发现需触碰 `user_submissions` 写入 → 暂停（本批次裁决不做，§5.1）。

---

## [SEQ-20260602-01] 后台表格表头行高标准化（表头高度与 body 密度解耦）

- **状态**：✅ 已完成
- **创建时间**：2026-06-02 17:30
- **最后更新时间**：2026-06-02 17:42
- **目标**：统一 server-next 各后台列表表头行高，消除 videos/sources（poster=80px）与其余页面（comfortable=40px）的表头高度断裂。
- **范围**：`packages/admin-ui` DataTable 表头高度逻辑（内部行为，不动公共 Props 契约、不新增 token）。
- **依赖**：无（独立，用户直接指派）。

1. **CHG-DT-HEAD-HEIGHT-DECOUPLE** — 表头行高与 body 行密度解耦（表头恒用 `--row-h` 40px）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02 17:30
    - 完成时间：2026-06-02 17:42
    - 建议模型：sonnet（共享组件内部行为修正 + 单测；不改 Props 契约 / 不新增 token → 不触发 Opus 门禁）
    - 变更原因：DataTable 表头高度 inline `height: rowHeight` 复用 body 行 density 令牌（`data-table.tsx:142-145` + `data-table-header-row.tsx:85`），poster 密度页面（videos/sources）表头被撑到 80px，与其余 40px 页面视觉断裂。v1 ModernDataTable 表头 `h-12`(48px) 本就与密度解耦——v2 误耦合属回归。
    - 影响的已完成任务：CHG-VSR-4-A/4-B（videos poster 列表）、CHG-VSR-5-A（sources poster 列表）—— 仅表头视觉收敛，body 行/列/筛选零变更。
    - 文件范围：`packages/admin-ui/src/components/data-table/data-table.tsx`（拆 `headerHeight` 常量 = `var(--row-h)`，停止把 density rowHeight 传表头）；`packages/admin-ui/src/components/data-table/data-table-header-row.tsx`（内部 prop `rowHeight`→`headerHeight`，未公开导出）；`tests/unit/components/admin-ui/table/data-table.test.tsx`（+3 解耦断言）。
    - 变更内容：表头行高全站恒定 `var(--row-h)`（40px），与 density 无关；body 行高保留 density 令牌（poster 80 / compact 32 / comfortable 40）。不新增 token、不改公共 Props、不动 `--row-h-relaxed` 悬空令牌（记后续 token 清理）。
    - 验收要点：videos/sources 表头 80→40px；其余页面零变化；body 行高/poster 缩略图零变化；全量单测零回归 + 新增解耦断言通过。
    - 完成备注：表头高度从 `rowHeight`（density 令牌）拆出独立 `headerHeight = 'var(--row-h)'` 常量恒定传 `DataTableHeaderRow`；内部 prop `rowHeight`→`headerHeight` 重命名（`DataTableHeaderRowProps` 未公开导出，零外部影响）；body 行 `rowStyle` 仍用 density `rowHeight` 不变。**videos/sources 表头 80→40px**、crawler 抽屉 32→40px、其余页面不变；body 行高/poster 缩略图零变化。门禁全过：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 454 files 6018 passed 0 failed 零 flaky**（净 +3 解耦断言：poster/compact/comfortable 三态表头恒 `var(--row-h)`）。无新端点/schema/ADR/token。共享层沉淀评估：本身即共享组件内部修正，无需再沉淀。执行模型: claude-opus-4-8

### SEQ-20260602-01 设计标准（确立）

- **后台表格表头行高 = 全站恒定 `var(--row-h)`（40px），与 body 行 density 完全解耦。**
- body 行高继续按 density 取令牌：comfortable 40 / compact 32 / poster 80 / relaxed 48。
- 表头不随 poster/compact 伸缩（表头只渲染列名）；新表格不得给表头单独设密度高度。
- `--row-h-relaxed`（48px）当前为 DataTable 不可达悬空令牌（density union 无 relaxed），本卡不删，记后续 token 清理。

---

## [SEQ-20260602-02] 播放线路表格操作列实装（refresh / zap / more）

- **状态**：✅ 已完成
- **创建时间**：2026-06-02 18:00
- **最后更新时间**：2026-06-02 18:25
- **目标**：实装播放线路表格（SourcesClient/SourceColumns）操作列——设计 §6.2 的 refresh / zap / more 三键真实功能 + UI/UX（pending / toast / 刷新本行）。
- **范围**：apps/server-next sources 模块（行操作组件 + 列定义 + 接线 + 测试），复用既有 api 端点与共享 AdminDropdown/useToast，无新端点/schema/共享契约。
- **依赖**：CHG-VSR-3（VideoGroupRow 派生计数）✅ / CHG-VSR-5-A（列重构）✅。

1. **CHG-VSR-SOURCES-ROW-ACTIONS** — 播放线路表格操作列三键实装（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
    - 创建时间：2026-06-02 18:00
    - 完成时间：2026-06-02 18:25
    - 建议模型：sonnet（标准功能实现 + 复用既有 api/共享 AdminDropdown；无新共享契约 / 无 schema → 不触发 Opus 门禁）
    - 变更原因：播放线路表格操作列为纯占位（`SourceColumns.tsx:265-289` ↻/⋯ 仅 `stopPropagation`，无功能），注释「真实接通留 CHG-VSR-5-B + 6」但 5-B/6 均未接，遗留未实装。设计 §6.2 要求 `btn--xs ×3：refresh / zap / more`。
    - 影响的已完成任务：CHG-VSR-5-A（占位列由本卡接通，列 id 不变不破坏 e2e）。
    - 用户裁决（AskUserQuestion 2026-06-02）：① 三键 = refresh(↻) `batchProbeVideo`（重探连接）/ zap(⚡) `batchRenderCheckVideo`（重验播放）/ more(⋯) `AdminDropdown`，均带 pending + toast + 刷新本行；② more 菜单 4 项 = 展开/收起线路 · 重新采集源(`refetchSources`) · 停用全失效源(`disableDeadSources`，danger，仅 connectFail+renderFail>0 显示) · 线路别名管理（深链）。
    - 文件范围：新建 `apps/server-next/src/app/admin/sources/_client/SourceRowActions.tsx`（行操作组件，对齐 videos `VideoRowActions` 范式）；改 `apps/server-next/src/app/admin/sources/_client/SourceColumns.tsx`（`buildColumns` 签名增 `actions` handlers + 操作列 cell 换 `<SourceRowActions>`）；改 `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx`（传 handlers：`onReload=refresh` / `onExpandToggle=toggleExpand`）；新建 `tests/unit/components/server-next/sources/SourceRowActions.test.tsx`。
    - 变更内容：三键接既有 api（batch-probe / batch-render-check / refetch-sources / disable-dead 端点已存在，无新增）+ `useToast` 反馈（复用 SourceLinesExpand summary 文案口径 `ok/total · dead 失效 · failed 异常`）+ pending 期禁用全部按钮 + 完成后 `onReload` 刷新本行信号；条件菜单项基于 VideoGroupRow 派生计数。
    - 验收要点：三键各调对应 api + toast + 刷新；停用全失效源仅在有失效源时出现 + danger；pending 禁用；列 id 不变（e2e 零破坏）；门禁全过 + 新增组件测试。
    - 完成备注：新建 `SourceRowActions` 组件（范式对齐 videos `VideoRowActions`）：↻=`batchProbeVideo`（重探连接）/ ⚡=`batchRenderCheckVideo`（重验播放）行内键 + ⋯=`AdminDropdown`（展开/收起线路 · 重新采集源`refetchSources` · 停用全失效源`disableDeadSources`〔danger + 仅 `connectFailCount+renderFailCount>0` 显示〕 · 线路别名管理深链）。`run` 统一 pending 守卫（禁用全部按钮）+ 各 handler `try/catch` `useToast` 反馈（复用 SourceLinesExpand summary 文案口径 + level success/warn/danger/info）+ 成功后 `onReload()` 刷新本行聚合信号；容器层 stopPropagation 防误触行展开。`buildColumns(expandedKeys)`→`buildColumns(expandedKeys, actions)` 接 `{onExpandToggle,onReload}`；SourcesClient 抽 `toggleExpand(videoId)`（行点击 + 菜单共用）+ 传 `onReload=refresh`。复用既有 4 端点（batch-probe / batch-render-check / refetch-sources / disable-dead），**无新端点/schema/ADR/共享契约**。门禁全过：typecheck/lint/verify:adr-contracts EXIT=0 / **全量 455 files 6028 passed 0 failed 零 flaky**（净 +10 = SourceRowActions.test U-1..U-10：三键/菜单/条件项/pending/失败不刷新）/ sources 4 文件 37/37（含 SourcesClient.test 渲染新 cell）。列 id `actions` 不变，e2e 零破坏。共享层沉淀评估：app-local 行操作组件（消费方专属），范式已复用共享 AdminDropdown，无需再沉淀。执行模型: claude-opus-4-8
      - **Codex stop-time review FIX（refresh/zap 越权暴露）**：实证核验端点守卫——`batch-probe`(refresh)/`batch-render-check`(zap)=`adminOnly`，`disable-dead`/`refetch`=`moderator+admin`；middleware 使 sources 页 moderator 可达 → moderator 暴露 admin-only 二键。修复：`page.tsx` 读 `user_role` cookie → `isAdmin` 透传 → 非 admin 时 refresh/zap disable+tooltip（对齐 CrawlerSiteExpand/VideoRowActions），more 菜单不门控。+U-11..U-14；全量 455 files 6032 passed 零回归。

---

## [SEQ-20260602-03] 视频身份解析与合并/拆分升级（Entity Resolution）

- **状态**：🟡 规划中
- **创建时间**：2026-06-02 19:41
- **最后更新时间**：2026-06-02 21:00（**Phase 0 CHG-VIR-1/2/3 ✅**〔ADR-105a/175/176 Accepted〕 **+ 前置门禁 CHG-VIR-PRE-1 ✅**〔insertNewVideo schema 漂移修复 / 全量零回归〕 **+ CHG-VIR-PRE-2 ✅**〔ADR-177 关系定档「并存+上卷」/ arch-reviewer 认可〕；**CHG-VIR-4〔ADR-177〕依赖已满足、可起草**，留用户决定；Phase 1+ 实施待启动）
- **目标**：把「标准化标题 → 单 key 命中即合并」升级为 Entity Resolution（Blocking 召回 → 多证据 Scoring → 阈值分级 Decision → 可逆审计 + 决策记忆），为合并/拆分提供稳健、可解释、可回滚基础。严格按「先旁路 → 再影响排序 → 最后碰生产归并阈值」推进。
- **范围**：`apps/api`（TitleIdentityParser 新增 / MediaCatalogService.findOrCreate / VideoMergesService / CrawlerService / 离线候选 job / migrations）+ `packages/types` + `apps/server-next`（/admin/merge + 审核台 similar tab 统一候选）+ `docs/decisions.md`（4 份 ADR）+ `docs/architecture.md`（schema 同步）。
- **方案全文**：`docs/designs/video-identity-resolution-redesign_20260602.md`（commit 27c29a5d；含 §9 arch-reviewer 审核 + §10 修订处置）。
- **关联 ADR**：新增 ADR-105a / ADR-175 / ADR-176 / ADR-177；ADR-105 AMENDMENT 2026-06-02（旧 ADR-105a 方向已取代，commit a35bfa36）；ADR-137（similar 算法 Phase 2c 取代）；ADR-174（D-174-3 重指向语义迁移）；ADR-114-NEGATED（跨站不合并，不触碰）。
- **红线**：禁改 `normalizeTitle`/`normalizeMergeKey` 语义（`core_title_key` 新增并行）；禁 pg_trgm / 技术栈外依赖；繁简不归一（并列 alias）；候选对象 Phase 1-4 = video-pair，catalog 身份层留 Phase 5。
- **执行节奏**：前置门禁 `PRE-1`（独立正确性）+ `PRE-2`（ADR-177 关系预研）→ Phase 0 四份 ADR 起草（**全 Opus + arch-reviewer PASS**，任一红线未闭环 → BLOCKER 停）→ Phase 1 旁路 → Phase 2 候选证据化(2a/2b/2c) → Phase 3 ingest shadow → Phase 4 拆分+清洗 → Phase 5 catalog 身份层。
- **依赖链**：`PRE-1`（任意时点）；`PRE-2 → CHG-VIR-4`；`CHG-VIR-1/2/3/4`（Phase 0，可并行）→ `CHG-VIR-5/6`（Phase 1）→ `CHG-VIR-7/8/9`（Phase 2）→ `CHG-VIR-10`（Phase 3）；`CHG-VIR-11`（Phase 4，依赖 PRE-1+Phase1）；`CHG-VIR-12`（Phase 5，依赖 ADR-176/177 + Phase1-4 稳定）。
- **粒度说明**：Phase 0（ADR 起草卡）验收已具体；Phase 1-5 实施卡为**规划占位**，详细文件范围/验收待对应 ADR 定档后于启动前补全（task-queue「提前规划」性质）。

### 任务列表（按执行顺序）

**前置门禁**

1. **CHG-VIR-PRE-1** — `insertNewVideo` schema 漂移排查修复（现网正确性隐患）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 无）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（既有正确性修复，无新契约）
   - 变更原因：`apps/api/src/db/queries/video-merge-mutations.ts:299-310` split 新建 video 的 INSERT 仍引用已由 migration 029 DROP 的 `videos.year` / `videos.title_normalized`，拆分到新建 video 路径会命中（arch-reviewer 未决项 3）。
   - 文件范围：`video-merge-mutations.ts`（insertNewVideo INSERT 列对齐现行 videos schema，year/title_normalized 不再写 videos，按需落 media_catalog）+ 回归测试。
   - 验收要点：split 新建 video 不引用已删列；现有 split/unmerge 测试零回归；typecheck/lint/test 全过。
   - 依赖：无（独立，建议早做；Phase 4 前必修门禁）。
   - 完成备注：**insertNewVideo schema 漂移修复**。① `insertNewVideo`(video-merge-mutations.ts) 改签名 `{shortId,catalogId,title,type}`，INSERT 列对齐 029 后 videos schema（删已 DROP 的 year/title_normalized，加 catalog_id NOT NULL，范式对齐 `videos.mutations.createVideo`）；② `VideoMergesService` 构造注入 `MediaCatalogService`，split **事务前**对每 group `findOrCreate` 作品层 catalog（幂等；事务外，回滚至多留无害孤儿 catalog）→ 事务内 `insertNewVideo` 传 catalogId。**范围澄清**：卡片原列单文件不足以修（catalog_id NOT NULL + findOrCreate 编排在 Service 层），必要适配延伸 VideoMergesService.ts。测试：更新现有权威 `video-merge-mutations.test.ts` split（mock MediaCatalogService.findOrCreate + happy path 断言 catalogId 替代 year + 事务失败 ROLLBACK 补 findOrCreate 就绪）+ 新建 `video-merge-insert-new-video.test.ts`（insertNewVideo 真实 SQL）。**Codex stop-time review FIX**：现有 split 单测与新 catalog 依赖不兼容（初次 grep 漏 video-merge-mutations.test.ts）→ 适配 + 删初版重叠的 video-merge-split-catalog.test.ts。门禁 typecheck/lint/verify×2 EXIT=0 + **全量 456 files 6034 passed 0 failed 零回归**（StagingEditPanel jsdom flaky 隔离+全量均通过，非本卡）。无新端点/migration/ADR。执行模型: claude-opus-4-8（建议 sonnet，opus 覆盖：事务设计+依赖注入更稳妥）

2. **CHG-VIR-PRE-2** — ADR-177 前置：`video_external_refs` ↔ `catalog_external_refs` 关系预研定档（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**（架构关系决策 + arch-reviewer 第二意见）
   - 变更原因：arch-reviewer R1——设计 §4.6 新提 `catalog_external_refs` 与既有 `video_external_refs`（migration 041/045）语义重叠层级不同；**关系未定不得起草 ADR-177**。
   - 产出：定档「替代/并存/上卷」关系（设计临时定向「并存+上卷」）+ D-174-3 现有写 `video_external_refs` candidate 路径迁移方案 + 两表 candidate/rejected 审计是否合并。
   - 验收要点：关系三选一明确 + 上卷规则 + D-174-3 迁移路径；arch-reviewer 认可后方可起 CHG-VIR-4。
   - 依赖：无。
   - 完成备注：**关系预研定档完成（arch-reviewer claude-opus-4-8 / agentId a6cc563d53376800e / CONDITIONAL → R-1 + Y-1~4 吸收 → 认可起 CHG-VIR-4）**。新建 `docs/designs/adr177-external-refs-relation_20260602.md`。**关系三选一定档「并存 + 上卷」**：排除「替代」（`video_external_refs` = video 级真源 + 4 富集 Service 写 + 后台审核台 UI 读展示链 listVideoExternalRefs→getAdminVideoById→external-meta-panel，层级职责不同）/「纯并存」（双真源 findOrCreate 无来源）；video_external_refs 保留 video 级不改，catalog_external_refs 为 catalog 级 canonical，上卷桥接。**上卷规则**（确定性保守）：manual_confirmed primary 一致 + 精确级 → exact / auto_matched 一致 → candidate / 冲突 → candidate 不自动 exact / 跨 catalog 同 external_id 按 external_kind+season_number 裁定（show 级→parent 一对多 / season·movie→exact / exact 冲突→candidate 归并信号）。**D-174-3 迁移**：过渡期保留 video 级 candidate；ADR-177 落地新增 catalog_external_refs candidate（双写过渡，catalog_id 归属结合 D-174-7 留 ADR-177）；目标 catalog 层冲突归 catalog_external_refs。**两表审计不合并**：层级独立，video rejected 不传播 catalog rejected，catalog exact 不覆盖 video rejected；candidate/rejected 不进 partial unique（仅 exact/parent 受全局唯一）。arch-reviewer R-1（§1 漏后台 UI 读消费链 / ADR-172 AMD3，已校正）+ Y-1/2/3/4 全吸收。门禁 verify:adr-contracts EXIT=0；纯 docs 新建预研文档，无代码/migration/ADR。**解锁 CHG-VIR-4**。执行模型: claude-opus-4-8

**Phase 0 — ADR 起草（全 Opus + arch-reviewer PASS；任一红线未闭环 → BLOCKER）**

3. **CHG-VIR-1** — ADR-105a 起草（多证据评分 / 阈值分级 / 候选持久化 / 离线生成）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**（ADR 起草，强制 arch-reviewer PASS）
   - 范围：评分公式（强正/中正/强负 + 0.92/0.75 阈值）+ `core_title_key` 确定性等值 blocking（B-tree，非 pg_trgm）+ `identity_candidate` schema + 离线生成 job 性能模型（实时端点继承 ADR-105 p95 / 离线另立基线，Y5）+ **type 兼容矩阵**（代码常量真源，未决 2）+ `evidence_hash` 输入域（未决 5）+ Y1 幂等约束 + Y3 confirmed→merge 事务边界。
   - 门禁：Opus 子代理 + arch-reviewer PASS + commit trailer Subagents；落 decisions.md ADR-105a 章节。
   - 验收要点：评分/阈值/候选 schema/离线模型/type 矩阵/evidence_hash 全闭环；与 ADR-105 端点契约兼容；arch-reviewer PASS。
   - 依赖：无（可与 CHG-VIR-2/3/4 并行）。
   - 完成备注：**ADR-105a Accepted（arch-reviewer claude-opus-4-8 / agentId a3933826a5e470df8 / CONDITIONAL → 4 项修订吸收）**。decisions.md 尾部追加完整 ADR-105a（13 D 条 + `identity_candidate` DDL 草案 + type 兼容矩阵 + 三类证据权重表 + 聚合公式 + evidence_hash 输入域 + 10 红线 + 5 黄线 + 后果 + follow-up）；architecture.md §5.15 加「规划草案/未落 migration」前瞻小节。R1-R3（normalizeTitle/normalizeMergeKey 解耦 + core_title_key 等值非模糊 + identityScore/legacyScore 分离）+ Y1/Y3/Y5（幂等 partial unique / confirmed→merge 事务边界 / 性能基线分离）+ 未决 2/5（type 矩阵代码常量真源 / evidence_hash 输入域）全闭环。arch-reviewer 3 必修 + 1 建议全吸收：RR-1（分级可达性确定性映射 + 非 exact 封顶 0.90 + exactScore=0.95 取值理由）/ YY-1（external_exact 数据源校正 `video_external_refs.is_primary=true AND match_status='manual_confirmed'`，现表无 relation/exact）/ YY-3（exact 仅豁免 type_incompatible 单条 veto）/ YY-2（矩阵中性为初始保守取向）。门禁：verify:adr-contracts EXIT=0（verify-endpoint-adr ✅ 203 路由对齐 / 其余 ⚠️ 既有 advisory 与本 ADR 无关）+ verify:endpoint-adr EXIT=0；纯 docs 无 TS/TSX，typecheck/lint/test 基线不受影响。未新增端点/migration（identity_candidate 留 Phase 2b CHG-VIR-8）。执行模型: claude-opus-4-8

4. **CHG-VIR-2** — ADR-175 起草（多语种标题模型）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：`media_catalog` 字段语义收紧（新增 `original_language` / `title_original` 原语种 / `title_en` 仅英文）+ `media_catalog_aliases` 结构化升级（region/script/kind/confidence/is_primary_for_locale）+ **locale fallback 链**（未决 1，简繁不归一并列 alias）+ 匹配分层（同语种强 / 跨语种 alias 中强 / 罗马音辅助）。
   - 门禁：Opus + arch-reviewer PASS；落 decisions.md ADR-175 + architecture.md schema 同步。
   - 验收要点：字段语义 + aliases 升级 + fallback 确定性规则 + 匹配分层；arch-reviewer PASS。
   - 依赖：无。
   - 完成备注：**ADR-175 Accepted（arch-reviewer claude-opus-4-8 / agentId a714ba080c9641c5e / CONDITIONAL → 4 项修订吸收）**。decisions.md 追加 ADR-175（6 D 条：`original_language` 新增 + `title_original`/`title_en` 语义收紧 / `media_catalog_aliases` 5 列结构化升级〔region/script/kind/confidence/is_primary_for_locale〕+ partial unique / display_title 确定性 locale fallback 链 / 匹配分层复用 ADR-105a 既有极性 / `aliases[]` 数组列降级只读单一真源 / 写入口径；7 红线 + 5 黄线）；architecture.md §5.1a 加规划草案小节。arch-reviewer 红线-1（D-175-4 极性映射交叉错配 → 改为复用 ADR-105a `external_alias_match` 强正 / `core_title_key_equal` 中正，不回写 105a）+ 红线-2（拼音迁出须对 catalog 层 `title_en` 独立调 `isPinyin`，video 层 `title_en_is_pinyin` 仅参考）+ 黄线-1（基础去重键保留 `(catalog_id,alias)`）+ 黄线-2（回填先 lang/script/region 再选 primary）全吸收。门禁 verify:adr-contracts/endpoint-adr EXIT=0（203 路由对齐 + sql-schema 对齐 / adr-d-status.json 登记 D-175-1..6）；纯 docs 无 TS/TSX。**发现既有债务（范围外留痕）**：① architecture.md `release_date TEXT` vs migration 026 `DATE` 不一致（黄线-3，另立修正卡）；② verify-adr-d-numbers 正则 `D-\d+-\d+` 不识别 ADR-105a 的 `D-105a-N`（字母 ADR 编号审计盲区，D-105a-1..13 未进 adr-d-status.json），建议后续 MAINT 放宽正则。执行模型: claude-opus-4-8

5. **CHG-VIR-3** — ADR-176 起草（catalog 按季粒度 + series_group）（状态：✅ 已完成 2026-06-02 / claude-opus-4-8 / 子代理 arch-reviewer (claude-opus-4-8)）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：catalog 按季粒度（第二季/SP/OVA 独立 catalog）+ **season_number 纳入 catalog 唯一键**（解 `026:84` 唯一索引 + `normalizeTitle` 剥季的硬阻塞）+ `series_group`/`catalog_relations`（season_of/edition_of/remake_of/spinoff_of/same_work_candidate）+ catalog 无 `deleted_at` 的「删前全字段快照」回滚范式（未决 4，继承 migration 084）。
   - 门禁：Opus + arch-reviewer PASS；落 decisions.md ADR-176 + architecture.md。
   - 验收要点：唯一键改造方案 + series_group 模型 + 回滚范式；arch-reviewer PASS。
   - 依赖：无。
   - 完成备注：**ADR-176 Accepted（arch-reviewer claude-opus-4-8 / agentId a8930709146880a0f / CONDITIONAL → 5 项修订吸收）**。decisions.md 追加 ADR-176（6 D 条 + 7 红线：`season_number` 列 + 唯一键改造 `COALESCE(season_number,0)` 解「无外部 ID 分季撞 partial unique」硬阻塞〔存量 NULL→0 逐值不变〕/ catalog 按季粒度〔S2/SP/OVA/剧场版独立〕/ `catalog_relations` 5 关系有向图 + `series_group` 可选锚 / catalog 无 `deleted_at` 删行回滚范式〔继承 084 + ADR-174 D-174-6 R11/R12〕/ findOrCreate 不纳入 season 留 Phase 5）；architecture.md §5.1a 加规划草案小节。arch-reviewer R-1（`catalog_relations` 反对称四 relation 单向无环 + `same_work_candidate` 对称规范化有序对 → 补关系不变量 + R7）+ R-2（合并删行关系边端点重指向 survivor + old/new 双列快照回滚复位）+ Y-A（哨兵 0 依赖 `CHECK>0` 禁放宽）+ Y-B（回填全系列一致禁半回填）+ Y-C（architecture 同步端点重指向）全吸收。门禁 verify:adr-contracts/endpoint-adr EXIT=0（203 路由 + sql-schema 对齐 / adr-d-status.json 登记 D-176-1..6）；纯 docs 无 TS/TSX。执行模型: claude-opus-4-8

6. **CHG-VIR-4** — ADR-177 起草（外部 ID 映射真源 `catalog_external_refs`）（状态：⬜ 未开始）
   - 创建时间：2026-06-02 19:41
   - 建议模型：**opus**
   - 范围：`catalog_external_refs`（provider/external_id/external_kind/relation/season_number/confidence/source/is_primary）+ partial unique index（exact 唯一 / parent 一对多 / candidate·rejected 审计保留）+ 四列降级为 cache（仅 `relation=exact AND is_primary` 回填）+ findOrCreate 改读映射表 + ADR-174 D-174-3 重指向语义迁移 + 既有数据迁移。
   - 门禁：Opus + arch-reviewer PASS；**硬前置 CHG-VIR-PRE-2 关系定档**；落 decisions.md ADR-177 + architecture.md。
   - 验收要点：映射表 schema + 约束分级 + cache 规则 + 迁移路径；arch-reviewer PASS。
   - 依赖：**CHG-VIR-PRE-2**。

**Phase 1 — 纯函数旁路（零生产行为变更；实施卡详细范围待 ADR 定档细化）**

7. **CHG-VIR-5** — Phase 1a：TitleIdentityParser 纯函数 + fixture（状态：⬜ 未开始）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（纯函数实施，规格来自 ADR-105a/175）
   - 范围：新建 `apps/api/src/services/TitleIdentityParser.ts` `parseTitle(raw)→{coreTitleKey,facets,titleKind,parserVersion,confidence}`；**不改 TitleNormalizer**；大量 fixture（书名号/全半角/标点 · 国语/粤语/字幕 · 加长/导剪/SP/OVA/剧场版 · 第N季/S2/Part2/序号 · 源站噪声）。**Y4**：fixture 须区分「序号即身份（复仇者联盟4）」与「序号即季/卷（第4季）」。
   - 验收要点：fixture 全绿 + `normalizeTitle`/`normalizeMergeKey` 输出完全不变；facets 仅观测不参与决策。
   - 依赖：CHG-VIR-1（facets/parser 规格）。

8. **CHG-VIR-6** — Phase 1b：title_observations 去重聚合表 + shadow 写入（状态：⬜ 未开始）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet（schema 来自 ADR；实施）
   - 范围：migration `title_observations`（去重唯一键 video_id+site_key+source_name+raw_title_hash+parser_version；observed_count/first_seen/last_seen）+ 采集链路 shadow 写入；不参与合并决策。
   - 验收要点：去重生效（重复标题只增 observed_count）；零生产行为变更。
   - 依赖：CHG-VIR-5。

**Phase 2 — 候选证据化（候选对象 video-pair）**

9. **CHG-VIR-7** — Phase 2a：现有 N-video group 候选附加 evidence（不改来源）（状态：⬜ 未开始）
   - 创建时间：2026-06-02 19:41
   - 建议模型：sonnet
   - 范围：VideoMergesService 候选保持现状 `mc.title_normalized+mc.year+v.type` N-video group（来源/排序/数量不变）；附加 `identityScore`/`evidence`/`blockingReasons`/`strongNegativeReasons`（**禁复用 legacyScore=source_overlap_ratio**）；UI 展示「为何可合并/为何拦截」。
   - 验收要点：候选数量/分页/默认排序与旧逻辑一致；仅新增 evidence 字段。
   - 依赖：CHG-VIR-5 + CHG-VIR-1。

10. **CHG-VIR-8** — Phase 2b：`identity_candidate` shadow 写入 + 离线生成 job（状态：⬜ 未开始）
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（离线 job + identity_candidate 幂等/状态机，跨消费方）
    - 范围：identity_candidate 落地（Y1 partial unique `(canonical_pair_key) WHERE status='pending'` 单事务 upsert / Y2 复活链 `revived_from_candidate_id` / Y5 版本重算可见性）+ 离线 Bull job（Blocking 多 key 并集 → Scoring → 写 candidate）；与现有候选并行对照，不切 UI。
    - 验收要点：shadow candidate vs 旧候选对比报表（新增召回/误召回可解释）；幂等无重复 pending。
    - 依赖：CHG-VIR-7 + CHG-VIR-1。

11. **CHG-VIR-9** — Phase 2c：切 UI 默认候选来源（/admin/merge + 审核台 similar 统一）（状态：⬜ 未开始）
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（取代 ADR-137 similar 算法；端点变更可能需 ADR amendment）
    - 范围：/admin/merge + 审核台「类似」tab 默认读 identity_candidate（C2：取代 ADR-137 四维加权）；旧实时 group by + ADR-137 算法降级 fallback。
    - 验收要点：两入口共用候选来源；UI 可回退旧来源；端点变更先补 ADR。
    - 依赖：CHG-VIR-8。

**Phase 3 — ingest-time shadow scoring**

12. **CHG-VIR-10** — Phase 3：findOrCreate 旁路 shadow scoring（不改 catalog_id 绑定）（状态：⬜ 未开始）
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（findOrCreate 是采集入库核心归并点）
    - 范围：MediaCatalogService.findOrCreate 旁路计算「新评分会绑哪个 catalog」+ 记录 shadow decision/evidence + 对比现有 5 步；模糊只写 identity_candidate，**不自动绑定**；仅强 exact ID + 无强负 + 与现有 5 步一致才与现行为一致绑定（Y3 事务边界）。
    - 验收要点：shadow precision/recall 报表；生产 catalog_id 零变更；是否开自动绑定留另起 ADR/Phase 5。
    - 依赖：CHG-VIR-8。

**Phase 4 — 拆分证据化 + 多语种清洗**

13. **CHG-VIR-11** — Phase 4：拆分自动分组建议 + title_en 拼音迁出 + original_language 回填（状态：⬜ 未开始）
    - 创建时间：2026-06-02 19:41
    - 建议模型：opus（拆分增强 ADR-105 split amendment）+ sonnet（数据清洗）
    - 范围：拆分按 season/edition/core_title/外部ID/集数范围生成分组建议 + 支持拆到已有/新建 video（仍走 `video_merge_audit`）；title_en 拼音/罗马音迁出结构化 aliases（PinyinDetector）；original_language 回填。
    - 验收要点：拆分建议覆盖维度 + 审计强一致；拼音迁出/回填正确。
    - 依赖：**CHG-VIR-PRE-1**（insertNewVideo 已修）+ CHG-VIR-5 + CHG-VIR-2。

**Phase 5 — catalog 身份层（独立阶段，video-pair 链路稳定后）**

14. **CHG-VIR-12** — Phase 5：catalog_external_refs 落地 + 四列降级 + catalog 按季 + series_group + catalog-catalog 合并（状态：⬜ 未开始）
    - 创建时间：2026-06-02 19:41
    - 建议模型：**opus**（catalog 身份层重构，最高风险）
    - 范围：落地 catalog_external_refs + findOrCreate 改读映射表 + 四列降级 cache + catalog 唯一键纳入 season_number + series_group/catalog_relations + catalog-catalog 合并（restore snapshot + 子表恢复，不依赖 deleted_at）+ 评估开启真实自动 catalog 绑定。
    - 验收要点：外部 ID 迁移前后 exact cache 与映射表一致；parent 一对多不污染 cache；catalog 合并可回滚。
    - 依赖：CHG-VIR-3 + CHG-VIR-4 + Phase 1-4 稳定。
