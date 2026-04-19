# Resovo — M0.5 完成度审计补救补丁（2026-04-18）

> status: patch
> owner: @planning
> scope: 追加 3 张 TESTFIX 卡（TESTFIX-07/08/09）补齐 M0.5 审计发现的红黄项；M0.5 需全部 10 张卡完成才能合并 main 并发出 PHASE COMPLETE
> target_files: `docs/task-queue.md`
> append_only: yes（追加到 `task_queue_patch_m0_5_20260418.md` §4 序列尾部）
> last_reviewed: 2026-04-18
> trigger_reason: SEQ-20260418-M0.5（TESTFIX-00..06）完成度审计发现 4 条红线 + 4 条黄线；E2E 基线覆盖仅 2/8 suite（9 条失败 vs 原 97 条报告）；dev 未合并 main；PHASE COMPLETE 通知缺失；homepage.spec.ts 存在与 TESTFIX-02 同源的 MOCK 契约缺陷；test-guarded 仅跑 unit 未跑 E2E。不补齐则 Phase 0.5 合并判据不成立

---

## 一、审计发现与补救映射

### 1.1 红线项（必修，否则 Phase 0.5 不得关闭）

| 编号 | 问题 | 证据 | 承接卡 |
|------|------|------|--------|
| R1 | `dev` 未合并 `main` | `main` 停在 `2e5cfdf`（Phase 0 合并点），`dev` 领先 152 commits | TESTFIX-09 |
| R2 | PHASE COMPLETE — Phase 0.5 通知缺失 | `docs/task-queue.md` 末行停在 TESTFIX-06 完成备注，未追加通知块 | TESTFIX-09 |
| R3 | E2E 失败归档严重不完整 | `failing_tests.json` 仅含 9 条 E2E（player×7 + search×2）；原始 PHASE COMPLETE 报告 97 条；homepage/admin/auth/publish-flow/video-governance/admin-source-and-video-flows 6 个 suite（共 64 个测试）在 triage 文档与 baseline 中均为 0 条 | TESTFIX-07 |
| R4 | `homepage.spec.ts` MOCK_MOVIE 与 TESTFIX-02 修复的 player.spec.ts 同类缺陷未同步修复 | `tests/e2e/homepage.spec.ts:13-26` MOCK_MOVIE 仅 12 字段，缺 `genres`/`aliases`/`languages`/`tags`/`subtitleLangs`（Video contract 必填）；此外 `nav-cat-all` testid 在 `apps/` 下 0 渲染点 | TESTFIX-08 |

### 1.2 黄线项（应修，否则长期隐患）

| 编号 | 问题 | 证据 | 承接卡 |
|------|------|------|--------|
| Y1 | `test-guarded.ts` 仅跑 unit，未跑 E2E | `scripts/test-guarded.ts:84-100` `runUnitTests()`，E2E 仅在 `--e2e-info` 模式打印清单，不执行 | TESTFIX-09 |
| Y2 | A 类定义在规则与 triage 文档间不一致 | workflow-rules §Phase 基线条款 A = "测试 suite 自身加载失败"；`test_triage_20260418.md` A × 13 实际均为运行期 `process.exit` 级联 | TESTFIX-07（重跑后按规则正确归类） |
| Y3 | TESTFIX-04 "no-op" 判定依赖未来里程碑假设 | TESTFIX-04 全部 C 类 `defer M2/M3/M5`，无一条进入本 Phase 修复；若 TESTFIX-07 重跑发现 C 类真存在可独立修复的条目，需回填本卡 | TESTFIX-07（若发现）+ TESTFIX-08（修复）|
| Y4 | 部分 triage 条目处置里程碑推断未核对 M2/M3/M5 范围 | triage 标注 M2 为"搜索/筛选页重写"，M3 为"播放器重构"，M5 为"弹幕"，但这些里程碑的具体 scope 在 task_queue_patch_m0_m1_20260418.md 中仅含 M1 细化，M2–M5 尚未 atomic 化 | TESTFIX-09（verify-baseline 增加 phase-target 字段校验）|

