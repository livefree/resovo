# Docs 索引（唯一入口）

> status: active
> owner: @engineering
> scope: docs navigation and document status index
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-18

本文件用于快速定位"当前生效文档"。执行约束仍以仓库根目录 `CLAUDE.md` 为准。

## 1. 权威文档（Source of Truth）

> 2026-05-21 修订（CHG-SN-7-CLEANUP-01-B）：M-SN-3..6 milestone audit / M-SN-7 重做产物 / admin v1 设计 brief / 视图模板 / 设计稿迭代 plan 全部归档至 `docs/archive/2026Q2/`；新开发不再以这些文件作为参考。

1. **`CLAUDE.md`**（仓库根目录）：执行规范唯一准则。
2. **`docs/architecture.md`**：系统架构与模块边界。
3. **`docs/decisions.md`**：架构决策记录（ADR-100..180，含 NEGATED / AMENDMENT）。
4. **`docs/server_next_plan_20260427.md`**：**server-next 主计划 v2.7**（M-SN-1..7 + 退役路线现状对账；cutover 已执行 2026-06-08 CHG-CUTOVER-EXECUTE）；ADR-103a/103b 落地路径。
5. **`docs/designs/backend_design_v2.1/reference.md`**：**后台设计真源**（合并稿 §0 七条裁决 + §11 修复顺序）；新视图必读。
6. **`docs/task-queue.md`**：任务序列池（活跃：SEQ-20260524-01 M-SN-9 容器 🟡 + SEQ-20260601-01 起全部序列；更早分段归档见 `docs/archive/task-queue/`——M0~M-SN-0 / M-SN-1~6 / M-SN-7~META 三段）。
7. **`docs/tasks.md`**：单任务工作台。
8. **`docs/changelog.md`**：完成任务变更历史（追加型，活跃段：META-24〔SEQ-20260613-01〕起；更早分段归档见 `docs/archive/changelog/`——m0-m6 / M-SN-2~7 / M-SN-8~META / VSR-VIR 四段）。
9. **`docs/tracks.md`**：并行 track 历史记录（用户决策保留顶层；当前活跃 Track 数 0，bangumi 已于 2026-05-29 集成）。

## 2. 当前执行上下文（Current Context）

1. `docs/designs/backend_design_v2.1/reference.md`：后台 admin 视图开发设计真源（CHG-SN-* 系列任务卡的设计依据）。设计稿源在同目录 `index.html` / `Wireframes.html` / `styles/` / `app/` / `design-canvas.jsx` / `info.md`。
2. `docs/server_next_plan_20260427.md`：server-next 工程主计划（含 ADR-103a Shell + ADR-103b admin-ui 边界）。
3. **`docs/manual/`**：M-SN-8 起的"用户使用说明书"工程目录（开发卡前置草稿、完工后定稿；详见 §6）。
4. 活跃设计文档（`docs/designs/`，2026-06）：
   - `home-operations-governance-plan_20260605.md`（首页运营治理方案：同构编辑画布 / 自动填充 / 豆瓣与 Bangumi 热榜 / Banner 横图强约束，后续 `/admin/home` UI/UX 改造依据）
   - `videos-sources-responsibility-redesign_20260601.md`（SEQ-20260601-01 ✅ 已落地，§6 拆卡表留档）
   - `video-identity-resolution-redesign_20260602.md`（SEQ-20260602-03 主体完结；4 项后续小卡触发条件登记在 task-queue）
   - `merge-split-ux-redesign_20260603.md`（CHG-VIR-13 系列 ✅；「强负边不参与折叠连通」follow-up 待用户裁定）
   - `adr177-external-refs-relation_20260602.md`（ADR-177 定档输入，被 decisions.md / architecture.md 引用，保留）
   - `route-labeling-system.md`（线路别名三层体系设计稿，`docs/manual/route-labeling.md` 真源引用，保留）
5. 活跃台账（`docs/audit/`）：`user-review-2026-05-23.md`（SEQ-20260524-01 M-SN-9 容器的反馈登记簿）+ `adr-d-status.json`（verify:adr-contracts 生成）。

