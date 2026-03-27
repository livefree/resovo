# 视频管理与表格基建统一实施方案 (2026-03-25)

> status: active
> owner: @engineering
> scope: video admin workflow and table foundation execution plan
> source_of_truth: no
> supersedes: docs/archive/2026Q1/video_management_plan_20260325.md
> superseded_by: none
> last_reviewed: 2026-03-27
>
> 融合来源：`video_management_plan_20260325.md`（业务流程）+ `admin_table_redesign_plan_20260325.md`（表格基建）+ 两轮工程审核意见。
> 本文档为最终可执行版本，后续拆分为 `task-queue.md` 原子任务的唯一依据。

---

## 一、目标

用 5 个阶段（Phase 0 → 0.5 → 1 → 2 → 3）交付 3 个全新后台界面 + 1 套通用表格基建，取代现有 `/admin/videos` 和 `/admin/sources` 页面。

| 交付物 | 路由 | 替代对象 |
|---|---|---|
| 界面一：内容审核台 | `/admin/moderation` | 无（全新） |
| 界面二：全量视频治理库 | `/admin/videos`（沿用） | 现有 `AdminVideoList` |
| 界面三：视频源健康度中心 | `/admin/sources`（沿用） | 现有 `AdminSourceList` |
| ModernDataTable 表格基建 | `src/components/admin/shared/modern-table/` | 现有 `AdminTableFrame` 系列 |

---

## 二、前置条件：Schema 就绪确认

所有核心字段已存在，**不需要新建 migration 即可启动**：

| 字段 | 表 | Migration | 值域 |
|---|---|---|---|
| `review_status` | videos | 016 | pending_review / approved / rejected / blocked |
| `visibility_status` | videos | 016 | public / internal / hidden / blocked |
| `reviewed_by` / `reviewed_at` / `review_reason` | videos | 016 | — |
| `is_active` / `last_checked` | video_sources | 001 | boolean / timestamptz |
| `season_number` / `episode_number` | video_sources | 014 | int NOT NULL DEFAULT 1 |
| `ingest_policy` (含 `allow_auto_publish`) | crawler_sites | 018 | JSONB |

---

## 三、业务工作流（4 维度）

### 3.1 采集入库路由 (Ingestion Routing)

根据 `crawler_sites.ingest_policy.allow_auto_publish` 决断：
- `true`（高信赖源）→ 入库即 `review_status='approved'`, `visibility_status='public'`
- `false`（默认）→ 入库为 `review_status='pending_review'`, `visibility_status='internal'`

### 3.2 内容审核 (Review Workflow)

管理员在审核台处理 `pending_review` 视频：
- **通过** → `review_status='approved'`, `visibility_status='public'` + 同步 ES
- **拒绝** → `review_status='rejected'`, `visibility_status='hidden'`
- **封禁** → `review_status='blocked'`, `visibility_status='blocked'`

### 3.3 上下架管理 (Publish / Unpublish)

上下架**独立于**审核状态：
- 下架 = `visibility_status: 'public' → 'hidden'`，`review_status` 不变
- 重新上架 = `visibility_status: 'hidden' → 'public'`（仅限 `review_status='approved'`）
- 向后兼容：同步更新 `is_published` 字段

### 3.4 源健康检测 (Source Verification) — 轻量方案

第一期采用**事件驱动**而非 cron 全扫：
1. 播放器加载失败 → `POST /api/sources/:id/report-error` → 标记 `needs_check=true`
2. 复用 Bull queue，新增 job type `source-health-check`
3. Worker: HTTP HEAD `source_url`，10s 超时 → 更新 `is_active` + `last_checked`
4. 保留手动"重新检测"按钮（`SourceVerifyButton`）
5. 后续迭代可加低频 cron（每周，并发限 5）

---

## 四、前端开发准则（全局约束）

以下规则适用于 Phase 0.5 ~ Phase 3 的所有前端开发：

### 4.1 技术栈边界
- 状态管理：Zustand 4.x + 本地 Hook（不引入 SWR / React Query / TanStack Table）
- 数据获取：`apiClient` + `useState` / `useEffect`（现有模式）
- 样式：Tailwind CSS 3.x + CSS 变量（不引入 CSS-in-JS）

