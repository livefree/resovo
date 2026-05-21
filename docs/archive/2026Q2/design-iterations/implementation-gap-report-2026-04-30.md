# Backend Design v2.1 实现差异报告（更新版）

日期：2026-05-01（原版：2026-04-30，SEQ-20260429-02 全部完成后重新评估）  
范围：`docs/designs/backend_design_v2.1` 设计稿 vs `packages/admin-ui` + `apps/server-next` 当前实现  
口径：只描述当前差异；已闭合项标注完成卡号。

---

## 1. 总结

**SEQ-20260429-02（12 张设计对齐卡）已于 2026-05-01 全部完成。** 原报告的大多数高优先级差异已闭合。当前实现在 Shell / DataTable / 视频库 / Dashboard / AnalyticsView / VideoEditDrawer / Cell 共享层的工程基座与设计稿基本对齐。

**剩余差距主要集中在两个维度：**
1. **10 个占位页面**尚未启动（milestone M-SN-4 至 M-SN-6 范围）——路由 IA 完整但点入后均为 PlaceholderPage；
2. **admin-ui 共享原语层** 仍缺少 Popover、PageHeader、AdminButton 等通用原语，导致新业务页面只能走 inline style 拼凑。

---

## 2. SEQ-20260429-02 完成状态（已闭合原差异）

| 原差异 | 修复卡 | 状态 |
|---|---|---|
| Token 未定义引用（12 个）| CHG-DESIGN-01 | ✅ 完成 |
| DataTable 无 toolbar / saved views / header menu / bulk bar / pagination / filter chips | CHG-DESIGN-02 Steps 1-7B | ✅ 完成 |
| Scrollbar 10px/6px 混用 | CHG-DESIGN-03 | ✅ 完成（全局 6px） |
| Sidebar 无过渡动效 / 折叠时 icon Y 跳跃 | CHG-DESIGN-04 | ✅ 完成 |
| Shell NavTip / footer 文案 / 折叠按钮文案 | CHG-DESIGN-05 | ✅ 完成 |
| Settings 多入口暴露（monitor/cache/config/migration） | CHG-DESIGN-06 | ✅ 完成（收敛单入口 + 双栏容器） |
| Dashboard 通用 StatCard 占位 | CHG-DESIGN-07（7A→7D） | ✅ 完成（8 卡浏览态 + KpiCard/Spark 入 admin-ui） |
| 视频库无 page__head / 无 32×48 poster / 无 DualSignal / 无 VisChip / 无 inline actions | CHG-DESIGN-08（8A→8C） | ✅ 完成 |
| Analytics tab 仍为 redirect 占位 | CHG-DESIGN-09 | ✅ 完成（AnalyticsView：KPI×4 + SVG 图表 + 爬虫任务表） |
| VideoEditDrawer 540px 仅基础信息 | CHG-DESIGN-10（10A→10B） | ✅ 完成（680px + fullscreen + 4 Tab + quick header + footer） |
| 文档真源不一致 | CHG-DESIGN-11 | ✅ 完成 |
| Cell 共享组件分散 / 无共享层 | CHG-DESIGN-12（12A→12B） | ✅ 完成（DualSignal / VisChip / Pill / Thumb / InlineRowActions 入 admin-ui） |

---

## 3. 当前剩余差距

### 3.1 占位页面（高优）

27 个路由中 **10 个仍为 PlaceholderPage**：

| 路由 | 标题 | 里程碑 | 优先级 |
|---|---|---|---|
| `/admin/moderation` | 内容审核 | M-SN-4 | P0（设计稿三栏审核台；需 SplitPane 原语） |
| `/admin/crawler` | 采集控制 | M-SN-5 | P1 |
| `/admin/sources` | 播放线路 | M-SN-5 | P1 |
| `/admin/subtitles` | 字幕管理 | M-SN-5 | P1 |
| `/admin/image-health` | 图片健康 | M-SN-5 | P1 |
| `/admin/merge` | 合并/拆分 | M-SN-5（依赖 ADR-105） | P1 |
| `/admin/home` | 首页编辑 | M-SN-5（依赖 ADR-104） | P1 |
| `/admin/users` | 用户管理 | M-SN-6 | P2 |
| `/admin/submissions` | 用户投稿 | M-SN-6 | P2 |
| `/admin/audit` | 审计日志 | M-SN-6 | P2 |

**已有路由但内容为占位的模块：**

- `/admin/system/settings`：容器已重构（双栏布局 CHG-DESIGN-06），但所有 5 个 Tab 内容均为"正在迁移中"占位文案（reference §5.11 要求 8 类真实表单：基础 / 豆瓣 / 过滤 / 图片 / 通知 / API·Webhook / 缓存·CDN / 登录会话）

### 3.2 admin-ui 共享原语层缺口（中优）

| 缺失原语 | 设计稿出处 | 当前状况 | 影响 |
|---|---|---|---|
| `Popover` | reference §4.5；filter popover / column visibility | 无共享实现；HiddenColumnsMenu 是 DataTable 内置私有实现 | 未来 filter chip popover / select-like 控件无通用壳 |
| `SplitPane` | reference §4.6（moderation 三栏） | 无 | Moderation 页无法实现 |
| `PageHeader` | reference §5 各页 page__head | 各页自实现 inline style；无统一来源 | 视觉碎片化，标题/副标题/actions 区样式不一致 |
| `AdminButton` | reference §4.2 Button 规范 | `<button>` + inline style 散落；admin-ui 无 Button 组件 | 页面按钮样式无法统一管理 |
| `AdminInput / AdminSelect` | reference §4.2 | `<input>` / `<select>` + inline style | Settings 表单一旦落地需大量样式复制 |
| `AdminCard` | reference §4.3 Card 规范 | Dashboard 各卡片独立实现样式 | 卡片边距、阴影、surface 层级无统一来源 |

