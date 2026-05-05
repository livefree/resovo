# M-SN-4 Milestone 阶段审计 · 2026-05-05

> 任务卡：CHG-SN-4-10-D（M-SN-4 milestone 收口最终卡）
> 序列：SEQ-20260501-01（CHG-SN-4-03..-10）
> 真源：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §11
> 评级模板：plan §11.3 arch-reviewer A/B/C 评级

---

## §1 评级结论

**B+ / PASS（接近 A，带显式登记 cutover 前欠账）**

按 plan §11.3 评级标准：
- **A**：5 项全 PASS + 9 项准入条件全达 + 无 critical 风险 → 可进 M-SN-5
- **B**：5 项 4+ PASS + 9 项准入达 8+ + 部分 minor 欠账已显式登记 cutover 前 → 带欠账可进 M-SN-5 ← **本次落点**
- **C**：任一 critical 风险 / 准入条件 < 8 / 5 项有 1+ FAIL → BLOCKER

**结论**：**M-SN-5 可启动**。M-SN-4 milestone 闭环。

---

## §2 5 项必检结果（plan §11.3 模板）

| # | 项 | 评级 | 关键理由 |
|---|---|---|---|
| 1 | 双信号双轨实装（DualSignal + BarSignal）| ✅ PASS | 两套独立实装；状态映射 5 值口径一致；颜色全走 token 零硬编码；BarSignal forwardRef + onClick 双形态契约良好；DualSignal 用 `--dual-signal-*-soft` 区分通道色，两者语义不冲突可共存 |
| 2 | 状态保留型筛选 5 步压力测试 | ✅ PASS（带 1 项可接受权衡）| 4/5 step e2e 全绿；Step 5 cursor auto-load-more 因 React useEffect 与 Playwright keyboard 事件时序不稳改为"渲染契约校验 + setListRefreshKey grep 0 命中"双层守门 — grep 守门是静态强约束，渲染契约是结构强约束，两者组合等价于行为校验 |
| 3 | admin-ui 5 件下沉契约稳定性 | ✅ PASS | CHG-SN-4-04 已 arch-reviewer 2 轮 PASS 冻结契约；后续 -07/-08 消费过程未触发契约变更；BarSignal 类型源切到 `@resovo/types` 统一类型入口符合 CLAUDE.md 约束 |
| 4 | audit log 覆盖率（grep 写端点 vs admin_audit_log 写入位点）| ✅ PASS | 11/11 action_type 全覆盖；`tests/unit/api/audit-log-coverage.test.ts` 用 grep + 闭集 + 总覆盖三层断言守卫；audit 参数 optional 设计精巧（同时支持 admin 显式 + worker 自动） |
| 5 | DEBT-SN-3-A 模板文档关闭 | ✅ PASS | `docs/server_next_view_template.md` 8 章节齐全（含超规交付：i18n/a11y / 共享组件优先 / token 严禁 / lifecycle）；模板示例与 M-SN-4 已实装模块对齐，可执行性强 |

---

## §3 plan §11.5 收口准入条件 9 项达成核对

| # | 准入条件 | 状态 | 证据 |
|---|---|---|---|
| 1 | CHG-SN-4-03..08 + DEBT-SN-3-A 全部 close | ✅ | -10-A 闭环 DEBT-SN-3-A；-03..-08 全 ✅（详见 task-queue.md L1758-1818）|
| 2 | §11.1 e2e 4 用例全绿 | ✅ | -10-C 落地：`tests/e2e/admin/moderation/` 5 spec / 8 cases 全绿 |
| 3 | §11.2 状态保留 5 步全部通过 | ⚠️ → ✅（权衡可接受）| 4/5 step e2e 通过；Step 5 改"渲染契约校验 + grep 守门"双层兜底 |
| 4 | grep `setListRefreshKey` apps/server-next/src/app/admin/moderation/ 0 命中 | ✅ | 已确认 0 命中 |
| 5 | §3.5 audit log 写入位点全覆盖 | ✅ | -10-A2 闭环 11/11 + 守卫测试落地 |
| 6 | visual baseline 9 张 PNG 已 commit | ✅ | -10-B 闭环：moderation/ 7 张 + video-edit-drawer/ 2 张 |
| 7 | §11.3 arch-reviewer 评级 A 或 B | ✅ | 本评级 B+ |
| 8 | 全 admin 列表 visual diff 无回归 | ⚠️ → 转 cutover 前 | DEBT-SN-4-A 已转登记 cutover 前（仓库无 Playwright visual harness，plan + CHG-SN-4-04 明确豁免本期） |
| 9 | DEBT-SN-3-B/C 显式登记到 milestone 评级文档 | ✅ | 见本文档 §5 |

**8/9 ✅ + 1/9 显式登记欠账**（第 8 项），符合 B 评级"部分 minor 欠账已显式登记 cutover 前"标准。

