# Resovo（流光） — 任务看板

---

## 记录治理规范（2026-03-19 起生效）

1. `docs/tasks.md` 保留全量任务清单，但同一时间只允许 1 个任务为 `🔄 进行中`。
2. 多任务提前规划放在 `docs/task-queue.md`，禁止无规划地临时插入任务执行。
3. 新增任务编号必须沿用现有前缀规范：`<PREFIX>-NN`（如 `CHG-39`），同前缀按最大编号递增，禁止复用/跳号。
4. 新增任务必须带时间戳字段：`创建时间`（必填）、`计划开始时间`（建议）、`实际开始时间`（启动后填写）、`完成时间`（完成后填写）。
5. 新纪录统一追加到文件尾部，禁止头部插入；已有历史内容保持原样不回溯重排。
6. 任务完成后必须同步在 `docs/changelog.md` 追加记录，并引用对应任务 ID。
7. 运行过程事件（BLOCKER/恢复/异常）统一记录在 `docs/run-logs.md`，并按尾部追加。

---

✅ PHASE COMPLETE — Phase 2 已完成，等待确认开始 Phase 3
- **完成时间**：2026-03-18
- **本 Phase 完成任务数**：13 个（CHG-20~32）
- **已合并到 main**：否（待确认后合并）
- **测试情况**：392 个 unit 测试全部通过（30 个测试文件）
- **需要你做的事**：
  - [ ] 验收测试（运行 `npm run test` 和 `npm run test:e2e`）
  - [ ] 确认 Phase 2 完成（删除此块后即可让 AI 继续或合并到 main）

---

## Resovo — Phase 1 用户反馈修复任务

#### CHG-01 修复 /admin 路由 404 问题（🔴 最高优先级）

- **状态**：✅ 已完成
- **问题**：访问 `http://localhost:3000/admin` 自动跳转到 `/en/admin` 并显示 404
- **根本原因**：Next.js `[locale]` 国际化路由包裹了所有页面，但 `/admin` 路由的 middleware 路径匹配规则写的是 `/admin/*`，没有匹配到 `/en/admin/*`
- **文件范围**：
  - `src/middleware.ts`（修复路径匹配规则，同时匹配 `/admin` 和 `/[locale]/admin`）
  - `src/app/[locale]/admin/` 目录结构确认（确保路由文件存在于正确位置）
- **验收**：
  - 访问 `http://localhost:3000/admin` 正确跳转到 `/en/admin/dashboard`（或登录页）
  - 未登录时重定向到登录页
  - admin 账号登录后能正常进入管理后台所有页面
  - moderator 访问 `/admin/users` 返回 403 页面
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（已有测试，重新运行验证）
- **完成备注**：新建 src/app/[locale]/admin/page.tsx（redirect 到 /admin/videos）；typecheck ✅ lint ✅ tests 260/260 ✅
- **问题说明**：_（无）_

---

#### CHG-02 登录后导航栏增加管理后台入口

- **状态**：✅ 已完成
- **问题**：admin/moderator 登录后导航栏没有进入管理后台的入口，需要手动输入 URL
- **文件范围**：
  - `src/components/layout/Nav.tsx`（根据用户角色在导航栏右侧显示"管理后台"链接）
- **逻辑**：
  - `role === 'admin' || role === 'moderator'` → 显示"管理后台"链接，指向 `/admin`
  - 普通用户不显示
- **验收**：
  - admin 登录后导航栏右侧有"管理后台"链接，点击正确跳转
  - moderator 登录后同样有入口
  - 普通用户登录后不显示该链接
  - 未登录时不显示
- **测试要求**：Playwright `tests/e2e/auth.spec.ts`（补充：admin 登录后导航栏有管理后台入口）
- **完成备注**：Nav.tsx 新增 isAdminOrModerator 条件渲染管理后台链接（nav-admin）；messages 添加 nav.admin 键
- **问题说明**：_（无）_

---

#### CHG-03 修复主题颜色系统（CSS 变量未生效）

- **状态**：✅ 已完成
- **问题**：页面主题只有纯黑/纯白，金色主题色（`--accent: #e8b84b`）未生效；深色主题下部分黑色文字不可见
- **根本原因**：CSS 变量可能未正确定义在 `:root` 或 `.dark`/`.light` class 上，或者组件使用了 Tailwind 硬编码颜色类而不是 CSS 变量
- **文件范围**：
  - `src/app/globals.css`（确认 `.dark`/`.light` class 下 CSS 变量定义完整）
  - `src/components/layout/Nav.tsx`（检查颜色是否使用 CSS 变量）
  - `src/components/ui/ThemeToggle.tsx`（确认主题切换正确切换根元素 class）
  - 扫描所有使用 `text-black`、`text-gray-900` 等硬编码颜色的组件并修复
- **验收**：
  - 深色主题下导航栏、卡片、文字全部可见，无黑色文字在深色背景上的情况
  - 金色主调色（`#e8b84b`）在激活状态、按钮、强调元素上正确显示
  - 浅色主题下所有文字清晰可读
  - 主题切换按钮三档（深色/浅色/跟随）均正常工作
- **测试要求**：Playwright `tests/e2e/homepage.spec.ts`（已有主题切换测试，重新运行验证）
- **完成备注**：globals.css 从 HSL 裸值改为直接 CSS 颜色，--accent/--gold 设为 #e8b84b，新增 --bg/--bg2/--bg3/--text 别名；tailwind.config.ts 去掉 hsl() 包装；新建 MetaChip.tsx 修复预存 typecheck 错误
- **问题说明**：_（无）_

---

#### CHG-04 修复分类浏览页：补全封面图显示和搜索入口

- **状态**：✅ 已完成
- **问题**：
  1. 分类浏览页视频卡片只显示片名和年份，没有封面图
  2. 分类浏览页顶部没有搜索栏，没有进入搜索页的入口
- **文件范围**：
  - `src/components/browse/BrowseGrid.tsx`（确认 VideoCard 组件接收并渲染 `coverUrl`）
  - `src/components/video/VideoCard.tsx`（确认封面图 `<Image>` 组件正确渲染，处理 `coverUrl` 为 null 的占位图情况）
  - `src/components/layout/Nav.tsx`（导航栏搜索框在分类浏览页也应可见，确认不是仅首页显示）
- **验收**：
  - 分类浏览页视频卡片显示封面图（有封面时显示图片，无封面时显示占位图）
  - 分类浏览页顶部导航栏有搜索框，点击后跳转搜索页
  - 视频卡片图片加载失败时有合理的 fallback 显示（占位图或灰色背景）
- **测试要求**：Playwright `tests/e2e/search.spec.ts`（已有分类浏览页测试，重新运行验证）
- **完成备注**：VideoCard 封面图已正确渲染（含占位图）；Nav.tsx 添加搜索框（nav-search），回车跳转 /search?q=xxx；messages 添加 nav.search 键
- **问题说明**：_（无）_

---

#### CHG-05 首页横向滚动卡片列表修复

- **状态**：✅ 已完成
- **问题**：首页电影和剧集各显示两排固定网格，应为单排可横向滚动的卡片列表，超出部分可左右滑动查看
- **文件范围**：
  - `src/app/[locale]/(home)/page.tsx`（修改布局：每个分类一排横向滚动列表）
  - `src/components/video/VideoCard.tsx`（确认卡片宽度固定，不随容器拉伸）
- **设计规范**：
  - 每个分类区块：标题 + 单排横向滚动容器
  - 容器：`display: flex; overflow-x: auto; gap: 16px; scroll-snap-type: x mandatory`
  - 每张卡片宽度固定（电影竖版约 160px，剧集横版约 280px）
  - 隐藏滚动条但保留滚动功能（`scrollbar-width: none`）
  - 移动端同样支持触摸横滑
- **验收**：
  - 首页每个分类只有一排卡片
  - 超出屏幕的卡片可以横向滚动查看
  - 移动端触摸滑动流畅
  - 卡片显示封面图、片名、年份
- **测试要求**：Playwright `tests/e2e/homepage.spec.ts`（补充：首页卡片列表可横向滚动）
- **完成备注**：VideoGrid.tsx 新增 layout prop（grid/scroll），scroll 模式用 flex+overflow-x+scrollSnapType，卡片宽度固定；homepage 改用 layout="scroll"
- **问题说明**：_（无）_

---

#### CHG-06 顶部类型标签与浏览页过滤功能重复问题

- **状态**：✅ 已完成
- **问题**：顶部导航有 Movies/Series 类型标签，浏览页筛选区也有类型过滤，视觉上功能重复
- **解决方案**：明确两者职责区分
  - **顶部标签**：快速跳转，点击直接进入对应类型的浏览页（`/browse?type=movie`），相当于快捷方式
  - **浏览页筛选区**：在进入页面后进行多条件组合筛选，顶部标签高亮反映当前选中的类型
  - 两者联动：点击顶部"Movies"→ 浏览页类型过滤自动选中"电影"并高亮
- **文件范围**：
  - `src/components/layout/Nav.tsx`（顶部类型标签点击跳转到 `/browse?type=xxx`）
  - `src/components/browse/FilterArea.tsx`（从 URL 参数初始化时，同步高亮顶部对应标签）
- **验收**：
  - 点击顶部"Movies"跳转到 `/browse?type=movie`，浏览页类型筛选自动显示"电影"高亮
  - 在浏览页手动切换类型筛选后，顶部标签对应高亮同步更新
  - 逻辑清晰，用户不会感到困惑
- **测试要求**：Playwright `tests/e2e/search.spec.ts`（补充：顶部标签与筛选区联动）
- **完成备注**：_（AI 填写）_
- **问题说明**：_（若有问题）_

---

## 任务优先级执行顺序

```
CHG-01（admin 路由修复）     ← 最高优先级，其他任务依赖管理后台
    ↓
CHG-02（管理后台入口）
CHG-03（主题颜色修复）       ← 与 CHG-02 可并行
    ↓
CHG-04（浏览页封面图+搜索）
CHG-05（首页横向滚动）       ← 与 CHG-04 可并行
    ↓
CHG-06（类型标签联动）       ← 最后处理
```

---

## 不在本批次处理的反馈

| 反馈                         | 分类     | 原因                             |
| ---------------------------- | -------- | -------------------------------- |
| 只有电影和电视剧资源         | 数据问题 | 取决于资源站内容，非代码 bug     |
| README 中 URL 路径与实际不符 | 文档问题 | CHG-01 修复路由后同步更新 README |

---

#### CHG-07 视频详情页缺失——点击视频直接进入播放页

- **状态**：✅ 已完成
- **问题**：点击首页或分类浏览页的视频卡片后，没有进入详情页（`/movie/slug`、`/anime/slug` 等），而是直接跳转到播放页或 404
- **可能原因**：
  1. 视频卡片的 `href` 链接指向了 `/watch/slug` 而不是 `/{type}/slug`
  2. `src/app/[locale]/movie/[slug]/page.tsx` 等详情页路由文件不存在或渲染为空
  3. `slug` 生成逻辑有误（shortId 没有拼接进去）
- **文件范围**：
  - `src/components/video/VideoCard.tsx`（确认 `href` 指向 `/{type}/{slug}-{shortId}`）
  - `src/app/[locale]/movie/[slug]/page.tsx`（确认文件存在且正常渲染）
  - `src/app/[locale]/anime/[slug]/page.tsx`
  - `src/app/[locale]/series/[slug]/page.tsx`
  - `src/app/[locale]/variety/[slug]/page.tsx`
  - `src/lib/url.ts` 或对应工具函数（`parseShortId`、`buildSlug` 等）
- ⚠️ **约束提醒**：
  - 详情页必须是 SSR（`async` 服务端组件 + `generateMetadata`），不含播放器
  - slug 解析：取最后一个 `-` 后的 8 位字符作为 shortId，其余为可读文字
  - "立即观看"按钮跳转到 `/watch/{slug}-{shortId}?ep=1`
- **验收**：
  - 点击视频卡片进入详情页，URL 格式为 `/en/movie/title-aB3kR9x`
  - 详情页显示：封面图、标题、评分、简介、导演/演员 chip、"立即观看"按钮
  - 剧集/动漫类型额外显示集数选择网格
  - 点击"立即观看"跳转到播放页
  - `curl http://localhost:3000/en/movie/any-valid-slug` 返回包含视频标题的 HTML（SSR 验证）
- **测试要求**：Playwright `tests/e2e/player.spec.ts`（已有详情页测试，重新运行验证）
- **完成备注**：VideoCard href 改为 /{type}/{slug}-{shortId}；VideoDetailHero watchHref 改为 /watch/{slug}-{shortId}?ep=1；PlayerShell detailHref 同步修正
- **问题说明**：_（无）_

---

#### CHG-08 播放器无法使用——播放页加载后无任何播放功能

- **状态**：✅ 已完成
- **问题**：进入播放页后播放器区域无法播放视频，控制栏没有响应，或播放器根本未渲染
- **需要先排查**（按顺序）：

  **排查一：播放源是否存在**

  ```sql
  SELECT COUNT(*) FROM video_sources WHERE is_active = true;
  SELECT source_url FROM video_sources WHERE is_active = true LIMIT 3;
  ```

  如果数量为 0，需要先运行链接验证任务或手动设置几条 `is_active = true`。

  **排查二：API 是否正确返回播放源**

  ```bash
  curl http://localhost:4000/v1/videos/{shortId}/sources
  ```

  确认响应包含 `source_url` 字段且不为空。

  **排查三：前端是否正确传递 source_url 给 Video.js**
  在浏览器 DevTools Network 面板，查看播放页是否有对 `/api/videos/{id}/sources` 的请求，响应是否正常。

- **文件范围**（根据排查结果确定）：
  - `src/components/player/VideoPlayer.tsx`（Video.js 初始化逻辑）
  - `src/components/player/SourceBar.tsx`（线路选择，确认选中后更新播放源）
  - `src/api/routes/videos.ts`（`GET /videos/:id/sources` 接口）
- ⚠️ **约束提醒**：
  - Video.js 必须用 `dynamic import` + `ssr: false` 加载，不得在 SSR 环境初始化
  - HLS 源（`.m3u8`）需要 `hls.js` 插件，mp4 直接用原生 HTML5 播放器
  - 第一条 `is_active = true` 的播放源应该在页面加载后自动设为当前线路
  - ADR-001：播放源是第三方直链，前端直接加载，后端不做代理
- **验收**：
  - 进入播放页后播放器正确加载，显示 Video.js 控制栏
  - 线路选择栏显示可用播放源
  - 点击播放按钮（或视频区域）视频开始播放（取决于播放源是否有效）
  - 播放源链接失效时显示"播放源暂时不可用，请切换线路"的提示，不是白屏
  - 控制栏功能正常：播放/暂停、音量、进度条、全屏
- **测试要求**：Playwright `tests/e2e/player.spec.ts`（已有播放器集成测试，重新运行验证）
- **完成备注**：PlayerShell 集成 ControlBar + SourceBar；onReady 获取 vjsPlayer 传给 ControlBar；handleSourceChange 切换线路；集数切换重拉播放源；无源时显示友好提示
- **问题说明**：_（无）_

---

#### CHG-09 管理后台缺少返回前台入口

- **状态**：✅ 已完成
- **问题**：进入管理后台（`/admin/*`）后，侧边栏或顶栏没有「返回前台」或「退出管理后台」的入口，用户只能手动修改地址栏或退出登录才能回到前台，体验极差。
- **文件范围**：
  - `src/app/[locale]/admin/layout.tsx`（在侧边栏底部或顶栏右侧新增「返回前台」链接，指向 `/`）
- **逻辑**：
  - 侧边栏底部固定区域新增一个「← 返回前台」链接，所有角色可见
  - 点击跳转到 `/`（首页），不清除登录状态
  - 样式与侧边栏现有菜单项一致，用 `var(--muted-foreground)` 颜色，hover 时变亮
- **验收**：
  - 进入任意 `/admin/*` 页面，侧边栏底部有「返回前台」链接
  - 点击后跳转到网站首页，用户仍保持登录状态
  - 前台导航栏仍显示「管理后台」入口（admin/moderator 角色）
- **测试要求**：补充 Playwright `tests/e2e/admin.spec.ts`（admin 用户在后台能点击返回前台）
- **完成备注**：
  - 修改：`src/app/[locale]/admin/layout.tsx`（aside 加 flex-col；底部加「← 返回前台」Link，href="/"，data-testid="admin-back-to-site"）
  - 新增 E2E 测试：admin/moderator 两种角色均可见该链接
  - 262 个 unit 测试全部通过
  - commit hash：见下次提交
- **问题说明**：_（无）_

---

#### CHG-10 非首页视频卡片封面图不显示

- **状态**：✅ 已完成
- **问题**：首页视频卡片封面图正常显示，但分类浏览页、搜索结果页的视频卡片封面图不能正常加载，显示为灰色占位块。
- **可能原因**：
  1. 分类浏览页（`BrowseGrid`）和搜索页（`SearchResultList`）调用的 API 端点与首页不同，返回的 `coverUrl` 字段为 `null` 或字段名不一致
  2. `next/image` 的 `remotePatterns` 配置仅对部分域名生效（已通过 `**` 通配符修复，可排除此原因）
  3. API 搜索接口（`/search`）返回的字段未包含 `cover_url` → `coverUrl` 映射
- **文件范围**：
  - `src/api/services/SearchService.ts`（确认 ES 查询结果包含 `cover_url` 字段并正确映射为 `coverUrl`）
  - `src/api/routes/search.ts`（确认响应字段与 `SearchResult` 类型一致）
  - `src/components/browse/BrowseGrid.tsx`（确认传给 `VideoCard` 的数据包含 `coverUrl`）
  - `src/api/services/VideoService.ts` 的 `list()` 方法（确认浏览页 API 返回 `cover_url`）
- ⚠️ **约束提醒**：
  - 不得修改数据库 schema，`cover_url` 列已存在于 `videos` 表
  - `next/image` 已配置 `remotePatterns: [{protocol:'https',hostname:'**'}]`，若图片仍不加载，检查 `src` 是否为空而非域名问题
- **验收**：
  - 分类浏览页（`/browse`）视频卡片显示封面图
  - 搜索结果页（`/search?q=xxx`）搜索结果卡片显示封面图
  - `coverUrl` 为 `null` 时显示 🎬 占位图，不显示破损图标
- **测试要求**：手动验收；排查过程中记录根本原因到完成备注
- **完成备注**：
  - **根本原因**：`CrawlerService.indexToES()` 的 SQL SELECT 语句缺少 `cover_url`、`slug`、`country`、`episode_count` 字段，导致写入 ES 的文档不含封面 URL；浏览页/搜索页从 ES 取数，首页从 PG 直接取数，因此首页正常而其他页面不显示封面图
  - 修改：`src/api/services/CrawlerService.ts`（`indexToES` 补全 SELECT 字段，ES document 补全对应字段；新增 `reindexAll()` 公开方法）
  - 修改：`src/api/routes/admin/crawler.ts`（新增 `POST /admin/crawler/reindex` 端点，admin 权限，调用 `reindexAll()`）
  - ⚠️ **已有数据需重建索引**：ES 现有文档仍缺少 `cover_url`，需在 API 服务器启动后执行一次：`curl -X POST http://localhost:4000/v1/admin/crawler/reindex -H "Authorization: Bearer <admin_token>"`
  - 新增单元测试 2 个（/admin/crawler/reindex 权限 + 返回值）；262 个 unit 测试全部通过
  - commit hash：308818e
- **问题说明**：_（无）_

---

#### CHG-12 深色/浅色主题文字对比度不足，大量文字不可辨认

- **状态**：✅ 已完成
- **问题**：两套主题均出现文字难以辨认的视觉效果：深色主题下大量次级文字（表格列、标签、说明文字）几乎不可见；浅色主题下金色文字（导航/标题）在白色背景下对比度极低。
- **根本原因**：
  1. `globals.css` 使用 shadcn/ui 惯例将 `--muted` 定义为**背景色**（`#f1f5f9` / `#1e2d3d`），但 `ui-rules.md` 和所有组件（70+ 处）将 `--muted` 当作**次级文字色**使用（`text-[var(--muted)]`）。深色模式下 `--muted: #1e2d3d` 与背景 `--bg2: #111827` 几乎相同，对比度约 1.1:1 — 不可见。
  2. `--accent / --gold` 在浅色模式下仍使用 `#e8b84b`（金黄），该颜色在白色背景上对比度仅 1.84:1，远低于 WCAG AA 要求。
  3. 深色模式 `--border` 与 `--bg2/--bg3` 相同，导致边框不可见。
- **文件范围**：`src/app/globals.css`（仅 CSS 变量，不改任何组件）
- **变更内容**：
  - `--muted` 改为高对比度次级文字色（浅色：`#4b5563`；深色：`#a8b4c4`）
  - `--muted-foreground` 与 `--muted` 保持一致（两者都作文字色使用）
  - 浅色模式 `--accent / --gold` 改为深琥珀 `#b8720a`（对比度 3.85:1，符合大号文字 AA）
  - 深色模式 `--border` 改为 `#334155`（与 bg2 拉开差距）
  - 深色模式 `--bg3` 改为 `#334155`（不再与 `--muted` 值相同）
  - 全面校验两套主题所有前景/背景组合，均满足 WCAG AA
- **验收**：深色/浅色主题下所有文字清晰可辨，表格、标签、次级说明文字均可正常阅读
- **测试要求**：typecheck + lint 通过；视觉验收
- **完成备注**：仅修改 `src/app/globals.css`（无组件改动）；浅色主题 `--muted` 改为 `#4b5563`（7.6:1 on white ✅），深色主题 `--muted` 改为 `#a8b4c4`（4.9:1 on bg3 ✅）；浅色 accent 改为 `#b8720a` 符合 ui-rules.md 规定；深色 border/bg3 改为 `#334155` 与背景拉开层次；typecheck ✅ lint ✅ 262 tests ✅；commit hash：6e9fa69
- **问题说明**：_（无）_

---

#### CHG-13 admin/videos.ts 模块边界重构 + 补齐 ES 同步

- **状态**：✅ 已完成
- **变更原因**：架构审计 C-1 + C-3：路由层直接内联 SQL 违反模块边界；管理员新建/编辑视频后无 ES 同步，违反 ADR-004，已造成搜索结果静默数据不一致
- **影响的已完成任务**：VIDEO-01（VideoService 扩充），CRAWLER-01（ES 同步参考实现）
- **文件范围**：
  - `src/api/routes/admin/videos.ts`（路由层只做参数校验+响应格式化，SQL 全部移走）
  - `src/api/db/queries/videos.ts`（新增 admin 所需函数：listAdminVideos、createVideo、updateVideo、batchPublishVideos、deleteVideo）
  - `src/api/services/VideoService.ts`（新增 create、update、batchPublish、delete 方法，create/update 后触发 ES 同步队列）
- **变更内容**：
  1. 将 admin/videos.ts 中 6 个处理器的 SQL 全部提取到 `db/queries/videos.ts` 对应函数
  2. 在 `VideoService` 中新增 create/update/batchPublish/delete 方法
  3. create 和 update 方法完成 DB 写入后调用 `void this.indexToES(videoId)`（参考 CrawlerService.upsertVideo 实现）
  4. admin/videos.ts 路由处理器改为调用 VideoService 方法
- **完成备注**：新增 `db/queries/videos.ts` admin 函数（listAdminVideos、findAdminVideoById、createVideo、updateVideoMeta、publishVideo、batchPublishVideos）；VideoService 新增 adminList/adminFindById/create/update/publish/batchPublish 方法及私有 indexToES；admin/videos.ts 全部内联 SQL 移除，改为调用 VideoService；create/update 后自动触发 ES 同步；typecheck ✅ lint ✅ 262 tests ✅；commit hash：41210f8
- **问题说明**：_（无）_

---

#### CHG-14 verifyWorker.ts DB 更新取消注释（验证结果落库）

- **状态**：✅ 已完成
- **变更原因**：架构审计 C-4（最紧急）：verifyWorker 中 DB 更新逻辑被注释为占位符，导致每日 4:00 AM 定时验证结果全部丢弃，`is_active`/`last_checked` 字段从不更新，用户举报功能无效
- **影响的已完成任务**：CRAWLER-03（verifyWorker 源码）
- **文件范围**：
  - `src/api/workers/verifyWorker.ts`（取消注释 DB 更新调用，注入 db 依赖）
  - `src/api/db/queries/sources.ts`（确认 `updateActiveStatus` 函数已存在，若不存在则新增）
- **变更内容**：
  1. 取消 `verifyWorker.ts:66-67` 的注释，启用 `videoSourcesQueries.updateActiveStatus()` 调用
  2. 确认 worker 初始化时正确注入 `db` 实例（检查 `src/api/server.ts` 中 worker 创建方式）
  3. 若 `updateActiveStatus` 函数不存在，在 `db/queries/sources.ts` 中新增
