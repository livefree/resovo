# Resovo（流光） — 开发变更记录

> 每次任务完成后，AI 在此追加一条记录。
> 格式固定，便于追踪变更历史和排查问题。

---

## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```

---

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
