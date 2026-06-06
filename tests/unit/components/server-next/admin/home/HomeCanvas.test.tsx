/**
 * HomeCanvas.test.tsx — 前台同构画布测试（CHG-HOME-CANVAS-A / 方案 §3）
 *
 * 覆盖（视图卡 ≥9 用例规范）：
 * - loading / error+retry / 7 区块渲染序
 * - 区块形态：banner wide / top10 rank 角标 / type_shortcuts chips / featured 网格
 * - 卡片：source pill（pinned/auto·origin/fallback）/ flags 警示 / empty 占位
 * - 区块选中高亮回调
 * - generatedAt 工具条 + 刷新重拉
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import type { ReactNode } from 'react'

// ── mock @dnd-kit（BannerOpsSection.test 同范式：jsdom 不支持 sensors）──
// DndContext 捕获 onDragEnd 供测试手动触发（CHG-HOME-CARD-DND-B）
type DragEndHandler = (event: { active: { id: string }; over: { id: string } | null }) => void
let capturedOnDragEnd: DragEndHandler | undefined

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd?: DragEndHandler }) => {
    capturedOnDragEnd = onDragEnd
    return <>{children}</>
  },
  closestCenter: vi.fn(),
  useDroppable: () => ({ setNodeRef: vi.fn() }),
}))
vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
  horizontalListSortingStrategy: vi.fn(),
  rectSortingStrategy: vi.fn(),
  arrayMove: <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    return next
  },
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}))

// useToast 捕获（CARD-DND-B-FIX：跨区块部分持久化差异化提示断言）；其余 admin-ui 导出走真实现
const mockToastPush = vi.fn()
vi.mock('@resovo/admin-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@resovo/admin-ui')>()
  return {
    ...actual,
    useToast: () => ({ push: mockToastPush, dismiss: vi.fn(), dismissAll: vi.fn() }),
  }
})

vi.mock('../../../../../../apps/server-next/src/lib/home-curation/api', () => ({
  getHomePreview: vi.fn(),
  listHomeSections: vi.fn(),
  updateHomeSectionSettings: vi.fn(),
  reorderHomeSection: vi.fn(),
  // CHG-HOME-AUTOFILL-UI：Inspector 内嵌候选池（选中区块即拉取）
  getAutofillCandidates: vi.fn(),
  applyAutofillCandidates: vi.fn(),
  refreshSectionCandidates: vi.fn(),
}))
vi.mock('../../../../../../apps/server-next/src/lib/home-modules/api', () => ({
  updateHomeModule: vi.fn(),
}))

import { getHomePreview, reorderHomeSection, getAutofillCandidates } from '../../../../../../apps/server-next/src/lib/home-curation/api'
import { updateHomeModule } from '../../../../../../apps/server-next/src/lib/home-modules/api'
import { HomeCanvas } from '../../../../../../apps/server-next/src/app/admin/home/_client/canvas/HomeCanvas'
import type { HomePreview, HomePreviewCard, HomePreviewSection, HomeSectionKey, HomeSectionSettings } from '../../../../../../apps/server-next/src/lib/home-curation/types'

const mockedPreview = vi.mocked(getHomePreview)
const mockedReorder = vi.mocked(reorderHomeSection)
const mockedUpdateModule = vi.mocked(updateHomeModule)

const SECTION_KEYS: HomeSectionKey[] = ['banner', 'type_shortcuts', 'featured', 'top10', 'hot_movies', 'hot_series', 'hot_anime']

function settings(section: HomeSectionKey): HomeSectionSettings {
  return {
    id: `s-${section}`,
    section,
    autofillMode: 'manual_plus_autofill',
    refreshIntervalMinutes: 60,
    displayCount: 3,
    allowDuplicates: false,
    pinnedLimit: null,
    settings: {},
    updatedAt: '2026-06-06T00:00:00Z',
  }
}

function card(over: Partial<HomePreviewCard> = {}): HomePreviewCard {
  return {
    source: 'pinned',
    refId: 'r-1',
    videoId: 'v-1',
    title: '示例卡片',
    imageUrl: 'https://cdn.example.com/c.jpg',
    linkHint: 'slug-v-1',
    startAt: null,
    endAt: null,
    enabled: true,
    flags: [],
    explain: null,
    ...over,
  }
}

const EMPTY: HomePreviewCard = card({ source: 'empty', refId: null, videoId: null, title: null, imageUrl: null, linkHint: null })

function preview(sectionsOver: Partial<Record<HomeSectionKey, HomePreviewCard[]>> = {}): HomePreview {
  const sections: HomePreviewSection[] = SECTION_KEYS.map((key) => ({
    key,
    settings: settings(key),
    cards: sectionsOver[key] ?? [card({ refId: `r-${key}` })],
  }))
  return {
    sections,
    generatedAt: '2026-06-06T01:00:00Z',
    context: { brandSlug: null, locale: null, at: null, device: 'desktop' },
  }
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockedPreview.mockResolvedValue(preview())
  // 候选池默认空快照（专项覆盖见 CandidatePoolPanel.test.tsx）
  vi.mocked(getAutofillCandidates).mockResolvedValue({ candidates: [], snapshotAt: null, policyVersion: null })
})

describe('HomeCanvas — 加载与布局', () => {
  it('加载中渲染 skeleton（无画布容器）', () => {
    mockedPreview.mockReturnValue(new Promise(() => {}))
    const { container } = render(<HomeCanvas />)
    expect(container.querySelector('[data-testid="home-canvas"]')).toBeNull()
  })

  it('加载失败 → ErrorState + 重试重拉 preview', async () => {
    mockedPreview.mockRejectedValue(new Error('boom'))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByText('画布加载失败')).not.toBeNull())
    mockedPreview.mockReset()
    mockedPreview.mockResolvedValue(preview())
    fireEvent.click(screen.getByText('重试'))
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
  })

  it('7 区块按前台渲染序展示', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
    const sections = screen.getAllByTestId(/^canvas-section-/)
    expect(sections.map((s) => s.getAttribute('data-testid'))).toEqual(
      SECTION_KEYS.map((k) => `canvas-section-${k}`),
    )
  })

  it('generatedAt 工具条渲染 + 刷新按钮重拉 preview', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-generated-at')).not.toBeNull())
    expect(mockedPreview).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('canvas-refresh-btn'))
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2))
  })
})

describe('HomeCanvas — 区块形态与卡片语义', () => {
  it('top10 非空卡渲染 rank 角标序号', async () => {
    mockedPreview.mockResolvedValue(preview({ top10: [card({ refId: 'r-t1' }), card({ refId: 'r-t2' })] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-top10')).not.toBeNull())
    const top10 = screen.getByTestId('canvas-section-top10')
    expect(top10.textContent).toContain('1')
    expect(top10.textContent).toContain('2')
  })

  it('type_shortcuts 渲染 chips（含空位虚线 chip）', async () => {
    mockedPreview.mockResolvedValue(preview({ type_shortcuts: [card({ title: '电影' }), EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-chips-type_shortcuts')).not.toBeNull())
    const chips = screen.getByTestId('canvas-chips-type_shortcuts')
    expect(chips.textContent).toContain('电影')
    expect(chips.textContent).toContain('+ 空位')
  })

  it('auto 卡 source pill 携带 explain.origin；fallback 卡显示「兜底」', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ source: 'auto', refId: null, explain: { origin: 'trending', rank: 1, score: 8.5 } })],
      hot_movies: [card({ source: 'fallback', refId: null, videoId: 'v-f1', explain: { origin: 'trending', rank: 1, score: null } })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(screen.getByTestId('canvas-section-featured').textContent).toContain('自动·trending')
    expect(screen.getByTestId('canvas-section-hot_movies').textContent).toContain('兜底·trending')
  })

  it('flags 警示 Pill 渲染（ref_broken / missing_image / pending）', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ flags: ['ref_broken', 'missing_image', 'pending'], imageUrl: null })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    const featured = screen.getByTestId('canvas-section-featured')
    expect(featured.textContent).toContain('引用失效')
    expect(featured.textContent).toContain('缺图')
    expect(featured.textContent).toContain('待生效')
  })

  it('empty 占位卡渲染「空位」虚线框', async () => {
    mockedPreview.mockResolvedValue(preview({ hot_anime: [EMPTY, EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-hot_anime')).not.toBeNull())
    expect(screen.getByTestId('canvas-card-empty-0')).not.toBeNull()
    expect(screen.getByTestId('canvas-card-empty-1')).not.toBeNull()
  })

  it('区块点击 → onSelectSection 回调 + 选中高亮态', async () => {
    const onSelect = vi.fn()
    render(<HomeCanvas onSelectSection={onSelect} />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    expect(onSelect).toHaveBeenCalledWith('featured')
  })

  it('槽位计数：非 empty 卡数 / displayCount', async () => {
    mockedPreview.mockResolvedValue(preview({ featured: [card(), card({ refId: 'r-2' }), EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(screen.getByTestId('canvas-section-featured').textContent).toContain('2/3 位')
  })
})

// ── CHG-HOME-CANVAS-B：环境栏 + Inspector ────────────────────────────────────

import { updateHomeSectionSettings } from '../../../../../../apps/server-next/src/lib/home-curation/api'

const mockedUpdateSettings = vi.mocked(updateHomeSectionSettings)

/** AdminInput 的 data-testid 在容器 div，真实 input 为内层 input */
function innerInput(testId: string): HTMLInputElement {
  const input = screen.getByTestId(testId).querySelector('input')
  if (!input) throw new Error(`no inner input under ${testId}`)
  return input
}

