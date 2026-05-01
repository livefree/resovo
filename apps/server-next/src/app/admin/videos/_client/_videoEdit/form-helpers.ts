import type { VideoAdminDetail, VideoMetaPatch } from '@/lib/videos'
import type { VideoGenre, VideoStatus } from '@resovo/types'
import type { FormState } from './types'

export function videoToForm(v: VideoAdminDetail): FormState {
  return {
    title: v.title,
    titleEn: v.title_en ?? '',
    type: v.type,
    year: v.year != null ? String(v.year) : '',
    country: v.country ?? '',
    description: v.description ?? '',
    genres: v.genres.join(', '),
    episodeCount: v.episode_count ? String(v.episode_count) : '',
    status: v.status ?? '',
    rating: v.rating != null ? String(v.rating) : '',
    director: v.director.join(', '),
    cast: v.cast.join(', '),
    writers: v.writers.join(', '),
    doubanId: v.douban_id ?? '',
  }
}

export function splitComma(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean)
}

export function formToPatch(orig: FormState, curr: FormState): VideoMetaPatch {
  const p: VideoMetaPatch = {}
  if (curr.title !== orig.title) p.title = curr.title
  if (curr.titleEn !== orig.titleEn) p.titleEn = curr.titleEn || null
  if (curr.type !== orig.type) p.type = curr.type
  if (curr.year !== orig.year) p.year = curr.year ? parseInt(curr.year, 10) : null
  if (curr.country !== orig.country) p.country = curr.country || null
  if (curr.description !== orig.description) p.description = curr.description || null
  if (curr.genres !== orig.genres) p.genres = splitComma(curr.genres) as VideoGenre[]
  if (curr.episodeCount !== orig.episodeCount) p.episodeCount = curr.episodeCount ? parseInt(curr.episodeCount, 10) : undefined
  if (curr.status !== orig.status) p.status = (curr.status as VideoStatus) || undefined
  if (curr.rating !== orig.rating) p.rating = curr.rating ? parseFloat(curr.rating) : null
  if (curr.director !== orig.director) p.director = splitComma(curr.director)
  if (curr.cast !== orig.cast) p.cast = splitComma(curr.cast)
  if (curr.writers !== orig.writers) p.writers = splitComma(curr.writers)
  if (curr.doubanId !== orig.doubanId) p.doubanId = curr.doubanId || null
  return p
}
