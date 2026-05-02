# Resovo（流光） — 任务看板

> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-02
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## 进行中任务

### CHG-SN-4-05a · ADR-110 方案 B 迁移：ErrorCode 真源归一 + 三源漂移合并 · 🔄 进行中

- **来源序列**：`docs/task-queue.md` SEQ-20260501-01 / DEBT-SN-4-05-C 闭环卡
- **执行真源**：`docs/decisions.md` ADR-110（accepted 2026-05-02）
- **建议主循环模型**：`claude-sonnet-4-6`（机械迁移 + 字典移位，无新决策）
- **强制子代理**：否（如发现 ADR-110 决策需修订 → BLOCKER 暂停，不得自行裁定）
- **前置**：CHG-SN-4-05 ✅ + ADR-110 accepted ✅
- **下游解锁**：CHG-SN-4-07 / CHG-SN-4-08（前端接入硬前置；本卡完成后 DEBT-SN-4-05-C 完全关闭）

#### 上下文（必读 ADR-110 后再开工）

CHG-SN-4-05 集成后复评发现三源漂移：
- `packages/types/src/api.types.ts:34-41` ErrorCode 7 码（含 `'CONFLICT'`）
- `apps/api/src/lib/errors.ts` ERRORS 字典 13 码（含 `'STATE_CONFLICT'` / `'INVALID_TRANSITION'` 等业务码）
- `packages/types/src/admin-moderation.types.ts:321-327` ModerationErrorCode 6 码子集

ADR-110 决策：**唯一真源 = `packages/types/src/api-errors.ts`**（待建）；AppError class 留 apps/api（class 不可跨 workspace 共享 instanceof）。

#### 范围（按 ADR-110 §决策 6 项推导）

1. **新建** `packages/types/src/api-errors.ts`：
   - `ApiErrorBody` interface（从 errors.ts 提取，与 api.types.ts ApiError.error 形状对齐）
   - `ERRORS` 常量字典：13 码（继承 errors.ts 现有 7 通用码 + 6 新业务码 — STATE_INVALID / LABEL_UNKNOWN / STAGING_NOT_READY / REVIEW_RACE / RATE_LIMITED / SOURCE_PROBE_FAILED）
   - `ERRORS` 类型 = `as const satisfies Record<string, ApiErrorBody>`
   - `ErrorCode` 类型 = `keyof typeof ERRORS`
2. **导出** `packages/types/src/index.ts` 追加 `export * from './api-errors'`（**值导出 + 类型导出**，注意不能用 `export type *`）
3. **修订** `apps/api/src/lib/errors.ts`：
   - 删除本地 `ApiErrorBody` interface + 删除本地 `ERRORS` 字典 + 删除本地 `ErrorCode` type
   - 改为 `import { ERRORS, type ApiErrorBody, type ErrorCode } from '@resovo/types'`
   - 同名 re-export（兼容 apps/api 内 `import { ERRORS } from '@/api/lib/errors'` 调用方零改动）
   - 保留：`AppError` class + `isAppError` 守卫 + `makeError` 工具
4. **退役** `packages/types/src/admin-moderation.types.ts:321-327` 的 `ModerationErrorCode` union：
   - 删 7 行独立 union
   - 如有消费方使用 ModerationErrorCode（grep 全仓），改为 `import type { ErrorCode } from '@resovo/types'` + 必要时 `Pick` 收窄子类型 / `Extract<ErrorCode, 'STATE_INVALID' | ...>`
5. **退役** `packages/types/src/api.types.ts:34-41` 旧 `ErrorCode` 7 码 union：
   - 删 8 行（line 34-41）
   - 在文件顶部追加 `export type { ErrorCode, ApiErrorBody } from './api-errors'`（保持外部 `import { ErrorCode } from '@resovo/types'` 调用方零改动）
   - 同步检查 line 26-32 `ApiError` interface 是否需要使用新 `ErrorCode`（应该已经在用，因为 import 自同文件）
6. **修订** `docs/rules/api-rules.md:98`：
   - 原文："在 apps/api/src/lib/errors.ts 中统一定义"
   - 改为："在 `packages/types/src/api-errors.ts` 中统一定义（ADR-110 决策；apps/api/src/lib/errors.ts 仅保留 AppError class + isAppError + makeError 工具）"
7. **验证**：
   - `npm run typecheck` → 全 8 workspace 零报错
   - `npm run lint` → turbo lint 5 tasks pass
   - `npm run test -- --run` → 246 文件 / 3045 测试**不回归**
   - `grep -rn "ModerationErrorCode" /Users/livefree/projects/resovo/` → 0 命中（除归档文件）
   - `grep -rn "from '@/api/lib/errors'" apps/api/src/` → 仍 5 处（兼容 re-export 不破坏）

#### 文件作用域（不得越界）

```
packages/types/src/api-errors.ts        # 新建
packages/types/src/index.ts             # 追加 export
packages/types/src/api.types.ts         # 删 ErrorCode union + 改 re-export
packages/types/src/admin-moderation.types.ts  # 删 ModerationErrorCode union
apps/api/src/lib/errors.ts              # 改 import + 删本地字典 + 留 AppError class
docs/rules/api-rules.md                 # 修订 line 98
docs/changelog.md                       # 追加 CHG-SN-4-05a 条目
docs/task-queue.md                      # CHG-SN-4-05a 状态 ⏳ → ✅ + DEBT-SN-4-05-C 完全关闭
docs/tasks.md                           # 删除本卡片
```

