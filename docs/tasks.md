# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 17+ commit / EP-3-A 全闭环 6 子卡 + 收尾 + sub B 共 8 commits / sub B 迁 UsersListClient + 消解 arch-reviewer Opus 二次评审 3 advisory / 待 @livefree dev server 走读 sub B 或继续 EP-3-C）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / sub B 后）：
1. `/admin/users` toolbar 3 旧控件全消失（搜索 input / role select / banned select / clear button）→ 仅剩 trailing CSV 导出 + PageHeader 刷新/邀请/角色矩阵
2. 列名 ⋯ 触发 3 列 popover：
   - 用户名列 → text popover（搜 username+email / D-150-4 业务 key 桥接 column.id='username' ≠ filterFieldName='q'）
   - 角色列 → enum popover（admin/moderator/user 静态选项）
   - 状态列 → enum popover（已封禁/正常 / boolean string）
3. 多列组合过滤 + 排序 → fetch 真过滤 + 真排序 + page reset 1
4. 矩阵 popover 列固有过滤格 + 排序状态指示 ✓（R-EP3A-1 桥接修复后正确显示）

**通过 → EP-3-C 启动**：VideoListClient + StagingPageClient（~0.3w）

**修订建议 → 再次调整**：仍在 sub B 范围内回归

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3
2. `e930411b` EP-4.5-HOTFIX-4
3. `d952afd5` ADR-150 起草
4. `1908ac39` ADR-150 Accepted
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod
7. `4997515c` EP-3-A sub 1 CrawlerRunsView 迁
8. `b0371950` EP-3-A sub 1 HOTFIX
9. `8fc42d6b` EP-3-A sub 1 EXTEND
10. `ea5c2598` EP-3-A sub 2 AuditClient 迁
11. `68a8efe6` EP-3-A sub 2 EXTEND
12. `b80c9e7c` EP-3-A sub 2 PATCH
13. `ecb4b564` EP-3-A 收尾 二次评审 A-
14. `<TBD>` **EP-3-B sub B** UsersListClient 迁 + advisory 3 项

总计 +4000+ lines / 80+ 新单测 / 0 回退 / 全质量门禁全过 / EP-3-A A- PR ready / EP-3-B sub B 闭环。
