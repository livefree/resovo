# ADR 补丁清单 — 2026-04-18 前端重构批次

> status: pending-merge
> owner: @engineering
> scope: ADR entries to be appended to `docs/decisions.md`
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18

---

## 1. 目的

本文件汇总 2026-04-18 三份前端规划方案（`design_system_plan_20260418.md` / `frontend_redesign_plan_20260418.md` / `image_pipeline_plan_20260418.md`）中需要沉淀为架构决策记录（ADR）的条目。

目标是让 Claude Code 执行"把 ADR 追加到 `docs/decisions.md`"任务时有明确、格式对齐、编号续接的输入。

## 2. 交付方式

由 Claude Code 在单独一个任务卡内执行：

1. 读取本文件第 4 节的 7 条 ADR 正文
2. 按顺序追加到 `docs/decisions.md` 末尾（在现有 ADR-021 之后）
3. 更新 `docs/decisions.md` frontmatter 的 `last_reviewed` 为 2026-04-18
4. 执行完毕后将本文件移入 `docs/archive/2026Q2/`（quarter 子目录不存在则创建）并更新 `docs/README.md` 的 "活跃方案" 清单：本文件从活跃清单移除，三份规划方案保留

## 3. 编号分配

- 现有最后一条编号条目：`ADR-021`
- 本批次新增：`ADR-022` ~ `ADR-028`，共 7 条
- 命名风格与 `ADR-016` / `ADR-018` 等近期条目保持一致（短标题、冒号分隔）

## 4. ADR 条目正文（按编号顺序）

---

### ADR-022: 设计 Token 单一真源与 Base + Brand 分层模型

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 当前颜色、字号、间距散落在 Tailwind 配置和各组件 class 中，改动需同时 diff 多处，且浅色过白、深色不够精致的根因是 Token 缺失
  - 已确认未来支持多品牌皮肤（形态 A），Token 体系必须从 day 1 支持"基础层 + 品牌层"分层，避免后期反悔重构
  - 用户已明确不使用 Figma，希望在自建后台内集中可视化编辑
- **决策**：
  - 采用 **W3C Design Tokens Community Group** 规范的 JSON 作为所有设计值的单一真源
  - 采用 **Base + Brand 两层** 文件布局：`packages/design-tokens/base.tokens.json` + `packages/design-tokens/brands/<brand>.tokens.json`
  - 基础层内部分 **Primitive / Semantic / Component** 三子层，层间引用单向：Semantic 只能引 Primitive，Component 只能引 Semantic 或 Primitive，禁止反向依赖
  - 每个颜色 Token 的 `$value` 为对象 `{ light, dark }`，双主题单文件存储，避免新增 Token 时漏加深色值
  - 按 **品牌 × 主题** 组合构建独立 CSS 文件（如 `dist/resovo.light.css` / `dist/resovo.dark.css`），运行时只加载当前品牌 × 主题一份
- **理由**：
  - W3C 格式未来接入任何标准工具（Style Dictionary / Tokens Studio 等）零成本
  - 两层分离让新增品牌不碰基础层，合并逻辑清晰
  - 双主题同文件降低"改值时遗漏一套"的错误概率
  - 按组合构建让运行时加载最小，不在一份 CSS 中穷举所有品牌
- **架构约束**：
  - 品牌层禁止直接覆盖 Primitive 层数值；只能覆写 Semantic 引用目标 + Component 个别字段 + 新增 `brand/*` 专属 Token
  - 品牌层允许覆写的 Semantic / Component 字段列入白名单（见 `design_system_plan_20260418.md` 第 4.3 节），白名单外字段要覆盖需走 base 的 PR
  - Token 新增 / 重命名 / 删除只能通过代码 PR，不得由后台编辑功能完成（后台只改值）
  - 基础层 Primitive 子层字段值"种子版本"可由工程师提交，后续由"锁结构 + 种子值 + 迭代收敛"策略在组件接入后 1-2 天内定稿（见 `design_system_plan_20260418.md` 第 4.7 节），定稿时生成 `packages/design-tokens/tokens.lock.json` 锚定所有值
