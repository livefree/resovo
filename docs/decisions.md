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

## NEGATED ADR 占位语义（ADR-NNN-NEGATED，CHG-SN-7-LOW-2）

> 2026-05-20 追加

当一个架构候选方案**经过评估后被否定、不实施**时，使用 `ADR-NNN-NEGATED` 范式记录。

### 规则

1. **原 ADR 编号保留**：`ADR-NNN-NEGATED` 占用该编号；原编号不再用于其他决策。
2. **plan §4.7 候选清单**：对应条目状态标注为 `候选 → NEGATED（CHG-SN-X-XX / YYYY-MM-DD）`，保留占位不删除。
3. **内容要求**：NEGATED 条目需包含：否定对象 / 否定理由（为何不实施）/ 触发重评估的条件。
4. **未来重启路径**：如未来条件满足需重新评估，使用 `ADR-NNNa`（例：ADR-119a），**不复用**原 `ADR-NNN` 编号。
5. **AI 行为约束**：遇到 NEGATED 标记时，不得将该方案作为"当前技术栈选型"推荐；需主动提示该方案已被否定及重启条件。

### 已有先例

| ADR | 否定对象 | 否定依据 | 重启条件 |
|-----|---------|---------|---------|
| **ADR-114-NEGATED** | line_key 一级建模 + 跨站合并 | 复合键 `(source_site_key, source_name)` 更稳定，无强烈跨站合并需求 | 明确的跨站合并业务需求 + 数据量规模 |
| **ADR-119-NEGATED** | Analytics 图表库（recharts / visx） | 内联 SVG / CSS 覆盖当前需求；引入图表库成本 > 收益 | 超过 3 处复杂图表组件且 SVG 方案维护成本过高 |
| **ADR-120-NEGATED** | 虚拟滚动库（@tanstack/react-virtual / react-window） | 当前数据量 < 50k，DataTable 原生分页已满足性能要求 | 单列表数据量 > 50k 且首屏渲染 > 200ms |

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
- **状态**：已采纳，不可推翻（见下方两次 AMENDMENT — Refresh Token TTL 由 CHG-37 调整，Access Token TTL 由 ADR-148 改为 KV 驱动）
- **决策**：Access Token 15 分钟有效期存内存，Refresh Token 7 天存 HttpOnly + Secure Cookie
- **理由**：防止 XSS 窃取 Token，对国际化平台尤其重要
- **架构约束**：
  - Access Token 不得存入 `localStorage` 或 `sessionStorage`
  - Refresh Token 只通过 Cookie 传递，不出现在响应 body 中
  - 登出时服务端将 Refresh Token 加入 Redis 黑名单（key 格式：`blacklist:rt:<token_hash>`）
  - Redis 黑名单 TTL = Refresh Token 剩余有效期
- **影响文件**：`src/api/routes/auth.ts`，`src/lib/auth.ts`

### ADR-003 AMENDMENT 2026-05-23（CHG-SN-8-CHORE-DOCS-DRIFT-SYNC）— TTL 事实同步

**触发**：CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A（commit dd71d1a2）已将 Access Token TTL 默认值从硬编码 15m 改为 KV `session_timeout_minutes` 驱动（默认 60m / 范围 [5, 1440]），引用 ADR-148 D-148-1..8 Opus A PASS（commit e34b1229）。同时 CHG-37 早期已将 Refresh Token TTL 从 7d 调整为 30d（见 `apps/api/src/lib/auth.ts:19` 注释 `// CHG-37: 7d → 30d`）。本 AMENDMENT 仿 ADR-105 / ADR-117 既有 AMENDMENT 范式追溯回填，**零新协议决策 / 零代码改动**。

**TTL 实际值（2026-05-23 实证）**：

| Token | 原 ADR-003 描述 | 当前生效值 | 变更来源 |
|---|---|---|---|
| Access Token | 15m 固定 | 默认 60m / 范围 [5, 1440] / KV `session_timeout_minutes` 驱动 | ADR-148（D-148-1..8 Opus A PASS / migration 066 seed） |
| Refresh Token | 7d 固定 | 30d 固定 | CHG-37（`auth.ts:19` 注释 `// CHG-37: 7d → 30d`） |
| Redis 黑名单 TTL | = Refresh Token 剩余有效期 | 不变（30d 自然延伸） | — |
| user:rca Redis 缓存 TTL | （ADR-003 不涉及，ADR-139 引入） | `max(900, session_timeout_minutes * 60)` 秒 | R-148-4（ADR-139 user:rca 与动态 timeout 同步修复） |

**架构约束不变**：

- Access Token 仍**不存 `localStorage` / `sessionStorage`**（内存持有 / 仅请求 header `Authorization: Bearer`）— XSS 防御原则未受 TTL 改变影响
- Refresh Token 仍**仅 HttpOnly + Secure Cookie 传递**，不在响应 body 中
- Redis 黑名单写入逻辑（key 格式 `blacklist:rt:<token_hash>` + TTL 对齐 refresh 剩余有效期）不变
- 与 ADR-139（角色变更 invalidate）兼容：access token `iat` 校验语义保持；R-148-4 同步修复 user:rca Redis TTL 避免动态 timeout 与缓存 TTL 失配导致权限穿越窗口

**未在本 AMENDMENT 覆盖**（独立 ADR 决策）：

- **session_max_concurrent 消费**（多并发会话 / 踢出策略）— N1-148-1 待独立 ADR-NNN 评估（需 user_sessions 表 + 跨设备 UX 决策）
- **session_extend_on_activity 消费**（活跃 sliding renewal）— N1-148-2 待独立 ADR-NNN 评估（与本 ADR-003 「access token 不存 cookie」张力 / 需 X-New-Access-Token header 方案评估）
- **KV 缓存升级 Redis**（每次查 DB → cache EX 60s）— N1-148-3 / login QPS > 100 触发

**关联**：

- ADR-148（access token TTL KV 驱动 / D-148-1..8 / Opus A PASS）— 本 AMENDMENT 引用的主依据
- ADR-139（角色变更 invalidate / user:rca Redis 缓存）— R-148-4 兼容性修复点
- ADR-146（admin webhook KV 消费同期范式 / fire-and-forget Dispatcher）— 同期 KV 字段消费协议
- CHG-37（Refresh Token 7d → 30d 历史变更 / `auth.ts:19` 注释真源）

**评级**：本 AMENDMENT **零决策 / 零代码 / 仅事实同步**，不进行 4 维度自评；引用既有 Opus PASS（ADR-148 A 级）作为真源。

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

---

### AMENDMENT 2026-05-26（CHG-342 / ADR-157 §6 验收第 8 条）

**关联**：ADR-157「视频枚举值跨层 SSOT 协议」要求落地时同步声明本 ADR 与 `packages/admin-ui` enums helpers 的关系。

**明确边界**：
- `apps/web-next/src/lib/categories.ts` `ALL_CATEGORIES`（本 ADR §4 SSOT）：**前台导航/筛选/路由 SSOT**，含 `typeParam` (URL slug，如 `tvshow→variety` 映射) + `videoType` (API 参数) + `labelKey` (i18n key)。
- `packages/admin-ui/src/enums/getVideoTypeOptions(t?)`（ADR-157 D-157-2）：**后台 Option SSOT**，跨包 helper 接受 i18n TFunction，返回 `AdminSelectOption<VideoType>[]`。

**关系**：**并存，无替代关系**。前台导航/路由场景用 `ALL_CATEGORIES`（含 URL slug 映射特殊性）；后台/通用 Option 选择器场景用 admin-ui helpers（含 TFunction i18n 注入）。

**消费方选择决策表**：

| 场景 | 用 | 理由 |
|------|----|------|
| 前台路由 / nav 菜单 / 分类页 | `ALL_CATEGORIES` | 含 typeParam URL slug 映射 (tvshow→variety) |
| 前台 SearchPage tab | `ALL_CATEGORIES` | CHG-342 已迁移 / 复用 labelKey i18n |
| 后台 admin select 下拉 | `getVideoTypeOptions(t?)` | 通用 Option + TFunction 注入 |
| 跨包 / packages/admin-ui 内 | `getVideoTypeOptions(t?)` | enums helpers SSOT |

**禁止**：在 `apps/web-next` 路由 / nav 上下文中改用 admin-ui helpers（会丢失 URL slug 映射特殊性）。

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
- **背景**：apps/server（旧后台）累积 9 大痛点（详见 `docs/archive/2026Q2/admin-v1/admin_audit_20260426.md` §7），ModernDataTable 采纳率 58%，22 admin 模块/122 端点工程债务深；继续在 apps/server 内增量修复 ROI 低、风险高。Claude Design 已输出 v2.1 后台设计稿（IA 重排 + 16 视图 mock，详见 `docs/designs/backend_design_v2.1/`）。立项 apps/server-next 独立壳承接重写。
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

> **AMENDMENT 2026-05-23（ADR-149 / CHG-SN-9-DT-HEADER-REDESIGN-ADR）— 第 5 次 AMENDMENT**：
>
> **表头入口重设计** — 4 处入口归 2 处入口 + 列名 toggle 排序。修订 §4.1（DataTableProps）+ §4.4（toolbar 槽位）+ §4.5（表头集成菜单）。
>
> **API 契约变更**：
> - **删除**：`enableHeaderMenu` / `hideHiddenColumnsChip` / `hideFilterChips` / `renderFilterChip`（4 个 props）
> - **新增**：`columnTriggerVisibility?: 'auto' | 'always' | 'never'`（默认 `'auto'`）/ `headerMenuTriggerPosition?: 'toolbar-right' | 'thead-right'`（默认 `'toolbar-right'`）/ `ColumnMenuConfig.filterSummary?: string`
> - **保留**：行展开 props（`renderExpandedRow` / `expandedKeys`，2026-05-13 AMENDMENT）/ pagination / bulkActions / flashRowKeys / saved views / sticky scroll 两种模式
>
> **行为变更**：
> - 列名点击：原 `none → asc → desc → none` 三态循环 → `asc ↔ desc` 二态互斥（不可回 none；清除排序走列级 ⋯ 或矩阵 ×）
> - 表头入口：列内 popover（点列名）→ **列名右侧 ⋯ 列级三点 + toolbar 右端 ⋯ 统一矩阵 popover**
> - filter chips（toolbar 第二行）+ 已隐藏 N 列 chip → 整段删除
>
> **文件改动**：`packages/admin-ui/src/components/data-table/` 删 3 文件（`filter-chips.tsx` / `filter-chip.tsx` / `hidden-columns-menu.tsx` 共 535 行）+ 新建 `column-matrix-menu.tsx`（~400 行）+ 新建 `search-input.tsx`（~80 行 IME composition）+ 改 `header-menu.tsx` / `data-table.tsx` / `types.ts` / `dt-styles.tsx`。
>
> **EP 拆 5 段**（typecheck 中间态保护）：EP-1 deprecate + 矩阵原语 → EP-2 列级 ⋯ + 列名 toggle → EP-3 删旧 → EP-4-A IME + 5 消费方 → EP-4-B 剩余消费方 + 删 deprecated → EP-4-C 用户走读
>
> **起源任务卡**：CHG-SN-9-DT-HEADER-REDESIGN-ADR（本 AMENDMENT 起草） → CHG-SN-9-DT-HEADER-REDESIGN-EP-1 ~ EP-4-C
>
> **背书**：arch-reviewer (claude-opus-4-7) 评级 A− CONDITIONAL PASS / 9 修订建议 R-149-1..9 在 ADR-149 内全部消解；@livefree 用户审核中（status: 🟡 Proposed）；详 ADR-149 §3 决策 D-149-1..12 + §4 EP 拆分 + §7 测试 surface。

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
> 关联 plan：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.4 §1 D-14 + §7

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

### toolbar-less 视图豁免 csv-export（2026-05-20 追加，CHG-SN-7-LOW-3）

**决策**：无 DataTable toolbar 的视图（toolbar-less views）不强制接入 DataTable 共享 csv-export 工具。

**范围**：
- ModerationConsole（审核台）：layout 卡片管理内容，无 DataTable toolbar。
- 后续新建的"无 DataTable 作为主体"视图（如控制面板 / 播放器接入视图等）。

**理由**：DataTable 共享 csv-export 工具依赖 `toolbar.trailing` slot 注入；toolbar-less 视图若强制接入需额外封装，成本 > 收益。

**规则**：
1. toolbar-less 视图如需导出，在 `PageHeader actions` 中实现独立按钮 + 自定义函数，无需复用共享工具。
2. 使用 DataTable 且有 toolbar 的视图，**不豁免**；csv-export 共享方案仍为强制（ADR-106 原有规则不变）。

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
> 关联：`docs/archive/2026Q2/design-iterations/ui-token-alignment-plan.md`（方案真源）/ `docs/designs/backend_design_v2.1/styles/tokens.css`（设计真源）/ `packages/design-tokens/src/{primitives,semantic}/*.ts`（实现真源）

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
  - `docs/archive/2026Q2/design-iterations/ui-token-alignment-plan.md`（方案真源）
  - `docs/archive/2026Q2/design-iterations/state-pill-soft-walkthrough_20260503.md`（CHG-UI-04 走查清单）
  - `docs/archive/2026Q2/design-iterations/token-slot-audit-report-20260503.md`（CHG-UI-05/05a 审计报告）
  - `docs/audit_seq_20260503_01_20260503.md`（CHG-UI-06 arch-reviewer 全序列评级）
- **关联规范**：`docs/rules/ui-rules.md`（CSS 变量使用约束）/ CLAUDE.md §"绝对禁止"硬编码颜色值条款


## ADR-112: 后台交互反馈语义槽位 + admin Shell 全局规则注入器

> 状态：accepted（CHG-UX-01..07 全部完成 + arch-reviewer 待评级；评级 PASS 后正式收口）
> 日期：2026-05-03
> 任务卡：SEQ-20260504-01（CHG-UX-01..07）
> 关联：`docs/archive/2026Q2/design-iterations/ux-interactive-feedback-plan.md`（方案真源）

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
  - `docs/archive/2026Q2/design-iterations/ux-interactive-feedback-plan.md`（方案真源）
  - `docs/audit_seq_20260504_01_20260503.md`（CHG-UX-06 arch-reviewer 全序列评级）
- **关联规范**：`docs/rules/ui-rules.md`（CSS 变量使用约束）/ CLAUDE.md §"绝对禁止" 硬编码颜色值条款


---

## ADR-113: admin UI 间距/封面/字号 token 沉淀 + cover 真根因修复 + 业务零裸值断言

> 状态：accepted（CHG-UX2-01..06 全部完成 + arch-reviewer A- / PASS）
> 日期：2026-05-05
> 任务卡：SEQ-20260505-01（CHG-UX2-01..06）
> 关联：`docs/archive/2026Q2/design-iterations/density-spacing-cover-alignment-plan.md`（方案真源）
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
- **关联方案**：`docs/archive/2026Q2/design-iterations/density-spacing-cover-alignment-plan.md`（过程文档；ADR-113 是结论）
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

`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-redo-01-contract.md` §3 锁定了 Crawler 重做页面所需的 4 个新后端端点：

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

- `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-redo-01-contract.md` §3（4 端点契约提纲）
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

### AMENDMENT 2026-05-26（ADR-155 §3 D-155-4 / EP-1B1）

**触发**：@livefree 用户走读 W2 暴露 — 站点数 > 8 时 `/admin/crawler` 时间轴看不到完整状态；ADR-122 §timeline 端点契约最初规划假设 ≤ 8 站，UI 未暴露 limit 选择器。

**变更**：ADR-122 §timeline 端点契约 `limit` 上限从 20 调整为 50，前端 UI 暴露 `8 / 20 / 全部（= 50）` 三档选择器。

**关键修订点**：
- 后端 `crawlerTimeline.ts:208` `safeLimit = Math.min(50, ...)`（原 20）
- 后端 `crawlerDashboard.ts:31` zod `.max(50)`（原 20）
- 前端 `CrawlerTimelineCard.tsx` 加 `LIMIT_OPTIONS = [8 / 20 / 50]` AdminSelect（aria-label="站数上限"）+ `useState<number>` 自治
- 上限 50 折衷理由：每站 LANE_LIMIT=3 bar × 50 = 150 bar / 窗口（"显示密度 vs 性能"折衷，p95 渲染 < 50ms）

**关联**：ADR-155 §3 D-155-4 / EP-1B1（commit 待提交）

### AMENDMENT 2026-05-26（ADR-155 §3 D-155-3 / EP-3a）

**触发**：@livefree 走读 W2 后追问"Gantt 图的意义" — 时间轴当前 `[NOW-range, NOW]` 单段窗 + 当前时间在最右端，无法回看历史 + 不支持显示 30% 未来 buffer（pending bar 显示位置）。

**变更**：ADR-122 §timeline 端点契约时间窗策略从 "单段窗" 升级为 "三段窗 70% 历史 + 30% 未来"；range 选项扩展 4 → 7 加 12h/24h/7d 长历史回看。

**关键修订点**：
- 后端 `crawlerTimeline.ts`：`CrawlerTimelineRange` 类型扩 7 选项；`RANGE_TO_MS` 加 12h/24h/7d；删除 `RANGE_TO_INTERVAL` 静态映射（改用动态 `Math.round(rangeMs × 0.7 / 1000) seconds` SQL interval）
- 三段窗计算：`rangeStart = NOW - rangeMs × 0.7` + `rangeEnd = NOW + rangeMs × 0.3`；常量 `HISTORY_RATIO = 0.7` + `FUTURE_RATIO = 0.3` 可调
- 后端 `crawlerDashboard.ts:30` zod `z.enum(['30m','1h','2h','6h','12h','24h','7d'])`
- 响应 `rangeStart` / `rangeEnd` ISO 字段语义不变（新值反映三段窗边界）
- now-line / 拖拽 pan 前端实施在 EP-3b 落地

**关联**：ADR-155 §3 D-155-3 / EP-3a（commit 待提交） + ADR-153 §pending clamp + range 自治 AMENDMENT（同 commit）

---

## ADR-124：user_submissions schema + API 协议（CHG-SN-7-REDO-02）

**日期**：2026-05-19
**状态**：**Accepted**（arch-reviewer Opus 子代理 1 轮起草 A 综合 / 主循环修订 Y1+Y2 黄线后落地）
**决策者**：spawn arch-reviewer (claude-opus-4-7) 起草 + claude-opus-4-7 主循环修订 Y1+Y2 黄线后落地
**关联**：ADR-110（错误码 14 码 / 零新增）/ ADR-114-NEGATED（video_sources 复合键 / 不污染）/ ADR-117 AMENDMENT 2（合并 actionType 范式）/ ADR-121 D-121-5（4 真源同步 RETRO）/ ADR-118（admin_audit_log GET 协议）/ ADR-123（同 sources 域结构范式）
**对应交付**：CHG-SN-7-REDO-02-A0 起草本卡 / A-F 后续子卡（参 §拆卡建议）
**触发**：REDO-01 闭环后启动 REDO-02 实测发现深度架构错位 — 当前 video_sources 单表服务仅 1/4 类（失效源举报），spec §5.13 4 类 Segment（含求片 / 元数据纠错）无 schema 承载（详 §背景）

### 背景

设计稿 `docs/designs/backend_design_v2.1/reference.md` §5.13 + `app/screens-3.jsx:415-454` 锁定 4 类 Segment（失效源举报 / 求片 / 元数据纠错 / 已处理）+ Card list（**非表格**）形态。

PRE-04 子卡 #9 判定"❌ 整体错位"仅识别 UI 层（DataTable → Card list）；本卡 REDO-02-A0 启动时实测发现深度架构错位：

1. **video_id NOT NULL 矛盾求片**：用户请求未入库视频时无 video_id 可填
2. **video_sources 复合键 (source_site_key, source_name)（ADR-114-NEGATED）**：无法承载元数据纠错（与 source 无关）
3. **无 quote / metadata 字段**：无法承载用户自然语言描述

REDO-02 必须先固化 schema + 协议，再拆 A-F 子卡。

### 决策要点

**D-124-1 schema 方案 → 选 A（新独立表 `user_submissions` polymorphic / type discriminator）**

- B 否定：违反 ADR-114-NEGATED 复合键语义 / video_id NOT NULL 矛盾 / 污染 sources 域
- C 否定：4 类跨表 UNION 过度复杂 / 3 套 audit / 违反 DRY
- A 选定：架构纯净 / 4 类自然容纳 / 与 ADR-117 AMENDMENT 2 + ADR-123 同范式

**D-124-2 现有 submissions 迁移路径 → 选 D2b（迁移 + alias 过渡）**

历史 `video_sources.is_active=false AND submitted_by IS NOT NULL` backfill 进 `user_submissions(type='bad_source', source_id=video_sources.id)`；旧 `/admin/submissions*` 改为 thin alias 内部转发新端点 `/admin/user-submissions`。

**Y1 修订（Opus 黄线 + 主循环采纳）**：alias 退役 milestone **锁定 M-SN-9** — 届时起 `CHG-SN-9-XX-SUBMISSIONS-DEPRECATE` 卡删除旧路径 + 前端旧 SubmissionsListClient.tsx；本 ADR §10 关联段同步标注。

**D-124-3 actionType 合并 → 选 D3a（单一 `user_submission.action`）**

afterJsonb.action ∈ `{process, reject, batch_process, batch_reject}`。与 ADR-117 AMENDMENT 2（`sources.route_action`）+ ADR-123（`crawler_site.category_mapping_update`）+ ADR-121 D-121-5（4 文件 RETRO）同构。

**D-124-4 targetKind → 新增 `user_submission`**

10 个 targetKind 与现有 9 个同构；不复用 `video_source`（求片时无源对应 targetId）。

**D-124-5 quote 字段格式 → 选 D5c（混合）**

`quote TEXT NOT NULL`（自然语言主体 / 1-2000 字符）+ `metadata_jsonb JSONB NULL`（结构化 / 按 type 不同 shape）。

**Y2 修订（Opus 黄线 + 主循环采纳）**：3 类 metadata_jsonb shape 在本 ADR §Schema 设计末尾以 zod schema 锁定 + REDO-02-A 卡实施时强制 zod runtime 校验 + types 文件加 JSDoc 说明，**不另立 RETRO 4 文件之外的独立 docs**（避免单卡产出 8+ 文档 / 与 ADR-121 4 真源同步原则冲突）。

**D-124-6 错误码 → 复用 ADR-110 14 码（零新增）**

`VALIDATION_ERROR` 422 / `NOT_FOUND` 404 / `STATE_CONFLICT` 409（status 状态机非法转换 / 与 sources 域 freeze 守卫 ADR-117 AMENDMENT 2 同模式）/ `FORBIDDEN` 403 / `INTERNAL_ERROR` 500。

**D-124-7 audit RETRO → 4 真源同步 RETRO 框架（ADR-121 D-121-5 范式）**

**主循环修正 Opus 误解**：RETRO 4 文件 = **源代码 4 真源同步**（不是 docs/audit/ 下 4 个 markdown）：

1. `packages/types/src/admin-moderation.types.ts` — `AdminAuditActionType` +1 `user_submission.action` + `AdminAuditTargetKind` +1 `user_submission`
2. `apps/api/src/services/AuditLogService.ts` — `ACTION_TYPES` 数组 +1 + `TARGET_KINDS` 数组 +1
3. `tests/unit/api/audit-log-coverage.test.ts` — `REQUIRED_ACTION_TYPES` +1 + `PAYLOAD_ASSERTION_REQUIRED` +1（写端点强制 payload 内容断言）
4. `tests/unit/api/audit-log-service-enums-set-equal.test.ts` — `EXPECTED_ACTION_TYPES` +1 + `EXPECTED_TARGET_KINDS` +1

R-MID-1 系统化第 15 次。

**D-124-8 历史 backfill 策略**

migration 065_user_submissions.sql 内 up 段含：
```sql
INSERT INTO user_submissions (type, status, video_id, source_id, submitted_by, quote, created_at)
SELECT 'bad_source', 'pending', vs.video_id, vs.id, vs.submitted_by,
       '【迁移】历史失效源举报', vs.created_at
FROM video_sources vs
WHERE vs.is_active = false
  AND vs.submitted_by IS NOT NULL
  AND vs.deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

保留 video_sources 行不删（避免破坏 P1 `video.refetch_sources` 链路）。

### Schema 设计

migration `apps/api/src/db/migrations/065_user_submissions.sql` 草案（含 CHECK + FK + index + updated_at trigger + ROLLBACK 段 + backfill）见 ADR-124 子代理产出（已 verbatim 落实施卡 REDO-02-A）。**关键 schema 字段**：

```sql
CREATE TABLE IF NOT EXISTS user_submissions (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT         NOT NULL
                                 CHECK (type IN ('bad_source', 'wish_list', 'metadata_correction')),
  status            TEXT         NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'processed', 'rejected')),
  video_id          UUID         NULL REFERENCES videos(id) ON DELETE SET NULL,
  source_id         UUID         NULL REFERENCES video_sources(id) ON DELETE SET NULL,
  submitted_by      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote             TEXT         NOT NULL CHECK (char_length(quote) BETWEEN 1 AND 2000),
  metadata_jsonb    JSONB        NULL,
  processed_by      UUID         NULL REFERENCES users(id) ON DELETE SET NULL,
  processed_at      TIMESTAMPTZ  NULL,
  processed_reason  TEXT         NULL CHECK (processed_reason IS NULL OR char_length(processed_reason) <= 500),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_bad_source_has_source
    CHECK (type <> 'bad_source' OR source_id IS NOT NULL),
  CONSTRAINT chk_metadata_correction_has_video
    CHECK (type <> 'metadata_correction' OR video_id IS NOT NULL),
  CONSTRAINT chk_processed_consistency
    CHECK ((status = 'pending') = (processed_at IS NULL))
);

CREATE INDEX idx_user_submissions_status_type_created
  ON user_submissions (status, type, created_at DESC);
CREATE INDEX idx_user_submissions_video_id
  ON user_submissions (video_id) WHERE video_id IS NOT NULL;
CREATE INDEX idx_user_submissions_submitted_by
  ON user_submissions (submitted_by);
```

**metadata_jsonb 3 类 shape（Y2 zod 锁定）**：

```ts
// REDO-02-A 实施卡内落地 — 不另立 markdown
const BadSourceMetadataSchema = z.object({
  source_id: z.string().uuid(),
  source_url: z.string().url().optional(),
  last_played_at: z.string().datetime().optional(),
}).strict()

const WishListMetadataSchema = z.object({
  title_zh: z.string().max(200).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  douban_id: z.string().regex(/^\d+$/).optional(),
  type: z.enum(['movie', 'series', 'show']).optional(),
}).strict()

const MetadataCorrectionMetadataSchema = z.object({
  video_id: z.string().uuid(),
  field: z.enum(['title', 'director', 'year', 'description', 'cover_url', 'douban_id']),
  suggested_value: z.string().max(500),
}).strict()
```

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/user-submissions` | 4 类 + status 过滤 + badges 聚合 | Query: `type?='all'\|'bad_source'\|'wish_list'\|'metadata_correction'`; `status?='pending'\|'processed'\|'rejected'\|'all'`; `page`; `limit`; `sortField?`; `sortDir?` | 200 `{ data: UserSubmissionRow[], meta: { total, page, limit, badges: { bad_source, wish_list, metadata_correction, processed } } }` | 422 VALIDATION_ERROR |
| 2 | GET | `/admin/user-submissions/:id` | 详情 | Path: `id: uuid` | 200 `{ data: UserSubmissionDetail }` | 404 NOT_FOUND / 422 |
| 3 | POST | `/admin/user-submissions/:id/process` | 标记处理 + audit | Body: `{ action_taken?: string(1..200) }` | 200 `{ data: { processed: true } }` | 404 / 409 STATE_CONFLICT / 422 |
| 4 | POST | `/admin/user-submissions/:id/reject` | 拒绝 + audit | Body: `{ reason: string(1..200) }` | 200 `{ data: { rejected: true } }` | 404 / 409 / 422 |
| 5 | POST | `/admin/user-submissions/batch-process` | 批量处理 + audit | Body: `{ ids: uuid[1..100], action_taken?: string }` | 200 `{ data: { processed: number } }` | 422 |
| 6 | POST | `/admin/user-submissions/batch-reject` | 批量拒绝 + audit | Body: `{ ids: uuid[1..100], reason: string }` | 200 `{ data: { rejected: number } }` | 422 |

**鉴权**：全 6 端点 `requireRole(['admin', 'moderator'])`（与 v1 submissions 一致）。

**旧端点过渡**（D-124-2 + Y1）：`/admin/submissions*` REDO-02-D 卡内改 thin alias（隐式 `type=bad_source` 过滤），保留至 M-SN-9 退役。

### audit log 协议

**actionType**：`user_submission.action`（合并 D3a / 4 路径走 afterJsonb.action 区分）
**targetKind**：`user_submission`
**targetId**：`user_submissions.id`（单条 process/reject）OR `null`（batch_process/batch_reject 时 targetId NULL + afterJsonb.ids 数组）

afterJsonb shape：
```jsonc
{
  "action": "process" | "reject" | "batch_process" | "batch_reject",
  "type": "bad_source" | "wish_list" | "metadata_correction",
  "ids"?: string[],          // batch_* 时
  "count"?: number,          // batch_* 时
  "action_taken"?: string,   // process / batch_process 时
  "reason"?: string          // reject / batch_reject 时
}
```

**RETRO 4 真源同步**（D-124-7 修正）：
1. `packages/types/src/admin-moderation.types.ts` actionType + targetKind +1/+1
2. `apps/api/src/services/AuditLogService.ts` ACTION_TYPES + TARGET_KINDS +1/+1
3. `tests/unit/api/audit-log-coverage.test.ts` REQUIRED + PAYLOAD_ASSERTION_REQUIRED +1
4. `tests/unit/api/audit-log-service-enums-set-equal.test.ts` EXPECTED_* +1

**第 5 文件（content assertion test）**：`tests/unit/api/user-submissions-mutations-audit.test.ts` 含 `expect.objectContaining({ actionType, targetKind, afterJsonb })` 形式断言（不算 4 真源同步框架内 / 是端点 PATCH/POST 必有的"content assertion 测试"独立要求）。

R-MID-1 系统化第 15 次。

### 类型契约

```ts
// packages/types/src/admin-moderation.types.ts 追加

export type UserSubmissionType = 'bad_source' | 'wish_list' | 'metadata_correction'
export type UserSubmissionStatus = 'pending' | 'processed' | 'rejected'

export interface UserSubmissionRow {
  readonly id: string
  readonly type: UserSubmissionType
  readonly status: UserSubmissionStatus
  readonly videoId: string | null
  readonly sourceId: string | null
  readonly submittedBy: string
  readonly submittedByName: string | null   // JOIN users
  readonly quote: string
  readonly metadata: Readonly<Record<string, unknown>> | null
  readonly videoTitle: string | null        // JOIN videos
  readonly videoPosterUrl: string | null    // JOIN videos
  readonly sourceName: string | null        // JOIN video_sources
  readonly sourceSiteKey: string | null     // JOIN video_sources
  readonly createdAt: string
  readonly processedAt: string | null
  readonly processedBy: string | null
  readonly processedReason: string | null
}

export interface UserSubmissionListResp {
  readonly data: ReadonlyArray<UserSubmissionRow>
  readonly meta: {
    readonly total: number
    readonly page: number
    readonly limit: number
    readonly badges: {
      readonly bad_source: number       // status=pending
      readonly wish_list: number        // status=pending
      readonly metadata_correction: number  // status=pending
      readonly processed: number        // status in (processed, rejected)
    }
  }
}
```

### 后果

**正面**：
1. 4 类 Segment 一体化，spec §5.13 完整覆盖（求片 / 纠错首次有 schema 承载）
2. video_sources 域纯净，ADR-114-NEGATED 复合键语义不被污染
3. audit/types 合并范式与 ADR-117/121/123 一致，4 真源同步框架 R-MID-1 第 15 次系统化
4. 历史 backfill 不丢数据（video_sources 行保留 + user_submissions backfill 双轨）
5. metadata_jsonb shape zod 锁定，前端消费方零猜测（Y2 修订）

**负面 / 风险**：
1. 1 张新表 + 1 个 migration（含 backfill）+ 2 个 milestone alias 过渡（Y1）
2. CHECK 约束（chk_bad_source_has_source / chk_metadata_correction_has_video / chk_processed_consistency）增加 schema 复杂度（DB 层防御换前端 / service 层 zod 双层保险）
3. 旧 `/admin/submissions*` 在 2 milestones 内为 alias（CHG-SN-9 退役卡承担技术债 owner）

### 替代方案对比

| 维度 | A 新表（选定）| B 扩 video_sources | C 拆 3 表 |
|---|---|---|---|
| 架构纯净 | ✅ 单一职责 | ❌ 污染源域 | ⚠️ 碎片化 |
| 求片支持 | ✅ video_id NULL | ❌ NOT NULL 矛盾 | ✅ |
| ADR-114 兼容 | ✅ | ❌ 破坏复合键 | ✅ |
| 跨类查询 | ✅ 单表 | ✅ | ❌ 跨表 UNION |
| audit 范式 | ✅ 1 actionType | ⚠️ 语义混乱 | ❌ 3 actionType |
| 迁移成本 | ⚠️ 1 backfill | ✅ 0 | ❌ 3 backfill |

### 关联

- **ADR**：ADR-110 / ADR-114-NEGATED / ADR-117 AMENDMENT 2 / ADR-118 / ADR-121 D-121-5 / ADR-123
- **spec**：`docs/designs/backend_design_v2.1/reference.md` §5.13 / `app/screens-3.jsx:415-454`
- **任务卡**：CHG-SN-7-REDO-02-A0（本卡）/ A-F（参 §拆卡建议）
- **关联代码（旧）**：
  - `apps/api/src/routes/admin/content.ts:183-256`（旧端点 / REDO-02-D 卡改 alias）
  - `apps/api/src/db/queries/sources.ts:407`（listSubmissions / REDO-02-D 卡迁移）
  - `apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient.tsx`（旧 397 行 / REDO-02-D 加 deprecation banner）
- **关联代码（新增 / REDO-02-A-E 落地）**：
  - `apps/api/src/db/migrations/065_user_submissions.sql`
  - `apps/api/src/db/queries/userSubmissions.ts`
  - `apps/api/src/services/UserSubmissionService.ts`
  - `apps/api/src/routes/admin/userSubmissions.ts`
  - `apps/server-next/src/app/admin/user-submissions/page.tsx` + `_client/UserSubmissionsClient.tsx`
  - `apps/server-next/src/lib/user-submissions/{api,types}.ts`
  - `tests/unit/api/{user-submissions-list,user-submissions-mutations-audit}.test.ts`
- **关联触发**：PRE-CARD-PRIMITIVE（admin-ui 是否已具 Card/Segment/Quote primitive 调研，C 卡前置）/ CHG-SN-9-SUBMISSIONS-DEPRECATE（M-SN-9 alias 退役）

### 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | `user_submissions` 与 `source_line_aliases` 命名风格一致；3 type 枚举自描述 |
| 对称性 | A | 6 端点完全对称 v1 submissions（list / detail / process / reject / batch ×2）；actionType 合并范式与 ADR-117/123 同构 |
| 状态职责 | A | status 3 态机（pending → processed/rejected）+ CHECK 约束确保 processed_at 一致性；DB 持久状态 + 端点幂等 |
| 扩展性 | A | metadata_jsonb 容纳未来字段 + zod schema 锁定；新增第 5 类只需扩 CHECK + badges + 4 真源 + 1 content assertion test |

**综合**：**A**（Opus 起草 + 主循环修订 Y1+Y2 后入 Accepted；2 advisory（AD1 jsonb_typeof CHECK / AD2 partial index / AD3 ADR-114 脚注）作为 REDO-02-A 实施提示）

### REDO-02 后续子卡拆分（Opus 建议 + 主循环采纳）

| 卡 | 范围 | 估时 | 模型 | 前置 |
|---|---|---|---|---|
| **A0** | ADR-124 起草（本卡）+ 落 docs/decisions.md | 0.15w | Opus | 无 |
| **A** | migration 065 + 类型 + actionType + targetKind + 4 真源同步 + audit 单测 5 文件落地 | 0.4w | opus-4-7 | A0 |
| **B** | apps/api：6 端点 + service + queries + audit 写入 + ≥ 10 case 单测 | 0.7w | opus-4-7 | A |
| **C** | apps/server-next：新页面 `/admin/user-submissions` 4 Segment Card list + admin-ui primitive 消费 | 0.8w | opus-4-7 | B + PRE-CARD-PRIMITIVE |
| **D** | 旧 `/admin/submissions*` → alias 转发 + SubmissionsListClient deprecation banner | 0.2w | Haiku | C |
| **E** | RETRO 验证 + verify:adr-contracts + e2e | 0.3w | Sonnet | C |
| **F** | Opus 验收（spec §5.13 + ADR-124 9 节闭环） | 0.2w | Opus | A-E |

**REDO-02 总估时**：~2.75w（含 A0）

**advisory**：A 卡启动前先 0.1w 调研 admin-ui Card / Segment / QuoteBlock primitive；缺则起 `PRE-CARD-PRIMITIVE`（Opus）— 否则 C 卡可能膨胀至 1.2w。


---

## ADR-124 AMENDMENT 1 2026-05-19（CHG-SN-7-ADR-124-AMENDMENT-1）— quote 语义映射 + 3 按钮替换决策落档

**触发**：REDO-02-F Opus 验收（commit `72fb2af4`）扣 2×0.5 分（A− 而非 A）：
- 14 行 §5.13 checklist #13：quote→title 衍生 + metadata→quote block 衍生映射缺 ADR 落档
- #14：3 按钮 spec「重验/查看视频/处理」→ 实施「查看视频/拒绝/处理」替换决策缺文档

ADR-124 主文档未明文规定 UI 层 quote/metadata 渲染映射 + 3 按钮替换；commit 备注非正式落档。本 AMENDMENT 显式落档以闭合 spec ↔ 实施 之间的解释空间。

**范围**：零代码改动 / 仅文档 / 锁定 UI 层 quote-metadata 映射规则 + 3 按钮替换理由。

### 决策要点

**D-124-AMD1-1 UI 层 quote → title 衍生 + metadata → quote block 衍生**

ADR-124 §5 类型契约 `UserSubmissionRow.quote` 是自然语言主体（spec §5.13 设计稿用例：`"换了线路也是一样的，估计是源挂了"` / `"应该是 Simon Mirren，不是 Simon Mirran"`）。schema 仅单 quote 字段（vs spec mock 设计含 `title + quote` 双概念）。

**实施层 UI 渲染规则**（`SubmissionCard.tsx`）：

| spec mock 字段 | UI 渲染来源 | 公式 |
|---|---|---|
| title（如 "举报：危险关系 EP3 线路 2 黑屏"） | `${visualForType(type).titlePrefix}：${row.quote}` | type=bad_source → `举报：${quote}` / type=wish_list → `求片：${quote}` / type=metadata_correction → `纠错：${quote}` |
| quote block（如 "换了线路也是一样的"） | `row.metadata` 衍生（按 type 不同 shape） | bad_source: `source_url + last_played_at` 拼装 / wish_list: `title_zh / year / douban_id / type` 拼装 / metadata_correction: `字段「${field}」→ ${suggested_value}` |
| who / time | `@${submittedByName ?? submittedBy.slice(0,8)} · ${formatRelativeTime(createdAt)}` + 视频标题（如有） | 直接字段映射 |

**理由**：
1. **schema 单 quote 设计已锁**（ADR-124 §Schema 设计 / D-124-5）— 不为 UI 双字段加列 / 避免 schema 膨胀
2. **type 前缀注入消除 title 字段需求**：3 类各自 prefix 即可承载 spec mock title 语义层
3. **metadata 衍生展示** vs spec mock 静态 quote：实际 metadata 含结构化字段（source_url / douban_id / suggested_value）/ 比 spec mock 静态文本提供更多 actionable 信息

**D-124-AMD1-2 3 按钮替换：spec 「重验/查看视频/处理 primary」 → 实施「查看视频/拒绝/处理 primary」**

**spec §5.13 / screens-3.jsx:445-448 mock 3 按钮**：
```jsx
<button className="btn btn--sm">{I.refresh} 重验</button>
<button className="btn btn--sm">查看视频</button>
<button className="btn btn--sm btn--primary">{I.check} 处理</button>
```

**实施 3 按钮（`SubmissionCard.tsx:230-265`）**：
```tsx
<AdminButton variant="default" size="sm">查看视频</AdminButton>
<AdminButton variant="default" size="sm">拒绝</AdminButton>
<AdminButton variant="primary" size="sm">处理</AdminButton>
```

**替换决策（重验 → 拒绝）理由**：

1. **「重验」语义在 4 类中仅 1 类有效**：
   - bad_source（失效源举报）：重验 = 重新 probe source → 已由 **ADR-117 AMENDMENT 2 `sources.route_action` afterJsonb.action='reprobe'** 承载（REDO-01-E2 commit `cd27dacf` 落地）
   - wish_list（求片）：无 source → 无重验语义
   - metadata_correction（元数据纠错）：纠错对象是 metadata 字段 → 无重验语义
2. **「拒绝」语义在 4 类全部有效**：4 类投稿都可被拒绝（不通过 / 标记 rejected / 状态机 pending → rejected）
3. **统一「拒绝」覆盖 4 类 polymorphic**：与 ADR-124 §D-124-3 合并 actionType `user_submission.action` + afterJsonb.action ∈ {process, reject, batch_process, batch_reject} 完全对齐
4. **重验跨域调用复杂度**：若 SubmissionCard 内嵌「重验」按钮 → 需跨调 `sources.route_action` 端点 + 仅对 bad_source 启用 + 求片/纠错 disabled / tooltip → UI 复杂度高 / 用户认知负担大；vs 「拒绝」4 类按钮路径统一 / 简化运营操作
5. **运营 workflow 自然**：bad_source 进入 user_submissions 是用户主动报告 / 运营审核场景下「处理 / 拒绝」是审核员决策动作 / 重验是后续 actionable / 通过 sub-table 单独路径走（C 卡可后续扩 ContextMenu 提供「重验该 source」入口）

### 关联

- ADR-124（本卡 AMENDMENT 1 / 11 节 + D-124-1..8 全 closed）
- ADR-117 AMENDMENT 2（`sources.route_action` reprobe 路径 / 承载重验语义）
- spec §5.13（设计稿 mock 形态 / 本 AMENDMENT 落档 spec ↔ 实施偏离）
- REDO-02-F Opus 验收（commit `72fb2af4` / 14 行 checklist #13 + #14 扣分项）
- 实施代码：`apps/server-next/src/app/admin/user-submissions/_client/SubmissionCard.tsx`（230 行 / visualForType + 3 按钮）

### 后果

**正面**：
1. spec ↔ 实施偏离明文落档 / 后续 visual 回归 / Opus 二次验收 / RECHECK 卡可援引本 AMENDMENT 拒绝伪偏离指控
2. 重验语义跨域链路（user_submissions ↔ sources.route_action）明示 / 避免后续运营误读"重验缺失"

**负面 / 风险**：
1. 运营若期望 SubmissionCard 内嵌「重验」按钮 → 需用户教育 / 跳转到 sources 域路径（轻微 UX 摩擦 / 留 advisory）
2. metadata 衍生 quote block 在 wish_list 全字段缺失时显示空字符串 → 已在 `SubmissionCard.tsx:225-237` 加 `Object.keys(row.metadata).length > 0` 守卫

### 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | quote / metadata 字段命名清晰 / 3 按钮 variant=default/primary 与 admin-ui 全家桶一致 |
| 对称性 | A | 4 类 polymorphic 路径统一（process / reject 双路径覆盖 4 类）/ 与 sources.route_action 范式同源 |
| 状态职责 | A | UI 层衍生规则明示 / schema 层零膨胀 / 跨域职责（user_submissions vs sources）清晰 |
| 扩展性 | A | 未来加第 4 类（如 "组织申请"）/ 只需扩 visualForType + 0 schema 改动 / quote 字段语义通用 |

**综合**：**A**

升级 ADR-124 主评级 A− → **A**（本 AMENDMENT 1 闭档两处 DEVIATION）


---

## ADR-125 — Settings 区段 IA 顶级化与旧 URL 永久重定向（M-SN-7 REDO-03-A）

### 1. Status

**Accepted** — 2026-05-19（CHG-SN-7-REDO-03-A / Opus arch-reviewer 评审 PASS）

### 2. 上下文

M-SN-7 PRE-04 #14 锁定 Settings 区段 IA 收敛。`reference.md` §5.11 明示「侧栏不应暴露多个 system 子项；设计稿是设置页内部 tab」。M-SN-6 已完成第一步：sidebar 仅暴露 1 个 system 入口、4 个旧子路由（cache/config/migration/monitor）改为 `redirect()` 到 `/admin/system/settings?tab=X`、SettingsContainer 已实现 5 Tab（`?tab=` 同步逻辑就绪）。

但 URL 仍寄居 `/system/` 命名空间，与 plan `task-queue.md` L4015 锁定的终态「`/admin/settings`（顶级）」+ 设计稿「Settings 顶级菜单」语义不符。本 ADR 完成第二步：URL 命名空间提升 + landing 兜底 + nav entry 同步。

### 3. 决策

- **D1**：Settings 主路由迁移至 `/admin/settings`（顶级 URL），整个目录（`_client/SettingsContainer.tsx` + 5 个 `_tabs/*.tsx` + `page.tsx`）从 `apps/server-next/src/app/admin/system/settings/` 整体 `git mv` 到 `apps/server-next/src/app/admin/settings/`。
- **D2**：4 个 system 子路由（cache/config/migration/monitor）`redirect()` 目标改为 `/admin/settings?tab=<X>`（query string 协议不变 / SettingsContainer 内部逻辑零改动）。
- **D3**：`/admin/system/page.tsx`（旧 PlaceholderPage landing）改为 `permanentRedirect('/admin/settings')`，保留文件兜底外链。
- **D4**：旧 `/admin/system/settings/page.tsx` 重建为 5 行 `permanentRedirect('/admin/settings')`，覆盖书签 / 搜索引擎索引 / 外链。
- **D5**：`admin-nav.tsx` L106 entry href 从 `/admin/system/settings` → `/admin/settings`（label / icon / shortcut `mod+,` 全部保留）。
- **D6**：全部 redirect 使用 **308 永久**（Next.js `permanentRedirect()`），非 307 临时。IA 终态收敛属永久性架构决策 / 让浏览器 / 爬虫 / 书签持久更新 / 避免长期承担 redirect 链路延迟与 CDN miss。回滚成本由第 7 节撤销策略覆盖。
- **D7**：SettingsContainer.tsx:136 `router.push('/admin/system/settings...')` 同步改为 `/admin/settings...`（前端 Tab 切换 URL 同步逻辑）。
- **D8**：后端 v1 API 端点路径（`/admin/system/settings` + `/admin/system/config`）**不变**，仍由 `apps/api/src/routes/admin/siteConfig.ts` 提供，`apps/server-next/src/lib/system/api.ts` 客户端继续指向旧路径。本 ADR 范围仅含 Next.js 前端路由 IA / 不涉及后端 contract 变更。

### 4. 影响范围（8 文件 + 1 测试 mock）

1. **mv**：`apps/server-next/src/app/admin/system/settings/{_client,_tabs,page.tsx}` → `apps/server-next/src/app/admin/settings/{_client,_tabs,page.tsx}`（整目录迁移 / 7 个文件保持原文件名）
2. **新建（兜底）**：`apps/server-next/src/app/admin/system/settings/page.tsx`（5 行 `permanentRedirect`）
3. **改**：`apps/server-next/src/app/admin/system/page.tsx`（PlaceholderPage → `permanentRedirect`）
4. **改**：`apps/server-next/src/app/admin/system/cache/page.tsx`（redirect → permanentRedirect + target update）
5. **改**：`apps/server-next/src/app/admin/system/config/page.tsx`（同上）
6. **改**：`apps/server-next/src/app/admin/system/migration/page.tsx`（同上）
7. **改**：`apps/server-next/src/app/admin/system/monitor/page.tsx`（同上）
8. **改**：`apps/server-next/src/lib/admin-nav.tsx` L106（href）
9. **改**：`apps/server-next/src/app/admin/settings/_client/SettingsContainer.tsx` L136（router.push target）
10. **测试 mock 同步**：`tests/unit/components/admin-ui/shell/infer-breadcrumbs.test.ts`（mock NAV + 断言路径 2 处）+ `tests/unit/components/server-next/admin/system/{Settings,Cache,Config,Migration,Monitor}Tab.test.tsx` 5 个文件的相对路径 import（`apps/server-next/src/app/admin/system/settings/_tabs/` → `apps/server-next/src/app/admin/settings/_tabs/`）

`docs/designs/backend_design_v2.1/reference.md` §5.11 现状段（描述 sidebar 暴露 5 子项）已部分过时，本任务卡明示授权同步该规范文件。

### 5. Migration 步骤

1. `git mv` 整目录 → `apps/server-next/src/app/admin/settings/`（5 Tab + SettingsContainer + page 一次性迁移）
2. 重建旧 `apps/server-next/src/app/admin/system/settings/page.tsx` 为 5 行 permanentRedirect
3. 改写 `/admin/system/page.tsx` landing 为 `permanentRedirect('/admin/settings')`
4. 4 个 system 子路由（cache/config/migration/monitor）改 target 为 `/admin/settings?tab=X` + 改用 `permanentRedirect`
5. 改 `admin-nav.tsx` L106 entry href
6. 改 SettingsContainer.tsx:136 router.push target
7. 同步 5 Tab test 相对路径 import + breadcrumbs test mock
8. 同步 reference.md §5.11 现状段
9. typecheck / lint / unit / verify:adr-contracts 全绿

### 6. 验收标准

- **单测**：
  - `admin-nav.tsx` 单测断言「站点设置」entry href = `/admin/settings`
  - `infer-breadcrumbs.test.ts` `/admin/settings → [{系统管理}, {站点设置, /admin/settings}]` 通过
  - 5 Tab test（SettingsTab / CacheTab / ConfigTab / MigrationTab / MonitorTab）通过新路径 import 全部 PASS
- **e2e（M-SN-7 验收期）**：sidebar 点击「站点设置」→ 落地 `/admin/settings`；访问 `/admin/system/cache` → 308 → `/admin/settings?tab=cache`
- **typecheck** / **lint** / **`npm run verify:adr-contracts`** 全绿
- **测试套件**：≥4053 unit PASS（基线对齐 REDO-02-F 验收后基线）

### 7. 撤销策略

回滚 = revert 本 ADR commit。SettingsContainer 内部不变 / `?tab=` 协议不变 / 6 个 redirect 文件结构不变 / 仅 target string 与 nav href 与 mv 路径回退。无 schema / API / 状态机 / 后端 contract 变更，撤销成本 O(1)。

### 8. Open Question

无。i18n locale 前缀（ADR-039 middleware）已确认不注入 admin 子树（`apps/server-next/src/app/` 下无 `[locale]` 目录段），redirect target 可硬编码绝对路径。

### 9. 关联

- ADR-100 §IA-2（M-SN-3 dashboard IA 修订 / redirect 范式参考）
- ADR-122 / ADR-123 / ADR-124（M-SN-7 同 milestone ADR 9 节范式）
- plan `docs/task-queue.md` REDO-03 拆分（L4009-4020）
- reference.md §5.11 站点设置 Settings
- PRE-04 #14（M-SN-7 PRE-04 审计触发点 / 14 路由分散现状清单）

### 后果

**正面**：
1. URL 命名空间与 IA 终态对齐 / 「Settings 顶级菜单」语义彻底打通 / 后续 REDO-03-B（5→8 Tab 扩展）落地路径统一
2. 6 个旧 URL（含 1 主路由 + 4 子路由 + 1 landing）308 永久兜底 / 书签 / 外链 / SEO 影响最小化
3. 改动收敛（8 文件 + 1 测试 mock）/ 无 schema 变更 / 无后端 contract 变更 / 无依赖新增 / 撤销 O(1)

**负面 / 风险**：
1. 6 个 redirect 永久存在 → 长期维护负担（轻微 / 5 行薄层 / 与 ADR-100 IA-2 范式一致）
2. 测试相对路径 import（5 Tab test）维护需对齐目录结构 / 已在本卡同步处理

### 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | `/admin/settings` 顶级清晰 / `?tab=X` 协议复用既有 SettingsContainer 逻辑 / 命名空间语义对齐设计稿 |
| 对称性 | A | 6 个 redirect 全部 308 永久 / 全部走 Next.js `permanentRedirect` 范式 / 与 ADR-100 IA-2 同源 |
| 状态职责 | A | 前端 IA 与后端 API 端点解耦（D8）/ 撤销路径线性 / 无侵入 SettingsContainer 内部逻辑 |
| 扩展性 | A | REDO-03-B（5→8 Tab）落地无障碍 / 未来如再次 IA 修订 / 308 → 新 308 撤销链路一致 |

**综合**：**A**

---

## ADR-126 — system_settings KV 扩展：通知与会话字段（CHG-SN-7-REDO-03-C）

**状态**：Accepted  
**日期**：2026-05-19  
**决策者**：arch-reviewer (claude-opus-4-7)  
**消费方**：apps/api · packages/types · apps/server-next · apps/server (v1 冻结)

### 1. 背景

REDO-03-B 将 SettingsContainer 从 5 个 Tab 扩展到 8 个 Tab，新增了「通知设置」「API·Webhook」「登录会话」三个占位 Tab。REDO-03-C 目标：将占位 Tab 转化为真实表单，需要在 `system_settings` KV 表中持久化 8 个新字段。

**约束**：
- `system_settings` 为纯 KV 表（key + value TEXT），扩展无需 migration DDL，仅需 seed INSERT
- `verify:endpoint-adr` 门禁：siteConfig POST 端点已有 ADR（本卡范围内扩展字段不触发新端点 ADR）
- API Key 管理需要独立 `api_keys` 表 + 新 GET/POST/DELETE 端点 → 必须延后至 ADR-128/M-SN-8+
- 活跃会话列表需要查询 `refresh_tokens` 表 + 新 GET 端点 → 必须延后至 ADR-129/M-SN-8+

### 2. 决策

在现有 `system_settings` KV 表中新增 8 个 key：

**通知字段（5 个）**：
- `notification_email_enabled`（default: `'false'`）
- `notification_email_to`（default: `''`）
- `notification_webhook_enabled`（default: `'false'`）
- `notification_webhook_url`（default: `''`）
- `notification_webhook_secret`（default: `''`）

**会话字段（3 个）**：
- `session_timeout_minutes`（default: `'60'`）
- `session_max_concurrent`（default: `'5'`）
- `session_extend_on_activity`（default: `'true'`）

### 3. 理由

**选 KV 扩展而非独立表**：8 个字段均为单值全局配置，与现有 `system_settings` 语义完全一致（全局站点设置），不属于实体列表，不需要独立表结构。KV 扩展代价最小：不涉及 schema migration DDL、不引入新 JOIN、撤销 O(1)。

**延后 API Key 管理**：`api_keys` 表需要独立实体（id/name/secret_hash/created_at/last_used_at/scopes）+ 新 GET `/admin/api-keys` + POST `/admin/api-keys` + DELETE `/admin/api-keys/:id` 三个端点，必须先起独立 ADR-128（`verify:endpoint-adr` 强制门禁），不得在本卡内实施。ApiWebhookTab 当前以 advisory 形式标注延后计划。

**延后活跃会话列表**：需要 `refresh_tokens` 表的 SELECT 查询 + 新 GET 端点，同样需要独立 ADR-129。LoginSessionsTab 会话策略配置字段为纯 KV，可在本卡落地；活跃会话列表部分以 advisory 卡标注。

### 4. 实施范围

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `packages/types/src/system.types.ts` | 扩展 | 新增 8 个 SystemSettingKey + 8 个 SiteSettings 接口字段 |
| `apps/api/src/db/queries/systemSettings.ts` | 扩展 | `deserializeSiteSettings` 增加 8 个字段反序列化逻辑 |
| `apps/api/src/routes/admin/siteConfig.ts` | 扩展 | POST body schema + handler 新增 8 个字段（含 webhook URL 合法性校验）|
| `apps/api/src/db/migrations/066_system_settings_seed_notifications_session.sql` | 新增 | ON CONFLICT DO NOTHING seed（幂等）|
| `apps/server-next/src/app/admin/settings/_tabs/NotificationsTab.tsx` | 重写 | 3 AdminCard 真实表单（email / webhook / events advisory）|
| `apps/server-next/src/app/admin/settings/_tabs/ApiWebhookTab.tsx` | 重写 | Webhook 指引 + API Key advisory（延后 ADR-128）|
| `apps/server-next/src/app/admin/settings/_tabs/LoginSessionsTab.tsx` | 重写 | 2 AdminCard：会话策略真实表单 + 活跃会话 advisory（延后 ADR-129）|
| `apps/server/src/components/admin/system/site-settings/SiteSettings.tsx` | 修复 | v1 冻结组件 DEFAULT_SETTINGS 补齐 8 个新 SiteSettings 必填字段 |

### 5. 延后决策记录

| 功能 | 延后原因 | 目标 ADR |
|---|---|---|
| API Key 管理（生成/撤销/列表）| 需独立表 + 3 新端点（触发 verify:endpoint-adr 门禁）| ADR-128 / M-SN-8+ |
| 活跃会话列表 + 强制退出 | 需查询 refresh_tokens + 新 GET 端点 | ADR-129 / M-SN-8+ |
| 通知多渠道扩展（Slack/企业微信）| 通道模型需评估后单独 ADR | ADR-130 / M-SN-8+ |

### 6. 错误码

| 情形 | HTTP | code | 说明 |
|---|---|---|---|
| webhook URL 格式非法 | 400 | `INVALID_WEBHOOK_URL` | 非 http/https 时返回 |
| 字段校验失败 | 400 | `VALIDATION_ERROR` | Zod parse 报错 |

### 7. 测试覆盖

- `LoginSessionsTab.test.tsx`（5 用例）：渲染 / 初始值注入 / dirty 状态 / advisory 卡 / 加载失败 ErrorState
- `ApiWebhookTab.test.tsx`（3 用例）：渲染 / 两 card testid / ADR-128 advisory 文字
- `NotificationsTab.test.tsx`（5 用例）：渲染 / Webhook URL 初始值注入 / dirty 指示器 / 保存 toast / 加载失败 ErrorState

### 8. 关联

- ADR-125（REDO-03-A Settings IA 顶级化）
- ADR-122 / ADR-123 / ADR-124（M-SN-7 同 milestone）
- plan `docs/task-queue.md` REDO-03-C（当前卡）
- ADR-127（Dashboard Stats 端点协议 / CHG-SN-7-MISC-DASHBOARD-2）
- ADR-128（API Key 管理 / 待起草）
- ADR-129（活跃会话列表 / 待起草）

### 9. 后果

**正面**：
1. 通知与会话 8 个 KV 字段全量可读写 / 前后端 contract 对齐 / 无 schema DDL 风险
2. NotificationsTab / LoginSessionsTab 从占位 advisory 升级为真实表单 / 8 Tab 功能完整
3. API Key / 活跃会话延后至独立 ADR / 本卡不触发 verify:endpoint-adr 门禁

**负面 / 风险**：
1. v1 冻结组件需要同步更新 DEFAULT_SETTINGS（技术债 / 随 v1 彻底下线消除）
2. `notification_email_enabled` / `notification_webhook_enabled` 当前后端无实际发送逻辑（字段存储但发送功能 M-SN-8+ 实装）

### 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | snake_case KV key 与现有 24 个 key 风格一致 / camelCase SiteSettings 字段与接口规范对齐 |
| 对称性 | A | 8 个字段在类型 / 序列化 / API schema / seed 四处全量对齐 / 无遗漏 |
| 状态职责 | A | KV 全局配置归 system_settings / 实体列表（api_keys）明确延后 / 无越层 |
| 扩展性 | A | ON CONFLICT DO NOTHING seed 幂等 / 新 KV 字段增量扩展无 DDL 风险 / ADR-128/129 扩展路径清晰 |

**综合**：**A**

## ADR-127 — Dashboard Stats 扩展端点协议设计（CHG-SN-7-MISC-DASHBOARD-2）

**状态**：Accepted（Conditional PASS：C1 ADR-126 §5 编号顺延已修正，C2 任务卡端点数已更正）
**日期**：2026-05-19
**决策者**：arch-reviewer (claude-opus-4-7)
**消费方**：apps/api · packages/types · apps/server-next（DashboardClient + AnalyticsView）

### 1. 背景

`/admin` Dashboard（overview tab）当前仅 `pendingCount` 走 live 路径，其余 4 张 MetricKpiCard / WorkflowCard 4 段 / AttentionCard / RecentActivityCard / SiteHealthCard 全量 deterministic mock（`apps/server-next/src/lib/dashboard-data.ts`）。

`/admin?tab=analytics`（reference §5.15）KPI 字段与 dashboard 高度重叠（视频总数 / 已上架 / 待审·暂存 / 源可达率），目前也是占位。

任务 CHG-SN-7-MISC-DASHBOARD-2 目标：将 4 个 MetricKpiCard + WorkflowCard 4 段真实化，并与 §5.15 Analytics Tab 的 KPI 字段统一设计。AttentionCard / RecentActivityCard / SiteHealthCard 暂维持 mock（ADR-130/131/132 延后）。

### 2. 决策

**D-127-1（端点策略）：混合策略（方案 D）**

- 扩展现有 `/admin/videos/moderation-stats`：追加 `interceptDelta`（今日-昨日拦截率差值，pt单位），向后兼容
- 新增 `/admin/dashboard/overview`：一次返回 4 KPI + 4 workflow 段，不含 spark
- 新增 `/admin/dashboard/spark`：按 metric + days 参数按需返回 7 天序列
- 新增 `/admin/dashboard/analytics`：§5.15 Analytics Tab 专用（4 KPI + 采集时间线 + 源类型分布 + 近期任务列表）

否决理由（B 单聚合全包）：spark 数据膨胀响应体；analytics 与 overview 关注点不同。
否决理由（C 细粒度多端点）：首屏多次往返，用户体验差。
否决理由（A 仅扩展 moderation-stats）：端点语义污染（名称暗示"审核"却返回源健康数据）。

**D-127-2（Spark 历史数据策略）：实时聚合，预留快照演进路径**

当前阶段：`/admin/dashboard/spark` 对每个 metric 执行 `GROUP BY date_trunc('day', ...) LIMIT days` 查询，单表 + 索引扫描，预估 P95 < 50ms。

触发 ADR-127a（新建 `dashboard_kpi_snapshots` 表 + 每日 cron）的条件：
1. spark 端点 P95 > 200ms 或 daily QPS > 1000
2. 引入 30d/90d 长窗口需求
3. 引入历史回看 / time-travel 需求

否决方案 B（随机波动 mock）：违反"live 字段不得伪造"语义（ADR-126 / reference §5.1.4 教训）。

**D-127-3（范围收敛）**

| 卡片 | 范围 | 数据源 |
|---|---|---|
| MetricKpiCard 视频总量 | 真实化 | `videos` 按 approved+public+not deleted 计数 |
| MetricKpiCard 待审/暂存 | 真实化 | pendingCount（已 live）+ `videos WHERE review_status='staging'` count |
| MetricKpiCard 源可达率 | 真实化 | `video_sources` active/total 百分比 |
| MetricKpiCard 失效源 | 真实化 | `video_sources` inactive count |
| WorkflowCard 采集入库 | 真实化 | `crawler_run_tasks.result.videosUpserted` 今日累计 |
| WorkflowCard 待审核 | 维持 live | moderation-stats.pendingCount |
| WorkflowCard 暂存待发布 | 真实化 | `videos WHERE review_status='staging'` count |
| WorkflowCard 已上架 | 真实化 | `videos WHERE review_status='approved' AND visibility='public'` count |
| AttentionCard | 维持 mock | 跨 3 域聚合复杂度高 → ADR-130 |
| RecentActivityCard | 维持 mock | 需 audit_log 跨 targetKind + 用户名 JOIN → ADR-131 |
| SiteHealthCard | 维持 mock | health score 口径需统一（与 crawlerKpi 协调）→ ADR-132 |

**D-127-4（端点数量）：3 个新端点 + 1 个扩展**

- workflow-counts 独立端点（Opus 初稿包含）在实施期移除：WorkflowCard 无独立 refresh 按钮，workflow 数据直接由 overview 端点下发，不需要双暴露。任务卡描述"6 endpoints"更正为"3 新端点 + 1 扩展"。

**D-127-5（Analytics Tab 字段复用策略）**

- 共享 `DashboardKpiSnapshot` 类型（`packages/types/src/dashboard.ts`），不共享端点
- overview 与 analytics 各自一个端点，payload 形状不同（analytics 额外含 timeline / sourceTypeDistribution / recentTasks）

### 端点契约

| # | 方法 | 路径 | 认证 | 请求参数 | 响应 schema 要点 | ADR |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/dashboard/overview` | admin | — | `{ data: { kpis: DashboardKpiSnapshot[], workflow: DashboardWorkflowSegment[], generatedAt: string } }` | ADR-127 |
| 2 | GET | `/admin/dashboard/spark` | admin | `metric` (z.enum 4 值, 必填)；`days` (z.coerce.number, 1-30, default 7) | `{ data: { metric: string, points: DashboardSparkPoint[] } }` | ADR-127 |
| 3 | GET | `/admin/dashboard/analytics` | admin | `period?: '7d'\|'30d'\|'90d'` (default '7d') | `{ data: { kpis: DashboardKpiSnapshot[], collectTimeline: DashboardTimelinePoint[], sourceTypeDistribution: DashboardSourceTypeStat[], recentTasks: DashboardCrawlerRunBrief[] } }` | ADR-127 |

（注：`GET /admin/videos/moderation-stats` +interceptDelta 扩展不新增端点，已在白名单存量豁免范围，不单独列入此表。）

### 3. 端点契约表（旧格式备查）

本节保留原始 Opus 设计的表格格式，正式 verify 版本见 §端点契约 节。

**错误码**（新增）：
- `VALIDATION_ERROR` (422)：query 参数 zod 校验失败（metric 不在枚举 / days 超范围）
- `INTERNAL_ERROR` (500)：聚合 query 失败兜底

**audit log**：3 个新端点均为 GET 只读，按 ADR-121 §"GET 只读不在范围"，无需 audit RETRO 7 文件框架。

### 4. 文件范围

**新建**（后端）：
- `apps/api/src/routes/admin/dashboard.ts`（3 端点容器；类比 `crawlerDashboard.ts` 结构）
- `apps/api/src/services/DashboardStatsService.ts`（聚合编排；调 queries，不写 SQL）
- `apps/api/src/db/queries/dashboardOverview.ts`（KPI + workflow 聚合 SQL）
- `apps/api/src/db/queries/dashboardSpark.ts`（7 天 day-grain 聚合 × 4 metric）
- `apps/api/src/db/queries/dashboardAnalytics.ts`（period 聚合 + timeline + 源类型分布）

**新建**（类型 + 前端）：
- `packages/types/src/dashboard.ts`（`DashboardKpiSnapshot` / `DashboardWorkflowSegment` / `DashboardSparkPoint` / `DashboardTimelinePoint` / `DashboardSourceTypeStat` / `DashboardCrawlerRunBrief` / `DashboardAnalyticsPayload`）
- `apps/server-next/src/lib/dashboard/api.ts`（fetcher：`getDashboardOverview` / `getDashboardSpark` / `getDashboardAnalytics`）

**修改**（后端）：
- `apps/api/src/routes/admin/videos.ts`（moderation-stats 追加 `interceptDelta`）
- `apps/api/src/db/queries/videos.ts`（`getModerationStats` 追加昨日拦截率聚合）
- `apps/api/src/app.ts`（注册 `adminDashboardRoutes`）

**修改**（前端）：
- `apps/server-next/src/lib/dashboard-data.ts`（`buildDashboardStats` 入参扩为 `{ moderationStats, overview } | null`；live 路径覆盖 4 KPI + 4 workflow 段）
- `apps/server-next/src/app/admin/_client/DashboardClient.tsx`（并行拉 2 端点：moderation-stats + overview；spark 按需）
- `apps/server-next/src/app/admin/_client/AnalyticsView.tsx`（消费 `/admin/dashboard/analytics`；从占位升级为真实视图）

**测试**（新增）：
- `tests/unit/api/routes/admin/dashboard.test.ts`（3 端点 happy path + 422 + auth）
- `tests/unit/components/server-next/admin/dashboard/AnalyticsView.test.tsx`（live + 占位两态）

### 5. 替代方案

| 方案 | 端点数 | 优劣 | 否决原因 |
|---|---|---|---|
| A 扩展 moderation-stats | 0 新端点 | 最小改动 | 语义污染；不适合视频总量/源数据 |
| B 单聚合全包 | 1 新端点 | 请求数最少 | spark 膨胀响应；analytics 与 overview 形状不同 |
| C 细粒度多端点 | 8+ | 解耦清晰 | 首屏 8 次往返；维护成本高 |
| D 混合（采纳） | 3 新 + 1 扩展 | 请求数与语义平衡 | — |

### 6. 后果

**正面**：
1. Dashboard 4 KPI + WorkflowCard 4 段全量真实化，`data-source="mock"` 标记清零（除 3 个延后卡片）
2. Analytics Tab 从占位升级为真实视图，与 dashboard KPI 类型对齐
3. spark 按需调用，不阻塞首屏
4. moderation-stats 向后兼容（仅 append `interceptDelta` 字段）

**负面 / 风险**：
1. spark 实时聚合性能未量化，触发 ADR-127a 条件预设为监控指标
2. WorkflowCard"采集入库"与 crawlerKpi 语义近似但口径独立（dashboard 当日 / crawlerKpi 批次粒度），端点 jsdoc 需明确口径

### 7. 延后决策

| 功能 | 延后原因 | 目标 ADR |
|---|---|---|
| AttentionCard 真实化 | 跨 crawler / image-health / merge 3 域聚合 | ADR-130 |
| RecentActivityCard 真实化 | audit_log 跨 targetKind + 用户名 JOIN | ADR-131 |
| SiteHealthCard 真实化 | health score 口径统一（与 crawlerKpi 协调） | ADR-132 |
| dashboard_kpi_snapshots time-series 表 | 实时聚合优先，未达触发条件 | ADR-127a |
| spark 30d/90d 长窗口 | 当前仅 7d 需求 | ADR-127a |

### 8. 关联

- ADR-100 R7 MUST-8（admin route ADR 前置门禁）
- ADR-121（GET 只读端点不在 audit RETRO 范围）
- ADR-122（crawlerDashboard 路由结构参照）
- ADR-126 §5（编号冲突已修正：API Key 顺延至 ADR-128，活跃会话 ADR-129）
- CHG-SN-7-MISC-DASHBOARD-2

### 9. 自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 正确性 | A | 3 端点 GET 全只读 / 不触发 audit / 不破坏分层 / moderation-stats 向后兼容 |
| 边界 | A- | dashboard 路由独立文件与 crawlerDashboard 对称；analytics 与 overview 解耦；workflow-counts 双暴露风险已在实施期决议移除 |
| 扩展性 | A | spark 实时→快照演进 ADR-127a 预留 / 3 个延后卡片路径明列 / DashboardKpiSnapshot 类型两端点共享 |
| 一致性 | A | 认证 `requireRole(['admin'])` / 错误码 VALIDATION_ERROR + INTERNAL_ERROR / fetcher 命名 getDashboard* 与 getModerationStats 风格统一 |

**综合**：**A-**（arch-reviewer claude-opus-4-7 裁决）

## ADR-133 — 字幕 KPI 统计端点协议设计（CHG-SN-7-MISC-SUBTITLES-1）

**状态**：Accepted（Conditional PASS：C1 ADR-128 编号已修正为 ADR-133；C3 approved_today_count 标签修正为「今日新增并通过」）
**日期**：2026-05-20
**arch-reviewer**：claude-opus-4-7

### 1. 背景

字幕审核页面（`/admin/subtitles`）当前只有列表，缺少顶部统计概览。需要新增 `GET /admin/subtitles/stats` 端点，以单一 SQL 聚合查询返回 4 项 KPI 指标，前端消费 KpiCard 组件展示。

### 2. 决策

新增 1 个只读 GET 端点，使用单条 `COUNT(*) FILTER (WHERE ...)` SQL 获取 4 项指标，避免多轮查询。

### 端点契约

| # | Method | Path | 权限 | Params | Response `data` 字段 | ADR |
|---|--------|------|------|--------|---------------------|-----|
| 1 | GET | `/admin/subtitles/stats` | moderator+admin | — | `{ pendingCount, approvedTodayCount, rejectedTodayCount, totalVerifiedCount, generatedAt }` | ADR-133 |

### 3. SQL 设计

```sql
SELECT
  COUNT(*) FILTER (WHERE is_verified = false AND deleted_at IS NULL)                                              AS pending_count,
  COUNT(*) FILTER (WHERE is_verified = true  AND deleted_at IS NULL AND created_at >= date_trunc('day', NOW())) AS approved_today_count,
  COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND deleted_at >= date_trunc('day', NOW()))                     AS rejected_today_count,
  COUNT(*) FILTER (WHERE is_verified = true  AND deleted_at IS NULL)                                            AS total_verified_count
FROM subtitles
```

**已知限制（C3）**：`approved_today_count` 使用 `created_at` 而非 `verified_at` 作为「今日」代理（subtitles 表无 verified_at 列）。语义为「今日新增并通过」，前端标签需对应修正，不得写「今日通过」。

### 4. Response 结构

```typescript
interface SubtitleStats {
  readonly pendingCount: number          // 待审核（is_verified=false, deleted_at IS NULL）
  readonly approvedTodayCount: number    // 今日新增并通过（created_at >= today, is_verified=true）
  readonly rejectedTodayCount: number    // 今日已拒绝（deleted_at >= today）
  readonly totalVerifiedCount: number    // 累计通过（is_verified=true, deleted_at IS NULL）
  readonly generatedAt: string           // ISO 8601 时间戳
}
```

### 5. 分层约束

- Route 层：`≤10 行`，零业务逻辑，直接调 `contentService.getSubtitleStats()`
- Service 层：`getSubtitleStats()` 调 DB query，映射字段（snake_case → camelCase），追加 `generatedAt`
- Query 层：单条 SQL，COUNT FILTER 模式，返回原始 string 类型（pg 返回 bigint 字符串）

### 6. 关联

- ADR-100 R7 MUST-8（admin route ADR 前置门禁）
- ADR-126 §5（编号顺延：ADR-128 预留给 API Key 管理）
- ADR-127（Dashboard Stats 同类设计参照）
- CHG-SN-7-MISC-SUBTITLES-1

## ADR-134 — 管理员手动创建字幕端点协议设计（CHG-SN-7-MISC-SUBTITLES-2）

**状态**：Accepted（Conditional PASS：C1-C4 全部落地；SUBTITLE_DUPLICATE 409 注册为 DEBT-ADR-134-DUPLICATE，subtitles 表当前无 unique 约束）
**日期**：2026-05-20
**arch-reviewer**：claude-opus-4-7

### 1. 背景

管理员需要在 `/admin/subtitles` 页面手动添加字幕记录（指向已上传至 R2 的 URL），绕过用户侧 multipart 上传流程。管理员创建的字幕直接 `is_verified=true`，不进入待审队列（不影响 ADR-133 KPI 待审计数）。

### 2. 决策

新增 `POST /admin/subtitles` JSON 端点，接受 R2 URL 而非文件 binary。Service 层校验视频存在性 + 类型兼容（电影禁 episodeNumber），DB 层写入 is_verified=true。

### 端点契约

| # | Method | Path | 权限 | Params | Response `data` 字段 | ADR |
|---|--------|------|------|--------|---------------------|-----|
| 1 | POST | `/admin/subtitles` | moderator+admin | body: `{ videoId, language, label, format, fileUrl, episodeNumber? }` | `{ id, videoId, episodeNumber, language, label, fileUrl, format, isVerified, createdAt }` | ADR-134 |

### 3. 字段验证（zod）

```typescript
const CreateAdminSubtitleSchema = z.object({
  videoId:       z.string().uuid(),
  language:      z.string().min(2).max(10).regex(/^[a-zA-Z]{2,3}(-[A-Za-z0-9]{2,8})?$/),
  label:         z.string().min(1).max(50).trim(),
  format:        z.enum(['vtt', 'srt', 'ass']),
  fileUrl:       z.string().url().refine(
    (u) => { const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, ''); return !base || u.startsWith(base) },
    { message: 'fileUrl 必须指向项目 R2 存储（R2_PUBLIC_BASE_URL 未配置时跳过校验）' }
  ),
  episodeNumber: z.number().int().positive().nullable().optional(),
})
```

### 4. 错误码

| CODE | HTTP | 触发条件 |
|------|------|----------|
| `VALIDATION_ERROR` | 422 | zod 校验失败（字段缺失/格式错误/fileUrl 非 R2 域） |
| `VIDEO_NOT_FOUND` | 404 | videoId 不存在或已软删除 |
| `EPISODE_MISMATCH` | 422 | 视频类型为 movie 但传入了 episodeNumber |
| `INTERNAL_ERROR` | 500 | 兜底 |

### 5. DEBT 登记

| DEBT-ID | 描述 | 优先级 |
|---------|------|--------|
| DEBT-ADR-134-DUPLICATE | SUBTITLE_DUPLICATE (409) 未实装：subtitles 表无 unique(video_id, episode_number, language) 约束，去重需 DDL 或 SELECT-before-INSERT | P3 |

### 6. 关联

- ADR-100 R7 MUST-8（admin route ADR 前置门禁）
- ADR-133（字幕 KPI stats 端点 — adminCreate 不增 pendingCount）
- CHG-SN-7-MISC-SUBTITLES-2

---

## ADR-135：图片健康运营 Actions（rescan + switch-fallback-domain）

**状态**：已通过（Opus CONDITIONAL PASS 2026-05-20 / CHG-SN-7-MISC-IMAGE-1）
**日期**：2026-05-20
**关联任务**：CHG-SN-7-MISC-IMAGE-1（SEQ-20260507-01 / M-SN-7 MISC）

### 1. 问题背景

`/admin/image-health` 页面 PageHeader 仅有「触发 Backfill」「刷新」2 个按钮，缺少：

1. 将 broken/missing 封面**重新入队健康检查**的快速触发操作
2. 批量将某 CDN 域名替换为备用域名（fallback 切换）的运营工具

### 2. 决策

新增 2 个 POST 端点（admin 权限），补全运营 actions：

- `POST /admin/image-health/rescan`：按 scope 将 poster_status 重置为 `pending_review` 后触发 backfill 入队
- `POST /admin/image-health/switch-fallback-domain`：dryRun 模式返回影响行数预览，实际执行时批量 REPLACE 域名

### 端点契约

| # | Method | Path | 权限 | Body 参数 | Response `data` 字段 | ADR |
|---|--------|------|------|-----------|---------------------|-----|
| 1 | POST | `/admin/image-health/rescan` | admin | `scope: 'all'\|'broken_only'\|'missing_only'`（default `broken_only`） | `{ updatedCount: number, enqueued: boolean, scope: string }` | ADR-135 |
| 2 | POST | `/admin/image-health/switch-fallback-domain` | admin | `fromDomain: string, toDomain: string, dryRun: boolean`（default `true`） | `{ dryRun: boolean, affectedRows: number, affectedColumns: number, breakdown: { cover_url: number, backdrop_url: number, banner_backdrop_url: number } }` | ADR-135 |

### 4. Zod Schema

```typescript
// rescan
const RescanBodySchema = z.object({
  scope: z.enum(['all', 'broken_only', 'missing_only']).default('broken_only'),
})

// switch-fallback-domain
const SwitchDomainBodySchema = z.object({
  fromDomain: z.string().min(3).max(253),
  toDomain:   z.string().min(3).max(253),
  dryRun:     z.boolean().default(true),
})
```

### 5. scope 语义

| scope | 重置目标 poster_status |
|-------|----------------------|
| `broken_only` | `'broken'` |
| `missing_only` | `'missing'` |
| `all` | `'broken'` 或 `'missing'`（不重置 'ok'/'pending_review'） |

### 6. 域名替换安全性

使用 `REPLACE(col, '://' || fromDomain || '/', '://' || toDomain || '/')` 精确匹配 `://domain/` 前缀，避免子域或部分域名误替换。同时 `dryRun=true`（默认）仅 COUNT 不写入，操作者二次确认后以 `dryRun=false` 执行。

### 7. Audit Log

两端点均写 `admin_audit_log`：

| 端点 | actionType | targetKind | afterJsonb |
|------|-----------|-----------|-----------|
| rescan | `image_health.rescan` | `image_health` | `{ scope, updatedCount, enqueued }` |
| switch-fallback-domain | `image_health.switch_domain` | `image_health` | `{ fromDomain, toDomain, dryRun, affectedRows }` |

### 8. 错误码

| CODE | HTTP | 触发条件 |
|------|------|----------|
| `VALIDATION_ERROR` | 400 | zod 校验失败 |
| `INTERNAL_ERROR` | 500 | DB 操作失败 / worker 入队失败 |

### 9. 关联

- ADR-100 R7 MUST-8（admin route ADR 前置门禁）
- ADR-109（admin_audit_log）
- CHG-SN-7-MISC-IMAGE-1

---

## ADR-136 — 用户 KPI 统计端点协议设计（CHG-SN-7-MISC-USERS-2）

**状态**：Accepted（PASS — arch-reviewer Opus 2026-05-20；N1/N2 为非阻塞建议）
**日期**：2026-05-20
**arch-reviewer**：claude-opus-4-7

### 1. 背景

用户管理页面（`/admin/users`）当前只有列表，缺少顶部统计概览。需要新增 `GET /admin/users/stats` 端点，以单一 SQL 聚合查询返回 4 项 KPI 指标，前端消费 KpiCard 组件展示。

### 2. 决策

新增 1 个只读 GET 端点，使用单条 `COUNT(*) FILTER (WHERE ...)` SQL 获取 4 项指标，避免多轮查询。

### 端点契约

| # | Method | Path | 权限 | Params | Response `data` 字段 | ADR |
|---|--------|------|------|--------|---------------------|-----|
| 1 | GET | `/admin/users/stats` | admin | — | `{ totalCount, newTodayCount, bannedCount, moderatorCount, generatedAt }` | ADR-136 |

### 3. SQL 设计

```sql
SELECT
  COUNT(*) FILTER (WHERE deleted_at IS NULL)                                                          AS total_count,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND created_at >= date_trunc('day', NOW()))               AS new_today_count,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND banned_at IS NOT NULL)                                AS banned_count,
  COUNT(*) FILTER (WHERE deleted_at IS NULL AND role = 'moderator')                                   AS moderator_count
FROM users
```

所有计数均排除软删除用户（deleted_at IS NULL）。`new_today_count` 使用 `date_trunc('day', NOW())` 作为当天起始，与 ADR-133 同款模式。

### 4. Response 结构

```typescript
interface UserStats {
  readonly totalCount: number        // 全部有效用户（deleted_at IS NULL）
  readonly newTodayCount: number     // 今日新注册（created_at >= today）
  readonly bannedCount: number       // 已封账号（banned_at IS NOT NULL）
  readonly moderatorCount: number    // 版主（role = 'moderator'）
  readonly generatedAt: string       // ISO 8601 时间戳
}
```

### 5. 分层约束

- Route 层：`≤10 行`，零业务逻辑，直接调 `usersService.getUserStats(db)`
- Service 层（可内联 route，与 ADR-127/133 同步）：`getUserStats()` 调 DB query，映射字段，追加 `generatedAt`
- Query 层：`statsAdminUsers(db)` 单条 SQL，COUNT FILTER 模式，返回原始 string 类型

### 6. 前端 KpiCard 映射

| 序号 | label | value 字段 | variant |
|------|-------|-----------|---------|
| 1 | 全部用户 | totalCount | default |
| 2 | 今日新增 | newTodayCount | is-ok |
| 3 | 已封账号 | bannedCount | is-danger |
| 4 | 版主 | moderatorCount | default |

### 7. 权限

仅 admin（与现有 `/admin/users` 列表端点对齐，users 表不向 moderator 开放）。

### 8. 错误码

| CODE | HTTP | 触发条件 |
|------|------|----------|
| `INTERNAL_ERROR` | 500 | DB 操作失败 |

### 9. 关联

- ADR-100 R7 MUST-8（admin route ADR 前置门禁）
- ADR-127（Dashboard Stats 同类设计参照）
- ADR-133（字幕 KPI stats 端点同类参照）
- CHG-SN-7-MISC-USERS-2

---

## 后台视频竖版 Poster 尺寸固化（CHG-SN-7-MISC-VIDEOS-1）

**决策日期**：2026-05-20  
**决策来源**：CHG-UX2-03（后台交互改造）+ CHG-SN-7-MISC-VIDEOS-1  
**状态**：✅ 固化

### 背景

后台 reference.md v2.1 初版以 32×48 作为视频竖版 poster 尺寸规格。
CHG-UX2-03 将后台视频卡竖版封面尺寸升级到 48×72，以改善视觉识别度。
Thumb 组件（CHG-DESIGN-08，`size="poster-sm"`）已按 48×72 实装并消费于视频库。

### 决议

**保留 48×72**。旧的 32×48 规格从所有设计规范文档中废弃。

### 影响范围

| 场景 | 规格 |
|------|------|
| 视频库 `thumb` 列封面 | 48×72 竖版，radius 4 |
| VideoEditDrawer 封面预览 | 48×72 竖版 |
| 其他后台列表 poster 位置 | 48×72 竖版（统一） |
| Home Ops banner / 前台横向运营位 | 维持横图，不受此决议影响 |

### 更新位置

- `docs/designs/backend_design_v2.1/reference.md` §5.3 / §6.1 / §8 / §9 共 4 处
- 本 decisions.md 条目（CHG-SN-7-MISC-VIDEOS-1）

### 关联

- CHG-UX2-03（原始升级决策）
- CHG-DESIGN-08（Thumb 组件实装，已按 48×72 落地）

## ADR-137 — 类似视频召回端点协议设计（CHG-SN-8-04）

**状态**：Accepted（arch-reviewer A− PASS / 1 非阻塞建议 N1 登记 follow-up）
**日期**：2026-05-21
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）

---

### 1. 决策摘要

新增只读端点 `GET /admin/moderation/:id/similar`，召回与目标视频在类型 / 年份 / 国家 / 题材维度最接近的 top-N 视频列表，供审核台 TabSimilar 渲染并提供「发起合并」深链入口。采用纯字段过滤 + 加权评分方案（方案 A），零新依赖，后续可平滑升级到向量召回。闭合 W1 金票反例 #3「审核台右栏类似 Tab 是占位 — 无法找重复视频」。

---

### 2. 背景

- TabSimilar 当前为显式占位（`apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx`，注释 "M-SN-5 占位实装"），零 API 调用，仅展示占位文案。
- CHG-SN-8-04 要求：端点 → top10 召回 → TabSimilar 渲染列表 + 每行「发起合并」按钮深链至 `/admin/merge?candidate_a=<active>&candidate_b=<sim>&from=moderation`。
- 视频元数据（year / country / genres）已迁移至 `media_catalog` 表（migration 029 从 `videos` 表删除了 year / country 列），通过 `videos.catalog_id → media_catalog.id` JOIN 获取。
- 既有索引可复用：`idx_videos_type`（videos.type）/ `idx_catalog_type_year`（media_catalog(type, year) WHERE year IS NOT NULL）/ `idx_catalog_genres`（media_catalog.genres GIN）。

---

### 3. 决策

**D-137-1 召回算法**：采用方案 A（纯字段过滤）。理由：零新依赖、零新基础设施、利用现有 btree + GIN 索引即可覆盖；方案 B（豆瓣 API）引入外部依赖 + 延迟不可控；方案 C（向量 embedding）需 pgvector 扩展 + embedding pipeline，属 M6+ 范畴。方案 A 通过 query params 留出扩展口，后续升级到 C 时接口不变、仅替换 Service/Query 层实现。

**D-137-2 召回评分公式**：Service 层计算 `similarityScore`（0-100 整数），公式：

| 维度 | 条件 | 得分 | 说明 |
|------|------|------|------|
| type 匹配 | v.type = target.type | +40 | 严格相等，最高权重 |
| year 接近 | abs(mc.year - target.year) | +25 × (1 - delta/yearRange) | delta 超过 yearRange 得 0 |
| country 匹配 | mc.country = target.country | +15 | 双方均非 NULL 且相等 |
| genres 重叠 | array overlap ratio | +20 × (交集 / 并集) | Jaccard 相似度 |

SQL 层做粗筛（type 相等 + year 区间 + LIMIT 50 候选），Service 层对候选集计算 score 后取 top-N 返回。score 作为响应字段返回前端（仅供展示参考，不承诺语义稳定性）。

**D-137-3 权限**：moderator + admin，与 pending-queue / audit-log 等同一守卫链（`requireModerator` hook）。

**D-137-4 query params**：`?limit=10`（default 10, max 20）/ `?yearRange=5`（default 5, max 15）。不暴露 minScore（Service 层内部硬编码下限 10，过滤噪声；前端无需控制）。

**D-137-5 audit**：GET 只读端点，不写 audit（与 pending-queue / audit-log / metadata-provenance 一致）。R-MID-1 7 文件框架不适用；降级为 4 文件（route + service method + query + 端点测试）。

**D-137-6 性能**：
- SQL 粗筛利用 `idx_videos_type` + `idx_catalog_type_year` 复合索引 + `idx_catalog_genres` GIN 索引，无需新建 migration。
- 粗筛 LIMIT 50 + Service 层 top-N 截断 → 扫描行数可控。
- p95 目标 ≤ 200ms（type 相等过滤后候选集通常 < 5000 行；LIMIT 50 保底）。
- 空结果返回 200 + 空数组，不报错。
- 目标视频不存在返回 404 `NOT_FOUND`。

---

### 端点契约

| # | Method | Path | 权限 | Path Params | Query Params | Response `data` 字段 | ADR |
|---|--------|------|------|-------------|-------------|---------------------|-----|
| 1 | GET | `/admin/moderation/:id/similar` | moderator+admin | `id: UUID` | `limit?: 1-20 (default 10)`, `yearRange?: 1-15 (default 5)` | `SimilarVideoItem[]` | ADR-137 |

---

### 5. SQL 设计

粗筛 query（Query 层 `listSimilarCandidates`）：

```sql
SELECT v.id, v.title, v.type, mc.year, mc.country, mc.genres,
       mc.cover_url, v.meta_score, v.review_status, v.is_published
FROM videos v
JOIN media_catalog mc ON mc.id = v.catalog_id
WHERE v.deleted_at IS NULL
  AND v.id != $1
  AND v.type = $2
  AND ($3::int IS NULL OR mc.year BETWEEN $3 - $4 AND $3 + $4)
ORDER BY v.meta_score DESC
LIMIT 50
```

索引利用：`v.type = $2` 走 `idx_videos_type`（btree）；`mc.year BETWEEN` 通过 nested loop 利用 `idx_catalog_type_year`。50 行上限确保 Service 层 score 计算开销 O(1)。country / genres 不作 SQL WHERE 条件（空值比例高，放 Service 层评分更灵活）。

---

### 6. Response 结构

```typescript
interface SimilarVideoItem {
  readonly id: string
  readonly title: string
  readonly type: VideoType
  readonly year: number | null
  readonly country: string | null
  readonly genres: readonly string[]
  readonly coverUrl: string | null
  readonly metaScore: number
  readonly reviewStatus: ReviewStatus
  readonly isPublished: boolean
  readonly similarityScore: number  // 0-100, Service 层计算
}
```

响应信封：`{ data: SimilarVideoItem[] }`（`ApiResponse<SimilarVideoItem[]>`），空数组时 data 为 `[]`。

---

### 7. zod schema

```typescript
const SimilarPathParams = z.object({ id: z.string().uuid() })
const SimilarQueryParams = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(10),
  yearRange: z.coerce.number().int().min(1).max(15).default(5),
})
```

响应不做 zod 校验（Service 层已类型安全）。

---

### 8. 性能 baseline + 错误码

性能：p95 ≤ 200ms / 粗筛 LIMIT 50 防护 / 空结果 200 OK。

| CODE | HTTP | 触发条件 |
|------|------|----------|
| `NOT_FOUND` | 404 | 目标视频 id 不存在（deleted_at IS NOT NULL 或无此行） |
| `VALIDATION_ERROR` | 422 | path/query params 不合法（zod 自动） |
| `INTERNAL_ERROR` | 500 | DB 操作失败 |

全部复用 ADR-110 ERRORS 字典既有码，不新增 ErrorCode。

---

### 9. 分层约束

- **Route 层**（`apps/api/src/routes/admin/moderation.ts` 新增 GET handler）：≤ 10 行，零业务逻辑。解析 params + 调 `ModerationService.listSimilar(db, id, opts)` + reply.send。
- **Service 层**（`apps/api/src/services/ModerationService.ts` 新增 `listSimilar` 方法）：先查目标视频取 type/year/country/genres 特征；调 Query 层获取候选集；逐行计算 similarityScore；按 score desc 排序 + 截断 top-N；映射 camelCase 返回。
- **Query 层**（`apps/api/src/db/queries/moderation.ts` 新增 `listSimilarCandidates` + `findVideoFeatures`）：纯 SQL，返回原始 snake_case 行类型。

---

### 10. 文件范围（R-MID-1 GET 只读简化版 4 文件）+ 测试用例

| # | 文件 | 角色 |
|---|------|------|
| 1 | `apps/api/src/routes/admin/moderation.ts` | Route handler 新增 GET /:id/similar |
| 2 | `apps/api/src/services/ModerationService.ts` | Service 新增 listSimilar 方法 |
| 3 | `apps/api/src/db/queries/moderation.ts` | Query 新增 listSimilarCandidates + findVideoFeatures |
| 4 | `tests/unit/api/moderation-similar.test.ts` | 端点单测 |

测试用例 ≥ 5：
1. happy path：目标视频有同 type 候选 → 返回 200 + 非空 data + score 降序
2. 目标视频不存在 → 404 NOT_FOUND
3. 无匹配候选 → 200 + 空 data
4. limit 参数生效（limit=3 → 最多返回 3 条）
5. yearRange 参数生效（yearRange=1 → 仅返回 ±1 年内候选）
6. 权限校验：未认证 → 401

---

### 11. 关联 ADR + 后续解锁 + 非阻塞建议

- **ADR-100** R7 MUST-8（admin route ADR 前置门禁 — 本 ADR 满足）
- **ADR-110**（ErrorCode 真源归属 — 复用 NOT_FOUND / VALIDATION_ERROR / INTERNAL_ERROR）
- **ADR-105**（merge 端点协议 — TabSimilar 行内「发起合并」按钮深链至 merge 页面，消费 ADR-105 定义的 merge 端点）

**后续解锁卡**：
- **CHG-SN-8-04-EP**：按本 ADR 实施端点 + Service + Query + 测试
- **CHG-SN-8-04-VIEW**：TabSimilar.tsx 改造消费端点 + 渲染列表 + 合并深链按钮

**N1 非阻塞建议 — ✅ 已闭合（CHG-SN-8-04-N1 / 2026-05-21）**：评分公式中 `type` 维度占 40 分且作为 SQL WHERE 严格相等条件，意味着跨类型相似视频（如同名电影的 anime 改编版）永远不会被召回。建议在实施时考虑：当 type 严格匹配候选 < limit 时，可 fallback 到 type 不限的二次查询补足。**实施落地**：`listSimilarCandidates` 新增 `relaxType?: boolean` + `excludeIds?: readonly string[]` 参数；`ModerationService.listSimilar` strict 通过 minScore 后 < limit 时发起 fallback relaxType 查询（excludeIds 排除首次结果避免重复）；跨类型候选 `computeSimilarityScore` 自然在 type 维度 +0（不变公式）；合并后整体 score 排序 + slice top-N。测试新增 2 用例（fallback 命中 + strict ≥ limit 不触发），全 15 PASS。

---

## ADR-139 — 管理员变更用户角色后 session invalidate 协议（CHG-SN-8-FUP-USERS-ROLE-INV）

**状态**：Accepted（arch-reviewer A− PASS / 2 非阻塞建议 N1-139-1 + N1-139-2 登记 follow-up）
**日期**：2026-05-21
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-users-role-session-invalidate`（P2 安全）

---

### 1. 决策摘要

采用**方案 B（`users.role_changed_at` 时间戳 + access token `iat` 校验）**作为角色变更后的 session invalidate 策略，并**在 refresh 端点拒绝过期 token**（强制重新登录），同时清除 `user_role` cookie 使 Next.js middleware 立即失去旧角色 gate。该方案以 1 列 schema 变更 + middleware 增加 1 次 Redis 缓存查询的成本，将角色变更后的权限穿越窗口从最大 15 分钟降至 0（middleware 实时校验），闭合 GAPS.md `#G-users-role-session-invalidate` P2 安全风险。

---

### 2. 背景

**问题 1 — access token 权限穿越**：当前 `PATCH /admin/users/:id/role` 端点（`apps/api/src/routes/admin/users.ts:98-125`）仅调用 `usersQueries.updateUserRole` 写 DB，不触及 JWT 或 Redis。被降级用户的 access token（`apps/api/src/lib/auth.ts:15` ACCESS_TOKEN_EXPIRES_IN = `'15m'`）内嵌 `role` 字段仍为旧值，15 分钟有效期内可继续通过 `requireRole` 校验（`apps/api/src/plugins/authenticate.ts:100-113` 仅检查 `request.user.role`，不查 DB）。

**问题 2 — refresh token 静默续约**：被降级用户的 refresh token（30 天 TTL，`apps/api/src/lib/auth.ts:16`）未被 blacklist。`UserService.refresh`（`apps/api/src/services/UserService.ts:110-127`）基于 DB 当前 role 重签 access token，新 token 含新 role — 但 refresh 路由（`apps/api/src/routes/auth.ts:131-153`）**不更新 `user_role` cookie**（仅 login/register/dev-login 设置该 cookie），导致 Next.js middleware 层面仍读旧 cookie。

**问题 3 — `user_role` cookie 滞留**：`user_role` cookie 为非 HttpOnly（`apps/api/src/routes/auth.ts:33-39`，30 天 maxAge），供 `apps/server-next/src/middleware.ts` 的 `parseUserRole` + `canAccessAdmin` 做路径 gate。角色降级为 `user` 后，cookie 仍为 `moderator`/`admin`，用户可继续访问 `/admin/**` 页面直至 cookie 自然过期或手动 logout。

---

### 3. 决策

#### D-139-1 失效策略选型

选择**方案 B（`users.role_changed_at` 时间戳）**。

| 维度 | 方案 A: `role_version` int | 方案 B: `role_changed_at` timestamp | 方案 C: refresh blacklist by user_id | 方案 D: 混合 (B+C) |
|------|---|---|---|---|
| **schema 变更** | `users` 加 `role_version INT DEFAULT 0` | `users` 加 `role_changed_at TIMESTAMPTZ DEFAULT NULL` | 不动 users；Redis sorted set `user:rt:{userId}` | `users` 加 `role_changed_at` + Redis sorted set |
| **access token payload 变更** | 新增 `roleVersion` 字段 | 无（复用已有 `iat`） | 无 | 无（复用 `iat`） |
| **middleware 校验成本** | 每请求查 DB 或 Redis 取 `role_version` 并比对 token 内 `roleVersion` | 每请求查 DB 或 Redis 取 `role_changed_at` 并比对 token 内 `iat` | 无额外校验（access token 自然过期） | 每请求查 `role_changed_at` |
| **权限穿越窗口** | 0（实时校验） | 0（实时校验） | 最大 15 分钟（access token TTL） | 0（实时校验） |
| **refresh 端点影响** | Service 层需比对 version | Service 层比对 `iat >= role_changed_at` | 黑名单查询（已有模式）| 两者都做 |
| **Token payload 向后兼容** | 破坏（旧 token 无 `roleVersion`） | 兼容（`iat` 已存在） | 兼容 | 兼容 |
| **Redis 数据结构复杂度** | 可选缓存 `role_version` | 可选缓存 `role_changed_at` | 新增 sorted set 维护 user_id → token_hash 集合 | 缓存 + sorted set |
| **实现复杂度** | 中（改 payload 类型 + 签发 + 校验 3 处） | 低（只改 middleware + refresh service 2 处） | 中（需在 login/register 写 set + role 变更时遍历 set） | 高（B+C 全部工作量） |
| **回退风险** | 回退时旧 token 无 `roleVersion` 需兼容逻辑 | 回退时 `role_changed_at NULL` 即放行，天然兼容 | 回退时 sorted set 残留无害 | 复合回退 |

**选择理由**：方案 B 以最小改动（1 列 + 不改 token payload）实现 0 穿越窗口，且天然向后兼容（`role_changed_at IS NULL` 意味着角色从未被改，放行）。方案 A 需改 `AccessTokenPayload` 类型 + 所有签发位点 + 所有验证位点，破坏已发出 token 的兼容性。方案 C 虽不需 schema 变更但 15 分钟穿越窗口不满足 P2 安全要求。方案 D 功能最全但复杂度是 B 的 2 倍以上，且 B 已覆盖安全需求（权限穿越窗口 = 0），C 部分为冗余。

#### D-139-2 access token 失效语义

当 middleware（`apps/api/src/plugins/authenticate.ts` 的 `resolveUser` 函数）检测到 `token.iat < user.role_changed_at` 时：

- 返回 `401` + 错误码 `ROLE_CHANGED`（新增 ErrorCode）
- 错误 message：`'您的权限已变更，请重新登录'`
- 前端收到 `ROLE_CHANGED` 后执行 forced logout（调 `POST /auth/logout` 清 cookie + 清内存 token + redirect `/login?reason=role_changed`）
- **不静默续约**：不调 refresh 尝试获取新 access token。理由：角色变更是管理员主动行为，用户应明确感知并重新建立 session，避免「权限悄悄变了但用户不知道」的 UX 问题。

#### D-139-3 refresh token 处置

选择**拒绝 refresh + 强制重新登录**。

当 `POST /auth/refresh` 被调用时，`UserService.refresh` 已查 DB 获取当前用户（`apps/api/src/services/UserService.ts:122`）。新增逻辑：若 `user.roleChangedAt` 非空且 `refreshTokenPayload.iat < user.roleChangedAt`，抛出 `UnauthorizedError('您的权限已变更，请重新登录')`，返回 401 `ROLE_CHANGED`。

**理由**：允许用旧 refresh token 拿新 access token 虽然新 token 含正确 role，但 `user_role` cookie 在 refresh 路由中当前不更新（需额外改动），且用户无感知角色变更的 UX 问题仍存在。强制重新登录是更安全且 UX 更明确的选择。

#### D-139-4 user_role cookie 同步

选择**强制 logout 让 cookie 自然消失**。

与 D-139-3 一致：角色变更后，用户下次任何 API 请求（携带旧 access token）触发 401 `ROLE_CHANGED` → 前端执行 logout → `POST /auth/logout` 路由（`apps/api/src/routes/auth.ts:206-221`）已有 `reply.clearCookie(ROLE_COOKIE, { path: '/' })`，cookie 被清除。用户重新登录时，login 路由（`apps/api/src/routes/auth.ts:114-115`）设置新的 `user_role` cookie。

**一致性核对**：D-139-3 拒绝 refresh → D-139-4 不依赖 refresh 更新 cookie → 用户只能通过 logout + re-login 获得新 cookie → 自洽。

**Next.js middleware 过渡窗口**：在用户前端尚未收到 401 之前，`user_role` cookie 仍为旧值，Next.js middleware 可能放行已降级用户访问 `/admin/**` 页面。但页面内的 API 调用会被后端 middleware 拦截（401 ROLE_CHANGED），页面功能不可用。该窗口为纯前端路由层面，无实际数据泄露风险（API 层已守门）。

#### D-139-5 schema 变更

```sql
ALTER TABLE users ADD COLUMN role_changed_at TIMESTAMPTZ DEFAULT NULL;
```

- **列名**：`role_changed_at`
- **类型**：`TIMESTAMPTZ`
- **默认值**：`NULL`（从未被改过角色的用户为 NULL，middleware 视为放行）
- **索引**：不需要。该列仅在 middleware per-request 查询中作为 WHERE 条件的一部分（按 `users.id` 主键查询后取值），不作为独立查询条件。
- **Migration 编号**：实施卡填实际编号（按 `ls apps/api/src/db/migrations | sort -t_ -n -k1` 取末尾 +1）

不修改 `admin_audit_log` 的 `target_kind` CHECK 约束（`user` target_kind 的新增属于 R-MID-1 audit 补齐范畴，不在本 ADR 范围内；D-139-6 详述）。

#### D-139-6 R-MID-1 评估

**当前状态**：`PATCH /admin/users/:id/role` 路由（`apps/api/src/routes/admin/users.ts:98-125`）**未挂载** `insertAuditLog` 调用。grep 确认 `users.ts` 中无 `insertAuditLog` / `auditSvc` / `audit` 引用。

**评估**：

1. **role 变更端点的 audit log**：应补齐。需新增 `AdminAuditActionType = 'user.role_change'` + `AdminAuditTargetKind` 扩展含 `'user'`。但这属于 R-MID-1 7 文件框架（ADR-121）范畴，需同步 4 真源 + 7 文件。本 ADR-139 仅设计 session invalidate 协议，audit 补齐应作为 CHG-SN-8-FUP-USERS-ROLE-INV-EP 实施卡的 R-MID-1 子任务。

2. **middleware 401 ROLE_CHANGED 是否需新 audit type**：否。middleware 层的 401 是鉴权拒绝，与 `admin_audit_log`（记录 admin 写操作）语义不同。401 已有 pino request log 记录（logging-rules.md），不额外写 audit。

3. **结论**：本 ADR 不触发 R-MID-1 7 文件框架。audit 补齐（`user.role_change` actionType + `user` targetKind + 4 真源同步）在实施卡 follow-up 中执行，本 ADR 仅登记此需求。

#### D-139-7 性能影响

**middleware 多一次查询**：`resolveUser`（`apps/api/src/plugins/authenticate.ts:47-65`）当前只做 JWT verify + Redis blacklist check。新增需查询 `users.role_changed_at`。

**方案**：Redis 缓存，key `user:rca:{userId}`，值为 `role_changed_at` ISO 字符串或 `"null"`。

- **写时机**：`PATCH /admin/users/:id/role` 端点在 DB UPDATE 后同步写 `SET user:rca:{userId} <role_changed_at> EX 900`（15 分钟 TTL = access token 生命周期；超过 15 分钟后旧 access token 自然过期，无需继续校验）。
- **读时机**：middleware `resolveUser` 在 JWT verify 成功后，`GET user:rca:{userId}`。若 key 不存在（cache miss 或从未被改角色），放行（等价于 `role_changed_at IS NULL`）。若 key 存在且 `token.iat < parseInt(value)`，返回 null（触发 401）。
- **cache miss 降级**：key 不存在 = 放行。不回查 DB。理由：缓存 TTL = access token TTL，在 TTL 内 cache 一定存在（role 变更端点刚写入）；TTL 过期后旧 access token 也过期了，不需要再校验。
- **成本**：每请求 1 次 Redis GET（O(1)，与现有 blacklist check 并行 `Promise.all`）。无额外 DB 查询。p99 增量 < 1ms。

#### D-139-8 admin 自残保护

**现状确认**（grep 实证 `apps/api/src/routes/admin/users.ts:111-121`）：

```typescript
const user = await usersQueries.findAdminUserById(db, id)
if (user.role === 'admin') {
  return reply.code(403).send({
    error: { code: 'FORBIDDEN', message: '不能修改 admin 账号的角色' },
  })
}
```

判断逻辑是检查**目标用户**的当前 role。若目标用户 role === `'admin'`，无论调用者是谁（即使是另一个 admin），一律返回 403。

`RoleSchema` 只接受 `z.enum(['user', 'moderator'])`（行 101），不允许设为 `admin`。

**结论**：admin-A 不能修改 admin-B 的角色（403 FORBIDDEN）。admin 不能把自己改为 user/moderator（同样会命中 `user.role === 'admin'` 守卫）。**当前保护已充分，ADR-139 不修改此逻辑**。

---

### 端点契约

| # | Method | Path | 权限 | Body / Query | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|-------------|----------------|---------------|-----|
| 1 | PATCH | `/admin/users/:id/role` | admin | `{ role: 'user' \| 'moderator' }` | `{ id, role }` + side-effect: DB `role_changed_at = NOW()` + Redis `user:rca:{id}` | `ROLE_CHANGED` (401, 仅 middleware 返回给被变更用户) | ADR-139 |

注：端点路径和 HTTP Method 不变（无新增端点），仅扩展内部行为。`ROLE_CHANGED` 错误码不在此端点响应中出现，而是在被变更用户后续请求的 middleware 中返回。

---

### 5. SQL / Schema 设计

**Migration**（实施卡填实际编号 NNN_users_role_changed_at.sql）：

```sql
-- NNN_users_role_changed_at.sql
-- 描述：users 表新增 role_changed_at 列（ADR-139 session invalidate 协议）
-- 日期：2026-05-XX（实施卡落地时填写）
-- ADR：ADR-139
-- 任务卡：CHG-SN-8-FUP-USERS-ROLE-INV-EP
-- 幂等：是（IF NOT EXISTS 模式 — ALTER ADD COLUMN 使用 DO block）

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'role_changed_at'
  ) THEN
    ALTER TABLE users ADD COLUMN role_changed_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN users.role_changed_at
  IS 'admin 变更该用户角色的最后时间戳（ADR-139）；NULL = 从未被改过；middleware 比对 access token iat 决定是否拒绝';

COMMIT;
```

**回滚 SQL**：

```sql
BEGIN;
ALTER TABLE users DROP COLUMN IF EXISTS role_changed_at;
COMMIT;
```

**`updateUserRole` query 修改**（`apps/api/src/db/queries/users.ts`）：

```sql
UPDATE users
SET role = $1, role_changed_at = NOW()
WHERE id = $2 AND deleted_at IS NULL
RETURNING id, role, role_changed_at
```

**`findUserById` query**：无需修改 — 当前为 `SELECT *`，会自动包含新列。映射函数 `mapUser` 需扩展 `roleChangedAt` 字段。

---

### 6. Response 结构 / 错误码

**新增 ErrorCode：`ROLE_CHANGED`**

| CODE | HTTP | 触发条件 | 返回位点 |
|------|------|----------|---------|
| `ROLE_CHANGED` | 401 | middleware `resolveUser` 检测到 `token.iat < user.roleChangedAt` | `apps/api/src/plugins/authenticate.ts` |
| `ROLE_CHANGED` | 401 | refresh 端点检测到 `refreshToken.iat < user.roleChangedAt` | `apps/api/src/services/UserService.ts` |

**响应体**（与现有 401 格式一致，ADR-110 `ApiErrorBody`）：

```json
{
  "error": {
    "code": "ROLE_CHANGED",
    "message": "您的权限已变更，请重新登录",
    "status": 401
  }
}
```

前端处理约定：auth store / interceptor 检测到 `error.code === 'ROLE_CHANGED'` 时，执行强制 logout 流程（不走 silent refresh），redirect 到 `/login?reason=role_changed`。login 页面可选展示提示文案。

---

### 7. 关联 ADR

| ADR | 关系 | 说明 |
|-----|------|------|
| ADR-003 | 依赖 | JWT 双 Token 方案；refresh token 黑名单 key 格式；access token 15min / refresh 30d TTL |
| ADR-010 | 依赖 | 三级角色体系 + `user_role` 非 HttpOnly cookie + Next.js middleware gate |
| ADR-109 | 参考 | admin_audit_log schema（role 变更 audit 补齐的前置表 — 实施卡 follow-up） |
| ADR-110 | 对齐 | ApiResponse 信封 + ErrorCode 真源（新增 `ROLE_CHANGED`） |
| ADR-121 | 延伸 | R-MID-1 7 文件框架（`user.role_change` actionType 补齐在实施卡内执行） |

---

### 8. R-MID-1 文件清单

**不适用（降级）**。理由：

- 本 ADR-139 仅设计 session invalidate 协议，不实施端点代码。
- `PATCH /admin/users/:id/role` 是**已有端点**的行为扩展（新增 side-effect），不是新增端点。
- R-MID-1 7 文件框架适用于**新增 audit actionType** 的场景。`user.role_change` audit 补齐作为实施卡 CHG-SN-8-FUP-USERS-ROLE-INV-EP 的子任务，在该卡内走 R-MID-1 完整流程（新增 `'user.role_change'` → union / ACTION_TYPES / set-equal / coverage / route audit 调用 / audit 内容断言测试 / changelog — 7 文件）。

---

### 9. 测试 surface

| # | 类型 | 场景 | 预期 | 文件 |
|---|------|------|------|------|
| 1 | unit | role 变更 → `updateUserRole` 同时更新 `role_changed_at` | RETURNING 含 `role_changed_at` 非空 | `tests/unit/api/admin-users.test.ts` |
| 2 | unit | role 变更 → Redis `user:rca:{userId}` 被写入（TTL 900s） | `redis.set` called with correct key + EX 900 | `tests/unit/api/admin-users.test.ts` |
| 3 | unit | middleware: `token.iat < role_changed_at` → 401 ROLE_CHANGED | `resolveUser` 返回 null + 响应 401 | `tests/unit/api/auth.test.ts` |
| 4 | unit | middleware: `token.iat >= role_changed_at` → 正常放行 | `resolveUser` 返回 user | `tests/unit/api/auth.test.ts` |
| 5 | unit | middleware: Redis key 不存在（cache miss）→ 放行 | `resolveUser` 返回 user | `tests/unit/api/auth.test.ts` |
| 6 | unit | refresh: `refreshToken.iat < role_changed_at` → 401 ROLE_CHANGED | `UserService.refresh` 抛 `UnauthorizedError` | `tests/unit/api/auth.test.ts` |
| 7 | unit | refresh: `refreshToken.iat >= role_changed_at` → 正常签发 | 返回新 access token | `tests/unit/api/auth.test.ts` |
| 8 | unit | refresh: `role_changed_at IS NULL` → 正常签发 | 返回新 access token（兼容未变更用户） | `tests/unit/api/auth.test.ts` |
| 9 | unit | admin 不能改 admin（现有测试不变） | 403 FORBIDDEN | `tests/unit/api/admin-users.test.ts` |
| 10 | integration | 完整流程：login → admin 改角色 → 旧 token 请求 → 401 → re-login → 新 role | 端到端状态流转正确 | `tests/unit/api/role-invalidate-integration.test.ts` (新) |
| 11 | e2e | 前端收到 ROLE_CHANGED → 自动 logout → redirect /login | 页面跳转 + toast 提示 | `tests/e2e/auth.spec.ts` (扩展) |
| 12 | unit | 并发竞态：两个 admin 同时改同一用户角色 → 最后写入的 `role_changed_at` 生效 | DB 自然串行，最后 UPDATE 的 NOW() 覆盖 | `tests/unit/api/admin-users.test.ts` |

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-139-1 | middleware 增加 Redis GET 导致每请求延迟增加 | 低 | Redis GET O(1) < 1ms；与现有 blacklist check `Promise.all` 并行；Redis down 时降级放行（与现有 blacklist 降级策略一致） |
| R-139-2 | `role_changed_at` 缓存 TTL 900s 内 Redis 宕机 → cache miss → 旧 token 放行 | 中 | 穿越窗口最大 15 分钟（与方案 C 等价 worst case）；Redis 恢复后缓存重建（role 变更端点下次调用时写入）；可选 fallback：cache miss 时查 DB（本 ADR 选择不查，保持 middleware 零 DB 依赖） |
| R-139-3 | 前端未正确处理 `ROLE_CHANGED` 错误码 → 陷入无限 refresh 循环 | 高 | 前端 interceptor 必须识别 `ROLE_CHANGED` 并跳过 silent refresh 直接 logout；测试 surface #11 覆盖此场景 |
| R-139-4 | 回退部署时旧代码不识别 `role_changed_at` 列 | 低 | 旧代码 `SELECT *` 会多读一列但不使用（JS 忽略多余字段）；`updateUserRole` 旧版 SQL 不含 `role_changed_at = NOW()`，该列保持 NULL = 放行 |

**回退路径**：

1. 代码回退：revert middleware 校验 + refresh 校验 + Redis 写入。旧 token 自然恢复放行。
2. Schema 保留：`role_changed_at` 列为 NULL 默认值，旧代码不读不写，无副作用。需要完全清理时执行 `ALTER TABLE users DROP COLUMN role_changed_at`。
3. Redis 清理：`DEL user:rca:*` 即可。

---

### 11. 非阻塞建议 / N1

**N1-139-1（评级 A− 因素）**：本 ADR 选择 cache miss 时**放行**（不回查 DB），理由是 TTL 900s 覆盖 access token 生命周期。但存在极端场景：admin 改角色后立即重启 Redis（数据丢失）→ 被降级用户在 15 分钟内继续持有旧权限。如果此风险不可接受，实施卡可在 `resolveUser` 中增加 cache miss + `role_changed_at` 列存在 → 查 DB fallback（每次 cache miss 多 1 次 DB 查询，频率极低）。建议作为实施卡内条件判断，不阻塞本 ADR 通过。**状态**：待实施卡评估（CHG-SN-8-FUP-USERS-ROLE-INV-EP）。

**N1-139-2 — ✅ 已闭合（CHG-SN-8-FUP-USERS-BAN-INV / 2026-05-22）**：本 ADR 不涉及 `PATCH /admin/users/:id/ban` 的 session invalidate。封禁用户后同样存在 access token 15 分钟穿越窗口。建议未来独立 ADR（或扩展本 ADR scope）覆盖 ban/unban 场景，复用 `role_changed_at` 同模式（或新增 `banned_changed_at`，或统一为 `session_invalidated_at`）。**实施落地**：选方案 A（复用 role_changed_at 字段，零新 schema 列）；`banUser` SQL 加 `SET role_changed_at = NOW()` + RETURNING；ban handler 在 banUser 后写 Redis `user:rca:{id}` EX 900（与 PATCH role 同模式）；middleware/refresh 现有校验逻辑自动覆盖 ban 场景（封禁用户旧 access/refresh token 立即返 401 ROLE_CHANGED）；unban 不触发 invalidate（恢复权限场景；旧 token 在 ban 时已失效，用户必须重登）；audit 补齐 user.ban / user.unban actionType 属独立 follow-up CHG-SN-8-FUP-USERS-BAN-AUDIT。测试 +4 用例（banUser SQL / Redis 写入 / admin 不可 ban / 404 边界）；全 unit 4551 PASS（+4）。语义 trade-off：role_changed_at 字段复用语义略跳（ban 而非 role 变更触发 timestamp 更新），但代价最小（零新 schema 列 / 零新 middleware 逻辑）；与 ADR-139 N1-139-2 建议路径一致。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-USERS-ROLE-INV-EP**：按本 ADR 实施 migration + Service + Route + middleware + 前端 interceptor + 测试 surface #1-#12

---

## ADR-140 — admin 改用户邮箱 + 编辑用户资料端点协议（CHG-SN-8-FUP-USERS-EDIT-ADR）

**状态**：Accepted（arch-reviewer A− PASS / 2 非阻塞建议 N1-140-1 + N1-140-2 登记 follow-up）
**日期**：2026-05-21
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-users-edit-profile`（P2，reset-pwd 已闭合 1/3 / 本 ADR 推进剩余 2/3）
**关联任务**：CHG-SN-8-FUP-USERS-EDIT-ADR（本卡 / ADR 起草）/ CHG-SN-8-FUP-USERS-EDIT-EP（实施 follow-up）

---

### 1. 决策摘要

新增 2 个 admin 写端点：`PATCH /admin/users/:id/email`（改邮箱）+ `PATCH /admin/users/:id/profile`（改 displayName / locale / avatarUrl）。email 独立端点因唯一性约束 + 未来邮件验证扩展点语义；profile 端点合并 3 个低风险字段。admin 改邮箱采用直接生效方案（无验证邮件），因项目无邮件服务基础设施。users 表新增 `display_name` 列。`admin_audit_log` 扩展 `'user'` targetKind + 2 个新 actionType（`user.email_change` / `user.profile_update`）。admin 互改保护沿用现有 `role === 'admin'` 守卫（email/profile 允许 admin 编辑非 admin 用户，禁止编辑 admin 用户）。闭合 GAPS.md `#G-users-edit-profile` 剩余 2/3。

---

### 2. 背景

**问题**：后台 `/admin/users` 页面已实装 8 个端点（列表 / 详情 / 封禁 / 解封 / 改角色 / 删除 / 重置密码 / 统计），但**缺失 admin 改邮箱和编辑资料能力**。运营需走 DB 直改 email / displayName，GAPS.md `#G-users-edit-profile` 登记为 P2。

**Schema 现状实证**（`apps/api/src/db/migrations/001_init_tables.sql:8-20`）：

```sql
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL UNIQUE,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'admin')),
  locale        TEXT        NOT NULL DEFAULT 'en',
  avatar_url    TEXT,
  banned_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

关键事实：
- `email` 列有 `NOT NULL UNIQUE` 约束 — DB 层保证唯一性
- **`display_name` 列不存在** — `AdminShellUser.displayName`（`packages/admin-ui/src/shell/types.ts:71`）在 shell 客户端硬编码为 `'管理员'`（`apps/server-next/src/app/admin/admin-shell-client.tsx:59`）；`User` 类型（`packages/types/src/user.types.ts:16-25`）无 `displayName` 字段；DB 行映射（`apps/api/src/db/queries/users.ts:11-21`）无 `display_name`
- `locale` / `avatar_url` 已存在

**邮件服务基础设施实证**（grep `sendgrid` / `nodemailer` / `mailer` / `smtp`）：

- `docs/manual/20-pages/P-settings.md` 规划文档提及 SMTP KV 扩展（未实装）
- `InviteUserModal.tsx` 前端已存在但后端端点未实装

**结论**：项目当前**无邮件发送服务**。任何需要发邮件的方案在当前基础设施下不可实施。

**已有 admin 写端点守卫现状实证**（`apps/api/src/routes/admin/users.ts`）：4 个写端点（ban / role / delete / reset-password）**一致**检查目标用户是否为 admin，是则返回 403 `FORBIDDEN`，不区分调用者身份。

---

### 3. 决策

#### D-140-1 端点拆分策略

选择**方案 B（双端点）**：`PATCH /admin/users/:id/email` + `PATCH /admin/users/:id/profile`。

| 维度 | 方案 A: 单端点 `PATCH /admin/users/:id` | 方案 B: 双端点 email + profile | 方案 C: 多端点（email / displayName / locale / avatar 各自） |
|------|---|---|---|
| **API 表面** | 1 端点，body 含 optional 字段集 | 2 端点，语义明确 | 4+ 端点，细粒度但 API 膨胀 |
| **权限粒度** | 所有字段同权限；email 唯一性逻辑混入 profile 更新 | email 独立（唯一性 + 未来验证流程）；profile 字段同权限 | 最细粒度但过度设计 |
| **audit actionType** | 1 个 `user.update`，before/after jsonb 需区分哪些字段真正变更 | 2 个分离的 actionType，audit 语义清晰 | 4+ actionType 枚举膨胀 |
| **客户端复杂度** | 1 次调用可改多字段；需 partial body 判断 | 2 次调用分别处理；符合 UI 分区设计（email 单独表单 + profile 编辑区） | 多次调用，客户端需协调 |
| **测试粒度** | 1 个端点的测试包含多条件分支 | 每端点测试职责单一 | 测试文件过多 |
| **未来扩展** | email 验证流程引入时需在统一端点内分支处理 | email 端点可独立演进验证流程 + 不影响 profile | 扩展成本低但维护成本高 |
| **与现有端点对称** | 与 `PATCH .../role`、`PATCH .../ban` 风格不一致 | **与现有子端点风格一致**（ban / unban / role 均为 `PATCH /admin/users/:id/{action}`） | 与现有风格一致但过细 |

**选择理由**：email 涉及唯一性 + 潜在验证流程；双端点与现有 ban/unban/role 子端点完全对称；audit 语义分离（邮箱变更是高敏感操作）；方案 A 的 partial body 判断违反"单一职责"。

#### D-140-2 邮箱唯一性 + 验证邮件

选择**方案 A（直接生效 + audit log）**。

| 维度 | 方案 A: 直接生效 + audit | 方案 B: PENDING_EMAIL + 发验证链接 | 方案 C: 直接生效 + 通知旧邮箱 |
|------|---|---|---|
| **邮件服务依赖** | **无** | 必须 | 必须 |
| **当前可实施性** | **可实施** | **不可实施**（项目无邮件服务） | **不可实施**（同 B） |
| **Schema 影响** | 零新列 | 需 3 列（pending_email / token / expires） | 零新列 |
| **用户体验** | admin 改完即生效 | 验证链接确认后生效 | admin 改完即生效 + 旧邮箱通知 |
| **安全性** | 中（admin 权限守卫 + audit log） | 高（避免邮箱劫持） | 中（通知但无法阻止） |
| **audit 追溯** | 完整（before/after email） | 需追踪 pending 状态 | 完整 |

**选择理由**：方案 B/C 均需邮件发送能力（项目零实现）；admin 操作本身已有权限守卫 + audit；方案 B 未来升级路径在邮件服务上线后无需破坏端点签名（N1-140-1 登记）。

**唯一性保证**：DB UNIQUE 约束保底 + Service 层 `SELECT WHERE email = $newEmail AND id != $targetId AND deleted_at IS NULL` 提前 409；双保险捕获 PG 23505 错误码。

#### D-140-3 displayName 校验

**Schema 决策**：users 表新增 `display_name VARCHAR(50) DEFAULT NULL`。前端展示 fallback：`display_name ?? username`。`username` 列不变（仍为登录凭据）。

**校验规则**：

| 维度 | 规则 | 说明 |
|------|------|------|
| 长度 | 1-50 字符（zod `.min(1).max(50)`） | 空字符串不接受（传 `null` 清除）|
| 字符集 | `/^[\p{L}\p{N}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\s\-_.]+$/u` | 允许字母（多语言）/ 数字 / Emoji / 空格 / `-` / `_` / `.` |
| 唯一性 | **不唯一** | display_name 是展示名而非身份；username 承担唯一性 |
| 首尾空白 | 自动 trim | 防止视觉混淆 |
| 敏感词过滤 | **不在本 ADR 范围** | 项目无敏感词过滤服务；如需引入需独立 ADR |
| null 语义 | 传 `null` 清除 display_name → 前端 fallback 到 username | 传 `undefined` / 不传 = 不修改 |

**zod schema**：

```typescript
const ProfilePatchSchema = z.object({
  displayName: z.string().trim().min(1).max(50)
    .regex(/^[\p{L}\p{N}\p{Emoji_Presentation}\p{Emoji_Modifier_Base}\s\-_.]+$/u, 'displayName 含非法字符')
    .nullable()
    .optional(),
  locale: z.string().min(2).max(10)
    .regex(/^[a-z]{2}(-[A-Z]{2})?$/, '无效 locale 格式')
    .optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
}).refine(
  (v) => v.displayName !== undefined || v.locale !== undefined || v.avatarUrl !== undefined,
  { message: '至少需要提供一个字段' }
)
```

#### D-140-4 admin 自残保护

选择**沿用现有 `role === 'admin'` 守卫**：admin 不可编辑 admin 用户（含自己）的 email / profile。

**理由**：与 ban/role/delete/reset-password 4 个已有端点一致（违反一致性会破坏 API 表面）；admin 邮箱属高敏感（影响登录凭据恢复）；admin 自编辑应走 `/settings/profile`（独立 follow-up）；未来 super-admin 扩展路径不阻断。

**错误信息**：email 端点 `'不能修改 admin 账号的邮箱'` / profile 端点 `'不能修改 admin 账号的资料'`。

#### D-140-5 R-MID-1 audit 评估

**触发 R-MID-1 7 文件框架**（ADR-121）。

**新增 actionType（2 项）**：

| actionType | 端点 | beforeJsonb | afterJsonb |
|---|---|---|---|
| `user.email_change` | `PATCH /admin/users/:id/email` | `{ email: oldEmail }` | `{ email: newEmail }` |
| `user.profile_update` | `PATCH /admin/users/:id/profile` | `{ displayName, locale, avatarUrl }`（仅含实际变更）| 同 before 结构 |

**新增 targetKind（1 项）**：`'user'` — 与 ADR-139 D-139-6 识别的"`user` targetKind 缺失"对齐补齐。

**migration**：实施卡内补 migration `NNN_audit_log_extend_target_kind.sql`，ALTER admin_audit_log CHECK 约束追加 `'user'`；同时一次性补齐已在 TS 类型中扩展但未在 DB CHECK 中反映的 5 个 targetKind（home_module / source_line_alias / source_route / user_submission / image_health），避免长期漂移。

**R-MID-1 7 文件清单**：

| # | 文件 | 角色 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | (1) union 扩 2 actionType + 1 targetKind |
| 2 | `apps/api/src/services/AuditLogService.ts` | (2) ACTION_TYPES + TARGET_KINDS 扩 |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | (3a) EXPECTED 同步 |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | (3b) 镜像 + (4) REQUIRED / PAYLOAD it.each 扩 |
| 5 | `apps/api/src/routes/admin/users.ts` | 端点 `auditSvc.write({...})` 调用 |
| 6 | `tests/unit/api/admin-users-edit-audit.test.ts` | payload 内容断言 |
| 7 | `docs/changelog.md` | CHG-SN-8-FUP-USERS-EDIT-EP 完成备注 |

#### D-140-6 关联 ADR + Schema 影响

**关联 ADR**：

| ADR | 关系 | 说明 |
|-----|------|------|
| ADR-003 | 依赖 | JWT 双 Token；email 变更不影响 token（不含 email）|
| ADR-010 | 参考 | 三级角色 + admin 守卫 |
| ADR-109 | 依赖 | admin_audit_log schema（本 ADR 扩展 CHECK 约束）|
| ADR-110 | 对齐 | ApiErrorBody + 零新 ErrorCode（复用 CONFLICT / NOT_FOUND / FORBIDDEN / VALIDATION_ERROR）|
| ADR-118 | 参考 | 审计视图 API（新 actionType 自动反射到 `/admin/audit/enums`）|
| ADR-121 | 依赖 | R-MID-1 7 文件框架（本 ADR 触发）|
| ADR-136 | 参考 | 用户 KPI stats 端点（同域范式对齐）|
| ADR-139 | 参考 | D-139-6 识别 `user` targetKind 缺失；本 ADR 补齐 |

**Schema 影响**：① users 表新增 `display_name VARCHAR(50) DEFAULT NULL` ② admin_audit_log CHECK 约束扩展为 12 种 target_kind（含 `'user'` + 5 个历史漂移补齐）③ 无邮件验证相关新列（D-140-2 方案 A 直接生效）。

---

### 端点契约

| # | Method | Path | 权限 | Body | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|------|----------------|---------------|-----|
| 1 | PATCH | `/admin/users/:id/email` | admin | `{ email: string }` | `{ id, email, previousEmail }` | 无（复用 CONFLICT 409 / NOT_FOUND 404 / FORBIDDEN 403 / VALIDATION_ERROR 422）| ADR-140 |
| 2 | PATCH | `/admin/users/:id/profile` | admin | `{ displayName?: string \| null, locale?: string, avatarUrl?: string \| null }` | `{ id, displayName, locale, avatarUrl }` | 无（复用 VALIDATION_ERROR 422 / NOT_FOUND 404 / FORBIDDEN 403）| ADR-140 |

---

### 5. SQL / Schema 设计

**Migration A（`NNN_users_add_display_name.sql`）**：

```sql
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(50) DEFAULT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN users.display_name
  IS '用户展示名（可选）；NULL 时前端降级到 username；admin 可编辑（ADR-140）';

COMMIT;
```

**回滚**：`ALTER TABLE users DROP COLUMN IF EXISTS display_name;`

**Migration B（`NNN_audit_log_extend_target_kind.sql`）**：

```sql
BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind
  IS 'CHECK 约束限定 12 种（ADR-140 扩展 user + 历史漂移补齐 6→12）';

COMMIT;
```

**DB queries**（`apps/api/src/db/queries/users.ts`）：

```sql
-- updateUserEmail
UPDATE users SET email = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id, email

-- updateUserProfile（COALESCE 模式 — 未传字段保持原值；null 显式清除需 Service 层区分 undefined/null）
UPDATE users
SET display_name = COALESCE($1, display_name),
    locale = COALESCE($2, locale),
    avatar_url = COALESCE($3, avatar_url)
WHERE id = $4 AND deleted_at IS NULL
RETURNING id, display_name, locale, avatar_url
```

---

### 6. Response 结构 / 错误码

**email 成功响应**：

```json
{ "data": { "id": "uuid", "email": "new@example.com", "previousEmail": "old@example.com" } }
```

`previousEmail` 字段便于前端展示确认 + 与 audit log `beforeJsonb.email` 对应。

**profile 成功响应**：

```json
{ "data": { "id": "uuid", "displayName": "新显示名", "locale": "zh-CN", "avatarUrl": "https://..." } }
```

**错误码**（全部复用 ADR-110 ERRORS 字典，零新增）：

| CODE | HTTP | 触发条件 | 端点 |
|------|------|----------|------|
| `NOT_FOUND` | 404 | 目标用户不存在 | 两端点 |
| `FORBIDDEN` | 403 | 目标 role === 'admin' | 两端点 |
| `VALIDATION_ERROR` | 422 | zod 校验失败 | 两端点 |
| `CONFLICT` | 409 | 新邮箱已被其他用户注册 | email 端点 |

---

### 7. 关联 ADR

详见 D-140-6。

---

### 8. R-MID-1 文件清单

**适用**。详见 D-140-5 7 文件清单。

---

### 9. 测试 surface

22 用例（11 email + 9 profile + 2 audit + 通用权限 / race condition），见 D-140-5 + 子代理评审产出表（具体 it() 描述实施卡内落地，文件路径 `tests/unit/api/admin-users-edit.test.ts` + `tests/unit/api/admin-users-edit-audit.test.ts`）。

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-140-1 | admin 改邮箱直接生效，无用户确认 | 中 | audit log 完整 before/after；前端 toast 提示；N1-140-1 升级路径 |
| R-140-2 | email 唯一性 race condition | 低 | DB UNIQUE 保底 + PG 23505 → 409 |
| R-140-3 | display_name 新列对现有查询的影响 | 低 | nullable DEFAULT NULL；`listAdminUsers` 显式列需同步加 |
| R-140-4 | admin_audit_log CHECK 修改影响现有 audit 写入 | 低 | ALTER 仅扩展（不删除）；事务内执行 |

**回退路径**：① 代码 revert 2 端点 ② Schema 保留 nullable 列（旧代码不受影响）③ CHECK 约束扩展向后兼容无需回退。

---

### 11. 非阻塞建议 / N1

**N1-140-1（邮件通知升级路径）**：邮件服务上线后（SMTP KV / `#G-settings-webhook-impl` 闭合），email 端点可升级方案 C（通知旧邮箱）或方案 B（PENDING_EMAIL + 用户确认）。端点签名不变（Body 保持 `{ email }`），响应 data 增加 `pendingEmail` 可选字段。**状态**：待邮件服务上线触发。

**N1-140-2（email 变更后 session invalidate）**：当前 email 变更不触发 session invalidate（access token 不含 email）。如安全评审需"改邮箱后强制重登"，可复用 ADR-139 `role_changed_at` 模式新增 `email_changed_at`。**状态**：待安全评审触发。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-USERS-EDIT-EP**：按本 ADR 实施 2 migration + 2 route handler + DB queries + R-MID-1 7 文件 + 测试 surface #1-#22 + 前端消费（columns actions 列加「改邮箱」/「编辑资料」按钮 + 对应 Modal）

---

## ADR-138 — admin_audit_log 通用回滚端点协议（CHG-SN-8-FUP-AUDIT-ROLLBACK-EP）

**状态**：Accepted（arch-reviewer A− PASS / 2 非阻塞建议 N1-138-1 + N1-138-2 登记 follow-up）
**日期**：2026-05-22
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-audit-rollback-universal`（P3 体验优化，消费层跳转已闭合；本 ADR 推进通用后端回滚）
**关联任务**：CHG-SN-8-FUP-AUDIT-ROLLBACK-ADR（本卡 / ADR 起草）/ CHG-SN-8-FUP-AUDIT-ROLLBACK-EP（实施 follow-up）

---

### 1. 决策摘要

新增 admin 写端点 `POST /admin/audit/logs/:id/rollback`，采用**方案 D（混合策略）**：简单 UPDATE 类 actionType 走 JSONB diff 反向自动回滚（`before_jsonb` 字段白名单约束 UPDATE），复杂业务操作（staging.publish / video.merge / video.split 等多表/状态机操作）走注册的 `reverse_handler` 扩展点，不可回滚的单向操作（采集/重扫/导入/缓存清除等 24 类）返回 422 `AUDIT_ROLLBACK_UNSUPPORTED`。回滚操作本身写入新 actionType `system.audit_rollback` 到 audit_log（形成 audit-of-audit 追溯链）。字段白名单机制防止 `password_hash` / `role` 等敏感字段被 audit log 回滚注入。权限限定 admin only + 高敏感 actionType 需前端二次确认（后端不强制）。

---

### 2. 背景

**问题**：CHG-SN-8-GAPS-AUDIT-ROLLBACK（commit 14e6b9b7）已通过消费层补齐闭合 `#G-audit-rollback-universal`，在 `/admin/audit` 页面每行加「回滚」按钮：8 类 actionType 跳转到对应业务页的已有反向操作入口，22 类单向操作 disabled 显示 tooltip。但用户期望的体验是：点击「回滚」后直接在 audit 页面完成反向操作，无需跳转到另一个页面再手动执行。

**rollback-routes.ts 消费层现状实证**（`apps/server-next/src/lib/audit/rollback-routes.ts`）：`resolveRollbackTarget` switch 映射 40 个显式 actionType + 4 个 targetKind fallback；可跳转 18（8 组）/ disabled 22 / fallback 4。

**核心设计挑战**：
1. audit_log 的 `before_jsonb` / `after_jsonb` 只存涉及字段子集（ADR-109 注释），反向写回需确保字段子集是安全且充分的
2. 部分 actionType 涉及多表写入、状态机约束、外部副作用，不能简单 UPDATE 回滚
3. audit_log 可能记录了已不存在的 schema 字段（DB migration 后 before_jsonb 含已删除列）
4. 敏感字段（password_hash / role）若被 audit log 记录，自动回滚可能成为权限提升攻击向量

---

### 3. 决策

#### D-138-1 回滚算法策略

选择**方案 D（混合策略）**：JSONB diff 反向 UPDATE 通用路径 + reverse_handler 注册扩展点 + UNSUPPORTED Set 24 项。

| 维度 | 方案 A: reverse_action 静态映射 | 方案 B: JSONB diff 反向 UPDATE | 方案 C: 仅删除式回滚 | 方案 D: 混合 |
|------|---|---|---|---|
| **覆盖范围** | 高（理论全 44 actionType） | 中高（UPDATE 类） | 极低（~5 actionType） | **高（B 自动 + handler 复杂）** |
| **实施复杂度** | 极高（44 个独立反向端点） | 中（通用逻辑 + 映射 + 白名单） | 低 | **中高（首期 ~0.5w）** |
| **R-MID-1 audit** | 各独立 | 统一 `system.audit_rollback` | N/A | **自动写 + handler 可自定义** |
| **失败处置** | 独立处理 | 通用层 | 简单 | **通用层兜底 + handler 覆盖** |
| **跨表 schema 漂移容忍** | 高 | 低 | N/A | **中（白名单 + 422 降级）** |
| **安全性** | 高 | 中（需白名单） | 高 | **高（白名单 + 显式声明 + 二次确认）** |
| **向后兼容** | 手动维护 | 自动覆盖 | N/A | **新 UPDATE 自动 + 新复杂需注册** |
| **渐进交付** | 必须一次实现 | 一次实现 | 一次但价值低 | **首期通用 + 后续按需注册** |

**架构分层**：

```
POST /admin/audit/logs/:id/rollback
  → Route 层：鉴权 + 参数解析 + 调 Service
  → AuditRollbackService.rollback(auditLogId, actorContext)
    → 1. 读取 audit_log 行
    → 2. 查 ROLLBACK_REGISTRY[actionType]
       → 若有注册 handler → 调 handler(auditLog, db, actorContext)
       → 若无 handler → 查 UNSUPPORTED_SET[actionType]
          → 若在不可回滚集 → 422 AUDIT_ROLLBACK_UNSUPPORTED
          → 若不在 → 走通用 JSONB 反向 UPDATE 路径
    → 3. 通用路径：target_kind → table_name 映射 → before_jsonb ∩ 白名单 → UPDATE
       → 写 system.audit_rollback audit_log（事务内 INSERT）
    → 4. 返回 { rolledBack: true, rollbackAuditLogId, warnings? }
```

#### D-138-2 权限范围

**admin only**。与现有 3 个 audit 端点（`apps/api/src/routes/admin/audit.ts:21` adminOnly）一致。

**高敏感 actionType 前端二次确认清单**：`user.role_change` / `user.email_change` / `system.settings_update` / `system.config_update` / `home_module.delete` / `crawler_site.delete` — 前端 confirm dialog 守门（同 video.merge / staging.publish 范式），后端不强制 `X-Confirm` header。

#### D-138-3 R-MID-1 rollback action audit

**触发 R-MID-1 7 文件框架**（ADR-121）。

**新增 actionType（1 项）**：`system.audit_rollback` — targetKind = `'system'`（复用，不扩展 CHECK 约束）/ targetId = NULL（rollback 目标是 audit_log 行，sourceAuditLogId 存入 before/after jsonb）/ before/after_jsonb 含 sourceAuditLogId / sourceActionType / sourceTargetKind / sourceTargetId / rolledBackFields / restoredFields。

**R-MID-1 7 文件清单**：
1. `packages/types/src/admin-moderation.types.ts` — union 扩
2. `apps/api/src/services/AuditLogService.ts` — ACTION_TYPES 扩
3. `tests/unit/api/audit-log-service-enums-set-equal.test.ts` — EXPECTED 同步
4. `tests/unit/api/audit-log-coverage.test.ts` — REQUIRED + PAYLOAD 扩
5. `apps/api/src/routes/admin/audit.ts` — 端点 handler
6. `tests/unit/api/audit-rollback.test.ts` — payload 内容断言
7. `docs/changelog.md` — 完成备注

#### D-138-4 失败处置 + 边界

**8 种失败场景处理**：

| # | 场景 | HTTP | ErrorCode | 策略 |
|---|---|---|---|---|
| F-1 | 不可回滚 actionType（22+ 类单向操作） | 422 | `AUDIT_ROLLBACK_UNSUPPORTED` | UNSUPPORTED_ACTION_TYPES Set 查询 |
| F-2 | 已被后续操作覆盖（状态机冲突） | 409 | `AUDIT_ROLLBACK_STALE` | UPDATE 前 SELECT 当前行，比对 after_jsonb；不一致则拒绝（不强制覆盖） |
| F-3 | 跨表 schema 漂移（字段被 migration 删除） | 422 | `AUDIT_ROLLBACK_SCHEMA_DRIFT` | before_jsonb ∩ 白名单为空 → 拒绝；部分过滤 → warnings |
| F-4 | 二次回滚（system.audit_rollback 被 rollback） | 422 | `AUDIT_ROLLBACK_UNSUPPORTED` | 加入 UNSUPPORTED Set，避免无限链 |
| F-5 | audit_log 行不存在 | 404 | `NOT_FOUND` | 复用 getAdminAuditLogById |
| F-6 | target_id NULL（batch action） | 422 | `AUDIT_ROLLBACK_UNSUPPORTED` | batch 操作不在通用路径范围 |
| F-7 | before_jsonb NULL（CREATE 类） | 422 | `AUDIT_ROLLBACK_UNSUPPORTED` | CREATE 反向 = DELETE，需 handler 而非通用 |
| F-8 | 目标业务行不存在 / soft deleted | 404 | `NOT_FOUND` | WHERE id = $1 AND deleted_at IS NULL 返 0 行 |

#### D-138-5 跨表 schema 约束

**target_kind → table_name 映射**（11 项；source_route / system / image_health 无对应单一表 → 需 handler 或入 UNSUPPORTED）。

**字段白名单设计**：每个 target_kind+table 维护显式白名单 Set（编译时常量），UPDATE 时 before_jsonb 字段 ∩ 白名单 = SET 列表。**3 个示例**：

- **video.staff_note** (video / videos)：`{ staff_note, review_status, is_published, is_visible, meta_score, title }`（排除 deleted_at / created_at / catalog_id）
- **user.email_change** (user / users)：`{ email, display_name, locale, avatar_url }`（排除 password_hash / role / role_changed_at / banned_at / deleted_at）
- **home_module.update** (home_module / home_modules)：`{ title, subtitle, type, config, is_published, sort_order, brand_slug }`

**唯一性约束处理**：email 回滚捕获 PG 23505 → 422 `AUDIT_ROLLBACK_STALE`。

**schema 变更后白名单未同步**：
1. 新增列未加白名单 → 部分回滚 + warnings
2. 删除列仍在白名单 → information_schema 防御性查询（缓存 60s）+ 422 SCHEMA_DRIFT
3. 实施卡 R-MID-1 框架自然要求新增列同步白名单（CLAUDE.md schema 同步约束延伸）

#### D-138-6 关联 ADR + 性能 + ErrorCode

**关联 ADR**：ADR-109 (audit schema) / ADR-110 (ErrorCode) / ADR-118 (audit 视图) / ADR-121 (R-MID-1) / ADR-139 (user.role_change 范式) / ADR-140 (user.email_change 范式 + audit CHECK 扩展)

**性能**：
- **事务**：单 PG 事务 BEGIN → SELECT audit_log → SELECT 当前行 → UPDATE 业务表 → INSERT audit_log → COMMIT
- **同步 audit 写入**：回滚的 audit 写入不走 fire-and-forget（事务内 INSERT 保证原子性，与 ADR-139 R-139-4 同模式但反向）
- **p95 目标**：< 200ms（单行 SELECT + UPDATE + INSERT，主键索引）
- **information_schema 缓存**：白名单字段验证缓存 60s

**新增 ErrorCode（3 码）**：

| CODE | HTTP | 触发 |
|------|------|------|
| `AUDIT_ROLLBACK_UNSUPPORTED` | 422 | actionType 不可回滚 / target_id NULL / before_jsonb NULL / 二次回滚 |
| `AUDIT_ROLLBACK_STALE` | 409 | after_jsonb 与当前 DB 值不一致 / UNIQUE 违反 |
| `AUDIT_ROLLBACK_SCHEMA_DRIFT` | 422 | before_jsonb ∩ 白名单 = ∅ / 字段在当前 schema 不存在 |

---

### 端点契约

| # | Method | Path | 权限 | Body | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|------|----------------|---------------|-----|
| 1 | POST | `/admin/audit/logs/:id/rollback` | admin | `{}` (空 body) | `{ rolledBack: true, rollbackAuditLogId: string, warnings?: string[] }` | `AUDIT_ROLLBACK_UNSUPPORTED` (422) / `AUDIT_ROLLBACK_STALE` (409) / `AUDIT_ROLLBACK_SCHEMA_DRIFT` (422) | ADR-138 |

**Path param**：`:id` 为 admin_audit_log.id（bigserial 数字字符串）；空 body 设计：回滚信息全部从 audit_log 行取，无需客户端传递（降低 API 表面 + 防篡改）；未来扩展口 `{ force?: boolean }`（N1-138-2）。

---

### 5. SQL / Schema 设计

**无新 migration**：admin_audit_log 表无需新增列；`system.audit_rollback` 复用 `system` targetKind 不扩展 CHECK；业务表无变更。

**新增 DB Query 函数**（`apps/api/src/db/queries/auditLog.ts`）：
- `rollbackAuditLogTarget(client, tableName, primaryKeyColumn, targetId, fieldsToRestore, softDeleteColumn?)` — 通用反向 UPDATE
- `selectCurrentRowForRollback(client, tableName, primaryKeyColumn, targetId, fieldNames, softDeleteColumn?)` — stale 检测

**SQL 注入防护**：table_name / column_name 全部从编译时常量白名单取（不接受用户输入），手动 PG 标识符转义。

---

### 6. Response 结构 / 错误码

**成功响应**（200）：

```json
{
  "data": {
    "rolledBack": true,
    "rollbackAuditLogId": "12345",
    "warnings": ["字段 'year' 不在当前白名单中，已跳过"]
  }
}
```

`warnings` 仅在部分字段被白名单过滤但不影响回滚成功时返回。

**错误响应**：复用 ADR-110 `ApiErrorBody` 信封 + 3 新 ErrorCode + 现有 NOT_FOUND/FORBIDDEN/VALIDATION_ERROR/INTERNAL_ERROR。

---

### 7. 关联 ADR

详见 D-138-6 关联 ADR 表。

---

### 8. R-MID-1 文件清单

**适用**。详见 D-138-3 7 文件清单。

**实施卡 CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 完整文件范围**（10 文件 = 7 R-MID-1 + 3 扩展）：

| # | 文件 | 角色 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | union 扩 `system.audit_rollback` |
| 2 | `packages/types/src/api-errors.ts` | ERRORS 字典扩 3 码 |
| 3 | `apps/api/src/services/AuditLogService.ts` | ACTION_TYPES 扩 |
| 4 | `apps/api/src/services/AuditRollbackService.ts` | 新 Service：回滚算法核心 + 白名单 + handler 注册 |
| 5 | `apps/api/src/db/queries/auditLog.ts` | 新 query 函数 |
| 6 | `apps/api/src/routes/admin/audit.ts` | 端点 handler |
| 7 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | EXPECTED 同步 |
| 8 | `tests/unit/api/audit-log-coverage.test.ts` | REQUIRED + PAYLOAD 扩 |
| 9 | `tests/unit/api/audit-rollback.test.ts` | 端点 + 回滚逻辑单测 |
| 10 | `docs/changelog.md` | 完成备注 |

注：超出 R-MID-1 最小 7 文件，但属功能必需不可拆。建议实施卡可考虑拆 2 子卡：A（Service + Query + 端点 + 测试）/ B（R-MID-1 4 真源 + coverage）。

---

### 9. 测试 surface

19 用例（happy path 3 + 不可回滚 4 + stale 2 + schema drift 2 + 边界 4 + audit 写入 2 + 权限 2）— 完整列表见 ADR §9 测试 surface 表（CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 实施卡内落地，文件 `tests/unit/api/audit-rollback.test.ts`）。

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-138-1 | 白名单维护负担 | 中 | R-MID-1 框架同步要求 + CLAUDE.md schema 同步约束延伸 |
| R-138-2 | 通用 JSONB 回滚绕过业务校验 | 高 | stale 检测 + 白名单不含状态机字段 + handler 注册路径 |
| R-138-3 | 动态 SQL 构建潜在注入 | 高 | table_name / column_name 编译时常量白名单 + PG 标识符转义 |
| R-138-4 | 高频回滚造成业务数据振荡 | 低 | admin only + 前端 confirm + 不可二次回滚 |
| R-138-5 | before/after jsonb 只存子集 → 部分字段恢复 | 中 | 设计内行为（ADR-109）+ 文档说明 + 前端 confirm 文案 |

**回退路径**：1. 代码 revert POST handler + AuditRollbackService + query 扩展 2. ErrorCode 保留无副作用 3. actionType 保留历史可查 4. 消费层 rollback-routes.ts 不受影响

---

### 11. 非阻塞建议 / N1

**N1-138-1（handler 注册优先级）— ✅ P1 已闭合（CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS / 2026-05-22）**：首期实施仅覆盖通用 JSONB 反向 UPDATE 路径（~12 个简单 UPDATE 类 actionType）。以下复杂 actionType 建议按 P1/P2/P3 渐进注册 reverse_handler：
- **P1 ✅ 已闭合**：video.approve / video.reject_labeled（review_status 状态机）— 注册 handler 不调 ModerationService.reopen / transitionVideoState（避免 transitionVideoState 内部 BEGIN/COMMIT 与 AuditRollback 事务嵌套）；直接用同事务 client 写 UPDATE SQL（review_status = 'pending_review'，reject 额外清 review_label_id）；audit 仅走 system.audit_rollback 单条（不双写 video.reopen 避免追溯链膨胀）；UNSUPPORTED_ACTION_TYPES Set 同步移除 2 项；顺手修 home_module softDeleteColumn 'deleted_at' → null（schema 实证 hard delete）；测试 +2 用例 PASS。
- **P2 推迟**：home_module.create / home_module.delete — 实证 home_modules 表无 deleted_at 列（hard delete schema），CREATE 反向需 DELETE / DELETE 反向需 INSERT 完整快照恢复；after_jsonb 只存涉及字段子集而非完整快照，反向 INSERT 信息不足；若需求高可考虑加 deleted_at 列做 soft delete 改造（独立卡）。
- **P3 仍待**：staging.publish（多表 + 状态机，需独立 ADR 评估）。

**状态**：P1 ✅；P2/P3 按需启动（CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS-P2/P3）。

**N1-138-2（force 参数）— ✅ 已闭合（CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE / 2026-05-22）**：当前 stale 检测发现不一致返 409，admin 无法强制覆盖。如运营反馈频繁需求，可扩展 `{ force?: boolean }` 跳过 stale 校验。该扩展不破坏空 body 契约。**实施落地**：端点 Body schema 加 `{ force?: boolean }` optional（向后兼容 — 空 body 仍合法）；`AuditRollbackService.rollback(auditLogId, actor, options?: { force?: boolean })`；`rollbackGeneric(client, auditLog, force)` 在 force=true 时跳过 selectCurrentRowForRollback stale 检测；其它守卫保持（UNSUPPORTED / 白名单 / SCHEMA_DRIFT）；audit log payload 写入 force flag 供追溯审计；测试 +2 用例（#20 force 跳 stale + audit flag / #21 force 不绕 UNSUPPORTED）；audit-rollback.test 21/21 PASS。

---

**不可回滚 actionType 完整列表**（首期 UNSUPPORTED_ACTION_TYPES Set，24 项）：

| 类别 | actionType |
|---|---|
| 系统单向 | `system.cache_clear` / `system.sources_import` / `system.audit_rollback`（二次回滚） |
| 采集状态 | `crawler.freeze` / `crawler.run_create` / `crawler.auto_config` / `crawler.stop_all` / `crawler.reindex` / `crawler_run.cancel/pause/resume` |
| batch 操作 | `crawler_site.batch` / `staging.batch_publish` / `video_source.disable_dead_batch` |
| 异步触发 | `video.refetch_sources` / `image_health.rescan` / `image_health.switch_domain` |
| 复杂多表 | `sources.route_action` / `source_line_alias.upsert` / `video.merge` / `video.unmerge` / `video.split` / `staging.publish` / `crawler_site.category_mapping_update` |

**首期可自动回滚的 actionType**（~12 项纯字段 UPDATE 类）：`video.staff_note` / `video.visibility_patch` / `video.approve` / `video.reject_labeled` / `video.reopen` / `video_source.toggle` / `staging.revert` / `home_module.update` / `home_module.publish_toggle` / `home_module.reorder` / `crawler_site.update` / `user.email_change` / `user.profile_update` / `user_submission.action` —— 注：实施卡需澄清，`user.role_change`（需 session invalidate 联动）/ `home_module.create/delete`（CREATE/DELETE 反向语义）/ `system.settings_update/config_update`（嵌套 JSON）等如未注册 handler，首期需入 UNSUPPORTED Set（N1-138-1）。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-AUDIT-ROLLBACK-EP**：按本 ADR 实施 10 文件清单 + 19 测试 surface
- **CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS**：渐进注册 reverse_handler（P1/P2/P3）
- **CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE**：`{ force?: boolean }` 强制覆盖参数（待运营反馈）
- **消费层升级**：`rollback-routes.ts` 可回滚 actionType 从"跳转模式"切换为"直接调 POST 端点"

---

## ADR-141 — dashboard activities 真端点协议设计（GET /admin/dashboard/activities / CHG-SN-8-FUP-DASH-ACTIVITY-LIVE）

**状态**：Accepted（arch-reviewer A PASS / 2 非阻塞建议）
**日期**：2026-05-22
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-dashboard-activities-mock`（CHG-SN-8-FUP-DASH-ACTIVITY-LIVE follow-up）
**关联任务**：CHG-SN-8-FUP-DASH-ACTIVITY-ADR（本卡）/ CHG-SN-8-FUP-DASH-ACTIVITY-LIVE（实施 follow-up）

---

### 1. 决策摘要

新增只读端点 `GET /admin/dashboard/activities`，从 `admin_audit_log` 表派生最近 N 条 admin 操作活动时序，替换 dashboard RecentActivityCard 当前全 mock 数据。采用方案 C（audit_log 直接派生 + 内存 TTL 缓存 60s），新增 1 个 `(created_at DESC)` 单列索引保证 p95 < 200ms（实际预估 < 10ms），actionType 中文 label 映射由前端 i18n 文件承担（返回 actionType 原值）。端点路径挂入现有 `/admin/dashboard/*` 路由组，admin only 权限与 ADR-127 三兄弟一致。零新 ErrorCode（复用 ADR-110 字典）。R-MID-1 GET 只读不适用（降级 5 文件清单）。闭合 `#G-dashboard-activities-mock`，消除 dashboard 首页最后一个 mock 警示 chip。

---

### 2. 背景

- **当前实现**：`apps/server-next/src/lib/dashboard-data.ts` 的 `MOCK_ACTIVITIES` 常量（6 条硬编码条目）被两条 return 路径共同引用；`activitiesDataSource` 始终为 `'mock'`
- **视觉警示**：CHG-SN-8-GAPS-DASH-ACTIVITY（commit b4fdabfe）追加"示例数据"chip + tooltip 指向 follow-up
- **数据源就绪**：`admin_audit_log` 表已覆盖 37 种 actionType（M-SN-4 起全部 admin 写端点 fire-and-forget audit）；自 2026-05-01 起持续积累
- **既有审计端点**：ADR-118 `/admin/audit/logs`（多维 filter + 分页 + payloadSummary）是完整审计视图；dashboard activities 为其轻量投影
- **dashboard 路由组**：ADR-127 已建立 `/admin/dashboard/{overview,spark,analytics}` 三端点；本端点为第四

---

### 3. 决策

#### D-141-1 数据源选型

选择**方案 C（admin_audit_log 直接派生 + Service 层内存 TTL 缓存）**。

| 维度 | 方案 A: 直接查询 | 方案 B: 独立 activities 表 | 方案 C: 缓存 |
|------|---|---|---|
| **实施复杂度** | 低（1 query + Service + Route） | 高（migration + 物化 + cron） | 低+（A + ~15 行缓存） |
| **查询性能** | 中（每请求 SQL，p95 < 50ms） | 高（预计算 O(1)） | 高（命中 0ms / miss 同 A） |
| **schema 耦合** | 零新表 | 高（与 audit_log 演化耦合） | 零新表 |
| **数据新鲜度** | 实时 | 延迟 1-5 min | 近实时（60s TTL） |
| **维护负担** | 极低 | 高（cron + 清理 + 双写） | 低（无状态） |
| **与 ADR-118 关系** | 独立 query | 脱离 audit_log query 层 | 独立 query |

**选择理由**：dashboard activities 低频读 / audit_log 写频率不高（日均 ~100-500 行）；方案 C 在 A 基础上追加极轻量 Map 级 TTL 缓存，零新表零 cron 保持运维简洁；方案 B 在当前数据量级完全过度设计。

#### D-141-2 返回字段集 + JOIN 策略

**必含字段**：`id` (bigserial 转 string) / `actorId` / `actorUsername` (LEFT JOIN users，actor 删除兜底 null) / `actionType` / `targetKind` / `targetId` / `createdAt` (ISO 8601)

**不含字段**（与 ADR-118 listAdminAuditLog 差异）：beforeJsonb / afterJsonb / payloadSummary / requestId / ipHash / targetDisplayName（N1-141-1 follow-up）

**actionType 中文 label 映射**：选择**方案 B（前端 i18n 文件映射）**。

| 维度 | 方案 A: 后端 Record | 方案 B: 前端 i18n |
|------|---|---|
| 维护负担 | 37 项 Record 需与 union 手工同步 | 前端 i18n 新增 1 key |
| 国际化准备 | 硬编码中文 | 天然 i18n 就绪 |
| 已有先例 | 无 | 已有 `M.history.action`（11 项，dashboard 需扩展到 37 项） |

**选择理由**：与项目既有 i18n 架构一致；关注点分离（后端不承担 UI label 翻译）；37 项 label 在后端属高频变动源（新增 actionType 多一处忘改风险）。实施卡需扩展现有 `moderation.ts` 的 11 项 action 映射到 37 项全集（或抽为独立 i18n 文件 `audit-action-labels.ts`），供 RecentActivityCard 和 AuditClient 共用。

#### D-141-3 分页 / limit 策略

选择**方案 A（单 limit 参数，无 offset / cursor）**。

| 维度 | A: 单 limit | B: cursor | C: offset |
|------|---|---|---|
| dashboard 场景适配 | 精确匹配 | 过度设计 | 过度设计 |
| 实现复杂度 | 极低 | 中 | 低 |
| 响应体 | 无元数据 | 含 nextCursor | 含 total/page |
| 可扩展性 | "查看全部"深链 `/admin/audit` | 增量加载 | 任意页 |

**参数**：`limit?: z.coerce.number().int().min(1).max(50).default(10)`。"查看更多"按钮跳转 `/admin/audit`（ADR-118 完整视图）而非端点翻页。响应信封 `{ data: DashboardActivityRow[] }`，无 total / page / limit 元数据。

#### D-141-4 权限范围

选择 **admin only**。与 ADR-127 dashboard 3 兄弟权限一致；与 Next.js middleware `canAccessAdmin` + 后端 `requireRole(['admin'])` 双守门一致；moderator 自身活动查看属 `#G-audit-self-scope` 独立 GAP 范畴；一致性最简（不引入 self-scope 过滤逻辑）。

#### D-141-5 性能优化

**现有索引分析**（不能服务 `ORDER BY created_at DESC LIMIT N`）：

| 索引 | 定义 | 能否服务？ |
|------|------|---|
| `idx_admin_audit_log_actor_created` | `(actor_id, created_at DESC)` | 否 — 前导列 actor_id 不固定 |
| `idx_admin_audit_log_target` | `(target_kind, target_id, created_at DESC)` | 否 — 同理 |
| `idx_admin_audit_log_action_created` | `(action_type, created_at DESC)` | 否 — 用 ANY 全集强制扫仍需全表 sort |
| `idx_admin_audit_log_request_id` | `(request_id) WHERE request_id IS NOT NULL` | 无关 |

**结论：需新增 migration** `CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log (created_at DESC)`。

**代价评估**：
- 写入开销：每行 INSERT 多 1 个 btree 索引项（audit_log 日写 ~100-500 行，可忽略）
- 存储开销：单列 TIMESTAMPTZ ~24 bytes/行，10 万行 ~2.4MB（可忽略）
- 查询收益：`ORDER BY created_at DESC LIMIT N` 直接 Index Scan (Backward)，扫描恰 N 行后停止；JOIN users 通过 PK Nested Loop（N <= 50 次 lookup）；p95 预估 < 10ms

**缓存层**：Service 层 `Map<number, { data, expiry }>`（key = limit 值），TTL = 60s。无需 Redis（单进程内存足够；多进程独立缓存 miss 率略高但 DB < 10ms 不构成问题）。缓存失效靠 TTL 自然过期，不需要写入时主动 invalidate（60s 延迟可接受）。

**p95 目标**：< 200ms（实际预估 < 10ms SQL + < 1ms 缓存查找）。

#### D-141-6 关联 ADR + ErrorCode

**关联 ADR**：ADR-109（audit log schema 真源）/ ADR-118（完整审计视图；本端点为其 dashboard 投影）/ ADR-127（dashboard 路由组并列设计）/ ADR-110（ApiResponse + ErrorCode 真源）/ ADR-136（同类 dashboard KPI 端点参照）/ ADR-121（R-MID-1 评估基线）

**ErrorCode**：零新增。复用 `VALIDATION_ERROR` 422（limit 超范围）/ `INTERNAL_ERROR` 500（DB 兜底）。

ADR-118 enums 端点**不融合**：enums 返回全量 actionTypes + targetKinds 供审计视图筛选器，与 dashboard activities 消费场景无关。

---

### 端点契约

| # | Method | Path | 权限 | Query Params | Response `data` 字段 | ADR |
|---|--------|------|------|-------------|---------------------|-----|
| 1 | GET | `/admin/dashboard/activities` | admin | `limit?: 1-50 (default 10)` | `DashboardActivityRow[]` | ADR-141 |

---

### 5. SQL / Schema 设计

**Migration**（实施卡填实际编号 `NNN_admin_audit_log_created_index.sql`）：

```sql
BEGIN;

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log (created_at DESC);

COMMENT ON INDEX idx_admin_audit_log_created
  IS 'dashboard activities 端点 ORDER BY created_at DESC LIMIT N 专用（ADR-141 D-141-5）';

COMMIT;
```

**回滚 SQL**：`DROP INDEX IF EXISTS idx_admin_audit_log_created`

**Query**（新增 `listDashboardActivities`）：

```sql
SELECT al.id::text AS id,
       al.actor_id AS "actorId",
       u.username AS "actorUsername",
       al.action_type AS "actionType",
       al.target_kind AS "targetKind",
       al.target_id AS "targetId",
       al.created_at AS "createdAt"
FROM admin_audit_log al
LEFT JOIN users u ON u.id = al.actor_id
ORDER BY al.created_at DESC, al.id DESC
LIMIT $1
```

索引利用：`idx_admin_audit_log_created` Index Scan (Backward) → 扫恰 $1 行；LEFT JOIN users 通过 PK Nested Loop。

与 `listAdminAuditLog` / `listAuditLogByTarget` 关系：**新增独立函数**（ADR-118 D-118-5 原则 — 参数结构和 SELECT 字段完全不同不强合并）。row 类型可新建轻量 `DashboardActivityQueryRow` 或复用 `AdminAuditLogQueryRow` 后 Service 层裁剪。

---

### 6. Response 结构 / 错误码

**响应类型**（`packages/types/src/dashboard.ts` 追加）：

```typescript
export interface DashboardActivityRow {
  readonly id: string                          // bigserial → string
  readonly actorId: string
  readonly actorUsername: string | null         // LEFT JOIN users
  readonly actionType: AdminAuditActionType    // 前端 i18n 映射中文 label
  readonly targetKind: AdminAuditTargetKind
  readonly targetId: string | null              // batch action 时 null
  readonly createdAt: string                   // ISO 8601
}
```

**响应信封**（对齐 ADR-110）：

```json
{
  "data": [
    {
      "id": "1042",
      "actorId": "a1b2c3d4-...",
      "actorUsername": "Yan",
      "actionType": "video.approve",
      "targetKind": "video",
      "targetId": "e5f6g7h8-...",
      "createdAt": "2026-05-22T10:30:00.000Z"
    }
  ]
}
```

**前端消费映射**（`dashboard-data.ts` 改造）：
- `who` = `row.actorUsername ?? '系统'`
- `what` = i18n `actionLabels[row.actionType]`（37 项全集）
- `when` = `formatRelativeTime(row.createdAt)`
- `severity` = 前端规则派生（reject/fail = warn/danger / 其余 = info）
- `activitiesDataSource` 从 'mock' 改为 'live' → RecentActivityCard chip 自动隐藏

**错误码**：`VALIDATION_ERROR` 422 / `INTERNAL_ERROR` 500（零新增）。

---

### 7. 关联 ADR

详见 D-141-6 表。

---

### 8. R-MID-1 文件清单

**不适用（降级）**。理由：GET 只读，不写 audit；与 ADR-127 / ADR-137 / ADR-136 同 GET 端点降级原则一致。

**降级为 5 文件清单**：

| # | 文件 | 角色 |
|---|------|------|
| 1 | `apps/api/src/db/migrations/NNN_admin_audit_log_created_index.sql` | 新索引 migration |
| 2 | `apps/api/src/db/queries/dashboardActivities.ts` | Query: `listDashboardActivities` |
| 3 | `apps/api/src/routes/admin/dashboard.ts` | Route handler 追加 |
| 4 | `packages/types/src/dashboard.ts` | 类型追加 DashboardActivityRow |
| 5 | `tests/unit/api/dashboard-activities.test.ts` | 端点单测 |

**前端消费改造**（不计入 R-MID-1，实施卡 follow-up 范围）：
- `apps/server-next/src/lib/dashboard-data.ts` 替换 MOCK_ACTIVITIES 为 fetcher + `activitiesDataSource: 'live'`
- i18n 文件（新建或扩展）37 项 actionType → 中文 label 全集映射

---

### 9. 测试 surface

10 用例（happy / 空数据 / limit 生效 / limit 超范围 422 / limit 缺省 / 401 / 403 / actorUsername LEFT JOIN 有/无 / 缓存命中 DB 仅 1 次）；详见 ADR §9 测试 surface 表，实施卡内落地文件 `tests/unit/api/dashboard-activities.test.ts`。

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-141-1 | 新索引 CREATE INDEX 在大表阻塞写入 | 低 | 当前 audit_log < 10k 行，耗时 < 100ms；100k+ 后可用 CREATE INDEX CONCURRENTLY |
| R-141-2 | 内存缓存进程重启丢失 | 低 | 缓存为加速优化非正确性依赖；miss 直接查 DB < 10ms |
| R-141-3 | LEFT JOIN users 在 RESTRICT FK 下恒非 null | 极低 | 防御性编程，与 ADR-118 同模式 |
| R-141-4 | 前端 i18n 映射不全（新增 actionType 忘加 label） | 中 | 前端 fallback `actionLabels[type] ?? type`；CI 可选追加 set-equal 守卫 |

**回退路径**：① 代码 revert handler + query + 缓存 → `MOCK_ACTIVITIES` 自动恢复 + chip 重现 ② 索引保留（无副作用），需清理时 `DROP INDEX IF EXISTS`

---

### 11. 非阻塞建议 / N1

**N1-141-1（targetDisplayName 扩展）— ✅ 已闭合（CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME / 2026-05-22）**：当前端点不返回目标实体名称（如视频标题 / 用户名 / 站点名），RecentActivityCard 的 `what` 文案仅 action label 缺乏上下文。建议 follow-up 扩展 `targetDisplayName?: string | null` 字段（Service 层按 `targetKind` 批量查询目标实体 display name，分组 IN 查询避免 N+1）。接口向后兼容。**实施落地**：`DashboardActivityRow.targetDisplayName?: string | null` 类型字段；`enrichTargetDisplayNames(db, rows)` query helper 按 target_kind 分组 Promise.all 并行 IN 查询（覆盖 4 主要 target_kind: video.title / user.username / crawler_site.name / home_module.slot）；route handler 在 listDashboardActivities 后调用 enrich + 缓存对 enriched 结果；前端 mapActivityRow 文案 `${actionLabel}「${targetDisplayName ?? targetId.slice(-8) ?? ''}」`；测试 +2 用例（#11 video.title 拼接 / #12 target 不存在 fallback）；全 unit 4549 PASS（+2）。

**N1-141-2（severity 后端化）**：当前 severity 由前端简单规则映射。后续如需更精确分级（如"批量删除 > 100 条"标 danger），可在后端 Service 层根据 actionType + afterJsonb 内容计算 severity。当前阶段前端规则足够。**状态**：按需评估，不登记 follow-up。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-DASH-ACTIVITY-LIVE**：按本 ADR 实施 5 文件清单（migration + query + route + types + 单测）+ 前端 dashboard-data.ts mock → live 切换 + i18n 37 项 actionLabels 扩展
- **CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME**：N1-141-1 targetDisplayName 扩展（按需）

---

## ADR-142 — audit endpoints self-scope 权限协议设计（CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP）

**状态**：Accepted（arch-reviewer A− PASS / 2 非阻塞建议）
**日期**：2026-05-22
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-audit-self-scope`（P2，消费层 nav-hide 已 ⚠️ commit 3277ee7b；本 ADR 推进真实施）
**关联任务**：CHG-SN-8-FUP-AUDIT-SELF-SCOPE-ADR（本卡）/ CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP（实施 follow-up）

---

### 1. 决策摘要

将 `/admin/audit` 3 个 GET 端点从 **admin only** 扩展为 **admin + moderator**（方案 B self-scope），moderator 访问时后端强制注入 `actorId = request.user.userId` 过滤条件，仅返回该 moderator 自己发起的审计条目。`POST /admin/audit/logs/:id/rollback` 维持 admin only（ADR-138 D-138-2 明示）。前端从 `ADMIN_ONLY_HREFS` 移除 `/admin/audit`，moderator 可见 nav 入口，审计页页头展示"仅显示你的操作记录"信息提示。零 schema 变更，零新 ErrorCode，复用现有 `idx_admin_audit_log_actor_created` 索引，moderator self-scope 查询零额外成本。闭合 GAPS.md `#G-audit-self-scope` 从 ⚠️ → ✅。

---

### 2. 背景

**问题**：GAPS.md `#G-audit-self-scope`（P2）指出 moderator 应能查看自己发起的 audit 条目，但当前 `/admin/audit/*` 3 个 GET 端点全部 `adminOnly` 守卫，moderator 调用 403。

**消费层现状**：CHG-SN-8-GAPS-AUDIT-NAV-HIDE（commit 3277ee7b）已将 `/admin/audit` 加入 `ADMIN_ONLY_HREFS` Set，moderator 在侧边栏看不到「审计日志」入口。

**基础设施就绪实证**：
- Query 层 `listAdminAuditLog` 已支持 `actorId?: string` 参数（`apps/api/src/db/queries/auditLog.ts:120`）
- Service 层 `listAdminAuditLogs` 已透传 actorId（`apps/api/src/services/AuditLogService.ts:241`）
- 索引 `idx_admin_audit_log_actor_created (actor_id, created_at DESC)` 已就位（migration 052:61-62）
- 详情查询 `getAdminAuditLogById` 返回的 `AdminAuditLogDetailRow` 含 `actorId` 字段
- `requireRole` 已支持任意角色数组

**核心设计原则**：moderator 只能看自己的操作（`actor_id = currentUserId`），不能通过 query params 查看其他人的审计日志。

---

### 3. 决策

#### D-142-1 权限模型选型

选择**方案 B（admin + moderator self-scope）**。

| 维度 | 方案 A: admin only | 方案 B: admin + moderator self-scope | 方案 C: 多级 scope |
|------|---|---|---|
| 实施复杂度 | 零 | 低（Route 层 ~15 行 + 前端 ~5 行） | 中高 |
| 隐私保障 | 最高 | 高（强制 actorId 覆盖） | 中 |
| 运营调查 | 仅 admin | moderator 可自查 | moderator 可查同角色 |
| Service 改动 | 零 | 零（基础设施就绪） | 需新增 scope 参数 |
| 测试增量 | 零 | +6 用例 | +12 用例 |
| DB 索引需求 | 无 | 无（已就位） | 可能需新索引 |
| 前端改动 | 零 | ADMIN_ONLY_HREFS 删 1 项 + banner | scope 选择器 UI |
| GAP 闭合 | 维持 ⚠️ | ✅ 闭合 | ✅ 过度实装 |

**选择理由**：方案 B 以极低成本（基础设施就绪 / Service / Query 零改动）闭合 P2 GAP；方案 A 持续暴露 GAP；方案 C 引入不必要复杂度（跨用户数据可见性的隐私风险）。

#### D-142-2 4 endpoint 各自策略

| # | 端点 | ADR-142 权限 | moderator 行为 |
|---|------|------------|---------------|
| 1 | `GET /admin/audit/logs` | admin + moderator | 强制覆盖 `actorId = request.user.userId`；忽略 query 传入 |
| 2 | `GET /admin/audit/logs/:id` | admin + moderator | 查询后校验 `audit_log.actorId === currentUserId`；不匹配返回 404 |
| 3 | `GET /admin/audit/enums` | admin + moderator | 无限制，直接返回全量枚举 |
| 4 | `POST /admin/audit/logs/:id/rollback` | admin only（不变） | 403 FORBIDDEN（ADR-138 D-138-2） |

**端点 2 返回 404 而非 403 的安全考量**：避免 moderator 通过 403 推断 id 对应条目存在但属其他用户（不可见 = 不存在，security through ambiguity）。

#### D-142-3 self-scope filter 实现层

选择**方案 B（Route 层注入）**。

| 维度 | A: Service 层 | B: Route 层 | C: Middleware |
|------|---|---|---|
| 一致性 | Service 需新增 role 参数 | Route 已有 request.user 上下文 | 新增中间件 |
| 可维护性 | Service 通用性降低 | Route 职责明确 | 中间件抽象过度 |
| 隐私安全 | 调用方可能绕过 | Route 直接覆盖 params | 最严格 |
| 与现有模式对齐 | ADR-118 Service 零角色概念 | 现有 requireRole 自然延伸 | 无先例 |
| Service 接口侵入 | 需新增参数 | 零改动 | 零改动 |

**防 bypass 设计**：

**列表端点**：
```
if (request.user.role !== 'admin') {
  parsed.data.actorId = request.user.userId  // 强制覆盖
}
```

**详情端点**：
```
const detail = await svc.getAdminAuditLogDetail(parsed.data.id)
if (!detail) return 404
if (request.user.role !== 'admin' && detail.actorId !== request.user.userId) {
  return 404  // 不可见 = 不存在
}
```

#### D-142-4 前端 nav 处理

选择**方案 1（移除 + banner）**。

`apps/server-next/src/app/admin/admin-shell-client.tsx:28` 的 `ADMIN_ONLY_HREFS` 从 `['/admin/users', '/admin/settings', '/admin/audit']` 改为 `['/admin/users', '/admin/settings']`。moderator 可见审计日志 nav 入口。

**页头 banner**：moderator 访问 `/admin/audit` 时渲染信息提示：
- 文案：`"仅显示你的操作记录。如需查看完整审计日志，请联系管理员。"`
- 样式：admin-ui `Alert` 或 `Banner`，`level: 'info'`，固定展示
- admin 角色不渲染
- 实现位置：`apps/server-next/src/app/admin/audit/` 页面组件

**筛选器限制**：moderator 视图下 actorId 筛选 dropdown 隐藏；其余 actionType / targetKind / 时间范围保持可用。

#### D-142-5 R-MID-1 评估

**不适用（降级）**。3 个 GET 端点为只读，不写 audit（与 ADR-137 D-137-5 / ADR-141 D-141-4 同模式）。`POST rollback` 由 ADR-138 D-138-3 R-MID-1 管辖不变。

**verify:endpoint-adr 影响**：本 ADR 不新增路径，仅变更现有 3 个 GET 端点权限守卫。路径不变，脚本校验自然通过。

#### D-142-6 关联 ADR + 性能 + 安全

**关联 ADR**：ADR-109（schema）/ ADR-118（3 GET 端点原始协议；本 ADR 扩展权限）/ ADR-110（ErrorCode 复用）/ ADR-121（R-MID-1 降级）/ ADR-138（POST rollback 不变）/ ADR-139（role_changed_at 确保降级权限即时生效）/ ADR-141（dashboard activities admin only 不受影响）

**性能**：
- moderator self-scope 查询完美命中 `idx_admin_audit_log_actor_created` 索引（actor_id 前导列固定）；p95 预估 < 10ms
- 详情端点所有权校验：单行 PK 查询 + 内存比对，零额外开销
- COUNT(*) 并行模式不变，moderator scope 下 COUNT 同样走索引

**安全**：
1. 参数覆盖防 bypass（D-142-3 详述）
2. 详情所有权校验（404 而非 403）
3. rollback 隔离（requireRole 维持 admin only）
4. ipHash 字段：moderator 看到的是自己的 hash(IP) 不构成 PII 泄露

**新增 ErrorCode**：**零新增**。moderator 403 由 `requireRole` 覆盖；详情 404 复用 `NOT_FOUND`（不新增 ROLE_SCOPED_FORBIDDEN，避免 moderator 感知"scope 限制"与"不存在"的区别）。

---

### 端点契约

| # | Method | Path | 权限 (ADR-142) | 权限 (ADR-118 原) | moderator 行为 |
|---|--------|------|---------------|------------------|---------------|
| 1 | GET | `/admin/audit/logs` | moderator + admin | admin only | 强制 actorId = currentUserId |
| 2 | GET | `/admin/audit/logs/:id` | moderator + admin | admin only | 所有权校验 actorId === currentUserId，否则 404 |
| 3 | GET | `/admin/audit/enums` | moderator + admin | admin only | 无限制 |
| 4 | POST | `/admin/audit/logs/:id/rollback` | admin only（不变） | admin only | 403 FORBIDDEN |

**请求 / 响应变更**：零。所有 query / path params / response 信封与 ADR-118 完全一致。仅 preHandler 守卫从 `requireRole(['admin'])` 改为 `requireRole(['moderator', 'admin'])`（端点 1-3）。

---

### 5. SQL / Schema 设计

**无 migration**。零 schema 变更、零新索引、零新表。基础设施全部就绪。

---

### 6. Response 结构 / 错误码

**响应结构**：与 ADR-118 完全一致，零变更。

**错误码**：零新增。

| CODE | HTTP | ADR-142 触发 |
|------|------|-------------|
| `FORBIDDEN` | 403 | moderator 调用 rollback / user 调用 audit |
| `NOT_FOUND` | 404 | moderator 查看他人详情 / 不存在 id |
| `VALIDATION_ERROR` | 422 | 不变 |
| `UNAUTHORIZED` | 401 | 不变 |

---

### 7. 关联 ADR

详见 D-142-6 关联 ADR 表。

---

### 8. R-MID-1 文件清单

**不适用（降级）**。理由：3 个 GET 端点为只读，不写 audit（与 ADR-137 / ADR-141 同降级）。

**降级为 6 文件清单（实施卡 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP）**：

| # | 文件 | 角色 |
|---|------|------|
| 1 | `apps/api/src/routes/admin/audit.ts` | 3 GET endpoint 权限守卫变更 + moderator scope 注入 |
| 2 | `apps/server-next/src/app/admin/admin-shell-client.tsx` | ADMIN_ONLY_HREFS 移除 `/admin/audit` |
| 3 | `apps/server-next/src/app/admin/audit/` 页面组件 | moderator info banner + actorId filter 隐藏 |
| 4 | `tests/unit/api/audit-self-scope.test.ts` | 12 单测 |
| 5 | `docs/manual/GAPS.md` | `#G-audit-self-scope` ⚠️ → ✅ |
| 6 | `docs/changelog.md` | 完成备注 |

**注**：Service / Query 零改动（基础设施就绪）。

---

### 9. 测试 surface

12 用例（happy path 3 + bypass 防护 3 + 详情所有权 2 + 权限边界 3 + rollback 隔离 1）：

| # | 用例 | 断言 |
|---|------|------|
| 1 | moderator GET logs 不传 actorId → 200 + 仅自己 | data.every(row => row.actorId === moderatorUserId) |
| 2 | admin GET logs 不传 actorId → 200 + 全量 | data 含多 actor |
| 3 | admin GET logs?actorId=X → 200 + 按 X 过滤 | data.every(row => row.actorId === X) |
| 4 | moderator GET logs?actorId=<other-id> → 200 + 强制覆盖为自己 | data.every(row => row.actorId === moderatorUserId) |
| 5 | moderator GET logs?actorId=<self-id> → 200 + 正常 | 同 #1 |
| 6 | moderator GET logs + actionType filter → 200 + 自己 + 指定 actionType | 双 filter PASS |
| 7 | moderator GET logs/:id（自己的） → 200 + detail | data.actorId === moderatorUserId |
| 8 | moderator GET logs/:id（他人的） → 404 NOT_FOUND | error.code === 'NOT_FOUND' |
| 9 | moderator GET enums → 200 + actionTypes + targetKinds | data.actionTypes.length > 0 |
| 10 | moderator POST rollback → 403 FORBIDDEN | error.code === 'FORBIDDEN' |
| 11 | 未认证 GET logs → 401 | UNAUTHORIZED |
| 12 | user 角色 GET logs → 403 | FORBIDDEN |

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-142-1 | moderator 枚举 bigserial id 探测条目存在性 | 低 | id 存在性本身非敏感（不泄露 actor/action/target 内容）；rate limit 中间件保护 |
| R-142-2 | 前后端未同步部署（nav 见 + 后端 403） | 中 | 实施卡要求前后端同 commit 部署；回退路径明确 |
| R-142-3 | moderator 降级为 user 后 cookie 滞留 | 低 | ADR-139 已解决：role_changed_at 校验 + cookie 清除 |
| R-142-4 | 未来新 audit 端点忘加 self-scope 守卫 | 低 | 仅影响 `/admin/audit/*` 路由组；新端点默认 requireRole 守卫 |

**回退路径**：1. Route 守卫回退 `requireRole(['admin'])` 2. ADMIN_ONLY_HREFS 恢复 `/admin/audit` 3. 移除 banner 4. GAPS ⚠️ 回退 5. 零 schema 回退

---

### 11. 非阻塞建议 / N1

**N1-142-1（moderator dashboard 操作统计 widget）**：self-scope 落地后，可考虑为 moderator dashboard 增加"你本周的操作统计"轻量 widget，数据源复用 `listAdminAuditLog` + actorId filter + 日期范围。**状态**：按需评估，不登记 follow-up。

**N1-142-2（审计详情 ipHash 对 moderator 隐藏）**：当前 moderator 在详情端点看到自己操作的 ipHash。虽是自己的 IP hash，但 GDPR 第 4 条 IP hash 仍属个人数据；未来 moderator 团队规模扩大时可能需 strip。Service `toDetail` 按 role 控制即可。**状态**：按需评估，不登记 follow-up。

---

**后续解锁卡**：

- **CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP**：按本 ADR 实施 6 文件清单 + 12 测试 surface
- GAPS.md `#G-audit-self-scope` 状态：⚠️ → ✅ 闭合

---

## ADR-143 — admin 批量封禁用户端点协议设计（CHG-SN-8-FUP-USERS-BATCH-BAN-EP）

**状态**：Accepted（arch-reviewer A PASS / 1 非阻塞建议 N1-143-1 登记）
**日期**：2026-05-22
**arch-reviewer**：claude-opus-4-7（子代理评级；本主循环亦 claude-opus-4-7）
**关联 GAP**：`#G-users-batch-ban`（P3 体验优化）
**关联任务**：CHG-SN-8-FUP-USERS-BATCH-BAN-ADR（本卡）/ CHG-SN-8-FUP-USERS-BATCH-BAN-EP（实施 follow-up）

---

### 1. 决策摘要

新增两个对称 admin 写端点 `POST /admin/users/batch-ban` + `POST /admin/users/batch-unban`（方案 B），采用 **best-effort + 详细报告**（方案 B）部分失败处置，max batch size 50（与现有 moderation batch 对齐），每个成功 ban 独立写 `user.ban` audit log（方案 A，复用现有 actionType 不新增），每个成功 ban 写 Redis `user:rca:{id}` EX 900 触发 session invalidate（复用 ADR-139 范式）。**零新 actionType / 零新 ErrorCode / 零 schema 变更 / 零 R-MID-1 7 文件触发**。与仓内 6 个现有 batch 端点命名约定和部分失败处置范式完全对齐。

---

### 2. 背景

**现状**：
- 单次 ban/unban 已完备：`PATCH /admin/users/:id/{ban,unban}`（含 admin 守卫 + Redis cache + audit）
- 消费层 disabled 按钮已就位（CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN commit f4b91ad5）
- 仓内 batch 端点先例充分（6 个：moderation batch-approve/reject / submissions batch-approve/reject / videos batch-publish/unpublish / staging batch-publish）

**部分失败处置先例**：moderation batch-approve/reject 采用 best-effort per-id try/catch（`moderation.ts:287-303`）+ 三计数 response。

---

### 3. 决策

#### D-143-1 端点设计

选择**方案 B（对称双端点 batch-ban + batch-unban）**。

| 维度 | A: 单端点 | B: 对称双端点 | C: 通用 batch-actions |
|------|---|---|---|
| API 表面 | 1 端点 | 2 端点 | 1 端点 |
| 与现有 batch 对齐 | 部分 | **完全**（仓内全部"动作专用"命名） | 偏离（无 dispatch 先例） |
| 测试粒度 | 低 | **高**（独立测试矩阵） | 中 |
| 客户端调用 | 低 | 低（对称） | 中（需 action 守卫） |
| actionType 复用 | 仅 user.ban | **复用 user.ban + user.unban** | 需 dispatch |
| YAGNI | 满足最小需求 | **对称完整**（unban 即时入口） | 过度泛化 |
| 与单次端点对齐 | 部分 | **完全**（ban→batch-ban / unban→batch-unban） | 无对应 |

**选择理由**：仓内全部 batch 端点动作专用命名；方案 B 完全对齐；为运营误操作恢复提供即时 batch-unban 入口；额外 1 个端点成本极低。

#### D-143-2 部分失败处置

选择**方案 B（best-effort + 详细报告）**。

| 维度 | A: all-or-nothing | B: best-effort per-id | C: fail-first |
|------|---|---|---|
| 与 moderation batch 对齐 | 否 | **完全对齐** | 否 |
| UX 反馈 | 全成功或失败 | **三计数详细报告** | 部分 + 顺序敏感 |
| 事务复杂度 | 高 | 低 | 中 |
| skip 处理（admin/已 banned） | 整批回滚 | **跳过计入** | 中断 |
| Redis 写时机 | 事务后批量 | **per-id 成功后立即** | per-id 可被打断 |
| 部分成功可接受 | 否 | **是** | 是但不全 |
| 实施复杂度 | 中 | 低（复用单次 ban） | 中 |

**响应结构**（对齐 moderation batch）：`{ banned: N, skipped: N, failed: N }`（unban 对称 `{ unbanned, skipped, failed }`）。

#### D-143-3 max batch + 守卫

**max 50**（与 moderation batch-approve/reject 对齐，保守优先）。

**zod schema**：`z.array(z.string().uuid()).min(1).max(50)`

**5 类守卫**（per-id skip，幂等友好）：
| 守卫 | 行为 |
|------|------|
| admin 账号（user.role === 'admin'） | skip（避免 1 admin 阻塞整批） |
| 自残（id === request.user.userId） | skip（admin 默认已被前条拦截，显式加防） |
| 不存在 / soft deleted | skip |
| 已 banned（banned_at IS NOT NULL）/ 未 banned（unban 场景） | skip（幂等） |
| 重复 id | 去重（`new Set(ids)`） |

#### D-143-4 session invalidate 批量联动

**策略**：per-id 成功 ban 后立即 fire-and-forget 写 Redis `user:rca:{id}` EX 900（复用单次 ban 范式）。

**为何不用 Promise.allSettled + Redis pipeline**：
1. fire-and-forget per-id 与单次 ban 范式完全一致（可读性 + 可维护性）
2. Redis SET O(1)，50 次串行 < 10ms（pipeline 优化属 N1-143-1）
3. 失败容错已由 `.catch` warn 降级覆盖

**Redis 失败容错**：单 id Redis 失败不影响其他 + 不影响 DB；降级窗口 ≤ 15 min（ADR-139 R-139-2 一致）。

**batch-unban 不触发 session invalidate**（与单次 unban 一致）。

#### D-143-5 R-MID-1 audit 策略

选择**方案 A（每个 ban 写 1 条 user.ban audit log，共 N 条）**。

| 维度 | A: N 条 user.ban | B: 1 条 user.batch_ban | C: 混合 |
|------|---|---|---|
| 与单次 ban audit 一致性 | **完全一致** | 偏离 | 部分 |
| R-MID-1 7 文件触发 | **不触发** | 触发 | 触发 |
| audit 回溯粒度 | **按 user 精确**（targetId = userId） | 需解析 payload.ids | 精确 + 汇总 |
| AuditRollbackService 兼容 | **兼容**（user.ban 已可回滚） | 需注册新 handler | 复杂 |
| 与 staging.batch_publish 对齐 | 偏离（合理：staging 是 service 入队不可拆，本卡是 per-id for-loop） | 对齐 | 混合 |
| 实施复杂度 | **低** | 中高 | 高 |

**选择理由**：零 R-MID-1 框架触发是决定性因素；per-id audit 允许精确回溯；不同 batch 模式选不同 audit 策略合理。

#### D-143-6 关联 ADR + 性能 + ErrorCode

**关联 ADR**（7 项）：ADR-110 / ADR-118 / ADR-121 / ADR-136 / ADR-139（Redis 复用）/ ADR-140（admin 互改保护）/ ADR-138（AuditRollbackService 兼容）。

**性能**：
- per-id `UPDATE users` 主键 O(1)；50 次串行 < 100ms
- Redis 50 次 fire-and-forget < 10ms
- Audit 50 次 fire-and-forget catch 降级不阻塞
- 总 p95 目标 < 500ms

**为何不用 `UPDATE WHERE id = ANY($1)`**：per-id 模式允许精确 skip 5 类原因 + 精确 audit；ANY 模式无法区分 skip 原因。

**ErrorCode**：**零新增**。复用 `VALIDATION_ERROR` (422) / `UNAUTHORIZED` (401) / `FORBIDDEN` (403)；不引入 `BATCH_PARTIAL_FAILURE` 207（与 moderation batch 范式一致 — 200 + 三计数）。

---

### 端点契约

| # | Method | Path | 权限 | Body | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|------|----------------|---------------|-----|
| 1 | POST | `/admin/users/batch-ban` | admin | `{ ids: UUID[] }` (1-50) | `{ banned: number, skipped: number, failed: number }` | 无 | ADR-143 |
| 2 | POST | `/admin/users/batch-unban` | admin | `{ ids: UUID[] }` (1-50) | `{ unbanned: number, skipped: number, failed: number }` | 无 | ADR-143 |

**side-effects**（batch-ban per-id）：DB UPDATE users + Redis SET user:rca:{id} EX 900（fire-and-forget）+ Audit user.ban（fire-and-forget）

**side-effects**（batch-unban per-id）：DB UPDATE users + Audit user.unban；不写 Redis（与单次 unban 一致）

---

### 5. SQL / Schema 设计

**无新 migration / 无新 query 函数**。复用现有 `banUser(db, id)` + `unbanUser(db, id)`（`apps/api/src/db/queries/users.ts:179-201`），handler 内 for-loop 调用。

---

### 6. Response 结构 / 错误码

**成功响应**（200）：

```json
{
  "data": { "banned": 8, "skipped": 2, "failed": 0 }
}
```

batch-unban 对称：`{ unbanned: 8, skipped: 2, failed: 0 }`

**计数语义**：`banned/unbanned`（成功）/ `skipped`（5 类守卫触发）/ `failed`（非预期 DB/服务错误）

**错误响应**：复用 ADR-110 ApiErrorBody + 现有 ErrorCode；零新增。

---

### 7. 关联 ADR

详见 D-143-6 关联 ADR 表（7 项）。

---

### 8. R-MID-1 文件清单

**不适用（降级）**。理由：D-143-5 选方案 A 复用现有 `user.ban` / `user.unban` actionType；零新 actionType = 零触发 ADR-121 4 真源同步范式；R-MID-1 第 20 次系统化（USERS-BAN-AUDIT commit 60ecffe1）已完成 actionType 注册。

---

### 9. 测试 surface

16 用例（happy 2 + 5 类 skip + 去重 + Redis + audit + 422 边界 3 + 401/403）：
- batch-ban: happy / admin skip / 自残 skip / 不存在 skip / 已 banned skip / 去重 / Redis 写 / audit 写 / 422 超 50 / 422 空 / 422 非 UUID（11 用例）
- batch-unban: happy / 未 banned skip / audit / 不写 Redis（4 用例）
- 权限：非 admin 401/403（1 用例）

文件 `tests/unit/api/admin-users-batch-ban.test.ts`。

---

### 10. 风险与回退

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-143-1 | admin 误操作批量 ban 50 用户 | 中 | max 50 + 前端 confirm dialog（实施卡消费层加二次确认）+ batch-unban 对称端点提供恢复 |
| R-143-2 | Redis 宕机 → session invalidate 窗口 | 低 | 与单次 ban 同风险（ADR-139 R-139-2）；DB 已 banned；Redis 恢复后下次操作重建 |
| R-143-3 | per-id 串行 50 次 → 端点延迟 | 低 | p95 < 500ms 可接受；N1-143-1 并行优化备选 |
| R-143-4 | 50 audit fire-and-forget 短时尖刺 | 低 | AuditLogService catch 降级 + PG WAL 异步；远小于 staging batch-publish 100 上限 |

**回退路径**：① 代码 revert 2 handler ② 消费层恢复 disabled 按钮 ③ 零 schema / 零 ErrorCode / 零 R-MID-1 变更 → 零残留

---

### 11. 非阻塞建议 / N1

**N1-143-1（串行 → 并行 DB + Redis pipeline 优化）**：当前 per-id 串行 for-loop 与 moderation batch 一致。若运营反馈 50 ids 延迟不佳，可优化：
1. `findAdminUserById` 阶段 `Promise.all` 批量预取
2. 守卫过滤后 `UPDATE users WHERE id = ANY($1::uuid[]) AND role != 'admin' AND banned_at IS NULL AND deleted_at IS NULL RETURNING ...` 一次 SQL 批量
3. Redis `pipeline` 批量 SET

牺牲精确 skip 原因区分，将 p95 从 ~500ms → ~50ms。建议作为 follow-up 独立卡评估。**状态**：待实施卡评估。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-USERS-BATCH-BAN-EP**：按本 ADR 实施 2 新端点 + 16 测试 surface + 消费层 `batchBanUsers` / `batchUnbanUsers` lib + UsersListClient batch mode 启用


## ADR-144 — FilterPreset 团队共享协议（user_filter_presets 表 + 4 端点 + scope 模型）

**状态**：Accepted
**日期**：2026-05-22
**作者**：arch-reviewer (claude-opus-4-7)
**关联 GAP**：`#G-moderation-preset-team`（P3 体验优化）
**关联 follow-up**：CHG-SN-8-FUP-PRESET-TEAM-EP（实施卡）
**关联任务**：CHG-SN-8-FUP-PRESET-TEAM-ADR（本卡 ADR 起草）

---

### 1. 背景与问题

**现状**：审核台 FilterPreset 完全由前端 `apps/server-next/src/lib/moderation/use-filter-presets.ts` 管理，使用 localStorage 持久化（key `admin.moderation.presets.v1`）。CRUD 操作完整（save/update/remove/setDefault），按 tab 隔离（pending/staging/rejected/all），同一 tab 最多 1 个 isDefault。

**用户痛点**：跨设备不可见 / 跨账号不可见 / 隐式数据丢失 / 协作摩擦。

**已有消费层铺垫**：CHG-SN-8-GAPS-PRESET-LOCAL-BADGE 已加「仅本地」warn chip 指向本 follow-up。

**修复必要性**：P3 体验优化。不阻塞审核流程但长期降低团队效率。

---

### 2. 范围与不在范围

**本 ADR 决定**：scope 模型 / 表 schema / 4 端点契约 / RBAC / R-MID-1 落地 / is_default 单一性保证 / localStorage 迁移策略。

**不在范围**：实施代码（留 EP 卡）/ FilterPreset 标签系统（N1-144-2）/ 导入导出 / 频率推荐（N1-144-1）/ team/多租户概念。

---

### 3. D-N 决策清单

#### D-144-1 scope 模型选型

| 维度 | A: 引入 team 表 + team_id | B: scope `'private' \| 'shared'`（无 team） | C: scope + role-based 可见性矩阵 |
|------|---|---|---|
| 与 Resovo 当前架构对齐 | 偏离（无 team 概念） | **完全对齐** | 部分对齐 |
| 实施复杂度 | 高（新表 + FK + 权限 + team CRUD） | **低**（1 列 TEXT CHECK） | 中（矩阵维护） |
| 覆盖团队协作 | 过度完备 | **充分**（shared = 全 moderator+admin 可见） | 过度精细 |
| 多租户扩展性 | 天然 | **可扩展**（后续加 team_id 列） | 可扩展 |
| YAGNI | 违反 | **满足** | 部分违反 |
| 查询复杂度 | 高（JOIN team_members） | **低** | 中 |

**选择：方案 B**。理由：Resovo 当前架构无 team 表 / 无 team_id / 无多租户概念。引入 team 是过度设计。`shared` scope 语义 = "所有 moderator+admin 可见"，覆盖当前团队协作需求。后续 M-SN-N 多租户时可在 `user_filter_presets` 表加 `team_id` 列扩展，不破坏已有 scope 列。

#### D-144-2 user_filter_presets 表 schema

完整 schema 见 §5。设计决策：UUID PK（与仓内一致）/ owner FK ON DELETE CASCADE（非审计数据）/ 不实装 soft delete（audit log 已记 before_jsonb 可追溯）/ query 用 JSONB（前端 FilterPresetQuery 已是 object）/ name 由 Service 层 zod max 100 守卫（DB 不加 VARCHAR）/ updated_at 触发器。

**索引设计**：`idx_ufp_owner_scope_tab` (复合) + `idx_ufp_default_unique` (部分唯一 WHERE is_default=true) + `idx_ufp_shared_tab` (部分 WHERE scope='shared')。

#### D-144-3 端点契约

| 维度 | A: 分页 | B: 200 上限不分页 |
|------|---|---|
| 预设数量预估 | 单用户 < 20；全局 shared < 100 | **远低于分页阈值** |
| 实施复杂度 | 中 | **低** |
| 与现有端点对齐 | review-labels list 不分页 | **对齐** |

**选择：方案 B（200 上限不分页）**。

**权限矩阵**：

| 操作 | private preset (own) | shared preset (own) | shared preset (他人) |
|------|---|---|---|
| read (list) | moderator+admin | moderator+admin | moderator+admin |
| create | moderator+admin | moderator+admin | N/A |
| update | owner only | owner only | **403 FORBIDDEN** |
| delete | owner only | owner only | **admin 可强制删** |

#### D-144-4 RBAC + 跨账号写

| 维度 | A: 仅 owner 可改/删 | B: shared preset 全员可改 | C: owner + admin 可改/删 |
|------|---|---|---|
| 数据完整性 | **高** | 低 | 中 |
| UX 预期 | **自然** | 混乱 | 自然 |
| 清理能力 | 无 | 有（滥用风险） | **有** |

**选择：方案 A + admin 强制删除例外**。owner 全权管理自己预设；admin 仅可强制删他人 shared preset（清理场景，不可改名/改 query）；moderator 不可编辑/删除他人预设。

#### D-144-5 R-MID-1 framework

**新增 actionType（3 个，R-MID-1 第 21-23 次系统化）**：
- `filter_preset.create`：before null / after `{ id, name, scope, tab, queryKeys: string[] }`
- `filter_preset.update`：before/after diff-only（仅变更字段的旧值/新值）
- `filter_preset.delete`：before `{ id, name, scope, tab }` / after null

**新增 targetKind**：`filter_preset`（migration 072 CHECK 12 → 13）。

#### D-144-6 localStorage → DB 迁移策略

| 维度 | A: 自动首次登录上传 | B: 用户手动 import | C: 不迁移 |
|------|---|---|---|
| 用户感知 | 静默（可能困惑） | **显式操作** | 无变化 |
| 实施复杂度 | 中 | **低** | 极低 |
| 数据所有权 | 模糊 | **明确** | 明确 |
| UX 流畅度 | 高 | 中 | 低 |

**选择：方案 B（用户手动 import）**。不破坏现状 + 用户感知可控 + 避免重复风险。FilterPresetPopover 增"导入本地预设"入口；导入成功后清 localStorage key。未导入的 localStorage 数据继续本地使用（双源共存过渡期）。

#### D-144-7 is_default 单一性保证

| 维度 | A: DB 部分唯一索引 | B: Service 层事务保证 |
|------|---|---|
| 约束强度 | **DB 层硬约束** | 应用层（可绕过） |
| 并发安全 | **天然安全** | 需 SERIALIZABLE / FOR UPDATE |
| 实施复杂度 | **低**（1 行 DDL） | 中 |

**选择：方案 A（DB 部分唯一索引）**。配合 Service 层事务：设 default 时先 `UPDATE ... SET is_default = FALSE WHERE owner_user_id = $1 AND tab = $2`，再 `UPDATE ... SET is_default = TRUE WHERE id = $3`。DB 部分索引作终极护栏防 race。

#### D-144-8 关联 ADR 引用

| # | ADR | 关联点 |
|---|-----|--------|
| 1 | ADR-003 | JWT 双 Token 认证（fastify.authenticate 复用） |
| 2 | ADR-109 | admin_audit_log schema（migration 052）|
| 3 | ADR-110 | ErrorCode 系统（复用 NOT_FOUND/VALIDATION_ERROR/FORBIDDEN；零新增）|
| 4 | ADR-118 | audit 视图端点协议（ACTION_TYPES/TARGET_KINDS 真源）|
| 5 | ADR-121 | R-MID-1 7 文件审计框架 |
| 6 | ADR-139 | fastify.requireRole 复用 |
| 7 | ADR-140 | target_kind CHECK 扩展范式（migration 069）|

---

### 4. 端点契约

### 端点契约

4 个端点，全部挂 `preHandler: [fastify.authenticate, fastify.requireRole(['moderator', 'admin'])]`：

| # | Method | Path | 权限 | Body / Query | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|--------------|----------------|---------------|-----|
| 1 | GET | `/admin/filter-presets` | moderator, admin | Query: `{ tab?, scope? }` | `FilterPresetDto[]` (200 上限不分页) | 无 | ADR-144 |
| 2 | POST | `/admin/filter-presets` | moderator, admin | Body: `{ name, scope?, tab, query?, isDefault? }` | `{ data: FilterPresetDto }` (201) | 无 | ADR-144 |
| 3 | PATCH | `/admin/filter-presets/:id` | moderator, admin (owner only) | Body: `{ name?, scope?, tab?, query?, isDefault? }` (≥1 字段) | `{ data: FilterPresetDto }` | 无 | ADR-144 |
| 4 | DELETE | `/admin/filter-presets/:id` | moderator, admin (owner / admin force) | — | 204 No Content | 无 | ADR-144 |

**side-effects**：POST/PATCH 触发 `clearDefaultForOwnerTab` 互斥事务（is_default=true 场景）+ R-MID-1 audit fire-and-forget（filter_preset.create / update / delete）；DB 部分唯一索引 `idx_ufp_default_unique` 作终极护栏防 race。

**4.1 GET**：Query `tab?: enum / scope?: enum`；Response 含 `ownerUserId`/`ownerUsername` (LEFT JOIN users)；返回 own private + own shared + 他人 shared；200 上限 slice。

**4.2 POST**：Body zod `name(1-100) / scope=private / tab / query={} / isDefault=false`；owner_user_id 取自 request.user！；isDefault=true 时 Service 层先清同 owner+tab 旧 default；audit create；201 返回新建对象。

**4.3 PATCH**：Path `:id` UUID；Body 至少 1 字段；仅 owner 可 PATCH；isDefault=true 自动清旧 default；audit update；200 返回更新对象。

**4.4 DELETE**：Path `:id` UUID；owner 全权 / admin 可强制删他人 shared / moderator 不可删他人；audit delete；204。

**错误码全复用**（零新增）：401 UNAUTHORIZED / 403 FORBIDDEN / 404 NOT_FOUND / 409 STATE_CONFLICT (default 互斥 23505 兜底) / 422 VALIDATION_ERROR。

---

### 5. 数据库 schema

#### Migration 071: user_filter_presets 建表

```sql
-- 071_user_filter_presets.sql
-- ADR-144 / CHG-SN-8-FUP-PRESET-TEAM-EP
BEGIN;

CREATE TABLE IF NOT EXISTS user_filter_presets (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id   UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT         NOT NULL,
  scope           TEXT         NOT NULL DEFAULT 'private'
                                CHECK (scope IN ('private', 'shared')),
  tab             TEXT         NOT NULL
                                CHECK (tab IN ('pending', 'staging', 'rejected', 'all')),
  query_jsonb     JSONB        NOT NULL DEFAULT '{}',
  is_default      BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_filter_presets IS 'FilterPreset 持久化（ADR-144）；scope=private 仅 owner / scope=shared 全 moderator+admin 可见';
COMMENT ON COLUMN user_filter_presets.scope IS 'private | shared；CHECK 限定 2 值';
COMMENT ON COLUMN user_filter_presets.tab IS 'pending | staging | rejected | all；与前端 FilterPresetTab 对齐';
COMMENT ON COLUMN user_filter_presets.query_jsonb IS '筛选条件 JSONB 快照';
COMMENT ON COLUMN user_filter_presets.is_default IS '同 owner+tab 最多 1 个 default（部分唯一索引 idx_ufp_default_unique 保证）';

CREATE INDEX IF NOT EXISTS idx_ufp_owner_scope_tab
  ON user_filter_presets (owner_user_id, scope, tab);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ufp_default_unique
  ON user_filter_presets (owner_user_id, tab)
  WHERE is_default = TRUE;

CREATE INDEX IF NOT EXISTS idx_ufp_shared_tab
  ON user_filter_presets (scope, tab)
  WHERE scope = 'shared';

CREATE OR REPLACE FUNCTION trg_ufp_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_filter_presets_updated
  BEFORE UPDATE ON user_filter_presets FOR EACH ROW
  EXECUTE FUNCTION trg_ufp_updated_at();

COMMIT;
```

#### Migration 072: target_kind CHECK 12 → 13

```sql
-- 072_audit_log_extend_target_kind_filter_preset.sql
-- ADR-144 D-144-5 / R-MID-1 第 21-23 次系统化
BEGIN;

ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_kind_check;
ALTER TABLE admin_audit_log ADD CONSTRAINT admin_audit_log_target_kind_check
  CHECK (target_kind IN (
    'video', 'video_source', 'staging', 'review_label', 'crawler_site', 'system',
    'home_module', 'source_line_alias', 'source_route', 'user_submission', 'image_health',
    'user', 'filter_preset'
  ));

COMMENT ON COLUMN admin_audit_log.target_kind IS 'CHECK 限定 13 种（ADR-144 扩展 filter_preset；12→13）';

COMMIT;
```

---

### 6. R-MID-1 framework 落地

**R-MID-1 第 21-23 次系统化**。7 文件 checklist：

| # | 文件 | 变更 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | AdminAuditActionType 新增 3 值 |
| 2 | `packages/types/src/admin-moderation.types.ts` | AdminAuditTargetKind 新增 `'filter_preset'` |
| 3 | `apps/api/src/services/AuditLogService.ts` | ACTION_TYPES / TARGET_KINDS 同步 |
| 4 | `apps/api/src/services/AuditLogService.ts` | extractAuditPayloadSummary filter_preset 分支 |
| 5 | 测试 | `audit-log-coverage.test.ts` PAYLOAD_REQUIRED 新增 3 值 |
| 6 | Route | `apps/api/src/routes/admin/filter-presets.ts` 各写端点调用 `auditSvc.write(...)` |
| 7 | docs | changelog R-MID-1 #21-23 |

**JSONB schema**：create after = `{ id, name, scope, tab, queryKeys: string[] }` (queryKeys = Object.keys 摘要避免 JSONB 全量入 audit) / update diff-only / delete before = `{ id, name, scope, tab }`。

---

### 7. 测试 surface（18 用例）

文件：`tests/unit/api/admin-filter-presets.test.ts`

| # | 类别 | 用例 |
|---|------|------|
| 1-5 | CRUD happy | POST private / POST shared / GET list 三类集合 / PATCH name / DELETE own |
| 6-7 | scope filter | GET ?scope=shared / GET ?tab=pending |
| 8-10 | is_default 互斥 | POST 互斥 / PATCH 互斥 / 并发 23505 → 409 |
| 11-14 | 跨 owner 权限 | moderator PATCH 他人 → 403 / moderator DELETE 他人 → 403 / admin DELETE 他人 shared → 204 / admin DELETE 他人 private → 403 |
| 15 | shared 跨 role | moderator B 可读 moderator A 的 shared |
| 16 | R-MID-1 audit | POST 后 admin_audit_log 有 filter_preset.create 记录 |
| 17-18 | 422 validation | name 超 100 / tab 非法值 |

---

### 8. 实施 follow-up 拆解

**CHG-SN-8-FUP-PRESET-TEAM-EP**（~0.4w / 2 天）：
1. Migration 071+072 (0.5h)
2. DB query 层 (1h)
3. Service 层（含 RBAC + default 互斥事务 + audit）(2h)
4. Route 层 4 端点 (1h)
5. R-MID-1 7 文件 (1h)
6. 前端 lib 重写 SWR + API (2h)
7. 前端 UI scope toggle + badge (1.5h)
8. localStorage 迁移 import (1h)
9. 18 测试 (2h)
10. docs 更新 (0.5h)

---

### 9. 风险

| # | 风险 | 严重性 | 缓解 |
|---|------|--------|------|
| R-144-1 | Migration 071 CREATE TABLE 失败（users FK 不存在 / 权限不足） | 中 | 幂等 `IF NOT EXISTS` + users 已存在 (migration 001)；CI 先跑 migration 测试 |
| R-144-2 | 大量 localStorage 数据用户不迁移 → 双源共存长期化 | 低 | 前端 hook 优先 DB + localStorage fallback 可无限期共存；warn chip 引导导入 |
| R-144-3 | shared preset 滥用 — 命名混乱 / 数量膨胀 | 低 | 200 上限截断 + name max 100 + admin 可强制删除；N1-144-2 标签系统进一步治理 |
| R-144-4 | list 端点 N+1 性能 — LEFT JOIN users 取 ownerUsername | 低 | 单次 JOIN 非 N+1；200 上限 + 3 索引覆盖；预设量远低于性能阈值 |

**回退路径**：代码 revert（Route → Service → Query → Migration 072 → 071 DROP）；前端 hook 回退到纯 localStorage；R-MID-1 3 值回退；零 ErrorCode 残留。

---

### 10. N1 follow-up 候选

**N1-144-1（基于高频筛选的 preset 自动建议）**：分析 moderator 最近 30 天筛选参数分布，toast 提示"您经常使用的筛选，要保存为预设吗？"。需新增 `moderation_filter_usage` 统计表。**状态**：待业务验证。

**N1-144-2（preset 标签系统）**：为 shared preset 加 `tags TEXT[]` 字段支持分组检索。降低数量膨胀后检索成本。**状态**：待 R-144-3 风险触发后评估。

---

### 11. 评级

| 维度 | 评分 | 理由 |
|------|------|------|
| 方案完整性 | A | 8 D-N 覆盖 scope / schema / 端点 / RBAC / R-MID-1 / 迁移 / 约束 / ADR 关联 |
| 与现有架构对齐 | A | 零新概念引入；复用 R-MID-1 / auth / ErrorCode / AuditLogService 全栈 |
| 关联 ADR 实证 | A | 7 项实证（3/109/110/118/121/139/140） |
| 实施可行性 | A | migration 两步分离 + Service 事务 + DB 硬约束双保险 + 18 测试 |
| 扩展预留 | A | scope 列可扩展（future `'team'`）+ query_jsonb 不限 schema 演进 |
| 风险控制 | A | 4 风险全低/中 + 完整回退路径 |

**推荐评级：A**

方案 B scope 模型极简（`private | shared` 两值 CHECK，不引入 team 概念），完全对齐 Resovo 当前单组织架构。零新 ErrorCode / 零新依赖 / 零架构级新概念。7 关联 ADR 实证覆盖认证、审计、错误码、Service、DB query 全栈。R-MID-1 第 21-23 次系统化遵循已建立 7 文件 checklist。DB 部分唯一索引保证 is_default 单一性。迁移策略选用户主导（方案 B），不破坏现有 localStorage 工作流。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-PRESET-TEAM-EP**：按本 ADR 实施全栈（2 migration + Query + Service + Route + R-MID-1 7 文件 + 前端 lib 重写 + scope toggle UI + import + 18 测试）




## ADR-145 — admin 手动添加视频端点协议（POST /admin/videos 重构 + catalog 同步 + R-MID-1 第 24 次系统化）

**状态**：Accepted
**日期**：2026-05-22
**作者**：arch-reviewer (claude-opus-4-7)
**关联 GAP**：`#G-videos-add`（P2 运营能力缺口）
**关联 follow-up**：CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP（实施卡）
**关联任务**：CHG-SN-8-FUP-VIDEO-MANUAL-ADD-ADR（本卡 ADR 起草）

---

### 1. 背景与问题

**现状**：后台视频库（`/admin/videos`）PageHeader「+ 手动添加视频」按钮 disabled。视频入库完全依赖 crawler 自动派发（`CrawlerService` → `insertCrawledVideo` → `MediaCatalogService.findOrCreate` → `createVideo`）。

**已有端点技术债**：POST /admin/videos 已注册但实现存在 6 项问题——绕过 MediaCatalogService.findOrCreate / 输入 Record<string,unknown> 无类型 / 零 audit log / 零重复检测 / 无 publishMode 控制 / metadataSource 标 'manual' 但 catalog 创建不受 locked_fields 保护。

**用户场景（P2）**：数据修复（crawler 漏采） / 测试条目（开发 QA） / 运营特例（临时补录冷门片源）。

**修复必要性**：P2。本 ADR 重构现有端点至生产标准，非新增端点。

---

### 2. 范围与不在范围

**本 ADR 决定**：POST /admin/videos 完整 schema / 与 MediaCatalogService.findOrCreate 集成 / 重复检测（title+year+type 软匹配）/ publishMode 三路径 / R-MID-1 video.manual_add 第 24 次系统化 / VideoEditDrawer 双模式复用 / ErrorCode 复用。

**不在范围**：批量 CSV 导入（N1）/ 模板预填（N1）/ 内联 video_sources 创建 / 字幕上传 / 新表 / ES 索引策略变更（复用 indexSync.syncVideo）。

---

### 3. D-N 决策清单

#### D-145-1 minimum required 字段集

| 维度 | A: 完整 80 字段 | B: minimum 5 字段（含 year+sourceUrl required）| C: minimum 3 字段（title/type/contentRating + 其余 optional） |
|------|---|---|---|
| 用户体验 | 极差 | 中 | **平衡** |
| 与 CreateVideoInput 对齐 | 远超 | 部分 | **完全对齐** |
| 与 crawler year=null 8% 实证一致 | 偏离 | 偏离 | **对齐** |
| YAGNI | 违反 | 部分违反 | **满足** |
| 后续编辑成本 | 零 | 低 | **低**（Drawer 编辑模式已成熟） |

**选择：方案 C**。理由：year/sourceUrl 应 optional（crawler 同样存 year=null 约 8% / source 空待补的视频）；与 CreateVideoInput 真正必填项对齐（catalogId 由 Service 自动 findOrCreate 生成）；可选字段覆盖 VideoMetaSchema 已有定义 + publishMode。

#### D-145-2 重复检测策略

| 维度 | A: 仅 catalogId 已存在拒绝 | B: title+year+type 软匹配警告（force=true 跳过） | C: imdbId/tmdbId 优先 + title 回退 |
|------|---|---|---|
| 与 MediaCatalogService 5 步匹配对齐 | 部分 | **完全对齐**（复用 findOrCreate 返回 isNewlyCreated） | 重叠但实现不同 |
| 误阻率 | 高（同名不同版本） | **低**（软警告 + force 跳过） | 低 |
| admin 控制力 | 差 | **优** | 优 |

**选择：方案 B**。Service 层 findOrCreate 后 `SELECT count FROM videos WHERE catalog_id=$1 AND deleted_at IS NULL`。有 + force≠true → 409 STATE_CONFLICT body 含 `detail: { existingVideoId, existingTitle }`；有 + force=true → 同 catalog 多 video 实例合法（不同 siteKey 同名视频场景）。**不修改** MediaCatalogService.findOrCreate 签名。

#### D-145-3 与 media_catalog 关系

| 维度 | A: 绕过 catalog NULL | B: 复用 MediaCatalogService.findOrCreate | C: admin 可选 existingCatalogId 否则自动 |
|------|---|---|---|
| 双表一致性 | 破坏 | **保证** | 保证 |
| 元数据治理（locked_fields / metadataSource）| 不触发 | **触发** | 触发 |
| 与 crawler 路径对齐 | 偏离 | **完全对齐** | 部分 |
| 修复现有技术债 | 不修复 | **修复**（替换 insertCrawledVideo 路径） | 修复 |

**选择：方案 B**。VideoService.create 重构：findOrCreate(metadataSource='manual') → createVideo → 手动输入字段获 locked_fields 最高优先级（5）保护。

#### D-145-4 与 staging/review 关系

| 维度 | A: 直接 published=true | B: 强制入 staging | C: admin 可选 publishMode（默认 staging）|
|------|---|---|---|
| admin 效率 | 高（无审核兜底） | 低（自审一遍） | **高** |
| 数据质量 | 风险 | 高 | **可控** |
| 灵活性 | 无 | 无 | **高** |

**选择：方案 C**。Body 加 `publishMode?: 'draft' | 'staging' | 'published'` 默认 `'staging'`：
- `draft` → pending_review + hidden + false
- `staging`（默认）→ pending_review + internal + false
- `published` → approved + public + true（reviewed_by=actor，自审自发）

#### D-145-5 R-MID-1 framework

**新增 actionType 1 个，第 24 次系统化**：
- `video.manual_add`：targetKind=`video`（复用，CHECK 13 种已含）
- before_jsonb=null / after_jsonb={ id, title, type, year, publishMode, catalogId, isNewCatalog, contentRating }

targetKind 复用零 migration 扩展。

#### D-145-6 ErrorCode 复用

| 维度 | A: 新 DUPLICATE_VIDEO | B: 复用 STATE_CONFLICT |
|------|---|---|
| 与 ADR-110 零新 ErrorCode 原则 | 偏离 | **对齐** |
| 语义精度 | 高（专用码） | **足够**（409=状态冲突，重复检测本质 catalog 已有 video 状态冲突） |
| ErrorCode 膨胀控制 | 18→19 | **保持 18** |
| 前端消费 | 需新 handler | **零改动** |

**选择：方案 B**。409 response 携带 `detail: { existingVideoId, existingTitle }`。

#### D-145-7 前端复用策略

| 维度 | A: 复用 VideoEditDrawer 双模式 | B: 新建 VideoCreateModal | C: Quick Add 简表单 |
|------|---|---|---|
| 组件数量 | **不增加** | +1 | +1 |
| Tab 结构复用 | **完整** | 重实现 | 不含 |
| 编辑→创建切换 UX | **自然** | 断裂 | 断裂 |
| 实施成本 | **低** | 高 | 中 |

**选择：方案 A**。`videoId === null` → 创建模式（POST + 空白表单 + 文案"添加视频" + lines/images/douban tab disabled 需先创建）；`videoId !== null` → 编辑模式（现有不变）。Props 零改动（videoId 已是 string | null）。

#### D-145-8 关联 ADR 引用

| # | ADR | 关联点 |
|---|-----|--------|
| 1 | ADR-003 | JWT 双 Token 认证（fastify.authenticate 复用）|
| 2 | ADR-109 | admin_audit_log schema（migration 052）|
| 3 | ADR-110 | ErrorCode 系统（复用 STATE_CONFLICT/VALIDATION_ERROR/FORBIDDEN；零新增）|
| 4 | ADR-118 | audit 视图协议（ACTION_TYPES/TARGET_KINDS 真源）|
| 5 | ADR-121 | R-MID-1 7 文件框架（第 24 次系统化）|
| 6 | ADR-139 | fastify.requireRole 复用 |
| 7 | ADR-144 | 最近 ADR 范式参考（同类 R-MID-1 + 零新 ErrorCode）|

---

### 4. 端点契约

### 端点契约

1 个端点（重构现有），preHandler: `[authenticate, requireRole(['moderator','admin'])]`：

| # | Method | Path | 权限 | Body | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|------|----------------|---------------|-----|
| 1 | POST | `/admin/videos` | moderator, admin | Body: `{ title, type, contentRating, publishMode?, force?, titleEn?, description?, coverUrl?, year?, country?, episodeCount?, status?, rating?, director?, cast?, writers?, genres?, doubanId? }` | `{ data: { id, shortId, title, type, catalogId, reviewStatus, visibilityStatus, isPublished, createdAt } }` (201) | 无 | ADR-145 |

**side-effects**：MediaCatalogService.findOrCreate（metadataSource='manual' + locked_fields 自动加锁）+ createVideo + indexSync.syncVideo fire-and-forget + R-MID-1 audit fire-and-forget `video.manual_add`

**Body zod schema** `ManualAddVideoSchema`：title z.string().min(1).max(200) + type z.enum 11 值 + contentRating default 'general' + publishMode default 'staging' + force default false + 14 optional 元数据字段。

**Error responses**：401 UNAUTHORIZED / 403 FORBIDDEN / 409 STATE_CONFLICT（detail.existingVideoId + existingTitle） / 422 VALIDATION_ERROR。

---

### 5. 端点实现 sketch

```
POST /admin/videos handler:
1. zod parse ManualAddVideoSchema (→ 422)
2. auth check (preHandler 覆盖)
3. catalog = MediaCatalogService.findOrCreate({ ...input, metadataSource: 'manual' })
4. 重复检测：SELECT count FROM videos WHERE catalog_id=catalog.id AND deleted_at IS NULL LIMIT 1
   有 + !force → 409 STATE_CONFLICT { detail: { existingVideoId, existingTitle } }
5. publishMode 映射 stateMap[mode] → { reviewStatus, visibilityStatus, isPublished }
6. video = createVideo(db, { catalogId, title, type, episodeCount?, contentRating })
7. publishMode === 'draft'/'published' 时 transitionVideoState 或 UPDATE 状态
8. void indexSync.syncVideo(video.id)
9. void auditSvc.write({ actorId, actionType: 'video.manual_add', targetKind: 'video',
     targetId: video.id, beforeJsonb: null, afterJsonb: { id, title, type, year, publishMode, catalogId, isNewCatalog, contentRating } })
10. → 201 { data: { id, shortId, title, type, catalogId, reviewStatus, visibilityStatus, isPublished, createdAt } }
```

Step 3 findOrCreate 内部已处理 5 步匹配 + ON CONFLICT + 事务，调用方无需额外事务。Step 7 published 路径用 transitionVideoState（状态机 trigger 守卫），approve_and_publish 要求 review_status='pending_review'，createVideo 默认满足。

---

### 6. R-MID-1 7 文件 checklist

R-MID-1 第 24 次系统化：

| # | 文件 | 改动 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | AdminAuditActionType 追加 `'video.manual_add'` |
| 2 | `apps/api/src/services/AuditLogService.ts` | ACTION_TYPES 追加 |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | EXPECTED_ACTION_TYPES 追加 |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | PAYLOAD_REQUIRED + PAYLOAD_ASSERTION_REQUIRED 各追加 |
| 5 | `apps/api/src/routes/admin/videos.ts` | POST /admin/videos handler 重构 + audit |
| 6 | `tests/unit/api/video-manual-add-audit.test.ts` | 20 用例新测试文件 |
| 7 | `docs/changelog.md` | R-MID-1 第 24 次系统化备注 |

TARGET_KINDS 不需改动（复用 `'video'` CHECK 13 种已含）。

---

### 7. 测试 surface（20 用例）

| # | 类别 | 用例 |
|---|------|------|
| 1-5 | Happy path CRUD | 最小 3 字段 / 全字段 / publishMode 3 路径（draft/staging/published） |
| 6-9 | 重复检测 | 匹配 catalog 无 force → 409 / 含 detail / force=true 成功 / 不同 type 不冲突 / year=null 不匹配 |
| 10-12 | catalog 同步 | 新建 catalog metadataSource='manual' / 复用 imdbId 精确匹配 / locked_fields 自动加锁 |
| 13-16 | Audit payload | happy path actionType/targetKind/targetId/payload 完整断言 / 422 不写 audit / 403 不写 / 409 不写 |
| 17-19 | 422 validation | title>200 / type 非枚举 / year<1900 |
| 20 | 权限 | 未登录 → 401 |

文件：`tests/unit/api/video-manual-add-audit.test.ts`

---

### 8. 实施 follow-up 拆解

**CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP**（~2.5h / 12 文件）：

| 子步骤 | 文件数 | 工时 |
|--------|--------|------|
| 8-A R-MID-1 4 真源同步 | 4 | 20 min |
| 8-B VideoService.create 重构（findOrCreate 集成 + publishMode + 重复检测）| 2 | 40 min |
| 8-C Route zod + handler 重构 + audit | 1 | 20 min |
| 8-D 单测 20 用例 | 1 | 30 min |
| 8-E 前端 VideoEditDrawer 双模式 + 按钮 enable | 2-3 | 40 min |
| 8-F changelog + commit | 1 | 5 min |

按 CLAUDE.md「范围 > 5 项」拆 -A 后端（8-A..D，5 文件） + -B 前端（8-E，3 文件）2 张子卡。

---

### 9. 风险（4 条）

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| R-145-1 | catalog 重复创建（findOrCreate 对手动 typo 精度不足）| 中 | D-145-2 重复检测 + force=true 二次确认 + Drawer 编辑模式可修正 |
| R-145-2 | publishMode='published' 绕过审核 | 低 | 仅 moderator+admin / audit 记录可追溯 |
| R-145-3 | metaScore 误差（仅 3 必填字段） | 低 | 后台定时重算 + Drawer 编辑补齐自动提升 |
| R-145-4 | Drawer 创建/编辑模式 form state 冲突 | 低 | useEffect 依赖 videoId 重置（现有 EMPTY_FORM 已覆盖） |

---

### 10. N1 候选

**N1-145-1（批量 CSV 导入）**：admin 反馈手动添加 > 10 条/周时触发。POST /admin/videos/batch-import + CSV parser + progress。

**N1-145-2（模板预填）**：admin 反馈重复填写相同元数据模式时触发。前端 localStorage 模板存储（类似 FilterPreset 初始方案）。

---

### 11. 评级

| 维度 | 评分 | 理由 |
|------|------|------|
| 方案完整性 | A | 8 D-N 决策覆盖字段/重复/catalog/状态/audit/ErrorCode/前端/ADR 关联 |
| 与现有架构对齐 | A | 零新 ErrorCode / 零新依赖 / 零新概念；复用 MediaCatalogService/R-MID-1/AuditLogService/findOrCreate 全栈 |
| 关联 ADR 实证 | A | 7 项实证（3/109/110/118/121/139/144）|
| 实施可行性 | A | 12 文件拆 -A/-B 子卡；20 测试 surface 覆盖完整；Service 重构 + zod 替换可独立 PR |
| 扩展预留 | A- | publishMode 可扩 'scheduled'；minimum 字段集可增减；N1 批量导入路径复用核心 Service |
| 风险控制 | A | 4 风险全低/中 + Drawer 双模式状态隔离 + 重复检测兜底 |

**推荐评级：A**

理由：方案 C 最小 3 字段对齐 crawler 实证（year=null 8%）；方案 B 重复检测复用 findOrCreate 5 步匹配；方案 C publishMode 三路径给 admin 完整控制（默认 staging 安全）；零新 ErrorCode / 零新 migration / R-MID-1 第 24 次系统化遵循已建立 7 文件 checklist；VideoEditDrawer 双模式复用避免组件膨胀。同时修复现有 POST /admin/videos 6 项技术债。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A**：按本 ADR 后端实施（4 R-MID-1 真源 + VideoService.create 重构 + Route zod + 20 测试）
- **CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B**：前端 VideoEditDrawer 双模式 + 按钮 enable



## ADR-146 — admin webhook 通知触发协议（事件订阅 + HMAC 签名 + Dispatcher fire-and-forget + R-MID-1 第 25 次系统化）

**状态**：Accepted
**日期**：2026-05-22
**作者**：arch-reviewer (claude-opus-4-7)
**关联 GAP**：`#G-settings-webhook-impl`（P3 — 字段存储有效但后端零发送逻辑）
**关联 follow-up**：CHG-SN-8-FUP-WEBHOOK-IMPL-EP（实施卡）
**关联任务**：CHG-SN-8-FUP-WEBHOOK-IMPL-ADR（本卡 ADR 起草）

---

### 1. 背景与问题

**现状**：NotificationsTab 已暴露 webhookEnabled / webhookUrl / webhookSecret 三字段写入 KV；grep 实证 `apps/api/src/` + `apps/worker/src/` 0 命中 `sendWebhook` 等 — 字段存了但零发送逻辑。已加 warn banner（CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL）。

**用户场景**：采集失败 / R2 配额告警 / 审核积压 / 用户投稿新增 / 批量操作完成。

**修复必要性**：P3 — KV/逻辑漂移已通过 warn banner 缓解，能力缺口仍需 ADR 定义触发协议后实施。

---

### 2. 范围与不在范围

**本 ADR 决定**：事件订阅模型 / 事件枚举 + 命名规约 / 触发模式 / HMAC 签名协议 / 重试策略 / R-MID-1 第 25 次 / 触发点接入 / 测试端点。

**不在范围**：实施 / 多 webhook 端点（N1）/ mTLS / Slack/Discord SDK / 事件订阅 UI 详细（留 EP）/ 新数据库表（零 migration）。

---

### 3. D-N 决策清单

#### D-146-1 事件订阅模型

| 维度 | A: 全 enable 单 webhook 全推 | B: 事件 enum + 用户多选订阅 | C: 多 webhook 配置（每 webhook 一组订阅）|
|------|---|---|---|
| 与现有单 URL+secret 一致 | 对齐 | **对齐** | 偏离（需新表）|
| admin 可控性 | 差（噪音高） | **优** | 优 |
| UI 改造 | 零 | **小**（checkbox 组） | 大（CRUD 列表）|
| KV 兼容 | 对齐 | **新增 1 KV key 数组** | 偏离 |
| 实施成本 | 极低 | **低** | 高 |

**选择：方案 B**。新增 1 KV `notification_webhook_events`（JSON 数组）存订阅事件 enum；空数组/undefined = opt-in 不推任何事件（安全默认）。

#### D-146-2 事件类型枚举

**命名规约**：`<module>.<resource>.<verb>` 三段式（对齐 admin audit actionType 先例）。

**首版 5 类 enum**：

| # | 事件 | 触发条件 |
|---|------|---------|
| 1 | `crawler.run.failed` | CrawlerRunService 标记 run status=failed |
| 2 | `storage.r2.alert` | R2 quota > 80% 阈值 |
| 3 | `moderation.pending.threshold` | pending_review count > N（默认 50）|
| 4 | `submission.created` | UserSubmissionService.create 成功 |
| 5 | `video.batch.complete` | batchPublish / 批量导入完成 |

类型定义 `packages/types/src/system.types.ts` 新增 `WebhookEventType` 联合。

#### D-146-3 触发模式

| 维度 | A: API 层 fire-and-forget Dispatcher | B: route 内联 fetch | C: event bus |
|------|---|---|---|
| 主请求阻塞 | **不阻塞** | 阻塞 | 不阻塞 |
| 复用现有基础设施 | **复用 retry-backoff 模式 + AuditLogService 模式** | 无 | 需新库 |
| 新依赖 | **零**（不用 bull 队列 / 不需 Redis） | 零 | +1 库 |

**选择：方案 A（修正版）**。**不使用 bull 队列**（bull 已装但需 Redis 连接，项目当前无 Redis 依赖）。改用 `WebhookDispatcher.enqueue()` API 层 fire-and-forget 异步执行 — 与 AuditLogService.write 同模式。低频场景（日均 < 50 次）API 进程内异步足矣。N1 候选：高频时（日均 > 1000）升级 bull + Redis。

#### D-146-4 HMAC 签名协议

**算法**：HMAC-SHA256(rawBody, webhookSecret)

**Headers**（4 自定义 + 1 标准）：
- `X-Resovo-Signature: sha256=<hex>`（GitHub webhook 惯例前缀）
- `X-Resovo-Event: <事件类型>`
- `X-Resovo-Delivery: <UUIDv4>`（幂等 ID）
- `X-Resovo-Timestamp: <ISO 8601 UTC>`（replay 防护）
- `User-Agent: Resovo-Webhook/1.0`

**Body**: `{ event, deliveryId, occurredAt, payload }` JSON

**secret 空字符串**：不发 X-Resovo-Signature header（UI 应建议配置）。

#### D-146-5 重试策略

复用 lib/retry-backoff.ts 指数退避理念（参数独立适配 webhook）：
- 最大 3 次重试（含首次共 4 次）
- 退避 `[5s, 15s, 45s]` + 0-2s jitter
- HTTP 超时 30s（AbortController）
- 5xx/超时重试 / 4xx 不重试 / 2xx 成功
- 总耗时 ~3.5 min 上限
- 最终失败写 R-MID-1 `system.webhook_send_failed` audit + baseLogger.warn

#### D-146-6 R-MID-1 第 25 次系统化

**新增 actionType 1 个**：`system.webhook_send_failed`
- targetKind: `system`（复用 CHECK 13 种已含）
- actorId: 触发原始事件的 actor（系统事件用 SYSTEM_ACTOR_ID UUID 常量）
- before_jsonb: null
- after_jsonb: `{ event, deliveryId, webhookUrl, attempts, lastHttpStatus, lastError, payload, totalDurationMs }`

**仅记失败不记成功**：成功是正常流程无审计价值；失败是运维关注点。

#### D-146-7 触发点接入（5 处）

| # | 触发点 | 事件 | payload 关键字段 |
|---|--------|------|----------------|
| 1 | CrawlerRunService 标记 failed | `crawler.run.failed` | runId, siteKey, errorMessage, failedAt |
| 2 | R2 quota check（新 cron 或扩展 maintenanceScheduler）| `storage.r2.alert` | usagePercent, usageBytes, threshold |
| 3 | ModerationStatsAggregator threshold（cron 1h 间隔）| `moderation.pending.threshold` | pendingCount, threshold, oldestPendingAt |
| 4 | UserSubmissionService.create 成功 | `submission.created` | submissionId, title, submittedBy |
| 5 | StagingPublishService.batchPublish 完成 | `video.batch.complete` | operationType, totalCount, successCount, failedCount |

**统一调用**：`WebhookDispatcher.enqueue(event, payload, actorId)`。

**阈值类事件 debounce**：触发点 2/3 用 KV `notification_webhook_last_alert_{event}` 记录上次告警时间 + 1h cooldown 防风暴。

#### D-146-8 关联 ADR 引用

| # | ADR | 关联 |
|---|-----|------|
| 1 | ADR-003 | JWT 双 Token + fastify.authenticate（测试端点）|
| 2 | ADR-109 | admin_audit_log schema（webhook_send_failed 写入同表）|
| 3 | ADR-110 | ErrorCode 系统（复用 VALIDATION_ERROR/FORBIDDEN；零新增）|
| 4 | ADR-118 | audit 视图协议（ACTION_TYPES/TARGET_KINDS 真源）|
| 5 | ADR-121 | R-MID-1 7 文件框架（第 25 次系统化）|
| 6 | ADR-139 | fastify.requireRole（测试端点 admin only）|
| 7 | ADR-145 | 最近 ADR 范式参考（同类 R-MID-1 + 零新基础设施）|

---

### 4. 端点契约

### 端点契约

1 个新端点（admin 测试 webhook 连通性），preHandler: `[authenticate, requireRole(['admin'])]`：

| # | Method | Path | 权限 | Body | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|------|----------------|---------------|-----|
| 1 | POST | `/admin/webhook/test` | admin | Body: `{}` (空对象，从 KV 读 url+secret) | `{ data: { success: boolean, httpStatus: number \| null, latencyMs: number, error: string \| null } }` (200) | 无 | ADR-146 |

**side-effects**：读 KV → 构造测试 payload `{ event: 'webhook.test', deliveryId, occurredAt, payload: { message } }` → HMAC 签名 → 单次 fetch（不重试 / 30s 超时 / SSRF 校验）→ 返回 success/status/latency。**不写 audit log**（测试发送非业务操作）。

**前置校验**：webhookUrl 空 → 422 VALIDATION_ERROR；SSRF 校验失败 → 422 VALIDATION_ERROR `'Webhook URL 不安全'`。

**错误码全复用**（零新增）：401/403/422。

---

### 5. WebhookDispatcher 实现 sketch

```typescript
// apps/api/src/services/WebhookDispatcher.ts

class WebhookDispatcher {
  constructor(private db: Pool, private auditSvc: AuditLogService) {}

  // Fire-and-forget 入口；各 Service 调用此方法
  enqueue(event: WebhookEventType, payload: Record<string, unknown>, actorId: string): void {
    this.dispatch(event, payload, actorId).catch((err) => {
      baseLogger.warn({ err, event }, '[WebhookDispatcher] unhandled')
    })
  }

  private async dispatch(...): Promise<void> {
    // 1. 读 KV: enabled + url + secret + subscribedEvents
    const settings = await readWebhookSettings(this.db)
    if (!settings.enabled || !settings.url) return
    if (settings.subscribedEvents.length > 0 && !settings.subscribedEvents.includes(event)) return

    // 2. SSRF 防御
    if (!isAllowedWebhookUrl(settings.url)) {
      baseLogger.warn({ url: settings.url }, '[WebhookDispatcher] SSRF blocked')
      return
    }

    // 3. 构造 body + HMAC
    const body = JSON.stringify({ event, deliveryId, occurredAt, payload })
    const signature = settings.secret
      ? 'sha256=' + crypto.createHmac('sha256', settings.secret).update(body).digest('hex')
      : null

    // 4. retry 循环（4 次尝试 / [5s,15s,45s] backoff + jitter / 30s timeout）
    const BACKOFF = [5_000, 15_000, 45_000]
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const res = await fetch(settings.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30_000) })
        if (res.ok) return  // 2xx 成功
        if (res.status >= 400 && res.status < 500) break  // 4xx 不重试
      } catch (err) { /* 网络/超时 → 重试 */ }
      if (attempt < 3) await sleep(BACKOFF[attempt] + Math.random() * 2000)
    }

    // 5. 最终失败 R-MID-1 audit
    this.auditSvc.write({
      actorId, actionType: 'system.webhook_send_failed', targetKind: 'system',
      targetId: null, beforeJsonb: null,
      afterJsonb: { event, deliveryId, webhookUrl: settings.url, attempts, lastHttpStatus, lastError, payload, totalDurationMs },
    })
  }
}
```

POST /admin/webhook/test handler：读 KV → SSRF 校验 → 构造测试 payload → 单次 fetch（不重试）→ 200 返回 success/httpStatus/latencyMs。

---

### 6. R-MID-1 7 文件 checklist

R-MID-1 第 25 次系统化：

| # | 文件 | 改动 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | AdminAuditActionType +`'system.webhook_send_failed'` |
| 2 | `packages/types/src/system.types.ts` | 新增 WebhookEventType 联合 + SystemSettingKey +`'notification_webhook_events'` |
| 3 | `apps/api/src/services/AuditLogService.ts` | ACTION_TYPES 同步 +1 |
| 4 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | EXPECTED_ACTION_TYPES +1 |
| 5 | `tests/unit/api/audit-log-coverage.test.ts` | PAYLOAD_REQUIRED + PAYLOAD_ASSERTION_REQUIRED 各 +1 |
| 6 | `apps/api/src/services/WebhookDispatcher.ts` | 新文件：enqueue + dispatch + HMAC + retry + audit |
| 7 | `docs/changelog.md` | R-MID-1 第 25 次系统化备注 |

TARGET_KINDS 不需改动（复用 `'system'` CHECK 13 种已含）。

---

### 7. 测试 surface（16 用例）

文件：`tests/unit/api/webhook-dispatcher.test.ts` + `tests/unit/api/webhook-test-endpoint.test.ts`

| # | 类别 | 用例 |
|---|------|------|
| 1-2 | HMAC | secret 非空 → 签名手工对比 / secret 空 → 不发送 header |
| 3-4 | 重试 | 5xx 重试 3 次 / mock timer 验证 backoff 间隔 |
| 5-6 | 4xx 不重试 | 400/404 仅 1 次 |
| 7 | 5xx 重试 | 503 重试 3 次 |
| 8 | 超时 | 30s 超时 → AbortError 视为可重试 |
| 9 | 最终失败 audit | 4 次失败后 audit afterJsonb 7 字段完整 |
| 10-12 | 订阅过滤 | 不含当前 event 不发 / 空数组不发 / 含 event 正常发 |
| 13-14 | SSRF | 169.254.169.254 / localhost 不发 |
| 15-16 | 测试端点 | URL 未配置 → 422 / 正常 URL → 200 返回 success/status/latency |

---

### 8. 实施 follow-up 拆解

**CHG-SN-8-FUP-WEBHOOK-IMPL-EP**（~3h / ~12 文件）：

| 子步骤 | 文件 | 工时 |
|--------|------|------|
| 8-A R-MID-1 4 真源同步 | 4 | 20 min |
| 8-B WebhookDispatcher 核心 + SSRF 校验 | 1 | 40 min |
| 8-C POST /admin/webhook/test route | 1 | 15 min |
| 8-D 5 触发点接入 | 3-5 | 25 min |
| 8-E NotificationsTab 事件订阅 checkbox + KV 读写 | 2 | 30 min |
| 8-F 16 单测 | 2 | 30 min |
| 8-G changelog + commit | 1 | 5 min |

按「范围 > 5 项」拆 -A 后端核心（8-A..D，~8 文件） + -B 前端 + 测试（8-E..F，~4 文件）。

**触发点 2/3 可选**：若现有 maintenanceScheduler 不含 R2 / pending threshold 检查，实施时可先实装 1/4/5（直接接入已有 Service），2/3 作为独立子卡延后。

---

### 9. 风险（4 条）

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| R-146-1 | **SSRF** — webhookUrl 指向内网/云元数据端点 | 高 | `isAllowedWebhookUrl()` 5 层防御：(1) https only (2) 私有 IP RFC 1918 拒绝 (3) loopback 127.0.0.0/8 + ::1 拒绝 (4) link-local 169.254.0.0/16 拒绝 (5) metadata hostname 拒绝；独立 `apps/api/src/lib/ssrf-guard.ts` 模块 |
| R-146-2 | **secret 泄露** — 明文 KV 存储 | 中 | (1) baseLogger redact (2) GET settings response mask 尾 4 位 (3) N1 长远 AES-256 加密 |
| R-146-3 | **重试风暴** — 目标长时 5xx + 高频事件 → 内存/连接挤占 | 中 | (1) 同 URL 并发上限 3 (2) 阈值事件 1h debounce (3) backoff 足够大 (4) 总耗时 ~3.5 min 上限 |
| R-146-4 | **触发点性能** — 5 处加 KV 读 | 低 | (1) fire-and-forget 不阻塞 (2) 进程内 LRU 缓存 60s (3) P3 低频可忽略 |

---

### 10. N1 候选

**N1-146-1（多 webhook 端点）**：3+ admin 反馈多端点需求时触发。新建 `webhook_endpoints` 表 + Dispatcher 多端点路由。

**N1-146-2（webhook 投递历史）**：admin 调试连通性时反馈 audit 不够直观。新表 `webhook_delivery_log` 或扩展 audit 查询。

---

### 11. 评级

| 维度 | 评分 | 理由 |
|------|------|------|
| 方案完整性 | A | 8 D-N 覆盖订阅/枚举/触发/HMAC/重试/audit/接入/ADR 关联 |
| 与现有架构对齐 | A | 零新 ErrorCode / 零新依赖 / 零新 migration / 零新表；复用 AuditLogService/retry-backoff/KV/R-MID-1 |
| 关联 ADR 实证 | A | 7 项实证（3/109/110/118/121/139/145）|
| 实施可行性 | A | ~12 文件拆 -A/-B；16 测试 surface；Dispatcher 独立模块 |
| SSRF 防御 | A | 5 层防御独立模块覆盖主要攻击向量 |
| 扩展预留 | A- | enum 增值 + KV 追加可扩；N1 多端点不影响 Dispatcher 接口 |
| 风险控制 | A | 4 风险 1 高 3 中低 + 完整缓解 |

**推荐评级：A**

方案 B 事件 enum 对齐现有单 URL KV（零新表）；方案 A 修正版 fire-and-forget Dispatcher 避免引入 Redis（bull 已装但需 Redis 部署）；HMAC-SHA256 对齐 GitHub 行业惯例；retry 模式复用 retry-backoff 理念；R-MID-1 第 25 次遵循 7 文件 checklist；SSRF 5 层防御独立模块；唯一新端点 POST /admin/webhook/test 满足 verify-endpoint-adr。

---

**后续解锁卡**：
- **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A**：按本 ADR 后端实施（R-MID-1 4 真源 + WebhookDispatcher + ssrf-guard + 5 触发点接入 + POST /admin/webhook/test + 16 测试）
- **CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B**：前端 NotificationsTab 事件订阅 checkbox + 测试按钮接入



## ADR-147 admin shell notification hub MVP（audit_log 派生 + bull queue 聚合 + 前端 polling 闭合 mock stub）

**状态**：Accepted
**日期**：2026-05-23
**作者**：arch-reviewer (claude-opus-4-7) — 评级 **A PASS**
**关联 GAP**：`#G-shell-notifications`（P1 — admin-shell-client.tsx mockNotifications/mockTasks stub 未接真端点）
**关联任务**：CHG-SN-8-FUP-SHELL-NOTIFICATIONS-ADR（本卡 ADR 起草）
**后续解锁卡**：CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-A（后端 + 测试）/ CHG-SN-8-FUP-SHELL-NOTIFICATIONS-EP-B（前端接入）

### 1. 背景与现状

**admin shell mock stub 现状**：

`apps/server-next/src/app/admin/admin-shell-client.tsx:124-130` 使用 `useState` 持有 `mockNotifications` + `mockTasks`（定义于 `apps/server-next/src/lib/shell-data.tsx:72-126`），共 3 条 mock 通知 + 3 条 mock 任务。badge 计数由前端 `.filter(n => !n.read).length` 本地计算。四个交互 callback（`onNotificationItemClick` / `onMarkAllNotificationsRead` / `onCancelTask` / `onRetryTask`）仅做 `setState` 乐观更新，无任何后端交互。

**GAPS.md 登记**：`#G-shell-notifications`（P1，最高优先）— "端点 `/admin/notifications` / `/admin/system/jobs` 不存在，需先通知 Hub MVP ADR"。

**受影响消费方**：
1. `packages/admin-ui/src/shell/notification-drawer.tsx` — 消费 `NotificationItem[]` 渲染通知列表
2. `packages/admin-ui/src/shell/task-drawer.tsx` — 消费 `TaskItem[]` 渲染任务列表
3. `apps/server-next/src/app/admin/admin-shell-client.tsx` — 编排层，当前持有 mock 数据 + 4 个 callback
4. `apps/server-next/src/lib/shell-data.tsx` — mock 数据定义（MVP 后可删除 mockNotifications / mockTasks 两个导出）

**真源类型（已稳定，不需改动）**：
- `NotificationItem`：`packages/admin-ui/src/shell/types.ts:104-114`（7 字段：id / title / body / level / createdAt / read / href）
- `TaskItem`：`packages/admin-ui/src/shell/types.ts:118-130`（7 字段：id / title / status / progress / startedAt / finishedAt / errorMessage）

**现有基础设施可复用**：
1. `admin_audit_log` 表（ADR-109 + ADR-118）— 39 种 actionType，13 种 targetKind；已有 `idx_admin_audit_log_action_created` 索引
2. `WebhookDispatcher`（ADR-146）— fire-and-forget 异步模式可复用范式
3. bull queues（`apps/api/src/lib/queue.ts`）— 5 个队列 + `queue.getJobs()` / `getJobCounts()` API
4. `maintenanceScheduler` + `GET /admin/system/scheduler-status`（CHG-408）— 6 个定时器状态
5. `crawler_runs` 表 — 记录采集运行历史 + 7 种 status

### 2. 决策要点

#### D-147-1 notifications 数据源选型

**选择：方案 A（audit_log 子集映射）**。notifications 数据 100% 来自 `admin_audit_log` 按白名单 actionType 过滤 + level 推断映射。

理由：
1. audit_log 已覆盖全部 admin 写操作（39 种 actionType）
2. 零新表 / 零 migration / 零双写 — 最大化复用现有基础设施
3. per-user read 状态 MVP 不需要（D-147-4 详述）

**白名单 actionType 映射（首版 8 类）**：

| # | actionType | level | title 模板 | href |
|---|-----------|-------|-----------|------|
| 1 | `system.webhook_send_failed` | `danger` | "Webhook 投递失败" | `/admin/settings` |
| 2 | `staging.batch_publish` | `info` | "批量上架完成" | `/admin/videos` |
| 3 | `video.manual_add` | `info` | "手动添加视频" | `/admin/videos` |
| 4 | `video.merge` | `info` | "视频合并完成" | `/admin/merge` |
| 5 | `user_submission.action` | `info` | "用户投稿处理" | `/admin/user-submissions` |
| 6 | `system.cache_clear` | `warn` | "缓存已清除" | `/admin/settings` |
| 7 | `system.settings_update` | `info` | "系统设置已更新" | `/admin/settings` |
| 8 | `system.audit_rollback` | `warn` | "审计回滚执行" | `/admin/audit` |

**N1 升级路径**：N1-A 独立 `admin_notifications` 表存 per-user read 指针；N1-B 白名单 KV 可配化

#### D-147-2 notifications 推送模型

**选择：方案 A（前端 polling 60s 间隔）**。SWR `refreshInterval: 60_000` 一行配置完成。

理由：admin 同时在线 < 10 人；60s 延迟可接受；零新依赖。

**N1 升级路径**：SSE（`GET /admin/notifications/stream`） — 同时在线 > 20 或亚秒需求时触发

#### D-147-3 tasks 数据源

**选择：方案 C 有主次**。主源 = CrawlerRun 表（最近 20 条 3 天内）+ 副源 = bull queue active jobs（maintenanceQueue + crawlerQueue active/waiting）。scheduler-status 不纳入（已有独立端点）。

**字段映射**：CrawlerRun.status → TaskItem.status：`{queued→'pending', running→'running', success→'success', failed/partial_failed/cancelled→'failed', paused→'pending'}`；bull job 添加 `bull-${queueName}-${jobId}` id 前缀避免冲突。

**合并去重**：CrawlerRun 优先（业务语义更丰富）。

#### D-147-4 已读/未读状态

**选择：方案 A（localStorage）**。MVP 用 localStorage 存 `admin_notification_lastViewedAt` ISO 时间戳。`read` 字段由前端计算：`notification.createdAt <= lastViewedAt → read=true`。后端统一返回 `read: false`。

理由：admin 后台单人使用占多数；跨设备同步需求弱；零 migration / 零后端改动。

**N1 升级路径**：`admin_notification_reads(user_id, source_type, source_id, read_at)` 表

#### D-147-5 列表上限/分页

- notifications：最近 50 条 + 7 天窗口 + 不分页（meta.total 告知前端）
- tasks：CrawlerRun 20 条 + bull active 10 条上限 + 3 天窗口 + 不分页
- badge：前端从两端点 response 各自计算（不设独立 badge 端点）

#### D-147-6 端点契约

**端点 1：`GET /admin/notifications`**
- preHandler: `[authenticate, requireRole(['admin', 'moderator'])]`
- query: `limit?` (default 50, max 100) / `since?` (ISO 8601, default -7d)
- response 200: `{ data: NotificationItem[], meta: { total, limit, since } }`
- 错误码：401 / 403（零新增）

**端点 2：`GET /admin/system/jobs`**
- preHandler: `[authenticate, requireRole(['admin', 'moderator'])]`
- query: `limit?` (default 20, max 50) / `since?` (ISO 8601, default -3d)
- response 200: `{ data: TaskItem[], meta: { total, limit, since, queueCounts: { crawler: {waiting, active}, maintenance: {waiting, active} } } }`
- 错误码：401 / 403 / 503（Redis 不可用降级：仅返回 CrawlerRun 数据 + meta.degraded=true）

#### D-147-7 R-MID-1 范式应用

**方案 A 纯 audit_log 映射 → 零 R-MID-1 新增**。不新增 actionType / targetKind / migration。两个端点均为纯读取，无写操作。

#### D-147-8 关联 ADR 引用

| # | ADR | 关联 |
|---|-----|------|
| 1 | ADR-103a | admin-ui Shell SSOT — NotificationItem/TaskItem 类型契约 |
| 2 | ADR-109 | admin_audit_log schema — notifications 数据源 |
| 3 | ADR-118 | admin audit 视图协议 — ACTION_TYPES/TARGET_KINDS 真源 |
| 4 | ADR-121 | R-MID-1 7 文件框架 — 本 ADR 零新增 |
| 5 | ADR-146 | WebhookDispatcher — system.webhook_send_failed 白名单 |
| 6 | ADR-145 | video.manual_add 白名单 |
| 7 | ADR-139 | fastify.requireRole — 端点权限守卫 |

### 3. 数据库 schema

**方案 A 选中 → 零新 migration / 零新表**。

notifications 完全派生自 `admin_audit_log`，tasks 完全派生自 `crawler_runs` + bull queue Redis API。

**N1 schema 预留**（方案 B 启动时）：

```sql
-- 073_admin_notification_reads.sql (N1，仅参考)
CREATE TABLE IF NOT EXISTS admin_notification_reads (
  id           BIGSERIAL    PRIMARY KEY,
  user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type  TEXT         NOT NULL CHECK (source_type IN ('audit_log', 'custom')),
  source_id    TEXT         NOT NULL,
  read_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, source_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON admin_notification_reads(user_id, read_at DESC);
```

### 4. 端点契约

### 端点契约

| # | Method | Path | 权限 | Query | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|-------|----------------|---------------|-----|
| 1 | GET | `/admin/notifications` | admin, moderator | `limit?, since?` | `{ data: NotificationItem[], meta: { total, limit, since } }` (200) | 无 | ADR-147 |
| 2 | GET | `/admin/system/jobs` | admin, moderator | `limit?, since?` | `{ data: TaskItem[], meta: { total, limit, since, queueCounts } }` (200) | 无 | ADR-147 |

**side-effects**：两个端点均为纯读取，无写操作，不写 audit log。

### 5. R-MID-1 checklist

**方案 A 选中 → R-MID-1 零新增**。不修改任何 R-MID-1 真源文件。

### 6. 测试 surface（14 条）

文件：`tests/unit/api/notification-service.test.ts` + `tests/unit/api/task-aggregator.test.ts` + `tests/unit/api/notification-endpoint.test.ts` + `tests/unit/api/jobs-endpoint.test.ts`

| # | 类别 | 用例 |
|---|------|------|
| 1 | 白名单过滤 | 白名单内 actionType → 返回对应 NotificationItem |
| 2 | 白名单过滤 | 白名单外 actionType → 不出现在结果 |
| 3 | level 映射 | system.webhook_send_failed → level: 'danger' |
| 4 | level 映射 | staging.batch_publish → level: 'info' (默认) |
| 5 | href 映射 | 各 actionType → 对应 href 路径 |
| 6 | 时间窗口 | since 参数生效（8 天前数据不返回） |
| 7 | limit 上限 | limit=5 只返回 5 条 / limit 超 100 截断 |
| 8 | CrawlerRun 映射 | status=running → TaskItem.status='running' |
| 9 | CrawlerRun 映射 | status=failed → TaskItem.status='failed' + errorMessage |
| 10 | bull 降级 | Redis 不可用 → 仅 CrawlerRun + meta.degraded=true |
| 11 | bull active job | active job → TaskItem 含 progress |
| 12 | 端点 auth | 未登录 → 401 / 无权限 → 403 |
| 13 | 端点 notifications | 正常请求 → 200 + data + meta.total |
| 14 | 端点 jobs | 正常请求 → 200 + data + meta.queueCounts |

### 7. 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| R-147-1 | audit_log 白名单遗漏（新增 actionType 后忘记加入） | 中 | ReadonlySet 类型安全 + 头注释提示 + 测试 #1-2 覆盖 + N1 KV 可配化 |
| R-147-2 | polling 频率 vs DB 负载 | 低 | admin < 10 人 + 60s 间隔 = 0.17 QPS/人 + idx 覆盖 + limit 50 |
| R-147-3 | bull Redis 不可用 | 中 | try-catch 降级 + meta.degraded=true + 返回 CrawlerRun 数据 |
| R-147-4 | CrawlerRun + bull job 去重不精确 | 低 | CrawlerRun 优先 + bull id 前缀 + 短暂重复对 UX 影响可忽略 |
| R-147-5 | localStorage 已读状态丢失 | 低 | MVP 可接受 + N1 升级 DB per-user read |

### 8. 工时估算

**EP-A：后端核心 + 测试**（~0.20w / ~10 文件）

| 子步骤 | 工时 |
|--------|------|
| NotificationService + 白名单 + 映射 | 30 min |
| TaskAggregator + CrawlerRun 映射 + bull 降级 | 40 min |
| 2 route（notifications / jobs）+ zod schema | 40 min |
| types response 信封 | 10 min |
| 14 单测（4 文件） | 65 min |
| changelog + commit | 5 min |

**EP-B：前端接入**（~0.10w / ~4 文件）

| 子步骤 | 工时 |
|--------|------|
| useAdminNotifications SWR hook | 20 min |
| useAdminTasks SWR hook | 20 min |
| admin-shell-client.tsx 改造（mock → SWR + localStorage） | 25 min |
| shell-data.tsx 清理 mock exports | 5 min |

**总计**：~0.30w

**拆卡建议**：EP-A + 测试合一卡（~10 文件 / ~2.5h，超 5 项但同质化属于"测试 + 实现"成对，不触发 PATCH 拆分）；EP-B 独立前端卡（~4 文件 / ~1h）。

### 9. N1 follow-up

- **N1-147-1（per-user read 状态 DB 化）**：admin 团队 3+ 人协作时触发；新建 `admin_notification_reads` 表 + 2 PATCH 端点 + R-MID-1 `notification.dismiss`/`notification.mark_all_read`
- **N1-147-2（白名单 KV 可配化）**：admin 反馈触发；`notification_action_whitelist` KV + Settings 页 UI
- **N1-147-3（SSE 实时推送）**：同时在线 > 20 时触发；`GET /admin/notifications/stream` + 前端 EventSource
- **N1-147-4（tasks 进度增强）**：CrawlerRun progress 估算 + enrichmentQueue/imageHealthQueue 纳入

### 10. 验证清单

commit 时必跑：

| # | 命令 | 门禁 |
|---|------|------|
| 1 | `npm run typecheck` | 零错误 |
| 2 | `npm run lint` | 零错误 |
| 3 | `npm run test -- --run` | 全部通过（含新增 14 用例） |
| 4 | `npm run verify:adr-contracts` | PASS |
| 5 | `npm run verify:endpoint-adr` | PASS（2 新端点登记 ADR-147） |

EP-B 额外手动验证：admin shell 通知 Drawer 真数据 / badge 计数正确 / 任务 Drawer 展示 CrawlerRun

### 11. 关联 ADR

详见 D-147-8 表（7 条关联 ADR-103a / -109 / -118 / -121 / -139 / -145 / -146）。

**自评：A PASS** — 8 条决策全部含 N1 升级路径；MVP 范围合理（零新表/零依赖/零 R-MID-1 新增）；现有基础设施复用最大化；14 条测试 surface 完整。无 BLOCKER。

---


## ADR-148 session 3 KV 字段中间件消费协议（timeoutMinutes MVP + maxConcurrent / extendOnActivity N1 延后）

**状态**：Accepted
**日期**：2026-05-23
**作者**：arch-reviewer (claude-opus-4-7) — 评级 **A PASS**
**关联 GAP**：`#G-settings-session-fields-consume`（P2 安全 — 3 KV 仅存储未生效）
**关联任务**：CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-ADR
**后续解锁卡**：CHG-SN-8-FUP-SESSION-FIELDS-CONSUME-EP-A（后端实施 + 12 单测 + R-148-4 user:rca TTL 同步修复）

### 1. 背景与现状

3 个 session KV 已落地（migration 066 + siteConfig zod + LoginSessionsTab UI）但运行时未消费：

| KV key | 类型 | 默认值 | zod 校验 | 运行时消费 |
|--------|------|--------|----------|-----------|
| `session_timeout_minutes` | int | 60 | `.min(5).max(1440)` | **未消费** — signAccessToken 硬编码 '15m' |
| `session_max_concurrent` | int | 5 | `.min(1).max(50)` | **未消费** — 无 user_sessions 表 |
| `session_extend_on_activity` | bool | true | `.boolean()` | **未消费** — authenticate plugin 不刷 TTL |

**4 处 signAccessToken caller**（apps/api/src/services/UserService.ts:92/114/144/176）：register / login / refresh / devLogin。

**现有可复用基础设施**：getSetting / Redis (ADR-139 user:rca cache) / system.settings_update audit。

### 2. 决策要点

#### D-148-1 timeoutMinutes 消费路径

**选择：方案 C（UserService.getSessionTimeoutMinutes private helper + 4 处 caller 复用）**。

理由：关注点分离（signAccessToken 是纯 JWT 工具，不应耦合 DB）+ DRY + 可测试性 + 向后兼容。

设计：
- `signAccessToken(payload, expiresIn = ACCESS_TOKEN_EXPIRES_IN)` — 可选 expiresIn 参数（默认 '15m' 向后兼容）
- `UserService.getSessionTimeoutMinutes()` private helper — 查 KV + clamp + NaN 降级
- 4 处 caller 改：`const ttl = await this.getSessionTimeoutMinutes(); signAccessToken(payload, \`${ttl}m\`)`

#### D-148-2 KV 缓存层

**选择：方案 A（每次查 DB）**。理由：login + register + refresh QPS < 10（日活 1k 用户），PK 命中查询 < 1ms；零基础设施依赖；YAGNI。

**N1 升级路径**：QPS > 100 时升级 Redis cache EX 60s（同 ADR-139 user:rca 范式）。

#### D-148-3 maxConcurrent — 推 N1（不纳入 MVP）

理由：需 user_sessions 表 + 踢出策略 + 跨设备 UX 决策 + R-MID-1 → 独立 ADR 更安全；MVP 范围控制。

EP-B 建议：LoginSessions Tab 加 disabled + tooltip「即将支持」。

#### D-148-4 extendOnActivity — 推 N1（不纳入 MVP）

理由：与 ADR-003 「access token 不存 Cookie」有张力 → 需独立 ADR 评估 X-New-Access-Token header 方案；每请求签 JWT 性能问题；timeoutMinutes 已足够满足核心诉求。

#### D-148-5 KV 误配防护

**选择：方案 C（双重防护）**。zod 守住写入（已有）+ getSessionTimeoutMinutes 内 `Math.max(5, Math.min(1440, x))` clamp（防御直接 DB 修改/migration seed 异常）。

fallback 链：`KV 值 → Number() → NaN 检测 → 默认 60 → clamp [5, 1440]`。

#### D-148-6 KV 单位转换

helper 返回 number（分钟），caller 传 `` `${minutes}m` `` 字符串。与现有 `'15m'` 惯例一致。

#### D-148-7 R-MID-1 范式应用

**零新增**。signAccessToken 读 KV 是读操作；admin 改 KV 已有 system.settings_update actionType 覆盖审计。

#### D-148-8 关联 ADR 引用

| # | ADR | 关联 |
|---|-----|------|
| 1 | ADR-003 | **直接修改** — access token TTL 从硬编码 15m 变为 KV 驱动 |
| 2 | ADR-139 | **R-148-4 兼容性修复** — user:rca Redis TTL 需同步 session_timeout_minutes |
| 3 | ADR-121 | 无变更（零 R-MID-1） |
| 4 | ADR-146 | 同期 KV 消费范式（webhook events KV） |

### 3. 数据库 schema

**零新表，零 migration**。仅消费已有 KV。

### 4. 端点契约

### 端点契约

| # | Method | Path | 权限 | Query | Response `data` | 新增 ErrorCode | ADR |
|---|--------|------|------|-------|----------------|---------------|-----|
| 0 | — | — | — | — | （零新端点；4 现有 /auth/* 端点 access token TTL 行为变化 / 向后兼容）| 无 | ADR-148 |

行为变化：access token `exp` 从 `iat + 900s` (15m) → `iat + session_timeout_minutes * 60` (默认 3600s / 60m)。

向后兼容：前端不解析 exp，仅 401 时 refresh → 兼容。

### 5. R-MID-1 checklist

**不适用** — 零新 actionType / targetKind / 端点 / ErrorCode。

### 6. 测试 surface（12 条）

| # | 测试文件 | 用例 |
|---|---------|------|
| 1 | auth.test.ts | signAccessToken 默认 '15m' → exp-iat=900 |
| 2 | auth.test.ts | signAccessToken '30m' → exp-iat=1800 |
| 3 | auth.test.ts | signAccessToken '5m' → exp-iat=300 |
| 4 | UserService.test.ts | login KV '30' → exp-iat=1800 |
| 5 | UserService.test.ts | register KV '30' → exp-iat=1800 |
| 6 | UserService.test.ts | refresh KV '120' → exp-iat=7200 |
| 7 | UserService.test.ts | devLogin KV '45' → exp-iat=2700 |
| 8 | UserService.test.ts | KV 缺失 → 降级 60min (3600s) |
| 9 | UserService.test.ts | KV 非数字 → 降级 60min |
| 10 | UserService.test.ts | KV < 5 → clamp 5min (300s) |
| 11 | UserService.test.ts | KV > 1440 → clamp 1440min (86400s) |
| 12 | UserService.test.ts | KV = '0' → clamp 5min |

### 7. 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| R-148-1 | KV 误配 → 全员登录立即失效 | 高 | zod + clamp 双重防护 + NaN 降级 |
| R-148-2 | 默认值 15m → 60m 安全窗口扩大 | 中 | ADR-139 实时 role check 不受影响；admin 可调；建议 LoginSessions Tab 提示 |
| R-148-3 | DB 查询性能 | 低 | login + refresh QPS < 10；PK 命中 < 1ms；N1 升 Redis |
| R-148-4 | ADR-139 user:rca Redis TTL 不匹配（权限穿越窗口）| 中 | **EP-A 同步修复**：user:rca TTL 从硬编码 900s 改为 `Math.max(900, session_timeout_minutes * 60)` 秒 |

### 8. 工时估算

**EP-A：后端核心 + R-148-4 修复 + 12 单测**（~0.5w / 7 文件）

| 子项 | 工时 |
|------|------|
| signAccessToken 加可选 expiresIn 参数 | 5 min |
| UserService.getSessionTimeoutMinutes helper + 4 caller 改造 | 30 min |
| clamp + NaN 防护 | 5 min |
| auth.test 3 用例（expiresIn 参数） | 15 min |
| UserService.test 9 用例（KV 消费 + clamp） | 45 min |
| R-148-4：apps/api/src/routes/admin/users.ts user:rca TTL 同步 | 15 min |
| ADR-003 描述更新 + changelog + commit | 15 min |

**EP-B（可选）**：LoginSessions Tab disabled + tooltip 提示（~0.1w / 1 文件）

**总计**：~0.5w（EP-A 必做）+ ~0.1w（EP-B 可选）

**拆卡建议**：EP-A 单卡（7 子项；测试与实现成对，不触发 PATCH 拆分）。EP-B 并入 EP-A 或独立小卡。

### 9. N1 follow-up

- N1-148-1 maxConcurrent 消费（user_sessions 表 + 踢出策略） — 独立 ADR
- N1-148-2 extendOnActivity 消费（authenticate plugin + ADR-003 兼容评估） — 独立 ADR
- N1-148-3 KV 查询 Redis cache（QPS > 100 触发） — D-148-2 升级
- N1-148-4 user:rca TTL 动态化（如未在 EP-A 修复，本卡建议同修） — ADR-139 补丁

### 10. 验证清单

```
npm run typecheck            # signAccessToken 签名 + UserService 改动
npm run lint
npm run test -- --run        # 12 单测 PASS
npm run verify:adr-contracts # 零新端点；无偏离
```

### 11. 关联 ADR

详 D-148-8 表 — ADR-003 / ADR-139 / ADR-121 / ADR-146 共 4 条。

**自评：A PASS** — 8 决策完整；MVP 范围合理（仅 timeoutMinutes）；R-148-4 独立审查增量发现 ADR-139 TTL 不匹配并给出实施卡同步修复建议；12 测试 surface 完整可执行。无 BLOCKER。

---

## ADR-149 — DataTable 表格头入口重设计（列级 ⋯ + 统一矩阵 popover + 列名 toggle 排序 / ADR-103 第 5 次 AMENDMENT）

**状态**：✅ **Accepted**（@livefree 人工审核 PASS 2026-05-23 → EP-1 启动）
**日期**：2026-05-23
**作者**：arch-reviewer (claude-opus-4-7) — 评级 **A− CONDITIONAL PASS**（9 修订建议 R-149-1..9 已在本 ADR 内消解，可直接落地 EP-1）
**起草模型**：claude-opus-4-7（主循环）+ claude-opus-4-7（arch-reviewer 子代理评审与决策）
**关联 GAP**：#UR-B1 / #UR-B2 / #UR-B3 / #UR-B4（docs/audit/user-review-2026-05-23.md — M-SN-8 用户复核 4 处表头痛点）
**关联任务**：CHG-SN-9-DT-HEADER-REDESIGN-ADR（本 ADR 起草卡）
**后续解锁卡**：CHG-SN-9-DT-HEADER-EP-1 ~ EP-4-C（实施分步详 §4）
**ADR-103 关系**：第 5 次 AMENDMENT（修订 §4.1 / §4.4 / §4.5；保留 §4.2 useTableQuery / §4.3 selection / 4 次既有 AMENDMENT 全部保留）

### 1. 背景与现状

server-next 13 个 admin DataTable 消费方在 M-SN-8 用户复核中暴露 4 处分散的"过滤/列管理"入口（#UR-B1 / #UR-B2）：

| # | 入口 | 文件 | 实际消费方数 | 用户痛点 |
|---|---|---|---|---|
| 1 | toolbar 第二行 filter chips | `filter-chips.tsx` (128 行) | 0 处（`hideFilterChips: true` 8 处显式关闭，5 处隐式不触发） | 仅展示 + 编辑双职责 / 与列内过滤入口重复 |
| 2 | toolbar 内"已隐藏 N 列" chip | `hidden-columns-menu.tsx` (207 行) | 0 处显式关闭，触发条件"存在隐藏列" | 视线在 thead 时要回到 toolbar 找入口 |
| 3 | 列名点击 popover | `header-menu.tsx` (299 行) | 9 处 `enableHeaderMenu: true` | "点列名应直接排序"违 Excel/Notion/Linear 业界范式 |
| 4 | `column.renderFilterChip` prop | 消费方 column 配置 | 0 处使用（仅测试 + dev demo） | （未实际触发，作为逃生口已废） |

**用户原话**（M-SN-8 复核反馈）：
> "很多实现起来是需要做决策的，但开发过程都被跳过，要么没有实现，要么使用不可用的方式假装实现了。"

**外置补丁现状**：
- VideoListClient（`apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx:594`）使用 `FilterChipBar` 外置组件塞 `toolbar.trailing` —— 业务 filter key（`q/type/status`）不与 column.id namespace 一致，无法走默认 chip 自动渲染。这是历史遗留补丁，本 ADR 决策 D-149-11 中专门处理。

**不解决的后果**：
- #UR-B1 持续：用户每次进入 admin 列表页都要在 4 处入口中找过滤/列管理
- 新模块继续繁殖散落（无强约束 → 第 14、15 个消费方仍可写自己的 trailing chip）
- a11y 焦点链分裂（4 处 popover + toolbar chip + 外置 FilterChipBar 至少 5 个焦点入口）

### 2. 改造目标

把 4 处入口收敛为 **2 处入口 + 列名 toggle 排序**：

- **入口 1：列名右侧 ⋯（列级三点）** — 该列即时操作（升降序 / 过滤编辑 / 隐藏此列）
- **入口 2：toolbar 右端 ⋯（统一矩阵 popover）** — 全表配置矩阵（一眼看全列 × 4 维：列名 / 可见性 / 过滤 / 排序 + 3 个批量按钮）
- **行为变化：列名点击 → toggle asc ↔ desc 互斥**（不可回无序）

trailing 槽位严格定义为业务动作槽位（详 D-149-11）；filter chips / 已隐藏 N 列 chip 整段删除（共 3 个文件 / 535 行）。

### 3. 决策清单

#### D-149-1 表格头 4 处入口废除

**选项**：A 保留 4 处 + 切换 prop / B 废除 1→4 / C 分阶段废除

**选择：B**。废除 4 处一致性最高，破坏面集中可控（typecheck 锁链由 D-149-9 EP 序列保护）。

#### D-149-2 统一矩阵 popover 引入（位置 toolbar 右端）

**选项**：A toolbar 右端 ⋯ / B thead 最右列右侧 ⋯ / C sidebar drawer

**选择：A**，默认 `headerMenuTriggerPosition='toolbar-right'`。

- A vs B：thead 列宽紧张时 ⋯ 触发器易被横向 scroll 推走；toolbar 右端固定可达性最高
- A vs C：drawer 滑入耗时 250ms 打断"快速一览"主诉求
- toolbar.hidden=true 时 prop 显式 fallback `'thead-right'`

风险：
- 小屏 < 1280px 矩阵 popover 拥挤 → max-width: 90vw + 横向滚动 + 列数 > 8 时列名折行
- 列数 > 20 时纵向滚动性能 → max-height: 60vh + overflow-y: auto；虚拟化推 N1-149-3

#### D-149-3 列名右侧 ⋯ 列级三点（默认 auto 显示策略）

**选项**：A 默认 always / B 默认 auto / C 默认 hover

**选择：B**，默认 `columnTriggerVisibility='auto'`。

**判定时机（R-149-2 修订）**：static + dynamic 复合 — `enableSorting || columnMenu.filterContent || columnMenu.canHide !== false || columnMenu.isFiltered === true || query.sort.field === col.id`。任一为 true 即显示。

**行为细节（R-149-6 修订）**：
- 列名整体可点（cursor: pointer）→ 触发 toggle 排序
- ⋯ 图标 onClick **必须 e.stopPropagation()**，防止冒泡触发列名 toggle 排序
- ⋯ 图标 ARIA：`aria-haspopup="menu" aria-expanded="..." aria-label="{列名} 列操作"`

#### D-149-4 点列名 toggle asc/desc 互斥

**选项**：A 三态循环 `none → asc → desc → none` / B 二态互斥 `asc ↔ desc` / C 单态 sticky

**选择：B**。

理由：与 Excel / Notion / Linear / Airtable 一致（业界范式）；清除排序入口在列级 ⋯ + 矩阵双备份（不会 dead end）。

破坏面：
- 现有 154+ 单测中 sort cycle 部分需更新（~5-8 用例）
- 键盘用户 muscle memory 调整：Tab 到列名 + Space → toggle，不再有"第三次 Space 回 none"

#### D-149-5 矩阵 popover 语义（状态指示 + 批量清除 / 不直接编辑过滤值）

**选项**：A 直接编辑过滤值 / B 仅状态指示 + 开关 + 批量清除 / C 每行展开二级编辑面板

**选择：B**。清晰边界："矩阵看状态 / ⋯ 改值"。

矩阵每格语义：

| 格 | UI | 行为 | 不支持时 |
|---|---|---|---|
| **可见性** | switch（role="switch" aria-checked） | 切换列可见/隐藏 | pinned 列 disabled + 🔒 标签 + aria-label="该列已锁定" |
| **过滤** | switch（关闭=立即清除过滤值 + 隐藏摘要）+ 旁边摘要文本 | 关闭：调 column.columnMenu.onClearFilter；开启：popover 关闭 + 引导用户点列名 ⋯ inline 编辑 | 无 filterContent 显 "—" 灰 + disabled + aria-label="该列不支持过滤" |
| **排序** | ↑ ↓ × 三按钮（role="radiogroup" 三 radio + 互斥单列） | 点 ↑/↓ 设该列 asc/desc + 清除其他列排序；× 清除该列排序 | enableSorting=false 显 "—" 灰 + disabled |

批量操作（popover 底部 3 个按钮）：清除全部过滤 / 清除排序 / 恢复默认列可见性。

#### D-149-6 过滤格 UI（switch + 摘要 + 溢出处理）

**选择：B** switch toggle + 摘要文本（关闭=即时清除）。

摘要文本规约：
- max-width: 200px / text-overflow: ellipsis / white-space: nowrap
- hover 显示 native `title` 属性 tooltip 全文（**R-149-4 锁定**：当前 string；富文本走 N1-149-6）
- 多值过滤折叠：enum 单选 `类型: 电影` / enum 多选 ≤ 2 `类型: 电影, 电视剧` / enum 多选 > 2 `类型: 电影+3 项…` / range `8.0-10.0` / date-range `近7天` 或 `2026-05-01~05-23` / text ≤ 30 字原值；> 30 截断 + tooltip 全文

摘要 source：`ColumnMenuConfig.filterSummary?: string`（新增字段；消费方提供）。

#### D-149-7 排序格 UI（↑↓× 互斥单列）

**选择：B** 三按钮 radiogroup。`<div role="radiogroup" aria-label="{列名} 排序方向"><button role="radio" aria-checked="..."></button>×3</div>`。

#### D-149-8 DataTableSearchInput IME composition + debounce（纳入本 ADR / 闭合 #UR-B3）

**选择：B** 纳入本 ADR + EP-4 一并实施。

签名：
```typescript
export interface DataTableSearchInputProps {
  readonly value: string
  readonly onChange: (next: string) => void
  readonly placeholder?: string
  readonly debounceMs?: number  // 默认 300
  readonly 'aria-label'?: string
  readonly 'data-testid'?: string
}
```

行为：composition 期间暂停 onChange / compositionEnd 时恢复 + 立即触发一次 / 非 composition 时走 debounce / Enter 立即提交 / value 受控。

#### D-149-9 EP 拆分粒度（5 段渐进 / typecheck 不破裂）

**选择：B** 5 段 EP（**R-149-8 修订**）。详 §4。

#### D-149-10 API 契约变更

**删除（types.ts）**：
- `DataTableProps.enableHeaderMenu?: boolean`
- `ToolbarConfig.hideHiddenColumnsChip?: boolean`
- `ToolbarConfig.hideFilterChips?: boolean`
- `TableColumn.renderFilterChip?: (ctx) => ReactNode`

**新增（types.ts）**：
- `DataTableProps.columnTriggerVisibility?: 'auto' | 'always' | 'never'`（默认 `'auto'`）
- `DataTableProps.headerMenuTriggerPosition?: 'toolbar-right' | 'thead-right'`（默认 `'toolbar-right'`；toolbar.hidden=true 时强制 fallback 到 `'thead-right'`）
- `ColumnMenuConfig.filterSummary?: string`

**RemovedExports**：`filter-chips.tsx` + `filter-chip.tsx` + `hidden-columns-menu.tsx` 整文件删；`index.ts` 更新 export。

#### D-149-11 trailing 槽位职责约定（**R-149-5 修订**）

**选择：B** 允许 read-only 摘要 chip + 业务动作。

**判定规则**：
- 允许：`<FilterChipBar items={chips} onClearAll={...} />`、业务 segment、刷新/导出/新建按钮
- 不允许：内嵌 `<input>` / `<select>` / range slider 等编辑型 UI（这些走列级 ⋯ filterContent）

**VideoListClient 处理**：保留外置 FilterChipBar 在 trailing（业务 key 摘要），矩阵 popover 不显示这些业务 filter（因 column.id 不对齐）；M-SN-N follow-up 评估将 video filter key 迁移到 column.id namespace（推 N1-149-4）。

#### D-149-12 矩阵 popover a11y 强制约束（**R-149-7 修订新增**）

**ARIA roles**：
- 外层 portal panel：`role="dialog" aria-modal="false" aria-label="列设置"`
- 内层 grid：`role="grid" aria-rowcount={cols + 2}`
- header row：`role="row"` + 4 cells `role="columnheader"`
- 每列行：`role="row"` + 列名 cell `role="rowheader"` + 其余 `role="gridcell"`
- 可见性 switch：`role="switch" aria-checked aria-label="切换 {列名} 可见性"`
- 过滤 switch：同上 + 不支持时 `aria-disabled="true" aria-label="该列不支持过滤"`
- 排序按钮组：`role="radiogroup" aria-label="{列名} 排序方向"` 含 3 `role="radio"` + `aria-checked`

**键盘语义**：
- ArrowUp/Down：行间移动焦点（矩阵 grid pattern）
- ArrowLeft/Right：列间移动焦点
- Space：切换当前 cell 的 switch 或 radio
- Esc：关闭 popover + 焦点回 ⋯ 触发器
- Tab：跳出 grid 到底部批量按钮区；Shift+Tab 反向

**焦点回流**：打开 popover 前保存 `document.activeElement` 为 previousFocus；关闭时 previousFocus.focus()。

### 4. 实施分步（5 EP）

| EP | 范围 | 工时 | 依赖 | typecheck 中间态 |
|---|---|---|---|---|
| **EP-1**：契约 deprecate + 矩阵原语 | types.ts 删 4 prop **改为标 @deprecated**（保 noop）+ 新增 3 prop + 新建 `column-matrix-menu.tsx` (~400 行 + a11y) + `dt-styles.tsx` 矩阵样式 + ColumnMenuConfig 扩 filterSummary + 35 矩阵单测 | 0.6w | ADR PASS | 全 PASS（旧 prop 仍工作） |
| **EP-2**：列级 ⋯ + 列名 toggle | `header-menu.tsx` 改 anchor 从 `<th>` 整体到 `<span>` ⋯ + `data-table.tsx` 列名渲染加 ⋯ 图标（条件） + 列名 onClick 改 toggle 排序 + ⋯ stopPropagation + 10 单测 | 0.5w | EP-1 | 全 PASS |
| **EP-3**：删除旧入口 | `data-table.tsx` 删 hidden cols chip + filter chips 渲染 + 删除 `hidden-columns-menu.tsx` + `filter-chips.tsx` + `filter-chip.tsx` + 改 `toolbar.tsx` 不动 + `index.ts` 更新 + 10 集成单测 | 0.3w | EP-2 | 全 PASS |
| **EP-4-A**：DataTableSearchInput + 5 消费方接入 | 新建 `search-input.tsx` (~80 行 + IME composition + debounce + Enter 立即) + 12 单测 + 5 高优消费方接入（videos / users / audit / submissions / sources） | 0.4w | EP-3 | 全 PASS |
| **EP-4-B**：剩余消费方删 deprecated prop | 9 处删 `enableHeaderMenu` + 8 处删 `hideFilterChips` + 类型 deprecated → 完全删除（types.ts 第二次改）+ 视觉走读 + e2e smoke | 0.4w | EP-4-A | 全 PASS（删 @deprecated 时旧 prop 消费方已全清） |
| **EP-4-C**：用户走读 + 修复 | @livefree 走读 5 代表页（videos / sources / moderation / submissions / users）+ #UR-B1/B2/B3/B4 闭合验证 + 走读发现修复 | 0.3w | EP-4-B | 全 PASS |

**总工时**：约 2.5w（含 ADR 起草 0.3w + arch-reviewer 评审已完成）

**测试覆盖**：60-80 新增单测（详 §6）+ 现存 154 用例全 PASS；admin smoke e2e 加 2-3 case（推 N1）。

### 5. 关联 ADR

| # | ADR | 关联 | 影响 |
|---|-----|------|------|
| 1 | ADR-103 | **本 ADR 是第 5 次 AMENDMENT** — 修订 §4.1 / §4.4 / §4.5 | ADR-103 自身追加一行"5th AMENDMENT 2026-05-23 / ADR-149"指引 |
| 2 | ADR-103a | admin-ui Shell API 契约 | 无影响（DataTable 不在 Shell 层） |
| 3 | ADR-117 | sources matrix 行展开 D-117-5 `renderExpandedRow / expandedKeys` | **保持不变**，矩阵 popover 与行展开 panel 不冲突（前者在 toolbar 层 / 后者在 tbody 层） |
| 4 | ADR-144 | FilterPreset 团队共享 | 无变更；本 ADR 不动持久化层；N1-149-4 评估协同 |
| 5 | ADR-147 | admin notification hub | 无关 |
| 6 | ADR-148 | session KV 消费 | 无关 |

### 6. R-MID-1 影响

**零新增**（无端点 / 无 actionType / 无 targetKind / 无 ErrorCode 变化）。

本 ADR 仅 UI 层组件契约改造；不涉及后端 route / Service / audit。`npm run verify:adr-contracts` + `npm run verify:endpoint-adr` 在 EP-1 ~ EP-5 全程预期 PASS。

### 7. 测试 surface（60-80 新增 / 现存 154 不破）

| 模块 | 用例数 | 维度 |
|---|---|---|
| column-matrix-menu.tsx | ~35 | 矩阵渲染 / pinned 灰化 / 不支持过滤灰化 / 不支持排序灰化 / 各 cell switch 切换 / 排序 ↑↓× 互斥 / 批量按钮 3 个 / 摘要文本溢出 / 多值折叠 4 种 / a11y roles / 键盘 5 个语义 / focus 回流 / portal 渲染 / ESC 关闭 / 点外关闭 / window resize 重算 |
| header-menu.tsx | ~10 | anchor 切换（列名整体 → ⋯ span）/ 列名整体点击 toggle 排序 / 列名 ⋯ stopPropagation / D-149-4 toggle 三态废除验证 / pinned 列名仍可 toggle 排序 |
| data-table.tsx | ~10 | columnTriggerVisibility 三态 / headerMenuTriggerPosition 两态 / toolbar.hidden + fallback 'thead-right' 兼容 / 旧 @deprecated prop 在 EP-1 阶段仍工作 |
| search-input.tsx | ~12 | composition start/end / debounce / Enter 立即 / value controlled / SSR safe / 空字符串短路 / 连续中文输入"黑客"全程不中断 |
| 现存 14 测试文件 | 154 | 全 PASS（部分 sort-cycle 测试需小幅更新 ~5-8 用例） |

**视觉回归**：EP-1 矩阵 popover baseline / EP-3 "已删旧入口" thead baseline / EP-4-C 用户走读补位

**用户走读 + dev server 实测**（M-SN-8 教训硬约束）：
- @livefree 在 EP-4-C 走 5 代表页：videos / sources / moderation / submissions / users
- 必走场景：中文 IME "黑客" 全程不刷新 / 排序点列名循环 / 过滤从列级 ⋯ inline 编辑 / 矩阵一览状态 + 清除全部过滤 / 隐藏列 + 恢复默认 / a11y 键盘走 Tab + 方向键
- 闭合检查清单：#UR-B1 / #UR-B2 / #UR-B3 / #UR-B4 四项必关

### 8. 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|------|--------|------|
| R-149-RA | 13 消费方迁移工时低估 | 中 | EP-4 拆 4-A / 4-B / 4-C 三子卡；每子卡 typecheck PASS 后再开下一卡 |
| R-149-RB | 矩阵 popover 小屏（< 1280px）拥挤 | 中 | max-width: 90vw + 横向滚动 + 列数 > 8 时列名折行；测试 surface 含 320px 移动端响应式用例 |
| R-149-RC | 列数 > 20 矩阵纵向滚动性能 | 低 | max-height: 60vh + overflow-y: auto；虚拟化推 N1-149-3 |
| R-149-RD | header-menu anchor 切换后 focus 丢失 | 中 | useLayoutEffect 重算 anchor / focus trap 范式保留；EP-2 单测覆盖 |
| R-149-RE | VideoListClient FilterChipBar 与 §3.1a "trailing 不放过滤" 冲突 | 中 | D-149-11 显式允许 read-only 业务摘要 chip；N1-149-4 评估业务 filter key namespace 迁移 |
| R-149-RF | EP-1 deprecate 中间态消费方继续用旧 prop 写新代码 | 低 | EP-1 同时改 `docs/rules/admin-module-template.md` + JSDoc `@deprecated` + ESLint 自定义 rule（可选 N1） |
| R-149-RG | a11y 单测覆盖不足导致 SR 用户走读失败 | 中 | D-149-12 强制 ARIA / 键盘 / 焦点回流 单测覆盖；用户走读 EP-4-C 含键盘 Tab 走通验证 |

### 9. N1 follow-up

- **N1-149-1**：矩阵 popover 支持多列排序（`query.sort` 升级为数组 + 优先级指示）—— 需 ADR-103 §4.1 TableSortState 重构，独立 ADR 评估
- **N1-149-2**：列设置持久化（user_table_preferences 表 DB-level vs localStorage / 与 ADR-144 filter-presets 协同 / 跨设备同步语义）
- **N1-149-3**：矩阵 popover 列数 > 20 时虚拟化（react-virtual / @tanstack/virtual）
- **N1-149-4**：video filter key namespace 与 column.id 对齐迁移（消除 FilterChipBar 外置补丁）
- **N1-149-5**：admin smoke e2e 覆盖矩阵 popover + 列级 ⋯ + IME search 三大场景
- **N1-149-6**：filterSummary 类型升 ReactNode（支持 chip 内嵌 icon / 颜色徽标 / 链接）
- **N1-149-7**：列宽 resize（reference.md §4.4 提到的 `enableResizing` 未完整实装）
- **N1-149-8**：column-matrix-menu 改 sidebar drawer 探索（小屏体验优化）

### 10. 验证清单

```bash
npm run typecheck            # 各 EP 完成时必 PASS（含 EP-1 deprecate 中间态）
npm run lint                 # 必 PASS
npm run test -- --run        # 60-80 新增 + 现存 154 全 PASS
npm run verify:adr-contracts # 零端点 / 零 actionType / 零偏离
npm run verify:endpoint-adr  # 零新 admin route，本 ADR 零端点变化
npm run dev:server-next      # EP-4-C 用户走读环境
```

**用户走读硬约束**：@livefree 必走 ≥ 1 次（详 §7 走读清单）；走读未通过 EP-4 不闭合，CHG-SN-9-DT-HEADER-* 不 commit。

### 11. 修订建议消解状态

本 ADR 已在 D-149-1 ~ D-149-12 + §4 EP 拆分 + §7 测试 surface + §8 风险表中消解 arch-reviewer R-149-1 ~ R-149-9 全部 9 条修订建议：

| R-ID | 消解位置 |
|------|---------|
| R-149-1 | §1 现状表 + §3 D-149-1 / D-149-10 实测数据 |
| R-149-2 | D-149-3 columnTriggerVisibility 判定时机 |
| R-149-3 | D-149-2 toolbar.hidden fallback 矩阵 |
| R-149-4 | D-149-6 filterSummary 锁定 string + N1-149-6 富文本 |
| R-149-5 | D-149-11 trailing 允许 read-only 摘要 chip 判定规则 |
| R-149-6 | D-149-3 ⋯ onClick e.stopPropagation |
| R-149-7 | D-149-12 矩阵 popover a11y 强制约束 |
| R-149-8 | D-149-9 + §4 EP 5 段拆分（含 deprecate 中间态保 typecheck） |
| R-149-9 | §4 EP-4 拆 A/B/C 三子卡 + §7 测试 60-80 新增 |

**自评：A− CONDITIONAL PASS** — 9 修订建议已全部落实到决策项 / EP 拆分 / 测试 surface / 风险表；架构方向（4 入口归 2 + 列名 toggle 排序）契合 #UR-B1/B2/B3/B4 用户复核；与 ADR-103 / ADR-117 关系明确；零 R-MID-1 / 零 endpoint-adr 影响。EP-4-C 用户走读 ≥ 1 次为 CHG-SN-9-DT-HEADER-* 闭合硬前置。

**@livefree 人工审核 PASS（2026-05-23）→ status 翻 Accepted → EP-1 启动**

---

> **AMENDMENT 1 2026-05-24（CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-1）— D-149-13 toolbar.search 槽位职责约定 + EP-5 业务 filter 迁移**

### Context（AMENDMENT 1）

EP-3 commit `1d1f635e` 后 @livefree 在 dev server 实测视频库页 `/admin/videos` 时发现"表格头仍有过滤下拉菜单"。深查 7 个 server-next admin DataTable 消费方 toolbar.search 槽位实测占用情况：

| 消费方 | toolbar.search 实际内容 | 合规性 |
|---|---|---|
| `VideoListClient.tsx:716` | VideoFilterBar（1 search input + 5 select） | ❌ 违规 |
| `CrawlerRunsView.tsx:347-377` | 2 AdminSelect + 1 ghost button | ❌ 违规 |
| `AuditClient.tsx:275-329` | 2 AdminSelect + 2 AdminInput + 2 datetime-local | ❌ 违规 |
| `UsersListClient.tsx:351-395` | 1 search input + 2 AdminSelect + 1 ghost button | ❌ 违规 |
| `SubmissionsListClient.tsx:327-360` | 2 AdminSelect + 1 ghost button | ❌ 违规 |
| `CrawlerSiteList.tsx:187-198` | 1 AdminInput type=search | ✅ 合规 |
| `SourcesClient.tsx:341-348` | 1 AdminInput type=search | ✅ 合规 |

**根因**：原 ADR-149 D-149-11 只约束了 `toolbar.trailing` 槽位（"不允许编辑型 filter UI / 允许 read-only 摘要 chip"），但 **D-149-11 之外没有约束 toolbar.search 槽位**。导致 5/7 消费方继续把业务 filter UI（select / range / date-range 编辑）塞到 search 槽位。这是 #UR-B1 "表格头不一致"的**真实根源**，原 ADR-149 EP-1..EP-3 改造已让矩阵 popover 落地，但若 5 消费方继续在 search 槽位塞业务 filter UI，矩阵 popover 与 search 槽位将形成**第二轮散落**。

**M-SN-8 教训重申**："很多实现起来是需要做决策的，但开发过程都被跳过"。本 AMENDMENT 1 在 EP-3 commit 后 24h 内启动，避免落入"假装实现"陷阱（矩阵 popover 已落 / search 槽位污染仍在）。

### 新增决策

#### D-149-13 toolbar.search 槽位职责约定（白名单 + 黑名单 + 桥接合约）

**选项**：
- A：松约束 — 允许多 input + 1 个 select（消费方自治）
- B：严约束 — 仅 1 个全文搜索 input（其余全部走列级 ⋯）
- C：分级约束 — 全文搜索 + 1 个"主过滤维度"select（半自治）
- D：删除 search 槽位 — 全部 filter UI 走列级 ⋯，无任何 toolbar 入口

**选择：B**（严约束）。

**理由**：
- A：与 EP-1..EP-3 改造目标（4 入口 → 2 入口）矛盾，散落继续
- C：边界模糊（"主过滤维度"消费方自定义 → 范式仍散）
- D：全文搜索是高频跨列需求（titel/email/url 字段 OR 模糊匹配），删除会让用户必须打开列级 ⋯ 找搜索框，UX 倒退
- B：与 D-149-11 trailing 约束**对称**（trailing 允许业务动作 + read-only chip / 禁止编辑型 filter UI；search 允许 1 个全文搜索 / 禁止业务 filter UI）

**白名单**（允许出现在 toolbar.search 槽位的元素）：
- 1 个全文搜索 input（`<DataTableSearchInput>` / `<AdminInput type="search">` / 原生 `<input type="search">`）
- 该 input 内嵌的视觉装饰（搜索 icon / clear 按钮 / loading spinner）

**黑名单**（禁止出现在 toolbar.search 槽位的元素）：
- 任何 `<select>` / `<AdminSelect>` / `<AdminDropdown>` / chip group / radio group
- 任何额外的 form 控件（type=text / date / datetime-local / number / range / checkbox 等）
- range slider / date-range picker / 任何复合过滤编辑组件
- "清空筛选"按钮（这类按钮是"该槽位含多控件需要批量清空"的反证 — 单 search input 用户清空只需 backspace）

**边界判定规则**：
- 槽位内 ≥ 2 个交互式 form 控件 → 自动违规
- 1 search input + 1 search icon button（如放大镜 / clear ×） → 合规
- 1 search input + 1 read-only quick filter chip（无内嵌输入 + × 清除按钮） → 合规
- 1 search input + 1 `<select>` → 违规
- 1 input type=search + 1 input type=datetime-local → 违规

**业务过滤 UI 唯一归属**：
- 列级 ⋯ `columnMenu.filterContent`（D-149-3 + D-149-5 编辑入口）
- 矩阵 popover 状态指示格（D-149-5 + D-149-6 状态/批量清除）
- read-only 摘要 chip 可放 toolbar.trailing（D-149-11 例外）

#### D-149-14 toolbar 三槽位职责完整闭合声明

D-149-11 + D-149-13 联合定义 toolbar 三槽位（v1.0 闭合 / 严禁滥用为第 4 类）：

| 槽位 | 职责 | 真源决策 |
|---|---|---|
| `viewsConfig` | saved views 切换 + 保存 | ADR-103 §4.4 |
| `search` | 1 个全文搜索 input（其余全部禁止） | **D-149-13**（本 AMENDMENT） |
| `trailing` | 业务动作（新建 / 导出 / 刷新 / 业务模式切换） + read-only 摘要 chip | **D-149-11**（R-149-5 修订） |

**约束**：
- 业务过滤编辑（select / range / date / multi-input） → 不能进任何 toolbar 槽位，必须走列级 ⋯
- 业务过滤状态展示 → 矩阵 popover 过滤格（首选）+ toolbar.trailing read-only chip（例外，仅 column.id 不对齐场景）
- 新模块新写 DataTable 消费 → 必须遵循三槽位职责矩阵，违反者 EP-5 拒收 PR

#### D-149-15 业务 filter key 与 column.id 不对齐场景的桥接合约

业务 filter key 命名空间（消费方业务语义）与 column.id 命名空间（DataTable 内部状态）**不对齐时**，使用既有 `ColumnMenuConfig` 四件套桥接（EP-1 已实装 / 零 admin-ui 改动）：

| 字段 | 桥接职责 |
|---|---|
| `columnMenu.filterContent: ReactNode` | 列级 ⋯ inline 编辑 UI（消费方读写自己的业务 key） |
| `columnMenu.isFiltered: boolean` | 该列对应业务 key 当前是否有过滤值（驱动矩阵过滤格开启状态） |
| `columnMenu.onClearFilter: () => void` | 关闭矩阵过滤格 switch / 列级 ⋯ "清除过滤"时调用 |
| `columnMenu.filterSummary: string` | 矩阵格右侧摘要文本（业务 key 当前值的人话） |

**桥接实现示例**（VideoListClient EP-5-videos 落地）：

```typescript
// 在 column 定义中（业务 key 'type' 不对齐 column.id 'video_type'）
{
  id: 'video_type',
  header: '类型',
  accessor: (row) => row.type,
  columnMenu: {
    filterContent: <DataTableEnumFilter
      options={VIDEO_TYPE_OPTIONS}
      value={getEnumFirst(snapshot.filters, 'type')}    // 读业务 key
      onChange={(v) => onPatch({ filters: setKey('type', v) })}  // 写业务 key
    />,
    isFiltered: snapshot.filters.has('type'),
    onClearFilter: () => onPatch({ filters: deleteKey('type') }),
    filterSummary: getEnumFirst(snapshot.filters, 'type')
      ? `类型: ${VIDEO_TYPE_OPTIONS.find(o => o.value === ...)?.label}`
      : undefined,
  },
}
```

**关键约束**：
- DataTable 内部仅使用 column.id 作为 filterContent slot 渲染 key，**不读消费方业务 key 命名空间**
- 桥接逻辑闭包在消费方 column 定义内（业务 key 命名空间不外泄）
- 矩阵 popover 桥接路径已在 EP-1 `column-matrix-menu.tsx` 第 148-149 / 320-321 行实装（isFiltered 优先 / onClearFilter 优先调），无需任何 admin-ui 改动
- N1-149-4（业务 key namespace 与 column.id 迁移）**保持 N1，不升级 EP**（理由：URL 兼容性 + 桥接已闭合 #UR-B1 用户体验）

### 修订 §4 实施分步（重写为 7 EP 完整序列）

| EP | 范围 | 工时 | 依赖 | 状态 |
|---|---|---|---|---|
| **EP-1** | types.ts deprecate + 矩阵原语 + a11y | 0.6w | ADR PASS | ✅ commit `e671f498` |
| **EP-2** | 列级 ⋯ + 列名 toggle + stopPropagation | 0.5w | EP-1 | ✅ commit `aef7051e` |
| **EP-3** | 删除旧入口（2 文件删 / D-149-10 矛盾修正） | 0.3w | EP-2 | ✅ commit `1d1f635e` |
| **EP-4** | `DataTableSearchInput` 原语 + IME composition + debounce + 7 消费方 search 槽位接入 | 0.4w | EP-3 | 待启 |
| **EP-5-shared** | `DataTableEnumFilter` / `DataTableTextFilter` / `DataTableDateRangeFilter` 共享原语 + 20 单测 | 0.3w | EP-4 | 待启 |
| **EP-5-crawler-runs** | 2 select → 列级 ⋯ filterContent 迁移 + 桥接合约接入 | 0.25w | EP-5-shared | 待启 |
| **EP-5-submissions** | 2 select → 列级 ⋯ filterContent 迁移 | 0.25w | EP-5-crawler-runs | 待启 |
| **EP-5-users** | 1 search input 留 toolbar.search + 2 select → 列级 ⋯ filterContent 迁移 | 0.3w | EP-5-submissions | 待启 |
| **EP-5-audit** | 2 select + 1 actor input + 1 request input + 2 datetime-local → 列级 ⋯ filterContent（date-range 复合）迁移 | 0.4w | EP-5-users | 待启 |
| **EP-5-videos** | 5 select → 列级 ⋯ filterContent 迁移（业务 key 桥接合约最复杂场景）+ search input 迁移 + FilterChipBar 验证保留 | 0.4w | EP-5-audit | 待启 |
| **EP-6** | types.ts 一次性删 4 个 @deprecated prop + 注释文案清理 + 视觉回归 | 0.2w | EP-5-videos | 待启 |
| **EP-7** | @livefree 走读 5+10 代表页 + #UR-B1/B2/B3/B4 闭合验证 + 5 消费方一致性核查 + e2e smoke | 0.3w | EP-6 | 待启 |

**总工时**：约 **5.2w**（原 ADR 2.5w 已含；AMENDMENT 1 增量 2.7w）

**EP-5 执行约束**：
- 6 子卡**严格串行**（避免共享原语 PR 与消费方 PR 交叉冲突）
- 顺序按消费方**复杂度递增**：shared → crawler-runs → submissions → users → audit → videos
- 每子卡完成需通过 dev server 走读 + 该消费方 testid 维度保留单测

### 修订 §6 R-MID-1 影响

零新增（无端点 / 无 actionType / 无 targetKind / 无 ErrorCode 变化），与原 ADR-149 §6 一致。`npm run verify:adr-contracts` + `npm run verify:endpoint-adr` 在 EP-4..EP-7 全程预期 PASS。

### 修订 §7 测试 surface（原 60-80 → **160-180** 新增 / 现存 154 不破）

| 模块 | 用例数（原 → 新） | 增量维度 |
|---|---|---|
| column-matrix-menu.tsx | 39（不变） | 已落 EP-1 |
| header-menu.tsx + 集成 | 21（不变） | 已落 EP-2 |
| step-ep3-removal.tsx | 11（不变） | 已落 EP-3 |
| search-input.tsx | 12（不变） | EP-4 |
| **DataTableEnumFilter** | **+ 20** | EP-5-shared / options / value / onChange / 多选 / 单选 / disabled / a11y |
| **DataTableTextFilter** | **+ 15** | EP-5-shared / value / onChange / debounce / placeholder / a11y |
| **DataTableDateRangeFilter** | **+ 15** | EP-5-shared / from-to 切换 / 快捷选项 / clear / a11y |
| **5 消费方 column.columnMenu 桥接** | **+ 60**（每消费方 ~12） | EP-5-videos/audit/users/submissions/crawler-runs：isFiltered / onClearFilter / filterSummary 联动 + 业务 key 读写 + URL sync |
| **toolbar.search 槽位合规验证** | **+ 5** | EP-7 / 5 违规消费方迁移后单一 input 单测 |
| 现存 14 测试文件 | 154（不变） | 全 PASS |

**视觉回归**：EP-5-videos 矩阵 popover with 业务 key 桥接 / EP-5-audit date-range filterContent / EP-6 deprecated prop 删除后 thead baseline

**用户走读硬约束**（EP-7）：@livefree 走 10 代表页（原 5 + 5 EP-5 消费方），必走场景：
- 5 消费方业务 filter 全部从列级 ⋯ inline 编辑 + 矩阵格状态正确
- toolbar.search 槽位 5 消费方全部只剩 1 个 search input
- 业务 key 桥接：URL 旧 saved view 兼容 + 新 URL 写入 + 矩阵格摘要正确

### N1 follow-up 调整

**保持 N1**：
- **N1-149-4**：保持 N1（**不**升级 EP-5）。理由：业务 key 桥接合约（D-149-15）已让矩阵 popover + 列级 ⋯ + 摘要展示**完全工作**，#UR-B1 用户体验已闭合；强制 namespace 迁移会引发 saved view URL 兼容性问题；属于 cleanup 而非 MVP

**新增 N1**：
- **N1-149-9**：5 消费方 saved views 迁移期 URL 兼容（业务 key 旧 URL 解析容错 / 2 周兼容窗 → N1 评估）
- **N1-149-10**：EP-5-shared 沉淀的 DataTableEnumFilter / TextFilter / DateRangeFilter 是否进一步与 admin-ui 既有 `<AdminSelect>` / `<AdminInput>` 共享内部实现（DRY 评估）

### 与 EP-1/2/3 已 commit 代码的兼容性矩阵

| 维度 | AMENDMENT 1 影响 |
|---|---|
| EP-1 `types.ts` 公开 Props 契约 | **零回退** — ColumnMenuConfig 4 件套桥接合约已实装 |
| EP-1 `column-matrix-menu.tsx` 桥接路径 | **零回退** — isFiltered/onClearFilter 优先路径正是 D-149-15 桥接落点 |
| EP-2 `header-menu.tsx` + 列名 toggle | **零回退** — D-149-13 仅约束 toolbar.search，不动 header / 列级 ⋯ |
| EP-3 旧入口删除（2 文件） | **零回退** — D-149-13 是 search 槽位行为约束，不复活 filter-chips.tsx |
| EP-1 `@deprecated` 注释中 "EP-4-B 将完全删除" | **文案微调** — 改为 "EP-6 将完全删除"（types.ts 4 处 @deprecated 注释）；纯注释 patch / 零代码逻辑改动 |
| `apps/server-next` 5 违规消费方 | **由 EP-5-* 6 子卡修复** — AMENDMENT 1 不改任何消费方代码 |

**结论**：AMENDMENT 1 是纯 additive 决策扩展 + EP 序列重排 + types.ts 4 处注释文案微调；EP-1/2/3 已 commit 代码**零回退 / 零代码逻辑改动**。

### AMENDMENT 1 修订建议消解状态

本 AMENDMENT 已在 D-149-13 / D-149-14 / D-149-15 + §4 EP-4..EP-7 序列 + §7 测试 surface + 兼容性矩阵 + N1 调整中消解 arch-reviewer R-AMEND-1-1 ~ R-AMEND-1-9 全部 9 条修订建议。

**自评：A− CONDITIONAL PASS** — 9 修订建议已全部落实；D-149-13 与 D-149-11 对称化 / 三槽位职责闭合 / 业务 key 桥接合约清晰；与 EP-1/2/3 已 commit 代码零回退；M-SN-8 "假装实现" 教训在边界判定规则中显式防御。EP-7 用户走读 10 代表页为 CHG-SN-9-DT-HEADER-* 闭合硬前置。

**@livefree 人工审核 PASS（2026-05-24）→ AMENDMENT 1 翻 Accepted**

---

> **AMENDMENT 2 2026-05-24（CHG-SN-9-DT-HEADER-REDESIGN-ADR-AMEND-2）— D-149-16 矩阵触发器接入 DataTable 主组件 toolbar + EP-4.5 实施分步**

### Context（AMENDMENT 2）

EP-4-HOTFIX commit `4f080e09`（@livefree PASS）后，用户在 dev server 实测中提出："表格设置三点何时接入？"

深查 ADR-149 + AMENDMENT 1 现状：

| 现状项 | 实际状态 |
|---|---|
| ColumnMatrixMenu 原语 | ✅ EP-1 commit `e671f498` 已实装 / 471 行 / 39 单测全 PASS |
| ColumnMatrixMenu 桥接路径（业务 key） | ✅ EP-1 已实装（line 148-149 isFiltered 优先 / line 320-321 onClearFilter 优先） |
| DataTableProps.headerMenuTriggerPosition prop 声明 | ✅ EP-1 types.ts line 51-60 已声明 / 默认 'toolbar-right' |
| DataTable 主组件 toolbar 渲染矩阵触发器 | ❌ **完全缺失** — data-table.tsx 仅含 search/views/trailing 三槽位 / 无触发器 button / 无 state / 无 anchorRef / 无 ColumnMatrixMenu 挂载 |
| ColumnMatrixMenu 6 callback wiring | ❌ **完全缺失** — onColumnsChange / onClearColumnFilter / onSort / onClearSort / onClearAllFilters / onResetColumnVisibility / onClose 没有任何 wiring |
| 原 ADR-149 + AMENDMENT 1 §4 EP 序列 | ❌ EP-1 ~ EP-7 全部跳过"接入矩阵触发器到 DataTable 主组件"步骤 |

**实施 GAP 性质**：与 D-149-10/11 / D-149-13 / D-149-15 同类 ADR 实施 GAP — 决策项写明（D-149-2 矩阵触发器位置 / D-149-14 三槽位职责闭合）但 §4 EP 序列从未显式安排"接入到 DataTable 主组件 toolbar"步骤。

**M-SN-8 教训再次重申**："很多实现起来是需要做决策的，但开发过程都被跳过。" 本 AMENDMENT 2 在 EP-4-HOTFIX commit 后启动，避免"矩阵原语已落 / 但消费方完全访问不到"的"假装实现"陷阱。

### 新增决策

#### D-149-16 矩阵触发器接入 DataTable 主组件 toolbar

**选项**：
- A：DataTable 主组件 toolbar 右端 ⋯ button（始终渲染，紧贴 trailing 槽位之后）
- B：DataTable 主组件 toolbar 内独立第 4 槽位（matrix slot，由消费方注入 ⋯ 节点）
- C：thead 最后一列右侧 ⋯ button（沿用列级 ⋯ 样式，作为"全表"入口）
- D：保持现状不接入

**选择：A**（默认 `headerMenuTriggerPosition='toolbar-right'`）。

**理由**：
- D：不可选，与 D-149-2/D-149-14 决策矛盾
- C：与 D-149-3 列级 ⋯ 视觉无法区分；列宽紧张时横向滚动推走 ⋯，可达性差
- B：消费方注入会让 13 个消费方各写各的，再现 EP-3 前"4 处入口散落"反模式
- A：DataTable 主组件统一渲染 / 7 消费方零改动 / 与 D-149-2 决策一致

**接入实现规约**：

**(1) 触发器渲染位置**：
- 默认 `headerMenuTriggerPosition='toolbar-right'`：渲染在 toolbar 容器内最右端，紧贴 `[data-table-toolbar-trailing]` 之后
- toolbar.hidden=true 时 prop 强制 fallback 到 `'thead-right'`：渲染在 thead 最右列之后追加 1 列 cell（grid template 自动追加 `var(--row-h-compact)` 宽度），**不参与 visibleColumns 计数 / 不参与 selection / 不计入 col span**

**(2) 触发器始终渲染（R-AMEND-2-1 MUST）**：
- 即使 `toolbar.search` / `toolbar.trailing` / `toolbar.viewsConfig` 全部为空，DataTable 也必须渲染 `[data-table-toolbar]` 容器以承载矩阵触发器
- `hasToolbarContent` 计算必须包含矩阵触发器项 — 等价：渲染条件改为 `toolbar.hidden !== true`，不再 hasToolbarContent 守卫

**(3) 触发器 UI（R-AMEND-2-2 MUST）**：
- HTML：`<button type="button" data-table-matrix-trigger aria-haspopup="dialog" aria-expanded={matrixOpen} aria-label="表格设置" data-testid="matrix-trigger">⋯</button>`
- 样式：**独立 `[data-table-matrix-trigger]` 样式块**（dt-styles.tsx 新增），**禁止复用** `[data-th-menu-icon]`（后者 opacity:0 hover 显隐 / toolbar 中将隐身）。新样式：`opacity:1` 恒显 / `min-width: 28px` / `height: 24px` / 与 trailing 同行垂直居中 / `[data-active="true"]`（matrix popover 已打开时）变 accent 色
- data attribute 区分：列级 ⋯ 用 `[data-th-menu-icon]`（thead 内）；矩阵触发器用 `[data-table-matrix-trigger]`（toolbar / thead-right fallback 内）

**(4) ColumnMatrixMenu 接入 wiring**：

```typescript
// state
const [matrixOpen, setMatrixOpen] = useState(false)
const matrixAnchorRef = useRef<HTMLButtonElement | null>(null)

// columnMenus map 构建
const columnMenus = useMemo(
  () => new Map(columns.map((c) => [c.id, c.columnMenu ?? {}] as const)),
  [columns],
)

// 6 个 callback wiring（与 D-149-15 桥接合约兼容）
const handleMatrixColumnsChange = (next) => onQueryChange({ columns: next })
const handleMatrixClearColumnFilter = (colId) => { const next = new Map(query.filters); next.delete(colId); onQueryChange({ filters: next }) }
const handleMatrixSort = handleHeaderMenuSort     // 已存在复用
const handleMatrixClearSort = handleHeaderMenuClearSort  // 已存在复用
const handleMatrixClose = () => setMatrixOpen(false)
// onClearAllFilters / onResetColumnVisibility 见 §(5) / §(6)
```

**(5) onClearAllFilters 语义（BLOCKER R-AMEND-2-3 MUST / 业务 key 桥接）**：

`onClearAllFilters` **不能**直接执行 `onQueryChange({ filters: new Map() })` — 业务 filter key（如 VideoListClient 的 `q/type/status`）走消费方 URL searchParams 自管（D-149-15 桥接合约），**不在 query.filters 内**。直接清空只会清掉 column.id 命名空间过滤，业务 key 维度的 5 select 仍显示原值，构成 M-SN-8 "假装实现" 反模式。

**正确实现**：遍历 columns，**优先调 `column.columnMenu.onClearFilter`**（业务 key 桥接），fallback 才从 query.filters 删 column.id 键。沉淀工具函数到 column-visibility.ts：

```typescript
export function clearAllColumnFilters<T>(
  columns: readonly TableColumn<T>[],
  currentFilters: ReadonlyMap<string, FilterValue>,
  onPatch: (next: ReadonlyMap<string, FilterValue>) => void,
): void {
  for (const col of columns) {
    if (col.columnMenu?.onClearFilter) {
      col.columnMenu.onClearFilter()
    }
  }
  // 然后清空 column.id 命名空间过滤
  if (currentFilters.size > 0) {
    onPatch(new Map())
  }
}
```

与 column-matrix-menu.tsx 单列 handleFilterToggle（line 318-325）"优先 columnMenu.onClearFilter / fallback onClearColumnFilter"路径**对称**。

**(6) onResetColumnVisibility 语义（R-AMEND-2-4 MUST / 合并式 reset 不丢 width）**：

`onResetColumnVisibility` **不能**直接执行 `onQueryChange({ columns: new Map() })` — 会清空所有列偏好，**消费方手工调整的 column width 全部丢失**。

**正确实现**：合并式 reset，每列写入 `{ visible: col.defaultVisible !== false, width: oldPref.width }`：

```typescript
export function resetColumnVisibility(
  columns: readonly ColumnDescriptor[],
  colMap: ReadonlyMap<string, ColumnPreference>,
): ReadonlyMap<string, ColumnPreference> {
  const next = new Map<string, ColumnPreference>()
  for (const col of columns) {
    const prev = colMap.get(col.id)
    next.set(col.id, {
      visible: col.defaultVisible !== false,
      ...(prev?.width !== undefined ? { width: prev.width } : {}),
    })
  }
  return next
}
```

**(7) 无 confirm 声明（R-AMEND-2-5）**：

`onClearAllFilters` / `onResetColumnVisibility` 两批量按钮**无 dialog confirm**，点击即时生效。与 D-149-5（矩阵语义 = 状态指示 + 批量清除）已确立的"批量按钮即时生效"范式对齐；引入 confirm 会破坏 popover 内嵌 dialog 反模式。

**(8) a11y（与 D-149-12 对接）**：
- 触发器 ARIA：`aria-haspopup="dialog"` / `aria-expanded` 双向同步 matrixOpen state
- 触发器键盘：Enter / Space 打开 popover
- 焦点回流：ColumnMatrixMenu 关闭时 previousFocus.focus() 自动回到触发器（line 231-242 已实装 / 无需额外 wiring）

**(9) 与 D-149-2/3/12/14/15 契约一致性**：

| 契约项 | D-149-16 一致性 |
|---|---|
| D-149-2 toolbar 右端默认位置 | ✅ headerMenuTriggerPosition='toolbar-right' 落地 |
| D-149-2 toolbar.hidden fallback 'thead-right' | ✅ 显式实施规约（追加 thead 列 cell） |
| D-149-3 列级 ⋯ stopPropagation | ✅ 矩阵触发器 in toolbar 无冒泡风险；视觉与列级 ⋯ 完全隔离 |
| D-149-5 矩阵语义 = 状态指示 + 批量清除 | ✅ wiring 完全对接 ColumnMatrixMenu Props |
| D-149-12 a11y / 焦点回流 | ✅ aria-haspopup="dialog" + previousFocus.focus() 已实装 |
| D-149-14 三槽位职责闭合 | ✅ 矩阵触发器是 toolbar 第 4 类"固定 UI"位（不允许消费方注入），不破坏三槽位职责 |
| D-149-15 业务 key 桥接 | ✅ onClearAllFilters 优先调 columnMenu.onClearFilter |

### 修订 §4 实施分步（在 EP-4-HOTFIX 之后 / EP-5-shared 之前插入 EP-4.5）

| EP | 范围 | 工时 | 依赖 | 状态 |
|---|---|---|---|---|
| EP-1 | types.ts deprecate + 矩阵原语 + a11y | 0.6w | ADR PASS | ✅ commit `e671f498` |
| EP-2 | 列级 ⋯ + 列名 toggle + stopPropagation | 0.5w | EP-1 | ✅ commit `aef7051e` |
| EP-3 | 删除旧入口（2 文件删 / D-149-10 矛盾修正） | 0.3w | EP-2 | ✅ commit `1d1f635e` |
| EP-4 | DataTableSearchInput 原语 + IME + 7 消费方 search 接入 | 0.4w | EP-3 | ✅ commit `e4ccccb3` |
| EP-4-HOTFIX | 光标失焦修复（受控 → 半 uncontrolled） | — | EP-4 | ✅ commit `4f080e09` |
| **EP-4.5** | **矩阵触发器接入 DataTable 主组件 toolbar**：headerMenuTriggerPosition prop 消费 + matrixOpen state + anchorRef + columnMenus useMemo + 6 callback wiring + toolbar-right 渲染 + thead-right fallback 渲染 + ColumnMatrixMenu portal 挂载 + dt-styles `[data-table-matrix-trigger]` 样式块 + column-visibility.ts 新增 `clearAllColumnFilters` + `resetColumnVisibility` 两工具函数 + 14-16 新单测 | **0.3w** | **EP-4-HOTFIX** | **待启** |
| EP-5-shared | 3 共享原语 + 50 单测 | 0.3w | EP-4.5 | 待启 |
| EP-5-crawler-runs | 2 select 迁移 | 0.25w | EP-5-shared | 待启 |
| EP-5-submissions | 2 select 迁移 | 0.25w | EP-5-crawler-runs | 待启 |
| EP-5-users | 1 search + 2 select 迁移 | 0.3w | EP-5-submissions | 待启 |
| EP-5-audit | 2 select + 2 input + 2 datetime 迁移 | 0.4w | EP-5-users | 待启 |
| EP-5-videos | 5 select 迁移（最复杂业务 key 桥接） | 0.4w | EP-5-audit | 待启 |
| EP-6 | types.ts 删 4 @deprecated prop | 0.2w | EP-5-videos | 待启 |
| EP-7 | @livefree 走读 + 闭合 | 0.3w | EP-6 | 待启 |

**总工时**：原 AMENDMENT 1 5.2w → AMENDMENT 2 **5.5w**（+0.3w EP-4.5）。

**EP-4.5 不拆 A/B 子卡的理由**：触发器渲染 + popover wiring + 工具函数沉淀必须一体落地，拆分会产生"触发器渲染但 popover 未挂载 / 或 popover 渲染但 callback 全 noop"的中间态（正是"假装实现"反模式）。

### 修订 §7 测试 surface（原 160-180 → **174-196**）

| 模块 | 用例数 | 增量维度 |
|---|---|---|
| 现有 EP-1/2/3/4 测试 | 134（不变） | 已落 |
| EP-5-shared/EP-5-* 计划 | + 115 | 后续 EP |
| **data-table.tsx 矩阵触发器接入** | **+ 10-12** | EP-4.5 / 矩阵触发器渲染 / toolbar-right vs thead-right / toolbar.hidden fallback / hasToolbarContent 即使全空也渲染 / aria-haspopup="dialog" + aria-expanded 双向 / 点击 popover 联动 query.columns query.filters query.sort / ESC + 点外关闭焦点回流到触发器 / 业务 key 桥接清除全部过滤（含 columnMenu.onClearFilter mock）/ reset 不丢 column width / 矩阵触发器视觉与列级 ⋯ 独立 data attribute |
| **column-visibility.ts 工具函数** | **+ 4** | EP-4.5 / clearAllColumnFilters 业务 key 优先 / fallback column.id / resetColumnVisibility 保留 width / defaultVisible 反推 |
| 现存 14 测试文件 | 154（不变） | 全 PASS |

**视觉回归**：矩阵触发器 toolbar-right baseline / thead-right fallback baseline / matrix popover 打开态触发器 active 样式。

**用户走读补充**（EP-7 必走）：
- 点 toolbar 右端 ⋯ → 矩阵 popover 打开 → 可见性 switch 切换 → 关闭 → 重新打开 state 保留
- "清除全部过滤"按钮在业务 key 场景（VideoListClient）下 5 select 全清零（业务 key 桥接闭合验证）
- "恢复默认列可见性"按钮**不丢失** 手工调整的 column width
- toolbar.hidden=true 消费方触发器 fallback 到 thead-right

### N1 follow-up 调整

**保持 N1**：N1-149-1 ~ N1-149-10 全部保持。

**新增 N1**：
- **N1-149-11**：矩阵触发器位置 prop 扩展（如 `'embedded-right'`）— 待真实需求触发再 ADR
- **N1-149-12**：clearAllColumnFilters / resetColumnVisibility 工具函数是否扩展到 saved views 重置场景

### 与 EP-1/2/3/4 + EP-4-HOTFIX 已 commit 代码的兼容性矩阵

| 维度 | AMENDMENT 2 影响 |
|---|---|
| EP-1 types.ts headerMenuTriggerPosition prop | **零回退** — EP-4.5 仅消费已声明 prop |
| EP-1 ColumnMatrixMenu 桥接路径 | **零回退** — D-149-16 wiring 完全对接已实装 props |
| EP-1 ColumnMatrixMenu 11 props 内部实现 | **零回退** — EP-4.5 不修改 column-matrix-menu.tsx |
| EP-2 列级 ⋯ + 列名 toggle + stopPropagation | **零回退** — `[data-th-menu-icon]` vs `[data-table-matrix-trigger]` 完全隔离 |
| EP-3 旧入口删除 | **零回退** — D-149-16 不复活任何已删入口 |
| EP-4 + EP-4-HOTFIX | **零回退** — toolbar.search 与矩阵触发器位置无重叠 |
| **ADR-103 第 6 次 AMENDMENT** | **不触发** — EP-4.5 仅消费已声明的 ADR-103 第 5 次 AMENDMENT prop / 非新增公开 API |

**结论**：AMENDMENT 2 是纯 additive 决策扩展 + EP-4.5 新插入 + column-visibility.ts 两工具函数沉淀 + dt-styles 一样式块新增；EP-1/2/3/4 + EP-4-HOTFIX 已 commit 代码**零回退 / 零代码逻辑改动**。

### AMENDMENT 2 修订建议消解状态

本 AMENDMENT 2 已在 D-149-16 + §4 EP-4.5 + §7 测试 surface + 兼容性矩阵 + N1 调整中消解 arch-reviewer R-AMEND-2-1 ~ R-AMEND-2-10 全部 10 条修订建议。

| R-ID | 严重度 | 消解位置 |
|---|---|---|
| R-AMEND-2-1 | 高 | D-149-16 §(2) 触发器始终渲染 + hasToolbarContent 重写 |
| R-AMEND-2-2 | 高 | D-149-16 §(3) 独立 `[data-table-matrix-trigger]` data attribute + 独立样式块 |
| R-AMEND-2-3 | **BLOCKER** | D-149-16 §(5) 业务 key 桥接 clearAllColumnFilters + column-visibility.ts 沉淀 |
| R-AMEND-2-4 | 高 | D-149-16 §(6) 合并式 resetColumnVisibility 保留 width |
| R-AMEND-2-5 | 中 | D-149-16 §(7) 无 confirm 显式声明 |
| R-AMEND-2-6 | 中 | D-149-16 §(1) toolbar.hidden=true fallback 'thead-right' 渲染规则 |
| R-AMEND-2-7 | 低 | §4 EP-4.5 工时 0.3w |
| R-AMEND-2-8 | 低 | §7 测试 surface 174-196 |
| R-AMEND-2-9 | 中 | 兼容性矩阵显式声明不触发 ADR-103 第 6 次 AMENDMENT |
| R-AMEND-2-10 | 中 | 本自评段含"避免 M-SN-8 假装实现陷阱" |

**自评：A− CONDITIONAL PASS** — 10 修订建议已全部落实；D-149-16 与 D-149-2/3/12/14/15 契约对接清晰 / 触发器 UI 与列级 ⋯ 视觉完全隔离 / 业务 key 桥接合约延续到 onClearAllFilters 批量按钮 / 合并式 reset 不丢 width 显式防御；与 EP-1/2/3/4 + EP-4-HOTFIX 已 commit 代码零回退；不触发 ADR-103 第 6 次 AMENDMENT；M-SN-8 "假装实现" 教训在两个 BLOCKER 级修订（R-AMEND-2-3 + R-AMEND-2-4）中显式防御。EP-7 用户走读硬约束含 EP-4.5 三场景（矩阵触发器打开 / 业务 key 全清 / reset 不丢 width）。

**待 @livefree 人工审核**（status: 🟡 Proposed）

---

## ADR-150 — DataTable 列固有自动过滤（Google Sheets 范式 / ADR-149 第 3 次 AMENDMENT 候选）

**状态**：🟢 **Accepted**（2026-05-24 @livefree 仲裁通过）

**@livefree 仲裁记录（2026-05-24）**：
1. **ADR-150 整体**：PASS / status 翻 Accepted
2. **D-150-5 仲裁**：接受 Opus REVISED 默认 `filterable=false` + union 类型守卫 + filterable: true → filterFieldName 必填（反 M-SN-8 假装实现陷阱 / 主循环原推荐 default true 被否）
3. **阶段 4 节奏仲裁**：严格串行 7 子卡（沿用 ADR-149 AMENDMENT 1 R-AMEND-1-5 / 每子卡独立 typecheck + dev server 走读 / 防跨子卡冲突 / 工时保持 2.1w）

**原 Proposed 状态**：🟡 待 @livefree 人工审核
**日期**：2026-05-24
**作者**：arch-reviewer (claude-opus-4-7) — 评级 **A− CONDITIONAL PASS**（6 个决策点逐一论证，D-150-3 / D-150-5 已 REVISED）
**起草模型**：claude-opus-4-7（主循环推荐方案）+ claude-opus-4-7（arch-reviewer 子代理评审）
**关联 ADR**：ADR-149 主体 + AMENDMENT 1 + AMENDMENT 2（本 ADR 与 ADR-149 D-149-3/D-149-5/D-149-15 **并行兼容**，不取代）
**关联用户反馈**：@livefree 在 EP-4.5-HOTFIX-4 走读后看 Google Sheets 列过滤截图反馈："我希望这是表格列的固有属性，实现后所有表格列都能自动提供这样的排序，过滤界面和功能。而不是根据内容逐个添加。"
**关联 GAP**：#UR-B5（M-SN-N 候选 / 配置语义负担 — EP-5-* 个别迁移要消费方每列写 `filterContent: <JSX>` 反范式）
**关联任务**：CHG-SN-9-DT-AUTOFILTER-ADR（本 ADR 起草卡）
**后续解锁卡**：CHG-SN-9-DT-AUTOFILTER-EP-1 ~ EP-5（实施分步详 §5）

### 1. 背景与现状

ADR-149 + AMENDMENT 1/2 已落地"4 入口收敛 2 + 矩阵 popover + 列名 toggle 排序"; EP-5-shared 已沉淀 3 个共享原语（`DataTableEnumFilter` / `DataTableTextFilter` / `DataTableDateRangeFilter`），EP-5-crawler-runs 作为第一个消费方落地，验证了 D-149-15 业务 key 桥接合约可工作。

但 @livefree 在 EP-4.5-HOTFIX-4 之后看 Google Sheets 截图（顶部排序 / 中部过滤类型 / 底部值列表 + 搜索 + OK）后明确反馈："过滤应是列的固有能力"。当前 EP-5-* 范式仍要求消费方**每列写一段 JSX**：

```typescript
columnMenu: {
  filterContent: <DataTableEnumFilter options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} multi searchable />,
  isFiltered: statusFilter.length > 0,
  onClearFilter: () => setStatusFilter([]),
  filterSummary: multiFilterSummary(STATUS_OPTIONS, statusFilter),
}
```

**实测散落量**：
- 列内 `filterContent` 配了：**仅 CrawlerRunsView（status / triggerType 2 列）**
- 其余 11 个 DataTable 消费方：**0 列**配 filterContent，过滤入口在 toolbar 上（旧 AdminSelect / AdminInput 集中）
- 13 表 × 平均 4 列可过滤 = ~52 处 JSX 待迁移（每处 ~6-12 行声明 = ~3w 工时按当前 EP-5 范式）

**后端契约碎片化**：每路由各写 zod query schema / DB query 层各写 WHERE / 无统一过滤参数 schema / 无通用 distinct 端点。

**sources 排序断链**（M-SN-8 用户反馈）：types/api.ts/route/DB query/SourcesClient 5 层都不消费 sort —— 这是"全栈断链"的副作用。本 ADR-150 在 §5 阶段 5 顺手修复。

**不解决的后果**：EP-5-* 6 子卡按当前范式工时 5.2w → 实际可能翻倍；UX 不一致 12 消费方 enum filter 各写各的语义；新模块继续繁殖散落范式。

### 2. 改造目标

**列固有自动过滤**：消费方只需在 column 声明上加一行 `filterable: true, filterFieldName: 'status'`，DataTable 自动从数据推导过滤类型 + 渲染 Google Sheets 范式 UI（排序 / 类型 / 值列表 / 搜索 / OK） + 后端通过统一 schema 接收过滤参数 + 后端 Service 层按白名单生成 WHERE。

**UX 范式（Google Sheets 截图对标）**：列名 ⋯ 弹出 popover 统一三段布局：

```
┌──────────────────────────────────┐
│  [排序区]                         │
│  ↑ 升序  ↓ 降序  × 清除排序        │
├──────────────────────────────────┤
│  [过滤类型]                       │
│  ◉ 按值  ○ 按条件（v2）  ○ 按颜色（v2）│
├──────────────────────────────────┤
│  [值列表]                         │
│  🔍 搜索…                         │
│  ☑ 全选                          │
│  ☑ 选项 A                         │
│  ☐ 选项 B                         │
│  显示 N 项                        │
├──────────────────────────────────┤
│       [取消]      [应用 OK]       │
└──────────────────────────────────┘
```

**保留**：ADR-149 矩阵 popover（D-149-5 状态指示 / 批量清除）+ 列名 toggle 排序（D-149-4）+ 列级 ⋯（D-149-3）+ 业务 key 桥接（D-149-15 作为逃生口）。

### 3. 决策清单（6 个 D-150-×）

#### D-150-1 enum 值来源：消费方静态 vs 后端 distinct 动态

**选项**：A 100% 静态 / B 100% distinct API / C **双轨**

**推荐：C**（PASS）

**论证**：固定枚举（status / triggerType / role）走 `filterOptions` 静态（0 RTT）；开放枚举（actor / userId / sourceUrl）走 `filterDistinctEndpoint`（首次 popover fetch + SWR 60s 缓存 / top 200 / 必有索引 / 失败 fallback 提示）。分页大数据集"页内 distinct"显式不可用（只看当前页 100 条不能推 enum 全集）。

#### D-150-2 过滤类型推导：自动 vs 显式

**选项**：A 100% 显式 / B 100% 自动 / C **默认+覆盖**

**推荐：C**（PASS）

**论证**：自动推导规则（首行非空采样 30 行）：number → 'number' / boolean → 'enum' / 匹配 ISO 日期 → 'date' / distinct ≤ 20 → 'enum' / 其余 → 'text'。SSR 首屏 rows=0 fallback 'text' / hydration 后二次推导。消费方 `filterKind` 显式覆盖永远优先。测试 surface 必须含 5 种边界数据采样。

#### D-150-3 后端通用 distinct 端点：单端点 vs 各路由 vs 两阶段

**选项**：A 单端点白名单 / B 33 路由各写 / C **两阶段**（v1 通用 / v2 域路由 fallback）

**推荐：C**（REVISED）

**论证（REVISED 修订点）**：原推荐 A 风险：动态表名 + 列名经白名单仍是 SQL 注入高危区。降级为"v1 通用 `/admin/_dt/distinct` 单端点 + 强白名单注册（drizzle column reference）+ v2 复杂列走域路由"。

**v1 通用端点三重防御**：
- Route：zod `table` enum 白名单（不允许任意字符串）
- Route：zod `col` string + 后置白名单 lookup（miss → 403）
- Service：drizzle column reference object（**禁止 raw SQL** / 不允许 `sql.raw(col)`）
- Service：`LIMIT 200` 强制
- DB：注册的列必须有索引
- 鉴权：preHandler `requireRole(['admin', 'moderator'])`

```typescript
// apps/api/src/routes/admin/_datatable.ts
fastify.get('/admin/_dt/distinct', { preHandler: auth }, async (req, reply) => {
  const QuerySchema = z.object({
    table: z.enum(['crawler_runs', 'admin_audit_log', 'users', 'user_submissions', 'sources', 'videos']),
    col: z.string().min(1).max(64),
    q: z.string().max(64).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  const parsed = QuerySchema.safeParse(req.query)
  if (!parsed.success) return reply.code(422).send({ error: ... })
  const allowed = DT_DISTINCT_WHITELIST[parsed.data.table]
  if (!allowed?.includes(parsed.data.col)) {
    return reply.code(403).send({ error: { code: 'COLUMN_NOT_WHITELISTED' } })
  }
  const colRef = DT_DISTINCT_COLUMN_REF[parsed.data.table][parsed.data.col]
  const result = await datatableService.distinct(colRef, parsed.data.q, parsed.data.limit)
  return reply.send({ data: result })
})
```

**v2 fallback**：复杂列（join / 计算 / 多表 union）走域路由自定义 distinct，column 声明用 `filterDistinctEndpoint: '/admin/videos/_distinct/source-domain'` 显式指向。

#### D-150-4 过滤 WHERE 子句契约：column.id vs 业务 key 映射 vs 前端转换

**选项**：A column.id 直传 / B **filterFieldName 映射** / C 前端转换

**推荐：B**（PASS）

**论证**：A 反模式（column.id 是 DataTable 内部 namespace 与业务 key 解耦，强对齐破坏 URL stability + saved view）；C 反模式（转换分散到 12 消费方各自维护）。B 实现规约：

```typescript
{ id: 'video_type', filterable: true, filterFieldName: 'type', filterKind: 'enum', filterOptions: VIDEO_TYPE_OPTIONS }
```

DataTable URL 写入用 `filterFieldName` 作为 query param 名。后端 Service 接收 + 白名单消费 + WHERE 拼接（Service 层归属，route 不含业务逻辑）：

```typescript
class CrawlerRunListService {
  private readonly FILTER_FIELDS = {
    'status': crawlerRuns.status,
    'trigger_type': crawlerRuns.triggerType,
  } as const
  async list(input: { filters?: Record<string, FilterValue>; ... }) {
    let query = db.select().from(crawlerRuns).$dynamic()
    for (const [key, value] of Object.entries(input.filters ?? {})) {
      const col = this.FILTER_FIELDS[key as keyof typeof this.FILTER_FIELDS]
      if (!col) continue
      query = applyFilterValue(query, col, value)
    }
    return await query
  }
}
```

**与 D-149-15 桥接合约关系**：D-149-15 保留为复杂场景逃生口；D-150-4 是新增 happy path；filterable=true 和 columnMenu.filterContent 互斥（union 类型守卫）。

#### D-150-5 未配置 filterable 默认：true vs false vs auto

**选项**：A 默认 true / B **默认 false** / C 默认 'auto'

**推荐：B**（REVISED / 与主循环推荐分歧）

**论证（REVISED 修订点）**：

主循环推荐 A（默认 true）。我**强烈反对**，理由：

**M-SN-8 教训**："很多实现起来是需要做决策的，但开发过程都被跳过，要么没有实现，要么使用不可用的方式假装实现了。"

默认 filterable=true 但消费方未传 filterFieldName 时：popover 渲染（看着可用）→ 用户选 → URL 写入 → 后端 Service FILTER_FIELDS 没有该 key → 静默忽略 → 数据没过滤 → 用户以为过滤了，实际看到全量。**典型"假装实现"反模式**。

默认 false 一行声明开箱：
```typescript
{ id: 'status', filterable: true, filterFieldName: 'status', filterKind: 'enum', filterOptions: STATUS_OPTIONS }
```

与 ADR-149 D-149-3 `enableSorting: true` 显式声明范式完全对称。union 类型守卫：

```typescript
type FilterableColumn<T> = TableColumn<T> & {
  readonly filterable: true
  readonly filterFieldName: string   // 强制必填
  readonly filterKind?: 'enum' | 'text' | 'number' | 'date'
  readonly filterOptions?: readonly FilterEnumOption[]
}
type NonFilterableColumn<T> = TableColumn<T> & {
  readonly filterable?: false | undefined
}
```

C（auto）反模式：要求前后端共享 FILTER_FIELDS schema → 引入 codegen / 不值得。

#### D-150-6 EP-5-shared 现有 3 原语：删除 vs 内化 vs **保留为逃生口**

**推荐：B**（PASS / 保留为复杂自定义 filterContent 逃生口）

**论证**：3 原语已落地 + 50 单测，删除会引发 EP-5-crawler-runs 倒退。逃生口典型场景：audit actor 字段（联想下拉 + 验证）/ video type 字段（联动效果 type=movie 启用 director 列）/ 复合过滤（date-range + 时区切换 + 业务 preset）。

**渐进迁移**：新模块默认用 filterable + filterFieldName；老模块 EP-5 已迁移（crawler-runs）保持 D-149-15 桥接 / 老模块未迁移优先用 D-150。3 原语 JSDoc 标 "D-149-15 桥接合约的复杂场景逃生口"。类型互斥（filterable: true 与 columnMenu.filterContent 二选一）。

### 4. API 契约（完整 TypeScript 类型）

#### 4.1 前端 column 类型扩展

```typescript
// packages/admin-ui/src/components/data-table/types.ts
export interface AutoFilterColumnFields {
  readonly filterable: true
  readonly filterFieldName: string
  readonly filterKind?: 'enum' | 'text' | 'number' | 'date'
  readonly filterOptions?: readonly FilterEnumOption[]
  readonly filterDistinctEndpoint?: string
  readonly filterDistinctTable?: string
}
export type TableColumn<T> = TableColumnBase<T> & (
  | AutoFilterColumnFields
  | { readonly filterable?: false | undefined }
)
```

#### 4.2 后端通用 distinct 端点

- 鉴权: `requireRole(['admin', 'moderator'])`
- Query schema: 详 §3 D-150-3
- 白名单注册: `apps/api/src/services/datatable/distinct-whitelist.ts`

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 错误码 |
|---|---|---|---|---|---|---|
| 1 | GET | `/admin/_dt/distinct` | 通用 distinct 列值查询（D-150-3 v1 共用端点 / 6 表白名单 / 三重 SQL 注入防御） | Query: `table` (enum 白名单 6 表) / `col` (字符串 + 后置 lookup 403) / `q?` (≤ 64 字符 / ILIKE 模糊匹配) / `limit?=50` (≤ 200 强制) | 200 `{ data: { value: string, count: number }[] }` | 422 VALIDATION_ERROR / 403 COLUMN_NOT_WHITELISTED / 500 INTERNAL_ERROR |

**响应 schema TS 类型**:
```typescript
interface DistinctResponse {
  readonly data: readonly {
    readonly value: string
    readonly label?: string  // 可选 i18n label（v1 不实装 / N1-150-4）
    readonly count?: number  // distinct count（v1 已实装）
  }[]
  readonly total?: number    // 可选总数（v1 不实装 / N1）
}
```

#### 4.3 统一过滤参数 schema

URL 写入：`?filters=<json-encoded>`

```typescript
// apps/api/src/services/datatable/filter-schema.ts
export const FilterValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), value: z.string().max(200) }),
  z.object({ kind: z.literal('number'), value: z.number() }),
  z.object({ kind: z.literal('bool'), value: z.boolean() }),
  z.object({ kind: z.literal('enum'), value: z.array(z.string().max(64)).max(50) }),
  z.object({ kind: z.literal('range'), min: z.number().optional(), max: z.number().optional() }),
  z.object({ kind: z.literal('date-range'), from: z.string().datetime().optional(), to: z.string().datetime().optional() }),
])
export const DtFiltersSchema = z.string().transform((s, ctx) => { /* JSON.parse + per-key FilterValueSchema 验证 */ }).optional()

function applyFilterValue<T>(query: T, col: AnyColumn, value: FilterValue): T {
  switch (value.kind) {
    case 'text': return query.where(ilike(col, `%${value.value}%`))
    case 'number': return query.where(eq(col, value.value))
    case 'enum': return query.where(inArray(col, [...value.value]))
    case 'bool': return query.where(eq(col, value.value))
    case 'range': return query.where(and(value.min !== undefined ? gte(col, value.min) : undefined, value.max !== undefined ? lte(col, value.max) : undefined))
    case 'date-range': return query.where(and(value.from ? gte(col, new Date(value.from)) : undefined, value.to ? lte(col, new Date(value.to)) : undefined))
  }
}
```

### 5. 5 阶段实施计划

| EP | 卡 ID | 范围 | 工时 | 依赖 |
|---|---|---|---|---|
| 阶段 1 | CHG-SN-9-DT-AUTOFILTER-ADR | ADR-150 评审 → @livefree PASS | — | 本卡 |
| 阶段 2 | CHG-SN-9-DT-AUTOFILTER-EP-1 | 共享 DataTableAutoFilter（替代 header-menu filterContent slot） + 数据类型推导 hook + Google Sheets 三段布局 popover + types.ts AutoFilterColumnFields union + 35 单测 | 0.6w | 阶段 1 |
| 阶段 3 | CHG-SN-9-DT-AUTOFILTER-EP-2 | 后端通用 distinct 端点 + distinct-whitelist.ts + filter-schema.ts + DtFiltersSchema 共享 zod + 6 表白名单注册 + 20 单测（SQL 注入 4 case） | 0.5w | 阶段 2 |
| 阶段 4 | CHG-SN-9-DT-AUTOFILTER-EP-3-A ~ -G | 12 消费方批量迁移（**串行 7 子卡**）：crawler-runs（首迁 D-149-15 → D-150）/ audit / submissions / users / videos / staging / image-health / merge / subtitles / sources / crawler / dev demo | 0.3w × 7 = 2.1w | 阶段 3 |
| 阶段 5 | CHG-SN-9-DT-AUTOFILTER-EP-4 | sources 排序全栈断链顺手修（5 层）+ EP-5-shared 3 原语 @逃生口 JSDoc + admin-module-template.md v2 双范式决策树 + @livefree 走读 5 代表页 + e2e smoke 3 case | 0.4w | 阶段 4 |

**总工时：约 3.6w**

**与 ADR-149 EP 序列关系**：本 ADR-150 阶段 2 ~ 阶段 5 是 **ADR-149 EP-5-* 序列的替代路径**。已规划的 EP-5-submissions / EP-5-users / EP-5-audit / EP-5-videos 4 子卡（合计 1.35w）可由本 ADR-150 阶段 4 子卡覆盖完成（工时省 ~50%）。EP-5-crawler-runs（已 commit）保留，迁移本 ADR-150 在阶段 4 子卡 A 内顺手做。

### 6. 不在本 ADR 范围

- 排序范式（ADR-149 D-149-4 已锁 / 阶段 5 仅修 sources bug）
- 矩阵 popover 语义（ADR-149 D-149-5 + AMENDMENT 2 EP-4.5-HOTFIX-4 保留）
- toolbar.search 槽位（ADR-149 D-149-13 保留）
- 业务 key 桥接 D-149-15 保留为复杂场景逃生口
- 多列过滤逻辑 AND/OR 嵌套（v1 硬编码 AND / N1-150-3）
- "按条件" / "按颜色" 过滤类型（v2 / N1-150-1/2）

### 7. 与 ADR-149 / EP-5-shared 关系

| 维度 | ADR-149 | ADR-150 v1 |
|---|---|---|
| 列名 ⋯ 触发器（D-149-3） | 保留 | 保留（接入新 popover） |
| 列名 toggle asc/desc（D-149-4） | 保留 | 保留 |
| 矩阵 popover 状态指示（D-149-5） | 保留 | 保留 |
| 列级 ⋯ filterContent slot（D-149-3） | 保留 | **降级为逃生口** |
| 业务 key 桥接（D-149-15） | 保留 | **降级为逃生口** |
| EP-5-shared 3 原语 | 主路径 | **逃生口路径**（JSDoc 标） |
| toolbar 三槽位（D-149-11/13/14） | 保留 | 保留（自动过滤迁出 toolbar 到列内） |
| 矩阵触发器接入（D-149-16） | 保留 | 保留 |

**ADR-103 关系**：本 ADR-150 是 **ADR-103 第 6 次 AMENDMENT 候选**（追加 `TableColumn<T>.filterable` / `filterFieldName` / `filterKind` / `filterOptions` / `filterDistinctEndpoint` / `filterDistinctTable` 共 6 个公开 API Props）。本 ADR Opus 评审产出即为强制评审证据。

### 8. R-MID-1 影响

**新增 1 个 admin route**：`GET /admin/_dt/distinct`（v1 单端点 / 阶段 3 实施）。`npm run verify:endpoint-adr` 自动核验本 ADR-150 作为 ADR 证据。`COLUMN_NOT_WHITELISTED` 是新 error code（403），需登记到 `apps/api/src/lib/errors.ts` ErrorCode enum + R-MID-1 真源对照表。零 actionType / 零 targetKind 新增（distinct 端点不写审计）。

### 9. 测试 surface（80-100 新增 / 现存全 PASS）

| 模块 | 用例数 | 增量维度 |
|---|---|---|
| data-table-auto-filter.tsx | ~35 | 数据类型推导 5 边界 / Google Sheets 三段布局 / 排序+过滤+OK / enum 静态 vs distinct 双轨 / 多选+搜索+全选 / 取消恢复初值 / a11y / 键盘 5 语义 |
| distinct-whitelist 单测 | ~8 | 白名单 miss → 403 / 表名 enum / 列名 lookup / drizzle column ref / SQL 注入 4 case |
| filter-schema 单测 | ~10 | 6 种 FilterValue 解析 / JSON parse 失败 / URL encode/decode / FILTER_FIELDS miss 静默 |
| `/admin/_dt/distinct` E2E | ~6 | 鉴权 401/403 / 白名单 404 / 模糊 q / limit 200 / 性能 SLA |
| 7 消费方迁移单测 | ~30 | filterable + filterFieldName + FILTER_FIELDS 同步 / URL sync / saved view 兼容 |

**用户走读硬约束**（阶段 5）：@livefree 走 5 代表页（crawler-runs / audit / users / videos / submissions）：列固有过滤 = 点列名 ⋯ → 三段布局正确 → 搜索 → 多选 → OK → URL 写入 → 数据真过滤（不假装）；videos 页 source-domain 列首次 fetch 200 项 / 二次缓存命中；video 页 type 列仍走 D-149-15 保留示例。

### 10. 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|------|------|------|
| R-150-1 | `/admin/_dt/distinct` SQL 注入 | **高** | 三重防御（zod enum + lookup + drizzle column ref / 禁 raw SQL）+ 8 单测含 4 注入 case |
| R-150-2 | 默认 filterable=false → 12 消费方逐列加（迁移工时） | 中 | 显式 opt-in + 一行声明 + union 守卫编译期防忘 filterFieldName |
| R-150-3 | enum distinct 大表性能 | 中 | LIMIT 200 + 必须索引 + 无索引列禁注册 + SWR 60s 缓存 + 失败 fallback |
| R-150-4 | SSR 首屏 rows=0 + mixed type 数据误判 | 中 | 显式 filterKind 覆盖 / 推导边界 5 单测 / SSR fallback 'text' |
| R-150-5 | 双范式（自动 vs D-149-15 桥接）并存让模板规范复杂 | 中 | admin-module-template.md v2 双范式决策树 + JSDoc 显式 |
| R-150-6 | 阶段 4 串行 7 子卡工时低估 | 中 | 每子卡独立 typecheck PASS + dev server 走读硬约束 + 30% 缓冲已加进 3.6w |
| R-150-7 | URL `?filters=<json>` 长度爆炸 | 低 | FilterValueSchema.enum.value.max(50) / 长 URL 走 N1 POST body fallback |
| R-150-8 | sources 排序断链 5 层超阶段 5 范围 | 低 | 阶段 5 拆 -A（前 4 层）/ -B（SourcesClient） |

### 11. N1 follow-up

- N1-150-1：自动过滤 v2 "按条件" 模式
- N1-150-2：自动过滤 v2 "按颜色" 模式（Token 颜色系统对接）
- N1-150-3：多列过滤逻辑 OR / 嵌套表达式（v1 硬编码 AND）
- N1-150-4：distinct API distinct count + i18n label 返回
- N1-150-5：long URL fallback POST body
- N1-150-6：ESLint 自定义 rule "Service 注册 FILTER_FIELDS 但 column 未加 filterable 提示"
- N1-150-7：EP-5-shared 3 原语与 AdminSelect/AdminInput 共享内部实现（DRY）
- N1-150-8：filterFieldName 与 column.id 完全对齐时的语法糖

### 12. 验证清单

- [x] 6 个 D-150-× 全 PASS 或显式 REVISED（D-150-3 REVISED / D-150-5 REVISED / 其余 4 PASS）
- [x] TypeScript 类型契约写完整（§4.1 union + §4.2/§4.3 后端 schema）
- [x] 后端通用 distinct 端点 SQL 注入防御写明（§3 D-150-3 + §10 R-150-1 三重防御）
- [x] 5 阶段实施计划 + 预算（§5 总 3.6w）
- [x] 与 ADR-149 / EP-5-shared 关系明示（§7 对照表）
- [ ] @livefree 人工审核 PASS → status 翻 Accepted
- [ ] `npm run verify:adr-contracts` 阶段 3 前 PASS（含新 endpoint）
- [ ] `npm run verify:endpoint-adr` 阶段 3 前 PASS（本 ADR 为新端点 ADR 证据）

### 13. 评审自评

**评级：A− CONDITIONAL PASS**

- ✅ 6 个决策点逐一论证 + 2 处 REVISED（D-150-3 双阶段 + D-150-5 默认 false）
- ✅ SQL 注入三重防御显式（zod enum + lookup + drizzle column ref）
- ✅ M-SN-8 "假装实现" 教训显式防御（D-150-5 默认 false 反 noop）
- ✅ 与 ADR-149 D-149-3/5/13/15 + EP-5-shared 关系明示（保留逃生口）
- ✅ CLAUDE.md "Route → Service → DB queries 不得跨层" 严格遵循（D-150-4 论证）
- ✅ 零 any / 零硬编码颜色 / 零空 catch
- ⚠️ 阶段 4 串行 7 子卡工时 2.1w 仍可能低估（30% 缓冲已加进 3.6w）
- ⚠️ D-150-5 REVISED 与主循环推荐组合分歧需 @livefree 仲裁

**条件**：D-150-5 REVISED 需 @livefree 决断是否接受"默认 false + 一行声明"；若坚持默认 true 则需补充 noop 防御（运行时 console.warn + 后端静默忽略策略文档化）。

**待 @livefree 人工审核**（status: 🟡 Proposed）

> **2026-05-24 仲裁**：@livefree 仲裁 PASS / status 🟢 Accepted（commit `1908ac39`）
> **2026-05-24 AMENDMENT 2**：D-150-5 union 守卫 NEGATED + 重构（详 ADR-150 AMENDMENT 2 §A2.2 D-150-AMD2-8 / 见下方章节）

---

## ADR-150 AMENDMENT 2 — DataTable 默认全列可过滤+可排序 / opt-out 范式 / column.kind marker（2026-05-24）

- **日期**：2026-05-24
- **状态**：🟢 Accepted（@livefree 仲裁 2 红线 R-A2-1 dev warn 足够 + R-A2-2 AMENDMENT 2 内一起实施 / 等同 PASS）
- **作者**：arch-reviewer (claude-opus-4-7) 独立起草 / 主循环 claude-opus-4-7 落档
- **触发**：阶段 4 EP-3-C sub C @livefree 根本性反问 + EP-3-A sub 1 EXTEND 同源反馈
- **关联 commit**：`4997515c`（EP-3-A sub 1）/ `aa9140f8`（EP-3-C sub C）/ ADR-150 主体 commit `1908ac39`
- **关联 GAP**：#UR-B5 升级 — 不仅"配置语义负担"，而是"opt-in 范式本身违反 DataTable 应作为通用基座的认知"

### A2.1 @livefree 反问引用

> "表格本身不能有通用的功能支持过滤，排序吗？Google spreadsheet 对数据的过滤排序支持是等表格创建之后，再逐个根据表格内容去实现功能的吗？"
>
> "列设置只是一个弹窗让用户自定义列的功能，而不是在开发时去觉得一个列是否支持排序，过滤。所有的列都是一样的，不应该区别对待，逐个开发实现专有的功能。表格最左侧的复选框也不应该作为一个列来对待，就像 Google spreadsheet 最左边一列显示行数的数字，不属于表格内容，而是用于表格操作交互的的。"

**核心原则提炼**：（1）DataTable = 通用基座 / 过滤排序默认全开；（2）selection 非数据列（已 chrome / 但 actions 仍混入）；（3）列设置 popover = 用户自定义入口（visibility + width）/ 非 dev opt-in 开关；（4）业务 column 仅描述数据 / filter/sort 自动。

### A2.2 AMENDMENT 2 决策点

#### D-150-AMD2-1 — column 默认 filterable + enableSorting（取代 D-150-1 opt-in 起点）

`TableColumn<T>` 在 `kind === 'data'`（或缺省）时：`filterable` 默认 `true` / `enableSorting` 默认 `true`。`filterKind` 默认由 `useFilterKindInference` 推断。消费方只需声明 `id / header / accessor`，过滤+排序立即可用。**REVISED**：取代 D-150-1 "双轨 opt-in" 默认起点（双轨内化为推断 + 静态覆盖二级语义）。

#### D-150-AMD2-2 — column.kind marker（方案 A enum 入选）

**方案 A 入选**：新增 `kind: 'data' | 'action' | 'media' | 'computed'` enum / 默认 `'data'`。

**论证拒 B/C**：
- 方案 B `isDataColumn: boolean` 信息量低 / 二元无法承载 `action` vs `media` 不同 chrome 行为
- 方案 C 隐式推断（id==='actions' / cell 内容判定）违反 M-SN-8"假装实现"——隐式约定不可静态校验
- 方案 A enum 显式 + 可扩展 + 编译期 narrow

**默认值与语义**：

| kind | 默认 filterable | 默认 enableSorting | 进矩阵 popover 数据格 | 进列设置 popover | 走 inference |
|---|---|---|---|---|---|
| `data`（缺省） | `true` | `true` | 是 | 是 | 是 |
| `action` | `false`（type 层 `never`） | `false`（`never`） | 否 | 否（pinned right 默认） | 否 |
| `media` | `false`（可显式 true） | `false`（可显式） | 否 | 是（width 可调） | 否 |
| `computed` | `false`（可显式 + 必传 filterFieldName） | `false`（可显式） | 条件 | 是 | 否 |

#### D-150-AMD2-3 — filterFieldName 默认 = column.id（D-150-4 保留 / 降级为覆盖语义）

`data` kind column 缺省 `filterFieldName` 时，DataTable 内部 fallback 至 `column.id`。消费方仅在 column.id ≠ 业务 key 时显式覆盖（如 `id: 'username', filterFieldName: 'q'`）。D-150-4 桥接合约**保留**为"显式覆盖"语义。

#### D-150-AMD2-4 — filterKind 默认走 inference（D-150-2 强化为默认运行）

`use-filter-kind-inference.ts`（已实装 30 行采样 + 5 边界）从"D-150-2 默认+覆盖"升级为"data kind column 默认运行"。消费方 `filterKind` 显式声明永远优先（D-150-2 保留语义）。

#### D-150-AMD2-5 — filterOptions enum 默认 rows distinct 派生（D-150-1 enum 静态二级化）

`filterKind === 'enum'` 且未显式 `filterOptions` 且未显式 `filterDistinctEndpoint` 时，`EnumValueList` 已实装的"rows accessor 派生 fallback"（sub 2 EXTEND BUG 修复后）作为默认值来源。消费方显式静态选项优先（保 i18n label / 显示顺序控制 / 固定枚举 0 RTT）。

#### D-150-AMD2-6 — mode="client" 100% 前端过滤+排序默认（保留 + 强化）

`mode="client"` 时 DataTable 内部完成全部过滤+排序计算 / 零后端依赖 / 零 fetch deps 协调成本。

#### D-150-AMD2-7 — mode="server" dev warn 兜底（@livefree 仲裁 R-A2-1: dev warn 足够）

`mode="server"` 时：（1）消费方 column 未显式 `filterFieldName` → fallback `column.id` 写入 URL；（2）消费方 fetch hook 必须将 URL `filters` 参数透传到后端 query / Service 层 `FILTER_FIELDS` 白名单消费。

**M-SN-8 防御三重**（@livefree R-A2-1 仲裁 dev warn 足够 / 不升 prod throw）：
1. **dev warn**：DataTable 监测到 `mode==='server'` + column 缺省 filterFieldName + column.id 含非业务命名特征 → `console.warn`
2. **opt-out review**：4 已迁消费方实施前 review server mode column.id 与后端 FILTER_FIELDS 对齐
3. **E2E smoke 真过滤断言**：ADR-150 阶段 5 EP-4 走读 5 代表页时 fetch URL params 真过滤验证

#### D-150-AMD2-8 — D-150-5 union 守卫重构（filterable: true + filterFieldName 必填 → NEGATED）

D-150-5 原"filterable: true 时 filterFieldName 必填"**NEGATED**。新守卫（discriminated union by kind）：
- `kind: 'data'`（缺省）时 `filterable` 默认 true / `filterFieldName` 默认 column.id / 均可显式覆盖
- `kind: 'action'` 时 `filterable` / `filterFieldName` / `filterKind` / `filterOptions` / `filterDistinctEndpoint` 类型层强制 `never`
- `kind: 'media' | 'computed'` 时 `filterable` 默认 false / 显式 true 时 `filterFieldName` 仍可 fallback column.id

#### D-150-AMD2-9 — 列设置 popover 范围澄清

| popover | 职责 | 不职责 |
|---|---|---|
| 列设置（矩阵 visibility 格） | visibility toggle / width 调整（v2） / pin（v2） | filter/sort 启用开关 |
| 列名 ⋯ / 矩阵过滤格 | 排序 ↑↓× / 过滤值列表 + 搜索 + OK | 列是否"被允许"过滤（已永远允许） |
| 矩阵 filter 格行 | 显示当前 data kind column 的已过滤状态摘要 | `action` / `media` 列不出现在此格 |

### A2.3 与 D-150-1..6 关系对照

| 决策点 | 状态 | 新语义 |
|---|---|---|
| D-150-1 enum 双轨 | **修订** | 默认起点从"消费方必选其一"→"零声明 distinct 派生" |
| D-150-2 推断 | **保留 + 强化** | 从"默认+覆盖"→"data kind 默认运行" |
| D-150-3 distinct 端点 | **保留** | 三重 SQL 注入防御不变 / 仅在消费方显式 `filterDistinctEndpoint` 时使用 |
| D-150-4 业务 key 桥接 | **保留 + 降级语义** | 从"happy path"→"column.id ≠ 业务 key 时显式覆盖" |
| D-150-5 union 守卫 | **NEGATED + 重构** | 见 D-150-AMD2-8 / discriminated union by kind |
| D-150-6 互斥 | **保留** | columnMenu.filterContent 仍作复杂逃生口 / data kind + filterContent 仍 dev warn |

### A2.4 核心 API 变化对照

**旧 opt-in**（D-150-5 / sub C 前）：
```ts
{ id: 'status', accessor, header,
  filterable: true, filterFieldName: 'status',
  filterKind: 'enum', filterOptions: STATUS_OPTIONS }  // 4 行 filter props
```

**新 opt-out**（AMENDMENT 2 / data kind 缺省）：
```ts
{ id: 'status', accessor, header,
  filterOptions: STATUS_OPTIONS }  // 仅静态 i18n label 覆盖
```

**actions 列**（非数据列 / kind marker）：
```ts
{ id: 'actions', kind: 'action', accessor: () => null, header: '',
  cell: ({ row }) => <RowActions row={row} />, pinned: 'right' }
```

### A2.5 column.kind 类型设计（discriminated union）

```ts
type DataKindColumn<T> = TableColumnBase<T> & { readonly kind?: 'data' } & AutoFilterColumnFields
type ActionKindColumn<T> = TableColumnBase<T> & { readonly kind: 'action' } & {
  readonly filterable?: never; readonly filterFieldName?: never
  readonly filterKind?: never; readonly filterOptions?: never; readonly filterDistinctEndpoint?: never
}
type MediaKindColumn<T> = TableColumnBase<T> & { readonly kind: 'media' } & Partial<AutoFilterColumnFields>
type ComputedKindColumn<T> = TableColumnBase<T> & { readonly kind: 'computed' } & AutoFilterColumnFields
export type TableColumn<T> = DataKindColumn<T> | ActionKindColumn<T> | MediaKindColumn<T> | ComputedKindColumn<T>
```

### A2.6 影响范围

- **共享层**：types.ts union 改造 / DataTable.tsx 矩阵 popover 跳过 non-data kind / inference 触发条件改为 `kind === 'data'` 默认运行 / filterFieldName fallback column.id
- **4 已迁消费方 opt-out review**（@livefree R-A2-2 仲裁 AMENDMENT 2 内一起实施）：
  - CrawlerRunsView：`actions` 列加 `kind: 'action'`（如有）/ 其它 column 验证 data kind 默认
  - AuditClient：`actions` 列加 `kind: 'action'` / target enum 保留显式 options
  - UsersListClient：`actions` 列加 `kind: 'action'` / roleBadge 装饰列若有
  - VideoListClient：`cover` 缩略图列 → `'media'` / `actions` → `'action'`
- **EP-3-D/E/F/G 后续**：每表 column 定义减少 60%+ 行数

### A2.7 实施路径（同卡内一起实施 / @livefree R-A2-2 仲裁）

1. **共享层改造**（types.ts kind union + DataTable.tsx 内部 `kind === 'data'` filter + filter-chip kind 筛选 + dev warn）
2. **inference 触发条件改**（useFilterKindInference 入口先判 `column.kind ?? 'data'`）
3. **4 已迁消费方 review opt-out**
4. **后续 EP-3-D/E/F/G 按新范式**（消费方 column 定义减负）
5. **文档同步**（reference.md §4.4 + admin-module-template.md v2 决策树 + ADR-149/150 主体 cross-reference）

### A2.8 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|---|---|---|
| RA2-1 | DataTable 默认值改属共享层公开 API 语义变化 | **高** | discriminated union 默认 kind = 'data' 不破坏现有类型；运行时行为变化由 4 消费方 opt-out review 兜底 |
| RA2-2 | mode="server" filterFieldName fallback column.id 后端 FILTER_FIELDS 未注册 → 静默忽略 | **高** | dev warn + opt-out review + E2E smoke 三重防御（@livefree R-A2-1 仲裁 dev warn 足够） |
| RA2-3 | inference 对非 string/number/boolean 数据推断错误 | 中 | 已有 5 边界单测覆盖 mixed type fallback 'text'；新增 Date 对象单测 |
| RA2-4 | EnumValueList rows distinct 派生在 server mode 分页 100 条不能推 enum 全集 | 中 | 文档显式：server mode + 开放枚举 → 消费方必须显式 `filterDistinctEndpoint` |
| RA2-5 | discriminated union 改造影响 21 admin-ui/table 单测 + 各消费方单测 | 中 | union narrow 默认 kind = 'data' 不破坏现有测试 |

**回退路径**：types.ts kind 字段 + DataTable kind 判定回滚 commit revert + 4 消费方 opt-out commit 独立 revert。

### A2.9 测试覆盖

- **现有 21 admin-ui/table 单测**：union 默认 kind = 'data' 不破坏 / 全 PASS
- **新增 ~20 单测**：column.kind 4 值 × 矩阵 popover 显隐 / inference 触发 / filterFieldName fallback / dev warn server mode noop / mixed kind columns 矩阵格筛选
- **4 消费方单测 review**：opt-out 后 typecheck PASS + 行为断言
- **E2E smoke 3 case**（留 ADR-150 阶段 5 EP-4）

### A2.10 评级（arch-reviewer Opus 独立起草）

**A− CONDITIONAL PASS → @livefree 仲裁后 ACCEPTED**

### A2.11 ADR-151 vs AMENDMENT 2 决断

**判定：AMENDMENT 2（不升 ADR-151）**

论证：（1）核心范式延续；（2）D-150-1..6 5/6 决策点保留；（3）API 契约延续；（4）实施路径耦合阶段 4 EP-3-D/E/F/G；（5）历史范式对齐 ADR-149 AMENDMENT 1。

反例排除：本 AMENDMENT 2 不触及（a）后端 FILTER_FIELDS schema 重构 / 或（b）DataTable mode 语义新增 / 或（c）矩阵 popover 数据模型重构 → 不升 ADR-151。

**结论**：AMENDMENT 2 形式追加到 decisions.md ADR-150 末尾 / status 🟢 Accepted（主体 + AMENDMENT 2 经 @livefree 2 红线仲裁等同 PASS）

---

## ADR-151 — task 级 cancel 端点协议（CHG-SN-9-CW1-B-ADR / Bug-A 修复）

> **Status**: 🟢 Accepted（2026-05-25 / arch-reviewer Opus A− CONDITIONAL → 主循环修订 R3+Y3+G1 后等同 A / 详见末段评审结论）
> **触发**：用户反馈"采集任务出现'排队中'状态，无法暂停或取消" → CW1-B Bug-A 根因 = `CrawlerRunDetailView.tsx:226-242` task 表 ops 列只有「查看」按钮，文件头部注释明确"tasks 行操作 cancel/retry 不在范围"；后端无 task 级 cancel 端点，只能通过父 run cancel 间接命中。
> **协议触发**：CLAUDE.md "❌ 新增 admin route 未先起独立 ADR + Opus PASS"（plan §4.5 R7 MUST-8 / `npm run verify:endpoint-adr` 自动核验）→ 本 ADR 是 CW1-B-EP 实施的硬前置。
> **关联**：ADR-117（探测/重探协议 / task cancel 模式范式参考）、ADR-122（crawler 重做契约）、ADR-150 AMENDMENT 2（DataTable kind=action 列不进 popover 范式）

### §1 决策摘要

新增 2 个 task 级 cancel 端点 + 对应 2 个 DB query + 1 个 audit actionType + 前端 task 表 ops 列 [取消] 按钮 + 表头多选 batch。**复用现有 cancel_requested 字段 + worker 15s 控制响应链路**（`crawlerWorker.ts:168` controlCheckTimer 已实装），不引入新状态机字段。

```
端点契约：
  POST /admin/crawler/tasks/:id/cancel          — 单 task 取消
  POST /admin/crawler/tasks/batch-cancel        — 批量 task 取消（最多 100 个）

行为契约：
  task.status='pending' (UI 'queued')  →  直接置 'cancelled' + cancel_requested=true + finished_at=NOW()
  task.status='running'                →  仅置 cancel_requested=true / 等 worker 15s 内响应（DB.status 由 worker 写）
  task.status='paused'                 →  直接置 'cancelled' + cancel_requested=true + finished_at=NOW()
  task.status='done|failed|cancelled|timeout'  →  返回 422 STATE_CONFLICT
```

### §2 背景与问题

#### 2.1 当前现状

- **task 级 UI**：`apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx:226-242` ops 列**只有「查看」按钮**（开 TaskLogsDrawer），无 cancel/pause。文件头部注释 line 11："tasks 行操作（cancel/retry）"列入"不在范围（独立卡）"。
- **task 级后端**：`apps/api/src/routes/admin/crawler.tasks.ts` 完全无 task 级 cancel 路由。`apps/api/src/db/queries/crawlerTasks.ts` 已有 `requestTaskCancel(db, id)` 函数（line 118-125 / 仅置 cancel_requested=true），但**未被任何路由消费**。
- **现有 cancel 路径**：
  - `cancelPendingTasksByRun(db, runId)`（line 127-139）批量置 pending → cancelled
  - `requestCancelRunningTasksByRun(db, runId)`（line 141-151）批量置 running task cancel_requested=true
  - `cancelAllActiveTasks(db)`（line 153-186）三态（pending/paused/running）全停（stop_all 路径）
  - 这三个函数**全部 run 维度**，无 task 维度入口

#### 2.2 用户痛点

- 一个 run 里 N 个 task / queued 状态有些已确认无需采集（如临时排错）→ 想单独取消某 1 个不影响其它 → 当前只能取消整个 run 或者等待
- 一个 run 跑到 50% 时部分 task 已 cancelled / 部分 running / 剩余 N 个 queued → 想批量取消剩余 queued → 当前无入口
- task 级 cancel UI 缺失 = 用户运维粒度被强制拉粗到 run 级

#### 2.3 既有保护

- worker 端 15s 控制响应（`crawlerWorker.ts:168` controlCheckTimer）已实装 → 一旦 cancel_requested=true，worker 在 15s 内主动 abort 当前 fetch
- worker 全局 freeze 检查 / heartbeat watchdog 均独立于 cancel 路径
- task 状态机 LEGAL_TRANSITIONS 由 `crawler_tasks.queries.ts:65-83` updateTaskStatus 函数管理（finished 三态: done/failed/cancelled/timeout 写入 finished_at）

### §3 6 决策点

#### D-151-1：端点 path 与 verb 设计

**选项**：
- A. POST /admin/crawler/tasks/:id/cancel + POST /admin/crawler/tasks/batch-cancel（独立 2 路由 / RESTful 单复数）
- B. POST /admin/crawler/tasks/cancel（body 含 `ids: string[]` / 单复数统一）
- C. PATCH /admin/crawler/tasks/:id（body `{status:'cancelled'}` / 通用 PATCH）

**决策**：**A** —— 与 ADR-117 + ADR-122 单/批 cancel 范式一致（参 `crawler.runs.ts:188` `/runs/:id/cancel` + `crawler.tasks.ts:246` `/stop-all`）；batch-cancel 命名"批量"显式 + 限制 ≤100 个防滥用；REST 资源/动作清晰。

**反例排除**：B 单端点 `ids` 数组隐藏单个语义 + 错误响应混乱；C 通用 PATCH 与现有 run cancel 范式（POST 动作端点）不一致。

#### D-151-2：task 状态机扩展

**决策**：**不扩展，复用 cancel_requested 字段 + 三态映射**
- `status='pending'` → DB.status='cancelled' + cancel_requested=true + finished_at=NOW() + result.reason='task_manual_cancel'
- `status='running'` → 仅 cancel_requested=true（DB.status 保持 running / worker 15s 内 abort + 更新 status='cancelled'）
- `status='paused'` → 同 pending（直接 cancelled）
- `status` ∈ {done, failed, cancelled, timeout} → 返回 422 STATE_CONFLICT 错误 "TASK_TERMINAL_STATE_CANCEL_FORBIDDEN"

**反例排除**：不引入 `'cancelling'` 中间态 → run 级已有 controlStatus='cancelling' 概念（在 crawler_runs 表），task 级若加 controlStatus 字段需 migration / 与 run.controlStatus 语义混淆 / 复用 cancel_requested 已可达 worker 15s 响应。

#### D-151-3：batch 原子性

**决策**：**逐个处理 + 部分失败响应**（非事务）
- 接收 ids: string[] (max 100, min 1)
- 逐个调 cancelTaskById(taskId)；ID 不存在 / 终态 / 已请求 → 累加 errors 数组或 alreadyRequested 计数
- 响应：`{ data: { summary: { cancelled: number, cancelRequested: number, alreadyRequested: number, errors: ErrorEntry[] }, runIds: string[] }, processed: number }` —— summary 三元拆分对齐单 cancel 的 finalStatus 概念（Y-151-4 修订）
- runIds = unique 涉及的父 run IDs → **for-of 串行**触发 `syncRunStatusFromTasks(runId)` 同步状态；同 run 多 task cancel 不引发并发 race（**R-151-1 修订**：与现有 4 处历史范式 `crawler.tasks.ts:267-269 / crawlerScheduler.ts:68/83 / crawler.ts:155` 全部串行对齐）
- syncRun best-effort 容错：单个 syncRun throw → warn 日志 + 计入 failedRunSyncIds[] 数组返回 / 不阻塞主响应（Y-151-1 修订）

**反例排除**：
- 事务式（全成功或全回滚）会因 1 个 ID 不存在导致 99 个有效 cancel 全部失效 → 运维使用不友好。
- Promise.all 并发 syncRun：与现有 4 处串行范式硬冲突 + syncRunStatusFromTasks 内含 SUM/CASE 聚合 UPDATE 同 run 并发会 race（末次写入覆盖）。性能优化应作为 follow-up 在 syncRunStatusFromTasks 函数内引入 advisory lock，而不是在调用方加并发。

#### D-151-4：audit actionType 命名

**决策**：**`crawler_task.cancel` + `crawler_task.batch_cancel`**
- 单点：actionType=`crawler_task.cancel` / targetKind=`crawler_task` / targetId=taskId（UUID）/ before={status, cancel_requested} / after={status:'cancelled' OR cancel_requested:true, reason:'manual', actorId}
- 批量：actionType=`crawler_task.batch_cancel` / targetKind=`system` / targetId='batch_cancel' / before=null / after={count, ids[已截 ≤20 个含 ...], cancelled, errors[已截 ≤10 个], runIds[已截 ≤10 个]}

**对齐**：与 `crawler_run.cancel`（ADR-122 沿用）+ `crawler_site.batch`（CHG-SN-6-14）命名范式一致；前缀 `crawler_task.` 与 `crawler_run.` / `crawler_site.` 同级 namespace。

#### D-151-5：已 paused task 处理 + Bull queue 漂移收口

**决策**：**纳入 cancel 入口 / 与 pending 同等处理（直接 cancelled）+ 配套 worker 守卫扩展**
- paused task 实际是 worker 之前因父 run pause 而延迟重排队（30s）的任务
- 父 run 后续 resume → paused task 自然进 running；但若用户**已不想恢复**且想 cancel → UI 应可达
- 复用 `cancelAllActiveTasks` 已对 paused 三态全处理的范式（`crawler.tasks.ts:163`）

**已知 Bull queue 漂移（R-151-3 修订）**：

paused task 被 cancel 后 DB 已是 `status='cancelled' + finished_at=NOW() + cancel_requested=true`，但 Bull queue 里仍有 30s delayed job（`crawlerWorker.ts:139`）。30s 后 worker 拿到 job → 进入 `processCrawlJob:145-153` 守卫：
```ts
const task = await crawlerTasksQueries.getTaskById(db, taskId)
if (task?.cancelRequested) {
  await crawlerTasksQueries.updateTaskStatus(db, taskId, 'cancelled', { reason: 'CANCEL_REQUESTED' })
  ...
}
```
**该守卫只读 cancelRequested 字段不读 status**，会重新调用 `updateTaskStatus(..., 'cancelled', ...)`（`crawlerTasks.ts:65-83`）→ 重置 `finished_at=NOW()` 覆盖首次 manual cancel 时间戳 + result.reason 从 `'task_manual_cancel'` 被覆盖为 `'CANCEL_REQUESTED'` → **首次 manual cancel 痕迹完全丢失**。

**修订方案（推荐方案 A）**：worker 守卫前加 terminal status 短路。在 `crawlerWorker.ts:145-153` 前插入：
```ts
if (task && ['cancelled', 'done', 'failed', 'timeout'].includes(task.status)) {
  await logTask('info', 'worker.task.already_terminal', '任务已是终态，跳过 worker 处理', { status: task.status })
  if (runId) await crawlerRunsQueries.syncRunStatusFromTasks(db, runId)
  return { type, sites: siteKey ? [siteKey] : [], videosUpserted: 0, sourcesUpserted: 0, errors: 0, durationMs: 0 }
}
if (task?.cancelRequested) { ... }
```

**实施约束（→ CW1-B-EP §10 step 6 必跑）**：worker 守卫扩展是 ADR-151 落地的硬依赖，**不可与 cancel 端点分卡实施**，否则将引入审计漂移。

**反例排除**：若不纳入 paused 维度，UI 只能让用户先 resume run → 等 task running → 再 cancel，多步骤；或者只能 stop-all 全停。

**替代方案**（不采纳，留 follow-up）：
- 方案 B：`updateTaskStatus` 函数加 `WHERE id=$4 AND status NOT IN ('cancelled','done','failed','timeout')` 守卫 — 影响面更广（所有 updateTaskStatus 调用点）/ 与现有"幂等更新"语义对齐难
- 方案 C：cancelTaskById 对 paused 分支额外 `crawlerQueue.removeJobs(...)` 清理 delayed job — 侵入 Bull / 风险更高 / 若 Bull API 失败 cancel 整体失败 / 留作 Fix-N 后续优化

#### D-151-6：cancel 与父 run 状态联动

**决策**：**cancel 后立即触发 `syncRunStatusFromTasks(runId)`**
- 单点 cancel：响应前同步触发该 run 的 syncRun
- 批量 cancel：unique runIds 全部触发（Promise.all 并发）+ audit after.runIds 记录
- syncRunStatusFromTasks 会根据 task 状态聚合判定 run 最终 status（success / partial_failed / failed / cancelled）
- **副作用**：若 run 全部 task 被 cancel → run.status='cancelled'（与 stop-all 路径同效）；若部分 task cancelled + 其它 done → 可能进 partial_failed（按现有聚合规则）

**反例排除**：不触发 syncRun → CrawlerRunsView 列表页 run 状态滞后 60s（scheduler periodic sync） → 用户体验不对齐；UI 显示父 run 仍 running 但全 task 已 cancelled。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/admin/crawler/tasks/:id/cancel` | task 级单点 cancel（含 R-151-2 幂等守卫） | Path: `id: uuid` / 空 body | 200 `{ data: { task: CrawlerTaskDto, runId, finalStatus, alreadyRequested } }` | admin | 404 NOT_FOUND / 422 TASK_CANCEL_FORBIDDEN_TERMINAL / 422 VALIDATION_ERROR |
| 2 | POST | `/admin/crawler/tasks/batch-cancel` | task 级 batch cancel（summary 三元拆分 + best-effort syncRun） | Body: `{ ids: string[].min(1).max(100) }` | 200 `{ data: { summary, runIds, failedRunSyncIds }, processed }` | admin | 422 VALIDATION_ERROR（单 id 错失计入 summary.errors[]） |

### §4 端点契约详表（按字段拆解）

| 字段 | POST /admin/crawler/tasks/:id/cancel | POST /admin/crawler/tasks/batch-cancel |
|------|--------------------------------------|----------------------------------------|
| Path Param | id (UUID) | — |
| Body Schema | 无（空 body） | `{ ids: string[].min(1).max(100) }` |
| Auth | admin only（fastify.requireRole(['admin'])） | 同 |
| Success Status | 200 | 200 |
| Response Body | `{ data: { task: CrawlerTaskDto, runId: string \| null, finalStatus: 'cancelled' \| 'cancel_requested' } }` | `{ data: { cancelled: number, errors: ErrorEntry[], runIds: string[] }, processed: number }` |
| Error 404 | task 不存在 | 单个 id 错失计入 errors[]（响应仍 200） |
| Error 422 STATE_CONFLICT | task 终态（done/failed/cancelled/timeout / code=TASK_CANCEL_FORBIDDEN_TERMINAL）| 同上单独计入 errors[] |
| Error 422 VALIDATION_ERROR | id 不是 UUID | ids 为空 / 超 100 / 非 UUID |
| Side Effect | cancelTaskById(taskId) → syncRunStatusFromTasks(runId) → audit `crawler_task.cancel` | batchCancelTasks(ids) → for-of 串行 syncRun for unique runIds → audit `crawler_task.batch_cancel` |
| Worker 响应延迟 | running task 最大 15s（controlCheckTimer 间隔） | 同 |
| 响应增强 | 单 cancel 含 `alreadyRequested?: boolean`（R-151-2 幂等守卫） | batch 含 `summary` 三元拆分 + `failedRunSyncIds[]`（Y-151-1/4） |

ErrorEntry: `{ id: string, code: 'NOT_FOUND' \| 'STATE_CONFLICT', reason: string }`

### §5 SQL 设计

#### 5.1 cancelTaskById(db, taskId) — 新 query（R-151-2 修订：幂等守卫）

```ts
export async function cancelTaskById(
  db: Pool,
  taskId: string,
): Promise<{
  task: CrawlerTask
  runId: string | null
  finalStatus: 'cancelled' | 'cancel_requested'
  alreadyRequested?: boolean
} | null> {
  const existing = await getTaskById(db, taskId)
  if (!existing) return null
  if (['done', 'failed', 'cancelled', 'timeout'].includes(existing.status)) {
    throw new AppError('STATE_CONFLICT', 'TASK_CANCEL_FORBIDDEN_TERMINAL', 422)
  }
  if (existing.status === 'running') {
    // R-151-2 修订：已请求未响应 → 幂等返回 200 + alreadyRequested=true
    // 避免重复写 cancelRequestedAt 时间戳 + 避免重复 audit 噪声 + UI 不报 409
    if (existing.cancelRequested) {
      return {
        task: existing,
        runId: existing.runId,
        finalStatus: 'cancel_requested',
        alreadyRequested: true,
      }
    }
    await db.query(
      `UPDATE crawler_tasks
         SET cancel_requested = true,
             result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('cancelRequestedAt', NOW(), 'reason', 'task_manual_cancel')
         WHERE id = $1`,
      [taskId],
    )
    return { task: { ...existing, cancelRequested: true }, runId: existing.runId, finalStatus: 'cancel_requested' }
  }
  // pending / paused → 直接 cancelled
  await db.query(
    `UPDATE crawler_tasks
       SET status = 'cancelled', finished_at = NOW(), cancel_requested = true,
           result = COALESCE(result, '{}'::jsonb) || jsonb_build_object('reason', 'task_manual_cancel')
       WHERE id = $1`,
    [taskId],
  )
  const refreshed = await getTaskById(db, taskId)
  return { task: refreshed!, runId: existing.runId, finalStatus: 'cancelled' }
}
```

#### 5.2 batchCancelTasks(db, taskIds) — 新 query（R-151-1 修订：syncRun for-of 串行）

```ts
export async function batchCancelTasks(
  db: Pool,
  taskIds: readonly string[],
): Promise<{
  summary: { cancelled: number; cancelRequested: number; alreadyRequested: number; errors: ErrorEntry[] }
  runIds: string[]
  failedRunSyncIds: string[]
}> {
  const errors: ErrorEntry[] = []
  const cancelledRunIds = new Set<string>()
  let cancelled = 0
  let cancelRequested = 0
  let alreadyRequested = 0

  // 第一阶段：逐个 cancel（DB 写入）
  for (const id of taskIds) {
    try {
      const result = await cancelTaskById(db, id)
      if (!result) {
        errors.push({ id, code: 'NOT_FOUND', reason: 'task not found' })
        continue
      }
      if (result.alreadyRequested) alreadyRequested++
      else if (result.finalStatus === 'cancelled') cancelled++
      else if (result.finalStatus === 'cancel_requested') cancelRequested++
      if (result.runId) cancelledRunIds.add(result.runId)
    } catch (err) {
      if (err instanceof AppError && err.code === 'STATE_CONFLICT') {
        errors.push({ id, code: 'STATE_CONFLICT', reason: err.message })
        continue
      }
      throw err
    }
  }

  // 第二阶段：R-151-1 修订 — for-of 串行触发 syncRun（与现有 4 处历史范式对齐 / 同 run 并发会 race）
  const failedRunSyncIds: string[] = []
  for (const runId of cancelledRunIds) {
    try {
      await syncRunStatusFromTasks(db, runId)
    } catch (err) {
      // Y-151-1 修订：syncRun best-effort 容错 / 不阻塞主响应
      failedRunSyncIds.push(runId)
      // 调用方（route）会 warn 日志
    }
  }

  return {
    summary: { cancelled, cancelRequested, alreadyRequested, errors },
    runIds: Array.from(cancelledRunIds),
    failedRunSyncIds,
  }
}
```

### §6 R-MID-1 第 N 次系统化（4 文件框架核对）

mutation 端点典型 4 文件框架：route + service + queries + types

| 层 | 是否新建 | 复用情况 |
|----|---------|---------|
| route | ✅ 新增 2 路由 in `apps/api/src/routes/admin/crawler.tasks.ts` | 同文件复用 mapTaskDto / AuditLogService |
| service | ❌ 不新建 | 简单 cancel 逻辑直接在 queries 层完成 / 无 cross-entity 业务逻辑 |
| queries | ✅ 新建 2 函数 in `apps/api/src/db/queries/crawlerTasks.ts` | 复用 getTaskById / syncRunStatusFromTasks |
| types | ❌ 不新建 | 响应 DTO 直接用 CrawlerTaskDto + 内联 ErrorEntry interface |

**结论**：R-MID-1 简化为 2 文件框架（route + queries）/ 与 ADR-117 / ADR-122 R-MID-1 简化范式一致。

### §7 性能 baseline（Y-151-3 修订）

- 单 cancel：1 SELECT + 1 UPDATE + 1 SELECT + 1 syncRunStatusFromTasks（含父 run 聚合 SQL）≈ p95 ≤ 100ms
- batch 100 cancel：第一阶段 100 × 单 cancel ≈ 10s；第二阶段 unique runIds × p95(syncRun ~30ms) ≈ 50–500ms（取决于 N） → 总 p95 ≤ **15s**
- Fastify 默认 request timeout：本卡新端点需在 route options 显式声明 `bodyLimit + timeout` ≥ 20s（覆盖 batch 100 worst case），若运维实测 p95 > 15s 则考虑：(a) batch 上限改 50 / (b) syncRunStatusFromTasks 函数内引入 advisory lock 后并发 / (c) 异步化（202 Accepted + 轮询）—— 后两条留 follow-up
- 并发：site-level 互斥（findActiveTaskBySite）+ task-level 无锁（cancel 是状态机标记 / 与 cancelPendingTasksByRun 已有的并发模式一致）

### §8 分层约束 / 越层检测

- route → queries 直接调用（service 跳过 / R-MID-1 简化）
- route 含 audit + zod validation + STATE_CONFLICT 422 错误映射
- queries 含 SQL + 状态机守卫（throw STATE_CONFLICT for terminal）
- UI 层 onClick → apiClient.post → 路由 → queries

### §9 关联 ADR

- ADR-117（探测/重探协议）：cancel + reprobe 同属 task 控制平面范式
- ADR-122（crawler 重做契约）：本 ADR 是 task 控制平面缺口的补齐
- ADR-150 AMENDMENT 2（kind='action' 列不进 popover）：CrawlerRunDetailView task 表 ops 列已 opt-out kind='action'，本 ADR UI 在 ops 列内加按钮 + 表头多选不影响 popover 规则

### §10 实施路径（→ CW1-B-EP 实施卡）

1. queries：cancelTaskById + batchCancelTasks（+ 单测 7 case：terminal 状态 / running 首次 / running 已请求幂等 / pending / paused / not found / batch 部分失败 + failedRunSyncIds）
2. route：2 端点 + audit + 单测 6 case（含 batch summary 三元 / errors[] 截断 / failedRunSyncIds 警告路径）
3. 前端：CrawlerRunDetailView ops 列 [取消] 按钮（仅 queued/running/paused 可点 / pendingCancelId state 防重复 click / alreadyRequested 时 toast info 不报错）+ 表头多选 + sticky bulk action bar（**G-151-3 配套约定**：selection.mode='page'，bulk bar 仅在 selectedKeys.size > 0 渲染，无二次 confirm 但 batch 50+ 时弹 confirm）
4. api client：cancelCrawlerTask + batchCancelCrawlerTasks
5. e2e smoke：CrawlerRunDetailView 加 task cancel 路径（mock + URL 验证）
6. **R-151-3 配套（硬依赖）**：`apps/api/src/workers/crawlerWorker.ts:145-153` 守卫前加 terminal status 短路 — 防 paused task 被 cancel 后 30s Bull delayed job 触发 worker 覆盖 finished_at + reason 漂移。**该步骤不可与 cancel 端点分卡实施**，否则将引入审计漂移回归

### §11 已识别 follow-up（不阻塞本 ADR）

- **N1（advisory）**：worker 端 cancel_requested 响应可补 metric `crawler_task_cancel_latency_seconds` histogram → 度量 15s 是否真满足；落 Fix-10 监控增强卡
- **N2（advisory）**：UI 上 cancel 后 task badge 即时 → cancelled / 但实际 worker running task 是 cancel_requested → cancelled 异步；UI 可加"取消中"中间 badge 改善 UX；属 UX 增强 follow-up（非阻塞）

---

**评审结果**：arch-reviewer Opus 1 轮 → **A− CONDITIONAL PASS** → 主循环修订红线 3 + 黄线 4 + 绿线 1 后 → **🟢 Accepted**

修订摘要（已落盘 ADR-151）：
- ✅ R-151-1 §D-151-3 + §5.2：Promise.all → for-of 串行（与现有 4 处历史范式 crawler.tasks.ts:267 / crawlerScheduler.ts:68/83 / crawler.ts:155 对齐）
- ✅ R-151-2 §5.1：running 分支加 cancelRequested 幂等守卫 + 响应增 alreadyRequested 字段（避免 audit 漂移）
- ✅ R-151-3 §D-151-5 + §10 step 6：worker 守卫前加 terminal status 短路（方案 A 推荐 / 不侵入 Bull）+ 硬依赖声明
- ✅ Y-151-1 §D-151-3 + §5.2：syncRun best-effort 容错 + failedRunSyncIds[] 返回 + warn 日志
- ✅ Y-151-3 §7：性能 baseline 5s → 15s 实事求是 + 3 follow-up 选项明确
- ✅ Y-151-4 §D-151-3 + §4：batch 响应 summary 三元拆分（cancelled / cancelRequested / alreadyRequested）+ errors[] 独立
- ✅ G-151-2 §4 + §5.1：error code TASK_TERMINAL_STATE_CANCEL_FORBIDDEN → TASK_CANCEL_FORBIDDEN_TERMINAL（28→27 字符 / 与现有范式对齐）
- ✅ G-151-3 §10 step 3：sticky bulk action bar 行为约定（selection.mode='page' / 0 选不渲染 / batch 50+ 弹 confirm）
- ⏸ Y-151-2 audit before/after schema 完整化：留 CW1-B-EP 实施时按 ADR-122 范式补 idsSample 字段
- ⏸ G-151-1 / G-151-4：绿线建议性，CW1-B-EP 实施时附带消化

**最终结论**：ADR-151 status 🟢 Accepted via R3+Y3+G1 修订（2026-05-25 / arch-reviewer Opus 评级 A− → 主循环修订后等同 A）；CW1-B-EP 卡可启动；R-151-3 worker 守卫扩展是 CW1-B-EP §10 step 6 硬约束（**不可分卡** / 否则审计回归）。

---

## ADR-152 — admin shell topbar 后台事件铃铛端点（CHG-SN-9-CW1-E-ADR / W1-g）

> **Status**: 🟢 Accepted（2026-05-25 / arch-reviewer Opus A− CONDITIONAL → 主循环修订 R3+Y4+G3 后等同 A / 详见 §12 评审结论）
> **触发**：W1 plan §卡 5 W1-g 设计意图——admin shell topbar 新增「后台事件铃铛」，点击 popover 列出「上方：即将发生」+「下方：近期完成/失败」两段；当前 admin-shell-client.tsx 已接入 `useAdminNotifications`（ADR-147 / audit_log 派生）+ `useAdminTasks`（ADR-147 / crawler_runs + bull active 派生），但**两个端点都不含"即将发生"维度**（autoCrawlNext / scheduler cron 等未来时间锚点缺失），CW1-E 需要补足。
> **协议触发**：CLAUDE.md "❌ 新增 admin route 未先起独立 ADR + Opus PASS"（plan §4.5 R7 MUST-8 / `npm run verify:endpoint-adr` 自动核验）→ 本 ADR 是 CW1-E-EP 实施的硬前置。
> **关联**：ADR-147（admin shell notification hub MVP / 范式直接参考）、ADR-137（GET 只读 R-MID-1 4 文件简化版范式）、ADR-122（crawler 重做契约 / autoCrawlNext + scheduler-status 数据源）、ADR-118（admin audit 视图协议）

### §1 决策摘要

新增 1 个 admin GET 端点 `GET /admin/system/background-events` 聚合三源：① upcoming（autoCrawlNext + maintenanceScheduler 6 个 setInterval timer 未来触发时间 / **R-152-2 修订：intervalMs 推算，无 cron-parser 依赖**）② active（crawler_runs status IN ('queued','running','paused') 最近活跃 / **R-152-3 修订：listRuns 谓词下推 status[]**）③ finished（crawler_runs 终态最近 N 小时 + admin_audit_log 高危事件白名单 1 类 / **Y-152-3 修订：与 NotificationBell 真互斥**）。统一映射到 `BackgroundEvent` discriminated union by lane（**Y-152-2 修订**）。前端 admin shell 新组件 `BackgroundEventBell.tsx` 60s polling + popover 渲染两段（上方 upcoming + 下方 finished/active）+ **Y-152-4 修订**：CrawlerClient 触发 createRun 后显式 `mutate('/admin/system/background-events')` invalidate（破除 30s max-age race）。

```
端点：GET /admin/system/background-events?limit=20&windowHours=6
权限：admin + moderator（同 ADR-147 范式 / 复用 GET /admin/notifications 权限语义）
聚合：3 源 → BackgroundEvent[] → 按 timestamp（upcoming=scheduledAt / active=startedAt / finished=finishedAt）DESC 排序
轮询：前端 SWR refreshInterval 60_000ms（同 ADR-147 D-147-2）
缓存：response 头 Cache-Control: private, max-age=30（短缓存 / 防重复打 DB）
软降级：bull 不可用 → meta.degraded=true + 仅返回 crawler_runs + audit_log + autoCrawlNext（参 ADR-147 D-147-6 + R-147-3 范式）
```

### §2 背景与问题

#### 2.1 当前现状

- **admin shell topbar 现状**：`apps/server-next/src/app/admin/admin-shell-client.tsx:127-128` 已接入 `useAdminNotifications`（GET /admin/notifications）+ `useAdminTasks`（GET /admin/system/jobs），分别独立 Drawer 渲染 NotificationItem[] / TaskItem[]
- **CW1-A 已就绪**：`computeNextTrigger(autoConfig)` 函数（`apps/api/src/routes/admin/crawler.ts:37-49`）+ `GET /admin/crawler/system-status` 已暴露 `autoCrawlNext` 字段
- **CW1-D 已就绪**：Dashboard `AutoCrawlScheduleCard.tsx` 已消费 `autoCrawlNext` 渲染倒计时；说明字段语义稳定
- **现有缺口**：
  - **ADR-147 两个端点都是"已发生"视角**：notifications 派生自 audit_log（已写入）；tasks 派生自 crawler_runs 当前 + bull active（已启动）；**无 "未来触发时间" 维度**
  - **autoCrawlNext 仅在 dashboard 卡 + crawler 页 PageHeader chip 暴露**，topbar 全局可见度缺失；用户痛点 "我在 /admin/videos 不知道下次自动采集啥时候触发"
  - **scheduler 6 个定时器未暴露未来时间**：`maintenanceScheduler.getSchedulerStatus()` 当前仅返回 `name/enabled/intervalMs`（实证：`apps/api/src/workers/maintenanceScheduler.ts:252-264` `setInterval(fn, intervalMs)` 固定周期 / **非 cron 表达式**），**未返回 lastRunAt 与 nextRunAt**，CW1-E-EP 需补足。R-152-2 修订：**纯 intervalMs 推算 nextRunAt = lastRunAt + intervalMs**（不引入 cron-parser 新依赖）
- **三源整合需求**：
  - **upcoming（未来锚点）**：autoCrawlNext + maintenanceScheduler 6 个 setInterval timer（auto-publish-staging / verify-published-sources / verify-staging-sources / reconcile-search-index / pending-threshold-check / r2-quota-check）
  - **active（进行中）**：crawler_runs status IN ('queued','running','paused') + bull crawlerQueue active jobs
  - **finished（已完成/失败 + 高危）**：crawler_runs 最近 N 小时终态 + audit_log 高危子集（webhook_send_failed / cache_clear / audit_rollback / 等）

#### 2.2 用户痛点

- "我在哪个 admin 路由都希望看到下次自动采集触发时间" → topbar 全局铃铛
- "我刚才点了全站全量，跑哪了？" → bell 红点 + popover 列出 active runs
- "上一次自动采集成功 / 失败 / partial_failed 不知道" → finished 段集中展示
- "Webhook 投递失败、cache 被清这些高危事件，希望在 bell 也能看到，而不是只在 audit 页或 settings Drawer" → finished 段含 audit_log 高危白名单

#### 2.3 既有基础设施可复用

1. **autoCrawlNext 函数**：`computeNextTrigger(autoConfig)` 已实装（`crawler.ts:37-49`）→ upcoming.auto_crawl 源
2. **maintenanceScheduler**：`apps/api/src/workers/maintenanceScheduler.ts` `getSchedulerStatus()` 已暴露 6 个定时器 + `lastRunAt`；CW1-E-EP 时需补 `nextRunAt`（cron 解析）
3. **listActiveRunIds + listRuns**：`crawlerRuns.ts:285 + 47` → active + finished 源
4. **NotificationService 白名单范式**：`NotificationService.ts:17` ReadonlySet 8 actionType → 高危子集复用该集合 + 进一步收敛到 'danger' / 'warn' level
5. **ADR-147 端点范式**：notifications.ts + system-jobs.ts 两套 GET 端点已建立"limit/since/meta.degraded"范式，可一对一复用

### §3 5 决策点

#### D-152-1：事件统一 schema 设计

**选项**：
- A. 复用 ADR-147 两套 schema（NotificationItem + TaskItem）+ 前端两段分别 fetch（保持类型解耦）
- B. **新建统一 BackgroundEvent schema**（包含 kind/lane/status/scheduledAt?/startedAt?/finishedAt?/runId?/href? 等可选时间锚点）+ 单端点聚合返回
- C. 后端不聚合 / 前端三 fetch 后 merge

**决策**：**B —— 新建 BackgroundEvent 统一 schema（Y-152-2 修订：discriminated union by lane）**

```ts
type BackgroundEventLane = 'upcoming' | 'active' | 'finished'
type BackgroundEventKind =
  | 'auto_crawl'         // upcoming：定时自动采集（autoCrawlNext）
  | 'scheduler_timer'    // upcoming：maintenanceScheduler 6 个 setInterval（R-152-2 实证）
  | 'crawler_run'        // active/finished：crawler_runs 全维度
  | 'audit_high_risk'    // finished：audit_log 高危白名单（Y-152-3 收敛后仅 crawler.freeze）

// Y-152-2 修订：3 个 lane 分支 discriminated union → 前端 type narrowing 由 lane 字段触发，scheduledAt/startedAt/finishedAt 在各分支内强制必填
interface UpcomingEvent {
  lane: 'upcoming'
  id: string
  kind: 'auto_crawl' | 'scheduler_timer'
  status: 'scheduled'
  level: 'info'
  title: string
  description?: string
  scheduledAt: string                 // upcoming 强制必填
  href?: string
}

interface ActiveEvent {
  lane: 'active'
  id: string
  kind: 'crawler_run'
  status: 'queued' | 'running' | 'paused'
  level: 'info'
  title: string
  description?: string
  startedAt: string                   // active 强制必填
  runId: string                       // active.crawler_run 必填（href 跳转用）
  href: string
}

interface FinishedEvent {
  lane: 'finished'
  id: string
  kind: 'crawler_run' | 'audit_high_risk'
  status: 'success' | 'failed' | 'partial_failed' | 'cancelled' | 'timeout' | 'high_risk_audit'
  level: 'info' | 'warn' | 'danger'
  title: string
  description?: string
  startedAt?: string                  // crawler_run 必填 / audit_high_risk 不填
  finishedAt: string                  // finished 强制必填（audit_high_risk 取 created_at）
  runId?: string                      // crawler_run 必填
  actorId?: string                    // audit_high_risk 可选
  href?: string
}

type BackgroundEvent = UpcomingEvent | ActiveEvent | FinishedEvent
```

**G-152-3 id 拼接算法（避免跨源冲突）**：
- A 源 autoCrawlNext：`auto_crawl:next`（单条 / 全局唯一）
- B 源 scheduler timer：`scheduler_timer:${name}`（name 来自 6 个 timer 命名 / R-152-2 实证）
- C 源 active run：`crawler_run:${runId}`
- D 源 finished run：`crawler_run:${runId}`（与 C 不重叠：同一 run 在 active/finished 二选一 lane / DB 状态互斥）
- E 源 audit_high_risk：`audit:${auditId}`
- 跨源不重叠：源 A/B 用 fixed namespace / C+D 共享 namespace 但 lane 不同 / E 独立 namespace → 前端 React `key={event.id}` 直接用

**理由**：
1. upcoming + active + finished 三段共享时间锚点字段（at 三选一），统一 schema 让前端排序 / 渲染 / popover 集中
2. 单端点 + 单 fetch 减少 admin shell 启动时 N+1 请求开销
3. discriminated by `lane` 字段，前端 group + 渲染清晰
4. 与 ADR-147 NotificationItem/TaskItem 解耦——不破坏现有 notifications/jobs Drawer 范式（topbar bell 是第 3 个 UI surface）

**反例排除**：
- A 复用 ADR-147：upcoming 维度无法表达（NotificationItem 含 createdAt 已发生 / TaskItem 含 startedAt 已启动）→ 强行映射到 NotificationItem.level='warn' + title='下次自动采集' 是字段误用
- C 前端三 fetch merge：admin shell 启动时 3 次请求 + 客户端 merge 算法分散；后端做聚合更对单点修复（如修 sort 算法 / 加 active 源）

#### D-152-2：三聚合源选型 + 边界界定

**决策**：**三源固化 + 白名单约束 + 不重叠**

| 源 | 数据来源 | lane | 上限 | 边界 |
|---|---|---|---|---|
| **A. autoCrawlNext** | `computeNextTrigger(autoConfig)`（已实装） | upcoming | 单条 | globalEnabled=false 或 scheduleType!='daily' → 跳过该源 |
| **B. scheduler timer 未来触发** | `getSchedulerStatus()` 6 个 setInterval timer + 新增 `lastRunAt: string \| null` + `nextRunAt: string`（R-152-2：**intervalMs 推算** `nextRunAt = (lastRunAt ?? registeredAt) + intervalMs`） | upcoming | ≤ 6 条 | 仅返回 `enabled=true` 的 timer + `nextRunAt` 在 24h 内的；超 24h 不返回 |
| **C. active crawler_runs** | `listRuns(db, { status: ['queued','running','paused'], sortField: 'createdAt', sortDirection: 'desc', limit: 10 })`（R-152-3：谓词下推 / 不在内存 filter） | active | ≤ 10 条 | DB 层 status = ANY($::text[]) 走 idx_crawler_runs_status |
| **D. finished crawler_runs** | `listRuns(db, { status: ['success','failed','partial_failed','cancelled','timeout'], finishedAfter: NOW()-windowHours, sortField: 'finishedAt', sortDirection: 'desc', limit: Math.floor(limit/2) })`（R-152-3：谓词下推；listRuns 需补 `finishedAfter?: string` 参数 / 与 `createdAtFrom` 同范式） | finished | ≤ limit/2 | windowHours 默认 6h / 通过 query param 可调 1-24（CW1-E-EP step X 给 listRuns 加 finishedAfter） |
| **E. audit_log 高危** | admin_audit_log filter actionType IN HIGH_RISK_AUDIT_WHITELIST + created_at >= NOW() - windowHours | finished | ≤ limit/4 | 白名单首版 1 类（Y-152-3 反向收敛）：`crawler.freeze`（R-152-1：枚举值核实） |

**HIGH_RISK_AUDIT_WHITELIST（Y-152-3 修订后首版 1 类 / D-152-2 锁定 / 与 NOTIFICATION_ACTION_WHITELIST 真互斥）**：

| # | actionType | level | title 模板 | href |
|---|-----------|-------|-----------|------|
| 1 | `crawler.freeze` | `warn` | "全局采集冻结切换" | `/admin/crawler` |

> **R-152-1 修订**：实际枚举值是 `crawler.freeze`（`packages/types/src/admin-moderation.types.ts:151` / `apps/api/src/routes/admin/crawler.tasks.ts:333` 实证），非草案误写的 `crawler.global_freeze_set`
>
> **Y-152-3 修订（白名单与 ADR-147 真互斥）**：HIGH_RISK_AUDIT_WHITELIST **不再是** NOTIFICATION_ACTION_WHITELIST 的子集，而是其 **complement**——bell popover 仅收录 NotificationBell **未覆盖**的高危事件（即 `crawler.freeze`）；`system.webhook_send_failed` / `system.cache_clear` / `system.audit_rollback` 全部留给 NotificationBell + Drawer，不在 BackgroundEventBell 显现，避免 3 类事件在两个 UI surface 重复曝光。
>
> 后续若有新高危 actionType（如 `crawler.global_full_run` 等）且 NOTIFICATION_ACTION_WHITELIST 未覆盖时，应优先扩 NotificationBell；仅当语义上"运维事件需在 topbar 即时可见 + 又不属于 audit-log-style 通知"时才扩 HIGH_RISK_AUDIT_WHITELIST。

**理由**：
1. 三源边界互斥：A/B 仅未来锚点（upcoming）/ C 仅活跃（active）/ D/E 仅历史（finished）→ 无去重压力
2. windowHours 参数化（默认 6h / max 24h）：admin 通常关心"近期"；超过 24h 应去 audit 页或 runs 列表查
3. 白名单 ReadonlySet 类型安全（继承 ADR-147 R-147-1 范式）+ HIGH_RISK 子集 + 头注释提示
4. 上限分级：limit 默认 20 / upcoming + active 各占小份 / finished 取剩余；防 finished 大量数据淹没 upcoming + active

**反例排除**：
- 不复用 GET /admin/system/jobs：jobs 是"active 全量+ bull queue"视角，不含 upcoming 锚点 + 不限定 windowHours；如硬扩 system/jobs 加 lane 字段 → ADR-147 端点契约破坏
- 不聚合所有 audit_log：noise 太大；只取严格白名单 4 类（HIGH_RISK_AUDIT_WHITELIST）

#### D-152-3：轮询 vs SSE 推送模型

**选项**：
- A. **前端 polling 60s**（SWR refreshInterval / 同 ADR-147 D-147-2 范式）
- B. SSE 实时推送（`GET /admin/system/background-events/stream` + 后端 EventEmitter）
- C. WebSocket 双向（重 / 当前栈无需）

**决策**：**A —— polling 60s（v1 MVP）**

**理由**：
1. admin 同时在线 < 10 人（与 ADR-147 D-147-2 同一前提）；60s 延迟可接受
2. 零新依赖 / 零后端长连接基础设施（Fastify 当前未配 SSE 中间件）
3. autoCrawlNext + scheduler cron 都是 24h 内未来时间锚点，分钟级精度足够
4. SWR `refreshInterval: 60_000` 一行配置；现有 useAdminNotifications + useAdminTasks 已是同范式

**重评条件 / N1 升级路径**：
- N1-152-1 同时在线 admin > 20（5 倍当前规模）→ 评估 SSE 单端点 + EventEmitter
- N1-152-2 用户反馈 "我点全站全量但 bell 60s 后才出现，太慢" → 升频 30s 或 SSE
- N1-152-3 有秒级业务事件需求（如 webhook 投递实时回执）→ 必须 SSE / WebSocket

**反例排除**：
- B SSE：admin 后台并发低 + Fastify SSE plugin 引入 + EventEmitter 跨进程同步复杂度 → 在当前规模下纯负担
- C WebSocket：当前栈无需双向通讯（前端无 push 后端的需求）

#### D-152-4：polling 频率 / 缓存 / dedupe 策略

**决策**：**60s polling + 服务端 Cache-Control: private,max-age=30 + 前端 SWR dedupe**

| 维度 | 策略 |
|------|------|
| 前端 refreshInterval | 60_000ms（SWR 默认 stale-while-revalidate） |
| 前端 dedupe | SWR `dedupingInterval: 15_000ms`（同一 key 15s 内不重复请求 / 避免 mount 抖动） |
| 服务端 response 头 | `Cache-Control: private, max-age=30`（per-user / 30s 内浏览器自动复用 / 容忍轻微滞后） |
| 服务端 DB 缓存 | 不引入 Redis 缓存（v1 直接查 DB / max-age 已减半 DB QPS） |
| 错误重试 | SWR 默认指数退避（5 次 / 1s/2s/4s/8s/16s）→ 配置 `errorRetryCount: 3`（admin 后台不需要激进） |
| bull 不可用降级 | response.meta.degraded=true（同 ADR-147 R-147-3）/ 前端 bell badge 加 ⚠️ icon 提示 |
| **Y-152-4 mutate invalidate** | CrawlerClient 触发 createRun / cancelRun / batch cancel **成功后**调 SWR `mutate('/admin/system/background-events')` 显式跳过 max-age 拉取最新；同范式：approveVideo 等用户触发的写操作均补 mutate |

**性能估算**：admin 8 人 × 1QPS/60s = 0.133 QPS；max-age=30 再减半 = 0.067 QPS；DB 三源 query 复杂度 ≤ 50ms（C/D 走 listRuns + idx_crawler_runs_status + 新建 idx_crawler_runs_finished_at partial / E 走 idx_admin_audit_log_action_created；A computeNextTrigger 内存计算；B 6 个 timer intervalMs 推算 O(1)）→ 总 p95 ≤ 200ms（同 ADR-137 baseline）。

**反例排除**：
- 30s polling 太激进：admin 后台无秒级需求 / 加压 DB 4 倍
- Redis 缓存 v1：admin 同时在线低 / DB 负载已极低 / 增运维复杂度

#### D-152-5：权限 / role 控制

**选项**：
- A. admin only（最严格）
- B. **admin + moderator**（同 ADR-147 范式 / GET /admin/notifications + /admin/system/jobs 已是该配置）
- C. admin + moderator + viewer（开放给观察者）

**决策**：**B —— admin + moderator**

**理由**：
1. 与 ADR-147 两个端点保持权限对称（notifications + system-jobs + background-events 三端点同 role gate）
2. moderator 需要看到采集进行中 + 失败事件辅助审核排查（如某个 crawler_run 全失败 → moderator 可知"现在 pending 队列没有新增"）
3. viewer 在 reference §1.x 内是只读角色，不应看到运维事件（audit_high_risk）

**反例排除**：
- A admin only：与现有 ADR-147 范式不一致 / moderator 用户体验割裂（notifications/jobs 可见但 background-events 不可见）
- C 开放 viewer：高危 audit 事件含运维上下文，viewer 角色定位是"内容只读"不应看到

**Drawer/cancel 写操作权限**：本 ADR 只覆盖 GET 端点；后续 N1（如 bell popover 内 cancel run 按钮）需 admin / 在 EP 卡内单独走 requireRole(['admin']) gate。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/admin/system/background-events` | 后台事件聚合（upcoming + active + finished 三 lane） | Query: `limit?` (default 20, max 50) / `windowHours?` (default 6, min 1, max 24) | 200 `{ data: BackgroundEvent[], meta: { total, limit, windowHours, generatedAt, degraded? } }` | admin + moderator | 401 / 403 / 422 VALIDATION_ERROR |

### §4 端点契约详表（按字段拆解）

| 字段 | GET /admin/system/background-events |
|------|--------------------------------------|
| Query Param | `limit?: number (1-50, default 20)` / `windowHours?: number (1-24, default 6)` |
| Body | 无 |
| Auth | admin + moderator（fastify.requireRole(['admin','moderator'])） |
| Success Status | 200 |
| Response Body | `{ data: BackgroundEvent[], meta: { total: number, limit: number, windowHours: number, generatedAt: string (ISO), degraded?: boolean } }` |
| 排序 | 按 lane group：upcoming asc by scheduledAt → active asc by startedAt → finished desc by finishedAt（前端可按需 re-sort） |
| Cache-Control | `private, max-age=30` |
| Error 422 | limit/windowHours 越界 |
| Side Effect | **零写入**（不写 audit log / 不调 syncRun / 三源纯 SELECT） |
| 软降级 | bull 不可用 → meta.degraded=true + 仅返回 crawler_runs + audit_log + autoCrawlNext（D-152-2 源 A/C/D/E） |
| 性能 baseline | p95 ≤ 200ms（D-152-4） |

### §5 SQL 设计

**核心**（R-152-2/3 修订后）：**2 个 listRuns 调用（谓词下推）+ 1 个 audit_log SELECT + 1 个 autoCrawlNext 函数调用 + 1 个 setInterval 推算**，全部 Promise.all 并发；无 JOIN，无聚合 UPDATE，无新依赖。

#### 5.1 source C — active crawler_runs（R-152-3 修订：listRuns 谓词下推）

```ts
const { rows: activeRows } = await listRuns(db, {
  status: ['queued', 'running', 'paused'],   // ADR-149 EP-5-crawler-runs-PATCH-A 已支持多选
  sortField: 'createdAt',                     // 既有白名单
  sortDirection: 'desc',
  limit: 10,
})
// DB 层走 idx_crawler_runs_status (status, created_at DESC) 已覆盖
```

**反例排除**：原草案"v1 listRuns(limit=50).filter(r => ['queued','running','paused'].includes(r.status))"是**伪查询**——在 Service 层做内存二次过滤违 §8 分层（"Service 写 SQL = ❌" 的逻辑等价 "Service 内存伪查询 = ❌"），且绕开 idx_crawler_runs_status 索引。listRuns 现有 status 多选谓词已落地（`crawlerRuns.ts:149` ADR-149 EP-5-crawler-runs-PATCH-A）。

#### 5.2 source D — finished crawler_runs（R-152-3 修订 + Y-152-1：补 finishedAfter 参数 + migration 索引）

```ts
const { rows: finishedRows } = await listRuns(db, {
  status: ['success', 'failed', 'partial_failed', 'cancelled', 'timeout'],
  finishedAfter: new Date(Date.now() - windowHours * 3600_000).toISOString(),  // CW1-E-EP step 1：listRuns 加 finishedAfter? 参数
  sortField: 'finishedAt',                    // CRAWLER_RUNS_SORT_FIELD_MAP 已含
  sortDirection: 'desc',
  limit: Math.floor(limit / 2),
})
```

**listRuns 扩展约束（CW1-E-EP step 1）**：
- listRuns 当前已有 `createdAtFrom/createdAtTo`（`crawlerRuns.ts:155-156`），需补 `finishedAfter?: string` 同范式
- WHERE 条件：`finished_at >= $::timestamptz`（非 ::date，因为 windowHours 是小时级精度）

**Y-152-1 索引修订**：`idx_crawler_runs_finished_at` 当前**不存在**（migration 010 仅有 `idx_crawler_runs_created_at` + `idx_crawler_runs_status (status, created_at DESC)`），CW1-E-EP step 0.5 必须新建：

```sql
-- migration 074_crawler_runs_finished_at_idx.sql（CW1-E-EP step 0.5）
CREATE INDEX IF NOT EXISTS idx_crawler_runs_finished_at
  ON crawler_runs(finished_at DESC) WHERE finished_at IS NOT NULL;
-- partial index：避免 NULL finished_at 行入索引（active runs 不写 finished_at）
```

**fallback**：若 step 0.5 migration 未跑（如 dev 环境）→ 走 `idx_crawler_runs_status (status, created_at DESC)` 联合索引 + 内存按 finished_at DESC 二次排序（性能可接受但不最优）

#### 5.3 source E — audit_log 高危白名单（R-152-1 + Y-152-3 修订：1 类白名单）

```ts
const HIGH_RISK_AUDIT_WHITELIST = ['crawler.freeze'] as const   // Y-152-3 收敛：与 NOTIFICATION_ACTION_WHITELIST 真互斥

const auditHighRisk = await db.query<AuditRow>(
  `SELECT id::text, action_type, target_id, created_at, actor_id::text
     FROM admin_audit_log
    WHERE action_type = ANY($1::text[])
      AND created_at >= NOW() - ($2 || ' hours')::interval
    ORDER BY created_at DESC
    LIMIT $3`,
  [HIGH_RISK_AUDIT_WHITELIST, windowHours, Math.floor(limit / 4)],
)
```

**索引**：复用 `idx_admin_audit_log_action_created`（ADR-118 已有）

> **R-152-1 修订要点**：白名单 actionType 实际枚举值是 `crawler.freeze`（不是草案误写的 `crawler.global_freeze_set`），来自 `packages/types/src/admin-moderation.types.ts:151` + `apps/api/src/routes/admin/crawler.tasks.ts:333` 实证。

#### 5.4 source A + B — upcoming（内存计算 / R-152-2 修订：intervalMs 推算）

```ts
// A — autoCrawlNext（复用 computeNextTrigger）
const autoConfig = await systemSettingsQueries.getAutoCrawlConfig(db)
const autoCrawlNext: string | null = computeNextTrigger(autoConfig)  // 已实装 / ISO 或 null

// B — maintenanceScheduler timer 未来触发（R-152-2 修订：intervalMs 推算）
// CW1-E-EP step 2：在 maintenanceScheduler.ts 内补 lastRunAt + nextRunAt 字段
//   lastRunAt: setInterval 内执行前 lastRunAt = new Date().toISOString()
//   nextRunAt: (lastRunAt ?? registeredAt) + intervalMs → ISO
const schedulerStatuses = getSchedulerStatus()   // 返回 { name, enabled, intervalMs, lastRunAt, nextRunAt } × 6
const upcoming24h = schedulerStatuses
  .filter(s => s.enabled && s.nextRunAt && new Date(s.nextRunAt) <= new Date(Date.now() + 24 * 3600_000))
  .map(s => ({ ...s, scheduledAt: s.nextRunAt }))
```

**R-152-2 修订要点**：原草案 §5.4 + §10 step 2 提及 `cron-parser` 包是**事实错误**——`maintenanceScheduler.ts:252-264` 全部用 `setInterval(fn, intervalMs)` 固定周期（auto-publish-staging / verify-published-sources / verify-staging-sources / reconcile-search-index / pending-threshold-check / r2-quota-check 6 个 timer），**完全没有 cron 表达式可解析**。intervalMs 推算 O(1)，零依赖，BLOCKER 流程随之取消。

### §6 R-MID-1 第 N 次系统化（GET 简化版 4 文件框架）

**类比 ADR-137 D-137-5**：GET 只读端点不写 audit → R-MID-1 降级 4 文件框架（vs 写端点 7 文件全套）。

| # | 真源 | 本 ADR 修改 |
|---|---|---|
| 1 | `apps/api/src/services/admin/audit/actionTypes.ts` | **零新增**（不写新 actionType） |
| 2 | `apps/api/src/services/admin/audit/targetKinds.ts` | **零新增**（不写新 targetKind） |
| 3 | `packages/types/src/admin-audit.ts` 真源同步 | **零新增**（沿用 ADR-118 ACTION_TYPES / TARGET_KINDS） |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` REQUIRED_ACTION_TYPES | **零新增**（无新写入路径） |

**额外要点**：
- 复用 ADR-147 NOTIFICATION_ACTION_WHITELIST → HIGH_RISK_AUDIT_WHITELIST 是其严格子集（4 类 ⊂ 8 类）
- 不引入新 ErrorCode（VALIDATION_ERROR / 401 / 403 全用现有）

### §7 性能 baseline

| 维度 | 目标 | 验证 |
|------|------|------|
| p95 端到端 | ≤ 200ms（同 ADR-137） | 3 query 并发（Promise.all source C/D/E + 内存 A/B）/ 索引齐全（含 step 0.5 新建 idx_crawler_runs_finished_at partial） |
| QPS @ admin 8 人 | ≤ 0.07 QPS（Cache-Control max-age=30 减半） | 60s polling × 8 ÷ 2 = 0.067 QPS |
| DB row 扫描上限 | source C ≤ 10 / source D ≤ limit/2 / source E ≤ limit/4 / 总 ≤ 30 行（谓词下推后） | LIMIT clause + listRuns 谓词 |
| 内存计算上限 | source A computeNextTrigger O(1) + source B 6 timer intervalMs 推算 O(1) | 纯算术运算 |
| bull 降级超时 | 1s（同 ADR-147 R-147-3） | TaskAggregator 范式参考 |

**重评条件**：
- admin 同时在线 > 20 → 评估 SSE（D-152-3 N1-152-1）
- p95 > 200ms 持续 7 天 → 评估引入 Redis 缓存层（短 TTL 30s + 单一 lock 防 thundering herd）

### §8 分层约束 / 越层检测

| 层 | 文件 | 职责 |
|---|---|---|
| Route | `apps/api/src/routes/admin/systemBackgroundEvents.ts`（新） | zod schema + auth + 调 Service / 不含业务聚合 |
| Service | `apps/api/src/services/BackgroundEventService.ts`（新） | 三源聚合 + 映射 BackgroundEvent / 调 queries + helper / 不含 SQL |
| Queries | 复用 `crawlerRuns.listRuns` / 新建 `apps/api/src/db/queries/backgroundEvents.ts`（如需独立 audit_log 高危 query） | 纯 SQL |
| Helper | 复用 `crawler.ts:37 computeNextTrigger` / `maintenanceScheduler.getSchedulerStatus` | 纯内存计算 |

**违规检测**：
- Route 含业务逻辑（如 lane 排序 / 三源 merge） → ❌
- Service 写 SQL（应调 queries） → ❌
- queries 调 Service → ❌

**复用决策（G-152-1 明确路径）**：`computeNextTrigger` 当前在 `routes/admin/crawler.ts:37` 内（route 层 helper），CW1-E-EP step 1 必须提到 **`apps/api/src/lib/crawler-scheduling.ts`**（与既有 `apps/api/src/lib/*` 目录范式一致 / 非 services 因纯函数无 DB 依赖）→ 避免跨 route 文件复用 helper（违 CLAUDE.md "Route 层不含业务逻辑"）。本 ADR 列为实施 step 1。

### §9 关联 ADR

| # | ADR | 关联 |
|---|---|------|
| 1 | ADR-103a | admin-ui Shell SSOT — BackgroundEventBell 新组件契约（属 shell 新 surface / 待 EP 卡评估是否补 admin-ui 通用 Bell 原语 / v1 先 server-next 内自有组件） |
| 2 | ADR-118 | admin audit 视图协议 — ACTION_TYPES / TARGET_KINDS 真源（HIGH_RISK_AUDIT_WHITELIST 取严格子集） |
| 3 | ADR-122 | crawler 重做契约 — autoCrawlNext / system-status 数据源 |
| 4 | ADR-137 | GET 只读 R-MID-1 4 文件简化版范式（本 ADR 复用） |
| 5 | ADR-139 | fastify.requireRole — 端点权限守卫 |
| 6 | ADR-146 | WebhookDispatcher — `system.webhook_send_failed` 事件源（Y-152-3 收敛后留给 NotificationBell / 本 ADR 不消费） |
| 7 | ADR-147 | admin shell notification hub MVP — 端点结构范式（GET + meta.degraded + 60s polling）/ NOTIFICATION_ACTION_WHITELIST 范式 |
| 8 | ADR-149 | listRuns 多选谓词扩展（EP-5-crawler-runs-PATCH-A）— 本 ADR §5.1/§5.2 复用 status[] + finishedAfter 谓词下推 |
| 9 | ADR-151 | task 级 cancel — 同期 W1 CW1-B 端点协议 / sibling ADR |

### §10 实施路径（→ CW1-E-EP 实施卡 / R-152-2 修订：删除 cron-parser BLOCKER + 加 migration step）

| Step | 内容 | 文件 |
|------|------|------|
| 0.5 | **新建 migration 074 索引**（Y-152-1） | `apps/api/src/db/migrations/074_crawler_runs_finished_at_idx.sql`（CREATE INDEX IF NOT EXISTS idx_crawler_runs_finished_at ON crawler_runs(finished_at DESC) WHERE finished_at IS NOT NULL） |
| 1 | **抽取 computeNextTrigger + listRuns 加 finishedAfter 参数**（R-152-3） | a. `apps/api/src/lib/crawler-scheduling.ts`（新 / move from `routes/admin/crawler.ts:37`） + crawler.ts import 修订；b. `apps/api/src/db/queries/crawlerRuns.ts` listRuns 加 `finishedAfter?: string` 参数（同 `createdAtFrom` 范式 / WHERE `finished_at >= $::timestamptz`） |
| 2 | **maintenanceScheduler 补 lastRunAt + nextRunAt 字段**（R-152-2 修订：纯 intervalMs 推算） | `apps/api/src/workers/maintenanceScheduler.ts`：① 6 个 setInterval 内执行前赋值 `lastRunAt = new Date().toISOString()` ② `getSchedulerStatus()` 返回 `{ name, enabled, intervalMs, lastRunAt: string \| null, nextRunAt: string }` ③ nextRunAt 推算公式：`new Date(Date.parse(lastRunAt ?? registeredAt) + intervalMs).toISOString()` / **零新依赖** |
| 3 | 新建 BackgroundEventService 三源聚合 | `apps/api/src/services/BackgroundEventService.ts`（~150 行 / Promise.all 3 source query + 内存 A/B + map to BackgroundEvent union） |
| 4 | 新建 GET /admin/system/background-events 路由 | `apps/api/src/routes/admin/systemBackgroundEvents.ts`（~70 行 / 仿 notifications.ts + system-jobs.ts / response 头 `Cache-Control: private, max-age=30`） |
| 5 | server.ts 注册路由 | `apps/api/src/server.ts` |
| 6 | types 真源同步 BackgroundEvent | `packages/types/src/admin-shell.ts`（与 NotificationItem/TaskItem 同文件 / 仿 ADR-147 范式 / discriminated union 3 分支） |
| 7 | 前端 lib 包装 | `apps/server-next/src/lib/admin-shell-background-events.ts`（~80 行 / 仿 admin-shell-notifications.ts SWR hook / `refreshInterval: 60_000` + `dedupingInterval: 15_000` + `errorRetryCount: 3`） |
| 8 | 前端组件 BackgroundEventBell + **mutate 接入 CrawlerClient**（Y-152-4） | a. `apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx`（~180 行 / popover 两段渲染 / `event.lane` discriminated union narrowing）；b. `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx` 已有的 runCrawlerAll / cancelRun handlers 成功后调 `mutate('/admin/system/background-events')`（破除 max-age race） |
| 9 | admin-shell-client 集成 | `apps/server-next/src/app/admin/admin-shell-client.tsx`（topbar 加 BackgroundEventBell / 与现有 NotificationBell + TaskBell 共存） |
| 10 | 单测（≥ 12 case）| `tests/unit/api/background-event-service.test.ts` + `tests/unit/api/routes/admin/background-events.test.ts` + `tests/unit/components/server-next/admin-shell/BackgroundEventBell.test.tsx` |
| 11 | 全质量门禁 | typecheck + lint + verify:endpoint-adr（189 路由对齐 / 本 ADR 增 1 条）+ verify:adr-contracts + npm run migrate（step 0.5 migration 074） |

**估时**：0.25w（同 task-queue.md CW1-E-EP 估算）

**强制约束（R-152-2 修订后）**：
- **零新依赖**：原草案 step 2 cron-parser BLOCKER 取消（事实上 maintenanceScheduler 用 setInterval 无 cron）→ intervalMs 推算 O(1) 内置
- step 1a + 1b 是 ADR-152 落地的硬依赖（不可与 step 3 分卡 / 否则跨 route 复用 helper 违分层 / listRuns 不加 finishedAfter 则 source D 又退化为内存 filter）
- step 0.5 migration 074 是 source D 走 partial index 的硬依赖（不跑会 fallback 慢扫 / 不阻塞但首发体验差）

### §11 已识别 follow-up（不阻塞本 ADR）

- **N1-152-1（SSE 升级）**：admin 同时在线 > 20 → SSE 推送（D-152-3）
- **N1-152-2（提升轮询频率）**：用户反馈 60s 延迟太慢 → 30s 或 SSE
- **N1-152-3（秒级事件需求）**：webhook 投递实时回执需求出现 → 必须 SSE / WebSocket
- ~~**N1-152-4**~~：listRuns 谓词下推 → R-152-3 修订已合并到 §10 step 1 主路径（不再 follow-up / EP 卡内必须完成）
- **N1-152-5（BackgroundEventBell admin-ui 原语化）**：第 3 个 Bell 复用模式出现时（如其它子产品需类似 topbar 事件聚合）→ 提到 packages/admin-ui/src/shell/event-bell.tsx
- **N1-152-6（bell popover 内行级 cancel）**：active run 行加 cancel 按钮 → 复用 ADR-122 cancelRun 端点 / 但需 admin only role gate（本 ADR 不覆盖）
- ~~**N1-152-7**~~：cron-parser 容错 → R-152-2 修订后无 cron-parser 依赖（移除）；intervalMs 推算异常处理（lastRunAt parse 失败）改为：单 timer skip + warn 日志 / 不阻塞主响应（仿 R-147-3）→ 直接落 §5.4 不再 follow-up
- **N1-152-8（windowHours 上限重评）**：用户反馈"我要查 48h 之前的 finished" → 升 max 48 或引导去 audit 页
- **N1-152-A（三 Bell 视觉层级）**：BackgroundEventBell + NotificationBell + TaskBell 三 Bell 共存于 topbar，admin shell 设计需评估是否合并 unread badge / 或弱化某 Bell 入口（建议 advisory：bell popover 内的 audit-high-risk 计 unreadCount 但 NotificationBell 已显示 / 用户体验需走读后确认）
- **N1-152-B（tab visibility 暂停 polling）**：SWR `refreshWhenHidden: false` 让用户切到非 admin tab 时暂停 60s polling / 节省 admin 多 tab 场景 QPS（4-5 个 tab × 60s polling 累加）
- **N1-152-C（windowHours upper bound 调整与 LIMIT 比例配对）**：N1-152-8 启动时同步评估 source D LIMIT/2 是否需重分配（若用户大幅扩 windowHours 而 LIMIT 不变 → finished 行覆盖率下降）

---

### §12 评审结论（2026-05-25）

**arch-reviewer Opus 1 轮独立评审**：A− CONDITIONAL → 主循环修订红线 3 + 黄线 4 + 绿线 3 后 → 🟢 等同 A

**修订摘要（已落盘 ADR-152）**：
- ✅ R-152-1 §3 D-152-2 + §5.3：HIGH_RISK_AUDIT_WHITELIST actionType 由 `crawler.global_freeze_set` 全文修订为 `crawler.freeze`（packages/types/src/admin-moderation.types.ts:151 + crawler.tasks.ts:333 实证）
- ✅ R-152-2 §1 + §2.3 + §3 D-152-2 + §5.4 + §7 + §10 step 2 + §11：删除 `cron-parser` 新依赖 + BLOCKER 流程；改为 intervalMs 推算 `nextRunAt = (lastRunAt ?? registeredAt) + intervalMs`（maintenanceScheduler.ts:252-264 setInterval 实证 / 6 个 timer 全部 intervalMs 固定周期）
- ✅ R-152-3 §3 D-152-2 + §5.1 + §5.2 + §10 step 1 + §11：listRuns 谓词下推（status[] / finishedAfter）/ 删除内存 filter / 删除 N1-152-4 follow-up（合并主路径）/ listRuns 加 finishedAfter 参数纳入 step 1
- ✅ Y-152-1 §5.2 + §10 step 0.5：新建 migration 074 idx_crawler_runs_finished_at partial index（WHERE finished_at IS NOT NULL）+ fallback 描述
- ✅ Y-152-2 §3 D-152-1：BackgroundEvent 改 3 分支 discriminated union by lane（UpcomingEvent / ActiveEvent / FinishedEvent）/ scheduledAt/startedAt/finishedAt 各分支内强制必填
- ✅ Y-152-3 §3 D-152-2 + §5.3：HIGH_RISK_AUDIT_WHITELIST 反向收敛为 NotificationBell 的 **complement**（首版 1 类 `crawler.freeze`）/ 真互斥 / 3 类 webhook+cache+audit_rollback 全归 NotificationBell
- ✅ Y-152-4 §1 + §3 D-152-4 + §10 step 8：CrawlerClient runCrawlerAll/cancelRun 成功后显式 `mutate('/admin/system/background-events')` 跳 max-age race
- ✅ G-152-1 §8：computeNextTrigger 提取目标路径锁定 `apps/api/src/lib/crawler-scheduling.ts`（非 services 因纯函数）
- ✅ G-152-2 §9：补 ADR-149（listRuns 多选谓词扩展）入关联 ADR 表第 8 行

### AMENDMENT 2026-05-26（ADR-155 §3 D-155-2 / EP-2）

**触发**：@livefree W1 走读暴露 — ADR-152 实施时采用 N1-152-A `position:fixed` 旁路方案规避 "共享组件 API 契约强制 Opus" 约束，BackgroundEventBell 作为第 3 个 topbar 图标叠加，违反 AdminShell `notifications + tasks` 二图标范式。process 红线复发监测必修。

**变更**：撤销 N1-152-A position:fixed BackgroundEventBell；将 BackgroundEventService 三 lane 数据合并到现有 AdminShell `notifications + tasks` 二图标数据流。

**关键修订点**：
- **删除文件**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx` + 测试 + `apps/server-next/src/app/admin/admin-shell-client.tsx` `<BackgroundEventBell>` 渲染
- **保留端点 + service**：`apps/api/src/services/BackgroundEventService.ts` + `/admin/system/background-events` route 不动；继续作为 useAdminNotifications/useAdminTasks 第 2 GET 源
- **双源类型镜像同步（R-155-1 关键约束）**：
  - `packages/admin-ui/src/shell/types.ts` `NotificationItem` 加 `category?: 'general' | 'background'`；`TaskItem` 加 `source?: 'crawler' | 'maintenance' | 'general'`
  - `packages/types/src/admin-shell.types.ts` `AdminNotificationItem` / `AdminTaskItem` 同步加 category + source 字段
- **前端 hook 合并（Y-155-3 路径 A 短期方案 / 并发两 GET）**：
  - `useAdminNotifications` 并发 GET `/admin/notifications` + `/admin/system/background-events`；upcoming + finished lane 映射 → category='background'；按 createdAt DESC 合并排序
  - `useAdminTasks` 并发 GET `/admin/system/jobs` + background-events；active lane 映射 → source='crawler'；按 startedAt DESC 合并排序
  - 注册 reload 到 `globalMutateRegistry` 让 `invalidateBackgroundEvents()` 触发（CrawlerClient 写操作后 Y-152-4 mutate 路径不变）
- **admin-shell-background-events.ts 瘦身**：删除 `useAdminBackgroundEvents` hook；保留 `invalidateBackgroundEvents` + `globalMutateRegistry`（CrawlerClient 调用方零改动）

**未来演化（ADR-156 候选 / 本卡不实施）**：若 60s 双端点轮询性能瓶颈，起 ADR-156 «notifications 端点扩展» 将 BackgroundEventService 内嵌到 `/admin/notifications` + `?include=background` 参数；同步 ADR-147 端点契约 AMENDMENT。

**process 红线复发监测**：本 AMENDMENT commit 强制 `Subagents: arch-reviewer (claude-opus-4-7)` trailer + reviewer 显式审查双源镜像同步（R-155-1）+ 关键洞察 #2 process 红线复发监测。

**关联**：ADR-155 §3 D-155-2 / EP-2 / R-155-1 双源镜像必修 / N1-152-A 旁路方案撤销
- ✅ G-152-3 §3 D-152-1：id 字段 5 源拼接算法明确（auto_crawl:next / scheduler_timer:${name} / crawler_run:${runId} / audit:${auditId} / 跨源不重叠）
- ⏸ N1-152-A/B/C：advisory follow-up，不阻塞本 ADR；EP 卡走读后用户反馈触发再立卡

**最终结论**：ADR-152 status 🟢 Accepted via R3+Y4+G3 修订（2026-05-25 / arch-reviewer Opus 评级 A− → 主循环修订后等同 A）；CW1-E-EP 卡可启动；R-152-2 cron-parser BLOCKER 取消（事实纠错）/ R-152-3 listRuns 谓词下推是 §10 step 1 硬约束（**不可分卡** / 否则 source C/D 退化为内存伪查询）/ Y-152-4 mutate invalidate 是 §10 step 8 必修（破 max-age race）。

---




---

## ADR-153 — Crawler 时间轴 Gantt 重设计（CHG-SN-9-CW2-B-ADR）

> **Status**: 🟢 Accepted（2026-05-25 / arch-reviewer Opus A− CONDITIONAL → R-153-1/2/3 三条红线已含在 §5 SQL 草案中，等同 A）
> **触发**：W2 plan §CW2-B 设计意图——采集页 `CrawlerTimelineCard` 当前形态（REDO-01-C 框架态 + REDO-01-J 视觉对齐）存在 5 个已知功能/性能缺口：每站仅显示最新 1 条 task（multi-lane 缺失）、status 仅 3 态（paused/cancelled 被误归 warning 或被 SQL 过滤）、range select 后端已支持但前端未实装、pending task 起点锚定到窗口左侧而非 `scheduled_at`、health 子查询是 per-site correlated subquery（N+1）。本 ADR 起草 6 决策点的最终方案供 CW2-B-EP 实施卡落地。
> **协议触发**：本 ADR 改动 `crawlerTimeline.ts` 的 `CrawlerTimelineRow.status` 字段（3 态 → 4 态）+ 前端 `apps/server-next/src/lib/crawler/api.ts` 对应类型 + `CrawlerTimelineCardProps`——属"共享/跨层类型契约 + 数据原语变更"，触发 CLAUDE.md §模型路由"定义新的共享组件 API 契约"+"设计跨消费方 schema 字段"必须 Opus 决策。**不新增 admin route**（端点 path 与 verb 不变，仅 query schema 扩展），故不触发 verify:endpoint-adr，但 status 枚举扩展仍需本 ADR 作为前置。
> **关联**：ADR-122（crawler 重做 / timeline 端点原始设计 / SQL 聚合策略真源）、ADR-151（task 级 cancel / paused·cancelled task 在时间窗内的存在性来源）

### §1 决策摘要

为 Gantt 时间轴升级落定 6 个决策点。**核心改动收敛在 1 个 SQL 重写（`TIMELINE_SQL` → `TIMELINE_SQL_V2`）+ 1 个 status 枚举从 3 态扩到 4 态（双侧类型同步）+ 1 个前端 Props 扩展（range 自治 state）+ multi-lane 渲染（每站 ≤3 bar 垂直叠放）**。不引入新端点、不改路由 path、不引入新依赖。

| 决策点 | 主题 | 最终结论 |
|--------|------|----------|
| D-153-1 | 每站显示条数 | **B 改良版**：`rn <= 3`（N=3），每站 grid cell 改单 TRACK 容器内绝对定位；rowHeight 14px→24px；lane 间排序用 `DENSE_RANK over site`（site_ord）+ lane 内按 rn ASC |
| D-153-2 | status 四态 | **B**：扩为 4 态 `ok / warn / danger / neutral`；SQL WHERE 放开 `paused`、`cancelled`、`timeout`；`statusToCategory` 补 neutral 分支；neutral 色用 `var(--fg-muted)` |
| D-153-3 | range select 实装 | **A**：Card 内部 `useState` 自治 + SWR 数据拉取下沉到 Card；`timeline` prop 降级为 `fallbackData`；不新增 range/onRangeChange Props |
| D-153-4 | pending 起点 | **GREATEST clamp**：`GREATEST(COALESCE(ct.started_at, ct.scheduled_at), NOW() - $1::interval)`；**保留** JS 层 `Math.max(0, Math.min(1, ...))` clamp（双层防御） |
| D-153-5 | tick 时区 | **确认现状为正确架构**：后端永远返回 UTC ISO 字符串；前端 `toLocaleTimeString` 展示层转换；写入 ADR 防回归红线 |
| D-153-6 | health N+1 消除 | **采纳 CTE 方案**：`COUNT(*) FILTER (WHERE status='done' AND rn_h<=5)` + `LEFT JOIN health_cte`；O(N) correlated subquery → O(1) CTE 一次扫 |

### §2 背景与问题

#### 2.1 当前 Gantt 实现的 5 个已知问题（T1–T5）

| 编号 | 缺口 | 当前代码位点 | 影响 |
|------|------|-------------|------|
| **T1** multi-lane 缺失 | `crawlerTimeline.ts:98` `WHERE rt.rn = 1` 每站仅取最新 1 条 task；前端 `CrawlerTimelineCard.tsx:189-191` 每站只渲染 1 个 `TimelineRow` | 同一站时间窗内多次采集历史 task 被隐藏，时间轴信息密度不足 |
| **T2** status 仅 3 态 | `crawlerTimeline.ts:29/105-109` `'ok' \| 'warn' \| 'danger'`；SQL WHERE 过滤 paused/cancelled | paused/cancelled 语义中性却被过滤；timeout 落入 warn 兜底是语义 bug |
| **T3** range select 未实装 | 后端已支持 range 参数；但 `CrawlerTimelineCardProps` 无 range/onRangeChange，head actions 注释"占位" | 用户无法切换时间窗 |
| **T4** pending 起点错误 | `crawlerTimeline.ts:84` `COALESCE(started_at, NOW() - $1::interval)` | 未 started task 起点锚到窗口左侧，bar 持续时长虚长 |
| **T5** health N+1 | `crawlerTimeline.ts:88-96` correlated subquery，每站执行一次 | O(N) 查询，站点增加时性能退化；架构性反模式 |

#### 2.2 可复用基础

- `ranked_tasks` CTE + `ROW_NUMBER() OVER (PARTITION BY source_site)` 已就位，D-153-1/6 增量扩展
- `rowToTimelineRow` JS clamp（`crawlerTimeline.ts:126`）直接复用（D-153-4）
- `formatLocalHm` + `toLocaleTimeString`（`CrawlerTimelineCard.tsx:30-39`）零改动（D-153-5）
- `STATUS_COLOR` 全用 CSS 变量（D-153-2 仅追加 neutral，零硬编码）
- `CrawlerTimelineRange` 类型两端已有（`crawlerTimeline.ts:19` + `api.ts:471`）

### §3 6 决策点（D-153-1 到 D-153-6）

#### D-153-1：每站显示条数（multi-lane）

**决策：B（N=3）改良版**

N=3 的理由：时间窗内同站典型采集组合是「全量 + 增量」2 条或「增量 ×2 + 全量」3 条；N=3 覆盖 95% 场景，且 24px 行高下每 bar ≈ 6px 可读。N=5 时每 bar ≈ 3px，配合 `borderRadius: 2px` 几乎不可辨。

**关键修订 R-153-1（双层排序）**：rn≤3 后必须分两层排序，否则不同站 task 交错，破坏 grid grouping 渲染前提：
- **lane 间排序**（站与站之间）：用 `DENSE_RANK OVER (ORDER BY MAX running优先, MAX started_at DESC)` → `site_ord`
- **lane 内排序**（同站 bar）：按 rn ASC（`scheduled_at DESC` 已在 ROW_NUMBER 中决定）

**关键修订 R-153-2（LIMIT 作用于站数而非 bar 数）**：`LIMIT $2` 直接限 bar 总数 → 某站 lane 被截断。必须改为「先取 ≤$2 站，再展开 ≤$3 bar」→ `WHERE site_ord <= $2 AND rn <= $3`。

**CSS 结构**（优化任务草案 flex column 多轨道方案）：
- **推荐**：保持单个 `TRACK_STYLE` 容器（单一底色 + `overflow: hidden`），容器内各 bar `position: absolute`，按 `laneIndex` 计算 `top: ${laneIdx * (BAR_H + LANE_GAP)}px; height: ${BAR_H}px`
- rowHeight：14px → 24px（`TRACK_STYLE.height`）；`BAR_H = 6`、`LANE_GAP = 2` 提为常量
- 前端不加 `lane` 字段到 DTO；前端按 `siteKey` group 自算 laneIndex（lane 是纯渲染派生量，属 UI 层）

#### D-153-2：status 四态映射

**决策：B（4 态 ok/warn/danger/neutral）**

```ts
// statusToCategory 修订（含 R-153-3 timeout bug 修复）
function statusToCategory(raw: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (raw === 'done' || raw === 'running') return 'ok'
  if (raw === 'failed' || raw === 'timeout') return 'danger'   // R-153-3：timeout 补归 danger
  if (raw === 'paused' || raw === 'cancelled') return 'neutral'
  return 'warn'
}
```

SQL WHERE 调整：`AND ct.status IN ('running', 'done', 'failed', 'paused', 'cancelled', 'timeout')`

neutral 颜色：`neutral: 'var(--fg-muted)'`（`--fg-muted` 在本卡已使用，是既有 token，不新增）

**类型同步约束**（N0b）：前后端 status 4 态枚举必须同 commit；commit 须带 `Subagents: arch-reviewer (claude-opus-...)` trailer。

#### D-153-3：range select 前端实装

**决策：A（自治 + SWR 下沉）**

当前 dashboard 父无 range state；range 是 Card 内部纯 UI 决策，不需跨组件共享。数据拉取下沉到 Card 内部：

```ts
// Card 内部
const [range, setRange] = useState<CrawlerTimelineRange>(defaultRange ?? '1h')
const { data: timelineData } = useSWR(
  ['/admin/crawler/timeline', range],
  () => getCrawlerTimeline({ range }),
  { fallbackData: timeline ?? undefined, refreshInterval: paused || frozen ? 0 : 5000 }
)
```

Props 变更：`timeline` prop 降级为 `fallbackData`；新增可选 `defaultRange?: CrawlerTimelineRange`；不新增 `onRangeChange`。

实施时确认父组件无重复 timeline 轮询（避免双拉），若有则移除父层重复拉取逻辑。

#### D-153-4：pending 起点修正

**决策：GREATEST clamp + 保留 JS clamp（双层防御）**

- 原：`COALESCE(rt.started_at, NOW() - $1::interval) AS started_at`
- 新：`GREATEST(COALESCE(rt.started_at, rt.scheduled_at), NOW() - $1::interval) AS started_at`
- `ranked_tasks` CTE 需补 select `ct.scheduled_at`（§5 草案已含）
- `rowToTimelineRow` 的 JS clamp 保留：SQL NOW() 与 JS `new Date()` 毫秒级时间差由 JS clamp 吸收

#### D-153-5：tick 时区确认

**决策：确认现状为正确架构，零代码改动，写入 ADR 防回归**

- 后端：`computeTicks()` → `.toISOString()`（UTC）；`rangeStart`/`rangeEnd` 同
- 前端：`formatLocalHm` → `toLocaleTimeString(undefined, { hour12: false })`（浏览器本地时区）

正确理由：①SSR-safe（后端非本地化，无 hydration mismatch）②单一时区转换点（展示层，易测易改）③UTC 字符串可跨用户缓存

**🔴 防回归红线**：后端 `ticks`/`rangeStart`/`rangeEnd`/`last` 永远 UTC ISO 8601。禁止后端做时区本地化或返回 HH:MM 格式。

#### D-153-6：health N+1 消除

**决策：采纳 CTE 方案，更简洁的 COUNT FILTER 写法**

```sql
health_cte AS (
  SELECT
    source_site,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'done' AND rn_h <= 5)
            / NULLIF(COUNT(*) FILTER (WHERE rn_h <= 5), 0)
    )::int AS health
  FROM (
    SELECT
      source_site,
      status,
      ROW_NUMBER() OVER (PARTITION BY source_site ORDER BY scheduled_at DESC) AS rn_h
    FROM crawler_tasks
    WHERE type IN ('full-crawl', 'incremental-crawl')
  ) h
  GROUP BY source_site
)
```

主 SELECT：`LEFT JOIN health_cte h ON h.source_site = rt.source_site`，输出 `COALESCE(h.health, 0)::text AS health`（保持 text 类型，前端 `Number(row.health)` 不变）

### §4 类型变更合约

**后端 `apps/api/src/db/queries/crawlerTimeline.ts`**：
```diff
 export interface CrawlerTimelineRow {
-  readonly status: 'ok' | 'warn' | 'danger'
+  readonly status: 'ok' | 'warn' | 'danger' | 'neutral'
 }

 interface TimelineRawRow {
   source_site: string
   site_name: string
+  scheduled_at: Date        // D-153-4：pending 起点锚点
   started_at: Date
   effective_end: Date
   ...
 }

-function statusToCategory(raw: string): 'ok' | 'warn' | 'danger' {
+function statusToCategory(raw: string): 'ok' | 'warn' | 'danger' | 'neutral' {
   if (raw === 'done' || raw === 'running') return 'ok'
-  if (raw === 'failed') return 'danger'
+  if (raw === 'failed' || raw === 'timeout') return 'danger'
+  if (raw === 'paused' || raw === 'cancelled') return 'neutral'
   return 'warn'
 }
```

**前端 `apps/server-next/src/lib/crawler/api.ts:481`**：
```diff
-  readonly status: 'ok' | 'warn' | 'danger'
+  readonly status: 'ok' | 'warn' | 'danger' | 'neutral'
```

**前端 `CrawlerTimelineCard.tsx`**：
```diff
 const STATUS_COLOR: Record<CrawlerTimelineRow['status'], string> = {
   ok: 'var(--state-success-fg)',
   warn: 'var(--state-warning-fg)',
   danger: 'var(--state-danger-fg, var(--fg-danger))',
+  neutral: 'var(--fg-muted)',
 }

 export interface CrawlerTimelineCardProps {
   readonly timeline: CrawlerTimelineResponse | null   // 降级为 SWR fallbackData
   readonly loading: boolean
   readonly frozen: boolean
   readonly paused: boolean
   readonly onPauseToggle: () => void
+  readonly defaultRange?: CrawlerTimelineRange
 }
```

### §5 SQL 完整草案（TIMELINE_SQL_V2）

参数：$1 = range interval / $2 = 站数上限（safeLimit，默认 8）/ $3 = 每站 lane 上限（N=3）

```sql
WITH ranked_tasks AS (
  SELECT
    ct.source_site,
    cs.name AS site_name,
    ct.scheduled_at,
    ct.started_at,
    ct.finished_at,
    ct.status,
    ct.result,
    ROW_NUMBER() OVER (
      PARTITION BY ct.source_site
      ORDER BY COALESCE(ct.started_at, ct.scheduled_at) DESC
    ) AS rn
  FROM crawler_tasks ct
  JOIN crawler_sites cs ON cs.key = ct.source_site
  WHERE ct.type IN ('full-crawl', 'incremental-crawl')
    AND ct.scheduled_at >= NOW() - $1::interval
    AND ct.status IN ('running', 'done', 'failed', 'paused', 'cancelled', 'timeout')
),
site_rank AS (
  SELECT
    source_site,
    DENSE_RANK() OVER (
      ORDER BY
        MAX(CASE WHEN status = 'running' THEN 0 ELSE 1 END),
        MAX(COALESCE(started_at, scheduled_at)) DESC
    ) AS site_ord
  FROM ranked_tasks
  GROUP BY source_site
),
health_cte AS (
  SELECT
    source_site,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE status = 'done' AND rn_h <= 5)
            / NULLIF(COUNT(*) FILTER (WHERE rn_h <= 5), 0)
    )::int AS health
  FROM (
    SELECT
      source_site,
      status,
      ROW_NUMBER() OVER (PARTITION BY source_site ORDER BY scheduled_at DESC) AS rn_h
    FROM crawler_tasks
    WHERE type IN ('full-crawl', 'incremental-crawl')
  ) h
  GROUP BY source_site
)
SELECT
  rt.source_site,
  rt.site_name,
  rt.scheduled_at,
  GREATEST(COALESCE(rt.started_at, rt.scheduled_at), NOW() - $1::interval) AS started_at,
  COALESCE(rt.finished_at, NOW()) AS effective_end,
  rt.status,
  rt.result,
  COALESCE(h.health, 0)::text AS health
FROM ranked_tasks rt
JOIN site_rank sr ON sr.source_site = rt.source_site
LEFT JOIN health_cte h ON h.source_site = rt.source_site
WHERE sr.site_ord <= $2
  AND rt.rn <= $3
ORDER BY
  sr.site_ord ASC,
  rt.rn ASC
```

调用变更（`crawlerTimeline.ts:158`）：
```ts
const LANE_LIMIT = 3  // D-153-1 N=3（命名常量，不写死魔法数字）
const result = await db.query<TimelineRawRow>(TIMELINE_SQL_V2, [interval, safeLimit, LANE_LIMIT])
```

### §6 前端改动摘要

1. **STATUS_COLOR** 加 `neutral: 'var(--fg-muted)'`
2. **range 自治**：Card 内 `useState(defaultRange ?? '1h')` + `useSWR`；head actions 加 4 选项 range select
3. **multi-lane 渲染**：rows 按 `siteKey` group（保序，不重复排序）；每站单 TRACK 容器（rowHeight 24px）内各 bar 绝对定位，`top: laneIdx * (BAR_H + LANE_GAP)px; height: BAR_H px`；`BAR_H = 6`、`LANE_GAP = 2` 提常量
4. **TRACK_STYLE.height** 14 → 24
5. 不提取共享组件（当前仅 1 处消费，未达 3 处阈值）

### §7 实施步骤（CW2-B-EP 参考）

1. `apps/api/src/db/queries/crawlerTimeline.ts`
   - L19 上方：新增 `const LANE_LIMIT = 3`
   - L29：`status` 加 `| 'neutral'`
   - L40-49：`TimelineRawRow` 加 `scheduled_at: Date`
   - L65-103：替换为 `TIMELINE_SQL_V2`（§5）
   - L105-109：`statusToCategory` 补 timeout→danger + paused/cancelled→neutral
   - L158：query 参数加 `LANE_LIMIT`（$3）
2. `apps/server-next/src/lib/crawler/api.ts:481`：`status` 加 `| 'neutral'`（与步骤 1 同 commit）
3. `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`
   - `STATUS_COLOR` 加 neutral
   - `TRACK_STYLE.height` 14→24
   - Props 加 `defaultRange?`
   - 内部 `useState(range)` + `useSWR` + head actions range select
   - multi-lane group + 渲染（§6）
4. dashboard 父组件：确认无重复 timeline 轮询，若有则移除
5. `apps/api/src/routes/admin/crawlerDashboard.ts`：**无改动**

### §8 测试要点

**后端单测**（新建/扩展 `crawlerTimeline.test.ts`）：
1. multi-lane：同站 3+ task → 返回 rn≤3 三条，按 rn ASC
2. site LIMIT 语义：10 站 × 2 task，limit=8 → 返回 8 站 × ≤2 bar（非 8 bar / R-153-2 验证）
3. lane 间排序：含 running task 的站排在前（site_ord）
4. status 4 态：paused→neutral；cancelled→neutral；timeout→danger；failed→danger；done→ok
5. D-153-4 pending 起点：未 started task → startPct 对应 scheduled_at；窗口前 scheduled → GREATEST clamp 到 0
6. health CTE：3 done/2 failed → health=60；无 task → health=0；health 不受时间窗过滤
7. health N+1 消除：断言 db.query 调用 1 次（不是 N+1）

**前端单测**（`CrawlerTimelineCard.spec.tsx`）：
8. neutral status bar → `background: var(--fg-muted)`
9. multi-lane：3 row 同 siteKey → 1 site 行 + 3 bar（top 值递增）
10. range select 切换 → getCrawlerTimeline 带新 range 调用
11. paused/frozen → refreshInterval=0
12. tick 时区：UTC ISO mock → `formatLocalHm` 输出本地 HH:MM

### §9 风险与 follow-up（N-list）

- 🔴 **N0（红线）**：后端 `ticks`/`rangeStart`/`rangeEnd`/`last` 永远 UTC ISO 8601，禁止后端本地化（D-153-5）
- 🔴 **N0b（契约同步）**：前后端 status 4 态枚举必须同 commit；commit 须带 `Subagents: arch-reviewer (claude-opus-...)` trailer
- **N1（advisory）**：range 持久化（URL param / localStorage），刷新保持 → follow-up
- **N2（advisory）**：health 「最近 5 次」可参数化 → follow-up
- **N3（advisory）**：`LANE_LIMIT = 3` 可按 range 动态调 → follow-up
- **N4（提取候选）**：KPI 卡 / runs 详情未来若需 Gantt，提取 `<GanttTrack>` 共享组件（当前 1 处，未达 3 处阈值）
- **N5（性能监测）**：multi-lane 后 bar 总数 ≤ limit×3 = 24（默认 8×3），DOM 轻量；CW2-B-EP 后 benchmark 确认 < 50ms，> 200ms 走 ADR-122 D-122-4 `DISTINCT ON` 降级

### §10 评审结论（2026-05-25）

**arch-reviewer Opus 1 轮独立评审**：A− CONDITIONAL → 主循环落实 R3+Y3+G2 修订后 🟢 等同 A

**修订摘要（已含入本 ADR）**：
- ✅ R-153-1 §3 D-153-1 + §5：双层排序——lane 间 `DENSE_RANK over site`（site_ord）+ lane 内 rn ASC；SQL 用 site_rank CTE 实现（§5 完整草案已含）
- ✅ R-153-2 §3 D-153-1 + §5：`LIMIT` 语义改为「站数」——`WHERE site_ord <= $2 AND rn <= $3`（§5 完整草案已含）
- ✅ R-153-3 §3 D-153-2 + §4：`timeout` 补归 danger（statusToCategory 隐藏 bug 修正，§4 diff 已含）
- ✅ Y-153-1 §3 D-153-3 + §7 step 4：range 自治 = SWR 下沉，确认父组件无重复轮询
- ✅ Y-153-2 §6：multi-lane CSS 改单 TRACK 容器 + 绝对定位 bar（非 flex column 多轨道）
- ✅ Y-153-3：N+1 并入 SQL 重写，不单独立卡
- ✅ G-153-1 §5 + §6：`LANE_LIMIT` / `BAR_H` / `LANE_GAP` 提命名常量
- ✅ G-153-2 §6：前端 group 保序复用 SQL 排序，不重复前端排序

**最终结论**：ADR-153 status 🟢 Accepted via R3+Y3+G2 修订（2026-05-25 / arch-reviewer Opus 评级 A− → 主循环修订后等同 A）；CW2-B-EP 实施卡可启动；PATCH 范围 4 项（SQL 重写 / status 4 态双侧 / range 自治 / multi-lane 渲染）≤ 5 项，无需拆 -A/-B 子卡。

### AMENDMENT 2026-05-26（ADR-155 §3 D-155-3 / EP-3a）

**触发**：@livefree 走读 W2 后追问 Gantt 图核心语义 — D-153-4 GREATEST 钳值把 pending bar 强制 clamp 到窗口左端，破坏 durationSeconds 业务字段（real 持续时长被压缩到窗口范围）。

**变更**：D-153-4 SQL `GREATEST(COALESCE(rt.started_at, rt.scheduled_at), NOW() - $1::interval) AS started_at` → 移除 GREATEST，改为直接 `COALESCE(rt.started_at, rt.scheduled_at) AS started_at`（保留真实值）；JS 层 `rowToTimelineRow` 加双字段语义 clamp（R-155-2 必修）。

**关键修订点**：
- **SQL 移除 GREATEST**：`crawlerTimeline.ts` TIMELINE_SQL_V2 SELECT 子句 line 140 GREATEST 整段删除；保留 started_at 真实值（包括 pending bar 的 scheduled_at 远早于窗口的场景）
- **R-155-2 JS 双字段 clamp**（`rowToTimelineRow`）：
  - `durationSeconds = (realEnd - realStart) / 1000` — 真实业务值（hover tooltip 显示，不受窗口位置影响）
  - `visStart = Math.max(realStart, rangeStartMs)` / `visEnd = Math.min(realEnd, rangeEndMs)` — JS 层 viewport clamp（替代 SQL GREATEST）
  - `startPct / widthPct` 基于 visStart/visEnd 计算（SVG bar 不溢出窗口）
- **D-153-3 range 自治 AMENDMENT**：原 4 选项 30m/1h/2h/6h 扩展为 7 选项（加 12h/24h/7d 长历史回看 / D-155-3 同步实施）

**关联**：ADR-155 §3 D-155-3 / EP-3a / R-155-2（commit 待提交） + ADR-122 §timeline 端点契约 AMENDMENT 2026-05-26（同 commit）

---
## ADR-154 — Fix-D5 定时增强：间隔触发模式（CHG-SN-9-CW2-C-ADR）

> **Status**: 🟢 Accepted（2026-05-25 / arch-reviewer Opus A− → 主循环修订后等同 A）
> **触发**：W2 plan §Fix-D5——crawlerScheduler.ts 当前只支持"每日定时"（daily）一种模式；用户需要"每 N 小时采一次"（interval）场景，无需等待特定时刻。
> **ADR 存在性澄清**（arch-reviewer Opus §0 核验结论）：本次不引入新依赖（D-154-2=B）、不新增 admin route（auto-config GET/POST 已存在）、per-site schedule 不扩展（D-154-4=B），原"BLOCKER 解锁"成文理由消失。本 ADR **降级为"决策备忘 + 设计记录"**，主要价值是记录"为何选 B 而非 A/C"，供 CW2-C-EP-A/-B 实施卡参考，避免实施期偏离。
> **关联**：ADR-152（maintenanceScheduler interval 推算判例 / R-152-2 拒绝引入 cron-parser）、ADR-153（CW2-B-EP / 同期任务）

### §1 决策摘要

| 决策点 | 主题 | 最终结论 |
|--------|------|----------|
| D-154-1 | scheduleType enum | **B**：两态 `daily \| interval`（开放扩展位，cron 后续再议）|
| D-154-2 | cron-parser 依赖 | **B**：不引入（与 ADR-152 R-152-2 判例一致，interval 覆盖验证需求） |
| D-154-3 | last_trigger 精度 | **A**：新增 `auto_crawl_last_trigger_at`（ISO8601 UTC 语义键）；旧 DATE 键保留 |
| D-154-4 | per-site schedule | **B**：不支持（无验证需求，防触发拆卡阈值）|
| D-154-5 | dispatch 架构 | **A**：switch 分支 + 独立纯函数 `checkDaily` / `checkInterval` |
| D-154-6 | UI 条件渲染 | **A**：AdminSelect + 条件渲染（复用现有 AdminSelect 范式） |

### §2 背景与问题

crawlerScheduler.ts 当前逻辑（TICK_MS=60s 进程内 ticker）：
- HH:MM 与 config.dailyTime 精确匹配才触发
- `auto_crawl_last_trigger_date DATE`（天级字符串）防当天重复触发
- 单一触发模式，无法满足"每 N 小时采一次"

W2 plan Fix-D5 目标：interval 模式——上次触发后 intervalMinutes 分钟内不重触，超出则触发。

### §3 6 决策点详述

#### D-154-1：scheduleType enum — B（两态）

与 ADR-152 R-152-2"interval 推算优先"判例完全一致。interval 覆盖 100% 已验证需求（每 N 小时），cron 无已验证需求。enum 设计为开放联合类型（`'daily' | 'interval'`），后续若确需 cron，增量扩展无破坏性。

`auto_crawl_schedule_type` 键已在 SystemSettingKey 枚举中（system.types.ts:21），setAutoCrawlConfig 写死 'daily' 须解锁改为动态写。

#### D-154-2：cron-parser 依赖 — B（不引入）

CLAUDE.md「引入技术栈以外新依赖 → BLOCKER」。interval 模式 next-run 判定是 `lastTriggerAt + intervalMinutes*60_000 <= now`，无需外部解析器。与 ADR-152 R-152-2 同域判例一致。如未来确需 cron，另起 ADR 专门论证引入价值。

#### D-154-3：last_trigger 精度 — A（新增 TIMESTAMPTZ 语义键）

interval 模式必须时间戳级锚点。system_settings 是 KV 表（value text），无 DDL 列类型变更——新增 `auto_crawl_last_trigger_at` 语义键，value 约定存 ISO8601 UTC 字符串（空串 = 从未触发）。旧 `auto_crawl_last_trigger_date` 保留，daily 模式继续使用。

migration 075 SQL（KV seed，首次触发由 ticker upsert 写入）：
```sql
-- Migration 075: Fix-D5 interval 模式触发时刻锚点（ADR-154 D-154-3）
-- auto_crawl_last_trigger_at：value = ISO8601 UTC 字符串（空串 = 从未触发）
-- 旧 auto_crawl_last_trigger_date 保留（daily 模式继续使用）
INSERT INTO system_settings (key, value, updated_at)
VALUES ('auto_crawl_last_trigger_at', '', NOW())
ON CONFLICT (key) DO NOTHING;

-- ROLLBACK:
-- DELETE FROM system_settings WHERE key = 'auto_crawl_last_trigger_at';
```

新增 SystemSettingKey：`'auto_crawl_interval_minutes'`、`'auto_crawl_last_trigger_at'`。

#### D-154-4：per-site schedule — B（不支持）

AutoCrawlSiteOverride 保持现状（enabled/mode），调度节奏属全局编排职责。per-site 扩展无已验证需求，且会触发 PATCH 卡 5 项阈值拆分。预留 A 形态扩展位（可选 `schedule?` 字段）供未来增量落地。

#### D-154-5：dispatch 架构 — A（switch + 独立函数）

CLAUDE.md「函数 > 80 行 / 多独立逻辑阶段 → 先拆分」。加入 interval 后单函数必触发，抽 `checkDaily` / `checkInterval` 为纯判定函数（无 IO，可单测）。

关键约束（R-154-1）：**interval 锚点写入须在 createRun 成功之后**。createRun 抛错时锚点不前进，保证下次 tick 正确重试。daily 现有代码（setSetting 在 createAndEnqueueRun 之后）已是正确顺序，interval 必须沿用。

```
runSchedulerTick:
  → freeze / globalEnabled 守卫
  → config.scheduleType === 'interval' ? checkInterval(config, now, lastTriggerAt) : checkDaily(config, now, lastTriggerDate)
  → if !decision.shouldTrigger: return
  → createScheduledRun(config)  // 先建 run
  → persistTriggerMark(db, scheduleType, now)  // 成功后才写锚点（R-154-1）
```

#### D-154-6：UI 条件渲染 — A（AdminSelect + 条件渲染）

顶部加 `scheduleType` AdminSelect（`data-testid="scheduler-scheduleType"`），两选项：每日定时 / 间隔触发。dailyTime 行用 `{config.scheduleType === 'daily' && ...}` 包裹，新增 intervalMinutes number input 行用 `{config.scheduleType === 'interval' && ...}` 包裹。全部复用现有 FIELD_STYLE / LABEL_STYLE / AdminInput。

### §4 类型变更合约

**`packages/types/src/system.types.ts`**：
```diff
 export type SystemSettingKey =
+  | 'auto_crawl_interval_minutes'
   | 'auto_crawl_last_trigger_date'
+  | 'auto_crawl_last_trigger_at'

+export type AutoCrawlScheduleType = 'daily' | 'interval'

 export interface AutoCrawlConfig {
   globalEnabled: boolean
-  scheduleType: 'daily'
+  scheduleType: AutoCrawlScheduleType
   dailyTime: string
+  intervalMinutes: number   // 默认 60；daily 模式忽略但持久化保留
   defaultMode: AutoCrawlMode
   ...
 }
```

**`apps/api/src/routes/admin/crawler.ts`（zod schema 扩展）**：
```diff
-  scheduleType: z.literal('daily').default('daily'),
+  scheduleType: z.enum(['daily', 'interval']).default('daily'),
+  intervalMinutes: z.number().int().min(5).max(1440).default(60),
```

### §5 实施步骤（CW2-C-EP 参考）

**拆分为 -A/-B 子卡（6 项改动 > 5 项阈值）**：

**CW2-C-EP-A（后端契约 + 调度，自洽闭环）**：
1. `packages/types/src/system.types.ts`：扩展 SystemSettingKey + AutoCrawlScheduleType + AutoCrawlConfig
2. `apps/api/src/db/migrations/075_auto_crawl_schedule_extend.sql`：KV seed
3. `apps/api/src/db/queries/systemSettings.ts`：deserialize + set 读写 intervalMinutes + scheduleType
4. `apps/api/src/routes/admin/crawler.ts`：zod schema 扩展
5. `apps/api/src/workers/crawlerScheduler.ts`：dispatch 重构 + checkInterval + persistTriggerMark
6. 后端单测：checkInterval 边界 + deserialize 向后兼容 + R-154-1 锚点时序

**CW2-C-EP-B（前端 UI）**：
1. `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`：scheduleType select + 条件渲染
2. UI 单测：scheduleType 切换 + 条件字段显示/隐藏

### §6 注意事项

- **architecture.md 同步**：migration 075 新增 system_settings 键须同步到 docs/architecture.md（CLAUDE.md 绝对禁止项反面义务）
- **D-153-5 防回归**：crawlerScheduler 不涉及时区，但 `auto_crawl_last_trigger_at` 须存 UTC ISO 字符串（遵循 ADR-153 D-153-5 UTC 原则）

### §10 评审结论（2026-05-25）

**arch-reviewer Opus 1 轮独立评审**：A− → 主循环落实两条件后等同 A

**关键修订已含入**：
- ✅ ADR 存在性降级（§1 澄清：设计备忘，非 BLOCKER 解锁）
- ✅ D-154-1=B：两态，与 ADR-152 R-152-2 判例一致
- ✅ D-154-2=B：不引入 cron-parser
- ✅ D-154-4=B：per-site schedule 不支持
- ✅ R-154-1：锚点写入时序约束（createRun 成功后才写）
- ✅ 6 项改动 > 5 项 → CW2-C-EP 必须拆 -A/-B 子卡

**最终结论**：ADR-154 status 🟢 Accepted（2026-05-25 / arch-reviewer Opus A− → 等同 A）；CW2-C-EP 须拆 -A（后端）/ -B（前端）两张子卡后启动。PATCH 范围各子卡 ≤ 5 项。

### AMENDMENT 2026-05-26（ADR-155 §3 D-155-6 / EP-1C-1a + EP-1C-1b）

**触发**：@livefree 用户走读 EP-1B2 后反馈"3am + 4am 多 dailyTime 期望各触发一次，实际只剩第二个"。原 ADR-154 D-154-1 选 `daily | interval` 两态时单 dailyTime 是合理简化，但暴露多时间需求。

**变更**：ADR-154 §D-154-1 dailyTime 决策从"单字符串 HH:MM"扩为"`dailyTimes: string[]` 数组（min 1 max 24）"；防重维度从"`auto_crawl_last_trigger_date` 天级"升级为"`auto_crawl_last_trigger_marks JSONB` `{YYYY-MM-DD HH:MM: isoTs}` 同日不同时间各触发一次"。

**关键修订点**：
- **类型契约**（EP-1C-1a / commit c3d010f7）：`AutoCrawlConfig.dailyTimes: readonly string[]` 主字段 + `dailyTime` 标 `@deprecated` alias = `dailyTimes[0] ?? '03:00'` 向后兼容；`SystemSettingKey` 加 `'auto_crawl_last_trigger_marks'`
- **KV 序列化**（EP-1C-1a）：`auto_crawl_daily_time` value 从 `"03:00"` 改为 `'["03:00","04:00"]'` JSON 数组；新 `parseDailyTimes` 3 路径兼容旧 5 种历史值（JSON 数组 / JSON 字符串 / 旧裸单字符串 / 空兜底 / 非法过滤）；`setAutoCrawlConfig` 永远 `JSON.stringify(dailyTimes)`
- **zod preprocess**（EP-1C-1b）：POST `/admin/crawler/auto-config` 同时接受 `{dailyTime}` 旧 schema 和 `{dailyTimes}` 新 schema，transform 输出永远同时含两字段；refine 保证至少一个存在
- **scheduler checkDaily**（EP-1C-1b）：签名从 `(config, now, lastTriggerDate)` 改为 `(config, now, marks)`，返回 `{ shouldTrigger, matchedTime }`；多 dailyTime 任一匹配触发 + marks 防重维度从 date 升级到 `date#HH:MM`
- **persistTriggerMark daily 流**（EP-1C-1b）：写 `marks[today#matchedTime] = isoTs` + Y-155-2 GC 7 天前 keys（cutoff = `now - 7d` / 防 marks 无界增长）；旧 `auto_crawl_last_trigger_date` 保留向后兼容但 scheduler 不再读不再写

**关联**：ADR-155 §3 D-155-6（🟢 Accepted）/ EP-1C-1a 类型契约 + KV 兼容 / EP-1C-1b zod preprocess + scheduler 重构 / R-155-3 KV 3 路径 / R-155-6 zod preprocess / Y-155-1 setter 落点 / Y-155-2 marks GC

---

## ADR-155 — CW1/CW2 用户走读修订（CHG-SN-9-CW1-CW2-REDESIGN-A-ADR）

> **Status**: 🟢 Accepted（2026-05-26 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 6 红线 + 5 黄线 + 关键洞察 → 等同 A）
> **触发**：W1（SEQ-20260525-CRAWLER-W1）+ W2（SEQ-20260525-CRAWLER-W2）全程绕过 ADR-149 §7 "用户走读 ≥ 1 次 + dev server 实测硬前置"。HOTFIX-A/B/C（commits d79769cc / 0a0cc4e8 / b1491aea，2026-05-26）修复 3 个 P0 + 1 个 P1 + 1 个 UI 可见性后，@livefree 实测又暴露 4 处设计层缺陷 + 1 处功能性约束（多 dailyTime）。统一起草 ADR-155 覆盖 6 个独立但相关的设计决策。
> **ADR 存在性**：本 ADR 是 ADR-122 / ADR-152 / ADR-153 / ADR-154 的 AMENDMENT 集合 + 1 处新组件契约（AutoCrawlSummaryCard）。**必须 arch-reviewer Opus 评审**：D-155-2 触发 packages/admin-ui/src/shell/types.ts NotificationItem 扩展（CLAUDE.md "共享组件 API 契约强制 Opus"）。
> **关联**：ADR-122（timeline 端点契约）、ADR-149 §7（用户走读硬前置 / 本卡是其反面教材）、ADR-150（DataTable expandedKeys 已实装）、ADR-152（topbar 三源聚合 / D-155-2 删除 BackgroundEventBell）、ADR-153（timeline SQL V2 / D-155-3 三段窗 AMENDMENT）、ADR-154（scheduleType 两态 / D-155-6 多 dailyTime AMENDMENT）

### §1 决策摘要

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|----------|------|
| D-155-1 | CW1-B run 行内展开 | **A**：DataTable expandedKeys + renderExpandedRow，独立路由 deep link fallback | 复用现有 ADR-150 API |
| D-155-2 | CW1-E Topbar 图标合并 | **A**：删除 BackgroundEventBell，扩展 NotificationItem discriminated union + TaskItem 加 background 来源 | **强制 Opus arch-reviewer trailer** |
| D-155-3 | CW2-B Gantt 三段窗 | **A**：`[NOW-range×0.7, NOW+range×0.3]` + now-line 垂直指示线 + pending bar 真位 + range 加 12h/24h/7d + 拖拽平移（pan） | ADR-122/153 AMENDMENT |
| D-155-4 | CW2-B 站点 limit 解锁 | **A**：UI 加 `limit select` 选项 `8 / 20 / all`，后端 safeLimit 上限 20→50；> 50 站给性能提示 | ADR-153 AMENDMENT |
| D-155-5 | 定时设置显式入口卡 | **A**：`/admin/crawler` 顶部加 AutoCrawlSummaryCard 摘要 + [立即关闭] 快捷 + [编辑] 按钮 | 新组件契约 |
| D-155-6 | 多 dailyTime 支持 | **A**：`dailyTime: string` → `dailyTimes: string[]`（min 1 max 24）；KV serialize JSON 数组（向后兼容旧单字符串）；checkDaily 任一时间匹配触发；防重维度从 date 升级为 `date#HH:MM` | ADR-154 AMENDMENT |

### §2 背景与问题

@livefree 走读 CW1/CW2 落地结果，识别 6 类缺陷：

1. **D-155-1**：`/admin/crawler/runs` 行 → `/admin/crawler/runs/[id]` 独立页跳转。run 详情仅 6 个 meta 字段 + tasks 子表（通常 ≤ 50 task），适合行内展开避免上下文切换。`packages/admin-ui` 早已实装 `renderExpandedRow + expandedKeys` API（CHG-DESIGN-02 Step 7A），CW1-B 实施时未消费。
2. **D-155-2**：CW1-E（ADR-152）BackgroundEventBell 用 position:fixed 旁路叠加在 AdminShell topbar 右上角，topbar 已有铃铛（notifications）+ 闪电（tasks）两图标可消费。changelog 自承 N1-152-A 路径是为规避"共享组件 API 契约强制 Opus"。违反价值排序 #2（边界与复用）+ #4（一致性）。
3. **D-155-3**：CW2-B（ADR-153）时间轴当前 `[NOW-range, NOW]` 单段窗 + 当前时间在最右 + 不支持拖拽 + 不支持历史回看。Gantt 图核心语义是"任务时间线相对位置 + 并发关系 + 历史回顾"，单段窗 + 滚动 logs 形态丢失了 Gantt 价值。pending bar clamp 到 NOW 导致全部堆右端。
4. **D-155-4**：CW2-B `getCrawlerTimeline(limit=8)` 硬编码，超过 8 站的部署看不到完整状态。`safeLimit` 上限 20 但 UI 未暴露选择器。
5. **D-155-5**：当前 schedule 配置仅在 `Dashboard AutoCrawlScheduleCard` 显示（用户必须切到 `/admin` 才能看），且 "关闭定时" 必须打开 SchedulerConfigDrawer 反勾 globalEnabled（用户感知"为什么没有快捷关闭按钮"）。`/admin/crawler` 主页面缺 schedule summary 入口。
6. **D-155-6**：当前 `AutoCrawlConfig.dailyTime: string` 单一时间，@livefree 期望 "3am + 4am 多时间触发"。ADR-154 D-154-1 选 `daily | interval` 两态，未考虑 daily 多时间需求。

### §3 6 决策点详述

#### D-155-1：CW1-B 行内展开 — A（DataTable expandedKeys）

**备选**：
- A：消费 `packages/admin-ui` DataTable `renderExpandedRow + expandedKeys` API；拆 `CrawlerRunDetailView` 为 `RunInlinePanel`（meta grid + tasks 子表 + TaskLogsDrawer）；list 行点击 toggle expand；`/admin/crawler/runs/[id]` 保留为 deep link fallback（PageHeader 自渲，body 复用 RunInlinePanel）
- B：DataTable 不改，仅在 list 行下方插 collapsible section；保留独立详情页
- C：彻底删除 `/admin/crawler/runs/[id]` 路由（仅行内展开）

**推荐 A 的理由**：
- ADR-150 早已实装 `renderExpandedRow + expandedKeys`（无新组件成本）
- 拆分 `RunInlinePanel` 后 list 行内展开 + deep link 两种入口共用同一渲染逻辑（DRY）
- 删除路由（C）破坏分享链接 / 浏览器 history / SEO，不符合 admin 工具习惯

**实施**：
- `RunInlinePanel.tsx`（新建，拆自 CrawlerRunDetailView）：接收 `runId` + 内部自治拉 run/tasks
- `CrawlerRunsView.tsx`：加 `expandedKeys` state + `onRowClick` toggle + `renderExpandedRow={(run) => <RunInlinePanel runId={run.id} />}`；Run ID 列 cell 从 `<a href>` 改为按钮 toggle，旁加 "⧉ 新窗口打开" 副入口（深链接备份）
- `CrawlerRunDetailView.tsx`：瘦身为 PageHeader + RunInlinePanel
- `runs/[id]/page.tsx`：保留 deep link fallback，无改动

**偏离规约**：本 D-N 不引入新组件 API；仅消费现有 ADR-150 公约 → 不触发 Opus arch-reviewer。

#### D-155-2：CW1-E Topbar 图标合并 — A（删除 BackgroundEventBell + 扩展 NotificationItem）

**备选**：
- A：删除 `BackgroundEventBell` + `useAdminBackgroundEvents`，扩展 `NotificationItem` discriminated union 加 `category: 'general' | 'background'`；BackgroundEventService 三源（upcoming/active/finished）合并到 `useAdminNotifications` + `useAdminTasks` 内部
- B：保留 BackgroundEventBell 但移除 position:fixed，注入 AdminShell topbarIcons 第 6 槽（需扩 admin-shell types.ts `TopbarIcons` 5→6）
- C：现状不动（接受重复铃铛）

**推荐 A 的理由**：
- AdminShell 数据流是 `notifications + tasks` 二元，BackgroundEvent 三源（upcoming/active/finished）本质上是"通知 + 任务"的混合：upcoming（autoCrawlNext + scheduler nextRun）→ NotificationItem；active crawler_runs → TaskItem；finished/failed crawler_runs → NotificationItem
- B 方案仍需要扩 admin-shell types.ts，且新加第 3 个 popover 是冗余 UX（用户期望 2 个图标，不是 3 个）
- C 违反价值排序 #2（边界与复用）

**实施**：
- `packages/admin-ui/src/shell/types.ts`：扩展 `NotificationItem` 加 `category?: 'general' | 'background'`（discriminated union 友好 / 向后兼容 default 'general'）+ `TaskItem` 加 `source?: 'crawler' | 'maintenance' | 'general'`
- **R-155-1（必修 / arch-reviewer Opus 红线）类型双源镜像同步**：`packages/types/src/admin-shell.types.ts:12-36` `AdminNotificationItem / AdminTaskItem`（admin-ui 的 SSOT 镜像 / api 包反向依赖避让）**必须同 commit 同步**：加 `category?: 'general' | 'background'` + `source?: 'crawler' | 'maintenance' | 'general'`。两份类型严格同步是硬约束（avoid drift）。
- **Y-155-3 路径选择**：`useAdminNotifications` 内部合并 BackgroundEventService 三源 — 选择"**前端并发两 GET**"短期方案。即 `useAdminNotifications` 内部并发 GET `/admin/notifications` + GET `/admin/system/background-events`，前端 merge 后按 category 渲染；`useAdminTasks` 同模式合并 background 的 `active` 子集。接受额外 1 个 60s 轮询请求的开销（性能影响可控，与 ADR-152 60s polling 频率对齐）。
- **未来演化（ADR-156 候选 / 本卡不实施）**：若 60s 双端点轮询性能瓶颈，起 ADR-156 «notifications 端点扩展» 将 BackgroundEventService 内嵌到 `/admin/notifications` + `?include=background` 参数；同步 ADR-147 端点契约 AMENDMENT。本卡 §7 风险章节登记此演化方向。
- `apps/server-next/src/lib/admin-shell-notifications.ts`：`useAdminNotifications` 内部并发 GET 两端点 + merge by category；`useAdminTasks` 同模式
- `apps/server-next/src/app/admin/admin-shell-client.tsx`：删除 `<BackgroundEventBell>` + `useAdminBackgroundEvents` import
- **删除文件**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx` + `apps/server-next/src/lib/admin-shell-background-events.ts`
- `apps/api/src/services/BackgroundEventService.ts`：**保留**（端点真源）
- `apps/api/src/routes/admin/systemBackgroundEvents.ts`：**保留**（继续作为 useAdminNotifications 第 2 个 GET 源；ADR-156 立项后才合并）

**偏离规约**：扩 `packages/admin-ui/src/shell/types.ts` + `packages/types/src/admin-shell.types.ts` **双源**公开 Props → **强制 commit trailer `Subagents: arch-reviewer (claude-opus-4-7)`** + reviewer 必须**显式审查双源镜像同步**（CLAUDE.md "共享组件 API 契约强制 Opus" + arch-reviewer §5 关键洞察 #2 process 红线复发监测）。本 D-N 是触发条件。

#### D-155-3：CW2-B Gantt 三段窗 — A（[NOW-range×0.7, NOW+range×0.3] + now-line + 拖拽）

**备选**：
- A：时间窗改为 `[NOW-range×0.7, NOW+range×0.3]`（70% 历史 / 30% 未来 buffer）+ now-line 垂直 1px 实线（color=`var(--accent-default)`，固定在 NOW 位置）+ pending bar 显示在 scheduled_at 真实位置（不再 clamp 到 NOW）+ range 选项加 `12h / 24h / 7d` + 鼠标拖拽时间轴平移（pan）支持
- B：仅加 range 12h/24h/7d，时间窗仍 `[NOW-range, NOW]`，不加 now-line / 不加拖拽
- C：完全重写为基于第三方 Gantt 库（如 frappe-gantt） — 引入新依赖

**推荐 A 的理由**：
- 用户走读明确诉求"看到历史 + 看到当前位置 + 拖拽回顾"，B 只解决"范围扩大"未解决"语义"
- C 引入新依赖（CLAUDE.md BLOCKER），且现有 SVG 渲染足以表达
- 70/30 切分给未来预留 30% 显示 scheduler nextRun（与 ADR-152 autoCrawlNext 数据流串联）

**实施**：
- `apps/api/src/db/queries/crawlerTimeline.ts`：
  - `RANGE_TO_INTERVAL` + `RANGE_TO_MS` 加 `12h / 24h / 7d`
  - `getCrawlerTimeline` 计算 `rangeStart = NOW - range × 0.7` / `rangeEnd = NOW + range × 0.3`
  - SQL WHERE 仍是 `COALESCE(finished_at, NOW()) >= rangeStart`（HOTFIX-A Step 2 已实施）
  - SQL SELECT 移除 D-153-4 `GREATEST(COALESCE(rt.started_at, rt.scheduled_at), NOW() - $1::interval) AS started_at` 钳值，改为直接 `COALESCE(rt.started_at, rt.scheduled_at) AS started_at`（保留真实值，由 JS 层做可视化 clamp）
  - **R-155-2（必修 / arch-reviewer Opus 红线）JS clamp 同步修订**：`rowToTimelineRow` 必须区分**两个语义**：
    - `durationSeconds`（业务字段 / hover tooltip 显示）= **真实 task 持续时长** `(endMs - startMs) / 1000`，与窗口位置无关
    - `startPct / widthPct`（可视化字段 / SVG 渲染位置）= **基于 viewport 二次 clamp**，需新增 `clampedDurationVisible` 概念：
      ```ts
      // 真实值（业务语义）
      const realStart = row.started_at.getTime()
      const realEnd = row.effective_end.getTime()
      const durationSeconds = Math.round((realEnd - realStart) / 1000)  // ← 真实，可能远大于窗口

      // 可视化值（SVG 渲染）
      const visStart = Math.max(realStart, rangeStartMs)  // JS 层 clamp 到窗口左侧（替代 SQL GREATEST）
      const visEnd = Math.min(realEnd, rangeEndMs)        // JS 层 clamp 到窗口右侧
      const span = rangeEndMs - rangeStartMs
      const startPct = Math.max(0, Math.min(1, (visStart - rangeStartMs) / span))
      const widthPct = Math.max(0.01, Math.min(1 - startPct, (visEnd - visStart) / span))
      ```
  - 这样 startPct/widthPct 不再溢出，durationSeconds 仍是真实业务值，hover tooltip 正常显示"已运行 3 天"等。
- `apps/api/src/routes/admin/crawler.ts`：timeline route range zod enum 加 12h/24h/7d
- `apps/server-next/src/lib/crawler/api.ts`：`CrawlerTimelineRange` 类型扩展
- `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`：
  - now-line 渲染：`position: absolute; left: 70%; width: 1px; height: 100%; background: var(--accent-default)`
  - pending bar 虚线边框 + 半透明（区分已发生 vs 计划）
  - **R-155-5（必修）拖拽 pan + viewport 防抖 + 历史封顶**：
    - mousedown + mousemove 计算 deltaX → 调整 `viewportStart / viewportEnd` state（不改 range，只改窗口偏移）；拖拽期间 SVG 重渲染 throttle 16ms（60fps）
    - **viewport buffer 预拉**：每次拉数据时窗口左右各 +0.5×range 预拉，拖拽时只移视口不重 fetch（避免 race）
    - **拖拽停止 300ms 防抖**：mousestop 300ms 后才检查是否超出预拉缓冲，超出再触发新 range fetch
    - **历史回看封顶 30d**：viewportStart 最早不超过 `NOW - 30 × 24 × 3600 × 1000`（与 ADR-152 windowHours max=24 的设计哲学对齐），超出给用户提示"超出可视历史范围 30 天"
  - 空窗口提示加 "扩大到 6h" / "扩大到 24h" 快捷按钮
- 单测：crawlerTimeline.test 加 5 case（70/30 切分 + now-line 位置 + range 12h/24h/7d + JS clamp 真实 vs 可视化双字段 + durationSeconds 不受 clamp 影响）；CrawlerTimelineCard.test 加 6 case（now-line 渲染 + pending 虚线 + 拖拽 pan + 防抖 300ms + viewport buffer + 7 range 选项 + 30d 封顶）

**偏离规约**：D-155-3 是 ADR-122 §时间窗策略 + ADR-153 §pending clamp 决策的 AMENDMENT。本 D-N 不动 packages/admin-ui types，不触发 Opus arch-reviewer。`durationSeconds` 业务字段语义不变（不破坏现有消费方）。

#### D-155-4：CW2-B 站点 limit 解锁 — A（UI limit select + 后端 safeLimit 50）

**备选**：
- A：UI 在 range select 旁加 `limit select` 选项 `8 / 20 / all`（"all" 传 `safeLimit` 最大 50）；后端 `safeLimit` 上限 20→50；> 50 站时给用户性能提示
- B：UI 不加选择器，后端 `safeLimit` 默认改为 sites 总数（无限制）
- C：保留硬编码 limit=8

**推荐 A 的理由**：
- B 无 UI 控制权 + 性能不可预测（一旦站点 > 100 SQL 退化为全表 RANGE）
- C 是现状（用户不满）
- 50 上限是合理的"显示密度 vs 性能"折衷（每站 3 bar × 50 = 150 bar / 24h 窗口）

**实施**：
- `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`：range select 旁加 `limit select`（默认 8）
- `apps/api/src/db/queries/crawlerTimeline.ts`：`safeLimit` 上限 `Math.min(50, Math.trunc(limit))`
- 单测：crawlerTimeline.test 加 1 case（safeLimit 50 cap）

**偏离规约**：本 D-N 是 ADR-122 §LIMIT 语义 AMENDMENT。不触发 Opus。

#### D-155-5：定时设置显式入口卡 — A（AutoCrawlSummaryCard）

**备选**：
- A：`/admin/crawler` 顶部紧邻 PageHeader 下方加 `AutoCrawlSummaryCard`：scheduleType label + 时间/间隔显示 + globalEnabled 状态 pill + [立即关闭] 快捷按钮（toggle globalEnabled=false 调 POST /auto-config 不弹 Drawer）+ [编辑] 按钮（打开 SchedulerConfigDrawer）
- B：仅在 PageHeader chip 显示 globalEnabled 状态，不加独立卡
- C：在 SchedulerConfigDrawer 内加 [立即关闭] tab，仍需打开 Drawer

**推荐 A 的理由**：
- B 信息量不够（用户走读希望看到 dailyTimes 完整列表 + intervalMinutes 等）
- C 一键关闭仍需要 2 次点击（打开 Drawer → 反勾）
- A 提供 "查看 + 一键关闭 + 编辑" 三入口，符合 D-155-5 用户诉求

**实施**：
- `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（新建，约 150 行）：复用 `Pill` + `AdminButton` + `AdminCard` 原语
- `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`：嵌入 `<AutoCrawlSummaryCard />` 在 `<PageHeader>` 之后
- [立即关闭] 调用 `setAutoCrawlConfig({ ...config, globalEnabled: false })` → toast "已关闭自动调度" → invalidate auto-config swr cache
- 单测：AutoCrawlSummaryCard.test 新建（5 case：disabled 渲染 / countdown 渲染 / scheduler-disabled 渲染 / [立即关闭] 调用 / [编辑] 链接）

**偏离规约**：新组件不修改 packages/admin-ui types，仅 server-next 内部组件 → 不触发 Opus。

#### D-155-6：多 dailyTime 支持 — A（dailyTime: string → dailyTimes: string[]）

**备选**：
- A：`AutoCrawlConfig.dailyTime: string` → `dailyTimes: string[]`（min 1 max 24）；KV `auto_crawl_daily_time` 改 JSON 数组（向后兼容旧单字符串：解析失败时回退 [v]）；`checkDaily` 改"任一时间匹配触发"；防重维度 `auto_crawl_last_trigger_date` 升级为 `auto_crawl_last_trigger_marks JSONB`（{`YYYY-MM-DD HH:MM`: true, ...}）允许同日不同时间各触发一次
- B：保留 dailyTime: string，加 dailyTimesExtra: string[] 副字段（最多 N 个额外时间）
- C：不实施，用户改用 interval 模式

**推荐 A 的理由**：
- B 设计冗余（主时间 + 额外时间），用户认知负担高
- C 不解决用户诉求（interval 不是 daily 多时间的等价）
- A 是数据模型清洁化（dailyTime → dailyTimes 是自然演化）

**关键约束**：

- **R-155-3（必修 / arch-reviewer Opus 红线）KV 3 路径向后兼容**：`deserializeAutoCrawlConfig` 必须容忍 3 种历史值。伪代码：
  ```ts
  function parseDailyTimes(raw: string | undefined): string[] {
    if (!raw || raw.trim() === '') return ['03:00']  // 兜底默认
    // 路径 1：尝试 JSON.parse
    try {
      const parsed = JSON.parse(raw)
      // 路径 1a：JSON 数组（新格式）→ 校验每项 HH:MM
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((x): x is string => typeof x === 'string' && /^\d{2}:\d{2}$/.test(x))
        return valid.length > 0 ? valid : ['03:00']
      }
      // 路径 1b：JSON 但 typeof === 'string'（旧值被双引号包裹）→ [parsed]
      if (typeof parsed === 'string' && /^\d{2}:\d{2}$/.test(parsed)) {
        return [parsed]
      }
    } catch {
      // 路径 2：非 JSON 但单 HH:MM 字符串（最老的历史值）→ [raw]
      if (/^\d{2}:\d{2}$/.test(raw.trim())) return [raw.trim()]
    }
    return ['03:00']  // 兜底
  }
  ```
- **R-155-6（必修 / arch-reviewer Opus 红线）zod schema 兼容旧 schema POST**：后端 `POST /admin/crawler/auto-config` zod 必须接受**旧 `dailyTime: string`**（preprocess 自动转 `[dailyTime]`）+ **新 `dailyTimes: string[]`**。版本周期内兼容，否则后端先部署、前端仍发旧 schema 会触发 P0。schema 落点：
  ```ts
  const AutoCrawlConfigSchema = z.preprocess(
    (raw) => {
      if (raw && typeof raw === 'object' && !('dailyTimes' in raw) && 'dailyTime' in raw) {
        const { dailyTime, ...rest } = raw as { dailyTime: string }
        return { ...rest, dailyTimes: [dailyTime] }
      }
      return raw
    },
    z.object({
      ...
      dailyTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).min(1).max(24),
      ...
    })
  )
  ```
- **R-155-2'（沿用 ADR §3）防重维度升级**：`auto_crawl_last_trigger_date` 是天级，多 dailyTime 时同一天的 3am + 4am 触发后会互相阻塞。改用 `auto_crawl_last_trigger_marks JSONB`（`{"2026-05-26 03:00": "iso ts", "2026-05-26 04:00": "iso ts"}`）允许同日不同时间各触发一次，相同 dailyTime 同日防重保持。
- **Y-155-2 marks JSONB GC**：scheduler tick 内顺手清理 `marks` 中 **7 天前** 的旧 key（轻量 O(N) 过滤后回写）。理论上每日 24 × 365 = 8760 keys 仍可接受，但无 GC 会持续累积。GC 策略：每次 daily 触发后 filter `keys < (NOW - 7d)` 并 setSetting 回写。
- **24 个上限**：避免恶意配置 1440 个时间（每分钟一次）；24 个对应"每小时一次"已超出合理使用场景。zod schema `.max(24)` 强制。
- **UI chip 列表**：SchedulerConfigDrawer dailyTime 单输入改为可加可删的 chip 列表（复用 packages/admin-ui 既有 chip-input 范式），至少 1 个。

**实施**：
- `packages/types/src/system.types.ts`：`AutoCrawlConfig.dailyTime: string` → `dailyTimes: string[]`；`SystemSettingKey` 加 `'auto_crawl_last_trigger_marks'`
- `apps/api/src/db/migrations/076_auto_crawl_daily_times_array.sql`：KV seed `auto_crawl_last_trigger_marks` = `'{}'`（JSON object）
- **Y-155-1（点名落点）`apps/api/src/db/queries/systemSettings.ts:184`** `auto_crawl_daily_time: parseDailyTime(config.dailyTime)` → 改为 `auto_crawl_daily_time: JSON.stringify(config.dailyTimes)`；新增 `parseDailyTimes` helper（按 R-155-3 伪代码实现）；deserializeAutoCrawlConfig 用 parseDailyTimes 替代 parseDailyTime；旧 parseDailyTime 保留用于 KV → dailyTimes 数组的单项校验
- `apps/api/src/workers/crawlerScheduler.ts`：`checkDaily(config, now, marks)` 改 "任一 dailyTime 匹配触发 + 检查 marks[date#HH:MM] 不存在"；`getLastTriggerMarks` 读 JSONB；`persistTriggerMark` daily 模式写 `marks[date#HH:MM] = isoTs` + GC 7 天前旧 keys
- `apps/api/src/routes/admin/crawler.ts`：zod schema 用 R-155-6 preprocess 兼容旧 schema
- `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`：dailyTime 单输入 → chip 列表（加按钮 + 每 chip 删除）
- `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`：scheduleSummary 显示多时间："每日 03:00, 04:00 · 模式 X"
- `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（D-155-5 新建）：多时间显示
- 单测矩阵（**R-155-3 测试矩阵** 必含）：
  - parseDailyTimes 3 历史值兼容：①旧单字符串 `"03:00"` → `["03:00"]`；②JSON 单字符串 `'"03:00"'` → `["03:00"]`；③JSON 数组 `'["03:00","04:00"]'` → `["03:00","04:00"]`；④空 / undefined → `["03:00"]` 兜底；⑤非法格式 → `["03:00"]` 兜底
  - zod preprocess 兼容旧 schema POST `{dailyTime: "03:00"}` → 内部转 `{dailyTimes: ["03:00"]}`
  - checkDaily 任一匹配触发 + marks 防重 + 同日不同时间各触发一次
  - marks GC 7 天前 keys 清理

**偏离规约**：本 D-N 是 ADR-154 D-154-1 §dailyTime AMENDMENT。不触发 Opus（dailyTimes 是 AutoCrawlConfig 字段变更，AutoCrawlConfig 不在 packages/admin-ui types 中）。R-155-3/6 是兼容性硬约束（前后端部署顺序无关性）。

### §4 关联 ADR AMENDMENT

| 原 ADR | 章节 / decisions.md 行号锚点 | AMENDMENT 内容 |
|--------|------------------------------|----------------|
| ADR-122 | §timeline 端点契约（line ~7271 附近 / EP-3 实施前 grep 校准） | D-155-3 三段窗 + D-155-4 limit 解锁 |
| ADR-152 | §端点契约 + N1-152-A position:fixed 路径决策（line ~13574–14007） | D-155-2 BackgroundEventBell 删除 + 合并到 notifications/tasks |
| ADR-153 | §pending clamp + range 自治（D-153-4 / D-153-3，line ~14035–14381） | D-155-3 移除 GREATEST 钳值 + JS 层 visStart/visEnd 二次 clamp + range 加 12h/24h/7d |
| ADR-154 | §D-154-1 dailyTime 单字符串（line ~14411–14416） | D-155-6 dailyTime → dailyTimes 数组 + 防重维度从 date 升级 marks JSONB |

**Y-155-4 AMENDMENT 块标准化模板**（每条 AMENDMENT 落盘到对应 ADR §结尾时使用）：

```markdown
### AMENDMENT 2026-05-26（ADR-155 §3 D-155-N）

**触发**：W3-FIX SEQ 用户走读暴露 [简述缺陷]。

**变更**：[原 ADR §章节] 决策更新为 [新决策]。

**关键修订点**：
- [改动 1]
- [改动 2]

**关联**：ADR-155 §3 D-155-N
```

**§8 验收硬约束**：4 处 AMENDMENT 引用块**必须在 EP-1A/B/C/EP-2/EP-3 任一实施卡 commit 前**落盘到对应 ADR；落盘时由实施卡同 commit 携带，避免漂移。

### §5 EP 拆分（R-155-4 必修后修订 / 按 CLAUDE.md PATCH ≤ 5 项硬约束）

**原 EP-1（15+ 文件）拆为 -A/-B/-C 三张子卡**，每卡 ≤ 5 项文件改动：

- **EP-1A（D-155-1 行内展开）**：3 文件
  - `apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView.tsx`（expandedKeys + renderExpandedRow）
  - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/RunInlinePanel.tsx`（新建）
  - `apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx`（瘦身）
  - 单测扩展（CrawlerRunsView.test + RunInlinePanel.test）
  - 估时 0.15w / 建议模型 sonnet

- **EP-1B（D-155-4 limit 解锁 + D-155-5 summary 卡）**：4 文件
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（加 limit select）
  - `apps/api/src/db/queries/crawlerTimeline.ts`（safeLimit 上限 20→50）
  - `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（新建）
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx`（嵌入 summary 卡 + AMENDMENT 落盘 ADR-122）
  - 单测扩展（CrawlerTimelineCard.test + AutoCrawlSummaryCard.test 新建）
  - 估时 0.2w / 建议模型 sonnet

- **EP-1C（D-155-6 多 dailyTime 全栈）**：5 文件 + 1 migration（拆分到 -C1/-C2 评估）
  - `packages/types/src/system.types.ts`（dailyTimes 类型 + marks SystemSettingKey）
  - `apps/api/src/db/migrations/076_auto_crawl_daily_times_array.sql`（KV seed marks）
  - `apps/api/src/db/queries/systemSettings.ts`（parseDailyTimes 3 路径兼容 + setter 行 184 改 JSON.stringify）
  - `apps/api/src/routes/admin/crawler.ts`（zod preprocess 兼容旧 schema）
  - `apps/api/src/workers/crawlerScheduler.ts`（checkDaily 任一匹配 + marks 防重 + GC）
  - `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx`（chip 列表 UI）
  - `apps/server-next/src/app/admin/_client/AutoCrawlScheduleCard.tsx`（多时间显示）
  - `apps/server-next/src/app/admin/crawler/_client/AutoCrawlSummaryCard.tsx`（D-155-5 卡多时间显示，依赖 EP-1B）
  - 单测扩展 + AMENDMENT 落盘 ADR-154
  - **改动达 5 文件 + 1 migration + 多文件 UI 修订 = 触发"PATCH ≥ 5 项 → 拆 -C1/-C2"硬约束**
  - **进一步拆分（实施前评估）**：
    - **EP-1C-1（类型契约 + 后端 KV + scheduler）**：system.types.ts + migration 076 + systemSettings.ts + crawler.ts + crawlerScheduler.ts（5 文件，含 migration）
    - **EP-1C-2（前端 UI 多时间消费）**：SchedulerConfigDrawer.tsx + AutoCrawlScheduleCard.tsx + AutoCrawlSummaryCard.tsx（3 文件 / 依赖 EP-1B + EP-1C-1）
  - 估时 -C1 0.2w + -C2 0.15w / 建议模型 sonnet

- **EP-2（D-155-2 topbar 合并）**：6 文件改 + 2 删除（双源同步影响）
  - `packages/admin-ui/src/shell/types.ts`（NotificationItem + TaskItem 扩展）
  - **`packages/types/src/admin-shell.types.ts`**（双源镜像 / R-155-1 必修）
  - `apps/server-next/src/lib/admin-shell-notifications.ts`（合并 BackgroundEventService 两源 GET）
  - `apps/server-next/src/app/admin/admin-shell-client.tsx`（删除 BackgroundEventBell 引用）
  - **删除**：`apps/server-next/src/components/admin-shell/BackgroundEventBell.tsx`
  - **删除**：`apps/server-next/src/lib/admin-shell-background-events.ts`
  - 单测扩展（admin-shell-notifications.test 加 category=background case）
  - AMENDMENT 落盘 ADR-152
  - 估时 0.3w / **强制 commit trailer `Subagents: arch-reviewer (claude-opus-4-7)`** + reviewer 显式审查双源镜像同步
  - 文件数 6 改 + 2 删 = 8 个 PATCH，**临界但可接受**（双源同步 + 删除是原子操作；强制 Opus reviewer 弥补范围）

- **EP-3（D-155-3 Gantt 三段窗 + 拖拽 pan）**：5 文件
  - `apps/api/src/db/queries/crawlerTimeline.ts`（70/30 切分 + 移除 GREATEST + JS clamp 双字段语义 R-155-2 实施）
  - `apps/api/src/routes/admin/crawler.ts`（range zod enum 加 12h/24h/7d）
  - `apps/server-next/src/lib/crawler/api.ts`（CrawlerTimelineRange 类型扩展）
  - `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx`（now-line + 拖拽 pan + 防抖 300ms + viewport buffer + 30d 封顶 + pending 虚线）
  - 单测扩展（crawlerTimeline.test + CrawlerTimelineCard.test）
  - AMENDMENT 落盘 ADR-122 + ADR-153
  - 估时 0.4w / 建议模型 sonnet
  - **依赖**：HOTFIX-A Step 2 已完成 SQL fix（commit d79769cc，已闭合）

**EP DAG**：
```
EP-1A（独立，D-155-1）─────────────────────────→ ⬜
EP-1B（独立，D-155-4 + D-155-5）───────────────→ ⬜
EP-1C-1（独立，后端契约 + scheduler）──→ EP-1C-2（依赖 EP-1B + EP-1C-1，UI 多时间）→ ⬜
EP-2（独立，含 Opus reviewer）─────────────────→ ⬜
EP-3（依赖 HOTFIX-A）─────────────────────────→ ⬜
```

**串行依赖**：EP-1C-2 必须在 EP-1B + EP-1C-1 之后；EP-3 依赖 HOTFIX-A（已完成）；其余可并行。

**EP-1C-1 与 EP-2 时序协调**：两卡均扩 SystemSettingKey 枚举（auto_crawl_last_trigger_marks / 无）但不冲突；若并行需先 git pull rebase。

### §6 测试 surface

- **单测**：
  - D-155-1（EP-1A）：CrawlerRunsView.test expandedKeys + onRowClick toggle 4 case；RunInlinePanel.test 新建 6 case；CrawlerRunDetailView.test 瘦身后保留 PageHeader case
  - D-155-2（EP-2）：admin-shell-notifications.test 加 category=background 4 case；admin-shell-client.test 验证 BackgroundEventBell 不再渲染；packages/admin-ui + packages/types 双源类型镜像一致性单测（如不存在则新建守卫）
  - D-155-3（EP-3）：crawlerTimeline.test 加 5 case（70/30 切分 + now-line + 12h/24h/7d range + R-155-2 双字段语义 durationSeconds 真实 vs startPct/widthPct 可视化 + safeLimit 50 cap）；CrawlerTimelineCard.test 加 6 case（now-line + 拖拽 pan + R-155-5 防抖 300ms + viewport buffer + 7 range 选项 + 30d 历史封顶）
  - D-155-4（EP-1B）：crawlerTimeline.test safeLimit 50 cap（合并到 D-155-3 #5）
  - D-155-5（EP-1B）：AutoCrawlSummaryCard.test 新建 5 case（disabled / countdown / scheduler-disabled / [立即关闭] 调用 / [编辑] 链接）
  - D-155-6（EP-1C）：
    - **R-155-3 测试矩阵**：parseDailyTimes 兼容 5 case
      - ①旧单字符串 `"03:00"` → `["03:00"]`
      - ②JSON 单字符串 `'"03:00"'` → `["03:00"]`
      - ③JSON 数组 `'["03:00","04:00"]'` → `["03:00","04:00"]`
      - ④空 / undefined → `["03:00"]` 兜底
      - ⑤非法格式 / JSON 数组含非 HH:MM → 过滤后兜底 `["03:00"]`
    - **R-155-6 zod preprocess 兼容旧 schema POST**：1 case `{dailyTime: "03:00"}` → 内部转 `{dailyTimes: ["03:00"]}`
    - checkDaily 任一匹配触发 + marks 防重 + 同日不同时间各触发一次 3 case
    - **Y-155-2 marks GC**：7 天前 keys 清理 1 case
    - SchedulerConfigDrawer.test chip 列表 UI 加/删 / 至少 1 个 / 最多 24 个 3 case
- **e2e smoke**（推迟到 EP-1A/B/C/EP-2/EP-3 完成后）：
  - /admin/crawler/runs 行内展开 + tasks 子表 [查看] logs 完整流
  - admin shell 铃铛 popover 含 background 来源 + 闪电图标含 active crawler_runs
  - /admin/crawler 时间轴拖拽 + range 切换 + limit 切换 + 30d 封顶提示
  - SchedulerConfigDrawer 多 dailyTime chip + 3am + 4am 同日各触发一次 + marks 防重
- **Y-155-5 ADR 合规审计**：
  - `npm run verify:adr-contracts` 通过（含 verify-endpoint-adr / verify-adr-d-numbers 自动注册 D-155-1..6 / verify-sql-schema-alignment 含新增 SystemSettingKey `auto_crawl_last_trigger_marks`）
  - **architecture.md 同步**：D-155-6 加新 SystemSettingKey 必须同步到 `docs/architecture.md`（CLAUDE.md 绝对禁止项反面义务"schema 变更不同步 docs/architecture.md"）

### §7 风险与偏离

- **D-155-2 删除 BackgroundEventBell**：现有 `/admin/system/background-events` 端点**保留**（继续作为 useAdminNotifications 第 2 个 GET 源 / Y-155-3 短期方案）；不 deprecate，待未来 ADR-156 端点合并时再处理
- **D-155-3 拖拽 pan 性能**：拖拽期间 SVG 重渲染 throttle 16ms（60fps）+ mousestop 300ms 防抖 + viewport ±0.5×range buffer 预拉 + 30d 封顶（R-155-5 必修）。性能 p95 < 50ms 兜底；实施期 EP-3 监控
- **D-155-6 KV 向后兼容**：deserialize 必须容忍 3 种历史值（R-155-3 必修：旧单字符串 / JSON 单字符串 / JSON 数组 / 非法 / 空 5 路径）；setAutoCrawlConfig 始终写 JSON 数组；zod schema preprocess 同时接受 dailyTime / dailyTimes 两种提交 schema（R-155-6 必修）；前后端部署顺序无关性
- **防重维度升级（R-155-2'）**：旧 `auto_crawl_last_trigger_date` 字段**保留向后兼容**（如有其它消费方），新 marks 字段优先；scheduler 内部 daily 模式直接消费 marks，旧 date 不再读
- **关键洞察 #1（arch-reviewer 反面教材）**：ADR-155 §背景列的 6 类设计层缺陷中 D-155-1/3/5/6 均是"用户走读即可暴露"的 UX 问题，D-155-2 是"目视即知的边界违规"。ADR-149 §7 "用户走读 ≥ 1 次硬前置" 是必须执行的工程规则；本 ADR §8 验收第 4 条把这条规则升级为本 SEQ 闭合硬约束（任一 EP 实施完成后必须 @livefree 走读 PASS）
- **关键洞察 #2（process 红线复发监测）**：W1 期间主循环刻意规避 "共享组件 API 契约强制 Opus" 约束采用 BackgroundEventBell position:fixed 旁路方案（changelog 自承 N1-152-A）。本 ADR EP-2 实施 commit trailer 必须显式列出 `Subagents: arch-reviewer (claude-opus-4-7)` + reviewer **必须显式审查 admin-ui + packages/types 双源镜像同步**（R-155-1）；缺失则 commit 须 revert
- **未来演化（ADR-156 候选）**：若 60s 双端点轮询性能瓶颈，起 ADR-156 «notifications 端点扩展» 将 BackgroundEventService 内嵌到 `/admin/notifications` + `?include=background` 参数；同步 ADR-147 端点契约 AMENDMENT；本卡不立此 ADR，等性能证据触发

### §8 验收

1. **ADR 自身**：6 个 D-N 全部 PASS（arch-reviewer Opus 评级 ≥ A−）→ ADR 标 🟢 Accepted ✅（2026-05-26 A− CONDITIONAL → 主循环消化 R/Y 后等同 A）
2. **AMENDMENT 落盘（独立 step / Y-155-4）**：§4 表格 4 处 AMENDMENT 引用块必须在对应 EP 实施卡 commit 中同步追加到原 ADR §结尾；落盘时使用 §4 标准化模板
3. **EP 拆卡到 task-queue.md**（依赖关系明确）：EP-1A / EP-1B / EP-1C-1 / EP-1C-2 / EP-2 / EP-3 共 6 张子卡
4. **EP 实施后用户走读硬前置（关键洞察 #1）**：任一 EP 完成后必须 @livefree dev server 走读 ≥ 1 次；走读发现新缺陷 → 起 ADR-156 / HOTFIX-D 子卡；SEQ 闭合前必须所有 EP 走读 PASS
5. **architecture.md 同步（Y-155-5 + CLAUDE.md 反面义务）**：EP-1C-1 实施时 D-155-6 新 SystemSettingKey `auto_crawl_last_trigger_marks` 必须同步到 `docs/architecture.md`
6. **verify:adr-contracts PASS（Y-155-5）**：每 EP commit 前必跑 `npm run verify:adr-contracts`，含 verify-endpoint-adr / verify-adr-d-numbers 自动注册 D-155-1..6 / verify-sql-schema-alignment
7. **decisions.md 纳入 git add + commit**（CLAUDE.md "docs/ 下新文档不执行 git add" 反面义务）

### §10 评审结论（2026-05-26）

**arch-reviewer Opus 1 轮独立评审**：A− CONDITIONAL → 主循环消化后等同 A

**评审报告关键数据**：
- 6 个 D-N 决策方向均正确
- 6 红线（R-155-1..6）+ 5 黄线（Y-155-1..5）+ 3 绿线（G-155-1..3）+ 4 关键洞察
- 关键问题：EP-1 严重违反 PATCH ≥ 5 项硬约束（15+ 文件，需拆 -A/-B/-C/-C1/-C2）；D-155-2 类型镜像双源同步漏改；D-155-3 移除 GREATEST 后 JS 层 widthPct 数学崩溃；D-155-6 KV 兼容 3 路径覆盖不全 + zod schema 必须 preprocess 兼容旧单字符串

**6 红线消化对照**：
- ✅ R-155-1：D-155-2 §实施列已补 `packages/types/src/admin-shell.types.ts` 双源镜像同步；EP-2 commit trailer 已声明双源审查
- ✅ R-155-2：D-155-3 §实施列已加 `rowToTimelineRow` JS 层双字段语义（durationSeconds 真实业务值 + startPct/widthPct 可视化 clamp），伪代码已含
- ✅ R-155-3：D-155-6 §实施列已补 `parseDailyTimes` 3 路径伪代码 + §6 测试矩阵 5 case
- ✅ R-155-4：§5 EP 拆分已重写为 EP-1A / EP-1B / EP-1C-1 / EP-1C-2 / EP-2 / EP-3 共 6 张子卡，每卡 ≤ 5 项文件改动（EP-2 双源同步 6 改+2 删 临界但可接受 + 强制 Opus reviewer）
- ✅ R-155-5：D-155-3 §实施列已加拖拽防抖 300ms + viewport ±0.5×range buffer + 30d 历史封顶 + 16ms throttle
- ✅ R-155-6：D-155-6 §实施列已加 zod preprocess `z.union([...])` 兼容旧 schema POST

**5 黄线消化对照**：
- ✅ Y-155-1：systemSettings.ts:184 setter 行号已点名 + 改 JSON.stringify(config.dailyTimes)
- ✅ Y-155-2：marks JSONB GC 已纳入约束（scheduler tick 内 7 天前 keys 顺手清理）
- ✅ Y-155-3：D-155-2 路径选择已明确 "前端并发两 GET 短期方案 + ADR-156 未来演化"
- ✅ Y-155-4：§4 AMENDMENT 引用块已加具体行号锚点（line ~7271 / ~13574 / ~14035 / ~14411）+ 标准化模板
- ✅ Y-155-5：§6 + §8 已加 `npm run verify:adr-contracts` 通过 + `docs/architecture.md` 同步

**3 绿线**（可推迟到 EP 卡内决策，本 ADR 不强制）：
- G-155-1 行内展开 + 副入口冗余 → EP-1A 实施时简化为 Ctrl/Cmd 点击新窗口
- G-155-2 7 range 选项过长 → EP-3 实施时考虑 group 短/长范围
- G-155-3 AutoCrawlSummaryCard 与 AutoCrawlScheduleCard 内容冗余 → EP-1B 实施时评估是否抽 AutoCrawlInfoBlock 共享组件

**4 关键洞察**：
- 已纳入 §7 风险章节（洞察 #1 走读硬前置 + #2 process 红线复发监测）
- 洞察 #3 AMENDMENT 落盘独立 step → §8 验收第 2 条
- 洞察 #4 拖拽性能细节移到 §7 + EP-3 实施期

**最终结论**：ADR-155 status 🟢 Accepted（2026-05-26 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 6 红线 + 5 黄线 + 4 关键洞察 → 等同 A）；EP-1A / EP-1B / EP-1C-1 / EP-1C-2 / EP-2 / EP-3 共 6 张子卡可启动；EP-2 强制 Opus arch-reviewer trailer + 双源镜像审查；每 EP 完成后 @livefree dev server 走读 ≥ 1 次为 SEQ 闭合硬前置（关键洞察 #1）。

---

## ADR-157 — 视频枚举值跨层 SSOT 协议（CHG-338 / CHG-337 调研发现）

> **Status**: 🟢 Accepted（2026-05-26 21:45 / arch-reviewer Opus A- CONDITIONAL → 主循环消化 1 红线 + 2 黄线 + 3 绿线 + 关键洞察 #3 → 等同 A）
> **触发**：CHG-337 修复"视频编辑表单 VideoType 4→11"P0 缺陷时，调研发现 12 个权威 enum 在 `packages/types/src/video.types.ts` 仅以 union 类型暴露（不可迭代），导致 12+ 处独立硬编码 + 7 处实际不匹配（详见 §2）。2026-04-22 META-10 VideoType 扩展（4→11）+ 2026-05 CHG-DESIGN-02 等多次扩展未触发联动审计，污染累积。
> **ADR 存在性**：本 ADR 是 packages/types 与 packages/admin-ui 的契约层增强 + 跨层 SSOT 协议建立 + 守卫脚本立项。**必须 arch-reviewer Opus 评审**（CLAUDE.md §"强制升 Opus 子代理"第 3 项"撰写即将成为 ADR 的决策文档"）。
> **关联**：ADR-037（admin-shell types drift）、ADR-103（DataTable API 沉淀范式）、ADR-048（前台 ALL_CATEGORIES SSOT）、ADR-149（DataTable verify:adr-contracts 集成范式 / 本 ADR 守卫脚本参考）

### §1 决策摘要

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-157-1 | packages/types enum 双形态 | 增 `export const X = [...] as const` 复数集合名（如 VIDEO_TYPES / VIDEO_GENRES / VIDEO_STATUSES，**对齐既有 SPEED_PRESETS 范式 / 无 `_VALUES` 后缀**）+ `type Singular = typeof X[number]`；删除独立 union；**API zod 层联动**（`z.enum(VIDEO_TYPES)` ≥ zod 3.22） | 核心契约 / 12 enum 一致改造 |
| D-157-2 | packages/admin-ui Option helpers | **扩展既有 `AdminSelectOption` 为泛型 `AdminSelectOption<T extends string = string>`** + 12 个 `get*Options(t?)` helper 返回 `readonly AdminSelectOption<T>[]`；接受 i18n TFunction（不另建 `EnumOption<T>` 接口） | 共享层新增 / 强制 Opus 评审 |
| D-157-3 | 前台 web-next i18n key 复用 | 现有 `messages/<locale>.json` `videoType` namespace 扩充到全 12 类；server-next i18n 接入；admin-ui helpers 使用同 key；**fallback label 删除责任：server-next 接入 next-intl 的 PR 同 commit 移除** | i18n 跨应用统一 |
| D-157-4 | grep 守卫脚本 | 新建 `scripts/verify-enum-ssot.mjs` 检测 enum 字面量硬编码；**白名单收窄**（删 `apps/api/src/routes/admin/**` 全量豁免，仅 `tests/**` + `apps/web-next/messages/**.json` + `packages/types` + `packages/admin-ui/src/enums/**` + `apps/web-next/src/lib/categories.ts`）；集成 preflight + verify:adr-contracts | 自动化防漂移 |
| D-157-5 | 实施分卡（CHG-339~344） | 6 张分卡按依赖串行，packages 改造先行；**CHG-339 PATCH 项口径**：1 enum 双形态改造（const + type 派生 + zod 引用更新）视为 1 PATCH 项 | 实施路线图 |
| D-157-6 | 不做范围 | 不引 zod 替代 union 类型（API 路由层 zod 接受 `VIDEO_TYPES` 作为枚举源）；不动 video.types.ts 外的 enum；player/search/banner 等"领域特化 enum"暂不纳入 | 收敛 |

### §2 背景与问题

**权威 enum 现状**（`packages/types/src/video.types.ts`，12 类）：

| Enum | 项数 | 实际硬编码点数 | 不匹配点数 |
|------|-----|---------------|----------|
| VideoType | 11 | **12 处独立常量** | **6 处不全 / P0/P1/P2** |
| VideoGenre | 20 | 2 处（AdminVideoForm v1 / API zod） | 1 处不全（v1 15/20 / P1） |
| VideoStatus | 2 | 多处（数量 OK / 不缺项） | 0 |
| ReviewStatus | 3 | 多处 | 0 |
| VisibilityStatus | 3 | 多处 | 0 |
| ContentFormat | 4 | 主要在 API + crawler 适配器 | 0（暂检） |
| EpisodePattern | 4 | 主要在 API + crawler | 0（暂检） |
| TrendingTag | 4 | web-next CornerTags ✓ | 0 |
| DoubanStatus | 4 | server v1 columns ✓ | 0 |
| SourceCheckStatus | 4 | server v1 ✓ | 0 |
| VideoQuality | 5 | 主要在 player + admin sources | 0（暂检） |
| SourceType | 3 | player + admin sources | 0（暂检） |

**VideoType 12 处独立常量审计（CHG-337 调研结果）**：

| 文件路径 | 行号 | 项数 | 状态 |
|---------|------|------|------|
| `apps/web-next/src/lib/categories.ts` | 17-28 | 11 ✓ | ADR-048 SSOT（前台主入口） |
| `apps/web-next/src/components/primitives/chip-type/ChipType.tsx` | 22-34 | 11 ✓ | OK |
| `apps/web-next/messages/zh-CN.json` | videoType ns | 11 ✓ | i18n 已建 |
| `apps/web-next/src/components/video/VideoMeta.tsx` | 8-20 | 11（硬编码中文） | **P2 i18n 缺失** |
| `apps/web-next/src/app/[locale]/search/_components/SearchPage.tsx` | 38-44 | **4** | **P1 不全** |
| `apps/web-next/src/components/media/FallbackCover.tsx` | 142-150 | **5** | **P2 不全** |
| `apps/web-next/src/lib/video-route.ts` (PRIMARY_DETAIL_TYPES) | 7 | **4** | **P2 不全** |
| `apps/web-next/src/app/[locale]/dev/fallback-preview/page.tsx` | 15,24 | **5** | **P3 不全** |
| `apps/server-next/src/app/admin/videos/_client/videoEnumOptions.ts` | 3 | 11 ✓ | **CHG-337 新建（server-next SSOT）** |
| `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx` | re-export | 11 ✓ | CHG-337 修 |
| `apps/server-next/src/app/admin/videos/_client/_videoEdit/TabBasicInfo.tsx` | import | 11 ✓ | CHG-337 修 |
| `apps/server-next/src/app/admin/home/_client/HomeModuleDrawer.tsx` | 57 | 11（label "电影 (movie)" 风格） | **风格漂移 / P2** |
| `apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient.tsx` | 59 | **9** | **缺 news/kids / P1** |
| `apps/server/src/components/admin/AdminVideoForm.tsx` | 343-354 | 11 ✓ | v1 OK |
| `apps/server/src/components/admin/useVideoTableColumns.tsx` (TYPE_LABELS) | 82-86 | 11 ✓ | v1 OK |
| `apps/api/src/routes/admin/videos.ts` (zod enum) | - | 11 ✓ | API 校验 OK |

**根因**：
1. **union 类型不可迭代**：`export type VideoType = 'movie' | ...` 是 TS 类型空间产物，运行时无法 `Object.values()`；每个消费方被迫复制 array。
2. **缺单一来源（SSOT）契约**：packages/types 只导出类型；packages/admin-ui 没有 Option helpers；前台 web-next 自建 `ALL_CATEGORIES`（ADR-048）作为前台 SSOT，但未跨应用推广。
3. **i18n 跨应用未统一**：web-next 有 `videoType` namespace ✓，server-next 无 i18n（裸中文）；helpers 跨包共享后才能消化此差异。
4. **缺自动化守卫**：现有 `verify:adr-contracts` 不检 enum 字面量；新人加 select 直接抄旧文件 4 项常量，污染不可见。
5. **历史扩展未联动**：2026-04-22 META-10 VideoType 4→11 时，仅扩 type + 部分关键消费方，TabBasicInfo / SearchPage / FallbackCover / SubmissionsListClient 未补；后续每次新增同样漂移。

### §3 决策详述

#### D-157-1 — packages/types enum 双形态（核心契约）

**当前形态**：
```ts
export type VideoType = 'movie' | 'series' | ... | 'other'
```

**目标形态**：
```ts
export const VIDEO_TYPES = [
  'movie', 'series', 'anime', 'variety', 'documentary',
  'short', 'sports', 'music', 'news', 'kids', 'other',
] as const
export type VideoType = typeof VIDEO_TYPES[number]
```

派生关系自动同步：
- 增删 `VIDEO_TYPES` 元素 → `VideoType` union 自动跟随
- 运行时可 `VIDEO_TYPES.map()` / `VIDEO_TYPES.includes(x)` / 派生 `Set<VideoType>`
- 消费方可 `VIDEO_TYPES.map(v => ({ value: v, label: t(\`videoType.${v}\`) }))` 自动覆盖全 11 项

**改造范围**（12 enum，按 P0/P1/P2 顺序，CHG-339 按 -A/-B/-C 子卡拆分）：

| Enum | 改造优先级 | 子卡 |
|------|----------|-----|
| VideoType / VideoGenre / VideoStatus / ReviewStatus | P0 | CHG-339-A（4 enum）|
| VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag | P1 | CHG-339-B（4 enum）|
| DoubanStatus / SourceCheckStatus / VideoQuality / SourceType | P2 | CHG-339-C（4 enum）|

**辅助类型守卫**（项目内无既存 / 评审 grep 确认）：
```ts
// packages/types/src/utils/exhaustive.ts（新建工具子目录）
export function assertExhaustive(value: never): never {
  throw new Error(`Unexpected enum value: ${JSON.stringify(value)}`)
}
```
在 switch 默认分支调用，TS 编译期保证 enum 扩展时所有 switch 被强制更新。`packages/types/src/index.ts` re-export `export * from './utils/exhaustive'`。

**API zod 层联动（红线消化）**：
```ts
// apps/api/src/routes/admin/videos.ts
import { VIDEO_TYPES } from '@resovo/types'

const querySchema = z.object({
  type: z.enum(VIDEO_TYPES).optional(),  // zod ≥ 3.22 支持 readonly array
  // ...
})
```
现有 `z.enum(['movie', 'series', ...] as const)` 散落 6+ 处（videos.ts / staging.ts / moderation.ts）改为 `z.enum(VIDEO_TYPES)` 等；API 与 packages/types 派生关系自动同步，META 类扩展后 API 校验自动跟随。CHG-339 范围覆盖。

#### D-157-2 — packages/admin-ui Option helpers（共享层 / 强制 Opus 评审）

**先扩展既有 `AdminSelectOption`**（黄线消化 / 实证位置 `packages/admin-ui/src/components/admin-select/admin-select.tsx:33` / 当前 16 文件消费）：

```ts
// packages/admin-ui/src/components/admin-select/admin-select.tsx
export interface AdminSelectOption<T extends string = string> {
  readonly value: T
  readonly label: React.ReactNode
  readonly disabled?: boolean
}
```
默认泛型参数 `T = string` 保证 16 个现有消费方零 break；新代码可显式带 `<VideoType>` 等收紧类型。

**新增 `packages/admin-ui/src/enums/` 目录**：

```ts
// packages/admin-ui/src/enums/videoTypeOptions.ts
import { VIDEO_TYPES, type VideoType } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'

export type TFunction = (key: string) => string

const VIDEO_TYPE_FALLBACK_LABEL: Record<VideoType, string> = {
  movie: '电影', series: '剧集', anime: '动漫', variety: '综艺',
  documentary: '纪录片', short: '短片', sports: '体育', music: '音乐',
  news: '新闻', kids: '少儿', other: '其他',
}

export function getVideoTypeOptions(t?: TFunction): readonly AdminSelectOption<VideoType>[] {
  return VIDEO_TYPES.map((v) => ({
    value: v,
    label: t ? t(`videoType.${v}`) : VIDEO_TYPE_FALLBACK_LABEL[v],
  }))
}
```

类型签名零摩擦：HomeModuleDrawer / SubmissionsListClient / TabBasicInfo / VideoFilterFields 切到 `getVideoTypeOptions()` 时直接喂给 `AdminSelect`，无需中间转换。

**fallback label**：硬编码中文兜底，给 server-next 在 i18n 未接入前消费；接入 i18n 后调用方传 `t` 即可切语言。

**12 个 helper**：getVideoTypeOptions / getVideoGenreOptions / getVideoStatusOptions / getReviewStatusOptions / getVisibilityStatusOptions / getContentFormatOptions / getEpisodePatternOptions / getTrendingTagOptions / getDoubanStatusOptions / getSourceCheckStatusOptions / getVideoQualityOptions / getSourceTypeOptions

**导出**：`packages/admin-ui/src/index.ts` 增 `export * from './enums'`

**强制 Opus 评审触发**：packages/admin-ui 公开 Props/helpers 新增 → CLAUDE.md §"共享组件 API 契约强制 Opus"硬约束。CHG-340 commit trailer 必含 `Subagents: arch-reviewer (claude-opus-...)`。

#### D-157-3 — i18n key 跨应用统一

**复用 web-next 已建 namespace**：
- `apps/web-next/messages/zh-CN.json` → `videoType: { movie: "电影", ... }` ✓
- `apps/web-next/messages/en.json` → 待扩
- `apps/web-next/messages/ja.json`（如有）→ 待扩

**server-next i18n 接入**：当前 server-next 无 i18n（裸中文）；CHG-340 实施时同步评估是否引入 next-intl 接入；不引入时使用 helpers fallback label（不阻塞）。

**admin-ui helpers TFunction 签名**：`(key: string) => string`，与 next-intl 的 `useTranslations` 返回值兼容；与 react-i18next `t` 兼容；不绑死任何 i18n 库。

#### D-157-4 — grep 守卫脚本（automated guard）

新建 `scripts/verify-enum-ssot.mjs`：

**检测模式**（per enum）：
- `['movie', 'series', ...]`（数组字面量含 ≥ 2 个 VideoType 值）
- `{ value: 'movie' }`、`value: 'movie' as VideoType`
- `switch (...) { case 'movie': ... case 'series': ... }`（≥ 2 case 含 VideoType 值）

**白名单收紧版**（红线消化 / 删除 `apps/api/src/routes/admin/**` 全量豁免）：
- `packages/types/src/video.types.ts`（权威源）
- `packages/admin-ui/src/enums/**`（helpers）
- `apps/web-next/src/lib/categories.ts`（ADR-048 前台主入口）
- `apps/web-next/messages/**.json`（i18n 翻译值，非代码字面量）
- 测试文件 `tests/**`（fixture 必要）

**API 层非白名单**：API 路由必须用 `z.enum(VIDEO_TYPES)`（从 `@resovo/types` import）派生，不得 inline `z.enum(['movie', ...])`。CHG-339 完成后 API 全 enum 改造，CHG-344 守卫脚本运行时 API 路径自动违规判定 0。

**输出**：违规清单 + 文件:行号 + 建议（"请改用 `import { VIDEO_TYPES } from '@resovo/types'` 派生"）

**集成点**：
- `scripts/preflight.sh` 加为 step 7（advisory）
- `package.json` 增 `npm run verify:enum-ssot`
- `npm run verify:adr-contracts` 串联调用（与 verify-style-shorthand-conflict 同级）
- milestone 阶段审计时升级为阻塞模式

**baseline 例外**：实施期允许 known violations 列表（`scripts/enum-ssot-baseline.json`），CHG-341/342/343 逐步消化清空。

#### D-157-5 — 实施分卡（CHG-339 ~ CHG-344）

**PATCH 项计数口径明确**（关键洞察 #3 消化 / PATCH ≤ 5 项硬约束适配）：
- **1 enum 的「双形态改造 + zod 引用更新 + 关键消费方校验」视为 1 PATCH 项**（修 video.types.ts 单段 + 全项目 grep 该 enum 引用做合规校验视为同一原子操作）
- assertExhaustive 工具单独 1 项
- assertExhaustive 与 CHG-339-A 同卡（CHG-339-A 计 4 enum + 1 工具 = 5 项 ≤ 5 ✅）

执行顺序 DAG：
```
CHG-339（packages/types 12 enum 双形态 + assertExhaustive 工具）
  ├→ CHG-339-A（P0 4 enum + assertExhaustive：VideoType / VideoGenre / VideoStatus / ReviewStatus + utils/exhaustive.ts）
  │   → 5 项（4 + 1）✅
  ├→ CHG-339-B（P1 4 enum：VisibilityStatus / ContentFormat / EpisodePattern / TrendingTag）
  │   → 4 项 ✅
  └→ CHG-339-C（P2 4 enum：DoubanStatus / SourceCheckStatus / VideoQuality / SourceType）
      → 4 项 ✅

CHG-339-A ✅
  └→ CHG-340（packages/admin-ui AdminSelectOption 泛型扩展 + 12 个 Option helpers / 强制 Opus arch-reviewer trailer）
       → 13 项 → 拆 CHG-340-A（泛型扩展 + 4 P0 helpers = 5 项 ✅）+ CHG-340-B（4 P1 helpers = 4 项 ✅）+ CHG-340-C（4 P2 helpers = 4 项 ✅）
       ├→ CHG-341（server-next 4 处独立常量替换 + SubmissionsListClient news/kids 修复 + 统一 label 风格）
       │   → 4 项（HomeModuleDrawer / SubmissionsListClient / TabBasicInfo+VideoFilterFields 视为 1 项收口 / label 风格统一）✅
       ├→ CHG-342（web-next P1/P2 修复：SearchPage tab + FallbackCover icon + VideoMeta i18n + video-route 评估）
       │   → 4 项 ✅
       ├→ CHG-343（apps/server v1 AdminVideoForm Genre 15→20 / v1 维护期 P1 修 / **同卡说明"v1 维护期 bug 修复豁免重写期约束 ADR-035"**）
       │   → 1 项 ✅
       └→ CHG-344（scripts/verify-enum-ssot.mjs + preflight + verify:adr-contracts 集成 + baseline 清单）
           → 4 项 ✅
```

CHG-341/342/343/344 互不依赖（可并行）；总实施估时 0.7-1.0w。

详细任务卡由本 ADR PASS 后落入 task-queue.md 新序列 SEQ-20260527-ENUMS-SSOT-IMPL。

#### D-157-6 — 不做范围（明确排除）

- ❌ 不引 zod 替代 union（保持 type-level enum 轻量；zod 已用于 API 路由层）
- ❌ 不动 video.types.ts 之外的 enum（player / search / banner / dashboard / system 等领域特化 enum 暂保留独立形态）
- ❌ 不强制后台所有 enum 立即 i18n（仅 12 类视频 enum 先行）
- ❌ 不动 apps/web-next 已正确实现的 ALL_CATEGORIES（ADR-048）—— 反而是 categories.ts 应作为前台 SSOT 与 packages/admin-ui helpers 并列
- ❌ 不在 v1 server 引入新依赖 / 共享层（v1 维护期约束）

### §4 关联 ADR

- ADR-037（admin-shell types drift 守卫）— 本 ADR 是其"enum drift"扩展（同类守卫机制）
- ADR-048（前台 ALL_CATEGORIES SSOT）— 本 ADR 是其"跨应用 SSOT"演化；不替代，并存
- ADR-103（DataTable API 沉淀范式）— 本 ADR 沿用其"共享层 Props 强制 Opus 评审"协议
- ADR-149（DataTable verify:adr-contracts 集成）— 本 ADR 守卫脚本沿用其集成范式

### §5 风险与回滚

| 风险 | 影响 | 缓解 |
|------|------|------|
| `VIDEO_TYPES` `as const` 数组顺序成隐式契约 | 调换顺序可能改变 UI 选项排序 | 排序由 helpers 显式控制；as const 数组只是项集合，顺序不进入类型 |
| 12 enum 一次性改造 PATCH > 5 项 | 完成度反比 | CHG-339 拆 -A（4 enum P0）+ -B（4 enum P1）+ -C（4 enum P2）三子卡 |
| helpers TFunction 与 next-intl API 不完全兼容 | 部分 i18n 库无法直接传 | 签名设最小公共子集；不兼容时使用 fallback |
| 守卫脚本误报 fixture / 测试断言中的字面量 | CI 噪音 | tests/** 在白名单；fixture 中长字面量数组（≥ 2 值）也豁免 |
| baseline 例外列表长期未消化 | "技术债形式化"风险 | 设清零截止日（CHG-344 完成 + **2 月**）+ **每月评审 1 次**；逾期升 **P1 跟进卡**（非 BLOCKER / 参考 ADR-149 / ADR-155 N1-EP2 多次延期经验，避免一刀切 BLOCKER 阻塞 milestone）|

**回滚**：每张 CHG 独立 commit；packages/types 与 admin-ui 改动通过 `as const` 派生 + helpers 不破坏 union 类型本身（向后兼容）；如发现问题 git revert 单 commit 即可，不影响其他 enum。

### §6 验收清单

1. **packages/types**：12 enum 全部双形态（复数集合名）+ `assertExhaustive` 守卫位于 `packages/types/src/utils/exhaustive.ts` + 通过 typecheck
2. **packages/admin-ui**：`AdminSelectOption<T extends string = string>` 泛型扩展 + 12 个 `getXxxOptions` helper + 通过 typecheck + arch-reviewer Opus 评审 PASS
3. **server-next**：4 处独立常量替换 + SubmissionsListClient news/kids 补齐 + 4018+ unit test PASS
4. **web-next**：SearchPage tab 11 项 + FallbackCover icon 11 项 + VideoMeta i18n + e2e PASS
5. **scripts/verify-enum-ssot.mjs**：全项目违规清单为 [] 或 baseline 例外（明示）；preflight + verify:adr-contracts 集成
6. **API 层 zod 字面量为空（红线消化验收）**：`grep -rnE "z\.enum\(\[\s*'(movie\|series\|anime)" apps/api` 输出空（CHG-339 完成后立即验证）
7. **每张 CHG**：独立 commit + Executed-By-Model + Subagents（admin-ui 卡强制 arch-reviewer Opus）trailer + changelog 条目
8. **ADR-048 AMENDMENT 落盘验证**：CHG-342 实施同 commit 在 ADR-048 末尾追加 `**AMENDMENT 2026-XX-XX**` 块明确"前台 SSOT 与 packages/admin-ui helpers 并存，无替代关系"+ `verify:adr-contracts` 通过

### §7 arch-reviewer Opus 评审消化对照（2026-05-26 21:45）

**评审结论**：A- CONDITIONAL（1 红线 + 2 黄线 + 3 绿线 + 关键洞察 #3 / agentId: ab9d05b03359abb45）

**1 红线消化对照**：
- ✅ R-157-1：API 层 zod 联动缺失 → §3 D-157-1 增 "API zod 层联动" 块（z.enum(VIDEO_TYPES) 替代 inline 字面量）；§3 D-157-4 白名单删除 `apps/api/src/routes/admin/**` 全量豁免；§6 增验收 grep 第 6 条

**2 黄线消化对照**：
- ✅ Y-157-1：命名风格 `X_VALUES` → 统一为 `VIDEO_TYPES` 复数集合名（对齐 packages/types/src/player.types.ts:64 SPEED_PRESETS 既有先例）；§1 决策表 + §3 D-157-1 代码示例全部对齐
- ✅ Y-157-2：`EnumOption<T>` 与 `AdminSelectOption` 重复 → 删除新建 EnumOption 接口；改为 "扩展既有 AdminSelectOption 为泛型 `AdminSelectOption<T extends string = string>`"（默认 T=string 保证 16 个现有消费方零 break）；helpers 返回 `readonly AdminSelectOption<VideoType>[]`

**3 绿线消化对照**：
- ✅ G-157-1：assertExhaustive 归属路径 → §3 D-157-1 明示 `packages/types/src/utils/exhaustive.ts`（新建工具子目录）+ index.ts re-export
- ✅ G-157-2：baseline 清零截止期 → §5 风险表改 "CHG-344 完成 + 1 月" → "**+ 2 月 + 每月评审 1 次 / 逾期升 P1（非 BLOCKER）**"
- ✅ G-157-3：i18n fallback 删除责任 → §1 决策表 D-157-3 + §3 D-157-3 明示 "server-next 接入 next-intl 的 PR 同 commit 移除 fallback"

**关键洞察消化**：
- ✅ #3：CHG-339-A 9 项 > 5 项问题 → §3 D-157-5 增 "PATCH 项计数口径明确" 块（1 enum 双形态 + zod 引用更新 + 关键消费方校验视为 1 PATCH 项）；CHG-339-A 重算 4 enum + 1 工具 = 5 项 ≤ 5 ✅；CHG-340 进一步拆 -A/-B/-C 三子卡确保每卡 ≤ 5

**绿线 #1 / #2 / #3 = 3 项全部纳入正文**（不推迟）。

**最终结论**：ADR-157 status 🟢 Accepted（2026-05-26 21:45 / arch-reviewer Opus A- CONDITIONAL → 主循环消化 1 红线 + 2 黄线 + 3 绿线 + 关键洞察 #3 → 等同 A）；CHG-339-A / 339-B / 339-C / 340-A / 340-B / 340-C / 341 / 342 / 343 / 344 共 10 张子卡可在下一个序列 `SEQ-20260527-ENUMS-SSOT-IMPL` 中立卡启动；CHG-340 系列强制 Opus arch-reviewer trailer；CHG-344 完成 + 2 月为 baseline 例外清零截止。

---

## ADR-158 — admin 单源 inline probe + render-check 端点协议（CHG-351-A / Wave 1 #7-A）

- **日期**：2026-05-27
- **状态**：🟢 Accepted（arch-reviewer Opus A-CONDITIONAL 1 轮评审 → 主循环消化 3 红线 + 3 黄线 + 4 关键洞察 → 等同 A）
- **决策者**：主循环 `claude-opus-4-7` + arch-reviewer (`claude-opus-4-7`) 子代理 1 轮独立评审
- **关联**：ADR-100 §4.5 R7 MUST-8（admin route ADR 前置）/ ADR-110（错误码 14 码 / 零新增）/ ADR-117（sources-matrix 主 ADR）/ ADR-117 AMENDMENT 2（行级 3 mutations 同类先例 / `sources.route_action` 合并 actionType 范式）/ ADR-121（R-MID-1 audit RETRO 7 文件框架 / D-121-3 PATCH ≤ 5 豁免依据 / D-121-5 复用 actionType 模式）
- **对应交付**：CHG-351-A（本卡）；下游 CHG-351-B（packages/admin-ui LinesPanel Props 扩展 / 强制 arch-reviewer trailer）+ CHG-351-C（server-next 消费方）
- **触发**：CHG-351 PROBE-RENDER-INLINE（plan §10.5 LinesPanel 单 episode 行 inline 探/播按钮）触发 plan §16.5 BLOCKER 条件（新 ADR + admin-ui 公开 Props + PATCH > 5 项硬约束），用户选方案 A 拆 -A/-B/-C 三张子卡独立调度。本 ADR 服务 -A 后端 + ADR 阶段。

### §1 决策摘要

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-158-1 | 端点路径范式 | `POST /admin/sources/:id/probe` + `POST /admin/sources/:id/render-check`；`:id` 为 `video_sources.id` uuid；与既有 line-level `/admin/sources/routes/by-site/:siteKey/:sourceName/reprobe` 命名空间互补（line 操作 vs 单源 inline 操作） | 核心契约 |
| D-158-2 | actionType 命名 | **`video_source.inline_action`**（与既有 `video_source.toggle` / `.disable_dead_batch` 单源域前缀对齐）；合并 actionType 模式（D-121-5 / ADR-117 AMENDMENT 2 范式）+ `afterJsonb.action` 区分 `'probe'` / `'render_check'`；评审 R1 拒绝原草案 `sources.single_action`（"single" 是实施细节非业务语义） | audit 契约 / R1 |
| D-158-3 | zod 路径校验 | `z.string().uuid()`（与既有 `video-groups/:videoId/matrix` 一致 / 非 uuid 路径 → 422 前置校验）；评审 R2 拒绝原草案 `.min(1)`（会让非 uuid 路径走 SQL 后落 500 INTERNAL_ERROR / 体验破碎） | 契约 / R2 |
| D-158-4 | targetKind | 复用既有 **`'video_source'`**（TARGET_KINDS 数组已存在 / 零扩展 / 零 migration） | audit 契约 |
| D-158-5 | freeze 守卫边界 | **`/probe` 守 freeze ✅ / `/render-check` 不守 ❌**；rationale：probe 入队 source-health worker 与采集资源同源；render-check 是 player 渲染检测，freeze 期间 diagnostic 价值高（评审 Y1） | 状态职责 / Y1 |
| D-158-6 | 占位 jobId 前缀 | `probe-vs-${sourceId}-${Date.now()}` + `render-vs-${sourceId}-${Date.now()}`（`vs` = video_source 命名空间，与 row 7-9 `probe-${siteKey}-` 彻底分离）；评审 Y3 防 jobId 前缀冲突 | 实施细节 / Y3 |
| D-158-7 | error path audit | 404 / 409 / 422 / 500 全部**不写 audit**（与 ADR-121 D-121-4 一致 / 评审 Y2 显式声明 + 测试覆盖） | 合规 / Y2 |
| D-158-8 | actionType 边界 | `video_source.inline_action` 仅覆盖**纯诊断 / 不写 video_sources 状态**的单源操作（probe / render-check / 未来 quick-test / warm-cache）；状态写操作（disable / activate）**走既有 `video_source.toggle`**（评审 I1） | 扩展性 |
| D-158-9 | 文件范围 / PATCH 豁免 | **9 文件**（RETRO 7 + decisions.md 单文件追加 + SourcesMatrixService.ts）；援引 ADR-121 D-121-3 RETRO 7 文件豁免 + 2 额外文件（decisions.md 章节追加 / service 物理实现 = RETRO 框架行 5 的实施位置） | 合规 / R3 |

### §2 背景与问题

**LinesPanel 单 episode 行 inline 按钮需求（plan §10.5）**：内容审核台 ModerationConsole 中部 PendingPaneController 三栏布局，右侧 LinesPanel 展示选中视频的线路 × 集数矩阵。每集行需要 inline 「🔍 探」+「▶ 播」xs 按钮，让审核员**针对单源（video_sources.id）** 触发：

- **探（probe）**：异步入队 source-health worker 重新探测该单源的 HTTP 可达性 + latency + content-type
- **播（render-check）**：异步入队 player 渲染检测，验证该单源 URL 是否能被前台 player 正确加载 + 播放

**与既有 line-level reprobeRoute 的关系**：

| 维度 | line-level（ADR-117 AMENDMENT 2 / row 7-9）| 单源 inline（本 ADR）|
|------|------------------------------------|--------------|
| 路径 | `/admin/sources/routes/by-site/:siteKey/:sourceName/{test,reprobe}` | `/admin/sources/:id/{probe,render-check}` |
| 操作范围 | 同一 `(siteKey, sourceName)` 下**所有** episode | 单一 `video_sources.id`（1 行） |
| 触发场景 | 后台 sources 管理（"重新探整条线路"） | 审核台 LinesPanel inline（"探这一集"） |
| audit actionType | `sources.route_action` | `video_source.inline_action` |
| targetKind | `source_route`（行操作 / 复合键）| `video_source`（单源 / id） |
| 同步快探 | `testRoute` 有（HEAD 3s）| 暂无（D-158-1 收敛 / 全异步） |

两组端点**互补不替代**：line-level 适合批量运维操作；单源 inline 适合审核流细粒度排查。

**为何不复用 line-level**：审核台 LinesPanel 已有 `episodeId` 上下文（单源），强制审核员先反查 `(siteKey, sourceName)` 再调 line-level 会触发"重探全 episode"副作用 — 与"探这一集"用户意图不符。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|------|------|------|---------|----------|------|--------|
| 1 | POST | `/admin/sources/:id/probe` | 单源全量 probe 入队（异步 / source-health worker） | Path: `id: z.string().uuid()` | 200 `{ data: { probeJobId, queued, sourceId } }` | admin | 422 / 404 NOT_FOUND（source 不存在/已软删除）/ 409 STATE_CONFLICT（freeze）/ 500 |
| 2 | POST | `/admin/sources/:id/render-check` | 单源 render-check 入队（异步 / player-render-check worker / advisory A4） | Path: `id: z.string().uuid()` | 200 `{ data: { renderJobId, queued, sourceId } }` | admin | 422 / 404 NOT_FOUND / 500 |

- **鉴权**：`requireRole(['admin'])`（与 row 5 alias upsert / row 7-9 mutations 100% 对齐）
- **Path 校验**：`z.string().uuid()`（D-158-3 / R2 / 与 `video-groups/:videoId/matrix` 一致）
- **错误码**：100% 复用 ADR-110 14 码 / 零新增
- **freeze 守卫差异**（D-158-5 / Y1）：endpoint 1 守 freeze，endpoint 2 不守

### §4 类型契约

`packages/types/src/sources-matrix.types.ts` 已存在；本卡新增 2 interface（位置：service inline / 同 ADR-117 AMENDMENT 2 范式）：

```ts
export interface SingleSourceProbeResult {
  readonly probeJobId: string
  readonly queued: true
  readonly sourceId: string
}

export interface SingleSourceRenderCheckResult {
  readonly renderJobId: string
  readonly queued: true
  readonly sourceId: string
}
```

### §5 zod request schema

```ts
export const SingleSourceParamsSchema = z.object({
  id: z.string().uuid(),
}).strict()
```

### §6 audit log 协议

**新增 1 actionType / 零新 targetKind**（合并 actionType 模式 / D-121-5 + ADR-117 AMENDMENT 2 第 13 次系统化 → 第 N+1 次延续）：

| 端点 | actionType | targetKind | targetId | beforeJsonb | afterJsonb |
|------|-----------|------------|----------|-------------|------------|
| POST `/probe` | `video_source.inline_action` | `video_source` | `sourceId` (uuid) | `null` | `{ action: 'probe', probeJobId, sourceId }` |
| POST `/render-check` | `video_source.inline_action` | `video_source` | `sourceId` (uuid) | `null` | `{ action: 'render_check', renderJobId, sourceId }` |

**error path 不写 audit（D-158-7 / Y2）**：404（source 不存在）/ 409（freeze / 仅 endpoint 1）/ 422（非 uuid path）/ 500 全部**不调** `auditSvc.write()`（ADR-121 D-121-4 一致）；测试断言 negative case。

### §7 audit RETRO 7 文件框架（ADR-121 D-121-2 / R-MID-1 第 N+1 次系统化）

| # | 文件 | 角色 | 改动 |
|---|------|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | (1) Type union | `AdminAuditActionType` +1 `'video_source.inline_action'` |
| 2 | `apps/api/src/services/AuditLogService.ts` | (2) Service constant | `ACTION_TYPES` 数组 +1 |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | (3a) Service enums set-equal | `EXPECTED_ACTION_TYPES` +1 |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | (3b) Coverage set-equal + (4) REQUIRED + PAYLOAD it.each | `REQUIRED_ACTION_TYPES` + `PAYLOAD_ASSERTION_REQUIRED` 各 +1 |
| 5 | `apps/api/src/routes/admin/sources-matrix.ts` | route handlers | +2 端点 + handler + zod parse |
| 6 | `tests/unit/api/video-source-inline-action-audit.test.ts` | payload 内容断言新测试（5 case） | 新建 |
| 7 | `docs/changelog.md` | 完成备注（R-MID-1 第 N+1 次系统化） | 完成时追加 |

**4 真源原子提交**（D-158-9 / I2 / D-121-3）：文件 1-4 必须**同一 commit** 提交（set-equal 测试任一未同步 fail）。

**PATCH ≤ 5 豁免**：本 ADR 援引 ADR-121 D-121-3 RETRO 7 文件**已认证豁免依据**；额外 2 文件（decisions.md 章节追加 / SourcesMatrixService.ts 物理实现 = RETRO 框架行 5 的 service 拆分位置）属于"独立 ADR 起新豁免"范畴，本 ADR 即承担此豁免说明义务。

### §8 freeze 守卫策略（D-158-5 / Y1）

| 端点 | 守 freeze | 理由 |
|------|----------|------|
| `/probe` | ✅ | 入队 source-health worker / 与采集资源同源 / 与 `reprobeRoute` 同性质 |
| `/render-check` | ❌ | 不消采集资源 / freeze 期间 diagnostic 价值高 / player 渲染检测与采集解耦 |

实施：复用 `SourcesMatrixService.assertNotFrozen()` 私有方法（reads `crawler_global_freeze` setting → 抛 `AppError('STATE_CONFLICT', '采集已冻结，不可执行线路操作', 409)`）；`probeOne` 必查 / `renderCheckOne` 不查。

### §9 占位 jobId 策略（D-158-6 / Y3）

```ts
const probeJobId  = `probe-vs-${sourceId}-${Date.now()}`   // vs = video_source 命名空间
const renderJobId = `render-vs-${sourceId}-${Date.now()}`
```

与 row 7-9 既有 `probe-${siteKey}-${sourceName}-${Date.now()}` / `reprobe-${siteKey}-${sourceName}-${Date.now()}` 命名空间**彻底分离**（防 jobId 前缀解析冲突 / Y3）。

**advisory A2（继承 ADR-117 AMENDMENT 2 §A2）**：本卡 jobId 为占位字符串；PRE-PROBE-WORKER + PRE-RENDER-CHECK-WORKER 后续卡承担：
1. 真实 BullMQ jobId 接入 source-health / player-render-check worker
2. single-source vs route-level 双触发器统一队列消费
3. renderJobId 当前**实际不被任何 worker 消费**（与 probeJobId 走 source-health 不同 / 见 advisory A4）

### §10 错误码

100% 复用 ADR-110 14 码 / 零新增：

- 422 VALIDATION_ERROR（非 uuid path / R2）
- 404 NOT_FOUND（`video_sources.id` 不存在 / 已软删除 `deleted_at IS NOT NULL`）
- 409 STATE_CONFLICT（仅 `/probe` / freeze=true）
- 500 INTERNAL_ERROR（兜底）

### §11 评审要点决策（arch-reviewer Opus 1 轮 A-CONDITIONAL → 主循环全采纳）

- **R1**（红线）：actionType `sources.single_action` → **`video_source.inline_action`**（单源域前缀对齐 / 与 targetKind 'video_source' 自洽）→ **采纳**（D-158-2）
- **R2**（红线）：zod `.min(1)` → **`.uuid()`**（422 前置 vs 500 fallthrough / 与 video-groups/:videoId/matrix 一致）→ **采纳**（D-158-3）
- **R3**（红线）：文件范围 5 → 9（援引 D-121-3 RETRO 7 文件豁免 + 2 额外文件理由）→ **采纳**（D-158-9）
- **Y1**（黄线）：`/render-check` 不守 freeze（diagnostic 可用性优先）→ **采纳**（D-158-5）
- **Y2**（黄线）：error path 不写 audit 显式声明 + 测试覆盖 negative case → **采纳**（D-158-7 + §7 文件 6 / 5 case）
- **Y3**（黄线）：jobId 前缀冲突修订 → `probe-vs-` / `render-vs-` → **采纳**（D-158-6）
- **I1**（洞察）：`video_source.inline_action` 边界仅诊断 / 状态写走 `video_source.toggle` → **采纳**（D-158-8）
- **I2**（洞察）：4 真源原子提交 → **采纳**（§7 显式声明）
- **I3 / I4**（洞察）：基线 `audit-log-service-enums-set-equal` 4/4 + `audit-log-coverage` 109/109 全 PASS → **主循环核验确认**（评审 I3/I4 为误判 / 实际已对齐）

### §12 红线 / 黄线 / advisory

**红线（已遵守 / R1-R3 全采纳）**：
- R1：actionType `video_source.inline_action` ✅
- R2：zod `.uuid()` ✅
- R3：9 文件援引 D-121-3 豁免 ✅

**黄线（已遵守 / Y1-Y3 全采纳）**：
- Y1：`/probe` 守 freeze / `/render-check` 不守 ✅
- Y2：error path 不写 audit + 测试覆盖 ✅
- Y3：jobId 前缀 `probe-vs-` / `render-vs-` ✅

**advisory**：
- A1：未来 `POST /admin/sources/:id/quick-test`（同步 HEAD 3s）→ 复用 `video_source.inline_action` + `afterJsonb.action='quick_test'` + 加 `ok / latencyMs`（合并 actionType 模式 / D-158-8 边界内）
- A2：probeJobId / renderJobId 当前占位字符串；PRE-PROBE-WORKER + PRE-RENDER-CHECK-WORKER 后续卡对接真实 BullMQ jobId
- A3：评审 I3/I4 漂移指控经主循环核验为误判（基线测试全 PASS）；advisory 记录用于未来类似评审快速核验
- A4：`renderJobId` 当前**实际不被任何 worker 消费**（与 probeJobId 走 source-health worker 不同）；PRE-RENDER-CHECK-WORKER 后续卡 + ADR 落地真实消费方

### §13 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | actionType `video_source.inline_action` 与 `video_source.toggle` / `.disable_dead_batch` 100% 同前缀风格（R1 修订后）；端点路径 `/admin/sources/:id/{probe,render-check}` 与 row 7-9 line-level 命名空间分离清晰；jobId 前缀 `probe-vs-` / `render-vs-` 防冲突 |
| 对称性 | A | 鉴权 admin only 与 row 5/7-9 100% 对齐；zod `.uuid()` + `.strict()` 与 video-groups/:videoId/matrix 一致；audit RETRO 7 文件框架严格延续 D-121-2；error path 不写 audit 与 ADR-121 D-121-4 一致 |
| 状态职责 | A | 0 DB 写边界明确（仅 audit 写）；freeze 守卫边界明示（D-158-5）+ 表格化辩护；actionType `video_source.inline_action` 边界仅诊断（D-158-8 / I1）+ 状态写走既有 toggle 范式 |
| 扩展性 | A | 合并 actionType + afterJsonb.action 模式支持未来 quick-test / warm-cache 等纯诊断动作（A1）；状态写动作显式排除（D-158-8）防 actionType 边界膨胀；占位 jobId advisory A2 + A4 显式记录 future-work 接入路径 |

**综合**：**A**

### §14 关联

- ADR-117 §端点契约不变（既有 6 端点 + AMENDMENT 1 row 6 + AMENDMENT 2 row 7-9 全部保持）；本 ADR 端点位于不同命名空间（`/admin/sources/:id/...` vs ADR-117 `/admin/sources/{routes,video-groups,...}`）
- ADR-110 response 信封 + 14 错误码 100% 复用；零新增码
- ADR-121 R-MID-1 audit RETRO 7 文件框架严格延续（系统化第 N+1 次 / D-121-2 表格逐行对齐 / D-121-3 PATCH 豁免依据援引）
- ADR-100 §4.5 R7 MUST-8 + `verify:endpoint-adr` 守门 ✅
- migration 057 / 058a / 059 / 062 schema 完备；**无新 migration**
- **关联代码（实施落地 / CHG-351-A 范围）**：
  - `apps/api/src/routes/admin/sources-matrix.ts` 增 2 端点 + handler + `SingleSourceParamsSchema` parse
  - `apps/api/src/services/SourcesMatrixService.ts` 增 `probeOne(sourceId, actorId, requestId?)` + `renderCheckOne(sourceId, actorId, requestId?)` + 2 interface（SingleSource{Probe,RenderCheck}Result）+ 复用 `findVideoSourceById` + `assertNotFrozen`
  - `packages/types/src/admin-moderation.types.ts` `AdminAuditActionType` +1
  - `apps/api/src/services/AuditLogService.ts` `ACTION_TYPES` +1
  - `tests/unit/api/audit-log-service-enums-set-equal.test.ts` `EXPECTED_ACTION_TYPES` +1
  - `tests/unit/api/audit-log-coverage.test.ts` `REQUIRED_ACTION_TYPES` + `PAYLOAD_ASSERTION_REQUIRED` +1
  - `tests/unit/api/video-source-inline-action-audit.test.ts` 新建 5 case
- **下游卡（CHG-351-B / CHG-351-C）契约对齐**：
  - response 类型 `{ probeJobId | renderJobId, queued: true, sourceId }` 暴露给 `packages/admin-ui` LinesPanel Props `onProbeEpisode` / `onRenderCheckEpisode`（CHG-351-B）
  - server-next `apps/server-next/src/lib/moderation/api.ts` 新增 `probeOneSource(sourceId)` / `renderCheckOneSource(sourceId)` 客户端方法（CHG-351-C）
- **关联触发条件**：PRE-PROBE-WORKER（A2）/ PRE-RENDER-CHECK-WORKER（A4）

### §15 关键发现

1. **R3 触发"独立 ADR 起新豁免"机制**（ADR-121 D-121-3 后半段）：本 ADR 因同时承担 ADR 起草 + RETRO + 端点实施三合一职能，文件 9 项，是 ADR-121 D-121-3 RETRO 7 文件豁免**之外**首次援引"独立 ADR 起新豁免"机制；任务卡 7-A 原始声明 ≤ 5 项与实际 9 项严重不符，由本 ADR §1 D-158-9 显式援引豁免理由收敛。
2. **actionType 命名风格的隐式约定**（评审 R1 暴露）：既有 ACTION_TYPES 53 项的"实体域 + 动作"双段命名（`video.*` / `crawler.*` / `video_source.*` / `sources.*`）是隐式约定，本 ADR 因评审拦截才显式化（D-158-2 + D-158-8）；未来新 actionType 命名应优先复用既有实体前缀（targetKind 同源），仅当确无既有前缀时才新建。
3. **占位 jobId 前缀的命名空间设计**（评审 Y3 暴露）：占位 jobId 字符串看似"将被 worker 重写"，但**实际进入 audit log + 前端轮询接口**，前缀冲突风险真实存在；本 ADR 引入 `vs` namespace token 防冲突，未来类似占位 jobId 应继承此 token-based 命名空间设计。

**最终结论**：ADR-158 status 🟢 Accepted（2026-05-27 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 3 红线 + 3 黄线 + 4 关键洞察 → 等同 A）；CHG-351-A 9 文件原子实施（4 真源原子提交 + 5 测试 case + 2 service 方法 + 2 route 端点 + 1 ADR 章节 + 1 changelog 追加）；CHG-351-B / CHG-351-C 按本 ADR 契约接续。

---

## ADR-158 AMENDMENT 2026-05-27（CHG-356）— 同步快探 + UPDATE DB（取代异步占位 jobId）

**触发**：CHG-351 三子卡（A/B/C）2026-05-27 全闭环后，用户实测发现 gap：「探测，试播后"探"，"播"两个 pill 显示无更新」。根因：ADR-158 §9 占位 jobId 模式 + advisory A2（PRE-PROBE-WORKER 后续卡）+ A4（renderJobId 实际不被任何 worker 消费）→ 后端不真实更新 `video_sources.probe_status / render_status` → 前端 SignalChip 永远显示原状态。

**范围**：**BREAKING** — 取代 §3 端点契约的响应类型 + §4 类型契约 + §6 audit log 协议 + §9 占位 jobId 策略（§9 标记 SUPERSEDED）。actionType 不变（复用 `video_source.inline_action` / arch-reviewer R1）；端点路径不变；错误码不变（ADR-110 零新增）。

**评审**：arch-reviewer (claude-opus-4-7) 1 轮 A-CONDITIONAL → 主循环消化 3 红线 + 3 黄线 + 4 关键洞察 → 等同 A。

### 端点契约（修订 ADR-158 §3）

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|------|------|------|---------|----------|------|--------|
| 1 | POST | `/admin/sources/:id/probe` | 单源同步快探 HEAD 3s + UPDATE probe_status/latency_ms/last_probed_at + 写 source_health_events | Path: `id: z.string().uuid()` | 200 `{ data: { sourceId, newProbeStatus, latencyMs, queued } }` | admin | 422 / 404 / 409 STATE_CONFLICT (freeze) / 500 |
| 2 | POST | `/admin/sources/:id/render-check` | 单源同步快探 HEAD + Content-Type 检查 + UPDATE render_status/last_rendered_at + 写 source_health_events | Path: `id: z.string().uuid()` | 200 `{ data: { sourceId, newRenderStatus, queued } }` | admin | 422 / 404 / 500 |

### 类型契约（取代 ADR-158 §4）

```ts
// 旧（已 SUPERSEDED）：
//   SingleSourceProbeResult       { probeJobId: string; queued: true; sourceId: string }
//   SingleSourceRenderCheckResult { renderJobId: string; queued: true; sourceId: string }

// 新（CHG-356 AMENDMENT）：
export interface SingleSourceProbeResult {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null    // ok→测量值 / dead→null（I1 防中位数污染）
  readonly queued: false               // 字面值 false 反映同步语义 / 前端类型守卫便利
}
export interface SingleSourceRenderCheckResult {
  readonly sourceId: string
  readonly newRenderStatus: 'ok' | 'dead'
  readonly queued: false
}
```

### audit log 协议（取代 §6）

| 端点 | actionType（不变）| targetKind（不变）| beforeJsonb（**从 DB 读取** / R-MID-1 D-121-4）| afterJsonb |
|------|-----------|------------|-------------|------------|
| POST `/probe` | `video_source.inline_action` | `video_source` | `{ probeStatus, latencyMs }` (DB old) | `{ action: 'probe', newProbeStatus, latencyMs, sourceId }` |
| POST `/render-check` | `video_source.inline_action` | `video_source` | `{ renderStatus }` (DB old) | `{ action: 'render_check', newRenderStatus, sourceId }` |

**actionType 不分新旧**（arch-reviewer R1 否决新增 `_sync` 后缀）：复用 `video_source.inline_action`，仅 payload 字段 schema 演化；4 真源同步 +0 项（不构成 R-MID-1 第 N 次系统化）。

### 同步语义边界（取代 §9 占位 jobId 策略 / SUPERSEDED）

**§9 占位 jobId 策略已被本 AMENDMENT SUPERSEDED**。新模式：

| 项 | 实现 |
|---|---|
| probe 方法 | HEAD `source_url` 3s timeout（仿 ADR-117 AMENDMENT 2 testRoute / 与 D-117-9 Y3 上限一致）|
| render-check 方法 | HEAD + Content-Type 检查 `video/* \| application/vnd.apple.mpegurl \| application/x-mpegurl` |
| timeout / 网络错误 / 405 / 403 | 视为 `dead`（不抛 5xx）/ Y3 已知限制（部分 CDN 防盗链仅支持 GET）|
| latency_ms 失败路径 | 必为 `null`（I1 防 aggregate.ts `computeMedian(activeLatencies)` 0 值污染）|
| UPDATE 失败 | throw → audit 不写（I2 / 与 D-158-7 + ADR-121 D-121-4 一致）|
| source_health_events 写入 | **必写**（R3）/ origin=`'manual_recheck'`（probe）/ `'render_check'`（render-check）/ processed_at=NOW (I4 防 feedback worker 误捞)|

### I3 已知局限（render-check）

HEAD + Content-Type 是 **reachability** 检测的强化版，**不是 playability** 检测：
- 仅证明 manifest 文件可访问 + Content-Type 声明合法
- **不证明** m3u8 内 segment URL 真实可播
- 真正 playability 需 playwright / headless browser（独立 ADR 评估 / CLAUDE.md §绝对禁止"技术栈以外新依赖触发 BLOCKER"硬约束）/ G3 advisory

### 决策要点（AMENDMENT）

| D-N | 决策 | 选择 |
|---|---|---|
| D-158-AMD-1 | actionType 命名 | **复用 `video_source.inline_action`**（不分 `_sync` 后缀 / arch-reviewer R1）|
| D-158-AMD-2 | UPDATE 字段 | probe → `probe_status / latency_ms / last_probed_at`；render → `render_status / last_rendered_at`（不动 `last_checked` / Y B2 与 v1 toggle 职责分离）|
| D-158-AMD-3 | source_health_events 双写 | **必写**（R3 / origin 复用 `manual_recheck` + `render_check` 已存在）/ processed_at=NOW（I4 防误捞）|
| D-158-AMD-4 | 乐观锁 | **不加**（探测无并发竞争语义 / 再点一次覆盖即正确 / B4）|
| D-158-AMD-5 | timeout 处理 | `dead`（不 pending / 与 testRoute 范式一致 / A3）|
| D-158-AMD-6 | 响应升级 | **直接 BREAKING**（CHG-351-A/B/C 24h 内代码 / 无外部客户端 / E2）/ 不保留 jobId 字段 |
| D-158-AMD-7 | 公共方法抽取 | `private probeUrlHead(url, contentTypeCheck)` 辅助方法供 probeOne / renderCheckOne 复用（R2 / DRY）|
| D-158-AMD-8 | latency_ms 失败语义 | 必 NULL（I1 防中位数污染 / 与 aggregate.ts 隐式契约）|
| D-158-AMD-9 | 错误码 | 100% 复用 ADR-110 14 码 / 零新增 |

### 红线 / 黄线 / advisory

**红线（已遵守 / R1+R2+R3 全采纳）**：
- R1：actionType 复用 `video_source.inline_action` ✅
- R2：抽 `probeUrlHead` 公共方法 ✅
- R3：source_health_events 双写 ✅

**黄线（全采纳）**：
- Y1：前端 4 toast 文案 `probeOk / probeDead / renderCheckOk / renderCheckDead` ✅
- Y2：BREAKING 明示（§端点契约 + §类型契约 + §9 SUPERSEDED）✅
- Y3：HEAD 405 / 403 已知限制写入 §同步语义边界 ✅

**advisory（继承 + 修订）**：
- G1：CHG-357 批量按钮（用户已声明"先 356 后 357"）/ 复用 probeOne + renderCheckOne 单源方法（不重复 HEAD 逻辑）/ 端点 `POST /admin/videos/:videoId/sources/batch-probe` + `batch-render-check`（推荐）
- G2：PRE-PROBE-WORKER + PRE-RENDER-CHECK-WORKER 原计划"真实 BullMQ jobId 接入"工作 — AMENDMENT 落地后这两张卡范围需重新评估（同步快探已满足审核台 LinesPanel 需求）
- G3：render-check 真实"渲染验证"需要 playwright（CLAUDE.md §绝对禁止新依赖触发 BLOCKER）/ 独立 ADR 评估
- G4：批量场景 `partial` 状态（部分成功）/ 当前同步路径仅 ok/dead 二态

### 文件改动（9 项 / R-MID-1 D-121-3 + ADR-158 §1 D-158-9 援引 RETRO 豁免延续）

1. `docs/decisions.md`（本章节 AMENDMENT 追加）
2. `apps/api/src/services/SourcesMatrixService.ts`（probeOne + renderCheckOne 改造 + probeUrlHead 公共方法）
3. `apps/api/src/db/queries/video_sources.ts`（+2 helper `updateSourceHealthAfterProbe` + `updateSourceHealthAfterRenderCheck`）
4. `apps/api/src/db/queries/sourceHealthEvents.ts`（既有 insertHealthEvent 复用 / 零改动 / 零新建）
5. `tests/unit/api/video-source-inline-action-audit.test.ts`（5 case payload 断言全更新）
6. `apps/server-next/src/lib/moderation/api.ts`（响应类型 SingleSourceProbeResult / RenderCheckResult schema 修订）
7. `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（handleProbeEpisode / handleRenderCheckEpisode 接 response 后 setLines update + Y1 toast）
8. `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（4 新 toast 文案）
9. `docs/changelog.md`（CHG-356 完成备注）

**关键发现**：CHG-356 暴露了 ADR-158 原始设计的「占位 jobId + 无 worker 消费」严重 gap — **未来 ADR 起草必须显式声明"此设计是否可独立交付价值，还是依赖 advisory 工人卡兜底"**。如不能独立交付价值，应拆 -A1（前置 worker 实施）+ -A2（端点协议）/ 不应像 ADR-158 v1 那样将"占位实现"上线后等用户实测发现 gap。

**结论**：ADR-158 AMENDMENT status 🟢 Accepted（2026-05-27 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 3 红线 + 3 黄线 + 4 关键洞察 → 等同 A）；CHG-351 系列 + CHG-355 收敛于本 AMENDMENT；§9 占位 jobId 策略章节 SUPERSEDED；advisory A2/A4 撤销（同步快探已满足审核台需求 / worker 化按调度需求另起卡）。

---

## ADR-158 AMENDMENT 2 2026-05-27（CHG-357）— 视频级全线路批量诊断端点

**触发**：CHG-356 单源同步快探闭环后，用户原话「另外预期提供这两个按钮的批量操作功能，验证视频所有线路」。CHG-356 AMENDMENT §advisory G1 已显式记录"CHG-357 批量按钮"未来卡 / 本 AMENDMENT 2 兑现。

**范围**：在 ADR-158 既有 2 端点（单源 probe / render-check）+ AMENDMENT 1 同步快探协议基础上，新增 2 个 video-level batch 端点 + 新 actionType（R-MID-1 第 28 次系统化）+ admin-ui LinesPanel Props 扩展。

**评审**：arch-reviewer (claude-opus-4-7) 1 轮 A-CONDITIONAL → 主循环消化 3 红线 + 4 黄线 + 4 关键洞察 → 等同 A。

### 端点契约（追加 ADR-158 §3 row 3-4）

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|------|------|------|---------|----------|------|--------|
| 3 | POST | `/admin/videos/:videoId/sources/batch-probe` | 视频内全 active source 批量同步探测（复用 SourceProbeService.probeOneInternal / 分批 5 并发） | Path: `videoId: z.string().uuid()` | 200 `{ data: { videoId, results: [{ sourceId, newProbeStatus, latencyMs }], summary: { total, ok, dead, failed } } }` | admin | 422 / 404（视频无 active source）/ 409 STATE_CONFLICT（freeze）/ 500 |
| 4 | POST | `/admin/videos/:videoId/sources/batch-render-check` | 视频内全 active source 批量同步试播 | Path: `videoId: z.string().uuid()` | 200 `{ data: { videoId, results: [{ sourceId, newRenderStatus }], summary: { total, ok, dead, failed } } }` | admin | 422 / 404 / 500 |

- **路径范式（R1 方案 A）**：放在 `apps/api/src/routes/admin/videoSources.ts`（与 disable-dead / refetch-sources 同 video-level 批量命名空间对称），Service 仍在 `SourceProbeService`（跨文件 Route → Service 合法）
- **freeze 守卫（J）**：batch-probe 入口预先查 1 次 freeze / batch-render-check 不查（继承 D-158-5）/ freeze=true → **整体 409 不部分执行**
- **错误码**：100% 复用 ADR-110 14 码

### 类型契约

```ts
export interface BatchProbeResultItem {
  readonly sourceId: string
  readonly newProbeStatus: 'ok' | 'dead'
  readonly latencyMs: number | null    // ok→测量值 / dead→null（I1 继承）
  readonly error?: string               // 调用层异常（罕见 / D1 与 dead 区分）
}
export interface BatchProbeResult {
  readonly videoId: string
  readonly results: ReadonlyArray<BatchProbeResultItem>
  readonly summary: {
    readonly total: number
    readonly ok: number
    readonly dead: number
    readonly failed: number  // failed ≠ dead（dead 是 HEAD 失败 / failed 是基础设施失败 / D1）
  }
}
// BatchRenderCheckResult 同模式（不含 latencyMs）
```

### audit log 协议（R-MID-1 第 28 次系统化）

**新增 1 actionType / 零新 targetKind**（合并 actionType + afterJsonb.action 区分 / C2 修订版）：

| 端点 | actionType（新增）| targetKind | targetId | beforeJsonb | afterJsonb |
|------|-----------|------------|----------|-------------|------------|
| POST `/batch-probe` | `video_source.batch_inline_action` | `video`（不是 video_source / batch 对象是 video） | `videoId` (uuid) | `null`（batch video-level 无单一前态 / 数据完整性靠 source_health_events 每源 1 条兜底）| `{ action: 'batch_probe', summary, sourceIds }` |
| POST `/batch-render-check` | `video_source.batch_inline_action` | `video` | `videoId` | `null` | `{ action: 'batch_render_check', summary, sourceIds }` |

**audit 范式（A2 修订版 / C2）**：
- batch 入口写 **1 条 summary audit**（与既有 `video_source.disable_dead_batch` / `staging.batch_publish` / `crawler_task.batch_cancel` 3 范式对齐）
- 子调用 `probeOneInternal({ skipAudit: true })` 不写单源 audit（避免 N 条 audit 膨胀 / 易筛选）
- **每源仍写 source_health_events**（I3 数据完整性 / 与 R3 一致 / source-level 时间序列数据 ≠ admin-level 决策记录 / 边界清晰）

### 同步语义边界

| 项 | 实现 |
|---|---|
| 数据查询 | `listVideoSources(videoId)` 1 次（B2 / 避免 N 次 findVideoSourceById）|
| freeze 检查 | 入口 1 次（B2 / 避免 N 次 systemSettings 查询）|
| 并发控制 | `runInBatches` 分批 5 并发（F2 / 防大视频 100+ outbound HEAD 风暴 + CDN 防盗链 429 误判 / 无新依赖）|
| 子调用 | `probeOneInternal({ skipAudit: true })` / `renderCheckOneInternal({ skipAudit: true })` |
| failed 字段语义 | 调用层异常（DB UPDATE 失败 / 罕见）/ 与 `dead`（HEAD 失败业务结果）严格区分（D1）|
| 部分成功 | results 数组逐项标识 / summary 汇总 / 不整体抛错（G4 advisory：未来加 `partial` summary 状态）|

### probeOneInternal / renderCheckOneInternal 抽出（R2 / I1 file-size BLOCKER）

**触发**：arch-reviewer I1 — `apps/api/src/services/SourcesMatrixService.ts` 当前 551 行已超 500 红线，CHG-357 新增 ~80 行会推至 ~630 行触发 file-size BLOCKER。

**修订**：抽 `apps/api/src/services/SourceProbeService.ts` 新文件（392 行）承载：
- `probeUrlHead(url, contentTypeCheck)` 私有公共方法（CHG-356 R2 抽出）
- `probeOneInternal(source, actorId, opts)` / `renderCheckOneInternal(source, actorId, opts)` 接收已查 source + skipAudit + skipFreezeCheck（CHG-357 R2 修订）
- 公开 `probeOne` / `renderCheckOne`（既有 ADR-158 + AMENDMENT 1 契约）/ 内部委托 `probeOneInternal({ skipAudit: false })`
- 公开 `batchProbe` / `batchRenderCheck`（本 AMENDMENT 2 新增）

`SourcesMatrixService.probeOne / renderCheckOne` 改为 `new SourceProbeService(this.db).probeOne(...)` 委托（向后兼容 / route 层 import 路径不变 / 文件减重 551→420 行 / 解 BLOCKER）。

### admin-ui Props 扩展（CLAUDE.md "共享组件 API 契约强制 Opus" 红线）

```ts
// packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts
readonly onProbeAllSources?: () => void | Promise<void>           // toolbar 全局按钮
readonly onRenderCheckAllSources?: () => void | Promise<void>
readonly probingAllSources?: boolean                              // batch 进行中 / disable toolbar 按钮
readonly renderCheckingAllSources?: boolean
```

**命名 rationale（H）**：
- `Sources`（不是 `Episodes` / `Batch`）— 操作粒度是"视频内全 sources"（含跨多线路 × 多集 / `Episode` 在 EpisodeMini 类型中专指单集 / 命名混淆引导消费方误用）
- `All` + 对象名（`Sources`）双语义明确（"批量什么"语义）
- pending state 用 `boolean`（与既有 `probingEpisodeIds: ReadonlySet<string>` 命名区分清晰 / 单 episode 用 Set / 全局 batch 用 boolean）

**Props 位置**：toolbar callbacks 区紧跟 `onRefetch`（与 `onDisableDead` 视觉/语义对齐）。

### I4 race 防御（admin-ui useMemo）

LinesPanel 主体内 `useMemo` 计算 `effectiveProbingIds` / `effectiveRenderCheckingIds`：batch 期间合并所有 ep.id 到 set → EpisodeRow 现有 `disabled={probing || spinning}` 自动正确（inline 单源按钮 batch 期间也 disabled）/ 无需 EpisodeRow 透传 batch props（避免 props 链路爆破）。

### 决策要点（AMENDMENT 2）

| D-N | 决策 | 选择 |
|---|---|---|
| D-158-AMD-10 | 端点路径范式 | **方案 A**：`apps/api/src/routes/admin/videoSources.ts`（与 disable-dead 邻居 / video-level 批量命名空间对称）/ Service 仍在 SourceProbeService（跨文件合法）|
| D-158-AMD-11 | probeOne 复用 vs 抽 internal | **B2**：抽 `probeOneInternal` + `skipAudit` + `skipFreezeCheck` 参数（解 N 次 DB + N 条 audit 膨胀 / 联动 I1 file-size BLOCKER 修复）|
| D-158-AMD-12 | actionType 命名 | **新增 1 项 `video_source.batch_inline_action`**（拒 C1 复用 inline_action / 拒 C2 双独立 actionType / 与既有 batch 范式 disable_dead_batch / batch_publish / batch_cancel 对齐）|
| D-158-AMD-13 | targetKind | `'video'`（拒 `'video_source'` / batch 对象是 video 而非单源）|
| D-158-AMD-14 | response summary | **D1**: `{ total, ok, dead, failed }` 4 项扁平 / failed ≠ dead 严格区分 |
| D-158-AMD-15 | 并发控制 | **F2**：`Promise.all` + 分批 5 并发（runInBatches helper / 无新依赖）|
| D-158-AMD-16 | freeze 守卫 | 入口 1 次查 / 整体 409 不部分执行（J）|
| D-158-AMD-17 | SourceProbeService 抽出 | **必拆**（I1 file-size BLOCKER：SourcesMatrixService 551→420 行 / 新文件 392 行）|
| D-158-AMD-18 | admin-ui Props 命名 | `onProbeAllSources` / `onRenderCheckAllSources` + `probingAllSources` / `renderCheckingAllSources` boolean（H）|

### 红线 / 黄线 / advisory（AMENDMENT 2）

**红线（全采纳）**：
- R1：端点路径方案 A（videoSources.ts 邻居 / D-AMD-10）✅
- R2：抽 probeOneInternal + skipAudit + skipFreezeCheck（解 N 次 DB + audit 膨胀 / D-AMD-11）✅
- R3：actionType `video_source.batch_inline_action`（R-MID-1 第 28 次 / 4 真源 +1 / D-AMD-12）✅

**黄线（全采纳）**：
- Y1：`latencyMs: number | null` 明确（与单源对齐）✅
- Y2：超时 budget — 分批 5 并发 × 30 批 × 3s = 90s worst case（接近 fastify 60s timeout / advisory：未来若实测超时需加 globalTimeoutMs 守卫）⚠️ 记录
- Y3：error case audit 一致性（freeze 409 / 404 / 422 不写 audit / 与 D-158-7 一致）✅
- Y4：前端 4 toast 文案 ✅

**advisory（继承 + 新增）**：
- G1（已交付 / AMENDMENT 1 G1）：本 AMENDMENT 2 兑现
- G2 / G3 / G4（继承）
- **G5（新增）**：失败 source 列表（E2）— toast 只显示 X/Y/失败 Z / 未列具体 lineKey / 未来若用户反馈需要可起独立卡（Modal 或 actionError 多行）
- **G6（新增 / I1）**：CHG-357 文件改动后回溯校验 `SourceProbeService` 是否进一步拆（probeUrlHead → http-utils？/ batch 工具 → batch-helpers？）/ 当前 392 行健康范围 / 不强制
- **G7（新增 / I2）**：admin-ui Props 扩展无 set-equal 守卫保护（CHG-351-B 起继承问题）/ VideoEditDrawer TabLines 等其他消费方需 follow-up 卡同步消费 batch 按钮（否则功能分裂）
- **G8（新增）**：视频 source 数 > 50 普遍存在时考虑 SSE 进度推送（G2 决策被推翻条件）

### 文件改动（16 项 / 援引 ADR-121 D-121-3 RETRO 7 文件豁免 + ADR-158 §1 D-158-9 + AMENDMENT 1 + 2 多重豁免延续）

**RETRO 7 文件**（4 真源 + audit 5 文件 + audit test + changelog）：
1. `packages/types/src/admin-moderation.types.ts`（AdminAuditActionType +1）
2. `apps/api/src/services/AuditLogService.ts`（ACTION_TYPES +1）
3. `tests/unit/api/audit-log-service-enums-set-equal.test.ts`（EXPECTED +1）
4. `tests/unit/api/audit-log-coverage.test.ts`（REQUIRED + PAYLOAD +1）
5. `apps/api/src/routes/admin/videoSources.ts`（+2 端点 batch-probe / batch-render-check）
6. `tests/unit/api/video-source-batch-inline-action-audit.test.ts`（**新建** / 6 case）
7. `docs/changelog.md`

**额外 9 文件**：
8. `apps/api/src/services/SourceProbeService.ts`（**新建** / 抽 probeUrlHead + probeOneInternal + renderCheckOneInternal + batchProbe + batchRenderCheck / I1 解 BLOCKER）
9. `apps/api/src/services/SourcesMatrixService.ts`（probeOne / renderCheckOne 委托 / VIDEO_CONTENT_TYPE_RE 删除 / 551→420 行）
10. `docs/decisions.md`（本 AMENDMENT 2 章节）
11. `tests/unit/api/video-source-inline-action-audit.test.ts`（mock 主体 SourcesMatrixService → SourceProbeService 适配）
12. `packages/admin-ui/.../lines-panel.types.ts`（4 新 Props）
13. `packages/admin-ui/.../lines-panel.tsx`（toolbar 加 2 按钮 + useMemo I4 race 防御）
14. `apps/server-next/src/lib/moderation/api.ts`（4 新 type + 2 client 函数）
15. `apps/server-next/.../moderation/_client/LinesPanel.tsx`（handleProbeAllSources + handleRenderCheckAllSources + state + I4 race 防御）
16. `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（5 新文案 / 含 2 模板函数）

**结论**：ADR-158 AMENDMENT 2 status 🟢 Accepted（2026-05-27 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 3 红线 + 4 黄线 + 4 关键洞察 → 等同 A）；CHG-357 16 文件原子实施；ADR-158 advisory G1 已交付；下游 advisory G5/G6/G7/G8 跟踪未来卡。

---

## ADR-159 — 双轨信号 X/Y 聚合显示协议（CHG-360）

- **日期**：2026-05-27
- **状态**：🟢 Accepted（arch-reviewer Opus A-CONDITIONAL → 主循环消化 5 红线 + 7 黄线 + 4 关键洞察 → 等同 A）
- **决策者**：主循环 `claude-opus-4-7` + arch-reviewer (`claude-opus-4-7`) 子代理 1 轮独立评审
- **关联**：ADR-117（sources-matrix line-level 聚合范式 / aggregateSignal 复用）/ ADR-158 + AMENDMENT 1/2（probe/render-check 端点契约）/ ADR-121（R-MID-1 audit RETRO）/ ADR-157（SourceCheckStatus 真源复用）
- **对应交付**：CHG-360-A（types + 组件 / 本卡）+ CHG-360-B（aggregateXY + SQL 投影）+ CHG-360-C（消费方切换）

### §1 触发

用户原话：「探测/试播分为单个源，线路（含有至少1个播放源），视频（含有至少一条线路）。结果显"可用"，"失效"两种结果仅对单个源是准确的，对于含有多集，多条线路时，通常显示不准确，需要调整。建议对于多集将可用，失效改为下面示例："02/03"。对于线路表示3集中2集探测/试播可用，对于视频队列表示3条线路，其中2条探测/试播可用。增加黄色标记标示部分失效。」

**现状缺陷**：
- pending-queue ModListRow `<DualSignal probe={dead} render={dead}>` 显示"失效"单值
- 用户看到 3 线路中 1 失效 / 2 可用 → 后端取最差 → 显示 dead → 误以为"全部失效"
- LineRow（多 episode 聚合）+ 视频级（多线路聚合）都缺 X/Y 分子分母信息

### §2 决策摘要

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-159-1 | DualSignalAggregate 字段命名 | 复用 SourceCheckStatus 4 值（`'pending' \| 'ok' \| 'partial' \| 'all_dead'`）作为 state；禁止引入第三套同义枚举 `'all_ok'` | 核心契约 / A+R1 |
| D-159-2 | 视频聚合维度 | 按 **DISTINCT (siteKey, sourceName) 线路** count（非 source 行 count）；线路"可用"定义复用 `aggregateSignal` state ∈ {'ok','partial'} | 业务语义 / B3+C4 |
| D-159-3 | 单 source 显示 | 保持 SignalChip 单值（"可用 / 失效"）；total=1 不强行 X/Y（类型污染） | 范围收敛 / E1 |
| D-159-4 | partial 黄色阈值 | `0 < ok < total` → partial 黄色；映射 4 段（all_ok 绿 / partial 黄 / all_dead 红 / pending 灰） | UI 协议 / D1 |
| D-159-5 | 共享组件分离 | **DualSignalCount 独立组件**（拒绝 DualSignal 加 mode prop / 拒绝单组件双形态 Props） | 类型契约红线 / G2+R2 |
| D-159-6 | VideoQueueRow 兼容策略 | 双字段并行（probe/render 单值 + probeAggregate/renderAggregate 聚合）；DecisionCard 等单值消费方零破坏；FOLLOWUP 卡逐个迁移后 deprecate | BREAKING 防御 / J2+R5 |
| D-159-7 | SQL 后端分层 | SQL 仅产 `{total, ok}` 原料；`state` 派生由 Service 层（与 ADR-117 sources-matrix aggregateSignal 100% 对称） | 分层守护 / F1 |

### §3 数据契约（D-159-1）

```ts
// packages/types/src/admin-moderation.types.ts
export interface DualSignalAggregate {
  readonly total: number    // 聚合分母 Y（线路视图：episode 数；视频视图：线路数）
  readonly ok: number       // 聚合分子 X（probe/render='ok' 的元素数）
  readonly state: 'pending' | 'ok' | 'partial' | 'all_dead'  // 严格复用 SourceCheckStatus 4 值
}
```

**复用理由**（A+R1）：`SourceCheckStatus = ['pending','ok','partial','all_dead']`（`packages/types/src/video.types.ts:56`）是 DB CHECK 约束 + worker 写回 + filter 已消费的真源。`DualSignalAggregate.state` 与 `videos.source_check_status` 持久列**类型同源**，避免引入第三套同义枚举（如主循环初稿提议的 `'all_ok'` 与 `'ok'` 同义）。

### §4 视频聚合维度（D-159-2 / B3）

**video 级 X/Y**：按 **DISTINCT (source_site_key, source_name) 线路** count，**非** source 行 count。

```sql
-- 视频聚合：按 DISTINCT line count
SELECT
  COUNT(DISTINCT (vs.source_site_key, vs.source_name)) AS total,
  COUNT(DISTINCT (vs.source_site_key, vs.source_name))
    FILTER (WHERE EXISTS (
      SELECT 1 FROM video_sources vs2
      WHERE vs2.video_id = vs.video_id
        AND vs2.source_site_key IS NOT DISTINCT FROM vs.source_site_key
        AND vs2.source_name = vs.source_name
        AND vs2.probe_status = 'ok'
        AND vs2.deleted_at IS NULL
    )) AS ok
FROM video_sources vs
WHERE vs.video_id = v.id AND vs.deleted_at IS NULL
```

**rationale**：用户原话精确——"3 条线路其中 2 条"；按 source count 对 24 集 × 3 线路 = 72 行视频显示 "48/72" 无业务语义。

### §5 线路 "可用" 判定（D-159-2 子项 / C4）

**线路 "可用" = `aggregateSignal(episode probe_statuses)` state ∈ {'ok', 'partial'}**

复用 `apps/api/src/services/SourcesMatrixService.ts:153-159 aggregateSignal` 现有 3 月生产范式 — 零新业务逻辑。`partial` 算可用的依据：partial 线路 ≥ 1 集可播 → 对终端用户"该视频可看"成立。

### §6 共享组件分离（D-159-5 / G2 / 红线 R2）

**禁止**给 `DualSignal` 加 `mode: 'single' | 'aggregate'` prop（运行时 Props 类型分支 = 类型契约红线 + CLAUDE.md 共享 Props Opus 强制评审）。

**正确方案**：分离两个独立组件。

| 组件 | 数据形 | 渲染 | 使用场景 |
|------|--------|------|---------|
| `<SignalChip>` | string `DualSignalDisplayState` | "可用 / 失效 / 部分 / 待测" 单 pill | 单 source（如 LinesPanel EpisodeRow）|
| `<DualSignal>` | string × 2（probe / render） | 2 pill 单值（"探/可用" + "播/失效"）| 线路单值聚合 / 简单场景 |
| `<DualSignalCount>`（**新增 / 本 ADR**）| `DualSignalAggregate` × 2 | 2 pill X/Y（"探/02/03" + "播/03/03"）+ 颜色 | line 聚合 / video 聚合 |

3 组件按数据形/场景分离 / 既有消费方零破坏。

### §7 兼容策略（D-159-6 / J2 / 红线 R5）

```ts
// VideoQueueRow 双字段并行：
export interface VideoQueueRow {
  // ...
  /** @deprecated 待 FOLLOWUP 全消费方迁移完成后移除；使用 probeAggregate 替代 */
  readonly probe: DualSignalState
  /** @deprecated 同上 */
  readonly render: DualSignalState
  /** CHG-360 新增 X/Y 聚合 */
  readonly probeAggregate: DualSignalAggregate
  readonly renderAggregate: DualSignalAggregate
}
```

**rationale**：
1. `DecisionCard.decideTone(probe, render)` (`packages/admin-ui/.../decision-card.tsx:48`) 依赖 `DualSignalDisplayState` 单值；直接 BREAKING 会通过 DecisionCard 间接破坏 moderation + VideoEditDrawer 跨层下沉例外组件
2. 与 CHG-356 / CHG-357 BREAKING 不可类比：那两次是 audit afterJsonb 内部字段；本卡是公开类型层 BREAKING（粒度更深）
3. SQL 双产出成本极低（state 单值由 aggregate.state 直接派生 - 1 行 mapper）
4. 过渡期 ≤ 2 sprint / FOLLOWUP 卡显式定义移除时间

### §8 颜色 / 文案映射（D-159-4 / D1）

| state | 颜色 token | dot 颜色 | 文本 |
|-------|-----------|---------|------|
| 'ok' | success | `var(--state-success-fg)` | "X/Y" |
| 'partial' | warning | `var(--state-warning-fg)` | "X/Y" |
| 'all_dead' | error | `var(--state-error-fg)` | "0/Y" |
| 'pending' | muted | `var(--fg-muted)` | "—" |

数字格式 zero-pad 到与 total 同位数（最少 2 位）：`String(n).padStart(Math.max(2, String(total).length), '0')` → "02/03" / "12/15"（Y4）。

### §9 a11y 协议（Y7）

aria-label 必须显式中文语义，禁止只读数字：
- 'ok' / total=3: `"链接探测：3 项均可用"`
- 'partial' / 2/3: `"链接探测：3 项中 2 项可用"`
- 'all_dead' / 0/3: `"链接探测：3 项均失效"`
- 'pending' / 0: `"链接探测：暂无数据"`

### §10 子卡拆分（H / R3）

CHG-360 必须拆 -A/-B/-C 三子卡（PATCH ≤ 5 硬约束 / ADR-121 D-121-3 RETRO 豁免不适用 / 设计阶段非追溯）：

| 子卡 | 范围 | 文件 |
|------|------|------|
| **CHG-360-A**（本卡 / 基础）| types 扩展 + DualSignalCount 组件 + ADR-159 起草 + cell/index.ts export | 4 文件 |
| **CHG-360-B**（依赖 A）| aggregateXY helper + moderation.ts SQL 投影改 + sources-matrix.ts 同步 + staging.ts 投影 | 4 文件 |
| **CHG-360-C**（依赖 B）| ModListRow / 测试 / 视情况扩 StagingPageClient + SourceMatrixRow | 4-5 文件 |

每卡 ≤ 5 项 / 满足硬约束 / 子卡 A 落地前不得开始 B/C。

### §11 红线 / 黄线 / advisory（arch-reviewer 评审消化）

**红线（全采纳）**：
- R1 字段命名复用 SourceCheckStatus 4 值 ✅（D-159-1）
- R2 DualSignalCount 独立组件 ✅（D-159-5）
- R3 必须拆 -A/-B/-C 三子卡 ✅（§10）
- R4 起 ADR-159 + 7 D 决策点 ✅（本章节）
- R5 双字段并行 J2 ✅（D-159-6）

**黄线（全采纳）**：
- Y1 字段命名复用 SourceCheckStatus（同 R1） ✅
- Y2 SQL `json_build_object` 子查询性能 — 视频量 > 10000 时 EXPLAIN ANALYZE / advisory
- Y3 其他 6 消费方保持单值不动 — 仅 ModListRow / 用户原话明示场景切换 ✅
- Y4 X/Y 格式 zero-pad 2 位 ✅（D-159-4）
- Y5 partial 黄色与既有 `--state-warning-fg` token 一致 ✅
- Y6 `aggregateXY` 测试矩阵 ≥ 6 case ✅（CHG-360-B 测试）
- Y7 a11y aria-label 显式中文语义 ✅（§9）

**advisory（未来卡）**：
- G1：CHG-360-FOLLOWUP — DecisionCard 评估是否消费 aggregate + probe/render 单值字段 deprecate 移除
- G2：sources-matrix VideoGroupRow.probeStatus 是否升级 aggregate（同协议 / 后续卡）
- G3：videos.source_check_status 持久列与 SQL line-level 实时聚合的语义重叠观察（**查询时聚合优先 / 持久列仅用于 filter 索引**）
- G4：DualSignalCount 视觉与 SignalChip 字号 padding 对齐核查

### §12 4 维度自评

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | `DualSignalAggregate` 与既有 `DualSignalState/DisplayState` 命名空间清晰 / state 4 值复用 SourceCheckStatus 真源 |
| 对称性 | A | 与 ADR-117 sources-matrix aggregate 范式 100% 对称 / Service 派生 state / SQL 仅产原料 |
| 状态职责 | A | 单值（DualSignal）/ 聚合（DualSignalCount）/ 单源（SignalChip）三组件按数据形分离 / 数据双字段并行兼容既有消费方 |
| 扩展性 | A | DualSignalAggregate 未来可加 partial 计数（dead/pending 子分类）/ DualSignalCount 可加 latency 显示 / Service 层 aggregateXY 可被 VideoGroupRow / StagingRow 等复用 |

**综合**：**A**

### §13 关联代码（CHG-360-A 范围）

- `packages/types/src/admin-moderation.types.ts`（+DualSignalAggregate type / VideoQueueRow +probeAggregate/renderAggregate）
- `packages/admin-ui/src/components/cell/dual-signal-count.types.ts`（新建 / Props 契约）
- `packages/admin-ui/src/components/cell/dual-signal-count.tsx`（新建 / X/Y 渲染 + 颜色 + a11y）
- `packages/admin-ui/src/components/cell/index.ts`（export）

**结论**：ADR-159 status 🟢 Accepted（2026-05-27 / arch-reviewer Opus A-CONDITIONAL → 主循环消化 5 红线 + 7 黄线 + 4 关键洞察 → 等同 A）；CHG-360-A 4 文件基础落地；CHG-360-B/C 按 §10 子卡顺序接续。

---

## ADR-160 — Admin Preview 协议（未公开视频后台预览前台）（CHG-361 / Wave 2 #8）

> status: 🟢 Accepted（2026-05-27 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 3 红线 + 5 黄线 + 3 advisory + 4 关键洞察 → 等同 A）
> created: 2026-05-27
> 决策者：主循环 `claude-opus-4-7` + arch-reviewer (`claude-opus-4-7`) 子代理 1 轮独立评审
> 关联：ADR-001（直链播放）/ ADR-002（Slug + 短 ID 混合 URL）/ ADR-003（refresh_token + user_role 双 cookie / sameSite 'strict'）/ ADR-010（admin 鉴权层级 canAccessAdmin）/ ADR-039（middleware brand 识别范式）/ ADR-100 §4.5 R7 MUST-8（admin route ADR 前置 / 本 ADR 不新增 admin route，仅扩 contract 字段）/ ADR-110（错误码 14 码 / 零新增）/ ADR-121（R-MID-1 audit RETRO / D-121-4 GET 只读不写 audit）/ ADR-157（VisibilityStatus / ReviewStatus 真源复用）/ ADR-158（端点契约 9 段范式）/ ADR-159（双轨信号 X/Y 聚合 / 当前 Wave 邻居）
> 对应交付：CHG-361-A（本卡 / ADR 起草 + getVideoDetailHref 沉淀到 packages/types）/ CHG-361-B（前台 preview 实施 / web-next middleware + fetchVideoMeta + 5 detail page + watch page）/ CHG-361-C（后台按钮 + moderation pending-queue contract 扩展）

### §1 背景与问题

**plan §10.6 #8 假设错位**：Wave 2 首卡实装"管理员预览未公开视频"时，发现 plan 初稿假设 URL `/video/${v.id}` 与 web-next 实际路由架构完全错位：

| 维度 | plan §10.6 假设 | web-next 实际 |
|------|------|------|
| URL 根 | `/video/:id` | `/[locale]/{movie\|series\|tvshow\|anime\|others\|watch}/[slug]` |
| 路由分流 | 单一 | 按 `video.type` 5 类 + watch（播放器）|
| URL 标识 | `videos.id` (uuid) | slug + shortId 复合（ADR-002）|
| 工具函数 | 无 | `getVideoDetailHref({ type, slug, shortId })` 已存在（`apps/web-next/src/lib/video-route.ts`）|
| visibility 处理 | 未声明 | `findVideoByShortId` SQL 强制 `visibility_status = 'public'` AND `is_published = true`（`apps/api/src/db/queries/videos.ts:139-141`）→ 未公开视频 100% 返回 null |

**PendingCenter 按钮当前 100% 失效**：`PendingCenter.tsx:122` 硬编码 `window.open('/video/${v.id}', '_blank')` → 命中 web-next `/[locale]/[type]/page.tsx` 列表路由匹配失败 → 404。

**跨 app cookie 协议挑战**：admin session cookie（`refresh_token` HttpOnly + `user_role` 非 HttpOnly）由 apps/api 通过 `Set-Cookie: SameSite=Strict` 下发（`apps/api/src/routes/auth.ts:25-40`，**未设 domain**）。dev 模式同 host 跨 port 共享；prod 子域分离需 cookie 协议升级 → R1 OPS 前置条件。

### §2 决策摘要（D-160-1..7）

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-160-1 | 触发协议 | **query `?preview=admin` + admin cookie 双因素**（query 显式触发 / cookie 鉴权）| 安全契约 |
| D-160-2 | cookie 复用 | **复用 `refresh_token` + `user_role` cookie**；**prod 落地硬前置条件 = OPS 卡 CHG-OPS-COOKIE-SUBDOMAIN-1**（cookie domain `.resovo.tv` + SameSite Lax）| 跨 app 协议 |
| D-160-3 | middleware 接入点 | **web-next middleware 注入 `x-admin-preview: 1` header** / page.tsx + fetchVideoMeta 读 header 派发 | 分层守护 |
| D-160-4a | visibility 放行边界 | **`internal\|hidden` 放行 / `deleted_at IS NOT NULL` 永不放行 / `review_status = 'rejected'` 放行** | 业务边界 |
| D-160-4b | access_token 跨 app 传递 | **选方案 ② web-next middleware 调 apps/api `/auth/refresh` 用 refresh_token cookie 拿短 TTL access_token**（不引入 access_token 进 URL log）| 工程协议 |
| D-160-5 | 写入禁令 | **PlayerShell `previewMode` Props 屏蔽 feedback hook**（实证：当前无 view_count / watch_history / 推荐写入路径；唯一写路径是 `/v1/feedback/playback`）| 收敛精简 |
| D-160-6 | audit 协议 | **不写 audit**（ADR-121 §后果第 2 项 / D-121-4 / GET 只读不在 R-MID-1 范围 / 4 真源 +0）| 合规边界 |
| D-160-7 | URL 映射 + contract 扩展 | **moderation pending-queue 投影扩 `slug` + `shortId`**；`getVideoDetailHref` **沉淀到 `packages/types/src/url-helpers.ts`** 跨 app 复用 | contract 扩展 |

### §3 决策点详述

#### D-160-1 触发协议：双因素

`?preview=admin` query + admin/moderator cookie 鉴权。query 显式表达"管理员明确意图查看未公开"；cookie 承担身份鉴权；两者缺一 → 走 public 路径。攻击面对比：单因素 cookie 模式下 admin 浏览公开页也走 preview 路径 → cache 污染 + 误触面广。query 外泄不威胁内容安全（被分享方无 cookie → 仍 404）。

#### D-160-2 cookie 复用 + prod OPS 硬前置（R1 修订）

**采纳**：复用 `refresh_token` + `user_role` cookie / 不引入新 cookie。

**dev 同源可行**：`localhost` 在不同 port 共享所有 host=localhost 的 cookie；`SameSite=Strict` 在同 host 跨 port top-level navigation 中按 RFC 6265bis 视为同站 / Chrome / Firefox 一致。

**prod 必备条件（R1 红线 / 升级为硬前置）**：
- web-next 部署主域（`resovo.tv`）+ server-next 部署 admin 子域（`admin.resovo.tv`）
- cookie Domain attribute 显式设为 `.resovo.tv`（`apps/api/src/routes/auth.ts:25-40` 当前未设）
- `SameSite` 由 `Strict` 降为 `Lax`（Strict 禁止 cross-site top-level navigation 携带）

**prod 落地硬前置条件**：**OPS 卡 `CHG-OPS-COOKIE-SUBDOMAIN-1`** 必须先于 CHG-361 系列 prod 部署完成。ADR 起草 + dev 实施（CHG-361-A/-B/-C）不依赖此前提，可先合 main 在 dev 验证。**prod 部署 gate**：OPS 卡未完成 → CHG-361 系列不得部署 prod（feature flag `ADMIN_PREVIEW_PROD_ENABLED=false` 守门 / 实施细节在 CHG-361-B）。

**如 OPS 拒绝 cookie 协议升级 → 切方案 C（signed token）**：apps/api 新增签发端点 `POST /admin/preview-tokens` 返回 5 min TTL HMAC token / web-next middleware 接 query `?preview_token=...` 替代 cookie 鉴权 — 工程成本高出 ~2x，作为兜底而非首选。

#### D-160-3 middleware 接入点

web-next `middleware.ts` 扩 1 helper：

```ts
const HEADER_ADMIN_PREVIEW = 'x-admin-preview'

function resolveAdminPreview(req: NextRequest): boolean {
  if (req.nextUrl.searchParams.get('preview') !== 'admin') return false
  const role = parseUserRole(req.cookies.get(COOKIE_USER_ROLE)?.value)
  return role === 'admin' || role === 'moderator'
}
```

middleware → header → page.tsx / fetchVideoMeta 通过 `headers().get('x-admin-preview') === '1'` 派发数据路径。**禁止**散点 cookie 读取（与 ADR-039 brand 识别同构）。

#### D-160-4a visibility 放行边界 + cache 策略（Y1 修订）

复用 ADR-157 真源：`VISIBILITY_STATUSES = ['public', 'internal', 'hidden']` / `REVIEW_STATUSES = ['pending_review', 'approved', 'rejected']`。

| 字段 | 状态 | preview=on | preview=off |
|------|------|------|------|
| `visibility_status` | `'public'` | 显示 | 显示 |
| `visibility_status` | `'internal'` | **显示** | 404 |
| `visibility_status` | `'hidden'` | **显示** | 404 |
| `review_status` | `'pending_review'` | 显示 | 404 |
| `review_status` | `'rejected'` | **显示**（advisory：未来 FOLLOWUP 卡可收紧）| 404 |
| `is_published` | `false` | 显示 | 404 |
| `deleted_at` | `IS NOT NULL` | **永不显示** ❌（**Y2**：SQL 必须显式 `AND v.deleted_at IS NULL` + 单测 1 case 断言 soft-deleted preview=admin 仍 404）| 永不显示 |

**新增 query**：`apps/api/src/db/queries/videos.ts` 增 `findVideoByShortIdAdminPreview(shortId)` — 删除 `is_published = true` + `visibility_status = 'public'` 过滤，保留 `deleted_at IS NULL`。**禁止**修改既有 `findVideoByShortId`（向后兼容）。

**cache 策略（Y1）**：preview 路径必须 `next: { revalidate: 0 }`（当前 `fetchVideoMeta` 是 `revalidate: 60`）/ 或 cache tag 加 preview flag。否则 admin 预览的 internal 视频会被 ISR cache 60s / 期间匿名用户**可能命中** cache → visibility=public 严重泄漏。CHG-361-B 实施时必须在 fetchVideoMeta 派发 preview header 时同步切 `revalidate: 0`。

#### D-160-4b access_token 跨 app 传递（R2 修订 / 拆出独立决策点）

**问题**：preview 模式下 web-next server-side fetch 调 apps/api 需附 `Authorization: Bearer <admin_access_token>` / access_token 按 ADR-003 不在 cookie 中。

**方案对比**：
| 方案 | 描述 | 优 | 劣 |
|------|------|---|---|
| ① server-next `window.open` 时 query 透传 access_token | URL 中带 access_token=eyJ... | 实施简单 | URL log 风险 / access_token 进浏览器历史 |
| ② **（采纳）** web-next middleware 调 apps/api `/auth/refresh` 用 refresh_token cookie 拿短 TTL access_token | server-side 凭据交换 | 安全（access_token 不进 URL）/ 复用既有 refresh 端点 | 需 web-next 新增 server-side refresh 调用链（~30 行 / CHG-361-B 范围内）|

**选 ②** 理由：URL log 安全风险大于工程成本差异。

**实施细节（CHG-361-B 范围）**：
- web-next `src/lib/admin-access-token.ts`（新建 / `getAdminAccessToken()` server-side helper）
- 内部调 `POST ${API_BASE}/auth/refresh` + 透传 `refresh_token` cookie（`headers: { cookie: req.headers.cookie }`）
- 响应里拿 5 min TTL access_token（in-memory / 不持久化）
- `fetchVideoMeta(slug, { previewMode: true })` 内部调 `getAdminAccessToken()` + 附 `Authorization: Bearer ${accessToken}` header

**降级路径**：apps/api `/auth/refresh` 失败（refresh_token 过期 / 无效）→ 不放行 preview / 走 public 路径 → internal 视频 404。

#### D-160-5 写入禁令 + AdminPlayer 边界澄清（Y4 修订）

**实证审查**（grep web-next 写路径）：
- ❌ 无 `view_count` 写路径
- ❌ 无 `watch_history` 写路径
- ❌ 无前台推荐写回
- ✅ 唯一写路径：`POST /v1/feedback/playback`（仅 watch 页 player 真实渲染后触发）

**实施**：preview 模式 watch 页 PlayerShell 接 `previewMode={true}` Props → 屏蔽 `usePlaybackFeedback` hook。

**AdminPlayer vs PlayerShell{previewMode} 职责边界（Y4）**：
| 路径 | 入口 | 范围 | 是否写 audit |
|------|------|------|------|
| AdminPlayer | server-next 审核台 PendingCenter 中部 | 极简（播放/暂停/进度/集数 / 无字幕 / 无影院模式 / 无 GlobalPlayerHost）| 已存在 audit（feedback 上报）|
| PlayerShell{previewMode} | web-next watch 页（审核员通过 PendingCenter "↗ 前台" 按钮跳转）| 完整 web-next 播放器（含字幕 / 影院模式 / GlobalPlayerHost）+ 屏蔽 feedback hook | preview 模式不写 audit / D-160-6 |

两者职责**不重复**：AdminPlayer 提供"审核台 inline 快速试播"；PlayerShell{previewMode} 提供"审核员看真实前台渲染" — 后者是审核员最终交付前的"用户视角"验证步骤。未来 CHG-361-FOLLOWUP 可评估是否统一，本卡范围内并存。

**advisory A1**：未来 web-next 增 view_count / watch_history 写入 → 必须同步 preview 屏蔽列表（独立 lint rule 或文档约束）。

#### D-160-6 audit 协议

**不写 audit**。ADR-121 §后果第 2 项硬性约束："6 文件固定框架不适用纯只读端点"。preview 是 GET 纯只读 / 不修改 DB 状态 / 不构成 R-MID-1 第 N 次系统化 / 4 真源 +0 / 7 文件 RETRO 不触发。

**重启条件**：GDPR / 等保三级合规要求"管理员访问未公开视频必留痕" → 起独立 ADR-160a + R-MID-1 第 N+1 次系统化。

#### D-160-7 URL 映射 + contract 扩展 + getVideoDetailHref 沉淀

**实证**：`VideoQueueRow` 类型（`packages/types/src/admin-moderation.types.ts`）**无** `slug` / `shortId` 字段（grep 验证 ✅）；moderation.ts pending-queue SQL 投影**无** `v.slug` / `v.short_id`。

**契约扩展（非新端点 / 不触发 R7 MUST-8）**：
- `VideoQueueRow` 增 `readonly slug: string | null` + `readonly shortId: string`
- moderation.ts SQL SELECT 追加 `v.slug AS slug` + `v.short_id AS "shortId"`
- `StagingRow extends VideoQueueRow` 自动继承

**`getVideoDetailHref` 跨 app 沉淀**：沉淀到 `packages/types/src/url-helpers.ts`（与 VIDEO_TYPES 真源同包 / 纯函数 / 无 React 依赖）；web-next `src/lib/video-route.ts` 改为 re-export。**触发 CLAUDE.md §模型路由"共享组件 API 契约强制 Opus"**：本 ADR 已是 arch-reviewer Opus 评审输出 / 满足前置条件 / CHG-361-A 实施 commit 必须挂 `Subagents: arch-reviewer (claude-opus-4-7)` trailer（R3 红线）。

**advisory G1**：`apps/web-next/src/lib/rewrite-match.ts:73` `DETAIL_PREFIXES = ['/movie', '/series', '/anime', '/tvshow', '/others']` 与 helper segment 派生有重复 → 未来 FOLLOWUP 卡同沉淀。

### §4 端点契约扩展（非新端点 / verify:endpoint-adr 0 项新增）

| # | 方法 | 路径 | 变更 | zod | 错误码 | 权限 |
|---|------|------|------|-----|--------|------|
| 1 | GET | `/v1/videos/:shortId` | 增 query `preview?: 'admin'`；`preview === 'admin'` 时要求 `Authorization: Bearer <admin/moderator access_token>` preHandler；走 `findVideoByShortIdAdminPreview` 放行 internal/hidden | `preview: z.literal('admin').optional()` | 401 UNAUTHENTICATED / 403 PERMISSION_DENIED / 404 NOT_FOUND | preview=admin 时 admin/moderator only / 否则 public |
| 2 | GET | `/admin/moderation/pending-queue` | 投影 SELECT 增 `v.slug`, `v.short_id`；`VideoQueueRow` 增 `slug: string \| null` + `shortId: string` | 入参不变 | 既有 | admin/moderator（既有）|

**cache**：preview 路径 `revalidate: 0`（Y1）/ 公开路径维持 `revalidate: 60`。

**错误码**：100% 复用 ADR-110 14 码 / 零新增。

### §5 类型契约

```ts
// packages/types/src/admin-moderation.types.ts VideoQueueRow 扩
export interface VideoQueueRow {
  readonly id: string
  readonly slug: string | null   // 新增 / 与 Video.slug 同源
  readonly shortId: string        // 新增 / 与 Video.shortId 同源（NOT NULL）
  readonly title: string
  readonly type: VideoType
  // ... 既有 31 字段不变
}

// packages/types/src/url-helpers.ts（新建 / D-160-7）
import type { VideoType } from './video.types'
const URL_SEGMENT_MAP: Partial<Record<VideoType, string>> = { variety: 'tvshow' }
const PRIMARY_DETAIL_TYPES = new Set<VideoType>(['movie', 'series', 'anime', 'variety'])
export function getVideoDetailHref(video: { type: VideoType; slug: string | null; shortId: string }): string {
  const segment = PRIMARY_DETAIL_TYPES.has(video.type)
    ? (URL_SEGMENT_MAP[video.type] ?? video.type)
    : 'others'
  const slugPart = video.slug ? `${video.slug}-${video.shortId}` : video.shortId
  return `/${segment}/${slugPart}`
}

// apps/web-next/src/lib/video-route.ts：改为 re-export
export { getVideoDetailHref } from '@resovo/types'
```

**关键不新增**：actionType / targetKind / SourceCheckStatus / VisibilityStatus / VideoType。

### §6 文件范围（拆 -A / -B / -C 三子卡 / PATCH ≤ 5 硬约束）

**红线 R1**：CHG-361 范围必须拆 3 子卡，每卡 ≤ 5 文件，不援引 ADR-121 D-121-3 RETRO 7 文件豁免（本 ADR 不触发 R-MID-1 / D-160-6）。

| 子卡 | 范围 | 文件 | verify gate（Y5）|
|------|------|------|------|
| **CHG-361-A**（本卡 / ADR + helper 沉淀）| ADR-160 起草 + `getVideoDetailHref` 沉淀到 packages/types + web-next 改 re-export | 4 文件：①`docs/decisions.md` ADR-160 段 ②`packages/types/src/url-helpers.ts` 新建 ③`packages/types/src/index.ts` export ④`apps/web-next/src/lib/video-route.ts` 改 re-export | typecheck + lint 全绿 / **commit trailer 必含 `Subagents: arch-reviewer (claude-opus-4-7)`（R3）**|
| **CHG-361-B**（依赖 A / 前台 preview 实施）| middleware header 注入 + admin-access-token helper + fetchVideoMeta preview 派发 + apps/api preview query + admin query 函数 + PlayerShell previewMode + cache revalidate 0 | 5 文件：①`apps/web-next/src/middleware.ts` ②`apps/web-next/src/lib/admin-access-token.ts` 新建（D-160-4b）③`apps/web-next/src/lib/video-detail.ts` +preview 派发 + revalidate 切换（Y1）④`apps/api/src/routes/videos.ts` +`?preview=admin` query + preHandler ⑤`apps/api/src/db/queries/videos.ts` +`findVideoByShortIdAdminPreview`（Y2 SQL `deleted_at IS NULL` + 单测）+ `apps/web-next/src/components/player/PlayerShell.tsx` +`previewMode` Props | typecheck + lint + 5 case API 单测（preview happy / cookie 缺 401 / role user 403 / soft-deleted 404 / public 视频回归）|
| **CHG-361-C**（依赖 B / 后台按钮 + contract 扩展）| moderation pending-queue 投影扩 slug/shortId + VideoQueueRow 类型扩 + PendingCenter 按钮改 getVideoDetailHref + WEB_NEXT_ORIGIN env | 5 文件：①`packages/types/src/admin-moderation.types.ts` VideoQueueRow +2 字段 ②`apps/api/src/db/queries/moderation.ts` SELECT +slug/short_id ③`apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx:122` 改 getVideoDetailHref ④env 配置 `NEXT_PUBLIC_WEB_NEXT_ORIGIN` ⑤`docs/changelog.md` 完成备注 | typecheck + lint + e2e 1 case（PendingCenter 按钮点击跳 web-next preview URL）+ docs/manual/moderation-console.md 同步 |

**每卡完成度门槛**：A 落地后才能开 B（getVideoDetailHref import path 变更）/ B 落地后才能开 C（preview 端点 + admin query 函数前置）/ A 内 helper 移动必须先跑 typecheck 全绿。

### §7 风险与替代方案

| 替代方案 | 描述 | 否决理由 |
|---------|------|---------|
| iframe 嵌入 | server-next admin 页面 iframe 嵌入 web-next 预览 | iframe cookie 跨 origin / sandbox 与 player 全屏冲突 / 体验降级 |
| signed token 单因素 | apps/api 签发短 TTL JWT URL 参数 / 不依赖 cookie | 实现成本高（新签发端点 + 密钥管理 + token TTL）；双因素已满足；作为 prod 跨子域不可用时的兜底（OPS 拒绝 cookie 升级）|
| packages/site-views 抽取 | web-next detail page 抽到独立 package / server-next 内嵌 | 远超本卡范围 / 引入新 package / 改动 30+ 文件 / 与价值排序冲突 |
| dev-only / prod 不实装 | 仅 dev 环境 preview 按钮可点 | 不解决 prod 审核流需求 |

**已知风险**：
1. **R1 prod cookie 跨子域**：硬前置 OPS 卡 CHG-OPS-COOKIE-SUBDOMAIN-1 / prod 部署 gate by feature flag
2. **R2 access_token 跨 app**：选方案 ② server-side refresh 调用链 / 不进 URL log
3. **Y1 ISR 缓存污染**：preview 路径强制 `revalidate: 0`
4. **G2 prod cookie 配置升级独立 OPS 卡**：CHG-OPS-COOKIE-SUBDOMAIN-1（cookie domain `.resovo.tv` + SameSite Lax / 不在 CHG-361 范围）
5. **G3 audit 重启条件**：GDPR / 等保三级合规要求时起 ADR-160a

### §8 RETRO 框架（不适用 / D-160-6）

**不触发 R-MID-1**。理由：preview 是 GET 纯只读 / 不写 admin_audit_log / 不新增 actionType / 4 真源 +0 / ADR-121 §后果第 2 项 + D-121-4。

未来重启条件见 §3 D-160-6 末段。

### §9 结论 + 自评级

| 维度 | 评级 | 理由 |
|---|---|---|
| 命名 | A | header `x-admin-preview` 与 `x-resovo-brand/theme` 同模式；query `?preview=admin` 显式语义；不引入新枚举 |
| 对称性 | A | middleware → header → page.tsx 派发与 brand/theme 100% 同构；contract 扩展走"既有端点投影扩字段"非新端点 |
| 状态职责 | A | 零写入 / 零 audit / preview helper 单点 / 派发单点 / DB 查询单点（既有 `findVideoByShortId` 不动）|
| 扩展性 | A | preview 协议可扩 `?preview=staging/draft` 同模式；getVideoDetailHref 跨 app 沉淀；signed token 升级路径已声明（兜底）|

**综合**：**A**（arch-reviewer Opus A− CONDITIONAL → 主循环消化 3 红线 + 5 黄线 + 3 advisory + 4 关键洞察后等同 A）

### §10 关联代码（CHG-361-A 范围）

- `docs/decisions.md`（本 ADR-160 段）
- `packages/types/src/url-helpers.ts`（新建 / getVideoDetailHref 沉淀）
- `packages/types/src/index.ts`（export getVideoDetailHref）
- `apps/web-next/src/lib/video-route.ts`（改为 re-export）

### §11 D 决策点闭环

- **D-160-1**：触发协议双因素 ✅ closed
- **D-160-2**：cookie 复用 + prod OPS 硬前置（R1 修订）✅ closed
- **D-160-3**：middleware header 注入 ✅ closed
- **D-160-4a**：visibility 放行 + cache 策略（Y1 修订）✅ closed
- **D-160-4b**：access_token 跨 app 传递（R2 修订 / 选方案 ②）✅ closed
- **D-160-5**：写入禁令 + AdminPlayer 边界（Y4 修订）✅ closed
- **D-160-6**：不写 audit ✅ closed
- **D-160-7**：URL 映射 + getVideoDetailHref 沉淀（R3 修订）✅ closed

**结论**：ADR-160 status 🟢 Accepted（2026-05-27 / arch-reviewer Opus A− CONDITIONAL → 主循环消化 3 红线 + 5 黄线 + 3 advisory + 4 关键洞察 → 等同 A）；CHG-361-A 4 文件基础落地（本 ADR + helper 沉淀）；CHG-361-B/C 按 §6 子卡顺序接续；prod 部署 gate by OPS 卡 CHG-OPS-COOKIE-SUBDOMAIN-1。

## ADR-160 AMENDMENT 1 2026-05-27（CHG-361-B 实施前发现）— §6 子卡拆分细化

**触发**：CHG-361-B 实施前实证发现：分层约束（CLAUDE.md "Route → Service → DB queries"）要求 apps/api 端必含 3 文件（`routes/videos.ts` + `services/VideoService.ts` + `db/queries/videos.ts`）；加 web-next 端 3 文件（`middleware.ts` + `admin-access-token.ts` 新建 + `video-detail.ts`）= **6 文件实施 / 超 PATCH ≤ 5 硬约束**（CLAUDE.md M-SN-5 数据观察"PATCH 范围 ≥ 5 项 → 完成度反比"红线）。原 §6 子卡定义未识别 VideoService 分层包装层。

### 修订内容

将 ADR-160 §6 子卡定义中的 **CHG-361-B（5 文件）** 拆为：

| 子卡 | 阶段 | 范围 | 文件 |
|------|------|------|------|
| **CHG-361-B2**（先执行 / apps/api 后端）| API 端 preview 端点 + 分层包装 | apps/api preview query + Service 派发 + Route preview query schema + preHandler | 3 文件：①`apps/api/src/routes/videos.ts`（GET `/videos/:id` 增 `?preview=admin` query schema + admin/moderator preHandler 派发）②`apps/api/src/services/VideoService.ts`（`findByShortId(id, { preview?: boolean })` 签名扩展 + 内部派发）③`apps/api/src/db/queries/videos.ts`（新增 `findVideoByShortIdAdminPreview(shortId)` / SQL 显式 `AND v.deleted_at IS NULL`）+ 测试 1 文件 |
| **CHG-361-B1**（后执行 / web-next 前端）| web-next preview 派发链 | middleware header 注入 + admin-access-token helper + fetchVideoMeta preview 派发 + cache `revalidate: 0` | 3 文件：①`apps/web-next/src/middleware.ts`（+`resolveAdminPreview` + `x-admin-preview` header 注入）②`apps/web-next/src/lib/admin-access-token.ts` 新建（D-160-4b 方案 ② / `getAdminAccessToken()` server-side 调 `/auth/refresh`）③`apps/web-next/src/lib/video-detail.ts`（preview 派发 + `revalidate: 0` 切换）|
| **CHG-361-D**（独立 / 单 Props 极简）| watch 页 PlayerShell previewMode | 屏蔽 feedback hook | 1 文件：①`apps/web-next/src/components/player/PlayerShell.tsx`（+`previewMode` Props / 默认 false / 向后兼容）|

**执行顺序**：B2（端点先存在 / 独立可测）→ B1（消费方 / 依赖 B2 端点）→ C（后台按钮 / 依赖 B2 端点 + B1 helper）→ D（PlayerShell / 独立 / 任意时机）

**总卡数**：CHG-361 系列由原 3 子卡（A/B/C）扩为 **5 子卡（A/B1/B2/C/D）**；Wave 2 总卡数 15 → **17**。

### Y5 verify gate 修订

| 子卡 | verify gate |
|------|------|
| **CHG-361-A** ✅ | typecheck + lint + commit trailer（R3）|
| **CHG-361-B2** | typecheck + lint + 5 case API 单测（preview happy / cookie 缺 401 / role user 403 / soft-deleted 404 / public 视频回归）|
| **CHG-361-B1** | typecheck + lint + middleware unit test（preview header 注入 / role 鉴权派发）+ admin-access-token integration test（refresh 端点调用）|
| **CHG-361-C** | typecheck + lint + e2e 1 case（PendingCenter 按钮点击跳 web-next preview URL）+ docs/manual/moderation-console.md 同步 |
| **CHG-361-D** | typecheck + lint + PlayerShell snapshot test（previewMode true 时 feedback hook 不触发）|

### D-160-4b 实施细节锁定（B2 范围）

VideoService.findByShortId 签名修订（避免新增方法 / 内部派发）：

```ts
// apps/api/src/services/VideoService.ts
async findByShortId(shortId: string, options?: { preview?: boolean }): Promise<Video | null> {
  if (options?.preview) {
    return findVideoByShortIdAdminPreview(this.db, shortId)
  }
  return findVideoByShortId(this.db, shortId)
}
```

**理由**：Service 层是 thin wrapper / 不引入新方法 / 通过 options 派发 / 既有调用 0 影响（options 可选）。

### 结论

ADR-160 AMENDMENT 1 status 🟢 Accepted（2026-05-27 / 主循环 claude-opus-4-7 实施前发现 / 不需要 spawn Opus 第二轮 / 仅 §6 文件拆分细化 / 不改任何 D 决策点 / 不改契约）；CHG-361 系列正式扩为 5 子卡（A/B1/B2/C/D）；执行顺序 B2 → B1 → C → D。

## ADR-160 AMENDMENT 2 2026-05-27（5 子卡闭环后 Codex stop-time review 发现）— server-side hydration 补 detail+watch 页 preview 派发

**触发**：CHG-361 A→B2→B1→C→D 5 子卡闭环后 Codex stop-time review 反馈："admin preview cannot render internal/hidden detail pages"。主循环实证审查发现 3 处 client-side fetch **完全绕过 middleware 注入的 `x-admin-preview` header**：

1. `apps/web-next/src/components/video/VideoDetailClient.tsx:242-244` `apiClient.get(/videos/${shortId})` 在浏览器 fetch → 走 `findVideoByShortId` public SQL → internal/hidden 视频 404 → 渲染"视频不存在或已下线"（generateMetadata server-side 已通过 fetchVideoMeta 拿到 metadata / title 显示正确 / 但 page body 错误）
2. `apps/api/src/services/SourceService.ts:38-67` listSources line 40 调 `videoQueries.findVideoByShortId` (public 路径) → internal 视频 sources 端点 404
3. `apps/web-next/src/components/player/PlayerShell.tsx:73-82` 同样 client-side `apiClient.get` 调 `/videos/:id` + `/videos/:id/sources` → watch 页对 internal 视频同样 404

**根因**：ADR-160 §3 D-160-3 设计"middleware → header → page.tsx / fetchVideoMeta 派发数据路径"时未识别 page body 由 client component 承担、client-side fetch 完全独立于 server-side header 派发链路这一事实。原设计仅 metadata 层接通,未覆盖 page body + sources。

**arch-reviewer 评审**（claude-opus-4-7 子代理 1 轮独立评审）：A- CONDITIONAL PASS / 推荐方案 X(server-side hydration) / 拆 3 子卡 E1+E2+E3。

### D 决策点（D-160-AMD2-1..3）

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-160-AMD2-1 | 派发链路扩展 | **server-side hydration** — D-160-3 派发链路从 metadata-only 扩到 page body + sources / 客户端组件接收 hydrated props 跳过初始 fetch / preview 凭据仍仅在 server side（D-160-4b 安全不变量保留）| 架构扩展（非新模式 / 扩既有 D-160-3 派发）|
| D-160-AMD2-2 | sources 端点 preview 扩展 | `GET /videos/:id/sources` +`preview?: 'admin'` query + 双因素鉴权（与 B2 `GET /videos/:id` 同 pattern）；`SourceService.listSources(shortId, episode?, options?: { preview?: boolean })` 签名扩 / 内部派发 `findVideoByShortIdAdminPreview` 校验 video 存在 | contract 扩展（既有公开路由 +optional query / 非新 admin route / R7 MUST-8 不触发）|
| D-160-AMD2-3 | hydration props | VideoDetailClient + PlayerShell 加 `initialVideo?: Video` + `initialSources?: VideoSource[]` 可选 Props / 有值时跳过初始 useEffect fetch / 公开访问路径完全向后兼容 | Props 扩展（optional / backward-compatible）|

### 文件范围（§6 -E 三子卡拆分 / PATCH ≤ 5 红线）

> arch-reviewer Opus 评审强制 R-AMD2-1：7 业务文件超 PATCH ≤ 5 → 必须拆 3 子卡

| 子卡 | 范围 | 文件 | 依赖 | verify gate | 模型 |
|------|------|------|------|------|------|
| **CHG-361-E1**（API 层 / 镜像 B2 pattern）| sources 端点 preview query + SourceService preview 派发 | 2 文件：①`apps/api/src/routes/sources.ts`（+ `preview?: 'admin'` query schema + admin/moderator preHandler 派发）②`apps/api/src/services/SourceService.ts`（`listSources` 签名扩 options.preview / 内部派发 findVideoByShortIdAdminPreview）+ 1 测试 5 case | 独立（镜像 B2 已成熟 pattern）| typecheck + lint + 5 case 单测（preview admin / 无 token 401 / role user 403 / 软删 404 / public 视频回归）| sonnet 或 opus 续会话 |
| **CHG-361-E2**（web-next detail 页 hydration）| detail-page-factory 服务端 fetch + VideoDetailClient initial Props | 3 文件：①`apps/web-next/src/app/[locale]/_lib/detail-page-factory.tsx`（createDetailPage server-side 调 fetchVideoDetail + fetchVideoSources / 拼 initial props）②`apps/web-next/src/components/video/VideoDetailClient.tsx`（Props +`initialVideo?` +`initialSources?` / 有 init 时 setVideo + setSources + skip 初始 fetch / Y-AMD2-1）③`apps/web-next/src/lib/video-detail.ts`（+`fetchVideoSources(slug, episode)` helper / 复用 buildPreviewFetchInit / Y-AMD2-3 preview 路径 `cache: 'no-store'`）| 依赖 E1（sources preview 端点）| typecheck + lint + VideoDetailClient initial 渲染单测 ≥ 3 case | sonnet 或 opus 续会话 |
| **CHG-361-E3**（web-next watch 页 hydration）| watch page server-side fetch + PlayerShell initial Props | 2 文件：①`apps/web-next/src/app/[locale]/watch/[slug]/page.tsx`（server component / 调 fetchVideoDetail + fetchVideoSources / 拼 initial props 传 PlayerShell）②`apps/web-next/src/components/player/PlayerShell.tsx`（Props +`initialVideo?` +`initialSources?` / 有 init 时跳过初始 fetch / 既有 episode/source 切换 useEffect 不变 / Y-AMD2-2 限制声明）| 依赖 E1 + E2（共用 fetchVideoSources helper）| typecheck + lint + PlayerShell initial Props 单测 ≥ 3 case | sonnet 或 opus 续会话 |

**总计**：7 业务 + 3 测试 / 拆 3 子卡 / 每卡 ≤ 3 业务文件 / PATCH ≤ 5 严格合规

**执行顺序**：E1 → E2 → E3（E1 后端 contract 先存 / E2 detail 页消费 / E3 watch 页同 pattern 复用 E2 helper）

### 红线（R-AMD2-1..2 / 实施前必消解）

- **R-AMD2-1（PATCH ≤ 5 拆 3 子卡）**：上表拆分方案合规
- **R-AMD2-2（serializable props）**：实施时验证 `mapSourceBase` 输出 JSON serializable（无 Date 对象 / 无函数 / 无 class 实例）；`created_at` 字段须 string 而非 Date

### 黄线（Y-AMD2-1..3 / 实施时遵守）

- **Y-AMD2-1（useEffect 条件 skip）**：有 initialVideo / initialSources 时早返回避免 stale closure；推荐 `if (initialVideo) { setVideo(initialVideo); return }` 早返回 pattern
- **Y-AMD2-2（episode 切换 internal 视频限制）**：首集 server-side hydration / 后续 episode 切换 client-side fetch 仍走 public 路径 / internal 视频切换 episode 会 404 → 文档化为 known limitation / `?ep=N&preview=admin` reload 是 workaround / FOLLOWUP 卡（React Server Actions / RSC fetch）后续解决
- **Y-AMD2-3（cache no-store）**：`fetchVideoSources` preview 路径必须 `cache: 'no-store'`（与 fetchVideoDetail 一致）

### Advisory（A-AMD2-1..2 / 接受为已知限制）

- **A-AMD2-1**：episode 切换 internal 视频 404 限制接受 → FOLLOWUP 卡（RSC fetch / Server Actions）后续解决；admin reload `?ep=N&preview=admin` 是 pragmatic workaround
- **A-AMD2-2**：fetchVideoDetail 失败触发 Next.js notFound() page（替代 VideoDetailClient 客户端 "视频不存在或已下线" 内联错误）→ 更佳 UX / 不破坏既有 fallback / 行为变化记录

### Q&A 速查（arch-reviewer 评审产出）

| 问题 | 答 |
|------|---|
| VideoDetailClient initialVideo Props 是否触发 Opus 强制升？| ❌ 不触发 — apps/web-next 内部组件 / 非 packages 共享 / 加 optional Props 不属于"共享组件 API 契约" |
| sources `?preview=admin` 是否触发 R-MID-1 audit RETRO？| ❌ 不触发 — GET 只读 / ADR-121 D-121-4 / 同 D-160-6 / 4 真源 +0 |
| 是否新增 admin route？| ❌ 否 — 既有公开路由 +optional query / verify:endpoint-adr 不计新端点 / R7 MUST-8 不触发 |
| E1/E2/E3 执行模型？| arch-reviewer 评审已覆盖架构决策 → 实施层 sonnet 主循环即可；opus-4-7 续会话也合规（CLAUDE.md "主循环不切换"原则）|

### §6 子卡汇总修订（5 → 8 子卡）

| 子卡 | 状态 | 范围 | commit |
|------|------|------|------|
| CHG-361-A | ✅ | ADR-160 起草 + getVideoDetailHref 沉淀 | 5f64e78d |
| CHG-361-B2 | ✅ | apps/api preview 端点 + findVideoByShortIdAdminPreview | a3c1c9ed |
| CHG-361-B1 | ✅ | web-next middleware + admin-access-token + video-detail.ts | 3b9c8fa9 |
| CHG-361-C | ✅ | 后台按钮 + VideoQueueRow 扩 + e2e + manual | 34121022 |
| CHG-361-D | ✅ | PlayerShell previewMode Props + isPlaybackFeedbackEnabled | a52141d9 |
| CHG-361-E1 | ⬜ | sources 端点 preview query + SourceService 派发 | — |
| CHG-361-E2 | ⬜ | detail-page-factory + VideoDetailClient hydration | — |
| CHG-361-E3 | ⬜ | watch page + PlayerShell hydration | — |

### 结论

ADR-160 AMENDMENT 2 status 🟢 Accepted（2026-05-27 / 主循环 claude-opus-4-7 + arch-reviewer 子代理 (claude-opus-4-7) 1 轮独立评审 A- CONDITIONAL → 主循环消化 2 红线 + 3 黄线 + 2 advisory → 等同 A-）；CHG-361 系列正式扩为 8 子卡（A/B1/B2/C/D/E1/E2/E3）；执行顺序 E1 → E2 → E3；本 AMENDMENT 修订 D-160-3 派发链路覆盖范围 + 新增 D-160-AMD2-1..3 决策点 / 不改 D-160-1..7 既有决策。

---

## ADR-163 — META-EPISODES：剧集集数三层语义 schema（CHG-367-A / Wave 2 #11）

> status: 🟢 Accepted（2026-05-28 / arch-reviewer Opus A- CONDITIONAL → 主循环消化 0 红线 + 3 黄线 + 3 advisory → 等同 A-）
> created: 2026-05-28
> 决策者：主循环 `claude-opus-4-7` + arch-reviewer (`claude-opus-4-7`) 子代理 1 轮独立起草 + 自审
> 关联：ADR-105（video merge / split admin API — 含 episodeCount 编辑路径 + snapshot_jsonb）/ ADR-121（R-MID-1 audit RETRO 协议 — 本 ADR 不新增 admin 写端点故不触发）/ ADR-100 §4.5 R7 MUST-8（admin route ADR 前置 — 本 ADR 仅扩 schema 不新增 route）/ ADR-160（Admin Preview — 同期 Wave 2 ADR 范式参考）
> 对应交付：CHG-367-A（本卡 / ADR 起草）/ CHG-367-B（schema migration 078 + MetadataEnrichService 集成 + Video 类型扩 + 审核台显示）

### §1 背景与问题

**核心矛盾**：`videos.episode_count`（Migration 001, L38: `INT NOT NULL DEFAULT 1`）承载了模糊的"集数"语义。爬虫写入路径（`videos.crawler.ts:248`）通过 `SET episode_count = GREATEST(episode_count, $2)` 单向递增，其实际含义是"当前已收录线路中观测到的最大集数"。但前端消费方（50+ 引用点）、VideoCard 列表、审核台、搜索索引均将其作为"总集数"展示，对连载中的剧集产生误导：

| 维度 | 期望语义 | episode_count 实际语义 |
|------|---------|----------------------|
| "这部剧共多少集" | 总集数（external metadata 真源） | 无此信息 |
| "已播到第几集" | 已播集数（external metadata 真源） | 无此信息 |
| "平台已收录多少集" | 已收录集数（video_sources 聚合） | 近似此义（爬虫推算最大值，但可能超出实际 active sources） |

plan §10.4.4 要求引入 `total_episodes` + `current_episodes` 两个字段，数据来源为豆瓣 subject 详情 + bangumi infobox，与既有 `episode_count` 形成三层语义闭环。审核台 TabDetail 计划显示 "已收 X / 已播 Y / 共 Z" 三维视图。

**admin-ui 命名冲突**：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts:38` 已存在 `LineAggregate.totalEpisodes`，其含义是"该线路下 video_sources 行数"（`aggregate.ts:165`: `totalEpisodes: episodes.length`），与本 ADR 的视频实体级 `totalEpisodes`（"作品共多少集"）同名不同义。

### §2 决策摘要（D-163-1..8）

| 决策点 | 主题 | 推荐结论 | 性质 |
|--------|------|---------|------|
| D-163-1 | schema 位置 | **`videos` 表**（非 `media_catalog`） | 架构归属 |
| D-163-2 | 字段命名 + 既有 episode_count 处理 | **新增 `total_episodes` + `current_episodes`；`episode_count` 保留不动、不重命名** | 迁移成本 |
| D-163-3 | NULL 语义 | **NULL = 未从外部 metadata 取到；0 不使用；电影类型保持 NULL** | 数据契约 |
| D-163-4 | 完结态联动 | **DB 层不做自动联动；显示层处理：当 `status='completed'` 且 `total_episodes IS NULL` 且 `current_episodes IS NOT NULL` 时，UI 可推断 total = current** | 业务规则 |
| D-163-5 | 外部 metadata 字段映射 | **豆瓣：`DoubanSubjectDetails.episodes`；bangumi：`external_data.bangumi_entries.episode_count`** | 数据源 |
| D-163-6 | 写入路径合约 | **MetadataEnrichService step1/step2（豆瓣 auto_matched）+ step3（bangumi）写 videos 表；DoubanService.confirmSubject/confirmFields manual 路径同步写** | 写入契约 |
| D-163-7 | audit RETRO 是否触发 | **不触发 R-MID-1**：schema 字段新增无 admin 写端点新增；既有 PUT `/admin/videos/:id` 编辑路径的 episodeCount 编辑不涉及新字段（CHG-367-B 可选择扩展编辑入口，届时独立评估） | 合规边界 |
| D-163-8 | 类型层影响 + 回滚安全 | **Video interface 加 2 个 optional 字段（`totalEpisodes?: number \| null`、`currentEpisodes?: number \| null`）；回滚 = DROP COLUMN，NULL default 安全** | 兼容性 |

### §3 决策点详述

#### D-163-1 schema 位置：videos 表

**推荐**：字段放 `videos` 表而非 `media_catalog`。

**依据**：

1. **数据本体归属**：`media_catalog` 是"作品元数据层"，存储的是跨平台共性属性（title / rating / year / country / director / cast 等——均为静态、不随播出进度变化的元数据）。"已播集数" (`current_episodes`) 是时变的播出进度信息，每周更新，与 catalog 的"静态元数据"范式不符。
2. **现有 episode_count 同表**：`videos.episode_count`（Migration 001）已在 videos 表，新增的两个集数字段是其"语义补充"，同表共存避免跨表 JOIN 开销、降低认知负担。
3. **catalog 无 episode 先例**：翻查 Migration 026（media_catalog 创建）+ 042（字段扩展），catalog 不含任何 episode 相关字段。bangumi dump 的 `episode_count` 存在 `external_data.bangumi_entries`（外部真源暂存），不在 catalog。
4. **写入路径对齐**：MetadataEnrichService 现有 step1/step2/step3 写 catalog 的路径走 `catalogService.safeUpdate()`（带 locked_fields + priority 三重保护），但 episodes 数据不属于 catalog 的 safeUpdate 保护范围。直接写 videos 表更干净。

**替代方案**：放 `media_catalog`。被否定，原因是 catalog 的"静态元数据"范式与"时变播出进度"不符，且引入 catalog → videos 同步机制增加复杂度。

#### D-163-2 字段命名 + 既有 episode_count 处理

**推荐**：

- 新增 `videos.total_episodes INT NULL` — "该作品共多少集"（完结后定值，连载中可能为 NULL 或预告值）
- 新增 `videos.current_episodes INT NULL` — "目前已播到第几集"（连载中持续更新）
- `videos.episode_count` **保留不动**，不重命名为 `active_episodes`

**保留 episode_count 不重命名的依据**：

1. **爆炸半径**：episode_count 被 30+ 文件 / 61+ 处引用（含 DB queries / services / routes / types / ES mapping / e2e tests / factories / search），重命名是大爆炸迁移。
2. **语义差异微妙**：episode_count 的真实语义是"爬虫推算最大集数"（`GREATEST(episode_count, $2)`），与"有 active 源的集数"并不完全等价（某些集数可能 source 已 dead）。强行重命名为 `active_episodes` 反而引入新的语义误导。
3. **已有消费方语义不变**：VideoCard / 搜索 / 前台列表使用 episodeCount 展示集数，保持该语义不变对用户无感知损失。
4. **渐进式治理**：未来如需真正的 `active_episodes`（从 video_sources WHERE is_active = true 实时聚合），应作为 derived 字段（query-time 或 materialized view），不应是 videos 表的持久化列。

**admin-ui 命名冲突声明**：`LineAggregate.totalEpisodes`（lines-panel.types.ts:38）含义为"该线路下 video_sources 行数"，属行级（per-line）统计。本 ADR 的 `videos.total_episodes` / Video interface `totalEpisodes` 属视频实体级（per-video），含义为"作品共多少集"。两者 **同名不同层级**：前者在 `LineAggregate` interface 中，后者在 `Video` interface 中，TypeScript 类型系统自然区分，无运行时冲突。实施时 JSDoc 注释必须显式标注区别。

#### D-163-3 NULL 语义

**推荐**：`NULL` = 未从外部 metadata 取到（尚未 enrich / enrich 未命中 / 外部源未提供该字段）。

| 条件 | total_episodes | current_episodes |
|------|---------------|-----------------|
| 电影 (type='movie') | NULL（电影无集数概念） | NULL |
| series/anime 未 enrich | NULL | NULL |
| enrich 命中但外部源无 episodes 字段 | NULL | NULL |
| enrich 命中且有值 | 外部源值（如 24） | 外部源值（如 12，连载中） |
| 完结剧集 | 等于 current_episodes（或外部源独立提供） | 等于 total_episodes |

**不使用 0**：0 集在业务上无意义，NULL 更诚实地表达"未知"。

**查询规则**：

- 列表/卡片显示：`total_episodes IS NOT NULL` 时显示，否则 fallback 到 `episode_count`
- 审核台三维视图：仅当 `current_episodes IS NOT NULL OR total_episodes IS NOT NULL` 时渲染进度条
- 筛选：`WHERE total_episodes IS NOT NULL` 筛选"已获取外部集数信息"的记录

#### D-163-4 完结态联动

**推荐**：DB 层**不做**自动联动（不设 trigger / CHECK / 不在写入路径做 `total = current` 赋值）。

理由：① 外部源可能独立提供 total/current 不同的值 ② `videos.status = 'completed'` 设置时机不可靠（爬虫推断 vs 人工标记）以此触发 `total = current` 可能在外部源尚未更新时引入错误等式 ③ 显示层处理更灵活：审核台 TabDetail 渲染时 `status='completed' + total_episodes IS NULL + current_episodes IS NOT NULL` → 显示 "共 {current_episodes} 集"（推断）并标注 "(推断)"。

#### D-163-5 外部 metadata 字段映射

**豆瓣**：
- 字段路径：`DoubanSubjectDetails.episodes`（`external-adapter/douban-adapter/src/core/details.types.ts:34`: `episodes?: number`）
- 语义：豆瓣 subject 页面的"集数"字段（不区分 total/current）
- **写入策略**：`videos.status = 'completed'` → 写入 `total_episodes`；`videos.status = 'ongoing'` → 写入 `current_episodes`；对侧字段为 NULL

**bangumi**：
- 字段路径：`external_data.bangumi_entries.episode_count`（Migration 036, L52: `episode_count INT`）
- 语义：bangumi subject 的话数（eps）；不区分 total/current
- **写入策略**：与豆瓣同理，按 status 判断；step3 仅类型为 anime 时触发；遵循"豆瓣优先"原则（已写字段不覆盖）

**局限性声明**：豆瓣和 bangumi 均不明确区分 total / current。本 ADR 的 status 判断法是最佳启发式但非完美——一部标记 completed 但实际还在更新的剧集可能导致 total_episodes 比真实总集数小。这是可接受的折衷，人工审核路径（confirmSubject）可修正。

#### D-163-6 写入路径合约

| 写入路径 | 触发条件 | 写入字段 | 覆盖规则 |
|---------|---------|---------|---------|
| MetadataEnrichService.step1 (本地豆瓣) | `matchStatus = 'auto_matched'` + `detail.episodes` 有值 | `total_episodes` 或 `current_episodes`（按 status 判断） | 仅当目标字段为 NULL 时写入（不覆盖已有值） |
| MetadataEnrichService.step2 (网络豆瓣) | `best.score >= MATCH_THRESHOLD` + `detail.episodes` 有值 | 同上 | 同上 |
| MetadataEnrichService.step3 (bangumi) | type=anime + match + `bangumi.episode_count` 有值 | 同上 | 仅补充：step1/step2 已写 → 不覆盖 |
| DoubanService.confirmSubject (manual) | 人工确认 + `detail.episodes` 有值 | **同时写 total_episodes 和 current_episodes**（manual 优先级最高） | **覆盖既有值**（manual 优先级 = 5，高于所有自动路径） |
| DoubanService.confirmFields (manual fields) | 人工选择性确认 + fields 包含 'episodes' | 同 confirmSubject | 同上 |
| 爬虫 bumpEpisodeCountIfHigher | 爬虫推算（既有路径） | 仅 `episode_count`（不动新字段） | 既有 GREATEST 语义不变 |

**关键约束**：自动路径（step1/step2/step3）仅在目标字段为 NULL 时写入，避免后续 enrich 周期用可能过时的外部数据覆盖人工校正值。手动路径（confirmSubject/confirmFields）始终覆盖。

**实施注意**：MetadataEnrichService 当前写 catalog 走 `catalogService.safeUpdate()`，但本 ADR 的新字段在 videos 表。实施时需在 step1/step2/step3 的写入路径中**新增** `videosQueries.updateVideoEpisodes(db, videoId, { totalEpisodes?, currentEpisodes? })` 调用（新 query 函数），与 `catalogService.safeUpdate()` 并行、不互相依赖。

#### D-163-7 audit RETRO 是否触发

**结论：不触发 R-MID-1 audit RETRO**。

依据：① ADR-121 D-121-4 scope = "admin 写端点"，本 ADR 不新增任何 admin route 仅扩展 schema + 修改 service 写入逻辑 ② 既有 `PUT /admin/videos/:id` 的 episodeCount 编辑路径（ADR-105 关联）当前不涉及新字段；若 CHG-367-B 选择扩展该端点支持编辑 totalEpisodes / currentEpisodes，该扩展需在 CHG-367-B 卡内独立评估（因是修改既有端点 payload 而非新增端点）③ MetadataEnrichService 是内部 job worker，非 admin route，不在 ADR-121 范围。

#### D-163-8 类型层影响 + 回滚安全

**Video interface 扩展**（`packages/types/src/video.types.ts`）：

```ts
totalEpisodes: number | null    // 作品总集数（external metadata / NULL=未知）
currentEpisodes: number | null  // 当前已播集数（external metadata / NULL=未知）
```

**兼容性分析**：
- 新增字段为 optional 行为（DB NULL default / API 响应包含但可能为 null）
- 现有 50+ 消费方引用的 `episodeCount: number` 不变，不破坏
- `VideoCard` type（Pick 子集）**不包含**新字段（卡片列表无需三维集数）
- 搜索索引 ES mapping 的 `episode_count` 保持不变；新字段暂不入 ES（非搜索维度）
- 新字段加入 Video interface 后，所有返回 Video 的 SQL SELECT 需扩列 + mapVideoRow 映射

**回滚安全**：Migration 078 ROLLBACK = `DROP COLUMN IF EXISTS`。NULL default → 删除后既有数据完整性不受影响 / API 响应不再包含新字段 → 前端 fallback undefined 安全（optional 字段）/ 需同步回滚 service 代码避免 write 路径 fail。

### §4 schema 设计（Migration 078 SQL 完整草案 / ROLLBACK SQL）

```sql
-- Migration 078: videos.total_episodes + current_episodes（ADR-163 / CHG-367-B）
--
-- 背景：plan §10.4.4 / ADR-163 META-EPISODES 三层集数语义拆分。
-- 新增两个 INT 字段承载外部 metadata 真源的集数信息，与既有 episode_count 共存。
-- 幂等：ADD COLUMN IF NOT EXISTS，可重复执行。

BEGIN;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS total_episodes   INT  NULL,
  ADD COLUMN IF NOT EXISTS current_episodes INT  NULL;

-- CHECK 约束：集数必须正整数（NULL 合法，0 和负数不合法）
ALTER TABLE videos
  ADD CONSTRAINT chk_total_episodes_positive
    CHECK (total_episodes IS NULL OR total_episodes > 0),
  ADD CONSTRAINT chk_current_episodes_positive
    CHECK (current_episodes IS NULL OR current_episodes > 0);

-- 部分索引：仅对有外部集数信息的行建索引（审核台 "已获取集数" 筛选）
CREATE INDEX IF NOT EXISTS idx_videos_total_episodes
  ON videos (total_episodes)
  WHERE total_episodes IS NOT NULL;

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'videos'
    AND column_name IN ('total_episodes', 'current_episodes');

  IF v_col_count <> 2 THEN
    RAISE EXCEPTION 'Migration 078: videos.total_episodes/current_episodes 添加失败，期望 2，实际 %', v_col_count;
  END IF;

  RAISE NOTICE 'Migration 078 OK: videos.total_episodes + current_episodes added';
END $$;

COMMIT;

-- ROLLBACK SQL:
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_total_episodes_positive;
-- ALTER TABLE videos DROP CONSTRAINT IF EXISTS chk_current_episodes_positive;
-- DROP INDEX IF EXISTS idx_videos_total_episodes;
-- ALTER TABLE videos DROP COLUMN IF EXISTS total_episodes;
-- ALTER TABLE videos DROP COLUMN IF EXISTS current_episodes;
```

**Migration 顺序安全**：当前最高编号 077（meta_quality）。078 仅 ADD COLUMN + ADD CONSTRAINT，与 077 无字段交叉、无 schema 依赖。安全。

### §5 写入路径合约（CHG-367-B 实施指引）

**新增 DB query 函数**（`apps/api/src/db/queries/videos.mutations.ts` 或新文件 `videos.episodes.ts`）：

```ts
interface UpdateVideoEpisodesInput {
  totalEpisodes?: number | null
  currentEpisodes?: number | null
}

async function updateVideoEpisodes(
  db: Pool,
  videoId: string,
  input: UpdateVideoEpisodesInput,
  /** 'auto' = 仅写 NULL 字段；'manual' = 覆盖 */
  mode: 'auto' | 'manual'
): Promise<boolean>
```

**MetadataEnrichService 集成点**：

- step1（L178, `matchStatus === 'auto_matched'` 分支末尾）：读取 `detail.episodes` → 按 `video.status` 判断写入位置 → 调用 `updateVideoEpisodes(db, videoId, {...}, 'auto')`
- step2（L218-L238, `best.score >= MATCH_THRESHOLD` 分支）：同上
- step3（L264-L268, bangumi 写入分支）：读取 `bangumi.episode_count` → 同上（仅补充）

**DoubanService 集成点**：

- confirmSubject（L170-L223）：`detail.episodes` → `updateVideoEpisodes(db, videoId, {...}, 'manual')`
- confirmFields（L309+）：若 `fields` 包含 `'episodes'` → 同上

### §6 显示规约（CHG-367-B 实施指引）

**审核台 TabDetail 三维显示**：

格式："已收 {episodeCount} / 已播 {currentEpisodes} / 共 {totalEpisodes}"

| 可用数据 | 显示文本 |
|---------|---------|
| all three | "已收 8 / 已播 12 / 共 24" |
| episodeCount + currentEpisodes (total unknown) | "已收 8 / 已播 12" |
| episodeCount + totalEpisodes (current unknown) | "已收 8 / 共 24" |
| episodeCount only | "已收 8" (现有行为) |
| type='movie' | 不显示集数维度 |

**Y1 防御**：`currentEpisodes > totalEpisodes` 的 edge case（不应显示"已播 13 / 共 12"），建议该 case 仅显示 currentEpisodes 并标记数据异常。CHG-367-B 实施时必须落地。

**前台（web-next）**：当前迭代不改前台显示。前台 VideoCard 仍用 `episodeCount`。未来如需展示"更至 X 集 / 共 Y 集"，独立迭代卡评估。

**admin-ui LineAggregate.totalEpisodes 不受影响**：该字段含义为"线路下 sources 行数"，与本 ADR 的 Video.totalEpisodes 不存在渲染冲突（不同 UI 组件、不同数据层级）。

### §7 文件范围（CHG-367-B RETRO 框架候选）

| # | 文件 | 改动 |
|---|------|------|
| 1 | `apps/api/src/db/migrations/078_videos_episodes_fields.sql` | 新建 Migration |
| 2 | `apps/api/src/db/queries/videos.internal.ts` | DbVideoRow + VIDEO_FULL_SELECT 扩 2 列 + mapVideoRow 映射 |
| 3 | `apps/api/src/db/queries/videos.mutations.ts` | 新增 `updateVideoEpisodes()` |
| 4 | `apps/api/src/services/MetadataEnrichService.ts` | step1/step2/step3 写入集成 |
| 5 | `apps/api/src/services/DoubanService.ts` | confirmSubject/confirmFields 扩展 |
| 6 | `packages/types/src/video.types.ts` | Video interface 加 2 字段 |
| 7 | `tests/helpers/factories.ts` | createVideo factory 默认值 |
| 8 | 审核台 TabDetail 组件 | 三维显示 + Y1 防御 |

**RETRO 评估**：本 ADR 不新增 admin 写端点 → 不触发 ADR-121 R-MID-1 7 文件 RETRO。若 CHG-367-B 选择扩展 PUT `/admin/videos/:id` 编辑入口支持新字段 → 该扩展需独立走 RETRO（修改既有端点 payload → R7 MUST-8 的端点契约更新 + ADR-121 audit beforeJsonb/afterJsonb 覆盖）。建议 CHG-367-B 首期 **不扩展编辑入口**，仅做自动写入 + 只读显示。

### §8 替代方案对比

| 维度 | 方案 A（采纳：videos 表 + 保留 episode_count） | 方案 B（media_catalog 表） | 方案 C（重命名 episode_count → active_episodes） | 方案 D（JSONB 字段存三值） |
|------|------|------|------|------|
| schema 范式一致 | 与既有 episode_count 同表 | catalog 无 episode 先例 / 破坏静态元数据范式 | 与既有一致（同表） | 非结构化 / CHECK 约束困难 |
| 迁移成本 | 低（2 新列 NULL default） | 中（catalog 加列 + 读取路径跨表 JOIN） | 极高（30+ 文件重命名 / 50+ 引用点） | 低 |
| 查询性能 | videos 单表 | JOIN media_catalog | 单表 | jsonb 索引成本高 |
| 写入路径复杂度 | 新增 1 query 函数 | 走 catalogService.safeUpdate + locked_fields（过度保护） | 同方案 A + 全量重命名 | 解析 JSONB + 部分更新 |
| 与 ES mapping 兼容 | ES episode_count 不变 | 需新增 ES 字段 | 需重建 ES mapping | JSONB 难入 ES |
| 回滚风险 | 极低 | 低 | 极高（回滚 = 反向重命名） | 低 |

方案 B/C/D 均否定（详见 §3 各 D-N 决策点）。

### §9 后果（正面 / 负面 + 风险）

**正面**：
1. 审核台三维集数视图（"已收 / 已播 / 共"）消除运营团队对连载剧集的信息盲区
2. 为未来前台"更至 X 集 / 共 Y 集"展示打下 schema 基础
3. 与 MetadataEnrichService 五步流程无缝集成，无额外 worker / cron

**负面**：
1. **N-163-1**：Video interface 新增 2 个 optional 字段 → 所有返回 Video 的 SQL SELECT 需扩列 + 所有 mapVideoRow 需映射。CHG-367-B 改动量约 3-5 处。风险低。
2. **N-163-2**：豆瓣/bangumi 的 episodes 字段语义模糊（不区分 total/current），按 status 判断写入是启发式，可能对"标记 completed 但实际还在更新"的剧集产生错误。缓解：人工审核路径（confirmSubject）可修正；未来如接入 TMDB 等明确区分 total/current 的源，可精确覆盖。
3. **N-163-3**：videos 表宽度 +2 列。当前 videos 已有 ~30 列，再加 2 列不触及 PG 性能瓶颈（远低于 PG ~1600 列硬限制）。NULL 存储开销接近零（PG 使用 bitmap 标记 NULL）。

### §10 监控与重评条件

| 编号 | 触发条件 | 动作 |
|------|---------|------|
| R-163-1 | CHG-367-B 实施后，审核台反馈"已播 / 共"混淆率 > 10% | 评估引入第三方 API（TMDB）明确区分 total/current |
| R-163-2 | `total_episodes IS NOT NULL` 覆盖率 < 30%（enrich 命中率过低） | 评估扩大外部数据源（如 TMDB API 集数接口） |
| R-163-3 | CHG-367-B 选择扩展 PUT `/admin/videos/:id` 编辑入口 | 独立评估 ADR-121 R-MID-1 RETRO + ADR-100 R7 MUST-8 端点契约更新 |
| R-163-4 | 未来 active_episodes 需求明确（真正的"有 active 源的集数"） | 评估 derived field（query-time 或 materialized view）而非新列 |

### §11 自审评级

**评级：A- CONDITIONAL → 升 Accepted（0 红线 / 3 黄线 / 3 advisory）**

**自审方法**：对照 CLAUDE.md 绝对禁止清单 + ADR 必查项 + 10 个必答问题逐一验证。

**红线（必须修正 / 阻塞 Accepted）**：

1. **R1（CHECK 约束遗漏 total > current 不变式）**：Migration 草案有 `chk_total_episodes_positive` 和 `chk_current_episodes_positive`，但**未加** `CHECK (total_episodes IS NULL OR current_episodes IS NULL OR total_episodes >= current_episodes)` 不变式约束。**结论：不加此 CHECK 约束是正确的设计决策**（外部数据不可控，DB 层不应强制业务不变式 — 豆瓣返回 12 写入 total 后 bangumi 返回 13 写入 current 会违反约束并阻塞写入）。但意味着数据层可能出现 `current > total` 的违直觉状态 → 显示层必须处理。**降级为黄线 Y1**。

**黄线（建议修正 / 不阻塞 Accepted）**：

1. **Y1（current > total 显示层防御）**：审核台 TabDetail 必须处理 `currentEpisodes > totalEpisodes` 的 edge case（不应显示"已播 13 / 共 12"），建议该 case 仅显示 `currentEpisodes` 并标记数据异常。CHG-367-B 实施时落地。
2. **Y2（confirmFields 的 'episodes' 字段键名）**：`DoubanService.confirmFields` 的 `fields` 参数是字符串数组，需定义 `'episodes'` 作为新合法键。实施时需扩展 confirmFields 的 field → action 映射表。
3. **Y3（docs/architecture.md 同步）**：CLAUDE.md 绝对禁止"schema 变更不同步 `docs/architecture.md`"。CHG-367-B migration 落地后必须同步 architecture.md 的 videos 表 schema 描述。

**advisory（可不修）**：

1. **A1（ES mapping 未扩）**：新字段暂不入 ES mapping。当前无按 total_episodes 搜索/排序的需求。
2. **A2（前台 VideoCard 未扩）**：VideoCard Pick 子集不包含新字段。当前迭代无前台展示需求。
3. **A3（bangumi dump 为静态快照）**：`import-bangumi-dump.ts` 导入的 episode_count 可能滞后于实际播出。缓解：豆瓣网络搜索（step2）可补充更实时的数据；且本 ADR 设计"仅写 NULL"策略避免用滞后数据覆盖。

**红线/黄线/advisory 计数：0/3/3**。

无红线 → 升 Accepted。黄线均为 CHG-367-B 实施层面的注意事项，不阻塞 ADR 决策本身。

### 结论

ADR-163 status 🟢 Accepted（2026-05-28 / arch-reviewer Opus A- CONDITIONAL → 无红线 → 等同 A-）；videos 表新增 `total_episodes` + `current_episodes` 双字段（NULL default / 正整数 CHECK / 部分索引）；既有 `episode_count` 保留不动；写入路径自动 NULL-only + manual 覆盖；不触发 R-MID-1 audit RETRO；3 黄线（current>total UI 防御 / confirmFields 键名扩 / architecture.md 同步）由 CHG-367-B 实施承接。

---

## ADR-164 — ROUTE-LABEL-B：source_line_aliases 扩 codename + priority + retired_at（CHG-368-A / Wave 2 #13）

> status: 🟢 Accepted（CONDITIONAL → 0 红线 / 5 黄线 / 4 advisory → 等同 A-，2026-05-28 / arch-reviewer Opus 1 轮独立起草 + 自审）
> created: 2026-05-28
> 决策者：主循环 `claude-opus-4-7` + arch-reviewer (`claude-opus-4-7`) 子代理 1 轮独立起草 + 自审
> 关联：
> - ADR-114-NEGATED（`video_sources (source_site_key, source_name)` 复合键约束 / 跨站不合并 — 本 ADR 的复合 PK 同源）
> - ADR-117（sources-matrix / source-line-aliases admin API 协议 — 本 ADR 扩 §端点契约 + audit 扩枚举）
> - ADR-117 AMENDMENT 1/2（GET routes by-site + 行级 3 mutations — 本 ADR 在同命名空间 `/admin/source-line-aliases` 与 `/admin/sources/*` 协议范式延续）
> - ADR-121（R-MID-1 audit RETRO 协议 4 真源 + 7 文件框架 — 本 ADR **触发**：3 个新 admin 写端点）
> - ADR-100 §4.5 R7 MUST-8（admin route ADR 前置 — 本 ADR 即新增 admin route 的前置 ADR）
> - ADR-110（ApiResponse 信封 + 14 ErrorCode 真源 — 本 ADR 零新增错误码）
> - CHG-352 / docs/manual/route-labeling.md（Layer A effective_score 公式 / `priority_bonus` 5% 权重通道 / Phase 1 已 ship priority=0 默认 / 本 ADR 是 Phase 3）
> - ADR-163（META-EPISODES — Wave 2 同期 Migration 078 + 同构 11 段范式参考）
> 对应交付：CHG-368-A（本卡 / ADR 起草）/ CHG-368-B（Migration 079 + queries + Service 扩 + admin routes + admin UI + audit 4 真源 7 文件 / 实施排期）

### §1 背景与问题

#### 1.1 三层路由命名体系（docs/designs/route-labeling-system.md / docs/manual/route-labeling.md）

```
┌─ Layer C（用户侧）─────┐  ┌─ Layer B（运维侧）─────┐  ┌─ Layer A（排序引擎）──┐
│ 主题标签（位置映射）   │  │ 山名代号（永久绑定）   │  │ effective_score        │
│ 节气 / NATO / Planets… │  │ 泰山 / 峨眉 / 昆仑…    │  │ health 0.5 + quality   │
│ ✅ CHG-353（已 ship）  │  │ ⏳ 本 ADR / CHG-368-B  │  │ 0.3 + latency 0.15 +   │
│                        │  │                        │  │ **priority 0.05**       │
└────────────────────────┘  └────────────────────────┘  │ ✅ CHG-352（已 ship）  │
                                                          └────────────────────────┘
```

- **Layer A** 已 ship（CHG-352）：`priority_bonus` 在 effective_score 公式中占 5% 权重通道；Phase 1 因 `source_line_aliases.priority` 字段尚未落 schema，按 0 默认（`route-scoring.ts` `priority ?? 0`）。本 ADR 落地后，公式立即对运维微调敏感（不破公式 / 不改权重 / 仅激活通道）。
- **Layer B 缺失**：当前 `source_line_aliases` 表只有 `display_name`（"哔哩哔哩主线"这类后台可读别名），缺运维短码（"泰山-2" / "峨眉"）。运维日志、Slack 告警、跨团队沟通需要稳定短码。
- **Layer C** 已 ship（CHG-353 / CHG-369），与本 ADR 正交（不依赖 Layer B 字段）。

#### 1.2 缺失能力

1. **运维短码（codename）**：日志/告警/沟通统一短码，永久绑定 (siteKey, sourceName)。
2. **优先级（priority）**：Layer A effective_score 5% 通道激活；运维手动微调（如灰度推荐某线路）。
3. **退役治理（retired_at）**：
   - **手动退役**：运维主动操作（线路确认不可恢复）
   - **自动退役**：plan §10.5 提案"全 dead（probe=dead + render=dead）持续 180 天 → 自动 retire"（worker 写回 / 不在本 ADR 范围实施，仅本 ADR 落地共用字段）
   - **冷却期**：退役后 90 天内 codename 不复用（防止日志/书签混淆）
4. **admin UI `/admin/source-line-aliases`**：当前 CHG-SN-5-11 仅有 `SourceLineAliasPanel`（侧栏式 display_name 编辑），无独立管理视图；本 ADR 锁定独立 IA 入口 + DataTable 一体化。

#### 1.3 plan §17 Phase 3 范围

route-labeling Phase 3 三件套：(1) schema 扩字段 (2) admin API + UI (3) effective_score 公式激活 priority 通道。本 ADR 锁定 (1) + (2)；(3) 在 CHG-368-B 实施期通过 `route-scoring.ts` 改 `priority ?? 0` → 真实读取（Phase 1 已留 hook，零改公式）。

#### 1.4 与 ADR-117 边界

ADR-117 锁定 `source_line_aliases` 表 5 端点（4 GET + 1 PUT upsert display_name）。本 ADR **不修订** ADR-117 既有 5 端点契约，仅：
- 扩 PUT upsert 端点 body schema（可选 `codename` / `priority`）
- 新增 3 端点（POST retire / PUT priority / GET codename-pool）
- 扩 schema（3 列 + 1 唯一部分索引 + 1 CHECK 约束）

ADR-117 的 audit actionType `source_line_alias.upsert` 既有；本 ADR 新增 2 个 actionType（retire + priority_update），目标 kind 复用 `source_line_alias`。

### §2 决策摘要（D-164-1..D-164-12）

| # | 决策点 | 推荐结论 | 性质 |
|---|--------|---------|------|
| D-164-1 | schema 字段位置 | **扩 `source_line_aliases` 同表**（非新表 `route_labels`） | 架构归属 |
| D-164-2 | codename 与 display_name 关系 | **互补共存**：`display_name` = 后台可读全名 / `codename` = 运维短码（≤ 20 字符 / 唯一部分索引）；均 NULL 合法 | 语义边界 |
| D-164-3 | priority 类型 + 范围 + NULL 处理 | **SMALLINT NOT NULL DEFAULT 0 / 0–100 / CHECK 约束**；route-scoring 归一化 priority/100；零 NULL（与 design 文档 SMALLINT DEFAULT 0 对齐 + 避免 fallback 分支） | 数据契约 |
| D-164-4 | retired_at 软删 vs 硬删 | **TIMESTAMPTZ NULL 软删**（NULL=在役 / NOT NULL=退役时间）；不引入独立 `deleted_at` 列（无硬删需求） | 软删模型 |
| D-164-5 | 端点设计 | **扩 ADR-117 PUT upsert + 新增 3 端点（POST retire / PUT priority / GET codename-pool）**；不另起 `/admin/route-labels/*` 命名空间 | API 设计 |
| D-164-6 | 退役语义对 effective_score 的影响 | **排序时排除 `retired_at IS NOT NULL` 的别名行**（在 SourceService.listSources 的别名 JOIN WHERE 加 `sla.retired_at IS NULL`）；DB 行物理保留（codename 90 天冷却后才入"可用池"） | 业务规则 |
| D-164-7 | audit RETRO 触发与否 | **触发 R-MID-1 7 文件 RETRO**：新增 2 actionType（`source_line_alias.retire` + `source_line_alias.priority_update`）+ 扩 1 actionType payload（`source_line_alias.upsert` afterJsonb 加 codename/priority 字段） | 合规边界 |
| D-164-8 | 与 §10.5 全 dead 180 天自动退役关系 | **共用 `retired_at` 字段**（worker 写）+ **新增 `auto_retired BOOLEAN NOT NULL DEFAULT false`** 区分人工/自动；不引入独立 `auto_retired_at` 列 | 字段共用 |
| D-164-9 | 唯一约束设计 | **`UNIQUE INDEX (codename) WHERE codename IS NOT NULL AND retired_at IS NULL`** 部分唯一索引；保证活跃 codename 全局唯一 + 退役 90 天后可复用 | 索引设计 |
| D-164-10 | codename 字库治理 | **代码层维护 50 山名字库常量 `MOUNTAIN_CODENAMES`**（`packages/types/src/route-codenames.ts`）；GET `/admin/source-line-aliases/codename-pool` 返回 `{ available: string[], occupied: string[], cooling: string[] }`；DB 不存字库（避免 schema 膨胀） | 字库治理 |
| D-164-11 | 90 天冷却期判定 | **应用层（SourceLineAliasService）实现**：query `retired_at < NOW() - INTERVAL '90 days'` 判定可复用；CHECK 约束**不**写 DB（运营可能要求紧急复用 / DB 不写硬性时序约束） | 冷却语义 |
| D-164-12 | 类型层影响 + 回滚安全 | **SourceLineAlias interface 扩 4 字段（codename / priority / retiredAt / autoRetired）+ Video.effectiveScore 不变**；回滚 = DROP COLUMN + DROP INDEX，NULL default + SMALLINT DEFAULT 0 安全 | 兼容性 |

### §3 决策点详述

#### D-164-1 schema 字段位置：扩 source_line_aliases 同表

**推荐**：3 个新字段（codename / priority / retired_at / auto_retired）全部加在 `source_line_aliases` 同表。

**依据**：

1. **数据归属同源**：codename / priority / retired_at 三者都是 (source_site_key, source_name) 复合键的属性，与 display_name 同层级。复合 PK 已对齐 ADR-114-NEGATED 跨站不合并语义。新表 `route_labels` 需重新引入同样的复合 FK，徒增 JOIN 开销。
2. **查询路径同表**：现有 `sources-matrix.ts:listLineAliases / findLineAlias / upsertLineAlias` 全部 SELECT 同表；扩列后这 3 个 query 函数只需 SELECT 多 3 列 + UPDATE 多 3 列，零跨表 JOIN 新增。
3. **JOIN 关系不变**：`getVideoMatrix / listRoutesBySite` 现有 `LEFT JOIN source_line_aliases sla` 仅消费 `display_name`；本 ADR 在 SQL SELECT 列表追加 `sla.codename / sla.priority / sla.retired_at`，JOIN 谓词不变。
4. **设计稿对齐**：`docs/designs/route-labeling-system.md` §"待实施的 DB 变更（Phase 3 参考）" 已明示 `ALTER TABLE source_line_aliases ADD COLUMN codename / priority / retired_at` 同表方案。

**替代方案否决**：

- **新表 `route_labels`**：否决。复合 PK 重复定义 + JOIN 路径需重写 + admin-ui 类型 SourceLineAlias 需拆 + 设计稿明示否定。
- **JSONB 字段 `meta`**：否决。priority 需 CHECK 数值范围 + codename 需唯一部分索引；JSONB 内部值无 DB 级类型校验 + 单 key UPDATE 需读改写整体（并发风险）。详 ADR-123 D-123-1 同模式否决依据。

#### D-164-2 codename 与 display_name 关系：互补共存

**推荐**：

| 字段 | 语义 | 类型 | NULL | 唯一性 | 示例 |
|------|------|------|------|--------|------|
| `display_name` | 后台可读全名（运营/审核台显示） | TEXT | 既有 NOT NULL（不动） | 无（同站点可重名） | "哔哩哔哩主线" |
| `codename` | 运维短码（日志/告警/沟通） | VARCHAR(20) | **NULL**（不强制每行有） | **活跃部分唯一**（D-164-9） | "泰山-2" / "峨眉" |

**互补依据**：

1. **使用场景不同**：display_name 面向审核台 + 后台运营（中文长名 / 可包含空格 / 重复也无碍）；codename 面向运维日志 + Slack 告警 + 跨团队 IM（短 / 全局唯一 / 可被人脑稳定识别）。
2. **生命周期不同**：display_name 可随时改（业务命名调整）；codename 一旦分配**永不更改**，退役后 90 天才复用（运维心智模型稳定）。
3. **NULL 合法（codename）**：不强制每行有 codename。新爬入库 / 运营暂未分配时 NULL；分配后 NOT NULL。display_name 仍 NOT NULL（既有约束不动）。

**替代方案否决**：

- **替换 display_name → codename**：否决。display_name 已有 5 端点（ADR-117）+ admin-ui 消费 + 50+ JOIN 路径；改类型/重命名爆炸半径太大（参 ADR-163 D-163-2 否决 episode_count 重命名同理）。
- **弃用 display_name**：否决。审核台 / 后台运营仍需可读全名（codename 太短不适合首选显示）。

#### D-164-3 priority 类型 + 范围 + NULL 处理

**推荐**：

```sql
priority SMALLINT NOT NULL DEFAULT 0
  CHECK (priority >= 0 AND priority <= 100)
```

**依据**：

1. **类型 SMALLINT**：值域 [0, 100] 远小于 SMALLINT 上限（32767），存储 2 字节足够；与设计稿 `priority SMALLINT NOT NULL DEFAULT 0` 对齐。
2. **NOT NULL DEFAULT 0**：避免 `priority IS NULL` fallback 分支 — Phase 1 `route-scoring.ts` 已用 `priority ?? 0`，本 ADR 落地后改为直接 `priority / 100`，移除可选语义。design-tokens 风格遵循"无 NULL 优于 NULL"原则（参 video.is_active 同模式）。
3. **范围 [0, 100]**：UI 友好（百分比心智）+ Layer A 公式归一化简单（`priority / 100 → 0.0..1.0`）。CHECK 约束在 DB 层强制，防 admin UI bug 或越权 SQL 注入越界。
4. **0 = 中性默认**：与 Phase 1 ship 行为完全一致（未分配 priority → 0 → priority_bonus = 0 → effective_score 不变）。Phase 3 落地后 admin 主动调高才生效。

**替代方案否决**：

- **INT 范围 [-100, 100]（允许负惩罚）**：否决。effective_score 公式不支持负 priority_bonus（健康分主导设计 / 运维不应通过负权重"惩罚"线路 / 不可播应走退役而非负权重）。
- **NULL 表示"未设权重"**：否决。CHG-352 已用 `priority ?? 0`，本 ADR 落地后改 NOT NULL DEFAULT 0 等价行为且免 NULL 检查分支。

#### D-164-4 retired_at 软删 vs 硬删

**推荐**：`retired_at TIMESTAMPTZ NULL`（软删）；不引入独立 `deleted_at`。

**依据**：

1. **业务语义匹配**：退役不等于删除。codename "泰山-2" 退役后，日志/审计仍能追溯 90 天内的告警归属。硬删丢失追溯链。
2. **冷却期可计算**：`retired_at IS NOT NULL AND retired_at < NOW() - INTERVAL '90 days'` → codename 入"可用池"。硬删后 90 天判定无法实现。
3. **架构对齐**：ADR-117 R-ADR-117-2 已留口子"`source_line_aliases` 表无 TTL / 软删除，未来扩展时需起 PRE-ALIAS-SOFT-DELETE 卡决策"。本 ADR 提供该卡。
4. **不需 deleted_at 双字段**：当前无"硬删别名行"需求；未来若需硬删独立起卡，届时新增 deleted_at 不冲突。

**替代方案否决**：

- **硬删 + 独立 `retired_codenames` 历史表**：否决。引入第二张表 + 数据迁移逻辑 + 冷却查询跨表 JOIN，复杂度爆炸；无业务收益。
- **`deleted_at + retired_at` 双字段**：否决。引入冗余语义 + 增加 admin UI 状态机复杂度。

#### D-164-5 端点设计：扩 ADR-117 PUT + 新增 3 端点

**推荐端点矩阵**（详 §5 端点契约）：

| # | 端点 | 关系 | audit |
|---|------|------|-------|
| 既有 1 | GET `/admin/source-line-aliases` | ADR-117 既有 | 无（读） |
| 既有 2 | PUT `/admin/source-line-aliases/:siteKey/:sourceName` | **扩 body**（可选 codename / priority） | 既有 `source_line_alias.upsert` actionType / payload 扩字段 |
| 新增 1 | POST `/admin/source-line-aliases/:siteKey/:sourceName/retire` | 退役端点 | **新增 actionType** `source_line_alias.retire` |
| 新增 2 | PUT `/admin/source-line-aliases/:siteKey/:sourceName/priority` | 单字段更新（高频运营操作） | **新增 actionType** `source_line_alias.priority_update` |
| 新增 3 | GET `/admin/source-line-aliases/codename-pool` | 字库可用性查询 | 无（读） |

**依据**：

1. **同命名空间 `/admin/source-line-aliases/*`**：与 ADR-117 路由文件 `apps/api/src/routes/admin/sources-matrix.ts` 同源；不另起新文件。
2. **不扩 PUT upsert 承担退役**：退役是状态切换语义（in-service → retired），不是"upsert 一个新别名"。
3. **专用 PUT priority**：priority 是高频微调字段（运维一天可能调多次），单独端点 + 单独 audit 便于追溯。
4. **GET codename-pool 独立**：字库治理需要独立查询路径（admin UI"新建别名时显示可用 codename 下拉"）。

**替代方案否决**：

- **新起 `/admin/route-labels/*` 命名空间**：否决。表名仍是 `source_line_aliases`；URL 命名空间分裂 = 增加运维心智负担。
- **PATCH 而非 PUT priority**：否决。PUT 单字段更新已是 ADR-117 PUT upsert 同范式。
- **PUT retire 而非 POST**：否决。retire 是状态动作（非幂等资源替换 — 第二次 retire 已退役资源应 409 而非 200）；POST 是动词语义最佳。

#### D-164-6 退役语义对 effective_score 的影响

**推荐**：SourceService.listSources 的别名 JOIN WHERE 加 `sla.retired_at IS NULL`；DB 行物理保留。

**依据**：

1. **退役 = 不参与排序**：退役线路不应出现在前台 SourceBar 选项；运维退役 = 数据级隔离。
2. **JOIN 谓词最简**：现有 `sources.ts findActiveSourcesWithSignalsByVideoId` 的 LEFT JOIN `source_line_aliases` 在 WHERE 子句加 `AND (sla.retired_at IS NULL OR sla.codename IS NULL)`。
3. **数据物理保留**：codename 冷却期内（90 天）行保留；冷却后行仍保留（codename 字段可被新别名 UPDATE 覆盖 — 唯一部分索引允许复用）。审计追溯不丢。
4. **可视化口子**：admin UI `/admin/source-line-aliases` 可显式切"包含已退役"tab 查看退役历史。

**关键约束**：

- 前台排序 SQL（CHG-352 ship）必须在 CHG-368-B 同步加 `sla.retired_at IS NULL` 谓词
- 矩阵 SQL（`getVideoMatrix` / `listRoutesBySite`）display_name 显示需在退役后回退到 source_name 原值

#### D-164-7 audit RETRO 触发与否

**结论：触发 R-MID-1 7 文件 RETRO**（ADR-121 范式）。

**触发依据**：

1. **新增 admin 写端点**：本 ADR §5 新增 POST retire + PUT priority 共 2 个写端点 → 触发 ADR-100 R7 MUST-8 + ADR-121 R-MID-1 4 真源同步范式。
2. **既有端点 payload 扩展**：PUT upsert（ADR-117 既有）body 扩 codename / priority → afterJsonb 字段扩充，audit-log-coverage.test.ts 的 PAYLOAD_ASSERTION_REQUIRED 测试需重新断言新字段。

**新增 2 actionType + payload 协议**：

| 端点 | actionType | targetKind | targetId | beforeJsonb | afterJsonb |
|------|------------|------------|----------|-------------|------------|
| PUT `/admin/source-line-aliases/:siteKey/:sourceName` | `source_line_alias.upsert`（既有 / payload 扩） | `source_line_alias`（既有） | `${siteKey}/${sourceName}` | 既有 SourceLineAlias 行（INSERT 时 null） | 新 SourceLineAlias 行（**扩 codename / priority / retiredAt 字段**） |
| POST `/admin/source-line-aliases/:siteKey/:sourceName/retire` | **新增** `source_line_alias.retire` | `source_line_alias` | `${siteKey}/${sourceName}` | 退役前完整行（含 codename / priority） | 退役后行（retiredAt 非 NULL / autoRetired=false） |
| PUT `/admin/source-line-aliases/:siteKey/:sourceName/priority` | **新增** `source_line_alias.priority_update` | `source_line_alias` | `${siteKey}/${sourceName}` | 旧行（含旧 priority） | 新行（仅 priority + updatedAt 改变） |

**7 文件 RETRO 框架**（CHG-368-B 必走）：

| # | 文件 | 角色 | 改动 |
|---|------|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | (1) Type union | AdminAuditActionType 加 2 项（`source_line_alias.retire` / `source_line_alias.priority_update`） |
| 2 | `apps/api/src/services/AuditLogService.ts` | (2) ACTION_TYPES | 数组追加 2 项（与 union 严格同序） |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | (3a) Service enums set-equal | EXPECTED set 扩 2 项 |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | (3b) Coverage set-equal + (4) REQUIRED + PAYLOAD it.each | EXPECTED / REQUIRED_ACTION_TYPES / PAYLOAD_ASSERTION_REQUIRED 三处同步扩 2 项 |
| 5 | `apps/api/src/routes/admin/sources-matrix.ts` | 端点 route | 加 2 端点 + Service 层 `auditSvc.write({...})` 调用 |
| 6 | `tests/unit/api/source-line-alias-retire-priority-audit.test.ts` | payload 内容断言新测试 | 覆盖 happy path + 422 校验失败不写 audit + retire 二次 409 不写 audit + payload before/after 内容断言（R-MID-1 守卫）|
| 7 | `docs/changelog.md` | 完成备注 | CHG-368-B 条目含 R-MID-1 第 29 次系统化 |

**PATCH ≤ 5 上限豁免**：ADR-121 D-121-3 锁定 RETRO 7 文件框架为已认证豁免，本 ADR 直接引用，无需额外协商。

#### D-164-8 与 §10.5 全 dead 180 天自动退役关系

**推荐**：共用 `retired_at` 字段 + 新增 `auto_retired BOOLEAN NOT NULL DEFAULT false` 区分人工/自动。

**依据**：

1. **统一退役语义**：人工和自动退役都是"line 退出排序池 + codename 进入 90 天冷却"，业务语义相同，无需双字段。
2. **`auto_retired` 区分来源**：审计追溯需要知道"这条线路是运营手动 retire 还是 worker 触发"。`auto_retired = true` 时 admin UI 可显式标注"系统自动退役（180 天全 dead）"。
3. **本 ADR 不实施 worker**：plan §10.5 自动退役逻辑（180 天检测 + worker 写回）由后续独立卡承担（建议 PRE-DEAD-LINE-AUTO-RETIRE-WORKER）。本 ADR 仅落 schema 字段（worker 可直接写）。
4. **手动退役端点不支持 auto_retired = true**：POST retire 端点 Service 层固定 `auto_retired = false`；worker 走独立 DB query 函数 `autoRetireLineByDeadCheck()`（不暴露端点 / 不写 admin audit / 写 worker 日志）。

**替代方案否决**：

- **独立 `auto_retired_at` 列**：否决。引入 4 字段（`retired_at / auto_retired_at` + 各自判定逻辑），冷却期计算需 `COALESCE(retired_at, auto_retired_at)` 增加 SQL 复杂度。单字段 + 布尔区分更简洁。
- **不区分人工/自动**：否决。审计追溯丢失关键信息。

#### D-164-9 唯一约束设计

**推荐**：

```sql
CREATE UNIQUE INDEX idx_source_line_aliases_codename_active
  ON source_line_aliases (codename)
  WHERE codename IS NOT NULL AND retired_at IS NULL;
```

**依据**：

1. **活跃 codename 全局唯一**：同一时刻只有一个活跃别名行能用 "泰山-2"；保证日志/告警短码无歧义。
2. **退役后可复用**：retired_at 非 NULL 后该 codename 不参与唯一约束；91 天后新别名 UPDATE codename = "泰山-2" 不违反索引。
3. **NULL codename 不参与**：未分配 codename 的别名行（仅有 display_name）无需占用字库。
4. **部分索引性能**：跨站全表唯一搜索性能 O(1)；查询 `codename = $1 AND retired_at IS NULL` 走索引扫描。

**替代方案否决**：

- **全表 UNIQUE (codename)**：否决。退役后 codename 永远占用，字库枯竭快（仅 50 山名）。
- **应用层校验唯一性**：否决。并发 INSERT/UPDATE 时存在 race condition。DB 层约束唯一可靠。

#### D-164-10 codename 字库治理

**推荐**：

- 代码常量真源：`packages/types/src/route-codenames.ts`（52 项 / 50 山名 + 2 占位）
- GET `/admin/source-line-aliases/codename-pool` 端点返回 `{ available, occupied, cooling }` 三段：
  - `occupied`：当前活跃使用中的 codename（retired_at IS NULL）
  - `cooling`：退役且 < 90 天的 codename（仍占用）
  - `available`：字库 \ occupied \ cooling（运营可用列表）
- codename 支持后缀（如 "泰山-2"）：字库基础名 + 数字后缀允许扩容（同名 site 多线路场景）

**依据**：

1. **DB 不存字库**：字库是配置数据，代码常量 + Git 版本控制 + TS 编译期检查比 DB seed 表更可靠（参 ADR-017 VideoGenre union type 同模式）。
2. **3 段返回**：admin UI 新建别名时 codename 下拉显式标注"可用 / 已占用 / 冷却中"，避免运营误选导致 422。
3. **后缀扩展**：50 山名预期足够（20 站 × 平均 3 线 = 60），但 codename 支持任意 VARCHAR(20) 字符串（CHECK 仅长度 + 非空 + ASCII/中文范围），不强制必须来自字库。

#### D-164-11 90 天冷却期判定

**推荐**：应用层（SourceLineAliasService）实现 `isCodenameInCooling(codename: string): Promise<boolean>`；DB 不写 CHECK 约束。

**依据**：

1. **运营紧急复用口子**：如果 90 天冷却期写死 DB CHECK，运营遇到字库枯竭紧急场景无法绕过。应用层判定 + admin UI 警告"该 codename 冷却中，确认继续？"提供柔性。
2. **时间约束不应写 DB**：DB CHECK 约束应是静态条件（参 ADR-163 D-163-4 "DB 层不强制业务不变式"）。`NOW() - INTERVAL '90 days'` 在 CHECK 中可行但语义脆。
3. **Service 层一致**：sources-matrix.ts 已有 `findLineAlias` query；新增 `findCodenameAssignments(codename, includeCooling)` query + Service 层 `isCodenameInCooling()` 与 `findCodenameAssignments` 复用 SQL 路径。

#### D-164-12 类型层影响 + 回滚安全

**SourceLineAlias interface 扩展**（`packages/types/src/sources-matrix.types.ts`）：

```ts
export interface SourceLineAlias {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string
  readonly codename: string | null              // 新增（NULL = 未分配）
  readonly priority: number                     // 新增（0–100 / NOT NULL DEFAULT 0）
  readonly retiredAt: string | null             // 新增（ISO 8601 / NULL = 在役）
  readonly autoRetired: boolean                 // 新增（true = worker 自动退役 / false = 人工）
  readonly updatedAt: string
}
```

**兼容性分析**：

- 既有 `SourceLineAlias` 4 字段不变；新增 4 字段：3 个 NULL/默认值合法 + 1 boolean 默认 false → 既有消费方零代码改动可读取（仅 display_name）。
- 既有 `SourceMatrixRow` / `LineMatrixRow` 不变。
- 前台 web-next 不感知（codename 仅运维侧 / 前台仍走 effective_score 排序 + theme labels）。

**回滚安全**：Migration 079 ROLLBACK 标准模式：

```sql
ALTER TABLE source_line_aliases DROP CONSTRAINT IF EXISTS chk_source_line_aliases_priority_range;
DROP INDEX IF EXISTS idx_source_line_aliases_codename_active;
ALTER TABLE source_line_aliases DROP COLUMN IF EXISTS auto_retired;
ALTER TABLE source_line_aliases DROP COLUMN IF EXISTS retired_at;
ALTER TABLE source_line_aliases DROP COLUMN IF EXISTS priority;
ALTER TABLE source_line_aliases DROP COLUMN IF EXISTS codename;
```

- 4 列均 NULL default 或 DEFAULT 值 → DROP COLUMN 不破坏既有 5 端点
- 唯一部分索引 DROP 不影响主键 PRIMARY KEY (source_site_key, source_name)
- CHECK 约束 DROP 不影响数据

### §4 schema 设计（Migration 079 SQL 完整草案 + ROLLBACK SQL + Migration 顺序声明）

#### 4.1 Migration 079 SQL

```sql
-- Migration 079: source_line_aliases.codename / priority / retired_at / auto_retired
-- ADR-164 / CHG-368-B / plan §17 route-labeling Phase 3
--
-- 背景：route-labeling Phase 3 — 山名代号 + 线路优先级 + 退役治理。
-- 字段扩展：
--   codename     VARCHAR(20)  NULL                       — 运维短码（"泰山-2"）
--   priority     SMALLINT     NOT NULL DEFAULT 0         — Layer A effective_score 5% 通道
--                CHECK 0–100
--   retired_at   TIMESTAMPTZ  NULL                       — 软删时间戳（NULL=在役）
--   auto_retired BOOLEAN      NOT NULL DEFAULT false     — true=worker 自动退役 / false=人工
--
-- 唯一约束：(codename) WHERE codename IS NOT NULL AND retired_at IS NULL
--   活跃 codename 全局唯一 / 退役后可复用
--
-- 幂等：ADD COLUMN IF NOT EXISTS / ADD CONSTRAINT IF NOT EXISTS / CREATE UNIQUE INDEX IF NOT EXISTS

BEGIN;

-- ── 1. 列扩展 ─────────────────────────────────────────────────────

ALTER TABLE source_line_aliases
  ADD COLUMN IF NOT EXISTS codename     VARCHAR(20)  NULL,
  ADD COLUMN IF NOT EXISTS priority     SMALLINT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retired_at   TIMESTAMPTZ  NULL,
  ADD COLUMN IF NOT EXISTS auto_retired BOOLEAN      NOT NULL DEFAULT false;

COMMENT ON COLUMN source_line_aliases.codename
  IS '运维短码（如 "泰山-2"）/ NULL = 未分配 / 活跃部分唯一（idx_source_line_aliases_codename_active）/ 永久绑定 (siteKey, sourceName)';
COMMENT ON COLUMN source_line_aliases.priority
  IS 'Layer A effective_score priority_bonus 通道 / 0-100 SMALLINT / NOT NULL DEFAULT 0 / route-scoring.ts 归一化 priority/100';
COMMENT ON COLUMN source_line_aliases.retired_at
  IS '退役时间戳 / NULL = 在役 / NOT NULL = 退役 + 90 天冷却后 codename 可被新别名复用 / 应用层判定冷却期';
COMMENT ON COLUMN source_line_aliases.auto_retired
  IS 'true = worker 自动退役（全 dead 180 天）/ false = 人工 POST retire 端点';

-- ── 2. CHECK 约束（priority 范围）─────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_source_line_aliases_priority_range'
      AND table_name = 'source_line_aliases'
  ) THEN
    ALTER TABLE source_line_aliases
      ADD CONSTRAINT chk_source_line_aliases_priority_range
        CHECK (priority >= 0 AND priority <= 100);
  END IF;
END $$;

-- ── 3. 唯一部分索引（在役 codename）───────────────────────────────
-- 索引键: codename / 部分索引 WHERE = codename IS NOT NULL AND retired_at IS NULL
-- 真实用途:
--   ① 唯一性约束物理保证（DB 强制 / INSERT/UPDATE codename 违反抛 23505）
--   ② 按 codename driving 查询活跃别名（GET codename-pool occupied / codename 反查）
-- 不适用:
--   ① listSources / matrix JOIN: JOIN 按 (source_site_key, source_name) 复合 PK 匹配
--     → 走 PRIMARY KEY 索引 / 与 codename 索引无关
--   ② cooling lookup（反向 retired_at IS NOT NULL / 不可用）
--   ③ 已退役行查询

CREATE UNIQUE INDEX IF NOT EXISTS idx_source_line_aliases_codename_active
  ON source_line_aliases (codename)
  WHERE codename IS NOT NULL AND retired_at IS NULL;

-- ── 4. 辅助索引（已退役行集合 / 候选未来路径）─────────────────────
-- 索引覆盖已退役行 retired_at 列排序结构。
-- 候选查询路径（规划器实际选用取决于数据 selectivity / 留 EXPLAIN ANALYZE 验证）：
--   ① admin UI "已退役" tab（CHG-368-B-B）：retired_at IS NOT NULL ORDER BY DESC
--   ② GET codename-pool cooling 段（CHG-368-B-A2）：retired_at >= NOW() - 90 days
--      范围扫描（按 retired_at 范围 / 不按 codename 单值）
-- 不适用：① listSources / matrix JOIN：按 (source_site_key, source_name)
--   复合 PK 匹配 → 走 PRIMARY KEY 索引（不依赖 retired_at 索引）② 按 codename
--   查询 cooling（WHERE codename = $1 AND retired_at IS NOT NULL）：当前 schema
--   无适用索引 / 全表扫描或 retired_at 范围扫后应用层过滤 codename / 未来热路径
--   可独立加 (codename) WHERE retired_at IS NOT NULL 部分索引（CHG-368-B-A2
--   实施时评估）。
-- （注：本节注释经 CHG-368-B-A1-FIX-{1,2,3,4,5} 五次修订：原 "加速 listSources JOIN"
-- 方向错（FIX-2）→ "加速 cooling 判定 by codename" 仍错（FIX-3 / 调用方错配）
-- → "走 codename 索引" 也错（FIX-4 / codename 部分索引方向反）→ 第 3 节
-- "listSources 由 codename 索引覆盖" 同模式错（FIX-5 / Codex stop-time review #21 /
-- listSources JOIN 实际走 PRIMARY KEY 不走 codename 索引）。最终四级范式：
-- 覆盖 / 真实用途 / 不适用 / 实测留置。）

CREATE INDEX IF NOT EXISTS idx_source_line_aliases_retired_at
  ON source_line_aliases (retired_at)
  WHERE retired_at IS NOT NULL;

-- ── 5. 验证 ───────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
  v_idx_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
    FROM information_schema.columns
    WHERE table_name = 'source_line_aliases'
      AND column_name IN ('codename', 'priority', 'retired_at', 'auto_retired');

  IF v_col_count <> 4 THEN
    RAISE EXCEPTION 'Migration 079: source_line_aliases 4 列添加失败，期望 4，实际 %', v_col_count;
  END IF;

  SELECT COUNT(*) INTO v_idx_count
    FROM pg_indexes
    WHERE tablename = 'source_line_aliases'
      AND indexname IN ('idx_source_line_aliases_codename_active', 'idx_source_line_aliases_retired_at');

  IF v_idx_count <> 2 THEN
    RAISE EXCEPTION 'Migration 079: 2 索引添加失败，期望 2，实际 %', v_idx_count;
  END IF;

  RAISE NOTICE 'Migration 079 OK: source_line_aliases 4 列 + 2 索引 + 1 CHECK 添加完成';
END $$;

COMMIT;

-- ROLLBACK:
-- BEGIN;
-- DROP INDEX IF EXISTS idx_source_line_aliases_retired_at;
-- DROP INDEX IF EXISTS idx_source_line_aliases_codename_active;
-- ALTER TABLE source_line_aliases DROP CONSTRAINT IF EXISTS chk_source_line_aliases_priority_range;
-- ALTER TABLE source_line_aliases
--   DROP COLUMN IF EXISTS auto_retired,
--   DROP COLUMN IF EXISTS retired_at,
--   DROP COLUMN IF EXISTS priority,
--   DROP COLUMN IF EXISTS codename;
-- COMMIT;
```

#### 4.2 Migration 顺序安全声明

- **当前最高编号**：078（videos.total_episodes + current_episodes / ADR-163）
- **本 Migration 编号**：079
- **依赖**：063（source_line_aliases 建表 / ADR-117 关联）
- **顺序冲突分析**：
  - 与 078 无字段交叉（videos vs source_line_aliases 不同表）
  - 与 063 单向扩展（ADD COLUMN / ADD INDEX 不修改既有列）
  - 不冲突 plan §17.3 提到的"META-EPISODES 顺序协调"（078 已 ship + 079 落 source_line_aliases / 双 ADR 互不干扰）

### 端点契约（R7 MUST-8 6 列范式 / 原 ADR-164 §5）

#### 5.1 既有端点扩展（PUT upsert / ADR-117 body 扩字段）

| # | Method | Path | 用途 | Request | Response | 错误码 | RETRO 状态 |
|---|--------|------|------|---------|----------|--------|------------|
| 1 | PUT | `/admin/source-line-aliases/:siteKey/:sourceName` | upsert 别名（**扩 body**） | Path: `siteKey` / `sourceName`（URL encoded）; Body: `{ displayName: string(1..100), codename?: string(1..20) \| null, priority?: number(0..100) }`（最少含 displayName / 其他字段可选） | 200 `{ data: SourceLineAlias }`（含新 4 字段） | 422 VALIDATION_ERROR（codename 长度 / priority 越界 / displayName 必填） / 409 STATE_CONFLICT（codename 已被其他活跃行占用 / 部分唯一索引冲突） / 500 INTERNAL_ERROR | **既有 actionType `source_line_alias.upsert` payload 扩**（详 §6.audit） |

#### 5.2 新增端点（3 项）

| # | Method | Path | 用途 | Request | Response | 错误码 | RETRO 状态 |
|---|--------|------|------|---------|----------|--------|------------|
| 2 | POST | `/admin/source-line-aliases/:siteKey/:sourceName/retire` | 退役别名（手动 / autoRetired=false） | Path: `siteKey` / `sourceName`; Body: `{ reason?: string(0..200) }`（可选退役原因） | 200 `{ data: SourceLineAlias }`（retiredAt 非 NULL） | 404 NOT_FOUND（别名行不存在）/ 409 STATE_CONFLICT（已退役二次操作）/ 401 / 403 | **新增 actionType `source_line_alias.retire` / R-MID-1 第 29 次系统化** |
| 3 | PUT | `/admin/source-line-aliases/:siteKey/:sourceName/priority` | 单字段更新 priority（高频运营操作） | Path: `siteKey` / `sourceName`; Body: `{ priority: number(0..100) }` | 200 `{ data: SourceLineAlias }`（仅 priority + updatedAt 变化） | 404 NOT_FOUND / 422 VALIDATION_ERROR / 401 / 403 | **新增 actionType `source_line_alias.priority_update` / R-MID-1 第 30 次系统化** |
| 4 | GET | `/admin/source-line-aliases/codename-pool` | 字库可用性查询 | — | 200 `{ data: { available: string[], occupied: string[], cooling: string[] } }` | 401 / 403 | 无（读端点 / 不写 audit）|
| 5 | GET | `/admin/source-line-aliases/all` | **全线路视图**（含未分配别名 / Wave 3 验收期补丁 / CHG-SN-9-LINES-VIEW-UNIFY） | — | 200 `{ data: SourceLineRow[] }`（含 displayName / codename / priority / retiredAt / autoRetired / assignedAt / videoCount / activeCount / episodeCount 字段；assignedAt=null 时表示该 (siteKey, sourceName) 尚未在 source_line_aliases 表分配过别名） | 401 / 403 | 无（读端点 / 不写 audit）|

#### 5.3 鉴权矩阵

- **既有读端点**（ADR-117 既有 4 GET）：`requireRole(['moderator', 'admin'])` 不动
- **新增读端点**（codename-pool）：`requireRole(['moderator', 'admin'])`（与既有读端点一致）
- **写端点**（PUT upsert / POST retire / PUT priority）：**admin only**（ADR-117 D-117-1 锁定原则）

#### 5.4 zod schema 草案

```ts
const AliasParamsSchema = z.object({
  siteKey:    z.string().min(1).max(100),
  sourceName: z.string().min(1).max(200),
}).strict()

const UpsertAliasBodySchema = z.object({
  displayName: z.string().min(1, '别名不能为空').max(100, '别名过长'),
  codename:    z.string().min(1).max(20).regex(/^[一-龥A-Za-z0-9-]+$/, 'codename 仅允许中文/英文/数字/连字符').nullable().optional(),
  priority:    z.coerce.number().int().min(0).max(100).optional(),
}).strict()

const RetireBodySchema = z.object({
  reason: z.string().max(200).optional(),
}).strict()

const PriorityBodySchema = z.object({
  priority: z.coerce.number().int().min(0).max(100),
}).strict()
```

#### 5.5 错误码（ADR-110 14 码 / 零新增）

| 场景 | code | status |
|------|------|--------|
| zod 校验失败 / codename 长度 / priority 越界 | VALIDATION_ERROR | 422 |
| 别名行不存在（retire / priority 端点）| NOT_FOUND | 404 |
| codename 已被其他活跃行占用（部分唯一索引冲突）| STATE_CONFLICT | 409 |
| retire 端点对已退役行二次操作 | STATE_CONFLICT | 409 |
| 非 admin role 调写端点 | FORBIDDEN | 403 |
| 未登录 | UNAUTHORIZED | 401 |
| DB 写异常 | INTERNAL_ERROR | 500 |

#### 5.6 类型契约（`packages/types/src/sources-matrix.types.ts`）

```ts
export interface SourceLineAlias {
  readonly sourceSiteKey: string
  readonly sourceName: string
  readonly displayName: string
  readonly codename: string | null
  readonly priority: number
  readonly retiredAt: string | null
  readonly autoRetired: boolean
  readonly updatedAt: string
}

export interface CodenamePool {
  readonly available: readonly string[]
  readonly occupied: readonly string[]
  readonly cooling: readonly string[]
}

export interface UpsertAliasInput {
  readonly displayName: string
  readonly codename?: string | null
  readonly priority?: number
}

export interface RetireAliasInput {
  readonly reason?: string
}
```

#### 5.7 Service 层契约（`apps/api/src/services/SourcesMatrixService.ts`）

**推荐**：在既有 `SourcesMatrixService.ts` 加方法，不新建独立 Service 文件。

```ts
class SourcesMatrixService {
  async upsertLineAlias(params, input: UpsertAliasInput, actorId): Promise<SourceLineAlias>
  async retireLineAlias(params, input: RetireAliasInput, actorId): Promise<SourceLineAlias>
  async updateLineAliasPriority(params, priority: number, actorId): Promise<SourceLineAlias>
  async getCodenamePool(): Promise<CodenamePool>
}
```

#### 5.8 listSources / SourceService 改动（CHG-368-B 顺带）

1. `apps/api/src/db/queries/sources.ts` 的 `findActiveSourcesWithSignalsByVideoId` LEFT JOIN 加 `AND (sla.retired_at IS NULL OR sla.codename IS NULL)` 谓词
2. `apps/api/src/lib/route-scoring.ts` 的 `calculatePriorityBonus` 改为真实读取 `priority / 100`
3. 矩阵 SQL 保留显示 display_name 不变

### §6 显示规约（admin UI + Layer B 在审核台消费）

#### 6.1 admin UI `/admin/source-line-aliases`（独立路径）

**真源建议**：`apps/server-next/src/app/admin/source-line-aliases/page.tsx`

消费 DataTable 一体化（packages/admin-ui）：列：siteKey / sourceName / displayName 内联编辑 / codename 下拉提示字库 / priority slider / retiredAt 状态显示 / updatedAt 只读。

**Toolbar**：search / viewsConfig（全部/在役/已退役/字库冷却中）/ bulkActions（批量退役 + 批量调 priority）

**filter chips slot**：`renderFilterChip` 覆盖 retiredAt 与 priority 区间

#### 6.2 Layer B 在审核台 LinesPanel 消费

- 当 `LineAggregate.codename` 非 NULL → 行尾显示小标签 "codename: 泰山-2"
- 退役行（retiredAt 非 NULL）→ 整行 50% opacity + "已退役" 标识

#### 6.3 TabDetail（审核台右栏）不消费

当前不消费 codename（避免审核台主视图信息密度过高 / advisory A-164-3）。

#### 6.4 前台 web-next 不感知

- SourceBar 仍走 effective_score 排序 + theme labels
- codename 不出现在前台 / 仅运维侧

### §7 文件范围（CHG-368-B RETRO 7 文件框架 + 业务 + UI）

#### 7.1 RETRO 7 文件（ADR-121 框架 / 必含）

| # | 文件 | 角色 |
|---|------|------|
| 1 | `packages/types/src/admin-moderation.types.ts` | AdminAuditActionType union 加 2 项 |
| 2 | `apps/api/src/services/AuditLogService.ts` | ACTION_TYPES 数组扩 2 项 |
| 3 | `tests/unit/api/audit-log-service-enums-set-equal.test.ts` | EXPECTED set 扩 |
| 4 | `tests/unit/api/audit-log-coverage.test.ts` | EXPECTED + REQUIRED + PAYLOAD it.each 扩 |
| 5 | `apps/api/src/routes/admin/sources-matrix.ts` | route 加 3 端点 + 扩 PUT upsert body |
| 6 | `tests/unit/api/source-line-alias-retire-priority-audit.test.ts` | payload 内容断言新测试文件 |
| 7 | `docs/changelog.md` | CHG-368-B 完成条目（R-MID-1 第 29-30 次系统化）|

#### 7.2 业务 + schema + 类型 + UI（追加文件 / RETRO 7 文件之外）

| # | 文件 | 改动 |
|---|------|------|
| 8 | `apps/api/src/db/migrations/079_source_line_aliases_codename_priority_retired.sql` | 新建 Migration |
| 9 | `apps/api/src/db/queries/sources-matrix.ts` | 扩 5 queries SELECT 列 + 新增 retire/priority/codename queries |
| 10 | `apps/api/src/services/SourcesMatrixService.ts` | 扩 upsertLineAlias + 新增 3 方法 + 字库治理逻辑 |
| 11 | `packages/types/src/sources-matrix.types.ts` | SourceLineAlias 扩 4 字段 / 新增 3 类型 |
| 12 | `packages/types/src/route-codenames.ts` | **新建**：MOUNTAIN_CODENAMES 50 山名常量 |
| 13 | `apps/api/src/lib/route-scoring.ts` | `calculatePriorityBonus` 真实读取 priority |
| 14 | `apps/api/src/db/queries/sources.ts` | JOIN 加 retired_at IS NULL 谓词 + SELECT 扩 priority |
| 15 | `apps/server-next/src/app/admin/source-line-aliases/page.tsx` | **新建** admin UI 独立路径 |
| 16 | `apps/server-next/src/app/admin/source-line-aliases/_client/SourceLineAliasClient.tsx` | **新建** DataTable 一体化消费组件 |
| 17 | `packages/admin-ui/src/components/composite/lines-panel/...` | LinesPanel 行级 codename 标签 + 退役行 opacity（advisory）|
| 18 | `docs/architecture.md` §5.X | source_line_aliases schema 描述同步（CLAUDE.md 红线）|
| 19 | `docs/manual/route-labeling.md` | 加 "§9 Layer B 实施记录" |

#### 7.3 PATCH ≤ 5 上限豁免分析

CHG-368-B 文件范围 = 7（RETRO）+ 12（业务/schema/UI）= 19 文件。

- **RETRO 7 文件**：ADR-121 D-121-3 已认证豁免
- **业务 12 文件**：超 PATCH ≤ 5 上限 → **必须拆 CHG-368-B-A / -B / -C 子卡**

**子卡拆分建议**：

| 子卡 | 范围 | 文件数 |
|------|------|--------|
| **CHG-368-B-A** | Migration 079 + queries + types + Service + route-scoring 集成 + RETRO 7 文件 | 14（业务+RETRO 一体提交 / RETRO 不可拆 / D-121-3 豁免）|
| **CHG-368-B-B** | admin UI 独立路径 + DataTable 集成 | 3 |
| **CHG-368-B-C** | LinesPanel 行级 codename 标签 + 文档同步（advisory）| 3 |

CHG-368-B-A 的"14 文件"是 RETRO 框架豁免本身含业务 route 文件；剩余业务 7 文件超 5 → 实施期可再拆 -A1（types+migration+queries）/ -A2（Service+route+测试）= 严格 ≤5 拆法。具体由 CHG-368-B 拆卡时决定。

#### 7.4 docs/architecture.md 同步红线（CLAUDE.md 强约束）

CHG-368-B 实施期必须在 docs/architecture.md 同步 §5 数据模型 source_line_aliases schema 描述：加新 4 字段说明 + 唯一部分索引 + §17.X "Layer B 山名代号体系（ADR-164）" 概览引用。不同步 = 违反 CLAUDE.md 绝对禁止 → BLOCKER。

### §8 替代方案对比

#### 8.1 4 维度对比矩阵

| 维度 | **方案 A（采纳）：扩 source_line_aliases 同表 + 3 端点扩 + RETRO 7 文件** | 方案 B：新表 route_labels + 跨表 JOIN | 方案 C：JSONB 字段 meta + 单端点全字段更新 | 方案 D：拆站点表 source_line_aliases_<key> 多表 |
|------|--------|---------|---------|---------|
| **schema 一致性** | 与既有 display_name 同表 / 复合 PK 同源 ADR-114-NEGATED | 复合 FK 重复 / 跨表 JOIN 路径污染 | JSONB 内部无 CHECK / 无唯一索引能力 | 表数膨胀（20+ 表）/ 跨站查询需 UNION |
| **迁移成本** | 极低（4 ADD COLUMN + 1 CHECK + 2 INDEX / 幂等可重跑） | 高（新表 + 数据迁移 + 5 queries 改 LEFT JOIN） | 低（JSONB 字段加） | 极高（动态表名 / 不可幂等 migration） |
| **查询性能** | 单表 + 部分唯一索引 + 部分索引 retired_at | LEFT JOIN 额外 nested-loop 开销 | JSONB 字段无 B-tree / 不能用索引查询 codename | 多表 UNION + 运行时表名解析 |
| **类型层影响** | SourceLineAlias 扩 4 字段（既有消费方读 display_name 不变）| 拆 SourceLineAlias / SourceLineMeta 两类型 | SourceLineAlias.meta: JsonValue（类型层模糊）| 多类型实例化 / 静态类型不可表达 |
| **唯一约束能力** | 部分唯一索引（活跃 codename 全局唯一 / 退役后可复用）✅ | 同 A（可实施）✅ | JSONB 内部值无唯一约束 ❌ | 跨表 codename 唯一不可保证 ❌ |
| **audit 协议复杂度** | 复用 source_line_alias targetKind + 2 新 actionType / R-MID-1 7 文件框架 | 需扩 targetKind = 'route_label' / migration 052 CHECK 扩 | 单 actionType `meta.update` + payload 体积大 / before/after 全 JSONB diff 难审计 | 跨表 audit / targetId 多形态 |
| **回滚安全** | 4 ADD COLUMN NULL/DEFAULT 反向 DROP 安全 | 新表 DROP + 数据丢失风险 | JSONB 字段 DROP 安全 / 但既有数据丢字段 | 多表 DROP 顺序敏感 / 高风险 |
| **与设计稿对齐** | 100% 对齐 docs/designs/route-labeling-system.md §"Phase 3 参考" | 偏离设计稿 | 偏离 / 设计稿明示同表 | 严重偏离 |
| **与 ADR-114-NEGATED 兼容** | 兼容（复合 PK 同源）| 需重新引入复合 FK | 兼容 | 复合 PK 不可跨表 |
| **未来 worker auto-retire 集成** | 直接 UPDATE retired_at + auto_retired = true | 同 A | UPDATE JSONB 字段（并发风险）| worker 需知道表名（动态查询不友好）|

#### 8.2 否决理由总结

- **方案 B（新表）**：复合 PK 重复定义 + JOIN 路径污染 + 设计稿明示否定
- **方案 C（JSONB）**：无 CHECK / 无唯一索引 / 并发写竞争（ADR-123 D-123-1 同模式否决）
- **方案 D（拆站点表）**：表数膨胀 + 跨站查询不可行 + ADR-117 D-117-B 已锁定单表方案

### §9 后果（正面 / 负面 + 风险）

#### 9.1 正面

1. **Layer B 完整闭环**：codename 永久绑定 + 字库治理 + 退役冷却 + audit 追溯 = 运维心智模型稳定
2. **Layer A priority 通道激活**：effective_score 公式无改动 + Phase 1 hook 真实读取 = 零回归 + 立即生效
3. **设计稿 100% 对齐**：docs/designs/route-labeling-system.md §"Phase 3 参考" SQL 完全落地
4. **与 ADR-117 协议范式延续**：3 新端点鉴权 / Service 层 / audit 协议 / 错误码 / DataTable 一体化与 ADR-117 一致
5. **plan §10.5 自动退役预留**：`auto_retired` 字段 + 共用 `retired_at` 让后续 PRE-DEAD-LINE-AUTO-RETIRE-WORKER 卡可零 schema 改动直接落 worker

#### 9.2 负面 / 风险

1. **N-164-1（admin UI 工程量）**：新增独立路径 + DataTable 一体化 + 字库下拉 + priority slider + bulkActions。CHG-368-B-B 子卡预估 3 文件 / 中等工程量。**缓解**：复用 packages/admin-ui DataTable + 既有 SourceLineAliasPanel 部分 hooks。
2. **N-164-2（route-scoring 行为变化）**：CHG-368-B-A 实施 `priority / 100` 真实读取后，effective_score 公式对运维调高 priority 立即敏感。**风险**：运营首次使用可能"忘记 priority=0 默认"导致老线路被新线路压制。**缓解**：admin UI priority slider 默认 0 + tooltip 说明。
3. **N-164-3（codename 唯一约束的运营摩擦）**：部分唯一索引可能因运营误填重复 codename 导致 409 STATE_CONFLICT。**缓解**：admin UI 内联编辑 codename 时 onBlur 预校验 + 错误信息明确。
4. **N-164-4（90 天冷却期应用层判定脆弱）**：D-164-11 锁定应用层 + admin UI 警告但允许绕过。**缓解**：监控指标 R-164-2 触发独立卡评估是否升级为 DB CHECK 硬约束。
5. **N-164-5（auto_retired 字段未实施 worker）**：本 ADR 落 `auto_retired BOOLEAN`，但 plan §10.5 worker 仍是占位。**缓解**：CHG-368-B 完成后立即创建 PRE-DEAD-LINE-AUTO-RETIRE-WORKER 占位卡 + admin UI tooltip "自动退役功能开发中"。

### §10 监控与重评条件

| 编号 | 触发条件 | 动作 |
|------|---------|------|
| R-164-1 | CHG-368-B 实施后 1 个月内，codename 唯一冲突 409 次数 > 50 | 评估 admin UI 内联编辑 onBlur 预校验是否落地 / 字库下拉是否引导效果不足 |
| R-164-2 | 90 天冷却期被运营紧急绕过 > 3 次/月 | 评估是否升级 DB CHECK 硬约束 / 或改 admin UI 强制确认弹窗 |
| R-164-3 | priority 通道真实读取后，前台 SourceBar 排序 p95 渲染时间 > +30ms | 评估 priority 是否需要单独索引 / 或 Service 层缓存 priority map |
| R-164-4 | plan §10.5 worker 实施时发现 `retired_at + auto_retired` 字段语义不足 | 评估 D-164-8 共用字段决策是否需要拆 `auto_retired_at` 独立列 |
| R-164-5 | 50 山名字库枯竭（occupied + cooling > 45） | 触发 PRE-ROUTE-CODENAME-LIBRARY-EXTEND 卡 / 评估扩字库或允许中文+数字后缀复用 |
| R-164-6 | admin UI `/admin/source-line-aliases` 视图 p95 渲染时间 > 500ms（视频别名行 > 200）| 评估 listLineAliases 端点是否需引入分页 |
| R-164-7 | ADR-121 RETRO audit-log-coverage.test.ts PAYLOAD_ASSERTION_REQUIRED 断言连续 2 次失败 | 评估 R-MID-1 范式是否退化 / 复评 ADR-121 D-121-1 4 真源协议 |

### §11 自审评级

**评级：A- CONDITIONAL → 升 Accepted（0 红线 / 5 黄线 / 4 advisory）**

**红线（必须修正 / 阻塞 Accepted）**：**0 红线**。

逐项核对结果：schema 变更同步 docs/architecture.md → §7.4 明示 CHG-368-B 实施期同步 / 不阻塞；越层调用 → §5.7 强制 Service 层；any 类型 → §5.6 类型契约全 readonly + 严格类型；空 catch → 实施期 RETRO 框架不涉及；硬编码颜色 → UI 仅文档级；测试未通过 commit → 实施期承接；新增 admin route 未先起 ADR → **本 ADR 即新 admin route 的前置 ADR** ✅；修改 packages/admin-ui types.ts 缺 arch-reviewer trailer → 实施期 CHG-368-B commit 需含 trailer；PATCH ≤ 5 上限 → §7.3 明示拆 -A/-B/-C 子卡。

**黄线（建议修正 / 不阻塞 Accepted）**：**5 黄线**：

1. **Y-164-1（codename 字库 50 山名硬编码）**：MOUNTAIN_CODENAMES 是 ts const 数组 / 扩展需改代码部署。**建议**：CHG-368-B 实施期评估是否未来需要 admin UI 字库管理（独立卡）。
2. **Y-164-2（90 天冷却期硬编码常量）**：90 天数字硬编码在 SourceLineAliasService。**建议**：实施时抽 const + JSDoc 标注。
3. **Y-164-3（admin UI bulkActions 批量 retire 失败处理）**：单行失败不阻塞其他行 / 但需 UI 显式 Toast 显示哪些行成功/失败。**建议**：CHG-368-B-B 实施期落地 Toast 聚合。
4. **Y-164-4（LinesPanel 类型扩展）**：advisory A-164-2 提及 LineAggregate 需扩 codename / retired_at 字段。**建议**：CHG-368-B-C 子卡承接 admin-ui Props 契约扩展（commit 需 arch-reviewer trailer / CLAUDE.md §模型路由 共享组件 API 契约强制 Opus）。
5. **Y-164-5（codename regex 字符集）**：§5.4 zod schema `/^[一-龥A-Za-z0-9-]+$/` 允许中文/英文/数字/连字符。**建议**：实施期 review 是否允许下划线 `_` / 点 `.` / 空格等；本 ADR 保守起步。

**advisory（可不修）**：**4 advisory**：

1. **A-164-1（worker 自动退役未实施）**：plan §10.5 占位 / 本 ADR 仅落字段
2. **A-164-2（LinesPanel codename 显示可选）**：§6.2 非强制
3. **A-164-3（TabDetail 不显示 codename）**：§6.3 选择不在审核台主视图显示
4. **A-164-4（前台 web-next 不感知）**：§6.4 显式声明

**红线/黄线/advisory 计数：0/5/4**。无红线 → 升 Accepted。

### 结论

ADR-164 status 🟢 Accepted（2026-05-28 / arch-reviewer Opus 1 轮独立起草 + 自审 0 红线 / 5 黄线 / 4 advisory → 等同 A-）。`source_line_aliases` 表扩 4 字段（codename / priority / retired_at / auto_retired）+ 部分唯一索引 + CHECK 约束 + 3 新 admin 写端点（POST retire / PUT priority / GET codename-pool）+ R-MID-1 audit RETRO 7 文件框架触发（2 新 actionType）+ codename 字库 50 山名常量 + 90 天冷却期应用层判定 + 与 plan §10.5 worker 共用 `retired_at + auto_retired` 字段；5 黄线 + 4 advisory 由 CHG-368-B（拆 -A/-B/-C 子卡）实施承接；CHG-368-B-A 含 RETRO 7 文件 + 14 文件需再拆 -A1/-A2 严格 ≤5。

---

## ADR-165 — ROUTE-LABEL-D：users.preferences 跨设备主题同步（CHG-SN-9-ROUTE-LABEL-D-ADR / Wave 3 #10）

> status: 🟢 Accepted（2026-05-28 / arch-reviewer Opus A- CONDITIONAL → 主循环消化 5 红线全落 + Y-165-1/-2/-3/-4 落 + 洞察 1 + 洞察 5 落 = 等同 A-）
> proposer: claude-sonnet-4-6（主循环 / 不切换 §16.5）
> reviewer: arch-reviewer (claude-opus-4-7) — agentId a6c323d228d26d12d / 1 轮独立评审
> related: ADR-164（Layer B / 与本 ADR 共用 schema 演进范式）/ ADR-159（双轨信号 / 与本 ADR 共用 JSONB 结构化字段范式）/ CHG-369 + CHG-369-B（本 ADR 前置工作 / 5 内置主题 + 自定义主题 + 双 key localStorage）
> last_reviewed: 2026-05-28

### §1 背景与动机

CHG-369（2026-05-27 ship / commit b54388f8）落地 5 内置主题（节气 / NATO / 数字 / Planets / Colors）+ localStorage 持久化（`resovo:route-theme`）+ SSR 安全。CHG-369-B（2026-05-28 ship / commit 1e1fb61f）落地自定义主题输入（双 key 存储 / `resovo:route-theme:custom` JSON + CustomThemeDialog 表单 + parseCustomTheme schema 校验）。

设计稿 `docs/designs/route-labeling-system.md` 行 278 明示演进路径："**进阶（后期可选）**：登录用户的自定义主题同步至 `users.preferences` JSON 字段，跨设备生效"。docs/manual/route-labeling.md §8.4a + §8.7 多处标 "跨设备同步：本期未实装（→ Wave 3 ROUTE-LABEL-D / users.preferences）"。

**Phase 编号澄清（Opus 评审洞察 1 / 2026-05-28）**：设计稿 §Layer C 行 322-324 把"users.preferences 跨设备同步"归为 **Phase 4 / 可选 / 后期**；设计稿的 Phase 3 实际是 codename / priority / retired_at（ADR-164 / 已 ship）。plan §17.2 Wave 3 增补把设计稿"Phase 4 跨设备同步"提前到 Wave 3 同期推进 / 与 plan §14 Wave 3 长期 P3 节奏一致 / 本 ADR 沿用 plan §17.2 "Wave 3" 称呼但显式标注实际为设计稿 Phase 4 提前。

本 ADR 决策 Phase 4（提前到 Wave 3）跨设备同步落地：登录用户的 `themeId` + `customTheme` 通过 `users.preferences` JSONB 字段在 PC / 手机 / 平板等多设备间保持一致；未登录用户仅 localStorage 单设备持久化（与 CHG-369 + CHG-369-B 完全兼容 / 零回归）。

### §2 决策范围

本 ADR 覆盖 11 决策点（D-165-1 ~ D-165-11 / 详 §9）：
- D-165-1 schema（Migration 077 inline 范式 / R-165-5）
- D-165-2 preferences shape（嵌套 + server passthrough + 客户端 strict 双 schema / R-165-4 + Y-165-2 + Y-165-3）
- D-165-2a 嵌套层级规约（最多 3 层 / Y-165-4）
- D-165-3 端点契约（preHandler auth / PUT 200 + body / Y-165-6）
- D-165-4 同步协议（mount 双阶段 GET + debounce 500ms PUT / 未登录仅 localStorage）
- D-165-5 登录迁移（server 空 → localStorage 迁移 / 非空 → server 优先 / R-165-2 受控 re-paint）
- D-165-6 未登录态降级（CHG-369 + CHG-369-B 零回归）
- D-165-7 顶层模块 PATCH + 模块内 last-write-wins（R-165-3）
- D-165-8 错误处理 + sessionStorage lastSyncFailedAt 静默重试（Y-165-7）
- D-165-9 CLAUDE.md "未登录访问 users 表" 红线规避 + admin 域 RBAC 副作用规避（洞察 5）
- D-165-10 D-N 编号闭环
- D-165-11 hydration mismatch 防御 / setSyncing disable 切换器（R-165-2 新增）

不在本 ADR 范围（→ 独立 follow-up ADR / 卡片）：
- 跨用户偏好分享（**洞察 4 强调：分享场景必须独立 schema / shared_custom_themes 表 / 不得通过 preferences 字段间接实现**）/ 收藏 / 历史（已有 watch_history 表 / 不掺合）
- preferences 加密 / DLP（当前 routeTheme 无 PII）
- preferences 版本控制 + 字段迁移（Phase 4 字段数 ≥ 3 个时评估加 `version: number`）
- 离线同步队列 / 冲突解决（顶层 PATCH 语义跨模块零冲突已足够 Phase 3）
- BroadcastChannel 跨 tab 协议（Phase 4 评估 / Y-165-5）
- admin 域读其他用户 preferences（独立 ADR 评估隐私边界 / 洞察 5）

### §3 现状

- **users 表 schema**（Migration 001 + 067 role_changed_at + 068 display_name）：无 preferences 字段
- **users.ts queries**：findUserById / findUserByEmail / 等 CRUD（无 preferences 相关）
- **路由模式**：apps/api/src/routes/users.ts 用 `fastify.get('/users/me', { preHandler: [fastify.authenticate] })` 已有用户私有路径范式
- **错误格式**：`{ error: { code, message, status } }` JSON 嵌套（与 ADR-104/-110 既有 14 码模板表延续）
- **Migration 最新编号**：079（next: 080）
- **CHG-369-B 双 key localStorage**：`resovo:route-theme` 存 themeId / `resovo:route-theme:custom` 存 CustomThemeData JSON
- **useRouteTheme hook**：mount 时读 localStorage / setTheme / setCustomTheme / clearCustomTheme（apps/web-next/src/lib/route-theme-storage.ts）

### §4 SQL 草案（Migration 080 / R-165-5 修订：与 Migration 077 inline CHECK 范式对齐）

```sql
-- 080_users_preferences.sql
-- 描述：users 表加 preferences JSONB 字段（ADR-165 跨设备主题同步）
-- 日期：2026-05-28
-- 幂等：是（IF NOT EXISTS）
-- 索引设计 4 步核验（db-rules.md §"索引设计 4 步核验"）：
--   1. 索引键：N/A（不加索引 / 应用层按 users.id PK 命中 / 单行 lookup）
--   2. 部分索引 WHERE：N/A
--   3. 候选 driving 谓词：GET /users/me/preferences 走 `WHERE id = $1` PK / 已有 users_pkey
--   4. 匹配判定：PK 完整覆盖 / 不需新索引（实测留 EXPLAIN ANALYZE）

-- R-165-5 修订：inline ADD COLUMN ... CHECK（与 Migration 077 meta_quality 范式对齐 / 简洁幂等）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(preferences) = 'object');

-- DO 块验证：列存在 + CHECK 约束存在
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'preferences'
  ) THEN
    RAISE EXCEPTION 'Migration 080 failed: users.preferences column not created';
  END IF;
END$$;

-- ROLLBACK SQL（向后兼容性 / 应用层降级到 localStorage）：
-- ALTER TABLE users DROP COLUMN IF EXISTS preferences;
-- （CHECK 约束随列一起删除 / 不需独立 DROP）
```

**与 ADR-159 + ADR-163 + ADR-164 + Migration 077 JSONB 字段范式对齐**（R-165-5）：DEFAULT '{}'::jsonb + inline jsonb_typeof CHECK + 不强制 schema（应用层 zod 校验）。Migration 077 行 25-26 范式：`ADD COLUMN IF NOT EXISTS meta_quality JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(meta_quality) = 'object')`，本 ADR 完全同构。

### §5 preferences shape（应用层 zod schema / R-165-4 + Y-165-2 + Y-165-3 修订）

**文件位置（Y-165-2 修订）**：扩**既有** `packages/types/src/user.types.ts`（单数 / 与既有 video.types.ts / banner.types.ts 命名一致），**不**新建 users.types.ts。User interface 加可选 `preferences?: UserPreferences`（与 displayName?: string | null 同范式）。

**约束常量真源（Y-165-3 修订）**：CHG-369-B 已在 `apps/web-next/src/lib/route-theme-storage.ts:41-47` 定义 `CUSTOM_THEME_CONSTRAINTS`。本 ADR 实施期把该常量**迁移到 packages/types/src/user.types.ts**（共享层），web-next/lib/route-theme-storage.ts 改 import 路径（防双真源）。

```ts
// packages/types/src/user.types.ts（扩既有文件）
import { z } from 'zod'

// CHG-369-B 迁移过来（原 web-next/lib/route-theme-storage.ts）
export const CUSTOM_THEME_CONSTRAINTS = {
  displayNameMaxChars: 10,
  labelMaxChars: 10,
  labelsMinCount: 1,
  labelsMaxCount: 30,
  deadLabelMaxChars: 10,
} as const

const C = CUSTOM_THEME_CONSTRAINTS

export const CustomThemeDataSchema = z.object({
  displayName: z.string().trim().min(1).max(C.displayNameMaxChars),
  labels: z.array(z.string().trim().min(1).max(C.labelMaxChars))
    .min(C.labelsMinCount).max(C.labelsMaxCount),
  deadLabel: z.string().trim().min(1).max(C.deadLabelMaxChars).optional(),
})

export const RouteThemePreferenceSchema = z.object({
  themeId: z.string().min(1),  // 'jie_qi' | 'nato' | 'numbers' | 'planets' | 'colors' | 'custom'
  customTheme: CustomThemeDataSchema.optional(),  // 仅 themeId='custom' 时携带
})

// R-165-4 修订：双 schema 区分类型契约 vs 持久化契约
// - UserPreferencesSchema（passthrough）：server 持久化路径 / 未知字段保留（防 Phase 4 加字段时旧客户端误删 server 已有数据）
// - UserPreferencesStrictSchema（strict）：客户端类型层开发期约束 / 拒绝拼写错误
export const UserPreferencesSchema = z.object({
  routeTheme: RouteThemePreferenceSchema.optional(),
  // 未来扩字段：playerSettings? / homeLayout? / 等
}).passthrough()  // server 持久化 / 旧客户端不删未知字段

export const UserPreferencesStrictSchema = UserPreferencesSchema.strict()  // 客户端类型层

export type UserPreferences = z.infer<typeof UserPreferencesSchema>
export type RouteThemePreference = z.infer<typeof RouteThemePreferenceSchema>
export type CustomThemeData = z.infer<typeof CustomThemeDataSchema>
```

**字段约束严格性来源**：CHG-369-B CUSTOM_THEME_CONSTRAINTS（迁移到 packages/types）+ docs/designs/route-labeling-system.md §Layer C 设计稿约束。

### §5a preferences shape 嵌套层级规约（Y-165-4 新增）

为避免未来字段膨胀时嵌套层级失控，规定：

- **第 1 层 = 模块名**：`routeTheme` / `playerSettings` / `homeLayout` 等 / 每个模块独立同步策略
- **第 2 层 = 模块内可独立同步的字段块**：如 routeTheme 下的 themeId / customTheme
- **第 3 层 = 字段本身**（叶子值或紧凑对象）：如 customTheme 内的 displayName / labels / deadLabel
- **最多 3 层**：超过 3 层必须独立 Schema + 独立同步策略（独立 ADR 评估 / 独立 zod schema 顶层）
- **顶层模块加字段** = 兼容（passthrough 防误删）
- **既有模块内字段变更** = 破坏性变更（需独立 ADR 评估 + 兼容期）

### §6 端点契约（R7 MUST-8 6 列范式 / R-165-3 修订：字段级 PATCH 语义）

| 列 | GET /users/me/preferences | PUT /users/me/preferences |
|---|---|---|
| 鉴权 | preHandler: [fastify.authenticate] | preHandler: [fastify.authenticate] |
| 请求 | （空） | Body: 部分 UserPreferences（顶层模块级 PATCH） |
| 响应 200 | `{ data: UserPreferences }` | `{ data: UserPreferences }`（返回 merge 后完整最新值 / 便于消费方刷新 state） |
| 错误码 | 401（INVALID_TOKEN）/ 404（NOT_FOUND）| 401 / 404 / 422（VALIDATION_ERROR）|
| 幂等 | 是（纯 GET）| 是（同 body 重复 PUT 结果一致）|
| 副作用 | 无 | UPDATE users.preferences（顶层 key JSONB merge） |

**PUT body 设计：顶层模块级 PATCH（R-165-3 方案 A）**：

放弃原"整体替换 + 客户端 read-modify-write"方案（read-modify-write 经典竞态：tab1 改 routeTheme + tab2 改 playerSettings → 后 PUT 覆盖前 PUT）。改为**顶层模块级 PATCH**：

- body shape：`{ routeTheme?: RouteThemePreference | null }`（未来扩 `{ playerSettings?: ... | null }`）
- **undefined** = 不改该字段
- **null** = 清除该字段（从 server preferences 中删除该顶层 key）
- **值** = 设置该字段（完整覆盖该顶层 key 内容）
- SQL 用 JSONB merge：`UPDATE users SET preferences = preferences || $1::jsonb WHERE id = $2`（仅传入的顶层 key 被合并）
- 删除字段：`UPDATE users SET preferences = preferences - 'routeTheme' WHERE id = $1`

**优势 vs 既有 updateUserProfile 范式对称**（users.ts:255-289 用相同"仅传入字段才更新"语义）：
- 客户端无需 read-modify-write
- tab1 改 routeTheme 与 tab2 改 playerSettings 互不影响（JSONB merge 顶层 key 不冲突）
- last-write-wins 仅限同一顶层 key 内（D-165-7 缩窄到模块内 / 跨模块零冲突）

**错误码（ADR-110 既有 14 码无新增 / 复用）**：
- 401 INVALID_TOKEN — 既有 / 未登录 / token 失效
- 404 NOT_FOUND — user.deleted_at IS NOT NULL（极少触发 / 鉴权后理论上 user 存在）
- 422 VALIDATION_ERROR — body zod 校验失败 / 复用既有 message "参数错误"

**`/v1/` 前缀**：apps/api/src/routes/users.ts 既有路径 `/users/me/*` 不带 v1 前缀（与 ADR-012 一致）。本 ADR 沿用相同前缀模式 `/users/me/preferences`。

**响应 200 + 完整 body 选择依据（Y-165-6 修订）**：与既有 POST /users/me/history 返 204 范式有别。本 ADR 选 200 + body 因：① 主题切换用户立即可感知 / 需 server 权威值刷新前端 state ② 跨设备同步场景需 server 权威 ③ 防客户端 stale 显示。POST /users/me/history 返 204 因纯写入 / 消费方不需立即刷新。两种范式差异化设计合理。

### §7 同步协议（流程图 / R-165-2 + D-165-11 修订：mount hydration mismatch 防御）

```
┌─────────────────────────────────────────────────────────────┐
│ 场景 A: 用户未登录（CHG-369 + CHG-369-B 既有行为完全不变）  │
├─────────────────────────────────────────────────────────────┤
│ useRouteTheme mount → 读 localStorage → 应用                │
│ setTheme(t) → setState + 写 localStorage                    │
│ setCustomTheme(d) → setState + 写双 key localStorage        │
│ （无任何 API 调用 / 零网络依赖）                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 场景 B: 用户已登录（ADR-165 新增 / R-165-2 hydration 修订） │
├─────────────────────────────────────────────────────────────┤
│ Step 1 mount 同步（R-165-2 hydration mismatch 防御）:       │
│   useRouteTheme mount:                                      │
│     第 1 阶段 (即时 / SSR-safe):                            │
│       → 读 localStorage → setState (本地立即应用)           │
│       → setSyncing(true) (RouteThemeSelector disable 切换器)│
│     第 2 阶段 (异步 / mount 后 effect):                     │
│       → GET /users/me/preferences                           │
│       → 200 + routeTheme 非空:                              │
│           if (server.themeId !== local.themeId               │
│               || server.customTheme !== local.customTheme): │
│             setState (server 优先 / 单次受控 re-paint)      │
│             write localStorage (双 key 同步)                │
│           else: 一致 / 不 re-paint                          │
│       → 200 + routeTheme 空 (D-165-5 登录迁移):             │
│           if (local 有 themeId): PUT 把 local 迁移到 server │
│             (仅首次 / server 已有则不覆盖)                  │
│       → 失败 / 401 / 网络错: 仅 localStorage / 静默         │
│       → 完成 / setSyncing(false) (解锁切换器)               │
│                                                              │
│ Step 2 用户操作（仅 syncing=false 时切换器可点）:           │
│   setTheme(t):                                              │
│     setState + 写 localStorage（即时 / 不等 server）        │
│     debounce 500ms → PUT { routeTheme: { themeId } }        │
│   setCustomTheme(d):                                        │
│     setState + 写双 key localStorage（即时）                │
│     debounce 500ms → PUT { routeTheme: { themeId, custom } }│
│   clearCustomTheme:                                         │
│     setState + 清 localStorage（即时）                      │
│     debounce 500ms → PUT { routeTheme: { themeId } }        │
│       (themeId 回 default / customTheme 字段省略 = 删除)    │
│                                                              │
│ Step 3 网络失败处理（D-165-8 增补）:                        │
│   PUT 失败 → 静默（localStorage 已成功）                    │
│   → 写 sessionStorage `lastSyncFailedAt` 时间戳             │
│   → 下次 setTheme/setCustomTheme 时检测 < 5 分钟 → 静默重试│
│   → 不显示 toast（防干扰 / 与 CHG-369 设计取舍一致）        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 场景 C: 跨设备同步（PC 改 → 手机自动应用）                  │
├─────────────────────────────────────────────────────────────┤
│ PC: setTheme('nato') → debounce 500ms → PUT { routeTheme }  │
│ 手机: 用户刷新 / 重新打开 → useRouteTheme mount             │
│   → Step 1 第 2 阶段 → GET preferences                      │
│   → routeTheme.themeId='nato' !== local 'jie_qi' → 切      │
│   → 单次 re-paint + 切换器在 syncing 期 disable             │
│ （手机不主动 polling / 仅 mount 时拉 / 简化协议）           │
└─────────────────────────────────────────────────────────────┘
```

**debounce 500ms 设计依据**：
- 用户快速切换主题（如对比 5 内置主题）→ 500ms 内不触发多次 PUT
- 太短（< 200ms）→ 高频 PUT 浪费带宽 + 数据库写
- 太长（> 1s）→ 用户体感"同步慢"
- 500ms 与既有 web-next CHG-350 search 300ms 同范式（user input 防抖）

**多 tab race（Y-165-5 增补 / §10 风险 #8 详）**：
- 单 tab：useRef 持 timer / clearTimeout 覆盖（已设计）
- 多 tab：每 tab 独立 debounce 队列 + 顶层 PATCH 语义（仅同一顶层 key 才冲突）+ last-write-wins 兜底
- Phase 4 evaluation：BroadcastChannel API 跨 tab 同步触发 PUT（与 ADR-037 brand 同范式）/ 当前 v1 不引入

### §8 安全 + 隐私

- **RBAC**：所有路径 `preHandler: [fastify.authenticate]` 强制登录 / Service 层 `userId = request.user.userId` 直接用 JWT 解析的 userId（不接受 body userId 防 IDOR）
- **PII 风险**：当前 routeTheme 仅含 themeId（枚举值）+ customTheme（用户给的主题名 + 标签）/ 无 PII / 无敏感字段 / 不需加密
- **JSONB CHECK**：`jsonb_typeof = 'object'` 防 NULL / 数组 / 标量污染
- **应用层 zod 双 schema 校验（R-165-4）**：server 用 UserPreferencesSchema (passthrough) 持久化 / 客户端 UserPreferencesStrictSchema (strict) 类型层开发期约束 / 两者职责分离
- **CLAUDE.md "未登录请求路径访问 users 表" 红线**：本 ADR 端点全部 `preHandler: auth` / 不在 admin/* 域 / 不绕过鉴权 / **零违反**
- **admin 域 RBAC 副作用规避（Opus 评审洞察 5）**：新增 query `getUserPreferences / updateUserPreferences` **仅接受当前请求 userId** / 不暴露 admin 全量列表 / admin 域 listAdminUsers 等仍按既有显式列清单 SELECT（不拉 preferences）/ admin 域如需读 preferences 必须独立起 ADR + 评估隐私边界

### §9 D-N 偏离编号

- **D-165-1** schema：users + preferences JSONB / 不加新索引（PK 覆盖足够）/ Migration 077 inline CHECK 范式（R-165-5 修订）
- **D-165-2** preferences shape：`{ routeTheme?: { themeId, customTheme? } }` 嵌套 + 顶层模块扁平兄弟字段未来扩 / **server passthrough + 客户端 strict 双 schema**（R-165-4 修订）/ 文件位置扩既有 user.types.ts（Y-165-2 修订）
- **D-165-2a** 嵌套层级规约：最多 3 层 / 第 1 层模块名 / 第 2 层字段块 / 第 3 层叶子值（§5a / Y-165-4 新增）
- **D-165-3** 端点：GET / PUT `/users/me/preferences` / `preHandler: [fastify.authenticate]` / PUT 200 + 完整 body（Y-165-6 差异化依据）
- **D-165-4** 同步协议：mount 时 GET / setTheme/setCustomTheme 时 debounce 500ms PUT / 未登录仅 localStorage
- **D-165-5** 登录迁移：首次登录后 server 空 → localStorage 优先 PUT 到 server / server 非空 → server 优先 + 客户端比对后单次受控 re-paint（R-165-2 修订）
- **D-165-6** 未登录态降级：CHG-369 + CHG-369-B 既有 localStorage 路径完全保留 / 零回归
- **D-165-7** 并发：**顶层模块 PATCH 语义 + 模块内 last-write-wins**（R-165-3 修订 / 不引入版本号 / Phase 4 评估）
- **D-165-8** 错误处理：网络 / 401 / 422 全降级 localStorage / 不显示 toast / sessionStorage `lastSyncFailedAt` 时间戳 + 下次操作时静默重试（Y-165-7 增补）
- **D-165-9** CLAUDE.md "未登录请求路径访问 users 表" 红线规避：preHandler auth 强制 + admin 域 RBAC 副作用规避（洞察 5 增补）
- **D-165-10** D-N 偏离编号闭环：实施期 changelog 同步关闭
- **D-165-11** hydration mismatch 防御（R-165-2 新增）：mount 第 1 阶段读 localStorage 即时应用 + setSyncing(true) disable 切换器 / 第 2 阶段 GET server 完成后 setSyncing(false) 解锁 / server 与 local 不一致时单次受控 re-paint + 写双 key localStorage 同步

### §10 风险与对策（Opus 评审后增补 / R-165-2 + R-165-4 + 洞察 5 + Y-165-5/-6/-7 修订）

| 风险 | 影响 | 概率 | 对策 |
|---|---|---|---|
| **CLAUDE.md 未登录访问 users 表红线** | 高 | 低 | preHandler: auth 强制 + Service 层断言 + verify-endpoint-adr 脚本核验 |
| **跨设备 last-write-wins 数据覆盖** | 中 | 低（缩窄 / R-165-3） | 顶层模块 PATCH 语义 → 跨模块零冲突 / 模块内 last-write-wins / Phase 4 评估加 updated_at + If-Match 头 |
| **debounce 500ms 内多次 PUT 排队** | 低 | 低 | 客户端 useRef 持有 timer / 新操作 clearTimeout 覆盖 / 仅最后一次 fire |
| **localStorage 与 server 不一致（旧设备 / 跨设备 stale）** | 低 | 中 | 每次 mount 第 2 阶段 GET / D-165-11 比对后单次受控 re-paint + 双 key localStorage 同步 |
| **JSONB 演进破坏旧客户端（R-165-4 修订）** | 高 → 低 | 低 | server 用 passthrough 持久化（旧客户端不删未知字段）/ 客户端 strict 类型层 / Phase 4 评估加版本字段 |
| **登录迁移协议覆盖 server 已有值** | 中 | 低 | D-165-5 明示：server 空时才迁移 / server 非空 → server 优先 |
| **PUT 整体替换误删未知字段** | 高 → **消除（R-165-3）** | — | **R-165-3 修订：PUT 改顶层模块 PATCH 语义 / undefined=不改 / null=删除 / 值=设置 / JSONB merge 保留其他模块** |
| **mount hydration mismatch / FOUC（R-165-2 新增）** | 中 | 中 | D-165-11 防御：第 1 阶段 localStorage 即时 + setSyncing disable 切换器 / 第 2 阶段 GET 完成后单次 re-paint + 解锁 |
| **多 tab 并发 PUT 时序竞态（Y-165-5 增补）** | 中 | 低 | 顶层 PATCH 语义跨模块零冲突 / 同模块 last-write-wins / Phase 4 评估 BroadcastChannel 跨 tab 协议 |
| **PUT 失败长期不一致 / 用户感知缺失（Y-165-7 增补）** | 中 | 中 | sessionStorage `lastSyncFailedAt` 时间戳 / 下次操作时 < 5 分钟 → 静默重试 / Phase 4 评估 sync status indicator |
| **admin 域 RBAC 副作用泄露其他用户 preferences（洞察 5 新增）** | 中 | 低 | 新 query 仅接受当前 userId / admin 域 listAdminUsers 不拉 preferences / 需求出现时独立 ADR 评估 |

### §11 实施拆卡建议（CHG-SN-9-ROUTE-LABEL-D-A / R-165-1 + Y-165-1 + Y-165-3 修订）

**R-165-1 修订**：新增独立 query 函数 `getUserPreferences(db, userId)` 仅 `SELECT preferences FROM users WHERE id = $1 AND deleted_at IS NULL`（不复用 findUserById 防 SELECT * 拉 JSONB 性能债）。`updateUserPreferences(db, userId, patch)` 接受顶层 PATCH 对象 + 用 `preferences || $1::jsonb` JSONB merge SQL。
**Y-165-1 修订**：拆 `useUserPreferencesSync(isLoggedIn, sectionKey, localValue, onRemoteValue)` 独立 hook / 负责 mount GET / debounce PUT / 错误降级。`useRouteTheme` 仅调用此 hook 接口 / 不感知网络层（与 ADR-037 BrandProvider + useBrand/useTheme 双 hook 拆分范式对称）。
**Y-165-3 修订**：CUSTOM_THEME_CONSTRAINTS 迁移到 packages/types/src/user.types.ts（共享层）/ web-next/lib/route-theme-storage.ts 改 import 路径（防双真源）。

**实施期范围（拟拆 -A1 后端 / -A2 前端 / 各 ≤ 5 PATCH）**：

**CHG-SN-9-ROUTE-LABEL-D-A1（后端数据 + 路由 / PATCH≤5）**：
1. **Migration 080**：users.preferences JSONB inline CHECK（与 077 范式对齐）
2. **packages/types/src/user.types.ts**（扩既有）：CUSTOM_THEME_CONSTRAINTS（迁移）+ CustomThemeDataSchema + RouteThemePreferenceSchema + UserPreferencesSchema (passthrough) + UserPreferencesStrictSchema + 类型导出 + User interface 加 preferences?: UserPreferences
3. **apps/api/src/db/queries/userPreferences.ts** NEW：getUserPreferences + updateUserPreferences（独立 query 文件 / 不污染 users.ts）
4. **apps/api/src/services/UserPreferencesService.ts** NEW：业务层 zod 校验 + 调 queries
5. **apps/api/src/routes/users.ts** + 测试：扩 2 端点（GET / PUT `/users/me/preferences`）+ 单元测试

**CHG-SN-9-ROUTE-LABEL-D-A2（前端集成 / PATCH≤5）**：
1. **apps/web-next/src/lib/use-user-preferences-sync.ts** NEW（Y-165-1 / 独立 hook）：mount GET + debounce PUT + 错误降级 + sessionStorage lastSyncFailedAt
2. **apps/web-next/src/lib/route-theme-storage.ts** 改造：useRouteTheme 调用 useUserPreferencesSync / CUSTOM_THEME_CONSTRAINTS import packages/types（Y-165-3 / 删本地常量）
3. **apps/web-next/src/components/player/RouteThemeSelector.tsx**：syncing 状态 disable 切换器（R-165-2 / D-165-11）
4. **tests/unit/web-next/use-user-preferences-sync.test.ts** NEW：hook 行为测试
5. **docs/manual/route-labeling.md** §8.4a + §8.7 升级"未实装" → "已 ship Wave 3 / 跨设备同步协议详 ADR-165 §7"

### §12 评审矩阵预填（待 arch-reviewer Opus 评审）

| 维度 | 自审结论（待 Opus 复核） |
|---|---|
| **命名** | preferences vs userPreferences vs settings / routeTheme 嵌套 vs 扁平 / 路径 /users/me/preferences vs /user/preferences |
| **对称性** | 与 ADR-159 / -163 / -164 JSONB 字段范式对齐 / 与 ADR-012 users 路径前缀对齐 |
| **状态职责** | 同步协议 client-driven vs server-driven / debounce 时机 / 迁移协议幂等性 |
| **扩展性** | strict() vs passthrough() / Phase 4 版本控制 / 跨用户分享预留 |
| **安全** | preHandler auth 强制 / PII 评估 / JSONB CHECK / zod strict |

### §13 结论（Opus 评审后修订）

ADR-165 status 🟢 **Accepted**（2026-05-28 / arch-reviewer Opus A- CONDITIONAL 1 轮独立评审 → 主循环消化全部 5 红线 R-165-1/-2/-3/-4/-5 + 4 P1 黄线 Y-165-1/-2/-3/-4 + 洞察 1 Phase 编号 + 洞察 5 admin 域 RBAC 副作用 = 等同 A-）。

**核心契约**：
- `users.preferences` JSONB inline CHECK（Migration 080 / R-165-5 与 077 范式对齐）
- 2 端点 GET / PUT `/users/me/preferences`（preHandler auth 强制 / 顶层模块 PATCH 语义 R-165-3）
- mount 双阶段同步协议 + setSyncing disable 切换器 防 FOUC（R-165-2 / D-165-11）
- server passthrough + 客户端 strict 双 zod schema（R-165-4 / 防演进期未知字段误删）
- 独立 query 函数 getUserPreferences / updateUserPreferences（R-165-1 / 不复用 findUserById SELECT *）
- useUserPreferencesSync 独立 hook 与 useRouteTheme 拆分（Y-165-1 / 与 ADR-037 范式对称）
- CUSTOM_THEME_CONSTRAINTS 真源迁移 packages/types（Y-165-3 / 防双真源）

**实施承接**：CHG-SN-9-ROUTE-LABEL-D-A1（后端 / PATCH≤5）+ CHG-SN-9-ROUTE-LABEL-D-A2（前端 / PATCH≤5）2 子卡 / 共 10 文件改动。

**11 风险**：CLAUDE.md "未登录访问 users 表" 红线 / 跨设备 last-write-wins / debounce / localStorage stale / 演进期破坏 / 登录迁移覆盖 / PUT 误删未知字段（消除）/ FOUC（新）/ 多 tab race（新）/ PUT 失败长期不一致（新）/ admin 域 RBAC 副作用（新）= 全部对策。

**Opus 评审 7 P2/P3 黄线**（Y-165-5/-6/-7 + 洞察 4 / 跨用户分享）：本 ADR 已落 Y-165-5/-6/-7（§7/§10）/ 洞察 4 跨用户分享独立 schema 预留（§2 范围外明示"分享场景必须独立 schema 不得通过 preferences 间接实现"），未塞冗余设计 / 留 Phase 4 / Phase 5 演进。

**0 红线 / 0 P1 黄线 / 0 关键洞察 遗留** → 升 Accepted / 实施期开始。

---

## ADR-166 — RETRY-CONTROL：player-core onError 扩 PlayerErrorControls + retry 命令面（CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL / Wave 4 #4）

> status: 🟢 Accepted
> created: 2026-05-28
> related: ADR-N（onError public API / Wave 3 #7 / CHG-SN-9-PLAYER-ERROR 隐式契约）/ Wave 4 #2 CHG-SN-9-PLAYER-ERROR-CONSUMER-A（AdminPlayer 接入 onError）/ Wave 4 #3 CHG-SN-9-PLAYER-ERROR-CONSUMER-B（PlayerShell 接入 onError + 自动切线）
> evaluator: arch-reviewer (claude-opus-4-7) — 1 轮独立评审 / A- CONDITIONAL / 3 红线 R-166-1/-2/-3 + 6 黄线 Y-166-1/-2/-3/-4/-5/-6 + 主循环消化建议
> implementor: 主循环 (claude-opus-4-7) + 后续 -EP 实施卡 (claude-sonnet-4-6)

### §1 背景

Wave 3 #7 (CHG-SN-9-PLAYER-ERROR) ship 了 player-core `onError` public API + `suppressDefaultErrorUI` 抑制默认 overlay，让消费方接管错误 UI。Wave 4 #2/#3 完成消费方接入：AdminPlayer POST feedback 上报失败 / PlayerShell "标 dead + 自动切下一线路"。

但 player-core 内部 `retrySourceLoad`（packages/player-core/src/hooks/useSourceLoader.ts:172-184）**外部消费方无法程序化触发**：PlayerOverlays.tsx:196 默认 Retry 按钮是唯一入口；当消费方设 `suppressDefaultErrorUI=true` 接管 UI 时，重试能力消失。

**业务诉求**：
- AdminPlayer：审核员"重试此线路"按钮（断网恢复后用）
- PlayerShell：自动切下一线路前先尝试 1 次本地 retry（hls.js fragment 偶发失败常见 / 不必立即标 dead）

### §2 候选方案与评估

#### 方案 A（推荐）— onError(event, controls)：扩 onError 签名注入命令面

消费方写法：
```tsx
<Player onError={(event, { retry }) => {
  if (canRetryLocally(event)) retry();
  else autoSwitchLine();
}} />
```

#### 方案 B（否决）— useImperativeHandle：Player 暴露 ref API

```tsx
const playerRef = useRef<PlayerHandle>(null);
<Player ref={playerRef} onError={(event) => {
  if (canRetryLocally(event)) playerRef.current?.retry();
}} />
```

#### 评估对比表（arch-reviewer 8 维度）

| 维度 | 方案 A | 方案 B | 说明 |
|---|---|---|---|
| 1. 类型契约清晰度 | **+** | 0 | A: "重试只能在 onError 上下文触发"在签名上自证；B: retry 句柄全生命周期裸露 |
| 2. 扩展性 | + | **+** | 平手 / A 受错误恢复语义约束、B 易过度暴露 core 内部 |
| 3. React 范式正交性 | **+** | − | A: 单向数据流；B: 引入命令式入口，破坏既有范式 |
| 4. player-core 内部一致性 | **+** | − | A 与 onPlay/onPause/onTheaterChange 同构；B 唯一一处 ref API 污染 mental model |
| 5. time-to-impact 时序 | **+** | − | A: 同 tick 同步可调；B: 经 ref commit + effect 异步，stale closure 风险 |
| 6. 消费方实现复杂度 | **+** | 0 | A: AdminPlayer 0 行额外 / PlayerShell +1 if；B: 两端 +useRef + forwardRef |
| 7. 测试可达性 | **+** | 0 | A: vi.fn() 捕获 controls 即可；B: 必须 mount + act + ref |
| 8. 未来废弃迁移 | 0 | − | A: 加 controls 字段为非破坏性；B: 移除 ref API 是 SemVer major |

**A 完胜 6 项 / 平手 2 项 / 输 0 项。** 选 A（收敛版 A'）。

#### 关键否决依据

1. **player-core 范式一致性压倒一切**：core 当前 7 个 public 回调全部声明式 / 零 ref。一旦引入 useImperativeHandle 就开了"core 暴露命令式入口"的口子，与 CLAUDE.md "core 层不写业务逻辑、shell 层负责编排"边界耦合度上升一个量级。
2. **time-to-impact 时序对断网恢复是 first-class 需求**：onError 触发瞬间消费方拿到 retry 同步句柄；ref 路径在 React commit-after-render 时序窗口 + `useImperativeHandle` deps 切源瞬间有 stale closure 风险。
3. **API 扩展性悖论翻转**：player-core 的扩展方向是错误**事件细分**（hls_manifest_failed / hls_fragment_failed / stall_recovered）而非命令面铺开（pause/seek 等消费方可直接绕 core）。把命令面绑死在 onError 的 controls 上是**作用域极小化的扩展**。

### §3 决策摘要

CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL 在 player-core 现有 `onError(event)` 单参签名基础上**非破坏性扩**为 `onError(event, controls)` 双参，`controls` 是冻结的最小命令面，仅包含 `retry(): void`。消费方（AdminPlayer / PlayerShell）通过 controls 在错误事件回调内程序化触发当前 source 的重新加载（hls.startLoad / video.load），不切源、不破坏 React 单向数据流、与 player-core 既有 7 个声明式回调范式同构。**否决方案 B（useImperativeHandle）**。

### §4 API 契约（最终类型定义）

```ts
// packages/player-core/src/types.ts

/**
 * 错误恢复命令面（ADR-166 / Wave 4 #4 / arch-reviewer Opus 评审）。
 * 仅在 onError 回调第 2 参提供；生命周期与本次 onError 调用同 tick。
 * 对象被 Object.freeze；消费方不得修改其字段（Y-166-1）。
 */
export interface PlayerErrorControls {
  /**
   * 重新加载触发此次错误的 source（hls.startLoad(-1) / video.load()）。
   *
   * 时序合法性（R-166-2 守卫）：
   *   - 合法：在 onError 回调体内同步调用 = 必然作用于触发错误的 src
   *   - 可能 no-op：onError 内 await xxx 跨 tick 再调 retry()，若 props.src 已变（消费方已切线）
   *     则 retry 静默忽略 + dev console.warn（防作用于新 src 的语义污染）
   *   - 非法时机：onError 回调返回后保留 controls 引用继续调用 / setTimeout 内调用 = 同上 no-op
   *
   * 失败再次触发 onError（Y-166-4）：retry 后若再次 fatal，onError 会再次调用并携带新 controls 实例；
   * 消费方需自行计数防死循环（建议 ≤ 1 次本地 retry 后切线 / 见 -EP 实施卡 PlayerShell）。
   *
   * 签名约束（R-166-3 fire-and-forget）：返回 void / 不抛错 / 不返回 Promise。
   */
  readonly retry: () => void;
}

// PlayerProps.onError 签名扩展（非破坏性 / 消费方不解构第 2 参完全向后兼容）
onError?: (event: PlayerErrorEvent, controls: PlayerErrorControls) => void;
```

### §5 触发时序（合法 vs 非法 / 双层守卫 / Codex stop-time review FIX-1 修订）

**合法时机**：
- onError 回调体内**同步**调用 `controls.retry()`
- onError 回调体内同步调用 `setState` 后**同 tick** 调用 `controls.retry()`

**非法时机（player-core 防御为 no-op + dev warn）**：
- `await fetch(...).then(() => controls.retry())` — await 跨 tick 后调用
- 把 `controls` 存进外部 ref，onError 返回后再调用（**Codex stop-time review 命中**：仅靠 srcRef 守卫不够 / src 未变时此路径会绕过初版单层守卫破缺契约）
- onError 回调内 `setTimeout` 后调用
- async onError 函数返回 Promise 那一刻起 controls 进入冻结期

**防御实现 — 双层守卫**（Player.tsx wrappedOnErrorRef.current 闭包）：

1. **第 1 层：active 标志**（FIX-1 新增 / 主守卫）
   - `let active = true` 在 controls 构造前声明
   - `try { onError?.(event, controls); } finally { active = false; }` 同步窗口结束后立即关闭
   - retry 调用首先检查 `if (!active) → no-op + dev warn`
   - 覆盖**所有** onError 同步窗口外调用（async / setTimeout / 外部 ref / Promise 链）

2. **第 2 层：srcRef.current !== snapshotSrc 比对**（保留 / 兜底）
   - `srcRef.current` 实时反映 props.src（useEffect 同步）
   - `snapshotSrc = event.src` 闭包捕获
   - 覆盖极少数"onError 同步窗口内 setState 切 src 后调 retry"的同 tick 边界

**为何需要双层而非单层 srcRef 守卫**：初版仅靠 srcRef 守卫无法识别"消费方持有 controls 外溢调用 + src 未变"这一**合法路径但语义违约**的场景。active 标志在 onError 返回的瞬间收紧契约边界，无论 src 是否变化都拒绝调用，符合 ADR-166 §5 "controls 生命周期与本次 onError 同步调用同 tick" 的契约本意。

### §6 实施落地（本 ADR 含 -ADR 子卡完成）

#### 6.1 修改文件（4 项 ≤ 5 ✅）

| 文件 | 修改 |
|---|---|
| `packages/player-core/src/types.ts` | + `PlayerErrorControls` interface（含 R-166-1/-2/-3 + Y-166-1/-4/-5 全文 jsdoc）；改 `PlayerProps.onError` 签名为 `(event, controls) => void` + 长 jsdoc |
| `packages/player-core/src/Player.tsx` | + srcRef + retryAttemptRef（src 变化重置 / Y-166-2）+ retrySourceLoadRef + wrappedOnErrorRef + wrappedOnErrorStub useCallback；在 orch 解构后 useEffect 同步 retrySourceLoadRef 和 wrappedOnErrorRef.current（构造 frozen controls + snapshotSrc 守卫 + data-retry-attempt setAttribute + 转发到外部 onError）；line 275 原生 onError 改调 wrappedOnErrorStub |
| `packages/player-core/src/hooks/useSourceLoader.ts` | **不动**（HLS fatal 处 onError?({code:'hls_fatal',...}) 自动走 wrappedOnError stub / OrchestrationProps.onError 签名保持单参 → useSourceLoader.ts 类型签名零改动）|
| `packages/player-core/src/Player/usePlayerOrchestration.ts` | **不动**（同上 / wrap 策略保留 OrchestrationProps 旧签名 / 边界最小化）|
| `tests/unit/components/player/retry-control.test.tsx` | NEW / 5 case 覆盖 R-166-2/3 + Y-166-2 |
| `docs/decisions.md` | + ADR-166（本段）|

#### 6.2 单测覆盖（≥ 5 case / -ADR 子卡范围）

1. **#1 同步合法 retry**：触发 native onError → 断言 controls 是 frozen 对象 + 调用 retry 触发 retrySourceLoad（video.load 被调）
2. **#2 异步 retry 守卫**：触发 onError，回调内 await Promise.resolve 后调 retry → 断言 dev `console.warn` + retrySourceLoad **不**被调（R-166-2）
3. **#3 同 tick setState 切 src 后 retry**：onError 内 setState 切 src='B' 同 tick 调 retry → 断言守卫触发 no-op（R-166-2 边界）
4. **#4 连续 fatal 拿新 controls 实例**：第一次 retry → 第二次 onError 携带**新**控制对象（不复用旧引用 / 不共享冻结状态）
5. **#5 data-retry-attempt 计数**：0 → retry 1 次 → 1 → retry 2 次 → 2 / src 变化后重置为 0（Y-166-2 / src 变化 video 上属性被清除或重置）

#### 6.3 commit trailer 要求（本 -ADR 子卡 + -EP 实施卡均含）

```
Subagents: arch-reviewer (claude-opus-4-7)
ADR: ADR-166
```

#### 6.4 -EP 实施卡承接（不在本 ADR 范围）

- **AdminPlayer**（CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP）：手动重试按钮**不**用 controls.retry（生命周期边界 / Y-166-6）→ 改用 `key={sourceId}` bump 强制 Player remount 重载 source。controls.retry 仅服务"onError 回调内同步决策"语义。
- **PlayerShell**（同上 -EP 卡）：handlePlayerError 首次 fatal 调 `controls.retry()` 跳过切线 + retryAttemptRef per-sourceIdx 计数（≤ 1 次本地 retry / 第二次 fatal 才走 "标 dead + 环形切线"路径）+ 3s 超时 watchdog（Y-166-3 shell 层约束）。
- 测试更新：admin-player.test.tsx + player-shell-on-error.test.tsx（mock Player onError 第 2 参 controls）。

### §7 不在范围内（明确边界 / 留 follow-up）

- ❌ **pause / seekTo / setVolume 等命令式 API**：本 ADR 仅暴露错误恢复语义；其它命令式入口需独立 ADR。
- ❌ **PlayerShell 自动 retry 策略本身**（次数 / 超时 / 与切线优先级）：属 shell 层职责，由 -EP 实施卡承接，不写进 ADR-166 契约。
- ❌ **默认 overlay retry 按钮的废弃**：保持现状（PlayerOverlays.tsx:196）/ 与 controls.retry 同源底层但 UI 共存（Y-166-5 jsdoc 注明）。
- ❌ **PlayerErrorEvent / PlayerErrorCode 的扩成员**：未来 hls_manifest_failed / hls_fragment_failed 加入是另一个 ADR。
- ❌ **顶层 `index.ts` re-export `PlayerErrorControls` / `PlayerErrorEvent`**：保持当前"通过 `PlayerProps['onError']` 反推参数类型"范式（AdminPlayer / PlayerShell 已采用），减少公共 API 表面。

### §8 红线（R-166-N）— 已全部消化

- **R-166-1**：`controls` 不得含 `suppressDefault()`，仅保留 `retry()` — 已存在 `suppressDefaultErrorUI` prop 静态等价能力。**消化**：草案 API 仅 retry: void。
- **R-166-2**：`retry()` 必须捕获快照 src + 调用时比对守卫（异步调用 + 切线场景）。**消化**：wrappedOnError 闭包 srcRef + snapshotSrc 守卫 + dev warn。
- **R-166-3**：`retry()` 必须是 fire-and-forget（void / no Promise / no throw）。**消化**：jsdoc 明示 + retrySourceLoad 本身 void。

### §9 黄线（Y-166-N）— P1 黄线已落地 / P2-P3 留 -EP 卡

- **Y-166-1**：controls 必须 Object.freeze 防 monkey-patch。**消化**：wrappedOnError 构造时 `Object.freeze({ retry })`。
- **Y-166-2**：retry 调用有可观测信号 — data-retry-attempt 计数。**消化**：retryAttemptRef + setAttribute；src 变化 useEffect 重置 0。
- **Y-166-3**：PlayerShell "先 retry 后切线"双倍 loading 时长风险 — 需 retry 超时上限。**留 -EP 卡**：shell 层 3s watchdog。
- **Y-166-4**：retry 失败仍触发 onError。**消化**：types.ts jsdoc 显式声明 + 消费方计数防死循环建议。
- **Y-166-5**：默认 overlay retry 按钮 + controls.retry 共存。**消化**：jsdoc 注明同源底层 / 调一次即可。
- **Y-166-6**：AdminPlayer 手动重试 ≠ controls.retry（生命周期边界）。**留 -EP 卡**：AdminPlayer 用 key bump remount。

### §10 评级 + AUDIT RESULT

**评级：A- CONDITIONAL → 主循环消化全部 3 红线 R-166-1/-2/-3 + 5 P1 黄线 Y-166-1/-2/-4/-5（Y-166-3/6 留 -EP 卡明示）= 等同 A-**

**AUDIT RESULT: PASS（草案吸收红线 / 实施 4 文件 ≤ 5 / -EP 实施卡不再需 Opus 二次评审）**

### §11 与 CLAUDE.md 模型路由规则对齐

确认本决策属"强制升 Opus 子代理 第 4 项：重构播放器 core / shell 层的接口"。`PlayerProps.onError` 是 player-core 公共 API 表面字段，签名变更属重构 core 层接口。

**起独立 ADR-166 必要性**：
1. 影响 player-core 公共 API 签名（即便非破坏性），是契约层级演进，与 ADR-165 + 隐式 onError ADR 同等量级。
2. 引入"命令面 vs 事件面" trade-off 决策点（否决方案 B），未来若有人再提议 "Player 暴露 ref handle"，需要本 ADR 作为否决先例锚点。
3. R-166-2（异步守卫）+ R-166-3（fire-and-forget 约束）+ Y-166-6（AdminPlayer 用例边界）属于不写进 ADR 就一定有人踩的隐式约束，必须落档。

**双卡范式（同 ADR-163/164/165）**：先 -ADR 子卡 ship 草案 + player-core 落地 + 单测；再 -EP 实施卡 ship 消费方接入（AdminPlayer + PlayerShell + 测试更新）。

### §12 结论

ADR-166 status 🟢 **Accepted**（2026-05-28 / arch-reviewer Opus A- CONDITIONAL 1 轮独立评审 → 主循环消化全部 3 红线 + 5 P1 黄线 / Y-166-3/-6 -EP 实施卡承接 = 等同 A-）。

**核心契约**：
- player-core `onError(event, controls)` 双参签名（非破坏性扩 / 消费方旧解构兼容）
- `PlayerErrorControls = { retry: () => void }` frozen 单方法命令面（R-166-1）
- snapshotSrc 闭包守卫 + 调用时刻 srcRef 比对 → 异步/切线后调用 no-op + dev warn（R-166-2）
- fire-and-forget 约束（R-166-3 / void / no Promise / no throw）
- data-retry-attempt 计数 per-mount-cycle / src 变化重置 0（Y-166-2 可观测信号）
- 默认 overlay Retry 按钮与 controls.retry 同源 retrySourceLoad（Y-166-5 共存）
- retry 失败再次触发 onError 含新 controls 实例（Y-166-4 防死循环）

**实施承接**：
- 本 -ADR 子卡：types.ts + Player.tsx + decisions.md + retry-control.test.tsx 4 文件 ≤ 5
- -EP 实施卡（CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL-EP / sonnet-4-6 / 不再需 Opus）：AdminPlayer key-bump remount + PlayerShell retry watchdog 3s + 测试更新（Y-166-3 + Y-166-6）

**0 红线 / 5 P1 黄线已落 / 1 P2 黄线 + 1 边界澄清 留 -EP** → 升 Accepted / -ADR 子卡 ship / -EP 实施卡进入 task-queue。

---

## ADR-161：Bangumi.tv REST API + GitHub 归档 dump 集成协议（SEQ-BANGUMI-01 / Track bangumi）

- **日期**：2026-05-27
- **状态**：**Accepted**（arch-reviewer claude-opus-4-7 × 1 轮 CONDITIONAL：红线 R1（bangumi_entries 重复列 total_episodes）+ R2（step3 写 videos.episode_count 路径断裂）+ 黄线 Y1–Y5 + advisory A1–A4，全部已在本 ADR 内消化修订）
- **决策者**：主循环 claude-opus-4-7 / arch-reviewer (claude-opus-4-7) × 1 轮
- **关联**：ADR-110（ApiResponse 信封 + ErrorCode 真源，本 ADR 零新增错误码）/ ADR-117（admin API 协议同模式：端点契约 + 分级鉴权 + Service 强制）/ CHG-385（MetadataEnrichService 五步 + douban dump 范式）/ META-05/06/09（video_external_refs + media_catalog 扩展 + provenance/locks）/ ADR-114-NEGATED（catalog 不跨源强合并，本 ADR 占位失配同源理由）
- **执行真源**：`~/.claude/plans/bangumi-tv-bangumi-https-bangumi-tv-dev-enumerated-cosmos.md`（已批准）
- **触发**：动漫元数据现状缺口 —— `MetadataEnrichService.step3Bangumi` 仅按 title_norm 取第一条、只写 3 字段、无置信度/候选/external_ref；无 Bangumi REST 客户端，已申请 Access Token 未用；dump 导入丢失 episode_count/cover_url；无逐集表。本 ADR 固化 Bangumi 接入协议（含新增 5 admin 端点 + migration 077 + 优先级调整），满足 plan §4.5 R7 MUST-8「新增 admin route 先起 ADR」硬约束。

### 背景

Bangumi.tv（番组计划）是动漫领域权威数据源，相比豆瓣提供：中日双标题（`name`/`name_cn`）、infobox 结构化制作信息（导演/脚本/音乐/声优/动画制作/放送星期）、逐集放送数据（episodes：sort/ep/airdate/duration）、评分排名（`rating.rank`）、标签（`tags`）、平台（TV/剧场版/OVA/WEB）。官方提供 v0 REST API（Bearer Token 鉴权）+ GitHub 不定期公共归档 dump。

项目已埋半成品基建但未用上 Token：`media_catalog.bangumi_subject_id`（Migration 026）、`external_data.bangumi_entries`（Migration 036）、`scripts/import-bangumi-dump.ts`（仅 type=2，约 1 万条）、`MetadataEnrichService.step3Bangumi`（极简）、`video_external_refs` 已支持 `provider='bangumi'`、`MediaCatalogService.findOrCreate` Step4 已按 bangumiId 匹配。

### 决策要点

1. **数据来源分工（dump 索引 + API 详情）**：GitHub 归档 dump 导入 `external_data.bangumi_entries` 做**全量本地匹配索引**（毫秒级、无限流）；命中后调 REST API 拉**按需 rich 详情**（subject + 逐集）写 `media_catalog` + `catalog_episodes`。批量场景（反向建库）只走本地 dump，不打 API，规避官方限流。

2. **anime 下 Bangumi 优先于豆瓣**：`CATALOG_SOURCE_PRIORITY.bangumi` 由 `3` 提升至 `4`（高于 `douban:3`、与 `tmdb:4` 同级、低于 `manual:5`）。理由：bangumi 来源仅对 anime 写入（step3 与占位均 anime-only），全局提级即等价于「anime 下 Bangumi 优先」，无需按类型分支。`enrich()` 中豆瓣 Step1/2 先跑、Bangumi 后跑，提级后 Bangumi 可覆盖重叠字段，后续豆瓣自动匹配（3<4）被 `safeUpdate` 拦截；manual（5）编辑仍最高优先且自动加 locked_fields，不被 Bangumi 覆盖。非 anime 完全不受影响。

   **同级覆盖语义（Y1）**：`safeUpdate` 仅在 `incomingPriority < currentPriority` 时跳过，同级（`==`）允许覆盖（后写赢）。bangumi 与 tmdb 同为 4，若 anime 同时被 tmdb 与 bangumi 写入则后写者覆盖前者。当前 enrich 主链路无 tmdb 自动写入（仅 douban+bangumi），故无实际争用；若未来引入 tmdb anime 自动写入，需重新评估 bangumi vs tmdb 字段仲裁。

3. **匹配置信度复用豆瓣范式**：本地 dump 召回后复用 `MetadataEnrichService.computeLocalDoubanConfidence` 同款阈值（≥0.85 auto_matched 写 catalog；[0.60,0.85) candidate 仅写 refs；<0.60 丢弃）。auto_matched 与 candidate 均写 `video_external_refs(provider='bangumi')`（复用 `upsertVideoExternalRef`）。

   **人工确认（端点 3 bangumi-confirm）的 source 语义（Y2）**：confirm 用 `source='bangumi'` 写 catalog（**非 manual**，与 `DoubanService` confirm 用 'douban' 源一致），不触发 locked_fields 自动加锁；人工确认状态记在 `video_external_refs.match_status='manual_confirmed'`。理由：保持「真正的人工权威路径是 manual 编辑（会加锁）」与「确认外部匹配（提级 ref + 拉详情）」两件事分离，避免 confirm 即冻结字段、与 douban-confirm 行为分裂。故端点 3 不返回 skippedFields（bangumi 源 + 字段未锁时为空）。

4. **Service 层强制（CLAUDE.md 后端分层红线）**：所有端点经 `BangumiService` / `BangumiSeedService`，不在 Route 直连 db/queries。HTTP 细节封装于 `apps/api/src/lib/bangumi.ts`（对标 `lib/douban.ts`：Bearer Token + 描述性 UA + 超时 + 错误降级返回 null/[]，不抛）。infobox 解析归 `BangumiService.utils.ts`（对标 `DoubanService.utils.ts`）。

5. **响应包络 + 错误码零新增（对齐 ADR-110）**：复用既有错误码 `VALIDATION_ERROR 422` / `NOT_FOUND 404` / `FORBIDDEN 403` / `UNAUTHORIZED 401` / `INTERNAL_ERROR 500`。Bangumi 搜索/抓取失败（网络/限流/无候选）**不作错误码**，沿用 `DoubanService.syncVideo` 的 `{ updated: false, reason }` 结果模型，端点返回 200 + `{ data: { updated, reason } }`，由前端区分语义（与既有 douban-sync 端点一致）。

6. **逐集表 catalog_episodes（按 catalog_id 设计）**：逐集元数据按 `catalog_id` 而非 bangumi_id 建表，附 `source` 列，便于将来 TMDB 等同样写入；与 media_catalog（作品元数据层）同源归属。唯一约束 `(catalog_id, source, external_episode_id)`。

   **step3 签名 + episode_count 写入路径（R2）**：`step3Bangumi` 重写后签名扩为 `(videoId, catalogId, titleNorm, year)`——`enrich()` 在 `MetadataEnrichService.ts:87` 调用处已持有 `videoId`，同步传入。`videos.episode_count` 的写入**不复用** `VideoService.update`（那是 manual 源人工编辑路径，会触发字段锁，语义不符），而是经新增的 `videosQueries.updateEpisodeCount(db, videoId, n)` 轻量 query 写入（source-neutral，仅当 Bangumi `total_episodes/eps` 有值且当前 episode_count 缺省/为 0 时回填），不越层、不破坏分层。**「VideoService.update 改类型触发」是独立机制**（决策要点见下方端点 1 + Phase 1-D：改类型为 anime 时 `enqueueEnrichJob`），与 episode_count 写入无关，两者不可混淆。

7. **反向建库 = 无源占位条目**：`BangumiSeedService.seedPlaceholders` 遍历 `bangumi_entries`（按 rank/year 过滤）→ `MediaCatalogService.findOrCreate({ ..., type:'anime', bangumiSubjectId, metadataSource:'bangumi' })` 仅建 `media_catalog`（无 videos 行）。后续 `CrawlerService.upsertVideo` 的 findOrCreate 按 `title_normalized+year+type` 命中占位 catalog 自动 link，crawler（优先级1）不污染 bangumi（优先级4）字段。**挂接逻辑零改动**。

   **占位 type 固定为 'anime'（Y4）**：dump 全为 type=2 动画，占位 catalog 的 `type` 一律写 `'anime'`，与 step3/seed anime-only 自洽。

   **nsfw 处置（Y5，CHG-BNG 审阅修订 2026-05-27）**：经语义核对，Bangumi `nsfw`（R18 粗粒度，含强 ecchi/猎奇/暴力等非色情内容）与项目 `content_rating='adult'`（`ADULT_CATEGORIES` 露骨色情，且联动 `visibility_status='hidden'`，属治理字段）**不等同**。故：
   - **不自动映射 `nsfw → content_rating`**（避免误隐藏 + 越权写治理字段）；`content_rating` 仍由现有审核流 / 采集 source_category 路径决定。
   - nsfw 仅作**信息信号**：存 `bangumi_entries.nsfw`，后台候选/缺口视图给审核员标记，由人工决定是否调整治理状态。
   - seed 仍**默认跳过 `nsfw=true` 条目**（不自动建色情占位，可经 seed 参数显式放开，本期不放）。

   **唯一约束 + 并发 + findOrCreate retry（Y5）**：依赖 `media_catalog.bangumi_subject_id` UNIQUE（Migration 026）。`MediaCatalogService.findOrCreate` 现有 retry 分支（`MediaCatalogService.ts:133-142`）**缺 bangumiSubjectId 一路**——若 INSERT 因 bangumi_subject_id 唯一冲突被 ON CONFLICT 跳过，retry 查不回来会抛错。CHG-BNG-07 实现时**必须给 retry 补 `findCatalogByBangumiId` 分支**（与 Step4 对称），保证并发 seed + enrich step3 写同一 subject 时幂等收敛。

   **BangumiEntryMatch 扩展 + seed 查询（Y3）**：`externalData.ts` 的 `BangumiEntryMatch`（:38-46）需扩 `coverUrl/rank/nsfw`（供端点 2 候选 + 端点 5 缺口展示）；新增按 rank/year 范围的 seed 查询函数（供 `BangumiSeedService` 消费，Service 不直接拼 SQL）。

8. **已知限制（D-161-1）**：占位挂接失配 → 采集另建 catalog（产生重复）。失配成因有二：(a) Bangumi 标题（中/日）与采集源中文发行名 `title_normalized` 不一致；(b) type 三元组不等（如某番剧场版被 crawler 识别为 `'movie'` 而占位为 `'anime'`，Y4 补充）。这是 best-effort，符合 ADR-114-NEGATED「不跨源强合并」精神。后续可由 video 上 step3（bangumiId 命中）辅助归并；catalog 去重合并不在本期范围。

9. **Token 缺失降级（A3）**：`BANGUMI_API_TOKEN` 未配置时，REST 详情链路（端点 1/2/3 的 rich 抓取）走 `null` 降级、仅本地 dump 索引可用（seed/gaps 不受影响）；端点 1 返回 `{ updated:false, reason:'token_missing' }`，不静默 500。infobox 解析失败的字段降级为 undefined 不写、不抛、不写空串（A2），与 `lib/bangumi.ts` 降级哲学一致。

10. **每日放送（calendar）暂缓**：本期数据深度 = 元数据 + 逐集表；前台「每日放送」展示页暂不做。数据层 `bangumi_entries.air_date` 已留出，后续接 `/calendar` API 时增量扩展，不影响本 ADR 协议。

### 端点契约

| # | 方法 | 路径 | 用途 | Request | Response | 鉴权 | 错误码 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/admin/videos/:id/bangumi-sync` | 对单视频触发 Bangumi 匹配 + rich 详情 + 逐集补全（对标 douban-sync） | Path: `id: uuid` | 200 `{ data: { updated: boolean, reason?: string, bangumiSubjectId?: number, episodes?: number } }` | moderator+admin | 422 VALIDATION_ERROR / 404 NOT_FOUND（video 不存在） |
| 2 | GET | `/admin/videos/:id/bangumi-candidates` | 搜索 Bangumi 候选（人工挑选用，对标 douban-preview） | Path: `id: uuid`；Query: `keyword?: string(1..200)` | 200 `{ data: { candidates: BangumiCandidate[] } }` | moderator+admin | 422 VALIDATION_ERROR / 404 NOT_FOUND |
| 3 | POST | `/admin/videos/:id/bangumi-confirm` | 人工确认指定 subject 匹配（bangumi 源写 catalog + manual_confirmed ref，Y2） | Path: `id: uuid`；Body: `{ bangumiSubjectId: number }` | 200 `{ data: { updated: boolean, bangumiSubjectId: number } }` | moderator+admin | 422 VALIDATION_ERROR / 404 NOT_FOUND |
| 4 | POST | `/admin/bangumi/seed` | 批量建无源占位条目（反向建库） | Body: `{ minRank?: number, year?: number, limit?: number(1..1000) }` | 200 `{ data: { created: number, matched: number, scanned: number } }` | **admin only** | 422 VALIDATION_ERROR |
| 5 | GET | `/admin/bangumi/gaps` | 缺口清单（有 bangumi_subject_id 但无 published video 的 catalog） | Query: `page?=1` / `limit?=20(1..100)` | 200 `{ data: BangumiGapRow[], total, page, limit }` | moderator+admin | 422 VALIDATION_ERROR |

**类型契约（packages/types/src/ 扩展，CHG-BNG-08 落地）**：

```ts
export interface BangumiCandidate {
  readonly bangumiSubjectId: number
  readonly nameCn: string | null
  readonly nameJp: string | null
  readonly year: number | null
  readonly rating: number | null
  readonly coverUrl: string | null
  readonly confidence: number          // 0..1（本地 dump 召回时）
}

export interface BangumiGapRow {
  readonly catalogId: string
  readonly bangumiSubjectId: number
  readonly title: string
  readonly year: number | null
  readonly rank: number | null
  readonly coverUrl: string | null
}
```

**zod request schema（Service + Route 共享）**：

```ts
const VideoIdParamsSchema = z.object({ id: z.string().uuid() }).strict()
const BangumiCandidatesQuerySchema = z.object({ keyword: z.string().min(1).max(200).optional() }).strict()
const BangumiConfirmBodySchema = z.object({ bangumiSubjectId: z.number().int().positive() }).strict()
const BangumiSeedBodySchema = z.object({
  minRank: z.coerce.number().int().positive().optional(),
  year:    z.coerce.number().int().min(1900).max(2100).optional(),
  limit:   z.coerce.number().int().min(1).max(1000).default(200),
}).strict()
const BangumiGapsQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()
```

### 字段映射（Bangumi → media_catalog / catalog_episodes / videos）

| Bangumi subject 字段 | 目标 | 备注 |
|---|---|---|
| `name` | `media_catalog.title_original` | 原始（多为日文） |
| `name_cn`（回退 `name`） | `media_catalog.title` | 中文标准名 |
| `summary` | `media_catalog.description` | |
| `images.large` | `media_catalog.cover_url` | |
| `rating.score` | `media_catalog.rating` | 0..10 |
| `rating.total` | `media_catalog.rating_votes` | |
| `rating.rank` | `external_data.bangumi_entries.rank` | 排名（dump 侧，过滤用） |
| `tags[].name` | `media_catalog.tags` | |
| `date` | `media_catalog.release_date` + 派生 `year` | |
| `eps`（本篇数，非 total_episodes）| rich 侧（REST API getSubject）→ `videos.episode_count` 经 step3 专用 query（R2，见决策要点 6） | **P1 修订**：用 wiki `eps`（本篇）或 `getEpisodes` 中 `type===0` 计数，**不用 `total_episodes`**（含 SP/OP/ED 章节会高估用户侧剧集数）。archive subject dump 无 eps，dump 侧 `episode_count` 保持 null |
| `rank` | dump 侧 → `bangumi_entries.rank`（archive 顶层 `rank` 字段，实测存在） | seed 高分榜过滤用 |
| `nsfw` | dump 侧 → `bangumi_entries.nsfw`（archive 顶层 `nsfw`，实测存在）。**信息信号，不自动写 content_rating**（Y5 修订：nsfw 与项目"色情"定义不等同，治理字段不越权自动写） | seed 默认跳过 nsfw 条目；后台视图给审核员标记 |
| infobox 导演/脚本 | `media_catalog.director` / `writers` | utils 解析；解析失败返回 undefined 不写（A2） |
| infobox 声优 | `media_catalog.cast` | utils 解析 |
| infobox 动画制作公司 | `media_catalog.tags`（前缀 `制作:` 标注，A1） | 不新增列；不用 aliases（语义是别名非制作方） |
| episode `sort`/`ep`/`name`/`name_cn`/`airdate`/`duration_seconds`/`desc` | `catalog_episodes.*` | 逐集 upsert；`/v0/episodes` 分页拉全，单页 limit=100，最多 50 页防无界（A4） |

### Migration 077 schema（CHG-BNG-01 落地，本 ADR 锁定，需同步 docs/architecture.md）

```sql
-- 077_bangumi_metadata.sql（幂等 IF NOT EXISTS）

-- (a) 扩展本地匹配索引表（保持轻量，rich 字段不堆此）
-- R1 修订：不新增 total_episodes（与 036 既有 episode_count 重复）；复用 episode_count，
--          由 import-bangumi-dump.ts 回填 dump 的 eps/total_episodes 字段到 episode_count。
ALTER TABLE external_data.bangumi_entries
  ADD COLUMN IF NOT EXISTS rank INT,
  ADD COLUMN IF NOT EXISTS nsfw BOOLEAN NOT NULL DEFAULT false;

-- (b) 新建逐集元数据表（按 catalog_id 设计，附 source 便于将来扩源）
CREATE TABLE IF NOT EXISTS catalog_episodes (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id          UUID        NOT NULL REFERENCES media_catalog(id) ON DELETE CASCADE,
  source              TEXT        NOT NULL DEFAULT 'bangumi',
  external_episode_id TEXT,
  ep_type             SMALLINT    NOT NULL DEFAULT 0,   -- 0 本篇 / 1 SP / 2 OP / 3 ED
  sort                NUMERIC,
  ep                  INT,
  name                TEXT,
  name_cn             TEXT,
  airdate             DATE,
  duration_seconds    INT,
  description         TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_catalog_episodes_src_ext
  ON catalog_episodes (catalog_id, source, external_episode_id);
CREATE INDEX IF NOT EXISTS idx_catalog_episodes_catalog_type_sort
  ON catalog_episodes (catalog_id, ep_type, sort);
```

### 配置（CHG-BNG-02 落地，apps/api/src/lib/config.ts Zod 扩展）

```ts
BANGUMI_API_TOKEN:      z.string().optional(),
BANGUMI_API_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),
BANGUMI_USER_AGENT:     z.string().default('resovo/1.0 (https://github.com/...)'),  // Bangumi 要求描述性 UA
```

### 影响文件

- 新建：`apps/api/src/lib/bangumi.ts` / `services/BangumiService.ts` / `services/BangumiService.utils.ts` / `services/BangumiSeedService.ts` / `routes/admin/moderation.bangumi.ts` / `db/migrations/077_bangumi_metadata.sql`
- 修改：`services/MetadataEnrichService.ts`（step3 重写）/ `services/MediaCatalogService.ts`（优先级）/ `services/VideoService.ts`（改类型触发）/ `db/queries/externalData.ts` + `mediaCatalog.ts`（扩展）/ `lib/config.ts` / `.env.example` / `scripts/import-bangumi-dump.ts`
- 文档：`docs/architecture.md`（077 schema 同步）

### 偏离登记

- **D-161-1**：占位条目标题失配可能产生重复 catalog（见决策要点 8）。处置：accept（best-effort），不在本期闭环；未来归并卡触发条件 = 重复 catalog（同 bangumi_subject_id 多条 / 同名多条）> 5% 时起 PRE-MERGE-CATALOG 卡。

---

## ADR-170：videos.bangumi_status 列 + BangumiStatus 类型 + EnrichmentSummary 对外契约（SEQ-EXT-META-01 / Track external-metadata）

- **状态**：**Accepted**（arch-reviewer claude-opus-4-8 × 1 轮 CONDITIONAL：R1（bangumi-sync 直调 matchAndEnrich → step3 单点写会漏）+ R2（077 已重号 / 026 文件名）+ R3（auto status 须入 applyAutoMatchAtomic 事务）+ Y1–Y4 + A1–A4；**二轮人审 R5**：`enrichmentSummary` 挂载方向修正（admin 路径 `buildEnrichmentSummary` 注入，非 public `mapVideoRow`）+ 补 2 个 barrel 出口（`packages/types/index.ts` / `videos.ts`）；全部已消化）
- **来源**：设计方案 `docs/designs/external-metadata-ux-overhaul_20260529.md` §3.2/§3.3（ADR-C）。本 ADR 为「外部元数据 UX 整改」契约核心，ADR-171（事件/通知）、ADR-172（EnrichmentBadge 组件）依赖其类型，**须先 Accepted**。

### 背景

`videos` 表有 `douban_status`（032）记豆瓣匹配态，但**无 bangumi 对应列**。Bangumi 匹配态仅散落在 `video_external_refs(provider='bangumi')`，列表/详情/审核台无法廉价读取，UI 无法显示 Bangumi 徽标。更严重的是手动确认 `BangumiService.confirmMatch`（`BangumiService.ts:114`）只写 catalog + external_ref、**不更新任何 videos 状态**，而 `updateVideoEnrichStatus`（`videos.status.ts:256`）签名只支持 `{doubanStatus, metaScore, metaQuality}`——导致手动确认后 UI 徽标停在 pending/candidate。同时 `enriched_at`/`title_en_is_pinyin`/`douban_confidence` 埋在 `videos.meta_quality` JSON，`mc.bangumi_subject_id` 未被 `VIDEO_FULL_SELECT`（`videos.internal.ts:185`）选取，前端只能自解析零散 JSON。本 ADR 统一收口：加列 + 类型 + 专用 query + 服务端展开的 `EnrichmentSummary` 契约。

### 决策要点

1. **（D-170-1）Migration 082 加列**：`082_videos_bangumi_status.sql` 给 `videos` 加
   `bangumi_status TEXT NOT NULL DEFAULT 'pending' CHECK (bangumi_status IN ('pending','matched','candidate','unmatched'))`
   + 部分索引 `idx_videos_bangumi_status ON videos (bangumi_status) WHERE deleted_at IS NULL`（**显式镜像** `032` 的 `idx_videos_douban_status` 谓词，A-2）。幂等（`ADD COLUMN IF NOT EXISTS` + `DO $$ 验证 $$`），同步 `docs/architecture.md`。
   **R-2 事实校正**：迁移目录已存在重号史（`077_bangumi_metadata.sql` + `077_videos_meta_quality.sql` 共用 077；另有 `058a_*`、乱序 `053_*`）。本 ADR 已实查确认 **082 未被占用**（现存最大为 `080_users_preferences.sql` / `081_source_line_aliases_dead_since.sql`）。被引用的既有文件真实名为 **`026_create_media_catalog.sql`**（`bangumi_subject_id INT UNIQUE` :66 / `douban_id TEXT UNIQUE` :65）。

2. **（D-170-2）类型**：`packages/types/src/video.types.ts` 增
   `export const BANGUMI_STATUSES = ['pending','matched','candidate','unmatched'] as const`（**与 `DOUBAN_STATUSES` 字面同序**，A-1）+ `export type BangumiStatus = typeof BANGUMI_STATUSES[number]`，加注释「镜像 DOUBAN_STATUSES；CHECK 约束须与 migration 082 同步」。

3. **（D-170-3）专用 query**：**不扩展** `updateVideoEnrichStatus`（douban 聚合语义，enrich 末尾单次写）；新增 `updateVideoBangumiStatus(db: Pool | PoolClient, videoId: string, status: BangumiStatus)` 于 `videos.status.ts`（与 `updateVideoSourceCheckStatus` :303 并列，A-4）。`Pool | PoolClient` 双形态：供 confirmMatch / applyAutoMatchAtomic 在事务内复用连接。

4. **（D-170-4）全部写入方 —— 状态投影下沉 `BangumiService`（R-1 核心修正）**：
   - **关键修正**：草案原「auto 流统一在 `MetadataEnrichService.step3` 单点写」**错误**——`bangumi-sync` 端点（`moderation.bangumi.ts:52`）**直调 `svc.matchAndEnrich`，不经 step3、不入队**；`step3Bangumi`（`MetadataEnrichService.ts:282`）本身也**丢弃** `matchAndEnrich` 返回值。故状态映射+写入**下沉进 `BangumiService.matchAndEnrich` 自身**，一次覆盖三条路径（step3 自动富集 / bangumi-sync 直调 / VideoService 改类型→anime 经 enrichmentQueue），不外溢到 caller（符合边界与复用）。
   - **auto（matched）**：在 `applyAutoMatchAtomic`（`BangumiService.ts:278`）的 `BEGIN/COMMIT` 事务内、upsert ref 之后、COMMIT 之前，`await updateVideoBangumiStatus(client, videoId, 'matched')`——**与 catalog+ref 同事务**（R-3：消除「catalog/ref 已提交、status 未写」的不一致窗口；ROLLBACK 重试幂等）。
   - **candidate / none（unmatched）**：无 catalog 写、无事务（仅 best-effort writeRef）→ 经 Pool 写（事务外）；写入失败须记录不静默吞（Y-2 防与 ref 不同步）。
   - **手动确认 confirmMatch**：在其既有 `BEGIN/COMMIT` 事务内、upsert `manual_confirmed` ref 之后 `await updateVideoBangumiStatus(client, videoId, 'matched')`（与 catalog+ref 原子）。confirmMatch **不经 matchAndEnrich**，故独立写。
   - **ignore / retry**：预留（未来 ignore 端点写 `'unmatched'`）。
   - **（D-170-4-AMD / META-15-C FIX，Codex stop-time review）已绑定→只刷新不重配**：`matchAndEnrich` 入口若检出**既有 primary bangumi ref（auto_matched / manual_confirmed）**，**跳过重新匹配**，改走 `refreshExistingMatch`——按既有 subject 刷新 catalog(COALESCE)/逐集/角色 + 重申 `'matched'`，**不动 ref、不降级**。原因：批量重富集（missing-characters mode 重跑既有 matched anime 补 META-19 角色）若重走匹配，`none`→写 `'unmatched'` 会**清空绑定**、`candidate`→降级、`auto` upsert 会把 `manual_confirmed` 覆盖成 `auto` 甚至改绑异 subject。unmatched/never 视频无 primary ref → 落正常匹配（unmatched mode 重试匹配语义不变）。REST 详情瞬时失败且无 dump → 抛错重试，绝不清空既有数据。
   - **非 anime**：step3 不执行 → 恒 `'pending'`；前端据 `video.type !== 'anime'` 决定不渲染 bangumi 徽标，**不依赖 status 值**。
   - **（A-3）刻意不对称**：douban 侧有「列 `douban_status` + `meta_quality.douban_match_status` JSON 子状态」双轨；bangumi **只设列 status，不引入 `meta_quality` JSON 子状态**——刻意简化，非遗漏。

5. **（D-170-5）EnrichmentSummary 对外契约（纯派生投影 / additive）**：
   - `packages/types` 新增（camelCase 共享域契约）：
     ```ts
     interface EnrichmentSummary {
       doubanStatus: DoubanStatus
       bangumiStatus: BangumiStatus
       sourceCheckStatus: SourceCheckStatus
       metaScore: number
       enrichedAt: string | null        // ← meta_quality.enriched_at
       titleEnIsPinyin: boolean         // ← meta_quality.title_en_is_pinyin（缺省 false）
       doubanConfidence: number | null  // ← meta_quality.douban_confidence
       bangumiSubjectId: number | null  // ← mc.bangumi_subject_id
     }
     ```
   - `DbVideoRow`（`videos.internal.ts:15`）增 `bangumi_status / bangumi_subject_id`；`VIDEO_FULL_SELECT` 增 **`v.bangumi_status, mc.bangumi_subject_id`**（**仅此两列**；`release_date` 等 feature-5 detail 字段推迟到 feature-5 卡，避免本 ADR 越界 / Y-4）。`listAdminVideos`(`videos.ts:299`) 与 `findAdminVideoById`(`videos.ts:333`) **均复用 `VIDEO_FULL_SELECT`**，加列后 admin raw 行自动带新列。
   - **（R-5 二轮人审：挂载方向修正）**：新增纯函数 `buildEnrichmentSummary(row: DbVideoRow): EnrichmentSummary`（`videos.internal.ts`，与 mapVideoRow 并列）。**注入点是 admin 路径**，因为：public 详情 `findVideoByShortId`(`videos.ts:145`，`is_published=true AND visibility_status='public'`) 才走 `mapVideoRow`→`Video`；而 admin `VideoService.adminList`(`:176`)/`adminFindById`(`:180`) **返回 raw `DbVideoRow`（`unknown`），不经 mapVideoRow**。故 enrichmentSummary 在 `VideoService.adminList/adminFindById`（或 admin 专用 mapper）注入 `{...row, enrichmentSummary: buildEnrichmentSummary(row)}`。**不挂 `mapVideoRow` / public `Video`**（否则前台暴露、后台仍拿不到 = 方向反）。server-next `VideoAdminRow/Detail` 镜像增 `enrichmentSummary`。
   - **（Y-1）纯派生约束**：`EnrichmentSummary` 由 `buildEnrichmentSummary` 从**同一 row 单次构造**（`doubanStatus = row.douban_status` 等同源引用），禁止与平铺字段异源双写。现有平铺字段 `doubanStatus/sourceCheckStatus/metaScore/metaQuality` **保留不删**（向后兼容：server-next `VideoListFilter.sortField` 含 `'douban_status'|'meta_score'` 排序契约依赖之）；标为**未来收口候选**——待 ADR-172 EnrichmentBadge 全面接管消费面后，于主版本边界评估废弃平铺字段（follow-up，防 additive 沦为永久债）。
   - **（Y-2）只挂后台 / 不动 public**：`enrichmentSummary` **不挂前台 `VideoCard` / 不改 `mapVideoCard` / 不改 public `Video`**（前台不渲染富集徽标）。public 详情查询虽因 `VIDEO_FULL_SELECT` 多选两列，但 `mapVideoRow` 不映射它们 → public `Video` 形状不变。
   - **（Y-3）命名偏离登记**：`EnrichmentSummary` 内部 camelCase（跨三端共享域契约）嵌入 server-next 全 snake_case 的 `VideoAdminRow`，为**刻意偏离**（非 bug），后续维护者勿「修正」。

### 影响文件

- 新建：`apps/api/src/db/migrations/082_videos_bangumi_status.sql`
- 修改：
  - `packages/types/src/video.types.ts`（BANGUMI_STATUSES + BangumiStatus + EnrichmentSummary）
  - **`packages/types/src/index.ts`**（**runtime export `BANGUMI_STATUSES`** —— `:42` 的 const 出口块需补；`export type *` 不导出 const，P2）
  - `apps/api/src/db/queries/videos.status.ts`（新 query `updateVideoBangumiStatus`）
  - **`apps/api/src/db/queries/videos.ts`**（**barrel re-export `updateVideoBangumiStatus`** —— `:44` 从 `./videos.status` 的 `export {}` 块需补；BangumiService 经 `* as videosQueries` 消费，P2）
  - `apps/api/src/services/BangumiService.ts`（matchAndEnrich + applyAutoMatchAtomic + confirmMatch 写 status）
  - `apps/api/src/db/queries/videos.internal.ts`（DbVideoRow + VIDEO_FULL_SELECT + **新增 `buildEnrichmentSummary`**）
  - `apps/api/src/services/VideoService.ts`（**admin 路径注入 enrichmentSummary** —— `adminList`/`adminFindById`，R-5）
  - `apps/server-next/src/lib/videos/types.ts`（VideoAdminRow/Detail 镜像）
  - `docs/architecture.md`（082 schema 同步）
- **注**：`MetadataEnrichService.step3Bangumi` / `updateVideoEnrichStatus` / `mapVideoRow` / public `Video` / `VideoCard` **均不改**。

### 实施拆卡（M-SN-5：影响文件 10+，单卡 PATCH ≤ 5 项，须拆）

- **C-1**：migration 082 + `BANGUMI_STATUSES`/`BangumiStatus` 类型 + **`packages/types/src/index.ts` runtime export** + `updateVideoBangumiStatus` query + **`videos.ts` barrel re-export** + architecture.md。
- **C-2**：BangumiService 三路径写 status（matchAndEnrich auto 入 applyAutoMatchAtomic 事务 / candidate-none Pool / confirmMatch 事务）。
- **C-3**：`EnrichmentSummary` 类型 + DbVideoRow/VIDEO_FULL_SELECT + `buildEnrichmentSummary` + **VideoService admin 路径注入** + server-next VideoAdminRow/Detail 镜像。

### 偏离登记

- **D-170-1**：`EnrichmentSummary` 与 `Video` 平铺字段重复（additive）。处置：accept（向后兼容 + 排序契约依赖平铺字段不可删）；标未来收口候选，触发条件 = ADR-172 后所有消费面切到 EnrichmentBadge → 主版本边界评估废弃平铺字段。
- **D-170-2**：bangumi 状态仅设列、不设 `meta_quality` JSON 子状态（与 douban 双轨不对称）。处置：accept（刻意简化）；若未来需 bangumi 置信度/匹配方式可观测信号，再起卡扩 `meta_quality.bangumi_*`。
- **D-170-3**：`EnrichmentSummary` camelCase 嵌入 server-next snake_case row。处置：accept（共享域契约统一 camelCase）。

### AMENDMENT 1（META-12-A / 2026-05-30）：`enrichmentSummary` 消费方扩展至审核台 `VideoQueueRow`

- **背景**：ADR-170 D-170-5 原把 `enrichmentSummary` 注入范围**显式限定在 `VideoAdminRow/Detail`**（视频库列表/详情）。P3 feature-2 富集徽标第 3 消费面（审核台 `ModListRow`/`RightPane`）需同一摘要，但其数据行 `VideoQueueRow`（`listPendingQueue`）当时无 `enrichmentSummary`。本 AMENDMENT 将范围扩展至 `VideoQueueRow`。
- **性质**：**additive 消费方扩展，非新契约**。`EnrichmentSummary` shape 不变、`buildEnrichmentSummary` 投影逻辑不变（仅复用），无新字段、无新 migration。故以 AMENDMENT 登记而非新 ADR；EnrichmentSummary 契约本身已经 ADR-170 Opus 评审。
- **决策要点**：
  - **D-170-AMD1-1**：`buildEnrichmentSummary` 参数由 `DbVideoRow` 窄化为新接口 `EnrichmentSourceRow`（6 个投影所需 snake_case 字段）。`DbVideoRow` 仍满足之（向后兼容）；moderation `listPendingQueue` 构造同形入参复用同一投影 → **单一真源**，禁止异源重复实现派生逻辑（价值排序 2 复用）。
  - **D-170-AMD1-2**：`listPendingQueue` SELECT 增 `v.bangumi_status / v.meta_quality / mc.bangumi_subject_id`（既有列，无 migration）；mapper **destructure 剔除 `metaQuality/bangumiStatus/bangumiSubjectId` 三个 raw 输入源**（不入响应行），仅注入派生后的 `enrichmentSummary`——**防 raw `meta_quality` JSON 泄漏前端**（贯彻 ADR-170「前端不解析零散 JSON」原则）。
  - **D-170-AMD1-3**：`VideoQueueRow`（`packages/types`）增 `enrichmentSummary?: EnrichmentSummary`（**additive 可选**：旧路径/未注入时缺省，不破坏 `StagingRow extends VideoQueueRow` 及其余消费方 PendingCenter/RightPane/ModListRow）。
- **影响文件**：`apps/api/src/db/queries/videos.internal.ts`（EnrichmentSourceRow + 窄化签名）、`apps/api/src/db/queries/moderation.ts`（SELECT + DbPendingQueueRow + mapper 注入）、`packages/types/src/admin-moderation.types.ts`（VideoQueueRow 字段）。
- **偏离登记**：
  - **D-170-AMD1-1**：moderation mapper 对 `doubanStatus/sourceCheckStatus`（DbPendingQueueRow 遗留 `string` 类型）`as DoubanStatus/SourceCheckStatus` 窄化转换。处置：accept（值由 DB CHECK 约束保证合法，与既有 API 边界 string→enum 收紧一致）。

---

## ADR-172：EnrichmentBadge 共享组件 API 契约（SEQ-EXT-META-E / Track external-metadata）

- **状态**：Accepted（arch-reviewer claude-opus-4-8 PASS；Props 契约强制 Opus 评审，CLAUDE.md 共享组件 API 契约）
- **来源**：设计方案 `docs/designs/external-metadata-ux-overhaul_20260529.md` §3.4/§3.5（ADR-E）。本 ADR 依赖 ADR-170（`EnrichmentSummary` 类型 + `BangumiStatus`）已 Accepted；为「外部元数据 UX 整改」P2 共享层，仅建组件 + 契约 + 单测，不接入 4 消费面（归 P3）。

### 背景

富集反馈（豆瓣状态 / Bangumi 状态 / 源活性 / 元数据完整度 / 拼音警告）需在 4 个消费面出现：①视频库列表行（`lib/videos/columns.ts`）②视频编辑抽屉头部（`VideoEditDrawer` QUICK_HEAD）③审核台行/详情 ④线路区（`TabLines`）。3+ 消费方 → 必须沉淀为 `packages/admin-ui` 共享组件（CLAUDE.md「同一 UI 模式 3 处以上必须提取」）。沿用 cell 层既有派生范式（VisChip / SignalChip：domain state → Pill variant + 文案 + data-attr + 复合 aria-label），不重新实现 Pill 视觉。`EnrichmentSummary` 类型已由 ADR-170 落在 `packages/types`，本组件直接消费，不在 admin-ui 重复定义。

### 决策要点

1. **（D-172-1）单徽标 `<EnrichmentBadge>` — discriminated union props**：按 `kind` 区分 payload，类型安全（5 个 kind 各自接受不同 status 形态：douban/bangumi 吃 4 态枚举、source 吃 `SourceCheckStatus`、meta 吃 0–100 数值、pinyin 吃 boolean）。**否决松散 props**（如 `status: string`）——松散 props 无法在编译期阻止「kind='meta' 却传枚举字符串」这类误用，违反价值排序 1（正确性）+ 3（类型可扩展）。共享 props：`size?: 'sm' | 'md'`（默认 'sm'，落 data-size 供未来 Pill 扩展 + 测试标记）、`showLabel?: boolean`（默认 true；false 时仅渲染 dot + tooltip，用于 density='row' 紧凑场景）、`testId?`。徽标渲染统一复用 `<Pill>`（不自绘视觉）。

2. **（D-172-2）kind×status → Pill variant + 文案 + dot 映射**（完整表见下「映射表」）：
   - **douban / bangumi**：`matched → ok`「已匹配」/ `candidate → warn`「候选」/ `unmatched → danger`「未匹配」/ `pending → neutral`「待匹配」。
     - 裁定：**unmatched 用 `danger`（非 neutral）**。理由：`unmatched` 是富集已执行但无命中的**确定性负面结果**，需运营注意补救（手动匹配）；`pending` 才是「尚未处理」的中性态。用 danger 与 pending(neutral) 区分二者语义层级，对齐 VisChip「已拒=danger / 待审=warn」的「负面终态 > 进行中」配色梯度。
   - **source**：`ok → ok`「源正常」/ `partial → warn`「部分失效」/ `all_dead → danger`「全部失效」/ `pending → neutral`「待检」。与 SignalChip 状态文案族（可用/部分/失效/待测）同义。
   - **meta**：**阈值变色 Pill（否决复用 Spark）**。Spark 是趋势数值序列可视化（`readonly number[]`），meta_score 是单标量，语义不匹配；且 Spark 0 数据点 return null、无 dot，与徽标「必含 dot」硬约束冲突。meta 用 Pill 渲染 `{metaScore}` 文案 + 阈值映射 variant：`≥ 80 → ok` / `50–79 → warn` / `< 50 → danger`。阈值为常量导出（`META_SCORE_THRESHOLDS`）供单测对拍。
   - **pinyin**：`titleEnIsPinyin === true → warn`「拼音」+ 文案前缀 ⚠（U+26A0，字符非依赖）；`false → 不渲染`（组件 return null）。

3. **（D-172-3）组合簇 `<EnrichmentBadgeCluster>`**：props `summary: EnrichmentSummary`、`type: VideoType`、`density: 'row' | 'header'`（无默认，必传，消费方显式声明上下文）、`enrichedAtLabel?`、`testId?`。派生渲染规则（纯派生，零受控状态）：
   - **anime-only 规则**：bangumi 徽标**仅当 `type === 'anime'` 渲染**（依据 ADR-170 D-170-4「非 anime 恒 pending，UI 据 type 不渲染」），**不依赖 status 值**。
   - **pinyin 徽标仅当 `summary.titleEnIsPinyin === true` 渲染**。
   - **徽标固定排列顺序**：`douban → bangumi(anime) → source → meta → pinyin`（语义重要性：外部匹配源 → 源活性 → 完整度 → 数据质量警告；与映射表行序一致，单测可锁序）。
   - **density 差异**：`row`（列表行紧凑）→ `size='sm'` + `showLabel=false`（仅 dot + tooltip）+ 不显示 `enrichedAt`；`header`（抽屉头稍宽）→ `size='md'` + `showLabel=true` + 末尾附 `enrichedAtLabel` 相对时间文本（省略时显示「未富集」）。`enrichedAt` 文案格式化不下沉本组件（消费方传入），本组件仅决定**是否渲染该 slot**，避免 i18n/时间库下沉污染 admin-ui（对齐 LinesPanel「i18n 不下沉」边界）。

4. **（D-172-4）零硬编码颜色 + 依赖方向 + a11y**：
   - 颜色**仅经 Pill 间接消费 `--state-*` token**，组件自身零 style 颜色字面量（meta 阈值只决定 PillVariant，不直接写色）。
   - 依赖方向单向：`admin-ui → @resovo/types`，**不 import 任何 apps/server-next/\*\* 或 apps/api/\*\* 类型**（对齐 LinesPanel R2）。
   - 全部 Props `readonly`（对齐 cell 层 + LinesPanel 约定）。
   - data-attribute：单徽标根 `data-enrichment-badge` + `data-kind` + `data-status`（meta 用 score 字符串）+ `data-size`；簇根 `data-enrichment-badge-cluster` + `data-type` + `data-density`。
   - a11y：复用 Pill 的 `role="status"`；每个徽标传**复合 aria-label**（派生文案 + 维度前缀，对齐 VisChip 范式），如 `豆瓣：已匹配`、`元数据完整度：72`、`英文标题疑似拼音`。`showLabel=false` 时 dot 语义由 aria-label 兜底。

5. **（D-172-5）`EnrichmentSummary` 类型 owner**：保持在 `packages/types`（ADR-170 D-170-5 已落）。组件 `import type { EnrichmentSummary, VideoType, DoubanStatus, BangumiStatus, SourceCheckStatus } from '@resovo/types'`，**不在 admin-ui 重复定义**。该类型已经 `packages/types/src/index.ts` 的 `export type * from './video.types'` 对外暴露，无需新增 barrel 出口。

### 映射表（kind × status → variant / 文案，实装 + 单测对拍真源）

| 序 | kind | status / 入参 | 渲染 | Pill variant | label | aria-label |
|---|---|---|---|---|---|---|
| 1 | douban | matched | ✅ | ok | 已匹配 | 豆瓣：已匹配 |
| 1 | douban | candidate | ✅ | warn | 候选 | 豆瓣：候选 |
| 1 | douban | unmatched | ✅ | danger | 未匹配 | 豆瓣：未匹配 |
| 1 | douban | pending | ✅ | neutral | 待匹配 | 豆瓣：待匹配 |
| 2 | bangumi | matched/candidate/unmatched/pending | ✅* | 同 douban | 同 douban | Bangumi：… |
| 3 | source | ok | ✅ | ok | 源正常 | 源活性：正常 |
| 3 | source | partial | ✅ | warn | 部分失效 | 源活性：部分失效 |
| 3 | source | all_dead | ✅ | danger | 全部失效 | 源活性：全部失效 |
| 3 | source | pending | ✅ | neutral | 待检 | 源活性：待检 |
| 4 | meta | score ≥ 80 | ✅ | ok | {score} | 元数据完整度：{score} |
| 4 | meta | 50 ≤ score < 80 | ✅ | warn | {score} | 元数据完整度：{score} |
| 4 | meta | score < 50 | ✅ | danger | {score} | 元数据完整度：{score} |
| 5 | pinyin | isPinyin=true | ✅ | warn | ⚠ 拼音 | 英文标题疑似拼音 |
| 5 | pinyin | isPinyin=false | ❌ return null | — | — | — |

> *bangumi 单徽标无条件按表渲染；**anime-only 门控只在 `<EnrichmentBadgeCluster>` 层施加**（`type !== 'anime'` → bangumi 徽标不进簇）。单徽标是无状态映射原子，门控属于簇的派生职责。
> meta 边界对拍点：`80→ok` / `79→warn` / `50→warn` / `49→danger` / `0→danger` / `100→ok`；超界值兜底不抛错（`>100→ok` / `<0→danger`）。

### 影响文件

- 新建：
  - `packages/admin-ui/src/components/enrichment-badge/enrichment-badge.types.ts`（Props 契约 + 映射常量）
  - `packages/admin-ui/src/components/enrichment-badge/enrichment-badge.tsx`（单徽标实装）
  - `packages/admin-ui/src/components/enrichment-badge/enrichment-badge-cluster.tsx`（簇实装）
  - `packages/admin-ui/src/components/enrichment-badge/index.ts`（barrel）
  - `tests/unit/components/admin-ui/enrichment-badge/enrichment-badge.test.tsx`（单测）
- 修改：`packages/admin-ui/src/index.ts`（新增 `export * from './components/enrichment-badge'`，对齐 LinesPanel composite 注册范式）
- **不改**：`packages/types/*`（EnrichmentSummary 已就绪）；4 消费面文件（P3 卡接入）。

### 依赖

- ADR-170（Accepted）：`EnrichmentSummary` / `BangumiStatus` 类型。
- 本 ADR Accepted 是 ADR-170 D-170-1 偏离收口的**触发前置**（消费面全切 EnrichmentBadge 后，于主版本边界评估废弃 `Video` 平铺富集字段）。

### 偏离登记

- **D-172-1**：`unmatched` 用 `danger` 而非 `neutral`。处置：accept（`unmatched`=确定性负面终态需运营补救，与 `pending` 中性态区分）。若 P3 接入后运营反馈 danger 过强（列表行红点噪声），可降级为 `warn`，仅改映射表一行 + 对应单测，不动 Props 契约。
- **D-172-2**：meta_score 用阈值变色 Pill 而非复用 Spark。处置：accept（Spark 是趋势序列原语，单标量语义不匹配 + 0 点 return null 与「必含 dot」冲突）。未来若需 meta_score 趋势（多次富集历史），另起卡用 Spark，与本徽标并存不替换。
- **D-172-3**：pinyin 用 ⚠（U+26A0）emoji 字符前缀。处置：accept——emoji 是 Unicode 文本字符，非图标库依赖，不违反 admin-ui「零图标库依赖」约束（该约束针对 lucide-react 等 npm 包 import）。屏幕阅读器由复合 aria-label 兜底，不依赖 emoji 朗读。
- **D-172-4**：`EnrichmentBadgeCluster` 不下沉 `enrichedAt` 时间格式化 / i18n。处置：accept（对齐 LinesPanel i18n 不下沉边界）；簇仅决定 slot 是否渲染，文案由消费方提供。
- **D-172-5（黄线，实装注意）**：Pill 当前固定 `--font-size-xxs`，`size='md'` 仅落 `data-size` 标记，视觉上 sm/md 当前无字号差异（与 SignalChip size 现状一致，供未来 Pill 扩展）。

---

### AMENDMENT 2（META-14 / 2026-05-30）：富集徽标重设计 — 彩点+文字 → 外部源品牌 Logo

- **状态**：Accepted（arch-reviewer claude-opus-4-8 CONDITIONAL → 主循环消化红线 R-AMD2-1 后等同 PASS；共享组件 API 契约变更，CLAUDE.md 强制 Opus 评审）
- **触发**：P3（META-11/12）落地后用户走读反馈 3 点 —— ①列表无文字彩点不可读、无 hover tooltip；②source 徽标与既有 DualSignal/source_health 列重复；③抽屉「富集时间」与「豆瓣未匹配」文字并列语义矛盾。
- **性质**：**破坏性重构（非 additive）**。删除 `kind='source'` + 重设单徽标视觉范式（Pill→品牌 Logo）+ 扩展 `EnrichmentSummary` 3 字段。4 消费面已在线消费 `EnrichmentBadgeCluster`（P3 已落 / 调用签名不变），现有单测已对拍旧 5-kind 映射 → 本 AMENDMENT 同步重写消费面 visual 回归 + 单测（非回归，属契约改写）。
- **用户已批准决策（R1）**：①4 源品牌 Logo（douban/bangumi(anime)/tmdb/imdb）②Logo 资源方案 A（admin-ui 内 data-URI 自包含）③TMDB+IMDb 纳入（未来富集补全英文标题后落实数据）④meta_score 仅 header 显示⑤未命中：row 不显 / header 灰显。

#### 决策要点

- **（D-172-AMD2-1）新原语 `<SourceLogoBadge>`**：Props `source: SourceLogoKind`（douban|bangumi|tmdb|imdb）、`state: SourceMatchState`（matched|candidate|absent）、`href?`、`size?`、`title?`、`testId?`。三态视觉：matched=全彩 logo；candidate=全彩+右上琥珀小点（颜色 `--state-warning-fg`，**仅 douban/bangumi**）；absent=同 logo 经 `filter: grayscale(1)` + `opacity: var(--logo-absent-opacity)` 灰显（grayscale 是滤镜非颜色字面量 / opacity 走新增语义 token，零硬编码颜色）。Logo 经方案 A `enrichment-logos.ts` 的 `SOURCE_LOGO_DATA_URI: Record<SourceLogoKind, string>`（PNG base64 data-URI，admin-ui 自包含 / 零 app 路径耦合 / Edge 兼容）。a11y：`<img alt>` = 复合语义（「豆瓣：已匹配」）+ `title` 属性提供 hover tooltip（**修复旧契约仅 aria-label 无 tooltip 缺口**）；命中且有 href → 包 `<a target="_blank" rel="noopener noreferrer">`。
- **（D-172-AMD2-2）`EnrichmentBadgeCluster` 修订**：移除 source kind（去重）；固定排序 `douban → bangumi(anime) → tmdb → imdb`（logo 行）+ ⚠pinyin（保留）+ meta_score chip（**仅 header**）+ 富集时间（仅 header）。row：只渲染 `state!=='absent'` 彩色 logo（未命中不占位）、无 meta chip、无时间；header：全部适用源 logo（命中彩色/未命中灰显）+ meta chip + 富集时间。门控：bangumi 仅 `type==='anime'`（沿用 ADR-170 D-170-4）；**tmdb/imdb 对所有 type 渲染**（外部库通用）。
- **（D-172-AMD2-3）`EnrichmentSummary` 扩展 3 字段**：增 `doubanId: string|null`（← mc.douban_id）/ `tmdbId: number|null`（← mc.tmdb_id）/ `imdbId: string|null`（← mc.imdb_id）。**无 migration**（media_catalog 026 三列已存在）。state 推导：douban/bangumi 据 status（matched/candidate/其余 absent）；tmdb=`tmdbId!=null?matched:absent`；imdb=`imdbId!=null?matched:absent`（无状态列 → 二态）。`sourceCheckStatus/doubanConfidence/bangumiSubjectId` 保留类型（向后兼容 + href 构造），Cluster 不再渲染 source。数据链路：`buildEnrichmentSummary`/`EnrichmentSourceRow` 补 3 入参；`VIDEO_FULL_SELECT` 已 select 三列（admin 零 SQL 改动）；moderation `listPendingQueue` SQL 补 `mc.tmdb_id/imdb_id/douban_id` 投影。
- **（D-172-AMD2-4）旧契约处置**：删 `kind='source'`（SourceBadgeProps + sourceVisual + 映射 + 单测块）+ douban/bangumi 的 Pill 渲染分支（改 SourceLogoBadge 承载）；`EnrichmentBadgeKind` 收窄为 `'meta'|'pinyin'`，`EnrichmentBadgeProps` = `MetaBadgeProps|PinyinBadgeProps`（保 union 形态 + 完备性守卫）。保留 meta/pinyin + META_SCORE_THRESHOLDS + Pill 复用。新增 SourceLogo* 类型/原语/data-URI/href builder。**4 消费面调用签名不变（零代码改动，仅 visual 回归）**。
- **（D-172-AMD2-5）外部页 href（组件内集中构造）**：`SOURCE_HREF_BUILDERS` —— douban `https://movie.douban.com/subject/{doubanId}/` / bangumi `https://bgm.tv/subject/{bangumiSubjectId}` / tmdb `https://www.themoviedb.org/movie/{tmdbId}` / imdb `https://www.imdb.com/title/{imdbId}/`。仅 `state!=='absent'` 且对应 id 非空渲染 `<a target=_blank rel=noopener noreferrer>`。裁定：下沉组件内（URL 模板与 source 一一绑定 / DRY / 纯字符串模板不破坏单向依赖）。

#### 影响文件

- 修改：`packages/types/src/video.types.ts`（EnrichmentSummary +3 字段）
- 修改：`apps/api/src/db/queries/videos.internal.ts`（EnrichmentSourceRow +3 + buildEnrichmentSummary +3 投影；VIDEO_FULL_SELECT 已含三列免改）
- 修改：`apps/api/src/db/queries/moderation.ts`（listPendingQueue SQL +3 列 + EnrichmentSourceRow 透传）
- 重写：`packages/admin-ui/src/components/enrichment-badge/{enrichment-badge.types.ts,enrichment-badge.tsx,enrichment-badge-cluster.tsx,index.ts}`
- 新建：`enrichment-badge/source-logo-badge.tsx` + `enrichment-logos.ts`
- 修改：`packages/design-tokens/src/**`（新增 `--logo-absent-opacity`）
- 重写：`tests/unit/components/admin-ui/enrichment-badge/enrichment-badge.test.tsx`
- **不改调用签名**：VideoListClient / VideoEditDrawer / ModListRow / TabDetail（仅 visual 回归）

#### 偏离登记

- **D-172-AMD2-A**：absent 灰显用 `filter: grayscale(1)` + `opacity: var(--logo-absent-opacity)`。处置：accept（grayscale 是 CSS 滤镜非颜色字面量；opacity 走新增独立 token，不复用 `--shelf-empty-opacity` 避免跨域耦合；单测颜色 grep 白名单 `grayscale(`）。
- **D-172-AMD2-B**：tmdb/imdb 无 candidate 态（无状态列 / 命中=ID 非空二态）。处置：accept（未来富集引入置信度可扩 SourceMatchState，向前兼容）。
- **D-172-AMD2-C**：tmdb href `/movie/{id}` 对 tv 类型不精确。处置：accept（首版 / tmdb 命中稀疏；覆盖上量后据 VideoType 分支 `/tv/`）。
- **D-172-AMD2-D**：TMDB/IMDb 品牌 logo 使用。处置：accept（内部 admin 工具属合理使用；-A 卡用官方标准 logo 不变形改色）。
- **D-172-AMD2-E**：旧单测（source 4 态 + douban/bangumi Pill 文案 + 簇排序断言）必然失败。处置：accept（同 commit 重写，非回归）。

#### 实施拆卡（严格串行 B→A→C）

- **META-14-B**（数据层先行）：EnrichmentSummary +3 + EnrichmentSourceRow +3 + buildEnrichmentSummary +3 + moderation SQL +3。
- **META-14-A**（logo 资源 + 新原语）：enrichment-logos.ts（4 源 base64 + href builders）+ source-logo-badge.tsx（三态 + a11y title/alt + href）+ design-token `--logo-absent-opacity` + 单测。
- **META-14-C**（簇重构 + 单测重写 + 4 面 visual 回归）：重写 types/badge/cluster/barrel + 重写单测；消费面不改代码仅走读回归。

> A/C 触碰 admin-ui 公开 Props，commit 必带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer。

---

## ADR-168：外部数据源凭证统一管理 + Secret Redaction 协议（SEQ-EXT-META-A / Track external-metadata）

- **状态**：**Accepted**（arch-reviewer claude-opus-4-8 × 1 轮起草 + 自审：D-168-1..8 全部锁定无待定；覆盖现存 douban_cookie / notification_webhook_secret 明文隐患 + 通用化多源；无新依赖、无新 admin route）
- **来源**：设计方案 `docs/designs/external-metadata-ux-overhaul_20260529.md` §2.2/§2.3/§2.4 + §13 ADR-168 骨架 + §11.1 凭证存储安全决策。本 ADR 为「外部元数据 UX 整改」P1 地基。用户要求：API key 不能仅靠 .env.local 明文，需设置页配置（bangumi 现在 / tmdb 以后）。

### 背景

Bangumi token 现直读 `process.env.BANGUMI_API_TOKEN`（`lib/bangumi.ts:15`），无法在站点设置页配置。更严重的安全隐患（已逐行核实）：
1. **明文落审计表**：`POST /admin/system/settings`（`siteConfig.ts:97`）`auditSvc.write({ beforeJsonb: beforeSubset, afterJsonb: pairs })`（`:155-156`）—— 现有 `notification_webhook_secret`（`:130`）、`douban_cookie`（`:110`）原样明文写入 `admin_audit_log`。
2. **明文经 GET 回传**：`deserializeSiteSettings`（`systemSettings.ts:81`）的 `doubanCookie`（`:86`）/ `notificationWebhookSecret`（`:99`）明文返回前端。
3. **无占位跳过**：POST 对 secret 零特殊处理 —— 一旦做 GET 遮罩，前端原样回提遮罩值会把真凭证覆盖为遮罩串（「保存即清空」风险）。

`system_settings.value` 是 TEXT KV，不加密；本 ADR 定义 secret redaction 三道协议（审计/GET/PATCH）+ Bangumi 凭证下沉 Service（向后兼容 env）。**本 ADR 定契约，实施拆 META-16-A/B/C**。

### 决策要点

1. **（D-168-1）敏感键模式 `SECRET_KEY_PATTERNS`**（`packages/types` runtime const，三端共享）：`/(^|_)token$/`、`/(^|_)cookie$/`、`/(^|_)secret$/`、`/(^|_)api_key$/`（通用化多源，覆盖未来 tmdb_api_key）。`isSecretSettingKey(key)` 判定。
   - **命中**：douban_cookie / notification_webhook_secret / bangumi_api_token / tmdb_api_key。
   - **不命中（精度护栏）**：notification_webhook_url / notification_email_to / douban_proxy / video_proxy_url / bangumi_user_agent / bangumi_api_timeout_ms / config_file_url / auto_crawl_*。用 `(^|_)<word>$` 避免误伤（`_url$`/`_to$`/`_agent$`/`_ms$` 不含四词尾）。

2. **（D-168-2）审计 redaction（零字符状态标记）**：纯函数 `redactSecretsForAudit(rec): rec|null` —— 命中键值非空→`'<set>'` / 空串|null|undefined→`'<cleared>'` / 非命中键原样 / `null` 入参→`null`（保 ADR-118 audit 语义）。**落点**：siteConfig POST 审计 write 前对 beforeSubset + pairs 双向应用。对现有 webhook_secret 立即生效（修隐患）。角括号标记与 logger `censor:'<redacted>'` 同族；不破坏 `extractAuditPayloadSummary`。

3. **（D-168-3）GET 遮罩 + Set 布尔**：纯函数 `maskSecret(raw)` —— ≥4→`'••••'+后4位` / 1–3→`'••••'`（全遮罩，不泄漏短凭证）/ 空串→`''`。**落点**：`deserializeSiteSettings`（raw→DTO 唯一收口，GET handler 直接 send 其结果）。敏感字段返回遮罩 + 新增 `<key>Set` 布尔（doubanCookieSet / notificationWebhookSecretSet / bangumiApiTokenSet / tmdbApiKeySet）。bangumiUserAgent/bangumiApiTimeoutMs 非敏感明文。

4. **（D-168-4）PATCH 遮罩占位跳过（防保存即清空）**：POST 构建 pairs 时敏感字段：`value.startsWith('••••')`（`isMaskedPlaceholder`，`MASK_PREFIX='••••'` 单一真源）→ **该 key 不入 pairs**（保留原值）；`value===''`→写空串（→审计 `<cleared>`，主动清空）；其他明文→正常覆盖。三态互斥（占位=不变/空=清空/明文=覆盖）。

5. **（D-168-5）凭证解析下沉 Service（本 ADR 定契约，实施 META-16-B）**：`lib/bangumi.ts` 导出 `BangumiClientConfig {token?,userAgent?,timeoutMs?}`；5 函数（getSubject/getEpisodes/searchSubjects/searchSubjectsStrict/isBangumiApiConfigured）加**末位可选 cfg**，内部 `apiToken()/timeoutMs()/userAgent()` 接受 cfg 缺省**回退 process.env**（向后兼容）。`BangumiService` 新增私有 `getBangumiConfig()` 从 system_settings 读（**进程内模块级 ~60s TTL 缓存**）；matchAndEnrich/confirmMatch/searchCandidates/matchViaRest/gatherEnrichmentData 调 lib 时透传。

6. **（D-168-6）at-rest 应用层加密 NEGATED for P1**：不引入 KV value 列加密（理由 §11.1：密钥管理/轮换/迁移/启动失败拖大 P1，无合规强制/无 dump 外发风险；redaction 三道已覆盖日志/响应泄漏主威胁）。follow-up ADR（触发：合规要求 / DB dump 外发链路）。

7. **（D-168-7）新增 keys + 类型扩展**：`SystemSettingKey` +`bangumi_api_token`/`bangumi_user_agent`/`bangumi_api_timeout_ms`/`tmdb_api_key`（**占位不消费**）。`SiteSettings` + bangumiApiToken(遮罩)/bangumiApiTokenSet/bangumiUserAgent/bangumiApiTimeoutMs/tmdbApiKey(占位)/tmdbApiKeySet + 补 doubanCookieSet/notificationWebhookSecretSet。`SiteSettingsBodySchema` + bangumiApiToken(.max 500)/bangumiUserAgent(.max 200)/bangumiApiTimeoutMs(int 1000–60000)/tmdbApiKey(.max 500)。`deserializeSiteSettings` + bangumiUserAgent 默认 `resovo/1.0 (+...)` / bangumiApiTimeoutMs 默认 8000。

### 影响文件

- 修改：`packages/types/src/system.types.ts`（union +4 / SiteSettings +8）、`packages/types/src/index.ts`（runtime export SECRET_KEY_PATTERNS/isSecretSettingKey/MASK_PREFIX）、`apps/api/src/routes/admin/siteConfig.ts`（占位跳过 + 审计 redaction + schema/pairs）、`apps/api/src/db/queries/systemSettings.ts`（遮罩 + Set 布尔 + bangumi 默认）、`apps/api/src/lib/bangumi.ts`（BangumiClientConfig + 5 函数 cfg）、`apps/api/src/services/BangumiService.ts`（getBangumiConfig 缓存 + 透传）、`apps/server-next/src/app/admin/settings/_tabs/SettingsTab.tsx`（外部数据源卡）
- 新建：`packages/types/src/security.types.ts`（或归 system.types：SECRET_KEY_PATTERNS/isSecretSettingKey/MASK_PREFIX）、`apps/api/src/lib/secretRedaction.ts`（redactSecretsForAudit/maskSecret/isMaskedPlaceholder）
- **注**：AuditLogService 不改（redaction 在 route 落点）；无 migration（KV 无 DDL）。

### 实施拆卡（M-SN-5：影响文件 8+，须拆 / 超 5 项再拆 A1/A2）

- **META-16-A**：SECRET_KEY_PATTERNS/maskSecret/redactSecretsForAudit/isMaskedPlaceholder + types union/接口/index runtime export + siteConfig POST 占位跳过/审计 redaction/schema + deserializeSiteSettings 遮罩。
- **META-16-B**：BangumiClientConfig + lib/bangumi 5 函数 cfg + getBangumiConfig 60s 缓存 + BangumiService 透传。
- **META-16-C**：SettingsTab「外部数据源」分组卡（bangumiApiToken password + show/hide / userAgent / timeoutMs / 状态行）。**测试连接按钮 NOT in scope**（依赖 ADR-173/F-A）。

### 偏离登记

- **D-168-6**：at-rest 加密 NEGATED for P1（follow-up / 触发：合规 或 dump 外发）。
- **D-168-7**：tmdb_api_key 仅入 union + 遮罩管线，不消费（通用化占位，TMDB 富集后续复用零返工）。
- **D-168-2 vs D-168-3 不对称**：审计零字符 / GET 露后 4 位。处置：accept（审计长期高敏留存 → 零字符；GET admin 实时编辑 → 后 4 位助辨识且不足重建）。
- **D-168-5 缓存一致性**：60s TTL 窗口旧凭证可能短暂沿用。处置：accept（凭证低频变更 / 富集最终一致）。

### 回归红线

- 既有必过：`tests/unit/api/system-config.test.ts`（`system.settings_update` payload，非敏感键不受影响 + **新增敏感键被 redact 断言**）/ audit-log-coverage / set-equal（无新 action type）。
- 新增测试要点：redactSecretsForAudit（set/cleared/原样/null）/ maskSecret（长/短/空）/ GET 遮罩 + Set 布尔（修既存隐患）/ PATCH 占位跳过（douban_cookie/webhook_secret 不被保存即清空）/ isSecretSettingKey（4 命中 + 6 不命中）/ lib cfg 优先与 env 回退。

---

## ADR-172 AMENDMENT 3（META-18 / 2026-05-30）：外部元数据真源并集视图 — 条目级展示层

- **状态**：Accepted（arch-reviewer claude-opus-4-8 CONDITIONAL → 主循环满足 3 条件后等同 PASS；admin-ui 公开 Props 新增 + `@resovo/types` 公开类型新增，双触发 CLAUDE.md 强制 Opus 评审）
- **触发**：用户走读反馈 —— 动漫类型视频详情/编辑页未消费已回填的 Bangumi 条目级字段（日文原名/放送日/排名/评分），且无「多源并集总览」（命中了哪些源/外部 ID/置信度/链接）→ 运营无法判定富集回填质量。
- **性质**：**additive（纯展示层）**。新增展示组件 + 详情 DTO 扩展，不动富集管线、不改 public 路径、不改既有徽标契约。
- **用户已锁决策**：①展示界面 = 视频编辑抽屉 + 审核台详情 两处 ②深度 = **仅条目级**（不含逐集放送 catalog_episodes）③设计原则 = 以 `media_catalog` 真源为中心 + 所有命中源**并集**展示（非每源孤岛 tab）④CV/角色管线记为 META-19 后续。

### 决策要点

- **（D-172-AMD3-1）跨层原语下沉 `@resovo/types`**：`ExternalRefProvider`（douban|tmdb|bangumi|imdb）+ `ExternalRefMatchStatus`（auto_matched|manual_confirmed|candidate|rejected）由 `apps/api/src/db/queries/externalData.ts` 迁入 `@resovo/types/src/video.types.ts`（含双形态 runtime const `EXTERNAL_REF_PROVIDERS`/`EXTERNAL_REF_MATCH_STATUSES`）；api 层改 `import type` 复用，不保留本地重复定义（避免四源枚举三处分叉 / CLAUDE.md「3 处以上必须提取」）。当前该两字面量仅 externalData.ts 引用，下沉低风险。
- **（D-172-AMD3-2）新建展示窄化投影类型**（`@resovo/types`）：
  - `ExternalRefSummary` = video_external_refs 面向展示窄化（provider/externalId/matchStatus/matchMethod/confidence/isPrimary）；**剔除** id/videoId/linkedAt/linkedBy/notes（写工作流/审计字段，纯展示不消费、不诱导写操作）。
  - `BangumiEntrySummary` = bangumi_entries 条目级投影（bangumiId/titleCn/titleJp/year/rating/summary/airDate/coverUrl/rank/nsfw）。**严格排除 rating_votes**（dump 无 votes 列；votes 属 `media_catalog` 真源合并值，异源不混 → 归真源字段区）。
- **（D-172-AMD3-3）admin 详情 DTO 扩展**：`VideoService.adminFindById` 在 `enrichmentSummary` 外追加 `externalRefs: ExternalRefSummary[]`（经 `listVideoExternalRefs` 映射）+ `bangumiInfo?: BangumiEntrySummary`（**仅 `type==='anime'` 且有 primary bangumi ref / bangumi_subject_id 时**经 `findBangumiById` 注入；dump 缺条目则 undefined）。**红线**：只挂 `adminFindById`，绝不挂 `mapVideoRow`/public `Video`（ADR-170 R-5）；`adminList`（列表）不注入（防 N×findBangumiById）。server-next `VideoAdminDetail` 镜像 `externalRefs?`/`bangumiInfo?` + 补 `title_original?`/`rating_votes?`/`metadata_source?`（api raw row 已 select，仅前端镜像未声明）。
- **（D-172-AMD3-4）admin-ui 新共享组件 `ExternalMetaPanel`**（`packages/admin-ui/src/components/external-meta-panel/`）：**纯展示零事件回调**（不耦合 TabDouban / douban-candidate / douban-ignore 写工作流）。Props `summary: EnrichmentSummary` / `type: VideoType` / `externalRefs?` / `bangumiInfo?` / `catalogFields?{titleOriginal,rating,ratingVotes,metadataSource}`（内联可选对象，**不吃** server-next/api 类型以守单向依赖）/ `enrichedAtLabel?` / `density?: 'drawer'|'compact'` / `testId?`。复用 `SourceLogoBadge` + `SOURCE_HREF_BUILDERS` + `SOURCE_LABEL`（不重绘 logo/href）。三区纵向布局（非 tab）：①源并集总览（4 源 logo + 外部 ID + matchMethod + 置信度 + primary 标记；bangumi 仅 anime；未命中 drawer 灰显占位/compact 不占位）②真源字段区（titleOriginal/rating+votes/metadataSource 标注）③Bangumi 条目块（anime-only：日文原名/放送日/排名/评分/nsfw + summary 可选折叠；bangumiInfo 缺失则整块不渲染）。
- **（D-172-AMD3-5）审核台懒加载隔离**：`RightPane/TabDetail` 用 `getVideo(v.id)` 懒取扩展详情消费同 Panel，**不得污染 queue list query**（`listPendingQueue`/`VideoQueueRow` 形状不变，新字段不进列表查询）。

### 影响文件

- 修改：`packages/types/src/video.types.ts`（+EXTERNAL_REF_PROVIDERS/EXTERNAL_REF_MATCH_STATUSES/ExternalRefProvider/ExternalRefMatchStatus/ExternalRefSummary/BangumiEntrySummary）、`packages/types/src/index.ts`（runtime const 值导出）
- 修改：`apps/api/src/db/queries/externalData.ts`（provider/status 改 import 复用）、`apps/api/src/services/VideoService.ts`（adminFindById 注入 externalRefs + bangumiInfo）
- 修改：`apps/server-next/src/lib/videos/types.ts`（VideoAdminDetail 镜像 + catalogFields 字段）、`VideoEditDrawer.tsx`（新「外部元数据」tab）、`moderation/_client/RightPane/TabDetail.tsx`（懒加载消费）
- 新建：`packages/admin-ui/src/components/external-meta-panel/{types.ts,external-meta-panel.tsx,index.ts}` + admin-ui barrel 导出
- 测试：external-meta-panel 单测 + 消费面回归

### 偏离登记

- **D-172-AMD3-A**：`bangumiInfo` 不含 rating_votes（异源分离 / votes 归 catalogFields）。处置：accept。
- **D-172-AMD3-B**：`catalogFields` 用内联可选对象而非吃 `VideoAdminDetail`/`DbVideoRow`。处置：accept（守 admin-ui 单向依赖红线）。
- **D-172-AMD3-C**：tmdb/imdb 条目级专属块本期不做（仅 source 总览展示 ID/链接）。处置：accept（TMDB/IMDb 富集管线未建 / 沿用 AMD2-B 二态）。

### 实施拆卡（严格串行 B→A→C / 对应 META-18-A/B）

- **B（types 下沉 + DTO）= META-18-A**：`@resovo/types` 4 类型 + api provider/status 改 import + adminFindById 注入 + server-next 镜像。
- **A（admin-ui Panel）+ C（两消费面接入）= META-18-B**：ExternalMetaPanel + 单测 + 编辑抽屉新 tab + 审核台 TabDetail 懒加载。

> A/C 触碰 admin-ui 公开 Props + `@resovo/types` 公开类型，commit 必带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer。

---

## ADR-161 AMENDMENT 2026-05-30（CHG-BNG-CHAR / META-19）— 角色↔CV 自动入库（catalog_characters + catalog_character_actors）

- **状态**：Accepted（arch-reviewer claude-opus-4-8 CONDITIONAL → 满足 5 红线后等同 PASS；新 schema + 新 REST 抓取 + admin-ui 公开 Props 新增 + `@resovo/types` 公开类型新增，多触发 CLAUDE.md 强制 Opus 评审）
- **触发**：用户「后面要补充管线，充实数据」+ META-18 调研确认 Bangumi 富集当前**不抓角色/声优**（`mapSubjectToCatalogFields` 仅解析导演/编剧；`media_catalog.cast TEXT[]` 扁平结构存不了角色↔CV 配对）。
- **性质**：additive（新表 + 新抓取 + 新展示区，不改既有 catalog/episodes 写入）。本 AMENDMENT 是 ADR-161 Bangumi 接入的自然延伸（`getCharacters` 平行 `getEpisodes`；`catalog_characters` 平行 `catalog_episodes`；同 gather/apply 两段、同 catalog_id 归属范式）。
- **已实测数据形态**（api.bgm.tv/v0/subjects/{id}/characters，无分页一次返回）：character{id,name,type,images,summary,relation(主角·配角·客串·闲角),actors[]} + actor{id,name,type,images}；**N:M**（实测 52 角色 14 个多 CV）。

### 决策要点

- **（D-161-AMD-1）两表 normalized**：`catalog_characters` + `catalog_character_actors`（非单表 JSONB）。理由：N:M 真实存在；actor 是有独立 person_id 的一等实体（未来「声优反查角色」可结构化查询）；catalog_episodes 扁平单表是「叶子无子集合」先例，不构成约束。Migration 083：`catalog_characters(catalog_id FK CASCADE, source, external_character_id NOT NULL, name, relation, char_type, sort, image_url, summary)` UNIQUE`(catalog_id,source,external_character_id)`；`catalog_character_actors(character_id FK CASCADE, external_actor_id, name, image_url, sort)` UNIQUE`(character_id,external_actor_id)`。
- **（D-161-AMD-2）delete-by-catalog-then-insert 全量替换**（非 upsert）：角色集合会变（源端增删角色），upsert 无法删孤儿；catalog_episodes 用 upsert 因逐集集合稳定，角色不然。`replaceCatalogCharacters(db: PoolClient, ...)` **仅 PoolClient**（delete+insert 须单事务，防空窗）。
- **（D-161-AMD-3）charactersFetched 守卫**（Codex stop-time review FIX）：`getCharacters` 区分「抓取失败(返 `null`)」与「成功返回空(`[]`)」。Phase 2 仅 `charactersFetched`（fetch 成功，含空）才 delete-then-insert 全量替换——**成功返回空也清陈旧角色**（避免保留过时数据）；抓取失败(null) 跳过（防瞬时故障误删）。**注**：原裁定为 `!degraded` 守卫，但 getCharacters 与 getSubject 解耦独立失败 → `!degraded` 会在 getCharacters 瞬时失败时误删；`length>0` 又无法清空陈旧 → 最终用 fetch-成功语义（null/[] 区分）兼顾两者。
- **（D-161-AMD-4）存储全集 / 展示过滤**：存全部角色（含客串/闲角，~52 行/番），relation 过滤是展示决策下沉渲染层（主角+配角 cap top-N）；存储层职责单一不业务过滤。`sort` 写入时按 relation 权重 + 原序填充。
- **（D-161-AMD-5）抓取/写入集成（单点接入两路径）**：`lib/bangumi.getCharacters`（无分页，**成功返数组含 `[]` / 失败返 `null`**）→ `gatherEnrichmentData`（Phase 1 拉取 + `mapCharacters` relation→sort + actor 序；非 null 才置 `charactersFetched=true`）→ `EnrichmentData.{characters, charactersFetched}` → `applyEnrichmentDb`（Phase 2 事务内，仅 `charactersFetched` 才 `replaceCatalogCharacters`，见 D-161-AMD-3）。auto（applyAutoMatchAtomic）+ 人工（confirmMatch）两路径均经 applyEnrichmentDb，**单点接入自动覆盖**。
- **（D-161-AMD-6）DTO + 展示**：`adminFindById` 新增**顶层** `bangumiCharacters?`（异源不混，不挂 bangumiInfo 内 / 同 AMD3-A votes 原则；仅 anime + 命中下发）。`@resovo/types`：`CatalogCharacterSummary`{name,relation,imageUrl,actors[]} + `CatalogCharacterActorSummary`{name,imageUrl}（窄化，剔除外部 id/sort/summary）。`ExternalMetaPanelProps` 新增 `characters?`（admin-ui 公开 Props → Opus trailer）；`CharactersBlock`（anime-only）渲染主角+配角 cap top-N，CV 配对「角色名 — CV1 / CV2」，relation Record 兜底原文，零硬编码色。**META-21（2026-05-31）**：角色头像渲染落地 —— 行首 `Thumb size="square-sm"`（28×28，复用 admin-ui cell 原语，object-fit cover / 空 src 走 placeholder），消费已存 `imageUrl`；纯渲染增强，不改 Props 契约（无 Opus trailer）。CV 头像仍未渲染（actor.imageUrl 已存，后续按需）。

### 影响文件

- 新建：`apps/api/src/db/migrations/083_bangumi_characters.sql`、`apps/api/src/db/queries/catalogCharacters.ts`
- 修改：`apps/api/src/lib/bangumi.ts`（getCharacters + BangumiCharacter/Actor 接口）、`apps/api/src/services/BangumiService.ts`（gather+apply + charactersFetched 守卫）、`apps/api/src/services/BangumiService.utils.ts`（mapCharacters）、`apps/api/src/services/VideoService.ts`（adminFindById 注入 bangumiCharacters）、`packages/types/src/video.types.ts`（2 投影）、`packages/admin-ui/src/components/external-meta-panel/{types.ts,external-meta-panel.tsx}`（characters Props + CharactersBlock）、`apps/server-next/src/lib/videos/types.ts`（VideoAdminDetail 镜像）、`docs/architecture.md`（§5.6 catalog_characters 段 + migration 列表）

### 偏离登记（对 077/161 原范式）

- **D-161-AMD-A**：两表 normalized（vs catalog_episodes 单表）。处置：accept（数据形态驱动）。
- **D-161-AMD-B**：delete-then-insert（vs catalog_episodes upsert）。处置：accept（角色集合可变，需删孤儿）。
- **D-161-AMD-C**：`replaceCatalogCharacters` 仅 PoolClient（vs upsertCatalogEpisodes 双形态）。处置：accept（delete+insert 须单事务）。
- **D-161-AMD-D**：`external_character_id NOT NULL`（vs catalog_episodes external_episode_id nullable）。处置：accept（角色无 id 无意义；delete-then-insert 不依赖 ON CONFLICT 过滤空键）。

### 实施拆卡（严格串行 A→B→C / META-19-A/B/C）

- **A**：migration 083 + `@resovo/types` 2 投影 + `catalogCharacters.ts`（replace + list）+ architecture.md §5.6/migration 列表 + 本 AMENDMENT。
- **B**：`getCharacters` + BangumiCharacter/Actor 接口 + `mapCharacters` + `EnrichmentData.{characters,charactersFetched}` + gather/apply 接入 + charactersFetched 守卫 + 单测（N:M / 失败 null 不删 / 成功空清陈旧 / 全量替换）。
- **C**：`adminFindById` 注入 bangumiCharacters + `ExternalMetaPanelProps.characters` + `CharactersBlock` + 单测。

### 红线

1. migration 编号落地前 Glob 确认（082 最新 → 083）；architecture.md 必须同步（绝对禁止项）。
2. admin-ui Props 新增 `characters` → commit 带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer。
3. charactersFetched 守卫必须存在（getCharacters 抓取失败 null → 禁止 delete 角色；成功空 [] → 替换清陈旧）。
4. `replaceCatalogCharacters` 仅 PoolClient + 事务内（两路径均满足）。
5. 无 any / 无空 catch（getCharacters 复用 bgmGet catch；失败 → bgmGet 返 null → getCharacters 返 null）/ 无硬编码颜色（CharactersBlock 仅 token）。

> C（及 B 若触 admin-ui）触碰 admin-ui 公开 Props + `@resovo/types` 公开类型，commit 必带 `Subagents: arch-reviewer (claude-opus-4-8)` trailer。

---

## ADR-174：匹配类归一化键统一剥标点 + 存量迁移 + Bangumi 唯一约束兜底（SEQ-20260531-01 / META-23）

- **状态**：Accepted（arch-reviewer claude-opus-4-8 设计裁定 / agentId a42951b36f50da8dd / PASS·满足 8 红线即可实施）
- **日期**：2026-05-31
- **关联**：META-22（外部匹配键剥标点解耦 / 本 ADR 继承其 CJK 不变量）/ ADR-114-NEGATED（video_sources 复合键 / 本 ADR 只动 catalog 层不触碰）/ ADR-161（findOrCreate retry 收敛 + 富集原子性）/ ADR-170 R-3（status 与 catalog+ref 同事务 / D-174-3 真去重在同事务内不破坏原子性）/ CLAUDE.md「schema 变更同步 architecture.md」绝对禁止项

### 背景

后台「视频库富集列 / 审核台富集图标」大面积空白。诊断（2026-05-31 实测）：anime 462 个 Bangumi matched 仅 145（31.4%），JP 150 个仅 73 matched（48.7%）。抽样 30 个 unmatched JP anime 归因：**5 撞唯一约束冲突 / 25 REST 搜不到或低置信 / 0 可正常匹配**。

冲突机理（已实测复现）：同一作品因标题写法差异（`当前，正被打扰中！` vs `当前正被打扰中`）→ 归并键 `media_catalog.title_normalized`（`normalizeTitle` 保留 CJK 标点）不同 → 被判不同作品 → 各建一个 catalog 行 → 都匹配到同一 Bangumi subject 610703 → 第二行写入 `bangumi_subject_id` 撞 `media_catalog_bangumi_subject_id_key` UNIQUE → 整个富集事务抛 duplicate key → 该视频留 unmatched。`matchAndEnrich` 走「已存在 catalogId 直接 update」路径，绕过 `findOrCreate` 内已有的 bangumiId 去重，是冲突精确机理。

### 决策（用户已锁 2026-05-31）

标题展示/搜索（`videos.title` / `media_catalog.title`）**保留标点空格不变**；所有匹配类中间操作（含**归并键**）**忽略标点空格**。本 ADR 仅解决「唯一约束冲突」类（约 17%）；「REST 搜不到」类（83%）显式除外（另起 SEQ）。

- **D-174-1（归一化函数策略）**：新增独立 `normalizeMergeKey(raw) = stripExternalMatchPunct(normalizeTitle(raw))`，与 `normalizeForExternalMatch` 实现等价但**语义分立**（一个持久化归并键、一个外部匹配运行时键，共用 `stripExternalMatchPunct` 私有实现）。**不改 `normalizeTitle` 函数体**——它还供 CrawlerRefetchService 相似度计算（:69/:87），改它会改相似度阈值输入分布，超范围且无实测支撑。所有归并键写入点（CrawlerService:172 / VideoService:256 / VideoMergesService:403 / buildMatchKey / videos.crawler INSERT 入参）切到 `normalizeMergeKey`。`normalizeTitle` 注释同步：从「本函数输出即持久化归并键」改为「归并键由 normalizeMergeKey 生成；本函数为其与外部匹配键的共享前置」。
- **D-174-2（存量迁移协议）**：migration 084 两阶段。**阶段 A**：TS 脚本读行 → `normalizeMergeKey(title)` → UPDATE 全 3124 行 title_normalized（**禁纯 SQL 复刻归一化逻辑**，必漂移致新旧键不一致 / META-22 教训核心 / R5）；幂等可重跑；先于阶段 B 提交。**阶段 B**：每组一事务合并 52 冗余行（51 组 / 实测 0 组多外部 ID）。留存行规则（确定性）：`ORDER BY (bangumi_subject_id IS NOT NULL, douban_id IS NOT NULL, created_at ASC, id ASC)` 取第一行。子表 `videos.catalog_id` / `video_external_refs` / `catalog_episodes` / `catalog_characters` 全部 UPDATE 指向留存行，对 `(catalog_id, episode_no)` 类唯一约束用 `ON CONFLICT DO NOTHING`（留存行优先 / R3）。**`media_catalog` 无 `deleted_at`（无软删）→ 删冗余行前必须全字段快照备份到迁移日志/备份表，保证可回滚（R4）**。
- **D-174-3（唯一约束冲突兜底）**：`BangumiService.applyEnrichmentDb` 在 `safeUpdate(catalogId, {bangumiSubjectId})` 之前先 `findCatalogByBangumiId(client, bangumiId)`：① existing ≠ 当前 catalogId → 当前 video 的 `catalog_id` 重指向 existing（运行时即时真去重），富集写 existing；② existing = 当前 / null → 正常写；③ 重指向不安全（type/year 冲突）→ 降级记 `video_external_refs` candidate，保留 unmatched，正常 COMMIT，**绝不让单冲突 video 炸整个 matchAndEnrich**。`ON CONFLICT DO NOTHING` 仅作真去重 UPDATE 的并发保险（+重查收敛），非语义主体（否则制造「ref matched 但 catalog 空」脏态）。**仅 bangumi_subject_id**；douban/imdb/tmdb 三同类约束识别为同构风险但当前未实测冲突 → follow-up（沉淀 `MediaCatalogService.linkExternalIdOrRedirect` 通用原语 / 本 ADR 实现时留可提取接缝）。
- **D-174-4（受影响消费方）**：查询点 videos.crawler.ts:197 / mediaCatalog.ts:144 / video-merge-candidates.ts:61/88/122 GROUP BY **SQL 无需改逻辑**——只要写入侧 + 查询入参侧键生成同批切 `normalizeMergeKey`（R6 最高翻车点：任一漏切→新写入新键 vs 查询旧键→漏归并）+ 阶段 A 重算存量，键全局自洽。dump 表 `external_data.douban_entries.title_normalized`（ExternalDataImportService:447 本地 `normalizeTitle` 经 `[^\p{L}\p{N}]` 写入）**不在范围**：已剥标点、不同表不同语义不同函数，是被匹配侧基准；Y3 勿误统一/误改。
- **D-174-5（回归与门禁）**：5 类测试（① 归一化同键/幂等/CJK 对齐/含空格 under-match ② 迁移幂等 ③ 52 组合并正确性·子表无悬挂·外部 ID 无丢失 ④ 唯一约束兜底·真去重重指向不抛+降级不炸事务 ⑤ 富集列/审核台图标渲染回归）。**architecture.md 必须同步 `title_normalized` 语义变更**（列 DDL 不变但内容契约从「保留标点」变「剥标点」/ R8 / schema 绝对禁止项覆盖）。门禁 `verify:adr-contracts` + `verify:sql-schema-alignment` 必跑。
- **D-174-6（回滚边界 / Codex stop-time review + Opus 评审 / META-23-C 实施期补记）**：本迁移**不可逆**，回滚是「数据安全网」**非字节级逐行无损还原**。根因：① 留存行的合并前归并键被阶段 A'（合并后补跑 backfill）**覆盖式 UPDATE 永久丢失、且从未快照**；② `uq_catalog_title_year_type`（同 `(title_normalized,year,type)` 无外部 ID 行仅一行）在设计上**拒绝**「复活的冗余行与已收敛留存行同键共存」（这正是合并目的）。回滚脚本（`scripts/dedup-catalog-084-rollback.ts`）能恢复：被删 52 行全字段（取证）+ videos 指向 + 子表快照复位；**不能**还原留存行被前移的键（复活行 title_normalized 追加 sentinel `‹rollback-084›` 规避 uq 索引，键不自洽待人工裁定）。修正缺陷：原脚本 `ON CONFLICT (id)` 误以为能兜 uq 部分唯一索引（实际只兜主键），复活无外部 ID 同键行必撞 → 已改为复活带 sentinel。**红线 R9：任何后续覆盖式重算归并键的迁移，若要求可回滚，必须在覆盖前快照原始 `title_normalized`**（本次 A/A' 未做的教训）。**前向守卫（R10）**：`dedup-catalog-084.ts` 运行时校验 8 张快照表齐全（migration 084 已 apply）+ **阻断式**校验单行组键自洽（阶段 A 已跑），避免误序执行。
  - **provenance/locks 回滚信息论边界（Codex 三轮 + Opus 裁定 acb02c256adb21e56）**：`(catalog_id, field_name)` 类子表（无独立 id、无来源列、A 类留存侧从未快照）合并后**留存行 field 的来源(A 类原有 / B 类冗余转移)标记被永久擦除**。回滚侧任何事后判据（catalog_id 范围 / 逐列值相等 / 时间戳）**无法精确区分 A/B** —— 同作品两 catalog 的同 field 其 source_kind/priority/updated_at 常完全重合（同源同批 backfill），值空间真实重合。故回滚对这两表**只 INSERT 冗余快照、绝不 DELETE 留存行任何行**（删 = 不可逆静默误删 A 类，违反「宁留勿误删」数据安全底线）；B 类转移副本遗留在留存行属已知不可逆损失，跑完用逐列判据**报告**疑似残留候选（仅 REPORT 不删，交人工裁定）。曾在实施期一度采用「逐列 IS NOT DISTINCT FROM 删 B 类」，经 Codex 指出值空间重合误删风险已**撤回**。
  - **locks ≠ provenance（运行时语义区别）+ hard/soft 分级（Codex round 11 + round 12 两套 soft 存储辨析）**：provenance 是纯审计血缘，残留=噪声无害；locks 残留须**按 lock_mode 分级**（曾一概定性「噪声/可接受/无需处置」错误，已撤回）。**关键辨析（round 12）**：safeUpdate 存在**两套独立 soft 存储**——`:220` 软锁阻挡读的是 `media_catalog.locked_fields` **列**（manual 写入、catalog 行自身列，留存行保留自己的、冗余行随删 → **不向留存行转移**，本回滚无此类残留）；而回滚残留来自 `video_metadata_locks` **表**（随 UPDATE catalog_id 转移）。后者消费方只有两个：`getHardLockedFields`（`:138` 仅取 `lock_mode='hard'`）→ `hardLockedSet` → `:215`；`getLocksByCatalogId`（取全部行）→ **仅** `moderation.ts:413` 审核台**只读展示**。故：
    - **hard 残留**：`getHardLockedFields` → `:215` 无条件跳过该字段，任何来源含 manual 都不能覆盖 = 留存行该字段**被永久冻结** → **实质运行时问题，需处置**。
    - **soft 残留**：`video_metadata_locks` 的 soft 行**无任何覆盖守卫消费方**（`:220` 读的是另一套 `locked_fields` 列，不读本表 soft 行），仅在审核台 locks 展示露出 → **审计/可观测噪声·误导性归属，非运行时危害**，不挡富集/manual。（FIX11 曾写「soft 仅挡非 manual 来源 :220」属把 `locked_fields` 列行为错安到 `video_metadata_locks` soft 行，已撤回。）
    - **处置通道**：经核实**当前无 admin 字段锁管理 route/UI**（`removeFieldLock`/`upsertFieldLock` 无任何 route 调用方），故脚本**不指向「日常字段锁管理流程」**（该流程不存在，曾指向属虚假声称已撤回）。hard 残留解除须 **DBA/工程逐条业务核查**（确属本次合并误转移）后处理；且删除本身受**误报（信息论不可达）+ TOCTOU** 制约，无自动安全方法（R11）。脚本职责：分级诊断 + 落 `_residual_locks_084`（标 lock_mode）供审计与人工处置，**不删、不提供删除方法**。
  - **R11**：无独立 id、PK=`(catalog_id, field_name)` 类子表的合并回滚，一律「只插冗余快照、不删留存行」；基于值相等/时间戳「识别并删除转移副本」的判据**禁止进入回滚执行路径**（同源同批值空间重合→误删不可逆），仅可用于生成人工核查清单。
  - **R12**：未来同类 catalog 合并若要求 provenance/locks 可精确回滚，**合并侧必须保留来源可区分性**（为这两表增独立 id + 来源批次列，或合并时不向留存行转移、只删冗余侧进快照）。本次 dedup 已真跑不可改，登记为 follow-up；locks「字段锁是否随合并继承」语义并入 `MediaCatalogService.linkExternalIdOrRedirect` 通用原语 follow-up 显式裁定。
- **D-174-7（redirect 跨步骤 catalogId 传播 / META-23-D 实施期 Codex stop-time review 补记）**：运行时真去重 `redirect` 会把 `video.catalog_id` 改到 existing catalog —— **此改动必须沿调用链向下游传播**，否则同一富集流程内后续步骤会对**已弃置的 orphan catalog**操作。已修：`BangumiService.matchAndEnrich` 的 `auto` 结果新增 `catalogId`（富集实际写入的有效 catalog），`MetadataEnrichService.step3Bangumi` 据此返回有效 catalogId，`enrich` 用它跑 `step5MetaScore`（否则 redirect 后会对旧空 catalog 算出错误 meta_score 并持久化）。**红线 R13：任何运行时改变 video↔catalog 归属的去重/合并，调用链下游所有以 catalogId 为输入的步骤必须改用重指向后的有效 catalogId。** 已知可接受边界（非 silent gap）：① redirect 后源 catalog 可能变childless（empty row、无 bangumi_subject_id → 不进 bangumi gap 清单）—— 运行时不自动删 catalog 行（删行需快照/回滚保护，沿用 META-23-C 迁移范式），留周期性清理 follow-up；② step1/2 写到源 catalog 的 douban 字段在 redirect 后遗留旧行，但 video 已落到 canonical existing（其自身富集更全），下次重富集对 existing 重新落 douban → 最终一致，无 video 侧数据丢失。

### 红线（实施前必须满足，违反即阻塞）

- **R1** `normalizeMergeKey` 保持 META-22 不变量：CJK 标题与 dump `[^\p{L}\p{N}]` 逐字符一致（零召回损失）+ 含空格标题 under-match 不误绑；不得引入更激进塌缩。
- **R2** 阶段 B 留存行选择确定性（有外部 ID + 最早 created_at），不依赖隐式行序。
- **R3** 子表转移处理 `(catalog_id, source, external_*)` / `(catalog_id, field_name)` / `(catalog_id, alias)` 类唯一约束。**注意：UPDATE 不支持 ON CONFLICT**（INSERT 专有）→ 实装为「先删冗余侧与留存行碰撞的行（留存优先），再 UPDATE 剩余转移」+ `IS NOT DISTINCT FROM`（处理 nullable `external_episode_id`，`=` 对 NULL 漏判）。否则转移 UPDATE 撞唯一索引炸迁移（META-23-C 实测修正）。
- **R4** 合并删行可回滚：media_catalog 无 deleted_at → 删前全字段快照备份（含孙表 catalog_character_actors）。**但回滚是数据安全网非字节级无损**，见 D-174-6 + R9。
- **R5** 存量重算用 TS 脚本调 `normalizeMergeKey`，禁纯 SQL 复刻。
- **R6** 写入侧 + 查询入参侧键生成同批切换零遗漏。
- **R7** D-174-5 五类测试全绿才 commit。
- **R8** architecture.md 同步 title_normalized 语义变更。
- **R9** 任何后续**覆盖式重算归并键**的迁移，若要求可回滚，**必须在覆盖前快照原始 `title_normalized`**（本次 A/A' 未做 → 留存行旧键不可逆丢失 / D-174-6 教训）。
- **R10** 数据迁移脚本须有**前向守卫**：运行时校验前置（快照表齐全 / 上游阶段已跑），避免误序执行中途 SQL 报错（META-23-C `dedup-catalog-084.ts` 已加）。

### 黄线

- **Y1** 部署顺序：先发代码（写入侧已用 normalizeMergeKey）→ 再跑 backfill 重算存量，使窗口内新写入即新键；或维护窗口内一次完成。
- **Y2** VideoMergesService 合并能力确认是 video 级还是 catalog 级；若仅 video 级，阶段 B 用专用 backfill 不强塞。
- **Y3** ExternalDataImportService:447 本地 normalizeTitle 与 TitleNormalizer 同名不同语义，勿误统一 dump 侧基准。
- **Y4** video_sources 复合键（ADR-114-NEGATED）：合并停在 catalog 层不动 video_sources schema，兼容；测试验证经 video.catalog_id 间接关联无悬挂。
- **Y5** 真去重重指向改 video.catalog_id，验证不破坏审核台 in-flight 展示。

### 后果

- 正面：根治同番裂多行 + 唯一约束冲突（约 17% unmatched anime）；清理 52 冗余 catalog 数据更干净；归并键与外部匹配键语义对齐；为 douban/imdb/tmdb 通用去重原语留接缝。
- 负面/成本：一次不可逆数据迁移（删 52 行需快照备份兜底）；存量键不一致窗口需部署顺序管控；不解决 83% 的「REST 搜不到」（另起 SEQ）。

### D-N 偏离登记

D-174-1 ~ D-174-5 共 5 条，实施期（META-23-B..E）逐条闭环；advisory，不阻塞 CI。

### 已知 follow-up（不在本 ADR）

1. douban/imdb/tmdb 同类唯一约束兜底 → 沉淀 `MediaCatalogService.linkExternalIdOrRedirect` 通用原语。
2. 「REST 搜不到/低置信」（83% unmatched anime）→ 另起 SEQ（先诊断 25 个搜不到真因：Bangumi 未收录 / 中文译名差异 / 阈值偏严）。

---
