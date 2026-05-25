# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-25

---

## 进行中任务

（空 — CHG-SN-9-CW1-B-EP 已完成 / ADR-151 §10 6 步全实施 + R-151-3 worker 守卫硬依赖 / 接下来 CW1-B-EP-TEST 单测补齐 follow-up + CW1-C 关键词 Drawer + CW1-D Dashboard 卡 + CW1-E 铃铛 ADR/EP）

---

## 下次会话恢复入口

**走读重点**（@livefree dev server / CW1-A + CW1-B-ADR + CW1-B-EP 落地后）：
1. `/admin/crawler/runs/[id]` task 表行 [取消] 按钮（仅 queued/running/paused 可点 / alreadyRequested 时 toast info）
2. task 表表头多选 + sticky bulk action bar（已选 N 个 + 批量取消按钮 / batch 50+ 弹 confirm）
3. 后端 POST /admin/crawler/tasks/:id/cancel + /batch-cancel（admin only）
4. worker 已加 terminal status 短路（防 paused task 30s Bull delayed job 漂移）
5. audit `crawler_task.cancel` + `crawler_task.batch_cancel` 已落库（migration 073 / target_kind 14 种）

**下一卡**：CHG-SN-9-CW1-B-EP-TEST（单测补齐 follow-up）→ CHG-SN-9-CW1-C（关键词 Drawer）

---

## 本会话已完成 commit 链

- `5cae1c74` **CHG-SN-9-CW1-A** 采集页 UI 三合一 / 6 项 4 字命名 + 撤回删除入口 4 处 + PageHeader 下次自动 chip
- `943611eb` **CHG-SN-9-CW1-B-ADR** ADR-151 起草 + Opus 评审 A− CONDITIONAL → R3+Y3+G1 修订 → Accepted
- `<TBD>` **CHG-SN-9-CW1-B-EP** Bug-A 实施 / 7 文件 + 1 migration + 2 路由 + worker R-151-3 守卫