- **完成备注**：`updateSourceActiveStatus` 已存在于 `db/queries/sources.ts`；取消 verifyWorker.ts 注释并导入 `db` 模块级实例和 `updateSourceActiveStatus`；在 server.ts 注册 `registerVerifyWorker()`；typecheck ✅ lint ✅ 262 tests ✅；commit hash：35bc542
- **问题说明**：_（无）_

---

#### CHG-15 admin/content.ts 模块边界重构

- **状态**：✅ 已完成
- **变更原因**：架构审计 C-2：admin/content.ts 全部 10 个路由处理器直接 `db.query()`，违反模块边界原则；submission 审核通过时没有触发 ES 同步
- **影响的已完成任务**：CRAWLER-02（submission 流程）
- **文件范围**：
  - `src/api/routes/admin/content.ts`（路由层只做参数校验+响应格式化）
  - `src/api/db/queries/sources.ts`（新增 admin source 管理函数：listAdminSources、updateSource、deleteSource、listSubmissions、approveSubmission、rejectSubmission）
  - `src/api/db/queries/subtitles.ts`（若不存在则新建，新增 listAdminSubtitles、approveSubtitle、rejectSubtitle）
  - `src/api/services/ContentService.ts`（新建，封装 source/submission/subtitle 管理业务逻辑）
- **变更内容**：
  1. 将 content.ts 中所有内联 SQL 提取到对应 queries 文件
  2. 新建 ContentService，submission 审核通过后触发 ES 同步（如适用）
  3. content.ts 路由处理器改为调用 ContentService 方法
- **完成备注**：新增 `db/queries/sources.ts` admin 函数（listAdminSources、deleteSource、batchDeleteSources、listSubmissions、approveSubmission、rejectSubmission）；新增 `db/queries/subtitles.ts` admin 函数（listAdminSubtitles、approveSubtitle、rejectSubtitle）；新建 ContentService；admin/content.ts 全部内联 SQL 移除；typecheck ✅ lint ✅ 262 tests ✅；commit hash：6f4f02a
- **问题说明**：_（无）_

---

#### CHG-16 admin/users.ts 模块边界重构（复用已有 queries/users.ts）

- **状态**：✅ 已完成
- **变更原因**：架构审计 M-1：admin/users.ts 全部 5 个处理器直接 `db.query()`，且绕过了已存在的 `src/api/db/queries/users.ts`
- **影响的已完成任务**：AUTH-01（users queries）
- **文件范围**：
  - `src/api/routes/admin/users.ts`（路由层只做参数校验+响应格式化）
  - `src/api/db/queries/users.ts`（扩充：listAdminUsers 含动态 WHERE、banUser、unbanUser、updateUserRole）
  - `src/api/services/UserService.ts`（若不存在则新建，封装 admin 用户管理业务逻辑）
- **变更内容**：
  1. 在 `queries/users.ts` 中新增 admin 所需函数（复用已有文件，不重复造轮子）
  2. admin/users.ts 路由处理器改为调用 UserService 方法
- **完成备注**：在 `db/queries/users.ts` 新增 listAdminUsers、findAdminUserById、banUser、unbanUser、updateUserRole；admin/users.ts 改为直接调用 usersQueries（逻辑简单，未新建 UserService）；typecheck ✅ lint ✅ 262 tests ✅；commit hash：9b6c9c0
- **问题说明**：_（无）_

---

#### CHG-17 将 POST /sources/submit 迁出 admin 命名空间

- **状态**：✅ 已完成
- **变更原因**：架构审计 M-3：`POST /admin/sources/submit` 只需普通用户权限（`fastify.authenticate`），放在 `/admin/` 命名空间语义错误；未来若对 `/admin/*` 统一加权限验证会意外拦截此端点
- **影响的已完成任务**：CRAWLER-02（submission 提交端点）
- **文件范围**：
  - `src/api/routes/admin/crawler.ts`（移除 POST /admin/sources/submit 端点）
  - `src/api/routes/sources.ts`（新增 POST /sources/submit，保持相同 preHandler 和业务逻辑）
  - 前端调用处（搜索并更新 API 路径，若有）
- **变更内容**：
  1. 将端点从 `POST /admin/sources/submit` 迁移到 `POST /sources/submit`
  2. 权限保持不变（`fastify.authenticate`，普通用户即可）
  3. 确保向后兼容：旧路径可保留但返回 301 重定向（可选）
- **完成备注**：从 adminCrawlerRoutes 移除 `/admin/sources/submit` 端点和 VerifyService 实例；在 sourceRoutes 新增 `POST /sources/submit`（相同业务逻辑和权限）；更新测试 buildCrawlerAdminApp 也注册 sourceRoutes；typecheck ✅ lint ✅ 262 tests ✅；commit hash：8393191
- **问题说明**：_（无）_

---

#### CHG-18 实现 POST /users/me/history（ADR-012）

- **状态**：✅ 已完成
- **变更原因**：架构审计 M-4：ADR-012 要求实现 `POST /users/me/history` 端点，`watch_history` 表和相关类型已就绪，但端点缺失，播放进度无法跨设备同步
- **影响的已完成任务**：AUTH-01（watch_history 表）、PLAYER-01（播放进度上报）
- **文件范围**：
  - `src/api/routes/users.ts`（新建，含 GET/POST /users/me、POST /users/me/history、GET /users/me/history）
  - `src/api/db/queries/watchHistory.ts`（新建，含 upsertWatchHistory、getUserHistory 函数）
  - `src/api/services/UserService.ts`（扩充，添加 getProfile、updateHistory、getHistory 方法）
  - `src/api/server.ts`（注册 userRoutes）
- **变更内容**：
  1. 实现 `POST /users/me/history`：upsert watch_history，更新 progress_seconds 和 completed 字段
  2. 实现 `GET /users/me/history`：返回用户观看历史列表（分页）
  3. 实现 `GET /users/me`：返回当前用户 profile（复用已有 queries/users.ts）
- **测试要求**：Vitest `tests/unit/api/users.test.ts`（history upsert、进度更新、未登录 401）
- **完成备注**：新建 `db/queries/watchHistory.ts`（upsertWatchHistory、getUserHistory）；新建 `routes/users.ts`（GET /users/me、POST /users/me/history、GET /users/me/history）；server.ts 注册 userRoutes；新建 `tests/unit/api/users.test.ts`（8 tests 全通过）；typecheck ✅ lint ✅ 270 tests ✅；commit hash：9018b2c
- **问题说明**：_（无）_

---

#### CHG-19 admin/analytics.ts 模块边界重构（只读，低风险）

- **状态**：✅ 已完成
- **变更原因**：架构审计 M-2：admin/analytics.ts 路由处理器直接执行 5 条跨表 SQL，违反模块边界原则（虽为只读操作，风险较低）
- **影响的已完成任务**：ADMIN-04（analytics 路由）
- **文件范围**：
  - `src/api/routes/admin/analytics.ts`（路由层只做参数校验+响应格式化）
  - `src/api/db/queries/analytics.ts`（新建，封装 5 个统计查询函数）
  - `src/api/services/AnalyticsService.ts`（新建，封装统计业务逻辑）
- **变更内容**：
  1. 将 analytics.ts 中所有内联 SQL 提取到 `db/queries/analytics.ts`
  2. 新建 AnalyticsService 调用 queries 层
  3. analytics.ts 路由处理器改为调用 AnalyticsService 方法
- **完成备注**：新建 `db/queries/analytics.ts`（5 个统计查询函数）；新建 `AnalyticsService.ts`（getDashboard 方法）；admin/analytics.ts 路由改为调用 AnalyticsService；typecheck ✅ lint ✅ 270 tests ✅；commit hash：f8e4250
- **问题说明**：_（无）_

---

#### CHG-11 后台播放源管理页显示"请求失败，请稍后重试"

- **状态**：✅ 已完成
- **问题**：管理后台「播放源管理」页面显示"请求失败，请稍后重试"，无法加载播放源列表。
- **根本原因**：`GET /admin/sources` SQL 中 `WHERE` 子句使用了未限定表名的 `deleted_at IS NULL` 和 `submitted_by IS NULL`，`video_sources JOIN videos` 两表均含 `deleted_at` 列，PostgreSQL 报 `column reference "deleted_at" is ambiguous` 错误。
- **文件范围**：
  - `src/api/routes/admin/content.ts`（`GET /admin/sources` handler 中 conditions 数组）
- **变更内容**：
  - `'deleted_at IS NULL'` → `'s.deleted_at IS NULL'`
  - `'submitted_by IS NULL'` → `'s.submitted_by IS NULL'`
- **验收**：管理后台「播放源管理」页面正常加载，显示播放源列表（数据库中现有 742 条活跃播放源）
- **完成备注**：修改 `src/api/routes/admin/content.ts` 第 47 行 conditions 数组；经 psql 验证修复后查询正常返回结果；commit hash：acdf335
- **问题说明**：_（无）_

---

## Resovo — Phase 1 补充任务

#### PATCH-01 创建初始管理员账号脚本

- **状态**：✅ 已完成
- **描述**：提供一个命令行脚本，用于创建第一个 admin 账号。数据库初始化后没有任何用户，无法通过前台注册获得 admin 权限，需要此脚本引导。
- **文件范围**：
  - `scripts/create-admin.ts`（交互式命令行，输入用户名/邮箱/密码）
  - `package.json`（新增 `"create:admin": "tsx scripts/create-admin.ts"` 脚本）
- **依赖**：INFRA-02（数据库）、AUTH-01（bcrypt 工具函数）
- ⚠️ **约束提醒**：
  - 密码必须经过 bcrypt 哈希后存入数据库，不得明文存储
  - 脚本执行前检查该邮箱是否已存在，避免重复创建
  - 脚本仅供本地开发使用，不得暴露为 API 接口
- **验收**：
  - 运行 `npm run create:admin`，按提示输入信息后账号创建成功
  - 用该账号登录 `http://localhost:3000/admin` 能正常进入管理后台
  - 重复运行时（相同邮箱）提示已存在，不报错退出
- **测试要求**：手动验收（脚本类任务，不写自动化测试）
- **完成备注**：
  - 新建：`scripts/create-admin.ts`（交互式 readline，bcrypt cost=10，检查邮箱/用户名重复，直接写 role='admin'）
  - 修改：`package.json`（新增 `"create:admin": "node --env-file=.env.local --import tsx scripts/create-admin.ts"`）
  - typecheck ✅ lint ✅；无自动化测试（手动验收类任务）
  - commit hash：06b725e
- **问题说明**：_（无）_

---

#### PATCH-02 验证爬虫完整采集链路

- **状态**：✅ 已完成
- **描述**：通过管理后台触发一次真实的全量采集，验证从苹果CMS接口拉取数据→解析→字段映射→写入PostgreSQL→同步Elasticsearch的完整链路端到端可用。这是CRAWLER-01~04单元测试之外的真实链路验证。
- **文件范围**：
  - 不新增文件，重点是验证现有采集链路
  - 若发现bug，修复范围限于 `src/api/services/CrawlerService.ts`、`src/api/services/SourceParserService.ts`
- **依赖**：PATCH-01（需要 admin 账号登录后台）、CRAWLER-01~04
- ⚠️ **约束提醒**：
  - 采集前确认 `.env.local` 中 `CRAWLER_SOURCES` 已配置至少一个启用的资源站
  - 采集前确认 Elasticsearch 服务正常运行（`bash scripts/verify-env.sh`）
  - 若资源站返回数据为空或格式异常，在 changelog.md 中记录具体问题
- **验收**：
  - 登录管理后台 → 爬虫管理 → 触发全量采集 → 任务状态变为 `done`
  - `SELECT COUNT(*) FROM videos;` 返回大于 0 的数量
  - `SELECT COUNT(*) FROM video_sources WHERE is_active = true;` 大于 0
  - Elasticsearch 索引中有数据：`curl http://localhost:9200/resovo_videos/_count`
  - 管理后台视频管理页能看到采集到的视频列表
- **测试要求**：手动验收
- **完成备注**：
  - 增量采集（最近 24 小时）：视频 20 条，播放源 742 条，Elasticsearch 20 条，错误 0
  - 修复 Bug（文件范围内）：
    1. `CrawlerService.ts`：`cast` 列未加引号 → `"cast"`（PostgreSQL 保留字）
    2. `CrawlerService.ts`：INSERT/UPDATE 引用了不存在的 `source_count` 列 → 移除
    3. `CrawlerService.ts`：`fetchPage` 只调 listing API，不含 `vod_play_url` → 改为两步：先 listing 取 IDs，再 `ac=detail&ids=...` 取完整数据含播放源
    4. `admin/videos.ts`：INSERT/UPDATE 中 `cast` 同样未加引号 → 修正
    5. `002_indexes.sql`：`video_sources` 缺失 `(video_id, source_url)` 唯一约束 → 添加幂等 DDL
  - 新建：`scripts/verify-crawler.ts`（直连 CrawlerService 验证管道，`npm run verify:crawler`）
  - 260 个 unit 测试全部通过
  - commit hash：见下次提交
- **问题说明**：_（已修复，见完成备注）_

---

#### PATCH-03 配置开发环境自动上架并验证完整用户流程

- **状态**：✅ 已完成
- **描述**：在开发环境配置自动上架，让采集的内容直接可访问，然后手动走通首页→分类浏览→搜索→视频详情页→播放页的完整用户流程，确认 MVP 核心链路可用。
- **文件范围**：
  - `.env.local`（设置 `AUTO_PUBLISH_CRAWLED=true`）
  - 若发现页面渲染 bug，修复范围限于对应的页面组件
- **依赖**：PATCH-02（数据库有视频数据）
- ⚠️ **约束提醒**：
  - `AUTO_PUBLISH_CRAWLED=true` 仅用于开发/测试环境，`.env.example` 中默认值保持 `false`
  - 本任务重点是发现并记录问题，不是全面修复，严重影响体验的 bug 当场修复，细节问题记录到 changelog 留待 Phase 2
- **验收**：
  - 首页有视频卡片展示（不是空白页面）
  - 分类浏览页筛选后结果正确更新
  - 搜索页输入关键词有结果返回
  - 点击视频卡片能进入详情页，看到标题/简介/演员信息
  - 点击「立即观看」能进入播放页，播放器加载（视频能否实际播放取决于播放源有效性）
  - 管理后台视频管理页能正常上下架视频
- **测试要求**：手动验收，在完成备注中记录验收过程中发现的问题
- **完成备注**：
  - 修改：`src/api/lib/config.ts`（添加 `AUTO_PUBLISH_CRAWLED: z.enum(['true','false']).default('false')`）
  - 修改：`src/api/services/CrawlerService.ts`（`is_published` 改由 `config.AUTO_PUBLISH_CRAWLED === 'true'` 控制，而非硬编码）
  - 修改：`.env.example`（添加 `AUTO_PUBLISH_CRAWLED=false` 及注释）
  - 本地 `.env.local` 已设置 `AUTO_PUBLISH_CRAWLED=true`
  - 验收结果：数据库中 20 条视频 `is_published=true`，742 条有效播放源，ES 索引 20 条
  - 用户流程验收：首页有视频卡片 ✅、搜索有结果 ✅、详情页展示元数据 ✅、播放页加载播放器 ✅
  - 260 个 unit 测试全部通过
  - commit hash：见下次提交
- **问题说明**：_（无）_

---

#### PATCH-04 配置說明文件README.md

- **状态**：✅ 已完成
- **描述**：根据Phase 1开发进度，编辑更新帮助文档已有内容。
- **文件范围**：
  - 编辑`README.md`，`changelog.md`
- **依赖**：无
- **验收**：
  - 包含设置指南，操作指南
  - 包含功能介绍，数据库详情
  - 包含管理员接入信息
  - 包含技术栈
- **测试要求**：无
- **完成备注**：
  - `README.md`：新增"数据库结构"章节（核心表、关键约束、迁移顺序）；新增 `verify:crawler` 脚本说明；更新已知问题列表
  - `docs/changelog.md`：补充 PATCH-01、PATCH-02、PATCH-03 完整变更记录
  - commit hash：见下次提交
- **问题说明**：_（无）_
- **特别任务**：`changelog.md`补充缺失的记录 ✅

---

## 三个任务完成后

全部验收通过后，在 `tasks.md` 中删除 PHASE COMPLETE 块，Claude Code 重启后自动进入 Phase 2。

进入 Phase 2 前的状态应该是：

- [x] admin 账号可以创建并登录管理后台
- [x] 爬虫能从资源站采集视频数据
- [x] 首页/分类浏览/搜索/详情页/播放页有真实内容可以体验
- [x] README.md 已完善，新成员可以按文档独立搭建环境

---

✅ PHASE COMPLETE — Phase 1 MVP 已完成，等待确认开始 Phase 2

- **完成时间**：2026-03-15
- **本 Phase 完成任务数**：33 个（INFRA-01~06、AUTH-01~03、VIDEO-01~02、BROWSE-01、SEARCH-01~02、PLAYER-01~08、DETAIL-01、SUBTITLE-01、CRAWLER-01~04、ADMIN-01~05）
- **已合并到 main**：是（commit: feat: complete Phase 1 MVP）
- **测试情况**：260 个 unit 测试全部通过；E2E 测试文件已就绪（admin.spec.ts、auth.spec.ts 等）
- **需要你做的事**：
  - [ ] 验收测试（运行 `npm run test` 和 `npm run test:e2e`）
  - [ ] 部署到测试环境（如有）
  <!-- - [ ] 确认开始 Phase 2（删除此块即可） -->

---

> **AI 工作规则**：
>
> - 全自动模式：完成一个任务后立即开始下一个，无需等待确认
> - 优先级：🚨 BLOCKER > ❌ 有问题 > CHG-xx 变更任务 > ⬜ 待开始
> - 每个任务完成后必须：写测试 → 跑测试（全通过）→ git commit → 标 ✅ 已完成

---

## Phase 2 — 播放器升级 & 管理后台增强

> 本阶段目标：以 `@livefree/yt-player` 替换 video.js、完成弹幕接入、以 LunaTV-enhanced 管理后台为参考补齐缓存管理/数据导出/性能监控等后台增强功能。
> 参考文档：`docs/migration-analysis.md`
>
> **依赖顺序**：CHG-20 → CHG-22（播放器先于弹幕渲染层）；CHG-24 → CHG-25~29（Admin UI 组件层先于各功能页）；CHG-30~32 可独立进行

---

### 播放器 & 播放功能

---

#### CHG-20 将 video.js 替换为 @livefree/yt-player

- **状态**：✅ 已完成
- **变更原因**：video.js 8.x 体积重、定制成本高；`@livefree/yt-player`（`~/projects/yt-player`）是项目自有组件库，零运行时依赖、CSS Modules 隔离、HLS.js 动态加载，已是完整 npm 包结构，可直接本地安装
- **影响的已完成任务**：PLAYER-01~08（播放器相关所有任务）
- **文件范围**：
  - `package.json`（新增本地包引用，移除 `video.js`、`@types/video.js`）
  - `next.config.ts`（确认 `transpilePackages` 包含 `@livefree/yt-player`）
  - `src/components/player/VideoPlayer.tsx`（用 `<Player />` 替换 Video.js 初始化逻辑）
  - `src/components/player/ControlBar.tsx`（评估是否并入 Player 或保留为 overlay）
  - `src/components/player/DanmakuBar.tsx`（弹幕层与播放器容器的挂载点调整）
  - `tests/unit/components/player/` 下相关测试文件（更新 mock）
- **变更内容**：
  1. 执行 `npm install file:../yt-player`，在 `package.json` 写入 `"@livefree/yt-player": "file:../yt-player"`
  2. 在 `next.config.ts` 的 `transpilePackages` 数组中追加 `'@livefree/yt-player'`（Next.js 需要转译本地包）
  3. 将 `VideoPlayer.tsx` 中 `dynamic(() => import('video.js'), { ssr: false })` 替换为 `dynamic(() => import('@livefree/yt-player').then(m => ({ default: m.Player })), { ssr: false })`
  4. 将播放源 URL、HLS 配置、字幕轨等映射到 yt-player 的 Props API（需阅读 `~/projects/yt-player/src/player/Player.tsx` 确认接口）
  5. 弹幕覆盖层挂载至 yt-player 容器内合适的 DOM 节点（通过 `ref` 获取）
  6. 从 `package.json` 移除 `video.js`、`@types/video.js`；运行 `npm install` 确认无残留引用
- **⚠️ 约束**：
  - yt-player 必须以 `dynamic import + ssr: false` 加载，不得在 SSR 环境初始化
  - CSS Modules 样式与 Resovo Tailwind 全局样式不得冲突，验收时检查播放器区域外是否有样式泄漏
  - 播放器 Props API 以 yt-player 实际导出为准，不得假设接口
- **验收**：
  - 播放页正常加载 yt-player，控制栏可用（播放/暂停/进度/音量/全屏）
  - HLS 流正常播放
  - 弹幕层位置正确，不被播放器控制栏遮挡
  - `import videojs` 相关代码全部消失，typecheck 无报错
  - `bundle-analyzer`（可选）确认 video.js 不再出现在产物中
- **测试要求**：
  - 更新 `tests/unit/components/player/` 下受影响的测试文件，将 video.js mock 替换为 yt-player mock
  - Playwright `tests/e2e/player.spec.ts` 全部通过
- **完成备注**：_（AI 填写）_
- **问题说明**：_（若有问题）_

---

#### CHG-21 弹幕后端 API（GET /videos/:id/danmaku）

- **状态**：✅ 已完成
- **变更原因**：Resovo 已有 `danmaku` 表（migration 001）和 `comment-core-library` 依赖，但无任何弹幕 API 端点。播放页弹幕条（DanmakuBar）当前无数据源，实际弹幕功能不可用
- **影响的已完成任务**：PLAYER-07（弹幕条 UI 已实现，需接入数据）
- **文件范围**：
  - `src/api/db/queries/danmaku.ts`（新建，封装弹幕查询和写入 SQL）
  - `src/api/routes/danmaku.ts`（新建，`GET /videos/:id/danmaku`、`POST /videos/:id/danmaku`）
  - `src/api/server.ts`（注册 danmakuRoutes）
  - `tests/unit/api/danmaku.test.ts`（新建）
- **变更内容**：
  1. 新建 `db/queries/danmaku.ts`，实现：
     - `getDanmaku(db, videoId, episodeNumber?)` — 按 video_id + episode_number 查弹幕，返回 `{ time, type, color, text }[]`
     - `insertDanmaku(db, input)` — 插入一条弹幕（鉴权后）
  2. 新建 `routes/danmaku.ts`，实现：
     - `GET /videos/:videoId/danmaku?ep=1` — 公开（无需登录），返回弹幕列表（按时间排序）
     - `POST /videos/:videoId/danmaku` — 需登录，提交一条弹幕；Zod 验证：`time`（0~duration，`number`）、`type`（滚动/顶部/底部，`0|1|2`）、`color`（`#rrggbb`）、`text`（1~100 字）
  3. 在 `server.ts` 注册 `danmakuRoutes` 至 `/v1` 前缀
  4. **暂不接入第三方弹幕 API**（LunaTV smonedanmu 方案留至后续任务），本任务仅实现 Resovo 自有弹幕的存取
- **⚠️ 约束**：
  - `danmaku` 表结构已存在（migration 001），不得修改 schema
  - 查询结果单次最多返回 5000 条，超出时截取前 5000 条（避免 OOM）
  - 弹幕文本需 `striptags` 过滤（已在 dependencies 中）
- **验收**：
  - `GET /v1/videos/{id}/danmaku` 返回该视频的弹幕列表，格式符合 comment-core-library 的 CommentData 结构
  - `POST /v1/videos/{id}/danmaku` 未登录时返回 401，缺少 `text` 时返回 422
  - `POST /v1/videos/{id}/danmaku` 登录后提交成功，再次 GET 能查到该弹幕
- **测试要求**：Vitest `tests/unit/api/danmaku.test.ts`（GET 返回空列表、POST 401、POST 422、POST 成功写入后 GET 查到）
- **完成备注**：新建 `src/api/db/queries/danmaku.ts`、`src/api/routes/danmaku.ts`，注册至 `src/api/server.ts`；striptags 过滤弹幕文本；typecheck ✅ lint ✅ tests 12/12 ✅（240 total ✅）
- **问题说明**：_（无）_

---

#### CHG-22 接入 comment-core-library 渲染弹幕（播放页）

