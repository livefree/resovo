# SEQ-20260422-BUGFIX-01 测试覆盖矩阵

- **日期**：2026-04-22
- **任务**：CHORE-04（序列第 12 张，收官）
- **目的**：将 `docs/video_ingest_source_and_moderation_audit_20260422.md` 的验收项映射到具体测试文件与用例，供后续回归与防复发查阅。

## 一、audit §1 — 视频线路与源站显示问题

| audit 条目 | 问题 | 修复任务 | 测试文件 | 关键 case |
|-----------|------|---------|---------|----------|
| §1.3 A | `/admin/sources` 仍按 `v.site_key` 过滤/排序/返回 | ADMIN-13 (`0c237cb`) | `tests/unit/api/admin-sources-sql.test.ts` | `filter.siteKey 条件使用 COALESCE(s.source_site_key, v.site_key)`（3 case：filter / sort / SELECT 返回字段）|
| §1.3 A | — 同上 — | ADMIN-13 | `tests/unit/api/content-sort.test.ts` | `supports keyword + title + siteKey filters`（旧断言改为新 COALESCE 口径 + 防回归 `not.toMatch /v.site_key = $\d+/`）|
| §1.3 B | 审核区按 `source_name` 分组，跨站同名合并 | ADMIN-15 (`056334c`) | `tests/unit/components/admin/moderation/ModerationDetail.test.tsx` | `ADMIN-15: 不同源站的同名"线路1"按 source_name+site_key 分两组` |
| §1.3 C | `replaceSourcesForSite` 用 `source_name = siteKey` 匹配错列 | CRAWLER-05 (`e276b71`) | `tests/unit/api/crawlerSourceUpsert.test.ts` | `CRAWLER-05: SELECT 使用 COALESCE(source_site_key, v.site_key) 而非 source_name 匹配站点` + `不同站点同 source_name 不误删` |
| §1.3 D | `CrawlerRefetchService` 补源漏传 `sourceSiteKey` | CRAWLER-06 (`f8f8131`) | `tests/unit/api/sourceRefetch.test.ts` | `标题完全匹配时写入` case 的 `expect.objectContaining` 增加 `sourceSiteKey: 'site-a'` 断言 |
| §1.3 E | 两个区块一个全量、一个 limit=100 | ADMIN-16 (`588aa57`) | — 无单测，改为消费同一份 sources prop，契约级保证（typecheck 通过） | `ModerationDetail.tsx` 传 `sources` + `onRefetch`；`ModerationSourceBlock` 移除内部 fetch；10 个原 ModerationDetail case 全绿 |

## 二、audit §2 — 苹果 CMS 字段缺口

| audit 条目 | 问题 | 修复任务 | 测试文件 | 关键 case |
|-----------|------|---------|---------|----------|
| §2.1 | `RawVodItem` 缺 `type_id / vod_class / vod_lang / vod_total / vod_serial / vod_version / vod_state / vod_note` | CRAWLER-07 (`1309f14`) | `tests/unit/api/sourceParserTypeMap.test.ts` | `RawVodItem 新字段（vod_total / vod_serial 等）不会破坏解析` |
| §2.2 | 类型识别只依赖 `type_name`；`TYPE_MAP` 偏窄 | CRAWLER-07 | `tests/unit/api/sourceParserTypeMap.test.ts` | 29 条 `it.each` 覆盖电影/动漫/综艺/电视剧细分；+ `未知细分类降级 other` |
| §2.3 | 未扩展 `parseType` 接入 `vod_class + type_id` | CRAWLER-07 | `tests/unit/api/sourceParserTypeMap.test.ts` | `vodClass 首项优先于 typeName` + `多分隔符取首项` + `回落 typeName` + `空对象 → other` |
| §2.4 | `source_category` 只复用 `type_name`，无 `vod_class` | CRAWLER-08 (`656efc5`) | `tests/unit/api/sourceParserGenre.test.ts` | `parseVodItem — CRAWLER-08 source_category 优先取 vod_class`（4 case：多分隔符 / 缺失回落 / 同时决定 type 与 source_category）|
| §2.5 | 主链路仍用旧 `parseGenre(GENRE_MAP)`，未接入 `mapSourceCategory()` | CRAWLER-08 | `tests/unit/api/sourceParserGenre.test.ts` | `兜底命中 genreMapper.SOURCE_CATEGORY_MAP（豆瓣对齐新增题材：冒险/灾难/歌舞/音乐/西部/运动/体育/传记）` |

### 枚举基线对齐（META-10 前置）

| 维度 | 任务 | 测试文件 | 覆盖 |
|------|------|---------|------|
| `VideoGenre` 15→20 值 | META-10 (`bbac72a`) | `tests/unit/api/metadataEnrich.test.ts` + `stagingDouban.test.ts` | 30 case 使用 `mapDoubanGenres`，涵盖新增 adventure/disaster/musical/western/sport |
| 对齐表文档 | META-10 | `docs/video_type_genre_alignment_20260422.md` | 豆瓣 26 项题材 × 本地枚举的明确映射 |

## 三、audit §3 — 审核区"分类标签"编辑异常

