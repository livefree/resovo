# 后台视频元数据增强 — 调查记录（豆瓣 / Bangumi / TMDB）

> 生成日期：2026-06-15 ｜ 分支：dev ｜ 性质：探索性调查记录（归档于 docs/audit，非 ADR/非规范文件）
> 方法：直接调用代码库已实现的 lib 函数实测，并据各自映射器（`buildCatalogFields` / `mapSubjectToCatalogFields` / step2 映射）判定字段落地。
> 后续：第五节 follow-up「TMDB 自动链路」已转入规划（详见 task-queue 后续登记的 SEQ / ADR）。

---

## 一、整体架构：自动编排 + 人工审核双轨

**自动链路**（`MetadataEnrichService` 五步，由 `CrawlerService` 爬虫入库后延迟 5 分钟入队触发，`enrichmentWorker` 消费，并发 2）：

```
Step1 本地豆瓣 dump 多字段召回（imdb_id → title_norm → alias，置信度分级）
Step2 本地无命中 → 豆瓣网络搜索（search.douban.com resolver）
Step3 type=anime → Bangumi 补充（matchAndEnrich，含角色/逐集/rich）
Step4 源 HEAD 检验（并发 5，写 source_check_status）
Step5 计算 meta_score（title/cover/desc/genres/year/type 加权，满分 100）
```

**关键结论：TMDB 完全不在自动链路里**（`MetadataEnrichService` / worker 零 tmdb 引用）。TMDB 是纯人工：moderator 经 `TabTmdb` UI → `moderation.tmdb.ts` → `TmdbConfirmService` 的 search→confirm→reject。

### 关键文件索引

| 层 | 豆瓣 | Bangumi | TMDB |
|---|---|---|---|
| lib（HTTP/数据） | `apps/api/src/lib/douban.ts` + `doubanAdapter.ts`（external-adapter/douban-adapter） | `apps/api/src/lib/bangumi.ts` | `apps/api/src/lib/tmdb.ts` + `tmdb.types.ts` |
| service | `DoubanService.ts` | `BangumiService.ts` + `.utils.ts` | `TmdbConfirmService.ts` |
| 编排（自动） | `MetadataEnrichService.ts` Step1/2 | `MetadataEnrichService.ts` Step3 → `BangumiService.matchAndEnrich` | —（无自动） |
| admin 路由 | `routes/admin/moderation.douban.ts`（5 端点） | `moderation.bangumi.ts`（5 端点） | `moderation.tmdb.ts`（3 端点） |
| 配置/凭证 | 无（公开端点） | `bangumi-config.ts` + ADR-173 框架 | `tmdb-config.ts` + ADR-173（Bearer/api_key 双路） |
| 前端审核 UI | `server-next/.../TabDouban.tsx` + `use-douban.ts` | （审核台 bangumi 区） | `server-next/.../TabTmdb.tsx` + `use-tmdb.ts` |

---

## 二、三源横向对比

| 维度 | 豆瓣 Douban | Bangumi | TMDB |
|---|---|---|---|
| 建设阶段 | 最早最成熟（CHG-385/META-05，ADR-163/186/188） | 较成熟（ADR-161/174） | **当前在建**（SEQ-20260615-01，META-38~45） |
| 数据来源 | 本地 dump + 网络 resolver | 本地 dump + REST api.bgm.tv | **仅实时 API**（CSV dump 不消费） |
| 触发方式 | 自动(Step1/2) + 手动 | 自动(Step3，仅 anime) + 手动 | **仅手动** |
| 匹配评分 | imdb_id 1.0 / title_norm 0.70 / alias 0.65 + 年份加分；≥0.85 auto、[0.60,0.85) candidate | titleNorm 本地 + REST fallback + 歧义检测 | **无自动评分**，人工搜索选择 |
| ref 落点 | `video_external_refs(douban)` | `video_external_refs(bangumi)` + bangumi_status/characters | `catalog_external_refs(tmdb)` + `video_external_refs(tmdb)` |
| 冲突模型 | 单表 match_status | 单表 + redirect 真去重(ADR-174) | exact/candidate 双态（movie/season→exact、show→candidate）+ 软降级 422 |
| 特色富集 | 23+ 字段标量 + episodes | 角色、逐集、rich detail、真去重 redirect | fields 白名单多选(10) + 多语言图片 best-pick + type 修正 + genre 拆双 |

**共性（已收敛统一）**：① 写侧统一经 `MediaCatalogService.safeUpdate`（来源优先级 + 字段锁 + skippedFields 守卫）；② 状态统一 `MetadataStatusSummary` DTO（META-32）+ admin-ui 两原语（META-33），四源同级展示，豆瓣已去特化（META-35）；③ 采集埋点统一透传 `FetchSource`。

