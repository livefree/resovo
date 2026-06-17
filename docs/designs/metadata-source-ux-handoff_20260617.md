# 视频元数据多源治理 — 设计师 UI/UX 优化交接报告

> 文档用途：供设计师接手「对不同数据源头的视频元数据进行 UI/UX 优化设计」。
> 接手方式：通过远端 git repo（`origin/main`）拉取，无需本地后端环境即可阅读全部接触点与数据契约。
> 撰写日期：2026-06-17 ｜ 代码基线：`dev` 分支 head（META-54 系列）
> 阅读对象：交互/视觉设计师（不要求阅读源码即可理解信息架构，源码路径仅作定位用）

---

## 0. 30 秒速览

Resovo（流光）是国际化视频资源聚合索引平台，**不托管视频，只做链接索引**。一条「视频/作品」的元数据（标题、年代、地区、评分、简介、封面、导演演员、逐集、角色声优……）并非由编辑手写，而是从**多个外部数据源自动富集（enrich）+ 人工复核**汇聚而成。

管理员在后台对元数据的全部操作集中在 **4 个界面**：

| # | 界面 | 角色场景 | 当前形态 | 核心源码 |
|---|------|---------|---------|---------|
| 1 | **视频库列表** | 批量扫描全库元数据健康度 | 表格行内一个「四源图标簇」列 | `admin/videos` |
| 2 | **视频编辑抽屉** | 单条作品深度精修 | 右侧抽屉，4 个 Tab | `admin/videos/.../VideoEditDrawer` |
| 3 | **审核详情面板** | 待审队列里逐条核对 | 右侧详情 Tab，含元数据面板 | `admin/moderation/.../RightPane/TabDetail` |
| 4 | **审核台快速编辑** | 审核时免开抽屉改 6 字段 | 审核行下方内联芯片 + 输入框 | `admin/moderation/.../PendingMetaQuickEdit` |

这 4 个界面前 3 个**统一消费同一份数据契约** `MetadataStatusSummary`（见 §4），第 4 个走轻量直改路径。**设计优化的最大杠杆 = 把「不同数据源头」的状态、可信度、冲突、操作在这套统一契约上表达得更清晰。**

---

## 1. 业务背景：什么是「不同数据源头」

一条作品的字段值，可能来自以下来源之一（字段级，不同字段可来自不同源）：

| 来源 | 内部 key | 适用范围 | 提供的典型字段 | 外链 | 品牌色/Logo |
|------|---------|---------|---------------|------|------------|
| **豆瓣 Douban** | `douban` | 华语/全品类为主 | 标题、评分+人数、简介、导演/演员、年代、地区 | `movie.douban.com/subject/{id}` | 有官方 logo（admin-ui 内联 data-URI） |
| **Bangumi** | `bangumi` | **仅动画 anime** | 日文原名、放送日、排名、评分、NSFW 分级、**逐集**、**角色·声优** | `bgm.tv/subject/{id}` | 有 |
| **TMDB** | `tmdb` | 全品类（电影/剧集分命名空间） | 标题、原名、原语种、简介、题材、地区、评分、封面、背景图、Logo 图、**季/逐集** | `themoviedb.org/{movie\|tv}/{id}` | 有 |
| **IMDb** | `imdb` | 全品类 | 外部 ID 身份锚点（**当前 Phase 1 尚无写入路径**，恒「未获取」灰显占位） | `imdb.com/title/{id}` | 有 |
| **人工 manual** | `manual` | 任意字段 | 管理员手填/确认，**优先级最高、可加锁防覆盖** | — | 无 logo（系统态） |
| **采集 crawler** | `crawler` | 入库初值 | 源站抓取的初始标题/封面等 | — | 无 logo（系统态） |

> ⚠ 设计须知 1：四个**外部源固定显示顺序** = `豆瓣 / Bangumi / TMDB / IMDb`（常量 `METADATA_PROVIDER_ORDER`）。任何展示四源的地方都必须按此顺序，**不依赖数据对象的 key 迭代序**。这是稳定列宽与扫描顺序的前提。

> ⚠ 设计须知 2：`Bangumi` 对非动画作品是 **`not_applicable`（不适用）**，不是「缺失」——视觉上应区分「灰显·不适用（不扣分）」与「灰显·未获取（计入缺失）」。

