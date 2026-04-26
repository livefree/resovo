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

`@resovo/logger/types.ts:ServiceName` **类型**定义保留 4 种：

```ts
export type ServiceName =
  | 'api'              // Fastify API 进程（实际使用）
  | `worker:${string}` // 独立 worker 进程（**类型保留，当前未实例化**）
  | 'script'           // 一次性脚本（如 migrate / import-sources，实际使用）
  | 'client'           // 浏览器上报路径，由 client-log endpoint 派生（实际使用）
```

> **重要**：`worker:${string}` 是**类型保留**给未来独立 worker 进程，当前 SEQ-20260425-LOG-V1 实施层**未使用**。API 内 Bull workers 与 API 同进程运行，统一用 § 5.1 模式（`service:'api'` + `worker:<name>` child 派生），**不**实例化为 `service:'worker:*'`。

### 5.1 当前 API 内 Bull workers 命名（实际惯例）

API 进程内的 9 个 Bull workers 与 API 同进程运行，统一用：

- 顶层 `service: 'api'`（由 `baseLogger = createLogger({ service: 'api' })` 一次性绑定，child 不覆盖 base）
- 子上下文 `worker: '<kebab-case-name>'`（child 派生时附加）

ndjson 实际输出形如：

```json
{"service":"api","worker":"crawler-worker","job_id":"42","msg":"crawl started"}
```

**不是** `{"service":"worker:crawler-worker",...}`。

9 个 worker 实例（`worker` child 字段值）：

| `worker` 字段值 | 来源 |
| --- | --- |
| `crawler-worker` | `apps/api/src/workers/crawlerWorker.ts` |
| `maintenance-worker` | `apps/api/src/workers/maintenanceWorker.ts` |
| `image-health-worker` | `apps/api/src/workers/imageHealthWorker.ts` |
| `blurhash-worker` | `apps/api/src/workers/imageBlurhashWorker.ts` |
| `backfill-worker` | `apps/api/src/workers/imageBackfillWorker.ts` |
| `enrich-worker` | `apps/api/src/workers/enrichmentWorker.ts` |
| `verify-worker` | `apps/api/src/workers/verifyWorker.ts` |
| `crawler-scheduler` | `apps/api/src/workers/crawlerScheduler.ts` |
| `maintenance-scheduler` | `apps/api/src/workers/maintenanceScheduler.ts` |

新增 API 内 Bull worker 时按此模式延续：`baseLogger.child({ worker: 'new-worker-name' })`。

### 5.2 `worker:${string}` 类型保留场景

`worker:${string}` ServiceName 类型保留给未来**独立 worker 进程**（独立部署、独立日志流、独立 stdout）。当前 SEQ-20260425-LOG-V1 实施层未使用此分支。

INFRA-12（实现下沉到 `packages/logger`）或后续任务若需引入独立 worker 进程，需另行决策（修订 dev.mjs 分流逻辑、确认 ServiceName 实例化范围、调整 changelog 字段契约），不得自动套用此类型。

### 5.3 client 流分流

`scripts/dev.mjs:189` 见到 ndjson 中 `service:'client'` 自动分流到 `logs/client/client-<date>.ndjson`，同时也写到 `logs/dev/api.ndjson`（dev.mjs 在 API stdout 入口处理）。

`service:'client'` 由 `apps/api/src/routes/internal/client-log.ts:67` 用 `createLogger({ service: 'client' })` 创建独立 logger 实例显式绑定（不能由 child 派生覆盖 base，参考 § 4.4 派生原则）。

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

## 7. 浏览器→API 链路硬规则（INFRA-16 起强制，INFRA-17 收紧分级）

INFRA-10 完成时用 `curl http://localhost:4000/v1/internal/client-log` 直连 API 端口验证 5 分支，**绕过了**浏览器(`:3000`) → API(`:4000`) 真实跨 origin 路径，导致 F1（相对路径 ENDPOINT）漏检。INFRA-16 修复后正式纳入硬规则；INFRA-17 进一步收紧"curl+Origin 是否充分"的分级判定（INFRA-11 复审教训：之前措辞写成"二选一等价"会反向降级验收）。

### 7.0 验收要求按改动类型分级

| 改动类型 | 必须真实浏览器 | curl+Origin 是否充分 |
| --- | --- | --- |
| 涉及 `sendBeacon` / page lifecycle (`pagehide`/`beforeunload`) flush | ✅ **必须** | ❌ 不充分 |
| 涉及浏览器 cookie 自动携带（`credentials:'include'`） | ✅ **必须** | ❌ 不充分（curl 不模拟 SameSite/SecureContext） |
| 仅服务端 CORS / 端点 origin 校验 | ☐ 可选 | ✅ 充分（API/CORS 快速验证） |
| 仅业务逻辑（端点内部 zod / 限流 / 鉴权） | ☐ 可选 | ✅ 充分 |

**curl + Origin 头不等价于真实浏览器**，明确 4 项局限：

1. **不模拟 sendBeacon CORS preflight** — sendBeacon 在浏览器侧会触发独立的 preflight 协议路径，curl 仅发简单 POST
2. **不携带 cookie**（SameSite=Lax / Secure-only 在 prod 模式下浏览器自动管理，curl 必须显式 `--cookie` 且无法准确复现 SameSite 策略）
3. **不触发 page lifecycle flush** — pagehide/beforeunload 是浏览器关闭/导航的真实事件，curl 不可模拟
4. **不覆盖 Network 面板真实端口验证** — 真实 bug（如 INFRA-10 P1 相对路径打到 web-next 自身）需要 devtools Network 面板看 POST 目标 host:port 才能直观确认

### 7.1 验收路径选择规则

- **涉及浏览器侧行为**（sendBeacon / cookie / page lifecycle）的任务：**必须**真实浏览器实测，除非任务卡明确降级并记录原因
- **仅服务端行为**（CORS / origin / 业务逻辑）的任务：curl+Origin 充分作为 API 快速验证手段
- **禁止**：仅用 `curl http://localhost:4000/...` 直连 API 端口验证浏览器路径（不带 Origin 头会绕过 CORS，无法暴露 INFRA-10 P1 类相对路径 bug）

### 7.2 跨 origin 配置基线

- 服务端 `apps/api/src/server.ts:71-81` 全局 `@fastify/cors` 配置 `credentials: true`
- 浏览器侧 fetch 必须 `credentials: 'include'`（参考 `apps/web-next/src/lib/logger.client.ts:73-78`）
- API URL 必须用绝对 URL（`process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'`），**不得**用相对路径

### 7.3 CORS 拒绝映射为 403

`server.ts` 已配全局 `setErrorHandler` 把 `'Not allowed by CORS'` Error 映射为 HTTP 403 + `code: 'FORBIDDEN_ORIGIN'`（参考 INFRA-16 commit）。新增内部端点不需要重复实现 origin 检查——全局 CORS 已统一处理。

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

### 8.4 浏览器→API 链路守门（如适用，按 § 7.0 分级）
- [ ] 涉及 sendBeacon / page lifecycle / cookie 携带：**必须**真实浏览器实测（curl+Origin 不充分）
- [ ] 仅 CORS / 端点 origin 校验 / 业务逻辑：curl+Origin 充分作为 API 快速验证
- [ ] 禁止 `curl localhost:4000` 直连 API 端口（不带 Origin 头）替代浏览器路径——会绕过 CORS 校验，无法暴露 INFRA-10 P1 类相对路径 bug

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
