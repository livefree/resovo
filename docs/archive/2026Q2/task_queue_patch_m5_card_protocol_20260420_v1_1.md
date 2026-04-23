# 任务队列补丁 — M5 卡片协议与列表→播放器直达路径（2026-04-20，v1.1）

> 适用范围：**M5 页面重置 — 前置决策 + 卡片/primitive + 后端/后台 + 页面重塑序列**
> 版本：**v1.1（2026-04-20）** — 基于 v1.0 Claude Code 执行侧预审反馈修订
> 前置补丁：
> - `docs/task_queue_patch_rewrite_track_20260418.md`（apps/web-next 并行路线 + RW-SETUP）
> - `docs/task_queue_patch_m2_followup_20260419.md`（M2 闭幕，已落地 ✅）
> - `docs/task_queue_patch_m3_20260419.md`（M3 详情页 + 播放器接管，已落地 ✅）
> - `docs/task_queue_patch_regression_m1m2m3_20260420.md`（REGRESSION 序列，已落地 ✅）
> - `docs/task_queue_patch_m5_card_protocol_20260420.md`（v1.0，已被本文件 superseded）
> 发布者：主循环（claude-opus-4-7）
> 交付对象：Claude Code 执行会话（共 **15 张卡**，分五阶段 PREP / CARD / API / PAGE / CLOSE；3 张强制 opus 子代理，1 张强制 arch-reviewer code review）
> 紧迫级别：⚠️ **STRUCTURED 级** — 本补丁不触发 BLOCKER，但 M5 序列启动必须以 PREP 阶段（M5-PREP-01/02）PASS 为前置门禁

---

## 0. v1.0 → v1.1 修订摘要

Claude Code 执行侧在 v1.0 预审中指出 6 条遗漏 + 2 条流程观察，**全部接受并纳入 v1.1**：

| # | v1.0 遗漏/观察 | v1.1 处理 |
|---|----------------|-----------|
| 1 | 移动端 Tab Bar 缺失（方案 §14.1） | 新增 **M5-PAGE-TABBAR-01**；ADR-046 新增 §8 Tab Bar ↔ MiniPlayer 叠加协议 |
| 2 | Banner 后端 + 后台缺失（方案 §10.3/§18.1） | 原 `M5-PAGE-BANNER-01` 拆为 **M5-API-BANNER-01** + **M5-ADMIN-BANNER-01** + **M5-PAGE-BANNER-FE-01**（三卡依赖链）|
| 3 | 搜索页独立成卡（方案 §14.2） | 新增 **M5-PAGE-SEARCH-01**，从 GRID 抽出 |
| 4 | SharedElement / RouteStack 实装归属不明 | 新增 **M5-CARD-SHARED-01** + **M5-CARD-ROUTESTACK-01**；primitive 激活归属表写入 M5-PREP-02 |
| 5 | Skeleton 骨架屏系统无归属（方案 §15.3/§15.4） | 新增 **M5-CARD-SKELETON-01**；AI-CHECK 六问强制"每新组件必须导出 Skeleton 变体" |
| 6 | 同层过渡（Sibling）激活无归属 | M5-PREP-02 primitive 激活归属表明确：**M5-PAGE-GRID-01 为 Sibling variant 首激活卡，后续 PAGE 卡继承** |
| 7 | M5-PAGE-DETAIL-01 规模超纲 | SharedElement 真实实装前置为独立 CARD，DETAIL-01 仅消费，规模回落 L |
| 8 | embla-carousel 依赖核查缺明确路径 | M5-PREP-02 新增"依赖核查清单"验收项，grep 仓库确认 |

**卡片总数变化**：v1.0 共 10 张 → v1.1 共 **15 张**（新增 5 张 CARD/PAGE + 1 张 API + 1 张 ADMIN；原 BANNER 拆为 3 张，净增 5 张）。

**ADR 影响**：
- ADR-046 正文范围扩充（新增 §8 Tab Bar 协议、§4.5 Skeleton 契约）
- 不另起 ADR-047（Tab Bar 协议归并入 ADR-046，决策层级更清晰）

**v1.0 归档约定**：v1.0 文件保留不删、不改、不 `git rm`，作为历史版本可追溯本次预审修订链路。

---

## 1. 背景与决策摘要

### 1.1 为什么需要此补丁

方案 `docs/frontend_redesign_plan_20260418.md` §19 对 M5 的定义止于"页面重塑 4-5 张卡片"，但对以下五类关键决策**未下结论**：

1. **列表→播放器直达路径**：REGRESSION 阶段 ADR-042 已锁定"保留 `/watch/[slug]` URL"，但 apps/web-next 的 VideoCard 目前只有"点击卡片进详情页"这一条出口，原 apps/web 的"卡片右上角 ▶ 直达播放"在迁移中丢失。
2. **卡片内容协议**：§19 列出"卡片 primitive"但未定义标签体系、文字区字段、集数显示规则。
3. **多集视频卡视觉**：方案对 series/anime/tvshow 类内容未提出与 movie 不同的视觉差异化。
4. **Tab Bar ↔ MiniPlayer 叠加协议**（v1.1 新增识别）：方案 §14.1 定义了移动端三 Tab 玻璃底栏，但未定义它与 GlobalPlayerHost mini 态（§13）在底部 56px 区域的 z-index / safe-area-inset 协议。两者同时渲染时的视觉与交互规则缺位。
5. **primitive 激活归属**（v1.1 新增识别）：REGRESSION 阶段 SharedElement / RouteStack / PageTransition 均为 noop/stub，M5 阶段需要明确"哪张卡负责激活哪个 primitive"，否则会出现多卡抢占或无人实装的矛盾。

如果带着这五个缺口进入 M5 执行，必将复现 REGRESSION 阶段"方案与执行错位"的偏差模式。

### 1.2 核心决策（本补丁锁定）

**决策 M5-A — 列表→播放器直达路径（路径 B' 定制版）**
分类页/首页/搜索页的 VideoCard 同时提供两条出口：
- 点击图片区（上半） → 直达 `/watch/[slug]?ep=1`
- 点击文字区（下半） → 进入 `/{type}/[slug]` 详情页

桌面端与移动端交互协议一致，桌面端额外增加 hover 动效与悬浮 ▶ 播放按钮。容错区（卡片中轴 8px 间隙）归属文字区。此决策构成 **ADR-046 §2**。

**决策 M5-B — 卡片内容协议（标签 + 元信息）**
- 图片区最多 2 个文字标签（左上角堆叠），维度：生命周期 + 热度/运营
- 规格 ≤ 2 图标（右下），评分 ≤ 1（右上）
- 文字区固定两行：片名 + `年份 · 类型 · 集数(或时长)`
- movie 类型以"时长 102min"占位，保持两行对齐
- 标签新增维度必须走 ADR 变更

此决策构成 **ADR-046 §4**。

**决策 M5-C — 多集卡片静置态方案 A（阴影暗示）**
series/anime/tvshow 类型用伪堆叠阴影暗示"多集"；movie/short/clip 保持单卡。PC hover 时阴影偏移扩展并淡入第二层。此决策构成 **ADR-046 §5**。

**决策 M5-D — M5 内部分阶段门禁**
PREP 未 PASS 前禁启 CARD/API/PAGE；CARD 未 PASS 前禁启 PAGE。CLOSE 必须由 Opus 子代理审计。此决策构成 M5 执行协议，不产生独立 ADR。

**决策 M5-E — Fast Takeover 动效差异化**
列表→播放器：Fast Takeover（移动 200ms / 桌面 240ms），详情页→播放器：Standard Takeover（360ms，不变）。动效规格见 **ADR-046 §3**。

**决策 M5-F — Tab Bar ↔ MiniPlayer 叠加协议（v1.1 新增）**
移动端底部区域 Tab Bar + MiniPlayer 同时渲染时：
- Tab Bar 高度 56px，贴底，z-index 40
- MiniPlayer mini 态叠在 Tab Bar 之上，z-index 50，距底部 `56px + env(safe-area-inset-bottom)`（紧贴 Tab Bar 顶部）
- Tab Bar 切换时 MiniPlayer 保持不卸载（仅随路由变化而可能收起/展开）
- safe-area-inset 由 Tab Bar 自身吸收，MiniPlayer 不重复加 inset
- 两者切换动画互不干扰：Tab Bar tab 切换 180ms 下划线移动，MiniPlayer 自身 FLIP 不触发

此决策构成 **ADR-046 §8**，不另起 ADR-047（决策层级统一）。

**决策 M5-G — primitive 激活归属（v1.1 新增）**
REGRESSION 产出的 noop/stub primitive 在 M5 的激活责任人：