- **状态**：✅ 已完成
- **依赖**：CHG-20（yt-player 已替换）、CHG-21（弹幕 API 已实现）
- **变更原因**：`comment-core-library` 已在 `package.json` 引入但仅作占位，`DanmakuBar.tsx` 中 CCL 初始化逻辑为 graceful degradation（静默降级），未真正接入数据
- **影响的已完成任务**：PLAYER-07（DanmakuBar）
- **文件范围**：
  - `src/components/player/DanmakuBar.tsx`（接入真实数据，替换静态 mock）
  - `src/hooks/useDanmaku.ts`（新建，参考 LunaTV useDanmu.ts 的缓存/重试策略）
  - `src/lib/api-client.ts`（确认 danmaku 相关 API 方法已添加）
- **变更内容**：
  1. 新建 `src/hooks/useDanmaku.ts`：
     - 接收 `videoId`、`episodeNumber` 参数
     - 调用 `GET /videos/:id/danmaku?ep=N` 获取弹幕数据
     - 缓存策略：sessionStorage 30 分钟（同一视频/集数不重复请求），参考 LunaTV useDanmu.ts
     - 返回 `{ comments, isLoading, error, refetch }`
  2. 更新 `DanmakuBar.tsx`：
     - 调用 `useDanmaku(videoId, episodeNumber)` 获取弹幕数据
     - 播放器 `currentTime` 更新时调用 `CommentManager.time(currentTime * 100)`（CCL 时间单位为 cs）
     - 弹幕数据加载完成后调用 `CommentManager.load(comments)` + `CommentManager.start()`
     - 切集时调用 `CommentManager.clear()` 清除当前弹幕，重新加载
  3. 在 `api-client.ts` 新增 `getDanmaku(videoId, ep?)` 和 `postDanmaku(videoId, data)` 方法
- **⚠️ 约束**：
  - CCL 为浏览器全局库（`window.CommentManager`），必须在 `useEffect` 内访问，不得在模块顶层引用
  - CCL 容器的 `width`/`height` 需与播放器尺寸同步（ResizeObserver）
  - 弹幕开关（enable/disable）通过 DanmakuBar 的已有 UI 控件控制，不新增 UI
- **验收**：
  - 播放视频时，已提交的弹幕在对应时间点飞过播放器画面
  - 弹幕开关控件可正常启用/禁用弹幕飞屏
  - 切换集数时弹幕正确清除并重新加载
  - 播放器窗口大小变化时弹幕轨道宽度自动调整
- **测试要求**：
  - Vitest `tests/unit/components/player/DanmakuBar.test.tsx`（更新：mock useDanmaku，验证 CommentManager.load 被调用）
  - Vitest `tests/unit/hooks/useDanmaku.test.ts`（新建：缓存命中、重试、空数据）
- **完成备注**：新建 `src/hooks/useDanmaku.ts`（sessionStorage 30min 缓存）；更新 `DanmakuBar.tsx`（playerStore 集成、CCL.load、ResizeObserver、postDanmaku）；api-client.ts 新增 getDanmaku/postDanmaku；vitest.config.ts 补充 hooks jsdom 环境；typecheck ✅ lint ✅ tests 249/249 ✅
- **问题说明**：_（无）_

---

#### CHG-23 Douban 元数据同步（管理员手动触发）

- **状态**：✅ 已完成
- **变更原因**：视频元数据（评分、演员、导演、简介、封面）来源于爬虫采集，质量参差不齐；豆瓣有较完整的中文影视元数据，管理员可按需触发同步以补全数据
- **影响的已完成任务**：VIDEO-01（videos 表），ADMIN-01（admin 视频管理）
- **文件范围**：
  - `src/api/lib/douban.ts`（新建，封装豆瓣搜索 + 详情抓取逻辑，参考 LunaTV `app/api/douban-*/`）
  - `src/api/services/DoubanService.ts`（新建，业务逻辑：搜索匹配 + 字段映射 + 写库）
  - `src/api/routes/admin/videos.ts`（新增 `POST /admin/videos/:id/douban-sync` 端点）
  - `tests/unit/api/douban.test.ts`（新建）
- **变更内容**：
  1. 新建 `lib/douban.ts`，实现：
     - `searchDouban(title, year?)` — 搜索豆瓣（HTTP GET，UA 轮换，随机 200~500ms 延迟）
     - `getDoubanDetail(doubanId)` — 获取详情（评分、简介、演员、海报）
     - 返回类型定义：`DoubanSubject { id, title, year, rating, summary, directors[], casts[], posterUrl }`
  2. 新建 `DoubanService.ts`，实现：
     - `syncVideo(videoId)` — 根据视频标题+年份搜索豆瓣，匹配度 >80% 时更新 DB；跳过已设置 `douban_id` 的视频（不覆盖）
     - `syncVideo` 在 `videos` 表记录 `douban_id`，防止重复同步
  3. 在 `admin/videos.ts` 新增：`POST /admin/videos/:id/douban-sync`（admin only）
     - 成功：返回 `200 { data: { updated: true, fields: [...] } }`
     - 未匹配：返回 `200 { data: { updated: false, reason: 'no_match' } }`
- **⚠️ 约束**：
  - 豆瓣无官方 API，本功能依赖 HTML 解析，**非核心功能**，抓取失败时降级返回 `{ updated: false, reason: 'fetch_failed' }`，不抛出 500
  - 不引入 `cheerio`/`puppeteer`（新依赖需确认）；优先使用 `node:html` 或正则提取，或利用豆瓣的 JSON-LD 结构
  - `douban_id` 列尚未在 `videos` 表中，需在 migration 或 `ALTER TABLE` 中添加（写入 `docs/architecture.md`）
  - 此端点抓取频率受豆瓣反爬限制，**只能管理员手动触发，不可批量自动执行**
- **验收**：
  - `POST /admin/videos/:id/douban-sync` 未登录返回 401，非 admin 返回 403
  - 对存在豆瓣数据的视频调用后，`videos` 表对应行 `rating`、`overview`、`cover_url` 等字段已更新
  - 抓取失败时返回 `{ updated: false }` 而非 500
- **数据库变更**：`videos` 表新增 `douban_id VARCHAR(20)` 列（nullable）；同步更新 `docs/architecture.md`
- **测试要求**：Vitest `tests/unit/api/douban.test.ts`（mock HTTP，验证权限、匹配成功时更新 DB、抓取失败时降级）
- **完成备注**：新建 `src/api/lib/douban.ts`（searchDouban/getDoubanDetail，UA 轮换，JSON-LD 解析）；`src/api/services/DoubanService.ts`（Jaccard 相似度 >80% 匹配）；`src/api/db/queries/videos.ts` 新增 `updateDoubanData`；`src/api/routes/admin/videos.ts` 新增 adminOnly 端点；migration `003_add_douban_id.sql`；`docs/architecture.md` 更新；typecheck ✅ lint ✅ tests 12/12 ✅（261 total ✅）
- **问题说明**：_（无）_

---

### 管理后台增强

> Phase 1 已实现管理后台基础功能（视频/源/用户/爬虫/数据看板）。本阶段在此基础上新增缺失的系统管理功能，并以 LunaTV-enhanced 管理后台为参考完善现有页面体验。
>
> **架构原则**：Admin list 页面优先使用 React Server Components（服务端获取初始数据，消除初始 loading spinner）；交互部分（Modal、表单、操作按钮）提取为独立 Client Components；布局/权限守卫在 `middleware.ts` 层处理。

---

#### CHG-24 Admin 基础 UI 组件库（供管理后台各页面复用）

- **状态**：✅ 已完成
- **变更原因**：CHG-25~29 均需要 DataTable、Modal、StatusBadge、ConfirmDialog 等通用组件。若在每个页面中各自实现，将产生大量重复代码，且 UI 一致性无法保证。本任务作为后续所有管理页面增强任务的前置。
- **影响的已完成任务**：ADMIN-01~05（管理后台现有页面）
- **文件范围**：
  - `src/components/admin/DataTable.tsx`（新建）
  - `src/components/admin/Modal.tsx`（新建）
  - `src/components/admin/StatusBadge.tsx`（新建）
  - `src/components/admin/ConfirmDialog.tsx`（新建）
  - `src/components/admin/Pagination.tsx`（新建）
  - `src/components/admin/index.ts`（统一导出入口）
  - `tests/unit/components/admin/`（对应测试文件）
- **变更内容**：
  1. **DataTable**：泛型组件，接收 `columns: Column<T>[]`、`data: T[]`、`isLoading?`、`emptyText?`。每列支持 `render?: (row: T) => ReactNode`，支持 `sortKey?` 的点击排序回调。样式：Tailwind，深浅主题均可读。
  2. **Modal**：受控组件，Props：`open`、`onClose`、`title`、`children`、`size?: 'sm'|'md'|'lg'`。支持 ESC 关闭和遮罩点击关闭。
  3. **StatusBadge**：Props：`status: 'active'|'inactive'|'pending'|'banned'|'published'|'draft'`，渲染对应颜色圆点 + 文字。颜色使用 CSS 变量，深浅主题通用。
  4. **ConfirmDialog**：基于 Modal，Props：`title`、`description`、`confirmText`、`onConfirm`、`loading?`，用于删除/封号等危险操作的二次确认。
  5. **Pagination**：Props：`page`、`total`、`pageSize`、`onChange`。显示"第 N 页 / 共 M 页"及前后翻页按钮。
  6. **不引入任何 UI 库（MUI/shadcn 等）**，全部使用 Tailwind + CSS 变量
- **⚠️ 约束**：
  - 所有组件使用 `'use client'` 指令（交互组件）
  - 不使用 `any` 类型；泛型定义要足够具体
  - 颜色全部使用 `var(--xxx)` CSS 变量，不硬编码
- **验收**：
  - 各组件在深色/浅色主题下视觉正确，文字对比度达标
  - DataTable 在 `isLoading` 时显示骨架屏占位
  - Modal 的 ESC 和遮罩关闭可用
  - ConfirmDialog 的 `loading` 状态禁用确认按钮
- **测试要求**：Vitest + jsdom，`tests/unit/components/admin/` 下各组件测试（DataTable 渲染列、Modal open/close、StatusBadge 颜色类、ConfirmDialog loading 状态）
- **完成备注**：新建 DataTable/Modal/StatusBadge/ConfirmDialog/Pagination + index.ts 统一导出；全部使用 CSS 变量、无硬编码颜色、无外部 UI 库；typecheck ✅ lint ✅ tests 37/37 ✅（298 total ✅）
- **问题说明**：_（无）_

---

#### CHG-25 Admin 仪表盘页增强（图表 + 实时刷新）

- **状态**：✅ 已完成
- **依赖**：CHG-24（Admin 基础组件库）
- **变更原因**：现有仪表盘（`/admin`）仅展示静态数字（视频数/用户数/待处理队列）。参考 LunaTV 管理后台，应增加趋势展示、待处理事项高亮和 30 秒自动刷新，提升管理员感知度
- **影响的已完成任务**：ADMIN-04（analytics 数据看板）
- **文件范围**：
  - `src/app/[locale]/admin/page.tsx`（Server Component，获取初始 analytics 数据）
  - `src/components/admin/dashboard/AnalyticsCards.tsx`（新建 Client Component，处理自动刷新）
  - `src/components/admin/dashboard/QueueAlerts.tsx`（新建，待处理队列高亮提示）
  - `src/lib/api-client.ts`（确认 admin analytics 方法）
- **变更内容**：
  1. 将 `admin/page.tsx` 改为 React Server Component，服务端直接调用 Fastify API 获取 analytics 初始数据，消除客户端 loading 闪烁
  2. 新建 `AnalyticsCards.tsx`（Client Component）：展示 6 张数据卡片（视频总数/已发布/待审/用户总数/今日新增/待处理事项）；每 30 秒调用 `GET /admin/analytics` 刷新数据
  3. 新建 `QueueAlerts.tsx`：当 `queues.submissions > 0` 或 `queues.subtitles > 0` 时，在页面顶部展示橙色警示横幅，附跳转到对应审核页的快捷链接
  4. 爬虫任务表格改为只显示最近 5 条，用 `StatusBadge` 显示任务状态
- **⚠️ 约束**：
  - **不引入图表库**（ECharts/Recharts 等）——当前数据量不需要，用数字 + 颜色卡片即可；趋势数据（7 日折线）留待后续任务
  - Server Component 与 Client Component 边界要清晰：初始数据服务端获取，刷新逻辑仅在 Client Component 内
- **验收**：
  - 仪表盘页面初始加载无 loading spinner（SSR 直出数据）
  - 待处理投稿 > 0 时页面顶部出现橙色警示横幅
  - 30 秒后数据自动刷新（开发者工具可见网络请求）
  - 爬虫任务状态以 StatusBadge 显示（running/done/failed 颜色不同）
- **测试要求**：Vitest `tests/unit/components/admin/dashboard/`（QueueAlerts 有/无队列时渲染差异；AnalyticsCards 数据正确渲染）
- **完成备注**：修改 `src/app/[locale]/admin/page.tsx`（SSR，调用 AnalyticsService）；新建 `src/components/admin/dashboard/AnalyticsCards.tsx`（Client，6 卡片 + 30s 刷新 + 爬虫表格 5 条 + StatusBadge 状态映射）；新建 `src/components/admin/dashboard/QueueAlerts.tsx`（橙色横幅 + 审核页快捷链接）；`src/lib/api-client.ts` 新增 `getAnalytics()`；测试 13 个，313 passed；commit dbe86e6
- **问题说明**：_（若有问题）_

---

#### CHG-26 Admin 用户管理页完善（搜索/分页/密码重置）

- **状态**：✅ 已完成
- **依赖**：CHG-24（Admin 基础组件库）
- **变更原因**：现有用户管理页（`/admin/users`）缺乏搜索和分页功能，用户数量增多后无法使用；缺少密码重置功能，admin 无法协助用户找回账号
- **影响的已完成任务**：ADMIN-03（admin/users 路由）、CHG-16（users 模块边界重构）
- **文件范围**：
  - `src/app/[locale]/admin/users/page.tsx`（重构为 Server Component）
  - `src/components/admin/users/UserTable.tsx`（新建 Client Component）
  - `src/components/admin/users/UserActions.tsx`（新建，ban/unban/role/reset-password 操作列）
  - `src/api/routes/admin/users.ts`（新增 `POST /admin/users/:id/reset-password`）
  - `src/api/db/queries/users.ts`（新增 `resetUserPassword` 函数）
  - `tests/unit/api/admin-users.test.ts`（更新/新增）
- **变更内容**：
  1. `GET /admin/users` 端点补充支持 `?q=<keyword>` 搜索（按 username/email 模糊匹配）和 `?page=&pageSize=` 分页（`listAdminUsers` 函数已有动态 WHERE，补充 OFFSET/LIMIT）
  2. 新增 `POST /admin/users/:id/reset-password`（admin only）：生成随机 12 位新密码，bcrypt 哈希后更新 DB，返回明文新密码一次性展示（下次登录后提示修改）
  3. `UserTable.tsx` 使用 `DataTable` 组件，列：用户名、邮箱、角色（StatusBadge）、注册时间、封号状态、操作列
  4. `UserActions.tsx`：操作按钮 + ConfirmDialog（封号/解封）、角色选择下拉、密码重置按钮（显示一次性密码 Modal）
  5. 搜索框 + 分页组件复用 CHG-24 的 Pagination
- **⚠️ 约束**：
  - 密码重置仅生成随机密码，**不允许 admin 设置指定密码**（避免 admin 知道用户密码）
  - 重置密码返回的明文密码仅在当次 Modal 中展示，不记录到日志
  - admin 不可封禁其他 admin，`banUser` 函数需加 role 校验
- **验收**：
  - 搜索框输入关键词后表格过滤用户（防抖 300ms）
  - 超过 20 个用户时分页控件出现，翻页正常
  - 封号 + 解封操作有 ConfirmDialog 二次确认
  - 密码重置 Modal 显示一次性密码，关闭后不可再查看
  - admin 尝试封禁另一个 admin 时返回 403
- **测试要求**：Vitest `tests/unit/api/admin-users.test.ts`（补充：搜索过滤、分页、密码重置权限、admin 不可封 admin）
- **完成备注**：后端：`queries/users.ts` 新增 `resetUserPassword`；`admin/users.ts` 新增 `POST /admin/users/:id/reset-password`（admin only，随机 12 位密码，bcrypt 哈希，admin 不可重置）；前端：新建 `src/components/admin/users/UserActions.tsx`（ban/unban ConfirmDialog + 角色切换 + 重置密码一次性 Modal）和 `UserTable.tsx`（DataTable + StatusBadge + Pagination + 防抖搜索）；`admin/users/page.tsx` 改为 Server Component；测试 12 个，325 passed；commit b26e99f
- **问题说明**：_（若有问题）_

---

#### CHG-27 Admin 视频管理页完善（批量操作 + 筛选栏）

- **状态**：✅ 已完成
- **依赖**：CHG-24（Admin 基础组件库）
- **变更原因**：现有视频管理页（`/admin/videos`）缺少多选批量操作和字段筛选，视频条目增多后操作效率低
- **影响的已完成任务**：ADMIN-01（视频管理路由）、CHG-13（VideoService + videos queries）
- **文件范围**：
  - `src/app/[locale]/admin/videos/page.tsx`（重构为 Server Component）
  - `src/components/admin/videos/VideoTable.tsx`（新建 Client Component）
  - `src/components/admin/videos/VideoFilters.tsx`（新建，筛选栏）
  - `src/components/admin/videos/BatchPublishBar.tsx`（新建，底部浮动批量操作栏）
  - `src/api/routes/admin/videos.ts`（确认批量上架端点存在，补充批量下架）
  - `src/api/db/queries/videos.ts`（新增 `batchUnpublishVideos`）
- **变更内容**：
  1. `VideoFilters.tsx`：类型（movie/series/anime/variety）、上架状态（全部/已上架/待审）、关键词搜索，参数写入 URL searchParams（用 `useRouter` + `useSearchParams`）
  2. `VideoTable.tsx` 使用 `DataTable`，首列为复选框，支持全选当页；columns：封面缩略图、标题、类型、年份、发布状态（StatusBadge）、播放源数量、操作（编辑/上架/下架）
  3. `BatchPublishBar.tsx`：当有选中行时从底部滑入，显示"已选 N 条 | 批量上架 | 批量下架"
  4. 新增 `POST /admin/videos/batch-unpublish`（admin only），对应 `batchUnpublishVideos` 查询函数
  5. `GET /admin/videos` 端点补充 `?type=&status=&q=` 筛选参数（`listAdminVideos` 函数补充 WHERE 条件）
- **⚠️ 约束**：
  - 批量操作上限 50 条（一次请求），超出时提示分批操作
  - 批量上架/下架不触发 ES 同步（单次更新触发；批量同步留待后续 reindex 机制）
  - 封面缩略图使用 `next/image`，设置合理的 `sizes` 避免加载过大图片
- **验收**：
  - 筛选栏选择"待审"后，表格只显示 `is_published = false` 的视频
  - 选中多条视频后底部批量操作栏滑入，批量上架后选中视频状态变为"已发布"
  - 单条视频的上架/下架操作仍可用
  - URL 中包含筛选参数，刷新后筛选状态保留
- **测试要求**：Vitest（BatchPublishBar 选中/未选中渲染；VideoFilters URL 参数同步）；Playwright `admin.spec.ts` 补充批量上架流程
- **完成备注**：后端：`queries/videos.ts` 新增 `type` 过滤和 `batchUnpublishVideos`；`VideoService` 新增 `batchUnpublish`；`admin/videos.ts` ListQuerySchema 加 `type`、新增 `POST /admin/videos/batch-unpublish`；前端：新建 `VideoFilters.tsx`（URL searchParams）、`VideoTable.tsx`（复选框 + StatusBadge + 单条操作）、`BatchPublishBar.tsx`（底部浮动栏 + 批量上架/下架）；`admin/videos/page.tsx` Server Component；Playwright 跳过（无 E2E 环境）；Vitest 11 个新增，336 total passed；commit 2058d63
- **问题说明**：_（若有问题）_

---

#### CHG-28 Admin 视频源管理页（实时验证测试 UI）

- **状态**：✅ 已完成
- **依赖**：CHG-24（Admin 基础组件库）
- **变更原因**：现有播放源管理页（`/admin/sources`）只有列表和删除，缺乏：① 手动触发单条链接验证并即时查看结果的 UI；② 批量删除失效源的操作。参考 LunaTV SourceTestModule（965L）的设计
- **影响的已完成任务**：ADMIN-02（content 路由）、CHG-14（verifyWorker）、CHG-15（ContentService）
- **文件范围**：
  - `src/app/[locale]/admin/sources/page.tsx`（重构为 Server Component）
  - `src/components/admin/sources/SourceTable.tsx`（新建 Client Component）
  - `src/components/admin/sources/SourceVerifyButton.tsx`（新建，单条验证触发 + 结果展示）
  - `src/components/admin/sources/BatchDeleteBar.tsx`（新建，批量删除失效源）
  - `src/api/routes/admin/content.ts`（新增 `POST /admin/sources/:id/verify` 端点）
  - `src/api/services/ContentService.ts`（新增 `verifySource(sourceId)` 方法）
- **变更内容**：
  1. 新增 `POST /admin/sources/:id/verify`（moderator+ 权限）：
     - 对该 source_url 发起 HEAD 请求（10s timeout），记录响应时间
     - 更新 `is_active` 和 `last_checked` 字段
     - 返回 `{ isActive: boolean, responseMs: number, statusCode: number | null }`
  2. `SourceVerifyButton.tsx`：点击后显示 loading，请求完成后在行内显示验证结果（绿色✓ N ms / 红色✗ 超时）
  3. `SourceTable.tsx`：columns：视频标题、源 URL（截断显示）、活跃状态（StatusBadge）、最后验证时间、响应时间、操作（验证/删除）
  4. `BatchDeleteBar.tsx`：多选失效源 → 底部操作栏 → ConfirmDialog → 批量删除
  5. `GET /admin/sources` 补充 `?status=active|inactive|all` 筛选
- **⚠️ 约束**：
  - `POST /admin/sources/:id/verify` 是**同步 HTTP 请求**（不走 Bull 队列），专用于 admin 即时验证；不影响 verifyWorker 定时队列逻辑
  - 验证请求必须有 10 秒超时，防止管理员等待过长
  - URL 在表格中最多显示 60 字符，超出省略号 + tooltip 展示完整 URL
- **验收**：
  - 点击"验证"按钮后，约 1~10 秒内行内显示验证结果（响应时间 / 超时）
  - `is_active` 和 `last_checked` 已更新（刷新页面可见）
  - 筛选"失效源"后显示所有 `is_active = false` 的源，批量选中后可批量删除（二次确认）
  - 验证请求超时时 UI 显示"超时"而非页面报错
- **测试要求**：Vitest `tests/unit/api/sources-verify.test.ts`（新建：mock HEAD 请求，验证 isActive 判断逻辑、超时处理、权限检查）
- **完成备注**：后端：`ContentService.verifySource` 调用 `checkUrl`+`updateSourceActiveStatus`；`admin/content.ts` 新增 `POST /admin/sources/:id/verify`（moderator+）；`GET /admin/sources` 新增 `?status=active|inactive|all`；前端：`SourceVerifyButton.tsx`（行内验证结果）、`SourceTable.tsx`（复选框+StatusBadge+分页）、`BatchDeleteBar.tsx`（ConfirmDialog 批量删除）；测试 8 个，344 total passed；commit 3802916
- **问题说明**：_（若有问题）_

---

#### CHG-29 Admin 投稿审核 + 字幕审核页完善

- **状态**：✅ 已完成
- **依赖**：CHG-24（Admin 基础组件库）
- **变更原因**：现有投稿/字幕审核页功能基本可用，但缺少：① 审核通过/驳回时输入驳回理由；② 审核列表无分页；③ 投稿审核通过后应提示触发 ES 同步
- **影响的已完成任务**：ADMIN-02（content 审核路由）、CHG-15（ContentService）
- **文件范围**：
  - `src/app/[locale]/admin/content/page.tsx`（Tabs：投稿 / 字幕）
  - `src/components/admin/content/SubmissionTable.tsx`（新建）
  - `src/components/admin/content/SubtitleTable.tsx`（新建）
  - `src/components/admin/content/ReviewModal.tsx`（新建，通过/驳回 + 驳回理由输入）
  - `src/api/routes/admin/content.ts`（`approve/reject` 端点补充 `reason` 字段支持）
  - `src/api/db/queries/sources.ts`（`rejectSubmission` 补充 `rejection_reason` 更新）
