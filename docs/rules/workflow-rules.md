# Resovo（流光） — 任务工作流规范

> status: active
> owner: @engineering
> scope: task lifecycle, task-queue management, blocker/phase-complete protocols
> source_of_truth: yes
> supersedes: CLAUDE.md §"第二层：执行流程"（2026-04-12 拆出）
> last_reviewed: 2026-04-12

---

## 任务入口规则

**`docs/tasks.md` 是执行任务的唯一入口。** 所有任务必须先经过 tasks.md，才能执行和更新状态。

### 每次开工前的三步顺序

**第零步（最高优先级）：检查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`**
- 有 BLOCKER → 立即停止，等待人工处理
- 无 BLOCKER → 继续第一步

**第一步：读 `docs/tasks.md`**
- 有 `🔄 进行中` 的任务卡片 → 继续执行该任务（跳第三步）
- 为空 → 进入第二步

**第二步：从 `docs/task-queue.md` 选取下一个任务**

一致性检查：若 task-queue.md 中有 `🔄 进行中` 但 tasks.md 为空 → 恢复写入 tasks.md，跳第三步。

选取优先级：
1. 状态为 `❌ 有问题` 的任务（git review 返工）
2. 下一个 `⬜ 待开始`（`CHG-xx` 优先）
3. 所有依赖均为 `✅ 已完成`，否则跳下一个

选中后同步写入：
- 任务卡片写入 `docs/tasks.md`（状态 `🔄 进行中`，填写实际开始时间）
- `docs/task-queue.md` 对应条目改为 `🔄 进行中`，填写实际开始时间

**第三步：直接开始执行**（任务描述标注 `⚠️ 开始前需确认` 时除外）

---

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

---

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

---

## 任务完成后：必做事项（顺序不可颠倒）

1. 在 tasks.md 任务卡片填写完成备注（完成时间、结果、共享层沉淀评估）
2. 更新 task-queue.md：对应条目 → `✅ 已完成`，填写完成时间；若序列内全部完成，序列状态也改为 `✅`
3. 从 tasks.md 删除该任务卡片（文件回到空稳定态）
4. `docs/changelog.md` 末尾追加记录（任务 ID、文件列表、测试覆盖情况）
5. 如有新架构决策，在 `docs/decisions.md` 追加 ADR
6. git commit（包含代码文件 + task-queue.md + changelog.md + tasks.md，**不得**在进行中状态提交 tasks.md）

---

## 设计变更处理规则

**情况 A — 只影响未开始的任务**：在对应任务卡片追加变更说明，无需其他操作。

**情况 B — 影响已完成的任务**：由人工在 task-queue.md 尾部新增 `CHG-xx` 条目（状态 `⬜ 待开始`）。AI 按正常流程选取后写入 tasks.md 执行，不得由人工直接写入 tasks.md。

---

## 任务记录一致性约束

- 多任务规划统一写入 task-queue.md，不得临时"走一步看一步"
- 同一时刻 tasks.md 只允许 1 个 `🔄 进行中` 卡片
- task-queue.md 状态必须由 tasks.md 的开始/完成动作触发更新，不得直接修改
- changelog.md / task-queue.md 新记录一律**尾部追加**，禁止头部插入
- 新任务编号：`<PREFIX>-NN`，同前缀按最大编号递增

---

## 连续执行规则

任务已拆分为明确原子队列时，AI 按队列顺序连续执行，无需每个任务之间等待确认。

每个原子任务仍必须：
- 开始前：写卡片到 tasks.md，更新 task-queue.md，输出问题理解/根因/方案/涉及文件
- 完成后：执行"任务完成后：必做事项"全部步骤，输出质量门禁结论（详见 quality-gates.md）

暂停条件（需人工介入）：BLOCKER、破坏性改动、需求与计划明显冲突、连续污染 streak=3、测试失败无法安全修复。

---

## 暂停通知格式

所有暂停通知写入 `docs/task-queue.md` 文件**尾部**（仅追加，不头插）。

### BLOCKER 模板

触发条件：测试连续 2 次仍失败 / 需要引入未确认依赖 / schema 与 architecture.md 冲突 / 任务描述歧义无法实现。

```markdown
---
🚨 BLOCKER — 需要人工处理后才能继续
- **任务**：TASK-ID 任务标题
- **时间**：YYYY-MM-DD HH:MM
- **问题描述**：[具体问题，AI 已尝试了什么]
- **已尝试**：
  1. [第一次思路和结果]
  2. [第二次思路和结果]
- **需要决策**：[需要你做什么决定或提供什么信息]
---
```

处理方式：解决后删除此 BLOCKER 块，AI 重新启动后继续工作。

### PHASE COMPLETE 模板

触发条件：某 Phase 所有任务 `✅ 已完成`，且已合并到 main。

```markdown
---
✅ PHASE COMPLETE — Phase N 已完成，等待确认开始 Phase N+1
- **完成时间**：YYYY-MM-DD HH:MM
- **本 Phase 完成任务数**：N 个
- **已合并到 main**：是
- **建议下一步**：[Phase N+1 的第一个可开始任务]
- **需要你做的事**：
  - [ ] 验收测试（运行 `npm run test -- --run` 和 `npm run test:e2e`）
  - [ ] 部署到测试环境（如有）
  - [ ] 确认开始 Phase N+1（删除此块即可）
---
```

### 不确定情况

既不是 BLOCKER 也不是普通任务时：在 changelog.md 末尾写 `❓ QUESTION:` 记录，然后继续推进。
