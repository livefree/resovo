# Manual GAPS · 实施缺失 / 意义不明模块汇总

> status: active（活跃登记）
> 起源：CHG-SN-8-MANUAL-BATCH-1（2026-05-21）
> 用途：手册定稿过程中发现的「实施已部分落地但功能不全 / 用户无法感知 / 意义不明」模块统一登记；每条对应一个 follow-up 卡待启动

> **登记规约**：
> - 每条标 `#G-<page>-<feature>` 编号，便于 manual 内 §FAQ 反向引用
> - 状态：⬜ 未启动 / 🔄 已立卡 / ✅ 已闭合 / ❌ NEGATED
> - 优先级：P0 阻塞用户高频流程 / P1 影响 admin 主线 / P2 长尾 / P3 视觉/文档

---

## 已登记 GAPS

### #G-dashboard-runall · dashboard 顶部「全站全量采集」未跟进 CHG-SN-8-01 双重 confirm

- **页面**：P-dashboard §3.4
- **状态**：✅ 已闭合（2026-05-21 / CHG-SN-8-GAPS-BATCH-1）
- **优先级**：P1（误触爆炸性损耗风险）
- **修复**：dashboard PageHeader 拆 2 按钮 — 「全站增量」primary + 「全站全量」ghost；全量加双重 confirm（confirm + prompt 输入"全量"）；与 P-crawler CHG-SN-8-01 同范式

### #G-dashboard-edit-mode · dashboard 编辑态 / CardLibrary / Fullscreen 未实装

- **页面**：P-dashboard §4
- **状态**：⬜ 长期 backlog（M-SN-N）
- **优先级**：P3
- **现象**：plan §6.1.3 / reference §5.1.3 设计意图含拖拽 + resize + 全屏 + 卡片库；当前仅浏览态
- **关联**：CHG-SN-7-MISC-DASHBOARD-3 已登记长期 backlog

### #G-dashboard-activities-mock · RecentActivityCard 仍 mock（视觉警示已加，真端点 follow-up 待立）

- **页面**：P-dashboard §3 / §7 FAQ
- **状态**：✅ **完全闭合**（2026-05-22 / 消费层 + ADR-141 + EP 全 PASS）
- **优先级**：P2
- **闭环路径（3/3 全 ✅）**：
  - **1/3 消费层视觉警示**：CHG-SN-8-GAPS-DASH-ACTIVITY — DashboardStats 加 `activitiesDataSource` + RecentActivityCard 头部 mock 时显「示例数据」warn chip
  - **2/3 ADR**：CHG-SN-8-FUP-DASH-ACTIVITY-ADR（commit 4de065f4）— ADR-141 **A PASS**
  - **3/3 实施 EP**：CHG-SN-8-FUP-DASH-ACTIVITY-LIVE — 7 文件（migration 070 idx_admin_audit_log_created + DashboardActivityRow 类型 + listDashboardActivities query + GET /admin/dashboard/activities route + 60s TTL Map cache + 10 单测 + 前端 dashboard-data.ts mock→live + i18n audit-action-labels.ts 37 项全集 + deriveActivitySeverity + formatRelative helpers + DashboardClient 拉 activities 真端点 fallback null → mock）；warn chip 真后端接入后自动消失
- **N1 follow-up**：N1-141-1（targetDisplayName 扩展）✅ 已闭合（CHG-SN-8-FUP-DASH-ACTIVITY-DISPLAY-NAME / 2026-05-22）/ N1-141-2（severity 后端化）→ 按需评估不立卡

### #G-videos-add · 视频库「+ 添加视频」按钮

