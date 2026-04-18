# 前端重新设计总方案

> status: proposed
> owner: @engineering
> scope: frontend redesign covering layout, navigation, transitions, banner, detail/player pages, multi-brand readiness, and related admin impacts
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18

---

## 1. 背景与动机

Resovo 当前前端已具备基本功能，但整体体验仍是"传统浏览网页"的感觉：页面切换有刷新感、主题切换生硬、移动端与桌面端体验不统一、播放器与页面强绑定导致跨页不连续。

本方案目标是将前端整体重构为**接近原生 App 的体验**，覆盖布局骨架、导航形态、页面过渡、视觉语言、主题切换、播放器持久化、多品牌就绪七个核心维度。

---

## 2. 目标

1. **App 化体验**：跨页面过渡顺滑无缝，减少"刷新/跳转"感。
2. **PC 与移动端一致**：同一设计语言不同形态，不做"两套独立设计"。
3. **视觉现代感**：浅色优先但不过白，纵深感明确，主题切换优雅。
4. **播放器全局化**：播放器提升到 root layout，跨路由保持状态。
5. **多品牌就绪**：架构层支持未来多品牌皮肤，本轮只实装单一品牌。
6. **可扩展基础**：所有设计值通过 Token 管理，组件化复用率提升。

---

## 3. 非目标

1. **用户功能**（登录、收藏、历史、账号）本轮不做，仅为未来留接口。
2. **后台表格模块**不在本次重设范围，继续沿用 `docs/rules/admin-module-template.md`。
3. **不改**后端 API 契约（除 Banner 与设计 Token / 图片治理新增接口外）。
4. **不重写**播放器 core 层，仅在 shell 层和宿主挂载方式上改造。
5. **不实际上线第二个品牌**，只做架构就绪（见第 5 节）。

---

## 4. 设计原则

1. **层级分明的过渡语言**：不同类型的页面切换使用不同的动效语言，让用户潜意识能分辨"我在同层切换"还是"下钻"还是"放大焦点"。
2. **常驻壳 + 变化内容**：页眉、页脚、播放器宿主全局常驻，只有内容区切换。
3. **进慢出快**：进入过渡时间稍长（制造仪式感），退出更快（尊重用户"想回去"的意图）。
4. **移动优先手势，桌面优先精细**：动效分 PC / 移动两套预设。
5. **尊重 `prefers-reduced-motion`**：所有动效必须有降级路径。
6. **Token 驱动**：组件不硬编码颜色、间距、动效值，全部走 CSS 变量。
7. **品牌上下文驱动**：所有品牌元素（Logo、名字、调色板、备案、文案等）走品牌 Token 与 `useBrand()` 上下文，零硬编码，单一组件服务所有品牌。

---

## 5. 多品牌架构原则

Resovo 未来计划支持多品牌皮肤（同一代码库、同一内容库，不同域名呈现不同品牌外观）。本轮前端重设**不**实际上线第二个品牌，但在架构层全部留好扩展边界。推进节奏为"**架构到位，实现单一**"。

### 5.1 目标形态

以"**同源多皮肤**"（形态 A）为默认设计：

- 同一份代码、同一个数据库、同一套视频内容
- 不同域名访问时动态切换：Logo / 名字 / 调色板 / 文案 / 备案信息 / SEO metadata / 样板图品牌元素
- 视频、源站、分类等**内容层**跨品牌共享
- 本轮只实装 Resovo 品牌，其他品牌留待后续

### 5.2 Token 分层

详见 `design_system_plan_20260418.md` 第 4 节：

- `base`：所有站点通用的结构性 Token（间距、圆角、动效、字号刻度等）
- `brands/<brand>`：品牌特定 Token（Logo、名字、主色、字体、文案、备案、社交链接等）
- `theme`：浅 / 深模式，在前两层之上叠加

运行时最终 Token = `base` + `brand` + `theme`，按当前品牌和主题合并。

### 5.3 品牌识别与上下文传递

**识别链**（Next.js middleware 层，按优先级）：

1. 域名映射（生产主路径，查表 `{ host → brandId }`）
2. Query 参数 `?brand=xxx`（开发预览）
3. Cookie（QA 调试）
4. 默认兜底（识别不到使用 `default` = Resovo）

