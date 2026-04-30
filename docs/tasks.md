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

### CHG-DESIGN-07 7B — KpiCard / Spark 实装 + admin-ui 单测（SEQ-20260429-02 第 7 卡 · 阶段 2/4）

- **状态**：🔄 进行中（7A 已闭环 ✅ — Opus arch-reviewer CONDITIONAL → 2 项必修闭环 → 进入 7B）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **实际开始**：2026-04-30
- **建议主循环模型**：sonnet
- **实际主循环模型**：claude-opus-4-7（继承 session）
- **7A 子代理结论**：spawn `arch-reviewer` (claude-opus-4-7) → CONDITIONAL → 必修 1（KpiCardVariant jsdoc 与类型签名矛盾）+ 必修 2（spark null 行为契约）闭环 → PASS（1 轮）

#### 7A 阶段产出（已落地）

- `packages/admin-ui/src/components/cell/kpi-card.types.ts` — KpiCard Props 契约
- `packages/admin-ui/src/components/cell/spark.types.ts` — Spark Props 契约
- `packages/admin-ui/src/components/cell/index.ts` — type re-export 占位

#### 7B 阶段范围

按 7A 通过的 Props 契约实装 KpiCard / Spark + 写 admin-ui 单测；落地后 spawn 第二轮 arch-reviewer (Opus) review 实装与契约一致性。

#### 7B 文件范围

- `packages/admin-ui/src/components/cell/kpi-card.tsx`（新建）
- `packages/admin-ui/src/components/cell/spark.tsx`（新建）
- `packages/admin-ui/src/components/cell/index.ts`（追加组件命名导出）
- `packages/admin-ui/src/index.ts`（追加 `export * from './components/cell'`）
- `tests/unit/components/admin-ui/cell/kpi-card.test.tsx`（新建 — 6 variant 渲染 / data-source mock 标记 / spark slot null fallback / a11y）
- `tests/unit/components/admin-ui/cell/spark.test.tsx`（新建 — 0 / 1 / N 数据点 / line vs area / 颜色注入 / a11y）

#### 7B 不在范围

- DashboardClient / 业务卡片实装（7C）
- api.ts ModerationStats 类型修正（7C 步骤 1）
- visual baseline 截图入库（7D）

#### 7A 关键审议要点（落地 7B 时复用）

P0 必查 6 项全部 PASS（含 P0-1 4 张 KPI variant 覆盖 / P0-2 维度分离 / P0-3 ReactNode slot / P0-4 dataSource 上提 / P0-5 零图标库 / P0-6 spark null 契约 — 必修 2 闭环后 PASS）

7B 实装 SHOULD 项（不阻塞但建议落实）：
- P1-3 a11y：value 为非 string ReactNode 且 ariaLabel 未传时，dev 环境 `console.warn` 提示
- P2-1 固定 data attribute：KpiCard 根节点固定渲染 `data-kpi-card`；Spark 根节点固定渲染 `data-spark`（与 admin-ui state primitives `data-empty-state` 风格对齐）

#### 验收标准

- typecheck / lint / verify:token-references / verify:admin-guardrails 全绿
- admin-ui 单测覆盖率：KpiCard / Spark 各 ≥ 12 case（6 variant + 边界数据 + a11y + null fallback）
- arch-reviewer (claude-opus-4-7) 第二轮 review 实装与 7A 契约一致性 PASS（CONDITIONAL ≤ 3 轮闭环）

#### 推进顺序

1. KpiCard 实装 + 单测（参考 reference §4.3 + §5.1.2 4 张 KPI 蓝图）
2. Spark 实装 + 单测（60×18 svg + line/area + 0/1/N 边界）
3. 追加 cell/index.ts 命名导出 + 根 index.ts re-export
4. typecheck / lint / 单测全绿
5. spawn arch-reviewer (claude-opus-4-7) 审实装与契约一致性
6. CONDITIONAL ≤ 3 轮闭环 → 进入 7C

---
