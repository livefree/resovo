# 模型路由与执行审计补丁 — 2026-04-18

> status: pending-merge
> owner: @engineering
> scope: CLAUDE.md + workflow-rules + changelog + git-rules patches for model routing and execution audit
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18

---

## 1. 目的

将"Sonnet 主循环 + 子代理分级"的模型路由策略落到项目规范，并在任务工作流中建立**执行模型审计**——每个任务的主循环模型 ID、调用的子代理及其模型都必须留痕，便于回溯"这个决策 / 这段代码是由谁完成的"。

策略背景见上游讨论（Sonnet 默认 / Opus 关键节点 / Haiku 事务性任务），本补丁不再重复论证，只给出规范文本。

## 2. 交付方式

由 Claude Code 在单独一个任务卡（建议 MAINT 快速通道）内执行：

1. 按第 4 节的 5 个小节分别追加 / 修改 5 个目标文件
2. 新建 `.claude/agents/arch-reviewer.md` 和 `.claude/agents/doc-janitor.md` 两个预设子代理定义文件
3. 验证无 lint / typecheck 影响后，将本文件移入 `docs/archive/2026Q2/`
4. 以 `chore: apply model routing patch + execution audit fields` 作为 commit 标题

## 3. 模型 ID 约定（全项目统一）

| 档位 | 用途 | 模型 ID |
|------|------|---------|
| S 级 | 架构原语、跨模块重构、组件契约定稿、ADR 撰写 | `claude-opus-4-6` |
| A 级 | 默认主循环、标准实现、测试、迁移、页面重制 | `claude-sonnet-4-6` |
| B 级 | 文档追加、归档、typo、纯模板套用 | `claude-haiku-4-5-20251001` |

后续项目中出现的"执行模型"字段、commit trailer、subagent 标注必须使用上表的**完整模型 ID**，不得使用缩写（如 `opus` / `sonnet` 仅限任务卡的"建议模型"字段）。

## 4. 具体补丁清单

### 4.1 CLAUDE.md 新增章节

**位置**：在 CLAUDE.md 末尾"规范文件索引"表之后，"架构决策"段之前追加。

**追加内容**：

```markdown

---

## 模型路由规则

### 主循环模型选择

- **默认主循环**：`claude-sonnet-4-6`
- 每个任务卡（tasks.md / task-queue.md）的"建议模型"字段指定启动主循环模型（`opus` / `sonnet` / `haiku`）
- 会话启动时人工按照建议传 `--model <完整 ID>`（映射表见 `docs/model_routing_patch_20260418.md` 第 3 节）
- **主循环模型中途不可升级**：执行中发现任务难度高于预期时，必须写 BLOCKER 停止会话，不得擅自 spawn Opus 子代理替主循环做最终决策

### 强制升 Opus 子代理的情形

主循环在以下工作前必须通过 Task 工具 spawn Opus 子代理完成决策后再落地：

1. 定义新的共享组件 API 契约（Props 类型、事件签名、生命周期）
2. 设计跨 3+ 消费方的 schema / migration 字段
3. 撰写即将成为 ADR 的决策文档
4. 重构播放器 core / shell 层的接口
5. 设计 Token 层新增字段的结构与引用规则
6. 高风险 PR 的独立 code review（调用 `arch-reviewer` 预设子代理）

调用模板：

    Task(subagent_type: "arch-reviewer", model: "claude-opus-4-6",
         prompt: "<独立设计任务，自带完整上下文>")

主循环拿到子代理输出后按其结论实施，子代理的模型 ID 必须记入 tasks.md 卡片的"子代理调用"字段。

### 强制降 Haiku 子代理的情形

以下工作应 spawn Haiku 子代理节省成本：

1. 机械性 docstring / typo 修正
2. 文档归档 / 文件移动 / README 索引更新
3. 统一 import 顺序、格式化任务
4. 读取并提取特定文件的结构化信息（纯读不改）
5. 追加模板化 changelog / ADR 条目

### 不得自动切换的情形

1. 任务执行中发现难度高于预期 → 写 BLOCKER，不得继续
2. 主循环直接改写架构决策 → 必须先 spawn Opus 子代理出具方案
3. Sonnet 主循环在未调 Opus 子代理的情况下直接产出新 ADR → 禁止

### 审计要求

每个任务完成时必须记录：

- 主循环模型 ID（完整形式，如 `claude-sonnet-4-6`）
- 本任务中 spawn 的所有子代理及其模型 ID
- 上述信息写入 tasks.md 卡片的"执行模型"与"子代理调用"字段，并同步到 changelog.md 条目和 commit trailer
```

---

