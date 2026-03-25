# Resovo（流光） — 架构决策记录 (ADR)

> 每次做出重要的技术决策时，在此追加记录。
> AI 在遇到相关情形时必须查阅本文件，不得推翻已有决策。

---

## ADR-001 视频播放采用直链模式，不做服务端代理

- **日期**：2025-03
- **状态**：已采纳，不可推翻
- **决策**：播放源 URL 由后端返回给前端，Video.js 直接加载第三方链接，服务端不做流量转发
- **理由**：代理模式下 100 个并发用户（1080P）需要约 400-800 Mbps 出口带宽，成本是直链的数百倍
- **架构约束**：
  - `GET /videos/:id/sources` 返回 `source_url` 字段（直链），不返回代理地址
  - 后端不得创建任何视频流转发逻辑
  - 前端播放器直接消费 `source_url`，不经过任何中间层
- **升级路径预留**：`source_url` 字段未来可以切换为代理地址，前端播放器代码无需修改

---

## ADR-002 URL 采用 Slug + 短 ID 混合方案

- **日期**：2025-03
- **状态**：已采纳
- **决策**：`/movie/oppenheimer-aB3kR9x`，短 ID 由 nanoid 生成（8位，字符集 A-Za-z0-9）
- **理由**：Slug 保障 SEO 可读性，短 ID 防止枚举攻击，两者互补
- **架构约束**：
  - 后端路由解析时**只使用短 ID 部分查库**，忽略 slug 文字
  - 用户修改 URL 中的 slug 文字不影响页面正常访问（Medium 模式）
  - `videos` 表必须有 `short_id CHAR(8) UNIQUE` 字段
  - `lists` 表同样有 `short_id CHAR(8) UNIQUE` 字段
- **影响文件**：`src/api/routes/videos.ts`，`src/app/[locale]/watch/[id]/page.tsx`

---

## ADR-003 JWT 双 Token 方案，Refresh Token 存 HttpOnly Cookie

- **日期**：2025-03
- **状态**：已采纳，不可推翻
- **决策**：Access Token 15 分钟有效期存内存，Refresh Token 7 天存 HttpOnly + Secure Cookie
- **理由**：防止 XSS 窃取 Token，对国际化平台尤其重要
- **架构约束**：
  - Access Token 不得存入 `localStorage` 或 `sessionStorage`
  - Refresh Token 只通过 Cookie 传递，不出现在响应 body 中
  - 登出时服务端将 Refresh Token 加入 Redis 黑名单（key 格式：`blacklist:rt:<token_hash>`）
  - Redis 黑名单 TTL = Refresh Token 剩余有效期
- **影响文件**：`src/api/routes/auth.ts`，`src/lib/auth.ts`

---

## ADR-004 搜索使用 Elasticsearch，PostgreSQL 不做全文检索

- **日期**：2025-03
- **状态**：已采纳
- **决策**：所有搜索请求走 Elasticsearch（含联想词、过滤、推荐），PostgreSQL 只做结构化 CRUD
- **理由**：PostgreSQL 全文索引对中文支持差，Elasticsearch 配合 IK 分析器和拼音插件能覆盖所有搜索场景
- **架构约束**：
  - `SearchService.ts` 只调用 ES 客户端，不查 PostgreSQL
  - 视频数据写入 PostgreSQL 后，必须同步更新 ES 索引（通过 Bull 队列异步处理）
  - ES 索引名：`resovo_videos`
  - 人名字段（director/cast/writers）使用 `.keyword` 子字段做精确匹配
- **影响文件**：`src/api/services/SearchService.ts`，`src/api/lib/elasticsearch.ts`

---

## ADR-005 片单（Collection）创建权限限定为 admin/editor 角色

- **日期**：2025-03
- **状态**：已采纳
- **决策**：`type = 'collection'` 的 list 只有 role 为 `admin` 或 `moderator` 的用户可创建；普通用户只能创建 `playlist`
- **理由**：片单代表平台策划内容，需要有内容权威性
- **架构约束**：
  - `POST /lists` 接口中，若 `type === 'collection'`，必须校验 `req.user.role` 为 `admin` 或 `moderator`，否则返回 403
  - 前端创建入口根据用户角色显示/隐藏片单选项
