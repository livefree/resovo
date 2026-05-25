# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 16+ commit / ADR-150 阶段 1-4 EP-3-A 6 子卡全闭环 / **arch-reviewer Opus 二次评审 A- / PR ready** / 待 @livefree 决策启动 EP-3-B sub B 或本会话收尾）

---

## 下次会话恢复入口

**EP-3-A 全闭环 PR ready**：arch-reviewer Opus 二次评审 A- / 6 commits PR 可合入

**下一步选项**：
1. **启动 EP-3-B sub B**（SubmissionsListClient + UsersListClient）+ 顺手 advisory:
   - RR-EP3A-1 audit fail-fast 单测补 1 case（reviewer 二次评审建议）
   - Y-EP3A-2 admin-module-template.md 备注（hasAutoFilter 视觉惊讶）
   - Y-EP3A-3 column-visibility.ts D-150 fallback 注释
   - 工时 ~0.4w（sub B 0.3w + advisory 0.1w）
2. **EP-3-C/D/E/F/G 后续 5+ 表格批量迁移**（~1.5w / 完成 ADR-150 阶段 4 全部 12 消费方）
3. **本会话收尾**（EP-3-A 已 PR ready / 下次会话推进 EP-3-B+）

**修订建议**：仍可在 sub 2 PATCH 范围内回归（如 RR-EP3A-1 audit fail-fast 单测想本卡补）

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3（矩阵 popover 3 问题修复）
2. `e930411b` EP-4.5-HOTFIX-4（disabled switch hint 可见化）
3. `d952afd5` ADR-150 起草（Opus 子代理 / 6 D-150-× / A− CONDITIONAL PASS）
4. `1908ac39` ADR-150 status Proposed → Accepted（@livefree 仲裁）
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI（Opus 双 review / 4 fix）
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod + 6 表白名单（Opus PASS / 三重 SQL 注入防御）
7. `4997515c` **EP-3-A sub 1** CrawlerRunsView 迁 D-149-15 → D-150（**首次用户可走读效果**）
8. `b0371950` **EP-3-A sub 1 HOTFIX** popover 6 类走读反馈回归
9. `8fc42d6b` **EP-3-A sub 1 EXTEND** CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展
10. `ea5c2598` **EP-3-A sub 2** AuditClient toolbar 6 控件迁列内 filterable + filtersMap 派生
11. `68a8efe6` **EP-3-A sub 2 EXTEND** EnumValueList 空退化 BUG + 2 表格 sort 全栈打通
12. `b80c9e7c` **EP-3-A sub 2 PATCH** arch-reviewer Opus 评审消解（R-EP3A-1/2 + Y-EP3A-1）/ 二次评审 **A-**

**EP-3-A 整体**：+3700+ lines / 75+ 新单测 / 0 回退 / 全质量门禁全过 / **arch-reviewer Opus A-** / **PR ready**。
