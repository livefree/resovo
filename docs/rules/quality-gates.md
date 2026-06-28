# Resovo（流光） — 质量门禁规范

> status: active
> owner: @engineering
> scope: pre-dev output, post-dev self-check, deviation detection, AI-CHECK, pollution streak
> source_of_truth: yes
> supersedes: CLAUDE.md §"开发门禁与质量机制"（2026-04-12 拆出）
> superseded_by: none
> last_reviewed: 2026-06-27

---

## 1. 开发前五项输出（强制 — CHG-SN-5-CHECKLIST-AUDIT 修订）

在进行任何代码修改前，必须先输出：

1. 问题理解
2. 根因判断
3. 最小改动方案（在满足价值排序 1–4 的前提下）
4. 涉及文件
5. **若任务卡范围含 ADR 实施 / PATCH 修复 → ADR §验证段逐条勾对清单**（贴出 ADR §验证段原文，每条标 ✅/❌ 状态）

未完成上述五项，不允许进行任何代码修改。

> 第 5 项修复 CHG-SN-5-09 perf baseline 类"验证段判据被跳过"教训（R-CHECKLIST-2）。验证段语义自由度高难以自动化，依赖文档强制 + AI-CHECK 人工核验。

---

## 2. 开发后自审清单（合并版 — P1a-MERGE 收口；原 §2 七问 + §3 偏离 + §4 二元判定去重）

每次代码修改完成后，逐项判断（默认一行 是/否；标 ⟐ 的项**命中才需展开说明**），完成后输出 §4 [AI-CHECK] 块：

- **N1** 是否引入整页刷新或类似行为？〔源 §2-Q1〕
- **N2** 是否新增重复逻辑或重复状态？〔源 §2-Q2 ∪ §4-重复逻辑〕
- **N3** 是否有逻辑应下沉（共享层 / Service / Hook / util）但仍留在组件中？〔源 §2-Q3〕
- **N4** 是否破坏分层（Route→Service→DB queries 越层调用）/ 跨模块访问内部实现 / 破坏复用结构？〔源 §2-Q4 ∪ §4-分层 ∪ §4-跨模块〕
- **N5** 是否存在需拆分的函数或文件？（判定阈值见下方「函数与文件规模硬约束」段）〔源 §2-Q5 ∪ §4-规模×2 ∪ 规模硬约束段〕
- **N6** ⟐ 是否引入潜在技术债 / hack / 补丁式（if·分支·临时逻辑）解决结构问题？〔源 §2-Q6 ∪ §3-D1 ∪ §4-hack〕
- **N7** 是否为兼容旧逻辑引入额外复杂度？〔源 §3-D2〕
- **N8** 状态 / 数据流是否开始不清晰（多来源、重复、归属不明）？〔源 §3-D3〕
- **N9** 组件职责是否膨胀（展示 + 逻辑 + 请求混合）？〔源 §3-D4〕
- **N12** 是否存在隐式副作用或吞异常（空 catch / 静默 swallow）？〔源 §4-副作用；对齐 CLAUDE.md §绝对禁止"空的 catch 块"〕
- **N13** ⟐ 修改同一功能时是否持续触及无关代码（改动范围蔓延）？〔源 §3-D5〕

**专项条款（仅在任务命中前置条件时必检，否则在 [AI-CHECK] 标 NA）：**

- **N10** ⟐【任务含 audit 写入位点 `auditSvc.write(...)` 时必检】对应 service test 是否有 payload 内容显式断言 `expect(...write).toHaveBeenCalledWith(expect.objectContaining({ actionType, targetKind, targetId, beforeJsonb, afterJsonb }))`？（参 `tests/unit/api/sources-matrix-service.test.ts` 模板；R-MID-1 教训第 5 次系统化）〔源 §2-Q7〕
- **N11** ⟐【任务卡含 ADR 实施 / PATCH 时必检】
  - a. ADR §验证段是否仍有未勾项？——对账 §1 第 5 项开工前贴出的验证段清单（R-CHECKLIST-2 修订）〔源 §3-D6〕
  - b. ADR §决策要点 D-NNN-N 偏离编号是否在 changelog 显式闭环？（参 ADR-117 D-117-1..10 模式；`npm run verify:adr-d-numbers` 核验；遵守 §6 该脚本的「changelog D-N 字面=闭环」规约守卫）〔源 §3-D7〕

