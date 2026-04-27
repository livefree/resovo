# Resovo 后台改进设计 Brief（Claude Design 启动包·轻量版）

> status: draft-v1
> owner: @engineering
> audience: Claude Design（design-handoff / design-system / design-critique / accessibility-review / ux-copy / user-research / research-synthesis 七项 skills）
> task: ADMIN-DESIGN-BRIEF-01（SEQ-20260426-01）
> generated_at: 2026-04-26 05:35
> companion: [admin_audit_20260426.md](docs/admin_audit_20260426.md)（现状报告，本 brief 不重复其内容，只引用章节号）
>
> **本 brief 是轻量版**：不含 task flows 与页面 anatomy 截图（全量版后续单独立项）。
> 目标：让 Claude Design 在 30 分钟内具备介入"审核台 / 视频源管理 / 首页运营位 / 表格基建 / 采集合并拆分"5 个题目的领域知识与边界。

---

## 1. 用户角色与 KPI

后台服务三类用户，权限由 API 层 `preHandler` 区分（auth / moderator+ / adminOnly）。

| 角色 | 主要职责 | 高频路径 | 北极星 KPI |
|---|---|---|---|
| **审核员**（moderator） | 审视频元数据准确性、决定上架/拒绝 | `/admin/moderation` → `/admin/staging` → `/admin/videos/[id]/edit` | 日均处理量 / 审核准确率 / 平均处理时长 |
| **内容运营**（admin） | 维护首页 banner / Top10 / 推荐模块、调整曝光 | `/admin/banners` → （home_modules 当前无 UI，需手工 SQL） | 首页点击率 / 内容曝光分布健康度 |
| **技术管理员**（admin） | 监控采集 / 系统状态 / 缓存 / 用户 / 数据迁移 | `/admin/crawler` → `/admin/system/*` → `/admin/users` | 采集成功率 / 源可达率 / 系统可用性 |

**当前最大用户痛感**：审核员（每处理一条视频筛选条件丢失，详见痛点 6）。**最大业务损失**：错误合并不可逆 + 验证-播放信号失真（痛点 1 + 3）。

---

## 2. 业务概念词典（设计师必读）

不打开 SQL 也能正确做设计的最小知识集。

### 2.1 实体

- **video**：一个"视频主题"（一部电影 / 一集剧集索引），不是文件本身。Resovo 不托管视频，只索引外部线路。
- **catalog**（media_catalog）：跨多个 video 实例的"作品"概念。豆瓣 / IMDB / TMDB 同一作品共享一个 catalog。**采集时若两个 video 被自动判定为同一 catalog → 它们被"合并"**。痛点 1 的根。
- **source**（video_sources）：一条可播放的视频流记录（一个 url + 集号 + 站点 key）。
- **line / 线路**：UX 概念，对用户呈现的"播放线路 1 / 线路 2"。技术上由 source 的 `source_name` 字段承担，但同一站点可有多条线路。**线路 ≠ 站点**——这是痛点 2 的概念混淆点。
- **site / 源站**（crawler_sites）：外部平台（优酷 / B 站 / SubYun 等）。一个 site 可向同一 video 提供多条 source（即多条 line）。
- **staging**：未发布视频的"暂存区"——不是单独表，而是 `is_published=false AND visibility_status='internal'` 的 video 子集。
- **moderation**：人工审核台——审 video 元数据、source 可达性、豆瓣匹配度。
- **banner**：首页顶部横幅（home_banners 表，已有完整 UI）。
- **home_module**：首页模块化运营位（home_modules 表，slot ∈ banner/featured/top10/type_shortcuts），**当前无 admin UI，痛点 7 的根**。

### 2.2 视频状态三元组（设计要在列表中显式展示）

由 DB 触发器（migration 023）强约束，**前台只接受 ✅✅✅ 全绿才不 404**：