> ⚠ 设计须知 3：`IMDb` 当前是「占位四源之一」，绝大多数字段（置信度/匹配方式/应用时间/拉取时间）恒为空。设计时**不要为 IMDb 设计依赖这些字段的强表达**，但要保留它作为第四个图标的视觉位置（未来接入）。

---

## 2. 数据如何分层存储（设计师需理解的「真相在哪」）

元数据**不是平铺一张表**，而是分层。理解这一点能解释 UI 上为什么会出现「冲突」「被锁未保存」「候选待确认」这类状态。

```
┌─ videos（视频实例层）──────────────────────────────────────┐
│  一个可播放条目。冗余缓存部分展示字段（title/year/country…）  │
│  douban_status / bangumi_status：该实例与豆瓣/Bangumi 匹配态  │
│  catalog_id ──┐ 指向所属"作品"                                │
└───────────────┼───────────────────────────────────────────┘
                ▼
┌─ media_catalog（作品元数据层 / 真源）──────────────────────┐
│  归并去重后的"一部作品"。标题四形态、评分、简介、导演演员、    │
│  外部 ID（douban_id/tmdb_id/bangumi_subject_id/imdb_id）、    │
│  metadata_source（最近写入来源）、locked_fields（已锁字段）   │
│  按"季"粒度：正篇第 N 季 / 剧场版 / SP / OVA 各独立 catalog   │
└───┬───────────┬──────────────┬───────────────┬─────────────┘
    ▼           ▼              ▼               ▼
 provenance   locks      external_refs    子表(逐集/角色/别名)
 字段级溯源   字段级锁    外部身份关系      catalog_episodes
 "这个字段    "这个字段   "本作品=豆瓣      catalog_characters
  最后由谁     不许被自    /TMDB 哪条       (+ _actors 声优)
  写入"        动覆盖"     目"+置信度       media_catalog_aliases
```

各层职责（给设计师的「人话」版）：

- **`videos`（实例）**：用户实际点开播放的条目。展示字段是 `media_catalog` 的冗余副本（为前台读性能）。
- **`media_catalog`（作品/真源）**：去重归并后的「一部作品」。多个 `videos` 可指向同一 catalog。**元数据编辑的真正落点在这一层。**
- **`video_metadata_provenance`（字段级溯源）**：记录 catalog 每个字段「最后一次由谁写入」（manual/douban/bangumi/tmdb/crawler + 外部 ID + 优先级）。→ UI 上「来源证据」「该字段来自 X」的数据基础。
- **`video_metadata_locks`（字段级锁）**：`hard` 锁字段任何自动来源都不能覆盖；`soft` 锁仅标记。→ **这是 UI 上「以下字段因锁定未保存」提示的来源**（编辑抽屉与快编都会回弹被锁字段）。
- **`metadata_field_proposals`（多源候选/冲突）**：同一字段多个源各自提出的候选值 + winner + 冲突标记。→ UI 上「字段冲突 needs_review」的数据基础。
- **`video_external_refs` / `catalog_external_refs`（外部身份关系）**：本作品 = 外部哪条目，`match_status`（auto_matched/manual_confirmed/candidate/rejected）+ `confidence` + `is_primary`。→ 四源图标的 `applied/candidate/problem` 状态由此派生。
- **子表**：`catalog_episodes`（逐集）、`catalog_characters` + `catalog_character_actors`（角色↔声优，anime）、`media_catalog_aliases`（结构化别名：region/script/kind/confidence/是否 locale 首选）。

> 设计含义：一个字段的「值 + 来源 + 是否锁定 + 是否有冲突候选」是**四个独立维度**。当前 UI 把它们分散在不同区域表达，**这是优化的主战场之一**（见 §6）。

---

## 3. 元数据富集流程（为什么会有「待确认 / 冲突 / 缺失」状态）

后端 `MetadataEnrichService` 按步骤跑富集（豆瓣本地 dump → 豆瓣网络 → Bangumi → TMDB → 算「完整度分」），并经 reconcile 逐字段裁决候选/winner/冲突。管理员看到的状态正是这套自动流程 + 人工复核的叠加结果。设计无需理解后端细节，只需理解产物：**每条作品都有一份「元数据状态摘要」**（§4），它是所有展示的唯一输入。

人工动作有两类：
1. **直接编辑字段值**（基础信息 Tab / 快编）→ 写 manual provenance，可被锁保护。
2. **确认/拒绝某个源的匹配候选**（TMDB Tab / Douban 来源关系区）→ 改 external_refs 的 match_status，并可勾选「应用哪些字段」覆盖到 catalog。