**结构劣化展开（原 §3"命中即追加"——命中 N6 / N7 / N8 / N9 / N13 任意一条必须追加）：** ① 此属"结构开始劣化"信号 ② 劣化点位置（文件 / 模块）③ 本次为何仍选最小修复 ④ 是否建议进入重构（是 / 否 + 理由）。并按 §5 判断连续污染 streak 是否 +1。

> **零信号丢失映射**（P1a-MERGE / arch-reviewer Opus `claude-opus-4-8` 审定 + Codex 对抗审收口）：原 §2(7)+§3(7)+§4(7)=21 项全部有落点——N1–N13 为独立判断点；§4 六条 YES/NO 行并入 N2/N4/N5/N6（语义保留，[AI-CHECK] 块仍逐项机器可读输出）；§3-D1 并入 N6、D5 独立为 N13、§4-副作用独立为 N12。结构劣化项 N6/N7/N8/N9/N13 的"命中即追加说明"由上方「结构劣化展开」块统一承接。无任何检查点在去重名义下删除。

---

## 3. 偏离检测（已并入 §2 合并清单 — P1a-MERGE）

原偏离检测 7 项已去重并入 §2：D1→N6、D2→N7、D3→N8、D4→N9、D5→N13（独立"范围蔓延"项）、D6→N11.a、D7→N11.b。「命中即追加劣化说明」（劣化信号 / 位置 / 为何最小修复 / 是否进重构）由 §2「结构劣化展开」块统一承接（覆盖 N6/N7/N8/N9/N13）。本节编号保留以维持 §4–§7 引用稳定。

---

## 4. [AI-CHECK] 综合结论（机器可读，下游审计 / 脚本消费）

每次任务结束、完成 §2 合并清单后，必须输出以下机器可读结论块（键名稳定，值 YES/NO/NA；括号内为对应 §2 清单项）：

```
[AI-CHECK]
layering:      YES/NO    (N4)   # 违反分层 Route→Service→DB
cross_module:  YES/NO    (N4)   # 跨模块访问内部实现
dup_logic:     YES/NO    (N2)   # 新增重复逻辑 / 状态
hack_patch:    YES/NO    (N6)   # hack / 补丁式解决结构问题
fn_split:      YES/NO    (N5)   # 需拆分的函数
file_split:    YES/NO    (N5)   # 需拆分的文件
side_effect:   YES/NO    (N12)  # 隐式副作用 / 吞异常
audit_payload: YES/NO/NA (N10)  # audit 写入 payload 显式断言（无写入位点=NA）
adr_closure:   YES/NO/NA (N11)  # ADR 验证段勾对 + D-N changelog 闭环（无 ADR 实施=NA）
结论: SAFE / NEED FIX
```

- 前 7 键（layering..side_effect）= 原 §4 七行 YES/NO 信号，语义与顺序保留、仅键名英文化以稳定下游解析。
- 后 2 键（audit_payload / adr_closure）= P1a-MERGE 新增，把原本只能自报的 N10/N11 专项接入机器对账（净增能力）。
- 结论为 **NEED FIX** 时，必须在下一任务开始前修复，或写入 BLOCKER 等待人工判断。

> **简化规则**：以下**全部满足**时，§2 合并清单可压成一句结论，但 [AI-CHECK] 块必须完整输出：
> 1. 改动文件 ≤ 3 个
> 2. 无新增函数 / 组件 / Hook
> 3. 不涉及 Service / DB query / Zustand store
> 4. 改动行数 ≤ 30 行（不含空行和注释）
>
> 不满足上述任意一条 → 必须走完整 §2 合并清单 + [AI-CHECK]。

---

## 5. 连续污染检测

