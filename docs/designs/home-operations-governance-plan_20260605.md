# 首页运营治理方案 — UI/UX 同构编辑器 + 自动填充体系

> status: active proposal
> owner: @engineering
> scope: `/admin/home` UI/UX governance, home curation contracts, autofill policy
> source_of_truth: design-plan
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-05

## 0. 背景与目标

本方案响应用户对首页运营位的新改造要求：

- 后台页面展示应与前台首页一致，但各区块可编辑 / 设置。
- 视频卡片支持拖动、删除。
- 各区块预设空卡片支持添加视频。
- 各模块要有自动填充方式，且自动填充需有明确的更新频率。
- 热门电影、电视剧从豆瓣获取；热门动漫从 Bangumi 读取。
- 顶部 Banner **强烈建议**提供横版大图（不强制）；缺横版大图时后台必须显著标记缺图提醒。

现状基础：

- 前台首页结构为 `HeroBanner`、分类捷径、`FeaturedRow`、`TopTenRow`、热门电影、热播剧集、热门动漫。
- 后台 `/admin/home` 已有 `home_modules` 列表编辑、拖拽、删除、批量添加、趋势导入、Top10 自动补位可视化。
- `home_banners` 与 `home_modules.slot='banner'` 同时存在，前台 `HeroBanner` 当前消费 `/banners` / `home_banners`，存在 Banner 双真源风险。
- 豆瓣 / Bangumi 元数据与本地匹配能力已存在，但首页自动填充尚未形成统一治理策略。

目标是把首页运营从“记录列表编辑”升级为“前台同构画布 + 区块策略 + 自动候选 + 发布审计”的治理系统。

## 1. 输入输出契约

### 输入

1. 人工运营配置：Banner、精选、Top10、分类入口、热门区块的手动 pinned 条目与区块设置。
2. 站内视频池：已发布、可见、可播放的视频及封面、类型、评分、元数据状态。
3. 外部热度源：
   - 豆瓣：热门电影、热门电视剧候选。
   - Bangumi：热门动漫候选，优先使用 rank，排除 nsfw。
4. 运行上下文：brand、locale、preview time、设备视口。

### 输出

1. 前台首页真实渲染数据：各区块最终卡片列表，含 pinned / auto 标识。
2. 后台编辑画布：与前台首页同顺序、同布局、同卡片语义的可编辑视图。
3. 自动填充解释：每个自动候选的来源、分数、排名、过滤原因或入选原因。
4. 审计记录：人工创建 / 更新 / 删除 / 排序 / 发布 / 自动候选应用。

## 2. 治理原则

1. **单一展示真源**：前台首页最终展示必须来自统一的 Home Curation 聚合结果；后台画布预览也消费同一聚合口径。
2. **人工优先，自动补位**：手动 pinned 条目优先，自动候选只补空位，不覆盖人工运营判断。
3. **自动可解释**：自动填充不能只给结果，必须展示来源、排序原因、被过滤原因。
4. **Banner 横图治理（建议 + 提醒，不阻断）**：首屏 Banner 是品牌主视觉，**强烈建议**提供合格横版大图，但不强制阻断发布；缺横版大图时允许回退视频封面，后台画布与 Inspector 必须显著标记"缺横版大图"风险态（与 ADR-052 AMENDMENT D-052-9"宽松优先 + UI 提示引导"口径一致）。
5. **配置与内容分离**：区块策略归 Home Curation；视频、豆瓣、Bangumi 数据仍归各自服务，避免 UI 直连 DB 或跨层调用。
6. **发布可回滚**：运营修改必须可审计；高影响操作（发布、删除、应用自动候选）可追溯。

## 3. 信息架构

`/admin/home` 应采用三栏或两栏增强形态：

