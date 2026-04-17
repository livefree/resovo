-- 008_crawler_sites_api_unique.sql
-- CHG-40: 以 API 地址作为唯一标识（crawler_sites.api_url）

-- 统一归一化：去首尾空白 + 去末尾斜杠
UPDATE crawler_sites
SET api_url = regexp_replace(btrim(api_url), '/+$', '')
WHERE api_url IS NOT NULL;

-- 若存在重复 API，保留最近更新的一条
WITH ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY api_url
      ORDER BY updated_at DESC, created_at DESC, key ASC
    ) AS rn
  FROM crawler_sites
)
DELETE FROM crawler_sites c
USING ranked r
WHERE c.ctid = r.ctid
  AND r.rn > 1;

-- API 地址唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS uq_crawler_sites_api_url
ON crawler_sites (api_url);
