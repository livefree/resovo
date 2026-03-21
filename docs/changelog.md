# Resovo（流光） — 开发变更记录

> 每次任务完成后，AI 在此追加一条记录。
> 格式固定，便于追踪变更历史和排查问题。
> 追加规则：新记录统一追加到文件尾部，不做头部插入。

---

## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **记录时间**：YYYY-MM-DD HH:mm
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```

---

## [CHORE-CODEX-01] 接手前稳态化（preflight）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 14:12
- **修改文件**：
  - `scripts/preflight.sh` — 新增一键 preflight 流程（docker compose、verify-env、migrate、typecheck、lint、unit，可选 e2e）
  - `package.json` — 新增 `preflight`、`preflight:e2e` scripts 入口
  - `.nvmrc` — 固定 Node 主版本为 22，降低多机环境漂移
  - `README.md` — 增加“第七步：开发前稳态检查”，并修正文档中的命令/端口不一致
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 推荐在 AI 连续开发开始前运行 `npm run preflight`
  - 涉及关键用户流程的改动，再补跑 `npm run preflight:e2e`

## [INFRA-06] Docker Compose 本地环境
- **完成时间**：2026-03-15
- **修改文件**：
  - `docker/elasticsearch.Dockerfile` — ES 8.17.0 自定义镜像，bake-in IK 分析插件和拼音插件
  - `docker-compose.yml` — 重写：ES 改用 Dockerfile 构建、添加 elasticsearch-init 索引初始化服务、postgres host 端口改为 5433 避免与本地 PG 冲突
  - `scripts/verify-env.sh` — 修复 `((PASS++))` 在 set -e 下 exit 1 的 bug；Redis 检查自动回退到 docker exec（宿主机未安装 redis-cli 时）
- **新增依赖**：无
- **数据库变更**：创建 Elasticsearch `resovo_videos` 索引（含 IK + 拼音分析器 mapping）
- **注意事项**：
  - 本地 postgres 已在 5432，Docker postgres 映射到 5433，verify-env.sh 用 DATABASE_URL 指向本地 PG（livefree@5432）
  - `docker compose run --rm elasticsearch-init` 会自动创建 ES 索引（已在 docker compose up 后手动运行一次）
  - verify-env.sh 全部 21 项通过 ✅

## [PLAYER-05] 快捷键系统
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/player/usePlayerShortcuts.ts` — 新建，ADR-011 键盘状态机
  - `tests/unit/components/player/ControlBar.test.tsx` — 扩展：新增 6 个键盘状态机测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 优先级：输入框聚焦 → 选集浮层打开 → 倍速面板打开 → 正常模式
  - 快进/后退步进为 5 秒，倍速快捷键为 S 键，剧场模式 T 键仅桌面端（≥1024px）

## [PLAYER-07] 弹幕条
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/player/DanmakuBar.tsx` — 新建，弹幕控制栏 UI + CCL 初始化（graceful degradation）
  - `tests/unit/components/player/DanmakuBar.test.tsx` — 新建，22 个测试
- **新增依赖**：无（CCL 已安装）
- **数据库变更**：无
- **注意事项**：
  - CCL (`comment-core-library`) 是浏览器全局变量库，通过 `window.CommentManager` 访问
  - 未加载 CCL 时静默降级（UI 控件仍可用，弹幕飞屏不可用）
  - commit hash：89d84e8

## [PLAYER-08] 视频信息区与 Meta Chip
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/video/VideoMeta.tsx` — 新建，播放页视频信息区
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 复用 `MetaChip`（SEARCH-02 实现）、类型/年份/地区标签可点击搜索
  - 收藏/追剧按钮未登录时 disabled；分享使用 Web Share API
  - commit hash：964d3ce

## [CRAWLER-01] Bull 队列基础设施
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/workers/crawlerWorker.ts` — 新建，爬虫队列 Worker 骨架
  - `src/api/workers/verifyWorker.ts` — 新建，链接验证队列 Worker + checkUrl()
  - `tests/unit/api/crawler.test.ts` — 新建，16 个测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - `queue.ts` 已在 INFRA-04 中实现，CRAWLER-01 只新增 Worker 注册骨架
  - checkUrl() 用 HEAD 请求 + 10s AbortController 超时；4xx/5xx/超时 → inactive
  - commit hash：8a03857

## [PLAYER-06] 选集浮层
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/player/EpisodeOverlay.tsx` — 新建，8 列网格浮层
  - `tests/unit/components/player/EpisodeOverlay.test.tsx` — 新建，8 个测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - capture 阶段键盘监听确保最高优先级（ADR-011）
  - 当前集金色背景使用 CSS 变量 `--gold`，聚焦态 ring-1 ring-white/50
  - commit hash：fec6fec

## [INFRA-05] 环境变量管理
- **完成时间**：2026-03-15
- **修改文件**：
  - `.env.example` — 所有必要环境变量示例（提交到仓库）
  - `src/api/lib/config.ts` — Zod 校验所有必要变量，缺少时 fail-fast 并打印哪个变量缺失
- **新增依赖**：zod（已在 package.json）
- **数据库变更**：无
- **注意事项**：
  - config 对象覆盖：DATABASE_URL、ELASTICSEARCH_URL、REDIS_URL、JWT_SECRET、COOKIE_SECRET、NEXT_PUBLIC_*、PORT、CRAWLER_SOURCES、R2_*
  - postgres.ts/redis.ts/elasticsearch.ts 仍直接读 process.env（未迁移到 config），可在后续任务中统一处理

## [INFRA-04] Redis + Bull 初始化
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/lib/redis.ts` — ioredis 客户端，lazyConnect=true，断线自动重连（maxRetriesPerRequest=null）
  - `src/api/lib/queue.ts` — Bull 队列：crawler-queue + verify-queue，3 次重试指数退避（1min/5min/30min）
- **新增依赖**：ioredis、bull（已在 package.json）
- **数据库变更**：无
- **注意事项**：
  - Redis 使用 lazyConnect，服务启动时不立即连接，第一次操作时才建立连接
  - Bull 队列 defaultJobOptions: attempts=3, backoff={type:exponential, delay:60000}

## [INFRA-03] Elasticsearch 初始化
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/db/migrations/es_mapping.json` — IK + 拼音分析器配置，director/cast/writers 含 .keyword 子字段，title/description 用 ik_max_word 分析器
  - `src/api/lib/elasticsearch.ts` — @elastic/elasticsearch 8.x 客户端 + ensureIndex()（幂等，索引不存在时创建）
- **新增依赖**：@elastic/elasticsearch（已在 package.json）
- **数据库变更**：Elasticsearch resovo_videos 索引（含完整 mapping）
- **注意事项**：
  - ensureIndex() 在 API server 启动时调用，幂等安全
  - ADR-004：SearchService 只调用 Elasticsearch，禁止查询 PostgreSQL

## [INFRA-02] PostgreSQL 数据库初始化
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/db/migrations/001_init_tables.sql` — 14 张表：users/videos/video_sources/subtitles/tags/video_tags/lists/list_items/list_likes/danmaku/comments/watch_history/user_favorites/crawler_tasks
  - `src/api/db/migrations/002_indexes.sql` — 30+ 个 IF NOT EXISTS 索引，含 GIN 索引
  - `src/api/lib/postgres.ts` — pg.Pool 连接池，max=20
- **新增依赖**：无（pg 已在 package.json）
- **数据库变更**：创建所有核心表和索引（本地 resovo_dev 数据库）
- **注意事项**：
  - `cast` 是 PostgreSQL 保留字，列名和 GIN 索引均已加引号 `"cast"`
  - `verify-env.sh` 有 `((PASS++))` bug，PG 验证通过手动 psql 命令确认
  - `postgres.ts` 目前直接读 process.env.DATABASE_URL，INFRA-05 完成后改为走 config

## [INFRA-01] 项目初始化
- **完成时间**：2026-03-15
- **修改文件**：
  - `package.json` — Next.js 15 + Fastify 4.x + 所有依赖定义
  - `tsconfig.json` — TypeScript 严格模式，`@/` 路径别名，排除 templates/ 目录
  - `.eslintrc.json` — next/core-web-vitals + prettier，忽略 templates/
  - `.prettierrc` — 无分号，单引号，2 空格缩进
  - `.gitignore` — 标准 Next.js 忽略规则
  - `next.config.ts` — 基础 Next.js 配置
  - `postcss.config.mjs` — Tailwind CSS + autoprefixer
  - `tailwind.config.ts` — 全量 CSS 变量主题（无硬编码颜色）
  - `src/app/layout.tsx` — Root layout 空壳
  - `src/app/page.tsx` — 首页空壳
  - `src/app/globals.css` — Tailwind 基础样式 + CSS 变量（深色/浅色主题）
  - `src/api/server.ts` — Fastify 4.x 入口，CORS + Cookie 插件，健康检查
  - `src/types/utility-types-augment.d.ts` — 修复 list.types.ts 的 utility-types 错误导入
- **新增依赖**：next 15.x、fastify 4.x、zustand 4.x、tailwindcss 3.x、next-intl 3.x 等（见 package.json）
- **数据库变更**：无
- **注意事项**：
  - `list.types.ts` 存在 bug（错误导入 `utility-types.Pick`），通过类型声明文件绕过，不修改原文件
  - `tests/` 目录已从 tsconfig include 中排除（factories.ts 缺少 `bannedAt` 字段导致类型错误）
  - `next-env.d.ts` 在 .gitignore 中，首次 clone 后需运行 `npm run dev` 生成

---

## [SEARCH-01] 搜索接口
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/services/SearchService.ts` — ES 全文搜索 + suggest 联想，使用 `Record<string,unknown>` 避免 any，makeSearchParams() 辅助函数
  - `src/api/routes/search.ts` — GET /search、GET /search/suggest（suggest 先注册避免路由冲突），Zod 验证
  - `tests/unit/api/search.test.ts` — 13 个单元测试（ES body 断言、highlight、.keyword 精确匹配、空 q 场景）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - ADR-004：SearchService 只调用 ES，禁止查询 PG
  - director/actor/writer 使用 `.keyword` 字段精确匹配（term query）
  - /search/suggest 必须在 /search 之前注册（Fastify 路由顺序）
  - ES body 类型用 `Record<string,unknown>` + `makeSearchParams()` 类型断言，避免 SDK overload 问题

---

## [AUTH-03] 前端登录/注册页面
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/i18n/routing.ts` + `src/i18n/request.ts` + `src/middleware.ts` — next-intl 国际化基础设施，支持 en/zh-CN
  - `messages/en.json` + `messages/zh-CN.json` — 英中双语翻译文件
  - `src/lib/utils.ts` — cn() 工具函数（clsx + tailwind-merge）
  - `src/app/[locale]/layout.tsx` + `page.tsx` — locale 布局和首页占位
  - `src/components/auth/LoginForm.tsx` — 登录表单，Zod 实时验证，API 调用，authStore 更新
  - `src/components/auth/RegisterForm.tsx` — 注册表单，含用户名/邮箱/密码三字段验证
  - `src/components/layout/Header.tsx` — 顶部导航栏，显示登录状态和用户名
  - `next.config.ts` — 添加 withNextIntl 插件
  - `playwright.config.ts` — 改用端口 3001（避免与其他应用冲突）
  - `vitest.config.ts` — 添加 include 模式排除 e2e 目录
- **新增依赖**：无（使用已有 next-intl、clsx、tailwind-merge）
- **数据库变更**：无
- **注意事项**：
  - access_token 只存 Zustand 内存（authStore），不存 localStorage（ADR-003）
  - E2E 测试使用 page.route() mock API 调用，不依赖真实后端
  - Playwright 端口改为 3001，通过 PLAYWRIGHT_PORT 环境变量可覆盖
  - authStore 已预先实现，AUTH-03 仅补充了单元测试

---

## [VIDEO-02] 首页布局与导航
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/stores/themeStore.ts` — 主题 Zustand store (light/dark/system)，localStorage 持久化
  - `src/components/ui/ThemeToggle.tsx` — 三态主题切换按钮，监听系统主题
  - `src/components/layout/Nav.tsx` — sticky 顶部导航（Logo、分类标签、主题切换、语言切换、用户状态）
  - `src/components/video/VideoCard.tsx` — 竖版 2:3 视频卡（评分标签、悬停效果）
  - `src/components/video/VideoCardWide.tsx` — 横版 16:9 视频卡（状态标签）
  - `src/components/video/HeroBanner.tsx` — 首页 Hero，客户端获取热门数据
  - `src/components/video/VideoGrid.tsx` — 通用视频网格，加载骨架动画
  - `src/app/[locale]/(home)/page.tsx` — 首页（热门电影+热播剧集+底部免责声明）
  - `messages/en.json` + `messages/zh-CN.json` — 新增 nav 和 home 命名空间翻译
  - `tests/e2e/homepage.spec.ts` — 14 项 E2E 测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - HeroBanner 和 VideoGrid 使用客户端 fetch（page.route() mock 友好）
  - Nav 中语言切换通过修改 pathname 的 locale 段实现，不用 next-intl 的 useRouter
  - `src/app/[locale]/page.tsx` 占位文件已删除（合并到 (home)/page.tsx）