**最显著缺口**：TMDB 无自动富集 worker 路径（changelog 多处标注「消费管线后续单独立项」）。

---

## 三、「葬送的芙莉莲」实测（2023，anime）

目标：葬送的芙莉莲 / 葬送のフリーレン / Frieren。

### 0. 可用性速览（真实环境结论）

| 源 | 本地 dump | 网络/API | 实测结果 |
|---|---|---|---|
| **TMDB** | （movies CSV，不消费 TV） | ✅ 实时 API 通 | **完整成功**（id=209867） |
| **Bangumi** | ❌ dump 仅 500 条止于 2010，无芙莉莲 | ✅ REST 通 | **完整成功**（id=400602） |
| **豆瓣** | ❌ dump 14 万条**全是 movie**、无番剧 | ❌ 搜索限流→`[]`、详情 **403 反爬** | **零产出** |

> 此环境下豆瓣三条子路径全断：Step1 本地 dump 是 movie-only 样本（番剧必 MISS）、Step2 网络搜索被限流、详情 mobile-api 被 403（无 cookie）。与 changelog「搜索访问太频繁」一致，豆瓣是三源中最脆弱的。

### 1. TMDB 版本 ✅（id=209867 / imdb tt22248376）

**已落地字段**（confirm 全选 fields 时，`buildCatalogFields`）：

| catalog 字段 | 值 | 来源 |
|---|---|---|
| title | 葬送的芙莉莲 | `name`(zh-CN) |
| title_original | 葬送のフリーレン | `original_name` |
| original_language | ja | `original_language` |
| description | 打倒了魔王的勇者一行人的后日谈…… | `overview` |
| genres | `["action","adventure","sci_fi","fantasy"]` | `genres[].id`→`mapTmdbGenres`（实测：10759 拆 action+adventure、10765 拆 sci_fi+fantasy、16 动画/18 剧情按 ADR-204 不计） |
| genres_raw | `["动画","动作冒险","剧情","Sci-Fi & Fantasy"]` | `genres[].name` |
| country | JP | `production_countries[0].iso_3166_1` |
| rating | 8.803 | `vote_average` |
| cover_url | …/1TtrtRIwXz5BB0gXEl8zgBypl9c.jpg | `images.posters` best（zh，vote 10） |
| backdrop | …/rBOnrVlck7BIlGeWVlzYiZeg4l2.jpg | `images.backdrops` best |
| logo | …/v8Mtd07kXtjJeWLCOdyTuRU1SLG.png | `images.logos` best（zh） |
| type | （仅当现 type=='other' 才写 anime 信号） | `tmdbTypeSignal(tv, genres)` |
| tmdb_id（cache） | 209867 | `id` |
| imdb_id（cache，fill-if-empty） | tt22248376 | `external_ids.imdb_id` |

**⚠️ 已获取但未使用**：
- 集数体系：`number_of_episodes`(38)、`number_of_seasons`(1)、`episode_run_time`([25])、`seasons[]`、`last_episode_to_air`(EP38)、`next_episode_to_air`、`in_production`、`status`
- 年份/日期：`first_air_date`(2023-09-29)、`last_air_date`(2026-03-27) ← TMDB **不写 year**
- 制作方：`production_companies[]`（Madhouse/TOHO/Aniplex…）、`networks[]`（**30+ 家电视台**）、`created_by`
- 外部 ID：`tvdb_id`(424536)、`wikidata_id`、`twitter_id` ← 仅 imdb_id 采
- 杂项：`popularity`、`vote_count`、`homepage`、`tagline`、`languages`/`spoken_languages`、`adult`、`type`(Scripted)
- 图片冗余：11 posters 取 1、4 logos 取 1，落选项全弃

### 2. Bangumi 版本 ✅（id=400602）

**已落地字段**（`mapSubjectToCatalogFields` + episodes + characters）：

| catalog 字段 | 值 | 来源 |
|---|---|---|
| bangumi_subject_id | 400602 | `id` |
| title | 葬送的芙莉莲 | `name_cn` |
| title_original | 葬送のフリーレン | `name` |
| description | 魔法使芙莉莲和勇者辛美尔…… | `summary` |
| cover_url | …/400602_ZI8Y9.jpg | `images.large` |
| rating | 8.5 | `rating.score` |
| rating_votes | 35242 | `rating.total` |
| release_date | 2023-09-29 | `date` |
| year | 2023 | `date` 提取 |
| director | 斎藤圭一郎 | `infobox.导演` |
| writers | 鈴木智尋 | `infobox.系列构成/脚本` |
| tags | 治愈/公路片/奇幻/…/制作:MADHOUSE | `tags` top-N + studios |
| genres / genres_raw | （`mapBangumiTags` 白名单+计数下限归一） | `tags` 全量 |
| episodes | **28 本篇**（逐集 name_cn/airdate/duration） | `getEpisodes` type=0（实测 36 集：本篇28+SP3+OP2+ED3） |
| episode_count | 28 | `subject.eps`（非 total_episodes，避免 SP/OP/ED 高估） |
| characters + CV | **91 角色**（芙莉莲→種﨑敦美/李蝉妃/李昀晴…多 CV） | `getCharacters` 全量替换 |

