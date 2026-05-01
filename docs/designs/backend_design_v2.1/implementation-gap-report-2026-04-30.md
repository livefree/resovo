# Backend Design v2.1 实现差异报告

日期：2026-04-30  
范围：`docs/designs/backend_design_v2.1` 更新稿 vs `packages/admin-ui` 与 `apps/server-next` 当前后台实现  
结论口径：本报告只描述当前差异，不把设计稿中尚未落地的能力视为已完成。

## 1. 总结

当前实现已经从 2026-04-28 截图中的“M-SN-1 极简骨架”推进到可运行的 AdminShell、Dashboard、视频库 DataTable、设置页容器、通知/任务抽屉、基础 Modal/Drawer/Dropdown 原语。但与 v2.1 最新设计稿相比，视觉完成度仍不均衡：Shell 与 DataTable 的工程基座较接近目标，业务页面和弹层规范页面缺口明显，设置/采集/开发者模式/弹层规范这次设计新增内容大多尚未被页面消费。

最大降级点不是单个颜色或间距，而是“设计稿的组件化视觉语言没有完整下沉到业务页面”。目前很多页面仍用 inline style 或占位页承接，导致 surface 层级、密度、页头、卡片、按钮、表单、空态等视觉合同没有统一来源。

## 2. 验证依据

- 设计真源：`docs/designs/backend_design_v2.1/reference.md` 已明确 `index.html` 与 `app/*.jsx` 渲染结果优先，且“目标设计稿不等于已落地能力”。
- 运行探测：`npm run dev:server-next` 未能新开服务，因为 `3003` 已被占用；复用已有服务后，未带 cookie 的 `/admin*` 返回 307 到 `/login`，带 `refresh_token=dev; user_role=admin` 后 `/admin`、`/admin/videos`、`/admin/system/settings`、`/admin/crawler` 均返回 200。
- 代码抽样：重点检查 `packages/admin-ui/src/shell`、`packages/admin-ui/src/components/data-table`、`packages/admin-ui/src/components/overlay`、`apps/server-next/src/app/admin`。

## 3. 模块差异

| 模块 | 设计稿目标 | 当前实现 | 差异等级 |
|---|---|---|---|
| Shell / 导航 | 232/60 侧栏、顶栏搜索、健康状态、消息/任务入口、折叠过渡、6px 滚动条 | AdminShell 已接入，折叠过渡、等高分区、顶栏入口和全局滚动条已有实现 | 中 |
| Dashboard / 管理台站 | 异常关注、工作流、KPI、活动、站点健康、分析 Tab，后续有编辑/卡片库/全屏态 | 浏览态卡片已落地；分析 Tab 仍占位；编辑态/卡片库/全屏态未落地 | 中 |
| 视频库 / DataTable | 旗舰表格：内置 toolbar、保存视图、表头菜单、sticky header、bulk bar、分页、行闪烁 | DataTable 已内置 toolbar/header menu/hidden cols/filter chips/bulk/pagination；视频库已消费主要 props | 中 |
| 设置页 | 8 类设置：基础、豆瓣、过滤、图片、通知、API/Webhook、缓存/CDN、登录会话；内容是实际表单 | 当前只有 5 个 Tab 容器，所有 Tab 内容仍是迁移占位文案 | 高 |
| 采集控制 | KPI + 实时任务时间轴 + 站点列表展开 + 线路/别名 + 分类映射 + MACCMS 配置 | `/admin/crawler` 仍是 `PlaceholderPage` | 高 |
| 播放线路 | 按视频分组、线路矩阵、失效源批量替换、全局别名表 | `/admin/sources` 仍是 `PlaceholderPage` | 高 |
| 内容审核 | 三栏审核台、Tab、决策卡、线路网格、证据抽屉、发布预检、拒绝历史 | `/admin/moderation` 仍是 `PlaceholderPage` | 高 |
| 开发者模式 | Tokens / Semantic / Components 三栏，正式入口 + `?dev=1` 只读入口 | 只有 `/admin/dev/components` 组件 Demo；未实现设计稿三栏 DevMode 页面和导航入口 | 高 |
| 弹层规范 | 独立规范页：Modal / Drawer / Popover 选择流程 + 实例演示 | 有 Modal/Drawer/AdminDropdown 原语和组件 Demo；没有“弹层规范”页面，也没有 Popover 规范原语 | 高 |
| 用户/审计/投稿/字幕/图片健康/合并/首页 | 设计稿给出各自页面方向 | 多数仍为占位页或重定向 | 高 |

