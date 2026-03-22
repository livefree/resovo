# Resovo（流光）— 运行日志（Run Logs）

> 用途：记录开发过程中的运行事件（BLOCKER、恢复、临时决策、异常说明）。
> 规则：新记录统一追加到文件尾部，禁止头部插入或重排历史记录。

---

## 日志模板

```markdown
## [LOG-YYYYMMDD-HHMM-XX] 标题
- **时间**：YYYY-MM-DD HH:mm
- **类型**：INFO / WARN / BLOCKER / RESOLVED
- **关联任务**：TASK-ID（如无填 N/A）
- **内容**：简述发生了什么
- **处理动作**：做了什么
- **后续**：下一步或等待项（如无填 无）
```

---

## [LOG-20260319-1430-01] 建立统一记录规范
- **时间**：2026-03-19 14:30
- **类型**：INFO
- **关联任务**：CHORE-CODEX-01
- **内容**：新增任务序列池与记录追加规则，统一任务/变更/运行日志写法。
- **处理动作**：新增 `docs/task-queue.md`、补充 `docs/tasks.md` 与 `docs/changelog.md` 规则。
- **后续**：后续新增记录按本文件模板继续尾部追加。

## [LOG-20260319-1520-01] CHG-40 API 唯一标识改造完成
- **时间**：2026-03-19 15:20
- **类型**：INFO
- **关联任务**：CHG-40
- **内容**：完成 crawler_sites 以 `api_url` 作为唯一标识的后端重构与迁移脚本。
- **处理动作**：新增 `008_crawler_sites_api_unique.sql`，更新 CRUD/同步逻辑与重复 API 校验，补充单测。
- **后续**：执行 `npm run migrate` 后生效唯一索引约束。

## [LOG-20260319-1523-01] CHG-41 本地上传 Tab 完成
- **时间**：2026-03-19 15:23
- **类型**：INFO
- **关联任务**：CHG-41
- **内容**：配置文件页面新增“本地上传”模式，支持上传 JSON 文件并填充编辑器。
- **处理动作**：更新 ConfigFileEditor 组件，新增 3 个组件单测并通过。
- **后续**：用户上传后仍需点击“保存并同步”写入后端。

## [LOG-20260319-1538-01] CHG-42 页面合并完成
- **时间**：2026-03-19 15:38
- **类型**：INFO
- **关联任务**：CHG-42
- **内容**：完成“视频源配置”和“爬虫管理”页面合并，统一到 `/admin/crawler`。
- **处理动作**：统一页面布局、兼容旧入口重定向、更新侧栏入口与 E2E 文案断言。
- **后续**：在统一页面上继续实施 CHG-43（列表内滚动）和 CHG-44（全列筛选排序）。

## [LOG-20260319-1552-01] CHG-43 列表优化完成
- **时间**：2026-03-19 15:52
- **类型**：INFO
- **关联任务**：CHG-43
- **内容**：统一页的视频源列表新增内部滚动与列级筛选排序能力。
- **处理动作**：改造 CrawlerSiteManager 表格容器、筛选器、排序交互并补充组件单测。
- **后续**：如数据量继续增长，可评估服务端分页/排序/过滤以降低前端计算成本。

## [LOG-20260319-1607-01] CHG-44 登录效率优化完成
- **时间**：2026-03-19 16:07
- **类型**：INFO
- **关联任务**：CHG-44
- **内容**：完成开发期登录优化，减少频繁手动登录。
- **处理动作**：升级会话恢复策略并新增 dev-only 快捷登录接口与前端入口。
- **后续**：默认关闭快捷登录，按环境变量按需开启。

## [LOG-20260319-1638-01] CHG-45 列表二次优化完成
- **时间**：2026-03-19 16:38
- **类型**：INFO
- **关联任务**：CHG-45
- **内容**：完成视频源配置列表二次重构，采集触发已并入列表并支持列头筛选。
- **处理动作**：重构 CrawlerSiteManager 表头筛选与行内编辑，加入全站/单站采集触发；新增后台侧栏收窄能力与工作流排序。
- **后续**：如需进一步降本，可将当前前端筛选/排序下沉为服务端分页查询。

## [LOG-20260319-1643-01] CHG-46 移除重复采集入口
- **时间**：2026-03-19 16:43
- **类型**：INFO
- **关联任务**：CHG-46
- **内容**：根据统一入口原则，移除爬虫面板中的源站卡片采集列表，避免与视频源配置列表重复。
- **处理动作**：删除 AdminCrawlerPanel 源站状态区与 `sites-status` 前端调用，保留全站触发与任务记录。
- **后续**：后续单站采集相关交互统一在视频源配置列表继续演进。

## [LOG-20260319-1646-01] CHG-47 双 Tab 布局完成
- **时间**：2026-03-19 16:46
- **类型**：INFO
- **关联任务**：CHG-47
- **内容**：源站与爬虫统一页改为同一位置双 Tab，减少上下滚动切换成本。
- **处理动作**：新增 AdminCrawlerTabs 组件并接入 /admin/crawler 页面，内容按“视频源配置 / 采集任务记录”分栏切换。
- **后续**：如需支持刷新后保留 Tab，可追加 URL query 参数持久化。

## [LOG-20260319-1659-01] CHG-48 列表稳态化完成
- **时间**：2026-03-19 16:59
- **类型**：INFO
- **关联任务**：CHG-48
- **内容**：完成视频源配置列表列管理、状态持久化、固定布局与导入兼容升级。
- **处理动作**：新增列显隐面板与 localStorage 恢复机制，表格改为固定列宽，导入解析兼容 `api_site/crawler_sites/sources` 多结构及多字段别名。
- **后续**：如需跨浏览器账户同步状态，可将列表偏好迁移到服务端用户配置表。

## [LOG-20260319-1707-01] CHG-49 状态恢复覆盖问题修复
- **时间**：2026-03-19 17:07
- **类型**：RESOLVED
- **关联任务**：CHG-49
- **内容**：确认并修复列表状态在离开页面后被默认值覆盖的问题。
- **处理动作**：引入“恢复完成后再写入”门闩，并补充重挂载持久化回归测试。
- **后续**：继续观察生产环境下跨 Tab 切换与整页导航的状态一致性。

## [LOG-20260319-1714-01] CHG-50 懒初始化持久化修复
- **时间**：2026-03-19 17:14
- **类型**：RESOLVED
- **关联任务**：CHG-50
- **内容**：将状态恢复改为首屏懒初始化读取，修复离页后排序与隐藏列丢失。
- **处理动作**：调整 CrawlerSiteManager 状态初始化策略并删除“清空筛选”按钮。
- **后续**：建议你在本地实际切换 Tab/路由复测 1 次，确认行为符合预期。

