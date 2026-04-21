# Resovo（流光） — 架构决策记录 (ADR)

> status: active
> owner: @engineering
> scope: architecture decision records
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18
>
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

---

## ADR-CHG-308 — 删除 ColumnSettingsPanel，统一使用 TableSettingsPanel（useTableSettings + settingsSlot）

- **日期**：2026-03-28
- **决策**：删除 `src/components/admin/shared/table/ColumnSettingsPanel.tsx`，所有后台数据表格的列可见性设置统一迁移到 `useTableSettings` hook + `ModernDataTable` 的 `settingsSlot` prop 模式
- **背景**：
  - `ColumnSettingsPanel` 是一个手写的列可见性面板，需要各个表格自行管理 `showColumnsPanel` state、`visibleColumnIds` useMemo、内联 ⚙ 按钮定位逻辑（absolute overlay），重复 6+ 处，违反"三处重复即提取"规则
  - SEQ-20260328-42 完成了统一替换：UserTable、SubmissionTable(sources)、SubmissionTable(content)、VideoTable、InactiveSourceTable、CrawlerSiteManager、AdminAnalyticsDashboard、SubtitleTable 全部迁移完成
- **替代方案**：`useTableSettings` hook（`admin:table:settings:{tableId}:v1` localStorage 存储，支持单次迁移旧 key）+ `TableSettingsPanel`（portal 渲染，⋮ 触发，矩阵布局）+ `settingsSlot` prop（`ModernDataTable` 右上角定位）
- **CSS 变量范围**：`TableSettingsPanel` 使用 admin 变量体系（`--bg2`、`--border`、`--text`、`--muted`、`--accent`），与前台体系（`--background`、`--foreground` 等）并存，各自适用于对应域
- **影响文件**：`src/components/admin/shared/modern-table/settings/`（新增），所有上述表格组件文件（修改），`ColumnSettingsPanel.tsx`（删除）

---

## ADR-021: 后台 UI 治理策略调整 — 从 Phase 顺序推进改为双轨并行

- **日期**：2026-03-28
- **状态**：已采纳
- **背景**：
  - `ui_governance_plan_frontend_admin_20260327.md` 定义了 Phase 0→1→2→3→4→5 的顺序推进方案
  - SEQ-20260328-42 完成后发现：在 Phase 1（tokens 基线）建立之前就推进 Phase 3（后台表格治理）是务实选择，但遗留了两类问题：
    1. **双重 hook 共存**：大多数迁移表格（VideoTable、SubmissionTable×2、UserTable、InactiveSourceTable、AdminAnalyticsDashboard）仍同时运行 `useAdminTableColumns` + `useAdminTableSort`（用于列宽存储和排序状态）+ `useTableSettings`（新系统，负责列可见性）。根因：`useTableSettings` 不支持列宽持久化；`useAdminTableSort` 依赖 `useAdminTableColumns` 的 `columnsState`。
    2. **AdminTableFrame 未退场**：`AdminCrawlerPanel`、`CacheManager`、`PerformanceMonitor` 三个组件仍使用旧基座，违反 CLAUDE.md 后台表格规范 #1。
  - Phase 1（tokens 基线）属于架构性重建，涉及 `globals.css`、全量 Tailwind 配置、所有组件样式，在项目业务仍快速迭代阶段风险过高。

- **决策**：放弃严格的 Phase 顺序，采用双轨并行推进：

  ### 轨道 A（近期）：后台治理完成
  完成 SEQ-20260328-42 遗留的两类问题：
  1. 迁移剩余 3 个 AdminTableFrame 用户 → ModernDataTable（CHG-309~311）
  2. 解耦 `useAdminTableSort` 对 `useAdminTableColumns` 的依赖（CHG-312）
  3. `useTableSettings` 加入列宽持久化（CHG-313）
  4. 删除 `useAdminTableColumns` + `useAdminTableSort`（CHG-314，依赖 312+313）

  ### 轨道 B（长期，低优先级）：轻量级 Tokens 基线
  不做全局 tokens 重建，只做：
  1. 盘点并补全 admin / 前台 CSS 语义变量的缺失对齐项，建立统一变量文档（CHG-315）
  2. 建立 ESLint 规则禁止新增硬编码颜色值（CHG-316），防止 debt 继续扩散

- **轨道 A 完成标准**：
  - `AdminTableFrame` 无任何业务消费方
  - `useAdminTableColumns` 无任何业务消费方
  - `useAdminTableSort` 无任何业务消费方
  - 所有后台表格的列可见性、列排序、列宽均由 `useTableSettings` 一个 hook 管理

- **轨道 B 完成标准**：
  - 前后台 CSS 变量体系差异有文档记录，缺失项已补全
  - ESLint 规则已上线，禁止在 `src/components/admin/` 中硬编码颜色值
  - 不要求全量迁移既有颜色值（存量 debt 通过自然迭代逐步消化）

- **不做的事**：
  - 不推进 Phase 2（ListPageShell 等模式层），直到轨道 A 完成、项目业务模块基本稳态
  - 不强制要求存量页面立刻接入统一 tokens（新增页面强制，存量在迁移时顺手修正）

- **影响文档**：`docs/ui_governance_plan_frontend_admin_20260327.md`（第 17 章修正），`docs/task-queue.md`（SEQ-20260328-43、SEQ-20260328-44）

---

## ADR-022: 设计 Token 单一真源与 Base + Brand 分层模型

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 当前颜色、字号、间距散落在 Tailwind 配置和各组件 class 中，改动需同时 diff 多处，且浅色过白、深色不够精致的根因是 Token 缺失
  - 已确认未来支持多品牌皮肤（形态 A），Token 体系必须从 day 1 支持"基础层 + 品牌层"分层，避免后期反悔重构
  - 用户已明确不使用 Figma，希望在自建后台内集中可视化编辑
- **决策**：
  - 采用 **W3C Design Tokens Community Group** 规范的 JSON 作为所有设计值的单一真源
  - 采用 **Base + Brand 两层** 文件布局：`packages/design-tokens/base.tokens.json` + `packages/design-tokens/brands/<brand>.tokens.json`
  - 基础层内部分 **Primitive / Semantic / Component** 三子层，层间引用单向：Semantic 只能引 Primitive，Component 只能引 Semantic 或 Primitive，禁止反向依赖
  - 每个颜色 Token 的 `$value` 为对象 `{ light, dark }`，双主题单文件存储，避免新增 Token 时漏加深色值
  - 按 **品牌 × 主题** 组合构建独立 CSS 文件（如 `dist/resovo.light.css` / `dist/resovo.dark.css`），运行时只加载当前品牌 × 主题一份
- **理由**：
  - W3C 格式未来接入任何标准工具（Style Dictionary / Tokens Studio 等）零成本
  - 两层分离让新增品牌不碰基础层，合并逻辑清晰
  - 双主题同文件降低"改值时遗漏一套"的错误概率
  - 按组合构建让运行时加载最小，不在一份 CSS 中穷举所有品牌
- **架构约束**：
  - 品牌层禁止直接覆盖 Primitive 层数值；只能覆写 Semantic 引用目标 + Component 个别字段 + 新增 `brand/*` 专属 Token
  - 品牌层允许覆写的 Semantic / Component 字段列入白名单（见 `design_system_plan_20260418.md` 第 4.3 节），白名单外字段要覆盖需走 base 的 PR
  - Token 新增 / 重命名 / 删除只能通过代码 PR，不得由后台编辑功能完成（后台只改值）
  - 基础层 Primitive 子层字段值"种子版本"可由工程师提交，后续由"锁结构 + 种子值 + 迭代收敛"策略在组件接入后 1-2 天内定稿（见 `design_system_plan_20260418.md` 第 4.7 节），定稿时生成 `packages/design-tokens/tokens.lock.json` 锚定所有值
- **影响文件**：`packages/design-tokens/**`、`tailwind.config.ts`、`postcss.config.mjs`、`src/app/layout.tsx`、`src/styles/tokens.css`

---

## ADR-023: Token 消费方式 — CSS 变量 + Tailwind 桥接（不走 CSS-in-JS）

- **日期**：2026-04-18
- **状态**：已采纳
- **决策**：
  - Token 最终以 CSS 自定义属性（CSS 变量）形式暴露给运行时
  - Tailwind 作为工具类基础保留；`tailwind.config.ts` 的 `theme.extend` 从构建产物 `dist/tailwind.tokens.ts` 读取 Token 名称 → CSS 变量映射
  - 组件代码使用 Tailwind 语义类（如 `bg-surface-base`），编译为 `background-color: var(--color-surface-base)`；组件本身品牌无关
  - 运行时主题与品牌切换通过替换 `<link rel="stylesheet">` 的 CSS 文件（或切换 `data-brand` / `data-theme` 属性激活不同作用域），零 JS 成本
- **理由**：
  - CSS-in-JS 方案（Emotion / styled-components）有运行时成本，SSR 水合复杂
  - Tailwind Plugin 方案需要在构建期把 Token 编入类名，失去运行时切换能力
  - CSS 变量 + Tailwind 桥接是零运行时、SSR 友好、切换零 JS 的最佳组合
- **架构约束**：
  - 组件不得硬编码颜色值（已是 CLAUDE.md 绝对禁止项）；同样不得硬编码字号、radius、shadow 等可 Token 化的数值
  - 不得引入 CSS-in-JS 库或 `styled-components` / `emotion` 依赖（违反 CLAUDE.md 技术栈白名单）
  - 新增 Token 时必须同时更新 `dist/tailwind.tokens.ts` 的产出脚本，保证 Tailwind IntelliSense 可用
  - ESLint 规则（后续任务）禁止 `className` 中出现色相硬编码（如 `bg-white` / `bg-gray-900`），强制使用语义 Token 类
- **影响文件**：`tailwind.config.ts`、`postcss.config.mjs`、`src/styles/tokens.css`、`src/components/shared/**`（迁移时涉及）

---

## ADR-024: 主题与品牌上下文正交独立 + SSR 首屏无闪烁

- **日期**：2026-04-18
- **状态**：已采纳
- **决策**：
  - 主题（`light` / `dark` / `system`）与品牌（`resovo` / future brands）是两个正交维度：同品牌可切明暗，同主题可切品牌
  - 主题存储：`localStorage.resovo.theme` + Cookie 同名同值（30 天过期，`SameSite=Lax`），Cookie 不区分品牌（跨品牌主题偏好一致）
  - 品牌识别链（优先级从高到低）：域名映射 → `?brand=` query → Cookie → 默认 `resovo`，由 Next.js middleware 统一执行，识别结果写入 Cookie `resovo.brand`
  - Root Layout Server Component 读取两个 Cookie，设置 `<html data-brand data-theme>` + 动态加载对应 CSS 文件，React tree 首屏即有正确品牌上下文，无水合闪烁
  - 在 `<head>` 注入 blocking inline script（`localStorage` 优先、`matchMedia` 兜底），在任何 CSS 加载前设置 `data-theme`，消除 client-side 首屏闪烁
- **理由**：
  - 主题切换与品牌切换在产品语义上独立（深色模式是用户偏好，品牌是业务维度），强绑定会导致设置冲突与用户困惑
  - 两个维度各自通过 `data-*` 属性激活对应 CSS 作用域，组合数量可控（主题 2 × 品牌 N × 文件 1）
  - Cookie + blocking script 双保障：SSR 场景 Cookie 负责正确首屏 HTML，CSR 场景 blocking script 负责 reload 时无闪烁
- **架构约束**：
  - 任何读取主题状态的代码必须经 `useTheme()` hook（基于 `ThemeContext`），禁止直接读 `localStorage` / `matchMedia`
  - 任何读取品牌状态的代码必须经 `useBrand()` hook（基于 `BrandContext`），禁止在组件内硬编码品牌字符串（如 `'Resovo'`）
  - middleware 中品牌识别失败时回落到默认品牌，不得返回 5xx
  - blocking script 的 JS 代码必须手写最小版本，不依赖任何运行时或 bundler（已在 `design_system_plan_20260418.md` 第 7.3 节给出示例）
  - 主题切换控件形态统一为 Segmented Control 三段（`☀️ 浅 | 🌓 自动 | 🌙 深`），配合 View Transitions API 做圆形扩散过渡
- **影响文件**：`src/middleware.ts`、`src/app/layout.tsx`、`src/components/shared/theme/**`、`src/components/shared/brand/**`、`src/lib/theme/**`、`src/lib/brand/**`

---

## ADR-025: 多品牌架构形态 A 优先 + 运营位品牌隔离

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 用户确认未来会支持多品牌，但本轮只实装单一品牌 Resovo
  - 需要决定"架构做到多大"与"运行时做到多少"
  - 多品牌落地有三种主要形态：同库存同源码多皮肤（A）、单实例多租户（B）、多站点独立数据（C）
- **决策**：
  - **本轮目标形态 A**：所有品牌共享同一内容库存、同一 Next.js 实例、同一套部署，仅在视觉 Token（通过 Brand 层）与运营位配置层面做差异化
  - **架构必须到位的能力**（本轮全部落地）：
    - Token 层 Base + Brand 分层（见 ADR-022）
    - `BrandProvider` 全局上下文与 middleware 品牌识别链（见 ADR-024）
    - Token CSS 按 brand × theme 组合构建
    - 所有"品牌触点"字段（Logo / ICP / 客服 / 社交 / 页脚版权）统一从 `useBrand()` 读取
  - **数据隔离策略**：
    - `videos` / `episodes` / `video_sources` 等内容主表 **不加** `brand_scope` 字段，内容在形态 A 下全站共享
    - 运营位类表（`home_banners` / `home_modules` / `promoted_collections` 等，现存与新增）统一加 `brand_scope` 字段，enum `'brand-specific' | 'all-brands'`，查询 `WHERE (brand_id = ? OR brand_scope = 'all-brands')`
    - 用户偏好 / 历史 / 收藏等账号相关表延后到用户系统上线时再评估
  - **形态 B 的升级路径预留**：未来需要真正多租户隔离时，通过新增 `content_brand_visibility` 关联表（多对多）实现内容层面的品牌可见性控制，不需要给 `videos` 加字段
