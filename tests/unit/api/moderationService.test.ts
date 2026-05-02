/**
 * tests/unit/api/moderationService.test.ts
 * CHG-SN-4-05: ModerationService 状态机 + audit + ES 编排
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ModerationService } from '@/api/services/ModerationService'

vi.mock('@/api/db/queries/videos', () => ({
  transitionVideoState: vi.fn(),
}))
vi.mock('@/api/db/queries/reviewLabels', () => ({
  findReviewLabelByKey: vi.fn(),
}))
vi.mock('@/api/db/queries/video_sources', () => ({
  toggleVideoSource: vi.fn(),
  disableDeadSources: vi.fn(),
}))
vi.mock('@/api/db/queries/auditLog', () => ({
  insertAuditLog: vi.fn(),
}))

import * as videoQueries from '@/api/db/queries/videos'
import * as labelQueries from '@/api/db/queries/reviewLabels'
import * as sourceQueries from '@/api/db/queries/video_sources'
import * as auditQueries from '@/api/db/queries/auditLog'

const mockTransition = videoQueries.transitionVideoState as ReturnType<typeof vi.fn>
const mockFindLabel = labelQueries.findReviewLabelByKey as ReturnType<typeof vi.fn>
const mockToggle = sourceQueries.toggleVideoSource as ReturnType<typeof vi.fn>
const mockDisableDead = sourceQueries.disableDeadSources as ReturnType<typeof vi.fn>
const mockAudit = auditQueries.insertAuditLog as ReturnType<typeof vi.fn>

function makeDb() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 'vid-1', updated_at: '2026-05-02T00:00:00Z' }] }),
  } as unknown as import('pg').Pool
}
function makeEs() {
  return {
    delete: vi.fn().mockResolvedValue({}),
    index: vi.fn().mockResolvedValue({}),
  } as unknown as import('@elastic/elasticsearch').Client
}

const transitionResult = { id: 'vid-1', review_status: 'rejected', visibility_status: 'hidden', is_published: false, updated_at: '2026-05-02T00:00:00Z' }

describe('ModerationService.rejectLabeled', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    mockAudit.mockResolvedValue(undefined)
  })

  it('已知 labelKey → 使用该 key 拒绝，触发 audit + unindex', async () => {
    mockFindLabel.mockResolvedValue({ id: 'lbl-1', label_key: 'all_dead', label: '全线路失效', is_active: true })
    mockTransition.mockResolvedValue(transitionResult)
    const db = makeDb()
    const es = makeEs()
    const svc = new ModerationService(db, es)
    const result = await svc.rejectLabeled({ videoId: 'vid-1', labelKey: 'all_dead', actorId: 'user-1' })
    expect(result).toMatchObject({ id: 'vid-1', review_status: 'rejected' })
    expect(mockTransition).toHaveBeenCalledWith(db, 'vid-1', expect.objectContaining({ action: 'reject' }))
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('review_label_key'), expect.arrayContaining(['all_dead']))
    await vi.waitFor(() => expect(mockAudit).toHaveBeenCalled())
    await vi.waitFor(() => expect(es.delete).toHaveBeenCalled())
  })

  it('未知 labelKey (is_active=false) → fallback 到 other', async () => {
    mockFindLabel.mockResolvedValue({ id: 'lbl-x', label_key: 'deprecated_key', is_active: false })
    mockTransition.mockResolvedValue(transitionResult)
    const db = makeDb()
    const svc = new ModerationService(db, makeEs())
    await svc.rejectLabeled({ videoId: 'vid-1', labelKey: 'deprecated_key', actorId: 'user-1' })
    expect(db.query).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining(['other']))
  })

  it('视频不存在 → 返回 null', async () => {
    mockFindLabel.mockResolvedValue({ label_key: 'other', is_active: true, label: '其他' })
    mockTransition.mockResolvedValue(null)
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.rejectLabeled({ videoId: 'nonexistent', labelKey: 'other', actorId: 'user-1' })
    expect(result).toBeNull()
  })

  it('STATE_CONFLICT 异常正常向上抛', async () => {
    mockFindLabel.mockResolvedValue({ label_key: 'other', is_active: true, label: '其他' })
    mockTransition.mockRejectedValue(new Error('STATE_CONFLICT'))
    const svc = new ModerationService(makeDb(), makeEs())
    await expect(svc.rejectLabeled({ videoId: 'vid-1', labelKey: 'other', actorId: 'user-1' })).rejects.toThrow('STATE_CONFLICT')
  })
})

describe('ModerationService.stagingRevert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAudit.mockResolvedValue(undefined)
  })

  it('退回成功 → 触发 audit staging.revert', async () => {
    mockTransition.mockResolvedValue({ id: 'vid-1', review_status: 'pending_review', visibility_status: 'internal', is_published: false, updated_at: '2026-05-02T00:00:00Z' })
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.stagingRevert({ videoId: 'vid-1', actorId: 'user-1' })
    expect(result?.review_status).toBe('pending_review')
    await vi.waitFor(() => expect(mockAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: 'staging.revert' })))
  })
})

describe('ModerationService.disableDead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAudit.mockResolvedValue(undefined)
  })

  it('批量禁用 dead 线路 → 触发 audit + ES syncVideo', async () => {
    mockDisableDead.mockResolvedValue({ disabled: 2, sourceIds: ['s1', 's2'] })
    const db = makeDb()
    const es = makeEs()
    const svc = new ModerationService(db, es)
    const result = await svc.disableDead({ videoId: 'vid-1', actorId: 'user-1' })
    expect(result).toEqual({ disabled: 2, sourceIds: ['s1', 's2'] })
    await vi.waitFor(() => expect(mockAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: 'video_source.disable_dead_batch' })))
    await vi.waitFor(() => expect(es.index).toHaveBeenCalled())
  })
})

describe('ModerationService.toggleSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAudit.mockResolvedValue(undefined)
  })

  it('toggle is_active → 触发 audit video_source.toggle + ES sync', async () => {
    mockToggle.mockResolvedValue({ id: 's1', is_active: false })
    const es = makeEs()
    const svc = new ModerationService(makeDb(), es)
    await svc.toggleSource({ videoId: 'vid-1', sourceId: 's1', isActive: false, actorId: 'user-1' })
    await vi.waitFor(() => expect(mockAudit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ actionType: 'video_source.toggle' })))
    await vi.waitFor(() => expect(es.index).toHaveBeenCalled())
  })

  it('source 不存在 → 返回 null', async () => {
    mockToggle.mockResolvedValue(null)
    const svc = new ModerationService(makeDb(), makeEs())
    const result = await svc.toggleSource({ videoId: 'v', sourceId: 's-missing', isActive: true, actorId: 'u' })
    expect(result).toBeNull()
  })
})
