# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-02
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

> 当前无进行中任务。CHG-SN-4-05 + CHG-SN-4-06 已于 2026-05-02 双轨并行集成完成（A / A− 级，详见 `docs/changelog.md`）。并行模式已关闭，恢复单轨工作台。
>
> 下一张可入队任务（M-SN-4 阶段 C 已解锁）：
> - **CHG-SN-4-07**（审核台前端接入：useTableQuery + Gmail 流 + RejectModal/Drawer 接线）— 前置 `ADR-110 ApiResponse 信封策略` 必须先完成（DEBT-SN-4-05-C）
> - **CHG-SN-4-08**（VideoEditDrawer 三 Tab 真实 API）— 与 -07 并行
>
> 入队规则：先读 `docs/task-queue.md` BLOCKER 段（无）→ 按 ADR-110 评审完成后写入卡片再执行。

---