## 3. 已归档参考（Archived References）

> 以下文件**仅作历史输入，不作 server-next 新开发参考模板**。所有归档于 2026-05-21 大清理（CHG-SN-7-CLEANUP-01-A）落地。

### 3.1 milestone 阶段审计（`docs/archive/2026Q2/milestone-audits/`）
- `M-SN-3-milestone-audit-2026-05-12.md`（B+ PASS）
- `M-SN-4-milestone-audit-2026-05-05.md` + `M-SN-4-milestone-audit-2026-05-20.md`
- `M-SN-5.5-milestone-audit-2026-05-12.md`
- `M-SN-6-milestone-audit-2026-05-17.md` + `M-SN-6-milestone-audit-2026-05-17-RECHECK.md`（A−）

### 3.2 M-SN-7 设计对齐重做产物（`docs/archive/2026Q2/m-sn-7-redo/`）
- `M-SN-7-design-realign-plan.md`（REDO-01..04 总规划）
- `M-SN-7-design-realign-audit-FULL.md`（PRE-04 16 路由全量审计输出，A−）
- `M-SN-7-redo-01-contract.md`（Crawler 重做契约）

### 3.3 设计稿迭代产物（`docs/archive/2026Q2/design-iterations/`）
SEQ-20260429-02 / M-SN-4 阶段的 plan / audit / walkthrough 共 11 份；**新设计修订一律更新 `reference.md` 真源**。

### 3.4 admin v1 历史输入（`docs/archive/2026Q2/admin-v1/`）
- `admin_audit_20260426.md`（v1 全面审计 9 大痛点）
- `admin_design_brief_20260426.md`（v1 设计 brief 5 推荐）
- `logging_system_proposal_20260425.md`（已正式化为 `docs/rules/logging-rules.md`）
- `run-logs.md`（M0–M6 BLOCKER 记录；后续以 `docs/changelog.md` 为准）

### 3.5 其它归档
- `docs/archive/2026Q2/server_next_view_template.md`（被 `docs/rules/admin-module-template.md` 取代）
- `docs/archive/2026Q2/server_next_PRE-01-A-drill-2026-05-12.md`（staging cookie + nginx e2e 演练记录）
- `docs/archive/m0-m6/frontend_design_spec_20260423.md`（M0-M6 前台设计 spec；前台 web-next 部分内容仍有参考价值）
- `docs/archive/2026Q1/README.md` / `docs/archive/2026Q2/README.md`
- changelog 分段归档：`docs/archive/changelog/changelog_m0-m6.md`（M0–M6）/ `changelog_M-SN-2-to-7_20260523.md`（M-SN-2 ~ M-SN-7）/ `changelog_M-SN-8-to-META_20260605.md`（M-SN-8 ~ M-SN-9 / MOD Waves / META / DTR，2026-05-23 ~ 2026-06-01）/ `changelog_VSR-VIR_20260618.md`（CHG-VSR-1 ~ CHORE-TEST-CPU-CONCURRENCY，VSR/VIR 重构期 + merge-split UX / MODUX / PLAYER / HOME-UX，2026-06-01 ~ 2026-06-12，CHORE-DOCS-CLEANUP-20260618 / T5 归档）
- task-queue 分段归档：`docs/archive/task-queue/task-queue_archive_20260427.md`（M0 ~ M-SN-0）/ `task-queue_archive_M-SN-1-to-6_20260523.md`（M-SN-1 ~ M-SN-6）/ `task-queue_archive_SEQ-20260521-06_20260523.md`（GAPS 小卡批量）/ `task-queue_archive_M-SN-7-to-META_20260605.md`（M-SN-7 跟踪卡 ~ SEQ-20260531-01）
- 2026-06-05 大清理（CHORE-DOCS-CLEANUP-20260605）：`docs/archive/2026Q2/` 新增 `external-metadata-ux-overhaul_20260529.md` + `datatable-header-redesign-plan_20260523.md` + `known-failing-tests_20260529.md`；`docs/archive/tasks/tasks-bangumi.md`（bangumi track 看板，track 已集成）

## 4. 规则文档（Rules）

