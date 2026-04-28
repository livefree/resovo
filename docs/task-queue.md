# Resovo（流光）— 任务序列池（Task Queue）

> status: active
> owner: @engineering
> scope: task sequencing, status tracking, blocker notifications
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27
>
> 用途：提前规划多个任务序列，避免”走一步看一步”；同时作为 BLOCKER/PHASE COMPLETE 通知的写入位置。
> 关系：本文件负责”任务规划 + 状态追踪 + 通知”；`docs/tasks.md` 负责”当前单任务工作台（完成即清空）”；`docs/changelog.md` 负责”完成历史日志”。

---

## 统一规则（必须遵守）

1. 任务序列命名

- 序列 ID 格式：`SEQ-YYYYMMDD-XX`（例：`SEQ-20260319-01`）
- `XX` 从 `01` 递增，不复用、不回填
- 一个序列包含一组有依赖关系的任务（可跨多个模块）

2. 任务编号命名（沿用现有规范）

- 任务 ID 格式：`<PREFIX>-NN`
- `PREFIX` 必须使用既有前缀：`INFRA` / `AUTH` / `VIDEO` / `SEARCH` / `PLAYER` / `CRAWLER` / `ADMIN` / `USER` / `SOCIAL` / `LIST` / `CONTRIB` / `CHG` / `CHORE` / `DEC` / `UX` / `META` / `IMG` / `HANDOFF` / `STATS`
  - `DEC`：前后台解耦架构任务（来自 frontend_backend_decoupling_plan_20260401.md，2026-04-02 新增）
  - `UX`：后台交互改造任务（来自 admin_console_decoupling_and_ux_plan_20260402.md，2026-04-02 新增）
  - `META`：外部元数据层建设任务（来自 external_metadata_import_plan_20260405.md + 2026-04-14 豆瓣扩展方案，2026-04-14 新增）
  - `IMG`：图片管线与样板图系统任务（来自 image_pipeline_plan_20260418.md，2026-04-20 新增）
  - `HANDOFF`：前端交付包落地（来自 handoff_20260422/landing_plan_v1.md，M7 扩充首页重设计，2026-04-22 新增）
  - `STATS`：视频观看埋点 + 综合算分（v2.1 独立跟进，2026-04-22 新增占位）
- `NN` 为两位数字，按同前缀内最大编号递增（例如当前最大 `CHG-335`，下一个必须是 `CHG-336`）
- 禁止跳号占坑、禁止复用已存在编号

3. 时间戳要求

- 每个序列必须包含：`创建时间`、`最后更新时间`
- 每个任务必须包含：`创建时间`（必填），`计划开始时间`（建议），`实际开始时间`（启动后填），`完成时间`（完成后填）
- 时间格式统一：`YYYY-MM-DD HH:mm`（本地时区）

4. 记录位置（统一，禁止混用）

- 本文件：新序列与新任务一律**追加到文件尾部**
- `docs/tasks.md`：新任务块一律**追加到文件尾部**；同一任务只更新其状态与时间字段
- `docs/changelog.md`：新完成记录一律**追加到文件尾部**
- 禁止“有时头插、有时尾插”

5. 执行约束

- `docs/tasks.md` 是单任务工作台：同时只允许 1 个任务为 `🔄 进行中`；任务完成后立即从 tasks.md 删除该卡片（历史存于 changelog.md）
- 任务进入执行前，必须已在本文件序列中定义（除紧急 hotfix）
- 每完成一个任务，立即更新本文件对应任务状态与时间戳，并更新所属序列的 `最后更新时间`
- BLOCKER 和 PHASE COMPLETE 通知写入本文件尾部（不写入 tasks.md）

---

## 序列模板

```markdown
## [SEQ-YYYYMMDD-XX] 序列标题

- **状态**：🟡 规划中 / 🔄 执行中 / ✅ 已完成 / ⛔ 已取消
- **创建时间**：YYYY-MM-DD HH:mm
- **最后更新时间**：YYYY-MM-DD HH:mm
- **目标**：一句话描述目标
- **范围**：涉及模块与边界
- **依赖**：上游任务或环境前置

### 任务列表（按执行顺序）

1. TASK-ID — 标题（状态：⬜/🔄/✅/❌）
   - 创建时间：YYYY-MM-DD HH:mm
   - 计划开始：YYYY-MM-DD HH:mm
   - 实际开始：YYYY-MM-DD HH:mm（未开始可留空）
   - 完成时间：YYYY-MM-DD HH:mm（未完成可留空）
   - 验收要点：...
```