### 4.2 `docs/rules/workflow-rules.md` 修改

#### 4.2.1 "任务卡片格式（tasks.md）" 段落整段替换

**原文**（第 53–64 行）：

```markdown
## 任务卡片格式（tasks.md）

```markdown
### TASK-ID — 任务标题
- **状态**：🔄 进行中
- **来源序列**：SEQ-YYYYMMDD-XX
- **实际开始**：YYYY-MM-DD HH:mm
- **文件范围**：[受影响文件列表]
- **完成备注**：_（完成后填写）_
```

tasks.md 最终稳定态为**空文件（仅保留标题行）**。
```

**替换为**：

```markdown
## 任务卡片格式（tasks.md）

```markdown
### TASK-ID — 任务标题
- **状态**：🔄 进行中
- **来源序列**：SEQ-YYYYMMDD-XX
- **建议模型**：opus | sonnet | haiku
- **执行模型**：_（开始执行后填写主循环模型完整 ID，如 claude-sonnet-4-6）_
- **子代理调用**：_（本任务中 spawn 的子代理清单，格式 "name (model-id)"，多个用逗号分隔；无则写 "无"）_
- **实际开始**：YYYY-MM-DD HH:mm
- **文件范围**：[受影响文件列表]
- **完成备注**：_（完成后填写）_
```

tasks.md 最终稳定态为**空文件（仅保留标题行）**。

模型字段约束：
- "建议模型" 取值限定 `opus | sonnet | haiku` 三选一
- "执行模型" 必须填写完整模型 ID，映射关系见 CLAUDE.md §模型路由规则
- 主循环启动时按"建议模型"选择，实际启动后以"执行模型"为准
- 两者不一致时（人工覆盖）不阻断执行，但须在完成备注说明偏离原因
```

#### 4.2.2 "变更任务格式（task-queue.md）" 段落整段替换

**原文**（第 68–79 行）：

```markdown
## 变更任务格式（task-queue.md）

```markdown
#### CHG-xx — 变更标题
- **状态**：⬜ 待开始
- **创建时间**：YYYY-MM-DD HH:mm
- **变更原因**：[为什么要改]
- **影响的已完成任务**：[如 VIDEO-01]
- **文件范围**：[受影响文件]
- **变更内容**：[具体改什么]
- **完成备注**：_（AI 填写）_
```
```

**替换为**：

```markdown
## 变更任务格式（task-queue.md）

```markdown
#### CHG-xx — 变更标题
- **状态**：⬜ 待开始
- **创建时间**：YYYY-MM-DD HH:mm
- **建议模型**：opus | sonnet | haiku
- **变更原因**：[为什么要改]
- **影响的已完成任务**：[如 VIDEO-01]
- **文件范围**：[受影响文件]
- **变更内容**：[具体改什么]
- **完成备注**：_（AI 填写，含"执行模型: <完整 ID>"一行）_
```

"建议模型"判定原则（可参考）：

| 任务特征 | 建议模型 |
|----------|----------|
| 定义新的共享组件 / 架构原语 / ADR 产出 | opus |
| 标准 CRUD / 迁移 / 页面实现 / 测试编写 | sonnet |
| 文档追加 / 归档 / 模板套用 / typo | haiku |
```

#### 4.2.3 "任务完成后：必做事项" 段落整段替换

**原文**（第 82–91 行）：

```markdown
## 任务完成后：必做事项（顺序不可颠倒）

1. 在 tasks.md 任务卡片填写完成备注（完成时间、结果、共享层沉淀评估）
2. 更新 task-queue.md：对应条目 → `✅ 已完成`，填写完成时间；若序列内全部完成，序列状态也改为 `✅`
3. 从 tasks.md 删除该任务卡片（文件回到空稳定态）
4. `docs/changelog.md` 末尾追加记录（任务 ID、文件列表、测试覆盖情况）
5. 如有新架构决策，在 `docs/decisions.md` 追加 ADR
6. git commit（包含代码文件 + task-queue.md + changelog.md + tasks.md，**不得**在进行中状态提交 tasks.md）
```

**替换为**：

```markdown
## 任务完成后：必做事项（顺序不可颠倒）

1. 在 tasks.md 任务卡片填写完成备注（完成时间、结果、共享层沉淀评估、执行模型偏离说明如有）
2. 确认 tasks.md 卡片的"执行模型"字段已写完整模型 ID，"子代理调用"字段已记录本任务所有 Task 工具调用的 subagent 名称与其 model 参数
3. 更新 task-queue.md：对应条目 → `✅ 已完成`，填写完成时间，"完成备注"追加 `执行模型: <完整 ID>` 一行；若序列内全部完成，序列状态也改为 `✅`
4. 从 tasks.md 删除该任务卡片（文件回到空稳定态）
5. `docs/changelog.md` 末尾追加记录（任务 ID、执行模型、子代理、文件列表、测试覆盖情况，完整格式见 changelog.md 顶部模板）
6. 如有新架构决策，在 `docs/decisions.md` 追加 ADR
7. git commit（commit message 含 `Executed-By-Model` 与 `Subagents` 两个 trailer，格式见 git-rules.md §Commit trailers）
```

