# Resovo（流光） — 任务看板


> status: active
> owner: @engineering
> scope: single active task workbench
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-21
>
> 单任务工作台：同一时刻只保留 1 个进行中任务。任务完成后删除卡片，历史记录见 `docs/changelog.md`，任务规划见 `docs/task-queue.md`。

---

## M5-ADMIN-BANNER-01 — Banner 后台管理

- **状态**：🔄 进行中
- **任务 ID**：M5-ADMIN-BANNER-01
- **所属序列**：SEQ-20260420-M5-API
- **创建时间**：2026-04-20 19:00
- **实际开始**：2026-04-21 15:00
- **建议模型**：claude-sonnet-4-6
- **执行模型**：claude-sonnet-4-6
- **子代理调用**：无

### 目标

Banner 后台管理 UI（列表页 + 编辑页）+ SortableList admin primitive + ADR-049。

### 文件范围

- 新增 `apps/server/src/app/admin/banners/page.tsx`
- 新增 `apps/server/src/app/admin/banners/[id]/page.tsx`
- 新增 `apps/server/src/components/admin/banners/BannerTable.tsx`
- 新增 `apps/server/src/components/admin/banners/BannerForm.tsx`
- 新增 `apps/server/src/components/admin/banners/BannerDragSort.tsx`
- 新增 `apps/server/src/components/admin/shared/SortableList.tsx`（admin primitive）
- 修改 `apps/server/package.json`：安装 @dnd-kit/core + @dnd-kit/sortable
- 修改 `docs/rules/admin-module-template.md`：追加有序列表章节
- 修改 `docs/decisions.md`：追加 ADR-049
- 新增 `tests/unit/components/admin/banners/BannerTable.test.tsx`

### 验收要点

- ModernDataTable + ColumnSettingsPanel + AdminDropdown + SelectionActionBar + PaginationV2 全套
- 服务端排序（sortField / sortDir）
- BannerDragSort 使用 SortableList，调用 PATCH /v1/admin/banners/reorder
- BannerForm：多语言 title (zh-CN/en)、image_url、link_type、link_target、时间窗、is_active、brand_scope/brand_slug
- brandSlug 在 brand-specific 时显示
- typecheck ✅ / lint ✅ / unit ✅

### 完成备注

（待填写）