---

## 4. 核心数据契约：`MetadataStatusSummary`（设计师必读）

后台**审核详情 / 编辑抽屉 / 视频库列表**三处统一消费这份服务端派生的摘要（源码 `packages/types/src/metadata-status.types.ts`）。UI 只读、不在前端现算核心状态。设计稿里所有「状态语义」都应映射到这份契约的枚举上，避免发明 UI 私有状态。

### 4.1 整体状态 `overall`（运营处理优先级，1 最高）

| 值 | 含义 | 运营优先级 |
|----|------|-----------|
| `needs_review` | 有冲突/需复核 | 1（最高，最该先处理） |
| `candidate` | 有候选待确认 | 2 |
| `missing` | 基本没富集 | 3 |
| `partial` | 部分字段已富集 | 4 |
| `complete` | 已富集 + 主源匹配 | 5 |

### 4.2 单源状态 `provider.state`（每个图标的语义，5 态）

| 值 | 视觉建议（现状） | 含义 |
|----|----------------|------|
| `applied` | 正常彩色图标 | 已应用到作品且外部身份可信 |
| `candidate` | 正常图标 + **黄点** | 已获取候选但未应用，待确认 |
| `problem` | 正常图标 + **红点** | 冲突/被拒重现/低置信/拉取失败/覆盖了人工字段 |
| `missing` | **灰显**图标 | 未获取/未配置凭证/未运行（计入缺失） |
| `not_applicable` | **灰显** + 不适用 | 该源对此类型不适用（如非动画的 Bangumi），**不计缺失惩罚** |

### 4.3 其它关键字段

- `score`（0–100）：UI 称「**完整度**」（不是质量，不表达冲突/候选）。
- `enrichedAt`：最近增强时间（UI 侧格式化，**i18n/时间格式不下沉组件**）。
- `primaryProvider`：主来源（已应用且 isPrimary 的最高优先级源）。
- `issues[]`：问题列表（`level`: none/info/warn/danger；带 `provider` 或跨源；带结构化 `code` + `message`）。
- `nextAction`：运营下一步建议（`run_enrichment` / `confirm_candidate` / `review_conflict` / `improve_fields` / `configure_provider` / `none`）。
  - ⚠ **无死按钮原则**：当前 Phase 1 多数 `nextAction` 在编辑抽屉/详情**没有可执行端点**，因此组件设计为「**无上层接线就不渲染主按钮**」。设计师若想强化「下一步」CTA，需要同步确认后端是否提供执行路径，否则会出现点不动的死按钮。
- `providers`：`Record<四源, 单源明细>`，**派生侧保证四源都有 entry**（缺的归 `missing`，不适用归 `not_applicable`），UI 永远渲染四个图标位。

---

## 5. 四个界面接触点详解（含信息架构现状）

### 5.1 视频库列表（批量扫描）
- 源码：`apps/server-next/src/app/admin/videos/_client/VideoColumns.tsx`、`VideoListClient.tsx`
- 元数据表达：行内一列 `MetadataSourceIconCluster density="table"` —— 紧凑四源图标簇（含灰显占位，保证列宽稳定）。`density="table"` 下**不显示完整度数字**（不挤占）。
- 过滤维度：按「已匹配源」过滤（四源 OR 命中 + `none`）、按「有数据」口径、年代/年份、富集完整度（missing/partial/complete）。
- 入口动作：行操作可深链直达编辑抽屉的指定 Tab（图片 / 元数据 / 线路）。
- **设计现状痛点**：一个图标簇要同时表达「四源 × 5 态 × 黄红点」信息密度高；表格行高有限，tooltip 是主要补充通道。

### 5.2 视频编辑抽屉（单条精修）— 优化主战场
- 源码：`apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx` + `_videoEdit/*`
- 形态：右侧 680px 抽屉（可全屏），顶部有缩略图 + 状态簇头部（`MetadataSourceIconCluster density="header" showScore`），4 个 Tab：