- **影响文件**：`packages/design-tokens/**`、`tailwind.config.ts`、`postcss.config.mjs`、`src/app/layout.tsx`、`src/styles/tokens.css`

---

### ADR-023: Token 消费方式 — CSS 变量 + Tailwind 桥接（不走 CSS-in-JS）

- **日期**：2026-04-18
- **状态**：已采纳
- **决策**：
  - Token 最终以 CSS 自定义属性（CSS 变量）形式暴露给运行时
  - Tailwind 作为工具类基础保留；`tailwind.config.ts` 的 `theme.extend` 从构建产物 `dist/tailwind.tokens.ts` 读取 Token 名称 → CSS 变量映射
  - 组件代码使用 Tailwind 语义类（如 `bg-surface-base`），编译为 `background-color: var(--color-surface-base)`；组件本身品牌无关
  - 运行时主题与品牌切换通过替换 `<link rel="stylesheet">` 的 CSS 文件（或切换 `data-brand` / `data-theme` 属性激活不同作用域），零 JS 成本
- **理由**：
  - CSS-in-JS 方案（Emotion / styled-components）有运行时成本，SSR 水合复杂
  - Tailwind Plugin 方案需要在构建期把 Token 编入类名，失去运行时切换能力
  - CSS 变量 + Tailwind 桥接是零运行时、SSR 友好、切换零 JS 的最佳组合
- **架构约束**：
  - 组件不得硬编码颜色值（已是 CLAUDE.md 绝对禁止项）；同样不得硬编码字号、radius、shadow 等可 Token 化的数值
  - 不得引入 CSS-in-JS 库或 `styled-components` / `emotion` 依赖（违反 CLAUDE.md 技术栈白名单）
  - 新增 Token 时必须同时更新 `dist/tailwind.tokens.ts` 的产出脚本，保证 Tailwind IntelliSense 可用
  - ESLint 规则（后续任务）禁止 `className` 中出现色相硬编码（如 `bg-white` / `bg-gray-900`），强制使用语义 Token 类
- **影响文件**：`tailwind.config.ts`、`postcss.config.mjs`、`src/styles/tokens.css`、`src/components/shared/**`（迁移时涉及）

---

### ADR-024: 主题与品牌上下文正交独立 + SSR 首屏无闪烁

- **日期**：2026-04-18
- **状态**：已采纳
- **决策**：
  - 主题（`light` / `dark` / `system`）与品牌（`resovo` / future brands）是两个正交维度：同品牌可切明暗，同主题可切品牌
  - 主题存储：`localStorage.resovo.theme` + Cookie 同名同值（30 天过期，`SameSite=Lax`），Cookie 不区分品牌（跨品牌主题偏好一致）
  - 品牌识别链（优先级从高到低）：域名映射 → `?brand=` query → Cookie → 默认 `resovo`，由 Next.js middleware 统一执行，识别结果写入 Cookie `resovo.brand`
  - Root Layout Server Component 读取两个 Cookie，设置 `<html data-brand data-theme>` + 动态加载对应 CSS 文件，React tree 首屏即有正确品牌上下文，无水合闪烁
  - 在 `<head>` 注入 blocking inline script（`localStorage` 优先、`matchMedia` 兜底），在任何 CSS 加载前设置 `data-theme`，消除 client-side 首屏闪烁
- **理由**：
  - 主题切换与品牌切换在产品语义上独立（深色模式是用户偏好，品牌是业务维度），强绑定会导致设置冲突与用户困惑
  - 两个维度各自通过 `data-*` 属性激活对应 CSS 作用域，组合数量可控（主题 2 × 品牌 N × 文件 1）
  - Cookie + blocking script 双保障：SSR 场景 Cookie 负责正确首屏 HTML，CSR 场景 blocking script 负责 reload 时无闪烁