describe('HomeCanvas — 环境栏（CANVAS-B）', () => {
  it('环境栏渲染四参数控件 + 应用按钮', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-env-bar')).not.toBeNull())
    expect(screen.getByTestId('env-brand-slug')).not.toBeNull()
    expect(screen.getByTestId('env-locale')).not.toBeNull()
    expect(screen.getByTestId('env-at')).not.toBeNull()
    expect(screen.getByTestId('env-device')).not.toBeNull()
  })

  it('「应用」携带参数重拉 preview（brandSlug + device）', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(1))
    fireEvent.change(innerInput('env-brand-slug'), { target: { value: 'alpha' } })
    fireEvent.click(screen.getByTestId('env-apply-btn'))
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2))
    expect(mockedPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandSlug: 'alpha', device: 'desktop' }),
    )
  })
})

describe('HomeCanvas — Inspector（CANVAS-B）', () => {
  it('未选中区块 → 提示态', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
    expect(screen.getByTestId('inspector-empty')).not.toBeNull()
  })

  it('点击区块 → Inspector 展示该区块 settings 表单（预填）', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    await waitFor(() => expect(screen.queryByTestId('section-inspector-featured')).not.toBeNull())
    expect(innerInput('inspector-display-count').value).toBe('3')
    expect(innerInput('inspector-refresh-interval').value).toBe('60')
  })

  it('编辑 displayCount 保存 → updateHomeSectionSettings 调用 + 保存后重拉 preview', async () => {
    mockedUpdateSettings.mockResolvedValue({ ...settings('featured'), displayCount: 6 })
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    await waitFor(() => expect(screen.queryByTestId('inspector-save-btn')).not.toBeNull())

    fireEvent.change(innerInput('inspector-display-count'), { target: { value: '6' } })
    const callsBefore = mockedPreview.mock.calls.length
    fireEvent.click(screen.getByTestId('inspector-save-btn'))

    await waitFor(() => {
      expect(mockedUpdateSettings).toHaveBeenCalledWith('featured', expect.objectContaining({
        displayCount: 6,
        autofillMode: 'manual_plus_autofill',
        refreshIntervalMinutes: 60,
        allowDuplicates: false,
        pinnedLimit: null,
      }))
    })
    await waitFor(() => expect(mockedPreview.mock.calls.length).toBeGreaterThan(callsBefore))
  })

  it('refreshIntervalMinutes 清空保存 → 传 null（停用自动重算）', async () => {
    mockedUpdateSettings.mockResolvedValue({ ...settings('featured'), refreshIntervalMinutes: null })
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    await waitFor(() => expect(screen.queryByTestId('inspector-refresh-interval')).not.toBeNull())

    fireEvent.change(innerInput('inspector-refresh-interval'), { target: { value: '' } })
    fireEvent.click(screen.getByTestId('inspector-save-btn'))
    await waitFor(() => {
      expect(mockedUpdateSettings).toHaveBeenCalledWith('featured', expect.objectContaining({
        refreshIntervalMinutes: null,
      }))
    })
  })

  it('displayCount 非法（非正整数）→ 本地拦截不调端点', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    fireEvent.click(screen.getByTestId('canvas-section-featured'))
    await waitFor(() => expect(screen.queryByTestId('inspector-display-count')).not.toBeNull())

    fireEvent.change(innerInput('inspector-display-count'), { target: { value: '0' } })
    fireEvent.click(screen.getByTestId('inspector-save-btn'))
    await waitFor(() => expect(screen.queryByTestId('inspector-save-btn')).not.toBeNull())
    expect(mockedUpdateSettings).not.toHaveBeenCalled()
  })
})

