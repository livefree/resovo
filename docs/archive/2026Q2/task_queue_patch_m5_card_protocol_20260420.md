# 任务队列补丁 — M5 卡片协议与列表→播放器直达路径（2026-04-20）

> status: archived
> owner: @planning
> scope: M5 card protocol and list-to-player task queue patch
> source_of_truth: no
> supersedes: none
> superseded_by: docs/task-queue.md, docs/frontend_design_spec_20260423.md
> last_reviewed: 2026-04-24
>
> 适用范围：**M5 页面重置 — 前置决策 + 卡片协议 + 页面重塑序列**
> 前置补丁：
> - `docs/task_queue_patch_rewrite_track_20260418.md`（apps/web-next 并行路线 + RW-SETUP）
> - `docs/task_queue_patch_m2_followup_20260419.md`（M2 闭幕，已落地 ✅）
> - `docs/task_queue_patch_m3_20260419.md`（M3 详情页 + 播放器接管，已落地 ✅）
> - `docs/task_queue_patch_regression_m1m2m3_20260420.md`（REGRESSION 序列，已落地 ✅）
> 发布者：主循环（claude-opus-4-7）对照 `docs/frontend_redesign_plan_20260418.md` §19 补齐卡片协议缺口后起草
> 交付对象：Claude Code 执行会话（共 10 张卡，分四阶段 PREP / CARD / PAGE / CLOSE；2 张强制 opus 子代理）
> 紧迫级别：⚠️ **STRUCTURED 级** — 本补丁不触发 BLOCKER，但 M5 序列启动必须以 PREP 阶段（M5-PREP-01/02）PASS 为前置门禁

---

## 1. 背景与决策摘要

### 1.1 为什么需要此补丁

方案 `docs/frontend_redesign_plan_20260418.md` §19 对 M5 的定义止于"页面重塑 4-5 张卡片（Header/Footer/Banner/分类页/详情页/播放页）"，但对以下三类关键决策**未下结论**：

1. **列表→播放器直达路径**：REGRESSION 阶段已经在 ADR-042 锁定"保留 `/watch/[slug]` URL"，但 apps/web-next 的 VideoCard 目前只有"点击卡片进详情页"这一条出口，原 apps/web 的"卡片右上角 ▶ 直达播放"在迁移中丢失，**方案 §9/§12.4 均未补回**。
2. **卡片内容协议**：§19 列出"卡片 primitive"但未定义标签体系（新片/热门/连载中/已完结）、文字区字段、集数显示规则——各页面消费方（首页/分类页/搜索页/相关推荐）实现时必然各做各的。
3. **多集视频卡视觉**：方案对 series/anime/tvshow 类内容未提出与 movie 不同的视觉差异化，用户预期"一眼识别多集内容"的需求无对应 primitive。

如果带着这三个缺口进入 M5 执行，必将复现 REGRESSION 阶段"方案与执行错位"的偏差模式。本次补丁的定位是 **在 M5 执行前把卡片协议决策权前置**，以 ADR-046 为决策锚点，把页面实施拆为"协议 → primitive → 页面消费"三段。

### 1.2 核心决策（本补丁锁定）

**决策 M5-A — 列表→播放器直达路径（路径 B' 定制版）**
分类页/首页/搜索页的 VideoCard **同时提供两条出口**：
- 点击图片区（上半） → 直达 `/watch/[slug]?ep=1`（播放页）
- 点击文字区（下半） → 进入 `/video/[slug]` 或 `/{type}/[slug]`（详情页）

桌面端与移动端交互协议一致，桌面端额外增加 hover 动效与悬浮 ▶ 播放按钮。容错区（卡片中轴 8px 间隙）归属文字区（详情页为安全退路）。此决策构成 **ADR-046**，必须由 arch-reviewer (claude-opus-4-6) 子代理出稿后落盘。

**决策 M5-B — 卡片内容协议（标签 + 元信息）**
- 图片区最多 2 个文字标签（左上角堆叠），维度：生命周期（新片/即将上线/连载中/已完结/下架预警）+ 热度/运营（热门/本周 Top/独家/编辑推荐）。规格与评分以图标化形式右下/右上单独计，不占上限。
- 文字区固定两行：第一行片名单行省略；第二行 `年份 · 类型 · 集数（可选）` 小字次要色。movie 类型以"时长 102min"占位保持视觉对齐。
- 标签新增维度（如限免/付费/会员专享）必须走 ADR 变更，不得直接改代码添加。

此决策是 ADR-046 §4 的组成部分。

**决策 M5-C — 多集卡片静置态阴影方案（方案 A）**
series/anime/tvshow 类型卡在静置态用伪堆叠阴影（右偏 3px + 上偏 2px 一层，右偏 6px + 上偏 4px 二层）暗示"多集"，不渲染真实后卡元素。PC hover 时阴影偏移扩展到 6px/10px，并淡入第二层阴影，实现克制的"纸牌浮出"效果。此决策是 ADR-046 §5 的组成部分。

**决策 M5-D — M5 内部分阶段门禁**
在 §19 的页面重塑之前，强制插入 PREP 阶段（ADR-046 + 方案文档回写），PREP 未 PASS 前禁止启动任何 CARD / PAGE 阶段。此决策构成 M5 的执行协议，不产生独立 ADR，由本补丁 §4 规定。

**决策 M5-E — Fast Takeover 动效差异化**
列表→播放器采用 "Fast Takeover"（移动 200ms / 桌面 240ms），比详情页→播放器的 Standard Takeover（360ms）更快速直接。动效规格见 ADR-046 §3。

### 1.3 与已有 ADR 的关系

| ADR | 内容 | 本补丁关系 |
|-----|------|-----------|
| ADR-037 | REGRESSION PHASE COMPLETE 门禁 | 前置已完成 |
| ADR-040 | Root layout 四件套 + MainSlot | M5 页面重塑复用，不改 |
| ADR-041 | GlobalPlayerHost 唯一播放器宿主 | Fast Takeover 的 dispatch 目标 |
| ADR-042 | `/watch/[slug]` URL 保留 | 路径 B' 的直达目标 URL 锁定 |
| ADR-046（新） | 列表→播放器直达路径与卡片交互协议 | **本补丁核心决策** |

---

## 2. 方案 ↔ 执行 对齐表（M5 协议基线）