- **页面**：P-videos §3.5 / §7 FAQ
- **状态**：✅ **完全闭合**（2026-05-22 / ADR-145 + EP-A + EP-B 全 PASS）
- **优先级**：P2
- **现状**：VideoListClient.tsx 按钮 disabled + tooltip；POST /admin/videos 端点已注册但存在 6 项技术债（绕过 MediaCatalogService.findOrCreate / Record<string,unknown> 无类型 / 零 audit / 零重复检测 / 无 publishMode / locked_fields 不保护）
- **ADR-145 决策**：方案 C 最小 3 字段（title/type/contentRating 必填 + 14 元数据 optional）+ 方案 B 重复检测（findOrCreate isNewlyCreated + force 跳过）+ 方案 B catalog 复用 findOrCreate(metadataSource='manual') + 方案 C publishMode 三路径（draft/staging 默认/published）+ R-MID-1 第 24 次系统化（video.manual_add）+ 零新 ErrorCode（复用 STATE_CONFLICT）+ VideoEditDrawer 双模式（videoId=null 创建 / 有值编辑）+ 7 关联 ADR 实证
- **后端实施 EP-A**（本卡 commit 待 / 2026-05-22）：CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-A — 4 R-MID-1 真源同步（types union + ACTION_TYPES + 2 set-equal 测试）+ VideoService.create 重构（MediaCatalogService.findOrCreate metadataSource='manual' + 重复检测 SELECT count + publishMode 三路径状态机 + audit fire-and-forget）+ Route ManualAddVideoSchema + 409 STATE_CONFLICT detail 处理 + 20 单测 PASS（happy 5 + 重复检测 4 + catalog 同步 3 + audit 4 + 422 validation 3 + 401 权限 1）；修复 ADR-145 §1 列出的 6 项现有技术债
- **前端实装 EP-B**（本卡 commit 待 / 2026-05-22）：CHG-SN-8-FUP-VIDEO-MANUAL-ADD-EP-B — createVideo lib 封装 + VideoEditDrawer 双模式（videoId=null 创建空表单 POST + 文案「+ 添加视频」/「创建视频」+ lines/images/douban tab disabled 不可点）+ VideoListClient drawerTarget state（'closed' | null | string）+ PageHeader 按钮 enable + 3 新单测（创建模式渲染 + 提交 + tab disabled）；全 unit 4644/4645 PASS

### #G-moderation-batch-ui · 批量审核独立入口

- **页面**：P-moderation §4.2 / §3.5（新增）
- **状态**：✅ 已闭合（2026-05-21 / CHG-SN-8-GAPS-MOD-BATCH）
- **优先级**：P1（审核效率）
- **修复**：ModerationConsole 增「批量模式」toggle（位于 approveAndPublishOn 旁；仅 pending tab）+ ModListRow checkbox 支持 + bulk action bar（fixed bottom：批量通过 / 批量拒绝 / 清除选择）+ batchApproveVideos / batchRejectVideos lib 封装

### #G-moderation-preset-team · FilterPreset 多账号共享缺失

- **页面**：P-moderation §3.4 / §7 FAQ
- **状态**：✅ **完全闭合**（2026-05-22 / ADR-144 + EP-A + EP-B 全 PASS）
- **优先级**：P3
- **现象（已核查）**：`apps/server-next/src/lib/moderation/use-filter-presets.ts:5` localStorage 持久化（key `admin.moderation.presets.v1`），仅本浏览器；同团队审核员无法共享预设
- **消费层补齐**：CHG-SN-8-GAPS-PRESET-LOCAL-BADGE — FilterPresetPopover header 加「仅本地」warn chip + tooltip
- **ADR-144 决策**（commit 待 / 本卡）：方案 B `scope: 'private' | 'shared'`（不引入 team 概念 — Resovo 当前架构无多租户）+ user_filter_presets 表（owner_user_id / name / query_jsonb / scope CHECK / tab CHECK / is_default + 部分唯一索引）+ 4 端点（GET/POST/PATCH/DELETE list 200 上限不分页）+ owner 全权 / admin 强制删 shared / moderator 不可改他人 + R-MID-1 第 21-23 次系统化（filter_preset.create/update/delete + targetKind filter_preset migration 072 CHECK 12→13）+ 用户手动 import 迁移策略 + DB 部分唯一索引保证 is_default 单一性 + 零新 ErrorCode + 7 关联 ADR 实证
- **后端实施 EP-A**（commit 待 / 本卡）：CHG-SN-8-FUP-PRESET-TEAM-EP-A — 2 migration（071 建表 + 3 索引 + 072 CHECK 12→13）+ filterPresets DB query 层（CRUD 5 函数含 clearDefaultForOwnerTab）+ FilterPresetService（zod + RBAC + default 互斥 + audit fire-and-forget）+ 4 端点 Route（GET/POST/PATCH/DELETE）+ R-MID-1 7 文件（types union + ACTION_TYPES + TARGET_KINDS + coverage test）+ 18 单测 PASS
- **前端实装 EP-B**（本卡 commit 待 / 2026-05-22）：CHG-SN-8-FUP-PRESET-TEAM-EP-B — filter-presets-api.ts 4 端点封装 + use-filter-presets.ts 改 DB 持久化（保持向后兼容，调用方改 async）+ ModerationConsole 4 handler 加 try/catch + FilterPresetPopover 加「已同步」live badge + 「团队」shared badge + 「导入本地」入口 + importLocalToServer 批量上传 + localStorage 清理；双源 fallback（fetch 失败保留 localStorage 继续工作 / offline 兜底）；5 新 SWR 单测 PASS + 旧 5 测试迁移说明 + 全 unit 4623 PASS

