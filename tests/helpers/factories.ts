/**
 * tests/helpers/factories.ts — 测试数据工厂
 * 生成符合类型约束的假数据，用于单元测试和集成测试
 */

import { randomUUID } from 'crypto'
import type { User, Video, VideoSource, VideoList } from '@/types'

let counter = 0
const uid = () => ++counter

// ── 用户工厂 ─────────────────────────────────────────────────────

export function makeUser(overrides?: Partial<User>): User {
  const n = uid()
  return {
    id:         randomUUID(),
    username:   `testuser_${n}`,
    email:      `test_${n}@resovo.test`,
    avatarUrl:  null,
    role:       'user',
    locale:     'zh-CN',
    createdAt:  new Date().toISOString(),
    ...overrides,
  }
}

export const makeAdmin = (o?: Partial<User>) => makeUser({ role: 'admin', ...o })
export const makeModerator = (o?: Partial<User>) => makeUser({ role: 'moderator', ...o })

// ── 视频工厂 ─────────────────────────────────────────────────────

export function makeVideo(overrides?: Partial<Video>): Video {
  const n = uid()
  return {
    id:           randomUUID(),
    shortId:      `test${n}`.padEnd(8, '0').slice(0, 8),
    slug:         `test-video-${n}`,
    title:        `测试视频 ${n}`,
    titleEn:      `Test Video ${n}`,
    description:  null,
    coverUrl:     null,
    type:         'movie',
    category:     'action',
    rating:       8.0,
    year:         2024,
    country:      'JP',
    episodeCount: 1,
    status:       'completed',
    director:     ['测试导演'],
    cast:         ['测试演员'],
    writers:      [],
    sourceCount:  1,
    subtitleLangs: ['zh-CN'],
    createdAt:    new Date().toISOString(),
    ...overrides,
  }
}

export const makeSeries = (o?: Partial<Video>) =>
  makeVideo({ type: 'series', episodeCount: 12, status: 'ongoing', ...o })

export const makeAnime = (o?: Partial<Video>) =>
  makeVideo({ type: 'anime', ...o })

// ── 播放源工厂 ───────────────────────────────────────────────────

export function makeSource(videoId: string, overrides?: Partial<VideoSource>): VideoSource {
  const n = uid()
  return {
    id:            randomUUID(),
    videoId,
    episodeNumber: null,
    sourceUrl:     `https://test-cdn.example.com/video_${n}.m3u8`,
    sourceName:    `test_线路${n}`,
    quality:       '1080P',
    type:          'hls',
    isActive:      true,
    lastChecked:   new Date().toISOString(),
    ...overrides,
  }
}

// ── 列表工厂 ─────────────────────────────────────────────────────

export function makeList(ownerId: string, overrides?: Partial<VideoList>): VideoList {
  const n = uid()
  return {
    id:          randomUUID(),
    shortId:     `lst${n}0`.slice(0, 8),
    ownerId,
    owner:       { id: ownerId, username: `testuser_${n}`, avatarUrl: null },
    type:        'playlist',
    title:       `test_列表 ${n}`,
    description: null,
    coverUrl:    null,
    visibility:  'public',
    itemCount:   0,
    likeCount:   0,
    viewCount:   0,
    createdAt:   new Date().toISOString(),
    updatedAt:   new Date().toISOString(),
    ...overrides,
  }
}