// ── CHG-HOME-CARD-DND-B：拖拽编排（捕获 onDragEnd 手动触发）──────────────────

describe('HomeCanvas — 同区块拖拽（端点 #6）', () => {
  function drag(activeId: string, overId: string | null) {
    capturedOnDragEnd?.({ active: { id: activeId }, over: overId ? { id: overId } : null })
  }

  beforeEach(() => {
    mockedReorder.mockResolvedValue({ updated: 2 })
  })

  it('pinned 卡注册 sortable；auto/empty 卡不注册（不可拖）', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [
        card({ refId: 'r-p1' }),
        card({ source: 'auto', refId: null, videoId: 'v-a1', explain: { origin: 'trending', rank: 1, score: null } }),
        EMPTY,
      ],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(screen.queryByTestId('canvas-sortable-r-p1')).not.toBeNull()
    // auto / empty 卡无真源行 id → 不在 sortable 注册（refId null）
    expect(screen.queryAllByTestId(/^canvas-sortable-/)).toHaveLength(7) // 每区块默认 1 pinned + featured 覆写 1
  })

  it('同区块拖拽 → reorderHomeSection 全序载荷 + silent 重拉', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ refId: 'r-a' }), card({ refId: 'r-b' })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(mockedPreview).toHaveBeenCalledTimes(1)

    drag('r-a', 'r-b')
    await waitFor(() => {
      expect(mockedReorder).toHaveBeenCalledWith('featured', [
        { id: 'r-b', ordering: 0 },
        { id: 'r-a', ordering: 1 },
      ])
    })
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2)) // silent 重拉
  })

  it('banner 区块内拖拽 → 门面 banner 分派（home_banners 排序经审计路径）', async () => {
    mockedPreview.mockResolvedValue(preview({
      banner: [card({ refId: 'bn-1', videoId: null }), card({ refId: 'bn-2', videoId: null })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-banner')).not.toBeNull())

    drag('bn-2', 'bn-1')
    await waitFor(() => {
      expect(mockedReorder).toHaveBeenCalledWith('banner', [
        { id: 'bn-2', ordering: 0 },
        { id: 'bn-1', ordering: 1 },
      ])
    })
  })

  it('拖到自身 / 区块容器（同区块）→ 无位移不调端点', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    drag('r-featured', 'r-featured')
    drag('r-featured', 'section:featured')
    expect(mockedReorder).not.toHaveBeenCalled()
  })

  it('排序失败 → 重拉恢复（端点报错不中断画布）', async () => {
    mockedPreview.mockResolvedValue(preview({
      featured: [card({ refId: 'r-a' }), card({ refId: 'r-b' })],
    }))
    mockedReorder.mockRejectedValue(new Error('VALIDATION_ERROR'))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-a', 'r-b')
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2)) // 失败仍重拉
    expect(screen.queryByTestId('home-canvas')).not.toBeNull()
  })
})

