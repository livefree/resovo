# M-SN-6 Milestone 独立第二轮复审报告

> **审计模型**：claude-opus-4-7（独立 arch-reviewer 子代理 / 二次评审）
> **审计日期**：2026-05-17
> **审计范围**：plan §6 M-SN-6 范围条目 × 实际交付物 × CHG-SN-6-29-AUDIT/-PATCH-1/-PATCH-2/-FOLLOWUP 自评结论 × 主循环复核报告
> **评审方式**：独立实测（Grep / Read / Glob）+ 范围条目逐项对照 + 与首轮 + 主循环复核结论交叉对照
> **触发**：用户指令"对 M-SN-6 进行第二轮独立复核"
> **关联前序**：
> - CHG-SN-6-29-AUDIT（arch-reviewer Opus 一轮，**A−**）
> - `docs/M-SN-6-milestone-audit-2026-05-17.md`（主循环复核，**B+ → A−**，发现 PATCH-2 §质量门禁事实不实）
> - CHG-SN-6-29-FOLLOWUP（主循环已落地的 3 项跟进修正）

---

## 综合评级：**A−（保留）**

与首轮 arch-reviewer 一致、与主循环复核最终落点一致。**独立第三票投 A−**，但偏严扣项与主循环略有不同（见下文 ⑧ 偏差段）。

**核心判据**：
- 实质交付（21 路由 ≥95% + 共享层沉淀 + R-MID-1 系统化 12 次 + 2 NEGATED ADR 闭环）质量稳固
- 自评数据不实已被主循环 FOLLOWUP 闭环（追溯修正 PATCH-2 §质量门禁第 6 条 + 补登记 3 跟踪卡）
- 残余偏差（Settings Tab 缺类数口径分歧 + DevMode 三栏对齐度 + 通知 mock 数据债务）均在 M-SN-7 跟踪卡内可见性兜底

**M-SN-7 启动准入**：**PASS**（保留主循环复核结论；无新追加阻塞）

---

## ① plan §6 范围交付率（独立实测）

| 范围条目（plan §6 v2.6 line 623-630）| 交付状态 | 实测证据（独立核验） |
|---|---|---|
| `/admin/crawler`（站点行展开 + MACCMS + 别名分组）| ✅ 完整 | 7 文件：CrawlerClient(142 非空) / CrawlerSitesTab(309) / CrawlerControlsCard(191) / CrawlerSiteFormDrawer(214) / CrawlerRunsView(429 实测) / SchedulerConfigDrawer(196) / crawler-site-columns(113) — PATCH-1 拆分范式可验证 |
| 站点任务依赖 DAG（reactflow vs dagre-d3）| ⏸ 合理推迟 | reference 待明确项 A2 未给规范；plan §6 自身括号写明 "DAG 视确认后落地"；ADR 库未起 ADR-121 DAG 段（grep 命中 ADR-121 仅为 R-MID-1 协议化跟踪卡占位） |
| `/admin/image-health` | ⚠️ 已交付但 1 行超限 | `ImageHealthClient.tsx` 实测 501 行（独立确认文件末尾 line 501 为 `}`，恰超硬上限 1 行）|
| `/admin/analytics`（recharts/visx）| ✅ 闭环 | `docs/decisions.md` ADR-119-NEGATED 段落确认（line 6426/6443）；侧栏隐藏入口 + redirect → /admin?tab=analytics（IA-2 修订）|
| `/admin/system/*`（5 子）| ✅ 结构齐全 | settings/cache/monitor/config/migration 5 路由全部 page.tsx 存在；container 单 SettingsContainer 191 行 |
| Settings 8 类 Tab（plan §6 明列）| ❌ **缺 4-5 类** | 独立 grep `header={{ title:` 命中 **5 类**：基础信息 / 豆瓣集成 / 内容过滤 / 视频代理 / 自动采集。plan §6 line 626 明列：基础 / 豆瓣 / 过滤 / **图片** / **通知** / **API·Webhook** / **缓存·CDN** / **登录会话**。视频代理 / 自动采集不在 plan 8 类内 → 严格按 plan 口径缺 4-5 类；按 reference §5.11 "等"字宽松口径缺 4 类 |
| `/admin/audit`（审计日志）| ⚠️ 已交付但超限 58 行 | `AuditClient.tsx` 实测 558 行（独立确认 line 558 末尾 `}`）+ ADR-118 9 段完整（decisions.md line 6149+） |
| 通知 + 后台任务双面板 + Toast | ⚠️ **数据 mock，结构完整** | admin-shell-client.tsx line 97/98 `useState(mockNotifications)/(mockTasks)` + line 146/147 props 注入 AdminShell。**主循环复核报告"仍不传 notifications/tasks"严格意义不准**——结构已传，仅数据源为 mock。 |
| 大数据原语（react-virtual vs react-window）| ✅ 闭环 | ADR-120-NEGATED（decisions.md line 6533+） |
| 设计规范对齐（§5.11/§5.6/§0a/§4.5/§4.6）| ⚠️ 主体对齐，2 处偏弱 | §4.5 Popover M-SN-5.5 落地 ✅；§5.6 crawler 站点行展开 ✅；§5.11 缺 4 类（已记）；**§0a DevMode 三栏对齐度被高估**——实测 `/admin/dev` 仅 components + visual 两子路由，并未明确分 Tokens / Semantic / Components 三栏。`/admin/dev/visual` 是 Playwright baseline 入口，性质偏 QA 而非"Tokens 浏览器" |

