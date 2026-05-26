# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-26

---

## 进行中任务

（空）

---

## 下次会话恢复入口

W3-FIX SEQ 进度（commits 4 个）：

- HOTFIX-A ✅（commit d79769cc / 实测 1/2/3/5/6 PASS）
- HOTFIX-B ✅（commit 0a0cc4e8 / 实测 7/8 PASS）
- HOTFIX-C ✅（commit b1491aea / 实测 9/10/11 PASS）
- REDESIGN-A-ADR ✅（ADR-155 🟢 Accepted / arch-reviewer Opus A− CONDITIONAL → 等同 A / EP 拆 6 子卡）

**下一步**：启 EP 实施卡（按依赖顺序）。建议先做 EP-1A（D-155-1 行内展开 / 独立卡 / 估时 0.15w）。或并行启 EP-1A + EP-2（互不依赖）。

EP 拆分（task-queue.md SEQ-20260526-CRAWLER-W3-FIX 第 5-7 项）：
- EP-1A：D-155-1 行内展开（3 文件，sonnet，独立）
- EP-1B：D-155-4 limit 解锁 + D-155-5 summary 卡（4 文件，sonnet，独立）
- EP-1C-1：D-155-6 后端契约 + scheduler（5 文件，sonnet，独立）
- EP-1C-2：D-155-6 前端 UI（3 文件，sonnet，依赖 EP-1B + EP-1C-1）
- EP-2：D-155-2 topbar 合并（8 文件，sonnet，**强制 Opus arch-reviewer trailer + 双源镜像审查**）
- EP-3：D-155-3 Gantt 三段窗（5 文件，sonnet，依赖 HOTFIX-A 已闭合）

每 EP 完成后必须 @livefree dev server 走读 ≥ 1 次（ADR-155 §8 验收第 4 条 / 关键洞察 #1 ADR-149 §7 反面教材）。