**传递**：根布局挂载 `<BrandProvider>`，所有组件通过 `useBrand()` 读取品牌信息。SSR 时 middleware 注入 header / cookie，保证首屏 Token CSS 和品牌上下文一致。

### 5.4 数据隔离策略

- **全局共享**（不加 `brand_id`）：`videos` / `episodes` / `sources` / 类型标签等内容治理表
- **按品牌隔离**（加 `brand_id`）：`home_banners` / 未来的用户/合集等运营层实体
- 品牌配置优先存 `brands/*.tokens.json`（Git 友好、零运行时开销）；只有"运营后台动态创建品牌"时才上 DB

### 5.5 对本轮实现的约束

**做**：

- Token 分层结构（`base.tokens.json` + `brands/resovo.tokens.json`）
- `<BrandProvider>` + `useBrand()` primitive
- middleware 品牌识别链（默认命中 `resovo`）
- Header / Footer / Banner / Metadata / 样板图 **全部**走品牌上下文，零硬编码
- `home_banners` 表预留 `brand_id` 字段（默认 `resovo`）
- 设计系统后台预留品牌切换器 UI 位（本轮可灰态占位）

**不做**：

- 第二个品牌的实际 Token 值
- `/admin/brands` 品牌管理后台
- 多域名 DNS / 证书配置
- 按品牌权限分级
- 账号体系的品牌隔离（用户功能整体暂缓）

### 5.6 未来扩展路径

新增一个品牌 = `brands/xxx.tokens.json` + DNS 映射 + middleware 配置条目。其余代码零改动。如果后续走"形态 B（多租户白牌）"，在内容表上加 `brand_scope` 字段做可见性过滤即可。

---

## 6. 全局骨架

Root layout 持久化 **三件套 + 一个容器**：

- **Header**（全局页眉）
- **Footer**（全局页脚）
- **GlobalPlayerHost**（全局播放器宿主，详见第 13 节）
- **MainSlot**（唯一会变的主内容容器）

所有路由切换本质上只替换 MainSlot 内容。Header/Footer 不重渲染、不闪烁。

**关键约束**：

- 页面组件禁止自己再包装一层外壳
- Header/Footer 只订阅必要全局状态（当前路由、主题、品牌、播放器态），避免被无关变化触发重渲染
- SSR 首屏的 Header/Footer 与后续 CSR 渲染必须完全一致，避免 hydration 闪烁
- `<BrandProvider>` 和 `<ThemeProvider>` 挂在 root，所有子树可用

---

## 7. 页眉页脚

### 7.1 页眉结构

```
┌────────────────────────────────────────────────────────────┐
│ Logo   电影 剧集 动漫 综艺 纪录片 [更多▾]      🔍  🌓    │
└────────────────────────────────────────────────────────────┘
```

- 左：Logo（从 `useBrand()` 读取，点击回首页）
- 中：主分类（最多 5 个常驻）+ 折叠的"更多"
- 右：搜索按钮 + 主题切换 + 未来的用户入口位

### 7.2 PC 端"更多" hover 展开

- Hover 进入触发器 **120ms** 后展开（防误触）
- 展开为 **Mega Menu** 分栏面板，含所有子分类 + 右侧推荐封面位
- 鼠标离开后 **240ms** 收起，触发器与面板间保留 8px 不可见缓冲三角
- 展开动效：`opacity 0→1` + `translateY 8→0` + `scale 0.98→1`，220ms
- 键盘可达：Tab 聚焦 + Enter 展开，Esc 关闭
- 点击触发器 = 锁定展开，再次点击收起

### 7.3 移动端页眉

- Logo + 搜索按钮（右上）+ 主题切换（右上）
- 主分类以横向可滚动 pill chips 呈现（显示 3–4 个，可左右滑看全部）
- "更多"点击 → BottomSheet 全分类面板
- 向下滚动超 80px：页眉紧缩（隐藏 Logo 文字只留图标），向上滚立即恢复

### 7.4 页脚

- 全局统一布局，内容从 `useBrand()` 读取：品牌信息、友情链接、ICP 备案、版权声明、RSS/Sitemap 入口
- 移动端简化：仅保留备案与版权；友情链接折叠到"更多"
- 不参与任何路由动效，始终静止