| primitive | REGRESSION 产物 | M5 激活卡 | 说明 |
|-----------|----------------|-----------|------|
| SharedElement | noop | **M5-CARD-SHARED-01** | FLIP 算法 + getSnapshotBeforeUpdate 钩子；DETAIL/PAGE 消费 |
| RouteStack | stub | **M5-CARD-ROUTESTACK-01** | 边缘返回手势 + 栈管理；GRID/SEARCH 消费 |
| PageTransition (Sibling) | noop | **M5-PAGE-GRID-01**（首激活） | 在 GRID 卡开启 Sibling variant，后续 PAGE 卡继承 |
| PageTransition (Takeover) | 待 | **M5-CARD-CTA-01** | Fast Takeover 实装；Standard Takeover 由 DETAIL 消费既有 |

此决策构成 M5-PREP-02 的"primitive 激活归属表"。

**决策 M5-H — Skeleton 系统（v1.1 新增）**
方案 §15.3/§15.4 的 Skeleton 规格在 M5 用统一 primitive 实装：
- `<Skeleton>` 基础 primitive 支持 rect/circle/text 三形态
- 每个 M5 新建组件必须导出 `.Skeleton` 子组件（VideoCard.Skeleton / HeroBanner.Skeleton 等）
- 三档触发门槛：立即（< 300ms）/ 延迟 300ms（300-1000ms）/ 延迟 800ms + 进度条（> 1000ms）
- AI-CHECK 六问强制检查"新组件是否导出 Skeleton"

此决策构成 **ADR-046 §4.5**（附录）。

**决策 M5-I — Banner 全栈三卡拆分（v1.1 新增）**
方案 §10.3 + §18.1 的 Banner 特性拆为三张独立卡，依赖链 **API → ADMIN → FE**：
- `M5-API-BANNER-01`：`home_banners` migration + `GET /api/banners` + zod schema
- `M5-ADMIN-BANNER-01`：后台 CRUD + 拖拽排序 + 时间窗控制
- `M5-PAGE-BANNER-FE-01`：前端轮播 + Ken Burns + 主色染色

此决策确保前端不从 mock 启动，避免契约漂移。

### 1.3 与已有 ADR 的关系

| ADR | 内容 | 本补丁关系 |
|-----|------|-----------|
| ADR-037 | REGRESSION PHASE COMPLETE 门禁 | 前置已完成 |
| ADR-040 | Root layout 四件套 + MainSlot | M5 页面重塑复用 |
| ADR-041 | GlobalPlayerHost 唯一播放器宿主 | Fast Takeover dispatch 目标 |
| ADR-042 | `/watch/[slug]` URL 保留 | 路径 B' 的直达目标 URL |
| ADR-046（新） | 卡片协议 + 直达路径 + Tab Bar 叠加 + Skeleton | **本补丁核心决策** |

---

## 2. 方案 ↔ 执行 对齐表（M5 协议基线 v1.1）

| 方案章节 | 方案要求 | 当前 apps/web-next 现状 | 需补齐 | 补齐卡片 |
|---|---|---|---|---|
| §7.1-§7.4 | Header/Footer + Mega Menu + scroll-collapse | 迁移完成、样式未重塑 | UI 重塑 | M5-PAGE-HEADER-01 |
| §9.1 Sibling | 视频网格交叉淡入 + stagger | PageTransition noop | 激活 Sibling variant | M5-PAGE-GRID-01 |
| §9.3 Standard Takeover | 详情页→播放器 360ms | 概念完整，实装待 | 实装 | M5-PAGE-DETAIL-01 |
| §9.x 新增 | Cross-Skip Takeover 列表→播放 | 无 | 新增 §9.5 章节 + 实装 | M5-PREP-02 + M5-CARD-CTA-01 |
| §10.1-§10.2 | HeroBanner + Ken Burns + 主色染色 | 前端雏形，无后端数据 | FE 重塑 + API + 后台 | M5-API-BANNER-01/ADMIN-BANNER-01/PAGE-BANNER-FE-01 |
| §10.3/§18.1 | home_banners 表 + 后台管理 | 完全缺失 | DB migration + API + Admin UI | M5-API-BANNER-01/ADMIN-BANNER-01 |
| §11.1-§11.4 | TopSlot 接替 300ms | 无 | 实装 | M5-PAGE-GRID-01 |
| §12.1-§12.5 | 详情页五部分级联入场 | 业务迁移完成、样式未重塑 | UI 重塑 + 消费 SharedElement | M5-PAGE-DETAIL-01 |
| §13.1-§13.7 | 播放器 mini/full/pip | REGRESSION 落地、样式未重塑 | UI 重塑 + 影院模式 | M5-PAGE-PLAYER-01 |
| §14.1 | 移动 Tab Bar（三 Tab 玻璃底栏）| **完全缺失** | 新建 + MiniPlayer 叠加协议 | M5-PAGE-TABBAR-01 |
| §14.2 | 搜索页圆形扩散 + 建议 + 空状态 | 业务迁移完成、交互未重塑 | UI 重塑 + 独立动效 | M5-PAGE-SEARCH-01 |
| §15.1 | ScrollRestoration | REGRESSION 落地 | 消费 | M5-PAGE-GRID-01 |
| §15.2 | PrefetchOnHover | REGRESSION 落地 | 消费 | M5-PAGE-GRID-01 |
| §15.3/§15.4 | Skeleton 骨架屏（三档门槛） | **完全缺失** | primitive + 每组件导出 Skeleton | M5-CARD-SKELETON-01 |
| §16 组件清单 | VideoCard / HeroBanner / Grid | VideoCard 单出口；其余雏形 | 拆分为复合组件 + 新 primitive | M5-CARD-CTA-01/TAG-01/STACK-01 |
| REGRESSION noop #1 | SharedElement FLIP | noop | 真实实装（激活） | M5-CARD-SHARED-01 |
| REGRESSION stub #1 | RouteStack 边缘返回 | stub | 真实实装（激活） | M5-CARD-ROUTESTACK-01 |

---

## 3. M5 BLOCKER 通知（追加到 `docs/task-queue.md` 现有 M5 占位区顶部）

```markdown
## ⚠️ M5 前置门禁 — PREP 阶段 PASS 前禁启 CARD/API/PAGE

- **触发时间**：2026-04-20
- **触发原因**：方案 §19 M5 定义缺失卡片协议决策（直达路径 / 标签 / 多集视觉 / Tab Bar 叠加 / primitive 激活归属 / Skeleton / Banner 全栈）
- **封锁范围**：
  - 🚫 禁止启动 M5-CARD-* / M5-API-* / M5-ADMIN-* 序列直到 M5-PREP-01 + M5-PREP-02 ✅
  - 🚫 禁止启动 M5-PAGE-* 序列直到 M5-CARD-* 全部 ✅（PAGE 卡消费 primitive）
  - 🚫 禁止 M5-PAGE-BANNER-FE-01 启动在 M5-API-BANNER-01 + M5-ADMIN-BANNER-01 完成之前
  - ✅ 允许：M5-PREP-01 / M5-PREP-02 / hotfix
- **解除条件**：
  1. M5-PREP-01 ✅（ADR-046 含 §1-§8 全部章节落盘到 docs/decisions.md）
  2. M5-PREP-02 ✅（docs/frontend_redesign_plan_20260418.md §9.5/§14.1/§15.3-§15.4/§16/§19 更新完成 + primitive 激活归属表落盘 + embla-carousel 依赖核查清单完成）
  3. Opus arch-reviewer 独立审计 PASS
- **关联文档**：`docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md`（本补丁）
- **历史版本**：`docs/task_queue_patch_m5_card_protocol_20260420.md`（v1.0，已 superseded）
```

---

## 4. M5 序列总览（v1.1，共 15 张卡）

```
M5: 页面重置
│
├─ 阶段 P · 前置决策（PREP）
│  ├─ M5-PREP-01  ADR-046 撰写（§1-§8 全章节）                    [opus+arch-reviewer]  规模 M
│  └─ M5-PREP-02  方案回写 + primitive 激活归属 + 依赖核查          [haiku 子代理]         规模 S
│
├─ 阶段 C · 卡片 + primitive 激活（6 张）
│  ├─ M5-CARD-CTA-01        VideoCard 双入口 + Fast Takeover       [sonnet]             规模 M
│  ├─ M5-CARD-TAG-01        TagLayer + taxonomy + Token             [sonnet]             规模 M
│  ├─ M5-CARD-STACK-01      StackedPosterFrame + hover 时序         [sonnet]             规模 S
│  ├─ M5-CARD-SHARED-01     SharedElement FLIP 实装                 [sonnet+arch-review] 规模 L
│  ├─ M5-CARD-ROUTESTACK-01 RouteStack 边缘返回手势实装             [sonnet]             规模 M
│  └─ M5-CARD-SKELETON-01   Skeleton primitive + 三档门槛           [sonnet]             规模 M
│
├─ 阶段 A · 后端/后台（Banner 全栈 2 张）
│  ├─ M5-API-BANNER-01      home_banners migration + API            [sonnet]             规模 M
│  └─ M5-ADMIN-BANNER-01    Banner 后台（ModernDataTable + 拖拽）   [sonnet]             规模 M
│
├─ 阶段 G · 页面重塑（6 张）
│  ├─ M5-PAGE-HEADER-01     Header/Footer 重塑                       [sonnet]             规模 M
│  ├─ M5-PAGE-TABBAR-01     移动 Tab Bar + MiniPlayer 叠加协议      [sonnet]             规模 M
│  ├─ M5-PAGE-BANNER-FE-01  HeroBanner 前端（消费 API）              [sonnet]             规模 M
│  ├─ M5-PAGE-GRID-01       分类页 Grid（Sibling 首激活）            [sonnet]             规模 M
│  ├─ M5-PAGE-SEARCH-01     搜索页（圆形扩散 + 建议 + 空状态）       [sonnet]             规模 M
│  ├─ M5-PAGE-DETAIL-01     详情页（消费 SharedElement）             [sonnet]             规模 L
│  └─ M5-PAGE-PLAYER-01     播放页（影院模式 + pip UI）              [sonnet]             规模 L
│
└─ 阶段 Z · M5 收尾
   └─ M5-CLOSE-01  M5 PHASE COMPLETE + Opus 独立审计 + 对齐表       [opus]               规模 S
```