- **理由**：
  - 形态 A 在单一部署下用最小运行时成本实现多品牌门面，匹配中小团队资源与国际化视频索引站的商业模式
  - 运营位加 `brand_scope` 是品牌化的真正价值点（每个品牌可定义自己的首页推荐），而内容库存共享是"架构到位、实现单一"的前提
  - 内容表不加 `brand_scope` 避免字段冗余 + 降低未来形态 B 的迁移成本
- **架构约束**：
  - 不得在 `videos` / `episodes` / `video_sources` 上添加 `brand_scope` / `brand_id` 字段
  - 所有现存或新增的"运营位类"表必须包含 `brand_scope TEXT NOT NULL CHECK (IN ('brand-specific', 'all-brands'))` 字段；`brand-specific` 需配套 `brand_id` 字段
  - 任何"需要按品牌差异化展示"的组件必须通过 `useBrand()` 读取品牌上下文，禁止在组件内硬编码品牌判断（如 `if (hostname === 'resovo.com')`）
  - 品牌相关业务决策（如是否允许某品牌独享某内容）必须走架构决策扩展，不得在本 ADR 外擅自添加品牌字段
- **影响文件**：`packages/design-tokens/brands/**`、`src/lib/brand/**`、`src/middleware.ts`、`src/api/db/migrations/`（运营位表新增 `brand_scope` 字段的 migration）、`docs/architecture.md`（需同步品牌识别链与数据隔离策略）

---

## ADR-026: 播放器提升至 Root Layout + Zustand 单例 + 三态形态

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 现有播放器挂载在播放页组件树内，离开播放页则卸载，无法实现"App-like 的边看边逛"
  - 用户明确要求"播放器提升到 root layout"以支持路由切换时播放不中断
- **决策**：
  - 播放器宿主 `<GlobalPlayerHost>` 挂在 Root Layout，永久存在于 DOM；通过 portal 目标位置固定渲染
  - 播放状态由 **Zustand 单例 store** 持有（`currentVideo / playbackTime / isPlaying / mode / queue`），不受路由切换影响
  - 三种形态：
    - `full`：全屏 / 影院模式，占视口（播放页与沉浸模式）
    - `mini`：移动端悬浮于底部 Tab Bar 之上（Spotify 模式，56px 高，下滑收起为一行"正在播放"胶囊）；桌面端右下角浮窗（320×180）
    - `pip`：浏览器原生 Picture-in-Picture
  - 形态切换动画：`full ↔ mini` 使用 FLIP（scale + translate，220–360ms）；`mini → close` 淡出 160ms 后卸载音视频源
  - 路由行为：离开播放页默认转 `mini`；再次进入同一视频 `mini → full`；不同视频替换时弹 ConfirmDialog "替换当前播放？"
- **理由**：
  - 播放器不卸载是实现"边看边逛"的前提；Zustand 单例避免 Context re-render 级联
  - Mini 态采用 Spotify 叠加模式（浮于 Tab Bar 之上）是行业公认最佳实践；叠加总高度约 124px 仍留足主内容区，避免"正在播放"与"导航"争夺同一物理区域
  - `<GlobalPlayerHost>` 强制 `'use client'` + `dynamic(..., { ssr: false })` 避免 SSR 水合播放器造成复杂度爆炸；页面本身仍可 SSR，播放器在 hydration 后接管
- **架构约束**：
  - 播放器业务逻辑必须集中在 shell 层（编排字幕 / 线路 / 影院模式等），core 层不写业务逻辑（与 CLAUDE.md 既有约束一致）
  - 任何读取播放状态的代码必须经 `usePlayerStore()`，不得通过 props 自顶向下传递或使用全局变量
  - Mini 态在移动端 `visibilitychange` 时降级码率或只播音频（耗电优化）
  - 播放器关键路径（断点续播 / 线路切换 / 影院模式 / 字幕开关）每次涉及必须完整回归测试
  - z-index 层级通过 Token 约束：`z/pip-player = 80`、`z/modal = 60`、`z/toast = 70`，禁止在组件内硬编码 z-index 值
- **影响文件**：`src/components/player/GlobalPlayerHost.tsx`、`src/stores/playerStore.ts`、`src/app/layout.tsx`、`src/components/player/**`（所有涉及形态切换的子组件）

---

## ADR-027: 页面过渡四分类模型（Sibling / Push / Takeover / Overlay）

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 用户要求网站交互"更像 App，不是传统浏览网页"，需要定义可复用、边界清晰的过渡语法
  - 不同页面关系（平级 / 下钻 / 焦点 / 叠加）若都用一套过渡会失去层级感
- **决策**：
  - 将站内所有页面过渡归入四类，每类有固定语义、缓动曲线、时长区间：
    - **类型 A · 同层平移（Sibling）**：一级页面之间（首页 ↔ 分类 ↔ 搜索），左右滑入滑出 240–300ms
    - **类型 B · 层级下钻（Push + Shared Element）**：列表 → 详情，卡片作为共享元素飞入，其余内容交错淡入 320–420ms
    - **类型 C · 焦点沉浸（Takeover）**：详情 → 播放 / 浅色 ↔ 深色主题切换，圆形扩散或叠透进场 420–520ms
    - **类型 D · 叠加层（Overlay）**：Dialog / BottomSheet / 抽屉，从锚点位置向外展开 200–240ms
  - 技术栈：**View Transitions API 为首选实现**，不支持的浏览器降级为 Framer Motion FLIP 动画
  - 每种过渡的反向动画（返回 / 退出）是正向的镜像，不自行定义新曲线
  - `prefers-reduced-motion` 开启时所有过渡退化为交叉淡入（150ms 内），保留层级提示但降低运动强度
- **理由**：
  - 四分类覆盖站内已规划的所有页面切换场景，不多不少
  - View Transitions API 是 Chrome 111+ / Safari 18+ 标准，未来两年内会覆盖主流浏览器，直接 bet 在标准上成本最低
  - Framer Motion 仅在降级路径使用，避免成为主依赖（和 CLAUDE.md 技术栈约束对齐）
- **架构约束**：
  - 任何新增页面 / 路由必须明确归入四类中的一类，由 `<RouteStack>` 原语统一调度，禁止组件各自实现 transition
  - 过渡时长与缓动曲线从 Token 读取（`motion/duration/*` + `motion/easing/*`），不得硬编码 ms 数值
  - 共享元素过渡需要给源组件和目标组件标注相同的 `data-transition-name` 属性（View Transitions API 约定）
  - 过渡动画完成前禁止触发下一次导航（由 `<RouteStack>` 内部 debounce 实现）
  - 所有包含大运动量的过渡（类型 C）必须在 `prefers-reduced-motion` 下完全退化，测试用例必须覆盖
- **影响文件**：`src/components/shared/transitions/RouteStack.tsx`、`src/lib/motion/**`、`src/app/layout.tsx`、`src/components/shared/shared-element/**`

---

## ADR-028: 图片治理四级降级链 + 入库健康治理

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 现阶段图片主要跟随视频源第三方抓取，画质不佳且不稳定；未来会丰富来源但短期内仍需容忍不可靠的源站
  - 用户接受 **P0 必填 + P1 尽力** 的分级策略；首页若因源站抖动大面积破图是强业务风险
- **决策**：
  - **四级降级链**（按优先级从高到低）：
    1. 真实图片（`poster_url` 等）经 `<SafeImage>` 渲染
    2. BlurHash 占位（30 字节，入库时计算，首屏即可展示）
    3. `<FallbackCover>` 运行时 SVG（品牌调色盘 + video_id 种子 + 类型装饰，确定性生成）
    4. CSS 纯色渐变（极端兜底，覆盖率 100%）
  - **入库治理字段**（`videos` / `episodes` 表扩展，详见 `image_pipeline_plan_20260418.md` 第 5 节）：
    - 每类图片字段成组出现：`*_url / *_blurhash / *_primary_color / *_status / *_source`
    - 状态 enum：`ok | missing | broken | low_quality | pending_review`
  - **新增 `broken_image_events` 表** 记录所有图片健康异常事件（fetch_404 / fetch_5xx / timeout / decode_fail / dimension_too_small / mime_mismatch / aspect_mismatch），支持后台仪表盘聚合
  - **定时 job**：
    - `image_health_check`：每日 03:00 HEAD 请求 + 尺寸 / aspect 校验，异常写 `broken_image_events`
    - `blurhash_and_color_extract`：新入库 / 变更时计算 BlurHash + OKLCH 主色
  - **前端失效上报**：`<SafeImage>` 渲染失败时通过 `navigator.sendBeacon()` 异步上报到专用端点 **`POST /api/internal/image-broken`**（新建，不复用 Sentry）；后端 10 分钟窗口去重（同 session × 同 URL 只记一次）后写入 `broken_image_events`
  - **剧集缩略图本轮纯抓取**，播放器截帧方案延后至 V2（依赖自有视频源或转码中间层）
  - **Logo 透明 PNG**：TMDB `/images/logos` 纳入 `external_metadata_import` 流程，填充已有的 `videos.logo_url / logo_status` 字段
- **理由**：
  - 四级降级确保"任何场景下都不出现空白图片"，这是"现代感 + App-like"观感的底线
  - 专用 beacon 端点与错误监控解耦：图片失效是业务指标（进仪表盘、需聚合、关联 video_id），不是错误日志
  - SVG 样板图采用 Token 驱动（品牌调色盘）+ 确定性 seed（相同 video_id 永远得相同图），兼顾品牌感与可预测性
  - 截帧方案需要 CORS 打通与服务端解码能力，本轮条件不成熟，fallback 链已足够覆盖
- **架构约束**：
  - 所有图片渲染必须经 `<SafeImage>` 组件，禁止直接使用 `<img>` 或裸 `next/image`（除非明确为品牌 Logo / 静态资源等无需治理的图）
  - `poster_url` 为 P0 必填；其他字段为 P1 尽力，但对应 `*_status` 必须写入 enum 值之一，不得为 NULL
  - 前端 beacon 上报必须去重（同一 session × 同 URL 只上报一次），避免上报风暴
  - 健康巡检 job 失败次数连续超过阈值时必须 fail-loudly（触发 BLOCKER），不得静默
  - 禁止将错误日志（Sentry 级）与图片失效事件混在同一张表 / 同一个端点
- **影响文件**：`src/components/shared/image/SafeImage.tsx`、`src/components/shared/image/FallbackCover.tsx`、`src/api/routes/internal/image-broken.ts`、`src/api/services/ImageHealthService.ts`、`src/api/jobs/imageHealthCheck.ts`、`src/api/jobs/blurhashExtract.ts`、`src/api/db/migrations/`（新增 image 字段与 `broken_image_events` 表）、`docs/architecture.md`（Schema 需同步）

---

## ADR-029: 图片分发基础设施 — Cloudflare Images + R2

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 目标用户海外为主，不考虑国内大陆；初期部署 Vercel，稳定后迁移 Cloudflare Pages
  - 图片管线设计了 `ImageLoader` 抽象但未确定具体后端
- **决策**：
  - **CDN 与图片变换**：统一使用 **Cloudflare Images**。Loader 实现基于其 URL 参数约定（`?width=&quality=&format=auto`）；其他候选（imgix / 阿里云 IMG / 自建 imgproxy）若未来需要只需替换 URL 模板
  - **对象存储**：统一使用 **Cloudflare R2**（零出站费用，S3-compatible），通过 `FileStorage` 抽象暴露给业务代码；本地开发使用 **MinIO** 作为 S3-compatible 后端
  - **`next/image` 配置**（Vercel 阶段关键）：
    - `images.loader = 'custom'` + `images.loaderFile = './src/lib/image/loader.ts'`
    - **禁用 Vercel 默认 optimizer**，避免二次变换与多余带宽计费
    - 保留 `next/image` 的 lazy-loading / srcset / priority 调度等原生能力
  - **抓取的第三方图**暂不落盘 R2，直接经 Cloudflare Images 的 "Transform external images" 能力做 fetch-and-transform；运营上传的原图写入 R2 私有 bucket，前端展示时通过同账户 Cloudflare Images 分发
  - **多尺寸策略**：Cloudflare Images 接入后统一走动态参数模式，前端按视口计算 `width`；字段 `poster_url_sm / md / lg` 不再需要
- **理由**：
  - Cloudflare Images + R2 组合在海外为主 + Cloudflare 迁移路径下是最干净的选择：变换、分发、存储同一生态，零出站费匹配图片密集型站点
  - 迁移至 Cloudflare Pages 时一切原生，无代码改动；Vercel 阶段只是把 Cloudflare Images 当外部服务使用
  - Loader 抽象 + FileStorage 抽象确保未来替换 CDN 或存储后端零业务代码改动
- **架构约束**：
  - 业务代码不得直接拼 Cloudflare Images 的 URL，必须经 `loader()` 函数；不得直接调用 R2 SDK，必须经 `FileStorage` 抽象
  - 生产环境 `next.config.ts` 必须使用 `images.loader = 'custom'`，禁止回落到 Vercel 内置 optimizer
  - 运营上传永远走 `FileStorage.put()`，禁止直接写本地磁盘（单机部署同样不得，R2 / MinIO 双后端从 day 1 生效）
  - CI / 测试环境必须使用 MinIO 或内存 mock，不得依赖真实 Cloudflare 账户
  - 未来如需切换 CDN（imgix / 阿里云 / 自建），只改 `cloudflareLoader` 的 URL 拼接规则，业务代码零改动
- **影响文件**：`src/lib/image/loader.ts`、`src/lib/storage/**`、`next.config.ts`、`src/api/services/UploadService.ts`、`docs/architecture.md`（需同步 CDN 与存储方案）

---

