# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（当前无进行中任务）

---

## 下次会话恢复入口

- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`、`tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`、`tests/e2e/admin.spec.ts` 中仍有 `dailyTime` 字段留在 fixture（extra field，不影响 typecheck；C-2 任务 3k 待执行）