### 4.2 表格交互零副作用规则
- **禁止** `<a href>` 触发当前页面动作 → 使用 `<button onClick>`
- **禁止** 单个 Cell 操作后触发外层 `refetch()` — Cell 内部自管乐观状态
- 批量操作完成后可触发 refetch，但须保持 `scrollTop` / `scrollLeft`
- 滚动位置通过 `ref` 保持

### 4.3 Cell 组件设计约束
- 所有交互 Cell 为**受控组件**：接收 `value` + `onChange`/`onToggle`
- 乐观更新模式：立即翻转本地 state → 调 API → 失败则回滚 + 错误提示
- 行高固定 `h-12`（48px），文本 `whitespace-nowrap` + `overflow-hidden text-ellipsis`

### 4.4 ES 同步强制规则
- 任何修改 `review_status` / `visibility_status` / `is_published` 的 Service 层方法，DB 写入成功后**必须**调用 `VideoService.indexToES(videoId)`
- `indexToES()` 的 SELECT 须包含 `review_status`、`visibility_status`
- 批量操作走 `Promise.allSettled` 逐条更新 ES，失败不中断但记录日志

---

## 五、分阶段实施计划

### Phase 0：后端 API 修复（4 个缺口）

> 目标：补齐业务工作流所需的全部后端能力。每个任务完成后附 API 单元测试。

#### CHG-A：采集入库路由接入 `ingest_policy`

- **问题**：`SourceParserService.upsertVideo()` 统一设 `visibility_status='internal'`，未读 `ingest_policy`
- **改动文件**：
  - `src/api/services/CrawlerService.ts` — 传递 site 的 `ingest_policy` 给 upsert 流程
  - `src/api/services/SourceParserService.ts` — 根据 `allow_auto_publish` 决定 `review_status` / `visibility_status`
- **测试**：`tests/unit/api/ingestPolicy.test.ts`

#### CHG-B：`publishVideo` → `updateVisibility` 改造 + ES 同步

- **问题**：`publishVideo()` 只操作 `is_published` boolean，不更新 `visibility_status`
- **改动文件**：
  - `src/api/db/queries/videos.ts` — 新增 `updateVisibility(db, videoId, visibility)` 函数，同步 `is_published`
  - `src/api/routes/admin/videos.ts` — 改造 `PATCH /:id/publish` 端点调用新函数
  - `src/api/services/VideoService.ts` — `indexToES` SELECT 补充 `review_status`、`visibility_status`
- **测试**：`tests/unit/api/updateVisibility.test.ts`

#### CHG-C：新建视频审核 API + ES 同步

- **问题**：无 API 支持 approve / reject / block 操作
- **新建**：
  - `src/api/db/queries/videos.ts` — `reviewVideo(db, videoId, { action, reason, reviewedBy })`
  - `src/api/routes/admin/videos.ts` — `POST /admin/videos/:id/review`
- **状态转换表**：

  | action | review_status → | visibility_status → |
  |---|---|---|
  | approve | approved | public |
  | reject | rejected | hidden |
  | block | blocked | blocked |

- **ES 同步**：DB 写入成功后调用 `VideoService.indexToES(videoId)`
- **测试**：`tests/unit/api/reviewVideo.test.ts`

#### CHG-D：新建源 URL 替换 API

- **问题**：`updateSourceActiveStatus()` 不支持修改 `source_url`
- **改动文件**：
  - `src/api/db/queries/sources.ts` — 新增 `updateSourceUrl(db, sourceId, newUrl)`
  - `src/api/routes/admin/content.ts` — `PATCH /admin/sources/:id`，body: `{ source_url }`
- **测试**：`tests/unit/api/updateSourceUrl.test.ts`

---

### Phase 0.5：ModernDataTable 表格基建

> 目标：交付可复用的表格骨架 + Cell 组件库，为 Phase 1~3 的所有表格提供底座。

#### CHG-E：ModernDataTable 核心骨架

- **新建目录**：`src/components/admin/shared/modern-table/`
- **核心文件**：
  - `ModernDataTable.tsx` — 外层容器 `overflow-x-auto`，内部 `<table>` 使用累加像素宽度
  - `ModernTableHead.tsx` — 表头行，含排序指示器
  - `ModernTableBody.tsx` — 数据行，固定行高 `h-12`
  - `types.ts` — `TableColumn<T>` 接口定义（id, header, accessor, width, minWidth, enableResizing, enableSorting, cell）