---
## 序列编号约束声明

**重要**：新任务序列号不得与历史归档（`docs/archive/task-queue/task-queue_archive_20260427.md`）中的序号重复。历史已完成序列（SEQ-20260319-* 至 SEQ-20260426-01）已归档。当前及后续任务使用新序列号。

---

## [SEQ-20260428-01] M-SN-1 工程骨架 + Token 三层 + Provider（执行序列）

- **状态**：🔄 执行中
- **创建时间**：2026-04-28 02:00
- **最后更新时间**：2026-04-28 04:25
- **目标**：搭建 apps/server-next 工程骨架 + packages/admin-ui 空骨架 + design-tokens 三层重构 + Provider 移植 + IA v0 27 路由占位 + apiClient + 鉴权 + login → dashboard 通路打通
- **范围**：`apps/server-next/`（新建）、`packages/admin-ui/`（新建空骨架）、`packages/design-tokens/`（三层重构）、`apps/web-next/`（token 引用面回归验证）、`package.json`（workspaces 追加）、`docker-compose.dev.yml`（server-next 服务）、`docs/architecture.md`（§17 token 三层映射）、`scripts/verify-server-next-isolation.mjs`（新建）
- **依赖**：M-SN-0 三批清理已 PASS（commit `7c278cc` / `96cde57` / `827b88c`）；ADR-100/101/102 落盘
- **里程碑参考**：plan §6 M-SN-1（行 375–390）；工时上限 1.5 周（≈ 7.5 工作日）
- **完成标准（plan §6 M-SN-1）**：
  - `npm run dev` 起 :3003，登录 → dashboard 通路打通
  - 所有 27 路由 SSR 不报错（即使内容为占位）
  - typecheck + lint + 现有 test 全绿
  - apps/web-next 在 token 三层下视觉无回归（截图对比）
  - packages/admin-ui 在 root workspaces 注册成功
  - arch-reviewer 阶段审计 PASS（A 级评级，详见 plan §5.3）
- **建议主循环模型**：opus（涉及 Provider 协议层 + token 三层 schema + ESLint 边界设计）
- **review 协议**：每张卡完成后 spawn arch-reviewer（claude-opus-4-6）做自动化 review；CONDITIONAL ≤ 3 轮闭环；REJECT 即 BLOCKER

### 任务列表（按执行顺序）

1. **CHG-SN-1-01** — packages/admin-ui 空骨架 + workspaces 追加（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 1 上午
   - 实际开始：2026-04-28 02:10
   - 完成时间：2026-04-28 02:30
   - 实际工时：0.3 天（< 估算 0.5 天）
   - review：arch-reviewer (claude-opus-4-6) PASS（首轮即过）
   - 子代理偏离：tsconfig 扩展 jsx: preserve + *.tsx include（提前配 M-SN-2 React 组件 jsx 编译选项）— reviewer 判定合理无风险
   - 工时估算：0.5 天
   - 关联 plan §：§4.4 创建时机 / §11.2 C2 待补条目
   - 关联 ADR：ADR-100（立项）
   - 文件范围：`packages/admin-ui/package.json`、`packages/admin-ui/tsconfig.json`、`packages/admin-ui/src/index.ts`、根 `package.json` workspaces
   - 不在范围：任何业务组件实现（M-SN-2 起步）
   - 验收要点：
     - `packages/admin-ui/package.json` 含 `name: @resovo/admin-ui`、`version: 0.0.0`、`private: true`、`main: src/index.ts`
     - `tsconfig.json` 继承根配置，含 strict 模式
     - `src/index.ts` 仅 `export {}` 占位
     - 根 `package.json` workspaces 追加 `packages/admin-ui`
     - `npm install` 成功识别新 workspace（`npm ls --depth=0` 含 `@resovo/admin-ui`）
     - `npm run typecheck` 全绿
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus（轻量但属于"共享组件 API 契约准备"）

