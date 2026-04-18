# 视频源/选集一致性修复方案（2026-04-02）

## 背景

现网出现两类症状：
1. 审核台“多源播放器”将同一线路下的分集当成多个“源”按钮，造成源选项爆炸。
2. 前台部分多集视频只显示线路不显示选集，且详情页/播放页体验不一致。

## 根因拆分

### 根因 A（展示模型错误，UX-06 落地偏差）
- `/admin/moderation` 当前直接消费 `/admin/sources` 的行级结果。
- `/admin/sources` 返回粒度是 `video_sources` 行（`video_id + episode_number + source_url`），不是“线路聚合”。
- 结果：同一 `source_name` 下每集一行，被 UI 当作“多源”。

### 根因 B（入库后状态漂移）
- 爬虫 `upsertVideo()` 命中已有视频时不会同步 `videos.episode_count`。
- 新增分集虽然写入了 `video_sources`，但视频主表仍保留旧 `episode_count`（常见为 1）。
- 前台播放器按 `video.episodeCount` 决定是否展示选集，导致“有多集源但无选集”的假象。

### 根因 C（历史存量）
- 历史数据已存在 `videos.episode_count` 与 `video_sources` 实际集数不一致。
- 单纯修复代码不能自动纠正旧数据。

## 修复目标

1. 审核台播放器改为“线路 + 选集”双维度，不再把分集当线路。
2. 爬虫命中已有视频时自动推进 `episode_count`（只增不减）。
3. 提供一次性 SQL 校正历史 `episode_count` 漂移。
4. 保持当前 API 兼容，避免大范围回归。

## 分步实施

### CHG-350（P1）审核台多源播放器改造为双维
- 文件：`src/components/admin/moderation/ModerationDetail.tsx`
- 策略：
  - 以 `source_name` 聚合为线路列表。
  - 线路内按 `episode_number` 选择播放源。
  - 默认“同线路优先 + 按当前集回落到最近可用集”。

### CHG-351（P1）采集命中已有视频时同步 episode_count
- 文件：
  - `src/api/services/CrawlerService.ts`
  - `src/api/db/queries/videos.ts`
- 策略：
  - 在 existing 分支计算本次采集 `incomingMaxEpisode`。
  - 执行 `episode_count = GREATEST(episode_count, incomingMaxEpisode)`。
  - 仅做单调递增，避免误回退。

### CHG-352（P1）历史数据一次性回填 SQL
- 文件：`src/api/db/migrations/024_backfill_videos_episode_count_from_sources.sql`
- 策略：
  - 使用 `MAX(video_sources.episode_number)` 回填 `videos.episode_count`。
  - 仅更新 `max_episode > episode_count` 的记录。
  - 不改变上架/审核/可见性状态。

## 验收标准

1. `/admin/moderation`：同一线路只展示一个线路入口；可切换选集。
2. 对已存在视频再次采集后，`videos.episode_count` 会自动增长。
3. 运行 migration 后，历史漂移视频可恢复选集展示。
4. 不影响 `/admin/sources` 原有表格管理语义。