| 方案章节 | 方案要求 | 当前 apps/web-next 现状 | 需补齐 | 补齐卡片 |
|---|---|---|---|---|
| §9.x 过渡 | 四类过渡（Sibling / Push+Shared / Takeover / Overlay） | PageTransition primitive 已落地（noop 默认） | 新增 §9.5 Cross-Skip Takeover（跨级直达变体） | M5-PREP-02 |
| §12.4 详情→播放 | Shared Element + 360ms Takeover | 概念定义完整，实装待 M5-PAGE-DETAIL | 补列表→播放路径 | M5-PREP-01 + CARD-CTA |
| §16 组件清单 | VideoCard / HeroBanner / Grid 等 | VideoCard 存在但仅单出口 | 拆分为 `VideoCard.PosterAction` + `VideoCard.MetaAction`；新增 TagLayer / StackedPosterFrame | M5-CARD-CTA/TAG/STACK |
| §19 M5 页面重塑 | Header/Footer/Banner/分类页/详情页/播放页 4-5 卡 | 全部为业务逻辑迁移完成、样式待重塑 | 五张 PAGE 卡 + PREP 前置 | M5-PAGE-* |
| — | 列表卡标签 taxonomy | 无 | taxonomy 协议 + TagLayer primitive | M5-CARD-TAG-01 |
| — | 多集视觉差异化 | 无 | StackedPosterFrame primitive | M5-CARD-STACK-01 |

---

## 3. M5 BLOCKER 通知（追加到 `docs/task-queue.md` M5 占位区顶部）

```markdown
## ⚠️ M5 前置门禁 — PREP 阶段 PASS 前禁启 CARD/PAGE

- **触发时间**：2026-04-20
- **触发原因**：方案 §19 M5 定义缺失卡片协议三项决策（直达路径 / 标签 taxonomy / 多集视觉）
- **封锁范围**：
  - 🚫 禁止启动 M5-CARD-* 序列（CARD-CTA/TAG/STACK）直到 M5-PREP-01 + M5-PREP-02 全部 ✅
  - 🚫 禁止启动 M5-PAGE-* 序列直到 M5-CARD-* 全部 ✅
  - ✅ 允许：M5-PREP-01（ADR-046 撰写）、M5-PREP-02（方案回写）、hotfix
- **解除条件**：
  1. M5-PREP-01 ✅（ADR-046 落盘到 docs/decisions.md）
  2. M5-PREP-02 ✅（docs/frontend_redesign_plan_20260418.md §9.5/§16/§19 更新完成）
  3. Opus arch-reviewer 独立审计 PASS（孪生子代理对 ADR-046 结论与方案正文一致性复核）
- **关联文档**：`docs/task_queue_patch_m5_card_protocol_20260420.md`
```

---

## 4. M5 序列总览

```
M5: 页面重置
│
├─ 阶段 P · 前置决策（PREP）
│  ├─ M5-PREP-01  ADR-046 撰写（卡片协议 + 直达路径）  [opus+arch-reviewer]  规模 M
│  └─ M5-PREP-02  方案文档回写（§9.5 + §16 + §19）     [haiku 子代理]         规模 S
│
├─ 阶段 C · 卡片 primitive（CARD）
│  ├─ M5-CARD-CTA-01    VideoCard 双入口拆分 + Fast Takeover   [sonnet]       规模 M
│  ├─ M5-CARD-TAG-01    TagLayer primitive + taxonomy + Token  [sonnet]       规模 M
│  └─ M5-CARD-STACK-01  StackedPosterFrame + hover 堆叠时序    [sonnet]       规模 S
│
├─ 阶段 G · 页面重塑（PAGE）
│  ├─ M5-PAGE-HEADER-01  Header/Footer 重塑（§7）               [sonnet]      规模 M
│  ├─ M5-PAGE-BANNER-01  HeroBanner 重塑（§10）                 [sonnet]      规模 M
│  ├─ M5-PAGE-GRID-01    分类页 Grid 重塑（消费 CARD-*）         [sonnet]      规模 M
│  ├─ M5-PAGE-DETAIL-01  详情页重塑（§12）                      [sonnet]      规模 L
│  └─ M5-PAGE-PLAYER-01  播放页重塑（§13）                      [sonnet]      规模 L
│
└─ 阶段 Z · M5 收尾
   └─ M5-CLOSE-01  M5 PHASE COMPLETE + Opus 独立审计 + ADR-037 迭代  [opus]  规模 S
```

**依赖关系**：
- `P → C → G → Z` 严格串行
- P 内部：`M5-PREP-01 → M5-PREP-02`
- C 内部：三张 CARD 可并行（三人日），但建议先 CARD-CTA 后 CARD-TAG/STACK
- G 内部：PAGE-GRID/DETAIL 必须在 CARD-* 全部 ✅ 后启动；PAGE-HEADER/BANNER/PLAYER 可与 GRID/DETAIL 并行

---

## 5. ADR-046 骨架（M5-PREP-01 产出模板）

> **提醒**：以下为 Opus 子代理撰写 ADR-046 时的骨架提示。子代理必须基于 CLAUDE.md「强制升 Opus」第 1/3/4 条情形独立产出，不得直接复制本骨架。最终 ADR-046 须追加到 `docs/decisions.md` 按编号顺序最末。

