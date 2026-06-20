# 图片健康（image-health）页面重构 — UI/UX 设计 + 技术方案报告

> 文档用途：供设计师 / 工程接手「`/admin/image-health` 页面重构 —— 图片管理、预览、数据汇总、破损图片更新替换」。
> 接手方式：通过远端 git repo 拉取，无需本地后端环境即可阅读全部接触点、机制与数据契约。
> 撰写日期：2026-06-18 ｜ 代码基线：`dev` 分支 head ｜ 阅读对象：交互/视觉设计师 + 实现工程
> 性质：**设计 + 方案报告**，本身不含可执行代码改动；实现按 §15 分期推进，届时另起任务卡。

---

## 0. 30 秒速览

`/admin/image-health` 当前是一个**只读监控仪表盘**：KPI（覆盖率）+ TOP 破损域名 + 破损样本 Grid + 缺图视频表 + 4 个全局 action（重扫 / backfill / 切 fallback 域 / 刷新）。它能"看健康、定位坏 CDN、跑批量动作"，但：

- **缺"图片管理 / 预览"**：无法在页内查看、放大、对比单条作品的封面与背景图素材。
- **缺"破损更新替换闭环"**：后端已有单图替换能力，但页面未编排成"选破损 → 选新图 → 对比预览 → 替换 → 回探"的顺滑流程。
- **缺"自动化补救"**：破损后**完全没有任何自动替换**，全靠人工逐条处理。
- **数据/文档存在偏差**：手册多处与代码不符（端点路径、backfill 含义、状态枚举名，见 §3）。

**重构目标定位：从「只读监控」升级为「概览 + 管理 双 Tab 治理工作台」。** 四个目标的落点：

| 用户目标 | 落点 | 主要章节 |
|---------|------|---------|
| 数据汇总 | Tab A 健康概览（KPI + 趋势 + TOP 域 + 失效分布） | §5.1 |
| 图片管理 | Tab B 图片治理（强化 DataTable + 治理抽屉） | §5.2 / §6 |
| 预览 | Lightbox 放大 + 替换对比并排 | §6.1 / §6.2 |
| 破损更新替换 | 单图替换 + 外部源补图 + 分级自愈 | §6.3 / §7 / §8 |

**关键设计决策（已与需求方确认）：** 双 Tab；预览要 Lightbox + 替换对比两形态；破损自动替换采用**分级自愈**（高置信自动 / 低置信入人工队列 / 无候选手填）；通知走**站内**（Dashboard 真实端点 + admin-shell drawer）+ **阈值告警推送**。先用现有后端能力做 UI 编排，新端点列为增量（本报告设计清楚，不在本期实现）。

---

## 1. 业务背景：什么是「图片健康」

Resovo 不托管视频，封面/背景图等图片是**外链**（来自采集源站、TMDB、豆瓣 CDN 等）。外链随时可能 404 / 超时 / 被源站删除，导致前台展示坏图。「图片健康」就是对全库图片的可用性做**检测 → 监控 → 治理（替换/重探/切域）**的闭环。

一条「作品」（`media_catalog`）的图片不是一张，而是一组（按优先级）：

| 优先级 | 图片类型 | 字段 | 形态 | 前台用途 |
|-------|---------|------|------|---------|
| P0 | 竖版封面 poster | `cover_url`（历史名未改） | 单张 | 卡片/列表主视觉（权重最高） |
| P1 | 横版背景 backdrop | `backdrop_url` | 单张 | 详情页 Hero 背景 |
| P2 | 台标 logo | `logo_url` | 单张 | 透明艺术字叠加 |
| P2 | Banner 横图 | `banner_backdrop_url` | 单张 | 焦点位横幅 |
| P3 | 剧照集合 stills | `stills_urls`（JSONB 数组） | **多张** | 详情页剧照墙 |
| — | 逐集缩略 thumbnail | `video_episode_images.thumbnail_url`（独立表） | 每集一张 | 选集列表 |

破损检测的事件全部沉淀到 `broken_image_events` 表（前台上报 + worker 探活共同写入），它是 TOP 破损域名、缺图列表、趋势等所有汇总的唯一数据底座。

---

## 2. 数据如何分层（理解「真相在哪」）

```
┌─ videos（视频实例层）──────────────────────────────────────────┐
│  可播放条目。image_governance_status：图片治理汇总门控          │
│   （pending / ok / missing_poster / broken_poster）            │
│  catalog_id ─┐ 指向所属"作品"                                  │
└──────────────┼────────────────────────────────────────────────┘
               ▼
┌─ media_catalog（作品/真源）── 图片 URL + 治理元数据的权威落点 ─┐
│  cover_url / backdrop_url / logo_url / banner_backdrop_url     │
│  stills_urls[] / stills_meta[]                                 │
│  {kind}_status / {kind}_blurhash / {kind}_primary_color        │
│  poster_source（crawler/tmdb/douban/manual/upload）            │
└───┬───────────────┬───────────────────┬───────────────────────┘
    ▼               ▼                   ▼
broken_image_events  metadata_field_     video_episode_images
（破损事件日志）       proposals          （逐集缩略，独立表）
                     （多源图片候选）
```