**依赖关系**：
- `P → C/A → G → Z` 严格串行（阶段间）
- P 内部：`M5-PREP-01 → M5-PREP-02`
- C 内部：六张 CARD 可并行，但建议顺序 `CTA → TAG → STACK → SHARED → ROUTESTACK → SKELETON`（CTA 先确立动效，SKELETON 最后统一落 Token）
- A 内部：`M5-API-BANNER-01 → M5-ADMIN-BANNER-01`
- G 内部：`M5-PAGE-BANNER-FE-01` 依赖 A 阶段完成；`M5-PAGE-DETAIL-01` 依赖 `M5-CARD-SHARED-01`；`M5-PAGE-GRID-01` + `M5-PAGE-SEARCH-01` 依赖 `M5-CARD-ROUTESTACK-01`；所有 PAGE 卡依赖 `M5-CARD-SKELETON-01`
- Z 内部：所有前置 ✅

---

## 5. ADR-046 骨架（M5-PREP-01 产出模板，v1.1 扩展）

> **提醒**：以下为 Opus 子代理撰写 ADR-046 时的骨架提示。子代理必须基于 CLAUDE.md「强制升 Opus」第 1/3/4 条情形独立产出，不得直接复制本骨架。最终 ADR-046 须追加到 `docs/decisions.md` 按编号顺序最末。

```markdown
### ADR-046: 列表→播放器直达路径与卡片交互协议（v1.1）

**状态**：Accepted
**日期**：2026-04-20
**关联**：ADR-041（GlobalPlayerHost）/ ADR-042（/watch URL）/ 方案 §9.x / §10 / §13 / §14.1 / §15.3-§15.4 / §16

#### 1. 背景
（见本补丁 §1.1 五条缺口）

#### 2. 交互协议（路径 B' 定制版）
- 图片区点击 → `/watch/[slug]?ep=1`（Fast Takeover）
- 文字区点击 → 详情页
- 8px 中轴间隙 → 归属文字区
- 长按（移动）/ 右键（桌面）→ 上下文菜单

#### 3. 动效规格
- **Fast Takeover**（新增变体，对应方案 §9.5）：移动 200ms / 桌面 240ms
  - 阶段 A（0-60%）：图片层 scale 1.0→1.03 + mask `rgba(0,0,0,0.9)` 淡入
  - 阶段 B（60-100%）：卡片 flip 至播放器 poster + 字幕/控件淡入
- **Standard Takeover**（保持不变）：360ms，详情页→播放器
- **悬浮 ▶ 按钮**（桌面）：44px，hover 进入 120ms / 离开 90ms，背景 `rgba(0,0,0,0.5)` + backdrop-filter

#### 4. 卡片内容协议

##### 4.1 标签上限与位置
图片区 ≤ 2 文字标签（左上堆叠）；规格 ≤ 2 图标（右下）；评分 ≤ 1（右上）

##### 4.2 标签维度
| 维度 | 典型值 | 互斥规则 |
|------|--------|---------|
| 生命周期 | 新片 / 即将上线 / 连载中 / 已完结 / 下架预警 | 五选一 |
| 热度/运营 | 热门 / 本周 Top / 独家 / 编辑推荐 | 最多 1 个 |
| 规格 | 4K / HDR / 杜比 / 中字 / 多语 | 独立计，≤ 2 个 |
| 评分 | 豆瓣 9.1 / IMDb 8.7 | 独立计，≤ 1 个 |

##### 4.3 文字区规则
- Line 1：片名（line-clamp 1，14-15px weight 600）
- Line 2：`{year} · {type} · {episodeInfo}`（12px weight 400 次要色）
  - series/anime/tvshow：`全 24 集` / `更新至 12 集`
  - movie：`102 min`
  - short/clip：省略 episodeInfo

##### 4.4 新增维度变更约束
新增标签维度（限免/付费等）必须走 ADR 变更，不得直接改代码。

##### 4.5 Skeleton 契约（v1.1 新增）
- 所有 M5 新建组件必须导出 `.Skeleton` 子组件
- `<Skeleton>` primitive 支持 rect/circle/text 三形态
- 三档触发门槛：< 300ms 不展示；300-1000ms 展示 Skeleton；> 1000ms 展示 Skeleton + 进度条
- Skeleton 尺寸必须与实际组件"像素级匹配"（避免 layout shift）
- AI-CHECK 六问：M5 任何 PR 中新增组件未导出 Skeleton → FAIL

#### 5. 多集视频卡视觉（StackedPosterFrame）
##### 5.1 触发条件
`video.type ∈ {'series','anime','tvshow'}` 才渲染堆叠视觉

##### 5.2 静置态（方案 A — 阴影暗示）
```css
box-shadow:
  3px -2px 0 0 color-mix(in oklch, var(--surface-2) 60%, transparent),
  6px -4px 0 0 color-mix(in oklch, var(--surface-2) 30%, transparent),
  0 4px 12px rgba(0,0,0,0.08);
```

##### 5.3 PC hover 态时序（200ms）
| 阶段 | 时间 | 动作 |
|------|------|------|
| A | 0-80ms | 主卡 scale 1.0→1.02 + 底阴影加深 |
| B | 80-160ms | 后卡 1 阴影偏移 → 6px/-4px，不透明度 → 0.5 |
| C | 160-200ms | 后卡 2 阴影偏移 → 10px/-6px，不透明度 → 0.25 + 悬浮 ▶ 按钮淡入 |

#### 6. 组件边界
- `<VideoCard>` 复合容器
  - `<VideoCard.PosterAction>` 独立 button，触发 Fast Takeover
  - `<VideoCard.MetaAction>` 独立 button，跳详情
- `<TagLayer>` primitive
- `<StackedPosterFrame>` primitive
- `<Skeleton>` primitive（v1.1 新增）

#### 7. 验收清单
- [ ] a11y：两个 button 独立 aria-label
- [ ] a11y：堆叠阴影 aria-hidden
- [ ] reduced motion：Fast Takeover 降级 opacity 120ms；堆叠 hover 仅改阴影
- [ ] 暗色模式：所有 Token 化
- [ ] 容器查询：桌面/移动判定用容器宽度
- [ ] 键盘 Tab：PosterAction → MetaAction
- [ ] Skeleton：每新组件均导出 .Skeleton，且像素级匹配

#### 8. Tab Bar ↔ MiniPlayer 叠加协议（v1.1 新增）

##### 8.1 布局
- Tab Bar：z-index 40，底部 56px 高，贴底
- MiniPlayer mini 态：z-index 50，距底 `56px + env(safe-area-inset-bottom)`
- safe-area-inset 由 Tab Bar 吸收，MiniPlayer 不重复加

##### 8.2 交互互不干扰
- Tab 切换 180ms 下划线移动，不触发 MiniPlayer FLIP
- MiniPlayer full ↔ mini 切换时，Tab Bar 保持可见（除非 full 态遮盖全屏）
- 路由切换时 Tab Bar active 态随路由变更；MiniPlayer 不卸载

##### 8.3 z-index 层级表（M5 全站）
```
GlobalPlayerHost full 态 (影院模式):  70
GlobalPlayerHost full 态 (常规):      60
GlobalPlayerHost mini 态:             50
Mobile Tab Bar:                        40
Modal / 上下文菜单:                   30
Header scroll-collapsed:              20
MegaMenu:                             15
默认内容:                              0
```

##### 8.4 Safe Area 协议
- Tab Bar `padding-bottom: env(safe-area-inset-bottom)`
- 分类页 / 搜索页 / 详情页底部内容 `padding-bottom: calc(56px + env(safe-area-inset-bottom))`（避让 Tab Bar）
- MiniPlayer 仅加 `bottom: calc(56px + env(safe-area-inset-bottom))`，**不重复加** inset

##### 8.5 反例（禁止）
- ❌ MiniPlayer 代码里写死 `bottom: 72px`（硬编码高度）
- ❌ Tab Bar 与 MiniPlayer 都声明 `env(safe-area-inset-bottom)` → 重复叠加
- ❌ 路由切换时先卸载 MiniPlayer 再重挂 → 破坏 FLIP 与断点续播
```