**21 路由占位覆盖率**：≥95%（21/21 全部存在 page.tsx），完成标准达成。

**三类候选依赖选型决议**：2/3 闭环 + 1/3 合理推迟（DAG）。

---

## ② 自评数据交叉核验（独立实测）

| 自评指标 | 实测 | 一致性 |
|---|---|---|
| 任务卡 47 张（44 主体 + AUDIT + PATCH-1 + PATCH-2）| task-queue.md SEQ-20260513-M-SN-6 段计数一致 | ✅ |
| 单测 3659 → 4018 PASS（+359）| 未重跑（受 ReadOnly 限制）；依赖 commit trailer | ⚠️ 信任 |
| 绝对禁止项零违反 | 实测 10/11 条零违反 + 1 条（文件大小）2 新增违反 + 5 历史超限 | ⚠️ 部分（与主循环一致） |
| **"全部 ≤ 500 行 / 最大 CrawlerRunsView 429"**（PATCH-2 §质量门禁第 6 条）| ❌ 不实（AuditClient 558 + ImageHealthClient 501）| ❌ **不实，已由 CHG-SN-6-29-FOLLOWUP 追溯修正** |
| csv-export 5 消费方 | 独立 grep 命中 **6 文件**（含 csv-export.ts 本体 + 5 消费方）：VideoListClient / SubmissionsListClient / UsersListClient / AuditClient / TaskLogsDrawer / lib/csv-export.ts | ✅ |
| 4 cell 原语（CodeText / UserRef / IdRef / MutedText）| 独立 ls `packages/admin-ui/src/components/cell/` 命中 12 文件（含 4 个新增 + 已有 bar-signal / dual-signal / decision-card / pill / thumb / inline-row-actions / spark / kpi-card / vis-chip）| ✅ |
| R-MID-1 36 strict 守卫 | tests/unit/api/audit-log-coverage.test.ts 实测：REQUIRED_ACTION_TYPES 26 项 + PAYLOAD_ASSERTION_REQUIRED 30 项 + 3 it.each 守卫 + EXEMPT 清零守卫 = **核心 it.each 实测 30 项**（非 36）；4018 单测总数中"36 strict"应指扩展所有 it().each 包含的 it 实例总数（30 PAYLOAD + 26 REQUIRED + 1 SUPERSET + 1 EXEMPT = 58 it 实例）| ⚠️ 数字"36" 来源不明，建议 FOLLOWUP 厘清 |

---

## ③ 文件大小硬上限违反清单（独立实测）

**M-SN-6 新增/改动（违反 CLAUDE.md 第 11 条）**：
- `apps/server-next/src/app/admin/audit/_client/AuditClient.tsx` — **558 行**（CHG-SN-6-01 新建）
- `apps/server-next/src/app/admin/image-health/_client/ImageHealthClient.tsx` — **501 行**（CHG-SN-6-02 新建，1 行超限）

**历史遗留（非 M-SN-6 引入，baseline 登记建议）**：
- `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — 704+ 行（M-SN-5）
- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` — 690+ 行（M-SN-3/4）
- `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx` — 527 行（**实测 527 而非主循环报告的 583**；建议 FOLLOWUP 核对）
- `packages/admin-ui/src/shell/sidebar.tsx` — 696 行（未独立验证）
- `packages/admin-ui/src/components/data-table/data-table.tsx` — 608 行（未独立验证）