```markdown
### ADR-046: 列表→播放器直达路径与卡片交互协议

**状态**：Accepted
**日期**：2026-04-20
**关联**：ADR-041（GlobalPlayerHost）/ ADR-042（/watch URL 保留）/ 方案 §9.x 过渡 / 方案 §16 VideoCard

#### 1. 背景
- REGRESSION 前 apps/web 的 VideoCard 有"卡片右上角 ▶ 直达播放器"按钮；迁到 apps/web-next 后丢失，当前只有"整卡进详情页"单出口。
- 方案 §9 只定义了"详情→播放"的 Takeover，未定义"列表→播放"的跨级直达。
- 卡片标签（新片/热门等）在原方案未成文，各页面消费方实现各异。
- series/anime/tvshow 类内容在列表中缺乏与 movie 的视觉差异化。

#### 2. 交互协议（路径 B' 定制版）
- **图片区点击**（含 ▶ 悬浮按钮）→ 直达 `/watch/[slug]?ep=1`
- **文字区点击** → 进入详情页 `/{type}/[slug]` 或 `/video/[slug]`
- **容错区**（卡片中轴 8px 间隙） → 归属文字区
- **长按（移动）/ 右键（桌面）** → 上下文菜单（加入稍后看 / 分享 / 举报 / 播放）

#### 3. 动效规格
- **Fast Takeover**（本 ADR 新增变体，对应方案 §9.5 新增章节）
  - 移动端总时长 200ms，桌面端 240ms
  - 阶段 A（0-60%）：卡片图片层 scale 1.0→1.03 + mask `rgba(0,0,0,0.9)` 淡入
  - 阶段 B（60-100%）：卡片图层 flip 至播放器 poster 位置 + 字幕/控件淡入
- **Standard Takeover**（保持不变）：详情页→播放器 360ms
- **悬浮 ▶ 按钮**（桌面独占）：hover 进入 120ms，离开 90ms，尺寸 44px，背景 `rgba(0,0,0,0.5)` + backdrop-filter blur(8px)

#### 4. 卡片内容协议（标签 + 元信息）
##### 4.1 标签上限与位置
- 图片区最多 2 个文字标签，堆叠在左上角
- 规格标签（4K/HDR/中字）≤2 个，图标化，右下角
- 评分（豆瓣 9.1）≤1 个，右上角，半透明星标

##### 4.2 标签维度
| 维度 | 典型值 | 互斥规则 |
|------|--------|---------|
| 生命周期 | 新片 / 即将上线 / 连载中 / 已完结 / 下架预警 | 五选一 |
| 热度/运营 | 热门 / 本周 Top / 独家 / 编辑推荐 | 最多 1 个 |
| 规格 | 4K / HDR / 杜比 / 中字 / 多语 | 独立计，最多 2 个 |
| 评分 | 豆瓣 9.1 / IMDb 8.7 | 独立计，最多 1 个 |

##### 4.3 文字区规则
- 第 1 行：片名（`line-clamp: 1`，省略号截断，14-15px weight 600）
- 第 2 行：`{year} · {type} · {episodeInfo}`（12px weight 400 次要色）
  - series/anime/tvshow：`episodeInfo = "全 24 集" | "更新至 12 集" | "11 集"`
  - movie：`episodeInfo = "102 min"`（保持两行对齐）
  - short/clip：episodeInfo 省略，第 2 行仅 `year · type`
- 禁止字段：导演、演员、简介、评分数字、豆瓣标识（归详情页）

##### 4.4 新增维度变更约束
未来新增标签维度（限免/付费/会员专享等）**必须走 ADR 变更**，不得直接改代码。维度与样式 Token 一一对应，新增维度 = 新增 Token 别名 = ADR 追加。

#### 5. 多集视频卡视觉（StackedPosterFrame）
##### 5.1 触发条件
仅 `video.type ∈ {'series', 'anime', 'tvshow'}` 渲染堆叠视觉；movie/short/clip 保持单卡外观。

##### 5.2 静置态（方案 A — 阴影暗示）
- 主卡不变，通过 box-shadow 模拟两层后卡：
  ```css
  box-shadow:
    3px -2px 0 0 color-mix(in oklch, var(--surface-2) 60%, transparent),
    6px -4px 0 0 color-mix(in oklch, var(--surface-2) 30%, transparent),
    0 4px 12px rgba(0,0,0,0.08);
  ```
- 不渲染真实后卡 DOM，纯视觉暗示
- 暗色模式：`var(--surface-2)` → `var(--surface-3)`，阴影不透明度 +10%

##### 5.3 PC hover 态时序（总 200ms）
| 阶段 | 时间 | 动作 |
|------|------|------|
| A | 0-80ms | 主卡 scale 1.0→1.02，底阴影加深 |
| B | 80-160ms | 后卡 1 阴影 3px/-2px → 6px/-4px，不透明度 0.3→0.5 |
| C | 160-200ms | 后卡 2 阴影 6px/-4px → 10px/-6px，不透明度 0→0.25；悬浮 ▶ 按钮淡入 |

离场反向 140ms。触发使用 `mouseenter`（非 `mouseover`）+ 30ms debounce，避免光标扫过网格时触发排卡片连爆。

#### 6. 组件边界
- `<VideoCard>` → 复合组件，仅负责容器 + 布局
  - `<VideoCard.PosterAction>` → 独立 `<button>` 元素，点击触发 Fast Takeover
  - `<VideoCard.MetaAction>` → 独立 `<button>` 元素，点击跳详情页
- `<TagLayer>` → primitive，消费标签维度 props 渲染到图片区
- `<StackedPosterFrame>` → primitive，包装 SafeImage，根据 `stackLevel` 渲染阴影层

#### 7. 验收清单
- [ ] a11y：两个 button 独立 aria-label（`播放 {片名}` / `{片名} 详情页`）
- [ ] a11y：堆叠阴影 `aria-hidden="true"`
- [ ] reduced motion：Fast Takeover 退化为 opacity 0→1 120ms；堆叠 hover 仅改阴影不放大
- [ ] 暗色模式：标签、阴影、悬浮按钮全部 Token 化，无硬编码颜色
- [ ] 容器查询：桌面/移动判定用 card 容器宽度而非 viewport（便于嵌入不同栅格宽度）
- [ ] 键盘导航：Tab 顺序 PosterAction → MetaAction；回车触发各自行为
```

---

## 6. 方案文档回写补丁（M5-PREP-02 产出）

### 6.1 `docs/frontend_redesign_plan_20260418.md` §9.5 新增章节

位置：§9.4 之后、§10 之前

```markdown
### 9.5 Cross-Skip Takeover（跨级直达变体）

**定义**：从列表页卡片直接跳转到播放器，跳过详情页这一层级的过渡变体。

**与 §9.3 Standard Takeover 的差异**：

| 维度 | Standard Takeover (§9.3) | Fast Takeover (§9.5) |
|------|--------------------------|----------------------|
| 出发点 | 详情页 hero 图 | 列表卡 poster |
| 总时长（移动） | 360ms | 200ms |
| 总时长（桌面） | 360ms | 240ms |
| mask 深度 | `rgba(0,0,0,0.85)` | `rgba(0,0,0,0.9)` |
| scale 范围 | 1.0 → 1.0（尺寸匹配） | 1.0 → 1.03（强调瞬移） |
| 使用场景 | 用户从详情页明确选择"开始播放" | 用户在列表快速决定观看 |

**时序**：
- 阶段 A（0-60%）：卡片图片层 scale + mask 淡入
- 阶段 B（60-100%）：卡片 flip 至播放器 poster → 字幕/控件/进度条淡入

**触发**：VideoCard.PosterAction 点击，或长按菜单中的"播放"选项。

**降级（reduced motion）**：opacity 0→1 120ms，跳过 scale 与 flip。

详见 ADR-046 §3。
```