**禁止触碰**：
- apps/api 内 `routes/` `services/` `db/queries/` 任何文件（仅 errors.ts 本身改动；其他文件 re-export 兼容不需改）— **如发现需要改任何路由/服务文件，BLOCKER 上报**
- apps/server-next / apps/web-next / apps/worker（本卡不涉及前端 / worker 接入）
- packages/admin-ui / packages/design-tokens / packages/player-core
- docs/decisions.md（ADR-110 已 accepted，不修改）
- docs/architecture.md（ADR-110 引用已落 main，不再改）
- 任何测试文件（除非 typecheck 因类型变更必须 fix）

#### Step 表

| Step | 内容 | 依赖 | 验证 |
|---|---|---|---|
| 1 | 新建 `packages/types/src/api-errors.ts`（ApiErrorBody + ERRORS 13 码 + ErrorCode union） | 无 | typecheck（packages/types） |
| 2 | `packages/types/src/index.ts` +export | Step 1 | typecheck（packages/types + 下游全部） |
| 3 | `apps/api/src/lib/errors.ts` 删本地字典 + 改 import + re-export | Step 2 | apps/api typecheck + 全量 unit |
| 4 | `admin-moderation.types.ts` 删 ModerationErrorCode + 检查消费方 | Step 2 | grep ModerationErrorCode = 0 + typecheck |
| 5 | `api.types.ts` 删旧 7 码 ErrorCode + 改 re-export | Step 4 | typecheck + 全量 unit |
| 6 | `docs/rules/api-rules.md:98` 修订真源位置 | Step 3-5 完成 | 文档级，无技术验证 |
| 7 | 全门禁：typecheck + lint + 全量 unit + grep 校验 | 全部 | 246f / 3045t 不回归 |

#### 质量门禁

```bash
npm run typecheck      # 全 8 workspace 零报错
npm run lint           # turbo lint 5 tasks pass
npm run test -- --run  # 246 文件 / 3045 测试不回归（如有测试文件因类型变更失败，仅可修类型不可改测试断言语义）
```

**grep 校验**：
```bash
grep -rn "ModerationErrorCode" packages/ apps/   # 期望 0 命中
grep -rn "from '@/api/lib/errors'" apps/api/src/ # 期望仍 5 处（兼容 re-export）
grep -rn "ApiResponse<\|ApiError\|ErrorCode" packages/types/src/ | wc -l  # 期望 ≥ 5（api-errors + api.types + admin-moderation re-export）
```

#### 完成判据

- ✅ 全部质量门禁通过 + 全部 grep 校验通过
- ✅ 三源漂移消除：单一真源 = `packages/types/src/api-errors.ts`
- ✅ apps/api 调用方零业务代码改动（仅 errors.ts 内部 import 重构）
- ✅ DEBT-SN-4-05-C 完全关闭（task-queue.md 欠账登记表更新状态）
- ✅ CHG-SN-4-07 / -08 准入条件全部满足

#### 风险与回退

- **风险 1**：`packages/types/src/index.ts` 用 `export * from './api-errors'`（**值导出**，不可用 `export type *`）— 误用 `export type *` 会导致 ERRORS 字典 runtime 不可用。**Step 2 验证手段**：从 apps/api 内 `import { ERRORS } from '@resovo/types'` 后跑 typecheck + 一次单元测试，确认 ERRORS.NOT_FOUND.code === 'NOT_FOUND'
- **风险 2**：admin-moderation.types.ts 删 ModerationErrorCode 后，全仓 grep 命中 → 必须按 ADR-110 §决策 5 改 import + Pick 收窄；如命中点 > 5 处 → 评估是否拆分为子卡
- **风险 3**：api.types.ts 删旧 7 码 ErrorCode 后，旧 7 码（如 `'CONFLICT'`）已被业务代码使用 → 必须验证业务实际写的是 `'STATE_CONFLICT'` 而非 `'CONFLICT'`（grep `'CONFLICT'` 的字面量使用）；如发现真实 `'CONFLICT'` 字面量使用 → BLOCKER（涉及业务码语义，不可静默改）
- **回退**：本卡所有改动可一次 `git revert` 回到 main `0ee205d`（ADR-110 落地 commit）；ADR-110 不回退（决策已 accepted）

#### 集成

- 单卡集成（非并行 Track），完成后直接 commit 到 main：
  - `chg(CHG-SN-4-05a): ADR-110 方案 B 迁移 — ErrorCode 真源归一`
  - 含质量门禁结果 + grep 校验输出 + 任务卡删除 + task-queue 状态更新

#### 与 ADR-110 / 后续卡的关联

- 本卡完成 → DEBT-SN-4-05-C 完全关闭 → CHG-SN-4-07 / -08 解锁
- 本卡**不涉及** server-next 前端 API 客户端层实装（任务卡范围 `apps/server-next/src/lib/api/**` 由 -07/-08 按 feature 分布在 `lib/<feature>/` 中实装，本卡不强制建统一目录 — ADR-110 §决策 4）

---
