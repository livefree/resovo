export const config = {
  cron: {
    level1Probe: process.env.WORKER_CRON_LEVEL1 ?? '0 */6 * * *',
    level2Render: process.env.WORKER_CRON_LEVEL2 ?? '0 */2 * * *',
    feedbackDriven: process.env.WORKER_CRON_FEEDBACK ?? '*/1 * * * *',
    // CHG-PRE-DEAD-LINE-AUTO-RETIRE-WORKER-B / Wave 4 #5-B / arch-reviewer Q2 推荐
    // 每日 03:30 UTC：避开 level1 整点波峰（0/6/12/18）+ 180 天阈值粒度允许 daily + 误报 24h 内可发现
    autoRetireLine: process.env.WORKER_CRON_AUTO_RETIRE_LINE ?? '30 3 * * *',
    // CHG-BNG-09：本地 dump 定时重导 bangumi_entries（默认每周日 04:00）
    bangumiDumpRefresh: process.env.WORKER_CRON_BANGUMI_DUMP ?? '0 4 * * 0',
    // ADR-216 D-216-10：视频播放事件批量聚合（每 1min；drain ≤10 独立事务 / 批 LIMIT=500）
    playStatsAggregate: process.env.WORKER_CRON_PLAY_STATS ?? '* * * * *',
  },
  // ops 维护的 Bangumi dump 文件路径（subject.jsonlines），应为绝对路径（worker CWD=apps/worker）。
  // 未配置 → cron 跳过（不设误导性相对默认值，避免标准启动下静默 no-op）。external-db/ 为 gitignore 本地产物。
  bangumiDumpPath: process.env.BANGUMI_DUMP_PATH?.trim() || null,
  rateLimit: {
    level1Global: 20,
    level1PerSite: 5,
    level2Global: 5,
    level2PerSite: 2,
  },
  circuitBreaker: {
    failureThreshold: 5,
    windowMs: 5 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000,
  },
  retry: {
    maxAttempts: 5,
    backoffMs: [1000, 2000, 4000, 8000, 16000] as readonly number[],
  },
  workerInstanceId: process.env.WORKER_INSTANCE_ID ?? `worker-${process.pid}`,
  probe: {
    timeoutMs: 10_000,
    level2TimeoutMs: 30_000,
    mp4RangeBytes: 65535,
  },
  db: {
    maxConnections: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  },
} as const