### 6.2 `docs/frontend_redesign_plan_20260418.md` §16 组件清单增补

位置：§16 VideoCard 条目下方替换原描述，追加 TagLayer / StackedPosterFrame 两条。

```markdown
#### 16.x VideoCard（复合组件）

**组成**：
- `<VideoCard>` 容器
- `<VideoCard.PosterAction>` 图片区独立按钮，点击触发 Fast Takeover
- `<VideoCard.MetaAction>` 文字区独立按钮，点击跳详情页

**宽高比**：poster 2:3（默认），wide 16:9（Banner 横版场景）

**hover 行为（桌面）**：整卡 scale 1.02 + 悬浮 ▶ 按钮淡入 + StackedPosterFrame 阴影浮出（仅多集）

**点击行为**：按位置分区，图片区 → 播放，文字区 → 详情，8px 中轴间隙 → 详情

详见 ADR-046 §2/§3/§6。

#### 16.y TagLayer（primitive）

**Props**：`lifecycle?: 'new'|'upcoming'|'ongoing'|'ended'|'delisting'` / `trending?: 'hot'|'top-week'|'exclusive'|'editor-pick'` / `specs?: Array<'4k'|'hdr'|'dolby'|'cc'|'multi-lang'>` / `rating?: { source: 'douban'|'imdb', score: number }`

**规则**：lifecycle 与 trending 同屏最多各 1 个（合计 ≤ 2 个文字标签）；specs ≤ 2 图标；rating ≤ 1 图标。

详见 ADR-046 §4。

#### 16.z StackedPosterFrame（primitive）

**Props**：`stackLevel: 0 | 1 | 2` / `aspectRatio: '2/3' | '16/9'`

**渲染**：
- stackLevel=0：单层 SafeImage
- stackLevel≥1：SafeImage + box-shadow 模拟后卡
- 消费方根据 `video.type` 决定 stackLevel（movie=0, series/anime/tvshow=2）

详见 ADR-046 §5。
```

### 6.3 `docs/frontend_redesign_plan_20260418.md` §19 M5 章节重写

位置：整节替换。保留 §19 开头的目标声明，把页面重塑列表扩展为 10 张卡。

```markdown
## 19. M5: 页面重置

**目标**：在 REGRESSION 能力层、primitive 层、播放器 root 化已落地的基础上，重塑全站 5 个核心页面到"专业视觉 + 完整交互"级别，消除 apps/web-next 迁移过程中丢失的字体/按钮/间距/过渡动效。

**前置**：REGRESSION 序列 ✅（ADR-037 PASS）

**分阶段**：

### 19.1 阶段 P（PREP）前置决策

- **M5-PREP-01**：ADR-046 撰写（卡片协议 + 直达路径）
- **M5-PREP-02**：本文档回写（§9.5 新增、§16 扩充、§19 重写）

### 19.2 阶段 C（CARD）卡片 primitive 落地

- **M5-CARD-CTA-01**：VideoCard 双入口拆分 + Fast Takeover 动效
- **M5-CARD-TAG-01**：TagLayer primitive + taxonomy + Token 别名
- **M5-CARD-STACK-01**：StackedPosterFrame primitive + hover 堆叠时序

### 19.3 阶段 G（PAGE）页面重塑

- **M5-PAGE-HEADER-01**：Header/Footer 重塑（§7）
- **M5-PAGE-BANNER-01**：HeroBanner 重塑（§10）
- **M5-PAGE-GRID-01**：分类页 Grid 重塑（消费 CARD-*）
- **M5-PAGE-DETAIL-01**：详情页重塑（§12）
- **M5-PAGE-PLAYER-01**：播放页重塑（§13）

### 19.4 阶段 Z（CLOSE）收尾

- **M5-CLOSE-01**：PHASE COMPLETE + Opus 独立审计

**详见**：`docs/task_queue_patch_m5_card_protocol_20260420.md`
```

---

## 7. 任务卡详细定义

### 7.1 M5-PREP-01 — ADR-046 撰写（卡片协议 + 直达路径）

- **所属 SEQ**：SEQ-20260420-M5-PREP
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理
- **规模估计**：M（~120 分钟）
- **子代理调用（强制）**：arch-reviewer (claude-opus-4-6) — ADR-046 全文独立产出
- **目标**：把本补丁 §1.2 的决策 M5-A/B/C/E 整合为正式 ADR-046，追加到 `docs/decisions.md`。
- **前置**：无
- **文件范围**：
  - 修改 `docs/decisions.md`：文末追加 ADR-046（按本补丁 §5 骨架展开为完整 ADR）
  - 新增 `docs/adr-046-card-protocol-appendix.md`（可选，如 ADR 正文过长）
- **验收**：
  - ADR-046 包含完整的 §1 背景、§2 交互协议、§3 动效规格、§4 卡片内容协议、§5 多集视觉、§6 组件边界、§7 验收清单
  - 引用 ADR-041 / ADR-042 / 方案 §9/§12/§16 的具体章节号
  - 明确列出 Fast Takeover 的 reduced motion 降级路径
  - 明确列出暗色模式适配规则
  - 由 arch-reviewer 子代理独立校对后标为 Accepted
- **质量门禁**：六问自检 + [AI-CHECK] 结论块
- **注意事项**：
  - ADR 正文不得直接复制本补丁 §5 骨架，须由子代理根据本补丁背景独立撰写
  - ADR-046 是 M5 整个序列的决策锚点，任何后续 CARD/PAGE 卡发现与 ADR-046 冲突 → 报 BLOCKER，回到 PREP 阶段修 ADR
  - 记录主循环模型 ID + 子代理模型 ID 到 tasks.md 卡片的"执行模型""子代理调用"字段

### 7.2 M5-PREP-02 — 方案文档回写（§9.5 + §16 + §19）

- **所属 SEQ**：SEQ-20260420-M5-PREP
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-haiku-4-5-20251001（Haiku 子代理，机械性文档回写）
- **规模估计**：S（~45 分钟）
- **子代理调用**：Haiku 子代理（机械回写，主循环只验证）
- **目标**：把 ADR-046 的决策回写到 `docs/frontend_redesign_plan_20260418.md`，让方案文档成为 ADR-046 的自然投影。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 修改 `docs/frontend_redesign_plan_20260418.md`：
    - §9.5 新增 Cross-Skip Takeover 章节（位置在 §9.4 后）
    - §16 组件清单补充 VideoCard 复合化 + TagLayer + StackedPosterFrame 三条
    - §19 M5 章节整体重写为 PREP/CARD/PAGE/CLOSE 四阶段
