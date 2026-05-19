# M-SN-7 设计稿对齐重做计划

> 起源：M-SN-6 milestone 关闭后用户复核发现 server-next 后台**架构性偏离设计稿**——多个页面以 v1 风格"DataTable + Tab + 外置 SelectionActionBar"实现，未对照 `docs/designs/backend_design_v2.1/reference.md` §5.x + `app/screens-2.jsx` 真源 jsx。
>
> 决策：在 M-SN-7 入口先做**全量对齐审计**，逐页删除违反实现并按设计稿重做，**首页采集控制**。
>
> 文档作者：Claude Code 主循环（执行模型 `claude-opus-4-7`）
> 起草日期：2026-05-18
> 状态：**草案，待用户审批**

---

## 0. 全局原则

### 0.1 价值排序保留（不变）

CLAUDE.md §价值排序 1–5 不动：正确性 > 边界与复用 > 可扩展性 > 一致性 > 改动收敛。
新增第 6 条隐性原则：**设计稿对齐 ≥ 现有实现 sunk cost**——即"已经实现了"不构成"不重做"的理由，只构成"功能保留底线"的清单依据。

### 0.2 重做不丢功能的硬约束

每页重做卡片必须先输出 **"功能保留清单"**（现有实现 → 重做后归属），3 种归属：

- **保留**：迁移到设计稿对应区块（标注源行号 → 目标区块）
- **重做位置**：功能保留但 UI 形态变化（如 Tab → 段落 / DataTable → Card list）
- **删除**：设计稿明确不要 / 与新 UX 冲突（必须给出删除理由）

无归属的功能点 → 默认归 **"保留"**，迁移到对应区块；如果发现设计稿没对应位置 → 写入卡片 "Open Issues" 区，由 Opus 子代理裁决。

### 0.3 子代理调用前置

每页重做卡的"实施前"必须先 spawn **arch-reviewer Opus** 完成：
1. 功能保留清单审定
2. 设计稿 → 实施的 props/state/事件 契约
3. 删除哪些原文件 / 保留哪些（避免误删共享原语依赖）

子代理产出经主循环执行，不得擅自改写决策。

### 0.4 测试守护

每页重做后：
- `npm run typecheck` + `npm run lint` PASS
- `npm run test -- --run` 全量 PASS（4018+ unit）
- `npm run test:e2e` 命中该页的 SEARCH / PLAYER / 跨页串联测试
- 视觉回归测试（admin-ui Playwright visual harness，CHG-SN-5-PRE-01-E-1 基础设施）

视觉回归测试粒度（§8.2.3 落地）：

- **默认跑**：SHARED-01 / 02 / 03 验收门 + 每张 REDO-XX-J 验收门
- **跳过**：REDO-XX 子卡 C–H 仅当快照差异 >5% 才触发（节省 CI 时长）
- **基础设施**：复用 CHG-SN-5-PRE-01-E-1 Playwright visual harness；不为本 milestone 单独引入新框架

### 0.5 回退策略（§8.3.1 落地）

REDO-XX-I 删除旧文件前必须满足：

1. **git tag**：`pre-redo-<route>-<YYYYMMDD>`（例：`pre-redo-crawler-20260520`），打在 REDO-XX-H 完成后、I 开始前
2. **删除清单核对**：REDO-XX-I 卡片 "Files to delete" 与 "Files to keep" 双列对照
3. **Rollback 命令**：每张 REDO-XX-I 卡片必须含 `Rollback` 区，记录：
   - `git checkout <pre-redo-tag> -- <path>` 还原单文件
   - `git revert <I-commit-hash>` 整段回滚（如 J 验收失败）
4. **撤销路径**：J 验收若评级 < A−，自动触发 revert + 起 RECHECK 子卡（同 M-SN-6-29-FOLLOWUP 范式）

---

## 1. 全量审计扫描（CHG-SN-7-PRE-04）

### 1.1 14 个 admin 路由的设计稿 spec 摘要 + 当前状态

