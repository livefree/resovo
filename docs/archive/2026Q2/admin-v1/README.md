# Admin v1 时代历史输入归档

> 归档时间：2026-05-21（CHG-SN-7-CLEANUP-01-A）
> 来源：原顶层 docs
> 性质：M0–M6 / admin v1 时代的设计 brief、审计与日志方案；**仅作历史输入，不作 server-next 实现模板**。

## 清单

| 文件 | 内容 | 当前真源替代 |
|---|---|---|
| `admin_audit_20260426.md` | admin v1 全面审计（9 大痛点）| `docs/designs/backend_design_v2.1/reference.md` + plan §G2 痛点解决追踪 |
| `admin_design_brief_20260426.md` | admin v1 设计 brief（5 项推荐）| `docs/designs/backend_design_v2.1/reference.md` |
| `logging_system_proposal_20260425.md` | 日志系统提案（109KB 完整方案）| `docs/rules/logging-rules.md`（已正式化）|
| `run-logs.md` | M0–M6 时期 BLOCKER 与运行日志记录 | `docs/changelog.md`（M-SN-1+ 后改用 changelog）|

## 用途

- 追溯 server-next 项目的"原始痛点 → 解决方案"映射
- 日志规范的设计动机与背景
- 不作为新开发参考；新规则一律以 `docs/rules/` + `docs/architecture.md` 为准

## 关联追踪

- admin v1 物理目录 `apps/server/` 仍存在但已冻结（M-SN-7 cutover commit 内删除）
- 9 大痛点解决追踪见 `docs/server_next_plan_20260427.md` §G2