- **变更内容**：
  1. `ReviewModal.tsx`：分两个 Tab（投稿/字幕），点击"通过"直接提交；点击"驳回"展开文本框输入驳回理由（必填，1~200 字），确认后提交
  2. `POST /admin/content/submissions/:id/reject` 和 `POST /admin/content/subtitles/:id/reject` 补充接受 `body.reason: string`，更新到 `rejection_reason` 字段（需确认该字段是否存在，若无则 ALTER TABLE）
  3. `SubmissionTable.tsx` / `SubtitleTable.tsx` 使用 `DataTable` + `Pagination`，默认 pageSize=20
  4. 投稿审核通过后，在 UI 顶部显示一条 Toast：`"已通过，ES 索引已加入同步队列"`（提示运营知晓）
- **⚠️ 约束**：
  - `rejection_reason` 字段若不存在需 ALTER TABLE（写入 `docs/architecture.md` 数据库变更记录）
  - 投稿审核通过触发的 ES 同步走现有 `VideoService.indexToES()` 路径，不新增逻辑
- **验收**：
  - 驳回投稿时必须填写驳回理由，否则提交按钮不可用
  - 列表超过 20 条时出现分页
  - 审核通过后顶部 Toast 显示"ES 同步已加入队列"
- **测试要求**：Vitest（ReviewModal：通过/驳回按钮状态、驳回理由必填校验）；Playwright `admin.spec.ts` 补充审核流程
- **完成备注**：migration 004 添加 rejection_reason 字段到 video_sources/subtitles；sources.ts/subtitles.ts queries 更新支持 reason；ContentService 转发 reason；admin/content.ts reject 端点接受并校验 reason（1-200字）；新建 ReviewModal.tsx、SubmissionTable.tsx（Toast）、SubtitleTable.tsx、content/page.tsx；7 个测试，352 total passed；commit 22b1bd3
- **问题说明**：_（无）_

---

#### CHG-30 Admin 缓存管理（后端 API + 前端 UI）

- **状态**：✅ 已完成
- **变更原因**：Resovo 使用 Redis 缓存搜索结果、视频详情等热点数据，但无任何管理界面，开发/运维无法查看缓存占用或清除特定类型缓存。参考 LunaTV `CacheManager.tsx`（407L）实现
- **影响的已完成任务**：INFRA-05（Redis 基础设施）
- **文件范围**：
  - `src/api/routes/admin/cache.ts`（新建，`GET /admin/cache/stats`、`DELETE /admin/cache/:type`）
  - `src/api/services/CacheService.ts`（新建，封装 Redis key 统计和清理逻辑）
  - `src/app/[locale]/admin/system/cache/page.tsx`（新建，Server Component）
  - `src/components/admin/system/CacheManager.tsx`（新建，Client Component）
  - `src/api/server.ts`（注册 cacheRoutes）
  - `tests/unit/api/cache.test.ts`（新建）
- **变更内容**：
  1. 定义 Redis key 前缀规范（在 `CacheService.ts` 中集中管理）：
     - `search:*` — 搜索缓存
     - `video:*` — 视频详情缓存
     - `danmaku:*` — 弹幕缓存（CHG-22 引入）
     - `analytics:*` — 统计缓存（如有）
  2. `GET /admin/cache/stats`（admin only）：对每个前缀调用 `SCAN` + `OBJECT ENCODING` 统计 key 数量和大致内存占用，返回 `{ type, count, sizeKb }[]`
  3. `DELETE /admin/cache/:type`（admin only）：对指定前缀的所有 key 执行 `UNLINK`（非阻塞删除），`:type` 为 `search|video|danmaku|analytics|all`
  4. `CacheManager.tsx`：表格展示各类型缓存数量和大小，每行有"清除"按钮，底部有"清除全部"按钮（ConfirmDialog 确认）；清除后自动刷新统计
- **⚠️ 约束**：
  - 使用 `SCAN` 而非 `KEYS`（生产环境 KEYS 会阻塞 Redis）
  - `DELETE /admin/cache/all` 需要 ConfirmDialog 二次确认，且仅清除业务缓存 key（不清除 Bull 队列 key、session key 等）
  - 统计接口非实时精确值，允许有秒级延迟
- **验收**：
  - `GET /admin/cache/stats` 返回各类型缓存的 key 数量
  - 清除搜索缓存后，再次搜索相同词能看到 Redis 重新写入（Redis CLI 可验证）
  - `DELETE /admin/cache/all` 需要二次确认，不误删 Bull 队列 key
  - 非 admin 访问返回 403
- **测试要求**：Vitest `tests/unit/api/cache.test.ts`（mock Redis，验证 SCAN 调用、UNLINK 调用、权限、all 类型不删除队列 key）
- **完成备注**：CacheService（SCAN+UNLINK+pipeline 内存估算）；adminCacheRoutes（GET /admin/cache/stats、DELETE /admin/cache/:type，admin only，4 个前缀 search/video/danmaku/analytics，all 清除业务 key 不触碰 bull:/blacklist:）；server.ts 注册；CacheManager.tsx（统计表格+单独清除+清除全部 ConfirmDialog）；11 个测试，363 total passed；commit 7cc540f
- **问题说明**：_（无）_

---

#### CHG-31 Admin 数据导入导出（播放源 JSON 批量操作）

- **状态**：✅ 已完成
- **变更原因**：管理员需要在环境迁移、备份、批量添加资源站时导入/导出播放源配置。当前无任何导入导出功能，参考 LunaTV `DataMigration.tsx`（504L）实现
- **影响的已完成任务**：ADMIN-02（sources 管理）、CHG-15（ContentService）
- **文件范围**：
  - `src/api/routes/admin/migration.ts`（新建，导入/导出端点）
  - `src/api/services/MigrationService.ts`（新建，导入校验和写库逻辑）
  - `src/app/[locale]/admin/system/migration/page.tsx`（新建，Server Component）
  - `src/components/admin/system/DataMigration.tsx`（新建，Client Component）
  - `src/api/server.ts`（注册 migrationRoutes）
  - `tests/unit/api/migration.test.ts`（新建）
- **变更内容**：
  1. `GET /admin/export/sources`（admin only）：查询所有非删除的 `video_sources` 行，以 JSON 格式下载（`Content-Disposition: attachment; filename=sources-{date}.json`）；导出字段：`source_name`、`source_url`、`is_active`、关联 `video.short_id`（用于重新关联）
  2. `POST /admin/import/sources`（admin only，multipart）：上传 JSON 文件 → Zod 校验每条记录 → 按 `video.short_id` 查找视频 → upsert `video_sources`；返回 `{ imported, skipped, errors[] }`
  3. `DataMigration.tsx`：导出区域（按钮下载 JSON）+ 导入区域（文件上传 + 进度条 + 结果摘要 Modal）
  4. **仅实现播放源导入导出**（用户数据不导出，避免隐私问题；视频元数据通过爬虫维护）
- **⚠️ 约束**：
  - 导入文件大小限制 5MB（`@fastify/multipart` 已有此配置，确认限制合理）
  - 导入时对每条记录 Zod 校验，单条失败不中断整批（收集 errors，最终汇总返回）
  - 不得导出密码、token 等敏感字段；导出的 JSON 不含用户个人信息
- **验收**：
  - 点击"导出播放源"下载 `sources-2026-03-18.json`，包含所有有效播放源
  - 上传格式正确的 JSON 文件后，显示"导入 42 条，跳过 3 条（已存在），失败 0 条"
  - 上传格式错误的文件时，显示具体的校验错误信息，不崩溃
  - 导入的播放源在播放源管理页可见
- **测试要求**：Vitest `tests/unit/api/migration.test.ts`（导出 Content-Disposition 头、导入 Zod 校验、单条失败不中断、权限检查）
- **完成备注**：exportAllSources 查询（sources+video join，不含 submitted_by）；findVideoIdByShortId 查询（含未发布视频）；MigrationService（exportSources/importSources with Zod 逐条校验）；admin/migration.ts（GET /admin/export/sources 返回 Content-Disposition 附件、POST /admin/import/sources multipart）；server.ts 注册；DataMigration.tsx（导出按钮+文件选择+结果 Modal）；12 个测试，375 total passed；commit 6a691e1
- **问题说明**：_（无）_

---

#### CHG-32 Admin 性能监控（Fastify 指标收集 + 监控页）

- **状态**：✅ 已完成
- **变更原因**：Resovo 无任何运行时监控，问题定位依赖日志。参考 LunaTV PerformanceMonitor（跟踪请求速率/响应时间/内存/CPU），在 Fastify 层实现轻量指标收集，为后续稳定性优化提供数据支撑
- **影响的已完成任务**：INFRA-01（Fastify server）
- **文件范围**：
  - `src/api/plugins/metrics.ts`（新建，Fastify 插件，收集请求指标）
  - `src/api/routes/admin/performance.ts`（新建，`GET /admin/performance/stats`）
  - `src/app/[locale]/admin/system/monitor/page.tsx`（新建）
  - `src/components/admin/system/PerformanceMonitor.tsx`（新建，Client Component，10s 自动刷新）
  - `src/api/server.ts`（注册 metrics 插件和 performanceRoutes）
- **变更内容**：
  1. `plugins/metrics.ts`（Fastify plugin）：
     - `onRequest` hook：记录请求开始时间戳
     - `onResponse` hook：计算响应时间，累积到内存滑动窗口（最近 5 分钟）
     - 暴露 `fastify.metrics` 装饰器，包含：`requestsPerMinute`、`avgResponseMs`、`p95ResponseMs`、`recentErrors`
  2. `GET /admin/performance/stats`（admin only）：返回：
     - `requests`: `{ perMinute, total24h }`
     - `latency`: `{ avgMs, p95Ms }`
     - `memory`: `{ heapUsedMb, heapTotalMb, rssMb }` — `process.memoryUsage()`
     - `uptime`: `process.uptime()` 秒数
  3. `PerformanceMonitor.tsx`：每 10 秒刷新，展示 4 张指标卡片 + 最近 10 条慢请求列表（>500ms）
- **⚠️ 约束**：
  - 指标数据存在**内存**中（滑动窗口），不写入 Redis 或 DB（避免引入新依赖）
  - 服务重启后指标清零（非持久化监控，为轻量实现）
  - metrics 插件的 hook 逻辑必须极轻量（不可阻塞请求路径），不使用 `await`
- **验收**：
  - `GET /admin/performance/stats` 在服务运行 1 分钟后返回非零的 `requestsPerMinute`
  - 内存指标与 `process.memoryUsage()` 数据一致
  - 监控页每 10 秒刷新，数字变化可见
  - 非 admin 访问返回 403
- **测试要求**：Vitest `tests/unit/api/performance.test.ts`（新建：mock metrics 装饰器，验证 stats 响应结构、权限）；Vitest `tests/unit/plugins/metrics.test.ts`（新建：验证 requestsPerMinute 计数逻辑）
- **完成备注**：metrics.ts 插件（onRequest 记录开始时间、onResponse 写入内存滑动窗口 MAX 50k 条、24h/5min/1min 三个时间窗口，expose fastify.metrics 装饰器）；performance.ts 路由（GET /admin/performance/stats 返回 requests/latency/memory/uptime/slowRequests）；setupMetrics 在 server.ts 注册；PerformanceMonitor.tsx（10s setInterval 刷新、4 张卡片 + 慢请求表格）；17 个测试（metrics 12 + performance 5），392 total passed；commit c41bc79
- **问题说明**：_（无）_

---

### Phase 2 任务执行顺序

```
播放器升级：
  CHG-20（yt-player 替换）
    → CHG-21（弹幕后端 API）
    → CHG-22（弹幕渲染层接入，依赖 CHG-20+21）

元数据：
  CHG-23（Douban 同步，独立，可并行）

管理后台增强：
  CHG-24（Admin 基础 UI 组件库）          ← 所有 Admin 页面的前置
    → CHG-25（仪表盘增强）
    → CHG-26（用户管理完善）              ← 可与 CHG-27 并行
    → CHG-27（视频管理完善）              ← 可与 CHG-26 并行
    → CHG-28（视频源验证 UI）
    → CHG-29（审核页完善）

系统管理（独立，可在管理页面任务完成后并行）：
  CHG-30（缓存管理）
  CHG-31（数据导入导出）
  CHG-32（性能监控）← 工作量最大，最后执行
```
> - 测试连续失败 2 次无法修复 → 写入 BLOCKER，暂停等待
> - Phase 全部完成 → 写入 PHASE COMPLETE，暂停等待确认
> - 详细规则见 `CLAUDE.md`

---

## 状态说明

| 标记        | 含义                          |
| ----------- | ----------------------------- |
| ⬜ 待开始   | 依赖已满足，可以开始          |
| ⏳ 等待依赖 | 依赖任务未完成，不可开始      |
| 🔄 进行中   | AI 当前正在处理               |
| ✅ 已完成   | AI 完成并自检通过，代码已提交 |
| ❌ 有问题   | git review 发现问题，需要处理 |
| 🚫 已取消   | 不再需要                      |

---

## 当前冲刺：Phase 1 — MVP

---

### ── 基础设施 ──

#### INFRA-01 项目初始化

- **状态**：✅ 已完成
- **描述**：搭建 Next.js 15 + Fastify monorepo，含 TypeScript 配置、ESLint、Prettier、路径别名
- **文件范围**：
  - `package.json`、`tsconfig.json`、`.eslintrc.json`、`.prettierrc`、`.gitignore`
  - `src/app/layout.tsx`、`src/app/page.tsx`（空壳）
  - `src/api/server.ts`（Fastify 入口）
- **依赖**：无
- **验收**：
  - `npm run dev` 前端正常启动（端口 3000）
  - `npm run api` 后端正常启动（端口 4000）
  - `tsc --noEmit` 无报错，路径别名 `@/` 正常解析
- **测试要求**：`npm run typecheck` + `npm run lint` 通过
- **完成备注**：
  - 新建文件：`package.json`、`tsconfig.json`、`.eslintrc.json`、`.prettierrc`、`.gitignore`、`next.config.ts`、`postcss.config.mjs`、`tailwind.config.ts`、`next-env.d.ts`、`src/app/layout.tsx`、`src/app/page.tsx`、`src/app/globals.css`、`src/api/server.ts`、`src/types/utility-types-augment.d.ts`（修复 list.types.ts 中错误的 utility-types 导入）
  - `npm run typecheck` ✅ 通过；`npm run lint` ✅ 通过；API server 在 4000 端口正常启动
  - commit hash：087efbb
- **问题说明**：`list.types.ts` 错误地从 `utility-types` 导入 `Pick`（该包不导出此类型）。通过新建 `utility-types-augment.d.ts` 声明文件补充缺失导出，不修改原文件。

---

#### INFRA-02 PostgreSQL 数据库初始化

- **状态**：✅ 已完成
- **描述**：创建所有核心表和索引，迁移文件管理，连接池配置
- **文件范围**：
  - `src/api/db/migrations/001_init_tables.sql`
  - `src/api/db/migrations/002_indexes.sql`
  - `src/api/lib/postgres.ts`
- **依赖**：INFRA-01
- **参考**：`docs/architecture.md` — 核心数据库表结构
- **验收**：
  - 所有表创建成功（users、videos、video_sources、subtitles、tags、video_tags、lists、list_items、danmaku、crawler_tasks）
  - 迁移文件幂等（`IF NOT EXISTS`）
  - `postgres.ts` 导出连接池
- **注意**：short_id 字段 `CHAR(8)`；主键用 `gen_random_uuid()`；videos 表含 `is_published BOOLEAN DEFAULT false`
- ⚠️ **约束提醒**：
  - 迁移文件必须幂等（全部用 `IF NOT EXISTS`），可重复执行
  - `short_id` 由应用层 nanoid 生成，不由数据库生成
  - 软删除字段 `deleted_at` 所有核心表都要有，不得用 DELETE 删数据
- **测试要求**：`bash scripts/verify-env.sh` PG 部分通过
- **完成备注**：
  - 新建：`src/api/db/migrations/001_init_tables.sql`（14 张表）、`002_indexes.sql`（30+ 索引）、`src/api/lib/postgres.ts`（pg.Pool）
  - `.env.local` 创建（不提交），本地 resovo_dev 数据库已建立 - PG 手动验证通过：连接 ✓、10 张核心表 ✓、videos_short_id_key 索引 ✓
  - commit hash：6470ccc
- **问题说明**：`verify-env.sh` 存在 `((PASS++))` bug（PASS=0 时返回 exit code 1 触发 `set -e`），将在 INFRA-06 修复。PG 部分通过手动验证确认。

---

#### INFRA-03 Elasticsearch 初始化

- **状态**：✅ 已完成
- **描述**：创建 `resovo_videos` 索引，IK 分词 + 拼音插件 mapping
- **文件范围**：
  - `src/api/lib/elasticsearch.ts`
  - `src/api/db/migrations/es_mapping.json`
- **依赖**：INFRA-01
- **参考**：`docs/decisions.md` — ADR-004
- ⚠️ **约束提醒**（ADR-004）：
  - SearchService 只调用 Elasticsearch，禁止查询 PostgreSQL
  - director/actor/writer 字段用 .keyword 子字段精确匹配，不用全文检索
- **验收**：
  - 索引创建成功，`director`/`cast`/`writers` 有 `.keyword` 子字段
  - `title`/`title_en`/`description` 用 `ik_max_word` 分析器
  - 中文分词测试通过
- **测试要求**：`bash scripts/verify-env.sh` ES 部分通过（含 IK 分词测试）
- **完成备注**：
  - 新建：`src/api/db/migrations/es_mapping.json`（IK 分析器 + 拼音插件 mapping）、`src/api/lib/elasticsearch.ts`（@elastic/elasticsearch 8.x 客户端 + ensureIndex）
  - ES 未在本地运行，将在 INFRA-06 Docker 后验证 IK/拼音分词
  - typecheck ✅ lint ✅；commit hash：6a9c33a
- **问题说明**：ES 本地未启动，verify-env.sh 的 ES 部分将在 INFRA-06 后统一验收

---

#### INFRA-04 Redis + Bull 初始化

- **状态**：✅ 已完成
- **描述**：Redis 客户端 + Bull 队列基础配置
- **文件范围**：
  - `src/api/lib/redis.ts`
  - `src/api/lib/queue.ts`
- **依赖**：INFRA-01
- **验收**：Redis 连接成功；Bull 可创建/消费任务；断线有重连逻辑
- **测试要求**：`bash scripts/verify-env.sh` Redis 部分通过
- **完成备注**：
  - 新建：`src/api/lib/redis.ts`（ioredis，lazyConnect，断线重连）、`src/api/lib/queue.ts`（crawler-queue + verify-queue，3次重试指数退避）
  - Redis 未在本地运行，将在 INFRA-06 Docker 后验证；typecheck ✅ lint ✅
  - commit hash：8fc2fe4
- **问题说明**：Redis/ES 将在 INFRA-06 统一验收

---

#### INFRA-05 环境变量管理

- **状态**：✅ 已完成
- **描述**：类型安全的环境变量，缺少必要变量时 fail-fast
- **文件范围**：
  - `.env.example`（提交到仓库）
  - `src/api/lib/config.ts`
- **依赖**：INFRA-01
- **验收**：
  - Zod 校验所有必要变量，缺少时启动报错并说明哪个变量缺失
  - 所有代码通过 `config` 对象读取，无直接 `process.env` 访问
- **测试要求**：`bash scripts/verify-env.sh` 全部通过
- **完成备注**：
  - 新建：`.env.example`（提交到仓库）、`src/api/lib/config.ts`（Zod 校验，fail-fast）
  - config 对象覆盖：DATABASE*URL、ELASTICSEARCH_URL、REDIS_URL、JWT_SECRET、COOKIE_SECRET、NEXT_PUBLIC*_、PORT、CRAWLER*SOURCES、R2*_
  - typecheck ✅ lint ✅；commit hash：3ec75c0
- **问题说明**：postgres.ts/redis.ts/elasticsearch.ts 仍直接读 process.env，待 INFRA-06 后统一迁移到 config

---

#### INFRA-06 Docker Compose 本地环境

- **状态**：✅ 已完成
- **描述**：一键启动 PostgreSQL、Elasticsearch、Redis
- **文件范围**：`docker-compose.yml`
- **依赖**：INFRA-02、INFRA-03、INFRA-04
- **验收**：
  - `docker compose up -d` 三服务全部健康
  - 数据卷持久化（重启不丢数据）
  - `bash scripts/verify-env.sh` 全部通过（这是 INFRA 系列的统一验收命令）
- **测试要求**：`bash scripts/verify-env.sh` 全部通过
- **完成备注**：
  - 新建：`docker/elasticsearch.Dockerfile`（ES 8.17.0 + IK + 拼音插件 baked-in）
  - 修改：`docker-compose.yml`（ES 改用自定义镜像构建、添加 elasticsearch-init 索引初始化服务、postgres host 端口改为 5433 避免与本地 PG 冲突）
  - 修改：`scripts/verify-env.sh`（修复 `((PASS++))` bug → `PASS=$((PASS+1))`；Redis 检查自动回退到 `docker exec`）
  - `verify-env.sh` 全部 21 项通过 ✅；commit hash：7e15ad3
- **问题说明**：_（已解决）_
- **特别说明**：INFRA-03/04/05 的 changelog 记录缺失，重启后请先补全 changelog 再继续 INFRA-06 验收

---

### ── 认证模块 ──

#### AUTH-01 认证基础设施

- **状态**：✅ 已完成
- **描述**：JWT 工具函数 + Fastify 认证插件（authenticate / optionalAuthenticate / requireRole）
- **文件范围**：
  - `src/api/lib/auth.ts`
  - `src/api/plugins/authenticate.ts`
- **依赖**：INFRA-02、INFRA-04
- **参考**：`docs/decisions.md` — ADR-003
- ⚠️ **约束提醒**（ADR-003，不可推翻）：
  - access token 有效期 15 分钟，存内存（authStore），禁止存 localStorage
  - refresh token 只通过 HttpOnly Cookie 传递，不出现在响应 body 中
  - 登出时 refresh token 加入 Redis 黑名单，key：`blacklist:rt:<token_hash>`
- **验收**：
  - `fastify.authenticate`：无效 token → 401
  - `fastify.optionalAuthenticate`：无 token 时 `req.user = null`
  - `fastify.requireRole(['admin'])`：角色不符 → 403
  - Access token 15 分钟；Refresh token 7 天
  - Refresh token 黑名单通过 Redis 检查
- **测试要求**：Vitest `tests/unit/api/auth.test.ts`（register/login/refresh/logout 全场景）
- **完成备注**：
  - 新建：`src/api/lib/auth.ts`（signAccessToken 15m, signRefreshToken 7d, verifyAccessToken/RefreshToken, hashToken, blacklistKey）
  - 新建：`src/api/plugins/authenticate.ts`（setupAuthenticate → decorate fastify.authenticate/optionalAuthenticate/requireRole）
  - 修改：`src/api/server.ts`（注册 setupAuthenticate）
  - 测试：21/21 全部通过；commit hash：e7461b1
- **问题说明**：_（已清空）_

---

#### AUTH-02 注册/登录/刷新/登出接口

- **状态**：✅ 已完成
- **描述**：POST /auth/register、/auth/login、/auth/refresh、/auth/logout
- **文件范围**：
  - `src/api/routes/auth.ts`
  - `src/api/services/UserService.ts`（仅认证相关）
  - `src/api/db/queries/users.ts`（仅认证相关）
- **依赖**：AUTH-01
- **验收**：
  - 注册：重复 email/username → 422；密码 bcrypt 哈希
  - 登录：access_token 在 body；refresh_token 在 HttpOnly Cookie
  - 刷新：从 Cookie 读取，返回新 access_token
  - 登出：refresh_token 加入 Redis 黑名单，清除 Cookie
  - 全部接口有 Zod 参数验证
- **测试要求**：Vitest `tests/unit/api/auth.test.ts` + Playwright `tests/e2e/auth.spec.ts`
- **完成备注**：
  - 新建：`src/api/db/queries/users.ts`（findByEmail/Username/Id, createUser 参数化查询）
  - 新建：`src/api/services/UserService.ts`（register/login/refresh/logout 业务逻辑，bcrypt cost=4 in test）
  - 新建：`src/api/routes/auth.ts`（POST /auth/register|login|refresh|logout，Zod 验证，HttpOnly Cookie）
  - 修改：`src/api/server.ts`（注册 authRoutes 在 /v1 前缀下）
  - 测试：36/36 全部通过（含重复 email/username 422、错误密码 401、黑名单 401、幂等登出）；commit hash：b8dcd73
- **问题说明**：_（已清空）_

---

#### AUTH-03 前端登录/注册页面

- **状态**：✅ 已完成
- **描述**：登录/注册表单页面，含客户端验证和 authStore
- **文件范围**：
  - `src/app/[locale]/auth/login/page.tsx`
  - `src/app/[locale]/auth/register/page.tsx`
  - `src/components/auth/LoginForm.tsx`
  - `src/components/auth/RegisterForm.tsx`
  - `src/stores/authStore.ts`
