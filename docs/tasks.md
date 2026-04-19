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

### TOKEN-12 — Token Playground 页面（dev 环境走查载体）
- **状态**：🔄 进行中
- **来源序列**：SEQ-20260418-M1
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6（主循环）
- **子代理调用**：无
- **实际开始**：2026-04-18 22:15
- **文件范围**：
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/layout.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/page.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/_components/PrimitivePanel.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/_components/SemanticPanel.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/_components/ComponentPanel.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/_components/BrandSwitcher.tsx`
- **完成备注**：_（完成后填写）_