- **影响文件**：`src/api/routes/lists.ts`

---

## ADR-006 弹幕数据存储在 PostgreSQL，按 video_id 分区

- **日期**：2025-03
- **状态**：已采纳，待实现时复查
- **决策**：当前阶段弹幕存 PostgreSQL，`danmaku` 表按 `video_id` 范围分区
- **理由**：简化运维，当弹幕量增长到一定规模后可迁移到 MongoDB，当前不引入额外数据库
- **架构约束**：
  - `danmaku` 表的查询**必须包含** `video_id` 条件，避免全表扫描
  - `GET /videos/:id/danmaku` 必须同时接受 `?episode=N` 参数缩小范围
  - 若单个视频弹幕量超过 50 万条，在 changelog 中记录，触发迁移评估
- **影响文件**：`src/api/routes/danmaku.ts`，`src/api/db/queries/danmaku.ts`

---

## ADR-007 主题系统通过 CSS 变量 + 根元素 class 实现

- **日期**：2025-03
- **状态**：已采纳
- **决策**：深色/浅色主题通过切换根元素 `class="dark"` 或 `class="light"` 实现，所有颜色使用 CSS 变量
- **理由**：主题切换无需重新渲染组件树，性能最优
- **架构约束**：
  - **任何组件不得硬编码颜色值**（包括 Tailwind 的 `text-gray-800` 等具体色值）
  - 使用 `var(--accent)`、`var(--bg)`、`var(--text)` 等 CSS 变量
  - 主题偏好持久化到 `localStorage`，key：`resovo-theme`
  - 支持三种模式：`dark` / `light` / `system`（跟随系统）
- **CSS 变量定义位置**：`src/app/globals.css`
- **影响文件**：`src/stores/themeStore.ts`，`src/components/ui/ThemeToggle.tsx`

---

---

## ADR-008 视频内容采集使用苹果CMS标准接口

- **日期**：2025-03
- **状态**：已采纳
- **决策**：爬虫模块通过苹果CMS采集接口（MacCMS API）获取视频内容，不自行爬取页面 HTML
- **理由**：
  - 苹果CMS 接口是国内视频资源站的行业事实标准，数百个站点兼容同一套格式
  - 接口直接返回结构化数据（元数据 + 播放源），无需解析 HTML，维护成本极低
  - 支持增量更新参数（`?h=24` 拉取最近 24 小时变更），适合定时任务场景
- **接口格式**：
  - XML：`{base_url}/api.php/provide/vod/from/{source}/at/xml`
  - JSON：`{base_url}/api.php/provide/vod/from/{source}/at/json`
  - 分页：`?pg=1`（从第 1 页开始，每页约 20 条）
  - 增量：`?h=24`（最近 24 小时有更新的内容）
  - 搜索：`?wd=关键词`（按关键词采集）
- **资源站配置方式**：在 `.env` 中以 `CRAWLER_SOURCES` 配置，JSON 数组格式：
  ```
  CRAWLER_SOURCES=[{"name":"jsm3u8","base":"https://jszyapi.com","format":"xml"},...]
  ```
- **架构约束**：
  - 爬虫只调用标准接口 URL，不爬取任何页面 HTML
  - 采集结果通过字段映射写入 PostgreSQL，映射规则见 `docs/architecture.md` 采集字段映射表
  - 封面图片直接存外链 URL，不下载到本地或 R2（降低存储成本）
  - 所有采集任务通过 Bull 队列异步执行，不在 API 请求生命周期内运行
  - 增量任务每日凌晨 2 点自动触发；全量任务仅在初始化或手动触发时运行
- **影响文件**：`src/api/services/CrawlerService.ts`、`src/api/db/queries/crawlerTasks.ts`

---

## ADR-009 合规边界：平台定位为索引而非托管

