/**
 * crawler.types.ts — 爬虫与采集类型
 */

// ── 资源站配置 ────────────────────────────────────────────────

export interface CrawlerSource {
  name: string         // 资源站标识，如 jsm3u8
  base: string         // 接口根地址，如 https://jszyapi.com
  format: 'xml' | 'json'
  enabled: boolean
}

// ── 苹果CMS接口原始数据结构 ───────────────────────────────────

/** 苹果CMS JSON 格式的单个视频对象（字段名与接口一致，不做修改）*/
export interface MacCmsVideo {
  vod_id: number
  vod_name: string
  vod_en: string | null
  vod_pic: string
  type_name: string
  type_id: number
  vod_year: string         // 注意：接口返回字符串
  vod_area: string
  vod_actor: string        // 逗号分隔
  vod_director: string     // 逗号分隔
  vod_writer: string       // 逗号分隔，可能为空
  vod_content: string      // 可能含 HTML 标签
  vod_remarks: string      // 如"完结"、"更新至第12集"
  vod_play_from: string    // 线路标识，多线路用 $$$分隔
  vod_play_url: string     // 播放 URL，多线路用 $$$分隔，集数间用 #分隔
  vod_time: string         // 最后更新时间
}

/** XML 格式解析后的结构（与 JSON 格式相同，解析后统一） */
export type MacCmsVideoXml = MacCmsVideo

/** 接口列表响应 */
export interface MacCmsListResponse {
  code: number
  msg: string
  page: number
  pagecount: number
  limit: number
  total: number
  list: MacCmsVideo[]
}

// ── 解析后的中间格式（映射完成，写库前） ────────────────────

export interface ParsedVideo {
  // 对应 videos 表
  title: string
  titleEn: string | null
  coverUrl: string         // 外链，不下载
  type: import('./video.types').VideoType
  category: string | null
  year: number | null
  country: string | null   // ISO 代码
  cast: string[]
  director: string[]
  writers: string[]
  description: string | null
  status: import('./video.types').VideoStatus
  episodeCount: number

  // 对应 video_sources 表（一个视频可能有多个线路）
  sources: ParsedSource[]

  // 采集元数据（存 crawler_tasks.result）
  sourceVodId: number
  sourceName: string       // 资源站 name
  sourceUpdatedAt: string
}

export interface ParsedSource {
  episodeNumber: number | null
  sourceUrl: string
  sourceName: string       // 如 jsm3u8_线路1
  type: import('./video.types').SourceType
  quality: null            // 采集阶段无法确定画质，设为 null
}

// ── 爬虫任务 ─────────────────────────────────────────────────

export type CrawlerTaskStatus = 'pending' | 'running' | 'paused' | 'done' | 'failed' | 'cancelled' | 'timeout'
export type CrawlerTaskType   = 'full-crawl' | 'incremental-crawl' | 'verify-source' | 'verify-single'

export interface CrawlerTask {
  id: string
  type: CrawlerTaskType
  sourceName: string
  status: CrawlerTaskStatus
  retryCount: number
  result: Record<string, unknown> | null
  scheduledAt: string
  finishedAt: string | null
}

export interface TriggerCrawlInput {
  sourceName?: string      // 不传则对所有 enabled 的资源站执行
  type?: 'full' | 'incremental'  // 默认 incremental
}

// ── 验证结果 ─────────────────────────────────────────────────

export interface VerifyResult {
  sourceId: string
  isActive: boolean
  httpStatus: number | null
  latencyMs: number | null
  checkedAt: string
}
