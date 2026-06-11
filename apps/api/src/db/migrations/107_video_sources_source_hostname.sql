-- 107_video_sources_source_hostname.sql
-- 描述：video_sources 新增 source_hostname 可索引 join key（P3-3-B host_health JOIN 前置）
-- 日期：2026-06-10
-- 方案真源：docs/designs/source-health-feedback-loop-plan_20260610.md §3 P3-3 / §7.1-1
-- 任务卡：SRCHEALTH-P3-3-A / SEQ-20260610-02
-- 子代理：arch-reviewer (claude-opus-4-8) 裁决 A–H
-- 幂等：是（ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS；无 backfill）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
--
-- ⚠️ 本文件不做存量回填（裁决 D 两重否决 SQL 回填）：
--   1. 语义：hostname 真源 = Node `new URL().hostname`（IDN→punycode），SQL regex 无法复制——
--      SQL 回填会让 IDN 主机产生与写路径永久错配的第二 key。
--   2. 锁：migrate.ts 单事务包裹，55.7 万行 UPDATE + 索引维护 = 长事务写锁，阻塞爬虫 upsert。
--   回填走 scripts/backfill-source-hostname.ts（游标分批 + extractHostname + 末尾 ANALYZE），
--   migration 后必跑。回填前本列无任何读路径（P3-3-B 才进 JOIN），NULL 中间态无害。

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS source_hostname TEXT
    CHECK (source_hostname IS NULL OR source_hostname = lower(source_hostname));

COMMENT ON COLUMN video_sources.source_hostname
  IS '规范化 hostname（packages/media-probe extractHostname = new URL().hostname：小写/去端口/去 userinfo/IDN punycode/IPv6 含方括号）。NULL = URL 解析失败或无 hostname（不参与 host_health 降权）；回填后存量无未回填残留。写路径维护：upsertSource / replaceSourcesForSite / replaceSourceUrl。P3-3-B host_health JOIN key';

-- 索引建在刚加的空列上（partial 谓词 IS NOT NULL → 初始空索引，瞬时完成，无锁等待；
-- migrate.ts 事务内禁 CONCURRENTLY，此形态下安全）。回填脚本逐批增量维护。
-- 不加 is_active 进谓词：P3-3-B 软降权/恢复需反查 active 与 inactive 行（裁决 E）。
CREATE INDEX IF NOT EXISTS idx_video_sources_hostname
  ON video_sources (source_hostname)
  WHERE deleted_at IS NULL AND source_hostname IS NOT NULL;

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_video_sources_hostname;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS source_hostname;