- **图片 URL 的权威落点在 `media_catalog`**（作品层），不是 `videos`（实例层）。替换图片最终都改这一层。
- **`broken_image_events`**：每条破损事件（去重 key = `video_id + image_kind + url_hash_prefix + bucket_start`），含 `event_type`、`occurrence_count`、`first/last_seen_at`、`resolved_at`。
- **`metadata_field_proposals`**：元数据富集时各外部源对图片字段（coverUrl/backdropUrl/logoUrl）提出的候选值 —— **这是「从外部源补图」的现成数据底座**（详见 §7）。
- **`videos.image_governance_status`**：本意是图片治理的视频级汇总门控，但**当前无推导逻辑**（详见 §9 缺口）。

### 2.1 schema 速查（来源：`apps/api/src/db/migrations/048_image_pipeline.sql`，ADR-046）

```sql
-- media_catalog 图片治理字段
poster_status   TEXT CHECK IN ('ok','missing','broken','low_quality','pending_review')  DEFAULT 'pending_review'
backdrop_status TEXT CHECK IN ('ok','missing','broken','low_quality','pending_review')  DEFAULT 'pending_review'
logo_status     TEXT CHECK IN ('ok','missing','broken','pending_review')                DEFAULT 'missing'  -- 无 low_quality
banner_backdrop_status TEXT CHECK IN ('ok','missing','broken','pending_review')         DEFAULT 'missing'
poster_source   TEXT CHECK IN ('crawler','tmdb','douban','manual','upload')
stills_urls / stills_meta  JSONB NOT NULL DEFAULT '[]'  CHECK jsonb_typeof = 'array'

-- videos
image_governance_status TEXT CHECK IN ('pending','ok','missing_poster','broken_poster') DEFAULT 'pending'

-- broken_image_events.event_type（8 值）
'client_load_error' | 'empty_src' | 'fetch_404' | 'fetch_5xx'
| 'timeout' | 'decode_fail' | 'dimension_too_small' | 'aspect_mismatch'
```

---

## 3. 现状机制厘清（★ 含文档纠错）

设计前必须破除几个由旧文档造成的误解。**以下以代码为准。**

### 3.1 四个操作「各自真正改了什么」

| 操作 | 端点（真实） | 真实行为 | 改 URL？ | 审计 |
|------|------------|---------|---------|------|
| **重扫 rescan** | `POST /admin/image-health/rescan` | 把符合 scope（broken_only/missing_only/all）的 `poster_status` 重置为 `pending_review`，且要求 `cover_url IS NOT NULL`；只动 poster，**不动 backdrop** | **否** | scope + updatedCount |
| **回填 backfill** | `POST /admin/image-health/backfill` | 扫 `pending_review` 图片 + 缺 blurhash 的 ok 图片，分批入队 `health-check` / `blurhash-extract` job | **否** | — |
| **切 fallback 域** | `POST /admin/image-health/switch-fallback-domain` | 对 `media_catalog` 三列（`cover_url`/`backdrop_url`/`banner_backdrop_url`）按 `'://' \|\| domain \|\| '/'` 精确匹配 `REPLACE`；dryRun 仅 COUNT 预览 | **是** | `image_health.switch_domain` |
| **单图替换** | `PUT /admin/videos/:id/images` | 写 `{kind}_url` + 状态置 `pending_review`，入队 `health-check` + `blurhash-extract` | **是** | 经 `media_catalog.updated_at` |
| **自动替换** | —（不存在） | 破损仅标 `broken` + 写 `broken_image_events`，**无任何换源逻辑** | — | — |

> 关键澄清："**fallback 域**" = 直接改库里存的图片 URL 的**域名段**（如把失效的 `img3.doubanio.com` 整体替换为另一个 CDN 域）。它与前端 `image-loader` 的 CDN 代理（passthrough / cloudflare 两模式）**完全无关**，不要混淆。回滚仅靠 audit log 反向手动操作（无自动逆操作）。

### 3.2 破损后没有任何自动替救（重要）

- `imageHealthWorker`：HEAD 探活失败 → 写 `broken_image_events`；连续 ≥3 次失败 → 仅标 `{kind}_status = 'broken'`。尺寸/比例不符 → 标 `low_quality`。**没有任何"自动换源/自动补图/self-heal"代码。**
- 前台 `SafeImage` onError → 只降级到 `FallbackCover`（占位），**不尝试其它 URL**。
- 全部治理动作都是人工触发（重扫 / 切域 / 手填 URL）。

### 3.3 文档纠错清单（实现期需同步修正手册）

| 位置 | 旧文档说法 | 代码实际 |
|------|-----------|---------|
| `P-image-health.md §3.2` | backfill "重新下载所有 broken 封面到 fallback CDN" | 仅入队探活/blurhash job，**不下载、不改 URL** |
| `P-image-health.md §0/§3` 端点 | `/admin/images/health`、`/admin/images/missing` … | 实际为 `/admin/image-health/stats`、`/missing-videos` … |
| `P-image-health.md §5` 状态 | `poster_status = 'dead'` | 实际枚举无 `dead`，失效态是 `'broken'` |

---

## 4. 核心数据契约（设计师必读）

页面消费的 DTO（真源 `apps/server-next/src/lib/image-health/api.ts`）：

```ts
ImageHealthStats {
  totalVideos; posterOkCount; posterCoverage(0–1);
  backdropOkCount; backdropCoverage; brokenLast7Days;
  brokenTrend?: { day; count }[]        // 7 日趋势（getBrokenEventsTrend 已提供，按日补 0）
}
BrokenDomainRow   { domain; eventCount; affectedVideos }
MissingVideoRow   { videoId; title; posterStatus; posterUrl; posterSource;
                    lastSeenBrokenAt; brokenDomain; occurrenceCount }
SwitchDomainResult{ dryRun; affectedRows; affectedColumns;
                    breakdown: { cover_url; backdrop_url; banner_backdrop_url } }
```