针对同一模块连续任务，维护污染连续计数（streak）：
- 以下任一情况出现，streak +1：重复逻辑增加、状态复杂度上升、需要额外补丁维持功能（与 §2 联动：结构劣化项 N6/N7/N8/N9/N13 + 重复逻辑 N2 命中即为本计数 +1 的输入信号）
- 未出现则 streak 归零

**streak 连续达到 3 时（硬规则）**：
- 停止继续补丁式开发
- 输出："当前模块已进入高风险状态，建议暂停功能开发，进行一次小规模重构。"
- 给出最小重构范围和拆分方案（页面 / hooks / services / utils 的拆分边界）

---

## 函数与文件规模硬约束

### 函数必须先拆分再继续（以下任一条件触发）

1. 包含 2 个以上独立逻辑阶段（校验→变换→写库，各阶段可独立命名即算独立）
2. 条件 / 循环 / try 嵌套层数达到 3 层
3. 超过 80 行，且不属于**纯声明性结构**（函数体仅为 JSX return 块或静态数组/对象字面量，不含 Service 调用、store 写入、async 操作或副作用）

### 文件必须先拆分再继续（以下任一条件触发）

1. 导出 2 个以上主要概念（组件 / Service / Hook / Store / 独立功能函数集合，每种各算一个）
2. 超过 500 行，且不属于**纯声明性文件**（类型定义文件、静态映射数据文件）

**400 行触发门禁**：向已超过 400 行的文件继续写入前，必须先声明：「本文件的唯一职责是 ___」。能完成且职责单一 → 可继续；无法用一句话表达 → 必须立即拆分。

---

## 6. 协议合规自动核验（CHG-SN-5-CHECKLIST-AUDIT 新增）

针对 M-SN-5 累计 5 次同型号"ADR 明示但 commit 静默跳过"偏离（06-PATCH R-MID-1 / 09-PATCH perf baseline / 10-PATCH response 字段 / 11 整卡 ADR 缺失 / 11-PATCH NEW-P0），引入多类自动化核验脚本（详见下方编号 1–10）+ 4 类文档强制规则。

### 核心脚本（preflight 集成，npm run verify:adr-contracts 聚合 + 审查 trailer / 文档同步守卫）

> **本节登记范围**：协议合规核验（`verify:adr-contracts` 聚合的 7 成员）+ 审查 trailer（`verify:review-trailer`）+ 脚本-文档同步（`verify:script-doc-sync`）这三组**治理门禁**。其余 `verify:*` 各有归属、不在本节也不在 `verify:script-doc-sync` 的 §6 漂移核验内：① preflight / 专属规范 独立守卫（`verify:docs-format` / `verify:token-isolation` / `verify:token-references` / `verify:server-next-isolation` / `verify:admin-guardrails`（含 `:all` 变体）/ `verify:no-bare-backdrop` / `verify:file-size-budget` / `verify:manual-coverage`，各由其专属规范或 doc-governance 登记，见 `preflight.sh` `[5x/6]`）；② 领域 / 基础设施工具（npm 脚本 `verify:crawler` / `verify:baseline`，及直跑脚本 `scripts/verify-bangumi-token.ts` / `verify-douban-adapter.ts` / `verify-imgh-121.ts` / `verify-env.sh` 等，非协议门禁）。

1. **`npm run verify:endpoint-adr`**（FAIL fast 阻塞 CI）：扫 `apps/api/src/routes/admin/*.ts` 内 `fastify.{get,post,put,patch,delete}` 调用，提取 (method, path)，比对 `docs/decisions.md` 各 ADR §端点契约 markdown table；不在 ADR 表中的 admin 路由 → 失败 + 提示起 ADR 卡（参 ADR-104/-105/-117 模式）；legacy 路由通过 `scripts/lib/admin-routes-allowlist.json` 显式豁免

2. **`npm run verify:error-message`**（advisory，不阻塞）：扫 `apps/api/src/services + routes/admin` 内 `new AppError(...)` + `reply.code().send({error:{...message:...}})` 抛出 message 字面量；比对 ADR §错误码 message 模板表；不在模板中 → 警告（milestone 审计前应清零）