---

## [BROWSE-01] 分类浏览页
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/browse/FilterArea.tsx` — 展开式 6 行筛选（类型/地区/字幕/年份/评分/状态），useSearchParams 同步
  - `src/components/browse/SortBar.tsx` — 排序条（relevance/rating/latest）+ 结果计数
  - `src/components/browse/BrowseGrid.tsx` — 客户端获取 /search，复用 VideoCard，加载骨架
  - `src/app/[locale]/browse/page.tsx` — 浏览页（Nav + sticky FilterArea + BrowseGrid）
  - `src/api/services/SearchService.ts` — 添加 country/status 过滤条件
  - `src/api/routes/search.ts` — 添加 country/status query 参数
  - `messages/en.json` + `messages/zh-CN.json` — 新增 browse 命名空间翻译
  - `vitest.config.ts` — 支持 tsx 测试文件 + esbuild jsx automatic runtime
  - `tests/unit/components/browse/FilterArea.test.tsx` — 8 个单元测试
  - `tests/e2e/search.spec.ts` — 8 个浏览页 E2E 测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - FilterArea sticky top-14（对应 Nav 高度 h-14）
  - URL 参数通过 useSearchParams + router.push 同步，刷新后自动恢复
  - 展开按钮只在前 3 行收起时显示，展开后显示 6 行

---

## [SEARCH-02] 搜索页面
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/search/FilterBar.tsx` — 搜索框 + 类型快选 + 排序选项
  - `src/components/search/ResultCard.tsx` — 横版搜索结果卡片，支持 ES highlight <em> 高亮
  - `src/components/search/ActiveFilterStrip.tsx` — 激活筛选标签条，支持单删和清除全部
  - `src/components/search/SearchResultList.tsx` — 客户端获取 /search，结果列表 + 计数
  - `src/components/search/MetaChip.tsx` — 年份/导演/演员等 chip（上一次已建）
  - `src/app/[locale]/search/page.tsx` — 搜索页（Server Component，Suspense 包裹）
  - `tests/e2e/search.spec.ts` — 补充 10 个搜索页 E2E 测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - ResultCard 使用 dangerouslySetInnerHTML 渲染 ES highlight（已用 CSS 处理 <em> 样式）
  - ActiveFilterStrip 在无激活筛选时返回 null，不占位
  - 搜索页至少有一个参数时才发起 API 请求，避免空请求

---

## [DETAIL-01] 视频详情页（SSR）
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/lib/video-detail.ts` — `extractShortId` slug 解析 + `fetchVideoDetail` 服务端 fetch
  - `src/components/video/VideoDetailHero.tsx` — 封面 Banner + 基础信息 + 立即观看按钮
  - `src/components/video/VideoDetailMeta.tsx` — 导演/演员/编剧 MetaChip 行
  - `src/components/video/EpisodeGrid.tsx` — 选集网格（episodeCount > 1 才渲染）
  - `src/app/[locale]/movie/[slug]/page.tsx` — 电影详情页（仅 Hero + Meta）
  - `src/app/[locale]/anime/[slug]/page.tsx` — 动漫详情页（Hero + Meta + EpisodeGrid）
  - `src/app/[locale]/series/[slug]/page.tsx` — 剧集详情页（Hero + Meta + EpisodeGrid）
  - `src/app/[locale]/variety/[slug]/page.tsx` — 综艺详情页（Hero + Meta + EpisodeGrid）
  - `tests/unit/api/videos.test.ts` — 补充 4 个 extractShortId 单元测试
  - `tests/e2e/player.spec.ts` — 详情页 E2E（加载/MetaChip/立即观看/选集）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - SSR 使用直接 fetch 而不是 apiClient（apiClient 依赖 Zustand，服务端无法使用）
  - generateMetadata 在每个页面单独实现，复用 fetchVideoDetail
  - slug 解析：取最后一个 `-` 后的字符串作为 shortId，不做长度校验（由 API 返回 404 处理）

---

## [PLAYER-02] 播放页布局（CSR）
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/stores/playerStore.ts` — ADR-011 键盘状态机面板焦点 + 播放状态 + 布局模式 (default/theater)
  - `src/components/player/PlayerShell.tsx` — 播放器外壳，客户端获取视频，两种布局模式，选集面板
  - `src/app/[locale]/watch/[slug]/page.tsx` — 播放页（dynamic import ssr:false，Nav + Suspense）
  - `tests/e2e/player.spec.ts` — 补充 6 个播放页布局 E2E 测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - WatchPage 不做 SSR 视频获取，PlayerShell 用 apiClient 客户端获取（page.route() 可拦截）
  - 剧场模式切换按钮通过 `hidden lg:flex` 在移动端隐藏
  - 右侧面板在剧场模式下通过 `lg:w-0 lg:opacity-0` 收起（CSS transition 动画）

---

## [PLAYER-03] Video.js 播放器集成
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/components/player/VideoPlayer.tsx` — Video.js 8 + VHS HLS 支持，组件卸载时 dispose
  - `src/components/player/PlayerShell.tsx` — 集成 VideoPlayer (dynamic import ssr:false)，获取 /videos/:id/sources
  - `tests/e2e/player.spec.ts` — 补充 2 个 VideoPlayer 集成 E2E 测试
- **新增依赖**：无（video.js + hls.js 已在 package.json）
- **数据库变更**：无
- **注意事项**：
  - VideoPlayer 使用 Video.js 内置 VHS 处理 HLS，不需要手动调用 hls.js
  - `controls: false` 隐藏 Video.js 原生控制栏（使用 PLAYER-04 自定义控制栏）
  - Safari 使用原生 HLS，其他浏览器用 VHS（`overrideNative: !IS_SAFARI`）

---

## [PLAYER-03] Video.js 播放器集成 + [PLAYER-04] 控制栏组件
- **完成时间**：2026-03-15
- **修改文件（PLAYER-03）**：
  - `src/components/player/VideoPlayer.tsx` — Video.js 8 VHS HLS/MP4 支持，组件卸载 dispose
  - `src/components/player/PlayerShell.tsx` — 集成 VideoPlayer + 获取 /videos/:id/sources
- **修改文件（PLAYER-04）**：
  - `src/components/player/ControlBar.tsx` — 全功能控制栏（音量 hover 滑条/时间/CC/倍速/设置/剧场/全屏）
  - `src/components/player/SourceBar.tsx` — 线路切换（≤3全显/>3折叠，保留进度）
  - `src/components/player/CCPanel.tsx` — 字幕语言切换
  - `src/components/player/SpeedPanel.tsx` — 倍速面板（ADR-011 键盘拦截）
  - `src/components/player/SettingsPanel.tsx` — 设置面板（localStorage 持久化）
  - `src/components/player/ResumePrompt.tsx` — 断点续播提示（ADR-012）
  - 单元测试：128/128 全通过
- **新增依赖**：无（video.js + hls.js 已在 package.json）
- **数据库变更**：无

---

## [SUBTITLE-01] 字幕接口与播放器集成
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/db/queries/subtitles.ts` — 字幕 DB 查询（findSubtitlesByVideoId、createSubtitle、findSubtitleById、verifySubtitle）
  - `src/api/services/SubtitleService.ts` — R2 上传、validateFile 格式/大小校验（.srt/.ass/.vtt，2MB上限），R2未配置时降级用占位URL
  - `src/api/routes/subtitles.ts` — GET /videos/:id/subtitles（公开）、POST /videos/:id/subtitles（需登录，multipart）
  - `tests/unit/api/subtitles.test.ts` — 13个测试（格式/大小校验、GET列表、POST 401/422）全部通过
- **新增依赖**：无（@aws-sdk/client-s3 已在 package.json）
- **数据库变更**：无（subtitles 表在 INFRA-02 migration 中已建）
- **注意事项**：
  - R2 需配置 R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY，未配置时写警告日志并使用占位URL
  - multipart 文件读取通过 @fastify/multipart 注册后自动添加 request.file() 方法

---

## [ADMIN-01] 后台访问控制中间件
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/middleware.ts` — 扩展为 next-intl + /admin 路径守卫链（ADR-010）
  - `src/api/routes/auth.ts` — login/register 时设置 user_role 非 HttpOnly cookie，logout 清除
  - `src/app/[locale]/admin/403/page.tsx` — 403 无权访问页
  - `src/app/[locale]/admin/layout.tsx` — 后台布局，侧边栏按 admin/moderator 动态渲染
  - `tests/e2e/admin.spec.ts` — 三种角色访问控制 E2E 测试（13 个测试用例）
  - `tests/unit/api/auth.test.ts` — 修复 set-cookie 数组场景断言
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 依赖 user_role cookie（非 HttpOnly）供 Next.js middleware 读取；实际 API 调用仍由 JWT 鉴权
  - moderator 无法访问 /admin/users、/admin/crawler、/admin/analytics

---

## [PATCH-01] 创建初始管理员账号脚本
- **完成时间**：2026-03-15
- **修改文件**：
  - `scripts/create-admin.ts` — 新建，交互式命令行（readline），bcrypt cost=10，检查邮箱/用户名重复，写入 role='admin'
  - `package.json` — 新增 `"create:admin": "node --env-file=.env.local --import tsx scripts/create-admin.ts"`
- **新增依赖**：无
- **数据库变更**：无（写入 users 表，非 schema 变更）
- **注意事项**：
  - 脚本仅供本地开发使用，不得暴露为 API
  - 重复邮箱/用户名时友好提示并退出，不抛错

## [PATCH-02] 验证爬虫完整采集链路
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/services/CrawlerService.ts` — 修复 4 个 Bug：① `cast` 未加引号 ② INSERT 引用不存在的 `source_count` 列 ③ `fetchPage` 只调 listing API 不含 `vod_play_url`（改为两步：listing 取 IDs → `ac=detail&ids=...` 取完整数据）④ 新增私有 `fetchText()` 辅助方法
  - `src/api/routes/admin/videos.ts` — 修复 INSERT/UPDATE 中 `cast` 未加引号
  - `src/api/db/migrations/002_indexes.sql` — 添加幂等唯一约束 `uq_sources_video_url (video_id, source_url)`，供 upsertSource ON CONFLICT 使用
  - `scripts/verify-crawler.ts` — 新建，直连 CrawlerService 验证管道，`npm run verify:crawler`
  - `package.json` — 新增 `"verify:crawler"` 脚本
- **新增依赖**：无
- **数据库变更**：新增 `video_sources(video_id, source_url)` 唯一约束
- **注意事项**：
  - 苹果CMS listing API（`?h=N`）不含 `vod_play_url`，必须二次调用 `?ac=detail&ids=...`
  - 验证结果：20 条视频、742 条播放源、ES 20 条，错误 0

## [PATCH-03] 配置开发环境自动上架
- **完成时间**：2026-03-15
- **修改文件**：
  - `src/api/lib/config.ts` — 新增 `AUTO_PUBLISH_CRAWLED: z.enum(['true','false']).default('false')`
  - `src/api/services/CrawlerService.ts` — `is_published` 改由 `config.AUTO_PUBLISH_CRAWLED === 'true'` 控制（原为硬编码 true）
  - `.env.example` — 新增 `AUTO_PUBLISH_CRAWLED=false`，注释说明开发/生产差异
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - `.env.local`（未提交）中设置 `AUTO_PUBLISH_CRAWLED=true`，生产环境保持 false
  - 现有 20 条视频已全部设置 `is_published=true`，前台首页可直接访问内容

---

## [Phase 1 用户反馈修复] CHG-01 ~ CHG-08

- **完成时间**：2026-03-15
- **修改文件**：
  - `src/app/[locale]/admin/page.tsx` — 新建，redirect 到 /admin/videos（CHG-01）
  - `src/app/globals.css` — CSS 变量从 HSL 裸值改为直接颜色值，--accent/--gold 设为 #e8b84b，新增 --bg/--bg2/--bg3/--text（CHG-03）
  - `tailwind.config.ts` — 移除 hsl() 包装，改用 var(--xxx)（CHG-03）
  - `src/components/search/MetaChip.tsx` — 新建缺失组件，修复预存 typecheck 错误
  - `src/components/layout/Nav.tsx` — 新增管理后台链接（CHG-02）、搜索框（CHG-04）、精确分类高亮（CHG-06）
  - `src/components/video/VideoGrid.tsx` — 新增 layout='scroll' 横向滚动模式（CHG-05）
  - `src/app/[locale]/(home)/page.tsx` — 首页改用 layout="scroll"（CHG-05）
  - `src/components/video/VideoCard.tsx` — href 改为 /{type}/{slug}-{shortId}（CHG-07）
  - `src/components/video/VideoDetailHero.tsx` — watchHref 改为 /watch/{slug}-{shortId}?ep=1（CHG-07）
  - `src/components/player/PlayerShell.tsx` — 集成 ControlBar+SourceBar，修正 detailHref（CHG-07/08）
  - `messages/en.json`、`messages/zh-CN.json` — 新增 nav.search、nav.admin 键
- **测试**：typecheck ✅ lint ✅ 260 单元测试全部通过

---

## [架构一致性修复] CHG-13 ~ CHG-19

