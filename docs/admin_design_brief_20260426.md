# Resovo 后台改进设计 Brief（Claude Design 启动包·轻量版）

> status: approved-for-design
> owner: @engineering
> audience: Claude Design（design-handoff / design-system / design-critique / accessibility-review / ux-copy / user-research / research-synthesis 七项 skills）
> task: ADMIN-DESIGN-BRIEF-01（SEQ-20260426-01） + ADMIN-DESIGN-BRIEF-02 修补（4 MUST + 3 SHOULD）
> generated_at: 2026-04-26 05:35
> last_revised: 2026-04-26 06:05（R1 conditional accept → R2 修补完毕，可发给 Design）
> review_round: R1 (conditional accept by claude-sonnet-4-6) → R2 (4 MUST + 3 SHOULD 已修)
> companion: [admin_audit_20260426.md](./admin_audit_20260426.md)（现状报告，本 brief 不重复其内容，只引用章节号）
>
> **本 brief 是轻量版**：不含 task flows 与页面 anatomy 截图（全量版后续单独立项）。
> 目标：让 Claude Design 在 30 分钟内具备介入"审核台 / 视频源管理 / 首页运营位 / 表格基建 / 采集合并拆分"5 个题目的领域知识与边界。

---

## 0.5 与三份方案的对齐声明（重写冻结期 BLOCKER 规避）

**性质澄清**：本 brief 的 5 项推荐均为 admin 已有模块的 **可用性 / 一致性 / UX 治理**，**不**属于"新业务需求"，因此不触发 [CLAUDE.md](../CLAUDE.md) "重写冻结期（M0–M6）只接受与三份方案目标相关的需求"BLOCKER 条款。审计依据：9 大痛点全部来自现有功能的设计漂移或 UI 缺失（详见 [admin_audit_20260426.md §7](./admin_audit_20260426.md)），无新功能引入。

**对齐矩阵**（5 项推荐 × 3 份方案）：

| 推荐 | [design_system_plan_20260418.md](./design_system_plan_20260418.md) | [frontend_redesign_plan_20260418.md](./frontend_redesign_plan_20260418.md) | [image_pipeline_plan_20260418.md](./image_pipeline_plan_20260418.md) |
|---|---|---|---|
| 1 审核台重构 | §3 Token 分层（双信号 icon/色彩走 base + brands 体系） | §3 视觉现代感（取消整页刷新感）+ §6 Token 化 | §1 图片治理输入（双信号"播放可渲染"列展示 cover health 状态） |
| 2 视频源/线路管理 | §3 Token 分层 | §6 组件化复用率 + §3 视觉现代感 | — |
| 3 首页运营位编辑器 | §3 Token 分层（内容卡片样式与前台一致） | §3 视觉现代感（编辑器内嵌前台预览）+ §5 多品牌就绪（brand_scope 字段已支持） | §2 入库治理 + §3 健康监控（banner 图替代降级链） |
| 4 共享表格 v2（ADR 候选） | §3 Token 分层（表格密度/分隔线/状态色用 base + 可被 brands 覆盖） | §6 组件化复用率（核心论据） | — |
| 5 采集合并/拆分 UX | — | §6 可扩展基础（merge candidate 预览面板复用既有原语） | — |

**强约束**：
- 5 项推荐落地时 **必须复用** [design_system_plan §3](./design_system_plan_20260418.md) 已建立的 `tokens.json` 分层体系
- **不得** 新增 admin 专属 token，必要时通过 `brands/<brand>` 覆盖，**不得污染 base**
- 5 项推荐 **不进入 M7 主轨**（属 frontend_redesign post-M6 的扩展面），不阻塞三份方案的里程碑节奏

**已对齐的工程支撑**：
- [ADR-037](./decisions.md)（执行里程碑与方案里程碑对齐协议）：本 brief 视为 frontend_redesign post-M6 扩展，需在 task-queue 启动每个推荐项时输出"对应三份方案 §X.Y"清单（ADR-037 v2 三维闭环要求）
- [ADR-039](./decisions.md)（middleware 品牌识别）：admin 后台暂不接入多品牌运行时切换；推荐 3（首页运营位）的 `brand_scope` 编辑面板按已有数据契约输出 UI 即可

