# Admin Module Template Rule

更新时间：2026-03-20 11:50

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

## 验收清单

- `npm run typecheck`
- `npm run lint`
- `npm run test:run -- <受影响测试>`
- 手动回归关键交互（按任务定义）

## 备注

- 本规则对存量代码采用增量收敛策略，不强制一次性迁移。