| 字段 | 值域 | UX 含义 | 默认值 |
|---|---|---|---|
| `is_published` | true / false | 是否已上架 | false |
| `visibility_status` | 'public' / 'internal' / 'hidden' | 可见性范围 | **'internal'** ← 痛点 5 的隐藏地雷 |
| `review_status` | 'pending_review' / 'approved' / 'rejected' | 审核结果 | 'pending_review' |

**设计要求**：任何视频列表必须有"前台可见性"原子指示器（一眼看出三元组合后的"上架状态"），不能让管理员逐字段推理。

### 2.3 验证状态（source_check_status）

由 verifyWorker 聚合自 video_sources.is_active：'pending' / 'ok' / 'partial' / 'all_dead'。

**设计要求**：必须区分"链接探测结果（HEAD/Content-Type）"vs"实际播放结果（hls.js 渲染）"两个信号。当前是同一个字段，痛点 3 的本质就是这两个不同源信号被压成了一个。设计需要**分双轨展示**。

---

## 3. 现有设计资产

### 3.1 共享组件清单（必须复用，不要新造原语）

| 组件 | 路径 | 已具备能力 |
|---|---|---|
| ModernDataTable | [apps/server/src/components/admin/shared/modern-table/ModernDataTable.tsx:30](apps/server/src/components/admin/shared/modern-table/ModernDataTable.tsx) | 服务端排序 / 列设置 / 列宽拖拽 / Sticky 表头 / 批量选择 / 行内操作 |
| TableSettingsPanel + Trigger | [apps/server/src/components/admin/shared/modern-table/settings/](apps/server/src/components/admin/shared/modern-table/settings/) | 列显隐 + 可排序状态浮层 |
| AdminDropdown | [apps/server/src/components/admin/shared/dropdown/AdminDropdown.tsx:7](apps/server/src/components/admin/shared/dropdown/AdminDropdown.tsx) | 行内/工具条菜单 |
| SelectionActionBar | [apps/server/src/components/admin/shared/batch/SelectionActionBar.tsx:24](apps/server/src/components/admin/shared/batch/SelectionActionBar.tsx) | 批量操作浮条 |
| PaginationV2 | [apps/server/src/components/admin/PaginationV2.tsx:13](apps/server/src/components/admin/PaginationV2.tsx) | 分页 + pageSize 切换 |
| 其他 shared 子目录 | [apps/server/src/components/admin/shared/](apps/server/src/components/admin/shared/) | dialog / form / toast / toolbar / button / modal / feedback / layout |

### 3.2 已落地模式 vs 反例

- **已采纳模式**（保持一致即可）：videos / staging / content / users / banners 列表页（采纳率 58%，详见 audit §5.2）
- **反例（待重构，非设计师需复制）**：
  - moderation 用原生 `<table>` + 手工分页
  - sources 4 个 tab 各自手工管理 searchParams
  - image-health 走仪表盘式而非表格
  - system/monitor、cache、design-tokens 仅客户端排序

### 3.3 Token 与样式

- 颜色 / 间距 / 字号通过 CSS 变量（**禁止硬编码**，CLAUDE.md 强制规则）
- 多品牌通过 BrandProvider 注入 token（[apps/web-next/src/contexts/BrandProvider.tsx](apps/web-next/src/contexts/BrandProvider.tsx)，admin 复用机制待确认）
- 设计 token 浏览页：`/admin/design-tokens`

---

## 4. 设计约束与边界

### 4.1 必须遵守

| 约束 | 原因 |
|---|---|
| 复用 §3.1 共享组件，不新造表格/菜单/弹层原语 | 维护成本 + 已有契约 |
| 颜色 / 间距 / 字号一律走 CSS 变量 | CLAUDE.md 绝对禁止条 |
| 桌面优先（≥1280px），不为后台做 mobile 适配 | admin 操作场景非移动 |
| 单语言（中文为主），admin 当前无 i18n | 减少 brief 复杂度 |
| 不修改 DB schema、不改 API 契约 | design 不输出后端决策 |
| 字符串走 ux-copy 规范（空态 / 错误 / CTA 命名） | 与前台保持调性一致 |

### 4.2 禁止改动的区域

