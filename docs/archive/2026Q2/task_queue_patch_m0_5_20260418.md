# Resovo — M0.5 测试床修复 + 并行执行授权补丁（2026-04-18）

> status: archived
> owner: @planning
> scope: M0 与 M1 之间插入 Phase 0.5（测试床修复与分类）+ workflow-rules BASELINE 协议升级 + M0.5 与 TOKEN-01..06 并行执行规则
> source_of_truth: no
> target_files: `docs/task-queue.md`、`docs/rules/workflow-rules.md`
> supersedes: none
> superseded_by: docs/task-queue.md, docs/rules/workflow-rules.md
> append_only: yes（除 workflow-rules 新增章节为定位插入）
> last_reviewed: 2026-04-24
> trigger_reason: Phase 0 实跑结果与 PHASE COMPLETE 通知失败数不一致；E2E 97/82 失败包含真源冲突与漂移，直接进 M1 会让验收判据失真

---

## 一、应用方式

本补丁含 3 件事，需依次应用：

1. **第三节 BASELINE 协议升级**：把 §3 内容定位插入 `docs/rules/workflow-rules.md`（具体插入位置见 §3.0）
2. **第四节 M0.5 任务序列**：把 §4 整段追加到 `docs/task-queue.md` 尾部（PHASE COMPLETE — Phase 0 通知之后）
3. **第五节 并行执行规则**：作为执行说明，不写入任何文件，但人工启动 Claude Code 会话时遵守

执行约束：

- M0.5 共 7 张卡（TESTFIX-00 至 TESTFIX-06），完成后才能启动 TOKEN-07
- TOKEN-01..06 可与 M0.5 **并行**，但必须遵守 §5 文件范围隔离与同步点协议
- 任一会话遇到共享文件（decisions.md / changelog.md / tasks.md）冲突 → 暂停并 `git pull --rebase` 后再继续

---

## 二、模型分布速查

| 里程碑 | 任务数 | opus | sonnet | haiku |
|--------|-------:|-----:|-------:|------:|
| M0.5 测试床修复 | 7 | 2 | 4 | 1 |

| TASK | 模型 | 阶段角色 |
|------|------|---------|
| TESTFIX-00 | haiku | 前置——升级 workflow-rules BASELINE 协议 |
| TESTFIX-01 | sonnet | 修复 2 个 vitest suite import 失败 |
| TESTFIX-02 | opus | `/watch/` vs `/movie/` 真源决策 + ADR-034 |
| TESTFIX-03 | opus | E2E 失败逐项分类（triage 文档 + JSON）|
| TESTFIX-04 | sonnet | 修复 triage 标注「立即修复」的 C 类 testid |
| TESTFIX-05 | sonnet | 修复 D 类真 bug（源代码侧）|
| TESTFIX-06 | sonnet | 隔离清单 + CI 门禁 + verify-baseline 脚本 |

---

## 三、workflow-rules.md BASELINE 协议升级（§3）

### 3.0 插入位置

在 `docs/rules/workflow-rules.md` 中，于「任务入口规则」一节之后、「任务卡片格式（tasks.md）」一节之前，新增独立小节「Phase 基线测试条款（每次重写启动必走）」。`last_reviewed` 字段同步更新为 `2026-04-18`，`scope` 字段在末尾追加 `, baseline test ledger protocol`。

### 3.1 新增章节内容

```markdown
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
```

### 3.2 与现有规则的衔接

- 「连续执行规则」中「测试连续 2 次仍失败」BLOCKER 触发条件不变，但默认范围限定为「**隔离清单外**的失败」
- 「任务完成后：必做事项」第 4 步 changelog 追加，对于 BASELINE 任务必须含「failing_tests.json 路径 + 当前隔离清单大小」两项

---

## 四、SEQ-20260418-M0.5 任务序列（追加到 task-queue.md）

### 序列头

- 序列状态：⬜ 待开始
- Phase：Phase 0.5 — 测试床修复与分类
- 创建时间：2026-04-18
- 包含任务数：7
- 依赖：SEQ-20260418-M0 全部完成（已满足，commit `2e5cfdf`）
- 完成条件：全部 7 张任务卡 `✅ 已完成` + 合并 main + PHASE COMPLETE 通知落盘
- 串行约束：TESTFIX-00 → (TESTFIX-01 ‖ TESTFIX-02) → TESTFIX-03 → (TESTFIX-04 ‖ TESTFIX-05) → TESTFIX-06

