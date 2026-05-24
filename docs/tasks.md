# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 10+ commit / ADR-150 起草 + 阶段 1-4 sub 1 全栈推进完成 / 上次任务 EP-3-A sub 1 commit `4997515c` / **首次用户可走读 Google Sheets popover 实际效果**：`/admin/crawler/runs` 点 status / triggerType 列名 ⋯ 弹三段布局 + 选 enum + 应用真过滤 / 待 @livefree dev server 走读 sub 1 后启动 sub 2 AuditClient 迁移 + 后端白名单 AMENDMENT (~0.15w) + EP-3-A 整体 Opus PR review）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server）：
1. `/admin/crawler/runs` 点列名 ⋯（status 或 triggerType）→ Google Sheets 三段 popover 弹出
2. 三段：顶部排序 / 中部按值/按条件灰/按颜色灰 radio / 底部值列表搜索+全选+反选+复选+计数尾巴 / 底部取消/应用
3. 选 enum + 应用 → 数据真过滤
4. 矩阵 popover 列固有过滤格状态生效（点 toolbar 右上角 ⋯）
5. 列名 ⋯ + 矩阵 popover 排序/隐藏列功能与之前一致零回退

**通过 → 启动 EP-3-A sub 2**：
- AuditClient toolbar 4 AdminSelect/AdminInput 删 → 列内 filterable
- 后端 distinct-whitelist.ts AMENDMENT 追加 admin_audit_log.actor_id 等
- AuditClient 单测更新
- EP-3-A 整体 (sub 1 + sub 2) spawn arch-reviewer Opus PR review

**修订建议 → 调整**：根据走读反馈决定是否回滚 / 微调 popover UI / state 范式等

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3（矩阵 popover 3 问题修复）
2. `e930411b` EP-4.5-HOTFIX-4（disabled switch hint 可见化）
3. `d952afd5` ADR-150 起草（Opus 子代理 / 6 D-150-× / A− CONDITIONAL PASS）
4. `1908ac39` ADR-150 status Proposed → Accepted（@livefree 仲裁）
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI（Opus 双 review / 4 fix）
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod + 6 表白名单（Opus PASS / 三重 SQL 注入防御）
7. `4997515c` EP-3-A sub 1 CrawlerRunsView 迁 D-149-15 → D-150（**首次用户可走读效果**）

总计 +2700 lines / 50+ 新单测 / 0 回退 / 全质量门禁全过。
