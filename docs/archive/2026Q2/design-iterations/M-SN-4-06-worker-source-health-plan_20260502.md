# CHG-SN-4-06 · apps/worker 新建 + SourceHealthWorker Level 1+2 — 开发指导方案

> status: active
> revision: v1.1（2026-05-02 审核闭环）
> owner: @engineering
> scope: M-SN-4 apps/worker source health worker
> source_of_truth: yes（本卡执行真源）
> supersedes: none
> superseded_by: none
> parent_plan: `docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 + v1.5 patch
> task_id: **CHG-SN-4-06**（前置 CHG-SN-4-03 ✅；Step 10 feedback-driven-recheck 等待 CHG-SN-4-05 058a migration 上线，与 -05 双轨并行启动后保持松耦合）
> 建议主循环：`claude-sonnet-4-6`
> 强制子代理：否（如 parsers / cron / pg LISTEN 引入新依赖触发 BLOCKER）
> last_reviewed: 2026-05-02

## v1.1 修订摘要（2026-05-02 审核闭环）

针对审核结论 2 项阻塞 + 部分修正项：

1. **§3 / §5 worker DB pool**：现行 pool 在 `apps/api/src/lib/postgres.ts`（不是 `db/pool.ts`）；为避免跨 workspace import，**worker 自建轻量 pool**（直接消费 `pg.Pool` + 共享 env 配置），不 import apps/api 内部文件
2. **058a 前置上移 -05**：`source_health_events.processed_at` schema patch 由 -05 在自身范围内补齐（feedback 入队信号产生方）；-06 Step 1–9 可先行，Step 10 进入前必须验证 058a 已上线
3. **§2 仓内同步**：`.github` 目录当前不存在 → 改为"如存在 CI 则更新，否则记录未配置 CI"；不强制创建 `.github/workflows/`
4. **§9 commit trailer**：改用 `docs/rules/git-rules.md` §M-SN 扩展协议

---

## 1. 范围与依赖

### 1.1 交付物

1. **新建 `apps/worker` 独立 service**（plan §4.0.1，D-16）
2. **SourceHealthWorker Level 1 (probe)**：每 6h 全量 active sources
3. **SourceHealthWorker Level 2 (render check)**：5 类触发条件（plan §4.1）
4. **分辨率采集策略**（plan §4.2）：HLS / MP4 / DASH parsers
5. **视频级 `source_check_status` 聚合**（plan §4.3）：advisory lock
6. **站点级熔断 + 退避**（plan §4.0.4）：内存状态，单实例约束
7. **pino + request_id 可观测**（plan §4.0.5）：6 项必发指标
8. **feedback-driven recheck**：`feedback/playback` 连续 3 次失败 → Level 2 入队（消费 -05 入队信号）
9. **仓内同步 5 处**（plan §1 决策表 D-16）

### 1.2 前置依赖

- ✅ CHG-SN-4-03：054 (probe/render 列) / 055 / 058 (source_health_events 扩展) / 059 (resolution_detection) / 060 (review_source) migration
- ⏸ **feedback-driven-recheck 步骤必须等待 CHG-SN-4-05 内的 058a migration 上线**（`source_health_events.processed_at` + partial index）；-06 的 Step 1–9 可与 -05 并行，进入 Step 10 前 grep `apps/api/src/db/migrations/058a_*` 验证存在
- 🚫 **不复用 apps/api 内部文件**：现行 DB pool 在 `apps/api/src/lib/postgres.ts`，不暴露作 packages 共享；worker 自建 `apps/worker/src/lib/db.ts` 轻量 pool（消费 `pg.Pool` + 复用 env 变量名 `DATABASE_URL` 等），不 import apps/api 任何路径
- ⏸ CHG-SN-4-05 feedback 入队约定：通过 `source_health_events.processed_at IS NULL AND origin='feedback_driven'` queue 解耦（双方零 import 依赖）

### 1.3 ADR-107 落地（D-16）

本卡完成时将 ADR-107 草案 → 正式 ADR：apps/worker 部署归属 + 单实例约束 + 多实例外移策略（M-SN-6 性能门）。

---

## 2. 仓内同步清单（5 项 — 必须先于 worker 实装）

| # | 文件 | 改动 |
|---|------|------|
| 1 | 根 `package.json` | `workspaces` 数组追加 `"apps/worker"` |
| 2 | `package-lock.json`（或 `pnpm-lock.yaml`） | `npm install` 同步（实测使用 npm@10.8.2） |
| 3 | `TEMPLATES.md` | worker 模板章节追加（cron job / parser / circuit-breaker 模板） |
| 4 | `CLAUDE.md` | 修订 plan §4.0.1 注脚提到的 `apps/web/...` → `apps/web-next` 旧表述（视情况） |
| 5 | CI 配置（**条件化**） | 仓库 `.github/` 目录当前不存在；如本卡启动时仍无 CI 配置 → 跳过本项并在 README 记录 "CI 未配置"；如已存在则在 typecheck / lint / test 矩阵追加 `apps/worker` |

> 注 1：实测 `package.json` packageManager = `npm@10.8.2`，无 pnpm-lock.yaml；plan v1.4 §4.0.1 文本提到 pnpm 须按实际 npm 矩阵修订。
> 注 2：`.github/workflows/` 当前不存在；本卡**不主动创建** CI 目录（CI 配置应有独立专项卡）；条件化处理避免引入未授权基础设施。

---

## 3. 目录结构

```
apps/worker/
├── package.json                          # @resovo/worker
├── tsconfig.json                         # extends 根 tsconfig（workspace 一致）
├── README.md                             # 部署说明 + 单实例约束声明
├── src/
│   ├── index.ts                          # 入口：启动 cron + queue consumer + signal handlers
│   ├── config.ts                         # env / cron 表达式集中（绝不硬编码）
│   ├── jobs/
│   │   ├── source-health/
│   │   │   ├── level1-probe.ts           # HEAD / m3u8 manifest 可达性
│   │   │   ├── level2-render.ts          # HLS / MP4 / DASH render check
│   │   │   ├── aggregate-source-check-status.ts  # 视频级聚合（advisory lock）
│   │   │   └── index.ts
│   │   └── feedback-driven-recheck.ts    # 消费 source_health_events queue
│   ├── lib/
│   │   ├── db.ts                         # 自建轻量 pg.Pool（不 import apps/api 内部文件；env 变量名与 apps/api 共享）
│   │   ├── advisory-lock.ts              # pg_advisory_xact_lock 封装
│   │   ├── circuit-breaker.ts            # 站点级熔断（内存状态）
│   │   ├── retry-backoff.ts              # 指数退避（1/2/4/8/16s × 5）
│   │   └── parsers/
│   │       ├── m3u8.ts                   # HLS manifest 解析
│   │       ├── mp4-moov.ts               # MP4 moov atom 解析
│   │       ├── mpd.ts                    # DASH MPD 解析
│   │       └── index.ts
│   └── observability/
│       ├── logger.ts                     # pino + request_id 子 logger 工厂
│       └── metrics.ts                    # 6 项指标埋点（plan §4.0.5）
└── tests/
    ├── unit/
    │   ├── jobs/source-health/
    │   │   ├── level1-probe.test.ts
    │   │   ├── level2-render.test.ts
    │   │   └── aggregate-source-check-status.test.ts
    │   ├── jobs/feedback-driven-recheck.test.ts
    │   ├── lib/circuit-breaker.test.ts
    │   ├── lib/advisory-lock.test.ts
    │   ├── lib/retry-backoff.test.ts
    │   └── lib/parsers/{m3u8,mp4-moov,mpd}.test.ts
    └── integration/
        ├── source-health.integration.test.ts   # advisory lock 并发 + 熔断
        └── feedback-driven-recheck.integration.test.ts