### #G-merge-candidate-b-auto · 审核台类似 tab 深链 candidate_b 未自动填入 Merge 页

- **页面**：P-merge §3.3 / §7 FAQ
- **状态**：✅ 已闭合（2026-05-21 / CHG-SN-8-GAPS-BATCH-1）
- **优先级**：P1（W4 工作流流畅度）
- **修复**：DirectMergeWorkspace 增 `candidateBIdFromUrl` prop + useEffect 一次性 fetch + 注入 picker；同 ContentRefPicker 编辑态恢复范式（含 AbortController cleanup）

### #G-sources-replace-similar · 「一键替换最相似 URL」算法实装

- **页面**：P-sources §3.1 / §7 FAQ
- **状态**：🔄 已立 follow-up（CHG-SN-8-FUP-SOURCES-REPLACE-ADR）
- **优先级**：P2
- **现象**：CHG-SN-8-FUP-SOURCES-DEAD-BTN 已修死按钮 + Modal 解释，但实际算法（URL 相似度 + 批量改写 + audit + 回滚）未实装

### #G-shell-notifications · 侧栏 mock badge 未接真端点

- **页面**：用户问题 #1
- **状态**：🔄 已立 follow-up（CHG-SN-7-MISC-SHELL-NOTIFICATIONS）
- **优先级**：P1
- **现象**：admin-shell-client.tsx:97-98 mockNotifications/mockTasks 仍是 stub；端点 `/admin/notifications` / `/admin/system/jobs` 不存在，需先通知 Hub MVP ADR

### #G-dev-mode-3panels · 开发者模式 3 栏只做 1 栏

- **页面**：用户问题 #12
- **状态**：⬜ 长期 backlog（M-SN-N）
- **优先级**：P3
- **现象**：reference 设计稿要求 Components / Tokens / Semantic 3 栏；当前仅 components 栏（/admin/dev/components + /admin/dev/visual/）

### #G-users-role-session-invalidate · 改用户角色后 session 未强制失效

- **页面**：P-users §3.3 / §7 FAQ
- **状态**：✅ 已闭合（2026-05-22 / ADR-139 + CHG-SN-8-FUP-USERS-ROLE-INV-EP）
- **优先级**：P2（安全）
- **现象（已核查）**：`PATCH /admin/users/:id/role`（apps/api/src/routes/admin/users.ts:98-125）仅 UPDATE DB，未 invalidate 已发 access token / refresh token / user_role cookie；权限穿越窗口最大 15 分钟
- **ADR-139 决策**（commit 83e49fbb）：方案 B（`users.role_changed_at` TIMESTAMPTZ + access token `iat` 校验）+ Redis 缓存 `user:rca:{userId}` EX 900 + middleware `resolveUser` 401 ROLE_CHANGED + refresh 端点拒绝 + 前端强制 logout；权限穿越窗口降至 0
- **EP 实施落地**（CHG-SN-8-FUP-USERS-ROLE-INV-EP）：migration 067 + DB queries + ErrorCode `ROLE_CHANGED` + middleware/refresh 双校验 + Redis 缓存写 + R-MID-1 7 文件（user.role_change actionType + user targetKind）+ 前端 api-client interceptor 强制 logout / redirect `/login?reason=role_changed` + 8 单测 PASS（含 audit payload 内容断言）
- **N1 follow-up**：N1-139-1（cache miss DB fallback）— 实施评估后选不加（保持 ADR-139 §D-139-7 默认放行策略）/ N1-139-2（ban/unban 同模式扩展）— 独立 follow-up CHG-SN-8-FUP-USERS-BAN-INV（按需启动）

