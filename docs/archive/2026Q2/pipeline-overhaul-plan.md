# 采集到上架全流程改造方案（Pipeline Overhaul）

> status: archived
> owner: @engineering
> scope: crawler console → auto-enrichment → moderation → staging → publish
> source_of_truth: no
> supersedes: admin_crawl_control_center_plan.md（采集控制台部分），video_management_flow_20260327.md（视频管理部分）
> superseded_by: docs/task-queue.md, docs/decisions.md
> created: 2026-04-09
> last_reviewed: 2026-04-24
>
> 本文档曾是"采集到上架"完整流水线改造的权威规范；归档后仅保留审计参考，当前执行状态以 `docs/task-queue.md` / `docs/decisions.md` 为准。

---

## 一、问题诊断（Why）

### 根本问题

| 编号 | 问题 | 影响 |
|------|------|------|
| P1 | **审核通过即上架**：`approve → public+true` 把"内容合规"和"上架就绪"混为一谈 | 分类不准、封面缺失、源失效的内容直接对用户可见 |
| P2 | **自动化程度低**：豆瓣同步纯手动、源检验无闭环、外部 DB 完全闲置 | 运营人力消耗高，内容质量无保障 |
| P3 | **采集能力受限**：无关键词搜索采集、无单视频补源、源 URL 变更无法同步 | 失效源无法自愈，特定影片无法按需补采 |
| P4 | **工作流碎片化**：审核台/视频管理/源管理三个页面无协作关系 | 运营效率低，视频生命周期管理依赖人工记忆 |
| P5 | **审核台能力不足**：不能内联编辑元数据、无批量审核、无已审核历史 | 审核单条耗时长，无法追溯 |

### 现有优势（保留不动）

- DB 状态机触发器（023 migration）：约束合法状态转换，不改
- `approved+internal+false` 状态已合法存在于状态机，只是未被充分利用
- `state-transition` 统一 API 架构完善，直接复用
- Bull 队列 Worker 架构已验证，在其上新增 Job 类型

---

## 二、核心设计原则

1. **审核通过 ≠ 上架**：审核只判断"内容是否合规"，上架判断"内容是否就绪"
2. **自动优先，人工兜底**：自动丰富/自动发布为默认路径，不满足条件才转人工
3. **闭环优先于功能数量**：每一阶段必须完整可用（输入→处理→输出→反馈），再进入下一阶段
4. **不改状态机**：所有改造在应用层和 Job 层实现，不修改 023 DB 触发器规则
5. **UI 设计：用户体验 > 实现便利**：所有涉及 UI 的任务，交互方式的选择必须以用户直观操作为第一标准，不得以"容易实现"为由选择对用户低效的方案。具体执行标准见 `docs/rules/ui-rules.md` §"后台交互设计原则"

---

## 三、五阶段流水线设计

```
┌────────────────────────────────────────────────────────────────────────┐
│  阶段 0：采集入库                                                       │
│  触发：定时批量 / 关键词搜索 / 单视频补源 / 失效源自动补采               │
│  产出：videos(pending_review+internal) + video_sources                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ 新视频（低信赖源）
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│  阶段 1：自动丰富（metadata-enrich Job，入库后 5 分钟内）               │
│  流程：本地外部DB精确匹配 → douban-adapter网络搜索 → Bangumi(anime)     │
│         → 源活性快速检验                                               │
│  产出：videos.douban_status / source_check_status 更新                 │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│  阶段 2：内容审核（人工，审核台）                                        │
│  能力：内联编辑元数据 / 豆瓣候选确认 / 源健康展示 / 批量通过暂存          │
│  决策：通过→暂存(approved+internal) / 通过→发布(admin) / 拒绝           │
│  ⚠ 改变：approve 不再直接发布，终态改为 approved+internal               │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ 通过→暂存
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│  阶段 3：质检暂存（自动+人工，暂存队列页）                               │
│  自动：auto-publish-staging Job（每30分钟）检查就绪条件后自动发布         │
│  就绪条件：豆瓣已匹配 + 至少1条源可达 + 封面不为空                       │
│  人工兜底：不满足条件的留在队列，人工处理豆瓣匹配/补源/编辑元数据         │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ 就绪（自动或手动发布）
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│  阶段 4：上架发布（approved+public+true）                              │
│  后续：verify-published-sources（每4小时）→ 失效自动下架+触发补源Job    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 四、采集控制台设计（阶段 0 详述）

### 4.1 三种采集模式

| 模式 | 触发方式 | 用途 | Job Type |
|------|---------|------|----------|
| 批量采集（现有） | 定时 / 手动全站 | 保持内容池新鲜度 | `full-crawl` / `incremental-crawl` |
| 关键词搜索采集（新增） | 手动，输入关键词+选站点 | 补采特定影视资源 | `keyword-crawl` |
| 单视频补源采集（新增） | 手动 / 系统自动（失效后） | 修复失效源 | `source-refetch` |

### 4.2 关键词搜索采集逻辑

```
输入：keyword + 目标站点列表 + 选项（是否预览、是否验活）
  ↓
