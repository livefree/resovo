# Resovo（流光） — 任务看板

> **AI 工作规则**：
> - 全自动模式：完成一个任务后立即开始下一个，无需等待确认
> - 优先级：🚨 BLOCKER > ❌ 有问题 > CHG-xx 变更任务 > ⬜ 待开始
> - 每个任务完成后必须：写测试 → 跑测试（全通过）→ git commit → 标 ✅ 已完成
> - 测试连续失败 2 次无法修复 → 写入 BLOCKER，暂停等待
> - Phase 全部完成 → 写入 PHASE COMPLETE，暂停等待确认
> - 详细规则见 `CLAUDE.md`

---

## 状态说明

| 标记 | 含义 |
|------|------|
| ⬜ 待开始 | 依赖已满足，可以开始 |
| ⏳ 等待依赖 | 依赖任务未完成，不可开始 |
| 🔄 进行中 | AI 当前正在处理 |
| ✅ 已完成 | AI 完成并自检通过，代码已提交 |
| ❌ 有问题 | git review 发现问题，需要处理 |
| 🚫 已取消 | 不再需要 |

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
- **状态**：⬜ 待开始
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### INFRA-03 Elasticsearch 初始化
- **状态**：⬜ 待开始
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### INFRA-04 Redis + Bull 初始化
- **状态**：⬜ 待开始
- **描述**：Redis 客户端 + Bull 队列基础配置
- **文件范围**：
  - `src/api/lib/redis.ts`
  - `src/api/lib/queue.ts`
- **依赖**：INFRA-01
- **验收**：Redis 连接成功；Bull 可创建/消费任务；断线有重连逻辑
- **测试要求**：`bash scripts/verify-env.sh` Redis 部分通过
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### INFRA-05 环境变量管理
- **状态**：⬜ 待开始
- **描述**：类型安全的环境变量，缺少必要变量时 fail-fast
- **文件范围**：
  - `.env.example`（提交到仓库）
  - `src/api/lib/config.ts`
- **依赖**：INFRA-01
- **验收**：
  - Zod 校验所有必要变量，缺少时启动报错并说明哪个变量缺失
  - 所有代码通过 `config` 对象读取，无直接 `process.env` 访问
- **测试要求**：`bash scripts/verify-env.sh` 全部通过
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### INFRA-06 Docker Compose 本地环境
- **状态**：⏳ 等待依赖（INFRA-02、INFRA-03、INFRA-04）
- **描述**：一键启动 PostgreSQL、Elasticsearch、Redis
- **文件范围**：`docker-compose.yml`
- **依赖**：INFRA-02、INFRA-03、INFRA-04
- **验收**：
  - `docker compose up -d` 三服务全部健康
  - 数据卷持久化（重启不丢数据）
  - `bash scripts/verify-env.sh` 全部通过（这是 INFRA 系列的统一验收命令）
- **测试要求**：`bash scripts/verify-env.sh` 全部通过
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 认证模块 ──

#### AUTH-01 认证基础设施
- **状态**：⏳ 等待依赖（INFRA-02、INFRA-04）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### AUTH-02 注册/登录/刷新/登出接口
- **状态**：⏳ 等待依赖（AUTH-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### AUTH-03 前端登录/注册页面
- **状态**：⏳ 等待依赖（AUTH-02）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 视频内容模块 ──

#### VIDEO-01 视频列表与详情接口
- **状态**：⏳ 等待依赖（INFRA-02）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### VIDEO-02 首页布局与导航
- **状态**：⏳ 等待依赖（VIDEO-01、AUTH-03）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### BROWSE-01 分类浏览页
- **状态**：⏳ 等待依赖（VIDEO-01、SEARCH-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 搜索模块 ──

#### SEARCH-01 搜索接口
- **状态**：⏳ 等待依赖（INFRA-03、VIDEO-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### SEARCH-02 搜索页面
- **状态**：⏳ 等待依赖（SEARCH-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 播放器模块 ──

#### PLAYER-01 播放源接口
- **状态**：⏳ 等待依赖（INFRA-02）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### DETAIL-01 视频详情页（SSR）
- **状态**：⏳ 等待依赖（VIDEO-01、SEARCH-02）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-02 播放页布局（CSR）
- **状态**：⏳ 等待依赖（DETAIL-01、PLAYER-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-03 Video.js 播放器集成
- **状态**：⏳ 等待依赖（PLAYER-02）
- **描述**：Video.js + HLS.js 集成，基础播放功能
- **文件范围**：`src/components/player/VideoPlayer.tsx`
- **依赖**：PLAYER-02
- **验收**：
  - 支持 HLS（.m3u8）和 MP4
  - 组件卸载时正确销毁实例（无内存泄漏）
  - `dynamic import` with `ssr: false`