| Tab | 文件 | 内容 |
|-----|------|------|
| 基础信息 | `TabBasicInfo.tsx` | 标题/英文名/原名/原语种/类型/年份/地区/集数/简介/题材/状态/评分/导演/演员/编剧/豆瓣 ID/别名 —— **纯手填表单（manual 源）** |
| 线路管理 | `TabLines.tsx` | 播放线路（非元数据，本次设计可忽略） |
| 图片素材 | `TabImages.tsx` | 封面/背景图等 |
| **元数据** | `TabMetadata.tsx` | **多源治理核心**：见下 |

  「元数据」Tab 的内部结构（四源同级，不孤岛）：
  1. `MetadataStatusPanel variant="drawer"`：整体状态 + 四源图标 + 完整度 + 最近增强 + **四来源卡** + 问题列表。（当前**纯展示无 onAction**，无可执行主按钮）
  2. `MetaSourceEvidence`（来源证据）：只读富视图 —— 真源字段（原名/评分+人数 + 来源标注）、Bangumi 条目块（anime）、角色·声优（anime，cap 8）。
  3. `TabTmdb`（TMDB 来源关系）：媒体类型切换 + 搜索 + 候选列表 + **字段多选勾选** + 确认/拒绝。**这是「选择应用哪些字段覆盖」的富交互范式**。
  4. `TabDouban`（Douban 来源关系）：搜索/确认/diff 的富交互（保留原有，不再占顶级 Tab）。

- **历史演进（设计须知）**：原本豆瓣、外部元数据各占独立顶级 Tab；META-35/ADR-201 起合并为**单一「元数据」Tab，四源同级**。旧深链 `douban`/`external` 已归一到 `metadata`。设计若再调整 IA，需保持「四源同级、不让某一源孤岛化」的原则。

### 5.3 审核详情面板（队列逐条核对）
- 源码：`apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail.tsx`
- 元数据表达：`MetadataStatusPanel variant="detail"`（与抽屉 `drawer` 同组件不同 variant：全展开含四来源卡）。
- 场景差异：审核台节奏快、键盘流为主（有 `KeyboardHelpOverlay`），元数据是「核对辅助信息」，不是主操作对象。

### 5.4 审核台快速编辑（免开抽屉直改）
- 源码：`apps/server-next/src/app/admin/moderation/_client/PendingMetaQuickEdit.tsx`
- 形态：审核行下方内联区，**一次点击/失焦即提交**（乐观更新 + 失败/被锁回滚 + toast）。6 个字段：
  - 类型：单选**芯片**（去下拉，一次点击）
  - 年代：输入框 + 近 6 年快捷芯片
  - 地区：输入框 + 常见区域芯片（中/港/台/日/韩/美/英/泰）
  - 题材：多选 toggle **芯片**
  - 原名 / 别名：输入框（失焦提交）
- **设计原则（已确立）**：「尽量避免点击下拉菜单再选择」→ 高频值用芯片一次点击。被 provenance 锁的字段提交会被 skip 并回滚 + 提示。

---

## 6. 给设计师的优化切入点（建议聚焦方向）

以下是从现状代码归纳的、值得设计介入的问题域（非强制，按价值排序）：

1. **「值 + 来源 + 锁 + 冲突」四维表达统一**：当前一个字段的来源在「来源证据」区、锁在保存后的回弹提示、冲突在「问题列表」、候选在「来源卡」——分散。可探索**字段级的来源/锁/冲突一体化标注**（如字段行尾的来源徽标 + 锁图标 + 冲突角标）。
2. **四源图标簇的密度分级**：`table / header / panel` 三密度同一套语义，table 信息最挤。可设计**渐进披露**（列内极简 → hover/点击展开四源卡）。
3. **冲突复核（needs_review）流**：`overall=needs_review` 是运营最该先处理的状态，但当前缺乏「冲突 diff → 选值 → 应用」的顺滑流程（TMDB/Douban 的字段勾选范式可复用扩展到「冲突解决」）。
4. **`not_applicable` vs `missing` 的视觉区分**：二者现状都「灰显」，但语义相反（一个不该被催、一个该被催）。
5. **「下一步动作」的可执行性对齐**：避免无端点的死按钮；设计 CTA 前与工程确认 `nextAction` 是否有落地路径（Phase 1 多数无）。
6. **快编与抽屉的字段一致性**：快编 6 字段、抽屉基础信息 ~17 字段，两处对「锁定字段」的反馈体验应统一。
7. **IMDb 占位的诚实表达**：第四源长期「未获取」，需要不误导（不暗示「即将有数据」）又保留视觉位的处理。

---

## 7. 设计约束（务必遵守，否则实现会被工程驳回）

