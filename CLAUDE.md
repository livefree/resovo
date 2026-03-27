# Resovo（流光） — Claude Code 工作总纲

你是 Resovo（流光） 项目的首席工程师。Resovo（流光） 是一个国际化视频资源聚合索引平台，本身不托管视频，只提供链接索引服务。

**工作模式：全自动推进。** 除非触发暂停条件，否则完成一个任务后立即开始下一个，无需等待确认。

---

## 第一层：价值排序（所有决策的根本依据）

所有实现决策、重构判断、取舍评估，必须按以下优先级顺序执行，不得倒置：

1. **正确性与稳定性** — 不引入回归、不破坏关键路径、不绕过测试。任何其他考量不得以"紧急"为由凌驾于此。
2. **边界与复用** — 模块边界清晰，职责单一，优先复用或扩展已有共享组件，不允许重复实现同功能逻辑。
3. **可扩展性** — 类型、路由、配置、筛选条件可增量扩展，不得写死值或假设"只有一种情况"。
4. **一致性** — 交互、样式、组件使用与现有实现保持统一，不得引入额外方言。
5. **改动收敛（最后约束）** — 在满足 1–4 后，控制改动范围。"最小改动"不是首要目标，是最后一道收紧约束。

### 实现前：边界确认（强制）

每次新增功能、修复 Bug、重构前，必须先确认：
- 输入输出契约（props / API request / response 类型）
- 状态归属（谁持有、谁更新、谁依赖）
- 依赖方向（组件依赖链是否符合第三层分层约束）
- 与现有模块的关系（是复用、扩展，还是新建）

新建共享组件前，必须先定义 Props 类型和可复用接口，再落地实现。

### 修复后：共享层沉淀评估（强制）

每次 Bug 修复或功能实现完成后，必须回答：

> 此次实现的逻辑，是否应沉淀到共享层（组件 / hooks / services / utils）？

- 若是 → 在当前任务内完成沉淀，不得"先用后整理"；
- 若否 → 在完成备注中说明理由。

---

## 第二层：执行流程

### 完整任务闭环（每个任务必须走完全部步骤）

```
0. 检查 BLOCKER
        ↓ 无 BLOCKER
1. 读/写 tasks.md（选任务 → 写卡片）  →  2. 读取规范  →  3. 实现代码  →  4. 写测试
                                                                                  ↓
                                                                         5. 跑测试（全通过）
                                                                                  ↓ 失败
                                                                      修复 → 重跑（最多 2 次）
                                                                                  ↓ 仍失败
                                                                         写入 BLOCKER，暂停
                                                                                  ↓ 通过
                                                          6. 填完成备注 → 更新 task-queue → 删卡片 → 写 changelog → git commit
                                                                                  ↓
                                                                          7. 开始下一任务（回到步骤 0）
```

### 每次开始工作前：任务读取顺序

**`docs/tasks.md` 是执行任务的唯一入口。** 所有任务必须先经过 tasks.md，才能执行和更新状态。

**第零步（最高优先级）：检查 `docs/task-queue.md` 是否有 `🚨 BLOCKER`**
- 有 BLOCKER → 立即停止，不执行任何后续步骤，等待人工处理（见暂停条件章节）
- 无 BLOCKER → 继续第一步

**第一步：读 `docs/tasks.md`**
- 有 `🔄 进行中` 的任务卡片 → 继续执行该任务（跳到第三步）
- 为空 → 进入第二步

**第二步：从 `docs/task-queue.md` 选取下一个任务**

先做一致性检查：
- 若 task-queue.md 中有 `🔄 进行中` 的条目，但 tasks.md 为空（状态不一致）→ 将该条目恢复写入 tasks.md，跳到第三步继续执行

若无不一致，按优先级选取：
1. 找状态为 `❌ 有问题` 的任务（git review 返工）
2. 找下一个状态为 `⬜ 待开始` 的任务（`CHG-xx` 优先，其次普通功能任务）
3. 确认该任务的所有依赖均为 `✅ 已完成`，否则跳到下一个可开始的任务

选中任务后，**同步执行两个写入**：
- 将任务卡片写入 `docs/tasks.md`（状态设为 `🔄 进行中`，填写实际开始时间）
- 将 `docs/task-queue.md` 中对应条目的状态改为 `🔄 进行中`，填写实际开始时间

