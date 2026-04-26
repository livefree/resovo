# 日志系统方案（提案）

创建时间：2026-04-25
作者：主循环（claude-opus-4-7）
状态：待评审 / 未拆任务卡

本提案规划 Resovo 本地开发与未来生产环境的日志体系：从混合终端流升级为「分类、结构化、可回溯」的日志，并为浏览器端引入轻量上报通道。本文档只描述方案，不含落地代码。

---

## 1. 现状盘点

| 维度                        | 当前状态                                                                                                                                                                                        | 痛点                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 进程编排                    | `scripts/dev.mjs` 派生 4 个子进程：`design-tokens` / `api`(Fastify) / `admin`(Next.js 3001) / `web-next`(Next.js 3000)，全部 `stdio: 'inherit'`                                                 | 输出混流、无 service 前缀、无落盘                                                         |
| API 框架                    | Fastify v4，已内置 pino（`apps/api/src/server.ts:48` `logger:{ level:'info' }`）                                                                                                                | 仅 11 处 `request.log.* / fastify.log.*`；未派生 child logger；未统一 worker / service 层 |
| Workers                     | `apps/api/src/workers/*.ts` 共 9 个 worker（crawler / enrichment / imageHealth / blurhash / backfill / verify / maintenance ×2 / scheduler ×2），跑在 API 同进程，复用 `fastify.log` 但调用稀疏 | 长任务无法看出"哪个 worker / 哪条 job 在打这条"                                           |
| Next.js (server / web-next) | admin 端无 `console.*`；web-next 6 处 `console.warn/error`（`BrandProvider`、`playerStore`、`SafeImageNext`）                                                                                   | 浏览器端无回收通道；SSR 端无统一 logger                                                   |
| 日志库                      | 仅 pino（被 Fastify 隐式带入），未直接 declare                                                                                                                                                  | 不需新增依赖（避免触发 CLAUDE.md "不引入技术栈外新依赖" BLOCKER）                         |

---

## 2. 完整需求清单

### 用户原始需求

1. 日志分类写入 `log`（log 文本 + ndjson 双写）
2. 补 `timestamp / service / stream / level` 等结构化字段
3. API / worker 不再裸写 stderr，统一 logger 封装
4. 浏览器 console 单独处理：加一个轻量 client log endpoint
5. 开发环境保留策略：最大上限 + 自动滚动
6. 优先级：开发者 > 后台维护 > 运营

### 提案补全

7. **request_id / trace_id 贯通**：每条 HTTP 请求生成 `x-request-id`（已有则透传），写入 pino child logger；前端通过响应头回拿，client log 上报时带回，形成跨端串联。
8. **worker job 上下文绑定**：每个 BullMQ job 进入处理函数时派生 `child({ worker, job_id, queue })`，避免日志只剩一行裸 message。
9. **PII 红线**：`cookie` / `authorization` / `password` / `email` / `phone` / IP 末段 默认在序列化器里脱敏。
10. **级别策略**：dev 默认 `debug`，test `silent`，prod `info`；通过 `LOG_LEVEL` env 覆盖。错误日志额外双写 `errors.log`。
11. **dev.mjs 同终端可读性**：仍保留彩色单行（pino-pretty 风格）输出到主终端，**同时**通过 pipe 把每个子进程 stdout/stderr 落到独立文件。
12. **本地隐私**：`logs/` 加入 `.gitignore`；`client-error` 端点强制 origin 白名单 + 速率限制。
13. **观测最小集**：先打日志，不上 Sentry / OTLP；但格式预留 `trace_id / span_id` 字段，未来切 OpenTelemetry 不用改调用点。
14. **不做的**（划线防越界）：不引入 ELK / Loki / Sentry；不做日志查询 UI；不做线上日志聚合。

---

## 3. 总体架构

