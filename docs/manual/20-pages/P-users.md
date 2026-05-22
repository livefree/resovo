# P-users · 用户管理

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）

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
- **影响**：用户下次访问时新角色生效；当前 session 暂不强制踢出（最大 15 分钟 access token TTL 后自然失效；ADR-139 已起草 0 穿越窗口方案，待实施 CHG-SN-8-FUP-USERS-ROLE-INV-EP；GAPS.md #G-users-role-session-invalidate 🔄 ADR 已起草）

### 3.4 封禁 / 解封

- **封禁**：行尾「trash」danger icon → confirm → `PATCH /admin/users/:id/ban`
- **解封**：banned 行尾「解封」按钮 → `PATCH /admin/users/:id/unban`
- **效果**：被封禁用户无法登录；session 立即失效（如已登录）
- **回滚**：unban 恢复登录权

### 3.5 重置密码

- **位置**：行尾 actions 区「重置密码」ghost 按钮
- **行为**：confirm Modal → 后端 `POST /admin/users/:id/reset-password` 生成 12 位随机密码 → success Modal 展示密码 + 复制按钮
- **权限**：admin 可重置 user/moderator；admin 目标 disabled + tooltip（后端 403 一致）
- **一次性警示**：「关闭后不可复看；如遗失需再次重置」— 关闭 Modal 后密码不留痕
- **安全**：密码明文一次性返回，不入日志；需通过安全渠道告知用户

## 4. 进阶操作

### 4.1 批量封禁
- **状态**：⚠️ 入口已加（PageHeader「批量封禁」disabled 按钮 + tooltip 明示筹备中）；后端 batch endpoint + batch mode UI follow-up CHG-SN-8-FUP-USERS-BATCH-BAN-EP（GAPS.md #G-users-batch-ban）
- **当前替代**：逐行操作（PageHeader disabled 按钮 hover 显示提示）

### 4.2 改用户邮箱 / 编辑显示名
- **状态**：🔄 ADR 已起草（ADR-140 A− PASS 2026-05-21 / CHG-SN-8-FUP-USERS-EDIT-ADR）；实施 follow-up CHG-SN-8-FUP-USERS-EDIT-EP 待立
- **ADR-140 设计**：双端点 `PATCH /admin/users/:id/email` + `PATCH /admin/users/:id/profile`（displayName + locale + avatarUrl）/ email 直接生效（无邮件服务基础设施）/ users 加 display_name 列 / audit log 扩 `'user'` targetKind + 2 actionType / admin 互改保护沿用现有 role === 'admin' 守卫 / 触发 R-MID-1 7 文件框架
- **当前替代**：实施完成前 admin 仍走数据库直接改邮箱 / displayName

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
| 改角色后用户仍能访问 admin | access token 15min TTL 内权限穿越（ADR-139 已起草 0 穿越方案，待实施 CHG-SN-8-FUP-USERS-ROLE-INV-EP）| 临时：让用户登出再登 |
| 邀请邮件未收到 | 邮件服务可能未配置 | 查 Settings → 通知 Tab |
| 看不到所有用户 | 分页隐藏；调 page size | 翻页或调 limit |

## 8. 与其他页面的关系

- → 跳出到 [P-audit](./P-audit.md)：所有角色变更 / 封禁动作均写 audit log
- → 跳出到 [P-settings](./P-settings.md)：通知 Tab 配 SMTP 邮件邀请
- ← 跳入自 [P-dashboard](./P-dashboard.md)：AttentionCard 异常用户告警深链（如「N 人 2FA 未开」）