```text
┌──────────────────────────────────────────────────────────────┐
│ PageHeader：首页运营  预览前台 / 保存草稿 / 发布 / 审计        │
├──────────────────────────────────────────────────────────────┤
│ 环境栏：brand / locale / preview time / desktop-mobile        │
├───────────────────────────────┬──────────────────────────────┤
│ 前台同构画布                   │ 右侧 Inspector                │
│ 1. Hero Banner                 │ - 当前区块设置                │
│ 2. 分类快捷入口                │ - 自动填充策略                │
│ 3. 精选推荐                    │ - 候选池 / 过滤原因           │
│ 4. Top10                       │ - 时间窗 / 发布状态           │
│ 5. 热门电影                    │ - 图片 / 文案 / 链接设置       │
│ 6. 热播剧集                    │                              │
│ 7. 热门动漫                    │                              │
└───────────────────────────────┴──────────────────────────────┘
```

原则：

- 画布是主工作区，不再以 slot tab 作为唯一入口。
- 区块点击后右侧 Inspector 展示设置。
- 每个卡片在 hover / focus 时显示拖拽、替换、删除、固定、取消固定等操作。
- desktop / mobile 预览必须同时支持，Banner 裁切尤其要双端可见。

## 4. 区块治理模型

| 区块 | 前台形态 | 人工能力 | 自动填充 | 数据真源建议 |
|---|---|---|---|---|
| Hero Banner | 首屏横幅轮播 | 新建、排序、启停、删除、横图上传、链接视频/外链 | 不允许全自动发布；可给候选 | `home_banners` 作为 Hero 真源，纳入 `/admin/home` |
| 分类快捷入口 | 类型入口 chips/cards | 排序、显示隐藏、标题 | 按类型可见视频数补角标 | `home_modules.type_shortcuts` 或后续裁定退役 |
| 精选推荐 | 前台 Featured 网格 | 添加、拖拽、删除、固定 | 站内趋势 / 外部热门混合补位 | `home_modules.featured` + 聚合端点 |
| Top10 | 排行横滑 | 添加、拖拽、删除、固定 | rating / 热度补足 10 个 | 现有 `/home/top10` 扩展解释字段 |
| 热门电影 | poster shelf | 可固定头部若干卡 | 豆瓣热门电影 → 站内可播视频映射 | 新 Home Curation 自动策略 |
| 热播剧集 | poster shelf | 可固定头部若干卡 | 豆瓣热门电视剧 → 站内可播视频映射 | 新 Home Curation 自动策略 |
| 热门动漫 | poster shelf | 可固定头部若干卡 | Bangumi rank/rating → 站内可播视频映射 | 新 Home Curation 自动策略 |

## 5. 卡片交互规范

### 5.1 视频卡片

所有视频型区块卡片统一支持：

- 拖拽排序：同区块内排序立即预览，保存后事务提交。
- 删除：仅从运营位移除，不删除视频实体；危险操作二次确认。
- 替换：打开 `VideoPicker`，保留当前排序位。
- 固定 / 取消固定：自动卡片可一键转 pinned；pinned 卡片可释放为自动补位。
- 状态展示：`pinned`、`auto`、待生效、已过期、引用失效、图片缺失、缺横版大图（Banner 专属风险态）、不可播放。
- 时间窗状态依赖说明：「待生效 / 已过期」两态对所有区块**无 schema 前置**——`home_banners` 已有 `active_from` / `active_to`，`home_modules` 已有 `start_at` / `end_at`（migration 050 起即存在；初稿评审期误判为缺失，2026-06-05 勘误，见 §9.1）。

### 5.2 空卡片

空卡片不是普通 EmptyState，而是前台布局中的占位卡：

- Banner 空位：显示“添加横版 Banner”，点击进入 Banner Inspector。
- 视频空位：显示“添加视频”，点击打开 VideoPicker。
- 自动空位：显示“开启自动填充”或“查看候选”。
- 空位数量由区块 `displayCount` 决定，例如 Top10 固定 10 个槽位。

### 5.3 拖拽边界

