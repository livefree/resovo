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
  - 风险登记表（`docs/archive/2026Q2/risk_register_rewrite_20260418.md`）已识别出三条具体风险：Portal 化对 `/watch/[slug]` SSR 元数据的污染（RISK-01）、Cookie-based 品牌 middleware 对 Edge 冷启动的延迟（RISK-02）、View Transitions 在 Safari < 18 的兼容性（RISK-03）。任一风险失控都会让站点在重写期出现明显的业务退化（SEO 降级、TTFB 劣化、路由白屏）。
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
  - `docs/archive/2026Q2/risk_register_rewrite_20260418.md`（风险登记与状态跟踪）
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
- **Patches（ALLOWLIST 启用记录）**：
  - 2026-04-19 ALLOWLIST 初始化 + RW-SETUP-02 `/next-placeholder` enabled
  - 2026-04-XX M2 `/` enabled（homepage）
  - 2026-04-XX M3 `/movie /series /anime /tvshow /others /watch` enabled（详情 + 播放器）
  - **2026-04-22 CHORE-06 M5 `/search` enabled**（M5 真·PHASE COMPLETE v2 后接入网关；前置 CLEANUP-09 locale 保留 + CLOSE-03 SSR 500 修复；单测见 `tests/unit/lib/rewrite-match.test.ts` `matchRewrite — M5 /search prefix rule`）


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
- `series` / `anime` / `variety`（综艺）：已完结显示"全 {n} 集"，连载中显示"更新至 {n} 集"
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

当 `video.type` 属于 `{'series', 'anime', 'variety'}` 时，VideoCard 的图片区使用 `<StackedPosterFrame>` 渲染伪堆叠效果，暗示内容包含多集。`movie`、`short`、`clip` 类型保持单卡片视觉，不渲染堆叠。

> **注**：VideoType 域使用 `variety`（综艺），URL 路径使用 `tvshow`（`video-route.ts` ADR-042 映射）。本 ADR 以域值为准。

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

- **Tab Bar**：固定定位底部，高度 56px，`z-index: var(--z-tabbar)` (值 40)。Tab Bar 自身通过 `padding-bottom: env(safe-area-inset-bottom)` 吸收 iPhone 等设备的底部安全区，实际占据高度为 `56px + safe-area-inset`。
- **MiniPlayer mini 态**：紧贴 Tab Bar 顶部，`z-index: var(--z-mini-player)` (值 50)，`bottom: calc(56px + env(safe-area-inset-bottom))`。MiniPlayer 不重复声明 `env(safe-area-inset-bottom)` 作为自身 padding — safe-area 吸收责任归且仅归 Tab Bar。
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
--z-full-player                     70    GlobalPlayerHost full 态（含影院模式 CinemaMode overlay z:1）
--z-mini-player                     50    GlobalPlayerHost mini 态
--z-tabbar                          40    移动端 Tab Bar
--z-modal                           30    Modal 对话框 / 上下文菜单 / ConfirmReplaceDialog
--z-header                          20    Header（scroll-collapsed 收缩态）
--z-mega-menu                       15    MegaMenu 展开面板
--z-content                          0    默认内容层
```

> **实装备注**：变量名以 `globals.css` 实装为准（`--z-tabbar`、`--z-mini-player`、`--z-full-player`），ADR §8.1-§8.2 文本中的 `--z-tab-bar`、`--z-player-mini` 等旧写法在本次 M5-CLOSE-01 修订中已统一为上表命名。CinemaMode overlay 位于 full-player 容器内部（`z-index:1`），不占用独立全局层。

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

## ADR-049 — Admin 有序列表组件选型（@dnd-kit）

**日期**：2026-04-21
**状态**：已接受
**背景**：M5-ADMIN-BANNER-01 需要 Banner 后台拖拽排序功能；项目此前无任何拖拽库依赖，需首次引入并锁定边界。

**决策**：
- ✅ 引入 `@dnd-kit/core` + `@dnd-kit/sortable`（两包合计约 14 KB，tree-shakeable）于 `apps/server`
- ✅ 封装为 admin primitive：`apps/server/src/components/admin/shared/SortableList.tsx`
- ✅ 所有有序列表模块必须消费 `SortableList`，不得直接使用 `@dnd-kit` 原语
- ❌ 禁止引入 `@dnd-kit/modifiers`（非必需额外包）
- ❌ 禁止其他非官方 @dnd-kit 生态包
- ❌ 禁止在 `apps/web-next`、`apps/api`、`packages/player*` 中引入 @dnd-kit（admin 独占）

**理由**：
- @dnd-kit 相比 react-beautiful-dnd 和 react-dnd 更轻量、无 React context 全局污染、支持 tree-shaking
- 封装 SortableList primitive 隔离外部依赖升级影响，确保后续 Banner/CrawlerSite/源排序等模块统一入口
- admin 独占限制防止 @dnd-kit 扩散到前台消费页（避免首屏 bundle 增大）

**影响**：
- `apps/server/package.json` 新增 `@dnd-kit/core ^6.3.1` + `@dnd-kit/sortable ^8.0.0`
- `docs/rules/admin-module-template.md` 追加有序列表章节
- `SortableList` 作为新 admin shared primitive 维护在 CHG 序列中，不受业务迭代影响

---

## ADR-037 迭代 — 真·PHASE COMPLETE 门禁更新（M5 闭环）

- **日期**：2026-04-21
- **状态**：已采纳（迭代条款附加于 ADR-037 主体后，不重编号）
- **关联任务**：M5-CLOSE-02
- **主循环**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 独立审计
- **关联文档**：`docs/archive/2026Q2/milestone_alignment_m5_final_20260421.md`、`docs/archive/2026Q2/milestone_alignment_m5_20260420.md`、`docs/archive/2026Q2/task_queue_patch_m5_cleanup_20260421.md`

### 背景

ADR-037 原条款（2026-04-20 REG-CLOSE-01 起草）约束"未对齐的 exec 里程碑不得标 ✅，必须有 Opus arch-reviewer 子代理审计 PASS"。M5-CLOSE-01（Sonnet 主循环 + Opus 子代理 CONDITIONAL → PASS）执行后，三路独立审计发现结构性偏差（Token 层 4 组缺失 / 组件规格偏离 / 文档签字未填），虽然 CONDITIONAL 条款已形式上满足，但"真·闭环"定义未明确：**CONDITIONAL 补丁完成后是否需要第二次 Opus 审计**。本次 M5-CLEANUP 序列（01/02/03）+ M5-CLOSE-02 闭环给出答案。

### 迭代条款（附加于 ADR-037 §决策 第 4 条之后）

**4a. 真·PHASE COMPLETE 二次审计门槛**：

当 PHASE COMPLETE 一次审计结论为 **CONDITIONAL** 时：

- ✅ 允许：在 task-queue.md 登记 **CONDITIONAL PASS 一次审计签字**（此时方案对齐文档标 "审计挂起"）
- ❌ 禁止：在 task-queue.md 把该里程碑标 ✅（"一次审计 PASS + 补丁已启动" 不等于里程碑完成）
- ❌ 禁止：启动下一里程碑任务（M6 取卡须等 M5 真·PHASE COMPLETE）
- ✅ 必须：启动 CLEANUP 序列补齐 CONDITIONAL 条件；CLEANUP 完成后新开一张 CLOSE-0N 卡（N ≥ 2），由 **Opus 主循环 + Opus arch-reviewer 子代理**对纠偏内容做**二次独立审计**（PASS 条件全部满足方可解除 BLOCKER）
- ✅ 产出：新起一份 `milestone_alignment_<milestone>_final_<date>.md`（≥ 35 项对齐 + ≥ 18 项红旗 + 二次审计 10 点签字），作为本里程碑的**最终闭环文档**。原一次审计文档保留为"审计挂起"版本，供回溯

**4b. 二次审计必查 10 点模板**（以 M5 为例，其他里程碑按同构替换字段）：

- Token 新增分组在 design-tokens 构建产物中可 grep
- 组件层无 `var(--foo, non-color-fallback)` 内联 fallback
- 组件类型签名与方案规格一致
- 关键组件无硬编码颜色
- 新增 Token 在 globals.css 中声明
- 新 ADR 已落盘且 rule 文档已引用
- 新增单元测试覆盖 ≥ 目标阈值
- 一次审计挂起的签字行已更新
- 主序列 + CLEANUP + CLOSE 全部 ✅
- 关键路径未回退（静态 + e2e 验证）

**4c. 数字口径澄清**：里程碑任务计数以 **task-queue.md 实际行数**为准，规格补丁中 "主序列 N 张" 若与实际不符，写入 final 对齐文档的 "记账偏差（非阻断 WARN）" 章节，不回滚已登记卡片。

### 后果

- **正面**：消除 CONDITIONAL 审计结论与真·闭环之间的模糊带；强制 CLEANUP 完成后二次独立审计，杜绝"一次 PASS 加补丁"式虚假收官
- **负面**：CONDITIONAL 情形下里程碑关闭延迟约 1-2 个工作日（CLEANUP 序列 + 二次审计成本）；Opus 主循环 + Opus 子代理组合的模型成本增加一次
- **长期收益 >> 短期成本**：M5 本轮若不强制二次审计，Token 层 4 组缺失 + 组件 0|1 硬签名会带入 M6 导致连锁补齐；前置成本摊平优于事后回滚

### 适用范围

- **溯及既往**：M5 本次即按本条款闭环（已由 M5-CLOSE-02 执行）
- **未来约束**：M6 及后续里程碑若 PHASE COMPLETE 审计出现 CONDITIONAL，一律按 4a / 4b / 4c 处置
- **不溯及**：M1-M4 已完成里程碑不追溯

---

## ADR-037 迭代 v2 — 三维闭环（静态审计 / 运行时代理证据 / e2e 框架层兜底）

- **日期**：2026-04-22
- **状态**：已采纳（v2 条款附加于 §4c 之后，仍不重编号）
- **关联任务**：M5-CLOSE-03（真·PHASE COMPLETE v2）
- **主循环**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 独立审计 `AUDIT RESULT: PASS`
- **关联文档**：`docs/milestone_alignment_m5_final_v2_20260422.md`（v2 final 对齐表）；~~`docs/archive/2026Q2/milestone_alignment_m5_final_20260421.md`~~（CLOSE-02 后被人工回归否决的历史版本，保留为审计案例）

### 背景

M5-CLOSE-02 在 2026-04-21 以"arch-reviewer 10 点静态审计 PASS"宣告真·PHASE COMPLETE，当日即被 **PC 端人工回归**否决 —— 9 项 UI 运行时缺陷（VideoCard 双出口反转 / 分类页 404 / 播放器弹窗化 / 线路切换重置 / 选项卡不稳 / CinemaMode 尺寸 / 排版 / 搜索只返热门 / 详情选集失效）。根因是 §4b 10 点必查模板**全部为静态检查**（文件存在 / 类型签名 / Token 声明 / 组件 props / docs 签字 / ADR 落盘 / 单测数量 / task-queue 标 ✅ / 关键路径静态代码面），无法验证 UI 运行时行为。CLOSE-03 本次补齐三维闭环，同时在代理证据采集阶段主动发现并修复一个预存 SSR 500 bug（`SearchPage.Skeleton` 在 Next 15 Client Reference 机制下返回 undefined，与 commit 9fcaaf1 的 `VideoDetailClientSkeleton` 同一 pattern 复发）。

### 迭代条款（附加于 §4c 之后）

**4d. 第 11 点必查：浏览器手动验收 + 运行时代理证据**

原 §4b 10 点必查之外强制追加第 11 点：

- **手动验收记录**：里程碑 final 对齐文档必须含「dev server 启动状态」+「关键路径 HTTP 状态码」+「e2e 完整回归数字」三张表作为运行时代理证据（AI 主循环无法操作浏览器时，以 `curl` 探测 + playwright 完整跑为机器可验证子集）
- **用户二次确认 checklist**：final 对齐文档必须含"用户 PC/移动端真人操作"逐条 checklist，任一未勾 → 签字 CANCELED
- **e2e 框架层防复发兜底**：每个里程碑的 e2e project 必须有 `response.status < 500` 基线断言（fixture 或全局 hook 形式），捕获 SSR error page 在 browser hydrate 后被"吞掉"的盲区（参考实现 `tests/e2e-next/_fixtures.ts`）

**4e. 新缺陷处理协议**：

CLOSE 阶段的代理证据采集如**发现新运行时缺陷**：

- ✅ 允许：主循环立即修**同一 pattern 的已知问题**（≤ 5 行改动、有先例 commit 可参照），在 final 对齐文档 §"CLOSE 额外发现 + 修复" 登记
- ❌ 禁止：对复杂或跨模块缺陷擅自修 → 必须写 BLOCKER 到 task-queue.md，由人工决策起 CLEANUP-NN 或回滚

**4f. 签字三维全绿**：

真·PHASE COMPLETE 签字的必要充分条件：
1. arch-reviewer 11 点 `AUDIT RESULT: PASS`（红线为空；黄线可用书面登记消化）
2. final 对齐文档 §"浏览器手动验收代理证据" 三张表全绿 + SSR 新缺陷（如有）的 before/after 对比硬证据
3. 用户二次确认 checklist 全部打勾

任一未达 → CANCELED。

### 后果

- **正面**：消除"静态 PASS 即真·PHASE COMPLETE"的假设；e2e 框架层兜底防止 Playwright `page.goto` 500 后 hydrate 假复苏的盲区；代理证据使 AI 主循环在无浏览器交互能力下仍能机器可验证一致性
- **负面**：每次 CLOSE 多 5-15 min 代理证据采集 + fixture 维护成本；未来 e2e spec 统一 import `_fixtures` 是约束
- **长期**：彻底杜绝"CLOSE-02 签字当日被回归否决"的历史重演

### 适用范围

- **溯及既往**：M5 本次即按 v2 条款闭环（由 M5-CLOSE-03 执行）
- **未来约束**：M6 及后续里程碑所有 PHASE COMPLETE 签字统一走 v2 三维闭环
- **不溯及**：M1-M4 已完成里程碑不追溯

---

## ADR-050: 字体族决策 — Noto Sans + Noto Sans SC

- **日期**：2026-04-22
- **状态**：已采纳
- **子代理**：无（用户直接决策字体族；CLAUDE.md"写 BLOCKER 暂停，禁止擅自定字体"合规）
- **背景**：`design_system_plan_20260418.md` 未明确具体字体族，CLEANUP-08 阶段将字体加载需求登记为 BLOCKER-FONT（2026-04-22）。前任 `typography.fontFamily.sans` 栈以 `Inter` 为首项但 Inter **实际未加载**，浏览器回退至 system-ui。用户 2026-04-22 决策字体族为 **Noto Sans + Noto Sans SC**（覆盖当前 en + zh-CN locale）
- **决策**：
  1. **字体族选择**：`Noto Sans`（拉丁）+ `Noto Sans SC`（简体中文），Google 开源 Sans-serif 家族，SIL OFL 许可，不产生新 npm 依赖
  2. **加载方式**：`next/font/google`（Next.js 内建 API，非新 npm 依赖，合规 CLAUDE.md §绝对禁止 #2）
     - self-host：字体文件在 build 时下载到 `.next/static/media/`，线上完全自托管，无第三方请求
     - zero layout shift：next/font 自动处理 font-display / size-adjust
     - 按 subset 切片：109 个 woff2 文件自动生成，浏览器按 unicode-range 按需加载
     - `display: 'swap'`：避免 FOIT
     - SC 包 `preload: false`：体积大，改为按需加载避免阻塞 LCP；英文页面不会触发 SC 下载
  3. **CSS 变量暴露**：`--font-noto-sans` / `--font-noto-sans-sc`，由 `apps/web-next/src/app/layout.tsx` 根 RootLayout 注入 `<html className={...}>`
  4. **Token 层消费**：`packages/design-tokens/src/primitives/typography.ts` `fontFamily.sans` 首项改为 `var(--font-noto-sans), var(--font-noto-sans-sc)`，fallback 保留 `PingFang SC / Hiragino Sans GB / Microsoft YaHei / system-ui`
  5. **Tailwind 传导**：`tailwind-preset.ts` 消费 `typography.fontFamily.sans`，通过 `theme.fontFamily.sans` 下发给 Tailwind；`globals.css` 的 `@apply font-sans` 继续工作
- **weights 选择**：`400 / 500 / 700`（与 `typography.fontWeight` 的 `regular / medium / bold` 对齐；`light: 300` / `semibold: 600` 不加载以控制字体包体积）
- **日韩 locale**：当前平台 `REWRITE_LOCALES = ['en', 'zh-CN']`，不加载 Noto Sans JP / KR；未来扩展 locale 时再起独立 ADR 决策
- **ICU / RTL**：不在本 ADR 范围
- **mono 字体**：保持 `JetBrains Mono / SF Mono / Menlo / Consolas / monospace`，本次不调整
- **影响文件**：
  - `packages/design-tokens/src/primitives/typography.ts`
  - `apps/web-next/src/app/layout.tsx`
  - `tests/unit/design-tokens/typography-font-family.test.ts`（新增）
- **未修改 `docs/design_system_plan_20260418.md`**（CLAUDE.md §绝对禁止修改规范文件；字体决策以本 ADR 为准）
- **验收**：
  - `npm run build -w @resovo/web-next` 成功，`.next/static/media/` 下生成 109 个 Noto Sans woff2 字体文件；CSS 输出含 `@font-face { font-family: Noto Sans ...}` 声明
  - typecheck / lint / unit 1453/1453 ✅（新增 6 case 在 typography-font-family.test.ts）
  - 未使用新 npm 依赖
- **关联**：CLEANUP-08 BLOCKER-FONT 解除；M5 对齐表"M6 前置待办（非阻断）"第 1 项完成


---

## ADR-051: M6 CDN 预备 + 后台图片管理 — 架构决策固化（SEQ-20260422-M6-CDN）

- **日期**：2026-04-22
- **状态**：已采纳（签字于 M6 PHASE COMPLETE）
- **子代理**：arch-reviewer (claude-opus-4-7)，NEED_FIX → 两必改点落地后 PASS（对齐表 `docs/milestone_alignment_m6_20260423.md` §6）
- **背景**：`frontend_redesign_plan §19` + `image_pipeline_plan §12.M4` 定义的 M6 原 scope "CDN 预备 1 张卡不对接"太窄；用户 2026-04-22 在启动计划时追加后台视频/Banner 图片管理需求（此前仅能改 URL，无上传/预览）。scope 扩展为 6 张主卡（CDN-01 / CDN-02 / IMG-06+fixup / IMG-07+fixup / IMG-08）+ M6-CLOSE-01，+ ADMIN-17 条件跳过。方案层正当性：`image_pipeline_plan §8.3` 运营编辑页改造已明文"点击替换：支持 URL 填写或本地上传（阶段性方案）"，属方案内演进
- **总决策**：以对齐表 §3 的 8 项决策为 M6 架构基线，固化于本 ADR；ADMIN-17 预警："当第 3 处图片上传消费方出现，必须抽共享组件"

### 决策 1 · `next/image` loader 抽象（CDN-01）

- `apps/web-next/next.config.ts` 设 `images.loader: 'custom'` + `loaderFile: './src/lib/image/next-image-loader.ts'`
- `next-image-loader.ts` 默认导出 `(props: { src, width, quality? }) => string`（Next loaderFile 约定），内部转接既有 `getLoader()`（IMG-M4 落地的 passthrough / cloudflare 双模式）
- env 驱动：`IMAGE_LOADER=passthrough|cloudflare` + `IMAGE_LOADER_CF_ACCOUNT_HASH`（server/edge）与 `NEXT_PUBLIC_*` 变体（client 编译期）
- 与 SafeImage 消费同一 loader，未来接 Cloudflare Images 零代码改动，仅需 env 切换

### 决策 2 · SafeImage `mode: 'lazy' | 'next'` 开关（CDN-02）

- `SafeImageMode` 为命名类型（`types.ts`），导出，避免裸字符串联合
- 默认 `'lazy'` → 走既有 `LazyImage`（IntersectionObserver + blurHash canvas），6 个现有消费者零回归
- `'next'` → 分派到 `SafeImageNext.tsx`：`<Image fill sizes>` + 外层 aspect-ratio wrapper + blurDataURL placeholder
- 预留 `blurDataURL?` / `sizes?` / `'data-testid'?` 三个 props 供未来全站迁移
- `imageLoader` prop 在 next 模式下被忽略（dev 环境 `console.warn`；不用 `process.stderr` —— `'use client'` 浏览器端会 TypeError）
- arch-reviewer CDN-02 评审 NEED_FIX → 4 必改点（mode 命名 / fill + aspect wrapper / loader warn / 预览页 CSS token）全部在 commit `9510d7f` 落地

### 决策 3 · 图片上传 API 契约（IMG-06）

```
POST /v1/admin/media/images
Content-Type: multipart/form-data
Auth: admin only（对齐 /admin/banners）

Fields:
  file:       binary（≤ 5MB，mimetype ∈ image/jpeg|png|webp|avif|gif）
  ownerType:  'video' | 'banner'
  ownerId:    string
  kind:       ImageKind（ownerType='video' 时必填；'banner' 时忽略）

Response 201: { url, key, kind, contentType, size, hash, blurhashJobId, provider }
Response 400 / 404 / 413 / 415 / 503 各有对应错误码
```

- **关键**：`ownerType + ownerId` 泛化而非 `kind='banner'`（避免撕裂 `ImageKind` 枚举 poster/backdrop/logo/banner_backdrop/stills/thumbnail，banner 不在其中）
- `blurhashJobId` 供前端可选轮询
- `hash` / `provider` 字段供调用方版本追踪 / 环境区分

### 决策 4 · R2 key 命名（防 CDN 缓存不一致）

- 带 sha256(buffer) 前 8 位 hash：`posters/{videoId}-{hash}.{ext}` 等
- 覆盖上传 → URL 本身变化 → CDN/浏览器缓存天然 invalidate
- 不依赖 ETag / Last-Modified 协商（协商行为会与 CF Images Transform URL 交互产生未知副作用）

### 决策 5 · Storage Provider 抽象（IMG-06 P1 fixup）

```
interface StorageProvider
  R2StorageProvider      ← R2 三件套齐全时（生产）
    publicUrl(key):
      优先 R2_PUBLIC_BASE_URL（R2.dev 子域名 / CNAME / CF Images fetch 源）
      回退 R2_ENDPOINT（API endpoint） + 首次 stderr warn
  LocalFsStorageProvider ← R2 未配时（开发）
    write → LOCAL_UPLOAD_DIR（默认 .uploads）
    publicUrl → LOCAL_UPLOAD_PUBLIC_URL 前缀
    resolveFilePath → 路径穿越防御（400 INVALID_KEY）
```

- **原外部 review 发现**：`R2_ENDPOINT` 是 S3 API endpoint，浏览器 `<img src>` 加载会失败；需新增 `R2_PUBLIC_BASE_URL` env 优先读
- **保留回退路径**：向后兼容 SubtitleService 现有行为，生产需 + stderr warn 引导运营配置
- **LocalFs 非生产方案**：仅供开发者无 R2 环境下仍可端到端验证上传流；生产部署文档需强调必配 R2
- `GET /v1/uploads/*` route 由 `ImageStorageService.serveLocalFile()` 提供 stream + content-type；route 只 pipe（ADR-051 签字时的 P1 必改整改项，源码详见 `apps/api/src/services/ImageStorageService.ts:serveLocalFile`）

### 决策 6 · 写库失败补偿删除（IMG-06）

- `MediaImageService.upload()` 在 R2 / LocalFs 写成功 → 写库（`updateCatalogFields` / `updateBanner`）失败 → 立即调 `storage.delete(key)` 清理孤儿对象
- 避免"R2 有对象 + DB 指向旧 URL"的不一致
- 写库失败仍向上抛错（route 层返 500），由前端提示用户重试

### 决策 7 · blurhash 入队过滤（IMG-06）

- `imageHealthQueue.add('blurhash-extract', { type, catalogId, videoId, kind, url })`
- 仅 `kind ∈ { poster, backdrop, banner_backdrop }` 入队（这三个 kind 的 `media_catalog` 有 blurhash 列）
- `logo`（透明艺术字无主色意义）+ banner 类（`home_banners` 表暂无 blurhash 列）不入
- 未来为 `home_banners` 加 blurhash 列后，本过滤逻辑需同步放开（见"已知残留"R-banner-blurhash）

### 决策 8 · 前端字体（由 ADR-050 背书，M6 间接依赖）

- ADR-050 已采纳 Noto Sans + Noto Sans SC via `next/font/google`
- M6 build 附带 109 个 woff2 切片 + CSS `@font-face` 注入
- 本 ADR 不重复决策，仅声明依赖

---

### 已知残留（arch-reviewer 审计补充登记，签字通过但需后续处置）

| ID | 描述 | 处置计划 |
|----|------|---------|
| R-r2-endpoint-fallback | `R2_PUBLIC_BASE_URL` 未设时 `ImageStorageService` 会回退 `R2_ENDPOINT` (S3 API endpoint)；代码有 stderr warn + `.env.example` 说明 | 生产部署文档强调必配 + deploy 前自检脚本（未来 CHORE） |
| R-admin-17-pending | `VideoImageSection` + `BannerForm` 仅 2 处重复消费上传 UI，未达 3 处提取阈值 | ADMIN-17 预警：第 3 处出现时必须抽 `<ImageUploadField>` 共享组件 |
| R-cf-images-not-connected | M6 scope 明确"不实施对接"；env 就位后切 `IMAGE_LOADER=cloudflare` 即可启用 | 未来任务（IMG-09 或独立 ADR） |
| R-banner-blurhash | `home_banners` 无 blurhash 列（Migration 048 未扩），IMG-06 对 banner 不入 blurhash queue | 未来 migration 扩列后放开过滤（非 M6 scope） |
| R-uploads-route-layering | `GET /v1/uploads/*` 原初版直接 fs I/O 违反分层 | **已在 M6-CLOSE-01 修复**（`ImageStorageService.serveLocalFile()` + route pipe） |
| R-banner-two-step-ux | 新建 Banner → 保存 → 进入编辑页上传，UX 有摩擦；`CreateBannerInput.imageUrl` required + MediaImageService 要求 bannerId 存在 | 未来 IMG-09：评估 draft banner 或临时上传 key 改签协议 |
| R-stills-thumbnail-kind | `KindSchema` 允许 stills/thumbnail 传入，但 MediaImageService 对这两个 kind 返 400 | 建议后续把 Zod schema 收紧到 4 个 kind，或 Service 层支持后再开放 |
| R-upload-progress-no-refresh | `uploadWithProgress` 401 时不走 fetch 版的 token 自动 refresh；长耗时上传中途 token 过期需用户重选文件 | 设计决策，非 bug；UX 摩擦在 5MB 上限下罕见；若成本-价值比反转再 refactor |

---

### 测试覆盖（跨 M6-CDN 序列，+107 net case）

| 任务 | 测试文件 | case 数 |
|------|---------|---------|
| CDN-01 | `tests/unit/lib/next-image-loader.test.ts` | 8 |
| CDN-02 | `tests/unit/components/media/SafeImageNext.test.tsx` | 14 |
| CDN-02 fixup | `tests/unit/components/media/SafeImageNext.loader-integration.test.tsx` | 4 |
| IMG-06 storage | `tests/unit/api/imageStorageService.test.ts` | 23 |
| IMG-06 composer | `tests/unit/api/mediaImageService.test.ts` | 11 |
| IMG-06 fixup | `tests/unit/api/adminMediaUploadsRoute.test.ts` | 6 |
| IMG-07 + fixup | `tests/unit/components/admin/videos/VideoImageSection.test.tsx` | 21 |
| IMG-08 | `tests/unit/components/admin/banners/BannerForm.test.tsx` | +13 |
| **合计** | | **+107** |

全量：1447（M6 启动前）→ 1554（M6-CLOSE 前） → ADR-051 落盘后 full gate 重跑确认

---

### 历史 review 修复清单

| Review 来源 | 必改数 | 落地 commit |
|-------------|-------|-------------|
| arch-reviewer CDN-02 审定 | 4 | `9510d7f` |
| arch-reviewer IMG-06 审定 | 11 | `7aa02d2` |
| 外部 review（IMG-06 + CDN-02 4 发现） | 4 | `aef993c` + `f7833ab` |
| 外部 review（IMG-07 P2 2 发现） | 2 | `f7833ab` |
| arch-reviewer M6-CLOSE 审定 | 2（ADR-051 + Route 分层） | 本 commit |

---

### 与前序 ADR 的继承关系

- **ADR-035** 重写期路由切分：IMG-06 新 route `/admin/media/images` + `GET /uploads/*` 按现有 adminOnly middleware 挂载，未触动 ALLOWLIST（后台路径本身不经网关 rewrite）
- **ADR-037 v2** 三维闭环签字门禁：M6-CLOSE-01 严格走三维（arch-reviewer + 代理证据 + 用户真人 checklist）
- **ADR-045** 图片 url 校验迁移：本次不动
- **ADR-046** 图片管线（IMG-M1 阶段）：Migration 048 的字段本次全部消费到
- **ADR-047** Token 体系：M6 不改 Token
- **ADR-050** 字体族 Noto Sans：M6 间接依赖（build 附 109 woff2）

---

### 适用范围

- **本轮约束**：M6-CDN 6 张卡的所有 commit（4afb140 → 本 commit）
- **未来延续**：IMG-09（若有）/ ADMIN-17（若第 3 处出现）/ CF Images 实际接入（未来 ADR）均需以本 ADR 为基线
- **不溯及**：既有 IMG-M1/M2/M3/M4 不重审

---

## ADR-052：首页模块化编排表 home_modules

- **日期**：2026-04-22
- **状态**：Accepted
- **决策者**：arch-reviewer (claude-opus-4-7) · 主循环 claude-sonnet-4-6
- **关联**：ADR-037（三方案对齐）· ADR-046（多品牌 brand_scope 协议）· ADR-053（M7 scope 扩展）
- **对应交付**：`landing_plan_v1.md §M7` / `docs/handoff_20260422/` HANDOFF-02

### 背景

M5 交付的 `home_banners` 仅承载顶部轮播，首页其余模块（featured / top10 / type_shortcuts）此前由写死数据或临时接口供给。`landing_plan_v1.md` 要求以统一的模块化编排承载 4 类 slot，并满足：多品牌隔离（brand_scope 与 home_banners 对齐）、时间窗 + enabled 双重闸门、人工置顶 top10 与 period-based trending 解耦、可扩展承载异构内容（video / url / html / video_type）。

### 决策要点

1. **新建表 `home_modules`**（migration 050）。
2. **slot 枚举固定为 4 值**：`banner | featured | top10 | type_shortcuts`。新增 slot 必须走新 ADR。
3. **content_ref_type × slot 在 DB 层用 CHECK 强制**（`home_modules_ref_type_slot_compat`），而非仅文档约定。
4. **brand_scope 协议完全复用 ADR-046**：前台查询 `WHERE brand_scope = 'all-brands' OR brand_slug = $1`。
5. **top10 为人工置顶专用**。period-based trending 仍走 `listTrendingVideos`，两者不混用。
6. **trending_tag（migration 051）与 home_modules.top10 配套**：视频打标后可选择是否进 top10 slot；tag 本身独立可查（`listVideosByTrendingTag`）。
7. **硬删除而非软删除**：运营下线通过 `enabled=false`；DELETE 仅用于清理错误条目，与 home_banners 一致。
8. **metadata NOT NULL DEFAULT '{}'**：避免查询端 coalesce 分支；内容约束仅靠文档 + Service 层 zod 白名单。

### slot × content_ref_type 约束

| slot | 允许的 content_ref_type | content_ref_id 语义 |
|------|------------------------|---------------------|
| banner | video / external_url / custom_html | 视频 UUID / 外链 URL / 富文本片段 ID |
| featured | video | 视频 UUID |
| top10 | video | 视频 UUID（人工置顶） |
| type_shortcuts | video_type | VideoType 枚举字符串（movie / anime 等） |

### brand_scope 查询协议（继承 ADR-046）

```sql
WHERE slot = $1
  AND enabled = true
  AND (brand_scope = 'all-brands' OR brand_slug = $2)
  AND (start_at IS NULL OR start_at <= NOW())
  AND (end_at   IS NULL OR end_at   >  NOW())
ORDER BY ordering ASC, created_at ASC
```

### metadata 使用守则

- **允许**：自定义文案（title/subtitle 覆盖）、展示样式标记、custom_html 富文本载荷、埋点 tag
- **禁止**：enabled/ordering/时间窗（必须走列字段）、需要索引或 WHERE 过滤的字段、跨模块引用
- **Schema 演进**：metadata 内新增固定字段使用 3+ 次即升级为表列

### 索引策略

| 索引 | 覆盖场景 |
|------|----------|
| `(slot, brand_scope, brand_slug, ordering) WHERE enabled` | 前台主查询 |
| `(start_at, end_at) WHERE enabled` | 后台失效清单/cron |
| `(content_ref_type, content_ref_id)` | 级联失效反查 |

---

## ADR-053：M7 scope 扩展偏离声明（2→11 卡）

- **日期**：2026-04-22
- **状态**：Accepted（偏离声明）
- **决策者**：arch-reviewer (claude-opus-4-7) · 主循环 claude-sonnet-4-6
- **关联**：ADR-037 §2（偏离声明义务）· ADR-052（home_modules）
- **对应交付**：`docs/handoff_20260422/landing_plan_v1.md`

### 背景

`frontend_redesign_plan §M7` 原规划仅 2 卡（ESLint 禁色规则 / 视觉回归测试）。进入 M7 实施阶段，`landing_plan_v1.md`（已通过两轮 arch-reviewer PASS）与 `design_system_plan` 延续需求共同识别出首页改造的完整交付包，最终入队 SEQ-20260422-HANDOFF-V2（9 张主序列卡 + 1 张 PHASE 收尾 = 10 卡扩充），合计从 2 卡扩为 11 卡（含原 2 卡）。本 ADR 履行 ADR-037 §2 的偏离声明义务。

### 合法性论证

- 所有扩充内容归属 `landing_plan`（= `frontend_redesign_plan` 首页维度细化）+ `design_system_plan`（BrandProvider/i18n）+ `frontend_redesign_plan`（PageTransition/ESLint/视觉回归）
- 无任何新业务需求引入；无新依赖
- `landing_plan_v1.md` 本身经过两轮 arch-reviewer PASS（代理 ID `a5035ed3d8dd76dc3`）

### ADR-037 §2 偏离声明义务履行

| 义务项 | 履行说明 |
|--------|---------|
| 独立 ADR 记录 | 本 ADR-053 |
| arch-reviewer 子代理审计 | claude-opus-4-7 HANDOFF-02 审计，DECISION: APPROVED |
| PHASE COMPLETE 前 signoff | M7 完成前须补 `milestone_alignment_m7_*.md` + 再次 spawn arch-reviewer 验收 |

---

## ADR-054：MiniPlayer v1 不实现 video 跨容器 lift（HANDOFF-03 方案 B）

- **日期**：2026-04-22
- **状态**：Accepted（偏离声明 + v2.1 跟进）
- **决策者**：用户拍板 · arch-reviewer (claude-opus-4-7) HANDOFF-03 PASS
- **关联**：ADR-053（M7 scope 扩展）· landing_plan_v1 §6.5 BLOCKER 条款 · SEQ-202605XX-PLAYER-VIDEO-LIFT（v2.1 占位）
- **对应交付**：`docs/handoff_20260422/landing_plan_v1.md` §HANDOFF-03

### 背景

landing_plan_v1 §HANDOFF-03 验收清单第 5 项要求"主视图 ⇄ 浮窗切换视频不 reload、不跳进度"。HANDOFF-03 执行期间发现严重架构分歧：

- `<video>` 元素由 `packages/player-core/src/Player.tsx:710` 内部 `videoRef` 管理
- `<video>` 随 Player 组件 mount/unmount 生命周期
- 当前架构下**无法在不改 player-core 的前提下**实现 `<video>` 跨容器不 reload
- 实现该验收需要把 `<video>` 元素从 Player 组件外置到 GlobalPlayerHost 层（单例持有），Player 组件变 controller

按 landing_plan §6.5 BLOCKER 条款，主循环停下讨论，用户拍板**方案 B**。

### 决策

**MiniPlayer v1 接受当前架构限制**：
- 本卡（HANDOFF-03）交付：浮窗容器 + 拖拽 + 缩放 + 四角吸附 + localStorage 几何持久化 + Takeover 护栏 + 移动端严格屏蔽
- 验收项 5 "切换不 reload" **调整为**："切换时 video 自然重建，currentTime 由 M3 sessionStorage 续播逻辑（`playerStore.hydrateFromSession`）恢复，允许 ±1s 容差；可能听到短暂静音跳接"
- 留白项写入 `docs/handoff_20260422/manual_qa_m7_*.md`（M7 PHASE COMPLETE 前补）

**v2.1 独立序列 `SEQ-202605XX-PLAYER-VIDEO-LIFT` 跟进**：
- 目标：重构 player-core Player 组件，把 `<video>` 元素外置到 GlobalPlayerHost 层
- 前置：M7 封闭 + ADR-054 在案
- 依赖：`@resovo/player-core` 跨消费方 schema 决策（需独立 ADR + 双 opus 评审）

### 合法性论证

- 方案 B 不引入新依赖（HANDOFF-V2 0 依赖承诺持守）
- 不违反已采纳的 ADR（-035/-037/-039/-052/-053）
- M3 `persistToSession` 续播能力保证用户体验 floor（功能等价，视觉上多一次 loading）
- v2.1 决策延后不违反冻结期（属 `frontend_redesign_plan` 延续，同 ADR-053 精神）

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| full⇄mini 切换 loading 时长过长影响体验 | M3 已有预加载逻辑，实测多在 300-800ms；v2.1 彻底消除 |
| 用户感知"卡了一下"投诉 | manual_qa_m7 留白声明已记；UI 复核 Manual 项覆盖此动效瞬态 |
| 与未来 v2.1 架构重构冲突 | `<video>` 的 DOM 位置变化不影响 MiniPlayer 容器/拖拽/几何；v2.1 只替换 video 挂载点，MiniPlayer 的 `data-mini-video-slot` 保持作为 video 的目标容器 |

### ADR-037 §2 偏离声明义务履行

| 义务项 | 履行说明 |
|--------|---------|
| 独立 ADR 记录 | 本 ADR-054 |
| arch-reviewer 子代理审计 | claude-opus-4-7 HANDOFF-03 审计，DECISION: NEED_FIX → 2 条必改落地后 PASS；方案 B 合规性判定 PASS |
| PHASE COMPLETE 前 signoff | M7 完成前须在 `milestone_alignment_m7_*.md` 与 `manual_qa_m7_*.md` 显式列出本留白 |

---

## ADR-100: server-next 立项 + IA v0 + 单语言 + 依赖白名单

- **日期**：2026-04-28
- **状态**：已采纳（2026-04-30 修订：路由切分语义见下方 amendment block）
- **子代理**：arch-reviewer (claude-opus-4-6)
- **编号说明**：plan v2 §9 原分配 ADR-046/047/048，落盘前核对 `docs/decisions.md` 发现 046–054 全部已被前期 ADR 占用。用户裁定 B 方案（跳号至 100+ 区段，避开历史冲突，并使 server-next 系列 ADR 编号连续可识别）。
- **背景**：apps/server（旧后台）累积 9 大痛点（详见 `docs/admin_audit_20260426.md` §7），ModernDataTable 采纳率 58%，22 admin 模块/122 端点工程债务深；继续在 apps/server 内增量修复 ROI 低、风险高。Claude Design 已输出 v2.1 后台设计稿（IA 重排 + 16 视图 mock，详见 `docs/designs/backend_design_v2.1/`）。立项 apps/server-next 独立壳承接重写。
- **决策**：立项 apps/server-next 作为 admin 重写主体，沿用 ADR-031（重写期代码共存）+ ADR-037（里程碑对齐）模式；M-SN-7 cutover 后 apps/server 整体退场（详见 ADR-101）。

> **AMENDMENT 2026-04-30（CHG-DESIGN-11）**：
> 原决策段落"沿用 ADR-035（路由切分）"语义已被 server_next_plan_20260427.md §4.2 + kickoff R2 修订：
> - **开发期**：`/admin/*` 仍由 apps/server（:3001）承接；server-next 在 :3003 独立运行（hash route 或 /admin-next 占位入口，由开发自行选择）。**不**采用 ADR-035 风格的 ALLOWLIST / 逐页 nginx rewrite 切流；
> - **Staging 演练（CHG-SN-3-12，已暂停）**：在 staging nginx 把 `/admin/*` 的 upstream 临时切到 :3003，验证 cookie / refresh_token 跨服务透明；
> - **生产 cutover（M-SN-7）**：一次性 nginx upstream 切换，从 :3001 → :3003，apps/server 停服。
>
> 新的执行真源以 `docs/server_next_plan_20260427.md` §4.2（运行期路由策略）+ `docs/architecture.md` 部署拓扑章节为准。本段保留原文以追溯改写演进。
- **IA v0（27 路由占位）**：
  - **运营中心**：dashboard / moderation
  - **内容资产**：videos / sources / merge / subtitles / image-health
  - **采集中心**：crawler
  - **系统管理**：home / submissions / analytics / users / settings / audit + 5 个 system 子路由
  - **认证**：login
  - 共 21 主路由 + 5 system 子 + 1 login = 27 路由占位（IA 命名声明：v0 仅作为路由占位，hi-fi 阶段允许根据交互细化但不增减区段）
- **语言策略**：单语言 zh-CN —— 不引入 next-intl，无 `[locale]` 段，路径直接 `/admin/*`。理由：admin 用户全部为内部运营，无国际化需求；单语言降低工程复杂度（middleware / 路由 / 翻译键）。
- **依赖白名单**（M-SN 期间允许新增的依赖；超此列表触发 BLOCKER）：
  - **预批**（直接使用）：`@dnd-kit/core`、`@dnd-kit/sortable`（线路拖拽 / 表格列排序 / 看板拖拽通用基座）
  - **候选**（首次落地前必须 spawn arch-reviewer 二选一并立 ADR）：
    - 图表：`recharts` vs `visx`
    - DAG / 流程图：`reactflow` vs `dagre`
    - 大数据虚拟滚动：`@tanstack/react-virtual` vs `react-window`
  - **严禁**：admin 业务专属 design system 包（统一收编到 packages/admin-ui）；新状态管理引擎（Redux / MobX / Jotai）—— 沿用 zustand；CSS-in-JS（沿用 ADR-023 CSS 变量 + Tailwind 桥接）；ORM；GraphQL 客户端
- **核心理由**：
  1. apps/server 工程债务的根因是边界腐化（22 模块×122 端点散布），非局部 bug；重写比修复 ROI 高
  2. 设计稿 v2.1 已完成 IA 重排 + 16 视图，工程实施有完整起点
  3. 沿用 ADR-031/035/037 模式风险已知、回滚通路存在
  4. 单语言 + 依赖白名单 + ADR-端点先后协议（详见 plan §4.5）三道闸防止重写期再次失控
- **架构约束**：
  - 不复用 `apps/server/src/components/admin/shared/`（避免遗留组件 API 包袱）；新建 `packages/admin-ui` 收编共享组件（M-SN-2 创建空骨架）
  - 不修改 apps/api 既有端点契约；新端点（如 home_modules CRUD）须先立独立 ADR + Opus 评审（详见 plan §4.5）
  - 不引入 server-next 专属的设计 token 集（详见 ADR-102 token 三层）
  - 编译期 ESLint 边界（no-restricted-imports）+ ts-morph CI 兜底脚本 `scripts/verify-server-next-isolation.mjs`（plan §4.6），禁止 server-next 直接 import apps/server 内部模块
- **Non-Goals**（本 ADR 范围内）：
  - 不在本 ADR 内固化 cutover 协议（→ ADR-101）
  - 不在本 ADR 内固化 token 三层（→ ADR-102）
  - 不重设计前台 / 不改 schema / 不扩张权限模型 / 不接管 prod /admin/* 流量（M-SN-7 cutover 才接管）
- **影响文件**：
  - `apps/server-next/`（M-SN-1 创建工程骨架）
  - `packages/admin-ui/`（M-SN-2 创建空骨架）
  - `package.json` workspaces（M-SN-1/2 第一卡分别追加）
  - `docs/server_next_plan_20260427.md`（已落盘 v2，本 ADR 为其法律化）
  - `docs/architecture.md` §1+§1a+§2（已通过 R10 D5 同步）
- **关联**：ADR-022（token 单一真源）/ ADR-023（CSS 变量 + Tailwind 桥接）/ ADR-031（重写期共存）/ ADR-032（design-tokens 构建脚本）/ ADR-035（重写期路由切分，已 DEPRECATED）/ ADR-037（里程碑对齐）/ ADR-101（cutover 协议）/ ADR-102（token 三层）

### IA 修订段（v0 → v1，2026-04-28）

- **触发**：M-SN-1 milestone 验收（CHG-SN-1-08）在 B 级 PASS 后，M-SN-2 启动前的 IA 三层对齐审计发现 `apps/server-next/src/lib/admin-nav.ts`（CHG-SN-1-05 落地）与设计稿 v2.1 真源 `docs/designs/backend_design_v2.1/app/shell.jsx` 在命名 / 分组 / 暴露策略上存在 4 项偏离，且 plan §7 自身相对设计稿亦有偏离，未在落盘时显式记录。
- **真源链**：设计稿 v2.1 shell.jsx（行 10-35）+ info.md §01/§03（IA 命名表更新声明）。
- **子代理评审**：arch-reviewer (claude-opus-4-7)，独立审计 4 项偏离并裁决（CHG-SN-1-10）。

#### 4 项决策

| 编号 | 偏离点 | v0 实施 | v1 决策 | 关键依据 |
|---|---|---|---|---|
| IA-1 | dashboard label | "工作台"（admin-nav.ts:40）| **"管理台站"** | shell.jsx:12 + info.md §01/§03 显式声明 |
| IA-2 | analytics 去留 | 独立顶层 `/admin/analytics` 暴露侧栏 | **路由保留，侧栏不暴露**；M-SN-3 起内容并入 dashboard 内部 Tab/卡片库 | shell.jsx 5 组 NAV 无 analytics；不变约束禁止删 URL |
| IA-3 | 首页运营分组 | home/submissions 错放系统管理组 | **独立成"首页运营"组**（home + submissions）| shell.jsx:22-25 显式分组；语义边界清晰（对外运营 vs 对内运维）|
| IA-4 | system 5 子暴露 | 5 子（settings/cache/monitor/config/migration）全部暴露侧栏 | **侧栏只暴露"站点设置"（⌘,）**；其余 4 子路由保留但不暴露，作为 settings 容器的 Tab 面板（M-SN-3 实装容器化）| shell.jsx:32 仅暴露 settings 顶层；不变约束禁止删 URL |

#### 影响范围

- **plan §7**（行 519-565）：IA tree fenced code block + 视图数表同步修订（CHG-SN-1-10 已落盘）
- **admin-nav.ts**（apps/server-next/src/lib/admin-nav.ts）：ADMIN_NAV 常量 5 组结构改写（CHG-SN-1-11 落地）
- **路由文件（保留不暴露）**：
  - `apps/server-next/src/app/admin/analytics/page.tsx`
  - `apps/server-next/src/app/admin/system/cache/page.tsx`
  - `apps/server-next/src/app/admin/system/monitor/page.tsx`
  - `apps/server-next/src/app/admin/system/config/page.tsx`
  - `apps/server-next/src/app/admin/system/migration/page.tsx`
  - 5 个文件 head 注释新增："hidden in IA v1，详见 ADR-100 IA 修订段；M-SN-3 阶段改造为容器内嵌 Tab / 内容并入策略"（CHG-SN-1-11 落地）
- **M-SN-3（dashboard / settings 容器）落地任务**：
  - dashboard 落地时承接 analytics 卡片库内容（数据看板 Tab/分段）
  - settings 落地时承接 cache/monitor/config/migration 4 子的 Tab 面板形态（路由 → Tab 状态映射）
  - `/admin/system` landing 改 redirect 到 `/admin/system/settings`（避免裸访问产生孤儿页）

#### 不变约束（裁决前提）

- URL slug 优先英文，cutover 前禁止改 URL（plan §7 IA 命名声明 + plan §5.2 BLOCKER 第 8 条）
- 路由占位文件物理保留（避免 SSR 404 与潜在外链失效）
- 不引入 M-SN-1 已闭环资产（token / Provider / apiClient / 鉴权层）的返工
- Resovo 价值排序：正确性 > 边界 > 可扩展性 > 一致性 > 收敛

#### 剩余差异（cutover 前最终对账义务）

子代理评审记录的与设计稿 v2.1 的剩余差异（不在 v1 修订范围，由 M-SN-2 Sidebar 组件下沉时按 ADR 流程处理）：

1. **图标字段缺失**：shell.jsx 每个 item 携带 `icon`，admin-nav.ts AdminNavItem 类型无 icon 字段 → M-SN-2 Sidebar 组件下沉补字段
2. **快捷键标注缺失**：shell.jsx 暴露 ⌘1/⌘2/⌘3/⌘4/⌘5/⌘, 6 个快捷键，admin-nav.ts 未承载 shortcut 字段 → M-SN-2 同步补
3. **count / type 角标缺失**：shell.jsx NAV item 携带 `count` + `type: "warn" | "danger"` → M-SN-2 设计 count provider 接口

cutover（M-SN-7）前置义务：在 `manual_qa_m_sn_7_*.md` IA 对账小节执行：
1. 拉取设计稿最新版本 shell.jsx 的 NAV 结构
2. 与 admin-nav.ts ADMIN_NAV + plan §7 IA tree 三方逐项 diff
3. 对每条偏离做"采纳 / 拒绝并立 ADR"的二选一裁决
4. 对账签字写入 `milestone_alignment_m_sn_7_*.md` 的 IA 章节

#### 关联

- 关联卡：CHG-SN-1-05（IA v0 路由骨架，v0 落地）/ CHG-SN-1-08（M-SN-1 milestone 对账，发现偏离）/ CHG-SN-1-10（plan §7 IA v1 修订 + ADR-100 IA 修订段落盘，本卡）/ CHG-SN-1-11（admin-nav.ts IA v1 实装）
- 关联 plan：§7 IA tree + 视图数表同步修订
- 评审子代理：arch-reviewer (claude-opus-4-7) — IA 决策强制 Opus

---

## ADR-101: server-next cutover 协议（方案 E：独立壳 + nginx 反代 + 7 天保留 + 同 commit 改名）

- **日期**：2026-04-28
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：M-SN-0~6 期间 apps/server-next 在端口 3003 开发，apps/server 仍在 3001 接管 prod `/admin/*`。M-SN-7 需将 prod 流量从 server 切到 server-next，要求"无新链接（URL 不变）、原地接管、可秒级回滚、用户无感登出"。
- **决策**：方案 E — 独立壳 + nginx 反代 + 一次性切换 + 7 天保留。
  - 开发期：apps/server（3001）+ apps/server-next（3003）双服并存；nginx upstream 仍指 server:3001
  - cutover 当晚：单 commit 修改 nginx upstream 从 `server:3001` 切到 `server-next:3003`（实质是 docker-compose service 改名）；同 commit 内 `git mv apps/server-next apps/admin`（命名收尾）；package.json workspaces 同步
  - 7 天保留：apps/server 整目录物理保留，docker-compose 注释掉 service；7 天内可一键回切
  - 7 天后：删 apps/server 整目录 + workspaces 删条目 + commit
- **拒绝方案**：
  - **方案 A**（apps/server 内渐进重写）：架构债务延续，重写收益归零
  - **方案 B**（middleware rewrite 灰度，沿用 ADR-035）：admin 无 SEO / 爬虫诉求；admin 是内部运营工具（受众规模远小于前台用户面），原子切换比灰度更简单、回滚通路更短
  - **方案 C**（仅 cutover 不改名）：`apps/server-next` 名字含 "next" 暗示过渡，长期保留命名混乱
  - **方案 D**（仅改名不 cutover）：流量未切，改名无业务价值
- **端口分配**：
  - 开发期：apps/server 3001（旧）/ apps/server-next 3003（新）
  - cutover 后：apps/admin 3001（即 server-next 物理改名 + 端口接管；对 nginx 透明）
- **nginx 切流（ops/nginx.conf）**：
  - 开发期：`location /admin/ { proxy_pass http://server:3001; }`
  - cutover：单 commit 改为 `location /admin/ { proxy_pass http://admin:3001; }`（docker-compose service 名同步从 `server-next` → `admin`）
- **7 天保留期实施细节**：
  - apps/server 目录不动，仅 docker-compose service 注释（`# server: ... 7-day hold, scheduled removal: <date>`）
  - 期间 apps/admin 出现重大回归 → 反向 commit 回切 nginx + 取消注释 server service + docker-compose up（5 分钟内可恢复）
  - 7 天后无问题：发独立 commit 删 apps/server + workspaces 条目；commit message 写明"7 天保留期满，无回归告警"
- **回滚预案**：
  - **cutover 前置**：cutover commit 之前打 git tag `pre-server-next-cutover`（M-SN-7 入口动作），用作所有回滚的基线参照
  - **0–7 天**：nginx 反向单 commit 回切 + apps/server 容器恢复（≤ 5 分钟）
  - **7 天后**：从 `pre-server-next-cutover` tag 恢复 apps/server commit + 临时新建容器；**RTO ≤ 4h**（plan §10.1 / R7 DISCUSS-5）；前提是 schema/契约未变（详见数据兼容）
- **cutover 当晚验证窗口**：
  - 业务 KPI：审核台拒绝率不变 ±10%；采集任务失败率不上升 ±5%；视频库 admin 端 DAU 持平
  - 性能 KPI：p95 < 200ms（admin 内部页）；错误率 < 0.5%
  - 验证窗口：cutover 后 30 分钟连续达标 → 维持；任一指标异常 → 立即回滚
- **数据兼容性**：
  - apps/server 与 apps/server-next 共用 apps/api（`/v1`）+ 同一 PostgreSQL；cutover 不涉及 schema migration
  - 用户 session 通过 cookie 共享：`refresh_token` Path=/，Domain 同根，cutover 无登出
  - 7 天保留期内 schema 不允许变更（如必须变更，需先终止保留期 + 删 apps/server）
- **架构约束**：
  - cutover commit 必须是单一 commit（nginx + 改名 + workspaces 同步），便于反向 revert
  - cutover 前置 git tag `pre-server-next-cutover` 必须在 cutover commit 前推送（M-SN-7 入口动作）
  - cutover 前需通过 M-SN-6.5 非功能验收门（性能 / 可访问性 / 错误监控）
  - **M-SN-3 完成时须在 staging 环境完成 cookie + nginx 反代 e2e 演练**（plan §4.2）：验证 refresh_token 跨 server / server-next 透明、nginx upstream 切换不丢 session
  - 7 天保留期内不得对 apps/admin 做大规模重构（保持回滚可行）
- **Non-Goals**：
  - DNS 切换 / CDN 配置变更（同域内反代，对 DNS 透明）
  - 下沉 apps/server 内业务规则到 apps/api（已通过 services + queries 隔离）
  - 灰度按用户 / 按地区切分（不必要）
- **影响文件**：
  - `ops/nginx.conf`（cutover 单 commit 修改 upstream + service 名）
  - `docker-compose.dev.yml`、`docker-compose.prod.yml`（service 改名 server-next → admin；server 注释保留 7 天）
  - `apps/server/`（cutover 后注释保留；7 天后整目录删除）
  - `apps/server-next/` → `apps/admin/`（同 commit 改名）
  - `package.json` workspaces（删 apps/server，添加 apps/admin）
  - `docs/architecture.md` §1+§1a+§2（cutover 后同步：server → admin 改名 / 删 server 条目）
- **关联**：ADR-100（立项）/ ADR-031（重写期共存）/ ADR-037（里程碑对齐）

---

## ADR-102: server-next 设计 Token 三层收编 + 设计稿 v2.1 映射

- **日期**：2026-04-28
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-6)
- **背景**：apps/web-next 已有 `packages/design-tokens`（ADR-022 单一真源 / ADR-023 CSS 变量 + Tailwind 桥接 / ADR-032 手写构建脚本）。Claude Design v2.1 后台设计稿（`docs/designs/backend_design_v2.1/styles/tokens.css`）含 dark-first 五档 surface + dual-signal probe/render 调色板 + admin layout 变量。需明确 server-next 与 web-next 的共享 / 独享边界，避免污染前台 token、避免散落多份 token 真源。
- **决策**：token 分三层 — base / semantic / admin-layout，全部托管在 `packages/design-tokens`（避免散落）；前两层共享给 web-next + server-next，第三层为 server-next 专属命名空间（前台 0 消费）。
- **三层结构与字段映射**（来源：v2.1 `styles/tokens.css`，对齐 plan §4.3 三层划分）：

  | 层 | 子文件 / 字段范围 | 共享范围 | 来源 |
  |---|---|---|---|
  | **base** | `colors.css`（accent / on-accent / 原色 / 包括 probe/render 颜色源） / `typography.css`（font-family / fs-*） / `spacing.css`（s-*） / `radius.css`（r-*） / `shadow.css`（shadow-sm/md/lg） / `motion.css`（duration / easing） / border / border-strong / border-subtle | web-next + server-next 共享 | v2.1 `:root` + 现有 design-tokens |
  | **semantic** | `status.css`（ok / warn / danger / info / neutral + soft 变体） / `dual-signal.css`（probe / render 语义角色 + soft 变体；admin 主用、前台预留） / `surface.css`（bg0~bg4 dark-first 五档） / text / text-2 / muted / muted-2 | web-next + server-next 共享 | v2.1 设计稿 + 现有 design-tokens |
  | **admin-layout** | `shell.css`（sidebar-w / sidebar-w-collapsed / topbar-h） / `table.css`（row-h / row-h-compact / col-min-w） / `density.css` | server-next 专属（前台 0 消费） | v2.1 设计稿 |

  > **层级归属说明**：bg0~bg4 在 plan §4.3 归 `semantic/surface.css`（语义维度的"表面层级"），而非 base 层颜色——本 ADR 与 plan 对齐。motion 子层（duration / easing）属 base 共用层，本 ADR 一并收编（plan §4.3 列项）。

- **双信号 token 重要约束**：
  - `--probe`（cyan #38bdf8，HEAD/Content-Type 探测信号）+ `--render`（violet #a855f7，实际播放渲染信号）—— admin 业务独有视觉语义
  - 颜色源在 base/`colors.css`（与其他原色同级），语义角色在 semantic/`dual-signal.css` 暴露给 admin 业务消费
  - **禁止 apps/web-next 任何路由消费 dual-signal token**（编译期 ESLint 检查 + CI ts-morph 兜底）；前台保留接入位但 M-SN 期间 0 消费
- **主题策略**：
  - dark-first，`[data-theme="dark"]` 为默认；`[data-theme="light"]` 提供 base 层覆盖
  - server-next M-SN-1 仅实现 dark；light 后续视需求接入（不阻塞 cutover）
- **收编路径**：
  - **M-SN-1 第一卡**：v2.1 `styles/tokens.css` 的 base/semantic 字段并入 `packages/design-tokens/src/`；按层分文件（`base.ts` / `semantic.ts` / `admin-layout.ts`）；构建脚本（沿用 ADR-032）扩展支持三层导出
  - apps/web-next 不感知（base/semantic 命名兼容；新增字段不影响现有消费方）
  - apps/server-next RootLayout 引入 design-tokens CSS（与 web-next 同来源）+ 引入 admin-layout 字段
- **命名规则**：
  - base：维持 CSS 变量原名（如 `--bg2`、`--fs-14`）
  - semantic：维持现有 + 新增 `--ok-soft` / `--probe` / `--probe-soft` 等
  - admin-layout：顶级 CSS 变量，文档明确 admin-only（如 `--sidebar-w`）；不强制 `--admin-*` 前缀（沿用 design-tokens 现有惯例）；每个字段 CSS 注释 `/* admin-only */` 便于 grep / ESLint scope
- **影响文件**：
  - `packages/design-tokens/src/base.ts`（新增或拆分）
  - `packages/design-tokens/src/semantic.ts`（新增或拆分）
  - `packages/design-tokens/src/admin-layout.ts`（新增）
  - `packages/design-tokens/build.ts`（ADR-032 手写脚本扩展三层支持）
  - `apps/server-next/src/app/globals.css`（M-SN-1 引入）
  - `docs/architecture.md` §17（HANDOFF-01 后续，附 v2.1 映射表）
- **Non-Goals**：
  - 不重设计 packages/design-tokens 浏览页（admin `/system/design-tokens`）
  - 不引入 CSS-in-JS（沿用 ADR-023）
  - base/semantic 仅"扩展"非"替换"（apps/web-next 现有调色 100% 兼容）
  - 不在本 ADR 内固化 token 浏览页 admin 端 UI 改造（属 M-SN-5 视图工作）
- **架构约束**（plan §4.3 硬约束沉淀）：
  - server-next 业务组件禁止硬编码颜色 / 字号 / 间距 / 圆角值 —— ESLint `no-hardcoded-color` 已存在，扩展覆盖范围
  - 三层 token 必须保持向前兼容：删除字段须先 ADR + 全仓 grep 证明 0 消费
  - **base / semantic 任何字段新增** → 必须 spawn arch-reviewer (Opus) 评审 + ADR 续编（plan §4.3 硬约束 1）
  - **admin-layout 新增字段** → 主循环可直接落，但需在 milestone 阶段审计中报备（plan §4.3 硬约束 2）
  - **设计稿与 packages/design-tokens 不一致时**，packages 是真源（plan §4.3 硬约束 3）
- **退役时机**：admin-layout 第三层与 apps/server-next（cutover 后 apps/admin）生命周期绑定；server-next 退役（不在规划内）一并退役

### 修订记录 · 与 design-tokens 现状对齐（2026-04-28，CHG-SN-1-03 摸现状阶段）

CHG-SN-1-03 启动时摸清 `packages/design-tokens` 实际为 **4 层成熟系统**（primitives / semantic / components / brands），ADR-102 起草时未深入摸清现状，原"三层（base/semantic/admin-layout）"措辞与现实不符。用户裁定方案 A：保现状 + 新增 admin-layout 层；本节追认。

**修订后的最终结构（4+1 层）**：

| 层 | 现状角色 | 对应 ADR-102 原"3 层" | 由谁支撑 |
|---|---|---|---|
| **primitives/** | 原子 token（color / typography / space / radius / shadow / motion / z-index / size） | ≈ base 层（命名差异，语义等价） | ADR-022 / ADR-023 / ADR-032 |
| **semantic/** | 语义 token（state / tag / surface / border / route-stack / stack；本卡内补 dual-signal） | = semantic 层 | ADR-022 |
| **admin-layout/** *(本卡新增)* | admin 专属布局变量（shell / table / density） | = admin-layout 层 | ADR-102（本 ADR） |
| **components/** | 组件级 token（table / modal / input / player / button / card / tooltip / tabs） | ADR-102 原 3 层未涵盖；现状保留 | ADR-022（隐式容纳） |
| **brands/** | 多品牌 token（default + _validate / _patch / _resolve） | ADR-102 原 3 层未涵盖；现状保留 | ADR-038 / ADR-039 |

**对原 ADR-102 决策的 supersede 关系**：
- 原"分三层"措辞 → **修订为"在现有 4 层基础上新增 admin-layout 层（4+1 层结构）"**
- 原 base 层映射 → **保留为 primitives/ 现名**（语义等价；不重命名以避免对 web-next 引用面的冲击）
- 原"三层结构与字段映射表"（surface 归 semantic / motion 归 base）—— **保留映射意图**，仅落点改为 primitives/motion.ts（如缺）+ semantic/surface.ts（已有）
- dual-signal token（probe / render）—— **新增到 semantic/dual-signal.ts**（本 ADR 原始设计不变）
- admin-layout/ 顶级目录新增 —— **本 ADR 原始设计不变**

**未受影响的 ADR-102 决策**：
- 三条硬约束（base/semantic 新增 → ADR + Opus / admin-layout 新增 → milestone 报备 / 设计稿与 packages 不一致以 packages 为真源）—— 全部保留，仅"base 层"在执行时映射到"primitives 层"
- dual-signal 跨域消费禁令（前台 0 消费）—— 保留
- 命名规则、退役时机、影响文件 —— 保留
- 关联 ADR —— 保留

**结论**：方案 A 让 ADR-102 的核心决策（admin-layout 层独立 / dual-signal 引入 / 三条硬约束 / 跨域禁令）100% 落地，仅"层数与命名"措辞贴合现状；不触发对 ADR-022/023/032/038/039 的级联 supersede。

- **关联**：ADR-022（token 单一真源）/ ADR-023（CSS 变量 + Tailwind 桥接）/ ADR-032（design-tokens 构建）/ ADR-037（里程碑对齐）/ ADR-038（双轨主题，brands 层支撑）/ ADR-039（middleware 品牌识别，brands 层支撑）/ ADR-100（立项）/ ADR-101（cutover）

---

## ADR-103a: packages/admin-ui Shell 公开 API 契约 + AdminNavItem 5 字段扩展协议 + 4 级 z-index 规范

- **日期**：2026-04-28
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-7) — Shell API 契约决策强制 Opus（CLAUDE.md 模型路由规则第 1 / 3 项）
- **起草模型**：claude-opus-4-7
- **关联序列**：SEQ-20260428-03（M-SN-2 第一阶段 — Shell 落地）
- **关联卡**：CHG-SN-2-01（本 ADR 起草）/ CHG-SN-2-02（admin-nav.ts 字段扩展 + admin-layout token 新增 z-shell-*）/ CHG-SN-2-03 ~ CHG-SN-2-12（Shell 10 组件分卡实施）

### 背景

M-SN-2 启动前 plan §6 v2.2 范围漏列 Shell 编排层 10 组件。CHG-SN-1-12 子代理评审（arch-reviewer claude-opus-4-7）独立审计后，与用户人工 sign-off 接受方案 B：plan §6 M-SN-2 范围由"数据原语单层"扩列为"Shell 编排层 + 数据原语层 + 公开 API 契约前置 + 演示页"四块结构，工时由 2.5w 上调至 3w（+20%，未触发 BLOCKER §5.2 第 11 条 +30% 阈值），总周期由 17.5w 调整至 18.0w（plan v2.3，`docs/server_next_plan_20260427.md:904-945`）。

设计稿 v2.1 `docs/designs/backend_design_v2.1/app/shell.jsx:10-300` 给出完整 Sidebar / Topbar / CmdK / AdminShell 实现作为视觉与交互的参考真源，但其形态是 React 单文件 demo（NAV 内联硬编码 / icon 由全局 `I` 注入 / `localStorage` 模块顶层访问 / `document.addEventListener` 模块外触发），不能直接作为 packages/admin-ui 的公开 API 契约。需要在 M-SN-2 第一张组件卡（CHG-SN-2-02）开工前固化：

1. Shell 10 组件公开导出名 + 文件路径 + Props TypeScript 类型骨架 + "不做什么"边界
2. `AdminNavItem` 当前类型签名（`apps/server-next/src/lib/admin-nav.ts:43-47`）只有 `label` / `href` / `children` 三字段；Shell Sidebar 渲染需要 `icon` / `count` / `badge` / `shortcut` 4 个新字段，且需附 `AdminNavCountProvider` 接口承载运行时计数
3. 4 级 z-index 规范（业务 Drawer < Shell 抽屉 < CmdK < Toast）在 CHG-SN-1-12 评审中已提出层级关系但未给具体数值

ADR-100 IA 修订段（`docs/decisions.md:2104-2117`）已声明"图标字段缺失 / 快捷键标注缺失 / count + type 角标缺失"三项剩余差异由 M-SN-2 Sidebar 组件下沉时按 ADR 流程处理，本 ADR 即为该承诺的兑现文本。

本 ADR 是 M-SN-2 全部 Shell 组件卡的硬前置门：未 PASS 不得开工 CHG-SN-2-02 及后续 Shell 卡。

### 决策

#### 4.1 Shell 10 组件公开 API 契约

10 组件全部位于 `packages/admin-ui/src/shell/`，并通过 `packages/admin-ui/src/index.ts` 桶导出。Props 全部 `readonly`（不可变契约），事件回调命名采用 `on<Verb>` 规范，所有跨边界 string 字面量值域以 union 收敛（不允许 `string` 兜底）。

##### 4.1.1 `<AdminShell>` — 顶层壳层容器

- **文件**：`packages/admin-ui/src/shell/admin-shell.tsx`
- **导出**：`AdminShell`（默认导出 + 命名导出）
- **职责**：编排 Sidebar + Topbar + main 区 + ToastViewport + CommandPalette + KeyboardShortcuts + NotificationDrawer + TaskDrawer；持有 sidebar 折叠态（受控/非受控双模式）+ Drawer 互斥开闭态（CmdK / NotificationDrawer / TaskDrawer 同时只开一个）；向子组件透传 onNavigate；不持有业务数据本体（数据由 props 注入），不直连 apiClient。
- **不做**：不做面包屑推断（消费方调 `inferBreadcrumbs(activeHref, nav)` helper 后通过 `crumbs` prop 注入；undefined 时 Topbar 不渲染面包屑）；不持有路由状态（由 `onNavigate` 外置）；不持久化折叠态（由 server-next 应用层用 cookie 持久化后通过 `defaultCollapsed` 注入，避免 Edge Runtime 顶层 localStorage 副作用）；不内置主题切换逻辑（由 `<Topbar>` 的 `onThemeToggle` 外提）；不获取通知/任务数据（由 SWR / RSC 在消费方侧获取后通过 `notifications` / `tasks` prop 注入；本组件仅做编排与回调透传）。

```typescript
export interface AdminShellProps {
  /** 当前激活路由 href（Sidebar 高亮 + 消费方调 inferBreadcrumbs 的输入 + CmdK 默认锚点）*/
  readonly activeHref: string
  /** 5 组 NAV 数据（透传到 Sidebar / CommandPalette / KeyboardShortcuts）*/
  readonly nav: readonly AdminNavSection[]
  /** 面包屑节点；为 undefined 时 Topbar 不渲染面包屑（消费方按需调 4.1.9 inferBreadcrumbs 后注入）*/
  readonly crumbs?: readonly BreadcrumbItem[]
  /** Topbar 5 类按钮图标插槽（必填；零图标库依赖约束 4.4-4 的兑现入口）*/
  readonly topbarIcons: TopbarIcons
  /** 健康指标（Topbar 渲染）；undefined 时不显示 HealthBadge */
  readonly health?: HealthSnapshot
  /** count provider（运行时计数；返回值优先于 AdminNavItem.count 静态值）*/
  readonly countProvider?: AdminNavCountProvider
  /** 当前用户（UserMenu 渲染）；未登录态由消费方拦截，本组件不做兜底 */
  readonly user: AdminShellUser
  /** 主题（'dark' | 'light'）；与 BrandProvider 解耦，由消费方持有真源 */
  readonly theme: 'dark' | 'light'
  /** 折叠态（受控）；undefined 时进入非受控模式 + 使用 defaultCollapsed */
  readonly collapsed?: boolean
  /** 折叠态默认值（非受控模式生效）；服务端 cookie 注入用 */
  readonly defaultCollapsed?: boolean
  /** 通知数据（由消费方 SWR / RSC 注入）；undefined 时 Topbar 通知图标禁用，NotificationDrawer 不挂载 */
  readonly notifications?: readonly NotificationItem[]
  /** 任务数据（同 notifications）*/
  readonly tasks?: readonly TaskItem[]
  /** 路由跳转回调（注入 Next.js router.push 等）；不抛 Promise */
  readonly onNavigate: (href: string) => void
  /** 主题切换回调 */
  readonly onThemeToggle: () => void
  /** 用户菜单动作回调（6 项 union）*/
  readonly onUserMenuAction: (action: UserMenuAction) => void
  /** 折叠态变更回调（受控/非受控双模式都触发，便于持久化）*/
  readonly onCollapsedChange?: (next: boolean) => void
  /** 通知项点击回调（透传给 NotificationDrawer.onItemClick）；undefined 时通知项不可点击 */
  readonly onNotificationItemClick?: (item: NotificationItem) => void
  /** 全部已读回调（透传给 NotificationDrawer.onMarkAllRead）；undefined 时按钮隐藏 */
  readonly onMarkAllNotificationsRead?: () => void
  /** 任务取消回调（透传给 TaskDrawer.onCancel）；undefined 时取消按钮隐藏 */
  readonly onCancelTask?: (taskId: string) => void
  /** 任务重试回调（透传给 TaskDrawer.onRetry）；undefined 时重试按钮隐藏 */
  readonly onRetryTask?: (taskId: string) => void
  /** 主区域内容 */
  readonly children: React.ReactNode
}

export interface AdminShellUser {
  readonly id: string
  readonly displayName: string
  readonly email: string
  readonly role: string
  readonly avatarText: string
}

export type UserMenuAction =
  | 'profile'
  | 'preferences'
  | 'theme'
  | 'help'
  | 'switchAccount'
  | 'logout'
```

##### 4.1.2 `<Sidebar>` — 5 组 NAV 渲染 + 折叠态

- **文件**：`packages/admin-ui/src/shell/sidebar.tsx`
- **导出**：`Sidebar`
- **职责**：按 `nav` 渲染 5 组分组（设计稿 v2.1 `shell.jsx:10-35` NAV 结构 1:1）；折叠态/展开态双形态；count 徽章 + 折叠态 pip + 折叠态 tooltip；底部用户区（`sb__foot` 触发 UserMenu）。
- **不做**：不持有 active 状态（由 `activeHref` prop 注入）；不实现键盘快捷键（由 `<KeyboardShortcuts>` 集中处理）；不做路由跳转（由 `onNavigate` prop）。

```typescript
export interface SidebarProps {
  readonly nav: readonly AdminNavSection[]
  readonly activeHref: string
  readonly collapsed: boolean
  readonly user: AdminShellUser
  /** 折叠态切换（含点击折叠按钮 + 快捷键 ⌘B 触发）*/
  readonly onToggleCollapsed: () => void
  readonly onNavigate: (href: string) => void
  readonly onUserMenuAction: (action: UserMenuAction) => void
  /** count provider 已求值结果（AdminShell 调度层传入；Sidebar 不持有 provider 本体）*/
  readonly counts?: ReadonlyMap<string, number>
}
```

##### 4.1.3 `<Topbar>` — 面包屑 + 全局搜索触发 + 健康指标 + 主题切换 + 任务/通知/设置图标

- **文件**：`packages/admin-ui/src/shell/topbar.tsx`
- **导出**：`Topbar` + `TopbarIcons`
- **职责**：渲染面包屑（按 `crumbs` prop 直接渲染，本组件不调用 `inferBreadcrumbs`）+ 全局搜索触发器（点击触发 onOpenCommandPalette）+ 可选 `<HealthBadge>` + 主题切换按钮 + 三枚图标按钮（任务 / 通知 / 设置）。所有图标节点（5 类按钮 icon）通过 `icons` prop 由 server-next 应用层注入 ReactNode；本组件零图标库依赖（4.4 硬约束 4）。
- **不做**：不实现 CmdK 弹层（由 `<CommandPalette>`）；不持有任务/通知 Drawer 开闭状态（提交回调给 AdminShell 编排层）；不直连 apiClient 拉取 health；不内置任何图标库（lucide-react / heroicons 等由 server-next 持有）；不调用 `inferBreadcrumbs`（由 AdminShell 调用方提前注入）。

```typescript
/** Topbar 5 类按钮图标插槽（server-next 应用层注入 ReactNode，零图标库依赖）*/
export interface TopbarIcons {
  readonly search: React.ReactNode
  readonly theme: React.ReactNode  // 同一插槽渲染当前态（theme='dark' 时显示 sun，'light' 时显示 moon；切换语义由消费方决定 ReactNode 内容）
  readonly notifications: React.ReactNode
  readonly tasks: React.ReactNode
  readonly settings: React.ReactNode
}

export interface TopbarProps {
  readonly crumbs: readonly BreadcrumbItem[]
  readonly theme: 'dark' | 'light'
  readonly icons: TopbarIcons
  readonly health?: HealthSnapshot
  readonly notificationDotVisible?: boolean
  readonly runningTaskCount?: number
  readonly onOpenCommandPalette: () => void
  readonly onThemeToggle: () => void
  readonly onOpenNotifications: () => void
  readonly onOpenTasks: () => void
  readonly onOpenSettings: () => void
}
```

> **图标注入约定**：`icons` prop 为必填，5 个字段必须全部提供（Shell 内部不做 fallback 占位，避免视觉断层）。HealthBadge dot 颜色由 `HealthSnapshot.*.status` 驱动 semantic.status token，不属 icon 注入范畴。Sidebar 内的折叠 chevron + UserMenu 菜单项 icon 用内联 SVG（packages/admin-ui 自持的零依赖矢量），不通过 prop 注入；唯有 Topbar 5 类业务图标因与设计稿语义强相关（lucide-react 形态）必须由消费方注入。

##### 4.1.4 `<UserMenu>` — 用户菜单下拉 6 项动作

- **文件**：`packages/admin-ui/src/shell/user-menu.tsx`
- **导出**：`UserMenu`
- **职责**：6 项菜单（profile / preferences / theme / help / switchAccount / logout）；外部点击关闭；ESC 关闭；focus trap。
- **不做**：不实现 logout 业务逻辑（由消费方 `onAction('logout')` 接管）；不持有 user 数据获取。

```typescript
export interface UserMenuProps {
  readonly open: boolean
  readonly user: AdminShellUser
  readonly onClose: () => void
  readonly onAction: (action: UserMenuAction) => void
  /** 锚点元素（用于定位 + 点击外部判定）*/
  readonly anchorRef: React.RefObject<HTMLElement>
}
```

##### 4.1.5 `<NotificationDrawer>` + `<TaskDrawer>` — 右侧滑入双面板

- **文件**：`packages/admin-ui/src/shell/notification-drawer.tsx` + `packages/admin-ui/src/shell/task-drawer.tsx`
- **导出**：`NotificationDrawer` / `TaskDrawer`
- **职责**：设计稿 §08 右侧滑入面板；可堆叠互斥（同时只能开一个，由 AdminShell 编排）；ESC 关闭 + 点击遮罩关闭；focus trap；z-index 取 `--z-shell-drawer`（见 4.3）。
- **不做**：不持有数据（数据由消费方通过 `items` prop 传入；空态由消费方决定）；不实现轮询（数据更新由消费方 SWR 等机制）；不与 apiClient 耦合。

```typescript
export interface NotificationDrawerProps {
  readonly open: boolean
  readonly items: readonly NotificationItem[]
  readonly onClose: () => void
  readonly onItemClick?: (item: NotificationItem) => void
  readonly onMarkAllRead?: () => void
}

export interface NotificationItem {
  readonly id: string
  readonly title: string
  readonly body?: string
  readonly level: 'info' | 'warn' | 'danger'
  readonly createdAt: string  // ISO 8601
  readonly read: boolean
  readonly href?: string
}

export interface TaskDrawerProps {
  readonly open: boolean
  readonly items: readonly TaskItem[]
  readonly onClose: () => void
  readonly onCancel?: (taskId: string) => void
  readonly onRetry?: (taskId: string) => void
}

export interface TaskItem {
  readonly id: string
  readonly title: string
  readonly status: 'pending' | 'running' | 'success' | 'failed'
  readonly progress?: number  // 0-100
  readonly startedAt: string
  readonly finishedAt?: string
  readonly errorMessage?: string
}
```

##### 4.1.6 `<CommandPalette>` — ⌘K 命令面板

- **文件**：`packages/admin-ui/src/shell/command-palette.tsx`
- **导出**：`CommandPalette`
- **职责**：3 组（导航 / 快捷操作 / 搜索结果）渲染；输入过滤（不区分大小写 + label substring）；键盘导航（↑↓ Enter Esc）；mouse hover 同步 active；ESC / 点击遮罩关闭。
- **不做**：不内置导航分组（由消费方按 `nav` + 自定义 actions 组装 `groups` 注入）；不实现远程搜索（搜索结果组由消费方异步注入；本组件只做客户端过滤）；不与路由耦合。

```typescript
export interface CommandPaletteProps {
  readonly open: boolean
  readonly groups: readonly CommandGroup[]
  readonly onClose: () => void
  readonly onAction: (item: CommandItem) => void
  readonly placeholder?: string
}

export interface CommandGroup {
  readonly id: string
  readonly label: string
  readonly items: readonly CommandItem[]
}

export interface CommandItem {
  readonly id: string
  readonly label: string
  readonly icon?: React.ReactNode
  readonly shortcut?: string  // 'mod+k' 规范化字符串
  readonly meta?: string      // 右侧灰字（如 'G then M'）
  /** action 类型：'navigate' 触发 onAction 后由消费方 router.push；'invoke' 触发自定义副作用 */
  readonly kind: 'navigate' | 'invoke'
  readonly href?: string  // kind='navigate' 时必填
}
```

##### 4.1.7 `<ToastViewport>` + `useToast()` — zustand 单例

- **文件**：`packages/admin-ui/src/shell/toast-viewport.tsx` + `packages/admin-ui/src/shell/use-toast.ts` + `packages/admin-ui/src/shell/toast-store.ts`
- **导出**：`ToastViewport` / `useToast`
- **职责**：viewport 渲染队列（默认右下；可通过 `position` 切换 4 角）；`useToast()` 返回 `{ push, dismiss, dismissAll }` API；queue 上限默认 5 条溢出 FIFO；自动消失 timeout 默认 4000ms（level='danger' 不自动消失）。
- **架构约束**：以 zustand 单例 store 而非 Context Provider 持有队列（plan §4.4 Provider 不下沉硬约束）；store 模块顶层零副作用；多个 ViewPort 实例共享同一 store。
- **不做**：不实现 SSR pre-render queue（toast 仅在 client mount 后激活）；不与 i18n / brand 耦合。

```typescript
export interface ToastViewportProps {
  readonly position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  readonly maxQueue?: number  // 默认 5
}

export interface ToastInput {
  readonly title: string
  readonly description?: string
  readonly level: 'info' | 'success' | 'warn' | 'danger'
  /** 自动消失毫秒数；undefined → level='danger' 不自动；其余 4000 */
  readonly durationMs?: number
  /** 操作按钮（最多 1 个）*/
  readonly action?: { readonly label: string; readonly onClick: () => void }
}

export interface UseToastReturn {
  readonly push: (input: ToastInput) => string  // 返回 toastId
  readonly dismiss: (toastId: string) => void
  readonly dismissAll: () => void
}

export function useToast(): UseToastReturn
```

##### 4.1.8 `<HealthBadge>` — Topbar 健康三项指标

- **文件**：`packages/admin-ui/src/shell/health-badge.tsx`
- **导出**：`HealthBadge` + `HealthSnapshot`
- **职责**：渲染 3 项健康指标（采集 / 失效率 / 待审），每项含 dot（颜色取自 semantic.status token）+ label；首项 dot 加 pulse 动画。
- **不做**：不轮询数据（由消费方注入 `snapshot`）；不渲染数值变化动画。

```typescript
export interface HealthBadgeProps {
  readonly snapshot: HealthSnapshot
}

export interface HealthSnapshot {
  readonly crawler: { readonly running: number; readonly total: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly invalidRate: { readonly rate: number; readonly status: 'ok' | 'warn' | 'danger' }
  readonly moderationPending: { readonly count: number; readonly status: 'ok' | 'warn' | 'danger' }
}
```

##### 4.1.9 `<Breadcrumbs>` — 面包屑

- **文件**：`packages/admin-ui/src/shell/breadcrumbs.tsx`
- **导出**：`Breadcrumbs` + `inferBreadcrumbs(activeHref, nav)` helper
- **职责**：按 `items` 渲染面包屑（最后一项用 `<strong>`）；`inferBreadcrumbs` helper 从 nav + activeHref 推断 section.title + item.label。
- **不做**：不实现可点击跳转（默认纯文本；如需点击由消费方传 `onItemClick`）。

```typescript
export interface BreadcrumbsProps {
  readonly items: readonly BreadcrumbItem[]
  readonly onItemClick?: (item: BreadcrumbItem, index: number) => void
}

export interface BreadcrumbItem {
  readonly label: string
  readonly href?: string
}

export function inferBreadcrumbs(
  activeHref: string,
  nav: readonly AdminNavSection[],
): readonly BreadcrumbItem[]
```

##### 4.1.10 `<KeyboardShortcuts>` + `IS_MAC` / `MOD_KEY_LABEL` / `formatShortcut()`

- **文件**：`packages/admin-ui/src/shell/keyboard-shortcuts.tsx` + `packages/admin-ui/src/shell/platform.ts`
- **导出**：`KeyboardShortcuts` 组件 + `IS_MAC` / `MOD_KEY_LABEL` / `formatShortcut(spec: string): string` / `parseShortcut(spec: string): ShortcutMatcher`
- **职责**：组件挂载时注册全局 keydown 监听（`window.addEventListener` 在 `useEffect` 内，符合 Edge Runtime 顶层零副作用约束）；按 `bindings` 数组分发；卸载时清理监听。`formatShortcut('mod+1')` 在 Mac 输出 `'⌘1'`，其他平台输出 `'Ctrl+1'`。
- **平台检测**：`IS_MAC` 通过 `useEffect` 内 `navigator.platform / userAgent` 检测；模块顶层导出的常量用 `false` 默认（SSR 安全），运行时第一次 mount 时由 `useEffect` 检测 `navigator` 后纠正。
- **不做**：不持久化绑定；不与 React Router 耦合；不内置任何快捷键（由 AdminShell 注入完整 bindings）。

```typescript
export interface KeyboardShortcutsProps {
  readonly bindings: readonly ShortcutBinding[]
}

export interface ShortcutBinding {
  readonly id: string
  /** 'mod+k' / 'mod+b' / 'mod+1' / 'mod+,' / 'shift+v' / 'esc' 规范化字符串 */
  readonly spec: string
  readonly handler: (event: KeyboardEvent) => void
  /** 在 input/textarea/contenteditable 聚焦时是否触发；默认 false */
  readonly allowInInput?: boolean
}

export const IS_MAC: boolean
export const MOD_KEY_LABEL: '⌘' | 'Ctrl'
export function formatShortcut(spec: string): string
export interface ShortcutMatcher {
  readonly mod: boolean
  readonly shift: boolean
  readonly alt: boolean
  readonly key: string
}
export function parseShortcut(spec: string): ShortcutMatcher
```

##### 4.1.11 桶导出

```typescript
// packages/admin-ui/src/index.ts（追加）
export * from './shell/admin-shell'
export * from './shell/sidebar'
export * from './shell/topbar'
export * from './shell/user-menu'
export * from './shell/notification-drawer'
export * from './shell/task-drawer'
export * from './shell/command-palette'
export * from './shell/toast-viewport'
export * from './shell/use-toast'
export * from './shell/health-badge'
export * from './shell/breadcrumbs'
export * from './shell/keyboard-shortcuts'
export * from './shell/platform'
```

#### 4.2 AdminNavItem 5 字段扩展协议

`apps/server-next/src/lib/admin-nav.ts:43-47` 当前类型签名扩展为 5 字段（icon / count / badge / shortcut / children），并新增 `AdminNavCountProvider` 接口承载运行时计数。

```typescript
// apps/server-next/src/lib/admin-nav.ts（CHG-SN-2-02 扩展后）
export interface AdminNavItem {
  readonly label: string
  readonly href: string
  /** 图标节点（由 server-next 应用层注入；packages/admin-ui 不依赖 lucide-react）*/
  readonly icon?: React.ReactNode
  /** 静态计数（编译期回退值）；AdminShellProps.countProvider 的 runtime 返回值优先于本字段 */
  readonly count?: number
  /** 角标语义（控制 dot/count 颜色；undefined → neutral）*/
  readonly badge?: 'info' | 'warn' | 'danger'
  /** 规范化快捷键字符串（'mod+1' / 'mod+,'）；formatShortcut() 渲染期映射平台标签 */
  readonly shortcut?: string
  readonly children?: readonly AdminNavItem[]
}

/** count 运行时供给（CHG-SN-2-02 新增）*/
export interface AdminNavCountProvider {
  /** 同步求值；返回 ReadonlyMap<href, count>；M-SN-2 落地 stub 返 empty */
  (): ReadonlyMap<string, number>
}
```

**5 字段语义说明表**：

| 字段 | 必填性 | 值域 | 处理决策 |
|---|---|---|---|
| `icon` | 可选 | `React.ReactNode` | 由 server-next 应用层 import lucide-react 后直注（packages/admin-ui 零图标库依赖，plan §4.7）；折叠态可见，展开态可见 |
| `count` | 可选 | `number ≥ 0` | 编译期静态值；runtime 优先消费 `countProvider` 返回值；显示规则 >999 时缩写为 `1.2k` |
| `badge` | 可选 | `'info' \| 'warn' \| 'danger'` union | 控制 count 徽章背景色 / 折叠态 pip 颜色；颜色源 semantic.status token；undefined 时 neutral |
| `shortcut` | 可选 | 规范化字符串（`mod+x` / `mod+,` / `shift+v`） | 不允许平台特定字符串（如 `'⌘1'`）；由 `formatShortcut()` 渲染期映射；CommandPalette + Sidebar 折叠 tooltip + UserMenu 共享渲染逻辑 |
| `children` | 可选 | `readonly AdminNavItem[]` | 已存在字段；M-SN-2 不引入 Sidebar 二级展开（保留字段供未来 system 容器 Tab / Drawer 内部子项使用）|

**ADMIN_NAV 改写预期示例**（server-next 应用层；CHG-SN-2-02 落盘）：

```typescript
// apps/server-next/src/lib/admin-nav.ts（改写后片段）
import { Layers, Inbox, Film, Link2, Merge, FileText, Image, Banner, Flag, Spider, Users, Settings } from 'lucide-react'

export const ADMIN_NAV: readonly AdminNavSection[] = [
  {
    title: '运营中心',
    items: [
      { label: '管理台站', href: '/admin', icon: <Layers />, shortcut: 'mod+1' },
      { label: '内容审核', href: '/admin/moderation', icon: <Inbox />, badge: 'warn', shortcut: 'mod+2' },
    ],
  },
  // ...（其余 4 组类似，icon 由 lucide-react 直注；count 不在静态层填，由 countProvider 运行时回灌）
] as const
```

count 数据由 server-next 应用层在 RSC / SWR 边界提前准备 `ReadonlyMap<string, number>`，作为 `<AdminShell>` 的 `countProvider` 返回值；Sidebar 通过 `counts` prop 接收已求值结果（不持有 provider 本体，避免重复求值）。

#### 4.3 4 级 z-index 规范（具体数值首次落定）

基于设计稿 v2.1 styles 现有 z-index 用法（`modal-bg` / `cmdk` / 抽屉等无统一基线）+ Resovo 价值排序（正确性 > 边界 > 可扩展性 > 一致性 > 收敛），按 4 级落定具体数值，跨档采用 100 步进，给中间层留扩展空隙：

| 层级 | 用途 | z-index 数值 | token 名 |
|---|---|---|---|
| L1 业务 Drawer | 视频编辑等业务级 Drawer / Modal | 1000 | （由 packages/admin-ui Drawer / Modal 原语自身使用 `--z-modal`，不进 `z-shell-*` 命名空间，避免污染）|
| L2 Shell 抽屉 | NotificationDrawer / TaskDrawer / UserMenu 浮层 | 1100 | `--z-shell-drawer` |
| L3 CommandPalette | ⌘K 命令面板 | 1200 | `--z-shell-cmdk` |
| L4 ToastViewport | 全局 Toast 队列 | 1300 | `--z-shell-toast` |

**新增 admin-layout token**（`packages/design-tokens/src/admin-layout/z-index.ts` 新建）：

```typescript
// packages/design-tokens/src/admin-layout/z-index.ts
export const adminLayoutZIndex = {
  'z-shell-drawer': '1100',
  'z-shell-cmdk':   '1200',
  'z-shell-toast':  '1300',
} as const
```

`packages/design-tokens/src/admin-layout/index.ts` 桶导出追加 `export * from './z-index'`；`packages/design-tokens/build.ts` 的 `buildLayoutVars` 函数追加 `z-shell-*` 字段写入 CSS 变量；`tests/unit/design-tokens/admin-layout.test.ts` 追加 3 个变量存在性 + 数值断言；`scripts/verify-token-isolation.mjs` 的 `FORBIDDEN_TOKENS`（前台禁用清单）追加 `z-shell-drawer` / `z-shell-cmdk` / `z-shell-toast`，确保 apps/web-next 不消费。

业务 Drawer（L1，1000）由 packages/admin-ui Drawer / Modal 原语自身定义（落地于 M-SN-2 数据原语层卡，CHG-SN-2-13+），不在 admin-layout token 命名空间，避免污染语义边界（admin-layout 只承载 Shell 编排层 z-index；业务 Modal/Drawer 是组件级 token，归 components/ 层管辖，与 plan §4.3 的 4+1 层分层一致）。

**层级关系不变量**（CSS 变量级硬编码，禁止跨档反转）：

```
L1 业务 Drawer (1000) < L2 Shell 抽屉 (1100) < L3 CmdK (1200) < L4 Toast (1300)
```

理由：业务 Drawer 在编辑视频等业务流程中打开，Shell 抽屉（通知 / 任务）属壳层级别需可覆盖业务面板；CmdK 是全局导航入口，需可在任何抽屉上方触发并接管焦点；Toast 是非阻塞反馈通道，须在 CmdK 之上保证可见性（用户在 CmdK 操作时仍能看到 Toast 反馈）。

#### 4.4 4 项硬约束（写入 ADR + Plan §4.4 / §4.7 互引）

1. **Provider 不下沉**：`packages/admin-ui` 内部零 `BrandProvider` / `ThemeProvider` 声明；ToastViewport 队列以 `zustand` 单例 store 持有（非 Context Provider）；主题、品牌、用户身份等跨组件状态全部由 server-next 应用层持有真源，通过 props 注入 Shell 组件。CI 守卫：`scripts/verify-server-next-isolation.mjs` 扩展扫描 `packages/admin-ui/src/**/*.tsx` 内 `BrandProvider` / `ThemeProvider` / `createContext` 调用，命中即 BLOCKER。
2. **Edge Runtime 兼容**：Shell 模块顶层（即 import 直接执行的代码区）零 `window` / `document` / `fetch` / `Cookie` / `localStorage` / `navigator` 访问；所有运行时副作用必须在 `useEffect` / 事件 handler 内。`IS_MAC` / `MOD_KEY_LABEL` 顶层导出值用 SSR 安全默认（`false` / `'Ctrl'`），客户端首次 mount 时由 `useEffect` 检测 `navigator` 后纠正。CI 守卫：`scripts/verify-server-next-isolation.mjs` 扩展 ts-morph 扫描 Shell 模块顶层语句，命中 forbidden globals 即 BLOCKER。
3. **零硬编码颜色**：Shell 颜色 / 间距 / 阴影 / 圆角 / 字号全部读 admin-layout + semantic + brands token（CSS 变量）；不允许 `#xxx` / `rgb(...)` / `rgba(...)` / `hsl(...)` 字面量。ESLint `no-hardcoded-color` 规则覆盖范围扩展至 `packages/admin-ui/src/shell/**`。
4. **零图标库依赖**：`packages/admin-ui` 的 `package.json` 不 import `lucide-react` / `@heroicons/*` / `react-icons` 等图标库（plan §4.7 依赖白名单）；`AdminNavItem.icon` / `CommandItem.icon` / Topbar 三枚图标按钮的 icon 由 server-next 应用层注入 `React.ReactNode`，Shell 组件以 `React.ReactNode` 占位符 + `aria-label` 描述（pure 渲染，对图标内容透明）。

#### 4.5 cutover 前最终对账义务（与 ADR-100 IA 修订段呼应）

ADR-100 IA 修订段 `docs/decisions.md:2104-2117` 已声明 cutover 前 `manual_qa_m_sn_7_*.md` 须执行 IA 对账。本 ADR 扩展该义务为 Shell API 契约对账：

1. 拉取设计稿最新版本 `docs/designs/backend_design_v2.1/app/shell.jsx`
2. 与 packages/admin-ui Shell 10 组件实现做 Props 字段 + 交互行为 diff（截图对照：折叠态 + 展开态 × dark/light 模式 = 4 张）
3. 对每条偏离做"采纳 / 拒绝并立 ADR"的二选一裁决
4. AdminNavItem 5 字段在 ADMIN_NAV 真实数据中的覆盖率 ≥ 80%（icon 100% / shortcut ≥ 50%（核心导航）/ count + badge 按 IA v1 业务态势注入）
5. 4 级 z-index 实战验证：业务 Drawer + Shell 抽屉 + CmdK + Toast 同时打开时层级正确，键盘焦点链不串扰
6. 对账签字写入 `milestone_alignment_m_sn_7_*.md` 的 Shell 章节

### 替代方案（已否决）

- **A1：AdminNavItem 引入 `id` 字段**（如 `id: 'dashboard'`，对齐 shell.jsx NAV 的 id-based 寻址）
  - **否决理由**：`href` 已经是路由稳定唯一标识；引入 `id` 形成双源（id 与 href 必须保持一一映射），增加维护成本与漂移风险；CmdK / KeyboardShortcuts 完全可以用 `href` 寻址；shell.jsx 用 id 是因为它是 demo 单文件无路由系统的权宜实现，不必继承到生产。

- **A2：AdminNavItem.icon 收 string 名（如 `'layers'`）**
  - **否决理由**：packages/admin-ui 需要维护 string → icon 组件的注册表，要么内置 lucide-react（违反 §4.7 零图标库依赖），要么暴露一个 `iconMap` Provider（违反 §4.4 Provider 不下沉）。直注 `React.ReactNode` 让 packages/admin-ui 对图标实现完全透明，server-next 侧自由选型且未来 cutover 后 apps/admin 切图标库零 packages 改动。

- **A3：ToastViewport 用 React Context Provider 模式**
  - **否决理由**：违反 plan §4.4 Provider 不下沉硬约束；React Context 需 Provider 包裹整棵子树，与 AdminShell 编排策略冲突（ToastViewport 必须能在 AdminShell 之外独立挂载，例如 login 页消费 Toast 但不进 Shell，复用矩阵 §8 已确认）；zustand 单例 store 模块顶层零副作用 + SSR 安全 + Edge Runtime 兼容 + 多 ViewPort 实例共享同一队列，全面优于 Context。

- **A4：AdminNavItem.shortcut 收平台特定字符串（如 `'⌘1'` / `'Ctrl+1'`）**
  - **否决理由**：双源（Mac 写 `'⌘1'`，非 Mac 写 `'Ctrl+1'`），数据层不可平台无关；用户跨平台切换时数据漂移；`formatShortcut('mod+1')` 在渲染期映射方为正解，数据只承载语义键（`mod` / `shift` / `alt` / 字面键），label 由 `MOD_KEY_LABEL` 决定。

- **A5：Shell 内部直接 `import { useRouter } from 'next/navigation'` 做 router.push**
  - **否决理由**：与 server-next 应用层耦合，丧失 Storybook 兼容性（CHG-SN-2-20 demo 页需独立挂 Shell 组件做交互演示）；未来 cutover 后如 Next.js 升级 router API，packages/admin-ui 受波及；`onNavigate` prop 注入是清晰的依赖反转，单测可注入 mock，演示可注入 noop。

- **A6：4 级 z-index 用 10 步进（1000 / 1010 / 1020 / 1030）**
  - **否决理由**：步进过窄，未来若插入"业务 Modal 之上、Shell 抽屉之下"的中间层（如全局 confirm dialog）无法插入；100 步进对 z-index 性能 / 渲染零成本，留扩展空隙符合 Resovo 价值排序"可扩展性优先于收敛"。

- **A7：z-index 全部进入 admin-layout token 命名空间（含业务 Drawer 1000）**
  - **否决理由**：业务 Drawer 是组件级原语，归 packages/design-tokens 的 components/ 层管辖（与 modal / dialog / popover 同层），不属 admin-layout 编排层；混入会污染 admin-layout 命名空间的语义边界（admin-layout 应只承载 Shell 壳层布局变量），违反 ADR-102 v2.1 修订的"4+1 层"职责划分；z-shell-* 仅 3 个 token 是有意收敛。

### 后果

#### 正面

- M-SN-2 第一张组件卡（CHG-SN-2-02）拿到 admin-nav.ts 字段扩展协议 + admin-layout z-shell-* token 后立即可放行开工，后续 Shell 10 组件分卡按 plan §6 v2.3 依赖序（CHG-SN-2-03 ~ CHG-SN-2-12）顺序落地无歧义。
- Shell 公开 API 跨组件 / 跨视图稳定（M-SN-3 视频库到 M-SN-6 系统管理 14 个视图共享同一 Shell），单元测试覆盖率 ≥70% 目标可达（每个组件 Props 类型骨架明确，行为契约可测）。
- 与设计稿 v2.1 视觉对齐 + 键盘流可用（⌘K / ⌘B / ⌘1-5 / ⌘, / Esc / ↑↓ / Enter），M-SN-6.5 非功能验收门 a11y 基线达标。
- cutover 后 packages/admin-ui 若改名 apps/admin/ui（Q-DISCUSS 留待 cutover 后裁定）时，公开 API 不动，下游 server-next 应用层零改动。
- Edge Runtime 兼容 → 未来 server-next 改 Edge SSR 无阻塞，ToastViewport / KeyboardShortcuts / IS_MAC 都已在设计期通过 SSR 安全检查。

#### 负面

- 10 组件 + 字段扩展工作量约 +0.5w（plan v2.3 已吸纳：M-SN-2 由 2.5w → 3w；总周期 17.5w → 18.0w；未触发 BLOCKER §5.2 第 11 条 +30% 阈值）。
- icon ReactNode 直注 → server-next 侧 admin-nav.ts 不再纯 JSON 序列化（中文文案仍是 string，但 icon 是 ReactNode）；如未来需要 SSR 序列化 NAV 数据通过 wire 传给 client（如 RSC payload 显式传），需另起 ADR 设计 icon 名 → ReactNode 的客户端解析层。M-SN-2 不触发该需求（NAV 在 RSC / 客户端均可同步求值）。
- countProvider 同步求值 → server-next 应用层须用 RSC（在服务端预取）/ SWR（在客户端缓存）提前准备 `ReadonlyMap<string, number>` 再以 `counts` prop 回灌 Sidebar；后端实时性受限（最新 count 需走客户端轮询 / WebSocket，本 ADR 不规定刷新机制）。
- z-index 跨 100 步进 → 与未来通用 Modal / Popover 原语的 z-index 规范需协调；M-SN-2 数据原语层 Drawer / Modal / AdminDropdown 落地时（CHG-SN-2-13 ~ CHG-SN-2-19）需 cross-check：业务 Drawer 1000 / Modal 1000 / AdminDropdown 980（基于 1000-20，给 Dropdown 留挂在 Modal 之下的常见用法）；本 ADR 不固化业务原语 z-index 数值，由 ADR-103 / 后续 components 层 token ADR 接手。

### 影响文件

- `packages/admin-ui/src/shell/admin-shell.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/sidebar.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/topbar.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/user-menu.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/notification-drawer.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/task-drawer.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/command-palette.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/toast-viewport.tsx` + `use-toast.ts` + `toast-store.ts`（M-SN-2 新建，含 zustand store）
- `packages/admin-ui/src/shell/health-badge.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/breadcrumbs.tsx`（M-SN-2 新建，含 inferBreadcrumbs helper）
- `packages/admin-ui/src/shell/keyboard-shortcuts.tsx`（M-SN-2 新建）
- `packages/admin-ui/src/shell/platform.ts`（M-SN-2 新建：IS_MAC / MOD_KEY_LABEL / formatShortcut / parseShortcut）
- `packages/admin-ui/src/index.ts`（追加 shell 桶导出）
- `packages/admin-ui/package.json`（zustand 加 dependencies；不引入图标库）
- `apps/server-next/src/lib/admin-nav.ts`（CHG-SN-2-02 字段扩展 + ADMIN_NAV 注入 icon / shortcut / badge）
- `apps/server-next/src/lib/shell-data.ts`（CHG-SN-2-02 新建：count provider stub + health snapshot stub）
- `apps/server-next/src/app/admin/layout.tsx`（CHG-SN-2-12 替换骨架为 `<AdminShell>` 装配）
- `packages/design-tokens/src/admin-layout/z-index.ts`（CHG-SN-2-02 新建 3 token）
- `packages/design-tokens/src/admin-layout/index.ts`（CHG-SN-2-02 追加 `export * from './z-index'`）
- `packages/design-tokens/build.ts`（CHG-SN-2-02 buildLayoutVars 追加 z-shell-* 字段写入）
- `tests/unit/design-tokens/admin-layout.test.ts`（CHG-SN-2-02 追加 3 个 z-shell-* 变量存在性 + 数值断言）
- `scripts/verify-token-isolation.mjs`（CHG-SN-2-02 FORBIDDEN_TOKENS 追加 z-shell-drawer / z-shell-cmdk / z-shell-toast）
- `scripts/verify-server-next-isolation.mjs`（M-SN-2 扩展：扫描 packages/admin-ui/src/shell 模块顶层 forbidden globals + Provider 声明）

### 关联

- **关联 ADR**：
  - ADR-100（server-next 立项与 IA v0；本 ADR 兑现 IA 修订段"剩余差异 → M-SN-2 处理"承诺）
  - ADR-101（server-next cutover 协议；Shell API 稳定性是 cutover 验收前提）
  - ADR-102（admin token 4+1 层；admin-layout 第 5 层新增 3 个 z-shell-* 子项；token 字段新增按 ADR-102 v2.1 修订段硬约束 2 — milestone 报备而非 ADR）
  - ADR-103（DataTable v2 公开 API 契约；同 milestone 平行 ADR，覆盖数据原语层）
- **关联 plan**：
  - §6 M-SN-2 v2.3（Shell 编排层范围 A 块）
  - §4.4（自建组件下沉 + Provider 不下沉硬约束）
  - §4.7（依赖白名单：zustand 已收编 / 图标库 server-next 侧持有）
  - §4.5 ADR-端点先后协议（精神延伸：Shell ADR 必须先于组件首张卡 PASS）
  - §8 复用矩阵 v2.3（Shell 列覆盖 19 个 admin/* 视图）
  - §9 ADR 索引（ADR-103 拆 ADR-103 + ADR-103a）
- **关联序列**：SEQ-20260428-03（M-SN-2 第一阶段 — Shell 公开 API 落地）
- **评审子代理**：arch-reviewer (claude-opus-4-7) — Shell API 契约决策强制 Opus（CLAUDE.md 模型路由规则第 1 / 3 项）
- **人工 sign-off**：用户 2026-04-28 接受 plan v2.3 4 项决策（CHG-SN-1-12 决议）后，本 ADR 沿用同一 sign-off 范围，不再单独取签

### 修订记录

#### 2026-04-28 · fix(CHG-SN-2-01) · 文档质量补强（2 处 P1 契约缺口 + 2 处 P2 口径矛盾）

用户复审 ADR-103a 文本时识别 4 处问题，CHG-SN-2-02 起步前必须闭合。本次修订仅修订 ADR 文本，不变更架构决策实质：

- **P1-A 修订**（4.1.3 Topbar）：TopbarProps 新增必填 `icons: TopbarIcons`（5 类按钮图标 ReactNode 插槽 — search / theme / notifications / tasks / settings）；同步导出 `TopbarIcons` 接口 + 增段说明 Sidebar/UserMenu 内部图标用内联 SVG 自持，唯有 Topbar 5 类业务图标必须由消费方注入。闭合"零图标库依赖（4.4-4）"约束与 Topbar 三枚图标渲染需求的契约缺口。
- **P1-B 修订**（4.1.1 AdminShell）：AdminShellProps 新增 `topbarIcons: TopbarIcons`（透传 Topbar）+ `notifications? / tasks? / onNotificationItemClick? / onMarkAllNotificationsRead? / onCancelTask? / onRetryTask?` 6 个字段；职责段补"编排 NotificationDrawer + TaskDrawer + Drawer 互斥开闭态"；不做段补"不获取通知/任务数据（消费方 SWR/RSC 注入）"。闭合 AdminShell 编排双 Drawer 时无法通过 props 注入 items 的契约缺口。
- **P2-A 修订**（4.2 AdminNavItem.count）：注释从"静态计数（编译期注入）；运行时优先于 countProvider 的返回"改为"静态计数（编译期回退值）；AdminShellProps.countProvider 的 runtime 返回值优先于本字段"，与 5 字段语义说明表 + plan v2.3 + AdminShellProps.countProvider 注释保持一致。
- **P2-B 修订**（4.1.1 AdminShell + 4.1.3 Topbar）：AdminShell 选定"不做面包屑推断"语义。AdminShellProps.crumbs 注释改为"undefined 时 Topbar 不渲染面包屑（消费方按需调 4.1.9 inferBreadcrumbs 后注入）"；activeHref 注释从"Breadcrumbs 推断"改为"消费方调 inferBreadcrumbs 的输入"；Topbar 4.1.3 职责段补"按 crumbs prop 直接渲染，本组件不调用 inferBreadcrumbs"+ 不做段补"不调用 inferBreadcrumbs（由 AdminShell 调用方提前注入）"。Breadcrumbs helper（4.1.9）保留为独立可调用工具函数（消费方按需调用），与 AdminShell 解耦。

**修订属性**：纯文本修订；架构决策（10 组件清单 / 5 字段扩展 / 4 级 z-index / 4 项硬约束）零变更；后续卡链不动。

**回归**：typecheck + lint + test 全绿（仅 docs 改动）。

#### 2026-04-29 · CHG-SN-2-03 · §4.1.7 ToastViewport 首例落地（Shell 实施范式参照）

CHG-SN-2-03 完成 §4.1.7 ToastViewport + useToast + toast-store 落地，作为 packages/admin-ui Shell 9 张后续卡（CHG-SN-2-04 ~ CHG-SN-2-12）的实施范式参照。Opus arch-reviewer 评审 PASS（8 项评审重点全 PASS / 无必修 / 3 条建议优化全部合并补齐）。

**首例实装文件**（commit 见 git log `chg(CHG-SN-2-03)`）：
- `packages/admin-ui/src/shell/toast-store.ts`（zustand 单例 store，§4.4-1 Provider 不下沉范式落地）
- `packages/admin-ui/src/shell/use-toast.ts`（hook 包装，仅透传 actions 不订阅 state）
- `packages/admin-ui/src/shell/toast-viewport.tsx`（React 组件 + useSyncExternalStore + SSR_EMPTY_QUEUE）
- `packages/admin-ui/src/shell/index.ts`（含 shell/ 子目录章法重述：文件命名 / 不变约束 / 类型导出范式 / 单测组织 / SSR 安全模式 5 条）
- 单测 29 tests：toast-store.test.ts（12） + toast-viewport.test.tsx（15） + toast-viewport-ssr.test.tsx（2）

**Shell 9 后续卡参照本卡**：文件命名规范 / Props readonly / 默认值常量 + 不变量单测锁定 / store-driven 组件 SSR 安全（getServerSnapshot 返稳定常量）/ 单测组织三分（store / viewport / SSR）/ 头注释结构（真源链 → 设计要点 → 不变约束 → 跨域消费）。CHG-SN-2-04 起步前主循环对照 `packages/admin-ui/src/shell/index.ts` 头注释 5 条章法逐项校验。

#### 2026-04-29 · CHG-SN-2-04 · §4.1.10 KeyboardShortcuts + platform 工具集落地（Shell 第 2 张组件 + 范式补充）

CHG-SN-2-04 完成 §4.1.10 platform.ts（IS_MAC / MOD_KEY_LABEL / formatShortcut / parseShortcut / matchesEvent / ShortcutMatcher）+ keyboard-shortcuts.tsx 落地。Opus arch-reviewer 评审 CONDITIONAL → 1 必修（document → window listener target 字面对齐 ADR §4.1.10）+ 3 建议优化（注释修订 / 章法补强 / matchesEvent 收编）合并补齐后 PASS；建议优化 4（usePlatform hook）登记后续。

**首例实装文件**（commit 见 git log `chg(CHG-SN-2-04)`）：
- `packages/admin-ui/src/shell/platform.ts`（纯工具 + 顶层 const，§4.4-2 trade-off 头注释明示）
- `packages/admin-ui/src/shell/keyboard-shortcuts.tsx`（return null + useEffect window keydown 监听，§4.1.10 字面 1:1）
- 单测 39 tests：platform.test.ts（23） + keyboard-shortcuts.test.tsx（13） + keyboard-shortcuts-ssr.test.tsx（3）

**§4.1.10 公开 API 补充**（已通过 shell/index.ts 导出）：
- `matchesEvent(matcher, event): boolean` — KeyboardShortcuts 内部 listener 用，亦可被 e2e/单测复用；正式收编为公开 API
- listener target：`window.addEventListener('keydown', ...)`（与 ADR §4.1.10 字面对齐；document 与 window 对 keydown 等价但字面要求 window）

**Shell 实施范式补充**（已落入 shell/index.ts 头注释）：
- 章法 1：文件命名按组件形态二选一 — A) store-driven 三件套（store + hook + viewport）/ B) 纯工具 + 无状态副作用组件二件套（utility + component）
- 章法 5：SSR 安全模式按组件形态二选一 — A) store-driven 组件用 useSyncExternalStore + 稳定 getServerSnapshot / B) 无渲染副作用组件 return null + useEffect 内访问 window/document（renderToString 输出空即合规）

**后续登记**：
- usePlatform() hook（建议优化 4）：返回 `{ isMac, modKeyLabel }` 客户端 useEffect 求值，作为 hydration-safe 包装的官方实现；视 CHG-SN-2-08+ Sidebar / CmdK 消费方实际调用频次决定是否落地（M-SN-3+ 业务卡决议）

#### 2026-04-29 · CHG-SN-2-07 · §4.1.4 UserMenu 落地 + AdminShellUser/AdminUserActions 类型 SSOT 上提

CHG-SN-2-07 完成 §4.1.4 UserMenu 组件 + AdminShellUser / AdminUserActions / UserMenuAction 类型 SSOT 上提。Opus arch-reviewer 评审 CONDITIONAL → PASS（11 项重点 / 1 必修 + 3 建议优化全部合并补齐）；本次评审发现 ADR §4.1.4 字面契约与本卡实施在 4 处有精化偏离，本段为该精化的显式背书。

**4 处契约精化背书**（自 ADR §4.1.4 字面到本卡实施）：

| 契约项 | ADR §4.1.4 字面 | 本卡精化 | 理由 |
|---|---|---|---|
| `UserMenuProps` 关闭回调 | `onClose: () => void` | `onOpenChange: (open: boolean) => void` | 与 React 受控组件惯用模式对齐（如 Radix UI / shadcn Dialog）；外部点击 / ESC / 菜单项点击三处都调 `onOpenChange(false)` |
| `UserMenuProps` action 调度 | `onAction: (action: UserMenuAction) => void`（单一 union 回调） | `actions: AdminUserActions`（callbacks 拆分对象，logout 必填，其余可选） | 叶子层支持"actions 提供性渲染"（onProfile=undefined → 个人资料项隐藏；与 fix(CHG-SN-2-01) AdminShellProps `onSwitchAccount?` 可选 + 菜单项隐藏的语义对齐）；编排层（CHG-SN-2-12 AdminShell 装配）仍消费单一 `onUserMenuAction(action: UserMenuAction)` 回调，AdminShell 内部把 union 分派到 actions 各 callback |
| `AdminShellUser.role` | `role: string`（§4.1.1） | `role: 'admin' \| 'moderator'` union | 与 onUserMenuAction 6 项 union 调度 schema 同质收敛；string 兜底无业务必要（应用层无第三种角色） |
| `AdminShellUser.avatarText` | `avatarText: string`（必填，§4.1.1） | `avatarText?: string`（可选，由 deriveAvatarText helper 推断兜底） | 多数登录态消费方不必显式提供 avatar 文本；helper 推断（多词→首字母 / CJK→前两字 / 单字符→自身 / 空→"?"）覆盖 100% displayName 形态 |
| `UserMenuProps.anchorRef` | 必填 `RefObject<HTMLElement>` | 可选 `RefObject<HTMLElement \| null>` | 单元/SSR 测试场景 + 无 anchor 复用矩阵（如 demo 页直接 mount）允许 anchorRef 缺省；缺省时 outside-click 仅检查菜单内点击 |

**精化的不变约束**：
- ADR §4.1.4 "6 项菜单（profile / preferences / theme / help / switchAccount / logout）"语义 1:1 对齐
- ADR §4.1.4 "外部点击关闭 / ESC 关闭 / focus trap"行为 1:1 对齐
- ADR §4.1.4 "不实现 logout 业务（委托 actions.onLogout）/ 不读取 user 数据"硬约束 1:1 对齐
- ADR §4.4 4 项硬约束（Provider 不下沉 / Edge Runtime 兼容 / 零硬编码颜色 / 零图标库依赖）100% 对齐

**精化后的 UserMenuProps 完整签名**（packages/admin-ui/src/shell/types.ts SSOT）：

```typescript
export interface UserMenuProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly user: AdminShellUser
  readonly actions: AdminUserActions
  readonly anchorRef?: React.RefObject<HTMLElement | null>
}
```

**消费链调用**：
- 编排层（CHG-SN-2-12 AdminShell）：维护 `dispatch = (action: UserMenuAction) => onUserMenuAction(action)`，构造 `actions = { onProfile: () => dispatch('profile'), ..., onLogout: () => dispatch('logout') }`，传给 `<UserMenu>`
- 叶子层（UserMenu）：按 actions 提供性渲染对应菜单项；任意菜单项点击触发对应 callback + 自动 onOpenChange(false)

**关联**：CHG-SN-2-07 落地 commit / Opus 评审 PASS（11 项 / 1 必修 + 3 建议优化合并）/ 后续 CHG-SN-2-08 Sidebar 集成 UserMenu / CHG-SN-2-12 AdminShell 装配 onUserMenuAction → actions 分派

**编排层 union ↔ 叶子层 actions 取舍说明**（CHG-SN-2-08 Sidebar 集成时澄清）：

Sidebar 因接收 `onUserMenuAction(union)`（与 AdminShellProps.onUserMenuAction 编排层一致），内部 useMemo 把 union 转成 AdminUserActions 6 callbacks（全 6 项始终为 truthy 函数）。这与 fix(CHG-SN-2-01) §4.1.4 "actions 提供性渲染"（onProfile=undefined → 个人资料项隐藏）的语义不一致 — 编排层 union 必然丢失提供性。

设计取舍：
- **直接消费 UserMenu 叶子层**（如未来 demo / 测试 / 脱离 Sidebar 的独立场景）→ 通过 `actions: AdminUserActions` 传 callbacks，可隐藏特定项（onSwitchAccount=undefined → 切换账号项隐藏）
- **通过 Sidebar 间接消费**（M-SN-2 主路径）→ 全 6 项始终渲染；不支持的 action（如 onSwitchAccount 在 server-next 鉴权层不支持多账号）由消费方在 onUserMenuAction 内 noop 处理
- **AdminShell 装配（CHG-SN-2-12）**消费 union 后内部分派；如需精细隐藏可在 dispatch 层根据用户 role / 配置动态决定 noop vs 跳转

这是 packages/admin-ui Shell 设计的有意权衡：编排层简化为单一 union 调度，叶子层保留细粒度 actions 拆分形态，Sidebar 这一中间层选择字面 1:1 ADR §4.1.2 union 形态以保持编排层一致性。

#### 2026-04-29 · fix(CHG-SN-2-07) · UserMenu popover/visual 契约补全（portal + 定位 + z-index）

Codex stop-time review 识别 CHG-SN-2-07 实施未兑现 ADR §4.1.4 anchorRef 注释中的"**用于定位**"语义，仅实现"点击外部判定"。UserMenu 应为 popover 形态（portal 渲染 + 相对锚点定位 + Shell 抽屉级 z-index），本 fix 补齐。

**补齐内容**（commit 见 git log `fix(CHG-SN-2-07)`）：

- `packages/admin-ui/src/shell/user-menu.tsx`（修改）：
  - 新增 `useAnchorPosition(anchorRef, open)` hook：useLayoutEffect 计算 anchor rect → setState；resize / scroll(capture) 重新计算；SSR 自动 noop（anchorRef.current 在 SSR 永远 null）
  - 渲染分支：
    - **anchorRef 提供 + 位置已计算** → `createPortal` 到 `document.body` + position: fixed + top/left 来自 anchor rect + transform: translateY(calc(-100% - 8px)) 在 anchor 上方 8px 间隙弹出 + z-index: var(--z-shell-drawer)（Shell 抽屉层）
    - **anchorRef 缺省 / SSR / 位置未计算** → inline 渲染（demo 页 + 单测 fallback；与 CHG-SN-2-07 4 处契约精化中"anchorRef 必填→可选"一致）
  - 头注释更新真源链 + popover/visual 契约设计要点
- `packages/admin-ui/src/shell/index.ts`（修改）：章法 1C 头注释追加 popover/visual 契约 5 处实施细节（createPortal / fixed / anchor rect / z-index 4 级 / useLayoutEffect / resize+scroll capture / transform 偏移决定弹出方向）
- 单测追加 4 测（user-menu-interaction.test.tsx）：
  - anchorRef 缺省 → inline 渲染（无 portal wrapper）
  - anchorRef 提供 → portal 启用（DOM 在 document.body）
  - portal wrapper 含 fixed + z-index var(--z-shell-drawer) + transform translateY
  - open=false → portal 不渲染

**popover/visual 契约 5 处实施细节**：

| 项 | 实施 |
|---|---|
| 渲染层级 | `createPortal(content, document.body)` 避免 Sidebar overflow:hidden 裁剪 + z-index 冲突 |
| 定位策略 | position: fixed + top/left 来自 anchorRef.current.getBoundingClientRect() |
| 弹出方向 | transform: `translateY(calc(-100% - 8px))` 在 anchor 上方对齐（设计稿 v2.1 sb__menu 实践）|
| z-index 层级 | `var(--z-shell-drawer)`（ADR-103a §4.3 Shell 抽屉级，与 NotificationDrawer/TaskDrawer 同级） |
| 位置同步 | useLayoutEffect 客户端计算（无视觉抖动）+ window resize + 祖先 scroll(capture phase) |

**作为 CHG-SN-2-10/11 范式参照**：NotificationDrawer / TaskDrawer / CommandPalette 浮层实施时复用 useAnchorPosition hook + portal 模式；z-index 按 ADR-103a §4.3 各取对应 token：
- NotificationDrawer / TaskDrawer → `var(--z-shell-drawer)`（与 UserMenu 同级 1100）
- CommandPalette → `var(--z-shell-cmdk)`（1200，覆盖 UserMenu）

**回归**：typecheck + lint + 1943 unit tests（原 1939 + 4 新增 popover 路径）+ 双扫描守卫（48 文件 0 违规）+ token 跨域守卫（152 文件 0 命中）全绿。

**未引入新约束变更**：本 fix 仅补 ADR §4.1.4 anchorRef "用于定位"原本就规定的契约；CHG-SN-2-07 4 处契约精化继续有效（onClose→onOpenChange / onAction→actions 拆分 / role union / avatarText 可选 / anchorRef 可选）。

#### 2026-04-29 · fix(CHG-SN-2-10) · NotificationDrawer no-op rows + TaskDrawer indeterminate progressbar 修复

Codex stop-time review 识别 CHG-SN-2-10 落地的 NotificationDrawer + TaskDrawer 在两处违反 UI/a11y 契约："No-op notification rows and hidden progressbars break UI/a11y contracts"。本 fix 在 packages/admin-ui 内解决，不变更 ADR §4.1.5 字面契约，仅补齐隐含的 a11y 实施细节。

**两处契约缺口**：

1. **No-op notification rows**：`notification-drawer.tsx` onItemClick 未提供时仍渲染 `<button>`，点击 no-op
   - 视觉违规：button 视觉暗示可点击但无业务（用户困惑）
   - a11y 违规：`<button>` role 暗示交互性，但实际无交互（screen reader 误导）
2. **Hidden progressbars**：`task-drawer.tsx` status='running' 但 progress=undefined 时干脆不渲染 progressbar
   - 视觉违规：用户能看到"运行中"标签但不知是否有进度（无视觉反馈）
   - a11y 违规：违反 ARIA 1.1 progressbar 规范 — 运行中应显示 indeterminate progressbar（aria-valuenow 缺省即表示不确定进度）

**修复内容**（commit 见 git log `fix(CHG-SN-2-10)`）：

- `packages/admin-ui/src/shell/notification-drawer.tsx`：NotificationItemRow 双形态分支
  - `onItemClick !== undefined` → `<button>` 形态（cursor: pointer / data-notification-item-interactive="true"）
  - `onItemClick === undefined` → `<article>` 形态（cursor: default / data-notification-item-interactive="false" / 无 onClick handler）
- `packages/admin-ui/src/shell/task-drawer.tsx`：progressbar 始终渲染（status='running'）+ indeterminate 分支
  - status='running' + progress 提供 → determinate（aria-valuenow + width% / data-task-item-progress-mode="determinate"）
  - status='running' + progress=undefined → indeterminate（无 aria-valuenow + aria-label="进度未知" + 30% 宽度滑动动画 / data-task-item-progress-mode="indeterminate"）
  - status≠'running' → 不渲染 progressbar（pending/success/failed 不需要进度展示）
  - INDETERMINATE_KEYFRAMES 通过 `<style data-resovo-task-indeterminate>` 内联注入（沿用 HealthBadge pulse 动画范式）
- 单测追加 4 锁定（双 Drawer 各 2 测）：article 形态 / cursor: default / cursor: pointer / indeterminate progressbar role + aria-label / determinate vs indeterminate data-* attribute

**a11y 契约改进**：
- NotificationItem：onItemClick 决定 element role（article 非交互 / button 交互）
- TaskItem progressbar：ARIA 1.1 规范 — `aria-valuenow` 提供 = determinate / 缺省 + `aria-label` = indeterminate

**回归**：typecheck + lint + admin-ui shell 278 tests（含 3 新增 fix 锁定）+ 双扫描守卫（53 文件 0 违规）全绿。

**未引入 ADR 字面契约变更**：ADR §4.1.5 字面 NotificationItem/TaskItem 类型 + onItemClick/onCancel/onRetry 可选性不变；本 fix 仅补 a11y 实施细节（onItemClick 缺省时 article 形态 / progressbar 始终在 running 状态渲染）。CHG-SN-2-10 整体范式（DrawerShell base + portal + ESC + focus trap + mounted SSR-safe）继续有效。

**Codex Review Gate 第 5 次精确捕获契约偏离**：CHG-SN-2-03 ToastViewport position（已修 f23abc7）/ CHG-SN-2-04 platform.ts hydration mismatch（已修 32a94b6）/ CHG-SN-2-07 UserMenu popover/visual 契约（已修 6ed730e）/ CHG-SN-2-09 Topbar layout 漂浮（已修 14c54f4）/ **CHG-SN-2-10 双 Drawer UI/a11y 契约（本卡修）**。Codex 与 Opus 双 review 互补防线 — Opus 评 14/14 PASS（语义层全过），Codex 捕获 a11y 实施细节缺口（运行时层）。

#### 2026-04-29 · fix(CHG-SN-2-04) · platform.ts hydration-safe 修复（提前落地原"建议优化 4"）

Codex stop-time review 识别 platform.ts 顶层 `detectIsMac()` 直接读 navigator 导致 SSR ('Ctrl+K') vs 客户端水合 ('⌘K') React hydration mismatch；把 hydration-safe 责任推给消费方包装是糟糕的 API 设计。本 fix 在 packages/admin-ui 内解决，将原"后续登记"建议优化 4 提前落地。

**修订内容**（commit 见 git log `fix(CHG-SN-2-04)`）：

- `packages/admin-ui/src/shell/platform.ts`：
  - 顶层 `IS_MAC: boolean = false`（永远 SSR 默认；移除 `detectIsMac()` 顶层调用）
  - 顶层 `MOD_KEY_LABEL: '⌘' | 'Ctrl' = 'Ctrl'`（永远 SSR 默认）
  - `formatShortcut(spec, isMac?)` 增加可选第二参数（默认 IS_MAC=false → SSR 安全；显式传 true 输出 Mac 风格）
  - 新增 `usePlatform(): { isMac, modKeyLabel }` hook：useState + useEffect navigator 检测 → 客户端 mount 后 setState 触发普通 rerender（非 hydration mismatch）
  - 新增 `useFormatShortcut(spec): string` hook：基于 usePlatform 自动 hydration-safe 渲染快捷键文案
  - `detectIsMacFromNavigator()` 私有函数仅在 useEffect / 事件 handler 内调用（§4.4-2 字面对齐）
- `packages/admin-ui/src/shell/index.ts`：桶导出追加 `usePlatform / useFormatShortcut / UsePlatformReturn`
- 单测：
  - `platform.test.ts`：原 IS_MAC/MOD_KEY_LABEL 测试改为"恒为顶层 SSR 默认"断言；formatShortcut 测试拆为"默认/显式 false"（Ctrl 风格）+"显式 true"（Mac 风格）两组
  - `platform-hooks.test.tsx`（新建）：5 tests — Mac 平台模拟 / 非 Mac 平台模拟 / Mac useFormatShortcut / SSR renderToString 永远输出 'Ctrl+K' / SSR 不抛错

**消费方迁移**：
- 旧用法 `formatShortcut('mod+k')` 仍可工作（输出永远 'Ctrl+K'，SSR 安全；适用于 Server Component 不在乎平台的场景）
- 新推荐用法 `useFormatShortcut('mod+k')` 在 Client Component 内自动 hydration-safe（首渲染 'Ctrl+K' / 客户端 mount 后 Mac 上变 '⌘K'，普通 rerender 非 hydration mismatch）
- 顶层 `IS_MAC` / `MOD_KEY_LABEL` 永远是 SSR 默认，**消费方不应直接读取**做平台分支（应使用 `usePlatform()` hook）

**§4.4-2 字面 vs 实践 trade-off 终结**：本 fix 后 platform.ts **完全字面对齐 §4.4-2**（模块顶层零 navigator 访问）；§4.1.10 第 2603 行"useEffect 内 navigator 检测"通过 `usePlatform` hook 实现；§4.1.10 "Mac 输出 ⌘K / 非 Mac 输出 Ctrl+K" 行为通过 `formatShortcut(spec, isMac)` + hook 包装实现（消费方在 Client Component 内 useFormatShortcut 即得 Mac 风格）。

**回归**：typecheck + lint + 1861 unit tests + 双扫描守卫 + token 跨域守卫全绿。

---

## ADR-103b: server-next 图标库选型 — lucide-react

- **日期**：2026-04-28
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-7) — 依赖白名单修订决策强制 Opus（CLAUDE.md 模型路由规则第 1 / 3 项 + plan §0 SHOULD-4-a 重大修订协议）
- **起草模型**：claude-opus-4-7
- **关联序列**：SEQ-20260428-03（M-SN-2 第一阶段 — Shell 落地）
- **关联卡**：CHG-SN-2-01.5（本 ADR 起草 + plan §4.7 修订）/ CHG-SN-2-02 stage 2/2（解锁前置）
- **关联 ADR**：ADR-100（立项 + §4.7 依赖白名单口径）/ ADR-103a（packages/admin-ui Shell 公开 API 契约 §4.4-4 注入约束）
- **人工 sign-off**：用户 2026-04-28 接受 4 项决策（Q1-Q4 全部确认）+ 版本号校正 ^1.12.0

### 背景

CHG-SN-2-02（admin-nav.ts ADMIN_NAV 5 字段扩展 + icon 注入）开工后触发 plan §5.2 BLOCKER 第 2 条 — `lucide-react` 不在 plan §4.7 v2.3 依赖白名单（行 257-276 预批清单 + 候选清单均无图标库类目）。卡停步取签。

回溯审计发现 CHG-SN-2-01 ADR-103a 起草过程的 Opus 评审虽确立"icon 由 server-next 应用层注入 React.ReactNode、packages/admin-ui 零图标库依赖"的边界协议（ADR-103a §4.4-4），但未对照 plan §4.7 v2.3 实际白名单状态——隐性假设"图标库由 server-next 持有"成立，却未驱动 plan 同步修订。该漏洞在 CHG-SN-2-02 实施阶段才暴露，属 ADR-103a 与 plan §4.7 的口径耦合疏漏。

用户裁定方案 A：起新卡 CHG-SN-2-01.5 完成依赖选型评审 + plan §4.7 修订 + 人工 sign-off；本 ADR PASS 且 plan v2.4 落盘后，CHG-SN-2-02 stage 2/2 才能继续 icon 注入实施。

设计稿 v2.1 `docs/designs/backend_design_v2.1/app/shell.jsx:10-35` 的 NAV 区块通过全局 `I.layers / I.inbox / I.film / I.link / I.merge / I.doc / I.image / I.banner / I.flag / I.spider / I.users / I.settings` 暴露 12 个 icon；CmdK / Topbar / UserMenu / NotificationDrawer / TaskDrawer / HealthBadge 等组件另需若干图标按钮——总即时需求 30-50 icon，M-SN-3+ 业务视图增长至 100+。

### 决策

#### 4.1 选定方案：lucide-react（候选 C1）

#### 4.2 6 维评估表

| 维度 | C1 lucide-react | C2 @heroicons/react | C3 react-icons |
|---|---|---|---|
| bundle 体积（gzip / icon） | 5 — ~1KB | 5 — ~1KB | 2 — ~3-5KB（含聚合层） |
| icon 覆盖度（即时 30-50 / 增长 100+） | 5 — 3000+ | 3 — 300+；缺 Merge/Spider/Banner 同名替代 | 5 — 30000+ 聚合 |
| SSR / Edge Runtime 兼容 | 5 — 纯 SVG，sideEffects: false，RSC/Edge 友好 | 5 — 同质 | 4 — 聚合源偶有副作用风险 |
| tree-shake 友好性 | 5 — ESM + named import | 5 — `@heroicons/react/24/outline` 子路径 | 3 — 元包粒度粗 |
| 维护活跃度 | 5 — lucide org 月级更新 | 5 — Tailwind 团队 | 4 — 取决上游各源 |
| 与设计稿 v2.1 视觉一致性 | 5 — shell.jsx 12 NAV icon 100% 同名命中 lucide | 2 — 视觉更细线，缺等价图需重映射 | 4 — 聚合含 lucide 子集但走聚合层 |
| **合计** | **30 / 30** | **25 / 30** | **22 / 30** |

#### 4.3 选定理由（按 Resovo 价值排序）

1. **正确性（价值 1）**：shell.jsx 真源 NAV 12 icon（layers / inbox / film / link / merge / doc / image / banner / flag / spider / users / settings）在 lucide-react 中均有命中映射（`Layers` / `Inbox` / `Film` / `Link2` / `Merge` / `FileText` / `Image` / `Megaphone` / `Flag` / `Bug` / `Users` / `Settings`）；ADR-103a §4.5 cutover 对账义务（icon 100% 覆盖率）零返工可达。
2. **边界（价值 2）**：单一图标库收敛在 apps/server-next 应用层，与 ADR-103a §4.4-4（packages/admin-ui 零图标库依赖）严格兼容；UI 包仅消费 `React.ReactNode` 注入插槽。
3. **可扩展性（价值 3）**：3000+ icon 储备远超 M-SN-6 业务视图 100+ 增长预期；新增 icon 不触发架构二次决策。
4. **一致性（价值 4）**：设计稿 v2.1 视觉风格本身即 lucide 设计语系；选定 C1 即等价于"以真源对齐"，重映射成本归零。
5. **收敛（价值 5）**：单库 vs 聚合 vs 双套，包数最小、依赖图最浅。

#### 4.4 安装位置约束（硬约束）

- 仅在 `apps/server-next/package.json` 的 `dependencies` 安装 `lucide-react`
- **`packages/admin-ui` 严禁引入** `lucide-react` 或任何其他图标库依赖（沿用 ADR-103a §4.4-4 边界）；`AdminNavItem.icon` / `CommandItem.icon` / `TopbarIcons` 等字段类型保持 `React.ReactNode`，由 server-next 应用层注入 JSX 节点
- 任何 packages/* 子包尝试引入 lucide-react → 触发 plan §5.2 BLOCKER 第 2 条
- 由 `scripts/verify-server-next-isolation.mjs`（ts-morph 模块图遍历）扩展校验；ESLint `no-restricted-imports` 在 packages/admin-ui 工作区追加 `lucide-react` 黑名单

#### 4.5 版本约束

- 安装版本 `lucide-react@^1.12.0`（实测最新稳定 minor，CHG-SN-2-01.5 sign-off 时确认）
- caret 范围 `"lucide-react": "^1.12.0"`：允许 1.x 的 minor + patch 升级；major 升级（2.x+）须新 ADR
- 锁版策略沿用项目 `package-lock.json` 既有方案

#### 4.6 tree-shake 配置要求

- 仅允许 named import 形式：`import { Layers, Inbox, Film } from 'lucide-react'`
- 严禁 `import * as Icons from 'lucide-react'` 或默认聚合 import
- 严禁 `dynamic(() => import('lucide-react/...'))` 异步整库导入
- ESLint `no-restricted-syntax` 追加上述模式拦截（落地在 apps/server-next/.eslintrc 或工作区配置）
- Next.js `experimental.optimizePackageImports` 配置追加 `lucide-react`（提升 dev 启动速度，不影响生产 tree-shake）

### 替代方案（已否决）

- **C2 @heroicons/react**：bundle / SSR / 维护与 C1 持平，但 NAV 12 icon 中 Merge / Spider / Banner 缺同名替代需用 GitMerge / Bug / Megaphone 等映射；视觉风格细线倾向偏离设计稿；cutover 对账多一道重映射表。
- **C3 react-icons**：聚合层冗余，单 icon ~3-5KB（gzip）；元包模块图大，tree-shake 风险高；混合多源风格违反一致性，违反"严禁 UI 框架"近邻精神（聚合 30000+ icon 实质即大型符号库）。
- **自建 SVG sprite**：M-SN-2 工时已 +0.5w；自建意味着每个 icon 手工 SVG + 命名 + 测试，30-50 icon 起步成本不低于 1d；无长期维护承诺。否决。
- **图标 CDN（如 iconify）**：引入运行时网络依赖，违反 SSR / 离线开发约束；Edge Runtime 不友好。否决。

### 后果

#### 正面

- 设计稿 v2.1 视觉对齐零返工成本（shell.jsx → 实装命名零差异）
- packages/admin-ui 边界保持纯净（ADR-103a §4.4-4 不动摇）
- M-SN-3+ 业务视图（视频库 / 审核 / 采集等）任意新增 icon 不触发架构决策
- M-SN-6.5 LCP 验收门基本无影响（30 icon × 1KB ≈ 30KB gzip，远低于 LCP critical path 阈值）

#### 负面

- 引入 1 个新 npm 依赖（首次扩列图标库类目）；plan §4.7 v2.3 → v2.4 修订
- 未来若设计语言切换至非 lucide 系（如改 Material Symbols），需新 ADR 替换
- lucide-react 元包未内置类型转换接口，icon 名 typo 仅靠 TS 类型 + 单元测试拦截

### 影响文件

- `apps/server-next/package.json`（dependencies 新增 `lucide-react@^1.12.0`）
- `apps/server-next/next.config.ts`（experimental.optimizePackageImports 追加）
- `apps/server-next/.eslintrc.*` 或工作区 ESLint 配置（追加 named import 强制 + packages/admin-ui 黑名单）
- `apps/server-next/src/lib/admin-nav.ts`（CHG-SN-2-02 stage 2/2 注入 icon 字段）
- `scripts/verify-server-next-isolation.mjs`（追加 packages/admin-ui 不得引入 lucide-react 的模块图校验）
- `docs/server_next_plan_20260427.md` §4.7 + §3 决策表 + 修订日志（plan v2.3 → v2.4，本 ADR 配套）
- 后续 Shell 10 组件卡（CHG-SN-2-03 ~ CHG-SN-2-12）icon 注入位

### 关联

- **ADR-100**（server-next 立项 + 依赖白名单口径源头）
- **ADR-103a**（packages/admin-ui Shell 公开 API 契约 §4.4-4 — icon 注入约束的契约出处）
- **plan §4.7**（v2.3 → v2.4 同步修订，本 ADR 配套落盘）
- **plan §5.2 BLOCKER 第 2 条**（依赖白名单越界的触发源）
- **关联序列**：SEQ-20260428-03 任务 1.5

## ADR-103: packages/admin-ui DataTable v2 公开 API 契约 + useTableQuery + 数据原语层

- **日期**：2026-04-28
- **状态**：已采纳
- **子代理**：arch-reviewer (claude-opus-4-7) — DataTable v2 API 契约 + 新共享组件契约强制 Opus（CLAUDE.md 模型路由规则第 1/3 项）
- **起草模型**：claude-opus-4-7
- **关联序列**：SEQ-20260428-03（M-SN-2 第二阶段 — 数据原语层落地）
- **关联卡**：CHG-SN-2-12.5（本 ADR 起草）/ CHG-SN-2-13 ~ CHG-SN-2-18（数据原语分卡实施）

### 背景

ADR-103a 已完成 packages/admin-ui Shell 编排层 10 组件公开 API。M-SN-2 第二阶段进入数据原语层（DataTable v2 + Toolbar / Filter / ColumnSettings + Pagination v2 + Drawer / Modal / AdminDropdown / SelectionActionBar + Empty / Error / Loading），覆盖 M-SN-3 视频库 / 审核台 / 来源 / 字幕 / 合并 / image-health 等 14 个视图的列表/详情共用基座。

apps/server v1 已沉淀的 ModernDataTable + useAdminTableState + useAdminTableSort + useAdminTableColumns + useTableSettings 多套 hook 共存（ADR-021 治理后仍未完全收敛），存在三类历史包袱：

1. 列宽 / 列可见 / 排序 / 分页 / 筛选状态分散在 4 个 hook，存储 key 双轨并存（`admin:table:{route}:{tableId}:v1` + `admin:table:settings:{tableId}:v1`）
2. URL 同步缺失：刷新页面或分享链接时分页 / 排序 / 筛选状态丢失
3. 客户端 / 服务端两档分页切换协议未在类型层落定，导致每个 list view 自行重复实现

DataTable v2 + useTableQuery 一次性收编。本 ADR 是 CHG-SN-2-13（DataTable v2 首张代码卡）及后续 CHG-SN-2-14 ~ CHG-SN-2-18 全部数据原语卡的硬前置门：未 PASS 不得开工任何数据原语代码卡。

### 决策

> **AMENDMENT 2026-04-30（CHG-DESIGN-11 / SEQ-20260429-02）**：
> 本 ADR §4.1 中"不内置 ColumnSettingsPanel / Toolbar / Pagination 组件本体"
> 的边界**已被 CHG-DESIGN-02 撤销**。当前真源裁定：DataTable 是**完整 .dt
> framed surface**——toolbar / search / filter chips / 表头集成菜单 / saved views /
> bulk action bar / pagination 全部进入 DataTable **一体化结构**。设计依据：
> `docs/designs/backend_design_v2.1/reference.md` §4.4 + §6.0 视觉契约。
>
> **落地状态（2026-04-30 / Step 7A 完成）**：契约一体化骨架已完整落地，包含：
>
> - ✅ **Step 1–6**（types/framed surface / 表头菜单 / toolbar+views / bulkActions+flashRowKeys / saved views 持久化）：
>   `toolbar` / `bulkActions`（含 `.dt__bulk` sticky bottom）/ `flashRowKeys` /
>   `enableHeaderMenu`（表头集成菜单含 sort / hide / clear filter）/ saved views
>   menu（持久化到 sessionStorage）。
> - ✅ **Step 7A**（骨架完整化 / 2026-04-30）：`pagination?: PaginationConfig`（DataTable
>   props + 渲染到 `.dt__foot`，24px 高页码按钮；**三态语义**：省略 prop → summary-only
>   foot 与外置 PaginationV2 零冲突；显式 `pagination={...}` → 完整 foot；
>   `pagination={{ hidden: true }}` → 完全不渲染） / `.dt__body` 独立滚动（thead sticky +
>   tbody overflow-y + 防御性 `min-height: 240px`） / 隐藏列 chip + `HiddenColumnsMenu`
>   popover（toolbar 内 views 之后、trailing 之前；pinned 列显示"已锁定"标签）/
>   filter chips slot（独立第二 flex row，6 种 FilterValue.kind 默认 formatter +
>   `column.renderFilterChip` 完全接管逃生口） / `column-visibility.ts` 共享工具。
>   覆盖 36 单测用例（step-7a-pagination-foot 8 / step-7a-hidden-cols 11 /
>   step-7a-filter-chips 14 / step-7a-body-scroll 3）；arch-reviewer (claude-opus-4-7)
>   CONDITIONAL PASS，5 项必修全部落地（删除 PaginationConfig.total / 三态语义缺省
>   渲染最简 foot / FilterChipContext 三参 ctx / 6 种 default formatter / layout 同 PR 切换）。
>
> 新模块 / server-next 表格页消费 DataTable 时，**所有 Step 1–6 + 7A 内置 props
> 必须走 DataTable**，不再外置编排。完整体验"body 独立滚动"需消费方在父级提供
> height 约束（如 `calc(100vh - topbar-h - footer-h)`），未提供时 DataTable 走
> `min-height: 240px` 防御性兜底。Toolbar / Pagination / SelectionActionBar 仍可
> 独立 export 但仅作嵌入式场景兜底，不作首选。
>
> 后续阶段（Step 7B 视频库消费切换 / Step 7C cell 沉淀 = CHG-DESIGN-12）见 SEQ-20260429-02。
>
> 本 ADR §4.1 ~ §4.5 的"原语分离"叙述保留为 M-SN-2 阶段语义沉淀的**历史
> 路径**，但**不再作为新模块的实现模板**。落地路径以 reference.md §4.4 +
> task-queue.md SEQ-20260429-02 CHG-DESIGN-02 为准。

> **AMENDMENT 2026-05-13（CHG-SN-5-11-PATCH / CHG-SN-5-11-PATCH-2）**：
>
> 新增 2 个 **行展开 Props**（additive，向前兼容；零既有消费方破坏）：
>
> - `renderExpandedRow?: (row: T) => ReactNode` —— 行展开 panel 内容渲染器；提供时 DataTable 在每行之后按需渲染展开 panel；panel 占满 `.dt__scroll` 容器宽度，不占用列 cell
> - `expandedKeys?: ReadonlySet<string>` —— 当前展开行的 `rowKey` 集合；**消费方持有状态** + `onRowClick` 切换 key，DataTable 不持有展开状态（与既有 `flashRowKeys` / `selection.selectedKeys` 同一哲学）
>
> **设计理据**（事后追溯 arch-reviewer Opus 评审 PASS / 2026-05-13）：
> 1. 命名与业界范式对齐：`renderExpandedRow` 同 antd `expandable.expandedRowRender` / MUI DataGrid `getDetailPanelContent` / TanStack `getRowCanExpand` 同源
> 2. 复数 Set 模式 `expandedKeys` 与既有 `flashRowKeys` / `selectedKeys` 三者命名对称
> 3. controlled-only（无 uncontrolled 默认）匹配 ADR-103 §4.1 "DataTable 不持有状态"主线
> 4. 签名仅接 `row` 不接 index/isExpanded：消费方已能从 row + 闭包推出全部上下文，YAGNI
> 5. 与 ADR-103 §4.1 不持有数据 / 不持久化任何状态原则一致：DataTable 仅渲染当前 expandedKeys 集合命中行的 panel，时序由消费方
>
> **起源任务卡**：CHG-SN-5-11-PATCH（落地，commit `f7c8485f`）→ CHG-SN-5-11-PATCH-2（追溯审计 + 本 AMENDMENT）
>
> **背书**：ADR-117 §决策要点 8 / D-117-5（`/admin/sources` 视频分组 outer 列表 + matrix 展开 panel 一体化）
>
> **流程教训**：CHG-SN-5-11-PATCH commit 由 sonnet 主循环直接落地未走 Opus 子代理评审，违反 CLAUDE.md §模型路由"定义新的共享组件 API 契约强制升 Opus"红线。事后追溯 Opus 评审验证 API 内容质量合格（4 维度全过：命名 / 对称性 / 状态职责 / 扩展性），NEW-P0 流程违规降级为"过程教训"，由 CHG-SN-5-CHECKLIST-AUDIT 卡纳入自动化检测机制（diff `packages/admin-ui/src/**/types.ts` 强制 Opus 子代理评审 trailer 存在性核验）。
>
> **未来扩展占位**（YAGNI / 当前不动）：
> - 展开/收起动画 prop（`expandTransition` / `expandDuration`）：当前 panel 即开即合无动画诉求
> - 多级嵌套展开：sources matrix 单级足够
> - `expandIconColumn` / `expandRowByClick`：当前整行 `onRowClick` 触发与 antd `expandRowByClick: true` 等价；未来如需区分点击 icon vs 点击行其他位置再加 `expandIconColumn` slot（增量增 prop 不破坏当前签名）

> **AMENDMENT 2026-05-14（CHG-SN-6-DATATABLE-STICKY-SCROLL / RETRO 7/7）**：
>
> 显式规范 DataTable 的 **两种高度消费模式**（API 零变更 / 文档级修订；解决 M-SN-5 CHG-SN-5-13-PATCH-2 暴露的"表格底部被截断"反复事故）：
>
> **模式 A — 整页滚动（推荐 / 默认）**：
> - 消费方不提供 height 约束 → DataTable 自然撑高至内容高度 + `min-height: 240px` 防御兜底
> - 由 `AdminShell main` 提供整页 `overflow-y: auto`，整张页面（toolbar + filters + table + foot）随 main 滚动
> - **适用**：列表页 / 标准 admin CRUD 视图（默认；M-SN-5 全部视图卡走此模式）
> - **消费方 zero work**：直接 `<DataTable .../>` 即可
>
> **模式 B — body 独立滚动（增强）**：
> - 消费方在父级提供显式 height 约束（如 `height: calc(100vh - <chrome>)` 或 flex chain min-height: 0）
> - DataTable frame 撑满父高 → `[data-table-scroll]` flex:1 自适应 → table body 单轴独立滚动 / thead sticky / foot 固定底部
> - **适用**：嵌入 dashboard 半屏 widget / dialog 内表格 / 强调"foot pagination 始终可见"的视图
> - **消费方约束**：父链全部需 `min-height: 0`（flex item 默认 auto 会阻断压缩），最外层 height 约束源（vh / 父 calc / grid row）必须穿透
>
> **失败模式**（已观察）：
> 1. 父链中间 div 缺 `min-height: 0` → DataTable 高度被内容撑爆 → 等价模式 A 但额外消耗高度（CHG-SN-5-13-PATCH-2 sources 页 PAGE_STYLE 残留教训）
> 2. 父级用 `height: 100%` 但 viewport ancestor 无显式高度 → DataTable 塌至 240px 兜底
> 3. 同一页面切换模式 A → B（动态 height）→ scroll position 不保留（已知限制；非缺陷）
>
> **不变内容**（仍保持）：
> - `min-height: 240px` 防御兜底（消费方未提供 height 时不塌至 0）
> - `[data-table-scroll]` 单 scrollport（横向 + 纵向同源，sticky thead / bulk 不漂移）
> - `[data-table-body] { display: contents }` 语义 marker（不重复设 overflow）
> - 公共 Props API 零变更（无新增 prop）
>
> **API 不变 vs prop 模式**（已否决）：
> 评审过 `bodyScrollMode?: 'page' | 'self'` prop 但驳回：
> 1. 模式仅取决于父链 height 约束链，与 DataTable 自身行为无关（同代码两个父容器即两种模式）
> 2. 加 prop 让消费方 "决定"实际由 CSS 决定的属性 → API 与实际行为脱钩易误判
> 3. 现状 zero-prop "约定" + 文档规范更准确反映责任分配（消费方负责 height chain / DataTable 负责自适应）
>
> **起源任务卡**：CHG-SN-5-13-PATCH-2（生产 bug 修复 / sources / merge 页表格底部截断）→ CHG-SN-6-DATATABLE-STICKY-SCROLL（本 AMENDMENT 协议化两种模式）
>
> **背书**：CHG-DESIGN-02 Step 7A 防御兜底落地 + Step 7B fix#2 单 scrollport 设计；arch-reviewer R-3 short data thead/foot 重叠保护

#### 4.1 DataTable v2 — 表格基座

- **文件**：`packages/admin-ui/src/components/data-table/data-table.tsx`
- **导出**：`DataTable` + `TableColumn` + `TableSortState` + `TableSelectionState` + 配套 union 类型
- **职责**：渲染列 / 行 / sticky header / row hover / 选区高亮 / 列宽（CSS Grid 模板 + min-width）/ 排序 indicator / 行点击 / 行选择 checkbox。两档分页（`mode: 'client' | 'server'`）由 prop 显式决定；不持有 query 状态本体（query 状态由 `useTableQuery` 管理，结果以 `query` + `onQueryChange` 注入）。
- **不做**：（M-SN-2 阶段定义；2026-04-30 已被 CHG-DESIGN-02 amendment 撤销）不内置 ColumnSettingsPanel / Toolbar / Pagination 组件本体（由消费方编排，参见 4.4 / 4.5）；不持有数据获取（不调用 apiClient / fetch / SWR）；不实现虚拟滚动（M-SN-2 不涉及万级数据集，virtual scroll 推迟到 ADR-100 候选依赖 `@tanstack/react-virtual` 评审通过后另立 ADR）；不内置筛选 UI（filterContent 由列槽位透传 ReactNode）；不持久化任何状态（持久化由 `useTableQuery` 集中负责）。

```typescript
export interface DataTableProps<T> {
  /** 行数据；mode='client' 时为完整数据集，mode='server' 时为当前页数据 */
  readonly rows: readonly T[]
  /** 列定义（不可变）*/
  readonly columns: readonly TableColumn<T>[]
  /** row id 抽取器（用于 React key + 选区集合的稳定标识）*/
  readonly rowKey: (row: T) => string
  /** 分页模式；client = 客户端 sort/filter/paginate；server = 服务端，DataTable 仅渲染当前页 */
  readonly mode: 'client' | 'server'
  /** 当前 query 状态（来自 useTableQuery）*/
  readonly query: TableQuerySnapshot
  /** query 状态变更回调（来自 useTableQuery）*/
  readonly onQueryChange: (next: TableQueryPatch) => void
  /** 服务端模式必填：远端总行数；客户端模式忽略此字段，由 rows.length 自动推导 */
  readonly totalRows?: number
  /** 加载态；true 时表格内部覆盖 LoadingState 原语（见 4.9）*/
  readonly loading?: boolean
  /** 错误态；非 undefined 时表格 body 替换为 ErrorState（见 4.9）*/
  readonly error?: Error | undefined
  /** 空态；rows.length === 0 且 !loading && !error 时渲染 EmptyState（见 4.9）；undefined 时渲染默认 EmptyState */
  readonly emptyState?: ReactNode
  /** 选区状态（受控）；undefined 时表格不渲染 selection checkbox 列 */
  readonly selection?: TableSelectionState
  /** 选区变更回调；selection 受控时必填 */
  readonly onSelectionChange?: (next: TableSelectionState) => void
  /** 行点击回调；undefined 时行不响应 click（仅 hover 视觉）*/
  readonly onRowClick?: (row: T, index: number) => void
  /** 行密度；'comfortable'=40px 行高 / 'compact'=32px；映射 admin-layout/table.ts 的 row-h / row-h-compact */
  readonly density?: 'comfortable' | 'compact'
  /** 表格 testid（e2e 必备）*/
  readonly 'data-testid'?: string
}

export interface TableColumn<T> {
  readonly id: string
  readonly header: ReactNode
  readonly accessor: (row: T) => unknown
  /** 像素宽度；undefined 时按 minWidth + flex 1 自适应 */
  readonly width?: number
  /** 最小宽度；默认读取 admin-layout/table.ts 的 col-min-w (80px) */
  readonly minWidth?: number
  /** 是否允许列宽拖拽（M-SN-2 落地，由 useTableQuery 持久化到 sessionStorage）*/
  readonly enableResizing?: boolean
  /** 是否允许排序；为 true 时 header 渲染 sort indicator + 点击触发 onQueryChange.sort */
  readonly enableSorting?: boolean
  /** cell 自定义渲染；undefined 时 fallback 为 String(accessor(row)) */
  readonly cell?: (ctx: TableCellContext<T>) => ReactNode
  /** Per-column ⋮ 菜单配置；存在时列头右侧渲染 ⋮ 按钮（见 4.4）*/
  readonly columnMenu?: ColumnMenuConfig
  /** 列默认可见性；undefined → true；ColumnSettingsPanel 受 useTableQuery 持久化覆盖 */
  readonly defaultVisible?: boolean
  /** 列展示固定（不可隐藏）；典型用于操作列 */
  readonly pinned?: boolean
  /** cell overflow visible（典型用于行内 dropdown 不被截断）*/
  readonly overflowVisible?: boolean
}

export interface TableCellContext<T> {
  readonly row: T
  readonly value: unknown
  readonly rowIndex: number
}

export interface TableSortState {
  /** 排序列 id；undefined 表示无排序 */
  readonly field: string | undefined
  /** 方向；field === undefined 时本字段语义无效 */
  readonly direction: 'asc' | 'desc'
}

export interface TableSelectionState {
  /** 选中行 rowKey 的不可变集合 */
  readonly selectedKeys: ReadonlySet<string>
  /** 全选语义：'page' = 仅当前页 / 'all-matched' = 选中全量匹配（服务端模式下用） */
  readonly mode: 'page' | 'all-matched'
}

export interface ColumnMenuConfig {
  readonly canSort?: boolean
  readonly canHide?: boolean
  readonly filterContent?: ReactNode
  readonly isFiltered?: boolean
  readonly onClearFilter?: () => void
}

/**
 * `TableColumn<T>` 中与行类型 T 无关的纯元数据子集。
 *
 * 用途：useTableQuery / ColumnSettingsPanel 只需列 id / header / 可见性 / 排序能力，
 * 不需要 accessor / cell 等逆变函数字段。
 * 使用此类型而非 `TableColumn<unknown>[]` 的原因：
 *   `TableColumn<T>` 含逆变参数位（accessor / cell），
 *   `TableColumn<Video>` 无法赋值给 `TableColumn<unknown>`，
 *   但任意 `TableColumn<T>` 在结构子类型下都满足 `ColumnDescriptor`。
 */
export interface ColumnDescriptor {
  readonly id: string
  readonly header: ReactNode
  readonly defaultVisible?: boolean
  readonly pinned?: boolean
  readonly enableSorting?: boolean
}
```

**字段重要决策**：

- `TableSortState.direction` 字段名统一为 `direction`（与 v1 ModernDataTable 一致）；废弃 v1 useAdminTableState 的 `dir` 命名歧义。
- `TableSortState.field` 用 `string | undefined` 表达"无排序"，不用 `null` —— 与 readonly + TS 严格模式更对齐，避免 `null` / `undefined` 二元分支。
- `mode: 'client' | 'server'` 字面常量必填，**禁止由 rows.length 启发式推断** —— 启发式会在数据 < 200 但实际服务端分页的场景误判（如 server 模式但当前页只剩 5 条）。
- `selection` 受控；`mode: 'page' | 'all-matched'` 暴露给消费方，由 SelectionActionBar 渲染"选中 N 条" / "选中全部 X 条"差异化 UI。

#### 4.2 useTableQuery + table-query-store

- **文件**：
  - `packages/admin-ui/src/components/data-table/use-table-query.ts`
  - `packages/admin-ui/src/components/data-table/table-query-store.ts`（zustand 单例 store，与 ToastViewport 同范式）
  - `packages/admin-ui/src/components/data-table/url-sync.ts`（纯函数：snapshot ↔ URLSearchParams 互转）
  - `packages/admin-ui/src/components/data-table/storage-sync.ts`（纯函数：snapshot ↔ sessionStorage 互转）
- **职责**：单 hook 持有 5 类状态（pagination / sort / filters / columns / selection）；自动同步到 URL（pagination / sort / filters）+ sessionStorage（columns / pagination.pageSize / 列宽）；`onQueryChange` patch 形态变更（PATCH 而非 SET，避免覆盖未变字段）。
- **不做**：不调用 router.push 本体（router 注入由消费方提供 `routerAdapter`，避免 packages/admin-ui 直 import `next/navigation`）；不持有数据本体；不发请求；不持久化 selection（选区是会话内瞬态状态）；不持久化 filters 到 sessionStorage（filters 走 URL，分享/书签语义优于"我上次选了什么"）。

```typescript
export interface UseTableQueryOptions {
  /** 表格实例稳定 ID；同一 tableId 共享同一份持久化命名空间；必填 */
  readonly tableId: string
  /** 路由适配器（由消费方注入 next/navigation router.push/replace + useSearchParams 等价）；
   *  packages/admin-ui 不直 import next/navigation，保持 Storybook / 单测 / 跨 framework 兼容 */
  readonly router: TableRouterAdapter
  /** 初始/默认状态；URL + sessionStorage 反序列化失败时 fallback */
  readonly defaults?: Partial<TableQueryDefaults>
  /** URL 参数命名空间前缀；多表格同页时避免冲突；默认空（单表格场景）*/
  readonly urlNamespace?: string
  /** 列元数据（用于 columns 状态默认派生 + url-sync 校验排序字段合法性）；
   *  类型为 ColumnDescriptor 而非 TableColumn<unknown>：
   *  TableColumn<T> 含逆变函数字段，TableColumn<Video> 不可赋值给 TableColumn<unknown>；
   *  任意 TableColumn<T> 满足 ColumnDescriptor 结构子类型，消费方无需类型转换 */
  readonly columns: readonly ColumnDescriptor[]
}

export interface TableRouterAdapter {
  /** 同步读取当前 URL 的 search params；SSR 下消费方传入 cookie / header 派生快照 */
  readonly getSearchParams: () => URLSearchParams
  /** 同步推送（无历史栈条目；用于内部 query 变更）*/
  readonly replace: (next: URLSearchParams) => void
  /** 推入历史栈（用于"打开新筛选 → 浏览器 back 可恢复"）；M-SN-2 默认走 replace，本字段为后续扩展槽 */
  readonly push?: (next: URLSearchParams) => void
}

export interface TableQuerySnapshot {
  readonly pagination: { readonly page: number; readonly pageSize: number }
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
  readonly columns: ReadonlyMap<string, ColumnPreference>
  readonly selection: TableSelectionState
}

export interface TableQueryPatch {
  readonly pagination?: Partial<TableQuerySnapshot['pagination']>
  readonly sort?: TableSortState
  readonly filters?: ReadonlyMap<string, FilterValue>
  readonly columns?: ReadonlyMap<string, ColumnPreference>
  readonly selection?: TableSelectionState
}

export interface ColumnPreference {
  readonly visible: boolean
  readonly width?: number
}

/** filter 合法值；any 严禁，受控收敛到以下并集 */
export type FilterValue =
  | { readonly kind: 'text'; readonly value: string }
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'bool'; readonly value: boolean }
  | { readonly kind: 'enum'; readonly value: readonly string[] }
  | { readonly kind: 'range'; readonly min?: number; readonly max?: number }
  | { readonly kind: 'date-range'; readonly from?: string; readonly to?: string }

export interface TableQueryDefaults {
  readonly pagination: { readonly page: number; readonly pageSize: number }
  readonly sort: TableSortState
  readonly filters: ReadonlyMap<string, FilterValue>
}

export function useTableQuery(options: UseTableQueryOptions): {
  readonly snapshot: TableQuerySnapshot
  readonly patch: (next: TableQueryPatch) => void
  readonly reset: () => void
}
```

**4.2.1 URL 同步规约**（精确字段表，CHG-SN-2-13 实施基准）

同步到 URL 的状态（影响"分享 / 书签 / 后退-前进"语义的状态）：
- `pagination.page` → URL key `page`（默认 1 时省略）
- `pagination.pageSize` → **不进 URL**，归入 sessionStorage（属用户布局偏好）
- `sort.field` + `sort.direction` → URL keys `sort` + `sortDir`（field 为 undefined 时两 keys 均省略）
- `filters` → URL key 模式 `f.{filterId}` + 编码规则见下表

URL 命名空间：`urlNamespace='videos'` 时所有 keys 加前缀 `videos.`（如 `videos.page=2&videos.sort=created_at`）；空命名空间时不加前缀。同一页同时挂载 2+ 表格时必须设置不同 namespace。

编码规则：
- `text` / `number` / `bool` → 字符串 / 数字字符串 / `'true'|'false'`
- `enum` → 逗号分隔（`enum.value=['a','b']` → `f.status=a,b`）
- `range` → `f.{id}.min=N` + `f.{id}.max=M`（缺省者省略）
- `date-range` → `f.{id}.from=ISO` + `f.{id}.to=ISO`（缺省者省略；格式 ISO 8601）

默认值不进 URL（保持 URL 干净，分享时只携带与默认不同的部分）；反序列化时缺失 key fallback 到 defaults。

非法值处理：URL key 解析失败（如 `page=abc` 或 `sortDir=middle`）→ console.warn + fallback 到 defaults，**不抛错**（避免错误 URL 导致页面崩溃）。

Next.js App Router 适配（消费方实现 `TableRouterAdapter`）：
- `getSearchParams` → `useSearchParams()` 返回值的副本
- `replace` → `router.replace(\`${pathname}?${next.toString()}\`, { scroll: false })`（`scroll: false` 必填，避免 query 变更引起页面顶部滚动）

**4.2.2 sessionStorage 同步规约**

存储 key：`admin-ui:table:{tableId}:v1`（tableId 由消费方稳定提供；与 v1 双轨命名收敛为单一 namespace）

持久化字段：
- `pagination.pageSize`（用户喜欢的 20/50/100）
- `columns`（visible + width；按 column.id 索引）

不持久化字段（走 URL 或瞬态）：
- `pagination.page`、`sort`、`filters` —— 走 URL
- `selection` —— 会话瞬态

序列化容错：JSON.parse 失败 / schema 不匹配 → 静默清除该 key + fallback defaults，不阻塞渲染（禁止空 catch，统一 console.warn）。

v1 → v2 迁移：CHG-SN-2-13 不读取 v1 旧 key（`admin:table:{route}:{tableId}:v1` / `admin:table:settings:{tableId}:v1`）—— apps/server 退役路径，v1 用户偏好不迁移；server-next 是新表格首次会话从默认开始。

**4.2.3 store 实现要点**（与 ADR-103a §4.4-1 Provider 不下沉硬约束对齐）

- 模块顶层零副作用：`window` / `document` / `sessionStorage` 访问全部在 `useEffect` 内
- SSR 安全：`getServerSnapshot` 返回稳定 defaults 派生值
- 单 store 多 tableId 共存：store 内部以 tableId 为 Map key 持有多份 snapshot，避免多 hook 实例 store collision

#### 4.3 两档分页协议

| 档位 | 触发条件 | 数据契约 | 消费方使用模式 |
|---|---|---|---|
| 客户端分页 | `mode='client'` 且数据集 ≤ 200 行 | `rows` 传入完整数据集；DataTable 内部按 `query.sort` + 客户端 filter + slice paginate | RSC/SWR 一次性拉全量 → DataTable client mode 渲染；query 变更不触发再请求 |
| 服务端分页 | `mode='server'` 或数据集 > 200 行 | `rows` 传入当前页（pageSize 行）；`totalRows` 必填；`onQueryChange` 触发后由消费方按新 snapshot 重新请求 | SWR key 含 query 关键字段 → onQueryChange patch → SWR key 变化 → 自动 refetch |

切换阈值 200 条为基准建议；`mode` 必须由消费方显式声明，DataTable 不做隐式启发式切换。

消费方使用模式（client）：

```typescript
const banners = useSWR('/admin/banners', fetcher) // 一次拉全量
const tableQuery = useTableQuery({ tableId: 'banners', router, columns })
return (
  <DataTable
    mode="client"
    rows={banners.data ?? []}
    columns={columns}
    rowKey={r => r.id}
    query={tableQuery.snapshot}
    onQueryChange={tableQuery.patch}
    loading={banners.isLoading}
  />
)
```

消费方使用模式（server）：

```typescript
const tableQuery = useTableQuery({ tableId: 'videos', router, columns })
const { data, isLoading } = useSWR(
  ['/admin/videos', tableQuery.snapshot.pagination, tableQuery.snapshot.sort, serializeFilters(tableQuery.snapshot.filters)],
  ([url, pagination, sort, filters]) => apiClient.get(url, { ...pagination, ...sort, ...filters }),
)
return (
  <DataTable
    mode="server"
    rows={data?.items ?? []}
    totalRows={data?.total ?? 0}
    columns={columns}
    rowKey={r => r.id}
    query={tableQuery.snapshot}
    onQueryChange={tableQuery.patch}
    loading={isLoading}
  />
)
```

API 入参规范（apps/api 侧）：`?page=1&pageSize=20&sort=created_at&sortDir=desc&f.status=approved,pending`
响应格式：`{ items: T[], total: number, page: number, pageSize: number }`

#### 4.4 Toolbar / Filter / ColumnSettings

- **Toolbar** — `packages/admin-ui/src/components/data-table/toolbar.tsx`
  - **职责**：表格上方 1 行容器，槽位组合（左：search / 全局 filter trigger；右：refresh / column-settings ⚙ / 自定义 actions）；不持有数据，不调 query.patch（每个 slot 由消费方塞自定义组件）

```typescript
export interface ToolbarProps {
  readonly leading?: ReactNode  // search / global filter chip 槽
  readonly trailing?: ReactNode // 自定义 actions
  readonly columnSettings?: ReactNode // ⚙ 触发器槽
  readonly className?: string
}
```

- **FilterChip / FilterChipBar** — `packages/admin-ui/src/components/data-table/filter-chip.tsx`
  - **职责**：单个筛选条件的 Chip（`{label}: {value}` + ✕ 清除）；`FilterChipBar` 容器水平排列多 chip；不内置 filter form / popover（filter form 由消费方按业务自由组装）

```typescript
export interface FilterChipProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onClear: () => void
}

export interface FilterChipBarProps {
  readonly items: readonly FilterChipProps[]
  readonly onClearAll?: () => void
}
```

- **ColumnSettingsPanel** — `packages/admin-ui/src/components/data-table/column-settings-panel.tsx`
  - **职责**：portal 渲染（挂 body）的列可见性/列宽设置面板；ESC 关闭 + 点击外部关闭 + focus trap；不持久化（持久化由 useTableQuery 接管）

```typescript
export interface ColumnSettingsPanelProps {
  readonly open: boolean
  /** ColumnDescriptor 而非 TableColumn<unknown>（同 UseTableQueryOptions.columns 同理，
   *  避免 TableColumn<T> 逆变参数位导致消费方传 TableColumn<Video>[] 报 TS 类型错误）*/
  readonly columns: readonly ColumnDescriptor[]
  readonly value: ReadonlyMap<string, ColumnPreference>
  readonly onChange: (next: ReadonlyMap<string, ColumnPreference>) => void
  readonly onClose: () => void
  readonly anchorRef: React.RefObject<HTMLElement>
}
```

#### 4.5 Pagination v2

- **文件**：`packages/admin-ui/src/components/pagination/pagination.tsx`
- **导出**：`Pagination`

```typescript
export interface PaginationProps {
  readonly page: number
  readonly pageSize: number
  readonly totalRows: number
  readonly onPageChange: (next: number) => void
  readonly onPageSizeChange?: (next: number) => void
  /** 默认 [20, 50, 100] */
  readonly pageSizeOptions?: readonly number[]
  /** 页码窗口大小（前后各显示几个页码）；默认 2 */
  readonly windowSize?: number
  readonly className?: string
}
```

#### 4.6 Drawer / Modal — 通用业务原语

- **文件**：
  - `packages/admin-ui/src/components/overlay/drawer.tsx`
  - `packages/admin-ui/src/components/overlay/modal.tsx`
  - `packages/admin-ui/src/components/overlay/use-overlay.ts`（共用 focus trap + ESC + backdrop click 逻辑）
- **职责**：
  - **Drawer**：从 `placement: 'left' | 'right' | 'bottom' | 'top'` 滑入；典型业务场景：视频编辑、Banner 编辑、来源详情
  - **Modal**：居中遮罩弹窗 + 三档尺寸（`size: 'sm' | 'md' | 'lg'`）；典型业务场景：Confirm dialog、Form 弹窗、单字段编辑
  - 共用：focus trap（首次 open 时焦点进入容器，ESC/backdrop click 关闭后焦点归还触发器）、`aria-modal="true"`、`role="dialog"`、`aria-labelledby`、ESC + backdrop click 关闭、滚动锁定 body

```typescript
export interface DrawerProps {
  readonly open: boolean
  readonly placement: 'left' | 'right' | 'bottom' | 'top'
  readonly onClose: () => void
  readonly title?: ReactNode
  readonly width?: number | string  // 仅 left/right；默认 480px
  readonly height?: number | string // 仅 top/bottom；默认 50vh
  readonly closeOnEscape?: boolean   // 默认 true
  readonly closeOnBackdropClick?: boolean // 默认 true
  readonly children: ReactNode
  readonly 'data-testid'?: string
}

export interface ModalProps {
  readonly open: boolean
  readonly size?: 'sm' | 'md' | 'lg'  // sm=400px / md=560px / lg=800px
  readonly onClose: () => void
  readonly title?: ReactNode
  readonly closeOnEscape?: boolean
  readonly closeOnBackdropClick?: boolean
  readonly children: ReactNode
  readonly 'data-testid'?: string
}

export function useOverlay(opts: {
  readonly open: boolean
  readonly onClose: () => void
  readonly closeOnEscape?: boolean
  readonly closeOnBackdropClick?: boolean
}): {
  readonly containerRef: React.RefObject<HTMLDivElement>
  readonly backdropProps: { readonly onClick: (e: React.MouseEvent) => void }
}
```

**z-index**：Drawer / Modal 同档 `var(--z-modal): 1000`（业务原语层 L1，与 ADR-103a §4.3 表对齐）。新增 admin-layout token（`packages/design-tokens/src/admin-layout/z-index.ts` 追加）：

```typescript
// 追加到 admin-layout/z-index.ts（ADR-103a §4.3 已新建 z-shell-* 三项）
export const adminLayoutZIndexBusiness = {
  'z-modal': '1000',           // 业务 Drawer / Modal 共用
  'z-admin-dropdown': '980',   // AdminDropdown 默认（挂在 Modal 之下）
} as const
```

层级关系：`AdminDropdown 980 < Drawer/Modal 1000 < Shell 抽屉 1100 < CmdK 1200 < Toast 1300`（与 ADR-103a §4.3 衔接）。

Drawer vs Modal 决策树（消费方使用指南）：
- 表单编辑（多字段、长内容）→ Drawer
- 二次确认（删除/不可逆操作）→ Modal sm
- 单字段快速编辑 → Modal sm
- 遮罩选择（图片/视频选择器）→ Modal lg

#### 4.7 AdminDropdown

- **文件**：`packages/admin-ui/src/components/dropdown/admin-dropdown.tsx`
- **导出**：`AdminDropdown` + `AdminDropdownItem`
- **职责**：portal 渲染的下拉菜单（行操作菜单 / 列头 ⋮ / Toolbar 自定义菜单）；点击外部关闭 + ESC 关闭 + 上下方向键导航 + Enter 触发；自动定位（trigger 锚定 + 边界回避）

```typescript
export interface AdminDropdownProps {
  readonly open: boolean
  readonly trigger: ReactNode
  readonly items: readonly AdminDropdownItem[]
  readonly onOpenChange: (next: boolean) => void
  readonly align?: 'left' | 'right'  // 默认 right
  readonly placement?: 'top' | 'bottom'  // 默认 bottom；不足时自动翻转
  readonly 'data-testid'?: string
}

export interface AdminDropdownItem {
  readonly key: string
  readonly label: ReactNode
  readonly icon?: ReactNode
  readonly onClick: () => void
  readonly danger?: boolean
  readonly disabled?: boolean
  readonly shortcut?: string      // 'mod+e' 等；formatShortcut 渲染
  readonly separator?: boolean    // 上方分隔线
}
```

#### 4.8 SelectionActionBar

- **文件**：`packages/admin-ui/src/components/data-table/selection-action-bar.tsx`
- **导出**：`SelectionActionBar`
- **职责**：行选中后吸附于表格底部/顶部的批量操作工具栏；显示"已选 N 条"+ 全选切换（page ↔ all-matched）+ 自定义 actions + 清除选择按钮

```typescript
export interface SelectionActionBarProps {
  readonly visible: boolean
  readonly variant?: 'sticky-bottom' | 'sticky-top'  // 默认 'sticky-bottom'
  readonly selectedCount: number
  readonly totalMatched?: number  // 服务端模式提供；undefined 时不显示"选择全部 X 条"
  readonly selectionMode: TableSelectionState['mode']
  readonly onSelectionModeChange?: (next: TableSelectionState['mode']) => void
  readonly onClearSelection: () => void
  readonly actions: readonly SelectionAction[]
  readonly className?: string
  readonly 'data-testid'?: string
}

export interface SelectionAction {
  readonly key: string
  readonly label: ReactNode
  readonly icon?: ReactNode
  readonly onClick: () => void
  readonly variant?: 'default' | 'primary' | 'danger'
  readonly disabled?: boolean
  readonly confirm?: { readonly title: string; readonly description?: string }
}
```

#### 4.9 Empty / Error / Loading 状态原语

- **文件**：
  - `packages/admin-ui/src/components/state/empty-state.tsx`
  - `packages/admin-ui/src/components/state/error-state.tsx`
  - `packages/admin-ui/src/components/state/loading-state.tsx`
- **导出**：`EmptyState` / `ErrorState` / `LoadingState`

```typescript
export interface EmptyStateProps {
  readonly title?: ReactNode
  readonly description?: ReactNode
  readonly illustration?: ReactNode
  readonly action?: { readonly label: ReactNode; readonly onClick: () => void }
  readonly className?: string
}

export interface ErrorStateProps {
  readonly error: Error
  readonly title?: ReactNode
  readonly onRetry?: () => void
  readonly className?: string
}

export interface LoadingStateProps {
  /** 'spinner' = 居中转圈 / 'skeleton' = 骨架行（DataTable body 内消费）*/
  readonly variant?: 'spinner' | 'skeleton'
  /** skeleton 行数；variant='skeleton' 时生效；默认 5 */
  readonly skeletonRows?: number
  readonly label?: ReactNode
  readonly className?: string
}
```

#### 4.10 不变约束（跨全部数据原语组件）

1. **Provider 不下沉**（继承 ADR-103a §4.4-1）：packages/admin-ui 数据原语层零 `BrandProvider` / `ThemeProvider` / `createContext` 声明；所有跨组件状态由 zustand 单例 store 持有（仅 `table-query-store` + `toast-store`）
2. **Edge Runtime 兼容**（继承 ADR-103a §4.4-2）：模块顶层零 `window` / `document` / `fetch` / `localStorage` / `sessionStorage` / `navigator` 访问；URL 同步 / sessionStorage 读写全部在 `useEffect` 内或事件 handler 内
3. **零硬编码颜色**（继承 ADR-103a §4.4-3）：颜色 / 间距 / 阴影全部读 admin-layout + semantic + brands token；行高读 `admin-layout/table.row-h` / `row-h-compact`；列最小宽度读 `col-min-w`
4. **零图标库依赖**（继承 ADR-103a §4.4-4）：所有 icon 槽位类型为 `React.ReactNode`；packages/admin-ui 自持的内联 SVG 仅限 chevron / sort indicator / close × / checkbox check 等结构性微图标
5. **零 `any`**：FilterValue 用 union 收敛；TableSelectionState.selectedKeys 用 `ReadonlySet<string>`
6. **零空 catch**：URL/storage 反序列化失败统一走 `console.warn` + fallback defaults
7. **Props readonly**：所有 Props interface 字段 readonly；数组用 `readonly T[]`；map 用 `ReadonlyMap`；set 用 `ReadonlySet`
8. **router 反向注入**：packages/admin-ui 不直 `import { useRouter } from 'next/navigation'`；通过 `TableRouterAdapter` 由消费方注入
9. **禁止 `as unknown as T`**：TableColumn<T> 的 cell ctx.value 类型为 `unknown`，由消费方在 cell 内做窄化
10. **ColumnDescriptor 隔离逆变**：`useTableQuery` / `ColumnSettingsPanel` 的 `columns` 参数类型为 `ColumnDescriptor`（仅含元数据字段），而非 `TableColumn<unknown>`；原因：`TableColumn<T>` 含逆变函数参数（accessor / cell），`TableColumn<Video>` 无法赋值给 `TableColumn<unknown>`，但满足 `ColumnDescriptor` 结构子类型；DataTable 本体仍使用完整 `TableColumn<T>`（泛型传播）

### 替代方案（已否决）

#### B1 — useTableQuery 直 import `next/navigation`（不走 router adapter）

**否决理由**：违反"packages/admin-ui 跨 framework 友好"约束；丧失 Storybook + 单元测试简单 mock 能力；`TableRouterAdapter` 是清晰的依赖反转，server-next 应用层一次封装即可。

#### B2 — 一档分页（统一服务端）

**否决理由**：admin 大量列表数据 ≤ 200（Banner / 运营位 / 来源 / Sites），强制服务端 round-trip 是无谓延迟；客户端模式下 sort/filter 切换瞬时响应（用户感知 0ms）。

#### B3 — 三档分页（client < 200 / server-static 200-50k / server-virtual >50k）

**否决理由**：M-SN-2 范围内无 >50k 单页数据需求；virtual scroll 引入新依赖（`@tanstack/react-virtual`）过早优化；50k+ 数据集场景出现时另立 ADR 升级即可。

#### B4 — Drawer 与 Modal 合并为单一 Overlay 组件

**否决理由**：两者交互 / 视觉 / 尺寸 / 默认 width/height 差异大，合并后 prop 表混乱；分离更清晰；共用逻辑已抽到 `useOverlay` hook 复用，DRY 已满足。

#### B5 — ColumnSettings 持久化复用 v1 双轨 key（兼容 v1 用户偏好迁移）

**否决理由**：apps/server 整目录 cutover 后退役；新 namespace `admin-ui:table:{tableId}:v1` 一次性收敛，避免双轨并存；server-next admin 用户 ≤50 人，迁移成本极低。

#### B6 — selection 持久化到 sessionStorage

**否决理由**：跨页延续选区语义复杂且易错；宁可瞬态丢失也不要错误的"saved selection"；如需持久化批量场景另立 ADR 引入 SavedSelection 概念（含 query 快照 + 选中 keys 时间戳）。

### 后果

#### 正面

- DataTable v2 + useTableQuery 一次性收编 v1 ModernDataTable + 4 套 hook + 双轨 storage key 历史包袱，CHG-SN-2-13 起 14 个视图共享单一基座。
- URL 同步落定 → 分享 / 书签 / 浏览器后退-前进语义齐全，admin 协作场景零成本。
- 两档分页协议在 prop 层显式声明，消费方根据数据规模选 mode，不踩隐式陷阱。
- Drawer / Modal / AdminDropdown / SelectionActionBar 共享 useOverlay focus trap + ESC + backdrop + scroll lock，a11y 基线达标。
- z-index 业务原语层（1000 / 980）与 ADR-103a Shell 层（1100/1200/1300）+ admin-layout token 一次性落定，cross-component 层叠零冲突。
- 单元测试覆盖率目标 ≥75%（url-sync / storage-sync 纯函数全覆盖）。

#### 负面

- `TableRouterAdapter` 显式注入 → server-next 应用层需写一次 adapter 包装（约 30 行）。
- v1 用户偏好不迁移 → server-next 第一次访问从默认开始（M-SN-2 周期内 admin 用户 ~10 人，单次迁移成本极低）。
- FilterValue union 收敛 → 自定义筛选类型需走 `kind: 'enum'` + 业务侧 encode/decode；与"零 any"权衡选择保 union 严格。

#### 风险

- URL key 命名空间与 next-intl / next/navigation 已使用的 query key 冲突 → CHG-SN-2-13 验证（server-next 单语言 zh-CN，无 locale query；冲突概率低）。
- 多表格同页需明确 namespace —— 由 `urlNamespace` prop 解决，但消费方易遗漏 → ESLint 自定义规则补强（`useTableQuery` 同文件内出现 2+ 次必须显式传 `urlNamespace`）。
- sessionStorage 体积 —— 每个 tableId 持久化 columns + pageSize 约 < 1KB；14 视图 ≈ 14KB，远低于 5MB 上限。

### 影响文件

#### packages/admin-ui（M-SN-2 第二阶段新建）

- `packages/admin-ui/src/components/data-table/data-table.tsx`（CHG-SN-2-13）
- `packages/admin-ui/src/components/data-table/use-table-query.ts`（CHG-SN-2-13）
- `packages/admin-ui/src/components/data-table/table-query-store.ts`（CHG-SN-2-13）
- `packages/admin-ui/src/components/data-table/url-sync.ts`（CHG-SN-2-13）
- `packages/admin-ui/src/components/data-table/storage-sync.ts`（CHG-SN-2-13）
- `packages/admin-ui/src/components/data-table/types.ts`（CHG-SN-2-13，集中所有 type 导出）
- `packages/admin-ui/src/components/data-table/toolbar.tsx`（CHG-SN-2-14）
- `packages/admin-ui/src/components/data-table/filter-chip.tsx`（CHG-SN-2-14）
- `packages/admin-ui/src/components/data-table/column-settings-panel.tsx`（CHG-SN-2-14）
- `packages/admin-ui/src/components/data-table/selection-action-bar.tsx`（CHG-SN-2-17）
- `packages/admin-ui/src/components/pagination/pagination.tsx`（CHG-SN-2-15）
- `packages/admin-ui/src/components/overlay/drawer.tsx`（CHG-SN-2-16）
- `packages/admin-ui/src/components/overlay/modal.tsx`（CHG-SN-2-16）
- `packages/admin-ui/src/components/overlay/use-overlay.ts`（CHG-SN-2-16）
- `packages/admin-ui/src/components/dropdown/admin-dropdown.tsx`（CHG-SN-2-17）
- `packages/admin-ui/src/components/state/empty-state.tsx`（CHG-SN-2-18）
- `packages/admin-ui/src/components/state/error-state.tsx`（CHG-SN-2-18）
- `packages/admin-ui/src/components/state/loading-state.tsx`（CHG-SN-2-18）
- `packages/admin-ui/src/index.ts`（追加 components/* 桶导出）

#### packages/design-tokens

- `packages/design-tokens/src/admin-layout/z-index.ts`（追加 `z-modal: 1000` + `z-admin-dropdown: 980`，与 ADR-103a §4.3 z-shell-* 同文件）
- `packages/design-tokens/build.ts`（buildLayoutVars 追加 z-modal / z-admin-dropdown）
- `tests/unit/design-tokens/admin-layout.test.ts`（追加 2 项 z-index 数值断言）

#### scripts

- `scripts/verify-token-isolation.mjs`（FORBIDDEN_TOKENS 追加 `z-modal` / `z-admin-dropdown`，禁止 web-next 消费）
- `scripts/verify-server-next-isolation.mjs`（扩展扫描 `packages/admin-ui/src/components/**` 模块顶层 forbidden globals + Provider 声明）

#### apps/server-next（M-SN-3 起视图卡消费）

- `apps/server-next/src/lib/table-router-adapter.ts`（M-SN-3 第一张列表卡新建：next/navigation 包装为 TableRouterAdapter；建议提前到 CHG-SN-2-13 同卡新建）

### 关联

- **关联 ADR**：ADR-022（token 单一真源）/ ADR-023（CSS 变量 + Tailwind 桥接）/ ADR-100（server-next 立项 + 依赖白名单）/ ADR-102（admin token 4+1 层）/ ADR-103a（Shell 公开 API 契约 + 4 级 z-index 规范上层 L2-L4）/ ADR-021（v1 表格双轨治理；本 ADR 为 v2 一次性收敛）
- **关联 plan**：§6 M-SN-2 v2.3（数据原语层范围 B 块）/ §4.4（Provider 不下沉）/ §4.7（依赖白名单：zustand 已收编）/ §8 复用矩阵 v2.3（DataTable 列覆盖 14 个 admin/* 视图）
- **关联序列**：SEQ-20260428-03（M-SN-2 第二阶段 — 数据原语层落地）
- **评审结论**：arch-reviewer (claude-opus-4-7) — PASS（10 项评审重点全 PASS / 无必修 / 3 条建议优化登记后续）

---

## ADR-106: M-SN-4 admin-ui 共享组件下沉清单 + DecisionCard 跨应用层例外协议

> 状态：accepted（CHG-SN-4-04 实装 PASS + 5 件下沉全部就位，2026-05-02）
> 日期：2026-05-01（草拟）/ 2026-05-02（CHG-SN-4-04 评审反馈补反向兜底 + 实装 PASS 转 accepted）
> 任务卡：CHG-SN-4-03 / CHG-SN-4-04 / SEQ-20260501-01
> 关联 plan：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §1 D-14 + §7

### 上下文

`docs/server_next_plan_20260427.md` §3 admin 子项目"复用矩阵"明确 M-SN-4 阶段须下沉 5 件共享组件到 `packages/admin-ui`：BarSignal 双柱图 / LineHealthDrawer 证据抽屉 / RejectModal / StaffNoteBar / DecisionCard 上移。其中 DecisionCard 当前位于 `apps/server-next/src/app/admin/moderation/_client/`（CHG-SN-4-02 实装），跨 moderation + VideoEditDrawer = **2 处**复用，仅满足 admin 子项目"首次跨 2 视图复用即强制下沉"规则，不满足 CLAUDE.md 项目级"3 处以上必须提取"通用规则。两条规则的强弱对照需协议化处理。

### 决策

1. **5 件下沉**纳入 CHG-SN-4-04 实施范围；BarSignal / LineHealthDrawer / RejectModal / StaffNoteBar 4 件由 plan §3 复用矩阵直接列出，无需例外协议。
2. **DecisionCard 上移**为**例外协议下沉**，依据：
   - admin 子项目"2 处规则"较 CLAUDE.md "3 处规则"严格，covers 该场景；
   - 跨应用层（business `apps/server-next` ↔ shared `packages/admin-ui`）下沉天然受 Opus arch-reviewer 评审约束（单实例下沉成本 ≈ 跨应用层成本）；
   - DecisionCard 在 plan §6 M-SN-4 复用矩阵已隐含（决策卡 + 三栏布局 同列下沉）。
3. **协议外推**：今后跨应用层下沉 admin-ui 共享组件时，"2 处即下沉"作为 admin 子项目内部协议成立；其他子项目（前台 web-next / packages/player-core）仍维持 CLAUDE.md "3 处规则"。
4. **5 件 Props 契约**统一在 CHG-SN-4-04 任务卡内由 arch-reviewer (claude-opus-4-7) 评审；评审范围含 DecisionCard 例外审议。
5. **反向兜底（2026-05-02 CHG-SN-4-04 预审补充）**：DecisionCard 下沉后跟踪期 12 个月；若至 2027-05-02 仍维持 ≤ 2 处消费方（即未触达 CLAUDE.md "3 处规则"），则触发**收编回 admin 应用层**的迁移评估卡（任务卡新开），把 DecisionCard 退回 `apps/server-next/src/app/admin/` 业务层；本兜底防止"例外"长期占据共享层名额而无实质复用收益。跟踪期内每完成 1 个 admin milestone（M-SN-X） 须在 changelog 内记录 DecisionCard 当前消费方数量。

### 后果

- **正向**：admin 子项目复用速度提升，避免"等满 3 处"造成的重复实装；契约稳定性靠 Opus 评审保障。
- **风险**：admin-ui 包外开销提前累积；mitigated by Opus 评审 PASS 闸门 + visual baseline 守门。
- **不可逆性**：低；DecisionCard 上移后若发现 API 契约缺陷，CHG-SN-4-10 milestone 评级前可回滚（成本可控）。

### 关联

- **关联 plan**：M-SN-4 plan v1.4 §1 D-14 / §7 / §8.1
- **关联任务卡**：CHG-SN-4-03（本卡草拟）/ CHG-SN-4-04（落地 + 正式 PASS）
- **关联序列**：SEQ-20260501-01

---

## ADR-107: M-SN-4 apps/worker 部署归属 + 单实例约束

> 状态：正式（CHG-SN-4-03 草拟；CHG-SN-4-06 落地实装并正式生效；2026-05-02）
> 日期：2026-05-01
> 落地日期：2026-05-02
> 任务卡：CHG-SN-4-03 / CHG-SN-4-06 / SEQ-20260501-01
> 关联 plan：M-SN-4 plan v1.4 §1 D-16 + §4.0 / M-SN-4-06-worker plan v1.1

### 上下文

M-SN-4 引入 `SourceHealthWorker`（Level 1 探测 + Level 2 渲染验证 + 分辨率采集 + 视频级聚合），需要决定部署归属：(a) 内嵌 `apps/api`（cron 进程 + 共享路由）/ (b) `pg_cron` 数据库触发 / (c) 新建 `apps/worker` 独立 service。仓内 `apps/` 实测当前 4 个：`api / server / server-next / web-next`，无既有 worker app。同时需澄清单实例 vs 多实例对熔断状态、advisory lock 等的影响。

### 决策

1. **新建 `apps/worker` 独立 service**：理由 (a) Level 2 渲染验证 CPU/IO 重，与 apps/api 实时请求隔离更稳；(b) `docs/rules/logging-rules.md` "worker job" 段已规划相应路径；(c) 独立部署便于后续水平扩展。
2. **本期单实例运行**：熔断状态可存内存；advisory lock 视频级聚合并发够用；多实例水平扩展须把熔断 / 协调状态外移到 Redis 或 DB，列入后续优化（M-SN-6 性能门或独立卡）。
3. **目录结构**：`apps/worker/src/{jobs,lib,observability,config.ts,index.ts,types.ts}`；测试在根 `tests/unit/worker/`。
4. **DB 连接**：worker 在 `apps/worker/src/lib/db.ts` 自建轻量 `pg.Pool`（直接消费 `DATABASE_URL` 等 env 变量名与 apps/api 共享）；**禁止** import `apps/api` 内部任何文件，零跨 workspace 代码耦合。
5. **仓内同步清单（已落地）**：(a) 根 `package.json` workspaces 追加 `apps/worker` / (b) `package-lock.json` npm install 同步 / (c) CI 未配置（仓库无 `.github/workflows/`，README 已记录）/ (d) `TEMPLATES.md` worker 章节追加 / (e) 根 typecheck 脚本追加 `apps/worker`。
6. **可观测**：每个 job 入口生成 `requestId = 'worker:' + uuid()`，按 logging-rules.md 透传 child logger；6 项 metric 走 pino structured log（`metric` 字段 + `value` + labels；cutover 后接入 metrics backend）。

### 后果

- **正向**：worker 独立部署 = 故障隔离 + 资源限额可控；与 apps/api 实时请求互不干扰。
- **风险**：本期单实例 = 单点故障；mitigated by node-cron 内置 retry + Sentry 告警 + 容器重启策略。多实例升级路径已留协议接口（熔断状态外移）。
- **不可逆性**：低；如发现独立 service 维护成本过高可降级为 apps/api 内嵌（仅需路径重定向，业务代码不变）。

### 关联

- **关联 plan**：M-SN-4 plan v1.4 §1 D-16 / §4.0
- **关联任务卡**：CHG-SN-4-03（本卡草拟）/ CHG-SN-4-06（落地 + 正式 PASS）
- **关联规范**：`docs/rules/logging-rules.md`（worker job 段）

---

## ADR-108: M-SN-4 player_feedback 客户端实装位置（packages/player-core 事件埋点）

> 状态：草案（CHG-SN-4-03 草拟；CHG-SN-4-05/-06/前台播放器消费时由 arch-reviewer 评审 PASS 后正式生效）
> 日期：2026-05-01
> 任务卡：CHG-SN-4-03 / SEQ-20260501-01
> 关联 plan：M-SN-4 plan v1.4 §1 D-17 + §3.3 + §4.2

### 上下文

M-SN-4 D-12 决策"分辨率获取双轨制"：热门视频主动采集（manifest parse）+ 普通视频被动获取（前端播放回报）。后者需要前端在播放成功 / 失败时上报 resolution / errorCode / bufferingCount，对应端点 `POST /api/v1/feedback/playback`（plan §3.3）。需要决定客户端实装位置（packages/player-core 抽象层 vs PlayerShell 业务层 vs apps/web-next 应用层）+ 埋点时机 + PII 边界。

### 决策

1. **实装位置：`packages/player-core` 抽象层**新增 `feedback-reporter.ts` 事件埋点；shell 层 `PlayerShell` 注入实例。理由：埋点需对接播放器内部事件（onFirstFrame / onError / onBufferingEnd），与 player-core API 紧耦合；放抽象层避免每个消费方重复实装。
2. **埋点时机**：
   - `onFirstFrame` → 上报 `resolutionWidth/Height` + `success=true`
   - `onError` → 上报 `errorCode` + `success=false`
   - `onBufferingEnd` → 累计 `bufferingCount`（debounce 后随下一次事件上报）
3. **客户端去抖**：同一 `(videoId, sourceId)` 60s 内只上报最近一次最严重事件（success=false 优先于 success=true）；防止刷流冲量。
4. **PII 红线**：客户端**不上报** userId / IP；后端按 `apps/api` 路由侧 cookie session 解析 actor，存 `hash(IP)` 头 8 字节（与 ADR-109 admin_audit_log 同协议；logging-rules.md PII redact）。
5. **失败兜底**：feedback 上报失败 fire-and-forget，不影响播放体验；429 / 5xx 静默 retry（指数退避，上限 3 次）。

### 后果

- **正向**：分辨率被动采集覆盖 100% 播放视频，无需热门视频外的主动采集；同时获得线路健康反馈数据，触发 §4.1 Level 2 渲染验证。
- **风险**：高并发播放可能造成 feedback 端点流量压力；mitigated by `apps/api` 端 rate-limit（同一 (userId|IP, sourceId) 每分钟 1 次）+ Sentry 告警。
- **不可逆性**：低；埋点位置如需调整可平滑迁移到 shell 层。

### 关联

- **关联 plan**：M-SN-4 plan v1.4 §1 D-17 / §3.3 / §4.2
- **关联 ADR**：ADR-109（admin_audit_log；同 PII 协议）
- **关联任务卡**：CHG-SN-4-03（本卡草拟）/ CHG-SN-4-05（端点落地）/ CHG-SN-4-06（worker 消费触发 Level 2）
- **关联包**：`packages/player-core`（前台播放器抽象）/ apps/web-next（业务集成）

---

## ADR-109: M-SN-4 admin_audit_log schema 前置补建（M-SN-2 欠账）

> 状态：草案（CHG-SN-4-03 落地实装；arch-reviewer Opus 评审 PASS 后正式生效）
> 日期：2026-05-01
> 任务卡：CHG-SN-4-03 / SEQ-20260501-01 / Migration 052（v1.3 重排自原 060）
> 关联 plan：M-SN-4 plan v1.4 §1 D-18 + §2.1 + §3.0.5

### 上下文

M-SN-2 阶段 admin Shell 落地时未实装审计日志 schema（核实：仓内 `grep admin_audit_log` 0 命中）。M-SN-4 plan v1.0 §3 audit log 写入位点表暗含"M-SN-2 已就绪"假设不成立，需在 M-SN-4 任何写端点上线前前置补建。同时本 schema 须服务后续所有 admin milestones 的写操作审计（M-SN-5 / M-SN-6 / cutover），不允许 ad-hoc。

### 决策

1. **前置补建**：Migration **052** 创建 `admin_audit_log` 表（v1.3 重排自原 060；占用编号 052 = M-SN-4 序列首位）；部署顺序由 `scripts/migrate.ts` runner 字典序自动保证（plan v1.4 §2.10）。
2. **schema 字段**：`id BIGSERIAL` / `actor_id UUID` / `action_type TEXT` / `target_kind TEXT (CHECK 6 种)` / `target_id UUID` / `before_jsonb JSONB` / `after_jsonb JSONB` / `request_id TEXT` / `ip_hash TEXT` / `created_at TIMESTAMPTZ`。
3. **写入位点**：plan v1.4 §3.0.5 表为唯一真源，新增写端点必须先扩枚举再写实装。
4. **写入失败不阻塞主操作**：fire-and-forget + log warn + Sentry breadcrumb；request_id 来自 pino 中间件透传。
5. **PII 红线**：`ip_hash` = `hash(IP)` 头 8 字节（不存 IP 原值）；与 ADR-108 同协议。
6. **前台不入 audit**：`POST /api/v1/feedback/playback` 不写 `admin_audit_log`（属前台路由，非 admin 操作）。
7. **类型契约**：`AdminAuditLog` / `AdminAuditActionType` / `AdminAuditTargetKind` 在 `packages/types/src/admin-moderation.types.ts` 集中定义，所有消费方共享。

### 后果

- **正向**：M-SN-4 写端点上线即审计；M-SN-5 / M-SN-6 / cutover 复用同 schema 无需重新立项；运营合规 + 安全审查闭环。
- **风险**：写量随 admin 操作量线性增长；mitigated by 索引设计（按 actor / target / action 三轴），M-SN-6.5 性能门会复审；如需归档（cold storage）列入后续优化。
- **不可逆性**：高（已写入数据），但 schema 演进通过新字段 ADD COLUMN IF NOT EXISTS 兼容；不允许破坏性 ALTER（DROP COLUMN / 改类型）。

### 关联

- **关联 plan**：M-SN-4 plan v1.4 §1 D-18 / §2.9 / §3.0.5
- **关联 ADR**：ADR-108（player_feedback；同 PII 协议）
- **关联任务卡**：CHG-SN-4-03（本卡草拟 + 落地实装）/ CHG-SN-4-05（写入位点接线）/ CHG-SN-4-10（覆盖率验收）
- **关联序列**：SEQ-20260501-01
- **欠账登记**：M-SN-2 欠账由本 ADR 关闭

---

## ADR-110: ApiResponse 信封策略 + ErrorCode 真源归属

> 状态：accepted（CHG-SN-4-05 集成后复评；arch-reviewer claude-opus-4-7 评审 CONDITIONAL → 主循环采纳推荐方案 B 变体；2026-05-02）
> 日期：2026-05-02
> 任务卡：CHG-SN-4-05（DEBT-SN-4-05-C 由本 ADR 部分关闭，迁移实施转 CHG-SN-4-05a / -07 启动前置）
> 关联：`packages/types/src/api.types.ts` / `apps/api/src/lib/errors.ts` / `packages/types/src/admin-moderation.types.ts:321-327` / `docs/rules/api-rules.md` §响应格式规范 / `docs/architecture.md` §5.12

### 上下文

CHG-SN-4-05 任务卡范围声明 `packages/types/src/api/**`（信封 / errorCode）+ `apps/server-next/src/lib/api/**`（前端客户端层），实际未实装相关目录；6 新错误码定义在 `apps/api/src/lib/errors.ts` ERRORS 字典（13 码总，含 `STATE_CONFLICT` / `INVALID_TRANSITION` 等业务码）。复评时 arch-reviewer (claude-opus-4-7) 独立读取仓内文件，发现：

1. **`packages/types/src/api.types.ts` 早已存在** `ApiResponse<T>` / `ApiListResponse<T>` / `Pagination` / `ApiError` 泛型定义（line 8-32）+ `ErrorCode` 7 码 union（line 34-41，含 `'CONFLICT'` 等通用码），通过 `packages/types/src/index.ts:1` 全量 re-export。
2. **三源漂移已发生**：`api.types.ts` 7 码（含 `CONFLICT`）/ `errors.ts` ERRORS 13 码（含 `STATE_CONFLICT`）/ `admin-moderation.types.ts:321-327` `ModerationErrorCode` 6 码子集 — 互不兼容（`CONFLICT` ≠ `STATE_CONFLICT`，且 ERRORS 含 `INVALID_TRANSITION` 而 api.types.ts 不含）。
3. **`docs/architecture.md` §5.12 line 525 "不引入新 `ApiResponse<T>` 包装类型" 描述错误**：该类型自 server-next 立项前就已存在，本段为历史遗留误述（已由 CHG-SN-4-05 善后 commit 修订）。
4. `docs/rules/api-rules.md:98` "在 apps/api/src/lib/errors.ts 中统一定义" 与 CLAUDE.md 总纲"统一类型入口 `import type ... from '@/types'`" 冲突（前者为 v1 时期规范，后者为现行真源约定）。

### 决策

1. **信封策略（三形态，正式化既有规范）**：
   - 成功单资源 / 标量：`{ data: T }`（对应 `ApiResponse<T>`）
   - 成功列表：`{ data: T[], pagination: Pagination }`（对应 `ApiListResponse<T>`）
   - 错误：`{ error: { code: ErrorCode, message: string, status: number } }`（对应 `ApiError`）
   - 不引入 `Result<T, E>` 模式或额外包装层；服务端 `reply.send(plainObject)`，前端用 `ApiResponse<T> | ApiError` 联合类型解包。
2. **ErrorCode 真源归属**：唯一真源为 `packages/types/src/api-errors.ts`（待建）。该文件导出：
   - `ApiErrorBody` interface
   - `ERRORS` 常量字典（含全部 13 码 + 后续新增）
   - `ErrorCode = keyof typeof ERRORS` union（替代现 `api.types.ts:34-41` 的 7 码 union）
3. **AppError class 留 `apps/api/src/lib/errors.ts`**：class 不能跨 workspace 共享 instanceof 语义；apps/api 内 `import { ERRORS, ApiErrorBody, ErrorCode } from '@resovo/types'` 后定义 `AppError extends Error` + `isAppError` 守卫 + `makeError` 工具。
4. **server-next 消费**：`import type { ErrorCode, ApiResponse, ApiError } from '@resovo/types'`；按 feature 分布在 `apps/server-next/src/lib/<feature>/`（沿用现行模式，不强制建 `lib/api/` 统一目录）。
5. **ModerationErrorCode 退役**：`packages/types/src/admin-moderation.types.ts:321-327` 删除独立 union，改为 `import type { ErrorCode } from './api-errors'` + 必要时 `Pick<ErrorCode, ...>` 收窄。
6. **新增 errorCode 协议**：必须先扩 `packages/types/src/api-errors.ts` 的 `ERRORS` 字典；禁止在 apps 内重复定义 code 字符串字面量。

### 后果

- **正向**：errorCode 单一真源消除三源漂移；server-next 类型安全消费；与 CLAUDE.md "统一类型入口" 总纲对齐；不违反"信封三形态"既有契约。
- **风险**：迁移涉及 `apps/api/src/lib/errors.ts` ERRORS 字典移位 + ~11 处 import 修改 + `api.types.ts` 旧 ErrorCode 7 码 union 退役（必须保证测试零回归）；mitigated by 单独立卡 CHG-SN-4-05a 执行（含 typecheck + 全量 unit 验证）。
- **不可逆性**：低；ERRORS 字典可保留 `apps/api/src/lib/errors.ts` 的 re-export 兼容层渐进退役。

### 关联

- **关联 ADR**：ADR-103a（admin-ui Shell API 契约 / packages 共享真源原则同源）
- **关联任务卡**：CHG-SN-4-05（DEBT-SN-4-05-C 部分关闭）/ CHG-SN-4-05a（待立 / 方案 B 迁移实施）/ CHG-SN-4-07（前置依赖本 ADR）/ CHG-SN-4-08（同 -07）
- **关联规范**：`docs/rules/api-rules.md` §响应格式规范（line 63-107，line 98 待 CHG-SN-4-05a 同步修订）/ `docs/architecture.md` §5.12（line 525 已修订）
- **未关闭欠账**：DEBT-SN-4-05-C 中"迁移实施"部分由 CHG-SN-4-05a 关闭；本 ADR 仅关闭"决策待评审"部分

---

## ADR-111: 后台 token 颜色对齐设计稿（surfaces / border / fg / state pill）

> 状态：accepted（CHG-UI-04 完成 + arch-reviewer (claude-opus-4-7) PASS CONDITIONAL；CHG-UI-05/06 收口前可能补订增量）
> 日期：2026-05-03
> 任务卡：SEQ-20260503-01（CHG-UI-01..06）
> 关联：`docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`（方案真源）/ `docs/designs/backend_design_v2.1/styles/tokens.css`（设计真源）/ `packages/design-tokens/src/{primitives,semantic}/*.ts`（实现真源）

### 上下文

视频库（`/admin/videos`）页面截图与设计稿逐项比对识别 4 类 token 偏离：
1. surfaces 缺 row hover 中间档（dark `--bg2/--bg3` 之间梯度断档），dark 表格"整片黑"，light canvas 偏亮 +2.5%
2. `border.default` 与 `surface-elevated` 同值（两者都是 `gray.800`），DataTable 行分割线被淹没
3. dark `fg.default` 比设计 `--text` 亮 +7.5%，`fg.muted` 偏亮 +13%
4. state pill 用 dark/light `bg/fg` 实色对调（Material 风），与设计 alpha-soft 软底 + 鲜亮 base 文字双主题统一策略反转

详见方案文档 §1。

### 决策

落定（CHG-UI-04 PASS 后回填）：

1. **primitives 既有 ramp 校准 + 新增 1 档**（CHG-UI-02 + CHG-UI-02a）：
   - **新增 `gray.925`**（CHG-UI-02 引入，CHG-UI-02a 校准至最终值）
   - **dark 段五档校准**（CHG-UI-02a — 用户截图反馈触发的 OKLCH → sRGB 渲染对齐）：

     | step | 旧 OKLCH（CHG-UI-02 初稿） | 新 OKLCH（CHG-UI-02a 终态） | sRGB ≈ 设计 hex |
     |---|---|---|---|
     | 1000 | `oklch(6.5% .004 247)` | `oklch(8.0% .005 247)` | `#0b0d10` |
     | 950  | `oklch(11.2% .006 247)` | `oklch(12.0% .008 247)` | `#11141a` |
     | 925  | `oklch(13.5% .007 247)` | `oklch(15.0% .009 247)` | `#161a22` |
     | 900  | `oklch(16.5% .008 247)` | `oklch(18.0% .010 247)` | `#1d222c` |
     | 800  | `oklch(23.0% .010 247)` | `oklch(21.0% .011 247)` | `#252b37` |

   - light 段（gray.0-700）零改动；ramp 13 档 + 1 新增 = 14 档；hue 247 全 ramp 保持
   - 校准属"修复 OKLCH-sRGB 渲染映射误差"，不是 ramp 结构变更，符合 plan §2.1 不破例约束
2. **semantic 重映射**（CHG-UI-02 + CHG-UI-03）：
   - `bg.ts`：dark.surfaceRaised → `gray.925`；新增 `surfaceRow` 双主题（dark `gray.900` / light `gray.100`）填补 row hover/input 缺档；light.canvas → `gray.100`
   - `fg.ts`：dark.default `gray.50` → `gray.200`；dark.muted `gray.300` → `gray.400`
   - `border.ts`：dark.strong `gray.600` → `gray.700`；light.strong `gray.400` → `gray.300`
3. **state pill 双主题统一**（CHG-UI-04）：dark + light 共用同一 `sharedSlots`：
   - `bg = color-mix(in oklch, <colors.<status>.base> 14%, transparent)` 软底
   - `fg = colors.<status>.base` 鲜亮文字（同时是 Pill 的 dot 颜色）
   - `border = colors.<status>.base` 鲜亮边框（**保留给显式边框消费方**——KpiCard `is-warn/is-danger/is-ok` / DiffPanel 警告条 / InheritanceBadge / selection-action-bar；Pill 自身不消费 border，符合设计稿 borderless 意图）
   - 废除原 dark 暗底+亮文字 / light 浅底+深文字的实色 bg/fg 对调（Material 风）
4. **CSS 变量名只增不删**：保持向后兼容；新增槽位须有语义名（禁裸 hex / oklch 硬编码）。本期新增 `--bg-surface-row` + `--color-gray-925`，无任何变量改名 / 删除。
5. **DataTable 行级 CSS 显式声明**（CHG-UI-05 落地）：`tbody tr { border-bottom: 1px solid var(--border-default) }` + `tr:last-child { border-bottom: none }` + `tr:hover { background: var(--bg-surface-row) }`，消费方零硬编码。

### border 槽位决策（CHG-UI-04 arch-reviewer Y2 落地）

`--state-*-border` 保留 `colors.<status>.base` 而非 `'transparent'` 的依据 — 4 个消费方文件显式读取该 token：

- `packages/admin-ui/src/components/cell/kpi-card.tsx:115-117`
- `apps/server/src/components/admin/design-tokens/DiffPanel.tsx:88`
- `apps/server/src/components/admin/design-tokens/InheritanceBadge.tsx:18`
- `packages/admin-ui/src/components/data-table/selection-action-bar.tsx:83`

未来若上述 4 个消费方任一改为不消费 border，应回到 `transparent` 选项重审，避免决策依据被遗忘后无法 revert。

### 后果

- **正向**：
  - dark 模式 surfaces 五档梯度（canvas / surface / raised / row / elevated）齐备，行分割线 / row hover / 表格容器层级反差肉眼可见
  - light 模式 canvas 暗一档，与 surface 反差恢复
  - 文字层 fg.default / fg.muted 收回，去除"偏白发涩"观感
  - state pill dark + light 共享同一 alpha-soft 映射，与设计 `--*-soft` 系列等价；Pill 自身从 Material 风转为设计风（软底 + 鲜亮 dot + 鲜亮文字）
  - 25 项 alpha-soft 形态硬约束单测覆盖（`tests/unit/design-tokens/semantic.test.ts`）
- **风险**：
  - **light + warning 文字 contrast ≈ 2.3:1，不达 WCAG AA 4.5:1 正文**（O1 观察项）。这是 alpha-soft 双主题统一的固有代价；warning 不应承载关键正文信息（应配合 icon + 上下文 fg-default 文字）；CHG-UI-06 视觉走查时若审核台 `pending` / 警告条等场景出现"看不清"反馈，立 follow-up CHG-UI-04a 把 light warning fg 切到 `colors.warning.dark` (`oklch(52% .135 85)`)
  - selection-action-bar 删除按钮 (selection-action-bar.tsx:130) bg = state-error-fg：现 fg 是 base 鲜亮红，按钮底色更鲜艳；contrast ≈ 4.6:1 勉强达 AA（O2 观察项）
  - KpiCard `is-warn` light 模式 value 文本染浅黄 (`oklch(74%)`) 在白卡底配合 26px/700 大字阈值 3:1 边缘（O3 观察项）
- **不可逆性**：低。state.ts / fg.ts / bg.ts / border.ts / color.ts 单文件改动；变量名只增不删；git revert 即可回滚，消费方零调整。

### 后果增补（CHG-UI-02a / 05 / 05a / 06 增量）

- **CHG-UI-02a 校准**：dark 五档 OKLCH lightness 从初稿 6.5/11.2/13.5/16.5/23 校准至 8/12/15/18/21（用户截图反馈触发 OKLCH → sRGB 渲染对齐设计 hex；ramp 间距 8→12→15→18→21 单调连续）；本卡的"OKLCH-sRGB 映射误差"修复属"修复实装值"，不是 ramp 结构变更
- **CHG-UI-05 + 05a 消费方修正**：累计 21 项槽位错位 + DEBT-UI-BG-INSET 8 处闭环；DataTable 行级 `border-bottom` + `tr:last-child` reset + `tr:hover { background: var(--bg-surface-row) }` 显式落地；扫描 56 文件 / 130 处 `--bg-*` 全栈 var() 引用（audit report 已归档）
- **CHG-UI-06 序列评级**：arch-reviewer (claude-opus-4-7) 全序列评级 **B+ / PASS CONDITIONAL**（红线 0；黄线 Y1 已在本 ADR §决策第 1 条同步实装值；黄线 Y2「缺自动化 OKLCH → 设计 hex 对齐快照单测」记入下批序列；详见 `docs/audit_seq_20260503_01_20260503.md`）

### 后续序列触发清单

| 触发条件 | 后续序列 |
|---|---|
| 审核台 pending / 警告条出现"看不清"反馈 | CHG-UI-04a — light warning fg 切到 `colors.warning.dark` |
| 业务页 list-row / chip 类（StagingTabContent / TabHistory / TabDetail / TabDouban / TabLines 等）需统一 token 槽位 | 第三批：tag-chip 11 色饱和度回收 + list-row chip 统一槽位 |
| 行密度（row-h / row-h-compact）/ 封面尺寸 / 间距 token 与设计 `--s-*` 对齐 | 第二批：密度 / 间距 token 对齐 |
| hover / focus / active 等交互反馈缺失（导航栏 / topbar IconButton / 表头 / dropdown trigger / 表头按钮等） | 后续 UX 完整性序列（独立批次；用户 2026-05-03 显式登记） |
| primitive ramp 任何下次微调 | 必须先行落地"OKLCH → 设计 hex"对齐快照单测（Y2 / S2） |
| `gray-ramp-calibration.md` / build-css OKLCH→sRGB diff warn | S1 / S2 改进建议（下批附带） |

### 关联

- **关联 ADR**：ADR-102（设计 Token 三层收编 + 设计稿 v2.1 映射 — 本 ADR 是其增量修订）
- **关联任务卡**：
  - CHG-UI-01（占位）✅ / CHG-UI-02（surfaces & border）✅ / CHG-UI-02a（gray ramp 校准）✅ / CHG-UI-03（fg）✅ / CHG-UI-04（state pill；强制 opus + arch-reviewer）✅ PASS (CONDITIONAL) / CHG-UI-05（消费方 token 槽位全栈审计 + 修正 + 行分割线）✅ / CHG-UI-05a（DataTable 表头 + Trigger 槽位精修）✅ / CHG-UI-06（视觉走查 + 序列收口；arch-reviewer 全序列 B+ PASS CONDITIONAL）✅
- **关联序列**：SEQ-20260503-01
- **关联文档**：
  - `docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`（方案真源）
  - `docs/designs/backend_design_v2.1/state-pill-soft-walkthrough_20260503.md`（CHG-UI-04 走查清单）
  - `docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md`（CHG-UI-05/05a 审计报告）
  - `docs/audit_seq_20260503_01_20260503.md`（CHG-UI-06 arch-reviewer 全序列评级）
- **关联规范**：`docs/rules/ui-rules.md`（CSS 变量使用约束）/ CLAUDE.md §"绝对禁止"硬编码颜色值条款


## ADR-112: 后台交互反馈语义槽位 + admin Shell 全局规则注入器

> 状态：accepted（CHG-UX-01..07 全部完成 + arch-reviewer 待评级；评级 PASS 后正式收口）
> 日期：2026-05-03
> 任务卡：SEQ-20260504-01（CHG-UX-01..07）
> 关联：`docs/designs/backend_design_v2.1/ux-interactive-feedback-plan.md`（方案真源）

### 上下文

SEQ-20260503-01 收口阶段用户反馈："除了表格行，其他可点击按钮（导航栏 / topbar / 表头按钮）大多没有 hover 颜色变化"。颜色 token 序列只对齐静态语义；交互反馈（hover / focus / active）当时显式排除，登记为独立批次（ADR-111 §后续序列触发清单 O5）。本 ADR 落定本批次产出。

调研发现：

1. admin-ui 多处可点击元素（topbar IconButton / 全局搜索 / dropdown trigger / 表头按钮等）完全无 hover 反馈
2. 既有 hover 选择器分散在 admin-shell-styles / dt-styles / inline-row-actions-styles 三个文件，槽位写死、duration 写裸值
3. business 层 apps/server-next 有 ~112 处 onClick / 20 个文件含 button，inline style 五花八门
4. 无统一 focus-visible 兜底；零 a11y 焦点环

### 决策

#### 1. 新增 `interactive` 语义槽位（CHG-UX-01）

`packages/design-tokens/src/semantic/interactive.ts` 定义 6 槽位 × 2 主题：

| slot | 用途 | light | dark |
|---|---|---|---|
| hoverSoft | ghost/icon button hover 透明叠加 | `color-mix(currentColor 6%)` | `color-mix(currentColor 8%)` |
| hoverStrong | nav/menu/row hover 实色 | `var(--bg-surface-row)` | `var(--bg-surface-row)` |
| pressSoft | active mouse-down 反馈（≈ 2× hover） | 12% | 16% |
| focusRingColor | focus-visible 焦点环颜色 | `var(--border-focus)` | `var(--border-focus)` |
| focusRingWidth | 焦点环宽度 | `2px` | `2px` |
| focusRingOffset | 焦点环 offset | `2px` | `2px` |

设计要点：

- **currentColor 选择**：hoverSoft / pressSoft 用 `color-mix(in oklch, currentColor X%, transparent)` 跟随消费方 `color` — state-error fg 元素 hover 出红叠加，warning fg 元素 hover 出黄叠加，避免 "红色 danger 按钮 hover 出蓝色叠加" 的语义错配
- **dark 8% / light 6%**：补偿 dark 模式低对比度环境的视觉权重
- **var() 引用复用**：hoverStrong / focusRingColor 用 var() 引用上层槽位，主题切换自动跟随，避免值重复
- **与既有槽位边界**：accent.hover/active 是 brand 色 5 阶（color 层）；button.ts 是组件级状态包（5 状态 × 4 variant × 3 size，预留未消费）；interactive 是叠加层 — 三层语义独立无重复

#### 2. admin Shell 全局规则注入器（CHG-UX-01..07）

新建 `packages/admin-ui/src/shell/interaction-styles.tsx` 由 AdminShell 渲染。注入 7 类规则：

1. **icon**：`[data-interactive="icon"]:hover` → bg = hoverSoft（!important）；`:active` → pressSoft
2. **trigger**：`[data-interactive="trigger"]:hover` → border-color = strong（!important）
3. **nav**：`[data-interactive="nav"]:not([data-active="true"]):hover` → bg = hoverStrong（!important）；danger → admin-danger-soft
4. **chip**：`[data-interactive="chip"]` → 仅注入统一 transition；视觉由 dt-styles 既有规则提供
5. **focus-visible 全站兜底**：`[data-interactive] / [data-admin-shell] (button|role=button|role=tab|role=menuitem|a|input|select|textarea):focus-visible` → outline = focus-ring-color/width/offset
6. **catch-all**：admin Shell 内未标记 button / role=button / role=tab → `opacity: 0.85` hover（CHG-UX-07）
7. **prefers-reduced-motion**：所有上述 transition → none

#### 3. !important 决策（CHG-UX-05c）

React inline `style={{ background: ... }}` 的 CSS specificity 高于任何 stylesheet 规则；不用 !important 的话，stylesheet 的 :hover background 永远被消费方 inline default 覆盖。CHG-UX-05b 尝试删 inline transparent 让 stylesheet 接管失败（删后元素 fall back 到 user-agent default `buttonface` 浅灰），CHG-UX-05c 回滚并改用 !important。

仅在 hover/active 等 "瞬态" 规则上用 !important，default 规则不用：
- 语义：default 由消费方决定（消费方 inline 受尊重）
- 语义：hover 由设计系统决定（强制赢 inline）

#### 4. DataTable 表头专属交互（CHG-UX-05d）

表头是 sticky 元素 + 用户期望 "文字高亮（非灰化背景）+ 三点 hover 显隐"，不归 `data-interactive="icon"` 通用类。dt-styles 单独维护：

- `[role="columnheader"][data-th-interactive="true"]:hover` → `color: var(--fg-default) !important`（文字高亮，非背景）
- `[role="columnheader"] [data-th-menu-icon]` 默认 opacity 0；`:hover` 整列 / `[data-open="true"]` 时 opacity 1
- TH_STYLE.background 必须不透明（`var(--bg-surface-raised)`），sticky 滚动时不漏行

#### 5. 消费方契约

`data-interactive="icon|trigger|nav|chip"` 标记属性接入；admin-ui 导出 `InteractiveKind` union type；业务层禁写 `:hover` / `:focus` CSS。未标记元素由 catch-all 兜底（opacity 0.85）。

### 后果

- **正向**：
  - admin Shell 范围内所有可点击元素均有 hover 反馈（精准 + catch-all 双层）
  - focus-visible 全站兜底，a11y 焦点环统一（含 input/select/textarea）
  - hover/active/focus 时长与缓动统一走 motion token
  - 业务层零改动；新代码只需加 `data-interactive` 即获得精准反馈，不加也有兜底
  - dropdown / sidebar / topbar / DataTable 表头 / 表格 chip 5 大场景反馈一致
- **风险**：
  - **!important 维护成本**：interaction-styles + dt-styles 共 6 处 !important（hover/active background + trigger border + 表头 color）；如果未来引入 React 19+ 的 CSS-in-JS 新方案，需重新评估必要性
  - **catch-all opacity 0.85 反馈较弱**：用户体感 "虽然微弱但可接受"；如果某些高频场景反馈不足，可后续把对应元素改用 `data-interactive="icon"` 精准反馈
  - **TH_STYLE 不透明背景**：CHG-UI-05a 曾改 transparent 让表头继承容器底，本批 CHG-UX-05d 改回 surface-raised；视觉等效但语义不同（继承 → 显式声明），未来若 [data-table] 容器底色变化需同步
- **不可逆性**：低。interactive.ts / interaction-styles.tsx 单文件 + 6 处消费方 data-attr 标记；git revert 即可回滚

### 后续序列触发清单

| 触发条件 | 后续序列 |
|---|---|
| admin-ui Button 组件正式立项 | CHG-UX-EXT-A — button.ts / input.ts 5 状态契约真实接入 |
| admin 移动端体验立项 | CHG-UX-EXT-B — 移动端 touch 反馈（pressSoft 已埋点） |
| 用户体验度量后明确需求 | CHG-UX-EXT-C — spring/ripple 等高级动效 |
| 第二处需要 2px focus-ring-width 的消费方 | CHG-UX-EXT-D — focusRingWidth/Offset 归 size primitive（arch-reviewer S2） |
| catch-all opacity 反馈不足 | 提升为 `data-interactive="icon"` 精准反馈 |
| 业务侧首次出现 `<details>` / `<summary>` / `[contenteditable="true"]` | 复审 focus-ring 兜底覆盖（CHG-UX-06 arch-reviewer Y5） |
| catch-all opacity 与 disabled/loading 状态实测出现叠加放大模糊度 | 进一步收紧选择器或精细化兜底（CHG-UX-06 arch-reviewer Y2 后续观察项） |
| TH_STYLE.background inline 与 [data-table] 容器底显式同步成本累积 | 长期方案：迁 TH_STYLE 背景到 dt-styles 全局规则（CHG-UX-06 arch-reviewer Y4） |
| hover 后视觉对比度 a11y 自动化测试 | 下批序列：补 light + warning 等高风险组合的 hover 后 contrast 断言（CHG-UX-06 arch-reviewer S1） |
| Playwright e2e hover 视觉回归 | 触发型：CHG-UX-EXT-A button.ts 真实接入时建立视觉基线（CHG-UX-06 arch-reviewer S2） |

### 关联

- **关联 ADR**：ADR-111（后台 token 颜色对齐 — 本 ADR 是其后续 UX 完整性序列；ADR-111 §后续序列触发清单 O5 已落地）
- **关联任务卡**：CHG-UX-01..07（含 05b 回滚 / 05c / 05d / 05d hotfix；详见 SEQ-20260504-01）
- **关联序列**：SEQ-20260504-01
- **关联文档**：
  - `docs/designs/backend_design_v2.1/ux-interactive-feedback-plan.md`（方案真源）
  - `docs/audit_seq_20260504_01_20260503.md`（CHG-UX-06 arch-reviewer 全序列评级）
- **关联规范**：`docs/rules/ui-rules.md`（CSS 变量使用约束）/ CLAUDE.md §"绝对禁止" 硬编码颜色值条款


---

## ADR-113: admin UI 间距/封面/字号 token 沉淀 + cover 真根因修复 + 业务零裸值断言

> 状态：accepted（CHG-UX2-01..06 全部完成 + arch-reviewer A- / PASS）
> 日期：2026-05-05
> 任务卡：SEQ-20260505-01（CHG-UX2-01..06）
> 关联：`docs/designs/backend_design_v2.1/density-spacing-cover-alignment-plan.md`（方案真源）
>       `docs/archive/2026Q2/video-table-cell-compression-debug-20260504.md`（cover bug 调试归档）

### 上下文

CHG-UX-06 收口阶段用户反馈 4 项痛点 + 一审遗留闭环项：

1. 容器/组件间距 inline 裸值散落（业务层 99+ 处 fontSize 裸值 + 多处 padding 裸值）
2. 表格列头展开 + 列宽弹性化问题
3. 视频库列表封面过小 / 审核台封面"裁剪"显示异常
4. 封面 + 表格"左圆右直角"frame 圆角错位
5. （CHG-UX2-01 一审 Y1）typography 3xl/4xl 校准 deprecation 真空
6. （CHG-UX2-01 一审 S2-S5）选型指引 / ADR / 业务零消费断言 / spacing ADR 缺位

序列产出 5 实施卡（-01..05） + 1 收口卡（-06），新增 26 个 token 槽位 + 56 文件 305 处 fontSize 全量迁移 + 锁定并修复一个 Chrome layout 算法 bug。

### 决策

#### 1. typography 3xl / 4xl 数值校准（设计稿对齐）

- **校准**：`--font-size-3xl` 30px → 28px、`--font-size-4xl` 36px → 32px（向 reference design --fs-28 / --fs-32 对齐）
- **合法性**：grep 业务 0 处直接消费 `var(--font-size-3xl)` / `var(--font-size-4xl)` 断言成立
- **6 个 stable key 不动**（xs/sm/base/lg/xl/2xl）— 数值漂移会破窗
- **未来防御**（Y1 长期建议）：
  - 短期：typography.ts 加 `@deprecated-on-numeric-change` 注释，提示新增消费方需重新评估
  - 长期：触发型 follow-up — 当业务出现 ≥ 3 处 `var(--font-size-3xl)` 直接消费时，立项 stylelint 自定义规则禁止"裸 var consumption"或要求显式 alias

#### 2. admin-layout/spacing 5 类槽位选型指引

5 类槽位（共 10 var）+ section-gap：

| 槽位 | 真源值 | 用途 | 反例（不要这样用） |
|---|---|---|---|
| `page-padding-x/y` | 24/20 | 页面级最外层 padding（PAGE_STYLE） | 不用于 panel 内部 |
| `section-gap` | 12 | **段间间距（gap）**，不是 padding | 严禁当 panel padding 用 |
| `list-row-padding-x/y` | 12/10 | ModListRow / NotificationItem / 紧凑列表行 | 不用于 toolbar |
| `card-padding-x/y` | 18/14 | 卡片型容器（KpiCard / DecisionCard） | 不用 -y 当 horizontal padding；不用 4 边 shorthand |
| `toolbar-padding-x/y` | 12/10 | dt__toolbar / 详情区 toolbar | 不用于 component scope（如按钮） |
| `foot-padding-x/y` | 12/6 | dt__foot 等紧凑底栏 | — |

**选型决策树**：
1. 是页面最外层？→ page-padding
2. 是段与段之间间距（margin/gap 语义）？→ section-gap
3. 是列表行（紧凑高度 ≤ 32）？→ list-row-padding
4. 是中等密度卡片（独立 surface）？→ card-padding
5. 是 toolbar 类水平条？→ toolbar-padding
6. 是 foot 类紧凑底栏？→ foot-padding
7. 都不匹配 → **保留裸值 + 登记 EXT-F**（见 §5）

**component-internal padding 不归 layout 真源**（如 button / chip / pill 等）— 应在 `packages/design-tokens/src/components/*.ts` 真源管理。CHG-UX2-05 的"button padding 不应消费 toolbar token"的还原决策依此条。

#### 3. admin-layout/cover 槽位 + thumb.tsx SIZE_PX 双源同步约束

**真源**：`packages/design-tokens/src/admin-layout/cover.ts` 12 槽位（6 size × {w,h}）。

**双源存在的不可避免性**：
- HTML `<img width height>` attribute **不接受** CSS var()，必须 number
- thumb.tsx 内部维护 `SIZE_PX: Record<ThumbSize, {w, h}>` number 投影是必要的
- CSS layout 仍走 `var(--cover-*-w/h)` — 视觉真源不变

**同步守卫**（thumb.test.tsx 三层）：
- 每个 size：HTML attribute = SIZE_PX 数值（强）
- 每个 size：SIZE_PX 数值 = parseInt(adminCover[`cover-*-w/h`])（强）
- 双向集合相等：design-tokens 槽位数 / 命名 = SIZE_PX entries（CHG-UX2-06 Y4 加固，防"真源补 token 但 thumb 漏跟进"漂移）

**长期演进**（Y5 长期建议）：评估 design-tokens 暴露 numeric 视图（如 `adminCoverPx['poster-md'].w === 48`），让 admin-ui 直接消费消除双源 — 触发型 follow-up，不在本次范围。

#### 4. scrollbar-gutter 从 `*` 收紧到具体滚动容器（CHG-UX2-03f 真因修复）

**根因**：admin-shell-styles.tsx 原 `* { scrollbar-gutter: stable }` 被 Chrome 应用到 `<img>` replaced element，触发 layout 算法 bug，让 `<span> + <img w/h:100%>` 模式（即 admin-ui Thumb）的 img used width 退化（48 → ~37px），反向回吞 span used width。完整调试见归档文档。

**修法**：scrollbar-gutter 仅应用到真实滚动容器：`[data-admin-shell-main]`、`[data-table-scroll]`、`[data-drawer-body]`、`.cmdk__list`。

**已知豁免**（短内容场景）：admin Modal body / Popover 长列表 / 自定义 card body 内部 scroll —— 当前未触发抖动，未来出现长内容时按下条规则纳入。

**触发条件 / 升级规则**：
- **新增 admin 滚动容器** → 必须加入 admin-shell-styles.tsx scrollbar-gutter selector 清单，**或**带 `data-scrollport` hook attribute（待长期方案落地）
- **长期方案**（Y3 触发型）：admin-ui Modal/Popover/Drawer 共享层统一带 `data-scrollport`，selector 升级为 `[data-scrollport]` 一处统一
- 修改 admin-shell-styles.tsx scrollbar-gutter 块前必读本 ADR §4 + 调试归档

#### 5. 业务零裸值断言 + EXT-F 触发条件

**断言**：业务文件（apps/server-next/src/app/admin/**）padding / fontSize 必须使用 token var()，不写裸值 px。
- fontSize：CHG-UX2-02b 305 处全量迁移已达成 0 裸值
- padding：CHG-UX2-05 关键高频（toolbar/foot/list-row/list-row）已 token 化；剩余低频小尺寸（2/3/4/5/8 px）无匹配语义槽位，**保留为合理残余**

**EXT-F 触发条件**（spacing token 真源补缺）：
- **同语义裸值在 3+ 文件出现** → 必须新增 token 槽位，**不再走 EXT-F 排队**
- **同语义裸值在 1-2 文件** → 保留裸值 + 评估是否归入 EXT-F 候选
- 候选新槽位：
  - `panel-padding-x/y`（PendingCenter SECTION / RejectedTabContent actions section 等 panel-in-page 内 padding；区别于 section-gap 的 gap 语义）
  - `button-padding-x`（VideoListClient BATCH_BTN/HEAD_BTN 等；应在 components/button.ts 真源）
  - `card-padding` shorthand（4 边等值场景，需评估 card-padding-x=18 是否调整）

#### 6. CHG-UX2-05 弱语义还原决策记录

5 处还原（commit `507a28b6` + `7ceb6015`）作为后续审查参考：

| 位置 | 还原原因 | 长期目标 token | EXT-F 状态 |
|---|---|---|---|
| VideoListClient BATCH_BTN/HEAD_BTN `0 12px` | component scope ≠ layout token | `button-padding-x` (components/button.ts) | ✅ EXT-F 第 1 阶段已迁回 `0 var(--button-padding-x)`（admin-layout 临时占位，待 button.ts 落地后再迁） |
| PendingCenter SECTION `padding: 12` | section-gap 是 gap 语义不是 padding | `panel-padding-x/y` | ✅ EXT-F 第 1 阶段已迁回 `var(--panel-padding-y) var(--panel-padding-x)` |
| RejectedTabContent rejection info `10px 14px` | card-padding-y(14) 用作 x 方向混淆 | `panel-padding-x/y` 或新增 alert 槽位 | ⏳ EXT-F 第 2 阶段（10/14 数值不匹配现有 panel-padding=12，需 alert 专属槽位评估） |
| RejectedTabContent card body `padding: 14` | card-padding-y 当 4 边 shorthand 是滥用 | 评估 `card-padding` shorthand | ⏳ EXT-F 第 2 阶段（需评估 card-padding-x=18 是否调整为 14） |
| RejectedTabContent actions `padding: 12` | 同 PendingCenter SECTION | `panel-padding-x/y` | ✅ EXT-F 第 1 阶段已迁回 `var(--panel-padding-y) var(--panel-padding-x)` |

**EXT-F 第 1 阶段实施记录**（2026-05-05）：
- spacing.ts 新增 3 槽位：`panel-padding-x/y` (12/12) + `button-padding-x` (12 临时占位) → 11 → 14
- 4 处业务消费方迁回 token（PendingCenter SECTION / RejectedTabContent actions / VideoListClient BATCH + HEAD）
- admin-layout.test.ts +2 sanity test
- 其余 2 处（rejection info / card body）触发条件不达 → 推迟 EXT-F 第 2 阶段

### 备选方案（已评估）

- **方案 A：全部走 primitives space（4/8/12/16/20/24...）** — 拒绝。失去场景命名语义；admin 全局调整密度时无法批量改一处生效
- **方案 B：每个消费方完全自由 inline px** — 拒绝。无法防裸值漂移；设计稿调整不可批量同步
- **方案 C（采纳）**：admin-layout 层提供"场景命名槽位"（page / section / list-row / card / toolbar / foot），primitives space 仍是底层原子；component 内部 padding 单独归 components 真源

### 后续触发型 follow-up

| ID | 内容 | 触发 |
|---|---|---|
| CHG-UX2-EXT-A | PendingCenter 中央海报升 poster-xl 120×180 | 用户实测 80×120 仍嫌小 |
| CHG-UX2-EXT-B | 业务 inline padding 全量收敛剩余 ~70% | 视觉走查发现剩余裸值过多 |
| CHG-UX2-EXT-C | 行密度运行时切换（comfortable ↔ compact） | admin Settings 立项 |
| CHG-UX2-EXT-D | 审核台 < 1100px 响应式断点 RightPane 折叠 | 移动端体验立项 |
| CHG-UX2-EXT-E | admin-count-font-size deprecation 清理 | 本批所有消费方迁到 --font-size-xxs 后 |
| CHG-UX2-EXT-F | spacing token 真源补缺（panel-padding / button-padding 等） | 同语义裸值在 3+ 文件出现，或 -06 后视觉走查发现新缺口 |

### 验证

- ✅ typecheck / lint 全绿
- ✅ unit 全套 252f / 3206t（含 thumb.test.tsx 32 测试 / admin-layout +29 / primitives +4）
- ✅ tokens:validate / verify-token-references 全绿
- ✅ arch-reviewer (claude-opus-4-7) 全序列评级 **A- / PASS**（红线 0 / 黄线 6 已 ADR 内闭合 4 项 + 长期 follow-up 2 项）
- ✅ 浏览器实测视频库 + 内容审核所有封面恢复正常 48×72 完整渲染
- ✅ Chrome scrollbar-gutter Chrome layout bug 在隔离测试页 (`/cover-test` 已删) 用 9 个 case + 注入对照实验完整复现 + 修法验证

### 关联

- **关联 ADR**：ADR-111（后台 token 颜色对齐 — admin token 体系前序）/ ADR-112（后台交互反馈语义槽位 — 同期 SEQ-20260504-01 收口）
- **关联方案**：`docs/designs/backend_design_v2.1/density-spacing-cover-alignment-plan.md`（过程文档；ADR-113 是结论）
- **关联归档**：`docs/archive/2026Q2/video-table-cell-compression-debug-20260504.md`（cover bug 真因调试链路全记录 + §10 教训）
- **关联规范**：`docs/rules/ui-rules.md`（CSS 变量使用约束）/ `CLAUDE.md` §"绝对禁止" 硬编码颜色 / 越层调用 / 任何裸 fontSize/padding 条款

---

## ADR-114-NEGATED：line_key 一级建模 + 跨站合并 — 暂不实施（CHG-SN-5-PRE-02）

**决策日期**：2026-05-06
**决策卡**：CHG-SN-5-PRE-02（SEQ-20260506-02 / M-SN-5.5 启动准入门 B 段）
**决策模型**：claude-opus-4-7（主循环）+ arch-reviewer (claude-opus-4-7) 独立第二意见 PASS
**前置历史**：SEQ-20260502-01（用户 2026-05-02 拍板"方案 B"= 维持复合键 + 推迟 line_key 一级建模到 M-SN-5；DEBT-LINE-KEY-01）

### 议题

video_sources 线路聚合键设计：
- **方案 A（采纳）**：维持现状复合键 `(source_site_key, source_name)` — 跨站不合并；同名线路在不同源站独立展示
- **方案 B（否定）**：line_key 一级建模 + 跨站合并 UI（`Z01.X02 = Z02.X02` 等价合并为单一逻辑线路）

### 决策

**方案 A 采纳，方案 B 否定（暂不实施）**。

### 理由（架构 + 业务 + 工程三轴）

#### 业务轴

1. **业务触发条件未满足**：SEQ-20260502-01 "返回触发观察清单" 三项中（M-SN-5 合并/拆分页面规划落地 / 前台播放页线路切换需求定型 / DEBT-LINE-KEY-01 决策），前两项都是 line_key 一级建模的**实际业务前置条件**——它们提供"是否真的需要跨站合并"的证据。在它们触发之前作出方案 B 选择属于 premature optimization。
2. **用户实际使用反馈**：用户已在复合键模式下使用 ~4 天（2026-05-02 拍板至 2026-05-06）无明确"必须合并"反馈；密度问题可通过 line-dimension 聚合（GROUP BY source_name within each site）解决，无需 line_key 一级建模。

#### 架构轴

1. **三重 BLOCKER 触发**：方案 B 同时命中 plan §2.2 Non-Goals 第 3 条（DB schema 变更）+ §5.2 BLOCKER 第 3 条（修改现有 admin sources/merge 端点契约）+ §5.2 BLOCKER 第 4 条（DB schema 变更）— 是项目级三重风险类，所有其他单一架构决策无可比性。
2. **D-14 共享组件契约稳定**：CHG-SN-4-04 已下沉的 5 件组件（BarSignal / StaffNoteBar / LineHealthDrawer / RejectModal / DecisionCard，116 测试稳定）契约假设 site-scoped 线路身份。例如 `LineHealthDrawerProps.title` 设计为 `${siteName} . ${lineLabel}` — 方案 B 必须 rework 此契约，引发已稳定 admin-ui 通用层的连锁修订。
3. **现有端点契约稳定**：`apps/api` `/admin/sources` 等端点契约（CHG-SN-4-05 / -05a 后稳定）方案 A 零修订；方案 B 需重新评审整个 sources/merge 端点系列。
4. **跨站合并 UI 设计稿不齐**：reference §5 现有规范都是 source-level 视图，**没有跨站合并 UI 设计稿**。方案 B 实施会出现"schema 先于 UI"违反"接口设计先于实现"项目原则。

#### 工程轴

1. **工时不对称**：方案 A 零工时（保持现状）；方案 B ~1.5-2w（migration 双写期 + 数据回填 + 端点 schema 修订 + types 更新 + apps/server-next 消费方更新 + D-14 契约 rework + Opus 评审 ~2 轮）— 主循环初估 1w 偏低。
2. **不计入 milestone 工时但锁路径**：方案 B 工时不计入 M-SN-5.5（属 M-SN-5 主体或独立后续卡），实际推迟 M-SN-5 主体启动 ~1.5-2w，让总周期 20w → 21.5w+ 突破软上限 21w。
3. **可逆性不对称**：方案 A 不锁定路径，未来可独立 SEQ 重启（M-SN-5 后期或 M-SN-6）；方案 B 落地后双写期 + 旧字段保留 ≥1 milestone 周期是硬性回滚成本。

### 后果

#### 立即生效

1. M-SN-5.5 B 段决策落盘 = 方案 A；M-SN-5 视图卡按现有复合键 schema 实施
2. SEQ-20260502-01 "返回触发观察清单" 第 3 项（DEBT-LINE-KEY-01 决策）状态推进为"已决议（PRE-02, 2026-05-06）"，保留历史审计轨迹（不删除条目，标记决议状态）
3. plan §10.9 R-M-SN-5-01 风险条目状态：**风险消除**（方案 A 路径，BLOCKER §5.2 第 3/4 条 + Non-Goals 第 3 条均不触发）
4. plan §3 决策表（v2.6 line 104）"DEBT-LINE-KEY-01 决策路径"行状态更新："PRE-02 已决议方案 A（2026-05-06）"
5. plan §9 ADR 索引："ADR-114 候选" → "ADR-114-NEGATED（PRE-02 已否定 2026-05-06）"
6. ADR-114 实施路径不启动（不立 ADR-114 实施 SEQ；不立 migration 卡；不立端点 schema 修订卡；Non-Goals 第 3 条豁免 sign-off 不需要）

#### 重新评估触发条件（arch-reviewer Y-1：避免决策永久性遗忘）

以下任一条件触发，必须重新评估方案 B 必要性（可重新立 PRE-02-V2 决策卡或进入 ADR-114 起草卡路径）：

1. **用户明确反馈**：用户在 admin 审核台使用过程中明确反馈"跨站同名线路重复展示"是阻塞问题，提出明确的合并业务需求
2. **跨站重叠率阈值**：实测数据显示跨站同名线路（`source_name` 相同，`source_site_key` 不同）的重叠率超过 30%（即超过 30% 的视频含 2+ 源站的同名线路）— 触发自动重新评估
3. **M-SN-5 视图实施暴露结构限制**：M-SN-5 主体卡（`/admin/sources` 线路矩阵 + 视频库视图等）实施过程中暴露复合键聚合无法满足结构性需求
4. **M-SN-6 planning 自动重评**：M-SN-6 启动前 milestone planning 自动 re-evaluate 此 ADR 状态（约 8-12 周后），届时可基于积累数据/反馈做信息更充分的决策

### 与 plan 的同步

- §3 决策表（line 104）：DEBT-LINE-KEY-01 决策路径行更新"PRE-02 已决议方案 A"
- §6 M-SN-5.5 B 段（line 558-570）：决策结果落盘 = 方案 A；不触发 ADR-114 实施 / Non-Goals 豁免 / migration / 端点修订
- §9 ADR 索引（line 785）：ADR-114 状态 候选 → 否定（NEGATED, PRE-02, 2026-05-06）
- §10.9 R-M-SN-5-01（line 845-861）：风险状态 "未触发（已决议方案 A，BLOCKER §5.2 第 3/4 条 + Non-Goals 第 3 条均不触发）"

### 不在本 ADR 范围（明列防扩张）

- ❌ migration 文件（方案 A 零 migration；方案 B 否定不启动）
- ❌ 端点 schema 修订（方案 A 零端点变更；方案 B 否定不启动）
- ❌ ADR-114 实施内容（方案 B 否定，ADR-114 候选位置标 NEGATED 占位，无实施细节）
- ❌ apps/api / apps/server-next / packages/types 任何代码改动（PRE-02 是纯文档/governance 决策卡）

### 关联

- **关联 ADR**：ADR-110（ApiResponse 信封 / ErrorCode 真源 — 端点契约稳定性背景）/ ADR-103a（packages/admin-ui Shell 公开 API 契约协议 — D-14 下沉组件契约稳定性背景）
- **关联 plan**：§2.2 Non-Goals 第 3 条 / §5.2 BLOCKER 第 3/4 条 / §6 M-SN-5.5 B 段 / §9 ADR 索引 / §10.9 R-M-SN-5-01 / §4.5 ADR-端点先后协议
- **关联欠账**：DEBT-LINE-KEY-01（task-queue M-SN-4 欠账段，line 2394）状态推进为"已决议方案 A"
- **关联 SEQ**：SEQ-20260502-01（用户 2026-05-02 拍板临时方案 B = 复合键 + 推迟 line_key 一级建模；本 ADR 将临时决策转为正式裁决）

---

## ADR-115：admin-ui Popover 通用原语 API 契约（CHG-SN-5-PRE-03-F-ADR）

**决策日期**：2026-05-07
**决策卡**：CHG-SN-5-PRE-03-F-ADR（SEQ-20260506-02 / M-SN-5.5 启动准入门 C 段第 6/6 件原语 sub-ADR 前置）
**决策模型**：claude-opus-4-7（主循环）+ arch-reviewer (claude-opus-4-7) 强制独立评审
**触发**：PRE-03-F 强约束（task-queue line 3222）"API 契约复杂度（Portal / focus-trap / dismiss 协议）若超 Drawer，必须先升独立 sub-ADR + Opus arch-reviewer PASS 才能起实施卡"；2026-05-06 主循环复杂度评估明确 Popover 超 Drawer（placement 算法 / trigger-content 关联 / arrow / 11+ props vs Drawer 8 props），触发 sub-ADR 前置约束。

**状态**：✅ **采纳**（2026-05-07，3 轮 arch-reviewer Opus 评审通过：轮 1 B+ CONDITIONAL → 轮 2 B+ CONDITIONAL → 轮 3 **A- PASS**；3 红线 + 6 黄线全部修订；PRE-03-F 实施卡解锁条件满足）

**评审轨迹**：
- 轮 1（2026-05-07，agentId a8开头）：B+ CONDITIONAL；3 红线 R-1 useOverlay scroll lock 副作用 / R-2 trigger toggle 关闭 + cloneElement 注入机制 / R-3 z-index 980 被 Modal 遮挡；6 黄线
- 轮 2（agentId aa开头）：B+ CONDITIONAL；R-1/R-2 PASS；R-3 残留 §5 design-tokens 行 980 vs §2.5 1050 文档自矛盾；2 新黄线 NEW-Y-1（§5 关联组件段 modal=true 复用残留）+ NEW-Y-2（trigger forwardRef 约束未声明）
- 轮 3（agentId a3开头）：**A- PASS**；R-3 残留 + NEW-Y-1 + NEW-Y-2 全部清零；ADR 文档内自一致；2 项观察级 Y-OBS 不阻塞

### 1. Context

#### 1.1 设计真源
- reference §4.5 弹层规范：Drawer / Modal / Popover 同章节，但具体 Popover 视觉规范未单列详细，仅在 line 910 标"admin-ui Popover ⚠️ 缺失 | HiddenColumnsMenu 私有实现；无通用 Popover 原语"
- M-SN-6 原计划包含 Popover 原语 + filter popover；v2.6 plan 修订将 Popover 提前至 M-SN-5.5（PRE-03-F），消除 M-SN-6 的"先建 Popover 再做 filter popover 串行依赖"

#### 1.2 既有 inline popover 模式调研

| 实现 | 文件 | 行数 | 复杂度 | 共性 |
|---|---|---|---|---|
| AdminDropdown | `packages/admin-ui/src/components/dropdown/admin-dropdown.tsx` | 240 | 行操作菜单（items 数组）| portal `document.body` + position fixed + scroll/resize 重定位 + outside mousedown 关闭 + ESC + ArrowUp/Down/Enter 键盘导航 + role="menu" + items role="menuitem" |
| AdminSelect listbox（CHG-SN-5-PRE-03-D） | `packages/admin-ui/src/components/admin-select/admin-select.tsx` | 484 | 表单选择器（options + 单/多选 + 搜索 + 异步 + 键盘）| portal + position fixed + scroll/resize + outside mousedown + ESC/Tab + ARIA combobox/listbox + aria-activedescendant |
| HiddenColumnsMenu（私有） | DataTable 内部，未独立 export | — | 列设置 | private inline 实现，未对外可复用 |

**结论**：3 处已有 inline portal popover 模式，均**未使用通用 Popover 原语**——证实 reference §4.5 + line 910 的"⚠️ 缺失"诊断。Popover 通用原语下沉将让这 3 处后续 refactor 复用，消除"3 份相似 inline 代码"重复（违反 CLAUDE.md 价值排序 #2 边界与复用）。

#### 1.3 复杂度对比

| 维度 | Drawer | Popover |
|---|---|---|
| 文件行数 | 154 | 估 280-350 |
| Props 数量 | 8 | 估 11-13 |
| Placement 算法 | 无（固定 4 方位 left/right/top/bottom）| **必需**（auto-flip + shift 防 viewport overflow，6-12 placement 方位）|
| Trigger 关联模式 | 无 trigger 概念（open prop 受控）| **必需**（trigger 元素 + content 关联，引用 trigger.getBoundingClientRect()）|
| Arrow 子组件 | 无 | 可选 |
| Portal target | document.body 固定 | document.body 默认 + portalContainer prop 逃生口 |
| Focus-trap | modal=true（所有 Drawer 都是 modal）| 双模（modal=focus trap / non-modal=不抢焦点）|
| Dismiss 协议 | ESC + backdrop click | ESC + outside click + Tab out + programmatic |
| ARIA | role="dialog" aria-modal | aria-haspopup + aria-controls + aria-expanded（多种 popup type）|

Popover 在 7 个维度上严格超过 Drawer（Drawer 仅 placement 简单 / Trigger 无 / Arrow 无 / Focus-trap 单模 / Dismiss 简单 / ARIA 单 role）。**API 契约复杂度明确超 Drawer**，触发 PRE-03-F 强约束的 sub-ADR 前置要求。

### 2. Decision

#### 2.1 API 契约（PopoverProps）

```typescript
export type PopoverPlacement =
  | 'top' | 'top-start' | 'top-end'
  | 'bottom' | 'bottom-start' | 'bottom-end'
  | 'left' | 'left-start' | 'left-end'
  | 'right' | 'right-start' | 'right-end'

export interface PopoverProps {
  /**
   * 触发元素（必须是单个 React 元素，非 string 或 fragment），用于 Popover 通过
   * `React.cloneElement` 注入 `onClick`（toggle open）/ `onKeyDown`（Enter/Space 打开）/ `ref`
   * （getBoundingClientRect 定位）/ `aria-haspopup` / `aria-expanded` / `aria-controls`。
   * 消费方在 trigger 元素上自定义的 onClick 会被 Popover 包装（先调用消费方 onClick，
   * 再 toggle open；toggle 不依赖消费方实现）。
   *
   * **trigger 必须支持 ref forwarding**（arch-reviewer 复评 NEW-Y-2）：原生 HTML 元素
   * 如 `<button>` 天然支持；自定义函数组件须使用 `React.forwardRef` 暴露 ref。
   * v1 实施对 ref 注入失败做 `console.warn` 降级（开发模式提示消费方修复，
   * 生产模式定位回退到 trigger 父容器的 getBoundingClientRect 防 crash）。
   */
  readonly trigger: React.ReactElement
  /** 弹层内容（任意 ReactNode）*/
  readonly content: React.ReactNode
  /** 受控开关；省略 → 内部状态自管（非受控）*/
  readonly open?: boolean
  /** 受控变更回调（受控模式必传）；非受控也可监听 open 状态变化 */
  readonly onOpenChange?: (next: boolean) => void
  /** 默认非受控初始 open；默认 false */
  readonly defaultOpen?: boolean
  /** 弹层位置；默认 'bottom-start' */
  readonly placement?: PopoverPlacement
  /** trigger 到 content 距离（px）；默认 4 */
  readonly offset?: number
  /** modal 模式：focus-trap + 阻止背景滚动；默认 false（non-modal 不抢焦点）*/
  readonly modal?: boolean
  /** ESC 关闭；默认 true */
  readonly closeOnEscape?: boolean
  /** outside click 关闭；默认 true */
  readonly closeOnOutsideClick?: boolean
  /** Tab 离开 content 时关闭；默认 true */
  readonly closeOnTabOut?: boolean
  /** 自定义 portal 容器；默认 document.body */
  readonly portalContainer?: HTMLElement | null
  /** 显示箭头（指向 trigger）；默认 false */
  readonly arrow?: boolean
  /** ARIA aria-haspopup 类型；默认 'dialog'。可选 'menu' / 'listbox' / 'tree' / 'grid' */
  readonly hasPopup?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid'
  /** content a11y 标签 */
  readonly 'aria-label'?: string
  /** content 测试 id（trigger 自身 testid 由消费方在 trigger ReactNode 上挂）*/
  readonly 'data-testid'?: string
}
```

Props 共 13 个（>Drawer 8 个，符合复杂度评估）。

#### 2.2 Placement 算法策略

**采纳：手写最小 flip + shift，不引入 floating-ui 依赖**

理由：
1. **依赖白名单约束**：ADR-100 §依赖白名单将依赖分三类——预批（@dnd-kit/core/sortable）/ 候选（recharts、visx、reactflow、dagre、react-virtual、react-window）/ 严禁（admin 业务 design system、新状态管理、CSS-in-JS、ORM、GraphQL）。`floating-ui` 不在三类任何一个中 → 属"超出白名单即触发 BLOCKER"灰区，引入须独立 ADR 评审；项目级 BLOCKER 不应为单原语触发
2. **既有模式参考**：AdminDropdown / AdminSelect 已手写"trigger.getBoundingClientRect() + position:fixed"模式，证明手写可行
3. **算法范围**：Popover 需扩展为 12 placement 方位 + flip（首选 placement 出 viewport 时翻转到对侧）+ shift（沿轴向移动避免溢出）；**不**实现 size 调整 / virtual element / middleware 等 floating-ui 高级特性（YAGNI）
4. **回退路径**：未来若 placement 算法复杂度超出手写阈值（例如 nested popover 或 RTL 全面支持），可独立 ADR 重新评估引入 floating-ui

算法伪代码：
```typescript
function computePosition(triggerRect, contentSize, viewport, placement, offset):
  primary = computePrimary(triggerRect, contentSize, placement, offset)
  if primary fits in viewport: return primary
  flipped = flipPlacement(placement)  // bottom→top, right→left, etc.
  candidate = computePrimary(triggerRect, contentSize, flipped, offset)
  if candidate fits: return candidate
  return shift(primary, viewport)  // 沿轴向夹紧到 viewport 内
```

#### 2.3 Focus-trap 协议（双模）

| 模式 | 行为 | 应用场景 |
|---|---|---|
| `modal: false`（默认）| 不 trap focus；trigger 保持焦点，content 可被键盘穿越 | filter popover、column settings、tooltips |
| `modal: true` | content 内 focus trap（首个 tabbable 元素自动聚焦，Tab 循环不出 content）+ outside click 仍关闭；**不锁背景滚动** | 表单 popup、确认框、多步操作 popup |

**non-modal 默认**理由：
- AdminDropdown / AdminSelect 现有模式都是 non-modal（trigger 保持焦点）
- modal 行为更接近 Modal/Drawer 而非 Popover
- 滥用 modal=true 会破坏键盘流畅性

**arch-reviewer R-1 修订（2026-05-07）**：modal=true **不复用 `useOverlay` hook**——`useOverlay` 第 50-55 行硬编码 `document.body.style.overflow = 'hidden'` scroll lock 是给 Drawer/Modal 的全屏遮罩设计，对 Popover modal=true（局部弹层）属语义错位（用户在长列表打开 modal popover 时锁滚动会丢失位置）。改用独立 `usePopoverFocusTrap` hook（实施卡内创建），仅含：
- focus trap（首个 tabbable 自动聚焦 + Tab 循环约束在 content 内）
- ESC 监听（已由 closeOnEscape prop 暴露）
- 关闭时焦点回 trigger（`triggerRef.current?.focus()`）
- **零** `body.style.overflow` 副作用

non-modal 不调用任何 focus-trap hook。v1 实施 scope 标 modal 为 `@experimental`（见 §3.1），首版仅实现 focus trap 主路径，scroll-lock 永不引入。

#### 2.4 Dismiss 协议

**arch-reviewer R-2 修订（2026-05-07）**：原 4 类 dismiss 遗漏 trigger 再次 click toggle 关闭——这是 AdminDropdown / AdminSelect / HiddenColumnsMenu 三处既有 inline 模式都实现的核心行为。补第 5 类：

| 触发 | 默认 | prop | 行为 |
|---|---|---|---|
| trigger 再次 click | 开（始终）| N/A（Popover 内部经 `React.cloneElement` 注入 trigger 的 onClick 自动 toggle）| `open ? onOpenChange(false) : onOpenChange(true)`；消费方原 onClick 会被先调用再 toggle |
| ESC 键 | 开 | `closeOnEscape` | 全局 keydown 监听，关闭 + 焦点回 trigger |
| outside click | 开 | `closeOnOutsideClick` | document mousedown 监听，target 不在 trigger 或 content → 关闭 |
| Tab 离开 content | 开（modal=false 时）| `closeOnTabOut` | content blur + relatedTarget 不在 content 内 → 关闭 |
| programmatic | 始终可用 | `onOpenChange(false)` | 受控模式消费方主动关闭 |

#### 2.5 Z-index 层级

**arch-reviewer R-3 修订（2026-05-07）**：原方案 `--z-admin-popover: 980`（admin-dropdown 同层）在 Modal 内消费场景下被 Modal 1000 遮挡——"DOM 后置自然 stack" 仅在同 z-index + 同 stacking context 时生效；Modal 若使用 transform / will-change 会建立独立 stacking context，依赖隐性约束脆弱。

**采纳方案 C（调整 z-index 介于 Modal 与 Shell drawer 之间）**：

新增 design-tokens 槽位 `--z-admin-popover: 1050`（介于 Modal 1000 与 Shell drawer 1100 之间）；ADR-103a §4.3 4 级 z-index 不变量**追加第 5 级 1050**（保持序数关系不破坏既有不变量）：

- Shell toast 1300 > Shell cmdk 1200 > Shell drawer 1100 > **admin-popover 1050（新）** > Modal 1000 > admin-dropdown 980

理由：
- Popover 在 Modal 之上是合理需求（如 Modal 内表单的字段帮助 popover），1050 让 Popover 自然覆盖 Modal
- 1050 < Shell drawer 1100：Shell 抽屉（NotificationDrawer / TaskDrawer）打开时仍覆盖 Popover（Shell 操作优先级高于业务 Popover）
- admin-dropdown 980 不动（行操作菜单与 Modal 对话框不应同时出现，980 在 Modal 之下不会有冲突）

**与 ADR-103a 4 级不变量的兼容性声明**：本 ADR 视为 ADR-103a §4.3 的"5 级扩展"——在 Modal 1000 与 Shell drawer 1100 之间插入 admin-popover 1050；ADR-103a 原 4 级 stacking 序仍保持有效（Toast > CmdK > Shell drawer > Modal），仅新增"业务 popover 1050 ∈ (Modal, Shell drawer)"。如评审认为应单独修订 ADR-103a，可在本 ADR PASS 后另起 ADR-103a-rev 文档同步。

#### 2.6 Portal + portalContainer 逃生口

默认 `createPortal(content, document.body)`（避免 sidebar/topbar overflow:hidden 裁剪）；SSR 阶段 `typeof document === 'undefined'` 守卫不渲染。

**arch-reviewer Y-1 修订（2026-05-07）**：`portalContainer` prop 标 `@experimental`——项目内 grep 既有 portal 消费方（AdminDropdown / AdminSelect / HiddenColumnsMenu / UserMenu / CommandPalette / NotificationDrawer / TaskDrawer）全部直接 portal 到 `document.body`，零自定义 portal 容器需求。v1 实施保留 prop type 定义（向前兼容）但**实施卡不实现该路径**（直接传仍走 document.body 默认）；测试不覆盖此 prop。后续若出现 fullscreen iframe / Shadow DOM 真实需求，独立卡解锁实施。

#### 2.7 ARIA hasPopup 多类型语义边界

`hasPopup?: 'dialog' | 'menu' | 'listbox' | 'tree' | 'grid'`（默认 'dialog'）— 让 Popover 通用原语可承载 dropdown menu（hasPopup='menu'）/ filter（'dialog'）/ select-like（'listbox'）多种语义。

**arch-reviewer Y-4 修订（2026-05-07，明确语义边界）**：`hasPopup` **仅控制以下 ARIA 属性输出**，不影响内部键盘逻辑：

- trigger 元素 `aria-haspopup={hasPopup}` 自动注入
- content 容器 `role={hasPopup}` 自动注入（'dialog' / 'menu' / 'listbox' / 'tree' / 'grid'）

**Popover 原语不介入 content 内部子元素键盘行为**：
- hasPopup='menu' 时，菜单项 role="menuitem" + ArrowUp/Down 导航 + first-char 跳转 → 由消费方（AdminDropdown 等）自行实现
- hasPopup='listbox' 时，选项 role="option" + aria-selected + aria-activedescendant → 由消费方（AdminSelect 等）自行实现
- 这避免 Popover 原语膨胀为"通用弹层 + 键盘导航引擎"，与既有 AdminDropdown / AdminSelect 各自维护的键盘逻辑产生职责重叠

Popover 仅承担：portal / 定位 / 5 类 dismiss / ARIA 属性桩。键盘导航是"在 popup 内"的事，由 popup content 的消费方实现。

### 3. Consequences

#### 3.1 立即生效 + v1 实施 scope 收窄（arch-reviewer Y-6）

1. PRE-03-F 实施卡解锁条件：本 ADR-115 经 Opus arch-reviewer PASS（候选 → 采纳）
2. 实施卡范围：`packages/admin-ui/src/components/popover/*` + tests/unit + design-tokens 新增 `--z-admin-popover: 1050`
3. 实施卡**不**含：AdminDropdown / AdminSelect / HiddenColumnsMenu refactor（独立后续卡，复用 Popover 原语）
4. **v1 minimum viable subset**（arch-reviewer Y-6 / Y-1 / Y-2 收窄；type 定义保留向前兼容，实施卡不实现 / 不测试以下子集）：
   - **v1 实现** ✅：trigger / content / open / onOpenChange / defaultOpen / placement（6 基础方位 `'top' | 'bottom' | 'left' | 'right' | 'bottom-start' | 'bottom-end'` + flip）/ offset / closeOnEscape / closeOnOutsideClick / hasPopup（仅控制 aria-haspopup + role 属性，见 §2.7）/ aria-label / data-testid
   - **v1 标 `@experimental` 不实现** ⏸：modal / closeOnTabOut / portalContainer / arrow / placement 12 方位的 -start / -end 变体（剩余 8 个，仅保留 6 基础方位 + bottom-start/bottom-end 共 6 个）
   - 已知 3 处既有 inline 模式（AdminDropdown / AdminSelect / HiddenColumnsMenu）全部 non-modal + 无 arrow + portal 到 document.body + 不需 Tab out 关闭，v1 子集已覆盖
   - 后续按需求驱动以 ADR-115a 扩展（modal 表单 popup / arrow 提示性 popover / 12 方位精细对齐 / portalContainer Shadow DOM）
5. **行数估算修正**（arch-reviewer Y-3）：原估 280-350 行偏低；实际 placement 算法应作为独立文件 `packages/admin-ui/src/components/popover/compute-position.ts` 拆出（120-180 行），主组件 `popover.tsx`（200-280 行），共 320-460 行；CLAUDE.md 文件行数约束（500 行非声明性）保持，单文件不破。工时估算 PRE-03-F 实施卡 0.15-0.25w → 0.25-0.40w（含拆分单元）。

#### 3.2 后续后续触发

- M-SN-6 filter popover 等业务消费基于 Popover 原语
- 后续可独立卡 refactor AdminDropdown 内部使用 Popover 原语（消除 inline portal 重复）
- 同模式 refactor AdminSelect listbox 内部 portal 逻辑（CHG-SN-5-PRE-03-D 已稳定，refactor 留 M-SN-5 后期）

#### 3.3 Non-Goals（明列防扩张）

- ❌ floating-ui 依赖引入（触发 BLOCKER）
- ❌ size middleware（动态调整 popover 大小）
- ❌ nested popover focus 管理（可后续独立 ADR）
- ❌ RTL（right-to-left）布局支持（项目当前 zh-CN 单语言，不需要）
- ❌ AdminDropdown / AdminSelect 同 PR refactor（独立后续卡）
- ❌ **hover / focus trigger（tooltip 模式）**（arch-reviewer 新增）：Popover 仅支持 click / Enter / Space 触发；hover-trigger 是 Tooltip 独立原语职责（ARIA `role="tooltip"` + delay timing + 鼠标穿越），未来由独立 Tooltip ADR 承载
- ❌ **`closeOnTabOut` 与 `modal` 与 `arrow` 与 `portalContainer` 与 12 placement 完整集合**（v1 标 `@experimental`，见 §3.1 v1 minimum viable subset；按需求驱动以 ADR-115a 解锁）

#### 3.4 风险与回滚

- **风险 1**：手写 placement 算法在 viewport 边缘场景出 bug → 缓解：单测覆盖 6 v1 placement × 3 viewport 位置（near-top / near-bottom / near-edge）+ flip 触发条件
- **风险 2**：modal=true focus-trap（v1 不实施，标 @experimental） → 风险延后：v1 仅 non-modal，零 focus-trap 复杂度风险；实施 ADR-115a modal 时再独立 `usePopoverFocusTrap` hook（不复用 useOverlay 避免 scroll lock 副作用）
- **风险 3**：未来 nested popover 需求出现 → 回滚：可独立卡引入 floating-ui，本 ADR 不锁路径
- **风险 4（新）**：z-index 1050 与 ADR-103a 4 级不变量需要追加文档同步 → 缓解：本 ADR §2.5 已声明"5 级扩展"兼容性；如评审认为需正式修订 ADR-103a，PASS 后另起 ADR-103a-rev

### 4. 与现有约束的对齐

| 约束 | 状态 |
|---|---|
| ADR-100 依赖白名单（三类：预批 / 候选 / 严禁；floating-ui 不在三类任一即触发 BLOCKER）| 通过（手写实现，不引入 floating-ui） |
| ADR-103a packages/admin-ui 4 级 z-index 不变量 | **5 级扩展**（在 Modal 1000 与 Shell drawer 1100 间插入 admin-popover 1050）—— 4 级原序保持有效；详见 §2.5 与 §3.4 风险 4 |
| CLAUDE.md 绝对禁止"引入技术栈以外新依赖" | 通过（手写算法）|
| CLAUDE.md "同一 UI 模式 3 处以上必须提取" | 触发（AdminDropdown / AdminSelect / HiddenColumnsMenu 已 3 处 inline）→ 本 ADR 即提取动作 |
| CLAUDE.md "接口设计先于实现" | 通过（本 ADR 即接口契约设计，落盘后才能起实施卡）|
| CLAUDE.md "文件超 500 行非声明性须拆分" | 通过（实施卡 placement 算法独立 `compute-position.ts` 文件拆分，主组件 + 算法各 < 300 行）|
| reference §4.5 弹层规范 | 通过（Popover 与 Drawer/Modal 同章节统一管理）|
| SEQ-20260506-02 PRE-03-F 强约束 | 通过（sub-ADR 前置 + Opus arch-reviewer PASS 后才起实施卡）|
| 零业务视图消费 C 段强约束 | 通过（实施卡仅 packages/admin-ui + tests，零业务视图改动）|

### 5. 关联

- **关联 ADR**：ADR-100（依赖白名单）/ ADR-103a（packages/admin-ui 4 级 z-index 不变量 + 5 级扩展声明，见 §2.5）/ ADR-103（DataTable v2，HiddenColumnsMenu 私有实现来源）/ ADR-110（ApiResponse 信封 — 不涉及，列入仅做交叉索引）
- **关联组件**：AdminDropdown（240 行 inline portal pattern）/ AdminSelect（484 行 inline portal + listbox + 键盘）/ Drawer（154 行，Popover 复杂度对比基线）/ useOverlay hook（focus-trap + ESC 既有逻辑；**Popover modal=true 不复用，见 §2.3**——避开 useOverlay 的 body.style.overflow scroll lock 副作用）
- **关联 plan**：§6 M-SN-5.5 C 段 / §6 M-SN-6 删除 "Popover 原语 + 先于 filter popover" 行 / §9 ADR 索引 ADR-115 候选
- **关联 task-queue**：SEQ-20260506-02 子卡 13（PRE-03-F）状态 ⏸ 触发 sub-ADR 前置 → 本 ADR PASS 后转入 PRE-03-F 实施卡可起卡
- **关联 design-tokens**：新增 `--z-admin-popover: 1050` 槽位（实施卡内同 PR 落地；见 §2.5 z-index 5 级扩展决策）

---

## ADR-116：admin-ui Playwright visual harness 协议（CHG-SN-5-PRE-01-E-1）

**决策日期**：2026-05-12（候选）
**决策卡**：CHG-SN-5-PRE-01-E-1（SEQ-20260506-02 M-SN-5.5 A 段第 3 件 cutover-blocker / DEBT-SN-4-A 前置基础设施部分）
**决策模型**：claude-opus-4-7（主循环）+ arch-reviewer (claude-opus-4-7) 强制独立评审
**用户裁定路径**：C（dev-only `_visual/` 路由），2026-05-12 — 排除 A（新依赖触发 BLOCKER）/ B（状态难全覆盖）

**状态**：✅ **采纳**（2026-05-12，2 轮 arch-reviewer Opus 评审 → 第 2 轮 A- / PASS 无条件 / 9 项第 1 轮命中全部闭环 + Y-NEW-1 同 ADR 修）

**评审轨迹**：
- 轮 1（2026-05-12，agentId a36开头）：**C / CONDITIONAL** — 1 红线 + 3 黄线 + 4 OBS
  - R-1（致命）：`_visual/` 目录在 Next.js App Router 下不可路由（私有文件夹约定）
  - Y-1：admin-visual project 缺少 webServer 配置说明
  - Y-2：PRE-01-F moderation 整页截图前置数据协议过于模糊
  - Y-3：toHaveScreenshot 容差组合冲突（maxDiffPixelRatio 0.01 / threshold 0.2 语义不匹配）
  - Y-4：mock 数据持久化策略未说明
  - OBS-1：CI 接入触发条件未定义
  - OBS-2："零业务视图消费" 豁免边界需注意
  - OBS-3：与 /admin/dev/components 关系未厘清
  - OBS-4：@playwright/test 已在 devDeps 确认通过
- rev2 修订（2026-05-12，同日）：R-1 + Y-1/Y-2/Y-3/Y-4 + OBS-1/2/3 全部同 ADR 修；OBS-4 无需动作（确认通过）
- 轮 2（2026-05-12，agentId af6开头）：**A- / PASS 无条件** — 9 项命中全 PASS；新 1 黄线 Y-NEW-1（`.gitignore` 加 `tests/visual/.auth/` 是实施 deliverable gap 非设计缺陷）→ 同 ADR §3.1 deliverables 补足 → 评审建议直接采纳，无需第 3 轮
- followup（2026-05-12，Codex stop-time review 命中）：默认 e2e gate（`npx playwright test` / `npm test:e2e`）会拉 admin-visual 未入库 baseline → 全失败阻塞；rev3 §2.5 双重防御：(1) npm scripts 显式列 4 个 e2e projects + 新增 `test:visual` / `test:visual:update`；(2) playwright.config.ts admin-visual 条件 spread 由 `PLAYWRIGHT_VISUAL=1` env 触发 — 默认 0 admin-visual tests 注册
- followup-5（2026-05-12，用户实测命中）：middleware admin 鉴权对 dev/visual 仍生效 → Playwright 截图截到 /login 页；初版仅 dev 模式豁免
- followup-6（2026-05-12，Codex stop-time review 命中）：production guard contract 与 middleware behavior 不一致 — ADR 契约写"生产任何请求直接 404"，但 followup-5 仅 dev 豁免后，生产未登录用户被 middleware redirect /login（不是 404）；rev3 §2.3 改为生产+dev 统一豁免，layout/page NODE_ENV 守卫成为唯一守门
- followup-7（2026-05-12，Codex stop-time review 命中）：auth bypass predicate 比 visual route contract 更广 — `startsWith('/admin/dev/visual')` 会误匹配 `/admin/dev/visualxyz` 等任何以 "visual" 为前缀的同名业务路径，给未来"visual" 前缀业务路由自动豁免鉴权（真安全漏洞）；rev3 §2.3 改为严格路径段匹配 `pathname === '/admin/dev/visual' || pathname.startsWith('/admin/dev/visual/')`

### 1. Context

#### 1.1 真源
- M-SN-4-milestone-audit-2026-05-05.md §6（DEBT-SN-4-A：5 件下沉组件 ~12 张 Playwright `toHaveScreenshot()` baseline + 建立后必须回溯 M-SN-4 改动校验）
- task-queue.md line 1995（DEBT-SN-4-A：现仓库 `tests/visual/` 是**手动 PNG 归档无 Playwright host**，本期豁免 baseline 入库要求）
- task-queue.md line 2001（DEBT-SN-4-07-A：moderation 7 张占位 PNG 69-byte 单像素 placeholder）

#### 1.2 仓库现状
- `tests/visual/` 下有 ~30+ 真截图 PNG（dashboard / videos / video-edit-drawer / analytics），均为**手动归档**（设计稿对齐时 commit），非 Playwright 流程
- `tests/visual/moderation/` 7 张全部 69-byte 占位（DEBT-SN-4-07-A 登记）
- `grep toHaveScreenshot` 在仓库 **0 命中** — 零 Playwright visual harness 测试代码
- playwright.config.ts 现 4 project：admin-chromium / admin-next-chromium / web-chromium / web-mobile — 都是 e2e，无 visual project

#### 1.3 5 件下沉组件清单（task-queue line 1995）
| # | 组件 | 状态 / 变体 | 路径 |
|---|---|---|---|
| 1 | BarSignal | 5 状态（ok / partial / dead / pending / unknown） | packages/admin-ui/src/components/cell/bar-signal.tsx |
| 2 | StaffNoteBar | 2 变体（display / edit） | packages/admin-ui/src/components/feedback/staff-note-bar.tsx |
| 3 | LineHealthDrawer | 1 状态（events 时间线） | packages/admin-ui/src/components/feedback/line-health-drawer.tsx |
| 4 | RejectModal | 1 状态（标签单选 + 备注） | packages/admin-ui/src/components/feedback/reject-modal.tsx |
| 5 | DecisionCard | 3 状态（approve / reject / pending） | packages/admin-ui/src/components/cell/decision-card.tsx |

合计 ~12 个截图场景。

#### 1.4 路径选型对比（用户 2026-05-12 裁决路径 C）
| 路径 | 引入依赖 | 状态控制 | 工程量 | 选定 |
|---|---|---|---|---|
| A · `@playwright/experimental-ct-react` | 新依赖 / 触发 plan §5.2 BLOCKER 12 项 | 精细 | 中 | ❌ |
| B · server-next 真实页面 + seed/mock 数据 | 无 | 粗（Modal/Drawer 状态难触发） | 大 | ❌ |
| **C · server-next dev-only `_visual/` 路由 + props 注入** | **无** | **精细（URL query param）** | **小** | **✅ 用户裁定** |

### 2. Decision

#### 2.1 URL 结构（rev2，arch-reviewer R-1 修订）

```
/admin/dev/visual/<component-id>?<state-params>
```

- **路径选型修订（rev2）**：原方案 `/admin/_visual/` 错误使用 Next.js App Router 私有文件夹约定 — `_` 前缀目录会被框架从路由树中**完全排除**（不可路由）。改用 `admin/dev/visual/`，复用项目既有 `admin/dev/components/` 先例（CHG-SN-2-19 落地的 admin-ui 全量组件 demo 页），路径语义清晰且与 dev/ 路径协议对齐。
- 严格 dev-only：生产模式 `notFound()` 守卫（双层：layout 路由组守卫 + 单页 page.tsx 内 env check）
- `<component-id>` enum：`bar-signal` / `staff-note-bar` / `line-health-drawer` / `reject-modal` / `decision-card`
- query param 注入 props（每个组件独立 enum 表，见 §2.4 component-registry）
- 与 `/admin/dev/components`（CHG-SN-2-19）分工：
  - `dev/components`：交互功能验收（手动浏览，不做自动化截图）
  - `dev/visual`：Playwright visual regression baseline（自动化截图，状态精细控制）

#### 2.2 路由结构（rev2）

```
apps/server-next/src/app/admin/dev/visual/
├── layout.tsx                        # 路由组守卫（生产 notFound）+ 通用 demo 容器（白底 + 固定 viewport）
├── page.tsx                          # 索引页（列出 5 件组件链接）
├── [component]/
│   └── page.tsx                      # 动态分发：从 component-registry 取注册项渲染
└── _lib/                             # 私有文件夹（_前缀，不可路由，存放工具/mock 数据）
    ├── component-registry.ts         # 5 件组件展厅注册 + props 表（state enum + 默认 props）
    └── mock-data.ts                  # mock 数据：SourceHealthEvent[] / ReviewLabel[] / DecisionCardVideo（Y-4 修订）
```

#### 2.3 生产守卫策略（双层）

**第 1 层（layout.tsx）**：
```tsx
import { notFound } from 'next/navigation'

export default function VisualLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <div data-visual-demo style={{ background: 'var(--bg-surface)', padding: 24 }}>{children}</div>
}
```

**第 2 层（每个 [component]/page.tsx）**：
```tsx
if (process.env.NODE_ENV === 'production') notFound()
```

双层守卫：layout 守卫一次性拦截整个 `admin/dev/visual/*` 子树；单页守卫防御性兜底（若 layout 被绕过）。

**middleware 豁免协议（rev3 / followup-7）**：middleware 对 `/admin/dev/visual/*` **统一豁免** admin 鉴权（生产 + dev 相同行为），让 layout/page 的 NODE_ENV 守卫成为唯一守门。豁免谓词使用**严格路径段匹配**（不依赖宽松 startsWith）。

谓词实现：
```ts
const isDevVisualPath =
  pathname === '/admin/dev/visual' || pathname.startsWith('/admin/dev/visual/')
```

历史演进：
- rev2：middleware 鉴权写为"第 3 重防御"，但用户实测（followup-5）发现 Playwright 无登录 cookies 被 redirect /login，visual baseline 全跑空
- followup-5：仅 dev 模式豁免，生产仍走 admin 鉴权
- followup-6（Codex stop-time review）：生产未登录用户被 middleware redirect /login（不是 404），违反契约 → 改为生产+dev 统一豁免
- **followup-7（Codex stop-time review）**：`startsWith('/admin/dev/visual')` 会误匹配 `/admin/dev/visualxyz` 等任何以 "visual" 为前缀的同名业务路径（潜在安全漏洞），改为严格路径段匹配（exact + 带尾斜杠的 startsWith）

豁免边界（实测验收）：
| 路径 | 期望 | 验收 |
|---|---|---|
| `/admin/dev/visual` (exact) | 豁免（200）| ✓ |
| `/admin/dev/visual/bar-signal?state=ok` (子路径) | 豁免（200） | ✓ |
| `/admin/dev/visualxyz` (误匹配测试) | 不豁免（307 /login） | ✓ |
| `/admin/videos` (业务路由) | 不豁免（307 /login） | ✓ |

防御矩阵（rev3 最终）：
- **生产**：middleware 豁免 → 直接进入 layout `notFound()` 第一行 → **404**（契约：任何请求统一 404，无 redirect 中转）
- **dev**：middleware 豁免 → 进入 layout（NODE_ENV check 通过）→ demo 容器渲染（Playwright visual baseline 跑通）
- **业务路由（非 dev/visual）**：middleware admin 鉴权完全不变（dev 模式下登录态仍要求，生产模式 admin 鉴权由 middleware 兜底）

安全性保证（豁免后无业务数据泄露）：
- dev/visual 组件展厅是**纯 props 驱动** mock 数据（OBS-2 强约束："dev/visual 下的组件必须纯 props 驱动、零服务端数据依赖，不得调用 server actions / API / DB"）
- 生产 build 中 layout 第一行 `if (process.env.NODE_ENV === 'production') notFound()` 是编译时常量分支 → Webpack tree-shake 消除 demo 渲染路径
- 即使 middleware 豁免，生产 bundle 也不含组件代码，更不含业务数据

**OBS-2 强约束（rev2 补充）**：`admin/dev/visual/` 下的组件 **必须纯 props 驱动、零服务端数据依赖**（不得调用 server actions / API / DB）— 若未来需要带服务端逻辑的视觉验证，须独立 ADR 决议并隔离命名空间，避免模糊"测试基础设施 ≠ 业务视图"边界。

#### 2.4 component-registry 接口契约（rev2）

```typescript
// apps/server-next/src/app/admin/dev/visual/_lib/component-registry.ts

export interface VisualComponentEntry<TProps> {
  /** 组件 ID（URL 路径段） */
  readonly id: string
  /** 展示标题 */
  readonly title: string
  /** 状态枚举：query param → props mapping */
  readonly states: ReadonlyArray<{
    /** state slug（baseline 文件名后缀） */
    readonly slug: string
    /** 标题（索引页展示） */
    readonly label: string
    /** props 注入（每个 state 独立 props） */
    readonly props: TProps
  }>
  /** 渲染函数（接收 state.props 返回 JSX） */
  readonly render: (props: TProps) => React.ReactNode
}

export const REGISTRY: ReadonlyArray<VisualComponentEntry<unknown>> = [
  // 5 entries: bar-signal / staff-note-bar / line-health-drawer / reject-modal / decision-card
]
```

URL 解析：`/admin/dev/visual/bar-signal?state=ok` → 查 REGISTRY['bar-signal'].states[state='ok'].props → render。

**mock 数据持久化（Y-4 修订）**：复杂 mock（SourceHealthEvent[] / ReviewLabel[] / DecisionCardVideo Pick）必须放独立文件 `_lib/mock-data.ts`，registry 仅 import 引用 — 避免 registry 文件膨胀 / mock 与注册逻辑耦合。项目既有先例：`apps/server-next/src/app/admin/moderation/_client/mock-data.ts`。

#### 2.5 playwright.config.ts 配置（rev2 — Y-1 + Y-3 修订）

新增 project：
```typescript
{
  name: 'admin-visual',
  use: { ...devices['Desktop Chrome'], baseURL: ADMIN_NEXT_URL },
  testDir: './tests/visual',
  testMatch: '**/*.visual.spec.ts',
  expect: {
    // Y-3 修订：容差组合从 (0.01, 0.2) 调整为 (0.02, 0.1)
    // - maxDiffPixelRatio: 2% 像素差异容忍（vs 1% 太严易 flaky）
    // - threshold: 10% per-pixel 颜色差异容忍（vs 20% 过松会掩盖颜色 regression）
    // v1 经验初始值；PRE-01-E-2 真截图入库后根据实际 flaky 率调整
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, threshold: 0.1 },
  },
}
```

**Y-1 修订**：admin-visual project 的 dev server **由现有 webServer 条目覆盖**（`npm --workspace @resovo/server-next run dev`，端口 3003，playwright.config.ts line 59-64）— 无需新增 webServer。多 project 共用同一 webServer 是 Playwright 标准模式。

testDir 与 testMatch 隔离：`tests/visual/**/*.visual.spec.ts` 才被 admin-visual 跑；`tests/e2e/**/*.spec.ts` 不混入。

**默认 e2e gate 隔离双重防御（Codex stop-time review followup，2026-05-12）**：admin-visual project 在 baseline 未入库期间跑 `toHaveScreenshot()` 会全失败 — 若加入默认 projects 数组，`npx playwright test`（不带 `--project=`）或未列项的 `npm test:e2e` 会被 admin-visual 拖累阻塞。修订两层隔离：

1. **package.json npm scripts 显式列项**：
   - `test:e2e`: `playwright test --project=admin-chromium --project=admin-next-chromium --project=web-chromium --project=web-mobile`（4 个 e2e projects 显式，admin-visual 不在内）
   - `test:visual`: `PLAYWRIGHT_VISUAL=1 playwright test --project=admin-visual`
   - `test:visual:update`: `PLAYWRIGHT_VISUAL=1 playwright test --project=admin-visual --update-snapshots`
2. **playwright.config.ts env gate**：admin-visual 用 `...(process.env.PLAYWRIGHT_VISUAL === '1' ? [{...}] : [])` 条件 spread 加入 projects 数组 — 默认 env 不带时 admin-visual **完全不注册**，`npx playwright test` 拉到 0 admin-visual tests；只有 `npm run test:visual` 或 `PLAYWRIGHT_VISUAL=1 npx playwright test` 才会注册并选定。

**baseline 文件落位策略**：默认 Playwright 落在 `tests/visual/<feature>/<spec-name>.visual.spec.ts-snapshots/<test-name>-1-<browser>-<platform>.png`。本卡显式指定 `expect(...).toHaveScreenshot('<name>.png')` 控制文件名，baseline 路径形如 `tests/visual/admin-ui/bar-signal.visual.spec.ts-snapshots/bar-signal-ok-1-chromium-darwin.png`。这与现有 `tests/visual/dashboard/dashboard-full.png` 等手动归档目录（直接落顶层 PNG，无 `-snapshots/` 后缀）**并行不冲突** — Playwright 只读 `-snapshots/` 后缀目录，手动归档继续作为参考截图。

#### 2.6 visual.spec.ts 模板

```typescript
// tests/visual/admin-ui/bar-signal.visual.spec.ts
import { test, expect } from '@playwright/test'

const STATES = ['ok', 'partial', 'dead', 'pending', 'unknown'] as const

for (const state of STATES) {
  test(`bar-signal — ${state}`, async ({ page }) => {
    await page.goto(`/admin/dev/visual/bar-signal?state=${state}`)
    await page.waitForSelector('[data-bar-signal]')
    await expect(page.locator('[data-bar-signal]')).toHaveScreenshot(`bar-signal-${state}.png`)
  })
}
```

#### 2.7 PRE-01-F moderation 整页截图（rev2 — Y-2 修订补充前置数据协议）

PRE-01-F 的 7 张占位 PNG 真截图不通过 `dev/visual/` 路由，而是直接走 `/admin/moderation` 真实页面截图（与既有 `tests/visual/moderation/*.png` 手动归档对齐）。spec 模板需要包含完整的前置数据 + 交互操作链：

```typescript
// tests/visual/admin-moderation.visual.spec.ts
import { test, expect } from '@playwright/test'

// 前置：admin storageState（已登录的 cookies 快照）
// 由 tests/visual/.auth/admin.json 提供（首次跑前用户手动登录生成）
test.use({ storageState: 'tests/visual/.auth/admin.json' })

test('moderation — pending-list', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-list]')
  await expect(page).toHaveScreenshot('moderation-pending-list.png')
})

test('moderation — reject-modal', async ({ page }) => {
  await page.goto('/admin/moderation?tab=pending')
  await page.waitForSelector('[data-moderation-list]')
  // 点击行操作 → 打开拒绝 Modal
  await page.click('[data-reject-button]')
  await page.waitForSelector('[data-reject-modal]')
  await expect(page).toHaveScreenshot('moderation-reject-modal.png')
})
// 5 more: pending-detail / lines-panel / rejected / staging / line-health-drawer
```

**前置数据协议（Y-2 修订）**：

1. **登录态**：使用 Playwright `storageState`（admin 已登录的 cookies 快照），路径 `tests/visual/.auth/admin.json`（git ignore，每个开发者本地生成）
   - 首次生成：用户跑 `npx playwright codegen --save-storage tests/visual/.auth/admin.json http://localhost:3003/login` 手动登录一次
2. **seed 策略**：依赖 dev 环境的真实数据库（开发者手动创建测试视频 — pending / rejected / staging 各 1+ 条）；后续若需稳定 seed，独立卡 `scripts/seed-moderation-visual-test-data.ts`
3. **modal/drawer 截图**：spec 必须包含 `page.click('[data-trigger]')` + `waitForSelector('[data-modal-or-drawer]')` 才能截到打开状态（不能仅 `goto` + `screenshot`）
4. **fixture data 隔离**：visual spec 不应 mutate 数据库（只读截图）；如需写操作（如 reject），用 `test.afterEach` 清理或在测试数据集外操作

### 3. Consequences

#### 3.1 立即生效（PRE-01-E-1 实施卡内同 PR 落地）

1. ADR-116 PASS → harness 基础设施同 PR 落地：
   - `apps/server-next/src/app/admin/dev/visual/` 路由组（layout + 索引 + [component]/page + _lib/component-registry + _lib/mock-data）
   - `playwright.config.ts` 加 admin-visual project
   - `tests/visual/admin-ui/*.visual.spec.ts` 5 个骨架 + `tests/visual/admin-moderation.visual.spec.ts` 1 个骨架
2. **`.gitignore` 追加 `tests/visual/.auth/` 条目**（Y-NEW-1：防止 admin storageState cookies 快照意外入库）
3. 占位 baseline 保留不动（PRE-01-E-2 + PRE-01-F 由用户跑 `--update-snapshots` 替换）

#### 3.2 后续触发

- **PRE-01-E-2**（用户卡）：本地启 server-next dev → `npm run test:visual:update -- tests/visual/admin-ui` → 12 张 baseline 入库（5 件组件）
- **PRE-01-F**（用户卡）：复用 harness → `npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts` → 7 张 moderation 真截图（替换占位 PNG）

> **Playwright CLI 命令语法（rev3 followup-3，2026-05-12）**：
> 1. `--update-snapshots` 接收可选 mode 参数（`all` / `changed` / `missing` / `none`）；如不显式给 mode 值，紧随其后的 positional 参数会被误识为 mode → npm script 已用 `--update-snapshots=all` 显式 mode 形式
> 2. spec 过滤优先用 **positional 路径**（test file path / directory），明确无歧义
> 3. `--grep` 实测对 test ID（含路径）匹配，但 Playwright 文档说仅匹配 test title — 文档与实测灰区，避免使用
> 4. npm scripts 已配齐 `test:visual` / `test:visual:update`，env gate `PLAYWRIGHT_VISUAL=1` 自动带
- **未来**：admin-ui 新增下沉组件时同模式扩展 component-registry + 加 visual.spec.ts spec
- **回溯校验**（DEBT-SN-4-A Y4）：baseline 入库后，对 M-SN-4 期 5 件组件改动跑一次 visual diff，确认无视觉回归

#### 3.3 Non-Goals（明列防扩张）

- ❌ 引入 `@playwright/experimental-ct-react`（路径 A 排除）
- ❌ 引入 Storybook（项目级 BLOCKER 触发 — 新依赖体量大）
- ❌ 引入 vite-runtime（同上）
- ❌ 视觉对比 ML / AI 模型（YAGNI）
- ❌ 跨浏览器 baseline（v1 仅 Desktop Chrome；Firefox/Safari 留 future）
- ❌ 移动端 viewport baseline（admin 是 desktop-only 应用，无移动端需求）
- ❌ `dev/visual/` 路由暴露给生产 / staging（生产 notFound 双层守卫，仅 dev 可访问）

#### 3.4 风险与回滚

- **风险 1**：dev-only 路由生产泄露 → 缓解：(a) layout + 单页双层 `process.env.NODE_ENV === 'production'` notFound 守卫；(b) middleware 现有 admin 鉴权对 dev/visual 仍生效（无 token / user role 直接 redirect /login）；(c) Next.js build 期 `process.env.NODE_ENV === 'production'` 是常量 — Webpack tree-shake 会消除 dev-only 渲染路径，生产 bundle 不含组件代码；(d) ESLint 规则后续可加（如发现泄露案例）
- **风险 2**：component-registry props 表与组件 Props 接口漂移 → 缓解：registry 内 `as const` + 严格 TypeScript 类型推断；组件 Props 变更时 typecheck 立即报错
- **风险 3**：Playwright Chrome 版本变化导致截图 sub-pixel 差异 → 缓解：`toHaveScreenshot { maxDiffPixelRatio: 0.02, threshold: 0.1 }`（rev2 调整后的容差，Y-3 修订）；CI 锁 Playwright 版本（package-lock 已锁）
- **风险 4（rev2 + OBS-1 修订）**：跨平台截图差异（macOS dev 跑出的 baseline 与 Linux CI 比 → 不一致）→ 缓解：v1 baseline 由开发者本地（macOS）生成，CI 暂不跑 visual project（package.json npm scripts 不含 admin-visual project）；**CI 接入 future 触发条件**：(1) CI runner 上重新 `--update-snapshots` 生成 Linux baseline（与 macOS baseline 共存，按 platform 后缀区分；Playwright 默认 `<test>-1-<browser>-<platform>.png` 已含 platform 段），或 (2) Playwright 配置 `snapshotPathTemplate` 加入 `{platform}` 显式段。CI 接入前必须先确认 baseline 双平台覆盖；否则 admin-visual project 仅本地开发者运行。
- **回滚**：dev-only 路由可独立删除（不影响业务路由）；playwright.config.ts admin-visual project 可禁用（其它 project 不受影响）

### 4. 与现有约束的对齐

| 约束 | 状态 |
|---|---|
| ADR-100 依赖白名单 | ✅ 通过（无新依赖；用既有 @playwright/test 已在 devDeps）|
| ADR-103a packages/admin-ui Shell 公开 API | ✅ 通过（仅消费 admin-ui 组件展示，不修改契约） |
| CLAUDE.md "引入技术栈以外的新依赖" 禁止 | ✅ 通过 |
| CLAUDE.md "不得跨层调用" | ✅ 通过（component-registry 在 server-next 应用层消费 admin-ui） |
| CLAUDE.md "接口设计先于实现" | ✅ 通过（本 ADR 即接口设计，PASS 后才起实施） |
| CLAUDE.md "硬编码颜色" 禁止 | ✅ 通过（demo 容器用 var(--bg-surface)） |
| 演练前置（ADR-101 cutover 协议） | ✅ 对齐（visual baseline 是 cutover 前 visual regression 守门，与 cookie 演练同性质 cutover-blocker） |
| Risk-PRE-01-A-1（SameSite=Strict）| 无关（dev/visual 路由 dev-only，不涉及生产 cookie） |
| 零业务视图消费（C 段历史强约束）| **本卡范围允许**（路径 C 决议明确 dev-only 视图 ≠ 业务视图，与 C 段原 "零业务视图消费" 约束语义不冲突 — 业务视图指 admin 主路由，dev/visual 是测试基础设施；rev2 OBS-2 补强约束 "组件必须纯 props 驱动、零服务端数据依赖"）|
| Next.js App Router 路由约定 | ✅ 通过（rev2 R-1 修订：从 `_visual/`（不可路由的私有文件夹）改为 `dev/visual/`，复用 admin/dev/components 先例） |

### 5. 关联

- **关联 ADR**：ADR-100（依赖白名单）/ ADR-101（cutover 协议；visual baseline 是 cutover 前 regression 守门）/ ADR-103a（admin-ui Shell 公开 API；本 ADR 消费方）/ ADR-115（Popover 通用原语；同 sub-ADR 模式参照）
- **关联组件**：BarSignal / StaffNoteBar / LineHealthDrawer / RejectModal / DecisionCard（5 件下沉组件展厅注册）
- **关联 plan**：§6 M-SN-5.5 A 段第 3 件 cutover-blocker / §9 ADR 索引追加 ADR-116
- **关联 task-queue**：SEQ-20260506-02 子卡 PRE-01-E（拆分为 -E-1 基础设施 + -E-2 真截图）/ PRE-01-F（moderation 7 张占位 PNG 替换）
- **关联 audit**：M-SN-4-milestone-audit-2026-05-05.md §6 DEBT-SN-4-A 触发条件（建立 Playwright visual harness 基础设施 + 跑 ~12 张组件状态 baseline）

---

## ADR-104：home_modules admin API 协议（CHG-SN-5-04）

- **日期**：2026-05-12
- **状态**：**Accepted**（arch-reviewer Opus 第 2 轮 PASS 无条件 — 第 1 轮 CONDITIONAL 1 红线 R1 + 3 黄线 Y1/Y2/Y3 + 3 advisory A1/A2/A3 全部修订到位）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) × 2 轮
- **关联**：ADR-052（home_modules schema，Accepted）/ ADR-046（多品牌 brand_scope 协议）/ ADR-110（ApiResponse 信封 + ErrorCode 真源）/ CHG-SN-4-05（AuditLogService fire-and-forget 模式）/ plan §4.5（ADR-端点先后协议）
- **对应交付**：SEQ-20260512-02 Phase B（CHG-SN-5-04 起草 → CHG-SN-5-05/-06 端点实施 → CHG-SN-5-07 `/admin/home` 视图）
- **触发**：plan §6 M-SN-5 推荐 3（首页运营位编辑器）+ §4.5 "ADR-104/105 必须先于对应端点首个任务卡完成 Opus PASS；同 ADR 下多端点复用评审；不允许端点 PR 与 ADR 同卡"

### 背景

home_modules 表（migration 050 + ADR-052）+ DB 查询层（`apps/api/src/db/queries/home-modules.ts` 8 函数：listActive / listAdmin / findById / create / update / delete / reorder / listByContentRef）已就绪；公开端点 `apps/api/src/routes/home.ts` 提供前台 `GET /home/modules`（带 brand 协议过滤）+ `GET /home/top10`。**当前缺失**：admin 命名空间下的运营位编辑端点集（CRUD + reorder + publish toggle），导致 `/admin/home` 视图无端点支撑。

plan §4.5 ADR-端点先后协议硬约束：admin API 协议须先 ADR + Opus PASS，再起 -05/-06 端点实施卡。本 ADR 锁定 6 端点契约 + 鉴权 + 错误码 + audit log 扩枚举 + 缓存协议 + 验证策略 + publish toggle 决策，使端点实施卡（CHG-SN-5-05/-06）按本协议直接落地，零设计自由度。

### 决策要点

1. **6 端点 + admin 命名空间**：`/admin/home-modules` 资源前缀（hyphen 形式与既有 admin/crawler-sites / admin/video-sources 等路由一致）；HTTP 方法语义化（GET 列表 / POST 创建 / PATCH 部分更新 / DELETE 硬删除 / POST 子动作 reorder + publish-toggle）；6 端点全部走 `preHandler: [fastify.authenticate, fastify.requireRole(['admin'])]`（**admin only**，与既有 banners / crawler-sites / siteConfig / analytics 同类运营位编辑路由 grep 验证一致；moderator 不放权 — 投稿/视频审核不等同于首页运营位编辑权限）；草稿态 `enabled=false` 与发布态 `enabled=true` 鉴权同级（DISCUSS-6 此处闭合：plan §4.5 末段 "草稿/发布双态等鉴权粒度" 决议为同级 admin only）。
2. **publish toggle 选独立端点而非 PATCH `{ enabled }`** + **UpdateSchema 显式禁止 enabled 字段**：详见"备选方案 A"；独立 `POST /admin/home-modules/:id/publish-toggle` 强语义 + audit log actionType 更明确 + 显式传 enabled 防 toggle 并发竞态。**UpdateSchema 必须 `.omit({ enabled: true })`**（从协议层禁止 PATCH 修 enabled），从根本消除"双路径模糊"风险（Y2 闭合：协议层单一路径 → admin UI 与 audit log actionType 一对一映射）。
3. **响应包络对齐 ADR-110**：列表 `{ data: HomeModule[], total, page, limit }`；单条 `{ data: HomeModule }`；reorder `{ data: { updated: number } }`；publish-toggle `{ data: HomeModule }`（含 enabled 新值便于前端乐观更新）；DELETE 返回 204 No Content。
4. **错误码全部复用 ADR-110 既有 14 码，零新增**：VALIDATION_ERROR 422 / NOT_FOUND 404 / STATE_CONFLICT 409（DB CHECK 违反兜底）/ UNAUTHORIZED 401 / FORBIDDEN 403。message 字段携带具体约束名以表达细节，避免 ErrorCode 真源扩张。
5. **audit log 扩枚举**：`AdminAuditActionType` 增 5 项（home_module.create / update / delete / reorder / publish_toggle）；`AdminAuditTargetKind` 增 1 项（home_module）。沿用 CHG-SN-4-05 AuditLogService fire-and-forget 模式（写失败 log warn 不阻塞主操作）。审计载荷：beforeJsonb / afterJsonb 存 HomeModule 完整快照（reorder 批量动作存 ordering 数组前后对比）。
6. **缓存协议首版不引入**：grep 确证 `apps/api/src/routes/home.ts` 公开 `/home/modules` 零 Redis 缓存（直接 DB 查询，依赖 home_modules_slot_brand_idx 部分索引覆盖前台主路径）；首版 admin 端点也不引入缓存。**未来触发条件**（任一命中即起 PRE-CACHE-HOME 卡）：(a) 公开 `/home/modules` p95 > 100ms 持续 1 周；(b) 写读比 < 1:100；(c) DB CPU 因 home_modules 单端点占比 > 30%。
7. **验证策略双层**：(a) Service 层 zod 预校验覆盖所有可恢复违例（brand_scope 互斥 / 时间窗 start < end / slot × contentRefType 兼容性），抛 VALIDATION_ERROR 422 含字段名；(b) DB CHECK 兜底（ADR-052 5 约束）抛 STATE_CONFLICT 409 仅在并发竞争或迁移漂移时触发（罕见路径）。
8. **reorder 事务性约束**：复用既有 `queries/home-modules.ts:249-274` `reorderHomeModules` BEGIN/COMMIT/ROLLBACK 实现；端点不引入额外事务边界；items 中不存在的 id 静默忽略（已有行为），返回实际更新行数。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/home-modules` | 列表（含禁用 + 过期） | Query: `slot?` / `brandScope?` / `brandSlug?` / `enabled?` / `page?=1` / `limit?=20` | 200 `{ data: HomeModule[], total, page, limit }` | 422 VALIDATION_ERROR |
| 2 | POST | `/admin/home-modules` | 创建 | Body: `CreateHomeModuleInput` | 201 `{ data: HomeModule }` | 422 VALIDATION_ERROR / 409 STATE_CONFLICT |
| 3 | PATCH | `/admin/home-modules/:id` | 部分更新 | Body: `UpdateHomeModuleInput`（至少一字段） | 200 `{ data: HomeModule }` | 404 NOT_FOUND / 422 / 409 |
| 4 | DELETE | `/admin/home-modules/:id` | 硬删除 | — | 204 No Content | 404 NOT_FOUND |
| 5 | POST | `/admin/home-modules/reorder` | 批量更新 ordering | Body: `{ items: ReorderHomeModuleItem[] }`（≥1，≤200） | 200 `{ data: { updated: number } }` | 422 VALIDATION_ERROR |
| 6 | POST | `/admin/home-modules/:id/publish-toggle` | 切换 enabled | Body: `{ enabled: boolean }`（显式传值，禁止 toggle 隐式） | 200 `{ data: HomeModule }` | 404 NOT_FOUND / 422 |

**zod request schema（Service 层 + Route 层共享，端点实施卡 -05/-06 落地）**：

> **R1 修订（arch-reviewer 第 1 轮）**：抽出 `CreateBase` 纯 ZodObject + `applyBusinessRules` helper，避免 `ZodEffects.partial()` zod API 误用 + 防止 UpdateSchema 丢失 refine 规则（4 条业务规则必须同时适用 Create + Update）。

```ts
const SlotEnum = z.enum(['banner', 'featured', 'top10', 'type_shortcuts'])
const BrandScopeEnum = z.enum(['all-brands', 'brand-specific'])
const ContentRefTypeEnum = z.enum(['video', 'external_url', 'custom_html', 'video_type'])

const ListSchema = z.object({
  slot: SlotEnum.optional(),
  brandScope: BrandScopeEnum.optional(),
  brandSlug: z.string().min(1).max(100).optional(),
  enabled: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

// 纯 ZodObject base —— 不挂 .refine，便于 .partial() 派生 UpdateSchema
const CreateBase = z.object({
  slot: SlotEnum,
  brandScope: BrandScopeEnum,
  brandSlug: z.string().min(1).max(100).nullable().optional(),
  ordering: z.number().int().min(0).default(0),
  contentRefType: ContentRefTypeEnum,
  contentRefId: z.string().min(1).max(2048),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
})

// 4 条业务规则 helper —— Create + Update 复用，保证规则不漂移
// 设计：refine 在 partial 字段为 undefined 时短路放行（仅当字段提供时校验）
// 类型：(v: Partial<z.input<typeof CreateBase>>) 收紧避免 CLAUDE.md 禁 any 红线
type CreateInput = Partial<z.input<typeof CreateBase>>

function applyBusinessRules<T extends z.ZodTypeAny>(schema: T): z.ZodTypeAny {
  return schema
    .refine((v: CreateInput) => v.brandScope === undefined || !(v.brandScope === 'brand-specific' && !v.brandSlug),
      { message: 'brand-specific 必须指定 brandSlug', path: ['brandSlug'] })
    .refine((v: CreateInput) => v.brandScope === undefined || !(v.brandScope === 'all-brands' && v.brandSlug),
      { message: 'all-brands 不得指定 brandSlug', path: ['brandSlug'] })
    .refine((v: CreateInput) => !(v.startAt && v.endAt && new Date(v.startAt) >= new Date(v.endAt)),
      { message: 'startAt 必须早于 endAt', path: ['startAt'] })
    .refine((v: CreateInput) => {
      if (v.slot === undefined || v.contentRefType === undefined) return true  // partial 场景短路
      const compat: Record<string, readonly string[]> = {
        banner: ['video', 'external_url', 'custom_html'],
        featured: ['video'],
        top10: ['video'],
        type_shortcuts: ['video_type'],
      }
      return compat[v.slot]?.includes(v.contentRefType) ?? false
    }, { message: 'slot × contentRefType 组合不被允许', path: ['contentRefType'] })
}

const CreateSchema = applyBusinessRules(CreateBase)

// UpdateSchema：omit enabled（强制走 publish-toggle 专用端点；Y2 闭合）
// + partial 派生 + applyBusinessRules（4 条规则在 partial 字段 undefined 时短路）
// + 至少一字段校验
// **实施强化（M-SN-5 中期审计 Y-MID-1 补注，2026-05-12）**：实施时建议在
// .partial() 后链 .strict() — body 含 enabled 字段会直接返回 422 "Unrecognized key"，
// 与 Y2 协议层闭合形成双重防御（schema 类型 + runtime 校验）。-05/-06 实施卡已落地
// `.partial().strict()` 写法，与本 ADR 文本协议等价（强化非违反）。
const UpdateSchema = applyBusinessRules(CreateBase.omit({ enabled: true }).partial())
  .refine((v) => Object.keys(v).length > 0, { message: '至少一字段' })

const ReorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    ordering: z.number().int().min(0),
  })).min(1).max(200),  // 上限 200：防 BEGIN/COMMIT 长事务（A3 advisory）
})

const PublishToggleSchema = z.object({
  enabled: z.boolean(),
})
```

**关键约束**：
- `metadata: z.record(z.unknown())` 不做 schema 校验，由消费端自管（ADR-052 §metadata 使用守则已锁定；本 ADR 不收紧）
- UpdateSchema 禁止 enabled 字段：admin UI 必须走 `POST /:id/publish-toggle` 上下线，PATCH 仅改业务字段（Y2 协议层闭合）
- PATCH 422 出现路径：`body 空 → "至少一字段"` 或 `body 含 enabled → "Unrecognized key 'enabled'"`；`id 不存在 → 404`

**路径常量**：`/admin/home-modules`（hyphen 形式；与 DB 表名 `home_modules` 下划线区分）。

### audit log 协议

**新增 AdminAuditActionType 5 项**（`packages/types/src/admin-moderation.types.ts:114`）：

```ts
export type AdminAuditActionType =
  | ...既有 11 项
  | 'home_module.create'
  | 'home_module.update'
  | 'home_module.delete'
  | 'home_module.reorder'
  | 'home_module.publish_toggle'
```

**新增 AdminAuditTargetKind 1 项**：

```ts
export type AdminAuditTargetKind =
  | ...既有 6 项
  | 'home_module'
```

**写入位点（Service 层，由端点实施卡 -05/-06 落地）**：

| 端点 | actionType | targetId | beforeJsonb | afterJsonb |
|---|---|---|---|---|
| POST `/admin/home-modules` | home_module.create | created.id | null | full HomeModule |
| PATCH `/admin/home-modules/:id` | home_module.update | id | before HomeModule | after HomeModule |
| DELETE `/admin/home-modules/:id` | home_module.delete | id | before HomeModule | null |
| POST `/admin/home-modules/reorder` | home_module.reorder | null（批量动作） | `{ items: [{ id, ordering: oldOrdering }] }` | `{ items: [{ id, ordering: newOrdering }] }` |
| POST `/admin/home-modules/:id/publish-toggle` | home_module.publish_toggle | id | `{ enabled: oldVal }` | `{ enabled: newVal }` |

**fire-and-forget 模式**（CHG-SN-4-05）：`auditSvc.write(...)` 不 await，失败 log warn 不阻塞主操作。

### 错误码

复用 ADR-110 14 码，零新增：

| 场景 | code | status |
|---|---|---|
| zod schema 失败 | VALIDATION_ERROR | 422 |
| Service 层业务规则校验（brand_scope 互斥 / 时间窗 / slot×content_ref_type） | VALIDATION_ERROR | 422 |
| 找不到 id | NOT_FOUND | 404 |
| DB CHECK 违反兜底（Service 漏校验或并发漂移） | STATE_CONFLICT | 409 |
| 未登录 | UNAUTHORIZED | 401 |
| 非 admin role | FORBIDDEN | 403 |

**错误响应统一格式**：

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "brand-specific 必须指定 brandSlug", "status": 422 } }
```

**message 模板（Y3 闭合）**：

| 场景 | message 模板 |
|---|---|
| zod schema 失败（字段名） | `"<字段名> 必须 <规则>"`（zod 自动生成中文 message 或 refine 显式 message） |
| brand_scope 互斥违反 | `"brand-specific 必须指定 brandSlug"` / `"all-brands 不得指定 brandSlug"` |
| 时间窗违反 | `"startAt 必须早于 endAt"` |
| slot × contentRefType 违反 | `"slot × contentRefType 组合不被允许"` |
| UpdateSchema 含 enabled | `"Unrecognized key 'enabled'（请使用 POST /:id/publish-toggle）"` |
| PATCH body 空 | `"至少一字段"` |
| DB CHECK 兜底（仅并发场景） | `"DB CHECK <约束名> 触发"`（如 `home_modules_ref_type_slot_compat` / `home_modules_time_window_valid`） |
| NOT_FOUND | `"home_module <id> 不存在"` |

### 备选方案

**A. publish toggle 选择**：
- ✗ 方案 1：PATCH `{ enabled: true/false }`（与 UpdateSchema 重叠） — 弱语义 / audit log actionType 混淆（home_module.update vs publish_toggle 难区分）/ PATCH 多字段时易误操作整 row / 运营场景需要"上下线"按钮强语义反馈
- ✗ 方案 2：POST `/publish` + POST `/unpublish` 双端点 — 端点数增至 7 超 plan §6 "9-10 端点" 约束上限
- ✅ **方案 3（采纳）**：POST `/:id/publish-toggle` 显式传 enabled boolean — 端点数 6 符合约束 / audit actionType 独立 / 显式传值禁止 toggle 隐式（避免并发竞态）

**B. 缓存策略**：
- ✗ Redis cache + write invalidation — 引入新依赖（Redis client）且多 admin 并发写时易出现 cache invalidation race；首版不引入
- ✅ **方案（采纳）**：首版零缓存，依赖 PG query cache + home_modules_slot_brand_idx 部分索引（ADR-052 §索引策略已优化）；触发条件锁定（决策要点 6 三条）后再起 PRE-CACHE-HOME 卡

**C. 错误码扩展**：
- ✗ 新增 `INVALID_TIME_WINDOW` / `BRAND_SCOPE_MISMATCH` 等业务专属码 — 违反 ADR-110 ErrorCode 关闭真源（CHG-SN-4-05 已固化）/ 增加客户端 error code 处理复杂度
- ✅ **方案（采纳）**：复用 VALIDATION_ERROR，错误细节通过 `message` 字段携带（前端可直接展示）

**D. 路径命名**：
- ✗ `/admin/home_modules`（下划线，与 DB 表名一致） — 违反 REST 路径 hyphen 约定
- ✗ `/admin/homemodules`（无分隔） — 可读性差
- ✅ **方案（采纳）**：`/admin/home-modules`（hyphen，与既有 admin 路由风格一致）

**E. reorder 端点设计**：
- ✗ PATCH 单条 `/admin/home-modules/:id` 客户端循环调用 — N 次 HTTP 往返；非事务性
- ✅ **方案（采纳）**：POST `/admin/home-modules/reorder` 批量 + Service 层事务（BEGIN/COMMIT/ROLLBACK，已在 queries 实现）

### 后果

**正面**：
1. -05/-06 端点实施卡（CHG-SN-5-05 list+create+update / CHG-SN-5-06 delete+reorder+publish-toggle）按本 ADR 直接落地，零设计自由度，§4.5 ADR-端点先后协议硬约束满足
2. -07 `/admin/home` 视图卡有明确端点契约可消费，避免视图开发期反复回流端点 schema 调整
3. 错误码零新增、audit log 类型有限扩枚举（5 + 1）、缓存首版零引入 — 与 plan §10 "新增端点不得修改邻近现有端点（隔离原则）" 一致
4. zod 双层校验（Service + DB CHECK）双保险，前后端类型一致（zod schema 可由 server-next 复用）

**负面 / 风险**：
1. **R-ADR-104-1**：DB CHECK 违反兜底使用 STATE_CONFLICT 409 语义略不贴合（"状态被其他操作更新"），但 ADR-110 关闭真源不引入新码 — 缓解：Service 层 zod 预校验覆盖所有可恢复违例，STATE_CONFLICT 仅在并发竞争或迁移漂移时触发（罕见路径），message 字段携带具体约束名以表达细节
2. **R-ADR-104-2（已收口，Y2 闭合）**：~~publish-toggle 与 PATCH `{ enabled }` 双重路径风险~~ → arch-reviewer 第 1 轮 Y2 强制收口：UpdateSchema 协议层 `.omit({ enabled: true })` 禁止 PATCH 修 enabled，从根本消除双路径。admin UI 唯一上下线入口为 `POST /:id/publish-toggle`；audit log actionType 一对一映射（PATCH → home_module.update / publish-toggle → home_module.publish_toggle，无歧义）。运营场景如需"批量切换上下线"亦由 publish-toggle 端点循环承担（不引入批量 publish-toggle 端点，因 Phase B 6 端点约束已满 + 批量上下线非高频运营路径，触发条件：3+ 运营反馈高频需求 → 起 PRE-PUBLISH-BATCH 卡）
3. **R-ADR-104-3**：缓存首版零引入可能成为公开 `/home/modules` p95 瓶颈 — 缓解：触发条件已锁定（决策要点 6 三条），命中即起 PRE-CACHE-HOME 卡；不在本 ADR 范围
4. **R-ADR-104-4**：audit log AdminAuditActionType 扩枚举为 closed enum（admin-moderation.types.ts:111 注释 "新增前必须先改 plan + 本枚举"）— 缓解：本 ADR 即满足该约束（plan §9 ADR-104 推进 + 枚举同步落地由 -05/-06 端点实施卡承担，本 ADR 起草卡不动代码）

### 验证

**起草卡（CHG-SN-5-04）完成判据**：
- arch-reviewer Opus PASS（≤ 3 轮 CONDITIONAL 闭环；REJECT = BLOCKER §5.2）
- 落 `docs/decisions.md` ADR-104 章节完整（9 节：背景 / 决策要点 / 端点契约 / audit log / 错误码 / 备选方案 / 后果 / 验证 / 关联）
- plan §9 ADR 索引推进 ADR-104 状态 候选 → Accepted

**端点实施卡（CHG-SN-5-05/-06）落地判据**：
- 6 端点契约 100% 与本 ADR §端点契约表对齐
- audit log 5 actionType + 1 targetKind 扩枚举落地（admin-moderation.types.ts）
- Service 层 zod 预校验覆盖所有 brand_scope / 时间窗 / slot×content_ref_type 违例
- unit test 覆盖 6 端点 happy path + 错误码全集 + audit log 写入
- typecheck + lint 全绿

**视图实施卡（CHG-SN-5-07）落地判据**：
- 6 端点全部被 `/admin/home` 视图消费（list 用于初始化 + 刷新；create / update / delete / publish-toggle 用于运营操作；reorder 用于拖拽排序）
- 与既有视图卡（CHG-SN-5-01/-02/-03）DataTable 一体化范式一致

### 关联

- **关联 ADR**：ADR-052（home_modules schema，本 ADR 协议层兄弟）/ ADR-046（多品牌 brand_scope 协议，本 ADR brand_scope 互斥校验真源）/ ADR-110（ApiResponse 信封 + ErrorCode 关闭真源，本 ADR 错误码零新增依据）/ ADR-100（依赖白名单，本 ADR 零新依赖）
- **关联 plan §**：§4.5 ADR-端点先后协议（本 ADR 是 -05/-06/-07 三卡硬前置）/ §6 M-SN-5 推荐 3（首页运营位编辑器）/ §9 ADR 索引 ADR-104 / §10 风险段 R-M-SN-5-A（6 原语 API 稳定性，本 ADR 不引入新原语）
- **关联 task-queue**：SEQ-20260512-02 子卡 CHG-SN-5-04（本卡） → CHG-SN-5-05（list+create+update 端点） → CHG-SN-5-06（delete+reorder+publish-toggle 端点） → CHG-SN-5-07（`/admin/home` 视图消费 6 端点）
- **关联代码（既有，本 ADR 引用不修改）**：
  - `apps/api/src/db/migrations/050_create_home_modules.sql`（schema 由 ADR-052 决策）
  - `apps/api/src/db/queries/home-modules.ts`（DB 查询层 8 函数）
  - `packages/types/src/home-module.types.ts`（HomeModule / HomeModuleSlot / CreateHomeModuleInput / UpdateHomeModuleInput / ReorderHomeModuleItem 5 类型）
  - `apps/api/src/routes/home.ts`（公开端点，本 ADR 范围外）
  - `apps/api/src/services/AuditLogService.ts`（fire-and-forget 模式，本 ADR 复用）
  - `apps/api/src/lib/auth.ts`（admin role gate `preHandler: auth`，本 ADR 复用）
- **关联触发条件（未来）**：
  - PRE-CACHE-HOME（缓存层引入）：决策要点 6 三条触发条件任一命中
  - PRE-HOME-MODULE-V2（端点 v2 / break change）：运营场景出现 plan §6 范围外新需求

---

## ADR-105：video merge / split / unmerge admin API 协议（CHG-SN-5-08）

- **日期**：2026-05-12
- **状态**：**Accepted**（arch-reviewer Opus × 3 轮：第 1 轮 CONDITIONAL 3 红线 + 5 黄线 → 第 2 轮 CONDITIONAL 3 残留 → 第 3 轮 PASS 最终轮）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) × 3 轮
- **关联**：ADR-104（home_modules 协议同模式）/ ADR-110（ApiResponse 信封 + ErrorCode 真源）/ ADR-114-NEGATED（video_sources `(source_site_key, source_name)` 复合键约束，跨站不合并）/ CHG-SN-4-05（AuditLogService fire-and-forget）/ migration 007（video_merge：title_normalized + video_aliases）/ migration 026（media_catalog 作品元数据层）/ plan §4.5（ADR-端点先后协议）
- **对应交付**：SEQ-20260512-02 Phase C（CHG-SN-5-08 起草 → CHG-SN-5-09/-10 端点实施 → CHG-SN-5-11 `/admin/sources` + CHG-SN-5-12 `/admin/merge` 视图）
- **触发**：plan §6 M-SN-5 推荐 5（合并 candidate 预览 + 拆分工作台）+ §4.5 ADR-端点先后协议硬约束

### 背景

videos 表已含 `title_normalized` 字段（migration 007）+ TitleNormalizer Service 提供 `normalizeTitle()` / `buildMatchKey()` 函数，DB 层有 `idx_videos_normalized_year_type ON videos(title_normalized, year, type) WHERE deleted_at IS NULL` 部分索引（migration 007:40）覆盖按 normalized 三元组聚合的主路径。media_catalog 层（migration 026）+ media_catalog_aliases（migration 030）承载作品元数据 + 别名。爬虫归并由 CrawlerService 内部 buildMatchKey 自动执行（规则 A：title_normalized + year + type 三元组完全相同才合并）。

**当前缺失**：
- admin 手工合并工作台端点（场景：爬虫规则保守 → 同作品多 video 行残留 → 运营手工合并）
- admin 手工拆分端点（场景：爬虫激进合并 → 错误归并 → 运营拆回）
- 合并/拆分历史审计日志（支持 unmerge 撤销 + 运营复盘）
- 合并候选预览端点（pre-flight 让运营在执行前看到 N 条候选 + 评分）

plan §4.5 ADR-端点先后协议硬约束：admin API 协议须先 ADR + Opus PASS，再起 -09/-10 端点实施卡。本 ADR 锁定 4 端点契约 + 新 `video_merge_audit` schema（migration 062 SQL 草案）+ candidate 算法基线 + 性能基线 + audit log 扩枚举 + 错误码 + 鉴权。

### 决策要点

1. **范围澄清 — video 层合并，不是 video_source/line 层**：ADR-114-NEGATED 决议保持 video_sources `(source_site_key, source_name)` 复合键 + 跨站不合并；本 ADR 在 **video 层**操作（同作品的多个 video 行合并），video_sources 数据**整体转移**至 target video（不修改 source_site_key / source_name 字段，仅 UPDATE video_id 字段指向 target）。
   - **复合键约束兼容性**（R-105-1 修订，arch-reviewer 第 1 轮）：video_sources 既有约束 `uq_sources_video_episode_url UNIQUE NULLS NOT DISTINCT (video_id, episode_number, source_url)`（migration 007:64-65）— 当 source video 与 target video **各自含相同 `(episode_number, source_url)` 组合**时，转移 UPDATE 会触发唯一约束违反整体 ROLLBACK。
   - **冲突处理策略（采纳方案 A）**：merge Service 层前置探测冲突 — `SELECT COUNT(*) FROM video_sources s1 JOIN video_sources s2 ON s1.episode_number IS NOT DISTINCT FROM s2.episode_number AND s1.source_url = s2.source_url WHERE s1.video_id = ANY($sources) AND s2.video_id = $target` > 0 → 返回 **STATE_CONFLICT 409** message `'source 与 target 视频存在重复 (episode_number, source_url) 组合 N 条，请先在 /admin/sources 视图处理（保留其一删除其余）后再合并'`，整体不转移。运营预 resolve 责任在 `/admin/sources` 视图（CHG-SN-5-11 范围）。
2. **新 schema `video_merge_audit`**（migration 062，与 home_modules audit 沿用 admin_audit_log 的协议层不同，本表是 **业务级 audit + restore snapshot**，admin_audit_log 仍写 video.merge/unmerge/split 三 actionType 供运营审计）：
   - `action`：'merge' | 'split'
   - `source_video_ids[]`：合并场景=被合并的 video ids / 拆分场景=拆分前的单个 video id
   - `target_video_ids[]`：合并场景=合并后的 target video / 拆分场景=拆分后的多个 video ids
   - `snapshot_jsonb`：完整 video + sources + aliases 备份（unmerge 还原数据源）
   - `performed_by` / `performed_at` / `reverted_at`（null = 未撤销）
3. **4 端点**：
   - `GET /admin/video-merges/candidates` — candidate 列表 + 评分（运营 pre-flight）
   - `POST /admin/video-merges` — 执行合并（事务内转移 sources/aliases + soft delete source videos + 写 audit）
   - `POST /admin/video-merges/:auditId/unmerge` — 按 audit 撤销合并（还原 source videos + 解绑 sources，置 audit.reverted_at）
   - `POST /admin/videos/:id/split` — 按 source 分组拆分（每组新建 video + 移交 sources + 写 audit）
4. **candidate 算法基线 v1**（R-105-3 修订，arch-reviewer 第 1 轮）：
   - 主路径：`SELECT title_normalized, year, type, ARRAY_AGG(id) AS video_ids, COUNT(*) FROM videos WHERE deleted_at IS NULL GROUP BY 1,2,3 HAVING COUNT(*) > 1 LIMIT N`（依赖 idx_videos_normalized_year_type 部分索引，p95 ≤ 200ms / N=100）
   - **评分函数 v1（简化为 source_overlap_ratio 单维）**：因 GROUP BY 已严格保证 title_normalized + year + type 三元组完全匹配，title/year/type 三项贡献恒为常量；v1 评分单维 `score = source_overlap_ratio ∈ [0, 1]`（两 video 共享的 source_site_key 占比 / 并集大小）。**minScore 默认 0.6** 实质过滤"source 重合度低于 60% 的候选组"（如 video A 仅含 'iqiyi' / video B 仅含 'youku'，source_overlap=0 必被过滤）— 业务语义明确。
   - **未来扩展**：fuzzy match 需求出现 → ADR-105a 引入 pg_trgm 索引 + 多维加权评分公式（title_similarity 0.4 + year_diff 0.2 + type_match 0.2 + source_overlap 0.2）；v1 严格三元组匹配先满足保守 false-positive 低需求
   - 返回 top-N 候选组（默认 N=20，最大 100），每组含 video 概要 + 评分 + 推荐 target（首播时间最早 OR source 最多的 video）
5. **鉴权 admin only**：与 ADR-104 同级 `preHandler: [authenticate, requireRole(['admin'])]`，moderator 不放权（合并/拆分破坏性操作 + 审计敏感）
6. **错误码零新增**：复用 ADR-110 14 码 — VALIDATION_ERROR 422 / NOT_FOUND 404 / STATE_CONFLICT 409（已撤销 audit / target video 已删 / source video 互相引用） / FORBIDDEN 403 / UNAUTHORIZED 401
7. **audit log 扩 admin_audit_log 枚举 3 项**：AdminAuditActionType 增 `video.merge` / `video.unmerge` / `video.split`；AdminAuditTargetKind 已含 'video'（无需扩）。Service 层 fire-and-forget 写入位点见 §audit log 协议表
8. **响应包络对齐 ADR-110**：列表 `{ data, total, page, limit }`；执行操作 `{ data: { auditId, ... } }`；DELETE 类操作不适用本 ADR（合并不删 audit，撤销仅置 reverted_at）
9. **事务性约束**：merge / split / unmerge 三 mutation 端点必须在 BEGIN/COMMIT 内执行（涉及多表更新：videos / video_sources / media_catalog_aliases / video_merge_audit）；失败 ROLLBACK 不留半完成态
10. **性能 + 触发条件**（plan §10 R-M-SN-5-B 关联）：
    - candidate p95 ≤ 200ms / N=100（首版基线）
    - 触发优化卡 PRE-MERGE-CACHE：(a) p95 > 200ms 持续 1 周；(b) candidates 总数 > 10000 拒绝服务；(c) 用户实测 candidate 列表加载明显慢

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/video-merges/candidates` | 列出 video 合并候选 + 评分 | Query: `type?` / `minScore?=0.6` / `limit?=20` / `page?=1` | 200 `{ data: CandidateGroup[], total, page, limit }` | 422 VALIDATION_ERROR |
| 2 | POST | `/admin/video-merges` | 执行合并 | Body: `{ sourceVideoIds: string[], targetVideoId: string, reason?: string }` | 200 `{ data: { auditId, targetVideo: VideoSummary } }` | 422 / 404（任一 video 不存在）/ 409（target 已被合并到他处） |
| 3 | POST | `/admin/video-merges/:auditId/unmerge` | 撤销合并 | Body: `{ reason?: string }` | 200 `{ data: { restoredVideoIds: string[] } }` | 404 / 409（audit 已撤销 / target video 已删） |
| 4 | POST | `/admin/videos/:id/split` | 按 source 分组拆分 | Body: `{ groups: [{ sourceIds: string[], newVideoMeta: { title, year?, type } }] }`（≥2 组） | 200 `{ data: { auditId, newVideoIds: string[] } }` | 422 / 404 / 409（id 已被合并/拆分） |
| 5 | GET | `/admin/video-merges/audit` | 列出 merge/split/unmerge 历史 audit timeline（**ADR-105 AMENDMENT 2026-05-14 / CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7**）| Query: `action?='merge'\|'split'` / `videoId?` / `limit?=20` / `page?=1` | 200 `{ data: MergeAuditRow[], total, page, limit }` | 422 VALIDATION_ERROR |

**zod request schema（Service 层 + Route 层共享，端点实施卡 -09/-10 落地）**：

```ts
const ListCandidatesSchema = z.object({
  type: VideoTypeEnum.optional(),
  minScore: z.coerce.number().min(0).max(1).default(0.6),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
})

const MergeSchema = z.object({
  sourceVideoIds: z.array(z.string().uuid()).min(1).max(10),
  targetVideoId: z.string().uuid(),
  reason: z.string().max(500).optional(),
})
  .refine((v) => !v.sourceVideoIds.includes(v.targetVideoId),
    { message: 'targetVideoId 不得在 sourceVideoIds 中', path: ['targetVideoId'] })
  // Y-105-2 修订（arch-reviewer 第 1 轮）：sourceVideoIds 自身去重，避免 audit snapshot 数组重复值
  .refine((v) => new Set(v.sourceVideoIds).size === v.sourceVideoIds.length,
    { message: 'sourceVideoIds 不得含重复值', path: ['sourceVideoIds'] })

const UnmergeSchema = z.object({
  reason: z.string().max(500).optional(),
})

const SplitSchema = z.object({
  groups: z.array(z.object({
    sourceIds: z.array(z.string().uuid()).min(1),
    newVideoMeta: z.object({
      title: z.string().min(1).max(500),
      year: z.number().int().min(1800).max(2100).optional(),
      type: VideoTypeEnum,
    }),
  })).min(2).max(20),  // 至少拆 2 组；上限 20 防滥用
})
// Y-105-3 修订（arch-reviewer 第 1 轮）：sourceIds 完整划分约束 — Service 层前置校验
// UNION(groups[*].sourceIds) ≡ video_sources WHERE video_id=:id 全集（不相交划分，
// 无孤儿、无重复）；违反 VALIDATION_ERROR 422。zod schema 不可表达跨 group 唯一性 +
// DB 状态依赖，Service 层落地。
```

**路径常量**：`/admin/video-merges`（hyphen，名词复数，与既有 `/admin/home-modules` / `/admin/crawler-sites` 风格一致）+ `/admin/videos/:id/split`（split 作为 video 资源的子动作，挂在 videos 命名空间下）。

### video_merge_audit schema（migration 062 草案，由 -09 端点实施卡承担落地）

```sql
-- 062_create_video_merge_audit.sql
-- 描述：video 层合并/拆分历史审计 + restore snapshot
-- 日期：2026-05-12
-- ADR：ADR-105
-- 幂等：是（CREATE TABLE IF NOT EXISTS）

BEGIN;

CREATE TABLE IF NOT EXISTS video_merge_audit (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  action            TEXT         NOT NULL CHECK (action IN ('merge', 'split')),
  source_video_ids  UUID[]       NOT NULL,
  target_video_ids  UUID[]       NOT NULL,
  -- merge: source_video_ids = 被合并的 [v1,v2,...] / target_video_ids = [target]
  -- split: source_video_ids = [拆分前 video] / target_video_ids = 拆分后 [v1,v2,...]
  snapshot_jsonb    JSONB        NOT NULL,
  -- 完整备份：{ videos: [{...}], sources: [{...}], aliases: [{...}] }
  -- unmerge / split 撤销时基于 snapshot 还原；JSONB 而非外键避免 cascade 删除丢历史
  performed_by      UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- admin user id（R-105-2 修订：UUID + 外键约束，与 admin_audit_log.actor_id 同类型同语义；migration 052:26 对照）
  reason            TEXT         NULL,
  -- 运营备注（可选；从 endpoint body.reason 透传）
  performed_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  reverted_at       TIMESTAMPTZ  NULL,
  -- unmerge / split 撤销时设此字段；非 NULL = 该次操作已被撤销
  reverted_by       UUID         NULL REFERENCES users(id) ON DELETE RESTRICT,
  reverted_reason   TEXT         NULL,
  CONSTRAINT video_merge_audit_revert_consistency
    CHECK ((reverted_at IS NULL AND reverted_by IS NULL AND reverted_reason IS NULL)
        OR (reverted_at IS NOT NULL AND reverted_by IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS video_merge_audit_action_idx
  ON video_merge_audit (action, performed_at DESC)
  WHERE reverted_at IS NULL;

CREATE INDEX IF NOT EXISTS video_merge_audit_source_videos_gin
  ON video_merge_audit USING GIN (source_video_ids);

CREATE INDEX IF NOT EXISTS video_merge_audit_target_videos_gin
  ON video_merge_audit USING GIN (target_video_ids);

COMMIT;

-- ── down 路径（注释保留，运维手动） ─────────────────────────────────
-- BEGIN;
-- DROP INDEX IF EXISTS video_merge_audit_target_videos_gin;
-- DROP INDEX IF EXISTS video_merge_audit_source_videos_gin;
-- DROP INDEX IF EXISTS video_merge_audit_action_idx;
-- DROP TABLE IF EXISTS video_merge_audit;
-- COMMIT;
```

**索引设计理由**：
- `(action, performed_at DESC) WHERE reverted_at IS NULL` 部分索引：覆盖"列出未撤销的合并历史"主路径
- GIN 索引：支持 `WHERE source_video_ids @> ARRAY['<id>']` 反查（运营查询"某 video 是否被合并过"）

### audit log 协议

**新增 AdminAuditActionType 3 项**：

```ts
export type AdminAuditActionType =
  | ...既有 16 项（含 ADR-104 扩 5 项）
  | 'video.merge'
  | 'video.unmerge'
  | 'video.split'
```

AdminAuditTargetKind 已含 'video'（admin-moderation.types.ts:127 既有），无需扩。

**写入位点**（Service 层，由 -09/-10 端点实施卡落地）：

| 端点 | actionType | targetId | beforeJsonb | afterJsonb |
|---|---|---|---|---|
| POST `/admin/video-merges` | video.merge | targetVideoId | `{ sourceVideoIds, snapshot }` | `{ auditId, targetVideoId }` |
| POST `/admin/video-merges/:auditId/unmerge` | video.unmerge | restoredVideoIds[0]（**Y-105-4 修订**：targetKind='video' 期望 targetId 是 videos.id，原稿用 auditId 语义错位破坏 idx_admin_audit_log_target 反查；改为 unmerge 还原后的首个 videoId） | `{ auditId, action: 'merge', revertedFromTargetVideoId }` | `{ restoredVideoIds }` |
| POST `/admin/videos/:id/split` | video.split | id（拆分前 video） | `{ originalVideoId: id, snapshot }` | `{ auditId, newVideoIds }` |

**fire-and-forget 模式**（CHG-SN-4-05）：`auditSvc.write(...)` 不 await，写失败 log warn 不阻塞主操作。**双层 audit**：`video_merge_audit` 表存 restore snapshot（业务级），`admin_audit_log` 存 actionType + 引用 video_merge_audit.id（管理审计级）。

**写入时序（Y-105-5 修订，arch-reviewer 第 1 轮）**：
- **video_merge_audit 写入在事务内**（BEGIN ... INSERT video_merge_audit ... UPDATE videos/video_sources ... COMMIT）— 强一致，失败 ROLLBACK 全回滚
- **admin_audit_log 写入在 COMMIT 之后**（fire-and-forget）— 避免业务 ROLLBACK 后 admin_audit_log 仍写入虚假成功记录；COMMIT 失败 → 直接抛错给路由层，不写管理审计
- Service 层模式：
  ```ts
  async merge(params, actorId) {
    const client = await db.connect()
    try {
      await client.query('BEGIN')
      // ... 业务 + video_merge_audit INSERT ...
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err  // 不写 admin_audit_log
    } finally { client.release() }
    // COMMIT 成功后才 fire-and-forget admin_audit_log
    this.auditSvc.write({ actionType: 'video.merge', ... })
  }
  ```

### 错误码

复用 ADR-110 14 码，零新增：

| 场景 | code | status |
|---|---|---|
| zod schema 失败 | VALIDATION_ERROR | 422 |
| targetVideoId ∈ sourceVideoIds 等业务规则违反 | VALIDATION_ERROR | 422 |
| video / audit 不存在 | NOT_FOUND | 404 |
| audit 已被撤销 / target video 已被合并到他处 / split 视频已被合并 | STATE_CONFLICT | 409 |
| 非 admin 角色 | FORBIDDEN | 403 |
| 未登录 | UNAUTHORIZED | 401 |

**message 模板（与 ADR-104 同范式）**：

| 场景 | message 模板 |
|---|---|
| sourceVideoIds 含 targetVideoId | `'targetVideoId 不得在 sourceVideoIds 中'` |
| sourceVideoIds 含重复值（Y-105-2） | `'sourceVideoIds 不得含重复值'` |
| split groups < 2 | `'groups 必须 ≥ 2 组（少于 2 组不构成拆分）'` |
| split groups[*].sourceIds 不是完整划分（Y-105-3） | `'groups.sourceIds 必须覆盖且仅覆盖拆分前 video 的全部 sources（不允许孤儿或重复）'` |
| merge 转移触发 uq_sources_video_episode_url 冲突（R-105-1） | `'source 与 target 视频存在重复 (episode_number, source_url) 组合 N 条，请先在 /admin/sources 视图处理（保留其一删除其余）后再合并'`（status=409 STATE_CONFLICT） |
| audit 已撤销 | `'该合并/拆分已被撤销（reverted_at IS NOT NULL）'` |
| target video 已合并 | `'targetVideoId 已被合并到其他视频（不可作为合并目标）'` |
| split 视频已合并 | `'该视频已被合并，请先 unmerge 后再 split'` |
| video / audit 不存在 | `'<resource> <id> 不存在'` |

### 备选方案

**A. video_merge_audit vs 共用 admin_audit_log**：
- ✗ 方案 1：仅用 admin_audit_log + jsonb 字段存 snapshot — admin_audit_log.before_jsonb 字段未约束大小，但混入业务级 restore 数据后查询性能下降 + audit 表膨胀；且 audit log 是 fire-and-forget，写失败可丢，不能承担"unmerge 必须能还原"的承诺
- ✗ 方案 2：merge / split 各自独立表 — 数据模型不对称（merge N→1 / split 1→N），但 schema 几乎相同；维护成本高
- ✅ **方案 3（采纳）**：单表 video_merge_audit + `action` 字段区分 + 双数组字段（source/target）适配 N→1 + 1→N 两方向 + JSONB snapshot 业务级强一致写入；admin_audit_log 仅引用 audit.id 做管理级审计

**B. unmerge 实现策略**：
- ✗ 方案 1：仅恢复 video 记录 + 不恢复 sources / aliases — 数据不完整（合并时转移的 sources 留在 target，撤销后 target 仍含）
- ✅ **方案 2（采纳）**：基于 snapshot_jsonb 完整还原 — videos restore + sources 解绑（DELETE WHERE video_id IN restored AND id IN snapshot.sources）+ 别名 / catalog 同步重置；reverted_at 置当前时间，audit 记录保留（不删，便于复盘）

**C. split 端点路径**：
- ✗ 方案 1：`POST /admin/video-splits` 独立资源 — 与 merge 端点风格不对称（merge 是 N→1 操作 + N→1 资源；split 是 1→N 操作但落在哪个资源上？）
- ✅ **方案 2（采纳）**：`POST /admin/videos/:id/split` 作为 video 资源的子动作 — split 的"主体"是被拆分的视频，挂在 videos 命名空间下符合 REST 子资源动作语义

**D. candidate 算法**：
- ✗ 方案 1：fuzzy match（Levenshtein 距离 / pg_trgm 模糊匹配）— 性能不可控（pg_trgm 索引未在 migration 中创建），且 false positive 多
- ✅ **方案 2（采纳）**：严格 title_normalized + year + type 三元组完全匹配（依赖既有 idx_videos_normalized_year_type 索引）+ source 重合度评分 — 性能 p95 ≤ 200ms 可承诺，false positive 低；如未来 fuzzy 需求出现 → ADR-105a 修订引入 pg_trgm 索引

**E. 错误码 STATE_CONFLICT 语义复用**：
- ADR-110 STATE_CONFLICT message "状态已被其他操作更新，请刷新后重试" 与本 ADR "audit 已撤销 / target 已被合并到他处" 场景虽语义不完全贴合但仍属"状态冲突"范畴，不引入新码（ADR-110 关闭真源）；前端通过 message 字段携带具体原因展示给用户

### 后果

**正面**：
1. -09 candidates 预览端点（CHG-SN-5-09）+ -10 merge + split + unmerge 端点（CHG-SN-5-10，Y-105-1 范围修订后）按本 ADR 直接落地，零设计自由度
2. -11 `/admin/sources` 视图 + -12 `/admin/merge` 视图（CHG-SN-5-11/-12）有明确端点契约可消费
3. 错误码零新增、audit log 类型有限扩枚举（3 项）、新 schema 仅 1 表 — 与 plan §10 "新增端点不得修改邻近现有端点（隔离原则）" 一致
4. video_merge_audit + admin_audit_log 双层 audit 设计：业务级 restore（不可丢，强一致）+ 管理级审计（fire-and-forget，可丢）分离 + 写入时序严格（事务内 vs COMMIT 后）防虚假记录（Y-105-5 修订）
5. ADR-114-NEGATED 复合键约束兼容（video_sources 整体转移仅 UPDATE video_id 字段，零 source_site_key/source_name 修改；merge 前置冲突探测 + STATE_CONFLICT 409 拒绝转移避免 uq_sources_video_episode_url 触发 ROLLBACK；R-105-1 修订）

**负面 / 风险**：
1. **R-ADR-105-1**：snapshot_jsonb 列无上限约束 — 极端场景（被合并 video 含 100+ sources + 1000+ aliases）单 audit 行可能 > 100KB。**缓解**：sourceVideoIds 上限 10（zod schema 约束）+ 业务规则 video.source_count ≤ 100 监控（已在 plan §10 R-M-SN-5-B 隐含）；如未来命中 → 起 PRE-MERGE-AUDIT-SHARD 卡评估分表
2. **R-ADR-105-2**：unmerge 撤销窗口无 TTL — audit 永久保留，1 年前的合并仍可撤销（但期间业务状态可能已大变）。**缓解**：本 ADR 不引入 TTL；如未来命中"撤销后业务状态崩坏"案例 → 起 PRE-MERGE-TTL 卡引入"7 天内可撤销"约束 + 过期标记
3. **R-ADR-105-3**：candidate 算法严格 title_normalized 三元组完全匹配 — 漏掉 fuzzy 场景（如 "复仇者联盟" vs "复仇者联盟 4"，标题差异但同作品）。**缓解**：v1 严格保守优先；fuzzy 需求出现 → ADR-105a 引入 pg_trgm（不在本 ADR 范围）
4. **R-ADR-105-4**：split 端点 newVideoMeta 仅含 title/year/type 三字段 — 拆分后新 video 缺少 description / cover_url / tags 等运营字段。**缓解**：split 后运营需手工补全（admin/videos 视图编辑）；这是有意的"先拆后补"设计，避免 split 端点过度膨胀

### 验证

**起草卡（CHG-SN-5-08）完成判据**：
- arch-reviewer Opus PASS（≤ 3 轮 CONDITIONAL 闭环；REJECT = BLOCKER §5.2）
- 落 `docs/decisions.md` ADR-105 章节完整（9 节）
- plan §9 ADR 索引推进 ADR-105 状态 Candidate → Accepted

**端点归属（Y-105-1 已闭合，task-queue.md 同步修订）**：本 ADR §端点契约表列出 4 端点（candidates / merge / unmerge / split），task-queue.md SEQ-20260512-02 子卡 CHG-SN-5-10 **卡名已同步修订**为 **"merge + split + unmerge 端点实施"**，范围明确含 3 mutation 端点（POST `/admin/video-merges` merge 执行 + POST `/:auditId/unmerge` + POST `/admin/videos/:id/split`）+ migration 062 落地；与 CHG-SN-5-09 candidates 预览端点分卡清晰。

**端点实施卡（CHG-SN-5-09 candidates 预览 / CHG-SN-5-10 merge + split + unmerge）落地判据**：
- migration 062 落地（video_merge_audit 表 + 3 索引）
- 4 端点契约 100% 与本 ADR §端点契约表对齐
- audit log 3 actionType 扩枚举落地 admin-moderation.types.ts
- Service 层 zod 双层校验覆盖所有业务规则
- candidate p95 ≤ 200ms / N=100 性能基线达成（unit test 跑 100 候选 mock 数据集断言）
- merge / unmerge / split 三 mutation 事务性约束（unit test 模拟中途失败 → 全 rollback）
- unit test 覆盖 4 端点 happy path + 错误码全集 + audit log 写入 + audit payload 内容断言（参 CHG-SN-5-06-PATCH R-MID-1 教训：必须显式断言 before/afterJsonb）

**视图实施卡（CHG-SN-5-11/-12）落地判据**：
- `/admin/merge` 视图消费 4 端点（candidates 预览 + merge 执行 + unmerge 撤销 + split 拆分）
- `/admin/sources` 视图消费 candidates 端点 + 视频维度分组（与 ADR-114-NEGATED 复合键约束一致）
- 与既有视图卡（-01/-02/-03/-07）DataTable 一体化 + 6 原语消费范式一致

### 关联

- **关联 ADR**：ADR-104（home_modules 协议同模式 — 双 ADR 锁定 M-SN-5 admin API 协议层完整）/ ADR-110（ApiResponse 信封 + ErrorCode 关闭真源）/ ADR-114-NEGATED（复合键约束，**本 ADR 通过 merge Service 层前置冲突探测 + STATE_CONFLICT 409 拒绝转移保持兼容**，详见 §决策要点 1）/ ADR-052（home_modules schema 兄弟）/ ADR-100（依赖白名单，本 ADR 零新依赖）
- **关联 plan §**：§4.5 ADR-端点先后协议（本 ADR 是 -09/-10/-11/-12 四卡硬前置）/ §6 M-SN-5 推荐 5（合并 candidate 预览 + 拆分工作台）/ §9 ADR 索引 ADR-105 / §10 风险段 R-M-SN-5-B（candidate-preview 算法跨视频性能不达标，本 ADR 性能基线锁定）
- **关联 task-queue**：SEQ-20260512-02 子卡 CHG-SN-5-08（本卡）→ CHG-SN-5-09（candidates 预览端点）→ CHG-SN-5-10（merge + split + unmerge 端点 + migration 062）→ CHG-SN-5-11（`/admin/sources` 视图）+ CHG-SN-5-12（`/admin/merge` 视图）
- **关联代码（既有，本 ADR 引用不修改）**：
  - `apps/api/src/db/migrations/007_video_merge.sql`（title_normalized + idx_videos_normalized_year_type 部分索引）
  - `apps/api/src/db/migrations/026_create_media_catalog.sql`（媒体元数据层）
  - `apps/api/src/services/TitleNormalizer.ts`（normalizeTitle / buildMatchKey）
  - `apps/api/src/services/AuditLogService.ts`（fire-and-forget 模式，本 ADR 复用）
  - `apps/api/src/lib/auth.ts`（admin role gate `requireRole(['admin'])`）
- **关联代码（本 ADR 触发新增，由 -09/-10 端点实施卡落地）**：
  - `apps/api/src/db/migrations/062_create_video_merge_audit.sql`（schema 草案见上）
  - `apps/api/src/db/queries/video-merges.ts`（CRUD + GIN 反查）
  - `apps/api/src/services/VideoMergesService.ts`（业务规则 + 事务性 merge/unmerge/split + 双层 audit 写入；CHG-SN-5-09 落地复数名 与端点 `/admin/video-merges` 一致，CHG-SN-5-09-PATCH 同步修订）
  - `apps/api/src/routes/admin/video-merges.ts`（4 端点 + admin only 鉴权）
- **关联触发条件（未来）**：
  - PRE-MERGE-CACHE（candidate 缓存层引入）：决策要点 10 三条触发条件任一命中
  - PRE-MERGE-AUDIT-SHARD（snapshot_jsonb 分表）：R-ADR-105-1 极端场景命中
  - PRE-MERGE-TTL（撤销 TTL 约束）：R-ADR-105-2 业务案例命中
  - ADR-105a fuzzy match（pg_trgm 引入）：R-ADR-105-3 fuzzy 需求命中

---

## ADR-117：sources-matrix / source-line-aliases admin API 协议（CHG-SN-5-11，**RETROACTIVE 追溯起草**）

- **日期**：2026-05-12
- **状态**：**Accepted**（arch-reviewer Opus × 2 轮：第 1 轮 CONDITIONAL 4 黄 Y-117-1..4 + 2 advisory A-117-1/-2 全部修订 → 第 2 轮 PASS 无残留）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) × 2 轮
- **关联**：ADR-104（home_modules 协议同模式，端点契约 + audit 扩枚举）/ ADR-105（merge 协议同模式，audit 双层时序）/ ADR-110（ApiResponse 信封 + ErrorCode 真源）/ ADR-114-NEGATED（video_sources `(source_site_key, source_name)` 复合键约束，跨站不合并）/ CHG-SN-4-05（AuditLogService fire-and-forget）/ plan §4.5（ADR-端点先后协议）
- **对应交付**：SEQ-20260512-02 Phase C（CHG-SN-5-08 ADR-105 → -09/-10 端点 → **本 ADR-117 追溯** → CHG-SN-5-11-PATCH 架构清债 → CHG-SN-5-12 `/admin/merge` 视图）
- **触发**：CHG-SN-5-11 commit `e6434abc` 落地 5 端点 + Migration 063 但**跳过 §4.5 R7 MUST-8 ADR 起草环节**（独立评审评级 C / 不合格）→ 本 ADR 追溯合规

### 背景

`/admin/sources` 视图（plan §6 M-SN-5 推荐 4 行 526）承载运营对**线路矩阵 + 视频维度分组 + 全局别名表**三大块的管理诉求。ADR-114-NEGATED 决议保持 `video_sources (source_site_key, source_name)` 复合键 + 跨站不合并，意味着同一作品在不同站点的播放线路在 DB 层是 N 行 video_sources 记录，运营在矩阵视图中按 video × line（线路）× episode（集数）三维查看，并按 `(source_site_key, source_name)` 复合键维护可读别名。

**当前缺失（CHG-SN-5-11 之前）**：
- 视频分组列表端点（4 segment：grouped / dead / correction / orphan + keyword 搜索 + 聚合信号状态）
- 视频分组 KPI 统计端点（total / active / dead / orphan 4 指标）
- 单视频线路×集数矩阵端点（含别名合并）
- 全局别名表 CRUD 端点（`source_line_aliases` 复合 PK 表）

CHG-SN-5-11 commit `e6434abc`（执行模型 claude-sonnet-4-6）已落地：
- `apps/api/src/db/migrations/063_source_line_aliases.sql`（复合 PK + FK SET NULL + 注释 + 索引 + 幂等）
- `apps/api/src/db/queries/sources-matrix.ts`（5 查询 + `aggregateSignal` 业务逻辑，348 行）
- `apps/api/src/routes/admin/sources-matrix.ts`（5 端点，moderator+admin 鉴权，110 行）
- `apps/server-next/src/app/admin/sources/_client/{SourcesClient,SourceMatrixRow,SourceLineAliasPanel}.tsx`（前端视图）
- `tests/unit/api/sources-matrix.test.ts`（15 单测全绿）
- `docs/architecture.md` §5.13（schema 同步）

**plan §4.5 ADR-端点先后协议硬约束**违反：5 个新增端点未先起独立 ADR + Opus PASS。本 ADR 追溯整理协议，并对 CHG-SN-5-11 已存在的偏离（缺 Service 层 / 缺 audit log / 硬编码颜色 / segment 语义不一致 / 未消费 DataTable 一体化 / `<img>` / videoId regex）逐项标注，由 **CHG-SN-5-11-PATCH** 卡承担代码改造。

### 决策要点

1. **5 端点分级鉴权**：4 个读端点（list / stats / matrix / aliases list）`requireRole(['moderator', 'admin'])`（与既有 content / videos / moderation 视图读路由一致）；**PUT 写端点 source-line-aliases upsert 收紧为 `admin only`**（与 home-modules / video-merges 写端点一致，全局别名修改是运营级写，moderator 不放权）。

   **当前实施偏离（D-117-1）**：CHG-SN-5-11 commit 中 PUT 端点亦用 `moderator+admin`；由 -11-PATCH 改为 admin only。

2. **Service 层强制（CLAUDE.md 后端分层红线）**：所有端点必须经 `SourcesMatrixService.ts` 而非 Route 直接调 `db/queries/sources-matrix.ts`；业务逻辑 `aggregateSignal` 三色规则 + KPI 拼装 + listVideoGroups 复杂条件拼装 + upsertLineAlias 调用 + fire-and-forget audit 全部归口 Service。

   **当前实施偏离（D-117-2）**：CHG-SN-5-11 commit 缺 Service 层文件，Route 直连 queries；由 -11-PATCH 抽出 `apps/api/src/services/SourcesMatrixService.ts`。

3. **响应包络对齐 ADR-110**：
   - 列表 `{ data: VideoGroupRow[], total, page, limit }`
   - 单值 `{ data: VideoGroupStats }` / `{ data: LineMatrixRow[] }` / `{ data: SourceLineAlias[] }` / `{ data: SourceLineAlias }`（PUT 返回新值）
   - 错误信封 `{ error: { code, message, status } }`

4. **错误码全部复用 ADR-110 既有 14 码，零新增**：VALIDATION_ERROR 422 / NOT_FOUND 404（matrix 端点 video 不存在）/ FORBIDDEN 403 / UNAUTHORIZED 401 / INTERNAL_ERROR 500（DB upsert 失败兜底）。

5. **audit log 扩枚举**：`AdminAuditActionType` 增 1 项 `source_line_alias.upsert`；`AdminAuditTargetKind` 增 1 项 `source_line_alias`。targetId 是复合键 `${siteKey}/${sourceName}` 而非 UUID，独立 targetKind 便于 admin_audit_log 反查时按 kind 过滤；与 ADR-104 home_module 新增 targetKind 同源理由。

   - **audit 写入位点**：PUT `/admin/source-line-aliases/:siteKey/:sourceName` upsert 成功后 fire-and-forget `auditSvc.write(...)`（**COMMIT 后**，参 ADR-105 Y-105-5 时序协议）
   - **payload**：`beforeJsonb` = 既有别名行（如 INSERT 则为 null）；`afterJsonb` = 新别名行 `{ sourceSiteKey, sourceName, displayName, updatedAt }`；`targetKind = 'source_line_alias'`；`targetId = ${sourceSiteKey}/${sourceName}`（slash 分隔的复合标识）
   - **READ 端点不写 audit**：4 个读端点零 audit 写入（仅写操作纳入审计）

   **当前实施偏离（D-117-3）**：CHG-SN-5-11 PUT 端点零 audit log 写入 — R-MID-1 模式重现（连续第 4 次）；由 -11-PATCH 落地。

6. **Migration 063 schema 已落地**：`source_line_aliases (source_site_key VARCHAR(100), source_name TEXT, display_name TEXT, updated_by UUID FK users(id) SET NULL, created_at, updated_at) PRIMARY KEY (source_site_key, source_name)` + `idx_source_line_aliases_site_key` 索引。已 commit `e6434abc` + architecture.md §5.13 同步。本 ADR 仅追溯锁定不再修订。

7. **segment 语义统一（D-117-4）**：当前 4 个 segment 在 KPI vs filter 定义不一致（评级 P1-6）。本 ADR 锁定**最终语义**：
   - `grouped`：全部含活跃 source 的 video（默认）
   - `dead`：`v.source_check_status = 'all_dead'`
   - `correction`：含 `submitted_by IS NOT NULL` 的活跃 source（即用户提交 / 纠错源）
   - `orphan`：`v.source_check_status = 'all_dead' AND v.is_published = false`（孤岛 = 失效且未发布）
   - **KPI stats 4 指标**应严格对应 segment 4 定义：total / active=(grouped \\ dead) / dead / orphan（与 segment='orphan' 同 SQL）；当前 `stats.orphan` 用 submitted_by 定义 = correction 语义，**KPI label 同步改为 4 卡：总播放源 / 有效 / 失效 / 孤岛**（删除 KPI 中的"用户纠错"混合表述；用户纠错通过 segment tab 进入而非顶部 KPI）

   **当前实施偏离（D-117-4）**：CHG-SN-5-11 KPI stats.orphan 与 filter segment='orphan' 定义不一致 + KPI label 混合 "孤岛 / 用户纠错"；由 -11-PATCH 落地 ADR 锁定的统一语义。

8. **DataTable 一体化偏离已知（D-117-5）**：CHG-SN-5-11 视频分组 outer 列表用 handrolled CSS grid 表格替代 `packages/admin-ui` `DataTable` 一体化（CLAUDE.md 后端表格段红线）。本 ADR 锁定**最终方案**：
   - outer 视频分组列表**必须使用 DataTable**（toolbar.search + bulkActions + pagination 内置 + row 展开 slot）
   - inner 矩阵展开行（线路×集数）属于 row 展开 slot 自定义渲染，无 DataTable 责任 — 沿用 CHG-SN-5-11 既有 `SourceMatrixRow` 展开实现（可拆 cell 复合组件，但不阻塞 -11-PATCH，可由 CHG-DESIGN-12 cell 沉淀卡承担）
   - 由 -11-PATCH 落地 outer 列表迁移

9. **硬编码颜色红线（D-117-6）**：CHG-SN-5-11 `SourceMatrixRow.tsx` 6 处 `var(--state-*-bg, #hex)` fallback 违反 CLAUDE.md "硬编码颜色值（必须用 CSS 变量）"。本 ADR 锁定：
   - 删全部 hex fallback；确认 design-tokens `--state-success-bg` / `--state-warning-bg` / `--state-error-bg` 已定义（如未定义则补 token，本 ADR 不预决细节，由 -11-PATCH 实施时勘察）
   - 由 -11-PATCH 落地

10. **`<img>` → `next/image`（D-117-10）**：前端文件 `SourceMatrixRow.tsx` 使用原生 `<img>` 加载封面，与 server-next 既有规范（next/image 性能优化 + LCP）不一致；由 -11-PATCH 改为 `import Image from 'next/image'` + 含 width/height/sizes 必填属性。

11. **缓存协议首版不引入**：5 端点全部直接 DB 查询，零 Redis 缓存。**未来触发条件**（任一命中即起 PRE-CACHE-SOURCES 卡）：(a) `GET /admin/sources/video-groups` p95 > 200ms 持续 1 周；(b) DB CPU 因本组端点占比 > 20%；(c) 视频总数 > 100k（聚合 SQL 性能拐点）。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/admin/sources/video-groups` | 视频分组列表 + 聚合信号状态 + 分页 | Query: `page?=1` / `limit?=20` / `keyword?` / `segment?='grouped'` / `siteKey?` / `probeStatus?` / `renderStatus?` | 200 `{ data: VideoGroupRow[], total, page, limit }` | moderator+admin | 422 VALIDATION_ERROR |
| 2 | GET | `/admin/sources/video-groups/stats` | KPI 4 指标 | — | 200 `{ data: { total, active, dead, orphan } }` | moderator+admin | — |
| 3 | GET | `/admin/sources/video-groups/:videoId/matrix` | 单视频线路×集数矩阵（含别名合并） | Path: `videoId: uuid` | 200 `{ data: LineMatrixRow[] }` | moderator+admin | 422 VALIDATION_ERROR（videoId 非 uuid） |
| 4 | GET | `/admin/source-line-aliases` | 全局别名列表（不分页，预期 ≤ 1000 行） | — | 200 `{ data: SourceLineAlias[] }` | moderator+admin | — |
| 5 | PUT | `/admin/source-line-aliases/:siteKey/:sourceName` | upsert 全局别名 + 写 audit | Path: `siteKey` / `sourceName`（URL encoded）；Body: `{ displayName: string(1..100) }` | 200 `{ data: SourceLineAlias }` | **admin only**（D-117-1）| 422 VALIDATION_ERROR / 500 INTERNAL_ERROR（DB upsert 失败） |

**类型契约（packages/types/src/admin-moderation.types.ts 扩展，由 -11-PATCH 落地）**：

```ts
export interface VideoGroupRow {
  readonly videoId: string
  readonly title: string
  readonly shortId: string
  readonly type: string
  readonly year: number | null
  readonly coverUrl: string | null
  readonly lineCount: number
  readonly sourceCount: number
  readonly probeStatus: DualSignalState  // 复用既有 'pending' | 'ok' | 'partial' | 'dead'
  readonly renderStatus: DualSignalState
  readonly updatedAt: string
}

export interface VideoGroupStats {
  readonly total: number
  readonly active: number
  readonly dead: number
  readonly orphan: number
}

export interface EpisodeCell {
  readonly episodeNumber: number
  readonly sourceId: string
  readonly sourceUrl: string
  readonly probeStatus: DualSignalState
  readonly renderStatus: DualSignalState
  readonly isActive: boolean
}

export interface LineMatrixRow {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string | null
  readonly episodes: readonly EpisodeCell[]
}

export interface SourceLineAlias {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string
  readonly updatedAt: string
}

export type SourceSegment = 'grouped' | 'dead' | 'correction' | 'orphan'
// SignalStatus 复用既有 DualSignalState（admin-moderation.types.ts:39，Y-117-3 修订采纳）：
//   'pending' | 'ok' | 'partial' | 'dead'，跨 VideoQueueRow / VideoSourceLine / VideoGroupRow 共享
```

**当前实施偏离（D-117-7）**：CHG-SN-5-11 类型定义在 `apps/server-next/src/lib/sources/types.ts` 内联，而非 `packages/types/src/` 共享；由 -11-PATCH 迁移到 packages/types 统一入口（CLAUDE.md "统一类型入口"）。

**zod request schema（Service 层 + Route 层共享）**：

```ts
const SourceSegmentEnum = z.enum(['grouped', 'dead', 'correction', 'orphan'])

const VideoGroupsQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  keyword:      z.string().max(200).optional(),
  segment:      SourceSegmentEnum.default('grouped'),
  siteKey:      z.string().max(100).optional(),
  probeStatus:  z.string().max(20).optional(),
  renderStatus: z.string().max(20).optional(),
}).strict()  // 协议层 .strict() 拒绝未识别字段（参 ADR-104 Y-MID-1 教训）

const VideoMatrixParamsSchema = z.object({
  videoId: z.string().uuid(),  // D-117-8：替代 CHG-SN-5-11 当前 regex 校验
}).strict()

const UpsertAliasParamsSchema = z.object({
  siteKey:    z.string().min(1).max(100),
  sourceName: z.string().min(1).max(200),
}).strict()

const UpsertAliasBodySchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
}).strict()
```

**当前实施偏离（D-117-8）**：CHG-SN-5-11 `routes/admin/sources-matrix.ts:70` videoId 用手写 regex `^[0-9a-f-]{36}$/i`；由 -11-PATCH 改 `z.string().uuid()` 与同模块 home-modules / video-merges 一致。

### Migration 063 schema（已落地，CHG-SN-5-11 commit `e6434abc`，本 ADR 仅追溯锁定）

```sql
-- 063_source_line_aliases.sql（已 commit，不修改）
CREATE TABLE IF NOT EXISTS source_line_aliases (
  source_site_key VARCHAR(100) NOT NULL,
  source_name     TEXT         NOT NULL,
  display_name    TEXT         NOT NULL,
  updated_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_site_key, source_name)
);

CREATE INDEX IF NOT EXISTS idx_source_line_aliases_site_key
  ON source_line_aliases (source_site_key);
```

**Schema 设计要点**：
- 复合 PK `(source_site_key, source_name)` 严格对齐 ADR-114-NEGATED `video_sources` 复合键约束（**线路标识同源**）
- `updated_by` FK `SET NULL`（用户删除不级联删除别名行，保留历史）
- 索引 `(source_site_key)` 支持按站点过滤的二级查询路径
- 写操作走 `INSERT ... ON CONFLICT (source_site_key, source_name) DO UPDATE`（upsert 模式）

### audit log 协议

**扩枚举**：
- `AdminAuditActionType` 增 `source_line_alias.upsert`（1 项；删除不暴露 API 因此不需扩 `.delete` actionType）
- `AdminAuditTargetKind` 增 `source_line_alias`（1 项；区别于 video / staging / home_module 既有 7 项）

**写入位点 + payload**：

| 端点 | actionType | targetKind | targetId | beforeJsonb | afterJsonb |
|---|---|---|---|---|---|
| PUT `/admin/source-line-aliases/:siteKey/:sourceName` | `source_line_alias.upsert` | `source_line_alias` | `${sourceSiteKey}/${sourceName}` | 既有 `SourceLineAlias` 行（INSERT 路径为 null）| 新 `SourceLineAlias` 行 |

**fire-and-forget 模式**（CHG-SN-4-05）：
- Service 层 upsert 成功后写 audit；写失败 log warn 不阻塞主操作
- 时序：DB upsert COMMIT 之后 → `auditSvc.write(...)` 不 await
- **单 SQL implicit commit 说明（A-117-1）**：`upsertLineAlias` 走单条 `INSERT ... ON CONFLICT DO UPDATE` autocommit，无需显式 `BEGIN/COMMIT` 事务块；如未来扩需多表事务（如 audit 表 + 别名表跨表更新），切换 ADR-105 显式 `client.connect()` + `BEGIN/COMMIT` 范式（参 ADR-105 §audit log 协议 Service 层模式代码）
- Service 层模式（参 ADR-105 Y-105-5）：

```ts
// SourcesMatrixService.upsertLineAlias (由 -11-PATCH 落地)
async upsertLineAlias(params: UpsertAliasParams, actorId: string): Promise<SourceLineAlias> {
  const before = await this.fetchExistingAlias(params.sourceSiteKey, params.sourceName)
  const after  = await upsertLineAliasQuery(this.db, params, actorId)  // DB COMMIT 内部完成
  // COMMIT 后才写 audit（防 ROLLBACK 虚假记录）
  this.auditSvc.write({
    actorId,
    actionType: 'source_line_alias.upsert',
    targetKind: 'source_line_alias',
    targetId: `${params.sourceSiteKey}/${params.sourceName}`,
    beforeJsonb: before,
    afterJsonb: after,
  })
  return after
}
```

**audit-log-coverage 守卫**：tests/unit/api/audit-log-coverage.test.ts `REQUIRED_ACTION_TYPES` 从 19 → 20（由 -11-PATCH 同步扩）。

### 错误码

复用 ADR-110 既有 14 码，零新增：

| 场景 | code | status |
|---|---|---|
| zod schema 失败 / videoId 非 uuid / displayName 超长或空 | VALIDATION_ERROR | 422 |
| matrix 端点 video 不存在（可选实施：当前 commit 未校验，返回空数组）| NOT_FOUND | 404 |
| 非 admin role 调 PUT | FORBIDDEN | 403 |
| 未登录 | UNAUTHORIZED | 401 |
| DB upsert 异常 | INTERNAL_ERROR | 500 |

**message 模板**：

| 场景 | message 模板 |
|---|---|
| zod 字段失败 | zod 默认 issue message（或自定义如 `'别名不能为空' / '别名过长'`） |
| videoId 非 uuid | `'videoId 格式无效'` |
| displayName 空 | `'别名不能为空'` |
| displayName 超长 | `'别名过长'` |
| DB upsert 异常 | `'服务器内部错误'` |

**当前实施偏离（D-117-9）**：matrix 端点 video 不存在场景当前返回 200 + 空数组；本 ADR 锁定为 `404 NOT_FOUND`（与 home-modules / video-merges 模式一致），由 -11-PATCH 落地（Service 层 `fetchVideosByIds([videoId])` 前置校验存在性）。

### 备选方案

**A. Service 层 vs Route 直连 queries**：
- ✗ 方案 1：Route 直连 queries（CHG-SN-5-11 当前实施）— 简单但违反 CLAUDE.md 后端分层红线；业务逻辑（aggregateSignal / KPI 拼装）混在 queries 层
- ✅ **方案 2（采纳）**：强制 Service 层 + Route 仅 zod parse + 异常映射 — 与 home-modules / video-merges 一致，业务逻辑归口，便于 unit test 测 Service 而非 DB mock

**B. 单表 `source_line_aliases` vs site 拆表**：
- ✗ 方案 1：每站点独立别名表（`source_line_aliases_<site_key>`）— 表数膨胀，跨站查询需 UNION，运维负担高
- ✅ **方案 2（采纳）**：单表复合 PK `(source_site_key, source_name)` — 与 video_sources 复合键同源，跨站查询直接，索引 `(source_site_key)` 覆盖按站点过滤

**C. PUT vs POST 写端点**：
- ✗ 方案 1：POST `/admin/source-line-aliases` body `{ siteKey, sourceName, displayName }` — RESTful 语义偏弱（无幂等）
- ✅ **方案 2（采纳）**：PUT `/admin/source-line-aliases/:siteKey/:sourceName` body `{ displayName }` — 幂等 + 路径含完整资源标识（运营 URL 可分享）+ upsert 语义清晰

**D. DataTable 一体化 vs handrolled 表格**：
- ✗ 方案 1：handrolled CSS grid 表格（CHG-SN-5-11 当前实施）— 违反 CLAUDE.md "后台表格"段；样式 / 排序 / 分页 / 选择全部手撸 + 复用率为 0
- ✅ **方案 2（采纳）**：`packages/admin-ui` DataTable 一体化 outer 列表 + row 展开 slot 自定义 matrix 渲染 — 复用 toolbar/pagination/selection + 矩阵展开作为 cell 复合组件未来沉淀点（CHG-DESIGN-12）

### 后果

**正面**：
1. CHG-SN-5-11-PATCH 卡按本 ADR §端点契约 + §audit log 协议 + §决策要点 D-117-1..9 偏离清单逐条落地，零设计自由度
2. `/admin/sources` 与 `/admin/home` / `/admin/merge` 协议范式一致（鉴权 / Service 层 / audit / 错误码 / DataTable）— 视图卡复用率最大化
3. 错误码零新增 + audit 类型有限扩枚举（1 项）+ 单表设计 — 与 plan §10 "新增端点不得修改邻近现有端点（隔离原则）" 一致
4. 复合键 PK 设计 100% 兼容 ADR-114-NEGATED 复合键约束 — 跨站不合并语义在别名表层延续
5. 追溯起草 + 偏离显式清单 → CHG-SN-5-13 milestone 审计有明确清单可勾对

**负面 / 风险**：
1. **R-ADR-117-1 — 追溯起草滞后偏离**：CHG-SN-5-11 commit `e6434abc` 已落地代码与本 ADR §端点契约存在 9 项偏离（D-117-1..9），需 -11-PATCH 卡承担全部代码改造。**缓解**：本 ADR §决策要点逐项标注当前偏离 + -11-PATCH 卡范围明确含 6 项 P0/P1 + 3 项 D 编号偏离修复
2. **R-ADR-117-2 — 别名表无 TTL / 软删除**：`source_line_aliases` 表无 deleted_at 字段，删除走硬删除（当前未暴露删除 API，未来扩展时需起 PRE-ALIAS-SOFT-DELETE 卡决策）。**缓解**：当前 API 不含 DELETE 端点；未来如需删除别名 → 触发 PRE-ALIAS-SOFT-DELETE 卡
3. **R-ADR-117-3 — KPI stats SQL 性能**：`getVideoGroupStats` 全表 4 FILTER 子查询 + 嵌套 EXISTS — 视频总数 > 100k 时 p95 可能超 200ms（决策要点 10 触发条件 c）。**缓解**：首版接受；触发条件命中起 PRE-CACHE-SOURCES 卡引入 Redis 缓存（5 分钟 TTL 足够 KPI 场景）
4. **R-ADR-117-4 — listVideoGroups SQL 动态拼装注入面**：当前 `idx` 索引计数手动维护拼参数化 SQL（`db/queries/sources-matrix.ts:166-225`），增删 segment / 过滤条件时易出现 idx 错位。**缓解**：-11-PATCH Service 层抽出后用 SQL builder 库（如 knex 子集 / drizzle-orm 子集）替代，或加单测覆盖每种 segment × 过滤组合（参 audit-log-coverage 守卫模式）

### 验证

**起草卡（CHG-SN-5-11-ADR）完成判据**：
- arch-reviewer Opus PASS（≤ 3 轮 CONDITIONAL 闭环；REJECT = BLOCKER §5.2）
- 落 `docs/decisions.md` ADR-117 章节完整（9 节）
- plan §9 ADR 索引推进 ADR-117 状态 Candidate → Accepted

**PATCH 卡（CHG-SN-5-11-PATCH）落地判据**：
- 9 项 D 编号偏离（D-117-1..9）全部修复
- 6 项 P0/P1 评审缺陷（P0-2 Service 层 / P0-3 硬编码色 / P0-4 audit log / P1-5 DataTable / P1-7 img / P1-8 zod uuid）+ P1-6 segment 语义统一全部落地
- `apps/api/src/services/SourcesMatrixService.ts` 新建
- `packages/types/src/admin-moderation.types.ts` 扩 `source_line_alias.upsert` + `source_line_alias` targetKind
- `audit-log-coverage.test.ts` 守卫从 19 → 20
- Service 单测覆盖 5 端点 happy path + audit payload 内容断言（参 R-MID-1 教训）+ segment 4 路径 SQL
- ADR-117 §端点契约 / §audit log 协议 100% 对齐

**未来视图扩展（CHG-SN-5-12 `/admin/merge` 视图）**：
- 不依赖本 ADR；但 `SourcesMatrixService` 中的 `aggregateSignal` 三色逻辑可被复用

### 关联

- **关联 ADR**：ADR-103（DataTable v2 公开 API 契约 — 决策要点 8 outer 列表消费）/ ADR-104（home_modules 协议同模式 — 鉴权 / Service / audit / 错误码 / response 信封）/ ADR-105（merge 协议同模式 — audit 双层时序 / fire-and-forget）/ ADR-110（ApiResponse 信封 + ErrorCode 真源）/ ADR-114-NEGATED（复合键约束，本 ADR 别名表 PK 同源）/ ADR-100（依赖白名单，本 ADR 零新依赖）
- **关联 plan §**：§4.5 ADR-端点先后协议（本 ADR 是 CHG-SN-5-11 追溯合规，§4.5 R7 MUST-8 硬约束）/ §6 M-SN-5 推荐 4（/admin/sources 视图）/ §9 ADR 索引 ADR-117 / §10 风险段（KPI SQL 性能）
- **关联 task-queue**：SEQ-20260512-02 子卡 CHG-SN-5-11（已 commit `e6434abc` 触发本 ADR 追溯需求）→ CHG-SN-5-11-ADR（本卡）→ CHG-SN-5-11-PATCH（架构清债，依赖本 ADR PASS）→ CHG-SN-5-CHECKLIST-AUDIT（机制设计，独立并行）→ CHG-SN-5-12（`/admin/merge` 视图）
- **关联代码（已落地，本 ADR 追溯锁定）**：
  - `apps/api/src/db/migrations/063_source_line_aliases.sql`
  - `apps/api/src/db/queries/sources-matrix.ts`（348 行；含 `aggregateSignal` — 由 -11-PATCH 迁移到 Service 层）
  - `apps/api/src/routes/admin/sources-matrix.ts`（110 行；由 -11-PATCH 改为调 Service）
  - `apps/server-next/src/app/admin/sources/_client/{SourcesClient,SourceMatrixRow,SourceLineAliasPanel}.tsx`（前端；由 -11-PATCH 改为 DataTable 一体化 + 删硬编码色 + img→Image）
  - `tests/unit/api/sources-matrix.test.ts`（15 单测；由 -11-PATCH 扩 Service 层测试 + audit payload 断言）
  - `docs/architecture.md` §5.13（schema 已同步）
- **关联代码（本 ADR 触发新增，由 -11-PATCH 落地）**：
  - `apps/api/src/services/SourcesMatrixService.ts`（Service 层抽出）
  - `packages/types/src/admin-moderation.types.ts`（扩 actionType + targetKind + 视频分组/矩阵类型迁移到共享层）
- **ADR 引用追溯说明（A-117-2）**：`apps/api/src/db/migrations/063_source_line_aliases.sql:5` 头部仅引用 `ADR-114-NEGATED`（commit 时本 ADR-117 不存在）；migration 文件一旦应用不得修改，引用保留原状；本 ADR 起草后**新建 / 改动文件头部 ADR 引用行写**：`ADR-117（admin API 协议追溯） + ADR-114-NEGATED（复合键约束）`，由 -11-PATCH 实施时统一落地
- **关联触发条件（未来）**：
  - PRE-CACHE-SOURCES（KPI 缓存层）：决策要点 10 三条触发条件任一命中
  - PRE-ALIAS-SOFT-DELETE（别名软删除）：R-ADR-117-2 删除需求命中

---

### ADR-105 AMENDMENT 2026-05-14（CHG-SN-6-AUDIT-TIMELINE / RETRO 4/7）— GET audit timeline 端点

**触发**：CHG-SN-5-12 范围声明含"audit timeline"但 ADR-105 §端点契约原 4 端点无 GET audit → CHECKLIST-AUDIT 拦截 + 用户裁定路径 A 缩范围 + 转 M-SN-6 RETRO 占位（参 changelog CHG-SN-5-12 + M-SN-6 SEQ）。

**范围**：扩 §端点契约 row 5（GET `/admin/video-merges/audit`），复用 ADR-105 既有协议层（鉴权 / 错误码 / response 信封），**零新协议决策**。

**端点契约（row 5 完整规格）**：

- **方法 / 路径**：`GET /admin/video-merges/audit`
- **鉴权**：`requireRole(['admin'])`（与 row 2-4 mutation 端点一致；audit 含敏感写历史）
- **Query**：
  - `action?: 'merge' | 'split'`（可选过滤；默认全部）
  - `videoId?: string (uuid)`（可选过滤；GIN 索引 source_video_ids / target_video_ids 覆盖）
  - `limit?: number(1..100, default 20)`
  - `page?: number(>=1, default 1)`
- **Response**：`200 { data: MergeAuditRow[], total, page, limit }`
- **错误码**：`422 VALIDATION_ERROR`（zod 失败）/ `401 UNAUTHORIZED` / `403 FORBIDDEN`（既有 ADR-110 复用）

**MergeAuditRow 类型契约**（packages/types/src/video-merge.types.ts，复用 `VideoMergeAuditRow` 既有定义；端点返回 camelCase 转换层）：

```ts
export interface MergeAuditRow {
  readonly id: string
  readonly action: 'merge' | 'split'
  readonly sourceVideoIds: readonly string[]
  readonly targetVideoIds: readonly string[]
  readonly performedBy: string
  readonly performedByUsername: string | null  // LEFT JOIN users.username
  readonly reason: string | null
  readonly performedAt: string
  readonly revertedAt: string | null
  readonly revertedBy: string | null
  readonly revertedReason: string | null
}
```

**zod request schema**：

```ts
const ListAuditSchema = z.object({
  action: z.enum(['merge', 'split']).optional(),
  videoId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  page: z.coerce.number().int().min(1).default(1),
}).strict()
```

**SQL 设计**（DB queries 层）：

```sql
SELECT
  vma.id, vma.action, vma.source_video_ids, vma.target_video_ids,
  vma.performed_by, u.username AS performed_by_username,
  vma.reason, vma.performed_at::text, vma.reverted_at::text,
  vma.reverted_by, vma.reverted_reason
FROM video_merge_audit vma
LEFT JOIN users u ON u.id = vma.performed_by
WHERE ($1::text IS NULL OR vma.action = $1)
  AND ($2::uuid IS NULL OR $2 = ANY(vma.source_video_ids) OR $2 = ANY(vma.target_video_ids))
ORDER BY vma.performed_at DESC
LIMIT $3 OFFSET $4
```

- `videoId` 过滤通过 `= ANY(source_video_ids)` / `= ANY(target_video_ids)` 走 GIN 索引（migration 062 line 39/42 已建）
- ORDER BY performed_at DESC 取最新；分页 LIMIT/OFFSET
- `LEFT JOIN users` 取 username（不影响主路径性能；audit ≤ 1k 行预期）

**audit log 协议**：

- **本端点为只读 GET**：不写 admin_audit_log（避免"看 audit 列表本身也写 audit"无限叠加）
- 与 row 2-4 写端点（merge/unmerge/split）的 admin_audit_log fire-and-forget 写入不冲突

**性能 + 缓存**：

- 无缓存（audit 数据小 + 写读比 1:N）；GIN 索引 + ORDER BY performed_at DESC 性能可承诺 p95 ≤ 100ms / N ≤ 1k
- 未来 audit 行 > 10k → 起 PRE-AUDIT-CACHE 卡引入 Redis 5min TTL

**Service 层 / DB queries / 视图实施分卡**：

- **CHG-SN-6-AUDIT-TIMELINE-A**（端点实施）：apps/api Service / Route / queries / 单测 / 集成测试 / packages/types `MergeAuditRow` 扩
- **CHG-SN-6-AUDIT-TIMELINE-B**（视图扩展）：apps/server-next /admin/merge 加 audit timeline tab 或独立 section 消费本端点
- 本 AMENDMENT 仅 ADR 协议层；不写代码

**关联**：
- ADR-105 §决策要点 5 audit log 协议（既有 fire-and-forget 模式不变）
- migration 062 video_merge_audit schema（GIN 索引利用）
- CHG-SN-5-12 缩范围转入本 RETRO（参 changelog CHG-SN-5-12 §CHECKLIST-AUDIT 拦截）
- plan §4.5 同 ADR 多端点复用范式（AMENDMENT 优于新起 ADR-118）

**关键发现**：本 AMENDMENT 验证 plan §4.5 "同一 ADR 下多个端点复用同一 ADR，不重复评审"机制；CHG-SN-6-AUDIT-TIMELINE 工时从规划 0.4w（ADR-118 起草 + Opus 评审 + 端点 + 视图三段式）降至 0.2w（AMENDMENT + 端点 + 视图两段式），节省 0.2w。


---

## ADR-118：/admin/audit 全局审计日志视图 admin API 协议（CHG-SN-6-01）

- **日期**：2026-05-15
- **状态**：Accepted（主循环 sonnet 采纳 arch-reviewer Opus 单轮 PASS 起草版；本 ADR 由 claude-opus-4-7 子代理起草，主循环 claude-opus-4-7 采纳落盘）
- **决策者**：主循环 claude-opus-4-7（延续会话；建议 sonnet）/ arch-reviewer (claude-opus-4-7) — 1 轮 PASS
- **关联**：ADR-109（admin_audit_log schema 前置补建，本 ADR 消费侧）/ ADR-110（ApiResponse 信封 + ErrorCode 关闭真源，错误码零新增依据）/ ADR-105 AMENDMENT 2026-05-14（video_merge_audit `/admin/video-merges/audit` 端点 — 独立事件源，**本 ADR 不消费 merge audit**）/ ADR-117（sources-matrix 端点契约风格，camelCase + 信封 + idx 拼装风格对称参考）/ ADR-104（home_modules 协议同模式）/ CHG-SN-4-05（AuditLogService fire-and-forget 写入位点）/ plan v1.4 §3.0.5（action_type 写入位点真源表）/ plan §4.5 R7 MUST-8（ADR-端点先后协议）
- **对应交付**：SEQ-20260513-M-SN-6 / M-SN-6 首张视图卡 CHG-SN-6-01（`/admin/audit` 全局审计日志视图）

### 背景

M-SN-6 admin IA v0 §系统管理组首张视图卡，需要将 `admin_audit_log` 表（ADR-109 落地 / 052 migration / M-SN-4 起所有 admin 写端点已挂 `insertAuditLog` fire-and-forget 写入）暴露为只读全局审计视图，覆盖以下能力：

- **跨 target 全局浏览**：现有 `listAuditLogByTarget(targetKind, targetId, ...)` 仅服务审核台 RightPane.History（已知 target 反查），不支持跨视频/跨线路的运营审计全景。
- **运维事故定位**：按 `actorId` / `actionType` / 时间窗 / `requestId` 多维筛选回溯异常突发（plan §3.0.5 写入位点表覆盖 20 个 action_type）。
- **batch action 解析**：`target_id IS NULL` 行（如 `staging.batch_publish` / `video_source.disable_dead_batch`）在 `before/after_jsonb` 携带 ids 数组，列表 UI 需展示"影响 N 个对象"摘要。

**为何独立 ADR 而非沿用 ADR-105 协议**：
- `video_merge_audit`（ADR-105 / migration 062）是**独立事件源**，含 `snapshot_jsonb` + `reverted_at` + auto-incrementing audit id，专为 merge 撤销窗口设计，已有自己的 `/admin/video-merges/audit` 端点（ADR-105 AMENDMENT 2026-05-14）。
- `admin_audit_log`（migration 052）是**通用写操作流水**，schema 形态、索引策略、消费场景完全不同（无撤销窗口 / 多 action_type 枚举 / batch ids 协议）。
- 两源解耦后，未来 timeline 合并视图（如某 video 详情页"完整审计轴"）由 view 层拼装两源，不在 backend 协议层耦合。

**plan §4.5 R7 MUST-8 触发**：新增 admin route（`apps/api/src/routes/admin/audit.ts`）必须先起独立 ADR + Opus PASS 才能起实施卡（`npm run verify:endpoint-adr` 自动核验）。

### 决策要点

**D-118-1 端点集合最小化（3 端点 MVP）**：
- `GET /admin/audit/logs` — 列表（多维筛选 + 分页）
- `GET /admin/audit/logs/:id` — 单条详情（携带完整 before/after_jsonb，列表行裁剪）
- `GET /admin/audit/enums` — 一次性返回 `actionTypes` + `targetKinds` 枚举（由 `@resovo/types` 反射，不查 DB）
- **不含 stats** 端点（详见替代方案 A）
- **不含 GIN 全文 `q`** 参数（详见替代方案 B）

**D-118-2 列表行 payload 裁剪策略**：
- 列表端点返回 `AdminAuditLogListRow`：含 `id` / `actorId` / `actorUsername` / `actionType` / `targetKind` / `targetId` / `requestId` / `createdAt` + **`payloadSummary`**（Service 层从 before/after_jsonb 提取摘要，最大 256 字符），**不带完整 `beforeJsonb` / `afterJsonb`**。
- 详情端点返回 `AdminAuditLogDetail`：含全部列表字段 + 完整 `beforeJsonb` / `afterJsonb` + `ipHash`。
- **理由**：list payload 控制在 KB 级以下避免 100 行 × 多 KB jsonb 撑爆响应；详情按需获取（UI 点击行展开抽屉）。

**D-118-3 列表查询参数集（MVP）**：
- `page?` (default 1) / `limit?` (default 20, max 100)
- `actorId?` (UUID，单选)
- `actionType?` (AdminAuditActionType 枚举，单选)
- `targetKind?` (AdminAuditTargetKind 枚举，单选)
- `targetId?` (UUID，配合 `targetKind` 联用，单独传 422)
- `requestId?` (TEXT，精确匹配，命中部分索引 idx_admin_audit_log_request_id)
- `from?` / `to?` (ISO 8601 timestamptz，闭区间)

不含：`q` 全文 / `actorIds[]` 数组多选 / `actionTypes[]` 数组多选（详见替代方案 B / E）。

**D-118-4 索引匹配契约**：
- 单 `actorId` → idx_admin_audit_log_actor_created（覆盖）
- 单 `actionType` → idx_admin_audit_log_action_created（覆盖）
- `targetKind + targetId` → idx_admin_audit_log_target（覆盖；与 `listAuditLogByTarget` 同索引复用）
- `requestId` → idx_admin_audit_log_request_id 部分索引（覆盖）
- 多维交叉（如 actorId + actionType + from/to）→ 选择性最高的索引（actor_created 一般胜出）+ filter；planner 自决，不强制 hint
- **COUNT(\*) 与列表同筛选条件**：MVP 走 exact count（多维交叉极端场景 p95 可能超 200ms → 后续触发 PRE-AUDIT-APPROX-COUNT 卡降级 approximate count，见后果段 R-ADR-118-2）

**D-118-5 listAdminAuditLog query 与 listAuditLogByTarget 关系**：
- **新增** `listAdminAuditLog(db, filters)` 独立函数，**不复用 / 不重写** `listAuditLogByTarget`。
- 理由：`listAuditLogByTarget` 强约束 `(targetKind, targetId)` 必填 + 索引选择确定；`listAdminAuditLog` 全可选 + 动态 WHERE/idx 拼装风格不同（参 ADR-117 sources-matrix 同款模式），强制合并会引入 8+ 分支判断违反单一职责。
- 两函数 row 类型 `AdminAuditLogQueryRow` **复用**（已在 `auditLog.ts` 导出，camelCase 对齐）。
- `listAuditLogByTarget` 维持不变（审核台 RightPane.History 在用，零回归风险）。

**D-118-6 字段命名与 camelCase 一致性**：
- 沿用现有 `AdminAuditLogQueryRow` 字段命名（PG 双引号 alias 保留大小写）：`id` / `actorId` / `actorUsername` / `actionType` / `targetKind` / `targetId` / `beforeJsonb` / `afterJsonb` / `requestId` / `createdAt`。
- 新增 `ipHash` (string | null，仅详情端点) / `payloadSummary` (string | null，仅列表端点)。
- query params **全部 camelCase**（与 ADR-105 / ADR-117 / ADR-104 对称）：`actorId` 非 `actor_id`，`actionType` 非 `action_type`。

**D-118-7 ApiResponse 信封形状（对齐 ADR-110）**：
- 列表：`{ data: AdminAuditLogListRow[], total: number, page: number, limit: number }`
- 详情：`{ data: AdminAuditLogDetail }`
- enums：`{ data: { actionTypes: AdminAuditActionType[], targetKinds: AdminAuditTargetKind[] } }`
- 错误：`{ error: { code: ErrorCode, message: string, status: number } }`（ADR-110 `ApiErrorBody`）

**D-118-8 ErrorCode 零新增（对齐 ADR-110 关闭真源）**：
- `VALIDATION_ERROR` 422 — query 参数 zod 失败（`targetId` 无 `targetKind` 配套 / `from > to` / UUID 格式错 / limit > 100）
- `NOT_FOUND` 404 — 详情端点 id 不存在
- `UNAUTHORIZED` 401 / `FORBIDDEN` 403 — adminOnly middleware 兜底
- **不新增** `AUDIT_LOG_RETENTION_EXCEEDED` 等业务专属码（YAGNI；冷归档未来需求触发时另起 ADR）

**D-118-9 Service 层 actorUsername JOIN 归属**：
- `LEFT JOIN users u ON u.id = al.actor_id` 在 **query 层**（与 `listAuditLogByTarget` 同模式，PG 端一次 JOIN 优于应用层 N+1）。
- Service 层职责：zod 校验 + payloadSummary 提取（从 jsonb 抽 1-3 个关键字段 + batch ids count）+ 信封包装。
- Route 层职责：参数解析 + adminOnly 中间件 + Service 调用 + `reply.send`，**零业务逻辑**。

**D-118-10 batch action（targetId NULL）协议**：
- 列表行 `targetId: null` 时，`payloadSummary` 由 Service 层从 `afterJsonb.ids` 或 `beforeJsonb.ids` 数组提取 — 形式："批量 N 项 (action_type)"，UI 渲染时不展开 ids 数组（避免长列表撑爆 cell）。
- 详情端点完整返回 jsonb，前端可在抽屉内展开 ids 数组（虚拟列表 / clipboard 复制）。
- **未来扩展占位**（YAGNI）：`GET /admin/audit/logs/:id/targets` 解析 ids 数组对应的 target 当前状态 — 当前不实现，UI 内 ids 可点击跳转到 video/staging 详情即可。

### 端点契约

| # | Method | Path | Req | Resp 200 | ErrorCodes | Auth |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/audit/logs` | Query: `page?=1` / `limit?=20`(max 100) / `actorId?` / `actionType?` / `targetKind?` / `targetId?` / `requestId?` / `from?` / `to?` | `{ data: AdminAuditLogListRow[], total, page, limit }` | 422 VALIDATION_ERROR / 401 UNAUTHORIZED / 403 FORBIDDEN | adminOnly |
| 2 | GET | `/admin/audit/logs/:id` | Path: `id` (bigserial string) | `{ data: AdminAuditLogDetail }` | 404 NOT_FOUND / 422 VALIDATION_ERROR / 401 / 403 | adminOnly |
| 3 | GET | `/admin/audit/enums` | — | `{ data: { actionTypes: AdminAuditActionType[], targetKinds: AdminAuditTargetKind[] } }` | 401 / 403 | adminOnly |

**类型补充**（落 `packages/types/src/admin-audit.types.ts` 新文件，从 admin-moderation.types.ts 不外迁，仅新增）：

```ts
export interface AdminAuditLogListRow {
  readonly id: string
  readonly actorId: string
  readonly actorUsername: string | null
  readonly actionType: AdminAuditActionType
  readonly targetKind: AdminAuditTargetKind
  readonly targetId: string | null
  readonly requestId: string | null
  readonly createdAt: string
  readonly payloadSummary: string | null  // Service 层提取，最长 256 字符
}

export interface AdminAuditLogDetail extends AdminAuditLogListRow {
  readonly beforeJsonb: Readonly<Record<string, unknown>> | null
  readonly afterJsonb: Readonly<Record<string, unknown>> | null
  readonly ipHash: string | null
}
```

### Service / queries 边界

**Route 层** (`apps/api/src/routes/admin/audit.ts`)：
- 注册 3 个 fastify GET 路由 + adminOnly preHandler
- zod schema 解析 query / params（schema 真源 `apps/api/src/schemas/admin-audit.ts`）
- 调用 Service 方法 → `reply.send` ApiResponse 信封
- **零 DB 查询 / 零业务字段提取**

**Service 层** (`apps/api/src/services/auditLogService.ts` — 已存在 `writeAudit` fire-and-forget，**新增** read 方法)：
- `listAdminAuditLogs(filters): Promise<{ rows: AdminAuditLogListRow[], total }>` — 调用 query 层 + 提取 `payloadSummary`（最长 256 字符，截断尾部加 `…`）
- `getAdminAuditLogDetail(id): Promise<AdminAuditLogDetail | null>` — 调用 query 层 + 直接透传 jsonb
- `getAdminAuditEnums(): { actionTypes, targetKinds }` — 静态返回 `@resovo/types` 导出的两个 union 枚举（编译时反射，零 DB 调用）

**DB queries 层** (`apps/api/src/db/queries/auditLog.ts` — 已存在 `insertAuditLog` / `listAuditLogByTarget`，**新增** 2 方法)：
- `listAdminAuditLog(db, filters): Promise<{ rows: AdminAuditLogQueryRow[], total }>` — 动态 WHERE 拼装（参 ADR-117 sources-matrix `idx` 计数模式），LEFT JOIN users 取 actorUsername，COUNT(\*) 同筛选并行
- `getAdminAuditLogById(db, id): Promise<AdminAuditLogQueryRow | null>` — 单条 PK 查询 + LEFT JOIN users

**SQL 注入面缓解**（呼应 R-ADR-117-4）：
- `listAdminAuditLog` 动态 WHERE 拼装采用**参数化数组 push 模式**，索引由 `params.length` 自动得出，禁止手动维护 `idx` 计数（避免 ADR-117 同款 idx 错位风险）。
- 集成测试覆盖每种单维 / 双维 / 三维 filter 组合（≥ 6 用例）。

### 字段命名与 ApiResponse 形状

| 维度 | 决策 | 依据 |
|---|---|---|
| 字段命名 | camelCase（`actorId` / `actionType` / `targetKind` / `payloadSummary`） | 与 `AdminAuditLogQueryRow` 既有命名一致 + ADR-105 / ADR-117 对称 |
| Query 参数命名 | camelCase（`actorId` 非 `actor_id`） | ADR-110 信封 + ADR-105 / ADR-117 对称 |
| 列表信封 | `{ data: Row[], total, page, limit }` | ADR-110 形状 + ADR-104/-105/-117 对称 |
| 详情信封 | `{ data: Detail }` | ADR-110 形状 |
| 错误信封 | `{ error: { code, message, status } }` | ADR-110 `ApiErrorBody` |
| id 类型 | `string`（bigserial → text） | 现有 `AdminAuditLogQueryRow` 已 `id::text`，避免 JS 大数精度 |
| 时间格式 | ISO 8601 字符串（`createdAt` / `from` / `to`） | ADR-110 默认序列化 |
| jsonb readonly | `Readonly<Record<string, unknown>>` | 与 `AdminAuditLog` 既有定义对齐 |

### 验证段

**起草卡（CHG-SN-6-01-ADR，本 ADR 落地卡）完成判据**：
- arch-reviewer Opus PASS（≤ 3 轮 CONDITIONAL 闭环；REJECT = BLOCKER §5.2）— ✅ 1 轮 PASS（2026-05-15）
- 落 `docs/decisions.md` ADR-118 章节完整（10 节）— ✅
- plan §9 ADR 索引推进 ADR-118 状态 Candidate → Accepted（主循环采纳后）— ✅

**实施卡（CHG-SN-6-01，端点 + 视图）完成判据**（M-SN-6 RETRO 6/7 沉淀的 5 项硬清单逐项勾对）：

1. **视图测试 ≥ 9 用例 / 视图卡**（quality-gates §7 第 1 项）：
   - 视图层（apps/server-next）≥ 9 用例：列表渲染 / 空态 / 错误态 / 单维筛选（actor）/ 多维筛选 / 详情抽屉 / batch 行摘要 / 分页 / 时间窗筛选
   - **不可豁免**，未达 9 用例 → BLOCKER

2. **共享原语占比 ≥ 80%**（quality-gates §7 第 2 项）：
   - 表格使用 `packages/admin-ui` 一体化 DataTable（含 toolbar / pagination / filter chips）
   - 抽屉使用 admin-ui Drawer / 时间选择使用 admin-ui DateRangePicker
   - 列 cell 复合组件（actor cell / action type cell / target cell）优先复用 CHG-DESIGN-12 沉淀
   - 视图本地 primitive 占比 ≤ 20%，超额触发"是否应沉淀"评估

3. **R-MID-1 audit payload 内容断言**（quality-gates §7 第 3 项）：
   - **标记 N/A**（不适用） — 本视图为**只读**端点（GET only），不产生新 audit 写入；视图本身不触发 `insertAuditLog`，故 audit payload 断言无对象。
   - **替代守卫**：集成测试断言 `listAdminAuditLog` 对已有 audit 行（M-SN-4 / M-SN-5 写端点产生）的读取**完整透传** before/after_jsonb 字段（非裁剪 / 非脏数据），覆盖至少 3 种 target_kind × 3 种 action_type。

4. **schema 三层防护**（quality-gates §7 第 4 项）：
   - DB 层：052 migration CHECK 约束 + 4 索引已就位（无新增 migration）
   - Query 层：`AdminAuditLogQueryRow` 显式 camelCase alias + `id::text` 转换
   - Service 层：zod schema 校验 query params + ApiResponse 信封定型 + payloadSummary 长度截断守卫
   - Integration test 真实 PG 覆盖 ≥ 6 用例（每种单维/双维筛选 + 详情 + enums）

5. **PATCH 卡范围 ≤ 5 项**（M-SN-5 数据观察 / CLAUDE.md 绝对禁止项）：
   - 本卡为新增视图卡（非 PATCH），不直接适用
   - **派生约束**：实施卡内 file scope ≤ 12 文件（route 1 + service 1 + query 2 + types 1 + schema 1 + view 1 + 4 cell components + 1 test）；超额拆 `-A/-B` 子卡

**测试覆盖最低标准**：
- 单元测试 ≥ 12 用例（视图 9 + service 3）
- Integration test 真实 PG ≥ 6 用例（每种 filter 组合 + 详情 NOT_FOUND + adminOnly 拒绝）
- typecheck / lint / `npm run verify:adr-contracts` / `npm run verify:endpoint-adr` 全绿
- p95 延迟基线：单维 filter ≤ 100ms / 多维交叉 ≤ 300ms（PG localhost）

### 替代方案（已否决）

**A. MVP 含 stats 端点**（`GET /admin/audit/stats` 按 action_type / actor / 时段聚合）
- ❌ **否决理由**：admin IA v0 §系统管理组未列 stats 需求；当前 4 索引足以支撑明细回溯，stats 是次级派生视图。聚合查询（GROUP BY action_type WHERE created_at BETWEEN ...）在 1M+ 行时 p95 易超 1s，需独立性能评估 + 物化视图设计。
- **未来触发**：admin 用户提需求"看一周内谁操作最多 / 哪个 action_type 异常"时 → 起 ADR-118a 引入 stats 端点 + 物化视图（每小时刷新）。

**B. MVP 含 GIN 全文 `q` 检索**（before/after_jsonb 全文匹配）
- ❌ **否决理由**：
  - 需新增 migration 069（CREATE INDEX ... USING gin (before_jsonb jsonb_path_ops) + after_jsonb 同款）— 跨边界改动违反"先 ADR 再 schema"惯例；
  - jsonb GIN 索引写放大显著（每次 admin 写操作 audit insert 触发 GIN 维护），影响 fire-and-forget 性能契约（CHG-SN-4-05 写入位点表 20 个 action_type 高频写入）；
  - 视图本身已提供 7 维 filter（actor/action/target/request/time），运维场景 90% 命中索引精确查询，全文是低优先级补足。
- **未来触发**：审计回溯命中"知道某关键词但不知道哪个字段"的高频场景 → 起 ADR-118b 引入 GIN + 评估写放大基线。

**C. 列表行携带完整 before/after_jsonb（无详情端点）**
- ❌ **否决理由**：100 行 × 平均 2KB jsonb = 200KB+ 响应，N+1 batch action 行可能 > 1MB；移动端 / 弱网络下不可接受。详情端点点击展开是标准模式（ADR-105 video_merge_audit 同款 snapshot_jsonb 也走详情拆分）。

**D. enums 走前端硬编码 `@resovo/types` 直接 import**
- ⚠️ **部分采纳**：类型层确实由 `@resovo/types` 反射（编译时确定）；但**额外提供** `/admin/audit/enums` 端点是因为前端可能动态需要 i18n 显示名（未来 `actionTypeLabel` 映射放后端 + i18n 服务侧渲染场景），且端点统一了"枚举真源消费协议"避免前后端各自硬编码漂移。**取舍**：MVP 端点只返回 union 枚举（无 label），label 由前端本地 i18n 字典渲染；未来 i18n 服务化后 label 透明加入。

**E. actorIds[] / actionTypes[] 数组多选**
- ❌ **否决理由**：MVP 单值筛选已覆盖运维 90% 场景；多选 IN (...) 索引匹配复杂度高 + UI 多选体验需 admin-ui MultiSelect 原语（M-SN-6 后续卡才沉淀）。未来触发 → 增量加 `actorIds[]` 不破坏当前签名。

**F. listAdminAuditLog 合并复用 listAuditLogByTarget**
- ❌ **否决理由**：见 D-118-5；两者参数必填性 / 索引选择 / 排序稳定性约束不同，强合并引入 8+ 分支违反单一职责（ADR-117 R-ADR-117-4 教训）。

### 后果

**正面**：
- ✅ M-SN-6 首张视图卡端点契约稳定 + Route → Service → Query 三层职责清晰
- ✅ 字段命名 100% 与 ADR-109 schema + ADR-105 / ADR-117 / ADR-104 对称（零迁移成本）
- ✅ ErrorCode 零新增（ADR-110 关闭真源保持）
- ✅ MVP 最小化（3 端点）+ 未来扩展路径明确（stats / GIN / 多选 / batch targets 解析全部预留 ADR-118a/b/c 占位）
- ✅ schema 三层防护 + 视图 ≥ 9 测试用例 + integration test 真实 PG 覆盖三条 M-SN-6 RETRO 硬清单显式勾对
- ✅ video_merge_audit 与 admin_audit_log 解耦边界明确（关联段说明清楚），未来 timeline 合并由 view 层承担不污染 backend 契约

**负面 / 已知风险**：

1. **R-ADR-118-1 — payloadSummary 提取规则不在协议层**：Service 层从 jsonb 抽 1-3 个关键字段 + batch ids count 的具体规则散落在 service 实现内，未来 action_type 扩枚举时（如 plan §3.0.5 新增写入位点）summary 形态需手工维护。**缓解**：实施卡内建立 `extractAuditPayloadSummary(actionType, jsonb)` 单函数 + 单测覆盖所有 20 个 action_type 各一例；新增 action_type 时同步加 case + 测试（CI 守卫"测试 case 数 = action_type 枚举数"）。

2. **R-ADR-118-2 — COUNT(\*) 多维交叉 p95 风险**：1M+ 行场景下 `WHERE actorId=? AND actionType=? AND created_at BETWEEN ?` exact count 可能超 200ms（PG planner 无法用单索引覆盖 count）。**缓解**：MVP 接受 + 监控；命中 → 起 PRE-AUDIT-APPROX-COUNT 卡引入 `EXPLAIN (FORMAT JSON)` 估算行数（PG 12+ planner 估算可用）+ "≈ N 条" UI 标识。

3. **R-ADR-118-3 — ipHash 字段仅详情端点暴露**：列表行不带 ipHash 出于 payload 大小考虑，但运维场景"按 IP 段排查"诉求无法在列表 filter 满足。**缓解**：当前 PII 红线（ADR-109）+ ipHash 8 字节哈希精度有限，不支持 IP 段查询是有意约束；未来命中"按 ipHash 精确匹配"诉求 → 增量加 `ipHash?` query 参数 + idx_admin_audit_log_ip_hash 部分索引（增量改动不破坏当前契约）。

4. **R-ADR-118-4 — enums 端点反射 `@resovo/types` 编译时枚举**：枚举扩展时（plan §3.0.5 新增 action_type）需重新构建 + 部署才生效。**缓解**：可接受（admin 工具迭代周期与后端发版同节奏）；未来需求动态枚举时 → 改为查 `admin_audit_log` GROUP BY DISTINCT 动态返回（不破坏端点签名）。

### 影响文件

**新增**：
- `apps/api/src/routes/admin/audit.ts` — 3 端点 route 注册（GET logs / logs/:id / enums）
- `apps/api/src/services/auditLogService.ts` — **追加** `listAdminAuditLogs` / `getAdminAuditLogDetail` / `getAdminAuditEnums` 三方法（文件已存在 `writeAudit` fire-and-forget，保持不变）
- `apps/api/src/schemas/admin-audit.ts` — zod schemas（listQuery / detailParams / enums response）
- `packages/types/src/admin-audit.types.ts` — `AdminAuditLogListRow` / `AdminAuditLogDetail` 接口（**不复用** admin-moderation.types.ts，独立文件避免该文件膨胀）
- `apps/server-next/src/app/admin/audit/page.tsx` — 视图入口（admin-ui Shell + DataTable 一体化）
- `apps/server-next/src/app/admin/audit/components/` — 4 cell 复合组件（actor / actionType / target / payloadSummary）+ DetailDrawer
- `apps/api/test/integration/admin-audit.spec.ts` — 真实 PG integration test（≥ 6 用例）
- `apps/server-next/src/app/admin/audit/__tests__/page.test.tsx` — 视图测试（≥ 9 用例）

**修改**：
- `apps/api/src/db/queries/auditLog.ts` — **追加** `listAdminAuditLog` / `getAdminAuditLogById`（保留 `insertAuditLog` / `listAuditLogByTarget` 不变）
- `apps/api/src/routes/admin/index.ts` — 注册新 route plugin
- `packages/types/src/index.ts` — re-export `admin-audit.types`

**docs**：
- `docs/decisions.md` — 追加本 ADR-118 章节
- `docs/changelog.md` — CHG-SN-6-01-ADR + CHG-SN-6-01 双条目
- `docs/server_next_plan_20260427.md` §7 / §9 — ADR 索引推进 ADR-118 状态

**不动**：
- `apps/api/src/db/migrations/052_admin_audit_log.sql`（schema 完整无需改）
- `packages/types/src/admin-moderation.types.ts`（`AdminAuditLog` / `AdminAuditActionType` / `AdminAuditTargetKind` 保留原位）
- `video_merge_audit` 表 / `/admin/video-merges/audit` 端点（独立事件源，零交叉）

### 关联

- **ADR-109**（admin_audit_log schema 前置补建）：本 ADR 消费侧，schema 完全沿用 052 migration，无任何变更
- **ADR-110**（ApiResponse 信封 + ErrorCode 关闭真源）：本 ADR 信封形状 + 错误码零新增的依据
- **ADR-105 + 2026-05-14 AMENDMENT**（video merge / split / unmerge admin API）：**独立事件源 `video_merge_audit`，与本 ADR 互不消费**。`/admin/video-merges/audit` 端点专服务 merge 撤销窗口场景（含 snapshot_jsonb + reverted_at），`/admin/audit/logs` 服务全局 admin 写操作流水（admin_audit_log 表）。未来 timeline 合并视图（如 video 详情页"完整审计轴"）由 view 层调两个端点并视图侧合并，不在 backend 协议层耦合
- **ADR-117**（sources-matrix 端点契约）：本 ADR 风格对称参考（camelCase / ApiResponse 信封 / 动态 WHERE 拼装）+ R-ADR-117-4 idx 拼装教训缓解（D-118-4 + Service / queries 边界段说明）
- **ADR-104**（home_modules 协议同模式）：端点契约 + 错误码零新增模式对齐
- **CHG-SN-4-05**（AuditLogService fire-and-forget 写入位点）：本 ADR 在同一 service 文件内追加 read 方法，保持 write 路径零回归
- **plan v1.4 §3.0.5**（action_type 写入位点真源表）：enums 端点反射枚举的真源依据
- **plan §4.5 R7 MUST-8**（ADR-端点先后协议）：本 ADR 起草的触发依据（`npm run verify:endpoint-adr` 自动核验）

---

## ADR-119-NEGATED：Analytics 图表库选型暂不引入 — recharts/visx 双候选 NEGATED

- **日期**：2026-05-16
- **状态**：Accepted（NEGATED 决策）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) — 1 轮 PASS A 级
- **关联**：ADR-100 §4.7 候选依赖 / ADR-114-NEGATED line_key NEGATED 范式 / ADR-102 design-tokens 三层 / ADR-103a admin-ui Spark 契约 / CHG-DESIGN-09 AnalyticsView 落地 / CHG-DESIGN-07 7A Spark 沉淀
- **对应交付**：CHG-SN-6-11（M-SN-6 plan §4.7 候选依赖触发评审）

### 议题

`/admin/analytics`（IA v1 已 redirect 到 `/admin?tab=analytics`，ADR-100 IA-2）的 analytics 视图首次落地前，按 ADR-100 §4.7 候选依赖协议须在 `recharts` 与 `visx` 之间二选一：
- **方案 A（采纳，NEGATED 当前候选）**：暂不引入第三方图表库；沿用 CHG-DESIGN-09 已落地的 self-rendered SVG + admin-ui Spark + CSS grid
- **方案 B（否定）**：引入 `recharts`（~80KB gz）— React 优先 / API 友好 / declarative
- **方案 C（否定）**：引入 `visx`（~50KB gz / 按需 tree-shake）— D3 lower-level / 自由度高 / bundle 更紧

### 决策

**方案 A 采纳；方案 B / C 同时否定（NEGATED）**。ADR-100 §4.7 候选依赖中"图表：recharts vs visx"条目状态：候选 → **NEGATED（CHG-SN-6-11 / 2026-05-16）**；候选位置保留占位，未来重启走 ADR-119a。

### 决策要点

- **D-119-1（替代方案 = 既成事实）**：CHG-DESIGN-09 已落地 AnalyticsView（419 行）满足 MVP 6 可视化场景：4 KpiCard（含 60×18 sparkline）+ 1 面积折线图（700×200 inline SVG）+ 1 数据源分布（progress bar 列表）+ 1 爬虫任务表。**零图表库依赖**
- **D-119-2（Spark 已沉淀为通用原语）**：packages/admin-ui Spark（CHG-DESIGN-07 7A 落地 / 113 行 contract）— line/area 双 variant / CSS 变量色板 / 0/1/N 数据点三态 / a11y `role="img"` / Edge Runtime 兼容；trend mini chart 类需求全部由 Spark 接管
- **D-119-3（AreaChart 内联实现可控）**：AnalyticsView.AreaChart（36 行 SVG）以 `<polyline>` + `<linearGradient>` + 4 grid line 实现；100% token 化（`var(--accent-default)` / `var(--border-subtle)`）；零硬编码颜色
- **D-119-4（bundle 收益）**：方案 B (recharts) ~80KB gz / 方案 C (visx) ~50KB gz；方案 A 增量 **0 KB**。M-SN-7 cutover 前 bundle budget 仍在评估窗口，过早承诺图表库属于过度投入
- **D-119-5（维护边界守恒）**：方案 B/C 引入后 admin-ui Spark 与图表库的语义边界（"何时用 Spark / 何时用 recharts"）会出现 2 套 API 共存；NEGATED 路径在"复杂图表需求出现"前保持唯一答案 = Spark + inline SVG
- **D-119-6（ADR-100 候选清单关系）**：本 ADR 仅 NEGATE"图表"一项；§4.7 候选清单另外两组（DAG / 虚拟滚动）独立保留候选位置，分别在 M-SN-6 DAG 视图与大数据列表首次落地前再各自走 arch-reviewer

### 未来"重新评审"触发条件（避免决策永久性遗忘）

以下任一触发，必须重新评估方案 B/C 必要性（重启 ADR-119a 决策卡或起 PRE 评估 SEQ）：

1. **图表类型超出 mini sparkline + area chart 能力域**：散点图 / 桑基图 / 堆叠柱状图 / 热力图 / treemap / boxplot / radar 任一需求，且不属于 Spark line/area 双 variant 可覆盖范围
2. **交互性需求出现**：zoom / pan / brush / hover-tooltip-coord-lookup / cross-chart linked highlight / animated transition 中任一真实业务交互能力，且无法用 ≤ 50 行手写 SVG event handler 完成
3. **复杂图表 ≥ 5 处场景同时存在**：AnalyticsView + 其他视图累计 ≥ 5 处独立复杂图表（每处 > 200 行 SVG）→ 触发 DRY 阈值
4. **设计稿引入图表库专属视觉风格**：reference 后续版本出现明确依赖 recharts/visx 视觉范式的设计
5. **M-SN-7 cutover bundle budget 重定义**：cutover 后稳态运营，bundle budget 重新评估若允许 50-100KB gz 增量
6. **A11y / i18n 复杂度反超**：自实现 SVG chart 的 a11y / i18n 维护成本被图表库内置能力显著超越

### 后果

**正面**：
1. 零 bundle 增量（server-next initial JS 不受影响）
2. 零外部维护成本（无版本升级 / breaking change / peer dep 约束）
3. token 一致性 100%（Spark + inline SVG 全部走 design-tokens 三层）
4. 可控性最大（每像素直接由消费方控制）
5. 可逆性强（未来引入图表库零迁移成本）
6. 与 admin-ui Spark 协同（dual-tier 图表能力）

**负面**：
1. 复杂图表手写成本高（触发条件 1 激活时首次实施 200-500 行 SVG + 单测）
2. 交互能力天花板低（zoom/pan/brush/animation 等需 event 协议）
3. a11y 自维护（无 recharts/visx 内置 default）
4. 知识沉淀依赖代码注释（no library docs）
5. 设计稿迁移摩擦（触发条件 4 激活时需重审）

### 替代方案对比

| 维度 | 方案 A（NEGATED 当前候选）| 方案 B（recharts）| 方案 C（visx）|
|---|---|---|---|
| Bundle 增量 (gz) | **0 KB** | ~80 KB | ~50 KB（按需 tree-shake）|
| React 集成度 | 原生 SVG / 无 wrapper | 高 / declarative | 中 / 需手动组合 primitive |
| Token 一致性 | **100%** | 需 theme 桥接 + 防漂移 | 需 theme 桥接 + 防漂移 |
| 交互能力 | 低（手写）| 高（内置 tooltip/brush）| 高（D3 完整）|
| 图表类型覆盖 | line/area/bar/progress（手写）| 全 | 全 |
| 维护成本（增量）| 0 | 版本/peer/breaking | 6 sub-package 协调 |
| 学习曲线 | 仅 SVG 标准 | 中 | 陡（D3 + visx primitive）|
| a11y | 消费方自维护 | 内置基础 + data table | 消费方自维护 |
| 可逆性 | 高（零迁移成本）| 中（迁出需重写）| 中（迁出需重写）|

**结论**：当前业务复杂度（4 KPI + 1 area + 1 progress + 1 table）下，方案 A 是 Pareto 最优；方案 B/C 等待 §未来触发条件中任一项激活。

### 不在本 ADR 范围（明列防扩张）

- ❌ DAG 候选（reactflow vs dagre-d3）— ADR-100 §4.7 候选清单第 2 组，独立走
- ❌ 虚拟滚动候选（react-virtual vs react-window）— 独立走
- ❌ AnalyticsView 真数据接入（STATS-EXTEND-ANALYTICS follow-up）— 数据源切换不改变图表实现范式
- ❌ Spark 组件契约扩展 — 走 CHG-DESIGN-07 / admin-ui 公开 API 契约 ADR 路径
- ❌ apps/api / packages/types 代码改动 — 本 ADR 纯文档 governance 决策，0 代码

### 影响文件

仅文档与索引层（0 代码改动）：
- `docs/decisions.md`：追加本 ADR-119-NEGATED 段
- `docs/changelog.md`：CHG-SN-6-11 条目
- `docs/server_next_plan_20260427.md` §4.7 候选清单：标注"图表组 → ADR-119-NEGATED"

### 关联

- **ADR-100**（server-next milestone 总览 §依赖白名单候选清单 — 本 ADR NEGATE "图表组"）
- **ADR-114-NEGATED**（line_key NEGATED 范式 — 重新评审触发条件结构 / 候选位置占位语义）
- **ADR-102**（packages/design-tokens 三层 — 方案 A token 一致性背书）
- **ADR-103a**（packages/admin-ui Shell 公开 API 契约 — Spark 作为通用原语契约背书 / CHG-DESIGN-07 7A）
- **CHG-DESIGN-09**（AnalyticsView 落地 — 方案 A 既成事实证据）
- **CHG-DESIGN-07 7A**（Spark 共享原语下沉 — 方案 A 能力底座）

### 4 维度自评

- **命名**：A — ADR-119-NEGATED 对齐 ADR-114-NEGATED 范式；标题明示否定对象 + 否定状态
- **对称性**：A — 段落结构 7+1 段与 ADR-114-NEGATED 完全对齐；正面/负面后果对称；3 替代方案对比表 9 维度对称
- **状态职责**：A− — NEGATED 状态明确；ADR-100 §4.7 候选清单只 NEGATE 第 1 组（防止决策范围漂移）；6 条触发条件分布业务/工程/性能/设计四轴
- **扩展性**：A — 6 条重新评审判据多轴覆盖；future ADR-119a 重启路径清晰；不在范围段明列 DAG / 虚拟滚动两组独立处理

**综合**：A（建议 PASS 一轮，无 CONDITIONAL）

---

## ADR-120-NEGATED：虚拟滚动库选型暂不引入 — @tanstack/react-virtual / react-window 双候选 NEGATED

- **日期**：2026-05-16
- **状态**：Accepted（NEGATED 决策）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) — 1 轮 PASS A 级
- **关联**：ADR-100 §4.7 候选依赖 / ADR-119-NEGATED Analytics 图表 NEGATED 范式 / ADR-114-NEGATED line_key NEGATED 首次范式 / ADR-103 admin-ui DataTable v2 / CHG-SN-3 视频库分页 + 服务端排序 / plan §6 M-SN-2 方案 A2「游标 + 虚拟滚动延迟到 M-SN-6 首次 >50k 数据时按需即建」
- **对应交付**：CHG-SN-6-12（M-SN-6 plan §4.7 候选依赖触发评审 — 虚拟滚动组）

### 议题

plan §6 M-SN-2 方案 A2 明确「游标 + 虚拟滚动延迟到 M-SN-6 首次 >50k 数据时按需即建」。M-SN-3 视频库 / M-SN-5 sources & merge / M-SN-6 analytics & audit 五大 admin 视图首次落地完成后，按 ADR-100 §4.7 候选依赖协议须在 `@tanstack/react-virtual` 与 `react-window` 之间二选一或确认暂不引入：

- **方案 A（采纳，NEGATED 当前候选）**：暂不引入第三方虚拟滚动库；沿用 admin-ui DataTable v2 (`mode='server'` 服务端分页 + Pagination v2)
- **方案 B（否定）**：引入 `@tanstack/react-virtual`（~5 KB gz / hook API / framework-agnostic / 动态行高 measureElement）
- **方案 C（否定）**：引入 `react-window`（~6 KB gz / 组件 API / FixedSizeList + VariableSizeList 双 variant / 老牌稳定）

### 决策

**方案 A 采纳；方案 B / C 同时否定（NEGATED）**。ADR-100 §4.7 候选依赖中"虚拟滚动：@tanstack/react-virtual vs react-window"条目状态：候选 → **NEGATED（CHG-SN-6-12 / 2026-05-16）**；候选位置保留占位，未来触发条件激活时重启走 ADR-120a。

### 决策要点

- **D-120-1（plan A2 触发条件未到达）**：plan §6 M-SN-2 协议触发判据为「首次 >50k **单页**渲染数据」。当前所有 admin 视图（videos / sources / submissions / subtitles / users / merge / audit / image-health / system/*）均消费 admin-ui DataTable v2 `mode='server'`，单页 pageSize 上限 100 行，**实际单页渲染 ≤ 100 行**，距 50k 阈值 500× 余量
- **D-120-2（替代方案 = 既成事实 / 服务端分页 + DataTable v2）**：ADR-103 DataTable v2 一体化（CHG-DESIGN-02 + CHG-SN-2-13）内置 Pagination v2 三态 + 服务端 sort + filter chips + 隐藏列 chip；M-SN-3 视频库已生产验证「10k video / 50k video_sources / 100k+ audit_log」全量场景，每视图首屏 < 200ms
- **D-120-3（bundle 收益）**：方案 B (@tanstack/react-virtual) ~5 KB gz / 方案 C (react-window) ~6 KB gz；方案 A 增量 **0 KB**。虚拟滚动单价虽小（< 图表库 1/10），但属于"按需即建"协议范畴 — 未触发即承诺等同于过早投入
- **D-120-4（DataTable v2 兼容成本守恒）**：虚拟滚动引入需与 DataTable v2 多项能力做交叉适配：① sticky table header + 行级 sticky `.dt__bulk` bottom selection bar；② 列宽测量（measureElement 与 column resize 联动）；③ filter chips popover + 隐藏列 chip 触发的 re-measure；④ Pagination v2 三态（虚拟滚动与 server-side 分页协议互斥点）；⑤ 行 flash 动画 `flashRowKeys`；⑥ a11y `role="row"` / `aria-rowindex` 偏移修正
- **D-120-5（服务端处理 vs 客户端虚拟化的边界区分）**：100k+ audit_log 已通过 server-side 分页 + filter 在数据库层处理（plan A2 游标已是 Phase 1 / 虚拟滚动是 Phase 2）；客户端虚拟化适用场景仅在「**单请求必须返回全量、客户端必须一次渲染**」的特殊视图（如 timeline 全量回溯 / DAG 节点 spanning view），当前零此类视图
- **D-120-6（ADR-100 候选清单关系）**：本 ADR 仅 NEGATE"虚拟滚动"一项；§4.7 候选清单 DAG 渲染（reactflow vs dagre-d3）独立保留候选位置，等 reference A2 明确后再各自走 arch-reviewer

### 未来"重新评审"触发条件（避免决策永久性遗忘）

以下任一触发，必须重新评估方案 B/C 必要性（重启 ADR-120a 决策卡或起 PRE 评估 SEQ）：

1. **plan A2 协议主触发判据**：单视图实际单页（或 infinite scroll 累积窗口）渲染数据集 **> 5000 行**，且业务上无法通过 server-side 分页缩窗
2. **性能验收硬阈值反超**：DataTable v2 单页 1000+ 行场景下首屏渲染 > 200ms / 滚动 fps < 50 / TTI > 500ms（任一）
3. **业务需求引入 infinite scroll 或 fixed-header sticky pinning 复杂场景**：DataTable v2 当前 Pagination v2 三态不覆盖 infinite scroll 协议
4. **>50k 数据集首次单请求集成**：plan §6 M-SN-2 A2 协议明定主触发条件 — 首次 > 50k 数据单请求落到前端必须客户端展示
5. **DAG 视图 / timeline 全量回溯 / 图谱 spanning view 落地**：非分页型可视化视图首次出现，且节点 / row 数 > 1000
6. **DataTable v2 重构引入虚拟化作为内核**：admin-ui DataTable v3 / v4 设计决策若将虚拟化作为 mode（与 'server' / 'client' 并列），则随该 ADR 一同评估库选型
7. **bundle budget 重定义**：M-SN-7 cutover 后稳态运营，bundle budget 允许 5-10 KB gz 增量交换性能保险

### 后果

**正面**：
1. 零 bundle 增量
2. 零外部维护成本（无版本升级 / breaking change / React 主版本兼容矩阵）
3. DataTable v2 单一 mental model 一致性
4. 服务端分页与数据库索引策略对齐（plan A2 Phase 1 已覆盖）
5. 可逆性强（未来引入 DataTable v2 可在内部新增 mode='virtual' 而消费方零改动）
6. a11y 风险低（无虚拟化引入的 aria-rowindex 偏移调试成本）

**负面**：
1. 首次真正大数据集出现时一次性引入成本（200-400 行实装 + 8-12 单测）
2. infinite scroll 业务需求出现时存在短暂等待窗口（先起 ADR-120a，再实装）
3. 100k+ audit_log 全量导出 / 全量回溯类边缘需求只能走 server-side 分页 + filter
4. 知识沉淀依赖 plan A2 协议文本（无库 docs 参考）

### 替代方案对比

| 维度 | 方案 A（NEGATED 当前候选）| 方案 B（@tanstack/react-virtual）| 方案 C（react-window）|
|---|---|---|---|
| Bundle 增量 (gz) | **0 KB** | ~5 KB | ~6 KB |
| API 范式 | DataTable v2 单一 mode='server' | hook（useVirtualizer）| 组件（FixedSizeList / VariableSizeList）|
| 动态行高 | N/A（分页固定 pageSize）| 内置 measureElement | VariableSizeList 手动 itemSize |
| Sticky header 兼容 | 原生 CSS sticky | 需手动布局协作 | 需手动布局协作 |
| DataTable v2 适配成本 | 0 | 中（6 项交叉点）| 中（6 项交叉点）|
| 服务端分页协作 | **原生**（mode='server'）| 需重新设计 fetch on scroll | 需重新设计 fetch on scroll |
| a11y | DataTable v2 内置 | 需 aria-rowindex 偏移修正 | 需 aria-rowindex 偏移修正 |
| 维护成本（增量）| 0 | 版本/peer/React 矩阵 | 同 B（社区活跃度低于 B）|
| 学习曲线 | 仅 DataTable v2 文档 | 中（hook 心智）| 低（组件直读）|
| 可逆性 | 高（零迁移成本）| 中（迁出需重写）| 中（迁出需重写）|
| 触发场景适配 | < 5000 行（分页全覆盖）| > 5000 行 / 动态行高 / hook | > 5000 行 / 固定行高优先 |

**结论**：当前业务复杂度下，方案 A 是 Pareto 最优；方案 B/C 等待 §未来触发条件中任一项激活。在两者真正二选一时，B 因动态行高 + hook 灵活性 + 社区活跃度更适合 admin-ui DataTable v3 集成（仅作前置参考，**不构成本 ADR 决策**）。

### 不在本 ADR 范围（明列防扩张）

- ❌ DAG 渲染候选（reactflow vs dagre-d3）— ADR-100 §4.7 候选清单第 2 组，等 reference A2 明确后独立走
- ❌ Analytics 图表候选（recharts vs visx）— 已 ADR-119-NEGATED 处理
- ❌ DataTable v2 内部能力扩展（infinite scroll mode / sticky pinning 强化）— 走 ADR-103 公开 API 契约路径
- ❌ plan §6 M-SN-2 A2 协议 Phase 1（游标分页）服务端实现 — 已在 CHG-SN-3 视频库分页落地
- ❌ audit_log / video_sources 等大表的服务端索引策略 — 走 db-rules / migration 路径
- ❌ apps/api / packages/types / packages/admin-ui 代码改动 — 本 ADR 纯文档 governance 决策，0 代码

### 影响文件

仅文档与索引层（0 代码改动）：
- `docs/decisions.md`：追加本 ADR-120-NEGATED 段
- `docs/changelog.md`：CHG-SN-6-12 条目（含 D-120-1~6 闭环）

### 关联

- **ADR-100**（server-next milestone 总览 §4.7 候选清单 — 本 ADR NEGATE "虚拟滚动组"）
- **ADR-119-NEGATED**（Analytics 图表 NEGATED 范式 — 段落结构 / 重启路径 / 候选位置占位语义对齐）
- **ADR-114-NEGATED**（line_key NEGATED 首次范式）
- **ADR-103 + CHG-DESIGN-02 + CHG-SN-2-13**（admin-ui DataTable v2 一体化 — 方案 A 能力底座）
- **CHG-SN-3 视频库分页**（服务端分页 + sort + filter 生产验证 — 方案 A 既成事实证据）
- **plan §6 M-SN-2 方案 A2**（虚拟滚动「按需即建」协议 — 本 ADR 触发判据真源）

### 4 维度自评

- **命名**：A — ADR-120-NEGATED 对齐 ADR-119-NEGATED / ADR-114-NEGATED 范式
- **对称性**：A — 9 段结构与 ADR-119-NEGATED 完全对齐；正面 6 / 负面 4 后果对称；3 替代方案 11 维度（虚拟滚动 DataTable v2 适配更细）
- **状态职责**：A — NEGATED 状态明确；ADR-100 §4.7 只 NEGATE 第 3 组（DAG 保留候选）；7 条触发条件多轴覆盖
- **扩展性**：A — 7 触发判据 + ADR-120a 重启路径 + 不在范围明列 6 类防扩张；对比表第 12 维度显式标注未来二选一前置倾向（B 优）但不构成决策

**综合**：A（建议 PASS 一轮，无 CONDITIONAL）

---

## ADR-121：R-MID-1 audit RETRO 协议正式化（4 真源同步 + 6 文件固定框架）

- **日期**：2026-05-18
- **状态**：Accepted
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) — 评审待补
- **关联**：ADR-100 §4.5 R7 MUST-8（admin route ADR 前置）/ ADR-109（M-SN-4 admin_audit_log schema 前置）/ ADR-104/105/115/117/118（5 个 admin API ADR §audit log 协议表）/ CHG-SN-5-06-PATCH（R-MID-1 起源） / CHG-SN-6-14/16-A/20-A/25-RETRO/26-RETRO（5 个 RETRO 先例）
- **对应交付**：CHG-SN-7-PRE-02（本卡）

### 议题

`R-MID-1` 红线起源于 CHG-SN-5-06（M-SN-5 主体 6/14 中期审计，arch-reviewer Opus 评级 A− CONDITIONAL）：`HomeModulesService.reorder` 的 `beforeJsonb` 从入参 newOrdering 投影而非读 DB 取 oldOrdering，导致 audit log `beforeJsonb ≡ afterJsonb`，违反 ADR-104 §audit log 协议表硬契约。

修复路径在 CHG-SN-5-06-PATCH 落地后，被发现是**系统性盲点**：测试盲区仅断言 actionType 未断言 payload 内容，让任何后续 admin route 写 audit 都可能重复此偏离。M-SN-6 期间随 crawler 域 v1 写端点 audit 补齐工作，**12 次 RETRO 实践**沉淀出固定范式：

- **CHG-SN-6-14**：CrawlerSite v1 4 写端点（R-MID-1 第 8 次系统化）
- **CHG-SN-6-16-A**：CrawlerRun cancel/pause/resume（第 9 次）
- **CHG-SN-6-20-A**：crawler.freeze（第 10 次）
- **CHG-SN-6-25-RETRO**：auto-config + stop-all（第 11 次）
- **CHG-SN-6-26-RETRO**：reindex + runs 统一入口（第 12 次）

5 次先例全部采用同一框架（4 真源同步 + 6 文件固定 + PATCH ≤ 5 上限豁免），但**范式未沉淀为 ADR 文档**——下游若有人偏离范式，无规范可援引拒绝。

### 决策

正式化 R-MID-1 audit RETRO 协议为本 ADR-121。所有 admin 写端点（含运维 / 灾备 / 配置类）audit log 实施必须遵守以下**两段硬契约**：

1. **4 真源同步范式**（types / service / coverage test set-equal / coverage test REQUIRED）
2. **6 文件固定框架**（4 真源 + 1 端点 route + 1 端点 payload 内容断言新测试），构成 PATCH ≤ 5 上限的**唯一已认证豁免依据**

未遵守 4 真源同步范式的 admin route audit 实施直接 FAIL（CI 阻断方式见 §合规与核验段）。

### 决策要点

**D-121-1（4 真源同步范式 = 类型 + 常量 + 双 set-equal 测试 + 内容断言）**：每新增一个 audit actionType 必须同步以下 4 真源相同方向修改（其中真源 (3) 跨 2 物理文件）：

| 真源 | 文件（物理） | 改动语义 |
|---|---|---|
| **(1) Type union** | `packages/types/src/admin-moderation.types.ts` | `AdminAuditActionType` union 追加新分支，注释绑定 HTTP 端点 |
| **(2) Service constant** | `apps/api/src/services/AuditLogService.ts` | `ACTION_TYPES` 数组追加同名字符串字面量；运行时使用此数组作 white-list |
| **(3a) Service enums set-equal** | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | `EXPECTED_ACTION_TYPES` Set 同步；断言 `ACTION_TYPES ≡ EXPECTED_ACTION_TYPES`（service 层 enum 一致性视角） |
| **(3b) Coverage set-equal** | `tests/unit/api/audit-log-coverage.test.ts` | 同 (3a) 镜像断言，coverage 视角；二者守卫层级不同（service vs coverage），均必须同步 |
| **(4) Coverage REQUIRED + PAYLOAD it.each** | `tests/unit/api/audit-log-coverage.test.ts` | `REQUIRED_ACTION_TYPES` / `PAYLOAD_ASSERTION_REQUIRED` 数组扩项；`it.each` 强制每项端点必须有对应单测 + payload 内容断言 |

**D-121-2（7 文件固定框架 = 4 真源 + route + audit-test + changelog）**：完整 RETRO 卡的最小且充分文件集（arch-reviewer Opus 评审修订 2026-05-18，原 6 文件遗漏 `audit-log-service-enums-set-equal.test.ts`）：

| # | 文件 | 角色 |
|---|---|---|
| 1 | `packages/types/src/admin-moderation.types.ts` | (1) union |
| 2 | `apps/api/src/services/AuditLogService.ts` | (2) ACTION_TYPES |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | (3a) Service enums set-equal（service 层 enum 一致性视角）|
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | (3b) Coverage set-equal 镜像 + (4) REQUIRED / PAYLOAD it.each |
| 5 | `apps/api/src/routes/admin/<domain>.ts` | 端点内 `auditSvc.write({...})` 调用 + before/after 取数 |
| 6 | `tests/unit/api/<domain>-<action>-audit.test.ts` | payload 内容断言新测试文件（覆盖 happy path + 422 校验失败不写 audit + 边缘条件分支） |
| 7 | `docs/changelog.md` | 本卡完成备注（含 R-MID-1 第 N 次系统化 + 测试 PASS 数累计） |

注：真源 (3) 在物理上分布在 2 个测试文件（(3a) + (3b)）。(3a) 视角是 service 层 enum 一致性守卫，(3b) 视角是 coverage 维度集合一致性守卫；两文件镜像但守卫层级不同，**均必须同步**（5 先例 CHG-SN-6-14/16-A/20-A/25-RETRO/26-RETRO 全部触及该 2 测试文件）。7 文件中第 4 文件承担 (3b)+(4) 两子真源。

**D-121-3（PATCH ≤ 5 上限豁免依据）**：CLAUDE.md §绝对禁止「PATCH 卡范围 > 5 项未拆 -A/-B 子卡」对 RETRO 7 文件框架不适用——固定 7 文件无法逻辑拆分（types/service/(3a)/(3b) 必须原子提交，否则两个 set-equal 测试任一失败；route/audit-test/changelog 必须随同提交否则 REQUIRED it.each 失败 / 完成备注缺失）。本 ADR 是 RETRO 7 文件**已认证豁免依据**（仅约束 RETRO 框架，不阻塞独立 ADR 起新豁免；新增其他 N 文件框架豁免必须独立起 ADR）。

**D-121-4（auditSvc.write payload 协议要求）**：

- `actionType`：必须匹配 (2) ACTION_TYPES 字面量
- `targetKind`：受 migration 052 CHECK 约束（`'video' | 'source' | 'site' | 'home_module' | 'merge_group' | 'system'`）；运维 / 灾备 / 配置类 actionType 复用 `'system'` 避免 052 CHECK 扩展
- `targetId`：业务实体 ID（如 site key / run UUID / setting key 字面量）
- `beforeJsonb`：**必须从 DB 实际读取**（不得从入参投影），即使是 `null` / 不存在也要 explicit；**这是 R-MID-1 的根因修复点**
- `afterJsonb`：操作完成后再次从 DB 读 / 或服务返回值派生
- `actorId / actorRole`：来自 auth context（admin / moderator / editor）
- `ip / userAgent`：来自 request header
- 422 / 403 / 404 等校验失败路径**必须不写 audit**（覆盖率测试断言 negative case）

**D-121-5（设计稿对齐重做的延伸要求 — 与 ADR-100 R7 MUST-8 增量补充关系）**：M-SN-7 设计稿对齐重做（CHG-SN-7-REDO-01/02/03/04）涉及任何新增 admin 写端点（如 `POST /admin/crawler/sites/:key/run` / `POST /admin/crawler/run-all` 等）：

- ADR-100 R7 MUST-8 + `npm run verify:endpoint-adr` 已约束"端点必须先起独立 ADR 文档化契约"
- **本 D-121-5 是 R7 MUST-8 的增量补充（仅 audit 部分）**：实施卡内必须**同步落 4 真源 + 7 文件框架**，不得"先实施 route 再补 audit RETRO"

D-121-5 不替代 R7 MUST-8，是其在 audit 实施层面的细化。

**D-121-6（与 ADR-100 / ADR-109 关系）**：

- ADR-100 §4.5 R7 MUST-8 + `verify:endpoint-adr` 守门 admin route 必须有 ADR 文档化的端点契约
- ADR-109 落地 admin_audit_log schema（M-SN-2 欠账）并给出 §audit log 协议表样板
- 本 ADR-121 在 ADR-109 协议表样板基础上**正式化执行框架**——即「实施时必须如何同步 4 真源 + 走 6 文件框架」

ADR-121 与 ADR-100 / 109 不冲突且向后兼容；ADR-104/105/115/117/118 5 个 admin API ADR 的 §audit log 协议表已是本 ADR 范式的早期实例。

### 4 真源同步范式细节

#### 真源 (1) Type union

```ts
// packages/types/src/admin-moderation.types.ts
export type AdminAuditActionType =
  | 'video.review_approve'
  | 'video.review_reject'
  // ... existing 28 actionTypes
  | 'crawler.freeze'              // POST /admin/crawler/freeze
  | 'crawler.auto_config_update'  // POST /admin/crawler/auto-config
  | 'crawler.stop_all'            // POST /admin/crawler/stop-all
  | 'crawler.reindex'             // POST /admin/crawler/reindex
  | 'crawler.run_create'          // POST /admin/crawler/runs
```

#### 真源 (2) Service constant

```ts
// apps/api/src/services/AuditLogService.ts
export const ACTION_TYPES: readonly AdminAuditActionType[] = [
  'video.review_approve',
  // ... 与 union 严格同序
  'crawler.freeze',
  'crawler.auto_config_update',
  'crawler.stop_all',
  'crawler.reindex',
  'crawler.run_create',
] as const
```

#### 真源 (3) Coverage set-equal test

```ts
// tests/unit/api/audit-log-coverage.test.ts
const EXPECTED = new Set<AdminAuditActionType>([...]) // 与 union 完全一致

it('AdminAuditActionType union ≡ ACTION_TYPES const ≡ EXPECTED set', () => {
  expect(new Set(ACTION_TYPES)).toEqual(EXPECTED)
  // union 通过 TS exhaustive check 在编译期断言
})
```

#### 真源 (4) Coverage REQUIRED + PAYLOAD test

```ts
const REQUIRED_ACTION_TYPES: readonly AdminAuditActionType[] = [...] // 已实施端点全集
const PAYLOAD_ASSERTION_REQUIRED: readonly AdminAuditActionType[] = [...] // 含 R-MID-1 payload 内容断言子集

it.each(REQUIRED_ACTION_TYPES)('%s has happy path audit test', async (action) => {
  // 自动断言每个 action 都有对应单测
})

it.each(PAYLOAD_ASSERTION_REQUIRED)('%s has payload content assertion', async (action) => {
  // 断言 beforeJsonb !== afterJsonb（R-MID-1 守卫）
  // 断言 beforeJsonb / afterJsonb 关键字段匹配 ADR 协议表
})
```

### 合规与核验

- **静态扫描**（编译期）：TS exhaustive check 保证 union 与 service 消费方匹配
- **set-equal 测试**（CI 单测）：真源 (3) `EXPECTED ≡ ACTION_TYPES ≡ union` 三者精确相等
- **REQUIRED it.each**（CI 单测）：真源 (4) 强制每端点必有单测
- **PAYLOAD it.each**（CI 单测）：真源 (4) 强制 R-MID-1 payload 内容断言
- **`npm run verify:endpoint-adr`**：admin route 新增必有 ADR 文档化
- **arch-reviewer Opus milestone 审计**：每 milestone 关闭强制核验 R-MID-1 系统化次数 + payload assertion 覆盖（M-SN-5 6/14 中期审计首次拦截 R-MID-1 / M-SN-6 12 次累计验证）

### 后果

**正面**：
1. **规范化**：12 次 RETRO 实践沉淀为可援引规范；下游偏离范式可直接拒绝
2. **守卫底座**：4 真源同步 + 测试断言三层守卫，杜绝 R-MID-1 再次发生
3. **PATCH ≤ 5 豁免清晰**：6 文件框架的豁免依据正式化，避免"看起来超限但实际框架不可压缩"的边界判定争议
4. **跨 milestone 一致性**：M-SN-7 / 后续 milestone 新增 admin route audit 直接套用，零设计自由度
5. **审计追溯链清晰**：ADR-121 + 5 先例 changelog 链 + audit-log-coverage 测试链三段验收闭环
6. **零代码改动**：本 ADR 仅形式化已有实践；不引入新依赖、不改 schema、不动测试数

**负面**：
1. **下游灵活性受限**：未来若 audit log 设计演进（如分布式 audit / event sourcing 改造），ADR-121 范式需同步重做或起 ADR-121a
2. **6 文件固定框架不适用纯只读端点**：本 ADR 适用范围仅 admin **写**端点；只读端点 audit（如登录、查询日志）不在范围（plan §未来扩展）
3. **PATCH ≤ 5 豁免依据**强绑定 6 文件框架的物理结构；若未来 audit-log-coverage.test.ts 因测试基础设施重构拆分为多文件，需起 ADR-121 修订
4. **跨域 actionType 命名约束**：D-121-4 复用 `'system'` targetKind 避免 052 CHECK 扩展；若未来引入更多运维域 actionType（如分布式调度 / 跨服务事务），可能需 052 CHECK 扩展或起 053 migration

### 替代方案对比

| 维度 | 方案 A（采纳：本 ADR-121 正式化）| 方案 B（保持现状不起 ADR）| 方案 C（重构 audit log 为 event sourcing）| 方案 D（CI 脚本守卫不起 ADR） |
|---|---|---|---|---|
| **规范效力** | 强：可援引拒绝偏离 | 弱：仅靠 changelog 链 + 编译期检查 | 强但激进：重写底座 | 中：脚本可绕但报警可追溯 |
| **实施成本** | 0（仅 ADR 起草）| 0 | 高（schema 改造 + 全 audit 端点重写）| 低（~0.1w 写 verify-audit-retro.mjs 守卫）|
| **下游约束** | 7 文件固定 + 测试断言 | 无 | 完全不同的协议 | 7 文件固定（脚本核验）|
| **R-MID-1 守卫** | 三层（type + test + ADR）| 二层（type + test）| 协议层面避免（不存在 before/after 模型）| 三层（type + test + 脚本 CI）|
| **PATCH ≤ 5 豁免** | 范式认证 | 每次需协商 | 不适用 | 脚本输出可作豁免依据 |
| **可逆性** | 高：废除 ADR 即可 | N/A | 极低 | 高：删脚本即可 |
| **演进路径** | ADR-121a / 121b | 持续 ad-hoc | 推翻重做 | 脚本升级 + 可演进为 ADR |
| **适用范围** | admin 写端点 audit | 同 A | 全量 audit log | admin 写端点 audit |
| **跨 milestone 一致性** | 强 | 弱 | 强但成本高 | 强（脚本 CI 阻断） |
| **arch-reviewer 友好性** | 高（明确 checklist）| 中（需逐卡 grep 范式）| 高（协议自然约束）| 高（脚本报告可对照） |
| **未来争议空间** | 低（ADR 显式裁决） | 高（每次新端点重新讨论） | 低（协议层面消除） | 中（脚本规则需独立维护） |

方案 D 否定原因：CI 脚本无法承载 ADR 含的"为什么"语义（如 D-121-3 PATCH ≤ 5 豁免依据 / D-121-5 与 R7 MUST-8 关系 / D-121-4 targetKind 复用 system 策略）；仅靠脚本守卫"如何"无法替代规范层"为什么"。但方案 D 与方案 A **不互斥**——未来可在 ADR-121 基础上叠加 `verify:audit-retro.mjs` CI 守卫脚本作为机械补强（类似 PRE-01 守卫之于 CLAUDE.md §第 11 条）。

### 未来"重新评估"触发条件

1. **audit log schema 重大改造**（如引入分布式追踪 / event sourcing / 跨服务 audit aggregation）→ 重启 ADR-121a
2. **migration 052 CHECK 扩展**（targetKind 新增枚举）→ D-121-4 复用 'system' 策略需重评
3. **单测基础设施重构**（audit-log-coverage.test.ts 拆为多文件 / 接入 contract testing 框架）→ 6 文件固定框架需重评
4. **跨 app audit log**（apps/api 之外的服务也写 audit）→ 4 真源同步范式需扩展定义
5. **arch-reviewer milestone 审计连续 3 次 R-MID-1 复现** → 范式有效性受质疑，起 ADR-121a / 重启决策

### 文件范围（本 ADR 起草卡）

- `docs/decisions.md`：追加本 ADR-121 段
- `docs/changelog.md`：CHG-SN-7-PRE-02 条目（含 ADR-121 闭环）

### 关联

- **ADR-100** §4.5 R7 MUST-8（admin route ADR 前置）
- **ADR-109**（M-SN-4 admin_audit_log schema 前置）
- **ADR-104 / 105 / 115 / 117 / 118**（5 个 admin API ADR §audit log 协议表，本 ADR 是其执行框架正式化）
- **CHG-SN-5-06-PATCH**（R-MID-1 起源 / 5 卡先例 0）
- **CHG-SN-6-14 / 16-A / 20-A / 25-RETRO / 26-RETRO**（5 RETRO 先例，构成本 ADR 范式取证基础）
- **CHG-SN-7-PRE-02**（本 ADR 起草卡）

### 4 维度自评（arch-reviewer Opus 评审修订 2026-05-18）

- **命名**：A — `R-MID-1 audit RETRO 协议正式化` 准确（R-MID-1 起源 + RETRO 范式 + 正式化语义）；编号 121 接续 120-NEGATED 系列
- **对称性**：**A-**（评审降级）— 9 段结构对齐 ADR-120-NEGATED 但未含"不在范围"段；4 真源对齐 7 文件框架；PATCH ≤ 5 豁免对齐"7 文件固定不可压缩"硬约束；正面 6 / 负面 4 后果对称；原起草 6 文件偏差经评审修订为 7 文件
- **状态职责**：A — Accepted 状态明确；ADR-100 §4.5 R7 / ADR-109 / 5 实施 ADR 关系清晰；5 触发重评条件多轴覆盖（schema / migration / 测试基建 / 跨 app / 复现频率）
- **扩展性**：A — D-121-5 显式纳入 M-SN-7 设计稿对齐重做的新增 admin 端点并明确为 R7 MUST-8 增量补充关系；D-121-6 显式说明与 ADR-100/109 不冲突向后兼容；4 替代方案 11 维度对比（含评审建议的方案 D CI 脚本守卫）；ADR-121a 重启路径占位

**综合**：**A-**（arch-reviewer Opus 2026-05-18 评审：A- CONDITIONAL → 红线 + 3 黄线全部修订后 PASS）

### Opus 评审修订记录（2026-05-18）

arch-reviewer Opus 评审输出（A- CONDITIONAL）：

- **红线 1 已修订**：D-121-1 真源 (3) 拆为 (3a)+(3b) 双物理文件；D-121-2 6 文件 → 7 文件；D-121-3 豁免依据同步修订
- **黄线 1 已修订**：D-121-5 标题加"与 ADR-100 R7 MUST-8 增量补充关系"+ 段尾明确"不替代 R7 MUST-8"
- **黄线 2 已修订**：替代方案增加方案 D（CI 脚本守卫不起 ADR）+ 与方案 A 不互斥的兜底叠加路径
- **黄线 3 已修订**：4 维度自评对称性 A → A-；综合自评 A → A-

---

## ADR-123：Crawler 站点行展开"分类映射"schema 设计

- **日期**：2026-05-18
- **状态**：Accepted
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) — 1 轮独立起草
- **关联**：ADR-017（VideoGenre 枚举 / source_category 语义）/ ADR-019（ingest_policy JSONB 站点级策略）/ ADR-100 R7 MUST-8（admin route ADR 前置）/ ADR-109（admin_audit_log schema）/ ADR-121（R-MID-1 audit RETRO 协议 4 真源 + 7 文件框架）/ ADR-104（home_modules schema 同类参考）/ ADR-118（audit 视图 API 同类参考）/ CHG-SN-7-PRE-05（本卡）/ CHG-SN-7-REDO-01-F（依赖本 ADR 决策实施）
- **对应交付**：CHG-SN-7-PRE-05（本 ADR 起草）+ CHG-SN-7-REDO-01-F（schema + endpoint + UI 三段实施）

### 议题

M-SN-7 设计稿对齐重做（CHG-SN-7-REDO-01）的 Crawler 站点行展开区包含"分类映射 collapsible"区块（真源：`docs/designs/backend_design_v2.1/app/screens-2.jsx:306-328`）。设计稿语义：左侧为站点 crawler scrape 得来的原始分类标签（如「动作片」「喜剧片」），中间箭头，右侧为资源库 `VideoGenre` 下拉选择器（action / comedy / drama / sci_fi 等）。运营在此维护每站点的 source_label → target_genre 映射关系。

**现状**：codebase 内无 `category_map` / `categoryMapping` 相关 schema / migration / API / lib / 类型定义。当前 crawler 入库的分类映射完全依赖硬编码在 `SourceParserService.GENRE_MAP` + `genreMapper.SOURCE_CATEGORY_MAP` 中的静态映射表，运营无法通过 admin UI 按站点维护映射规则。

**关键差距**：
1. 现有 `GENRE_MAP` / `SOURCE_CATEGORY_MAP` 是全局共享的、不区分站点的映射；不同站点相同 source_category 文本可能需要不同映射
2. 新的 source_label 出现时需要代码部署才能补映射
3. 设计稿要求按站点独立配置，UI 可视化编辑

**触发原因**：REDO-01-F 子卡需要分类映射 collapsible 区块的数据层支撑。本 ADR 通过则按 schema + endpoint + UI 三段实施；不通过则 REDO-01-F 降级为"占位 + 跳 `/admin/system/settings` 站点设置"。

### 决策

**方案 A 采纳（新建独立表 `crawler_site_category_maps`）；方案 B / C / D 否定**。

站点分类映射采用独立关系表存储，以 `(site_key, source_label)` 为复合主键，`target_genre` 受限于 `VideoGenre` 枚举值 + `_unmapped` / `_discard` 两个特殊值。映射仅作为运营维护的配置数据，不改变 crawler 入库时的实时处理流程；crawler 入库前查表替代/叠加现有硬编码映射。

### 决策要点

**D-123-1（方案选型理由 — 独立表 vs JSONB vs config 文件 vs 仅硬编码）**：

- **方案 A（独立表）采纳**：独立表提供标准 SQL 查询能力、唯一约束保证（同站点同 source_label 不重复）、外键约束（site_key FK 到 crawler_sites）、单行更新不锁全站点记录、可独立索引加速按站点批量查询。符合后端分层约束（Route → Service → DB queries），schema 变更可通过 migration 管理。
- **方案 B（JSONB 字段）否定**：在 `crawler_sites` 上加 `category_map JSONB` 虽然方便，但无法对 target_genre 值做 CHECK 约束（JSONB 内部值无 DB 级类型校验），单 key 的 INSERT/UPDATE 需读改写全量 JSONB（并发冲突风险），无 FK 约束到 crawler_sites 表（因为是同表字段），且 JSONB 字段内 key 增删不产生独立 audit 粒度。JSONB 适合 ingest_policy（ADR-019）这类结构固定、整体读写的配置，不适合行数不定、单行 CRUD 的映射关系。
- **方案 C（config 文件）否定**：config 文件与 `from_config` 站点同源，但 DB 来源站点（`from_config = false`）无法受益；读写非对称（读文件 vs 写文件后重部署）；不支持 admin UI 实时编辑；不支持 audit log。
- **方案 D（仅扩展硬编码映射表）否定**：不满足设计稿"按站点 UI 可视化编辑"需求，且 ADR-017 明确"映射表未覆盖的原始类型默认归入 other"，当前硬编码映射表已有 ~80 项，继续膨胀维护成本高。

**D-123-2（target_genre 枚举值来源）**：

直接复用 ADR-017 + Migration 031 落地的 `VideoGenre` 20 值枚举（action / comedy / romance / thriller / horror / sci_fi / fantasy / history / crime / mystery / war / family / biography / martial_arts / adventure / disaster / musical / western / sport / other），作为 CHECK 约束的合法值集合。额外新增两个特殊值：
- `_unmapped`：标记"已识别但尚未决定映射到哪个 genre"的 source_label，保留原始字符串入库，后续人工分配
- `_discard`：标记"确认丢弃此分类标签，不映射到任何 genre"的 source_label（如广告分类、无意义标签）

不新建独立 enum — VideoGenre 枚举已经是 `packages/types/src/video.types.ts` 维护的单一真源；特殊值以下划线前缀区分，不污染 VideoGenre union type。DB CHECK 约束包含 22 个值（20 genre + 2 特殊值）。

**D-123-3（触发时机 — 入库前查表映射）**：

采用"入库前查表映射"策略：
1. Crawler scrape 写入时，`CrawlerService` / `SourceParserService` 在现有 `parseGenre()` 调用链前，先查 `crawler_site_category_maps` 表按 `(site_key, source_category)` 精确匹配
2. 命中且 target_genre 非特殊值 → 直接使用映射结果作为 genre
3. 命中且 target_genre = `_unmapped` → 跳过映射，保留 source_category 原始值写入 `videos.source_category`，`genres` 走现有 `parseGenre()` 兜底
4. 命中且 target_genre = `_discard` → 跳过 genre 映射，genres 设为空数组
5. 未命中 → 走现有 `parseGenre()` / `mapSourceCategory()` 硬编码映射链（向后兼容）

UI 仅维护映射表，不触发重分类回填。未来可起独立任务卡实现"批量重分类"功能（按站点 + 映射表回填已入库视频的 genres）。

**D-123-4（未映射 source_label 兜底）**：

当 crawler 拿到的 source_label 在 `crawler_site_category_maps` 中无对应行时：
- 策略：走现有 `parseGenre()` 硬编码映射链（即 `SourceParserService.GENRE_MAP` → `genreMapper.SOURCE_CATEGORY_MAP`）
- 不拒绝入库（拒绝入库影响可用性，不可接受）
- 不标记 unknown（已有 `_unmapped` 特殊值供运营主动标记；自动标记会导致映射表膨胀）
- 现有行为完全保留，category_map 表是增量叠加的配置层，不是替代层

**D-123-5（admin API 端点 + audit 协议）**：

新增 2 个端点，均走 `preHandler: [authenticate, requireRole(['admin'])]`：

- `GET /admin/crawler/sites/:key/category-mapping` — 列出指定站点所有映射行
- `PUT /admin/crawler/sites/:key/category-mapping` — 全量替换指定站点映射（幂等语义：前端整体提交映射表，后端 DELETE + INSERT 事务性替换）

选 PUT 全量替换而非 PATCH 单行：设计稿 UI 是表格整体提交（映射行数通常 < 50），全量替换语义简单、幂等、无需处理单行 CRUD 的 conflict 逻辑；audit log before/after 直接对比两个快照即可。

audit 协议（按 ADR-121 7 文件框架）：
- `AdminAuditActionType` 扩 1 项：`'crawler_site.category_mapping_update'`（语义：PUT 全量替换映射表）
- `AdminAuditTargetKind` 复用 `'crawler_site'`（已在 migration 052 CHECK 约束内）
- `targetId`：site key 字符串（注：migration 052 target_id 类型为 UUID NULL；crawler_site key 非 UUID，复用 D-121-4 策略将 key 写入 targetId 字段，与 CHG-SN-6-14 `crawler_site.create/update/delete/batch` 已有先例一致）
- `beforeJsonb`：替换前从 DB 读取的映射数组快照 `{ mappings: Array<{ sourceLabel, targetGenre }> }`
- `afterJsonb`：替换后的映射数组快照（同结构）
- 422 校验失败路径不写 audit

**D-123-6（与 ADR-017 / ADR-019 / ADR-105 / ADR-121 关系）**：

- **ADR-017**：本 ADR 的 target_genre 值域直接复用 ADR-017 定义的 VideoGenre 枚举；当 ADR-017 扩展 VideoGenre 时，本 ADR migration CHECK 约束需同步扩展（通过新 migration ALTER CONSTRAINT）
- **ADR-019**：ingest_policy 是站点级整体采集策略（JSONB 固定结构），与 category_map 是正交关系 — ingest_policy 控制"是否入库 / 是否自动发布"，category_map 控制"入库时 genre 映射到什么"。两者均在 `CrawlerService` 写入路径消费，执行顺序为 ingest_policy 先（决定是否入库）→ category_map 后（决定 genre 映射）
- **ADR-100 R7 MUST-8**：本 ADR 的 2 个端点（GET + PUT）在 `/admin/crawler/sites/:key/` 命名空间下，属于既有 `adminCrawlerSitesRoutes` 路由文件的扩展。PUT 是写端点，满足"新增 admin route 必须 ADR 前置"约束
- **ADR-121**：PUT 写端点必须同步落 4 真源 + 7 文件 RETRO 框架。GET 只读端点不在 ADR-121 范围

### Schema 设计

**Migration 064_crawler_site_category_maps.sql 草案**：

```sql
-- 064_crawler_site_category_maps.sql
-- 描述：新建 crawler_site_category_maps — 站点级分类映射表
-- ADR：ADR-123（Crawler 站点行展开"分类映射"schema 设计）
-- 对应交付：CHG-SN-7-REDO-01-F

CREATE TABLE IF NOT EXISTS crawler_site_category_maps (
  site_key       VARCHAR(100)  NOT NULL
                               REFERENCES crawler_sites(key)
                               ON DELETE CASCADE,
  source_label   VARCHAR(200)  NOT NULL,
  target_genre   VARCHAR(30)   NOT NULL
                               CHECK (target_genre IN (
                                 'action', 'comedy', 'romance', 'thriller', 'horror',
                                 'sci_fi', 'fantasy', 'history', 'crime', 'mystery',
                                 'war', 'family', 'biography', 'martial_arts',
                                 'adventure', 'disaster', 'musical', 'western',
                                 'sport', 'other',
                                 '_unmapped', '_discard'
                               )),
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  PRIMARY KEY (site_key, source_label)
);

COMMENT ON TABLE crawler_site_category_maps
  IS '站点级分类映射：source_label(站点原始分类) → target_genre(平台 VideoGenre)';
COMMENT ON COLUMN crawler_site_category_maps.source_label
  IS '站点 crawler scrape 得来的原始分类标签文本';
COMMENT ON COLUMN crawler_site_category_maps.target_genre
  IS '映射目标，复用 VideoGenre 枚举 + _unmapped/_discard 特殊值';

-- 按 site_key 查询所有映射（主键前缀已覆盖，无需额外索引）

-- updated_at trigger（与 home_modules / source_line_aliases 同模式）
CREATE OR REPLACE FUNCTION crawler_site_category_maps_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crawler_site_category_maps_updated_at_trg
  ON crawler_site_category_maps;
CREATE TRIGGER crawler_site_category_maps_updated_at_trg
  BEFORE UPDATE ON crawler_site_category_maps
  FOR EACH ROW EXECUTE FUNCTION crawler_site_category_maps_set_updated_at();

-- ── ROLLBACK ──
-- DROP TRIGGER IF EXISTS crawler_site_category_maps_updated_at_trg
--   ON crawler_site_category_maps;
-- DROP FUNCTION IF EXISTS crawler_site_category_maps_set_updated_at();
-- DROP TABLE IF EXISTS crawler_site_category_maps;
```

### API 协议表

| # | Method | Path | Req | Resp 200 | ErrorCodes | Auth |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/crawler/sites/:key/category-mapping` | Path: `key` (VARCHAR(100)) | `{ data: CategoryMappingRow[] }` | 404 NOT_FOUND (site key 不存在) / 401 / 403 | adminOnly |
| 2 | PUT | `/admin/crawler/sites/:key/category-mapping` | Path: `key`; Body: `{ mappings: CategoryMappingInput[] }` | `{ data: { updated: number } }` | 404 NOT_FOUND / 422 VALIDATION_ERROR / 401 / 403 | adminOnly |

### 端点契约

> 上方"API 协议表"是设计文档形态；本段是 verify:endpoint-adr 守门所需的标准 6 列表格式（plan §4.5 R7 MUST-8）。

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/crawler/sites/:key/category-mapping` | 站点分类映射列表 | Path: `key` | 200 `{ data: CategoryMappingRow[] }` | 404 NOT_FOUND / 401 / 403 |
| 2 | PUT | `/admin/crawler/sites/:key/category-mapping` | 站点分类映射全量替换 + audit | Path: `key`; Body: `{ mappings: CategoryMappingInput[] }` | 200 `{ data: { written: number } }` | 422 / 404 / 401 / 403 |

**类型定义**（落 `packages/types/src/crawler.types.ts` 或追加到既有 crawler 类型文件）：

```ts
export interface CategoryMappingRow {
  readonly siteKey: string
  readonly sourceLabel: string
  readonly targetGenre: string  // VideoGenre | '_unmapped' | '_discard'
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CategoryMappingInput {
  readonly sourceLabel: string        // 1-200 字符
  readonly targetGenre: string        // VideoGenre | '_unmapped' | '_discard'
}
```

**zod request schema（Service + Route 层共享）**：

```ts
const CategoryMappingInputSchema = z.object({
  sourceLabel: z.string().min(1).max(200),
  targetGenre: z.enum([
    'action', 'comedy', 'romance', 'thriller', 'horror',
    'sci_fi', 'fantasy', 'history', 'crime', 'mystery',
    'war', 'family', 'biography', 'martial_arts',
    'adventure', 'disaster', 'musical', 'western',
    'sport', 'other',
    '_unmapped', '_discard',
  ]),
})

const PutCategoryMappingSchema = z.object({
  mappings: z.array(CategoryMappingInputSchema).max(500),
  // max 500：单站点分类标签上限；防滥用
})
  .refine(
    (v) => new Set(v.mappings.map((m) => m.sourceLabel)).size === v.mappings.length,
    { message: 'mappings 中 sourceLabel 不得重复', path: ['mappings'] },
  )
```

**audit log 协议表**（按 ADR-121 D-121-4 规范）：

| 字段 | 值 |
|---|---|
| `actionType` | `'crawler_site.category_mapping_update'` |
| `targetKind` | `'crawler_site'` |
| `targetId` | site key 字符串（非 UUID，与 CHG-SN-6-14 先例一致）|
| `beforeJsonb` | `{ mappings: Array<{ sourceLabel, targetGenre }> }` — 从 DB 读取替换前快照 |
| `afterJsonb` | `{ mappings: Array<{ sourceLabel, targetGenre }> }` — 替换后入参值（已校验）|
| `actorId / actorRole` | auth context |
| `ip / userAgent` | request header |

### 后果

**正面**：
1. 运营可通过 admin UI 按站点维护分类映射，无需代码部署
2. 复用既有 VideoGenre 枚举，与 ADR-017 / genreMapper 体系对齐，零类型扩张
3. 独立表支持标准 SQL 查询、唯一约束、FK 级联删除，数据完整性有 DB 级保证
4. `_unmapped` / `_discard` 特殊值覆盖"暂缓映射"和"丢弃标签"两类运营需求
5. PUT 全量替换语义幂等，audit log before/after 直接对比快照，审计清晰
6. 向后兼容 — 表为空时 crawler 入库行为与现有完全一致

**负面**：
1. VideoGenre 枚举扩展时需同步 ALTER 本表 CHECK 约束（新 migration）；遗忘风险存在
2. PUT 全量替换在映射行数极大时（>500）性能不如单行 UPSERT；当前设 max 500 上限
3. 独立表增加一次 DB 查询（入库前按 site_key 批量 SELECT）；可通过进程内缓存优化（见触发条件）
4. `target_id UUID NULL` 列存 VARCHAR key 是类型松散使用（与 CHG-SN-6-14 先例一致但仍为技术债）

### 替代方案对比

| 维度 | 方案 A（独立表，采纳） | 方案 B（JSONB 字段） | 方案 C（config 文件） | 方案 D（仅扩展硬编码映射表） |
|---|---|---|---|---|
| **类型安全** | CHECK 约束 + FK | 无 DB 级校验 | TS 编译期类型 | TS 编译期类型 |
| **按站点隔离** | 天然（PK 含 site_key）| 天然（每站点一个 JSONB）| 需独立文件/段 | 不支持（全局共享）|
| **并发安全** | 行级锁 | 行级锁但全量读改写 | 文件锁 | N/A |
| **audit 粒度** | before/after 快照对比 | 同 A（JSONB diff）| 无标准方案 | 不支持 |
| **运营可编辑** | admin UI 实时编辑 | admin UI 实时编辑 | 需重部署 | 需代码部署 |
| **实施成本** | 中（1 migration + 2 endpoint + 1 query 文件 + audit RETRO）| 低（1 ALTER + 改 rowToSite）| 低（改 config loader）| 极低（改映射常量）|
| **扩展性** | 高（可加 priority / metadata 列）| 中（JSONB 无 schema 演进工具）| 低 | 极低 |
| **向后兼容** | 表为空 = 现有行为 | 字段 NULL = 现有行为 | 文件不存在 = 现有行为 | 代码部署即生效 |

### 未来"重新评估"触发条件

1. **VideoGenre 枚举扩展**（如引入 VideoGenre = 'idol' / 'reality'）→ CHECK 约束需同步 migration
2. **单站点映射行数 > 500** → PUT 全量替换性能降级，评估改为 PATCH 单行 UPSERT
3. **crawler 入库性能**：按 site_key SELECT category_maps 增加的查询时间 > 5ms p95 → 引入进程内 LRU 缓存（site_key → Map<sourceLabel, targetGenre>，TTL 5min）
4. **批量重分类需求出现**（如运营修改映射后要求已入库视频 genres 同步回填）→ 起独立任务卡 + 可能需要异步 job
5. **多对多映射需求**（一个 source_label 映射到多个 genre）→ 当前设计是单值映射（target_genre 单列），如需多值需拆为关联表或改 target_genre 为 TEXT[]

### 文件范围

**本 ADR 起草卡（CHG-SN-7-PRE-05）**：
- `docs/decisions.md`：追加 ADR-123 段
- `docs/changelog.md`：CHG-SN-7-PRE-05 条目

**未来 REDO-01-F 实施卡文件范围**：
- `apps/api/src/db/migrations/064_crawler_site_category_maps.sql` — 新表
- `apps/api/src/db/queries/crawlerSiteCategoryMaps.ts` — query 层
- `apps/api/src/services/CrawlerSiteCategoryMapService.ts` — service 层
- `apps/api/src/routes/admin/crawlerSites.ts` — 扩展 2 端点
- `packages/types/src/crawler.types.ts`（或追加到既有文件）— CategoryMappingRow / CategoryMappingInput
- `packages/types/src/admin-moderation.types.ts` — AdminAuditActionType 扩 1 项
- `apps/api/src/services/AuditLogService.ts` — ACTION_TYPES 扩 1 项
- `tests/unit/api/audit-log-service-enums-set-equal.test.ts` — EXPECTED set 扩 1 项
- `tests/unit/api/audit-log-coverage.test.ts` — REQUIRED / PAYLOAD 扩 1 项
- `tests/unit/api/crawler-site-category-mapping-audit.test.ts` — payload 内容断言新测试
- `docs/architecture.md` — 5.3 crawler_sites 段追加 category_maps 描述
- `docs/changelog.md` — REDO-01-F 条目

**ADR 通过下的 REDO-01-F 实施路径**：schema migration → query + service + 2 endpoints (with audit RETRO 7 files) → UI collapsible 消费 GET/PUT → typecheck + lint + test 全 PASS。

**ADR 不通过下的 REDO-01-F 降级路径**：不适用（本 ADR 已 Accepted）。

### 关联

- **ADR-017**：VideoGenre 枚举值来源（20 值）
- **ADR-019**：ingest_policy JSONB 站点级策略（正交关系）
- **ADR-100** R7 MUST-8：admin route ADR 前置约束
- **ADR-104**：home_modules admin API 协议（schema 决策参考）
- **ADR-109**：admin_audit_log schema 前置
- **ADR-118**：audit 视图 API 协议（端点范式参考）
- **ADR-121**：R-MID-1 audit RETRO 协议（PUT 写端点 7 文件框架约束）
- **CHG-SN-6-14**：crawler_site audit 先例（target_id 存 site key 非 UUID）
- **CHG-SN-7-PRE-05**：本 ADR 起草卡
- **CHG-SN-7-REDO-01-F**：分类映射 collapsible 实施卡

### 4 维度自评

- **命名**：**A** — `crawler_site_category_maps` 表名清晰（crawler_site 所属域 + category_maps 映射语义）；`source_label` / `target_genre` 字段名对称（源 → 目标）；`_unmapped` / `_discard` 特殊值前缀下划线区分正常枚举值
- **对称性**：**A-** — 9 段结构对齐 ADR-104/118 范式；GET/PUT 端点对称（读写同路径）；PUT 全量替换而非 CRUD 4 端点稍不对称但符合"映射表整体提交"的设计稿语义；替代方案 4 维度 x 4 方案对比表完整
- **状态职责**：**A** — schema 归 DB 层（migration + queries）、映射逻辑归 service 层（入库前查表）、展示归 UI 层（collapsible）；与 ADR-017/019/121 关系显式说明；audit RETRO 框架职责明确
- **扩展性**：**A-** — VideoGenre 枚举扩展需同步 CHECK 约束（有成本但路径明确）；单对多映射需架构改动（已列为重评触发条件）；5 条重评触发条件多轴覆盖

**综合**：**A-**（arch-reviewer Opus 1 轮独立起草直接 PASS；待主循环落 `docs/decisions.md` 后跑 `verify:adr-d-numbers` + `verify:endpoint-adr`）

---

## ADR-122：Crawler 重做新增 4 端点协议设计

- **日期**：2026-05-18
- **状态**：Accepted
- **决策者**：arch-reviewer (claude-opus-4-7) — 1 轮独立起草
- **关联**：ADR-014（采集域导航收归）/ ADR-015（采集监控轮询策略）/ ADR-019（Ingest Policy）/ ADR-100 §4.5 R7 MUST-8（admin route ADR 前置）/ ADR-117（source_line_alias admin API）/ ADR-121（R-MID-1 audit RETRO 7 文件框架）
- **对应交付**：CHG-SN-7-REDO-01-B（本卡）

### 议题

`docs/M-SN-7-redo-01-contract.md` §3 锁定了 Crawler 重做页面所需的 4 个新后端端点：

1. `GET /admin/crawler/kpi` — 5 张 KPI 卡数据 + siteStats 补充
2. `GET /admin/crawler/timeline` — 时间轴可视化聚合
3. `POST /admin/crawler/sites/:key/run` — 单站触发采集（RESTful alias）
4. `POST /admin/crawler/run-all` — 全站触发采集（RESTful alias）

触发原因：ADR-100 §4.5 R7 MUST-8 硬约束要求新增 admin route 必须先起独立 ADR + Opus PASS；`npm run verify:endpoint-adr` 自动核验。

**现状盘点**：
- `apps/api/src/routes/admin/crawler.ts` 已 960 行（baseline 豁免），承载 18+ 端点
- `GET /admin/crawler/overview` 返回 `CrawlerOverview`（siteTotal / connected / running / paused / failed / todayVideos / todayDurationMs）
- `GET /admin/crawler/system-status` 返回 schedulerEnabled / freezeEnabled / orphanTaskCount
- `GET /admin/crawler/monitor-snapshot` 聚合 overview + runs(20) + systemStatus
- `POST /admin/crawler/runs` 统一触发入口（triggerType='single'|'batch'|'all'，已有 audit `crawler.run_create`）
- `apps/api/src/routes/admin/crawlerSites.ts`（独立文件，sites CRUD 6 端点）

### 决策

新增 4 端点，文件归属采用**方案 A（单文件 `crawlerDashboard.ts`）**，POST 端点采用 **alias 委托模式复用 `CrawlerRunService.createAndEnqueueRun`**，audit 协议复用现有 `crawler.run_create` actionType 通过 `afterJsonb.triggerType` 区分。**ADR-121 7 文件框架降为 4 文件框架**（不扩 actionType union / ACTION_TYPES / 两 set-equal 测试）。

### 决策要点

**D-122-1（文件归属 — 方案 A：单文件 `crawlerDashboard.ts`）**

| 方案 | 描述 | 优 | 劣 |
|---|---|---|---|
| A | `apps/api/src/routes/admin/crawlerDashboard.ts`（4 端点） | 域内语义清晰；crawler.ts 不膨胀；单文件 < 200 行 | 新文件 |
| B | `crawler-redo.ts`（按 REDO 命名空间） | 开发期语义直白 | "redo" 是临时概念，cutover 后命名无意义 |
| C | 分 2 文件（kpi+timeline / sites-run+run-all） | 粒度最细 | overhead 不合理；触发端点与 KPI 共享查询上下文 |

裁决 A。理由：(1) crawler.ts（960 行）已 baseline 豁免、禁止追加；(2) 4 端点均为 Crawler 重做 dashboard 专用，语义统一；(3) `crawlerDashboard.ts` 遵循 `crawlerSites.ts` 同级先例。

**D-122-2（与现有端点关系评估）**

| 新端点 | 现有端点 | 关系 |
|---|---|---|
| `GET /kpi` | `GET /overview` | **部分重叠不替代** — `/overview` 7 字段服务 v1 monitor-snapshot；`/kpi` 7 字段 + `siteStats[]` 服务 server-next Crawler 页 |
| `GET /kpi` | `GET /system-status` | 不重叠（运维 vs 业务）|
| `GET /kpi siteStats` | `/admin/analytics/content-quality` | 不重叠（维度不同：site.key vs source_name 内容质量）|
| `GET /timeline` | `GET /monitor-snapshot` | 不冗余（数据模型完全不同）|
| `POST /sites/:key/run` + `POST /run-all` | `POST /runs` | alias（语法糖）|

结论：无端点需替代或 unify。`/overview` / `/system-status` / `/monitor-snapshot` v1 cutover 前保留；之后可考虑 DEPRECATED。

**D-122-3（POST run alias 复用 — 方案 A：alias 委托）**

`createAndEnqueueRun` 已 battle-tested（scheduler + 手动触发 + source-refetch 三入口消费），新增 2 RESTful alias 仅参数预设（triggerType + siteKeys），无独立实施必要。REDO-01-A 契约 §3.3/3.4 原文明确"内部委托 runService"。

**D-122-4（timeline SQL 聚合 — DB 窗口函数）**

`ROW_NUMBER() OVER (PARTITION BY source_site ORDER BY started_at DESC)`。`crawler_tasks` 日 < 2000 行；DB 侧 limit 8 比拉全量高效。回退：若 benchmark > 200ms，降级 `DISTINCT ON (source_site)`（PG 扩展语法等价）。

**D-122-5（audit 协议 — 复用 `crawler.run_create` + afterJsonb 区分）**

`crawler.run_create` 在 CHG-SN-6-26-RETRO 落地时 afterJsonb 已携带 `triggerType` / `mode` / `siteKeys`；审计 UI 可通过 afterJsonb 精确区分 single/all。

**ADR-121 7 文件框架降为 4 文件**（不扩 types union / ACTION_TYPES / 两 set-equal 测试）：
- 1 route 文件（`crawlerDashboard.ts` 含 4 端点 + auditSvc.write）
- 2 payload 内容断言新测试（`crawlerDashboard-run-audit.test.ts`）
- 3 audit-log-coverage.test.ts 仅扩 PAYLOAD it.each 中新增 site-run 子 case（不扩 REQUIRED 数组）
- 4 changelog 完成备注

**D-122-6（ADR 重叠核查表）**

| ADR | 冲突? | 说明 |
|---|---|---|
| ADR-014（采集域导航） | 无 | 4 端点均在 `/admin/crawler/*` |
| ADR-015（轮询不 SSE） | 无 | useQuery 轮询 |
| ADR-019（Ingest Policy） | 无 | 不修改 ingest_policy |
| ADR-100 R7 MUST-8 | 本 ADR 即合规产出 | |
| ADR-117 | 无 | 不涉及 source_line_aliases |
| ADR-121 | 无 | D-122-5 复用 actionType 合规 |

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/crawler/kpi` | 5 KPI + siteStats（dashboard 头部聚合） | — | 200 `{ data: CrawlerKpiResponse }`（含 totalSites / healthySites / runningSites / failedSites / batchVideoCount / batchVideoDelta / avgDurationSeconds / siteStats[]） | 401 / 403 |
| 2 | GET | `/admin/crawler/timeline` | 实时任务时间轴聚合 | Query: `range?='1h'` (`'30m'\|'1h'\|'2h'\|'6h'`) / `limit?=8` (max 20) | 200 `{ data: CrawlerTimelineResponse }`（rangeStart / rangeEnd / ticks / rows[]） | 401 / 403 / 422 VALIDATION_ERROR |
| 3 | POST | `/admin/crawler/sites/:key/run` | 单站触发采集（runService alias） | Body: `{ mode?: 'incremental'\|'full' }`（默认 incremental） | 202 `{ data: { runId, taskIds, enqueuedSiteKeys, skippedSiteKeys } }` | 401 / 403 / 404 NOT_FOUND / 422 / 503 CRAWLER_QUEUE_UNAVAILABLE |
| 4 | POST | `/admin/crawler/run-all` | 全站触发采集（runService alias） | Body: `{ mode?: 'incremental'\|'full' }`（默认 full） | 202 `{ data: { runId, taskIds, enqueuedSiteKeys, skippedSiteKeys } }` | 401 / 403 / 422 / 503 CRAWLER_QUEUE_UNAVAILABLE |

### 端点契约细节（按端点逐一展开）

#### 3.1 GET /admin/crawler/kpi

| 字段 | 值 |
|---|---|
| Method + Path | `GET /admin/crawler/kpi` |
| Auth | adminOnly |
| Request | 无参数 |
| Response 200 | `{ data: CrawlerKpiResponse }` |
| Error codes | 401 / 403 |
| Audit | 不需要（只读） |

```ts
interface CrawlerKpiResponse {
  totalSites: number
  healthySites: number
  runningSites: number
  failedSites: number
  batchVideoCount: number
  batchVideoDelta: number
  avgDurationSeconds: number
  siteStats: Array<{ key: string; routeCount: number; health: number }>
}
```

#### 3.2 GET /admin/crawler/timeline

| 字段 | 值 |
|---|---|
| Method + Path | `GET /admin/crawler/timeline` |
| Auth | adminOnly |
| Request query | `range: '30m'\|'1h'\|'2h'\|'6h'`（默认 `'1h'`）；`limit`（默认 8，max 20） |
| Response 200 | `{ data: CrawlerTimelineResponse }` |
| Error codes | 401 / 403 / 422 |
| Audit | 不需要（只读） |

```ts
interface CrawlerTimelineResponse {
  rangeStart: string
  rangeEnd: string
  ticks: string[]
  rows: Array<{
    siteKey: string
    siteName: string
    health: number
    startPct: number
    widthPct: number
    durationSeconds: number
    videoCount: number
    status: 'ok' | 'warn' | 'danger'
    last: string
  }>
}
```

#### 3.3 POST /admin/crawler/sites/:key/run

| 字段 | 值 |
|---|---|
| Method + Path | `POST /admin/crawler/sites/:key/run` |
| Auth | adminOnly |
| Request | path `key`; body `{ mode?: 'incremental'\|'full' }`（默认 `incremental`）|
| Response 202 | `{ data: { runId, taskIds, enqueuedSiteKeys, skippedSiteKeys } }` |
| Error codes | 401 / 403 / 404 / 409 CONFLICT / 422 / 503 |
| Audit | `crawler.run_create`（复用）|

audit payload：`{ actionType: 'crawler.run_create', targetKind: 'crawler_site', targetId: key, afterJsonb: { triggerType: 'single', mode, siteKeys: [key] } }`

#### 3.4 POST /admin/crawler/run-all

| 字段 | 值 |
|---|---|
| Method + Path | `POST /admin/crawler/run-all` |
| Auth | adminOnly |
| Request | body `{ mode?: 'incremental'\|'full' }`（默认 `full`）|
| Response 202 | `{ data: { runId, taskIds, enqueuedSiteKeys, skippedSiteKeys } }` |
| Error codes | 401 / 403 / 409 / 503 |
| Audit | `crawler.run_create`（复用）|

audit payload：`{ actionType: 'crawler.run_create', targetKind: 'system', targetId: run.runId, afterJsonb: { triggerType: 'all', mode } }`

### SQL 聚合策略

#### /kpi SQL（CTE 单次往返）

主查询使用 `WITH site_counts AS (...), running_count AS (...), today_tasks AS (...), yesterday_tasks AS (...)` 4 个 CTE + 主 SELECT，单次往返。siteStats 独立子查询避免主查询膨胀。

**性能预期**：< 100ms。**索引建议**：crawler_tasks 已有 `(source_site, scheduled_at)`；如 siteStats > 100ms 追加 covering index。

#### /timeline SQL（窗口函数 + range）

```sql
WITH ranked_tasks AS (
  SELECT ct.source_site, cs.name, ct.started_at, ct.finished_at, ct.status, ct.result,
         ROW_NUMBER() OVER (PARTITION BY ct.source_site ORDER BY ct.started_at DESC) AS rn
  FROM crawler_tasks ct JOIN crawler_sites cs ON cs.key = ct.source_site
  WHERE ct.type IN ('full-crawl','incremental-crawl')
    AND ct.scheduled_at >= NOW() - $1::interval
    AND ct.status IN ('running','done','failed')
)
SELECT * FROM ranked_tasks WHERE rn = 1
ORDER BY CASE WHEN status='running' THEN 0 ELSE 1 END, started_at DESC
LIMIT $2;
```

百分比（startPct / widthPct）Node.js 层算术。**性能预期**：< 50ms。**fallback**：> 200ms 降级 `DISTINCT ON (source_site)`。

### 后果

**正面**：
1. Crawler 重做 dashboard 获得专用 KPI + timeline 数据源
2. RESTful alias 简化前端调用链
3. crawlerDashboard.ts 控制 < 200 行，crawler.ts 不膨胀
4. audit 复用 `crawler.run_create` 零 4 真源同步成本
5. SQL 窗口函数有明确 fallback
6. 现有 v1 端点（/overview / /system-status / /monitor-snapshot）零影响

**负面**：
1. `/kpi` 与 `/overview` 字段部分重叠（v1 cutover 前并行）
2. crawler 域路由从 2 文件增至 3 文件
3. timeline SQL 对 crawler_tasks 行数增长敏感（> 10k/天需重评）
4. siteStats LEFT JOIN video_sources 依赖 `video_sources.source_name` 索引

### 替代方案对比

| 维度 | A: 单文件 + alias（采纳）| B: crawler-redo.ts + 独立实施 | C: 分 2 文件 + 独立实施 |
|---|---|---|---|
| 文件归属 | 单文件 < 200 行，命名持久 | 命名临时（cutover 后无意义）| 过度碎片化 |
| POST 逻辑 | 复用 runService 零重复 | 100+ 行重复 | 同 B |
| audit 成本 | 复用 actionType，4 文件 | 新增 2 actionType，7 文件 x2 | 同 B |
| **裁决** | **选定** | 拒绝 | 拒绝 |

### 未来"重新评估"触发条件

1. crawler_tasks 日增 > 10,000 行 → 重评 timeline SQL；考虑物化视图
2. v1 apps/server 退场（M-SN-7 cutover）→ 评估 `/overview` / `/system-status` / `/monitor-snapshot` DEPRECATED；`/kpi` 可吸收合并
3. siteStats routeCount 语义从 video_sources 演进为 source_line_aliases 表 → 修改 JOIN
4. admin 审计 UI 若需按 single/all 精确筛选 actionType（而非 afterJsonb）→ 重评拆 actionType
5. 新增超过 2 个写端点到 crawlerDashboard.ts → 评估再拆分

### 关联

- `docs/M-SN-7-redo-01-contract.md` §3（4 端点契约提纲）
- `apps/api/src/routes/admin/crawler.ts`（现有 18+ 端点不修改）
- `apps/api/src/routes/admin/crawlerSites.ts`（命名先例）
- `apps/api/src/services/CrawlerRunService.ts`（`createAndEnqueueRun` alias 委托目标）
- `apps/api/src/db/queries/crawlerTasks.ts`（`getCrawlerOverview` /kpi 参考实现）
- `apps/api/src/services/AuditLogService.ts` ACTION_TYPES（本 ADR 不扩展）
- `tests/unit/api/audit-log-coverage.test.ts`（不修改 REQUIRED）
- ADR-014 / 015 / 019 / 100 / 117 / 121

### 4 维度自评

| 维度 | 评估 |
|---|---|
| 命名 | `crawlerDashboard.ts` 遵循 `crawlerSites.ts` 先例；4 端点 path 对称（kpi/timeline 读；sites/:key/run 与 run-all 写） |
| 对称性 | 读端点无 audit、无 body；写端点统一 202 + audit；请求结构对称（mode） |
| 状态职责 | 聚合在 DB queries 层 / 触发在 Service 层 / Route 零业务逻辑 |
| 扩展性 | timeline range 枚举可增；siteStats 字段可追加；kpi 新指标可追加 response 字段不破坏向后兼容 |
| **综合** | **A** |

---

## ADR-117 AMENDMENT 2026-05-19（CHG-SN-7-REDO-01-E）— GET routes by-site 端点

**触发**：CHG-SN-7-REDO-01-A 锁定的 contract §1.5 `CrawlerSiteExpand` 行展开 sub-table 需按 `siteKey` 维度聚合渲染线路明细 6 列（线路名 / 别名 / 探测 / 播放 / 延迟 / 操作）。ADR-117 既有 5 端点全部按 `videoId` 或全局 alias 维度，无 by-siteKey 聚合路径。前置裁决 D1=C 拍板"在 sources 域加新端点（不在 crawler 域加，不改造现有端点）"。本 AMENDMENT 仿 ADR-105 AMENDMENT 2026-05-14 范式扩 row 6，零新协议决策。

**范围**：扩 ADR-117 §端点契约 row 6（GET `/admin/sources/routes/by-site/:siteKey`），复用 ADR-117 既有协议层（鉴权分级 / ApiResponse 信封 / ADR-110 14 码 / Service→queries 分层 / camelCase 转换 / `.strict()` zod）。**零新协议决策**。同时修订 contract §1.5 别名 inline-edit 路径（D4）。

### 端点契约（row 6 完整规格）

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|---|---|---|---|---|---|---|
| 6 | GET | `/admin/sources/routes/by-site/:siteKey` | 按站点聚合线路明细（含别名 LEFT JOIN + worst 状态聚合 + 平均延迟） | Path: `siteKey: string(1..100)` | 200 `{ data: SourceRouteBySite[] }` | moderator+admin | 422 VALIDATION_ERROR / 500 INTERNAL_ERROR |

- **鉴权**：`requireRole(['moderator', 'admin'])`，对齐 ADR-117 既有 4 个读端点（row 1-4）；moderator 可查询不可写（写仍走 row 5 admin only / Y1）
- **Path 校验**：`siteKey` `min(1).max(100)`，与 migration 046 `source_site_key VARCHAR(100)` + ADR-117 既有 `UpsertAliasParamsSchema` 同形态
- **Query**：无（首版不支持过滤；未来如需 `probeStatus?` / `isActive?` 经第二次 AMENDMENT 扩）
- **Response 信封**：`{ data: SourceRouteBySite[] }`（不分页，单站点线路数预期 ≤ 200）
- **错误码**：100% 复用 ADR-110 既有 14 码；零新增

### 类型契约

`packages/types/src/sources-matrix.types.ts` 追加：

```ts
/**
 * /admin/sources/routes/by-site/:siteKey 行（ADR-117 AMENDMENT 2026-05-19）
 * 单站点聚合一条线路（sourceName）跨 N 个 video_sources 行的状态 + 平均延迟 + 别名
 */
export interface SourceRouteBySite {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string | null            // LEFT JOIN source_line_aliases
  readonly probeStatus: DualSignalState          // worst across rows（aggregateSignal 复用）
  readonly renderStatus: DualSignalState         // worst across rows
  readonly avgLatencyMs: number | null           // AVG(latency_ms) WHERE latency_ms IS NOT NULL；全 NULL → null
  readonly sourceCount: number                   // 该 (siteKey, sourceName) 下的 video_sources 行数
  readonly activeCount: number                   // 其中 is_active = true 的行数
  readonly lastProbedAt: string | null           // MAX(last_probed_at)
}
```

类型复用：`DualSignalState`（既有 admin-moderation.types.ts:39，4 值）；`aggregateSignal()` Service 层既有函数 100% 复用（SourcesMatrixService.ts:63）。

### zod request schema

```ts
const RoutesBySiteParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
}).strict()
```

与 ADR-117 §zod 既有 `UpsertAliasParamsSchema` 的 siteKey 字段同形态。

### SQL 设计

`apps/api/src/db/queries/sources-matrix.ts` 追加 `listRoutesBySite(db, siteKey)`：

```sql
SELECT
  COALESCE(vs.source_site_key, v.site_key)        AS source_site_key,
  vs.source_name                                  AS source_name,
  sla.display_name                                AS display_name,
  STRING_AGG(DISTINCT vs.probe_status, ',')       AS probe_statuses,
  STRING_AGG(DISTINCT vs.render_status, ',')      AS render_statuses,
  AVG(vs.latency_ms) FILTER (WHERE vs.latency_ms IS NOT NULL) AS avg_latency_ms,
  COUNT(*)                                        AS source_count,
  COUNT(*) FILTER (WHERE vs.is_active = true)     AS active_count,
  MAX(vs.last_probed_at)                          AS last_probed_at
FROM video_sources vs
JOIN videos v ON v.id = vs.video_id
LEFT JOIN source_line_aliases sla
  ON sla.source_site_key = COALESCE(vs.source_site_key, v.site_key)
 AND sla.source_name     = vs.source_name
WHERE COALESCE(vs.source_site_key, v.site_key) = $1
  AND vs.deleted_at IS NULL
GROUP BY COALESCE(vs.source_site_key, v.site_key), vs.source_name, sla.display_name
ORDER BY vs.source_name ASC
```

**设计要点**：
- `COALESCE(vs.source_site_key, v.site_key)` fallback 至 `videos.site_key`（migration 046 决定 vs 列 NULLABLE）
- **worst 聚合走 Service 层既有 `aggregateSignal()`**：DB 仅 `STRING_AGG(DISTINCT ...)` 拼 raw 状态，Service split + 调函数；与 row 1 `listVideoGroups` 100% 对称（**零新业务逻辑**）
- **平均延迟选 AVG 不选 p95**：单站点单线路样本预期 < 50，PG 无原生 percentile_disc 高性能实现；未来需 p95 起 PRE-ROUTES-BY-SITE-P95 卡
- LEFT JOIN aliases 与 row 3 `getVideoMatrix` 既有别名合并模式同源
- `vs.deleted_at IS NULL` 软删除过滤与 row 3 一致
- 索引利用 migration 046 + `videos.site_key` 既有索引联合覆盖 WHERE；GROUP BY 走 HashAggregate

### audit log 协议

**只读 GET 不写 admin_audit_log**（与 ADR-117 既有 4 读端点 + ADR-105 AMENDMENT 2026-05-14 audit 端点同语义）。`AdminAuditActionType` / `AdminAuditTargetKind` **零扩枚举**。`audit-log-coverage.test.ts` `REQUIRED_ACTION_TYPES` 保持不变。

### 性能 + 缓存

- **首版无缓存**：单站点线路数 ≤ 200，GROUP BY + LEFT JOIN 单表 + 既有索引，p95 预估 ≤ 80ms
- **触发条件**（任一命中起 PRE-CACHE-SOURCES-BY-SITE 卡）：(a) p95 > 200ms 持续 1 周；(b) 单站点 video_sources 行数 > 5000；(c) 前端 expand 触发频次 > 100/min

### 评审要点决策（Opus 子代理 1 轮 PASS）

- **E1 路径命名**：选 A `/admin/sources/routes/by-site/:siteKey`（`routes` 子资源首次命名、`by-site` 习语明示聚合查询；不与 row 1-5 既有路径产生 prefix 歧义；未来 `by-video/:videoId` 完全对称）
- **E2 跨域查询边界**：前端 fn 放 `apps/server-next/src/lib/sources/api.ts`（按域归属 / lib 共享层互通走 plan §4.6 既有规则，不需新豁免）；后端 sources-matrix.ts 107→~130 行不超 500 行红线
- **E3 别名 inline-edit 路径修正**：保持 ADR-117 row 5 `PUT /admin/source-line-aliases/:siteKey/:sourceName` admin only 不变；contract §1.5 line 191 misalignment 修订条款见下方
- **E4 E vs E2 拆分合理**：本 E 卡（GET + 骨架 + alias inline-edit）+ E2 卡（3 mutations + ADR + audit RETRO）总和 ~0.7w，反映 D2=拆决策真实成本
- **E5 worst_status 聚合算法**：**复用 ADR-117 既有 `aggregateSignal()`**（零新业务逻辑；与 row 1 by-videoId matrix 视图状态色一致）

### 黄线（实施建议）

- **Y1**：REDO-01-E 前端代码必须实现 moderator 角色时 alias inline-edit **隐藏/禁用** affordance（避免 PUT 403 时 UI 体验破碎）
- **Y2**：E 卡估时 0.4w / E2 卡估时 0.3w 偏紧；建议主循环同步 task-queue 重估为 **0.35w + 0.35w**（总和 0.7w）反映 D2 拆分真实成本

### 4 维度自评（Opus 子代理）

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | 路径 + 类型 + 字段 100% 对齐 ADR-117 既有 row 1-5；`by-site` 习语 RESTful |
| 对称性 | A | response 信封 / 错误码 / 鉴权 / zod `.strict()` / camelCase / Service→queries 分层 100% 复用；零设计自由度 / 零新 actionType / 零新 targetKind / 零新 ErrorCode / 零新 migration |
| 状态职责 | A | 只读 + 无 audit + 无缓存 + 无 mutation；缓存触发条件明示三条；E vs E2 边界明示 |
| 扩展性 | A- | 未来 `by-video/:videoId` 单线路读端点完全对称；E2 mutations 路径前缀同 `/sources/routes/` 命名空间一致；扣 A- 是 `:id` 子路径与 `by-site/:siteKey` 并列时 E2 ADR 需显式说明三类子路径区分 |

**综合**：**A**

### 关联

- ADR-117 §端点契约扩 row 6；既有 5 行不变
- ADR-114-NEGATED 复合键 `(source_site_key, source_name)` 严格延续；GROUP BY 同键
- ADR-110 response 信封 + 14 错误码 100% 复用
- migration 046 / 054 / 063 schema 完备；**无新 migration**
- **contract §1.5 misalignment 修订条款**（D4 / 本卡内修订）：
  - 原文（M-SN-7-redo-01-contract.md line 191）："别名 inline-edit：`PATCH /admin/sources/routes/:id`（现有跨模块 API）"
  - **正确写法**："别名 inline-edit：`PUT /admin/source-line-aliases/:siteKey/:sourceName`（ADR-117 row 5；admin only — moderator UI 隐藏/禁用 / Y1）"
  - 原文（line 195）"API 缺口"段：保留为"sources 域扩 row 6 by-site 端点（本 AMENDMENT 落地）"
- **关联代码（由 REDO-01-E 实施卡落地）**：
  - `apps/api/src/db/queries/sources-matrix.ts` 增 `listRoutesBySite`
  - `apps/api/src/services/SourcesMatrixService.ts` 增 `listRoutesBySite(siteKey)` 方法（复用 `aggregateSignal`）
  - `apps/api/src/routes/admin/sources-matrix.ts` 增 `GET /admin/sources/routes/by-site/:siteKey`
  - `packages/types/src/sources-matrix.types.ts` 增 `SourceRouteBySite`
  - `apps/server-next/src/lib/sources/api.ts` 增 `listRoutesBySite(siteKey)` 前端 fn
- **关联触发条件**：PRE-ROUTES-BY-SITE-PAGINATION / PRE-ROUTES-BY-SITE-P95 / PRE-CACHE-SOURCES-BY-SITE

**关键发现**：本 AMENDMENT 再次验证 plan §4.5 "同一 ADR 下多端点复用同一 ADR 不重复评审"机制；REDO-01-E 后端工时从规划的 0.4w（新 ADR-124 起草 + Opus 评审 + 端点）降至 ~0.15w（AMENDMENT + 端点 + 前端共调），前端骨架 ~0.2w，总 ~0.35w（Y2 同步重估）。


---

## ADR-117 AMENDMENT 2 2026-05-19（CHG-SN-7-REDO-01-E2）— 行级 3 mutations 端点

**触发**：REDO-01-E AMENDMENT 1 落地 row 6 GET by-site 端点 + 前端 CrawlerSiteExpand 6 列 sub-table 后，3 actions 按钮（play / refresh / trash）现为 disabled 占位（commit `6c5824b9`）。本 AMENDMENT 2 完成 3 mutations 后端协议 + audit RETRO + 前端按钮接入 + moderator UI guard。仿 ADR-105 AMENDMENT 2026-05-14 + ADR-117 AMENDMENT 1 范式。

**范围**：扩 ADR-117 §端点契约 row 7-9；扩 `AdminAuditActionType` +1（`sources.route_action`）+ `AdminAuditTargetKind` +1（`source_route`）；复用 ADR-117 既有协议层（ApiResponse 信封 / ADR-110 14 码 / Service→queries 分层 / camelCase / `.strict()` zod / 鉴权 admin only 对齐 row 5）。**零新 migration / 零新 ErrorCode**。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|------|------|------|---------|----------|------|--------|
| 7 | POST | `/admin/sources/routes/by-site/:siteKey/:sourceName/test` | 测试播放（同步快探 episode 1 + 异步触发全线路 probe job） | Path: `siteKey: string(1..100)`, `sourceName: string(1..200)` | 200 `{ data: RouteTestResult }` | admin | 422 / 404 NOT_FOUND（线路不存在）/ 500 |
| 8 | POST | `/admin/sources/routes/by-site/:siteKey/:sourceName/reprobe` | 重新探测：enqueue 全线路 probe job（不同步） | Path 同上 | 200 `{ data: RouteReprobeResult }` | admin | 422 / 404 / 409 STATE_CONFLICT（freeze）/ 500 |
| 9 | DELETE | `/admin/sources/routes/by-site/:siteKey/:sourceName` | 软删除该线路下所有 video_sources 行 | Path 同上 | 200 `{ data: RouteDeleteResult }` | admin | 422 / 404 / 409 STATE_CONFLICT（freeze）/ 500 |

- **鉴权**：`requireRole(['admin'])`，与 row 5 alias upsert 对齐；moderator 前端 Y1 守卫隐藏按钮 + alias inline-edit disabled
- **Path 校验**：`siteKey.min(1).max(100)` + `sourceName.min(1).max(200)`
- **错误码**：100% 复用 ADR-110；freeze 守卫**复用 `STATE_CONFLICT 409`**（与 videos/staging/video-merges 现有 freeze/state guard 同模式 / Opus ADR 误用 SERVICE_UNAVAILABLE 503 已修正为 STATE_CONFLICT 409 / ADR-110 14 码零新增红线遵守）
- **响应不分页**：test/reprobe 异步任务 jobId 由前端轮询既有 worker 状态端点

### 类型契约

`packages/types/src/sources-matrix.types.ts` 当前 inline 在 SourcesMatrixService.ts（next REDO-01-E2 PATCH 可迁出共享层）：

```ts
export interface RouteTestResult {
  readonly ok: boolean
  readonly latencyMs: number | null
  readonly sampleVideoId: string | null
  readonly probeJobId: string
}
export interface RouteReprobeResult {
  readonly probeJobId: string
  readonly queuedCount: number
}
export interface RouteDeleteResult {
  readonly deletedCount: number
  readonly deletedIds: readonly string[]
}
```

### zod request schema

```ts
export const RouteActionParamsSchema = z.object({
  siteKey: z.string().min(1).max(100),
  sourceName: z.string().min(1).max(200),
}).strict()
```

### SQL 设计（row 9 删除）

```sql
UPDATE video_sources vs
   SET deleted_at = NOW(), updated_at = NOW()
  FROM videos v
 WHERE vs.video_id = v.id
   AND COALESCE(vs.source_site_key, v.site_key) = $1
   AND vs.source_name = $2
   AND vs.deleted_at IS NULL
RETURNING vs.id
```

- 软删除范式延续 ADR-105（merge/unmerge 软删除先例）+ U2 拍板（不硬删 / 可回滚 / audit 回放）
- COALESCE fallback 与 row 6 `listRoutesBySite` 完全一致（migration 046 NULLABLE 约束）
- RETURNING 行 ids = `deletedIds`；前 50 条入 audit beforeJsonb，超出标记 `truncated=true`

### audit log 协议

**新增 1 actionType + 1 targetKind**（ADR-121 D-121-5 复用 actionType 模式延续）：

| 端点 | actionType | targetKind | targetId | beforeJsonb | afterJsonb |
|------|-----------|------------|----------|-------------|------------|
| POST `/test` | `sources.route_action` | `source_route` | `${siteKey}/${sourceName}` | null | `{ action: 'test', ok, latencyMs, sampleVideoId, probeJobId }` |
| POST `/reprobe` | `sources.route_action` | `source_route` | `${siteKey}/${sourceName}` | null | `{ action: 'reprobe', probeJobId, queuedCount }` |
| DELETE | `sources.route_action` | `source_route` | `${siteKey}/${sourceName}` | `{ deletedIds: string[≤50], totalCount, truncated }` | `{ action: 'delete', deletedCount }` |

**audit RETRO 框架 = 4 文件**（ADR-121 D-121-5 复用 actionType 模式 / R-MID-1 系统化第 13 次）：

1. `packages/types/src/admin-moderation.types.ts` — `AdminAuditActionType` +1 `sources.route_action` / `AdminAuditTargetKind` +1 `source_route`
2. `apps/api/src/services/AuditLogService.ts` — `ACTION_TYPES` 数组 +1 / `TARGET_KINDS` 数组 +1
3. `tests/unit/api/audit-log-coverage.test.ts` — `REQUIRED_ACTION_TYPES` +1 + `PAYLOAD_ASSERTION_REQUIRED` 已含（service test 覆盖）+ set-equal test 自动通过；`tests/unit/api/audit-log-service-enums-set-equal.test.ts` EXPECTED_* +1/+1
4. `apps/api/src/routes/admin/sources-matrix.ts` 3 route handlers + Service 内 `auditSvc.write(...)` + 新建 `tests/unit/api/sources-routes-mutations-audit.test.ts` 10 case 含 payload 内容断言（`expect.objectContaining` 形式覆盖 audit-log-coverage R-MID-1 守卫）

### 测试播放语义（U4 落地）

- **同步快探**：Service 层 SELECT episode 1 source_url + Node `fetch(url, {method:'HEAD', signal: AbortSignal.timeout(3000)})`；返回 `ok = res.ok && res.status < 400`，`latencyMs = Math.round(performance.now() diff)`
- **异步全量**：占位 jobId 模式（`probe-${siteKey}-${sourceName}-${Date.now()}` / `reprobe-${siteKey}-${sourceName}-${Date.now()}`）；实际对接 source-health worker 由 PRE-PROBE-WORKER 后续卡承担
- **404 处理**：若 (siteKey, sourceName) 无任何 deleted_at IS NULL 行 → 404 NOT_FOUND；不空跑 probe
- **超时不视为失败**：3s 超时返回 `ok=false, latencyMs=null`（不抛 5xx / Opus Y3 上限红线）

### moderator UI guard（U5 落地）

- **后端**：3 端点 `requireRole(['admin'])`（与 row 5 alias upsert 对齐）
- **前端**：`apps/server-next/src/app/admin/crawler/_client/CrawlerSiteExpand.tsx` 加 `currentRole?: 'admin' | 'moderator'` prop（缺省 admin / 兼容尚未注入 role 的消费方）；3 actions + alias inline-edit `disabled={currentRole !== 'admin'}` + tooltip `'该操作需要管理员权限'`
- **rationale**：3 mutations 不可逆性（尤其 delete）+ 与 row 5 alias upsert admin only 对齐；前端守卫避免 403 toast 体验破碎（Y1）

### freeze 守卫

Service 层 `assertNotFrozen()` 私有方法 reads `crawler_global_freeze` settings；reprobe + delete 必查 / test 不查（只读探测 / Y2）。
freeze=true → `throw new AppError('STATE_CONFLICT', '采集已冻结，不可执行线路操作', 409)`；Route 层 `isAppError(err, 'STATE_CONFLICT')` → 409 toast。

### 评审要点决策（Opus 子代理 1 轮 PASS）

- **U1 路径**：A `/by-site/:siteKey/:sourceName[/test|/reprobe]` + DELETE 同前缀（与 row 6 GET `/by-site/:siteKey` 命名空间对称；拒 B verb-in-body / 拒 C composite-id 编码）
- **U2 删除语义**：B 软删除 `deleted_at`（可回滚 + audit 回放 + 与读路径过滤一致；拒 A 硬删 / 拒 C is_active 与 video_source.toggle 语义混淆）
- **U3 actionType**：A 合并 `sources.route_action` + `afterJsonb.action` 区分（ADR-121 D-121-5 范式 / 4 文件 RETRO；targetKind 新增 `source_route` 区别 source_line_alias 元数据 vs 行操作目标）
- **U4 test 语义**：C 同步快探（HEAD 3s）+ 异步全量 probe job 占位（运营即时反馈 + 后续 worker 对接预留 jobId 接口）
- **U5 moderator guard**：B 后端 admin only + 前端 role prop 守卫（与 row 5 + AMENDMENT 1 Y1 同模式）

### 红线 / 黄线 / advisory

**红线（已遵守）**：
- R1：3 端点走 `requireRole(['admin'])` ✅
- R2：DELETE 软删除（deleted_at = NOW()） ✅
- R3：audit RETRO 4 文件当卡完成 ✅

**黄线（已遵守）**：
- Y1：moderator UI guard 前端 `currentRole !== 'admin'` 隐藏 affordance ✅
- Y2：freeze 守卫仅 reprobe + delete / test 不守卫 ✅
- Y3：test HEAD 超时 3s 硬上限 / `AbortSignal.timeout(3000)` ✅

**advisory**：
- A1：未来 `POST /by-site/:siteKey/:sourceName/restore` 撤销软删除 → 起 PRE-ROUTE-RESTORE 卡 + `afterJsonb.action='restore'` 扩展（4 文件 RETRO 复用）
- A2：probeJobId 当前为占位字符串；PRE-PROBE-WORKER 后续卡对接 source-health 真实 BullMQ jobId
- A3：错误码 ADR-110 14 码无 SERVICE_UNAVAILABLE 503；本卡复用 STATE_CONFLICT 409 表达 freeze（Opus 初稿误用 503 已修正 / ADR-110 14 码零新增红线遵守）

### 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | 路径与 row 6 GET 完全对称；actionType `sources.route_action` 与 `source_line_alias.upsert` 同 sources 域风格；targetKind `source_route` vs `source_line_alias` 双名清晰区分行操作 vs 元数据 |
| 对称性 | A | 鉴权 admin only 与 row 5 100% 对齐；zod `.strict()` / camelCase / Service→queries 分层 / ApiResponse 信封 100% 复用；audit RETRO 4 文件延续 ADR-121 D-121-5 |
| 状态职责 | A | DB 写边界明确（仅 row 9 写 video_sources.deleted_at）；test/reprobe 不改持久状态；freeze 守卫边界明示；audit beforeJsonb/afterJsonb 语义清晰 |
| 扩展性 | A | 未来 restore / batch delete / 单视频 source toggle 全部走 afterJsonb.action 扩展（actionType 不增）；新 action 仅需扩 PAYLOAD it.each + content assertion test |

**综合**：**A**

### 关联

- ADR-117 §端点契约扩 row 7-9；既有 1-6 行 + AMENDMENT 1 row 6 不变
- ADR-114-NEGATED 复合键 `(source_site_key, source_name)` 严格延续
- ADR-110 response 信封 + 14 错误码 100% 复用；零新增码
- ADR-121 R-MID-1 audit RETRO D-121-5 复用 actionType 4 文件框架严格延续（第 13 次系统化）
- ADR-105 AMENDMENT 2026-05-14 软删除范式延续
- migration 046 / 054 / 063 schema 完备；**无新 migration**
- **关联代码（实施落地）**：
  - `apps/api/src/db/queries/sources-matrix.ts` 增 `selectRouteSampleSource` / `countRouteSources` / `softDeleteRouteBySite`
  - `apps/api/src/services/SourcesMatrixService.ts` 增 `testRoute` / `reprobeRoute` / `deleteRoute` + `assertNotFrozen` 私有方法
  - `apps/api/src/routes/admin/sources-matrix.ts` 增 row 7-9 3 端点 + auditSvc.write
  - `packages/types/src/admin-moderation.types.ts` 扩 actionType + targetKind
  - `apps/api/src/services/AuditLogService.ts` ACTION_TYPES + TARGET_KINDS +1
  - `tests/unit/api/audit-log-coverage.test.ts` REQUIRED_ACTION_TYPES + PAYLOAD_ASSERTION_REQUIRED +1
  - `tests/unit/api/audit-log-service-enums-set-equal.test.ts` EXPECTED_ACTION_TYPES + EXPECTED_TARGET_KINDS +1
  - `tests/unit/api/sources-routes-mutations-audit.test.ts` 新建 10 case
  - `apps/server-next/src/lib/sources/api.ts` 增 `testRoute / reprobeRoute / deleteRoute` 3 前端 fn + 类型
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteExpand.tsx` 3 actions onClick + confirm + role 守卫
- **关联触发条件**：PRE-ROUTE-RESTORE / PRE-PROBE-WORKER / PRE-ROUTE-BATCH-DELETE

**关键发现**：本 AMENDMENT 2 + AMENDMENT 1 双次验证 plan §4.5 "同 ADR 下多端点复用同 ADR 不重复评审"机制；REDO-01-E2 工时实际 ~0.3w（后端 3 endpoints + audit 4 文件 RETRO + 前端 3 按钮接入 + role 守卫；Y2 重估 0.35w 准确）。

