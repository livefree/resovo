# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（当前无进行中任务）

---

## 下次会话恢复入口

- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`、`tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`、`tests/e2e/admin.spec.ts` 中仍有 `dailyTime` 字段留在 fixture（extra field，不影响 typecheck；C-2 任务 3k 待执行）
- **CrawlerClient 时区 flaky**：`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` 第 1086 行时区/HH:MM 断言并行跑偶 fail，单独跑 66/66 PASS
- **CHG-354 SPLIT-D 待立卡**（Wave 1 完成后规划）：ModerationConsole ≤ 500 行
