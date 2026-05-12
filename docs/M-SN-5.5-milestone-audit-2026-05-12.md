# M-SN-5.5 Milestone 阶段审计报告

> 审计模型：claude-opus-4-7（独立 arch-reviewer，无主循环上下文继承）
> 审计日期：2026-05-12
> 审计范围：M-SN-5.5 milestone（SEQ-20260506-02 / CHG-SN-5-PRE-01-A..F + PRE-02 + PRE-03-A..F 共 13 子卡）
> 评级模板：`docs/server_next_plan_20260427.md` §5.3 A/B/C
> 评审方式：独立 grep + 文件阅读核实，不依赖主循环描述
> 触发卡：CHG-SN-5.5-AUDIT（SEQ-20260512-01 第 1 张子卡）

---

## 评级：**A-**

判据：完成标准 100% + 偏差报告 0 项「必须回滚」+ 0 项「需追溯 ADR」+ 工时未超 +10% + a11y 无 critical 项。未给满 A 仅因 visual baseline 在 macOS 单平台入库 + Storybook infra 缺失（已转登记 DEBT，非本 milestone 红线）。

**M-SN-5 主体启动准入：PASS 无条件**。

---

## ① 偏差报告（逐子卡核验 + 三档分类）

| # | 子卡 | task-queue 声明 | 独立核验证据 | 分类 |
|---|---|---|---|---|
| 1 | PRE-01-A 演练 | ✅ 5 步金票全绿 | `docs/server_next_PRE-01-A-drill-2026-05-12.md` 存在；commit `077393e8`；新增 Risk-PRE-01-A-1 登记 | 合理 |
| 2 | PRE-01-B M-SN-3 audit | ✅ B+ PASS | `docs/M-SN-3-milestone-audit-2026-05-12.md` 存在；arch-reviewer Opus 独立复评 §1.1 完整 | 合理 |
| 3 | PRE-01-C 乐观锁 | ✅ A- PASS | `apps/api/src/db/queries/video_sources.ts:162` 抛 `STATE_CONFLICT 409`；`videos.ts:621` 同模式；`apps/api/src/routes/admin/videoSources.ts:52` 处理；UI 路径 followup `f9e410e0` 接入 | 合理 |
| 4 | PRE-01-D XFF 白名单 | ✅ A- PASS | `apps/api/src/server.ts:54-77` `parseTrustedProxies()` + `trustProxy`；`routes/feedback.ts:73` `request.ip`；默认 fail-secure | 合理 |
| 5a | PRE-01-E-1 harness + ADR-116 | ✅ A- PASS | `tests/visual/admin-ui/*.visual.spec.ts` 5 个 spec；`admin-visual` project 隔离；ADR-116 落 `docs/decisions.md:4750` 含 7 followup 修订轨迹 | 合理 |
| 5b | PRE-01-E-2 真截图 | ✅ 12 张入库 | `tests/visual/admin-ui/**/*-admin-visual-darwin.png` 实际 12 张全在；含 followup-1~5 修复 stateFgOnSoft AA contrast | 合理（注：仅 darwin 平台 baseline，见 Y1） |
| 6 | PRE-01-F moderation 7 张 | ✅ 真截图入库 | `tests/visual/admin-moderation.visual.spec.ts-snapshots/*.png` 7 张完整（pending-list / pending-detail / lines-panel / rejected / staging / reject-modal / line-health-drawer）；commit `9720e219` | 合理 |
| 7 | PRE-02 line_key 决策 | ✅ 方案 A 落盘 | `docs/decisions.md:4411` ADR-114-NEGATED 含 4 项重新评估触发条件 + 方案 B 路径不启动声明；plan §3/§6/§9/§10.9 全部同步 | 合理 |
| 8 | PRE-03-A PageHeader | ✅ B+ PASS | `packages/admin-ui/src/components/page-header/page-header.tsx` + `index.ts` + `tests/unit/components/admin-ui/page-header/page-header.test.tsx` | 合理 |
| 9 | PRE-03-B AdminButton | ✅ B+ PASS | 同上路径 `admin-button/`；R-1 disabled\|\|loading 同卡修；followup 4 次修 PRIMARY contrast | 合理 |
| 10 | PRE-03-C AdminInput | ✅ A- PASS | 同上路径 `admin-input/`；7 type 含 search/tel/url | 合理 |
| 11 | PRE-03-D AdminSelect | ✅ B+ PASS | 同上路径 `admin-select/`；ARIA 1.2 combobox/listbox 完整 | 合理 |
| 12 | PRE-03-E AdminCard | ✅ B+ PASS | 同上路径 `admin-card/`；headingLevel 2-6 | 合理 |
| 13 | PRE-03-F Popover | ✅ A- PASS | `popover.tsx` + `compute-position.ts` 拆分；ADR-115 落 `decisions.md:4491` 3 轮评审完整；`--z-admin-popover` 落 `tokens.css` + `z-index.ts` | 合理 |

