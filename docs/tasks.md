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

### TOKEN-04 — Component 层组件 Token 定义
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M1
- **建议模型**：opus
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：arch-reviewer (claude-opus-4-6)（8 组件 token 结构契约 + size×state 矩阵 + player 三态设计）
- **实际开始**：2026-04-18 00:00
- **文件范围**：
  - 新增 `packages/design-tokens/src/components/button.ts`
  - 新增 `packages/design-tokens/src/components/input.ts`
  - 新增 `packages/design-tokens/src/components/card.ts`
  - 新增 `packages/design-tokens/src/components/tabs.ts`
  - 新增 `packages/design-tokens/src/components/modal.ts`
  - 新增 `packages/design-tokens/src/components/tooltip.ts`
  - 新增 `packages/design-tokens/src/components/table.ts`
  - 新增 `packages/design-tokens/src/components/player.ts`
  - 修改 `packages/design-tokens/src/components/index.ts`
- **完成备注**：_（完成后填写）_

