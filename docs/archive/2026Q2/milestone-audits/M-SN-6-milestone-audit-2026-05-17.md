# M-SN-6 Milestone 阶段审计报告（复核）

> 审计模型：claude-opus-4-7（主循环复核，**非独立 arch-reviewer 二次评审**）
> 审计日期：2026-05-17
> 审计范围：plan §6 M-SN-6 范围条目 × 实际交付物 × CHG-SN-6-29-AUDIT/-PATCH-1/-PATCH-2 自评结论
> 评级模板：`docs/server_next_plan_20260427.md` §5.3 A/B/C
> 评审方式：实测 wc -l + 范围条目逐项对照 + 自评数据交叉核验
> 触发：用户指令 "审核 M-SN-6，参考设计稿和功能实现，汇报完成质量"
> 关联前序：`docs/changelog.md` CHG-SN-6-29-AUDIT（arch-reviewer Opus 一轮，原评级 **A−**）

---

## 综合评级：**B+ → A−**

原 arch-reviewer A− 评级**基本成立**，但本次复核发现 **1 项自评数据不实**（PATCH-2 §质量门禁第 6 条 "全部 ≤ 500 行" 与实测矛盾），若严格计较自评数据准确性应降半档为 B+；若按实质交付与系统性盲点修复保留 A−。

**M-SN-7 启动准入：PASS**（H1 已修 + 7 跟踪卡可见性兜底 + 候选依赖 ADR-119/120 NEGATED 闭环 + 21 路由覆盖率 ≥95% 达标）。

---

## ① 范围交付率（plan §6 M-SN-6 范围条目逐项核验）

| 范围条目 | 交付状态 | 实测证据 |
|---|---|---|
| `/admin/crawler`（站点行展开 + MACCMS + 别名分组）| ✅ 完整 | 7 文件：CrawlerClient(157) + CrawlerSitesTab(334) + CrawlerControlsCard(202) + CrawlerSiteFormDrawer(227) + CrawlerRunsView(429) + SchedulerConfigDrawer(218) + crawler-site-columns(116) |
| 站点任务依赖 DAG | ⏸ **合理推迟** | reference 待明确项 A2 未给规范；reactflow vs dagre-d3 候选位保留 |
| `/admin/image-health` | ⚠️ **已交付但超限** | `ImageHealthClient.tsx` **501 行**（**1 行超 500 硬上限**）|
| `/admin/analytics`（recharts/visx 选型）| ✅ 闭环 | `ADR-119-NEGATED`（CHG-SN-6-11 / 2026-05-16）+ `redirect → /admin?tab=analytics`（IA-2 修订）+ 候选位保留 |
| `/admin/system/*`（5 子视图）| ✅ 结构齐全 | settings / cache / monitor / config / migration 5 子路由全部存在 |
| Settings 8 类 Tab（plan §6 明确口径）| ⚠️ **只 5 类** | 实测 SettingsTab.tsx 5 section（基础 / 豆瓣 / 内容过滤 / 视频代理 / 自动采集），缺 4 类：**图片、通知、API·Webhook、登录会话**。reference §5.11 原文仅举 "Basic/Douban/Filter/Images **等**" 为示例，按 reference 字面未硬性偏离；按 plan §6 自身明列口径则缺 4 类 |
| `/admin/audit`（审计日志新视图）| ⚠️ **已交付但超限** | `AuditClient.tsx` **558 行**（**超 500 硬上限 58 行**）+ ADR-118 + `GET /admin/audit/logs`(/:id)(/enums) 端点 |
| 通知 + 后台任务双面板 + Toast | ⚠️ **半成品** | Drawer 形态保留，但 `admin-shell-client.tsx` 自标 "仍不传 notifications/tasks"（reference §0a §322），Topbar 入口可见 disabled / countProvider 未注入 |
| 大数据原语（虚拟滚动 react-virtual vs react-window）| ✅ 闭环 | `ADR-120-NEGATED`（CHG-SN-6-12 / 2026-05-16）+ 候选位保留 |
| 设计规范对齐（§5.11/§5.6/§0a/§4.5/§4.6）| ✅ 主体对齐 | §4.5 Popover 已 M-SN-5.5 提前落地；§5.6 crawler 站点行展开 ✅；§0a DevMode 三栏 ✅ |

**21 路由占位覆盖率**：实测 21 路由全部存在（含 redirect / 占位 page.tsx）→ **≥95% 完成标准达成**。

**设计稿对齐度**：主体一致；存在 2 处偏差（Settings 8 类口径 + 通知数据注入）。

