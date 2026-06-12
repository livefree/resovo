-- 110_videos_short_id_dash_cleanup.sql
-- 描述：重新生成含 `-` 的 videos.short_id 存量（nanoid 默认字母表遗留数据清洗）
-- 日期：2026-06-11
-- 任务卡：BUGFIX-SHORTID-DASH-B（SEQ-20260611-01；生成侧收口见 -A / apps/api/src/lib/short-id.ts）
-- 幂等：是（WHERE short_id LIKE '%-%' 重跑 0 行命中）
--
-- ⚠️ 事务：由 scripts/migrate.ts 外层 BEGIN/COMMIT 包裹，本文件内不写 BEGIN/COMMIT（105 先例）。
-- ⚠️ Down 路径：不可逆（旧值为随机串无业务语义，不留存映射；受影响 URL 本来就 404，无断链成本）。
--
-- 背景：CrawlerService 曾用 nanoid 默认字母表（含 `-`/`_`）生成 short_id，前台
--   extractShortId 按最后一个 `-` 切分 `<slug>-<shortId>`（ADR-002）→ shortId 含 `-`
--   即被切坏 → 详情/播放页必现 404。dev 库 4337 视频 526 行（12.1%）命中，含 9 个已公开。
-- 范围裁定：
--   - 仅清洗含 `-` 的行：这些行现有 URL 必 404，改 ID 零断链成本。
--   - 含 `_` 的行（约 516）不动：`_` 不破坏分隔协议、URL 合法，改之反断既有公开链接。
--   - lists.short_id 无生成路径（schema 先行无写入），不在范围。
--   - 纯数据迁移无 DDL，docs/architecture.md 不需同步。
-- ES 跟进：short_id 进 resovo_videos 索引（VideoIndexSyncService），migration 无法触达 ES，
--   由 scripts/resync-es-short-id.ts 在 migrate 后一次性重同步（按 ES 侧旧值含 `-` 圈定）。
-- updated_at touch：使 reconcile 类回溯任务（CHG-411 reconcileStale 等）能感知本次变更。
--
-- 引用方同步（2026-06-11 FIX 修订 / Codex stop-time review 拦截「persisted banner
--   short_id references stale」）：全仓持久化 video short_id 引用排查结论——
--   - home_banners.link_target（link_type='video' 时直存 short_id，home-banners.ts:96
--     JOIN 契约）→ **必须同事务同步**，否则重写后 banner 解引用断链；
--   - home_modules.content_ref_id = video.id UUID（HomeService.ts:43）不受影响；
--   - autofill 快照 / audit JSONB 不以 short_id 解引用，历史 stale 可接受。
--   修订时序说明：dev 已以初版应用（applied 不重跑）——dev 实证 link_type='video'
--   banner 为 0 行，初版与修订版在 dev 语义等价、无对账缺口；修订版供 prod/后续
--   环境完整执行。教训沉淀：重写被外部引用的 ID 的 migration，必须先排查并同事务
--   同步全部持久化引用方。

DO $$
DECLARE
  r RECORD;
  new_id TEXT;
  -- 与 apps/api/src/lib/short-id.ts SHORT_ID_ALPHABET 一致（62 字符，禁 `-`/`_`）
  alphabet CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
BEGIN
  FOR r IN SELECT id, short_id FROM videos WHERE short_id LIKE '%-%' LOOP
    -- 唯一冲突重试（videos_short_id_key UNIQUE；62^8 空间下碰撞概率可忽略，循环为防御性兜底）
    LOOP
      new_id := '';
      FOR i IN 1..8 LOOP
        new_id := new_id || substr(alphabet, floor(random() * 62)::int + 1, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM videos WHERE short_id = new_id);
    END LOOP;

    UPDATE videos
    SET short_id = new_id,
        updated_at = NOW()
    WHERE id = r.id;

    -- 引用方同步：video banner 的 link_target 直存 short_id（见头注排查结论）
    UPDATE home_banners
    SET link_target = new_id,
        updated_at = NOW()
    WHERE link_type = 'video'
      AND link_target = r.short_id;
  END LOOP;
END $$;
