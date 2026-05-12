# E2E 覆盖率报告 — 2026-04-18

> 产出来源：TESTFIX-07
> 对应基线：`docs/baseline_20260418/failing_tests.json`
> 采集时间：2026-04-18（Phase 0.5 基线重建）

---

## 采集说明

本次采集覆盖全部 8 个 E2E suite，分两个 Playwright project 运行：
- `web-chromium`：homepage / auth / player / search
- `admin-chromium`：admin / admin-source-and-video-flows / publish-flow / video-governance

采集完整性声明：所有 suite 的 total/pass/fail 数字均来自同一次 CI 运行，与 `failing_tests.json` 条目一一对应，数字经人工校验无遗漏。

---

## Suite 汇总表

| Suite | Project | Total | Pass | Fail | Flaky |
|-------|---------|-------|------|------|-------|
| homepage.spec.ts | web-chromium | 14 | 8 | 6 | 0 |
| auth.spec.ts | web-chromium | 15 | 0 | 15 | 0 |
| player.spec.ts | web-chromium | 22 | 15 | 7 | 0 |
| search.spec.ts | web-chromium | 22 | 20 | 2 | 0 |
| admin.spec.ts | admin-chromium | 26 | 8 | 18 | 0 |
| admin-source-and-video-flows.spec.ts | admin-chromium | 3 | 1 | 2 | 0 |
| publish-flow.spec.ts | admin-chromium | 4 | 2 | 2 | 0 |
| video-governance.spec.ts | admin-chromium | 2 | 0 | 2 | 0 |
| **合计** | — | **108** | **54** | **54** | **0** |

---

## 失败类型分布

| 类型 | 说明 | 条数 |
|------|------|------|
| C | testid / DOM 漂移 / URL 格式变更 | 47 |
| D | 超时 / 交互不完成 / 功能真实失败 | 7 |

---

## 每 Suite 失败明细（供 verify-baseline --coverage-report 读取）

```json
{
  "homepage.spec.ts": { "total": 14, "pass": 8, "fail": 6, "flaky": 0 },
  "auth.spec.ts": { "total": 15, "pass": 0, "fail": 15, "flaky": 0 },
  "player.spec.ts": { "total": 22, "pass": 15, "fail": 7, "flaky": 0 },
  "search.spec.ts": { "total": 22, "pass": 20, "fail": 2, "flaky": 0 },
  "admin.spec.ts": { "total": 26, "pass": 8, "fail": 18, "flaky": 0 },
  "admin-source-and-video-flows.spec.ts": { "total": 3, "pass": 1, "fail": 2, "flaky": 0 },
  "publish-flow.spec.ts": { "total": 4, "pass": 2, "fail": 2, "flaky": 0 },
  "video-governance.spec.ts": { "total": 2, "pass": 0, "fail": 2, "flaky": 0 }
}
```

---

## 数字一致性备档

| 维度 | 数量 |
|------|------|
| E2E suite 数 | 8 |
| E2E 测试总数 | 108 |
| E2E 通过数 | 54 |
| E2E 失败数 | 54 |
| failing_tests.json 条目数 | 54 |

> 校验命令：`npm run verify:baseline -- --e2e 54 --total 54 --coverage-report`