| # | 路由 | 设计稿 §x | spec 摘要 | 当前状态 | 重做风险 |
|---|---|---|---|---|---|
| 1 | `/admin/dashboard` | §5.1 | page__head 问候式 + 全站全量采集 primary / AttentionCard + WorkflowCard / 4 段 progress（采集入库 / 待审核 / 暂存待发布 / 已上架） | ⚠️ **S 级 90%+ 对齐**（PRE-04 子卡 #1 2026-05-18 闭环 → 见 [audit-FULL.md §5.1](./M-SN-7-design-realign-audit-FULL.md#§51-adminsdashboard-审计pre-04-子卡-1)） | 低（3 MISC 小修补） |
| 2 | `/admin/moderation` | §5.2 | 三栏 split panes（左 ModListRow 列表 / 中详情 / 右操作） | 待审计 | 高（架构错位概率高） |
| 3 | `/admin/staging` | §5.5 | 暂存发布 | 待审计 | 中 |
| 4 | `/admin/videos` | §5.3 视频库（**表格标杆**） | DataTable + DualSignal + VisChip + Poster 32×48 + 5 InlineRowActions | ✅ CHG-DESIGN-08/12 已对齐 | 低 |
| 5 | `/admin/sources` | §5.4 | 线路矩阵 | 待审计 | 中 |
| 6 | `/admin/merge` | §5.9 | Segment + 候选 card（顶部置信度 pill / 左右视频卡对比 / 影响预览） | 待审计（部分已做 audit timeline） | 中 |
| 7 | `/admin/subtitles` | §5.14 | page head + 上传字幕 / KPI 四列 | 待审计 | 低 |
| 8 | `/admin/home` | §5.7 | 1fr/360px 编排列表 + sticky 前台预览 / Banner item 含 drag handle / 序号 / 横图 | 待审计 | 中 |
| 9 | `/admin/submissions` | §5.13 | **Card list 非表格** + 32px 状态 icon box + 引用块 + 重验/查看/处理按钮 + Segment | ❌ **CHG-SN-5-01 用 DataTable 实现，整体错位** | 高 |
| 10 | `/admin/crawler` | §5.6 + §6.8 | **page actions 3 个（导出/新增/全站全量）+ KPI 5 列 + 实时时间轴 + 站点 expandable table（含线路 / 分类映射 row expansion）** | ❌ **整体错位**（Tab + DataTable + 仅 4 按钮） | 高 |
| 11 | `/admin/image-health` | §5.8 | page head + actions（重扫所有封面 / 批量切 fallback 域）/ KPI 四列 / 1fr/1fr（破损域名条形图 + 破损样本 grid） | ⚠️ KPI 已做，缺 actions + 破损样本 grid | 中 |
| 12 | `/admin/analytics` | §5.15 | period select + 导出报表 / KPI 四列 + Spark / 主体 2fr/1fr 折线面积图 + 源类型分布 + 爬虫最近任务次表 | ⚠️ 已 redirect 到 `/admin?tab=analytics`，占位 | 高（整页未做） |
| 13 | `/admin/users` | §5.10 | page head + 角色矩阵 / 邀请用户 actions / KPI 四列 | 待审计 | 中 |
| 14 | `/admin/settings` | §5.11 | 180px/1fr 左 vertical tab + 右 card 内容 / 4 个 tab 示例（Basic/Douban/Filter/Images）vs **plan §6 8 类** | ⚠️ 已用 SettingsContainer 但 plan §6 8 类口径未对齐 | 中 |
| 15 | `/admin/audit` | §5.12 | page head + 导出 + **时间穿梭** / Filter bar：搜索 + 用户/类型/时间 chip + 总数 | ⚠️ 缺时间穿梭 + 总数 | 低 |
| 16 | `/admin/login` | §5.16 | 登录 card | 待审计 | 低 |

### 1.2 PRE-04 拆解

- **PRE-04** 总卡：审计 16 路由（含 login），输出每条 ✅/⚠️/❌ 标记 + 偏离项分级
- 拆解：每路由独立子卡 0.05w
- 产出：`docs/M-SN-7-design-realign-audit-FULL.md`（全量审计报告）
- 估时：0.05w × 16 + 0.1w Opus 收尾 = **0.9w**
- 前置：本计划文档审批通过
- **审计基准**（用户决策 2026-05-18）：**commit 实测为准**。`reference.md §5.x.N` 自评段（如 §5.1.4）当辅助参考；与 commit 现状不符时自动忽略 reference 自评（已发现首例：§5.1.4 自评 dashboard "未复刻" 但 commit CHG-DESIGN-07 7C 已远超）。
- **模型路由**（§8.3.3 落地）：
  - **Sonnet 主循环**逐路由扫描，产出 ✅ / ⚠️ / ❌ 标签 + 偏离项分级（每条 0.05w）
  - **末尾单次 spawn Opus**：对全部 ❌ 项做架构归类 + 重做优先级排序，输出 `REDO-NN` 卡片优先级清单（0.1w）
  - **不逐路由 spawn Opus**——避免 Opus 调用成本浪费在低分歧的 ✅ 项

---

## 2. 采集控制（Crawler）重做详细对照清单

### 2.1 设计稿真源行号

- 文字 spec：`docs/designs/backend_design_v2.1/reference.md` §5.6（行 623–631） + §6.8（行 846–851）
- JSX 真源：`docs/designs/backend_design_v2.1/app/screens-2.jsx` `CrawlerView` 组件，行 333–524
- 站点 mock 数据：`docs/designs/backend_design_v2.1/app/icons-data.jsx` `SITES`，行 90–101
- 线路展开 mock：`screens-2.jsx` `SITE_ROUTES`，行 241–245（被 `SiteExpandRow` 行 283–331 消费）

### 2.2 设计稿 spec 完整清单

#### 2.2.1 page__head
| 元素 | spec |
|---|---|
| title | `采集控制` |
| sub | `{N} 个站点 · 实时任务时间轴 · 一键诊断失败源 · 展开查看线路/分类映射` |
| action 1 | `{download icon} 导出` |
| action 2 | `+ 新增站点` |
| action 3 | `{zap icon} 全站全量`（**primary**） |

#### 2.2.2 KPI 五列（顶部）
| 列 | label | value 示例 | delta | variant |
|---|---|---|---|---|
| 1 | 站点 | 40 | 33 健康 | `is-up` |
| 2 | 运行中 | 7 | 实时 | `is-warn` |
| 3 | 失败 | 7 | ≥3 次连失 | `is-danger` |
| 4 | 本批视频量 | 649 | +47 今日 | `is-ok` |
| 5 | 平均时长 | 60s | / 站点 | 默认 |

#### 2.2.3 实时任务时间轴 card（全宽）
| 元素 | spec |
|---|---|
| card__head | `实时任务时间轴` + 右上 `pause` 按钮 + `pill--ok` 实时（`dot pulse`） |
| 时间刻度行 | 00:00 / 00:15 / ... / NOW（accent 色） |
| 每行（站点）布局 | `140px name + flex 1 progress bar + 70px last` |
| 站点名 | `12px / 600 weight` + 状态 dot（`ok/warn/danger` + `pulse-dot 1.6s`） |
| 任务窗口 | `<status>-soft` 背景 + `<status>` 边框 + 内显 `{dur}s · {n} 视频` |
| 数据范围 | 取前 8 个站点（设计稿 `SITES.slice(0,8)`） |

