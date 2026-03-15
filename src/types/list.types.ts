/**
 * list.types.ts — 播放列表与片单类型
 */

import type { VideoCard } from './video.types'
import type { Pick } from 'utility-types'  // 使用标准 TypeScript Pick，不需要额外依赖

// ── 枚举 ─────────────────────────────────────────────────────────

export type ListType       = 'playlist' | 'collection'
export type ListVisibility = 'public' | 'private' | 'unlisted'

// ── 列表实体 ─────────────────────────────────────────────────────

export interface VideoList {
  id: string
  shortId: string
  ownerId: string
  owner: {
    id: string
    username: string
    avatarUrl: string | null
  }
  type: ListType
  title: string
  description: string | null
  coverUrl: string | null    // 片单手动上传；播放列表取第一部影片封面
  visibility: ListVisibility
  itemCount: number          // 冗余计数
  likeCount: number          // 冗余计数
  viewCount: number          // 冗余计数
  createdAt: string
  updatedAt: string
}

// ── 列表卡片（列表展示用）────────────────────────────────────────

export type VideoListCard = Pick<
  VideoList,
  'id' | 'shortId' | 'type' | 'title' | 'description' |
  'coverUrl' | 'visibility' | 'itemCount' | 'likeCount' | 'owner'
>

// ── 列表条目 ─────────────────────────────────────────────────────

export interface ListItem {
  id: string
  listId: string
  video: VideoCard
  position: number
  addedAt: string
}

// ── 请求参数 ─────────────────────────────────────────────────────

export interface CreateListInput {
  type: ListType
  title: string
  description?: string
  visibility?: ListVisibility  // 默认 public
}

export interface UpdateListInput {
  title?: string
  description?: string
  visibility?: ListVisibility
  coverUrl?: string
}

export interface AddItemInput {
  videoId: string
  position?: number           // 不传则追加到末尾
}

export interface ReorderItemsInput {
  order: string[]             // 完整排序后的 videoId 数组
}

export interface ListLikeResponse {
  liked: boolean
  likeCount: number
}

// ── 列表查询参数 ─────────────────────────────────────────────────

export interface ListQueryParams {
  type?: ListType
  sort?: 'hot' | 'latest' | 'likes'
  page?: number
  limit?: number
}