---

## 二、应用方式

1. 本文件整体作为 `task_queue_patch_m0_5_20260418.md` 的**延续补丁**，§3（任务卡片）整段追加到 `docs/task-queue.md` 的 SEQ-20260418-M0.5 序列尾部（TESTFIX-06 完成备注之后、任何 PHASE COMPLETE 通知之前）
2. §4（序列头更新）是元信息修订，直接修改 `task-queue.md` 的 SEQ-20260418-M0.5 序列头「包含任务数」从 7 改为 10，「串行约束」按新链路更新
3. §5 补充判据与 §6 PHASE COMPLETE 通知模板替换原 `task_queue_patch_m0_5_20260418.md` §6；旧的判据标记为"由 fix 补丁 §5/§6 取代"
4. 所有 3 张新卡的执行须发生在 `dev` 分支；`main` 合并操作是 TESTFIX-09 内的最后一步

---

## 三、追加任务卡片

### TESTFIX-07 — E2E 全 suite 基线重建 + triage 补全

- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-06 已完成（dev 分支上工具链就绪）
- **文件范围**：
  - 修改 `docs/baseline_20260418/failing_tests.json`（重建，不是追加）
  - 修改 `docs/test_triage_20260418.md`（补充 6 个此前未覆盖 suite 的条目 + 重分类 A 类）
  - 新增 `docs/baseline_20260418/e2e_coverage_report.md`（本次扫描覆盖率说明）
  - 修改 `docs/known_failing_tests_phase0.md`（按新 triage 同步）
  - 修改 `scripts/verify-baseline.ts`（增加 `--coverage-report` 子命令验证 coverage_report.md 与 failing_tests.json 的 suite 列表一致）
- **变更内容**：
  1. **全量跑 E2E**：在 `dev` 分支上执行 `npm run test:e2e -- --reporter=json --output=test-results/e2e-full.json`（playwright JSON reporter），强制运行全部 8 个 suite 共 108 个 test
  2. **采集失败**：对每条 `status: "failed"` 或 `status: "flaky"` 的 test，按 §3.1 schema 生成新条目（`test_id` 格式 `e2e::<suite>.spec.ts::<describe>::<title>`）
  3. **重建 failing_tests.json**：unit 部分由 `npm run test -- --run --reporter=json` 重新采集；保留 unit 现状（TESTFIX-05 已修 D 类，A 类 defer 状态不变）；e2e 部分按第 2 步新集合完整替换
  4. **覆盖率核验**：新增 `e2e_coverage_report.md` 列出 8 个 suite 的 test 总数、通过数、失败数、flaky 数，签署本次采集完整性
  5. **triage 补全**：对所有新增失败条目（特别是 homepage/admin/auth 等）按 workflow-rules §Phase 基线测试条款 §3.1 第 2 条分类：
     - 失败原因 = suite import error → A 类
     - 失败原因 = 断言与实现不符（路由名、字段名等架构级）→ B 类
     - 失败原因 = testid / DOM 不匹配 → C 类
     - 失败原因 = 运行期错（级联、mock 契约缺失）→ D 类
     - 不要照搬当前 triage 文档的"A 类全部是 process.exit 级联"的既有错位；严格按规则定义分类
  6. **重分类既有 A 类**：当前 triage A×13 的"process.exit 级联"在工作流规则下属于 D 类（运行期错误），但由于 TESTFIX-05 的修复方向已写明（config.ts 延迟加载），保留 "A（原分类）+ D（规则分类）" 两字段；在 triage 汇总表新增一列"规则类别"以不破坏既有引用
  7. **同步隔离清单**：新增 E2E 失败若处置为 `quarantine` 或 `defer`，按原格式追加到 `known_failing_tests_phase0.md` 的 JSON 块；所有 `defer` 必须绑定具体里程碑
  8. **verify-baseline 扩展**：增加 `--coverage-report` 子命令，读取 `e2e_coverage_report.md` 中的 suite 列表，校验与 `failing_tests.json` 的 `suite` 字段集合一致（防止遗漏）