---

## 6. 方案文档回写补丁（M5-PREP-02 产出，v1.1 扩展）

### 6.1 `docs/frontend_redesign_plan_20260418.md` §9.5 新增章节
（与 v1.0 一致，见前置补丁 §6.1）

### 6.2 §14.1 Tab Bar 章节补充（v1.1 新增）
在 §14.1 既有内容末尾追加：

```markdown
#### 14.1.1 与 MiniPlayer 叠加协议

详见 ADR-046 §8。关键约束：
- Tab Bar z-index 40；MiniPlayer mini 态 z-index 50
- MiniPlayer bottom 值为 `calc(56px + env(safe-area-inset-bottom))`
- safe-area-inset 仅由 Tab Bar 吸收一次
- Tab 切换 180ms 下划线动效不触发 MiniPlayer FLIP
- 全站 z-index 层级表见 ADR-046 §8.3
```

### 6.3 §15.3 / §15.4 Skeleton 章节补充（v1.1 新增）
在 §15.3 既有内容末尾追加：

```markdown
#### 15.3.1 Skeleton primitive 契约

详见 ADR-046 §4.5。
- `<Skeleton>` primitive：rect / circle / text 三形态
- 每个 M5 新建组件（VideoCard / HeroBanner / Header 等）必须导出 `.Skeleton` 子组件
- 三档触发门槛：< 300ms 不展示；300-1000ms Skeleton；> 1000ms Skeleton + 进度条
- 尺寸与实际组件"像素级匹配"，防止 layout shift
```

### 6.4 §16 组件清单增补
（与 v1.0 一致，见前置补丁 §6.2；v1.1 追加 Skeleton primitive 条目）

```markdown
#### 16.w Skeleton（primitive，v1.1 新增）

**Props**：`shape: 'rect' | 'circle' | 'text'` / `width / height` / `delay?: 300 | 800`

**渲染**：浅色模式 `oklch(96% 0.005 250)` 与 `oklch(92% 0.005 250)` 之间 1.5s 无限 shimmer；暗色模式对称 Token。

**消费**：每个 M5 组件导出 `.Skeleton`，按组件真实尺寸内部组合多个 `<Skeleton>` 原子。

详见 ADR-046 §4.5。
```

### 6.5 §19 M5 章节整体重写（v1.1）
位置：整节替换。

```markdown
## 19. M5: 页面重置（v1.1）

**目标**：在 REGRESSION 能力层、primitive 层、播放器 root 化已落地的基础上，重塑全站核心页面 + 补齐移动端 Tab Bar + 落地 Banner 全栈 + 激活 primitive。

**前置**：REGRESSION 序列 ✅（ADR-037 PASS）

**阶段**：

### 19.1 阶段 P（PREP）前置决策
- M5-PREP-01：ADR-046 §1-§8 撰写
- M5-PREP-02：方案回写 + primitive 激活归属表 + 依赖核查

### 19.2 阶段 C（CARD）卡片 + primitive 激活
- M5-CARD-CTA-01：VideoCard 双入口 + Fast Takeover
- M5-CARD-TAG-01：TagLayer + taxonomy + Token
- M5-CARD-STACK-01：StackedPosterFrame + hover 时序
- M5-CARD-SHARED-01：SharedElement FLIP 实装
- M5-CARD-ROUTESTACK-01：RouteStack 边缘返回手势实装
- M5-CARD-SKELETON-01：Skeleton primitive + 三档门槛

### 19.3 阶段 A（API）后端/后台
- M5-API-BANNER-01：home_banners migration + API
- M5-ADMIN-BANNER-01：Banner 后台管理

### 19.4 阶段 G（PAGE）页面重塑
- M5-PAGE-HEADER-01：Header/Footer
- M5-PAGE-TABBAR-01：移动 Tab Bar + MiniPlayer 叠加
- M5-PAGE-BANNER-FE-01：HeroBanner 前端
- M5-PAGE-GRID-01：分类页 Grid（Sibling 首激活）
- M5-PAGE-SEARCH-01：搜索页
- M5-PAGE-DETAIL-01：详情页（消费 SharedElement）
- M5-PAGE-PLAYER-01：播放页（影院模式 + pip UI）

### 19.5 阶段 Z（CLOSE）收尾
- M5-CLOSE-01：PHASE COMPLETE + Opus 独立审计

**详见**：`docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md`
```

---

## 7. 任务卡详细定义

### 7.1 M5-PREP-01 — ADR-046 撰写（§1-§8 全章节）

- **所属 SEQ**：SEQ-20260420-M5-PREP
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理（强制）
- **规模估计**：M（~140 分钟，v1.1 比 v1.0 多 20 分钟覆盖 §8）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — ADR-046 全文独立产出
- **目标**：把本补丁 §1.2 决策 M5-A/B/C/E/F/G/H 整合为正式 ADR-046（§1-§8 全章节），追加到 `docs/decisions.md`。
- **前置**：无
- **文件范围**：
  - 修改 `docs/decisions.md`：文末追加 ADR-046（按本补丁 §5 骨架展开为完整 ADR）
  - 可选：新增 `docs/adr-046-card-protocol-appendix.md`（如 ADR 正文过长）
- **验收**：
  - ADR-046 包含完整 §1 背景 / §2 交互协议 / §3 动效 / §4 卡片内容（含 §4.5 Skeleton）/ §5 多集视觉 / §6 组件边界 / §7 验收清单 / **§8 Tab Bar ↔ MiniPlayer 叠加协议（v1.1 关键新增）**
  - §8 包含 §8.1-§8.5 五小节（布局 / 交互 / z-index 表 / safe-area / 反例）
  - 引用 ADR-041 / ADR-042 / 方案 §9/§12/§13/§14.1/§15.3-§15.4/§16 的具体章节号
  - 明确列出 Fast Takeover 与 Standard Takeover 的 reduced motion 降级路径
  - 明确列出暗色模式适配规则
  - arch-reviewer 子代理独立校对后标为 Accepted
- **质量门禁**：六问自检 + [AI-CHECK] 结论块
- **注意事项**：
  - ADR 正文不得直接复制本补丁 §5 骨架，须由子代理根据本补丁背景独立撰写
  - ADR-046 是 M5 整个序列的决策锚点；任何 CARD/API/PAGE 发现与 ADR-046 冲突 → 报 BLOCKER，回 PREP 修 ADR
  - §8 z-index 层级表须明确所有现存层级（不仅是 Tab Bar 和 MiniPlayer），**一次性完成全站 z-index 治理**
  - 记录主循环模型 ID + 子代理模型 ID 到 tasks.md 卡片"执行模型""子代理调用"字段

### 7.2 M5-PREP-02 — 方案回写 + primitive 激活归属 + 依赖核查

- **所属 SEQ**：SEQ-20260420-M5-PREP
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-haiku-4-5-20251001（Haiku 子代理）
- **规模估计**：S（~60 分钟，v1.1 比 v1.0 多 15 分钟覆盖 §14.1/§15.3 补丁 + 依赖核查）
- **子代理调用**：Haiku 子代理（机械回写 + 依赖 grep，主循环只验证）
- **目标**：把 ADR-046 决策回写到方案文档，同时产出 primitive 激活归属表 + embla-carousel 依赖核查结果。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 修改 `docs/frontend_redesign_plan_20260418.md`：
    - §9.5 新增 Cross-Skip Takeover 章节
    - **§14.1 追加 §14.1.1 Tab Bar ↔ MiniPlayer 叠加协议提示（v1.1 新增）**
    - **§15.3 追加 §15.3.1 Skeleton primitive 契约提示（v1.1 新增）**
    - §16 组件清单补充 VideoCard / TagLayer / StackedPosterFrame / **Skeleton（v1.1 新增）** 四条
    - §19 M5 章节整体重写为 PREP/CARD/API/PAGE/CLOSE 五阶段
  - 新增 `docs/m5_primitive_activation_20260420.md`（primitive 激活归属表，v1.1 新增）：
    - 表格列：primitive 名称 / REGRESSION 产物（noop/stub）/ M5 激活卡 ID / 消费卡 ID 列表 / 验收门槛
    - 必须包含：SharedElement / RouteStack / PageTransition(Sibling) / PageTransition(Takeover) / Skeleton
  - 新增 `docs/m5_dependency_audit_20260420.md`（依赖核查清单，v1.1 新增）：
    - embla-carousel 是否已在仓库存在：grep `"embla-carousel"` 在 `apps/**/package.json` + `packages/**/package.json`
    - 核查结果二选一：
      - ✅ **已存在**（罗列已使用位置 + 版本号）→ M5-PAGE-BANNER-FE-01 可直接 import
      - ❌ **不存在** → 报 BLOCKER，不得自行 `npm install`；等待人工决定
    - 同步核查：react-spring / framer-motion / react-use-gesture 等 M5 PAGE 卡可能引入的动效库
