# Resovo — 开发优先级规划（2026-03-24）

> status: reference
> owner: @engineering
> scope: 2026-03-24 priority review and decomposition reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 本文件记录 2026-03-24 开发总监优先级评审的结论与 P1 任务拆解。
> 作为后续任务排期的决策依据，不作为规范文件（勿在此追加规范）。

---

## 一、背景：当前项目状态

截至 2026-03-24，项目已完成以下工作：

| 层级 | 现状 |
|------|------|
| 爬虫基础设施 | ✅ 完整：runs/tasks 模型、watchdog、worker、scheduler |
| 数据入库 | ✅ 爬取的内容写入 PostgreSQL，`is_published = false`（默认不发布） |
| 管理后台 API | ✅ 视频 CRUD、publish/batchPublish、edit 接口均已实现 |
| 管理后台前端 | ✅ VideoTable、VideoFilters、BatchPublishBar 已实现 |
| 前端页面框架 | ✅ 首页、搜索页、详情页、播放页页面结构已存在 |
| 播放器组件 | ✅ PlayerShell、VideoPlayer、SourceBar、DanmakuBar 已实现 |
| ES 搜索同步 | ❌ **存在严重缺陷（见下方）** |
| 数据质量验证 | ❌ 从未进行过系统性审计 |
| 数据合并规则 | ⚠️ schema 已就位（title_normalized、video_aliases），但合并策略未精确定义 |
| 内容发布流程 | ⚠️ 基础能力存在，但 ES 同步断链导致发布无效 |

---

## 二、发现的关键缺陷

### BUG-001：publish 动作不触发 ES 同步（P0 阻塞）

**文件**：`src/api/services/VideoService.ts`

```
publish()       → 调用 videoQueries.publishVideo()     ← 无 indexToES()
batchPublish()  → 调用 videoQueries.batchPublishVideos() ← 无 indexToES()
batchUnpublish() → 调用 videoQueries.batchUnpublishVideos() ← 无 indexToES()

update()        → 调用 videoQueries.updateVideoMeta()  ✅ 有 indexToES()
```

**影响**：视频发布后，ES 索引未更新，搜索页无法找到已发布内容。即使管理员完成审核发布，前端搜索依然为空。

### BUG-002：爬虫写入 DB 后不触发 ES 索引

**文件**：`src/api/services/CrawlerService.ts`

爬虫将数据写入 PostgreSQL 后，没有任何 ES 索引操作。即便视频初始 `is_published=true`，ES 也不会有数据。当前只有手动编辑视频元数据时才会触发 ES 同步，形成孤岛。

---

## 三、优先级排序

```
P1  内容流通管道修复与验证       ← 当前最高优先级，阻塞全局
P2  前端用户体验链路打通         ← 高优先级，可与 P1 并行推进
P3  爬虫数据质量验证与合并规则   ← 中优先级，P1 的质量保障
P4  视频合并规则精确化           ← 可迭代，规模小时影响有限
P5  其他（ES 监控、链接存活、SEO） ← 按需排入
```

### P1 — 内容流通管道（阻塞全局）

**目标**：修复 ES 同步断链，建立"爬虫→DB→ES→前端可见"的完整通路。

**判断依据**：
- 当前所有已爬取内容均为 `is_published=false`，用户看到空站
- 即使管理员发布视频，ES 不更新，搜索页仍为空
- 前端所有页面已存在，唯独数据不通

**包含任务**：见第四章 P1 任务拆解

---

### P2 — 前端用户体验链路打通

**目标**：确保首页→搜索→详情→播放的完整用户旅程可用。

**判断依据**：
- 各页面组件已存在，但 API 数据联通性未验证
- P1 完成后需要马上验证前端是否真实可用
- UI 一致性问题（CSS 变量覆盖率、深色模式）可在此阶段统一

**主要缺口**（待 P1 完成后评估）：
- VideoGrid / HeroBanner 调用的 API 端点是否正确返回已发布数据
- SearchResultList 与 ES 的连通是否工作
- VideoDetailClient 详情数据结构是否完整（海报/简介/分集/来源）
- 播放页 PlayerLoader 能否正确解析 slug、加载可用源
- 分类浏览页（browse/movie/anime/series/variety）数据联通