---

## 8. 主题策略

详细方案见 `design_system_plan_20260418.md`，此处摘要：

- **浅色优先**，但 `surface/base` 不使用纯白（采用 `oklch(97% 0.005 250)` 级别的冷中性灰）
- 卡片 `surface/elevated-1` 比背景略亮 + 极淡 border，形成纵深
- 三态切换：`☀️ 浅 | 🌓 自动 | 🌙 深`，Segmented Control 形态
- 切换使用 View Transitions API **圆形扩散过渡**，约 480ms
- 首屏无闪烁：blocking inline script + Cookie 双保险
- 系统主题变更监听（`system` 态时即时响应）
- 主题叠加在品牌 Token 之上生效（同一品牌的浅/深色由该品牌 Token 提供）

---

## 9. 页面类型与过渡分层

按**视觉关系**将站内所有页面切换分为 4 类，每类使用独立的动效语言。

### 9.1 类型 A：同层平移（Sibling）

**场景**：首页 ↔ 电影 ↔ 剧集 ↔ 动漫 ↔ 综艺 ↔ 纪录片 ↔ 搜索结果页。

**视觉**：

- Header / Footer 不动
- TopSlot（首页 Banner / 分类页筛选栏）做位置接替（详见第 11 节）
- 视频网格交叉淡入：旧 `opacity 1→0` 120ms，新 `opacity 0→1` 160ms，重叠 60ms
- PC 端新网格 stagger fade（每张 15ms，总 ≤ 270ms）；移动端整体 fade

**滚动位置**：

- 新进入：从顶部开始渲染（不是跳跃）
- 返回已访问：恢复离开时的 `scrollY`

### 9.2 类型 B：层级下钻（Push + Shared Element）

**场景**：列表/网格卡片 → 视频详情页。

**视觉**：

- 被点击的海报卡做 **FLIP 动画**放大到详情页顶部大海报位置（240–280ms）
- 详情页其他内容（标题、简介、剧集）从下方 `translateY 16→0` + fade，延迟 80ms
- 列表页保留 DOM（`display: none` 或离屏），返回时避免重渲
- Header/Footer 不动

**关键要求**：

- 卡片封面与详情页大海报**必须同图源** URL（分辨率可不同），否则 FLIP 过程会闪烁
- 两处共享 BlurHash 占位符
- 具体图片策略详见 `image_pipeline_plan_20260418.md`

**返回**：

- 反向 FLIP 回原卡片位置
- 其他内容 fade out 比海报回归快（160ms vs 200ms）
- 自动恢复列表 scrollY 到原卡片附近（精调：jump + IntersectionObserver 校准）

### 9.3 类型 C：焦点沉浸（Takeover）

**场景**：详情页 → 播放页 / 详情页内直接启播。

**视觉**：

- 播放器容器（详情页内预置占位）**scale + translate 放大铺满视口**，360ms
- 同时叠加 `rgba(0,0,0,0.9)` 深色遮罩从 0→1（300ms），盖住周围
- Header/Footer 只做 fade out（不做 slide，避免视觉"跑"感）
- 控制条、字幕选择器延迟 100ms 淡入

**退出**：

- 播放器缩回原占位区 220ms（快于进入）
- 遮罩 fade out 180ms
- Header/Footer fade in
- 播放状态不中断（全局 store 持久化）

**与 Push 的区别**：Push 语言是"位移"，Takeover 语言是"缩放 + 盖住"。

### 9.4 类型 D：叠加层（Overlay）

**场景**：搜索层、筛选 sheet、主题切换圆形扩散、未来的登录/设置。

**视觉**：

- 不触发路由（URL 可更新 query，但不 push）
- 底层内容保留 DOM + 状态 + 滚动位置
- 移动端：BottomSheet 上推（240ms spring），底层微缩 0.98 + 变暗
- 桌面端：Dialog 中心弹 + 背景 `backdrop-filter: blur(12px)`

**共同**：Esc 关闭、点背景关闭、移动端下拉关闭。

---

## 10. 首页 Banner 设计

当前 Banner 是单条"最新置顶视频"。本次改为**多视频循环轮播**。