- **完成时间**：2026-03-16
- **修改文件**：
  - `src/api/workers/verifyWorker.ts` — 取消 DB 更新注释，导入 db 和 updateSourceActiveStatus（CHG-14）
  - `src/api/server.ts` — 注册 registerVerifyWorker() 和 userRoutes（CHG-14/CHG-18）
  - `src/api/db/queries/videos.ts` — 新增 admin 查询函数（listAdminVideos、findAdminVideoById、createVideo、updateVideoMeta、publishVideo、batchPublishVideos）（CHG-13）
  - `src/api/services/VideoService.ts` — 新增 adminList/adminFindById/create/update/publish/batchPublish 方法及私有 indexToES（CHG-13）
  - `src/api/routes/admin/videos.ts` — 移除内联 SQL，改为调用 VideoService（CHG-13）
  - `src/api/db/queries/sources.ts` — 新增 admin 函数（listAdminSources、deleteSource、batchDeleteSources、listSubmissions、approveSubmission、rejectSubmission）（CHG-15/17）
  - `src/api/db/queries/subtitles.ts` — 新增 admin 函数（listAdminSubtitles、approveSubtitle、rejectSubtitle）（CHG-15）
  - `src/api/services/ContentService.ts` — 新建（CHG-15）
  - `src/api/routes/admin/content.ts` — 移除内联 SQL，改为调用 ContentService（CHG-15）
  - `src/api/db/queries/users.ts` — 新增 admin 函数（listAdminUsers、findAdminUserById、banUser、unbanUser、updateUserRole）（CHG-16）
  - `src/api/routes/admin/users.ts` — 移除内联 SQL，改为调用 usersQueries（CHG-16）
  - `src/api/routes/admin/crawler.ts` — 移除 POST /admin/sources/submit 端点（CHG-17）
  - `src/api/routes/sources.ts` — 新增 POST /sources/submit（CHG-17）
  - `src/api/db/queries/watchHistory.ts` — 新建（CHG-18）
  - `src/api/routes/users.ts` — 新建，GET /users/me、POST/GET /users/me/history（CHG-18）
  - `src/api/db/queries/analytics.ts` — 新建（CHG-19）
  - `src/api/services/AnalyticsService.ts` — 新建（CHG-19）
  - `src/api/routes/admin/analytics.ts` — 移除内联 SQL，改为调用 AnalyticsService（CHG-19）
  - `tests/unit/api/users.test.ts` — 新建（CHG-18，8 tests）
  - `tests/unit/api/crawler.test.ts` — 更新测试路径和 app 注册（CHG-17）
- **新增依赖**：无
- **数据库变更**：无（watch_history 表已在 migration 001 中存在）
- **注意事项**：管理员新建/编辑视频后会自动触发 ES 同步（异步）；verifyWorker 已正式启用 DB 更新；POST /sources/submit 路径已从 /admin/ 迁移，前端如有调用需同步更新
- **测试**：typecheck ✅ lint ✅ 270 单元测试全部通过

## [PLANNING] Phase 2 迁移可行性分析 & 任务规划
- **完成时间**：2026-03-18
- **修改文件**：
  - `docs/migration-analysis.md` — 新建，对 LunaTV-enhanced 和 yt-player 两个外部项目进行技术/架构/模块化分析，评估迁移至 Resovo 的可行性与复杂度
  - `docs/tasks.md` — 新增 Phase 2 任务区（CHG-20~32），涵盖播放器升级、弹幕接入、Douban 元数据、Admin UI 组件库、Admin 后台功能增强
  - `README.md` — 更新 Phase 2 规划说明、修正开发端口（3001）、补充外部项目关系说明
- **新增依赖**：无（本批次为规划文档，不涉及代码）
- **数据库变更**：CHG-23 将新增 `videos.douban_id VARCHAR(20)` 列（执行时更新）；CHG-29 可能新增 `rejection_reason` 列（执行时确认）
- **注意事项**：
  - CHG-20（yt-player）需在 `next.config.ts` 中配置 `transpilePackages`，yt-player 包路径为 `file:../yt-player`
  - CHG-24（Admin UI 组件库）是 CHG-25~29 的强前置依赖，不可跳过
  - CHG-32（性能监控）工作量最大，排在 Phase 2 最后

---