### 4.1 状态枚举语义（设计稿状态色映射到此，不发明 UI 私有态）

| `{kind}_status` | 视觉建议 | 含义 |
|----------------|---------|------|
| `ok` | 绿 dot | 探活通过，可用 |
| `pending_review` | 灰 dot | 新写入/待重探（中间态） |
| `missing` | 灰 dot（虚） | URL 为空，未设置 |
| `broken` | 红 dot | 探活失败（404/5xx/timeout/decode） |
| `low_quality` | 黄 dot | 尺寸过小 / 比例不符（仅 poster/backdrop 有此态） |

| `event_type` | 破损原因（UI 可作筛选维度） |
|-------------|------|
| `fetch_404` / `fetch_5xx` | 源站 HTTP 错误 |
| `timeout` | 探活超时 |
| `client_load_error` / `empty_src` | 前台加载失败 / 空 src |
| `decode_fail` | 解码失败（损坏文件） |
| `dimension_too_small` / `aspect_mismatch` | 尺寸/比例不合格 |

| `poster_source` | 来源（替换优先级见 §7） |
|----------------|------|
| `manual` | 人工指定（优先级最高，可加锁） |
| `tmdb` / `douban` / `upload` | 外部源 / 上传 |
| `crawler` | 采集初值（优先级最低） |

---

## 5. 重构后信息架构：概览 / 管理 双 Tab

用 admin-ui `Segment`（pill 切换）+ `?tab=` query 承载两 Tab，置于 `PageHeader` 下方。整页滚动（Mode A，沿用现状）。**全局破坏性 action（重扫 / 切 fallback 域 / backfill）留在 PageHeader（跨 Tab 全局）；行级 / 选中级 action 下沉到「图片治理」Tab。**

```
┌────────────────────────────────────────────────────────────────┐
│ PageHeader: 图片健康        [刷新] [重扫破损] [批量切 fallback 域] │
│  〔健康概览〕  〔图片治理〕    ← Segment 双 Tab                    │
└────────────────────────────────────────────────────────────────┘
```

### 5.1 Tab A — 健康概览（数据汇总）

```
┌ KPI 4 列（KpiCard + Spark 迷你趋势）────────────────────────────────────┐
│ 已上架  │ Poster 覆盖率 │ Backdrop 覆盖率 │ 近 7 日新增破损 ▁▂▅▇        │
├─ 7 日破损趋势（Spark/折线，消费 brokenTrend）───────────────────────────┤
├─ 主体 1fr / 1fr ────────────────────────────────────────────────────────┤
│ TOP 破损域名（条形列表）          │ 破损样本 Grid（2:3 缩略）            │
│   每行尾 [切此域 →] 预填 from 域  │   点击缩略 → ImageLightbox 放大     │
├─ 失效分布（按 status / 来源 / 类型聚合，依赖 §9 推导）───────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

- KPI 复用 admin-ui `KpiCard`（其 Props 含 `spark`/`delta`/`variant`），挂趋势迷你图；**淘汰现页面自定义 `ImageHealthKpiCard`，沉淀到共享 `KpiCard`**。
- TOP 域名表每行加行内动作「切此域」→ 直接打开切 fallback 域 Modal 并预填 `fromDomain`（复用现有 `switchImageFallbackDomain`，零新端点）。
- 破损样本缩略点击 → `ImageLightbox` 放大（满足"放大查看"预览形态）。

### 5.2 Tab B — 图片治理（可操作工作台）

以"缺图/破损视频 DataTable"为主操作面，强化为治理工作台：

```
┌ Toolbar: [搜索]……[筛选 chips: 状态 / 破损原因 / 来源 / 破损域] [刷新] ┐
├ DataTable（server 分页 + 全栈排序）─────────────────────────────────────┤
│ ☐ 缩略 │ 标题/ID │ poster状态 │ 破损原因 │ 来源 │ 破损域 │ 次数 │ 最近 │候选│
│ ☐ [img]│ 沙丘    │ ●broken    │ fetch_404│ tmdb │ img3.. │  12  │ 2h  │3🟢 │
│ ☐ [img]│ 奥本海默│ ●missing   │   —      │  —   │  —     │  —   │  —  │1🟡 │
├──────────────────────────────────────────────────────────────────────────┤
│ .dt__bulk（选中后 sticky）: 已选 N · [批量重扫] [批量从候选补图] [批量去编辑]│
└──────────────────────────────────────────────────────────────────────────┘
                  点击行 → 右侧「图片治理抽屉」（§6）