### #G-users-batch-ban · 批量封禁 UI 缺失

- **页面**：P-users §4.1
- **状态**：✅ **完全闭合**（2026-05-22 / ADR-143 + EP + UI 全 PASS）
- **优先级**：P3
- **闭环路径（4/4 全 ✅）**：
  - **1/4 消费层 disabled 按钮**：CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN（commit f4b91ad5）— PageHeader disabled「批量封禁」+ tooltip 范式
  - **2/4 ADR**：CHG-SN-8-FUP-USERS-BATCH-BAN-ADR（commit de20a302）— ADR-143 A− PASS（D-143-1..6 + best-effort per-id + 三计数响应 + Self 403 + admin skip + 5 skip guards + 16 测试 surface）
  - **3/4 后端 EP**：CHG-SN-8-FUP-USERS-BATCH-BAN-EP（commit b1f8c05f）— `POST /admin/users/batch-ban` + `POST /admin/users/batch-unban` 对称双端点（zod max 50 ids + dedupe Set + 5 skip guards：self/missing/admin/already-banned + ban 写 Redis + R-MID-1 第 19/20 次系统化 user.ban + user.unban audit fire-and-forget + lib batchBanUsers/batchUnbanUsers + 16 单测 PASS）
  - **4/4 前端 UI**：CHG-SN-8-FUP-USERS-BATCH-BAN-UI — UsersListClient 消费 DataTable 原生 selection 范式（admin-ui 真源 + 零 ad-hoc 范式）+ admin row 自动屏蔽（onSelectionChange 拦截）+ sticky bottom bulk action bar（已选 N + 批量封禁 danger variant + 批量解封 + 清除选择）+ 批量封禁 confirm + 三计数 toast；删除 PageHeader 旧 disabled 按钮；5 新单测 + 全 unit 4596 PASS

### #G-users-edit-profile · 改用户邮箱 / 重置密码 / 编辑显示名缺失

- **页面**：P-users §3.5 / §4.2
- **状态**：✅ **完全闭合**（2026-05-22 / reset-pwd + ADR-140 + EP 全部 PASS）
- **优先级**：P2
- **现象（已核查）**：后端 3 端点状态 — `POST /admin/users/:id/reset-password` ✅ 已存在 / `PATCH /admin/users/:id/email` ✅ 新增（ADR-140）/ `PATCH /admin/users/:id/profile`（含 displayName / locale / avatarUrl）✅ 新增（ADR-140）
- **闭环路径（3/3）**：
  - **1/3 reset-pwd**：CHG-SN-8-FUP-USERS-RESET-PWD（commit e963e33e）— `resetUserPassword(id)` lib + `ResetPasswordModal.tsx`（2 态 + 复制 + 一次性警示）
  - **2/3 ADR**：CHG-SN-8-FUP-USERS-EDIT-ADR（commit 2523a920）— ADR-140 A− PASS（D-140-1..6 + 3 方案 trade-off + 22 测试 surface + 2 N1）
  - **3/3 EP 实施**：CHG-SN-8-FUP-USERS-EDIT-EP — 2 migration（068 users.display_name + 069 audit_log CHECK 6→13 含 user + 5 历史漂移修复）+ DB queries（updateUserEmail/updateUserProfile + mapUser displayName + findUserByEmailExcludingId 唯一性预验）+ User type 扩 displayName + R-MID-1 第 18 次系统化（user.email_change + user.profile_update + targetKind user）+ 2 PATCH route handler（admin 守卫 + 409 CONFLICT email 唯一性 + zod 校验 + audit fire-and-forget + DB UNIQUE race 23505 兜底）+ 前端 EditEmailModal + EditProfileModal + columns 2 按钮（admin disabled + tooltip）+ 22 后端单测 + 12 前端单测