3. **`npm run verify:adr-d-numbers`**（advisory）：解析 ADR §决策要点 D-NNN-N 编号，**权威源 changelog.md 显式 D-N 闭环**；ADR 列出但 changelog 未闭环的 D 编号 → 警告 + 产物 `docs/audit/adr-d-status.json` 给 milestone 审计消费
   - **⚠️ changelog D-N 字面 = 闭环（Y-CHECKLIST-1 契约 / SEQ-20260531-01 加固）**：脚本以「changelog 出现 `D-NNN-N` 字面」为唯一闭环标识（裸正则 `/D-\d+-\d+/`，**无法区分"描述"与"闭环"**）。其隐含前提是「changelog 只记已完成工作」。**规约守卫（落档卡禁写未实施 D-N 字面）**：
     - **ADR 落档卡 / 仅设计卡（零实施）**：正文**禁止**出现尚未实施的 `D-NNN-N` 字面编号——否则被误抓为已闭环（adr-d-status.json 虚标未完成工作为 complete）。未实施的裁定**改用叙述式编号「裁定①②③…」**，编号对照见 decisions.md ADR 正文。
     - **`D-NNN-N` 闭环字面只允许出现在「真正实施该 D-N 的那张卡」的 changelog 条目**——使「提及=闭环」与事实一致。
     - 根因案例：META-23-A（纯落档）原逐条罗列 `D-174-1..5` → 5 条全被误标 closed；修正后落档卡用「裁定①..⑤」、`D-174-1` 闭环字面仅在 META-23-B（实施卡）。脚本契约不动（避免误伤历史 285 条自由叙述式闭环）。

4. **`npm run verify:sql-schema-alignment`**（advisory，CHG-SN-6-CHECKLIST-AUDIT-3 新增）：解析 `apps/api/src/db/migrations/*.sql` 全集（CREATE TABLE / ADD COLUMN / DROP COLUMN / RENAME COLUMN）算出每表当前 schema → 扫 `apps/api/src/db/queries/**/*.ts` + `apps/api/src/services/**/*.ts` 内 SQL template literal `<alias>.<column>` 字面量 → 比对 5 核心表（videos / video_sources / users / media_catalog / watch_history）schema → 不在列表的报警；防 CHG-SN-5-13-PATCH-2 类 migration 029 后未迁移 mc JOIN 偏离。M-SN-6 完善后扩 alias 上下文推断 + 升 FAIL fast

5. **`npm run migrate:check`**（CHG-SN-6-CI-MIGRATE-DRY-RUN / RETRO 3/7）：迁移干跑核验，不执行只报告 pending 数量 + 文件列表；退出码 1 = 有 pending（CI 部署前必须 migration 已应用）/ 0 = 全 applied；preflight `[3/6]` 头部前置（参 CHG-SN-5-13-PATCH-2 dev DB 滞后 migration 061/062/063 教训）

6. **`npm run test:integration`**（CHG-SN-6-INTEGRATION-TEST / RETRO 2/7）：跑真实 PG 子集集成测试（vitest.integration.config.ts），验证 admin route SQL 执行不抛 DatabaseError；与 unit mock 互补；与 verify:sql-schema-alignment 互补（静态扫描 + 真实执行双层）；CI 可独立调度（preflight 不集成；本地按需运行）

7. **`npm run verify:style-shorthand-conflict`**（CHG-SN-6-RETRO-3-B 落地 advisory / CHG-SN-6-RETRO-4 清零 17 处 / **CHG-SN-6-06 升级 FAIL fast**）：静态扫描 `apps/server-next/src` + `apps/web-next/src` + `packages/admin-ui/src` 的 `.tsx` 文件内 `: React.CSSProperties = {...}` / `style={{...}}` 块，检测 9 类 shorthand（`font` / `border` / `background` / `margin` / `padding` / `overflow` / `borderRadius` / `inset` / `flex`）与对应 longhand 同存 → React rerender 警告 "Updating a style property during rerender ... when a conflicting property is set ..."；db3b7a48 + 9e592df3 + 32392a80 + e4417fe5 累计 31 处清零后落地 FAIL fast 防回归；命中即 CI 阻塞，按提示拆 longhand 或改 fontFamily 范式修复

