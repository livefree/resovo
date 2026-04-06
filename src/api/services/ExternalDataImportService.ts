/**
 * ExternalDataImportService.ts — 外部原始数据文件导入与 media_catalog 构建
 * 唯一职责：将外部 CSV/JSONLINES 文件流式导入暂存表，再批量构建 media_catalog 条目
 */

import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import type { Pool } from 'pg'
import { MediaCatalogService } from './MediaCatalogService'
import type { CatalogInsertData } from '@/api/db/queries/mediaCatalog'
import * as rawQueries from '@/api/db/queries/externalRaw'
import type {
  DoubanRawRow,
  TmdbRawRow,
  BangumiRawRow,
} from '@/api/db/queries/externalRaw'

// ── 类型 ──────────────────────────────────────────────────────────

export type ProgressCallback = (processed: number, total?: number) => void

// ── 常量 ──────────────────────────────────────────────────────────

const INSERT_BATCH = 500
const BUILD_PAGE = 200

// ── Service ──────────────────────────────────────────────────────

export class ExternalDataImportService {
  private catalogService: MediaCatalogService

  constructor(private db: Pool) {
    this.catalogService = new MediaCatalogService(db)
  }

  // ── Batch 管理 ───────────────────────────────────────────────────

  async createBatch(
    source: 'douban' | 'tmdb' | 'bangumi' | 'movielens',
    fileName: string,
    fileSizeBytes?: number
  ): Promise<string> {
    return rawQueries.createImportBatch(this.db, source, fileName, fileSizeBytes)
  }

  // ── 文件导入：原始数据 → 暂存表 ──────────────────────────────────