- `apps/web/`（已废弃，仅 .next/ 残留，将由 CHG-G 一并删除）
- `apps/web-next/`（前台，与 admin 共享部分 token，但页面层不归 design 此次范围）
- `apps/api/`、`apps/server/src/app/admin/[id]/route.ts` 等服务端代码

### 4.3 可以建议但需走 ADR

- 新增任何"跨 3+ 模块复用的设计 token"
- 修改 ModernDataTable 的 Props 接口（是 ADR-候选，需主循环 spawn Opus arch-reviewer 子代理评审，详见 CLAUDE.md §模型路由规则）
- 新增"全局通知 / 命令面板 / 全局搜索"等顶层架构件

---

## 5. 9 痛点 + 8 隐性问题的 design 归属

引用 [admin_audit_20260426.md §7](docs/admin_audit_20260426.md) §8。逐条标 design 角色：

### 5.1 9 大痛点

| # | 痛点 | 优先级 | Design 角色 | 关键设计输出 |
|---|---|:-:|---|---|
| 1 | 采集错误合并 + 缺人工拆分 | P0 | **辅助** | "merge candidate 预览面板" + "拆分确认弹层"的交互稿；判定算法不归 design |
| 2 | 一视频一站点只能 1 线路（实为 UI 缺失） | P1 | **主导** | sources 列表按 video 分组 + 可展开线路矩阵 |
| 3 | 验证 vs 实际播放不一致 | P0 | **主导** | "双信号显示规范"——审核台同时呈现"探测可达"与"播放可渲染"，并定义不一致时的色彩/icon/文案 |
| 4 | 标签兼容不足（豆瓣"剧情"无映射） | P1 | **辅助** | 后台标签映射管理 UI（CRUD）+ 不匹配标签的 fallback 提示；映射策略由后端定 |
| 5 | 前台 404（visibility 默认 internal） | P1 | **主导** | 视频列表"前台可见性原子指示器" + 编辑保存时的"前台是否可见"确认提示 |
| 6 | 审核台筛选每处理一条就重置 | P0 | **主导** | 状态保留型批量审核流的交互稿（含 URL/storage 持久化策略 + "下一条"快捷推进） |
| 7 | 首页 banner / Top10 / 推荐缺统一管理 | P1 | **主导** | 首页运营位统一编辑器 UI（slot 维度 + 时间窗 + 品牌 scope + 拖拽排序） |
| 8 | 视频源管理需按线路展示 + 可展开 | P1 | **主导** | 与 #2 同域，合并交付：sources 中心 + 视频详情下的线路面板 |
| 9 | 后台表格界面不统一 | P1 | **主导** | ModernDataTable v2 设计契约（含 useTableQuery hook 的 URL 同步规范）+ 5 个非合规模块的迁移设计 |

### 5.2 8 条隐性发现

| # | 隐性问题 | Design 角色 |
|---|---|---|
| H-1 | apps/web/ 完全废弃可删 | 非范围（纯工程） |
| H-2 | architecture.md 与现实脱节 | 非范围（文档维护） |
| H-3 | banner / module 修改无 cache.invalidate | 非范围（后端） |
| H-4 | ExternalDataImportService 绕过 genreMapper | 与痛点 4 合并 |
| H-5 | visibility 默认 internal 是否合理 | **辅助**（与痛点 5 合并；design 给"默认值改 public"或"明确提示"两版方案权衡） |
| H-6 | 软删除过滤无统一中间件 | 非范围（后端） |
| H-7 | 鉴权混用 auth/adminOnly/moderator+ 无矩阵 | **辅助**（design 输出"鉴权矩阵可视化文档"模板） |
| H-8 | crawler-site 表格无分页 | 与痛点 9 合并 |

**统计**：design 主导 6 项 / design 辅助 4 项 / 非 design 范围 5 项（共覆盖 9 痛点 + 8 隐性 = 17 条 → 15 条已分类，剩 2 条与其他合并）。

---

## 6. 优先改进矩阵（5 项 ROI 推荐）

按 design 介入价值密度排序，建议从 1 起手。