---

### P3 — 爬虫数据质量验证

**目标**：在批量发布内容之前，确认爬取数据质量达到发布标准。

**核查项**：
- 字段覆盖率：title、cover_url、description、year、type 等
- title_normalized 标准化效果（TitleNormalizer 命中率）
- video_aliases 去重效果（跨站同片合并率）
- video_sources 链接实际存活率（VerifyService 工作状态）
- 源链接格式：是否为有效 m3u8/mp4 直链

---

### P4 — 数据合并规则精确化

**目标**：定义跨站同片合并策略，写入 ADR。

**现有基础**：
- `title_normalized` + `video_aliases` schema 已就位
- `TitleNormalizer` 服务存在
- `007_video_merge.sql` 已建立索引

**待决策**：
- 同名同年是否自动合并？阈值是多少？
- 跨源 metadata 以谁为准（tmdb > douban > manual > crawler）？
- 合并时封面/简介的替换规则？

---

### P5 — 其他关注点

1. **ES 索引健康监控**：ES 中有多少视频、索引延迟、mapping 是否与代码一致
2. **链接存活定时任务**：verifyWorker 的 cron 配置是否正常，is_active 字段被正确维护
3. **SEO 就绪**：详情页是否有合适的 `<title>` / `<meta>` 输出（Next.js metadata API）
4. **前端 UI 一致性**：硬编码颜色、CSS 变量覆盖盲区

---

## 四、P1 任务拆解（详细）

### 总目标

修复 ES 同步断链 → 验证管理后台发布能力 → 完成首批内容发布 → 验证端到端流通。

### 任务列表

#### CHG-160 — 修复 publish/batchPublish 缺失 ES 同步
- **类型**：Bug Fix（P0）
- **文件**：`src/api/services/VideoService.ts`
- **内容**：
  - `publish()` 在 DB 更新后调用 `void this.indexToES(id)`
  - `batchPublish()` 批量完成后，对每个已更新的 id 触发 indexToES
  - `batchUnpublish()` 同样触发（ES 需要更新 `is_published: false`）
- **DoD**：发布单条/批量后，ES 中对应文档 `is_published` 字段更新；搜索可命中

#### CHG-161 — 爬虫写入 DB 后触发 ES 异步索引
- **类型**：Feature（P0 for search completeness）
- **文件**：`src/api/services/CrawlerService.ts`、`src/api/workers/crawlerWorker.ts`
- **内容**：
  - 爬虫写入/更新视频后，通过 Bull 队列投递 ES 索引任务（不阻塞爬虫主流程）
  - 索引时机：insertCrawledVideo 成功后、updateExistingVideo 成功后
  - 注意：`is_published=false` 的视频仍需索引（管理员搜索）；前端搜索应过滤 `is_published: true`
- **DoD**：爬虫写入后，ES 中出现对应文档（无论 is_published 状态）

#### ADMIN-06 — 爬虫数据质量统计接口与管理页面
- **类型**：Feature（P1 支撑）
- **文件**：
  - `src/api/routes/admin/analytics.ts`（新增 /admin/analytics/content-quality 端点）
  - `src/app/[locale]/admin/analytics/page.tsx`（或新增 quality tab）
- **内容**：
  - 统计维度：按来源站点分组
    - 视频总数 / 已发布数 / 待审核数
    - 有封面率、有简介率、有年份率
    - 有效源比例（is_active=true 的占比）
    - 去重合并数（video_aliases 命中数）
  - 提供"按质量筛选"能力：可按字段覆盖率排序，方便人工审核
- **DoD**：管理员可在后台看到数据质量统计，能识别低质量内容站点

#### ADMIN-07 — 管理后台视频列表增加来源站点筛选
- **类型**：Feature（P1 支撑）
- **文件**：
  - `src/components/admin/videos/VideoFilters.tsx`
  - `src/api/routes/admin/videos.ts`（GET /admin/videos 增加 site_id 参数）
  - `src/api/db/queries/videos.ts`（listAdminVideos 增加 site_id 过滤）