```

DataTable 增强**全部复用 admin-ui 一体化 props，无新表格组件**：
- **缩略列**：`Thumb` 显示当前 poster；破损/缺失走 `FallbackCover` 同款占位语义（颜色用 token）。
- **筛选 chips**：`posterStatus`(enum) / 破损原因 `event_type`(enum) / `posterSource`(enum) / `brokenDomain`(distinctFetcher) —— 复用 DataTable filter chips + `distinctFetcher`（ADR-150 阶段 5 已具备）。
- **bulkActions**：`批量重扫选中` / `批量从候选补图`（§7 增量） / `批量去编辑`（深链视频库）。
- **flashRowKeys**：替换/重扫成功后行 flash 动画反馈。
- **「候选数」列（新）**：来自 §7 的 `metadata_field_proposals`，提示该作品有几个可一键补的外部源候选（🟢=高置信，🟡=待确认）。

---

## 6. 关键交互范式

### 6.1 ImageLightbox（放大查看）— 新共享组件

行内/Grid 缩略点击 → 全屏遮罩放大，附元信息面板：尺寸（width×height）、来源（poster_source）、状态 pill、破损原因（event_type + domain + occurrence）、原始 URL（可复制）。可在 image-health、视频编辑抽屉 TabImages、审核详情多处复用（≥3 处 → 沉淀 admin-ui）。

### 6.2 ImageCompare（替换对比）— 新共享组件

替换场景「当前图 vs 候选新图」并排，标注两侧尺寸/比例/可达性（候选先做客户端探活 + 尺寸校验再允许确认），降低误替风险。

### 6.3 图片治理抽屉（Drawer 右 480–560px）

行点击打开，承担"单条管理 + 预览 + 替换 + 补图"闭环：

```
┌ 图片治理 · 《沙丘》   image_governance: ●broken_poster   [去视频库编辑 ↗] [×] ┐
│ ┌Poster(P0)┐ ┌Backdrop(P1)┐ ┌Logo┐ ┌Banner┐ ┌Stills ×6┐ ← 图片矩阵, 点击放大 │
│ │[当前]●bkn│ │[当前]●ok   │ │●ms │ │●ok   │ │2 坏/6   │    （ImageLightbox） │
│ ── 破损详情 ── 原因 fetch_404 · 域 img3.. · 12 次 · 首现 3d / 最近 2h ────────│
│ ── 替换封面 ────────────────────────────────────────────────────────────────│
│ ① 从外部源候选选图（§7）: [tmdb 9.1分 zh] [tmdb null] [douban]  ← 缩略可选     │
│ ② 或手填 URL: [______________________________] [预览]                        │
│ ┌当前┐  →  ┌候选┐   ← ImageCompare 并排, 尺寸/比例/可达性标注                 │
│ └破损┘     └新图┘                                  [取消]  [确认替换]         │
└──────────────────────────────────────────────────────────────────────────────┘
```

- 预览两形态都在此满足：缩略点击 = Lightbox；替换区 = ImageCompare。
- 替换执行**复用现有** `PUT /admin/videos/:id/images`（自动入队探活 + blurhash + 审计）→ toast + 行 flash + 抽屉刷新。
- **「标记已解决」**：查询函数 `resolveImageEvents`（`imageHealth.scan.ts:160`，写 `resolved_at` + `resolution_note`）**已存在**，但尚未暴露 admin 路由 + 客户端。补一个薄端点即可点亮（增量，比从零小）。

### 6.4 批量治理

选中多行 → bulkActions：批量重扫（复用 rescan）/ 批量从候选补图（§7 增量）/ 批量去编辑（深链）。切 fallback 域仍是全局 action（PageHeader），因其按域而非按行。

---

## 7. 外部源补图能力（★ 复用现有基础设施 + 新增消费端点）

需求方明确要求：**外部元数据 API（TMDB/豆瓣/Bangumi）实装后提供多种图片，image-health 应纳入"从外部 API 获取图片数据作为替换源"的能力。** 好消息是底座**已具备**，缺的只是 image-health 侧的消费 UI + apply 端点。

### 7.1 现状（已实装，可复用）

- 元数据富集（`MetadataEnrichService`）跑 TMDB/豆瓣/Bangumi 时，图片候选（coverUrl/backdropUrl/logoUrl）已写入 `metadata_field_proposals`（字段级，带 `source` + `confidence`）。
- **TMDB 提供多候选**：`images.posters[]` 多张，带语言 / 尺寸 / 评分；`pickBestImage` 按语言优先级（`zh` > `null` 无字 > `en` > 其他）+ vote 选最优。豆瓣 / Bangumi 单张 coverUrl，无尺寸/语言。IMDb Phase 1 无图片。
- 图片字段与内容字段走**同一套 reconcile 优先级裁决**（详见 §7.3）。
- 编辑抽屉 `TabTmdb` 已有"搜索 → 勾选字段（含图片）→ confirm → apply（safeUpdate + status=pending_review）"范式可借鉴；但 `TabImages` 当前**只能手填 URL**，不消费候选。

### 7.2 新增（增量端点，本报告设计 + 标 ADR）

| 端点 | 作用 |
|------|------|
| `GET /admin/images/:catalogId/candidates?field=coverUrl` | 读该字段历史 proposal 候选（缩略 + source + confidence）；无候选时可按 `catalog_external_refs` 的 tmdb_id/douban_id 触发实时重搜拉新候选 |
| `POST /admin/images/apply-candidate` | 入参 `{ catalogId, field, source, sourceRef }`；按优先级闸门 safeUpdate（不违反 manual hard lock）+ 置 `pending_review` + 审计 `image_health.apply_candidate` |

治理抽屉「① 从外部源候选选图」消费此两端点；Tab B 的「批量从候选补图」bulkAction 复用。**每个新增 admin route → 先起独立 ADR + `verify:endpoint-adr`**（CLAUDE.md MUST-8）。

### 7.3 多源替换优先级（图片走与内容字段同一套 trust）

```
manual(5)  >  tmdb(4) = bangumi(4)  >  douban(3)  >  imdb(2)  >  crawler(0)
```

- 自动/半自动选源：在**不违反 manual hard lock** 前提下，按 trust 降序取第一个"探活通过 + 尺寸合格"的候选。
- TMDB 多候选内部：再按语言优先级 + vote（`pickBestImage` 已实现）。
- **manual 永远最高**：人工指定的图不被自动流程覆盖（除非人工解锁）。

---

## 8. 破损自动替换：分级自愈（★ 需求方选定，增量）

需求方选定**分级自愈**策略。设计为四级流水线，**护栏优先**（正确性与稳定性 > 效率，CLAUDE.md 价值排序 1）：

```
① 检测（已有）   worker HEAD 探活失败 → 标 broken + 写 broken_image_events
       │
       ▼