## ADR-030: 重写期 SSR/SEO 降级与风险边界策略

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 前端重写期（M0–M6）同时推进三项高风险改造：设计系统 Token 化、播放器提升至 Root Layout Portal（ADR-026）、页面过渡动画接入 View Transitions API（ADR-027）。三者都在"客户端渲染 / 首屏 SSR / 平台运行时"这条最敏感的路径上叠加。
  - 风险登记表（`docs/risk_register_rewrite_20260418.md`）已识别出三条具体风险：Portal 化对 `/watch/[slug]` SSR 元数据的污染（RISK-01）、Cookie-based 品牌 middleware 对 Edge 冷启动的延迟（RISK-02）、View Transitions 在 Safari < 18 的兼容性（RISK-03）。任一风险失控都会让站点在重写期出现明显的业务退化（SEO 降级、TTFB 劣化、路由白屏）。
  - 此前的 ADR 只对"目标形态"作了规定，缺一份明确的"降级边界"——即哪些行为必须保留可回退路径、哪些依赖绝不允许引入、哪些阈值触发自动回滚。本 ADR 固化三项风险的降级策略，让主循环在实现阶段有刚性约束可依循。
- **决策**：
  - **RISK-01 · Portal 化不得污染 head metadata**：
    - OG tags（`og:title` / `og:video` / `og:image` 等）与 `schema.org VideoObject` 的 JSON-LD **必须**在服务端 `generateMetadata()` 或 Server Component 的静态输出中生成，数据源直接读 DB/cache，不得依赖任何客户端 Portal 组件或 Zustand store。
    - `GlobalPlayerHost` Portal **只负责播放器 DOM 挂载与播放态控制**，**不得** render 任何影响 head 的 `<meta>` / `<script type="application/ld+json">` / `<title>`；违反即视为架构回归。
    - **明确不选**：不把 meta 数据交给客户端 hydration 后补齐（即使技术上可行，会破坏爬虫抓取与分享预览）。
  - **RISK-02 · Edge middleware 品牌识别硬上限 5ms**：
    - Edge middleware 品牌识别分支**必须只做 cookie parse + in-memory 查表**，单次执行 < 5ms；**禁止** fetch / DB / KV / JWT 验签等一切 I/O 或阻塞操作。
    - Cookie 缺失或解析失败时**不得阻塞请求**，直接 fallback 到默认品牌 `resovo`；品牌识别失败不是错误路径，而是预期降级路径。
    - **明确不选**：不引入远程 KV（Upstash / Vercel KV）做品牌配置查询；不在 middleware 中做会员身份或 AB 分桶判断（这些应放 Server Component 或 Route Handler）。
  - **RISK-03 · View Transitions 强制 feature detection，禁止 polyfill**：
    - 所有调用点**必须**使用 `if ('startViewTransition' in document) { ... } else { router.push(...) }` 的 feature detection；未命中分支直接走无动画瞬切路径，**不得**抛错、不得打开 loading overlay 遮盖真实内容。
    - 降级路径由 `<RouteStack>` 统一封装，业务组件不得绕过该原语直接调用 View Transitions API。
    - **明确不选**：不引入任何 View Transitions polyfill（现有候选体积 ≈ 25KB 且运行时性能不佳，对重写期 bundle size 预算不合算）；不用 Framer Motion 模拟 View Transitions（ADR-027 已规定 Framer Motion 仅作为 FLIP 降级路径，不用于填 API 空洞）。
- **理由**：
  - 三项决策都遵循同一原则：**高风险路径必须有可回退的确定性分支**，且分支不依赖"运行时状态良好"的前提。
  - RISK-01 选择把 metadata 钉死在服务端静态路径，是因为 SEO 是长期业务指标，任何一次误操作都会带来排名损失且恢复周期长；Portal 重构可以回滚，但已被爬虫抓取的错误 meta 会污染索引数周。
  - RISK-02 硬上限 5ms 是经验值（Vercel Edge 冷启动基线 ≈ 15–30ms，middleware 内逻辑保留 5ms 上限可让 p95 稳定在 50ms 以下）；禁止 I/O 是对"中间件职责边界"的明确承诺，避免退化成"迷你 BFF"。
  - RISK-03 禁止 polyfill 是明确的 bundle-size vs 动画体验权衡：Safari 17 用户获得瞬切体验（功能不降级、只是无动画），而全体用户不必承担 polyfill 体积；feature detection 是 web 平台标准做法，未来 Safari 18 普及后分支会自然收敛。
- **架构约束**：
  - **HEAD metadata 与 Portal 解耦**：任何 route 的 `generateMetadata()` 或 Server Component 返回的 `<head>` 内容，**不得** import 任何带 `'use client'` 指令的模块。违反项由 CI lint 规则 `no-client-in-metadata` 阻断。
  - **禁止在 Portal 组件内 render head 元素**：`GlobalPlayerHost` 及其子树禁止出现 `next/head`、`<meta>`、`<script type="application/ld+json">`、`<title>`；由 ESLint 规则 `player-portal-no-head` 检测。
  - **Edge middleware I/O 禁令**：`middleware.ts` 内禁止出现 `fetch` / `db.` / `kv.` / `jose.verify` / `crypto.subtle.sign` 等 I/O 调用；由 lint 规则 `no-edge-side-io` 阻断；品牌识别耗时 > 5ms 必须触发 warning 日志并上报监控。
  - **品牌 fallback 默认化**：cookie 解析失败时必须 return 默认品牌 `resovo`，**禁止抛错或 redirect**；相关代码路径必须有 unit test 覆盖"cookie 缺失 / 格式异常 / 值越界"三种情形。
  - **View Transitions 调用收敛**：全项目仅允许 `src/components/shared/transitions/RouteStack.tsx` 直接调用 `document.startViewTransition`，其它文件禁止；由 lint 规则 `view-transitions-scope` 检测。
  - **禁止 View Transitions polyfill**：`package.json` 禁止出现任何名为 `view-transitions-polyfill*` 的依赖；由 CI `depcheck` 规则阻断。
  - **降级 e2e 必跑**：RISK-01 / RISK-03 对应的 Playwright 用例（禁用 JS 抓取 meta、Safari 17 WebKit channel 路由切换）是 `pnpm test:e2e` 的必经用例；未通过不得合并。
- **影响文件**：
  - `apps/web/src/app/[locale]/watch/[slug]/page.tsx`（`generateMetadata()` 静态化）
  - `apps/web/src/app/[locale]/watch/[slug]/VideoObjectJsonLd.tsx`（新建 / 提炼 Server Component）
  - `apps/web/src/components/player/GlobalPlayerHost.tsx`（移除任何 head 相关 render）
  - `apps/web/src/middleware.ts`（品牌识别 I/O 禁令实施）
  - `apps/web/src/components/shared/transitions/RouteStack.tsx`（feature detection 唯一入口）
  - `apps/web/eslint.config.mjs`（新增 `no-client-in-metadata` / `player-portal-no-head` / `no-edge-side-io` / `view-transitions-scope`）
  - `docs/risk_register_rewrite_20260418.md`（风险登记与状态跟踪）
  - `docs/architecture.md`（同步"metadata 由 Server Component 输出 + middleware I/O 禁令"至架构章节）

---

## ADR-031: 重写期代码共存与分支推进策略

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 前端重写期（M0–M6）涉及设计系统 Token 化、播放器提升至 Root Layout Portal（ADR-026）、页面过渡动画接入 View Transitions（ADR-027）三项结构性改造，以及三份配套方案（design_system / frontend_redesign / image_pipeline）。改动面覆盖几乎所有客户端代码路径。
  - 面对"大规模改写与既有站点共存"这一典型场景，行业常见三种策略：(A) 在仓库内平行维护 `src/redesign/` 等新子目录、双目录并存；(B) 通过 `ENABLE_REDESIGN=true` 之类 feature flag 同时运行新旧两套 UI，灰度切换；(C) 单线推进、新代码直接覆盖旧代码、通过分支与 Phase 合并节奏控制风险。
  - 本项目当前 git 策略已明确：`main` 作为稳定分支（Phase 完成才合并），`dev` 作为日常开发分支，不创建 feature 分支，Phase 完成时执行 `git merge dev --no-ff -m "feat: complete Phase N MVP"`。方案 A、B 与该单线策略存在根本张力，且本项目维护人力极为有限。需要一份 ADR 把这条推进路径固化下来，避免后续任务"顺手开一个 redesign 目录"或"顺手加一个 flag"侵蚀架构。
  - 该策略同时是 BASELINE-04 需求冻结通知的上位依据——冻结通知只是执行层动作，真正的架构承诺在本 ADR。
- **决策**：
  - **不开 `redesign/` 子目录**：重写代码直接覆盖旧代码，路径保持不变（`apps/web/src/components/...`、`apps/web/src/app/[locale]/...` 原位替换）。**禁止**新建 `apps/web/src/redesign/`、`apps/web/src/app-v2/`、`apps/web/src/components-new/` 等任何平行目录来存放"重写版本"。
  - **不使用 feature flag 双栈**：**禁止**通过 `ENABLE_REDESIGN` / `USE_NEW_UI` / `NEXT_PUBLIC_REDESIGN` 等环境变量或运行时开关同时运行新旧两套 UI。组件级短期 flag（单一任务内的开关，生命周期 < 1 个 Phase 且任务完成时必须移除）不在禁止之列，但"整套 UI 双栈"绝对不允许。
  - **单线 `dev` 分支推进**：M0 → M1 → M2 → M3 → M4 → M5 → M6 严格串行，任一 Phase 未达成合并条件前不得开始下一 Phase。Phase 内允许多 commit（每任务一次 commit），Phase 完成时以 `git merge dev --no-ff -m "feat: complete Phase N MVP"` 合并至 `main`，不创建 `feature/*` 或 `release/*` 分支。
  - **回滚策略**：发现无法向前推进（质量门禁失败、关键路径回归、风险登记表新增高危风险）时，**必须**使用 `git revert <commit>` 回滚，保留历史；**禁止**使用 `git reset --hard` / `git push --force` 销毁历史。回滚后在 `docs/changelog.md` 追加 revert 说明，记录被回滚 commit 的 SHA、回滚原因、后续计划。
  - **与 BASELINE-01 基线对接**：每个 Phase 合并 `main` 前，**必须**对照 `docs/baseline_20260418/critical_paths.md` 完整验证 6 条关键路径（首页加载 / 搜索 / 详情页 / 播放 / 登录注册 / 后台录入）。6 条全部通过是合并 `main` 的前置硬门禁，任一路径失败即视为 Phase 未完成，不得合并。
  - **需求冻结**：M0–M6 期间**禁止**接收与三份方案（`docs/design_system_plan_20260418.md` / `docs/frontend_redesign_plan_20260418.md` / `docs/image_pipeline_plan_20260418.md`）目标无关的新业务需求。新提出的业务需求统一记录到 `docs/task-queue.md` 末尾的"冻结期积压"区（新增 section），待 M6 完成后解冻处理；冻结期内不得将积压需求插队到进行中的 Phase。紧急线上 bug 修复不在冻结范围，但必须走独立 hotfix commit 且不引入新特性。
- **理由**：
  - **为何不选 A（`redesign/` 平行目录）**：平行目录在短期内"看起来安全"，但实际会造成三类持续成本——import 路径双份、类型定义双份、共享组件归属不清。本项目共享组件已有成熟沉淀（`src/components/shared/`、`src/components/admin/shared/`），平行目录会让 CLAUDE.md "新建前先确认已有实现"的约束失效，最终演变为两套不相容的组件森林。且当完成迁移时需要再做一次"redesign → 主目录"的大搬家，等于把重写工作量翻倍。
  - **为何不选 B（feature flag 双栈）**：双栈在本项目的唯一 dev 分支 + 唯一维护者模型下成本倍增——每个 PR 都要在两套 UI 上验证、每条关键路径 Playwright 用例要 × 2、Token 系统要同时服务新旧组件。ADR-026（播放器提升至 Root Layout）和 ADR-027（View Transitions）都假设"单一 UI 形态"，双栈会让这两条架构决策失去意义。此外 feature flag 的"遗忘成本"极高——历史项目多次出现 flag 上线数月后无人清理，成为技术债长期沉淀。
  - **为何选 C（单线覆盖 + Phase 合并）**：与现有 git 策略天然对齐；依赖 Phase 粒度的 BASELINE-01 关键路径门禁做风险控制，颗粒度已经足够细（6 个 Phase = 6 次门禁）；回滚路径由 `git revert` + changelog 提供，历史完整可追溯；配合 ADR-030 的降级边界（metadata / middleware / View Transitions 三条风险线），单线策略不会让单次失败影响超出一个 Phase 的范围。
  - **为何用 `git revert` 而非 `git reset --hard`**：`main` 分支一旦 push，历史是共享合约；`reset --hard` 会让其它机器（未来可能的协作者、CI 缓存、Vercel 部署历史）出现 ref 漂移。`revert` 生成新 commit，历史线性可读，事后审计（诸如"M3 的 Portal 化为什么被撤回"）有完整链路。
  - **为何需求冻结到 `task-queue.md` 末尾而非独立看板**：保留单一任务入口（CLAUDE.md 明确规定 `docs/tasks.md` + `docs/task-queue.md` 是任务的唯一入口），避免引入第二个任务源导致"任务在哪个文件"的歧义。末尾"冻结期积压"区只记录、不排期，与现有优先级区隔离。