2. **CHG-SN-1-02** — apps/server-next Next.js 空壳 + workspaces 追加 + dev :3003 起服（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 1 下午
   - 实际开始：2026-04-28 02:35
   - 完成时间：2026-04-28 02:45
   - 实际工时：0.2 天（远 < 估算 1 天，单语言 + 极简 next.config 大幅缩减工作量）
   - review：arch-reviewer (claude-opus-4-6) PASS（首轮即过）
   - 计划外偏离（3 处全部合理）：
     · 不创建 `.eslintrc.json`（与 web-next/server 一致依赖 next lint 默认）
     · 不改 `docker/docker-compose.dev.yml`（仅 nginx 容器，无 service 概念；M-SN-7 nginx upstream 切流再处理）
     · `next.config.ts` 而非 `.mjs`（与 web-next/server 模板一致）
   - 工时估算：1 天
   - 关联 plan §：§4.1 仓库结构 / §4.2 端口与切流 / §11.2 C2 待补条目
   - 关联 ADR：ADR-100（单语言 / IA v0）
   - 文件范围：`apps/server-next/package.json`、`apps/server-next/next.config.mjs`、`apps/server-next/tsconfig.json`、`apps/server-next/src/app/layout.tsx`、`apps/server-next/src/app/page.tsx`（dashboard 占位）、`apps/server-next/.eslintrc.json`、根 `package.json` workspaces + scripts、`docker-compose.dev.yml`
   - 不在范围：design-tokens 接入（CHG-SN-1-03）/ Provider 移植（CHG-SN-1-04）/ 27 路由（CHG-SN-1-05）/ apiClient（CHG-SN-1-06）
   - 验收要点：
     - 单语言 zh-CN，无 next-intl，无 `[locale]` 段
     - Next.js App Router，端口 3003（开发期）
     - root `package.json` scripts 追加 `dev:server-next`、scripts/dev.mjs 集成
     - `npm run dev:server-next` 单独起服成功；`npm run dev` 同时起 api/web-next/server-next
     - `http://localhost:3003/admin/` 返回 200（dashboard 占位 "Hello server-next"）
     - typecheck + lint 全绿
     - docker-compose.dev.yml 添加 server-next service（端口 3003，nginx upstream 暂不指向）
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus

3. **CHG-SN-1-03** — packages/design-tokens 三层重构（base/semantic/admin-layout）+ apps/web-next 引用面回归（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 2 上午
   - 实际开始：2026-04-28 02:50
   - 完成时间：2026-04-28 03:05
   - 实际工时：0.25 天（远 < 估算 2 天，因 A 方案大幅缩减范围 + design-tokens 现有 build pipeline 设计良好）
   - review：arch-reviewer (claude-opus-4-6) PASS（首轮即过；3 SHOULD 已记录不阻塞）
   - 关键事件：摸现状阶段触发 BLOCKER（design-tokens 是 4 层成熟系统，不是 3 层轻量包）→ 用户裁定 A 方案 → ADR-102 patch + plan §4.3 同步 + 4+1 层结构落地
   - SHOULD 留账（CHG-SN-1-07 处理）：dual-signal + admin-layout 跨域消费禁令的 ESLint + ts-morph 编译期守卫
   - 工时估算：2 天（**M-SN-1 最重一卡**）
   - 关联 plan §：§4.3 token 三层 / §10.4 design-tokens 重构对 web-next 影响
   - 关联 ADR：ADR-102（token 三层）/ ADR-022 / ADR-023 / ADR-032
   - 文件范围：
     - `packages/design-tokens/src/base/`（colors / typography / spacing / radius / shadow / motion 子文件）
     - `packages/design-tokens/src/semantic/`（status / dual-signal / surface 子文件）
     - `packages/design-tokens/src/admin-layout/`（shell / table / density 子文件）
     - `packages/design-tokens/build.ts`（构建脚本扩展三层导出）
     - `packages/design-tokens/src/index.ts`（导出三层入口）
     - `apps/web-next/src/styles/globals.css` 引用调整（如有）
     - `docs/architecture.md` §17（token 三层映射表）
   - 不在范围：apps/server-next 接入（CHG-SN-1-04）/ admin-layout 命名空间消费（M-SN-2 起步）
   - 验收要点（plan §4.3 + ADR-102）：
     - 三层目录结构与 plan §4.3 一致
     - base 含 colors / typography / spacing / radius / shadow / **motion** 六类
     - semantic 含 status / dual-signal / **surface bg0~bg4** 三类
     - admin-layout 含 shell / table / density 三类
     - 设计稿 v2.1 `styles/tokens.css` 全部字段并入对应层；附 v2.1 → packages 映射表（写入 `docs/architecture.md` §17）
     - **apps/web-next 视觉无回归**：
       - 跑 e2e 黄金路径（首页 / 详情 / watch / search / login）截图与 main 分支对比
       - 任意像素差 → BLOCKER 上报（不得自行调整 token 值）
     - dual-signal token 在 web-next 0 消费（grep `--probe` `--render` 在 apps/web-next/src 0 命中）
     - typecheck + lint + unit test 全绿
     - design-tokens 单元测试（packages/design-tokens/**/*.test.ts）覆盖三层导出
   - 子代理调用：arch-reviewer (Opus) — token schema 是 ADR-102 落地核心，必须 Opus 审
   - 主循环模型：opus
   - **风险点**：apps/web-next 现有 CSS 变量引用面广，可能因层级移动（如 surface 从 base → semantic）出现 SSR/CSR 视觉差；卡内须先 grep 列出所有引用方再迁移

