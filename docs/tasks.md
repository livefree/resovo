# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 14+ commit / ADR-150 起草 + 阶段 1-4 EP-3-A 全闭环（sub 1 + HOTFIX + sub 1 EXTEND + sub 2 + sub 2 EXTEND 5 子卡）/ **2 表格（CrawlerRunsView + AuditClient）filter + sort + 组合过滤态完整可走读** / 待 @livefree dev server 走读 sub 2 EXTEND 后启动 EP-3-A 整体 Opus PR review）

---

## 下次会话恢复入口

**重走读重点**（@livefree dev server / sub 2 EXTEND 后）：
1. `/admin/audit` 打开 popover：
   - **过滤段**：actionType / target enum 列首次打开已有完整选项（enums 加载完成 / 空退化 bug 修复）
   - **排序段**：时间列点击"升序"/"降序"→ fetch 真排序 + page reset 1
2. `/admin/crawler/runs` 打开 popover：
   - **过滤段**：5 列正常（status/triggerType/id/siteCount/createdAt）
   - **排序段**：创建时间列点击"升序"→ fetch 带 sortField=createdAt + sortDirection=asc → 数据按时间正序
3. **组合过滤态**：选 actionType=video.approve + createdAt date range + 点排序 → fetch 包含全部参数 + 数据真过滤+真排序
4. 矩阵 popover 列固有过滤格 + 排序状态指示符正常显示

**通过 → EP-3-A 整体 Opus PR review**：
- spawn arch-reviewer (claude-opus-4-7) 评审 sub 1 + sub 1 HOTFIX + sub 1 EXTEND + sub 2 + sub 2 EXTEND 累计改动
- 评级 PASS → 启动 sub B（SubmissionsListClient + UsersListClient ~0.3w）

**修订建议 → 再次调整**：仍在 sub 2 EXTEND 范围内回归

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
10. `ea5c2598` EP-3-A sub 2 AuditClient toolbar 6 控件迁列内 filterable + filtersMap 派生（5 列 filterable + D-150-5 union 守卫报错实证 + createdAt 精度降级 datetime→date）
11. `<TBD>` EP-3-A sub 2 EXTEND EnumValueList 空退化 BUG + 2 表格 sort 全栈打通（admin-ui 1 行 + 后端 2 端点 sort 参数 + 前端 2 表格 enableSorting + 白名单守卫）

总计 +3500+ lines / 70+ 新单测 / 0 回退 / 全质量门禁全过 / 108 文件 1796 单测最终验证。
