# Resovo（流光） — 日志体系规范

> status: active
> owner: @engineering
> scope: logging system implementation rules (api / worker / browser / dev orchestration)
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-26


> 适用范围：所有涉及日志格式、logger 接入、PII 脱敏、错误聚合、客户端上报的任务
> AI 在编写日志相关代码或新增 logger 接入前必须读取本文件
> 实施代码已完成 SEQ-20260425-LOG-V1（INFRA-07 ~ INFRA-16），本规则提炼自该序列的最终决策与硬规则

---

## 1. 最终决策表

8 项决策为 SEQ-20260425-LOG-V1 实施基础。本规则文档**仅引用编号 1..8**，不再使用任何中间编号。

| # | 决策 | 提案原文位置 |
| --- | --- | --- |
| 1 | 把 `packages/logger` 作为新 workspace 包（而非放在 `apps/api/src/lib`），跨 app 复用 | 原第 9 节决策 1 |
| 2 | client-log endpoint 用「匿名 + IP 桶」基线：dev 全开匿名 / prod 仅登录用户 | 原第 9 节决策 2 |
| 3 | prod 应用进程**不写文件**，仅 stdout / stderr；文件落盘统一由编排层（dev.mjs / 容器 / PaaS）完成 | 原第 9 节决策 3 |
| 4 | errors 跨服务聚合用 B 路径：`dev.mjs` 解析每行 ndjson，复制 `level >= warn` 到 `logs/errors/` | 原第 9 节决策 4 |
| 5 | 不把 `CrawlerTaskLogService` 等业务日志（落 DB）合并进新 logger；技术日志走 stdout / 文件，业务日志走 DB | 原第 9 节决策 5 |
| 6 | **不引入** `pino-pretty`，由 logger 在 dev 模式下自带轻量格式化（`packages/logger/src/levels.ts:formatPretty`，~40 行 ANSI 着色） | 复核新增决策 8 → 用户重编号 6 |
| 7 | 首期 `packages/logger` **仅导出类型 + 序列化器 + redact 表 + level 工具**，不导出 `createLogger` 实现；各 app 各自实装（监测期满后由 INFRA-12 下沉） | 复核新增决策 9 → 用户重编号 7 |
| 8 | 新增 INFRA-12（LOG-06）作为隐式后续任务，无 deadline；触发条件：INFRA-10 完成 ≥ 2 周无回归后排程实现下沉 | 复核新增决策 10 → 用户重编号 8 |

---

## 2. Level 选择指南

pino 6 级 level，按 numeric value 升序：

| Level | numeric | 语义 | 项目使用场景 |
| --- | --- | --- | --- |
| `trace` | 10 | 极细粒度调试（请求体逐字段、循环每轮等） | 当前未使用 |
| `debug` | 20 | 开发期诊断信息 | dev 模式下默认级别（`computeLevel('development') === 'debug'`） |
| `info` | 30 | 业务正常事件（access log / job done / worker registered） | **主流**：access log / worker 生命周期 / 业务里程碑 |
| `warn` | 40 | 可恢复异常 / 性能阈值告警 / 非致命降级 | job retry / cache miss / 限流 / illegal state transition |
| `error` | 50 | 业务失败（仍可继续提供服务） | 单次 job 失败 / 单次外部调用失败 / 解析错误 |
| `fatal` | 60 | 进程级致命错误（不可恢复） | 启动期 DB 连接失败 / 配置缺失 |

**level 计算规则**（`@resovo/logger/levels.ts:computeLevel`）：

```ts
test         → 'silent'   // 测试期不污染输出
development  → 'debug'    // dev 全量
其他         → 'info'     // prod / staging / 默认
```

**errors 聚合阈值**（`scripts/dev.mjs:142-147` `isWarnOrAbove`）：

```text
level >= 40 (warn / error / fatal) → 复制到 logs/errors/errors-<date>.ndjson
level <  40 (info / debug / trace) → 不复制
```

---

## 3. PII 红线硬规则

### 3.1 11 字段必脱敏（顶层 + `*.field` 嵌套）

完整列表（`packages/logger/src/redact.ts:REDACT_PATHS`）：

```
authorization     cookie         set-cookie     password
token             refreshToken   accessToken    email
phone             ip             url.query
```

每个字段同时配置 `*.field` 嵌套路径覆盖一级嵌套（如 `*.password` 覆盖 `ctx.password`）。