- **日期**：2025-03
- **状态**：已采纳，所有相关代码必须遵守
- **决策**：平台仅提供视频链接索引服务，不存储、不转码、不代理任何视频文件
- **架构约束**：
  - 服务器不下载任何视频文件（违反 ADR-001 的代理转发同样违反此条）
  - 封面图存外链，不下载到 R2（字幕文件除外，字幕是用户上传的非版权文件）
  - 前端页面底部必须常驻免责声明文字
  - 必须提供版权投诉/下架申请入口（Phase 2 实现）
- **影响文件**：所有涉及视频内容存储的代码
---

## ADR-010 后台入口与角色权限设计

- **日期**：2025-03
- **状态**：已采纳
- **决策**：三级角色体系（user / moderator / admin），后台统一入口 `/admin`，按角色显示不同菜单区

### 角色定义

| 角色 | 定位 | /admin 访问范围 |
|------|------|----------------|
| `user` | 前台标准用户 | 无，访问 /admin 重定向 403 |
| `moderator` | 内容版主，负责审核 | 内容管理区（视频/播放源/投稿/字幕/片单/举报-内容类） |
| `admin` | 超级管理员，系统全权 | 全部（含系统管理区：用户/爬虫/数据看板/举报-账号类） |

### 权限继承关系
- admin 拥有 moderator 的全部权限，并在此之上增加系统管理权限
- moderator 拥有 user 的全部权限，并在此之上增加内容管理权限

### 后台入口约束
- `/admin` 路径下所有页面：非 moderator/admin 访问一律重定向 403
- `/admin/users`、`/admin/crawler`、`/admin/analytics`：额外限制 admin only
- 后台 API `GET/POST/PATCH/DELETE /admin/*`：
  - 内容管理接口：`requireRole(['moderator', 'admin'])`
  - 系统管理接口：`requireRole(['admin'])`

### /admin 导航菜单分区

**内容管理区（moderator + admin 可见）**
- 视频管理：视频上下架、编辑元数据、手动添加视频
- 播放源管理：查看、删除、手动触发验证
- 投稿审核：审核用户投稿的资源链接
- 字幕审核：审核用户上传的字幕文件
- 片单管理：创建、编辑、下架片单
- 举报处理（内容类）：处理用户举报的失效链接

**系统管理区（仅 admin 可见）**
- 用户管理：查看用户列表、封号、解封、角色升降级
- 爬虫管理：资源站配置、手动触发采集与验证
- 数据看板：流量、播放量、搜索词、用户留存统计
- 举报处理（账号类）：处理用户账号违规投诉

### videos 表上架状态
- 爬虫采集的内容默认 `is_published = false`（待审状态）
- moderator/admin 审核通过后设为 `true`（上架）
- 也可在爬虫配置中开启"自动上架"模式（`AUTO_PUBLISH=true`），跳过人工审核
- 前台 API 所有视频查询默认过滤 `is_published = true`

- **影响文件**：
  - `src/api/plugins/authenticate.ts`（requireRole 支持数组）
  - `src/api/routes/admin/`（全部后台路由）
  - `src/app/[locale]/admin/`（全部后台页面）
  - `docs/architecture.md`（路由结构、videos 表字段）

---

## ADR-011 播放器键盘状态机：多面板焦点模式

- **日期**：2025-03
- **状态**：已采纳
- **决策**：播放器键盘快捷键系统引入"面板焦点模式"，不同面板打开时键盘行为不同
- **优先级（从高到低）**：
  1. 选集浮层打开：`←→↑↓` 矩阵导航，`Enter` 确认，`Esc` 关闭
  2. 倍速面板打开：`←→` 调滑条（`stopPropagation`），`1234` 选预设，`S/Esc` 关闭
  3. 输入框聚焦：所有快捷键不触发
  4. 正常播放状态：全部快捷键生效
- **约束**：
  - 倍速面板打开时必须拦截 `←/→` 事件（`e.stopPropagation()`），防止触发播放器快进后退
  - `↑/↓` 调音量仅在选集浮层**关闭**时生效
  - `usePlayerShortcuts.ts` 必须读取 `playerStore` 中的面板状态来判断当前模式