## [LOG-20260319-1721-01] CHG-51 列宽溢出修复完成
- **时间**：2026-03-19 17:21
- **类型**：RESOLVED
- **关联任务**：CHG-51
- **内容**：视频源列表在少列场景下仍超宽的问题已修复。
- **处理动作**：将表格 minWidth 从固定值改为可见列总宽度动态计算。
- **后续**：若后续新增列，需同步维护列宽映射表。

## [LOG-20260319-1759-01] CHG-52 列重叠与列宽调节上线
- **时间**：2026-03-19 17:59
- **类型**：RESOLVED
- **关联任务**：CHG-52
- **内容**：修复隐藏列恢复后的重叠问题，并支持手动列宽调节。
- **处理动作**：引入 `columnWidths` 持久化状态，显示列面板新增每列宽度输入。
- **后续**：如需更直观交互，可在下一步增加拖拽分隔线调宽。

## [LOG-20260319-1805-01] CHG-53 列宽交互切换为拖拽
- **时间**：2026-03-19 18:05
- **类型**：RESOLVED
- **关联任务**：CHG-53
- **内容**：按数据表惯例将列宽调整交互从面板输入改为表头分隔拖拽。
- **处理动作**：实现拖拽手柄、mousemove/mouseup 调宽逻辑，并补充单测。
- **后续**：若需要，可补充触摸端拖拽支持。

## [LOG-20260319-1855-01] CHG-54 v1.1 首任务完成
- **时间**：2026-03-19 18:55
- **类型**：INFO
- **关联任务**：CHG-54
- **内容**：启动 v1.1 执行序列并完成 Phase A1 状态模型切片。
- **处理动作**：抽离 `crawler-site/tableState.ts`，主组件改为模块化引用并保持行为不变。
- **后续**：进入 CHG-55（导入解析逻辑抽离）。

## [LOG-20260319-1904-01] CHG-55 导入解析模块化完成
- **时间**：2026-03-19 19:04
- **类型**：INFO
- **关联任务**：CHG-55
- **内容**：完成导入解析逻辑从主组件抽离，支持独立测试。
- **处理动作**：新增 `crawler-site/importParser.ts` 与解析单测；主组件改为模块调用。
- **后续**：继续 CHG-56，抽离列管理/拖拽宽度 hooks。

## [LOG-20260319-1906-01] CHG-56 列管理与拖拽宽度 hook 化完成
- **时间**：2026-03-19 19:06
- **类型**：INFO
- **关联任务**：CHG-56
- **内容**：完成列表列管理、排序筛选、列宽拖拽与持久化逻辑的 hook 抽离。
- **处理动作**：新增 `useCrawlerSiteColumns.ts`，主组件改为消费 hook 并移除内联状态/拖拽监听。
- **后续**：继续 CHG-57，抽离选择与批量操作逻辑。

## [LOG-20260319-1911-01] CHG-57 选择与批量操作 hook 化完成
- **时间**：2026-03-19 19:11
- **类型**：INFO
- **关联任务**：CHG-57
- **内容**：完成选择状态与全选逻辑从主组件抽离，降低容器耦合度。
- **处理动作**：新增 `useCrawlerSiteSelection.ts`，主组件改为消费 hook 并在批量成功后调用清空选择。
- **后续**：继续 CHG-58，拆分表格视图组件并收敛容器职责。

## [LOG-20260319-1918-01] CHG-58 容器与表格组件拆分完成
- **时间**：2026-03-19 19:18
- **类型**：INFO
- **关联任务**：CHG-58
- **内容**：完成 CrawlerSiteManager 的容器化拆分，表格视图独立模块化。
- **处理动作**：新增 `CrawlerSiteTable.tsx`，主组件替换为容器传参；回归测试/类型检查/lint 全部通过。
- **后续**：进入 CHG-59，拆分 ConfigFileEditor 结构。

## [LOG-20260319-1921-01] CHG-59 ConfigFileEditor 结构拆分完成
- **时间**：2026-03-19 19:21
- **类型**：INFO
- **关联任务**：CHG-59
- **内容**：完成配置文件编辑器第一阶段结构拆分并补齐工具层测试。
- **处理动作**：新增 `config-file/constants.ts` 与 `config-file/utils.ts`，主组件切换为工具函数复用；新增 `utils` 单测并通过。
- **后续**：v1.1 序列收尾完成，可按新结构继续做后续功能迭代。

## [LOG-20260320-1045-01] CHG-60 操作栏组件拆分完成
- **时间**：2026-03-20 10:45
- **类型**：INFO
- **关联任务**：CHG-60
- **内容**：完成 CrawlerSite 操作栏从容器组件抽离，进一步收敛容器职责。
- **处理动作**：新增 `CrawlerSiteToolbar.tsx`，主组件改为传参编排；回归测试/类型检查/lint 通过。
- **后续**：继续 CHG-61，抽离筛选行组件。

## [LOG-20260320-1055-01] CHG-61 筛选行组件拆分完成
- **时间**：2026-03-20 10:55
- **类型**：INFO
- **关联任务**：CHG-61
- **内容**：完成源站列表筛选行从表格组件内联拆分为独立组件。
- **处理动作**：新增 `CrawlerSiteFilters.tsx`，`CrawlerSiteTable` 改为组合引用；回归测试/类型检查/lint 通过。
- **后续**：继续 CHG-62，抽离新增/编辑表单弹窗组件。

## [LOG-20260320-1108-01] CHG-62 表单弹窗组件拆分完成
- **时间**：2026-03-20 11:08
- **类型**：INFO
- **关联任务**：CHG-62
- **内容**：完成新增/编辑源站弹窗与表单从容器组件抽离。
- **处理动作**：新增 `CrawlerSiteFormDialog.tsx`，主组件改为回调编排；回归测试/类型检查/lint 通过。
- **后续**：继续 CHG-63，抽离列表加载与刷新 hook。

## [LOG-20260320-1118-01] CHG-63 列表加载 hook 拆分完成
- **时间**：2026-03-20 11:18
- **类型**：INFO
- **关联任务**：CHG-63
- **内容**：完成源站列表加载与刷新状态从容器组件抽离为独立 hook。
- **处理动作**：新增 `useCrawlerSites.ts`，主组件改为消费 hook；回归测试/类型检查/lint 通过。
- **后续**：继续 CHG-64，执行 system 目录业务归组。

## [LOG-20260320-1130-01] CHG-64 system 目录归组完成
- **时间**：2026-03-20 11:30
- **类型**：INFO
- **关联任务**：CHG-64
- **内容**：完成 `system` 目录平铺业务组件向业务子目录迁移。
- **处理动作**：迁移 6 个组件并更新页面/测试引用路径；回归测试/类型检查/lint 通过。
- **后续**：继续 CHG-65，核查并收敛页面入口装配职责。

## [LOG-20260320-1142-01] CHG-65 页面入口职责校准完成
- **时间**：2026-03-20 11:42
- **类型**：INFO
- **关联任务**：CHG-65
- **内容**：完成 admin system 页面入口层与业务模块边界核查。
- **处理动作**：确认入口仅负责装配，业务逻辑已下沉到业务目录组件；复用 CHG-64 验收结果。
- **后续**：继续 CHG-66，落地模板规范并收口阶段验收。

