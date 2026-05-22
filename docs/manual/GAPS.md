# Manual GAPS · 实施缺失 / 意义不明模块汇总

> status: active（活跃登记）
> 起源：CHG-SN-8-MANUAL-BATCH-1（2026-05-21）
> 用途：手册定稿过程中发现的「实施已部分落地但功能不全 / 用户无法感知 / 意义不明」模块统一登记；每条对应一个 follow-up 卡待启动

> **登记规约**：
> - 每条标 `#G-<page>-<feature>` 编号，便于 manual 内 §FAQ 反向引用
> - 状态：⬜ 未启动 / 🔄 已立卡 / ✅ 已闭合 / ❌ NEGATED
> - 优先级：P0 阻塞用户高频流程 / P1 影响 admin 主线 / P2 长尾 / P3 视觉/文档

---

## 已登记 GAPS

### #G-dashboard-runall · dashboard 顶部「全站全量采集」未跟进 CHG-SN-8-01 双重 confirm

- **页面**：P-dashboard §3.4
- **状态**：⬜ 未启动
- **优先级**：P1（误触爆炸性损耗风险）
- **现象**：dashboard PageHeader「全站全量采集」按钮 onClick 调用模式与 P-crawler 旧路径同；CHG-SN-8-01 已把 crawler 页主按钮改为「全站增量」+ 全量移高级 dropdown + 双重 confirm，但 dashboard 这个按钮没跟进
- **建议修复**：同 P-crawler 范式 — 该按钮改「全站增量」primary + 全量入口移至 advanced 或直接删除（dashboard 不应承担破坏性 admin 入口）

### #G-dashboard-edit-mode · dashboard 编辑态 / CardLibrary / Fullscreen 未实装

- **页面**：P-dashboard §4
- **状态**：⬜ 长期 backlog（M-SN-N）
- **优先级**：P3
- **现象**：plan §6.1.3 / reference §5.1.3 设计意图含拖拽 + resize + 全屏 + 卡片库；当前仅浏览态
- **关联**：CHG-SN-7-MISC-DASHBOARD-3 已登记长期 backlog

### #G-dashboard-activities-mock · RecentActivityCard 部分子卡可能仍 mock

- **页面**：P-dashboard §3 / §7 FAQ
- **状态**：⬜ 待复核
- **优先级**：P2
- **现象**：CHG-SN-DASHBOARD-2 接通 stats 3 endpoints 含 activities，但具体子项是否全 live 未在 manual 编写时确认；可能存在 mock fallback
- **建议**：grep `RecentActivityCard` 调用点 + sample data 引用；如有 mock 立 follow-up 接真端点

### #G-videos-add · 视频库「+ 添加视频」按钮当前状态待确认

- **页面**：P-videos §3.5 / §7 FAQ
- **状态**：⬜ 待复核
- **优先级**：P2
- **现象**：reference §5.3 设计稿要求「手动添加视频」PageHeader action；当前 VideoListClient.tsx 未确认是否含 + 添加按钮（创建模式 VideoEditDrawer 是否可独立打开）；如无则用户唯一入口是后端 POST API
- **建议**：grep VideoListClient 「添加」/ create 入口；缺失则补 PageHeader actions + 创建模式 Drawer 打开

### #G-moderation-batch-ui · 批量审核独立入口缺失

- **页面**：P-moderation §4.2
- **状态**：⬜ 未启动
- **优先级**：P1（审核效率）
- **现象**：后端 `batch-approve` / `batch-reject` 端点已存在（apps/api/src/routes/admin/moderation.ts:248/279），但前端无对应批量操作 UI；审核员只能 J/K 单条处理
- **建议**：审核台增「批量模式」toggle → 多选 → 批量动作；或在 videos 表批量动作内复用

### #G-moderation-preset-team · FilterPreset 多账号共享缺失

- **页面**：P-moderation §3.4 / §7 FAQ
- **状态**：⬜ 未启动
- **优先级**：P3
- **现象**：sessionStorage 仅本地浏览器；同团队审核员无法共享预设
- **建议**：加 `team_scope` 字段 + 后端 user_filter_presets 表 + 共享 UI

### #G-merge-candidate-b-auto · 审核台类似 tab 深链 candidate_b 未自动填入 Merge 页

- **页面**：P-merge §3.3 / §7 FAQ
- **状态**：⬜ 未启动
- **优先级**：P1（W4 工作流流畅度）
- **现象**：CHG-SN-8-04-VIEW 行级「发起合并」深链已携带 `?candidate_a=<当前>&candidate_b=<相似>`，但 MergeClient 当前仅消费 candidate_a；candidate_b 在 URL 但 DirectMergeWorkspace 内 VideoPicker 默认 null 需手动重选
- **建议修复**：MergeClient 增 `const candidateBParam = searchParams.get('candidate_b')` + 初始 fetch 一次 PickerVideoItem 注入 VideoPicker.value；移除「手动重选」步骤

### #G-sources-replace-similar · 「一键替换最相似 URL」算法实装

- **页面**：P-sources §3.1 / §7 FAQ
- **状态**：🔄 已立 follow-up（CHG-SN-8-FUP-SOURCES-REPLACE-ADR）
- **优先级**：P2
- **现象**：CHG-SN-8-FUP-SOURCES-DEAD-BTN 已修死按钮 + Modal 解释，但实际算法（URL 相似度 + 批量改写 + audit + 回滚）未实装

### #G-shell-notifications · 侧栏 mock badge 未接真端点

- **页面**：用户问题 #1
- **状态**：🔄 已立 follow-up（CHG-SN-7-MISC-SHELL-NOTIFICATIONS）
- **优先级**：P1
- **现象**：admin-shell-client.tsx:97-98 mockNotifications/mockTasks 仍是 stub；端点 `/admin/notifications` / `/admin/system/jobs` 不存在，需先通知 Hub MVP ADR

### #G-dev-mode-3panels · 开发者模式 3 栏只做 1 栏

- **页面**：用户问题 #12
- **状态**：⬜ 长期 backlog（M-SN-N）
- **优先级**：P3
- **现象**：reference 设计稿要求 Components / Tokens / Semantic 3 栏；当前仅 components 栏（/admin/dev/components + /admin/dev/visual/）

### #G-user-menu-real-features · 用户菜单 profile 编辑 / preferences 全功能 / switchAccount 真实功能

- **页面**：P-moderation / 00-roles-and-permissions §4
- **状态**：🔄 部分（CHG-SN-8-FUP-USER-MENU 已提供反馈 Modal/Toast 占位）
- **优先级**：P3
- **现象**：profile 编辑筹备 / preferences 仅 theme 一项可用 / switchAccount toast 提示「M-SN-N」
- **建议**：M-SN-N 起独立 feature 卡

---

## 闭合规则

- 立 follow-up 卡时同步在本表条目添加状态 `🔄 已立 follow-up（CHG-XX）`
- 闭合时改 `✅ 已闭合（CHG-XX commit hash）`
- 5 个工作日未触动的条目应在 milestone audit 重审优先级

## 引用规约

- manual 页 §7 FAQ 可用 `GAPS.md #G-xxx` 反向引用本表
- changelog 条目涉及 gap 修复时引用对应编号

## 后续待复核

- P-image-health：所有 actions / endpoints 实证已确认（CHG-SN-8-FUP-IMAGE 通过 grep 验证 4 actions + 6 endpoints 全在位）— 无 gap
- P-crawler：CHG-SN-8-02-B 调度列已登记（不在本表，task-queue 直登记）
- 后续 batch 2-4 manual 编写时新发现 gap 追加到本表
