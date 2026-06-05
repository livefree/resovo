-- 093_home_modules_title_image.sql
-- 描述：home_modules 增 title（多语言标题映射）+ image_url（运营横图）一等列
-- 日期：2026-06-05
-- ADR：ADR-052 AMENDMENT 2026-06-05（D-052-9/D-052-10，SEQ-20260605-01 / CHG-HOME-UX-01-A）
-- 幂等：是（ADD COLUMN IF NOT EXISTS）
--
-- 语义：
--   title     JSONB NOT NULL DEFAULT '{}'  — locale→string 映射（与 home_banners.title 同构）；
--                                             空 '{}' 时消费端降级（video 类型用视频标题）
--   image_url TEXT  NULL                   — 运营横图 URL；可空（video 类型消费端回退
--                                             videos.cover_url，降级链 imageUrl ?? coverUrl ?? placeholder）
--   存量行零破坏：title 落 '{}' / image_url 落 NULL。
--   索引 / CHECK 零新增（纯展示数据，无 WHERE 过滤需求，ADR-052 §索引策略不变）。
--
-- ⚠️  Down 路径说明（项目约定）：
--   scripts/migrate.ts 将整个文件内容作为单条 SQL 执行，不区分 up/down 节。
--   因此 down 路径必须保持注释形式，否则加列后立即被 DROP。
--   需要回滚时，手动解注释 down 节并在目标数据库独立执行（与 049/050 等迁移同约定）。

-- ── up ───────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE home_modules
  ADD COLUMN IF NOT EXISTS title JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE home_modules
  ADD COLUMN IF NOT EXISTS image_url TEXT NULL;

COMMIT;

-- ── down ─────────────────────────────────────────────────────────────────────

-- BEGIN;
-- ALTER TABLE home_modules DROP COLUMN IF EXISTS image_url;
-- ALTER TABLE home_modules DROP COLUMN IF EXISTS title;
-- COMMIT;