- 视频卡片可在视频型区块间拖动，但跨区块落位必须触发确认，因为语义从 featured 变为 top10 / hot shelf 会改变排序策略。
- Banner 不接受普通 poster 卡片直接落位；若拖入视频，只能作为链接目标，仍必须补横版大图。
- 分类入口不接受视频卡片，只接受 video type / category 配置。

## 6. Banner 横版大图治理

Banner 是首屏视觉真源，采用**建议 + 提醒**口径（不强制阻断）：

1. ~~`imageUrl` **强烈建议**提供；缺失时允许回退 video coverUrl 发布，但后台必须在画布卡片、Inspector、发布确认三处显著标记"缺横版大图"风险态。~~
   > **勘误（2026-06-07，CHG-HOME-GOV-PLAN-ERRATA）**：`home_banners.image_url` 自 migration 049 起 **NOT NULL**——「缺横版大图」态在 Hero 真源下**结构上不可达**（schema 吸收，BannerDrawer imageUrl 必填）。本条实际落地口径 = IMAGE-GUARD-BANNER 的**尺寸 / 比例 / 探测失败三类警告**（下方第 2/3/6 条），警告级不阻断不变；「三处显著标记」中画布卡片 + Inspector 两处已由三类警告承载，**「发布确认」第三处义务移交 Phase 4 `CHG-HOME-DRAFT-PUBLISH` 验收项**（Phase 1 画布直写无发布确认环节，发布流落地时实现）。
2. 推荐尺寸 1920x1080；最低建议 1280x720。低于建议尺寸标记警告，不阻断。
3. 比例建议 16:9 到 21:9；超出范围标记警告并建议裁切，不阻断。
4. 上传后必须展示 desktop 与 mobile 安全区预览。
5. 支持 focal point 设置，避免移动端裁切主体。
6. 外链图应通过尺寸探测；探测失败时标记风险提醒，运营确认后仍可发布。
7. Banner 文案与链接可选。

> 校验级别小结：所有横图校验（~~缺图 /~~ 尺寸 / 比例 / 探测失败）统一为**警告级**——显著提醒、不阻断发布。该口径与 ADR-052 AMENDMENT 2026-06-05（D-052-9）"首版不加 service 层条件必填校验，宽松优先 + UI 提示引导"一致；后续若运营反馈缺图率过高，再评估升级为阻断级。〔勘误 2026-06-07：「缺图」自三类警告中除名——image_url NOT NULL 使该态不可达，见上方第 1 条勘误〕

治理裁定：

- `home_banners` 继续作为 `HeroBanner` 首屏真源。
- `/admin/home` 统一承载 Banner 编辑入口。
- `home_modules.slot='banner'` 需要后续 ADR 裁定：退役、迁移为非 Hero 运营位，或与 `home_banners` 合并。裁定前不得让运营维护两套可同时影响首屏的 Banner 配置。
- **D-052-9 对账义务**：ADR-052 AMENDMENT 2026-06-05 刚为 `home_modules` 补齐 `title` / `image_url` 一等列（banner slot 的 external_url / custom_html 以 `image_url` 为唯一图源）。`CHG-HOME-GOV-ADR` 起草时必须显式对账：若裁定 banner slot 退役，D-052-9 投入的列如何处置（保留供非 Hero 运营位使用 / 随迁移合并入 `home_banners`）；不得出现两份同期文档口径互斥。

## 7. 自动填充策略

### 7.1 通用算法

每个区块最终展示按以下顺序生成：

```text
pinned 手动条目
→ 自动候选排序
→ 站内兜底趋势
→ 空卡片占位
```

通用过滤：

- `is_published=true`
- `visibility_status` 前台可见
- 非成人内容
- 至少有一条可播放源
- 图片可用，或有明确 fallback
- 当前 brand / locale 可展示
- 未被当前首页其它区块占用，除非区块设置允许重复

跨区块去重归属：去重需要整页视角，统一在 `HomeCurationService` 聚合层按整页一次性计算；`GET /admin/home/autofill-candidates` 等单区块端点内部走整页聚合取上下文，**不要求客户端传入其它区块的占用状态**。

