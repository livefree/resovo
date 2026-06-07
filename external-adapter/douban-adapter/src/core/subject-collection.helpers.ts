/**
 * subject-collection.helpers.ts — 合集 URL 构造 + item 归一化
 * ADR-187 D-187-1（归一化 + raw strip comments）/ D-187-3（count=50 对齐 recommendations）。
 */

import { DoubanError } from './errors.js';
import type { DoubanCollectionItem } from './subject-collection.types.js';

/** 分页页长：对齐 recommendations MAX_RECOMMENDATIONS_LIMIT=50（该端点族既验证安全页长） */
export const DEFAULT_COLLECTION_COUNT = 50;
export const MAX_COLLECTION_COUNT = 50;

export function buildSubjectCollectionUrl(
  collection: string,
  start: number,
  count: number,
): string {
  const key = collection.trim();
  if (!key) {
    throw new DoubanError('Collection key is required', 'PARSE_ERROR', 400);
  }
  const safeCount = Math.min(Math.max(count, 1), MAX_COLLECTION_COUNT);
  const safeStart = Math.max(start, 0);
  return `https://m.douban.com/rexxar/api/v2/subject_collection/${encodeURIComponent(key)}/items?start=${safeStart}&count=${safeCount}`;
}

interface RawCollectionItem {
  id?: string | number;
  title?: string;
  original_title?: string;
  card_subtitle?: string;
  info?: string;
  year?: string;
  type?: string;
  subtype?: string;
  uri?: string;
  release_date?: string;
  has_linewatch?: boolean;
  cover?: { url?: string };
  rating?: { value?: number; count?: number };
  comments?: unknown;
  [key: string]: unknown;
}

/**
 * 归一化单条合集 item；id/title 缺失返回 null（过滤）。
 * raw 存整条原始 JSON 但 **strip comments**（热评数组重、含 user 嵌套，ADR-187 INV-2）。
 */
export function normalizeCollectionItem(
  raw: unknown,
): DoubanCollectionItem | null {
  const item = raw as RawCollectionItem;
  if (!item?.id || !item.title) {
    return null;
  }

  const { comments: _comments, ...rawWithoutComments } = item;

  return {
    id: String(item.id),
    title: item.title.trim(),
    originalTitle: item.original_title?.trim() || null,
    cardSubtitle: item.card_subtitle ?? null,
    info: item.info ?? null,
    year: item.year ?? null,
    ratingValue: typeof item.rating?.value === 'number' ? item.rating.value : null,
    ratingCount: typeof item.rating?.count === 'number' ? item.rating.count : null,
    coverUrl: item.cover?.url ?? null,
    uri: item.uri ?? null,
    releaseDate: item.release_date ?? null,
    subjectType: item.subtype || item.type || null,
    hasLinewatch: item.has_linewatch === true,
    raw: rawWithoutComments,
  };
}
