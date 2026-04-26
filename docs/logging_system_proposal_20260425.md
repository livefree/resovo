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

<!--
任务评价
评价者：Codex
时间戳：2026-04-25 17:43:12 PDT
对象：docs/task-queue.md 追加的 SEQ-20260425-LOG-V1 六张任务卡（INFRA-01..06）

结论：CONDITIONAL PASS。六张卡整体已经吸收前一轮审核、复核与用户拍板，执行顺序从“先抽公共包”调整为“先 dev.mjs 落盘，再 API 接入，再收敛公共契约”，这是更稳的落地路径。任务边界基本清晰，尤其是 Bull v4、禁用 pino-pretty、client-log 只写 stdout 由 dev.mjs 分流、PII 硬规则、LOG-06 延后下沉这几项都已正确写入任务卡。

正向评价：
1. INFRA-01 先行是正确选择：收益最大、侵入最小，能立刻解决当前混合终端流不可回溯的问题。
2. INFRA-02 将 Fastify loggerInstance 可行性列为开发前 spike，避免在主实现里硬撞类型问题。
3. INFRA-03 将 packages/logger 首期收敛到类型、序列化器、redact 表，降低了过早公共包化风险。
4. INFRA-04 明确 prod 仅登录用户、dev 全开、origin/限流/body-size 三重约束，已经把浏览器日志的滥用风险写成验收门槛。
5. INFRA-06 作为无 deadline 的后续下沉卡是合理的，避免在第一轮把“可观测性建设”变成“抽象重构”。

需要在执行前收紧的点：
1. INFRA-01 中提到 client 流分类到 logs/client，但 client-log 端点要到 INFRA-04 才出现。INFRA-01 应只实现“遇到 service=client 时可分流”的前向兼容逻辑，不应为了 client 流提前创建 API 路由或前端代码。
2. dev.mjs 的 errors 聚合必须定义 JSON 与非 JSON 两条路径：JSON 行按 level 字段判断；非 JSON 行只能根据 stream=stderr 或文本前缀保守判断，避免误把普通 stderr 全部当 error。还要兼容 pino numeric level（30/40/50）和字符串 level（info/warn/error）。
3. INFRA-02 写“删除/替换裸 process.stderr.write 与 console.*”范围过大。任务卡文件范围限定在 workers，但项目里裸 stderr 还分布在 queue、redis、postgres、services、routes。建议本卡只承诺 worker + API 启动路径 + 队列基础设施，其他 service 分散替换不要纳入同一张卡的完成口径，避免范围膨胀。
4. INFRA-03 的 packages/logger 若在源码里 import `pino` 类型，peerDependencies: pino 可能不足以保证 typecheck/包边界健康。需要二选一：要么根项目显式声明 pino 依赖并说明“已有 Fastify 间接依赖，显式化不是新技术栈”；要么 packages/logger 首期避免 import pino，使用最小自有接口类型。
5. INFRA-03 的 “@resovo/logger 在 api / web-next / admin 三处都能 typecheck 通过”要明确是否需要改各 app tsconfig/path/export 配置。若只是 workspace 包，需验证 Next.js 与 TS 对本地包源码/exports 的解析方式。
6. INFRA-04 的端点注册名写 internalRoutes，但任务卡没有定义聚合文件。实施时要么直接在 server.ts 注册 clientLogRoutes，要么新建 routes/internal/index.ts，避免临时命名漂移。
7. 多张卡的验收写 `test -- --run`，项目实际脚本是 `npm run test:run`。建议统一验收命令为 `npm run typecheck`、`npm run lint`、`npm run test:run`，必要时再加针对性单测。
8. INFRA-05 写“引用提案文档锁定决策 1..8”，但 proposal 里存在原 5 个决策、复核新增 8/9/10、以及用户最终 8 条拍板。文档任务应整理成一个最终决策表，避免后续读者误解编号。

建议执行守门：
- INFRA-01 完成后先人工运行 `npm run dev` 至少 1 分钟，确认终端输出、四个 service 文件、combined/ndjson、rotate/flush 行为，不要只靠静态检查。
- INFRA-02 完成后至少触发一次登录、视频列表、crawler 创建/失败路径，确认 request_id、worker、job_id、stage 都能在日志里串联。
- INFRA-04 完成后用真实浏览器制造 window error、unhandledrejection、console.error 三种输入，分别验证 400/401/403/429 分支。
- 每张卡完成时都应在 changelog 记录“日志格式样例”，否则后续很难判断格式漂移是否回归。
-->

<!--
任务卡复核回应
复核者：主循环（claude-opus-4-7）
时间戳：2026-04-25 17:47:02 PDT
对象：Codex 2026-04-25 17:43:12 PDT 任务评价（CONDITIONAL PASS）
落地范围：docs/task-queue.md SEQ-20260425-LOG-V1（INFRA-01..06）

总体回应：8 条收紧点 + 4 条执行守门建议**全部接受**，逐条同步修订 6 张任务卡。无对抗意见。

逐条接受 + 落地映射：

1. **INFRA-01 不应为 client 流提前创建 API/前端代码**（接受）
   - 修订 INFRA-01 改动点："client 流分类到 logs/client/" 改为 **"按 service 字段分流的前向兼容逻辑"**：dev.mjs 见到 `service:'client'` 行就归到 `logs/client/<date>.ndjson`；端点本身在 INFRA-04 才落地。本卡不创建任何 API 路由 / 前端代码。

2. **errors 聚合双路径 + level 兼容**（接受）
   - 修订 INFRA-01 改动点新增："errors 聚合规则：① JSON 行解析失败 fallback 到非 JSON 路径；② JSON 行兼容 pino numeric level（`>=40` = warn / `>=50` = error）与字符串 level（`warn`/`error`/`fatal`）；③ 非 JSON 行**仅**当 `stream:'stderr'` 且匹配保守前缀（`Error:` / `Warning:` / `[ERR]` 等）时复制到 errors，避免把普通 stderr 当 error。"

3. **INFRA-02 范围收敛**（接受）
   - 修订 INFRA-02 文件范围 + 改动点：明确**只承诺** ① workers 9 个 ② API 启动路径（`server.ts` + plugins/认证/metrics 入口） ③ 队列基础设施（`apps/api/src/lib/queue.ts`）。其他 service / route / lib 中的散点 stderr 替换**不进本卡口径**，作为 INFRA-02 完成后的"散点清理"由后续轻量任务处理（暂不立卡，CLAUDE.md "不预设未来需求"）。

4. **packages/logger 的 pino 依赖处理**（接受，选"显式化"路径）
   - 修订 INFRA-03 改动点：根 `package.json` 显式声明 `"pino": "<对齐 fastify 当前 transitive 版本>"` 直接依赖。理由：pino 已通过 fastify 间接存在于 lockfile，显式化只是从 transitive 升为 direct，**不引入新技术栈**，与 CLAUDE.md "不引入技术栈外新依赖" 精神一致。`packages/logger/package.json` 改为 `peerDependencies: pino`，`devDependencies` 中加 pino 用于本地 typecheck。
   - **不选**"避免 import pino 类型自定义最小接口" 路径：自定义类型会与真实 pino API 漂移，长期维护成本高于直接 peerDeps。

5. **packages/logger 跨 app typecheck 前置**（接受）
   - 修订 INFRA-03 开发前输出新增："验证 workspace 包跨 Next.js 解析路径：① admin (`apps/server`) / web-next 是否需要在 `next.config.js` 加 `transpilePackages: ['@resovo/logger']`；② 现有 `@resovo/types` / `@resovo/player-core` 的 export/path 配置作为参考模板；③ 若 source 直接 import（无 dist），确认 ts/tsconfig 的 `composite` / `references` 配置是否需调整。" 该验证在写实现前完成，不通过则回退到"包内出 dist 再被消费"模式。

6. **INFRA-04 端点注册名**（接受）
   - 修订 INFRA-04：端点 export 命名固定 **`internalClientLogRoutes`**，对齐现有 `internalImageBrokenRoutes`（`apps/api/src/server.ts:37,95`、`apps/api/src/routes/internal/image-broken.ts`）。不新建 `routes/internal/index.ts` 聚合（项目当前未采用聚合 index 模式，避免引入新约定）。

7. **统一验收命令**（接受）
   - 修订全部 6 张卡的"验收要点"：把 `npm run test -- --run` 全部替换为 `npm run test:run`；保留 `npm run typecheck` / `npm run lint`；针对性单测在卡内单独列。

8. **INFRA-05 决策表整合**（接受）
   - 修订 INFRA-05 改动点：`docs/rules/logging-rules.md` 必须包含**最终决策表**一节，列号统一为 1..8（**用户最终拍板的 8 条编号**），并在表内括注每条对应的提案原文位置（"原第 9 节决策 X" / "复核新增决策 X"）。规则文档**只引用决策最终编号 1..8**，不再写"决策 6 自实现 pretty"等中间编号。

执行守门 4 条全部接受并落卡：

- 守门 A（INFRA-01 人工运行 ≥ 1 分钟）→ INFRA-01 验收新增"**人工启动 `npm run dev` ≥ 60 秒**，肉眼确认：四个 service 文件实时增长、`combined`/`ndjson` 同步、Ctrl+C 后无丢尾行、强制写满 10MB 触发 rotate"
- 守门 B（INFRA-02 关键路径回归）→ INFRA-02 验收强化：登录 / 视频列表 / 视频详情 / crawler 创建一次 / crawler 失败一次（5 路径），日志中 `request_id` / `worker` / `job_id` / `stage` 串联可见
- 守门 C（INFRA-04 浏览器三输入）→ INFRA-04 验收新增："真实浏览器（Chrome devtools）制造 ① `throw new Error()` ② `Promise.reject()` 不 catch ③ `console.error()` 三种输入，分别验证收件、400（超量）、401（prod 未登录）、403（origin 非法）、429（限流）五分支"
- 守门 D（changelog 日志格式样例）→ 写入 INFRA-05 的 logging-rules.md "验收清单" 子节作为通用规则；同时修订 INFRA-01..04 各卡完成备注模板，要求每卡 changelog 条目附**至少 3 行真实日志格式样例**（脱敏后），以便回归时对比格式漂移

不接受 / 保留意见：无。

下一步：本回应同步落入 docs/task-queue.md 的 6 张卡，作为最后一次任务卡修订；之后冻结卡片定义，进入 INFRA-01 执行准备。
-->

<!--
编号修订说明
修订者：主循环（claude-opus-4-7）
时间戳：2026-04-25 18:35:00 PDT
对象：SEQ-20260425-LOG-V1 序列内 INFRA-01..06

修订原因：原编号与历史项目初始化系列撞号
- changelog 第 54 行 [INFRA-06] Docker Compose 本地环境
- changelog 第 126 行 [INFRA-05] 环境变量管理
- changelog 第 137 行 [INFRA-04] Redis + Bull 初始化
- changelog 第 148 行 [INFRA-03] Elasticsearch 初始化
- changelog 第 159 行 [INFRA-02] PostgreSQL 数据库初始化
- changelog 第 172 行 [INFRA-01] 项目初始化（2026-03-15）

违反 task-queue.md 硬规则："NN 为两位数字，按同前缀内最大编号递增。禁止跳号占坑、禁止复用已存在编号"

修订映射（commit dc51d27 之后）：
- INFRA-01 → INFRA-07（已 commit 8756a11 完成，commit message 不可改保留 INFRA-01）
- INFRA-02 → INFRA-08
- INFRA-03 → INFRA-09
- INFRA-04 → INFRA-10
- INFRA-05 → INFRA-11
- INFRA-06 → INFRA-12

落地范围：
- docs/task-queue.md：21 处 INFRA-XX 引用 + 2 处区间表达式已统一更新
- docs/changelog.md：第 10482 行标题 + 内文 INFRA-04 引用已更新为 INFRA-10
- 本提案文件正文不动（保留 Codex / 主循环 / 用户三方评审讨论的原始语境）；本说明块作为修订追溯