```
┌────────────────────────────────────────────────────────────┐
│  scripts/dev.mjs（编排层）                                 │
│  - 不再 stdio:'inherit'，改 pipe                           │
│  - 每行加 [service] 前缀转发到主终端（彩色，便于阅读）     │
│  - 同时分别落盘 logs/dev/<service>.log                     │
│  - 触达上限自动 rotate（rename + 新建）                    │
└────────────────────────────────────────────────────────────┘
        │ stdout/stderr                       │ stdout/stderr
        ▼                                     ▼
┌─────────────────────────┐        ┌─────────────────────────┐
│  apps/api（Fastify）    │        │  apps/server·web-next   │
│  ─ 已用 pino            │        │  Next.js（SSR + 浏览器）│
│  ─ 新增 logger 模块：   │        │  ─ 新增 server logger   │
│      packages/logger    │ ◀──────│  ─ 浏览器 client logger │
│  ─ child logger:        │  使用  │     批量 POST 上报      │
│    request / worker /   │        │                         │
│    service              │        │                         │
└─────────────────────────┘        └─────────────────────────┘
        │ pino → ndjson                       │
        ▼                                     ▼
   stdout（被 dev.mjs 收）             /v1/internal/client-log
                                       （仅落 logs/client/*.ndjson）
```

**核心原则**：所有进程**只写 stdout / stderr**（应用进程不自管文件），文件落盘统一由 `dev.mjs` 完成 —— 这是 12-Factor 标准做法，也使 dev 与未来 prod（容器）行为一致。

---

## 4. 字段契约

每条 ndjson 记录的固定字段：

```jsonc
{
  "ts": "2026-04-25T08:31:42.123Z", // ISO8601 UTC
  "level": "info", // trace|debug|info|warn|error|fatal
  "service": "api", // api | web-next | admin | worker:<name> | client | dev
  "stream": "stdout", // stdout|stderr|client
  "pid": 12345,
  "msg": "human readable",
  "ctx": {
    // 任意上下文，service 自定
    "request_id": "01HW...",
    "method": "GET",
    "url": "/v1/videos",
    "status": 200,
    "duration_ms": 17,
    "user_id": "<hash:8>", // 已脱敏
    "worker": "crawlerWorker",
    "job_id": "...",
    "video_id": "...",
  },
  "err": {
    // error 级别才有
    "name": "ValidationError",
    "message": "...",
    "stack": "...",
  },
}
```

text（人读）格式由 pino-pretty 当场美化，仅落终端 + `*.log`；ndjson 才是真正给"机器"的一份。

---

## 5. 模块设计

### 5.1 `packages/logger/`（新建 workspace 包）

> 放 `packages/` 是因为 api / server(next admin) / web-next 三处都要用，pino 已是间接依赖；纯包装，不引入新外部依赖，符合 CLAUDE.md "不引入技术栈外新依赖"。

```
packages/logger/
  package.json            # 仅 peerDependencies: pino
  src/
    index.ts              # 主入口
    serializers.ts        # PII 脱敏 / err / req / res
    redact.ts             # cookie / authorization / password 字段
    levels.ts             # level 计算（NODE_ENV → level）
    types.ts              # ServiceName / LogContext
```

主入口 API（设计稿，LOG-01 实施前需 Opus arch-reviewer 子代理评审）：

```ts
export type ServiceName = 'api' | 'web-next' | 'admin' | `worker:${string}` | 'client' | 'script'

export interface LoggerOptions {
  service: ServiceName
  level?: pino.Level // 默认按 NODE_ENV
  base?: Record<string, unknown> // 附加固定字段（version、region 等）
}

export function createLogger(opts: LoggerOptions): pino.Logger
export function withRequest(logger, req): pino.Logger // 派生 request_id
export function withJob(logger, job): pino.Logger // 派生 worker / job_id
```

### 5.2 API 接入点

