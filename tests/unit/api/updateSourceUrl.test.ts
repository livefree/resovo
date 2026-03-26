/**
 * tests/unit/api/updateSourceUrl.test.ts
 * CHG-202: updateSourceUrl — 源 URL 替换
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ContentService } from '@/api/services/ContentService'

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('@/api/db/queries/sources', () => ({
  updateSourceUrl: vi.fn(),
  findSourceById: vi.fn(),
  updateSourceActiveStatus: vi.fn(),
  listAdminSources: vi.fn(),
  deleteSource: vi.fn(),
  batchDeleteSources: vi.fn(),
  listSubmissions: vi.fn(),
  approveSubmission: vi.fn(),
  rejectSubmission: vi.fn(),
}))

vi.mock('@/api/db/queries/subtitles', () => ({
  listAdminSubtitles: vi.fn(),
  approveSubtitle: vi.fn(),
  rejectSubtitle: vi.fn(),
}))

vi.mock('@/api/workers/verifyWorker', () => ({
  checkUrl: vi.fn(),
}))

import * as sourcesQueries from '@/api/db/queries/sources'
const mockUpdateSourceUrl = sourcesQueries.updateSourceUrl as ReturnType<typeof vi.fn>

// ── Helpers ───────────────────────────────────────────────────────

function makeDb() {
  return {} as unknown as import('pg').Pool
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ContentService.updateSourceUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功替换 URL — 返回更新后的源记录', async () => {
    const db = makeDb()
    mockUpdateSourceUrl.mockResolvedValue({
      id: 'src-1',
      source_url: 'https://new.example.com/video.m3u8',
      is_active: true,
    })

    const svc = new ContentService(db)
    const result = await svc.updateSourceUrl('src-1', 'https://new.example.com/video.m3u8')

    expect(result).toEqual({
      id: 'src-1',
      source_url: 'https://new.example.com/video.m3u8',
      is_active: true,
    })
    expect(mockUpdateSourceUrl).toHaveBeenCalledWith(db, 'src-1', 'https://new.example.com/video.m3u8')
  })

  it('源不存在 — 返回 null', async () => {
    const db = makeDb()
    mockUpdateSourceUrl.mockResolvedValue(null)

    const svc = new ContentService(db)
    const result = await svc.updateSourceUrl('nonexistent', 'https://example.com/video.mp4')

    expect(result).toBeNull()
  })

  it('替换后 is_active 自动设为 true', async () => {
    const db = makeDb()
    mockUpdateSourceUrl.mockResolvedValue({
      id: 'src-1',
      source_url: 'https://fixed.example.com/video.m3u8',
      is_active: true,
    })

    const svc = new ContentService(db)
    const result = await svc.updateSourceUrl('src-1', 'https://fixed.example.com/video.m3u8')

    expect(result?.is_active).toBe(true)
  })
})
