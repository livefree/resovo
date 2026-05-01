import type { DualSignalState } from '@resovo/admin-ui'
import type { VisibilityStatus, ReviewStatus } from '@resovo/admin-ui'

export interface MockVideo {
  readonly id: string
  readonly title: string
  readonly year: number
  readonly type: string
  readonly episodes: number
  readonly country: string
  readonly score: number
  readonly probe: DualSignalState
  readonly render: DualSignalState
  readonly visibility: VisibilityStatus
  readonly review: ReviewStatus
  readonly sources: number
  readonly lines: number
  readonly badges: readonly string[]
  readonly staffNote?: string
  readonly thumb: number
}

export interface MockRejectedVideo extends MockVideo {
  readonly rejectReason: string
  readonly rejectedBy: string
  readonly rejectedAt: string
}

export interface MockLine {
  readonly id: string
  readonly site: string
  readonly url: string
  readonly enabled: boolean
  readonly probe: DualSignalState
  readonly render: DualSignalState
  readonly latency?: number
}

export const MOCK_VIDEOS: readonly MockVideo[] = [
  { id:'v1', title:'危险关系', year:2024, type:'电视剧', episodes:36, country:'中国', score:8.2, probe:'ok', render:'ok', visibility:'internal', review:'pending_review', sources:5, lines:5, badges:['封面失效'], staffNote:'封面有水印，先 hold', thumb:1 },
  { id:'v2', title:'猎罪图鉴 2', year:2024, type:'电视剧', episodes:24, country:'中国', score:8.8, probe:'ok', render:'partial', visibility:'internal', review:'pending_review', sources:3, lines:3, badges:[], thumb:2 },
  { id:'v3', title:'繁花', year:2023, type:'电视剧', episodes:30, country:'中国', score:9.0, probe:'partial', render:'ok', visibility:'internal', review:'pending_review', sources:7, lines:7, badges:['豆瓣未匹配'], thumb:3 },
  { id:'v4', title:'黑神话：悟空', year:2024, type:'游戏', episodes:1, country:'中国', score:9.2, probe:'ok', render:'ok', visibility:'internal', review:'pending_review', sources:2, lines:2, badges:[], thumb:4 },
  { id:'v5', title:'玫瑰的故事', year:2024, type:'电视剧', episodes:38, country:'中国', score:7.9, probe:'dead', render:'dead', visibility:'internal', review:'pending_review', sources:0, lines:0, badges:['全线路失效'], thumb:5 },
  { id:'v6', title:'白夜破晓', year:2024, type:'电视剧', episodes:32, country:'中国', score:8.4, probe:'ok', render:'ok', visibility:'internal', review:'pending_review', sources:4, lines:4, badges:[], thumb:6 },
  { id:'v7', title:'末路狂花钱', year:2024, type:'电影', episodes:1, country:'中国', score:7.5, probe:'ok', render:'ok', visibility:'internal', review:'pending_review', sources:3, lines:3, badges:[], thumb:7 },
  { id:'v8', title:'哈尔的移动城堡', year:2004, type:'电影', episodes:1, country:'日本', score:9.1, probe:'ok', render:'partial', visibility:'internal', review:'pending_review', sources:6, lines:6, badges:[], thumb:8 },
]

export const MOCK_STAGING_VIDEOS: readonly MockVideo[] = [
  { ...MOCK_VIDEOS[3]!, review:'approved', visibility:'internal' },
  { ...MOCK_VIDEOS[4]!, review:'approved', visibility:'internal' },
  { ...MOCK_VIDEOS[7]!, review:'approved', visibility:'internal' },
]

export const MOCK_REJECTED_VIDEOS: readonly MockRejectedVideo[] = [
  { ...MOCK_VIDEOS[5]!, review:'rejected', visibility:'hidden', rejectReason:'重复上传', rejectedBy:'Mira', rejectedAt:'3 天前' },
  { ...MOCK_VIDEOS[0]!, review:'rejected', visibility:'hidden', rejectReason:'全线路失效无法播放', rejectedBy:'Yan', rejectedAt:'2 小时前' },
]

export const MOCK_LINES: readonly MockLine[] = [
  { id:'l1', site:'v.lzcdn31.com', url:'https://v.lzcdn31.com/api/xxx', enabled:true, probe:'ok', render:'ok', latency:240 },
  { id:'l2', site:'heimuer.tv', url:'https://heimuer.tv/play/xxx', enabled:true, probe:'ok', render:'partial', latency:380 },
  { id:'l3', site:'ckzy.me', url:'https://ckzy.me/xxx', enabled:false, probe:'dead', render:'dead' },
  { id:'l4', site:'ffzy.tv', url:'https://ffzy.tv/api/xxx', enabled:true, probe:'partial', render:'ok', latency:510 },
  { id:'l5', site:'ikun.tv', url:'https://ikun.tv/xxx', enabled:true, probe:'ok', render:'ok', latency:190 },
]

export const MOCK_SIMILAR_VIDEOS = [
  { title:'危险关系1988', year:1988, country:'US', sim:97, sources:11, thumb:2, why:'标题、演员高度重合' },
  { title:'危险关系2024', year:2024, country:'FR', sim:84, sources:4, thumb:1, why:'标题相同 · 演员不同' },
  { title:'危险关系1990', year:1990, country:'FR', sim:72, sources:2, thumb:5, why:'翻拍系列' },
]

export const MOCK_HISTORY_ITEMS = [
  { t:'刚才', who:'系统', e:'采集入库', detail:'来自 v.lzcdn31.com / iCMS v10', c:'info' },
  { t:'5m 前', who:'系统', e:'自动合并', detail:'merged → catalog#12 (危险关系)', c:'info' },
  { t:'5m 前', who:'系统', e:'豆瓣匹配', detail:'置信度 92% · ID 26277285', c:'ok' },
  { t:'3h 前', who:'Mira', e:'标记为 staffNote', detail:'"封面有水印，先 hold"', c:'warn' },
  { t:'昨天', who:'系统', e:'封面失效', detail:'P0 头像 404 → 待修复', c:'danger' },
  { t:'3 天前', who:'Yan', e:'批量重验源', detail:'7 条线路 / 3 通过 / 4 失败', c:'info' },
] as const