对每个站点调用 ?wd={keyword} API（现有 buildApiUrl 已支持）
  ↓
previewOnly=true → 返回结果列表，不写库，用户确认后再采集
previewOnly=false → 直接入库
  ↓
结果：视频N条 + 新增源M条 + 更新源K条（同站点全量替换策略）
```

### 4.3 单视频补源采集逻辑

```
输入：targetVideoId（或 title+year 定位）+ 目标站点列表
  ↓
以视频标题为 keyword，在目标站点执行搜索采集
  ↓
匹配规则：title_normalized 相似度 >= 0.8 才认定为同一作品
  ↓
找到新源 → 同站点全量替换策略写入 video_sources
找不到 → 记录在任务结果中（not_found: true）
  ↓
若触发原因是"失效源自动补采"：
  - 成功 → 重新激活视频（unpublish 解除）
  - 失败 → 写 source_health_events(origin: 'auto_refetch_failed')
```

### 4.4 源 Upsert 策略改造

**现有**：`ON CONFLICT DO NOTHING`（同站点旧URL永不更新）

**新策略**：同站点全量替换

```
采集到视频V在站点S的源列表 [url1, url2, url3]：
  1. 查出 video_sources WHERE video_id=V AND site_key=S AND deleted_at IS NULL
  2. 新增：在新列表但不在旧列表的URL → INSERT(is_active=true)
  3. 保留：在两个列表都有的URL → 不变
  4. 移除：在旧列表但不在新列表的URL → deleted_at=now()，is_active=false
  5. 记录统计：sourcesAdded / sourcesKept / sourcesRemoved

例外配置：ingest_policy.source_update = 'append_only'（默认false）
  → 退回 ON CONFLICT DO NOTHING 行为
```

### 4.5 采集控制台页面 Tab 结构

| Tab | 功能 | 现有/新增 |
|-----|------|---------|
| 站点管理 | 站点 CRUD、ingestPolicy 配置、单站触发 | 现有 |
| 采集任务 | 任务列表（含批次展开、站点维度结果拆分） | 现有+增强 |
| **发起采集** | 三模式统一入口（批量/关键词/补源）| **新增 Tab** |
| 自动化设置 | 定时配置、冻结开关、全局止血 | 现有 |

---

## 五、自动丰富流水线设计（阶段 1 详述）

### 5.1 metadata-enrich Job 执行流程

```
触发：视频入库后 5 分钟（Bull delay）

Step 1：本地外部 DB 精确匹配（毫秒级）
  查 external_data.douban_entries WHERE title_normalized=? AND year=?
  命中且置信度高（exact match）→ 写入 douban_id + 基础字段
  douban_status = 'matched'，跳过 Step 2

Step 2：douban-adapter 网络搜索（秒级，Step 1 未命中时执行）
  置信度 >= 0.75 → 自动写入，douban_status = 'matched'
  0.45 <= 置信度 < 0.75 → 写候选，douban_status = 'candidate'
  置信度 < 0.45 → douban_status = 'unmatched'

Step 3：Bangumi 匹配（仅 type=anime 执行）
  查 external_data.bangumi_entries 补充 bangumi_id、日文标题、放送日期

