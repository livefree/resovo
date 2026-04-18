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