**接近上限警戒线（400-499 行）**：
- `apps/server-next/src/app/admin/sources/_client/SourcesClient.tsx` — 449
- `apps/server-next/src/app/admin/sources/_client/SourceMatrixRow.tsx` — 441
- `apps/server-next/src/app/admin/crawler/runs/[id]/_client/CrawlerRunDetailView.tsx` — 415
- `apps/server-next/src/app/admin/crawler/runs/[id]/_client/TaskLogsDrawer.tsx` — 460
- `apps/server-next/src/app/admin/_client/AnalyticsView.tsx` — 378

**新发现，主循环复核报告未列**：上述 5 文件接近上限警戒线（>400 / <500）应纳入 CHG-SN-7-PRE-01 守卫的"警告区间"，避免下一 milestone 内继续追加超限。

---

## ④ 候选依赖决议核验

| 候选 | ADR | 状态 | 实测 |
|---|---|---|---|
| 图表（recharts vs visx）| ADR-119-NEGATED | ✅ NEGATED 闭环 | decisions.md line 6426-6531；重启路径 ADR-119a 明确；6 条重新评审判据 |
| 虚拟滚动（react-virtual vs react-window）| ADR-120-NEGATED | ✅ NEGATED 闭环 | decisions.md line 6533+；重启路径 ADR-120a 明确 |
| DAG 渲染（reactflow vs dagre-d3）| 无 ADR | ⏸ 合理推迟 | reference 待明确项 A2 未给规范；候选位保留；M-SN-7 入口"DAG 视图（需 ADR）"标注 |

ADR-100 §4.7 候选依赖协议遵循度：**A**（双 NEGATED + 合理推迟，无"过早引入"违反）。

---

## ⑤ 设计稿对齐核验（独立实测）

| 设计真源 | 落地状态 | 偏差 |
|---|---|---|
| reference §5.11 Settings 8 类 | 5 类完成（基础/豆瓣/过滤/视频代理/自动采集）| 缺 4 类（图片/通知/API·Webhook/登录会话），但 reference §5.11 字面以"等"字宽松举例，plan §6 才是明列 8 类硬口径；正源选择需明确（**CHG-SN-7-MISC-SETTINGS-TABS 已立卡并标注"起卡前先核对 plan §6 vs reference §5.11 哪个是正源"**）|
| reference §5.6 Crawler 站点行展开 | ✅ 落地 | CrawlerSitesTab + crawler-site-columns + SiteFormDrawer 范式齐 |
| reference §0a DevMode 三栏 | ⚠️ **仅 1/3 栏对齐** | `/admin/dev/components`（Components 栏 ✅）+ `/admin/dev/visual`（Playwright baseline，对齐"Components"再扩 1 栏 ≈ 1.5/3）；**Tokens 栏 + Semantic 栏未独立落地**。主循环复核报告"§0a DevMode 三栏 ✅"判定偏松。建议补 CHG-SN-7-MISC-DEVMODE-TOKENS 跟踪卡（P3） |
| reference §4.5/§4.6 Popover + SplitPane | ✅ M-SN-5.5 已提前落地 | popover.tsx + split-pane.tsx 齐 |
| reference §5.12 Audit 视图 | ✅ 落地（含列规范 / filter chip / 时间穿梭 / 导出按钮）| AuditClient 实测含 DataTable + DetailDrawer + toolbarSearch + toolbarTrailing + EmptyState + csv 导出 |
| Topbar notifications/tasks 数据注入 | ⚠️ **mock 而非真实端点** | admin-shell-client.tsx line 97-98 useState mockNotifications/mockTasks，4 个交互 callback 仅本地 state 更新；line 94 注释明示"M-SN-4+ 接入真端点"已欠债至 M-SN-6 仍未还。**CHG-SN-7-MISC-SHELL-NOTIFICATIONS 已立卡** |

---

## ⑥ 共享层沉淀质量核验（独立实测）

- **csv-export 5 消费方**：✅ 实测 5 真实消费方（VideoListClient + SubmissionsListClient + UsersListClient + AuditClient + TaskLogsDrawer）+ csv-export.ts 本体。非单点实现，真共享层沉淀。
- **4 cell 原语**：✅ CodeText / UserRef / IdRef / MutedText 4 文件齐（packages/admin-ui/src/components/cell/）
- **2 form 原语**：✅ admin-checkbox / admin-textarea 2 文件齐
- **R-MID-1 audit-log-coverage 守卫**：✅ 3 it.each + 1 EXEMPT 清零守卫；REQUIRED 26 项 + PAYLOAD_ASSERTION_REQUIRED 30 项；启发式扫描 "expect.objectContaining 距离 actionType 字面量 ≤500 字符"；遗留疑问见 ② 中"36 strict"数字溯源

