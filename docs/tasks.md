# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（空）

---

## 下次会话恢复入口

W3-FIX SEQ 进度（6 commits）：

- HOTFIX-A ✅（commit d79769cc）
- HOTFIX-B ✅（commit 0a0cc4e8）
- HOTFIX-C ✅（commit b1491aea）
- REDESIGN-A-ADR ✅（commit 3f30e02b / ADR-155 🟢 Accepted）
- REDESIGN-A-EP-1A ✅（commit 3e0495fe / D-155-1 行内展开 / 实测 6 路径 PASS）
- **REDESIGN-A-EP-1B1 ✅**（待 commit / D-155-4 站点 limit 解锁 / 待 @livefree 实测 3 路径）

**下一步**（串行）：EP-1B2 → EP-1C-1 → EP-1C-2 → EP-2 → EP-3。

EP-1B2：D-155-5 AutoCrawlSummaryCard 显式入口卡（3 文件：新建 + CrawlerClient 嵌入 + 测试新建 / sonnet / 独立 / AMENDMENT 落盘 ADR-152 line ~14007 之前）

每 EP 完成后必须 @livefree dev server 走读 ≥ 1 次（ADR-155 §8 验收第 4 条）。
