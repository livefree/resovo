# CHG-SN-7-REDO-01 Crawler 重做契约（REDO-01-A Opus 子代理产出）

> 产出日期：2026-05-18
> 模型：arch-reviewer (claude-opus-4-7) 子代理
> 输入：设计稿真源 + M-SN-7 计划 + 现有 7 组件 2188 行 + admin-ui DataTable v2 / KpiCard / Spark / AdminDropdown 类型
> 状态：**Opus 子代理 1 轮通过；主循环落地；阻塞 REDO-01-B 起步**

---

## 0. 总览

| 段 | 内容 |
|---|---|
| 1 | 6 组件 props/state/事件契约（TypeScript interface + 消费映射） |
| 2 | 5 Open Issues 裁决（明确 A/B/C 选项 + 理由） |
| 3 | 4 后端新端点契约提纲（method + path + schema + 错误码 + audit） |
| 4 | admin-ui 消费映射 |
| 5 | 削减建议 |
| 6 | 风险与依赖 |

---

## 1. 6 组件 props/state/事件契约

### 1.1 CrawlerKpiRow

```ts
/** 5 张 KPI 横排（站点 / 运行中 / 失败 / 本批视频量 / 平均时长） */
export interface CrawlerKpiRowProps {
  /** GET /admin/crawler/kpi 返回的聚合数据；null 时渲染 skeleton */
  readonly kpi: CrawlerKpiData | null
}

export interface CrawlerKpiData {
  readonly totalSites: number
  readonly healthySites: number
  readonly runningSites: number
  readonly failedSites: number        // >=3 次连续失败
  readonly batchVideoCount: number
  readonly batchVideoDelta: number    // 今日增量
  readonly avgDurationSeconds: number
}
```

**关键 state**：无内部 state；纯展示组件。
**事件**：无。
**admin-ui 消费**：`KpiCard` x5（label / value / delta / variant / dataSource）；不消费 spark / progress（设计稿 Crawler KPI 未画）。
**API 消费**：`GET /admin/crawler/kpi`（新增 / 3.1）

**设计稿 → props 映射**：

| 设计稿 KPI | variant | delta 示例 |
|---|---|---|
| 站点 40 / 33 健康 | `default` | `{ text: "33 健康", direction: "up" }` |
| 运行中 7 / 实时 | `is-warn` | `{ text: "实时", direction: "flat" }` |
| 失败 7 / ≥3 连失 | `is-danger` | `{ text: "≥3 次连失", direction: "flat" }` |
| 本批视频量 649 / +47 今日 | `is-ok` | `{ text: "+47 今日", direction: "up" }` |
| 平均时长 60s / 站点 | `default` | `{ text: "/ 站点", direction: "flat" }` |

### 1.2 CrawlerTimelineCard

```ts
export interface CrawlerTimelineCardProps {
  readonly timeline: CrawlerTimelineData | null
  /** 全局冻结状态（控制 card head pill） */
  readonly frozen: boolean
  /** 暂停实时刷新回调 */
  readonly onPauseToggle: () => void
  readonly paused: boolean
}

export interface CrawlerTimelineData {
  readonly rangeStart: string
  readonly rangeEnd: string
  readonly ticks: readonly string[]
  readonly rows: readonly CrawlerTimelineRow[]
}

export interface CrawlerTimelineRow {
  readonly siteKey: string
  readonly siteName: string
  readonly health: number          // 0-100
  readonly startPct: number        // 0-1
  readonly widthPct: number
  readonly durationSeconds: number
  readonly videoCount: number
  readonly status: 'ok' | 'warn' | 'danger'
  readonly last: string
}
```

**关键 state**：`paused` 由父组件 CrawlerClient 持有；auto-refresh interval 15s。
**事件**：`onPauseToggle`（切换暂停/恢复实时刷新）
**admin-ui 消费**：`AdminCard`（card 容器 + card__head） / `AdminButton` btn--xs（暂停按钮）；无 DataTable（时间轴是自定义 CSS grid 布局）。
**API 消费**：`GET /admin/crawler/timeline?range=1h`（新增 / 3.2）
**冻结态渲染**（Open Issue #5 裁决）：card head 右上 `pill--warn 全局冻结` 替代 `pill--ok 实时`。

