-- 127_video_sources_audio_language_index.sql
-- 描述：video_sources.audio_language 复合部分索引——支撑 /videos 按音频语言(lang)筛选
--       的 EXISTS(≥1 active 未软删 source 命中) 聚合查询（统一筛选区 5 维之 lang 维）。
-- 日期：2026-06-24
-- 决策真源：docs/decisions.md ADR-199 §D-199-1（audio_language 行级单值封闭枚举）
--           / §D-199-7（API 透出 + 前台 UI）。
-- 任务卡：HANDOFF-38 / SEQ-20260624-01（统一筛选过滤区）
-- 子代理：arch-reviewer (claude-opus-4-8) CONDITIONAL PASS — M1 索引定义裁定（复合部分索引
--         over 单列部分索引：列序 (audio_language, video_id) 双等值谓词一次定位，
--         部分谓词 is_active+软删与 EXISTS 活跃源约束对齐，排除死源/软删源行）。
--
-- ⚠️ 聚合语义（ADR-199 D-199-7 未明示项，本卡裁定补充）：lang 筛选 = EXISTS（该 video
--    至少一个 is_active=true AND deleted_at IS NULL 的 source 其 audio_language=选定值）。
--    audio_language IS NULL（未知）按 SQL 三值逻辑自然不命中（NULL = '国语' → unknown）——
--    全 source NULL 的 video 仅在「全部」出现，不武断归入任一语言桶（与 D-199-6 展示哲学一致）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（112 先例）。
--    CREATE INDEX（非 CONCURRENTLY）在事务内安全，无需 CONCURRENTLY。
-- ⚠️ 幂等：是（CREATE INDEX IF NOT EXISTS）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- 备注：media_catalog.genres 的 GIN 索引（idx_catalog_genres）已于 migration 031 建立，
--       本卡 genre 维筛选复用之，不重建。

CREATE INDEX IF NOT EXISTS idx_video_sources_audio_lang_active
  ON video_sources (audio_language, video_id)
  WHERE is_active = true AND deleted_at IS NULL;

-- ── down ─────────────────────────────────────────────────────────────────────
-- DROP INDEX IF EXISTS idx_video_sources_audio_lang_active;