- **颜色零硬编码**：必须使用 CSS 变量 token（如 `var(--accent-default)` / `var(--fg-muted)` / `var(--state-warning-bg)`）。Design Token 真源在 `packages/design-tokens`，后台组件库在 `packages/admin-ui`。
- **后台组件唯一真源 = `packages/admin-ui`**：`DataTable`、`Drawer`、`Pill`、`Thumb`、`MetadataStatusPanel`、`MetadataSourceIconCluster` 等都在此。新模式 3 处以上须沉淀到此包，**不得复用已退役的 v1 三件套**（ModernDataTable/PaginationV2/SelectionActionBar，apps/server 已物理删除）。
- **依赖方向单向**：`admin-ui → @resovo/types`，组件不反向 import 业务 app。
- **i18n / 时间格式不下沉组件**：文案与时间由消费方格式化后传入（如 `enrichedAtLabel`）。设计交付应区分「结构」（组件）与「文案」（业务侧）。
- **四源固定顺序**：`豆瓣 / Bangumi / TMDB / IMDb`，永远四个图标位。
- **无死按钮原则**：无可执行路径的操作不渲染按钮。
- **可访问性**：图标簇/芯片已有 `role`/`aria-pressed`/`aria-label`/统一 tooltip，设计应保留并强化键盘流（审核台尤其依赖键盘）。

---

## 8. 文件清单速查（接手定位用）

**前端 UI（后台 server-next）**
```
apps/server-next/src/app/admin/videos/
  page.tsx
  _client/VideoListClient.tsx          视频库列表壳
  _client/VideoColumns.tsx             列定义（含 density="table" 四源簇）
  _client/VideoEditDrawer.tsx          编辑抽屉（4 Tab 编排）
  _client/VideoFilterFields.tsx        过滤器（含元数据维度）
  _client/_videoEdit/TabBasicInfo.tsx  基础信息表单（manual）
  _client/_videoEdit/TabMetadata.tsx   元数据 Tab（四源同级核心）
  _client/_videoEdit/TabTmdb.tsx       TMDB 来源关系（字段勾选范式）
  _client/_videoEdit/TabDouban.tsx     豆瓣来源关系
  _client/_videoEdit/TabImages.tsx     图片素材
  _client/_videoEdit/MetaSourceEvidence.tsx  来源证据只读富视图
  _client/_videoEdit/types.ts          表单 FormState / TabKey 契约

apps/server-next/src/app/admin/moderation/_client/
  PendingMetaQuickEdit.tsx             审核台快编（芯片+输入框）
  RightPane/TabDetail.tsx              审核详情（variant="detail"）
```

**共享组件（admin-ui，唯一真源）**
```
packages/admin-ui/src/components/metadata-status/
  metadata-status-panel.tsx            MetadataStatusPanel（detail/drawer/compact）
  metadata-source-icon-cluster.tsx     四源图标簇（table/header/panel）
  metadata-source-card.tsx             单来源卡
  metadata-status.types.ts             组件公开 Props 契约
packages/admin-ui/src/components/enrichment-badge/
  enrichment-logos.ts                  四源 Logo(data-URI)/短名/外链构造
```

**数据契约 & schema**
```
packages/types/src/metadata-status.types.ts   MetadataStatusSummary 等枚举/DTO（设计师必读）
packages/types/src/video.types.ts             Video/VideoCard 类型
docs/architecture.md  §5.1a media_catalog / §5.6a-5.7 逐集·角色·provenance·locks·proposals
docs/decisions.md     ADR-201（统一元数据状态）/ ADR-205（多源冲突）/ ADR-206 / ADR-207
```

---

## 9. 如何查看（设计师无需后端也能上手）

- **纯阅读**：本报告 + 上述源码文件已足以理解信息架构与状态语义。
- **看真实渲染（可选）**：后台为 Next.js 应用 `apps/server-next`，元数据组件在 admin 路由下；如需起本地后台需要数据库与 API（`apps/api`）配套，建议由工程协助或在已部署的预览环境查看，不必为设计阅读本地起全栈。
- **组件原语预览**：`apps/server-next/src/app/admin/dev/components`、`.../dev/design-tokens` 有组件/令牌预览页，可用于核对色板与原语外观。

---

*报告结束。如需补充某个界面的交互态枚举清单或导出某组件的 Props 表，请向工程侧索取。*