### 1.3 CrawlerSiteList

```ts
export interface CrawlerSiteListProps {
  readonly sites: readonly CrawlerSite[]
  readonly loading: boolean
  readonly error: Error | null
  readonly searchKeyword: string
  readonly onSearchChange: (keyword: string) => void
  readonly onEdit: (site: CrawlerSite) => void
  readonly onDelete: (site: CrawlerSite) => void
  readonly onToggleDisable: (site: CrawlerSite) => void
  readonly onRunIncremental: (siteKey: string) => void
  readonly onRunFull: (siteKey: string) => void
  readonly onRefresh: () => void
}
```

**关键 state**：`expandedKeys: ReadonlySet<string>`（行展开状态 / 本组件自持）
**事件**：行点击 toggle `expandedKeys`；行级按钮 → 对应回调。
**admin-ui 消费**：`DataTable<CrawlerSite>` mode="client" / expandedKeys + renderExpandedRow / toolbar.search / pagination / `EmptyState/ErrorState/LoadingState`。
**API 消费**：`listCrawlerSites()`（现有）

### 1.4 CrawlerSiteRow（列定义函数）

```ts
export function buildCrawlerSiteColumns(callbacks: {
  readonly expandedKeys: ReadonlySet<string>
  readonly onEdit: (site: CrawlerSite) => void
  readonly onDelete: (site: CrawlerSite) => void
  readonly onToggleDisable: (site: CrawlerSite) => void
  readonly onRunIncremental: (siteKey: string) => void
  readonly onRunFull: (siteKey: string) => void
  readonly onCopyKey: (key: string) => void
}): TableColumn<CrawlerSite>[]
```

**9 列定义**（对齐设计稿 §2.2.4）：

| # | id | header | width | cell 渲染 |
|---|---|---|---|---|
| 1 | `chevron` | (空) | 32px | 展开 chevron（rotate 动画） |
| 2 | `status` | (空) | 32px | 8×8 dot（health 分色 + pulse） |
| 3 | `site` | 站点 | 1fr | name 13/600 + key·format mono 10 |
| 4 | `type` | 类型 | 80px | pill（sourceType） |
| 5 | `routes` | 线路 | 80px | count + "条" / "—" |
| 6 | `health` | 健康度 | 80px | 40px progress bar + 数值 |
| 7 | `weight` | 权重 | 80px | text-2 12px |
| 8 | `lastCrawl` | 最近采集 | 90px | muted 11px / relative time |
| 9 | `actions` | 操作 | 140px | 增量 btn + 全量 btn + {more} dropdown |

**{more} 菜单**（AdminDropdown，**取代批量动作 Open #2 裁决落地**）：

| key | label | danger | 说明 |
|---|---|---|---|
| `edit` | 编辑站点 | false | 打开 CrawlerSiteFormDrawer edit |
| `toggle` | 启用/禁用（动态） | false | enable/disable 行级版 |
| `copy_key` | 复制 key | false | clipboard |
| `mark_adult` | 标记成人/取消成人 | false | mark_adult/unmark_adult 行级 |
| `mark_shortdrama` | 标记短剧/标记 vod | false | mark_shortdrama/mark_vod 行级 |
| `delete` | 删除站点 | true | fromConfig 时 disabled + tooltip |

**health 计算**：CrawlerSite 类型暂无 health 字段，**前端派生**（disabled+lastCrawlStatus 三级映射）；如需精确 health 由 `GET /admin/crawler/kpi` 响应中 `siteStats[]` 补充。
**routes count**：由 `GET /admin/crawler/kpi` 响应中 `siteStats[].routeCount` 补充。

### 1.5 CrawlerSiteExpand

```ts
export interface CrawlerSiteExpandProps {
  readonly siteKey: string
  readonly siteName: string
}
```