- **架构约束**：
  - 任何读取主题状态的代码必须经 `useTheme()` hook（基于 `ThemeContext`），禁止直接读 `localStorage` / `matchMedia`
  - 任何读取品牌状态的代码必须经 `useBrand()` hook（基于 `BrandContext`），禁止在组件内硬编码品牌字符串（如 `'Resovo'`）
  - middleware 中品牌识别失败时回落到默认品牌，不得返回 5xx
  - blocking script 的 JS 代码必须手写最小版本，不依赖任何运行时或 bundler（已在 `design_system_plan_20260418.md` 第 7.3 节给出示例）
  - 主题切换控件形态统一为 Segmented Control 三段（`☀️ 浅 | 🌓 自动 | 🌙 深`），配合 View Transitions API 做圆形扩散过渡
- **影响文件**：`src/middleware.ts`、`src/app/layout.tsx`、`src/components/shared/theme/**`、`src/components/shared/brand/**`、`src/lib/theme/**`、`src/lib/brand/**`

---

### ADR-025: 多品牌架构形态 A 优先 + 运营位品牌隔离

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 用户确认未来会支持多品牌，但本轮只实装单一品牌 Resovo
  - 需要决定"架构做到多大"与"运行时做到多少"
  - 多品牌落地有三种主要形态：同库存同源码多皮肤（A）、单实例多租户（B）、多站点独立数据（C）
- **决策**：
  - **本轮目标形态 A**：所有品牌共享同一内容库存、同一 Next.js 实例、同一套部署，仅在视觉 Token（通过 Brand 层）与运营位配置层面做差异化
  - **架构必须到位的能力**（本轮全部落地）：
    - Token 层 Base + Brand 分层（见 ADR-022）
    - `BrandProvider` 全局上下文与 middleware 品牌识别链（见 ADR-024）
    - Token CSS 按 brand × theme 组合构建
    - 所有"品牌触点"字段（Logo / ICP / 客服 / 社交 / 页脚版权）统一从 `useBrand()` 读取
  - **数据隔离策略**：
    - `videos` / `episodes` / `video_sources` 等内容主表 **不加** `brand_scope` 字段，内容在形态 A 下全站共享
    - 运营位类表（`home_banners` / `home_modules` / `promoted_collections` 等，现存与新增）统一加 `brand_scope` 字段，enum `'brand-specific' | 'all-brands'`，查询 `WHERE (brand_id = ? OR brand_scope = 'all-brands')`
    - 用户偏好 / 历史 / 收藏等账号相关表延后到用户系统上线时再评估
  - **形态 B 的升级路径预留**：未来需要真正多租户隔离时，通过新增 `content_brand_visibility` 关联表（多对多）实现内容层面的品牌可见性控制，不需要给 `videos` 加字段
- **理由**：
  - 形态 A 在单一部署下用最小运行时成本实现多品牌门面，匹配中小团队资源与国际化视频索引站的商业模式
  - 运营位加 `brand_scope` 是品牌化的真正价值点（每个品牌可定义自己的首页推荐），而内容库存共享是"架构到位、实现单一"的前提
  - 内容表不加 `brand_scope` 避免字段冗余 + 降低未来形态 B 的迁移成本
- **架构约束**：
  - 不得在 `videos` / `episodes` / `video_sources` 上添加 `brand_scope` / `brand_id` 字段
  - 所有现存或新增的"运营位类"表必须包含 `brand_scope TEXT NOT NULL CHECK (IN ('brand-specific', 'all-brands'))` 字段；`brand-specific` 需配套 `brand_id` 字段
  - 任何"需要按品牌差异化展示"的组件必须通过 `useBrand()` 读取品牌上下文，禁止在组件内硬编码品牌判断（如 `if (hostname === 'resovo.com')`）
  - 品牌相关业务决策（如是否允许某品牌独享某内容）必须走架构决策扩展，不得在本 ADR 外擅自添加品牌字段