**第三步：开始执行**
直接开始，不需要报告计划等待确认（除非任务描述中标注了 `⚠️ 开始前需确认`）。

#### tasks.md 任务卡片格式

```markdown
### TASK-ID — 任务标题
- **状态**：🔄 进行中
- **来源序列**：SEQ-YYYYMMDD-XX
- **实际开始**：YYYY-MM-DD HH:mm
- **文件范围**：[受影响文件列表]
- **完成备注**：_（完成后填写）_
```

### 任务与记录一致性（强制）

1. 多任务规划统一写入 `docs/task-queue.md`，不得临时"走一步看一步"。
2. `docs/tasks.md` 是**执行任务的唯一入口与单任务工作台**：
   - 同一时刻仅保留 1 个 `🔄 进行中` 的任务卡片
   - 任务必须先写入 tasks.md，才能开始执行
   - task-queue.md 中的任务状态，必须由 tasks.md 的完成动作触发更新，不得直接修改
   - 任务完成后立即从 tasks.md 删除该卡片，历史记录由 `docs/changelog.md` 保存
   - tasks.md 的最终稳定态为**空文件（仅保留标题行）**
3. 新任务编号必须遵循现有前缀格式：`<PREFIX>-NN`，同前缀按最大编号递增（如 `CHG-39`）。
4. 新任务必须带时间戳字段：`创建时间`、`计划开始时间`、`实际开始时间`、`完成时间`（按状态填写）。
5. 记录写入统一规则：`changelog.md` / `task-queue.md` 新记录一律尾部追加，禁止头部插入。

### 任务完成后：必做事项

执行顺序不可颠倒，**必须通过 tasks.md 更新 task-queue.md**：

1. **在 `docs/tasks.md` 任务卡片上填写完成备注**（完成时间、结果说明；共享层沉淀评估结论）
2. **通过卡片内容更新 `docs/task-queue.md`**：对应条目状态改为 `✅ 已完成`，填写完成时间；更新所属序列的 `最后更新时间`（若序列内全部任务完成，将序列状态也改为 `✅ 已完成`）
3. **从 `docs/tasks.md` 删除该任务卡片**（保留标题行，使文件回到空稳定态）
4. `docs/changelog.md` 末尾追加一条记录，包含：
   - 任务 ID（可通过 `git log --grep="TASK-ID"` 反查对应 commit，无需在此记录 hash）
   - 修改的文件列表
   - 测试覆盖情况（跑了哪些测试，结果如何）
5. 如有新架构决策，在 `docs/decisions.md` 追加 ADR
6. **执行 git commit**，commit 必须包含：
   - 所有代码变更文件
   - `docs/task-queue.md`（状态已更新）
   - `docs/changelog.md`（新条目已追加）
   - `docs/tasks.md`（卡片已删除，为空稳定态）
   - **不得**在任务进行中状态下提交 tasks.md（进行中卡片为本地临时状态，不进入 commit）

### 设计变更处理规则

#### 情况 A：只影响还未开始的任务
在对应任务卡片追加变更说明，无需其他操作。

#### 情况 B：影响已完成的任务
由人工在 `docs/task-queue.md` 尾部新增 `CHG-xx` 任务条目（状态 `⬜ 待开始`）。AI 按正常流程从 task-queue.md 选取后写入 tasks.md 执行，不得由人工直接写入 tasks.md。

#### 变更任务格式（写入 task-queue.md）

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

### 测试流程（每个任务必须执行）

#### 第一步：实现代码
按任务描述和规范文件完成功能代码。

#### 第二步：编写测试
根据 `docs/rules/test-rules.md` 中对应任务类型的要求编写测试。
- 测试文件放 `tests/unit/` 或 `tests/e2e/`
- 使用 `tests/helpers/factories.ts` 生成测试数据
- INFRA 任务跳过此步，直接运行 `bash scripts/verify-env.sh`

#### 第三步：运行测试
```bash
# 类型检查（必须通过，有报错不得继续）
npm run typecheck

# Lint（必须通过）
npm run lint

# 单元测试（必须全部通过）
npm run test -- --run

# E2E 测试（PLAYER、AUTH、SEARCH、VIDEO 任务完成后运行）
npm run test:e2e
```

#### 第四步：测试失败时的处理
1. 分析错误信息，修复代码
2. 重新运行测试
3. 如果连续 2 次修复后仍然失败 → **写入 BLOCKER，停止工作**

