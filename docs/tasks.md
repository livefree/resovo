# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 13+ commit / ADR-150 起草 + 阶段 1-4 sub 1 + HOTFIX + EXTEND + sub 2 全栈推进完成 / 上次任务 EP-3-A sub 2 / **AuditClient 5 列 popover 完整可走读 + toolbar 6 控件全删** / 待 @livefree dev server 走读 sub 2 后启动 EP-3-A 整体 Opus PR review）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / sub 2 AuditClient 走读）：
1. `/admin/audit` toolbar 6 个旧控件全消失（actionType select / targetKind select / actorId input / requestId input / from datetime / to datetime / clear button）→ 仅剩 trailing CSV 导出按钮
2. 列名 ⋯ 触发：
   - **时间列** → date range popover（精度日级）
   - **操作人列** → text popover（moderator 模式无 filter / 仅显示排序+隐藏）
   - **操作类型列** → enum popover（actionType 静态选项 / GET /admin/audit/enums 注入）
   - **目标列** → enum popover（targetKind 静态选项）
   - **Request ID 列** → text popover
3. 任一列过滤应用 → fetch 真过滤 + page reset 1
4. 多列组合过滤 → fetch 调用包含全部参数
5. moderator 登录态：操作人列 ⋯ 无 filter（保持 hideActorFilter）+ banner 仍显示
6. 排序段 disabled+tooltip "本列不支持排序"（sort 全栈留 ADR-150 阶段 5 EP-4）

**通过 → EP-3-A 整体 Opus PR review**：
- spawn arch-reviewer (claude-opus-4-7) 评审 sub 1 + sub 1 HOTFIX + sub 1 EXTEND + sub 2 累计改动
- 评级 PASS / 修订意见消解后启动 sub B（SubmissionsListClient + UsersListClient ~0.3w）

**修订建议 → 再次调整**：仍在 sub 2 范围内回归（不引入新需求）

**ADR-150 阶段 5 EP-4 范围**（不在本卡 / EP-3-A 全闭环后）：
- sort 全栈打通（CrawlerRunsView + AuditClient + sources 排序断链 / 后端 ORDER BY + sort deps）
- e2e smoke 3 case
- @livefree 走读 5 代表页
- DataTableAutoFilter filterKind 'datetime'（如用户反馈日级精度不足）

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3（矩阵 popover 3 问题修复）
2. `e930411b` EP-4.5-HOTFIX-4（disabled switch hint 可见化）
3. `d952afd5` ADR-150 起草（Opus 子代理 / 6 D-150-× / A− CONDITIONAL PASS）
4. `1908ac39` ADR-150 status Proposed → Accepted（@livefree 仲裁）
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI（Opus 双 review / 4 fix）
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod + 6 表白名单（Opus PASS / 三重 SQL 注入防御）
7. `4997515c` EP-3-A sub 1 CrawlerRunsView 迁 D-149-15 → D-150（**首次用户可走读效果**）
8. `b0371950` EP-3-A sub 1 HOTFIX popover 6 类走读反馈回归（共因 PANEL_STYLE 一次性消解 4 反馈 + 排序段始终渲染 + kind radio 删除）
9. `8fc42d6b` EP-3-A sub 1 EXTEND CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展（id text + siteCount range + createdAt date-range + data-table pinned 列 filterable 盲区修复）
10. `<TBD>` EP-3-A sub 2 AuditClient toolbar 6 控件迁列内 filterable + filtersMap 派生（5 列 filterable + D-150-5 union 守卫报错实证 + createdAt 精度降级 datetime→date）

总计 +3000+ lines / 65+ 新单测 / 0 回退 / 全质量门禁全过。