- **验收**：
  - `npm run test:e2e -- --reporter=json` 执行成功（允许失败，但必须有 JSON 输出）
  - `failing_tests.json` 包含全部 8 个 suite 的失败条目，`suite` 字段 distinct 值数 ≥ 有失败的 suite 数
  - `e2e_coverage_report.md` 显示 8 个 suite 全覆盖，总 test 数 ≈ 108（playwright 自身 `numTests` 字段）
  - `npm run verify:baseline -- --coverage-report` 通过
  - `npm run verify:baseline` schema 校验通过
  - `test_triage_20260418.md` 汇总表数字与 `failing_tests.json` 分类 count 一致
  - `known_failing_tests_phase0.md` JSON 块条目与 triage `quarantine` + `defer` 总和一致
  - changelog.md 追加：`testfix(TESTFIX-07): 重建 E2E 基线，8 suite 全覆盖，失败 N 条（原 9 → N）`
- **完成备注**：_（AI 填写：必须列出重建前后失败数对比表、每个 suite 失败分布、新发现的失败类别分布）_

---

### TESTFIX-08 — 跨 E2E suite 修复 Mock 契约 + 补齐 testid

- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-07（需要完整的失败清单与分类作为输入）
- **文件范围**：
  - 修改 `tests/e2e/homepage.spec.ts`（MOCK_MOVIE / MOCK_SERIES 补齐 Video contract 必填字段）
  - 由 TESTFIX-07 新 triage 文档 D 类「mock 契约缺失」条目决定的其他 suite 文件（预期涉及 `auth.spec.ts`、`search.spec.ts` 中未触及的 mock）
  - 由 TESTFIX-07 新 triage 文档 C 类「本 Phase 内可立即修」条目决定的 `apps/web/src/components/**/*.tsx`（如缺失的 `nav-cat-all` testid，若仍在本 Phase 前端范围内）
  - 不得触碰 `e2e/player.spec.ts`、`e2e/search.spec.ts` 中 triage 已标注 `defer M2/M3/M5` 的条目
- **变更内容**：
  1. **MOCK_MOVIE / MOCK_SERIES 补齐**（homepage.spec.ts 第 13-41 行）：
     - 追加 `genres: string[]`、`aliases: string[]`、`languages: string[]`、`tags: string[]`、`subtitleLangs: string[]`（对齐 Video contract；与 TESTFIX-02 中 player.spec.ts 同源修复方案保持一致）
     - 所有数组默认 `[]`，不引入随机值
     - 同时补齐任何新出现的必填字段（以 `packages/types/src/Video.ts` 为准；如未来字段扩展需追加）
  2. **其他 suite 同源修复**：
     - 按 TESTFIX-07 triage 中 D 类「mock 契约缺失」清单逐个处理
     - 统一修复策略：在 spec 顶部定义 `buildMockVideo(overrides)` 工具函数，返回 Video contract 全字段默认对象 + 测试级覆盖
     - 可选沉淀：若 3 个及以上 spec 重复定义 mock，提取到 `tests/e2e/fixtures/mock-video.ts`（遵循 CLAUDE.md §共享组件 3 处以上提取规则）
  3. **`nav-cat-all` 等可修 testid**：
     - 核验 triage 是否把 `nav-cat-all` 归为 C 类 `defer` 或 `fix`
     - 若归为 `fix`（因为导航栏不在 M2–M5 重写范围内），在对应组件（预期 `apps/web/src/components/Layout/Navigation.tsx` 或同等）添加 `data-testid="nav-cat-all"` 等属性
     - 若归为 `defer` 到某个里程碑，**不修**，只在 triage 行标注
  4. **局部重跑验证**：
     - 每修完一条，针对所属 suite 单独跑 `npx playwright test tests/e2e/<suite>.spec.ts --reporter=list`，本 spec 内关联 test 全绿
     - 跑完全部修复后，**随机抽 3 个 suite** 做全 spec 跑（作为回归抽样）
  5. **回写 triage**：每修一条，在 triage 文档对应行 `处置` 字段改为 `fixed`，附 commit hash