8. **`npm run verify:admin-shell-types-mirror`** + **`npm run verify:enum-ssot`**（均 verify:adr-contracts 成员）：前者核验 `packages/admin-ui` shell types ↔ server-next 双源镜像一致；后者 ADR-157 D-157-4 视频枚举字面量守卫（advisory / baseline 截止 2026-07-26）。

9. **`npm run verify:review-trailer`**（advisory 观察期，`--strict` 升 FAIL fast；CI / pre-push 调用、**非 preflight**——依赖 commit 历史）：commit diff 触及 `docs/decisions.md` 或 `packages/admin-ui/src/**` 公开 Props（types.ts / .tsx `*Props` 块字段，双镜像区间相交、容忍多行声明）却缺 `Subagents: arch-reviewer (claude-opus-...)` 或 `Review: <hash> PASS` trailer → 报违规。为下方「4 类文档强制规则」第 7 项「共享组件 API 改动 Opus trailer」+ CLAUDE.md §绝对禁止补脚本 enforcement（审查规范评估 P0 / 2026-06-27）。**已知限制**：trailer 门禁仅校验「trailer 存在 + well-formed + 无显式失败 verdict」，无法验证评审结论真伪（`Subagents: arch-reviewer (opus)` 是 CLAUDE.md 审计记录语义、非 verdict 编码，可被沉默失败 / 伪造 `Review: PASS` 规避）；根除须核验评审产物本身（独立卡，超 advisory 守卫范畴）。

10. **`npm run verify:script-doc-sync`**（advisory，preflight `[5e3/6]`）：以 package.json 为权威，核验 verify:adr-contracts 成员 ↔ 本节枚举 / preflight 枚举漂移 + 文档 stale 引用（审查规范评估 P1b / 2026-06-27）。

**测试分层执行边界（ADR-180 / SEQ-20260604-02）**：日常 commit 前单测门禁为增量 `npm run test:changed`（见 `docs/rules/test-rules.md` §分层执行策略）；`npm run test:guarded`（Phase 隔离清单门禁）与 `npm run preflight` **保持全量语义不变、不接入增量**——guarded 是基线对比，增量漏选会使隔离清单 diff 失真（D-180-6）。全量兜底三节点见 `docs/rules/workflow-rules.md`。

### 4 类文档强制规则（修订 §1/§2/§3 已落地）

4. **§1 第 5 项** "ADR §验证段逐条勾对清单"（R-CHECKLIST-2 修复 09-PATCH 类教训）
5. **§2 第 7 问** "audit 写入位点对应 service test payload 内容显式断言"（修复 R-MID-1 教训第 5 次失守）
6. **§3 第 6 项** "ADR §验证段未勾项"+ **第 7 项** "D-N 编号 changelog 闭环"
7. **共享组件 API 改动 Opus trailer**（详见 `docs/rules/workflow-rules.md`）+ **任务卡原子化判据（全卡型 ≤ 5 项 + 四问）**（详见 `docs/rules/workflow-rules.md` §任务卡原子化判据）

### 不在范围（独立卡）

- 跨应用层同值 type alias 重复检测（CHG-SN-5-VIDEOTYPE-DRY-CLEANUP）
- ESLint plugin 落地（与 no-hardcoded-color 同类，独立 R&D）
- ADR message 模板长期迁移结构化 YAML/JSON（A-CHECKLIST-1，当前 markdown 容忍）

---

## 7. 阶段审计硬清单（CHG-SN-6-RETRO-2 沉淀 / 2026-05-14）

> **权威源**：`docs/server_next_plan_20260427.md` §5.3 "阶段审计硬清单"
> 本节为 plan §5.3 在 quality-gates 内的镜像，主循环 + arch-reviewer 在 milestone 审计时逐项核验。

每个 milestone 阶段审计时主循环 spawn arch-reviewer (Opus) 必须输出 **5 项硬清单核验表**：

