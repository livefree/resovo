# Resovo（流光）

国际化视频资源聚合索引平台。平台本身不托管视频，只提供第三方视频链接的索引、搜索和播放引导服务。

**域名**：resovo.tv &nbsp;|&nbsp; **当前版本**：Phase 2 开发中（Phase 1 MVP 已完成）

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

```bash
# 终端 1：前端（Next.js，端口 3000）
npm run dev

# 终端 2：后端 API（Fastify，端口 4000）
npm run api
```

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

| 入口 | 地址 | 说明 |
|------|------|------|
| 前台首页 | http://localhost:3000 | 主站，需有视频数据 |
| 分类浏览 | http://localhost:3000/browse | 按类型/地区/年份筛选 |
| 搜索 | http://localhost:3000/search | 全文搜索 |
| 管理后台 | http://localhost:3000/admin | 需要 admin 账号 |
| API 文档 | http://localhost:4000/docs | Fastify Swagger |

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
  -- 使用 bcrypt 生成密码 hash，或运行 npm run hash:password
  '$2b$10$your_bcrypt_hash_here',
  'admin'
);
```

### 登录管理后台

1. 访问 http://localhost:3000/admin
2. 未登录时自动跳转登录页
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
5. 控制台状态条（scheduler/freeze/orphan）可直接执行：
   - `开启冻结/关闭冻结`：切换全局采集冻结状态。
   - `stop-all`：一键取消活跃任务并冻结系统。

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

连接 PostgreSQL 和 Elasticsearch，执行一次增量采集（最近 24 小时），并输出视频数、播放源数、ES 索引文档数及样本数据。退出码 0 表示链路正常。

### 采集控制接口（调试）

如需用 API 调试 run 级控制：

```bash
# 触发批次（示例：全站增量）
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs' \
  -H 'Authorization: Bearer <admin_access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"triggerType":"all","mode":"incremental"}'

# 暂停批次
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs/<runId>/pause' \
  -H 'Authorization: Bearer <admin_access_token>'

# 恢复批次
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs/<runId>/resume' \
  -H 'Authorization: Bearer <admin_access_token>'

# 中止批次
curl -X POST 'http://localhost:4000/v1/admin/crawler/runs/<runId>/cancel' \
  -H 'Authorization: Bearer <admin_access_token>'

# 立即停止所有采集（开启全局冻结 + 取消活跃任务 + 清理自动 tick）
curl -X POST 'http://localhost:4000/v1/admin/crawler/stop-all' \
  -H 'Authorization: Bearer <admin_access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"freeze":true,"removeRepeatableTick":true}'

# 显式切换全局冻结（enabled=true 开启，false 关闭）
curl -X POST 'http://localhost:4000/v1/admin/crawler/freeze' \
  -H 'Authorization: Bearer <admin_access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"enabled":false}'
```

命令行止血（本地开发）：

```bash
npm run crawler:stop-all
```

调度器默认关闭（避免开发阶段误触发自动采集），仅在显式开启时运行：

```bash
# .env.local
CRAWLER_SCHEDULER_ENABLED=true
```

### 一键清空已抓取数据（测试用）

当需要重复验证采集链路时，可使用以下命令一键清空抓取结果与采集任务记录（保留用户和站点配置）：

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

### 关键约束

- `videos(short_id)` — URL 唯一标识（8 位 nanoid），是对外的主要查询键
- `video_sources(video_id, source_url)` — 唯一约束，防止重复写入同一播放源
- `videos.deleted_at` — 软删除，所有查询自动过滤 `deleted_at IS NULL`
- `cast` 是 PostgreSQL 保留字，schema 中已加双引号处理

### 迁移执行顺序

```
001_init_tables.sql  →  002_indexes.sql
```

两个文件均为**幂等**（`IF NOT EXISTS`），可安全重复执行。

---

## 运行测试

```bash
# 单元测试
npm run test

# 单元测试（带覆盖率）
npm run test:coverage

