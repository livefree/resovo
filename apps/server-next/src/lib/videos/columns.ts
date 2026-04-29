import type { ColumnDescriptor } from '@resovo/admin-ui'

export const VIDEO_COLUMN_DESCRIPTORS: readonly ColumnDescriptor[] = [
  { id: 'cover',         header: '封面',         defaultVisible: true  },
  { id: 'title',         header: '标题',         defaultVisible: true,  enableSorting: true },
  { id: 'type',          header: '类型',         defaultVisible: true,  enableSorting: true },
  { id: 'year',          header: '年份',         defaultVisible: false, enableSorting: true },
  { id: 'source_health', header: '源健康度',      defaultVisible: true  },
  { id: 'image_health',  header: '图片健康',      defaultVisible: true  },
  { id: 'visibility',    header: '可见性',        defaultVisible: true  },
  { id: 'review_status', header: '审核状态',      defaultVisible: true  },
  { id: 'douban_status', header: '豆瓣状态',      defaultVisible: false },
  { id: 'meta_score',    header: '元数据完整度',   defaultVisible: false },
  { id: 'created_at',    header: '创建时间',      defaultVisible: false, enableSorting: true },
  { id: 'updated_at',    header: '更新时间',      defaultVisible: false, enableSorting: true },
  { id: 'actions',       header: '操作',         defaultVisible: true  },
]

export const VIDEO_SORT_FIELDS = ['title', 'type', 'year', 'created_at', 'updated_at'] as const
export type VideoSortField = (typeof VIDEO_SORT_FIELDS)[number]