- **N1 follow-up**：N1-140-1（邮件服务上线后 email 升级路径方案 B / C）按需启动；N1-140-2（email 变更后 session invalidate）按需启动

### #G-settings-webhook-impl · API·Webhook Tab 字段已存但回调未实装

- **页面**：P-settings §3.7
- **状态**：✅ **后端 + UI + 2 触发点接入闭合**（2026-05-23 / ADR-146 + EP-A + EP-B + EP-A2 + EP-A2.1 全 PASS）；剩余 3 触发点（submission.created + R2 quota cron + pending threshold cron）留独立 follow-up（按需启动）
- **优先级**：P3
- **现象（已核查）**：NotificationsTab webhookEnabled / webhookUrl / webhookSecret 写 KV；后端 apps/api/src/ + apps/worker/src/ 零发送逻辑
- **消费层补齐**：CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL — NotificationsTab warn banner 已加
- **ADR-146 决策**：方案 B 事件 enum + 用户多选订阅（不引入多 webhook 端点表）+ 5 事件类型（crawler.run.failed / storage.r2.alert / moderation.pending.threshold / submission.created / video.batch.complete）+ 方案 A 修正版 fire-and-forget WebhookDispatcher（不用 bull 队列避免 Redis 依赖；与 AuditLogService 同模式）+ HMAC-SHA256 签名（X-Resovo-Signature: sha256= 前缀对齐 GitHub 惯例 + 4 自定义 header）+ retry [5s/15s/45s] + jitter 4 次尝试 + 30s 超时 + 5xx/超时重试 4xx 不重试 + R-MID-1 第 25 次（system.webhook_send_failed audit 仅记失败）+ SSRF 5 层防御独立模块 ssrf-guard（https only / RFC 1918 私有 IP / loopback / link-local / metadata hostname）+ 5 触发点接入 + 唯一新端点 POST /admin/webhook/test + 零新 ErrorCode / 零新依赖 / 零新 migration / 零新表
- **后端实施 EP-A**（本卡 commit 待 / 2026-05-22）：CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A — 4 R-MID-1 真源（types union + WebhookEventType + ACTION_TYPES + SystemSettingKey notification_webhook_events + 2 set-equal 测试）+ ssrf-guard 独立模块（5 层防御 isAllowedWebhookUrl）+ WebhookDispatcher 核心（enqueue + dispatch + HMAC + retry [5s/15s/45s] + audit failure + sendTest 单次不重试方法）+ POST /admin/webhook/test route（admin auth + ssrf + 422/200）+ server.ts 注册 + 16 单测（14 dispatcher + 2 endpoint）全 PASS；完整 unit 4661/4663 PASS（2 pre-existing flaky）
- **前端实施 EP-B**（本卡 commit 待 / 2026-05-23）：CHG-SN-8-FUP-WEBHOOK-IMPL-EP-B — webhook-api lib（testWebhook + WEBHOOK_EVENT_TYPES enum + WEBHOOK_EVENT_LABELS map）+ NotificationsTab 5 事件订阅 checkbox（enum 驱动渲染）+ 「连通性测试」按钮（dirty 时 disabled / 调 POST /admin/webhook/test + success/failure toast）+ siteConfig zod schema 扩 notificationWebhookEvents enum array + saveSiteSettings mapper 写入 KV + queries/systemSettings 读 KV parseWebhookEvents 解析 + SiteSettings 类型扩字段 + apps/server v1 fixture 同步 + 4 新单测；全 unit 4667/4667 PASS
- **触发点接入 EP-A2**（本卡 commit 待 / 2026-05-23）：CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2 — StagingPublishService 1 触发点接入（admin 手动批量发布完成 → video.batch.complete + 系统 Job 触发不发避免噪音）+ 注入 optional WebhookDispatcher + 3 单测验证 framework 集成正确；admin 现在可在「批量发布」操作后实际收到 webhook 通知
- **CrawlerRun.failed 接入 EP-A2.1**（本卡 commit 待 / 2026-05-23）：CHG-SN-8-FUP-WEBHOOK-IMPL-EP-A2.1 — `syncRunStatusFromTasks` 加 RETURNING + 返回 SyncRunStatusResult { status, siteKey, summary }（8 处现有调用方 zero-impact，typecheck PASS）+ crawlerWorker.ts finally 块加 status=failed/partial_failed 判断 + dispatcher.enqueue('crawler.run.failed') 触发（actor=SYSTEM_ACTOR_ID）+ try/catch 兜底 webhook 触发不阻塞 worker 退出；最小侵入（只 1 处 worker 改动）覆盖所有 run 失败场景；零新单测（依赖现有 webhook-dispatcher.test 14 用例覆盖框架行为）
- **剩余触发点 follow-up**：
  - **EP-A2.2**：submission.created → 当前无用户端 POST 创建端点，需先实装用户投稿前端流程或等待 user-facing API
  - **EP-A2.3**：R2 quota + pending threshold 2 个 cron → 新建定时任务 + KV 阈值配置 + debounce 1h（工时 ~40 min）