② 自动（新）     "补图决策"：取 metadata_field_proposals 未应用候选，
                按 §7.3 优先级，manual hard lock 不覆盖 →
                候选探活通过 + 尺寸/比例合格 + 高置信 →
                自动 apply（poster_source 记原候选源 + 审计 image_health.auto_replace）
       │  低置信 / 多候选并列 / 候选探活失败
       ▼
③ 半自动（新）   进 image-health「待补图队列」（Tab B 高亮 + 治理抽屉候选列表），
                运营从候选缩略 pick one 确认
       │  候选全无
       ▼
④ 人工（已有）   手填 URL（PUT images）；仍无 → 标 missing → 前台 FallbackCover（§10）
```

**护栏（缺一不可）：**
1. manual hard lock 字段，自动流程一律跳过（尊重人工权威）。
2. 自动替换的新图同样要过尺寸/比例校验（避免"用另一张坏图替坏图"）。
3. 连续失败计数 + 退避，避免对同一坏源反复打。
4. 全程 audit（`image_health.auto_replace`），支持人工反向回滚。

> 自动 vs 半自动的判定阈值（confidence 门限 / 是否单候选独占）由 §8 给默认值并标注"可配置"；落地时作为独立 worker step + ADR。

---

## 9. 多图与失效分级（★ 补 image_governance_status 推导缺口）

### 9.1 「多 poster」的真实含义

单作品**每类图片字段都是单值**（poster/backdrop/logo/banner 各一），stills 是数组、逐集缩略在 `video_episode_images`。所谓"一个视频有多个 poster"实际指两种情况，**不是同字段多张并存**：
1. **跨来源多候选**：同一 `coverUrl` 字段在 `metadata_field_proposals` 里有 TMDB/豆瓣/Bangumi 多个候选（§7）。
2. **多类型图片**：poster + backdrop + logo + banner + stills 各自独立。

### 9.2 部分失效 vs 全部失效（现状缺口 + 推导提案）

**现状**：各字段 `*_status` 独立记录；image-health 缺图列表**只看 `poster_status`**，poster ok 但 backdrop 坏的情况列表里看不到。`videos.image_governance_status` 字段存在但**无推导逻辑**（恒 `pending`，无 trigger/cron/service）。

**推导提案（增量）：**
```
image_governance_status 推导规则：
  poster broken             → broken_poster   （高优先，影响前台主视觉，建议阻断/强警告发布）
  poster missing            → missing_poster
  poster ok & 次要图 broken → degraded ★       （★ 现枚举无此态 → 枚举扩展 = schema 变更）
  全部 ok                   → ok
  含 pending                → pending