#### 2.2.4 站点 expandable table card
| 元素 | spec |
|---|---|
| card__head | `站点列表` + `点击行展开查看线路 / 分类映射` + 右上 `搜索 input (w=200, h=30)` + `{filter} 筛选` 按钮 |
| 表格列（9 列） | `32px chevron + 32px status dot + 1fr 站点(name+key+format) + 80px 类型 pill + 80px 线路 count + 80px 健康度 bar + 80px 权重 + 90px 最近采集 + 140px 操作` |
| 表头样式 | `padding:7px 14px / bg3 / 10px 600 muted / uppercase / letter-spacing .5` |
| 行样式 | `padding:9px 14px / 展开行 bg=accent-soft / cursor:pointer / transition:bg .1s` |
| Chevron | `▸` 展开时 `rotate(90deg)`，transition .15s |
| Status dot | `8×8 / 50%` / on 时按 health 分色（`>80 ok / >50 warn / 其他 danger`） / on+health>80 时 `pulse-dot 1.6s` / off 时 `muted-2` |
| 站点单元 | name `13/600` + 行下 `key · format` mono `10 muted` |
| 类型 pill | `pill`（`.dot` + type 文本） |
| 线路 count | `{n} 条`（n=0 时 `—`） |
| 健康度 | 40px 进度条 + 数值，颜色按 health 分段 |
| 权重 | text-2 12px |
| 最近采集 | muted 11px |
| 操作 | 3 按钮：`{zap} 增量` + `全量` + `{more}`（事件 stopPropagation） |
| 展开行 | 内嵌 `<SiteExpandRow>`：**线路 / 别名 sub-table** + **分类映射 collapsible** |

#### 2.2.5 SiteExpandRow（行展开内容）
| 区块 | spec |
|---|---|
| 线路标题 | `线路 / 别名` accent 11/700 uppercase + `{n} 条` muted + 右上 `+ 添加线路` |
| 线路 sub-table | 6 列：`1fr 线路名 + 120px 别名(可编辑) + 70px 探测 pill + 70px 播放 pill + 70px 延迟 + 100px 操作` |
| 线路行 | name 12/600 + 协议 mono 10 muted / 别名 inline-edit dashed border / 探+播 pill + dot / 延迟 `{ms}ms` 或 `—` / 操作 3 按钮 `play / refresh / trash--danger` |
| 分类映射 collapsible | 标题 `分类映射` text-2 11/700 + chevron `▾/▴` / 展开后 `{源分类} → {目标分类}` 行（mono 80px + → + select 或 text） |

### 2.3 现有实现完整功能清单（不能丢）

#### 2.3.1 路由 + 文件
- `/admin/crawler` → `apps/server-next/src/app/admin/crawler/page.tsx` → `CrawlerClient`
- `/admin/crawler/runs/[id]` → `apps/server-next/src/app/admin/crawler/runs/[id]/page.tsx` → `CrawlerRunDetailView`

#### 2.3.2 7 个客户端组件（共 2188 行）

| 组件 | 行 | 职责 | 重做归属 |
|---|---|---|---|
| `CrawlerClient.tsx` | 157 | 顶层 Tab + 全局 fetch + PageHeader | **重做位置**（保留 PageHeader + fetch，删除 Tab） |
| `CrawlerSitesTab.tsx` | 334 | 站点 CRUD 容器 + 状态卡 + 嵌 ControlsCard + 批量条 + DataTable | **删除 + 拆解**（CRUD 保留到行操作 `{more}` 菜单 / DataTable 删除 / 批量条删除 / 状态卡删除—被 KPI 替代） |
| `CrawlerControlsCard.tsx` | 202 | 全局 freeze + 4 按钮（调度配置 / 重建索引 / 全局止血 / 冻结切换） | **重做位置**（迁到 PageHeader 右侧"导出 / 新增站点 / 全站全量"之外的"高级操作"菜单或独立 toolbar；**调度配置 + 全局止血 + 冻结**是 v2 设计稿未明示的运营/灾备能力，保留为"高级菜单"二级入口；**重建索引**是 ES 运维，归属 settings 或 admin 顶层灾备区） |
| `CrawlerSiteFormDrawer.tsx` | 227 | 站点 8 字段表单（key/name/apiUrl/sourceType/format/weight/isAdult/detail）+ validate + delete | **保留**（迁到"+新增站点"和行级"编辑"动作触发） |
| `crawler-site-columns.tsx` | 116 | DataTable 列定义（8 列） | **删除**（替换为 expandable table 行模板） |
| `CrawlerRunsView.tsx` | 429 | runs 列表 + status/triggerType filter + 分页 + 行操作 cancel/pause/resume | **重做位置**（runs 列表不再做 Tab；迁到独立路由 `/admin/crawler/runs` 或者"批次历史" Drawer / link out；设计稿没要求 runs Tab，但 runs 历史观察是必需能力——见 §3.2 OPEN） |
| `SchedulerConfigDrawer.tsx` | 218 | scheduler 8 字段配置 Drawer（interval / window / concurrency 等） | **保留**（迁到"高级菜单" → 调度配置） |
| `CrawlerRunDetailView.tsx` | 445 | run 详情 + run-tasks 子表 + 行级 cancel/retry + 触发 logs Drawer | **保留**（独立路由不变） |
| `TaskLogsDrawer.tsx` | 491 | 任务日志查看 + level 过滤 + 计数 + CSV 导出 | **保留** |

#### 2.3.3 API 层（`apps/server-next/src/lib/crawler/api.ts`）功能盘点

**保留全部 API 函数**，UI 形态变化不动后端：