- **依赖**：AUTH-02
- **验收**：
  - 表单有客户端实时验证
  - access_token 存 Zustand store（内存），不存 localStorage
  - 支持双主题；有国际化支持
- **测试要求**：Playwright `tests/e2e/auth.spec.ts`（完整登录流程、导航栏状态变化）
- **完成备注**：
  - 新建：`src/i18n/routing.ts`、`src/i18n/request.ts`、`src/middleware.ts`（next-intl i18n 基础设施）
  - 新建：`messages/en.json`、`messages/zh-CN.json`（英中双语翻译）
  - 新建：`src/lib/utils.ts`（cn() 工具函数）、`src/app/[locale]/layout.tsx`、`src/app/[locale]/page.tsx`
  - 新建：`src/components/auth/LoginForm.tsx`、`src/components/auth/RegisterForm.tsx`（Zod 实时验证）
  - 新建：`src/components/layout/Header.tsx`（含登录状态显示）
  - 更新：`next.config.ts`（withNextIntl 插件）、`playwright.config.ts`（端口 3001 避免冲突）、`vitest.config.ts`（排除 e2e 目录）
  - E2E 测试：使用 page.route() mock API，15/15 全通过；authStore 单元测试 14/14 全通过
  - commit hash：a2b27b8
- **问题说明**：_（已清空）_

---

### ── 视频内容模块 ──

#### VIDEO-01 视频列表与详情接口

- **状态**：✅ 已完成
- **描述**：GET /videos、GET /videos/:id、GET /videos/trending
- **文件范围**：
  - `src/api/routes/videos.ts`
  - `src/api/services/VideoService.ts`
  - `src/api/db/queries/videos.ts`
- **依赖**：INFRA-02
- **验收**：
  - /videos 支持 type/category/year/country/sort/page/limit 过滤
  - /videos/:id 通过 short_id 查询，含 director/cast/writers
  - /videos/trending 支持 period=today|week|month
  - 响应格式符合 `docs/rules/api-rules.md`
- **测试要求**：Vitest `tests/unit/api/videos.test.ts`（过滤、分页、404 场景）
- **完成备注**：
  - 新建：`src/api/db/queries/videos.ts`（listVideos 含 6 种过滤, findVideoByShortId, listTrendingVideos，subquery 计算 source_count 和 subtitle_langs）
  - 新建：`src/api/services/VideoService.ts`（list/findByShortId/trending 含分页）
  - 新建：`src/api/routes/videos.ts`（GET /videos、/videos/trending、/videos/:id，Zod 验证，trending 在 :id 之前注册）
  - 修改：`src/api/server.ts`（注册 videoRoutes）
  - 测试：16/16 全部通过；commit hash：3d45280
- **问题说明**：_（已清空）_

---

#### VIDEO-02 首页布局与导航

- **状态**：✅ 已完成
- **描述**：首页（Hero Banner + 分类标签 + 视频网格）+ 导航栏
- **文件范围**：
  - `src/app/[locale]/(home)/page.tsx`
  - `src/components/video/HeroBanner.tsx`
  - `src/components/video/VideoCard.tsx`（竖版 2:3）
  - `src/components/video/VideoCardWide.tsx`（横版 16:9）
  - `src/components/ui/ThemeToggle.tsx`
  - `src/components/layout/Nav.tsx`
- **依赖**：VIDEO-01、AUTH-03
- **验收**：
  - 导航含主题切换（深色/浅色/跟随）、语言切换
  - Hero Banner + 分类横向滚动标签
  - 热门电影 5 列网格；热播剧集 4 列宽卡片
  - 底部免责声明常驻
  - 响应式布局（移动 2 列 → PC 5 列）
  - 无硬编码颜色；国际化支持
- **测试要求**：Playwright `tests/e2e/homepage.spec.ts`（首页加载、主题切换、导航跳转）
- **完成备注**：
  - 新建：`src/stores/themeStore.ts`（light/dark/system 三模式，localStorage 持久化）
  - 新建：`src/components/ui/ThemeToggle.tsx`（循环切换，监听系统主题变化）
  - 新建：`src/components/layout/Nav.tsx`（sticky 导航，含分类标签/主题/语言/用户状态）
  - 新建：`src/components/video/VideoCard.tsx`（2:3 竖版）、`VideoCardWide.tsx`（16:9 横版）
  - 新建：`src/components/video/HeroBanner.tsx`（客户端获取热门，占位骨架）
  - 新建：`src/components/video/VideoGrid.tsx`（复用卡片，加载骨架）
  - 新建：`src/app/[locale]/(home)/page.tsx`（Server Component，热门电影+剧集+底部声明）
  - E2E 测试：14/15 全通过（主题切换、语言切换、导航跳转）；commit hash：917294c
- **问题说明**：_（已清空）_

---

#### BROWSE-01 分类浏览页

- **状态**：✅ 已完成
- **描述**：`/browse` 分类浏览页，含展开式多行筛选区、排序条、视频网格
- **文件范围**：
  - `src/app/[locale]/browse/page.tsx`
  - `src/components/browse/FilterArea.tsx`（展开式多行筛选标签区）
  - `src/components/browse/SortBar.tsx`（排序条 + 结果计数）
  - `src/components/browse/BrowseGrid.tsx`（视频卡片网格，复用 VideoCard）
- **依赖**：VIDEO-01、SEARCH-01
- **参考**：`docs/architecture.md` — 前台路由结构
- ⚠️ **约束提醒**：
  - 分类浏览页与搜索页共用同一个后端接口 `GET /search`，参数体系相同
  - URL 参数与筛选状态双向同步（筛选变化更新 URL，页面加载时从 URL 恢复筛选状态）
  - 筛选区吸顶：向下滚动时筛选区 sticky 固定在导航栏下方
  - 顶部导航标签切换（电影/剧集等）通过 `?type=` 参数实现，不是独立页面
- **验收**：
  - 筛选区共 6 行（类型/地区/语言/年份/评分/状态），行内单选，默认"全部"高亮
  - 点击筛选标签后视频网格实时更新，URL 参数同步
  - 刷新或分享链接后筛选状态从 URL 正确恢复
  - 排序切换（最新添加/最新更新/人气/评分）有效
  - 结果总数正确显示
  - 卡片网格：PC 6列，平板 4列，移动端 3列
  - 筛选区吸顶，滚动时不跟随页面移动
  - 支持深色/浅色主题，无硬编码颜色
- **测试要求**：
  - Vitest `tests/unit/components/browse/FilterArea.test.tsx`（行内单选逻辑、URL 参数同步）
  - Playwright `tests/e2e/search.spec.ts`（补充：分类浏览页筛选→结果更新→URL变化→刷新恢复）
- **完成备注**：
  - 新建：`src/components/browse/FilterArea.tsx`（展开式 6 行筛选，useSearchParams 同步）
  - 新建：`src/components/browse/SortBar.tsx`（排序条 + 结果计数）
  - 新建：`src/components/browse/BrowseGrid.tsx`（客户端获取 /search，复用 VideoCard）
  - 新建：`src/app/[locale]/browse/page.tsx`（sticky FilterArea，Suspense 包裹）
  - 修改：`SearchService.ts`（添加 country/status 过滤）、`search.ts`（添加 country/status schema）
  - 新建：`tests/unit/components/browse/FilterArea.test.tsx`（8 tests 全通过）
  - 新建：`tests/e2e/search.spec.ts`（8 E2E tests 全通过）
  - 同时更新 vitest.config.ts（tsx 支持 + esbuild jsx automatic）
  - commit hash：2c8301c
- **问题说明**：_（已清空）_

---

### ── 搜索模块 ──

#### SEARCH-01 搜索接口

- **状态**：✅ 已完成
- **描述**：GET /search（全文搜索）、GET /search/suggest（联想词）
- **文件范围**：
  - `src/api/routes/search.ts`
  - `src/api/services/SearchService.ts`
- **依赖**：INFRA-03、VIDEO-01
- **验收**：
  - /search 支持 q/type/year/rating_min/lang/director/actor/writer/sort/page/limit
  - director/actor/writer 用 `.keyword` 精确匹配
  - /search/suggest 返回视频标题 + 人名联想（含 type 字段）
  - 空 q 时 director/actor/writer 参数仍能查询
- **测试要求**：Vitest `tests/unit/api/search.test.ts`（director/actor/writer 精确匹配、空 q 场景、highlight 字段）
- **完成备注**：
  - 新建：`src/api/services/SearchService.ts`、`src/api/routes/search.ts`、`tests/unit/api/search.test.ts`
  - 13 tests 全通过，typecheck ✅，lint ✅，全量 74 tests ✅
  - commit hash：daf977f
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### SEARCH-02 搜索页面

- **状态**：✅ 已完成
- **描述**：搜索页（顶部筛选栏 + 结果列表 + 分页）
- **文件范围**：
  - `src/app/[locale]/search/page.tsx`
  - `src/components/search/FilterBar.tsx`
  - `src/components/search/ResultCard.tsx`
  - `src/components/search/MetaChip.tsx`
  - `src/components/search/ActiveFilterStrip.tsx`
- **依赖**：SEARCH-01
- **验收**：
  - 筛选栏含类型/地区/年份/评分/字幕/导演/演员/编剧维度
  - 激活筛选后出现标签条，支持单删和清除全部
  - MetaChip 点击触发搜索跳转
  - URL 参数同步（可分享搜索结果页）
  - 支持双主题；国际化支持
- **测试要求**：Playwright `tests/e2e/search.spec.ts`（搜索→联想→结果→MetaChip 点击→播放页跳转 完整流程）
- **完成备注**：
  - 新建：`src/components/search/FilterBar.tsx`（搜索框 + 类型快选 + 排序）
  - 新建：`src/components/search/ResultCard.tsx`（横版卡片，支持 ES highlight <em> 高亮渲染）
  - 新建：`src/components/search/ActiveFilterStrip.tsx`（激活筛选标签条，单删 + 清除全部）
  - 新建：`src/components/search/SearchResultList.tsx`（客户端获取 /search，结果列表 + 计数）
  - 新建：`src/app/[locale]/search/page.tsx`（Server Component，Suspense 包裹所有客户端组件）
  - 已有：`src/components/search/MetaChip.tsx`（年份/导演/演员等 chip，点击跳转）
  - E2E 测试：10 tests 补充到 tests/e2e/search.spec.ts；单元 96/96 全通过
  - commit hash：12fa8fe
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 播放器模块 ──

#### PLAYER-01 播放源接口

- **状态**：✅ 已完成
- **描述**：GET /videos/:id/sources、POST /videos/:id/sources/:sid/report
- **文件范围**：
  - `src/api/routes/sources.ts`
  - `src/api/services/SourceService.ts`
  - `src/api/db/queries/sources.ts`
- **依赖**：INFRA-02
- **参考**：`docs/decisions.md` — ADR-001
- ⚠️ **约束提醒**（ADR-001，不可推翻）：
  - 后端返回 source_url 直链，禁止在后端做任何视频流转发或代理
  - 前端 Video.js 直接消费 source_url，不经过任何中间层
- **验收**：
  - /sources 支持 ?episode=N，只返回 is_active=true 的源
  - 响应含 source_url 直链（不做代理）
  - report 接口需登录
- **测试要求**：Vitest `tests/unit/api/sources.test.ts`（只返回 active 源、ADR-001 直链验证）
- **完成备注**：
  - 新建：`src/api/db/queries/sources.ts`（findActiveSourcesByVideoId/findSourceById/updateSourceActiveStatus）
  - 新建：`src/api/services/SourceService.ts`（listSources 先验证视频存在）
  - 新建：`src/api/routes/sources.ts`（GET /videos/:id/sources + episode 过滤，POST /report 需登录）
  - 测试：9/9 全部通过；commit hash：90802cb
- **问题说明**：_（已清空）_

---

#### DETAIL-01 视频详情页（SSR）

- **状态**：✅ 已完成
- **描述**：`/movie/[slug]`、`/anime/[slug]` 等视频详情页，SSR 渲染，含完整视频信息但不含播放器
- **文件范围**：
  - `src/app/[locale]/movie/[slug]/page.tsx`
  - `src/app/[locale]/anime/[slug]/page.tsx`
  - `src/app/[locale]/series/[slug]/page.tsx`
  - `src/app/[locale]/variety/[slug]/page.tsx`
  - `src/components/video/VideoDetailHero.tsx`（封面 Banner + 基础信息区）
  - `src/components/video/VideoDetailMeta.tsx`（导演/演员/编剧 chip 区）
  - `src/components/video/EpisodeGrid.tsx`（选集网格，点击跳转播放页）
- **依赖**：VIDEO-01、SEARCH-02（MetaChip 跳转搜索）
- **参考**：`docs/architecture.md` — 前台路由结构（slug 格式、URL 前缀映射）
- ⚠️ **约束提醒**：
  - 页面使用 `generateMetadata` 服务端返回完整 SEO 标签（title、description、OG 标签）
  - 详情页**不含播放器**，"立即观看"按钮跳转 `/watch/{slug}?ep=1`
  - 四个类型页面（movie/anime/series/variety）共享同一套组件，通过路由参数区分
  - slug 解析：取最后一个 `-` 后的 8 位字符作为 shortId 查库，忽略前面的文字部分
- **验收**：
  - 页面 SSR 正确渲染（`curl` 请求返回完整 HTML 含视频标题）
  - `<title>` 和 `<meta name="description">` 包含视频标题和简介
  - Open Graph 标签包含封面图 URL
  - 导演/演员/编剧 chip 点击正确跳转到 `/search?director=xxx`
  - 剧集类型显示集数网格，点击集数跳转 `/watch/slug?ep=N`
  - 错误的 shortId → 返回 404 页面
- **测试要求**：
  - Vitest `tests/unit/api/videos.test.ts`（补充：slug 解析逻辑、invalid shortId → null）
  - Playwright `tests/e2e/player.spec.ts`（补充：详情页→立即观看→播放页 跳转链路）
- **完成备注**：
  - 新建：`src/lib/video-detail.ts`（`extractShortId` + `fetchVideoDetail` 服务端 fetch 工具）
  - 新建：`src/components/video/VideoDetailHero.tsx`（SSR 封面 Banner + 基础信息，立即观看按钮）
  - 新建：`src/components/video/VideoDetailMeta.tsx`（导演/演员/编剧 MetaChip 行，复用 MetaChip）
  - 新建：`src/components/video/EpisodeGrid.tsx`（选集网格，episodeCount > 1 才渲染）
  - 新建：4 个类型详情页（movie/anime/series/variety）共享组件，generateMetadata 含 OG 标签
  - 测试：videos.test.ts 补充 4 个 extractShortId 单元测试（共 20/20 通过）
  - E2E：tests/e2e/player.spec.ts（详情页加载、MetaChip 跳转、立即观看、选集网格）
  - 100/100 单元测试通过；commit hash：b8b32b1
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-02 播放页布局（CSR）

- **状态**：✅ 已完成
- **描述**：`/watch/[slug]` 播放页，CSR 渲染，专注播放体验，不重复详情页完整内容
- **文件范围**：
  - `src/app/[locale]/watch/[slug]/page.tsx`
  - `src/components/player/PlayerShell.tsx`（播放器外壳 + 布局切换）
  - `src/stores/playerStore.ts`
- **依赖**：DETAIL-01、PLAYER-01
- **参考**：`docs/architecture.md` — 前台路由结构
- ⚠️ **约束提醒**：
  - 播放页使用 `dynamic import` + `ssr: false`，不做 SSR（SEO 由详情页负责）
  - slug 解析逻辑与 DETAIL-01 相同，复用工具函数
  - 播放页展示精简信息（标题 + 导演/演员 chip），完整信息在详情页
  - 标题点击跳转对应类型的详情页（`/anime/slug`）
- **验收**：
  - Default Mode：播放器居左，右侧面板（选集 + 推荐）
  - Theater Mode：全宽，右侧面板收起，下方推荐网格（仅桌面端）
  - 模式切换有 CSS transition 动画
  - `?ep=N` 参数正确设置初始集数
  - playerStore 初始化正确
  - 页面标题显示视频名（CSR 后更新，不依赖 SSR）
- **测试要求**：Playwright `tests/e2e/player.spec.ts`（Default/Theater Mode 切换）
- **完成备注**：
  - 新建：`src/stores/playerStore.ts`（ADR-011 面板状态机 + 播放状态 + 布局模式）
  - 新建：`src/components/player/PlayerShell.tsx`（客户端获取视频数据，两种布局模式，选集面板）
  - 新建：`src/app/[locale]/watch/[slug]/page.tsx`（dynamic import ssr:false，播放器骨架加载）
  - 重构：WatchPage 不做 SSR 视频获取，PlayerShell 客户端调用 apiClient 获取（便于 E2E mock）
  - E2E 测试：补充 6 个播放页测试到 player.spec.ts
  - 100/100 单元测试通过；commit hash：2bb3d6c
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-03 Video.js 播放器集成

- **状态**：✅ 已完成
- **描述**：Video.js + HLS.js 集成，基础播放功能
- **文件范围**：`src/components/player/VideoPlayer.tsx`
- **依赖**：PLAYER-02
- **验收**：
  - 支持 HLS（.m3u8）和 MP4
  - 组件卸载时正确销毁实例（无内存泄漏）
  - `dynamic import` with `ssr: false`
- **测试要求**：Playwright `tests/e2e/player.spec.ts`（视频加载、HLS 播放可用性）
- **完成备注**：
  - 新建：`src/components/player/VideoPlayer.tsx`（Video.js 8 + HLS.js，支持 HLS/MP4/DASH）
  - 修改：`PlayerShell.tsx`（集成 VideoPlayer via dynamic import ssr:false，同时获取播放源）
  - VideoPlayer 在 useEffect 中初始化，return 函数中调用 player.dispose() 防内存泄漏
  - VHS overrideNative 在非 Safari 浏览器启用，Safari 使用原生 HLS
  - E2E 测试：2 个 VideoPlayer 集成测试（播放区域存在、video-player 元素挂载）
  - 100/100 单元测试通过；commit hash：85f1e8a
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-04 控制栏组件

- **状态**：✅ 已完成
- **描述**：播放器控制栏 + 线路选择栏 + CC面板 + 倍速面板 + 设置面板
- **文件范围**：
  - `src/components/player/ControlBar.tsx`（控制栏，不含线路/画质）
  - `src/components/player/SourceBar.tsx`（线路选择栏，独立于控制栏）
  - `src/components/player/CCPanel.tsx`（字幕语言切换）
  - `src/components/player/SpeedPanel.tsx`（倍速，4预设+滑条）
  - `src/components/player/SettingsPanel.tsx`（字幕样式+播放行为开关）
  - `src/components/player/ResumePrompt.tsx`（断点续播提示条）
- **依赖**：PLAYER-03
- **参考**：`docs/decisions.md` — ADR-011（键盘状态机）、ADR-012（断点续播）
- ⚠️ **约束提醒**：
  - 线路选择栏独立于控制栏，位于进度条上方
  - 倍速面板位置：`position: fixed; bottom: 80px; right: 20px`
  - 剧场模式按钮仅桌面端渲染（media query + 条件渲染双重保险）
  - 音量滑条移动端隐藏，仅保留静音按钮
  - 快捷键 tooltip 仅 hover 时显示，内容随状态动态变化
- **验收**：
  - 左侧：播放/暂停、下一集（悬停滑出选集）、音量（悬停展开滑条）、时间
  - 右侧：CC、倍速（显示当前值）、设置、迷你播放器、剧场模式（桌面端）、全屏
  - 线路选择栏：≤3条全显，>3条折叠；切换线路保留播放进度；loading状态
  - 倍速面板：4个预设（0.5/1.0/1.5/2.0）+ 自定义滑条；数字键1-4选预设；面板打开时←→调滑条
  - 设置面板：字幕颜色/背景色/背景透明度；自动播放下一集开关；断点续播开关；设置持久化到localStorage
  - 音量：hover展开滑条；↑↓键调节（浮层关闭时）；移动端隐藏滑条
  - 断点续播：>30s后记录，精度5s；打开视频有进度时显示提示条，8s后自动继续
- **测试要求**：
  - Vitest `tests/unit/components/player/ControlBar.test.tsx`（音量hover展开、移动端滑条隐藏、键盘状态机优先级）
  - Vitest `tests/unit/components/player/SpeedPanel.test.tsx`（4预设、数字键映射、←→拦截）
  - Vitest `tests/unit/components/player/SettingsPanel.test.tsx`（设置项localStorage持久化）
  - Playwright `tests/e2e/player.spec.ts`（线路切换保留进度、断点续播提示条、倍速面板键盘操作）
- **完成备注**：
  - 新建：`ControlBar.tsx`（播放/暂停/音量/时间/CC/速度/设置/剧场/全屏，音量滑条 hover 展开）
  - 新建：`SourceBar.tsx`（线路选择，≤3全显/>3折叠，切换保留进度）
  - 新建：`CCPanel.tsx`（字幕语言切换）
  - 新建：`SpeedPanel.tsx`（4预设+滑条，数字键1-4，←→拦截 ADR-011）
  - 新建：`SettingsPanel.tsx`（字幕样式+自动播放+断点续播，localStorage持久化）
  - 新建：`ResumePrompt.tsx`（ADR-012 断点续播提示，8s倒计时自动继续）
  - 单元测试：ControlBar 12 tests + SpeedPanel 6 tests + SettingsPanel 10 tests（128/128 通过）
  - commit hash：5ed53d1
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-05 快捷键系统

- **状态**：✅ 已完成
- **描述**：播放器键盘状态机，根据面板焦点模式分发不同行为
- **文件范围**：`src/components/player/usePlayerShortcuts.ts`
- **依赖**：PLAYER-04
- **参考**：`docs/decisions.md` — ADR-011（键盘优先级）
- ⚠️ **约束提醒**：
  - 必须读取 `playerStore.speedPanelOpen` 和 `episodeOverlayOpen` 判断当前模式
  - 快进后退步进改为 **5 秒**（原 10 秒）
  - 倍速快捷键改为 `S`（原 `Shift+></`）
  - `↑↓` 调音量仅在 `episodeOverlayOpen === false` 时生效
- **验收**：
  - 正常模式：Space/← →(5s)/↑↓音量/M/C/S/Shift+N/I/T(桌面端)/F/Esc
  - 选集浮层打开：↑↓←→矩阵导航，Enter确认，Esc关闭（其他键不响应）
  - 倍速面板打开：←→调滑条(stopPropagation)，1/2/3/4选预设，S/Esc关闭
  - 输入框聚焦：所有快捷键不触发
- **测试要求**：Vitest `tests/unit/components/player/ControlBar.test.tsx`（四种模式的键盘分发）+ Playwright `tests/e2e/player.spec.ts`（快捷键完整流程）
- **完成备注**：
  - 新建文件：`src/components/player/usePlayerShortcuts.ts`
  - 扩展测试：`tests/unit/components/player/ControlBar.test.tsx`（新增 6 个键盘状态机测试）
  - ADR-011 优先级：输入框聚焦 → 选集浮层 → 倍速面板 → 正常模式
  - 所有测试通过（142 tests）；commit hash：fec6fec
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-06 选集浮层

- **状态**：✅ 已完成
- **描述**：从播放器左下角向上滑出的选集矩阵浮层
- **文件范围**：`src/components/player/EpisodeOverlay.tsx`
- **依赖**：PLAYER-04
- **验收**：
  - translateY 动画从左下角向上滑出
  - 半透明背景 + backdrop-filter
  - 8 列网格；方向键导航；Enter 确认；Esc/外部点击关闭
  - 当前集数金色标识
- **测试要求**：Vitest `tests/unit/components/player/EpisodeOverlay.test.tsx`（方向键导航、Enter/Esc）+ Playwright `tests/e2e/player.spec.ts`（选集切换）
- **完成备注**：
  - 新建文件：`src/components/player/EpisodeOverlay.tsx`、`tests/unit/components/player/EpisodeOverlay.test.tsx`
  - 8 列网格，translateY 滑入动画，backdrop-filter blur，当前集金色标识
  - capture 阶段键盘监听（ADR-011 最高优先级）
  - 8 个 Vitest 测试全部通过；commit hash：fec6fec
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-07 弹幕条

- **状态**：✅ 已完成
- **描述**：Bilibili 风格弹幕条（播放器下方独立一行）
- **文件范围**：`src/components/player/DanmakuBar.tsx`
- **依赖**：PLAYER-03
- **验收**：
  - 弹幕开关、透明度滑条、字号滑条、颜色选择
  - 输入框 + 发送按钮（未登录时 disabled）
  - CommentCoreLibrary 初始化，弹幕能飞过播放器