### 7.2 自动模式

| 模式 | 说明 | 适用 |
|---|---|---|
| manual_only | 只展示人工 pinned，不自动补 | Banner、重大专题 |
| manual_plus_autofill | pinned 优先，空位自动补 | featured、top10、热门区块 |
| suggest_only | 只生成候选，需人工应用 | Banner 候选、活动期精选 |
| full_auto | 全部来自策略，运营只设规则 | 热门电影 / 剧集 / 动漫 shelf |

默认建议：

- Banner：`suggest_only`
- featured：`manual_plus_autofill`
- top10：`manual_plus_autofill`
- 热门电影 / 热播剧集 / 热门动漫：`full_auto`，但允许 pinned 头部覆盖。

### 7.3 自动更新频率

自动候选不是请求时实时计算，而是**worker 定时重算 + 端点只读消费**：

1. **刷新调度**：复用现有 `apps/api/src/workers/` worker + scheduler 体系（同 crawlerScheduler / maintenanceScheduler 模式），新增 home autofill 重算 job；不引入新调度依赖。
2. **频率归属区块设置**：每个区块的 `refreshInterval` 是 section settings 的一部分（运营可配置，不写死值），默认建议：
   - 热门电影 / 热播剧集（豆瓣源）：每 24h 重算（豆瓣 dump 数据本身低频更新）。
   - 热门动漫（Bangumi 源）：每 24h 重算。
   - featured / top10 自动补位（站内趋势源）：每 1h 重算。
   - Banner `suggest_only` 候选：每 24h 重算。
3. **重算产物**：每次重算生成带时间戳的候选快照（来源、分数、排名、过滤原因、策略版本），供后台解释展示与审计回溯（见 §11）。
4. **重算 ≠ 生效**：`full_auto` 区块重算后下个缓存周期生效；`manual_plus_autofill` / `suggest_only` 区块重算只更新候选池，不改动 pinned 条目。
5. **手动触发**：后台 Inspector 提供"立即刷新候选"入口（admin 端点，需纳入 ADR），用于运营即时核对，不绕过过滤规则。

## 8. 豆瓣 / Bangumi 热榜策略

### 8.1 豆瓣热门电影 / 剧集

候选来源：

- 本地 `external_data.douban_entries`。
- 优先使用已有 douban id / external refs 映射到 `media_catalog` 与站内视频。
- 若豆瓣条目未映射到站内可播视频，仅进入“缺口候选”，不直接展示到前台。

排序建议：

```text
douban_votes 权重
+ rating 权重
+ 最近上线/更新权重
+ 站内可播放源健康权重
- 图片缺失/源不稳定惩罚
```

电影与剧集必须分开候选池（**分池信号 2026-06-05 勘误改裁**，见下）：

- 热门电影只取 movie；热播剧集只取 series。
- ~~类型无法确认时进入候选审核，不自动入前台。~~（已消解，见勘误）

> **勘误（ADR-183 D-183-1，2026-06-05）**：前置统计实测 `douban_entries` 140,502 行 `media_type` null 占比 0%——但取值 **100% = 'movie'**（`import-douban-dump.ts` 导入硬编码，剧集被误标），**media_type 不可作为分池依据**。改裁：分池统一用**映射后站内 `videos.type`**（movie/series/anime → 三 hot shelf，站内审核链路保证可信）；豆瓣 media_type 降级为缺口候选提示性字段；「类型无法确认」条款自然消解（站内 type 恒可确认）。dump 重导入推断真实 media_type 为可选 follow-up（CHG-DOUBAN-MEDIATYPE-REIMPORT），不阻塞。

豆瓣条目未映射的"缺口候选"治理：沿用与 §8.2 相同的内容缺口模式；豆瓣侧当前**无**对应建库服务（无 DoubanSeedService），是否扩展 ADR-161 式反向建库链路到豆瓣由 ADR 裁定，本方案不预设。

### 8.2 Bangumi 热门动漫

候选来源：