- **影响文件**：`packages/design-tokens/brands/**`、`src/lib/brand/**`、`src/middleware.ts`、`src/api/db/migrations/`（运营位表新增 `brand_scope` 字段的 migration）、`docs/architecture.md`（需同步品牌识别链与数据隔离策略）

---

### ADR-026: 播放器提升至 Root Layout + Zustand 单例 + 三态形态

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 现有播放器挂载在播放页组件树内，离开播放页则卸载，无法实现"App-like 的边看边逛"
  - 用户明确要求"播放器提升到 root layout"以支持路由切换时播放不中断
- **决策**：
  - 播放器宿主 `<GlobalPlayerHost>` 挂在 Root Layout，永久存在于 DOM；通过 portal 目标位置固定渲染
  - 播放状态由 **Zustand 单例 store** 持有（`currentVideo / playbackTime / isPlaying / mode / queue`），不受路由切换影响
  - 三种形态：
    - `full`：全屏 / 影院模式，占视口（播放页与沉浸模式）
    - `mini`：移动端悬浮于底部 Tab Bar 之上（Spotify 模式，56px 高，下滑收起为一行"正在播放"胶囊）；桌面端右下角浮窗（320×180）
    - `pip`：浏览器原生 Picture-in-Picture
  - 形态切换动画：`full ↔ mini` 使用 FLIP（scale + translate，220–360ms）；`mini → close` 淡出 160ms 后卸载音视频源
  - 路由行为：离开播放页默认转 `mini`；再次进入同一视频 `mini → full`；不同视频替换时弹 ConfirmDialog "替换当前播放？"
- **理由**：
  - 播放器不卸载是实现"边看边逛"的前提；Zustand 单例避免 Context re-render 级联
  - Mini 态采用 Spotify 叠加模式（浮于 Tab Bar 之上）是行业公认最佳实践；叠加总高度约 124px 仍留足主内容区，避免"正在播放"与"导航"争夺同一物理区域
  - `<GlobalPlayerHost>` 强制 `'use client'` + `dynamic(..., { ssr: false })` 避免 SSR 水合播放器造成复杂度爆炸；页面本身仍可 SSR，播放器在 hydration 后接管
- **架构约束**：
  - 播放器业务逻辑必须集中在 shell 层（编排字幕 / 线路 / 影院模式等），core 层不写业务逻辑（与 CLAUDE.md 既有约束一致）
  - 任何读取播放状态的代码必须经 `usePlayerStore()`，不得通过 props 自顶向下传递或使用全局变量
  - Mini 态在移动端 `visibilitychange` 时降级码率或只播音频（耗电优化）
  - 播放器关键路径（断点续播 / 线路切换 / 影院模式 / 字幕开关）每次涉及必须完整回归测试
  - z-index 层级通过 Token 约束：`z/pip-player = 80`、`z/modal = 60`、`z/toast = 70`，禁止在组件内硬编码 z-index 值
- **影响文件**：`src/components/player/GlobalPlayerHost.tsx`、`src/stores/playerStore.ts`、`src/app/layout.tsx`、`src/components/player/**`（所有涉及形态切换的子组件）

---

### ADR-027: 页面过渡四分类模型（Sibling / Push / Takeover / Overlay）

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 用户要求网站交互"更像 App，不是传统浏览网页"，需要定义可复用、边界清晰的过渡语法
  - 不同页面关系（平级 / 下钻 / 焦点 / 叠加）若都用一套过渡会失去层级感
- **决策**：
  - 将站内所有页面过渡归入四类，每类有固定语义、缓动曲线、时长区间：
    - **类型 A · 同层平移（Sibling）**：一级页面之间（首页 ↔ 分类 ↔ 搜索），左右滑入滑出 240–300ms
    - **类型 B · 层级下钻（Push + Shared Element）**：列表 → 详情，卡片作为共享元素飞入，其余内容交错淡入 320–420ms
    - **类型 C · 焦点沉浸（Takeover）**：详情 → 播放 / 浅色 ↔ 深色主题切换，圆形扩散或叠透进场 420–520ms
    - **类型 D · 叠加层（Overlay）**：Dialog / BottomSheet / 抽屉，从锚点位置向外展开 200–240ms
  - 技术栈：**View Transitions API 为首选实现**，不支持的浏览器降级为 Framer Motion FLIP 动画
  - 每种过渡的反向动画（返回 / 退出）是正向的镜像，不自行定义新曲线
  - `prefers-reduced-motion` 开启时所有过渡退化为交叉淡入（150ms 内），保留层级提示但降低运动强度
