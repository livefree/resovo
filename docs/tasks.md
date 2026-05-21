# Resovo（流光） — 任务看板

> last_reviewed: 2026-05-20

---

## 进行中任务

### CHG-SN-7-MISC-API-QUERIES-SIZE — db/queries 5 文件主动拆分

**状态**：执行中
**优先级**：🟡 P2
**开始时间**：2026-05-20
**建议模型**：sonnet

**目标**：将 5 个超过 500 行的 db/queries 文件拆分成更小的文件（均 ≤ 500 行），通过 barrel re-export 保持所有外部 import 路径零变化。

**当前行数 vs 目标**：
- `videos.ts` 1609L → 4 文件（videos.internal.ts + videos.ts ≤500 + videos.mutations.ts ≤500 + videos.crawler.ts ≤500 + videos.status.ts ≤500）
- `sources.ts` 818L → 3 文件（sources.internal.ts + sources.ts ≤500 + sources.maintenance.ts ≤500）
- `crawlerTasks.ts` 628L → 3 文件（crawlerTasks.types.ts + crawlerTasks.ts ≤500 + crawlerTasks.queries.ts ≤500）
- `mediaCatalog.ts` 577L → 3 文件（mediaCatalog.types.ts + mediaCatalog.ts ≤500 + mediaCatalog.mutations.ts ≤500）
- `imageHealth.ts` 648L → 2 文件（imageHealth.ts ≤500 + imageHealth.scan.ts ≤500）

**分割原则**：
- 共享内部类型（DbRow 接口、mapRow 函数、SQL 常量）提取到 `*.internal.ts` 或 `*.types.ts`
- 子文件从 internal/types 文件导入，避免循环依赖
- 主文件 barrel re-export 所有子文件的公开导出
- 所有 external import 路径（如 `from '@/db/queries/videos'`）保持不变

**文件范围**：
- `apps/api/src/db/queries/videos.ts` + 4 个新建子文件
- `apps/api/src/db/queries/sources.ts` + 2 个新建子文件
- `apps/api/src/db/queries/crawlerTasks.ts` + 2 个新建子文件
- `apps/api/src/db/queries/mediaCatalog.ts` + 2 个新建子文件
- `apps/api/src/db/queries/imageHealth.ts` + 1 个新建子文件

**执行模型**：claude-sonnet-4-6
**子代理调用**：无
