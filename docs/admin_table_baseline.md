# Admin Table Baseline（统一基线）

> status: reference
> owner: @engineering
> scope: admin table interaction baseline reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 生效时间：2026-03-21
> 目标：将后台所有列表页统一到同一套表格能力，降低维护成本，保证交互一致性。

---

## 1. 统一标准

1. 默认分页：所有列表页默认采用分页展示。
2. 后端分页优先：默认使用后端分页；仅在数据量明确较小且已评估风险时，允许前端排序作为过渡方案。
3. 固定容器高度：列表容器采用固定高度并独立滚动，不依赖整页滚动。
4. 固定行高：每行高度固定，不随内容变化。
5. 文本显示：长文本默认单行截断，hover 显示完整内容（tooltip/title）。
6. 状态记忆：离开页面后，列表状态可恢复（排序/列显隐/列宽/分页/筛选）。

---

## 2. shared table 能力边界

### 2.1 必须进入 shared 的能力

1. 列排序能力（前端排序与后端排序适配接口）。
2. 列显隐能力。
3. 列宽拖拽能力。
4. 统一表格容器（固定高度 + 独立滚动）。
5. 固定行高与单行截断样式约束。
6. 分页壳与分页状态管理。
7. 列表状态持久化能力（统一 hook + key 规范）。

### 2.2 必须留在业务页实现的能力

1. 列定义与字段语义映射。
2. 业务筛选项与筛选语义。
3. 行内业务操作（审核、发布、删除、采集、验证等）。
4. 业务请求参数映射与错误处理。
5. 权限控制逻辑。

### 2.3 关键约束

1. `/admin/crawler` 的“采集配置表”可作为 shared table 样板。
2. 仅抽取其“表格通用能力”，不反向抽象采集控制台业务逻辑。

---

## 3. useAdminTableState 规范

## 3.1 state schema（建议）

```ts
type AdminTableState = {
  sort?: { field: string; dir: 'asc' | 'desc' }
  columns?: Record<string, { visible: boolean; width?: number }>
  pagination?: { page: number; pageSize: number }
  filters?: Record<string, string | number | boolean | null>
  scroll?: { top?: number; left?: number }
}
```

## 3.2 storage key 规范

```text
admin:table:<route>:<tableId>:v1
```

示例：

```text
admin:table:/admin/videos:video-table:v1
admin:table:/admin/sources:source-table:v1
admin:table:/admin/crawler:crawler-site-table:v1
```

规则：
1. `<route>` 取页面路由（如 `/admin/videos`）。
2. `<tableId>` 在同一路由下必须唯一。
3. 结构变更时升级版本号（`v1 -> v2`），不得混用旧 schema。

---

## 4. 验收基线（适用于所有列表页）

1. 可排序列支持排序（按页面策略前端/后端实现）。
2. 支持列显隐与列宽拖拽，且状态可恢复。
3. 长文本不会撑高行，hover 可查看完整内容。
4. 行数较多时仅列表区域滚动，页面主体不抖动。
5. 分页行为稳定，离页后可恢复页码与筛选条件。

---

## 5. 例外场景（已登记）

1. `crawler` 采集配置表目前无分页：由于业务要求单页批量操作与行内采集触发，暂维持无分页模式。
2. `analytics/cache/monitor` 属于运营监控表：数据规模较小，维持前端排序 + 无分页。
3. `crawler tasks` 任务记录页暂未接入 shared 列能力：其查询口径与任务控制链路仍独立，后续按任务模型统一再评估。

---

## 6. 回滚手册（最小回滚）

1. 页面级回滚优先：按任务粒度回退对应 commit，不跨任务混回滚。
2. 状态持久化异常时：
   - 清理对应 key：`admin:table:<route>:<tableId>:v1`
   - 验证默认列元数据与排序是否恢复。
3. 交互异常（列宽/显隐/排序）时：
   - 先回退页面迁移 commit；
   - 保留 shared 基础 hook，不做跨页面连带回退。
4. 文档回滚：仅回退 `docs/*` 提交，不影响业务代码提交历史。
5. 任何回滚后必须重新执行：
   - `npm run typecheck`
   - `npm run lint`
   - `npm run test:run`
