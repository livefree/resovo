# 视频采集入库、播放源线路与审核标签问题审计

日期：2026-04-22

## 背景

本次审计围绕三组已暴露的问题展开：

1. 视频审核时发现，同一视频实际可能聚合来自多个源站的多条线路，但界面几乎总是只显示一个源站。
2. 采集视频在苹果 CMS 标准字段到平台入库字段的映射上存在缺口，导致视频类型识别差、分类信息不足。
3. 视频审核区“分类标签”设计为多选，但实际人工操作表现异常：视觉上像只能保留一个选中项，且无法可靠取消，提示始终为“已保存”。

本文档按问题域整理现象、代码定位、根因判断、影响范围与修复建议。

## 一、视频线路与源站显示问题

### 1.1 现象

- 同一视频可能聚合来自多个源站的线路，但审核区播放器预览中只显示一个源站。
- 个别视频存在“播放器预览显示 3 条线路，源健康显示 4 条线路”的不一致。
- 某些预览中可见的线路实际已失效，而源健康区还能看到额外历史线路。

### 1.2 现有设计状态

系统已经引入了“播放源行级源站标识”：

- 迁移 [046_video_sources_source_site_key.sql](/Users/livefree/projects/resovo/apps/api/src/db/migrations/046_video_sources_source_site_key.sql:1) 为 `video_sources` 新增 `source_site_key`
- 迁移目的已经明确写出：避免使用 `videos.site_key` 这种视频级源站字段推导线路所属站点，造成跨站聚合视频显示错误

公开播放源查询也已经接入该设计：

- [apps/api/src/db/queries/sources.ts](/Users/livefree/projects/resovo/apps/api/src/db/queries/sources.ts:64)
- `findActiveSourcesByVideoId()` 使用 `COALESCE(vs.source_site_key, v.site_key)` 关联 `crawler_sites`

采集入库主链路也会写入行级源站：

- [apps/api/src/services/CrawlerService.ts](/Users/livefree/projects/resovo/apps/api/src/services/CrawlerService.ts:226)
- `sourceMappings` 写入 `sourceSiteKey: siteKey ?? null`

### 1.3 实际问题定位

#### 问题 A：后台 `/admin/sources` 仍然使用视频级 `v.site_key`

后台源列表查询没有真正切到行级源站：

- [apps/api/src/db/queries/sources.ts](/Users/livefree/projects/resovo/apps/api/src/db/queries/sources.ts:293)
- [apps/api/src/db/queries/sources.ts](/Users/livefree/projects/resovo/apps/api/src/db/queries/sources.ts:315)

具体表现：

- `filters.siteKey` 仍按 `v.site_key` 过滤
- 排序 `site_key` 仍按 `v.site_key`
- 返回字段 `site_key` 仍直接来自 `v.site_key`

而审核区播放器预览又直接消费 `/admin/sources` 的返回结果：

- [apps/server/src/components/admin/moderation/ModerationDetail.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationDetail.tsx:99)
- [apps/server/src/components/admin/moderation/ModerationDetail.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationDetail.tsx:173)

因此，即使单条 `video_sources` 已经有不同的 `source_site_key`，审核区仍会把所有线路都显示成视频级主站点。

这是“多线路只显示一个源站”的直接原因。

#### 问题 B：审核区按 `source_name` 聚合线路，未把“线路”和“行级源站”一起建模

审核区播放器预览的线路分组逻辑：

- [apps/server/src/components/admin/moderation/ModerationDetail.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationDetail.tsx:173)

当前实现只按 `source_name` 分组：

- `key = row.source_name?.trim() || '默认线路'`

这意味着：

- 若不同源站恰好使用相同线路名，会被错误合并
- 线路组的 `siteKey` 仅取该组第一条记录的 `site_key`
- 聚合粒度仍不够严格

#### 问题 C：同站点全量替换逻辑写错了匹配列

采集链路的“同站点全量替换”应该按站点维度替换旧源，但当前实现错误使用了 `source_name = siteKey`：

- [apps/api/src/db/queries/sources.ts](/Users/livefree/projects/resovo/apps/api/src/db/queries/sources.ts:588)

问题在于：

- `source_name` 是线路名，例如 `线路1`、`jsm3u8`、`subyun`
- `siteKey` 是源站 key，例如 `bfzym3u8`、`lzzy`、`jyzy`

两者不是同一维度。

结果：

- 同站点重采时无法正确匹配旧线路
- 不在新列表中的历史死链不会被正确软删除
- 脏旧源会残留在 `video_sources`

这正是“源健康多出一条线路”“历史失效线路残留”的高概率根因。

#### 问题 D：补源路径漏传 `sourceSiteKey`

补源服务构造 `sourceMappings` 时未带 `sourceSiteKey`：

- [apps/api/src/services/CrawlerRefetchService.ts](/Users/livefree/projects/resovo/apps/api/src/services/CrawlerRefetchService.ts:95)