- **内容**：
  - VideoFilters 新增"来源站点"下拉筛选
  - 可按单个爬虫站点查看其贡献的视频质量
  - 结合 ADMIN-06 的质量数据，帮助管理员决策哪些站点内容可批量发布
- **DoD**：筛选可用，与 ADMIN-06 数据一致

#### ADMIN-08 — 端对端内容流通 E2E 验证
- **类型**：Test/Validation（P1 收口）
- **内容**：
  - 编写 E2E 测试用例覆盖完整发布流：
    1. 管理员登录 → 打开 /admin/videos?status=pending
    2. 选择一条视频 → 发布
    3. 前台搜索该视频标题 → 出现在结果中
    4. 进入详情页 → 信息完整
    5. 进入播放页 → 播放器加载（源可访问时可播放）
  - 同时验证 CHG-160/161 修复效果
- **DoD**：E2E 测试全通过，或文档记录验收结果（人工验收报告）

---

## 五、P1 执行顺序与依赖

```
CHG-160（ES sync fix）
    ↓
CHG-161（Crawler ES index）
    ↓
ADMIN-06（质量统计）← ADMIN-07（站点筛选）
    ↓                       ↓
    └───────── ADMIN-08（E2E 验证）──────────┘
```

**建议执行顺序**：CHG-160 → CHG-161 → ADMIN-07 → ADMIN-06 → ADMIN-08

原因：先修复 bug（160、161），再提升管理能力（06、07），最后验收（08）。

---

## 六、P2 预规划（供 P1 完成后参考）

以下是 P1 完成后立即进入的工作，先列出以供提前准备：

| 任务 | 内容 | 估算 |
|------|------|------|
| FRONT-01 | 首页 VideoGrid / HeroBanner API 联通验证 | 小 |
| FRONT-02 | 搜索页 SearchResultList 与 ES 联通调试 | 中 |
| FRONT-03 | 视频详情页（movie/anime/series）完整度验收 | 中 |
| FRONT-04 | 播放页 slug 解析 + 源加载 + 播放验证 | 中 |
| FRONT-05 | 分类浏览页（browse）数据联通 | 小 |
| FRONT-06 | 全站 UI 一致性过审（CSS 变量/深色模式/间距） | 大 |

---

*文件创建于 2026-03-24，由开发总监评审会议输出*

---

## 七、P2 任务拆解（2026-03-25 更新）

> 基于前端代码现状审计（SEQ-20260325-01 规划前）

### P2 总评估结论

前端用户页面**功能实现 90% 以上完整**，主要页面（首页、搜索、详情、浏览、播放）均已存在，API 集成一致。  
P2 的核心任务是**质量补全与功能缺口修复**，而非从零建页面。

**关键发现：**

| 类别 | 问题 | 文件 |
|------|------|------|
| 🔴 颜色硬编码 | `#f5c518`, `#a0a0a0` 共 8 处 | HeroBanner, VideoCard, VideoCardWide, VideoDetailHero, ResultCard |
| 🟡 功能缺口 | 浏览页无分页 UI，`total` 已获取但无翻页组件 | BrowseGrid.tsx |
| 🟡 测试缺失 | 首页（HeroBanner/VideoGrid）无单元测试 | 无 |
| 🟡 测试缺失 | 详情页（VideoDetailClient）无单元测试 | 无 |
| 🟡 测试缺失 | 搜索 E2E 缺失跨页面全流程验证 | search.spec.ts 不完整 |
| 🟢 待验证 | 播放页 DanmakuBar API 联通状态未验证 | DanmakuBar.tsx |

### P2 任务列表

