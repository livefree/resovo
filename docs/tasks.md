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

### TOKEN-14 — 后台 Token 编辑器 MVP（只读预览）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M1
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：无
- **实际开始**：2026-04-18 23:05
- **文件范围**：
  - 新增 `apps/api/src/routes/admin/design-tokens.ts`
  - 修改 `apps/api/src/server.ts`（注册新路由）
  - 新增 `apps/server/src/app/admin/design-tokens/page.tsx`
  - 新增 `apps/server/src/components/admin/design-tokens/TokenTable.tsx`
  - 新增 `apps/server/src/components/admin/design-tokens/LivePreviewFrame.tsx`
- **完成备注**：_（完成后填写）_