- **架构约束**：
  - **禁止平行目录**：`apps/web/src/redesign/`、`apps/web/src/app-v2/`、`apps/web/src/components-new/`、`apps/server/src/redesign/` 等目录不得存在；由 CI 目录结构校验脚本（在 `scripts/check-repo-shape.ts` 中）阻断新增。
  - **禁止全局 UI 开关**：`.env*` 与 `next.config.ts` 中不得出现 `ENABLE_REDESIGN` / `USE_NEW_UI` / `NEXT_PUBLIC_REDESIGN` / `NEXT_PUBLIC_ENABLE_REDESIGN` 等命名的环境变量；由 lint 规则 `no-redesign-flag` 检测变量声明与读取。
  - **禁止 feature 分支**：`git push` 到 `origin/feature/*` / `origin/release/*` 必须被仓库侧的 branch protection 规则拒绝；本地短期分支可存在但不得推送。
  - **禁止历史销毁**：`main` 分支禁用 force push（`main` 与 `dev` 同步设置 branch protection `allow_force_pushes=false`）；任务完成后如需撤销，只能走 `git revert`。
  - **Phase 合并门禁**：`dev` → `main` 的合并 commit message 必须匹配 `^feat: complete Phase [0-6] MVP$` 正则；合并前必须存在对应 Phase 的 BASELINE-01 关键路径验证记录（在 `docs/changelog.md` 中以 `[PHASE-N-BASELINE-PASS]` 标记 6 条全通过）。
  - **Phase 串行**：M(N+1) 的首个任务卡（写入 `docs/tasks.md`）不得在 M(N) 合并 `main` 之前创建；`docs/task-queue.md` 中 M(N+1) 的任务状态在 M(N) 合并前必须保持 `pending`，不得转为 `in_progress`。
  - **冻结期积压区**：`docs/task-queue.md` 新增固定 section `## 冻结期积压（M0–M6 期间禁止开工）`，新业务需求仅写入此区；该 section 内任务的"建议模型"字段必须留空，防止误触发主循环领取。
  - **Revert 审计**：`git revert` 操作的 commit message 前缀必须为 `revert:`，正文须包含被回滚 commit 的短 SHA 与原任务 TASK-ID；`docs/changelog.md` 同步追加 `[REVERT]` 条目，列明回滚原因与是否进入重做队列。
  - **hotfix 例外**：紧急线上 bug 修复允许在冻结期推进，但必须在任务卡"执行模型"字段旁增加 `[HOTFIX]` 标记，且 commit message 以 `fix:` 起头（不得混入新特性）；hotfix 合并走 `dev` → `main` 正常路径，不开独立分支。
- **影响文件**：
  - `docs/task-queue.md`（新增"冻结期积压"section；所有 M0–M6 任务卡在"执行模型"字段对齐本 ADR 语义）
  - `docs/changelog.md`（新增 `[PHASE-N-BASELINE-PASS]` / `[REVERT]` / `[HOTFIX]` 条目规范）
  - `docs/baseline_20260418/critical_paths.md`（作为 Phase 合并硬门禁的唯一来源）
  - `docs/rules/workflow-rules.md`（Phase 串行、单线 `dev` 推进、需求冻结规则落地到工作流）
  - `docs/rules/git-rules.md`（`git revert` 优先、禁止 force push、Phase 合并 commit message 正则）
  - `scripts/check-repo-shape.ts`（新建 / 扩展，校验无平行 redesign 目录）
  - `apps/web/eslint.config.mjs`（新增 `no-redesign-flag` 规则）
  - `docs/architecture.md`（同步"重写期单线推进 + 冻结期积压"章节）


## ADR-032: `packages/design-tokens` 构建工具选型 — 手写 TS 构建脚本（零外部依赖）

- **日期**：2026-04-18
- **状态**：已采纳
- **子代理**：claude-opus-4-6（方案评估与决策）
- **背景**：
  - TOKEN-01 需要建立 `packages/design-tokens` 包，为 M1 设计系统提供 CSS 变量 + JS 常量 + TypeScript 类型三路出口
  - ADR-022 设定了"W3C Design Tokens JSON 格式为单一真源"，但项目有"禁止引入技术栈以外新依赖"的绝对约束
  - 候选方案：A（Style Dictionary v4）/ B（手写 TS 构建脚本）/ C（Tokens Studio CLI）
  - 项目为单人维护，无 Figma 设计师协作，无多平台（iOS/Android）产出需求
- **决策**：
  - **选方案 B（手写 TS 构建脚本，零外部依赖）**
  - Token 源文件以 **TypeScript `as const` 对象**定义（`src/primitives/*.ts`、`src/semantic/*.ts` 等），取代 ADR-022 中的 JSON 格式（见"对 ADR-022 的精化"节）
  - CSS 变量通过 `scripts/build-css.ts`（tsx 运行）从 TS 源文件派生，产物写入 `src/css/tokens.css`
  - 三路出口：`@resovo/design-tokens/css`（CSS 变量文件）/ `@resovo/design-tokens/js`（JS 常量）/ `@resovo/design-tokens/types`（TS 类型）
  - `exports` 字段在骨架阶段指向 `src/`，待 TOKEN-05 构建管道完善后迁移到 `dist/`
- **对 ADR-022 的精化**：
  - ADR-022 规定"W3C JSON 格式"，但当前项目不引入 Style Dictionary 的约束更强；TypeScript-first 方案满足同等目标：类型与值天然一致，无 JSON schema 漂移风险
  - 4 层目录结构（`primitives / semantic / components / brands`）与 ADR-022 的三子层 + 品牌层分层保持一致
  - 若未来接入 Figma / Tokens Studio，可在 `src/tokens/*.ts` 上游增加 JSON → TS 转换器，下游消费契约（exports 字段）保持稳定，无破坏性变更
- **理由**：
  - monorepo 已有 tsx / tsc 生态，延续既有工具链零学习成本、复用 turbo 缓存策略
  - 不引入新依赖，满足 CLAUDE.md 绝对禁止第 2 条
  - TS 对象 `typeof` 直接派生类型，类型与运行时值天然一致
  - CSS 生成脚本 < 150 行，完全可控可调试
- **不选原因**：
  - **方案 A（Style Dictionary v4）**：单人项目 + 无多平台输出需求，三层抽象（transform / format / filter）仅用到 < 10% 能力；且引入新依赖触发 BLOCKER
  - **方案 C（Tokens Studio CLI）**：无 Figma 插件、无设计师协作流程；引入云/外部依赖违反约束
- **架构约束**：
  1. **单一真源**：所有 token 必须在 `packages/design-tokens/src/` 中以 `as const` TypeScript 对象定义；**禁止**在 `apps/*` 直接定义 CSS 变量或颜色常量
  2. **三路出口不可绕过**：消费方只能通过 `@resovo/design-tokens/css`、`/js`、`/types` 三个入口；禁止深层相对路径（`src/...` 或 `dist/...`）穿透
  3. **CSS 变量与 JS key 同构**：CSS 变量名（如 `--color-primary-500`）必须与 JS 常量路径（`colors.primary[500]`）严格对应，由 `build-css.ts` 统一派生，禁止手写旁路注入
- **影响文件**：
  - 新增 `packages/design-tokens/`（全部）
  - 修改根 `package.json` workspaces（已含 `packages/*`，无需额外修改）
  - 消费方：`apps/web/src/app/globals.css`（M1 TOKEN-03 后引入 `@import '@resovo/design-tokens/css'`）


## ADR-033: BrandProvider API 契约与消费者约束

- **日期**：2026-04-18
- **状态**：已采纳，锁定
- **子代理**：arch-reviewer (claude-opus-4-6)（API 契约设计评审）
- **背景**：
  - ADR-024 确立"主题与品牌正交 + SSR 首屏无闪烁"的整体策略，但未锁定 Provider / hooks 的具体签名
  - TOKEN-09 需落地 `apps/web/src/contexts/BrandProvider.tsx` / `useBrand` / `useTheme`；M1–M6 大量消费者将依赖这三个契约
  - 必须通过 ADR 锁定 API，防止后续任务"顺手修改 hook 返回形状"破坏全站消费者
- **决策**：锁定以下 API 形状，任何变更必须通过新 ADR 或本 ADR 的 supersede 记录：
  1. `<BrandProvider initialBrand: Brand; initialTheme: 'light' | 'dark' | 'system'; children: ReactNode />`
  2. `useBrand(): { brand: Brand; setBrand: (slug: string) => void }`：`setBrand` 异步 fetch，失败仅 `console.error`，不抛、不回滚
  3. `useTheme(): { theme: 'light' | 'dark' | 'system'; resolvedTheme: 'light' | 'dark'; setTheme: (t) => void }`：样式条件必须用 `resolvedTheme`，不得用 `theme`
- **架构约束**：
  - DOM 同步唯一入口：消费者不得直接写 `document.documentElement.dataset.brand / dataset.theme`
  - 品牌切换唯一入口：必须通过 `setBrand(slug)`，禁止在组件内直接构造 Brand 对象
  - 两个 Context 分开提供；禁止引入第三个"合并 context"
  - `useSyncExternalStore` 的 `getServerSnapshot` 必须返回 initialBrand/initialTheme 对应快照
  - 未在 Provider 子树中调用 `useBrand`/`useTheme` 必须抛显式错误，不得静默兜底
  - API 签名定稿后不得在无 ADR 的情况下新增必填字段（可新增 optional 字段向后兼容）
- **非目标**：`setBrand` 的乐观更新、回滚、loading 状态暴露 —— 若后续需要另立 ADR
- **影响文件**：`apps/web/src/types/brand.ts`、`apps/web/src/contexts/BrandProvider.tsx`、`apps/web/src/hooks/useBrand.ts`、`apps/web/src/hooks/useTheme.ts`

---

## ADR-034: 详情页按类型分段 + `/watch/` 专注播放：双路由分治不合并

- **日期**：2026-04-18
- **状态**：已采纳
- **背景**：
  - 当前 `apps/web/src/app/[locale]/` 同时存在 5 条"详情页"路由（`movie` / `anime` / `series` / `variety` / `others`）与 1 条"播放页"路由（`watch`）。
  - 5 条详情页 page.tsx 皆走 `VideoDetailClient`（CSR）+ SSR `generateMetadata`，承担 OG tags / 标题 / 描述，是 SEO 入口。
  - `/watch/[slug]` 加载 `PlayerLoader → PlayerShell`（`ssr: false`），承担播放体验（断点续播、线路切换、影院模式、选集面板、弹幕）。
  - Phase 0 E2E "电影详情页" 测试组大量 `element(s) not found`：测试导航到 `/en/movie/[slug]` 期望 `data-testid="video-detail-hero"`，路由本身正常加载，但因 E2E mock 缺失 `Video` 契约的必填字段（`genres` / `aliases` / `languages` / `tags` / `subtitleLangs` 等），`VideoDetailHero` 内 `video.genres.length > 0` 等访问抛 `TypeError`，整个 section 崩溃，testid 无法出现在 DOM 中。
  - 疑问的焦点是：这究竟是"路由架构冲突"（`/movie/` 与 `/watch/` 职责重叠），还是"mock 不遵守契约 + 组件未兜底"两层工程问题？经排查，前者不成立 —— 两条路由语义互不重叠；真正的 Bug 在测试侧。
- **决策**：
  1. **保留"按类型分段"的详情页路由**：`/[locale]/movie/[slug]`、`/anime/[slug]`、`/series/[slug]`、`/variety/[slug]`、`/others/[slug]` 作为 SEO 真源，任一类型详情页都承诺渲染 `data-testid="video-detail-hero"`。URL 形如 `/en/movie/title-shortId`，`shortId` 为最后一段 nanoid（8 位），`extractShortId` 作为通用解析器。
  2. **保留 `/[locale]/watch/[slug]`** 作为播放真源，承诺渲染 `data-testid="watch-page" + player-shell + player-video-area`，不承担 SEO 主页面（标题 / OG 由类型详情页提供；播放页仅 `document.title` 无需 SSR meta）。
  3. **不合并、不重命名、不 redirect**：类型详情页与播放页语义正交，分治比合并更清晰；合并会破坏既有内链（`VideoDetailHero.watchHref = /watch/{slug}-{shortId}?ep=1`、`getVideoDetailHref` 反向生成类型详情 URL）与搜索页已上线的跳转路径。
  4. **契约校验下沉到测试层**：E2E mock 必须遵守 `Video` 类型契约（所有非 optional 字段一个不少）；共享 `makeVideoMock()` helper 放在测试工具文件，禁止每个 spec 自己拼 partial 对象。
  5. **架构约束**：`VideoDetailHero` 等消费方按类型契约访问字段，**不得**为了兼容坏 mock 而改成"防御式编程"（`video.genres ?? []`），否则类型约束形同虚设。mock 坏了应该让测试红，而不是让运行时悄悄回退默认值。
- **理由**：
  - **SEO 历史链接保留**：合并路由会让 `/movie/*` 重定向到 `/watch/*` 或反向，搜索引擎收录链接失效、内部链接全部要改；分治无此代价。
  - **职责单一**：详情页是"读取 + SEO + 决策点"，播放页是"消费 + 状态机"（断点续播 / 线路切换 / 影院模式）。两者渲染树、字体大小、布局模式、加载策略（CSR vs dynamic `ssr:false`）皆不同，合并成同一组件反而要加条件分支，污染更大。
  - **按类型分段有 SEO 增益**：`/movie/xxx` 和 `/anime/xxx` 在 SERP 上天然区分内容类型，便于结构化数据（未来 `VideoObject` schema 按类型输出不同字段）。
  - **测试 mock 契约化**比组件兜底更符合"正确性 > 改动收敛"的价值排序（CLAUDE.md 第 1 条）：组件加 `?? []` 会遮蔽未来 API 契约演进的真 Bug。
- **架构约束（代码层面强制）**：
  - 详情页 page.tsx 只能通过 `VideoDetailClient` 消费 `Video`，不得在 page.tsx 里直接渲染 hero（保持模板一致性）。
  - 播放页 page.tsx 只能通过 `PlayerLoader → PlayerShell` 承载，不得内联播放逻辑。
  - `getVideoDetailHref(video)` 是"视频 → 详情 URL"的唯一入口，禁止手拼 `/${type}/${slug}`。
  - 新增视频类型必须在 `getVideoDetailHref` 的 `PRIMARY_DETAIL_TYPES` 白名单 或 `others` 兜底中二选一，不得新增第六个类型路由目录而不更新 `video-route.ts`。
  - E2E mock 必须覆盖 `Video` 类型全部非 optional 字段；新增 `Video` 字段时，测试 mock helper 必须同步（代码评审检查项）。
- **迁移路径**：
  - 本次只修 `tests/e2e/player.spec.ts`：把 `MOCK_MOVIE` / `MOCK_ANIME` 补齐 `Video` 契约缺失字段；不改生产代码。
  - 不新增 redirect，不动任何 page.tsx。
  - 后续新增视频类型（如 `documentary` 如果升格为一级入口）时，按"架构约束"第 4 条决定新增路由还是复用 `/others/`。