- **影响文件**：`src/components/player/usePlayerShortcuts.ts`、`src/stores/playerStore.ts`

---

## ADR-012 断点续播双轨存储策略

- **日期**：2025-03
- **状态**：已采纳
- **决策**：登录用户进度存服务端（优先），同时本地 localStorage 作兜底；未登录用户只存 localStorage
- **触发条件**：播放超过 30 秒后开始记录，精度 5 秒（每 5 秒写入一次）
- **localStorage key 格式**：`rv-progress-{shortId}-{episode}`（episode 为 null 时写 `movie`）
- **进度恢复 UI**：检测到上次进度 > 30 秒时显示提示条，8 秒后自动继续，可手动选择从头播放
- **约束**：
  - 设置面板"断点续播"开关关闭时，不读取也不写入进度
  - 服务端写入通过 `POST /users/me/history` 接口，使用防抖（5 秒内只写一次）
  - 网络异常时 localStorage 兜底，恢复后同步到服务端
- **影响文件**：`src/components/player/VideoPlayer.tsx`、`src/stores/playerStore.ts`、`src/api/routes/users.ts`

_新增 ADR 时，在此文件末尾追加，不修改已有条目。_

---

## ADR-013: POST /admin/crawler/tasks Endpoint Sunset Decision

- **日期**：2026-03-22
- **状态**：已决定（Decided）
- **背景**：NB-02 修复（CHG-154）已将前端所有触发路径迁移至 `POST /admin/crawler/runs`（triggerType: single）。`POST /admin/crawler/tasks` 为旧触发路径，仅保留用于向后兼容，无已知活跃调用方。
- **决策**：
  - 立即：在该路由响应中加入 `Deprecation: true`、`Sunset: 2026-05-01`、`Link` 响应头（CHG-160，已完成）
  - 计划下线：CHG-163 序列完成后，在下一个 Phase 开始时执行 CHG-163（路由删除任务）将该路由从代码库移除
  - Sunset 日期：2026-05-01
- **原因**：
  - 双触发路径（`/tasks` + `/runs`）增加维护负担，调用方可能混用两条路径
  - `/runs` 模型更完整（支持 batch/all/single/schedule），是长期正确路径
  - `/tasks` POST 已无前端调用方，零风险移除
- **影响文件**：`src/api/routes/admin/crawler.ts`

---

## ADR-014: 采集域 Admin 导航收归 /admin/crawler

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：将 `/admin/system/sites`（crawler_sites 管理）并入 `/admin/crawler` 作为 Sites tab；从 `/admin/system/config` 剥离爬虫配置段移入 `/admin/crawler` 的 Settings tab；`/admin/system/monitor` 改为纯应用级监控，不含采集数据；`/admin/system/sites` 原路由保留为 redirect，不删除。
- **理由**：
  - 采集生命周期的全部数据（`crawler_sites / crawler_runs / crawler_tasks / crawler_task_logs`）属于同一业务域，但 admin 导航按"系统配置"/"采集控制台"分层时将 `crawler_sites` 错归 system 区，导致添加站点、触发采集、查日志必须跨两个导航区
  - `CrawlerSiteManager` 组件已在 `system/crawler-site/` 下，改动主要为路由与导航，无业务逻辑移动
  - 治理层 migration 将新增多个采集相关 admin 页面，在此之前完成导航收归可确保新页面从一开始放置正确
- **架构约束**：
  - `/admin/crawler` 是采集域唯一导航入口：Sites / Console / Logs / Settings 四个 tab
  - `/admin/system` 仅保留纯系统配置：config（不含爬虫段）、monitor（应用级）、cache、migration
  - 不得在 `/admin/system` 下新增任何采集相关页面
  - `/admin/system/sites` redirect 长期保留，不设 sunset
- **影响文件**：`src/app/[locale]/admin/system/sites/page.tsx`（改 redirect），`src/app/[locale]/admin/crawler/page.tsx`（新增 Sites tab），admin 导航组件，`src/app/[locale]/admin/system/config/page.tsx`（剥离爬虫段）

---

