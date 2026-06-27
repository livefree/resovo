# Resovo（流光） — 模型路由与模型 ID 映射规范

> status: active
> owner: @engineering
> scope: main-loop and subagent model id mapping
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-26
>
> 本文件是 CLAUDE.md「模型路由规则」章节的**模型 ID 映射现行版本**。
> 升降档情形与执行审计规则由 CLAUDE.md 持有，本文件只承载「缩写 → 完整模型 ID」映射，避免双真源漂移。
>
> 历史沿革：模型路由策略首次落地于一次性补丁 `docs/archive/2026Q2/model_routing_patch_20260418.md`（已归档，`source_of_truth: no`）。该补丁 §3 表 S 级列写 `claude-opus-4-6` 为**历史值**；apps/server cutover 后复审（2026-06-26）将 S 级实跑与 arch-reviewer 模板统一对齐到 `claude-opus-4-8`，现行映射以本文件 §1 为准。

---

## 1. 模型 ID 映射（全项目统一，现行版本）

任务卡「建议模型」字段用缩写；会话启动时人工按下表传 `--model <完整 ID>`：

| 档位 | 缩写 | 完整模型 ID | 用途 |
|------|------|------------------------------|------|
| S 级 | `opus` | `claude-opus-4-8` | 架构原语、跨模块重构、组件契约定稿、ADR 撰写、arch-reviewer 评审 |
| A 级 | `sonnet` | `claude-sonnet-4-6` | 默认主循环、标准实现、测试、迁移、页面重制 |
| B 级 | `haiku` | `claude-haiku-4-5-20251001` | 文档追加、归档、typo、纯模板套用、doc-janitor |

- **默认主循环** = A 级 `claude-sonnet-4-6`。
- 「执行模型」字段、commit trailer、subagent 标注必须使用**完整模型 ID**，不得用缩写；`opus` / `sonnet` / `haiku` 缩写仅限任务卡「建议模型」字段。

## 2. 预设子代理与其模型

| 子代理 | 定义文件 | 模型 ID | 职责 |
|--------|---------------------------------|------------------------------|------|
| arch-reviewer | `.claude/agents/arch-reviewer.md` | `claude-opus-4-8` | 架构决策独立评审（CLAUDE.md「强制升 Opus」6 类情形） |
| doc-janitor | `.claude/agents/doc-janitor.md` | `claude-haiku-4-5-20251001` | 事务性 docs 维护（归档 / 索引 / changelog 落稿） |

> `.claude/` 全量 gitignore，上述子代理定义文件仅存于本机磁盘、不随仓库传播。本表为团队可见的模型 ID 单一参照——修改 `.claude/agents/*.md` 的 `model:` 字段时须同步本表。

## 3. 升降档情形与执行审计

升 Opus（强制）/ 降 Haiku / 不得自动切换的具体情形，以及每任务完成时的「执行模型」与「子代理调用」审计要求，见 **CLAUDE.md「模型路由规则」章节**（本文件不重复，避免双真源）。