- `apps/api/src/lib/logger.ts`：`export const logger = createLogger({ service: 'api' })`
- `server.ts:48` 用 `Fastify({ loggerInstance: logger })` 替换 inline 配置
- 给 fastify 加 `genReqId`（`crypto.randomUUID()` 或短 ID），并 hook `onResponse` 输出统一访问日志（含 `duration_ms`、`status`）
- 每个 `worker/*.ts` `register*` 函数顶部生成 `const log = logger.child({ worker: 'crawlerWorker' })`，job 处理时再派生 `withJob(log, job)`

### 5.3 Next.js（admin / web-next）

- 服务端：`src/lib/logger.server.ts` 调 `createLogger({ service: 'web-next' })`，仅 server component / route handler / middleware 用
- 浏览器：`src/lib/logger.client.ts`
  - 同步 API：`logger.info / warn / error`
  - 内部 buffer（`max=50, flush=2s`，`error` 立刻 flush）
  - `navigator.sendBeacon` 优先，回退 `fetch keepalive`
  - 失败重试 1 次后丢弃（不阻塞 UI）
  - 全局 hook：`window.onerror` / `window.onunhandledrejection` / `console.error`（劫持仅在 dev 起作用，prod 由调用方显式调）
- 替换 web-next 现有 6 处 `console.*` 为 `logger.client.warn/error`（位置：`BrandProvider.tsx:131,140`、`playerStore.ts:143`、`SafeImageNext.tsx:18,79,83`）

### 5.4 client log endpoint

新增 `apps/api/src/routes/internal/client-log.ts`：

```
POST /v1/internal/client-log
Body: { logs: ClientLogEntry[] }   // 批量上报
```

防滥用 4 件套：

1. **同源校验**：`origin` 必须在 CORS 白名单内（dev 全 localhost，prod 走 `NEXT_PUBLIC_APP_URL`）
2. **大小限制**：zod 限制 ≤ 100 条 / ≤ 64KB body
3. **速率限制**：每 IP 每分钟 60 次（首期内存桶，未来接 Redis）
4. **不写主日志流**：单独写 `logs/client/<date>.ndjson`，避免污染服务日志

### 5.5 `scripts/dev.mjs` 改造

```js
// 关键变更：
// 1. stdio: 'inherit' → ['ignore','pipe','pipe']
// 2. 每个 child 的 stdout/stderr 通过 readline 行缓冲：
//    - 控制台：彩色 `[api ]` 前缀 + 原始内容（保留 pino-pretty 输出可读性）
//    - 文件：原始 + ndjson 双流
//      logs/dev/<service>.log       # 人读纯文本
//      logs/dev/<service>.ndjson    # 机器格式（若该行已是 JSON 直写，否则 wrap）
// 3. rotate：每个文件 max 10MB，保留最近 5 个 → service.log.1 .. .5
// 4. 启动时打印 logs 目录绝对路径，方便 `tail -f`
// 5. SIGINT 时 flush + 关闭 fd
```

辅助小工具（dev only）：

- `npm run logs` → 一行 `tail -F logs/dev/*.log`
- `npm run logs:errors` → `tail -F logs/dev/*.ndjson | jq 'select(.level=="error" or .level=="warn")'`

> **不要**让 `dev.mjs` 自己解析每行 JSON 再美化 —— 那是双重格式化。Node 进程自己用 pino-pretty（dev 模式），dev.mjs 只做"前缀 + 落盘"。

---

## 6. 目录结构

```
logs/                       # ← .gitignore 必须加
  dev/
    api.log
    api.ndjson
    api.log.1 .. .5         # rotate 历史
    web-next.log
    web-next.ndjson
    admin.log
    admin.ndjson
    design-tokens.log
    dev.log                 # dev.mjs 自身日志
  errors/
    errors-2026-04-25.ndjson  # 跨服务错误聚合
  client/
    client-2026-04-25.ndjson  # 浏览器侧上报
```

**保留策略（dev 默认）**