Step 4：源活性快速检验（若采集时未开启 verify_sources_on_crawl）
  对新入库源批量 HEAD（超时 800ms）
  写入 source_check_status = 'ok' / 'partial' / 'all_dead'

Step 5：计算 meta_score（0-100）
  title(20) + cover_url(20) + description(20) + genres(20) + year(10) + type(10)
  写入 videos.meta_score
```

### 5.2 外部数据库层（external_data schema）

```sql
-- 独立 schema，不污染主库
CREATE SCHEMA IF NOT EXISTS external_data;

CREATE TABLE external_data.douban_entries (
  douban_id        TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  year             INT,
  media_type       TEXT,  -- movie/tv/anime
  rating           NUMERIC(3,1),
  description      TEXT,
  cover_url        TEXT,
  directors        TEXT[],
  cast             TEXT[],
  writers          TEXT[],
  genres           TEXT[],
  country          TEXT
);
CREATE INDEX ON external_data.douban_entries (title_normalized, year);

CREATE TABLE external_data.bangumi_entries (
  bangumi_id       INT PRIMARY KEY,
  title_cn         TEXT,
  title_jp         TEXT,
  title_normalized TEXT,
  air_date         DATE,
  rating           NUMERIC(3,1),
  episode_count    INT,
  summary          TEXT,
  cover_url        TEXT
);
CREATE INDEX ON external_data.bangumi_entries (title_normalized);
```

**数据来源优先级**（media_catalog 写入时）：

```
TMDB(4) > Douban(3) > Bangumi(3，anime专项) > Manual(2) > Crawler(1)
```

---

## 六、审核台重设计（阶段 2 详述）

### 6.1 核心改变

**审核 approve 终态从 `public+true` 改为 `internal+false`**

| 操作 | 旧终态 | 新终态 | 权限 |
|------|--------|--------|------|
| 通过→暂存 | `approved+public+true` | `approved+internal+false` | moderator + admin |
| 通过→直接发布 | 无 | `approved+public+true` | **admin 专属** |
| 拒绝 | `rejected+hidden+false` | 不变 | moderator + admin |

### 6.2 页面布局

```
┌─────────────────────────────────────────────────────────────────────┐
│  内容审核台                [快捷键: A=通过暂存  P=直接发布  R=拒绝  ←→切换]│
├──────────────────┬──────────────────────────────────────────────────┤
│  左侧：待审队列   │  右侧信息区（4个折叠块）                           │
│  ─────────────  │  ┌──────────────────────────────────────────────┐ │
│  筛选：类型/站点  │  │ ① 基础信息（默认展开）                        │ │
│  关键词/源状态   │  │    封面·标题（可编辑）·年份(可编辑)·类型·国家  │ │
│                  │  │    分类标签（可内联增删）                      │ │
│  每行显示：       │  │    元数据完整度：▓▓▓░ 75%                     │ │
│  · 标题（截断）   │  └──────────────────────────────────────────────┘ │
│  · 站点 badge    │  ┌──────────────────────────────────────────────┐ │
│  · 源状态        │  │ ② 豆瓣信息（状态驱动展示）                     │ │
│    ●3条/✕全失效  │  │  matched: 评分·简介·导演主演，[重新同步]       │ │
│  · 豆瓣状态      │  │  candidate: 置信度对比，[确认] [忽略] [搜索]   │ │
│    ✓已匹配       │  │  unmatched: 搜索框，从结果选择匹配              │ │
│    ?候选(0.6)    │  └──────────────────────────────────────────────┘ │
│    ✗未匹配       │  ┌──────────────────────────────────────────────┐ │
│  · 元数据 % 条   │  │ ③ 播放源列表                                  │ │
│                  │  │  线路1 [site-a] ● 可达(200ms)                │ │
│  底部：          │  │  线路2 [site-b] ✕ 失效(404)  [单独检验]       │ │
│  共47条待审      │  │  线路3 [site-c] ○ 未检验      [全部检验]       │ │
│  [批量通过暂存]  │  └──────────────────────────────────────────────┘ │
│  [批量拒绝]     │  ┌──────────────────────────────────────────────┐ │
│                  │  │ ④ 内嵌播放器（点击展开）                       │ │
│                  │  └──────────────────────────────────────────────┘ │
│                  │  ─────────────────────────────────────────────── │
│                  │  拒绝原因（预设下拉+自由文本）：                    │
│                  │  ○ 标题/封面不符  ○ 源全部失效  ○ 重复内容         │
│                  │  ○ 违规内容      ○ 其他：[_____________________] │
│                  │                                                   │
│                  │  [✓ 通过（暂存）]  [⚡ 通过并发布(admin)]  [✕ 拒绝] │
└──────────────────┴──────────────────────────────────────────────────┘
```

### 6.3 审核历史 Tab

新增第二个 Tab"已审核"：
- 展示 `review_status IN ('approved','rejected')` 的记录
- 筛选：审核员、日期范围、类型、结果
- 操作：`rejected` → [复审]（→ `pending_review+hidden`）

---

## 七、暂存队列页面设计（阶段 3 详述）

### 7.1 页面路径

`/admin/staging`（新增页面）

### 7.2 就绪状态计算

```typescript
type StagingReadiness = 'ready' | 'warning' | 'blocked'

