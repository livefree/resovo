# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 + ADR 2/2 + 实施 2/5 子卡）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 全实施收官）
- ✅ CHG-368-A ADR-164 起草（Accepted A-）
- ✅ CHG-368-B-A1 数据层（+ 5 次 FIX 沉淀索引设计 4 步核验规范）
- ✅ CHG-368-B-A2a queries + Service 业务层
- ⏸️ CHG-368-B-A2b / -A3 / -B / -C 排期承接

---

## 下次会话恢复入口

- **CHG-368-B-A2b**（依赖 -A2a PASS）：route 3 新端点 + R-MID-1 RETRO 7 文件（D-121-3 豁免）+ payload 内容断言新单测 + Service 3 方法 audit 写入路径接入 / 估时 ~0.3w / 建议 opus-4-7
- **CHG-368-B-A3**：route-scoring priority 激活 + sources.ts JOIN retired_at IS NULL 谓词 / 2 文件 + 测试 / 估时 ~0.2w / 建议 sonnet
- **CHG-368-B-B**：admin UI 独立路径 + DataTable 一体化 / 3 文件 / 建议 sonnet
- **CHG-368-B-C**（advisory）：LinesPanel codename 标签 + docs 同步 / commit 需 arch-reviewer trailer
- **CHG-369-B** / **CHG-SN-9-ROUTE-LABEL-D** / **PRE-DEAD-LINE-AUTO-RETIRE-WORKER** / **PRE-INDEX-DESIGN-RULES**（5 次 FIX 经验落 db-rules.md）等
