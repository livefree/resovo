-- 021_backfill_type_genre_content_rating.sql
-- CHG-184: 历史数据批量回填
--   区块 A — type 重分类（修复旧爬虫"单集=电影"逻辑导致的误分类，约 320 条）
--   区块 B — 成人内容打标（content_rating='adult' + visibility_status='hidden'）
--   区块 C — genre 自动推断（仅普通内容中 source_category 能明确映射题材的）
-- 幂等：可重复执行，已正确的行不受影响

BEGIN;

-- ── 区块 A：type 重分类 ────────────────────────────────────────────
-- 仅修正 type='movie' 且 source_category 能明确判断为其他类型的行
-- 不修改 source_category='电影' 或 NULL 的真实电影

UPDATE videos SET type = 'short'
WHERE type = 'movie'
  AND source_category IN ('短剧', '微剧', '爽文短剧', '女频恋爱', '现代都市')
  AND deleted_at IS NULL;

UPDATE videos SET type = 'kids'
WHERE type = 'movie'
  AND source_category IN ('少儿', '儿童')
  AND deleted_at IS NULL;

UPDATE videos SET type = 'anime'
WHERE type = 'movie'
  AND source_category IN ('日韩动漫', '国产动漫', '日本动漫', '动画片', '欧美动漫')
  AND deleted_at IS NULL;

UPDATE videos SET type = 'variety'
WHERE type = 'movie'
  AND source_category IN ('大陆综艺', '日韩综艺', '综艺', '综艺节目', '真人秀')
  AND deleted_at IS NULL;

UPDATE videos SET type = 'series'
WHERE type = 'movie'
  AND source_category IN (
    '欧美剧', '日本剧', '日韩剧', '大陆剧', '内地剧',
    '泰剧', '港剧', '台湾剧', '港澳剧', '国产剧',
    '海外剧', '国产主播'  -- 国产主播实为连续直播剧集形式
  )
  AND deleted_at IS NULL;

UPDATE videos SET type = 'documentary'
WHERE type = 'movie'
  AND source_category IN ('纪录片', '记录片')
  AND deleted_at IS NULL;

-- ── 区块 B：成人内容打标 ───────────────────────────────────────────
-- content_rating='adult' + visibility_status='hidden'
-- 与 SourceParserService.ADULT_CATEGORIES 保持同步

UPDATE videos
SET content_rating    = 'adult',
    visibility_status = 'hidden'
WHERE source_category IN (
  '亚洲情色', '亚洲有码', '日本有码', '日本无码', '无码专区',
  '国产自拍', '国产主播', '国产直播', '国产盗摄', '国产SM',
  '欧美性爱', '欧美精品',
  '中文字幕',
  '门事件', '强奸乱伦', '伦理三级', '倫理片',
  '抖阴视频', '自拍偷拍', '重口调教',
  '性感人妻', '主播视讯', '主播秀色',
  '口爆颜射', '换脸明星', '美乳巨乳', '巨乳美乳',
  '黑丝诱惑', '制服丝袜',
  '素人搭讪', '童颜巨乳', '群交淫乱', '多人群交',
  '大象传媒', '探花系列', '传媒原创',
  '女优系列'
)
AND deleted_at IS NULL;

-- ── 区块 C：genre 回填（仅普通内容）──────────────────────────────
-- 只对 content_rating='general' 的行操作，成人内容 genre 保持 NULL

UPDATE videos
SET genre        = 'romance',
    genre_source = 'auto'
WHERE content_rating = 'general'
  AND genre IS NULL
  AND source_category IN ('爽文短剧', '女频恋爱', '现代都市')
  AND deleted_at IS NULL;

UPDATE videos
SET genre        = 'crime',
    genre_source = 'auto'
WHERE content_rating = 'general'
  AND genre IS NULL
  AND source_category IN ('犯罪片')
  AND deleted_at IS NULL;

UPDATE videos
SET genre        = 'war',
    genre_source = 'auto'
WHERE content_rating = 'general'
  AND genre IS NULL
  AND source_category IN ('战争片')
  AND deleted_at IS NULL;

UPDATE videos
SET genre        = 'mystery',
    genre_source = 'auto'
WHERE content_rating = 'general'
  AND genre IS NULL
  AND source_category IN ('悬疑片', '脑洞悬疑')
  AND deleted_at IS NULL;

UPDATE videos
SET genre        = 'other',
    genre_source = 'auto'
WHERE content_rating = 'general'
  AND genre IS NULL
  AND source_category IN ('剧情片')
  AND deleted_at IS NULL;

COMMIT;
