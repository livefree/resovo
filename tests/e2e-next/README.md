# tests/e2e-next/

`apps/web-next/` 的 E2E 测试目录，与 `tests/e2e/`（旧前台）并行存在。

## 运行

```bash
# 仅 web-next E2E
npx playwright test --project=web-next-chromium

# 全部三个 project（含旧 E2E）
npm run test:guarded:e2e
```

## 目录规范

- `smoke.spec.ts`：新 app 基础可用性验证（始终保持绿色）
- `{milestone}.spec.ts`：每个里程碑（M2–M6）对应一个 spec，在里程碑路由接管时同步新增

## 隔离清单前缀

- `e2e-next::` — 本目录测试的隔离 ID 前缀（与旧 `e2e::` 区分）
- 新增失败时写入 `docs/known_failing_tests_phase*.md` 对应块

## 与 tests/e2e/ 关系

| 目录 | 目标 app | Project | 退役时机 |
|------|---------|---------|---------|
| `tests/e2e/` | apps/web（port 3000） | web-chromium / web-mobile / admin-chromium | M2–M6 逐块删除 |
| `tests/e2e-next/` | apps/web-next（port 3002） | web-next-chromium | M6-RENAME 后合并为主 E2E |