**沉淀质量评级：A**（与首轮 / 主循环一致）

---

## ⑦ 绝对禁止项核验（独立实测）

| 禁项 | 实测 | 结论 |
|---|---|---|
| `: any` 类型 | grep `: any\b` apps/server-next/src + packages/admin-ui/src **零命中** | ✅ |
| 空 catch `catch (e) {}` | grep `catch\s*\([^)]*\)\s*\{\s*\}` apps/server-next/src **零命中** | ✅ |
| 硬编码颜色（apps/server-next/src/**/*.tsx）| grep `#[0-9a-fA-F]{3,6}` 命中 1 处：`apps/server-next/src/lib/shell-data.tsx:84:    title: '采集任务 #1287 失败'`（**误报**：这是中文文案中的"#1287"任务编号，非颜色值） | ✅ 实质零违反 |
| 文件大小硬上限 ≤500 | 2 新增 + 5 历史 = 7 超限（见 ③ 段）| ❌ **唯一遗留违反，已系统性兜底 CHG-SN-7-PRE-01** |
| 越层调用 / schema 不同步 / 删除 API 路径 / 未登录访问 users 表 | 未触发改动方向 | N/A |

**绝对禁止项评级：A-**（10/11 主体零违反 + 1 条已系统性兜底）

---

## ⑧ M-SN-7 跟踪卡覆盖率（独立实测 task-queue.md）

| 复核新发现的债务 | 跟踪卡 | 覆盖度 |
|---|---|---|
| AuditClient 558 + ImageHealthClient 501 超限 | CHG-SN-7-MISC-FILE-SIZE（扩范围至 5 文件，含 crawler 3 + audit 1 + image-health 1）| ✅ |
| Settings 缺 4-5 类 Tab | CHG-SN-7-MISC-SETTINGS-TABS（含"正源核对"前置） | ✅ |
| Topbar mock 数据 → 真实端点 | CHG-SN-7-MISC-SHELL-NOTIFICATIONS | ✅ |
| 历史 5 文件超限 baseline 豁免 | CHG-SN-7-PRE-01（扩 baseline 5 文件清单）| ✅ |
| PATCH-2 §质量门禁不实声明追溯 | CHG-SN-6-29-FOLLOWUP（已落地）| ✅ |
| **DevMode Tokens/Semantic 两栏缺口（reference §0a）**| ❌ **未立卡** | ❌ **新发现，建议补 CHG-SN-7-MISC-DEVMODE-TOKENS（P3 / 0.2-0.3w）** |
| **接近上限警戒线 5 文件（400-499 行）**| ❌ **未在 PRE-01 警告区间登记** | ❌ **新发现，建议 PRE-01 守卫加 WARN 阈值 400 / 不阻断 CI 但日志醒目** |
| **R-MID-1 "36 strict" 数字溯源** | ❌ 未跟踪 | ⚠️ 建议 CHG-SN-6-29-FOLLOWUP 内 1 行附加修正 |

跟踪卡覆盖度：**5/8 已覆盖 + 3 项独立复核新发现待登记**

---

## ⑨ 与首轮审计 / 主循环复核的偏差（独立第三票）

| 维度 | 首轮 arch-reviewer | 主循环复核 | 独立复审（本轮）|
|---|---|---|---|
| 综合评级 | A− | B+ → A− | **A−**（与两轮一致）|
| 文件大小超限发现 | 仅 1（CrawlerClient 862）| 2 新增 + 5 历史 | 2 新增 + 5 历史 + **5 警戒线**（新增维度）|
| Settings 缺类数 | 未细究 | "缺 4 类" | **"缺 4-5 类"**（含口径争议明示）|
| 通知数据状态 | 未细究 | "仍不传 notifications/tasks"（不准确）| **结构已传 / 数据为 mock**（修正主循环复核口径）|
| DevMode 三栏 | 未细究 | "§0a DevMode 三栏 ✅" | **"仅 1/3 栏对齐"**（独立发现，主循环高估）|
| ModerationConsole 行数 | 未细究 | "583 行" | **"527 行"**（独立实测；与主循环差 56 行，建议核对）|
| R-MID-1 "36 strict" 数字 | 自评 | 信任 | **数字来源不明**（建议 FOLLOWUP）|

