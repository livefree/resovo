# Docs 索引（唯一入口）

> status: active
> owner: @engineering
> scope: docs navigation and document status index
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-23

本文件用于快速定位“当前生效文档”。执行约束仍以仓库根目录 `CLAUDE.md` 为准。

## 1. 权威文档（Source of Truth）

1. `CLAUDE.md`（仓库根目录）: 执行规范唯一准则。
2. `docs/architecture.md`: 系统架构与模块边界。
3. `docs/decisions.md`: 架构决策记录（ADR）。
4. `docs/frontend_design_spec_20260423.md`: 前台设计系统与布局规范。
5. `docs/roadmap.md`: 开发阶段目标与里程碑。
6. `docs/task-queue.md`: 任务序列池与状态追踪。
7. `docs/tasks.md`: 单任务工作台。
8. `docs/changelog.md`: 完成任务变更历史。
9. `docs/run-logs.md`: 运行日志与 BLOCKER 记录。

## 2. 活跃方案（Active Plans）

1. `docs/video_admin_unified_plan_20260325.md`
2. `docs/admin_table_ux_fix_plan_20260326.md`
3. `docs/docs_management_plan_20260327.md`
4. `docs/execution_spec_review_plan_20260327.md`（待审核并入 `CLAUDE.md`）
5. `docs/ui_implementation_plan_20260327.md`
6. `docs/ui_task_20260327.md`
7. `docs/admin_backend_capability_exposure_plan_20260327.md`
8. `docs/frontend_backend_decoupling_plan_20260401.md`

## 3. 规划输入与兼容评估（References）

1. `docs/ui_frontend_layout_plan_20260327.md`
2. `docs/ui_compatibility_20260327.md`
3. `docs/video_management_flow_20260327.md`

## 4. 规则文档（Rules）

1. `docs/rules/code-style.md`
2. `docs/rules/ui-rules.md`
3. `docs/rules/api-rules.md`
4. `docs/rules/db-rules.md`
5. `docs/rules/test-rules.md`
6. `docs/rules/admin-module-template.md`

## 5. 冲突与归档

1. 同主题冲突清单见 `docs/docs_topic_conflicts_20260327.md`。
2. 被替代文档统一维护 `superseded_by`，并归档到 `docs/archive/<quarter>/`。
3. 新增方案文档必须带日期后缀：`*_YYYYMMDD.md`。
4. 2026Q1 归档索引见 `docs/archive/2026Q1/README.md`。
5. 2026Q2 归档索引见 `docs/archive/2026Q2/README.md`（DOC-01，2026-04-22）。
