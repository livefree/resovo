import { describe, expect, it } from 'vitest'
import { parseSitesFromJson } from '@/components/admin/system/crawler-site/importParser'

describe('parseSitesFromJson', () => {
  it('parses api_site map payload', () => {
    const payload = {
      api_site: {
        alpha: {
          name: 'Alpha',
          api: 'https://alpha.test/api.php/provide/vod',
          type: 'vod',
        },
      },
    }

    const result = parseSitesFromJson(payload)
    expect(result.length).toBe(1)
    expect(result[0]?.name).toBe('Alpha')
    expect(result[0]?.apiUrl).toBe('https://alpha.test/api.php/provide/vod')
    expect(result[0]?.sourceType).toBe('vod')
  })

  it('supports sites array and field aliases', () => {
    const payload = {
      sites: [
        {
          key: 'beta',
          title: 'Beta',
          api_url: 'https://beta.test/api.php/provide/vod',
          source_type: 'shortdrama',
          isAdult: true,
          format: 'xml',
          weight: 80,
        },
      ],
    }

    const result = parseSitesFromJson(payload)
    expect(result.length).toBe(1)
    expect(result[0]?.key).toBe('beta')
    expect(result[0]?.sourceType).toBe('shortdrama')
    expect(result[0]?.isAdult).toBe(true)
    expect(result[0]?.format).toBe('xml')
    expect(result[0]?.weight).toBe(80)
  })

  it('deduplicates by api url and skips invalid rows', () => {
    const payload = {
      crawler_sites: {
        one: { name: 'One', api: 'https://same.test/api.php/provide/vod' },
        dup: { name: 'Dup', api: 'https://same.test/api.php/provide/vod' },
        bad: { name: 'Bad' },
      },
    }

    const result = parseSitesFromJson(payload)
    expect(result.length).toBe(1)
    expect(result[0]?.name).toBe('One')
  })
})
