1. 顶部导航 (Nav.tsx)

> status: reference
> owner: @engineering
> scope: frontend ui compatibility assessment
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

   现状兼容度：90%
   分析：目前你已经实现了基于 flex 的响应式布局，左侧分类、右侧工具栏（搜索、暗黑模式切换、多语言、用户态）应有尽有，并且已经实现了 backdrop-blur 和基于 CSS 变量的背景色。
   升级动作：
   目前分类（全网、电影、剧集、动漫、综艺）是平铺排列，由于屏幕宽度的限制，我们需要把“综艺”以及未来可能的“纪录片”从平铺中剥离，封装成一个 Hover 展开的「更多」Dropdown 菜单。
   左侧分类加上「首页 (Home)」的显式高亮入口，更符合传统认知。
2. 首页排版 (/(home)/page.tsx) & 视频卡片 (

VideoCard.tsx
)
现状兼容度：95%
分析：首页目前已经正确使用了 HeroBanner 以及带有 layout="scroll" 的 VideoGrid，这就是标准的横向泳道（Swimlanes）设计！
升级动作：
首页本身的布局几乎不动。
核心改造点在

VideoCard.tsx
：目前的逻辑是点击整个卡片跳转到详情页（/movie/[slug]）。我们需要在卡片组件内加入一层黑色的半透明 Hover 蒙版遮罩。当鼠标悬停时，居中浮现一个亮眼的 [▶ 播放] 按钮图标，点击此图标直接路由到 /watch/[slug]?ep=1，实现你要求的降低播放点击成本的要求。3. 播放页布局结构 (

PlayerShell.tsx
)
现状兼容度：60% (这是差别最大、最需要调整的页面)
分析：
优点：已经实现了出色的响应式分栏（左侧 player-main，右侧 player-side-panel 并在剧场模式下巧妙折叠收起）。
差异：
标题位置：当前代码中视频标题 [video.title] 放在了播放器的正下方。按照我们 YouTube Style 的设计，需要将它提升到播放器容器上方。
源面板位置：当前的 SourceBar 是紧紧贴在播放器下方的。
选集逻辑：当前选集是直接传递 episodes 给 YTPlayer 让他内部处理。
升级动作：
将 SourceBar（换源）组件和集数按钮列表从左侧主区全部迁移至 player-side-panel（右侧面板）。采用 Tab 切换（推荐 / 选集换源）或上下分离结构，这样用户在看右边时一目了然。4. 浏览和搜索页 (/browse/page.tsx & /search/page.tsx)
现状兼容度：100%
分析：根据依赖和日志来看，分类和搜索分别使用了 FilterArea 和 FilterBar，只要底层的基础 UI 组件调优后（例如全局调整边框线颜色 --border 变得更淡、玻璃阴影更柔和），页面的骨架无需任何结构性调整，顺滑过度。
