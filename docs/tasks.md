# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 完成 + ADR 卡 2/2）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A ADR-163 起草（arch-reviewer Opus PASS / 0 红线 / 8 决策点）
- ✅ CHG-367-B-A schema + types + queries + auto enrich（commit ba3e3e26 + 续修 e639c444 + a07a727c）
- ✅ CHG-367-B-B manual 写入 + TabDetail 三维 + 3 黄线全闭档（本会话完成 / 2026-05-28）
- ⏸️ CHG-368-A/-B PAUSED 用户待恢复 spawn Opus

**ADR-163 META-EPISODES 全部实施收官**：A 起草 → B-A schema+auto → B-B manual+UI+黄线 / D-163-1..8 + Y1/Y2/Y3 + A1/A2/A3 全闭档

---

## 下次会话恢复入口

- **CHG-368-A/-B PAUSED**：ROUTE-LABEL-B Migration 064 codename/priority/retired_at + admin UI `/admin/source-line-aliases` + 退役端点 / 用户允许 spawn Opus 后恢复（ADR-164 起草）
- **CHG-369-B 自定义主题输入**：labels ≤ 30 / name ≤ 10 字符 / schema 校验 + JSON serialize
- **CHG-SN-9-ROUTE-LABEL-D 跨设备同步**：plan §17.2 Wave 3 / `users.preferences` schema
- **C-2 残留** / **多种 flaky test pre-existing**（useTableSettings localStorage jsdom env / ModerationBatch fixture 缺 probeAggregate）/ **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **Phase 2 route-labeling isDead 字段** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费**