**额外覆盖容器路径**：
- `headers.set-cookie` — 防 set-cookie 在 headers 容器中泄露
- `req.url.query` — 防 query 在 req 序列化容器中泄露
- 未来如新增标准容器路径，加在 `REDACT_PATHS` 中

### 3.2 禁止把原始对象直接放入 ctx（硬规则）

```ts
// ❌ 禁止
log.info({ req: request }, 'access')              // 整个 req 对象会暴露所有 headers
log.info({ res: reply.raw }, 'response')          // 暴露 set-cookie 等
log.error({ headers: req.headers }, 'auth fail')  // headers 含 authorization

// ✅ 必须
import { serializeReq, serializeErr } from '@resovo/logger'
log.info({ req: serializeReq(request) }, 'access')
log.error({ err: serializeErr(error) }, 'auth fail')
```

`serializeReq` 仅取 `request_id / method / url`（且 url 已切 query），`serializeErr` 仅取 `type / message / stack / statusCode`。

Fastify 自动应用：在 `createFastifyLoggerOptions()` 中已配 `serializers: { req: serializeReq, err: serializeErr }`，路由内 `request.log.info({ err })` 会自动 normalize。

### 3.3 自定义字段命名约束

字段名是**字面量精确匹配**（pino redact 不做语义匹配）。这意味着同义异名的字段会绕过 redact 表：

| 错误命名 | 问题 | 正确做法 |
| --- | --- | --- |
| `source_ip` | redact 仅匹配 `ip` / `*.ip`，不匹配 `source_ip` → IP 明文泄露 | 使用 `ip` 字段名（让 redact 生效），或改 hash/truncate 字段如 `ip_hash`，或干脆不写（用 `request_id` 关联） |
| `user_email` | 同理不匹配 `email` | 用 `email` 字段名 |
| `auth_token` | 同理不匹配 `token` | 用 `token` 字段名 |

**INFRA-16 教训**（参考 `docs/changelog.md`：INFRA-10 用 `source_ip` 写明文 IP，INFRA-16 删除字段闭环）：写新字段前先核对 `REDACT_PATHS`，**字段名必须能被 redact 表精确匹配**，否则要么改名对齐，要么 hash/truncate 后写入。

### 3.4 PII 测试范式

新增字段后需要单元测试覆盖：路径表层 + pino 行为层（`tests/unit/lib/logger.test.ts:pino integration redact behavior` 块为模板）：

```ts
import pino from 'pino'
import { Writable } from 'node:stream'
import { REDACT_PATHS } from '@resovo/logger'

const SECRET = 'TEST_SECRET_TOKEN_XYZ'

function captureLog(fn: (logger: pino.Logger) => void): { raw: string; obj: Record<string, unknown> } {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk, _enc, cb) { chunks.push(String(chunk)); cb() },
  })
  const logger = pino({ redact: { paths: [...REDACT_PATHS], censor: '<redacted>' } }, stream)
  fn(logger)
  return { raw: chunks.join(''), obj: JSON.parse(chunks.join('')) }
}

it('redacts new field at top level', () => {
  const { raw, obj } = captureLog(log => log.info({ newField: SECRET }))
  expect(raw).not.toContain(SECRET)
  expect(obj.newField).toBe('<redacted>')
})
```

---

## 4. `logger.child` 派生范式

三种场景统一接口（`apps/api/src/lib/logger.ts`）：

### 4.1 Request 派生（route handler 自动）

Fastify 自动注入 `request.log` 已带 `request_id` 顶层字段（pino `requestIdLogLabel: 'request_id'` 配置生效，见 `apps/api/src/server.ts:54`）：

```ts
fastify.get('/v1/example', async (request, reply) => {
  request.log.info({ user_id: '123' }, 'example access')
  // 输出: {"request_id":"<uuid>", "user_id":"123", "method":"GET", "url":"/v1/example", "msg":"example access"}
})
```

### 4.2 Worker 派生（worker 模块顶层）

```ts
import { baseLogger } from '@/api/lib/logger'

const workerLog = baseLogger.child({ worker: 'crawler-worker' })
workerLog.info({ count: 100 }, 'crawl started')
// 输出: {"worker":"crawler-worker", "count":100, "msg":"crawl started"}
```

### 4.3 Job 派生（Bull processor 内）

