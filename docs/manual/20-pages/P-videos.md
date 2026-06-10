# P-videos · 视频库（DataTable 标杆页）

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-1 / 2026-05-21）
> owner: @engineering
> scope: 视频库管理页面使用说明 — 视频检索、编辑、上下架、批量操作
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-06-10

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/videos` |
| 设计稿引用 | reference.md §5.3（标杆页）+ §6.1 列规范 |
| 主任务卡 | M-SN-3（视频库基座 / SEQ-20260429-01）+ CHG-DESIGN-08（视觉对齐）+ CHG-DESIGN-10/12（VideoEditDrawer + cell 沉淀）+ CHG-SN-8-08（行级合并入口）|
| 涉及端点 | `GET /admin/videos` / `POST /admin/videos/:id/review` / `PATCH /admin/videos/:id` / `POST /admin/videos/:id/douban-sync` / `POST /admin/videos/:id/refetch-sources` / `POST /admin/videos/batch-publish` / `POST /admin/videos/batch-unpublish` 等 |
| 适用角色 | editor + admin（部分操作 admin only：`approve_and_publish` / `douban-sync`）|
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-1）|

---

## 1. 这个页面是做什么的

后台所有视频的集中检索、编辑、上下架、行级操作工作台。Resovo 视觉与交互标杆页 — 一体化 DataTable（toolbar + saved views + filter chips + bulk actions + pagination 全内置）。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 视频库 · 副标题（条数 + 视图保存 + 乐观更新）│ 导出 / 添加 │
├──────────────────────────────────────────────────────────────────┤
│ DataTable 一体化：                                                │
│  ┌─ Toolbar: search + saved views + filter chips + 隐藏列 chip ─┐│
│  ├─ Header（sticky + 集成菜单 sort/hide/clear filter）─────────┤│
│  ├─ Body（独立滚动）：                                           ││
│  │   _select / cover(48×72 竖版) / title / type / source_health │  │
│  │   / image_health / visibility / review_status / douban /   │  │
│  │   meta_score / created_at / updated_at / actions(⋯ dropdown)│  │
│  ├─ Bulk Bar（sticky bottom）：批准 / 上架 / 下架 / 重验源 ...   ││
│  └─ Foot（pagination 24px）────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

| 区域 | 名称 | 作用 |
|---|---|---|
| 顶 | PageHeader | 标题 + 副标题（条数 / 标杆说明）+ 「导出 CSV」「+ 添加视频」按钮 |
| 中 | DataTable 一体化 | 14 列 / saved views / filter chips / bulk |

## 3. 常用操作

### 3.1 搜索 / 筛选 / 排序（DataTable 一体化 toolbar）

- **位置**：表格顶部 toolbar
- **搜索**：输入框模糊匹配 title / shortId（debounce 300ms）
- **filter chips**：type / status（已发布/待审/全部）/ visibility / review_status / douban_status 等多 enum/range filter
- **saved views**：点 ⋆ → 保存当前 filter+sort 为命名视图（如「我的待审」「本周新增」「封面失效」）→ sessionStorage 持久化（CHG-DESIGN-02 Step 5）
- **排序**：列头 sortable 列点击切 asc/desc；服务端排序
- **快速失败处理**：搜索/筛选无结果 → EmptyState「无匹配视频」+「清除全部 filter」按钮

### 3.2 编辑某视频（行 inline 或 ⋯ dropdown）

- **位置**：行尾「⋯」dropdown → 「编辑基础信息」（VideoRowActions.tsx）
- **行为**：打开 VideoEditDrawer（680px + fullscreen 切换 + 4 Tab：基础 / 元数据 / 图片 / 字幕）
- **前置**：editor+
- **期望结果**：保存成功 toast + 行级乐观更新 + 抽屉关闭
- **快捷键**：抽屉内 Esc 关 / ⌘S 保存

### 3.3 行级状态操作（⋯ dropdown 完整菜单）

| 操作 | 调用端点 | 权限 |
|---|---|---|
| 编辑基础信息 | （打开 Drawer，PATCH 在 Drawer 内）| editor+ |
| 设为公开 / 内部 / 隐藏 | `PATCH /admin/videos/:id/visibility` | editor+；隐藏需 admin |
| 上架 / 下架 | `POST /admin/videos/:id/review` action=publish/unpublish | editor+ |
| 通过审核 / 拒绝审核 | `POST /admin/videos/:id/review` action=approve/reject | moderator+ |
| 重开审核（rejected → pending）| `POST /admin/videos/:id/review` action=reopen_pending | moderator+ |
| 豆瓣同步 | `POST /admin/videos/:id/douban-sync` | admin only |
| 重新采集源 | `POST /admin/videos/:id/refetch-sources` | editor+ |
| **发起合并**（CHG-SN-8-08）| router.push `/admin/merge?candidate_a=<id>&from=videos` | moderator+ |
| 查看详情（前台）| 新窗口打开前台 `/<segment>/<short_id>` | 所有 |

**乐观更新模式**：visibility / publish / review 操作走 withOptimistic helper（行立即变样式，API 失败回滚）。

### 3.4 批量操作（Bulk bar / 表内 sticky bottom）

- **位置**：勾选 ≥1 行后表内底部出现 Bulk bar
- **可用动作**：批准（批量 approve）/ 拒绝（批量 reject）/ 上架（batch-publish）/ 下架（batch-unpublish）
- **二次确认**：高危批量操作（≥10 行 / 删除类）触发 confirm
- **失败处理**：单条失败不中止全批；最终 toast「N 成功 / M 失败」

### 3.5 添加视频（PageHeader「+ 添加视频」）

- **状态**：✅ **完全实装**（ADR-145 + EP-A + EP-B 闭合 / 2026-05-22）；端到端可用
- **ADR-145 决策**：
  - 行为：VideoEditDrawer 双模式（videoId=null → 创建空表单 POST /admin/videos / videoId 有值 → 编辑模式 PATCH）
  - **必填 3 字段**：title / type / contentRating（与 crawler year=null 8% 实证一致，year/sourceUrl 改 optional）
  - **可选 14 字段**：titleEn / description / coverUrl / year / country / episodeCount / status / rating / director / cast / writers / genres / doubanId
  - **publishMode**：admin 可选 `draft` / `staging`（默认） / `published`（admin 自审自发）
  - **重复检测**：title+year+type 软匹配警告（409 STATE_CONFLICT detail.existingVideoId），admin 可 force=true 跳过
  - **catalog 同步**：复用 MediaCatalogService.findOrCreate(metadataSource='manual') 自动加 locked_fields 最高优先级保护
  - **R-MID-1 第 24 次系统化**：actionType `video.manual_add` + targetKind 复用 `video`
- **当前替代**：通过 crawler 自动派发；少数运营场景待 EP 实施

### 3.6 导出 CSV（PageHeader 「导出」）

- **行为**：按当前 filter / sort 导出可见列至 CSV
- **依赖**：csv-export 共享工具（CHG-SN-7-MISC-FILE-SIZE 沉淀）

## 4. 进阶操作（低频 / 危险）

### 4.1 批量上架（高曝光风险）
- 影响：所选 N 个视频立即对前台公开；如选错 → 用户可见违规内容
- 回滚：批量下架（同入口反向）
- 建议：先用「设为内部」过渡 → 验证 → 上架

### 4.2 重新采集源（耗时操作）
- 影响：触发后台 worker 重新探测该视频所有源；可能持续数分钟
- 何时用：源全失效 / 探测数据明显过期
- 不可中止（worker 会跑完）

## 5. 字段含义（14 列）

| 列 | 含义 | 来源 |
|---|---|---|
| _select | 多选框 | UI 状态 |
| cover | 48×72 竖版海报（CHG-UX2-03 升级）| videos.cover_url / media_catalog.cover_url |
| title | 标题 + shortId · 年份 meta | videos.title + short_id |
| type | 类型 pill | VideoType 11 枚举 |
| year | 出品年份 | media_catalog.year |
| source_health | 源活跃数 + dot 颜色 | siteStats.routeCount + health |
| image_health | P0/P1 封面状态 pill | poster_status / backdrop_status |
| visibility | 可见性 chip | public / internal / hidden |
| review_status | 审核状态 pill | pending_review / approved / rejected |
| douban_status | 豆瓣匹配状态 | pending / matched / candidate / unmatched |
| meta_score | 元数据完整度 0-100 | 字段填充率计算 |
| created_at | 创建时间 | DB 字段 |
| updated_at | 更新时间 | DB 字段 |
| actions | ⋯ dropdown | UI |

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| approved / public / 源全活跃 / 封面健康 |
| 黄（warn）| pending_review / internal / 部分失效 / candidate |
| 红（danger）| rejected / hidden / 源全失效 / 封面 dead / unmatched |
| 灰（muted）| 未审 / 未测 / 数据空 |

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「豆瓣同步」灰显 | 非 admin 角色 | 联系 admin |
| 行操作 dropdown 不响应 | 浏览器扩展拦截 / network 失败 | 刷新页面 |
| 批量上架后部分行未变 | review_status !== approved 时上架被后端拒绝 | 先批量通过审核 → 再上架 |
| 「+ 添加视频」按钮缺失 | 当前实施未提供（**功能缺失，登记 GAPS.md**）| 见 GAPS.md #G-videos-add |
| saved view 丢失 | sessionStorage 在浏览器关闭时清；用 localStorage 持久化需 follow-up | 临时方案：截图记下 filter 组合 |
| 行点击展开是否有效 | 视频库不支持行展开；行展开是 sources 页特性 | 进 VideoEditDrawer 看详情 |

## 8. 与其他页面的关系

- → 进入 [P-moderation](./P-moderation.md)：行级「通过/拒绝」也可在审核台 J/K 流处理
- → 进入 [P-merge](./P-merge.md)：行级「发起合并」深链至 Merge 页 + candidate_a banner（CHG-SN-8-08）
- → 进入 [P-sources](./P-sources.md)：行级「重新采集源」后续可在线路矩阵确认
- → 进入 [P-image-health](./P-image-health.md)：批量看缺图视频
- ← 跳入自 [P-dashboard](./P-dashboard.md)：管理台站 KPI 数字深链到本页 filter
- ↔ 相关工作流：[W1 金票](../10-workflows/W1-crawl-to-publish.md) · ④ 上架步骤 / [W4 合并](../10-workflows/W4-merge-split.md) · §2.2 视频库入口