- **影响文件**：
  - `tests/e2e/player.spec.ts`（补齐 `MOCK_MOVIE` / `MOCK_ANIME` 字段）
  - `docs/decisions.md`（本 ADR）
  - 架构守护层无新增文件，既有路由保持原样

---

## ADR-035: 重写期路由切分协议（apps/web → apps/web-next 渐进迁移）

- **日期**：2026-04-19
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：Resovo 进行 M2–M6 前端重写，`apps/web`（port 3000）与 `apps/web-next`（port 3002）需在同一对外域名下并存，按里程碑逐步由新应用接管路由。过渡期要求爬虫零感知（无 3xx）、URL 不变、每个里程碑可分钟级发布 + 秒级回滚。
- **决策**：采纳方案 B — Next.js middleware 切分。`apps/web/middleware.ts` 读取代码库内的 TypeScript 常量 ALLOWLIST，命中的路径用 `NextResponse.rewrite` 透明转发到 `apps/web-next`（内网 upstream）；未命中路径维持原有 next-intl + 品牌主题逻辑。
- **核心理由**：
  1. ALLOWLIST 作为 TS 常量存在代码库，与里程碑接管代码同 PR 提交，回滚即 `git revert`，审计链路完整。
  2. 本地 `next dev` 直接复现路由切分，无需额外代理组件；改 ALLOWLIST 热更新，dev 体验一致。
  3. matchRewrite 纯函数可用 Vitest 单元覆盖，Playwright E2E 可断言 `x-rewrite-source` 头。
  4. `NextResponse.rewrite` 对外 200，URL 不变，SEO 爬虫零感知。
- **ALLOWLIST 数据结构**：
  - 单一真源：`apps/web/src/lib/rewrite-allowlist.ts`
  - 匹配工具：`apps/web/src/lib/rewrite-match.ts`（纯函数，含单元测试）
  - `RewriteRule` 字段：`milestone`（M2–M6）/ `domain` / `path` / `mode`（exact/prefix）/ `localeAware` / `enabled` / `note`
  - `enabled: false` 用于灰度/回滚兜底；`REWRITE_KILL_SWITCH_ENV` 环境变量秒级禁用所有 rewrite
- **dev 工作流**：本地同时运行 apps/web（3000）+ apps/web-next（3002）；middleware 读 `REWRITE_UPSTREAM_URL`（默认 `http://127.0.0.1:3002`）做 rewrite；响应头 `x-rewrite-source: web-next` 可在 DevTools 确认命中
- **prod cutover 流程**：① `apps/web-next` 实现路由（`enabled: false`）→ CI 全绿 → ② 第二个 PR 将 `enabled: false` 改为 `true`（diff 仅 1 行）→ ③ 监控 24h → ④ 下一里程碑重复
- **回滚机制**：① 秒级：设置 `REWRITE_ALLOWLIST_DISABLED=1` 环境变量，middleware 短路回旧 app；② 分钟级：`git revert` 对应 PR，重新部署 apps/web
- **架构约束**：ALLOWLIST 单一真源，修改须绑定里程碑任务；middleware 只用 `NextResponse.rewrite` 不得用 3xx；入口层不做 locale 重协商；`x-rewrite-source` / `x-rewrite-rule` 头必须透传；禁止 apps/web 与 apps/web-next 直接共享代码（共享逻辑放 `packages/*`）
- **非目标**：CDN 缓存策略、按用户灰度、apps/server 路由、apps/api 路由
- **影响文件**：`apps/web/middleware.ts`、`apps/web/src/lib/rewrite-allowlist.ts`、`apps/web/src/lib/rewrite-match.ts`、`apps/web/src/lib/__tests__/rewrite-match.test.ts`、`docs/architecture.md`（新增重写期路由拓扑章节）
- **退役时机**：M6-RENAME 时，连同 `apps/web` 整体退役；本 ADR 状态更新为「已完成并废弃」


---

## ADR-036: Player Core 层提升为独立包（packages/player-core）

- **日期**：2026-04-19
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：播放器核心实现（HLS 加载、手势控制、快捷键、字幕渲染等）内嵌于 `apps/web/src/components/player/core/`，随 M3-PLAYER-02 开始 `apps/web-next` 需要复用同一份代码。若直接 import 会产生跨 app 直接引用，违反架构约束"禁止 apps 间直接共享代码"。
- **决策**：将 `apps/web/src/components/player/core/` 通过 `git mv` 整体迁移到 `packages/player-core/src/`，对外发布为内部私有包 `@resovo/player-core`，两个 apps 均通过包名引用。`YTPlayer` 组件重命名为 `Player`（去掉 YouTube 品牌色彩，语义更通用）。
- **API 契约**（公开导出）：
  - `Player` — 播放器主组件（前身 YTPlayer）
  - `PlayerProps` — 组件 Props 类型
  - `SubtitleTrack` — 字幕轨道描述类型
  - `QualityLevel` — 画质选项类型
  - `Chapter` — 章节类型
  - 上述全部从 `packages/player-core/src/index.ts` 统一导出，消费方只做 `import { Player } from '@resovo/player-core'`
- **包配置**：
  - `name: "@resovo/player-core"`，`private: true`
  - `main` / `types` 均指向 `./src/index.ts`（零构建，workspace path resolve）
  - `peerDependencies: { react: ">=18", react-dom: ">=18" }`
  - `tsconfig.json` 的 `paths` 中 `@resovo/types` 指向 `../types/src/index.ts`
- **迁移方式**：`git mv` 保留完整 git 历史
- **非目标**：不引入构建步骤（无 tsc emit / rollup）、不改 Player 内部实现逻辑、不触碰 `packages/player/`（legacy mirror，M6 后统一退役）
- **影响文件**：
  - 新增：`packages/player-core/package.json`、`packages/player-core/tsconfig.json`、`packages/player-core/src/index.ts`、`packages/player-core/README.md`
  - git mv：`apps/web/src/components/player/core/` → `packages/player-core/src/`
  - 修改：`apps/web/src/components/player/VideoPlayer.tsx`（import 改 `@resovo/player-core`）
  - 修改：`apps/web/package.json`（新增 `@resovo/player-core: *`）
  - 修改：`apps/web/tsconfig.json`（新增 paths 映射）
  - 修改：根 `package.json`（typecheck 追加 `--workspace @resovo/player-core`）
- **退役时机**：长期维护；`packages/player/` 在 M6 末退役，本包继续保留

## ADR-038: 双轨主题统一协议（apps/web-next ThemeContext 迁移）

- **日期**：2026-04-19
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：apps/web-next 在 M0 阶段临时沿用 zustand 版 `themeStore`（写 `classList.dark` + localStorage），而 TOKEN-11 的 `theme-init-script` 已基于 cookie 写 `dataset.theme`，两套 DOM/存储通道并存导致：(a) hydration 后 classList 覆盖 data-theme 造成双套同步，(b) cookie 与 localStorage 可产生矛盾值，(c) contexts/ 为空，Client Component 无法通过 React Context 消费 brand/theme。M1 启动前必须收敛为单一事实源，并与 apps/web 的 BrandProvider（ADR-024/ADR-033）对齐。
- **决策**：
  1. **DOM 同步通道统一为 `data-theme`**：`document.documentElement.dataset.theme` 是唯一写入点；CSS 变量选择器从 `.dark {}` 改为 `[data-theme="dark"] {}`；Tailwind dark mode 配置从 `'class'` 改为 `['selector', '[data-theme="dark"]']`；`classList.add/remove('dark')` 从 apps/web-next 代码库全部移除。保留 `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']):not([data-theme='dark']) {} }` 作为 no-JS 降级兜底。
  2. **删除 `apps/web-next/src/stores/themeStore.ts`（路径 A）**：ThemeToggle 改接 `useTheme()`，消费 ThemeContext。BrandProvider 的 `useSyncExternalStore + useRef` 外部 store 取代 zustand 职责。
  3. **BrandProvider 移植并挂载于 `apps/web-next/src/app/[locale]/layout.tsx`**：Server Component 用 `cookies()` 读 `resovo-brand` / `resovo-theme`，通过 `parseBrandSlug` / `parseTheme` 解析后作为 `initialBrand` / `initialTheme` props 传入 Client 版 BrandProvider。
  4. **存储通道统一为 Cookie**：移除 `localStorage.getItem/setItem('resovo-theme')` 全部调用；`setTheme` / `setBrand` 在更新 Context 的同时写回对应 Cookie（`max-age=31536000; path=/; samesite=lax`）。
  5. **ThemeToggle 升级为三态 Segmented Control**：`role="radiogroup"` + 3 个 `role="radio"` 子按钮（light/system/dark），Props 扩展为 `{ className?, variant?: 'icon'|'full' }`，data-testid 扩展为 `theme-toggle`（容器）+ `theme-toggle-{light|system|dark}`（子按钮），图标改用 inline SVG（项目无图标库依赖），配色全部走 CSS 变量。
- **理由**：data-theme 是 SSR init-script 的唯一通道；双写诱导下游错用 Tailwind `dark:` 变体；删除 themeStore 消除双状态来源（apps/web-next 无外部消费 useThemeStore）；Cookie 是 middleware/Server Component/init-script 唯一共识通道；radiogroup 是 WAI-ARIA 三态互斥选择的标准语义。
- **后果**：
  - 正面：DOM/存储/Context 三通道单事实源；apps/web 与 apps/web-next 主题层协议一致；E2E 可按 testid 稳定定位具体态位。
  - 负面：旧 E2E 中 `click(theme-toggle)` 循环切换用例改写为显式点击子按钮（已在 REG-M1-01 内同步完成）。
  - 注意：apps/web 的 BrandProvider `setTheme` 未写回 Cookie，已在 apps/web-next 版本中补齐；apps/web 侧修复推迟到 apps/web 退场前（M5）。
- **涉及文件**：
  - 新增：`apps/web-next/src/types/brand.ts`、`apps/web-next/src/contexts/BrandProvider.tsx`、`apps/web-next/src/hooks/useBrand.ts`、`apps/web-next/src/hooks/useTheme.ts`、`apps/web-next/src/lib/brand-detection.ts`
  - 删除：`apps/web-next/src/stores/themeStore.ts`
  - 修改：`apps/web-next/src/app/[locale]/layout.tsx`（挂 BrandProvider）
  - 重写：`apps/web-next/src/components/ui/ThemeToggle.tsx`（三态 Segmented Control）
  - 修改：`apps/web-next/tailwind.config.ts`（darkMode selector）
  - 修改：`apps/web-next/src/app/globals.css`（`.dark {}` → `[data-theme="dark"] {}`）
  - 修改：`tests/e2e-next/homepage.spec.ts`（ThemeToggle 测试适配新 testid）

## ADR-039: middleware 品牌/主题识别分层协议（apps/web-next）

- **日期**：2026-04-19
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：REG-M1-01 已在 apps/web-next 引入 BrandProvider 并由 `layout.tsx` 直接 `cookies()` 读取，但尚无 middleware 层把 brand/theme 上下文派发给 Route Handler、下游 RSC fetch 及后续埋点链路。同时 `apps/web-next/src/middleware.ts` 当前只挂载 next-intl，缺少链式组合规范。本 ADR 一次性裁定 middleware 的识别协议、优先级链、与 next-intl 的组合方式及 Edge Runtime 约束。
- **决策**：
  1. **解析链一元化**：middleware 与 layout 共用 `lib/brand-detection.ts` 的 `parseBrandSlug` / `parseTheme` 纯函数，不重复实现解析逻辑，不 import Server-only 模块。
  2. **事实源仍是 Cookie，header 仅为派生副本**：`resovo-brand` / `resovo-theme` Cookie 是唯一权威存储（ADR-038）；middleware 在每次请求上读 Cookie → 解析 → 注入 `x-resovo-brand` / `x-resovo-theme` 到 response headers，供下游 RSC / API Route 读取。`layout.tsx` 继续 `cookies()` 读取，不改为读 header，以保持 layout 在无 middleware 场景（单测、直挂 Route Handler）下仍正确。
  3. **优先级链（M1 定稿）**：`cookie → DEFAULT_BRAND_SLUG('resovo')` / `cookie → DEFAULT_THEME('system')`。不支持 query param（CDN 缓存污染风险）、不支持 hostname 映射（当前单域名，YAGNI）。`resolveBrandContext()` 以函数形态封装，未来新增 hostname 层只在函数内部追加。
  4. **next-intl 组合采用「intl 先跑、header 后注入」**：`createIntlMiddleware` 返回的 `NextResponse` 可能是 rewrite / redirect / next，必须先由 intl 决定形态，再由我们 `response.headers.set(...)` 追加；不得在 intl 之前预生成 response。
  5. **Edge Runtime 约束写入规范**：`lib/brand-detection.ts` 及任何被 middleware 传递引入的模块必须 Edge-safe（禁止 `fs` / Node built-ins / 依赖它们的三方库）；middleware 内禁止 import RSC 专用 API（`next/cache`、DB client 等）。
  6. **Header 命名对齐**：`HEADER_BRAND='x-resovo-brand'`、`HEADER_THEME='x-resovo-theme'`，`x-` 前缀标示应用自定义。
- **理由**：Cookie 为事实源，header 为派生面，避免 layout 耦合到 middleware 必须执行；`parseBrandSlug` / `parseTheme` 纯函数复用三处；query/hostname 路径在单域名期是纯负担，以专门 ADR 在多品牌落地时评估；next-intl 组合顺序由其可能含 rewrite/redirect 决定，顺序颠倒会吞掉国际化路由决策。
- **后果**：
  - 正面：middleware 层契约固化，后续任务新增 header 字段只需追加 `set(...)` 一行；layout 无需随 middleware 变动。
  - 正面：`lib/brand-detection.ts` 成为 Edge/Node 双可运行的纯函数层。
  - 负面：每次请求多一次 cookie 解析（两次字符串正则），性能开销可忽略。
  - 注意：若未来为 middleware 增加 DB/hostname map 查询，必须另发 ADR；不得悄悄加依赖破坏 Edge-safe 属性。