### 任务卡片

#### TESTFIX-00 — workflow-rules.md 追加 Phase 基线测试条款
- **状态**：⬜ 待开始
- **建议模型**：haiku
- **创建时间**：2026-04-18
- **依赖**：无（M0.5 启动信号）
- **文件范围**：
  - 修改 `docs/rules/workflow-rules.md`（按本补丁 §3.0 定位插入 §3.1 内容）
- **变更内容**：
  - 在「任务入口规则」与「任务卡片格式」之间新增「Phase 基线测试条款」章节
  - 章节内容严格按本补丁 §3.1 复制
  - 更新文件头 `last_reviewed: 2026-04-18`
  - 在 `scope` 字段尾部追加 `, baseline test ledger protocol`
  - 不修改其他章节
- **验收**：
  - workflow-rules.md `npm run lint` 无 markdown lint 报错（如启用）
  - 新章节锚点不与现有章节冲突
  - `git diff` 仅含本任务范围内的改动
- **完成备注**：_（AI 填写）_

#### TESTFIX-01 — 修复 2 个 vitest suite import 失败
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-00
- **文件范围**：
  - 由调查阶段定位的 2 个失败 suite 文件
  - 可能涉及 `tsconfig.json` path alias、`vitest.config.ts`、缺失的 `package.json` dependency
- **变更内容**：
  - 跑 `npm run test -- --run` 输出 `--reporter=verbose`，定位 2 个 suite import 失败的精确报错（含 stack）
  - 分类排查：path alias 错 / missing dep / 循环引用 / TS 编译错
  - 修复 import 链路至 suite 可正常加载（允许测试断言依然失败，但 suite 不能在 import 阶段崩）
  - 完成备注必须列出：失败 suite 文件路径、root cause（一句话）、修复方式
- **验收**：
  - `npm run test -- --run` 输出中 0 suite import error
  - 单测总数从基线的 977 增加（先前 2 个 suite 内的测试现在能跑到，可能新增更多失败，正常）
  - `npm run typecheck` 不引入新错
- **完成备注**：_（AI 填写）_

#### TESTFIX-02 — `/watch/` vs `/movie/` 路由真源决策 + ADR-034
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：无（可与 TESTFIX-01 并行）
- **文件范围**：
  - 调查范围（只读）：`apps/web/src/app/[locale]/{watch,movie}/`、`apps/web/src/components/Search/`、`apps/web/src/lib/url-builder/`、`e2e/**/*.spec.ts` 中 `/watch` 与 `/movie` 相关断言
  - 实施范围：决策落地后的源码 / 测试侧改动文件
  - 追加 `docs/decisions.md` — ADR-034
- **变更内容**：
  - **第一步：调查现状**
    - `/watch/[slug]` 与 `/movie/[id]` 路由是否同时存在？
    - 搜索结果 href 生成逻辑实际产出哪种？（Search 组件 + url-builder）
    - 数据库内容详情页 canonical URL 字段（如有）的设计意图
    - 测试期望 `/watch/` 的依据（git log 追溯）
  - **第二步：决策**（在 ADR-034 中正式记录）
    - A. `/watch/` 为真源（测试期望对，代码错）：修复搜索结果生成逻辑
    - B. `/movie/` 为真源（代码对，测试错）：更新 E2E 测试 + url-builder 注释
    - C. 两者并存（短期）：路由层 301 redirect，任选其一为规范化路径
  - **第三步：实施**
    - 按选定方案修改源码或测试
    - SEO 指标无回归（与 BASELINE-02 ADR-030 验证指标对齐）
    - ADR-034 含：决策、理由（含搜索 SEO 历史链接保留考量）、影响范围、迁移路径、回滚成本
- **验收**：
  - ADR-034 已写入 decisions.md（紧接 ADR-031 / ADR-033 排序）
  - E2E 中所有 `/watch/` `/movie/` 相关失败消除（实施侧验证 + triage 文档对应类别清空 B 类）
  - `docs/changelog.md` 含一条 ADR-034 实施记录
- **完成备注**：_（AI 填写）_

