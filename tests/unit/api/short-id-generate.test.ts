/**
 * tests/unit/api/short-id-generate.test.ts — generateShortId 契约锁死（BUGFIX-SHORTID-DASH-A）
 *
 * 背景：CrawlerService 曾用 nanoid 默认字母表（含 `-`/`_`）生成 short_id，与前台
 * extractShortId「最后一个 `-` 分隔」协议（ADR-002 `<slug>-<shortId>`）冲突，
 * dev 库 12.1% 视频详情/播放页必现 404（存量清洗见 migration 110）。
 * 本测试锁死两条契约：字母表 `[0-9A-Za-z]`（禁 `-`/`_`）+ 定长 8（CHAR(8) 列）。
 */

import { describe, it, expect } from 'vitest'
import {
  generateShortId,
  SHORT_ID_ALPHABET,
  SHORT_ID_LENGTH,
} from '@/api/lib/short-id'

const SAMPLE_SIZE = 2000

describe('generateShortId（short_id 生成唯一真源）', () => {
  it(`恒为 ${SHORT_ID_LENGTH} 位（CHAR(8) 定长列，不足会被右补空格）`, () => {
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      expect(generateShortId()).toHaveLength(SHORT_ID_LENGTH)
    }
  })

  it('字母表恒为 [0-9A-Za-z]——禁 `-`（URL slug 分隔符）与 `_`', () => {
    const pattern = /^[0-9A-Za-z]+$/
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      expect(generateShortId()).toMatch(pattern)
    }
  })

  it('SHORT_ID_ALPHABET 常量本身不含 `-`/`_`（防字母表被改坏）', () => {
    expect(SHORT_ID_ALPHABET).not.toContain('-')
    expect(SHORT_ID_ALPHABET).not.toContain('_')
    expect(new Set(SHORT_ID_ALPHABET).size).toBe(62)
  })

  it('与 extractShortId 分隔协议往返兼容：`<slug>-<shortId>` 按最后一个 `-` 切回原值', () => {
    // 协议实现在 apps/web-next/src/lib/short-id.ts（跨 app 不直接 import，按协议语义复刻断言）
    const extractShortId = (slug: string): string => {
      const lastDash = slug.lastIndexOf('-')
      return lastDash === -1 ? slug : slug.slice(lastDash + 1)
    }
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const shortId = generateShortId()
      expect(extractShortId(`attack-on-titan-${shortId}`)).toBe(shortId)
      expect(extractShortId(shortId)).toBe(shortId) // slug 为 null 时裸 shortId
    }
  })
})