**三档汇总**：
- 必须回滚：**0**
- 需追溯 ADR：**0**
- 合理：**13/13**

---

## ② 质量评级判据满足情况（plan §5.3）

| 判据 | 实况 | 满足 |
|---|---|---|
| 完成标准 100% | 13/13 子卡 close，A 段 4🔴 全 close + 2🟠 不仅显式标"未来 close"且**直接 close**（超额）；B 段方案 A 落盘；C 段 6 件原语全在 packages/admin-ui + index.ts 导出 + 单元测试 | ✅ |
| 偏差 0 项「必须回滚」 | 三档分类 0 红 0 黄 | ✅ |
| e2e 黄金路径全绿 | PRE-01-A 5 步金票演练全绿；unit 261 files / 3434 tests 全绿（最新声明 commit `9720e219`） | ✅ |
| 工时未超 +10% | 基线 2.0w；实际 2026-05-06 → 2026-05-12 = 1.0w 单人时；远低于基线 | ✅ |
| a11y 无 critical 项 | AdminButton PRIMARY contrast bug followup 1~5 已修（state-fg-on-soft theme-aware token）；AdminSelect ARIA 1.2 完整；Popover ESC + outside click + role | ✅ |
| 6 通用原语 API 契约稳定 | 6 件全有 Props 类型导出；index.ts 桶导出齐；零业务视图消费（grep `apps/server-next/src/app/admin` 仅 dev/components + dev/visual 路径引用，业务路径 `videos/_client` / `moderation/_client` / 等均未 import 6 件原语之一） | ✅ |
| 零业务视图消费硬约束 | grep 确认：moderation 业务文件 `ModerationConsole.tsx` / `FilterPresetPopover.tsx` 文件名虽含 "Popover" 但无 `import { Popover } from '@resovo/admin-ui'`；videos 业务文件无 import 6 件之一；所有 PageHeader/AdminButton/AdminInput/AdminSelect/AdminCard/Popover 消费仅在 `apps/server-next/src/app/admin/dev/`（demo / visual harness 豁免边界） | ✅ |

**评级落点**：**A-**（接近 A 满分，扣 0.5 等级因 visual baseline 单平台 + Storybook 缺失 → 黄线观察项）

---

## ③ 红线项（必修，否则不得 PHASE COMPLETE）

**0 项。**

---

## ④ 黄线项（应修，列明风险）

