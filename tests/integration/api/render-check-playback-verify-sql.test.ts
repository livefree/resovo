/**
 * render-check-playback-verify-sql.test.ts — video_sources 健康写 query 真实 PG 集成
 * （BUGFIX-RENDERCHECK-PLAYBACK-SQL-CAST）
 *
 * 防回归：mock 单测不验真 SQL → PG 类型推断错（'could not determine data type of parameter $N'）
 * 全程被隐藏。本套件直调 query 函数跑真实 PG，断言**不抛 DatabaseError**。
 *
 * 根因：可空参数用于裸 `CASE WHEN $N IS NOT NULL`（无类型 OID）→ PG parse 阶段无法推断类型。
 *   parse 阶段错先于行匹配 → 用不存在 uuid 即可触发/验证，零副作用（不改任何真实行）。
 *
 * 覆盖：
 *   - updateSourceHealthAfterRenderCheck（既有 bug，「全部试播」点击线路不更新根因）
 *   - recordAdminPlaybackVerifySuccess（ADR-198 -B 同根因回归，admin 真实播放成功路径）
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Pool } from 'pg'
import { createIntegrationPool } from '../../helpers/integration-pg'
import {
  updateSourceHealthAfterRenderCheck,
  recordAdminPlaybackVerifySuccess,
} from '../../../apps/api/src/db/queries/video_sources'

// 合法 uuid 格式但不存在 → UPDATE 匹配 0 行（parse 阶段类型推断错仍会触发，故能验 cast）
const NONEXISTENT_ID = '00000000-0000-0000-0000-000000000000'

let db: Pool

beforeAll(() => {
  db = createIntegrationPool()
})

afterAll(async () => {
  await db.end()
})

describe('updateSourceHealthAfterRenderCheck SQL 集成（防 PG 类型推断偏离）', () => {
  it('全 null 参数（dead verdict / 服务端 403）不抛 could not determine data type', async () => {
    await expect(
      updateSourceHealthAfterRenderCheck(db, NONEXISTENT_ID, {
        renderStatus: 'dead',
        resolutionWidth: null,
        resolutionHeight: null,
        qualityDetected: null,
      }),
    ).resolves.toBeUndefined()
  })

  it('携分辨率参数（解析成功）不抛', async () => {
    await expect(
      updateSourceHealthAfterRenderCheck(db, NONEXISTENT_ID, {
        renderStatus: 'ok',
        resolutionWidth: 1920,
        resolutionHeight: 1080,
        qualityDetected: '1080P',
      }),
    ).resolves.toBeUndefined()
  })
})

describe('recordAdminPlaybackVerifySuccess SQL 集成（ADR-198 / 防 PG 类型推断偏离）', () => {
  it('无分辨率成功（全 null）不抛 + 行不存在返回 null', async () => {
    await expect(
      recordAdminPlaybackVerifySuccess(db, NONEXISTENT_ID, {
        resolutionWidth: null,
        resolutionHeight: null,
        qualityDetected: null,
      }),
    ).resolves.toBeNull()
  })

  it('携分辨率成功（无条件覆盖 quality）不抛 + 行不存在返回 null', async () => {
    await expect(
      recordAdminPlaybackVerifySuccess(db, NONEXISTENT_ID, {
        resolutionWidth: 1920,
        resolutionHeight: 1080,
        qualityDetected: '1080P',
      }),
    ).resolves.toBeNull()
  })
})