#### TESTFIX-03 — E2E 失败逐项分类登记 + triage 文档 + 校验脚本
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-01、TESTFIX-02（在干净的 suite 与正确的真源上做 triage）
- **文件范围**：
  - 新增 `docs/test_triage_20260418.md`
  - 新增 `docs/baseline_20260418/failing_tests.json`
  - 新增 `scripts/verify-baseline.ts`（实现 §3.1 第 3 条校验）
  - 修改 `package.json`（追加 `verify:baseline` script）
- **变更内容**：
  - 跑 `npm run test -- --run` 与 `npm run test:e2e`，采集所有失败 test_id（含 suite 名、kind、duration、error excerpt）
  - 生成 `failing_tests.json`，schema 按 §3.1 第 1 条
  - 生成 `test_triage_20260418.md`，对每条失败标注 `{ test_id, 类别, 处置, 原因, 关联里程碑 }`
  - 类别判断标准：
    - A：经 TESTFIX-01 已修复，理论应清零；如残留必须说明
    - B：经 TESTFIX-02 决策已对齐，理论应清零；如残留必须说明
    - C：组件 testid/DOM 漂移，进一步分「立即修」（M2-M4 不会重写的组件）/「延迟」（M5 重制时一并处置）
    - D：断言漂移，分「真 bug」（修源码 → TESTFIX-05）/「断言过时」（修测试或隔离）
  - 处置项汇总：fix X 条 / quarantine Y 条 / defer Z 条，各延迟里程碑承接数
  - `verify-baseline.ts` 实现：
    - 解析 PHASE COMPLETE 通知中的失败数字
    - 与 `failing_tests.json` 总数对比，不符则退出码非 0
    - 命令：`npm run verify:baseline -- --phase 0.5`
- **验收**：
  - test_triage 文档覆盖**所有**当前失败测试，无空白处置（人工抽查 5 条）
  - failing_tests.json 通过自身 verify-baseline 校验
  - 所有 `defer` 项均关联到 M2/M3/M4/M5 中的具体里程碑
  - 汇总表与 changelog 一致
- **完成备注**：_（AI 填写）_

#### TESTFIX-04 — 修复 C 类「立即修复」testid / DOM 漂移
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-03
- **文件范围**：
  - 由 triage 文档 C 类「立即修」清单决定（按文档实际清单执行，不在本卡预设）
  - 涉及 `e2e/**/*.spec.ts` 与 `apps/web/src/components/**/*.tsx` 中 `data-testid` 属性
- **变更内容**：
  - 按 triage 文档 C 类「立即修复」逐项处理
  - 修复策略：**优先修测试侧 testid 命名以匹配组件**（避免组件 API 漂移传染到使用方），除非组件命名本身有歧义
  - **严格禁止**：触碰 triage 标注「defer to M3-M5」的 testid（这些会在对应里程碑统一处置）
  - 每修复一条，在 triage 文档对应行更新状态为 `fixed`，附 commit hash
- **验收**：
  - 关联 E2E 全绿
  - triage 文档 C 类「立即修」状态全部 `fixed`
  - 未触碰任何 `defer` 项（git diff 验证）
- **完成备注**：_（AI 填写）_

#### TESTFIX-05 — 修复 D 类「真 bug」（源代码侧）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-03
- **文件范围**：
  - 由 triage 文档 D 类「真 bug」清单决定
  - 涉及 `apps/server/src/services/`、`apps/web/src/lib/`、`apps/web/src/components/` 等业务代码
- **变更内容**：
  - 按 triage 文档 D 类「真 bug」逐项修复**源代码**（**不**修测试断言）
  - 真 bug 定义：测试断言正确，代码实现错（返回值类型错、边界处理错、状态机错等）
  - 每修一个 bug，在 `docs/changelog.md` 追加一行：`fix(<TASK-ID>): <bug 描述>，root cause: <一句话>`
  - 单 commit 只修一个 bug（保留可回滚性）
- **验收**：
  - 关联单测全绿
  - changelog.md 含每个 bug 的独立条目
  - `npm run typecheck` 不引入新错
  - triage 文档 D 类「真 bug」状态全部 `fixed`
- **完成备注**：_（AI 填写）_

#### TESTFIX-06 — 隔离清单 + CI 门禁 + test:guarded 脚本
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-04、TESTFIX-05
- **文件范围**：
  - 新增 `docs/known_failing_tests_phase0.md`
  - 修改 `scripts/verify-baseline.ts`（追加 diff 模式）
  - 新增 `scripts/test-guarded.ts`（包装 vitest + playwright 输出与隔离清单做 diff）
  - 修改 `package.json`（追加 `test:guarded` script）
  - 修改 `.github/workflows/ci.yml` 或等价 CI 配置（新增门禁步骤）