- **验收**：
  - `tests/e2e/homepage.spec.ts` MOCK_MOVIE / MOCK_SERIES 包含所有 Video contract 必填字段（`grep` 验证 `genres`、`aliases`、`languages`、`tags`、`subtitleLangs` 5 个字段名均出现在 mock 对象）
  - 所有标注为 `fix` 的 mock 契约失败条目，对应 suite 单独跑全绿
  - 随机抽样 3 个 suite 的全 spec 跑，新增通过数 ≥ 本卡预期修复数
  - `npm run typecheck` + `npm run lint` 全绿
  - triage 文档 `fix` 状态条目全部标记 `fixed` + commit hash
  - 未触碰 `defer` 项（`git diff` 人工核验，或加 linter 规则）
  - changelog.md 含每个修复的独立条目：`testfix(TESTFIX-08): <suite>::<test> mock 契约补齐，补字段 {A,B,C}` 形式
- **完成备注**：_（AI 填写：必须列出修复的 suite×test 清单、每条修复前后的失败→通过状态、是否沉淀了共享 mock fixture）_

---

### TESTFIX-09 — test-guarded 扩展 E2E 子命令 + 合并 main + PHASE COMPLETE

- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TESTFIX-07、TESTFIX-08 全部完成
- **文件范围**：
  - 修改 `scripts/test-guarded.ts`（新增 `--mode unit|e2e|all` 选项，`all` 会真实跑两者并合并 diff）
  - 修改 `package.json`（追加 `test:guarded:e2e`、`test:guarded:all` 两个 script 入口；保留 `test:guarded` 为 unit only 向后兼容）
  - 修改 `scripts/verify-baseline.ts`（新增 `--phase-target` 字段校验：确认每个 `defer` 项的 `关联里程碑` 值属于 `{M1, M2, M3, M4, M5, M6, TESTFIX-XX}` 枚举集合）
  - 修改 `.github/workflows/ci.yml` 或等价 CI 配置（把 `test:guarded` 升级为 `test:guarded:all`；受限于 CI 环境，E2E 若不可用退化为 unit + `test:e2e:smoke`，但本地完整模式仍存在）
  - 修改 `docs/task-queue.md`（追加 PHASE COMPLETE — Phase 0.5 通知块，按本补丁 §6 模板）
  - 修改 `docs/changelog.md`（追加 M0.5 总结条目）
  - 合并操作：`dev` → `main`（fast-forward 或 --no-ff 按 git-rules 决定）
