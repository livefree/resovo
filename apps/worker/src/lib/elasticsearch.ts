/**
 * apps/worker/src/lib/elasticsearch.ts — worker 自包含 ES client（STATS-06-B / ADR-216 D-216-4）
 *
 * ADR-107 §4：worker **禁止** import apps/api 内部文件 → 自带 `@elastic/elasticsearch` Client +
 * 内联 index 名（与 `apps/api/src/lib/elasticsearch.ts` 的 `ES_INDEX = 'resovo_videos'` 同值，
 * 须同步维护——此处刻意重复是边界成本，非可复用违规）。与 `lib/db.ts` 自包含 pg Pool 同范式。
 *
 * **ES 可选**（与 apps/api 模块加载期 throw 刻意不同）：批量聚合（PG 物化）是关键路径，
 * ES play 字段实时同步是 best-effort（D-216-4 既有 reconcile 周期兜底覆盖漂移）。
 * `ELASTICSEARCH_URL` 缺失 → `esClient = null` → 同步降级 no-op，**绝不阻断聚合 job 启动**。
 * 可观测（Codex 任务卡审 HIGH 2：避免静默 drift）：禁用状态由 `index.ts` 启动日志
 * `play_stats_es_sync_enabled=false` 体现（禁用时阶段二 no-op、无 per-tick metric）；启用时每 tick
 * 写 `play_stats_es_sync.result {synced,missing,failed}`（或 `.error` / `.deadline`）。
 */
import { Client } from '@elastic/elasticsearch'

/** 视频索引名（内联，ADR-107 §4 自包含；须与 apps/api `ES_INDEX` 同步）。 */
export const ES_INDEX = 'resovo_videos'

const ELASTICSEARCH_URL = process.env.ELASTICSEARCH_URL

/**
 * worker ES client：`ELASTICSEARCH_URL` 缺失 → `null`（同步降级 no-op，不阻断聚合）。
 * 模块级单例（连接复用，与 apps/api `es` 单例同范式）；由 `index.ts` 显式注入聚合 job。
 */
export const esClient: Client | null = ELASTICSEARCH_URL ? new Client({ node: ELASTICSEARCH_URL }) : null