---

## 0.6 Non-Goals（边界宣言）

设计师在歧义时优先自查本表：

1. **不重设计前台页面**（apps/web-next 不在范围，前台改造按 frontend_redesign_plan 主轨推进）
2. **不修改 DB schema**（[admin_audit_20260426.md §6](./admin_audit_20260426.md) 数据模型为契约真源）
3. **不增 admin i18n**（admin 当前单语言中文，国际化非 brief 范围）
4. **不做 mobile 适配**（admin 操作场景桌面优先，详见 §4.1）
5. **不引入新依赖**（[CLAUDE.md](../CLAUDE.md) 强约束："引入技术栈以外的新依赖"= BLOCKER）
6. **不修改 API 契约**（端点 path / 入参 schema / 返回结构由后端决定）
7. **不扩张 admin 权限模型**（auth / adminOnly / moderator+ 三层鉴权不增不减）
8. **不重设计 design-tokens 浏览页**（`/admin/design-tokens` 已是 design_system_plan §2 的产物，不在改造列表）

---

## 1. 用户角色与 KPI

后台服务三类用户，权限由 API 层 `preHandler` 区分（auth / moderator+ / adminOnly）。

| 角色 | 主要职责 | 高频路径 | 北极星 KPI（基线 / 目标） |
|---|---|---|---|
| **审核员**（moderator） | 审视频元数据准确性、决定上架/拒绝 | `/admin/moderation` → `/admin/staging` → `/admin/videos/[id]/edit` | 日均处理量（基线 TBD，待埋点）/ 审核准确率（基线 TBD）/ 平均处理时长（基线 TBD） / **筛选保留率：当前 0% → 目标 100%**（痛点 6 已可观测） |
| **内容运营**（admin） | 维护首页 banner / Top10 / 推荐模块、调整曝光 | `/admin/banners` → （home_modules 当前无 UI，需手工 SQL） | 首页点击率（基线 TBD）/ 内容曝光分布健康度（基线 TBD）/ **运营位配置变更时延：当前需工程介入手工 SQL → 目标 < 5min**（痛点 7 已可观测） |
| **技术管理员**（admin） | 监控采集 / 系统状态 / 缓存 / 用户 / 数据迁移 | `/admin/crawler` → `/admin/system/*` → `/admin/users` | 采集成功率（基线 TBD）/ 源可达率（基线 TBD）/ **错误合并修复时延：当前"无救济"（痛点 1）→ 目标 < 1h** / **ModernDataTable 采纳率：当前 58% → 目标 100%**（痛点 9 已可观测） |

**已可观测基线（来自 [admin_audit_20260426.md](./admin_audit_20260426.md)）**：
- 痛点 6 筛选保留率 0%（[ModerationDashboard.tsx:45-48](apps/server/src/components/admin/moderation/ModerationDashboard.tsx) `setListRefreshKey` 强制重挂载）
- 痛点 9 ModernDataTable 采纳率 58%（12 模块中完全采纳 7 个，audit §5.2）
- 痛点 1 错误合并修复时延"无救济"（无 split/unmerge API/Service/UI）
- 痛点 7 home_modules 表已建但无 admin UI（必须手工 SQL）

**TBD 项（上线后埋点采集）**：日均处理量 / 审核准确率 / 平均处理时长 / 首页点击率 / 内容曝光分布 / 采集成功率 / 源可达率 — 当前缺埋点基础设施（参见 [logging-rules.md](./rules/logging-rules.md)），属 design 不可控变量，brief 中保留 TBD 直至埋点完成。

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

引用 [admin_audit_20260426.md §7 + §8](./admin_audit_20260426.md)。逐条标 design 角色：

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

**统计**（R1 修正后口径）：

