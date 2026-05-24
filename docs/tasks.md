# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

### CHG-SN-9-DT-AUTOFILTER-EP-1（ADR-150 阶段 2 / 共享 DataTableAutoFilter UI）
- **任务来源**：ADR-150 status 🟢 Accepted（@livefree 2026-05-24 仲裁通过 PASS + D-150-5 默认 false + 阶段 4 严格串行）
- **范围**：共享 DataTable 内置 4 种过滤 UI（Google Sheets 三段布局 popover / 数据类型推导 hook / types.ts AutoFilterColumnFields union 类型守卫 / 35 单测）
- **建议模型**：opus（共享组件 API 契约改动 / CLAUDE.md §模型路由强制 #1）
- **执行模型**：claude-opus-4-7（主循环）
- **子代理调用**：
  1. **步骤 1**：spawn arch-reviewer Opus 设计 AutoFilterColumnFields union API + 推导算法 + Google Sheets 三段布局 props 契约（必须 Opus 评审才能落地 / ADR-103 第 6 次 AMENDMENT 候选）
  2. **步骤 4**：spawn arch-reviewer Opus 在 PR 前独立 review
- **文件范围**（阶段 2 仅前端共享 UI / 不动后端 / 不动消费方）：
  - `packages/admin-ui/src/components/data-table/types.ts`（AutoFilterColumnFields union 扩展）
  - `packages/admin-ui/src/components/data-table/data-table-auto-filter.tsx`（新建 / 替代 header-menu filterContent slot 部分）
  - `packages/admin-ui/src/components/data-table/use-filter-kind-inference.ts`（新建 / 数据类型推导 hook / 5 边界 + SSR fallback）
  - `packages/admin-ui/src/components/data-table/header-menu.tsx`（接入 Google Sheets 三段布局 / 不删 filterContent slot 逃生口）
  - `packages/admin-ui/src/components/data-table/dt-styles.tsx`（新增 popover 三段布局 CSS）
  - `tests/unit/components/admin-ui/table/data-table-auto-filter.test.tsx`（新建 / ~35 单测 / 数据类型推导 5 边界 + 三段布局 + 排序+过滤+OK + enum 双轨 + 多选+搜索+全选 + 取消恢复初值 + a11y + 键盘 5 语义）
- **预算**：~0.6w
- **依赖**：ADR-150 ✅ commit `d952afd5`
- **完成条件**：
  - AutoFilterColumnFields union 类型守卫编译期防忘 filterFieldName
  - 数据类型推导 hook 5 边界全通过
  - Google Sheets 三段布局 popover 渲染 + 取消/应用按钮
  - 4 种 filterKind UI 全实装（enum 多选 / text / number / date）
  - 35 单测全 PASS
  - admin-ui/table 旧 395 单测零回退
  - verify-adr-contracts + verify-style-shorthand 全过
- **后续**：阶段 3 后端通用 distinct 端点 + DtFiltersSchema（~0.5w）→ 阶段 4 串行 7 消费方迁移子卡（2.1w）→ 阶段 5 文档 + e2e + 走读（0.4w）
- **阶段 4 严格串行约束**（@livefree 仲裁锁定）：EP-3-A → EP-3-B → ... → EP-3-G 不可两两并行 / 每子卡独立 typecheck + dev server 走读 + Opus PR review
