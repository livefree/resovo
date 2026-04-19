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

### TOKEN-13 — globals.css 硬编码变量迁移 + ESLint 升级 error
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M1
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：无
- **实际开始**：2026-04-18 22:35
- **文件范围**：
  - 修改 `apps/web/src/app/globals.css`（主路径，task-queue 中 styles/globals.css 路径有误）
  - 修改引用了硬编码变量的所有文件（全文搜索定位）
  - 修改 `apps/web/.eslintrc.*`（升级为 error）
- **完成备注**：_（完成后填写）_