- 本地 `external_data.bangumi_entries`。
- 优先 `rank ASC`，其次 `rating DESC`。
- 必须过滤 `nsfw=true`。
- 通过 `bangumi_subject_id` / `video_external_refs(provider='bangumi')` 映射到站内 anime 视频。

排序建议：

```text
rank 越小越靠前
+ rating
+ 站内可播放源健康
+ 最近更新
- 集数缺失/图片缺失惩罚
```

未映射到站内可播视频的 Bangumi 条目进入“内容缺口”列表，但不直接展示。**缺口 → 建库链路复用 ADR-161 决策 7 的 `BangumiSeedService` 反向建库能力**（含 `nsfw=false` 默认过滤、rank/year 过滤，见 `apps/api/src/db/queries/externalData.ts` 既有实现），不新建平行链路；首页治理层只负责把缺口列表透出给运营，建库动作走既有 ADR-161 路径。

## 9. 后端边界建议

新增 Home Curation 聚合层，避免 UI 直连各业务查询：

```text
Route
  → HomeCurationService
    → home module/banner queries
    → video queries
    → externalData queries
    → source health queries
```

建议端点：

| 端点 | 说明 |
|---|---|
| `GET /admin/home/preview` | 返回完整首页预览，参数含 brand、locale、at、device |
| `GET /admin/home/sections` | 返回区块配置与当前发布状态 |
| `PATCH /admin/home/sections/:section/settings` | 更新区块设置 |
| `GET /admin/home/autofill-candidates` | 获取某区块自动候选与解释（消费 worker 重算快照，只读） |
| `POST /admin/home/sections/:section/apply-autofill` | 将候选转为 pinned |
| `POST /admin/home/sections/:section/reorder` | 区块内排序 |
| `POST /admin/home/sections/:section/refresh-candidates` | 手动触发该区块候选重算（§7.3 第 5 条） |

新增端点需要 ADR；若只是扩展现有 `/home/top10` / `/home/modules` 响应字段，走对应 ADR amendment。

ADR 粒度建议：上表 7 个新 admin 端点 + Banner 真源裁定 + 时间窗 schema + 热门 shelf 存储裁定全部塞进单份 ADR 会过重，建议按「真源与 schema 裁定 / 端点协议 / 自动填充策略」拆为 2–3 份关联 ADR，每份独立走 Opus PASS（plan §4.5 R7 MUST-8）。

### 9.1 时间窗 schema 现状与命名分歧处置（2026-06-05 勘误）

> **勘误**：本节初版（评审修订 ②）断言 `home_modules` 无时间窗字段、需新增 migration——**事实性误判**（仅按 `home_banners` 命名 `active_from/active_to` grep 导致漏检）。实际两表时间窗 schema 均已齐备，**无需任何 migration**，原拆卡 `CHG-HOME-TIMEWINDOW-SCHEMA` 已取消。

- `home_banners`：`active_from` / `active_to` / `is_active`（migration 049）。
- `home_modules`：`start_at` / `end_at`（migration 050，含 `home_modules_time_window_valid` CHECK + `(start_at, end_at) WHERE enabled` 部分索引），`enabled` 为启停闸门；queries / 类型层（`startAt`/`endAt`）/ admin Drawer 编辑已全链路打通。
- **命名分歧处置（ADR-181 裁定项）**：两表命名各自保留，**禁止 rename migration**（破坏稳定性零收益）；Home Curation 聚合层 DTO 统一输出 `startAt` / `endAt` 语义，`home_banners.active_from/active_to` 在聚合层映射，`is_active` 与 `enabled` 统一映射为 `enabled`。
- 热门电影 / 热播剧集 / 热门动漫三个新区块的 pinned 存储为 ADR 必裁项：扩展 `HomeModuleSlot` 枚举（如 `hot_movies` / `hot_series` / `hot_anime`，ADR-052 明确"新增 slot 必须走新 ADR"）或新表。本方案倾向扩展 slot 枚举（复用 `home_modules` 的 ordering / brand_scope / 时间窗 / 审计基建），最终由 ADR 裁定。