- `listCrawlerSites / createCrawlerSite / updateCrawlerSite / deleteCrawlerSite / batchCrawlerSites / validateCrawlerSite`
- `getCrawlerSystemStatus / setCrawlerFreeze`（**新增使用：filter 化驱动 KPI**）
- `getAutoCrawlConfig / setAutoCrawlConfig`
- `stopAllCrawler / triggerReindex`
- `listCrawlerRuns / cancelCrawlerRun / pauseCrawlerRun / resumeCrawlerRun`
- `getCrawlerRunById / listCrawlerRunTasks / getCrawlerTaskDetail / listCrawlerTaskLogs`

**新增需要的 API（后端待补）**：

| 新 API | 用途 | 优先级 | 备注 |
|---|---|---|---|
| `GET /admin/crawler/kpi` | KPI 5 列数据（站点 / 运行中 / 失败 / 本批视频量 / 平均时长） | P0 | 可由 `getCrawlerSystemStatus` 扩展返回 |
| `GET /admin/crawler/timeline?range=1h` | 时间轴每站任务窗口数据（站点 × 时间 × dur × status × videos count） | P0 | 后端聚合 runs 数据 |
| `POST /admin/crawler/sites/:key/run?mode=incremental\|full` | 行级"增量 / 全量"触发 | P0 | 复用 `POST /admin/crawler/runs` 但带 site 过滤 |
| `POST /admin/crawler/run-all?mode=full` | "全站全量"按钮 | P0 | 复用 batch 触发 |
| `GET /admin/crawler/sites/:key/category-mapping` | 行展开：分类映射 | P2 | 新增表或读 config（依赖 PRE-05 / ADR-123） |

**跨模块复用现有 API（无需 ADR-122 覆盖，§8.2.2 落地）**：

| 现有 API | 用途 | 归属模块 | 备注 |
|---|---|---|---|
| `GET /admin/sources/sites/:key/routes` | 行展开：线路列表 | sources | M-SN-5 已实施，跨模块调用即可 |
| `PATCH /admin/sources/routes/:id` | 线路别名编辑 | sources | M-SN-5 已实施，跨模块调用即可 |

→ **后端 API 新增须独立 ADR**（CLAUDE.md `verify:endpoint-adr` 守门）：
  - ADR-122 起草：`GET /admin/crawler/kpi` + `GET /admin/crawler/timeline` + `POST /admin/crawler/sites/:key/run` + `POST /admin/crawler/run-all` 协议设计 + 与现有 analytics / dashboard 端点重叠评估（§5.4）
  - ADR-123 起草：分类映射 schema（PRE-05 卡负责，如不通过则 REDO-01-F 降级为占位）

#### 2.3.4 共享原语 / 共享工具依赖

- `@resovo/admin-ui`：`DataTable / AdminCard / AdminButton / AdminSelect / AdminInput / PageHeader / Drawer / EmptyState / ErrorState / LoadingState / CodeText / useToast`
- `@/lib/api-client`：`ApiClientError`
- `@/lib/csv-export`：`downloadCsv / CsvColumn`
- Toast：`useToast`

**新增需要的共享原语**（必须 Opus 子代理设计 API 契约）：

| 新组件 | 用途 | 已有判定 | 子代理 |
|---|---|---|---|
| `<KpiCard label value delta variant spark?>` | KPI 卡（5 处复用 + Dashboard / Analytics / Sources / Image Health / Users / Subtitles 全部需要） | 设计稿 §7 已点名"DashboardClient 自造 StatCard 应升级" | Opus 必须 |
| `<TimelineCard sites range>` | 实时任务时间轴 card | 新原语 / 仅 crawler 使用 / 不抽 admin-ui，写入 `crawler/_client/Timeline.tsx` | 不需要 |
| `<ExpandableTable rows columns expandRow rowKey>` | 行可展开表格（站点列表 + 未来 sources 矩阵） | 已超 3 处复用阈值（sources 线路矩阵 / image-health 破损样本 / 此页） | Opus 必须 |
| `<Spark data color w h>` | svg 折线 spark | 设计稿 §7 已点名 | Opus 必须（独立卡） |

### 2.4 对照清单：spec ↔ 现状 ↔ 重做归属

