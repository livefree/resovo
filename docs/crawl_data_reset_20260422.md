# 采集 / 入库 / 外部原始数据全量清空报告（CHORE-05）

- **日期**：2026-04-22
- **任务**：CHORE-05（SEQ-20260422-BUGFIX-01 第 2 张）
- **授权**：用户 2026-04-22 预授权"对数据的这些必要改动"
- **脚本**：`scripts/clear-crawled-data.ts`
- **入口**：
  - dry-run：`npm run clear:crawled-data`（无参数，安全默认）
  - execute：`npm run clear:crawled-data -- --execute`

## 一、执行策略

1. **事务包裹**：`BEGIN ... COMMIT`，任一步骤失败自动 `ROLLBACK`
2. **DELETE 而非 TRUNCATE**：保留 sequence 便于审计
3. **显式按 FK 依赖顺序**：避免误触级联链的无关表
4. **保留 crawler_sites 配置**：执行末尾 `UPDATE crawler_sites SET last_crawled_at=NULL, last_crawl_status=NULL` 使下一轮采集在干净基线运行

## 二、Dry-Run 报告（2026-04-22 11:48 UTC）

### 2.1 将被清空 · 目标清空表

| 表 | 所属层 | 行数 |
|----|--------|------|
| `source_health_events` | 运行观察 | 0 |
| `video_state_watchdog_runs` | 运行观察 | 0 |
| `broken_image_events` | 运行观察 | **18** |
| `external_imdb_tmdb_links` | 外部原始 | 0 |
| `external_douban_movies_raw` | 外部原始 | 0 |
| `external_tmdb_movies_raw` | 外部原始 | 0 |
| `external_bangumi_subjects_raw` | 外部原始 | 0 |
| `external_import_batches` | 外部原始 | 0 |
| `external_data.douban_people` | 外部画像 | 0 |
| `external_data.douban_entries` | 外部画像 | 0 |
| `external_data.bangumi_entries` | 外部画像 | 0 |
| `crawler_task_logs` | 采集运行 | **4,560** |
| `crawler_tasks` | 采集运行实例 | **319** |
| `crawler_runs` | 采集运行 | **36** |
| `videos` | 视频主数据 | **19,512** |
| `media_catalog_aliases` | 视频元数据 | **3,510** |
| `media_catalog` | 视频元数据 | **19,512** |

### 2.2 CASCADE 连带清空（由 `videos` 级联）

| 表 | 行数 | 说明 |
|----|------|------|
| `video_sources` | **330,838** | 播放源（每视频平均 17 条源，符合多线路采集预期） |
| `subtitles` | 0 | |
| `video_tags` | 0 | |
| `tags` | 0 | |
| `video_aliases` | **21,638** | 标题别名 |
| `video_episode_images` | 0 | |
| `video_external_refs` | 0 | |
| `video_metadata_locks` | 0 | |
| `video_metadata_provenance` | 0 | |
| `user_favorites` | 0 | 试验期无用户行为数据 |
| `watch_history` | 0 | 同上 |
| `comments` | 0 | 同上 |
| `danmaku` | 0 | 同上 |
| `list_items` | 0 | 同上 |

### 2.3 保留表（执行前后行数应不变）

| 表 | 行数 | 说明 |
|----|------|------|
| `users` | 5 | 账号保留 |
| `crawler_sites` | **75** | 75 个站点配置保留（last_crawled_at 会被重置） |
| `system_settings` | 13 | 系统配置保留 |
| `home_banners` | 0 | |
| `brands` | 0 | |
| `lists` | 0 | 列表容器保留 |
| `list_likes` | 0 | |

## 三、清空量级汇总

- 直接清空：**47,975 行**（视频 19,512 + catalog 23,022 + 运行记录 4,915 + broken 18 + aliases 3,510 空其余）
- CASCADE 连带：**352,476 行**（主要来自 video_sources 330,838 + video_aliases 21,638）
- **合计：~400,451 行**
- 用户行为表：实测全部为 0，CASCADE 无副作用

## 四、保留层影响

- `crawler_sites.last_crawled_at` / `last_crawl_status` 会重置为 NULL
- 下一轮采集将重新建立 `crawler_runs` → `crawler_tasks` → `crawler_task_logs` 链条
- `media_catalog` 清空后，`media_catalog_aliases` 也清空（FK CASCADE）；下一次采集/豆瓣导入时重建

## 五、风险与回退

