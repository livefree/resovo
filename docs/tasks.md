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

### CHG-DESIGN-12 12A — 5 个 cell 共享组件 Props 契约（SEQ-20260429-02 第 12 卡 · 阶段 1/2）

> CHG-DESIGN-08 + 12 联合推进（CHG-DESIGN-08 视频库视觉对齐依赖 CHG-DESIGN-12 cell 共享组件）；按 5 阶段顺序：12A → 12B → 8A → 8B → 8C。

- **状态**：🔄 进行中
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **实际开始**：2026-04-30
- **建议主循环模型**：sonnet（任务卡建议）
- **实际主循环模型**：claude-opus-4-7（继承 session）
- **子代理调用**：spawn `arch-reviewer` (claude-opus-4-7) 审 5 个 Props 契约（强制；S 级模块 Opus 子代理硬约束；CONDITIONAL ≤ 3 轮闭环；REJECT = BLOCKER）

#### 12A 阶段范围（设计 only，无业务代码）

按 reference.md §6.1 视频库标杆 + §10 业务复合组件清单，定义 5 个 cell 共享组件 Props 契约：

1. **DualSignal**：探测/播放双信号（reference §6.1 probe 列 / §6.2 探测+播放 / §6.3 signal 列）
2. **VisChip**：可见性 chip（reference §6.1 visibility 列 / 双状态 visibility + review 复合）
3. **Thumb**：缩略图（32×48 竖版 / 64×36 横版 / 28×28 圆角；reference §10「视频类素材默认 32×48 poster」）
4. **Pill**：通用状态/类型 pill（reference §4.2 必含 6px dot + soft 背景）
5. **InlineRowActions**：行内 xs 操作按钮组（reference §6.1 actions 列 / hover 时浮现 / primary variant 强调）

#### 12A 文件范围

- `packages/admin-ui/src/components/cell/dual-signal.types.ts`（新建）
- `packages/admin-ui/src/components/cell/vis-chip.types.ts`（新建）
- `packages/admin-ui/src/components/cell/thumb.types.ts`（新建）
- `packages/admin-ui/src/components/cell/pill.types.ts`（新建）
- `packages/admin-ui/src/components/cell/inline-row-actions.types.ts`（新建）
- 不改 `cell/index.ts`（12B 实装时再追加 type re-export）

#### 12A 不在范围

- 5 个 cell 实装（.tsx）— 12B
- 单测 — 12B
- 视频库列重构 — 8A
- saved views 接入 — 8B
- visual baseline — 8C

#### 12A 验收标准

- typecheck 全 7 workspace 通过
- arch-reviewer (claude-opus-4-7) 审核 PASS（CONDITIONAL ≤ 3 轮闭环）
- Props 契约满足：
  - DualSignal 覆盖 §6.1/§6.2/§6.3 probe + render 双状态语义
  - VisChip 覆盖 §6.1 visibility + review 复合 + 设计稿 visibility_status 三态（public/internal/private）
  - Thumb 覆盖 §10 三种规格（32×48 竖版 / 64×36 横版 / 28×28 圆角）
  - Pill 覆盖 §4.2 dot + soft 背景 + 6 状态 variant（neutral/info/ok/warn/danger/accent）
  - InlineRowActions 覆盖 §6.1 actions 列 5 按钮 + primary variant + hover 浮现
  - 与 CHG-DESIGN-07 KpiCard / Spark 共存（5 + 2 = 7 cell 共享组件总览）
- 不引入新依赖（图标库 / 数学库等）

#### 12A 推进顺序

1. 起草 5 个 .types.ts（按 reference §6.1 真源 + §4.2 / §10 / 设计稿 jsx）
2. typecheck 验证不破坏导出
3. spawn arch-reviewer (claude-opus-4-7) 审契约
4. 按子代理结论调整（CONDITIONAL ≤ 3 轮）
5. 任务卡记录子代理 model ID + 结论 → 进入 12B

#### 后续阶段预览（参考用，非本卡范围）

- **12B**：5 个 cell 实装（.tsx）+ 单测（每组件 ≥ 12 case）+ 第二轮 arch-reviewer review
- **8A**：VideoListClient 列重构（按 §6.1 标杆切 10 列结构 + 封面 32×48 + page__head）
- **8B**：saved views（个人/团队）+ 表头菜单 + flash row 接入（DataTable Step 7A API 已就位）
- **8C**：unit smoke + e2e dashboard.spec.ts 风格守门 + Playwright MCP visual baseline 入库到 `tests/visual/videos/`

---
