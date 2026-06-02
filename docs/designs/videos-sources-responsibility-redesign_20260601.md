# 视频库 / 播放线路 职责重定义与表格重设计 — 完整方案

> 落盘日期：2026-06-01
> 状态：设计草案（待拆卡 / 部分前置项需补齐，见 §5）
> 适用范围：`apps/server-next` 视频库 `/admin/videos` + 播放线路 `/admin/sources` + 线路别名 `/admin/source-line-aliases`
> 视觉真源：`docs/designs/backend_design_v2.1/reference.md` §4.4 / §5.3 / §5.4 / §6.1 / §6.2（本文件 §2/§3 在其基础上演进，冲突以本文件为准）

---

## 0. 现状基线（已逐文件核实，2026-06-01）

| # | 现状 | 证据 |
|---|------|------|
| 1 | 视频库混入线路健康 / 探测 / 图片 / 审核 / 富集多维度，且 `probe` 列是占位 | `VideoListClient.tsx:323-326` 硬编码 `<DualSignal probe="unknown" render="unknown" />`，注释留 `STATS-EXTEND-VIDEOS` follow-up |
| 2 | 播放线路页四个 Tab（按视频分组 / 仅失效 / 用户纠错 / 孤岛源）本质是过滤条件 | `SourcesClient.tsx:38-43` SEGMENTS = 4 个 WHERE 分支 |
| 3 | “用户纠错”仍走旧字段 `video_sources.submitted_by` | `sources-matrix.ts:187-190` `EXISTS(... vs1.submitted_by IS NOT NULL ...)` |
| 4 | “孤岛源”实为“全部失效且未发布的视频”，并非孤岛线路 | `sources-matrix.ts:191-192` `source_check_status='all_dead' AND is_published=false` |
| 5 | 展开区 `MatrixExpand` 重复实现已有共享 `LinesPanel`；render 阶段发请求；仅显示前 8 集；3 个按钮无 onClick | `SourceMatrixRow.tsx:164-169`（render 内 setState 发请求）/ `:201`（`.slice(0,8)`）/ `:263-306`（复制线路 / 重验全部 / 删除全失效 dead button） |
| 6 | `LinesPanel` 共享组件已具备完整能力 | `lines-panel.types.ts`：单集/整组 toggle、probe、render-check、disableDead、refetch、codename/retired/auto_retired、任意集数无截断 |
| 7 | 集数三层语义字段已落库 | migration 078：`episode_count`（收录）/ `current_episodes`（已播）/ `total_episodes`（共） |
| 8 | Bangumi / 外部 ID / meta 质量字段已具备 | `videos.internal.ts:240` `VIDEO_FULL_SELECT` 含 `bangumi_status / meta_score / meta_quality / bangumi_subject_id / douban_id / tmdb_id / imdb_id` |
| 9 | `TabLines` 已用 `useVideoSources` + `groupSourcesByLine` 喂 `LinesPanel` | `TabLines.tsx:35-38,83-93`（client 端聚合，已验证可用） |

### 0.1 评审发现的缺口与裁决（2026-06-01）

> 原评审指出「失效举报」无实时写入路径：`user_submissions` 仅由 migration 065 一次性回填，`apps/api` 全仓 **无任何 `INSERT INTO user_submissions`**；前台 `POST /videos/:id/sources/:sid/report`（`sources.ts:172`）**只 `request.log.info` 记日志**，不落表。

**裁决（用户 2026-06-01）：移除「失效举报」功能。** 不做 `user_submissions.bad_source` 的计数 / 列 / 筛选。未来客户端「用户反馈播放问题」将**触发“失效”验证**（入队重新 probe → 更新 `probe_status`），反映在探测维度②，而非写举报表。
- 现有 `POST /sources/:id/report-error → enqueueVerifySingle`（`sources.ts:118-142`）已是该模型雏形。
- 连带移除：视频库「元数据纠错待处理」+「用户投稿源」展示（现阶段不提供任何用户投稿功能，见 §0.2-B / §5.1）。
- 影响：原「失效举报写入管线」卡**取消**；`user_submissions` ingestion 整体不在本批次范围。

---

### 0.2 术语与数据判定（逐字段核实，2026-06-01）

> 这几个词在现有数据模型里语义并不直观，定义清楚后才能决定快捷筛选/列。

#### A.「失效」——系统里有两套互不同步的维度

| 维度 | 字段 | 判定逻辑 | 谁写入 | 现用在 |
|------|------|----------|--------|--------|
| **① 启停维度**（人工/运维） | `video_sources.is_active` ⇒ 聚合到 `videos.source_check_status` | `source_check_status`：无 active 源 → `all_dead`；有 active 且有 inactive → `partial`；全 active → `ok`（`videos.status.ts:417-429`，**完全不看 probe/render**） | 管理员手动开关 / `disableDead` 批量 / `bulkSyncSourceCheckStatus` | KPI「失效」卡(`all_dead`)、旧「仅失效」Tab、「孤岛」 |
| **② 探测维度**（自动健康） | `video_sources.probe_status`（可达性）/ `render_status`（可播性），4 态 `pending/ok/partial/dead` | 视频级 `aggregateSignal` worst-of：全 ok→ok / 全 dead→dead / 混合(含 ok\|partial)→partial / 空→pending（`SourcesMatrixService.ts:178`） | `SourceHealthWorker` 自动探测 | sources 表「探测」/「试播」列 SignalPill |

> **关键**：两套不同步。一条源可 `is_active=true` 但 `probe_status='dead'`（自动测出失效、尚未禁用）；也可 `is_active=false` 但 `probe_status='ok'`（手动禁用但实际可达）。