## [LOG-20260320-1156-01] CHG-66 模板规范与阶段验收完成
- **时间**：2026-03-20 11:56
- **类型**：INFO
- **关联任务**：CHG-66
- **内容**：完成 v1.2 模板规范落地与阶段验收收口。
- **处理动作**：新增 `docs/rules/admin-module-template.md`；执行 test/typecheck/lint 全通过；更新任务与序列状态为完成。
- **后续**：进入下一阶段（v1.3）前，可先单独清理 `ConfigFileEditor` 相关测试 warning。

## [LOG-20260320-1208-01] CHG-67 Admin v2 文档方案落地
- **时间**：2026-03-20 12:08
- **类型**：INFO
- **关联任务**：CHG-67
- **内容**：完成 admin v2 重构方案与设计系统 v1 文档固化。
- **处理动作**：新增 `docs/admin_v2_refactor_plan.md` 与 `docs/admin_design_system_v1.md`，并纳入任务与变更记录。
- **后续**：可按文档 Phase 1 直接拆分 CHG 执行 shared 抽象。

## [LOG-20260320-1220-01] CHG-68 执行规则与顺序约束更新完成
- **时间**：2026-03-20 12:20
- **类型**：INFO
- **关联任务**：CHG-68
- **内容**：完成 admin v2 执行顺序重排与工程约束强化。
- **处理动作**：更新 `admin_v2_refactor_plan.md` 与 `admin-module-template.md`，新增强 DoD、UI 硬边界、PR 单维度规则。
- **后续**：按新顺序启动 shared Phase 1（先 `AdminTableFrame/AdminTableState`）。

## [LOG-20260321-2030-01] CHG-133 统一重构总纲落档
- **时间**：2026-03-21 20:30
- **类型**：INFO
- **关联任务**：CHG-133
- **内容**：后台界面统一重构从“盘点阶段”切换到“规划阶段”，总纲文档已固定。
- **处理动作**：新增 `docs/admin_ui_unification_plan.md`，并将 `docs/task-queue.md` 与 `docs/tasks.md` 切换到 CHG-134。
- **后续**：执行 CHG-134，输出分阶段原子任务序列（仅规划，不改代码）。

## [LOG-20260321-2048-01] CHG-134 任务序列规划完成
- **时间**：2026-03-21 20:48
- **类型**：INFO
- **关联任务**：CHG-134
- **内容**：完成统一重构任务序列拆分，进入 Phase 1 执行入口。
- **处理动作**：在 `SEQ-20260321-34` 补齐 CHG-135 ~ CHG-141，`tasks.md` 当前任务切换到 CHG-135。
- **后续**：开始执行 CHG-135（CRUD 列表页骨架统一）。

## [LOG-20260321-2339-01] CHG-135 CRUD 页面骨架统一完成
- **时间**：2026-03-21 23:39
- **类型**：INFO
- **关联任务**：CHG-135
- **内容**：完成 `videos/sources/users` 页面壳层统一，并将描述文案改为 hover 查看。
- **处理动作**：新增 `AdminPageShell` 并接入三页；完成 typecheck/lint/test:run 全量校验；任务切换到 CHG-136。
- **后续**：执行 CHG-136（审核类页面骨架统一）。

## [LOG-20260321-2343-01] CHG-136 审核页骨架统一完成
- **时间**：2026-03-21 23:43
- **类型**：INFO
- **关联任务**：CHG-136
- **内容**：完成 `content/submissions/subtitles` 页面壳层统一，审核流程与表格行为保持不变。
- **处理动作**：三页接入 `AdminPageShell`；完成 typecheck/lint/test:run；任务切换到 CHG-137。
- **后续**：执行 CHG-137（说明文案与 hover 化统一）。

## [LOG-20260321-2346-01] CHG-137 页面级文案 hover 化完成
- **时间**：2026-03-21 23:46
- **类型**：INFO
- **关联任务**：CHG-137
- **内容**：完成看板与系统页的页面级说明文案收敛，默认改为 hover 查看。
- **处理动作**：`/admin`、`/admin/analytics`、`/admin/system/*` 页面接入 `AdminPageShell` 并迁移标题说明；全量测试通过。
- **后续**：执行 CHG-138（重复入口与命名收敛）。

## [LOG-20260321-2349-01] CHG-138 入口与命名收敛完成
- **时间**：2026-03-21 23:49
- **类型**：INFO
- **关联任务**：CHG-138
- **内容**：完成审核入口单点化，旧审核路由保留兼容访问。
- **处理动作**：侧栏合并为 `/admin/content` 单入口；`/admin/submissions` 与 `/admin/subtitles` 改为兼容重定向；全量测试通过。
- **后续**：执行 CHG-139（控制台结构收口）。

## [LOG-20260321-2351-01] CHG-139 控制台结构收口完成
- **时间**：2026-03-21 23:51
- **类型**：INFO
- **关联任务**：CHG-139
- **内容**：完成采集控制台标题区说明收敛，默认改为 hover 显示。
- **处理动作**：新增 `AdminHoverHint` 并接入控制台关键区块标题；保留控制台结构与控制能力不变；全量测试通过。
- **后续**：执行 CHG-140（看板与系统页结构收口）。

## [LOG-20260321-1645-01] CHG-131 全量回归完成
- **时间**：2026-03-21 16:45
- **类型**：RESOLVED
- **关联任务**：CHG-131
- **内容**：完成 shared table 迁移阶段的全量门禁回归与稳定性验证。
- **处理动作**：执行 `npm run typecheck`、`npm run lint`、`npm run test:run`，结果 `53 files / 526 tests` 全通过。
- **后续**：进入 CHG-132，更新能力矩阵与 baseline 文档，固化最终迁移结果。

## [LOG-20260321-1647-01] CHG-132 文档基线固化完成
- **时间**：2026-03-21 16:47
- **类型**：RESOLVED
- **关联任务**：CHG-132
- **内容**：完成列表能力矩阵与统一基线文档固化，迁移序列正式收口。
- **处理动作**：更新 `admin_list_matrix.md`、`admin_table_baseline.md`，并同步 `tasks/task-queue/changelog` 状态。
- **后续**：等待下一阶段任务队列（N/A）。

## [LOG-20260320-1226-01] CHG-69 任务序列启动
- **时间**：2026-03-20 12:26
- **类型**：INFO
- **关联任务**：CHG-69
- **内容**：按更新后的 admin v2 方案启动工程实施序列（SEQ-20260320-03）。
- **处理动作**：写入 CHG-69~84 任务编排，将 CHG-69 置为进行中并绑定强 DoD 验收。
- **后续**：进入 CHG-69 代码实施：提取 `AdminTableFrame` 与 `AdminTableState`。

