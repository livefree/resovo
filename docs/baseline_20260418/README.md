# 基线快照目录 — 2026-04-18

> **⚠️ LEGACY SNAPSHOT**

本目录是 apps/web/ + apps/admin/ + apps/server/ 重写前夜（Phase 0.5 闭幕时）的测试基线。

## 内容

- `failing_tests.json`：54 条 E2E 失败 + 0 条 unit 失败（TESTFIX-05 已修 16 条 unit）
- `e2e_coverage_report.md`：8 个 E2E suite 覆盖率报告
- `critical_paths.md` / `timings.json`：performance 与关键路径基线
- `screenshots/`：视觉基线（若存在）

## 状态

- **不再更新**：自 2026-04-18 Phase 0.5 闭幕后冻结
- **作废路径**：自 M2 起，每个重写里程碑完成时，失败条目对应的 suite 被 `tests/e2e-next/` 中的新 suite 替代
- **TESTFIX-08 未验证声明**：D-04~D-10 的 7 条 E2E 失败，commit 6dca65d 做出代码层面修复但未 playwright 重跑验证；接受"假设已修"

## 后继

- 重写期：`docs/known_failing_tests_phase0.md` 逐条作废
- M6 末：启用 `docs/baseline_20260618/`（目标日期，随 M6 完成日调整）