- **列宽机制**：
  - 每列绝对 `width` 像素值（内联 `style`），不依赖浏览器推算
  - 表格总宽 = 所有列 `width` 之和（允许超出容器产生滚动）
  - 默认宽度档位：id=80px, status=100px, date=160px, title/url=300px

#### CHG-F：Cell 组件库

- **新建文件**：`src/components/admin/shared/modern-table/cells/`
  - `TableTextCell.tsx` — `whitespace-nowrap` + 溢出 Tooltip
  - `TableSwitchCell.tsx` — boolean 乐观切换（受控，含 loading 态）
  - `TableUrlCell.tsx` — 截断 domain + hover 展开 + click 复制
  - `TableDateCell.tsx` — 短日期 / 相对时间
  - `TableImageCell.tsx` — 固定尺寸缩略图（防撑行高）
  - `TableBadgeCell.tsx` — 状态/标签 badge（用于源健康度等）

#### CHG-G：`useModernTable` Hook

- **新建文件**：`src/components/admin/shared/modern-table/useModernTable.ts`
- **功能**：
  - 排序状态（field + direction）
  - 列宽状态（Map<columnId, width>）+ localStorage 持久化
  - 分页状态（page + pageSize）
  - 滚动位置保持（`scrollRef`）
- **复用现有模式**：参考 `useAdminTableState` / `useAdminTableSort` 的 Zustand-style 实现

#### CHG-H：列宽拖拽 Resizer

- **新建文件**：`src/components/admin/shared/modern-table/useColumnResize.ts`
- **逻辑**：
  - 表头右边缘拖拽把手
  - `onMouseDown` → `onMouseMove` 计算 `deltaX` → 实时更新列宽状态
  - `onMouseUp` → 持久化到 localStorage
  - 拖拽 A 列不影响 B 列宽度（因为每列绝对宽度独立）

#### CHG-I：Pilot 验证 — CrawlerSiteManager 接入

- 用 `CrawlerSiteManager`（站点列表）作为第一个接入 `ModernDataTable` 的业务表格
- 验收标准：拖拽列宽独立不互相挤压、行高固定无换行、内联操作不触发整页刷新、列宽刷新后恢复

---

### Phase 1：界面二 — 全量视频治理库

> 路由：`/admin/videos`（沿用），取代现有 `AdminVideoList`

#### 页面结构

```
┌─────────────────────────────────────────────┐
│ 顶部综合筛选栏                                │
│ [搜索框] [类型] [可见性] [审核状态] [批量操作]  │
├─────────────────────────────────────────────┤
│ ModernDataTable                              │
│ ┌────┬──────┬────┬────┬──────┬────┬────┐   │
│ │封面│标题   │类型│源状态│可见性  │审核│操作│   │
│ │img │text  │badge│badge│switch│badge│btn │   │
│ └────┴──────┴────┴────┴──────┴────┴────┘   │
├─────────────────────────────────────────────┤
│ 分页                                         │
└─────────────────────────────────────────────┘
```

#### 核心功能

| 列 | Cell 组件 | 交互 |
|---|---|---|
| 封面 | `TableImageCell` | 固定 40×56px |
| 标题 + short_id | `TableTextCell` | 溢出 Tooltip |
| 类型 | `TableBadgeCell` | 电影/剧集/动漫/综艺等 |
| 源健康度 | `TableBadgeCell` | `🟢 N 活跃` / `🔴 全部失效` — 需新增聚合查询 |
| 可见性 | `TableSwitchCell` | 乐观切换 public ↔ hidden，调 `updateVisibility` API |
| 审核状态 | `TableBadgeCell` | pending/approved/rejected/blocked |
| 操作 | 按钮组 | [编辑] [源管理] |

#### 详情侧边栏（点击"编辑"展开）

- 元数据编辑表单（标题、描述、年份、类型、国家）
- 分集/播放源子面板（列出该视频所有 `video_sources`，支持删除/替换 URL）

#### 需要的 API 改动

