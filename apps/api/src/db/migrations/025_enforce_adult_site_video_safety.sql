-- 025_enforce_adult_site_video_safety.sql
-- 目标：
-- 1) 成人源站视频统一改为 type='other'
-- 2) 可见性统一为 hidden
-- 3) 审核状态统一为 rejected
-- 4) 全部下架（is_published=false）
--
-- 注意：项目已启用 videos 状态机触发器（023），本迁移使用“合法跃迁链”分步更新，
-- 避免触发 invalid transition 异常。

BEGIN;

-- Step 0: 目标集（来自 is_adult=true 的站点）
CREATE TEMP TABLE tmp_adult_site_videos AS
SELECT v.id
FROM videos v
JOIN crawler_sites cs ON cs.key = v.site_key
WHERE v.deleted_at IS NULL
  AND cs.is_adult = true;

-- Step 1: 统一类型；并先收敛到 hidden + unpublished（保持 review_status 不变）
UPDATE videos v
SET type = 'other',
    visibility_status = 'hidden',
    is_published = false,
    updated_at = NOW()
FROM tmp_adult_site_videos t
WHERE v.id = t.id
  AND (
    v.type <> 'other'
    OR v.visibility_status <> 'hidden'
    OR v.is_published <> false
  );

-- Step 2: approved -> pending_review（approved|hidden|0 -> pending_review|hidden|0 合法）
UPDATE videos v
SET review_status = 'pending_review',
    updated_at = NOW()
FROM tmp_adult_site_videos t
WHERE v.id = t.id
  AND v.review_status = 'approved';

-- Step 3: pending_review -> rejected（pending_review|hidden|0 -> rejected|hidden|0 合法）
UPDATE videos v
SET review_status = 'rejected',
    updated_at = NOW()
FROM tmp_adult_site_videos t
WHERE v.id = t.id
  AND v.review_status = 'pending_review';

DROP TABLE IF EXISTS tmp_adult_site_videos;

COMMIT;