### 10.1 PC 端（≥ lg）

- **尺寸**：宽度 100%，高度 `min(520px, 60vh)`，底部 16px 渐变过渡到背景
- **结构**：
  - 全幅背景（backdrop 横版大图）
  - 左下信息区：标题、tagline、类型标签、CTA 按钮（"立即观看" + "加入收藏"占位）
  - 右下进度条式指示器（类 Instagram Story）
  - 右上音效切换（若视频预告接入）
- **切换**：
  - 背景交叉淡入 1.2s + 轻 Ken Burns（缩放 1.05→1，6s）
  - 文字旧内容上滑 + fade out（200ms），新内容从下滑入 + fade in（240ms，延迟 120ms）
- **节奏**：自动轮播 6–8s，hover 暂停
- **键盘**：← → 切换，空格暂停
- **主色染色**（亮点）：每张 banner 预提取主色 → 注入 `--banner-accent` → 整页主题色微染，切换时 1s color transition；主色提取在图片入库阶段完成（详见 `image_pipeline_plan_20260418.md`）
- **数量**：3–5 条

### 10.2 移动端（< lg）

- **尺寸**：宽度 100%，比例固定 5:6 或 4:5，不占满屏
- **结构**：海报背景 + 底部信息条 + 小尺寸 CTA
- **切换**：横向 swipe + snap 吸附（建议 `embla-carousel-react`，3kb）
- **指示器**：底部点状，当前项加粗加长
- **自动轮播默认关闭**；第一次 swipe 后永久停止
- **不做**：Ken Burns、主色染色（性能考虑）
- **入场**：仅 fade in，不做 translate（避免 CLS）

### 10.3 数据来源与后台影响

**当前状态**：Banner 后端逻辑为"最新 N 个已发布视频自动填充"，无专门表或管理 UI。

**改动方向：自动 + 运营置顶混合（选项 B）**

- 新增表 `home_banners`：`video_id` / `priority` / `start_at` / `end_at` / `enabled` / `brand_id`（多品牌预留，本轮默认 `resovo`）
- 接口：`GET /api/banners` 先按当前品牌过滤，再取运营置顶（按 `priority`），不足 N 条用最新自动补齐
- 后台：新增"首页 Banner 管理"模块
  - 列出当前运营置顶（可拖拽排序）
  - 搜索 + 选择视频加入
  - 时间窗控制（start_at / end_at，支持定时自动上下线）
  - 预览面板（立即看到 Banner 实际渲染）
  - 沿用 `ModernDataTable + ColumnSettingsPanel + SelectionActionBar + PaginationV2`
- DB schema 变更需同步 `docs/architecture.md`

---

## 11. 首页 ↔ 分类页 "顶部接替" 过渡

这是本次重设最微妙的过渡之一。首页有 Banner，分类页只有筛选栏——直接 crossfade 会让布局跳动。

### 11.1 核心思路

定义一个固定位置的 `<TopSlot>` 容器（位于 Header 下方、视频网格上方）。首页时渲染 Banner，分类页时渲染筛选栏，切换时对 **TopSlot 的高度 + 内容** 做联动变换。

### 11.2 时间线（首页 → 分类页，约 300ms）

- **0–80ms**：Banner 内部信息 fade out（文字先走，图片稍后）
- **80–220ms**：TopSlot 高度 520→96，Banner 图像 fade out，筛选栏从上滑入 + fade in
- **220–300ms**：筛选栏的 chips 依次入场（stagger 20ms）

### 11.3 反向（分类页 → 首页）

- 筛选栏先 fade out
- TopSlot 高度扩展
- Banner 图片先铺底 fade in，文字/CTA 延迟 120ms 入场

### 11.4 技术要点

- 不用 CSS `height transition`（会触发 layout thrashing）
- 用 View Transitions API 或 FLIP，transform 伪装高度变化
- 切换期间锁定页面滚动，避免跑位
- 下方视频网格自然被推移位置（flex/grid 子项），不需单独处理

---

## 12. 视频详情页

### 12.1 结构

