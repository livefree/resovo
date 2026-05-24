# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-23

---

## 进行中任务

### [CHG-SN-9-DT-HEADER-REDESIGN-EP-1] DataTable 矩阵原语 + Props 契约 deprecate（EP-1 / 5 段渐进首段）

- **状态**：🔄 进行中
- **创建时间**：2026-05-23
- **执行模型**：claude-opus-4-7（主循环）
- **子代理**：本卡范围内零强制 Opus（API 契约决策已在 ADR-149 D-149-10 完成 / 实施层代码 + 单测主循环可承担）；commit 前可选 spawn arch-reviewer 做独立 code review（CLAUDE.md §模型路由 #6 高风险 PR 评审）
- **背景**：ADR-149 ✅ Accepted（docs/decisions.md line 11942 / @livefree PASS 2026-05-23）；EP-1 是 5 段渐进的首段，目标"矩阵原语就位 + 旧 prop deprecate 不破 typecheck"，为 EP-2/3 让路
- **依赖**：ADR-149 ✅
- **文件范围**：
  - `packages/admin-ui/src/components/data-table/types.ts` — 4 删 prop 改为 @deprecated（保 noop 实现）+ 新增 3 prop（`columnTriggerVisibility` / `headerMenuTriggerPosition` / `ColumnMenuConfig.filterSummary`）+ JSDoc 完整
  - `packages/admin-ui/src/components/data-table/column-matrix-menu.tsx` — **新建**（~400 行 / portal + ESC + 点外关闭 + focus trap + ARIA dialog/grid/row/cell roles + 5 键盘语义 + 焦点回流）
  - `packages/admin-ui/src/components/data-table/dt-styles.tsx` — 新增矩阵 popover 样式（表格内表格 / switch toggle / radio button / 灰化态 / 锁定态 / max-width 200px ellipsis）
  - `packages/admin-ui/src/components/data-table/index.ts` — export ColumnMatrixMenu
  - `packages/admin-ui/src/components/data-table/__tests__/column-matrix-menu.test.tsx` — **新建 ~35 单测**（覆盖维度详 ADR-149 §7）
- **本卡范围**：
  - ✅ Props 契约改造（types.ts 删 4 deprecate + 新增 3）
  - ✅ 矩阵原语组件实装（column-matrix-menu.tsx）
  - ✅ 样式 + a11y 完整
  - ✅ 35 单测全 PASS
  - ❌ **不动 data-table.tsx 主组件 toolbar 渲染**（EP-3 才删旧入口）
  - ❌ **不动 header-menu.tsx**（EP-2 才改 anchor）
  - ❌ **不动任何消费方**（EP-4-A/B 才迁移）
- **质量门禁**（必跑）：
  - `npm run typecheck` ✅（中间态：旧 prop 仍工作 / 新 prop 添加）
  - `npm run lint` ✅
  - `npm run test -- --run` ✅（35 新 + 现存 154 全 PASS）
  - `npm run verify:adr-contracts` ✅（零端点变化）
- **验收**：
  - column-matrix-menu.tsx 在隔离测试环境（如 `apps/server-next/src/app/admin/dev/components/`）可独立预览
  - 35 单测覆盖 ADR-149 §7 列表（a11y + 键盘 + 多值折叠 + 焦点回流）全部通过
  - 不引入 ESLint warning
  - 旧 4 prop @deprecated JSDoc 完整 / 9 消费方未删时 typecheck 不破裂
- **完成判定**：
  - EP-1 完成 ≠ 用户可见任何变化（矩阵 popover 此时不挂任何触发器；仅作为新组件就位）
  - 用户走读不在 EP-1 范围（EP-4-C 才做）
  - EP-1 commit 后才启动 EP-2
- **关联 SEQ**：SEQ-20260524-01 第 1 序列任务 #1 第 EP-1 子卡
- **ADR**：ADR-149 D-149-1..12 / R-149-7 a11y / R-149-8 EP 序列 / R-149-9 测试 surface
