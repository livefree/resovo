export interface ParsedCrawlerSiteInput {
  key: string
  name: string
  apiUrl: string
  detail?: string
  sourceType: 'vod' | 'shortdrama'
  format: 'json' | 'xml'
  weight: number
  isAdult: boolean
}

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase())
  return false
}

function sanitizeKey(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function parseSitesFromJson(payload: unknown): ParsedCrawlerSiteInput[] {
  const candidates: Array<{ keyHint: string; raw: Record<string, unknown> }> = []
  const root = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : null

  const fromMap = (map: unknown) => {
    if (!map || typeof map !== 'object' || Array.isArray(map)) return
    for (const [key, val] of Object.entries(map as Record<string, unknown>)) {
      if (!val || typeof val !== 'object' || Array.isArray(val)) continue
      candidates.push({ keyHint: key, raw: val as Record<string, unknown> })
    }
  }

  if (root) {
    fromMap(root.crawler_sites)
    fromMap(root.api_site)

    if (candidates.length === 0 && Array.isArray(root.sites)) {
      for (const item of root.sites) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const row = item as Record<string, unknown>
        const keyHint = typeof row.key === 'string' ? row.key : ''
        candidates.push({ keyHint, raw: row })
      }
    }

    if (candidates.length === 0 && Array.isArray(payload)) {
      for (const item of payload) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const row = item as Record<string, unknown>
        const keyHint = typeof row.key === 'string' ? row.key : ''
        candidates.push({ keyHint, raw: row })
      }
    }

    if (candidates.length === 0) {
      fromMap(root)
    }
  }

  const list: ParsedCrawlerSiteInput[] = []
  const seenApi = new Set<string>()

  for (const item of candidates) {
    const apiRaw = item.raw.api ?? item.raw.api_url ?? item.raw.url ?? item.raw.apiUrl
    const nameRaw = item.raw.name ?? item.raw.title
    if (typeof apiRaw !== 'string' || typeof nameRaw !== 'string') continue
    const apiUrl = apiRaw.trim()
    const name = nameRaw.trim()
    if (!apiUrl || !name || seenApi.has(apiUrl)) continue

    const detail = typeof item.raw.detail === 'string' ? item.raw.detail : undefined
    const typeRaw = item.raw.type ?? item.raw.source_type ?? item.raw.sourceType
    const formatRaw = item.raw.format
    const weightRaw = item.raw.weight
    const isAdultRaw = item.raw.is_adult ?? item.raw.isAdult
    const keyRaw = (typeof item.raw.key === 'string' ? item.raw.key : item.keyHint).trim()
    const key = sanitizeKey(keyRaw || apiUrl) || `site_${Date.now()}`

    list.push({
      key,
      name,
      apiUrl,
      detail,
      sourceType: typeRaw === 'shortdrama' ? 'shortdrama' : 'vod',
      format: formatRaw === 'xml' ? 'xml' : 'json',
      weight: typeof weightRaw === 'number' && Number.isFinite(weightRaw) ? Math.min(100, Math.max(0, weightRaw)) : 50,
      isAdult: parseBool(isAdultRaw),
    })
    seenApi.add(apiUrl)
  }

  return list
}