- **变更内容**：
  - 从 triage 文档抽取所有 `quarantine` + `defer` 项作为 Phase 0 隔离清单
  - 隔离清单 markdown 格式：
    ```markdown
    | test_id | kind | 类别 | 处置 | 关联里程碑 | 原因 |
    ```
  - `scripts/test-guarded.ts`：
    - 跑 `npm run test -- --run --reporter=json` + `npm run test:e2e --reporter=json`
    - 解析失败 test_id 集合
    - 与隔离清单 diff：
      - 新增失败（清单外） → 退出码 1，打印新增失败清单
      - 隔离清单内失败 → 仅 warning
      - 清单内失败现在通过 → 提示「可以从清单移除」
  - CI 配置在 `npm run lint` + `npm run typecheck` 之后调用 `npm run test:guarded`
- **验收**：
  - 模拟一条新失败测试（临时改 source）→ CI 退出码 1，本地 `npm run test:guarded` 同样退出 1
  - 模拟一条隔离清单内失败 → CI 仅 warning，退出码 0
  - 模拟一条清单内失败现在通过 → CI 提示移除，但不阻断
  - `npm run test:guarded` 本地可跑，输出可读
- **完成备注**：_（AI 填写）_

---

## 五、与 SEQ-20260418-M1 TOKEN-01..06 并行执行规则

### 5.1 并行授权范围

允许在 M0.5 推进期间，**同时**开启第二个 Claude Code 会话推进 M1 的 TOKEN-01 至 TOKEN-06。TOKEN-07 起必须等 M0.5 完成。

理由：TOKEN-01..06 的产物均位于 `packages/design-tokens/`，与 M0.5 修改范围（`apps/`、`e2e/`、`scripts/`、`docs/test_triage,known_failing,baseline_*`）物理隔离。

### 5.2 文件范围隔离表

| 路径 | 归属会话 |
|------|---------|
| `apps/web/`、`apps/admin/`、`apps/server/` | M0.5 |
| `e2e/`、`scripts/` | M0.5 |
| `docs/test_triage_20260418.md`、`docs/baseline_20260418/`、`docs/known_failing_tests_phase0.md` | M0.5 |
| `packages/design-tokens/` | M1 |
| 根 `package.json` 的 `workspaces` 字段 | M1（仅追加 `packages/design-tokens`）|
| 根 `package.json` 的 `scripts` 字段 | M0.5（追加 `verify:baseline`、`test:guarded`）|
| `tsconfig.json` 路径 alias | 双方均可改，但任一方改前必须 `git pull --rebase` |

### 5.3 共享文件冲突协议

仅以下三个文件可能产生冲突：

| 文件 | 冲突点 | 协议 |
|------|--------|------|
| `docs/decisions.md` | M0.5 写 ADR-034；M1 写 ADR-032、ADR-033 | 任一会话写入前 `git pull --rebase`；写入后立即 commit + push；ADR 编号按顺序占用，避免并发分配冲突 |
| `docs/changelog.md` | 双方均尾部追加 | 尾部追加无冲突；如撞头由 git 自动 merge |
| `docs/tasks.md` | 同一时刻只允许 1 张进行中卡（workflow-rules 硬约束） | **此文件强制串行**：同一时刻只有一个会话持有进行中卡，另一会话必须空 tasks.md 才能启动新卡 |

### 5.4 实操流程

1. **用户开 2 个 Claude Code 会话**：session A 处理 M0.5，session B 处理 M1
2. **tasks.md 协调**：每张卡开始前，启动会话先 `git pull` 并确认 tasks.md 为空（仅标题行），方可写入卡片
3. **commit 顺序**：任一会话完成卡片 commit + push 后，**人工通知**另一会话 `git pull --rebase`
4. **ADR 编号占用**：M0.5 启动时即在 decisions.md 文件尾部预留 `## ADR-034: <待 TESTFIX-02 决策填充>`占位行；M1 启动时同样预留 ADR-032 / ADR-033 占位。这样并发分配冲突被序列化为占位写入冲突，更易解决。
5. **同步检查点**：
   - M0.5 TESTFIX-03 完成时 → 人工核验 triage 文档无任何 `defer to M1`（理论应无，因 M1 是新代码，没有遗留测试可漂移）
   - M0.5 TESTFIX-06 完成 = M0.5 完成
   - M1 TOKEN-06 完成 = M1 第一阶段完成
   - **两者都完成后**才能启动 TOKEN-07

