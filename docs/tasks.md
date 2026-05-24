# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 11+ commit / ADR-150 起草 + 阶段 1-4 sub 1 + sub 1 HOTFIX 全栈推进完成 / 上次任务 EP-3-A sub 1 HOTFIX / **HOTFIX 后用户可重走读 Google Sheets popover** 含 3 个新增观察项：① 排序段始终可见 ② kind radio 段已删 ③ popover 固定 320×480 不溢出 / 待 @livefree dev server 重走读 HOTFIX 后启动 sub 2 AuditClient 迁移 + 后端白名单 AMENDMENT (~0.15w) + EP-3-A 整体 Opus PR review）

---

## 下次会话恢复入口

**重走读重点**（@livefree dev server / HOTFIX 后 6 类反馈是否全消解）：
1. `/admin/crawler/runs` 点列名 ⋯（status 或 triggerType）→ Google Sheets popover 弹出
2. **新增**：顶部"升序/降序"始终可见（disabled 时鼠标悬停显示 tooltip "本列不支持排序"）
3. **变更**：中部 kind radio 3 选段已删除（不再有"按值/按条件/按颜色"3 项）
4. **修复**：popover 固定宽度 320px / 最大高度 480px / 取消+应用 按钮不再溢出 / 值列表满项时滚动条可见
5. **修复**：列名 ⋯ 触发后 popover 视觉不被压
6. 矩阵 popover 列固有过滤格状态生效（点 toolbar 右上角 ⋯）/ 列名 ⋯ + 矩阵 popover 排序/隐藏列功能零回退

**通过 → 启动 EP-3-A sub 2**：
- AuditClient toolbar 4 AdminSelect/AdminInput 删 → 列内 filterable
- 后端 distinct-whitelist.ts AMENDMENT 追加 admin_audit_log.actor_id 等
- AuditClient 单测更新
- EP-3-A 整体 (sub 1 + sub 1 HOTFIX + sub 2) spawn arch-reviewer Opus PR review

**修订建议 → 再次调整**：仍在 sub 1 HOTFIX 范围内回归（不引入 sub 2 范围）

---

## 本会话已完成 commit 链

1. `200f1613` EP-4.5-HOTFIX-3（矩阵 popover 3 问题修复）
2. `e930411b` EP-4.5-HOTFIX-4（disabled switch hint 可见化）
3. `d952afd5` ADR-150 起草（Opus 子代理 / 6 D-150-× / A− CONDITIONAL PASS）
4. `1908ac39` ADR-150 status Proposed → Accepted（@livefree 仲裁）
5. `8052bc85` EP-1 共享 DataTableAutoFilter UI（Opus 双 review / 4 fix）
6. `e86035ea` EP-2 后端通用 distinct + 共享 zod + 6 表白名单（Opus PASS / 三重 SQL 注入防御）
7. `4997515c` EP-3-A sub 1 CrawlerRunsView 迁 D-149-15 → D-150（**首次用户可走读效果**）
8. `<TBD>` EP-3-A sub 1 HOTFIX popover 6 类走读反馈回归（共因 PANEL_STYLE 一次性消解 4 反馈 + 排序段始终渲染 + kind radio 删除）

总计 +2700 lines / 50+ 新单测 / 0 回退 / 全质量门禁全过。