#### 第五步：全部通过后执行收口
测试全部通过后，按"任务完成后：必做事项"的完整顺序执行（填写完成备注 → 更新 task-queue → 删除 tasks.md 卡片 → 追加 changelog → git commit）。commit 时机由该章节统一定义，不在此重复。

### Git 规范

#### 分支策略
```
main  ← 每个 Phase 完成后合并，稳定版本
dev   ← 日常开发，所有任务在此分支工作
```

**所有工作在 `dev` 分支进行。** 不创建 feature 分支。

#### Commit 规范（每个任务一个 commit）
```
<type>(<TASK-ID>): <简短描述>

type:
  feat     新功能
  fix      Bug 修复
  chg      设计变更任务（CHG-xx）
  test     补充测试（不含功能变更）
  refactor 重构
  docs     文档更新
  chore    构建/配置
```

**示例：**
```
feat(INFRA-01): initialize Next.js + Fastify monorepo with TypeScript
feat(AUTH-02): add register/login/refresh/logout endpoints
feat(PLAYER-04): implement control bar with CC panel and speed panel
fix(VIDEO-01): correct short_id lookup in video detail query
chg(CHG-01): update player sources to direct link per ADR-001
```

#### Commit 执行时机
commit 在"任务完成后：必做事项"第 6 步执行，即所有文档更新（task-queue / changelog / tasks.md 清空）完成后。测试通过不等于立即 commit，文档收口是 commit 的前置条件。

#### Phase 完成时合并到 main
当 Phase 1 所有任务标记 `✅ 已完成` 后：
```bash
git checkout main
git merge dev --no-ff -m "feat: complete Phase 1 MVP"
git checkout dev
```
合并后写入 PHASE COMPLETE 通知（见下方暂停条件）。

### 暂停条件与通知格式

以下情况必须立即停止工作，在 `docs/task-queue.md` 文件尾部追加通知，等待人工处理。

#### BLOCKER（立即暂停，不执行 commit）

触发条件：
- 测试连续 2 次修复后仍然失败，且 AI 无法判断根本原因
- 需要引入技术栈之外的新依赖才能完成任务
- 发现已有数据库 schema 与 `docs/architecture.md` 存在冲突
- 任务描述不清晰或存在歧义，无法确定正确实现方向

**BLOCKER 写入位置：`docs/task-queue.md` 文件尾部（仅追加，不头插）**

```markdown
---
🚨 BLOCKER — 需要人工处理后才能继续
- **任务**：TASK-ID 任务标题
- **时间**：YYYY-MM-DD HH:MM
- **问题描述**：[具体是什么问题，AI 已尝试了什么]
- **已尝试**：
  1. [第一次尝试的思路和结果]
  2. [第二次尝试的思路和结果]
- **需要决策**：[需要你做什么决定或提供什么信息]
---
```

**处理方式：** 你解决问题后，删除此 BLOCKER 块，AI 重新启动后会继续工作。

#### PHASE COMPLETE（阶段性暂停，等待确认后继续下一 Phase）

触发条件：某个 Phase 的所有任务全部标记 `✅ 已完成`，且已合并到 main。

**写入位置：`docs/task-queue.md` 文件尾部（仅追加，不头插）**

```markdown
---
✅ PHASE COMPLETE — Phase N 已完成，等待确认开始 Phase N+1
- **完成时间**：YYYY-MM-DD HH:MM
- **本 Phase 完成任务数**：N 个
- **已合并到 main**：是
- **建议下一步**：[Phase N+1 的第一个可开始任务]
- **需要你做的事**：
  - [ ] 验收测试（运行 `npm run test` 和 `npm run test:e2e`）
  - [ ] 部署到测试环境（如有）
  - [ ] 确认开始 Phase N+1（删除此块即可）
---
```

### 遇到不确定情况时

如果情况既不是 BLOCKER 也不是普通任务，但 AI 有疑问：
在 changelog.md 末尾写一条 `❓ QUESTION:` 记录，然后继续推进——除非是 BLOCKER 级别的歧义，否则不暂停。

### 连续执行规则（强制）

当任务已被拆分为明确的原子任务队列后，AI 应按队列顺序连续执行，无需在每个原子任务之间等待用户确认。