- `GET /admin/videos` — 新增 `visibility_status` + `review_status` 筛选参数
- `listAdminVideos()` — 查询补充 `visibility_status`、`review_status` 条件 + 源健康聚合

---

### Phase 2：界面三 — 视频源健康度中心

> 路由：`/admin/sources`（沿用），取代现有 `AdminSourceList`

#### 页面结构

```
┌─────────────────────────────────────────────┐
│ 告警横幅：N 个已上架视频全部源失效 [批量下架]   │
├──────────────────┬──────────────────────────┤
│ Tab 1: 失效源     │ Tab 2: 用户纠错           │
├──────────────────┴──────────────────────────┤
│ ModernDataTable                              │
│ [视频名] [季/集] [source_url] [last_checked] │
│ [重新检测] [替换URL] [删除]                    │
└─────────────────────────────────────────────┘
```

#### Tab 1：失效源管理

- 筛选：`is_active = false`
- 列：关联视频标题、S/E 坐标、source_url（`TableUrlCell`）、last_checked（`TableDateCell`）
- 操作：[重新检测]（复用 `SourceVerifyButton`）、[替换 URL]（调 CHG-D API）、[删除]

#### Tab 2：用户纠错

- 筛选：`submitted_by IS NOT NULL`
- 操作：[采纳]（调 `approveSubmission`）、[忽略]（调 `rejectSubmission`）

#### 告警横幅

- 查询：已上架视频（`visibility_status='public'`）且所有源 `is_active=false`
- 需新增聚合查询：`countShellVideos(db)` → 返回数量
- [批量下架] → 批量 `updateVisibility('hidden')` + ES 同步

#### 源健康检测轻量方案（本阶段实现）

- 新 API：`POST /api/sources/:id/report-error`
- Bull job handler：`source-health-check`（HTTP HEAD，10s 超时）
- 复用 `src/api/lib/queue.ts` 的 Bull 实例

---

### Phase 3：界面一 — 内容审核台

> 路由：`/admin/moderation`（全新）

#### 页面布局

```
┌──────────────────────────────────────────────────┐
│ 顶部统计：待审 N | 今日已审 N | 拦截率 N%         │
├─────────────────┬────────────────────────────────┤
│ 左侧列表        │ 右侧审核抽屉                     │
│ (pending_review) │                                │
│ ┌─────────────┐ │ 标题 / 描述 / 元数据             │
│ │ 海报 | 标题  │ │ 内嵌播放器（首条源）              │
│ │ 来源 | 时间  │ │                                │
│ │  ▶ 选中高亮  │ │ [通过并上架] [拒绝] [封禁]       │
│ └─────────────┘ │ 快捷键：A=通过 R=拒绝 B=封禁     │
│ 列表可滚动       │ ← → 切换上下一条                 │
├─────────────────┴────────────────────────────────┤
│ 分页                                              │
└──────────────────────────────────────────────────┘
```

#### 核心功能

- 列表仅展示 `review_status='pending_review'` 的视频
- 点击列表项 → 右侧抽屉展示详情 + 播放器
- 播放器：复用项目已有 Video.js + HLS.js，取 `video_sources` 第一条活跃源
- 操作按钮调 CHG-C 的 `POST /admin/videos/:id/review` API
- 快捷键：`useHotkeys` Hook（`A` = approve, `R` = reject, `B` = block, `←`/`→` = 切换）
- 审核完成后自动定位到下一条待审视频

#### 统计板

- 待审数：`SELECT COUNT(*) FROM videos WHERE review_status = 'pending_review'`
- 今日已审：`SELECT COUNT(*) FROM videos WHERE reviewed_at >= CURRENT_DATE`
- 拦截率：今日 rejected+blocked / 今日已审

#### 完成后附 E2E 测试

- 主干链路：入库(internal) → 审核通过(public) → 列表可见性确认
- 至少 1 条 happy path + 1 条 reject path

---

### Phase 4+（后续规划，不纳入本轮）