### #G-settings-session-fields-consume · 登录会话 3 字段未被中间件消费

- **页面**：P-settings §3.8
- **状态**：🔄 已立 CHG-SN-7-MISC-SESSION-FIELDS-CONSUME
- **优先级**：P2（安全）
- **现象**：session_timeout_minutes / session_max_concurrent / session_extend_on_activity 仅存储未生效

### #G-settings-save-all · 「保存所有更改」全局按钮 — NEGATED（架构决策不实装）

- **页面**：P-settings §4.1
- **状态**：❌ NEGATED（2026-05-21 / CHG-SN-8-GAPS-SETTINGS-NEGATE）
- **优先级**：P3（不再追踪）
- **NEGATED 理由**：实证 `SettingsContainer.tsx:161-163` 注释明示：CHG-SN-6-AUDIT-DEBOUNCE-FIX 已删除「保存所有更改」按钮，理由「5 Tab 各自保存模型下无语义」（各 Tab 独立 debounced save 模式）。设计稿要求 vs 架构决策冲突由 CHG-SN-6 决议；后续不再追踪本 GAP
- **NEGATED 引用范式**：CHG-SN-7-LOW-2 双子卡决策树 / CHG-SN-8-07 NEGATED 同范式

### #G-audit-rollback-universal · 审计日志「回滚」按钮

- **页面**：P-audit §3.4
- **状态**：✅ **完全闭合**（2026-05-22 / 消费层 + ADR-138 + EP 全 PASS）
- **优先级**：P2
- **闭环路径（3/3 全 ✅）**：
  - **1/3 消费层（跳转 / disabled）**：CHG-SN-8-GAPS-AUDIT-ROLLBACK（commit 14e6b9b7）— AuditColumns actions 列「回滚」xs danger button + rollback-routes.ts 40 actionType 映射
  - **2/3 ADR**：CHG-SN-8-FUP-AUDIT-ROLLBACK-ADR（commit e446a17c）— ADR-138 A− PASS / 方案 D 混合策略
  - **3/3 实施 EP**：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP — 10 文件（R-MID-1 7 + AuditRollbackService + api-errors 3 码扩 + query 函数）+ POST /admin/audit/logs/:id/rollback 端点（admin only + 8 失败场景处理 + 字段白名单防注入）+ 首期 ~12 项纯 UPDATE 类自动回滚 / UNSUPPORTED Set ~32 项 + 19 单测 / R-MID-1 第 19 次系统化（system.audit_rollback actionType + 事务原子性）
- **后续可选优化（N1 follow-up）**：
  - **N1-138-1**：reverse_handler 渐进注册 P1/P2/P3（video.approve / home_module.create-delete / staging.publish 等复杂 actionType）→ CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 按需启动
  - **N1-138-2**：`{ force?: boolean }` 强制覆盖参数 → CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE 待运营反馈触发
  - **消费层升级**：rollback-routes.ts 可回滚 actionType 从"跳转模式"切换为"直接调 POST 端点"（独立 follow-up）

### #G-audit-time-travel · 审计日志时间穿梭未实装

- **页面**：P-audit §4.1
- **状态**：🔄 已立 CHG-SN-7-MISC-AUDIT-1（P3）
- **优先级**：P3
- **现象**：reference §5.12 设计意图 + PageHeader 按钮位预留；功能需求待用户确认