### 推荐 1 — 审核台重构（含双信号展示）

- **覆盖痛点**：6（P0）+ 3（P0）+ 5（P1）三合一
- **现状定位**：[ModerationDashboard.tsx:45-48](apps/server/src/components/admin/moderation/ModerationDashboard.tsx) `setListRefreshKey` 强制重挂载导致 useState 筛选清零；同时验证状态字段单值无法表达"探测 vs 播放"双信号
- **Design 主导内容**：
  - 状态保留型批量审核流（URL query 持久化 + "下一条"快捷推进 + 操作确认 toast 而非整页刷新）
  - 双信号展示规范：列表列 + 详情卡片中"链接可达 / 实际可播"双指示器（色彩 + icon + tooltip 文案）
  - "前台可见性"原子指示器组件（合并三元组）
- **成功度量**：
  - 处理一条后筛选保留率 100%（当前 0%）
  - 单次审核平均点击次数 -50%
  - 审核员主观满意度 +1 分（5 分制）

### 推荐 2 — 视频源 / 线路管理重构

- **覆盖痛点**：2（P1）+ 8（P1）合卡
- **现状定位**：[SourceTable.tsx](apps/server/src/components/admin/sources/SourceTable.tsx) 4 tab 平铺，无视频维度分组；视频详情页无 source 管理区
- **Design 主导内容**：
  - sources 中心页：以 video 为分组单元 + 每组可展开线路矩阵（站点 × 集号）
  - 视频详情页 [/admin/videos/[id]/edit](apps/server/src/app/admin/videos/[id]/edit) 新增"线路面板"区块
  - 线路批量操作：复制线路到其他视频、批量重新验证、批量替换 URL
- **成功度量**：管理员"找出某视频共有几条线路"任务时间 -80%

### 推荐 3 — 首页运营位统一编辑器

- **覆盖痛点**：7（P1）
- **现状定位**：home_modules 表（迁移 050）+ CRUD 查询函数已写，但 [admin/banners.ts](apps/api/src/routes/admin/banners.ts) 是仅有的 admin API，**Top10 / 推荐模块完全无 UI**
- **Design 主导内容**：
  - 单页面统一编辑器：slot 维度（banner / featured / top10 / type_shortcuts）+ 时间窗 + 品牌 scope + 拖拽排序
  - "预览前台样式"实时反显（嵌入 iframe 或样式快照）
  - banner 与 module slot=banner 的关系澄清：UX 上是否合并为同一编辑入口（待与工程对齐）
- **成功度量**：运营人员从 SQL 操作切换到 UI 操作；首页配置变更时延 < 5min

### 推荐 4 — 共享表格 v2 设计契约 + useTableQuery hook

- **覆盖痛点**：9（P1）+ 间接解决痛点 6 的根因
- **现状定位**：ModernDataTable 采纳率 58%，无统一 URL query hook，5 个反例模块详见 audit §5.3
- **Design 主导内容**：
  - ModernDataTable v2 Props 契约（含 query state、persistedFilter、emptyState、errorState 五区设计）
  - useTableQuery hook 的 URL ↔ state 同步规范（哪些字段进 URL、哪些进 sessionStorage）
  - 5 个非合规模块的迁移设计稿（moderation / sources / image-health / system × 3）
- **成功度量**：ModernDataTable 采纳率 100%；筛选与分页解耦后零失同步

### 推荐 5 — 采集合并 / 拆分 UX

- **覆盖痛点**：1（P0）
- **现状定位**：[MediaCatalogService.findOrCreate](apps/api/src/services/MediaCatalogService.ts) step 5 模糊匹配自动合并，无 split/unmerge API/Service/UI 三层
- **Design 主导内容**：
  - "merge candidate 预览面板"：在合并发生前展示候选 catalog + 历史合并记录 + 手动拒绝合并的入口（需后端配合提供候选 API，设计给契约草稿）
  - "已合并视频拆分"工作台：错误合并的回滚流（含数据影响范围预览）
  - 合并审计日志的可视化时间线
