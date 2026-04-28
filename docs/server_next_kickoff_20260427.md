# server-next 立项讨论记录

> status: discussion
> owner: @engineering
> scope: apps/server-next（暂名）后台前端独立重写项目立项
> companion: [admin_audit_20260426.md](./admin_audit_20260426.md) / [admin_design_brief_20260426.md](./admin_audit_20260426.md) / `docs/designs/backend_design_v2.1/`
> 形式: 在文件尾部追加，每一轮讨论独立成节（R1 / R2 / ...）

本文不替代任何 ADR；当某项议题达成结论需固化时，再单独立 ADR 并在本文回引。

---

## R1（2026-04-27 主循环 claude-opus-4-7） — 审核 + 议题开题

### R1.1 三份资料对照审核

#### 1) `docs/admin_audit_20260426.md`（现状）
- 9 痛点 + 8 隐性问题、P0×3 / P1×6 优先级；信息密度高，引用全部到 file:line。
- 关键事实抓取（与 server-next 立项强相关）：
  - 后台主体：`apps/server`（Next.js App Router，3001，路径 `/admin/*`，无 i18n）。
  - 后端 API：`apps/api`（Fastify，4000，`/v1/admin/*`，**122 端点 / 16 路由文件**）— 后台只是前端壳，重写不重做后端。
  - 旧 `apps/web/` 已无源码，仅 `.next/` 残留，可清理（H-1）。
  - 共享组件已建立：`apps/server/src/components/admin/shared/`（modern-table、dropdown、batch、PaginationV2 等），ModernDataTable 采纳率 58%。

#### 2) `docs/admin_design_brief_20260426.md`（设计 brief，R2 已修补）
- §0.5 已明确"5 项推荐属可用性治理而非新业务"，规避 freeze_notice BLOCKER。
- §0.6 Non-Goals 8 条 — 注意第 5 条"不引入新依赖"与第 6 条"不修改 API 契约"对 server-next 同样适用。
- 推荐 4（共享表格 v2 + useTableQuery）已显式标 ADR 候选 — 此项是 server-next 的"地基"，必须先于业务迁移。
- 现 brief 是给 Claude Design 的输入，**不是工程实施 brief**；server-next 立项需要再写一份"工程实施版 brief"，把 v2.1 设计稿与 5 项推荐 + 9 痛点对齐到具体工程任务卡。

#### 3) `docs/designs/backend_design_v2.1/`（设计稿）
- 形态：单页 HTML + babel-standalone 在浏览器编译 JSX，**纯 mock，不是真实 Next.js 项目**。
- 已落实的设计成果（来自 `info.md`）：
  - IA 重组（"运营中心 / 管理台站" / "采集中心 / 待发布" 等命名）
  - 通用 DataTable（表头集成菜单 + 批量浮条 + 三档分页：客户端 / 服务端 / 游标 + 虚拟滚动）
  - 双信号 Token（`--probe` cyan / `--render` violet）— 与 admin brief §2.3 一致
  - 视频编辑 Drawer（4 Tab + 全屏模式 + 全局入口）
  - 审核台三栏 + Tab + 决策卡 + 证据抽屉
  - 采集站点展开内嵌"线路 / 别名"分组 + 全局别名表
  - 通知与后台任务双面板 + Toast 系统
  - 工作台浏览/编辑/全屏三态 + 卡片库
- 设计稿覆盖度抽样：dashboard / moderation / staging / videos / sources / merge / subtitles / home / submissions / crawler / image-health / analytics / users / settings / audit / login = 16 视图，**覆盖 audit §1.3 列出的 22 个 admin 模块的 ~70%**；缺口主要在 `/admin/system/*`（cache / monitor / config / migration / sites）和 `/admin/design-tokens` / `/admin/sandbox`。
- 设计稿 token 文件 `styles/tokens.css` 自带一套，**与 `packages/design-tokens` 关系未明** — 这是 server-next 工程化的第一个必决项。

### R1.2 与既有架构基线的对照