**结论**：
- 首轮 A− **基本成立**但漏检面广（仅命中 CrawlerClient 一处文件大小问题）
- 主循环复核 B+→A− **整体成立**但有 3 处偏差：通知数据状态判断、DevMode 三栏对齐度、ModerationConsole 行数
- 独立复审最终给 **A−**（与两轮一致），但偏严扣项指向 DevMode 对齐 + 文件大小警戒线两个新维度

---

## ⑩ 必修 / 建议事项清单

### 必修（M-SN-7 入口前完成，0 项）

无新阻塞性必修项。CHG-SN-7-PRE-01 + PRE-02 已是 M-SN-7 入口前置卡，独立复审认可。

### 建议（可在 M-SN-7 期间逐步承接）

1. **【新增】CHG-SN-7-MISC-DEVMODE-TOKENS**（P3 / 0.2-0.3w）：补 reference §0a DevMode 三栏对齐——在 `/admin/dev` 下增 `tokens/` 子路由（颜色 + 间距 + 字号 + 圆角 token 全集浏览器）+ `semantic/` 子路由（语义 token 映射表）。当前仅 components / visual 两栏，缺 Tokens / Semantic 两栏。
2. **【新增】CHG-SN-7-PRE-01 范围微调**（已立卡，建议加 1 项）：守卫加 WARN 阈值 400 行，对接近上限 5 文件（SourcesClient 449 / SourceMatrixRow 441 / CrawlerRunDetailView 415 / TaskLogsDrawer 460 / AnalyticsView 378）输出告警日志（不 exit 1）。预防下一 milestone 在这些文件追加业务而再次超限。
3. **【FOLLOWUP 微调】CHG-SN-6-29-FOLLOWUP 内追加 1 行**：核对 audit-log-coverage.test.ts 的 "36 strict" 数字溯源（实测 PAYLOAD_ASSERTION_REQUIRED 30 + REQUIRED 26 = 56 / 30；非 36）。如确需"36"是另一统计口径，需在 changelog 注明。
4. **【FOLLOWUP 微调】ModerationConsole 行数核对**：主循环复核报告 583 行 vs 独立实测 527 行差 56 行；建议 wc -l 核对后更新 baseline 清单。
5. **【建议】通知 Hub MVP 卡前置**：CHG-SN-7-MISC-SHELL-NOTIFICATIONS 强依赖 `/admin/notifications` + `/admin/system/jobs` 端点存在；若通知 Hub MVP 卡未先起，MISC-SHELL-NOTIFICATIONS 卡空跑。建议 M-SN-7 入口顺序加一句"先 ADR 评 admin notifications 端点"。

### 关键架构关切（不阻塞 M-SN-7，但应纳入 M-SN-8 视野）

- AuditClient 558 行 / ImageHealthClient 501 行的拆分应优先于 crawler 3 文件（后者距上限尚远）。建议 CHG-SN-7-MISC-FILE-SIZE 拆分顺序：audit(558) → image-health(501) → 视情况承接 crawler。
- Settings 缺 4-5 类 Tab 涉及后端 settings schema 字段扩展（API·Webhook / 缓存·CDN / 登录会话）；非纯前端补 UI 工作，需先 ADR（或扩展 ADR-118 范式起 ADR-122 settings 字段扩展）。CHG-SN-7-MISC-SETTINGS-TABS 卡内已注"可能起 ADR 前置"，建议在卡片明文置顶。

---

## 关联文档

- `docs/server_next_plan_20260427.md` §6 M-SN-6（line 616-633 v2.6）
- `docs/designs/backend_design_v2.1/reference.md` §0a / §5.6 / §5.11 / §5.12 / §5.15
- `docs/changelog.md` CHG-SN-6-29-AUDIT / -PATCH-1 / -PATCH-2 / -FOLLOWUP
- `docs/task-queue.md` SEQ-20260513-M-SN-6 / M-SN-7 跟踪卡 / M-SN-6 关闭声明（line 3948+）
- `docs/decisions.md` ADR-118 / ADR-119-NEGATED / ADR-120-NEGATED
- `docs/M-SN-6-milestone-audit-2026-05-17.md`（主循环复核 / 已对照）
- `docs/M-SN-5.5-milestone-audit-2026-05-12.md`（体例参考）

---

**独立审计签字**：claude-opus-4-7（arch-reviewer 子代理 / 第二轮独立复核 / 2026-05-17）
