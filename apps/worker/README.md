# @resovo/worker — SourceHealthWorker

独立 Node.js service，负责视频源健康度探测、分辨率采集与 feedback-driven 补验。

## 单实例约束 ⚠️

**本期 worker 必须单实例运行。** 原因：

- 熔断状态（circuit breaker）存储在进程内存，多实例间不共享
- `pg_advisory_xact_lock` 保证单 DB 连接内视频级聚合串行，但多实例启动多个 cron 会造成冗余任务争用

多实例水平扩展须把熔断 / advisory lock 协调状态外移到 Redis 或 DB，列入 M-SN-6 性能门。
详见 `docs/decisions.md` ADR-107。

## 启动

```bash
# 开发模式（热重载）
npm run -w @resovo/worker dev

# 生产模式
npm run -w @resovo/worker start
```

需要 `.env.local`（或环境变量）：

| 变量名 | 说明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 |
| `LOG_LEVEL` | pino 日志级别（默认 `info`） |
| `WORKER_INSTANCE_ID` | 实例标识（默认 `worker-<pid>`） |
| `WORKER_CRON_LEVEL1` | Level 1 cron 表达式（默认 `0 */6 * * *`） |
| `WORKER_CRON_FEEDBACK` | feedback recheck cron（默认 `*/1 * * * *`） |

## CI 未配置

仓库当前无 `.github/workflows/` CI 配置。本地验证命令：

```bash
npm run -w @resovo/worker typecheck
npm run -w @resovo/worker lint
npm run test -- --run --reporter=verbose 2>&1 | grep -E "worker|PASS|FAIL"
```

## 架构概览

```
src/
├── index.ts              # 入口：cron 调度 + signal handlers
├── config.ts             # 集中环境变量 + cron 表达式
├── types.ts              # worker-local 类型定义
├── lib/
│   ├── db.ts             # 自建 pg.Pool（零 apps/api import）
│   ├── advisory-lock.ts  # 视频级 pg_advisory_xact_lock 封装
│   ├── circuit-breaker.ts # 站点级熔断（内存状态）
│   ├── retry-backoff.ts  # 指数退避 1/2/4/8/16s × 5
│   └── parsers/          # HLS / MP4 / DASH 无外依赖 parsers
├── observability/
│   ├── logger.ts         # pino + request_id job logger 工厂
│   └── metrics.ts        # 6 项结构化 metric 埋点
└── jobs/
    ├── source-health/
    │   ├── level1-probe.ts               # HEAD / manifest 可达性
    │   ├── level2-render.ts              # HLS / MP4 / DASH render check
    │   └── aggregate-source-check-status.ts # 视频级聚合
    └── feedback-driven-recheck.ts        # 消费 source_health_events queue
```