## [LOG-20260319-2318-01] CHG-69 shared 表壳抽离完成
- **时间**：2026-03-19 23:18
- **类型**：INFO
- **关联任务**：CHG-69
- **内容**：完成 crawler-site 表格外壳与空态渲染的 shared 抽离，保持行为不变。
- **处理动作**：新增 `AdminTableFrame`、`AdminTableState` 并接入 `CrawlerSiteTable`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-70，抽离 AdminToolbar。

## [LOG-20260319-2321-01] CHG-70 AdminToolbar 抽离完成
- **时间**：2026-03-19 23:21
- **类型**：INFO
- **关联任务**：CHG-70
- **内容**：完成 crawler-site 工具栏 shared 布局壳抽离，保持行为不变。
- **处理动作**：新增 `AdminToolbar` 并接入 `CrawlerSiteToolbar`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-71，抽离 useAdminToast。

## [LOG-20260319-2322-01] CHG-71 useAdminToast 抽离完成
- **时间**：2026-03-19 23:22
- **类型**：INFO
- **关联任务**：CHG-71
- **内容**：完成 crawler-site toast 管理逻辑 shared 化，提示时序保持不变。
- **处理动作**：新增 `useAdminToast` 并接入 `CrawlerSiteManager`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-72，抽离 AdminDialogShell。

## [LOG-20260319-2324-01] CHG-72 AdminDialogShell 抽离完成
- **时间**：2026-03-19 23:24
- **类型**：INFO
- **关联任务**：CHG-72
- **内容**：完成 crawler-site 弹层壳 shared 化，表单行为保持不变。
- **处理动作**：新增 `AdminDialogShell` 并接入 `CrawlerSiteFormDialog`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-73，抽离 AdminFormField/Input/Select。

## [LOG-20260319-2325-01] CHG-73 表单基础组件抽离完成
- **时间**：2026-03-19 23:25
- **类型**：INFO
- **关联任务**：CHG-73
- **内容**：完成 crawler-site 表单基础组件 shared 化，业务字段行为保持不变。
- **处理动作**：新增 `AdminFormField` / `AdminInput` / `AdminSelect` 并接入 `CrawlerSiteFormDialog`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-74，抽离 AdminBatchBar。

## [LOG-20260319-2327-01] CHG-74 AdminBatchBar 抽离完成
- **时间**：2026-03-19 23:27
- **类型**：INFO
- **关联任务**：CHG-74
- **内容**：完成 crawler-site 批量操作区 shared 化，批量行为保持不变。
- **处理动作**：新增 `AdminBatchBar` 并接入 `CrawlerSiteToolbar`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-75，执行 shared 跨模块复用验证。

## [LOG-20260319-2329-01] CHG-75 shared 跨模块复用验证完成
- **时间**：2026-03-19 23:29
- **类型**：INFO
- **关联任务**：CHG-75
- **内容**：完成 shared Toolbar 在 `videos/sources` 模块的复用接入验证。
- **处理动作**：`VideoFilters` 与 `SourceTable` 接入 `AdminToolbar`，并补齐 `dataTestId` 兼容测试；执行定向单测、typecheck、lint 均通过。
- **后续**：Phase 1 结束，进入 CHG-76（Phase 2 UI 局部优化）。

## [LOG-20260319-2330-01] CHG-76 启动：toolbar 局部优化
- **时间**：2026-03-19 23:30
- **类型**：INFO
- **关联任务**：CHG-76
- **内容**：进入 Phase 2，开始 crawler-site 工具栏局部 UI 优化。
- **处理动作**：已将 CHG-76 状态切换为进行中，按“仅 DOM/样式调整”边界执行。
- **后续**：完成 toolbar 分组重排后执行回归测试并提交。

## [LOG-20260319-2332-01] CHG-76 toolbar 局部优化完成
- **时间**：2026-03-19 23:32
- **类型**：INFO
- **关联任务**：CHG-76
- **内容**：完成 crawler-site 工具栏分区重排，提升高频操作可读性。
- **处理动作**：将动作拆为主动作组/配置动作组/批量动作组，并加入分隔视觉；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-77，优化行操作分层。

## [LOG-20260319-2333-01] CHG-77 行操作分层完成
- **时间**：2026-03-19 23:33
- **类型**：INFO
- **关联任务**：CHG-77
- **内容**：完成 crawler-site 行操作按钮层级优化，提升高频动作可见性。
- **处理动作**：调整采集与管理列按钮视觉优先级和顺序；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-78，优化筛选可视化。

## [LOG-20260320-0114-01] CHG-78 轻表头+列菜单重构完成
- **时间**：2026-03-20 01:14
- **类型**：INFO
- **关联任务**：CHG-78
- **内容**：完成 crawler-site 列表页由“重表头筛选”向“轻表头 + 按需列菜单 + 筛选状态条”迁移。
- **处理动作**：新增 TopToolbar/AdvancedFilters/ChipsBar/ColumnMenu/ColumnFilterPanel/LiteHeader，并保留筛选语义、排序/列宽/列显隐持久化行为；回归测试通过。
- **后续**：可继续 CHG-79（config-file 粘性保存区）或按需补充 column menu 交互单测。

## [LOG-20260320-0120-01] CHG-79 配置页粘性保存区完成
- **时间**：2026-03-20 01:20
- **类型**：INFO
- **关联任务**：CHG-79
- **内容**：配置文件页面已增加 sticky 保存区，长内容滚动场景下保存入口保持可见。
- **处理动作**：改造 ConfigFileEditor 底部操作栏样式与定位；验证单测、typecheck、lint 通过。
- **后续**：进入 CHG-80，执行 videos/users/sources 布局对齐。

## [LOG-20260320-0122-01] CHG-80 多页面布局对齐完成
- **时间**：2026-03-20 01:22
- **类型**：INFO
- **关联任务**：CHG-80
- **内容**：完成 videos/users/sources 页面头部与筛选区的布局风格统一。
- **处理动作**：页面头部统一为信息头卡片；users 搜索区接入 AdminToolbar；回归验证通过。
- **后续**：进入 CHG-81，落地 AdminButton 组件规范。

## [LOG-20260320-0124-01] CHG-81 AdminButton 规范落地完成
- **时间**：2026-03-20 01:24
- **类型**：INFO
- **关联任务**：CHG-81
- **内容**：完成按钮设计规范第一批代码化，统一按钮变体语义。
- **处理动作**：新增 shared AdminButton，并接入 crawler/config/videos 关键按钮；定向测试与静态检查通过。
- **后续**：进入 CHG-82，落地 AdminModal + 表单规范。

## [LOG-20260320-0125-01] CHG-82 Modal/Form 规范落地完成
- **时间**：2026-03-20 01:25
- **类型**：INFO
- **关联任务**：CHG-82
- **内容**：完成 admin modal 与 form actions 的 shared 规范代码化并在 crawler-site 首批接入。
- **处理动作**：新增 AdminModal 与 AdminFormActions，替换 CrawlerSiteFormDialog 组合结构；回归验证通过。
- **后续**：进入 CHG-83，落地 AdminTable 规范到多模块。

