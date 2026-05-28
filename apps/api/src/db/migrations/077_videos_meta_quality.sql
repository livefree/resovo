-- Migration 077: videos.meta_quality JSONB（CHG-365-A2 / plan §10.4.1）
--
-- 背景：CHG-385 Phase 3 / META-05 已落地 MetadataEnrichService 五步丰富，但只把
-- 整体 `douban_status` 与 `meta_score` 写回 videos，细粒度匹配证据（豆瓣置信度、
-- 匹配方式、breakdown、拼音判断）仅留在 `video_external_refs.notes` 与日志中，
-- 无法直接驱动审核台 TabDetail 的"重新匹配"提示与质量门禁观察。
--
-- 治理：新增 `videos.meta_quality jsonb`，集中存放 enrich 阶段生成的"信号字典"。
-- 与 Migration 048 `media_catalog.stills_meta` 同范式：NOT NULL + DEFAULT '{}'::jsonb
-- + jsonb_typeof = 'object' 防御性 CHECK。
--
-- 字段约定（service 写入，存量按需扩展，前端只读）：
--   title_en_is_pinyin?: boolean              — PinyinDetector (CHG-365-A1) 判定
--   douban_confidence?: number 0..1           — Step1 / Step2 命中置信度
--   douban_match_method?: 'imdb_id'｜'title'｜'alias'｜'network'
--   douban_match_status?: 'auto_matched'｜'candidate'｜'unmatched'
--   enriched_at?: string (ISO 8601)           — service 写入时刻
--
-- 关联：ADR 无新增（schema 扩展非 ADR-needed / 复用 Migration 032 douban_status
-- + meta_score 模式）。详 task-queue.md `CHG-365-A2` + tasks.md 任务卡。

BEGIN;

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS meta_quality JSONB NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(meta_quality) = 'object');

-- 部分索引：仅对已写入 title_en_is_pinyin 的行索引，加速审核台
-- "title_en 疑似拼音"筛选（plan §10.4.1 审核台 TabDetail 改造的潜在筛选位）
CREATE INDEX IF NOT EXISTS idx_videos_meta_quality_pinyin
  ON videos ((meta_quality ->> 'title_en_is_pinyin'))
  WHERE meta_quality ? 'title_en_is_pinyin';

-- ── 验证 ──────────────────────────────────────────────────────────

DO $$
DECLARE
  v_col_count INT;
BEGIN
  SELECT COUNT(*) INTO v_col_count
  FROM information_schema.columns
  WHERE table_name = 'videos'
    AND column_name = 'meta_quality';

  IF v_col_count <> 1 THEN
    RAISE EXCEPTION 'Migration 077: videos.meta_quality 添加失败';
  END IF;

  RAISE NOTICE 'Migration 077 OK: videos.meta_quality jsonb added';
END $$;

COMMIT;

-- ROLLBACK:
-- DROP INDEX IF EXISTS idx_videos_meta_quality_pinyin;
-- ALTER TABLE videos DROP COLUMN IF EXISTS meta_quality;
