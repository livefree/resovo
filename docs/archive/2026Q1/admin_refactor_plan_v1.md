# Admin System 重构方案（v1.1，可执行版）

> status: archived
> owner: @engineering
> scope: historical admin system refactor plan v1.1
> source_of_truth: no
> supersedes: none
> superseded_by: docs/admin_restructure_plan.md
> last_reviewed: 2026-03-27
>
生成时间：2026-03-20 01:32  
最后更新时间：2026-03-20 18:12  
状态：仅更新规划，暂不执行代码重构

---

## 一、单一权威文档与边界

- 本文件为唯一权威版本（Source of Truth）。
- `src/components/admin/dashboard/admin_refactor_plan_v1.md` 仅保留跳转说明，不再维护正文，避免双份漂移。
- 本方案当前只覆盖 `src/components/admin/system/*` 后台系统管理域，不扩展到其他 admin 模块。

---

## 二、目标目录结构（按现状修正）

```text
src/components/admin/
  shared/
    layout/
    form/
    feedback/
    overlay/
    table/

  system/
    crawler-site/
    system-config/
    site-settings/
    monitoring/
    migration/
```

说明：
- `CacheManager/PerformanceMonitor/DataMigration` 现位于 `system/`，本次规划按真实位置执行，不再写成 `dashboard/`。

---

## 三、文件迁移映射（按模块）

### 1) CrawlerSiteManager.tsx（最高优先级，先做纵向切片）

拆分目标：
- `crawler-site/CrawlerSiteManager.tsx`（容器）
- `crawler-site/components/CrawlerSiteTable.tsx`
- `crawler-site/components/CrawlerSiteFilters.tsx`
- `crawler-site/components/CrawlerSiteFormDialog.tsx`
- `crawler-site/hooks/useCrawlerSites.ts`
- `crawler-site/hooks/useCrawlerSiteFilters.ts`
- `crawler-site/hooks/useCrawlerSiteSelection.ts`
- `crawler-site/hooks/useCrawlerSiteValidation.ts`
- `crawler-site/hooks/useCrawlerSiteColumns.ts`（新增：列显隐/列宽/排序状态持久化）

### 2) ConfigFileEditor.tsx

拆分目标：
- `system-config/ConfigFileEditor.tsx`
- `system-config/components/ConfigEditorPanel.tsx`
- `system-config/components/ConfigSubscriptionPanel.tsx`
- `system-config/hooks/useSystemConfig.ts`
- `system-config/utils/validateConfigJson.ts`

### 3) SiteSettings.tsx

拆分目标：
- `site-settings/SiteSettings.tsx`
- `site-settings/hooks/useSiteSettings.ts`
- `site-settings/components/SettingsSection.tsx`

### 4) CacheManager.tsx / PerformanceMonitor.tsx（统一 monitoring）

拆分目标：
- `monitoring/CacheManager.tsx`
- `monitoring/PerformanceMonitor.tsx`
- `monitoring/hooks/useCacheStats.ts`
- `monitoring/hooks/usePerformanceStats.ts`
- `monitoring/components/StatCard.tsx`
- `monitoring/services/monitoringAdminService.ts`

### 5) DataMigration.tsx

拆分目标：
- `migration/DataMigration.tsx`
- `migration/hooks/useDataMigration.ts`
- `migration/components/ImportResultModal.tsx`

---

## 四、实施顺序（v1.1）

1. Phase A：拆 `CrawlerSiteManager`（只拆结构，不改行为）
2. Phase B：拆 `ConfigFileEditor`
3. Phase C：整合 `monitoring`（Cache + Performance）
4. Phase D：拆 `SiteSettings` 与 `DataMigration`
5. Phase E：再抽 `shared` 复用组件（最后做，避免过早抽象）

---

## 五、行为不变约束（重构期间强制）

以下行为必须 100% 保留：
- 视频源列表列显隐状态记忆
- 排序/筛选状态记忆
- 表头分隔拖拽调宽（含持久化）
- 导入 JSON 兼容逻辑（`crawler_sites/api_site/sites[]` + 字段别名）
- 现有批量操作、行内编辑、采集触发、验证流程

任何阶段只要触碰上述行为，必须补对应回归测试后方可合并。

---

## 六、每阶段交付与验收门槛

每个子任务都必须满足：
- `npm run test:run -- <相关测试>` 通过
- `npm run typecheck` 通过
- `npm run lint` 通过
- 文档追加：`docs/tasks.md`、`docs/changelog.md`、`docs/run-logs.md`、`docs/task-queue.md`
- 单任务单 commit，可回滚

---

## 七、回滚与风险控制

- 每阶段独立分支提交，禁止跨阶段混提。
- UI 拆分前先保留旧容器作为对照，完成后再删旧实现。
- 发现行为偏差时，直接回滚到上一阶段 commit，不做热修拼补。

---

## 八、完成标志（修订版）

- 关键行为回归测试覆盖并稳定通过
- 模块边界清晰（容器/展示/hooks/services 分离）
- 每阶段可独立上线与回滚
- 新需求可在单模块内修改，不再牵动 500+ 行文件

---

（完）