- **不可逆**：DELETE 无回滚窗口，事务一经 COMMIT 即生效
- **回退方式**：无（需 DB 备份外部恢复）
- **并发风险**：执行期间若 crawler 正在运行 → 事务会锁等待或冲突；**执行前应停止所有 crawler**
  - 停止命令：`npm run stop-all-crawls`（如仍运行）

## 六、执行前检查清单

- [ ] 所有 crawler 已停止（`npm run stop-all-crawls` 或手动确认）
- [ ] 本地 DB 非生产库（`DATABASE_URL` 指向 localhost / dev 实例）
- [ ] 用户已 review 本报告 §2 行数
- [ ] 用户已确认接受 `video_sources` 330,838 行、`video_aliases` 21,638 行连带清空
- [ ] 用户已确认接受用户行为表为 0 行（本次实测），即使未来有数据也接受 CASCADE 清空

## 七、执行记录

| 时间（UTC） | 模式 | 结果 | commit |
|------|------|------|--------|
| 2026-04-22 11:48 | dry-run | OK（行数见 §2） | 本次 commit |
| 2026-04-22 11:54 | **execute** | **✅ 成功（事务已提交）** | 本次 commit |

### 7.1 Execute 执行明细

- 事务包裹：`BEGIN ... COMMIT`
- 用户：wufazhuce.usa@gmail.com（本地 dev 环境）
- 触发：用户手动"执行"确认

### 7.2 DELETE 明细（按执行顺序）

```
  跳过 source_health_events（已为空）
  跳过 video_state_watchdog_runs（已为空）
  DELETE FROM "broken_image_events"        → 18 rows
  跳过 external_imdb_tmdb_links（已为空）
  跳过 external_douban_movies_raw（已为空）
  跳过 external_tmdb_movies_raw（已为空）
  跳过 external_bangumi_subjects_raw（已为空）
  跳过 external_import_batches（已为空）
  跳过 external_data.douban_people（已为空）
  跳过 external_data.douban_entries（已为空）
  跳过 external_data.bangumi_entries（已为空）
  DELETE FROM "crawler_task_logs"          → 4,560 rows
  DELETE FROM "crawler_tasks"              → 319 rows
  DELETE FROM "crawler_runs"               → 36 rows
  DELETE FROM "videos"                     → 19,512 rows  （CASCADE 清 video_sources 330,838 / video_aliases 21,638 等）
  DELETE FROM "media_catalog_aliases"      → 3,510 rows
  DELETE FROM "media_catalog"              → 19,512 rows
  UPDATE crawler_sites SET last_crawled_at=NULL  → 75 rows
```

### 7.3 Before → After 对比

**目标清空表**（全部 → 0）：

| 表 | Before | After |
|----|--------|-------|
| `broken_image_events` | 18 | 0 |
| `crawler_task_logs` | 4,560 | 0 |
| `crawler_tasks` | 319 | 0 |
| `crawler_runs` | 36 | 0 |
| `videos` | 19,512 | 0 |
| `media_catalog_aliases` | 3,510 | 0 |
| `media_catalog` | 19,512 | 0 |
| 其余目标表 | 0 | 0 |

**CASCADE 连带表**（全部 → 0）：

| 表 | Before | After |
|----|--------|-------|
| `video_sources` | 330,838 | 0 |
| `video_aliases` | 21,638 | 0 |
| 其余级联表 | 0 | 0 |

**保留表**（不变）：

| 表 | Before | After |
|----|--------|-------|
| `users` | 5 | 5 ✅ |
| `crawler_sites` | 75 | 75 ✅ |
| `system_settings` | 13 | 13 ✅ |
| `home_banners` | 0 | 0 ✅ |
| `brands` | 0 | 0 ✅ |
| `lists` | 0 | 0 ✅ |
| `list_likes` | 0 | 0 ✅ |

### 7.4 副作用

- `crawler_sites.last_crawled_at` / `last_crawl_status` 已重置（75 个站点全部）
- 下一轮采集从零开始，可在新的 `VideoType` / `VideoGenre` 枚举 + P0 修复（CRAWLER-05~06 / ADMIN-13~14）上线后触发

## 八、关联文档

- `docs/video_ingest_source_and_moderation_audit_20260422.md`（触发 audit）
- `docs/task-queue.md` SEQ-20260422-BUGFIX-01 第 2 张（CHORE-05）
- `scripts/clear-crawled-data.ts`（执行脚本）
