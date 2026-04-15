# 稳定性修复批次方案 — 2026-04-14

> 本文档是 P0–P3 问题修复计划。在进入外部数据补全（adapter/external-db 元数据统一）讨论之前，先完成当前积累缺陷的闭环。

---

## 总览

| 优先级 | 序号 | 标题 | 任务 ID |
|--------|------|------|---------|
| P0 | A | DB ↔ ES 索引一致性修复 | CHG-401 |
| P0 | B | 前台隐藏 inactive 源 | CHG-402 |
| P0 | C | source_health_events 缺表 / 孤岛 Tab 500 | CHG-403 |
| P0 | D | 失效源聚合状态即时同步 | CHG-404 |
| P1 | — | 源站显示名称 + 线路命名重构 | CHG-405 |
| P1 | — | 源健康检验语义重构 | CHG-406 |
| P2 | — | 审核台交互修复 | CHG-407 |
| P2 | — | 自动化策略收口与观测 | CHG-408 |
| P3 | — | 测试补全 | CHG-409 |

下一个可用任务编号从 **CHG-401** 开始（当前最大 CHG-400）。

---

## 代码现状分析

### P0-A：DB ↔ ES 索引一致性

**已有实现**：
- `VideoService.indexToES(videoId)`：私有方法，每次状态变更后 `void this.indexToES(id)`（异步，不阻塞）。
- **调用点**：`create` / `update` / `publish` / `updateVisibility` / `review` / `transitionState` / `batchPublish` / `batchUnpublish`（共 8 处）。
- `StagingPublishService.indexToES(videoId)`：独立副本。
- `CrawlerService.indexToES(videoId)`：独立副本。

**问题**：
1. `indexToES` 有三份独立副本（VideoService / StagingPublishService / CrawlerService），逻辑重复。
2. 下架 / reject / hide / delete 后只 `indexToES`（更新 is_published=false），并不从 ES 删除文档。搜索端过滤靠 `is_published=true`，所以只要字段更新正确，前台搜索不会暴露下架视频。但若 ES 同步失败（silent），前台仍可通过搜索看到旧数据。
3. 没有 `removeFromES` 路径——所有入口均为 upsert，包括 delete/hide。这意味着 ES 中存在永久性垃圾数据（已删除视频的 doc 仍在 ES 中，只是 `is_published=false`）。
4. 没有对账/修复 job（reconcile-search-index）。

**方案**：

#### 步骤 1：提取共享 `VideoIndexSyncService`

新建 `src/api/services/VideoIndexSyncService.ts`，统一以下三个方法：

```ts
// 将视频 upsert 到 ES（不管当前状态，由调用方决定时机）
syncVideo(videoId: string): Promise<void>

// 从 ES 删除视频文档（用于 delete 操作）
removeVideo(videoId: string): Promise<void>

// 根据转换结果自动判断 upsert 还是 remove
syncAfterStateTransition(
  videoId: string,
  result: { is_published: boolean; visibility_status: string; review_status: string }
): Promise<void>
```

`syncAfterStateTransition` 规则：
- `is_published=true AND visibility_status='public' AND review_status='approved'` → upsert
- 其余 → upsert（保留 is_published=false 文档供管理端，不 remove）
- `deleted_at IS NOT NULL`（视频被物理删除或软删） → remove

> 短期选择：保持 upsert（更新 is_published=false），**不** remove。原因：
> - 搜索端 SearchService 已有 `{ term: { is_published: true } }` 过滤，下架视频不出现在前台搜索结果中。
> - 彻底删除会增加测试复杂度，且目前没有"前台搜到已删视频"的实际报告。
> - 等 reconcile job 落地后，再实现 remove 路径。

#### 步骤 2：接入所有变更入口

修改 `VideoService`、`StagingPublishService`、`CrawlerService`，均通过 `VideoIndexSyncService` 同步，删除各自的 `private indexToES` 方法。

需要触发同步的入口（共 10+）：
- `VideoService.create` → `syncVideo`
- `VideoService.update` → `syncVideo`（只有 published 视频）
- `VideoService.publish` / `updateVisibility` / `review` / `transitionState` → `syncVideo`
- `VideoService.batchPublish` / `batchUnpublish` → `syncVideo`（循环）
- `StagingPublishService.publishSingle` / `publishReadyBatch` → `syncVideo`
- `CrawlerService` 入库成功后 → `syncVideo`

#### 步骤 3：添加 reconcile-search-index maintenance job