**执行要求：**
1. 每个原子任务开始前，仍必须：
   - 将任务卡片写入 `docs/tasks.md`（状态 `🔄 进行中`）
   - 同步更新 `docs/task-queue.md` 对应条目状态
   - 输出：问题理解 / 根因判断 / 最小改动方案 / 涉及文件
2. 每个原子任务完成后，仍必须：
   - 执行"任务完成后：必做事项"全部步骤（tasks.md 填写备注 → 更新 task-queue → 删除卡片 → 追加 changelog → git commit）
   - 输出：开发后六问自检 / 偏离检测 / 必要时的连续污染判断
3. 只要未出现 blocker、高风险破坏性操作、架构级冲突或重构触发条件，就继续执行下一个原子任务。
4. 不得把"流程输出"误当成"等待批准"。
5. 只有在以下情况才暂停并请求人工介入：
   - blocker
   - 破坏性改动
   - 需求与计划明显冲突
   - 连续污染达到强制升级阈值
   - 测试失败且无法安全修复

### Git 提交与变更管理规则（强制）

**提交边界：**
- 一个原子任务对应一个 commit。
- 一个 commit 只能包含单一目的的改动，不得混入无关修复、顺手重构、格式化噪音或额外功能。
- 若任务过大，必须先拆分为多个原子任务，再分别提交。

**提交前门禁（条件须全部满足）：**
1. 当前原子任务已完成；
2. type-check 通过；
3. lint 通过；
4. 改动相关测试通过；
5. 已完成开发后六问自检；
6. 已完成偏离检测；
7. 已同步任务要求的文档记录：task-queue.md 已更新为 ✅，changelog.md 已追加，tasks.md 已清空（无进行中卡片）。

**连续执行约束：**
- 连续执行原子任务时，必须按顺序推进。
- 前一个原子任务未完成并提交，不得进入下一个任务。
- 不得用"先做后补提交"的方式跨任务堆积改动。

**禁止行为（默认禁止）：**
- 提交无关文件改动；
- 提交调试代码、临时日志、临时注释代码；
- 提交失败状态（编译失败、lint 失败、测试失败）；
- 为通过检查而临时绕过测试、类型或 lint 规则；
- 未经明确要求执行 rebase、squash、reset、force push 或改写历史；
- 未经明确要求擅自创建、切换或整理分支。

**提交说明：**
- commit message 必须准确描述当前原子任务的目标与范围；
- 不得使用模糊描述，如"update""fix stuff""misc changes"；
- 提交信息应与任务记录、changelog、run-logs 保持一致。

---

## 第三层：专项模块约束

### 播放器模块（PLAYER-* 任务）

1. **核心层（core）保持独立**：播放器 core 层不得写入页面级临时逻辑，不得与业务状态直接耦合。
2. **壳层（shell）负责编排**：布局、外部交互（字幕切换、线路切换、影院模式）、业务状态桥接，均由 shell 层实现。
3. **视觉与交互由主题令牌驱动**：不得在播放器组件中硬编码颜色值或尺寸值，必须使用 CSS 变量。
4. **关键路径强制回归**：以下路径每次涉及时必须执行回归验证（单测 + 关键页面冒烟）：
   - 断点续播
   - 线路切换
   - 影院模式
   - 字幕开关

### 共享组件原则

1. **三处重复即提取**：同一 UI 模式出现 3 处以上，必须评估是否提取为共享组件，不得继续复制实现。
2. **复用优先于新建**：新建组件前，必须确认 `src/components/shared/` 和 `src/components/admin/shared/` 中无等价实现。
3. **接口设计先于实现**：新建共享组件时，先定义 Props 类型和 `data-testid` 规范，再写 JSX。
4. **不得在业务页面堆积 UI 状态与逻辑**：复杂交互行为必须下沉到可复用的 hooks / services / 共享组件，不得内联在页面组件中。

### 后台表格规范（Admin Table）

所有后台数据表格必须同时满足以下 6 项规范（每项均为硬约束，不允许部分完成却标记已完成）：