## [LOG-20260320-0129-01] CHG-83 AdminTable 规范跨模块落地完成
- **时间**：2026-03-20 01:29
- **类型**：INFO
- **关联任务**：CHG-83
- **内容**：完成 AdminTable 规范在 `videos`、`sources` 两个模块的接入，满足 Phase3 复用验收基线。
- **处理动作**：`VideoTable` 与 `SourceTable` 接入 `AdminTableFrame + AdminTableState`；执行定向单测、typecheck、lint 均通过。
- **后续**：进入 CHG-84，落地交互规则代码门禁。

## [LOG-20260320-0133-01] CHG-84 交互规则门禁落地完成
- **时间**：2026-03-20 01:33
- **类型**：INFO
- **关联任务**：CHG-84
- **内容**：完成 admin v2 交互规则自动化门禁，覆盖单维度提交、删除确认与 toast 规范约束。
- **处理动作**：新增 `verify-admin-guardrails` 脚本与 npm 命令；`SourceTable` 单条删除接入 `ConfirmDialog`；更新执行规则文档。
- **后续**：SEQ-20260320-03 全任务完成，可进入下一序列规划。

## [LOG-20260320-0201-01] CHG-85 crawler-site 采集操作闭环完成
- **时间**：2026-03-20 02:01
- **类型**：INFO
- **关联任务**：CHG-85
- **内容**：完成视频源配置页单站增量/全量采集闭环，并沉淀可复用任务模型与轮询 hook。
- **处理动作**：后端补齐同站互斥与 latest 查询接口；前端新增 task service + hook，落地行级运行态、防重复、成功/失败反馈与完成后列表刷新。
- **后续**：可在“采集任务记录”Tab 复用 `crawlTaskService + useCrawlerSiteCrawlTasks` 扩展批量采集与任务详情。

## [LOG-20260320-0232-01] CHG-86 配置页采集状态概览完成
- **时间**：2026-03-20 02:32
- **类型**：INFO
- **关联任务**：CHG-86
- **内容**：在“视频源配置”页新增轻量采集状态概览，实时显示总量、成功、运行中、失败、今日视频数与采集时长。
- **处理动作**：后端新增 `overview` 汇总接口；前端新增状态概览组件并按 5 秒轮询刷新，不影响表格交互。
- **后续**：若需要可复用该概览接口到“采集任务记录”Tab 顶部。

## [LOG-20260320-0242-01] CHG-87 采集状态持久化修复完成
- **时间**：2026-03-20 02:42
- **类型**：INFO
- **关联任务**：CHG-87
- **内容**：修复单站采集离页后状态丢失与概览不更新问题，确保采集任务与页面生命周期解耦。
- **处理动作**：API 单站触发改为预创建 `pending` 任务后入队；worker 接管任务状态推进；前端新增重进页面状态恢复逻辑。
- **后续**：可补充 e2e 用例验证“触发后刷新页面任务仍运行”。

## [LOG-20260320-0251-01] CHG-88 概览实时口径修复完成
- **时间**：2026-03-20 02:51
- **类型**：INFO
- **关联任务**：CHG-88
- **内容**：修复“今日采集视频数/采集时长”在长任务运行中持续为 0 的问题。
- **处理动作**：新增运行中进度回写；overview 统计改为实时口径（running + done，时长含实时运行时长）。
- **后续**：可补充任务进度断言测试，验证运行中数值单调递增。

## [LOG-20260320-0308-01] CHG-89 pending 卡死修复完成
- **时间**：2026-03-20 03:08
- **类型**：INFO
- **关联任务**：CHG-89
- **内容**：修复采集任务在队列异常下长期停留 pending 的问题，并完成历史脏任务补偿。
- **处理动作**：新增队列可用性检查、入队失败回写 failed、worker 早期失败回写 failed；执行数据库补偿将 2 条历史 pending 转为 failed。
- **后续**：若继续触发采集，需保证 Redis 服务可用（localhost:6379）；不可用时接口会返回 503 并阻止新建 pending 脏任务。

## [LOG-20260320-0313-01] CHG-90 SQL 参数类型冲突修复完成
- **时间**：2026-03-20 03:13
- **类型**：INFO
- **关联任务**：CHG-90
- **内容**：修复触发采集时报错 `inconsistent types deduced for parameter $1`。
- **处理动作**：`markStalePendingTasks` 改为有/无 `siteKey` 两条 SQL，消除可空参数复用导致的类型推断冲突。
- **后续**：继续观察采集触发链路，若出现新错误直接在同序列追加热修复。

## [LOG-20260320-0338-01] CHG-91 采集链路可观测性改造完成
- **时间**：2026-03-20 03:38
- **类型**：INFO
- **关联任务**：CHG-91
- **内容**：完成采集任务详细日志体系（DB 持久化 + API 查询 + 诊断脚本），用于定位入队失败/worker失败/抓取失败/入库失败。
- **处理动作**：新增 `crawler_task_logs` 迁移与查询；在 API/worker/crawl 关键阶段埋点；新增 `test:crawler-site` 实采诊断脚本。
- **后续**：在本机执行 `npm run migrate` 后，用 `npm run test:crawler-site -- --site=<siteKey>` 做首轮联调验证。

## [LOG-20260320-0400-01] CHG-92 队列路径 SQL 类型冲突根因修复
- **时间**：2026-03-20 04:00
- **类型**：INFO
- **关联任务**：CHG-92
- **内容**：定位并修复 worker 进入源站采集前的 SQL 参数推断冲突（text vs varchar）。
- **处理动作**：`updateCrawlStatus` 的 `$1` 参数改为 `::varchar` 显式类型，消除 PREPARE 路径冲突。
- **后续**：重启 API 后重新触发单站增量，验证日志进入 `worker.source.start` 与 `crawl.*` 阶段。

## [LOG-20260320-1248-01] CHG-93 Python 工具链规范方案落盘完成
- **时间**：2026-03-20 12:48
- **类型**：INFO
- **关联任务**：CHG-93
- **内容**：将用户要求的 Python 开发规范（uv/ruff/ty）形成文档化执行基线。
- **处理动作**：新增 `docs/python_tooling_adoption_plan.md`，并同步任务/变更/队列记录。
- **后续**：当首次出现 Python 实改任务时，按该方案执行最小侵入接入与检查命令。

## [LOG-20260320-1256-01] CHG-94 Python 规范触发条件收敛完成
- **时间**：2026-03-20 12:56
- **类型**：INFO
- **关联任务**：CHG-94
- **内容**：将 Python 工具链规范调整为条件触发式，避免无 Python 业务代码时的空接入。
- **处理动作**：在方案文档新增强约束触发规则，并明确触发后的最小交付清单。
- **后续**：首次新增 Python 业务代码时，立即执行 `pyproject + uv/ruff/ty` 最小接入。