- **变更内容**：
  1. **test-guarded.ts 扩展**（约 60 行增量）：
     - 新增 CLI flag `--mode unit|e2e|all`（默认 `unit` 兼容现状）
     - `--mode e2e`：跑 `npx playwright test --reporter=json --output=.test-results/e2e-guarded.json`，解析失败 test_id（格式 `e2e::<suite>::<describe>::<title>`），与 Phase 隔离清单的 `e2e::` 前缀项 diff
     - `--mode all`：顺序跑 unit → e2e，合并失败集合后统一 diff，任一轮有"清单外新失败"即退出码 1
     - 保持原 `knownFailures`、`regressedFromQuarantine`、`newFailures` 三分逻辑；e2e 侧使用相同集合运算
     - 在 summary 输出顶部增加 `mode: <unit|e2e|all>` 行
  2. **verify-baseline 增强**：
     - 新增 `--phase-target` 开关
     - 解析 `test_triage_<date>.md` 中每条 `关联里程碑` 字段，校验其为枚举集合之一
     - 允许值集合维护在 `scripts/_baseline_constants.ts` 便于未来增删
  3. **CI 配置**：
     - 主 lint+typecheck+test 流水线改调 `npm run test:guarded:all`（若 playwright 浏览器就绪）
     - 若 CI 不跑 playwright（例如 arm 环境），退化为 `npm run test:guarded` + 独立的 smoke job
     - 在 PR check 中明确标注使用的 mode
  4. **Phase 0.5 质量门禁人工核验清单**：
     - [ ] `npm run test:guarded:all` 本地通过（或在 CI 等价步骤通过）
     - [ ] `npm run verify:baseline` 全部子命令通过（schema + coverage-report + phase-target）
     - [ ] `npm run typecheck` + `npm run lint` 全绿
     - [ ] 所有 TESTFIX-00..09 卡在 task-queue.md 显示 `✅ 已完成`
     - [ ] `docs/known_failing_tests_phase0.md` 最终条目数与 triage `quarantine` + `defer` 总和一致
     - [ ] `docs/decisions.md` 包含 ADR-034（由 TESTFIX-02 产出）
  5. **合并 main**：
     - 确认上述全部通过后，在 `main` 执行 `git merge dev`
     - commit message：`feat: complete Phase 0.5 (M0.5) — test bed repair + E2E baseline full coverage`
     - 按 git-rules 附 Co-Authored-By 尾部
  6. **PHASE COMPLETE 通知**：
     - 按本补丁 §6 模板追加到 `docs/task-queue.md` 末尾
     - 通知中的数字字段必须由 `scripts/verify-baseline.ts` 读取当前 `failing_tests.json` 后自动插值，禁止手写（避免再次发生数字不一致）
     - 可选：在 TESTFIX-09 内新增 `scripts/render-phase-notice.ts`，输出 markdown 片段供人工复制
- **验收**：
  - `npm run test:guarded --` 保持原行为（unit only）
  - `npm run test:guarded:e2e` 输出 e2e 隔离 diff 报告
  - `npm run test:guarded:all` 顺序执行 unit + e2e，merged diff 报告
  - 模拟一条 E2E 新失败（临时改 testid）→ `test:guarded:e2e` 退出码 1
  - 模拟隔离清单内 E2E 失败 → 仅 warning，退出码 0
  - `npm run verify:baseline -- --phase-target` 通过；若人工在 triage 插入非法 `M9`，该命令退出码 1
  - `main` 分支 HEAD 为 M0.5 合并 commit
  - `docs/task-queue.md` 末尾存在 PHASE COMPLETE — Phase 0.5 通知块
  - 通知块中的数字与 `failing_tests.json` 当前计数一致
  - `docs/changelog.md` 追加：
    - `testfix(TESTFIX-09): test-guarded 支持 e2e/all 模式`
    - `chore(M0.5): merge dev → main，Phase 0.5 完成，基线覆盖 8/8 suites`
- **完成备注**：_（AI 填写：必须列出 main 合并 commit hash、PHASE COMPLETE 通知插入位置行号、test-guarded 三种模式实测输出截取）_

---

## 四、SEQ-20260418-M0.5 序列头更新

原序列头（task_queue_patch_m0_5_20260418.md §4 序列头）需在 `task-queue.md` 中就地修订：

| 字段 | 原值 | 新值 |
|------|------|------|
| 包含任务数 | 7 | 10 |
| 完成条件 | 全部 7 张任务卡 `✅ 已完成` + 合并 main + PHASE COMPLETE 通知落盘 | 全部 10 张任务卡 `✅ 已完成` + 合并 main + PHASE COMPLETE 通知落盘（合并与通知均在 TESTFIX-09 内完成）|
| 串行约束 | TESTFIX-00 → (TESTFIX-01 ‖ TESTFIX-02) → TESTFIX-03 → (TESTFIX-04 ‖ TESTFIX-05) → TESTFIX-06 | TESTFIX-00 → (TESTFIX-01 ‖ TESTFIX-02) → TESTFIX-03 → (TESTFIX-04 ‖ TESTFIX-05) → TESTFIX-06 → TESTFIX-07 → TESTFIX-08 → TESTFIX-09 |

