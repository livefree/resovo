# P-users · 用户管理

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）
> owner: @engineering
> scope: 用户管理页面使用说明 — 用户列表、角色变更、权限管理、邀请新员工
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/users` |
| 设计稿引用 | reference.md §5.10 + §6.4 列规范 |
| 主任务卡 | CHG-SN-5-03（视图基座）+ CHG-SN-7-MISC-USERS-1（PageHeader actions: RoleMatrix + Invite）+ CHG-SN-7-MISC-USERS-2（KPI×4 + ADR-136）+ CHG-SN-8-MANUAL-BATCH-2（手册定稿） |
| 涉及端点 | `GET /admin/users` / `GET /admin/users/stats`（ADR-136）/ `PATCH /admin/users/:id/role` / `PATCH /admin/users/:id/ban` / `PATCH /admin/users/:id/unban` |
| 适用角色 | **admin only**（含 role 变更 / ban / unban；moderator+ 仅可看列表）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-2）|

---

## 1. 这个页面是做什么的

后台用户管理工作台 — 看 5 角色矩阵 / KPI 4 / 邀请新用户 / 改角色 / 封禁解封。仅 admin 可改写。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 用户管理 · 副标题 N 用户 · M 活跃                    │
│ Actions: 「角色矩阵」（RoleMatrixModal 只读）+ 「邀请用户」       │
├──────────────────────────────────────────────────────────────────┤
│ KPI 4 列：总数 / 活跃 / 今日新增 / 已封禁（CHG-SN-7-MISC-USERS-2）│
├──────────────────────────────────────────────────────────────────┤
│ DataTable：avatar + name + role pill + email + scope +           │
│            last_login + 2FA + actions（编辑 / shield / 封禁）    │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 看角色矩阵（RoleMatrixModal · 只读）

- **位置**：PageHeader「角色矩阵」按钮
- **内容**：展示 5 角色（admin / moderator / editor / crawler / viewer）× 关键操作权限矩阵
- **用途**：admin 新员工分配角色前查看可操作范围
- **关联**：与 [00-roles-and-permissions.md](../00-roles-and-permissions.md) 同源

### 3.2 邀请用户（InviteUserModal）

- **位置**：PageHeader「邀请用户」primary 按钮
- **流程**：填邮箱 + 选角色 + 可选范围 → 提交 → 后端发邀请邮件 + 创建 pending 用户
- **失败**：邮箱重复 → toast「该邮箱已注册」

### 3.3 改用户角色（行级）

- **位置**：行尾 actions 区「shield」icon 按钮 → 角色选择 Modal
- **行为**：调 `PATCH /admin/users/:id/role` + audit log
- **权限**：仅 admin 可改其他用户角色
- **影响**：用户下次访问时新角色生效；**session 即时失效**（ADR-139 + CHG-SN-8-FUP-USERS-ROLE-INV-EP 闭合）— middleware/refresh 校验 token.iat vs users.role_changed_at + Redis 缓存 `user:rca:{id}` EX 900；旧 access token 立即返 401 `ROLE_CHANGED`；前端 api-client interceptor 识别后强制 logout + 跳转 `/login?reason=role_changed`

### 3.4 封禁 / 解封

- **封禁**：行尾「trash」danger icon → confirm → `PATCH /admin/users/:id/ban`
- **解封**：banned 行尾「解封」按钮 → `PATCH /admin/users/:id/unban`
- **效果**：被封禁用户无法登录；**session 即时失效**（ADR-139 N1-139-2 + CHG-SN-8-FUP-USERS-BAN-INV 闭合 2026-05-22）— ban 同步更新 users.role_changed_at = NOW() + Redis user:rca cache；旧 access/refresh token 立即返 401 ROLE_CHANGED；前端 api-client interceptor 强制 logout + 跳转 /login?reason=role_changed
- **回滚**：unban 恢复登录权（旧 token 在 ban 时已失效，用户必须重新登录获新 token）
- **audit 追溯**：✅ user.ban / user.unban actionType audit log 已写入（R-MID-1 第 20 次系统化 / CHG-SN-8-FUP-USERS-BAN-AUDIT 2026-05-22）— ban payload `{before: {banned_at: null}, after: {banned_at: NEW}}` / unban payload `{before: {banned_at: OLD}, after: {banned_at: null}}`

### 3.5 重置密码

- **位置**：行尾 actions 区「重置密码」ghost 按钮
- **行为**：confirm Modal → 后端 `POST /admin/users/:id/reset-password` 生成 12 位随机密码 → success Modal 展示密码 + 复制按钮
- **权限**：admin 可重置 user/moderator；admin 目标 disabled + tooltip（后端 403 一致）
- **一次性警示**：「关闭后不可复看；如遗失需再次重置」— 关闭 Modal 后密码不留痕
- **安全**：密码明文一次性返回，不入日志；需通过安全渠道告知用户

## 4. 进阶操作

### 4.1 批量封禁
- **状态**：✅ **完全实装**（ADR-143 + EP + UI 全闭合 / 2026-05-22）
- **后端端点**（POST，admin only，max 50 ids，best-effort per-id）：
  - `POST /admin/users/batch-ban`：ban 多用户，返回 `{ banned, skipped, failed }`；skip 5 类（self/missing/admin/already-banned/dedup）；每个成功 ban 写 Redis `user:rca:{id}` EX 900s（ADR-139 session invalidate）+ R-MID-1 user.ban audit
  - `POST /admin/users/batch-unban`：unban 多用户，返回 `{ unbanned, skipped, failed }`；skip 2 类（self/missing/not-banned/dedup）；不写 Redis；R-MID-1 user.unban audit
  - 422 校验失败（ids=[] / ids>50 / 非 UUID）；403 非 admin；零 BLOCKER（不存在的 id 不抛错按 skip）
- **前端 UI**：表格首列 checkbox（DataTable 原生 selection），勾选后底部自动出现 bulk action bar（已选 N + 批量封禁 + 批量解封 + 清除选择）；admin 行选中后自动被 onSelectionChange 拦截过滤（与后端 admin skip 一致）
- **操作流程**：勾选用户 → 「批量封禁」按钮 → 确认对话框（提示「将立即终止会话 + 可解封恢复」）→ 后端处理 → toast 显示三计数（成功 N · 跳过 M · 失败 K）
- **当前限制**：单次最多 50 ids（zod 上限）；超过需分多批；后端串行处理 p95 ~500ms（N1-143-1 并行 pipeline 待按需优化）

### 4.2 改用户邮箱 / 编辑显示名
- **状态**：✅ **已实装**（ADR-140 + CHG-SN-8-FUP-USERS-EDIT-EP 闭合 / 2026-05-22）
- **改邮箱**：行尾「改邮箱」ghost btn → EditEmailModal → 后端 `PATCH /admin/users/:id/email`
  - 唯一性：Service 层 prevalidation + DB UNIQUE 双保险（409 CONFLICT）
  - 同邮箱幂等不写 DB / 不写 audit
  - admin 目标 disabled + tooltip + 后端 403 双层保护
  - audit log：`user.email_change` actionType + before/after.email
- **编辑资料**：行尾「编辑资料」ghost btn → EditProfileModal（displayName / locale / avatarUrl 3 字段，至少一个必填）→ 后端 `PATCH /admin/users/:id/profile`
  - displayName 1-50 + Unicode 字符集（多语言字母/数字/Emoji/空格/`-_.`）；null = 清除
  - locale BCP 47（en / zh-CN）
  - avatarUrl URL 校验；null = 清除
  - audit 仅含实际变更字段（partial before/after）
- **当前限制**：邮件验证流程未实装（ADR-140 D-140-2 因项目无邮件服务，方案 A 直接生效）；未来邮件服务上线后可升级为方案 B（用户确认）/ C（旧邮箱通知）— N1-140-1 follow-up

## 5. 字段含义

| 列 | 含义 | 取值 |
|---|---|---|
| avatar | 30×30 渐变背景 + 首字母 | UI |
| name + @username | 显示名 + 用户名 | string |
| role | 角色 pill | admin/moderator/editor/crawler/viewer |
| email | 邮箱 mono muted | string |
| scope | 权限范围 | string（如 brand_default）|
| last_login | 最后登录时间 | timestamp |
| 2FA | 已开 / 未开 | boolean |
| status | 正常 / 已封禁 | 计算字段 |

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 红（danger）| admin / 已封禁 |
| 黄（warn）| moderator / 2FA 未开 |
| 蓝（info）| editor / crawler |
| 灰（muted）| viewer / 已离职 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「邀请用户」按钮缺失 | 当前角色不是 admin | 联系 admin 操作 |
| 改角色后用户仍能访问 admin | **不应再发生**（ADR-139 + CHG-SN-8-FUP-USERS-ROLE-INV-EP 闭合 0 穿越窗口）；如仍出现请检查 Redis 是否宕机（cache miss 时 fallback 放行，最大 15min 后旧 token 自然过期）| 立即让用户登出 + 重启 Redis（确保缓存恢复）|
| 邀请邮件未收到 | 邮件服务可能未配置 | 查 Settings → 通知 Tab |
| 看不到所有用户 | 分页隐藏；调 page size | 翻页或调 limit |

## 8. 与其他页面的关系

- → 跳出到 [P-audit](./P-audit.md)：所有角色变更 / 封禁动作均写 audit log
- → 跳出到 [P-settings](./P-settings.md)：通知 Tab 配 SMTP 邮件邀请
- ← 跳入自 [P-dashboard](./P-dashboard.md)：AttentionCard 异常用户告警深链（如「N 人 2FA 未开」）
