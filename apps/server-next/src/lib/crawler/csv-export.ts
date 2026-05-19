/**
 * crawler/csv-export.ts — Crawler 站点列表 CSV 导出（CHG-SN-7-MISC-CRAWLER-CSV-EXPORT）
 *
 * 抽离自 CrawlerClient.tsx handleExport / 单一职责 / 保持 CrawlerClient < 500 行
 */

import { downloadCsv, type CsvColumn } from '@/lib/csv-export'
import type { CrawlerSite } from '@/lib/crawler/api'

const CRAWLER_SITE_CSV_COLUMNS: readonly CsvColumn<CrawlerSite>[] = [
  { header: 'key',                   accessor: (s) => s.key },
  { header: 'name',                  accessor: (s) => s.name },
  { header: 'display_name',          accessor: (s) => s.displayName ?? '' },
  { header: 'api_url',               accessor: (s) => s.apiUrl },
  { header: 'source_type',           accessor: (s) => s.sourceType },
  { header: 'format',                accessor: (s) => s.format },
  { header: 'weight',                accessor: (s) => s.weight },
  { header: 'disabled',              accessor: (s) => s.disabled },
  { header: 'is_adult',              accessor: (s) => s.isAdult },
  { header: 'from_config',           accessor: (s) => s.fromConfig },
  { header: 'last_crawl_status',     accessor: (s) => s.lastCrawlStatus ?? '' },
  { header: 'last_crawled_at',       accessor: (s) => s.lastCrawledAt ?? '' },
  { header: 'created_at',            accessor: (s) => s.createdAt },
]

/**
 * 导出站点列表为 CSV。
 * 返回 filename（不含路径 / 仅 basename）/ 用于消费方 toast 反馈。
 */
export function exportCrawlerSitesCsv(sites: readonly CrawlerSite[]): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `crawler-sites-${ts}.csv`
  downloadCsv(sites, CRAWLER_SITE_CSV_COLUMNS, filename)
  return filename
}