执行人（人工或下一个启动的 Claude Code 会话）在处理本补丁时，先以 `Edit` 工具就地更新上述序列头字段，再追加 §3 的三张卡片。

---

## 五、新 Phase 0.5 完成判据（取代原 patch §6）

### 5.1 自动判据

- [ ] 10 张 TESTFIX 卡全部 `✅ 已完成`
- [ ] `npm run test:guarded:all` 本地与 CI 均通过（隔离清单内失败不阻断，清单外 0 失败）
- [ ] `npm run verify:baseline -- --coverage-report --phase-target` 通过
- [ ] `npm run typecheck` + `npm run lint` 全绿
- [ ] `dev` 合并到 `main`，commit message：`feat: complete Phase 0.5 (M0.5) — test bed repair + E2E baseline full coverage`

### 5.2 文档判据

- [ ] `docs/decisions.md` 包含 ADR-034（TESTFIX-02 产出）
- [ ] `docs/test_triage_20260418.md` 覆盖 8 个 E2E suite 的全部失败条目，无空白处置；汇总表数字与 failing_tests.json 一致
- [ ] `docs/baseline_20260418/failing_tests.json` 含 8/8 suite 的失败，`suite` distinct 值集合与 `e2e_coverage_report.md` 一致
- [ ] `docs/baseline_20260418/e2e_coverage_report.md` 存在
- [ ] `docs/known_failing_tests_phase0.md` 与 triage `quarantine` + `defer` 总和一致，每条 `defer` 均有合法 `关联里程碑`
- [ ] `docs/rules/workflow-rules.md` 含「Phase 基线测试条款」章节
- [ ] `docs/task-queue.md` 末尾追加 PHASE COMPLETE — Phase 0.5 通知（数字由 verify-baseline 插值）
- [ ] `docs/changelog.md` 含 TESTFIX-07/08/09 条目 + M0.5 合并记录

### 5.3 数字一致性判据

- [ ] PHASE COMPLETE 通知中「E2E：N 通过 / M 失败 / K flaky」与 `failing_tests.json` 聚合计数一致
- [ ] PHASE COMPLETE 通知中「单测：N 通过 / M 失败」与 `failing_tests.json` unit 部分一致
- [ ] `verify-baseline --unit X --e2e Y --total Z` 命令能以通知中数字作为参数而不退出码 1

---

## 六、PHASE COMPLETE — Phase 0.5 通知模板（取代原 §6.3）

由 TESTFIX-09 负责插入 `docs/task-queue.md` 末尾。模板占位符 `<...>` 必须由 `scripts/render-phase-notice.ts` 或手工查表填入真实值后提交。

