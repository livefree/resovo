# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 完成 + ADR 卡 2/2 全 Accepted）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A ADR-163 起草 + CHG-367-B-A schema/auto + CHG-367-B-B manual/UI/黄线（**ADR-163 META-EPISODES 全实施收官**）
- ✅ CHG-368-A ADR-164 起草（arch-reviewer Opus A- → Accepted / D-164-1..12 全闭环 / 5 黄线 + 4 advisory + 7 重评条件 / Migration 079 SQL 草案 / 3 新端点 R7 MUST-8 / R-MID-1 RETRO 7 文件框架）
- ⏸️ CHG-368-B 实施排期（拆 -A/-B/-C 三子卡 / 实施期 19 文件 → -A:14（含 RETRO 豁免）/ -B:3 / -C:3）

**Wave 2 总览**：13/13 主线 + 2/2 ADR = 完整闭环，仅 CHG-368-B 实施待启动。

---

## 下次会话恢复入口

- **CHG-368-B-A**（ROUTE-LABEL-B 实施第 1 子卡 / 优先）：Migration 079 source_line_aliases 扩 codename / priority / retired_at / auto_retired + SourcesMatrixService 3 新方法 + 3 admin 写端点 + R-MID-1 RETRO 7 文件框架（D-164-7）+ route-scoring priority 通道激活；业务 7 文件 + RETRO 7 = 14 → 实施时再拆 -A1/-A2 严格 ≤5 / 建议 opus-4-7 续会话（schema-driven 复杂度高 / RETRO 必走）
- **CHG-368-B-B**（admin UI 独立路径）：新建 `/admin/source-line-aliases` 独立路径 + DataTable 一体化（packages/admin-ui）/ 3 文件 / 建议 sonnet
- **CHG-368-B-C**（advisory / 可选）：LinesPanel 行级 codename 标签 + docs/architecture.md + docs/manual/route-labeling.md 同步 / 3 文件 / commit 需 arch-reviewer trailer（packages/admin-ui types.ts 改动 / CLAUDE.md §模型路由 共享组件 API 契约强制 Opus）
- **CHG-369-B 自定义主题输入**：labels ≤ 30 / name ≤ 10 字符 / schema 校验 + JSON serialize
- **CHG-SN-9-ROUTE-LABEL-D 跨设备同步**：plan §17.2 Wave 3 / `users.preferences` schema
- **C-2 残留** / **多种 flaky test pre-existing**（useTableSettings localStorage jsdom env / ModerationBatch fixture 缺 probeAggregate）/ **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **Phase 2 route-labeling isDead 字段** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** / **PRE-DEAD-LINE-AUTO-RETIRE-WORKER 占位卡**（A-164-1 / plan §10.5 worker 实施触发）