## [LOG-20260320-1409-01] CHG-95 Phase A 批次模型与控制能力落地
- **时间**：2026-03-20 14:09
- **类型**：INFO
- **关联任务**：CHG-95
- **内容**：完成采集系统下一阶段核心能力：批量/全站触发、批次状态聚合、任务中止与超时兜底。
- **处理动作**：新增 `crawler_runs` 与任务控制字段；新增 run API 与 run service；前端接入批次面板和批量触发；保留 CHG-87 单站兼容。
- **后续**：执行 DB 迁移并做真实环境联调（批量触发、暂停/恢复、中止、超时观察）。

## [LOG-20260320-1544-01] CHG-96 admin 登录态误判修复完成
- **时间**：2026-03-20 15:44
- **类型**：INFO
- **关联任务**：CHG-96
- **内容**：修复后台切页偶发“需要登录”误判：refresh 成功却被前端解析失败导致强制 logout。
- **处理动作**：`api-client` refresh 解析兼容 `{data.accessToken}`；新增统一 `handleUnauthorized`，在 admin 路径下 401 统一跳转登录并携带 `callbackUrl`。
- **后续**：建议你本地手测 admin 连续切页 + access token 过期场景，确认不再需要“前台登出再登录”恢复。

## [LOG-20260320-1603-01] CHG-97~99 采集控制台 Phase A 首批落地完成
- **时间**：2026-03-20 16:03
- **类型**：INFO
- **关联任务**：CHG-97、CHG-98、CHG-99
- **内容**：完成采集控制台命名迁移、旧入口兼容提示、自动采集配置入口单点化收口。
- **处理动作**：新增方案文档；导航/页面/Tab 改名为“采集控制台”；任务记录与站点配置页移除自动采集编辑入口并改为只读跳转提示。
- **后续**：进入 Phase B，落地统一自动采集配置模型（global/per-site/schedule/conflictPolicy）。

## [LOG-20260320-1615-01] CHG-100 统一自动采集配置模型落地完成
- **时间**：2026-03-20 16:15
- **类型**：INFO
- **关联任务**：CHG-100
- **内容**：完成自动采集配置统一化：控制台新增配置面板，后端新增统一配置 API，scheduler 与 run service 改读统一配置源。
- **处理动作**：新增 `AutoCrawlConfig` 类型与系统配置键；新增 `GET/POST /admin/crawler/auto-config`；控制台接入 `AutoCrawlSettingsPanel`；scheduler 切换为 dailyTime 命中触发并按日去重。
- **后续**：进入 Phase C，按模块补强“自动采集状态”在列表与任务记录间的联动可视化。

## [LOG-20260320-1618-01] CHG-101 自动采集状态可视化完成
- **时间**：2026-03-20 16:18
- **类型**：INFO
- **关联任务**：CHG-101
- **内容**：控制台站点列表已可直接看到自动采集开启状态与模式（继承/增量/全量），降低配置与执行割裂。
- **处理动作**：自动采集配置面板新增回调；页面容器维护配置快照；列表行内映射自动采集状态。
- **后续**：继续 Phase C-2，补“任务记录页按 triggerType/run 维度筛选联动”。

## [LOG-20260320-1621-01] CHG-102 任务记录来源筛选联动完成
- **时间**：2026-03-20 16:21
- **类型**：INFO
- **关联任务**：CHG-102
- **内容**：任务记录页支持按触发来源筛选（single/batch/all/schedule），并展示来源标签。
- **处理动作**：后端 tasks 查询新增 triggerType 过滤；前端新增来源筛选按钮组与来源列。
- **后续**：可继续 Phase C-3，补 run 详情到 task 日志的快速跳转链路。

## [LOG-20260320-1625-01] CHG-103 任务日志快速查看链路完成
- **时间**：2026-03-20 16:25
- **类型**：INFO
- **关联任务**：CHG-103
- **内容**：任务记录页已支持行内“查看日志”，可直接查看任务最近日志，减少手工 curl 排障。
- **处理动作**：`AdminCrawlerPanel` 新增操作列与日志面板，接入 `/admin/crawler/tasks/:id/logs`，补齐加载态/空态/关闭逻辑。
- **后续**：可在下一阶段加入 run 维度日志聚合与日志等级筛选。

## [LOG-20260320-1631-01] CHG-104 run 维度筛选与任务字段对齐完成
- **时间**：2026-03-20 16:31
- **类型**：INFO
- **关联任务**：CHG-104
- **内容**：任务记录页补齐 run 维度追踪，可按 runId 过滤任务并在表格显示 runId/站点，排障链路更完整。
- **处理动作**：后端 tasks 查询新增 runId 过滤；前端新增 runId 输入过滤与点击 runId 反筛选；补齐 API 单测。
- **后续**：可继续 Phase D，补 run 详情到 task 列表的双向跳转。

## [LOG-20260320-1633-01] CHG-105 run→task 深链联动完成
- **时间**：2026-03-20 16:33
- **类型**：INFO
- **关联任务**：CHG-105
- **内容**：采集控制台批次面板可直接跳到任务记录并自动按 runId 过滤。
- **处理动作**：run 面板新增 `?tab=tasks&runId=` 深链；tabs 增加 URL 状态同步；任务页接收并应用初始 runId。
- **后续**：可在 Phase D 增加“任务页返回控制台并保留上下文”的补强体验。

## [LOG-20260320-1637-01] CHG-106 深链联动回归测试完成
- **时间**：2026-03-20 16:37
- **类型**：INFO
- **关联任务**：CHG-106
- **内容**：run→task 深链联动新增自动化测试，覆盖 URL 参数读写与 runId 透传。
- **处理动作**：新增 `AdminCrawlerTabs.test.tsx`，并通过定向 + 全量回归。
- **后续**：Phase D 后续可继续补“任务页返回控制台上下文保持”测试。

## [LOG-20260320-1640-01] CHG-107 runId 过滤 URL 双向同步完成
- **时间**：2026-03-20 16:40
- **类型**：INFO
- **关联任务**：CHG-107
- **内容**：任务页 runId 过滤已实现 URL 双向同步，清空过滤后刷新不再回跳。
- **处理动作**：`AdminCrawlerPanel` 增加 runId 变更回调；`AdminCrawlerTabs` 增加 URL 写回；扩展 tabs 单测覆盖该链路。
- **后续**：可继续 Phase D，补“控制台/任务页上下文返回”的交互细化。

## [LOG-20260320-1718-01] CHG-108 一键清空抓取数据脚本完成
- **时间**：2026-03-20 17:18
- **类型**：INFO
- **关联任务**：CHG-108
- **内容**：新增测试支撑脚本，可一键清空已抓取视频数据与采集任务数据。
- **处理动作**：新增 `scripts/clear-crawled-data.ts`；新增 npm 命令 `clear:crawled-data`；README 补充使用说明。
- **后续**：建议你在测试前执行一次该命令，再触发增量/全量采集做回归验证。