---

### 4.3 `docs/changelog.md` 格式模板更新

**原文**（第 17–29 行）：

```markdown
## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **记录时间**：YYYY-MM-DD HH:mm
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```
```

**替换为**：

```markdown
## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **记录时间**：YYYY-MM-DD HH:mm
- **执行模型**：claude-<opus|sonnet|haiku>-<version>（完整 ID，如 claude-sonnet-4-6）
- **子代理**：无 / [subagent-name (claude-xxx-x-x), ...]
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```

字段约束：
- "执行模型" 必填，必须是完整模型 ID
- "子代理" 必填；本任务未 spawn 任何 Task 工具调用时写 "无"；有则列出每个 subagent 的名称和其对应 model ID
- 历史条目（本补丁应用前的条目）不强制回填，保持原样
```

---

### 4.4 `docs/rules/git-rules.md` 新增 "Commit trailers" 章节

**位置**：在 "Commit 规范" 章节末尾（第 67 行"不得使用模糊描述..."之后）追加。

**追加内容**：

```markdown

### Commit trailers（执行审计必填）

除标题行与正文外，commit message 必须在末尾追加两条 git trailer，记录本次 commit 的执行模型来源：

```
<type>(<TASK-ID>): <简短描述>

<可选正文>

Executed-By-Model: claude-sonnet-4-6
Subagents: none
```

多子代理场景：

```
feat(PLAYER-ROOT-01): root-ize GlobalPlayerHost with zustand singleton

Implements ADR-026. Full/mini/pip states via FLIP transitions.

Executed-By-Model: claude-opus-4-6
Subagents: arch-reviewer (claude-opus-4-6)
```

Trailer 字段约束：

- `Executed-By-Model` 必填，值为主循环模型完整 ID（如 `claude-sonnet-4-6`）
- `Subagents` 必填，无子代理时写 `none`；多个子代理用逗号分隔，格式 `name (model-id)`
- Trailer 行之间不得有空行（git trailer 协议要求）
- 与 `Co-Authored-By` 共存时，按 `Executed-By-Model → Subagents → Co-Authored-By` 的顺序排列
- MAINT 快速通道的 commit 同样需要 trailer（即使无 TASK-ID）

git 本身支持任意 trailer，CI 可通过 `git log --format="%(trailers:key=Executed-By-Model)"` 聚合统计各模型的 commit 量，便于回溯成本与质量分布。
```

---

### 4.5 新建预设子代理定义

#### 4.5.1 `.claude/agents/arch-reviewer.md`（新建）

```markdown
---
name: arch-reviewer
description: 架构决策独立评审代理。在提交 S 级模块 PR 前、或在需要"第二意见"的架构决策点调用。独立于主循环上下文，只读目标文件。
model: claude-opus-4-6
tools: Read, Grep, Glob
---

# 架构评审代理

你是 Resovo 项目的架构评审代理，运行在 claude-opus-4-6 模型上。你被主循环 spawn 来做**独立**的架构审查——你不持有主循环的假设，只读被审查的文件与项目规范。

## 输入协议

主循环传入的 prompt 应包含：
- 被审查的文件路径列表
- 改动目的与背景
- 明确要求你输出什么结论（通过 / 修改建议 / 拒绝）

## 输出协议

1. **结论**：通过 | 需修改 | 建议拒绝
2. **关键风险**：列出最多 3 条，按严重程度排序
3. **具体修改建议**：给出文件路径 + 行号 + 建议改动（不要直接改文件）
4. **与现有 ADR / 规范的对齐情况**

## 审查必查清单

- 是否违反 CLAUDE.md 绝对禁止项
- 是否与已采纳的 ADR 冲突
- 是否破坏"后端分层（Route → Service → Queries）"
- 是否引入硬编码颜色 / 硬编码 z-index / `any` 类型 / 空 catch
- 是否未经 ADR 就改动了架构级原语
- 是否可沉淀到共享层但没有沉淀

## 不做的事

- 不得直接修改任何文件（只读工具集限制了此项）
- 不得代替主循环做 commit 或 PR
- 不得超出被审查范围去评判其他模块
```