- **理由**：
  - 四分类覆盖站内已规划的所有页面切换场景，不多不少
  - View Transitions API 是 Chrome 111+ / Safari 18+ 标准，未来两年内会覆盖主流浏览器，直接 bet 在标准上成本最低
  - Framer Motion 仅在降级路径使用，避免成为主依赖（和 CLAUDE.md 技术栈约束对齐）
- **架构约束**：
  - 任何新增页面 / 路由必须明确归入四类中的一类，由 `<RouteStack>` 原语统一调度，禁止组件各自实现 transition
  - 过渡时长与缓动曲线从 Token 读取（`motion/duration/*` + `motion/easing/*`），不得硬编码 ms 数值
  - 共享元素过渡需要给源组件和目标组件标注相同的 `data-transition-name` 属性（View Transitions API 约定）
  - 过渡动画完成前禁止触发下一次导航（由 `<RouteStack>` 内部 debounce 实现）
  - 所有包含大运动量的过渡（类型 C）必须在 `prefers-reduced-motion` 下完全退化，测试用例必须覆盖
- **影响文件**：`src/components/shared/transitions/RouteStack.tsx`、`src/lib/motion/**`、`src/app/layout.tsx`、`src/components/shared/shared-element/**`

---

### ADR-028: 图片治理四级降级链 + 入库健康治理

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 现阶段图片主要跟随视频源第三方抓取，画质不佳且不稳定；未来会丰富来源但短期内仍需容忍不可靠的源站
  - 用户接受 **P0 必填 + P1 尽力** 的分级策略；首页若因源站抖动大面积破图是强业务风险
- **决策**：
  - **四级降级链**（按优先级从高到低）：
    1. 真实图片（`poster_url` 等）经 `<SafeImage>` 渲染
    2. BlurHash 占位（30 字节，入库时计算，首屏即可展示）
    3. `<FallbackCover>` 运行时 SVG（品牌调色盘 + video_id 种子 + 类型装饰，确定性生成）
    4. CSS 纯色渐变（极端兜底，覆盖率 100%）
  - **入库治理字段**（`videos` / `episodes` 表扩展，详见 `image_pipeline_plan_20260418.md` 第 5 节）：
    - 每类图片字段成组出现：`*_url / *_blurhash / *_primary_color / *_status / *_source`
    - 状态 enum：`ok | missing | broken | low_quality | pending_review`
  - **新增 `broken_image_events` 表** 记录所有图片健康异常事件（fetch_404 / fetch_5xx / timeout / decode_fail / dimension_too_small / mime_mismatch / aspect_mismatch），支持后台仪表盘聚合
  - **定时 job**：
    - `image_health_check`：每日 03:00 HEAD 请求 + 尺寸 / aspect 校验，异常写 `broken_image_events`
    - `blurhash_and_color_extract`：新入库 / 变更时计算 BlurHash + OKLCH 主色
  - **前端失效上报**：`<SafeImage>` 渲染失败时通过 `navigator.sendBeacon()` 异步上报到专用端点 **`POST /api/internal/image-broken`**（新建，不复用 Sentry）；后端 10 分钟窗口去重（同 session × 同 URL 只记一次）后写入 `broken_image_events`
  - **剧集缩略图本轮纯抓取**，播放器截帧方案延后至 V2（依赖自有视频源或转码中间层）
  - **Logo 透明 PNG**：TMDB `/images/logos` 纳入 `external_metadata_import` 流程，填充已有的 `videos.logo_url / logo_status` 字段
