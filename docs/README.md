# Docs 索引（唯一入口）

> status: active
> owner: @engineering
> scope: docs navigation and document status index
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-30

本文件用于快速定位"当前生效文档"。执行约束仍以仓库根目录 `CLAUDE.md` 为准。

## 1. 权威文档（Source of Truth）

> 2026-04-30 修订（CHG-DESIGN-11）：server-next 时代真源切换。前台 Web 设计稿已归档至 `docs/archive/m0-m6/frontend_design_spec_20260423.md`，不再作为根目录入口；后台重开发当前真源加入 server-next plan / backend design reference / SEQ-20260429 系列。

1. `CLAUDE.md`（仓库根目录）：执行规范唯一准则。
2. `docs/architecture.md`：系统架构与模块边界。
3. `docs/decisions.md`：架构决策记录（ADR）。
4. `docs/server_next_plan_20260427.md`：**server-next 重开发当前主计划（M-SN-1～7）**；ADR-103a/103b 落地路径。
5. `docs/designs/backend_design_v2.1/reference.md`：**后台重开发当前设计真源**（合并稿 §0 七条裁决 + §11 修复顺序）；CHG-DESIGN 系列任务卡的设计基准。
6. `docs/task-queue.md`：任务序列池与状态追踪（当前活跃 SEQ：SEQ-20260428-01 ~ SEQ-20260429-02）。
7. `docs/tasks.md`：单任务工作台。
8. `docs/changelog.md`：完成任务变更历史。
9. `docs/run-logs.md`：运行日志与 BLOCKER 记录。
10. `docs/roadmap.md`：早期 Phase 1/2 阶段记录（已被 SEQ-20260428/29 系列取代为执行真源；保留为历史里程碑参考）。

## 2. 当前执行上下文（Current Context）

1. `docs/designs/backend_design_v2.1/reference.md`：后台 admin 重开发设计真源（CHG-DESIGN-01 起所有任务卡的设计依据）。设计稿源在同目录 index.html / Wireframes.html / styles/ / app/。
2. `docs/server_next_plan_20260427.md`：server-next 工程主计划（已含 ADR-103a Shell + ADR-103b admin-ui 边界落地）。
3. `docs/server_next_kickoff_20260427.md`：M-SN-2 启动文档。
4. `docs/image_pipeline_plan_20260418.md`：图片管线方案；当前仍保留在根目录。
5. `docs/freeze_notice_20260418.md`：重写期需求冻结通知；M6 结束后仅作为历史约束参考。

## 3. 保留参考（References）

1. `docs/archive/m0-m6/frontend_design_spec_20260423.md`：前台设计 spec（M0-M6 时代真源，已归档；当前前台 Web 仍有部分执行价值，但作为历史输入）。
2. `docs/admin_design_brief_20260426.md`：后台 v1 设计 brief（**仅作历史输入，不作 server-next 实现模板**；ModernDataTable / apps/server shared 引用已被 reference.md / SEQ-20260429-02 取代）。
3. `docs/admin_audit_20260426.md`：后台 v1 审计报告（历史）。
4. `docs/server_next_handoff_M-SN-1.md`：M-SN-1 阶段交接（已结案归档）。
5. `docs/archive/`：早期归档文件（含 frontend_redesign / design_system_plan / stability_fix 等）。
6. `docs/baseline_20260418/`：2026-04-18 基线测试与截图产物。
7. `docs/handoff_20260422/`：前端设计交接、token 包与人工 QA 产物。

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
