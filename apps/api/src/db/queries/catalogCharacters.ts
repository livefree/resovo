/**
 * catalogCharacters.ts — catalog_characters + catalog_character_actors 角色↔CV 查询
 * （ADR-161 AMENDMENT / META-19 / Migration 083）
 *
 * 按 catalog_id + source 归属（对齐 077 catalog_episodes 范式）。角色 N:M CV。
 * 写入：delete-by-catalog-then-insert（全量替换，事务内 / 仅 PoolClient），保集合切换原子。
 * 读取：listCatalogCharactersForDisplay 直接产出 @resovo/types 展示投影（VideoService 注入用）。
 */

import type { Pool, PoolClient } from 'pg'
import type { CatalogCharacterSummary, CatalogCharacterActorSummary } from '@/types'

// ── 写入输入类型 ────────────────────────────────────────────────────

export interface CatalogCharacterActorInput {
  externalActorId: string
  name: string
  imageUrl: string | null
  sort: number
}

export interface CatalogCharacterInput {
  source: string
  externalCharacterId: string
  name: string
  relation: string | null
  charType: number | null
  sort: number
  imageUrl: string | null
  summary: string | null
  actors: CatalogCharacterActorInput[]
}

/**
 * 全量替换某 catalog 的角色集合（delete-by-catalog-then-insert）。
 *
 * **仅 PoolClient**（必须在调用方事务内 / Codex 红线 4）：delete + insert 跨多语句，
 * 若各自连接会暴露空窗；角色集合切换须原子可见。actor 行随 character CASCADE，
 * DELETE 父行即清子行。调用方须保证 getCharacters 抓取成功（`charactersFetched`）才调用——
 * 成功返回空也调用（清陈旧角色）；抓取失败（null）跳过不调用（防瞬时故障误删）。传空数组即清空该 catalog 角色。
 *
 * @returns 写入角色数
 */
export async function replaceCatalogCharacters(
  db: PoolClient,
  catalogId: string,
  source: string,
  characters: CatalogCharacterInput[],
): Promise<number> {
  await db.query(
    `DELETE FROM catalog_characters WHERE catalog_id = $1 AND source = $2`,
    [catalogId, source],
  )
  let count = 0
  for (const c of characters) {
    const res = await db.query<{ id: string }>(
      `INSERT INTO catalog_characters
         (catalog_id, source, external_character_id, name, relation, char_type, sort, image_url, summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [catalogId, source, c.externalCharacterId, c.name, c.relation, c.charType, c.sort, c.imageUrl, c.summary],
    )
    const characterId = res.rows[0].id
    for (const a of c.actors) {
      await db.query(
        `INSERT INTO catalog_character_actors
           (character_id, external_actor_id, name, image_url, sort)
         VALUES ($1, $2, $3, $4, $5)`,
        [characterId, a.externalActorId, a.name, a.imageUrl, a.sort],
      )
    }
    count++
  }
  return count
}

/**
 * 读取某 catalog 的角色 + CV 展示投影（按 sort 升序）。
 * 2 查询：角色集合 + actor 批量（按 character_id ANY）。供 VideoService.adminFindById 注入。
 */
export async function listCatalogCharactersForDisplay(
  db: Pool,
  catalogId: string,
  source = 'bangumi',
): Promise<CatalogCharacterSummary[]> {
  const charRes = await db.query<{
    id: string; name: string; relation: string | null; image_url: string | null
  }>(
    `SELECT id, name, relation, image_url
     FROM catalog_characters
     WHERE catalog_id = $1 AND source = $2
     ORDER BY sort ASC, name ASC`,
    [catalogId, source],
  )
  if (charRes.rows.length === 0) return []

  const ids = charRes.rows.map((r) => r.id)
  const actorRes = await db.query<{ character_id: string; name: string; image_url: string | null }>(
    `SELECT character_id, name, image_url
     FROM catalog_character_actors
     WHERE character_id = ANY($1::uuid[])
     ORDER BY sort ASC`,
    [ids],
  )
  const actorsByChar = new Map<string, CatalogCharacterActorSummary[]>()
  for (const a of actorRes.rows) {
    const arr = actorsByChar.get(a.character_id) ?? []
    arr.push({ name: a.name, imageUrl: a.image_url })
    actorsByChar.set(a.character_id, arr)
  }

  return charRes.rows.map((r) => ({
    name: r.name,
    relation: r.relation,
    imageUrl: r.image_url,
    actors: actorsByChar.get(r.id) ?? [],
  }))
}
