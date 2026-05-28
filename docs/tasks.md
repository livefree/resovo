# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 + ADR 2/2 + 实施 4/5 子卡）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 全实施收官）
- ✅ CHG-368-A ADR-164 起草（Accepted A-）
- ✅ CHG-368-B-A1 数据层（+ 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ✅ CHG-368-B-A2b route 3 端点 + R-MID-1 RETRO 7 文件 + Service audit 接入（R-MID-1 第 29-30 次系统化）
- ✅ CHG-368-B-A3 route-scoring priority 激活 + listSources JOIN retired_at IS NULL 谓词
- ⏸️ CHG-368-B-B / -C 排期承接

---

## 下次会话恢复入口

- **CHG-368-B-B**：admin UI 独立路径 `/admin/source-line-aliases` + DataTable 一体化（packages/admin-ui）/ 3 文件 / 估时 ~0.4w / 建议 sonnet
- **CHG-368-B-C**（advisory）：LinesPanel codename 标签 + docs/architecture.md + docs/manual/route-labeling.md 同步 / 3 文件 / commit 需 arch-reviewer trailer（packages/admin-ui 公开 Props 改动）
- **CHG-369-B** / **CHG-SN-9-ROUTE-LABEL-D** / **PRE-DEAD-LINE-AUTO-RETIRE-WORKER** / **PRE-INDEX-DESIGN-RULES** 等
