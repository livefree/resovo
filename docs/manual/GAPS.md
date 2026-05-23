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
- **状态**：⚠️ **已部分实装**（按钮存在 disabled + tooltip「功能开发中（follow-up VIDEO-MANUAL-ADD）」）；实际创建功能待 follow-up
- **优先级**：P2
- **现状**：VideoListClient.tsx:685 `<button disabled title="功能开发中（follow-up VIDEO-MANUAL-ADD）">手动添加视频</button>`；H2 死按钮已避免（disabled+title 不算死按钮），但实际功能未实装
- **建议**：将 disabled 按钮改造为「直接打开 VideoEditDrawer 创建模式」+ 后端 POST 端点；或保留 disabled 不补

### #G-moderation-batch-ui · 批量审核独立入口

- **页面**：P-moderation §4.2 / §3.5（新增）
- **状态**：✅ 已闭合（2026-05-21 / CHG-SN-8-GAPS-MOD-BATCH）
- **优先级**：P1（审核效率）
- **修复**：ModerationConsole 增「批量模式」toggle（位于 approveAndPublishOn 旁；仅 pending tab）+ ModListRow checkbox 支持 + bulk action bar（fixed bottom：批量通过 / 批量拒绝 / 清除选择）+ batchApproveVideos / batchRejectVideos lib 封装

### #G-moderation-preset-team · FilterPreset 多账号共享缺失

- **页面**：P-moderation §3.4 / §7 FAQ
- **状态**：⚠️ 已部分实装（CHG-SN-8-GAPS-PRESET-LOCAL-BADGE 消费层视觉警示；团队共享 follow-up：CHG-SN-8-FUP-PRESET-TEAM-EP）
- **优先级**：P3
- **现象（已核查）**：`apps/server-next/src/lib/moderation/use-filter-presets.ts:5` localStorage 持久化（key `admin.moderation.presets.v1`），仅本浏览器；同团队审核员无法共享预设（原描述「sessionStorage」实证为 localStorage，已修正）
- **消费层补齐**：CHG-SN-8-GAPS-PRESET-LOCAL-BADGE — FilterPresetPopover header 加「仅本地」warn chip + tooltip（state-warning-bg + cursor: help + title 含"未跨账号同步 + 团队共享待 follow-up + 指向 GAPS"）；与 DASH-ACTIVITY mock 警示同范式
- **团队共享 follow-up**：CHG-SN-8-FUP-PRESET-TEAM-EP — 起 ADR-141（或后续可用编号）设计后端 `user_filter_presets` 表（user_id / name / query_jsonb / scope: 'private' \| 'team' / tab_filter / is_default / created_at）+ 4 端点（GET list / POST create / PATCH 编辑 / DELETE）+ 前端 scope toggle + 团队成员预设可见性策略；需 Opus arch-reviewer 评审；工时 ADR ~0.2w + 实施 ~0.4w

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
- **状态**：⚠️ 已部分实装（CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN disabled 入口；后端 follow-up：CHG-SN-8-FUP-USERS-BATCH-BAN-EP）
- **优先级**：P3
- **现象**：无端点 + 无 batch UI；当前需逐行操作
- **消费层补齐**：CHG-SN-8-GAPS-USERS-BATCH-BAN-BTN — UsersListClient PageHeader actions 加 disabled「批量封禁」按钮 + tooltip（H2 死按钮豁免范式，同 P-videos「+ 添加视频」/ audit-rollback 未支持类型 disabled）；tooltip 明示「筹备中」+ 指向 GAPS / follow-up
- **后端实装 follow-up**：CHG-SN-8-FUP-USERS-BATCH-BAN-EP — 起 ADR-N 设计 `POST /admin/users/batch-ban` 端点（含 ids: UUID[] / max batch size / admin 目标 skip + 部分失败处理 / R-MID-1 `user.ban` 批量 audit）+ 前端 batch mode toggle + bulk action bar（参 ModerationBatch / CHG-SN-8-GAPS-MOD-BATCH 范式）；需 Opus arch-reviewer 评审；工时 ADR ~0.2w + 实施 ~0.3w

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
- **状态**：⚠️ 已部分实装（CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL 消费层视觉警示；后端实装 follow-up：CHG-SN-8-FUP-WEBHOOK-IMPL）
- **优先级**：P3
- **现象（已核查）**：前端字段在「通知设置」Tab Webhook card（apps/server-next/src/app/admin/settings/_tabs/NotificationsTab.tsx）可填 enabled / URL / 签名密钥，写入 KV 通过 saveSiteSettings；但后端 `apps/api/src/` + `apps/worker/src/` **零** webhook 发送逻辑（grep 实证 `webhookEnabled` / `sendWebhook` 0 匹配）— 字段存了但永远不会向 URL 发任何 HTTP POST
- **消费层补齐**：CHG-SN-8-GAPS-WEBHOOK-NOT-IMPL — NotificationsTab webhook card subtitle 改 `⚠️ 字段存储有效但触发逻辑未实装（CHG-SN-8-FUP-WEBHOOK-IMPL follow-up）`；card 顶部加 warn banner（state-warning-bg + 明示「不会向该 URL 发送任何 HTTP POST」+ 指向 GAPS）；字段保留可填以便实装后无迁移成本
- **后端实装 follow-up**：CHG-SN-8-FUP-WEBHOOK-IMPL — 起 ADR-N（编号待定）设计 webhook 触发协议：① 事件订阅枚举（采集失败 / 存储告警 / 审核待处理超阈值 / 用户投稿新增 等）② HTTP POST + HMAC-SHA256 签名（X-Resovo-Signature 头）③ 重试策略（exponential backoff + 最多 3 次）④ 失败 audit log 类型 `system.webhook_send_failed` ⑤ worker job 派发模式 vs route 内联触发；需 Opus arch-reviewer 评审；工时 ADR ~0.25w + 实施 ~0.5w（含 worker job）

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
