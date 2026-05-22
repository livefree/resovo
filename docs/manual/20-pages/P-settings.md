# P-settings · 站点设置

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/settings`（顶级真源；旧 6 URL 全 308 redirect 进来 / ADR-125）|
| 设计稿引用 | reference.md §5.11 |
| 主任务卡 | CHG-DESIGN-06（容器骨架）+ CHG-SN-7-REDO-03-A（IA 收敛 / ADR-125 / 6 URL redirect）+ -03-B（5 Tab → 8 Tab）+ -03-C（8 KV 扩 + ADR-126）+ -03-D（验收）|
| 涉及端点 | `GET /admin/settings/:tab` / `PATCH /admin/settings/:tab`（各 Tab 独立 KV 持久化）|
| 适用角色 | **admin only**（站点级配置）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-2）|

---

## 1. 这个页面是做什么的

后台站点级配置中心 — 8 类配置 Tab 容器（基础 / 缓存 / 监控 / 配置 / 迁移 / 通知 / API-Webhook / 登录会话）。仅 admin 可改。

> **IA 收敛**（CHG-SN-7-REDO-03-A / ADR-125 / 2026-05-19）：原 6 个独立 URL（/admin/system / /admin/system/settings / /admin/system/cache / /admin/system/monitor / /admin/system/config / /admin/system/migration）全部 308 permanent redirect 至 `/admin/settings(?tab=X)`；侧栏仅 1 个入口「站点设置」。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 站点设置                                              │
├──────────────────────────────────────────────────────────────────┤
│ 双栏 180px / 1fr：                                                │
│  ┌─ 左侧 Tab list (8 项) ─┬─ 右侧 Tab 内容 ─────────────────┐│
│  │ • 基础（settings）     │                                  ││
│  │ • 缓存（cache）        │  各 Tab 表单：input / textarea  ││
│  │ • 监控（monitor）      │  / toggle / banner / 提交按钮  ││
│  │ • 配置（config）       │                                  ││
│  │ • 迁移（migration）    │                                  ││
│  │ • 通知（notifications）│                                  ││
│  │ • API·Webhook         │                                  ││
│  │ • 登录会话             │                                  ││
│  └────────────────────────┴────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 基础（settings Tab）

- 站点名 / 站点描述 / brand 主色 / 默认语言 / favicon URL
- 改后立即对前台生效（CDN 缓存 5 分钟内更新）

### 3.2 缓存（cache Tab）

- 看缓存命中率 + 主动失效（按 tag / 全清）
- 危险：全清缓存会导致瞬时回源压力；建议低峰执行

### 3.3 监控（monitor Tab）

- 实时 metrics：QPS / latency p95 / 错误率
- 链 Sentry / 日志查询

### 3.4 配置（config Tab）

- 运行时 KV（env 变量映射）
- 改后**需服务重启或热加载**（取决于具体字段；UI 标示）

### 3.5 迁移（migration Tab）

- DB migration 历史 + 当前版本
- 可触发 dry-run / 实际执行（admin 仅看，执行通常走 CLI）

### 3.6 通知（notifications Tab · CHG-SN-7-REDO-03-C）

- 5 KV 扩展：SMTP host / port / from / template / enabled
- 用途：邀请用户邮件 / 系统告警 / 审核通知（与 #G-shell-notifications 关联）

### 3.7 API · Webhook（CHG-SN-7-REDO-03-C）

- 外部回调地址列表 + secret / event filter
- 实装状态：⬜ KV 字段在但回调发起逻辑未完整（GAPS.md #G-settings-webhook-impl）

### 3.8 登录会话（CHG-SN-7-REDO-03-C）

- 3 KV：session_timeout_minutes / session_max_concurrent / session_extend_on_activity
- 实装状态：⬜ 字段已存储但**中间件未消费**（CHG-SN-7-MISC-SESSION-FIELDS-CONSUME 跟踪）；GAPS.md #G-settings-session-fields-consume

## 4. 进阶操作

### 4.1 「保存所有更改」（PageHeader · 设计稿要求）

- 状态：⬜ 当前各 Tab 内独立保存；全局保存按钮未实装
- 建议：M-SN-N 加；当前需逐 Tab 保存

### 4.2 审计日志入口（PageHeader · 设计稿要求）

- 状态：⬜ 未实装；当前需手动跳 `/admin/audit?targetKind=settings`

## 5. 字段含义

详见各 Tab 内表单 label + hint；KV 字段定义在后端 `apps/api/src/db/queries/settings.ts`。

## 6. 状态颜色

| 颜色 | 用途 |
|---|---|
| 绿（ok）| 已保存 / 服务运行中 |
| 黄（warn）| 待重启生效 / 待审核 |
| 红（danger）| migration 失败 / SMTP 未配 |
| 蓝（info）| 缓存命中率 / monitor 指标 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 访问 /admin/system 跳到 /admin/settings | ADR-125 IA 收敛 308 永久 redirect | 正常行为 |
| 改了 config 不生效 | 某些字段需热加载 / 服务重启 | 查 Tab 内提示 |
| 通知邮件未发 | SMTP KV 未配 / enabled=false | 通知 Tab 检查 |
| 登录超时无效 | session_timeout_minutes 字段未消费（GAPS）| M-SN-N |

## 8. 与其他页面的关系

- → 跳出到 [P-audit](./P-audit.md)：所有 settings 改动写 audit log
- ← 跳入自 [P-users](./P-users.md)：邀请邮件配置在通知 Tab
- ← 跳入自 [P-image-health](./P-image-health.md)：fallback 域配置可能在 config Tab