```ts
import { withJob } from '@/api/lib/logger'

queue.process('jobName', 1, async (job) => {
  const jobLog = withJob(workerLog, job)
  jobLog.info({ stage: 'parse' }, 'job processing')
  // 输出: {"worker":"crawler-worker", "job_id":"42", "stage":"parse", "msg":"job processing"}
})
```

`withJob` 派生包含 `worker:` 上下文 + Bull job_id。当 processor function 接收 `job` 参数时，**必须**派生 `withJob(workerLog, job)` 传给业务逻辑（参考 INFRA-14 修补 maintenanceWorker / imageBackfillWorker）。

### 4.4 派生原则

- **每层只增字段，不覆盖**：`child({ worker: 'x' })` 在已有 `service:'api'` 之上叠加，不覆盖 base
- **字段命名 snake_case**：`request_id` / `job_id` / `worker`（一致与现有 ndjson 约定）
- **派生器不重写 service**：service 由 `createLogger({ service })` 一次性绑定，child 无法变更（如需写 `service:'client'` 必须创建新 logger 实例，参考 `apps/api/src/routes/internal/client-log.ts:67`）

---

## 5. ServiceName 命名规范

`@resovo/logger/types.ts:ServiceName` 定义：

```ts
export type ServiceName =
  | 'api'              // Fastify API 进程
  | `worker:${string}` // workers（如 worker:crawler-worker）
  | 'script'           // 一次性脚本（如 migrate / import-sources）
  | 'client'           // 浏览器上报路径，由 client-log endpoint 派生
```

### 5.1 `worker:` 子格式约束

格式为 `worker:<kebab-case-name>`：

| 实例 | 来源 |
| --- | --- |
| `worker:crawler-worker` | `apps/api/src/workers/crawlerWorker.ts` |
| `worker:maintenance-worker` | `apps/api/src/workers/maintenanceWorker.ts` |
| `worker:image-health-worker` | `apps/api/src/workers/imageHealthWorker.ts` |
| `worker:blurhash-worker` | `apps/api/src/workers/imageBlurhashWorker.ts` |
| `worker:backfill-worker` | `apps/api/src/workers/imageBackfillWorker.ts` |
| `worker:enrich-worker` | `apps/api/src/workers/enrichmentWorker.ts` |
| `worker:verify-worker` | `apps/api/src/workers/verifyWorker.ts` |
| `worker:crawler-scheduler` | `apps/api/src/workers/crawlerScheduler.ts` |
| `worker:maintenance-scheduler` | `apps/api/src/workers/maintenanceScheduler.ts` |

新增 worker 时按此命名延续。

### 5.2 client 流分流

`scripts/dev.mjs:189` 见到 ndjson 中 `service:'client'` 自动分流到 `logs/client/client-<date>.ndjson`，同时也写到 `logs/dev/api.ndjson`（dev.mjs 在 API stdout 入口处理）。

---

## 6. 守门 D — Changelog 日志格式样例（通用规则）

**所有涉及日志格式或新 logger 接入的任务**（包括但不限于：新 worker / 新前端模块迁 console / 修改 redact 表 / 修改 serializer / 新 service 接入 logger），changelog 条目必须附 **≥ 3 行真实日志格式样例**（脱敏后），覆盖 info / warn / error 三级各一条。

### 6.1 样例采集要求

- **必须**从真实运行的 `logs/dev/<service>.ndjson` 中抓取（不得编造、不得用 RFC 4122 占位 UUID）
- 真实 timestamp（不得整点对齐如 `2026-04-25T19:25:00.000Z`）
- 脱敏：去掉真实 host / IP / 端口（保留 path）；redact 字段已自动脱敏
- 字段顺序保持 ndjson 原序（pino 输出顺序），不重排

### 6.2 历史范例（可作为模板参考）

| 任务 | changelog 锚点 | 覆盖维度 |
| --- | --- | --- |
| INFRA-07/13 | `dev.mjs` 落盘 + JSON 字段补齐 enrich 后基线 | 5 路径 access |
| INFRA-08/14 | API 接入 + maintenance/backfill withJob | access / worker job / job done |
| INFRA-13 | enrich 后字段一致基线 | 5 类样例 |
| INFRA-14 | F4-F7 修复后 access / worker / withJob | 5 路径全栈 |
| INFRA-10/16 | client-log endpoint 5 分支 + 三输入 | 200/400/403/429 + window.onerror/unhandledrejection/console.error |

新任务可对照上述任一历史 changelog 条目作为格式模板。

