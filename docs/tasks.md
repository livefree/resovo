# Resovo（流光） — 任务看板



> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-18
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

### TOKEN-01 — `packages/design-tokens` 目录骨架 + 构建工具选型 ADR
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M1
- **建议模型**：opus
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：arch-reviewer (claude-opus-4-6)（ADR-032 构建工具选型 + package exports 契约决策）
- **实际开始**：2026-04-18 00:00
- **文件范围**：
  - 新增 `packages/design-tokens/package.json`
  - 新增 `packages/design-tokens/tsconfig.json`
  - 新增 `packages/design-tokens/src/index.ts`
  - 修改根 `package.json`（workspaces 声明）
  - 追加 `docs/decisions.md` — ADR-032（Token 构建工具选型）
- **完成备注**：_（完成后填写）_

