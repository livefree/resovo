# Resovo (流光) 前台 UI 重构方案计划

> status: archived
> owner: @engineering
> scope: frontend ui implementation execution plan
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

旨在将当前 MVP 基础呈现升级为具有高度「现代科技极简风 (Modern Tech Minimalist)」及一致性的高级流媒体 UI。

## User Review Required

> [!IMPORTANT]
> 针对本次重构，有以下 3 个决策点需要你的指示：
>
> 1. **动画方案**：为了保证性能与代码可维护性，对于下拉菜单 (Dropdown)、卡片浮现等过渡动画，推荐使用纯 `Tailwind CSS Transitions` (原生性能好、零依赖)，你是否同意？还是倾向于引入 `framer-motion` 类库 (效果最极致但增加打包体积)？
> 2. **Auth (登录/注册) 页面背景**：推荐使用极简流媒体风格（背景为剧集海报拼接并做高斯模糊 + 局部暗角）。你是否赞同？
> 3. **「更多」分类收纳**：默认将 “首页、电影、电视剧、动漫” 放外层，“综艺、短剧、纪录片等” 收入 `<Dropdown>`，这个切分点（4 个外露 + 其余收起）是否符合您的期望？

## Proposed Changes

### Global Variables & Theme

统一调整 [src/app/globals.css](file:///Users/livefree/projects/resovo/src/app/globals.css) 和 `tailwind.config.ts` 中的背景高光、柔和阴影 (`box-shadow`) 定义，实现低饱和度、高对比度的高级深色模式 (Cyber/Glassmorphism)。

### 1. Header & Navigation

#### [MODIFY] [Nav.tsx](file:///Users/livefree/projects/resovo/src/components/layout/Nav.tsx)

- 引入或补充简单的 Headless 机制实现具备流畅出入场动画的 Dropdown Component，用于包裹次级分类。
- 增加当前路由对应的强光束（Accent）底边高亮。

### 2. Video Card Component

#### [MODIFY] [VideoCard.tsx](file:///Users/livefree/projects/resovo/src/components/video/VideoCard.tsx)

#### [MODIFY] [VideoCardWide.tsx](file:///Users/livefree/projects/resovo/src/components/video/VideoCardWide.tsx)

- 针对 `group-hover`，添加浮层覆盖方式渲染播放圆钮。
- onClick 区域分离：点击播放圆钮进入 `/watch?ep=1`，点击其它区域进入 `/detail`。

### 3. Auth Pages

#### [MODIFY] [LoginForm.tsx](file:///Users/livefree/projects/resovo/src/components/auth/LoginForm.tsx)

#### [MODIFY] [RegisterForm.tsx](file:///Users/livefree/projects/resovo/src/components/auth/RegisterForm.tsx)

#### [MODIFY] [page.tsx](file:///Users/livefree/projects/resovo/src/app/[locale]/auth/login/page.tsx)

- 重置最外层 wrapper 为 `min-h-screen flex items-center justify-center`。
- Login Form 更改为毛玻璃面板 `bg-black/50 backdrop-blur-md border border-white/10`。

### 4. Watch Page (Player)

#### [MODIFY] [PlayerShell.tsx](file:///Users/livefree/projects/resovo/src/components/player/PlayerShell.tsx)

- 将视频标题和剧集信息上提至 `VideoPlayer` 同级上方。
- `SourceBar` 连同新的选集列表迁移至 `data-testid="player-side-panel"` 区块。
- 确保在「剧场模式 (Theater Mode)」下右侧面板能平滑隐藏。

### 5. Detail & Browse Pages

#### [MODIFY] [VideoDetailHero.tsx](file:///Users/livefree/projects/resovo/src/components/video/VideoDetailHero.tsx)

- 修改目前的横向平铺布局为“左侧海报 + 右侧详情描述 (IMDB 占比风格)”。
- 加大 `[第一集立即播放]` 按钮的视觉权重以便快速触发。

## Verification Plan

### Automated Tests

- 回归运行 `npm run preflight:e2e` 以验证 DOM 结构变更（如 Play Button Overlay 的注入和 Player Shell 的节点平移）未影响自动化搜寻。如有错误，同步对齐 Playwright tests 里的 assert 定位器。
- `npm run lint` & `npm run typecheck` 验证基础类型与组件组合的连通性。

### Manual Verification

1. 热更新下的感官验收：检查各类悬浮特效 (Cards Hover, 导航粘滞) 等转场过渡的流畅度。
2. 试播闭环测试：自首页点击某集卡片的 PlayIcon → 进入 Watch 页 → 观看布局是否完全展示标题于顶部，选集换源面板于右侧。
3. 退出并进入 `/auth/login` 查验深色科技感毛玻璃样式是否按预期覆盖。