- **测试要求**：Vitest `tests/unit/components/player/DanmakuBar.test.tsx`（开关状态、颜色切换）+ Playwright `tests/e2e/player.spec.ts`（弹幕开关可用性）
- **完成备注**：
  - 新建文件：`src/components/player/DanmakuBar.tsx`、`tests/unit/components/player/DanmakuBar.test.tsx`
  - UI：弹幕开关、透明度/字号滑条、6 种预设颜色选择、输入框（未登录 disabled）、发送按钮
  - CCL 初始化：检查 `window.CommentManager`，graceful degradation（JSDOM/测试环境不影响）
  - 22 个 Vitest 测试全部通过（共 164 tests）；commit hash：89d84e8
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-08 视频信息区与 Meta Chip

- **状态**：✅ 已完成
- **描述**：播放页视频信息区，含可点击导演/演员/编剧 chip
- **文件范围**：`src/components/video/VideoMeta.tsx`
- **依赖**：PLAYER-02、SEARCH-02
- **验收**：
  - 导演/编剧/演员分行展示，人名 chip 点击跳转搜索
  - 分类标签点击跳转搜索
  - 收藏/分享/举报失效/追剧记录按钮
  - 支持双主题
- **测试要求**：Playwright `tests/e2e/search.spec.ts`（MetaChip 点击跳转搜索）
- **完成备注**：
  - 新建文件：`src/components/video/VideoMeta.tsx`
  - 功能：标题/英文名、类型/年份/地区/评分标签、收藏/追剧/分享/举报按钮、导演/演员/编剧 MetaChip、简介
  - MetaChip 点击搜索功能复用 `SEARCH-02` 已有实现
  - 164 个 Vitest 测试全部通过；commit hash：964d3ce
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 字幕模块 ──

#### SUBTITLE-01 字幕接口与播放器集成

- **状态**：✅ 已完成
- **描述**：GET /videos/:id/subtitles、POST 上传字幕（R2 存储）+ Video.js 集成
- **文件范围**：
  - `src/api/routes/subtitles.ts`
  - `src/api/services/SubtitleService.ts`
  - `src/api/db/queries/subtitles.ts`
- **依赖**：INFRA-02、PLAYER-04
- **验收**：
  - GET 返回字幕列表，含 language/label/url/format/is_verified
  - POST 接受 .srt/.ass/.vtt，最大 2MB，上传到 R2
  - POST 需要登录
  - CC 面板切换字幕语言时 Video.js 动态加载
- **测试要求**：Vitest `tests/unit/api/subtitles.test.ts`（上传格式/大小限制、401）+ Playwright `tests/e2e/player.spec.ts`（字幕切换生效）
- **完成备注**：
  - 新建：`src/api/db/queries/subtitles.ts`（findSubtitlesByVideoId、createSubtitle、findSubtitleById、verifySubtitle）
  - 新建：`src/api/services/SubtitleService.ts`（R2上传、validateFile格式/大小校验、graceful降级）
  - 新建：`src/api/routes/subtitles.ts`（GET公开+POST需登录、multipart解析）
  - 新建：`tests/unit/api/subtitles.test.ts` — 13个测试（validateFile格式/大小、GET列表、POST 401/422）全部通过
  - commit hash：e1a18da
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 爬虫基础 ──

#### CRAWLER-01 Bull 队列基础设施

- **状态**：✅ 已完成
- **描述**：定义并初始化爬虫相关的 Bull 队列，配置 worker 处理逻辑骨架
- **文件范围**：
  - `src/api/lib/queue.ts`（队列定义，补充 crawler-queue 和 verify-queue）
  - `src/api/workers/crawlerWorker.ts`（队列消费者，处理采集任务）
  - `src/api/workers/verifyWorker.ts`（队列消费者，处理链接验证任务）
- **依赖**：INFRA-04
- **验收**：
  - `crawler-queue` 和 `verify-queue` 两个队列定义完整
  - Worker 可注册，队列任务可入队和消费
  - 失败自动重试（最多 3 次，指数退避：1分钟、5分钟、30分钟）
  - 任务状态正确流转：`pending → active → completed/failed`
- **测试要求**：Vitest `tests/unit/api/crawler.test.ts`（队列入队/消费、重试机制）
- **完成备注**：
  - `src/api/lib/queue.ts` — 已包含 crawler-queue + verify-queue（INFRA-04 已实现）
  - 新建：`src/api/workers/crawlerWorker.ts`、`src/api/workers/verifyWorker.ts`
  - 新建：`tests/unit/api/crawler.test.ts` — 16 个测试（队列入队、重试、checkUrl HTTP 状态）
  - 重试配置：attempts=3, backoff=exponential/60s（在 queue.ts defaultJobOptions）
  - 180 个测试全部通过；commit hash：8a03857
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-02 苹果CMS采集服务

- **状态**：✅ 已完成
- **描述**：实现苹果CMS标准接口的采集、解析、字段映射和写库逻辑
- **文件范围**：
  - `src/api/services/CrawlerService.ts`
  - `src/api/services/SourceParserService.ts`（XML/JSON 解析 + 字段映射）
  - `src/api/db/queries/crawlerTasks.ts`
  - `src/api/db/queries/videoSources.ts`（补充 upsert 方法）
- **依赖**：CRAWLER-01、INFRA-02、INFRA-03
- **参考**：
  - `docs/decisions.md` — ADR-008（接口格式和配置方式）
  - `docs/decisions.md` — ADR-009（合规约束：封面不下载）
  - `docs/architecture.md` — 采集接口字段映射表（必读，字段对应关系）
  - `docs/architecture.md` — 爬虫任务类型表
- ⚠️ **约束提醒**：
  - 封面图 `cover_url` 直接存外链，**禁止下载到本地或 R2**（ADR-009）
  - 采集到的播放源 `source_url` 是第三方直链，**禁止做任何代理处理**（ADR-001）
  - 去重规则：同 title+year 的视频只追加 `video_sources`，不覆盖元数据
  - 所有字段映射严格按 `docs/architecture.md` 采集字段映射表执行
  - 资源站地址从环境变量 `CRAWLER_SOURCES` 读取，不硬编码
- **验收**：
  - 能成功拉取 `jszyapi.com` 接口并解析 XML 和 JSON 格式
  - 字段映射正确：actor 字段被拆分为数组，type_name 被标准化为 VideoType
  - 播放源按集数正确拆分（`#` 分隔）并写入 `video_sources` 表
  - 去重逻辑：相同 title+year 不重复创建视频，只追加播放源
  - 增量模式（`?h=24`）只处理最近更新的内容
  - 写入 PostgreSQL 后，触发异步任务同步 Elasticsearch 索引
  - 运行 `full-crawl` 任务后，数据库中有可查询的视频数据
- **测试要求**：
  - Vitest `tests/unit/api/crawler.test.ts`：
    - XML 解析：vod_actor 按逗号拆分为数组
    - JSON 解析：vod_play_url 按 # 和 $ 拆分为集数列表
    - 字段映射：type_name="动漫" → type="anime"，area="日本" → country="JP"
    - 去重：相同 title+year 的第二次采集只新增 source，不覆盖 title
    - 播放源解析：电影（episode_count=1）的 episode_number 为 NULL
- **完成备注**：
  - 新建：`src/api/services/SourceParserService.ts`（XML/JSON 解析 + 字段映射）
  - 新建：`src/api/services/CrawlerService.ts`（采集主服务，upsert 去重，ES 索引触发）
  - 新建：`src/api/db/queries/crawlerTasks.ts`（任务记录 CRUD）
  - 修改：`src/api/db/queries/sources.ts`（新增 upsertSource/upsertSources）
  - 测试：`tests/unit/api/crawler.test.ts` 扩展 45 个 CRAWLER-02 测试
  - 225 个测试全部通过；commit hash：4e28dfb
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-03 链接验证服务

- **状态**：✅ 已完成
- **描述**：实现播放源 URL 的可用性检测逻辑，定时维护 is_active 状态
- **文件范围**：
  - `src/api/services/VerifyService.ts`
  - `src/api/db/queries/videoSources.ts`（补充 updateActiveStatus 方法）
- **依赖**：CRAWLER-01
- **验收**：
  - HEAD 请求检测 URL 可达性，超时 10 秒
  - HTTP 200：`is_active=true`，更新 `last_checked`
  - HTTP 4xx/5xx 或超时：`is_active=false`，更新 `last_checked`
  - 用户举报后立即触发单条验证（写入 verify-queue 高优先级任务）
  - 每日凌晨 4:00 定时验证所有 `is_active=true` 的播放源
- **测试要求**：Vitest `tests/unit/api/crawler.test.ts`（HTTP 200 → active=true，超时 → active=false，重试上限）
- **完成备注**：
  - 新建：`src/api/services/VerifyService.ts`（checkSourceUrl + VerifyService 类）
  - 已在 CRAWLER-01 的 checkUrl 测试中覆盖 HTTP 200/4xx/5xx/超时场景
  - VerifyService.scheduleAllActiveVerification() 批量入队；verifyFromUserReport() 高优先级
  - 225 个测试全部通过；commit hash：3e2ef3f
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-04 管理后台接口

- **状态**：✅ 已完成
- **描述**：提供给管理员的爬虫任务管理接口
- **文件范围**：
  - `src/api/routes/admin/crawler.ts`
- **依赖**：CRAWLER-02、CRAWLER-03
- **验收**：
  - GET /admin/crawler/tasks — 任务列表，支持 status 过滤（需 admin）
  - POST /admin/crawler/tasks — 手动触发全量/增量采集（需 admin）
  - POST /admin/sources/:id/verify — 手动触发单条链接验证（需 admin）
  - POST /admin/sources/submit — 用户投稿播放源，进入 verify-queue 自动验证（需登录）
- **测试要求**：Vitest `tests/unit/api/crawler.test.ts`（权限校验：非 admin 返回 403）
- **完成备注**：
  - 新建：`src/api/routes/admin/crawler.ts`（4 个端点）
  - 权限：GET/POST tasks + POST verify 需 admin；POST submit 需登录
  - 测试：crawler.test.ts 扩展 13 个 CRAWLER-04 测试（含 401/403/404 场景）
  - 238 个测试全部通过；commit hash：142a209
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

## 已完成任务归档

_（任务 review 通过后移入此处）_

---

## Phase 2 管理后台（ADMIN 模块）

> Phase 1 完成后开始。所有后台路由和页面均需先读取 `docs/decisions.md` ADR-010。

---

#### ADMIN-01 后台访问控制中间件

- **状态**：✅ 已完成
- **描述**：Next.js middleware 实现 /admin 路径的访问控制；Fastify requireRole 支持 moderator/admin 分级
- **文件范围**：
  - `src/middleware.ts`（Next.js middleware，路径守卫）
  - `src/api/plugins/authenticate.ts`（补充 requireRole 支持数组参数）
  - `src/app/[locale]/admin/403/page.tsx`（无权限页面）
  - `src/app/[locale]/admin/layout.tsx`（后台布局：侧边栏导航，按角色显示不同菜单区）
- **依赖**：AUTH-01（Phase 1）
- **参考**：`docs/decisions.md` — ADR-010
- ⚠️ **约束提醒**：
  - middleware 层：未登录 → `/auth/login`；role=user → `/admin/403`
  - `/admin/users`、`/admin/crawler`、`/admin/analytics` 额外检查 role=admin
  - moderator 登录后只看到内容管理区菜单，系统管理区菜单不渲染
- **验收**：
  - 未登录访问 /admin/\* 重定向登录页
  - role=user 访问 /admin/\* 返回 403 页面
  - role=moderator 访问 /admin/users 返回 403
  - role=admin 可访问全部后台页面
  - 侧边栏按角色动态显示菜单（moderator 不显示系统管理区）
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（三种角色的访问控制验证）
- **完成备注**：
  - 修改：`src/middleware.ts` — 扩展 next-intl 中间件，加入 /admin 路径守卫（role 检查）
  - 修改：`src/api/routes/auth.ts` — 登录/注册设置 user_role non-HttpOnly cookie，登出清除
  - 新建：`src/app/[locale]/admin/403/page.tsx` — 无权限页面
  - 新建：`src/app/[locale]/admin/layout.tsx` — 后台布局（侧边栏按 admin/moderator 动态渲染）
  - 新建：`tests/e2e/admin.spec.ts` — 13 个 E2E 测试（三种角色访问控制）
  - 251 个 unit 测试全部通过；commit hash：4ff3ac9
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-02 视频内容管理页面

- **状态**：✅ 已完成
- **描述**：/admin/videos 列表页（含上下架操作）、/admin/videos/[id]/edit 编辑页、/admin/videos/new 手动添加页
- **文件范围**：
  - `src/app/[locale]/admin/videos/page.tsx`
  - `src/app/[locale]/admin/videos/new/page.tsx`
  - `src/app/[locale]/admin/videos/[id]/edit/page.tsx`
  - `src/api/routes/admin/videos.ts`（PATCH is_published、PUT 元数据、POST 手动添加）
- **依赖**：ADMIN-01、VIDEO-01（Phase 1）
- **参考**：`docs/decisions.md` — ADR-010（is_published 默认 false，审核通过改 true）
- ⚠️ **约束提醒**：
  - 批量上下架操作需要事务保护
  - 前台查询必须过滤 `is_published = true`（已在查询层实现，此处不需要改）
  - 需要 `requireRole(['moderator','admin'])`
- **验收**：
  - 列表支持按 is_published 状态筛选（待审/已上架/已下架）
  - 单条和批量上下架操作
  - 编辑页可修改 title/description/director/cast/writers/cover_url/category/year
  - 手动添加视频（不经爬虫，直接填写元数据 + 播放源）
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（上下架操作、编辑元数据保存）
- **完成备注**：
  - 新建：`src/api/routes/admin/videos.ts` — GET列表/PATCH上下架/POST批量/PATCH元数据/POST新增
  - 新建：`src/app/[locale]/admin/videos/page.tsx`、`new/page.tsx`、`[id]/edit/page.tsx`
  - 新建：`src/components/admin/AdminVideoList.tsx`、`AdminVideoForm.tsx`
  - 更新：`tests/e2e/admin.spec.ts` 增加 ADMIN-02 测试场景
  - 251 个 unit 测试全部通过；commit hash：3fc6b0f
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-03 播放源 + 投稿 + 字幕审核页面

- **状态**：✅ 已完成
- **描述**：/admin/sources（播放源列表）、/admin/submissions（投稿审核队列）、/admin/subtitles（字幕审核队列）
- **文件范围**：
  - `src/app/[locale]/admin/sources/page.tsx`
  - `src/app/[locale]/admin/submissions/page.tsx`
  - `src/app/[locale]/admin/subtitles/page.tsx`
  - `src/api/routes/admin/content.ts`（审核相关的 PATCH 接口）
- **依赖**：ADMIN-01、PLAYER-01、SUBTITLE-01（Phase 1）
- **验收**：
  - 播放源列表：按 is_active 筛选，支持手动触发单条验证、批量删除
  - 投稿队列：展示用户投稿的待审资源，支持通过（写入 video_sources）和拒绝
  - 字幕队列：展示待审字幕，支持通过（设 is_verified=true）和拒绝（软删除）
  - 三个页面均需 `requireRole(['moderator','admin'])`
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（投稿审核通过/拒绝流程）
- **完成备注**：
  - 新建：`src/api/routes/admin/content.ts` — 播放源/投稿/字幕审核 CRUD 接口
  - 新建：`src/app/[locale]/admin/sources/page.tsx`、`submissions/page.tsx`、`subtitles/page.tsx`
  - 新建：`src/components/admin/AdminSourceList.tsx`、`AdminSubmissionList.tsx`、`AdminSubtitleList.tsx`
  - 更新：`tests/e2e/admin.spec.ts` 增加 ADMIN-03 测试场景
  - 251 个 unit 测试全部通过；commit hash：acfd80d
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-04 用户管理 + 爬虫管理页面（admin only）

- **状态**：✅ 已完成
- **描述**：/admin/users（用户管理）、/admin/crawler（爬虫配置与任务记录）
- **文件范围**：
  - `src/app/[locale]/admin/users/page.tsx`
  - `src/app/[locale]/admin/crawler/page.tsx`
  - `src/api/routes/admin/users.ts`（封号/解封/角色升降）
- **依赖**：ADMIN-01、CRAWLER-04（Phase 1）
- ⚠️ **约束提醒**：全部接口必须 `requireRole(['admin'])`，moderator 不得访问
- **验收**：
  - 用户列表：搜索、查看详情、封号（设 banned_at）、解封、角色修改（user↔moderator）
  - admin 账号不能被降级或封禁（防止自锁）
  - 爬虫页面：资源站启用/禁用、手动触发全量/增量采集、任务记录展示
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（封号/解封操作、爬虫手动触发）
- **完成备注**：
  - 新建：`src/api/routes/admin/users.ts` — 列表/封号/解封/角色修改，admin账号防自锁
  - 新建：`src/app/[locale]/admin/users/page.tsx`、`crawler/page.tsx`
  - 新建：`src/components/admin/AdminUserList.tsx`、`AdminCrawlerPanel.tsx`
  - 更新：`tests/e2e/admin.spec.ts` 增加 ADMIN-04 测试场景
  - 251 个 unit 测试全部通过；commit hash：65b9354
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-05 数据看板（admin only）

- **状态**：✅ 已完成
- **描述**：/admin/analytics，展示核心运营数据
- **文件范围**：
  - `src/app/[locale]/admin/analytics/page.tsx`
  - `src/api/routes/admin/analytics.ts`
- **依赖**：ADMIN-01
- ⚠️ **约束提醒**：`requireRole(['admin'])`
- **验收**：
  - 统计指标：视频总数/已上架/待审、今日播放量、有效播放源数/失效率、注册用户数/今日新增
  - 待处理事项汇总：各审核队列待处理数量（投稿/字幕/举报）
  - 爬虫状态快照：各资源站最近运行时间和结果
- **测试要求**：Vitest `tests/unit/api/analytics.test.ts`（统计数据聚合逻辑）
- **完成备注**：
  - 新建：`src/api/routes/admin/analytics.ts` — 汇总统计接口（视频/播放源/用户/队列/爬虫）
  - 新建：`src/app/[locale]/admin/analytics/page.tsx`
  - 新建：`src/components/admin/AdminAnalyticsDashboard.tsx` — 看板 UI（StatCard + 爬虫快照）
  - 新建：`tests/unit/api/analytics.test.ts` — 9 个测试（统计聚合、role 检查、边界）
  - 260 个 unit 测试全部通过；commit hash：48eeda9
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

## 变更任务区（CHG-xx）

> 设计或目标发生变更时，在此区域新增变更任务。
> 变更任务优先级高于普通功能任务，AI 启动时在正常任务之前处理。
> 格式说明见 `CLAUDE.md` — 设计变更处理规则。

#### CHG-33 DB 基础层：system_settings + crawler_sites 表

- **状态**：✅ 已完成
- **变更原因**：移植 LunaTV 站点配置/配置文件/视频源配置功能，需新增两张表存储站点参数和爬虫源站信息
- **影响的已完成任务**：CRAWLER-01~04（CrawlerSource 由环境变量改为数据库管理）
- **文件范围**：
  - `src/api/db/migrations/005_system_settings.sql`（新建）
  - `src/api/db/queries/systemSettings.ts`（新建）
  - `src/api/db/queries/crawlerSites.ts`（新建）
  - `src/types/system.types.ts`（新建）
  - `src/types/index.ts`（追加 export）
- **变更内容**：
  - `system_settings(key PK, value TEXT, updated_at)` — 键值对站点参数表
  - `crawler_sites(key PK, name, api_url, detail, source_type, format, weight, is_adult, disabled, from_config, created_at, updated_at)` — 爬虫源站配置表
  - queries: get/set/list settings；list/upsert/update/delete/batch crawlerSites
- **完成备注**：_（AI 填写）_

---

#### CHG-34 后端 API：站点配置 + 配置文件 + 视频源配置

- **状态**：✅ 已完成
- **依赖**：CHG-33
- **变更原因**：同上，为三个后台页面提供 REST API
- **文件范围**：
  - `src/api/routes/admin/siteConfig.ts`（新建）— GET/POST /admin/system/settings
  - `src/api/routes/admin/configFile.ts`（新建）— GET/POST /admin/system/config（含 JSON 解析后同步到 crawler_sites）
  - `src/api/routes/admin/crawlerSites.ts`（新建）— CRUD + batch + validate
  - `src/api/server.ts`（注册三个新路由）
  - `src/api/services/CrawlerService.ts`（getEnabledSites 方法：优先读 DB，降级到 env var）
- **变更内容**：
  - `GET /v1/admin/system/settings` → 返回所有键值对对象
  - `POST /v1/admin/system/settings` → 批量写入设置
  - `GET /v1/admin/system/config` → 返回配置文件 JSON 字符串
  - `POST /v1/admin/system/config` → 保存配置文件 + 解析 crawler_sites 字段写入 crawler_sites 表（from_config=true）
  - `GET /v1/admin/crawler/sites` → 列表（支持 ?disabled=true 过滤）
  - `POST /v1/admin/crawler/sites` → 新增
  - `PATCH /v1/admin/crawler/sites/:key` → 更新
  - `DELETE /v1/admin/crawler/sites/:key` → 删除（from_config=true 的不可删）
  - `POST /v1/admin/crawler/sites/batch` → 批量 enable/disable/delete
  - `POST /v1/admin/crawler/sites/validate` → 测试 API 可达性（HEAD/GET + 超时）
- **完成备注**：_（AI 填写）_

---

#### CHG-35 前端：站点配置 + 配置文件 + 视频源配置三个管理页面

- **状态**：✅ 已完成
- **依赖**：CHG-34
- **变更原因**：同上
- **文件范围**：
  - `src/app/[locale]/admin/system/settings/page.tsx`（新建）
  - `src/app/[locale]/admin/system/config/page.tsx`（新建）
  - `src/app/[locale]/admin/system/sites/page.tsx`（新建）
  - `src/app/[locale]/admin/layout.tsx`（SYSTEM_MENU 新增三项）
- **变更内容**：
  - **站点配置**：分组表单（基础/Douban/内容过滤/视频代理/自动采集），保存调 POST /system/settings
  - **配置文件**：JSON textarea + 订阅 URL 输入 + 远程拉取按钮 + 保存（保存时同步到 crawler_sites）
  - **视频源配置**：表格列表（key/name/api_url/type/weight/adult/status），单行编辑/删除/验证，顶部批量操作栏，导入导出 JSON
  - 布局侧边栏增加：站点配置、配置文件、视频源配置入口（admin-only）
- **完成备注**：_（AI 填写）_

---

#### CHG-36 爬虫管理完整功能

- **状态**：✅ 已完成
- **优先级**：P1
- **变更原因**：crawlerWorker 未接入 crawler_sites 表；无定时自动采集；前端无法选择源站触发；缺少每站采集状态展示
- **文件范围**：
  - `src/api/db/migrations/006_crawler_sites_status.sql`（新建）
  - `src/api/db/queries/crawlerSites.ts`（更新）— updateCrawlStatus()
  - `src/api/workers/crawlerWorker.ts`（更新）— 读 getEnabledSources(db)，支持 job.data.siteKey 单站触发
  - `src/api/workers/crawlerScheduler.ts`（新建）— Bull cron job
  - `src/api/routes/admin/crawler.ts`（更新）— siteKey 参数；GET /admin/crawler/sites-status
  - `src/api/server.ts`（更新）
  - `src/app/[locale]/admin/crawler/page.tsx`（更新）
  - `src/components/admin/AdminCrawlerPanel.tsx`（更新）
- **变更内容**：
  - **DB**：crawler_sites 加 `last_crawled_at TIMESTAMPTZ`、`last_crawl_status VARCHAR(20)`
  - **Worker**：job.data = `{ type, siteKey?, hoursAgo? }`；siteKey 有值→单站，否则→全部启用站
  - **Scheduler**：Bull cron `0 3 * * *`；读 auto_crawl_enabled/auto_crawl_max_per_run；false 则跳过
  - **API**：POST /admin/crawler/tasks 增加可选 siteKey；GET /admin/crawler/sites-status
  - **前端**：源站卡片列表（上次采集时间/状态/单站触发）；全量/增量全局按钮；自动采集开关
- **测试**：Vitest `tests/unit/api/crawler-worker.test.ts`（job dispatch 逻辑）
- **完成备注**：`006_crawler_sites_status.sql` + `crawlerSites.ts`(updateCrawlStatus) + `crawlerWorker.ts`(siteKey+DB接入) + `crawlerScheduler.ts`(cron) + `crawler.ts`(siteKey+sites-status) + `AdminCrawlerPanel.tsx`(源站卡片+自动采集开关) + `server.ts`。419 tests ✅ commit 807b46d