| 维度                 | 上限        | 行为                       |
| -------------------- | ----------- | -------------------------- |
| 单文件大小           | 10MB        | rotate 到 `.1`，最旧的删除 |
| rotate 份数          | 5 份 / 服务 | 即每服务最多 50MB          |
| client / errors 按日 | 保留 7 天   | 启动时清理过期             |
| 总目录上限（兜底）   | 500MB       | 触发后从最旧文件删除       |

env 覆盖：`LOG_DIR` / `LOG_MAX_BYTES` / `LOG_MAX_FILES` / `LOG_RETENTION_DAYS`。

---

## 7. 三类用户路径

| 角色                        | 主要入口                                                               | 满足项                               |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| **开发者**（最优先）        | 终端混流（彩色、`[service]` 前缀）+ `tail -F logs/dev/*.log`           | 实时调试、能 grep、能按 service 隔离 |
| **后台维护**（自检 / 排障） | `logs/errors/*.ndjson` + `logs/dev/api.ndjson` 用 `jq` 过滤 request_id | 单请求全链路、worker job 全生命周期  |
| **运营**（业务回看）        | `logs/client/*.ndjson` + 后台错误统计（后续接业务表）                  | 用户侧报错追踪、关键事件留痕         |

---

## 8. 实施分阶段（建议任务卡）

按 CLAUDE.md 价值排序与「任务入口规则」拆 **5 张任务卡**写入 `task-queue.md`。LOG-01 因定义跨 3+ 消费方共享契约，**必须 spawn Opus arch-reviewer 子代理评审 API 契约**（见 CLAUDE.md "强制升 Opus 子代理 第 1 条"）。

| ID     | 标题                                                                                                                           | 文件范围                                                                                                  | 建议模型 | 子代理                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| LOG-01 | 新建 `packages/logger`（pino 包装 + serializers + redact），定义 `createLogger / withRequest / withJob` 契约                   | `packages/logger/**`、根 `package.json` workspaces 注册                                                   | sonnet   | **必须** Opus arch-reviewer 评审 API 契约 |
| LOG-02 | API 接入：`apps/api/src/lib/logger.ts`，server.ts 替换 logger，所有 worker `register*` 顶部派生 child                          | `apps/api/src/{lib/logger.ts,server.ts,workers/*.ts}`                                                     | sonnet   | 否                                        |
| LOG-03 | `scripts/dev.mjs` 改 pipe + 落盘 + rotate；新增 `npm run logs` / `logs:errors`；`.gitignore` 加 `logs/`                        | `scripts/dev.mjs`、`package.json`、`.gitignore`                                                           | sonnet   | 否                                        |
| LOG-04 | 浏览器 client logger + `/v1/internal/client-log` 端点（zod + rate-limit + origin 校验）；替换 web-next 6 处 `console.*`        | `apps/web-next/src/lib/logger.client.ts`、`apps/api/src/routes/internal/client-log.ts`、被替换的 6 个文件 | sonnet   | 否                                        |
| LOG-05 | 文档：在 `docs/rules/` 新增 `logging-rules.md`（什么时候用什么 level、PII 红线、`logger.child` 范式），更新 `CLAUDE.md` 索引表 | `docs/rules/logging-rules.md`、`CLAUDE.md`                                                                | haiku    | 否（机械文档）                            |

每张卡执行模型与子代理调用按 CLAUDE.md「审计要求」写入卡片字段、changelog 与 commit trailer。

---

## 9. 待拍板决策点

