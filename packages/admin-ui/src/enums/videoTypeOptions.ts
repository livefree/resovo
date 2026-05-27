import { VIDEO_TYPES, type VideoType } from '@resovo/types'
import type { AdminSelectOption } from '../components/admin-select/admin-select'
import type { TFunction } from './index'

/**
 * ⚠️ FALLBACK label 同步责任（CHG-340-A arch-reviewer 黄线 Y-340-A-1）：
 * 修改本表必须同步检查 `apps/web-next/messages/<locale>.json` 的 `videoType.*` 词条；
 * 反向亦同。未来若有跨包文案 SSOT 演化（label 元数据迁回 packages/types），按 ADR-157 G-340-A-1 评估。
 */
const VIDEO_TYPE_FALLBACK_LABEL: Record<VideoType, string> = {
  movie: '电影',
  series: '剧集',
  anime: '动漫',
  variety: '综艺',
  documentary: '纪录片',
  short: '短片',
  sports: '体育',
  music: '音乐',
  news: '新闻',
  kids: '少儿',
  other: '其他',
}

export function getVideoTypeOptions(t?: TFunction): readonly AdminSelectOption<VideoType>[] {
  return VIDEO_TYPES.map((value) => ({
    value,
    label: t ? t(`videoType.${value}`) : VIDEO_TYPE_FALLBACK_LABEL[value],
  }))
}