4. **CHG-SN-1-04** — server-next BrandProvider / ThemeProvider 移植 + admin-layout token 接入（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 4 上午
   - 实际开始：2026-04-28 03:35
   - 完成时间：2026-04-28 03:45
   - 实际工时：0.15 天（远 < 估算 1 天，物理副本策略 + 简化 admin 单品牌路径）
   - review：arch-reviewer (claude-opus-4-6) PASS（首轮即过；6/6 子项 ✅，0 MUST 偏差）
   - 三处合理简化偏离：DEFAULT_THEME 改 dark / setBrand 不 fetch / 去 logger.client（CHG-SN-1-06 补回）
   - 工时估算：1 天
   - 关联 plan §：§4.4 范围（BrandProvider / ThemeProvider 不下沉） / §6 M-SN-1 完成标准
   - 关联 ADR：ADR-038（双轨主题）/ ADR-039（middleware 品牌识别）/ ADR-102（admin-layout token）
   - 文件范围：`apps/server-next/src/contexts/BrandProvider.tsx`、`apps/server-next/src/contexts/ThemeProvider.tsx`、`apps/server-next/src/middleware.ts`（品牌识别）、`apps/server-next/src/app/layout.tsx`（Provider 包裹）、`apps/server-next/src/app/globals.css`（design-tokens 三层引入）
   - 不在范围：业务路由（CHG-SN-1-05）/ apiClient（CHG-SN-1-06）
   - 验收要点：
     - 直接复用 apps/web-next 的 BrandProvider/ThemeProvider 实现（参考 ADR-038/039；不重写 API）
     - middleware 品牌识别（cookie → header）与 web-next 行为一致
     - admin-layout token（sidebar-w / topbar-h / row-h 等）在 :root 注入并可被任意子组件消费
     - dark 主题为默认（plan §4.3 / ADR-102 dark-first），light 主题不接入（M-SN-1 不阻塞 cutover）
     - SSR 无 hydration mismatch
     - typecheck + lint + 单元测试全绿
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus

5. **CHG-SN-1-05** — server-next 路由骨架（IA v0 占位 / 19 路由按 plan §7 文字清单）（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 5 上午
   - 实际开始：2026-04-28 03:50
   - 完成时间：2026-04-28 03:55
   - 实际工时：0.1 天（远 < 估算 1 天，PlaceholderPage 复用 + 极简 shell）
   - review：arch-reviewer (claude-opus-4-6) PASS（首轮即过；7/7 子项 ✅）
   - 关键发现：plan §7 数据不一致 — 文字清单列 20 路由（13 顶层 + 5 system 子 + 1 编辑 + 1 login）但视图数行 549 写"27"。本卡按文字清单落（19，deferring videos/[id]/edit 至 M-SN-4），偏离记录在 admin-nav.ts 头部 + 留 CHG-SN-1-08 修订 plan §7 数字字段
   - 任务卡草稿偏离：completion 字段曾列 design-tokens/banners/api-keys/cron/cache 五子，本卡按 plan §7 落 settings/cache/monitor/config/migration（plan 是真源）
   - 工时估算：1 天
   - 关联 plan §：§7 IA v0
   - 关联 ADR：ADR-100（IA v0）
   - 文件范围：`apps/server-next/src/app/admin/**/page.tsx`（27 路由占位）、`apps/server-next/src/app/admin/layout.tsx`（侧栏 + 顶栏占位）、`apps/server-next/src/app/login/page.tsx`、`apps/server-next/src/app/403/page.tsx`、`apps/server-next/src/app/404.tsx`
   - 不在范围：任何业务组件 / 数据请求 / 表格（M-SN-2/3+ 起步）
   - 验收要点（plan §7）：
     - 27 路由全部存在 SSR 入口：21 顶层 + 5 system 子 + 1 login（403/404 是 Next.js 错误页，不计入 27）
     - 区段划分对齐 IA v0：
       - **运营中心**：dashboard / moderation
       - **内容资产**：videos / sources / merge / subtitles / image-health
       - **采集中心**：crawler
       - **系统管理**：home / submissions / analytics / users / settings / audit + 5 system 子（暂列：design-tokens / banners / api-keys / cron / cache）
     - 每页 SSR 返回 200 + `<h1>` 路由名称（占位文案）
     - layout.tsx 含侧栏路由树（点击可跳转）+ 顶栏（用户菜单 + 主题切换）
     - typecheck + lint 全绿
     - e2e smoke 测试：访问 27 路由全部 200
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus（IA 骨架影响后续所有视图卡）

