/**
 * video-play-analytics-guards.test.ts — STATS-07-A 静态守护门（ADR-217 / SEQ-20260624-02）
 *
 * 把 ADR-217 的「数据源唯一」「分层不越层」「端点已注册」「时区同源」从口号升为 CI 可拦：
 *   ① 数据源静态门（D-217-3 / Codex 卡审 MEDIUM-3）：仅扫 VIDEO_PLAY_ANALYTICS_SQL 常量集，
 *      拒禁表、仅许 video_play_daily + videos（不扫整文件——本模块含 STATS-03 写 SQL 合法引 events）。
 *   ② 分层静态门（D-217-9 / Codex MEDIUM-4）：route 源不 import videoPlayStats query 模块（防直调越层）。
 *   ③ 注册门（Codex HIGH-2）：server.ts import + register adminVideoPlayAnalyticsRoutes（防文件存在但未挂载仍过 ADR 门）。
 *   ④ 时区同源静态门（D-217-2 / Codex MEDIUM-5 a）：api + worker pool 构造均无 SET TIME ZONE / options timezone。
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  VIDEO_PLAY_ANALYTICS_SQL,
  SQL_VIDEO_PLAYS_OVERVIEW,
  SQL_VIDEO_PLAYS_TREND,
  SQL_TOP_VIDEOS_BY_PLAYS,
} from '@/api/db/queries/videoPlayStats'

const REPO_ROOT = join(__dirname, '../../..')
const ROUTE_FILE = join(REPO_ROOT, 'apps/api/src/routes/admin/analytics.video-plays.ts')
const SERVER_FILE = join(REPO_ROOT, 'apps/api/src/server.ts')
const API_POOL_FILE = join(REPO_ROOT, 'apps/api/src/lib/postgres.ts')
const WORKER_POOL_FILE = join(REPO_ROOT, 'apps/worker/src/lib/db.ts')

// 唯一允许的真源 = video_play_daily（+ top-videos 的 videos join）。其余播放统计表 + users 一律禁。
const FORBIDDEN_TABLES = [
  'video_play_events',
  'video_play_hourly',
  'video_play_totals',
  'video_hot_scores',
  'video_play_daily_visitors',
  'users',
] as const

describe('① 数据源静态门：VIDEO_PLAY_ANALYTICS_SQL 仅 video_play_daily + videos', () => {
  it('3 条 analytics SQL 均引用 video_play_daily', () => {
    expect(VIDEO_PLAY_ANALYTICS_SQL).toHaveLength(3)
    for (const sql of VIDEO_PLAY_ANALYTICS_SQL) {
      // \b 单词边界：video_play_daily 后接 _visitors 时无边界，不会误命中 video_play_daily_visitors
      expect(sql).toMatch(/\bvideo_play_daily\b/)
    }
  })

  it('无任何禁表引用（events/hourly/totals/hot_scores/daily_visitors/users）', () => {
    for (const sql of VIDEO_PLAY_ANALYTICS_SQL) {
      for (const table of FORBIDDEN_TABLES) {
        expect(sql).not.toMatch(new RegExp(`\\b${table}\\b`))
      }
    }
  })
})

describe('② 分层静态门：route 不直 import query 模块', () => {
  it('analytics.video-plays.ts 不 import @/api/db/queries/videoPlayStats', () => {
    const src = readFileSync(ROUTE_FILE, 'utf-8')
    expect(src).not.toMatch(/from\s+['"]@\/api\/db\/queries\/videoPlayStats['"]/)
  })

  it('analytics.video-plays.ts import VideoPlayAnalyticsService（走 service 层）', () => {
    const src = readFileSync(ROUTE_FILE, 'utf-8')
    expect(src).toMatch(/from\s+['"]@\/api\/services\/VideoPlayAnalyticsService['"]/)
  })
})

describe('③ 注册门：server.ts 挂载 adminVideoPlayAnalyticsRoutes', () => {
  it('server.ts import + register（prefix /v1）', () => {
    const src = readFileSync(SERVER_FILE, 'utf-8')
    expect(src).toMatch(
      /import\s+\{\s*adminVideoPlayAnalyticsRoutes\s*\}\s+from\s+['"]@\/api\/routes\/admin\/analytics\.video-plays['"]/,
    )
    expect(src).toMatch(/register\(\s*adminVideoPlayAnalyticsRoutes\s*,\s*\{\s*prefix:\s*['"]\/v1['"]\s*\}\s*\)/)
  })
})

describe('④ 时区同源静态门：api + worker pool 无 SET TIME ZONE', () => {
  it('两侧真实 pool 构造源均无 SET TIME ZONE / options timezone（防单边漂移）', () => {
    for (const file of [API_POOL_FILE, WORKER_POOL_FILE]) {
      const src = readFileSync(file, 'utf-8')
      expect(src).not.toMatch(/SET\s+TIME\s+ZONE/i)
      expect(src).not.toMatch(/options\s*:\s*['"][^'"]*timezone/i)
    }
  })
})

// Codex 代码审 MEDIUM-2：top-videos 的存活过滤 + 确定性 tie-break + LIMIT，集成测依赖现网行存在性、
//   无删除/并列数据时删掉子句仍假绿。此处对 SQL 文本静态钉死关键子句，与 DB 行无关、CI 可拦。
//   trend/overview 的窗口/zero-fill/格式子句一并钉（延后集成测的 DB 形状覆盖前移到静态层）。
describe('⑤ SQL 子句静态门：关键语义子句不可被静默删除', () => {
  it('top-videos：JOIN videos + deleted_at IS NULL（仅存活视频）', () => {
    expect(SQL_TOP_VIDEOS_BY_PLAYS).toMatch(/JOIN\s+videos\b/i)
    expect(SQL_TOP_VIDEOS_BY_PLAYS).toMatch(/deleted_at\s+IS\s+NULL/i)
  })

  it('top-videos：确定性 tie-break ORDER BY SUM(play_count) DESC, SUM(total_watch_seconds) DESC, v.id ASC', () => {
    expect(SQL_TOP_VIDEOS_BY_PLAYS).toMatch(
      /ORDER\s+BY\s+SUM\(d\.play_count\)\s+DESC\s*,\s*SUM\(d\.total_watch_seconds\)\s+DESC\s*,\s*v\.id\s+ASC/i,
    )
  })

  it('top-videos：LIMIT 参数化（$2）', () => {
    expect(SQL_TOP_VIDEOS_BY_PLAYS).toMatch(/LIMIT\s+\$2/i)
  })

  it('trend：generate_series(...)::date zero-fill 序列 + 严格 to_char YYYY-MM-DD', () => {
    expect(SQL_VIDEO_PLAYS_TREND).toMatch(/generate_series\([\s\S]*\)::date/i)
    expect(SQL_VIDEO_PLAYS_TREND).toMatch(/LEFT\s+JOIN\s+video_play_daily/i)
    expect(SQL_VIDEO_PLAYS_TREND).toMatch(/to_char\(\s*s\.day\s*,\s*'YYYY-MM-DD'\s*\)/i)
  })

  it('overview / trend：近 N 自然日窗口 CURRENT_DATE - ($1::int - 1)（含端点）', () => {
    expect(SQL_VIDEO_PLAYS_OVERVIEW).toMatch(/CURRENT_DATE\s*-\s*\(\s*\$1::int\s*-\s*1\s*\)/i)
    expect(SQL_VIDEO_PLAYS_OVERVIEW).toMatch(/bucket_date\s*<=\s*CURRENT_DATE/i)
    expect(SQL_VIDEO_PLAYS_TREND).toMatch(/CURRENT_DATE\s*-\s*\(\s*\$1::int\s*-\s*1\s*\)/i)
  })
})
