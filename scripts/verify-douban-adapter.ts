/**
 * scripts/verify-douban-adapter.ts — 豆瓣 adapter 实测对比工具（dev，未纳入门禁）
 *
 * 覆盖三类 douban-adapter 能力 + 落库状态，便于与豆瓣网页人工对照：
 *   - search   : resolver 搜索候选 + SuggestItem + 详情（mobile-api）+ 对照 URL
 *   - collections : subject_collection 采集服务（ADR-187 全 16 热门合集）+ 注册表 + 对照 URL
 *   - db       : 已落库 douban_collection_items 行数 + sync_state 新鲜度（只读）
 *
 * 用法：
 *   # search（默认）：标题集；可 "标题@年份#已知id"（#id 绕搜索限流强制详情）
 *   node --import tsx scripts/verify-douban-adapter.ts
 *   node --import tsx scripts/verify-douban-adapter.ts search "流浪地球@2019" "繁花@2023"
 *   node --import tsx scripts/verify-douban-adapter.ts "流浪地球@2019#26266893"
 *   # collections：列注册表 + 探测合集适配器输出（缺省抽样 3 合集；可指定 key）
 *   node --import tsx scripts/verify-douban-adapter.ts collections
 *   node --import tsx scripts/verify-douban-adapter.ts collections movie_hot_gaia tv_hot show_hot
 *   # db：读已落库状态（需 --env-file=.env.local）
 *   node --env-file=.env.local --import tsx scripts/verify-douban-adapter.ts db
 *   # 绕搜索限流：浏览器复制 douban Cookie（至少 bid=...）
 *   DOUBAN_COOKIE='bid=xxxx' node --import tsx scripts/verify-douban-adapter.ts
 *   DELAY_MS=3000 ...（调标题间限速，默认 1500ms）
 *
 * 注意：无 cookie 运行 = 生产 doubanAdapter.createBasicRuntime 真实行为；DOUBAN_COOKIE 仅实测绕限流，
 *       生产代码不注入 cookie。subject_collection 端点实测无限流，无需 cookie。
 */

import {
  createHostRuntime,
  createDoubanResolverService,
  createDoubanDetailsService,
  createDoubanSubjectCollectionService,
  type DoubanResolvedCandidate,
} from 'douban-adapter'
import { DOUBAN_COLLECTIONS } from '../apps/api/src/services/douban-collections/registry'

const COOKIE = process.env.DOUBAN_COOKIE ?? ''
const DELAY_MS = Number(process.env.DELAY_MS ?? 1500)
const TIMEOUT_MS = 10_000

// 镜像生产 createBasicRuntime（apps/api/src/lib/doubanAdapter.ts），额外支持 cookie + 超时注入
function fetchWith(input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (COOKIE) headers.set('Cookie', COOKIE)
  return globalThis.fetch(input, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  })
}

const runtime = createHostRuntime({
  fetch: fetchWith,
  getDoubanConfig: async () => ({ cookies: COOKIE || null }),
  fetchWithVerification: fetchWith,
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: (m, meta) => console.warn(`  [warn] ${m}`, meta ?? ''),
    error: (m, meta) => console.error(`  [error] ${m}`, meta ?? ''),
  },
})

const resolver = createDoubanResolverService(runtime)
const details = createDoubanDetailsService(runtime)
const collections = createDoubanSubjectCollectionService(runtime)

