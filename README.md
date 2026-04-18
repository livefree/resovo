# Resovo（流光）

国际化视频资源聚合索引平台。平台本身不托管视频，只提供第三方视频链接的索引、搜索和播放引导服务。

**域名**：resovo.tv &nbsp;|&nbsp; **当前版本**：Phase 2 开发中（Phase 1 MVP 已完成）

---

## 项目结构

Turbo Monorepo + npm workspaces，三个独立应用通过同域反向代理协同：

```
resovo/
├── apps/
│   ├── web/        # 前台 Next.js（@resovo/web，port 3000）
│   ├── server/     # 后台管理 Next.js（@resovo/server，port 3001）
│   └── api/        # Fastify API（@resovo/api，port 4000）
├── packages/
│   ├── player/     # 共享播放器组件（@resovo/player）
│   └── types/      # 共享类型（@resovo/types）
├── docker/
│   ├── nginx.conf              # 反向代理路由规则
│   └── docker-compose.dev.yml  # 本地三端联调代理（localhost:8080）
└── docker-compose.yml          # PostgreSQL + Elasticsearch + Redis
```

路由分发（Nginx）：

```
/* (默认)   → web:3000    前台
/admin/*   → server:3001  后台管理
/v1/*      → api:4000     API
```

---

## 快速启动（本地开发）

### 环境要求

| 工具 | 版本 |
|------|------|
| Node.js | 22+ |
| Docker Desktop | 最新版 |
| npm | 10+ |

### 第一步：启动基础服务

```bash
docker compose up -d
```

启动 PostgreSQL（5432）、Elasticsearch（9200）、Redis（6379）。

验证服务状态：

```bash
bash scripts/verify-env.sh
```

### 第二步：配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`，填写必要变量（数据库连接已预填本地默认值，通常不需要修改）。

### 第三步：安装依赖

```bash
npm install
```

### 第四步：初始化数据库

```bash
npm run migrate
```

### 第五步：启动服务

**方式 A — 全部启动（推荐，Turbo 并行）**

```bash
npm run dev     # 同时启动 apps/web:3000 + apps/server:3001 + apps/api:4000
```

**方式 B — 单独启动（调试用）**

```bash
# 终端 1：前台（Next.js，端口 3000）
npm --workspace @resovo/web run dev

# 终端 2：后台管理（Next.js，端口 3001）
npm --workspace @resovo/server run dev

# 终端 3：API（Fastify，端口 4000）
npm run api
```

**方式 C — 统一入口代理（可选，需 Docker）**

```bash
docker compose -f docker/docker-compose.dev.yml up
```

通过 `http://localhost:8080` 访问，nginx 自动按路径分发三端流量。

### 第六步：采集初始内容

打开浏览器访问管理后台，手动触发一次全量采集（见下方管理员接入）。

或直接用命令行触发：

```bash
npm run verify:crawler
```

### 第七步（推荐）：开发前稳态检查

在 AI 持续开发前，建议先执行一轮 preflight，保证环境、迁移、类型、lint、测试基线稳定。

```bash
npm run preflight
```

若本轮改动涉及关键页面流程，再执行带 E2E 的版本：

```bash
npm run preflight:e2e
```

---

## 访问地址

### 独立进程访问（本地开发默认）

| 入口 | 地址 | 说明 |
|------|------|------|
| 前台首页 | http://localhost:3000 | 主站，需有视频数据 |
| 分类浏览 | http://localhost:3000/browse | 按类型/地区/年份筛选 |
| 搜索 | http://localhost:3000/search | 全文搜索 |
| 管理后台 | http://localhost:3001/admin | 需要 admin 账号 |
| API 文档 | http://localhost:4000/docs | Fastify Swagger |

### Nginx 代理统一入口（需 docker/docker-compose.dev.yml）

| 入口 | 地址 | 说明 |
|------|------|------|
| 前台 | http://localhost:8080 | 统一域名，同域 Cookie |
| 管理后台 | http://localhost:8080/admin | 同上 |
| API | http://localhost:8080/v1/health | 同上 |

---

## 管理员接入

### 创建第一个管理员账号

数据库初始化后没有任何用户，需要手动创建 admin 账号：

```bash
npm run create:admin
```

按提示输入用户名、邮箱、密码。

或者直接用 SQL：

```sql
INSERT INTO users (id, username, email, password_hash, role)
VALUES (
  gen_random_uuid(),
  'admin',
  'admin@resovo.tv',
  '$2b$10$your_bcrypt_hash_here',
  'admin'
);
```

### 登录管理后台

1. 访问 http://localhost:3001/admin（或代理模式 http://localhost:8080/admin）
2. 未登录时自动跳转 `/admin/login`
3. 用 admin 账号登录后进入管理后台

### 管理后台功能

**内容管理区**（moderator / admin 可见）：
- **视频管理**：查看所有视频、上下架、编辑元数据
- **播放源管理**：查看/删除播放源、手动验证链接有效性
- **投稿审核**：审核用户投稿的资源链接
- **字幕审核**：审核用户上传的字幕文件

**系统管理区**（仅 admin 可见）：
- **数据看板**：视频数/播放量/用户数/待处理事项
- **用户管理**：查看用户、封号/解封、角色管理
- **采集控制台**：配置源站、手动触发采集、查看运行任务、暂停/恢复/中止