**术语裁决（用户 2026-06-01；第二轮细化，对齐既有 SQL 口径）：**
- 探测维度②**细分，不强并**：
  - **「连接失败」= `probe_status='dead'`**（可达性失败）
  - **「试播失败」= `render_status='dead'`**（可播性失败）
  - **「异常源」= 连接失败 OR 试播失败**（任一 dead）——快捷筛选 / 问题列统一口径
  - **自动退役**沿用**双失败**（`probe='dead' AND render='dead'`，180 天，`auto-retire-line.ts:185`），不变
- **「禁用」= 维度①（is_active=false）**——本地**主动**启停，**不得称“失效”**。
- **「可用源」= is_active=true**（未禁用）；**「可播源」= 可用 且 非异常**（probe≠dead 且 render≠dead）。
- 批量动作改名 **「禁用连接失败源」**（实现 `disableDeadSources` 仅 `probe='dead'`，`video_sources.ts:196`，文案须与口径一致）。
- ⇒ KPI/列/筛选凡涉播放健康一律走维度②（连接/试播/异常）；`source_check_status`(①) 仅服务“可用源数/待补源”判定，不叫“失效”。

#### B.「用户纠错」——名不副实，实为「用户投稿源」；且失效举报无持久化

- 现状 segment 判定：`EXISTS(video_sources.submitted_by IS NOT NULL)`（`sources-matrix.ts:189`）。
- `submitted_by` 真实语义 = **用户投稿的播放源**：`POST /videos/:id/sources` 写入 `is_active=false, submitted_by=uid`（`sources.ts:94-100`），再异步 `verifyFromUserReport`。**这是用户贡献内容，不是“纠错/举报”**——命名误导。
- 真正的失效举报端点 `POST .../report` / `POST /sources/:id/report-error`（`sources.ts:118-142,144-180`）**只记日志 / 入队重验，不落任何表**。
- `user_submissions` 三类型（ADR-124，`decisions.md:8108`）：`bad_source`(失效举报) / `wish_list`(求片) / `metadata_correction`(元数据纠错)。
- **现状数据**：`user_submissions` 仅由 migration 065 一次性回填 `bad_source`（把历史“投稿且未激活源”当失效举报）；`wish_list` / `metadata_correction` **无任何数据**；全仓**无 `INSERT INTO user_submissions`**（§0.1）。⇒ 失效举报 / 元数据纠错本就是空壳，**按裁决整体移除**，本批次不建写入管线（§0.1 / §5.1）。

#### C.「孤岛」——误称，实为「待补源视频」

- 现状 KPI/segment 判定：`source_check_status='all_dead' AND is_published=false`（`sources-matrix.ts:128,192`）。
- 语义 = **维度①全失效（所有源被禁用/无源）且视频未上架** → 需要补源的视频。
- “孤岛”既非孤岛源也非孤岛线路，纯属误称；改「待补源视频」准确。

#### 质量 / 延迟 / 最近检测 字段（供线路页质量列）

- `video_sources.quality_detected`（059，7 档 `2K/4K/1080P/720P/480P/360P/240P`）+ 回退 `quality`（001，5 档）；前端 fallback `quality_detected ?? quality`。
- `latency_ms`（054，首次探测后填）/ `last_probed_at` / `last_rendered_at`（054）。

### 0.3 第二轮评审修订（2026-06-01）

> 结论：整体可行、职责拆分正确；以下 5 个阻断项 + 数项修订须在拆卡前闭合（均逐字段核实）。

**阻断项（已采纳，落地见各节）：**

1. **复合列无法直接做表格筛选**：`AutoFilterColumnFields` 一列仅一个 `filterFieldName`+一种 `filterKind`（`column-types.ts:156`）；`发行信息/元数据/内容状态` 各含 3 条件。→ **复合列只读、不挂列筛选**；子维度由「页面级快捷筛选」+「默认隐藏的原子可筛选列」承载；**不为本任务扩 DataTable 公共契约**（§2.2/§2.6）。
2. **`LinesPanel` 接入被低估**：`useVideoSources` 仅 toggle/disableDead/refetch/health（`use-sources.ts:34`），单集/整组 probe·render 控制器在审核台内部（`moderation/LinesPanel.tsx:182`）。→ **新增前置卡**抽中性 `useSourceLinesController(videoId)`，审核台/编辑抽屉/线路展开三方共用；**禁止 `/admin/sources` 反向 import 审核台内部组件**（卡 0.5 / §5.3）。
3. **「失效」口径未统一**：批量禁用只看 `probe='dead'`（`video_sources.ts:196`），自动退役要 `probe AND render dead`（`auto-retire-line.ts:185`）。→ **不强并**，细分：连接失败(probe)/试播失败(render)/异常源(任一)/自动退役(双失败)；批量动作改名「禁用连接失败源」（§0.2-A）。
4. **「用户投稿下线」与在线写入冲突**：`POST /sources/submit` 仍持续写 `is_active=false` 投稿源（`sources.ts:74-100`）。→ ✅ 已定 (a) **关闭投稿**：保留路由但返 `410 Gone`、不写库（CLAUDE.md 禁删 API 路径），移除前台入口 + 停 `verifyFromUserReport`。播放问题反馈端点（入队重验）保留（`sources.ts:117`）。
5. **质量 SQL 口径改写**：`MAX(quality_tier)` 不能用于字符串分辨率，`COUNT(probe!=pending)` 非"画质已检测比例"。→ 派生 `quality_rank`(CASE 4K=7…240P=1)、展示 `quality_detected ?? quality`、覆盖率 `FILTER(quality_detected IS NOT NULL)/COUNT(*)`、新增「质量未知」态（§3.2/§3.3/§3.5）。

**需修订项（已采纳）：**

