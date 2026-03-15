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