这会导致补源写回的新记录继续回退到 `videos.site_key` 口径，无法保留行级站点归属。

#### 问题 E：源健康与播放器预览未严格复用同一份全量数据

播放器预览会翻页拉取 `/admin/sources` 全量：

- [apps/server/src/components/admin/moderation/ModerationDetail.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationDetail.tsx:99)

源健康区只取第一页 `limit=100`：

- [apps/server/src/components/admin/moderation/ModerationSourceBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationSourceBlock.tsx:69)

这不是本次案例最主要的根因，但属于结构性隐患：

- 长剧、多源、脏数据较多时，会进一步放大显示不一致

### 1.4 影响

- 审核人员无法准确判断每条线路真实来源
- “按站点筛选/验源”口径错误，可能误伤或漏掉跨站聚合视频中的线路
- 历史失效线路残留会污染源健康、播放器预览和后续补源判断

### 1.5 修复建议

优先级建议：

1. 后台 `/admin/sources` 全面切换到 `COALESCE(s.source_site_key, v.site_key)`
2. `replaceSourcesForSite()` 改为按 `source_site_key` 匹配旧记录，禁止再用 `source_name`
3. `CrawlerRefetchService` 补传 `sourceSiteKey: source.name`
4. 审核区线路分组从“仅按 `source_name`”改为“按 `source_name + source_site_key`”
5. 审核区两个区块复用同一份全量源数据，避免分页口径分叉

## 二、苹果 CMS 采集到入库的字段缺口

### 2.1 当前已接入字段

当前解析入口定义在：

- [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:12)

已接入字段包括：

- `vod_id`
- `vod_name`
- `vod_en`
- `vod_pic`
- `type_name`
- `vod_year`
- `vod_area`
- `vod_actor`
- `vod_director`
- `vod_writer`
- `vod_content`
- `vod_remarks`
- `vod_play_from`
- `vod_play_url`

### 2.2 主要缺口

相较于苹果 CMS 常见标准字段，当前至少缺失以下重要输入：

- `type_id`
- `vod_class`
- `vod_lang`
- `vod_total`
- `vod_serial`
- `vod_version`
- `vod_state`
- `vod_note`

### 2.3 现有类型识别问题

类型识别当前只依赖 `type_name`：

- [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:153)

`TYPE_MAP` 较窄：

- [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:60)

问题表现：

- 许多站点会返回更细的分类名，例如 `国产动漫`、`日韩动漫`、`大陆综艺`、`剧情片`、`动作片`、`网络电影`
- 这些值多数不在现有映射表中
- `parseType()` 命不中就直接降级为 `other`

因此你看到的“采集的视频几乎都不能直接获得正确的视频类型”是成立的。

### 2.4 `source_category` 目前也过于粗糙

当前 `parseVodItem()` 中：

- `const rawCategory = typeName || null`
- `category: rawCategory`

见 [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:247) 到 [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:263)

也就是说：

- `source_category` 实际上只是复用了 `type_name`
- 没有单独吃入 `vod_class`
- 没有保留更细粒度的源站分类信息

这会导致后续类型矫正、题材推断、审核辅助信息都不够用。

### 2.5 题材映射也还没接入更完整的映射器

项目里已经存在更完整的 `mapSourceCategory()`：

- [apps/api/src/lib/genreMapper.ts](/Users/livefree/projects/resovo/apps/api/src/lib/genreMapper.ts:76)

但采集主链路仍在使用旧的 `parseGenre(rawCategory)` 小表：

- [apps/api/src/services/SourceParserService.ts](/Users/livefree/projects/resovo/apps/api/src/services/SourceParserService.ts:90)

结果：

- 题材补全能力偏弱
- 很多明明可以从源分类里粗推断出的题材没有落库

### 2.6 影响

- `type` 识别精度低，大量视频落入 `other`
- `source_category` 信息粒度不足
- `genres` 自动推断能力弱
- 审核区人工纠偏负担上升

### 2.7 修复建议

建议顺序：

1. 扩展 `RawVodItem`，补齐 `type_id / vod_class / vod_lang / vod_total / vod_serial / vod_version / vod_state / vod_note`
2. 重写 `parseType()`：
   - 优先结合 `type_name + vod_class`
   - 条件允许时支持站点级 `type_id -> VideoType` 映射
3. `source_category` 不再只复用 `type_name`，优先存更细的 `vod_class`
4. 采集主链路切换到 `mapSourceCategory()`
5. 补充对应单元测试，覆盖常见 CMS 分类值

## 三、审核区“分类标签”人工编辑异常

### 3.1 交互现象

审核区“分类标签”设计上是多选，但实际体验表现为：

- 视觉上像只能保留一个选中项
- 选中后再点，似乎无法取消
- 每次操作 toast 都显示“分类标签已保存”

### 3.2 前端本地逻辑本身没有问题

前端组件：

- [apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx:45)

实现方式：