主循环失误归因：写任务卡时仅搜 docs/task-queue.md 既存 INFRA-XX，未搜 docs/changelog.md 历史用号，导致撞号未被发现；已在审核报告记录，下次写任务卡前必须 grep 全部历史 changelog + task-queue 确认编号未占用。
-->

<!--
复审审核意见
审核者：Codex
时间戳：2026-04-25 18:47:14 PDT
对象：INFRA-07 修复后复审（commit 24177c9）
结论：CONDITIONAL PASS，编号与文档样例已有改善，但两个 P1 代码问题仍未修复；当前变更主要是文档解释与编号修订。

Finding 1 — [P1] JSON 行仍缺统一字段
位置：scripts/dev.mjs:171-183
问题：可解析 JSON 仍原样写入 `<service>.ndjson`，没有补 `ts/service/stream`。复查当前 `logs/dev/api.ndjson`，8 行里 8 行都缺 `ts/service/stream`。文档把字段不齐改成“INFRA-07 预期产物”，但这会让 `*.ndjson` 在本阶段仍不是统一机器契约，和日志系统方案固定字段目标不一致。
建议：若决定延期，需要在 INFRA-07 任务验收中明确降级；否则应在 `handleLine()` 的 JSON 分支 merge 标准字段，例如 `{ ts, service: label, stream, ...parsed }`，并把 pino `time` 转换/保留为规范时间字段。

Finding 2 — [P1] shutdown 尾行丢失风险仍在
位置：scripts/dev.mjs:302-325
问题：代码仍然在 SIGTERM 子进程后立即 `closeAllStreams()`。随后子进程退出前如果 stdout/stderr 还有尾行，`handleLine()` 会重新打开流，而最终 `process.exit()` 前不会再次 flush。一次人工 Ctrl+C 样本通过不能证明该竞态不存在。
建议：等待 child `close` / readline `close` 后再最终 `closeAllStreams()`；或在 `process.exit()` 前再次 drain/flush `openStreams`，并避免 shutdown 期间 close 后重新打开未被最终 flush 的 stream。

Finding 3 — [P2] errors 聚合文档仍写错
位置：docs/changelog.md:10498-10515
问题：changelog 仍写 numeric level ≥50 或 error/fatal 才写 errors，但代码和 `docs/task-queue.md` 的 INFRA-07 验收都是 warn 及以上，即 numeric ≥40 或 warn/error/fatal。该记录会误导后续验收。另外，```ndjson 代码块包含 `//` 注释和未加引号的 `<port>`，不是有效 NDJSON。
建议：修正文档为 numeric ≥40 / warn|error|fatal；日志样例要么改为普通文本代码块，要么保证每一行都是可解析 JSON。

已确认改善：
- 编号已从 INFRA-01..06 改为 INFRA-07..12，`docs/task-queue.md` 主序列和 `docs/changelog.md` 当前条目已同步。
- changelog 样例已从纯编造模板换成更接近真实产物的样例。
- `node --check scripts/dev.mjs` 通过。

残余风险：
- `docs/logging_system_proposal_20260425.md` 历史评论仍大量引用 INFRA-01..06；若作为历史审计记录保留可以接受，若作为当前索引使用会继续造成混淆。
- `scripts/dev.mjs` 中 `createReadStream`、`pinoLevelStr`、`isErrorLevel` 未使用，属于清理项，不阻断。

建议状态：
文档编号修复完成；INFRA-07 实现仍需修两个 P1，或正式把统一字段与 shutdown drain 降级/后移并写入任务卡验收变更。
-->

<!--
INFRA-13 复查结果
复查者：Codex
时间戳：2026-04-25 19:06:06 PDT
对象：INFRA-13（commit d6b70cd）对 Codex 复审意见的修复
结论：PASS。INFRA-13 已闭环前一轮 2 个 P1 + 1 个 P2 finding；INFRA-07 的实现质量门槛经 INFRA-13 修补后通过。

Finding 1 — [P1] JSON 行仍缺统一字段：已修复
- `scripts/dev.mjs` 的 JSON 分支已改为 enrich 输出，补齐 `ts/service/stream`，并将 pino numeric level 归一为字符串 level。
- 实测当前 `logs/dev/api.ndjson`：7/7 行均包含 `ts`、`level`、`service`、`stream`。
- 示例字段形态：`{"ts":"...","service":"api","stream":"stdout","level":"info","time":...,"pid":...,"msg":"..."}`。

Finding 2 — [P1] shutdown 尾行丢失风险仍在：已修复
- `shutdown()` 已改为等待 child `close` 后再 `closeAllStreams()`，避免 SIGTERM 后子进程尾行写入时文件流已关闭。
- 保留 3s SIGKILL 与 5s finalExit 双兜底，竞态风险较上一版已消除到可接受范围。

Finding 3 — [P2] errors 聚合文档仍写错：已修复
- `docs/changelog.md` 已将 errors 聚合规则修正为 numeric level ≥ 40 或字符串 level ∈ {warn, error, fatal}。
- 原 ```ndjson 代码块已改为普通代码块，避免“带注释的非法 NDJSON”误导。

复查验证：
- `node --check scripts/dev.mjs`：PASS
- `npm run lint`：PASS（存在既有 web-next hook warning，非本次引入）
- `npm run typecheck`：PASS
- 日志 schema 抽查：api/admin/web-next/design-tokens 的现有 ndjson 行均包含 `ts/service/stream`；api pino 行额外包含 `level`。

剩余说明：
- `docs/logging_system_proposal_20260425.md` 中较早的审计评论仍保留 INFRA-01..06 与 CONDITIONAL PASS 语境，作为历史审计记录可接受；当前有效状态以本 INFRA-13 复查结果为准。
- wrap 行仍不强制补 `pid/level`，但本轮 finding 要求的 `ts/service/stream` 已满足；完整业务日志契约继续由 INFRA-08/09 推进。
-->

<!--
INFRA-08 完成质量审核意见
审核者：Codex
时间戳：2026-04-25 19:38:46 PDT
对象：INFRA-08（commit fe97364）API + worker 接入统一结构化 logger
结论：未通过完成质量验收。主体接入方向正确，`npm run typecheck` / `npm run lint` / `npm run test:run` 均通过，但仍存在 3 个 P1 和 1 个 P2 验收缺口。

Finding 1 — [P1] 脱敏表漏掉 set-cookie 和 url.query
位置：apps/api/src/lib/logger.ts:24-44
问题：INFRA-08 验收明确要求 `authorization/cookie/set-cookie/password/token/refreshToken/accessToken/email/phone/ip/url.query` 脱敏，但当前 `REDACT_PATHS` 没有 `set-cookie` 和 `url.query`。用同一组 paths 跑 pino 最小样本时，`headers.set-cookie` 和 `url.query` 会原样输出，仍有敏感信息泄露风险。
建议：补齐 `set-cookie`、`*.set-cookie`、`headers.set-cookie`、`url.query`、`*.url.query` 等路径，并加 11 个字段的单测。

Finding 2 — [P1] request.log 仍是 reqId 而不是 request_id
位置：apps/api/src/server.ts:49-52
问题：当前只设置了 `genReqId`，没有把 Fastify request child logger 的 request id 字段改成项目约定的 `request_id`。最小 Fastify inject 样本输出的是顶层 `reqId`，route 内 `request.log.info/error(...)` 没有顶层 `request_id`；只有手写 `onResponse` access log 补了 `request_id`。这不满足 `request.log.error/warn/info` 全部带 `request_id` 的验收。
建议：在 Fastify 配置中使用 `requestIdLogLabel: 'request_id'`，并补一条 logger 行为测试。

Finding 3 — [P1] maintenance worker job 日志缺 job_id
位置：apps/api/src/workers/maintenanceWorker.ts:47-110
问题：`registerMaintenanceWorker` 拿到了 Bull job，但只把 `job.data` 传给 `processMaintenanceJob`，内部所有 `workerLog.info('job done')` 都没有通过 `withJob` 派生 `job_id`。维护任务四类成功日志无法按 `job_id` 串联，违背“每条 worker 日志带 worker / job_id”。
建议：把 `jobLog` 或 `job` 传入 `processMaintenanceJob`，并统一使用 `withJob(workerLog, job)` 输出维护任务执行日志。

Finding 4 — [P2] backfill worker 也丢弃 job_id
位置：apps/api/src/workers/imageBackfillWorker.ts:78-90
问题：backfill processor 丢弃 job 参数，`runImageBackfill` 直接使用 `workerLog` 输出 `backfill done`；`enqueueBackfillJob` 也没有记录生成的 `job_id`。这个 worker 的执行和入队日志都不能对应到具体 Bull job。
建议：`process('backfill', ...)` 接收 job，把 `withJob` 后的 logger 传给 `runImageBackfill`，并在 enqueue 日志里记录 `job_id`。

复核验证：
- `npm run typecheck`：PASS
- `npm run lint`：PASS（保留既有 web-next hook warnings）
- `npm run test:run`：PASS（148 files / 1723 tests）
- 额外最小样本验证：当前 redaction 会泄露 `headers.set-cookie` / `url.query`；当前 Fastify `request.log.*` 输出 `reqId` 而不是 `request_id`。

补充风险：
- API services 中仍有不少 `process.stderr.write`。其中部分会在 worker 调用链里出现；如果 INFRA-08 的目标是“worker 执行链全结构化”，这部分需要纳入后续修复或明确延期。
-->

<!--
INFRA-14 修补任务草案（评审待开工）
起草人：主循环（claude-opus-4-7）
时间戳：2026-04-25 19:47:56 PDT
对象：整合主循环审 + Codex INFRA-08 完成质量审核（共 6 P1 + 4 P2），制定 INFRA-08 复审修补卡

## 修补任务卡

- **ID**：INFRA-14
- **标题**：INFRA-08 复审修补：脱敏表 / requestIdLogLabel / maintenance+backfill withJob / 守门 B+D 真实化
- **序列**：SEQ-20260425-LOG-V1（追加，状态 🟡 待开工）
- **前置依赖**：INFRA-08 ✅
- **建议模型**：opus（保留主循环 claude-opus-4-7）
- **子代理**：无
- **估时**：1.0d
- **触发**：自审 P1-3 流程瑕疵 + Codex 4 finding（本提案第 561–596 行）

## Finding 整合表（10 项）

| ID | 来源 | 级 | 位置 | 问题 |
| --- | --- | --- | --- | --- |
| F1 | 主循环 | P1 | changelog:10590-10603 | 守门 D 5 段日志样例编造（RFC 4122 示例 UUID + 整点 ts + 错字段名 `enrich-worker`） |
| F2 | 主循环 | P1 | changelog:10585 | 守门 B 5 路径回归 sonnet 自承"需人工启动 dev server 后验证"未做（任务卡明示验收 ✅） |
| F3 | 主循环 | P1 | commit fe97364 | tasks.md 未写工作台卡片即开工，违反 P1-3 连续第二次（INFRA-07 已警告） |
| F4 | Codex | P1 | logger.ts:24-44 | REDACT_PATHS 漏 `set-cookie` + `url.query`，pino 最小样本可泄露 |
| F5 | Codex | P1 | server.ts:49-52 | 未配 `requestIdLogLabel:'request_id'`，route 内 `request.log.*` 输出 `reqId` 不是 `request_id`，违反验收"全部带 request_id" |
| F6 | Codex | P1 | maintenanceWorker.ts:47-110 | `processMaintenanceJob(data)` 不接收 `job`，4 处 `workerLog.info('job done')` 缺 `job_id` |
| F7 | Codex | P2 | imageBackfillWorker.ts:78-90 | process('backfill') 丢 job，enqueueBackfillJob 不记 jobId |
| F8 | 主循环 | P2 | server.ts | F5 修复后 `reqId` / `request_id` 冗余自然消解（pino rename） |
| F9 | Codex | P2 | apps/api/src/services/ | 25 处 stderr 残留（VideoIndexSyncService 8 处 + SourceVerificationService 等） |
| F10 | Codex 隐含 | P2 | 测试缺失 | 11 PII 字段无单测覆盖 |

## 范围决策

- **纳入 INFRA-14**：F1–F8（6 P1 + 2 P2）
- **延期**：
  - F9：apps/api/src/services/ 25 处 stderr 不在 INFRA-08 范围，保持范围收敛原则；后续轻量任务清理（暂不立卡）
  - F10：11 PII 字段完整单测随 INFRA-09 抽 `packages/logger` 时随包提供（`packages/logger/src/redact.test.ts`）；INFRA-14 仅做 set-cookie + url.query 端到端实测验证

## 修复方案

### 代码改动

| 文件 | 改动 | Finding |
| --- | --- | --- |
| `apps/api/src/lib/logger.ts` | `REDACT_PATHS` 补 `set-cookie` / `*.set-cookie` / `headers.set-cookie` / `url.query` / `*.url.query` / `req.url.query` | F4 |
| `apps/api/src/server.ts` | `Fastify({...})` 配置加 `requestIdLogLabel: 'request_id'` | F5（+ F8 自然解） |
| `apps/api/src/workers/maintenanceWorker.ts` | `processMaintenanceJob(data)` → `processMaintenanceJob(data, jobLog)`；`registerMaintenanceWorker` 传 `withJob(workerLog, job)`；4 处 `workerLog.info(...,'job done')` → `jobLog.info(...,'job done')` | F6 |
| `apps/api/src/workers/imageBackfillWorker.ts` | `process('backfill', 1, async (job) => runImageBackfill(withJob(workerLog, job)))`；`runImageBackfill(jobLog)` 内部用 jobLog；`enqueueBackfillJob` 用 add() 返回的 `bullJob.id` 写 `workerLog.info({ job_id, ... }, 'enqueued')` | F7 |

### 文档改动

| 文件 | 改动 | Finding |
| --- | --- | --- |
| `docs/changelog.md`（INFRA-08 段） | 真实样例替换编造样例（≥ 5 行覆盖 5 路径 access + redact + maintenance withJob + backfill withJob）；"需人工验证" → "已在主循环审核会话端到端实测 PASS" | F1 + F2 |
| `docs/changelog.md`（INFRA-08 段） | P1-3 重犯记录 + INFRA-09 起强制 tasks.md 工作台 | F3 |
| `docs/changelog.md` | 追加 INFRA-14 完成条目（含修复证据 + 真实日志样例） | — |
| `docs/tasks.md` | INFRA-14 工作台卡片（🔄 → 完成后清空） | F3 流程纠正 |
| `docs/task-queue.md` | 序列尾部追加 INFRA-14 卡片，状态 ⬜ → 🔄 → ✅ | — |

## 端到端实测清单（守门 B 真做 + F4–F7 验收）

```
1. LOG_DIR=logs npm run dev &
2. curl POST /v1/auth/login（含 Authorization 头 + 预期返回 Set-Cookie）
3. curl GET /v1/videos/trending
4. curl GET /v1/videos/{shortId}/sources
5. curl POST /v1/auth/login?password=SECRET（query 注入测 url.query redact）
6. curl GET /v1/videos/nonexistent_id/sources（404）
7. curl -X POST /v1/admin/maintenance/run-now（触发 maintenance job → 验证 F6）
8. curl -X POST /v1/admin/image-health/backfill（触发 backfill job → 验证 F7）
9. SIGINT 停 dev
10. 抓真实日志验证：
    - grep '"request_id":' api.ndjson 计数 == 总请求数（F5）
    - grep '"reqId":' api.ndjson 计数 == 0（pino rename，F5 + F8）
    - grep 'SECRET' api.ndjson 计数 == 0（F4 redact 工作）
    - grep '"set-cookie"' api.ndjson | grep -v '<redacted>' 计数 == 0（F4）
    - grep '"job_id":' api.ndjson 含 maintenance 与 backfill 各 ≥ 1 行（F6 + F7）