- **列锁定/顺序降级**：DataTable 仅静态 `pinned`+可见性+宽度，列头锁定/重排未实现（`header-menu.tsx`）→ 本批次**静态锁定标题列，不支持用户改锁定/顺序**（§1.1/§2.1）。
- **KpiCard 缺选中态**：仅 `onClick`，无 `pressed`/`aria-pressed`（`kpi-card.types.ts:230`）→ B 方案需扩 `pressed?`/`data-active`/`aria-pressed`，按共享 API 规则走 **Opus 评审**（卡 3-pre / §4）。
- **视频库过滤 API 单值、搜索面窄**：仅 `title+title_en`、无数组/范围（`videos.ts:233`）→ 补数组、年份范围、国家、连载、豆瓣、Bangumi、完整度、集数异常；搜索扩到原名+短 ID（卡 2 / §2.6）。
- **distinct 白名单缺新字段**：无国家/Bangumi/豆瓣（`distinct-whitelist.ts:49`）→ **ADR-150 amendment**；`media_catalog.country` 增逻辑表映射（卡 2 / §2.6）。
- **`SourceSegment` 仅废弃兼容**：不先改名再删（统一 §4 与 §5.4）。

**阶段二（本批次不做，预留）**：视频库行展开显示完整 metadata；因类型字段差异大，**表格列仅显示共同关键数据**，类型专属字段进展开区（§8）。

---

## 1. 页面职责分工

| 页面 | 一行代表 | 核心职责 |
|------|----------|----------|
| 视频库 `/admin/videos` | 一个视频作品 | 查看、筛选、编辑基础信息、元数据完整度、发布审核状态 |
| 播放线路 `/admin/sources` | 一个视频的播放资源集合 | 查看线路覆盖、健康度、质量、失效情况（探测②），执行线路运维 |
| 线路别名 `/admin/source-line-aliases` | 一个站点线路别名 | 维护短码、优先级、退役状态 |

**边界裁决：**
- 线路健康 / 探测 / 试播 / 质量 / 失效 → 收归**播放线路页**；视频库默认不显示，仅作可选列或抽屉信息，避免视频库再次变成综合运维台。
- 元数据完整度 / 豆瓣 / Bangumi / 发布审核 → 收归**视频库页**。
- 播放线路页内嵌的“全局别名表 Tab”移除，保留跳转入口（独立页 `/admin/source-line-aliases` 已是更完整实现，见 `SourcesClient.tsx:483-495` 已有入口按钮）。

### 1.1 表格头部与列操作约束（2026-06-01 修订 · 强约束）

> 适用于本文件所有表格设计，覆盖原稿 §2/§3 中较拥挤的 toolbar 草图。

1. **表格头部默认只有两件东西**：左侧 = 表格搜索框；右侧 = 列设置入口（⚙）。**不在表格头部堆叠**筛选下拉、视图保存、刷新、导出、快捷筛选 chip、已选过滤 chip 等。
2. **不可随意往表格头部加内容功能。** 页面级动作（导出 CSV / 手动添加视频 / 线路别名管理 / 刷新）归 `PageHeader` 或页面级区域，不进表格头部。
3. **列操作（排序 / 筛选 / 隐藏）在“列设置 / 列头菜单”内体现：**
   - 单列操作经**列头菜单**（点列头 → 排序 ↑↓ / 筛选…(仅简单列) / 隐藏此列）触发；
   - 全局显示/隐藏在右侧**列设置 popover** 管理；“恢复显示”只在列设置内完成。
   - **本批次能力边界（第二轮修订）**：DataTable 现仅支持静态 `pinned` + 可见性 + 宽度，**列头“锁定/重排”未实现**（`header-menu.tsx`）。故**标题列静态锁定（pinned）、不提供用户改锁定/改顺序**；不为本任务扩这两项契约。
4. **列操作不在表格头部加撤销按钮 / 提示条**——不出现“已隐藏 X 列 [撤销]”“已选过滤 … ✕”这类横条。某列的激活态（已筛选 / 已排序）在**该列列头以指示符**体现，清除也在该列菜单内。
5. **相对现状代码的影响**（需在拆卡里落实移出）：
   - `VideoListClient` 的 `toolbar.trailing`（`FilterChipBar` + 导出按钮）→ 导出移 PageHeader、`FilterChipBar` 删除；`viewsConfig`（视图保存）→ 本批次暂缓移除（§7-7）；
   - `SourcesClient` 的 `toolbar.trailing`（刷新按钮）→ 删除，改自动 refetch（§7-7）；Segment Tab 行 + 别名 Tab 行 → 移除；
   - 列筛选统一走 `enableHeaderMenu` + `DataTableAutoFilter`（既有能力），不再有独立筛选下拉行。

---

## 2. 视频库表格 — 产品样式

### 2.1 页面骨架

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  视频库                                          [导出 CSV]  [+ 手动添加视频]   │  ← PageHeader（页面级动作，非表格头部）
│  695 条视频 · 待审 12 · 元数据缺失 38 · 集数不一致 9                            │  ← 统计计数 = 快捷筛选(B)：点击切换·可组合·选中高亮·全部=清空
├─────────────────────────────────────────────────────────────────────────────┤
│  [🔍 标题/英文名/原名/短ID]                                          [列设置 ⚙] │  ← 表格头部：仅 左搜索 + 右列设置
├──┬──────┬──────────────────┬───────┬────────────┬──────────┬─────────┬───────┤
│☐ │ 封面 │ 视频              │ 类型  │ 发行信息   │ 集数     │ 元数据  │ ...   │  ← 列头：点击 = 该列 排序/筛选/隐藏 菜单
└──┴──────┴──────────────────┴───────┴────────────┴──────────┴─────────┴───────┘

  · 列头菜单（单列）：排序 ↑↓ · 筛选…（仅简单列）· 隐藏此列 → 激活态在该列列头显指示符
  · 列设置 ⚙（全局）：各列显示/隐藏（恢复入口）。标题列静态锁定；本批次不支持用户改锁定/顺序（§1.1-3）