## ADR-015: 采集监控采用轮询，不使用 SSE

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：采集控制台监控面板通过 `GET /admin/crawler/monitor-snapshot` 短轮询获取状态，不引入 SSE 或 WebSocket。
- **理由**：
  - 后台同时在线的管理员极少（通常 1–3 人），SSE 的连接管理成本不合比例
  - `/monitor-snapshot` 聚合了 overview/runs/tasks 三层数据，单次 HTTP 请求足以刷新全局状态
  - SSE 在 Fastify 下需要额外管理连接生命周期与心跳，增加运维复杂度
- **架构约束**：
  - 轮询间隔固定为 5 秒（空闲态可延长至 30 秒）
  - 监控区数据与表格区数据必须解耦，轮询不触发表格重渲染
  - 若未来管理员并发量超过 50，可评估迁移至 SSE，届时只需修改 `useCrawlerMonitor` hook，不影响其他模块
- **影响文件**：`src/api/routes/admin/crawler.ts`（monitor-snapshot 端点），`src/components/admin/system/crawler-site/hooks/useCrawlerMonitor.ts`

---

## ADR-016: Season/Episode 统一坐标系（S/E 模型）

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：所有视频资源统一到 (season_number, episode_number) 坐标系。电影 = S1E1，无分集内容不再以 NULL 表示，一律为 (1, 1)。
- **理由**：
  - 当前 `video_sources.episode_number` 为 nullable，电影与"第1集"无法区分，导致播放器逻辑需要特判
  - `watch_history.episode_number NULL` 导致续播逻辑需要同样的特判
  - 统一坐标系后，"从哪集继续播"的查询语义唯一，无歧义
- **迁移策略**：
  - `video_sources.season_number INT NOT NULL DEFAULT 1`（Migration 014 新增）
  - `video_sources.episode_number` 保留，NULL → DEFAULT 1（Migration 014 数据迁移）
  - `watch_history.season_number INT NOT NULL DEFAULT 1`（Migration 014 新增）
  - `watch_history.episode_number` NULL → DEFAULT 1（Migration 014 数据迁移）
  - `videos.episode_count` 保留，语义变为"总集数"，movie = 1
- **架构约束**：
  - 任何读取 `episode_number` 的代码，不得再使用 `IS NULL` 判断"不分集"，改用 `season_number = 1 AND episode_number = 1`
  - 爬虫写入单集内容时，必须显式写入 `season_number = 1, episode_number = 1`
  - 播放器 episode selector 逻辑以 (season, episode) 为主键，不再以 NULL 为特殊分支
- **影响文件**：`src/api/db/migrations/014_*.sql`，`src/api/db/queries/videoSources.ts`，`src/api/db/queries/watchHistory.ts`，`src/api/services/CrawlerService.ts`，`src/components/player/*`

---

## ADR-017: 视频内容类型系统扩展

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：将 `videos.type` 枚举从 4 种扩展为 12 种，并新增 `source_content_type`、`normalized_type`、`content_format`、`episode_pattern` 四个判定字段，实现爬虫原始数据与平台规范分类解耦。
- **类型枚举（12 种）**：
  `movie` / `drama` / `anime` / `variety` / `short_drama` / `sports` / `music` / `documentary` / `game_show` / `news` / `children` / `other`
- **字段语义**：
  - `type`：前台导航类型，决定 URL 前缀（`/movie/`、`/anime/` 等）和分类菜单，是用户可见的主分类
  - `source_content_type TEXT`：爬虫原样写入的源站原始类型字符串，不做规范化，保留用于溯源
  - `normalized_type TEXT`：平台规范化分类，可细于 `type`，供搜索聚合与推荐系统使用
  - `content_format TEXT CHECK (IN ('movie','episodic','collection','clip'))`：内容形态
  - `episode_pattern TEXT CHECK (IN ('single','multi','ongoing','unknown'))`：集数模式