- **验收**：
  - `docs/frontend_redesign_plan_20260418.md` diff 与本补丁 §6 四段内容一致
  - primitive 激活归属表包含至少 5 项 primitive 的归属
  - 依赖核查清单结果明确（每项二选一标注）
  - 引用 ADR-046 的具体节次（§2/§3/§4/§4.5/§5/§6/§8）
  - 如依赖核查发现任何 ❌ → 直接报 BLOCKER，暂停 CARD/API/PAGE 启动
  - Markdown 渲染无错误
- **质量门禁**：六问自检（侧重"是否偏离 ADR-046 结论""依赖核查是否漏项"）+ [AI-CHECK]
- **注意事项**：
  - Haiku 子代理仅做机械回写 + grep，**不得对 ADR-046 结论二次解读**
  - 若方案旧章节与 ADR-046 相悖（如 §9.3 表述与 ADR-046 §3 冲突），写进任务备注，主循环决定是否追加 M5-PREP-03 修正
  - 依赖核查如发现需新增 embla-carousel → 不走本卡，由主循环另报 BLOCKER（CLAUDE.md 绝对禁止第 2 条）

### 7.3 M5-CARD-CTA-01 — VideoCard 双入口 + Fast Takeover

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~150 分钟）
- **子代理调用**：无
- **目标**：VideoCard 拆分为 PosterAction + MetaAction 双入口；接入 Fast Takeover。
- **前置**：M5-PREP-01 ✅ + M5-PREP-02 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`：拆为 `<article>` + 两个独立 button/Link
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/playerStore.ts`：`enter()` 接受 `transition: 'fast-takeover' | 'standard-takeover'`
  - 新增 `apps/web-next/src/components/video/FloatingPlayButton.tsx`
  - 新增 `apps/web-next/src/components/player/transitions/FastTakeover.ts`
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`：识别 transition 参数
  - 新增 `tests/unit/web-next/VideoCard.test.tsx`
  - 新增 `tests/e2e-next/card-to-watch.spec.ts`
- **验收**：见 v1.0 §7.3 验收清单（保持不变）+ 新增 "VideoCard.Skeleton 导出且像素匹配"（M5-H 契约）
- **注意事项**：
  - 不得使用 `any`
  - Fast Takeover 不得硬编码颜色
  - 不得修改 `/watch` URL
  - VideoCard.Skeleton 暂用 `<Skeleton>` placeholder（M5-CARD-SKELETON-01 合入后替换为真实实现）

### 7.4 M5-CARD-TAG-01 — TagLayer + taxonomy + Token

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~90 分钟）
- **目标**：TagLayer primitive + 12 个 tag Token alias + 后端字段映射。
- **前置**：M5-PREP-01 ✅
- **文件范围**：见 v1.0 §7.4（保持不变）
- **验收**：见 v1.0 §7.4（保持不变）

### 7.5 M5-CARD-STACK-01 — StackedPosterFrame + hover 时序

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **建议模型**：claude-sonnet-4-6
- **规模估计**：S（~60 分钟）
- **目标**：StackedPosterFrame primitive + 12 个 stack Token alias。
- **前置**：M5-PREP-01 ✅
- **文件范围**：见 v1.0 §7.5（保持不变）
- **验收**：见 v1.0 §7.5（保持不变）

### 7.6 M5-CARD-SHARED-01 — SharedElement FLIP 实装（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-sonnet-4-6（主循环）+ **arch-reviewer opus 子代理做 code review**
- **规模估计**：L（~180 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — FLIP 算法 code review（CLAUDE.md 强制升 #6 情形：高风险 PR 独立 code review）
- **目标**：把 REGRESSION 阶段 noop 的 SharedElement primitive 替换为真实的 FLIP 实装，支持详情页 hero 图 → 播放器 poster 的跨路由元素复用。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/shared/primitives/SharedElement.tsx`：替换 noop 实现
    - 新增 `<SharedElement.Source id>` 与 `<SharedElement.Target id>` 双 API
    - 实现 `useFLIP()` hook：getSnapshotBeforeUpdate 钩子 + requestAnimationFrame FLIP 动画
    - 跨路由协调：SharedElementRegistry（全局 Map，路由切换时匹配 source/target）
  - 新增 `apps/web-next/src/components/shared/primitives/SharedElementRegistry.tsx`
  - 新增 `apps/web-next/src/hooks/useFLIP.ts`
  - 新增 `tests/unit/web-next/SharedElement.test.tsx`
  - 新增 `tests/e2e-next/shared-element.spec.ts`（至少 3 条路径：详情页 → 播放器 / 列表 → 详情 / reduced motion 降级）
- **验收**：
  - SharedElement 在详情页 Hero → 播放器 poster 过渡中，源元素位置到目标元素位置平滑 FLIP
  - reduced motion 下降级为 opacity 120ms
  - 无 memory leak（SharedElementRegistry 路由切换后清理）
  - arch-reviewer 子代理对 FLIP 算法 code review 标 PASS
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅
- **注意事项**：
  - FLIP 算法复杂度高，**必须**走 arch-reviewer code review；不得跳过
  - DETAIL-01 消费此 primitive，若本卡出现 regression，DETAIL-01 直接 BLOCKER
  - 性能要求：过渡帧率 ≥ 55fps（Chrome DevTools performance 面板验证）

### 7.7 M5-CARD-ROUTESTACK-01 — RouteStack 边缘返回手势实装（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无
- **目标**：把 REGRESSION stub 的 RouteStack primitive 替换为真实实装，支持移动端从屏幕左边缘滑动返回上一页。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/shared/primitives/RouteStack.tsx`：替换 stub
    - 监听 touchstart/touchmove/touchend（仅移动端 `@media (hover: none)`）
    - 边缘触发区：左边 20px
    - 触发阈值：水平位移 > 屏宽 30% 或速度 > 0.5px/ms
    - 触发后调用 `router.back()` + 反向动画
  - 新增 `apps/web-next/src/hooks/useEdgeSwipeBack.ts`
  - 新增 `tests/unit/web-next/RouteStack.test.tsx`
  - 新增 `tests/e2e-next/edge-swipe-back.spec.ts`（Playwright mobile emulation）
- **验收**：
  - 移动端详情页 / 搜索页 / 分类页从左边缘右滑 > 阈值 → 返回
  - 桌面端（hover: hover）不触发手势监听
  - 反向动画 240ms + Push 过渡匹配
  - reduced motion 下瞬移返回（无动画）
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅（mobile）
- **注意事项**：
  - 边缘区域 20px 与浏览器原生手势可能冲突（iOS Safari 左侧滑返回）；必须在 iOS Safari 上真机测试
  - 与 GlobalPlayerHost full 态不兼容：full 态时应禁用边缘手势

### 7.8 M5-CARD-SKELETON-01 — Skeleton primitive + 三档门槛（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~100 分钟）
- **子代理调用**：无
- **目标**：实装 `<Skeleton>` primitive，并为既有 M5 组件（CTA/TAG/STACK 产出）补齐 .Skeleton 变体。
- **前置**：M5-PREP-01 ✅ + M5-CARD-CTA-01 ✅ + M5-CARD-TAG-01 ✅ + M5-CARD-STACK-01 ✅（因需要为这些组件补 Skeleton）
- **文件范围**：
  - 新增 `apps/web-next/src/components/primitives/feedback/Skeleton.tsx`：
    - Props：`shape: 'rect' | 'circle' | 'text'` / `width` / `height` / `delay?: 300 | 800`
    - 实现 1.5s 无限 shimmer（CSS animation）
  - 修改 `packages/design-tokens/src/semantic/skeleton.json`（或等价路径）：
    - `--skeleton-bg-base`（oklch(96% 0.005 250)）
    - `--skeleton-bg-highlight`（oklch(92% 0.005 250)）
    - `--skeleton-bg-base-dark` / `--skeleton-bg-highlight-dark`
    - `--skeleton-shimmer-duration`（1.5s）
    - `--skeleton-delay-tier-1`（300ms）
    - `--skeleton-delay-tier-2`（800ms）
  - 新增 useSkeletonDelay hook：`useSkeletonDelay(loading: boolean, delayMs: 300 | 800 | null): boolean`
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`：导出 `VideoCard.Skeleton`（像素匹配）
  - 新增 `apps/web-next/src/components/primitives/feedback/ProgressBar.tsx`（> 1000ms 场景用）
  - 新增 `tests/unit/web-next/Skeleton.test.tsx`
- **验收**：
  - `<Skeleton shape="rect" />` 渲染占位块，1.5s shimmer 动画
  - `useSkeletonDelay(true, 300)` 在 < 300ms 内返回 false，> 300ms 返回 true
  - VideoCard.Skeleton 与 VideoCard 实际渲染尺寸像素级一致（DevTools 叠加比对）
  - 暗色模式 Token 切换无闪烁
  - typecheck ✅ / lint ✅ / unit ✅