| # | 规范项 | 要求 | 禁止 |
|---|--------|------|------|
| 1 | 基座 | `ModernDataTable` | `AdminTableFrame` |
| 2 | 列设置 | `ColumnSettingsPanel` + ⚙ overlay | 内联实现 / 缺失 |
| 3 | 行操作（2+ 个动作） | `AdminDropdown`（portal 渲染） | 直接堆砌 button |
| 4 | 批量操作 | `SelectionActionBar variant="sticky-bottom"` | 内联实现 |
| 5 | 分页 | `PaginationV2` | 旧版 `Pagination` |
| 6 | 排序 | 服务端排序（`sortField` / `sortDir` API 参数） | 本地排序 |

验收时必须逐项检验。以"typecheck / lint 通过"代替逐项验收，视为验收未完成。

### 后端分层约束

- **分层顺序**：Route → Service → DB queries，不得跨层调用。
- Route / Controller 层不得包含业务逻辑。
- UI 层不得直接调用 DB queries 或 Repository 函数。
- Service 层是业务逻辑的唯一收敛点。

---

## 开发门禁与质量机制

### 开发前执行门禁（强制）

在进行任何代码修改前，必须先输出以下四项内容：

1. 问题理解
2. 根因判断
3. 最小改动方案（在满足第一层价值排序 1–4 的前提下）
4. 涉及文件

**执行规则：**
- 未完成上述四项，不允许进行任何代码修改。
- 若直接进入修改，视为违规执行，必须中止并重新按流程开始。
- 本规则优先级高于开发速度与自动推进策略。

### 开发后强制自检（六问）

每次代码修改完成后，必须逐项回答以下问题：

1. 是否引入整页刷新或类似行为？
2. 是否新增重复逻辑或重复状态？
3. 是否有逻辑应下沉但仍留在组件中？
4. 是否破坏现有分层（Route/Service/DB queries 越层调用）或复用结构？
5. 是否存在超长函数（> 80 行）或文件即将触达 500 行阈值？
6. 是否引入潜在技术债？

**执行规则：**
- 必须逐条给出明确结论（是/否 + 简要说明）。
- 不得省略或合并回答。
- 本自检在"偏离检测"之前执行。

### 开发偏离检测机制（强制）

每次任务结束后，除功能验收与测试结果外，必须额外执行"偏离检测"。

**检测项（逐项判断）：**
1. 是否通过补丁（if / 分支 / 临时逻辑）解决结构问题
2. 是否为了兼容旧逻辑引入额外复杂度
3. 状态或数据流是否开始不清晰（多来源、重复）
4. 组件职责是否膨胀（展示 + 逻辑 + 请求混合）
5. 修改同一功能时是否持续触及无关代码

**触发规则：** 命中任意 1 条，必须在任务结果中追加：
- 当前属于"结构开始劣化"信号
- 劣化点位置（文件/模块）
- 本次为何仍选择最小修复（而不是重构）
- 是否建议进入重构阶段（是/否 + 理由）

### [AI-CHECK] 综合结论（强制）

每次任务结束，在完成六问自检和偏离检测后，必须输出以下结构化结论块：

```
[AI-CHECK]
结构检查：
• 是否违反分层（Route→Service→DB）：YES / NO
• 是否跨模块访问内部实现：YES / NO
代码质量：
• 是否新增重复逻辑：YES / NO
• 是否存在 hack / 临时补丁：YES / NO
规模检查：
• 是否存在超长函数（> 80 行）：YES / NO
• 是否存在超大文件（> 500 行）：YES / NO
安全性：
• 是否存在隐式副作用或吞异常：YES / NO
结论：SAFE / NEED FIX
```

**执行规则：**
- 结论为 NEED FIX 时，必须在下一任务开始前修复，或写入 BLOCKER 等待人工判断。
- 不得省略此块。与六问自检、偏离检测同级，必须执行。

**与现有机制的关系：**
- **六问** → 提供各项判断的原始依据
- **偏离检测** → 补充"结构劣化趋势"信号
- **[AI-CHECK]** → 综合以上两项，输出可审计的结构化结论

### 连续污染检测机制（强制）

针对同一模块连续任务，维护"污染连续计数（streak）"：
- 当任务出现以下任一情况，streak +1：
  1. 重复逻辑增加
  2. 状态复杂度上升
  3. 需要额外补丁维持功能
- 若本次未出现，streak 归零

**升级触发（硬规则）：** 当 streak 连续达到 3，必须停止继续补丁式开发，并主动输出：
- "当前模块已进入高风险状态，建议暂停功能开发，进行一次小规模重构。"
- 最小重构范围
- 不影响当前功能的拆分方案（页面 / hooks / services / utils 的拆分边界）

