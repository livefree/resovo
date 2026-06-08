-- 100_external_fetch_log.sql
-- ADR-188：外部资源治理框架 v1 — provider 无关采集操作观测日志
-- CHG-EXT-RES-STORE-A / SEQ-20260607-04
--
-- external_fetch_log = provider 无关的「外部资源采集操作流水」（D-188-3）：
--   每次真实外部 HTTP 抓取记一行（在线出口埋点，D-188-4：doubanAdapter 3 函数 + lib/douban searchDouban）。
--   operation = 内容类型（detail|search|collection|comments|schedule|celebrity，合法组合以 registry capabilities 为准）。
--   method    = 获取方式（offline|scrape|api = ACQUISITION_METHODS）；scrape/api 属 external.types.sourceFreshness
--               的 online 上位概念之细分（不回改既有类型，D-188-3 术语桥接）。实际只产 scrape（豆瓣）/ api（未来）行。
--   offline dump 本地召回**不入表**（D-188-3：本地 DB 查询非外部 fetch，避免稀释用量/成功率）；
--               富集「离线/在线」分布另由 video_external_refs.match_method 聚合（既有数据零埋点）。
--   status    = ok|fail|timeout（「成功但空」= ok + item_count 0，不单设 empty，避免与合集层 sync_state 的 empty_guard 打架）。
--   30 天 purge 挂 maintenanceWorker（D-188-7）；本期不建日级 rollup（即席聚合命中索引，月量级 < 100 万行）。
--
-- ⚠️  Down 路径说明（项目约定）：scripts/migrate.ts 整文件单条执行，不区分 up/down；
--     down 保持注释，回滚时手动解注释独立执行（与 094–099 同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS external_data.external_fetch_log (
  id          BIGSERIAL     PRIMARY KEY,
  -- ProviderKey（registry 真源 packages/types EXTERNAL_PROVIDERS）
  provider    TEXT          NOT NULL,
  -- 内容类型：detail|search|collection|comments|schedule|celebrity（合法组合以 registry capabilities 为准）
  operation   TEXT          NOT NULL,
  -- 获取方式：offline|scrape|api（= ACQUISITION_METHODS；实际只产 scrape/api，offline 召回不入表）
  method      TEXT          NOT NULL,
  -- 结果：ok|fail|timeout（成功但空 = ok + item_count 0）
  status      TEXT          NOT NULL,
  -- 触发方上下文：enrich_worker|collections_worker|admin_search（出口函数不知谁调，调用方传入；可空）
  source      TEXT,
  -- query / douban_id / collection key
  target      TEXT,
  item_count  INT           NOT NULL DEFAULT 0,
  duration_ms INT,
  error       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 时间窗扫描（概览近 24h 聚合 / activity 流水按时间倒序）
CREATE INDEX IF NOT EXISTS idx_external_fetch_log_provider_time
  ON external_data.external_fetch_log (provider, created_at DESC);

-- 按内容类型聚合（概览 operation 分布 / activity operation 过滤）
CREATE INDEX IF NOT EXISTS idx_external_fetch_log_provider_op
  ON external_data.external_fetch_log (provider, operation, created_at DESC);

COMMENT ON TABLE external_data.external_fetch_log
  IS '外部资源 provider 无关采集操作流水（ADR-188 D-188-3）；在线出口埋点每次外部抓取记一行；offline 本地召回不入表；method scrape/api 属 sourceFreshness online 细分；status 成功但空=ok+item_count 0；30 天 purge 挂 maintenanceWorker';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- DROP TABLE IF EXISTS external_data.external_fetch_log;
-- COMMIT;