**关键 state**：
- `routes: SourceRoute[] | null`（初次展开 lazy fetch）+ `routesLoading: boolean`
- `mappings: CategoryMappingRow[] | null`（lazy fetch）+ `mappingsLoading: boolean`
- `mapExpanded: boolean`（分类映射折叠态，默认 false）

**线路 sub-table 6 列**（对齐设计稿 §2.2.5）：

| # | header | width | cell |
|---|---|---|---|
| 1 | 线路名 | 1fr | name 12/600 + 协议 mono 10 |
| 2 | 别名 | 120px | inline-edit（dashed border / onBlur save） |
| 3 | 探测 | 70px | pill--ok/warn/danger + dot |
| 4 | 播放 | 70px | pill--ok/warn/danger + dot |
| 5 | 延迟 | 70px | `{ms}ms` 或 "—" |
| 6 | 操作 | 100px | play + refresh + trash--danger 三 btn--xs |

**分类映射 collapsible**：消费 ADR-123 `GET / PUT /admin/crawler/sites/:key/category-mapping`；展开后渲染 `sourceLabel → targetGenre` 映射行（mono 80px + 箭头 + AdminSelect）。

**事件**（REDO-01-E AMENDMENT 2026-05-19 修订 / D4）：
- 别名 inline-edit：**`PUT /admin/source-line-aliases/:siteKey/:sourceName`**（ADR-117 row 5；**admin only** — moderator 角色 UI 应隐藏/禁用 affordance / Opus 评审 Y1）
- 分类映射 save：`PUT /admin/crawler/sites/:key/category-mapping`（ADR-123）
- 线路操作按钮（play/refresh/trash）：测试播放 / 重新探测 / 删除线路 — **本 E 卡 UI 占位 disabled，留 REDO-01-E2 实施**

**API 缺口已闭环**（REDO-01-E AMENDMENT 2026-05-19）：sources 域扩 row 6 `GET /admin/sources/routes/by-site/:siteKey` 聚合端点（ADR-117 AMENDMENT 落地 / Opus 1 轮 PASS A）。`COALESCE(vs.source_site_key, v.site_key)` GROUP BY + LEFT JOIN aliases + `aggregateSignal()` 复用。

### 1.6 CrawlerAdvancedMenu

```ts
export interface CrawlerAdvancedMenuProps {
  readonly frozen: boolean
  readonly onSchedulerConfig: () => void
  readonly onReindex: () => void
  readonly onStopAll: () => void
  readonly onToggleFreeze: () => void
}
```

**AdminDropdown items**：

| key | label | danger | separator |
|---|---|---|---|
| `scheduler` | 调度配置 | false | false |
| `reindex` | 重建 ES 索引 | false | false |
| `stop_all` | 全局止血 | true | true |
| `freeze` | 开启冻结/解除冻结（动态） | false | false |

**关键 state**：`open: boolean`（dropdown 开合态）
**admin-ui 消费**：`AdminDropdown`（trigger = AdminButton variant="default" size="sm" label="高级"）
**事件**：4 回调上抛 CrawlerClient 父组件，保持与现有 CrawlerControlsCard 相同的 confirm + API call 逻辑（stopAllCrawler / triggerReindex / setCrawlerFreeze / SchedulerConfigDrawer 触发器）。

---

## 2. 5 Open Issues 裁决

### 2.1 runs 列表归属

**裁决：A — 独立路由 `/admin/crawler/runs` + sidebar 二级菜单**（用户已锁定）。

核对确认：现有 `CrawlerRunsView.tsx`（429 行）整体迁到 `apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView.tsx` + 新建 `page.tsx`。时间轴 card 不做 runs 下钻（避免双入口）。page__head 不再出现 Tab 切换。

### 2.2 批量动作去留

**裁决：A — 删除批量动作，行 `{more}` 菜单逐行操作。**

理由：
1. 设计稿未画 checkbox 列；expandable table 行点击用于 expand，selection 会产生 UX 冲突
2. DataTable v2 selection + expandedKeys 技术上可共存，但设计稿 9 列中无 checkbox 列位
3. 现有 7 种 batch action 全部可通过行级 `{more}` 菜单逐行完成（§1.4 已列对应项）
4. 站点数量 40-100，非千级，逐行操作可接受