- **涉及文件**：
  - 修改：`apps/web-next/src/middleware.ts`（next-intl + brand/theme header 注入）
  - 复用：`apps/web-next/src/lib/brand-detection.ts`（REG-M1-01 已建立）
  - 不改：`apps/web-next/src/app/[locale]/layout.tsx`（维持 `cookies()` 读取）
  - 新增：`tests/unit/lib/brand-detection.test.ts`（parseBrandSlug/parseTheme 纯函数单元测试 25 cases）
  - 新增：`tests/e2e-next/brand-detection.spec.ts`（middleware header 注入 E2E 验证 4 cases）

---

## ADR-043 — Token 后台 MVP 增量补齐（Diff / 继承指示 / 保存链路）

- **日期**：2026-04-19
- **决策者**：arch-reviewer (claude-opus-4-6)，主循环 claude-sonnet-4-6 落地
- **背景**：TOKEN-14 只有只读预览，方案 §5.0 MVP 11 项仅覆盖 4 项。本次补齐 3 项：Diff 辅助、继承指示、保存链路（dev only 写回）。
- **决策**：
  - **D1 PUT API**：`PUT /v1/admin/design-tokens/:brandSlug`，整体替换 overrides（非 partial patch），乐观锁通过 `expectedUpdatedAt` CAS
  - **D2 生产只读**：`assertWriteAllowed()` 在 service 层做唯一判定（NODE_ENV=production || DESIGN_TOKENS_WRITE_DISABLED）；路由层只做错误映射（403）；依赖注入 `readEnv` 使单元可测
  - **D3 继承指示**：service 返回 `overrideMap: Record<flatPath, 'base'|'brand-override'>`；前端 working-copy 管理 dirty paths；UI 显示 InheritanceBadge
  - **D4 写回落盘**：slug='resovo' → default.ts，其他 → <slug>.ts；固定字符串模板 + prettier 格式化；temp+rename 原子写；build 同步子进程；失败时 fs 回滚
  - **D5 Diff 面板**：前端计算 diff（baseline vs working），生成建议 commit message 格式 `tokens(<slug>): <verb> <N> field(s) [<scope>...]`
- **不做（V2）**：新建 brand UI、版本回滚 UI、多人协作、单字段 PATCH、审计日志落 DB、primitive/base semantic 编辑、ts-morph AST 写回
- **V2 触发条件**（满足任一即可立项）：需要多人同时编辑 Token、新增 Token 类型（不兼容现有 flat-path）、WCAG 合规审计需求出现、版本回滚出现运营需求
- **影响文件**：
  - 新增：`apps/api/src/services/DesignTokensService.ts`（写回编排）
  - 修改：`apps/api/src/routes/admin/design-tokens.ts`（GET :slug + PUT）
  - 新增：`apps/server/src/components/admin/design-tokens/{DiffPanel,TokenEditor,InheritanceBadge}.tsx`
  - 新增：`apps/server/src/components/admin/design-tokens/{_diff,_paths}.ts`
  - 修改：`apps/server/src/components/admin/design-tokens/DesignTokensView.tsx`（三栏布局）
  - 新增：`packages/design-tokens/src/brands/{_validate,_patch,_resolve}.ts`
  - 修改：`apps/api/src/db/queries/brands.ts`（`updateBrandOverridesIfUnchanged` 乐观锁）
  - 新增：`tests/unit/api/admin-design-tokens-write.test.ts`（service 单元测试 6 cases）

---

## ADR-040 — Root layout 四件套常驻化（Nav/Footer/GlobalPlayerHostPlaceholder/MainSlot）

- **日期**：2026-04-19
- **决策者**：arch-reviewer (claude-opus-4-6)，主循环 claude-sonnet-4-6 落地
- **背景**：Nav/Footer 在每个 page.tsx 中独立渲染，跨页 DOM 重新挂载，出现视觉闪烁，且与未来 GlobalPlayerHost 跨页常驻需求冲突。
- **决策**：
  - **D1 layout.tsx 结构**：`<div class="app-shell"><Nav/><main id="main-content" class="main-slot">{children}</main><div id="global-player-host-portal"/><Footer/></div>` 在 BrandProvider 内
  - **D2 pages 改动**：各 page.tsx 移除 Nav/Footer/外层 div；首页直接返回 Fragment；detail-page-factory 直接返回 VideoDetailClient；watch page 返回 data-testid="watch-page" div
  - **D3 next-placeholder**：接受方案 A（有 Nav/Footer），`<main>` → `<section>` 避免嵌套冲突
  - **D4 rerender 隔离**：不加 memo，App Router 天然保证 layout 不 remount
  - **D5 CSS**：globals.css 新增 `.app-shell` / `.main-slot` / `#global-player-host-portal` 三条规则；`--z-player-host` fallback 40
- **不做**：不拆 route group，不改 middleware matcher，不实现 GlobalPlayerHost 本体（REG-M3-01），不处理影院模式 Footer 隐藏（REG-M3）
- **影响文件**：layout.tsx / page.tsx / detail-page-factory.tsx / watch page / next-placeholder page / globals.css

## ADR-044: View Transitions + Shared Element + Route Stack Primitives

- **状态**: Accepted
- **日期**: 2026-04-19
- **关联任务**: REG-M2-03
- **上游决策**: ADR-040（Root Layout 四件套），ADR-038（BrandProvider/ThemeContext）
- **下游影响**: REG-M3-01（FLIP 动画实装），M5（Tab Bar + 边缘滑动手势）

### 决策

1. **PageTransition**：封装 CSS View Transitions API，三态降级：支持+允许动画 → startViewTransition；浏览器不支持 → 直接切换；prefers-reduced-motion → opacity-only 80ms。Server Component wrapper（无 `'use client'`）+ Client `PageTransitionController`（含逻辑）分离，保持 RSC 兼容性。
2. **SharedElement**：本轮（REG-M2-03）仅定义 Props/Ref/Registry 契约并实现 noop，不实装 FLIP；FLIP 实现推迟到 REG-M3-01（需要全局持久 registry Context 归属评估）。
3. **RouteStack**：本轮仅实现类型定义 + noop hook/component，手势逻辑推迟到 M5 Tab Bar。原因：手势参数需真实场景调参，iOS Safari overscroll 兼容性需真机联调。
4. **动画时长**：全部通过 CSS 变量（`--transition-page: 240ms`、`--transition-page-reduced: 80ms`、`--transition-shared: 320ms`、`--ease-page`），不硬编码 ms 值。

### 推迟决定

- REG-M2-03 不实现边缘滑动手势；RouteStack stub 注释"TODO: M5 Tab Bar 上线时实装手势"。
- SharedElement FLIP bridge 注释"TODO: REG-M3-01 填充 FLIP 实现"。

## ADR-045: 图像基础 Primitive 契约（SafeImage / FallbackCover / image-loader）

- **状态**: Accepted
- **日期**: 2026-04-19
- **关联任务**: REG-M2-05（承接 REG-M2-04 LazyImage）
- **上游决策**: REG-M2-04（LazyImage + BlurHash）
- **下游影响**: REG-M2-06（全站 img 替换推进）

### 决策

1. **SafeImage**：封装 LazyImage，四级降级链：LazyImage 加载中 → LazyImage blurHash 占位 → FallbackCover（品牌色）→ fallback prop（自定义）。Props 透传 LazyImageProps，blurHash 由必填降为可选，新增 fallback / onLoadError / imageLoader。
2. **FallbackCover**：纯 CSS + 内联 SVG 组件，无网络请求。颜色**全部**来自 token：背景 --bg-surface，图标 --fg-muted，边框 --border-default，不硬编码任何颜色值。
3. **image-loader**：导出纯函数 buildImageUrl(src, opts)，当前 passthrough 实现，源文件内 TODO 注释预留 Cloudflare Images URL 模板。类型 ImageLoader 允许消费方注入自定义 loader。

### 后果

- CDN 切换为单点修改，调用方零感知。
- FallbackCover 解决全站"破图"体验，品牌色一致。
- 本卡只建 primitive 不做全站替换（由后续卡片承接）。

**四级降级层级说明**（arch-reviewer 审计补充）：方案 §17 描述的四级链为"真实图 → BlurHash → FallbackCover → CSS 渐变兜底"。实现中第四级（CSS 渐变）已内嵌于 FallbackCover 内部（当无 brandSeeds 时 FallbackCover 自动 fallback 到品牌主色渐变），SafeImage 层向调用方只暴露三级 surface。两者实质等价，但层级合并于 FallbackCover，调用方无需感知第四级细节。

## ADR-041: GlobalPlayerHost 契约设计（M3 阶段）

- **状态**: Accepted
- **日期**: 2026-04-19
- **关联任务**: REG-M3-01（full 态落地）/ REG-M3-02（mini）/ REG-M3-03（pip）/ REG-M3-04（/watch 接入）
- **上游决策**: REG-M2-01（#global-player-host-portal 宿主节点）

### 决策

1. **HostPlayerMode 状态机**：新增 `HostPlayerMode = 'closed' | 'full' | 'mini' | 'pip'`，与现有 `PlayerMode = 'default' | 'theater'` 正交共存。合法转换：closed↔full（本卡），full↔mini（M3-02），full↔pip/mini↔pip（M3-03）。closed→mini/pip 非法（未经 full 初始化）。
2. **playerStore 扩展**：新增 `hostMode`、`hostOrigin`、`isHydrated` 字段及 `setHostMode/closeHost/hydrateFromSession` actions，向后兼容（原有字段签名不变）。
3. **sessionStorage 持久化**：key `resovo:player-host:v1`，只持久化 mini/pip（full 刷新降级为 closed），isPlaying 强制 false，currentTime 不恢复。
4. **GlobalPlayerHost**：`createPortal` 挂入 `#global-player-host-portal`，`dynamic(ssr:false)` 注入 layout。本卡 full 态渲染 GlobalPlayerFullFrame 占位框架，mini/pip 渲染空占位，M3-02/03 填充。
5. **本卡不做**：/watch 接入（M3-04）、PlayerShell 迁移（M3-04）、mini/pip 视觉（M3-02/03）。

### 后果

- 宿主节点就绪，下游 M3-02/03/04 无需改 layout。
- PlayerShell 本卡行数变动为 0，/watch 不受影响。

## ADR-042: /watch 路由与 GlobalPlayerFullFrame Portal 接入方案

- **状态**: Accepted
- **日期**: 2026-04-19
- **关联任务**: REG-M3-04
- **上游决策**: ADR-041（hostMode 状态机），ADR-040（MiniPlayer FLIP）

### 决策

1. **PlayerShell 在 Portal 内渲染**：GlobalPlayerFullFrame 直接 import PlayerShell，传 slug prop，不拆分 core/shell（本卡约束）。PlayerShell 增加可选 `slug` prop + `portalMode` flag。
2. **路由离开检测**：新建 `RoutePlayerSync`（Root layout 挂载），usePathname 监听，离开 /watch 且 hostMode=full 时自动切 mini。
3. **ConfirmDialog 触发**：watch page 层，slug mismatch 且 hostMode∈{full,mini} 时弹 `ConfirmReplaceDialog`；confirm→initPlayer + full，cancel→router.replace 回原 href。
4. **testid 迁移**：PlayerShell 的所有 testid 跟随 DOM 进 Portal，document-wide 选择器无需修改；仅"祖先链断言"需改为两行独立断言。
5. **与方案 §13.1 一致**：/watch URL 保留，SSR 仍返回 watch-page 骨架，Portal 只影响 CSR DOM 结构。

### 后果

- 跨页播放（离开 /watch → mini 持续播放）得以实现。
- PlayerShell 改动行数 ≤ 20，其余业务逻辑不变。
- 需人工回归：①断点续播 ②线路切换 ③剧场模式 ④字幕 ⑤mini 跨路由 ⑥替换视频 ConfirmDialog。

## ADR-037 — 执行里程碑与方案里程碑对齐协议（历史偏差追认与未来约束）

- **决策日期**：2026-04-20
- **状态**：已采纳
- **关联任务**：REG-CLOSE-01
- **子代理**：arch-reviewer (claude-opus-4-6) — 起草与审计
- **关联补丁**：`docs/task_queue_patch_regression_m1m2m3_20260420.md`
- **关联文档**：`docs/milestone_alignment_20260420.md`
- **关联 ADR**：ADR-031、ADR-035、ADR-038/039/040/041/042/043/044/045（REGRESSION 阶段产出）

### 背景

三份原方案（design_system / frontend_redesign / image_pipeline，2026-04-18）以"能力层"维度划分 M1–M6。执行侧（exec-M1/M2/M3）的实际交付物与方案 M1/M2/M3 语义严重错位：方案侧 M# 描述能力层，执行侧 M# 描述页面搬家进度。ADR-035 引入网关 rewrite 协议后，主循环推进视角默认落到"页面搬家进度"，导致 apps/web-next 端方案 M1/M2/M3 能力层断档（19 项），直到 M3 PHASE COMPLETE 后对齐复盘才被识别。

### 决策

1. **历史偏差追认**：exec-M1/M2/M3 与方案 M1/M2/M3 的语义错位属已发生历史事实。通过 SEQ-20260420-REGRESSION 序列补齐，不回滚已有 exec 产物，不重命名历史命名。

2. **未来对齐要求**：自 exec-M4 起，每个执行里程碑启动前必须有"方案 M# ↔ 执行里程碑对齐确认"，显式声明覆盖的方案条目清单；偏离声明必须写独立 ADR。

3. **PHASE COMPLETE 必须含对齐表**：每个 PHASE COMPLETE 通知块必须包含方案 M# ↔ 执行里程碑映射表（参见 `docs/milestone_alignment_20260420.md` 格式）。未列对齐表视为未完成，下一里程碑不得启动。

4. **未对齐的 exec 里程碑不得标 ✅**：宣告完成前必须满足：①方案条目全 ✅ 或 ⚠️（含 ADR 偏离记录）；②Opus arch-reviewer 子代理审计 PASS；③审计结论与对齐表写入 `docs/changelog.md`。