## 10. 状态归属

| 状态 | 归属 |
|---|---|
| 卡片是否 pinned | Home Curation 配置 |
| 卡片排序 | Home Curation 配置 |
| 视频是否可播放 | Video / Source 服务 |
| 视频评分、类型、年份 | Video / MediaCatalog |
| 豆瓣热门候选 | externalData + HomeCuration 排序策略 |
| Bangumi 热门候选 | externalData + HomeCuration 排序策略 |
| Banner 横图 | Banner 配置 + media image 管线 |
| 区块自动刷新频率 refreshInterval | Home Curation section settings |
| 自动候选快照（含策略版本） | Home Curation 重算产物（worker 写入） |
| 预览设备、locale、brand | `/admin/home` UI state，不写 DB |

## 11. 发布与审计

发布模型建议分三层：

1. 编辑态：后台本地状态或草稿配置，不影响前台。
2. 预览态：`GET /admin/home/preview` 以草稿 + 当前数据聚合。
3. 发布态：写入正式配置，前台查询生效。

审计必须覆盖：

- create / update / delete
- reorder
- publish toggle
- apply autofill
- banner image update
- section settings update

审计 payload 要包含 before / after、候选来源、自动策略版本、操作者与 request id。

`full_auto` 区块的审计锚定：该模式无逐条"发布"动作，前台展示随外部数据与重算漂移，审计锚定两类对象——

1. **策略版本变更**：运营修改区块设置（模式、refreshInterval、过滤规则、pinned 头部）时记 audit log（人工操作，含 before / after）。
2. **重算快照**：每次 worker 重算落带时间戳的候选快照（§7.3 第 3 条），用于回溯"某时刻前台为何展示 X"；快照属系统产物，不计入人工审计流，但回滚 diff 展示时可引用。

## 12. 缓存与一致性

- 前台首页可以保留短 TTL，但后台发布后应主动失效相关 key。
- Top10 现有 60s 缓存策略可以保留，但后台预览必须跳过或显式标记缓存时间。
- 豆瓣 / Bangumi 候选可缓存，但应用到首页时必须重新校验视频可见性与可播放性。
- 自动候选列表中的“已不可用”必须在 UI 中标灰并显示过滤原因。

## 13. 实施拆卡建议

### Phase 1：真源与同构预览

1. `CHG-HOME-GOV-ADR`：起草 Home Curation ADR（按 §9 粒度建议拆 2–3 份），必裁项：Banner 真源 + D-052-9 对账（§6）、时间窗命名分歧处置（§9.1，勘误后无 migration）、热门 shelf 存储（slot 枚举 vs 新表）、section settings、自动候选端点协议、更新频率调度。
2. `CHG-HOME-BANNER-UNIFY`：`/admin/home` 纳入 `home_banners` 编辑，按 ADR 裁定执行 `home_modules.banner` 去留（裁定在 ADR 卡完成，本卡只执行）。
3. ~~`CHG-HOME-TIMEWINDOW-SCHEMA`~~：**已取消（2026-06-05 勘误）**——`home_modules` 自 migration 050 起已有 `start_at`/`end_at` 全链路，见 §9.1。
4. `CHG-HOME-PREVIEW-API`：新增完整首页预览聚合端点。
5. `CHG-HOME-CANVAS`：后台从 slot list 升级为前台同构画布。范围大概率触发原子化判据，预拆 `-A`（画布布局 + 区块渲染）/ `-B`（Inspector + 环境栏）。

> 阶段衔接：Phase 1 画布首版**直写正式配置**（与现 `/admin/home` 行为一致），头部"保存草稿 / 发布"按钮在 Phase 4 `CHG-HOME-DRAFT-PUBLISH` 落地前隐藏，避免交付假交互。

### Phase 2：卡片操作闭环