**保留底线验证**：现有 7 种 batch action 全覆盖；`batchCrawlerSites` API 函数保留但 UI 不消费。

### 2.3 时间轴分页策略

**裁决：时间轴 top N 站（默认 8，running 优先），N 可配；站点列表 DataTable client-mode 分页。**

- **时间轴**：`GET /admin/crawler/timeline?range=1h&limit=8` 按 `status=running` 优先 + `lastCrawledAt DESC` 取 top N
- **站点列表**：`listCrawlerSites()` 一次拉全量，DataTable `mode="client"` + `pagination={{ pageSizeOptions: [25, 50, 100] }}`；未来站点超 500 时再改 server-mode
- **搜索**：站点列表 card head 内置搜索 input，client-side filter（name / key 模糊匹配）

### 2.4 高级菜单挂载

**裁决：A — PageHeader actions 第 4 个按钮 "高级" + AdminDropdown。**

PageHeader actions 从左到右：`导出 | + 新增站点 | 全站全量(primary) | 高级(dropdown)`

### 2.5 冻结状态可视化

**裁决：时间轴 card head `pill--warn 全局冻结` 替代 `pill--ok 实时`。不加全屏 banner。**

理由：时间轴是 Crawler 页最显眼的实时状态指示区；全屏 banner 与 admin-ui shell 不匹配；高级菜单 "解除冻结" 提供操作入口。

---

## 3. 4 后端端点契约提纲（REDO-01-B / ADR-122 消费）

### 3.1 GET /admin/crawler/kpi

| 字段 | 值 |
|---|---|
| Method + Path | `GET /admin/crawler/kpi` |
| Auth | adminOnly |
| Request | 无参数 |
| Response 200 | `{ data: CrawlerKpiResponse }` |
| Error codes | 401 / 403 |
| ADR-121 audit | **不需要**（只读聚合）|

```ts
interface CrawlerKpiResponse {
  totalSites: number
  healthySites: number
  runningSites: number
  failedSites: number
  batchVideoCount: number
  batchVideoDelta: number
  avgDurationSeconds: number
  siteStats: Array<{ key: string; routeCount: number; health: number }>
}
```

**实现提示**：建议独立端点，不与 `/system-status` 合并；`siteStats` 通过 JOIN `source_lines` 按 site_key GROUP BY。

### 3.2 GET /admin/crawler/timeline

| 字段 | 值 |
|---|---|
| Method + Path | `GET /admin/crawler/timeline` |
| Auth | adminOnly |
| Request query | `range: '30m' \| '1h' \| '2h' \| '6h'`（默认 `1h`）；`limit`（默认 8） |
| Response 200 | `{ data: CrawlerTimelineResponse }` |
| Error codes | 401 / 403 / 422 |
| ADR-121 audit | **不需要**（只读聚合）|

**SQL 聚合**：查 `crawler_runs` + `crawler_tasks` WHERE `started_at >= NOW() - range`，按 site_key 聚合最近一次 task 时间窗口；按 running 优先 + lastCrawledAt DESC 取 top limit。

### 3.3 POST /admin/crawler/sites/:key/run

| 字段 | 值 |
|---|---|
| Method + Path | `POST /admin/crawler/sites/:key/run` |
| Auth | adminOnly |
| Request | path `key`；query `mode: 'incremental' \| 'full'`（默认 `incremental`）|
| Response 202 | `{ data: CrawlerRun }` |
| Error codes | 401 / 403 / 404 NOT_FOUND / 409 CONFLICT（已有 running task）/ 503 |
| ADR-121 audit | **需要** |

**audit 协议**：
- actionType: `'crawler.run_create'`（复用现有）
- targetKind: `'crawler_site'`
- targetId: site key
- afterJsonb: `{ triggerType: 'single', mode, siteKeys: [key] }`

**实现提示**：内部委托 `runService.createAndEnqueueRun(triggerType='single', siteKeys=[key], mode)`；本端点是语法糖。

