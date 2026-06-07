/**
 * subject-collection.service.ts — 豆瓣合集采集服务
 * ADR-187 D-187-3：runtime.fetch + 复用 recommendations header + DoubanError 降级。
 * 仿 recommendations.service 范式；本服务不缓存（落库由主工程抓取 job 承担）。
 */

import { DoubanError } from './errors.js';
import {
  buildSubjectCollectionUrl,
  DEFAULT_COLLECTION_COUNT,
  normalizeCollectionItem,
} from './subject-collection.helpers.js';
import type {
  DoubanCollectionItem,
  DoubanCollectionItemsResult,
  DoubanGetCollectionItemsOptions,
} from './subject-collection.types.js';
import type {
  DoubanSubjectCollectionRuntime,
  DoubanSubjectCollectionService,
} from '../ports/runtime.js';

interface RawCollectionResponse {
  total?: number;
  subject_collection_items?: unknown[];
}

function isCollectionItem(
  item: DoubanCollectionItem | null,
): item is DoubanCollectionItem {
  return item !== null;
}

export function createDoubanSubjectCollectionService(
  runtime: DoubanSubjectCollectionRuntime,
): DoubanSubjectCollectionService {
  return {
    async getItems(
      options: DoubanGetCollectionItemsOptions,
    ): Promise<DoubanCollectionItemsResult> {
      const start = options.start ?? 0;
      const count = options.count ?? DEFAULT_COLLECTION_COUNT;
      const url = buildSubjectCollectionUrl(options.collection, start, count);

      const response = await runtime.fetch(url, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          Referer: 'https://m.douban.com/',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new DoubanError(
          `Douban subject_collection request failed: ${response.status}`,
          'NETWORK_ERROR',
          response.status,
        );
      }

      const payload = (await response.json()) as RawCollectionResponse;
      const items = (payload.subject_collection_items ?? [])
        .map(normalizeCollectionItem)
        .filter(isCollectionItem);

      runtime.logger.info('douban.subject_collection.fetch.complete', {
        collection: options.collection,
        start,
        count,
        total: payload.total ?? 0,
        itemCount: items.length,
      });

      return {
        collection: options.collection,
        total: payload.total ?? 0,
        items,
      };
    },
  };
}