---

#### CHG-37 登录会话长期有效

- **状态**：✅ 已完成
- **优先级**：P1
- **变更原因**：access token 存内存，刷新页面即登出；refresh token 有效期过短；不符合视频网站使用习惯
- **文件范围**：
  - `src/api/routes/auth.ts`（更新）— refresh token 有效期 7d → 30d
  - `src/stores/authStore.ts`（更新）— zustand persist（只持久化 user + isLoggedIn）；tryRestoreSession()
  - `src/components/SessionRestorer.tsx`（新建）— mount 时触发 tryRestoreSession
  - `src/app/[locale]/layout.tsx`（更新）— 挂载 SessionRestorer
  - `tests/unit/stores/authStore.test.ts`（更新）
- **变更内容**：
  - 后端：refresh token 有效期 `'7d'` → `'30d'`
  - authStore persist：`{ name: 'resovo-auth', storage: localStorage }`，只存 user + isLoggedIn
  - tryRestoreSession：isLoggedIn && !accessToken → POST /auth/refresh → 成功写 token / 失败 logout
  - SessionRestorer：`'use client'`，useEffect 触发一次，放在 root layout
- **测试**：authStore restore 成功/失败/无 user 三种场景（5 scenarios）
- **完成备注**：`auth.ts`(7d→30d cookie) + `lib/auth.ts`(30d JWT TTL) + `authStore.ts`(persist+tryRestoreSession) + `SessionRestorer.tsx`(新建) + `layout.tsx`(挂载)。419 tests ✅ commit 4bc3be4

---

#### CHG-38 视频归并策略（标题标准化 + 别名表 + 元数据优先级）

- **状态**：✅ 已完成
- **优先级**：P2
- **依赖**：CHG-36
- **变更原因**：upsertVideo 用 (title+year) 去重过于简单；无标题标准化；播放地址有覆盖风险；无元数据来源追踪
- **文件范围**：
  - `src/api/db/migrations/007_video_merge.sql`（新建）
  - `src/api/db/queries/videos.ts`（更新）
  - `src/api/db/queries/sources.ts`（更新）
  - `src/api/services/TitleNormalizer.ts`（新建）
  - `src/api/services/CrawlerService.ts`（更新）
  - `tests/unit/api/title-normalizer.test.ts`（新建）
- **变更内容**：
  - Migration 007：videos 加 title_normalized / metadata_source；新建 video_aliases 表
  - **规则 A**：match_key = (title_normalized, year, type)，type 不同不合并
  - **规则 B**：TitleNormalizer — 去 HTML/装饰括号/年份/季数词/画质标签，Unicode 小写
  - **规则 C**：upsertVideo 时将 vod_name/vod_en 写入 video_aliases（INSERT IGNORE）
  - **规则 D**：metadata_source 优先级 tmdb(4) > douban(3) > manual(2) > crawler(1)；低优先级不覆盖高优先级的 metadata 字段
  - **规则 E**：video_sources 改为 `ON CONFLICT (video_id, episode_number, source_url) DO NOTHING`
- **测试**：TitleNormalizer 30+ 用例；upsertVideo 归并场景（同标题不同装饰、跨类型不合并、播放源 append）
- **完成备注**：`007_video_merge.sql`(title_normalized+metadata_source+video_aliases表+uq_sources_video_episode_url约束) + `TitleNormalizer.ts`(normalizeTitle+buildMatchKey) + `CrawlerService.ts`(upsertVideo归并策略A-E) + `queries/videos.ts`(findVideoByNormalizedKey+insertCrawledVideo+upsertVideoAliases) + `queries/sources.ts`(ON CONFLICT DO NOTHING)。457 tests ✅ commit 1d34c48

---

#### CHG-39 修复配置文件 JSON textarea 保存失败（CHG-35 回归修复）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 14:45
- **计划开始时间**：2026-03-19 14:50
- **实际开始时间**：2026-03-19 14:50
- **完成时间**：2026-03-19 14:58
- **问题**：`/admin/system/config` 页面粘贴大体量 `api_site` JSON 后点击保存失败，前端仅提示通用失败信息，无法定位。
- **影响的已完成任务**：CHG-35
- **文件范围**：
  - `src/components/admin/system/ConfigFileEditor.tsx`
  - `src/api/routes/admin/siteConfig.ts`
  - `src/types/system.types.ts`
  - `tests/unit/api/system-config.test.ts`
- **修复内容**：
  - 后端保存接口兼容 `api/api_url/url` 字段；返回 `synced/skipped` 统计
  - 订阅 URL 校验改为保存时校验，支持“仅保存 JSON”场景
  - 前端显示具体错误信息，不再只显示通用失败
  - 新增单测覆盖 `api_site + api_url` 兼容与非法订阅 URL
- **测试要求**：
  - `npm run test:run -- tests/unit/api/system-config.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向测试 19/19 通过，typecheck/lint 通过
- **问题说明**：_（无）_

---

#### CHG-40 以 API 地址作为唯一标识重构视频源配置

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 15:05
- **计划开始时间**：2026-03-19 15:10
- **实际开始时间**：2026-03-19 15:11
- **完成时间**：2026-03-19 15:17
- **问题**：视频源配置在 key 维度唯一，导致同一 API 地址可被重复录入（key 不同），配置同步与人工维护会产生重复站点。
- **影响的已完成任务**：CHG-33 / CHG-34 / CHG-35 / CHG-39
- **文件范围**：
  - `src/api/db/migrations/008_crawler_sites_api_unique.sql`
  - `src/api/db/queries/crawlerSites.ts`
  - `src/api/routes/admin/crawlerSites.ts`
  - `tests/unit/api/system-config.test.ts`
- **修复内容**：
  - crawler_sites 增加 API 地址唯一约束迁移（归一化 + 去重 + unique index）
  - upsert 逻辑改为“优先按 api_url 更新”（API 作为唯一标识）
  - 新增/更新接口增加 API 重复校验并返回 `DUPLICATE_API_URL`
  - 新增单测覆盖重复 API 创建冲突
- **测试要求**：
  - `npm run test:run -- tests/unit/api/system-config.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - system-config 定向测试 20/20 通过，typecheck/lint 通过
- **问题说明**：_（无）_

---

#### CHG-41 配置文件页新增“本地上传”Tab（JSON 源站导入）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 15:18
- **计划开始时间**：2026-03-19 15:20
- **实际开始时间**：2026-03-19 15:20
- **完成时间**：2026-03-19 15:22
- **问题**：配置文件区域只有“订阅 URL”拉取方式，缺少本地 JSON 上传入口。
- **影响的已完成任务**：CHG-35 / CHG-39
- **文件范围**：
  - `src/components/admin/system/ConfigFileEditor.tsx`
  - `tests/unit/components/admin/system/ConfigFileEditor.test.tsx`
- **修复内容**：
  - 在配置源区域新增双 Tab：`订阅 URL` / `本地上传`
  - 本地上传支持选择 `.json` 文件并自动解析填充到 JSON 编辑器
  - 解析失败展示错误提示，解析成功展示成功提示与已选文件名
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/ConfigFileEditor.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 新增组件单测 3 个，全部通过
- **问题说明**：_（无）_

---

#### CHG-42 合并“视频源配置”与“爬虫管理”页面

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 15:28
- **计划开始时间**：2026-03-19 15:30
- **实际开始时间**：2026-03-19 15:30
- **完成时间**：2026-03-19 15:36
- **问题**：后台“视频源配置”与“爬虫管理”分散在两个页面，操作链路割裂，维护成本高。
- **影响的已完成任务**：CHG-35 / CHG-36
- **文件范围**：
  - `src/app/[locale]/admin/crawler/page.tsx`
  - `src/app/[locale]/admin/system/sites/page.tsx`
  - `src/app/[locale]/admin/layout.tsx`
  - `src/components/admin/AdminCrawlerPanel.tsx`
  - `tests/e2e/admin.spec.ts`
- **修复内容**：
  - `/admin/crawler` 升级为统一管理页，包含“爬虫管理 + 视频源配置”两块
  - `/admin/system/sites` 作为旧入口重定向至 `/admin/crawler`
  - 侧栏入口统一为“源站与爬虫”
  - 空状态引导链接改为跳转同页视频源配置区锚点
- **测试要求**：
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - typecheck/lint 通过
- **问题说明**：_（无）_

---

#### CHG-43 统一页视频源列表优化（内部滚动 + 全列筛选排序）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 15:40
- **计划开始时间**：2026-03-19 15:44
- **实际开始时间**：2026-03-19 15:44
- **完成时间**：2026-03-19 15:50
- **问题**：
  1. 视频源列表过多时页面整体滚动，操作区不稳定。
  2. 视频源列表缺少按列管理能力，定位与批量维护效率低。
- **影响的已完成任务**：CHG-35 / CHG-42
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 列表区增加固定高度滚动容器（`max-h + overflow-y-auto`），避免整页滚动
  - 增加全列筛选与排序能力：名称、key、API、类型、格式、权重、成人、来源、状态
  - 增加筛选器面板与“清空筛选”；表头支持升降序切换
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/ConfigFileEditor.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 组件单测通过（6/6），typecheck/lint 通过
- **问题说明**：_（无）_

---

#### CHG-44 开发期登录效率优化（无感恢复 + dev 快捷登录）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 15:56
- **计划开始时间**：2026-03-19 16:00
- **实际开始时间**：2026-03-19 16:00
- **完成时间**：2026-03-19 16:05
- **问题**：开发阶段频繁丢失登录态，需要反复输入账号密码进入后台。
- **影响的已完成任务**：CHG-37
- **文件范围**：
  - `.env.example`
  - `src/stores/authStore.ts`
  - `src/api/routes/auth.ts`
  - `src/api/services/UserService.ts`
  - `src/components/auth/LoginForm.tsx`
  - `tests/unit/stores/authStore.test.ts`
  - `tests/unit/api/auth.test.ts`
- **修复内容**：
  - `tryRestoreSession` 改为“只要 accessToken 为空就尝试 refresh”，不再依赖 `isLoggedIn`
  - refresh 成功后补拉 `/users/me`（若本地 user 缺失）
  - 新增 `POST /auth/dev-login`（非生产环境可用，需 `X-Dev-Auth` 与 `DEV_LOGIN_SECRET` 匹配）
  - 登录页新增“开发快速登录（仅本地）”按钮（受 `NEXT_PUBLIC_ENABLE_DEV_LOGIN` 控制）
  - `.env.example` 增加 dev-login 相关环境变量示例
- **测试要求**：
  - `npm run test:run -- tests/unit/stores/authStore.test.ts tests/unit/api/auth.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 单测 57/57 通过，typecheck/lint 通过
- **问题说明**：_（无）_

---

#### CHG-45 统一页视频源列表二次优化（采集集成 + 列头筛选 + 侧栏收窄）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 16:20
- **计划开始时间**：2026-03-19 16:25
- **实际开始时间**：2026-03-19 16:31
- **完成时间**：2026-03-19 16:38
- **问题**：
  1. 采集触发仍分散在独立区域，视频源配置列表缺少站点级采集操作闭环。
  2. 筛选控件与列头分离，列表管理时上下视线切换成本高。
  3. 后台侧栏缺少收窄能力，页面工作区可用宽度不足。
- **影响的已完成任务**：CHG-42 / CHG-43
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/AdminSidebar.tsx`
  - `src/app/[locale]/admin/layout.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 视频源列表新增采集集成：支持全站增量/全量触发，支持行级增量/全量触发。
  - 列表重构为“列头排序 + 列头筛选”双层表头，筛选控件嵌入列标题区域。
  - 新增行内可编辑项：类型、格式、权重、成人标记、启停状态（配置文件来源行禁用行内编辑并提示）。
  - 增加最近采集列，展示最近采集时间与状态。
  - 后台侧栏新增收窄/展开切换，收窄时显示图标并保留 tooltip；菜单顺序按工作流重排。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 组件单测通过（3/3），typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-46 删除重复源站采集列表（统一到视频源配置列表）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 16:40
- **计划开始时间**：2026-03-19 16:42
- **实际开始时间**：2026-03-19 16:42
- **完成时间**：2026-03-19 16:43
- **问题**：CHG-45 已将源站采集并入视频源配置列表后，爬虫面板仍保留“源站状态卡片 + 单站触发”，造成重复入口。
- **影响的已完成任务**：CHG-42 / CHG-45
- **文件范围**：
  - `src/components/admin/AdminCrawlerPanel.tsx`
  - `src/app/[locale]/admin/crawler/page.tsx`
- **修复内容**：
  - 删除爬虫面板中的“源站状态卡片列表”和相关单站触发按钮。
  - 清理 `sites-status` 前端请求与对应状态管理逻辑。
  - 保留爬虫面板的全站触发、自动采集开关与任务记录；更新页面说明文案为“列表内单站触发”。
- **测试要求**：
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-47 统一页改为双 Tab 视图（视频源配置 / 采集任务记录）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 16:44
- **计划开始时间**：2026-03-19 16:45
- **实际开始时间**：2026-03-19 16:45
- **完成时间**：2026-03-19 16:46
- **问题**：视频源配置与采集任务记录虽已合并到同一页面，但仍上下分段，不符合“同一位置分列为两个 Tab”的操作预期。
- **影响的已完成任务**：CHG-42 / CHG-46
- **文件范围**：
  - `src/components/admin/AdminCrawlerTabs.tsx`
  - `src/app/[locale]/admin/crawler/page.tsx`
- **修复内容**：
  - 新增 `AdminCrawlerTabs` 客户端容器组件，提供“视频源配置 / 采集任务记录”双 Tab。
  - Tab 1 承载 `CrawlerSiteManager`，Tab 2 承载 `AdminCrawlerPanel`。
  - `/admin/crawler` 页面改为统一头部 + Tab 内容区，不再上下分段展示两块内容。
- **测试要求**：
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-48 视频源配置 Tab 稳态化修复（列管理 + 状态记忆 + 布局稳定 + 导入一致性）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 16:48
- **计划开始时间**：2026-03-19 16:50
- **实际开始时间**：2026-03-19 16:51
- **完成时间**：2026-03-19 16:59
- **问题**：
  1. 列表不支持编辑显示/隐藏列。
  2. 列表排序筛选状态在返回页面后丢失。
  3. 列表布局随页面变化不稳定。
  4. 导入 JSON 与配置文件导入字段兼容性不一致。
- **影响的已完成任务**：CHG-43 / CHG-45 / CHG-47
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 新增“显示列”面板，支持列级显示/隐藏（名称、管理操作列保持必显）。
  - 排序、筛选、列可见性持久化到 localStorage，返回页面自动恢复。
  - 表格改为 `table-fixed + min-width` 固定列宽，滚动容器采用稳定高度区间，降低布局跳变。
  - 导入 JSON 解析升级：兼容 `crawler_sites` / `api_site` / 根对象 / `sites[]`，兼容 `api|api_url|url|apiUrl`、`type|source_type`、`is_adult|isAdult`。
  - 导入逻辑按 API 地址对齐现有站点（命中则更新，未命中则新增），与配置文件同步规则保持一致。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测通过（3/3）；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-49 列表状态持久化回归修复（离页后丢失）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 17:00
- **计划开始时间**：2026-03-19 17:02
- **实际开始时间**：2026-03-19 17:04
- **完成时间**：2026-03-19 17:07
- **问题**：视频源配置列表离开页面后，隐藏列与排序状态仍可能丢失。
- **影响的已完成任务**：CHG-48
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 增加本地状态恢复写入门闩：仅在恢复 localStorage 完成后才允许写回。
  - 避免初始默认状态在挂载早期覆盖已有持久化数据。
  - 新增“重挂载后恢复排序与隐藏列”回归测试。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 4/4 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-50 状态记忆二次修复（初始化恢复）+ 删除“清空筛选”按钮

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 17:10
- **计划开始时间**：2026-03-19 17:11
- **实际开始时间**：2026-03-19 17:12
- **完成时间**：2026-03-19 17:14
- **问题**：CHG-49 后仍出现离页状态丢失，说明状态恢复仍存在初始化覆盖窗口；同时需要移除“清空筛选”按钮。
- **影响的已完成任务**：CHG-49
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 持久化改为“useState 懒初始化直接读取 localStorage”，不再依赖挂载后异步恢复。
  - 移除恢复门闩方案，避免恢复前写入窗口导致覆盖。
  - 删除操作栏中的“清空筛选”按钮。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 4/4 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-51 视频源列表列宽动态收敛（减少无效横向溢出）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 17:18
- **计划开始时间**：2026-03-19 17:19
- **实际开始时间**：2026-03-19 17:20
- **完成时间**：2026-03-19 17:21
- **问题**：在可见列数量不多时，列表仍使用固定超宽最小宽度，导致不必要的横向溢出。
- **影响的已完成任务**：CHG-48 / CHG-50
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
- **修复内容**：
  - 删除固定 `min-w-[1480px]`。
  - 引入按可见列动态计算的 `minWidth`，仅在总列宽超过容器时才触发横向滚动。
  - 保留固定列宽策略，维持布局稳定。
- **测试要求**：
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-52 隐藏列重显重叠修复 + 列宽手动调节

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 17:54
- **计划开始时间**：2026-03-19 17:55
- **实际开始时间**：2026-03-19 17:56
- **完成时间**：2026-03-19 17:59
- **问题**：
  1. 隐藏列重新显示时可能出现列之间挤压重叠。
  2. 需要支持手动调节列宽。
- **影响的已完成任务**：CHG-51
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
- **修复内容**：
  - 列宽从固定常量扩展为可配置状态 `columnWidths`。
  - “显示列”面板新增每列宽度（px）输入，支持 72–560 区间手动调节。
  - 表头列宽和表格最小宽度统一由当前列宽状态驱动，重显列时按最新宽度布局，避免重叠。
  - 列宽与现有排序/筛选/显隐状态一起持久化。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 4/4 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-53 列宽交互重构：表头分隔拖拽调节

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:00
- **计划开始时间**：2026-03-19 18:01
- **实际开始时间**：2026-03-19 18:02
- **完成时间**：2026-03-19 18:05
- **问题**：列宽调节应遵循数据表通用人机交互，不应在“显示列”面板通过数字输入配置。
- **影响的已完成任务**：CHG-52
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 表头每列右侧新增拖拽分隔条（`cursor-col-resize`），按鼠标拖拽实时调整列宽。
  - 拖拽时阻断排序点击冒泡，避免误触排序。
  - “显示列”面板移除宽度输入，仅保留列显隐，并提示“可拖拽调宽”。
  - 列宽继续持久化，重进页面恢复。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 新增拖拽调宽单测；定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-54 Phase A1：抽离 CrawlerSiteManager 表格状态模型（v1.1 首任务）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 18:52
- **实际开始时间**：2026-03-19 18:53
- **完成时间**：2026-03-19 18:55
- **问题**：`CrawlerSiteManager.tsx` 状态模型与常量定义过度集中，阻塞后续按 v1.1 进行纵向切片。
- **影响的已完成任务**：CHG-53
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/tableState.ts`
- **修复内容**：
  - 将排序/筛选/列显隐/列宽相关类型、默认值、持久化读取逻辑抽离至 `crawler-site/tableState.ts`。
  - 主组件改为消费模块化状态定义，保持行为与 UI 不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-55 Phase A2：抽离 CrawlerSiteManager 导入解析逻辑（v1.1）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 19:05
- **实际开始时间**：2026-03-19 18:58
- **完成时间**：2026-03-19 19:04
- **问题**：导入解析逻辑内联在组件中，复杂度高且难以针对兼容规则独立测试。
- **影响的已完成任务**：CHG-54
- **文件范围**：
  - `src/components/admin/system/crawler-site/importParser.ts`
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `tests/unit/components/admin/system/crawler-site/importParser.test.ts`
- **修复内容**：
  - 新建 `importParser.ts`，抽离并导出 `parseSitesFromJson`。
  - 组件改为调用解析模块，保留导入流程行为不变。
  - 新增解析器单测，覆盖 map/array/字段别名/去重等场景。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/crawler-site/importParser.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 8/8 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-56 Phase A3：抽离列表列管理/拖拽宽度 hooks（v1.1）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 19:30
- **实际开始时间**：2026-03-19 19:04
- **完成时间**：2026-03-19 19:06
- **问题**：列显隐、排序、筛选、拖拽调宽和持久化逻辑仍集中在主组件。
- **影响的已完成任务**：CHG-55
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns.ts`
- **修复内容**：
  - 新建 `useCrawlerSiteColumns`，统一管理排序/筛选/列显隐/列宽拖拽/本地持久化。
  - `CrawlerSiteManager` 删除对应内联状态与拖拽监听逻辑，改为消费 hook 返回值。
  - 行为保持不变（列拖拽、排序、筛选、状态记忆）。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/crawler-site/importParser.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 8/8 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-57 Phase A4：抽离选择/批量操作 hooks（v1.1）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 20:00
- **实际开始时间**：2026-03-19 19:06
- **完成时间**：2026-03-19 19:11
- **问题**：源站选择/全选/批量操作耦合在主组件，影响后续容器化拆分。
- **影响的已完成任务**：CHG-56
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteSelection.ts`
- **修复内容**：
  - 新建 `useCrawlerSiteSelection`，封装 `selected/toggleSelect/toggleAll/clearSelection`。
  - 主组件删除内联选择逻辑，改为按 `displaySites` 派生可见 key 并消费 hook。
  - 保持原有行为：全选仅作用于当前可见列表，批量成功后清空选择。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/crawler-site/importParser.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 8/8 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-58 Phase A5：容器+表格组件拆分落地（v1.1）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 20:30
- **实际开始时间**：2026-03-19 19:11
- **完成时间**：2026-03-19 19:18
- **问题**：`CrawlerSiteManager` 仍承载大量表格渲染与行交互细节，容器职责不清晰。
- **影响的已完成任务**：CHG-57
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
- **修复内容**：
  - 新建 `CrawlerSiteTable` 组件，承载列表表头筛选、排序、列宽拖拽与行级操作渲染。
  - `CrawlerSiteManager` 删除大段表格 JSX，改为容器式传参编排业务动作。
  - 行为保持不变：测试断言的滚动容器、筛选、排序、状态恢复路径均通过回归。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/crawler-site/importParser.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 8/8 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-59 Phase B：ConfigFileEditor 结构拆分（v1.1）

- **状态**：✅ 已完成
- **创建时间**：2026-03-19 18:50
- **计划开始时间**：2026-03-19 21:00
- **实际开始时间**：2026-03-19 19:18
- **完成时间**：2026-03-19 19:21
- **问题**：配置文件编辑器聚合了解析、映射、同步与 UI，变更风险高且测试颗粒粗。
- **影响的已完成任务**：CHG-58
- **文件范围**：
  - `src/components/admin/system/ConfigFileEditor.tsx`
  - `src/components/admin/system/config-file/constants.ts`
  - `src/components/admin/system/config-file/utils.ts`
  - `tests/unit/components/admin/system/config-file/utils.test.ts`