```
┌────────────────────────────────────────────────────┐
│ [大海报横版背景 + 暗渐变]                          │
│   [封面竖版]  [标题]                               │
│                [副标题/年份/评分/时长/类型]        │
│                [简介 3 行折叠]                     │
│                [主 CTA: 立即播放]  [次 CTA: 收藏]  │
├────────────────────────────────────────────────────┤
│ 剧集选择（如果是剧/动漫/综艺）                      │
│ ├─ 分季 Tab（如适用）                              │
│ └─ 剧集网格（每集缩略图 + 集号 + 时长 + 已看进度） │
├────────────────────────────────────────────────────┤
│ 演员/导演（横滑卡片）                               │
├────────────────────────────────────────────────────┤
│ 相关推荐（视频网格）                                │
└────────────────────────────────────────────────────┘
```

### 12.2 进入（从列表下钻）

见第 9.2 节。关键：海报 FLIP + 内容入场。

### 12.3 内容入场节奏

- 大海报背景：FLIP 到位后立即显示（已在过程中显示）
- 竖封面 + 标题：延迟 80ms，fade + 8px 上滑
- 简介 + CTA：延迟 160ms
- 剧集列表：延迟 240ms，stagger
- 演员 / 推荐：延迟 320ms，或等滚动到视口再加载（lazy）

### 12.4 播放按钮

- 点击触发 **类型 C（Takeover）过渡**到播放态
- 播放器容器在详情页预置一个占位（在海报区域内）
- Takeover 放大这个占位到全屏

### 12.5 剧集切换

- 同一视频内切集：不重建播放器，调用 `playVideo(videoId, episodeId)` action
- 视觉：当前集高亮 + 进度条归零 + 轻微 pulse
- 不入浏览器历史栈

---

## 13. 视频播放页 + 播放器 root 化

### 13.1 URL 设计

- 详情页：`/video/[id]`
- 播放页：`/video/[id]/play`（可选 `?ep=xxx`）
- 这样浏览器返回栈天然正确

### 13.2 全局播放器宿主

在 root layout 挂载 `<GlobalPlayerHost>`：

- 基于 Zustand 单例 store 持有状态（`currentVideo / playbackTime / isPlaying / mode / queue`）
- 播放器 DOM 永远挂在根节点的 portal 目标位置
- `position: fixed` + CSS transform 控制三种形态：
  - **full**：全屏 / 影院模式，占视口
  - **mini**：移动端悬浮于 Tab Bar 之上（Spotify 模式，56px 高，左封面右控件，下滑收起为一行"正在播放"胶囊）；桌面端右下角（320×180）
  - **pip**：浏览器原生 Picture-in-Picture

### 13.3 形态切换

- `full ↔ mini`：FLIP（scale + translate），220–360ms
- `mini → close`：淡出 160ms 后卸载音视频源
- 路由切换触发：离开播放页默认转 `mini`；再次进入同一视频 `mini → full`
- 不同视频替换：弹 ConfirmDialog "替换当前播放？"

### 13.4 SSR 与加载

- `<GlobalPlayerHost>` 强制 `'use client'` + `dynamic(..., { ssr: false })`
- 详情页/播放页本身可以 SSR；播放器在 hydration 后接管

### 13.5 z-index 层级

定义在 Token 中：

- `z/pip-player = 80`
- `z/modal = 60`
- `z/toast = 70`
- → PiP 播放器压过 Modal 下方但低于 Toast

### 13.6 性能与耗电

- mini 态在移动端 `visibilitychange` 时降级码率或只播音频
- 多 tab 协同（BroadcastChannel，延后做）

### 13.7 播放页布局（全屏态）

- 中心：视频画面
- 底部：控制条（进度 / 播放暂停 / 音量 / 倍速 / 全屏 / PiP / 字幕 / 线路 / 剧集）
- 右侧（桌面）：剧集选择侧栏（可收起）
- 移动端控制条：双层——主控制 + 滑动呼出的线路/字幕/剧集抽屉
- 手势层：左右滑进度 / 上下滑音量亮度 / 双击暂停 / 长按倍速

---

## 14. 移动端导航详细

### 14.1 底部 Tab Bar

