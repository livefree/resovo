/**
 * short-id.ts — videos.short_id 生成唯一真源（BUGFIX-SHORTID-DASH-A）
 *
 * 契约（破坏任一条都会导致前台 404，单测 tests/unit/api/short-id-generate.test.ts 锁死）：
 * 1. 字母表 `[0-9A-Za-z]`，**禁止 `-`**——前台 URL 协议（ADR-002）为 `<slug>-<shortId>`，
 *    web-next `extractShortId`（apps/web-next/src/lib/short-id.ts）按最后一个 `-` 切分，
 *    shortId 含 `-` 即被切坏（nanoid 默认字母表含 `-`/`_` 曾致 12% 视频必现 404，
 *    存量清洗见 migration 110）。
 * 2. 定长 8——DB 列为 `CHAR(8)`（001_init_tables.sql），不足 8 位会被右补空格
 *    （旧 `Math.random().toString(36).slice(2, 10)` 实现存在该隐患）。
 */

import { customAlphabet } from 'nanoid'

export const SHORT_ID_ALPHABET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

export const SHORT_ID_LENGTH = 8

export const generateShortId = customAlphabet(SHORT_ID_ALPHABET, SHORT_ID_LENGTH)