- **爬虫映射规则**：爬虫写入时，`source_content_type` 保存原始值，`type` 和 `normalized_type` 由映射表推断；映射表未覆盖的原始类型默认归入 `other`，`source_content_type` 保留原始值供后续重分类
- **架构约束**：
  - 前台路由（`/movie/`、`/drama/` 等）只使用 `type` 字段做路由分发，不使用 `normalized_type`
  - 搜索和推荐系统可同时使用 `type` 和 `normalized_type` 做过滤聚合
  - `type` CHECK 约束变更必须通过 migration，不得绕过约束直接写入
- **影响文件**：`src/api/db/migrations/013_*.sql`，`src/api/services/CrawlerService.ts`（映射表），`src/types/video.types.ts`，`src/app/[locale]/(browse)/page.tsx`

---

## ADR-018: 内容治理层 — 审核状态与可见性模型

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：引入 `review_status`（审核状态机）和 `visibility_status`（可见性控制）取代单一 `is_published` 布尔值，迁移策略采用方案 B：`is_published` 保留为服务层同步字段，新代码全部写 `visibility_status`，旧代码按模块逐步迁移。
- **字段定义**：
  ```
  review_status    TEXT NOT NULL DEFAULT 'pending_review'
                   CHECK (IN ('pending_review','approved','rejected','blocked'))
  visibility_status TEXT NOT NULL DEFAULT 'internal'
                   CHECK (IN ('public','hidden','internal','blocked'))
  review_reason    TEXT
  review_source    TEXT CHECK (IN ('system','ai','manual'))
  reviewed_by      UUID REFERENCES users(id)
  reviewed_at      TIMESTAMPTZ
  needs_manual_review BOOLEAN NOT NULL DEFAULT false
  ```
- **is_published 迁移策略（方案 B）**：
  - `is_published` 字段保留，不删除，标注 `@deprecated`
  - 语义约定：`is_published = (visibility_status = 'public')`
  - 同步点：`VideoService` 和 `CrawlerService` 的写入路径，写 `visibility_status` 时同步写 `is_published`
  - 数据迁移：Migration 016 执行时，将现有 `is_published=true` 的行写入 `visibility_status='public'` / `review_status='approved'`
  - 前台查询：所有 `WHERE is_published = true` 改为 `WHERE visibility_status = 'public'`（Migration 016 后统一切换）
  - 不使用 DB trigger，同步逻辑在 service 层显式管理
- **内容风险标志（Migration 016-ext，可延后）**：
  `is_adult` / `is_suspected_adult` / `is_sensitive` / `is_violence` / `is_gore` / `is_gambling` / `is_illegal_source` / `is_low_quality_meta` / `is_spam`（全部 `BOOLEAN NOT NULL DEFAULT false`，独立列，支持过滤索引）
- **架构约束**：
  - 新编写的所有代码必须使用 `visibility_status`，禁止直接写 `is_published`
  - Moderator 审核工作流操作 `review_status` 和 `visibility_status`，`is_published` 由 service 层跟随同步，不由 moderator 直接操作
  - 前台 API 所有视频查询条件：`visibility_status = 'public'`（不再是 `is_published = true`）
- **影响文件**：`src/api/db/migrations/016_*.sql`，`src/api/services/VideoService.ts`，`src/api/services/CrawlerService.ts`，`src/api/db/queries/videos.ts`，`src/app/[locale]/admin/videos/page.tsx`

---

## ADR-019: 采集策略按站点配置（Ingest Policy）

- **日期**：2026-03-22
- **状态**：已采纳
- **决策**：在 `crawler_sites` 上添加 `ingest_policy JSONB` 字段，定义该站点采集内容的默认发布与可见性策略；单视频覆盖机制（`videos.ingest_policy_override`）延后实现。
- **字段定义**：
  ```json
  {
    "allow_auto_publish": false,
    "allow_search_index": true,
    "allow_recommendation": true,
    "allow_public_detail": true,
    "allow_playback": true,
    "require_review_before_publish": true
  }
  ```
- **理由**：
  - 不同源站的内容质量与合规风险差异大，统一的 `AUTO_PUBLISH` 环境变量无法满足精细化管理
  - 按站点配置可以"某源站全部内容不允许推荐"只需一行数据库写入，无需批量 UPDATE videos
  - `require_review_before_publish=false` 时，爬虫写入后直接将 `visibility_status` 设为 `public`，绕过人工审核
