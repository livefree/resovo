# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / ✅ **完全收官 = 100%**）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 META-EPISODES 全实施收官）
- ✅ CHG-368-A ADR-164 起草（arch-reviewer Opus A- Accepted）
- ✅ CHG-368-B-A1 数据层（Migration 079 + types + queries SELECT / + 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ✅ CHG-368-B-A2b route 3 端点 + R-MID-1 RETRO 7 文件（R-MID-1 第 29-30 次系统化）
- ✅ CHG-368-B-A3 route-scoring priority 通道激活 + listSources JOIN retired_at IS NULL 谓词
- ✅ CHG-368-B-B admin UI 独立路径 /admin/source-line-aliases + DataTable 一体化
- ✅ CHG-368-B-C-DOCS docs/architecture.md "已 ship" 升级 + docs/manual/route-labeling.md §9 Layer B 实施记录
- ✅ CHG-368-B-C-UI LinesPanel codename badge + 退役行 opacity（arch-reviewer Opus A）

**Wave 2 完整收官**：主线 13/13 + ADR 2/2 全 Accepted + 实施 6/6 + docs sync + Opus 评审全部完成。Layer B 山名代号体系完整 ship（schema + 业务 + audit + UI + 字库 + 退役治理 + LinesPanel 显示）/ ADR-164 5 黄线 + 4 advisory 全部闭档。

---

## 下次会话恢复入口

- **CHG-369-B 自定义主题输入**（plan §17.2）：labels ≤ 30 / name ≤ 10 字符 / schema 校验 + JSON serialize
- **CHG-SN-9-ROUTE-LABEL-D 跨设备主题同步**（plan §17.2 Wave 3）：users.preferences schema
- **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）：plan §10.5 全 dead 180 天自动退役 worker（写 retired_at + auto_retired=true）
- **PRE-INDEX-DESIGN-RULES**（5 次 FIX 经验落 db-rules）：把"索引设计 4 步核验 + 双 invariant（部分索引方向 + 驱动列 vs 索引列匹配性）"沉淀到 docs/rules/db-rules.md
- **CHG-368-B-FOLLOWUP-CONTENT-SOURCE-ROW**（advisory）：server-next API 层 ContentSourceRow / VideoSource 类型同步扩 codename + retired_at 字段（让 LinesPanel 实际看到数据 / 当前永显 null）
- **CHG-368-B-FOLLOWUP-AUTO-RETIRED-LABEL**（advisory）：LinesPanel 退役标识区分"（已退役·自动）/（已退役·手动）"基于 autoRetired 字段 / 需扩 LineAggregate 第 12 字段（再触发 Opus trailer）
- 其他 pre-existing 长尾 / **CHG-354 SPLIT-D** / **audit 4 真源 advisory** / **PRE-PROBE-WORKER 占位 jobId** / **meta_quality TabDetail UI 消费** 等