```

- **治理优先级**：全部失效（无任何可用图）> poster 失效（有 backdrop 兜底）> 仅次要图失效。
- **发布门控**：poster broken/missing 建议阻断或强警告；次要图失效不阻断（产品可调）。
- ⚠ **枚举扩展（新增 `degraded`）= schema 变更 → 必须起 ADR + 同步 `docs/architecture.md`**。若不想动 schema，可只用现有 4 态 + 在 UI 层用治理优先级表达"部分失效"。

---

## 10. 无图兜底 + 通知（★ 站内 + 阈值告警）

### 10.1 完全无图可用的兜底（已实装，报告引用语义）

前台 `FallbackCover`（`apps/web-next/src/components/media/FallbackCover.tsx`）：
- 梯度背景（6 色 token 池，按 seed 确定性生成）+ 类型专属 SVG 图标（电影/剧集/动漫/综艺/纪录片…）+ 品牌角标 + 底部标题/类型 scrim。**颜色零硬编码**。
- `SafeImage` onError → FallbackCover，**不换源**；src 为空时无 blurhash/primary_color 可用。
- 分级自愈（§8）全失败 + 无候选 + 无人工图 → 标 `missing` → 前台 FallbackCover + 进 image-health「无图可用」高优先队列。

### 10.2 通知方式（增量，需求方选定 站内 + 阈值告警）

| 渠道 | 现状 | 设计 |
|------|------|------|
| 站内① Dashboard | `AttentionCard` 图片告警行**是 MOCK**（`dashboard-data.ts`，无真实端点） | 落地 `getDashboardAttentions()` 真实端点，聚合 `broken_image_events` + image_governance；深链 `/admin/image-health?tab=管理&filter=...` |
| 站内② admin-shell | drawer 未承载图片待办 | `notifications` / `tasks` drawer 承载"待补图 / 待复核"计数 |
| 阈值告警 | 无任何渠道 | P0 失效数 / 近 N 时破损突增超阈 → 邮件/Slack/webhook（需配置渠道 + cron 评估，逐项起 ADR） |
| 前台上报 | **已实装** | `SafeImage.onLoadFail` → `reportBrokenImage` → `sendBeacon /internal/image-broken` → `upsertBrokenImageEvent`（会话级去重） |

---

## 11. 组件复用与新增

### 11.1 复用（admin-ui 唯一真源，已存在）

`DataTable`（toolbar / bulkActions / flashRowKeys / filter chips / distinctFetcher / pagination 三态）、`Drawer`、`Modal`、`Pill`、`Thumb`、`KpiCard`、`Spark`、`Segment`、`PageHeader`、`AdminCard`、`EmptyState`·`ErrorState`·`LoadingState`、`useToast`。

### 11.2 新增（带门禁标注，本期不实现）

| 组件 | 归属 | 用途 | 门禁 |
|------|------|------|------|
| `ImageLightbox` | `packages/admin-ui`（新） | 放大查看 + 元信息 | **新共享组件 API 契约 → 强制 Opus 子代理 + arch-reviewer**；commit 带 `Subagents:` trailer |
| `ImageCompare` | `packages/admin-ui`（新） | 当前 vs 候选并排对比 | 同上 |
| `ImageCandidatePicker` | `packages/admin-ui`（新） | 多源候选缩略选图（消费 candidates 端点） | 同上 |
| `ImageGovernanceDrawer` | server-next `_client/`（新） | 治理抽屉编排 | 模块内编排，非共享契约，按现有 Drawer 范式 |

---

## 12. 后端能力盘点：复用 vs 增量

### 12.1 本期复用（零新端点）

- `GET /admin/image-health/stats` · `/broken-domains` · `/missing-videos`
- `POST /admin/image-health/backfill` · `/rescan` · `/switch-fallback-domain`
- `PUT /admin/videos/:id/images`（单图替换 —— 替换工作流核心）
- `getBrokenEventsTrend`（趋势 Spark；stats 已含可选 `brokenTrend`）
- `resolveImageEvents`（查询层已存在，仅缺路由暴露）

### 12.2 增量（新端点 / schema，逐项起 ADR）

| 增量 | 用途 | 门禁 |
|------|------|------|
| `GET /admin/images/:catalogId/candidates` | 读外部源图片候选 | 新 route → ADR + `verify:endpoint-adr` |
| `POST /admin/images/apply-candidate` | 应用候选补图 | 同上 |
| `POST /admin/images/:id/resolve-event`（薄端点） | 暴露已存在的 `resolveImageEvents` | 同上 |
| 分级自愈 worker step | §8 自动补图 | 调度 + ADR |
| `image_governance_status` 推导 + 枚举扩展 | §9 失效分级 | **schema 变更 → ADR + 同步 architecture.md** |
| `getDashboardAttentions()` 真实端点 | §10 站内通知 | 替换 MOCK + ADR |
| 阈值告警渠道（邮件/Slack/webhook） | §10 推送 | 配置 + cron + ADR |

---

## 13. 设计约束（务必遵守，否则实现被驳回）

- **颜色零硬编码**：仅用 design-tokens CSS 变量（`var(--accent-default)` / `var(--state-*)` / `var(--fg-muted)` …）。
- **后台组件唯一真源 = `packages/admin-ui`**；新模式 ≥3 处须沉淀；**禁用已退役 v1 三件套**（ModernDataTable/PaginationV2/SelectionActionBar）。
- **DataTable v2 一体化**（toolbar/bulkActions/pagination 三态/filter chips），非外置三件套。
- **新共享组件 API 契约** → 强制 Opus 子代理 + arch-reviewer + commit `Subagents:` trailer。
- **新增 admin route** → 先起独立 ADR + `verify:endpoint-adr`。
- **schema 变更**（`image_governance_status` 枚举扩展）→ ADR + 同步 `docs/architecture.md`。
- **无死按钮原则**：无可执行端点的动作不渲染按钮。
- i18n / 时间格式不下沉组件；依赖方向单向（`admin-ui → @resovo/types`）。

---

## 14. 文件清单速查（接手定位用）

**前端 UI（后台 server-next）**
```
apps/server-next/src/app/admin/image-health/
  page.tsx
  _client/ImageHealthClient.tsx        主壳（待重构为双 Tab）
  _client/ImageHealthColumns.tsx       列定义
  _client/BrokenSamplesGrid.tsx        破损样本 Grid
  _client/SwitchDomainModal.tsx        切 fallback 域 Modal
  _client/ImageHealthKpiCard.tsx       自定义 KPI（待淘汰 → 共享 KpiCard）