新增 `MaintenanceJobType: 'reconcile-search-index'`：
1. 扫描 DB 中 `is_published=true AND visibility_status='public' AND review_status='approved' AND deleted_at IS NULL` 的视频，对每条调用 `VideoIndexSyncService.syncVideo`（仅 upsert，不 skip 已存在的）。
2. 批量大小 100，频率：每 24 小时一次（新增 24h 定时器到 maintenanceScheduler）。
3. 结果写入 stderr 日志，格式：`[maintenance-worker] reconcile-search-index: synced=N errors=M`。

> 注意：此任务只做 DB→ES 的单向同步（补索引），不扫描 ES 多出的 doc。清理孤立 doc 是低优先级，后续独立处理。

#### 验收
- approve_and_publish 后，视频立即出现在前台搜索结果（无需等待 reconcile）。
- unpublish 后，前台搜索不再返回该视频（由 SearchService filter 保证）。
- 元数据修改（标题/封面/类型）后，前台搜索结果反映新数据。
- reconcile job 每 24 小时执行，stderr 有日志输出。

---

### P0-B：前台隐藏 inactive 源

**已有实现**：
- `findActiveSourcesByVideoId` 已过滤 `is_active = true AND deleted_at IS NULL`。
- `SourceService.listSources` 调用上面的方法，行为正确。
- `GET /videos/:id/sources` 已走 SourceService → 正确过滤。

**问题**：
`findVideoByShortId` 的 `SOURCE_COUNT_SUBQUERY` 也已过滤 active sources（`WHERE video_id = v.id AND is_active = true AND deleted_at IS NULL`），前台视频详情 `sourceCount` 是 active 数量，正确。

但**前台播放器 UI** 对"所有源都 inactive"时的行为需要确认：
- 前台拿到空数组后是否显示"暂无可用播放源"而不是空的线路列表？
- 当前 `PlayerShell.tsx` 是否有空线路列表的 fallback？

**方案**：
1. 确认 API 层已正确过滤（✅ 已确认，`findActiveSourcesByVideoId` 包含过滤条件）。
2. 检查 `PlayerShell.tsx` 对空 sources 的处理。如果没有 fallback，需添加"暂无可用播放源"的空态 UI。
3. `ModerationDetail.tsx` 的线路列表也需要确认——审核台展示的是 active 源还是所有源？审核台可展示全部源（含 inactive），但要加状态标识（如"已失效"角标）。

**文件范围**：
- `src/components/player/PlayerShell.tsx`（空 sources 空态）
- `src/components/admin/moderation/ModerationDetail.tsx`（inactive 源标识）

**验收**：
- 将某视频所有源标记 inactive，前台播放页不显示可点线路，显示"暂无可用播放源"提示。
- 后台审核台仍可看到 inactive 源，但标注"已失效"。

---

### P0-C：source_health_events 缺表 / 孤岛 Tab 500

**已有实现**：
- Migration `037_source_health_events.sql` 已定义表结构和索引。
- `insertSourceHealthEvent` / `listIslandVideos` / `listOrphanVideos` / `resolveOrphanVideo` 已实现。
- `GET /admin/sources/orphan-videos` 已实现，500 的根因是 migration 未执行（表不存在）。

**问题**：
迁移文件存在但可能未在数据库中执行。需要确认 migration 执行机制：
- 查看 `MigrationService` 或服务器启动逻辑，确认是否有自动运行 migration 的机制。
- 如果是手动执行，需要说明如何确保 037 已运行。

**当前 MigrationService**：该文件是"播放源 JSON 导入导出"，与 DB schema migration 无关。项目没有自动 migration runner（migrations 需手动执行 SQL 或通过 psql 运行）。

**方案**：
1. **不改变 migration 执行机制**（手动运行 SQL 是既有方式）。
2. 在 `GET /admin/sources/orphan-videos` 路由的 catch 中，识别"表不存在"错误，返回明确的 503 而非 500：
   ```json
   { "error": { "code": "MIGRATION_PENDING", "message": "source_health_events 表尚未迁移，请运行 migration 037", "status": 503 } }
   ```
3. 在后台管理 UI 中，对 503/MIGRATION_PENDING 响应展示专用提示（"请先运行数据库迁移"），而非通用错误。

**文件范围**：
- `src/api/routes/admin/content.ts`（orphan-videos 路由错误处理）
- `src/components/admin/system/sources/`（孤岛 Tab UI 错误展示）