| 类别 | 项数 | 来源清单 |
|---|:-:|---|
| design 主导 | **7** | 痛点 #2, 3, 5, 6, 7, 8, 9 |
| design 辅助 | **4** | 痛点 #1, 4 + 隐性 H-5, H-7 |
| 非 design 范围 | **4** | 隐性 H-1, H-2, H-3, H-6 |
| 与其他合并 | **2** | 隐性 H-4（→痛点 4）, H-8（→痛点 9） |
| **合计** | **17** | = 9 痛点 + 8 隐性问题 ✓ |

---

## 6. 优先改进矩阵（5 项 ROI 推荐）

按 design 介入价值密度排序，建议从 1 起手。

### 推荐 1 — 审核台重构（含双信号展示）

- **覆盖痛点**：6（P0）+ 3（P0）+ 5（P1）三合一
- **现状定位**：[ModerationDashboard.tsx:45-48](apps/server/src/components/admin/moderation/ModerationDashboard.tsx) `setListRefreshKey` 强制重挂载导致 useState 筛选清零；同时验证状态字段单值无法表达"探测 vs 播放"双信号
- **前置依赖**：
  - **依赖 推荐 4** 的 useTableQuery hook（URL/storage 同步规范）—— 状态保留型审核流的基础；推荐 4 必须先于推荐 1 完成或并行交付前置契约
  - 依赖后端：双信号需新增"播放器探测"信号源（与现有 verifyWorker HEAD/Content-Type 探测并存），后端契约由工程方提供，design 仅消费字段
- **Design 主导内容**：
  - 状态保留型批量审核流（URL query 持久化 + "下一条"快捷推进 + 操作确认 toast 而非整页刷新）
  - 双信号展示规范：列表列 + 详情卡片中"链接可达 / 实际可播"双指示器（色彩 + icon + tooltip 文案）
  - "前台可见性"原子指示器组件（合并三元组）
- **成功度量**（基线 → 目标）：
  - 处理一条后筛选保留率：**0% → 100%**（已可观测，audit §7 痛点 6）
  - 单次审核平均点击次数：**TBD → -50%**（需先在改造前一次性埋点采集基线）
  - 审核员主观满意度：**TBD → +1 分（5 分制）**（需用研，参见 §7.2 阶段 2）

### 推荐 2 — 视频源 / 线路管理重构

- **覆盖痛点**：2（P1）+ 8（P1）合卡
- **现状定位**：[SourceTable.tsx](apps/server/src/components/admin/sources/SourceTable.tsx) 4 tab 平铺，无视频维度分组；视频详情页无 source 管理区
- **前置依赖**：
  - **可独立交付**——所需 API 已存在（[admin/media.ts](apps/api/src/routes/admin/media.ts) + [admin/videos.ts refetch-sources](apps/api/src/routes/admin/videos.ts:522-555)）
  - 共享组件层：复用 ModernDataTable 现有能力即可，不依赖推荐 4 升级
- **Design 主导内容**：
  - sources 中心页：以 video 为分组单元 + 每组可展开线路矩阵（站点 × 集号）
  - 视频详情页 [/admin/videos/[id]/edit](apps/server/src/app/admin/videos/[id]/edit) 新增"线路面板"区块
  - 线路批量操作：复制线路到其他视频、批量重新验证、批量替换 URL
- **成功度量**（基线 → 目标）：
  - 管理员"找出某视频共有几条线路"任务时间：**TBD（当前需在 SourceTable 多 tab 间跳转 + 手工筛选）→ -80%**
  - 多线路管理操作单次完成率：**TBD → ≥ 90%**（需用研观测）

### 推荐 3 — 首页运营位统一编辑器

- **覆盖痛点**：7（P1）
- **现状定位**：home_modules 表（迁移 050）+ CRUD 查询函数已写，但 [admin/banners.ts](apps/api/src/routes/admin/banners.ts) 是仅有的 admin API，**Top10 / 推荐模块完全无 UI**
- **前置依赖**：
  - **依赖后端**：home_modules 的 admin API 路由需先建（CRUD + 排序 + brand_scope 过滤），design 仅消费契约
  - 关系澄清需求：banner 与 module slot=banner 的 UX 合并/分离决策需与工程对齐（建议作为 design v1 的第一份 design-critique 议题）