| 基线条款 | 来源 | 对 server-next 的约束 |
|---|---|---|
| 重写期需求冻结（M0–M6） | `freeze_notice_20260418.md` | server-next 立项需明确归属：是否纳入 M7 post-M6 扩展面 |
| 重写期代码共存 | ADR-031 | server / server-next 必须分支共存策略一致 |
| 渐进路由切分 | ADR-035 | 直接套用：apps/server 加 middleware ALLOWLIST → rewrite 到 server-next |
| BrandProvider / data-theme 单事实源 | ADR-038 | server-next 直接生于该协议，不再走 zustand classList |
| middleware 品牌/主题识别 | ADR-039 | 同上 |
| 禁止 apps 间直接共享代码 | ADR-031 / ADR-035 | admin 共享组件须下沉 packages/*，否则 server / server-next 双向引用违规 |
| 模型路由：共享组件 API 契约必须 spawn Opus 子代理 | CLAUDE.md | ModernDataTable v2 / useTableQuery hook 都必须先过 Opus |
| 桌面优先（≥1280px） | brief §4.1 | 不做移动适配 |
| 不修改 API 契约 / 不改 DB schema | brief §0.6 | server-next 的所有改造不动 apps/api |

### R1.3 总体判断

**强烈建议复用 web → web-next 的成熟经验，但要把"四个第一性问题"先决了**，否则会在中途卡住：

1. **冻结期归属问题** — server-next 是不是 M7 工作？M6 还有 ~3 个月，能不能并行？
2. **设计稿 token 与 packages/design-tokens 的关系** — 不能各立一套。
3. **共享组件下沉的边界** — 哪些走 `packages/admin-ui`，哪些留 app 内？
4. **server-next 与 admin_design_brief 5 项推荐的关系** — 是"先壳后骨"（先建 server-next 骨架再逐项落 5 推荐）还是"先骨后壳"（先做 5 推荐改造现有 server，再批量迁过去）？两种策略的 ROI 差很大。

---

### R1.4 关键议题（待用户裁定，按重要度排序）

#### Q1 启动时机：M7 post-M6 还是 M6 内并行？
- **方案 A（保守）**：等 M6 完成（估算 2026-07-31）后立项 server-next 为 M7 主轨。
  - ✅ 不抢 M6 三份方案带宽，不触 BLOCKER 风险
  - ❌ 设计稿 v2.1 已成型再放 3 个月易腐烂；admin P0 痛点（1/3/6）继续生产
- **方案 B（激进并行）**：现在立项，作为 frontend_redesign post-M6 扩展面（ADR-037 v2 三维闭环框架内）。
  - ✅ 与 brief §0.5 立场一致；设计稿热度可衔接
  - ❌ 主循环带宽分摊；需要明确"server-next 工作 vs M5/M6 主轨"互斥规则
- **方案 C（折中）**：M6 内仅做"地基项"（ModernDataTable v2 + useTableQuery + packages/admin-ui 下沉 + server-next 工程骨架），不迁页面；M6 完成后批量迁。
  - 这一档我个人最推荐 — 地基项目都是 brief §6 已圈出的"必经之路"，不是新增需求。

**待你拍板**。

#### Q2 命名：apps/server-next vs apps/admin-next
- 现 `apps/server` 命名混淆（既不是 API server，也不是文件 server，实质就是 admin 控制台）。
- 借迁移机会改名为 `apps/admin-next` 更准确，但破坏 ADR-035 命名传承（"-next" 与 "web-next" 配对）。
- **建议**：保持 `apps/server-next`，在 README 顶部一行说明"实为 admin console"；改名留待 server 退场时一并改。

#### Q3 切流策略
- ADR-035 模式：apps/server 增加 middleware，按 ALLOWLIST 把命中路径 rewrite 到 apps/server-next（内网 upstream）。
- 端口规划：apps/server 留 3001 不变；apps/server-next 取 3003（3000=web-next，3002=保留，3003 新）。
- 优势：URL 不变（`/admin/*`），灰度可分页面切；任何一页有问题秒级回滚（改一行 ALLOWLIST）。
- **风险点**：admin 当前用 `httpOnly` cookie + `/admin/login` 鉴权，rewrite 时 cookie 域必须一致；middleware 不得做 3xx；登录会话不能在两个壳之间丢失。需要 ADR 规定 cookie / Session / CSRF 在 rewrite 边界的协议。

#### Q4 Token 体系收敛
- 设计稿 `tokens.css`（138 行）：surface 4 档 + 双信号 probe/render + spacing/type/radius/layout，**与 `packages/design-tokens` 命名空间不一致**（前者用 `--bg0..bg4`，后者用 design_system_plan §3 定义的分层）。
- **决策两选**：
  - (a) server-next token 全部回归 `packages/design-tokens`，把设计稿 token 当作输入"映射表"导入，**不**新增 admin 专属 token（与 brief §0.5 强约束一致）
  - (b) 在 `packages/design-tokens/admin/` 子层加 admin 专属覆盖，base 不动
- **建议 (a)**：能复用就复用；admin 必需的 `--probe` / `--render` 可下沉到 base 的 `tokens.semantic.dual-signal.*`，因为前台未来也可能用（详情页线路面板就用得到）。
- 这一项需 spawn Opus arch-reviewer 子代理评审（命中 CLAUDE.md "Token 层新增字段"硬条款）。

#### Q5 共享组件下沉边界
- 现 `apps/server/src/components/admin/shared/` 含：modern-table、dropdown、batch、PaginationV2、dialog、form、toast、toolbar、button、modal、feedback、layout（约 12 类）。
- 若直接复制到 server-next，违反 ADR-031 / ADR-035 "禁止 apps 间直接共享代码"。
- **必须下沉**为新 package，候选名：
  - `packages/admin-ui` — 含 modern-table v2 + useTableQuery + 全部 shared 原语
  - `packages/admin-tokens`（如 Q4 选 b 才需要）
- 下沉时必须对 ModernDataTable Props 做契约固化（v2），spawn Opus arch-reviewer 评审；这正是 brief 推荐 4 的工作。
- **副作用**：apps/server 现有 7 个采纳模块都要切到 packages 引用，这是一次"老 server 内的预迁移"。Q1-C 方案能吃掉这部分工作。

#### Q6 设计稿 v2.1 → 工程项目骨架的转换
- 当前 `docs/designs/backend_design_v2.1/` 是 babel-standalone 单页 mock，不能直接当 Next.js 项目用。
- 转换工作量评估（粗）：
  - shell.jsx (300) + screens-1/2/3.jsx (~1956) + datatable.jsx (295) + video-edit-drawer.jsx (464) + notifications.jsx (275) ≈ 3300 行 mock JSX
  - 每行 mock JSX → ~1.5 行真实 React + props 类型 + 联调 API → ~5000 行真实代码 / 16 视图 ≈ 单视图 ~300 行
  - **不是简单"复制粘贴"**，需要：
    1. 拆 Server / Client Component
    2. 接 `apiClient` 与 `/v1/admin/*` 实际响应
    3. 用 `next-intl` 还是不用（admin 当前无 i18n，brief §0.6 第 3 条禁止）
    4. Server Action 用还是不用（与 fastify API 共存策略）
- **建议产出"骨架优先"路线**：先建 apps/server-next 工程骨架 + 路由 + 共享组件下沉 + 1 个标杆页（视频库，info.md 已点名作为"标杆页"）；标杆页 hi-fi 落地后再批量复刻其余 15 视图。

#### Q7 IA 重命名（"运营中心 / 管理台站"）
- 设计稿 IA 重排，例如：
  - "管理台站" = dashboard
  - "运营中心" = 顶层一级目录
  - "采集中心 / 待发布" 把 staging 从视频域挪走
- **侵入性大** — 涉及导航、面包屑、URL slug、用户心智迁移。
- 这是一次"非可视层"的产品决策，**应单独立 ADR**（候选 ADR-046：admin IA v2）；ADR 不通过则 server-next 沿用旧 IA 命名。

#### Q8 server-next 与 brief 5 项推荐的衔接顺序
| 序 | 启动条件 | 责任 |
|---|---|---|
| 推荐 4（表格 v2 + useTableQuery） | server-next 立项前必须完成 | 工程地基 |
| 推荐 1（审核台重构） | 推荐 4 之后；server-next 第 1 个标杆页 | Design 主导 + 工程实施 |
| 推荐 2（线路管理）/ 3（首页运营位）/ 5（合并拆分） | 推荐 1 完成验收后批量启动 | Design 主导 |
- 推荐 4 落地后，apps/server **现有 7 模块**先切到 packages/admin-ui v2，apps/server-next 继承同一 v2 — 这样老 server 也吃到地基红利，过渡期不出现"两套表格行为不一致"。

#### Q9 apps/server 退场计划
- ADR-035 模式：每迁完一类页面就把 ALLOWLIST 项打开，server-next 接管；apps/server 内对应路由保留为 fallback 直到所有页面 ✅。
- 全量切换后 apps/server 仅留 `/admin/login`（如有）+ 配置文件，最后整体删除。
- **预估周期**：16 视图 × 平均 3 天/视图（含 design + impl + e2e + 灰度）≈ 50 工作日，**3 个月**。

#### Q10 测试与质量门禁
- 现 admin 几乎无 e2e（搜索 `apps/server` 在 playwright spec 命中很少）。
- server-next 立项时必须配 e2e 框架，否则灰度切流没有自动化兜底；**建议**：每迁一视图必须带至少 1 条 e2e 黄金路径（CRUD 主流程）。
- typecheck / lint 沿用现有 npm scripts，server-next 加入 turbo pipeline。

---

### R1.5 我建议的下一步

待你回复 Q1–Q10 的倾向后：
1. 我把结论写成 **`docs/server_next_plan_20260427.md`**（工程实施版 brief — 不同于 admin_design_brief 的 design 视角）
2. 同时草拟两份 ADR：**ADR-046 admin IA v2**（仅当 Q7 决定走重命名）+ **ADR-047 server-next 路由切流协议**（沿用 ADR-035 模式增补 cookie/会话边界条款）
3. 把 brief 推荐 4（地基项）拆为 task-queue 卡片（CHG-G1: ModernDataTable v2 / CHG-G2: packages/admin-ui 下沉 / CHG-G3: useTableQuery hook），不论 Q1 选 A/B/C 都先启动这条线
4. 对设计稿 v2.1 缺口（system/* / design-tokens / sandbox 6 视图）补 design backlog 给 Claude Design

— END R1 —

---

## R2（2026-04-27 主循环 claude-opus-4-7） — 决策回执 + Q3/Q4 补全 + 工作流规约

### R2.1 用户决策回执表

| 议题 | 用户裁定 | 结论 |
|---|---|---|
| Q1 启动时机 | 方案制定好即启动；M0–M6 已完成；启动前清理工作台（归档 freeze_notice / 更新 ADR / 删 apps/web/ / 归档 task-queue 历史） | 不再受冻结期约束 |
| Q2 命名 | 异于 `server` 即可，最终取代 | 暂用 `apps/server-next`，全量替换后改名（ADR 中预告） |
| Q3 切流策略 | "希望不为旧后端做妥协，影响新后端开发质量"；worktree 备份在 | 推翻 R1 倾向（middleware rewrite），改走 **方案 E：独立壳 + 一次性切换**，详见 R2.2 |
| Q4 Token | 前后台 UI/UX 差异大，能统一最好，不行可独立 | 走 **三层架构（base / semantic / admin-layout）**，不独立，详见 R2.3 |
| Q5 共享组件下沉 | 不复用旧实现 | 不沿用 `apps/server/src/components/admin/shared/`，server-next 内部新建组件库；后续仅成熟原语下沉 packages |
| Q6 骨架优先 | 先地基骨架后填充，最大限度复用减少一次性设计 | 与 Q5 衔接：先建组件库 + DataTable v2 + useTableQuery + 路由骨架，再批量做视图 |
| Q7 IA 重命名 | 现阶段非最终版 | 不立 ADR-046，IA 用 v2.1 设计稿命名作为草案，留 server-next 上线前再决 |
| Q8/Q9/Q10 | 同意 | 推荐 4 优先；apps/server 退场为整体删除；e2e 每视图一条黄金路径 |
| 补 1 自动化 review | 每任务完成 → 独立 agent review → 修复直至全 PASS | 写入 R2.4 工作流规约 |
| 补 2 关键决策停机 | 计划外关键决策点必须停 | 写入 R2.4 BLOCKER 清单 |
| 补 3 Milestone 阶段审核 | 阶段性独立 agent 审计 + 人工 checklist | 写入 R2.4 milestone 审计协议 + R2.5 里程碑划分 |

### R2.2 Q3 切流策略补全 — 方案 E（推荐）

R1 给的 A 方案（middleware rewrite）是 ADR-035 沿用，**适合面向公网用户的高流量灰度**。但：
- admin 用户极少（内部运营 + 审核员，估个位数到十位数）
- 切流粒度天然按"运营人感知"，不需要按 traffic% 灰度
- ADR-035 模式会在 cookie 域 / Session / CSRF / 静态资源路径上引入额外协议负担，正好踩你说的"为旧后端做妥协"

#### 补全方案表

| 方案 | 模式 | 优点 | 缺点 | 适合 admin? |
|---|---|---|---|:-:|
| A | apps/server middleware rewrite ALLOWLIST → server-next（ADR-035 同款） | 灰度细 / 秒级回滚 / URL 不变 | 引入 cookie/Session 跨壳协议；apps/server 必须改一行/迁一页 | ❌ 过度工程 |
| B | 一次性原地替换（删 apps/server，apps/server-next 接 `/admin/*`） | 最干净 | 必须 100% 功能对齐才能切；中途无 fallback | ⚠️ 风险大 |
| C | 子路径并行（旧 `/admin/*`、新 `/admin-v2/*`），最后改 nginx 把 `/admin/*` 指向 new | 解耦彻底；URL 切换在反代层一行 | URL 双轨期对运营心智有影响；最终切换前要批量改书签 | ⚠️ |
| D | 子域并行（旧 `admin.x` / 新 `admin-next.x`） | 完全独立 | 需要域名运维；rendering host 增多 | ❌ |
| **E** | **独立壳 + 端口隔离，开发期共存，验收后一次性切换** | **不改 apps/server 一行；不引入 middleware；server-next 在 3003 独立跑；运营按需试用；M-SN-7 验收通过后由反代/Next config 一行切换 + 删 apps/server** | 切换日需要短停机或并行验证 | ✅ **推荐** |

#### E 方案的具体执行

```
开发期（M-SN-1 ~ M-SN-6）：
  apps/server     :3001  /admin/*     ← 生产，不动
  apps/server-next :3003  /admin/*    ← 开发中，独立壳

切换日（M-SN-7 cutover）：
  反代/网关层把 /admin/* 流量从 :3001 切到 :3003
  apps/server 整体删除（worktree 已备份回滚）
  apps/server-next 改名 apps/admin（or 保留 server-next 名字另议）
```

- **会话与鉴权**：server-next 使用与 apps/api 一致的 cookie 名（已在 fastify-jwt 配置），登录 / 登出共享 apps/api 鉴权端点；这一项与 apps/server 无差，不需要"跨壳协议"
- **静态资源**：server-next 自带 `_next/*`，与 apps/server 无冲突
- **回滚**：worktree 留存 + git tag `pre-server-next-cutover` 双保险；切换日预留 2h 验证窗口

#### Decision E 的硬约束（写入 ADR-047 草案）
1. 开发期 apps/server **冻结**，仅接受 P0 hotfix（与 freeze_notice 退役无关）
2. cutover 前必须通过 M-SN-7 验收清单（功能对齐 + e2e 全绿 + 阶段审计 PASS）
3. cutover 后 24h 监控期内 apps/server 代码保留在 git history（不立刻物理删除目录），24h 平稳后才删
4. server-next 默认无任何 apps/server 代码引用（编译期检查：CI 脚本扫描 `from "../server"` 等模式即 fail）

### R2.3 Q4 Token 专业建议 — 三层架构（不独立但允许 admin 叠加）

#### 论据
- **必须共享**：
  - 颜色语义 — success/danger/warn/info 不应有"前台一种绿、后台另一种绿"
  - 字号尺度 — 同一产品的排版基准应统一（fs-12/13/14/...）
  - 圆角、阴影、过渡时长 — 全产品体感一致性的来源
- **可以独立的**：
  - 布局尺度 — admin 有 sidebar-w / topbar-h / row-h，前台没这些概念
  - 双信号 probe/render — admin 主战场，但前台播放器线路面板未来可复用，**应升入 semantic 层而非 admin 独占**
- **绝对不能独立的**：
  - 主品牌色 / 强调色 — 必须只有一处定义
  - 状态色 dot/badge 配色 — 必须只有一处定义

#### 推荐三层架构

```
packages/design-tokens/
├── base/                              ← 前后台共用，不可 fork
│   ├── colors.css                     主色 / 灰阶 / 状态语义
│   ├── typography.css                 fs-* / line-height / font-family
│   ├── spacing.css                    s-1..s-8
│   ├── radius.css                     r-1..r-full
│   └── shadow.css
├── semantic/                          ← 前后台共用，按场景命名
│   ├── status.css                     ok/warn/danger/info（base.colors 别名）
│   ├── dual-signal.css                probe / render（admin 主用，前台预留）
│   └── surface.css                    bg0..bg4（前台 hero / 卡片 / 弹层 / admin shell）
└── admin-layout/                      ← admin 专属，不入 base
    ├── shell.css                      sidebar-w / topbar-h / sidebar-collapsed-w
    ├── table.css                      row-h / row-h-compact / col-min-w
    └── density.css                    admin 独有的紧凑模式刻度
```

#### 设计稿 v2.1 token 收编路径
- `--bg0..bg4` → `packages/design-tokens/semantic/surface.css`（升入 semantic，前台也用得到）
- `--probe / --render` → `packages/design-tokens/semantic/dual-signal.css`
- `--accent / --accent-hover / --accent-soft / --accent-border` → `packages/design-tokens/base/colors.css`（与 web-next 既有品牌色合并，去重）
- `--ok/--warn/--danger/--info` → `packages/design-tokens/semantic/status.css`（同上去重）
- `--sidebar-w / --topbar-h / --row-h` → `packages/design-tokens/admin-layout/shell.css` 与 `table.css`
- 字号 `--fs-11..fs-32` / 间距 `--s-1..s-8` / 圆角 `--r-1..r-full` → `packages/design-tokens/base/*.css`（与 web-next 现值对账，命名收敛）

#### 评审要求
- token 层任何**新增字段**（包括 dual-signal 升入 semantic）必须 spawn `arch-reviewer` (Opus) 评审 — 命中 CLAUDE.md 模型路由"Token 层新增字段"硬条款
- 评审产出 ADR-048（候选）：admin token 三层收编协议

### R2.4 工作流规约（基于你三条补充）

#### 规约 A：每任务自动化 review 闭环
- 每个 CHG 卡 / Task 卡完成时（代码改动 + 测试 + lint + typecheck 全绿）必须 **spawn `arch-reviewer` (Opus) 子代理**做独立 review
- review 输出三档：**PASS / CONDITIONAL / REJECT**
- 处理：
  - PASS → 任务完成，进 changelog + commit
  - CONDITIONAL → 修复指定项后**再次 spawn arch-reviewer**（同一会话内连续修复 ≤3 轮，>3 轮则升 BLOCKER 等人工）
  - REJECT → 不合并，回到设计阶段
- 输入到 review 的素材包：任务卡 + diff + 触及的现有契约 + 关联 ADR
- 写入 task-queue.md 卡片字段："review 状态：PENDING / PASS / CONDITIONAL（修复中 N/3）/ REJECT"

#### 规约 B：BLOCKER 触发清单（凡命中即停等人工）
执行中**任意一条**命中，立即写 BLOCKER 暂停会话：
1. 任务文件范围之外的改动需求
2. 需要新增 npm 依赖 / 升级主版本
3. 需要修改 API 契约（端点 path / 入参 schema / 返回结构）
4. 需要修改 DB schema（含 migration）
5. 需要新增 / 修改 token 层字段（包括 base / semantic / admin-layout）
6. 需要修改共享组件公开 API（Props / 事件 / 生命周期）
7. 同一 review 修复 >3 轮仍未 PASS
8. 计划文档（server_next_plan）未覆盖的设计决策（IA / URL 命名 / 鉴权模型 / 多语言策略 / 缓存策略 / 错误降级）
9. apps/server 与 apps/server-next 出现交叉依赖（违反 R2.2 硬约束 4）
10. cutover 检查清单出现红项（M-SN-7）

#### 规约 C：Milestone 阶段审计协议
- 每个 Milestone（M-SN-1 ~ M-SN-7）完成时，**主循环 spawn `arch-reviewer` (Opus)** 做阶段审计
- 审计输入：milestone 范围内所有 commit + 该 milestone 的"完成标准"清单 + 关联 ADR
- 审计输出：
  1. **偏差报告**：偏离计划的决策点（含理由分类：合理调整 / 需追溯 ADR / 必须回滚）
  2. **质量评级**：A / B / C，C 必须返工
  3. **人工审核 checklist**：自动审计无法判定但需人决策的开放项（含截图建议、关键页面交互验收路径）
- 审计 PASS 才能进入下一 milestone
- M-SN-7 cutover 前的 final 审计必须人工签字（main 分支 PR 描述中显式 sign-off）

### R2.5 server-next 里程碑划分（M-SN-1 ~ M-SN-7）

| Milestone | 内容 | 完成标准 | 阶段审计重点 |
|---|---|---|---|
| **M-SN-0** | 立项前清理工作台 | 见 R2.6 | docs / git 历史干净 |
| **M-SN-1** | 工程骨架 + token 三层 + Theme/Brand Provider | apps/server-next 可启动空壳 / packages/design-tokens 三层就位 / 路由骨架 + login | token 层 ADR-048 PASS |
| **M-SN-2** | 共享组件库 v1（DataTable v2 + useTableQuery + Toolbar/Filter/Drawer/Modal/Toast） | 在 server-next 内 standalone Storybook-style demo 跑通 | 共享组件 API 契约 ADR PASS（推荐 4） |
| **M-SN-3** | 标杆页：视频库 | CRUD 完整 + 服务端排序/分页/筛选 + 列设置 + 批量 + e2e 黄金路径 | 标杆页可作为后续视图模板 |
| **M-SN-4** | P0 痛点视图：审核台 + 暂存 + 视频编辑 Drawer | 推荐 1 落地（含双信号、状态保留筛选）；推荐 2 线路面板嵌入 Drawer | P0 痛点修复验收（痛点 1/3/6） |
| **M-SN-5** | P1 视图：sources 中心 + 首页运营位 + 用户投稿 + 字幕 + 用户管理 + 合并拆分 | 推荐 2 / 3 / 5 落地 | P1 痛点修复 |
| **M-SN-6** | 周边视图：采集控制 + 图片健康 + 数据看板 + 系统设置 + 审计日志 | 16 视图全覆盖 + 设计稿缺口（system/* / design-tokens / sandbox）补齐 | 视图覆盖率 100% |
| **M-SN-7** | Cutover：functional parity 验收 + e2e 全绿 + 反代切流 + apps/server 删除 | 24h 平稳期通过 | **人工 final sign-off** |

### R2.6 立项前清理工作台（M-SN-0 任务清单）

依据 Q1 用户指示，server-next 立项前先完成：

| # | 任务 | 操作 | 责任 |
|---|---|---|---|
| 1 | 归档 `docs/freeze_notice_20260418.md` | 移到 `docs/archive/freeze_notice_20260418.md`，原位放 stub 标"已归档"+ 跳转链接 | doc-janitor |
| 2 | 归档前端重写期文件 | `frontend_redesign_plan_20260418.md` / `frontend_phase2_plan_20260424.md` / `frontend_design_spec_20260423.md` / `image_pipeline_plan_20260418.md` / `design_system_plan_20260418.md` 移到 `docs/archive/m0-m6/` | doc-janitor |
| 3 | 更新 ADR-031 / ADR-035 状态为"已结案"（M0–M6 完成） | 在 ADR 主体加 closing note + 结束日期 | 主循环 |
| 4 | 删除 apps/web/ | 物理删除 + 从根 package.json workspaces 排除（明确 `apps/server`、`apps/server-next`、`apps/api`、`apps/web-next` 替代 `apps/*`） | 主循环 |
| 5 | 归档 task-queue.md 历史 | 移已完成任务到 `docs/archive/task-queue/task-queue_archive_20260427.md`；保留进行中 + 待启动；明确"新任务序列号不与历史重复"约束（在 task-queue.md 顶部加约束声明） | doc-janitor |
| 6 | 归档 changelog 历史（可选） | 若 changelog 过长，按里程碑切到 `docs/archive/changelog/changelog_m0-m6.md` | doc-janitor |
| 7 | 更新 architecture.md | 修正 §1 "web → apps/web/src/app" 漂移（audit H-2）；预告 server-next | 主循环 |
| 8 | 更新 CLAUDE.md | 加入"server-next 工作流规约"块（R2.4 三规约）；加入 R2.5 里程碑表索引 | 主循环 |
| 9 | 立 ADR-046（暂列）：server-next 项目立项 + R2 决策固化 | 含 Q1–Q10 + 三补充结论 + R2.2 切流 E 方案 + R2.3 token 三层 | 主循环 + Opus arch-reviewer |
| 10 | 立 ADR-047：server-next 切流与 cutover 协议 | E 方案硬约束 4 条 + cutover 检查清单 | 主循环 + Opus arch-reviewer |
| 11 | 立 ADR-048：admin token 三层收编协议 | R2.3 详细映射表 + 评审通过后落地 | 主循环 + Opus arch-reviewer |

清理完毕后启动 M-SN-1。

### R2.7 下一步动作

待你确认 R2 后，我按以下顺序推进（每步完成后追加到本文件作 R3 / R4 / ...）：

1. **R3（下一轮）**：撰写 `docs/server_next_plan_20260427.md`（工程实施版 brief，工作流规约 + milestone 完成标准 + 视图清单 + 复用矩阵）
2. **R4**：M-SN-0 清理工作台（11 项分批执行，每批 spawn arch-reviewer 复核）
3. **R5**：草拟 ADR-046 / ADR-047 / ADR-048 三份初稿
4. **R6**：M-SN-1 启动（工程骨架 + token 层）

#### 仍待你拍板的 3 件小事

- **S1**：cutover 切流由 nginx 反代层做、还是在 apps/api 网关里加 path 路由、还是直接改部署？（影响 ADR-047 实现细节）— 如不确定，我默认走 **nginx 反代**这条最低耦合路径
- **S2**：server-next 是否需要 i18n？brief §0.6 第 3 条说不需要；但你提"前后台 UI/UX 差别大"暗示 admin 单语言中文已是定论。若确认中文单语言，写入 ADR-046 — **默认走单语言**
- **S3**：M-SN-0 工作台清理的 11 项是要一次性执行（一个会话清完）还是按 docs / code / ADR 三批拆？— **建议三批**：①docs 归档（doc-janitor 包办）②apps/web/ 删除 + workspace 清理（主循环 + arch-reviewer）③ADR 三份起草（主循环 + Opus 评审）

— END R2 —

---

## R3（2026-04-27 主循环 claude-opus-4-7） — S1/S2/S3 决策回执 + IA 修正

### R3.1 S1/S2/S3 决策回执

| 项 | 用户裁定 | 落地 |
|---|---|---|
| S1 cutover 切流位置 | nginx 反代 | 写入 ADR-047 §实施细节 |
| S2 server-next 多语言策略 | 单语言中文 | 写入 ADR-046；server-next 不安装 next-intl；CLAUDE.md "前端组件任务" i18n 条款标注"admin 例外" |
| S3 M-SN-0 清理执行节奏 | 分三批 | 写入 R3.4；docs / code / ADR 三批，每批结束 spawn arch-reviewer 复核 |

### R3.2 IA 修正 — 移除"待发布（staging）"

#### 用户裁定
- IA 目录中"待发布"页面与"内容审核"已审 tab 功能重复 → **移除"待发布"页面**
- 设计稿 v2.1 仍在补充中（"设置补全 → 采集展开 → 开发者模式 → 弹层规范"未完工），index.html 与 Wireframes.html 存在少数分歧；后续设计稿稳定后再做一次 IA 对照

#### 移除影响清单
| 项 | 原状 | 修正 |
|---|---|---|
| 路由 | `index.html ROUTES.staging` 独立路由 | 移除；不在 server-next 注册 |
| 后端 API | `apps/api/src/routes/admin/staging.ts` 10 端点 | **API 保留**（"发布 / meta 编辑 / 豆瓣丰富/确认"等动作仍需）；UI 入口收编到审核台 |
| 审核台 | v2.1 Tab：待审核 / 待发布 / 已拒绝 | **新 Tab 方案**：待审 / 已审（含发布动作）/ 已拒绝 — 详见 R3.3 |
| 数据语义 | staging = `is_published=false AND visibility_status='internal'` 的视频集 | 保留（DB 不动）；管理员视角通过审核台"已审 tab"对该集合做发布操作 |
| audit §1.3 | 列出 staging 为 22 顶层模块之一 | 修正：21 顶层模块 + 1 已合并到审核台 |
| M-SN-4 milestone 范围 | "审核台 + 暂存 + 视频编辑 Drawer" | **修正**："审核台（含已审/发布动作）+ 视频编辑 Drawer" |
| 推荐 1（审核台重构） | 仅覆盖 moderation 模块 | 扩展覆盖 staging 发布流；仍属"可用性治理"，不触新业务 |

#### R3.3 审核台 Tab 重构方案（替代 v2.1 设计稿"待发布"独立页面）

```
内容审核
├── Tab: 待审核（pending_review）
│     └─ 双信号 / 三栏 / 决策卡 / 证据抽屉（v2.1 已完成设计）
├── Tab: 已审（approved 但 is_published=false）         ← 替代原"待发布"
│     ├─ 列表项右侧：[发布] [批量发布] [取消通过]
│     ├─ 发布预检清单（v2.1 设计稿原"待发布"中间栏的"审核/线路/封面/豆瓣/信号逐项检查"迁入此 Tab）
│     └─ 发布设置（visibility_status='public' 默认；可选定时发布）
├── Tab: 已拒绝（rejected）
│     └─ 维持 v2.1 设计稿原方案
└── Tab: 已发布历史（is_published=true）  ← 可选，如需可后置到 M-SN-5
```

#### R3.4 BLOCKER 命中：连带决策点需要停机

R2.4 规约 B 第 8 条命中（计划外 IA 决策）。移除"待发布"后，**"采集后未审核"流（is_published=false AND review_status='pending_review' AND visibility_status='internal'）的入口归宿**没有自然落点：

- audit §3.1 时序中，staging 是 [Crawler → MediaCatalog → videos INSERT → verifyWorker → moderation → staging publish] 的倒数第二环；新流程下 verifyWorker 后管理员看哪个页面才能找到这批刚抓回来的视频？
- 候选三选：
  1. **方案 α**：审核台"待审"Tab 即覆盖（pending_review 状态本身就是"未审"集合，verifyWorker 完毕后视频自动落在该 Tab）— 最自然，但需确认采集 → moderation 间无"中间未决"状态
  2. **方案 β**：在"采集中心"下增 Tab "新入库"（is_published=false 的全集），与"内容审核"双入口
  3. **方案 γ**：审核台增第 4 个 Tab "新入库"（与"待审"并列）

**默认建议 α**：核对 audit §3.1 触发器流转，verifyWorker 不写 review_status；videos 插入时即 review_status='pending_review'，所以采集回来的视频天然就是"待审"集合。**α 方案下采集 → 审核 → 已审/发布 三段一线，最少分歧**。

待你裁定 α/β/γ 后再开 plan 文件，避免 plan 中残留 TBD。

### R3.5 下一步动作（待 R3.4 裁定后）

1. **R4（plan 撰写）**：`docs/server_next_plan_20260427.md`（工程实施版 brief，含工作流规约、milestone 完成标准、视图清单、复用矩阵、IA 草案 v0 含 R3 修正）
2. **R5（清理工作台第 1 批：docs 归档）**：spawn doc-janitor 子代理执行 R2.6 第 1/2/5/6 项（freeze_notice / 前端方案 / task-queue / changelog 归档）；执行后 spawn arch-reviewer 复核
3. **R6（清理工作台第 2 批：code 清理）**：删除 apps/web/，根 package.json workspaces 显式列举替代 `apps/*`
4. **R7（清理工作台第 3 批：ADR 起草）**：ADR-046（立项）、ADR-047（切流 + nginx）、ADR-048（token 三层），spawn Opus arch-reviewer 评审

— END R3 —

---

## R4（2026-04-27 主循环 claude-opus-4-7） — Plan v0 落盘

### R4.1 产出

新建 [docs/server_next_plan_20260427.md](./server_next_plan_20260427.md)（工程实施 plan v0），共 12 节：

- §1–3 目标 / 范围 / 决策汇总（R1–R3 浓缩）
- §4 工程架构（仓库结构 / 端口 / token 三层 / packages/admin-ui 下沉边界 / API 耦合 / 编译期检查）
- §5 工作流规约（自动化 review + BLOCKER 10 条 + milestone 审计 + 任务卡/commit 模板）
- §6 M-SN-0 ~ M-SN-7 范围 + 完成标准 + 阶段审计重点
- §7 IA v0（含 R3 修正：移除 staging，方案 α 落实）
- §8 复用矩阵（按 21 视图标 ≥80% 共享原语来源）
- §9 ADR 索引（046 / 047 / 048 + 候选 049）
- §10 风险与回滚
- §11 M-SN-0 三批清理任务化（D1–D5 / C1–C5 / A1–A5）

### R4.2 R3.4 α 方案在 plan 中的固化位置

- §3 决策汇总表"采集后未审"行
- §6 M-SN-4 阶段范围"4 Tab：待审 / 已审 / 已拒绝 / 已发布历史"
- §7 IA v0 注释"待审 Tab 即'采集后未审'集合"

### R4.3 等待事项

按 plan §0 性质声明，本 plan 进入 M-SN-0 前须完成：

1. **spawn arch-reviewer (Opus) 评审 plan v0** — 本文件本身是 server-next 的"宪法"，必须先过独立评审
2. plan 评审 PASS 后启动 M-SN-0 第一批（docs 归档，spawn doc-janitor）

### R4.4 下一步建议

待你确认 R4 后，按以下顺序推进：

1. **R5（plan 评审）**：spawn arch-reviewer (Opus) 独立评审 docs/server_next_plan_20260427.md；输入：plan + admin_audit + admin_design_brief + kickoff R1–R4 + 设计稿 info.md；输出：PASS / CONDITIONAL / REJECT
2. **R6（M-SN-0 第一批）**：spawn doc-janitor 执行 plan §11.1 D1–D5
3. **R7（M-SN-0 第二批）**：主循环执行 plan §11.2 C1–C5
4. **R8（M-SN-0 第三批）**：主循环起草 ADR-046/047/048，spawn arch-reviewer 评审
5. **M-SN-0 PASS** 后启动 M-SN-1

— END R4 —

---

## R5（2026-04-27 arch-reviewer claude-opus-4-7） — Plan v0 独立评审

### R5.1 Verdict: **CONDITIONAL**

修完 MUST-1～6 即可进 M-SN-0；SHOULD 项在 M-SN-0 第三批 ADR 起草并行补齐。

### R5.2 维度评分

| 维度 | 评分 | 关键发现 |
|---|:-:|---|
| D1 战略对齐 | 4 | G1–G5 与 audit / brief 基本闭合；G2 P1×6 承诺与 MUST-4 API 缺位冲突 |
| D2 工程架构 | 3 | 方向正确；MUST-3 / 5、SHOULD-3 暴露下沉时机 / 依赖白名单 / 边界检查粒度三处缺漏 |
| D3 IA / α 可行性 | 4 | α 方案逻辑成立；痛点 7 home_modules 落地路径模糊（MUST-4） |
| D4 工作流规约 | 3 | 三件套结构完备；MUST-6 评级判据缺 / SHOULD-7 git-rules 兼容未核 |
| **D5 Milestone 划分** | **2** | **MUST-1 M-SN-2 过载 / MUST-2 视图数矛盾 / SHOULD-1 工时缺 / SHOULD-2 性能 a11y 门缺** |
| D6 风险识别 | 3 | §10 覆盖四面；SHOULD-4 仍漏 4 项 |
| D7 内部一致性 | 3 | 互引基本到位；MUST-2 数字矛盾 / §8 vs §7 行数不匹配 |

D5 为最弱项（2 分），M-SN-2 范围与视图数公式必须修正。

### R5.3 MUST 修复清单（共 6 项）

| MUST | 标题 | 主循环可独立修？ | 依赖用户裁定 |
|:-:|---|:-:|---|
| 1 | M-SN-2 范围过载（拆 2a/2b 或延迟游标+虚拟滚动） | ⚠️ 需用户选向 | **A1 拆 M-SN-2 / A2 延迟到 M-SN-6** |
| 2 | §7 视图数公式自相矛盾（21 vs 22 vs 27 路由占位） | ✅ 可独立修 | — |
| 3 | packages/admin-ui 创建时机模糊（M-SN-1 即创建空骨架） | ✅ 可独立修 | — |
| 4 | "零 API 契约变更"与推荐 3 / 5 冲突 | ❌ 必须人工 | **B 决策：API 缺口由谁推进** |
| 5 | 依赖白名单缺（@dnd-kit / charts / DAG 库未预批） | ❌ 必须人工 | **C 批准依赖清单** |
| 6 | Milestone 审计 A/B/C 评级缺客观判据 | ✅ 可独立修 | — |

### R5.4 SHOULD 修复清单（共 7 项）

主循环可独立补：SHOULD-2 性能/a11y 验收门 / SHOULD-3 ESLint no-restricted-imports 替 grep / SHOULD-4 风险清单 4 补 / SHOULD-5 自建组件下沉判定时机 / SHOULD-6 IA 命名一致性声明 / SHOULD-7 git-rules 兼容性核对。

需用户提供：**SHOULD-1 工时估算**（每 milestone ETA + 总周期）— 主循环可给"参考估算"但需用户拍板"准入阈值"。

### R5.5 DISCUSS 开放议题（共 5 项，全部需人工）

| DISCUSS | 议题 | 决策点 |
|:-:|---|---|
| 1 | apps/server 开发期是否完全冻结？P0 hotfix 边界 | 是否同步 hotfix 到 server-next |
| 2 | 推荐 5 后端 API 由谁推进 | 单立 M-SN-API / 串行 / 并行 |
| 3 | cookie + nginx 反代切流 e2e 演练时机 | 建议 M-SN-3 完成时 |
| 4 | apps/server-next 改名 apps/admin 时点 | cutover commit 内 / 另开 milestone |
| 5 | apps/server 删除窗口 vs 7 天 git 回滚 RTO | 25h 后发现问题如何处理 |

### R5.6 主循环 + 用户分工建议

#### 主循环可独立修（6 项，预计 1 轮 plan v1 完成）
- MUST-2 / MUST-3 / MUST-6
- SHOULD-2 / 3 / 4 / 5 / 6 / 7
- 修订后再次 spawn arch-reviewer 二轮评审

#### 需用户裁定的关键决策（按优先级）

**Q-MUST-1（M-SN-2 拆分）**
- A1 **拆 M-SN-2a（DataTable v2 + useTableQuery + 客户端/服务端两档分页 + Toolbar/Filter/ColumnSettings + ADR-049）+ M-SN-2b（Drawer/Modal/Toast/AdminDropdown/SelectionActionBar/Empty/游标+虚拟滚动/Storybook demo）**
- A2 **保留单 M-SN-2，但游标+虚拟滚动延迟到 M-SN-6（首次 >50k 数据集时随用随建）**
- 主循环建议 **A2**：游标+虚拟滚动是 admin 极少触及的场景（audit §6 视频表 / 审核 / 用户表都远 <50k），按需即用更经济

**Q-MUST-4（API 契约缺口）**
admin_audit 已确认两类必须新增的 API：
- home_modules 路由（推荐 3）— 6+ 端点
- split / unmerge / candidate-preview（推荐 5）— 3+ 端点

三选：
- **B1 单立 M-SN-API milestone**（apps/api 中专门补，与 M-SN-1～M-SN-6 并行）
- **B2 推荐 3 / 5 降为 P2，从 M-SN-5 范围剔除，归入 server-next 后续迭代**（最保守，但留下 audit 痛点 7 / 1 不闭合）
- **B3 在 M-SN-5 内由 server-next 主循环顺手补 admin API**（违反 plan §2.2 第 4 条 Non-Goals "不修改 API 契约"，需放宽 Non-Goals 措辞为"不修改现有端点；新增端点用以解锁缺位 admin 视图允许，但需独立 ADR + Opus 评审"）
- 主循环建议 **B3**（与 evaluator MUST-4 修复建议一致）：
  - 推荐 3 / 5 的功能闭环需要新 API 是事实，不能回避
  - apps/api 与 apps/server-next 同一仓库 + 同一主循环，不必单立 M-SN-API（ROI 低）
  - 通过"放宽 Non-Goals + 强制 Opus 评审 + 独立 ADR"形成质量闸口

**Q-MUST-5（依赖白名单）**
请预批以下候选清单进 ADR-046 §依赖白名单：
- `@dnd-kit/core` `@dnd-kit/sortable` — 拖拽（apps/server 已用）
- `recharts` 或 `visx` — 图表（analytics）
- `reactflow`（v11）或 `dagre-d3` — 任务依赖 DAG（crawler）
- `react-window` 或 `@tanstack/react-virtual` — 虚拟滚动（按 Q-MUST-1 决议而定）
- 主循环建议：**预批前 2 个**（dnd 已在仓库），**3-4 在首次落地前由 spawn arch-reviewer 二选一**

**Q-SHOULD-1（工时估算）**
主循环参考估算（仅供讨论基线）：

| Milestone | 范围摘要 | 估算工时 |
|---|---|---|
| M-SN-0 | 三批清理 + 3 ADR | 1 周 |
| M-SN-1 | 骨架 + token 三层 + Provider | 1.5 周 |
| M-SN-2（A2 单元） | admin-ui v1 主体 | 2.5 周 |
| M-SN-3 | 标杆页视频库 | 1 周 |
| M-SN-4 | 审核台 + Drawer | 2.5 周 |
| M-SN-5 | P1 视图 6 个（含 API 补齐） | 4 周 |
| M-SN-6 | 周边视图 5 + 设计稿对齐 | 2.5 周 |
| M-SN-6.5 | 性能 / a11y 验收（SHOULD-2 引入） | 0.5 周 |
| M-SN-7 | Cutover + 24h 监控 | 0.5 周 |
| **合计** | — | **16 周（~4 个月）** |

**Q-DISCUSS-1～5 用户裁定**
- DISCUSS-1：开发期 apps/server 是否仅 P0 hotfix？hotfix 是否反向同步 server-next？
- DISCUSS-2：API 缺口由 Q-MUST-4 解决方案吸收（如选 B3 即并入 M-SN-5；如选 B1 即单立 M-SN-API）
- DISCUSS-3：cookie + nginx e2e 演练时机（建议 M-SN-3 完成时）
- DISCUSS-4：apps/server-next 改名时机（建议 cutover commit 内一并改）
- DISCUSS-5：cutover + 24h 后发现问题的处理（建议 apps/server 物理目录保留 7 天，与 git tag 一致；超 7 天回滚走完整 commit revert）

### R5.7 下一步动作

待你回复以下 4 组裁定后，主循环执行 R6（plan v1 修订）：

```
Q-MUST-1：A1 / A2（推荐 A2）
Q-MUST-4：B1 / B2 / B3（推荐 B3）
Q-MUST-5：依赖清单预批 — 同意 dnd 二件 + recharts/reactflow/react-window 标"首次落地前二选一"？
Q-SHOULD-1：工时估算表准入阈值 — 单 milestone 超 +30% 触发 BLOCKER 是否合理？
Q-DISCUSS-1～5：可一并回复倾向（或全部采纳主循环建议）
```

回复后流程：
1. **R6**：主循环修订 plan v1（吸收 MUST + SHOULD + 用户裁定）
2. **R7**：spawn arch-reviewer 二轮评审 plan v1
3. **R8**：v1 PASS 后启动 M-SN-0 第一批

— END R5 —

---

## R6（2026-04-27 主循环 claude-opus-4-7） — Plan v1 修订完成

### R6.1 修订摘要

`docs/server_next_plan_20260427.md` 由 v0 → v1，全部采纳 R5 评审建议。

#### MUST 修复（6 项）
- **MUST-1**（M-SN-2 拆分）：采用 **A2** — 保留单 milestone，游标+虚拟滚动延迟到 M-SN-6 首次 >50k 数据时按需即建
- **MUST-2**（视图数公式）：统一为 21 顶层 + 5 system 子 + 1 编辑子 = **27 路由占位**；§7 / §8 / M-SN-6 / M-SN-7 口径修正
- **MUST-3**（packages/admin-ui 创建时机）：M-SN-1 第一个任务卡即创建空骨架并加入 workspaces，无"先 server-next 再迁"过渡态
- **MUST-4**（API 契约缺口）：采用 **B3** — Non-Goals 第 4 条由"不修改 API 契约"放宽为"不修改现有端点；新增端点允许，须独立 ADR + Opus 评审"；ADR-050（home_modules）/ ADR-051（merge）在 M-SN-5 内补
- **MUST-5**（依赖白名单）：新增 §4.7；预批 dnd 二件；recharts/reactflow/react-virtual 三组候选标"M-SN-6 首次落地前 spawn arch-reviewer 二选一"
- **MUST-6**（A/B/C 评级判据）：§5.3 加客观条件表；任务级 / milestone 级两层独立

#### SHOULD 修复（7 项）
- **SHOULD-1**（工时估算）：§6 加 **16 周总周期**分布；§5.2 BLOCKER 新增第 11 条（单 milestone 超 +30%）+ 第 12 条（plan 修订）
- **SHOULD-2**（性能 / a11y 验收门）：新增 **M-SN-6.5**（0.5 周）含 a11y / 性能 / 跨浏览器 / 三档断点四类验收
- **SHOULD-3**（编译期边界）：grep → ESLint `no-restricted-imports` + ts-morph CI 兜底
- **SHOULD-4**（风险清单）：§10 增 4 项（10.5 plan 版本 / 10.6 api 漂移 / 10.7 设计稿应急 / 10.8 bus factor）
- **SHOULD-5**（自建组件下沉）：§4.4 加"首次跨 2 视图复用强制下沉"规则；§8 复用矩阵新增"下沉里程碑"列
- **SHOULD-6**（IA 命名）：§7 加 IA 命名声明（URL slug 优先英文，中文菜单 cutover 前可调）
- **SHOULD-7**（commit trailer）：§5.4 加 git-rules.md 兼容声明；M-SN-0 第三批 A5 增 git-rules 追认

#### DISCUSS 决议（5 项）
全部采纳主循环建议，已落入 §3 决策表：
- DISCUSS-1：apps/server 开发期仅 P0 hotfix，不反向同步，但记 task-queue
- DISCUSS-2：API 缺口由 B3 方案吸收（M-SN-5 内补，不单立 milestone）
- DISCUSS-3：cookie + nginx e2e 演练在 M-SN-3 末尾的 staging 环境进行
- DISCUSS-4：apps/server-next 改名 apps/admin 在 M-SN-7 cutover commit 内同步进行
- DISCUSS-5：cutover + 7 天物理目录保留与 git tag 一致；超 7 天回滚走 commit revert（RTO ≤ 4h）

### R6.2 plan v1 关键新增

- **§0 plan 版本协议**：plan 修订必须 spawn arch-reviewer + 修订日志 + commit trailer + 重大修订人工 sign-off
- **§4.7 依赖白名单**：预批清单 + 候选清单 + 严禁清单
- **§5.2 BLOCKER 12 条**（v0 是 10 条）
- **§5.3 A/B/C 评级判据表**
- **§6 工时估算 + 16 周总周期**
- **§6 M-SN-6.5 非功能验收门**
- **§9 ADR 049/050/051 + 候选 ADR 大数据原语依赖选型**
- **§10.5–10.8 四类新风险**
- **修订日志**：v0 → v1 完整变更记录

### R6.3 下一步：R7 二轮评审

按 plan §0 版本协议，v1 进入 M-SN-0 前需 spawn arch-reviewer (Opus) 二轮评审。

二轮评审重点：
1. v0 → v1 的 13 处修订是否真正解决了 R5 评审项
2. v1 内部一致性（特别是 §3 / §4 / §5 / §6 / §7 / §8 / §10 互引）
3. 是否引入新的内部矛盾
4. 工时估算 16 周是否合理
5. M-SN-5 范围（4 周含 API 补齐）是否过载

预期产出：PASS / CONDITIONAL（≤2 项小修）/ REJECT（v1 仍有结构性问题）

如二轮 PASS 即启动 R8（M-SN-0 第一批 docs 归档）。

— END R6 —

---

## R7（2026-04-28 arch-reviewer claude-opus-4-7） — Plan v1 二轮评审

### R7.1 Verdict: **CONDITIONAL**（接近 PASS）

R5 修订闭环验证：13 项中 11 项 ✅ 完整闭环；2 项 ⚠️ 部分（MUST-4 措辞精确但工时承压 / SHOULD-1 工时表完备但单点偏紧）。

无 REGRESSION（v0 已 PASS 部分未退化）。

### R7.2 二轮新增维度评分

| 维度 | 评分 | 关键发现 |
|---|:-:|---|
| N1 修订内部矛盾 | 3 | A2 让 M-SN-2 -0.5w，但 M-SN-6 没相应 +0.5w 反而隐性吸收 4 类新负担 |
| **N2 工时估算合理性** | **3** | M-SN-5（4w）边缘 / **M-SN-6（2.5w）显著欠估** / M-SN-6.5（0.5w）偏紧 |
| N3 ADR 起草节奏 | 3 | M-SN-5 内 2 ADR + 9-10 端点评审是隐性瓶颈 |
| N4 §3 决策表一致性 | 4 | 仅 milestone 审计行缺 §5.3 引用 |
| N5 修订日志规范性 | 4 | 13 项条目齐全；缺"v0 → v1 行号映射"列 |

### R7.3 必须修复（MUST，二轮新增 2 项）

#### MUST-7 | M-SN-6 工时与范围明显失衡
- **位置**：plan §6 M-SN-6（2.5 周）
- **问题**：M-SN-6 同时承担 9 路由 + 设计稿对齐 + 通知双面板 + 大数据原语首次实装 + 3 组依赖选型决议 + 7 自建组件下沉。工作量 ≥ M-SN-4 + M-SN-5 之和的 60%。
- **三选修复**：
  - (a) 拆 M-SN-6a（视图覆盖）+ M-SN-6b（大数据原语 + 依赖选型）
  - (b) system/* 5 子推到 M-SN-6b
  - (c) **M-SN-6 直接上调至 4 周**，同步 §6 累计 + 总周期声明 16w → **17.5w**
- 主循环建议 **(c)**：改动最小最干净；不增加 milestone 数量；接受总周期延长 1.5 周

#### MUST-8 | M-SN-5 ADR-050/051 起草节奏与 Opus 评审通道未明
- **位置**：plan §6 M-SN-5 + §9 ADR 索引
- **问题**：M-SN-5 4 周内 6 视图 + 9-10 新端点 + 2 ADR + 每端点独立 Opus 评审；未给"先 ADR 后端点"或"端点+ADR 同卡"协议
- **修复**：在 §4.5 + §6 M-SN-5 增协议条款"ADR-050/051 须在对应端点首个任务卡前完成 Opus PASS，端点逐个落地时复用同一 ADR；不允许端点 PR 与 ADR 同卡"

### R7.4 建议优化（SHOULD，3 项）

| 项 | 建议 | 主循环可独立修？ |
|:-:|---|:-:|
| SHOULD-8 | M-SN-6.5 0.5w 加"软上限 1w"，任一类 critical >2 项即升至 1 周 | ✅ |
| SHOULD-9 | §3 决策表 milestone 审计行补 §5.3 引用 | ✅ |
| SHOULD-10 | 修订日志加"v0 → v1 行号映射"列 | ✅ |

### R7.5 开放议题（DISCUSS，2 项）

| 项 | 议题 | 处理 |
|:-:|---|---|
| DISCUSS-6 | 新端点鉴权遇草稿/发布双态时的粒度（如 home_modules publishOnly） | 留待 ADR-050 起草时裁定 |
| DISCUSS-7 | token 重构 web-next 视觉回归截图清单标准化 | 加"home / search / video detail / player 4 页 × 明暗 = 8 张"标准 |

### R7.6 修复方案（待用户裁定 1 项）

#### 主循环可独立处理
- MUST-7：默认采纳方案 **(c)**（M-SN-6 上调 4w，总周期 17.5w）
- MUST-8：在 §4.5 加 ADR-端点先后协议
- SHOULD-8/9/10：直接补
- DISCUSS-6：标记留待 ADR-050
- DISCUSS-7：加 8 张截图标准

#### 需用户裁定 1 项

**Q-MUST-7：M-SN-6 修复方向**
- (a) 拆 M-SN-6a / M-SN-6b — 增加 milestone 数量，复杂化
- (b) system/* 推到 M-SN-6b — 视图分散，复用矩阵需调整
- **(c) M-SN-6 上调至 4w，总周期 16w → 17.5w**（主循环建议）— 最干净

请回复 (a) / (b) / (c) 或全部采纳主循环建议。

### R7.7 下一步

回复后流程：
1. **R8**：plan v1 → v2 修订（MUST-7/8 + SHOULD-8/9/10 + DISCUSS-7 标准）
2. **R9**：spawn arch-reviewer **第三轮**评审（评审员预测"0.5 轮即 PASS，因结构已稳"）
3. **R10**：v2 PASS 后启动 M-SN-0 第一批 docs 归档

— END R7 —

---

## R8（2026-04-28 主循环 claude-opus-4-7） — Plan v2 修订完成

### R8.1 修订摘要

`docs/server_next_plan_20260427.md` 由 v1 → v2，全部采纳 R7 评审建议。

#### MUST 修复（2 项）
- **MUST-7（M-SN-6 工时失衡）**：采用方案 (c) 直接上调 — §6 M-SN-6 由 2.5w → **4w**；总周期 **16w → 17.5w**；§3 决策表新增 1 行
- **MUST-8（ADR-端点先后协议）**：§4.5 新增子节"ADR-端点先后协议"（ADR 先于端点首个任务卡 / 同 ADR 多端点复用 / 不允许端点 PR 与 ADR 同卡）；§6 M-SN-5 范围加协议引用

#### SHOULD 修复（3 项）
- **SHOULD-8**：M-SN-6.5 加"软上限 1 周"协议
- **SHOULD-9**：§3 Milestone 审计行 ADR 列指向判据表
- **SHOULD-10**：修订日志按"v1 → v2 章节定位"组织

#### DISCUSS 决议（2 项）
- **DISCUSS-6**：§4.5 末段标"留待 ADR-050 裁定，不在 plan v2 预决"
- **DISCUSS-7**：§10.4 加 8 张截图标准（home / search / video detail / player × 明暗 2 模式），缺一不可 merge

### R8.2 v1 → v2 关键变更

| 章节 | v1 | v2 |
|---|---|---|
| §0 version | v1 | v2（含 v0 → v1 → v2 修订日志） |
| §3 决策表 | 21 行 | 25 行（+4 行：M-SN-6 工时 / ADR-端点协议 / M-SN-6.5 软上限 / 截图标准） |
| §4.5 | 主通道 + 新增端点矩阵 + 硬约束 | + ADR-端点先后协议子节 |
| §6 M-SN-5 | 6 视图 + API 补齐 | + 协议引用 |
| §6 M-SN-6 | 2.5 周 | **4 周**（标注 R7 MUST-7 c 上调） |
| §6 M-SN-6.5 | 0.5 周 | 0.5 周**（软上限 1 周）** |
| §6 总周期 | 16 周 | **17.5 周**（M-SN-6 累计 +1.5w） |
| §10.4 | 截图对照（无清单） | 8 张截图标准（4 页 × 明暗） |
| 修订日志 | v0 → v1 | + v1 → v2 |
| §12 自检 | v1 完整性 | v2 完整性 |

### R8.3 下一步：R9 第三轮评审

按 plan §0 版本协议，v2 进入 M-SN-0 前需 spawn arch-reviewer (Opus) 第三轮评审。

R7 评审员预测："修复 MUST-7/8 后 0.5 轮即 PASS，结构已稳"。

第三轮评审重点：
1. v1 → v2 的 7 处修订是否真正闭环
2. 工时上调 16w → 17.5w 是否平衡了 M-SN-5 / M-SN-6 / M-SN-6.5 节奏
3. ADR-端点先后协议是否消除了 M-SN-5 隐性瓶颈
4. 是否仍有 N1（修订内部矛盾）/ N2（工时合理性）/ N3（ADR 起草节奏）残留

预期产出：PASS（极高概率）/ CONDITIONAL（≤2 项小修）/ REJECT（极低概率）

如 PASS 即启动 R10（M-SN-0 第一批 docs 归档，spawn doc-janitor）。

— END R8 —

---

## R9（2026-04-28 arch-reviewer claude-opus-4-7） — Plan v2 第三轮评审

### R9.1 Verdict: **PASS** 🎉

R7 修订闭环验证：7 项**全部 ✅ 闭环**（MUST-7/8 + SHOULD-8/9/10 + DISCUSS-6/7）。

无新增 MUST。0 阻塞项。

### R9.2 维度评分

| 维度 | 评分 | 关键发现 |
|---|:-:|---|
| M1 修订内部矛盾 | 5 | 7 处修订均聚焦增量约束，未触动 v1 已稳定结构；§3/§6/§4.5/§10.4 交叉引用一致 |
| M2 工时再平衡 | 4 | 17.5w 总盘合理；M-SN-5+M-SN-6 连续 8w 偏紧但 §10.8 bus factor 兜底；M-SN-6.5 软上限 1w 弹性可接受 |
| M3 ADR-端点协议落地 | 4 | 协议清晰自洽；M-SN-5 周次未明属非阻塞 |
| M4 截图标准可执行 | 5 | 8 张清单具体到页面 URL + 主题 + 命名 + 硬约束 |
| **M5 总评 PASS 门槛** | **5** | **7 项闭环 + 0 新阻塞 + 剩余项可在 M-SN-0 第三批 ADR 消化** |

### R9.3 非阻塞优化项（评审员建议在 M-SN-0 第三批 ADR 起草时消化，**不需要 plan v3**）

| 项 | 内容 | 落地位置 |
|:-:|---|---|
| SHOULD-11 | M-SN-5 内部周次拆分建议（W1 ADR-050/051 + Opus PASS / W2-3 端点 + 推荐 3、5 视图 / W4 推荐 2 + submissions/subtitles/users 收尾） | ADR-046 附录"M-SN-5 推荐顺序" |
| SHOULD-12 | web-next 视觉回归截图规约文档 | ADR-048 token 三层重构验收节点 |
| SHOULD-13 | §10.8 bus factor 加"M-SN-5 末尾 handoff 文档须包含 ADR-050/051 落地状态" | ADR-046 §风险段 |
| DISCUSS-8 | §4.7 三组候选依赖（recharts/visx · reactflow/dagre · react-virtual/react-window）首次落地评审是否合并 spawn | 留 M-SN-6 启动时主循环裁定 |

### R9.4 评审员裁定

- **PASS 路径（采纳）**：v2 通过最终门槛，主循环可直接启动 M-SN-0
- 建议在 M-SN-0 第三批 ADR 起草时一并消化 SHOULD-11/12/13（追加到 ADR-046 / ADR-048 相应段落即可）
- DISCUSS-8 留 M-SN-6 启动时裁定

### R9.5 server-next 立项流程闭环

```
R1 (审核 + 议题开题)
 → R2 (10 议题决策 + 切流方案 E + token 三层 + 工作流规约 + milestone 划分)
 → R3 (S1-S3 决策 + IA 修正：移除 staging)
 → R4 (plan v0 落盘)
 → R5 (一轮评审：CONDITIONAL，6 MUST + 7 SHOULD + 5 DISCUSS)
 → R6 (plan v0 → v1，全部采纳建议)
 → R7 (二轮评审：CONDITIONAL，2 MUST + 3 SHOULD + 2 DISCUSS)
 → R8 (plan v1 → v2，全部采纳建议)
 → R9 (三轮评审：PASS) ★
 → R10 (M-SN-0 第一批 docs 归档启动)
```

### R9.6 进入 M-SN-0 准备

按 plan §11，M-SN-0 分三批：
- **第一批 docs 归档**（D1-D5，spawn doc-janitor）
- **第二批 code 清理**（C1-C5，主循环 + arch-reviewer）
- **第三批 ADR 起草**（A1-A5，主循环 + Opus 评审，一并消化 R9.3 SHOULD-11/12/13）

预计 1 周完成。

### R9.7 R10 第一批启动方案

**待用户确认**：是否立即启动 R10 第一批 docs 归档？

第一批操作（spawn doc-janitor 子代理）：
- D1 移 `freeze_notice_20260418.md` → `docs/archive/`
- D2 移 5 份前端方案（design_system / frontend_redesign / frontend_phase2 / frontend_design_spec / image_pipeline）→ `docs/archive/m0-m6/`
- D3 归档 task-queue 历史已完成序列 → `docs/archive/task-queue/`
- D4 归档 changelog 历史 → `docs/archive/changelog/`
- D5 修正 `architecture.md` §1 漂移

完成后 spawn arch-reviewer 复核 PASS → R10 闭环 → 启动 R11 第二批 code 清理。

— END R9 —
