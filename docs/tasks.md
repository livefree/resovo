# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-28

---

## 进行中任务

（空）

---

## Wave 2 状态（SEQ-20260527-MOD-WAVE2 / 主线 13/13 + ADR 卡 2/2 + 实施 1/5 子卡）

- ✅ CHG-361 ~ CHG-366 / CHG-369（详 changelog）
- ⛔ CHG-362-A/B + CHG-365-A/B SKIPPED
- ✅ CHG-367-A/B-A/B-B（ADR-163 全实施收官）
- ✅ CHG-368-A ADR-164 起草（Accepted A-）
- ✅ CHG-368-B-A1 数据层最小子卡（Migration 079 + types + queries SELECT 扩列 / 5 业务 + 0 测试 / 零业务行为变化）
- ⏸️ CHG-368-B-A2/-A3/-B/-C 排期承接（4 子卡 / ~15 文件 / 含 R-MID-1 RETRO + admin UI + LinesPanel + docs）

---

## 下次会话恢复入口

- **CHG-368-B-A2**（高优先 / 业务最重）：新增 retire / priority / codename queries + SourcesMatrixService 3 方法 + 3 admin 写端点 + R-MID-1 RETRO 7 文件（D-164-7 / 2 新 actionType `source_line_alias.retire` + `source_line_alias.priority_update`）/ 严守 PATCH ≤ 5 + RETRO 7 文件 D-121-3 豁免 / 业务 7 文件需再拆 -A2a/-A2b 或一次性 14 文件提交 / 估时 ~0.4-0.6w / 建议 opus-4-7
- **CHG-368-B-A3**：route-scoring.ts priority 通道激活（priority/100 替代 Phase 1 默认 0）+ sources.ts JOIN 加 retired_at IS NULL 谓词 / 2 文件 + 测试 / 估时 ~0.2w / 建议 sonnet
- **CHG-368-B-B**：admin UI 独立路径 `/admin/source-line-aliases` + DataTable 一体化 / 3 文件 / 建议 sonnet
- **CHG-368-B-C**（advisory）：LinesPanel codename 标签 + docs/architecture.md + docs/manual/route-labeling.md 同步 / 3 文件 / commit 需 arch-reviewer trailer
- **CHG-369-B 自定义主题输入** / **CHG-SN-9-ROUTE-LABEL-D** / **多种 pre-existing flaky test** / **PRE-DEAD-LINE-AUTO-RETIRE-WORKER 占位卡**（A-164-1）等