5. **执行里程碑命名协议**：自 exec-M4 起恢复方案编号对齐（exec-M4 = 方案 M4，exec-M5 = 方案 M5，exec-M6 = 方案 M6）。若命名分歧则写独立 ADR 记录原因。

### 后果

- **正面**：防止"页面搬家进度"vs"能力层完成度"再次错位；每次 PHASE COMPLETE 自带可审计覆盖率报告；ADR 偏离声明强制可见。
- **负面**：短期开发效率下降（每里程碑 +15–30 min 对齐确认，PHASE COMPLETE +30–60 min 对齐表）；Opus 子代理审计为强约束，小幅增加模型路由成本。
- **长期收益 >> 短期成本**：本次 REGRESSION 单次成本约 26 小时，若每三个里程碑需一次类似补齐，规模放大 3–5 倍；本协议把成本前置摊平。

---

## ADR-046 图片治理 schema 契约（IMG-01）

- **状态**：已接受
- **日期**：2026-04-20
- **决策者**：arch-reviewer（claude-opus-4-6）
- **执行模型**：claude-sonnet-4-6（主循环）+ arch-reviewer（claude-opus-4-6）子代理

### 背景

Resovo 当前图片字段仅有 `media_catalog.cover_url`（P0 竖版）与 `media_catalog.backdrop_url`（P1 横版，META-06）。REGRESSION 阶段（ADR-037）已引入 SafeImage + FallbackCover + image-loader 四级降级链，但缺少服务端提供的 `blurhash / primaryColor / governance status` 输入。IMG-01 从 DB 侧补齐契约，使 FallbackCover 可使用 blurhash 占位、前台可按 status 判断是否降级到保底图。

### 决策点

**D1 — status 枚举存储**：TEXT + CHECK CONSTRAINT（与 `review_status/visibility_status/douban_status` 现有惯例一致；PG ENUM TYPE 扩展需 ALTER TYPE，运维风险高）

**D2 — `broken_image_events` 去重约束**：`UNIQUE (video_id, image_kind, url_hash_prefix, bucket_start)`（含 video_id，避免同 URL 跨多视频引用时事件错误合并；另建二级索引 `(image_kind, url_hash_prefix, bucket_start)` 服务跨视频 CDN 聚合）

**D3 — FK 级联策略**：`ON DELETE CASCADE`（与 `video_sources/subtitles` 子表家族一致；RESTRICT 增加维护摩擦无额外安全收益）

**D4 — `stills_urls/meta` 默认值**：`JSONB NOT NULL DEFAULT '[]'::jsonb`（空数组 fallback，避免 NULL 引发 jsonb 函数错误；与 `genres/aliases/tags TEXT[] DEFAULT '{}'` 传统一致）

**D5 — VIDEO_FULL_SELECT 扩展**：直接追加 6 列到单一常量（`mc.poster_blurhash/status/backdrop_blurhash/status/logo_url/status`），不新建 VIDEO_IMAGE_SELECT 子集（避免二次往返，维持"JOIN mc 单次取全"模式）

**D6 — VideoCard 图片字段**：仅新增 `posterBlurhash? + posterStatus?`（列表卡只渲染竖封面；backdrop/logo 不进 VideoCard）

### 结论

Migration 048 落实六项约束后可直接执行。后续 M5 若列表卡需要 logo 叠放，需写独立 ADR 扩展 VideoCard 契约。

---

## ADR-047 — SafeImage/FallbackCover 最终契约（IMG-03.5）

- **状态**：已接受
- **日期**：2026-04-20
- **决策者**：arch-reviewer（claude-opus-4-6 子代理）
- **执行模型**：claude-sonnet-4-6（主循环）
- **关联任务**：IMG-03.5
- **上游 ADR**：ADR-045（初始契约）

### 背景

ADR-045 建立了 SafeImage/FallbackCover 的基础契约，但缺少：空 src 语义澄清、MediaAspect 类型安全、seed 确定性渐变、品牌角标 CSS 变量注入、cloudflareLoader 实现、onLoadFail 统一回调签名。IMG-03.5 由 arch-reviewer Opus 子代理设计契约后补齐实现。

### 关键决策

**D1 — 空 src 静默降级**：`src=undefined/null/''` 时直接渲染 FallbackCover，不触发 `onLoadFail`（区别于网络错误）。空 src 是已知预期状态，不应触发上报链路。

**D2 — MediaAspect 类型**：`'2:3' | '16:9' | '1:1' | '5:6' | '21:9'`，替代裸字符串 aspectRatio；原 `aspectRatio?: string` 保留为 backward-compat 降级。

**D3 — onLoadFail 回调**：`(payload: { src, reason: 'network'|'decode' }) => void`，替代 `onLoadError`；旧签名 `onLoadError` 保留 deprecated 标注，网络错误时两者同时触发。

**D4 — seed → DJB2 → CSS var**：`hashSeed(seed) % 6` → `var(--fallback-gradient-{idx})`；6 个变量在 globals.css `:root` 中定义（使用现有 token 的渐变组合）；无 JS 颜色值硬编码。

**D5 — 品牌角标 CSS 变量**：`--brand-logo-mono-url: none` + `--brand-initial: 'R'` 在 `:root` 设默认值；`.fallback-cover__brand::before { content: var(--brand-initial, ''); }` 在 globals.css 定义；FallbackCover 保持 RSC（无 'use client'），不读 JS-level Brand 状态。Brand TS 类型不扩展。

**D6 — cloudflareLoader**：URL 格式 `https://imagedelivery.net/{ACCOUNT_HASH}/{imageId}/{w,q,f}`；账号 Hash 通过 `IMAGE_LOADER_CF_ACCOUNT_HASH`/`NEXT_PUBLIC_IMAGE_LOADER_CF_ACCOUNT_HASH` 环境变量注入，在调用时（非模块加载时）读取；`getLoader()` 通过 `IMAGE_LOADER`/`NEXT_PUBLIC_IMAGE_LOADER` 选择 passthrough/cloudflare。

**D7 — vitest 别名**：`vitest.config.ts` 新增 smart `@/` 别名（`customResolver` 基于 importer 路径区分 web-next/web），使 web-next 组件测试可在统一 test suite 中运行。

### 后果

- **正面**：FallbackCover 具备结构化内容（title + type badge + brand badge + seed 渐变）；SafeImage 空 src 语义明确；loader 体系可运行时切换。
- **负面**：FallbackCover 的品牌 logo 图片（`--brand-logo-mono-url`）需由 BrandProvider 在 DOM 注入才能生效；本 ADR 只定义变量约定，BrandProvider 注入为后续任务。
- **Arch-reviewer 审计**：PASS（claude-opus-4-6，2026-04-20）

---

## ADR-048: 列表→播放器直达路径与卡片交互协议（v1.1）

- **状态**: Accepted
- **日期**: 2026-04-20
- **决策者**: arch-reviewer (claude-opus-4-6)
- **执行模型**: claude-opus-4-6（主循环）
- **关联 ADR**: ADR-041（GlobalPlayerHost 状态机）/ ADR-042（/watch URL + RoutePlayerSync）/ ADR-044（View Transitions + SharedElement + RouteStack primitives）
- **关联方案章节**: `docs/frontend_redesign_plan_20260418.md` §9（过渡动效）/ §10（HeroBanner）/ §12（详情页）/ §13（播放器三态）/ §14.1（移动 Tab Bar）/ §15.3-§15.4（Skeleton）/ §16（组件清单）
- **触发上下文**: M5 页面重置前置决策阶段，补齐方案 §19 五类决策缺口
- **注**: 补丁文档 `task_queue_patch_m5_card_protocol_20260420_v1_1.md` 中引用为"ADR-046"，因 ADR-046/047 已被 IMG 管线占用，实际编号为 ADR-048

### 1. 背景

方案 `docs/frontend_redesign_plan_20260418.md` §19 将 M5 定义为"页面重塑 4-5 张卡片"，但对以下五类关键交互与视觉决策未下结论，若带着缺口进入执行将复现 REGRESSION 阶段"方案与执行错位"的偏差模式：

1. **列表→播放器直达路径丢失**。ADR-042 锁定了 `/watch/[slug]` URL 保留策略，但 apps/web-next 的 VideoCard 当前仅有"点击卡片→详情页"一条出口。apps/web 时期的"卡片右上角悬浮 ▶ 直达播放"能力在迁移过程中丢失，用户从列表页到达播放器必须经过详情页中转，多一次导航。

2. **卡片内容协议空白**。§16 列出了 VideoCard primitive 但未定义标签体系（生命周期/热度/规格/评分的上限、互斥规则）、文字区字段排布（片名行 + 元信息行）、集数显示规则（连载中 vs 已完结 vs 电影时长）。

3. **多集视频卡无视觉差异化**。series/anime/tvshow 与 movie 共用同一卡片视觉，无法在网格浏览阶段传达"此内容包含多集"的信息。

4. **Tab Bar 与 MiniPlayer 叠加协议缺位**。§14.1 定义了移动端三 Tab 玻璃底栏，§13 定义了 GlobalPlayerHost mini 态，但二者在底部 56px 区域同时渲染时的 z-index、safe-area-inset 吸收责任、动画隔离规则均未声明。

5. **Primitive 激活归属不明**。REGRESSION 阶段产出的 SharedElement（noop）、RouteStack（stub）、PageTransition Sibling variant（noop）需要在 M5 真实实装，但"哪张执行卡负责激活哪个 primitive"未分配，存在多卡抢占或无人实装的风险。

本 ADR 作为 M5 序列的决策锚点，一次性锁定上述五项协议，后续 CARD/PAGE 卡片按本 ADR 约束实施。

### 2. 交互协议 — VideoCard 双出口（路径 B' 定制版）

VideoCard 将卡片可交互面积划分为两个语义区域，各自绑定独立目的地：

**图片区（上半区域）**：点击触发 Fast Takeover（见 §3），导航至 `/watch/[slug]?ep=1`，由 GlobalPlayerHost 接管渲染（ADR-041）。此区域由 `<VideoCard.PosterAction>` 承载，语义为"立即播放"。

**文字区（下半区域）**：点击导航至 `/{type}/[slug]` 详情页，走标准路由跳转。此区域由 `<VideoCard.MetaAction>` 承载，语义为"查看详情"。

**容错区**：图片区与文字区之间的 8px 中轴间隙归属文字区（详情页），因为误触播放的代价（启动播放器 + 消耗带宽）高于误触详情页。

**桌面端增强**：hover 时在图片区中央淡入悬浮 ▶ 播放按钮（规格见 §3），提供视觉提示。

**长按/右键**：移动端长按与桌面端右键触发上下文菜单（收藏/分享/稍后观看）。M5 阶段仅预留事件绑定点与 Props 接口，不实装菜单内容。

**键盘无障碍**：Tab 顺序固定为 PosterAction（播放） → MetaAction（详情），与视觉自上而下的阅读顺序一致。两个 action 各自持有独立 `aria-label`（如 "播放《片名》第一集" / "查看《片名》详情"）。

### 3. 动效规格

#### 3.1 Fast Takeover（新增变体，对应方案 §9.5）

从列表页 VideoCard 图片区直达播放器的过渡动效。总时长移动端 200ms / 桌面端 240ms，easing `cubic-bezier(0.4, 0, 0.2, 1)`。

| 阶段 | 时间占比 | 视觉行为 |
|------|---------|---------|
| A（0-60%）| 移动 0-120ms / 桌面 0-144ms | 图片层 scale 1.0 → 1.03；遮罩层 `rgba(0,0,0,0.9)` 从 opacity 0 淡入至 1 |
| B（60-100%）| 移动 120-200ms / 桌面 144-240ms | 卡片图像 flip 过渡至播放器 poster 位；字幕轨道与播放控件 opacity 0 → 1 淡入 |

`prefers-reduced-motion` 降级：跳过 scale 缩放与 flip 翻转，仅执行 opacity 交叉淡入，时长 120ms。

`playerStore.enter()` 扩展 transition 参数以区分来源：`transition: 'fast-takeover' | 'standard-takeover'`。GlobalPlayerHost 根据此参数选择对应动画序列。

#### 3.2 Standard Takeover（保持不变）

从详情页触发播放器接管的过渡动效，总时长 360ms，规格沿用方案 §9.3 既有定义。`prefers-reduced-motion` 降级为 opacity 200ms 交叉淡入。

#### 3.3 悬浮 ▶ 播放按钮（桌面端）

尺寸 44x44px（满足触控最小目标），居中定位于图片区。视觉：背景 `var(--overlay-heavy)` + `backdrop-filter: blur(8px)`，图标使用 `var(--fg-on-overlay)` 颜色。进入动画 opacity 0 → 1 共 120ms，离开动画 opacity 1 → 0 共 90ms（离开快于进入，减少残影感）。

所有颜色值通过 CSS 变量引用，不硬编码 rgba 数字。`--overlay-heavy` 与 `--fg-on-overlay` 在 design-tokens 中定义，暗色模式自动适配。

### 4. 卡片内容协议

#### 4.1 标签上限与位置

图片区内标签按四象限布局，各象限有独立上限：

- **左上**：文字标签 ≤ 2 个，纵向堆叠（生命周期 + 热度/运营）
- **右上**：评分标签 ≤ 1 个
- **右下**：规格图标 ≤ 2 个，横向排列

当多维度标签共存时，按上述上限截断，不换行不溢出。截断优先级：热度/运营先于生命周期被丢弃（生命周期对用户决策价值更高）。

#### 4.2 标签维度与互斥规则

| 维度 | 典型值 | 互斥规则 | 视觉形态 |
|------|--------|---------|---------|
| 生命周期 | 新片 / 即将上线 / 连载中 / 已完结 / 下架预警 | 五选一，同一视频只能处于一个生命阶段 | 文字标签，左上角 |
| 热度/运营 | 热门 / 本周 Top / 独家 / 编辑推荐 | 最多选 1 个，运营类标签由后台手动标注 | 文字标签，左上角 |
| 规格 | 4K / HDR / 杜比 / 中字 / 多语 | 独立判定，不互斥，但展示上限 2 个 | 图标，右下角 |
| 评分 | 豆瓣 9.1 / IMDb 8.7 | 独立判定，展示上限 1 个（优先豆瓣） | 数字标签，右上角 |