- **验收**：
  - `docs/frontend_redesign_plan_20260418.md` diff 与本补丁 §6 三段内容一致
  - 新章节的编号与周围小节保持风格一致（标题层级、编号格式）
  - 引用 ADR-046 的具体节次（§2/§3/§4/§5/§6）
  - typecheck 不涉及，lint 不涉及，但 Markdown 预览须无渲染错误
- **质量门禁**：六问自检（侧重"是否偏离 ADR-046 结论"）+ [AI-CHECK]
- **注意事项**：
  - Haiku 子代理仅做机械回写，不得对 ADR-046 结论做二次解读
  - 若发现方案旧章节与 ADR-046 相悖（例如旧 §9.3 表述与 ADR-046 §3 冲突），须把冲突点写进任务备注，主循环决定是否追加 M5-PREP-03 修正原章节

### 7.3 M5-CARD-CTA-01 — VideoCard 双入口拆分 + Fast Takeover

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~150 分钟）
- **子代理调用**：无（协议已由 ADR-046 锁定）
- **目标**：把 `apps/web-next/src/components/video/VideoCard.tsx` 从单出口 Link 拆分为 `VideoCard.PosterAction` + `VideoCard.MetaAction` 两个独立 button 元素，并接入 Fast Takeover 动效调用 GlobalPlayerHost。
- **前置**：M5-PREP-01 ✅ + M5-PREP-02 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`：
    - 把外层 `<Link>` 拆为容器 `<article>` + 内部两个 `<button>` 或 `<Link>`
    - 图片区 onClick → `playerStore.enter({ videoId, mode: 'full', transition: 'fast-takeover' })`
    - 文字区保持 `<Link href={getVideoDetailHref(video)}>`
    - 8px 中轴间隙样式（CSS gap + padding）
    - hover 时（桌面，通过 `@media (hover: hover)` 或容器查询）显示 `<FloatingPlayButton />`
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/playerStore.ts`：扩展 `enter()` 接受 `transition: 'fast-takeover' | 'standard-takeover'` 参数
  - 新增 `apps/web-next/src/components/video/FloatingPlayButton.tsx`：44px 悬浮播放按钮
  - 新增 `apps/web-next/src/components/player/transitions/FastTakeover.ts`：Fast Takeover 动效实现（与 Standard Takeover 并列）
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx`：识别 `transition` 参数调用对应动效
  - 新增 `tests/unit/web-next/VideoCard.test.tsx`：覆盖双点击区分、键盘 Tab 顺序、reduced motion 降级
  - 新增 `tests/e2e-next/card-to-watch.spec.ts`：覆盖桌面 hover ▶ 按钮、移动端点击图片直达 /watch、点击文字进详情
- **验收**：
  - 点击 VideoCard 图片区 → 200-240ms 内 GlobalPlayerHost 进入 full 态播放目标 video 的 ep=1
  - 点击 VideoCard 文字区 → 路由跳转到详情页
  - 键盘 Tab：PosterAction 先于 MetaAction 获得焦点
  - 两个 button 各自拥有独立 aria-label（`播放 {title}` / `{title} 详情页`）
  - reduced motion 开启时 Fast Takeover 退化为 opacity 120ms
  - typecheck ✅ / lint ✅ / unit ✅ / e2e ✅（`tests/e2e-next/card-to-watch.spec.ts` 全绿）
  - 关键路径回归（断点续播、线路切换、影院模式、字幕开关）PASS
- **质量门禁**：六问自检 + [AI-CHECK]
- **注意事项**：
  - 不得使用 `any` 类型，`transition` 参数必须用字面量联合
  - Fast Takeover 实现**不得硬编码颜色**（mask 颜色走 Token）
  - 不得修改 `/watch` 页本身的渲染逻辑（仍由 GlobalPlayerHost 接管，ADR-041 约束）
  - PlayerShell 与 core 层不得引入业务逻辑（ADR 既有约束）

### 7.4 M5-CARD-TAG-01 — TagLayer primitive + taxonomy + Token

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~90 分钟）
- **子代理调用**：无
- **目标**：实装 TagLayer primitive，消费 ADR-046 §4 的标签 taxonomy，并扩展 Token 层新增 12 个 tag 相关 alias。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 新增 `apps/web-next/src/components/primitives/media/TagLayer.tsx`
  - 新增 `apps/web-next/src/types/tag.ts`：导出 `LifecycleTag`、`TrendingTag`、`SpecTag`、`RatingSource` 类型
  - 修改 `packages/design-tokens/src/semantic/tag.json`（或等价路径）：新增 12 个 alias：
    - `--tag-lifecycle-new-bg` / `-fg`
    - `--tag-lifecycle-upcoming-bg` / `-fg`
    - `--tag-lifecycle-ongoing-bg` / `-fg`
    - `--tag-lifecycle-ended-bg` / `-fg`
    - `--tag-lifecycle-delisting-bg` / `-fg`
    - `--tag-trending-hot-bg`（渐变）/ `-fg`
    - `--tag-trending-top-week-bg` / `-fg`
    - `--tag-trending-exclusive-bg` / `-fg`
    - `--tag-trending-editor-pick-bg` / `-fg`
    - `--tag-spec-icon-color`
    - `--tag-rating-bg`（半透明）/ `-fg`
    - `--tag-border-radius`（统一 4px）
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`：在 PosterAction 内嵌 `<TagLayer {...video.tags} />`
  - 修改 `apps/server/src/lib/videos/tag-mapping.ts`（或等价路径）：从 DB `videos` 表字段映射到 TagLayer props
  - 新增 `tests/unit/web-next/TagLayer.test.tsx`：覆盖 lifecycle/trending 互斥、specs 上限 2、rating 渲染
- **验收**：
  - TagLayer 在图片区左上渲染最多 2 个文字标签，右下 ≤2 个规格图标，右上 ≤1 个评分
  - lifecycle 与 trending 同屏最多各 1 个（组件内 assert）
  - 所有颜色通过 Token 取值，无硬编码
  - 暗色模式下对比度 ≥ 4.5:1
  - typecheck ✅ / lint ✅ / unit ✅
- **注意事项**：
  - Token 新增必须同步 `docs/architecture.md` 的 Token 层章节（如果有）
  - 后端返回的 tag 字段结构必须先定型后才能实施（参考当前 `videos.metadata` JSON 字段，不做 schema migration）
  - 若后端当前缺乏热度计算逻辑，`trending` 字段可暂时由前端 mock（M6 或后续再接入 Job）