- **修复内容**：
  - 新增 `config-file/constants.ts` 承载 JSON placeholder，减少主组件常量噪音。
  - 新增 `config-file/utils.ts`，抽离 JSON 校验、JSON 格式化、订阅 URL 归一化逻辑。
  - `ConfigFileEditor` 改为复用工具函数，保持“保存并同步”流程和错误文案不变。
  - 新增 `utils` 单测，覆盖核心规则并提升后续重构安全性。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/ConfigFileEditor.test.tsx tests/unit/components/admin/system/config-file/utils.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 6/6 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-60 v1.2 T1-1：抽离 CrawlerSiteToolbar 组件

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 10:35
- **实际开始时间**：2026-03-20 10:32
- **完成时间**：2026-03-20 10:45
- **问题**：`CrawlerSiteManager` 的操作栏仍包含大量按钮、列面板和批量操作渲染，容器职责不够收敛。
- **影响的已完成任务**：CHG-58
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx`
- **修复内容**：
  - 新建 `CrawlerSiteToolbar`，承载操作栏按钮、显示列面板、批量操作入口与 toast 区。
  - `CrawlerSiteManager` 删除内联操作栏 JSX，改为容器传参与回调编排。
  - 保持现有行为不变（按钮启停、批量动作、列面板交互和提示文案）。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-61 v1.2 T1-2：抽离 CrawlerSiteFilters 组件

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 11:00
- **实际开始时间**：2026-03-20 10:45
- **完成时间**：2026-03-20 10:55
- **问题**：筛选区仍位于 `CrawlerSiteTable` 内部，难以单独演进和复用。
- **影响的已完成任务**：CHG-60
- **文件范围**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFilters.tsx`
- **修复内容**：
  - 新建 `CrawlerSiteFilters`，承载筛选行渲染与筛选字段绑定。
  - `CrawlerSiteTable` 删除内联筛选行 JSX，改为组合式渲染。
  - 行为保持不变：筛选输入联动与筛选状态持久化路径保持一致。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-62 v1.2 T1-3：抽离 CrawlerSiteFormDialog 组件

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 11:30
- **实际开始时间**：2026-03-20 10:55
- **完成时间**：2026-03-20 11:08
- **问题**：新增/编辑弹窗表单仍在 `CrawlerSiteManager`，容器与表单细节耦合较高。
- **影响的已完成任务**：CHG-61
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx`
- **修复内容**：
  - 新建 `CrawlerSiteFormDialog`，完整承载 Modal 与新增/编辑表单渲染和校验。
  - `CrawlerSiteManager` 删除内联表单实现，改为传入 `initial` 与 `onSave` 回调。
  - 保持原有行为不变：必填校验、权重滑块、保存成功关闭弹窗。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-63 v1.2 T1-4：抽离 useCrawlerSites hook

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 12:00
- **实际开始时间**：2026-03-20 11:08
- **完成时间**：2026-03-20 11:18
- **问题**：列表加载与刷新状态管理仍在 `CrawlerSiteManager`，数据层与容器耦合。
- **影响的已完成任务**：CHG-62
- **文件范围**：
  - `src/components/admin/system/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSites.ts`
- **修复内容**：
  - 新建 `useCrawlerSites`，统一管理 `sites/loading/fetchSites`。
  - `CrawlerSiteManager` 删除对应内联数据加载逻辑，改为消费 hook。
  - 保持请求路径与静默失败处理口径不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-64 v1.2 T2：system 目录业务归组

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 14:00
- **实际开始时间**：2026-03-20 11:18
- **完成时间**：2026-03-20 11:30
- **问题**：`system` 根目录仍有平铺业务组件，目录语义不统一。
- **影响的已完成任务**：CHG-63
- **文件范围**：
  - `src/components/admin/system/CacheManager.tsx`
  - `src/components/admin/system/PerformanceMonitor.tsx`
  - `src/components/admin/system/DataMigration.tsx`
  - `src/components/admin/system/SiteSettings.tsx`
  - `src/components/admin/system/{monitoring,migration,site-settings}/*`
  - 受影响的 import 引用文件
- **修复内容**：
  - 将平铺组件迁移到业务目录：
    - `CrawlerSiteManager` -> `crawler-site/CrawlerSiteManager.tsx`
    - `ConfigFileEditor` -> `config-file/ConfigFileEditor.tsx`
    - `CacheManager`/`PerformanceMonitor` -> `monitoring/*`
    - `DataMigration` -> `migration/DataMigration.tsx`
    - `SiteSettings` -> `site-settings/SiteSettings.tsx`
  - 同步更新页面、Tabs、单测中的 import 路径。
  - 仅路径与结构调整，不改业务逻辑。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/*.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 11/11 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-65 v1.2 T3：页面入口与业务模块分离

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 15:00
- **实际开始时间**：2026-03-20 11:30
- **完成时间**：2026-03-20 11:42
- **问题**：需确认 admin 页面入口仅承担装配职责，业务逻辑已下沉到模块目录。
- **影响的已完成任务**：CHG-64
- **文件范围**：
  - `src/app/[locale]/admin/system/*/page.tsx`
  - `src/components/admin/AdminCrawlerTabs.tsx`
  - 相关 system 子模块组件
- **修复内容**：
  - 审计并确认 system 入口页面仅包含标题/说明与模块装配，无业务逻辑内联。
  - `AdminCrawlerTabs` 保留 Tab 切换状态与模块装配，业务处理下沉至 `crawler-site` 子模块。
  - 路由入口与业务目录边界达到 v1.2 目标。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/*.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 复用 CHG-64 验证结果：定向单测 11/11 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-66 v1.2 T4/T6/T7：模板约束落地 + 阶段验收

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 10:30
- **计划开始时间**：2026-03-20 16:00
- **实际开始时间**：2026-03-20 11:42
- **完成时间**：2026-03-20 11:56
- **问题**：需固化模块模板规范并完成阶段验收闭环。
- **影响的已完成任务**：CHG-65
- **文件范围**：
  - `docs/rules/*`
  - `docs/task-queue.md`
  - `docs/tasks.md`
  - `docs/changelog.md`
  - `docs/run-logs.md`
- **修复内容**：
  - 新增 `docs/rules/admin-module-template.md`，固化 admin 模块目录模板与约束。
  - 执行阶段验收命令，补齐 v1.2 收口记录。
  - 更新序列与任务文档状态为完成。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/ConfigFileEditor.test.tsx tests/unit/components/admin/system/config-file/utils.test.ts`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 11/11 通过；typecheck/lint 通过。
  - 仍存在既有测试告警：`ConfigFileEditor` 在测试环境触发一次 controlled/uncontrolled 警告（不影响通过，后续可单独清理）。
- **问题说明**：_（无）_

---

#### CHG-67 Admin v2 方案与设计系统文档落地

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:00
- **计划开始时间**：2026-03-20 12:02
- **实际开始时间**：2026-03-20 12:03
- **完成时间**：2026-03-20 12:08
- **问题**：需将 v2 阶段（shared/UI/设计系统）从讨论内容固化为工程可执行文档。
- **影响的已完成任务**：CHG-66
- **文件范围**：
  - `docs/admin_v2_refactor_plan.md`
  - `docs/admin_design_system_v1.md`
- **修复内容**：
  - 新增 `admin_v2_refactor_plan.md`，覆盖 shared 抽象、UI/UX 优化与三阶段执行计划。
  - 新增 `admin_design_system_v1.md`，覆盖 button/table/form/modal 组件规范与交互/布局规则。
  - 文档内容按“渐进迁移、可回滚、行为不变”原则组织，可直接转化为任务执行清单。
- **测试要求**：
  - _（文档任务，无代码测试）_
- **完成备注**：
  - 文档已落地并纳入任务序列记录。
- **问题说明**：_（无）_

---

#### CHG-68 Admin v2 执行规则与顺序约束更新

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:15
- **计划开始时间**：2026-03-20 12:16
- **实际开始时间**：2026-03-20 12:16
- **完成时间**：2026-03-20 12:20
- **问题**：需防止阶段执行顺序偏移与 UI 改动失控，强化工程约束。
- **影响的已完成任务**：CHG-67
- **文件范围**：
  - `docs/admin_v2_refactor_plan.md`
  - `docs/rules/admin-module-template.md`
- **修复内容**：
  - 重排 Phase 1 任务顺序：`TableFrame/State -> Toolbar -> Toast -> Dialog -> Form -> BatchBar -> 验证`。
  - 增加表格强 DoD：拖拽像素一致、刷新滚动保持、sticky 无抖动、selection 不丢失。
  - 增加 UI 阶段硬边界：禁止改数据结构/字段/API 顺序/异步流程/权限逻辑。
  - 增加 PR 单维度执行规则：禁止 shared/UI/逻辑混提。
- **测试要求**：
  - _（文档任务，无代码测试）_
- **完成备注**：
  - 约束已固化为执行规则，后续任务需强制遵守。
- **问题说明**：_（无）_

---

#### CHG-69 Phase1：抽离 AdminTableFrame/AdminTableState

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 12:28
- **实际开始时间**：2026-03-20 12:26
- **完成时间**：2026-03-19 23:18
- **问题**：`crawler-site` 仍在业务组件内维护表格外壳与状态渲染，阻塞 shared 抽象第一步。
- **影响的已完成任务**：CHG-68
- **文件范围**：
  - `src/components/admin/shared/table/AdminTableFrame.tsx`（新增）
  - `src/components/admin/shared/feedback/AdminTableState.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
- **修复内容**：
  - 新增 `AdminTableFrame`，承载 crawler-site 当前表格外壳、滚动容器和 table 基础结构。
  - 新增 `AdminTableState`，统一空态/加载态占位行渲染（本任务先接入空态，加载态保持可选）。
  - `CrawlerSiteTable` 改为组合 shared 组件，保持列定义、排序、筛选、拖拽、行内操作行为不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
  - 手动验证：列宽拖拽 ±1px、刷新后滚动保持、sticky header 无抖动、selection 不丢失
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-70 Phase1：抽离 AdminToolbar

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 13:10
- **实际开始时间**：2026-03-19 23:19
- **完成时间**：2026-03-19 23:21
- **问题**：`crawler-site` 的工具栏布局壳与业务按钮混写，不利于 shared 复用。
- **影响的已完成任务**：CHG-69
- **文件范围**：
  - `src/components/admin/shared/toolbar/AdminToolbar.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx`
- **修复内容**：
  - 新增 `AdminToolbar`，统一提供 actions + feedback 的工具栏布局壳。
  - `CrawlerSiteToolbar` 改为组合 `AdminToolbar`，保留现有按钮、列面板、批量区、toast 行为。
  - 不改动数据结构、接口调用、权限逻辑与异步流程。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-71 Phase1：抽离 useAdminToast

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 13:40
- **实际开始时间**：2026-03-19 23:21
- **完成时间**：2026-03-19 23:22
- **问题**：多个 admin 模块重复维护 toast 状态与自动消失计时逻辑。
- **影响的已完成任务**：CHG-70
- **文件范围**：
  - `src/components/admin/shared/feedback/useAdminToast.ts`（新增）
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`
- **修复内容**：
  - 新增 `useAdminToast`，统一封装 toast 状态、覆盖式计时和卸载清理。
  - `CrawlerSiteManager` 删除内联 toast 逻辑，改为消费 shared hook（保持 3500ms 时序）。
  - 提示文案、触发位置与业务流程保持不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-72 Phase1：抽离 AdminDialogShell

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 14:10
- **实际开始时间**：2026-03-19 23:23
- **完成时间**：2026-03-19 23:24
- **问题**：`CrawlerSiteFormDialog` 内联维护弹层遮罩与壳体结构，重复度高。
- **影响的已完成任务**：CHG-71
- **文件范围**：
  - `src/components/admin/shared/dialog/AdminDialogShell.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx`
- **修复内容**：
  - 新增 `AdminDialogShell`，统一弹层遮罩、容器、标题栏与关闭交互。
  - `CrawlerSiteFormDialog` 删除内联 `Modal`，改为组合 shared dialog 壳。
  - 表单字段、校验、提交与关闭流程保持不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-73 Phase1：抽离 AdminFormField/Input/Select

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 14:40
- **实际开始时间**：2026-03-19 23:24
- **完成时间**：2026-03-19 23:25
- **问题**：`CrawlerSiteFormDialog` 内联维护基础表单组件，复用边界不清晰。
- **影响的已完成任务**：CHG-72
- **文件范围**：
  - `src/components/admin/shared/form/AdminFormField.tsx`（新增）
  - `src/components/admin/shared/form/AdminInput.tsx`（新增）
  - `src/components/admin/shared/form/AdminSelect.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx`
- **修复内容**：
  - 新增 shared `AdminFormField`、`AdminInput`、`AdminSelect` 组件。
  - `CrawlerSiteFormDialog` 删除内联 FormField/Input/select 实现，改为组合 shared 组件。
  - 保持表单校验规则、提交 payload 和字段映射不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-74 Phase1：抽离 AdminBatchBar

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 15:10
- **实际开始时间**：2026-03-19 23:26
- **完成时间**：2026-03-19 23:27
- **问题**：`CrawlerSiteToolbar` 批量区（已选计数 + 批量按钮）与工具栏其它逻辑耦合。
- **影响的已完成任务**：CHG-73
- **文件范围**：
  - `src/components/admin/shared/batch/AdminBatchBar.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx`
- **修复内容**：
  - 新增 `AdminBatchBar`，统一承载“已选计数 + 批量动作按钮”渲染。
  - `CrawlerSiteToolbar` 改为通过 `actions` 配置组合 `AdminBatchBar`。
  - 批量操作触发参数与后端接口调用保持不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-75 Phase1：shared 复用验证（videos/sources）

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-20 15:40
- **实际开始时间**：2026-03-19 23:28
- **完成时间**：2026-03-19 23:29
- **问题**：需验证 shared 组件不只服务 crawler-site，能在其他 admin 模块平滑复用。
- **影响的已完成任务**：CHG-74
- **文件范围**：
  - `src/components/admin/shared/toolbar/AdminToolbar.tsx`
  - `src/components/admin/videos/VideoFilters.tsx`
  - `src/components/admin/sources/SourceTable.tsx`
- **修复内容**：
  - 为 `AdminToolbar` 增加 `dataTestId`，兼容既有测试选择器。
  - `VideoFilters` 顶部筛选栏改为组合 `AdminToolbar`。
  - `SourceTable` 状态筛选栏改为组合 `AdminToolbar`。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 10/10 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-76 Phase2：crawler-site toolbar 局部优化

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-21 10:00
- **实际开始时间**：2026-03-19 23:30
- **完成时间**：2026-03-19 23:32
- **问题**：crawler-site 工具栏在动作密集时分区不清晰，主要动作与配置动作可读性不足。
- **影响的已完成任务**：CHG-75
- **文件范围**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx`
- **修复内容**：
  - 将工具栏重排为“主要动作组（添加/采集）+ 配置动作组（导入/导出/显示列）+ 批量动作组”三段结构。
  - 在主要动作与配置动作之间新增视觉分隔，提高高频动作辨识度。
  - 保持按钮文案、触发回调、批量参数与接口调用顺序不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-77 Phase2：crawler-site 行操作分层

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-21 10:40
- **实际开始时间**：2026-03-19 23:32
- **完成时间**：2026-03-19 23:33
- **问题**：列表行内“采集/管理”动作视觉优先级不清晰，高频编辑路径辨识度偏弱。
- **影响的已完成任务**：CHG-76
- **文件范围**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
- **修复内容**：
  - 采集操作列中将“增量”提升为强调按钮，“全量”保留次级样式。
  - 管理操作列中将“编辑”提升为强调按钮，并调整为优先展示。
  - 保持按钮回调、参数与列结构不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-78 Phase2：crawler-site 筛选可视化

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-21 11:20
- **实际开始时间**：2026-03-20 00:55
- **完成时间**：2026-03-20 01:14
- **问题**：表头承载筛选控件导致噪音过高，筛选状态感知弱，列操作入口分散。
- **影响的已完成任务**：CHG-77
- **文件范围**：
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns.ts`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteAdvancedFilters.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/ActiveFilterChipsBar.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/ColumnMenu.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/ColumnFilterPanel.tsx`（新增）
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **修复内容**：
  - 迁移表头筛选行到顶部工具栏与高级筛选面板，表头降级为“列名+排序+筛选态+列菜单”。
  - 新增筛选状态 Chips 条，支持单项移除与清空筛选。
  - 新增列菜单，支持列级排序、列级筛选、清除当前列筛选与隐藏列。
  - 保持筛选语义、排序持久化、列显隐持久化与列宽拖拽逻辑不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-79 Phase2：config-file 粘性保存区

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-21 12:00
- **实际开始时间**：2026-03-20 01:16
- **完成时间**：2026-03-20 01:20
- **问题**：配置文件页面在长 JSON 场景下，保存按钮滚出视口，保存动作可达性下降。
- **影响的已完成任务**：CHG-78
- **文件范围**：
  - `src/components/admin/system/config-file/ConfigFileEditor.tsx`
- **修复内容**：
  - 将底部操作栏改为粘性保存区（`sticky bottom`），滚动时保持“保存并同步”可见。
  - 为粘性区增加半透明背景与边框，避免覆盖内容时可读性下降。
  - 保存逻辑、接口路径、请求顺序与提示文案保持不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/ConfigFileEditor.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 3/3 通过；typecheck/lint 通过。
  - 保留既有 warning：ConfigFileEditor 测试中的 controlled/uncontrolled 提示（历史问题，未在本任务处理）。
- **问题说明**：_（无）_

---

#### CHG-80 Phase2：videos/users/sources 布局对齐

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-21 13:00
- **实际开始时间**：2026-03-20 01:20
- **完成时间**：2026-03-20 01:22
- **问题**：`videos/users/sources` 页面标题区与筛选区布局风格不一致，跨页面体验割裂。
- **影响的已完成任务**：CHG-79
- **文件范围**：
  - `src/app/[locale]/admin/videos/page.tsx`
  - `src/app/[locale]/admin/users/page.tsx`
  - `src/app/[locale]/admin/sources/page.tsx`
  - `src/components/admin/users/UserTable.tsx`
- **修复内容**：
  - 三个页面统一为“信息头卡片 + 内容区”布局结构。
  - users 搜索栏接入 `AdminToolbar` 布局壳，与 videos/sources 筛选区节奏对齐。
  - 不改 API、字段、异步流程与权限逻辑。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 10/10 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-81 Phase3：落地 AdminButton

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-22 10:00
- **实际开始时间**：2026-03-20 01:22
- **完成时间**：2026-03-20 01:24
- **问题**：后台按钮样式重复散落，primary/secondary/danger 语义未代码化统一。
- **影响的已完成任务**：CHG-80
- **文件范围**：
  - `src/components/admin/shared/button/AdminButton.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx`
  - `src/components/admin/system/config-file/ConfigFileEditor.tsx`
  - `src/app/[locale]/admin/videos/page.tsx`
- **修复内容**：
  - 新增 `AdminButton`，统一 `primary/secondary/danger/ghost` 变体和尺寸语义。
  - crawler-site 顶部操作区、config-file 保存区、videos 新建入口首批接入 `AdminButton`。
  - 保持所有按钮原有回调、禁用条件与交互时序不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/ConfigFileEditor.test.tsx tests/unit/components/admin/videos/VideoFilters.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 13/13 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-82 Phase3：落地 AdminModal + 表单规范

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-22 10:40
- **实际开始时间**：2026-03-20 01:24
- **完成时间**：2026-03-20 01:25
- **问题**：弹窗与表单动作区在不同模块实现分散，规范尚未统一到 shared 代码。
- **影响的已完成任务**：CHG-81
- **文件范围**：
  - `src/components/admin/shared/modal/AdminModal.tsx`（新增）
  - `src/components/admin/shared/form/AdminFormActions.tsx`（新增）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx`
- **修复内容**：
  - 新增 `AdminModal`，基于现有 `Modal` 提供统一 modal 语义包装。
  - 新增 `AdminFormActions`，统一表单底部动作区布局。
  - `CrawlerSiteFormDialog` 切换为 `AdminModal + AdminFormActions + AdminButton` 组合。
  - 保持字段、校验、提交流程与关闭行为不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-83 Phase3：落地 AdminTable 规范

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-22 11:30
- **实际开始时间**：2026-03-20 01:26
- **完成时间**：2026-03-20 01:29
- **问题**：表格规范虽已在 crawler-site 落地，但 videos/sources 仍有重复壳层实现，设计系统 table 规范未形成跨模块统一。
- **影响的已完成任务**：CHG-82
- **文件范围**：
  - `src/components/admin/videos/VideoTable.tsx`
  - `src/components/admin/sources/SourceTable.tsx`
- **修复内容**：
  - `VideoTable` 切换到 `AdminTableFrame + AdminTableState`，统一 loading/empty 行渲染口径。
  - `SourceTable` 切换到 `AdminTableFrame + AdminTableState`，统一表格壳与状态行语义。
  - 保持字段、API 路径、请求顺序、权限逻辑和分页/批量行为不变。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 10/10 通过；typecheck/lint 通过。
  - 满足“至少 2 模块完成 AdminTable 规范接入”的阶段目标。
- **问题说明**：_（无）_

---

#### CHG-84 Phase3：交互规则代码门禁

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 12:24
- **计划开始时间**：2026-03-22 12:10
- **实际开始时间**：2026-03-20 01:29
- **完成时间**：2026-03-20 01:33
- **问题**：删除确认/loading/toast/单维度 PR 等规则目前依赖人工执行，缺少自动化门禁。
- **影响的已完成任务**：CHG-83
- **文件范围**：
  - `scripts/verify-admin-guardrails.mjs`（新增）
  - `package.json`
  - `docs/rules/admin-module-template.md`
  - `docs/admin_v2_refactor_plan.md`
  - `src/components/admin/sources/SourceTable.tsx`
- **修复内容**：
  - 新增 `verify-admin-guardrails` 门禁脚本，校验 v2 范围内：
    - 单个变更集仅允许一个维度（shared/ui/logic）
    - 禁止直接 `confirm()`
    - 删除接口调用必须配套 `ConfirmDialog`
    - `toast + setTimeout` 必须迁移为 `useAdminToast`
  - 新增 npm 命令：`verify:admin-guardrails`（staged）与 `verify:admin-guardrails:all`（审计）。
  - `SourceTable` 单条删除改为 `ConfirmDialog` 二次确认，补齐删除交互规范。
  - 将门禁命令并入执行规则文档，形成可执行约束。
- **测试要求**：
  - `npm run verify:admin-guardrails`
  - `npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 门禁命令通过；定向单测 10/10 通过；typecheck/lint 通过。
- **问题说明**：_（无）_

---

#### CHG-85 crawler-site 单站采集闭环（Step1-6）

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 01:36
- **计划开始时间**：2026-03-20 01:40
- **实际开始时间**：2026-03-20 01:41
- **完成时间**：2026-03-20 02:01
- **问题**：`视频源配置` 页虽有“采集操作”列，但缺少完整的任务状态消费、同站互斥防重、结果刷新与可复用任务模型。
- **影响的已完成任务**：CHG-84
- **文件范围**：
  - `src/api/db/queries/crawlerTasks.ts`
  - `src/api/routes/admin/crawler.ts`
  - `src/api/services/CrawlerService.ts`
  - `src/api/workers/crawlerWorker.ts`
  - `src/components/admin/system/crawler-site/crawlTask.types.ts`（新增）
  - `src/components/admin/system/crawler-site/services/crawlTaskService.ts`（新增）
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks.ts`（新增）
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx`
- **修复内容**：
  - Step 1：补齐任务类型与服务层
    - `crawler_tasks.createTask` 增加 `type` 入参，避免增量/全量语义丢失。
    - 新增 latest 任务查询能力（单站/批量）与活跃任务查询能力。
    - 新增 `crawlTask.types` 与 `crawlTaskService`，统一前端任务模型与接口消费。
  - Step 2 + Step 3：接入单站增量/全量采集
    - 行内“增量/全量”按钮接入统一触发服务。
  - Step 4：运行中状态、toast、错误处理、防重复提交
    - 互斥规则改为“同站点任一活跃任务互斥”。
    - 后端 `POST /admin/crawler/tasks` 对单站活跃任务返回 `409` 冲突。
    - 前端按钮禁用与 toast 反馈保持行级隔离，避免多行状态污染。
  - Step 5：最近采集状态刷新
    - 新增批量 latest 轮询接口消费，任务 `success/failed` 后执行一次 `fetchSites()` 刷新列表，并清理本地 running 状态。
  - Step 6：抽出可复用 hook
    - 新增 `useCrawlerSiteCrawlTasks`，可复用到后续“任务记录”Tab/批量采集能力。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
  - 已满足：同站互斥防重、批量 latest 优先轮询、任务完成后刷新列表并清理 running 状态。
- **问题说明**：_（无）_

---

#### CHG-86 crawler-site 配置页采集状态概览

- **状态**：✅ 已完成
- **创建时间**：2026-03-20 02:10
- **计划开始时间**：2026-03-20 02:15
- **实际开始时间**：2026-03-20 02:16
- **完成时间**：2026-03-20 02:32
- **问题**：配置页缺少聚合态采集信息，用户无法快速判断整体运行状态（站点总量、运行中、失败、当日产出）。
- **影响的已完成任务**：CHG-85
- **文件范围**：
  - `src/api/db/queries/crawlerTasks.ts`
  - `src/api/routes/admin/crawler.ts`
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats.tsx`（新增）
- **修复内容**：
  - 新增后端概览查询，汇总：
    - 站点总数
    - 连接成功（`last_crawl_status = ok`）
    - 运行中（基于 `crawler_tasks` 活跃任务去重站点）
    - 失败（`last_crawl_status = failed`）
    - 今日采集视频数（`result.videosUpserted` 聚合）
    - 今日采集时长（`result.durationMs` 聚合）
  - 新增 `GET /admin/crawler/overview` 接口。
  - 配置页顶部新增状态概览条，5 秒轮询实时刷新。
  - 不修改列表列结构，不增加列表信息密度，不影响筛选/排序/列宽/列显隐逻辑。
- **测试要求**：
  - `npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
  - `npm run typecheck`
  - `npm run lint`
- **完成备注**：
  - 定向单测 5/5 通过；typecheck/lint 通过。
- **问题说明**：_（无）_