- **Design 主导内容**：
  - 单页面统一编辑器：slot 维度（banner / featured / top10 / type_shortcuts）+ 时间窗 + 品牌 scope + 拖拽排序
  - "预览前台样式"实时反显（嵌入 iframe 或样式快照）
  - banner 与 module slot=banner 的关系澄清：UX 上是否合并为同一编辑入口（待与工程对齐）
- **成功度量**（基线 → 目标）：
  - 运营位配置变更时延：**当前需工程介入手工 SQL → < 5min**（已可观测，audit §7 痛点 7）
  - 运营人员从 SQL 操作切换到 UI 操作的迁移率：**0% → 100%**

### 推荐 4 — 共享表格 v2 设计契约 + useTableQuery hook **（ADR 候选）**

> ⚠️ **ADR 评审强制**：本推荐命中 §4.3 ADR 候选条款（"修改 ModernDataTable 的 Props 接口"）。Design 高保真稿出炉后、§7.2 阶段 4 → 5 之间，**必须** 由工程主循环 spawn Opus arch-reviewer 子代理评审契约变更（含 Props diff、迁移路径、向后兼容策略）。评审 PASS 是落地的硬前置。

- **覆盖痛点**：9（P1）+ 间接解决痛点 6 的根因
- **现状定位**：ModernDataTable 采纳率 58%，无统一 URL query hook，5 个反例模块详见 [audit §5.3](./admin_audit_20260426.md)
- **前置依赖**：
  - **可独立设计**，但落地必须先过 ADR（见上方 ⚠️）
  - 所有引用 ModernDataTable 的现有模块（[VideoTable](apps/server/src/components/admin/videos/VideoTable.tsx) 等 7 个）属"被影响方"，迁移成本由工程评估
- **Design 主导内容**：
  - ModernDataTable v2 Props 契约（含 query state、persistedFilter、emptyState、errorState 五区设计）
  - useTableQuery hook 的 URL ↔ state 同步规范（哪些字段进 URL、哪些进 sessionStorage）
  - 5 个非合规模块的迁移设计稿（moderation / sources / image-health / system × 3）
- **成功度量**（基线 → 目标）：
  - ModernDataTable 采纳率：**58% → 100%**（已可观测，audit §5.2）
  - 筛选与分页失同步事件：**TBD → 0**
  - useTableQuery hook 调用方数：**0 → ≥ 12**（覆盖全部列表模块）

### 推荐 5 — 采集合并 / 拆分 UX

- **覆盖痛点**：1（P0）
- **现状定位**：[MediaCatalogService.findOrCreate](apps/api/src/services/MediaCatalogService.ts) step 5 模糊匹配自动合并，无 split/unmerge API/Service/UI 三层
- **前置依赖**：
  - **强依赖后端**：需先建 candidate 预览 API、split/unmerge API、合并审计日志 schema（design 仅给契约草稿建议，决策权在工程 + ADR）
  - 推荐顺序最后：建议 5 个推荐项中最后启动，给后端 API 演进留时间
- **Design 主导内容**：
  - "merge candidate 预览面板"：在合并发生前展示候选 catalog + 历史合并记录 + 手动拒绝合并的入口（需后端配合提供候选 API，设计给契约草稿）
  - "已合并视频拆分"工作台：错误合并的回滚流（含数据影响范围预览）
  - 合并审计日志的可视化时间线
- **成功度量**（基线 → 目标）：
  - 错误合并修复时延：**当前"无救济"（无 split API/UI）→ < 1h**（已可观测，audit §7 痛点 1）
  - 合并准确率：**TBD → 持续可观测**（需建立合并审计日志 + 月度复盘机制）

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