### 5.5 严格禁止

- ❌ 不开 git worktree 或 feature 分支（违反 ADR-031 单线推进）
- ❌ 不绕过 workflow-rules「同一时刻 tasks.md 仅 1 张进行中卡」约束
- ❌ 任一会话不得修改对方文件范围内文件（即便顺手）
- ❌ 不得在另一会话有进行中卡时强行写入 tasks.md（哪怕另一会话空闲未 push）
- ❌ 不得跳过 §5.3 的 `git pull --rebase` 协议直接强 push（会引发非线性历史，ADR-031 禁止）

### 5.6 降级方案（可选）

若并行操作造成 ≥ 2 次 git rebase 冲突或人工协调成本超过预期，立即降级为**串行**：M0.5 完成后再启动 M1。降级决定写入 `docs/changelog.md` 一行，无需 ADR。

---

## 六、Phase 0.5 完成判定

### 6.1 自动判据

- [ ] 7 张 TESTFIX 卡全部 `✅ 已完成`
- [ ] `npm run test:guarded` 本地与 CI 均通过（隔离清单内失败不阻断，清单外 0 失败）
- [ ] `npm run verify:baseline -- --phase 0.5` 通过
- [ ] `npm run typecheck` + `npm run lint` 全绿
- [ ] `dev` 合并到 `main`，commit message：`feat: complete Phase 0.5 (M0.5) — test bed repair`

### 6.2 文档判据

- [ ] `docs/decisions.md` 包含 ADR-034
- [ ] `docs/test_triage_20260418.md` 全部失败已处置（无空白）
- [ ] `docs/baseline_20260418/failing_tests.json` 与 triage 文档条目数一致
- [ ] `docs/known_failing_tests_phase0.md` 已生成，含 `quarantine` + `defer` 两类条目
- [ ] `docs/rules/workflow-rules.md` 含「Phase 基线测试条款」章节
- [ ] `docs/task-queue.md` 末尾追加 PHASE COMPLETE — Phase 0.5 通知

### 6.3 PHASE COMPLETE 通知模板

```markdown
---
✅ PHASE COMPLETE — Phase 0.5（M0.5）已完成，等待确认开始 Phase 1（M1 收尾）
- **完成时间**：YYYY-MM-DD HH:MM
- **本 Phase 完成任务数**：7
- **已合并到 main**：是（commit <hash>）
- **基线状态**：
  - 单测：N 通过 / M 失败（M 条均在 known_failing_tests_phase0.md 内）
  - E2E：N 通过 / M 失败 / K flaky（M 条均在隔离清单内）
  - verify:baseline 通过 ✓
- **建议下一步**：
  - 若 TOKEN-01..06 已并行完成，启动 TOKEN-07
  - 若 TOKEN-01..06 未启动，按串行启动 TOKEN-01
- **需要你做的事**：
  - [ ] 抽查 test_triage 文档 5 条，核验类别判断合理性
  - [ ] 抽查 ADR-034 决策理由
  - [ ] 抽查 known_failing 清单，确认无应修而被隔离的测试
  - [ ] 确认开始 Phase 1 收尾（删除此块即可）
---
```

---

## 七、对未来重写项目的固化效果

本补丁通过 `TESTFIX-00` + `scripts/verify-baseline.ts` + `scripts/test-guarded.ts` 三件产物，把本次踩的「PHASE COMPLETE 通知与实跑数字不一致」教训固化为：

- **规则层**：workflow-rules 新增「Phase 基线测试条款」5 条
- **工具层**：`verify-baseline` 校验通知数字真伪、`test-guarded` 把隔离清单变成可执行门禁
- **文档层**：每次 Phase 0 启动均产出 `failing_tests.json` + `test_triage_<date>.md` + `known_failing_tests_phase<N>.md` 三件套

下一次启动 Resovo 任意大规模重写或新项目时，按此协议执行即可避免相同账目错配问题。本补丁的 §3 内容也将随 workflow-rules 进入新项目模板。