- **理由**：
  - 四级降级确保"任何场景下都不出现空白图片"，这是"现代感 + App-like"观感的底线
  - 专用 beacon 端点与错误监控解耦：图片失效是业务指标（进仪表盘、需聚合、关联 video_id），不是错误日志
  - SVG 样板图采用 Token 驱动（品牌调色盘）+ 确定性 seed（相同 video_id 永远得相同图），兼顾品牌感与可预测性
  - 截帧方案需要 CORS 打通与服务端解码能力，本轮条件不成熟，fallback 链已足够覆盖
- **架构约束**：
  - 所有图片渲染必须经 `<SafeImage>` 组件，禁止直接使用 `<img>` 或裸 `next/image`（除非明确为品牌 Logo / 静态资源等无需治理的图）
  - `poster_url` 为 P0 必填；其他字段为 P1 尽力，但对应 `*_status` 必须写入 enum 值之一，不得为 NULL
  - 前端 beacon 上报必须去重（同一 session × 同 URL 只上报一次），避免上报风暴
  - 健康巡检 job 失败次数连续超过阈值时必须 fail-loudly（触发 BLOCKER），不得静默
  - 禁止将错误日志（Sentry 级）与图片失效事件混在同一张表 / 同一个端点
- **影响文件**：`src/components/shared/image/SafeImage.tsx`、`src/components/shared/image/FallbackCover.tsx`、`src/api/routes/internal/image-broken.ts`、`src/api/services/ImageHealthService.ts`、`src/api/jobs/imageHealthCheck.ts`、`src/api/jobs/blurhashExtract.ts`、`src/api/db/migrations/`（新增 image 字段与 `broken_image_events` 表）、`docs/architecture.md`（Schema 需同步）

---

### ADR-029: 图片分发基础设施 — Cloudflare Images + R2

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 目标用户海外为主，不考虑国内大陆；初期部署 Vercel，稳定后迁移 Cloudflare Pages
  - 图片管线设计了 `ImageLoader` 抽象但未确定具体后端
- **决策**：
  - **CDN 与图片变换**：统一使用 **Cloudflare Images**。Loader 实现基于其 URL 参数约定（`?width=&quality=&format=auto`）；其他候选（imgix / 阿里云 IMG / 自建 imgproxy）若未来需要只需替换 URL 模板
  - **对象存储**：统一使用 **Cloudflare R2**（零出站费用，S3-compatible），通过 `FileStorage` 抽象暴露给业务代码；本地开发使用 **MinIO** 作为 S3-compatible 后端
  - **`next/image` 配置**（Vercel 阶段关键）：
    - `images.loader = 'custom'` + `images.loaderFile = './src/lib/image/loader.ts'`
    - **禁用 Vercel 默认 optimizer**，避免二次变换与多余带宽计费
    - 保留 `next/image` 的 lazy-loading / srcset / priority 调度等原生能力
  - **抓取的第三方图**暂不落盘 R2，直接经 Cloudflare Images 的 "Transform external images" 能力做 fetch-and-transform；运营上传的原图写入 R2 私有 bucket，前端展示时通过同账户 Cloudflare Images 分发
  - **多尺寸策略**：Cloudflare Images 接入后统一走动态参数模式，前端按视口计算 `width`；字段 `poster_url_sm / md / lg` 不再需要
- **理由**：
  - Cloudflare Images + R2 组合在海外为主 + Cloudflare 迁移路径下是最干净的选择：变换、分发、存储同一生态，零出站费匹配图片密集型站点
  - 迁移至 Cloudflare Pages 时一切原生，无代码改动；Vercel 阶段只是把 Cloudflare Images 当外部服务使用
  - Loader 抽象 + FileStorage 抽象确保未来替换 CDN 或存储后端零业务代码改动