### #G-audit-self-scope · moderator/editor 自己 audit 范围限制待核

- **页面**：P-audit §0 / §7 FAQ
- **状态**：✅ **完全闭合**（2026-05-22 / 消费层 nav-hide + ADR-142 + EP 全 PASS）
- **优先级**：P2
- **现象（已核查）**：后端 `/admin/audit/*` 3 端点全 `adminOnly`（admin 角色才能调）；同组 `/admin/users` + `/admin/system/settings` 亦全 admin-only；前端 nav 对 moderator 也展示这 3 死链 → 点击 → 403 破坏 UX
- **消费层补齐**：CHG-SN-8-GAPS-AUDIT-NAV-HIDE — admin-shell-client.tsx 增 `filterNavForRole(nav, role)`，按 ADMIN_ONLY_HREFS 对非 admin 隐藏「用户管理 / 站点设置 / 审计日志」3 项；admin 看见全量；moderator 仍可见审核台/视频库等业务 nav
- **ADR 已起草 ✅**：CHG-SN-8-FUP-AUDIT-SELF-SCOPE-ADR — ADR-142 **A− PASS**（2026-05-22）；决策：方案 B（admin + moderator self-scope）/ Route 层强制覆盖 actorId / 详情端点 404 防枚举 / nav 恢复 + info banner / 零 schema 变更 / 零新 ErrorCode / 复用 idx_admin_audit_log_actor_created；端点 1-3 GET 扩 moderator，端点 4 POST rollback 维持 admin only
- **实施 follow-up**：CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP — 按 ADR-142 落 6 文件（Route 守卫 + scope 注入 + ADMIN_ONLY_HREFS 删 1 项 + banner 组件 + 12 单测 + 文档）；工时 ~0.2-0.3w

### #G-home-brand-multi · 多品牌前台消费链路

- **页面**：P-home §4.1
- **状态**：✅ 已闭合（2026-05-21 / CHG-SN-8-GAPS-HOME-BRAND-MULTI）
- **优先级**：P3
- **现象（已核查 + 闭合）**：后端 `/home/top10` + `/home/modules` 已支持 `brand_slug` query；HomeService 按 brand 过滤；问题在前端调用未传 brand_slug 始终走 null 路径（仅命中 brand_scope='all-brands'）；CHG-SN-8-GAPS-HOME-BRAND-MULTI 在 TopTenRow + FeaturedRow 引入 useBrand → URL 拼 `?brand_slug=<slug>` + useEffect deps 加 brand.slug 实现 brand 切换重 fetch
- **关联**：ADR-052 brand 协议消费侧补齐；H1 完整多品牌路径打通

### #G-user-menu-real-features · 用户菜单 profile 编辑 / preferences 全功能 / switchAccount 真实功能

- **页面**：P-moderation / 00-roles-and-permissions §4
- **状态**：🔄 部分（CHG-SN-8-FUP-USER-MENU 已提供反馈 Modal/Toast 占位）
- **优先级**：P3
- **现象**：profile 编辑筹备 / preferences 仅 theme 一项可用 / switchAccount toast 提示「M-SN-N」
- **建议**：M-SN-N 起独立 feature 卡

---

## 闭合规则

- 立 follow-up 卡时同步在本表条目添加状态 `🔄 已立 follow-up（CHG-XX）`
- 闭合时改 `✅ 已闭合（CHG-XX commit hash）`
- 5 个工作日未触动的条目应在 milestone audit 重审优先级

## 引用规约

- manual 页 §7 FAQ 可用 `GAPS.md #G-xxx` 反向引用本表
- changelog 条目涉及 gap 修复时引用对应编号

## 后续待复核

- P-image-health：所有 actions / endpoints 实证已确认（CHG-SN-8-FUP-IMAGE 通过 grep 验证 4 actions + 6 endpoints 全在位）— 无 gap
- P-crawler：CHG-SN-8-02-B 调度列已登记（不在本表，task-queue 直登记）
- 后续 batch 2-4 manual 编写时新发现 gap 追加到本表