```

## 验收清单

- [ ] logger.ts REDACT_PATHS 含 set-cookie + url.query（含 *. 嵌套）
- [ ] server.ts 配 requestIdLogLabel:'request_id'
- [ ] request.log.\* 顶层字段 = request_id（grep 验证 reqId 计数 = 0）
- [ ] maintenanceWorker 4 处 job done 日志含 job_id
- [ ] imageBackfillWorker process + enqueue 日志含 job_id
- [ ] PII 实测：Set-Cookie / Authorization / ?password= 任一注入，ndjson 0 次出现 secret 原文
- [ ] `npm run typecheck` / `npm run lint` / `npm run test:run` 全绿
- [ ] changelog 附 ≥ 5 行真实样例（覆盖 5 路径 access + redact 对比 + maintenance/backfill withJob）
- [ ] 流程：tasks.md 先写工作台卡片再开工（自纠 F3）

## 完成备注要求

changelog INFRA-14 条目必附：
- ① F4 redact 修复后真实样例（cookie 头 + url.query 各 1 行 redact 对比）
- ② F5 request_id rename 后真实 access log 1 行
- ③ F6 maintenance job done 真实日志 1 行（含 worker + job_id + stage）
- ④ F7 backfill enqueue + done 真实日志 2 行
- ⑤ P1-3 流程瑕疵连续第二次记录 + INFRA-09 起强制门禁

## 偏离记录

- **F9 延期**：保持 INFRA-08 范围收敛原则，不动 services/ 25 处 stderr
- **F10 延期**：11 PII 字段单测随 INFRA-09 抽包提供

## 流程纠正条款（针对 F3）

本卡作为"流程范本"开工时：
1. **先**写 tasks.md 工作台卡片（含问题理解 / 根因 / 方案 / 涉及文件 / 验收清单五段，符合 CLAUDE.md 质量门禁）
2. **再**改 task-queue.md（追加 INFRA-14 + 状态 ⬜ → 🔄）
3. 然后才改代码 + 实测 + commit
4. 完成后：清空 tasks.md + task-queue 状态 🔄 → ✅ + changelog 追加 + git commit
5. INFRA-09 任务卡开工时冗余写一遍"工作台卡片是 BLOCKER 级前置"提示

## 评审状态

- 草案完成时间：2026-04-25 19:47:56 PDT
- 当前状态：等待用户确认开工
- 不动 task-queue.md / tasks.md，本草案先 commit 入库作为评审记录（与 INFRA-13 草案节奏一致）
-->

<!--
INFRA-09 完成质量独立审核意见
审核者：Codex
时间戳：2026-04-25 23:33:32 PDT
对象：INFRA-09（commit e844a18）新建 @resovo/logger workspace 包（首期类型 + 序列化器 + redact 表）
结论：CONDITIONAL PASS。抽包边界、API 迁移和 logger 单测主体通过；但 package-lock 未同步导致 `npm ci` 失败，这是完成质量的 P1 阻断，需修复后才能视为真正完成。

Finding 1 — [P1] package-lock 未纳入新 workspace，干净安装会失败
位置：package-lock.json:1-76
问题：INFRA-09 新增 `packages/logger/package.json`，但 `package-lock.json` 没有 `packages/logger` / `node_modules/@resovo/logger` 条目，且当前 `node_modules/@resovo` 下也没有 `logger` symlink。实测 `npm ci --dry-run` 失败，报 `Missing: @resovo/logger@0.1.0 from lock file`。`npm run lint` 虽通过，但 turbo 同时警告 `Workspace 'packages/logger' not found in lockfile`。这会让 CI、fresh clone、干净部署无法安装依赖。
建议：用项目要求的 Node/npm 版本重新执行 `npm install --package-lock-only` 或一次正常 `npm install`，提交更新后的 `package-lock.json`，确认 `node_modules/@resovo/logger` symlink 可生成，并复跑 `npm ci --dry-run` / lint。

Finding 2 — [P2] redact 单测只验证路径存在，没有验证 pino 实际脱敏
位置：tests/unit/lib/logger.test.ts:29-47
问题：INFRA-14 留给 INFRA-09 的 F10 是“11 PII 字段完整单测”。当前测试覆盖了 `REDACT_PATHS` 是否包含 11 个字段及嵌套路径，但没有用 pino 真实写一行日志并断言敏感值被 `<redacted>` 替换。路径存在不等于 pino 语法生效，之前 `headers.set-cookie` / `url.query` 泄露就是实际行为验证才发现的。
建议：补一个 pino 行为测试：构造包含 11 个字段顶层、`*.field` 嵌套、`headers.set-cookie`、`req.url.query`、`url.query` 的对象，写入内存 stream，断言 secret 原文不存在且对应字段为 `<redacted>`。

已确认通过项：
- `packages/logger` 首期未导出 `createLogger`，符合决策 7；`apps/api/src/lib/logger.ts` 仅切换类型、序列化器、redact、level import，保留 createLogger / withRequest / withJob。
- `serializeReq` 会截断 query，`serializeErr` 保留 type/message/stack/statusCode；`computeLevel` 与 INFRA-08 语义一致。
- `REDACT_PATHS` 已包含 11 个 PII 字段、`*.field` 嵌套、`headers.set-cookie`、`req.url.query`。
- `tsconfig.json`、`apps/api/tsconfig.json`、`apps/server/tsconfig.json`、`apps/web-next/tsconfig.json`、`vitest.config.ts` 已补 `@resovo/logger` path/alias。
- `node --import tsx apps/api/src/server.ts` 已越过 `@resovo/logger` 解析阶段，当前失败点是缺 `REDIS_URL`，说明 tsx dev 入口能解析源码 alias。

复核验证：
- 根 `tsc --noEmit`：PASS
- `apps/server` / `apps/web-next` / `packages/player-core` typecheck：PASS
- `npm run lint`（Node 25/npm）：PASS，但有 `packages/logger` 不在 lockfile 的 turbo warning；web-next 仍有既有 hook warnings。
- `npm run test:run -- tests/unit/lib/logger.test.ts`：PASS（26 tests）
- `npm ci --dry-run`：FAIL，`Missing: @resovo/logger@0.1.0 from lock file`
- 全量 `npm run test:run`：当前环境下 FAIL，133 个 localStorage 相关既有前端测试失败（`localStorage.clear/getItem is not a function`，Node/Vitest/jsdom 环境问题），logger 新增单测本身已通过；不作为本任务新增代码 finding，但不能用本次运行证明“1749 全绿”。

建议状态：
INFRA-09 可按 CONDITIONAL PASS 进入修补：先修 package-lock P1；同时建议补 pino 行为级 redact 单测，避免 F10 只停留在路径枚举层面。
-->

<!--
INFRA-15 修补任务草案（评审待开工）
起草人：主循环（claude-opus-4-7）
时间戳：2026-04-25 23:42:37 PDT
对象：整合主循环独立审核 + Codex INFRA-09 完成质量审核（共 1 P1 + 1 P2），制定 INFRA-09 复审修补卡

## 修补任务卡

- **ID**：INFRA-15
- **标题**：INFRA-09 复审修补：package-lock 同步 + pino 行为级 redact 集成测试
- **序列**：SEQ-20260425-LOG-V1（追加，状态 🟡 待开工）
- **前置依赖**：INFRA-09 ✅（CONDITIONAL PASS）
- **建议模型**：sonnet（机械性 lockfile 修补 + 单测增量，无新架构决策）
- **子代理**：无
- **估时**：0.3d
- **触发**：Codex INFRA-09 审核 2 finding（本提案第 720–753 行）+ 主循环独立审核（确认 F1 阻断）

## Finding 整合表（2 项）

| ID | 来源 | 级 | 位置 | 问题 |
| --- | --- | --- | --- | --- |
| F1 | Codex + 主循环复核 | P1 | `package-lock.json` / `node_modules/@resovo/` | INFRA-09 新增 `packages/logger/package.json` 但 `package-lock.json` 未注册 workspace；`node_modules/@resovo/logger` symlink 缺失。当前所有 PASS（typecheck/lint/test/dev）都靠 tsconfig paths + vitest alias 旁路 npm 解析；`npm ci` 路径会 FAIL（CI / fresh clone / 生产部署阻断） |
| F2 | Codex | P2 | `tests/unit/lib/logger.test.ts:29-47` | INFRA-14 留给 INFRA-09 的 F10 仅完成"路径表枚举"层面：26 个测试只断言 `REDACT_PATHS` 包含 11 字段 + `*.field` + `headers.set-cookie` + `req.url.query`，**未用 pino 真实写日志验证 `<redacted>` 替换语法生效**。历史教训：`headers.set-cookie` / `url.query` 泄露正是端到端实测才发现 |

## 范围决策

- **纳入 INFRA-15**：F1（必修） + F2（建议补）
- **延期 / 不在本卡**：
  - 跨环境 jsdom localStorage 失败（Codex 复核备注）：不是 INFRA-09 引入，独立环境议题，不立卡
  - F9（services 25 处 stderr）：保持 INFRA-08 范围收敛原则，仍延期

## 修复方案

### 代码 / 配置改动

| 文件 | 改动 | Finding |
| --- | --- | --- |
| `package-lock.json` | 用项目 `engines: node >=22` + `npm@10.8.2`（root packageManager 字段）跑一次 `npm install`，让 npm 注册 `packages/logger` workspace + 创建 `node_modules/@resovo/logger` symlink + 同步 lockfile | F1 |
| `tests/unit/lib/logger.test.ts` | 新增 1 个 describe 块「pino integration redact behavior」：构造含 11 PII 字段顶层 + `*.field` 嵌套 + `headers.set-cookie` + `req.url.query` + `url.query` 的对象，用 `pino({ redact: { paths: REDACT_PATHS, censor: '<redacted>' } }, writableStream)` 写入内存 stream（`stream.Writable` 收集），断言：① secret 原文 0 次出现 ② 对应字段值 === `'<redacted>'` | F2 |

### 不需改动的部分

- `packages/logger/**` 源码：契约层 INFRA-09 已正确，不动
- `apps/api/src/lib/logger.ts`：消费链路正确，不动
- `tsconfig.json` paths：旁路解析能用是好事（保留 dev 体验），不动；F1 修复后 npm ci 链路也能解析
- `vitest.config.ts` alias：同上，不动

### 文档改动

| 文件 | 改动 |
| --- | --- |
| `docs/changelog.md`（INFRA-09 段） | 追加 P1-Finding-1 "完成态不一致"备注 + 链接至 INFRA-15 修补；F10 关闭描述细化为"路径表层（INFRA-09）+ pino 行为层（INFRA-15）双层覆盖" |
| `docs/changelog.md` | 追加 INFRA-15 完成条目（含 F1 / F2 修复证据） |
| `docs/tasks.md` | INFRA-15 工作台卡片（开工时写，完成后清空） |
| `docs/task-queue.md` | 序列尾部追加 INFRA-15 卡片，状态 ⬜ → 🔄 → ✅ |

## 端到端验证清单

```
F1 验证：
1. 当前状态快照：grep -c '"packages/logger"' package-lock.json == 0
                  ls node_modules/@resovo/ | grep -c '^logger' == 0
2. npm install（不带 --dry-run，让 npm 真正写入）
3. 修复后断言：
   - grep -c '"packages/logger"' package-lock.json ≥ 1
   - grep '"node_modules/@resovo/logger"' package-lock.json 出现至少 1 次
   - ls -la node_modules/@resovo/logger 是 symlink → ../../packages/logger
   - npm ls @resovo/logger 不报错
   - npm run lint 无 turbo "Workspace 'packages/logger' not found in lockfile" 警告
4. git diff --stat package-lock.json 应有变更（仅此文件，确保不带其他无关 lockfile drift）

F2 验证：
1. tests/unit/lib/logger.test.ts 新增 describe 块测试通过
2. 测试断言至少：
   - 顶层 11 字段：authorization / cookie / set-cookie / password / token / refreshToken / accessToken / email / phone / ip / url（用 url.query 子路径）
   - 嵌套：req.headers.set-cookie / req.url.query
   - 各注入 'PINO_SECRET_TOKEN_XYZ' 字符串后，pino 输出 grep 0 命中
   - 字段值正则匹配 /<redacted>/
3. npm run test:run 全绿，logger.test.ts 计数从 26 → 26+N（N ≥ 13：11 字段 + 2 容器路径）

守门：
- npm run typecheck / lint / test:run 全绿
- npm ls @resovo/logger 无错误
- 无 turbo lockfile 警告
```

## 验收清单

- [ ] `package-lock.json` 含 `packages/logger` workspace 与 `node_modules/@resovo/logger` 节点
- [ ] `node_modules/@resovo/logger` 物理 symlink 存在
- [ ] `npm ls @resovo/logger` 解析无错
- [ ] `npm run lint` 无 turbo "Workspace not found in lockfile" 警告
- [ ] `tests/unit/lib/logger.test.ts` 新增 pino 集成行为测试，覆盖 11 字段 + 容器路径
- [ ] `npm run typecheck` / `npm run lint` / `npm run test:run` 全绿（test 数 ≥ 1762）
- [ ] git diff package-lock.json 仅含本卡相关变更，无无关 drift
- [ ] 流程：tasks.md 先写工作台卡片再开工（延续 INFRA-14 范本）

## 完成备注要求

changelog INFRA-15 条目必附：
- ① F1 修复证据：`grep -c '"packages/logger"' package-lock.json` 修复前后对比 + `ls -la node_modules/@resovo/logger` 输出
- ② F2 修复证据：新增测试块代码片段 + 测试计数 26 → 26+N 对比
- ③ INFRA-09 段回写指针："F1 已闭环，见 INFRA-15"
- ④ F10 双层覆盖说明（路径表层 + pino 行为层）

## 偏离记录

- 跨环境 jsdom localStorage 失败：环境议题，不立卡
- F9（services 25 处 stderr）：仍延期至独立卡或 LOG-V2 里程碑

## 流程纠正条款

延续 INFRA-14 范本，本卡开工时：
1. **先**写 tasks.md 工作台卡片（5 段：问题理解 / 根因 / 方案 / 涉及文件 / 验收清单）
2. **再**改 task-queue.md INFRA-15 状态 ⬜ → 🔄
3. 然后才改 lockfile + 单测 + commit
4. 完成后：清空 tasks.md + task-queue 状态 🔄 → ✅ + changelog 追加 + git commit
5. lockfile 修复必须用项目 `engines.node >=22` + `packageManager: npm@10.8.2` 版本（避免不同 npm 版本写出不同的 lockfile shape）

## 评审状态

- 草案完成时间：2026-04-25 23:42:37 PDT
- 当前状态：等待用户确认开工
- 不动 task-queue.md / tasks.md 内容，本草案先 commit 入库作为评审记录（与 INFRA-13/INFRA-14 草案节奏一致）
- 草案落盘后同步追加 task-queue.md 第 9 张卡片（INFRA-15，状态 ⬜）
-->

<!--
INFRA-15 复核结果
复核者：Codex
时间戳：2026-04-25 23:59:58 PDT
对象：INFRA-15（commit d6aa647）对 INFRA-09 审核 finding 的修复
结论：PASS。INFRA-15 已闭环 INFRA-09 独立审核提出的 1 个 P1 + 1 个 P2；INFRA-09 完成态在 npm workspace 物理层与 pino redact 行为层均已补齐。

Finding 1 — [P1] package-lock 未纳入新 workspace：已修复
- `package-lock.json` 已包含 `node_modules/@resovo/logger` link 节点与 `packages/logger` workspace 节点。
- `node_modules/@resovo/logger -> ../../packages/logger` symlink 已存在。
- `npm ls @resovo/logger` 解析通过：`@resovo/logger@0.1.0 -> ./packages/logger`。
- `npm ci --dry-run` 已通过。
- `npm run lint` 已通过，且不再出现 turbo `Workspace 'packages/logger' not found in lockfile` warning。

Finding 2 — [P2] redact 单测没有验证实际脱敏行为：已修复
- `tests/unit/lib/logger.test.ts` 新增 `pino integration redact behavior` 测试块。
- 覆盖 11 个 PII 顶层字段、`*.field` 嵌套、`headers.set-cookie`、`req.url.query`、`url.query`。
- 测试断言注入 secret 原文不出现在 pino 输出中，并验证对应字段值为 `<redacted>`。
- logger 单测数量从 26 增至 32，`npm run test:run -- tests/unit/lib/logger.test.ts` 通过。

复核验证：
- `npm ci --dry-run`：PASS
- `npm ls @resovo/logger`：PASS
- `npm run lint`：PASS（web-next 仍有既有 hook warnings，非本次引入）
- `npm run test:run -- tests/unit/lib/logger.test.ts`：PASS（32 tests）
- 根 `tsc --noEmit`：PASS
- `require.resolve('@resovo/logger')`：可解析到 `packages/logger/src/index.ts`
- `package-lock.json` 解析检查：`packages['node_modules/@resovo/logger'] === true` 且 `packages['packages/logger'] === true`

剩余说明：
- `git show --check -1` 仅报 `docs/changelog.md:10722` trailing whitespace，属于提交卫生问题，不影响两条 finding 闭环。
- 当前有效状态：INFRA-09 的 CONDITIONAL PASS 已由 INFRA-15 修补转为 PASS；后续如需记录最终总状态，应以本复核块为准。
-->

<!--
INFRA-10 完成质量独立审核意见
审核者：Codex
时间戳：2026-04-26 00:30:52 PDT
对象：INFRA-10（commit 4e76621）浏览器 client logger + /v1/internal/client-log 端点
结论：CONDITIONAL PASS。client logger、API 端点、server 注册、4 处 console 迁移和新增 jsdom 单测主体成立；但浏览器端默认投递 URL 与现有 web-next API 基址策略不一致，会影响真实浏览器链路，是 P1 阻断。另有 2 个 P2 需要修补。

Finding 1 — [P1] 浏览器 logger 默认打到 web-next 自身而不是 API
位置：apps/web-next/src/lib/logger.client.ts:27-71
问题：`ENDPOINT` 固定为相对路径 `/v1/internal/client-log`，而 web-next 现有 API 调用都使用 `NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'`（见 `apps/web-next/src/lib/api-client.ts` 与 `report-broken-image.ts`）。当前 `apps/web-next/next.config.ts` 未配置 `/v1` rewrite；在常规 dev 模式 web-next 跑在 3000、API 跑在 4000 时，浏览器日志会 POST 到 web-next origin 的 `/v1/internal/client-log`，不是 API 端点，导致“浏览器异常 → API endpoint → logs/client”核心链路依赖外部反代才成立。并且 fetch fallback 使用 `credentials:'same-origin'`，若改为跨 origin API URL，prod 登录态也不会随请求携带。
建议：按现有 web-next API 策略生成端点 URL，例如 `const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'`，endpoint 为 `${BASE_URL}/internal/client-log`；fetch fallback 改为 `credentials:'include'`。同时补一个单测断言默认 URL 指向 `http://localhost:4000/v1/internal/client-log` 或使用 env 覆盖后的 API URL。

Finding 2 — [P2] 非法 Origin 实际返回 500，不是验收要求的 403
位置：apps/api/src/server.ts:71-80；apps/api/src/routes/internal/client-log.ts:81-85
问题：任务卡要求 client-log 端点覆盖 5 分支（200/400/401/403/429），其中非法 origin 应为 403。但全局 `@fastify/cors` 在请求进入端点前用 `cb(new Error('Not allowed by CORS'), false)` 拦截，实测最小 Fastify 注入：非法 origin 返回 500 `Not allowed by CORS`，端点内的 `FORBIDDEN_ORIGIN` 403 分支不可达。changelog 已记录“403 不可达”，但这仍未满足验收分支。
建议：要么把 CORS 拒绝统一映射为 403（全局 error handler 或 cors 配置调整），要么把任务验收从“403 endpoint branch”正式降级为“CORS edge rejects invalid origin”，并补对应单测/文档。若保留 403 契约，应让非法 origin 到达 route 层或由全局 CORS 返回 403。

Finding 3 — [P2] client 日志写入原始 source_ip，绕过 PII redact 规则
位置：apps/api/src/routes/internal/client-log.ts:107-118
问题：endpoint 将 `request.ip` 写入 `source_ip` 字段。INFRA-08/09 的 PII 规则覆盖字段名 `ip`，但不会匹配 `source_ip`，因此 client ndjson 会保留原始来源 IP。changelog 样例也显示 `"source_ip":"127.0.0.1"`。这与“ip 作为 PII 字段需 redact”的日志基线不一致。
建议：如无强需求，删除 `source_ip`；如需排障关联，改为 hash/truncate 后写入，例如 `source_ip_hash` 或 `source_ip_prefix`，并补单测确认不会输出原始 IP。

已确认通过项：
- `apps/api/src/server.ts` 已注册 `internalClientLogRoutes`，路径为 `/v1/internal/client-log`。
- `apps/api/src/routes/internal/client-log.ts` 已实现 zod 校验、100 条批量上限、64KB bodyLimit、IP 60 rpm 限流、prod auth gate、service:'client' logger 落 stdout。
- `apps/web-next/src/lib/logger.client.ts` 已实现 info/warn/error 同步 API、buffer 50、2s flush、error 立即 flush、sendBeacon 优先、fetch fallback、1 次 retry、window error / unhandledrejection / dev console.error / pagehide hooks。
- `BrandProvider` 安装全局 hooks；`BrandProvider`、`playerStore`、`SafeImageNext` 的 4 处实际 console 调用已替换为 clientLogger。
- `tests/unit/web-next/logger-client.test.ts` 覆盖 error 立即 flush、info 2s buffer、sendBeacon→fetch fallback、三输入全局 hook 与幂等。

复核验证：
- `npm run test:run -- tests/unit/web-next/logger-client.test.ts`：PASS（4 tests）
- 根 `tsc --noEmit`：PASS
- `npm run lint`：PASS（web-next 仍有既有 hook warnings，非本次引入）
- `git show --check -1`：PASS
- 最小 Fastify 注入验证：200 正常与 400 body 校验通过；非法 origin 实际返回 500 `Not allowed by CORS`，不是 403。
- 全量 `npm run test:run`：当前环境下 FAIL，133 个 localStorage 相关既有前端测试失败（`localStorage.clear/getItem is not a function`）；新增 logger-client 测试本身通过，本失败不作为 INFRA-10 新增实现 finding，但不能用本次运行证明“1759 全绿”。

建议状态：
INFRA-10 可按 CONDITIONAL PASS 进入修补。优先修 Finding 1，确保真实浏览器链路无需反代假设即可送达 API；随后处理非法 origin 状态码契约与 source_ip PII 问题。
-->

<!--
INFRA-16 修补任务草案（评审待开工）
起草人：主循环（claude-opus-4-7）
时间戳：2026-04-26 00:36:19 PDT
对象：整合 Codex INFRA-10 完成质量审核（3 finding）+ 主循环独立确认 F1 是 P1 真实 bug，制定 INFRA-10 复审修补卡

## 修补任务卡

- **ID**：INFRA-16
- **标题**：INFRA-10 复审修补：浏览器→API 链路打通 + CORS 403 契约 + source_ip PII
- **序列**：SEQ-20260425-LOG-V1（追加，状态 🟡 待开工）
- **前置依赖**：INFRA-10 ✅（CONDITIONAL PASS）
- **建议模型**：sonnet（机械性接线修复 + 单测增量，无新架构决策）
- **子代理**：无
- **估时**：0.4d
- **触发**：Codex INFRA-10 审核 3 finding（本提案第 917–955 行）+ 主循环独立确认 F1 是 P1 阻断（真实浏览器链路 0 工作，curl 直连 :4000 误判通过）

## Finding 整合表（3 项）

| ID | 来源 | 级 | 位置 | 问题 |
| --- | --- | --- | --- | --- |
| F1 | Codex + 主循环复核 | P1 真实 bug | `apps/web-next/src/lib/logger.client.ts:27` | `ENDPOINT = '/v1/internal/client-log'` 相对路径，浏览器(:3000) 发请求打到 web-next 自身 → 404；现有 web-next 代码均用 `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'` 拼绝对 URL（`api-client.ts:3` / `video-detail.ts:9` / `report-broken-image.ts:14`）。INFRA-10 的 5 分支 curl 直连 :4000 实测**绕过**了浏览器→API 真实路径，验证缺口。fetch fallback `credentials:'same-origin'` 跨 origin 不携带 cookie，prod 401 也会因此误判 |
| F2 | Codex | P2 契约 | `apps/api/src/server.ts:71-80` + `apps/api/src/routes/internal/client-log.ts:81-85` | 任务卡 5 分支验收要求非法 origin 返回 403；实际全局 fastify-cors `cb(new Error('Not allowed by CORS'), false)` 拦截后 fastify 默认转 500。端点内 `FORBIDDEN_ORIGIN` 403 分支不可达。INFRA-10 changelog 已记录但属于"偏离文档化"而非"修复" |
| F3 | Codex | P2 PII | `apps/api/src/routes/internal/client-log.ts:107-118` | endpoint 写入 `source_ip: request.ip`；INFRA-08/09 PII redact 表覆盖字段名 `ip` / `*.ip`，**不匹配** `source_ip`。INFRA-10 实测 client.ndjson 58 行全部含明文 `127.0.0.1`，与"ip 作为 PII 字段需 redact"基线不一致。dev 不敏感但生产泄露真实用户 IP |

## 范围决策

- **纳入 INFRA-16**：F1（必修）+ F2（必修，选契约修复路径 A）+ F3（必修，选删除 source_ip）
- **延期 / 不在本卡**：
  - 跨环境 jsdom localStorage 失败（Codex 复核备注）：与 INFRA-09/15 同环境议题，独立不立卡
  - logger.server.ts 真实消费方迁移：随 INFRA-12 实现下沉

## 修复方案

### F1 修复（必修，P1）

| 文件 | 改动 |
| --- | --- |
| `apps/web-next/src/lib/logger.client.ts` | ① 顶部新增 `const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'` ② `const ENDPOINT = \`${BASE_URL}/internal/client-log\`` ③ fetch fallback `credentials: 'same-origin'` → `credentials: 'include'`（跨 origin cookie 必需） |
| `apps/api/src/server.ts:71-81` | 验证 `cors({ credentials: true, ... })` 已配置（既有），跨 origin POST 时浏览器要求 `Access-Control-Allow-Credentials: true` 头 |
| `tests/unit/web-next/logger-client.test.ts` | 新增 1 测试：默认 BASE_URL 为 `http://localhost:4000/v1`，sendBeacon/fetch 调用的 URL 形如 `http://localhost:4000/v1/internal/client-log`；覆盖 NEXT_PUBLIC_API_URL 环境变量场景 |

### F2 修复（必修，P2，选路径 A）

**路径 A（推荐）**：CORS 拒绝映射为 403。在 `server.ts` register cors 之后注册全局 onError hook 或在 cors 配置中改 callback：
- 选择 1: cors 配置 `hook: 'preHandler'` + 自定义 `origin` 函数返回 false 而不是抛 Error
- 选择 2: 全局 setErrorHandler 检测 message === 'Not allowed by CORS' 返回 403

主循环倾向**选择 2**：最小侵入，只对 CORS error 做转换，其他错误流不变：
```ts
fastify.setErrorHandler((error, request, reply) => {
  if (error.message === 'Not allowed by CORS') {
    return reply.code(403).send({
      error: { code: 'FORBIDDEN_ORIGIN', message: 'Origin not allowed', status: 403 },
    })
  }
  // 委托默认行为
  reply.send(error)
})
```

| 文件 | 改动 |
| --- | --- |
| `apps/api/src/server.ts` | 在 cors register 之后追加 `fastify.setErrorHandler(...)` 把 CORS error 映射为 403 |
| 集成测 | curl 测：`-H "Origin: http://evil.com"` → HTTP 403 + 含 `code: 'FORBIDDEN_ORIGIN'` |

**注意**：setErrorHandler 是全局的，会影响所有路由——需评估对现有 401/404/500 路径无回归。预期：fastify 默认 errorHandler 仍处理 statusCode-bearing errors，仅 message-match 的 CORS error 被特殊处理。

### F3 修复（必修，P2）

**首选**：删除 `source_ip` 字段。理由：
- `request_id` 已足够关联日志（每请求唯一 UUID）
- IP 排障价值低于隐私风险
- 删除最干净，不需 hash 函数维护

| 文件 | 改动 |
| --- | --- |
| `apps/api/src/routes/internal/client-log.ts:108-115` | `clientLog[entry.level]({ client_ts, ctx, request_id, source_ip }, msg)` → 删除 `source_ip` 参数 |
| 集成测 / E2E | curl 测后 grep `logs/client/<date>.ndjson`，断言 `"source_ip"` 字段不存在；也 grep `"127.0.0.1"` 计数 = 0（本机环境） |

### 文档改动

| 文件 | 改动 |
| --- | --- |
| `docs/changelog.md`（INFRA-10 段） | 追加 CONDITIONAL PASS 备注：F1 P1 阻断"浏览器链路 0 工作"显式记录 + F2 / F3 + 链接至 INFRA-16；行为差异说明改为"已闭环"指针 |
| `docs/changelog.md` | 追加 INFRA-16 完成条目（含 F1/F2/F3 修复证据 + 真实浏览器路径实测） |
| `docs/tasks.md` | 工作台 INFRA-16 卡片（开工时写，完成后清空） |
| `docs/task-queue.md` | 序列尾部追加 INFRA-16 卡片，状态 ⬜ → 🔄 → ✅ |

## 端到端验证清单

```
F1 验证（必须真实浏览器，curl 不能替代）：
1. npm run dev
2. 浏览器打开 http://localhost:3000
3. F12 devtools console 跑：
   throw new Error('INFRA-16 sync test')
   Promise.reject('INFRA-16 unhandled test')
   console.error('INFRA-16 console test')
4. 验证：
   - devtools Network 面板看 POST 目标是 http://localhost:4000/v1/internal/client-log（非 :3000）
   - logs/client/<date>.ndjson 出现 3 条新记录，分别带 source: window.onerror / unhandledrejection / console.error
   - 完整链路：浏览器 → API :4000 → service:'client' → 落盘

F2 验证：
1. curl -X POST http://localhost:4000/v1/internal/client-log \
     -H "Content-Type: application/json" -H "Origin: http://evil.com" \
     -d '{"entries":[{"ts":"...","level":"info","msg":"x"}]}'
2. expect HTTP 403 + body { error: { code: 'FORBIDDEN_ORIGIN' } }
3. 同 curl 不带 Origin 头：仍 200（非浏览器请求放行）

F3 验证：
1. 跑任意 200 路径
2. grep "source_ip" logs/client/<date>.ndjson == 0
3. grep "127.0.0.1" logs/client/<date>.ndjson == 0（本机 IP 不出现）
4. 验证不影响 ctx / request_id / client_ts 字段（仍正常输出）

无回归守门：
- npm run typecheck / lint / test:run 全绿
- 全局 setErrorHandler 不影响：curl POST /v1/auth/login 错密码（422）/ GET /nonexistent (404) / 其他 5xx 路径仍按既有 errorResponse 格式返回
```

## 验收清单

- [ ] `logger.client.ts` 用 `NEXT_PUBLIC_API_URL` BASE 拼绝对 URL；fetch fallback `credentials: 'include'`
- [ ] 真实浏览器实测：3 输入全部送达 API 端口（:4000）+ logs/client/ 落盘
- [ ] `server.ts` setErrorHandler 把 CORS error 映射为 403
- [ ] curl `-H "Origin: http://evil.com"` 返回 HTTP 403 + `code: 'FORBIDDEN_ORIGIN'`
- [ ] `client-log.ts` 删除 `source_ip` 参数（或 hash/truncate 后写入，需文档化）
- [ ] grep `"source_ip"` / `"127.0.0.1"` 在 client.ndjson == 0
- [ ] `tests/unit/web-next/logger-client.test.ts` 新增 BASE_URL 默认值断言（覆盖 F1）
- [ ] 5 分支真实化：200 / 400 / 401（prod，code review 仍保留）/ 403（本卡新增可 curl 直测）/ 429
- [ ] 无回归：原 5xx/4xx 路径继续按现有错误格式响应
- [ ] `npm run typecheck` / `npm run lint` / `npm run test:run` 全绿
- [ ] 流程：tasks.md 先写工作台卡片再开工（延续 INFRA-14/15/10 范本）

## 完成备注要求

changelog INFRA-16 条目必附：
- ① F1 修复证据：浏览器实测 Network 面板截图 / curl 等价 POST 含 BASE_URL + 3 输入 ndjson 真实样例（带 source 区分）
- ② F2 修复证据：curl evil.com origin → 403 真实响应
- ③ F3 修复证据：grep `"source_ip"` / IP 字面量在 client.ndjson 计数 = 0
- ④ INFRA-10 段回写指针："F1+F2+F3 已闭环，见 INFRA-16"
- ⑤ 验收 5 分支真实达成度（含 prod 401 仍 code review 保留）

## 偏离记录

- **prod 401 仍由 code review 验证**：本卡不引入 prod 集成测（NODE_ENV mock + fastify decorator mock 复杂度高）；F1 修复后真实浏览器路径已通，401 接线由 `requireAuth = process.env.NODE_ENV === 'production'` + `preHandler: [fastify.authenticate]` 代码审查覆盖
- **F2 路径选择**：选 setErrorHandler（最小侵入）；如审核认为 cors 配置层修复更干净，可改路径 A.1（cors origin 返回 false 而非 throw）
- **F3 选择删除而非 hash**：保守原则，IP 关联价值低于实施 hash 维护成本；如未来需要 IP 关联可独立加 INFRA-17 增加 hash 字段

## 流程纠正条款

延续 INFRA-14/15 范本，本卡开工时：
1. **先**写 tasks.md 工作台卡片（5 段：问题理解 / 根因 / 方案 / 涉及文件 / 验收清单 + 偏离风险）
2. **再**改 task-queue.md INFRA-16 状态 ⬜ → 🔄
3. 然后才动代码 + 测试 + 真实浏览器实测 + commit
4. 完成后：清空 tasks.md + task-queue 状态 🔄 → ✅ + changelog 追加 + git commit
5. **强调真实浏览器实测**：本次 INFRA-10 完成时 curl 直连 :4000 误判通过，本卡 F1 验收必须真实浏览器（dev 启动 → 打开 :3000 → devtools 跑 3 输入 → 看 Network 面板 + ndjson）

## 评审状态

- 草案完成时间：2026-04-26 00:36:19 PDT
- 当前状态：等待用户确认开工
- 不动 task-queue.md / tasks.md 内容，本草案先 commit 入库作为评审记录（与 INFRA-13/14/15 草案节奏一致）
- 草案落盘后同步追加 task-queue.md 第 10 张卡片（INFRA-16，状态 ⬜）
-->

<!--
INFRA-11 完成质量独立审核意见
审核者：Codex
时间戳：2026-04-26 01:48:22 PDT
对象：INFRA-11（commit bc03a29）新增 docs/rules/logging-rules.md + CLAUDE.md 索引

结论：CONDITIONAL PASS。规则文档主体结构完整，CLAUDE.md 索引已接入，最终决策表、PII 红线、logger.child 范式、client-log 链路规则与验收清单基本覆盖 LOG-V1 当前知识。但仍有 3 个 P2 需要修补后才能作为后续日志任务的稳定规则入口。

Finding 1 — [P2] worker service 命名规则和当前实现相反
位置：docs/rules/logging-rules.md:193-219
问题：文档把 `worker:crawler-worker` 等列为 ServiceName 实例，并写“新增 worker 时按此命名延续”。但当前 API 内所有 Bull workers 实际都是 `baseLogger = createLogger({ service: 'api' })` 后 `baseLogger.child({ worker: 'crawler-worker' })`，ndjson 顶层 service 仍是 `api`，worker 字段也不带 `worker:` 前缀。后续开发者若按本节新建 `service:'worker:*'`，会改变 dev.mjs 分流和既有日志 schema。
建议：明确当前 API 内 Bull workers 统一使用 `service:'api' + worker:'<name>'`；`worker:${string}` 仅保留给未来独立 worker 进程或 INFRA-12/后续任务另行决策。

Finding 2 — [P2] curl+Origin 被写成等价浏览器验收
位置：docs/rules/logging-rules.md:256-261
问题：规则把“真实浏览器实测”和“curl 携带 Origin”列为二选一，并称 curl+Origin 与 sendBeacon/fetch wire 行为等价。但 curl 无法覆盖真实浏览器中的 sendBeacon CORS/preflight、credentials/cookie 携带、Network 目标端口、page lifecycle flush 等行为；这正是 INFRA-16 审核指出的验收降级风险。
建议：改成 curl+Origin 仅作为 API/CORS 快速验证；涉及 client logger、sendBeacon、cookie 或 page lifecycle 的任务仍必须做真实浏览器验收，除非任务卡明确降级并记录原因。

Finding 3 — [P2] docs-format 验收仍未真正通过
位置：docs/task-queue.md:11138-11142
问题：任务卡验收仍写 `npm run verify:docs-format` 通过，但复跑该命令实际退出 1，报告 12 项既有问题。changelog 中说明新建 `logging-rules.md` 本身不在错误列表内，这是合理范围解释；但 task-queue 的验收项仍保留“通过”，会让完成态与真实守门结果不一致。
建议：把验收改成“新增 logging-rules.md 通过元信息检查；全局 verify:docs-format 仍因历史问题失败，另立文档维护卡”，或先修复历史问题后再声称通过。

复核验证：
- `git show --check -1`：PASS
- `npm run lint`：PASS（仅既有 react-hooks/exhaustive-deps warning）
- `npm run typecheck`：PASS
- `node node_modules/vitest/vitest.mjs run tests/unit/lib/logger.test.ts tests/unit/web-next/logger-client.test.ts`：PASS（37 tests）
- `npm run verify:docs-format`：FAIL（12 项历史问题；新增 logging-rules.md 元信息完整，不在错误列表内）

建议状态：INFRA-11 可按 CONDITIONAL PASS 进入修补。优先修正文档规则口径，避免后续 INFRA-12 或新增日志任务被错误的 worker service 与浏览器验收规则带偏。
-->

<!--
INFRA-17 修补任务草案（评审待开工）
起草人：主循环（claude-opus-4-7）
时间戳：2026-04-26 01:51:22 PDT
对象：整合 Codex INFRA-11 完成质量审核（3 finding）+ 主循环独立确认 3 P2 全成立，制定 INFRA-11 复审修补卡

## 修补任务卡

- **ID**：INFRA-17
- **标题**：INFRA-11 复审修补：worker service 命名 / 浏览器验收口径 / docs-format 验收措辞
- **序列**：SEQ-20260425-LOG-V1（追加，状态 🟡 待开工）
- **前置依赖**：INFRA-11 ✅（CONDITIONAL PASS）
- **建议模型**：sonnet（机械文档措辞修正，无新决策）
- **子代理**：无
- **估时**：0.2d
- **触发**：Codex INFRA-11 审核 3 finding（本提案第 1126–1156 行）+ 主循环独立确认 3 P2 全成立（无 P1）

## Finding 整合表（3 项）

| ID | 来源 | 级 | 位置 | 问题 |
| --- | --- | --- | --- | --- |
| F1 | Codex + 主循环复核 | P2 文档措辞 | `docs/rules/logging-rules.md:193-219`（§ 5） | ServiceName 命名规范把 `worker:crawler-worker` 等列为实例并写"新增 worker 时按此命名延续"。但实际代码 `apps/api/src/workers/maintenanceWorker.ts:18` 等：`baseLogger = createLogger({ service: 'api' })` + `baseLogger.child({ worker: 'crawler-worker' })` —— ndjson 顶层 `service` 永远是 `'api'`，worker 字段不带 `worker:` 前缀。`worker:${string}` ServiceName 类型实际从未实例化，是保留给未来独立 worker 进程。文档反向写成"惯例"会误导未来开发者破坏 dev.mjs 分流和现有 schema |
| F2 | Codex | P2 文档措辞 | `docs/rules/logging-rules.md:256-261`（§ 7）+ § 8.4 | 把"真实浏览器实测"与"curl 携带 Origin"列为二选一，并称 curl+Origin "与 sendBeacon/fetch wire 行为等价（除 page-unload 时序由单测覆盖）"。但 curl 不能覆盖 sendBeacon CORS preflight / 浏览器 cookie 自动携带（SameSite/SecureContext）/ Network 目标端口 / page lifecycle（pagehide/beforeunload flush）。这正是 INFRA-16 审核指出的验收降级风险被反向写入规则 |
| F3 | Codex | P2 验收口径 | `docs/task-queue.md:11138-11142` | INFRA-11 验收项写"`npm run verify:docs-format` 通过"，但脚本实际退出 1（12 项 pre-existing 历史问题）。changelog 已解释新建 logging-rules.md 不在错误列表（合理范围解释），但 task-queue 验收项措辞未同步——完成态与真实守门结果不一致 |

## 范围决策

- **纳入 INFRA-17**：F1 + F2 + F3（3 P2 全文档措辞问题，必修，否则规则文档反向带偏未来任务）
- **延期 / 不在本卡**：
  - verify:docs-format 12 项 pre-existing 历史问题（非本卡引入）：`task-queue.md` 时间字段格式 / `docs/archive/` 元信息 / `docs/rules/{git-rules,quality-gates,workflow-rules}.md` 缺 `superseded_by`。如需统一修复另开独立文档维护卡（不在 SEQ-20260425-LOG-V1 范围）

## 修复方案

### F1 修复（必修，§ 5 ServiceName 命名规范）

**`docs/rules/logging-rules.md` § 5**：

修订前（误导）：
```markdown
## 5. ServiceName 命名规范

`@resovo/logger/types.ts:ServiceName` 定义：
| 实例 | 来源 |
| `worker:crawler-worker` | apps/api/src/workers/crawlerWorker.ts |
| ... 9 个实例 |
新增 worker 时按此命名延续。
```

修订后（澄清现状）：
```markdown
## 5. ServiceName 命名规范

`@resovo/logger/types.ts:ServiceName` 类型定义保留 4 种：
- `api` — Fastify API 进程（实际使用）
- `worker:${string}` — 独立 worker 进程（**类型保留，当前未实例化**）
- `script` — 一次性脚本（实际使用）
- `client` — 浏览器上报路径（实际使用，由 client-log endpoint 派生）

### 5.1 当前 API 内 Bull workers 命名（实际惯例）

API 进程内的 9 个 Bull workers 与 API 同进程运行，统一用：
- 顶层 `service: 'api'`（由 baseLogger 一次性绑定，child 不覆盖）
- 子上下文 `worker: '<kebab-case-name>'`（child 派生时附加）

ndjson 输出形如：
{"service":"api","worker":"crawler-worker","job_id":"42",...}

不是 service:"worker:crawler-worker"。

[9 个 worker 实例表，字段名改为 worker 而非 service]

### 5.2 worker:${string} 类型保留场景

`worker:${string}` 类型保留给未来独立 worker 进程（独立部署、独立日志流），
当前 SEQ-20260425-LOG-V1 实施层未使用。INFRA-12（实现下沉）或后续任务
若需引入独立 worker 进程，需另行决策，不得自动套用此类型。

### 5.3 client 流分流

[原内容保留]
```

### F2 修复（必修，§ 7 浏览器→API 链路 + § 8.4 验收清单）

**§ 7 修订**：

修订前（弱化要求）：
```
涉及浏览器→API 链路的任务，验收必须包含以下二者**至少其一**：
1. 真实浏览器实测：...
2. curl 携带 `Origin: http://localhost:3000` 头模拟跨 origin 路径
   （与浏览器 sendBeacon / fetch 的 wire 行为等价，除 page-unload 时序由单测覆盖）
```

修订后（明确分级）：
```
涉及浏览器→API 链路的任务，验收要求按改动范围分级：

| 改动类型 | 必须真实浏览器 | curl+Origin 是否充分 |
| --- | --- | --- |
| 涉及 sendBeacon / page lifecycle (pagehide/beforeunload) flush | **必须** | 不充分 |
| 涉及浏览器 cookie 自动携带（credentials:'include'） | **必须** | 不充分（curl 不模拟 SameSite/SecureContext） |
| 仅服务端 CORS / 端点 origin 校验 | 可选 | 充分（API/CORS 快速验证） |
| 仅业务逻辑（端点内部 zod / 限流 / 鉴权） | 可选 | 充分 |

**curl + Origin 头不等价于真实浏览器**：
- 不模拟 sendBeacon CORS preflight
- 不携带 cookie（SameSite=Lax / Secure-only 在 prod）
- 不触发 page lifecycle flush
- 不覆盖 Network 面板真实端口验证

curl+Origin 仅作 API/CORS 快速验证手段；涉及浏览器侧行为（sendBeacon / cookie / page lifecycle）的任务仍**必须**真实浏览器实测，除非任务卡明确降级并记录原因。
```

**§ 8.4 修订**（同步）：
```
- [ ] 涉及前端→API 链路任务：按 § 7 分级要求执行
  - sendBeacon / page lifecycle / cookie 携带：必须真实浏览器实测
  - 仅 CORS / 端点 origin / 业务逻辑：curl+Origin 充分
- [ ] 禁止 `curl localhost:4000` 直连 API 端口替代浏览器路径（INFRA-16 审计教训）
```

### F3 修复（必修，task-queue 验收项措辞）

**`docs/task-queue.md` INFRA-11 验收项**：

修订前：
```
- `npm run verify:docs-format` 通过
```

修订后：
```
- 新增 `logging-rules.md` 通过元信息检查（7 字段完整：status / owner / scope / source_of_truth / supersedes / superseded_by / last_reviewed），不在 verify:docs-format 12 项错误列表内
- 全局 `verify:docs-format` 仍因 12 项 pre-existing 历史问题失败（与本卡无关：task-queue 时间字段 / archive 元信息 / 部分 rules 文档缺 superseded_by 字段），另立独立文档维护卡处理
```

### 文档改动汇总

| 文件 | 改动 | Finding |
| --- | --- | --- |
| `docs/rules/logging-rules.md` § 5（ServiceName 命名规范） | 修订为澄清当前实际惯例 + worker:${string} 类型保留场景 | F1 |
| `docs/rules/logging-rules.md` § 7（浏览器→API 链路） | "二选一"改为按改动类型分级 + 明确 curl+Origin 局限 | F2 |
| `docs/rules/logging-rules.md` § 8.4（验收清单） | 同步分级要求 | F2 |
| `docs/task-queue.md` INFRA-11 验收项 | 措辞改为"新增文档通过 + 全局历史问题另立卡" | F3 |
| `docs/changelog.md` INFRA-11 段 | 追加 CONDITIONAL PASS 备注 + 链接 INFRA-17 | — |
| `docs/changelog.md` | 追加 INFRA-17 完成条目 | — |
| `docs/tasks.md` | INFRA-17 工作台卡片（开工时写，完成后清空） | 流程 |
| `docs/task-queue.md` | 追加 INFRA-17 第 11 张卡（状态 ⬜→🔄→✅） | 流程 |

## 端到端验证清单

```
F1 验证：
1. logging-rules.md § 5 不再把 worker:crawler-worker 等列为 ServiceName 实例
2. § 5.1 明确"service:'api' + worker:'<name>'" 现状惯例
3. § 5.2 明确 worker:${string} 是类型保留
4. ndjson 样例输出对齐：{"service":"api","worker":"...",...}
5. 与 apps/api/src/workers/maintenanceWorker.ts:18 实际代码一致

F2 验证：
1. logging-rules.md § 7 不再写"二选一等价"措辞
2. 分级表覆盖 4 种改动类型 + curl 局限说明 (4 项)
3. § 8.4 验收清单同步分级要求
4. 与 INFRA-16 审计教训一致（curl 直连不等价于真实浏览器）

F3 验证：
1. task-queue.md INFRA-11 验收项措辞改为"新增文档通过 + 历史问题另立卡"
2. 与 changelog INFRA-11 段的"verify:docs-format 历史遗留说明"一致
3. 完成态与真实守门结果一致（不再声称"通过"）

无回归守门：
- npm run typecheck / lint / test:run 全绿（本卡纯文档改动）
- npm run verify:docs-format：新建文档继续通过（不引入新元信息错误）
```

## 验收清单

- [ ] § 5 ServiceName 命名规范修订完成（F1）：
  - [ ] worker:${string} 不再被列为"实例"，改为"类型保留"
  - [ ] 5.1 子节明确 service:'api' + worker:'<name>' 现状
  - [ ] 9 worker 表格字段名改为 worker（非 service）
  - [ ] 与代码实际一致（grep apps/api/src/workers/*.ts 验证）
- [ ] § 7 + § 8.4 浏览器验收口径修订完成（F2）：
  - [ ] 删除"等价二选一"措辞
  - [ ] 增分级表（sendBeacon/cookie/lifecycle 必须真实浏览器；CORS/端点逻辑 curl+Origin 充分）
  - [ ] 明列 curl 4 项局限（preflight / cookie / lifecycle / Network 端口）
- [ ] task-queue.md INFRA-11 验收项措辞修订完成（F3）：
  - [ ] 改为"新增文档通过 + 历史问题另立卡"
- [ ] `npm run typecheck` / `npm run lint` / `npm run test:run` 全绿（本卡纯文档）
- [ ] `npm run verify:docs-format`：logging-rules.md 仍通过元信息检查；不引入新错误
- [ ] changelog 附 ① F1 修订前后 § 5 内容对比 ② F2 分级表完整 ③ F3 task-queue 措辞 diff ④ INFRA-11 段回写指针
- [ ] 流程：本卡先写 tasks.md 工作台卡片再开工（延续 INFRA-14/15/16 范本，第 6 次应用）

## 完成备注要求

changelog INFRA-17 条目必附：
- ① F1 修订前后 § 5 ServiceName 命名规范关键 diff（特别是 worker:${string} 从"实例"改为"类型保留"）
- ② F2 分级表完整内容（4 改动类型 × 真实浏览器/curl 充分性矩阵 + curl 4 项局限）
- ③ F3 task-queue 措辞 diff（"通过"改为"新增通过 + 历史另立卡"）
- ④ INFRA-11 段回写指针："F1+F2+F3 已闭环，见 INFRA-17"
- ⑤ ndjson 真实样例 1 行（从 logs/dev/api.ndjson 抓取，确认 service:'api' + worker:'<name>' 现状一致）

## 偏离记录

- **verify:docs-format 12 项 pre-existing 历史问题**：本卡显式不修，措辞改为"另立独立文档维护卡"。如未来需统一修复，独立卡 INFRA-MAINT-DOC-FORMAT 或类似命名，不在 SEQ-20260425-LOG-V1 范围

## 流程纠正条款

延续 INFRA-14/15/16 范本，本卡开工时：
1. **先**写 tasks.md 工作台卡片（5 段：问题理解 / 根因 / 方案 / 涉及文件 / 验收清单 + 偏离风险）
2. **再**改 task-queue.md INFRA-17 状态 ⬜ → 🔄
3. 然后才动 logging-rules.md 措辞修订 + task-queue 验收项 + changelog
4. 完成后：清空 tasks.md + task-queue 状态 🔄 → ✅ + changelog 追加 + git commit
5. **本卡纯文档改动**：无代码层 typecheck/test 增量；守门以 verify:docs-format 不引入新错误为重点

## 评审状态

- 草案完成时间：2026-04-26 01:51:22 PDT
- 当前状态：等待用户确认开工
- 不动 task-queue.md / tasks.md 内容，本草案先 commit 入库作为评审记录（与 INFRA-13/14/15/16 草案节奏一致）
- 草案落盘后同步追加 task-queue.md 第 11 张卡片（INFRA-17，状态 ⬜）
-->

<!--
Reviewer: Codex
Review timestamp: 2026-04-26 02:11:38 -0700
Review target: INFRA-17 完成质量残留复审
Review status: CONDITIONAL PASS（仍有 1 个 P2 + 2 个 P3 残留）

## 残留发现

### Finding 1 (docs/rules/logging-rules.md:295-319) [P2]
§7 编号和内容重复。

INFRA-17 新增了 §7.1 / §7.2 / §7.3，但旧的 §7.1 / §7.2 仍保留在下方，导致同一文件里出现重复编号，且跨 origin 配置基线和 CORS 403 映射内容重复。后续引用 §7.1 / §7.2 会变得不确定。建议删除旧块或统一重排编号。

### Finding 2 (docs/rules/logging-rules.md:281-286) [P3]
鉴权行仍未限定 cookie/session 场景。

分级表仍写“端点内部 zod / 限流 / 鉴权”可用 curl+Origin 充分验证，但涉及浏览器 cookie 自动携带、SameSite、Secure 或 `credentials:'include'` 的 cookie/session 鉴权仍必须真实浏览器。建议改成“非浏览器 cookie/session 的鉴权逻辑”，或拆成 cookie/session 鉴权与 header/token 鉴权两行。

### Finding 3 (docs/changelog.md:11076-11080) [P3]
test:run 全绿记录未能复现。

完成记录写 `npm run test:run` 150 文件 / 1760 测试全绿，但 Codex 用 bundled Node 复跑全集时出现 1 个失败：`VideoImageSection` 破图降级测试。单独复跑该文件通过，说明更像既有 flaky 或测试隔离问题；它不指向 INFRA-17 文档改动，但完成记录的“全集全绿”当前不可复现。建议记录为 flaky / 复跑备注，或补一次稳定全集结果。

## 已复核通过项

- F1 worker service 命名规则已修正：当前 API 内 Bull workers 明确为 `service:'api' + worker:'<name>'`，`worker:${string}` 仅保留给未来独立 worker 进程。
- F3 docs-format 验收口径已修正：不再声称全局 `verify:docs-format` 通过，明确为新增文档通过元信息检查、12 项历史问题另立维护卡。

## 守门复核结果

- `git show --check -1`：PASS
- `npm run typecheck`：PASS
- `node_modules/.bin/turbo lint`（补齐 PATH 后）：PASS，保留既有 react-hooks warnings
- `npm run verify:docs-format`：FAIL，12 项历史问题，与任务卡记录一致
- bundled Node `vitest run`：1 / 1760 flaky 失败；单独复跑 `tests/unit/components/admin/videos/VideoImageSection.test.tsx` PASS
-->

<!--
INFRA-18 修补任务草案（评审待开工）
起草人：主循环（claude-opus-4-7）
时间戳：2026-04-26 02:15:07 PDT
对象：整合 Codex INFRA-17 残留复审（1 P2 + 2 P3）+ 主循环独立确认全成立，制定 INFRA-17 复审修补卡

## 修补任务卡

- **ID**：INFRA-18
- **标题**：INFRA-17 残留修补：§ 7 编号去重 / 鉴权行 cookie 限定 / test:run flaky caveat
- **序列**：SEQ-20260425-LOG-V1（追加，状态 🟡 待开工）
- **前置依赖**：INFRA-17 ✅（CONDITIONAL PASS）
- **建议模型**：sonnet（机械文档去重 + 措辞收紧 + changelog caveat，无新决策）
- **子代理**：无
- **估时**：0.1d
- **触发**：Codex INFRA-17 残留复审 3 finding（本提案第 1383–1418 行）+ 主循环独立确认 1 P2 + 2 P3 全成立

## Finding 整合表（3 项）

| ID | 来源 | 级 | 位置 | 问题 |
| --- | --- | --- | --- | --- |
| F1 | Codex + 主循环复核 | P2 文档实质 bug | `docs/rules/logging-rules.md:311-319` | INFRA-17 修订 § 7 时新增 § 7.0 / 7.1（验收路径选择规则）/ 7.2（跨 origin 配置基线，新版）/ 7.3（CORS 拒绝映射为 403，新版），但**忘了删除**原文 § 7.1（跨 origin 配置基线）和 § 7.2（CORS 拒绝映射为 403）。结果同一文件出现 2 个 § 7.1 + 2 个 § 7.2，编号歧义 + 内容重复 9 行。grep `^### 7\.` 输出 6 行（应为 4 行） |
| F2 | Codex | P3 文档措辞 | `docs/rules/logging-rules.md:281-286`（§ 7.0 分级表第 4 行） | 分级表写"仅业务逻辑（端点内部 zod / 限流 / 鉴权）→ curl+Origin 充分"。但涉及浏览器 cookie 自动携带（SameSite / Secure / `credentials:'include'`）的 cookie/session 鉴权**仍必须**真实浏览器实测。当前措辞会让 prod 401 cookie 验证错误降级 |
| F3 | Codex | P3 完成记录 | `docs/changelog.md:11076-11080`（INFRA-17 守门段） | 完成记录写"npm run test:run 150 文件 / 1760 测试全绿"。Codex 用 bundled Node 复跑全集时出现 1 个 flaky 失败（`VideoImageSection` 破图降级测试），单跑 PASS——指向既有 flaky，不指向 INFRA-17 改动。但完成记录的"全集全绿"在 Codex 环境不可复现，应补 flaky caveat |

## 范围决策

- **纳入 INFRA-18**：F1（必修 P2）+ F2（必修 P3）+ F3（必修 P3）
- **延期 / 不在本卡**：
  - VideoImageSection flaky 测试本身（既有问题，独立环境议题，不在 SEQ-20260425-LOG-V1 范围）
  - verify:docs-format 12 项历史问题（INFRA-17 已显式延期到独立维护卡）

## 修复方案

### F1 修复（必修，P2）

**`docs/rules/logging-rules.md` 删除行 311-319**（重复的旧 § 7.1 + § 7.2 + 隔离空行）：

修订前结构：
```
### 7.0 验收要求按改动类型分级
### 7.1 验收路径选择规则
### 7.2 跨 origin 配置基线        ← 新版（保留）
### 7.3 CORS 拒绝映射为 403       ← 新版（保留）
### 7.1 跨 origin 配置基线        ← 旧版（删除）
### 7.2 CORS 拒绝映射为 403       ← 旧版（删除）
```

修订后结构：
```
### 7.0 验收要求按改动类型分级
### 7.1 验收路径选择规则
### 7.2 跨 origin 配置基线
### 7.3 CORS 拒绝映射为 403
```

验证：`grep -c "^### 7\." docs/rules/logging-rules.md` 输出 4（不再是 6）。

### F2 修复（必修，P3）

**`docs/rules/logging-rules.md` § 7.0 分级表第 4 行**：

修订前：
```markdown
| 仅业务逻辑（端点内部 zod / 限流 / 鉴权） | ☐ 可选 | ✅ 充分 |
```

修订后（拆为两行，区分鉴权类型）：
```markdown
| 端点内部 zod 校验 / 限流 | ☐ 可选 | ✅ 充分 |
| 鉴权：header/token（如 Authorization Bearer） | ☐ 可选 | ✅ 充分 |
| 鉴权：cookie/session（SameSite / Secure / `credentials:'include'`） | ✅ 必须 | ❌ 不充分 |
```

理由：
- header/token 鉴权（如 `Authorization: Bearer <jwt>`）：curl 可显式 `-H "Authorization: ..."` 完整模拟
- cookie/session 鉴权：浏览器侧自动携带行为（SameSite/Secure/HttpOnly）curl 不能准确模拟，必须真实浏览器

### F3 修复（必修，P3）

**`docs/changelog.md` INFRA-17 段守门栏目**追加 flaky caveat：

修订前：
```
- `npm run test:run` ✅ **150 文件 / 1760 测试**（与 INFRA-11/16 同，本卡纯文档无代码改动）
```

修订后：
```
- `npm run test:run` ✅ **150 文件 / 1760 测试**（主循环本机 Node v20.19.6）
  - **flaky caveat**（INFRA-18 后补充）：Codex 在 bundled Node 环境复跑出现 1 个 flaky 失败 `tests/unit/components/admin/videos/VideoImageSection.test.tsx` 破图降级测试；单独复跑该文件 PASS。指向既有 flaky 或测试隔离问题，与 INFRA-17 文档改动无关。建议未来在独立维护卡（非 SEQ-20260425-LOG-V1 范围）跟进 flaky 根因
```

### 文档改动汇总

| 文件 | 改动 | Finding |
| --- | --- | --- |
| `docs/rules/logging-rules.md:311-319` | 删除重复的旧 § 7.1 + § 7.2（9 行） | F1 |
| `docs/rules/logging-rules.md:281-286`（§ 7.0 分级表） | 第 4 行「业务逻辑（含鉴权）」拆为「业务逻辑」+「header/token 鉴权」+「cookie/session 鉴权」三行 | F2 |
| `docs/changelog.md` INFRA-17 段守门栏 | 追加 flaky caveat（VideoImageSection 既有 flaky，与本卡无关） | F3 |
| `docs/changelog.md` | 追加 INFRA-18 完成条目 | — |
| `docs/tasks.md` | 工作台 INFRA-18 卡片（开工时写，完成后清空） | 流程 |
| `docs/task-queue.md` | 序列尾部追加 INFRA-18 第 12 张卡（状态 ⬜→🔄→✅） | 流程 |

## 端到端验证清单

```
F1 验证：
1. grep -c "^### 7\." docs/rules/logging-rules.md
   修复前 == 6（重复）
   修复后 == 4（唯一）
2. grep -c "### 7\.1" docs/rules/logging-rules.md == 1（不再是 2）
3. grep -c "### 7\.2" docs/rules/logging-rules.md == 1（不再是 2）
4. 修订后 § 7 结构连续：7.0 → 7.1 → 7.2 → 7.3

F2 验证：
1. § 7.0 分级表第 4 行不再笼统说"鉴权"，而是分为 header/token vs cookie/session
2. cookie/session 鉴权明确"必须真实浏览器"
3. 与 INFRA-16 真实浏览器硬规则一致（cookie 自动携带不可 curl 模拟）

F3 验证：
1. changelog INFRA-17 守门段含 flaky caveat
2. 明确 VideoImageSection 是既有 flaky，与本卡改动无关
3. 不声称跨环境"全集全绿"

防回归（针对 F1 类编号重复疏忽）：
- INFRA-18 验收清单增加自检项「commit 前 grep -c "^### N\." docs/rules/<file>.md 输出唯一编号」
```

## 验收清单

- [ ] F1 § 7 编号去重：`grep -c "^### 7\." docs/rules/logging-rules.md` 输出 4（不再是 6）
- [ ] F1 行 311-319 重复块已删除
- [ ] F1 § 7 结构连续：7.0 → 7.1 → 7.2 → 7.3
- [ ] F2 分级表第 4 行拆为 header/token vs cookie/session 鉴权两行
- [ ] F2 cookie/session 鉴权明确"必须真实浏览器"
- [ ] F3 changelog INFRA-17 守门段补 flaky caveat（VideoImageSection 与本卡无关）
- [ ] **防回归**：commit 前 `grep -c "^### N\." docs/rules/<file>.md` 验证 § 7 + § 5 + § 8 编号唯一（避免 F1 类疏忽再发）
- [ ] `npm run typecheck` / `npm run lint` / `npm run test:run` 全绿（本卡纯文档）
- [ ] `npm run verify:docs-format`：logging-rules.md 仍通过元信息检查；不引入新错误（12 项 pre-existing 历史问题维持）
- [ ] changelog 附 ① F1 grep 计数前后对比 ② F2 分级表完整 3 行（含 cookie/session vs header/token 区分）③ F3 flaky caveat 内容 ④ INFRA-17 段回写指针
- [ ] 流程：本卡先写 tasks.md 工作台卡片再开工（延续 INFRA-14/15/16/17 范本，第 7 次应用）

## 完成备注要求

changelog INFRA-18 条目必附：
- ① F1 grep 计数对比：修复前 6 / 修复后 4，且 §7.1 / §7.2 各自唯一
- ② F2 分级表完整 3 行（业务逻辑 / header-token 鉴权 / cookie-session 鉴权）+ 拆分理由
- ③ F3 flaky caveat 完整内容（VideoImageSection 既有 flaky，与本卡无关，建议独立维护卡跟进）
- ④ INFRA-17 段回写指针："F1+F2+F3 已闭环，见 INFRA-18"
- ⑤ 防回归自检：commit 前 grep 验证编号唯一的输出截图（或文字记录）

## 偏离记录

- **VideoImageSection flaky 根因不在本卡**：明确为独立维护卡跟进（非 SEQ-20260425-LOG-V1 范围）。本卡仅在 changelog 加 caveat 不掩盖跨环境差异
- **F1 类疏忽防回归**：通过 INFRA-18 验收清单的 grep 自检项 + 本卡 changelog 的「防回归自检」备注要求强化未来同类任务

## 流程纠正条款

延续 INFRA-14/15/16/17 范本，本卡开工时：
1. **先**写 tasks.md 工作台卡片（5 段：问题理解 / 根因 / 方案 / 涉及文件 / 验收清单 + 偏离风险）
2. **再**改 task-queue.md INFRA-18 状态 ⬜ → 🔄
3. 然后才动 logging-rules.md 去重 + 分级表拆行 + changelog flaky caveat
4. **commit 前必跑 grep 自检**：`grep -c "^### N\." docs/rules/logging-rules.md` 验证 § 5 / § 7 / § 8 编号唯一（防 F1 类疏忽再发）
5. 完成后：清空 tasks.md + task-queue 状态 🔄 → ✅ + changelog 追加 + git commit
6. **本卡为修补的修补**：第 7 次范本应用，建议未来同类任务收紧实施纪律——文档段落删除/移动操作必须 commit 前 grep 编号自检

## 评审状态

- 草案完成时间：2026-04-26 02:15:07 PDT
- 当前状态：等待用户确认开工
- 不动 task-queue.md / tasks.md 内容，本草案先 commit 入库作为评审记录（与 INFRA-13/14/15/16/17 草案节奏一致）
- 草案落盘后同步追加 task-queue.md 第 12 张卡片（INFRA-18，状态 ⬜）
-->