- **架构约束**：
  - `CrawlerService` 写入视频时，读取来源站点的 `ingest_policy`，以此决定新内容的初始 `visibility_status` 和 `review_status`
  - `allow_auto_publish` 替代全局 `AUTO_PUBLISH` 环境变量；环境变量作为全局兜底保留，但优先级低于站点级配置
  - Admin Sites tab 提供 `ingest_policy` 的可视化编辑入口
  - `videos.ingest_policy_override JSONB`（单视频级覆盖）属于 P2，不在本次 migration 实现
- **影响文件**：`src/api/db/migrations/018_*.sql`，`src/api/services/CrawlerService.ts`，`src/components/admin/system/crawler-site/CrawlerSiteManager.tsx`

_新增 ADR 时，在此文件末尾追加，不修改已有条目。_

## ADR-020: 跨站视频去重合并策略（Video Merge Rules）

- **日期**：2026-03-25
- **状态**：已实现（CHG-38，CrawlerService.upsertVideo）
- **背景**：
  - 多个来源站点可能收录同一部视频（相同标题、年份、类型）
  - 若每个来源都创建独立 `videos` 记录，会导致重复内容、分散播放源、搜索结果冗余
  - 需要定义"何时视为同一视频"及"合并时元数据以谁为准"
- **决策**：采用五条规则（A~E）实现确定性合并

  ### 规则 A — 合并键（Match Key）
  以 `(title_normalized, year, type)` 三元组为合并键：
  - `title_normalized` 由 TitleNormalizer 标准化（去标点、统一简繁、去常见后缀），确保"进击的巨人"与"進撃の巨人"能匹配
  - `year` 为 NULL 时不参与匹配（防止无年份数据的源站误合并）
  - `type` 不同（如 movie ≠ series）不合并，即使标题相同

  ### 规则 B — 标题标准化
  爬虫写入前，调用 `normalizeTitle(title)` 生成 `title_normalized` 写入 DB。
  标准化函数位于 `src/api/services/TitleNormalizer.ts`。

  ### 规则 C — 别名追踪
  每次爬虫写入（无论新建还是合并到已有视频），将原始 `title` 和 `titleEn` 写入 `video_aliases` 表（INSERT ON CONFLICT DO NOTHING）。
  这样可追踪"同一视频在不同平台的不同名称"，也是 video_aliases 合并率统计的数据来源。

  ### 规则 D — 元数据优先级
  来源优先级：`tmdb(4) > douban(3) > manual(2) > crawler(1)`。
  低优先级来源不覆盖高优先级来源已写入的元数据（cover_url、description、year 等）。
  当前所有来源均为 crawler，故暂时所有合并视频均跳过元数据覆盖；当 Douban/TMDB 同步到来时自动生效。

  ### 规则 E — 播放源去重
  `video_sources` 唯一约束为 `(video_id, episode_number, source_url) NULLS NOT DISTINCT`。
  重复 URL 的来源使用 `ON CONFLICT DO NOTHING`，不覆盖已有播放源。

- **理由**：
  - 三元组匹配覆盖约 90% 的同片场景，误合并率极低（不同类型强制隔离）
  - video_aliases 提供可审计的合并历史，管理员可通过内容质量统计查看合并率
  - 优先级机制为未来引入 TMDB/Douban 元数据预留扩展点，无需改变 schema
- **架构约束**：
  - 合并逻辑集中在 `CrawlerService.upsertVideo()`，禁止在其他地方绕过合并逻辑直接插入 videos 表
  - 若需手动调整合并结果（如错误合并），应通过管理后台的 video 编辑接口修改，而非直接 SQL 修改
  - 合并率统计通过 `GET /admin/analytics/content-quality` 的 `aliasCount` 字段获取
- **影响文件**：`src/api/services/CrawlerService.ts`，`src/api/services/TitleNormalizer.ts`，`src/api/db/migrations/007_video_merge.sql`