- **三个 Tab（本轮）**：`首页 / 分类 / 搜索`，中央"搜索" Tab 图标略放大营造 CTA 感
- **用户功能上线后**：扩展为四个 Tab，追加 `我的`（收藏/历史/设置）
- 形态：玻璃拟态 + `safe-area-inset-bottom`
- 当前 Tab：图标 fill 态 + 轻向上弹（10px spring）
- 点击当前 Tab = 回顶部（iOS 标准行为）
- 长按 Tab 二级快捷菜单（延后）
- Mini Player 叠加策略：按 13.3 定义，浮于 Tab Bar 之上不替换其位置

### 14.2 搜索入口

- **移动端**：搜索作为底部 Tab 三格之一，点击直接进入搜索页，不再使用顶栏圆形按钮
- **桌面端**：页眉右侧圆形搜索按钮，点击 → 圆 shrink → 扩散铺屏 → 输入框从中心浮现 + 唤键盘，总 250ms，关闭反向

### 14.3 分类导航的自动折叠

- 初始：完整显示分类条（H≈44）
- 向下滚动超 80px：上滑隐藏，只留 "当前分类名 + 箭头" 贴顶（H≈32）
- 向上滚任意距离：立即展开
- 点击"当前分类名"：弹 BottomSheet 全量分类选择器

### 14.4 返回手势

- 左侧边缘 20px 内 `touchstart` → 实时 transform 主内容区
- 阈值（宽度 30% 或速度 > X）完成返回，否则弹回
- 封装为 `<RouteStack>` 原语

---

## 15. 交互细节

### 15.1 滚动位置恢复

- 同层切换：每路由记忆 `scrollY`（sessionStorage）
- 下钻 → 返回：保存 `{scrollY, 最后可见卡片 id}`，返回时 jump + IntersectionObserver 校准
- 失去精度的兜底：至少保证不会回到顶

### 15.2 预取策略

- PC 卡片 hover 150ms 后预取详情 JSON（API 支持 stale-while-revalidate）
- 移动端：视口内卡片 InView + idleCallback 批量预取下一屏轻量数据
- 搜索：输入停顿 250ms 预取结果
- **不**预取大图；路由切换时才按优先级请求

### 15.3 加载态三档

- **< 100ms**：不显示任何 loading
- **100ms – 800ms**：骨架屏
- **> 800ms**：骨架 + 顶部细进度条（YouTube 风）
- **> 5s**：骨架中心提示"加载较慢"

时间门槛 Token 化：`motion/loading-threshold-*`

### 15.4 骨架几何精度

- 骨架形状逐像素匹配实际内容布局
- 每种骨架作为对应组件的 `.Skeleton` 子组件，共享布局 CSS

### 15.5 Reduced Motion

全局 token 层处理：

- `transform / scale` 动画 → 改纯 opacity
- Shared element FLIP → 交叉淡入
- Banner Ken Burns → 静止
- Route transitions → 瞬时切换

### 15.6 动效双预设

- **PC preset**（`motion/desktop/*`）：hover 精细态、FLIP、Ken Burns、视差、光标跟随
- **移动 preset**（`motion/mobile/*`）：`:active` 按下态、slide-from-right 堆栈、手势优先、禁用重 blur

---

## 16. 组件清单

详见上轮讨论的完整清单。落地原则：

1. **基础原子层**（`components/ui/`）：Button、Input、Chip、Sheet、Dialog、Tabs、Toast、Skeleton、Tooltip、Popover、Switch、Segmented、Progress、...
2. **领域组合层**（`components/shared/`）：PosterCard、BackdropCard、EpisodeCard、VideoListRow、FilterBar、FilterSheet、SearchBar、SuggestList、Banner、BannerCarousel、TopNavBar、BottomTabBar、GlobalPlayerHost、MiniPlayer、SafeImage、FallbackCover、...
3. **体验 primitive**（`components/shared/primitives/` 或 `lib/`）：PageTransition、SharedElement、RouteStack、ScrollRestoration、LazyImage、PrefetchOnHover、PullToRefresh、SwipeBack、LongPressMenu、KeyboardShortcuts、ThemeProvider、BrandProvider、I18nProvider

迁移顺序：体验 primitive → 基础原子 → 领域组合。

---

## 17. 图片管线

详细方案见 `image_pipeline_plan_20260418.md`。核心要点：

