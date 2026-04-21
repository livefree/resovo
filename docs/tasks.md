# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-21
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## M5-PAGE-HEADER-01 — Header/Footer 重塑

- **状态**：🔄 进行中
- **开始时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **文件范围**：
  - `apps/web-next/src/components/layout/Nav.tsx`（修改：scroll-collapse、接入 MegaMenu、Nav.Skeleton 导出）
  - `apps/web-next/src/components/layout/Footer.tsx`（修改：Footer.Skeleton 导出）
  - `apps/web-next/src/components/layout/MegaMenu.tsx`（新增：hover 120ms/240ms 时序 + 键盘可达）
  - `tests/unit/web-next/Header.test.tsx`（新增）
- **备注**：任务卡写的 Header.tsx 实际文件为 Nav.tsx，功能一致，不重命名（layout.tsx 挂点不变）