```

### 2.2 列定义（默认可见列）

| key | 列名 | 宽 | render / 数据格式 | sortable | filterable |
|-----|------|----|--------------------|----------|------------|
| `_select` | ☐ | 40 | checkbox 居中 | — | — |
| `cover` | 封面 | 56 | `<Thumb size="poster-md">` 48×72 竖版 radius 4；缺图走 FallbackCover | ❌ | ❌ |
| `title` | 视频 | flex (pinned) | 2 行：① 标题 12/600 截断 ② `.tbl-meta.mono` `{title_en ?? title_original} · {short_id}` 11 muted | ✅ | ✅ text（搜 `q`：title / title_en / title_original / short_id） |
| `type` | 类型 | 90 | `<Pill neutral>{电影\|剧集\|动漫\|...}</Pill>`（`TYPE_LABELS` 映射） | ✅ | ✅ enum |
| `release` | 发行信息 | 150 | 2 行：① `{year} · {country}` 12 ② `<Pill {ok\|warn}>{完结\|连载\|未知}</Pill>` 11（取 `mc.status`） | ✅（按 year） | ❌ 复合列不挂筛选（子维度走 §2.6） |
| `episodes` | 集数 | 140 | `收录 {episode_count} · 已播 {current_episodes} / 共 {total_episodes}`；缺值降级见 §2.4 | ✅（按 episode_count） | ❌ 复合列不挂筛选（异常走 §2.6 快捷筛选） |
| `meta` | 元数据 | 170 | `<EnrichmentBadgeCluster>`：完整度环 `{meta_score}` + 豆瓣 dot（`douban_status`）+【动漫】Bangumi dot（`bangumi_status`）+ 拼音警告 | ✅（按 meta_score） | ❌ 复合列不挂筛选（子维度走 §2.6） |
| `status` | 内容状态 | 150 | `<VisChip visibility review />` + 发布 dot：`{已上架\|草稿}`（`is_published`） | ✅（按 review_status） | ❌ 复合列不挂筛选（子维度走 §2.6） |
| `updated` | 更新时间 | 100 | muted fs 11 `{updated_at}` 本地短日期 | ✅ | ✅ date-range |
| `actions` | 操作 | 120 | `<VideoRowActions>` 溢出菜单：编辑信息 / 图片 / 外部元数据 / 审核 / 合并 / 前台预览 / **查看播放线路** | ❌ | ❌ |

### 2.3 可选列（默认隐藏，列设置 popover 开启 / 或抽屉信息）

> 职责回归后，线路类信息默认不出现在视频库，但保留为可选列，避免一次性删除既有能力。

| key | 列名 | render | 说明 |
|-----|------|--------|------|
| `source_health` | 源活跃 | dot + `<strong>{active}</strong>` + `{活跃\|一般\|稀少}` | 既有后端 `SORT_FIELDS('source_health')` 排序保留，降级为可选列时**不要删排序能力** |
| `probe` | 探测/播放 | `<DualSignal>` | 后端字段补齐前保持占位（`STATS-EXTEND-VIDEOS`）；占位期排序禁用 |
| `image_health` | 图片 | `<Pill>P0 活跃\|失效</Pill>` | `poster_status` + `backdrop_status` 复合派生 |
| `douban_status` / `meta_score` / `year` / `created_at` | — | 既有隐藏列保留 | 与 `meta` / `release` 列信息重叠，默认隐藏 |

### 2.4 数据格式细则

- **集数列降级**（`current_episodes` / `total_episodes` 可为 NULL，078 D-163-3）：
  - 三值齐全：`收录 12 · 已播 10 / 共 12`
  - 仅有收录：`收录 12`（不显示 `已播 — / 共 —`）
  - 电影（`type='movie'`）：整列显 `—`
  - `已播 > 收录`（外部领先爬虫）：`已播 N` 染 warn 色，hover 提示“外部数据领先于已收录”
- **发行信息·连载状态**：`mc.status` → 完结(ok) / 连载(warn) / 未知(muted)
- **元数据·完整度**：`meta_score` 0–100；<60 环染 warn，<30 染 danger
- **内容状态**：`visibility_status × review_status` 走 `VisChip` 复合 chip；`is_published` 单 dot 旁挂

### 2.5 排序

- 服务端排序（`mode="server"`），白名单字段：`title` / `type` / `year` / `episode_count` / `meta_score` / `review_status` / `visibility` / `updated_at` / `created_at` / `source_health`（可选列）。
- 默认排序：`updated_at desc` ✅ 已定（“最近信息变更”视角，替换原 `created_at desc`）。
- **排序入口仅在列头菜单 / 列设置**（`enableHeaderMenu`，sort + hide + clear filter 集成），表格头部不加任何排序控件（§1.1）。

### 2.6 过滤（第二轮修订：复合列不挂筛选 → 三层模型）

> 阻断项 1：`DataTableAutoFilter` 一列仅绑一个 `filterFieldName`+一种 `filterKind`（`column-types.ts:156`），复合显示列（发行/元数据/内容状态）**无法承载多条件**。改为三层，不扩 DataTable 公共契约。

**① 搜索框**（表格头部左侧，唯一头部筛选入口）：`q` ILIKE 多列 OR → `title / title_en / title_original / short_id`（现仅 title+title_en，需扩，`videos.ts:233`）。

**② 简单（原子）可筛选列 — 经列头菜单 → 筛选…**（部分默认隐藏，与复合显示列并存）：

| 原子列 | filterKind | 后端字段 | distinct |
|--------|-----------|----------|----------|
| 类型 `type` | enum | `v.type` | 静态 |
| 年份 `year`（默认隐藏） | number-range | `mc.year` | — |
| 国家 `country`（默认隐藏） | enum | `mc.country` | **需白名单 amendment** |
| 连载状态（默认隐藏） | enum | `mc.status` | 静态 |
| 可见性 / 审核 / 发布（默认隐藏） | enum | `visibility_status` / `review_status` / `is_published` | 静态 |
| 完整度 `meta_score`（默认隐藏） | number-range | `v.meta_score` | — |
| 豆瓣 / Bangumi（默认隐藏） | enum | `douban_status` / `bangumi_status`（Bangumi 仅 anime） | **需白名单 amendment** |

**③ 页面级快捷筛选（B 方案，统计行可点击计数）**：派生/布尔条件，不适合列筛选：
- `待审` = `review_status='pending_review'`
- `元数据缺失` = `meta_score < 阈值 OR 关键字段空`
- `集数不一致` = `current_episodes IS DISTINCT FROM episode_count`（可选并入 `集数缺失` = `total_episodes IS NULL OR current_episodes IS NULL`）
- 点击切换、可组合、选中高亮、`全部` 清空；**不进表格头部**。（原“纠错待处理”随用户投稿功能下线移除。）

**入口约束（§1.1）**：除搜索框外列筛选一律走列头菜单，激活态在列头显指示符、清除在列菜单内；表格头部不出现筛选下拉行 / 已选过滤 chip 条。复合显示列（发行/元数据/内容状态）**自身不挂筛选**。

**API / 白名单（卡 2）**：现 `AdminVideoListFilters` 单值且无范围（`videos.ts:233`）→ 补数组 enum、年份 range、国家、连载、豆瓣、Bangumi、完整度 range、集数异常 boolean，搜索扩原名+短 ID；`distinct-whitelist` 增 `country / bangumi_status / douban_status`（**ADR-150 amendment**，`media_catalog.country` 加逻辑表映射，`distinct-whitelist.ts:49`）。

---

## 3. 播放线路表格 — 产品样式

### 3.1 页面骨架（取消四 Tab + 取消内嵌别名 Tab）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  播放线路                                                   [线路别名管理 →]    │  ← PageHeader（页面级动作）
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐                          │
│  │全部 695 │含异常源 │待补源   │待探测   │低质量   │  ← KPI 卡 = 快捷筛选(B)：点击切换│
│  └─────────┴─────────┴─────────┴─────────┴─────────┘   可组合·选中高亮(pressed)·全部=清空│
├─────────────────────────────────────────────────────────────────────────────┤
│  [🔍 视频名称]                                                       [列设置 ⚙] │  ← 表格头部：仅 左搜索 + 右列设置
├──┬──────────────────┬─────────────┬──────┬──────┬─────────┬──────────┬───────┤
│☐ │ 视频              │ 覆盖        │ 探测 │ 试播 │ 质量    │ 问题     │ ...   │  ← 列头：点击 = 该列 排序/筛选/隐藏 菜单
├──┴──────────────────┴─────────────┴──────┴──────┴─────────┴──────────┴───────┤
│  ▾ 行展开 → <LinesPanel>（共享组件，单集/整组运维，无截断）                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

> KPI 卡改为「快捷筛选」(B 方案，§3.5)：旧 `孤岛`→`待补源`；新增 `待探测` / `低质量`；`全部` 卡副标题挂总量（视频数·源数）。Segment Tab 行 / 别名 Tab 行已移除（§1.1）。

### 3.2 列定义（默认可见列）

| key | 列名 | 宽 | render / 数据格式 | sortable | filterable |
|-----|------|----|--------------------|----------|------------|
| `_select` | ☐ | 40 | checkbox | — | — |
| `video` | 视频 | flex | `chevR(展开旋转 90°)` + `<Thumb sm>` + 标题 12/600 + `{type} · {short_id}` 11 muted（紧凑） | ✅ | ✅ text（视频名） |
| `coverage` | 覆盖 | 130 | `{line_count} 线 / {source_count} 源 / {active_source_count} 可用`；可用数 0 染 danger（= 全被禁用/无源）；“可用”= 未禁用(is_active) | ✅（按 active） | — |
| `probe` | 探测（连接） | 100 | `<SignalPill>` 聚合：全部可达(ok) / 部分(warn) / 连接失败(danger) / 未测(muted) | ❌ | ✅ enum (ok/partial/dead/pending) |
| `render` | 试播 | 100 | `<SignalPill>` 聚合：可播 / 部分 / 试播失败 / 未测 | ❌ | ✅ enum |
| `quality` | 质量 | 140 | `{quality_detected ?? quality}` + `已检测 {覆盖率}%` + `延迟中位 {ms}ms`；全空显 `质量未知` | ✅（按 `quality_rank`） | ✅「低质量」boolean（§3.5） |
| `issues` | 问题 | 160 | 多 badge：`待补源` / `连接失败 {n}` / `试播失败 {n}` / `待探测 {n}`（各 0 不显示）；可选 `禁用 {n}` 中性色 | ❌ | 由快捷筛选驱动 |
| `sites` | 站点 | 140 | `{siteKeys.join(', ')}` 截断 + title 全列表 hover | ❌ | ✅ enum（distinct `sources.site_key`） |
| `last_checked` | 最近检测 | 100 | muted fs 11；取 `MAX(last_probed_at)` 回退 `MAX(vs.updated_at)` | ✅ | ✅ date-range |
| `actions` | 操作 | 120 | btn--xs：展开 / 全部探测 / 全部试播 / 禁用连接失败源 / 重新采集 / 编辑视频（溢出菜单） | ❌ | ❌ |

### 3.3 数据格式与字段来源

| 列 / 字段 | 现状 | 拆卡 3 需补 |
|-----------|------|-------------|
| `line_count` / `source_count` | ✅ 已有（`sources-matrix.ts:263-264`） | — |
| `active_source_count`（可用源 = 未禁用） | ❌ | `COUNT(vs.id) FILTER (WHERE is_active)` |
| `probe` / `render` 聚合（维度②） | ✅ STRING_AGG + Service `aggregateSignal` | — |
| `quality_rank`（排序/低质量判定用） | ❌ | `CASE quality_detected ?? quality WHEN '4K'→7 '2K'→6 '1080P'→5 '720P'→4 '480P'→3 '360P'→2 '240P'→1 ELSE NULL`（7 档，059）；列聚合取 `MAX(quality_rank)` |
| `quality` 展示分辨率 | ✅ `quality_detected ?? quality`（fallback 链，059 D-12） | 视频级取最高档 |
| `quality` 已检测覆盖率 | ❌ | `COUNT(*) FILTER (WHERE quality_detected IS NOT NULL) / COUNT(*)`（**画质实测比例**，非 probe） |
| `quality` 延迟中位 | ❌（站点级 `listRoutesBySite` 有 AVG，无视频级） | `percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms)` |
| `issues.待补源` | ⚠️ 现仅 `all_dead AND !is_published`（维度①） | §3.5.1 精确化“无可播源”，含已上架 |
| `issues.连接失败 {n}` | ❌ | `COUNT(vs) FILTER (WHERE probe_status='dead')` |
| `issues.试播失败 {n}` | ❌ | `COUNT(vs) FILTER (WHERE render_status='dead')` |
| `issues.待探测 {n}` | ❌ | `COUNT(vs) FILTER (WHERE probe_status='pending')` |
| `issues.禁用 {n}`（可选，维度①） | ❌ | `COUNT(vs) FILTER (WHERE is_active=false)`（中性，非“问题”） |
| `sites` | ✅ STRING_AGG site_keys | — |
| `last_checked` | ⚠️ 仅有 `MAX(updated_at)` | 增 `MAX(last_probed_at)` |

### 3.4 排序

- 白名单：`video`（v.title）/ `coverage`（active_source_count）/ `quality`（分辨率档）/ `last_checked`（MAX(last_probed_at)）。
- 默认：`last_checked desc` ✅ 已定（运维视角关注最近检测）。
- `probe` / `render` / `issues` / `sites` 为派生/多值聚合，排序业务无意义，禁用。
- **排序入口仅在列头菜单 / 列设置**（§1.1），表格头部不加排序控件。

### 3.5 过滤 / 快捷筛选（取代四 Tab）

**快捷筛选 = 可点击 KPI 卡（B 方案，§7-6 已定）**：5 张 KPI 卡即筛选入口，点击切换、可组合（AND）、选中高亮、`全部` 清空；均为派生条件，无 `user_submissions` 依赖：

| chip | 语义 | 后端谓词 |
|------|------|----------|
| 全部 | 默认（有播放源的视频） | `EXISTS video_sources` |
| 含异常源 | ≥1 条**异常源**（连接 OR 试播失败，维度②） | `EXISTS vs WHERE probe_status='dead' OR render_status='dead'` |
| 待补源视频 | 无可播源（见 §3.5.1） | 见 §3.5.1 |
| 待探测 | ≥1 条 probe=pending | `EXISTS vs WHERE probe_status='pending'` |
| 低质量 | 最高已知分辨率 < 720P | `MAX(quality_rank) < 4`（即 480P/360P/240P；**仅在有已知质量时命中**，延迟阈值暂不纳入，§7-4） |
| （质量未知） | 无任何已知质量（可选独立态/筛选） | `MAX(quality_rank) IS NULL`（**不并入低质量**，避免未实测被误判，§3.2） |

> **旧 Tab 退场说明**：旧“仅失效”用的是 `source_check_status='all_dead'`（**维度①禁用/无源**），与新“含异常源”（**维度②连接/试播失败**）是不同维度，不再保留前者为独立 chip；“禁用”视图如需可作列设置/列筛选（is_active enum），不进快捷筛选。旧“用户纠错” Tab 随用户投稿功能下线**直接移除**，无替代。

#### 3.5.1「待补源视频」定义 ✅ 已定（A，含已上架）

- **判定**：视频**没有任何「可播源」**（可播源 = `is_active=true AND probe_status≠'dead' AND render_status≠'dead'`），**不限上架状态**。
  - 谓词：`EXISTS video_sources(vid)` 且 `NOT EXISTS (vs WHERE is_active AND probe_status≠'dead' AND render_status≠'dead' AND deleted_at IS NULL)`。
  - 比旧 `source_check_status='all_dead'` 更准：覆盖“有源但全部禁用 / 全部探测失效”等真实不可播场景。
- **严重度 badge**：未上架 = 待补（草稿，警示色）；**已上架且无可播源 = 线上事故（红，最紧急）**。同属「待补源」筛选集，badge 区分轻重。

**列过滤（列头菜单，非表格头部）**：探测 enum / 试播 enum / 站点 enum / 质量 boolean / 最近检测 date-range，全部经**列头菜单 → 筛选…**（`DataTableAutoFilter` + distinct 端点）调起；激活态在该列列头显指示符，清除在该列菜单内。表格头部不出现筛选下拉行 / 已选过滤 chip 条（§1.1）。

### 3.6 行展开区 — 复用共享 `LinesPanel`（经中性控制器）

- **删除** `MatrixExpand`（`SourceMatrixRow.tsx`），改用 `<LinesPanel density="regular">`。
- **数据/动作来源（第二轮修订，阻断项 2）**：`useVideoSources` 仅 toggle / disableDead / refetch / health（`use-sources.ts:34`），**缺**单集/整组 probe·render 控制器（仍在审核台内部 `moderation/LinesPanel.tsx:182`）。⇒ **前置抽取中性 `useSourceLinesController(videoId)`**（卡 0.5，§5.5），审核台 / 编辑抽屉 TabLines / 本展开区三方共用；client 端 `groupSourcesByLine` 聚合。**不要扩旧 `getVideoMatrix`**（`EpisodeCell` 缺 `updatedAt`/`latencyMs`/`quality`）。**禁止 `/admin/sources` 反向 import 审核台内部组件**。
- 接通 `LinesPanel` 回调：toggle / onToggleLine / probe / render-check / probeAll / renderCheckAll / disableDead / refetch / health，并显示 codename / retired / auto_retired。
- 收益：单集启停、单集探测/试播、整组批量、禁用连接失败源、重新采集、别名短码退役态、**任意集数不截断**（消除 `.slice(0,8)`）、消除 render 阶段请求反范式。

---

## 4. 线路别名页（保留入口，移除内嵌表）

- 移除 `SourcesClient` 的“全局别名表 Tab”（`activeTab==='aliases'` 分支 + `SourceLineAliasPanel` 内嵌）。
- 保留顶栏 `[线路别名管理 →]` 按钮跳 `/admin/source-line-aliases`（已存在，`SourcesClient.tsx:483-495`）。
- `孤岛 → 待补源视频` 改名级联：`VideoGroupStats.orphan` 字段名、KpiCard label、SQL alias 同步；`getVideoGroupStats`（`:128`）与 `listVideoGroups`（`:192`）有**重复 orphan 逻辑**，两处都改。**`SourceSegment` 枚举不在此改名**（仅废弃兼容，§5.3）。
- **KPI 重算 + 卡即筛选（B 方案）**：KPI 卡改为 5 张可点击筛选卡 `全部 / 含异常源 / 待补源 / 待探测 / 低质量`（§3.5）。计数派生：含异常源 = 连接 OR 试播失败、待探测 = probe pending、待补源 = 无可播源（§3.5.1）、低质量 = `MAX(quality_rank)<4`（仅已知质量）；`全部` 卡副标题挂总量。`getVideoGroupStats` 从 `source_check_status`(①) 全面切换，grid 由 4 列扩 5 列。**KpiCard 需扩 `pressed`/`aria-pressed`（卡 3-pre，Opus 评审）**。

---

## 5. 数据 / 契约缺口与必补前置（拆卡前必须解决）

### 5.1 用户投稿 / 反馈功能整体下线（裁决，2026-06-01）

- **移除「失效举报」**：不做 `user_submissions.bad_source` 计数/列/筛选；未来「用户反馈播放问题」走**触发 probe 重验**（`enqueueVerifySingle`），反映在探测维度②。原“失效举报写入管线”卡**取消**。
- **移除「元数据纠错」展示**：视频库不再有 `metadata_correction` 计数/筛选。
- **移除「用户投稿源」展示**：不暴露 `submitted_by`。旧「用户纠错」Tab 直接删除，无替代。
- **关闭投稿写入端点** ✅（a，2026-06-01）：`POST /sources/submit` **保留路由但返 `410 Gone`、停止写库**（CLAUDE.md 禁删 API 路径）；移除前台投稿入口 + 停用 `verifyFromUserReport` 投稿触发；`POST /sources/:id/report-error`（播放反馈入队重验）保留。
- 结论：本批次**不触碰 `user_submissions`**；`submitted_by` 字段保持现状（不删、不读、不展示）。

### 5.2「失效」维度统一（裁决落地点）

- 凡“失效”一律走**探测维度②**（`probe_status` / `render_status` = dead）；`is_active=false` 一律称**「禁用」**。
- 落地清单：① `getVideoGroupStats` 的 KPI FILTER 从 `source_check_status`(①) 切探测(②)；② 线路列表 `listVideoGroups` 增 `失效源数(②) / 待探测 / 可用源数(①)` 派生；③ `待补源` 判定按 §3.5.1 选定（精确“无可播源” vs 廉价 `all_dead`）。

### 5.3 `SourceSegment` 仅废弃兼容（不改名、不先删）

`SourceSegment` 被 `SourcesClient` 与 `sources-matrix.ts` 使用。本批次**只加 `@deprecated` 标记 + 保留兼容**，**不改枚举值名**（避免与新快捷筛选 key 混淆）；UI 切到新快捷筛选后（卡 5 末）再删枚举与 segment 查询分支。§4 改名仅限 KPI/stats 展示层，不动 `SourceSegment`。

### 5.4 文件超限（硬前置）

`VideoListClient.tsx` 已 **789 行**、`SourcesClient.tsx` **623 行**，均破 500 行硬限。**先抽分**：`buildVideoColumns` / `buildColumns` / `BatchActionsRow` 落到独立文件，再叠加新逻辑（CLAUDE.md「文件超 500 行不先拆分不得继续写」）。

### 5.5【前置】抽取中性 `useSourceLinesController`（阻断项 2）

现 `useVideoSources` 缺单集/整组 probe·render（`use-sources.ts:34`）；完整控制器在审核台内部（`moderation/LinesPanel.tsx:182`）。新增前置卡（卡 0.5）抽中性 hook `useSourceLinesController(videoId)`：启停 / 禁用连接失败源 / 重新采集 / 健康 + 单集 probe·render-check + 整组 probe·render-check，供**审核台 / 编辑抽屉 TabLines / 线路展开区**三方共用。**依赖方向单向**：`/admin/sources` 不得反向 import `/admin/moderation` 内部组件。属共享 hook 契约 → **Opus 评审**。

---

## 6. 拆卡建议（含评审修正）

| # | 卡 | 关键约束 / 触发门禁 |
|---|----|---------------------|
| 0 | **前置**：两个 client 列/过滤器/操作组件抽分（解超限） | 纯重构，无行为变化 |
| 0.5 | **前置**：抽中性 `useSourceLinesController(videoId)`（§5.5） | 共享 hook 契约 → **Opus 评审**；禁止 `/admin/sources` 反向 import 审核台内部 |
| 1 | 定义双表 DTO、问题枚举、术语（连接/试播/异常/禁用）、“待补源”语义；`SourceSegment` 仅标 deprecated（不改名/不删） | 改 `@resovo/types` → **强制 Opus 子代理 + commit trailer `Subagents: arch-reviewer (...)`** |
| 3-pre | KpiCard 扩 `pressed`/`data-active`/`aria-pressed`（B 选中态） | 共享组件 API 契约 → **Opus 评审 + trailer** |
| 2 | 视频库 API：集数 / Bangumi / meta 质量 + **过滤升级（数组 enum / 年份 range / 国家 / 连载 / 豆瓣 / Bangumi / 完整度 / 集数异常）+ 搜索扩原名+短 ID** + distinct 白名单加 country/douban/bangumi | **ADR-150 amendment**（distinct + `media_catalog.country` 逻辑表）；扩现有端点 → ADR amendment |
| 3 | 线路聚合 API：可用源数(①) / 连接失败 / 试播失败 / 待探测 / 质量（`quality_rank`+覆盖率+延迟中位）/ 待补源判定；KPI stats ①→② | ADR-117 amendment；**无失效举报**（§5.1） |
| 4 | 重构视频库列（复合显示列 + 默认隐藏原子可筛选列）/ 三层过滤 / 行操作 | 范围 ≥5 项 → 拆 `-A`（列+格式）/`-B`（过滤+操作） |
| 5 | 重构线路页：删四 Tab + 删内嵌别名 Tab + 问题列（连接/试播/待探测）+ 快捷筛选（KPI 卡 pressed） | 范围 ≥5 项 → 拆 `-A`/`-B`；末尾删除 `SourceSegment` |
| 6 | 用 `LinesPanel` 替换 `MatrixExpand`（消费卡 0.5 控制器） | 不扩 `getVideoMatrix`；client 端 `groupSourcesByLine` |
| 7 | 回归测试 | 动漫集数 / Bangumi 筛选 / 连接失败 / 试播失败 / 待补源 / 待探测 / 批量探测 / 长剧集展开 |
| 8 | **关闭投稿**：`POST /sources/submit` 返 `410 Gone` 不写库 + 移除前台投稿入口 + 停 `verifyFromUserReport` | **不删路由**（CLAUDE.md）；非 admin 路由无 ADR-gate，记 changelog；独立卡，可任意时点落地 |

**依赖链**：前置 `0 / 0.5 / 3-pre` → `1` → `(2,3)` → `(4,5,6)` → `7`（已无 1.5；3-pre 与 1 可并行；卡 8 独立）。

---

## 7. 风险与待决策（请审核拍板）

1. **用户投稿/反馈功能下线** ✅ 已定（2026-06-01）：移除失效举报 / 元数据纠错 / 投稿源展示；不触碰 `user_submissions`（§5.1）。
2. **「失效」=探测维度②、「禁用」=is_active①** ✅ 已定（§0.2）。
3. **「待补源视频」判定** ✅ 已定：A 精确“无可播源”，**含已上架**（已上架且无可播源 = 线上事故红，§3.5.1）。
4. **“低质量”阈值** ✅ 部分定：最高分辨率 **< 720P**；**延迟阈值暂不纳入**（数据稳定后再评估，仅展示于质量列）。
5. **默认排序** ✅ 已定：视频库 `updated_at desc` / 线路 `last_checked desc`。
6. **快捷筛选落位** ✅ 已定：**B 方案——可点击 KPI 卡 / 统计计数**（视频库 = 统计行计数，线路页 = KPI 卡）；点击切换、可组合、选中高亮、`全部` 清空（§2.6 / §3.5）。
7. **集数“已播 > 收录”展示**（未单独表态，采 §2.4 默认）：warn 染色 + hover“外部数据领先于已收录”；如需改口径请告知。
8. **视图保存 / 刷新 / 导出的去处** ✅ 已定（2026-06-01）：
   - **刷新** → 去掉显式按钮，筛选/排序/分页变更时自动 refetch（现有 effect 已具备）；
   - **导出 CSV** → 固定在 PageHeader（与“手动添加视频”并列）；
   - **视图保存** → 本批次暂缓，不放入页面，后续单独评估入口形态。
9. **`POST /sources/submit` 投稿端点处置** ✅ 已定（a，2026-06-01）：**关闭投稿**。
   - 实现取向：CLAUDE.md 禁止「删除现有 API 路径」⇒ **保留路由、改返回 `410 Gone` 且不写库**（非物理删除），同时移除前台投稿入口 + 停用 `verifyFromUserReport` 投稿触发路径。
   - 播放问题反馈端点（`/sources/:id/report-error` 入队重验）**保留不变**（`sources.ts:117`）。
10. **列锁定/顺序** ✅ 已定（降级）：标题列静态 `pinned`，本批次不支持用户改锁定/顺序（§1.1-3，受 DataTable 现有能力限制）。

---

## 8. 阶段二（本批次不做，预留）

- **视频库行展开显示完整 metadata**：点行展开子区/抽屉，显示该视频全部外部元数据（豆瓣 / Bangumi / 演职 / 简介 / 别名 / 分辨率等）。
- **表格列仅显示共同关键数据**：不同类型（电影 / 剧集 / 动漫 / 综艺…）字段差异大，表格列只放**共同关键列**（§2.2）；**类型专属字段进展开区**，不进表格列——避免列爆炸与大面积空列。
- 实现取向：评估复用 `VideoEditDrawer` 外部数据 Tab 的展示能力；展开是**叠加层**，不改本批次列设计（互不冲突）。