标签颜色通过 CSS 变量（如 `--tag-lifecycle-bg`, `--tag-hot-bg`）定义，暗色模式下自动切换对应暗色 Token，不硬编码任何颜色值。

#### 4.3 文字区规则

文字区固定两行，确保网格中卡片高度对齐：

- **Line 1 — 片名**：`line-clamp: 1`，字号 14-15px，`font-weight: 600`，颜色 `var(--fg-default)`
- **Line 2 — 元信息**：字号 12px，`font-weight: 400`，颜色 `var(--fg-muted)`，格式为 `{year} · {type_label} · {episodeInfo}`

episodeInfo 按视频类型差异化：
- `series` / `anime` / `tvshow`：已完结显示"全 {n} 集"，连载中显示"更新至 {n} 集"
- `movie`：显示时长如"102 min"
- `short` / `clip`：省略 episodeInfo 字段，Line 2 以 `{year} · {type_label}` 结尾

年份缺失时该位留空并省略前导分隔符。type_label 使用 i18n key 而非硬编码中文。

#### 4.4 新增维度变更约束

标签维度的新增（如"限免"、"付费"、"VIP"等商业标签）属于架构级变更，必须通过 ADR 流程审批后才能实施，不得直接修改代码添加新维度。原因：标签维度影响后端 schema、前端渲染逻辑、design-tokens 三层，单点修改会导致不一致。

#### 4.5 Skeleton 骨架屏契约

M5 阶段所有新建组件必须同时导出 `.Skeleton` 子组件（如 `VideoCard.Skeleton`、`HeroBanner.Skeleton`），作为数据加载中的占位渲染。

**Skeleton primitive**：通用骨架屏原子组件 `<Skeleton>`，支持三种形态：
- `rect`：矩形占位，可指定 width/height/borderRadius
- `circle`：圆形占位，指定 diameter
- `text`：文字行占位，可指定行数与行高

Shimmer 动画使用 CSS 变量定义底色与高光色（浅色模式 `var(--skeleton-base)` / `var(--skeleton-highlight)`，暗色模式对称 Token），1.5s 无限循环。

**三档触发门槛**：
- 数据在 300ms 内到达：不展示 Skeleton（避免闪烁）
- 300ms - 1000ms：展示 Skeleton
- 超过 1000ms：展示 Skeleton + 顶部细进度条

**像素级匹配要求**：每个 `.Skeleton` 子组件的外部尺寸（width, height, margin, padding）必须与对应实际组件精确一致，防止数据到达后产生 layout shift。此项为 AI-CHECK 六问强制检查项 — M5 任何 PR 中新增组件未导出 `.Skeleton` 或 Skeleton 尺寸不匹配，直接判定 FAIL。

### 5. 多集视频卡视觉 — StackedPosterFrame

#### 5.1 触发条件

当 `video.type` 属于 `{'series', 'anime', 'tvshow'}` 时，VideoCard 的图片区使用 `<StackedPosterFrame>` 渲染伪堆叠效果，暗示内容包含多集。`movie`、`short`、`clip` 类型保持单卡片视觉，不渲染堆叠。

#### 5.2 静置态 — 方案 A（阴影暗示）

通过 `box-shadow` 模拟两张底层卡片错位堆叠的视觉效果，不增加实际 DOM 节点：

```css
.stacked-poster {
  box-shadow:
    3px -2px 0 0 color-mix(in oklch, var(--surface-2) 60%, transparent),
    6px -4px 0 0 color-mix(in oklch, var(--surface-2) 30%, transparent),
    0 4px 12px var(--shadow-card-rest);
}
```

所有颜色引用 CSS 变量：`--surface-2` 为卡片表面色（暗色模式自动切换），`--shadow-card-rest` 为静置阴影色。阴影层使用 `color-mix(in oklch, ...)` 确保色彩空间一致性，不使用 rgba 硬编码。

堆叠阴影层标记 `aria-hidden="true"`，不向屏幕阅读器暴露装饰性信息。

#### 5.3 桌面 hover 态时序（总 200ms）

| 阶段 | 时间区间 | 视觉行为 |
|------|---------|---------|
| A | 0 - 80ms | 主卡 `scale(1.0 → 1.02)`；底部阴影 `--shadow-card-rest` → `--shadow-card-hover`（加深） |
| B | 80 - 160ms | 第一层堆叠阴影偏移扩展至 `6px / -4px`，不透明度提升至 0.5 |
| C | 160 - 200ms | 第二层堆叠阴影偏移扩展至 `10px / -6px`，不透明度提升至 0.25；悬浮 ▶ 播放按钮同步淡入 |

三阶段使用 CSS `@keyframes` 配合 `animation-delay` 实现渐进展开效果。easing 统一为 `cubic-bezier(0.4, 0, 0.2, 1)`。

#### 5.4 reduced motion 降级

跳过 scale 缩放与分阶段阴影动画，hover 时直接切换至最终阴影状态（无过渡），即 `transition: none`。确保无运动障碍用户仍可感知 hover 反馈（通过阴影变化而非动画）。

### 6. 组件边界

M5 卡片相关组件拆分如下，职责单一，不交叉：

**`<VideoCard>`** — 复合容器组件，渲染为 `<article>` 语义元素。内部编排 PosterAction、MetaAction、TagLayer、StackedPosterFrame。不包含业务逻辑（数据获取、路由构建由调用方传入）。

- **`<VideoCard.PosterAction>`** — 独立 `<button>` 元素，占据图片区域。点击触发 Fast Takeover，调用 `playerStore.enter({ slug, episode: 1, transition: 'fast-takeover' })`。持有独立 `aria-label`。
- **`<VideoCard.MetaAction>`** — 独立 `<Link>` 元素（Next.js Link），占据文字区域。href 指向 `/{type}/[slug]` 详情页。持有独立 `aria-label`。
- **`<VideoCard.Skeleton>`** — 骨架屏变体，像素级匹配 VideoCard 实际尺寸。

**`<TagLayer>`** — 标签渲染层 primitive。接收结构化标签数据（生命周期、热度、规格、评分），按 §4.1 四象限规则渲染。不关心标签来源与计算逻辑。

**`<StackedPosterFrame>`** — 多集堆叠视觉 primitive。接收 `isMultiEpisode: boolean` 控制堆叠渲染。内部管理 box-shadow 与 hover 时序动画。非多集类型时渲染为普通容器（无阴影）。

**`<Skeleton>`** — 通用骨架屏 primitive。Props: `shape: 'rect' | 'circle' | 'text'`、`width`、`height`、`delay?: number`。被所有 `.Skeleton` 子组件内部消费。

### 7. 验收清单

以下为 M5 CARD/PAGE 阶段所有涉及卡片交互的 PR 必须通过的门禁项：

- [ ] **a11y — 独立 aria-label**：PosterAction 与 MetaAction 各自持有描述性 `aria-label`，不共用父级标签
- [ ] **a11y — 装饰隐藏**：StackedPosterFrame 的堆叠阴影层标记 `aria-hidden="true"`
- [ ] **reduced motion — Fast Takeover**：`prefers-reduced-motion: reduce` 时降级为 opacity 120ms 交叉淡入
- [ ] **reduced motion — Standard Takeover**：降级为 opacity 200ms 交叉淡入
- [ ] **reduced motion — 堆叠 hover**：跳过 scale 与分阶段动画，仅切换最终阴影状态
- [ ] **暗色模式**：所有视觉属性（颜色、阴影、标签背景）通过 CSS 变量引用 design-tokens，不出现 `#hex`、`rgb()`、`rgba()` 硬编码值
- [ ] **容器查询**：桌面端 vs 移动端的布局判定使用 `@container` 查询（基于父容器宽度），不使用 `@media` viewport 断点
- [ ] **键盘 Tab 顺序**：Tab 焦点依次经过 PosterAction → MetaAction，与 DOM 顺序一致
- [ ] **Skeleton 导出**：每个新建组件必须导出 `.Skeleton` 子组件
- [ ] **Skeleton 尺寸匹配**：`.Skeleton` 外部尺寸与实际组件像素级一致，CLS 为 0

### 8. Tab Bar 与 MiniPlayer 叠加协议

#### 8.1 布局规则

移动端底部同时存在 Tab Bar 与 MiniPlayer（当有播放中内容时），二者的空间分配协议如下：

- **Tab Bar**：固定定位底部，高度 56px，`z-index: var(--z-tab-bar)` (值 40)。Tab Bar 自身通过 `padding-bottom: env(safe-area-inset-bottom)` 吸收 iPhone 等设备的底部安全区，实际占据高度为 `56px + safe-area-inset`。
- **MiniPlayer mini 态**：紧贴 Tab Bar 顶部，`z-index: var(--z-player-mini)` (值 50)，`bottom: calc(56px + env(safe-area-inset-bottom))`。MiniPlayer 不重复声明 `env(safe-area-inset-bottom)` 作为自身 padding — safe-area 吸收责任归且仅归 Tab Bar。
- **页面内容区**：底部设置 `padding-bottom: calc(56px + env(safe-area-inset-bottom))` 避让 Tab Bar，确保最末内容不被遮盖。

#### 8.2 交互隔离

Tab Bar 与 MiniPlayer 的交互动效各自独立，互不触发：

- Tab 切换时执行 180ms 下划线滑动动效，此过程不触发 MiniPlayer 的 FLIP 计算
- MiniPlayer 在 full 态与 mini 态之间切换时，Tab Bar 保持可见且不参与动画（full 态全屏遮盖时 Tab Bar 自然被覆盖，但不执行隐藏/显示逻辑）
- 路由切换时 Tab Bar 的 active 指示器随当前路由更新；MiniPlayer 不卸载不重挂（遵循 ADR-042 RoutePlayerSync 协议，确保断点续播不中断）

#### 8.3 z-index 全站层级表（M5 治理）

M5 阶段统一治理全站 z-index，所有层级通过 CSS 变量声明，禁止在组件中使用裸数字：

```
变量名                              值    用途
--z-player-full-cinema              70    GlobalPlayerHost full 态（影院模式）
--z-player-full                     60    GlobalPlayerHost full 态（常规）
--z-player-mini                     50    GlobalPlayerHost mini 态
--z-tab-bar                         40    移动端 Tab Bar
--z-modal                           30    Modal 对话框 / 上下文菜单 / ConfirmReplaceDialog
--z-header                          20    Header（scroll-collapsed 收缩态）
--z-mega-menu                       15    MegaMenu 展开面板
--z-content                          0    默认内容层
```

层级变量在 `globals.css` 的 `:root` 中统一定义。新增层级必须在本表注册并更新 ADR，不得跳号或在组件内自行定义 z-index 数值。

#### 8.4 Safe Area 分工协议

safe-area-inset 的吸收遵循"单一责任"原则，避免重复叠加：

| 组件 | safe-area-inset-bottom 处理方式 |
|------|-------------------------------|
| Tab Bar | `padding-bottom: env(safe-area-inset-bottom)` — 作为唯一吸收方 |
| MiniPlayer | `bottom: calc(56px + env(safe-area-inset-bottom))` — 引用 Tab Bar 总高度定位，不自行吸收 inset |
| 页面内容区 | `padding-bottom: calc(56px + env(safe-area-inset-bottom))` — 避让 Tab Bar 总高度 |

56px 应通过 CSS 变量 `var(--tab-bar-height)` 引用，不硬编码数字。

#### 8.5 反例（禁止实现）

- **禁止** MiniPlayer 使用硬编码 `bottom: 72px` — 必须引用 `calc(var(--tab-bar-height) + env(safe-area-inset-bottom))`
- **禁止** Tab Bar 与 MiniPlayer 同时声明 `padding-bottom: env(safe-area-inset-bottom)` — safe-area 仅由 Tab Bar 吸收一次
- **禁止** 路由切换过程中先卸载 MiniPlayer 再重新挂载 — 破坏 FLIP 动画连续性与断点续播（违反 ADR-042）
- **禁止** z-index 使用裸数字（如 `z-index: 50`）而非 CSS 变量（如 `z-index: var(--z-player-mini)`）

### 后果

**正面收益**：
- VideoCard 双出口恢复了从列表页直达播放器的能力，用户省去"列表 → 详情 → 播放"的中间跳转，核心路径缩短一步
- 卡片内容协议统一了标签体系与文字区规则，防止各页面（首页/分类/搜索）的卡片实现分叉
- StackedPosterFrame 为多集内容提供即时视觉辨识，无额外 DOM 开销（纯 CSS 实现）
- z-index 全站治理表消除了 M5 多组件并发实装时的层叠冲突风险
- Skeleton 契约前置，避免组件上线后再补骨架屏导致 layout shift 回归

**负面成本**：
- VideoCard 从单入口变为双入口，复杂度增加（两个独立 action + 容错区判定），测试矩阵翻倍
- Fast Takeover 动效需要与 `playerStore.enter()` 深度协调，增加 GlobalPlayerHost 的条件分支
- §8 的 z-index 层级表为全站约束，后续任何涉及定位层叠的开发都必须先查表再实施，流程摩擦增加

**风险**：
- Fast Takeover 的 200ms 时间窗较短，低端移动设备可能无法在此窗口内完成图片到播放器 poster 的 flip 过渡，需在实装阶段（M5-CARD-CTA-01）做真机性能验证，必要时延长至 280ms
- `color-mix(in oklch, ...)` 的浏览器兼容性需确认（Chrome 111+, Safari 16.2+, Firefox 113+），若 baseline 不满足需准备 fallback 方案
- 上下文菜单（长按/右键）M5 仅预留不实装，但 PosterAction 的 `onContextMenu` 事件拦截可能与浏览器默认行为冲突，需在 M5-CARD-CTA-01 验证

**Arch-reviewer 审计**：PASS（claude-opus-4-6，2026-04-21）