6. **CHG-SN-1-06** — apiClient + 鉴权层 + login 实现 + dashboard 通路（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 6 上午
   - 实际开始：2026-04-28 04:00
   - 完成时间：2026-04-28 04:10
   - 实际工时：0.15 天（远 < 估算 1 天，物理副本 + 简化路径）
   - review：arch-reviewer (claude-opus-4-6) — 首轮 CONDITIONAL（1 MUST: UserRole 'editor' 幽灵角色 + 1 SHOULD: query string 保留）→ 二轮 PASS
   - 简化偏离：不引入 zustand（M-SN-3 业务卡再决定）/ admin-only 子路径细分推后 M-SN-2+ / 真 e2e 登录测试推后
   - 工时估算：1 天
   - 关联 plan §：§4.5 与 apps/api 的耦合面（主通道）
   - 关联 ADR：ADR-003（JWT 双 Token）/ ADR-010（后台入口与角色权限）
   - 文件范围：`apps/server-next/src/lib/apiClient.ts`、`apps/server-next/src/lib/auth/`、`apps/server-next/src/app/login/page.tsx`、`apps/server-next/src/app/admin/page.tsx`（dashboard 实装）、`apps/server-next/src/middleware.ts`（追加鉴权）
   - 不在范围：admin-only 端点 / moderator+ 端点的差异化拦截（M-SN-2+ 视图卡按需）
   - 验收要点：
     - apiClient 复用 packages/types 端点签名（不重新发明）
     - apiClient 集成 refresh_token cookie 自动续签（沿用既有 /v1/auth 流程）
     - login 页面（POST /v1/auth/login）→ 成功后跳 /admin（dashboard）
     - 未登录访问 /admin/* 自动重定向 /login
     - user_role=user 拒绝进入（403 页）
     - dashboard 占位（暂不调业务端点；M-SN-2+ 视图卡按需）
     - typecheck + lint + 单元测试全绿
     - e2e：登录 → dashboard → 登出循环通
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus

7. **CHG-SN-1-07** — ESLint no-restricted-imports 边界 + ts-morph CI 兜底（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 7 上午
   - 实际开始：2026-04-28 04:15
   - 完成时间：2026-04-28 04:25
   - 实际工时：0.15 天（远 < 估算 0.5 天）
   - review：arch-reviewer (claude-opus-4-6) 首轮 PASS（6/6 子项 ✅，0 MUST 偏差）
   - 简化偏离：用 TypeScript Compiler API（已有 dep）替代 ts-morph 新依赖；故意违规自测覆盖 4 种 import 形态全部捕获
   - 同时落实 ADR-102 跨域消费禁令的"编译期守卫"承诺（CHG-SN-1-04 / CHG-SN-1-03 留账闭环）
   - 工时估算：0.5 天
   - 关联 plan §：§4.6 编译期边界检查
   - 关联 ADR：ADR-100（架构约束 ts-morph 脚本路径）
   - 文件范围：`apps/server-next/.eslintrc.json`（no-restricted-imports 规则）、`scripts/verify-server-next-isolation.mjs`（新建）、`package.json` scripts（追加 `verify:server-next-isolation`）、`.github/workflows/ci.yml`（CI 步骤；如不存在则跳过 CI 装载，本卡仅落地脚本）
   - 不在范围：apps/server 内部清理（已 cutover 后处理）
   - 验收要点：
     - ESLint 规则禁止 server-next 直接 import：
       - `apps/server/**`
       - `apps/web-next/**`（除 packages 共享层外）
     - ts-morph 脚本扫描 server-next 全部 .ts/.tsx，输出 isolation report：
       - 命中 = 0 → 退出码 0
       - 命中 ≥ 1 → 退出码 1 + 列出违规文件:行号
     - `npm run verify:server-next-isolation` 本地可跑
     - 故意制造 1 处违规 import → 脚本应报错（自测样例可写入 commit message 验证）
     - typecheck + lint 全绿
   - 子代理调用：arch-reviewer (claude-opus-4-6)
   - 主循环模型：opus

8. **CHG-SN-1-08** — M-SN-1 完成标准验收 + arch-reviewer 阶段审计（状态：⬜ 未开始）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 7 下午
   - 工时估算：0.5 天
   - 关联 plan §：§5.3 milestone 阶段审计（A/B/C 评级）/ §6 M-SN-1 完成标准
   - 关联 ADR：ADR-100/101/102（全部 M-SN-1 关联）
   - 文件范围：`docs/changelog.md`（M-SN-1 闭环条目）、`docs/architecture.md` §17（token 三层映射表已在 CHG-SN-1-03 落入）、`docs/server_next_plan_20260427.md`（修订日志追加 v2 → v2.1，工时实际 vs 估算）
   - 不在范围：M-SN-2 任务卡起草（独立序列）
   - 验收要点：
     - plan §6 M-SN-1 完成标准 5 条逐条验证：
       - [ ] `npm run dev` 起 :3003，登录 → dashboard 通路打通
       - [ ] 27 路由 SSR 全部 200
       - [ ] typecheck + lint + test 全绿
       - [ ] apps/web-next 视觉无回归（截图对比）
       - [ ] packages/admin-ui 在 root workspaces 注册成功
     - spawn arch-reviewer (Opus) 阶段审计：
       - 评级判据 plan §5.3（A/B/C）
       - 重点：token 收编完整性、Provider 协议合规、零 apps/server 依赖、ESLint 边界生效
       - **A 级判据**：完成标准 100% + 无 BLOCKER + 无技术债务回流
       - **B 级判据**：完成标准 ≥90% + 已记录欠账与解决路径
       - **C 级判据**：< 90% → 触发暂停，强制人工审核清单
     - 评级 A 或 B（带欠账） → M-SN-1 闭环；评级 C → BLOCKER
   - 子代理调用：arch-reviewer (Opus) — milestone 阶段审计强制 Opus
   - 主循环模型：opus

### M-SN-1 整体复用矩阵（按 plan §8 节选）

| 资产 | 来源 | 此 milestone 是否产生 |
|---|---|---|
| Next.js App Router 工程模板 | apps/web-next 参考（不复用代码） | ✅ 新建 server-next |
| BrandProvider / ThemeProvider | apps/web-next 直接复用 | ❌ 复用，不下沉到 packages/admin-ui（plan §4.4） |
| design-tokens 三层 | packages/design-tokens（重构）| ✅ 重构 |
| apiClient | packages/types 端点签名（复用）| ✅ 新建 server-next 实例 |
| ESLint 边界规则 | tools/eslint-plugin-resovo（复用 + 扩展）| ✅ 扩展 |
| middleware 品牌识别 | apps/web-next/middleware.ts（复用思路 + 重写）| ✅ 新建 server-next |

### 风险与回退

- **CHG-SN-1-03 风险**：apps/web-next token 引用面回归是 M-SN-1 最大风险点（plan §10.4）。一旦截图对比失败：
  - **小回滚**：仅回退 design-tokens 该卡，apps/server-next 后续卡阻塞
  - **大回滚**：保留 packages/admin-ui 空骨架，删除 server-next 工程，等 token 重构方案 v2 再起步
- **CHG-SN-1-05 风险**：27 路由 SSR 全绿对 IA v0 假设的稳健性是验证点；如 IA 命名 / 区段不合理，由本卡输出"IA 修订需求"BLOCKER 给 M-SN-2 开工前裁定
- **整体兜底**：M-SN-1 完成标准未达 → arch-reviewer 评 C → BLOCKER 暂停；不进 M-SN-2

### 备注

- 本序列序号 SEQ-20260428-01 不与历史归档（SEQ-20260319-* 至 SEQ-20260426-01）重复
- 本序列任务 ID 全部采用 `CHG-SN-1-NN` 格式（plan §5.4 + git-rules.md trailer 扩展规约）
- 每张卡 commit trailer 必含：`Refs:` `Plan:` `Review:` `Executed-By-Model:` `Subagents:` `Co-Authored-By:`
- 每张卡完成 = 主循环修订 + arch-reviewer PASS + commit + 本序列任务状态更新 + changelog 追加
- 序列完成 = CHG-SN-1-08 阶段审计 PASS + plan 修订日志追加（v2 → v2.1，实际工时 vs 估算）