- 必读：[CLAUDE.md](../CLAUDE.md)（价值排序 / 共享组件复用要求 / 颜色禁硬编码）
- 必读：[admin_audit_20260426.md](./admin_audit_20260426.md)（现状报告，本 brief 的母本）
- 必读：[rules/admin-module-template.md](./rules/admin-module-template.md)（admin 列表页规范）
- 必读：[rules/ui-rules.md](./rules/ui-rules.md)（CSS 变量 / 主题 / 国际化 / 响应式 / Portal）
- 必读 ADR（与本 brief 强相关，已显式列出）：
  - [ADR-037](./decisions.md)（执行里程碑与方案里程碑对齐协议；本 brief §0.5 强约束基础）
  - [ADR-039](./decisions.md)（middleware 品牌识别；推荐 3 brand_scope UI 契约依据）
- 后续追加：[decisions.md](./decisions.md) 中所有与共享组件 / token / 视图状态机相关的新 ADR

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

---

## Review Comments

> reviewer: 主循环 (claude-sonnet-4-6)
> reviewed_at: 2026-04-26 22:16
> review_round: R1
> verdict: **conditional accept**（修完"必须修复"4 条后可发给 Claude Design）

### R1.1 整体评价

结构完整、边界清晰、引用具体到 file:line，具备让设计师在 30 分钟内介入的信息密度。9 痛点 + 8 隐性问题逐条标 design 归属、5 项推荐含"现状—主导内容—成功度量"三段式，是这份 brief 最有价值的两块。但仍有四类"硬骨头"问题会阻塞落地，列在 R1.2。

### R1.2 必须修复（merge 前阻塞）

**MUST-1｜文档内链相对路径错误。** 元数据 companion 写 `[admin_audit_20260426.md](docs/admin_audit_20260426.md)`，但本 brief 自身位于 `docs/` 下，相对路径应为 `admin_audit_20260426.md`，否则点击会跳到不存在的 `docs/docs/admin_audit_20260426.md`。§5 引用、§7.3 必读列表中的 `docs/admin_audit_20260426.md`、`docs/CLAUDE.md`、`docs/rules/...`、`docs/decisions.md` 均同此问题。修复策略二选一：要么统一用 `./xxx.md` 与 `./rules/xxx.md`，要么把所有 `docs/` 前缀去掉。

**MUST-2｜§5.2 统计行不自洽。** 实际复核：§5.1 design 主导=7（#2,3,5,6,7,8,9），辅助=2（#1,4）；§5.2 主导=0、辅助=2（H5,H7）、非范围=4（H1,H2,H3,H6）、合并=2（H4,H8）。统计行 "design 主导 6 项 / 辅助 4 项 / 非范围 5 项 = 15 → 剩 2 合并" 与上述清单和 9+8=17 的总数都对不上。需要重新计票或重新定义口径。

**MUST-3｜缺与冻结期 + 三份方案的对齐声明。** CLAUDE.md 明令"重写冻结期（M0–M6）只接受与三份方案（design_system / frontend_redesign / image_pipeline）目标相关的需求，否则一律 BLOCKER"。本 brief 全文未提及这三份方案，Claude Design 落地时极易产出与方案不对齐的设计而触发 BLOCKER。必须在 §0 元数据下方或 §4 之前加一节"方案对齐"，逐条列出本 brief 5 项推荐分别对接三份方案的哪些目标条目。

**MUST-4｜KPI 缺基线值，导致 §6 成功度量无法验证。** §1 KPI 列只有名称无当前值；§6 出现的 "-50% / -80% / +1 分 / 100%" 若没有基线就只是数字游戏。最低限度补当前可观测的两类数据（如 moderation 日均处理量、ModernDataTable 采纳率 58% 这种已有的）；不可测的 KPI 改为"上线后采集"，并在 brief 中标 TBD。

### R1.3 建议优化（非阻塞，但显著提升设计交付质量）

**SHOULD-1｜补 1–2 张关键页面截图。** 即便轻量版，"审核台现状 / ModernDataTable 标准列表 / moderation 反例"三张截图能让设计师在文字之外建立视觉锚点。可放 `docs/design/screenshots_20260426/`，brief 中以图床方式引用。