describe('HomeCanvas — 跨区块确认弹层（方案 §5.3）', () => {
  function drag(activeId: string, overId: string | null) {
    capturedOnDragEnd?.({ active: { id: activeId }, over: overId ? { id: overId } : null })
  }

  beforeEach(() => {
    mockedReorder.mockResolvedValue({ updated: 2 })
    mockedUpdateModule.mockResolvedValue({} as never)
  })

  it('视频卡 featured→top10 → 弹确认层（语义提示）且未调任何写端点', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-featured', 'r-top10')
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).not.toBeNull())
    expect(screen.getByTestId('cross-section-confirm-modal').textContent).toContain('精选推荐')
    expect(screen.getByTestId('cross-section-confirm-modal').textContent).toContain('TOP 10')
    expect(mockedUpdateModule).not.toHaveBeenCalled()
    expect(mockedReorder).not.toHaveBeenCalled()
  })

  it('确认 → PATCH slot + 端点 #6 重排目标区块（落点位置插入）+ 关弹层', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-featured', 'r-top10')
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('cross-section-confirm-btn'))

    await waitFor(() => {
      expect(mockedUpdateModule).toHaveBeenCalledWith('r-featured', { slot: 'top10' })
      expect(mockedReorder).toHaveBeenCalledWith('top10', [
        { id: 'r-featured', ordering: 0 },
        { id: 'r-top10', ordering: 1 },
      ])
    })
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).toBeNull())
  })

  it('取消 → 关弹层且无任何写调用', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-featured', 'r-hot_movies')
    await waitFor(() => expect(screen.queryByTestId('cross-section-cancel-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('cross-section-cancel-btn'))

    await waitFor(() => expect(screen.queryByTestId('cross-section-cancel-btn')).toBeNull())
    expect(mockedUpdateModule).not.toHaveBeenCalled()
    expect(mockedReorder).not.toHaveBeenCalled()
  })

  it('拖到空目标区块容器（section: 前缀）→ 落位末尾', async () => {
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-featured', 'section:hot_series')
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('cross-section-confirm-btn'))

    await waitFor(() => {
      expect(mockedReorder).toHaveBeenCalledWith('hot_series', [
        { id: 'r-hot_series', ordering: 0 },
        { id: 'r-featured', ordering: 1 }, // 容器落点 = 末尾
      ])
    })
  })

  it('边界拒绝：banner 卡不可拖出 / 非视频卡不可跨 / banner 与 type_shortcuts 不接受落位', async () => {
    mockedPreview.mockResolvedValue(preview({
      banner: [card({ refId: 'bn-1', videoId: 'v-link' })], // banner 行 linkType=video 也不可拖出
      type_shortcuts: [card({ refId: 'r-ts', videoId: null })],
    }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-banner')).not.toBeNull())

    drag('bn-1', 'r-featured')          // banner 卡拖出 → 拒绝（D-181-1 真源分离）
    drag('r-ts', 'r-featured')          // videoId null → 拒绝
    drag('r-featured', 'bn-1')          // 视频卡 → banner 区块 → 拒绝
    drag('r-featured', 'r-ts')          // 视频卡 → type_shortcuts → 拒绝

    expect(screen.queryByTestId('cross-section-confirm-btn')).toBeNull()
    expect(mockedUpdateModule).not.toHaveBeenCalled()
    expect(mockedReorder).not.toHaveBeenCalled()
  })

  it('第一步 PATCH slot 失败（零持久化）→ danger「移动失败」+ 关弹层 + 重拉', async () => {
    mockedUpdateModule.mockRejectedValue(new Error('STATE_CONFLICT'))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    expect(mockedPreview).toHaveBeenCalledTimes(1)

    drag('r-featured', 'r-top10')
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('cross-section-confirm-btn'))

    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).toBeNull())
    expect(mockedReorder).not.toHaveBeenCalled() // PATCH 失败不再 reorder
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: '移动失败',
      level: 'danger',
    }))
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2))
  })

  it('第二步 reorder 失败（slot 已持久化）→ warn 差异化提示「已移至…排序未应用」，不报「移动失败」（Codex review 修复）', async () => {
    mockedUpdateModule.mockResolvedValue({} as never)
    mockedReorder.mockRejectedValue(new Error('VALIDATION_ERROR'))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    drag('r-featured', 'r-top10')
    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).not.toBeNull())
    fireEvent.click(screen.getByTestId('cross-section-confirm-btn'))

    await waitFor(() => expect(screen.queryByTestId('cross-section-confirm-btn')).toBeNull())
    expect(mockedUpdateModule).toHaveBeenCalledWith('r-featured', { slot: 'top10' }) // 第一步已落库
    expect(mockToastPush).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('已移至') as string,
      level: 'warn',
    }))
    expect(mockToastPush).not.toHaveBeenCalledWith(expect.objectContaining({ title: '移动失败' }))
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2)) // 重拉反映真实位置
  })
})

