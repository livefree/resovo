# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 15+ commit / ADR-150 起草 + 阶段 1-4 EP-3-A 全闭环 6 子卡 / sub 2 PATCH 消解 arch-reviewer Opus 2 红线 + 1 黄线 / **EP-3-A 待二次评审 A-** / 待通过后启动 sub B 或本会话收尾）

---

## 下次会话恢复入口

**arch-reviewer Opus 二次评审**：sub 2 PATCH 后整体重审 → 目标评级 A-

**评审通过 → 启动 EP-3-B**：
- sub B（SubmissionsListClient + UsersListClient）— 入口卡顺手做：
  - Y-EP3A-2 admin-module-template.md 备注（hasAutoFilter 加入后视觉惊讶）
  - Y-EP3A-3 column-visibility.ts D-150 fallback 注释
  - N-EP3A-3 前 5 表测试基准（矩阵 popover 兼容性回归）
- 工时 ~0.3w + 0.1w 黄线 = ~0.4w

**评审仍 < A- → 再补 PATCH**：仍在 EP-3-A sub 2 范围内回归（不引入新需求）

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3（矩阵 popover 3 问题修复）
2. `e930411b` EP-4.5-HOTFIX-4（disabled switch hint 可见化）
3. `d952afd5` ADR-150 起草（Opus 子代理 / 6 D-150-× / A− CONDITIONAL PASS）
4. `1908ac39` ADR-150 status Proposed → Accepted（@livefree 仲裁）
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI（Opus 双 review / 4 fix）
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod + 6 表白名单（Opus PASS / 三重 SQL 注入防御）
7. `4997515c` EP-3-A sub 1 CrawlerRunsView 迁 D-149-15 → D-150（**首次用户可走读效果**）
8. `b0371950` EP-3-A sub 1 HOTFIX popover 6 类走读反馈回归
9. `8fc42d6b` EP-3-A sub 1 EXTEND CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展
10. `ea5c2598` EP-3-A sub 2 AuditClient toolbar 6 控件迁列内 filterable + filtersMap 派生
11. `68a8efe6` EP-3-A sub 2 EXTEND EnumValueList 空退化 BUG + 2 表格 sort 全栈打通
12. `<TBD>` EP-3-A sub 2 PATCH arch-reviewer 评审消解（R-EP3A-1 矩阵 popover 桥接 3 处 + R-EP3A-2 sort fail-fast throw + Y-EP3A-1 SORT_IDENT_REGEX）

总计 +3700+ lines / 75+ 新单测 / 0 回退 / 全质量门禁全过 / arch-reviewer Opus 评审 B → 二次评审目标 A-。
