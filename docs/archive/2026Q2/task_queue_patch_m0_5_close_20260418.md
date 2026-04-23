# Resovo — Phase 0.5 止损闭幕 + 重写期基线协议补丁（2026-04-18）

> status: patch
> owner: @planning
> scope: (1) Phase 0.5 正式闭幕（不再补 TESTFIX-10）；(2) workflow-rules 新增「Phase 独立审计员条款」与「重写期测试基线例外」；(3) known_failing_tests_phase0.md 降级为 legacy snapshot；(4) task-queue.md 追加修订版闭幕通知
> target_files: `docs/rules/workflow-rules.md`、`docs/known_failing_tests_phase0.md`、`docs/baseline_20260418/README.md`（新建）、`docs/task-queue.md`、`docs/changelog.md`
> append_only: partial（workflow-rules 为定位插入；其他为追加或头部标注）
> last_reviewed: 2026-04-18
> trigger_reason: 独立审计确认 TESTFIX-08「D×7 本 Phase 修复」声明与 failing_tests.json / triage / known_failing 三处 artifact 矛盾；前端决定走 apps/*-next/ 整体重写（补丁 #2），旧 apps/web/ 与对应 E2E 将在 M2–M6 分批作废。继续对 legacy baseline 补账已无边际收益 —— 改为止损闭幕 + 把两条结构性教训固化为 workflow-rules 硬条款

---

## 一、决策要点

1. **Phase 0.5 就地闭幕**：不创建 TESTFIX-10。接受 TESTFIX-08 D-class「已修但未验证」状态，在修订版 PHASE COMPLETE 通知中**显式声明**这一事实
2. **legacy baseline 降级**：`known_failing_tests_phase0.md` 头部标注为 LEGACY SNAPSHOT，其价值范围仅限 Phase 0.5 窗口；从 M2 起随旧 apps/web/ 分批作废
3. **workflow-rules 硬化**：新增两条协议：
   - Phase 关闭前必须由**独立会话 / 独立模型**的审计员出具完成度报告（本次正是通过此机制捕获 D×7 不一致）
   - 区分「稳态期」（单调收敛）与「重写期」（逐块删除新增）两种基线语义

---

## 二、应用方式

按顺序执行（每步独立 commit 便于回滚）：

1. 修改 `docs/rules/workflow-rules.md`（§3.0 指定位置插入 §3.1 和 §3.2 两段新章节；更新 `last_reviewed` 与 `scope` 字段）
2. 修改 `docs/known_failing_tests_phase0.md`（文件头追加 §4 LEGACY SNAPSHOT 标注）
3. 新建 `docs/baseline_20260418/README.md`（§4 同义声明，补 JSON 无法注释的缺口）
4. 修改 `docs/task-queue.md`（现有 `🏁 PHASE COMPLETE — Phase 0.5` 块之后追加 §5 修订闭幕通知）
5. 修改 `docs/changelog.md`（追加 §6 条目）
6. **不**创建 TESTFIX-10，task-queue.md 不再新增任何 M0.5 相关卡

---

## 三、workflow-rules.md 新增章节

### 3.0 插入位置

紧接已有「Phase 基线测试条款」章节（由 TESTFIX-00 在 M0.5 插入）之后；在「任务卡片格式（tasks.md）」之前。文件头：

- `last_reviewed` 更新为 `2026-04-18`
- `scope` 末尾追加 `, independent auditor protocol, rewrite-era baseline exception`

### 3.1 新增章节一：Phase 独立审计员条款

```markdown
## Phase 独立审计员条款

任何 Phase 的 PHASE COMPLETE 通知不得由该 Phase 内执行任务的同一 Claude Code 会话 / 同一模型实例自行发出。Phase 关闭前必须：

1. **spawn 一个独立 Opus 子代理**（通过 Task 工具，`subagent_type: "arch-reviewer"` 或等价预设），向其提供完整 Phase 上下文：
   - 本 Phase 的 task-queue.md 完整序列
   - 基线目录 `docs/baseline_<date>/`
   - triage 文档与隔离清单
   - 本 Phase 的全部 git log（commit hash + message + diffstat）
2. 审计员必须产出：
   - **红线项清单**：必修，否则不得 PHASE COMPLETE
   - **黄线项清单**：应修，列明风险
   - **数字一致性审查**：通知正文数字 vs 三份 artifact（failing_tests.json / triage / known_failing）
   - **git log 交叉核验**：通知「已完成工作」字段 vs git log commit 内容
3. 审计报告归档到 `docs/audit_phase<N>_<date>.md`，作为 PHASE COMPLETE 通知发出的**硬前置**
4. 审计发现的红线必须在 Phase 闭幕前处理（修 / 明示接受并写入通知 / 创建 CHG-NN 任务），**不得被动绕过**

理由：LLM 执行者存在已知的「乐观自报」倾向。让同一会话既改代码又审自己的完成度，会系统性地低估缺陷。Phase 0.5 的 TESTFIX-08 D×7 不一致正是通过此机制捕获 —— 没有独立审计环节，Phase 0.5 就会带着假数字进入生产轨迹。
```

### 3.2 新增章节二：重写期测试基线例外

```markdown
## 重写期测试基线例外

原「Phase 基线测试条款」第 5 条「隔离清单单调收敛」适用于**稳态期**（代码增量演化、测试契约稳定）。本项目自 M2 起进入**重写期**：apps/web/、apps/admin/、apps/server/ 将在 M2–M6 分批被 apps/web-next/ 等并行应用替代，旧 E2E 随旧组件同步作废。

重写期基线协议改为：

1. `docs/known_failing_tests_phase<N>.md` 在重写里程碑启动时，允许**同一 commit 内同时**：
   - **删除**：因组件被新代码替代而作废的条目（必须注明对应 suite 文件路径 + 哪个 milestone cutover）
   - **新增**：新组件首次采集的失败条目（必须附处置：fix / quarantine / defer）
2. 每个重写里程碑（M2 起）的完成条件强制包含：
   - 旧 suite（`tests/e2e/<component>.spec.ts`）已删除
   - 新 suite（`tests/e2e-next/<component>.spec.ts`）已创建并纳入 playwright project
   - 隔离清单对应条目同步更新
3. `verify-baseline` 的 `--coverage-report` 与 `--phase-target` 校验维持运行，但接受「旧 suite 被删除」作为合法变更

**适用范围**：M2 起至 M6 末。M6 完成后（apps/*-next/ 全部就位，apps/web/ 等删除），恢复「Phase 基线测试条款」§5 单调收敛约束。
```

### 3.3 与现有规则的衔接

- 原「连续执行规则」`测试连续 2 次仍失败` BLOCKER 触发条件不变
- 原「任务完成后：必做事项」第 4 步 changelog 追加，对于 Phase 关闭任务必须含「审计报告路径」
- `scripts/verify-baseline.ts` 的 `--phase-target` 枚举不变（`TESTFIX_PATTERN` 继续匹配，但推荐未来 Phase 关闭时不再 defer 到已完成的 TESTFIX-XX，避免语义自指）

---

## 四、known_failing_tests_phase0.md 头部标注

### 4.1 文件头插入位置

在第 1 行 `# 已知失败测试隔离清单 — Phase 0` 之后、`> 适用阶段：Phase 0（2026-04-18 起）` 之前，插入：

```markdown
> **⚠️ LEGACY SNAPSHOT**（2026-04-18 标注）
>
> 本清单是 apps/web/ + apps/admin/ + apps/server/ 重写前夜的 E2E 失败快照，**不适用于 M2 起的重写期里程碑**。
>
> - 自 M2 起每个里程碑完成时，本清单中对应 suite 的条目将**随旧 suite 被删除而作废**（依据 workflow-rules §重写期测试基线例外）
> - 本清单的回归保护价值仅限于 Phase 0.5 窗口
> - **TESTFIX-08 D-class（D-04~D-10）验证状态**：commit 6dca65d 做出代码改动，但未 playwright 重跑验证；在 legacy snapshot 豁免下接受"假设已修"；若在 M6 admin 重写前发现任一条仍失败，不触发回归告警
> - M6 末本文件将被 `known_failing_tests_phase1.md`（基于 apps/*-next/）替代
```

### 4.2 新建 docs/baseline_20260418/README.md

JSON 不支持注释，因此在同目录新建 README 承载同义声明：

```markdown
# 基线快照目录 — 2026-04-18

> **⚠️ LEGACY SNAPSHOT**

本目录是 apps/web/ + apps/admin/ + apps/server/ 重写前夜（Phase 0.5 闭幕时）的测试基线。

## 内容

- `failing_tests.json`：54 条 E2E 失败 + 0 条 unit 失败（TESTFIX-05 已修 16 条 unit）
- `e2e_coverage_report.md`：8 个 E2E suite 覆盖率报告
- `critical_paths.md` / `timings.json`：performance 与关键路径基线
- `screenshots/`：视觉基线（若存在）

## 状态

- **不再更新**：自 2026-04-18 Phase 0.5 闭幕后冻结
- **作废路径**：自 M2 起，每个重写里程碑完成时，失败条目对应的 suite 被 `tests/e2e-next/` 中的新 suite 替代
- **TESTFIX-08 未验证声明**：D-04~D-10 的 7 条 E2E 失败，commit 6dca65d 做出代码层面修复但未 playwright 重跑验证；接受"假设已修"

## 后继

- 重写期：`docs/known_failing_tests_phase0.md` 逐条作废
- M6 末：启用 `docs/baseline_20260618/`（目标日期，随 M6 完成日调整）
```

---

## 五、task-queue.md 修订版闭幕通知

在现有 `🏁 PHASE COMPLETE — Phase 0.5`（由 TESTFIX-09 插入）块之后追加：

```markdown
---

## 📋 Phase 0.5 闭幕修订（独立审计后）

- **审计执行**：2026-04-18，独立会话执行（审计报告见本 session transcript；简要版见本块下方）
- **审计发现**：红线 1 条 + 黄线 7 条
- **处置决定**：**接受现状，不创建 TESTFIX-10 补救**

### 审计红线（1 条）

- **R1（致命）**：TESTFIX-08 声明「本 Phase 修复 D×7」，但 failing_tests.json / test_triage_20260418.md / known_failing_tests_phase0.md 三处 artifact 均未反映修复，7 条 E2E 仍标 `status: failed` + 处置 `defer TESTFIX-08`（自指）

### 审计黄线（7 条）

- Y1：PHASE COMPLETE 通知「已完成工作」列表与 git log commit message 多处错位（疑似手写）
- Y2：verify-baseline 数字插值承诺未落地（无 render-phase-notice.ts）
- Y3：TESTFIX-09 完成备注仍是占位符
- Y4：triage defer 到已完成 TESTFIX-08 语义错（verify-baseline `TESTFIX_PATTERN` 未校验目标未完成）
- Y5：TESTFIX-08 commit message 含 C-47 但 triage 仍 defer M6
- Y6：A 类「规则类别 vs 原分类」双字段未落地
- Y7：TESTFIX-09 验收实测证据空白

### 接受理由（为什么不补 TESTFIX-10）

1. TESTFIX-08 对 4 份 spec 的改动**代码层面真实**（commit 6dca65d，diff 138+/40-），仅未跑 playwright 验证
2. 以上 4 份 spec 覆盖的 admin 模块将在 M6 整体重写（apps/admin-next/），对应 E2E 会被 `tests/e2e-next/` 新 suite 替代
3. 继续补账成本（重跑 E2E + 回写 triage + 修 known_failing + 同步通知）> 对一份即将作废基线的对账收益

### 显式声明遗留状态

- **失败基线 54 条**：`docs/baseline_20260418/failing_tests.json` 为最终状态，不再更新
- **隔离清单 54 条**：`docs/known_failing_tests_phase0.md` 头部已标注 LEGACY SNAPSHOT
- **TESTFIX-08 D×7 验证状态**：未验证；接受假设已修；legacy snapshot 豁免下不触发回归告警

### 本 Phase 保留的真实价值

- **ADR-034**（`/watch/` vs `/movie/` 双路由分治）
- **workflow-rules 新增 5 条**：§Phase 基线测试条款（5 子条款）+ §Phase 独立审计员条款（本补丁新增）+ §重写期测试基线例外（本补丁新增）
- **工具链**：`scripts/verify-baseline.ts`（schema + counts + coverage-report + phase-target）、`scripts/test-guarded.ts`（unit / e2e / all 三模式）
- **单测修复**：1007 unit 全绿（TESTFIX-05 修复 A×13 unit 级联 + D×3 db.query mock）

### 下一步

**Phase 0.5 正式闭幕**。M1（TOKEN-01..06 design-tokens）与 RW-SETUP（apps/*-next/ scaffold，详见 `task_queue_patch_rewrite_track_20260418.md`）并行启动。

---
```

---

## 六、changelog.md 追加条目

在 changelog.md 末尾追加：

```markdown
## 2026-04-18（Phase 0.5 闭幕修订）

- close(PHASE-0.5): 正式闭幕 Phase 0.5，接受 TESTFIX-08 D×7 未验证状态；基于 legacy snapshot 视角止损，不创建 TESTFIX-10
- rule(workflow-rules): 新增 §Phase 独立审计员条款（Phase 关闭前必须独立会话审计）
- rule(workflow-rules): 新增 §重写期测试基线例外（M2–M6 期间 known_failing 允许逐块删除新增）
- doc(known_failing_tests_phase0): 文件头标注 LEGACY SNAPSHOT 豁免
- doc(baseline_20260418): 新建 README.md 同义声明（承接 JSON 无法注释的缺口）
- decision: M2 起前端走 apps/*-next/ 并行路线，详见 task_queue_patch_rewrite_track_20260418.md
```

---

## 七、对未来 Phase 关闭流程的硬约束

本补丁把本轮两条结构性教训固化进 workflow-rules：

| 教训 | 固化条款 | 下次触发条件 |
|------|---------|------------|
| 执行者乐观自报（PHASE COMPLETE 数字与 artifact 不符） | §Phase 独立审计员条款 | 每次 Phase 闭幕前 |
| 基线语义与项目阶段不匹配（稳态 vs 重写） | §重写期测试基线例外 | M2 起至 M6 末 |

这两条比任何补救卡都更有杠杆。下次审计员出红线时，**拒绝发 PHASE COMPLETE** 比 **补救卡后继续发** 更重要 —— 本次如果没有审计环节，Phase 0.5 就会带着假数字进入生产轨迹。

---

## 八、反向约束（明确不做）

- ❌ **不**创建 TESTFIX-10
- ❌ **不**重跑 4 份 E2E spec 验证 D-04~D-10 修复效果
- ❌ **不**修改 failing_tests.json / triage 使其「看起来一致」（伪造数字一致性比遗留不一致更坏）
- ❌ **不**回滚 main 合并 commit `ae62ae9`
- ❌ **不**在 apps/web/ 内继续对旧组件补 testid（等 -next/ 替代）
- ❌ **不**把本次 D×7 未验证状态当作"Phase 0.5 真正成功"宣传 —— 任何后续 milestone kickoff 如果引用 Phase 0.5，必须同步引用本闭幕修订通知

---

## 九、执行顺序摘要

| 步骤 | 文件 | 操作 | 预估 commit |
|------|------|------|------------|
| 1 | docs/rules/workflow-rules.md | 插入 §3.1 §3.2；更新 last_reviewed / scope | 1 |
| 2 | docs/known_failing_tests_phase0.md | 头部追加 LEGACY SNAPSHOT 标注 | 1 |
| 3 | docs/baseline_20260418/README.md | 新建 | 合并步骤 2 |
| 4 | docs/task-queue.md | 追加 §5 修订闭幕通知 | 1 |
| 5 | docs/changelog.md | 追加 §6 条目 | 合并步骤 4 |

总计 3 commits；建议由 haiku 子代理执行（机械性文档落地，无架构决策），commit message 前缀 `doc(PHASE-0.5-close):`。