## [LOG-20260320-1750-01] CHG-109 采集控制台局部监控更新与任务控制增强完成
- **时间**：2026-03-20 17:50
- **类型**：INFO
- **关联任务**：CHG-109
- **内容**：完成采集控制台“监控局部更新”改造，避免整页刷新感；补齐 run 级暂停/恢复/中止最小可用链路。
- **处理动作**：新增 `useCrawlerMonitor` 抽离轮询；站点刷新改为 silent；run/task 状态扩展 `paused` 并补 DB 迁移；worker/crawl 增强协作式 pause/cancel/timeout 检查与状态落盘。
- **后续**：部署前需执行 `npm run migrate` 应用 `011_add_paused_statuses.sql`，并在真实任务上手测 pause/resume/cancel。

## [LOG-20260320-1754-01] CHG-110 README 采集控制说明补全完成
- **时间**：2026-03-20 17:54
- **类型**：INFO
- **关联任务**：CHG-110
- **内容**：README 已补充采集控制台入口、暂停/恢复/中止位置与操作说明。
- **处理动作**：更新后台模块命名描述；新增“触发与控制采集任务”章节及 run 控制 API 调试示例。
- **后续**：可按文档直接执行 run 级控制联调。

## [LOG-20260320-1840-01] CHG-111 采集失控止血完成
- **时间**：2026-03-20 18:40
- **类型**：INFO
- **关联任务**：CHG-111
- **内容**：定位并修复“scheduler 占位任务被 crawler worker 误执行”导致的持续自动采集与监控失真问题。
- **处理动作**：scheduler 改为独立 tick（不再写 crawler queue 占位 crawl job）；`/admin/crawler/tasks` 全站触发收口到 run 模型；新增 `POST /admin/crawler/stop-all` 与 `npm run crawler:stop-all`；worker 增加全局冻结检查。
- **后续**：上线后先执行一次 stop-all 并确认 `crawler_runs` 与 `crawler_tasks` 活跃状态归零，再按需手动开启 `CRAWLER_SCHEDULER_ENABLED=true`。

## [LOG-20260320-1847-01] CHG-112 stop-all 收敛增强完成
- **时间**：2026-03-20 18:47
- **类型**：INFO
- **关联任务**：CHG-112
- **内容**：针对 stop-all 后仍显示 running 的问题，补上强制收敛与心跳过期清理。
- **处理动作**：`cancelAllActiveTasks` 改为直接取消 running；新增 `markStaleHeartbeatRunningTasks`；overview running 统计加心跳新鲜度过滤。
- **后续**：重启 API 后执行一次 `npm run crawler:stop-all`，再核对 `crawler_tasks` running 数量与面板一致性。

## [LOG-20260321-0912-01] 采集控制台 v1.1 计划约束落盘
- **时间**：2026-03-21 09:12
- **类型**：INFO
- **关联任务**：CHG-113（进行中）
- **内容**：按评审意见将执行约束升级为硬规则，并固定后续执行顺序。
- **处理动作**：更新 `admin_crawl_control_center_plan.md` 到 v1.1；任务序列改为 `A1 -> A2 -> A3 -> C1 -> C2 -> B1 -> D1`；在 task-queue / tasks 中建立新序列并标记 CHG-113 进行中。
- **后续**：严格按序推进，不跨阶段并行。

## [LOG-20260321-0200-01] CHG-113~115 首段序列完成（A1/A2/A3）
- **时间**：2026-03-21 02:00
- **类型**：INFO
- **关联任务**：CHG-113、CHG-114、CHG-115
- **内容**：完成 run/task 契约统一、触发入口单点化、orphan 可观测性补齐。
- **处理动作**：
  - A1：统一触发返回为 `runId/taskId/taskIds/...`，移除前端 `jobId` 依赖，补齐 `cancelled/timeout` 状态口径。
  - A2：任务记录页改为只读，移除触发按钮并更新 E2E 断言。
  - A3：新增 `GET /admin/crawler/system-status` 与控制台系统状态条（scheduler/freeze/orphan）。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/AdminCrawlerTabs.test.tsx`
- **后续**：继续执行 CHG-116（worker 硬约束：无 runId/taskId 不执行）。

## [LOG-20260321-0206-01] CHG-116 worker contract guard 落地
- **时间**：2026-03-21 02:06
- **类型**：INFO
- **关联任务**：CHG-116
- **内容**：完成 worker 执行入口硬约束，拒绝无 runId/taskId 的 crawl job。
- **处理动作**：
  - `crawlerWorker` 新增 contract guard：无 runId/taskId 直接写审计日志并拒绝执行。
  - `enqueueFullCrawl/enqueueIncrementalCrawl` 改为强制 contract 参数。
  - 更新 worker 与 API 相关单测，覆盖 contract 缺失拒绝路径。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler-worker.test.ts tests/unit/api/crawler.test.ts`
- **后续**：进入 CHG-117（stop-all/freeze 正式化）。

## [LOG-20260321-0208-01] CHG-117 stop-all/freeze 正式化完成
- **时间**：2026-03-21 02:08
- **类型**：INFO
- **关联任务**：CHG-117
- **内容**：完成 stop-all/freeze 的控制台入口与后端开关正式化。
- **处理动作**：
  - 新增 `POST /admin/crawler/freeze` 接口（支持冻结/解冻）。
  - `stop-all` 响应改为返回数据库真实 freeze 状态。
  - 系统状态条接入“开启/关闭冻结 + stop-all”操作按钮与动作中状态。
  - README 补充 freeze API 与控制台操作说明。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/api/crawler.test.ts tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **后续**：进入 CHG-118（监控区/表格区 query model 解耦）。

## [LOG-20260321-0210-01] CHG-118 监控区/表格区 query model 解耦完成
- **时间**：2026-03-21 02:10
- **类型**：INFO
- **关联任务**：CHG-118
- **内容**：控制台容器拆分完成，监控轮询不再直接驱动站点表格容器状态。
- **处理动作**：
  - 新增 `CrawlerConsoleMonitorSection` 承载概览/系统状态/运行批次监控。
  - `CrawlerSiteManager` 移除 `useCrawlerMonitor` 直接依赖，仅保留站点管理与表格交互状态。
  - 全站/批量触发改为依赖监控区独立轮询回收任务状态。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/AdminCrawlerTabs.test.tsx tests/unit/api/crawler.test.ts`
- **后续**：进入 CHG-119（健康状态条 + 深链完善）。

## [LOG-20260321-0213-01] CHG-119 健康条与任务深链完善完成
- **时间**：2026-03-21 02:13
- **类型**：INFO
- **关联任务**：CHG-119
- **内容**：完成监控区到任务记录的状态深链闭环，缩短故障定位路径。
- **处理动作**：
  - `CrawlerRunPanel` 增加“查看日志”深链（`runId + taskStatus`）。
  - `AdminCrawlerTabs` 支持读取并透传 `taskStatus` 查询参数。
  - `AdminCrawlerPanel` 支持初始状态筛选参数，打开任务页即可落在失败/取消视图。
  - `AdminCrawlerTabs` 单测补充 `taskStatus` 透传用例。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/AdminCrawlerTabs.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`