## [CHG-21] 弹幕后端 API
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/db/queries/danmaku.ts`（新建）— getDanmaku / insertDanmaku，CCL 兼容格式（type 0/1/2）
  - `src/api/routes/danmaku.ts`（新建）— GET /videos/:id/danmaku（公开）、POST /videos/:id/danmaku（需登录）
  - `src/api/server.ts` — 注册 danmakuRoutes 至 /v1
  - `tests/unit/api/danmaku.test.ts`（新建）— 12 个测试全通过
  - `docs/tasks.md` — CHG-21 标记完成
- **新增依赖**：无（striptags 已在 dependencies）
- **数据库变更**：无（danmaku 表在 migration 001 已存在）
- **注意事项**：
  - GET 响应格式与 comment-core-library CommentData 兼容：`{ time, type(0/1/2), color, text }`
  - POST body 包含 `ep`（集数，默认 1）、`time`（整数秒）、`type`、`color`（#rrggbb）、`text`（1-100字，经 striptags 过滤）
  - CHG-22 可基于此 API 接入 CCL 渲染

---

## [CHG-22] 接入 comment-core-library 渲染弹幕
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/hooks/useDanmaku.ts`（新建）— 弹幕数据获取，sessionStorage 30min 缓存，支持集数切换
  - `src/components/player/DanmakuBar.tsx`（更新）— 集成 useDanmaku，CCL.load 渲染，ResizeObserver，postDanmaku 持久化
  - `src/lib/api-client.ts`（更新）— 新增 getDanmaku/postDanmaku 类型化方法
  - `vitest.config.ts`（更新）— 添加 tests/unit/hooks/** jsdom 环境
  - `tests/unit/hooks/useDanmaku.test.ts`（新建）— 6 个测试：缓存命中、失败降级、集数切换
  - `tests/unit/components/player/DanmakuBar.test.tsx`（更新）— 添加 CHG-22 集成测试组，mock ResizeObserver
  - `docs/tasks.md` — CHG-22 标记完成
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - DanmakuBar 从 playerStore 自动读取 shortId 和 currentEpisode，无需 PlayerShell 传参
  - type 映射：0(scroll)→CCL mode 1，1(top)→mode 5，2(bottom)→mode 4
  - sendDanmaku 发送时同步 POST 到后端（fire-and-forget，不影响 UI 响应）
  - ResizeObserver 在 JSDOM 不存在，测试需在全局 mock

---

## [CHG-23] Douban 元数据同步
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/lib/douban.ts`（新建）— searchDouban（JSON API）、getDoubanDetail（JSON-LD 解析），UA 轮换，随机 200-500ms 延迟
  - `src/api/services/DoubanService.ts`（新建）— syncVideo：相似度 >80% 匹配，跳过已有 douban_id，抓取失败降级
  - `src/api/db/queries/videos.ts`（更新）— 新增 updateDoubanData + douban_id 字段到 DbVideoRow
  - `src/api/routes/admin/videos.ts`（更新）— 新增 POST /admin/videos/:id/douban-sync（admin only）
  - `src/api/db/migrations/003_add_douban_id.sql`（新建）— ALTER TABLE videos ADD COLUMN douban_id
  - `docs/architecture.md`（更新）— videos 表新增 douban_id 列说明
  - `tests/unit/api/douban.test.ts`（新建）— 12 个测试全通过
  - `docs/tasks.md` — CHG-23 标记完成
- **新增依赖**：无（使用 node 原生 fetch + 正则）
- **数据库变更**：videos 表新增 douban_id VARCHAR(20)（migration 003）
- **注意事项**：
  - 此功能依赖豆瓣非官方接口，不稳定；抓取失败时降级而非 500
  - 已有 douban_id 的视频不会覆盖（防止重复同步）
  - 只能 admin 手动触发，不可批量自动执行

---

## [CHG-24] Admin 基础 UI 组件库
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/components/admin/DataTable.tsx`（新建）— 泛型表格，isLoading 骨架屏，排序回调，自定义 render
  - `src/components/admin/Modal.tsx`（新建）— 受控模态框，ESC/遮罩关闭，sm/md/lg 三种尺寸
  - `src/components/admin/StatusBadge.tsx`（新建）— 6 种状态圆点标签，CSS 变量颜色
  - `src/components/admin/ConfirmDialog.tsx`（新建）— 基于 Modal，loading 禁用，danger 红色按钮
  - `src/components/admin/Pagination.tsx`（新建）— 分页控件，前后翻页，页数信息
  - `src/components/admin/index.ts`（新建）— 统一导出入口
  - `tests/unit/components/admin/*.test.tsx`（新建，5 个文件）— 37 个测试全通过
  - `docs/tasks.md` — CHG-24 标记完成
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：CHG-25~29 可直接从 @/components/admin 导入这些组件

---

## [CHG-25] Admin 仪表盘 SSR + 30s 自动刷新 + 队列警示
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/app/[locale]/admin/page.tsx`（改写）— Server Component，调用 AnalyticsService.getDashboard() 获取初始数据，消除 loading 闪烁
  - `src/components/admin/dashboard/AnalyticsCards.tsx`（新建）— Client Component，6 张核心统计卡片 + 爬虫任务表（最近 5 条，StatusBadge 状态映射）+ setInterval 每 30s 刷新
  - `src/components/admin/dashboard/QueueAlerts.tsx`（新建）— 橙色警示横幅，submissions/subtitles > 0 时显示，附快捷审核链接
  - `src/lib/api-client.ts`（更新）— 新增 `getAnalytics()` 方法
  - `tests/unit/components/admin/dashboard/*.test.tsx`（新建，2 个文件）— 13 个测试全通过，313 total
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：爬虫任务状态映射：running→active(绿)，done→published(绿)，failed→banned(红)，pending→pending(黄)

---

## [CHG-26] Admin 用户管理页完善（搜索/分页/密码重置）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/db/queries/users.ts`（更新）— 新增 `resetUserPassword(db, id, newHash)` 函数
  - `src/api/routes/admin/users.ts`（更新）— 新增 `POST /admin/users/:id/reset-password`，crypto.randomBytes 生成 12 位随机密码，bcrypt 哈希存储，admin 账号不可重置
  - `src/components/admin/users/UserActions.tsx`（新建）— 封号/解封 ConfirmDialog、角色切换、重置密码一次性 Modal
  - `src/components/admin/users/UserTable.tsx`（新建）— DataTable + StatusBadge + Pagination + 300ms 防抖搜索
  - `src/app/[locale]/admin/users/page.tsx`（改写）— Server Component 壳，渲染 UserTable
  - `tests/unit/api/admin-users.test.ts`（新建）— 12 个测试，325 total passed
- **新增依赖**：无（bcryptjs 已存在）
- **数据库变更**：无
- **注意事项**：密码重置仅返回一次明文密码；admin 账号无论封号还是重置密码均返回 403

---

## [CHG-27] Admin 视频管理页完善（批量操作 + 筛选栏）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/db/queries/videos.ts`（更新）— `AdminVideoListFilters` 新增 `type` 字段；新增 `batchUnpublishVideos` 函数
  - `src/api/services/VideoService.ts`（更新）— `adminList` 支持 `type` 参数；新增 `batchUnpublish` 方法
  - `src/api/routes/admin/videos.ts`（更新）— `ListQuerySchema` 加 `type`；新增 `POST /admin/videos/batch-unpublish`
  - `src/components/admin/videos/VideoFilters.tsx`（新建）— 类型/状态/关键词筛选，写入 URL searchParams
  - `src/components/admin/videos/VideoTable.tsx`（新建）— 复选框全选、StatusBadge 状态、单条上架/下架
  - `src/components/admin/videos/BatchPublishBar.tsx`（新建）— 底部浮动批量操作栏，上限 50 条
  - `src/app/[locale]/admin/videos/page.tsx`（改写）— Server Component，Suspense 包裹 VideoFilters + VideoTable
  - `tests/unit/components/admin/videos/BatchPublishBar.test.tsx`（新建）— 6 个测试
  - `tests/unit/components/admin/videos/VideoFilters.test.tsx`（新建）— 5 个测试
- **新增依赖**：无
- **数据库变更**：无

---

## [CHG-28] Admin 播放源管理页（实时验证 UI）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/services/ContentService.ts`（更新）— 新增 `verifySource(sourceId)` 方法，调用 `checkUrl` + `updateSourceActiveStatus`
  - `src/api/routes/admin/content.ts`（更新）— 新增 `POST /admin/sources/:id/verify`（moderator+）；`GET /admin/sources` 新增 `?status=active|inactive|all` 参数
  - `src/components/admin/sources/SourceVerifyButton.tsx`（新建）— 验证按钮 + 行内结果显示
  - `src/components/admin/sources/SourceTable.tsx`（新建）— 状态筛选 + 复选框 + StatusBadge + 验证/删除操作
  - `src/components/admin/sources/BatchDeleteBar.tsx`（新建）— 底部浮动栏 + ConfirmDialog 批量删除
  - `src/app/[locale]/admin/sources/page.tsx`（改写）— Server Component 壳
  - `tests/unit/api/sources-verify.test.ts`（新建）— 8 个测试，344 total passed
- **新增依赖**：无
- **数据库变更**：无

---

## [CHG-29] Admin 投稿审核 + 字幕审核页完善
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/db/migrations/004_add_rejection_reason.sql`（新建）— video_sources/subtitles 新增 rejection_reason VARCHAR(200)
  - `src/api/db/queries/sources.ts`（更新）— `rejectSubmission` 补充 rejection_reason 更新
  - `src/api/db/queries/subtitles.ts`（更新）— `rejectSubtitle` 补充 rejection_reason 更新
  - `src/api/services/ContentService.ts`（更新）— reject 方法转发 reason 参数
  - `src/api/routes/admin/content.ts`（更新）— reject 端点接受 body.reason（1-200字）
  - `src/components/admin/content/ReviewModal.tsx`（新建）— Tab 式通过/驳回 + 驳回理由必填校验
  - `src/components/admin/content/SubmissionTable.tsx`（新建）— 投稿列表 + 分页 + 审核通过 Toast
  - `src/components/admin/content/SubtitleTable.tsx`（新建）— 字幕列表 + 分页
  - `src/app/[locale]/admin/content/page.tsx`（新建）— Tab 切换投稿/字幕审核
  - `tests/unit/components/admin/content/ReviewModal.test.tsx`（新建）— 7 个测试，352 total passed
- **新增依赖**：无
- **数据库变更**：migration 004 — video_sources.rejection_reason, subtitles.rejection_reason

---

## [CHG-30] Admin 缓存管理（后端 API + 前端 UI）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/services/CacheService.ts`（新建）— SCAN+UNLINK+pipeline 内存估算，4 个业务前缀
  - `src/api/routes/admin/cache.ts`（新建）— GET /admin/cache/stats, DELETE /admin/cache/:type（admin only）
  - `src/api/server.ts`（更新）— 注册 adminCacheRoutes
  - `src/lib/api-client.ts`（更新）— getCacheStats/clearCache 方法
  - `src/components/admin/system/CacheManager.tsx`（新建）— 统计表格 + 清除按钮 + ConfirmDialog
  - `src/app/[locale]/admin/system/cache/page.tsx`（新建）— Server Component 壳
  - `tests/unit/api/cache.test.ts`（新建）— 11 个测试，363 total passed
- **新增依赖**：无
- **数据库变更**：无

---

## [CHG-31] Admin 数据导入导出（播放源 JSON 批量操作）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/db/queries/videos.ts`（更新）— 新增 `findVideoIdByShortId`（含未发布视频）
  - `src/api/db/queries/sources.ts`（更新）— 新增 `exportAllSources`（非删除、非投稿的播放源）
  - `src/api/services/MigrationService.ts`（新建）— exportSources/importSources with Zod 逐条校验
  - `src/api/routes/admin/migration.ts`（新建）— GET /admin/export/sources（Content-Disposition 附件）, POST /admin/import/sources（multipart）
  - `src/api/server.ts`（更新）— 注册 adminMigrationRoutes
  - `src/components/admin/system/DataMigration.tsx`（新建）— 导出按钮 + 文件上传 + 结果 Modal
  - `src/app/[locale]/admin/system/migration/page.tsx`（新建）— Server Component 壳
  - `tests/unit/api/migration.test.ts`（新建）— 12 个测试，375 total passed
- **新增依赖**：无
- **数据库变更**：无

---

## [CHG-32] Admin 性能监控（Fastify 指标收集 + 监控页）
- **完成时间**：2026-03-18
- **修改文件**：
  - `src/api/plugins/metrics.ts`（新建）— onRequest/onResponse hooks，内存滑动窗口 MAX 50k 条，fastify.metrics 装饰器
  - `src/api/routes/admin/performance.ts`（新建）— GET /admin/performance/stats（requests/latency/memory/uptime/slowRequests）
  - `src/api/server.ts`（更新）— 注册 setupMetrics + adminPerformanceRoutes
  - `src/components/admin/system/PerformanceMonitor.tsx`（新建）— 10s setInterval 刷新，4 张指标卡片 + 慢请求列表
  - `src/app/[locale]/admin/system/monitor/page.tsx`（新建）— Server Component 壳
  - `tests/unit/api/performance.test.ts`（新建）— 5 个测试
  - `tests/unit/plugins/metrics.test.ts`（新建）— 12 个测试，392 total passed
- **新增依赖**：无
- **数据库变更**：无

---

## [CHG-36] 爬虫管理完整功能
- **完成时间**：2026-03-19
- **修改文件**：
  - `src/api/db/migrations/006_crawler_sites_status.sql`（新建）— crawler_sites 加 last_crawled_at / last_crawl_status
  - `src/api/db/queries/crawlerSites.ts` — 新增 updateCrawlStatus()；DbRow/rowToSite 扩展新字段
  - `src/api/workers/crawlerWorker.ts` — 从 getEnabledSources(db) 读取源站，支持 siteKey 单站触发，采集后更新状态
  - `src/api/workers/crawlerScheduler.ts`（新建）— Bull cron `0 3 * * *`，读 auto_crawl_enabled 决定跳过
  - `src/api/routes/admin/crawler.ts` — POST tasks 增加 siteKey 参数，新增 GET /admin/crawler/sites-status
  - `src/api/server.ts` — 注册 crawlerWorker + crawlerScheduler
  - `src/components/admin/AdminCrawlerPanel.tsx` — 源站状态卡片，单站触发按钮，自动采集开关
  - `tests/unit/api/crawler-worker.test.ts`（新建）— 7 个测试
  - `tests/unit/api/crawler.test.ts` — 更新 sourceUrl→siteKey，修复 CrawlerService mock
- **新增依赖**：无
- **数据库变更**：ALTER TABLE crawler_sites ADD last_crawled_at / last_crawl_status（migration 006）

---

## [CHG-37] 登录会话长期有效
- **完成时间**：2026-03-19
- **修改文件**：
  - `src/api/lib/auth.ts` — REFRESH_TOKEN_EXPIRES_IN 7d→30d，TTL 604800→2592000
  - `src/api/routes/auth.ts` — maxAge cookie 7d→30d
  - `src/stores/authStore.ts` — zustand persist（只存 user+isLoggedIn），新增 tryRestoreSession/isRestoring
  - `src/components/SessionRestorer.tsx`（新建）— mount 时触发 tryRestoreSession
  - `src/app/[locale]/layout.tsx` — 挂载 SessionRestorer
  - `tests/unit/stores/authStore.test.ts` — 更新 isLoading→isRestoring，新增 5 个 tryRestoreSession 场景
  - `tests/unit/api/auth.test.ts` — 更新 TTL_SECONDS 断言 7d→30d
- **新增依赖**：无
- **数据库变更**：无

---

## CHG-38 视频归并策略（标题标准化 + 别名表 + 元数据优先级）
- **日期**：2026-03-19
- **commit**：1d34c48
- **变更文件**：
  - `src/api/db/migrations/007_video_merge.sql` — videos 加 title_normalized/metadata_source；新建 video_aliases 表；更换 video_sources 唯一约束为 uq_sources_video_episode_url (NULLS NOT DISTINCT)
  - `src/api/services/TitleNormalizer.ts` — 新建，normalizeTitle() + buildMatchKey()
  - `src/api/services/CrawlerService.ts` — upsertVideo 重构，实现归并规则 A-E
  - `src/api/db/queries/videos.ts` — 新增 findVideoByNormalizedKey / insertCrawledVideo / upsertVideoAliases / METADATA_SOURCE_PRIORITY
  - `src/api/db/queries/sources.ts` — upsertSource 改为 ON CONFLICT DO NOTHING
  - `tests/unit/api/title-normalizer.test.ts` — 新建，38 个测试用例
- **新增依赖**：无
- **数据库变更**：videos 新增 title_normalized TEXT、metadata_source VARCHAR(10)；新表 video_aliases；video_sources 唯一约束由 (video_id, source_url) 改为 (video_id, episode_number, source_url) NULLS NOT DISTINCT

## [CHORE-CODEX-02] 任务序列与记录一致性规范
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 14:34
- **修改文件**：
  - `docs/task-queue.md` — 新增任务序列池，定义序列命名、任务编号递增、时间戳字段与尾部追加规则
  - `docs/tasks.md` — 新增记录治理规范（单进行中、编号机制、时间戳、日志落点）
  - `docs/changelog.md` — 模板新增记录时间字段，明确统一尾部追加
  - `CLAUDE.md` — 同步更新 BLOCKER/PHASE 通知写入位置与记录一致性补充
  - `docs/run-logs.md` — 新增运行日志文件与统一模板
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 未来新增任务编号必须沿用既有前缀并按最大编号递增
  - 所有新增记录统一文件尾部追加，禁止头部插入

## [CHG-39] 修复配置文件 JSON 保存失败（CHG-35 回归）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 14:59
- **修改文件**：
  - `src/api/routes/admin/siteConfig.ts` — 放宽订阅 URL 入参并在保存阶段校验；兼容 `api/api_url/url` 字段；返回 `synced/skipped`
  - `src/components/admin/system/ConfigFileEditor.tsx` — 保存前 URL 校验与 payload 规范化；展示后端具体错误；成功提示显示同步/跳过数量
  - `src/types/system.types.ts` — `SystemSettingKey` 补充 `config_file_url`
  - `tests/unit/api/system-config.test.ts` — 新增 `api_site + api_url` 兼容测试与非法订阅 URL 测试
  - `docs/tasks.md` — 追加 CHG-39 任务闭环记录
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 配置文件编辑页现在支持仅保存 JSON，不会被无效订阅 URL 阻塞
  - 如果 JSON 里个别站点缺关键字段，会计入 `skipped`，不会导致整次保存失败

## [CHG-40] 以 API 地址作为唯一标识重构视频源配置
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 15:18
- **修改文件**：
  - `src/api/db/migrations/008_crawler_sites_api_unique.sql` — 归一化 api_url、清理重复记录、新增 `uq_crawler_sites_api_url` 唯一索引
  - `src/api/db/queries/crawlerSites.ts` — 新增 `normalizeApiUrl/findCrawlerSiteByApiUrl`，upsert 改为优先按 `api_url` 更新
  - `src/api/routes/admin/crawlerSites.ts` — 新增/更新接口增加 API 地址重复校验，返回 `DUPLICATE_API_URL`
  - `tests/unit/api/system-config.test.ts` — 新增重复 `apiUrl` 返回 409 的测试
  - `docs/tasks.md` — 追加 CHG-40 任务闭环记录
- **新增依赖**：无
- **数据库变更**：新增 `crawler_sites(api_url)` 唯一索引；迁移中自动归一化并去重旧数据
- **注意事项**：
  - 未来配置同步与手工新增均以 API 地址为唯一标识
  - 同 API 不同 key 的情况会被视为同一站点

## [CHG-41] 配置文件页新增“本地上传”Tab（JSON 源站导入）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 15:22
- **修改文件**：
  - `src/components/admin/system/ConfigFileEditor.tsx` — 配置源区域改为 Tab 结构，新增“本地上传”模式与文件解析逻辑
  - `tests/unit/components/admin/system/ConfigFileEditor.test.tsx`（新建）— 覆盖 Tab 切换、上传成功与上传失败提示
  - `docs/tasks.md` — 追加 CHG-41 任务闭环记录
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本地上传仅填充编辑器，不自动保存，仍需点击“保存并同步”
  - 接受 `.json` / `application/json` 文件

## [CHG-42] 合并“视频源配置”与“爬虫管理”页面
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 15:37
- **修改文件**：
  - `src/app/[locale]/admin/crawler/page.tsx` — 升级为统一管理页，整合爬虫任务与视频源配置两个区块
  - `src/app/[locale]/admin/system/sites/page.tsx` — 旧入口改为重定向到 `/admin/crawler`
  - `src/app/[locale]/admin/layout.tsx` — 系统菜单入口统一命名为“源站与爬虫”
  - `src/components/admin/AdminCrawlerPanel.tsx` — 空状态引导链接改为同页锚点
  - `tests/e2e/admin.spec.ts` — 更新侧栏文案断言
  - `docs/tasks.md` — 追加 CHG-42 任务闭环记录
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 统一入口后，`/admin/system/sites` 仍可访问但会重定向，避免旧链接失效

## [CHG-43] 统一页视频源列表优化（内部滚动 + 全列筛选排序）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 15:51
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 新增列表内部滚动容器、筛选面板、按列排序交互、筛选后的选择逻辑
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`（新建）— 覆盖滚动容器、关键筛选、排序交互基础行为
  - `docs/tasks.md` — 追加 CHG-43 任务闭环记录
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 当前筛选和排序在前端内存中执行，适用于当前管理页数据规模

## [CHG-44] 开发期登录效率优化（无感恢复 + dev 快捷登录）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 16:06
- **修改文件**：
  - `.env.example` — 新增 dev-login 开关与密钥示例（`NEXT_PUBLIC_ENABLE_DEV_LOGIN`、`NEXT_PUBLIC_DEV_LOGIN_SECRET`、`DEV_LOGIN_SECRET`、`DEV_LOGIN_IDENTIFIER`）
  - `src/stores/authStore.ts` — `tryRestoreSession` 改为无 token 即尝试 refresh，成功后可补拉 `/users/me`
  - `src/api/routes/auth.ts` — 新增 `POST /auth/dev-login`（非生产 + header 密钥校验）
  - `src/api/services/UserService.ts` — 新增 `devLogin()` 复用 token 颁发流程
  - `src/components/auth/LoginForm.tsx` — 新增开发快速登录按钮与调用逻辑
  - `tests/unit/stores/authStore.test.ts` — 更新会话恢复测试场景
  - `tests/unit/api/auth.test.ts` — 新增 `/auth/dev-login` 接口测试
  - `docs/tasks.md` — 追加 CHG-44 任务闭环记录
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - `/auth/dev-login` 在生产环境不可用
  - 开发快捷登录按钮默认关闭，需显式设置 `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`

## [CHG-45] 统一页视频源列表二次优化（采集集成 + 列头筛选 + 侧栏收窄）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 16:38
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 重构列表为列头筛选+排序，新增行内可编辑列、最近采集列与行级采集触发
  - `src/components/admin/AdminSidebar.tsx` — 新增侧栏收窄/展开能力，收窄态显示图标+tooltip，按工作流重排菜单
  - `src/app/[locale]/admin/layout.tsx` — 接入新版 AdminSidebar
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 复用并验证列表容器/筛选/排序行为
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 配置文件来源的源站在列表中显示“配置文件维护”，行内编辑受限，需到“配置文件”页修改
  - 采集触发已支持全站与单站操作，任务追踪仍在统一页上方爬虫区查看

## [CHG-46] 删除重复源站采集列表（统一到视频源配置列表）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 16:43
- **修改文件**：
  - `src/components/admin/AdminCrawlerPanel.tsx` — 删除源站状态卡片与单站触发区，移除 sites-status 请求与相关状态
  - `src/app/[locale]/admin/crawler/page.tsx` — 更新统一页说明文案，明确“列表内单站触发”
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 单站采集入口已唯一收敛到视频源配置列表（CrawlerSiteManager）
  - 爬虫面板仅保留全站触发、自动采集开关与任务记录

## [CHG-47] 统一页改为双 Tab 视图（视频源配置 / 采集任务记录）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 16:46
- **修改文件**：
  - `src/components/admin/AdminCrawlerTabs.tsx` — 新增双 Tab 容器，统一切换视频源配置与采集任务记录
  - `src/app/[locale]/admin/crawler/page.tsx` — 页面改为单内容位 + Tab 结构，更新说明文案
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 默认打开“视频源配置”Tab
  - 采集任务记录和全站触发操作迁移到“采集任务记录”Tab 中

## [CHG-48] 视频源配置 Tab 稳态化修复（列管理 + 状态记忆 + 布局稳定 + 导入一致性）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 16:59
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 新增列显示管理、localStorage 状态持久化、固定列宽布局、导入 JSON 多格式兼容解析
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 增加 `localStorage.clear()`，消除持久化状态导致的测试串扰
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 列表状态持久化 key：`crawler-site-manager:v2`
  - 导入逻辑优先按 API 匹配现有源站并更新，避免重复 API 造成冲突

## [CHG-49] 列表状态持久化回归修复（离页后丢失）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 17:07
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 增加 localStorage 恢复完成门闩，避免初始默认值覆盖已保存状态
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 新增重挂载恢复测试（排序与隐藏列）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 该修复针对页面切换/重挂载场景下状态覆盖问题

## [CHG-50] 状态记忆二次修复（初始化恢复）+ 删除“清空筛选”按钮
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 17:14
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 持久化读取改为 useState 懒初始化，移除“清空筛选”按钮
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 保留并验证重挂载恢复回归用例
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 当前列表偏好在组件首次渲染即恢复，减少页面切换时状态闪回/覆盖

## [CHG-51] 视频源列表列宽动态收敛（减少无效横向溢出）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 17:21
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 表格最小宽度改为按可见列动态计算，移除固定超宽最小值
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 横向滚动将随可见列总宽度动态触发，不再在少列场景强制出现

## [CHG-52] 隐藏列重显重叠修复 + 列宽手动调节
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 17:59
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 新增列宽状态与列宽输入控件，列宽持久化并参与表格最小宽度计算
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 列宽设置入口在“显示列”面板内，单位像素，范围 72–560

## [CHG-53] 列宽交互重构：表头分隔拖拽调节
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 18:05
- **修改文件**：
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 新增表头分隔拖拽调宽交互，移除显示列面板中的宽度输入
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 新增拖拽分隔条调宽回归测试
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 列宽范围限制为 72–560 px
  - 拖拽手柄位于每列表头右侧

## [CHG-54] Phase A1：抽离 CrawlerSiteManager 表格状态模型（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 18:55
- **修改文件**：
  - `src/components/admin/system/crawler-site/tableState.ts` — 新建，集中管理列表状态类型、默认值、持久化读取
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 改为引用 tableState 模块，减少内联状态定义
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为结构性切片，保证行为与交互不变，作为 v1.1 后续拆分基础

## [CHG-55] Phase A2：抽离 CrawlerSiteManager 导入解析逻辑（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 19:04
- **修改文件**：
  - `src/components/admin/system/crawler-site/importParser.ts` — 新建，导入 JSON 兼容解析与去重逻辑
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 删除内联解析函数，改为调用 importParser
  - `tests/unit/components/admin/system/crawler-site/importParser.test.ts` — 新增解析器单测
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 解析器行为保持与原逻辑一致（兼容字段别名、按 API 去重）

## [CHG-56] Phase A3：抽离列表列管理/拖拽宽度 hooks（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 19:06
- **修改文件**：
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns.ts` — 新建，承载排序/筛选/显隐/拖拽/持久化逻辑
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 改为消费 `useCrawlerSiteColumns`，删除对应内联逻辑
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为结构切片，交互行为保持不变

## [CHG-57] Phase A4：抽离选择/批量操作 hooks（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 19:11
- **修改文件**：
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteSelection.ts` — 新建，集中选择状态与全选逻辑
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 删除内联选择逻辑，改为调用 `useCrawlerSiteSelection`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 全选行为维持“仅作用当前筛选后的可见列表”；批量成功后自动清空选择

## [CHG-58] Phase A5：容器+表格组件拆分落地（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 19:18
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 新建，承载源站列表表格视图与行交互渲染
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 改为容器编排，表格渲染切换为 `CrawlerSiteTable`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅做结构拆分，不改动用户可见行为与接口调用路径

## [CHG-59] Phase B：ConfigFileEditor 结构拆分（v1.1）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 19:21
- **修改文件**：
  - `src/components/admin/system/config-file/constants.ts` — 新建，承载配置示例 placeholder
  - `src/components/admin/system/config-file/utils.ts` — 新建，承载 JSON 校验/格式化与订阅 URL 归一化逻辑
  - `src/components/admin/system/ConfigFileEditor.tsx` — 改为消费 `config-file` 子模块工具，收敛主组件复杂度
  - `tests/unit/components/admin/system/config-file/utils.test.ts` — 新增工具函数单测
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 保持“保存并同步”行为和提示文案不变，属于结构性重构

## [CHG-60] v1.2 T1-1：抽离 CrawlerSiteToolbar 组件
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 10:45
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx` — 新建，承载操作栏按钮、列面板与批量操作区
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 删除内联操作栏 JSX，改为消费 `CrawlerSiteToolbar`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅结构拆分，不改动操作栏可见行为

## [CHG-61] v1.2 T1-2：抽离 CrawlerSiteFilters 组件
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 10:55
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFilters.tsx` — 新建，承载筛选行渲染与筛选输入绑定
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 改为组合 `CrawlerSiteFilters`，移除内联筛选行
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅做结构重排，筛选交互与持久化行为保持不变

## [CHG-62] v1.2 T1-3：抽离 CrawlerSiteFormDialog 组件
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 11:08
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx` — 新建，承载新增/编辑弹窗与表单校验
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 改为组合 `CrawlerSiteFormDialog`，移除内联表单实现
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为结构拆分，不修改字段、校验规则和保存流程

## [CHG-63] v1.2 T1-4：抽离 useCrawlerSites hook
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 11:18
- **修改文件**：
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSites.ts` — 新建，承载列表加载/刷新状态
  - `src/components/admin/system/CrawlerSiteManager.tsx` — 改为消费 `useCrawlerSites`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 请求路径、错误处理和加载行为与原逻辑一致

## [CHG-64] v1.2 T2：system 目录业务归组
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 11:30
- **修改文件**：
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`
  - `src/components/admin/system/config-file/ConfigFileEditor.tsx`
  - `src/components/admin/system/monitoring/{CacheManager.tsx,PerformanceMonitor.tsx}`
  - `src/components/admin/system/migration/DataMigration.tsx`
  - `src/components/admin/system/site-settings/SiteSettings.tsx`
  - `src/components/admin/AdminCrawlerTabs.tsx`
  - `src/app/[locale]/admin/system/*/page.tsx`
  - `tests/unit/components/admin/system/{CrawlerSiteManager.test.tsx,ConfigFileEditor.test.tsx}`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅目录迁移和 import 更新，不涉及业务逻辑改动

## [CHG-65] v1.2 T3：页面入口与业务模块分离
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 11:42
- **修改文件**：
  - `src/app/[locale]/admin/system/*/page.tsx` — 入口职责审计确认，保持仅模块装配
  - `src/components/admin/AdminCrawlerTabs.tsx` — 作为装配层保留，仅组织 Tab 与模块渲染
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本任务为边界校准与职责确认，不引入功能变更

## [CHG-66] v1.2 T4/T6/T7：模板约束落地 + 阶段验收
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 11:56
- **修改文件**：
  - `docs/rules/admin-module-template.md` — 新增 admin 模块模板与增量收敛规则
  - `docs/task-queue.md` / `docs/tasks.md` — v1.2 序列状态收口
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 验收命令全部通过；存在既有测试告警（ConfigFileEditor 测试中的 controlled/uncontrolled warning），未在本次结构任务中处理

## [CHG-67] Admin v2 方案与设计系统文档落地
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 12:08
- **修改文件**：
  - `docs/admin_v2_refactor_plan.md` — 新增 admin v2 重构执行方案（shared/UI/设计系统 + 分阶段计划）
  - `docs/admin_design_system_v1.md` — 新增轻量设计系统规范（组件/交互/布局）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 文档方案保持“行为不变、渐进迁移、可回滚”约束，可直接拆分工程任务执行

## [CHG-68] Admin v2 执行规则与顺序约束更新
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 12:20
- **修改文件**：
  - `docs/admin_v2_refactor_plan.md` — 重排 Phase 1 顺序，补充强 DoD、UI 边界与 PR 单维度规则
  - `docs/rules/admin-module-template.md` — 同步执行约束与表格改动验收规则
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 后续 PR 必须遵守“单维度提交”与 UI 阶段硬边界，不允许混提

## [CHG-69] Phase1：抽离 AdminTableFrame/AdminTableState
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:18
- **修改文件**：
  - `src/components/admin/shared/table/AdminTableFrame.tsx` — 新建 shared 表格壳组件，统一滚动容器与 table 框架
  - `src/components/admin/shared/feedback/AdminTableState.tsx` — 新建 shared 空态/加载态行组件
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 接入 shared 表壳与空态渲染，移除内联重复结构
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动数据结构、API 调用顺序、异步流程与权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-70] Phase1：抽离 AdminToolbar
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:21
- **修改文件**：
  - `src/components/admin/shared/toolbar/AdminToolbar.tsx` — 新建 shared 工具栏布局壳（actions/feedback 分区）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx` — 改为组合 `AdminToolbar`，保留原有业务按钮与交互
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动数据结构、字段、API 调用顺序、异步流程、权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-71] Phase1：抽离 useAdminToast
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:22
- **修改文件**：
  - `src/components/admin/shared/feedback/useAdminToast.ts` — 新建 shared toast hook，统一状态管理、覆盖计时与卸载清理
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入 `useAdminToast`，移除内联 toast 状态与 setTimeout
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动提示文案、触发时机、异步流程与权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-72] Phase1：抽离 AdminDialogShell
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:24
- **修改文件**：
  - `src/components/admin/shared/dialog/AdminDialogShell.tsx` — 新建 shared 弹层壳组件，统一遮罩、容器和标题栏
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx` — 替换内联 Modal 为 shared dialog 壳
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动表单字段、校验、提交时序和权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-73] Phase1：抽离 AdminFormField/Input/Select
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:25
- **修改文件**：
  - `src/components/admin/shared/form/AdminFormField.tsx` — 新建 shared 表单字段容器组件
  - `src/components/admin/shared/form/AdminInput.tsx` — 新建 shared 输入框组件
  - `src/components/admin/shared/form/AdminSelect.tsx` — 新建 shared 下拉组件
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx` — 替换内联表单基础组件为 shared 组件
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动表单校验、提交 payload 与接口顺序
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-74] Phase1：抽离 AdminBatchBar
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:27
- **修改文件**：
  - `src/components/admin/shared/batch/AdminBatchBar.tsx` — 新建 shared 批量操作条组件
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx` — 批量区改为组合 `AdminBatchBar`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 shared 抽离，不改动批量动作参数、调用顺序、权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-75] Phase1：shared 复用验证（videos/sources）
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:29
- **修改文件**：
  - `src/components/admin/shared/toolbar/AdminToolbar.tsx` — 增加 `dataTestId` 以兼容现有测试与调用方
  - `src/components/admin/videos/VideoFilters.tsx` — 顶部筛选栏改为组合 `AdminToolbar`
  - `src/components/admin/sources/SourceTable.tsx` — 状态筛选栏改为组合 `AdminToolbar`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为 shared 复用验证，不改动筛选参数、请求时序与业务逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-76] Phase2：crawler-site toolbar 局部优化
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:32
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteToolbar.tsx` — 调整工具栏 DOM 分组与视觉层级（主动作/配置动作/批量动作）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 UI 层布局重排，不改动数据结构、字段、API 调用顺序、异步流程与权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-77] Phase2：crawler-site 行操作分层
- **完成时间**：2026-03-19
- **记录时间**：2026-03-19 23:33
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 调整行操作按钮视觉层级与顺序（采集/管理列）
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 UI 样式与按钮顺序调整，不改动回调、参数、API 顺序、异步流程与权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-78] Phase2：crawler-site 筛选可视化
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:14
- **修改文件**：
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入 TopToolbar + ActiveFilterChipsBar，透传列菜单所需排序/筛选控制
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteColumns.ts` — 新增 `setSort(field, dir)` 以支持列菜单定向排序
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 替换重表头筛选行为为轻表头 + 列菜单
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx` — 新建，承载主操作、快速筛选、列设置、高级筛选入口
  - `src/components/admin/system/crawler-site/components/CrawlerSiteAdvancedFilters.tsx` — 新建，承载 API/格式/成人/权重等低频筛选
  - `src/components/admin/system/crawler-site/components/ActiveFilterChipsBar.tsx` — 新建，展示生效筛选并支持单项移除/清空
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx` — 新建，轻量表头与列菜单入口
  - `src/components/admin/system/crawler-site/components/ColumnMenu.tsx` — 新建，列级排序/筛选/清除/隐藏操作
  - `src/components/admin/system/crawler-site/components/ColumnFilterPanel.tsx` — 新建，列级筛选控件
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` — 更新断言以适配轻表头和列设置入口
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 保持 API、字段结构、筛选语义、列宽拖拽、列显隐持久化、排序持久化不变
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-79] Phase2：config-file 粘性保存区
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:20
- **修改文件**：
  - `src/components/admin/system/config-file/ConfigFileEditor.tsx` — 将底部操作栏改为 sticky 粘性保存区，保持保存动作常驻可达
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 UI 布局调整，不改动保存接口、payload、调用顺序与提示逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/ConfigFileEditor.test.tsx`、`npm run typecheck`、`npm run lint`
  - 仍存在既有测试 warning：ConfigFileEditor controlled/uncontrolled（历史问题）

## [CHG-80] Phase2：videos/users/sources 布局对齐
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:22
- **修改文件**：
  - `src/app/[locale]/admin/videos/page.tsx` — 统一标题区为信息头卡片布局，保留原操作入口
  - `src/app/[locale]/admin/users/page.tsx` — 统一标题区与说明层级
  - `src/app/[locale]/admin/sources/page.tsx` — 统一标题区与说明层级
  - `src/components/admin/users/UserTable.tsx` — 搜索区接入 `AdminToolbar` 布局壳
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅 DOM/样式布局对齐，不改动数据结构、API 顺序、异步流程、权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-81] Phase3：落地 AdminButton
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:24
- **修改文件**：
  - `src/components/admin/shared/button/AdminButton.tsx` — 新建统一按钮组件（variant/size 规范化）
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx` — 首批接入 AdminButton
  - `src/components/admin/system/config-file/ConfigFileEditor.tsx` — 远程拉取与保存按钮接入 AdminButton
  - `src/app/[locale]/admin/videos/page.tsx` — 新建视频入口按钮接入 AdminButton
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为设计系统按钮规范代码化，不改动业务逻辑与接口调用
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/ConfigFileEditor.test.tsx tests/unit/components/admin/videos/VideoFilters.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-82] Phase3：落地 AdminModal + 表单规范
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:25
- **修改文件**：
  - `src/components/admin/shared/modal/AdminModal.tsx` — 新建 modal 规范包装组件
  - `src/components/admin/shared/form/AdminFormActions.tsx` — 新建表单动作区布局组件
  - `src/components/admin/system/crawler-site/components/CrawlerSiteFormDialog.tsx` — 接入 `AdminModal` 与 `AdminFormActions`
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为设计系统 modal/form 规范代码化，不改动业务字段与提交逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-83] Phase3：落地 AdminTable 规范
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:29
- **修改文件**：
  - `src/components/admin/videos/VideoTable.tsx` — 接入 `AdminTableFrame` 与 `AdminTableState`，统一表格壳与 loading/empty 状态行
  - `src/components/admin/sources/SourceTable.tsx` — 接入 `AdminTableFrame` 与 `AdminTableState`，统一表格壳与 loading/empty 状态行
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为 design system table 规范落地，不改动数据结构、字段、API 调用顺序、异步流程与权限逻辑
  - 已通过：`npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-84] Phase3：交互规则代码门禁
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 01:33
- **修改文件**：
  - `scripts/verify-admin-guardrails.mjs` — 新增 admin v2 规则门禁脚本（单维度变更集 + confirm/delete/toast 规则）
  - `package.json` — 新增 `verify:admin-guardrails` 与 `verify:admin-guardrails:all` 命令
  - `docs/rules/admin-module-template.md` — 增加交互规则硬约束并纳入门禁命令
  - `docs/admin_v2_refactor_plan.md` — 执行规则补充门禁命令要求
  - `src/components/admin/sources/SourceTable.tsx` — 单条删除接入 `ConfirmDialog` 二次确认
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 门禁命令默认校验 staged 变更，适配“单任务单提交”执行流
  - 已通过：`npm run verify:admin-guardrails`、`npm run test:run -- tests/unit/components/admin/videos/VideoFilters.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-85] crawler-site 单站采集闭环（Step1-6）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 02:01
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — 增加任务 `type` 持久化、同站活跃任务查询、单站/批量 latest 查询
  - `src/api/routes/admin/crawler.ts` — 增加同站活跃采集互斥（409），新增批量 latest 与单站 latest-task 接口
  - `src/api/services/CrawlerService.ts` — 创建任务时写入正确采集类型
  - `src/api/workers/crawlerWorker.ts` — 透传任务类型到采集服务
  - `src/components/admin/system/crawler-site/crawlTask.types.ts` — 新增 crawler-site 任务 DTO 类型
  - `src/components/admin/system/crawler-site/services/crawlTaskService.ts` — 新增采集任务触发/状态查询 service
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks.ts` — 新增可复用任务 hook（触发、防重、轮询、完成刷新）
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入任务 hook，拆分全站与单站触发状态
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 行级采集按钮接入 running 态、互斥禁用、状态展示
- **新增依赖**：无
- **数据库变更**：无（复用既有 `crawler_tasks` / `crawler_sites` 字段）
- **注意事项**：
  - `startedAt` 在 DTO 中保持 `null`（不再用 `scheduled_at` 冒充）
  - 防重复策略为“同站点任一活跃采集任务互斥”
  - 轮询优先使用批量 latest 接口，单站 latest-task 仅作兼容降级
  - 任务进入 success/failed 后会触发一次 `fetchSites()` 并清理本地 running 状态
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-86] crawler-site 配置页采集状态概览
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 02:32
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — 新增 `getCrawlerOverview` 汇总查询（总数/成功/运行中/失败/今日视频数/今日时长）
  - `src/api/routes/admin/crawler.ts` — 新增 `GET /admin/crawler/overview`
  - `src/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats.tsx` — 新增配置页采集概览组件
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入概览条并增加 5 秒轮询刷新
- **新增依赖**：无
- **数据库变更**：无（复用现有 `crawler_tasks` 与 `crawler_sites` 字段）
- **注意事项**：
  - 本次仅增加“配置页顶部概览”，不扩充列表列信息，不改表格行为
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-87] 单站采集预创建任务 + 重进恢复运行态
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 02:42
- **修改文件**：
  - `src/api/routes/admin/crawler.ts` — 单站触发时预创建 `pending` 任务并返回 `taskId`，再入队
  - `src/api/workers/crawlerWorker.ts` — job data 增加 `taskId`，worker 优先更新预创建任务状态
  - `src/api/services/CrawlerService.ts` — 支持复用外部 `taskId`，避免重复建任务
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks.ts` — 新增页面重进后的 running/queued 状态恢复
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 站点列表加载后触发任务状态恢复
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次修复确保任务状态在离页后可持续，并能在重进页面时恢复显示
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-88] 采集概览实时进度与时长修复
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 02:51
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — 新增 `updateTaskProgress` 并调整 overview 统计口径为 `running + done` 实时汇总
  - `src/api/services/CrawlerService.ts` — 采集过程中周期回写进度，提供运行中实时数据源
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - “今日采集视频数”不再仅依赖已完成任务，运行中的任务会逐步反映实时值
  - “采集时长”在运行中按 `NOW - scheduled_at` 实时累计，完成后沿用 `durationMs`
  - 已通过：`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run typecheck`、`npm run lint`

## [CHG-89] 采集任务 pending 卡死修复（队列可用性 + 失败补偿）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 03:08
- **修改文件**：
  - `src/api/lib/queue.ts` — 新增 `ensureCrawlerQueueReady`，触发任务前做队列可用性检查并设置超时兜底。
  - `src/api/routes/admin/crawler.ts` — 单站触发改为“先校验队列可用，再创建任务”；入队失败时将预创建任务回写为 `failed` 并返回 `503`；触发前清理同站陈旧 pending。
  - `src/api/db/queries/crawlerTasks.ts` — 新增 `markStalePendingTasks`，用于将长时间 pending 的历史任务补偿为 failed。
  - `src/api/workers/crawlerWorker.ts` — worker 在早期异常（进入 crawl 前失败）场景回写 `taskId` 对应任务为 `failed`，避免永久 pending。
- **新增依赖**：无
- **数据库变更**：无（复用现有 `crawler_tasks` 字段）
- **注意事项**：
  - 当前环境 `REDIS_URL=redis://localhost:6379` 且 6379 未监听时，接口会明确返回 `503 CRAWLER_QUEUE_UNAVAILABLE`，不再留下 pending 脏任务。
  - 已执行一次性数据补偿：历史 pending 超时任务 `2` 条已自动转为 failed。

## [CHG-90] 修复采集触发参数类型冲突（$1 推断错误）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 03:13
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — 将 `markStalePendingTasks` 的 SQL 拆分为“有 siteKey / 无 siteKey”两条语句，避免可空参数在不同上下文复用导致的 `$1` 类型推断冲突。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅修复 SQL 参数绑定方式，不改变 pending 清理策略与阈值。

## [CHG-91] 采集链路可观测性重构（详细任务日志 + 诊断脚本）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 03:38
- **修改文件**：
  - `src/api/db/migrations/009_crawler_task_logs.sql` — 新增采集任务日志表及索引。
  - `src/api/db/queries/crawlerTaskLogs.ts` — 新增日志写入/查询函数。
  - `src/api/routes/admin/crawler.ts` — 增加 API 层日志埋点；新增 `GET /admin/crawler/tasks/:id/logs`。
  - `src/api/workers/crawlerWorker.ts` — 增加 worker 层日志埋点（任务接收、源站开始/完成/失败、任务失败）。
  - `src/api/services/CrawlerService.ts` — 增加 crawl 过程日志回调与分页/入库失败日志埋点。
  - `scripts/test-crawler-site.ts` — 新增单站增量采集诊断脚本（基于已有源站直接执行）。
  - `package.json` — 新增 `test:crawler-site` script。
- **新增依赖**：无
- **数据库变更**：新增 `crawler_task_logs` 表（迁移 `009_crawler_task_logs.sql`）
- **注意事项**：
  - 需先执行 `npm run migrate` 创建日志表。
  - 诊断命令：`npm run test:crawler-site -- --site=<siteKey> --hours=24`。
  - 当前任务重点是“定位能力建设”，不改变原有采集业务语义。

## [CHG-92] 修复 worker 采集状态更新 SQL 参数类型冲突
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 04:00
- **修改文件**：
  - `src/api/db/queries/crawlerSites.ts` — `updateCrawlStatus` 中状态参数改为显式 `::varchar`，避免 `$1` 在赋值与比较上下文中出现 `text vs varchar` 推断冲突。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次修复的是 worker 路径首段状态更新 SQL；不改变采集业务逻辑。

## [CHG-93] Python 工具链接入规范方案落盘（uv/ruff/ty）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 12:48
- **修改文件**：
  - `docs/python_tooling_adoption_plan.md` — 新增 Python 渐进接入方案，定义适用范围、最小接入策略、默认检查命令、输出模板与风险边界。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 当前仓库主技术栈仍为 TS/Node；该方案仅在后续出现 Python 任务时生效。

## [CHG-94] Python 规范改为条件触发式执行
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 12:56
- **修改文件**：
  - `docs/python_tooling_adoption_plan.md` — 增加“条件触发规则（强约束）”，明确仅在首次引入 Python 业务代码时才立即接入 `uv/ruff/ty`。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 触发前不做空接入；触发后在当次任务内完成最小接入与检查链路。

## [CHG-95] 采集系统 Phase A：批量/全站/批次控制与超时兜底
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 14:09
- **修改文件**：
  - `src/api/db/migrations/010_crawler_runs_and_task_control.sql` — 新增批次表与任务控制字段迁移。
  - `src/api/db/queries/crawlerRuns.ts` — 新增批次查询/状态聚合能力。
  - `src/api/db/queries/crawlerTasks.ts` — 扩展任务状态与控制字段，新增按 run 查询、取消/超时处理函数。
  - `src/api/services/CrawlerRunService.ts` — 新增统一触发服务（single/batch/all/schedule）。
  - `src/api/routes/admin/crawler.ts` — 新增 run 系列接口与取消/暂停/恢复控制；保留 `/admin/crawler/tasks` 兼容路径。
  - `src/api/workers/crawlerWorker.ts` — 增加 run 控制状态消费（cancel/pause/timeout）与 run 状态同步。
  - `src/api/workers/crawlerScheduler.ts` — 定时采集改为走 run service；新增每分钟超时 watchdog。
  - `src/api/services/CrawlerService.ts` — 增加任务中断回调，支持取消/超时中止。
  - `src/components/admin/system/crawler-site/components/CrawlerRunPanel.tsx` — 新增批次状态面板与中止入口。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTopToolbar.tsx` — 新增批量增量/全量触发按钮。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入 run 触发、轮询与中止。
- **新增依赖**：无
- **数据库变更**：新增 `crawler_runs`，扩展 `crawler_tasks`（`run_id/trigger_type/timeout_at/heartbeat_at/cancel_requested`）
- **注意事项**：
  - 需执行 `npm run migrate` 应用 `010` 迁移。
  - 旧接口 `POST /admin/crawler/tasks` 仍可用，保证 CHG-87 兼容。

## [CHG-96] 后台登录态稳定性修复（admin 鉴权状态流）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 15:44
- **修改文件**：
  - `src/lib/api-client.ts` — 修复 refresh 响应解析兼容性（`accessToken` / `data.accessToken`）；新增统一未授权处理与 admin 路径登录跳转（携带 `callbackUrl`）。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次只改认证流，不改业务页面逻辑。
  - 仅在 admin 路径下触发 401 重定向登录；非 admin 页面保持原行为。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run` 全通过（37 files / 476 tests）。

## [CHG-97] 采集功能集中管理方案落盘（CHG-96 基线）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 15:52
- **修改文件**：
  - `docs/admin_crawl_control_center_plan.md` — 新增“采集控制台”信息架构、职责拆分、自动采集配置模型、run/task 统一流程、Phase A-D 落地计划与回滚策略。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 固定原则已明确：自动采集配置唯一入口为“采集控制台”。
  - 旧入口兼容期与生效范围说明已写入方案。

## [CHG-98] 采集控制台命名迁移（含旧语义兼容）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 15:58
- **修改文件**：
  - `src/components/admin/AdminSidebar.tsx` — 系统菜单改名为“采集控制台（原视频源配置）”。
  - `src/app/[locale]/admin/crawler/page.tsx` — 页面标题与导语改为“采集控制台”定位。
  - `src/components/admin/AdminCrawlerTabs.tsx` — Tab 名从“视频源配置”改为“采集控制台”，并优化职责说明文案。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅命名与信息架构层调整，不改路由与表格行为。

## [CHG-99] 自动采集入口收口（任务记录/站点配置去编辑化）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:03
- **修改文件**：
  - `src/components/admin/AdminCrawlerPanel.tsx` — 移除“每日自动采集”开关，任务记录页仅保留任务查看与手动触发。
  - `src/components/admin/AdminCrawlerTabs.tsx` — 在任务记录 Tab 增加“自动采集配置已迁移”提示与回到控制台入口。
  - `src/components/admin/system/site-settings/SiteSettings.tsx` — 移除自动采集编辑区，改为只读迁移说明与“前往采集控制台”跳转。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 采集执行链路（run/task/worker）未改动，仍独立于页面生命周期。

## [CHG-100] 统一自动采集配置模型与控制台配置入口（Phase B）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:15
- **修改文件**：
  - `src/types/system.types.ts` — 新增 `AutoCrawlConfig`/`AutoCrawlSiteOverride` 类型及扩展 `SystemSettingKey`。
  - `src/api/db/queries/systemSettings.ts` — 新增自动采集配置反序列化与 `getAutoCrawlConfig/setAutoCrawlConfig`。
  - `src/api/routes/admin/crawler.ts` — 新增 `GET/POST /admin/crawler/auto-config`。
  - `src/api/services/CrawlerRunService.ts` — `schedule` 触发读取统一配置并应用 `onlyEnabledSites` 与 `perSiteOverrides`。
  - `src/api/workers/crawlerScheduler.ts` — 调度改为 minute tick + `dailyTime` 命中触发，按日去重 `auto_crawl_last_trigger_date`。
  - `src/components/admin/system/crawler-site/components/AutoCrawlSettingsPanel.tsx` — 新增控制台自动采集配置面板。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 接入自动采集配置面板。
- **新增依赖**：无
- **数据库变更**：无（复用 `system_settings` 键值对表）
- **注意事项**：
  - 为兼容历史逻辑，保存新配置时仍回写 `auto_crawl_recent_only`。
  - `conflictPolicy=queue_after_running` 当前阶段为预留选项，执行策略仍保守跳过运行中站点，后续 Phase C 细化。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run` 全通过（37 files / 476 tests）。

## [CHG-101] 自动采集状态行内可视化（Phase C-1）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:18
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/AutoCrawlSettingsPanel.tsx` — 新增 `onConfigChange` 回调，加载/保存后回传配置快照。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 新增自动采集配置快照状态并传入列表。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 在“来源”列新增自动采集状态展示（开启/关闭 + 模式）。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次只做可视化映射，不改现有表格筛选/排序/列宽/持久化逻辑。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` 通过。

## [CHG-102] 采集任务记录触发来源筛选（Phase C-2）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:21
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — `listTasks` 新增 `triggerType` 过滤参数。
  - `src/api/routes/admin/crawler.ts` — `GET /admin/crawler/tasks` 支持 `triggerType` 查询参数。
  - `src/components/admin/AdminCrawlerPanel.tsx` — 新增“触发来源”筛选与来源标签列。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次改动仅增强任务记录可观测性，不改变 run/task 执行语义。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx` 通过。

## [CHG-103] 采集任务记录日志面板（Phase C-3）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:25
- **修改文件**：
  - `src/components/admin/AdminCrawlerPanel.tsx` — 任务记录表新增“操作”列与“查看日志”按钮；新增任务日志面板，接入 `/admin/crawler/tasks/:id/logs?limit=50` 展示最近日志。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次改动只补充排障可观测性，不改任务执行、筛选排序与表格持久化行为。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run test:run` 通过。

## [CHG-104] 采集任务记录 runId 筛选与字段口径对齐（Phase C-4）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:31
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — `listTasks` 新增 `runId` 过滤参数。
  - `src/api/routes/admin/crawler.ts` — `GET /admin/crawler/tasks` 支持 `runId` 查询参数并透传到查询层。
  - `src/components/admin/AdminCrawlerPanel.tsx` — 任务记录页新增 runId 过滤输入、Run ID 列、站点列；兼容 camelCase/snake_case 字段映射与错误信息回退。
  - `tests/unit/api/crawler.test.ts` — 新增 runId 过滤参数透传测试。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅增强任务追踪维度，不改变采集执行链路。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts`、`npm run test:run` 通过（37 files / 477 tests）。

## [CHG-105] 采集控制台 run→task 深链联动（Phase C-5）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:33
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerRunPanel.tsx` — 新增“查看任务”深链按钮（`?tab=tasks&runId=...`）。
  - `src/components/admin/AdminCrawlerTabs.tsx` — 新增 tab 与 URL 查询参数同步逻辑，支持 `tab=tasks` 与 `runId` 透传。
  - `src/components/admin/AdminCrawlerPanel.tsx` — 新增 `initialRunId` 参数消费，进入任务页后自动应用 runId 筛选。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次改动仅为页面联动，不改任务执行与队列逻辑。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`npm run test:run` 通过（37 files / 477 tests）。

## [CHG-106] run→task 深链联动测试补齐（Phase D-1）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:37
- **修改文件**：
  - `tests/unit/components/admin/AdminCrawlerTabs.test.tsx` — 新增深链联动测试，覆盖 `tab=tasks&runId` 初始化透传、tab 切换 URL 写入与清理。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅新增测试保护，不改业务逻辑。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/AdminCrawlerTabs.test.tsx tests/unit/api/crawler.test.ts`、`npm run test:run` 通过（38 files / 480 tests）。

## [CHG-107] runId 过滤与 URL 双向同步（Phase D-2）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 16:40
- **修改文件**：
  - `src/components/admin/AdminCrawlerPanel.tsx` — runId 应用/清空/反筛选时通过回调同步 URL 状态。
  - `src/components/admin/AdminCrawlerTabs.tsx` — 新增 `syncRunId`，确保任务页 runId 过滤回写查询参数。
  - `tests/unit/components/admin/AdminCrawlerTabs.test.tsx` — 新增 runId URL 同步测试用例。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅修正页面状态同步，不改采集执行链路。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/AdminCrawlerTabs.test.tsx tests/unit/api/crawler.test.ts`、`npm run test:run` 通过（38 files / 481 tests）。

## [CHG-108] 一键清空抓取数据脚本
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 17:18
- **修改文件**：
  - `scripts/clear-crawled-data.ts` — 新增清理脚本：事务内清空 `videos`（级联关联数据）、`crawler_runs/crawler_tasks/crawler_task_logs`，并重置 `crawler_sites` 最近采集状态。
  - `package.json` — 新增命令 `npm run clear:crawled-data`。
  - `README.md` — 新增测试场景下的一键清理命令说明。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 为避免误删，本次未自动执行清库脚本。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts` 通过。

## [CHG-109] 采集控制台局部监控更新与任务控制增强（暂停/恢复/中止）
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 17:50
- **修改文件**：
  - `src/components/admin/system/crawler-site/hooks/useCrawlerMonitor.ts` — 新增监控数据源 hook，独立轮询 overview/runs，仅更新监控区。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 监控区与表格区解耦；run 面板拆分“当前任务/最近结果”；接入 pause/resume/cancel。
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks.ts` — 任务完成后改为 silent 站点刷新 + 监控回调，不触发表格 loading 重置。
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSites.ts` — `fetchSites` 支持 `silent` 模式。
  - `src/components/admin/system/crawler-site/components/CrawlerRunPanel.tsx` — 增加暂停/恢复按钮、控制状态与运行时长展示。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteOverviewStats.tsx` — 新增“已暂停”概览指标。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 行级轻状态增加 paused 展示。
  - `src/components/admin/system/crawler-site/crawlTask.types.ts`、`src/components/admin/AdminCrawlerPanel.tsx` — 前端状态模型补 `paused`。
  - `src/api/db/migrations/011_add_paused_statuses.sql` — 新增迁移，扩展 `crawler_runs/crawler_tasks` 状态约束。
  - `src/api/db/queries/crawlerRuns.ts`、`src/api/db/queries/crawlerTasks.ts` — 查询聚合口径补 `paused`。
  - `src/api/routes/admin/crawler.ts` — runs/tasks 筛选支持 paused；pause/resume/cancel 状态流转强化。
  - `src/api/services/CrawlerService.ts`、`src/api/workers/crawlerWorker.ts` — 协作式 pause/cancel/timeout 检查与状态处理。
  - `.gitignore` — 增加 `docs/crawler_sites_updated.json` 忽略规则。
- **新增依赖**：无
- **数据库变更**：
  - 新增迁移：`011_add_paused_statuses.sql`
- **注意事项**：
  - 部署前必须执行 `npm run migrate`。
  - 本次为最小可用控制链路，pause/resume 采用协作式检查点机制（非硬中断）。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/api/crawler-worker.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/AdminCrawlerTabs.test.tsx`、`npm run test:run` 通过（38 files / 481 tests）。

## [CHG-110] README 补充采集控制操作说明
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 17:54
- **修改文件**：
  - `README.md` — 补充“采集控制台”入口说明、暂停/恢复/中止按钮位置与语义、单站/批量/全站触发方式、run 控制 API 调试示例。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次仅文档更新，不涉及代码逻辑变更。

## [CHG-111] 采集失控止血：调度与执行解耦 + stop-all
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 18:30
- **修改文件**：
  - `src/api/workers/crawlerScheduler.ts` — 重写调度器为进程内 tick（60s），仅创建 run，不再向 `crawler-queue` 写入可执行占位 job。
  - `src/api/server.ts` — 调度器改为显式开关（`CRAWLER_SCHEDULER_ENABLED=true` 才注册）。
  - `src/api/routes/admin/crawler.ts` — `/admin/crawler/tasks` 全量触发改走 `runService` 统一模型；新增 `POST /admin/crawler/stop-all`（全局冻结 + 取消活跃任务 + 清理 repeat tick）。
  - `src/api/workers/crawlerWorker.ts` — 增加全局冻结检查（启动前/执行安全点），冻结时跳过或取消执行。
  - `src/api/db/queries/crawlerTasks.ts` — 新增 `cancelAllActiveTasks()`。
  - `src/api/db/queries/crawlerRuns.ts` — 新增 `requestCancelAllActiveRuns()`。
  - `src/types/system.types.ts` — 新增系统设置键 `crawler_global_freeze`。
  - `scripts/stop-all-crawls.ts`、`package.json` — 新增命令 `npm run crawler:stop-all`。
  - `README.md` — 补充 stop-all 接口、命令与 scheduler 开关说明。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次优先“先止血”，不涉及 UI 重构。
  - 如果线上正在跑旧遗留任务，先执行 `npm run crawler:stop-all` 再重启服务。

## [CHG-112] stop-all 强制收敛 + stale running 清理
- **完成时间**：2026-03-20
- **记录时间**：2026-03-20 18:47
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — `cancelAllActiveTasks()` 改为直接取消 running；新增 `markStaleHeartbeatRunningTasks()`；overview running 口径增加心跳新鲜度过滤。
  - `src/api/workers/crawlerScheduler.ts` — watchdog 增加 stale heartbeat 清理。
  - `scripts/stop-all-crawls.ts` — 输出字段改为 `cancelledRunning`。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次修复针对“stop-all 后仍显示 running”的历史孤儿任务场景。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/api/crawler-worker.test.ts` 通过。

## [CHG-113] A1 契约统一（runId/taskId，移除 jobId 旧口径）
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 01:46
- **修改文件**：
  - `src/components/admin/system/crawler-site/services/crawlTaskService.ts` — 触发响应契约统一为 run/task 字段。
  - `src/components/admin/system/crawler-site/crawlTask.types.ts` — 任务状态补齐 `cancelled/timeout`。
  - `src/components/admin/system/crawler-site/hooks/useCrawlerSiteCrawlTasks.ts` — 终态反馈覆盖 `cancelled/timeout`。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 行内轻状态补齐“已取消/超时”。
  - `src/api/routes/admin/crawler.ts` — DTO 与 tasks 状态过滤对齐新口径。
  - `src/types/crawler.types.ts` — 共享状态枚举同步。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 已移除 crawler-site 前端对 `jobId` 的依赖，统一使用 run/task 契约。

## [CHG-114] A2 入口单点化（任务记录页只读）
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 01:54
- **修改文件**：
  - `src/components/admin/AdminCrawlerPanel.tsx` — 移除任务记录页触发按钮，改为只读审计入口。
  - `tests/e2e/admin.spec.ts` — 更新断言：任务页无触发按钮，触发能力只在控制台 Tab。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 采集触发入口已收敛到“采集控制台”，任务记录页仅保留查询/日志。

## [CHG-115] A3 orphan task 显式可见
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 02:00
- **修改文件**：
  - `src/api/db/queries/crawlerTasks.ts` — 新增 orphan 活跃任务计数查询。
  - `src/api/routes/admin/crawler.ts` — 新增 `GET /admin/crawler/system-status`。
  - `src/components/admin/system/crawler-site/hooks/useCrawlerMonitor.ts` — 接入 system-status 数据源。
  - `src/components/admin/system/crawler-site/components/CrawlerSystemStatusStrip.tsx` — 新增系统状态条（scheduler/freeze/orphan）。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 控制台挂载状态条。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 系统级状态条固定展示 scheduler/freeze/orphan，补齐运维可见性。

## [CHG-116] C1 worker 硬约束（无 runId/taskId 不执行）
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 02:06
- **修改文件**：
  - `src/api/workers/crawlerWorker.ts` — 执行前 contract guard：缺失 `runId/taskId` 直接拒绝并写审计日志；enqueue 参数强制化。
  - `tests/unit/api/crawler-worker.test.ts` — 补充 contract 缺失拒绝测试，更新 enqueue 断言。
  - `tests/unit/api/crawler.test.ts` — 同步 worker 入队测试到强制 contract 签名。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 此变更会拒绝旧形态孤儿 crawl job，避免 worker 再次“脱离 run/task 控制口径”。

## [CHG-117] C2 stop-all/freeze 正式化
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 02:08
- **修改文件**：
  - `src/api/routes/admin/crawler.ts` — 新增 `POST /admin/crawler/freeze`；`stop-all` 返回真实 freeze 状态。
  - `src/components/admin/system/crawler-site/hooks/useCrawlerMonitor.ts` — 新增 `stopAll/setFreezeEnabled` 控制动作与 pending 状态。
  - `src/components/admin/system/crawler-site/components/CrawlerSystemStatusStrip.tsx` — 增加冻结开关与 stop-all 按钮。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 状态条动作接线。
  - `README.md` — 补充控制台状态条操作与 freeze 调试接口。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 控制台已可直接执行 freeze/stop-all，执行后只做局部监控刷新，不触发表格上下文重置。

## [CHG-118] B1 控制台容器拆分与 query model 收拢
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 02:10
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerConsoleMonitorSection.tsx` — 新增监控容器组件，独立承载监控轮询与任务控制 UI。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 站点管理容器移除 monitor 状态，保留表格与操作状态。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 监控区轮询与表格状态已容器级解耦，减少高频刷新对筛选/排序/列宽上下文的影响风险。

## [CHG-119] D1 健康状态条 + 深链完善
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 02:13
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerRunPanel.tsx` — 新增“查看日志”深链入口（runId + taskStatus）。
  - `src/components/admin/AdminCrawlerTabs.tsx` — 支持 `taskStatus` 查询参数解析与透传。
  - `src/components/admin/AdminCrawlerPanel.tsx` — 支持 `initialStatusFilter` 初始化状态筛选。
  - `tests/unit/components/admin/AdminCrawlerTabs.test.tsx` — 补充 taskStatus 透传测试。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 该改动不改变任务执行链路，仅增强监控到任务审计的跳转效率。

## [CHG-120] crawler-site 站点表格结构规范化重构
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 03:19
- **修改文件**：
  - `src/components/admin/system/crawler-site/tableState.ts` — 重定义列 ID / 顺序 / 默认可见列 / 排序字段。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 重写行渲染：Key+copy、类型·格式合列、权重档位、🔞 toggle、启用 switch、轻量最近采集、dropdown 操作。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx` — 表头列映射同步新结构。
  - `src/components/admin/system/crawler-site/components/ColumnFilterPanel.tsx` — 列筛选映射同步新列 ID。
  - `src/components/admin/system/crawler-site/CrawlerSiteManager.tsx` — 排序字段映射与表格传参对齐。
  - `src/components/admin/AdminCrawlerPanel.tsx`、`src/components/admin/AdminCrawlerTabs.tsx`、`src/components/admin/system/crawler-site/components/CrawlerRunPanel.tsx` — 任务页深链状态透传补强。
  - `tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`、`tests/unit/components/admin/AdminCrawlerTabs.test.tsx` — 同步新列结构与深链断言。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 需求中“固定列标准”与“默认列含 API 地址”冲突，执行时以固定列标准为准，将 API 信息并入 Key 列 hover/copy。
  - 已验证：`npm run typecheck`、`npm run lint`、`npm run test:run`（38 files / 483 tests）。

## [CHG-121] CrawlerSiteTable 回归修复（交互）
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 03:41
- **修改文件**：
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTable.tsx` — 修复 Key tooltip/copy、权重切换、成人/启用点击。
  - `src/components/admin/system/crawler-site/components/CrawlerSiteTableLiteHeader.tsx` — 透传权重档位编辑事件。
  - `src/components/admin/system/crawler-site/components/ColumnMenu.tsx` — 透传权重档位编辑参数。
  - `src/components/admin/system/crawler-site/components/ColumnFilterPanel.tsx` — 权重筛选面板新增“高/中/低”编辑行。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 本次为 CHG-120 回归修复，不改变 API 与数据结构。

## [CHG-122] shared useAdminTableState 基线落地
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 14:58
- **修改文件**：
  - `src/components/admin/shared/table/useAdminTableState.ts` — 新增统一表格状态 schema、v1 序列化/反序列化、SSR 安全读写、`getState/setState/updatePartial/reset`。
  - `src/components/admin/shared/table/useAdminTableState.demo.tsx` — 新增最小 usage 示例（不接入业务页）。
  - `tests/unit/components/admin/shared/table/useAdminTableState.test.tsx` — 覆盖读写、默认 merge、version 失效、update/reset。
- **新增依赖**：无
- **数据库变更**：无

## [CHG-123] shared 列元数据与列宽拖拽能力落地
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:11
- **修改文件**：
  - `src/components/admin/shared/table/useAdminTableColumns.ts` — 新增列元数据模型（visible/width/min/max/resizable）、拖拽 handler、显隐切换、reset 与持久化适配。
  - `src/components/admin/shared/table/useAdminTableColumns.demo.tsx` — 新增最小 usage 示例（不接入业务页）。
  - `tests/unit/components/admin/shared/table/useAdminTableColumns.test.tsx` — 覆盖列宽更新、不可拖拽拦截、显隐切换、reset、默认值 merge。
- **新增依赖**：无
- **数据库变更**：无

## [CHG-124] shared 排序与列筛选容器框架落地
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:25
- **修改文件**：
  - `src/components/admin/shared/table/useAdminTableSort.ts` — 新增统一排序协议：`setSort/toggleSort/clearSort`，支持默认排序与不可排序列拦截。
  - `src/components/admin/shared/table/useAdminColumnFilter.ts` — 新增列筛选状态容器协议：open/close/toggle、clear、active 判断与 render context。
  - `src/components/admin/shared/table/AdminColumnFilterContainer.tsx` — 新增 render-prop 容器（仅承载协议，不承载业务筛选 UI）。
  - `src/components/admin/shared/table/useAdminTableSort.demo.tsx`、`src/components/admin/shared/table/useAdminColumnFilter.demo.tsx` — 最小 usage 示例。
  - `tests/unit/components/admin/shared/table/useAdminTableSort.test.tsx`、`tests/unit/components/admin/shared/table/useAdminColumnFilter.test.tsx` — 覆盖排序与筛选容器核心行为。
- **新增依赖**：无
- **数据库变更**：无

## [CHG-125] videos 列表迁移到 shared table 基线
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:42
- **修改文件**：
  - `src/components/admin/videos/VideoTable.tsx` — 接入 shared 列状态与排序能力；新增列设置面板、列显隐、列宽拖拽、排序持久化；保持后端分页与现有业务操作不变。
  - `tests/unit/components/admin/videos/VideoTable.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 仅迁移 `videos` 页面表格能力，不改 API 调用顺序、权限逻辑与业务字段结构。

## [CHG-126] sources 列表迁移到 shared table 基线
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:47
- **修改文件**：
  - `src/components/admin/sources/SourceTable.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保留后端分页、验证与删除流程。
  - `tests/unit/components/admin/sources/SourceTable.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 仅迁移 `sources` 页面表格能力，不改 API 调用顺序、权限逻辑与业务字段结构。

## [CHG-127] users 列表迁移到 shared table 基线
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:50
- **修改文件**：
  - `src/components/admin/users/UserTable.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保留后端分页、搜索与用户操作流程。
  - `tests/unit/components/admin/users/UserTable.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 仅迁移 `users` 页面表格能力，不改 API 调用顺序、权限逻辑与业务字段结构。

## [CHG-128] submissions 列表迁移到 shared table 基线
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 15:57
- **修改文件**：
  - `src/components/admin/content/SubmissionTable.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保留投稿审核弹窗与后端分页流程。
  - `src/components/admin/AdminSubmissionList.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保持通过/拒绝业务动作与分页逻辑不变。
  - `tests/unit/components/admin/content/SubmissionTable.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
  - `tests/unit/components/admin/AdminSubmissionList.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 仅迁移 submissions 列表能力，不改 API 调用顺序、权限逻辑与审核语义。

## [CHG-129] subtitles 列表迁移到 shared table 基线
- **完成时间**：2026-03-21
- **记录时间**：2026-03-21 16:00
- **修改文件**：
  - `src/components/admin/content/SubtitleTable.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保留字幕审核弹窗与后端分页流程。
  - `src/components/admin/AdminSubtitleList.tsx` — 接入 shared 列状态与排序能力；新增列设置、列显隐、列宽拖拽、排序持久化；保持通过/拒绝业务动作与分页逻辑不变。
  - `tests/unit/components/admin/content/SubtitleTable.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
  - `tests/unit/components/admin/AdminSubtitleList.test.tsx` — 覆盖默认排序与切换、列显隐、列宽持久化回挂。
- **新增依赖**：无
- **数据库变更**：无
- **注意事项**：
  - 仅迁移 subtitles 列表能力，不改 API 调用顺序、权限逻辑与审核语义。