### 3.4 POST /admin/crawler/run-all

| 字段 | 值 |
|---|---|
| Method + Path | `POST /admin/crawler/run-all` |
| Auth | adminOnly |
| Request query | `mode: 'incremental' \| 'full'`（默认 `full`）|
| Response 202 | `{ data: CrawlerRun }` |
| Error codes | 401 / 403 / 409 / 503 |
| ADR-121 audit | **需要** |

**audit 协议**：
- actionType: `'crawler.run_create'`（复用现有）
- targetKind: `'system'`
- targetId: run ID
- afterJsonb: `{ triggerType: 'all', mode }`

**与现有端点关系**（ADR-122 必须包含）：
- `POST /admin/crawler/runs` 已支持 triggerType + siteKeys + mode；3.3 / 3.4 是 RESTful alias，内部委托 runService 不引入新 service 方法
- `GET /admin/crawler/overview` / `/system-status` / `/monitor-snapshot` 与 3.1 部分重叠；ADR-122 须声明 `/kpi` 是 Crawler 页专用（含 siteStats），不替代 monitor-snapshot

---

## 4. admin-ui 消费映射

| admin-ui 原语 | 消费组件 | 用法 |
|---|---|---|
| **KpiCard** | CrawlerKpiRow | x5；variant / delta / dataSource；不用 spark / progress |
| **DataTable v2** | CrawlerSiteList | mode=client / expandedKeys / renderExpandedRow / toolbar.search / pagination / onRowClick |
| **TableColumn\<T\>** | buildCrawlerSiteColumns | 9 列定义 |
| **AdminDropdown** | CrawlerSiteRow / CrawlerAdvancedMenu | 行级 6 项 / 高级 4 项 |
| **AdminButton** | 全组件 | btn--xs（行/线路）/ btn--sm（PageHeader）/ btn--primary（全站全量）|
| **AdminCard** | CrawlerTimelineCard | card 容器 + card__head |
| **AdminInput** | CrawlerSiteList toolbar / SiteExpand 别名 inline-edit | search / inp--sm |
| **AdminSelect** | CrawlerSiteExpand 分类映射目标 | inp--sm 下拉 |
| **Drawer** | CrawlerSiteFormDrawer（保留）/ SchedulerConfigDrawer（保留）| 480px |
| **PageHeader** | CrawlerClient | title + subtitle + 4 actions |
| **EmptyState / ErrorState / LoadingState** | CrawlerSiteList | 表格三态 |
| **useToast** | CrawlerClient | 成功 / 失败 toast |
| **Spark** | 不消费 | 设计稿 Crawler KPI 无 spark |

**Sources MatrixExpand 范式参考**：`SourcesClient.tsx:464` `expandedKeys + renderExpandedRow={(row) => <MatrixExpand .../>}` 模式直接复用。

---

## 5. 削减建议

| 子卡 | 原估时 | 建议 | 新估时 | 理由 |
|---|---|---|---|---|
| **REDO-01-B** | 0.6w | 保持 | 0.6w | 4 新端点 + ADR-122 不可压 |
| **REDO-01-C** | 0.3w | 保持 | 0.3w | 骨架含 3 区块 |
| **REDO-01-D** | 0.3w | **下调** | **0.2w** | AdminDropdown 完整能力已验证；CrawlerSiteFormDrawer 保留不改 |
| **REDO-01-E** | 0.4w | 保持 | 0.4w | 线路 sub-table + 跨模块 API 确认 + inline-edit |
| **REDO-01-F** | 0.2w | 保持 | 0.2w | ADR-123 已通过 / 分类映射 collapsible |
| **REDO-01-G** | 0.2w | **下调** | **0.1w** | 纯 AdminDropdown 4 项；现有 CrawlerControlsCard 逻辑 100% 复用 |
| **REDO-01-H** | 0.15w | 保持 | 0.15w | 迁文件 + 新建 page.tsx + sidebar 注册 |
| **REDO-01-I** | 0.05w | 保持 | 0.05w | 删除 3 文件 |
| **REDO-01-J** | 0.2w | 保持 | 0.2w | 视觉回归 + Opus 验收 |