- 每个视频必需一张**权威竖封面（2:3）**作为 P0 保底
- 推荐补充横版 Backdrop（16:9）、剧集缩略图、Logo 等 P1/P2 图片
- 采用"**强制 P0 + 尽力 P1**"策略：新视频入库竖封面必填，其他类型缺失不阻塞发布
- 四级降级链：真实图 → BlurHash 占位 → `<FallbackCover>` 样板图 → CSS 渐变兜底
- 样板图系统：SVG 运行时生成，品牌 Token 驱动，零硬编码
- BlurHash / 主色 / 健康状态在入库阶段一并产出
- CDN 接入为**未来项**：当前不做 CDN 适配，但接口层（自定义 loader、CSV 参数约定）预留好边界，未来接入零代码改动
- 后台新增图片健康度监控 + 样板图预览页

---

## 18. 后台影响

本次前端重设涉及以下后台模块改动：

### 18.1 新增模块

- **首页 Banner 管理**（见第 10.3 节）：新表 + 管理页
- **设计系统 Token 编辑**（见 `design_system_plan_20260418.md`）：`/admin/design-system`
- **图片健康监控**（见 `image_pipeline_plan_20260418.md`）：Dashboard 卡片 + 破损图列表
- **样板图预览**（见 `image_pipeline_plan_20260418.md`）：`/admin/fallback-preview`

### 18.2 潜在改动

- 视频编辑页：需要支持上传 / 管理多类图片（见第 17 节），可能新增字段
- 视频列表：需展示"是否作为 Banner"标记 + "图片健康状态"角标
- 后台顶部预留品牌切换器 UI 位（本轮灰态，第二个品牌上线时激活）

### 18.3 不动的模块

- 源站管理、源健康、审核台、采集任务等核心治理模块不在本次范围

---

## 19. 里程碑拆分

### M1：基础设施（预计 2–3 个任务卡）

- Design Tokens 分层结构与构建管线（见 `design_system_plan_20260418.md` 任务 1）
- 主题切换三态 + 首屏无闪烁（任务 2）
- Token 编辑后台（任务 3）

### M2：品牌上下文与全局骨架（预计 3–4 个任务卡）

- `<BrandProvider>` + `useBrand()` + middleware 识别链
- Root layout 重构 + Header/Footer 常驻化 + 品牌上下文接入
- `<RouteStack>` + 滚动位置恢复
- PageTransition + SharedElement 原语
- LazyImage + BlurHash 支持
- `<SafeImage>` + `<FallbackCover>` 组件

### M3：播放器 root 化（预计 2 个任务卡）

- GlobalPlayerHost + Zustand store
- mini / full / pip 三态切换 + FLIP 过渡
- 相关 ADR 写入 `docs/decisions.md`

### M4：图片治理（预计 2–3 个任务卡）

- 图片健康检查 job + `broken_image_events` 表 + `poster_status` 字段
- `<SafeImage>` + `<FallbackCover>` 全站替换 `<img>` / `next/image`
- 图片健康 Dashboard + 样板图预览后台

### M5：页面重制（预计 4–5 个任务卡）

- Header 重做（hover 展开、滚动紧缩）
- Footer 重做
- 首页 Banner（含后台管理模块 + 多品牌字段）
- 分类页 + 筛选栏 + TopSlot 接替过渡
- 详情页 + Push 过渡
- 播放页 + Takeover 过渡

### M6：CDN 预备（预计 1 个任务卡，不实施对接）

- 定义 `next/image` 自定义 loader 接口
- 图片 URL 约定：`{src}?w=&h=&q=&fm=`（CDN 无关的参数约定）
- 本地 / 构建时图处理管线（短期方案）

### M7：收尾（预计 2 个任务卡）

- ESLint 禁止硬编码色相类名
- 视觉回归测试接入
- 移除残余硬编码与旧组件

总计约 **16–20 个任务卡**，视具体拆分。

---

