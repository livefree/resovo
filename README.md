# Resovo（流光）

国际化视频资源聚合索引平台。平台本身不托管视频，只提供第三方视频链接的索引、搜索和播放引导服务。

**域名**：resovo.tv &nbsp;|&nbsp; **当前版本**：Phase 1 MVP

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
npm run db:migrate
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
npm run crawler:full
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
- **爬虫管理**：配置资源站、手动触发全量/增量采集

### 触发内容采集

登录管理后台 → 爬虫管理 → 点击「全量采集」，等待采集完成后刷新首页即可看到视频内容。

采集完成的视频默认处于**待审状态**（`is_published = false`），需要在视频管理页批量上架，或修改环境变量跳过审核：

```
# .env.local
AUTO_PUBLISH_CRAWLED=true
```

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

## 已知问题（Phase 2 修复）

- E2E 测试有 2 个 flaky（时序问题，不影响功能）
- 移动端播放器控制栏体验待优化
- 推荐系统尚未实现（详情页/播放页推荐区为静态占位）
- 用户收藏/历史/播放列表功能在 Phase 2 实现

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