**总节省**：0.2w（D 节省 0.1w + G 节省 0.1w）。REDO-01 总估时从 2.55w 降至约 **2.35w**。

---

## 6. 风险与依赖

### 6.1 DAG（精确依赖图）

```
A (本契约) ──────────────────────────────────────────┐
                                                     ↓
B (后端 ADR-122 + 4 端点) ─────────────────────────→ C (前端骨架)
                                                     │
                                             ┌───────┼───────┬───────┬───────┬────────┐
                                             ↓       ↓       ↓       ↓       ↓        ↓
                                             D       E       F       G       H        E2
                                          (行+菜单)(展开-读)(映射) (高级) (runs迁) (线路-写)
                                             │       │       │       │       │        │
                                             └───────┴───────┴───────┴───────┴────────┘
                                                             ↓
                                                       I (删除旧文件)
                                                             ↓
                                                       J (验收)
```

D/E/E2/F/G/H 之间无相互依赖，均仅依赖 C；E 拆分（REDO-01-A AMENDMENT 2026-05-19 / D2 拍板）：
- **E**：sources 域 GET 端点（ADR-117 AMENDMENT 已 PASS）+ 前端骨架 + alias inline-edit（复用 row 5 PUT）+ 3 actions UI 占位 disabled — 工时 **~0.35w**（Opus Y2 重估）
- **E2**：3 mutations 后端（POST .../test / POST .../reprobe / DELETE .../routes/:id）+ ADR 起草（或合并 actionType `sources.route_action` 走 ADR-121 D-121-5 4 文件框架）+ 前端 3 actions 接入 — 工时 **~0.35w**

F 依赖 ADR-123（已通过）。

### 6.2 已识别风险

| # | 风险 | 严重度 | 缓解 |
|---|---|---|---|
| 1 | timeline SQL 聚合复杂度（按 site_key 聚合时间窗口 + 百分比计算） | 中 | B 子卡先做 timeline 端点原型 + benchmark；如性能不达标降级为"最近 8 个 running task"静态列表 |
| 2 | ~~线路数据 API 缺口（SiteExpandRow 需按 siteKey 查线路，现有仅 by-videoId）~~ **已闭环 2026-05-19 / REDO-01-E AMENDMENT** | ~~中~~ | ADR-117 AMENDMENT 落地 row 6 `GET /admin/sources/routes/by-site/:siteKey`（Opus 1 轮 PASS A）|
| 3 | health 字段缺失（CrawlerSite 类型无 health） | 低 | 已裁决前端派生；后续精确 health 由 kpi 端点 siteStats 补充 |

### 6.3 与 PRE / SHARED / ADR 的关系

| 依赖项 | 状态 | 影响 |
|---|---|---|
| PRE-05 ADR-123（分类映射 schema） | Accepted A− | F 子卡可正常实施 |
| SHARED-01（KpiCard progress prop） | 已闭环 | CrawlerKpiRow 不消费 progress（设计稿 Crawler KPI 无进度），但 KpiCard 组件本身 OK |
| SHARED-02（DataTable v2 行展开） | 取消（admin-ui 已具备） | CrawlerSiteList 直接消费 |
| ADR-121（R-MID-1 7 文件框架） | 已正式化 | 3.3/3.4 写端点需要 audit 协议落地（actionType 复用 crawler.run_create） |
| ADR-100 §4.5 R7 MUST-8 | 已生效 | B 子卡必须先起 ADR-122 + Opus PASS 才能实施 4 新端点 |
| ADR-117（DataTable v2 框架扩展） | 已落地 | expandedKeys + renderExpandedRow 能力的架构依据 |

---

**结论：通过。** 本契约覆盖设计稿 §5.6 + §6.8 全部 spec 元素（§2.4 对照表 22 行），现有功能保留底线 100% 覆盖（7 组件 2188 行全部有明确归属），5 个 Open Issues 全部裁决，4 个后端端点契约完备。主循环可启动 **REDO-01-B**（后端 ADR-122 + 4 新端点实施）。