```

---

## 4. 调度配置（plan §4.0.2）

```typescript
// apps/worker/src/config.ts
export const config = {
  cron: {
    level1Probe: process.env.WORKER_CRON_LEVEL1 ?? '0 */6 * * *',  // 每 6h
    // level2 触发驱动（无固定 cron）
    feedbackDriven: process.env.WORKER_CRON_FEEDBACK ?? '*/1 * * * *',  // 1 min 轮询入队信号
  },
  rateLimit: {
    level1Global: 20,         // req/s
    level1PerSite: 5,
    level2Global: 5,
    level2PerSite: 2,
  },
  circuitBreaker: {
    failureThreshold: 5,      // 窗口内失败次数
    windowMs: 5 * 60 * 1000,  // 5 min
    cooldownMs: 30 * 60 * 1000,  // 30 min
  },
  retry: {
    maxAttempts: 5,
    backoffMs: [1000, 2000, 4000, 8000, 16000],
  },
  workerInstanceId: process.env.WORKER_INSTANCE_ID ?? `worker-${process.pid}`,
} as const
```

cron 库选型：**优先 `node-cron`**（plan §4.0.1 已选定）；如 monorepo 已存在等价库则复用，**禁止新增重复依赖**（违反 CLAUDE.md "技术栈以外的新依赖" → BLOCKER）。

---

## 5. 关键模块设计

### 5.1 advisory lock（视频级聚合并发）

```typescript
// apps/worker/src/lib/advisory-lock.ts
import { hashtext } from './pg-utils'  // 或直接 SQL hashtext()

