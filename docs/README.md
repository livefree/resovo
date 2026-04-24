# Docs 索引（唯一入口）

> status: active
> owner: @engineering
> scope: docs navigation and document status index
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-24

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

## 2. 当前执行上下文（Current Context）

1. `docs/frontend_design_spec_20260423.md`: 前台 Web 当前设计与 token 执行规范；已替代 `docs/frontend_redesign_plan_20260418.md` 与 `docs/design_system_plan_20260418.md`。
2. `docs/image_pipeline_plan_20260418.md`: 图片管线方案；当前仍保留在根目录，后续是否继续执行以 `docs/task-queue.md` 新序列为准。
3. `docs/freeze_notice_20260418.md`: 重写期需求冻结通知；M6 结束后仅作为历史约束参考，是否解除以 `docs/task-queue.md` / `docs/changelog.md` 的阶段记录为准。

## 3. 保留参考（References）

1. `docs/frontend_redesign_plan_20260418.md`: 前端重写原始总方案；已被 `docs/frontend_design_spec_20260423.md` supersede，不再作为直接执行规范。
2. `docs/design_system_plan_20260418.md`: 设计系统原始方案；已被 `docs/frontend_design_spec_20260423.md` supersede，不再作为直接执行规范。
3. `docs/stability_fix_plan_20260414.md`: 稳定性修复批次历史方案。
4. `docs/tiered_source_verification_future_plan_20260402.md`: 分级源验证未来扩展方案。
5. `docs/baseline_20260418/`: 2026-04-18 基线测试与截图产物。
6. `docs/handoff_20260422/`: 前端设计交接、设计 token 包与人工 QA 产物。

## 4. 规则文档（Rules）

1. `docs/rules/code-style.md`
2. `docs/rules/ui-rules.md`
3. `docs/rules/api-rules.md`
4. `docs/rules/db-rules.md`
5. `docs/rules/test-rules.md`
6. `docs/rules/admin-module-template.md`
7. `docs/rules/git-rules.md`
8. `docs/rules/lint-rules.md`
9. `docs/rules/quality-gates.md`
10. `docs/rules/workflow-rules.md`

## 5. 冲突与归档

1. 同主题冲突清单已归档：`docs/archive/docs_topic_conflicts_20260327.md`。
2. 被替代文档统一维护 `superseded_by`，并归档到 `docs/archive/<quarter>/`。
3. 新增方案文档必须带日期后缀：`*_YYYYMMDD.md`。
4. 2026Q1 归档索引见 `docs/archive/2026Q1/README.md`。
5. 2026Q2 归档索引见 `docs/archive/2026Q2/README.md`（DOC-01，2026-04-22；DOC-02，2026-04-24）。
6. `docs/archive/` 根目录仍保留早期归档文件；新增归档应优先进入季度目录。