**验收**：
- 空库运行所有 migration 后，`/admin/sources/orphan-videos` 正常返回 `{ data: [], total: 0 }`。
- 未运行 037 时，返回 503 + 明确提示，而非 500 + 原始 SQL 错误。

---

### P0-D：失效源聚合状态即时同步

**已有实现**：
- `bulkSyncSourceCheckStatus` 可批量聚合 `video_sources.is_active` 回写 `source_check_status`。
- `syncSourceCheckStatusFromSources`（单条）在 videos.ts 中已有。
- `verifyWorker.ts` 在 `processVerifyJob` 中调用 `updateSourceActiveStatus(db, sourceId, isActive)` 后**没有**触发 `syncSourceCheckStatusFromSources`。

**问题**：
每次验证一条源后，`video_sources.is_active` 更新了，但 `videos.source_check_status` 不更新，直到下次 `bulkSyncSourceCheckStatus` 跑（`verify-staging-sources` 或 `verify-published-sources` 的前置步骤）才刷新。

**方案**：
在 `verifyWorker.ts` 的 `processVerifyJob` 中，调用 `updateSourceActiveStatus` 之后，立即调用 `syncSourceCheckStatusFromSources(db, sourceId)` 的**简化版**：

```ts
// 从 video_sources 获取 video_id，然后触发单条聚合
const row = await db.query<{ video_id: string }>(
  'SELECT video_id FROM video_sources WHERE id = $1',
  [sourceId]
)
if (row.rows[0]) {
  await syncSourceCheckStatusFromSources(db, row.rows[0].video_id)
}
```

这是同步操作，加在 worker 处理函数中（worker 已是异步队列，加一次 DB 查询不影响并发）。

**文件范围**：
- `src/api/workers/verifyWorker.ts`（processVerifyJob 末尾追加）
- `src/api/db/queries/videos.ts`（确认 syncSourceCheckStatusFromSources 接受 Pool）

**验收**：
- 单条源验证完成后，视频列表 `source_check_status` 立即从 `pending` 变为 `ok`/`partial`/`all_dead`。
- 不需要等 maintenance job 才刷新状态。

---

## P1：源站显示名称 + 线路命名重构

### 现状

**crawler_sites 表**：有 `name`（VARCHAR(200)）字段，但没有区分"内部 key"和"展示名"——当前 `key` 是如 `bfzy`、`1080zyk`，`name` 是用途模糊的字符串。

**线路显示**：`src/lib/line-display-name.ts` 有 `buildLineDisplayName`，基于 `source_name` 做正则映射（subyun → SUB云，aliyun → 阿里云等）。目前覆盖了云盘类线路名，但没有覆盖 `bfzy`、`1080zyk` 等爬虫来源标识。

**前台使用**：`PlayerShell.tsx:81` 和 `ModerationDetail.tsx:181` 均调用 `buildLineDisplayName({ rawName: s.sourceName, fallbackIndex: index })`。

### CHG-405 方案

#### 步骤 1：crawler_sites 增加 display_name 字段

新建 `src/api/db/migrations/038_crawler_sites_display_name.sql`：
```sql
ALTER TABLE crawler_sites ADD COLUMN IF NOT EXISTS display_name VARCHAR(200);
```

补充常用源站中文名（seed data）：
```sql
UPDATE crawler_sites SET display_name = '暴风资源' WHERE key = 'bfzy';
UPDATE crawler_sites SET display_name = '1080P资源' WHERE key = '1080zyk';
-- 更多...
```

同时更新 `CrawlerSite` 类型和 `DbRow` 接口，新增 `display_name` 字段，`rowToSite` 映射为 `displayName?: string | null`。

#### 步骤 2：扩展 line-display-name.ts

在 `PROVIDER_PATTERNS` 末尾追加爬虫来源映射：
```ts
{ pattern: /bfzy|暴风资源/i, label: '暴风资源' },
{ pattern: /1080zyk|1080p?资源/i, label: '1080P资源' },
// 更多...
```

并新增 `resolveSourceDisplayName(siteKey: string | null, sourceName: string | null): string` 函数：
1. 如果 siteKey 有 display_name（通过预加载的 Map），优先使用。
2. 否则 fallback 到 `normalizeProviderName(sourceName)`。
3. 否则返回"未知线路"。

#### 步骤 3：线路命名改为"源站名 + 序号"

