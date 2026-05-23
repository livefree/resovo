# P-audit · 审计日志

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/audit` |
| 设计稿引用 | reference.md §5.12 + §6.5 列规范 |
| 主任务卡 | CHG-SN-6-01（视图基座）+ CHG-SN-7-MISC-FILE-SIZE（AuditClient 拆分 → AuditDetailDrawer + AuditColumns）+ CHG-SN-8-MANUAL-BATCH-2（手册定稿）|
| 涉及端点 | `GET /admin/audit/logs`（含 filter）/ `GET /admin/audit/logs/:id`（详情）/ `GET /admin/audit/enums`（actionType + targetKind 枚举元数据）|
| 适用角色 | **admin**（全量审计日志）+ **moderator self-scope**（待 CHG-SN-8-FUP-AUDIT-SELF-SCOPE-EP 实施，ADR-142 A− PASS 已起草 2026-05-22）；moderator 当前仍由 CHG-SN-8-GAPS-AUDIT-NAV-HIDE nav 过滤隐藏入口，EP 落地后恢复 nav + 加 info banner（"仅显示你的操作记录"）；POST rollback 维持 admin only（ADR-138 D-138-2）（GAPS.md #G-audit-self-scope） |
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

- **状态**：⚠️ 消费层已实装（CHG-SN-8-GAPS-AUDIT-ROLLBACK / 通用后端 endpoint follow-up：CHG-SN-8-FUP-AUDIT-ROLLBACK-EP）
- **行为**：按 actionType 跳转对应业务页执行反向操作（零新后端端点）：
  - `video.approve` / `video.reject_labeled` → `/admin/moderation?id=<videoId>&action=reopen`（重开审核）
  - `video.reopen` → `/admin/moderation?id=<videoId>`（重新审核）
  - `staging.publish` / `staging.batch_publish` → `/admin/staging?id=<videoId>&action=revert`（回滚到暂存）
  - `staging.revert` → `/admin/moderation?id=<videoId>`（重新审核可再 approve_and_publish）
  - `video.merge` → `/admin/merge?tab=merged`（撤销合并）
  - `video.unmerge` → `/admin/merge?tab=merged`（重新合并）
  - `video.split` → `/admin/merge?tab=split`（撤销拆分）
  - `video_source.toggle` / `disable_dead_batch` → `/admin/sources?videoId=<id>`
  - `home_module.*` → `/admin/home`（首页编辑器内回滚）
  - `user_submission.action` → `/admin/user-submissions`
- **不可回滚类型**（按钮 disabled + tooltip）：`crawler.*` / `crawler_run.*` / `crawler_site.*` / `image_health.*` / `system.*` / `sources.route_action` / `source_line_alias.upsert` / `video.refetch_sources` — 这些是采集/重扫/导入等单向只增操作，无反向语义
- **未知 actionType**：按 targetKind fallback 跳详情页（video → /admin/videos / user → /admin/users 等）
- **通用后端端点**：✅ **已实装**（CHG-SN-8-FUP-AUDIT-ROLLBACK-EP / ADR-138 / 2026-05-22）
  - **端点**：`POST /admin/audit/logs/:id/rollback`（admin only）
  - **方案 D 混合策略**：JSONB diff 反向 UPDATE 通用路径（首期 ~12 个简单 UPDATE 类 actionType）+ reverse_handler 注册扩展点（首期空 Map，N1-138-1 渐进注册）+ UNSUPPORTED Set ~32 项（含 24 项原 ADR 不可回滚 + 8 项 N1-138-1 暂入待 handler）
  - **字段白名单**：防 password_hash / role 等敏感字段被 audit log 注入回滚（11 target_kind 各有独立白名单）
  - **8 失败场景处理**：UNSUPPORTED（不可回滚 / target_id NULL / before_jsonb NULL / 二次回滚 4 子类）/ STALE（after_jsonb 与当前 DB 不一致 / UNIQUE 违反 23505）/ SCHEMA_DRIFT（白名单交集为空 / PG 42703 字段不存在）/ NOT_FOUND（audit_log 不存在 / 目标业务行不存在 / soft-deleted）
  - **3 新 ErrorCode**：`AUDIT_ROLLBACK_UNSUPPORTED` 422 / `AUDIT_ROLLBACK_STALE` 409 / `AUDIT_ROLLBACK_SCHEMA_DRIFT` 422
  - **R-MID-1 第 19 次系统化**：新 actionType `system.audit_rollback` 形成 audit-of-audit 追溯链；事务内 INSERT 保证原子性
  - **响应**：`{ rolledBack: true, rollbackAuditLogId, warnings? }`；warnings 列出被白名单过滤的字段
- **N1 follow-up**：reverse_handler 渐进注册 P1/P2/P3（CHG-SN-8-FUP-AUDIT-ROLLBACK-HANDLERS 按需） / `force` 强制覆盖参数（CHG-SN-8-FUP-AUDIT-ROLLBACK-FORCE 待运营反馈） / 消费层升级（rollback-routes.ts 切换为"直接调端点"）

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
| 「回滚」按钮 disabled | actionType 是单向操作（crawler/system/image_health 等无反向） | 该操作无法回滚 / follow-up CHG-SN-8-FUP-AUDIT-ROLLBACK-EP 通用端点 |
| 「回滚」按钮点击未触发业务回退 | 当前跳转到业务页面，需手动执行二次确认 | 跳过去后按业务页面的反向 action（如 moderation reopen / staging revert） |
| 看不到某用户的审计 | filter 时间范围 / 用户名拼写 | 调宽 filter |
| 「时间穿梭」按钮缺失 | 未实装 | GAPS.md #G-audit-time-travel |
| 导出 CSV 字段不全 | csv-export 仅可见列 | 先调列显示 → 再导 |
| 看不到我的 audit | 当前角色非 admin 且 #G-audit-self-scope 未实装 | 联系 admin |

## 8. 与其他页面的关系

- ← 跳入自 **所有写动作页**：每个 P-* 的 mutation 都会写 audit log
- → 跳出到对应业务页：行内「查看视频」/「查看用户」深链
- ↔ 关联工作流：所有 W1-W5 失败 / 异常排查路径