| 设计稿 spec 元素 | 现状 | 重做归属 |
|---|---|---|
| **page__head actions：导出** | ❌ 无 | **新增** CSV 导出按钮（消费 `csv-export.ts`） |
| **page__head actions：+ 新增站点** | ✅ 有 | 保留 |
| **page__head actions：全站全量 primary** | ❌ 无 | **新增** 按钮 + 后端 `POST /admin/crawler/run-all` |
| **page__head subtitle 含"实时任务时间轴 / 一键诊断 / 展开查看"** | ⚠️ 现 sub 是 `{N} 个站点 · {tab} tab · MVP（不含 tasks / DAG）` | **重做** |
| **KPI 5 列** | ❌ 完全无 | **新增** KpiCard × 5（Opus 必须 + 后端 `GET /admin/crawler/kpi`） |
| **实时任务时间轴 card（全宽）** | ❌ 完全无 | **新增** TimelineCard（后端 `GET /admin/crawler/timeline`） |
| **站点列表 card + 搜索 input + 筛选 button** | ❌ 用 DataTable + 无搜索 | **重做**（设计稿 input 不走 DataTable.toolbar.search） |
| **站点表格 9 列 expandable** | ❌ DataTable 8 列 + 不可展开 | **重做**（ExpandableTable 共享原语） |
| **行级"增量 / 全量"按钮** | ❌ 无 | **新增** + 后端 `POST /admin/crawler/sites/:key/run` |
| **行级 `{more}` 菜单** | ❌ 无 | **新增**（含：编辑 / 删除 / 启用/禁用 / 标记成人 / 标记短剧 / 复制 key） |
| **行展开线路 sub-table** | ❌ 无 | **新增**（跨模块调用 sources 现有 API） |
| **行展开分类映射 collapsible** | ❌ 无 | **新增**（待 ADR-123 schema） |
| 调度器状态卡（"调度器状态：采集 + 验证 + 索引任务"） | ✅ 有外置 AdminCard | **删除**（设计稿无；信息合并进 KPI 或"高级菜单 → 调度配置"） |
| 全局采集开关卡（freeze） | ✅ 有 AdminCard + 状态 dot | **删除**（设计稿无；逻辑迁"高级菜单" + 时间轴 card head 显示冻结态） |
| 调度配置 Drawer | ✅ 有按钮 + Drawer | **重做位置**（按钮迁"高级菜单" → 项 `调度配置`） |
| 重建索引按钮 | ✅ 有 | **重做位置**（按钮迁"高级菜单" → 项 `重建 ES 索引`） |
| 全局止血按钮 | ✅ 有 + 双 confirm | **重做位置**（按钮迁"高级菜单" → 项 `全局止血`） |
| 站点 CRUD Drawer | ✅ 有 8 字段表单 | **保留**（触发改为"+新增站点"和行 `{more}` → 编辑） |
| 批量动作（enable/disable/mark_*/delete） | ✅ 表格外置 AdminCard 卡 | **删除外置卡 + 重做位置**（批量动作走 DataTable.bulkActions 内置 sticky-bottom；如果 ExpandableTable 不支持 selection，移除批量功能，由行 `{more}` 菜单逐行操作—**待 Opus 裁决**） |
| Tab 切换"站点配置 / 采集批次" | ✅ 顶层 Tab | **删除**（设计稿无 Tab；runs 历史改为独立路由 / Drawer / 时间轴下钻） |
| runs 列表（CrawlerRunsView） | ✅ 完整 list + filter + 行操作 | **重做位置**（独立子页 `/admin/crawler/runs` 或时间轴行点击下钻；保留所有功能） |
| run 详情 | ✅ /admin/crawler/runs/[id] | **保留**（独立路由不变） |
| TaskLogsDrawer | ✅ 完整 | **保留** |

### 2.5 Open Issues（REDO-01-A Opus 子代理 2026-05-18 全部 ✅ 裁决）

> 全部 5 项 Issues 已由 REDO-01-A spawn 的 arch-reviewer Opus 子代理裁决，详见 `docs/M-SN-7-redo-01-contract.md` §2。

1. **runs 列表去 Tab 后的归属** → ✅ **方案 A**（独立路由 `/admin/crawler/runs` + sidebar 二级菜单 / 用户已锁定）
2. **批量动作是否保留** → ✅ **方案 A**（删除批量动作，行 `{more}` 菜单逐行操作；7 种 batch action 全部覆盖到 6 项行级菜单）
3. **SITES mock vs 100+ 实际** → ✅ 时间轴 top N（默认 8 / running 优先）+ 站点列表 DataTable client-mode 分页（pageSize 25/50/100）
4. **"高级菜单"挂哪** → ✅ **方案 A**（PageHeader actions 第 4 槽位 "高级" + AdminDropdown）
5. **冻结状态可视化** → ✅ 时间轴 card head `pill--warn 全局冻结` 替代 `pill--ok 实时`，不加全屏 banner

---

## 3. 采集控制重做实施计划（CHG-SN-7-REDO-01）

> **决策锁定（2026-05-18 用户拍板）**：
> - 拆卡粒度：**子卡 A–J**（10 张小卡）
> - 共享原语：**拆独立 M-SN-SHARED milestone 先做**（见 §3.5）→ REDO-01 不再造原语，仅消费
> - runs 列表归属：**独立路由 `/admin/crawler/runs` + sidebar 二级菜单**
> - 批量动作去留：**留给 REDO-01-A Opus 子代理裁决**
> - Submissions 历史卡：**纳入 M-SN-7**（REDO-02，见 §4）

### 3.1 拆卡

| 卡 ID | 范围 | 估时 | 前置 | 模型 |
|---|---|---|---|---|
| **REDO-01-A** | Opus 子代理：消费 SHARED 产出 + 设计本页 props/state/事件契约 + **裁决 Crawler 页是否启用 selection（业务策略，依赖 SHARED-02 已定的组件能力）** | 0.15w | M-SN-SHARED 完成 | Opus 必须 |
| **REDO-01-B** | 后端：ADR-122（KPI + Timeline + per-site run + run-all）+ 实施 4 个新端点 + DB queries + 单测 | 0.6w | A | Opus（ADR）+ Sonnet（实施） |
| **REDO-01-C** | 前端骨架：新 CrawlerClient（page head 3 actions + KPI row + 时间轴 card 框架 + 站点列表骨架，**不含展开行**） | 0.3w | A + B | Sonnet |
| **REDO-01-D** | 前端站点行 + `{more}` 菜单（迁移 8 字段表单 + CRUD + 启停 + 标记 + 删除 + 行级 `+ 增量 / 全量`） | 0.3w | C | Sonnet |
| **REDO-01-E** | 前端行展开：线路 sub-table（跨调 sources API） | 0.4w | C + sources API ready | Sonnet |
| **REDO-01-F** | 前端行展开：分类映射 collapsible（如 ADR-123 通过则做，否则缩到"占位 + 跳 settings"） | 0.2w | C + ADR-123 | Sonnet |
| **REDO-01-G** | 高级菜单（调度配置 / 重建索引 / 全局止血 / 冻结切换 4 项 + DropdownMenu） | 0.2w | C | Sonnet |
| **REDO-01-H** | runs 列表迁独立路由 `/admin/crawler/runs` + sidebar 二级菜单 | 0.15w | C | Sonnet |
| **REDO-01-I** | 删除旧文件：`CrawlerSitesTab.tsx / CrawlerControlsCard.tsx / crawler-site-columns.tsx`（CrawlerRunsView 迁走但保留代码） | 0.05w | C–H 全部完成 | Sonnet |
| **REDO-01-J** | 视觉回归测试 + e2e + Opus 验收 | 0.2w | I 完成 | Opus 验收 |