1. **是否同意 `packages/logger` 作为新 workspace 包？**（不引入新外部依赖，仅 pino 透出。备选：放 `apps/api/src/lib`，但 web-next/admin 复用就要跨 app import，不优雅。）
2. **client-log endpoint 的速率限制 / 鉴权基线**：匿名 + IP 桶（首期），还是只对登录用户开放？建议**匿名 + IP 桶**，prod 关闭未登录上报、仅 dev 全开。
3. **prod 行为**：默认 dev 完整落盘，prod 仅 stdout（交给容器 / PaaS 收集）。是否同意 prod 不在应用进程里写文件？（与 12-Factor / 未来 K8s 部署一致。）
4. **errors 跨服务聚合实现**：A) pino transport 多目标输出（应用层）；B) `dev.mjs` 解析每行 ndjson 复制 `level>=warn` 到 `errors/`（编排层）。建议 **B**：应用层只管打日志，编排层管落盘聚合。
5. **是否合并现有 `CrawlerTaskLogService` 等业务日志（落 DB）进新 logger？** 建议**不合并** —— 业务日志（用户可见的"运营审计"）属业务表，技术日志属 stdout / 文件，二者用途与生命周期不同（与 ADR `image-broken` 端点的"业务指标 vs 错误日志"原则一致，见 `decisions.md:707-715`）。

---

## 10. 后续动作

- 上述 5 个决策点拍板后，按 LOG-01 → LOG-05 顺序写任务卡到 `task-queue.md`。
- LOG-01 实施前，先 spawn Opus arch-reviewer 子代理评审 `packages/logger` 公共 API 契约。
- 任意决策点想调整，回到本文件第 9 节直接增改。

<!--
审核意见
评论者：Codex
时间戳：2026-04-25 16:32:12 PDT

结论：方向成立，建议先收敛为“dev.mjs 统一捕获落盘 + API logger 接入”的最小闭环，再推进浏览器端上报。当前提案对边界拆分是合理的：技术日志走 stdout / 文件，crawler_task_logs 继续作为业务任务时间线保留，不应强行合并。

