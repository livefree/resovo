# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

### CHG-SN-9-CW1-B-EP-TEST — Bug-A 单测补齐 follow-up

- **状态**：🔄 进行中
- **任务 ID**：CHG-SN-9-CW1-B-EP-TEST
- **实际开始**：2026-05-25
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无
- **问题理解**：
  - CW1-B-EP 实施了 task 级 cancel（cancelTaskById）+ batch cancel（batchCancelTasks）queries + 两条路由
  - 本卡补齐 queries 7 case + route 6 case + CrawlerRunDetailView 组件 4 case
- **文件范围**：
  - `tests/unit/api/crawler-tasks.test.ts`（扩：+7 case cancelTaskById/batchCancelTasks）
  - `tests/unit/api/routes/admin/crawler-tasks-cancel.test.ts`（新：6 route case）
  - `tests/unit/components/server-next/admin/crawler/CrawlerRunDetailView.test.tsx`（扩：+4 cancel 行为 case）
- **估时**：0.1w

---

## 下次会话恢复入口

（见 task-queue.md CHG-SN-9 序列）