**REDO-01 总估时**：**2.55w**（A 0.15 + B 0.6 + 前端 C–H 1.55 + I+J 0.25）；共享原语 0.4w 移出至 SHARED milestone

### 3.5 M-SN-SHARED milestone（新增，先于 REDO-01 执行）

用户决策"拆独立 SHARED milestone 先做"，把跨页共享原语前置，避免每张 REDO 卡重复设计。

| 卡 ID | 范围 | 估时 | 前置 | 模型 |
|---|---|---|---|---|
| **SHARED-01** | **KpiCard `progress?` prop 扩展**（PRE-04 dashboard 子卡 #1 实测重大发现：admin-ui 已入库 `packages/admin-ui/src/components/cell/kpi-card.tsx` + `kpi-card.types.ts`；原"新建 KpiCard"假设错误，改为对现有原语 props 增量扩展以承载 WorkflowCard 4 段 progress 形态）：扩展 props（含 `progress?: { value, total, color }`）+ 现有消费方零破坏验证（MetricKpiCardRow + WorkflowCard 双签）+ 单测 + 视觉 baseline 更新；**Opus 契约阶段必须以 §5.1 / §5.6 / §5.8 / §5.10 / §5.14 / §5.15 七页 KPI 全文为输入**；**验收阶段必须同时落地 ≥ 2 个消费页 demo**；扩展 prop 必须向后兼容（不破坏 dashboard / videos 等现有消费） | **0.1w**（原 0.35w，PRE-04 实测下调） | 无 | Opus（契约）+ Sonnet（实施） |
| ~~**SHARED-02**~~ | ❌ **取消**（SHARED-02 实施前实测发现 DataTable v2 已支持 `renderExpandedRow` + `expandedKeys` + selection + pagination 三态；ADR-117 + CHG-DESIGN-02 Step 5 已落地；Sources MatrixExpand 生产消费已验证）→ REDO-01 Crawler 重做直接消费 DataTable v2 | 0w（原 0.4w） | — | — |
| **SHARED-03** | ⏸️ **待评估**（PRE-04 dashboard 子卡 #1 实测：admin-ui 已入库 `Spark` `packages/admin-ui/src/components/cell/spark.tsx`；可能完全取消本卡或仅做 props 微调）。**触发条件**：等 PRE-04 子卡审计 §5.6 Crawler / §5.15 Analytics / §5.1.2 SiteHealthCard.spark 三处消费形态对照确认后再裁决。 | 0w（或 0.05w 微调） | 子卡 #10 Crawler + #12 Analytics 审计完成 | Sonnet |

**M-SN-SHARED 总估时**：**0.1w**（仅 SHARED-01 0.1w）；原 0.9w → ~0.5w（PRE-04 dashboard 实测下调 SHARED-01/03） → **0.1w**（SHARED-02 实施前实测 DataTable v2 已具备能力，整张卡取消）。

**关键自省**：M-SN-7 SHARED milestone 3 张卡（SHARED-01 KpiCard / SHARED-02 ExpandableTable / SHARED-03 Spark）的核心假设"admin-ui 缺这些原语"在 3/3 处全部出错——admin-ui 实际已入库 KpiCard / Spark / DataTable v2 行展开。原因：M-SN-7 计划文档起草时未先做"admin-ui 现状盘点"。**未来 milestone 起步前必须先全量盘点 packages/admin-ui 现有能力**，避免重复假设。

落地后下列页面可一致消费：Dashboard / Analytics / Sources / Image Health / Users / Subtitles / Crawler 共 7 页的 KPI 区；Crawler + Sources + Image Health 共 3 页的 ExpandableTable；Dashboard + Analytics + Crawler 站点健康卡的 Spark。

#### 3.5.1 SHARED-01/02/03 共同验收门（§8.3.2 多品牌兼容落地）

每张 SHARED 卡 J 验收必须通过：

1. **颜色零硬编码**：`grep -E '#[0-9a-fA-F]{3,8}|rgb\(' packages/admin-ui/src/components/<comp>/` 必须空集（值必须来自 CSS 变量 / token）
2. **品牌切换视觉一致性**：visual baseline 双份——`packages/admin-ui/playwright-baselines/<comp>/{default,brand-2}.png`
3. **当前承诺范围**：server-next 当前仅挂一套品牌（`admin` 默认），baseline 第 2 份品牌**可暂为同一品牌的 dark theme**；真多品牌承诺延后到 M-SN-N（已记入 §8.3.2 已知差异）
4. **入库位置确认**：所有原语必须放 `packages/admin-ui/src/components/` 入口；不得新挂 `apps/server-next/src/components/`

### 3.2 拆卡依赖图

```
M-SN-SHARED (01 KpiCard / 02 ExpandableTable / 03 Spark) ─┐
                                                          ↓
REDO-01-A (消费 SHARED + 本页 props/state/事件契约 + 业务策略：是否启用 selection) ──┐
REDO-01-B (后端 ADR-122 + 4 endpoints)                                              ─┴─→ REDO-01-C (前端骨架)
                                                                                              │
                                                                                              ├─→ REDO-01-D (行 + 菜单)
                                                                                              ├─→ REDO-01-E (展开行：线路)
                                                                                              ├─→ REDO-01-F (展开行：分类映射，依赖 PRE-05 / ADR-123)
                                                                                              ├─→ REDO-01-G (高级菜单)
                                                                                              └─→ REDO-01-H (runs 独立路由)
                                                                                                          ↓
                                                                                                 REDO-01-I (删除旧文件)
                                                                                                          ↓
                                                                                                 REDO-01-J (验收)
```