| # | 硬指标 | 判据 | 自动化脚本（CI 强制 / advisory） | 触发卡 |
|---|---|---|---|---|
| 1 | 视图测试 ≥ 9 用例 / 视图卡 | `apps/server-next/src/app/admin/<view>/_client/*Client.tsx` + `apps/web-next/src/**/*Client.tsx` 对应 `tests/unit/components/<area>/<view>.test.tsx` `it()` 数 ≥ 9 | `verify:view-test-coverage`（M-SN-6 完善后落地，当前手工 grep） | CHG-SN-5-13-PATCH P2-2（沉淀指标）+ CHG-SN-6-RETRO-1（RETROACTIVE 补齐） |
| 2 | 共享原语占比 ≥ 80% | 新增视图 JSX 节点中 `import from '@resovo/admin-ui'` / 共享 primitives 与 inline `<div>` 比例 ≥ 80% | `verify:primitive-usage-ratio`（M-SN-6 完善后落地，当前手工 review） | CHG-SN-5-12 DataTable 一体化（共享原语试点）|
| 3 | R-MID-1 audit payload 内容断言 | 所有写操作测试断言 `audit_logs` 行数 + payload 关键字段非空（`expect.objectContaining({actionType, targetKind, targetId, beforeJsonb, afterJsonb})`）；新增写端点自动加入 `tests/unit/api/audit-log-coverage.test.ts` 白名单 | `tests/unit/api/audit-log-coverage.test.ts` PAYLOAD_REQUIRED + EXEMPT（已强制 9+11） | CHG-SN-5-CHECKLIST-AUDIT-2 R-MID-1 5 次系统化 |
| 4 | schema 三层防护 | `npm run verify:adr-contracts` 7 类核验全绿（端点 / 错误码 / D-N / sql-schema / style-shorthand / shell-types-mirror / enum-ssot）+ `tests/integration/api/**` 真实 PG 覆盖核心查询 + `npm run migrate:check` preflight 头部前置 | `verify:adr-contracts` + `test:integration` + `migrate:check` | CHG-SN-5-CHECKLIST-AUDIT + AUDIT-3 + CHG-SN-6-INTEGRATION-TEST + CI-MIGRATE-DRY-RUN |
| 5 | 任务卡范围 ≤ 5 项（**全卡型**，CHG-CARD-ATOM 扩展） | 单张卡改动项 > 5 → 强制拆 `-A/-B`（任意卡型；原子化四问见 workflow-rules §任务卡原子化判据：改动项 / 跨层混合 / 验收口径唯一 / 依赖链深度）；milestone 内范围 > 5 项卡数 / 总卡数 ≥ 20% → 阶段评级降一档 | 手工统计（commit message 关键词 grep；CHG-CARD-ATOM-VERIFY 待立案自动化）| M-SN-5 数据观察 "PATCH 范围 ≥ 5 项 → 完成度反比" + CHG-VIR-9/11/12 拆卡 100% 完成度佐证（workflow-rules 已沉淀）|

**评级联动**（plan §5.3 A / B / C 修订）：
- **A 级**：5 项硬清单 100% 命中
- **B 级**：5 项硬清单 ≥ 80%（4/5 命中 + 1 项 advisory 警告，补齐计划写入 milestone 后续卡）
- **C 级**：< 80% 命中（≤ 3/5） → 整 milestone 返工（BLOCKER §5.2 第 11 条）

**自动化 vs 手工**：
- 第 3 项 / 第 4 项已自动化（CI / preflight 强制）
- 第 1 项 / 第 2 项当前 advisory + 手工 grep；CHG-SN-6-CHECKLIST-AUDIT-3 advisory 模式
- 第 5 项当前手工统计，无自动化（PATCH 卡 commit message 已含范围数）

**沉淀来源**：CHG-SN-5-13 milestone 阶段审计 arch-reviewer B+ → CHG-SN-5-13-PATCH 自动化循环修后 A−（首批硬指标试点）；M-SN-6 起作为正式协议规约。