**三类候选依赖选型决议**：2/3 闭环（chart NEGATED + virtual scroll NEGATED）；1/3 合理推迟（DAG 因前置规范缺失）。

---

## ② 自评数据交叉核验

| 自评指标（PATCH-2 §质量门禁）| 实测 | 一致性 |
|---|---|---|
| 任务卡数 47（44 主体 + AUDIT + PATCH-1 + PATCH-2） | 与 task-queue.md SEQ-20260513-M-SN-6 段计数一致 | ✅ |
| 单测 3659 → 4018 PASS（+359） | 未在本次复核内重跑，依据 commit e030142d / e7a1102c trailer | 信任 |
| 绝对禁止项零违反（PATCH-1 修复 H1 后） | 实测 1 项遗留：**文件大小条**（见下行）；其余 10 条（any / 空 catch / 硬编码颜色 / 越层 / schema 不同步等）零违反 | ⚠️ 部分 |
| **"全部 ≤ 500 行 / 最大 CrawlerRunsView 429"** | ❌ **实测 2 文件超限**（同期新建）：AuditClient 558 / ImageHealthClient 501；另有 5 文件历史遗留超限 | ❌ **不实** |
| 5 项硬清单（视图测试 ≥9 / 共享原语 ≥80% / R-MID-1 36 strict / schema 三层 / PATCH ≤5）| 与 changelog 描述一致 | ✅ |
| csv-export 5 消费方 | TaskLogsDrawer + AuditClient + UsersListClient + SubmissionsListClient + VideoListClient | ✅ |
| R-MID-1 13 → 36 strict | audit-log-coverage.test.ts 36 项 it.each | ✅（信任）|

### 文件大小硬上限违反清单（实测 wc -l）

**M-SN-6 新增/改动**：
- `apps/server-next/src/app/admin/audit/_client/AuditClient.tsx` — **558 行**（CHG-SN-6-01 新建 / 单 export / 非声明性）
- `apps/server-next/src/app/admin/image-health/_client/ImageHealthClient.tsx` — **501 行**（CHG-SN-6-02 新建 / 单 export / 非声明性）

**历史遗留（非 M-SN-6 引入）**：
- `apps/server-next/src/app/admin/merge/_client/MergeClient.tsx` — 756 行（M-SN-5）
- `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` — 734 行（M-SN-3/4）
- `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx` — 583 行（M-SN-4）
- `packages/admin-ui/src/shell/sidebar.tsx` — 696 行
- `packages/admin-ui/src/components/data-table/data-table.tsx` — 608 行

arch-reviewer 仅命中 CrawlerClient.tsx 862 行（H1），**漏检本期同期新建的 AuditClient/ImageHealthClient 两处**。已立 CHG-SN-7-PRE-01 文件大小守卫卡可制度兜底；但 PATCH-2 §质量门禁"全部 ≤ 500 行"声明事实不实，建议追加 follow-up changelog 修正以免后续审计被误导。

---

## ③ 亮点

1. **csv-export 工具 5 消费方复用** + 4 共享 cell 原语（CodeText / UserRef / IdRef / MutedText）+ 2 form 原语（AdminCheckbox / AdminTextarea）— 真共享层沉淀，非单点实现。
2. **CrawlerClient.tsx 862 → 157 行拆分**（PATCH-1）：orchestrator + 3 容器 + 1 form + 1 column 工厂的范式清晰可复用；createTrigger counter 范式优于 ref / imperative handle。
3. **2 个 NEGATED ADR**（ADR-119 chart / ADR-120 virtual scroll）正确遵循 ADR-100 §4.7 候选依赖协议，未"过早引入"，并提供 future 重启路径（ADR-119a / ADR-120a）。
4. **R-MID-1 audit payload 36 项 strict 守卫**（audit-log-coverage.test.ts it.each）— 把"audit payload 一致性"从约定升级为强制。
5. **绝对禁止项 11 条主体零违反**（仅文件大小一条遗留 2 项新增 + 5 项历史，已系统性兜底 CHG-SN-7-PRE-01）。

---

## ④ 隐性风险与补登记建议

