/**
 * reviewLabels.ts — review_labels 表查询
 * CHG-SN-4-05: GET /admin/review-labels
 */

import type { Pool } from 'pg'
import type { ReviewLabelAppliesTo } from '@resovo/types'

export interface DbReviewLabelRow {
  id: string
  label_key: string
  label: string
  applies_to: ReviewLabelAppliesTo
  display_order: number
  is_active: boolean
  created_at: string
}

export async function listActiveReviewLabels(
  db: Pool,
  appliesTo?: ReviewLabelAppliesTo,
): Promise<DbReviewLabelRow[]> {
  const conditions = ['is_active = true']
  const params: unknown[] = []
  let idx = 1

  if (appliesTo) {
    conditions.push(`(applies_to = $${idx} OR applies_to = 'any')`)
    params.push(appliesTo)
    idx++
  }

  const result = await db.query<DbReviewLabelRow>(
    `SELECT id, label_key, label, applies_to, display_order, is_active, created_at
     FROM review_labels
     WHERE ${conditions.join(' AND ')}
     ORDER BY display_order ASC`,
    params,
  )
  return result.rows
}

export async function findReviewLabelByKey(
  db: Pool,
  labelKey: string,
): Promise<DbReviewLabelRow | null> {
  const result = await db.query<DbReviewLabelRow>(
    `SELECT id, label_key, label, applies_to, display_order, is_active, created_at
     FROM review_labels
     WHERE label_key = $1`,
    [labelKey],
  )
  return result.rows[0] ?? null
}