export async function withVideoLock<T>(
  client: PoolClient,
  videoId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await client.query('BEGIN')
  try {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`video:${videoId}`])
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
```

> 锁粒度：单 video_id 行级；事务自动释放。聚合 SQL 见 plan §4.3。

### 5.2 站点级熔断（内存状态，单实例）

```typescript
// apps/worker/src/lib/circuit-breaker.ts
type SiteCircuit = {
  failures: { ts: number }[]   // 5 min 滑窗
  cooldownUntil: number | null
}

const circuits = new Map<string, SiteCircuit>()

export function shouldSkipSite(siteId: string, now = Date.now()): boolean
export function recordFailure(siteId: string, now = Date.now()): void
export function recordSuccess(siteId: string): void  // 重置失败窗
export function getCircuitState(siteId: string): 'cleared' | 'active'  // metric 用
```

熔断触发后：probe / render 全部跳过该站点，记 `source_health_events { origin: 'circuit_breaker' }`（CHG-SN-4-03 058 已扩展支持）。

**单实例约束声明**：`apps/worker/README.md` 显式标注 + ADR-107 内嵌。

### 5.3 parsers（HLS / MP4 / DASH）

| parser | 输入 | 输出 |
|--------|------|------|
| `m3u8.ts` | manifest text | `{ variants: [{ resolution, bandwidth, url }], maxResolution }` |
| `mp4-moov.ts` | Range bytes 0–65535 | `{ width, height, duration, codec }` |
| `mpd.ts` | MPD XML text | `{ representations: [{ height, bandwidth }], maxResolution }` |

**依赖选型**：
- HLS：标准库 string parse，**不引入新依赖**
- MP4 moov：考虑 `mp4box.js` 或自实现最小 atom parser；**优先自实现**（避免新依赖）
- DASH：XML parse → 复用 `xml2js`（如 monorepo 已存在）或 native DOMParser

如必须引入新依赖：BLOCKER 写入 `docs/task-queue.md` 尾部，等待用户裁定。

### 5.4 feedback-driven-recheck

CHG-SN-4-05 feedback 端点连续 3 次失败 → INSERT `source_health_events { origin: 'feedback_driven', processed_at: NULL }` 作信号位；本 job 每 1 min LISTEN/NOTIFY 或轮询消费：

```typescript
// apps/worker/src/jobs/feedback-driven-recheck.ts
async function run() {
  // SELECT DISTINCT source_id FROM source_health_events
  //   WHERE origin = 'feedback_driven' AND processed_at IS NULL
  //   ORDER BY created_at LIMIT 100
  // 入队 Level 2 → 标 processed_at
}
```

**与 -05 解耦**：通过 `source_health_events` 表 + `processed_at` 列实现；`processed_at` 由 -05 的 058a migration 提供，本卡进入 Step 10 前只做存在性验证，缺失则等待 -05 完成，不回退到 -03。

### 5.5 可观测（pino + request_id）

```typescript
// apps/worker/src/observability/logger.ts
import pino from 'pino'
import { randomUUID } from 'node:crypto'