function calcReadiness(video): StagingReadiness {
  // blocked：任何一条触发
  if (video.source_check_status === 'all_dead') return 'blocked'
  if (video.activeSourceCount === 0) return 'blocked'

  // warning：无 blocked 但有质量缺失
  if (video.douban_status === 'unmatched') return 'warning'
  if (video.douban_status === 'candidate') return 'warning'
  if (video.meta_score < 50) return 'warning'

  return 'ready'
}
```

### 7.3 自动发布规则（可配置）

存储在系统设置表（`system_settings`），key = `auto_publish_staging_rules`：

```json
{
  "enabled": true,
  "require_douban_matched": true,
  "require_active_source": true,
  "require_cover": true,
  "require_description": false,
  "min_staging_hours": 0
}
```

### 7.4 页面布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  暂存发布队列      共 23 条      [就绪 12] [需关注 8] [阻塞 3]          │
│                                                                      │
│  [一键发布全部就绪(12条)] [批量豆瓣同步] [批量源检验]                    │
│  ────────────────────────────────────────────────────────────────── │
│                                                                      │
│  筛选：[全部▼] [类型▼] [站点▼]   搜索：[______________]               │
│                                                                      │
│  标题      |类型|元数据 |豆瓣    |源健康    |暂存时长|就绪   |操作      │
│  ──────────┼────┼───────┼────────┼──────────┼────────┼───────┼────── │
│  爆裂鼓手  │电影│▓▓▓▓100│✓ 已匹配│● 3/3可达 │2小时  │✓ 就绪 │[发布]  │
│  某剧S01   │剧集│▓▓░░50%│? 候选  │● 2/3可达 │5小时  │⚠ 关注 │[处理]  │
│  某电影    │电影│▓▓░░50%│✗ 未匹配│✕ 0/2失效 │8小时  │✕ 阻塞 │[处理]  │
│                                                                      │
│  ────────────────────────────────────────────────────────────────── │
│  ▼ 自动发布规则配置                                                   │
│  ☑ 已启用自动发布     ☑ 豆瓣已匹配     ☑ 至少1条源可达                 │
│  ☑ 封面不为空         □ 简介不为空     最短暂存时间：[0] 小时           │
│  [保存规则]                                                           │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 八、源管理增强设计

### 8.1 失效闭环

```
verify-published-sources Job（每4小时）
  → 发现 is_published=true 且所有源失效
    → state-transition: unpublish（approved+internal）
    → 写 source_health_events（origin='auto_unpublish'）
    → 推送 source-refetch Job

source-refetch Job 执行
  → 成功找到新源 → state-transition: publish（approved+public+true）
  → 失败 → source_health_events（origin='auto_refetch_failed'）
           → 视频留在 approved+internal，人工处理