- **后续**：v1.1 序列 CHG-113~119 已完成。

## [LOG-20260321-0319-01] CHG-120 crawler-site 表格结构规范化完成
- **时间**：2026-03-21 03:19
- **类型**：INFO
- **关联任务**：CHG-120
- **内容**：完成站点表格语义收口，表格回归“配置 + 轻状态 + 快速操作”。
- **处理动作**：
  - 重构列结构与列定义：名称/Key/类型·格式/权重/成人/来源/启用状态/最近采集/采集操作/操作。
  - 移除表格内 run 级监控文案与任务进度展示。
  - `Key` 列接管 API 信息（hover + copy）。
  - 管理操作改为 dropdown，配置文件来源删除禁用。
  - 更新相关列筛选映射、排序字段与单测。
- **冲突处理**：固定列标准与“默认列含 API 地址”冲突，按固定列标准执行。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run`。

## [LOG-20260321-0341-01] CHG-121 表格回归缺陷修复完成
- **时间**：2026-03-21 03:41
- **类型**：INFO
- **关联任务**：CHG-121
- **内容**：修复 CHG-120 上线后的 5 项交互回归。
- **处理动作**：
  - 权重档位编辑从表头迁移到权重列筛选面板。
  - Key 列补充 hover 完整 API，copy 改图标并加入复制 fallback。
  - 权重展示改为仅“高/中/低”，点击可循环切换。
  - 成人、启用状态移除 fromConfig 禁用，恢复可点击更新。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/AdminCrawlerTabs.test.tsx`。

## [LOG-20260321-2358-01] CHG-140 看板与系统页结构收口完成
- **时间**：2026-03-21 23:58
- **类型**：INFO
- **关联任务**：CHG-140
- **内容**：看板页与系统页已统一收口到 AdminPageShell 骨架与 hover 说明策略。
- **处理动作**：
  - 校验 `/admin`、`/admin/analytics`、`/admin/system/{cache,monitor,config,settings,migration}` 页面结构一致性。
  - 执行全量检查并记录结果，确认无业务逻辑与 API 行为变更。
  - 更新 `task-queue/tasks/changelog`，切换 CHG-141 为进行中。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run`。
- **后续**：执行 CHG-141（全量回归与文档收口）。

## [LOG-20260322-0004-01] CHG-141 全量回归与文档收口完成
- **时间**：2026-03-22 00:04
- **类型**：INFO
- **关联任务**：CHG-141
- **内容**：完成后台界面统一重构序列（CHG-133 ~ CHG-141）最终验收与文档闭环。
- **处理动作**：
  - 全量执行 typecheck/lint/test:run 并确认通过。
  - 校验任务序列状态一致性，收口 `task-queue/tasks/changelog/run-logs`。
  - 将 `SEQ-20260321-34` 标记为已完成。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run`。
- **后续**：等待下一阶段任务分配（保持一任务一提交执行节奏）。

## [LOG-20260322-0026-01] CHG-143 表头拖拽分隔线可视反馈统一
- **时间**：2026-03-22 00:26
- **类型**：INFO
- **关联任务**：CHG-143
- **内容**：统一后台列表页拖拽句柄的可见分隔线与 hover 反馈样式。
- **处理动作**：
  - 将 shared 列表页及 crawler-site 表头拖拽句柄 class 统一为“默认可见分隔线 + hover 高亮”。
  - 保持原有拖拽事件、列宽持久化与排序筛选逻辑不变。
  - 同步 `tasks/task-queue/changelog`，切换 CHG-144 为进行中。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/videos/VideoTable.test.tsx tests/unit/components/admin/sources/SourceTable.test.tsx tests/unit/components/admin/users/UserTable.test.tsx tests/unit/components/admin/content/SubmissionTable.test.tsx tests/unit/components/admin/content/SubtitleTable.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx tests/unit/components/admin/system/monitoring/CacheManager.test.tsx tests/unit/components/admin/system/monitoring/PerformanceMonitor.test.tsx`。
- **后续**：执行 CHG-144（统一 sticky 表头能力）。

## [LOG-20260322-0027-01] CHG-144 sticky 表头能力统一完成
- **时间**：2026-03-22 00:27
- **类型**：INFO
- **关联任务**：CHG-144
- **内容**：为 shared 表格容器统一启用 `thead` sticky，列表滚动时列名行保持可见。
- **处理动作**：
  - 更新 `AdminTableFrame` table class，统一设置 `thead sticky top-0 z-20`。
  - 保持业务表格结构与交互逻辑不变。
  - 同步 `tasks/task-queue/changelog`，切换 CHG-145 为进行中。
- **验证**：`npm run typecheck`、`npm run lint`、`npm run test:run -- tests/unit/components/admin/videos/VideoTable.test.tsx tests/unit/components/admin/sources/SourceTable.test.tsx tests/unit/components/admin/users/UserTable.test.tsx tests/unit/components/admin/system/CrawlerSiteManager.test.tsx`。
- **后续**：执行 CHG-145（任务记录页接入统一表格规范）。

---

## 偏离检测记录模板（补充）

> 用于任务完成后的结构健康记录；与功能完成日志并行记录。

```markdown
## [LOG-YYYYMMDD-HHMM-XX] <TASK-ID> 偏离检测
- **时间**：YYYY-MM-DD HH:MM
- **模块**：<module-name>
- **命中项**：
  - [ ] 补丁替代结构修复
  - [ ] 兼容旧逻辑导致复杂度增加
  - [ ] 状态/数据流不清晰（多来源/重复）
  - [ ] 组件职责膨胀
  - [ ] 修改触及无关代码
- **判定**：是否“结构开始劣化”（是/否）
- **劣化点**：<file/module>
- **本次仍最小修复原因**：<reason>
- **是否建议重构**：是/否（理由）
- **污染连续计数（streak）**：<n>
```

## 连续污染升级模板（补充）

```markdown
## [LOG-YYYYMMDD-HHMM-XX] 模块高风险预警（连续污染>=3）
- **时间**：YYYY-MM-DD HH:MM
- **模块**：<module-name>
- **触发原因**：重复逻辑增加 / 状态复杂度上升 / 额外补丁维持功能（连续 3 次）
- **建议**：暂停功能开发，先进行小规模重构
- **最小重构范围**：<scope>
- **不影响功能的拆分方案**：
  1. 页面层：
  2. hooks 层：
  3. services/api 层：
  4. utils/types 层：
```
