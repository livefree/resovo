# Docs 同主题冲突清单（2026-03-27）

> status: archived
> owner: @engineering
> scope: duplicate-topic document conflict inventory and resolution suggestions
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. Admin 重构主题（冲突组 A）

候选文档：
1. `docs/archive/2026Q1/admin_refactor_plan_v1.md`
2. `docs/archive/2026Q1/admin_refactor_plan_v1.2.md`
3. `docs/archive/2026Q1/admin_v2_refactor_plan.md`
4. `docs/admin_ui_unification_plan.md`
5. `docs/admin_restructure_plan.md`

建议：
1. `admin_restructure_plan.md` 作为结构层主参考（reference）。
2. `admin_ui_unification_plan.md` 作为 UI 总纲（reference）。
3. `admin_refactor_plan_v1.md`、`admin_refactor_plan_v1.2.md`、`admin_v2_refactor_plan.md` 已归档到 `docs/archive/2026Q1/`。

## 2. Admin 表格主题（冲突组 B）

候选文档：
1. `docs/admin_table_baseline.md`
2. `docs/archive/2026Q1/admin_table_redesign_plan_20260325.md`
3. `docs/admin_table_ux_fix_plan_20260326.md`
4. `docs/admin_list_matrix.md`

建议：
1. `admin_table_ux_fix_plan_20260326.md` 作为当前执行计划（active plan）。
2. `admin_table_baseline.md` 作为长期参考约束（reference）。
3. `admin_table_redesign_plan_20260325.md` 已归档到 `docs/archive/2026Q1/`。
4. `admin_list_matrix.md` 保留为盘点证据（reference）。

## 3. 视频管理主题（冲突组 C）

候选文档：
1. `docs/archive/2026Q1/video_management_plan_20260325.md`
2. `docs/video_admin_unified_plan_20260325.md`

建议：
1. `video_admin_unified_plan_20260325.md` 作为唯一执行方案（active plan）。
2. `video_management_plan_20260325.md` 已归档到 `docs/archive/2026Q1/`。

## 4. 架构主题（冲突组 D）

候选文档：
1. `docs/architecture.md`
2. `docs/architecture-current.md`

建议：
1. `architecture.md` 保持 source_of_truth。
2. `architecture-current.md` 明确为快照参考（reference），不得声明权威。

## 5. 执行规范主题（冲突组 E）

候选文档：
1. `CLAUDE.md`（仓库根目录）
2. `docs/execution_spec_review_plan_20260327.md`

建议：
1. `CLAUDE.md` 保持唯一执行准则。
2. `execution_spec_review_plan_20260327.md` 仅用于审核，批准后并入 `CLAUDE.md` 并归档或删除。

## 6. 当前状态与后续

1. 主文档归属已固定，冲突组 A/B/C 的被替代文档已归档。
2. 后续新增同主题方案时，必须直接标记 `supersedes/superseded_by`。
3. 仍待处理：为更多 reference 文档批量补齐元信息。
