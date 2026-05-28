# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 + ADR 2/2 + 实施 5/5 子卡）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 全实施收官）
- ✅ CHG-368-A ADR-164 起草（Accepted A-）
- ✅ CHG-368-B-A1 数据层（+ 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ✅ CHG-368-B-A2b route 3 端点 + R-MID-1 RETRO 7 文件 + Service audit 接入（R-MID-1 第 29-30 次系统化）
- ✅ CHG-368-B-A3 route-scoring priority 激活 + listSources JOIN retired_at IS NULL 谓词
- ✅ CHG-368-B-B admin UI 独立路径 + DataTable 一体化
- ⏸️ CHG-368-B-C advisory（LinesPanel codename 标签 + docs 同步 / 可选）

**Wave 2 业务全 ship**：主线 13/13 + ADR 2/2 + 实施 5/5 全部 ship。仅 advisory -C 卡待。

---

## 下次会话恢复入口

- **CHG-368-B-C**（advisory / 可选）：LinesPanel codename 标签（packages/admin-ui composite/lines-panel）+ docs/architecture.md "ship 状态" 升级 + docs/manual/route-labeling.md §"Layer B 实施记录" / 3 文件 / 估时 ~0.2w / commit 需 arch-reviewer trailer（packages/admin-ui 公开 Props 改动 / CLAUDE.md §模型路由"共享组件 API 契约强制 Opus"）
- **CHG-369-B 自定义主题输入** / **CHG-SN-9-ROUTE-LABEL-D** 跨设备主题同步 / **PRE-DEAD-LINE-AUTO-RETIRE-WORKER**（A-164-1 占位）/ **PRE-INDEX-DESIGN-RULES**（5 次 FIX 经验落 db-rules.md）等