1. `CHG-HOME-CARD-DND`：同构画布内卡片拖拽、跨区块确认。
2. `CHG-HOME-EMPTY-SLOTS`：各区块空卡片添加入口。
3. `CHG-HOME-IMAGE-GUARD-BANNER`：Banner 横图尺寸、比例、安全区、focal point **警告级**校验 + 缺图风险态标记（§6）。命名与 ADR-052 AMENDMENT 预留的 `CHG-HOME-IMAGE-GUARD`（管 `home_modules.image_url`）同系列分卡，两卡职责显式区分，避免双卡漂移。

### Phase 3：自动填充

1. `CHG-HOME-AUTOFILL-CORE`：通用自动填充策略、整页去重、解释模型。范围跨 service + 快照存储 + 类型层，预拆 `-A`（策略与去重）/ `-B`(候选快照与解释模型)。
2. `CHG-HOME-AUTOFILL-REFRESH`：worker 重算 job + refreshInterval section settings + 手动刷新端点（§7.3）。
3. `CHG-HOME-AUTOFILL-DOUBAN`：豆瓣热门电影 / 剧集候选（前置：media_type 分布统计，§8.1）。
4. `CHG-HOME-AUTOFILL-BANGUMI`：Bangumi 热门动漫候选 + 缺口列表复用 ADR-161 链路（§8.2）。
5. `CHG-HOME-AUTOFILL-APPLY`：候选应用为 pinned + 审计。

### Phase 4：发布治理

1. `CHG-HOME-DRAFT-PUBLISH`：草稿 / 预览 / 发布模型。
2. `CHG-HOME-AUDIT-ROLLBACK`：审计回滚与 diff 展示。
3. `CHG-HOME-CACHE-INVALIDATE`：发布后缓存失效。

## 14. 验收标准

功能验收：

- 运营能在 `/admin/home` 看到与前台首页同顺序、同布局的画布。
- 每个区块都可进入设置面板。
- 视频卡片可拖拽、删除、替换、固定 / 取消固定。
- 每个区块空位可添加视频或开启自动填充。
- ~~Banner 缺横版大图时仍可发布，但后台画布、Inspector、发布确认三处均显示"缺横版大图"风险标记。~~〔勘误 2026-06-07：缺图态不可达（image_url NOT NULL，§6.1 勘误）→ 验收口径改为「Banner 横图尺寸 / 比例 / 探测失败三类警告在编辑器显著展示且不阻断提交」（IMAGE-GUARD-BANNER 已落地 + CHG-HOME-E2E-SPEC E2E 覆盖）；「发布确认」处标记义务移交 Phase 4 `CHG-HOME-DRAFT-PUBLISH` 验收项〕
- 热门电影 / 热播剧集候选来自豆瓣，并只展示站内可播放映射。
- 热门动漫候选来自 Bangumi，并排除 nsfw。
- 自动候选可解释、可跳过、可应用。
- 每个自动区块的更新频率可在 section settings 配置，worker 按频率重算并落候选快照；手动"立即刷新候选"可用。

质量验收：

- 后端保持 Route → Service → DB queries 分层。
- UI 不直接调用 DB queries。
- 新端点必须有 ADR 或 ADR amendment。
- 写操作必须有 audit log 测试断言。
- 前台首页、后台 `/admin/home`、自动候选 API 有单测与 E2E / 视觉回归覆盖。

## 15. 非目标

- 本方案不要求本卡直接实现代码。
- 不引入新第三方依赖（含调度：复用既有 worker / scheduler 体系）。
- 不把未映射的豆瓣 / Bangumi 条目直接展示到前台。
- 不为豆瓣新建平行的反向建库链路（Bangumi 侧复用 ADR-161；豆瓣侧扩展与否由 ADR 裁定）。
- 自动填充不得绕过 Banner 缺图风险标记：`suggest_only` 候选应用到 Hero 时缺图状态必须随卡片透出，不允许静默清除提醒。

## 16. 当前方案结论

首页运营的下一阶段不应继续堆叠 slot 表单能力，而应建立 Home Curation 治理层：

