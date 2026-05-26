# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（空）

---

## 下次会话恢复入口

W3-FIX SEQ 进度（5 commits）：

- HOTFIX-A ✅（commit d79769cc / 实测 1/2/3/5/6 PASS）
- HOTFIX-B ✅（commit 0a0cc4e8 / 实测 7/8 PASS）
- HOTFIX-C ✅（commit b1491aea / 实测 9/10/11 PASS）
- REDESIGN-A-ADR ✅（commit 3f30e02b / ADR-155 🟢 Accepted）
- **REDESIGN-A-EP-1A ✅**（待 commit / D-155-1 行内展开 / 5093/5093 PASS / 待 @livefree 实测 6 路径）

**下一步**（串行）：EP-1B → EP-1C-1 → EP-1C-2 → EP-2 → EP-3。

EP-1B：D-155-4 站点 limit 解锁（8/20/all + safeLimit 20→50）+ D-155-5 AutoCrawlSummaryCard 显式入口卡（4 文件，sonnet，独立）

每 EP 完成后必须 @livefree dev server 走读 ≥ 1 次（ADR-155 §8 验收第 4 条）。