```markdown
---
✅ PHASE COMPLETE — Phase 0.5（M0.5）已完成，等待确认开始 Phase 1（M1 收尾）
- **完成时间**：<YYYY-MM-DD HH:MM>
- **本 Phase 完成任务数**：10（TESTFIX-00 至 TESTFIX-09）
- **已合并到 main**：是（commit `<merge-hash>`）
- **基线状态**：
  - 单测：<N> 通过 / <M> 失败（<M> 条均在 known_failing_tests_phase0.md 内）
  - E2E：<N> 通过 / <M> 失败 / <K> flaky（全部 8 suites，<M> 条均在隔离清单内）
  - verify:baseline 通过 ✓（含 schema + coverage-report + phase-target 三类检查）
  - test:guarded:all 通过 ✓
- **本 Phase 核心修复**：
  - A 类（config.ts 延迟加载）：13 条 unit 级联失败解除
  - B 类（ADR-034 `/watch/` vs `/movie/` 双路由分治）：相关 E2E 决策落地
  - C 类（testid 漂移）：本 Phase 内 fix <X> 条，defer 到 M2/M3/M5 共 <Y> 条
  - D 类（真 bug）：<Z> 条源码修复（含 externalData / metadataProvenance raw db.query mock 补齐）
  - E2E 基线覆盖：从 2/8 suite 升级为 8/8 suite
- **建议下一步**：
  - 若 TOKEN-01..06 已并行完成，启动 TOKEN-07
  - 若 TOKEN-01..06 未启动，按串行启动 TOKEN-01
- **需要你做的事**：
  - [ ] 抽查 test_triage 文档 5 条，核验类别判断合理性（特别是 TESTFIX-07 新增的 6 个 suite 条目）
  - [ ] 抽查 ADR-034 决策理由
  - [ ] 抽查 known_failing 清单，确认无应修而被隔离的测试
  - [ ] 抽查 mock fixture 是否已沉淀到 `tests/e2e/fixtures/`（若适用）
  - [ ] 确认开始 Phase 1 收尾（删除此块即可）
---
```

---

## 七、风险与降级

### 7.1 风险

1. **TESTFIX-07 全量 E2E 跑失败时间过长**：108 test 且当前多数失败，playwright 重试机制可能拉长单次运行至 30+ 分钟。缓解：加 `--retries=0 --workers=4`；若仍超时，按 suite 分批跑并 merge 结果
2. **新失败数膨胀导致隔离清单过大**：若 TESTFIX-07 发现 50+ 条新失败，隔离清单违反"单调收敛"期望。缓解：本轮隔离清单作为 Phase 0 冻结基线，M1 开始前仅接受缩小；TESTFIX-07 产出中必须含"本次采集相对原 97 条报告的差值说明"
3. **CI 缺 playwright 浏览器**：`test:guarded:all` 在 CI 可能因缺 chromium 无法跑 E2E。缓解：TESTFIX-09 验收条款允许 CI 退化为 unit-only；本地完整模式仍必须可用

### 7.2 降级方案

若 TESTFIX-07 跑 E2E 全量耗时 > 2 小时或需人工多次干预：

- 降级 A：按 suite 分 3 批跑（player+search / admin+admin-source / homepage+auth+publish+video-governance），每批产出独立 failing_tests.json 片段，最后 merge
- 降级 B：只跑 priority=P0 的 4 个 suite（homepage/auth/admin/search），其他在 Phase 1 内补（需新建 TESTFIX-10）
- 降级 C：放弃"E2E 全覆盖作为 Phase 0.5 合并前置"，改为"E2E 至少覆盖 P0 suite" + "TESTFIX-10 卡追进 Phase 1"

降级决定必须写入 `docs/changelog.md` 一行 + 在 TESTFIX-07 完成备注中明确记录采用的降级方案

---

## 八、对未来重写项目的固化追加

本补丁在原 `task_queue_patch_m0_5_20260418.md` §7 固化效果基础上，追加两条经验：

- **完成度审计必须独立于执行者**：TESTFIX-00..06 的原始完成报告未触发本轮发现的 R1/R2/R3/R4；下次 Phase 完成前，工作流必须强制 spawn 一个独立 Opus 子代理做"完成度审计"，其输出未通过 ≥ 1 红线时，PHASE COMPLETE 通知不得发出。建议在 TESTFIX-00 workflow-rules 再升级时纳入本条。
- **基线采集必须 suite-complete 而非 failure-complete**：原 TESTFIX-03 仅采集"当前失败的 test"而未采集"跑过的全部 suite"；这使得"未采样到的 suite"无法与"0 失败的 suite"区分。新的 `e2e_coverage_report.md` 制度把 suite 覆盖率纳入基线产物，避免同类错配。