### 7.5 M5-CARD-STACK-01 — StackedPosterFrame + hover 堆叠时序

- **所属 SEQ**：SEQ-20260420-M5-CARD
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-sonnet-4-6
- **规模估计**：S（~60 分钟）
- **子代理调用**：无
- **目标**：实装 StackedPosterFrame primitive，为 series/anime/tvshow 类型视频卡提供阴影暗示的多集视觉。
- **前置**：M5-PREP-01 ✅
- **文件范围**：
  - 新增 `apps/web-next/src/components/primitives/media/StackedPosterFrame.tsx`
  - 修改 `packages/design-tokens/src/semantic/stack.json`（或等价路径）：新增 alias：
    - `--stack-layer-1-offset-x`（3px）
    - `--stack-layer-1-offset-y`（-2px）
    - `--stack-layer-2-offset-x`（6px）
    - `--stack-layer-2-offset-y`（-4px）
    - `--stack-layer-hover-1-offset-x`（6px）
    - `--stack-layer-hover-1-offset-y`（-4px）
    - `--stack-layer-hover-2-offset-x`（10px）
    - `--stack-layer-hover-2-offset-y`（-6px）
    - `--stack-layer-opacity-1`（0.3）/ `-hover`（0.5）
    - `--stack-layer-opacity-2`（0）/ `-hover`（0.25）
    - `--stack-transition-duration`（200ms）/ `-reverse`（140ms）
  - 修改 `apps/web-next/src/components/video/VideoCard.tsx`：PosterAction 内 SafeImage 替换为 `<StackedPosterFrame stackLevel={getStackLevel(video.type)}>`
  - 新增 `apps/web-next/src/lib/video-helpers.ts`（或复用已有）`getStackLevel(type)` 映射
  - 新增 `tests/unit/web-next/StackedPosterFrame.test.tsx`
- **验收**：
  - series/anime/tvshow 卡片静置时显示两层阴影；movie/short/clip 卡片单层
  - 桌面 hover 时阴影偏移与不透明度按 ADR-046 §5.3 时序动画
  - `aria-hidden="true"` 正确标注阴影层
  - reduced motion 下 hover 不触发 scale，仅改阴影
  - 暗色模式阴影使用 `--surface-3` 系 Token
  - typecheck ✅ / lint ✅ / unit ✅
- **注意事项**：
  - 阴影用 `box-shadow` 实现，不渲染真实后卡 DOM，避免 DOM 节点膨胀
  - mouseenter 监听器须加 30ms debounce（或使用 CSS-only hover + transition 天然延迟）避免光标扫过网格时连锁触发

### 7.6 M5-PAGE-HEADER-01 — Header/Footer 重塑

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **状态**：⬜ 未开始
- **创建时间**：2026-04-20
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无
- **目标**：按方案 §7.1-§7.4 重塑 Header（含 Mega Menu、scroll-collapse 80px、hover 120ms）与 Footer。
- **前置**：M5-CARD-* ✅（本卡消费 TagLayer 等间接依赖）
- **文件范围**：
  - 修改 `apps/web-next/src/components/layout/Header.tsx`、`Footer.tsx`
  - 新增 `apps/web-next/src/components/layout/MegaMenu.tsx`
  - 消费 `useBrand()` 驱动 Logo / Footer 文案
- **验收**：
  - 滚动 80px 内 Header 高度从 `h-16` → `h-12` 平滑过渡（方案 §7.2）
  - Mega Menu hover 120ms 展开，离开 180ms 收回
  - 无硬编码颜色
  - typecheck ✅ / lint ✅ / unit ✅
- **注意事项**：Header 必须挂在 root layout（ADR-040 既有约束），本卡不改挂载位置，只改内部实现

### 7.7 M5-PAGE-BANNER-01 — HeroBanner 重塑

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **目标**：按方案 §10.1/§10.2 重塑 HeroBanner（PC `min(520px, 60vh)` + Ken Burns 6s + 主色染色；移动 5:6 + embla-carousel swipe）。
- **前置**：M5-CARD-* ✅
- **文件范围**：
  - 修改 `apps/web-next/src/components/video/HeroBanner.tsx`
  - 新增 `apps/web-next/src/components/video/KenBurnsLayer.tsx`
  - 新增 `apps/web-next/src/components/video/BannerCarouselMobile.tsx`
  - 依赖 `embla-carousel-react`（**注意：新增依赖必须先评估是否违反 CLAUDE.md 绝对禁止第 2 条**；若 embla-carousel 已在 apps/web 或 apps/web-next 某处使用，可直接引入；否则报 BLOCKER）
- **验收**：
  - PC 端 Banner 切换时主色随当前 slide 变更，过渡 1s
  - 移动端滑动流畅（embla-carousel 默认配置）
  - 保留既有双 CTA（立即观看 + 详情信息）结构
  - typecheck ✅ / lint ✅ / unit ✅ / e2e（HOME）PASS

### 7.8 M5-PAGE-GRID-01 — 分类页 Grid 重塑

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **目标**：按方案 §11 / §15 重塑分类页 Grid（TopSlot 接替 300ms 动效 + 3 档响应式栅格 + ScrollRestoration 激活）。
- **前置**：M5-CARD-* ✅ + M5-PAGE-HEADER-01 ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/[type]/page.tsx`（和同构分类页）
  - 新增 `apps/web-next/src/components/video/VideoGrid.tsx`
- **验收**：
  - Grid 消费 `<VideoCard>` 复合组件
  - 切换筛选条件时 TopSlot 按 §11.1-§11.4 做 300ms 接替
  - 返回列表时 ScrollRestoration 定位精确
  - typecheck ✅ / lint ✅ / unit ✅ / e2e（SEARCH/分类页）PASS

### 7.9 M5-PAGE-DETAIL-01 — 详情页重塑

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **建议模型**：claude-sonnet-4-6
- **规模估计**：L（~240 分钟）
- **目标**：按方案 §12.1-§12.5 重塑详情页五部分（Hero / Meta / EpisodePicker / RelatedVideos / Reviews），级联入场 80/160/240/320ms。
- **前置**：M5-CARD-* ✅
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/(video-types)/*/[slug]/page.tsx`（5 个类型详情页）
  - 新增 `apps/web-next/src/components/detail/DetailHero.tsx` / `DetailMeta.tsx` / `EpisodePicker.tsx` 等
  - RelatedVideos 消费 VideoCard 复合组件
  - 详情页 hero → 播放器 Standard Takeover（保留，与 Fast Takeover 并存）