### 3.3 删除清单（REDO-01-I）

| 文件 | 操作 |
|---|---|
| `apps/server-next/src/app/admin/crawler/_client/CrawlerClient.tsx` | **重写**（保留 path） |
| `apps/server-next/src/app/admin/crawler/_client/CrawlerSitesTab.tsx` | **删除** |
| `apps/server-next/src/app/admin/crawler/_client/CrawlerControlsCard.tsx` | **删除**（功能迁高级菜单） |
| `apps/server-next/src/app/admin/crawler/_client/crawler-site-columns.tsx` | **删除** |
| `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteFormDrawer.tsx` | **保留 + 触发器修改** |
| `apps/server-next/src/app/admin/crawler/_client/CrawlerRunsView.tsx` | **移动到** `apps/server-next/src/app/admin/crawler/runs/_client/CrawlerRunsView.tsx` + 新建 page.tsx |
| `apps/server-next/src/app/admin/crawler/_client/SchedulerConfigDrawer.tsx` | **保留 + 触发器迁高级菜单** |
| `apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx` | **保留**（独立路由不变） |
| `apps/server-next/src/app/admin/crawler/runs/[id]/_client/TaskLogsDrawer.tsx` | **保留** |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerKpiRow.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerTimelineCard.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteList.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteRow.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerSiteExpand.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/_client/CrawlerAdvancedMenu.tsx` |
| 新增 | `apps/server-next/src/app/admin/crawler/runs/page.tsx` |

### 3.4 验收门（REDO-01-J）

- ✅ 像素级视觉对照 `screens-2.jsx CrawlerView`（截图 diff 容差 2%）
- ✅ **功能保留清单 100% 覆盖（强制 checklist = §2.4 对照表全 22 行）**：J 卡报告必须逐行列出 §2.4 每条「spec ↔ 现状 ↔ 重做归属」的 ✅/❌ 状态，任何一条 ❌ → J 验收不通过
- ✅ `npm run typecheck / lint / test -- --run / test:e2e / verify:adr-contracts / verify:endpoint-adr / verify:file-size-budget` 全 PASS
- ✅ arch-reviewer Opus 评级 ≥ A−
- ✅ Submissions 偏离（CHG-SN-5-01）单独记账，不混入此卡

---

## 4. 调用顺序（M-SN-7 入口）

按依赖与风险递进（用户决策已锁 Q1–Q4，Q5 延后至 REDO-01-A）：

1. ⏸️ **本计划文档整体审批** ← 当前位置（pending：用户对结构 + 估时 + ADR 触发清单显式 ✅；Q5「批量动作去留」由 REDO-01-A Opus 子代理消费 SHARED-02 时再决）
2. **CHG-SN-7-PRE-01**（文件大小守卫，0.12w，**已在队列**）
3. **CHG-SN-7-PRE-02**（ADR-121 R-MID-1 协议化，0.15w，**已在队列**）
4. ~~**CHG-SN-7-PRE-03**（CrawlerSitesTab 外置 batch bar 修正）~~ → **取消**，因为整页要重做
5. **CHG-SN-7-PRE-04**（全量审计 16 路由，0.8w）
   - 输出 `M-SN-7-design-realign-audit-FULL.md`
   - **不再以"是否纳入"作为决策点**——Submissions 已锁定纳入；本卡只产出每路由的 spec ↔ 现状 ↔ 删除/重做归属清单
6. **CHG-SN-7-PRE-05**（**新增**：ADR-123 分类映射 schema 起草，0.1w，Opus 必须）
   - 通过 → REDO-01-F 按 spec 实施分类映射 collapsible
   - 不通过 → REDO-01-F 自动降级为"占位 + 跳 settings"
7. **M-SN-SHARED milestone**（KpiCard + ExpandableTable + Spark，0.9w，§3.5）
   - SHARED-01 / 02 / 03 三张子卡可并行（无相互依赖）
   - **必须先于任何 REDO-XX 完成**
8. **CHG-SN-7-REDO-01-A → J**（**采集页**重做，2.55w，§3.1）
9. **CHG-SN-7-REDO-02-A → ?**（**Submissions** §5.13 Card list 重做，待 §3.1 模板复用拆解）
10. 按 PRE-04 审计报告优先级排剩余 14 路由的 REDO-03 ~ REDO-16 卡

**M-SN-7 总估时初估**（待 PRE-04 完成后修订）：

- PRE 阶段：PRE-01 0.12 + PRE-02 0.15 + PRE-04 0.9 + PRE-05 0.1 = **1.27w**
- SHARED milestone：**0.1w**（仅 SHARED-01；SHARED-02/03 实测 admin-ui 已具备能力全部取消）
- REDO-01（采集）：**2.55w**
- REDO-02（Submissions）：**~1w**
- REDO-03+（其他 14 路由，按 ⚠️/❌ 等级数）：**~6–10w**（PRE-04 后细化；dashboard 已审 ⚠️ S 级仅 3 MISC 不入 REDO）
- **M-SN-7 全 milestone 估时**：**~11.0–15.0w**（PRE-04 + SHARED-02 实测累计下调 0.8w）

---

## 5. 关键决策点（5.1–5.3 / 5.5 已锁定，5.4 内化到 REDO-01-B）

> 5.1（Submissions 纳入）/ 5.2（重做粒度子卡 A–J）/ 5.3（SHARED 独立 milestone）已由用户在 §7 拍板。5.5（视觉回归粒度）已落地到 §0.4。本节仅保留 5.4 作为 REDO-01-B 起卡条件。

### 5.4 后端 API 新增是否影响其他模块（内化到 REDO-01-B 起卡条件）

- ADR-122 新增的 `/admin/crawler/kpi` `/admin/crawler/timeline` 是否与现有 analytics / dashboard 端点重叠
- **行动**：REDO-01-B 起 ADR-122 前，必须由 Opus 子代理对照 `apps/api/src/routes/admin/analytics/*.ts` 与 `dashboard/*.ts` 评估端点合并 / 命名空间冲突
- **裁决产物**：ADR-122 §"与现有端点关系"区块（如发现重叠，可能扩展 ADR-122 至跨模块协议设计）

---

## 6. 文档闭环

完成本计划文档后立即：
1. 落卡到 `docs/task-queue.md` M-SN-7 区
2. 在 `docs/tasks.md` 增加"进行中：CHG-SN-7-PRE-04（待用户审批本计划后启动）"
3. **不动业务代码**（等用户审批）

完成 REDO-01 后追加：
1. `docs/changelog.md` `CHG-SN-7-REDO-01-{A..J}` 每条独立条目
2. `docs/decisions.md` 引用 ADR-122 / 123（如新增）
3. `docs/M-SN-6-milestone-audit-2026-05-17.md` 加补丁：标注"M-SN-6 关闭复核延伸出 M-SN-7 REDO 拆解"

---

## 7. 用户决策（2026-05-18 已拍板）

| # | 决策项 | 用户答 |
|---|---|---|
| Q1 | Submissions 是否纳入 M-SN-7 重做 | ✅ **纳入** → 作为 REDO-02 |
| Q2 | 重做粒度（每页大卡 vs 子卡 A–J） | ✅ **子卡 A–J** |
| Q3 | KpiCard/ExpandableTable/Spark 怎么做 | ✅ **拆独立 M-SN-SHARED milestone 先做** → 见 §3.5 |
| Q4 | runs 列表去 Tab 后归属 | ✅ **独立路由 `/admin/crawler/runs` + sidebar 二级菜单** |
| Q5 | 批量动作是否保留 | ⏸️ **留给 REDO-01-A Opus 子代理决策**（消费 SHARED-02 ExpandableTable 契约时一并裁决） |

下一步动作（待用户对本计划文档本身审批 ✅ 后启动）：

1. 在 `docs/task-queue.md` M-SN-7 区落卡：PRE-01 / PRE-02 / **PRE-04**（取消 PRE-03）/ SHARED-01–03 / REDO-01-A–J / REDO-02-（待 PRE-04 后补）
2. 在 `docs/tasks.md` 写入"进行中"为第一张待执行卡
3. 按 §4 调用顺序逐张推进，**首推 PRE-04 全量审计**

---

## 8. 修订日志（2026-05-18）

> §8 由"主循环审阅意见清单"收敛为"修订追踪"。原 11 项意见（5 MUST + 3 SHOULD + 3 NICE-TO-HAVE）已**全部合并**到 §0–§7 文档主体；本节仅保留 audit trail。

| 意见 ID | 落地位置 | 状态 |
|---|---|---|
| MUST-1 §5 与 §7 决策表自相矛盾 | §5 标题改写 + 仅保留 5.4，5.5 内化到 §0.4 | ✅ |
| MUST-2 §4 第 1 项措辞冲突 | §4 第 1 项已改 "⏸️ pending 用户对结构 + 估时 + ADR 触发清单 ✅" | ✅ |
| MUST-3 §3.2 依赖图标注误导 | §3.2 图节点已重写 + 补 SHARED → REDO-01-A 依赖箭头 | ✅ |
| MUST-4 SHARED-02 与 REDO-01-A 职责重叠 | §3.5 SHARED-02 写"能力契约"，§3.1 REDO-01-A 写"业务策略 是否启用" | ✅ |
| MUST-5 ADR-123 无起草卡 | §4 第 6 项已加 **CHG-SN-7-PRE-05** ADR-123 schema 起草卡 | ✅ |
| SHOULD-1 REDO-01-B 估时 0.5→0.6w | §3.1 / §3.5 / §4 总估时表已同步 | ✅ |
| SHOULD-2 PATCH /routes/:id 表头矛盾 | §2.3.3 拆为"新增 API 表" + "跨模块复用现有 API 表"两块 | ✅ |
| SHOULD-3 §0.4 视觉回归未给落地路径 | §0.4 已补"默认跑 / 跳过 / 基础设施"三项规则 | ✅ |
| NICE-1 回退策略缺失 | §0.5 新增"回退策略"4 条规则（git tag / 删除清单 / Rollback 区 / J 失败 RECHECK） | ✅ |
| NICE-2 多品牌兼容承诺缺失 | §3.5.1 新增 SHARED 共同验收门 4 项 + 多品牌承诺延后说明 | ✅ |
| NICE-3 PRE-04 Opus 介入点不清晰 | §1.2 已写"Sonnet 逐路由 + 末尾单次 spawn Opus 收尾排序" | ✅ |

### 8.1 修订后启动条件

1. 用户对本修订版本做最终 ✅
2. 启动 `docs/task-queue.md` 落卡（PRE-01 / 02 / 04 / 05 / SHARED-01/02/03 / REDO-01-A..J）
3. 起 PRE-04 第 1 张子卡（/admin/dashboard §5.1 审计）
4. 不动业务代码，按 §4 调用顺序逐张推进