- **注意事项**：
  - **后续所有 M5-PAGE-* 卡完成时，AI-CHECK 六问强制检查"新组件是否导出 Skeleton"**
  - 像素匹配通过 Storybook 或 DevTools 叠加校验，避免仅凭"视觉接近"通过

### 7.9 M5-API-BANNER-01 — home_banners migration + API（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-API
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无（但新增 schema 跨 3+ 消费方应升 Opus，本卡消费方仅 admin + FE 两方，豁免）
- **目标**：新建 home_banners 表 + `GET /api/banners` 公开接口 + 后台 CRUD 接口。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 新增 migration `apps/api/migrations/XXXX_create_home_banners.sql`：
    - 字段：id / title(jsonb多语言) / image_url / link_type('video'|'external') / link_target / sort_order / active_from / active_to / is_active / created_at / updated_at
    - 索引：`(is_active, active_from, active_to, sort_order)` 用于 FE 查询
  - 修改 `docs/architecture.md`：追加 home_banners schema 说明（CLAUDE.md 绝对禁止第 1 条约束）
  - 新增 `apps/api/src/db/queries/home-banners.ts`
  - 新增 `apps/api/src/services/banners.ts`
  - 新增 `apps/api/src/routes/banners.ts`：
    - `GET /api/banners?locale=zh-CN`（公开，返回当前时间窗内且 is_active=true 的 banner）
    - `POST/PUT/DELETE /api/admin/banners`（admin 权限）
  - 新增 zod schema 于 `packages/types` 或 `apps/api/src/schemas/banner.ts`
  - 新增 `tests/unit/api/banners.test.ts`
  - 新增 `tests/integration/api/banners.spec.ts`
- **验收**：
  - `GET /api/banners` 返回时间窗内 banner 列表，按 sort_order 升序
  - `POST /api/admin/banners` 权限校验（requireRole admin）
  - zod schema 覆盖所有字段（尤其 title 多语言 jsonb）
  - migration up/down 均测通
  - typecheck ✅ / lint ✅ / unit ✅ / integration ✅
- **注意事项**：
  - schema 变更**必须**同步 `docs/architecture.md`（CLAUDE.md 绝对禁止第 1 条）
  - 不得在未登录请求路径访问 users 表（CLAUDE.md 绝对禁止第 13 条）
  - 分层纪律：Route → Service → DB queries，Route 不含业务逻辑

### 7.10 M5-ADMIN-BANNER-01 — Banner 后台管理（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-API
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~150 分钟）
- **子代理调用**：无
- **目标**：Banner 后台 CRUD + 拖拽排序 + 时间窗选择器 + 图片上传。
- **前置**：M5-API-BANNER-01 ✅
- **文件范围**：
  - 新增 `apps/server/src/app/admin/banners/page.tsx`（列表页）
  - 新增 `apps/server/src/app/admin/banners/[id]/page.tsx`（编辑页）
  - 新增 `apps/server/src/components/admin/banners/BannerForm.tsx`
  - 新增 `apps/server/src/components/admin/banners/BannerDragSort.tsx`（react-dnd 或既有拖拽库）
  - 使用 ModernDataTable + ColumnSettingsPanel + AdminDropdown + SelectionActionBar + PaginationV2（admin-module-template）
  - 新增 `tests/unit/server/admin-banners.test.tsx`
  - 新增 `tests/e2e/admin/banners.spec.ts`
- **验收**：
  - 列表页：显示缩略图 / 标题 / 时间窗 / 状态；服务端排序；拖拽排序写回 sort_order
  - 编辑页：图片上传（复用既有上传逻辑）、多语言 title 表单、时间窗 picker（active_from/active_to）、active toggle
  - 所有交互符合 `docs/rules/admin-module-template.md`
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅
- **注意事项**：
  - 严禁自创 admin 组件模式，必须复用模板组件
  - 拖拽排序需考虑大量 banner（> 50）的性能；建议分页后排序仅在当前页内

### 7.11 M5-PAGE-HEADER-01 — Header/Footer 重塑

- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **目标**：按方案 §7 重塑 Header/Footer + MegaMenu + scroll-collapse + Header.Skeleton。
- **前置**：M5-CARD-* ✅
- **文件范围**：见 v1.0 §7.6（保持不变）+ 新增 `Header.Skeleton` / `Footer.Skeleton` 导出
- **验收**：见 v1.0 §7.6 + AI-CHECK 检查 Skeleton 导出

### 7.12 M5-PAGE-TABBAR-01 — 移动 Tab Bar + MiniPlayer 叠加协议（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无（协议由 ADR-046 §8 锁定）
- **目标**：按方案 §14.1 + ADR-046 §8 实装移动端三 Tab 玻璃底栏（首页/分类/搜索），并与 MiniPlayer 建立叠加协议。
- **前置**：M5-CARD-* ✅
- **文件范围**：
  - 新增 `apps/web-next/src/components/layout/MobileTabBar.tsx`：
    - 三 Tab：首页 / 分类 / 搜索
    - 玻璃底栏样式（backdrop-filter blur + semi-transparent bg）
    - 180ms 下划线随路由切换
    - safe-area-inset-bottom 吸收
    - z-index 40
  - 修改 `apps/web-next/src/app/[locale]/layout.tsx`：仅在 `@media (hover: none)` 下挂载 MobileTabBar
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/MiniPlayer.tsx`：
    - bottom 值改为 `calc(56px + env(safe-area-inset-bottom))`（移动端）/ 桌面保持原值
    - z-index 50
    - 移除任何可能重复叠加 safe-area-inset 的逻辑
  - 新增 MobileTabBar.Skeleton
  - 新增 `tests/unit/web-next/MobileTabBar.test.tsx`
  - 新增 `tests/e2e-next/mobile-tabbar.spec.ts`
- **验收**：
  - 移动端（Playwright mobile emulation）Tab Bar 贴底，切换流畅
  - Tab Bar + MiniPlayer 同时渲染时不重叠，MiniPlayer 紧贴 Tab Bar 顶部
  - iOS 全面屏机型 safe-area 正确（底部无白条）
  - 桌面端不渲染 Tab Bar
  - full 态影院模式覆盖 Tab Bar（z-index 70 > 40）
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅
- **注意事项**：
  - z-index 必须走 ADR-046 §8.3 层级表定义的 Token（如 `--z-tabbar` / `--z-mini-player`）
  - 不得硬编码 56px 高度，走 Token `--tabbar-height`
  - 与 GlobalPlayerHost mini 态的交互在 e2e 测试中必须覆盖

### 7.13 M5-PAGE-BANNER-FE-01 — HeroBanner 前端（v1.1 重命名）

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **目标**：按方案 §10.1/§10.2 重塑 HeroBanner 前端，消费 `GET /api/banners`。
- **前置**：M5-API-BANNER-01 ✅ + M5-ADMIN-BANNER-01 ✅ + M5-CARD-* ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/video/HeroBanner.tsx`：消费 `GET /api/banners`（非 mock）
  - 新增 `apps/web-next/src/components/video/KenBurnsLayer.tsx`
  - 新增 `apps/web-next/src/components/video/BannerCarouselMobile.tsx`（移动端 5:6 比例 + swipe）
  - 保留既有双 CTA 结构（立即观看 + 详情信息）
  - 新增 HeroBanner.Skeleton
- **验收**：
  - 首页访问时 HeroBanner 从真实 API 拉数据
  - PC 端 `min(520px, 60vh)` + Ken Burns 6s
  - 移动端 5:6 + swipe
  - 切换 slide 时主色染色 1s 过渡
  - 仅本卡使用 embla-carousel（M5-PREP-02 依赖核查已确认 ✅）
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅
- **注意事项**：
  - 如 M5-PREP-02 依赖核查为 ❌（embla-carousel 不存在）→ 本卡直接 BLOCKER，不得自行 install

### 7.14 M5-PAGE-GRID-01 — 分类页 Grid（Sibling 首激活）

- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~130 分钟，v1.1 比 v1.0 多 10 分钟覆盖 Sibling 激活）
- **目标**：按方案 §11/§15 重塑分类页 Grid + **首次激活 PageTransition Sibling variant（决策 M5-G）** + 消费 RouteStack 边缘手势 + ScrollRestoration。
- **前置**：M5-CARD-* ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/[type]/page.tsx`
  - 新增 `apps/web-next/src/components/video/VideoGrid.tsx`
  - **修改 `apps/web-next/src/components/shared/primitives/PageTransition.tsx`：激活 Sibling variant（交叉淡入 + stagger fade）**
  - VideoGrid.Skeleton 基于 VideoCard.Skeleton 循环渲染
- **验收**：
  - 分类页类型切换（variety ↔ movie ↔ series）触发 Sibling 过渡，交叉淡入 300ms + stagger 40ms
  - 移动端左边缘右滑 → 返回（消费 M5-CARD-ROUTESTACK-01）
  - 返回列表时 ScrollRestoration 定位精确
  - VideoGrid.Skeleton 网格像素级匹配
  - typecheck ✅ / lint ✅ / unit ✅ / e2e（SEARCH/分类页）✅

### 7.15 M5-PAGE-SEARCH-01 — 搜索页（v1.1 新增）

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~150 分钟）
- **目标**：按方案 §14.2 重塑搜索页（桌面端圆形扩散进入 250ms + 搜索建议 debounce 120ms + 空状态 UI）。
- **前置**：M5-CARD-* ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/search/page.tsx`
  - 新增 `apps/web-next/src/components/search/SearchCircularReveal.tsx`（桌面端圆形扩散）
  - 新增 `apps/web-next/src/components/search/SearchSuggestions.tsx`（debounce 120ms）
  - 新增 `apps/web-next/src/components/search/SearchEmptyState.tsx`
  - 消费 `<VideoGrid>`（来自 GRID-01 产出）
  - 消费 RouteStack 边缘返回
  - 新增 SearchResults.Skeleton
  - 新增 `tests/e2e-next/search-page.spec.ts`
- **验收**：
  - 桌面端从 Header 搜索图标触发 → 圆形扩散 250ms 进入全屏搜索
  - 输入框 debounce 120ms 调 `/api/search/suggest`
  - 空结果显示空状态 UI + 推荐内容
  - 移动端从左边缘右滑 → 返回（消费 RouteStack）
  - reduced motion 下圆形扩散降级为 opacity 150ms
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅
- **注意事项**：
  - 搜索建议接口如不存在，先创建 mock endpoint（但不得在 FE 写死数据）
  - 圆形扩散的 `clip-path` 动画兼容性：Safari 14+ 支持，旧版本降级

### 7.16 M5-PAGE-DETAIL-01 — 详情页（消费 SharedElement）

- **建议模型**：claude-sonnet-4-6
- **规模估计**：L（~240 分钟，v1.1 不变，因 SharedElement 实装已前置）
- **目标**：按方案 §12 重塑详情页五部分 + 消费 M5-CARD-SHARED-01 产出的 SharedElement。
- **前置**：M5-CARD-* ✅（尤其 M5-CARD-SHARED-01）
- **文件范围**：见 v1.0 §7.9（基本保持）+ **消费 `<SharedElement.Source id="hero-{videoId}">` 包裹详情页 Hero 图；播放器 poster 侧包裹 `<SharedElement.Target id="hero-{videoId}">`**
- **验收**：见 v1.0 §7.9 + "SharedElement FLIP 过渡帧率 ≥ 55fps"

### 7.17 M5-PAGE-PLAYER-01 — 播放页重塑

- **建议模型**：claude-sonnet-4-6
- **规模估计**：L（~240 分钟）
- **目标**：按方案 §13 重塑播放页（mini/full/pip UI + 影院模式）。
- **前置**：M5-CARD-* ✅
- **文件范围**：见 v1.0 §7.10（保持不变）+ 确认 z-index 符合 ADR-046 §8.3

### 7.18 M5-CLOSE-01 — M5 PHASE COMPLETE + Opus 审计

- **所属 SEQ**：SEQ-20260420-M5-CLOSE
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理（强制）
- **规模估计**：S（~90 分钟，v1.1 比 v1.0 多 30 分钟覆盖 15 张卡审计）
- **目标**：对 M5 全部 15 张卡做对齐审计，输出对齐表 + 签字。
- **前置**：M5-PREP-*/CARD-*/API-*/PAGE-* 全部 ✅
- **文件范围**：
  - 新增 `docs/milestone_alignment_m5_20260420.md`：至少 25 项对齐表 + 15 项红旗检查
  - 修改 `docs/decisions.md`：追加 ADR-047 或 ADR-037 迭代条目
  - 修改 `docs/changelog.md`：M5 PHASE COMPLETE
  - 修改 `docs/task-queue.md`：M5 序列全部 ✅
- **验收**：
  - 对齐表每项 ✅ 或 ⚠️
  - 红旗 15 项（见本补丁 §9）全部 PASS
  - Opus 子代理独立审计 PASS
  - typecheck ✅ / lint ✅ / unit ✅ / e2e 全通
- **注意事项**：
  - 未 Opus 审计 PASS 不得标 ✅（CLAUDE.md 绝对禁止第 16 条）

---

## 8. Token 扩展清单（v1.1 汇总）

v1.0 合计 31 个 alias，v1.1 新增：

**skeleton 相关（7 项，M5-CARD-SKELETON-01）**：
```
--skeleton-bg-base / -dark
--skeleton-bg-highlight / -dark
--skeleton-shimmer-duration
--skeleton-delay-tier-1
--skeleton-delay-tier-2
```

**z-index 层级（8 项，M5-PREP-01 产出 ADR-046 §8.3）**：
```
--z-cinema-mode (70)
--z-player-full (60)
--z-mini-player (50)
--z-tabbar (40)
--z-modal (30)
--z-header-collapsed (20)
--z-mega-menu (15)
--z-default (0)
```

**tabbar 相关（5 项，M5-PAGE-TABBAR-01）**：
```
--tabbar-height (56px)
--tabbar-bg (semi-transparent)
--tabbar-blur (backdrop-filter blur 12px)
--tabbar-underline-color
--tabbar-underline-transition-duration (180ms)
```

**shared-element 相关（3 项，M5-CARD-SHARED-01）**：
```
--shared-element-duration (360ms)
--shared-element-easing (cubic-bezier(0.4, 0, 0.2, 1))
--shared-element-fallback-duration (120ms) /* reduced motion */
```

**route-stack 相关（4 项，M5-CARD-ROUTESTACK-01）**：
```
--route-stack-edge-trigger-width (20px)
--route-stack-threshold-ratio (0.3)
--route-stack-velocity-threshold (0.5)
--route-stack-back-animation-duration (240ms)
```

**v1.1 汇总**：v1.0 31 项 + v1.1 新增 27 项 = **总计 58 项 Token alias**

---

## 9. 回归检查清单（M5-CLOSE-01 校验，v1.1 扩展）

### 9.1 卡片协议一致性
- [ ] 首页 / 分类页 / 搜索页 / 相关推荐 VideoCard 行为一致
- [ ] 图片点击 Fast Takeover，文字点击跳详情
- [ ] TagLayer ≤ 2 文字标签
- [ ] series/anime/tvshow 显示 StackedPosterFrame

### 9.2 动效一致性
- [ ] Fast Takeover 200/240ms
- [ ] Standard Takeover 360ms
- [ ] reduced motion 降级 120ms opacity
- [ ] StackedPosterFrame hover 时序
- [ ] **Sibling variant 在分类页切换时触发（v1.1）**
- [ ] **SharedElement FLIP 帧率 ≥ 55fps（v1.1）**
- [ ] **RouteStack 边缘返回手势触发正常（v1.1）**

### 9.3 a11y
- [ ] VideoCard 双 button 独立 aria-label
- [ ] 阴影 aria-hidden
- [ ] 键盘 Tab 顺序
- [ ] 悬浮按钮 aria-label
- [ ] 标签对比度 ≥ 4.5:1
- [ ] **Tab Bar 键盘可达（v1.1）**

### 9.4 关键路径回归（PLAYER）
- [ ] 断点续播 / 线路切换 / 影院模式 / 字幕开关 / mini↔full↔pip / Fast Takeover

### 9.5 Token 治理
- [ ] 58 项 alias 全部 semantic 层
- [ ] 无硬编码颜色
- [ ] Token 后台能预览新增

### 9.6 方案文档一致性
- [ ] §9.5 存在
- [ ] **§14.1.1 Tab Bar ↔ MiniPlayer 协议存在（v1.1）**
- [ ] **§15.3.1 Skeleton 契约存在（v1.1）**
- [ ] §16 含 VideoCard / TagLayer / StackedPosterFrame / **Skeleton（v1.1）**
- [ ] §19 为 PREP/CARD/API/PAGE/CLOSE 五阶段
- [ ] ADR-046 在 decisions.md 按编号顺序

### 9.7 Tab Bar ↔ MiniPlayer 协议（v1.1 新增）
- [ ] z-index 层级符合 ADR-046 §8.3
- [ ] safe-area-inset 不重复叠加
- [ ] 影院模式覆盖 Tab Bar
- [ ] 桌面端不渲染 Tab Bar

### 9.8 Banner 全栈（v1.1 新增）
- [ ] `home_banners` migration up/down 测通
- [ ] `GET /api/banners` 按时间窗 + is_active 过滤
- [ ] Admin CRUD + 拖拽排序正常
- [ ] FE 从真实 API 拉数据（非 mock）
- [ ] schema 变更同步 architecture.md