- **架构约束**：
  - 业务代码不得直接拼 Cloudflare Images 的 URL，必须经 `loader()` 函数；不得直接调用 R2 SDK，必须经 `FileStorage` 抽象
  - 生产环境 `next.config.ts` 必须使用 `images.loader = 'custom'`，禁止回落到 Vercel 内置 optimizer
  - 运营上传永远走 `FileStorage.put()`，禁止直接写本地磁盘（单机部署同样不得，R2 / MinIO 双后端从 day 1 生效）
  - CI / 测试环境必须使用 MinIO 或内存 mock，不得依赖真实 Cloudflare 账户
  - 未来如需切换 CDN（imgix / 阿里云 / 自建），只改 `cloudflareLoader` 的 URL 拼接规则，业务代码零改动
- **影响文件**：`src/lib/image/loader.ts`、`src/lib/storage/**`、`next.config.ts`、`src/api/services/UploadService.ts`、`docs/architecture.md`（需同步 CDN 与存储方案）

---

## 5. 附录：决策与方案文档映射表

| ADR | 核心决策 | 来源方案 |
|-----|----------|----------|
| ADR-022 | Token 分层模型 + W3C 格式 + 双主题单文件 | `design_system_plan_20260418.md` §4 |
| ADR-023 | CSS 变量 + Tailwind 桥接，不走 CSS-in-JS | `design_system_plan_20260418.md` §6 |
| ADR-024 | 主题与品牌正交独立 + SSR 首屏无闪烁 | `design_system_plan_20260418.md` §7–8 / `frontend_redesign_plan_20260418.md` §5.3 §8 |
| ADR-025 | 多品牌形态 A + 运营位品牌隔离策略 | `frontend_redesign_plan_20260418.md` §5 §21 |
| ADR-026 | 播放器 root 化 + Zustand 单例 + 三态 + Spotify 模式 | `frontend_redesign_plan_20260418.md` §13 §14.1 |
| ADR-027 | 页面过渡四分类 + View Transitions API 首选 | `frontend_redesign_plan_20260418.md` §9 |
| ADR-028 | 图片四级降级链 + 健康治理 + beacon 专用端点 | `image_pipeline_plan_20260418.md` §5–8 §15-I6 |
| ADR-029 | Cloudflare Images + R2 + Loader/Storage 抽象 | `image_pipeline_plan_20260418.md` §10 §15-I1/I2 |

## 6. 执行检查清单（交付 Claude Code）

- [ ] 读取本文件第 4 节所有 ADR 正文
- [ ] 追加至 `docs/decisions.md` 末尾（在现有 ADR-021 之后，保持 `---` 分隔符）
- [ ] 更新 `docs/decisions.md` frontmatter `last_reviewed: 2026-04-18`
- [ ] 新建目录 `docs/archive/2026Q2/`（若不存在）
- [ ] 移动本文件到 `docs/archive/2026Q2/decisions_patch_20260418.md`
- [ ] 从 `docs/README.md` 第 2 节"活跃方案"清单中移除本文件引用（本文件本就未被登记则跳过）
- [ ] `git add` 所有变更并提交，commit message 建议：
  ```
  docs: append ADR-022..029 from 2026-04-18 frontend redesign batch

  - Token layering (ADR-022)
  - CSS vars + Tailwind bridge (ADR-023)
  - Theme/brand orthogonality + SSR no-flash (ADR-024)
  - Multi-brand Form A + ops-slot isolation (ADR-025)
  - Player root-ization + Zustand + Spotify mini (ADR-026)
  - Page transition taxonomy (ADR-027)
  - Image fallback chain + health governance (ADR-028)
  - Cloudflare Images + R2 infra (ADR-029)
  ```

---

## 7. 关联文档

- `docs/decisions.md` — 目标追加文件
- `docs/design_system_plan_20260418.md` — 设计系统与 Token 方案
- `docs/frontend_redesign_plan_20260418.md` — 前端重构方案
- `docs/image_pipeline_plan_20260418.md` — 图片管线方案
- `docs/README.md` — docs 索引（执行后需更新）