// ── CHG-HOME-EMPTY-SLOTS：空卡片添加入口（方案 §5.2）─────────────────────────

describe('HomeCanvas — 空卡片添加入口', () => {
  it('empty 文案按区块：banner=添加横版 Banner / 视频型=添加视频', async () => {
    mockedPreview.mockResolvedValue(preview({ banner: [EMPTY], featured: [EMPTY], top10: [EMPTY] }))
    render(<HomeCanvas onEmptySlot={vi.fn()} />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-banner')).not.toBeNull())
    expect(screen.getByTestId('canvas-section-banner').textContent).toContain('添加横版 Banner')
    expect(screen.getByTestId('canvas-section-featured').textContent).toContain('添加视频')
    expect(screen.getByTestId('canvas-section-top10').textContent).toContain('添加视频')
  })

  it('empty 点击上抛 onEmptySlot(key) 且不触发区块选中（stopPropagation）', async () => {
    const onEmptySlot = vi.fn()
    const onSelectSection = vi.fn()
    mockedPreview.mockResolvedValue(preview({ featured: [EMPTY] }))
    render(<HomeCanvas onEmptySlot={onEmptySlot} onSelectSection={onSelectSection} />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())

    const featured = screen.getByTestId('canvas-section-featured')
    fireEvent.click(within(featured).getByTestId('canvas-card-empty-0'))
    expect(onEmptySlot).toHaveBeenCalledWith('featured')
    expect(onSelectSection).not.toHaveBeenCalled()
    expect(screen.queryByTestId('inspector-empty')).not.toBeNull() // Inspector 仍未选中态
  })

  it('未传 onEmptySlot → empty 卡纯展示（无 role=button）', async () => {
    mockedPreview.mockResolvedValue(preview({ featured: [EMPTY] }))
    render(<HomeCanvas />)
    await waitFor(() => expect(screen.queryByTestId('canvas-section-featured')).not.toBeNull())
    const empty = within(screen.getByTestId('canvas-section-featured')).getByTestId('canvas-card-empty-0')
    expect(empty.getAttribute('role')).toBeNull()
  })

  it('reloadToken 变化 → silent 重拉（骨架不闪，画布容器持续在场）', async () => {
    const { rerender } = render(<HomeCanvas reloadToken={0} />)
    await waitFor(() => expect(screen.queryByTestId('home-canvas')).not.toBeNull())
    expect(mockedPreview).toHaveBeenCalledTimes(1)

    rerender(<HomeCanvas reloadToken={1} />)
    await waitFor(() => expect(mockedPreview).toHaveBeenCalledTimes(2))
    expect(screen.queryByTestId('home-canvas')).not.toBeNull() // silent：未回退骨架
  })
})
