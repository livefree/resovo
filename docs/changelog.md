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