- **验收**：
  - 五部分按 80/160/240/320ms 级联入场
  - "开始播放" 触发 Standard Takeover 360ms
  - EpisodePicker 切集不重新加载页面（state 内化）
  - typecheck ✅ / lint ✅ / unit ✅ / e2e（VIDEO）PASS

### 7.10 M5-PAGE-PLAYER-01 — 播放页重塑

- **所属 SEQ**：SEQ-20260420-M5-PAGE
- **建议模型**：claude-sonnet-4-6
- **规模估计**：L（~240 分钟）
- **目标**：按方案 §13.1-§13.7 重塑播放页（mini 态 PC 320×180 / 移动 56px、full 态影院模式、pip 态原生 PiP 触发 UI）。
- **前置**：M5-CARD-* ✅（因播放页可能回跳列表）
- **文件范围**：
  - 修改 `apps/web-next/src/app/[locale]/_lib/player/GlobalPlayerFullFrame.tsx` / `MiniPlayer.tsx`
  - 新增 `apps/web-next/src/app/[locale]/_lib/player/CinemaMode.tsx`（影院模式遮罩）
  - 重塑 `PlayerShell` 编排逻辑（字幕/线路/影院模式切换 UI）
- **验收**：
  - mini 态 PC 320×180 / 移动底部 56px 悬浮
  - full 态触发影院模式后背景渐暗 600ms
  - pip 态调用浏览器原生 PiP API
  - 所有关键路径（断点续播、线路切换、影院模式、字幕开关）回归 PASS
  - typecheck ✅ / lint ✅ / unit ✅ / e2e（PLAYER）PASS
- **注意事项**：
  - PlayerShell 编排与 core 分离（CLAUDE.md 既有约束）
  - 本卡是 M5 里最后一个核心 PAGE，完成后准备进入 CLOSE 阶段

### 7.11 M5-CLOSE-01 — M5 PHASE COMPLETE + Opus 独立审计

- **所属 SEQ**：SEQ-20260420-M5-CLOSE
- **状态**：⬜ 未开始
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理
- **规模估计**：S（~60 分钟）
- **目标**：对 M5 全部 10 张卡做对齐审计，输出方案对齐表（`docs/milestone_alignment_20260420.md` 风格），签字 ADR-037 迭代版。
- **前置**：M5-PREP-*/CARD-*/PAGE-* 全部 ✅
- **文件范围**：
  - 新增 `docs/milestone_alignment_m5_20260420.md`（或等价命名）：19 项对齐表 + 13 项红旗检查
  - 修改 `docs/decisions.md`：追加 ADR-037 迭代条目或 ADR-047（M5 PHASE COMPLETE 门禁）
  - 修改 `docs/changelog.md`：M5 PHASE COMPLETE 条目
  - 修改 `docs/task-queue.md`：M5 序列全部标 ✅
- **验收**：
  - 对齐表每项标 ✅ 或 ⚠️
  - Opus 子代理独立审计 PASS
  - typecheck ✅ / lint ✅ / unit ✅ / e2e 全通
- **注意事项**：
  - 未经 Opus 审计 PASS **不得**在 task-queue.md 标 ✅（CLAUDE.md 绝对禁止第 16 条）

---

## 8. Token 扩展清单（汇总）

M5-CARD-TAG-01 + M5-CARD-STACK-01 合计新增 Token alias：

**tag 相关（12 项，M5-CARD-TAG-01）**：
```
--tag-lifecycle-new-bg / -fg
--tag-lifecycle-upcoming-bg / -fg
--tag-lifecycle-ongoing-bg / -fg
--tag-lifecycle-ended-bg / -fg
--tag-lifecycle-delisting-bg / -fg
--tag-trending-hot-bg / -fg
--tag-trending-top-week-bg / -fg
--tag-trending-exclusive-bg / -fg
--tag-trending-editor-pick-bg / -fg
--tag-spec-icon-color
--tag-rating-bg / -fg
--tag-border-radius
```

**stack 相关（12 项，M5-CARD-STACK-01）**：
```
--stack-layer-1-offset-x / -y
--stack-layer-2-offset-x / -y
--stack-layer-hover-1-offset-x / -y
--stack-layer-hover-2-offset-x / -y
--stack-layer-opacity-1 / -hover
--stack-layer-opacity-2 / -hover
--stack-transition-duration / -reverse
```

**player transition 相关（M5-CARD-CTA-01）**：
```
--takeover-fast-duration-mobile (200ms)
--takeover-fast-duration-desktop (240ms)
--takeover-standard-duration (360ms)
--takeover-mask-color-fast (rgba-bound Token)
--takeover-mask-color-standard (rgba-bound Token)
--floating-play-button-bg (semi-transparent)
--floating-play-button-fg (on-dark white)
```

---

## 9. 回归检查清单（M5-CLOSE-01 校验）

### 9.1 卡片协议一致性

- [ ] 首页 / 分类页 / 搜索页 / 相关推荐 四处 VideoCard 行为一致
- [ ] 所有 VideoCard 图片区点击均触发 Fast Takeover，文字区均跳详情
- [ ] TagLayer 在所有消费处遵守最多 2 文字标签规则
- [ ] series/anime/tvshow 在所有消费处均显示 StackedPosterFrame

### 9.2 动效一致性

- [ ] Fast Takeover（列表→播放）200/240ms
- [ ] Standard Takeover（详情→播放）360ms（未被本补丁影响）
- [ ] reduced motion 下两种 Takeover 均降级为 120ms opacity
- [ ] StackedPosterFrame hover 时序符合 ADR-046 §5.3

### 9.3 a11y 验证

- [ ] VideoCard 两个 button 独立 aria-label
- [ ] 堆叠阴影 aria-hidden
- [ ] 键盘 Tab 顺序：PosterAction → MetaAction
- [ ] 悬浮播放按钮有 aria-label（桌面）
- [ ] 所有标签对比度 ≥ 4.5:1（含暗色模式）

### 9.4 关键路径回归（PLAYER）

- [ ] 断点续播
- [ ] 线路切换
- [ ] 影院模式
- [ ] 字幕开关
- [ ] mini ↔ full ↔ pip 三态切换
- [ ] Fast Takeover 触发后 GlobalPlayerHost 正确接管

### 9.5 Token 治理

