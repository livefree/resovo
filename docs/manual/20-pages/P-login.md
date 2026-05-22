# P-login · 登录

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-3 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/login`（顶层路由，不在 `/admin/*` 下；ADR-100 IA 决策）|
| 设计稿引用 | reference.md §5.16 |
| 主任务卡 | CHG-SN-7-MISC-LOGIN-1（视觉对齐 / 8 unit PASS）+ CHG-SN-8-MANUAL-BATCH-3（手册定稿） |
| 涉及端点 | `POST /auth/login`（apps/api jwt）+ `POST /auth/logout` |
| 适用角色 | 匿名（未登录用户）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-3）|

---

## 1. 这个页面是做什么的

后台登录入口。运营 / 审核员 / admin 通过邮箱+密码进入 `/admin/*` 控制台。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ 全屏居中（grid placeItems: center / minHeight: 100vh）           │
│ 背景：radial-gradient accent 12% overlay（CHG-SN-7-MISC-LOGIN-1）│
│                                                                  │
│         ┌─ Login Card（400 × padding 40 · bg2/border/r-4）┐    │
│         │  Brand row (36px logo + 18px title + 11px sub)  │    │
│         │  Email input                                     │    │
│         │  Password input                                  │    │
│         │  □ 记住我（remember checkbox）                   │    │
│         │  ──── 或者 ────                                  │    │
│         │  [SSO 登录 · disabled 占位]                      │    │
│         │  「登录」primary button                          │    │
│         │  审计提示：本次登录将写入 audit log              │    │
│         └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 邮箱密码登录

- **步骤**：填邮箱 + 密码 → 点「登录」→ 跳 `/admin`（dashboard）
- **失败处理**：
  - 401 INVALID_CREDENTIALS → 「邮箱或密码错误」
  - 403 BANNED → 「账号已封禁，联系 admin」
  - 5xx → 「服务暂时不可用」
- **2FA**：如启用，登录后跳 2FA 输入页（CHG-SN-N follow-up；当前未实装）

### 3.2 记住我（remember checkbox）

- 勾上 → JWT 过期时间延长（7 天 vs 默认 1 天）
- session_timeout_minutes 字段消费待 #G-settings-session-fields-consume 实装

### 3.3 找回密码

- **状态**：⬜ self-serve 找回功能 **未实装**
- **当前替代**：联系 admin 在 `/admin/users` 操作重置（GAPS.md #G-login-self-recover）

### 3.4 SSO 登录

- **状态**：⬜ 视觉占位 disabled 按钮；功能未实装（GAPS.md #G-login-sso）

## 4. 进阶操作

### 4.1 登出（位于 admin 内 UserMenu）

- 入口：登录后的 admin 页 → UserMenu → 「登出」
- 行为：`POST /auth/logout` + cookie 清空 + 跳 `/login`

## 5. 字段含义

| 字段 | 含义 |
|---|---|
| email | 用户邮箱（unique）|
| password | 加密存储（bcrypt）|
| remember | bool（影响 JWT TTL）|

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 红 | 登录失败 / 封禁 |
| 灰 | SSO disabled 占位 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「找回密码」缺失 | self-serve 未实装 | 联系 admin 重置 |
| SSO 按钮灰显 | 占位（GAPS）| 走邮箱密码 |
| 登录后立即被踢出 | 角色变更 / session 失效 | 重新登录 |
| 记住我 7 天未生效 | session_timeout_minutes 中间件未消费（GAPS）| follow-up |

## 8. 与其他页面的关系

- → 跳出到 [P-dashboard](./P-dashboard.md)：登录成功默认跳转
- ← 跳入自所有 `/admin/*` 未鉴权时被中间件 redirect