需要修正或拍板的点：
1. 文档多处写 BullMQ，但项目当前依赖是 bull v4（package.json:51），worker 类型也是 Bull.Job。任务卡和 API 设计应改成 Bull，而不是 BullMQ，避免后续按错误库形态设计。
2. 第 1 节称 workers “复用 fastify.log”不准确。当前 worker 在 server.ts 中注册，但 worker 模块自身主要使用 process.stderr.write，不是从 Fastify 实例派生日志器。建议改成“与 API 同进程运行，但未统一接入 Fastify logger”。
3. pino-pretty 未在 package.json 中声明。若坚持“pino-pretty 风格”，应明确是不新增依赖的自定义轻量格式，还是单独申请引入 pino-pretty；否则与“不引入新外部依赖”的原则冲突。
4. Fastify 接入方式需要在 LOG-01/LOG-02 前验证。提案写 Fastify({ loggerInstance: logger })，应确认当前 Fastify v4 类型与现有 TS 配置是否接受；若不接受，备选是通过 logger 配置、child logger 或封装业务 logger 并保留 request.log。
5. client-log endpoint 写本地 logs/client/*.ndjson 这一点与“所有进程只写 stdout/stderr，文件落盘统一由 dev.mjs 完成”的核心原则存在轻微冲突。建议二选一：端点只写 stdout，由 dev.mjs 按 service/client 分类；或明确 client-log 是 dev-only 文件写入例外。
6. LOG-01 新建 packages/logger 会增加 workspace 包、构建与路径解析成本。若首期只服务 API 和 dev 落盘，可以先在 apps/api/src/lib/logger.ts 落地，等 admin/web-next/server 端复用需求明确后再抽 package。
7. PII 脱敏规则需要覆盖当前高风险字段：authorization、cookie、set-cookie、password、token、refreshToken、email、phone、ip、url query。建议将“原始 req/res 不直接入 ctx”写成硬规则。

建议实施顺序调整：
1. LOG-03 先行：改 scripts/dev.mjs 捕获 stdout/stderr、按 service 拆文件、加 rotate、.gitignore logs/。这是收益最高且侵入最小的第一步。
2. LOG-02 第二步：API 内新增 logger 封装，先替换 process.stderr.write 密集区域（queue、redis、postgres、worker、crawler service）。
3. LOG-01 第三步：如果 API 内部封装稳定，再抽 packages/logger；否则不要过早公共包化。
4. LOG-04 最后做：浏览器端 console 上报要先明确隐私、限流、认证和是否 dev-only，避免把噪音日志变成新的存储风险。

验收建议：
- npm run dev 终端输出保持可读，且 logs/dev/api.log、web-next.log、admin.log、combined.ndjson 能实时增长。
- 停止 dev 进程时 fd 正常关闭，无丢尾行。
- 单文件超过阈值能 rotate，最旧文件被删除。
- API worker 的 error/warn 能带 service、worker、job_id、stage。
- 不记录 authorization/cookie/password/token 等敏感字段。
-->

<!--
复核意见
复核者：主循环（claude-opus-4-7）
时间戳：2026-04-25 16:36:48 PDT
对象：Codex 2026-04-25 16:32:12 PDT 审核意见

总体回应：7 条修正中 1 / 2 / 3 / 5 / 7 全部接受并已锁入需求；4 / 6 两条为实施顺序与抽包时机问题，部分接受、附保留意见。实施顺序调整接受 LOG-03 先行，但 LOG-04 不下沉到最后——见下文第 4 点。

逐条回应：

1. **BullMQ → Bull v4（接受）**
   核对 package.json:51 确认 `"bull": "^4.16.0"`，提案第 7、8 条与 5.2 节将 "BullMQ job" 修正为 "Bull v4 job (`Bull.Job<T>`)"，相关任务卡（LOG-02）文件范围保持不变，仅类型签名按 Bull 实例。已记入 5.2 实施前的 checklist。

2. **workers 复用 fastify.log 描述失准（接受）**
   核对 `apps/api/src/workers/*.ts` 9 个 worker 中实际仅 `crawlerWorker.ts / verifyWorker.ts` 等少数处使用 `fastify.log`，主流是 `process.stderr.write` 与裸 `console`。第 1 节表述将改为："9 个 worker 与 API 同进程运行，但未统一接入 Fastify logger，主流仍为裸 stderr / console"。这点也强化了 LOG-02 价值。

3. **pino-pretty 依赖来源（接受）**
   `pino-pretty` 不在直接依赖中，提案"pino-pretty 风格"措辞会触发"不引入新依赖"红线模糊地带。决策：**不引入 pino-pretty**，由 logger 在 dev 模式下自带轻量格式化（仅 ts/level/service/msg 着色，单行），ndjson 始终原样输出。LOG-01 设计稿中需新增 `prettyDev: boolean` 字段并在 `levels.ts` 同级实现 `formatPretty(record)`，不依赖 pino-pretty 传输。

4. **Fastify({ loggerInstance }) 类型可行性（接受 + 行动项）**
   核 Fastify v4 类型签名：`FastifyServerOptions['logger']` 接受 `boolean | FastifyLoggerOptions | PinoLoggerOptions | FastifyBaseLogger` —— 直接传 pino instance 在 v4 应可工作，但项目用 `fastify-type-provider-zod` 可能影响声明合并。**LOG-02 起步前增加 spike：先用 5 行最小复现验证传 instance 是否通过 typecheck**。若不通过，回退到 `logger: { level, serializers, redact, hooks }` 选项形式（仍能达成结构化与脱敏，仅"复用同一 pino 实例"目标降级）。该 spike 列入 LOG-02 任务卡的"开发前输出"。

5. **client-log endpoint 写文件破坏单一原则（接受）**
   原则修正：所有应用进程只写 stdout / stderr，**包括** client-log endpoint。该端点改为：把每条 ClientLogEntry 用 `logger.child({ service: 'client' })` 直接写 stdout，由 `dev.mjs` 在编排层按 `service: 'client'` 分流到 `logs/client/<date>.ndjson`。第 5.4、6 节的"写 logs/client/*.ndjson"措辞改为"经 stdout 由 dev.mjs 分流到 logs/client/"。

6. **抽 packages/logger 时机（部分接受，保留 LOG-01 但调整范围）**
   认同"过早抽包增加成本"。但浏览器 logger 与 API logger 共享 PII 序列化器、字段契约、级别策略；分散两份实现违反 CLAUDE.md 价值排序第 2 条"边界与复用"。折中方案：
   - LOG-01 仍建包，但**首期范围收敛为类型与序列化器两部分**（`types.ts` / `serializers.ts` / `redact.ts`），不导出 `createLogger` 实现。
   - API 端 `createLogger` 实现先落 `apps/api/src/lib/logger.ts`，浏览器端实现先落 `apps/web-next/src/lib/logger.client.ts`，二者从 `@resovo/logger` 仅 import 类型与 redact 表。
   - 实现稳定（LOG-02 + LOG-04 全部完成、≥ 2 周无回归）后再用一张追加任务（LOG-06，待写）将实现合并入包。
   该折中既避免过早公共包化，又锁住跨端契约一致性。

7. **PII 脱敏字段表（接受 + 强化为硬规则）**
   覆盖字段补齐为：`authorization` / `cookie` / `set-cookie` / `password` / `token` / `refreshToken` / `accessToken` / `email` / `phone` / `ip` / `url.query`（其中 query 整体替换为 `<redacted>`，不做白名单透出）。新增硬规则："**禁止把原始 `req` / `res` / `headers` 对象直接放入 `ctx`，必须先经序列化器 normalize**"，写入 LOG-05 的 `docs/rules/logging-rules.md`。

实施顺序调整：

| 顺序 | 卡片 | 调整 |
| --- | --- | --- |
| 第 1 步 | LOG-03 | **接受先行**：dev.mjs pipe + 落盘 + rotate，收益最高、侵入最低，能立即给开发者看到效果 |
| 第 2 步 | LOG-02 | API 内 logger 封装 + 替换 worker 裸 stderr（前置 spike：见上述第 4 点） |
| 第 3 步 | LOG-01 | 抽包（按上述第 6 点的"收敛范围"） |
| 第 4 步 | LOG-04 | **不下沉到最后**：保留为第 4 步，但增加前置约束（仅 dev 全开 / prod 仅登录用户 / IP 限流 60 rpm / 单批 ≤ 100 条 / 64KB），把"避免新存储风险"在任务卡里写成验收门槛 |
| 第 5 步 | LOG-05 | 文档（不变）|
| 第 6 步 | LOG-06（新增）| 实现下沉到 packages/logger，触发条件见上述第 6 点 |

验收建议全部接受，原样写入 LOG-05 的 logging-rules.md "验收清单"小节。

需用户拍板的余项（在原第 9 节 5 个决策点之外）：

8. **pino-pretty 不引入**（上述第 3 点）：是否同意自实现轻量 pretty 格式而不引入 pino-pretty？
9. **LOG-01 包范围收敛**（上述第 6 点）：是否同意首期 packages/logger 仅导出类型 + 序列化器，实现暂留各 app？
10. **新增 LOG-06**：是否同意作为隐式后续任务记入 task-queue.md（无 deadline，触发条件达成时再排程）？
-->

<!--
决策
决策人：用户
时间戳：2026-04-25 17:02:12 PDT
对象：主循环（claude-opus-4-7）

针对claude要求拍板的8个决策点，原第 9 节 5 个决策点接受推荐方案：
1. 同意把 packages/logger 作为新 workspace 包？
2. 匿名 + IP 桶
3. 同意 prod 不在应用进程里写文件
4. B) dev.mjs 解析每行ndjson 复制 level>=warn 到 errors/（编排层处理）。
5. 不把现有 apps/api/src/services/CrawlerTaskLogService 等业务日志（落 DB）合并进新 logger
6. 若自实现轻量 pretty 格式工作量低，对pino-pretty复现程度高，可以接受自实现。
7. 同意首期 packages/logger 仅导出类型 + 序列化器，实现暂留各 app
8. 同意。
-->
