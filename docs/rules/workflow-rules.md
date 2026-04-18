# Resovo（流光） — 任务工作流规范

> status: active
> owner: @engineering
> scope: task lifecycle, task-queue management, blocker/phase-complete protocols, baseline test ledger protocol
> source_of_truth: yes
> supersedes: CLAUDE.md §"第二层：执行流程"（2026-04-12 拆出）
> last_reviewed: 2026-04-18

---

## 任务入口规则

**`docs/tasks.md` 是执行任务的唯一入口。** 所有任务必须先经过 tasks.md，才能执行和更新状态。

### Session 冷启动检查（上次 commit 超过 4 小时时执行）

```bash
npm run preflight   # 环境 + 迁移 + 类型 + lint + 单测基线
```

全部通过后再进入任务流程；若失败先修复基线，再选取任务。

---

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

## Phase 基线测试条款（每次重写启动必走）

凡进入 Phase 0 类型的「重写启动」里程碑，BASELINE 类任务必须遵守以下五条协议，否则 PHASE COMPLETE 通知不得发出：

1. **失败完整归档**：`npm run test -- --run` 与 `npm run test:e2e` 输出的失败数与失败测试 ID 清单必须完整归档到 `docs/baseline_<YYYYMMDD>/failing_tests.json`。JSON schema 由 `scripts/verify-baseline.ts` 约束，至少含字段 `{ test_id, suite, kind: "unit"|"e2e", status: "failed"|"passed"|"flaky", duration_ms, error_excerpt }`。

2. **失败逐条分类**：每条失败必须在 `docs/test_triage_<YYYYMMDD>.md` 标注：
   - **类别**：A（基础设施 / suite 加载失败）/ B（架构真源冲突）/ C（testid / DOM 漂移）/ D（断言漂移）
   - **处置**：`fix`（本 Phase 内修） / `quarantine`（进隔离清单） / `defer`（延迟到具体里程碑）
   - **原因**：一句话说明
   - 选 `defer` 的必须填关联里程碑编号（如 `M3`、`M5`）
   不得有空字段。

3. **数字一致性校验**：PHASE COMPLETE 通知中引用的失败数字必须与 `failing_tests.json` 一致，由 `scripts/verify-baseline.ts` 在 PR 检查阶段保证。数字不符时阻断 PHASE COMPLETE。

4. **隔离清单作为 Phase 门禁**：`docs/known_failing_tests_phase<N>.md` 是 Phase 合并门禁。CI 流程跑 `npm run test:guarded` 时，将当前失败集合与隔离清单做 diff：
   - 清单**外**新增失败 → 退出码非 0，阻断 merge
   - 清单**内**失败 → 仅 warning，不阻断
   - 清单**外**新增通过（即原本失败的测试现在通过）→ 提示该测试可以从清单移除

5. **隔离清单单调收敛**：每进入新 Phase，隔离清单只能**缩小不能增长**。新增失败必须走以下任一路径：
   - 在本 Phase 内修复
   - 创建 CHG-NN 任务卡，在下一个 Phase 内修复
   - 不得直接追加到隔离清单

### 失败类别定义

| 类别 | 定义 | 典型修复方 |
|------|------|----------|
| A | 测试 suite 自身加载失败（import 错、依赖缺失） | 测试基础设施 |
| B | 测试断言与实现属于两套真源（路由命名、字段命名等架构级冲突） | ADR 决策后双侧对齐 |
| C | 组件 testid 或 DOM 结构在某次重构后未同步测试 | 测试侧或组件侧均可，看哪侧将先重写 |
| D | 测试断言陈旧（API 返回值、边界处理变化），可能是真 bug 或断言过时 | 真 bug 修源码，否则修测试 |

### 与现有规则的衔接

- 「连续执行规则」中「测试连续 2 次仍失败」BLOCKER 触发条件不变，但默认范围限定为「**隔离清单外**的失败」
- 「任务完成后：必做事项」第 4 步 changelog 追加，对于 BASELINE 任务必须含「failing_tests.json 路径 + 当前隔离清单大小」两项

---

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

---

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

---

## 任务完成后：必做事项（顺序不可颠倒）

1. 在 tasks.md 任务卡片填写完成备注（完成时间、结果、共享层沉淀评估、执行模型偏离说明如有）
2. 确认 tasks.md 卡片的"执行模型"字段已写完整模型 ID，"子代理调用"字段已记录本任务所有 Task 工具调用的 subagent 名称与其 model 参数
3. 更新 task-queue.md：对应条目 → `✅ 已完成`，填写完成时间，"完成备注"追加 `执行模型: <完整 ID>` 一行；若序列内全部完成，序列状态也改为 `✅`
4. 从 tasks.md 删除该任务卡片（文件回到空稳定态）
5. `docs/changelog.md` 末尾追加记录（任务 ID、执行模型、子代理、文件列表、测试覆盖情况，完整格式见 changelog.md 顶部模板）
6. 如有新架构决策，在 `docs/decisions.md` 追加 ADR
7. git commit（commit message 含 `Executed-By-Model` 与 `Subagents` 两个 trailer，格式见 git-rules.md §Commit trailers）

---

## 维护性工作快速通道（MAINT）

适用于**计划外、不在 task-queue 中**的轻量维护工作，无需完整任务卡片流程。

**触发条件（全部满足）：**
- 影响文件 ≤ 5 个
- 不涉及业务逻辑（仅配置、依赖、文档、路径、格式）
- 操作可逆（无 schema 变更、无 API 删除）

**执行流程：**
1. 直接开始执行（跳过 tasks.md 卡片）
2. commit 格式：`chore: 描述` 或 `docs: 描述`（允许省略 TASK-ID）
3. 完成后在 `docs/changelog.md` 追加一行记录

**不适用场景：** 影响业务逻辑、超过 5 个文件、schema 变更 → 必须走正常任务流程。

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

触发条件：测试连续 2 次仍失败 / 需要引入未确认依赖 / schema 与 architecture.md 冲突 / 任务描述歧义无法实现 / 重写阶段（M0–M6）收到与三份方案（design_system / frontend_redesign / image_pipeline）目标无关的新业务需求。

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
