# Admin Module Template Rule

更新时间：2026-03-20 01:33

## 适用范围

- `src/components/admin/system/*`
- 后续新增或重构的 admin 业务模块

## 目标

- 统一模块目录结构
- 降低入口层业务耦合
- 确保任务可按模块粒度回滚

## 目录模板

```text
module/
  components/
    XxxTable.tsx
    XxxFilters.tsx
    XxxActions.tsx
  hooks/
    useXxxList.ts
    useXxxFilters.ts
  utils/
    *.ts
  types.ts
```

## 约束

1. 页面入口层只做模块装配，不写业务逻辑。
2. 业务状态优先下沉到 `hooks/`，避免堆积在容器组件。
3. 解析/映射/格式化逻辑下沉到 `utils/`。
4. 单任务单 commit，不混入无关改动。
5. 新记录统一追加到文档尾部（append-only）。
6. UI 改动禁止触碰：数据结构、字段、API 调用顺序、异步流程、权限逻辑。
7. UI 改动仅允许：DOM 结构调整、按钮位置调整、样式与视觉层级调整。
8. 任一 PR 仅允许一个维度（shared / UI / 逻辑），禁止混提。
9. v2 范围内禁止直接使用 `confirm()`，删除类操作必须使用 `ConfirmDialog`。
10. v2 范围内 toast 计时关闭必须使用 `useAdminToast`，禁止 `toast + setTimeout` 自管。

## 验收清单

- `npm run typecheck`
- `npm run lint`
- `npm run verify:admin-guardrails`
- `npm run test:run -- <受影响测试>`
- 手动回归关键交互（按任务定义）
- 对表格类改动，必须补充：
  - 列宽拖拽像素级一致（允许 ±1px）
  - 刷新后滚动位置保持
  - sticky header 无抖动
  - selection 勾选状态不丢失

## 备注

- 本规则对存量代码采用增量收敛策略，不强制一次性迁移。
