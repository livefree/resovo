# 2026Q2 归档索引

> status: archived
> created: 2026-04-22
> owner: @engineering
> scope: 2026Q2 completed milestone documents
> supersedes: none
> superseded_by: none

本目录存放 2026Q2（M5 / M6 收尾期）已完成里程碑对应的一次性产出文档。
归档原因：对应任务序列 / 里程碑已签字完成，文档失去执行指导价值，仅保留作审计参考。

## 归档清单（2026-04-22，DOC-01）

### 里程碑对齐表（5）
- `milestone_alignment_20260420.md` — M5-preview 对齐表（被 final 替代）
- `milestone_alignment_m5_20260420.md` — M5 初版对齐表
- `milestone_alignment_m5_final_20260421.md` — M5 final（被 final_v2 supersede，保留 CANCELED 审计案例）
- `milestone_alignment_m5_final_v2_20260422.md` — M5 sealed（真·PHASE COMPLETE v2）
- `milestone_alignment_m6_20260423.md` — M6 sealed（PHASE COMPLETE）

### M5 前置审计 / 活动（3）
- `m5_dependency_audit_20260420.md` — M5 启动前依赖核查
- `m5_primitive_activation_20260420.md` — M5-PREP-01 primitive 激活
- `regression_human_review_log_20260420.md` — REGRESSION 阶段人工审核台账

### 任务队列历史补丁（8）
- `task_queue_patch_m0_5_fix_20260418.md`
- `task_queue_patch_m0_5_close_20260418.md`
- `task_queue_patch_m2_followup_20260419.md`
- `task_queue_patch_m3_20260419.md`
- `task_queue_patch_regression_m1m2m3_20260420.md`
- `task_queue_patch_m5_card_protocol_20260420_v1_1.md`
- `task_queue_patch_m5_cleanup_20260421.md`
- `task_queue_patch_m5_cleanup2_20260421.md`

### SEQ-20260422-BUGFIX-01 产物（4）
- `bugfix_01_test_coverage_20260422.md` — 12 张卡测试覆盖矩阵
- `crawl_data_reset_20260422.md` — CHORE-05 采集/入库数据清空报告
- `video_ingest_source_and_moderation_audit_20260422.md` — 触发 BUGFIX-01 的三链路 audit
- `video_type_genre_alignment_20260422.md` — META-10 豆瓣分类对齐

### 其他（1）
- `known_failing_tests_phase0.md` — 早期阶段失败测试清单（已不适用）

## 前期已归档（此前入 2026Q2/，非本次 DOC-01 范围）

- `decisions_patch_20260418.md`
- `model_routing_patch_20260418.md`

## 归档清单（2026-04-24，DOC-02）

### 流水线 / 元数据 / 视频治理（4）
- `pipeline-overhaul-plan.md` — 采集到上架全流程改造方案；阶段性权威已沉淀到 `docs/task-queue.md` / `docs/decisions.md`
- `external_metadata_import_plan_20260405.md` — 外部基础元数据导入方案；META 历史规划输入
- `video_source_episode_recovery_plan_20260402.md` — 视频源 / 选集一致性修复方案
- `video_state_machine_matrix_20260402.md` — 视频治理状态机矩阵

### 重写期风险与测试基线（2）
- `risk_register_rewrite_20260418.md` — 重写期风险登记表；对应风险约束已进入 ADR / rules / task queue 历史
- `test_triage_20260418.md` — 2026-04-18 测试失败 triage；后续状态以 `docs/baseline_20260418/` 与最新测试记录为准

### 任务队列历史补丁（4）
- `task_queue_patch_m0_m1_20260418.md`
- `task_queue_patch_m0_5_20260418.md`
- `task_queue_patch_rewrite_track_20260418.md`
- `task_queue_patch_m5_card_protocol_20260420.md`

## 查找活跃文档

回到 `docs/README.md` 查当前活跃文档索引（SoT + 当前执行上下文 + references + rules）。