### 9.9 Skeleton 契约（v1.1 新增）
- [ ] `<Skeleton>` primitive 三形态
- [ ] 三档门槛（无 / 300ms / 800ms + 进度条）
- [ ] 所有 M5 新建组件导出 .Skeleton
- [ ] 像素级匹配（DevTools 叠加验证）

### 9.10 Search 页（v1.1 新增）
- [ ] 圆形扩散 250ms 进入
- [ ] 搜索建议 debounce 120ms
- [ ] 空状态 UI
- [ ] reduced motion 降级

### 9.11 primitive 激活（v1.1 新增）
- [ ] SharedElement 非 noop（实际 FLIP）
- [ ] RouteStack 非 stub（实际手势）
- [ ] PageTransition Sibling variant 已激活
- [ ] Skeleton primitive 已落地

### 9.12 依赖纪律（v1.1 新增）
- [ ] embla-carousel 使用不超出 M5-PREP-02 核查范围
- [ ] 无未经 BLOCKER 批准的新依赖

### 9.13 15 张卡完整交付
- [ ] PREP 2 / CARD 6 / API 2 / PAGE 6 / CLOSE 1 = 15 张均 ✅

### 9.14 arch-reviewer 审计（v1.1 扩充）
- [ ] M5-PREP-01 ADR-046 审计 PASS
- [ ] **M5-CARD-SHARED-01 FLIP 算法 code review PASS（v1.1）**
- [ ] M5-CLOSE-01 对齐审计 PASS

### 9.15 模型路由审计
- [ ] 每张卡在 tasks.md / commit trailer 记录主循环 + 子代理模型 ID
- [ ] PREP-01 / CLOSE-01 使用 opus 主循环
- [ ] CARD-SHARED-01 调用 arch-reviewer 子代理
- [ ] PREP-02 使用 haiku 子代理

---

## 10. 注意事项与风险提示（v1.1 扩展）

### 10.1 绝对禁止（强化提醒）
- ❌ 不得在 CLOSE 前扩充 ADR-046（发现缺漏 → BLOCKER 回 PREP）
- ❌ 不得硬编码颜色 / z-index / 时长（全部 Token 化）
- ❌ 不得修改 `/watch` URL（ADR-042）
- ❌ 不得跳过 PREP 阶段
- ❌ 不得在 VideoCard 增加第三个点击区
- ❌ 不得为新标签维度直接改代码（ADR-046 §4.4）
- ❌ 不得让 core 层感知 Fast/Standard Takeover 差异
- ❌ **不得在 M5-PAGE-BANNER-FE-01 启动时发现 embla-carousel 不存在而自行 install（v1.1）**
- ❌ **不得在 PAGE 卡完成时漏交 `.Skeleton` 导出（v1.1，AI-CHECK 六问强制）**
- ❌ **不得让 Tab Bar 与 MiniPlayer 重复加 safe-area-inset（v1.1）**
- ❌ **不得跳过 M5-CARD-SHARED-01 的 arch-reviewer code review（v1.1）**

### 10.2 依赖链暴露点
- **embla-carousel**：M5-PREP-02 强制核查；核查失败 → BLOCKER，不得 BANNER-FE 启动
- **react-dnd（或等价拖拽）**：M5-ADMIN-BANNER-01 依赖；PREP-02 同步核查
- **后端 tag 字段**：允许 mock，但必须备注
- **后端 episode 字段**：不得静默兜底
- **后端 home_banners 表**：M5-API-BANNER-01 新建；schema 必须同步 architecture.md

### 10.3 跨里程碑冻结（CLAUDE.md 约束）
M0-M6 内本补丁任务卡不得接受与方案无关的新需求。如提出新需求 → BLOCKER 暂停。

### 10.4 模型路由纪律
- **M5-PREP-01 / M5-CLOSE-01**：opus 主循环 + arch-reviewer opus 子代理（强制）
- **M5-PREP-02**：sonnet 主循环 + haiku 子代理（机械回写）
- **M5-CARD-SHARED-01（v1.1 新增）**：sonnet 主循环 + **arch-reviewer opus 子代理做 code review**（CLAUDE.md 强制升 #6）
- **其余 CARD / API / ADMIN / PAGE**：sonnet 主循环，不强制子代理
- 所有卡完成时，记录模型 ID 至 tasks.md + commit trailer

### 10.5 arch-reviewer 审计要点（M5-CLOSE-01）
1. ADR-046 §1-§8 全部决策都有实装（v1.1 扩到 §8）
2. 15 张卡 commit 与"文件范围"无越界
3. 58 项 Token alias 全部 semantic 层
4. 关键路径 E2E 回归全绿
5. 方案文档 §9.5/§14.1.1/§15.3.1/§16/§19 与 ADR-046 无漂移
6. **primitive 激活归属表与实际实装一致（v1.1）**
7. **Banner 全栈三卡 schema / API / FE 契约一致（v1.1）**

### 10.6 arch-reviewer code review（M5-CARD-SHARED-01，v1.1 新增）
SharedElement FLIP 是 M5 最高复杂度 primitive，code review 必须覆盖：
1. getSnapshotBeforeUpdate 钩子的正确使用（避免 React 18 并发模式下失效）
2. SharedElementRegistry 的内存泄漏防护（路由切换 cleanup）
3. FLIP 动画的 60fps 合规（requestAnimationFrame + transform 触发 GPU 层）
4. reduced motion 降级路径
5. SSR 安全（Registry 初始化不依赖 window）

---

## 11. 激活机制 — 如何把本补丁接入 `docs/task-queue.md`

### 11.1 追加顺序（v1.1）
1. **M5 BLOCKER 通知**（本补丁 §3）追加到 task-queue.md 现有 M5 占位区顶部
2. **15 张卡片**按 §7 定义格式写入 M5 占位区，顺序为 PREP-01/02 → CARD-CTA/TAG/STACK/SHARED/ROUTESTACK/SKELETON → API-BANNER/ADMIN-BANNER → PAGE-HEADER/TABBAR/BANNER-FE/GRID/SEARCH/DETAIL/PLAYER → CLOSE-01
3. **SEQ 标注**：五个 SEQ `SEQ-20260420-M5-PREP` / `-M5-CARD` / `-M5-API` / `-M5-PAGE` / `-M5-CLOSE`
4. **依赖边标注**：每张卡状态行后加 `**依赖**：{前置卡列表或"无"}`

### 11.2 激活时机
- Claude Code 主循环会话开工时：
  1. 读 task-queue.md，遇 M5 BLOCKER
  2. 检查 M5-PREP-01 状态，未开始 → 切换 opus 模型启动 PREP
  3. PREP ✅ → CARD 阶段（sonnet）；其中 SHARED-01 必须 spawn arch-reviewer code review
  4. CARD ✅ → 并行启动 API + 预留 PAGE（PAGE 等 CARD 全 ✅）
  5. API ✅ → PAGE 阶段（sonnet）
  6. PAGE ✅ → 切换 opus 启动 CLOSE

### 11.3 文件归属
- `docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md`（本文件）→ `git add`
- `docs/task_queue_patch_m5_card_protocol_20260420.md`（v1.0 历史版本）→ **保留不删不改不 rm**
- `docs/m5_primitive_activation_20260420.md`（M5-PREP-02 产出）→ `git add`
- `docs/m5_dependency_audit_20260420.md`（M5-PREP-02 产出）→ `git add`
- `docs/milestone_alignment_m5_20260420.md`（M5-CLOSE-01 产出）→ `git add`
- `docs/decisions.md` ADR-046 追加 → `git add`

---

## 12. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-04-20 | v1.0 | 初稿；锁定决策 M5-A/B/C/D/E；10 张卡定义完成 | 主循环 (claude-opus-4-7) |
| 2026-04-20 | v1.1 | 基于 Claude Code 执行侧预审反馈修订：新增决策 M5-F/G/H/I（Tab Bar 叠加 / primitive 激活归属 / Skeleton 系统 / Banner 全栈）；新增 5 张卡（CARD-SHARED-01 / CARD-ROUTESTACK-01 / CARD-SKELETON-01 / PAGE-TABBAR-01 / PAGE-SEARCH-01）+ 拆 BANNER 为 3 张（API-BANNER-01 / ADMIN-BANNER-01 / PAGE-BANNER-FE-01）；ADR-046 扩至 §1-§8（新增 §8 Tab Bar 协议 + §4.5 Skeleton 契约）；Token 扩展至 58 项；arch-reviewer code review 覆盖 SHARED-01；依赖核查前置到 PREP-02 | 主循环 (claude-opus-4-7) |

---

**END OF PATCH v1.1**

本补丁 v1.1 激活（§11.1 步骤 1 完成）后，M5 阶段执行侧即受 ADR-046 §1-§8 全章节约束。任何在 CARD/API/PAGE 阶段发现与 ADR-046 结论冲突 → 报 BLOCKER 回 PREP，**严禁绕开 PREP 直接改代码**。v1.0 文件保留作为历史版本可追溯修订链路。
