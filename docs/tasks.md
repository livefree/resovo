# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 12+ commit / ADR-150 起草 + 阶段 1-4 sub 1 + sub 1 HOTFIX + sub 1 EXTEND 全栈推进完成 / 上次任务 EP-3-A sub 1 EXTEND / **CrawlerRunsView 5 列 popover 完整可走读** (id text 前缀 + status enum + triggerType enum + siteCount range + createdAt date-range) / 待 @livefree dev server 重走读 sub 1 EXTEND 后启动 sub 2 AuditClient 迁移 + 后端白名单 AMENDMENT (~0.15w) + EP-3-A 整体 Opus PR review）

---

## 下次会话恢复入口

**重走读重点**（@livefree dev server / sub1-EXTEND 后 5 列 popover 验证）：
1. `/admin/crawler/runs` 点 **id (Run ID)** 列名 ⋯ → popover / 文本输入 prefix 8 字符 → 应用 → 数据按 UUID 前缀过滤
2. 点 **siteCount** 列名 ⋯ → popover / 数字范围输入（最小+最大）→ 应用 → 按 enqueued_site_count 范围过滤
3. 点 **createdAt** 列名 ⋯ → popover / 日期范围输入（from+to）→ 应用 → 按 created_at 日期范围过滤（to 含当日全天）
4. 点 **status / triggerType** 列名 ⋯ → 同 HOTFIX 后行为（enum 复选 + 排序 disabled+tooltip）
5. 点 **duration / ops** 列名 ⋯ → 仍弹旧 HeaderMenu / 只显示"隐藏此列"（按设计 / 业务语义不该过滤）
6. **多列过滤组合**：选 status=running + createdAtFrom=2026-05-01 + siteCountMin=5 → 应用 → fetch 调用包含全部 3 参数 + page reset 1

**通过 → 启动 EP-3-A sub 2**：
- AuditClient toolbar 4 AdminSelect/AdminInput 删 → 列内 filterable
- 后端 distinct-whitelist.ts AMENDMENT 追加 admin_audit_log.actor_id 等
- AuditClient 单测更新
- EP-3-A 整体 (sub 1 + sub 1 HOTFIX + sub1-EXTEND + sub 2) spawn arch-reviewer Opus PR review

**修订建议 → 再次调整**：仍在 sub1-EXTEND 范围内回归

**ADR-150 阶段 5 EP-4 范围**（不在本卡 / sub 2 后续）：
- sort 全栈打通（CrawlerRunsView + sources 排序断链 / 后端 ORDER BY + sort deps）
- e2e smoke 3 case
- @livefree 走读 5 代表页

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
9. `<TBD>` EP-3-A sub 1 EXTEND CrawlerRunsView 3 列 filterable 补齐 + 后端 listRuns 5 参数扩展（id text + siteCount range + createdAt date-range + data-table pinned 列 filterable 盲区修复）

总计 +2700 lines / 50+ 新单测 / 0 回退 / 全质量门禁全过。
