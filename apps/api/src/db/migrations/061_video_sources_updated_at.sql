-- 061_video_sources_updated_at.sql
-- 描述：video_sources 表新增 updated_at 列以支持乐观锁
-- 日期：2026-05-06
-- 任务卡：CHG-SN-5-PRE-01-C / SEQ-20260506-02 / DEBT-SN-4-05-A
-- 关联：M-SN-5.5 启动准入门 cutover-blocker（并发安全 🔴）
-- 幂等：是（ADD COLUMN IF NOT EXISTS）
--
-- 背景：
--   toggleSource / disableDeadSources 写 video_sources.is_active 时无版本字段，
--   并发场景下后写覆盖前写无冲突感知（DEBT-SN-4-05-A）。
--   既有 last_checked 列被 SourceHealthWorker 后台 probe 占用，不可复用为版本字段
--   （混用会导致 probe 异步写抢占 admin 写的 ETag，乐观锁误报冲突）。
--
-- 设计：
--   新增独立 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()，与 videos.updated_at 镜像。
--   写路径（toggleVideoSource / disableDeadSources）显式 SET updated_at = NOW()。
--   probe 路径继续只写 last_checked / probe_status / latency_ms 等信号列，**不**触发 updated_at。
--
-- 存量回填：
--   既有行 updated_at = COALESCE(last_checked, created_at)，给乐观锁一个稳定基线。
--   迁移流程：先 nullable ADD COLUMN → backfill → SET NOT NULL → SET DEFAULT NOW()。
--
-- ⚠️  Down 路径说明：注释形式留存。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE video_sources
SET updated_at = COALESCE(last_checked, created_at)
WHERE updated_at IS NULL;

ALTER TABLE video_sources
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE video_sources
  ALTER COLUMN updated_at SET DEFAULT NOW();

COMMENT ON COLUMN video_sources.updated_at
  IS '行级写入时间戳，用作乐观锁版本字段（CHG-SN-5-PRE-01-C / DEBT-SN-4-05-A）；只在 admin 写路径（toggleVideoSource / disableDeadSources）SET，probe 后台路径不触发。';

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS updated_at;
-- COMMIT;