```

### 8.2 源管理页面新增 Tab

| Tab | 现有/新增 | 说明 |
|-----|---------|------|
| 全部源 | 现有+新增列 | 新增：所属视频状态列、距上次验证时长 |
| 失效源 | 现有+增强 | 新增：替换弹窗内嵌播放器确认、批量URL模式替换 |
| 用户投诉 | 现有 | 不变 |
| **孤岛视频** | **新增** | 替代 SourceHealthAlert，展示自动补源失败的视频 |

---

## 九、数据库新增字段（最小化）

不改状态机。仅新增辅助字段：

```sql
-- videos 表新增辅助状态字段
ALTER TABLE videos ADD COLUMN IF NOT EXISTS
  douban_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (douban_status IN ('pending','matched','candidate','unmatched'));

ALTER TABLE videos ADD COLUMN IF NOT EXISTS
  source_check_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (source_check_status IN ('pending','ok','partial','all_dead'));

ALTER TABLE videos ADD COLUMN IF NOT EXISTS
  meta_score SMALLINT NOT NULL DEFAULT 0
  CHECK (meta_score BETWEEN 0 AND 100);

-- crawler_runs 表新增采集模式字段
ALTER TABLE crawler_runs ADD COLUMN IF NOT EXISTS
  crawl_mode TEXT NOT NULL DEFAULT 'batch'
  CHECK (crawl_mode IN ('batch','keyword','source-refetch'));

ALTER TABLE crawler_runs ADD COLUMN IF NOT EXISTS
  keyword TEXT;

ALTER TABLE crawler_runs ADD COLUMN IF NOT EXISTS
  target_video_id UUID REFERENCES videos(id) ON DELETE SET NULL;