| audit 条目 | 问题 | 修复任务 | 测试文件 | 关键 case |
|-----------|------|---------|---------|----------|
| §3.3 | `safeUpdate` 首次 manual 写入后字段被加入 `locked_fields`，二次 manual 编辑被静默过滤 | ADMIN-14 (`1568d3c`) | `tests/unit/api/mediaCatalogSafeUpdate.test.ts` | `manual 允许覆盖自锁字段（软锁中的 genres 被 manual 二次写入）` |
| §3.4 | 响应仍 200 成功，前端仍 toast "已保存"，实际未写库 | ADMIN-14 | `tests/unit/api/mediaCatalogSafeUpdate.test.ts` | `硬锁对 manual 也阻挡 → skippedFields` + `来源优先级低 → 全 skipped` + `非 manual 被软锁阻挡` |
| §3.4 | 前端反馈未区分"已保存" vs "被锁未保存" | ADMIN-14 | (前端契约改动) | `ModerationBasicInfoBlock.saveField` 检查 `res.skippedFields` → toast "该字段已被系统锁定，未保存" + 精细回滚 |
| §3.5/§3.6 | "分类标签"与主 type 易混 | UX-14 (`2eaa742`) | (前端文案改动) | 标题 → "题材标签" + tooltip："对应视频 genres 字段，可多选；视频主类型由上方'类型'单选决定" |

## 四、audit §五 P2 测试补完整（本卡范围）

| P2 项 | 状态 | 说明 |
|------|------|------|
| `replaceSourcesForSite` 幂等 | ✅ | `crawlerSourceUpsert.test.ts` 9 tests 覆盖全部新增 / 保留 / 移除 / 恢复软删除 / 事务回滚 / CRAWLER-05 SQL 断言 / 跨站不误删 |
| `/admin/sources` 行级口径 | ✅ | `admin-sources-sql.test.ts` (3) + `content-sort.test.ts` (L73 filter 断言) |
| `manual` 二次编辑不被锁 | ✅ | `mediaCatalogSafeUpdate.test.ts` 5 tests |
| `parseType` 分类覆盖 | ✅ | `sourceParserTypeMap.test.ts` 39 tests（含 29 条 it.each 覆盖 20+ CMS 细分类）|
| `parseGenre` 切 `mapSourceCategory` | ✅ | `sourceParserGenre.test.ts` 10 tests |
| 跨站聚合不误删 | ✅ | `crawlerSourceUpsert.test.ts` CRAWLER-05 跨站 case |

## 五、数据层重置（CHORE-05）

| 维度 | 任务 | 交付 |
|------|------|------|
| 采集/入库/外部原始数据清空 | CHORE-05 (`59a2a91`) | `docs/crawl_data_reset_20260422.md` §7 before/after 对比（40 万行清空、保留表 Before/After 核实不变）|
| 脚本幂等性 + dry-run 默认 | CHORE-05 | `scripts/clear-crawled-data.ts`（默认 dry-run，`--execute` 才清空，事务包裹）|

## 六、数量统计

- 新增测试文件：3
  - `tests/unit/api/mediaCatalogSafeUpdate.test.ts`（5 case）
  - `tests/unit/api/admin-sources-sql.test.ts`（3 case）
  - `tests/unit/api/sourceParserTypeMap.test.ts`（39 case）
  - `tests/unit/api/sourceParserGenre.test.ts`（10 case）
- 扩写测试文件：4
  - `tests/unit/api/crawlerSourceUpsert.test.ts`（+2 CRAWLER-05 case）
  - `tests/unit/api/sourceRefetch.test.ts`（+1 CRAWLER-06 断言）
  - `tests/unit/api/content-sort.test.ts`（修 ADMIN-13 锚定旧行为的 1 case）
  - `tests/unit/components/admin/moderation/ModerationDetail.test.tsx`（+1 ADMIN-15 跨站 case）
  - `tests/unit/api/metadataEnrich.test.ts`、`tests/unit/api/stagingDouban.test.ts`（ADMIN-14 返回签名适配）
- **合计本序列新增 / 扩写测试用例：≥ 60 条**
- 全量 unit：序列开始前 1380 → 结束 1440（+60）

## 七、典型回归场景（后续防复发）

1. **跨站聚合视频**：同一视频聚合 2+ 个源站，每个源站多条线路 → 审核区应按源站拆分，不误合并，跨站重采不互相影响
2. **苹果 CMS 细分类采集**：站点返回 `国产动漫`/`网络电影`/`大陆综艺` 等 → 正确识别为 `anime/movie/variety`，而非 `other`
3. **审核区题材编辑**：多次勾选/取消题材 → 持续有效写入，而非"首次即冻结"
4. **低优先级外部来源**：豆瓣/爬虫尝试覆盖已锁字段 → 被 `locked_fields` 阻挡，响应 `skippedFields` 正确报告
5. **硬锁字段**：`video_metadata_locks(hard)` 中的字段 → 任何来源（含 manual）都阻挡

## 八、关联文档

- `docs/video_ingest_source_and_moderation_audit_20260422.md`（触发 audit）
- `docs/video_type_genre_alignment_20260422.md`（META-10 对齐表）
- `docs/crawl_data_reset_20260422.md`（CHORE-05 清空报告）
- `docs/task-queue.md` SEQ-20260422-BUGFIX-01（12 张任务卡）
- `docs/changelog.md`（12 张任务的完成条目）
