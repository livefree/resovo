import type { ColumnDescriptor } from '@resovo/admin-ui'

// CHG-VSR-4-A（设计 §2.2/§2.3/§2.6②）：列重构后描述符（id/header/defaultVisible/enableSorting
// 与 buildVideoColumns 逐列对齐 — 驱动 useTableQuery 列可见性持久化 + 排序指示符命名空间）。
// 复合列（release/episodes/meta/status）enableSorting:true，排序映射到后端字段由
// VideoFilterFields.buildVideoFilter COMPOSITE_SORT_MAP 承担。
export const VIDEO_COLUMN_DESCRIPTORS: readonly ColumnDescriptor[] = [
  // ── 默认可见列（§2.2）──
  { id: 'cover',          header: '封面',          defaultVisible: true  },
  { id: 'title',          header: '视频',          defaultVisible: true,  enableSorting: true },
  { id: 'type',           header: '类型',          defaultVisible: true,  enableSorting: true },
  { id: 'release',        header: '发行信息',       defaultVisible: true,  enableSorting: true },
  { id: 'episodes',       header: '集数',          defaultVisible: true,  enableSorting: true },
  { id: 'meta',           header: '元数据',         defaultVisible: true,  enableSorting: true },
  { id: 'status',         header: '内容状态',       defaultVisible: true,  enableSorting: true },
  { id: 'updated_at',     header: '更新时间',       defaultVisible: true,  enableSorting: true },
  { id: 'actions',        header: '操作',          defaultVisible: true  },
  // ── 可选列（§2.3 职责回归降级，默认隐藏）──
  { id: 'source_health',  header: '源活跃',         defaultVisible: false, enableSorting: true },
  // SRCHEALTH-P1-1-B：probe 接真数据后恢复排序（与 buildVideoColumns enableSorting 逐列对齐）
  { id: 'probe',          header: '探测/播放',      defaultVisible: false, enableSorting: true },
  { id: 'image_health',   header: '图片',          defaultVisible: false },
  // ── 默认隐藏原子可筛选列（§2.6②；filter 挂载留 CHG-VSR-4-B）──
  { id: 'year',           header: '年份',          defaultVisible: false },
  { id: 'country',        header: '出品地区',       defaultVisible: false },
  { id: 'catalog_status', header: '连载状态',       defaultVisible: false },
  { id: 'visibility',     header: '可见性',         defaultVisible: false },
  { id: 'review_status',  header: '审核',          defaultVisible: false },
  { id: 'is_published',   header: '发布',          defaultVisible: false },
  { id: 'douban_status',  header: '豆瓣状态',       defaultVisible: false },
  { id: 'bangumi_status', header: 'Bangumi',      defaultVisible: false },
  // META-36-A：元数据完整度解禁排序（→ metadata_score 独立字段，与 meta 复合列运营优先级排序分离）
  { id: 'meta_score',     header: '元数据完整度',    defaultVisible: false, enableSorting: true },
  // META-36-A：元数据状态多维过滤列（filter-only，默认隐藏；ADR-201 §视频库 过滤）
  { id: 'metadata_overall',     header: '元数据状态', defaultVisible: false },
  { id: 'metadata_provider',    header: '元数据来源', defaultVisible: false },
  { id: 'metadata_issue_level', header: '元数据问题', defaultVisible: false },
  { id: 'metadata_updated',     header: '元数据更新', defaultVisible: false },
  { id: 'created_at',     header: '创建时间',       defaultVisible: false, enableSorting: true },
]

export const VIDEO_SORT_FIELDS = ['title', 'type', 'year', 'created_at', 'updated_at'] as const
export type VideoSortField = (typeof VIDEO_SORT_FIELDS)[number]
