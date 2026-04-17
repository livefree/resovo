import { Client } from '@elastic/elasticsearch'
import esMappingJson from '@/api/db/migrations/es_mapping.json'

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL

if (!ELASTICSEARCH_URL) {
  throw new Error('ELASTICSEARCH_URL environment variable is required')
}

export const es = new Client({
  node: ELASTICSEARCH_URL,
})

export const ES_INDEX = 'resovo_videos'

export async function ensureIndex(): Promise<void> {
  const exists = await es.indices.exists({ index: ES_INDEX })
  if (!exists) {
    // Cast through unknown to bypass strict type checking of JSON mapping
    // The JSON structure is valid ES mapping, just not typed as ES client literal types
    await es.indices.create({
      index: ES_INDEX,
      ...(esMappingJson as unknown as Record<string, unknown>),
    })
  }
}

export default es
