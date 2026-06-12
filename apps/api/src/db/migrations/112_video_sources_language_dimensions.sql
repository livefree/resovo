-- 112_video_sources_language_dimensions.sql
-- 描述：播放源语言双维度（语音/字幕）结构化——video_sources 新增 4 列
--       （audio_language + subtitle_languages + 双 provenance）
-- 日期：2026-06-12
-- 决策真源：docs/decisions.md ADR-199 §D-199-1（字段建模）/ §D-199-3（推断链 provenance 值域）
-- 任务卡：LANG-DIM-A / SEQ-20260612-02
-- 子代理：arch-reviewer (claude-opus-4-8) — ADR-199 CONDITIONAL PASS（字段结构裁决已锁定：
--       行级归属方案 B / provenance 双列 / subtitle 三态 / 无 subtitle 地区推断）
-- 幂等：是（ADD COLUMN IF NOT EXISTS；无 backfill——存量回填走 LANG-DIM-B 脚本，
--       provenance 如实标 title_token/region_inferred，见 D-199-5）。
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
-- ⚠️ Down 路径：注释形式留存（项目约定）。
--
-- D-199-1：语言归 source 行级（D-176-12 归属不变）。入库时同 vod 各行同值是「合并后变异构」
--   的合法去范式化——多语言版本视频合并为一个 video 后，同 video 下 sources 语言必然异构，
--   video 级列在合并瞬间丢失区分能力（评审 BLOCKER 分叉，主循环裁定方案 B）。
-- provenance 升级规则（数据优先于推断，机器可执行）：region_inferred/unknown 可被
--   source_name_token/vod_lang/title_token 覆盖；反向禁止；同级重爬最新观测胜（应用层守卫）。

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS audio_language TEXT NULL;

COMMENT ON COLUMN video_sources.audio_language
  IS '语音（配音）规范词单值（ADR-199 D-199-1/D-199-2 封闭枚举：国语/粤语/日语/韩语/英语/国配…，真源 AUDIO_LANGUAGE_CANONICALS）。NULL=未知。不建数组——「国粤双语」归一取首个规范词（评审裁定双音轨数组 over-modeling）';

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS subtitle_languages TEXT[] NULL;

COMMENT ON COLUMN video_sources.subtitle_languages
  IS '字幕语言数组（ADR-199 D-199-1 三态语义，消费方勿用 COALESCE 抹平）：NULL=未知（含「知道双语但不知具体哪两种」）；{}=明确无字幕（对应「无字幕」token）；{中文,英文}=已知具体语言（中英双语）。元素=封闭枚举规范词，禁占位词「双语」入数组';

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS audio_language_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (audio_language_source IN ('source_name_token', 'vod_lang', 'title_token', 'region_inferred', 'unknown'));

COMMENT ON COLUMN video_sources.audio_language_source
  IS '语音维度 provenance（ADR-199 D-199-3 五级推断链，仿 quality_source 先例）：source_name_token=线路名行级 token（最精确）/ vod_lang=上游结构化字段 / title_token=原始标题解析 / region_inferred=catalog.country 地区推断（CN·TW→国语/HK→粤语/JP→日语/KR→韩语）/ unknown=全不命中。升级规则见迁移头注';

ALTER TABLE video_sources
  ADD COLUMN IF NOT EXISTS subtitle_language_source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (subtitle_language_source IN ('source_name_token', 'vod_lang', 'title_token', 'unknown'));

COMMENT ON COLUMN video_sources.subtitle_language_source
  IS '字幕维度 provenance（ADR-199 D-199-3）：值域比 audio 少 region_inferred——字幕无可靠地区先验，不做推断（评审 REVISE 双列理由：audio=region_inferred 与 subtitle=vod_lang 可同行并存，单列无法表达）';

-- ── down ─────────────────────────────────────────────────────────────────────
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS subtitle_language_source;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS audio_language_source;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS subtitle_languages;
-- ALTER TABLE video_sources DROP COLUMN IF EXISTS audio_language;
