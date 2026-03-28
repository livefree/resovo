# Resovo（流光）— 后台界面统一重构总计划

> status: reference
> owner: @engineering
> scope: admin ui unification strategy reference
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27


> 本文档为后台 UI/UX 统一重构总纲，仅定义统一目标与阶段方向，不包含代码实现细节。

---

## Part A：后台界面统一重构目标

1. 建立统一页面骨架，降低跨页面切换认知成本。
2. 统一同类列表页结构与交互层级，避免“每页一套布局”。
3. 说明文案默认最小化，改为按需 hover 查看。
4. 统一命名与语气，收敛同义多词与状态文案漂移。
5. 控制台/看板/系统页保留必要例外，但遵循统一框架规则。
6. 保证渐进迁移与可回滚，避免一次性大范围改动。

---

## Part B：页面分类与统一方案

### 1. 标准 CRUD 列表页（videos / sources / users）
- 统一骨架：Header + Toolbar + Filters + Table + Pagination
- 头部策略：标题常驻，描述默认 hover
- 文案策略：区块说明不常驻，按钮仅保留动作名

### 2. 审核类页面（content / submissions / subtitles）
- 统一骨架：Header +（可选）Tabs + Toolbar + Table + Pagination
- 头部策略：突出待处理视角，弱化解释性文案
- 文案策略：审核规则 hover 化，空态保留简短常驻提示

### 3. 控制台类页面（crawler）
- 统一骨架：Header + 主 Tab + Monitor Panels + Action Bar + Site Table + Pagination
- 头部策略：标题与主 Tab 同行同层
- 文案策略：运行机制说明 hover 化；系统状态与关键风险常驻
- 例外保留：监控面板、系统状态条、任务控制区

### 4. 看板类页面（admin dashboard / analytics）
- 统一骨架：Header + Overview Cards + Alerts/Trends + Detail Table
- 文案策略：指标解释 hover 化；异常告警常驻
- 例外保留：非表格区可不使用分页

### 5. 系统配置类页面（config / settings / migration / cache / monitor）
- 统一骨架：Header + Config/Action Panels + Result Area（table/log）
- 文案策略：高风险警示常驻，其余说明 hover 化
- 例外保留：monitor 实时指标区、migration 流程态区

---

## Part C：统一页面骨架规范

### 必选区域
1. Header：标题、主入口动作、必要状态徽标
2. Content Area：核心内容（table/panel/form 其一）

### 列表页必选区域
1. Toolbar：主操作与全局搜索
2. Pagination：固定在内容区底部

### 可选区域
1. Description：默认隐藏，标题 hover 展示
2. Filters：独立于 Toolbar 的筛选行
3. Optional Panels：overview / running / status / recent

### 不适用说明
1. 纯表单配置页可无分页
2. 纯看板区可无筛选行

---

## Part D：说明文案统一改造计划

### 必删
1. 与标题语义重复的常驻解释
2. 多区块重复解释同一行为的文案
3. 开发期临时调试提示

### 改为 hover
1. 页面副标题长说明
2. 区块用途说明
3. 列说明与按钮补充说明

### 常驻保留
1. 高风险操作警示
2. 系统异常/冻结/权限限制提示
3. 空态关键引导（单行）

### 默认原则
1. 默认不展示解释，必要时 hover 查看

---

## Part E：命名与语气统一规则

### 页面标题
1. 使用“对象 + 管理/控制台”命名
2. 避免同义并存（如采集入口仅保留“采集控制台”）

### 区块标题
1. 使用名词短语（如“采集概览”“运行任务”“最近结果”）
2. 不写流程句

### 按钮命名
1. 统一动词开头：新增、编辑、删除、导入、导出、暂停、恢复、中止
2. 同动作全后台同名

### 状态文案
1. 统一状态词：排队中、运行中、已暂停、已取消、成功、失败、超时
2. 时间显示：默认相对时间，hover 显示绝对时间

---

## Part F：分阶段重构计划

### Phase 1：统一页面骨架
- 目标：先完成页面结构层级对齐
- 覆盖：CRUD + 审核页优先
- 收益：视觉与操作路径一致
- 风险：自定义布局冲突

### Phase 2：统一文案与 hover 说明
- 目标：文案最小化，建立 hover 说明机制
- 覆盖：全后台
- 收益：页面紧凑、信息噪音下降
- 风险：解释收敛过度影响新用户理解

### Phase 3：收敛重复页面与旧入口
- 目标：明确主入口与兼容入口边界
- 覆盖：content/submissions/subtitles、采集旧入口
- 收益：导航结构清晰、维护成本降低
- 风险：过渡期路径迁移成本

### Phase 4：控制台/看板/系统页收口
- 目标：在统一规范下固化特殊页面模板
- 覆盖：crawler、analytics、dashboard、monitor
- 收益：复杂页面仍可预测、可维护
- 风险：实时区与列表区刷新节奏冲突

---

## Part G：最终后台界面蓝图

### 标准列表页
- 标题简洁
- 工具栏与筛选分层
- 表格为主视觉中心
- 分页固定底部
- 解释默认 hover

### 控制台页
- 标题与主 Tab 同层
- 上层监控面板，下层操作与表格
- 任务详情在面板，表格仅轻状态+快速操作
- 系统状态条常驻

### 系统配置页
- 配置面板主导
- 结果区（表格/日志）次级
- 高风险说明常驻，其余 hover

### 看板页
- 概览卡优先
- 异常告警常驻
- 指标解释 hover
- 明细列表遵循统一表格规范
