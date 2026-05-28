# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ 实质性 ship 完毕）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 全实施收官）
- ✅ CHG-368-A ADR-164 起草（Accepted A-）
- ✅ CHG-368-B-A1 数据层（+ 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ✅ CHG-368-B-A2b route 3 端点 + R-MID-1 RETRO 7 文件 + Service audit 接入（R-MID-1 第 29-30 次系统化）
- ✅ CHG-368-B-A3 route-scoring priority 激活 + listSources JOIN retired_at IS NULL 谓词
- ✅ CHG-368-B-B admin UI 独立路径 + DataTable 一体化
- ✅ CHG-368-B-C-DOCS docs/architecture.md 升级 + docs/manual/route-labeling.md §9 Layer B 实施记录
- ⏸️ CHG-368-B-C-UI advisory（LinesPanel codename 标签 / 需 spawn Opus / 独立 follow-up）

**Wave 2 全 ship**：主线 13/13 + ADR 2/2 + 实施 5/5 + docs sync 完成。仅 advisory LinesPanel UI 标签独立 follow-up（涉及 packages/admin-ui 公开 Props 修改 / 需 spawn arch-reviewer Opus / commit 需 trailer）。

---

## 下次会话恢复入口

- **CHG-368-B-C-UI**（advisory / 需 Opus）：packages/admin-ui composite/lines-panel 扩 LineAggregate codename + retiredAt + 行级 codename 标签 + 退役行 opacity / ~3 文件 / commit 需 arch-reviewer trailer
- **CHG-369-B** 自定义主题输入
- **CHG-SN-9-ROUTE-LABEL-D** 跨设备主题同步（plan §17.2 Wave 3）
- **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）：plan §10.5 worker 实施
- **PRE-INDEX-DESIGN-RULES**：5 次 FIX 经验落 docs/rules/db-rules.md "索引设计 4 步核验 + 部分索引方向 + 驱动列 vs 索引列匹配性"双 invariant
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