# E2E 测试（需要前后端服务在运行）
PLAYWRIGHT_PORT=3002 npm run test:e2e

# 类型检查
npm run typecheck

# Lint
npm run lint
```

---

## Phase 1 完成功能清单

### 基础设施
- PostgreSQL + Elasticsearch + Redis + Docker Compose 本地环境
- 环境变量管理与验证脚本

### 用户认证
- 注册 / 登录 / 登出
- JWT 双 Token（access token 内存存储，refresh token HttpOnly Cookie）
- 三级角色：user / moderator / admin

### 内容展示
- 首页：Hero Banner + 热门电影网格 + 热播剧集列表
- 分类浏览页：多维度筛选（类型/地区/语言/年份/评分/状态）
- 搜索页：全文搜索 + 筛选条 + 结果列表
- 视频详情页（SSR，利于 SEO）
- 视频播放页（CSR，含弹幕）

### 播放器
- Video.js + HLS.js 集成
- 控制栏：播放/暂停/音量/倍速/字幕/剧场模式/全屏
- 选集浮层（方向键导航）
- 断点续播（本地 + 服务端双轨）
- 弹幕条
- 线路切换（播放器外部独立栏）

### 内容采集
- 苹果CMS标准接口对接（XML / JSON）
- 字段自动映射（导演/演员/编剧拆分为数组）
- 增量采集（每日凌晨 2:00）
- 链接有效性验证（每日凌晨 4:00）

### 管理后台
- 访问控制（/admin 路径，角色鉴权）
- 视频上下架 + 元数据编辑
- 播放源管理 + 手动验证
- 投稿/字幕审核队列
- 用户管理（封号/解封/角色）
- 爬虫管理（配置资源站 / 手动触发）
- 数据看板

---

## Phase 2 规划功能

> 详细任务说明见 `docs/tasks.md`（CHG-20~32）；迁移分析见 `docs/migration-analysis.md`

### 播放器升级

- **CHG-20** 将 video.js 替换为 `@livefree/yt-player`（项目自有播放器组件库，零依赖、CSS Modules 隔离）
- **CHG-21/22** 接入自有弹幕 API + comment-core-library 渲染层（当前弹幕条无数据源）
- **CHG-23** Douban 元数据同步（管理员手动触发，补全评分/演员/封面）

### 管理后台增强

- **CHG-24** Admin 基础 UI 组件库（DataTable、Modal、StatusBadge、Pagination，供所有管理页面复用）
- **CHG-25~29** 仪表盘/用户/视频/源/审核各页面完善（搜索、分页、批量操作、实时验证 UI）
- **CHG-30** 缓存管理（Redis key 统计 + 分类清除）
- **CHG-31** 数据导入导出（播放源 JSON 批量操作）
- **CHG-32** 性能监控（Fastify 请求指标收集 + 监控页面）

### 外部参考项目

| 项目 | 路径 | 用途 |
|------|------|------|
| `yt-player` | `~/projects/yt-player` | 直接安装为本地 npm 包替换 video.js |
| `LunaTV-enhanced` | `~/projects/LunaTV-enhanced` | 管理后台 UI 设计参考（不直接迁移代码） |

---

## 已知问题

- 移动端播放器控制栏体验待优化（Phase 2 播放器替换时一并处理）
- 弹幕功能：UI 已实现（DanmakuBar），数据 API 尚未接入（CHG-21/22）
- 推荐系统尚未实现（详情页/播放页推荐区为静态占位，Phase 3+）
- 播放源有效性取决于第三方资源站，不保证所有链接可用

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 15 + TypeScript + Tailwind CSS |
| 后端 | Fastify + TypeScript (Node.js 22) |
| 数据库 | PostgreSQL 16 |
| 搜索 | Elasticsearch 8.x + IK 分词 |
| 缓存/队列 | Redis + Bull |
| 对象存储 | Cloudflare R2 |
| 测试 | Vitest + Playwright |