`buildLineDisplayName` 新增参数 `siteKey?: string | null`，当有 siteKey 时，用 `resolveSourceDisplayName(siteKey, rawName)` 替代纯 `normalizeProviderName(rawName)`。

在 PlayerShell 中，sources 返回时加入 `siteKey` 字段（需要后端 API 返回）。

**API 扩展**：`findActiveSourcesByVideoId` 需要 JOIN `crawler_sites`（通过 `source_name` 匹配 site.key，或新增 `site_key` 字段到 `video_sources`）。

> 注意：`video_sources` 目前无 `site_key` 字段，需要评估是否新增。短期方案：在 `source_name` 中携带 site_key 信息（已有此惯例），`resolveSourceDisplayName` 直接用 source_name 做 key 匹配。中期方案：migration 添加 `video_sources.site_key`，由爬虫入库时写入。

**短期方案（不新增字段）**：扩展 `PROVIDER_PATTERNS`，加入常用爬虫来源 key 的映射，使 `normalizeProviderName('bfzym3u8')` → `'暴风资源'`。验证覆盖全部已知 source_name 模式。

**中期方案（推荐，单独任务）**：`video_sources` 新增 `site_key VARCHAR(100)`，crawlerWorker 入库时写入当前爬取站点的 key；前端 source 对象增加 `siteKey` 字段。这涉及 migration + 类型变更，建议独立为 CHG-405b。

#### 步骤 4：crawlerSites 管理页 display_name 可填写

更新 `crawler_sites` 创建/编辑表单，新增 `display_name` 可选字段，提示"用于前台线路名称展示"。

**文件范围（CHG-405 短期）**：
- `src/api/db/migrations/038_crawler_sites_display_name.sql`（新建）
- `src/api/db/queries/crawlerSites.ts`（DbRow + rowToSite）
- `src/types/index.ts` 或 `CrawlerSite` 类型（displayName 字段）
- `src/lib/line-display-name.ts`（扩展 PROVIDER_PATTERNS）
- `docs/architecture.md`（更新 crawler_sites schema）

**验收**：
- 配置了 display_name 的源站，前台线路显示中文名。
- 未配置的源站 fallback 到 source_name 归一化结果，再 fallback 到"未知线路"。
- `1080zyk`, `bfzym3u8` 不再直接显示在前台。

---

## P1：源健康检验语义重构

### 现状

`source_check_status` 枚举：`pending` | `ok` | `partial` | `all_dead`。

`MetadataEnrichService` 的 Step4（源 HEAD 检验）写入 `source_check_status`，但 HEAD 请求是轻量可达性检测，对防爬站点（如暴风）不可靠。

**问题**：
1. 后台将 `ok` 解释为"可播放"，`all_dead` 解释为"不可播放"，但 HEAD 失败不等于播放失败。
2. UI 文案"可播放/不可播放"误导性高。
3. 播放器实际失败事件（用户端 m3u8 拉取失败）没有单独记录路径。

### CHG-406 方案

#### 步骤 1：重命名 UI 文案（不改 DB 字段名）

保持 `source_check_status` 字段不变，只改前台/后台的展示文案：
- `pending` → "未检测"
- `ok` → "检测通过"（而非"可播放"）
- `partial` → "部分异常"
- `all_dead` → "全部异常"（而非"全部失败/不可播放"）

**文件范围**：
- `src/components/admin/videos/useVideoTableColumns.tsx`（status badge 文案）
- `src/components/admin/staging/StagingTable.tsx`（readiness 说明）
- 其他展示 source_check_status 的组件

#### 步骤 2：HEAD 失败允许 GET fallback（verifyWorker 升级）

当 HEAD 请求失败时，对 m3u8/HLS URL（`.m3u8` 后缀）追加 GET 请求：
- GET 返回 200 且 Content-Type 包含 `application/vnd.apple.mpegurl` 或 `application/x-mpegurl` → 判为 active=true。
- GET 超时或 4xx/5xx → active=false。

这样可解决"暴风资源 HEAD 不稳定但实际可播"的误判问题。

**文件范围**：
- `src/api/workers/verifyWorker.ts`（checkUrl 函数增加 GET fallback）
- `src/api/services/VerifyService.ts`（checkSourceUrl 同步修改）

#### 步骤 3：播放失败事件上报（新增 API）

新增 `POST /sources/:id/report-error` 路由（已存在，确认是否实现），记录播放端失败事件到 `source_health_events`（`origin='playback_failed'`）。