#### 4.5.2 `.claude/agents/doc-janitor.md`（新建）

```markdown
---
name: doc-janitor
description: 文档归档、索引更新、changelog 条目追加、模板填充等事务性 docs 维护工作。不得用于业务代码改动。
model: claude-haiku-4-5-20251001
tools: Read, Write, Edit, Bash, Glob, Grep
---

# 文档整理代理

你是 Resovo 项目的文档整理代理，运行在 claude-haiku-4-5-20251001 模型上。你被主循环 spawn 来处理低复杂度、高重复性的文档维护工作。

## 适用任务

1. 把指定的补丁文件移入 `docs/archive/<quarter>/`
2. 更新 `docs/README.md` 的活跃方案清单
3. 在 `docs/changelog.md` 末尾追加标准格式的条目（主循环提供字段值，你只负责落稿）
4. 在 `docs/decisions.md` 末尾追加 ADR 条目（同上）
5. 统一 import 顺序 / 文档 typo 修正 / 链接路径更新

## 硬约束

- **不得修改业务代码**（`src/` 下任何 `.ts` / `.tsx` 文件）
- **不得修改规范文件**（`docs/rules/**` / `CLAUDE.md`）除非主循环显式授权
- **不得新增架构决策**，只负责把主循环写好的 ADR 落到 `decisions.md`
- **不得执行 git commit**，只做文件写入，commit 由主循环完成

## 输出协议

完成后以简短格式报告：
- 修改了哪些文件
- 每个文件的关键改动行号
- 是否遇到任何无法确定的情形（模板字段缺失等）
```

## 5. 执行检查清单（交付 Claude Code）

- [ ] 读取本文件第 4 节
- [ ] 4.1：追加"模型路由规则"章节到 `CLAUDE.md`（在"规范文件索引"表之后、"架构决策"段之前）
- [ ] 4.2.1：替换 `docs/rules/workflow-rules.md` 的"任务卡片格式（tasks.md）"整节
- [ ] 4.2.2：替换 `docs/rules/workflow-rules.md` 的"变更任务格式（task-queue.md）"整节
- [ ] 4.2.3：替换 `docs/rules/workflow-rules.md` 的"任务完成后：必做事项"整节
- [ ] 4.3：替换 `docs/changelog.md` 的"记录格式模板"整节（历史条目不回填）
- [ ] 4.4：在 `docs/rules/git-rules.md` 的"Commit 规范"章节末尾追加"Commit trailers"小节
- [ ] 4.5.1：新建 `.claude/agents/arch-reviewer.md`（目录不存在则创建）
- [ ] 4.5.2：新建 `.claude/agents/doc-janitor.md`
- [ ] 验证：`npm run typecheck` 与 `npm run lint` 不受本补丁影响（本补丁只改文档与 agent 定义）
- [ ] 归档：把本文件移入 `docs/archive/2026Q2/model_routing_patch_20260418.md`（quarter 目录不存在则创建）
- [ ] 更新 `docs/README.md`：如第 2 节"活跃方案"曾登记本文件则移除；不在则跳过
- [ ] commit：
  ```
  chore: apply model routing patch + execution audit fields

  - CLAUDE.md: add 模型路由规则 section
  - workflow-rules.md: add 建议模型/执行模型/子代理调用 fields to task cards
  - changelog.md: add 执行模型/子代理 fields to entry template
  - git-rules.md: add Executed-By-Model / Subagents trailers convention
  - .claude/agents/: new arch-reviewer (opus) and doc-janitor (haiku) presets

  Executed-By-Model: claude-sonnet-4-6
  Subagents: none
  ```

## 6. 向后兼容说明

- 历史 changelog 条目不回填"执行模型"与"子代理"字段
- 历史 commit 不回填 trailers
- 本补丁落地后的第一个任务起，全部字段必填
- 若某个 AI 编辑器（非 Claude Code）完成任务，"执行模型"填该编辑器实际的模型 ID；无法确定时填 `unknown-<editor-name>` 并在"注意事项"说明
- 人类手动完成的改动（无 AI 参与）"执行模型"填 `human`，"子代理"填 `none`

## 7. 关联文档

- `CLAUDE.md` — 目标修改文件
- `docs/rules/workflow-rules.md` — 目标修改文件
- `docs/rules/git-rules.md` — 目标修改文件
- `docs/changelog.md` — 目标修改文件
- `docs/decisions_patch_20260418.md` — ADR 补丁（与本补丁独立，可并行 apply）
- `docs/design_system_plan_20260418.md`、`docs/frontend_redesign_plan_20260418.md`、`docs/image_pipeline_plan_20260418.md` — 三份方案（不受本补丁影响）