- [ ] 新增 31 个 Token alias 全部走 semantic 层（不在 component 层新增）
- [ ] 未引入硬编码颜色（grep `#[0-9a-f]{3,8}` 零命中于 tag/stack/transition 相关源文件）
- [ ] Token 后台（REG-M1-04 产物）能预览新增 Token

### 9.6 方案文档一致性

- [ ] `docs/frontend_redesign_plan_20260418.md` §9.5 存在且与 ADR-046 §3 一致
- [ ] §16 存在 VideoCard / TagLayer / StackedPosterFrame 三条
- [ ] §19 M5 章节为 PREP/CARD/PAGE/CLOSE 四阶段结构
- [ ] ADR-046 在 `docs/decisions.md` 按编号顺序

---

## 10. 注意事项与风险提示

### 10.1 绝对禁止（强化提醒）

- ❌ **不得在 CLOSE 阶段前扩充 ADR-046**：若 CARD/PAGE 实施中发现 ADR-046 缺漏，报 BLOCKER 停卡 → 回 PREP 阶段修订 ADR。
- ❌ **不得硬编码颜色**：所有 tag / stack / transition 相关样式走 Token。
- ❌ **不得修改 `/watch` URL**：ADR-042 已锁定；Fast Takeover 的跳转目标仍是 `/watch/[slug]?ep=1`。
- ❌ **不得跳过 PREP 阶段**：M5 BLOCKER 明确规定 PREP 未 PASS 前禁启 CARD/PAGE。
- ❌ **不得在 VideoCard 上增加第三个点击区**：图片=播、文字=详情，两个出口是协议定死的；新增意图（如"加入稍后看"）走上下文菜单（长按/右键）。
- ❌ **不得为新标签维度直接改代码**：ADR-046 §4.4 规定新维度走 ADR 变更。
- ❌ **不得让 core 层感知 Fast/Standard Takeover 差异**：差异仅在 shell / transition 层处理，core 保持纯播放职责。

### 10.2 依赖链暴露点

- **embla-carousel**（M5-PAGE-BANNER-01）：**新增依赖风险**。启动该卡前须先 grep 仓库是否已有该依赖；若无，必须先报 BLOCKER 让人工决定，不得自行 `npm install`。
- **后端 tag 字段**（M5-CARD-TAG-01）：`trending` 热度字段可能未计算，前端允许降级为 mock，但必须在 tasks.md 卡片备注中明确列出"已 mock 字段 + 待 M6/M7 补真实数据"。
- **后端 episode 字段**（文字区"全 24 集"）：`videos.episodeCount` 与 `videos.currentEpisode` 字段可能未齐，若缺失须报 BLOCKER，不得在前端用 `|| 0` 静默兜底。

### 10.3 跨里程碑冻结（重写冻结期，CLAUDE.md 约束）

M0-M6 重写冻结期内，本补丁的任何任务卡**不得**接受与三份方案目标无关的新业务需求。若用户在 M5 执行中提出新需求（例如"顺便把播放器字幕增加机器翻译"）→ 一律写 BLOCKER 暂停，等人工决定是否追加到 M5 或转至 M6+。

### 10.4 模型路由纪律

- **M5-PREP-01 / M5-CLOSE-01**：主循环必须 **opus**，且必须 spawn arch-reviewer (claude-opus-4-6) 子代理
- **M5-PREP-02**：主循环可用 sonnet，但必须 spawn **haiku** 子代理做机械回写
- **M5-CARD-* / M5-PAGE-***：主循环 sonnet，不强制子代理
- 所有卡片完成时，记录**主循环模型 ID** + **子代理模型 ID** + **commit trailer** 至 tasks.md 的"执行模型""子代理调用"字段

### 10.5 arch-reviewer 审计要点（M5-CLOSE-01 子代理）

审计必须独立验证以下 5 点：
1. ADR-046 所有决策（§2 交互 / §3 动效 / §4 内容 / §5 多集 / §6 组件）都有对应实装
2. 10 张卡的实际 commit 与卡片"文件范围"无越界
3. 31 个 Token alias 全部落在 semantic 层
4. 关键路径 E2E 回归全绿
5. 方案文档 §9.5/§16/§19 与 ADR-046 条条对应，无漂移

审计结论写进 `docs/milestone_alignment_m5_20260420.md`，签字后才能标 ✅。

---

## 11. 激活机制 — 如何把本补丁接入 `docs/task-queue.md`

### 11.1 追加顺序

1. **M5 BLOCKER 通知**（本补丁 §3）追加到 `docs/task-queue.md` 现有 M5 占位区顶部
2. **10 张卡片**（M5-PREP-01/02 + CARD-* + PAGE-* + CLOSE-01）按 §7 的定义格式依次写入 task-queue.md 的 M5 占位区
3. **SEQ 标注**：四个 SEQ 编号 `SEQ-20260420-M5-PREP` / `-M5-CARD` / `-M5-PAGE` / `-M5-CLOSE`，状态均为 ⬜ 未开始
4. **依赖边标注**：每张卡在状态行之后加一行 `**依赖**：{前置卡列表或"无"}`

### 11.2 激活时机

- 当 Claude Code 主循环会话开工时：
  1. 读 `docs/task-queue.md`，遇到 M5 BLOCKER 通知
  2. 检查 M5-PREP-01 状态，若未开始 → 切换为 **opus** 主循环模型启动 PREP 阶段
  3. PREP 完成 → 继续 CARD 阶段（sonnet）
  4. CARD 完成 → 继续 PAGE 阶段（sonnet）
  5. PAGE 完成 → 切换为 **opus** 启动 CLOSE 阶段

### 11.3 本补丁文件本身的归属

- `docs/task_queue_patch_m5_card_protocol_20260420.md`（本文件）→ `git add` 并纳入版本控制（CLAUDE.md 绝对禁止第 14 条约束）
- `docs/milestone_alignment_m5_20260420.md`（M5-CLOSE-01 产出）→ 纳入版本控制
- `docs/decisions.md` ADR-046 追加（M5-PREP-01 产出）→ 纳入版本控制

---

## 12. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-04-20 | v1.0 | 初稿；锁定决策 M5-A/B/C/D/E；10 张卡定义完成 | 主循环 (claude-opus-4-7) |

---

**END OF PATCH**

本补丁一旦激活（§11.1 步骤 1 完成），M5 阶段执行侧即受 ADR-046 约束。任何在 CARD/PAGE 阶段发现与 ADR-046 结论冲突 → 报 BLOCKER 回 PREP，**严禁绕开 PREP 直接改代码**。
