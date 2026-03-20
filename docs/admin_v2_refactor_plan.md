# Admin v2 Refactor Plan

更新时间：2026-03-20 12:05

## 目标与约束

- 目标：
  - shared 抽象（代码复用）
  - UI/UX 重构（体验优化）
  - admin 设计系统规范化
- 约束：
  - 功能行为保持不变
  - 不做大规模重写
  - 每步可回滚
  - 基于现有代码提炼，不另起一套框架

## 一、Shared 抽象方案

### 1. 当前重复模式

1. table：`crawler-site` / `videos` / `sources` 重复实现表格壳、空态、loading、分页区。
2. filters：顶部筛选条与表头筛选行两套实现并存，交互口径不一致。
3. toolbar：操作栏与批量栏重复布局逻辑。
4. form dialog：弹层壳、表单字段壳、按钮区重复实现。
5. feedback：toast/loading/error 呈现策略分散。

### 2. shared 目录结构

```text
src/components/admin/shared/
  feedback/
    useAdminToast.ts
    AdminTableState.tsx
  toolbar/
    AdminToolbar.tsx
    AdminBatchBar.tsx
  dialog/
    AdminDialogShell.tsx
  form/
    AdminFormField.tsx
    AdminInput.tsx
    AdminSelect.tsx
  table/
    AdminTableFrame.tsx
    AdminRowActions.tsx
```

### 3. 组件职责与提取来源

1. `useAdminToast`：统一 success/error/info 提示与超时关闭（来源：`CrawlerSiteManager`）。
2. `AdminTableState`：统一表格 loading/empty/error 行（来源：`CrawlerSiteTable` + `VideoTable` + `SourceTable`）。
3. `AdminToolbar`：统一顶部操作栏布局（来源：`CrawlerSiteToolbar`）。
4. `AdminBatchBar`：统一批量操作栏布局（来源：`BatchPublishBar`、`BatchDeleteBar`）。
5. `AdminDialogShell`：统一弹层骨架（来源：`CrawlerSiteFormDialog`、`ConfirmDialog`）。
6. `AdminFormField/Input/Select`：统一表单控件壳（来源：`CrawlerSiteFormDialog`、`ConfigFileEditor`）。
7. `AdminTableFrame`：统一滚动/边框/表头吸顶壳（来源：`CrawlerSiteTable`、`SourceTable`）。
8. `AdminRowActions`：统一行内按钮组布局（来源：`CrawlerSiteTable` 行操作列）。

### 4. 抽象顺序（分阶段）

1. feedback（最小风险）
2. dialog/form（壳层替换）
3. toolbar（壳层替换）
4. table frame/state（壳层替换）
5. row actions / batch bar（布局替换）

### 5. 抽象边界规则

可进 shared：
- 与领域无关的 UI 结构/状态机
- 通用样式壳与交互壳

必须留业务模块：
- API 调用路径
- 字段映射与业务校验
- 列定义、权限判断、领域文案

规则：
- shared 不直接依赖 `site/video/user/source` 领域类型
- shared 仅接收归一化 props

## 二、UI/UX 重构方案（按模块渐进）

### 1. 当前问题（基于截图）

1. toolbar：
   - 主次按钮混排，视觉层级弱
   - “显示列”与核心动作同权重
2. table 行操作：
   - 行内按钮密度高，数据列阅读受干扰
   - 管理操作与采集操作区分不够
3. filters：
   - 表头筛选控件密集且宽度不足
   - 已生效筛选状态不可见
4. dialog / 配置文件：
   - 信息密度高，保存动作在长内容场景下不够稳定可见

### 2. 渐进优化方案（不整页重做）

1. crawler-site：
   - toolbar 两段式（主动作组 / 工具动作组）
   - 行操作改“主按钮 + 更多菜单”
   - 筛选区外置（列头保留排序），并增加“已生效筛选计数”
2. config-file：
   - 增加粘性保存区（不改保存逻辑）
   - 显示 JSON 校验状态（未保存/错误）
3. videos/users/sources：
   - 替换为 shared 的 toolbar/filter/table 壳
   - 保留现有接口与业务行为

### 3. before / after 结构

before：
- 标题 + 混合 toolbar + 表头筛选 + 表格 + 分散反馈

after：
- 标题 + `AdminToolbar` + `AdminFilters` + `AdminTableFrame` + `AdminBatchBar` + 统一 `useAdminToast`

### 4. 操作路径优化

1. 单站操作：默认暴露主入口，次入口收敛到更多菜单
2. 筛选操作：显示筛选命中状态与一键重置
3. 配置文件：保存按钮始终可见，减少滚动往返

### 5. 可复用 shared 映射

- `crawler-site`：`AdminToolbar` / `AdminTableFrame` / `AdminDialogShell`
- `videos`：`AdminBatchBar` / `AdminTableState`
- `sources`：`AdminBatchBar` / `AdminRowActions`
- `users`：`AdminDialogShell`（后续用户操作弹窗扩展时）

## 三、执行计划（工程可执行）

### Phase 1：shared 抽象（从 crawler-site 开始）

子任务：
1. CHG-67 `useAdminToast` 抽离并接入 `crawler-site`
2. CHG-68 `AdminDialogShell + AdminForm*` 抽离并替换 `CrawlerSiteFormDialog`
3. CHG-69 `AdminToolbar` 抽离并替换 `CrawlerSiteToolbar`
4. CHG-70 `AdminTableFrame + AdminTableState` 抽离并替换 `CrawlerSiteTable` 外壳
5. CHG-71 在 `sources/videos` 验证 `AdminBatchBar` 复用

DoD：
- 行为零回归
- 受影响测试通过
- 每任务单 commit

回滚策略：
- 每个 CHG 独立提交
- 仅壳层替换，回滚可单提交撤回

### Phase 2：UI 优化（按模块推进）

子任务：
1. CHG-72 `crawler-site` toolbar 分组与按钮层级优化
2. CHG-73 `crawler-site` 行操作分层（主按钮 + 更多）
3. CHG-74 `crawler-site` 外置筛选条与筛选状态可视化
4. CHG-75 `config-file` 粘性保存区与状态提示
5. CHG-76 `videos/users/sources` 结构对齐

DoD：
- 核心操作路径更短或不变
- UI 结构一致性提升
- 无功能回退

回滚策略：
- 每模块独立提交
- 不改 API 与数据层

### Phase 3：设计系统固化

子任务：
1. CHG-77 落地 `docs/admin_design_system_v1.md`
2. CHG-78 token 映射（button/table/form/modal）
3. CHG-79 交互规范并入 `docs/rules`
4. CHG-80 新增模块模板检查规则

DoD：
- 文档可用于评审与开发
- 至少 2 个模块按规范落地
- 测试与静态检查通过

回滚策略：
- 文档与规则独立提交
- 组件映射保留兼容层
