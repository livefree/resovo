import { AdminSelect } from '@resovo/admin-ui'

const col: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }

const VIDEO_TYPE_OPTIONS = [
  { value: 'movie', label: '电影' },
  { value: 'tv', label: '剧集' },
  { value: 'anime', label: '动漫' },
  { value: 'variety', label: '综艺' },
  { value: 'documentary', label: '纪录片' },
  { value: 'short', label: '短片' },
]

const REGION_OPTIONS = [
  { value: 'CN', label: '中国大陆' },
  { value: 'TW', label: '台湾' },
  { value: 'HK', label: '香港' },
  { value: 'JP', label: '日本' },
  { value: 'KR', label: '韩国' },
  { value: 'US', label: '美国' },
  { value: 'UK', label: '英国' },
]

const STATUS_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'hidden', label: '已隐藏' },
]

const SOURCE_OPTIONS = [
  { value: 'tmdb', label: 'TMDB' },
  { value: 'douban', label: '豆瓣' },
  { value: 'manual', label: '手动录入' },
  { value: 'scraped', label: '爬虫抓取', disabled: true },
]

// canonical 单选：视频类型下拉
export const SingleSelect = () => (
  <div style={col}>
    <div style={{ ...col, gap: 4, maxWidth: 240 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 2 }}>视频类型</label>
      <AdminSelect
        options={VIDEO_TYPE_OPTIONS}
        value="movie"
        onChange={() => {}}
        placeholder="请选择类型"
      />
    </div>
    <div style={{ ...col, gap: 4, maxWidth: 240 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 2 }}>制作地区</label>
      <AdminSelect
        options={REGION_OPTIONS}
        value={null}
        onChange={() => {}}
        placeholder="请选择地区"
      />
    </div>
  </div>
)

// 三尺寸 sm/md/lg
export const Sizes = () => (
  <div style={col}>
    <div style={{ ...col, gap: 8, maxWidth: 260 }}>
      <AdminSelect options={STATUS_OPTIONS} value="pending" onChange={() => {}} size="sm" />
      <AdminSelect options={STATUS_OPTIONS} value="approved" onChange={() => {}} size="md" />
      <AdminSelect options={STATUS_OPTIONS} value="rejected" onChange={() => {}} size="lg" />
    </div>
  </div>
)

// 多选（线路标签）
export const MultiSelect = () => (
  <div style={col}>
    <div style={{ ...col, gap: 4, maxWidth: 320 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 2 }}>元数据来源（多选）</label>
      <AdminSelect
        multiple
        options={SOURCE_OPTIONS}
        value={['tmdb', 'douban']}
        onChange={() => {}}
        placeholder="请选择来源"
      />
    </div>
    <div style={{ ...col, gap: 4, maxWidth: 320 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 2 }}>标签分类（多选，空态）</label>
      <AdminSelect
        multiple
        options={REGION_OPTIONS}
        value={[]}
        onChange={() => {}}
        placeholder="请选择地区（多选）"
      />
    </div>
  </div>
)

// 错误态 + 禁用态
export const States = () => (
  <div style={col}>
    <div style={{ maxWidth: 240 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4, display: 'block' }}>错误态（必填未填）</label>
      <AdminSelect
        options={VIDEO_TYPE_OPTIONS}
        value={null}
        onChange={() => {}}
        placeholder="请选择视频类型"
        error
      />
    </div>
    <div style={{ maxWidth: 240 }}>
      <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--fg-muted)', marginBottom: 4, display: 'block' }}>禁用态</label>
      <AdminSelect
        options={VIDEO_TYPE_OPTIONS}
        value="anime"
        onChange={() => {}}
        disabled
      />
    </div>
  </div>
)