```text
前台同构画布
+ 区块设置 Inspector
+ pinned / auto 双轨卡片
+ 豆瓣 / Bangumi 可解释候选（worker 定频重算）
+ Banner 横图治理（强烈建议 + 缺图提醒，不阻断）
+ 发布审计与缓存失效
```

这能把运营动作从“改数据库记录”收敛为“配置首页展示策略”，也为后续多品牌、多语言、活动档期与外部榜单治理留下清晰扩展面。

## 17. 修订记录

| 日期 | 修订 |
|---|---|
| 2026-06-05 | 初稿 |
| 2026-06-05 | 评审修订：① Banner 横图从强制必填降级为"强烈建议 + 缺图风险标记，警告级不阻断"（§0/§2/§5.1/§6/§14/§15/§16），与 ADR-052 AMENDMENT D-052-9 口径对齐并新增对账义务；② `home_modules` 时间窗 schema gap 显式化为扩展项（§5.1/§9.1，新增 `CHG-HOME-TIMEWINDOW-SCHEMA` 卡）；③ Bangumi 内容缺口裁定复用 ADR-161 `BangumiSeedService`，豆瓣侧扩展与否留 ADR 裁定（§8/§15）；④ 新增自动填充更新频率治理（§7.3，worker 定频重算 + refreshInterval section settings + 手动刷新端点 + 候选快照），§9 端点表 +1，§10/§11/§13/§14 同步；⑤ 跨区块去重归属聚合层整页计算（§7.1）；⑥ `full_auto` 审计锚定策略版本 + 重算快照（§11）；⑦ 热门 shelf 存储列为 ADR 必裁项（§9.1）；⑧ media_type 分布统计列为 ADR 前置（§8.1）；⑨ 拆卡建议补 ADR 粒度拆分、`-A/-B` 预拆、Phase 1 直写降级说明、横图守卫卡更名 `CHG-HOME-IMAGE-GUARD-BANNER`（§13）。 |
| 2026-06-05 | **勘误（CHG-HOME-GOV-ADR-A 调研发现）**：撤销评审修订 ②——`home_modules` 自 migration 050 起**已有**时间窗字段 `start_at`/`end_at`（含 CHECK / 部分索引 / queries / 类型 / admin Drawer 全链路），原"无时间窗字段需扩展"为事实性误判（仅按 `home_banners` 命名 grep 漏检）。§5.1/§9.1/§13 同步更正：无需 migration，`CHG-HOME-TIMEWINDOW-SCHEMA` 卡取消，裁定项改为命名分歧处置（不 rename / 聚合 DTO 统一 `startAt`/`endAt`），归 ADR-181。 |
| 2026-06-05 | **勘误（CHG-HOME-GOV-ADR-C 前置统计实测）**：§8.1 分池信号改裁——`douban_entries.media_type` 实测 100% = 'movie'（导入硬编码，标记不可信，比"null 占比过高"更甚），分池改用映射后站内 `videos.type`（ADR-183 D-183-1）；「类型无法确认进候选审核」条款消解。ADR 三卡（181/182/183）全部 Accepted（各自 arch-reviewer Opus CONDITIONAL PASS 全条件吸收），§13 Phase 1 ADR 卡收口。 |
| 2026-06-07 | **勘误（CHG-HOME-GOV-PLAN-ERRATA，IMAGE-GUARD-BANNER 实施实证）**：§6.1/§14 缺图口径更正——`home_banners.image_url` 自 migration 049 起 NOT NULL，「缺横版大图」态在 Hero 真源下结构上不可达（schema 吸收）；横图治理实际落地 = 尺寸/比例/探测失败**三类警告**（警告级不阻断不变，D-052-9 口径继承）；§6 校验级别小结「缺图」除名；§14 验收第 5 条同步更正且「发布确认」第三处标记义务**移交 Phase 4 `CHG-HOME-DRAFT-PUBLISH` 验收项**（Phase 1 画布直写无发布确认环节）。 |