- **Y1 · visual baseline 单平台覆盖**：所有 19 张 admin-visual baseline 后缀 `-darwin.png`，仓库 CI 若改在 linux 跑会全失败。ADR-116 §2.5 已用 `PLAYWRIGHT_VISUAL=1` env 隔离，默认 e2e gate 不拉，风险已缓解。但 cutover 前需补 linux baseline 或确认 visual project 仅在 macOS dev 跑。**M-SN-5 主体启动不阻塞；记入 cutover-pre 卡**。
- **Y2 · DEBT-ADMIN-UI-STORYBOOK-MISSING / BUTTON-HOVER / FOCUS-PSEUDO 三项 admin-ui 视觉债**：PRE-03-A/B/C 评审产生的转登记 DEBT，inline style 无法表达 :hover / :focus 伪类；M-SN-5 主体视图首批消费方时再统一治理（搭 Storybook + CSS file 切换）。
- **Y3 · Risk-PRE-01-A-1 SameSite=Strict 跨子域 cutover 风险**：已正确登记到 task-queue 欠账段 + PRE-01-B 审计材料显式声明；M-SN-7 cutover-pre 卡必须评估调 SameSite=Lax 或保持同域名结构。
- **Y4 · PRE-01-E-2 fullPage 截图含 admin shell + sidebar 动态数字 flake**：task-queue line 3207 已显式留 PRE-01-E-2-followup 卡未来稳定；M-SN-5 主体启动不阻塞。
- **Y5 · 6 件原语 unit test 0 业务视图集成测试**：单测仅覆盖原语自身行为；M-SN-5 视图首批消费方时可能暴露 props 不足（如 AdminSelect 异步加载在真业务 fetch 下的边界）。前瞻评估见 ⑤。

---

## ⑤ 人工 checklist（开放项，自动审计无法判定）

- [ ] **6 原语在未来 M-SN-5 视图消费时 API 稳定性**：建议主循环在 M-SN-5 前两张视图卡（如 `/admin/sources` / `/admin/submissions`）实施时把 6 原语消费列入 review 重点；任一原语在视图卡内出现 props 反向扩展（不是 className/style 兜底，而是新增功能性 prop）即触发 plan §5.2 BLOCKER 第 6 条「公开 API 契约稳定性回归」
- [ ] **Popover ADR-115 v1 minimum viable subset 对 M-SN-5 sources / merge / home 视图够用性**：v1 实施 6 placement + non-modal + 4 props @experimental（modal / closeOnTabOut / portalContainer / arrow）。如 sources 视图需要 modal popup（如线路别名编辑弹层带 focus-trap）则触发 ADR-115a 起草，**不允许直接在实施卡内绕开 ADR**
- [ ] **visual baseline harness（ADR-116）复用到 M-SN-5 新视图的可行性**：ADR-116 dev-only `/admin/dev/visual/` 路由 + component-registry + props 注入 query param 模式专为 D-14 五件下沉组件设计；M-SN-5 视图级（页面级）截图建议沿用 `tests/visual/admin-{module}.visual.spec.ts` 模式（PRE-01-F 已示范），不强制走 visual harness
- [ ] **Storybook infra 是否在 M-SN-5 主体启动后第 1 周内 spike**：DEBT-ADMIN-UI-STORYBOOK-MISSING 转登记后无固定截止；建议在 M-SN-5 首张视图卡完成后立卡评估
- [ ] **Risk-PRE-01-A-1 SameSite=Strict 决策**：cutover-pre（M-SN-7 启动前）必须出 ADR 锁定 cookie 策略；如选 SameSite=Lax 需评估 CSRF 风险增量；如保持同域名结构需写入 ADR-101 cutover 协议附录
- [ ] **Storybook 不搭情况下 6 原语视觉一致性如何回归**：当前 demo 页 `apps/server-next/src/app/admin/dev/components/components-demo.tsx` 承担部分职责；建议主循环在 M-SN-5 启动前 visual baseline 一次 demo 页

---

## ⑥ 数字一致性审查

