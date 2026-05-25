# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-24

---

## 进行中任务

（空 — 本会话累计 19+ commit / EP-3-A 全闭环 + sub B/C + AMD2-ADR + AMD2-EP / ADR-150 AMENDMENT 2 范式根本反转兑现 / opt-in → opt-out / 待 @livefree dev server 走读 AMD2-EP 或继续 EP-3-D）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / AMD2-EP 后）：
1. 任意 admin 表格（已迁 4 消费方 + 未迁 ImageHealthClient/MergeClient 等）→ 所有数据列默认显示 ⋯ 触发器
2. CrawlerRunsView ops / AuditClient actions / UsersListClient actions / VideoListClient cover + actions 5 列 → **无 ⋯ 触发器**（kind opt-out）
3. VideoListClient 默认显示 ⋯ 的列暴增（duration / year / source_health / probe / image_health / douban_status / meta_score / created_at / updated_at）— **dev warn 提示后端 FILTER_FIELDS 未对齐**（后端不会真过滤）
4. 矩阵 popover 不再包含 action kind 列（5 列）
5. 4 已迁消费方现有 filterable: true 显式声明零回退

**通过 → EP-3-D 启动**（ImageHealthClient + MergeClient ~0.3w / 按 AMD2 新范式 column 定义减负 60%+）

**dev warn 实施**留 EP-3-D 入口顺手（D-150-AMD2-7 / column.id 含非业务命名特征 → console.warn）

---

## 本会话已完成 commit 链

1-15. EP-3-A 全闭环 + sub B + sub C（详见 changelog）
16. `68571ceb` **AMD2-ADR** ADR-150 AMENDMENT 2 起草 + @livefree 仲裁 PASS
17. `<TBD>` **AMD2-EP** AMENDMENT 2 实施（共享层 + 4 消费方 opt-out + 测试 fixture）

总计 +4500+ lines / 80+ 新单测 / 0 回退 / ADR-150 AMENDMENT 2 范式根本反转兑现 / 全质量门禁全过。