```

---

## 十、后端新增 Job 类型

| Job | 队列 | 触发方式 | 说明 |
|-----|------|---------|------|
| `keyword-crawl` | crawler-queue（复用） | 手动 | 关键词搜索采集 |
| `source-refetch` | crawler-queue（复用） | 手动/自动 | 单视频补源 |
| `metadata-enrich` | enrichment-queue（新建） | 入库后自动 | 自动丰富元数据 |
| `auto-publish-staging` | maintenance-queue（新建） | 每30分钟定时 | 暂存队列自动发布 |
| `verify-published-sources` | maintenance-queue（增强现有逻辑） | 每4小时定时 | 发布源检验+自动下架 |
| `verify-staging-sources` | maintenance-queue（增强现有逻辑） | 每8小时定时 | 暂存队列源检验 |

---

## 十一、里程碑与验收标准

### M1：核心流程修正（Phase 1 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 审核台"通过"操作终态为 `approved+internal+false`，不再直接 `public+true`
- [ ] admin 角色审核台可看到"通过并发布"按钮，moderator 看不到
- [ ] `/admin/staging` 页面可访问，展示 `approved+internal` 视频列表
- [ ] 手动点击"发布"后，视频正确变为 `approved+public+true`
- [ ] `auto-publish-staging` Job 每30分钟执行一次，满足规则的视频自动发布
- [ ] 自动发布规则可在页面配置并持久化
- [ ] 运行 `npm run typecheck && npm run lint && npm run test -- --run`，无新增失败

**风险检查点**：
- 现有已为 `approved+public+true` 的视频不受影响
- 历史 moderator 操作路径验证：approve API 的新终态是否正确写入

---

### M2：采集能力扩展（Phase 2 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 关键词搜索采集：在采集控制台输入关键词，选择2+个站点，执行后任务记录可见
- [ ] 预览模式：关键词搜索支持"仅预览不入库"，结果展示各站点匹配视频及线路数
- [ ] 单视频补源：选择已有视频，在1个以上站点执行补源，成功后源列表更新
- [ ] 同站点全量替换策略：重新采集同一视频时，旧 URL 被替换，新 URL 写入，消失的 URL 被软删除
- [ ] 采集任务详情展开：显示各站点的 sourcesAdded / sourcesKept / sourcesRemoved 统计
- [ ] 运行全量测试，无新增失败

---

### M3：自动丰富流水线（Phase 3 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] `external_data.douban_entries` 表存在且有数据（至少导入1000条测试样本）
- [ ] 新视频入库后，5分钟内 `douban_status` 从 `pending` 变为 `matched/candidate/unmatched`
- [ ] `meta_score` 字段在入库后被正确计算（0-100区间）
- [ ] `source_check_status` 字段在丰富Job执行后更新
- [ ] 本地dump命中时不发网络请求（可在任务日志中验证）
- [ ] 置信度低于0.75时正确标记为 `candidate`，不自动写入

---

### M4：审核台增强（Phase 4 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 审核台左侧列表每条显示：豆瓣状态 badge、源健康状态、元数据完整度
- [ ] 右侧可内联编辑：分类标签（增删）、年份、标题，保存后写入 media_catalog（source='manual'）
- [ ] 豆瓣候选状态：显示置信度和候选信息，可确认应用或忽略
- [ ] 豆瓣未匹配：可在审核台直接手动搜索并选择正确条目
- [ ] 批量通过暂存：选中多条，一次操作全部变为 `approved+internal`
- [ ] 审核历史 Tab：可查看已审核视频，rejected 状态可点击"复审"
- [ ] 运行全量测试，无新增失败

---

### M5：暂存队列完善（Phase 5 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 就绪/警告/阻塞三态计算正确，与实际豆瓣状态和源状态对应
- [ ] 批量豆瓣同步：选中多条，一次触发豆瓣同步 Job，完成后刷新状态
- [ ] 侧滑元数据编辑面板：不离开暂存页面，完成编辑后行状态刷新
- [ ] 触发补源采集：行级操作跳转到采集台的单视频补源模式，预填视频信息
- [ ] 自动发布规则配置：保存后立即生效，下次 Job 执行时使用新规则
- [ ] 运行全量测试，无新增失败

---

### M6：源管理闭环（Phase 6 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 失效源自动下架：verify Job 发现孤岛视频后，视频自动变为 `approved+internal`
- [ ] 自动补源触发：下架后自动推送 `source-refetch` Job
- [ ] 孤岛视频 Tab：展示自动补源失败的视频，可手动处理
- [ ] 替换源时可预播放：在替换弹窗输入新URL后，内嵌播放器加载确认可播
- [ ] 运行全量测试，无新增失败

---

### M7：视频管理整合（Phase 7 完成标志）

**验收条件**（全部满足方可通过）：
- [ ] 视频列表显示：元数据完整度列、豆瓣同步状态列（均可隐藏）
- [ ] 豆瓣状态列可一键触发同步（单条）
- [ ] `rejected` 状态视频行显示"复审"按钮
- [ ] 顶部显示暂存队列数量 badge，可点击跳转
- [ ] 运行全量测试，无新增失败

---

## 十二、各 Phase 完成后的暂停检查

每个 Milestone 达成后，执行以下检查，确认再进入下一阶段：

```
□ 当前 Phase 全部任务状态为 ✅
□ 所有验收条件逐项通过
□ 运行 npm run test -- --run，失败数未增加
□ 运行 npm run typecheck，零错误
□ 审视下一 Phase 的任务描述，确认无需根据已完成工作调整
□ 若方案设计有偏差，更新本文档对应章节，再继续
```

---

## 十三、改造范围外（明确不做）

- **不改 DB 状态机触发器**（023 migration）：应用层适配触发器规则，不绕过
- **不删除现有 API 路由**：`POST /admin/videos/:id/review` 保留，只改其内部逻辑
- **不改高信赖源的自动上架路径**：`allow_auto_publish=true` 的站点继续直接 `public+true`
- **不引入新的前端状态管理库**：继续使用 Zustand，不引入 React Query 等
- **TMDB 外部数据**：本次范围内仅使用豆瓣dump + Bangumi dump，TMDB 留给后续迭代
- **评论/评分/推荐系统**：不在本次改造范围内

---

## 十四、相关文档索引

| 文档 | 用途 |
|------|------|
| `docs/architecture.md` | DB schema 权威定义 |
| `docs/decisions.md` | 架构决策记录 |
| `docs/rules/` | 代码规范（code-style / ui-rules / api-rules / db-rules / test-rules） |
| `docs/video_state_machine_matrix_20260402.md` | 状态跃迁白名单矩阵 |
| `docs/external_metadata_import_plan_20260405.md` | 外部元数据导入方案（TMDB/Bangumi 详细设计） |
| `docs/tiered_source_verification_future_plan_20260402.md` | 源检验分级方案 |
| `external-adapter/douban-adapter/` | 豆瓣 Adapter 包（独立子项目） |