## 20. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 播放器 root 化改动影响断点续播等关键路径 | 写 ADR + 关键路径 E2E 全量回归 |
| View Transitions API 浏览器兼容性 | 降级为 CSS transition，polyfill 仅桌面新版 Chrome/Safari |
| Banner 主色染色在暗色封面下失真 | 预提取时做亮度阈值检查，失真封面跳过染色 |
| 多图片类型上架成本陡增 | 分阶段强制要求（竖封面 P0 必填，其余 P1/P2/P3 可选），运营侧配合 |
| 过渡动效在低端机卡顿 | 按 `devicememory` / `hardwareconcurrency` 运行时降级 |
| 多品牌接口预留过度导致架构复杂化 | 本轮只做 Token 分层 + `<BrandProvider>`，其余实际功能延后 |
| 图片源站失稳造成首页大面积破图 | 四级降级链 + 图片健康巡检 job + `poster_status` 字段精确筛选 |

---

## 21. 已决策（2026-04-18）

以下原"待定问题"在本次规划讨论中全部落定，作为 Claude Code 执行时的固定输入。CDN 选型、部署路径、多品牌边界一并锁定。

**F1 · 移动端 Tab Bar 数量**

- 决议：本轮做 **3 个 Tab**——`首页 / 分类 / 搜索`；用户功能上线后扩展为 4 个（追加 `我的`）
- 理由：2 Tab 布局视觉偏稀疏，不"App-like"；搜索作为一级入口成本低、收益高；与"搜索按钮最小化为按钮"决策的实质是一致的——搜索不再走顶栏浮按钮，而是成为一级 Tab
- 影响章节：14.1、14.2

**F2 · Mini Player 与 Tab Bar 叠放关系**

- 决议：**Spotify 模式**——Mini Player 浮于 Tab Bar 之上，高 56px；下滑收起为一行"正在播放"胶囊
- 理由：行业最成熟的范式；叠加总高度约 124px 仍留足主内容区；避免"正在播放"与"导航"争夺同一物理区域
- 影响章节：13.3、14.1

**F3 · CDN 选型**

- 决议：**Cloudflare Images + R2**，贯穿两个部署阶段
- 阶段 1（Vercel 期）：Cloudflare Images 作为外部图片服务，`next/image` 的 loader 替换为 Cloudflare Images 的 delivery URL 模板；禁用 Vercel 内置 optimizer 避免二次处理与计费
- 阶段 2（Cloudflare Pages 期）：一切原生，零代码改动
- 理由：目标用户海外为主 + 计划迁移到 Cloudflare；R2 零出站费匹配图片密集型站点；与已设计的 `ImageLoader` 抽象零距离
- 影响章节：17、M6；详见 `image_pipeline_plan_20260418.md` 的 Loader 契约章节

**F4 · 用户自定义主题色**

- 决议：**V2 延后**；走"品牌预设选一套"方向（Discord / VS Code 模式），不做自由调色
- 理由：Token 结构已允许 CSS 变量运行时覆写，V2 落地成本低；自由调色与品牌视觉一致性冲突
- 影响章节：8

**F5 · 跨品牌 Banner 共享策略**

- 决议：**默认品牌隔离 + `brand_scope = 'all-brands'` 白名单**
- 实现：`home_banners.brand_scope` enum `'brand-specific' | 'all-brands'`；查询 `WHERE brand_id = ? OR brand_scope = 'all-brands'`
- 理由：既支持平台级大事件一键触达，又保留细分运营的品牌化
- 影响章节：5.4、10.3

**F6 · content 表 brand_scope**

- 决议：**content 表不加 brand_scope**；运营位类表（`home_banners` / `home_modules` / `promoted_collections`）本轮统一加 `brand_scope`
- 理由：形态 A 下内容全站共享是架构前提；未来形态 B 的真正解法是引入 `content_brand_visibility` 关联表（多对多），不是给 content 加字段；现在只需给运营位预留品牌边界
- 影响章节：5.4

---

---

## 22. 关联文档

- 设计系统与 Token 管理方案：`docs/design_system_plan_20260418.md`
- 图片管线与样板图系统：`docs/image_pipeline_plan_20260418.md`
- 架构：`docs/architecture.md`（播放器 root 化、Banner 表、图片治理字段需同步）
- 架构决策：`docs/decisions.md`（需追加多条 ADR）
- UI 规范：`docs/rules/ui-rules.md`（迁移完成后补充）
- 后台模板：`docs/rules/admin-module-template.md`（Banner 管理模块沿用）