- `localGenres` 维护本地选中数组
- 点击标签走 `handleGenreToggle()`
- 若已选中则 remove，未选中则 add
- 然后立即调用 `saveField({ genres: next })`

关键代码：

- [apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx:89)

因此：

- 本地多选/取消逻辑是正确的
- 问题不在按钮式 UI 取代 checkbox 这一层

### 3.3 后端真正问题：`manual` 首次保存后字段被自动锁死

审核区保存接口：

- [apps/api/src/routes/admin/moderation.ts](/Users/livefree/projects/resovo/apps/api/src/routes/admin/moderation.ts:64)

保存链路：

1. `PATCH /admin/moderation/:id/meta`
2. `VideoService.update()`
3. `MediaCatalogService.safeUpdate(..., 'manual')`

关键代码：

- [apps/api/src/services/VideoService.ts](/Users/livefree/projects/resovo/apps/api/src/services/VideoService.ts:160)
- [apps/api/src/services/MediaCatalogService.ts](/Users/livefree/projects/resovo/apps/api/src/services/MediaCatalogService.ts:169)

`safeUpdate()` 的行为：

1. 先读取 `locked_fields`
2. 已锁字段直接过滤，不参与更新
3. 如果来源是 `manual`，本次写入成功后会把这些字段再加入 `locked_fields`

对应代码：

- 过滤已锁字段：
  - [apps/api/src/services/MediaCatalogService.ts](/Users/livefree/projects/resovo/apps/api/src/services/MediaCatalogService.ts:176)
- `manual` 写入后自动加锁：
  - [apps/api/src/services/MediaCatalogService.ts](/Users/livefree/projects/resovo/apps/api/src/services/MediaCatalogService.ts:185)

这会导致：

- 第一次人工保存 `genres` 成功
- `genres` 立刻被加入 `locked_fields`
- 第二次人工编辑 `genres` 时，该字段被静默过滤，根本不再写库

### 3.4 为什么视觉上像“只能选一个”且“不能取消”

实际链路如下：

1. 用户点击标签，本地 `localGenres` 先更新
2. 前端立即发请求
3. 后端如果已锁字段，实际不写库
4. 前端仍走成功分支，toast 提示“分类标签已保存”
5. 父组件触发 `onSaved()`，重新拉取视频详情
6. 新拉回来的 `video.genres` 还是旧值
7. `useEffect(() => setLocalGenres(video.genres), [video.genres])` 把本地状态又重置回旧值

关键同步代码：

- [apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx:59)

所以表现为：

- 看起来只能保留第一次成功写入的状态
- 再次勾选或取消会“闪一下又回去”
- 提示文案和真实写入结果不一致

### 3.5 另一个认知层问题：这里编辑的是 `genres`，不是 `type`

审核区基础信息块里：

- “类型”是单选 `type`
- “分类标签”是多选 `genres`

见：

- [apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx:171)
- [apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx](/Users/livefree/projects/resovo/apps/server/src/components/admin/moderation/ModerationBasicInfoBlock.tsx:190)

因此，如果预期是“用分类标签复选改变视频主类型”，当前设计本身也不会满足该预期。

### 3.6 修复建议

建议分两步：

1. 修后端逻辑：
   - `manual` 来源应允许覆盖自己已锁的字段
   - `locked_fields` 应主要用于阻止外部低优先级来源覆盖人工结果，而不是阻止后续人工继续修改

2. 修反馈逻辑：
   - 若本次字段被锁导致未写入，接口必须显式返回“未更新”
   - 前端不得一律提示“已保存”

附加建议：

- 将“分类标签”文案明确为“题材标签”
- 避免用户将其与主类型 `type` 混淆

## 四、建议执行顺序

### P0

1. 修 `replaceSourcesForSite()` 的旧源匹配逻辑
2. 修后台 `/admin/sources` 的站点字段口径
3. 修 `CrawlerRefetchService` 漏传 `sourceSiteKey`
4. 修 `manual` 更新后字段锁死自己、却仍提示“已保存”的逻辑

### P1

1. 审核区线路分组切到“线路名 + 行级源站”
2. 审核区源健康与播放器预览统一数据源
3. 扩展 CMS 字段接入，补 `vod_class` 等
4. 扩充类型映射与题材映射

### P2

1. 优化审核区文案，将“分类标签”改为“题材标签”
2. 为源站聚合、类型识别、标签编辑失败回滚补完整测试

## 五、结论

本次问题不是单一 UI bug，而是三条链路上的模型不一致共同造成的：

- 播放源模型已经升级到“行级源站”，但后台查询与审核展示仍部分停留在“视频级源站”
- 苹果 CMS 的标准字段接入不完整，导致类型和题材识别长期偏弱
- 审核区标签编辑前端看似是多选，后端却在首次人工编辑后把字段锁死，造成“看起来能改，实际改不动”

后续修复应优先处理数据模型口径和静默失败问题，再补采集字段映射和审核交互说明。
