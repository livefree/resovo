/**
 * PendingMetaQuickEdit.test.tsx — MODUX-P3-4-B 4 字段内联快编
 *
 * 验证（input 字段可直接驱动；AdminSelect stub 为原生 select 驱动 type）：
 *   - 渲染快编条 + 4 字段；genres 经 getVideo lazy-fetch
 *   - type 改 → saveModerationMeta({type}) + onSaved
 *   - year blur 改 → save({year:N})；非法（超范围）→ 不保存 + 回滚
 *   - country blur 改 → save({country})
 *   - 保存失败 → 回滚 + danger toast
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const getVideoMock = vi.fn()
const saveMetaMock = vi.fn()
const toastPushMock = vi.fn()

vi.mock('../../../../../../apps/server-next/src/lib/videos/api', () => ({
  getVideo: (...a: unknown[]) => getVideoMock(...a),
}))

vi.mock('../../../../../../apps/server-next/src/lib/moderation/api', () => ({
  saveModerationMeta: (...a: unknown[]) => saveMetaMock(...a),
}))

vi.mock('@resovo/admin-ui', async () => {
  const actual = await vi.importActual<typeof import('@resovo/admin-ui')>('@resovo/admin-ui')
  return {
    ...actual,
    useToast: () => ({ push: (i: unknown) => { toastPushMock(i); return 't' }, dismiss: vi.fn(), dismissAll: vi.fn() }),
    // AdminSelect → 原生 select stub（单选可 fireEvent.change 驱动；多选仅渲染）
    AdminSelect: (props: {
      value: string | readonly string[] | null
      onChange: (next: unknown) => void
      options: readonly { value: string; label: React.ReactNode }[]
      multiple?: boolean
      'data-testid'?: string
      disabled?: boolean
    }) =>
      props.multiple ? (
        <select multiple data-testid={props['data-testid']} disabled={props.disabled} value={props.value as string[]} onChange={() => {}}>
          {props.options.map((o) => <option key={o.value} value={o.value}>{String(o.label)}</option>)}
        </select>
      ) : (
        <select data-testid={props['data-testid']} value={(props.value as string) ?? ''} onChange={(e) => props.onChange(e.target.value || null)}>
          {props.options.map((o) => <option key={o.value} value={o.value}>{String(o.label)}</option>)}
        </select>
      ),
  }
})

import { PendingMetaQuickEdit } from '../../../../../../apps/server-next/src/app/admin/moderation/_client/PendingMetaQuickEdit'

type Props = Parameters<typeof PendingMetaQuickEdit>[0]

function makeVideo(over: Partial<Props['v']> = {}): Props['v'] {
  return {
    id: 'vid-1', slug: 's', shortId: 'V1', title: 'T', type: 'movie', year: 2020, country: 'US',
    episodeCount: 1, totalEpisodes: null, currentEpisodes: null, coverUrl: null, rating: null, category: null,
    isPublished: false, visibilityStatus: 'internal', reviewStatus: 'pending_review', reviewReason: null,
    reviewedBy: null, reviewedAt: null, probe: 'pending', render: 'pending',
    probeAggregate: { total: 0, ok: 0, state: 'pending' }, renderAggregate: { total: 0, ok: 0, state: 'pending' },
    sourceCheckStatus: 'pending', metaScore: 0, needsManualReview: false, badges: [], staffNote: null,
    reviewLabelKey: null, doubanStatus: 'pending', reviewSource: 'manual', trendingTag: null,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...over,
  } as unknown as Props['v']
}

async function renderQE(over: Partial<Props> = {}) {
  const onSaved = vi.fn()
  render(<PendingMetaQuickEdit v={makeVideo()} onSaved={onSaved} {...over} />)
  // flush genres lazy-fetch（getVideo resolve → setState）于 act 内，避免 act 警告
  await act(async () => {})
  return { onSaved }
}

beforeEach(() => {
  getVideoMock.mockReset().mockResolvedValue({ id: 'vid-1', genres: ['action'] })
  saveMetaMock.mockReset().mockResolvedValue({ skippedFields: [] })
  toastPushMock.mockReset()
})
afterEach(() => vi.clearAllMocks())

describe('PendingMetaQuickEdit（MODUX-P3-4-B）', () => {
  it('渲染快编条 + 4 字段 + genres lazy-fetch', async () => {
    await renderQE()
    expect(screen.getByTestId('pending-meta-quick-edit')).toBeTruthy()
    for (const id of ['quick-edit-type', 'quick-edit-year', 'quick-edit-country', 'quick-edit-genres']) {
      expect(screen.getByTestId(id)).toBeTruthy()
    }
    await waitFor(() => expect(getVideoMock).toHaveBeenCalledWith('vid-1'))
  })

  it('type 改 → saveModerationMeta({type}) + onSaved', async () => {
    const { onSaved } = await renderQE()
    fireEvent.change(screen.getByTestId('quick-edit-type'), { target: { value: 'series' } })
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { type: 'series' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('year blur 改 → save({year:N})', async () => {
    await renderQE()
    const input = screen.getByTestId('quick-edit-year')
    fireEvent.change(input, { target: { value: '1999' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { year: 1999 }))
  })

  it('year 非法（超范围 1800）→ 不保存 + 回滚显示', async () => {
    await renderQE()
    const input = screen.getByTestId('quick-edit-year') as HTMLInputElement
    fireEvent.change(input, { target: { value: '1800' } })
    fireEvent.blur(input)
    expect(saveMetaMock).not.toHaveBeenCalled()
    expect(input.value).toBe('2020') // 回滚到 v.year
  })

  it('country blur 改 → save({country})', async () => {
    await renderQE()
    const input = screen.getByTestId('quick-edit-country')
    fireEvent.change(input, { target: { value: 'JP' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { country: 'JP' }))
  })

  it('country 清空 → save({country:null})', async () => {
    await renderQE()
    const input = screen.getByTestId('quick-edit-country')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { country: null }))
  })

  it('该字段被锁（skippedFields 含本字段）→ 回滚乐观值 + warn + 始终调 onSaved（Codex fix2）', async () => {
    saveMetaMock.mockResolvedValueOnce({ skippedFields: ['country'] })
    const { onSaved } = await renderQE()
    const input = screen.getByTestId('quick-edit-country') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JP' } })
    fireEvent.blur(input)
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'warn' })))
    // 被锁未写入 → 回滚到 v.country，不可显示未保存的 'JP'
    await waitFor(() => expect(input.value).toBe('US'))
    // Codex fix2：始终刷新队列（后端真源，反映任何已落库写入，不隐藏）
    expect(onSaved).toHaveBeenCalled()
  })

  it('skippedFields 含其他字段（非本次提交字段）→ 本字段视为已保存（不误回滚）+ onSaved（Codex fix2）', async () => {
    // 提交 country，但后端回 skippedFields=['year']（他字段锁）→ country 实际已写 → 不回滚 country
    saveMetaMock.mockResolvedValueOnce({ skippedFields: ['year'] })
    const { onSaved } = await renderQE()
    const input = screen.getByTestId('quick-edit-country') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JP' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { country: 'JP' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    // country 不在 skippedFields → 已保存 → 不回滚（保留 'JP'）
    expect(input.value).toBe('JP')
  })

  it('保存失败 → 回滚 + danger toast', async () => {
    saveMetaMock.mockRejectedValueOnce(new Error('500'))
    await renderQE()
    const input = screen.getByTestId('quick-edit-country') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'JP' } })
    fireEvent.blur(input)
    await waitFor(() => expect(toastPushMock).toHaveBeenCalledWith(expect.objectContaining({ level: 'danger' })))
    await waitFor(() => expect(input.value).toBe('US')) // 回滚到 v.country
  })
})
