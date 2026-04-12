# Docs 管理方案（2026-03-27）

> status: archived
> owner: @engineering
> scope: docs governance and lifecycle management plan
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 目标

1. 让 `docs/` 从“资料堆积”变为“可导航、可维护、可审计”的知识系统。
2. 保持 `CLAUDE.md` 为执行约束唯一准则，`docs/` 只承载架构、任务、方案、记录与审计材料。
3. 降低重复方案和历史版本并存导致的决策冲突风险。

## 2. 当前主要问题（基于现状盘点）

1. 同主题文档多版本并存且未标注主次：如 `admin_refactor_plan_v1.md` / `admin_refactor_plan_v1.2.md` / `admin_v2_refactor_plan.md`。
2. “权威/唯一”表述分散在多个文档，读者难以判断当前生效版本。
3. 文档生命周期缺失：大量 `*_plan_*` 未明确是草案、执行中、已完成还是已废弃。
4. 根目录平铺过多，检索成本高，历史文档与活跃文档混杂。
5. 缺少统一索引与变更入口，新增文档后难追踪。

## 3. 管理原则

1. 单一权威：一个主题只能有一个“当前生效文档”。
2. 生命周期显式化：每个文档都必须有状态与生效范围。
3. 历史可追溯：旧文档不删，统一归档并标记“被替代关系”。
4. 低迁移风险：先建立索引与状态，再做目录调整，避免一次性大搬迁。
5. 自动校验优先：通过脚本做最小门禁，减少人工遗漏。

## 4. 目标结构（信息架构）

在不破坏既有流程的前提下，逐步收敛为以下结构：

```text
docs/
  README.md                       # 总索引（唯一入口）
  governance/                     # 治理与权威文档
    architecture.md
    decisions.md
    roadmap.md
  workflow/                       # 开发流程运行文档
    task-queue.md
    tasks.md
    changelog.md
    run-logs.md
  plans/                          # 执行方案（阶段性）
    active/                       # 执行中方案
    completed/                    # 已完成方案（保留）
  references/                     # 参考资料、矩阵、分析、快照
  rules/                          # 代码/UI/API/DB/测试规则
  archive/
    2026Q1/                       # 已废弃/被替代文档
```

说明：
1. 短期不强制移动 `workflow` 四个文件路径，避免与当前自动流程冲突。
2. 先通过索引和状态标记实现“逻辑分层”，再安排实体迁移。

## 5. 文档类型与命名规范

## 5.1 类型

1. `governance`：长期权威文档（如架构、ADR、路线图）。
2. `workflow`：执行流水文档（task/changelog/run logs）。
3. `plan`：阶段性方案文档（会过期或被替代）。
4. `reference`：矩阵、分析、快照、handoff 报告等参考材料。
5. `archive`：失效文档，仅保留审计价值。

## 5.2 命名

1. 统一小写与连字符：`<domain>-<topic>-<kind>[_YYYYMMDD].md`
2. 方案文档强制带日期：`..._YYYYMMDD.md`
3. 同主题新版本不使用 `v1/v2` 并行命名，改为：
   - 生成新日期文件
   - 在旧文档头部标记 `superseded_by`
4. 禁止新增无语义文件名（如 `new-plan.md`）。

## 6. 文档头部元信息（必填）

所有新文档在标题后加入元信息块：

```markdown
> status: draft | active | reference | completed | superseded | archived
> owner: @role-or-name
> scope: short sentence
> source_of_truth: yes | no
> supersedes: <file or none>
> superseded_by: <file or none>
> last_reviewed: YYYY-MM-DD
```

规则：
1. `source_of_truth: yes` 的主题必须唯一。
2. `plan` 文档默认 `source_of_truth: no`。
3. 被替代文档必须 7 天内移入 `archive/`（或至少标记 `superseded`）。

## 7. 单一权威清单（建议立即固定）

1. 执行约束：`CLAUDE.md`（仓库根目录）。
2. 架构权威：`docs/architecture.md`。
3. 决策权威：`docs/decisions.md`。
4. 任务执行：`docs/tasks.md` + `docs/task-queue.md`。
5. 变更与运行记录：`docs/changelog.md` + `docs/run-logs.md`。

其余同主题文档默认为 `reference` 或 `plan`，不得再声明“唯一权威”。

## 8. 维护流程（新增/更新/归档）

1. 新增文档：
   - 先判定类型（governance/workflow/plan/reference）。
   - 填写元信息。
   - 在 `docs/README.md` 增加入口与一句话说明。
2. 更新文档：
   - 若改变既有权威结论，必须同步更新对应权威文档。
   - 若改为新方案，旧文档加 `superseded_by`。
3. 归档文档：
   - 状态改为 `archived`。
   - 移入 `docs/archive/<quarter>/`。
   - 在索引中保留“归档链接”。

## 9. 实施步骤（分三阶段）

## 阶段 A（当天可完成）

1. 新增 `docs/README.md` 作为总索引。
2. 为活跃文档补齐元信息（至少 `status/source_of_truth/last_reviewed`）。
3. 制作“同主题冲突清单”（admin 重构、table 方案、架构快照）。

状态：已完成（2026-03-27）

## 阶段 B（1-2 天）

1. 将已被替代方案移动到 `docs/archive/2026Q1/`。
2. 统一文件名（日期化、去 `v1/v2` 并行模式）。
3. 清理非文档噪音文件（如 `docs/.DS_Store`）。

状态：已完成（2026-03-27）

## 阶段 C（持续）

1. 增加 `scripts/check-docs-format.sh` 规则：
   - 检查元信息字段是否齐全。
   - 检查 `source_of_truth: yes` 是否同主题唯一。
   - 检查 `plan` 文档是否带日期。
2. 在提交流程中加入文档校验（与现有检查脚本并行）。

## 10. 验收标准

1. `docs/README.md` 可在 1 分钟内定位任何“当前生效文档”。
2. 任一主题不存在两个“source_of_truth: yes”。
3. 所有 `plan` 文档可明确判定：active / completed / superseded。
4. 历史文档可追溯，但不干扰日常开发检索。