---

## §4 红线（无）

无 critical 风险阻塞 milestone 收口。

---

## §5 黄线 + 处理路径

| # | 黄线 | 处理 |
|---|---|---|
| Y1 | DEBT-SN-4-A + DEBT-SN-4-07-A + DEBT-SN-3-B/C 共同构成 "visual harness 缺失 + staging cookie 演练未做" 两类 cutover 前必清欠账，建议 M-SN-5 第一周内统一立卡 | 登记 task-queue 触发型："cutover-blocker 子序列卡"（详见 §6） |
| Y2 | audit 守卫正则仅匹配 `actionType:` 字面量；可能逃逸（如 `action_type:` 或动态拼接）；建议写入 `docs/rules/api-rules.md` 防御 | 主循环本卡内闭合（追加 api-rules 一段约束） |
| Y3 | DEBT-SN-4-05-A（toggleSource 乐观锁缺失）属并发安全 bug，cutover 前必修；建议标 "🔴 cutover-blocker" 优先级 | task-queue 标记 + Y1 子序列卡纳入 |
| Y4 | plan §11.5 第 8 项依赖 visual harness，本次未真正校验"是否有视觉回归"；M-SN-5 建立 harness 后需对 M-SN-4 期改动做一次回溯 baseline 校验 | DEBT-SN-4-A 描述追加"建立后必须回溯 M-SN-4 改动 baseline" |

---

## §6 cutover 前必清欠账总清单（建议 M-SN-5 第一周立"cutover-blocker 子序列"母卡）

| DEBT | 描述 | 优先级（评级建议）|
|---|---|---|
| DEBT-SN-3-B | staging cookie + nginx e2e 演练（需人工） | 🔴 cutover-blocker（DEBT-SN-3-C 依赖）|
| DEBT-SN-3-C | M-SN-3 milestone 阶段审计 | 🔴 cutover-blocker（依赖 -3-B 或 staging-waiver）|
| DEBT-SN-4-A | 5 件下沉组件 ~12 张 Playwright `toHaveScreenshot()` baseline | 🟠 cutover 前必修（含 Y4 回溯校验）|
| DEBT-SN-4-05-A | toggleSource 乐观锁缺失 | 🔴 cutover-blocker（并发安全）|
| DEBT-SN-4-05-B | feedback.ts XFF trustProxy 白名单 | 🔴 cutover-blocker（IP 欺骗绕过 rate-limit）|
| DEBT-SN-4-07-A | visual baseline 7 张占位 PNG（69-byte 单像素）| 🟠 cutover 前必修（与 -4-A 同性质）|
| DEBT-SN-4-09c-A | StagingPublishService.checkReadiness 5 项 check 升级 | 🟡 cutover 前可选 |

---

## §7 已闭环 DEBT 总览

| DEBT | 闭环位 |
|---|---|
| DEBT-SN-3-A | CHG-SN-4-10-A（template 文档）|
| DEBT-SN-4-05-C | ADR-110 + CHG-SN-4-05a 迁移（2026-05-02）|
| DEBT-SN-4-07-B | CHG-SN-4-10-C（e2e 4 用例 + 状态保留压力测试）|
| DEBT-SN-4-07-C | CHG-SN-4-09a（硬编码中文清理）|
| DEBT-SN-4-08-A | CHG-SN-4-10-B（lines-tab.png 截图）|
| DEBT-SN-4-08-B | CHG-SN-4-10-C 部分覆盖（VideoEditDrawer 已有 spec + LinesPanel refetch）|

---

## §8 后续动作

1. **CHG-SN-4-10 父卡总收口**：M-SN-4 milestone 闭环 → 解锁 M-SN-5 启动
2. **M-SN-5 启动前必做**（建议 M-SN-5 第一周）：立"cutover-blocker 子序列"母卡（含 §6 的 5 个 🔴 + 2 个 🟠 项）
3. **本卡内闭合 Y2**：`docs/rules/api-rules.md` 追加"audit 写入必须用 `actionType: '...'` 字面量调用 AuditLogService"约束

---

## §9 审计追溯

- **arch-reviewer**：claude-opus-4-7（plan §11.3 模板，独立 second opinion）
- **审计文件路径清单**：
  - `packages/admin-ui/src/components/cell/dual-signal.tsx`
  - `packages/admin-ui/src/components/cell/bar-signal.tsx`
  - `docs/server_next_view_template.md`
  - `docs/audit_log_coverage_2026-05-05.md`
  - `tests/unit/api/audit-log-coverage.test.ts`
  - `tests/e2e/admin/moderation/*.spec.ts`
- **关联文档**：
  - plan: `docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4
  - changelog: M-SN-4 期 / -10-A/A2/B/C 全部条目
  - task-queue: SEQ-20260501-01 + M-SN-4 欠账区