#### CHG-162 — 全站硬编码颜色修复
- **类型**：Bug Fix / 规范合规
- **文件**：`HeroBanner.tsx`、`VideoCard.tsx`、`VideoCardWide.tsx`、`VideoDetailHero.tsx`、`ResultCard.tsx`
- **内容**：
  - `#f5c518` → `var(--gold)`（5处）
  - `#a0a0a0` → `var(--muted-foreground)`（1处，VideoCardWide 状态徽章）
  - `rgba(0,0,0,0.7)` overlay → 保留（半透明叠加层，非颜色语义）
  - `var(--gold, #e8b84b)` 降级值 → 保留（`VideoMeta` 有意为之的降级，不改）
- **DoD**：grep `#f5c518\|#a0a0a0` 无结果；深色/浅色模式外观一致；现有测试通过

#### VIDEO-06 — 首页组件单元测试
- **类型**：Test
- **文件**：`tests/unit/components/HeroBanner.test.tsx`、`tests/unit/components/VideoGrid.test.tsx`
- **内容**：
  - HeroBanner：mock `/videos/trending`，验证 loading/有数据/无数据 三状态
  - VideoGrid：mock `/videos/trending?type=movie&...`，验证 loading 骨架屏 / 数据渲染 / 空状态
- **DoD**：测试覆盖率三状态；现有 550 tests + 新增全通过

#### VIDEO-07 — 详情页组件单元测试
- **类型**：Test
- **文件**：`tests/unit/components/VideoDetailClient.test.tsx`
- **内容**：
  - mock `GET /videos/${shortId}`，验证：loading 骨架 / notFound / 正常显示标题+类型+详情
  - 验证 slug → shortId 提取正确（`extractShortId` 已有单元测试，重点测组件状态机）
- **DoD**：测试三状态；通过 typecheck/lint/test

#### VIDEO-08 — 浏览页分页 UI
- **类型**：Feature（功能缺口补全）
- **文件**：`src/components/browse/BrowseGrid.tsx`
- **内容**：
  - `BrowseGrid` 已有 `total` 状态、`buildSearchQuery` 支持 `page` 参数
  - 在网格下方使用现有 `Pagination` 组件（`src/components/admin/Pagination.tsx` 可复用或参考）
  - 分页逻辑：读取 URL `?page=N`（已支持），`hasNext` 由 `total > page * 24` 计算
  - 点击翻页通过 `router.push()` 更新 URL `page` 参数（与 FilterArea 已有模式一致）
- **DoD**：浏览页底部有分页控件；点击下一页/上一页 URL 更新；首页 page 参数正确传给 API

#### SEARCH-05 — 搜索页 E2E 补全
- **类型**：Test
- **文件**：`tests/e2e/search.spec.ts`（补充）
- **内容**：
  - 测试场景 A：输入关键词 → 结果渲染（mock `/search`）
  - 测试场景 B：点击结果卡片 → 跳转到正确的详情页路由（`/movie/slug-shortId`）
  - 测试场景 C：MetaChip 点击（导演/演员）→ URL 参数更新
- **DoD**：E2E 测试通过；覆盖 FilterBar→结果→详情 完整链路

#### PLAYER-10 — 播放页 E2E + DanmakuBar 联通验证
- **类型**：Test + Verification
- **文件**：`tests/e2e/player.spec.ts`（补充）
- **内容**：
  - 场景 A：访问 `/watch/slug-shortId?ep=1` → 播放页正常加载（mock video + sources）
  - 场景 B：SourceBar 显示多线路 → 点击切换线路
  - 场景 C：验证 DanmakuBar 是否向 `/videos/:id/danmaku` 发起请求（或确认其实现状态）
- **DoD**：E2E 通过；DanmakuBar 联通状态文档化（有结论即可）

### P2 执行顺序

```
CHG-162（颜色修复，无依赖）
    ↓
VIDEO-06（首页测试）← VIDEO-07（详情页测试）[可并行]
    ↓
VIDEO-08（分页 UI）
    ↓
SEARCH-05（搜索 E2E）← PLAYER-10（播放 E2E）[可并行]
```

**建议顺序**：CHG-162 → VIDEO-08 → VIDEO-06 → VIDEO-07 → SEARCH-05 → PLAYER-10

原因：先修 bug（颜色），再补功能缺口（分页），最后补测试。
