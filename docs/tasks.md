# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-29
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

**任务 ID**：CHG-DESIGN-01
**标题**：Token completeness 修复（清理未定义引用 + 补缺 + CI 校验脚本）
**状态**：🔄 进行中
**开始时间**：2026-04-29
**执行模型**：claude-opus-4-7
**子代理调用**：无（如需 token 命名层裁决再 spawn arch-reviewer）

**所属序列**：SEQ-20260429-02（设计稿对齐改造）
**关联文档**：`docs/designs/backend_design_v2.1/reference.md` §3.6 + §11 第 1 步

**目标**：

1. 清理已知未定义 token 引用：`--accent-subtle / --bg-subtle / --bg-surface-hover / --state-error / --accent-on`
2. 补建设性 token：`--accent-soft / --accent-border / --bg-surface-popover / --scrollbar-size`，以及 `.pulse` keyframe + class
3. 新增 token 引用校验脚本（CI 卡门，未定义 → 报错）

**文件范围**：

- `packages/design-tokens/src/css/tokens.css`（补 token 别名）
- `packages/design-tokens/src/semantic/`（补 surface-popover 等角色）
- `packages/design-tokens/src/admin-layout/`（补 admin 专属 token）
- `packages/design-tokens/build.ts`（如需 token build 改动）
- `packages/admin-ui/src/components/data-table/data-table.tsx`（替换 `--accent-subtle` / `--bg-subtle`）
- `packages/admin-ui/src/components/data-table/filter-chip.tsx`（替换 `--accent-subtle`）
- `packages/admin-ui/src/components/dropdown/`（替换 `--state-error` / `--bg-surface-hover`）
- `packages/admin-ui/src/components/state/`（替换 `--state-error`）
- `packages/admin-ui/src/shell/sidebar.tsx`（替换 `--accent-on`，如出现）
- `packages/admin-ui/src/shell/admin-shell-styles.tsx`（如需注入 `.pulse` 全局类）
- `scripts/verify-token-references.mjs`（新建：扫描 admin-ui / server-next 引用 vs token 输出 diff）
- `package.json` / CI 配置（接入校验脚本）

**验收要点**：

- `grep -rn "--accent-subtle\|--bg-subtle\|--bg-surface-hover\|--state-error\b\|--accent-on\b" packages apps` 全仓库 0 命中（除注释）
- `node scripts/verify-token-references.mjs` 退出码 0
- `npm run typecheck` ✅
- `npm run lint` ✅
- `npm run test -- --run` ✅
- 视觉无回归：DataTable selected 行 / FilterChip active / Dropdown 错误态 三处可见且正确染色

**备注**：无

---