| 功能 | 所需新建 | 优先级 |
|---|---|---|
| 操作审计日志 | `operation_logs` 表 + Service 层 hook | P1 |
| 字段保护锁 | `videos.locked_fields` JSONB + 采集器判断 | P1 |
| 实体合并/拆分 | `video_merges` 表 + redirect 逻辑 | P1 |
| 全局黑名单 | 正则/域名过滤表 + 采集器拦截 | P2 |
| DMCA 强隔离 | 法务状态字段 + 权限限制 | P2 |
| 多级审核 | RBAC + 升级流程 | P3 |

---

## 六、AdminSidebar 菜单调整

```
内容管理
  ├── 审核台        → /admin/moderation     (Phase 3 新增)
  ├── 视频库        → /admin/videos         (Phase 1 重构)
  └── 源健康中心     → /admin/sources        (Phase 2 重构)

系统管理（admin-only）
  ├── 采集控制台     → /admin/crawler        (已有)
  └── ...
```

---

## 七、测试策略

### Layer 1 — API 单元测试（Phase 0 即时交付）

| 测试文件 | 覆盖范围 |
|---|---|
| `tests/unit/api/ingestPolicy.test.ts` | allow_auto_publish=true/false 入库路由 |
| `tests/unit/api/updateVisibility.test.ts` | public↔hidden 切换 + is_published 同步 + ES 同步 |
| `tests/unit/api/reviewVideo.test.ts` | approve/reject/block 状态转换 + ES 同步 |
| `tests/unit/api/updateSourceUrl.test.ts` | 源 URL 替换 |

### Layer 2 — 组件单元测试（Phase 0.5）

| 测试文件 | 覆盖范围 |
|---|---|
| `tests/unit/components/modern-table/*.test.tsx` | ModernDataTable 渲染、列宽拖拽、Cell 组件乐观更新 |

### Layer 3 — E2E 主干测试（Phase 3 完成后）

- `tests/e2e/video-governance.spec.ts` — 从入库到审核到列表可见的完整链路
- 至少 2 条路径：approve → public 可见 / reject → public 不可见

---

## 八、关键文件索引

### 需修改的现有文件

| 文件 | Phase | 改动 |
|---|---|---|
| `src/api/services/CrawlerService.ts` | 0 | 传递 ingest_policy |
| `src/api/services/SourceParserService.ts` | 0 | 根据 policy 决定入库状态 |
| `src/api/db/queries/videos.ts` | 0 | 新增 updateVisibility, reviewVideo |
| `src/api/db/queries/sources.ts` | 0 | 新增 updateSourceUrl |
| `src/api/routes/admin/videos.ts` | 0 | 新端点 + 筛选参数 |
| `src/api/routes/admin/content.ts` | 0 | 新端点 PATCH /admin/sources/:id |
| `src/api/services/VideoService.ts` | 0 | indexToES 补充字段 |
| `src/components/admin/AdminSidebar.tsx` | 3 | 菜单重组 |

### 需新建的文件

| 文件/目录 | Phase |
|---|---|
| `src/components/admin/shared/modern-table/` | 0.5 |
| `src/components/admin/shared/modern-table/ModernDataTable.tsx` | 0.5 |
| `src/components/admin/shared/modern-table/useModernTable.ts` | 0.5 |
| `src/components/admin/shared/modern-table/useColumnResize.ts` | 0.5 |
| `src/components/admin/shared/modern-table/cells/*.tsx` | 0.5 |
| `src/components/admin/videos/` (重构) | 1 |
| `src/components/admin/sources/` (重构) | 2 |
| `src/components/admin/moderation/` | 3 |
| `src/app/[locale]/admin/moderation/page.tsx` | 3 |

---

## 九、工作量预估

| Phase | 任务数 | 主要内容 |
|---|---|---|
| Phase 0 | 4 个 CHG | 后端 API + ES 同步 + 单元测试 |
| Phase 0.5 | 5 个 CHG | 表格骨架 + Cell 库 + Hook + Resizer + Pilot |
| Phase 1 | 6 个 CHG | 视频治理库（筛选栏 + 表格 + 侧边栏 + 批量操作） |
| Phase 2 | 5 个 CHG | 源健康中心（告警 + 双 Tab + 健康检测轻量方案） |
| Phase 3 | 6 个 CHG | 审核台（布局 + 播放器 + 快捷键 + 统计 + E2E） |
| **合计** | **~26 个 CHG** | — |
