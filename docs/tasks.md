# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

（空 — CHG-SN-9-CW1-B-ADR 已完成 / ADR-151 Accepted / 接下来 CW1-B-EP 实施 → CW1-C / CW1-D / CW1-E）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / CHG-SN-9-CW1-A 落地 + CHG-SN-9-CW1-B-ADR ADR-151 Accepted 后）：
1. `/admin/crawler` PageHeader subtitle：观察「X 个站点 · 实时/采集已关闭 · 下次自动: MM-DD HH:mm」chip
2. 高级 dropdown 6 项 4 字命名：定时设置 / 全站全量 / 重建索引 / 一键停采 / 关闭采集 / 采集记录
3. ADR-151 已 Accepted / 等 CW1-B-EP 实施 task 级 cancel 端点 + UI

**下一卡**：CHG-SN-9-CW1-B-EP（按 ADR-151 §10 实施 / 含 worker 守卫 R-151-3 硬依赖）

---

## 本会话已完成 commit 链

（沿用上一会话累计 / 本会话新增见各卡 commit）
- `5cae1c74` **CHG-SN-9-CW1-A** 采集页 UI 三合一 / 6 项 4 字命名 + 撤回删除入口 4 处 + PageHeader 下次自动 chip
- `<TBD>` **CHG-SN-9-CW1-B-ADR** ADR-151 起草 + Opus 评审 A− CONDITIONAL → R3+Y3+G1 修订 → Accepted