### 3.3 视频库已知妥协点（低优）

| 妥协点 | 原因 | 状态 |
|---|---|---|
| FilterChipBar 外置 | filter chips 与 toolbar.search 在同一行时 DataTable 内置 chip slot 布局冲突；视频库使用 `hideFilterChips: true` + `toolbar.trailing` 注入外置 FilterChipBar | follow-up 待 CHG-DESIGN-02 Step 7C 或专项卡处理 |
| DualSignal 显示 `unknown/unknown` | API `/admin/videos` 响应 `VideoAdminRow` 无 probe/render 字段；需后端扩展 | 视觉正确（灰色未测）但无实际链路信息；follow-up 待后端 M-SN-4+ |

### 3.4 密度与视觉精调（低优）

| 项目 | 设计稿目标 | 当前状态 |
|---|---|---|
| DataTable body 字体 | 12px | 13px（接近但未精对齐） |
| DataTable `th` 字体 | 11px | 无独立 th token（继承 body） |
| VideoEditDrawer 线路/图片/豆瓣 Tab | 真实 API 集成 | mock UI（follow-up 待 M-SN-4+） |
| Dashboard 编辑态 / CardLibrary | 参见 reference §5.1 编辑态蓝图 | 未实现（M-SN-3+ 后置） |
| 通知/任务 Shell 入口 | 接入真实 API | 仍为 mock 数据（M-SN-4+） |

### 3.5 开发者模式（低优）

| 项目 | 设计稿目标 | 当前状态 |
|---|---|---|
| DevMode 三栏（Tokens / Semantic / Components） | reference §0a、`?dev=1` 只读入口 | 只有 `/admin/dev/components` 组件 Demo |
| Tokens 面板 | design token 可视化浏览 | 未实现 |
| Semantic 面板 | 语义 token 映射查看 | 未实现 |

---

## 4. 更新后的视觉完成度评估

| 模块 | 完成度 | 备注 |
|---|---|---|
| Shell / 导航 / 侧栏 | **高**（85%） | 过渡 / NavTip / 折叠 / footer 已对齐；Notifications/Tasks 仍 mock |
| Dashboard 浏览态 | **高**（90%） | 8 卡 + KPI + Analytics 全部落地；编辑态/全屏后置 |
| 视频库 DataTable | **高**（85%） | toolbar / saved views / header menu / bulk / flash / poster / VisChip / DualSignal / InlineRowActions 全落地；FilterChipBar 外置妥协 |
| VideoEditDrawer | **高**（80%） | 4 Tab / fullscreen / quick header / footer 落地；线路/图片/豆瓣为 mock |
| Analytics 分析 | **高**（80%） | AnalyticsView 落地（period select / KPI / SVG 图表 / 爬虫任务表）；全 mock 数据 |
| Settings 容器 | **中**（40%） | 双栏布局落地；所有 Tab 内容仍为占位 |
| 内容审核 | **未实现**（0%） | M-SN-4 P0；需 SplitPane 原语 |
| 采集控制 / 播放线路 | **未实现**（0%） | M-SN-5 |
| 其余 7 个占位页 | **未实现**（0%） | M-SN-5~6 |
| admin-ui 通用原语 | **中**（60%） | DataTable / Drawer / Modal / Dropdown / Cell 组件已完整；Popover / SplitPane / AdminButton / PageHeader 缺失 |

---

## 5. 建议下一步优先级

1. **内容审核 Moderation**（M-SN-4，P0）— 设计稿 §5.2 三栏审核台是最高优先级业务视图；需先在 admin-ui 落地 `SplitPane` 原语，再做业务页。
2. **Settings 真实表单**（M-SN-5/6 前导）— 设置页是运营最频繁入口之一；8 类 Tab 内容补全（尤其"基础信息 / 豆瓣 / 过滤"前 3 项）。
3. **SplitPane / Popover 原语**（admin-ui 补充）— 这两项是多个业务页的前置依赖（Moderation / filter popover），优先于直接写业务页面。
4. **采集控制 + 播放线路**（M-SN-5，P1）— 站点展开 + 线路别名是运营核心流程。
5. **表格密度精调**（低优）— body 13px→12px + th 11px token；视觉改动小、影响全局，单独小卡处理。

---

## 6. 无需再关注的项目（已闭合）

以下原报告中的差异项已通过 SEQ-20260429-02 完全解决，不需要再次评估：

- Token 未定义引用（CHG-DESIGN-01 ✅）
- Sidebar 过渡 / icon Y 跳跃（CHG-DESIGN-04 ✅）
- Shell 视觉对齐（CHG-DESIGN-05 ✅）
- Settings 多入口（CHG-DESIGN-06 ✅）
- DataTable 框架扩展（CHG-DESIGN-02 ✅）
- 滚动条统一（CHG-DESIGN-03 ✅）
- 视频库 poster / DualSignal / VisChip / InlineRowActions（CHG-DESIGN-08 ✅）
- Dashboard StatCard 占位（CHG-DESIGN-07 ✅）
- Analytics 空内容（CHG-DESIGN-09 ✅）
- VideoEditDrawer 540px 仅基础表单（CHG-DESIGN-10 ✅）
- Cell 共享组件无统一层（CHG-DESIGN-12 ✅）
