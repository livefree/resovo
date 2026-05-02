# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-01
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-SN-4-04 · admin-ui 共享组件下沉 5 件（D-14） 🚧 进行中（2026-05-02 启动）

- **来源**：M-SN-4 plan v1.4 §8.1（执行序：阶段 A 单卡）
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` v1.1
- **建议主循环**：`claude-sonnet-4-6`（任务卡 + 子方案均建议；本卡量大（≥ 95 unit case + 5 件 Playwright 视觉基线 + arch-reviewer Opus 1–3 轮）但仍属常规组件下沉，sonnet 足以承担）
- **强制子代理**：`arch-reviewer (claude-opus-4-7)` — Props 契约 + DecisionCard 跨层下沉例外（CLAUDE.md 强制升 Opus 第 1 条 + plan §8.1 强制项）

#### 开发前输出（quality-gates.md）

**问题理解**：CHG-SN-4-02 在 `apps/server-next/.../moderation/_client/` 落地 9 文件 mock 三栏页（含 `DecisionCard.tsx`）；下游 -07（审核台前端接入）+ -08（VideoEditDrawer 三 Tab）需要复用 5 件 UI 组件。本卡先把 5 件下沉 `packages/admin-ui/`，冻结 Props 契约后阶段 B（-05/-06）才安全启动。

**根因判断**：
- `BarSignal` / `LineHealthDrawer` 在 plan §3 复用矩阵明列 "M-SN-4 下沉"，无需协议判定
- `RejectModal` / `StaffNoteBar` 满足 admin 子项目 "首次跨 2 视图复用" 规则
- `DecisionCard` 跨应用层下沉（business `apps/server-next` ↔ shared `packages/admin-ui`）= 协议**例外**，依据已写入 ADR-106 草案，本卡内随评审落地为正式 ADR

**方案**：
1. 先起 5 件 `*.types.ts` 提交 arch-reviewer Opus 预审（契约冻结）
2. 评审 PASS / CONDITIONAL ≤ 3 轮闭环后才开始 `*.tsx` 实装
3. 每件 ≥ 19 unit case + Playwright `toHaveScreenshot()` 视觉基线 1 张
4. apps/server-next 5 处 import 切换 + 删除 `_client/DecisionCard.tsx`
5. ADR-106 草案 → 正式 ADR
6. 全量回归：typecheck + lint + unit + visual baseline + admin-ui 不变约束 grep 守门

**涉及文件**（按子方案 §3）：
- 写：`packages/admin-ui/src/components/cell/{bar-signal,decision-card}.{tsx,types.ts}` + `cell/index.ts`（追加 export）
- 写：`packages/admin-ui/src/components/feedback/{line-health-drawer,reject-modal,staff-note-bar}.{tsx,types.ts}` + `feedback/index.ts`（新建子目录）
- 写：`packages/admin-ui/src/index.ts`（追加 `export * from './components/feedback'`）
- 改：`apps/server-next/src/app/admin/moderation/_client/{ModerationConsole,PendingCenter,StagingTabContent,RejectedTabContent}.tsx`（5 处 import 切换）
- 删：`apps/server-next/src/app/admin/moderation/_client/DecisionCard.tsx`
- 测：`tests/unit/components/admin-ui/{cell/{bar-signal,decision-card},feedback/{line-health-drawer,reject-modal,staff-note-bar}}.test.tsx`（≥ 19 case/件 = ≥ 95 case）
- 视觉：5 张 Playwright `toHaveScreenshot()` baseline（位置依现有 visual harness）
- 改：`docs/decisions.md`（ADR-106 草案 → 正式 + 评审记录）
- 改：`packages/design-tokens/src/admin-layout/` 内适配文件（仅当 amber staff-note token 缺失时；优先复用 `--admin-status-warning-*`）

**完成判据**（子方案 §6）：
- typecheck 0 error / lint 0 warning
- unit ≥ 95 case 全绿 / Playwright 视觉基线 5 张落地
- arch-reviewer Opus PASS / CONDITIONAL ≤ 3 轮闭环
- grep 守门 0 命中：
  - `from 'lucide-react'` in `packages/admin-ui/src/components/{cell,feedback}/`
  - `#[0-9a-fA-F]{3,8}` in `packages/admin-ui/src/components/{cell,feedback}/`
- `apps/server-next` 5 处 import 切换后 `next build` 0 error
- ADR-106 草案 → 正式
- commit trailer 含 `Subagents: arch-reviewer (claude-opus-4-7)`

#### 子代理调用计划

`arch-reviewer (claude-opus-4-7)` — 审议 6 项（子方案 §5）：
1. 5 件 Props 契约最小化原则（业务概念无泄漏）
2. DecisionCard 跨层下沉例外审议
3. 零图标库依赖一致性
4. Edge Runtime 兼容
5. 设计 token 引用完整性
6. `packages/types` 消费稳定性

#### 执行模型

- 主循环模型：`claude-sonnet-4-6`（启动时人工 `--model claude-sonnet-4-6`）
- 子代理模型：`claude-opus-4-7`（arch-reviewer）

---