function mapSuggest(c: DoubanResolvedCandidate) {
  return { id: c.id, title: c.title, year: c.year ?? '', sub_title: c.originalTitle ?? '' }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

// ═══════════════════════════════════════════════════════════════
// search 模式
// ═══════════════════════════════════════════════════════════════

function parseArg(arg: string): { title: string; year?: number; forceId?: string } {
  // 形如 "标题@年份#id"：#id 强制详情（搜索限流时仍可比对详情字段）
  const [head, forceId] = arg.split('#')
  const [title, y] = head.split('@')
  const year = y ? Number(y) : undefined
  return {
    title: title.trim(),
    year: Number.isFinite(year) ? year : undefined,
    forceId: forceId?.trim() || undefined,
  }
}

async function runSearch(title: string, year?: number, forceId?: string) {
  console.log('\n' + '═'.repeat(72))
  console.log(`▶ 标题: ${title}${year ? ` (${year})` : ''}${forceId ? ` [强制详情 id=${forceId}]` : ''}`)
  console.log('═'.repeat(72))

  const searchUrl = `https://search.douban.com/movie/subject_search?search_text=${encodeURIComponent(title)}&cat=1002`
  console.log(`\n🔗 [对照] 搜索页: ${searchUrl}`)

  // ① resolver 搜索
  let candidates: DoubanResolvedCandidate[] = []
  try {
    const res = await resolver.searchSubjects({ query: title, year })
    candidates = res.candidates
  } catch (e) {
    console.log(`  ❌ searchSubjects 异常: ${(e as Error).message}`)
  }
  console.log(`\n① resolver 候选数: ${candidates.length}`)
  candidates.slice(0, 5).forEach((c, i) =>
    console.log(
      `   ${i + 1}. id=${c.id} | ${c.title}${c.originalTitle ? ` / ${c.originalTitle}` : ''} | ${c.year ?? '?'} | ${c.type} | 评分${c.rating ?? '-'} | score=${c.score}`,
    ),
  )
  if (candidates.length === 0) {
    console.log('   （空——若含 "搜索访问太频繁" 即限流；设 DOUBAN_COOKIE 重试）')
  }

  // ② SuggestItem（生产下游消费形状）
  console.log(`\n② searchDouban → SuggestItem[]（下游 pickBestCandidate 输入）:`)
  candidates.slice(0, 3).forEach((c) => console.log(`   ${JSON.stringify(mapSuggest(c))}`))

  // ③ 详情：优先 forceId（绕搜索限流），否则 top 候选
  const detailId = forceId ?? candidates[0]?.id
  if (detailId) {
    console.log(`\n🔗 [对照] 详情页: https://movie.douban.com/subject/${detailId}/`)
    console.log(`🔗 [对照] mobile-api(adapter 实读): https://m.douban.com/rexxar/api/v2/movie/${detailId}（需 Referer: https://m.douban.com）`)
    try {
      const resp = await details.getById(detailId)
      const d = resp.data
      if (d) {
        console.log(`\n③ 详情（id=${d.id}）:`)
        console.log(`   标题: ${d.title}`)
        console.log(`   评分: ${d.rate}   年份: ${d.year}   集数: ${d.episodes ?? '-'}`)
        console.log(`   导演: ${d.directors.join(' / ')}`)
        console.log(`   编剧: ${d.screenwriters.join(' / ')}`)
        console.log(`   主演: ${d.cast.slice(0, 6).join(' / ')}`)
        console.log(`   类型: ${d.genres.join(' / ')}`)
        console.log(`   国家/地区: ${d.countries.join(' / ')}`)
        console.log(`   语言: ${d.languages.join(' / ')}`)
        console.log(`   海报: ${d.poster}`)
        console.log(`   简介: ${(d.plotSummary ?? '').slice(0, 80)}…`)
      } else {
        console.log(`\n③ 详情: data=null（抓取失败/ID 无效）`)
      }
    } catch (e) {
      console.log(`\n③ 详情异常: ${(e as Error).message}`)
    }
  }
}

async function searchMode(titleArgs: string[]) {
  const inputs = titleArgs.length > 0 ? titleArgs.map(parseArg) : [
    { title: '流浪地球', year: 2019 as number | undefined, forceId: undefined as string | undefined },
    { title: '繁花', year: 2023, forceId: undefined },
    { title: '进击的巨人', year: undefined, forceId: undefined },
  ]
  console.log(`[search] cookie: ${COOKIE ? '已注入' : '无（=生产行为）'} | 限速: ${DELAY_MS}ms`)
  for (let i = 0; i < inputs.length; i++) {
    await runSearch(inputs[i].title, inputs[i].year, inputs[i].forceId)
    if (i < inputs.length - 1) await delay(DELAY_MS)
  }
  console.log('\n✅ search 完成。对照清单见各 🔗 链接。')
}

// ═══════════════════════════════════════════════════════════════
// collections 模式（ADR-187 subject_collection 采集）
// ═══════════════════════════════════════════════════════════════

async function probeCollection(key: string) {
  const entry = DOUBAN_COLLECTIONS.find((c) => c.key === key)
  console.log('\n' + '─'.repeat(72))
  console.log(`▶ 合集: ${key}${entry ? ` (${entry.domain}/${entry.category})` : ' (不在注册表)'}`)
  console.log(`🔗 [对照] mobile-api(adapter 实读): https://m.douban.com/rexxar/api/v2/subject_collection/${key}/items`)
  console.log(`🔗 [对照] 网页: https://m.douban.com/subject_collection/${key}/`)
  try {
    const res = await collections.getItems({ collection: key, start: 0, count: 10 })
    console.log(`   total=${res.total} | 本页 ${res.items.length} 条`)
    res.items.slice(0, 5).forEach((it, i) =>
      console.log(
        `   ${i + 1}. id=${it.id} | ${it.title}${it.originalTitle ? ` / ${it.originalTitle}` : ''} | ${it.year ?? '?'} | 评分${it.ratingValue ?? '-'}(${it.ratingCount ?? 0}) | 档期${it.releaseDate ?? '-'} | raw有comments=${(it.raw as { comments?: unknown }).comments !== undefined}`,
      ),
    )
  } catch (e) {
    console.log(`   ❌ getItems 异常: ${(e as Error).message}`)
  }
}

async function collectionsMode(keys: string[]) {
  console.log('═══ 注册表 DOUBAN_COLLECTIONS（ADR-187，16 合集）═══')
  const byDomain = new Map<string, string[]>()
  for (const c of DOUBAN_COLLECTIONS) {
    const list = byDomain.get(c.domain) ?? []
    list.push(`${c.key}(${c.category})`)
    byDomain.set(c.domain, list)
  }
  for (const [domain, list] of byDomain) {
    console.log(`  ${domain}: ${list.join(', ')}`)
  }

  const probeKeys = keys.length > 0 ? keys : ['movie_hot_gaia', 'tv_hot', 'show_hot']
  console.log(`\n═══ 探测 ${probeKeys.length} 合集适配器输出（无 cookie = 生产行为）═══`)
  for (let i = 0; i < probeKeys.length; i++) {
    await probeCollection(probeKeys[i]!)
    if (i < probeKeys.length - 1) await delay(800)
  }
  console.log('\n✅ collections 完成。')
}

// ═══════════════════════════════════════════════════════════════
// db 模式（已落库状态，只读；需 --env-file=.env.local）
// ═══════════════════════════════════════════════════════════════

async function dbMode() {
  const { db } = await import('../apps/api/src/lib/postgres')
  try {
    console.log('═══ douban_collection_items 落库行数（按 collection）═══')
    const counts = await db.query<{ collection: string; domain: string; category: string; n: string }>(
      `SELECT collection, domain, category, count(*)::text AS n
         FROM external_data.douban_collection_items GROUP BY collection, domain, category ORDER BY collection`,
    )
    if (counts.rows.length === 0) {
      console.log('  （空——尚未跑 refresh-douban-collections job）')
    }
    let total = 0
    for (const r of counts.rows) {
      total += Number(r.n)
      console.log(`  ${r.collection.padEnd(24)} ${r.domain}/${r.category} → ${r.n}`)
    }
    console.log(`  合计 ${total} 行 / ${counts.rows.length} 合集`)

    console.log('\n═══ sync_state 新鲜度 ═══')
    const st = await db.query<{ collection: string; last_status: string | null; item_count: number; last_success_at: string | null }>(
      `SELECT collection, last_status, item_count, last_success_at::text
         FROM external_data.douban_collection_sync_state ORDER BY collection`,
    )
    const now = Date.now()
    for (const r of st.rows) {
      const ageH = r.last_success_at ? ((now - Date.parse(r.last_success_at)) / 3600_000).toFixed(1) : '∞'
      console.log(`  ${r.collection.padEnd(24)} ${r.last_status ?? '-'} count=${r.item_count} 距上次成功=${ageH}h`)
    }
  } finally {
    await db.end()
  }
  console.log('\n✅ db 完成。')
}

// ═══════════════════════════════════════════════════════════════

const MODES = new Set(['search', 'collections', 'db'])

async function main() {
  const argv = process.argv.slice(2)
  const mode = argv[0] && MODES.has(argv[0]) ? argv[0] : 'search'
  const rest = argv[0] && MODES.has(argv[0]) ? argv.slice(1) : argv
  if (mode === 'collections') return collectionsMode(rest)
  if (mode === 'db') return dbMode()
  return searchMode(rest)
}

main().catch((e) => { console.error(e); process.exit(1) })
