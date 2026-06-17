import { VideoPicker } from '@resovo/admin-ui'
import type { VideoPickerFetcher, PickerVideoItem } from '@resovo/admin-ui'

// mock 视频列表（真实视频库内容）
const MOCK_ITEMS: readonly PickerVideoItem[] = [
  {
    id: 'vid-001',
    shortId: 'V001',
    title: '流浪地球2',
    titleEn: 'The Wandering Earth 2',
    type: 'movie',
    year: 2023,
    coverUrl: null,
    isPublished: true,
  },
  {
    id: 'vid-002',
    shortId: 'V002',
    title: '繁花',
    titleEn: 'Blossoms Shanghai',
    type: 'tv',
    year: 2023,
    coverUrl: null,
    isPublished: true,
  },
  {
    id: 'vid-003',
    shortId: 'V003',
    title: '长安三万里',
    titleEn: 'Chang An',
    type: 'movie',
    year: 2023,
    coverUrl: null,
    isPublished: false,
  },
  {
    id: 'vid-004',
    shortId: 'V004',
    title: '三体',
    titleEn: 'The Three-Body Problem',
    type: 'tv',
    year: 2023,
    coverUrl: null,
    isPublished: true,
  },
]

// mock fetcher：立即返回过滤结果
const mockFetcher: VideoPickerFetcher = async ({ q, limit }) => {
  const filtered = q
    ? MOCK_ITEMS.filter(
        (v) =>
          v.title.includes(q) ||
          (v.titleEn?.toLowerCase().includes(q.toLowerCase()) ?? false),
      )
    : MOCK_ITEMS
  return {
    items: filtered.slice(0, limit),
    total: filtered.length,
  }
}

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16, maxWidth: 480 }

// 单选，空值（触发器态）
export const SingleEmpty = () => (
  <div style={col}>
    <VideoPicker
      label="关联视频"
      value={null}
      onChange={() => {}}
      fetcher={mockFetcher}
      placeholder="选择视频…"
    />
  </div>
)

// 单选，已选中一项
export const SingleSelected = () => (
  <div style={col}>
    <VideoPicker
      label="关联视频"
      value={MOCK_ITEMS[0] as PickerVideoItem}
      onChange={() => {}}
      fetcher={mockFetcher}
    />
  </div>
)

// 多选，已选两项
export const MultipleSelected = () => (
  <div style={col}>
    <VideoPicker
      label="批量关联视频"
      multiple
      value={[MOCK_ITEMS[1] as PickerVideoItem, MOCK_ITEMS[3] as PickerVideoItem]}
      onChange={() => {}}
      fetcher={mockFetcher}
      max={5}
    />
  </div>
)

// 错误态 + disabled
export const States = () => (
  <div style={col}>
    <VideoPicker
      label="关联视频（必填）"
      value={null}
      onChange={() => {}}
      fetcher={mockFetcher}
      required
      error="请选择关联视频"
    />
    <VideoPicker
      label="关联视频（禁用）"
      value={MOCK_ITEMS[2] as PickerVideoItem}
      onChange={() => {}}
      fetcher={mockFetcher}
      disabled
    />
  </div>
)
