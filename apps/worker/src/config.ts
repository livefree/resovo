export const config = {
  cron: {
    level1Probe: process.env.WORKER_CRON_LEVEL1 ?? '0 */6 * * *',
    level2Render: process.env.WORKER_CRON_LEVEL2 ?? '0 */2 * * *',
    feedbackDriven: process.env.WORKER_CRON_FEEDBACK ?? '*/1 * * * *',
  },
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
