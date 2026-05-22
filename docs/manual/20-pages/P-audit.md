# P-audit · 审计日志

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/audit` |
| 设计稿引用 | reference.md §5.12 + §6.5 列规范 |
| 主任务卡 | CHG-SN-6-01（视图基座）+ CHG-SN-7-MISC-FILE-SIZE（AuditClient 拆分 → AuditDetailDrawer + AuditColumns）+ CHG-SN-8-MANUAL-BATCH-2（手册定稿）|
| 涉及端点 | `GET /admin/audit/logs`（含 filter）/ `GET /admin/audit/logs/:id`（详情）/ `GET /admin/audit/enums`（actionType + targetKind 枚举元数据）|
| 适用角色 | **admin only**（查看完整审计日志）；moderator/editor 仅可看自己的 audit 条目（GAPS.md #G-audit-self-scope 待核） |
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-2）|

---

## 1. 这个页面是做什么的

后台所有写动作的完整审计日志查询入口 — 每个 admin/moderator/editor 角色发起的修改（视频审核 / 用户角色变更 / 合并拆分 / 设置改动 / 采集触发 等）都自动写 audit log。本页支持时间 / 用户 / actionType / targetKind / IP 多维 filter + 详情 Drawer + 导出 CSV。

合规与排查双重价值：① 满足审计合规（谁在何时做了什么）② 故障 / 误操作时回溯查找根因。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 审计日志                                              │
│ Actions: 「导出 CSV」+ 「时间穿梭」（GAPS / 未实装）              │
├──────────────────────────────────────────────────────────────────┤
│ Filter bar：搜索 / 用户 chip / actionType chip / targetKind chip │
│            / 时间范围 / 总数 N                                    │
├──────────────────────────────────────────────────────────────────┤
│ DataTable：time / user / action pill / target mono / change /    │
│            ip mono / actions（查看 diff / 回滚）                 │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 多维 filter 查询

- **搜索**：targetId / 中文模糊
- **user chip**：选具体审核员（autocomplete）
- **actionType chip**：enum filter（video.approve / video_merge / user.role_change / settings.update / ...）
- **targetKind chip**：video / user / settings / banner / source / 等
- **时间范围**：从-到 + 快捷「今日」「本周」「30 天」

### 3.2 看详情（AuditDetailDrawer）

- **触发**：行尾「查看 diff」按钮
- **内容**：变更前后字段对比（payload diff）+ 关联 metadata + 操作人 + 时间 + IP
- **关闭**：Esc / 点 backdrop

### 3.3 导出 CSV

- **位置**：PageHeader 「导出」
- **行为**：按当前 filter 导出（最多 N 条限制）
- **依赖**：csv-export 共享工具

### 3.4 「回滚」（行尾 danger 按钮）

- **状态**：⬜ **UI 占位但未通用实装**（仅特定 actionType 如 user.ban / video.approve 可走对应业务的反向 API）
- **登记 GAPS.md #G-audit-rollback-universal**

## 4. 进阶操作

### 4.1 时间穿梭（PageHeader 设计稿要求）
- **状态**：⬜ **未实装**（CHG-SN-7-MISC-AUDIT-1 标 🟢 P3 / 0.4-0.6w / 功能需求待用户确认）
- **设计意图**：选某时间点 → 看「假设回滚到此时所有数据状态」
- **GAPS.md #G-audit-time-travel**

### 4.2 跨表关联查询
- 当前 audit 表单表查询；跨 audit + videos JOIN 需后端单独支持
- ⬜ 未实装

## 5. 字段含义（reference §6.5）

| 列 | 含义 | 取值 |
|---|---|---|
| time | 操作时间 | timestamp |
| user | 操作人 | userId + displayName |
| action | 动作类型 pill | enum from `/admin/audit/enums` actionType |
| target | 操作对象 | targetKind + targetId（mono）|
| change | 变更摘要 | text-2 fs 11（如 `review: pending → approved`）|
| ip | 来源 IP | mono muted |
| actions | xs btn | 「查看 diff」/「**回滚(danger)**」|

## 6. 状态颜色

| pill 颜色 | actionType dot key | 含义 |
|---|---|---|
| 绿（ok）| `*.approve` / `*.create` | 成功创建 / 通过类 |
| 黄（warn）| `*.update` / `*.reject` | 修改 / 拒绝 |
| 红（danger）| `*.delete` / `*.ban` / `*.split` | 不可逆破坏类 |
| 蓝（info）| `*.export` / `*.view` | 只读类（如有写入审计）|

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「回滚」按钮无响应 | 通用回滚未实装（GAPS）| 走对应业务页反向操作 |
| 看不到某用户的审计 | filter 时间范围 / 用户名拼写 | 调宽 filter |
| 「时间穿梭」按钮缺失 | 未实装 | GAPS.md #G-audit-time-travel |
| 导出 CSV 字段不全 | csv-export 仅可见列 | 先调列显示 → 再导 |
| 看不到我的 audit | 当前角色非 admin 且 #G-audit-self-scope 未实装 | 联系 admin |

## 8. 与其他页面的关系

- ← 跳入自 **所有写动作页**：每个 P-* 的 mutation 都会写 audit log
- → 跳出到对应业务页：行内「查看视频」/「查看用户」深链
- ↔ 关联工作流：所有 W1-W5 失败 / 异常排查路径