## 4. 视觉降级点

1. Surface 层级被压平。设计稿要求 `bg0..bg4` 五档 surface，并强调不能一个页面全用同一 surface。当前实现侧大量使用 `--bg-surface / --bg-surface-raised / --bg-surface-elevated`，在 light theme 下这些变量接近或相同，卡片、表格、浮层的层级感弱于设计稿。

2. 密度不稳定。设计稿的后台工具密度以 11/12/13px 为主；当前 token 只有 `xs=12px`、`sm=14px`、`base=16px`，部分 Shell 和页面继续使用 `--font-size-sm` 或 14px，占位页还使用 24px 标题，整体比设计稿松。

3. 页面级样式仍分散。Settings、Dashboard、视频库批量按钮、Placeholder 等都在业务文件里定义局部 style；这符合快速接入，但和设计稿“缺组件能力先补 admin-ui，不在业务页局部拼凑”的要求冲突。

4. 弹层只完成底层可用性，未完成规范视觉。Modal/Drawer 具备 portal、遮罩、ESC、focus trap 等能力，但 header/body/footer 密度、入场动画、按钮区、Popover 选择流程页尚未对齐。Drawer 目前默认 480px，设计稿视频编辑 Drawer 是更完整的 480-720px/全屏/多 Tab 语义。

5. 表格基座已进展，但仍有视觉妥协。DataTable 已统一单一 scrollport、toolbar、bulk、pagination，但注释仍保留早期“不内置 Toolbar/Pagination”的旧描述；视频库业务 filter chips 仍走外置 `FilterChipBar`，内置 filter chips 被关闭，说明一体化合同和业务筛选模型还没完全合并。

6. 新增设计稿重点尚未被路由承接。设置补全、采集展开、开发者模式、弹层规范是本次更新核心，但当前只有设置容器和组件 Demo 有部分承接，采集、开发者、弹层规范均没有同等页面实现。

## 5. 已接近设计稿的部分

- Shell 的关键妥协已经被工程化：侧栏宽度过渡、分区标题保留高度、active indicator、全局 6px 滚动条均已接入。
- DataTable 已从“纯表格”推进到“表格框架”：内置 toolbar、表头菜单、隐藏列 chip、bulk bar、pagination 和 sticky header。
- 视频库已经是当前最接近设计稿表格语言的标杆消费方。
- Dashboard 已经不再是普通 KPI 堆叠，而是按异常关注、工作流、指标、活动、站点健康拆出了具体卡片。
- 通知和后台任务抽屉已接入 Shell，并具备进度、重试、取消、全部已读等基础交互。

## 6. 建议优先级

1. 先补 `packages/admin-ui` 的基础视觉原语：`PageHeader`、`AdminButton`、`AdminInput`、`AdminCard`、`Pill/Badge`、`Popover`、`SettingsFormSection`。否则继续做业务页会扩大 inline style 分裂。
2. 把设置页从“5 Tab 占位”补到设计稿最低可用形态：至少落地基础信息、豆瓣、过滤、图片、通知、API/Webhook、缓存/CDN、登录会话 8 项导航和真实表单 skeleton。
3. 以采集控制作为下一张复杂页面标杆：站点列表展开 + 线路/别名先落地，再补任务时间轴和 MACCMS 配置。
4. 单独实现“开发者模式”和“弹层规范”页面，作为设计系统自检入口；不要把 `/admin/dev/components` 组件 Demo 当作设计稿 §09 的等价实现。
5. 清理 DataTable 文档和消费方式：同步旧注释，明确内置 filter chips 与业务 filter chips 的边界，避免后续页面继续外置编排。
6. 做一次真实截图验收：设计稿 `index.html` 与 `server-next` 同视口、同主题、同路由逐页截图，对 Dashboard / Videos / Settings / Crawler 四页先建立 baseline。

## 7. 当前风险

- 如果继续按页面局部 style 补齐功能，短期能出页面，但视觉会继续偏离，后续统一成本更高。
- 当前 light/dark token 与设计稿 dark-first 层级存在结构性差异，单靠替换颜色无法恢复设计稿层次。
- 占位页数量较多，侧栏 IA 看起来完整，但用户点击后会进入工程占位，这会放大“实现降级”的体感。
- 设计稿新增页面没有落地路由入口前，报告中的开发者模式/弹层规范只能按“未实现”处理，不能进入视觉验收。
