import { z } from 'zod'

// ── 环境变量 Schema ───────────────────────────────────────────────

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // 数据库
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().url('ELASTICSEARCH_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // JWT & Cookie（生产环境强制 32 位）
  JWT_SECRET: z.string().min(
    process.env.NODE_ENV === 'production' ? 32 : 1,
    'JWT_SECRET is required (min 32 chars in production)'
  ),
  COOKIE_SECRET: z.string().min(
    process.env.NODE_ENV === 'production' ? 32 : 1,
    'COOKIE_SECRET is required (min 32 chars in production)'
  ),

  // 公开 URL
  NEXT_PUBLIC_API_URL: z.string().url('NEXT_PUBLIC_API_URL must be a valid URL'),
  NEXT_PUBLIC_APP_URL: z.string().url('NEXT_PUBLIC_APP_URL must be a valid URL'),

  // 服务端口
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // 爬虫资源站（可选，留空则不采集）
  CRAWLER_SOURCES: z.string().optional(),

  // Cloudflare R2（字幕存储，可选）
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
})

// ── 解析并 fail-fast ──────────────────────────────────────────────

const parsed = configSchema.safeParse(process.env)

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
    .join('\n')

  process.stderr.write(
    `\n[config] Missing or invalid environment variables:\n${missing}\n\nSee .env.example for required variables.\n\n`
  )
  process.exit(1)
}

export const config = parsed.data

export type Config = typeof config