| 维度 | task-queue 声明 | 实际证据 | 一致 |
|---|---|---|---|
| 13 子卡完成数 | 13/13 ✅ | 13 commit / 13 文件落地（包含 followup） | ✅ |
| commit hash 范围 | `4573df5f` → `9720e219` | git log 完整可达，含 PRE-01-A-pre 前置 + 多个 followup | ✅ |
| 6 件原语文件存在 | 6 个 component 子目录 | `packages/admin-ui/src/components/{page-header,admin-button,admin-input,admin-card,admin-select,popover}/` 全存在 + index.ts | ✅ |
| 6 件原语桶导出 | `packages/admin-ui/src/index.ts` | line 37-53 6 件全 `export *` | ✅ |
| visual baseline 数 | E-2: 12 张 + F: 7 张 = 19 张真截图 | glob 实测 19 张 `*-admin-visual-darwin.png` 完整 | ✅ |
| 7 张占位 PNG 删除 | tests/visual/moderation/ 删 7 张 | glob 现 `tests/visual/moderation/` 路径不存在；admin-moderation snapshots 在新路径 | ✅ |
| ADR-114-NEGATED 落盘 | decisions.md:4411 | line 4411 ADR-114-NEGATED 完整含 4 项重新评估触发条件 | ✅ |
| ADR-115 状态 | 3 轮评审 A- PASS | decisions.md:4491-4503 评审轨迹 3 轮完整 | ✅ |
| ADR-116 状态 | 2 轮评审 A- PASS + 7 followup | decisions.md:4750-4775 完整 | ✅ |
| `--z-admin-popover: 1050` | design-tokens 落 | `tokens.css` + `z-index.ts` 双处落地（followup-4 同步） | ✅ |
| unit test 总数 | 3434 全绿（最新声明） | 各子卡完成备注递增轨迹 3236 → 3253 → 3283 → 3310 → 3339 → 3370 → 3434，递增逻辑自洽 | ✅ |
| 工时 | 基线 2.0w / 实际 ~1.0w 单人时 | git log 时间跨度 2026-05-06 → 2026-05-12 = 6 天；含 followup ~50 commits | ✅ |

---

## ⑦ git log 交叉核验

| 子卡 | task-queue commit 声明 | git log 实际 | 一致 |
|---|---|---|---|
| PRE-01-A | commit `077393e8` | ✅ `077393e8 docs(CHG-SN-5-PRE-01-A): DEBT-SN-3-B...` | ✅ |
| PRE-01-A-pre | commit `d00c33c3` | ✅ `d00c33c3 feat(CHG-SN-5-PRE-01-A-pre): server-next 补 NEXT_PUBLIC_ASSET_PREFIX` | ✅ |
| PRE-01-B | commit `3b67e91f` | ✅ `3b67e91f docs(CHG-SN-5-PRE-01-B): M-SN-3 milestone 阶段审计完成` | ✅ |
| PRE-01-C | commit `021fdec2` | ✅ `021fdec2 feat(CHG-SN-5-PRE-01-C): toggleSource 乐观锁` | ✅ |
| PRE-01-D | commit `2c427af0` | ✅ `2c427af0 fix(CHG-SN-5-PRE-01-D): feedback XFF trustProxy 白名单` | ✅ |
| PRE-01-E-1 | commit `696d83a2` + 8 followup | ✅ `696d83a2` + `d30be779` `72b79ce8` `e6e02db9` `113358e7` `c147daba` `70324cea` `bc30b4a7` `9eea51a4` | ✅ |
| PRE-01-E-2 | commit `72b827d1` + 5 followup + 终结 `49c4557a` | ✅ 完整 | ✅ |
| PRE-01-F | commit `38643cd4` + 终结 `9720e219` | ✅ | ✅ |
| PRE-02 | commit `20d41316` | ✅ `20d41316 docs(CHG-SN-5-PRE-02): line_key 决策 — 方案 A 采纳` | ✅ |
| PRE-03-A..F | commits `b6b0d560 / 82c22705 / a585450a / ccfbc2e5 / 0f9dda8b / 39688eed` | ✅ 全 6 件落地；F 含 sub-ADR `d520f524` + 3 followup `2a8533d8 / 72b669a4 / f504ac6f` + tokens 同步 `f2985275` | ✅ |

**关键观察**：13 子卡声明 vs 实际 git log 100% 一致；followup 流程透明（每个 fix 单独 commit + Codex stop-time review 痕迹清晰）；流程违规自检（PRE-01-A-pre 严格三件套缺失 → followup `423bc142` 落盘）证明 QA 自查机制运转健康。

---

## ⑧ 准入判定

**M-SN-5 主体启动准入：PASS（无条件）**