此事件不影响 `video_sources.is_active`，只用于后台"播放失败率"观测。

---

## P2：审核台交互修复

### 现状分析

**分类标签**：`ModerationDetail.tsx` 中审核台的 genres 选择 UI 需确认实现。

**豆瓣搜索**：审核台展示 `douban_status`，但审核员不熟悉内部状态名称。

**候选确认**：`douban_status='candidate'` 时应直接显示候选条目供确认。

### CHG-407 方案

#### 步骤 1：分类标签 controlled 复选

检查当前实现，如果 genres 标签点击无 controlled 效果：
- 改为 `useState<string[]>` 管理本地选中态。
- 选中时背景加深（`bg-primary text-white` 或自定义 CSS 变量），取消时恢复。
- 保存时 POST 到 catalog genres 字段。

#### 步骤 2：豆瓣搜索区域状态说明

在豆瓣区顶部，根据 `douban_status` 显示说明文案：
- `pending` → "自动匹配尚未完成，可手动搜索绑定"
- `candidate` → "系统找到疑似条目，请确认或忽略"
- `unmatched` → "未找到可靠匹配，可手动搜索"
- `matched` → "已绑定豆瓣条目，可重新搜索修正"

确认按钮文案改为"应用此豆瓣条目"，忽略按钮文案改为"标记为不匹配"。

#### 步骤 3：豆瓣写入前对比

搜索结果展示"当前值 → 豆瓣值"对比，对会覆盖的字段（封面、简介、评分）显示 diff。

**文件范围**：
- `src/components/admin/moderation/ModerationDetail.tsx`（主改文件）

---

## P2：自动化策略收口与观测

### CHG-408 方案

#### 步骤 1：后台系统页调度状态

在 `GET /admin/system/scheduler-status`（或复用现有系统接口）返回：
```json
{
  "schedulers": [
    { "name": "auto-publish-staging", "enabled": true, "intervalMs": 1800000, "nextRunAt": "..." },
    { "name": "verify-published-sources", "enabled": true, "intervalMs": 3600000, "nextRunAt": "..." },
    { "name": "verify-staging-sources", "enabled": true, "intervalMs": 28800000, "nextRunAt": "..." }
  ]
}
```

如果 `MAINTENANCE_SCHEDULER_ENABLED=false`，所有调度均 `enabled: false`，UI 显示警告横幅。

#### 步骤 2：verify-published-sources 频率文档修正

当前实现是 60 分钟，文档中部分位置写 4 小时。统一改为以代码为准：**60 分钟**，更新 docs 说明。

---

## P3：测试补全

### CHG-409 需新增的测试

1. `tests/unit/api/videoIndexSync.test.ts`（P0-A）
   - `syncVideo` 调用 ES client
   - 下架后 ES 更新 is_published=false
   - reconcile job 批量同步
   
2. `tests/unit/api/verifyWorkerSourceCheckSync.test.ts`（P0-D）
   - verify 完成后立即触发 syncSourceCheckStatus
   - source_check_status 从 pending 变为 ok/all_dead

3. `tests/unit/api/sourceHealthEvents.test.ts`（P0-C）
   - migration 表不存在时 orphan-videos 返回 503+MIGRATION_PENDING
   - orphan-videos 正常返回时结构正确

4. `tests/unit/lib/lineDisplayName.test.ts`（P1）
   - bfzym3u8 → 暴风资源
   - 1080zyk → 1080P资源
   - source_name 直接显示不含已知 key 时 fallback 正确

---

## 执行顺序

```
CHG-401 (P0-A ES 同步) 
  → CHG-402 (P0-B 前台 inactive 过滤)
  → CHG-403 (P0-C source_health_events 报错优化)
  → CHG-404 (P0-D 聚合即时同步)
  → CHG-405 (P1 线路命名)
  → CHG-406 (P1 语义重构)
  → CHG-407 (P2 审核台)
  → CHG-408 (P2 调度观测)
  → CHG-409 (P3 测试)
```

P0 四项必须先于 P1 执行，相互独立可并行讨论但建议串行执行（避免冲突）。

---

## 不在本批次范围的工作

- `video_sources` 新增 `site_key` 字段（CHG-405 中期方案，单独排期）
- 播放失败率统计看板（需要 report-error 事件积累足够数据）
- ES 清理孤立 doc（reconcile job 第二阶段）
- 外部数据补全（adapter/external-db 元数据统一）—— 下阶段讨论