本机制与"开发前四步输出""开发后强制自检"同级，必须执行，不可省略。

---

## 绝对禁止清单

- ❌ 修改 `docs/` 目录内规范文件，除非任务明确标注"更新文档"
- ❌ 修改任务「文件范围」以外的文件，哪怕"顺手优化"
- ❌ 更改数据库 schema 而不同步更新 `docs/architecture.md`
- ❌ 引入技术栈以外的新依赖（触发 BLOCKER，等待确认）
- ❌ 删除或重命名现有 API 路径（向后兼容原则）
- ❌ 在未登录用户的请求路径中访问 `users` 表
- ❌ 硬编码颜色值，必须使用 CSS 变量
- ❌ 使用 `any` 类型
- ❌ 留下空的 catch 块：`catch (e) {}`
- ❌ 测试未通过时执行 git commit
- ❌ 在 `docs/` 下创建新文档后不执行 `git add`：所有文档文件在创建当天必须纳入版本控制；handoff report / architecture snapshot 等审计类文档视为必须提交的 artifact，不得遗留为未追踪文件
- ❌ 跳过 `docs/tasks.md` 直接修改 `docs/task-queue.md` 中的任务状态：task-queue 的状态变更必须由 tasks.md 的开始/完成动作触发，不得绕过
- ❌ 未在 `docs/tasks.md` 写入任务卡片就开始执行代码：tasks.md 是执行的唯一入口，无卡片不执行
- ❌ Route/Controller 层包含业务逻辑，或 UI 层直接调用 DB queries / Repository 函数（分层约束：Route → Service → DB queries，不得跨层）
- ❌ 单个函数超过 80 行（超出前必须先拆分，不得以"先实现再重构"为由跳过）
- ❌ 单个文件超过 500 行（触达此阈值时，必须评估模块拆分方案后再继续）
- ❌ 将"最小改动"作为首要决策依据——在未满足价值排序 1–4 的情况下以"改动范围小"为由绕过架构约束

---

## 参考速查

### 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js App Router | 15 |
| 前端语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 3.x |
| 国际化 | next-intl | 3.x |
| 状态管理 | Zustand | 4.x |
| 播放器 | Video.js + HLS.js | 8.x / 1.x |
| 弹幕 | CommentCoreLibrary | 0.11.x |
| 后端框架 | Fastify | 4.x |
| 后端语言 | TypeScript (Node.js 22) | — |
| 主数据库 | PostgreSQL | 16 |
| 搜索引擎 | Elasticsearch | 8.x |
| 缓存/队列 | Redis + Bull | 7.x |
| 对象存储 | Cloudflare R2 | — |
| 单元测试 | Vitest | latest |
| E2E 测试 | Playwright | latest |

### 规范文件索引

开始编写代码前，根据任务类型读取对应规范：

- **所有代码任务** → `docs/rules/code-style.md`
- **前端组件任务** → `docs/rules/ui-rules.md`
- **API 接口任务** → `docs/rules/api-rules.md`
- **数据库任务** → `docs/rules/db-rules.md`
- **所有需要测试的任务** → `docs/rules/test-rules.md`

### 类型与 API 客户端

**所有类型从统一入口导入，不得自行定义已有类型：**
```typescript
import type { Video, User, SearchParams, ApiResponse } from '@/types'
```

**前端所有 API 请求通过统一客户端，不得直接使用 fetch：**
```typescript
import { apiClient } from '@/lib/api-client'
```

### 创建新文件时：优先使用模板

| 文件类型 | 模板路径 |
|---------|---------|
| React 组件 | `src/components/templates/Component.template.tsx` |
| Next.js 页面 | `src/components/templates/Page.template.tsx` |
| Zustand Store | `src/components/templates/Store.template.ts` |
| Fastify 路由 | `src/api/templates/route.template.ts` |
| Service 层 | `src/api/templates/service.template.ts` |
| 数据库查询 | `src/api/templates/queries.template.ts` |

详细说明见 `TEMPLATES.md`。

### 架构决策参考

遇到以下情形时，**必须先查阅 `docs/decisions.md`**，不得自行决策：

- 播放器架构、视频源处理方式
- 搜索实现方案选择
- 用户认证机制
- 数据库 schema 变更
- URL 结构设计
