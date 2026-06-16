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
import { act, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'

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

  it('type 芯片点击 → saveModerationMeta({type}) + onSaved（一次点击，无下拉）', async () => {
    const { onSaved } = await renderQE()
    // v.type 默认 'movie' → 点击 'series' 芯片切换
    fireEvent.click(screen.getByTestId('quick-edit-type-series'))
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { type: 'series' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it('题材芯片点击 → toggle 切换 + saveModerationMeta({genres})（多选一次点击）', async () => {
    await renderQE() // genres lazy-fetch → ['action']
    // 点 'comedy'（原未选）→ 加入；点 'action'（原已选）→ 移除
    fireEvent.click(screen.getByTestId('quick-edit-genre-comedy'))
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { genres: ['action', 'comedy'] }))
    saveMetaMock.mockClear()
    fireEvent.click(screen.getByTestId('quick-edit-genre-action'))
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { genres: ['comedy'] }))
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

  it('年代候选芯片点击 → save({year}) + input 同步（一次点击）', async () => {
    await renderQE() // v.year=2020
    const thisYear = new Date().getFullYear() // 近几年候选含当年，且 ≠ 2020
    fireEvent.click(screen.getByTestId(`quick-edit-year-${thisYear}`))
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { year: thisYear }))
    expect((screen.getByTestId('quick-edit-year') as HTMLInputElement).value).toBe(String(thisYear))
  })

  it('地区候选芯片点击 → save({country}) + input 同步（一次点击）', async () => {
    await renderQE() // v.country='US'
    fireEvent.click(screen.getByTestId('quick-edit-country-JP'))
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { country: 'JP' }))
    expect((screen.getByTestId('quick-edit-country') as HTMLInputElement).value).toBe('JP')
  })

  // ── ADR-206 D-206-9（3B-3）：原名 / 别名（lazy-fetch detail 回填 + blur 提交）──
  it('原名/别名回填（lazy-fetch detail → input value，结构化 manual aka join）', async () => {
    getVideoMock.mockResolvedValue({ id: 'vid-1', genres: ['action'], title_original: 'ONE PIECE', aliases: ['航海王', '海盗王'] })
    await renderQE()
    await waitFor(() => expect((screen.getByTestId('quick-edit-title-original') as HTMLInputElement).value).toBe('ONE PIECE'))
    expect((screen.getByTestId('quick-edit-aliases') as HTMLInputElement).value).toBe('航海王, 海盗王')
  })

  it('原名 blur 改 → save({titleOriginal})', async () => {
    await renderQE() // 基线空（getVideoMock 默认无 title_original）
    const input = screen.getByTestId('quick-edit-title-original')
    fireEvent.change(input, { target: { value: 'ONE PIECE' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { titleOriginal: 'ONE PIECE' }))
  })

  it('别名 blur 改 → save({aliases: splitComma})（替换语义）', async () => {
    await renderQE()
    const input = screen.getByTestId('quick-edit-aliases')
    fireEvent.change(input, { target: { value: '航海王, ONE PIECE ,' } })
    fireEvent.blur(input)
    await waitFor(() => expect(saveMetaMock).toHaveBeenCalledWith('vid-1', { aliases: ['航海王', 'ONE PIECE'] }))
  })

  it('原名未改 blur → 不保存（baseRef 基线守卫）', async () => {
    getVideoMock.mockResolvedValue({ id: 'vid-1', genres: [], title_original: 'ONE PIECE', aliases: [] })
    await renderQE()
    await waitFor(() => expect((screen.getByTestId('quick-edit-title-original') as HTMLInputElement).value).toBe('ONE PIECE'))
    saveMetaMock.mockClear()
    fireEvent.blur(screen.getByTestId('quick-edit-title-original')) // 未改
    expect(saveMetaMock).not.toHaveBeenCalled()
  })

  it('切视频：原名/别名即时同步重置 + pending 期间不写 stale 旧值到新视频（Codex stop-time fix）', async () => {
    // video A：getVideo 回填 title_original='A原名' / aliases=['A别名']
    getVideoMock.mockResolvedValueOnce({ id: 'A', genres: [], title_original: 'A原名', aliases: ['A别名'] })
    const { rerender } = render(<PendingMetaQuickEdit v={makeVideo({ id: 'A' })} onSaved={vi.fn()} />)
    await act(async () => {})
    await waitFor(() => expect((screen.getByTestId('quick-edit-title-original') as HTMLInputElement).value).toBe('A原名'))

    // 切到 video B：getVideo(B) 永不 resolve（模拟 lazy-fetch pending 窗口）
    getVideoMock.mockImplementationOnce(() => new Promise(() => {}))
    saveMetaMock.mockClear()
    await act(async () => { rerender(<PendingMetaQuickEdit v={makeVideo({ id: 'B' })} onSaved={vi.fn()} />) })

    // effect 同步清空 → 立即为空（不残留 A 的原名/别名，不等 getVideo B resolve）
    expect((screen.getByTestId('quick-edit-title-original') as HTMLInputElement).value).toBe('')
    expect((screen.getByTestId('quick-edit-aliases') as HTMLInputElement).value).toBe('')
    // pending 期间 blur → base='' value='' 相等 → 不提交（绝不把 A 的 stale 值写到 B）
    fireEvent.blur(screen.getByTestId('quick-edit-title-original'))
    fireEvent.blur(screen.getByTestId('quick-edit-aliases'))
    expect(saveMetaMock).not.toHaveBeenCalled()
  })

  it('年代/地区候选芯片 mousedown 阻止默认（防 input blur 用 stale 值与芯片提交竞态，Codex fix）', async () => {
    await renderQE()
    for (const tid of [`quick-edit-year-${new Date().getFullYear()}`, 'quick-edit-country-JP']) {
      const chip = screen.getByTestId(tid)
      const ev = createEvent.mouseDown(chip) // cancelable mousedown
      fireEvent(chip, ev)
      expect(ev.defaultPrevented).toBe(true) // 阻止失焦 → blur 不会用 stale 输入值抢先提交
    }
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
