# P-home · 首页运营位编辑器

> status: 🟢 完整定稿（CHG-SN-8-MANUAL-BATCH-2 / 2026-05-21）

## 0. 元信息

| 字段 | 值 |
|---|---|
| 真源页面路径 | `/admin/home` |
| 设计稿引用 | reference.md §5.7 |
| 主任务卡 | CHG-SN-5-04（ADR-104 home_modules 6 端点）+ -05/-06（实施）+ CHG-SN-5-07（视图基座）+ CHG-SN-7-MISC-HOME-1（sticky 预览）+ -HOME-2（PageHeader 双按钮）+ CHG-SN-8-FUP-HOME（ContentRefPicker 接入 / 用户问题 #10）+ CHG-SN-8-MANUAL-BATCH-2（手册定稿） |
| 涉及端点 | `GET /admin/home-modules`（含禁用 + 过期）/ `POST` / `PATCH /:id` / `DELETE /:id` / `POST /reorder` / `POST /:id/publish-toggle`（ADR-104）|
| 适用角色 | editor + admin |
| 最近更新 | 2026-05-21（CHG-SN-8-MANUAL-BATCH-2）|

---

## 1. 这个页面是做什么的

后台编辑前台首页 4 类运营位（Banner / featured 推荐位 / Top10 / type_shortcuts 分类入口）。左侧编排列表 + 右侧 sticky 前台实时预览（CHG-SN-7-MISC-HOME-1 实装），改后立即在预览看效果。

## 2. 页面布局

```
┌──────────────────────────────────────────────────────────────────┐
│ PageHeader: 首页运营 · Actions: 「预览前台」+ 「新建模块」 (HOME-2)│
├──────────────────────────────────────────────────────────────────┤
│ Segment：Banner / 推荐位 (featured) / Top10 / 分类入口 (type_shortcuts)│
├──────────────────────────────────────────────────────────────────┤
│ 1fr / 360px 布局（CHG-SN-7-MISC-HOME-1）：                       │
│  ┌─ 左侧编排列表 ───────────┬─ 右侧 sticky 预览 (HomePreviewPanel) ┐│
│  │ Module item：             │ 前台实时渲染 iframe / 模拟         ││
│  │  drag handle              │                                    ││
│  │  + 序号 + 120×54 横图     │                                    ││
│  │  + title / meta / pills   │                                    ││
│  │  + edit / preview / delete│                                    ││
│  └───────────────────────────┴────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## 3. 常用操作

### 3.1 新建模块（PageHeader「新建模块」 · CHG-SN-7-MISC-HOME-2）

- **流程**：点击 → HomeModuleDrawer 打开（创建模式）
- **表单字段**（含 CHG-SN-8-FUP-HOME ContentRefPicker 升级）：
  1. slot 选择（4 类型；变更时 contentRefType 自动回落到该 slot 允许的首项）
  2. brandScope（global / brand-specific）+ brandSlug 条件可见
  3. contentRefType 选择
  4. **内容引用**（ContentRefPicker · 不再是反人类单 input）：
     - type='video' → VideoPicker 搜索式选视频（消灭 UUID 输入）
     - type='external_url' → URL input + 实时校验
     - type='custom_html' → HTML 片段 ID 输入
     - type='video_type' → 11 VideoType 枚举下拉
  5. 排序权重 + startAt / endAt（ISO 8601）
  6. 提交 → `POST /admin/home-modules`

### 3.2 编辑现有模块（行尾「edit」icon）

- **触发**：行级 edit → HomeModuleDrawer 编辑模式
- **行为**：调 `PATCH /admin/home-modules/:id`（注：**禁止改 enabled**，走 publish-toggle 单独路径，ADR-104 D-104）

### 3.3 排序（drag handle 拖拽）

- **行为**：拖动 → `POST /admin/home-modules/reorder` 批量更新 ordering（事务）
- **效果**：左侧列表立即重排 + 右侧预览同步

### 3.4 启用 / 禁用（publish-toggle）

- **位置**：行尾 toggle 或 publish icon
- **行为**：调 `POST /admin/home-modules/:id/publish-toggle`（显式传 enabled 值；不允许 PATCH 修改）
- **效果**：禁用模块在前台立即隐藏

### 3.5 删除模块（行尾「delete」danger icon）

- **行为**：confirm + `DELETE /admin/home-modules/:id` 硬删除（不软删，ADR-104 D-104）
- **回滚**：不可，需重新创建

### 3.6 预览前台（PageHeader · CHG-SN-7-MISC-HOME-2）

- **位置**：「预览前台」ghost 按钮
- **行为**：新窗口打开 `/`（前台首页）查看真实效果
- **右侧 sticky 预览的区别**：sticky 是 iframe 模拟；新窗口是真实 SSR + 用户态

## 4. 进阶操作

### 4.1 brand-specific 模块

- 与多品牌部署关联；当前**多品牌路由层面已支持**但前台消费链路待 follow-up（GAPS.md #G-home-brand-multi）
- 仅 brandSlug 字段已存

### 4.2 时效模块（startAt / endAt）

- 设定开始 / 结束时间 → 自动启用 / 禁用
- 后台 worker 周期扫描；UI 不需触发

## 5. 字段含义

| 字段 | 含义 |
|---|---|
| slot | banner / featured / top10 / type_shortcuts |
| brandScope | global（所有品牌通用）/ brand-specific（仅 brandSlug 品牌可见）|
| contentRefType | video / external_url / custom_html / video_type |
| contentRefId | 根据 contentRefType 不同含义（UUID / URL / HTML 片段 ID / 枚举值）|
| ordering | 同 slot + brand 内排序权重 |
| enabled | 是否在前台可见 |
| startAt / endAt | 时效（ISO 8601，留空 = 立即生效 / 永久）|

## 6. 状态颜色

| pill | 含义 |
|---|---|
| 绿（ok）| 已启用 + 时效内 |
| 黄（warn）| 待生效（startAt 未到）|
| 灰（muted）| 已禁用 / 已过期 |
| 红（danger）| 配置错误（如 contentRefId 失效）|

## 7. FAQ

| 现象 | 原因 | 解决 |
|---|---|---|
| 「内容引用 ID」让我输 UUID | 已废除（CHG-SN-8-FUP-HOME）| 刷新页面应自动用 ContentRefPicker |
| 改 enabled 不生效 | PATCH 不接受 enabled（ADR-104 D-104 协议）| 走 publish-toggle |
| 前台未看到改动 | CDN 缓存 / 等 5 分钟 / 强制刷新 | 待缓存过期 |
| 拖拽不响应 | 浏览器扩展拦截 / 触摸设备 | 用桌面鼠标 |
| 时效模块未自动启用 | worker 未运行 | 查 cron job |

## 8. 与其他页面的关系

- → 跳出到 [P-videos](./P-videos.md)：ContentRefPicker video 类型搜索深链
- → 前台 `/`：「预览前台」新窗口
- → 跳出到 [P-audit](./P-audit.md)：所有 home_modules CRUD 写 audit log（ADR-104 audit 扩 5 actionType + 1 targetKind）
- ↔ 相关工作流：[W5 首页编排](../10-workflows/W5-home-curation.md)