const root = pino({ level: process.env.LOG_LEVEL ?? 'info' })

export function jobLogger(jobName: string) {
  const requestId = `worker:${randomUUID()}`
  return root.child({ jobName, requestId, instanceId: config.workerInstanceId })
}
```

6 项指标（plan §4.0.5）：阶段一仅 pino structured log（cutover 后接入 metrics backend）；每条 log 必带 `metric: '<name>'` + `value` + label 字段。

---

## 6. 实装步骤（建议顺序）

| Step | 内容 | 依赖 |
|------|------|------|
| 1 | **仓内同步 5 项**（package.json workspaces / npm install / TEMPLATES.md / CLAUDE.md / CI） | 无 |
| 2 | `apps/worker/{package.json,tsconfig.json,README.md}` 起骨架；index.ts 空入口 + signal handlers | Step 1 |
| 3 | `lib/db.ts`（自建 `pg.Pool` 实例，env 变量名复用 `DATABASE_URL` 等；零 apps/api import）+ `lib/advisory-lock.ts` + 单测 | Step 2 |
| 4 | `lib/circuit-breaker.ts` + `lib/retry-backoff.ts` + 单测 | Step 2 |
| 5 | `observability/logger.ts` + `observability/metrics.ts` | Step 2 |
| 6 | `lib/parsers/{m3u8,mp4-moov,mpd}.ts` + 单测（**dependency-free** 实装；如不可行 → BLOCKER） | Step 2 |
| 7 | `jobs/source-health/level1-probe.ts` + 单测 | Step 3+4+5 |
| 8 | `jobs/source-health/aggregate-source-check-status.ts` + 单测（advisory lock 包裹） | Step 3 |
| 9 | `jobs/source-health/level2-render.ts` + 单测（5 类触发条件） | Step 6+8 |
| 10 | `jobs/feedback-driven-recheck.ts` + 单测（消费 source_health_events queue） | Step 8 |
| 11 | `index.ts` 串联：node-cron 启动 Level 1 + 入队消费器 + signal handler | Step 7–10 |
| 12 | integration test：advisory lock 并发 + 熔断 5 次/30 min + 退避指数 | Step 11 |
| 13 | ADR-107 草案 → 正式（apps/worker 部署 + 单实例约束 + 多实例外移） | Step 11 |
| 14 | CI 矩阵验证：`npm run typecheck` / `lint` / `test` 在 apps/worker 全绿 | Step 1+11 |

---

## 7. 完成判据（must）

- [ ] typecheck 0 error / lint 0 warning / 禁 `any`
- [ ] unit test 全绿（jobs / lib / parsers / observability）
- [ ] integration test 全绿（advisory lock 视频聚合 / 熔断 / 退避）
- [ ] 仓内同步 5 项全部落实：
  - [ ] 根 package.json `workspaces` 含 `apps/worker`
  - [ ] `npm install` 同步 lockfile
  - [ ] `TEMPLATES.md` worker 章节
  - [ ] CLAUDE.md `apps/web/...` 旧表述修订（如必要）
  - [ ] CI 配置：如 `.github/workflows/` 存在则覆盖 apps/worker（typecheck / lint / test 三项）；不存在则 README 记录 "CI 未配置"
  - [ ] **零 apps/api import**：grep `from '@resovo/api\|apps/api/' apps/worker/src/` 应 0 命中
- [ ] **零新依赖**（grep `apps/worker/package.json` 仅含技术栈以内：pino / node-cron / pg / zod 等已存在；任何新增 → 必须先 BLOCKER 用户裁定）
- [ ] **单实例约束声明**：`apps/worker/README.md` + ADR-107 双重登记
- [ ] ADR-107 草案 → 正式
- [ ] **冷启动可运行**：`npm run -w apps/worker dev` 起 worker，pino log 输出 6 项指标（mock 数据触发即可）
- [ ] commit trailer 遵循 git-rules.md §M-SN 扩展协议：`Refs:` / `Plan:` / `Review:` / `Executed-By-Model:` / `Subagents:`

---

## 8. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| MP4 moov 自实现复杂度 → 引入第三方依赖 | 中 | 中 | 先评估 65535 字节窗口 atom parser 可行性；不可行 → BLOCKER 用户裁定（不擅自加依赖） |
| node-cron 不在已有依赖中 | 低 | 低 | 检查 monorepo 既有 cron 库；如无且 plan §4.0.1 已选定 → 视为"plan 既定技术栈"允许引入（commit trailer 标注） |
| advisory lock 与 apps/api 既有事务争用 | 低 | 中 | 锁粒度 `video:<id>` 命名空间隔离；apps/api 不持同名锁 |
| 站点熔断内存状态丢失 → 重启后短暂 burst | 低 | 低 | plan §4.0.4 明确"重启清零可接受"；ADR-107 显式登记 |
| feedback queue 表列缺失（058a 未跑或被回滚） | 低 | 高 | -05 v1.1 已在自身范围内补 058a；-06 Step 10 前 grep `apps/api/src/db/migrations/058a_*` 验证；缺失 → BLOCKER 等 -05 完成 |
| 无 CI 矩阵覆盖 apps/worker（仓库未配置 CI） | 中 | 低 | 条件化处理：`.github/` 不存在不创建；本地 `npm run -w apps/worker {typecheck,lint,test}` 全绿即可；CI 接入留独立卡 |
| 跨 workspace import 形成隐性耦合 | 中 | 中 | grep 守门（§7 完成判据）；如必须共享代码 → 抽 packages/ 层（独立卡，不在 -06 范围） |

---

## 9. commit trailer 模板

遵循 `docs/rules/git-rules.md` §M-SN 扩展协议：

```
feat(CHG-SN-4-06): apps/worker 新建 + SourceHealthWorker Level 1+2

Refs: CHG-SN-4-06
Plan: docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md v1.1
Review: <arch-reviewer commit hash> PASS  # 如本卡未触发 Opus 评审写 n/a
Executed-By-Model: claude-sonnet-4-6
Subagents: none
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

> ADR-107 落地走 ADR 自身的 commit；workspaces 改动在 commit body 描述即可，不另起 trailer key。

---

## 10. 与上下游卡的契约边界

| 方向 | 卡 | 契约边界 |
|------|----|---------|
| 上游 | CHG-SN-4-03 | 054/058/059 schema ✅ |
| 上游 | CHG-SN-4-05 | 058a `processed_at` 列 + index ⏸（-05 完成后才允许 -06 进 Step 10 feedback-driven-recheck；前序 Step 1–9 可并行启动） |
| 平行 | CHG-SN-4-05 API | feedback 失败 3 次入队信号经 `source_health_events.processed_at IS NULL` 解耦；**双方零 import**；零跨 workspace 文件 import |
| 下游 | CHG-SN-4-10 收口 | apps/worker integration test + e2e 触发 worker job |

如本卡实装期间发现 schema 不足或必须引入新依赖：触发 BLOCKER 写入 `docs/task-queue.md` 尾部；不允许擅自加依赖或 schema 修补。