  /** 流式读取豆瓣 movies.csv → external_douban_movies_raw */
  async importDouban(
    batchId: string,
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    const headers = [
      'MOVIE_ID', 'NAME', 'ALIAS', 'ACTORS', 'COVER', 'DIRECTORS',
      'DOUBAN_SCORE', 'DOUBAN_VOTES', 'GENRES', 'IMDB_ID', 'LANGUAGES', 'MINS',
      'OFFICIAL_SITE', 'REGIONS', 'RELEASE_DATE', 'SLUG', 'STORYLINE', 'TAGS', 'YEAR',
    ]
    let buffer: rawQueries.DoubanRawInsert[] = []
    let total = 0
    let firstLine = true

    for await (const line of streamLines(filePath)) {
      const trimmed = line.replace(/^\uFEFF/, '').trim()
      if (!trimmed) continue
      if (firstLine) { firstLine = false; continue } // skip header
      const cols = parseCsvLine(trimmed)
      const get = (name: string) => cols[headers.indexOf(name)]?.trim() || null
      const numOrNull = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null)

      buffer.push({
        movieId: get('MOVIE_ID'),
        name: get('NAME'),
        alias: get('ALIAS'),
        actors: get('ACTORS'),
        cover: get('COVER'),
        directors: get('DIRECTORS'),
        doubanScore: numOrNull(get('DOUBAN_SCORE')),
        doubanVotes: numOrNull(get('DOUBAN_VOTES')),
        genres: get('GENRES'),
        imdbId: get('IMDB_ID'),
        languages: get('LANGUAGES'),
        mins: numOrNull(get('MINS')),
        regions: get('REGIONS'),
        releaseDate: get('RELEASE_DATE'),
        slug: get('SLUG'),
        storyline: get('STORYLINE'),
        tags: get('TAGS'),
        year: numOrNull(get('YEAR')),
      })
      total++

      if (buffer.length >= INSERT_BATCH) {
        await rawQueries.batchInsertDoubanRaw(this.db, batchId, buffer)
        buffer = []
        onProgress?.(total)
      }
    }
    if (buffer.length > 0) await rawQueries.batchInsertDoubanRaw(this.db, batchId, buffer)
    await rawQueries.finishImportBatch(this.db, batchId, total, 'done')
    onProgress?.(total)
  }

  /** 流式读取 TMDB CSV → external_tmdb_movies_raw */
  async importTmdb(
    batchId: string,
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    let colMap: Record<string, number> = {}
    let buffer: rawQueries.TmdbRawInsert[] = []
    let total = 0
    let firstLine = true

    for await (const line of streamLines(filePath)) {
      const trimmed = line.replace(/^\uFEFF/, '').trim()
      if (!trimmed) continue
      const cols = parseCsvLine(trimmed)

      if (firstLine) {
        firstLine = false
        colMap = Object.fromEntries(cols.map((h, i) => [h.trim(), i]))
        continue
      }

      const get = (name: string) => cols[colMap[name] ?? -1]?.trim() || null
      const intOrNull = (v: string | null) => (v && /^\d+$/.test(v) ? Number.parseInt(v, 10) : null)
      const floatOrNull = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null)

      buffer.push({
        tmdbId: intOrNull(get('id')),
        title: get('title'),
        originalTitle: get('original_title'),
        imdbId: get('imdb_id'),
        releaseDate: get('release_date'),
        runtime: intOrNull(get('runtime')),
        adult: get('adult')?.toLowerCase() === 'true',
        posterPath: get('poster_path'),
        overview: get('overview'),
        genres: get('genres'),
        productionCountries: get('production_countries'),
        spokenLanguages: get('spoken_languages'),
        voteAverage: floatOrNull(get('vote_average')),
        voteCount: intOrNull(get('vote_count')),
      })
      total++

      if (buffer.length >= INSERT_BATCH) {
        await rawQueries.batchInsertTmdbRaw(this.db, batchId, buffer)
        buffer = []
        onProgress?.(total)
      }
    }
    if (buffer.length > 0) await rawQueries.batchInsertTmdbRaw(this.db, batchId, buffer)
    await rawQueries.finishImportBatch(this.db, batchId, total, 'done')
    onProgress?.(total)
  }

  /** 流式读取 Bangumi subject.jsonlines → external_bangumi_subjects_raw（仅 type 2/6）*/
  async importBangumi(
    batchId: string,
    filePath: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    let buffer: rawQueries.BangumiRawInsert[] = []
    let total = 0

    for await (const line of streamLines(filePath)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let parsed: Record<string, unknown>
      try { parsed = JSON.parse(trimmed) } catch { continue }

      const bgmType = Number(parsed.type)
      if (bgmType !== 2 && bgmType !== 6) continue

      buffer.push({
        bangumiId: Number(parsed.id),
        bgmType,
        name: typeof parsed.name === 'string' ? parsed.name : null,
        nameCn: typeof parsed.name_cn === 'string' ? parsed.name_cn || null : null,
        date: typeof parsed.date === 'string' ? parsed.date || null : null,
        platform: typeof parsed.platform === 'number' ? parsed.platform : null,
        summary: typeof parsed.summary === 'string' ? parsed.summary || null : null,
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      })
      total++

      if (buffer.length >= INSERT_BATCH) {
        await rawQueries.batchInsertBangumiRaw(this.db, batchId, buffer)
        buffer = []
        onProgress?.(total)
      }
    }
    if (buffer.length > 0) await rawQueries.batchInsertBangumiRaw(this.db, batchId, buffer)
    await rawQueries.finishImportBatch(this.db, batchId, total, 'done')
    onProgress?.(total)
  }

  /** 流式读取 MovieLens links.csv → external_imdb_tmdb_links */
  async importMovieLensLinks(filePath: string, onProgress?: ProgressCallback): Promise<void> {
    let buffer: rawQueries.MovieLensLinkInsert[] = []
    let total = 0
    let firstLine = true

    for await (const line of streamLines(filePath)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (firstLine) { firstLine = false; continue }

      const parts = trimmed.split(',')
      if (parts.length < 3) continue
      const movielensId = Number.parseInt(parts[0], 10)
      const rawImdb = parts[1].trim()
      const tmdbId = Number.parseInt(parts[2].trim(), 10)
      if (!movielensId || !rawImdb || !tmdbId) continue

      // MovieLens stores IMDB ID without 'tt' prefix, pad to 7 digits
      const imdbId = 'tt' + rawImdb.padStart(7, '0')
      buffer.push({ movielensId, imdbId, tmdbId })
      total++

      if (buffer.length >= INSERT_BATCH) {
        await rawQueries.batchInsertMovieLensLinks(this.db, buffer)
        buffer = []
        onProgress?.(total)
      }
    }
    if (buffer.length > 0) await rawQueries.batchInsertMovieLensLinks(this.db, buffer)
    onProgress?.(total)
  }

  // ── Catalog 构建：暂存表 → media_catalog ──────────────────────────

  /** 将豆瓣暂存行批量构建为 media_catalog 条目（含 IMDB→TMDB ID 桥接） */
  async buildCatalogFromDouban(
    batchId?: string | null,
    onProgress?: ProgressCallback
  ): Promise<number> {
    let processed = 0
    let afterId = 0

    for (;;) {
      const rows = await rawQueries.fetchUnprocessedDoubanRows(
        this.db, batchId ?? null, afterId, BUILD_PAGE
      )
      if (rows.length === 0) break

      for (const row of rows) {
        const data = await this.buildDoubanCatalogData(row)
        const catalog = await this.catalogService.findOrCreate({
          ...data,
          metadataSource: 'douban',
        })
        await rawQueries.updateRawRowCatalogId(
          this.db, 'external_douban_movies_raw', row.id, catalog.id
        )
        processed++
      }
      afterId = rows[rows.length - 1].id
      onProgress?.(processed)
    }
    return processed
  }

  /** 将 TMDB 暂存行批量构建为 media_catalog 条目 */
  async buildCatalogFromTmdb(
    batchId?: string | null,
    onProgress?: ProgressCallback
  ): Promise<number> {
    let processed = 0
    let afterId = 0

    for (;;) {
      const rows = await rawQueries.fetchUnprocessedTmdbRows(
        this.db, batchId ?? null, afterId, BUILD_PAGE
      )
      if (rows.length === 0) break

      for (const row of rows) {
        const data = this.buildTmdbCatalogData(row)
        const catalog = await this.catalogService.findOrCreate({
          ...data,
          metadataSource: 'tmdb',
        })
        await rawQueries.updateRawRowCatalogId(
          this.db, 'external_tmdb_movies_raw', row.id, catalog.id
        )
        processed++
      }
      afterId = rows[rows.length - 1].id
      onProgress?.(processed)
    }
    return processed
  }

  /** 将 Bangumi 暂存行批量构建为 media_catalog 条目 */
  async buildCatalogFromBangumi(
    batchId?: string | null,
    onProgress?: ProgressCallback
  ): Promise<number> {
    let processed = 0
    let afterId = 0

    for (;;) {
      const rows = await rawQueries.fetchUnprocessedBangumiRows(
        this.db, batchId ?? null, afterId, BUILD_PAGE
      )
      if (rows.length === 0) break

      for (const row of rows) {
        const data = this.buildBangumiCatalogData(row)
        const catalog = await this.catalogService.findOrCreate({
          ...data,
          metadataSource: 'bangumi',
        })
        await rawQueries.updateRawRowCatalogId(
          this.db, 'external_bangumi_subjects_raw', row.id, catalog.id
        )
        processed++
      }
      afterId = rows[rows.length - 1].id
      onProgress?.(processed)
    }
    return processed
  }

  // ── 私有：CatalogInsertData 构建 ─────────────────────────────────

  private async buildDoubanCatalogData(row: DoubanRawRow): Promise<CatalogInsertData> {
    const title = row.name ?? ''
    const genreList = splitBy(row.genres, '/')
    const directorList = splitBy(row.directors, '/')
    const castList = splitBy(row.actors, '/')
    const countryList = splitBy(row.regions, '/')

    // ID 桥接：若有 IMDB ID，通过 MovieLens 桥接查找 TMDB ID
    const imdbId = row.imdbId && row.imdbId.startsWith('tt') ? row.imdbId : null
    const tmdbId = imdbId ? await rawQueries.lookupTmdbByImdbId(this.db, imdbId) : null

    return {
      title,
      titleNormalized: normalizeTitle(title),
      type: 'movie',
      year: row.year,
      genre: genreList[0] ?? null,
      genresRaw: genreList,
      director: directorList,
      cast: castList,
      country: countryList[0] ?? null,
      runtimeMinutes: row.mins && row.mins > 0 ? row.mins : null,
      description: row.storyline,
      coverUrl: row.cover || null,
      rating: row.doubanScore && row.doubanScore > 0 ? row.doubanScore : null,
      doubanId: row.movieId,
      imdbId,
      tmdbId,
    }
  }

  private buildTmdbCatalogData(row: TmdbRawRow): CatalogInsertData {
    const title = row.title ?? row.originalTitle ?? ''
    const yearFromDate = row.releaseDate?.match(/^(\d{4})/)?.[1]
    const genreList = row.genres ? row.genres.split(',').map(g => g.trim()).filter(Boolean) : []
    const countryList = row.productionCountries
      ? row.productionCountries.split(',').map(c => c.trim()).filter(Boolean)
      : []

    return {
      title,
      titleEn: row.title,
      titleOriginal: row.originalTitle,
      titleNormalized: normalizeTitle(title),
      type: 'movie',
      year: yearFromDate ? Number.parseInt(yearFromDate, 10) : null,
      genre: genreList[0] ?? null,
      genresRaw: genreList,
      country: countryList[0] ?? null,
      runtimeMinutes: row.runtime,
      description: row.overview,
      coverUrl: row.posterPath
        ? `https://image.tmdb.org/t/p/w500${row.posterPath}`
        : null,
      rating: row.voteAverage && row.voteAverage > 0 ? row.voteAverage : null,
      ratingVotes: row.voteCount,
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
    }
  }

  private buildBangumiCatalogData(row: BangumiRawRow): CatalogInsertData {
    // bgmType=2: anime, bgmType=6: live_action (default to movie)
    const type = row.bgmType === 2 ? 'anime' : 'movie'
    const title = row.nameCn || row.name || ''
    const yearFromDate = row.date?.match(/^(\d{4})/)?.[1]

    return {
      title,
      titleOriginal: row.name,
      titleNormalized: normalizeTitle(title),
      type,
      year: yearFromDate ? Number.parseInt(yearFromDate, 10) : null,
      releaseDate: row.date,
      description: row.summary,
      bangumiSubjectId: row.bangumiId,
    }
  }
}

// ── 工具函数 ──────────────────────────────────────────────────────

async function* streamLines(filePath: string): AsyncGenerator<string> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    yield line
  }
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let inQuotes = false
  let field = ''

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(field)
      field = ''
    } else {
      field += ch
    }
  }
  result.push(field)
  return result
}

function normalizeTitle(input: string): string {
  return input
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '')
}

function splitBy(val: string | null, sep: string): string[] {
  if (!val) return []
  return val.split(sep).map(s => s.trim()).filter(Boolean)
}