- **测试要求**：Playwright `tests/e2e/player.spec.ts`（视频加载、HLS 播放可用性）
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-04 控制栏组件
- **状态**：⏳ 等待依赖（PLAYER-03）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-05 快捷键系统
- **状态**：⏳ 等待依赖（PLAYER-04）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-06 选集浮层
- **状态**：⏳ 等待依赖（PLAYER-04）
- **描述**：从播放器左下角向上滑出的选集矩阵浮层
- **文件范围**：`src/components/player/EpisodeOverlay.tsx`
- **依赖**：PLAYER-04
- **验收**：
  - translateY 动画从左下角向上滑出
  - 半透明背景 + backdrop-filter
  - 8 列网格；方向键导航；Enter 确认；Esc/外部点击关闭
  - 当前集数金色标识
- **测试要求**：Vitest `tests/unit/components/player/EpisodeOverlay.test.tsx`（方向键导航、Enter/Esc）+ Playwright `tests/e2e/player.spec.ts`（选集切换）
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-07 弹幕条
- **状态**：⏳ 等待依赖（PLAYER-03）
- **描述**：Bilibili 风格弹幕条（播放器下方独立一行）
- **文件范围**：`src/components/player/DanmakuBar.tsx`
- **依赖**：PLAYER-03
- **验收**：
  - 弹幕开关、透明度滑条、字号滑条、颜色选择
  - 输入框 + 发送按钮（未登录时 disabled）
  - CommentCoreLibrary 初始化，弹幕能飞过播放器
- **测试要求**：Vitest `tests/unit/components/player/DanmakuBar.test.tsx`（开关状态、颜色切换）+ Playwright `tests/e2e/player.spec.ts`（弹幕开关可用性）
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### PLAYER-08 视频信息区与 Meta Chip
- **状态**：⏳ 等待依赖（PLAYER-02、SEARCH-02）
- **描述**：播放页视频信息区，含可点击导演/演员/编剧 chip
- **文件范围**：`src/components/video/VideoMeta.tsx`
- **依赖**：PLAYER-02、SEARCH-02
- **验收**：
  - 导演/编剧/演员分行展示，人名 chip 点击跳转搜索
  - 分类标签点击跳转搜索
  - 收藏/分享/举报失效/追剧记录按钮
  - 支持双主题
- **测试要求**：Playwright `tests/e2e/search.spec.ts`（MetaChip 点击跳转搜索）
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 字幕模块 ──

#### SUBTITLE-01 字幕接口与播放器集成
- **状态**：⏳ 等待依赖（INFRA-02、PLAYER-04）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

### ── 爬虫基础 ──

#### CRAWLER-01 Bull 队列基础设施
- **状态**：⏳ 等待依赖（INFRA-04）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-02 苹果CMS采集服务
- **状态**：⏳ 等待依赖（CRAWLER-01、INFRA-02、INFRA-03）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-03 链接验证服务
- **状态**：⏳ 等待依赖（CRAWLER-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### CRAWLER-04 管理后台接口
- **状态**：⏳ 等待依赖（CRAWLER-02、CRAWLER-03）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

## 已完成任务归档

_（任务 review 通过后移入此处）_


---

## Phase 2 管理后台（ADMIN 模块）

> Phase 1 完成后开始。所有后台路由和页面均需先读取 `docs/decisions.md` ADR-010。

---

#### ADMIN-01 后台访问控制中间件
- **状态**：⏳ 等待依赖（AUTH-01）
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
  - 未登录访问 /admin/* 重定向登录页
  - role=user 访问 /admin/* 返回 403 页面
  - role=moderator 访问 /admin/users 返回 403
  - role=admin 可访问全部后台页面
  - 侧边栏按角色动态显示菜单（moderator 不显示系统管理区）
- **测试要求**：Playwright `tests/e2e/admin.spec.ts`（三种角色的访问控制验证）
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-02 视频内容管理页面
- **状态**：⏳ 等待依赖（ADMIN-01、VIDEO-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-03 播放源 + 投稿 + 字幕审核页面
- **状态**：⏳ 等待依赖（ADMIN-01、PLAYER-01、SUBTITLE-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-04 用户管理 + 爬虫管理页面（admin only）
- **状态**：⏳ 等待依赖（ADMIN-01、CRAWLER-04）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

#### ADMIN-05 数据看板（admin only）
- **状态**：⏳ 等待依赖（ADMIN-01）
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
- **完成备注**：_（AI 填写：修改文件列表 + 测试结果 + commit hash）_
- **问题说明**：_（git review 发现问题时填写，AI 修复后清空）_

---

## 变更任务区（CHG-xx）

> 设计或目标发生变更时，在此区域新增变更任务。
> 变更任务优先级高于普通功能任务，AI 启动时在正常任务之前处理。
> 格式说明见 `CLAUDE.md` — 设计变更处理规则。

_（暂无变更任务）_