---

## 7. 浏览器→API 链路硬规则（INFRA-16 起强制）

INFRA-10 完成时用 `curl http://localhost:4000/v1/internal/client-log` 直连 API 端口验证 5 分支，**绕过了**浏览器(`:3000`) → API(`:4000`) 真实跨 origin 路径，导致 F1（相对路径 ENDPOINT）漏检。INFRA-16 修复后正式纳入硬规则：

**涉及浏览器→API 链路的任务**，验收必须包含以下二者**至少其一**：

1. **真实浏览器实测**：dev 启动 → 打开 `http://localhost:3000` → F12 devtools → 触发对应路径 → Network 面板确认 POST 目标 + 检查 ndjson 落盘
2. **curl 携带 `Origin: http://localhost:3000` 头模拟跨 origin 路径**（与浏览器 sendBeacon / fetch 的 wire 行为等价，除 page-unload 时序由单测覆盖）

**禁止**：仅用 `curl http://localhost:4000/...` 直连 API 端口验证浏览器路径——这会绕过 fastify-cors 与 cookie 携带行为。

### 7.1 跨 origin 配置基线

- 服务端 `apps/api/src/server.ts:71-81` 全局 `@fastify/cors` 配置 `credentials: true`
- 浏览器侧 fetch 必须 `credentials: 'include'`（参考 `apps/web-next/src/lib/logger.client.ts:73-78`）
- API URL 必须用绝对 URL（`process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'`），**不得**用相对路径

### 7.2 CORS 拒绝映射为 403

`server.ts` 已配全局 `setErrorHandler` 把 `'Not allowed by CORS'` Error 映射为 HTTP 403 + `code: 'FORBIDDEN_ORIGIN'`（参考 INFRA-16 commit）。新增内部端点不需要重复实现 origin 检查——全局 CORS 已统一处理。

---

## 8. 验收清单（来自 INFRA-07..16 综合）

任何涉及日志体系的任务完成前必须通过：

### 8.1 代码层守门
- [ ] `npm run typecheck`（4 workspace 全过）
- [ ] `npm run lint`（不增加新 warning，既有 react-hooks/exhaustive-deps 不阻塞）
- [ ] `npm run test:run`（全集 PASS，含新增/修改的单测）

### 8.2 日志格式守门
- [ ] changelog 条目附 ≥ 3 行真实样例（info / warn / error 各一）
- [ ] 字段命名 snake_case，与现有 ndjson 一致
- [ ] 不引入新顶层字段而不更新 logger.ts / redact.ts / 本规范文档

### 8.3 PII 守门
- [ ] 新字段名能被 `REDACT_PATHS` 精确匹配（或显式声明为非敏感）
- [ ] 新增 PII 字段时，redact 表 + 单测同步（路径表层 + pino 行为层双覆盖）
- [ ] `grep` 验证：注入唯一 secret 字符串（如 `TEST_SECRET_<TASKID>`）后 `logs/dev/*.ndjson` 0 命中

### 8.4 浏览器→API 链路守门（如适用）
- [ ] 真实浏览器实测 或 curl 携带 `Origin` 头
- [ ] 禁止 `curl localhost:4000` 直连 API 端口替代浏览器路径

### 8.5 流程守门
- [ ] tasks.md 工作台卡片先于代码改动落盘（INFRA-14 起硬规则，连续两次违反 P1-3 后根除）
- [ ] task-queue.md 状态 ⬜→🔄→✅ 与 tasks.md 同步
- [ ] git commit 前清空 tasks.md（任务完成）

---

## 9. 相关文件索引

| 角色 | 文件 |
| --- | --- |
| 公共契约 | `packages/logger/src/{types,serializers,redact,levels,index}.ts` |
| API logger | `apps/api/src/lib/logger.ts` |
| Web-next 浏览器 logger | `apps/web-next/src/lib/logger.client.ts` |
| Web-next 服务端 logger | `apps/web-next/src/lib/logger.server.ts`（INFRA-10 预备入口） |
| Client log 接收端点 | `apps/api/src/routes/internal/client-log.ts` |
| Dev 落盘编排 | `scripts/dev.mjs` |
| 规则原文 | `docs/logging_system_proposal_20260425.md`（提案 + 评审 + 决策原文） |
| 实施 changelog | `docs/changelog.md`（搜 `INFRA-07` ~ `INFRA-16`） |
