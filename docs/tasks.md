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

### CHG-DESIGN-08 8A — 视频库列重构 + 32×48 thumb + page__head（SEQ-20260429-02 第 8 卡 · 阶段 1/3）

- **状态**：🔄 待启动（CHG-DESIGN-12 12A ✅ + 12B ✅ 全部完成 → 5 cell 共享组件就位 → 进入 CHG-DESIGN-08）
- **关联序列**：SEQ-20260429-02
- **创建时间**：2026-04-30
- **建议主循环模型**：sonnet
- **前置依赖**：CHG-DESIGN-12（5 cell 共享组件全部就位）+ CHG-DESIGN-02（DataTable Step 7A API 已就位）

#### CHG-DESIGN-12 累计闭合标志

- 12A ✅ 5 个 .types.ts 契约 + arch-reviewer (Opus) PASS + 2 处 Codex stop-time fix（VisChip enum drift / 真源优先级）
- 12B ✅ 5 个 .tsx 实装 + 72 case 单测 + arch-reviewer (Opus) **第二轮 PASS 直接通过** + 1 处 P1-1 jsdoc 措辞顺修
- cell 共享组件总览 7 个：KpiCard / Spark / Pill / DualSignal / VisChip / Thumb / InlineRowActions
- 单测累计 129 case（KpiCard 37 + Spark 20 + Pill 18 + DualSignal 13 + VisChip 10 + Thumb 17 + InlineRowActions 14）

#### 8A 阶段范围（消费方落地）

按 reference §6.1 视频库标杆列规范，重构 VideoListClient 列定义；接入 12B 落地的 5 cell + KpiCard/Spark 风格。

#### 8A 推进顺序

1. 重构 `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` 列定义按 §6.1 10 列：
   `_select`(40) / `thumb`(60, 32×48 竖版) / `title`(flex pinned, 标题+meta) / `type`(90, Pill) /
   `sources`(100, dot+文案) / `probe`(140, DualSignal) / `image`(100, P0 Pill) / `visibility`(120, VisChip) /
   `review`(90, 单 Pill) / `actions`(170, InlineRowActions ×5: 编辑/前台/播放/补源/上架(primary))
2. 删除 `VideoStatusIndicator` + `VideoTypeChip`（被共享 Pill / VisChip 取代；grep 无外部引用后删除）
3. 补 `page__head`（标题"视频库" / sub "X 条视频..." / 双 actions: 导出 CSV / 手动添加视频）
4. 封面 64×36 横图改 32×48 竖版（直接消费 `<Thumb size="poster-sm">`）
5. typecheck / lint / verify scripts 全绿

#### 8A 文件范围

- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（列定义重构 + page__head）
- `apps/server-next/src/lib/videos/columns.ts`（如需调整 ColumnDescriptor）
- `apps/server-next/src/components/admin/shared/VideoStatusIndicator.tsx`（删除 / 删用法）
- `apps/server-next/src/components/admin/shared/VideoTypeChip.tsx`（删除 / 删用法）

#### 8A 不在范围

- saved views（个人/团队） — 8B
- 表头菜单 / flash row 接入 — 8B
- visual baseline + e2e + Playwright MCP 截图 — 8C

#### 8A 验收标准

- typecheck / lint / verify:token-references / verify:admin-guardrails 全绿
- VideoListClient 渲染 10 列结构与 §6.1 标杆完全一致
- VideoStatusIndicator / VideoTypeChip 全仓 grep 0 残留
- 单测：现有 cell 129 case 不回归 + dashboard 24 case 不回归

#### 后续阶段预览（参考用，非本卡范围）

- **8B**：saved views（个人/团队）+ 表头菜单 + flash row + bulk action（DataTable Step 7A API 已就位）
- **8C**：unit smoke + e2e dashboard.spec.ts 风格守门 + Playwright MCP visual baseline 入库到 `tests/visual/videos/`

---
