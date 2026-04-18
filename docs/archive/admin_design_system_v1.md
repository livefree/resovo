# Admin Design System v1（Light）

> status: archived
> owner: @engineering
> scope: admin design system v1 reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


更新时间：2026-03-20 12:05

## 1. 组件规范

### 1.1 Button

变体：
- `primary`：主提交流程（新增、保存、确认）
- `secondary`：普通操作（筛选、导入、导出）
- `danger`：破坏性动作（删除、批量删除）

规范：
- 尺寸：`h-8`（紧凑）、`h-9`（默认）
- 文案：动词优先（保存、删除、导入）
- 禁用态：降低不透明度，不改变布局
- loading：按钮内文案切换，不引发布局跳动

### 1.2 Table

规范：
- 结构：`Toolbar -> Filters -> Table -> Pagination/BatchBar`
- 表头：支持吸顶，保持列对齐
- 行高：统一（默认 `py-3`）
- 空态：统一文案与布局
- loading：统一“加载中…”行，不使用整页遮罩
- 操作列：固定宽度区间，防止挤压内容列

### 1.3 Form

规范：
- `label + field + help/error` 三段结构
- 错误提示紧贴字段下方
- 输入控件统一边框、focus、error 视觉
- 提交区固定在表单底部，主按钮靠右

### 1.4 Modal

规范：
- 固定三段：header / body / footer
- header：标题 + 关闭按钮
- footer：次按钮在左、主按钮在右（danger 仍在主按钮位）
- 支持 `loading` 状态，禁止重复提交

## 2. 交互规范

### 2.1 删除确认

必须规则：
- 所有不可逆操作必须二次确认
- 弹窗包含影响范围（数量/对象）
- 明确“不可撤销”提示

### 2.2 Loading 行为

规则：
- 列表首屏：表格内 loading 行
- 行内操作：仅行内/按钮级 loading
- 保存操作：按钮级 loading + 防抖重复提交

### 2.3 Toast 规则

规则：
- 成功：简短结果 + 可选数量（如“已同步 12 条”）
- 失败：必须带失败原因（可解析时）
- 自动关闭：3-4 秒
- 同类消息去重（避免短时间堆叠）

## 3. 布局规范

### 3.1 Spacing

- 基线：4px
- 常用间距：8 / 12 / 16 / 24
- section 间距：默认 16（复杂页 24）

### 3.2 Section 结构

推荐顺序：
1. 标题 + 说明
2. Toolbar
3. Filters
4. Data 区（table/list）
5. 分页或批量操作区

### 3.3 Toolbar 排布

规则：
- 左侧：主动作（新增、主执行）
- 中间：次动作（导入导出、批量入口）
- 右侧：状态反馈（toast、统计）

## 4. 迁移与治理

### 4.1 渐进迁移

- 先替换壳层组件（不动业务逻辑）
- 每个模块独立迁移、独立回滚
- 迁移顺序：`crawler-site -> sources -> videos -> users`

### 4.2 验收清单

- `npm run typecheck`
- `npm run lint`
- `npm run test:run -- <受影响测试>`
- 手动验证关键路径：
  - 筛选
  - 排序
  - 行操作
  - 新增/编辑
  - 删除确认