**⚠️ 已获取但未使用**：
- **country 实测未写入**：infobox 无显式「产地」键（产地散在 `meta_tags:["日本"]`/tags，不被 `parseInfoboxCountry` 消费）→ 按 META-41-B 保守口径不写（绝不缺省 JP）
- **别名全弃**：`infobox.别名`（Frieren: Beyond Journey's End / Sousou no Frieren / 葬送的芙莉蓮）未入库
- **infobox 绝大多数键未解析**：音乐(Evan Call)、原作(山田鐘人)、人物设定、美术设计、主题歌作曲/作词/演出(YOASOBI…)、各级制片人、分镜、演出、作画监督、OP/ED 名单 等数十键
- 评分细节：`rating.rank`(40)、`rating.count` 1–10 分布
- 收藏统计：`collection`（collect 51436 / doing 11669 / wish 6656 …）
- 杂项：`nsfw`、`platform`(TV)、`type`(2)、`total_episodes`(28，被 eps 取代)、`meta_tags`
- 逐集冗余：`desc`(日文剧情)、`comment`、`disc`、jp `name`
- 角色冗余：CV 的 `short_summary`/`career`/`images`、角色 `summary`/`images`

### 3. 豆瓣版本 ❌（已实现能力，但此环境零产出）

实测：`searchDouban('葬送的芙莉莲',2023)` → `[]`（限流）；`getDoubanDetailRich('36151692'/'35434884')` → `403 anti_crawler`。本地 dump 无番剧。**无法产出真实数据。**

代码已实现的提取能力（`SnakeCaseDoubanDetailsData` schema）：
- **会落地**（step2/syncVideo）：`douban_id`、`rate`→rating、`plot_summary`→description、`poster`→cover_url、`directors`→director、`cast`、`screenwriters`→writers、`genres`+genres_raw、`countries[0]`→country、`episodes`
- **会获取但不落地**：`year`（仅用于匹配打分）、`languages`、`episode_length`/`movie_duration`、`first_aired`、`celebrities`、`recommendations`、`actors`（独立于 cast）、`backdrop`、`trailerUrl`

---

## 四、关键洞察

1. **覆盖度**：同一部 2023 番剧，TMDB 与 Bangumi 都能富集，**豆瓣完全拿不到**——「豆瓣最脆弱」+「本地 dump 是局部样本」两个隐患在真实数据上同时爆发。
2. **各源独特强项**：Bangumi 独有逐集(28)+ 角色声优(91)；TMDB 独有多语言 best-pick 图片(zh 海报/logo)+ imdb/tvdb/wikidata 外链 + 干净 ISO country；豆瓣（理论）独有中文 `plot_summary` 与 `recommendations`。
3. **共同浪费**：三源都丢弃大量制作班底/电视台/收藏统计/别名信息——当前 catalog schema 只消费"展示必需"子集。未来若做「制作公司」「声优库」「别名搜索」，三源的 `production_companies`/`networks`/`infobox`/`别名` 都是已到手即弃的现成数据。
4. **type/genre 富集已验证**：TMDB `[16,10759,18,10765]` → `["action","adventure","sci_fi","fantasy"]` 实测证明 META-45（ADR-204 拆双）+ META-44（type 信号）正确生效。

---

## 五、候选 follow-up（未立卡，观察记录）

- **TMDB 自动富集链路**：当前 TMDB 零自动，建议接入 enrich worker Step 或独立 worker，补齐三源最大不对称。
- **本地 dump 完整性**：douban_entries movie-only（无番剧）、bangumi_entries 仅 500 条止于 2010——dump 需重新导入完整版，否则自动召回对新番/番剧长期 MISS。
- **豆瓣限流绕行**：search/detail 均被 403/限流，需 cookie 注入或代理策略（生产代码当前不注入 cookie）。
- **已到手即弃字段沉淀**：Bangumi 声优(CV)/制作公司、TMDB networks/production_companies、三源别名——若产品需要可立增量富集卡。
