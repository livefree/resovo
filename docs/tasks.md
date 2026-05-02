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

> 当前无进行中任务。CHG-SN-4-04 于 2026-05-02 完成（arch-reviewer (claude-opus-4-7) 2 轮 PASS + 116 case 全绿 + 5 件下沉就位 + ADR-106 转 accepted），详见 `docs/changelog.md`。
>
> 下一张可入队任务（M-SN-4 阶段 B 双轨已解锁）：
> - CHG-SN-4-05（后端 API：8 新端点 + 4 改端点 + 058a schema patch）
> - CHG-SN-4-06（apps/worker 新建 + SourceHealthWorker Level 1+2）
>
> 入队规则：先读 `docs/task-queue.md` BLOCKER 段（无）→ 按上述任意一张写入本文档卡片再执行（详见 `docs/rules/workflow-rules.md`）。

---