**SHOULD-2｜§3.3 Token 信息过稀。** 仅提"CSS 变量 + BrandProvider"不足以约束设计师的取值。建议补一份 token cheatsheet（color-* / spacing-* / type-* / radius-* / z-* 命名空间 + 已存在的 token 列表节选），或直接链到 `/admin/design-tokens` 导出。

**SHOULD-3｜§6 每项推荐增加"前置依赖"字段。** 推荐 1（审核台）的状态保留型流实际依赖推荐 4 提供的 useTableQuery hook；推荐 5（合并/拆分）依赖后端先吐 candidate API。设计稿落地时发现先决条件缺失会反复返工。

**SHOULD-4｜推荐 4 应显式标 "ADR 候选"。** §4.3 已明示 ModernDataTable Props 变更需 spawn Opus arch-reviewer 子代理；推荐 4 是该规则的直接命中项，但卡片内未标注。建议把 arch-reviewer 评审步骤前置到 §7.2 阶段 3 与 4 之间，作为该推荐的强制步骤而非可选项。

**SHOULD-5｜§7.2 用户研究阶段缺研究通道说明。** 内部 admin operators 的访谈/录屏招募方式、伦理边界、是否允许录音都未提。若实际无法触达活人，应改为"基于工单 + 操作日志 + 已有反馈的二手研究"，避免设计师按访谈式研究排期。

**SHOULD-6｜§4.1 "桌面优先 ≥1280px" 缺降级行为定义。** 应明确 <1280px 时是给"建议放大"提示、布局降级、还是直接禁用。否则设计师交付时会基于不同假设。

**SHOULD-7｜显式增加 "Non-Goals" 段。** 当前边界散落于 §4 多处。建议在 §1 前加 ≤8 条 "Non-Goals"（例如：不重设计前台 / 不改 DB schema / 不增 admin i18n / 不做移动适配 / 不引入新依赖 / 不修改 API 契约 / 不扩张 admin 权限模型 / 不重设计 design-tokens 浏览页），方便设计师在歧义时一眼自查。

**SHOULD-8｜§7.3 直接列出与本 brief 强相关的 ADR。** 至少 ADR-037（方案对齐表）、ADR-039（middleware 品牌识别）应在必读列表里直接命名，而不是模糊地"后续追加"。

### R1.4 可讨论项（开放议题，非要求修改）

**DISCUSS-1｜§5.2 H7"鉴权矩阵可视化文档"是否归 design 辅助？** 这更像工程内部文档，设计 ROI 不高。建议改归"非范围（工程文档）"。

**DISCUSS-2｜§2.3 双信号概念缺示意图。** 概念正确但表达抽象。即便用文字四象限表（探测 ✅/❌ × 播放 ✅/❌）补一个矩阵示例，也比纯文字要好。

**DISCUSS-3｜§0 audience 列出 7 项 skills，未说明各自在本 brief 中的职责切片。** 建议每个 skill 后加一句话职责说明（例：design-system → §3 + 推荐 4；ux-copy → §6 全 5 项的文案表；user-research → §7.2 阶段 2）。

**DISCUSS-4｜§7.2 协作流程缺"评审/批准主体表"。** 评审方写"工程主循环"较模糊：谁有权 reject 设计、争议升级到谁、最终批准签字角色是谁，未规定。可能在第一个推荐项落地时就遇到决策卡壳。

### R1.5 验收建议

- MUST-1～4 修完后即可发给 Claude Design 启动协作。
- SHOULD-1～8 列入 brief v2 backlog（与 Claude Design 第一次试点跑完后回流补齐，避免"完美主义阻塞推进"）。
- DISCUSS-1～4 留作首轮试点的反馈材料。
- 推荐试点路径：先以"推荐 1 审核台"单独跑完一整轮（user-research → wireframes → hi-fi → handoff → 工程实施），用真实交付验证 brief 与 §7.2 协作流程的可用性，再批量启动剩余 4 项；理由是审核台同时覆盖 P0×2 + P1×1，杠杆最高，且暴露的协作流问题最具代表性。

— END R1 —