判据：
1. 评级 A-（≥B 准入门槛）✅
2. 偏差报告 0 项「必须回滚」+ 0 项「需追溯 ADR」✅
3. 6 通用原语公开 API 契约稳定（零业务视图消费硬约束实测满足）✅
4. A 段 4🔴 全 close + 2🟠 超额直接 close（不仅"显式标 M-SN-7 final 前 close"）✅
5. B 段 ADR-114-NEGATED 落盘 + 方案 B 路径不启动 ✅
6. C 段 6 件原语 + index.ts 桶导出 + unit test 全覆盖 ✅
7. typecheck + lint + unit 3434 tests 全绿基线（最后两 commit `49c4557a` `9720e219` 完成备注声明）✅

**M-SN-5 第一张视图卡可立即起草**。

---

## ⑨ 附加观察 / 建议

1. **超额完成**：A 段 2🟠（PRE-01-E / PRE-01-F）按 plan §6 完成标准仅要求"显式标 M-SN-7 final 前 close"，实际直接 close。这是 plan v2.6 软上限协议下的工时压缩成果（实际 1.0w << 基线 2.0w），并非偏差。
2. **followup 流程健康度**：13 子卡产生 ~20 个 followup commit，集中在 PRE-01-E（8 followup：harness 基础设施 + middleware 鉴权 + RSC 边界 + AA contrast 4 轮）+ PRE-03-F（4 followup：键盘 toggle + ref fallback + 原生 button 不抢键盘 + tagName runtime check）。所有 followup 均经 Codex stop-time review 触发或 arch-reviewer Opus 触发，无"主循环单方面打补丁"模式。
3. **PRE-01-E-2 PRIMARY button contrast 4 轮迭代**（followup-2 → followup-5）暴露了 design-tokens semantic 层缺槽位（`stateFgOnSoft`）— 这是一次真实价值发现，沉淀为 theme-aware token + tailwind-preset 同步，**已正确沉淀到共享层**（CLAUDE.md 价值排序 #2 边界与复用满足）。
4. **零业务视图消费验证方法**：本审计独立 grep `apps/server-next/src/app/admin` 全路径，确认 6 原语消费仅在 `dev/components` + `dev/visual` 两条 demo / harness 路径，业务视图（videos / moderation / dashboard / system / analytics）零 import。**这是 M-SN-5.5 最关键的硬约束，已 100% 满足**。
5. **DOC-03 整理批次**（commit `28959ab3`）紧随 PRE-01-F 终结，作为"M-SN-5 主体启动前清理"是合理的 M-SN-5.5 收尾动作，但不在 SEQ-20260506-02 13 子卡范围内 — 本审计判定为 **M-SN-5.5 收尾归属**（清理 docs/ Tier 1+2+3+4+5a+8a，属 milestone 完成态清理）。
6. **建议 M-SN-5 第一张视图卡选 `/admin/submissions`**（依赖 0 个新原语 + 6 件原语全消费机会）作为"原语 API 稳定性验证卡"，比 `/admin/sources`（依赖 PRE-02 决策 + 复合键 schema 实证）风险更低。
7. **Risk-PRE-01-A-1 已正确登记**：task-queue 欠账段新增 Risk-PRE-01-A-1 行，PRE-01-B 审计材料显式声明，cutover-pre 卡评估 — 链路完整。

---

## 后续行动（主循环承担）

1. ✅ 本文件落盘归档（已完成 2026-05-12）
2. ✅ CHG-SN-5.5-AUDIT 卡状态推至 ✅ 已完成（task-queue.md + tasks.md）
3. ✅ changelog.md 追加审计完成条目
4. ⬜ SEQ-20260512-01 第 2 张子卡 CHG-PLAN-03（M-SN-5 主体 SEQ 起草）启动 — 接续推进
5. ⬜ M-SN-5 主体 SEQ-20260512-XX 起草 + Opus 评审 + 用户 sign-off
6. ⬜ M-SN-5 第一张视图卡（推荐 `/admin/submissions`，arch-reviewer 建议项 #6）

---

**审计闭环**：M-SN-5.5 milestone 阶段审计 **A- PASS 无条件**，准入门通过，M-SN-5 主体启动条件齐。