CLAUDE.md「规范文件索引」节强引用，新开发按任务类型读取对应规范：

1. `docs/rules/code-style.md`
2. `docs/rules/ui-rules.md`
3. `docs/rules/api-rules.md`
4. `docs/rules/db-rules.md`
5. `docs/rules/test-rules.md`
6. `docs/rules/admin-module-template.md`（含 v1 冻结章 + v2 server-next 真源章，单文件双章节）
7. `docs/rules/git-rules.md`
8. `docs/rules/lint-rules.md`
9. `docs/rules/parallel-dev-rules.md`
10. `docs/rules/quality-gates.md`
11. `docs/rules/workflow-rules.md`
12. `docs/rules/logging-rules.md`
13. `docs/rules/doc-governance.md`（文档治理：清理 / 归档 / 索引更新 / 冲突与引用核验，§5 约定的执行层展开）

## 5. 冲突与归档约定

1. 同主题冲突清单历史归档：`docs/archive/docs_topic_conflicts_20260327.md`。
2. 被替代文档统一维护 `superseded_by` header，并归档到 `docs/archive/<quarter>/<topic>/`。
3. 新增方案文档必须带日期后缀：`*_YYYYMMDD.md`。
4. 季度归档索引：
   - `docs/archive/2026Q1/README.md`
   - `docs/archive/2026Q2/README.md`（含 milestone-audits / m-sn-7-redo / design-iterations / admin-v1 子索引）
5. 完整治理流程（触发条件 / 六步流程 / 归档判定表 / 引用健康检查）：`docs/rules/doc-governance.md`。

## 6. M-SN-8 · 后台使用说明书工程（manual/）

> **背景**：2026-05-21 用户复核 server-next 实际可用性发现 13 个 UX 缺口（mock 视图 / 死按钮 / 断链 / UUID 输入 / dashboard 模板等）。开发模式调整为「实现 + 说明书双轨」：每个页面对应一份手册，开发卡前置草稿、完工后定稿。
>
> **状态**（2026-06-05 更新）：骨架已由 `CHG-SN-7-CLEANUP-01-C` 落地，M-SN-8/9 各页手册随开发卡持续定稿中。增补文件：`GAPS.md`（UX 缺口台账）、`route-labeling.md`、`auto-retire-line-worker.md`、`title-observations-backfill-runbook.md`、`wave-3-acceptance.md` / `wave-4-acceptance.md`（验收报告）。

### 6.1 目录结构（已落地）
```
docs/manual/
├── README.md                              总览 + 角色矩阵 + 高频任务索引
├── _template/                             PAGE / WORKFLOW 模板（开发卡复制起手）
├── 00-roles-and-permissions.md
├── 01-getting-started.md
├── 10-workflows/                          跨页面端到端工作流
│   ├── W1-crawl-to-publish.md             ★ 金票（采集 → 审核 → 上架）
│   ├── W2-source-repair.md
│   ├── W3-image-fallback.md
│   ├── W4-merge-split.md
│   └── W5-home-curation.md
├── 20-pages/                              每个 /admin/* 路由一份
├── 30-pickers/                            业务级选择器（VideoPicker / SourceLinePicker 等）
└── 90-glossary.md
```

### 6.2 4 条硬约束（M-SN-8 完结态）
1. **H1 零 mock 视图**：所有数字 / 列表 / 卡片必须 live 数据
2. **H2 零死按钮**：每个按钮 onClick 接通端点 + Toast 反馈；危险操作二次确认
3. **H3 零断链**：任意业务链路可从入口走到完成态，零 URL 编辑
4. **H4 零 ID 输入**：所有"选别的资源"必须用业务级 Picker，禁止 UUID/DB 主键直接暴露

### 6.3 开发双轨流
- **开发卡起草时**：DoD §0 先建 `docs/manual/20-pages/P-<slug>.md` 草稿（§1/§2/§3/§4 填空）
- **开发实施中**：完成一个交互即回填 §3/§4 步骤
- **开发卡 PASS 前**：手册定稿，非工程师走读 ≥ 1 次；`verify:manual-coverage` 守门