| 风险 | 当前 M-SN-7 跟踪 | 复核建议 |
|---|---|---|
| AuditClient 558 / ImageHealthClient 501 行超 500（M-SN-6 新增）| ❌ 未单独登记 | 并入 CHG-SN-7-MISC-CRAWLER-FILE-SIZE → 改名为 **CHG-SN-7-MISC-FILE-SIZE** 含 5 文件预案（crawler 3 + audit 1 + image-health 1）|
| 既存 MergeClient 756 / VideoListClient 734 / ModerationConsole 583 / sidebar 696 / data-table 608 | ❌ 未登记 | CHG-SN-7-PRE-01 文件大小守卫卡需追加 baseline 豁免清单（新增文件零容忍 + 历史 5 文件标记 baseline）|
| Settings 缺 4 类 Tab（图片 / 通知 / API·Webhook / 登录会话）| ❌ 未立 | 建议 **CHG-SN-7-MISC-SETTINGS-TABS**（P2 / 0.3-0.5w）|
| Topbar notifications/tasks 数据未注入 | ⚠️ 隐含于 M-SN-7 通知 Hub MVP | 通知 Hub MVP 卡前置任务，建议在 ADR 段显式列出 admin-shell countProvider 注入项 |
| PATCH-2 §质量门禁"全部 ≤ 500 行"事实不实 | ❌ 未追溯 | 建议追加一行 changelog follow-up 修正 |

---

## ⑤ 评级汇总

| 维度 | 评分 | 依据 |
|---|---|---|
| 范围交付率 | A− | 21 路由 ≥95%；DAG 合理推迟；通知数据注入半成品 |
| 设计稿对齐 | B | Settings 缺 4 类 + 通知数据未注入 |
| 共享层沉淀 | A | csv-export 5 消费方 + 4 cell + 2 form + R-MID-1 36 strict |
| 自评数据准确性 | B− | "全部 ≤ 500" 不实（漏 2 新增 + 5 历史）|
| 绝对禁止项 | A | 11 条主体零违反；文件大小条已系统性兜底 |
| 候选依赖协议 | A | ADR-119/120 NEGATED 双闭环；DAG 合理推迟 |
| H1 系统性盲点修复 | A | PATCH-1 862 → 157 行拆分范式清晰 |

**综合评级**：**B+ → A−**

- 若严格按"自评数据准确性"扣分：**B+**
- 若按"实质交付质量 + H1 已修 + 7 跟踪卡可见性兜底"：**A−**（与原 arch-reviewer 一致）

---

## ⑥ M-SN-7 启动准入

✅ **PASS**（无条件）

理由：
1. H1 必修闭环（CrawlerClient 862 → 157）
2. PATCH-2 7 跟踪卡可见性兜底
3. 候选依赖 ADR-119/120 NEGATED 双闭环
4. 21 路由占位覆盖率 ≥95%
5. 绝对禁止项主体零违反

**M-SN-7 入口顺序建议**（基于本复核新发现）：

1. **CHG-SN-7-PRE-01**（文件大小守卫）— **追加 7 文件 baseline 豁免清单**（M-SN-6 新增 2 + 历史遗留 5），新增文件零容忍
2. **CHG-SN-7-PRE-02**（ADR-121 R-MID-1 协议化）— 不变
3. **CHG-SN-7-MISC-FILE-SIZE**（原 CRAWLER-FILE-SIZE 扩范围）— 5 文件主动拆分预案（crawler 3 + audit 1 + image-health 1）
4. **CHG-SN-7-MISC-SETTINGS-TABS**（**复核新增建议**）— 补 4 类缺失 Tab（图片 / 通知 / API·Webhook / 登录会话）
5. 通知 Hub MVP（需 ADR / 前置 countProvider 注入 admin-shell-client）
6. DAG 视图 ADR（reactflow vs dagre-d3 决策，待 reference §A2）

---

## ⑦ 关联文档

- `docs/server_next_plan_20260427.md` §6 M-SN-6 范围定义（v2.6）
- `docs/designs/backend_design_v2.1/reference.md` §0a / §5.6 / §5.11 / §5.12 / §5.15
- `docs/changelog.md` CHG-SN-6-29-AUDIT（10270-10333）/ -PATCH-1（10336-10429）/ -PATCH-2（10432-10498）
- `docs/task-queue.md` SEQ-20260513-M-SN-6 / M-SN-7 跟踪卡（7 卡）/ M-SN-6 milestone 关闭声明
- `docs/decisions.md` ADR-118（audit 端点）/ ADR-119-NEGATED（chart）/ ADR-120-NEGATED（virtual scroll）
- `docs/M-SN-5.5-milestone-audit-2026-05-12.md`（参考体例）

---

**审核人签字**：claude-opus-4-7（主循环复核，2026-05-17）
**建议后续动作**：
1. 追加一行 changelog follow-up 修正 PATCH-2 §质量门禁"全部 ≤ 500 行"声明
2. CHG-SN-7-PRE-01 / MISC-FILE-SIZE 范围扩展（含 7 文件 baseline）
3. 新增 CHG-SN-7-MISC-SETTINGS-TABS（P2 / 0.3-0.5w）
