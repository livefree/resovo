# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-27

---

## 进行中任务

（空 — CHG-351-A 已完成 / 转 changelog 归档 / 下一卡 CHG-351-B 从 task-queue.md 取入）

---

## 下次会话恢复入口

- **C-2 残留**：`tests/unit/components/server-next/admin/AutoCrawlScheduleCard.test.tsx`、`tests/unit/components/server-next/admin/crawler/SchedulerConfigDrawer.test.tsx`、`tests/e2e/admin.spec.ts` 中仍有 `dailyTime` 字段留在 fixture（extra field，不影响 typecheck；C-2 任务 3k 待执行）
- **CrawlerClient 时区 flaky**：`tests/unit/components/server-next/admin/crawler/CrawlerClient.test.tsx` 第 1086 行时区/HH:MM 断言并行跑偶 fail，单独跑 66/66 PASS
- **StagingTable.test.tsx:236 flaky**（CHG-351-A 主循环新发现）：并行跑偶 fail（site-key-filter-select fireEvent），单跑 13/13 PASS；同 CrawlerClient flaky 模式
- **CHG-354 SPLIT-D 待立卡**（Wave 1 完成后规划）：ModerationConsole ≤ 500 行
- **Wave 1 进度**（详见 task-queue.md `SEQ-20260527-MOD-WAVE1`）：8/9 完成（CHG-351 三子卡 + CHG-352 effective_score）→ 当前下一卡 **CHG-353**（route-labeling Phase 1 前台主题渲染 / SourceBar.tsx + line-display-name.ts + 节气/NATO 主题）→ Wave 1 验收
- **audit 4 真源 advisory follow-up**：本卡发现 `crawler_task.*` + `image_health.*` 4 项 actionType 在 union (1) + REQUIRED (4) 已含，但 AuditLogService.ACTION_TYPES (2) + EXPECTED_ACTION_TYPES (3a) 未同步（set-equal 守卫两边自洽 drift 而 PASS）；隐式违反 4 真源严格性；建议独立 follow-up 卡修复（不在 CHG-351-A 范围）
