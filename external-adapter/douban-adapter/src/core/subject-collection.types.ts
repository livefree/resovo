/**
 * subject-collection.types.ts — 豆瓣合集（subject_collection）采集类型
 * ADR-187 D-187-1：全字段归一化 + raw JSONB 兜底（strip comments）。
 */

/** 合集归类域（注册表权威，与 item 自带 type 正交，ADR-187 D-187-1） */
export type DoubanCollectionDomain = 'movie' | 'tv' | 'show';

/** 合集类别（热门 / 榜单 / 即将上映） */
export type DoubanCollectionCategory = 'trending' | 'ranking' | 'upcoming';

/** 单条合集条目（归一化，含 raw 兜底未来字段） */
export interface DoubanCollectionItem {
  /** 豆瓣 subject id */
  id: string;
  title: string;
  originalTitle: string | null;
  /** "年份 / 国家 / 类型 / 导演 / 主演" 拼接副标题 */
  cardSubtitle: string | null;
  /** "国家 / 类型 / 片长" 信息串 */
  info: string | null;
  year: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  coverUrl: string | null;
  /** douban:// 深链 */
  uri: string | null;
  /** 档期（豆瓣含 "2026" 等不完整值，故 string 非 date） */
  releaseDate: string | null;
  /** item 原始 type/subtype（留作未来细分，展示以注册表 domain 为准） */
  subjectType: string | null;
  hasLinewatch: boolean;
  /** 整条 item 原始 JSON（已 strip comments，ADR-187 D-187-7 INV-2） */
  raw: unknown;
}

export interface DoubanGetCollectionItemsOptions {
  collection: string;
  start?: number;
  count?: number;
}

export interface DoubanCollectionItemsResult {
  collection: string;
  /** 合集总量（豆瓣 total，供分页拉全量判定） */
  total: number;
  items: DoubanCollectionItem[];
}