- **成功度量**：错误合并修复时延从"无救济"到 < 1h；合并准确率可观测

---

## 7. 交付物期望

### 7.1 标准交付包（每个推荐项）

参考 design:design-handoff skill 输出格式：

1. **Figma 文件**（结构约定）：
   - Page 1: Cover（项目概述 + 状态：draft / review / accepted）
   - Page 2: User Flows（task flow 图）
   - Page 3: Wireframes（低保真）
   - Page 4: High-fidelity Designs（含组件实例化）
   - Page 5: Specs（间距 / 色彩 / 字号标注，导出给前端）
   - Page 6: Edge Cases（空态 / 错误态 / loading / 权限不足）
2. **设计 token diff 表**（Markdown）：列出新增 / 修改 / 弃用的 CSS 变量，与 [apps/server/src/components/admin/shared/](apps/server/src/components/admin/shared/) 现有 token 对齐
3. **共享组件 Props 变更建议**（Markdown）：仅当确需修改 ModernDataTable 等共享原语时附；变更需走 ADR
4. **a11y checklist**（参考 design:accessibility-review skill）：键盘导航 / 焦点环 / 对比度 ≥ 4.5:1 / aria-* / screen reader 验证清单
5. **ux-copy 规范**（参考 design:ux-copy skill）：空态 / 错误 / 确认 / CTA 文案表，中英对照（如未来需 i18n）
6. **Handoff Markdown**（提交到 `docs/design_handoff_<推荐项>_<日期>.md`）：包含上述 1-5 的索引 + 验收 checklist + 风险清单

### 7.2 协作流程

| 阶段 | 产出 | 评审方 | 时长 |
|---|---|---|---|
| 1. 题目认领 | 在 task-queue.md 新增 CHG-xx 卡（设计阶段） | 工程主循环 | 即时 |
| 2. 用户研究 | 调研笔记 + 关键发现（design:user-research） | — | 0.5d |
| 3. 低保真 | wireframes + flow 图 | 工程主循环 + design-critique self-check | 1d |
| 4. 高保真 | Figma 完整稿 + handoff md | arch-reviewer (Opus 子代理，仅当涉及共享组件契约变更时) | 1-2d |
| 5. 实施 | 工程开 CHG-xx 卡（实施阶段）按 handoff md 落地 | — | 1-3d |
| 6. 验收 | a11y + 跨浏览器 + e2e | 工程 | 0.5d |

### 7.3 与现有规范的衔接

- 必读：[docs/CLAUDE.md](CLAUDE.md)（价值排序 / 共享组件复用要求 / 颜色禁硬编码）
- 必读：[docs/admin_audit_20260426.md](docs/admin_audit_20260426.md)（现状报告，本 brief 的母本）
- 必读：[docs/rules/admin-module-template.md](docs/rules/admin-module-template.md)（admin 列表页规范）
- 必读：[docs/rules/ui-rules.md](docs/rules/ui-rules.md)（CSS 变量 / 主题 / 国际化 / 响应式 / Portal）
- 后续追加：[docs/decisions.md](docs/decisions.md) 中所有与共享组件 / token / 视图状态机相关的 ADR

---

## 附录 A. Brief 完成度检查表（self-check）

- [x] §1 三角色 + 高频路径 + KPI 明确
- [x] §2 词典覆盖 video/catalog/source/line/site/staging/moderation/banner/module 9 概念 + 状态三元组 + 验证状态双信号
- [x] §3 共享组件 ≥ 5 个引用 file:line + 已采纳/反例对照 + token 体系
- [x] §4 必须 / 禁止 / 需走 ADR 三类约束齐全
- [x] §5 9 痛点 + 8 隐性问题逐条标注 design 归属
- [x] §6 5 项推荐每项含「现状 + design 主导内容 + 成功度量」
- [x] §7 6 类交付物 + 6 阶段协作流程 + 与现有规范衔接
- [x] 全文 ≤ 350 行（轻量版定义）
- [x] 不含具体 UI 设计稿（只是 brief，不是 spec）

— END（轻量版 v1）—
