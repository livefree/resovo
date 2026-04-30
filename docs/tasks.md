# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-30
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-DESIGN-07 7C — 5 类业务 Card + DashboardClient 重构 + 数据 mock 集中（SEQ-20260429-02 第 7 卡 · 阶段 3/4）

- **状态**：🔄 进行中（7A ✅ + 7B ✅ 全部完成；进入 7C）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **实际开始**：2026-04-30
- **建议主循环模型**：sonnet
- **实际主循环模型**：claude-opus-4-7（继承 session）

#### 7A / 7B 阶段累计产出（已落地）

7A 阶段（contract）：
- `packages/admin-ui/src/components/cell/kpi-card.types.ts` — KpiCard Props 契约
- `packages/admin-ui/src/components/cell/spark.types.ts` — Spark Props 契约
- 子代理：arch-reviewer (claude-opus-4-7) CONDITIONAL → 必修 2 项（jsdoc 矛盾 + spark null 行为）闭环 → PASS（1 轮）
- Codex stop-time review 又命中 4 处契约内部矛盾（variant 映射表命名 / KpiDeltaDirection 与 KpiCardDelta 箭头 / 状态规则 flat / spark 0 数据点 a11y）→ 全部闭环

7B 阶段（实装 + 单测）：
- `packages/admin-ui/src/components/cell/kpi-card.tsx` — KpiCard 功能实装（4 variant + 3 delta direction + spark null 行为 + dataSource attribute + onClick button/div + dev warn for non-primitive value）
- `packages/admin-ui/src/components/cell/spark.tsx` — Spark 功能实装（0/1/N 数据点 + line/area + Y 翻转归一化 + min===max 退化）
- `packages/admin-ui/src/components/cell/index.ts` — 组件命名导出（追加）
- `packages/admin-ui/src/index.ts` — 根 re-export 追加
- `tests/unit/components/admin-ui/cell/kpi-card.test.tsx` — 35 case
- `tests/unit/components/admin-ui/cell/spark.test.tsx` — 20 case
- 子代理：arch-reviewer (claude-opus-4-7) 第二轮 → **PASS 直接通过**（P0 8 项全过 / P1 无 MUST / 仅 1 项 P2 letter-spacing 已顺修）
- 质量门禁：typecheck / lint / verify:token-references (67/322) / 2665 单测全绿（+55 cell）

#### 7C 阶段范围

按 7B PASS 的共享组件落地 5 类业务 Card + dashboard-data.ts mock 集中 + DashboardClient 重构 4 行布局。

**7C 步骤 1**（契约对齐 — 硬前置门，必须先做）：
- 修 `apps/server-next/src/lib/videos/api.ts` 的 `ModerationStats` 接口为后端真实契约 `{ pendingCount: number; todayReviewedCount: number; interceptRate: number | null }`（当前 `pendingReview / published / rejected / total` 4 字段全错）
- grep 全仓 `pendingReview` / `published` / `rejected`（在 ModerationStats 上下文）的引用面：当前已知 `apps/server-next/src/app/admin/_client/DashboardClient.tsx` + `tests/e2e/admin/videos.spec.ts` mock；逐处迁移到正确字段

**7C 步骤 2**（派生 DashboardStats 类型）：
- 在 `apps/server-next/src/lib/dashboard-data.ts` 定义 `DashboardStats` 类型（mock + live 混合）
- live 字段：从 `ModerationStats` 派生（如 KPI「待审 / 暂存」= `pendingCount + mockStaging`）
- mock 字段：标注 `data-source="mock"` + follow-up `STATS-EXTEND-DASHBOARD`

**7C 步骤 3**（5 类业务卡 + DashboardClient 重构 + 删 StatCard 占位）

#### 7C 文件范围

- `apps/server-next/src/lib/videos/api.ts`（修：ModerationStats 类型修正）
- `apps/server-next/src/lib/dashboard-data.ts`（新建：mock 类型 + deterministic 数据 + DashboardStats 派生）
- `apps/server-next/src/components/admin/dashboard/AttentionCard.tsx`（新建）
- `apps/server-next/src/components/admin/dashboard/WorkflowCard.tsx`（新建）
- `apps/server-next/src/components/admin/dashboard/MetricKpiCardRow.tsx`（新建：4 张 MetricKpiCard 一组件）
- `apps/server-next/src/components/admin/dashboard/RecentActivityCard.tsx`（新建）
- `apps/server-next/src/components/admin/dashboard/SiteHealthCard.tsx`（新建）
- `apps/server-next/src/app/admin/_client/DashboardClient.tsx`（重写：4 行布局 + page__head + 删 StatCard 占位）
- `tests/unit/components/server-next/admin/dashboard/DashboardClient.test.tsx`（新建：3 case unit smoke）
- `tests/e2e/admin/dashboard.spec.ts`（新建：3 stats 路径 e2e smoke）
- 不动：admin layout / shell / sidebar / topbar

#### 7C 自动化 regression gate（缺一项 = 7C 未完成）

- unit smoke 三 case（接口完整 / 字段缺失 / 接口失败）
- e2e smoke 三 stats 路径 + 200 完整路径强断言 4 张 KPI `[data-card-value]` 非破折号
- 删 StatCard 前 grep 全仓确认无 `data-stat-card` / `import { StatCard }` 残留
- 断言收紧到 `[data-card-value]` / `[data-source="mock"]`，**不做**整页 textContent grep（避免误伤 page__head em-dash 文案）

#### 验收标准

- typecheck / lint / verify:token-references / verify:admin-guardrails 全绿
- 单测：现有 2665 不回归 + 新增 unit smoke case 全绿
- e2e：3 stats 路径 + 200 完整强断言全绿
- 9 项视觉对照清单（page__head / 1.4fr-1fr / repeat(4,1fr) / 1fr-1fr / AttentionCard / WorkflowCard / MetricKpiCard 规格 / RecentActivityCard / SiteHealthCard）— 7D 验收

#### 推进顺序

1. **步骤 1**：修 api.ts ModerationStats 类型 + grep 全仓迁移错误字段引用面（DashboardClient + videos.spec.ts mock）
2. **步骤 2**：dashboard-data.ts 定义 DashboardStats（mock + live 混合）+ deterministic mock 数据集中
3. **步骤 3**：5 类业务卡实装（AttentionCard / WorkflowCard / MetricKpiCardRow / RecentActivityCard / SiteHealthCard）
4. **步骤 4**：DashboardClient 重构 4 行布局 + page__head + 删 StatCard 占位
5. **步骤 5**：unit smoke 三 case 守门
6. **步骤 6**：e2e smoke 三 stats 路径守门
7. **步骤 7**：grep 验证 StatCard / 错误字段无残留
8. **步骤 8**：typecheck / lint / verify scripts / 单测 / e2e 全绿
9. 进入 7D（visual baseline 入库）

---
