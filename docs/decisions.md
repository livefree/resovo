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