apps/server-next/src/lib/image-health/api.ts   API 客户端 + DTO（设计师必读契约）
apps/server-next/src/app/admin/videos/_client/_videoEdit/TabImages.tsx  图片 Tab（手填 URL）
apps/server-next/src/app/admin/videos/_client/_videoEdit/TabTmdb.tsx    候选勾选范式（可借鉴）
apps/server-next/src/lib/dashboard-data.ts                              MOCK attentions（待落地）
apps/server-next/src/components/admin/dashboard/AttentionCard.tsx       通知卡
```

**后端（apps/api）**
```
routes/admin/image-health.ts          6 端点（IMG-05）
routes/admin/videoImages.ts           PUT /admin/videos/:id/images
db/queries/imageHealth.ts             stats / 域名 / 缺图列表
db/queries/imageHealth.scan.ts        rescan / switchFallbackDomain / trend / resolveImageEvents
workers/imageHealthWorker.ts          探活（无自动替换）
workers/imageBackfillWorker.ts        回填（仅入队探活）
workers/imageBlurhashWorker.ts        blurhash + 主色
services/MetadataEnrichService.ts     富集（图片候选写 proposals）
services/TmdbConfirmService.ts        TMDB confirm + pickBestImage
db/migrations/048_image_pipeline.sql  图片治理 schema（ADR-046）
```

**前台兜底（apps/web-next）**
```
components/media/FallbackCover.tsx     无图占位
components/media/SafeImage.tsx         加载失败降级（不换源）
lib/image/image-loader.ts             CDN loader（与 fallback 域无关）
lib/report-broken-image.ts            前台破损上报
```

**契约 & ADR**
```
docs/architecture.md §5.1a            media_catalog 图片字段
docs/decisions.md ADR-046/135/150/177/201/202/205/206/207
docs/manual/20-pages/P-image-health.md   现页面手册（需纠错 §3.2/§0/§5 + 同步重构形态）
docs/manual/10-workflows/W3-image-fallback.md  封面失效工作流
```

---

## 15. 实施分期建议（供后续拆任务卡）

- **P1 — IA + 概览强化**：双 Tab（Segment + `?tab=`）、KPI 沉淀 `KpiCard` + 趋势 Spark、TOP 域行内「切此域」、破损样本 Lightbox、**文档纠错**。仅复用现有端点 + 新 `ImageLightbox`。
- **P2 — 治理工作台 + 替换闭环**：治理 DataTable 增强（缩略列/筛选/bulk/候选列）、`ImageGovernanceDrawer`、`ImageCompare`、单图替换（`PUT images`）、外部源候选选图（`candidates` / `apply-candidate` 端点 + `ImageCandidatePicker`）、暴露 `resolveImageEvents` 薄端点。
- **P3 — 自愈 + 失效分级 + 通知**：分级自愈 worker、`image_governance_status` 推导 + 枚举扩展、Dashboard 真实端点、admin-shell drawer 待办、阈值告警。每个新端点 / schema 变更各自起 ADR。

> 拆卡遵守 CLAUDE.md 原子化四问：单卡范围 ≤ 5 项；schema / api-service / UI 跨 3 层须拆 `-A/-B` 子卡。新共享组件契约定型须先 spawn Opus 子代理。

---

## 16. 验证（本报告如何被确认）

本交付物为文档，验证为文档自检（不跑代码门禁）：

1. **落位**：`docs/designs/image-health-ux-handoff_20260618.md` 存在且已 `git add`。
2. **断链核验**：§14 引用的源码/ADR/手册路径逐条真实存在。
3. **机制准确**：§3 三 action 行为、§7.3 优先级链、§8 自愈四级、§9 推导规则，与 `imageHealth.scan.ts` / `imageBackfillWorker.ts` / `imageHealthWorker.ts` / `MetadataEnrichService.ts` / `048_image_pipeline.sql` 实际一致；§3.3 文档纠错三条成立。
4. **契约准确**：§4 枚举（status / event_type / source）与 migration + `api.ts` 一致。
5. **门禁标注完整**：§11/§12/§9 对"新共享组件 → Opus + arch-reviewer""新端点 → ADR""枚举扩展 → schema ADR"标注无遗漏。

---

*报告结束。实现期如需补充某交互态枚举清单或导出某组件 Props 表，向工程侧索取。*

---

## 17. 2026-06-19 复审修订意见（结合代码库调研）

> 来源：UI/UX 复审意见 + `docs/research/image-health-codebase-survey_20260619.md`。本节作为实现前修订清单追加，不直接覆盖上文原方案；后续拆卡时以本节对事实与分期的收敛为准。

### 17.1 总体裁决

本方案的信息架构方向继续采纳：双 Tab 将「健康概览」与「图片治理」拆开是正确的，`ImageLightbox` + `ImageCompare` 也覆盖了图片预览、替换判断和运营闭环的核心体验。

但实现前必须把「现有能力已支撑」和「需要新增端点 / schema / worker」明确切开。P1 应收敛为只消费现有端点的 IA 与概览增强；候选应用、精确筛选、选中批量、自愈自动化进入 P2/P3。

### 17.2 事实修订

1. **图片候选底座成立，但语义需收窄**
   - `metadata_field_proposals` 已包含 `coverUrl` / `backdropUrl` / `logoUrl` 图片字段，§7.1「外部源图片候选已写入 proposals」基本成立。
   - 但 proposals 是「每来源每字段一条最优候选」，不是 TMDB 同源多图列表。TMDB `images.posters[]` 只会经 `pickBestImage` 选最优一张写入；其余同源备选不持久化。
   - UI 文案应使用「跨源候选」而不是「全部候选图片」。如需 TMDB 多图，应通过 `catalog_external_refs.tmdb_id` 实时拉取，并单独建端点/缓存策略。

2. **`PUT /admin/videos/:id/images` 审计表述需修正**
   - §6.3 中「替换执行复用 `PUT images`（自动入队探活 + blurhash + 审计）」应改为「写图片 URL + 状态置 pending_review + 入队探活/blurhash + updated_at」。
   - 该 PUT 路径当前无 `insertAuditLog`。若需要可追溯的人工替换审计，应作为 P2 新增审计补齐或通过 `apply-candidate` 端点承担。

3. **`brokenTrend` 字段实为 `date`，DTO 误标 `day`（契约不一致，需修 DTO）**
   - 后端 `getBrokenEventsTrend`（`imageHealth.scan.ts:43`）实际 `push({ date, count })`，返回字段是 **`date`**；SQL 的 `AS day` 仅用于第 36 行内部聚合 Map，未出现在返回值。route（`image-health.ts:48-52`）原样透传不重命名 → **线上 JSON 字段就是 `date`**。
   - server-next DTO（`api.ts:20`）却声明 `{ day, count }`，且全链**无转换层** → 真·契约不一致。`BrokenTrendPoint.date`（`scan.ts:11`）声明**正确**，非误导。
   - 后果：当前无消费方；P1 若按 DTO 用 `point.day` 渲染趋势 Spark 会静默取 `undefined`、图表空白。修法：把 DTO 对齐为 `date`（或后端路由层显式重命名为 `day`），UI 消费 `date`。

4. **§3.3 文档纠错清单经逐条比对全部成立，不需收敛**
   - 端点纠错项**有效，保留勿删**：手册 `P-image-health.md:18`（§0 元信息）+ `:99`（§3.6）仍用错误的 `/admin/images/health`、`/admin/images/missing` 等（`/admin/images/*` 前缀；真实路由是 `/admin/image-health/*`）。
   - `dead` 状态纠错的章节号 `§5` **本就正确**：`dead` 出现在手册 §5 字段含义（`:115`）+ §6 状态颜色（`:130`）；§3.2（`:65`）是 backfill，不涉及 `dead`。
   - 原 §3.3 三条映射（backfill→§3.2、端点→§0/§3、dead→§5）均与手册一致，原样保留。

### 17.3 UI/UX 修订

1. **P1 不渲染“选中后批量重扫”**
   - 现有 `POST /admin/image-health/rescan` 只有 `scope`，没有 `videoIds` / `catalogIds` 入参。
   - 若在 DataTable 选中 N 行后调用现有 rescan，会实际重扫全局范围，造成严重误导。
   - 修订：P1 仅保留全局「重扫破损」；P2 如需选中批量，先新增按 ids 精确重扫端点。

2. **筛选必须与服务端分页同源**
   - 当前 `/missing-videos` 只支持 `page` / `limit` / `sortField` / `sortDir`，不支持搜索、状态、破损原因、来源、破损域筛选。
   - DataTable filter chips 不能只做当前页前端过滤，否则分页 total 与结果集会不一致。
   - 修订：P1 不渲染复杂筛选或仅展示已支持排序；P2 先补服务端 filter query，再接入 DataTable chips / distinctFetcher。

3. **治理 Drawer 改为 680px + fullscreen**
   - 原方案 `480–560px` 不足以承载图片矩阵、破损详情、候选列表、URL 输入与并排 Compare。
   - 修订：默认 `680px, max 90vw`，对齐后台 Drawer 规格；窄屏下 Compare 纵向堆叠，必要时提供 fullscreen。

4. **fallback 域切换强化危险动作流程**
   - `switch-fallback-domain` 是真实批量改库动作，不应与刷新/普通维护按钮同权重。
   - 修订：默认 dry-run；Modal 先展示 `affectedRows`、`affectedColumns`、三列 breakdown；二次确认后才启用执行按钮。执行按钮使用 warn/danger 语义。

5. **候选数列改名与解释**
   - 原「候选数」容易被理解为所有可选图片数量。
   - 修订为「跨源候选」或「来源候选」，计数来自 proposals；抽屉内另设「加载更多 TMDB 图片」入口处理同源多图。

### 17.4 分期重排

**P1 — IA + 概览强化（只消费现有端点）**
- 双 Tab（`Segment` + `?tab=`）。
- 共享 `KpiCard` / `Spark` 替换本页自定义 KPI。
- TOP 域行内「切此域」仅打开 dry-run 预览 Modal。
- 破损样本 `ImageLightbox`。
- 治理表保留现有分页/排序能力，不做选中批量、不做复杂筛选、不做候选应用。
- 同步修正文档事实项（§3.3、§6.3、`brokenTrend` 命名）。

**P2 — 治理闭环**
- 新增 `GET /admin/images/:catalogId/candidates?field=...`，读取 proposals 跨源候选；可选增加实时 TMDB 多图拉取能力。
- 新增 `POST /admin/images/apply-candidate`，执行 safeUpdate、状态置 `pending_review`、入队、审计。
- 暴露 `resolveImageEvents` 薄端点。
- 新增服务端筛选 query（搜索、状态、破损原因、来源、破损域）后再接 DataTable chips。
- 如确需批量重扫选中项，新增 ids 精确端点；禁止复用全局 `rescan` 伪装成选中批量。
- 实现 `ImageGovernanceDrawer`（680px/fullscreen）、`ImageCompare`、`ImageCandidatePicker`。

**P3 — 自动化与通知**
- 分级自愈 worker step。
- `image_governance_status` 推导；若扩展 `degraded`，必须按 schema 变更走 ADR 并同步 `docs/architecture.md`。
- Dashboard 真实 `AttentionCard` 数据端点。
- admin-shell 待办/通知 drawer。
- 阈值告警渠道（邮件/Slack/webhook），逐项拆 ADR。

### 17.5 一句话实现准则

P1 做「真实可用的监控与轻治理」，P2 做「人工治理闭环」，P3 做「自动化自愈与通知」。任何按钮必须有真实后端能力支撑；没有精确端点时不渲染看似精确的 UI。