### 触发与控制采集任务

入口位置：
1. 登录后台后进入「系统管理」→「采集控制台（原视频源配置）」。
2. 页面上方「采集批次状态」区域可看到当前任务与最近结果。
3. 每个运行中的任务卡片提供按钮：
   - `暂停`：暂停后不再继续后续步骤，进入 `paused`。
   - `恢复`：从暂停状态恢复执行。
   - `中止`：停止该批次后续执行，进入 `cancelled`（已完成结果保留）。
4. 全局止血：如发生任务失控，可调用 `stop-all`（开启全局冻结 + 取消活跃任务）。

手动触发方式：
1. 全站触发：在工具栏点击「全站增量采集」或「全站全量采集」。
2. 批量触发：先在表格勾选多个源站，再点击「批量增量采集」或「批量全量采集」。
3. 单站触发：在表格行内点击「增量」或「全量」。

采集完成的视频默认处于**待审状态**（`is_published = false`），需要在视频管理页批量上架，或修改环境变量跳过审核：

```
# .env.local
AUTO_PUBLISH_CRAWLED=true
```

### 验证采集链路

```bash
npm run verify:crawler
```

### 采集控制接口（调试）

```bash
# 触发批次（示例：全站增量）
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs' \
  -H 'Authorization: Bearer <admin_access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"triggerType":"all","mode":"incremental"}'

# 暂停批次
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs/<runId>/pause' \
  -H 'Authorization: Bearer <admin_access_token>'

# 立即停止所有采集（开启全局冻结 + 取消活跃任务）
curl -X POST 'http://localhost:4000/v1/admin/crawler/stop-all' \
  -H 'Authorization: Bearer <admin_access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"freeze":true,"removeRepeatableTick":true}'
```

命令行止血（本地开发）：

```bash
npm run crawler:stop-all
```

调度器默认关闭，需显式开启：

```
# .env.local
CRAWLER_SCHEDULER_ENABLED=true
```

### 一键清空已抓取数据（测试用）

```bash
npm run clear:crawled-data
```

---

## 数据库结构

### 核心表

| 表名 | 说明 |
|------|------|
| `users` | 用户（三级角色：user / moderator / admin） |
| `videos` | 视频元数据（标题/封面/类型/年份/评分等） |
| `video_sources` | 播放源（第三方直链，支持多线路多集数） |
| `subtitles` | 字幕文件（R2 存储，用户上传） |
| `lists` | 用户收藏列表 |
| `list_items` | 收藏列表条目 |
| `danmaku` | 弹幕（按视频ID + 集数 + 时间轴索引） |
| `watch_history` | 观看历史（用于断点续播） |
| `crawler_tasks` | 采集任务记录（状态/耗时/数量统计） |
| `media_catalog` | 作品元数据层（标题/演员/评分/外部ID等） |

### 关键约束

- `videos(short_id)` — URL 唯一标识（8 位 nanoid），是对外的主要查询键
- `video_sources(video_id, source_url)` — 唯一约束，防止重复写入同一播放源
- `videos.deleted_at` — 软删除，所有查询自动过滤 `deleted_at IS NULL`
- `cast` 是 PostgreSQL 保留字，schema 中已加双引号处理

### 迁移执行顺序

迁移文件位于项目根 `migrations/` 目录，当前 001 → 046。详见 `docs/architecture.md` §13。

---

## 运行测试

```bash
# 单元测试（所有 workspace）
npm run test

# 单元测试（单次运行，不 watch）
npm run test -- --run

# 类型检查（web + server + api 全覆盖）
npm run typecheck

# Lint（turbo，web + server + api）
npm run lint

# E2E 测试（需要 web:3000 和 server:3001 在运行）
npm run test:e2e
```

---

## 根级命令速查

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动全部三个应用（turbo 并行） |
| `npm run build` | 构建全部应用（turbo） |
| `npm run lint` | lint 全部应用（turbo，web+server+api） |
| `npm run typecheck` | 类型检查（根 tsc 覆盖 web+api + server workspace） |
| `npm run test` | 单元测试（vitest） |
| `npm run test:e2e` | E2E 测试（Playwright，前台+后台分离项目） |
| `npm run api` | 单独启动 API 进程（Fastify，port 4000） |
| `npm run migrate` | 执行数据库迁移 |

---

## 已知问题

- 移动端播放器控制栏体验待优化
- 弹幕功能：UI 已实现（DanmakuBar），数据 API 尚未接入
- 推荐系统尚未实现（详情页/播放页推荐区为静态占位，Phase 3+）
- 播放源有效性取决于第三方资源站，不保证所有链接可用

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建工具 | Turbo Monorepo + npm workspaces |
| 前台 | Next.js 15 + TypeScript + Tailwind CSS（apps/web） |
| 后台管理 | Next.js 15 + TypeScript + Tailwind CSS（apps/server） |
| API | Fastify + TypeScript（apps/api，Node.js 22） |
| 共享包 | @resovo/player（播放器）+ @resovo/types（类型） |
| 数据库 | PostgreSQL 16 |
| 搜索 | Elasticsearch 8.x + IK 分词 |
| 缓存/队列 | Redis + Bull |
| 对象存储 | Cloudflare R2 |
| 反向代理 | Nginx（同域多进程路由） |
| 测试 | Vitest + Playwright |
