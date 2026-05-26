# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（空）

---

## 下次会话恢复入口

W3-FIX SEQ 进度（11 commits）：

- HOTFIX-A/B/C ✅
- REDESIGN-A-ADR ✅（ADR-155 🟢 Accepted）
- REDESIGN-A-EP-1A ✅（D-155-1 行内展开 / 3e0495fe）
- REDESIGN-A-EP-1B1 ✅（D-155-4 站点 limit 解锁 / 9302cf95）
- REDESIGN-A-EP-1B2 ✅（D-155-5 AutoCrawlSummaryCard / cbdf2e42）
- REDESIGN-A-EP-1B2-LAYOUT ✅（概览折叠 + 同行排布 / 031be4a6）
- REDESIGN-A-EP-1C-1a ✅（D-155-6 类型契约 + KV 3 路径 / c3d010f7）
- REDESIGN-A-EP-1C-1b ✅（D-155-6 zod + scheduler marks/GC / 96f369f1）
- **REDESIGN-A-EP-1C-2a ✅**（fd02cbf9 / D-155-6 SchedulerConfigDrawer chip 列表 / 待 @livefree 实测 7 路径）

**下一步**（串行）：EP-1C-2b → EP-2 → EP-3。

EP-1C-2b：AutoCrawlScheduleCard + AutoCrawlSummaryCard 多时间显示（2 源 + 2 测试 = 4 项 / sonnet / 依赖 EP-1C-2a 已就绪）

每 EP 完成后必须 @livefree dev server 走读 ≥ 1 次（ADR-155 §8 验收第 4 条）。
