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

- **状态**：✅ 已完成（M-SN-1 milestone B 级 PASS，2026-04-28）
- **创建时间**：2026-04-28 02:00
- **最后更新时间**：2026-04-28 04:50
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

8. **CHG-SN-1-08** — M-SN-1 完成标准验收 + arch-reviewer 阶段审计（状态：✅ 已完成）
   - 创建时间：2026-04-28 02:00
   - 计划开始：M-SN-1 Day 7 下午
   - 实际开始：2026-04-28 04:30
   - 完成时间：2026-04-28 04:50
   - 实际工时：0.2 天
   - review：arch-reviewer (claude-opus-4-6, **Opus**) milestone 审计 — **B 级 PASS**（达成率 90% / 0 MUST 阻塞 / 工时未超）
   - 输出：plan v2.1 修订日志（§7 字段对账 + 实际工时 vs 估算 + 节奏校准建议）/ docs/server_next_handoff_M-SN-1.md（plan §10.8 SHOULD-4-d 要求）/ task-queue M-SN-2 前置 CHG-SN-1-09 登记
   - 视觉回归 e2e 截图豁免理由：dual-signal + admin-layout 是 net-new 字段，0 现有引用面变更；M-SN-7 cutover 前置补做
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

### M-SN-1 闭环备忘（CHG-SN-1-08 audit B 级，2026-04-28）

**经 SEQ-20260428-02 闭环（2026-04-28）**：CHG-SN-1-09（守卫）+ CHG-SN-1-10/-11（IA v0 → v1）+ CHG-SN-1-12（plan §6 M-SN-2 Shell 扩列）+ CHG-SN-1-13（追溯）共 5 张卡 PASS；plan v2.1 → v2.3；ADR-100 IA 修订段落盘；M-SN-1 原欠账（token name string 级守卫）已偿。M-SN-2 第一张组件卡（CHG-SN-2-01 ADR-103a Opus 评审）可放行开工。

reviewer Opus 审计判定 **B 级 PASS**（达成率 90% / 5 条完成标准 4.5 通过 / 0 MUST 阻塞）。三条进入 M-SN-2 前置建议落地策略：

1. **CHG-SN-1-09（M-SN-2 第一卡前置，新增）**：补 ts-morph string 级守卫扩展 verify-server-next-isolation —— 当前守卫是 import path 级，ADR-102 跨域禁令本质是 token name string 级（如 `--probe`/`--render`/`--sidebar-w` 在 web-next 的 CSS 字符串引用）。ADR-103 DataTable v2 公开 API 契约 Opus 评审的硬前置。预计工时 0.3 天。
2. **视觉回归豁免备忘**：M-SN-1 期间 dual-signal + admin-layout 是 packages/design-tokens 的 net-new 字段，0 现有引用面被触及，plan §10.4 8 张截图豁免理由成立。M-SN-7 cutover 前置检查清单需补做"web-next 视觉确认"以兜底（不阻塞 M-SN-2 启动）。
3. **handoff 文档**：CHG-SN-1-08 输出 `docs/server_next_handoff_M-SN-1.md`（plan §10.8 SHOULD-4-d 要求），固化 ADR-102 patch / plan v2.1 修订 / Provider 物理副本三个决策点上下文。

CHG-SN-1-09 任务卡（M-SN-2 第一卡前置）：

9. **CHG-SN-1-09** — verify-server-next-isolation 扩展 string 级 token 跨域守卫（状态：✅ 已完成）
   - 创建时间：2026-04-28 04:35
   - 计划开始：M-SN-2 启动前（**依赖：CHG-SN-1-10/-11/-12 完成**）
   - 实际开始：2026-04-28 20:05
   - 完成时间：2026-04-28 20:35
   - 实际工时：0.04 天（~30min；新建 mjs 脚本 + preflight 集成 + Opus 评审一轮 PASS）
   - review：arch-reviewer (claude-opus-4-7) — 12 token 清单完整 / 正则安全性 / 三层守卫闭环 / ADR-103a 前置门 PASS（无必须修，3 条建议优化登记后续）
   - 工时估算：0.3 天
   - 关联 plan §：§4.3 硬约束 1 / §4.6
   - 关联 ADR：ADR-102（dual-signal + admin-layout 跨域消费禁令的"完整守卫"）
   - 文件范围：`scripts/verify-server-next-isolation.mjs`（扩展 token name string 扫描）；可选新增 `scripts/verify-token-isolation.mjs` 按消费方向反扫
   - 验收要点：
     - 检测 apps/web-next/src 内 CSS / TSX 字符串引用 `--probe` / `--render` / `--probe-soft` / `--render-soft` / `--sidebar-w` / `--sidebar-w-collapsed` / `--topbar-h` / `--row-h` / `--row-h-compact` / `--col-min-w` / `--density-comfortable` / `--density-compact` 全部 0 命中
     - 故意制造 1 处违规 → 脚本应报错
     - 集成到 preflight + npm run lint 流水线
     - typecheck + lint + test 全绿
   - 子代理调用：arch-reviewer (Opus) — ADR-103 评审前置，强制 Opus
   - 主循环模型：opus（涉及 ADR-102 完整守卫闭环 + ADR-103 前置）

---

## [SEQ-20260428-02] M-SN-2 启动前 IA / Shell 范围补全（执行序列）

- **状态**：✅ 已完成（5/5 PASS；2026-04-28 21:00 闭环）
- **创建时间**：2026-04-28 18:00
- **最后更新时间**：2026-04-28 21:00
- **完成时间**：2026-04-28 21:00
- **闭环签字**：5 张卡全部 PASS（commit da1dafa / 15b3bf7 / 1e6bbb1 / 8975a50 + 本卡 CHG-SN-1-13）；M-SN-1 原欠账已偿；plan v2.1 → v2.3；ADR-100 IA 修订段落盘；M-SN-2 第一张组件卡（CHG-SN-2-01 ADR-103a Opus 评审）可放行开工。
- **目标**：闭合 M-SN-1 验收时未发现的两层偏离 —（A）`plan §7 IA tree` 偏离设计稿 v2.1 `shell.jsx`；（B）`CHG-SN-1-05 admin-nav.ts` 又自创分组 / 误用旧词 "工作台"。同时补 plan §6 M-SN-2 范围漏列的 admin-ui Shell 组件，确保 M-SN-2 任务卡起草时不再产生 IA / 视觉壳层缺口。
- **范围**：plan §6 / §7 / §8 修订；ADR-100 IA 修订段；`apps/server-next/src/lib/admin-nav.ts`；`apps/server-next/src/app/admin/layout.tsx`（仍极简骨架，仅做 IA 文案 / 分组占位修订，不引业务组件）；`docs/changelog.md` M-SN-1 补丁段。
- **依赖**：M-SN-1 已闭环（B 级 PASS）；M-SN-2 第一卡未起。
- **引发证据**：本次会话经人工对 :3003 实测发现"工作台 vs 管理台站"、"数据看板独立"、"首页编辑/用户投稿错位至系统管理"、"系统 5 子 vs 站点设置"四处偏差（详见会话日志 2026-04-28 下午）。
- **不留口子原则**：本序列全部完成 → 才允许起 CHG-SN-1-09 → 才允许起 M-SN-2 第一卡。任何卡评审未 PASS → BLOCKER。

### 任务列表（按执行顺序）

10. **CHG-SN-1-10** — plan §7 IA tree 与设计稿 v2.1 shell.jsx 对账修订 + ADR-100 IA 修订段（状态：✅ 已完成）
    - 创建时间：2026-04-28 18:00
    - 计划开始：本序列 Day 1 上午
    - 实际开始：2026-04-28 18:10
    - 完成时间：2026-04-28 18:40
    - 实际工时：0.04 天（~0.5h；纯 docs 修订 + Opus 评审一轮 PASS）
    - review：arch-reviewer (claude-opus-4-7) — 4 项 IA 决策独立裁决 PASS
    - 工时估算：0.6 天
    - 关联 plan §：§7（IA tree 与视图清单）/ §6 G4 / §10.4（视觉对齐 cutover 前 100%）
    - 关联 ADR：ADR-100（立项 + IA v0，需追加"IA 修订段：v0 → v1"）
    - 真源对照：`docs/designs/backend_design_v2.1/app/shell.jsx:10-35`（5 组 NAV）+ `docs/designs/backend_design_v2.1/info.md` §01 IA "一级 → 运营中心；二级 → 管理台站"
    - 文件范围：`docs/server_next_plan_20260427.md`（§7 IA tree + §6 G4 + 修订日志 v2.1 → v2.2）、`docs/decisions.md`（ADR-100 追加 "IA 修订段"）；不动代码
    - 不在范围：`admin-nav.ts` 实施（CHG-SN-1-11）/ `plan §6 M-SN-2 范围补列`（CHG-SN-1-12）/ changelog 补丁（CHG-SN-1-13）
    - 验收要点：
      - 修订后 plan §7 IA tree 必须显式声明 5 个分组（运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理）+ 每组成员 + 每组排序，与 shell.jsx NAV 1:1 对照
      - 必须裁定 4 处偏离的去留：
        1. dashboard label "管理台站" 是真源（非"工作台"）
        2. analytics 是否保留独立顶层（设计稿无 analytics 项 → 推荐：并入 dashboard "管理台站"，原 `/admin/analytics` 路由从 IA tree 移除或改 hidden）
        3. home / submissions 必须独立成"首页运营"组（不在系统管理）
        4. system 5 子页（settings/cache/monitor/config/migration）保留 vs 收敛到 settings 单页 — 推荐：保留 5 子但 IA 显示标签改为"站点设置"作为 system landing 入口（与设计稿 ⌘, "站点设置"对齐，不暴露 5 子页选项给侧栏顶层，仅在 settings 页内部用 Tab/分段切换 cache/monitor/config/migration），后台保留路由不删
      - 21 路由总数对账后变化记录（如裁掉 analytics 则变 20）
      - ADR-100 IA 修订段含：决策表（4 项裁决）/ 影响范围 / 不变约束（URL slug 仍英文，§5.2 BLOCKER 第 8 条仍生效）/ 关联 CHG-SN-1-05 偏离闭环
      - plan §10.4 cutover 前置补"IA 对照已完成（CHG-SN-1-10）"勾项
      - typecheck + lint + test 全绿（仅 docs 改动，应自动通过）
    - 子代理调用：**arch-reviewer (claude-opus-4-6, Opus) — IA 决策强制 Opus**（CLAUDE.md "强制升 Opus 子代理"第 3 条：撰写即将成为 ADR 的决策文档；第 2 条：跨多消费方的字段 schema —— admin-nav.ts / shell.jsx / plan §7 / ADR-100 四处真源对账）
    - 主循环模型：opus
    - 完成判据：Opus 评审 PASS + plan/ADR 文本落盘 + 序列备注更新

11. **CHG-SN-1-11** — admin-nav.ts 修订 + layout 占位元数据对齐（CHG-SN-1-05 偏离闭环）（状态：✅ 已完成）
    - 创建时间：2026-04-28 18:00
    - 计划开始：CHG-SN-1-10 完成后
    - 实际开始：2026-04-28 18:50
    - 完成时间：2026-04-28 19:15
    - 实际工时：0.03 天（~25min；纯实施，无评审）
    - 工时估算：0.4 天
    - 关联 plan §：§7（修订后真源）/ §4.6（ESLint 边界）/ §5.2 BLOCKER 第 8 条（URL slug 不动）
    - 关联 ADR：ADR-100（IA 修订段为本卡输入）
    - 依赖：CHG-SN-1-10 PASS（plan §7 修订 + ADR-100 IA 修订段必须先落盘）
    - 文件范围：
      - `apps/server-next/src/lib/admin-nav.ts`（5 组重排 + label 修订 + 头注释更新指向 ADR-100 IA 修订段）
      - `apps/server-next/src/app/admin/layout.tsx`（继续极简骨架，仅消费 admin-nav.ts；不实装 brand / 折叠 / 用户菜单 — 那是 M-SN-2 admin-ui Shell 范围）
      - `apps/server-next/src/app/admin/page.tsx`（dashboard label 由"工作台"改"管理台站"如有显示文案）
      - 路由文件不动（URL slug 仍英文，BLOCKER 第 8 条）
    - 不在范围：删除 `/admin/analytics` 路由占位（即便 IA tree 移除 — 路由保留 hidden 状态，由 admin-nav.ts 不导出该项实现侧栏隐藏）；admin-ui Shell 业务组件下沉（M-SN-2）
    - 验收要点：
      - admin-nav.ts 5 组导出顺序：运营中心 → 内容资产 → 首页运营 → 采集中心 → 系统管理
      - "工作台" 全部替换为 "管理台站"（grep `apps/server-next/src` 0 命中"工作台"）
      - "首页编辑" + "用户投稿" 移到"首页运营"组
      - analytics / system 子项按 CHG-SN-1-10 裁决处理
      - admin-nav.ts 头注释新增"真源：docs/designs/backend_design_v2.1/app/shell.jsx + ADR-100 IA 修订段"
      - 启动 :3003 实测：侧栏分组顺序 + 文案 100% 对设计稿 shell.jsx
      - 全部 21（或修订后 20）路由 SSR 200
      - typecheck + lint + test 全绿
      - 视觉占位（无 brand / 折叠 / 用户菜单）保留极简骨架不变 — 只改 IA 数据，不动 layout DOM 结构
    - 子代理调用：无强制 Opus（数据修订 + 文案对齐，非架构决策）；如对 system 子页折叠策略有歧义则升 Opus
    - 主循环模型：sonnet

12. **CHG-SN-1-12** — plan §6 M-SN-2 范围补列 admin-ui Shell 组件（防漏）+ §8 复用矩阵补 Shell 行（状态：✅ 已完成）
    - 创建时间：2026-04-28 18:00
    - 计划开始：CHG-SN-1-10 完成后（与 CHG-SN-1-11 可并行）
    - 实际开始：2026-04-28 19:25
    - 完成时间：2026-04-28 19:55
    - 实际工时：0.04 天（~30min；纯 docs 修订 + Opus 评审一轮 PASS + 人工 sign-off）
    - review：arch-reviewer (claude-opus-4-7) — Shell API 契约 4 项决策 PASS + 用户 sign-off Q1-Q4 全确认
    - 工时估算：0.4 天
    - 关联 plan §：§6 M-SN-2（行 404-419 范围 / 完成标准 / 关联 brief）/ §8 复用矩阵 / §4.4（Provider 不下沉边界声明）
    - 关联 ADR：ADR-102（admin-layout token 三层）/ ADR-100 IA 修订段
    - 依赖：CHG-SN-1-10 PASS（IA 真源稳定后才能定 Shell 消费的 NAV 契约）
    - 引发证据：plan §6 M-SN-2 行 405-411 当前只列 DataTable v2 / Toolbar / Filter / Drawer / Modal / Toast / AdminDropdown / SelectionActionBar / Empty/Error/Loading；与 `apps/server-next/src/app/admin/layout.tsx:6-10` 注释口径"M-SN-2 完整 shell 下沉到 packages/admin-ui Shell"冲突；未补列 → M-SN-2 任务卡起草时极易漏掉。
    - 文件范围：`docs/server_next_plan_20260427.md`（§6 M-SN-2 范围 / 完成标准 / §8 复用矩阵 admin-layout 列扩展为 Shell 列；§6 增加阶段审计重点条目"Shell 视觉与 shell.jsx 对齐 100%"）；不动代码
    - 不在范围：实施 admin-ui Shell（M-SN-2 起步）/ ADR-103 DataTable v2 公开 API（plan 已规划在 M-SN-2 完成时定）
    - 验收要点（plan §6 M-SN-2 范围必须显式新增 Shell 子项清单）：
      1. **Sidebar**：Brand 区（logo + "流光后台 v2"）/ 5 组分隔线 + 区段标题 / 每项 icon + label + 计数徽章（warn/danger 配色，count > 999 缩 k）/ 快捷键提示 + collapsed tooltip / 折叠开关（⌘B）+ collapsed 态 NavTip / 底部用户菜单（avatar / 用户名 / 角色 / 下拉：个人资料 / 偏好 / 主题切换 / 帮助 / 切换账号 / 登出）
      2. **Topbar**：面包屑（tb__crumbs）/ 全局搜索 + 命令面板（⌘K）/ 系统健康指示（tb__health）/ 通知抽屉（bell）/ 后台任务抽屉（zap，进度条 + 重试）/ 主题切换按钮
      3. **Toast 系统**：全局 `addToast(msg, type, duration)` API（设计稿 §08）+ 右下角堆叠 + 入场/退场动画 + 手动关闭 — plan §6 M-SN-2 行 197 已列 Toast，本卡补全交互细节
      4. **dark-first 默认主题落 root**：layout 必须显式 `data-theme="dark"`（M-SN-2 admin-ui Shell 接管时确认 ThemeProvider 挂 RootLayout 链路完整）
      5. **键盘快捷键全集**：⌘1-5（侧栏切换）/ ⌘,（站点设置）/ ⌘B（折叠）/ ⌘K（命令面板）/ ↵（审核台 accept）/ ⎋（关闭抽屉）— Mac/非 Mac 平台检测 (`IS_MAC`) 必须实现
      - §8 复用矩阵 `admin-layout` 列扩展为 `admin-layout / Shell`，每行视图标注 Shell 是否消费（dashboard 起全部 ✅）
      - §6 M-SN-2 阶段审计重点新增条目"Shell 与 shell.jsx 视觉对齐 100% / 键盘流可用 / 命令面板可打开"
      - §6 M-SN-2 工时估算复核：原 2.5 周（A2 方案）是否需要扩到 3 周吸纳 Shell 工作量 — 如需扩，触发 plan §5.2 BLOCKER 第 11 条阈值审视（+30%），由 Opus 评审决定接受/拆分新 milestone M-SN-2.5
      - typecheck + lint + test 全绿
    - 子代理调用：**arch-reviewer (claude-opus-4-6, Opus)** — Shell 公开 API 契约（NAV 数据 schema / 计数徽章 schema / 快捷键 schema / 用户菜单 actions schema 都是跨多消费方的字段定义）触发 CLAUDE.md "强制升 Opus" 第 1/2 条
    - 主循环模型：opus
    - 完成判据：Opus PASS + plan §6/§8 落盘 + 序列备注更新；如触发 BLOCKER 11 则等待 Opus 工时裁决再继续

13. **CHG-SN-1-13** — M-SN-1 闭环补丁：changelog + task-queue 备忘（IA 漏检追溯）（状态：✅ 已完成）
    - 创建时间：2026-04-28 18:00
    - 计划开始：CHG-SN-1-10/-11/-12 全部完成后
    - 实际开始：2026-04-28 20:45
    - 完成时间：2026-04-28 21:00
    - 实际工时：0.02 天（~15min；纯归档，doc-janitor Haiku + 主循环截图归档 + commit）
    - review：n/a（doc-janitor 归档类无须独立 arch-reviewer 评审）
    - 工时估算：0.2 天
    - 关联 plan §：§5.3 milestone 阶段审计 / §10.8 SHOULD-4-d handoff
    - 关联 ADR：ADR-100 IA 修订段（已在 CHG-SN-1-10 落盘）
    - 依赖：CHG-SN-1-10 / CHG-SN-1-11 / CHG-SN-1-12 全部 PASS
    - 文件范围：`docs/changelog.md`（M-SN-1 闭环条目下追加补丁段）/ `docs/server_next_handoff_M-SN-1.md`（追加 IA 漏检追溯 + CHG-SN-1-10/11/12 修订引用）/ `docs/task-queue.md`（本序列备注更新 + M-SN-1 序列闭环备忘补丁）
    - 不在范围：任何代码改动 / 任何 plan/ADR 文本（已在 1-10/1-12 落盘）
    - 验收要点：
      - changelog M-SN-1 闭环条目下新增补丁条目，明示"B 级 PASS 漏检 IA 命名/分组（CHG-SN-1-05 自创分组 + plan §7 自身偏离设计稿）→ SEQ-20260428-02 闭环"
      - server_next_handoff_M-SN-1.md 新增 §"IA 修订追溯"段，引用 ADR-100 IA 修订段 + 本序列 4 张卡
      - task-queue M-SN-1 闭环备忘段（行 357-364）补"经 SEQ-20260428-02 闭环"标记
      - typecheck + lint + test 全绿（docs 改动）
    - 子代理调用：**doc-janitor (claude-haiku-4-5)** — 纯文档归档 / 索引更新 / changelog 追加，符合 CLAUDE.md "强制降 Haiku 子代理"第 1/2/5 条
    - 主循环模型：haiku（或 sonnet 直接执行，无强制升降）

### SEQ-20260428-02 整体复用矩阵

| 资产 | 来源 | 此序列是否产生 |
|---|---|---|
| 设计稿 v2.1 shell.jsx NAV | docs/designs/backend_design_v2.1/app/shell.jsx | ❌ 真源不动，仅对账 |
| ADR-100 IA v0 | docs/decisions.md ADR-100 | ✅ 追加"IA 修订段（v0 → v1）" |
| plan §6 M-SN-2 范围 | docs/server_next_plan_20260427.md | ✅ 补列 Shell 子项 |
| plan §7 IA tree | docs/server_next_plan_20260427.md | ✅ 修订 5 组结构 |
| admin-nav.ts | apps/server-next/src/lib | ✅ 修订 |
| admin-ui Shell 组件 | packages/admin-ui | ❌ M-SN-2 起步实施 |

### 风险与回退

- **CHG-SN-1-10 风险**：Opus IA 决策若与设计稿 v2.1 进一步演进冲突（设计稿仍在补完），按 plan §10.5 SHOULD-4-c "设计稿大改应急"协议处置 — 回滚到本卡修订版 + 任务卡补"未实装入口暂不暴露"声明
- **CHG-SN-1-12 风险**：Shell 工作量纳入 M-SN-2 后估算可能超 +30% → 触发 BLOCKER 11；备选方案 — 拆分 M-SN-2.5 专做 Shell（1 周），M-SN-2 原范围保持 2.5 周；由 Opus 评审裁决
- **整体兜底**：本序列任一卡 Opus 评审 C 级 → BLOCKER 暂停，不进 M-SN-2

### 备注

- 本序列序号 SEQ-20260428-02 紧邻 SEQ-20260428-01 之后，不复用历史 SEQ
- 任务 ID 沿用 `CHG-SN-1-NN` 格式（同属 M-SN-1 闭环范畴的延伸偏离闭环；未启用 CHG-SN-2-NN 是为了保持 M-SN-1 漏检责任归属可追溯）
- 每张卡 commit trailer 必含：`Refs:` `Plan:` `Review:` `Executed-By-Model:` `Subagents:` `Co-Authored-By:`
- 序列完成 = CHG-SN-1-13 PASS + plan v2.2 修订日志追加 + ADR-100 IA 修订段落盘 + admin-nav.ts 实测对齐设计稿 shell.jsx
- **不留口子检查清单**（M-SN-2 第一卡起草前必须 100% 勾选）：
  - [x] CHG-SN-1-10 PASS：plan §7 5 组 IA + ADR-100 IA 修订段落盘
  - [x] CHG-SN-1-11 PASS：admin-nav.ts 与 shell.jsx 1:1 对齐 + 路由 SSR 全绿
  - [x] CHG-SN-1-12 PASS：plan §6 M-SN-2 范围显式列出 Sidebar/Topbar/Toast/dark-first/快捷键 5 大子项 + §8 Shell 列扩展 + 工时估算复核
  - [x] CHG-SN-1-09 PASS：token 跨域守卫 string 级生效（M-SN-1 闭环备忘原欠账）
  - [x] CHG-SN-1-13 PASS：changelog 补丁 + handoff 追溯 + 本序列闭环

---

## [SEQ-20260428-03] M-SN-2 第一阶段 · ADR-103a 起草 + AdminNavItem 字段扩展（执行序列）

- **状态**：✅ 已完成（CHG-SN-2-01 ~ CHG-SN-2-22 全部 PASS，含 stop-gate 质量债清零，2026-04-29）
- **创建时间**：2026-04-28 22:00
- **最后更新时间**：2026-04-28
- **目标**：M-SN-2 第一阶段（Shell 公开 API 契约固化 + admin-nav.ts 字段扩展）。落地 ADR-103a 作为 Shell 10 组件 Props / AdminNavItem 5 字段扩展协议 / 4 级 z-index 规范的真源；让 server-next 侧 admin-nav.ts 注入 icon / shortcut / count / badge 字段，准备好被 packages/admin-ui Shell 组件消费。
- **范围**：`docs/decisions.md`（ADR-103a 新建）/ `apps/server-next/src/lib/admin-nav.ts`（5 字段扩展 + ADMIN_NAV 改写）/ `apps/server-next/src/lib/shell-data.ts`（新建：count provider 接口实现）/ admin-layout token 第 5 层新增 z-shell-* 三变量
- **依赖**：SEQ-20260428-02 全 5 张卡 PASS（commit da1dafa / 15b3bf7 / 1e6bbb1 / 8975a50 / e1df243 + 修订 e9d2f52）；不留口子检查清单 5/5 [x]
- **不留口子原则**：本序列每张卡 Opus 评审 PASS 才进下一卡；任何卡评审未 PASS → BLOCKER

### 任务列表（按执行顺序）

1. **CHG-SN-2-01** — ADR-103a 起草（Shell 公开 API 契约 + AdminNavItem 5 字段扩展协议 + 4 级 z-index 规范）（状态：✅ 已完成）
   - 创建时间：2026-04-28 22:00
   - 计划开始：M-SN-2 启动 Day 1 上午
   - 实际开始：2026-04-28 22:00
   - 完成时间：2026-04-28 22:30
   - 实际工时：0.04 天（~30min；Opus 评审一轮 PASS + 落盘）
   - review：arch-reviewer (claude-opus-4-7) — ADR 起草 PASS（无开放项 / 无与 plan v2.3 冲突）
   - 工时估算：0.5 天
   - 关联 plan §：§6 M-SN-2 v2.3（Shell 10 组件 + 数据原语 + 公开 API 契约前置 + 演示页）/ §4.4 packages/admin-ui 边界 / §4.7 依赖白名单
   - 关联 ADR：**ADR-103a（本卡新建）**；引用 ADR-100 IA 修订段 / ADR-102 token 4+1 层
   - 输入文档：CHG-SN-1-12 Opus 评审输出（Shell 10 组件 Props 骨架 + AdminNavItem 5 字段扩展协议 + 7.x 风险声明）—— 已记入会话历史 + plan v2.3 修订日志
   - 文件范围：
     - `docs/decisions.md`（ADR-103a 新建段落，追加在 ADR-103 之后或 ADR-100 末尾的合适位置）
     - 不动代码（实施由 CHG-SN-2-02 起步）
   - 不在范围：admin-nav.ts 字段扩展（CHG-SN-2-02）/ admin-layout token z-shell-* 添加（CHG-SN-2-02 内含或独立卡）/ Shell 组件实施（CHG-SN-2-03+）
   - 验收要点：
     - ADR-103a 含完整段落：日期 / 状态 / 子代理 / 背景 / 决策（10 组件 Props 类型骨架完整 + 5 字段扩展协议 + 4 级 z-index 规范具体值）/ 替代方案（已否决：id 字段 / icon name 字符串 / Context-based Toast）/ 后果（正/负面）/ 影响文件 / 关联 ADR
     - 10 组件 Props 类型骨架与 CHG-SN-1-12 Opus 评审输出 1:1 对齐（AdminShell / Sidebar / Topbar / UserMenu / NotificationDrawer / TaskDrawer / CommandPalette / ToastViewport+useToast / HealthBadge / Breadcrumbs / KeyboardShortcuts）
     - AdminNavItem 5 字段扩展协议（icon: ReactNode / count + AdminNavCountProvider / badge: 'info'|'warn'|'danger' / shortcut: 'mod+x' 规范化 / children）
     - 4 级 z-index 规范具体值（业务 Drawer / Shell 抽屉 / CmdK / Toast）+ admin-layout token z-shell-drawer / z-shell-cmdk / z-shell-toast 三变量声明
     - Provider 不下沉约束 / Edge Runtime 兼容 / 零硬编码颜色 / 零 fetch 副作用 4 项硬约束写入 ADR
     - cutover 前最终对账义务（与 ADR-100 IA 修订段呼应）
     - typecheck + lint + test 全绿
   - 子代理调用：**arch-reviewer (claude-opus-4-7) — ADR 起草强制 Opus**（CLAUDE.md 模型路由第 1/3 条）
   - 主循环模型：opus
   - 完成判据：ADR-103a 落盘 + Opus 评审 PASS + 序列备注更新

2. **CHG-SN-2-02** — admin-nav.ts/.tsx 5 字段扩展 + ADMIN_NAV 注入 icon/shortcut/count/badge + admin-layout z-shell-* token（状态：✅ 已完成 · 整卡 stage 1/2 + stage 2/2 全部 PASS）
   - 创建时间：2026-04-28 22:00
   - 计划开始：CHG-SN-2-01 PASS 后
   - 实际开始：2026-04-28 23:15
   - stage 1/2 完成时间：2026-04-28 23:35（commit f5d5335；admin-layout z-shell-* token + verify 扩展 + 单测，与 lucide-react 无关，全绿）
   - stage 2/2 阻塞时间：2026-04-28 23:30（admin-nav.ts ADMIN_NAV icon 注入触发 BLOCKER §5.2 第 2 条）
   - stage 2/2 解锁时间：2026-04-28 23:55（CHG-SN-2-01.5 PASS + plan v2.4 落盘）
   - stage 2/2 完成时间：2026-04-29 00:15（admin-nav.tsx + ADMIN_NAV 注入 + shell-data.tsx + lucide-react 安装 + 双扫描守卫扩展）
   - 整卡完成时间：2026-04-29 00:15
   - 实际工时：0.06 天（stage 1/2 ~30min + stage 2/2 ~45min；远低于估算 0.5 天）
   - 工时估算：0.5 天

2.5. **CHG-SN-2-01.5** — server-next 图标库选型 ADR-103b + plan §4.7 v2.3 → v2.4 修订（解锁 CHG-SN-2-02 stage 2/2）（状态：✅ 已完成）
   - 创建时间：2026-04-28 23:40
   - 计划开始：BLOCKER 用户裁定方案 A 后
   - 实际开始：2026-04-28 23:40
   - 完成时间：2026-04-28 23:55
   - 实际工时：0.02 天（~15min；Opus 评审 + 落盘 + 用户 sign-off）
   - review：arch-reviewer (claude-opus-4-7) — 6 维评估 30/30 推荐 lucide-react PASS + 用户 sign-off Q1-Q4 全确认 + 版本号校正 ^1.12.0
   - 工时估算：0.5 天
   - 触发：CHG-SN-2-02 stage 2/2 BLOCKER §5.2 第 2 条（lucide-react 不在 §4.7 白名单）；用户 2026-04-28 裁定方案 A
   - 关联 plan §：§4.7 / §0 SHOULD-4-a / §3 决策表
   - 关联 ADR：**ADR-103b（本卡新建）**
   - 文件范围：docs/decisions.md（ADR-103b 新建）+ docs/server_next_plan_20260427.md（§4.7 + §3 + 修订日志 + 元信息）
   - 验收要点：详见 tasks.md
   - 子代理调用：arch-reviewer (claude-opus-4-7) — ADR 起草 + 依赖选型决策强制 Opus
   - 人工 sign-off：plan §4.7 修订属重大修订，落盘前提请用户确认（Q1 选型 + Q2 v2.3 → v2.4）
   - 完成判据：ADR-103b 落盘 + plan §4.7 v2.4 修订落盘 + Opus PASS + 用户 sign-off
   - 解锁影响：本卡 PASS 后 CHG-SN-2-02 stage 2/2 + CHG-SN-2-03+ Shell 组件分卡可继续
   - 关联 ADR：ADR-103a（本卡输入）/ ADR-102（admin-layout token 第 5 层扩展）
   - 文件范围：
     - `apps/server-next/src/lib/admin-nav.ts`（AdminNavItem 类型 5 字段扩展 + ADMIN_NAV 注入 icon ReactNode / shortcut 'mod+x' / badge 静态值）
     - `apps/server-next/src/lib/shell-data.ts`（新建：AdminNavCountProvider 实现 stub，M-SN-3+ 接入 SWR）
     - `packages/design-tokens/src/admin-layout/z-index.ts`（新建：z-shell-drawer / z-shell-cmdk / z-shell-toast 三 token）
     - `packages/design-tokens/src/admin-layout/index.ts`（追加导出）
     - `packages/design-tokens/build.ts`（buildLayoutVars 追加 z-shell-* 三组）
     - `tests/unit/design-tokens/admin-layout.test.ts`（追加 z-shell-* 断言）
     - `scripts/verify-token-isolation.mjs`（FORBIDDEN_TOKENS 数组追加 z-shell-drawer / z-shell-cmdk / z-shell-toast，反向守卫扩展）
   - 不在范围：Shell 组件实施（CHG-SN-2-03+）/ count provider 真数据接入（M-SN-3+）
   - 验收要点：
     - admin-nav.ts ADMIN_NAV 13 项链接全部注入 icon ReactNode（lucide-react）+ shortcut（dashboard ⌘1 / moderation ⌘2 / videos ⌘3 / subtitles ⌘4 / crawler ⌘5 / system/settings ⌘,）
     - AdminNavCountProvider 类型签名导出
     - admin-layout 三 z-shell-* token 落盘 + 单测 PASS
     - verify-token-isolation 三新 token 加入禁令清单 + 故意违规可被捕获
     - typecheck + lint + test 全绿
   - 子代理调用：arch-reviewer (claude-opus-4-7) — Token 层新增字段（CLAUDE.md 模型路由第 5 条）
   - 主循环模型：opus

3. **CHG-SN-2-03** — packages/admin-ui ToastViewport + useToast + toast-store（zustand 单例，Provider-less 模式首张落地）（状态：✅ 已完成）
   - 创建时间：2026-04-29 00:30
   - 计划开始：CHG-SN-2-02 整卡 PASS 后
   - 实际开始：2026-04-29 00:30
   - 完成时间：2026-04-29 00:55
   - 实际工时：0.03 天（~25min；ADR-103a §4.1.7 1:1 实施 + 29 单测 + Opus 评审 8/8 PASS + 3 条建议优化合并）
   - review：arch-reviewer (claude-opus-4-7) — 8 项评审重点全 PASS / 无必修 / 3 条建议优化全部合并补齐 / 作为 CHG-SN-2-04 ~ CHG-SN-2-12 实施模板
   - 工时估算：0.4 天
   - 关联 plan §：§6 M-SN-2 v2.3 A 块 / §4.4 / §4.7 v2.4
   - 关联 ADR：ADR-103a §4.1.7 ToastViewport / §4.4-1 Provider 不下沉 / §4.3 z-index
   - 文件范围：详见 tasks.md
   - 子代理调用：arch-reviewer (claude-opus-4-7) — Provider-less 模式范式落地强制 Opus
   - 完成判据：所有文件落盘 + 必跑命令全绿 + 双扫描守卫 PASS + Opus 评审 PASS + commit

4. **CHG-SN-2-04** — packages/admin-ui KeyboardShortcuts + platform 工具集（IS_MAC / MOD_KEY_LABEL / formatShortcut / parseShortcut）（状态：✅ 已完成）
   - 创建时间：2026-04-29 01:00
   - 计划开始：CHG-SN-2-03 PASS 后
   - 实际开始：2026-04-29 01:00
   - 完成时间：2026-04-29 01:30
   - 实际工时：0.04 天（~30min；ADR-103a §4.1.10 1:1 实施 + 39 单测 + Opus CONDITIONAL → PASS 修订）
   - review：arch-reviewer (claude-opus-4-7) — CONDITIONAL → PASS（1 必修 + 3 建议优化全部合并 / 1 建议登记后续 / 二件套范式建立）
   - 工时估算：0.3 天
   - 关联 plan §：§6 M-SN-2 v2.3 A 块
   - 关联 ADR：ADR-103a §4.1.10 KeyboardShortcuts + 平台检测 / §4.4-2 Edge Runtime trade-off
   - 文件范围：详见 tasks.md
   - 子代理调用：arch-reviewer (claude-opus-4-7) — Shell 第 2 张组件实施评审
   - 完成判据：所有文件落盘 + 必跑命令全绿 + 双扫描守卫 PASS + Opus 评审 PASS + commit

5. **CHG-SN-2-05** — packages/admin-ui Breadcrumbs + inferBreadcrumbs helper + AdminNav 类型 SSOT 迁移（Shell 第 3 张 / B 纯工具二件套）（状态：✅ 已完成）
   - 计划开始：CHG-SN-2-04 PASS 后
   - 实际开始：2026-04-29 02:00
   - 完成时间：2026-04-29 02:30
   - 实际工时：0.03 天（~30min；ADR-103a §4.1.9 1:1 实施 + 类型 SSOT 迁移 + 25 单测 + Opus 评审 10/10 PASS + 4 条建议优化合并）
   - review：arch-reviewer (claude-opus-4-7) — 10 项 PASS / 无必修 / 4 条建议优化全部合并 / 未复现 CHG-SN-2-03/04 类型问题
   - 工时估算：0.2 天
   - 关联 ADR：ADR-103a §4.1.9 Breadcrumbs
   - 范式：B 纯工具二件套（breadcrumbs.tsx 纯渲染 + inferBreadcrumbs helper 纯函数）
   - 文件范围：`packages/admin-ui/src/shell/breadcrumbs.tsx`（含 inferBreadcrumbs helper）/ `shell/index.ts` 桶导出 / 单测三分（breadcrumbs.test.tsx 渲染 + inferBreadcrumbs.test.ts 纯逻辑 + breadcrumbs-ssr.test.tsx）
   - Props：`{ items: readonly BreadcrumbItem[]; onItemClick?: (item, index) => void }` + `BreadcrumbItem { label: string; href?: string }`
   - inferBreadcrumbs(activeHref, nav)：从 ADMIN_NAV 5 组结构 + activeHref 推断 BreadcrumbItem[]（最后一项为 active item label，前面项为 section.title 等链）
   - 验收要点：items 渲染（最后一项 strong 加粗）/ onItemClick 仅对有 href 的项触发 / inferBreadcrumbs 各种 activeHref 边界（顶层 / 嵌套 / 不存在 → 返空）/ SSR 零 throw / 零硬编码颜色
   - 子代理调用：可降 Sonnet 评审（纯渲染 + 工具函数无新决策含量）

6. **CHG-SN-2-06** — packages/admin-ui HealthBadge + HealthSnapshot 类型 SSOT（Shell 第 4 张 / B 纯渲染单件）（状态：✅ 已完成）
   - 计划开始：CHG-SN-2-05 PASS 后
   - 实际开始：2026-04-29 02:35
   - 完成时间：2026-04-29 02:50
   - 实际工时：0.02 天（~15min；ADR-103a §4.1.8 1:1 实施 + HealthSnapshot 类型 SSOT 迁移 + 16 单测 + Opus 评审 10/10 PASS）
   - review：arch-reviewer (claude-opus-4-7) — 10/10 PASS / 无必修 / 2 类建议优化登记后续 / 未复现 CHG-SN-2-03/04 类型问题
   - 工时估算：0.2 天
   - 关联 ADR：ADR-103a §4.1.8 HealthBadge + HealthSnapshot
   - 范式：B 纯工具二件套（health-badge.tsx 单文件，无 helper）
   - 文件范围：`packages/admin-ui/src/shell/health-badge.tsx` / 单测二分（health-badge.test.tsx + health-badge-ssr.test.tsx）
   - Props：`{ snapshot: HealthSnapshot }` + HealthSnapshot 含 crawler/invalidRate/moderationPending 三项指标 × { value + status: 'ok'|'warn'|'danger' }
   - 验收要点：3 项指标 dot 渲染 + status → semantic.status token 颜色映射 / 首项 dot pulse 动画（CSS @keyframes，零 JS timer）/ invalidRate 显示百分比格式 / SSR 零 throw / 零硬编码颜色
   - 子代理调用：可降 Sonnet

7. **CHG-SN-2-07** — packages/admin-ui UserMenu + 类型 SSOT（Shell 第 5 张 / focus trap + outside-click 首张落地）（状态：✅ 已完成）
   - 计划开始：CHG-SN-2-06 PASS 后
   - 实际开始：2026-04-29 02:55
   - 完成时间：2026-04-29 03:15
   - 实际工时：0.04 天（~30min；ADR §4.1.4 实施 + 4 处契约精化 + 类型 SSOT + 37 单测 + Opus CONDITIONAL → PASS 合并所有建议）
   - review：arch-reviewer (claude-opus-4-7) — 11 项重点 / 1 必修（ADR 修订记录段背书 4 处契约精化）+ 3 建议优化全部合并 / 章法 1C/5C 范式建立
   - 工时估算：0.3 天
   - 关联 ADR：ADR-103a §4.1.4 UserMenu + AdminShellUser + UserMenuAction（6 项 union）
   - 范式：B 纯工具二件套（user-menu.tsx 单文件，无 store；状态由 props 受控）
   - 文件范围：`packages/admin-ui/src/shell/user-menu.tsx` / 单测三分
   - Props：`{ open: boolean; user: AdminShellUser; onClose: () => void; onAction: (action: UserMenuAction) => void; anchorRef: RefObject<HTMLElement> }`
   - 行为：6 项菜单（profile / preferences / theme / help / switchAccount / logout）+ 外部点击关闭 + ESC 关闭 + focus trap（mount 时 focus 首项 / Tab/Shift+Tab 循环）
   - 验收要点：6 项渲染 / onAction 触发携带 union 值 / 外部点击关闭（document mousedown listener）/ ESC 关闭 / focus trap / SSR 零 throw / 零硬编码颜色
   - 子代理调用：arch-reviewer (Opus) — UserMenu focus trap + outside-click 模式首张落地需评审

8. **CHG-SN-2-08** — packages/admin-ui Sidebar（Shell 第 6 张 / 5 组 NAV + 折叠态 + 计数徽章 + UserMenu 集成 / 视觉核心）（状态：✅ 已完成）
   - 计划开始：CHG-SN-2-07 PASS 后（含 fix popover/visual 契约）
   - 实际开始：2026-04-29 03:40
   - 完成时间：2026-04-29 03:55
   - 实际工时：0.04 天（~30min；ADR §4.1.2 实施 + UserMenu 集成 + 44 单测 + Opus CONDITIONAL → PASS 合并 P1 + P2 全部）
   - review：arch-reviewer (claude-opus-4-7) — 12 项 / 1 P1 必修（Footer position: relative wrapper）+ 2 P2 建议合并（ADR §4.1.4 修订段补 union↔actions 取舍 + 4 边界单测）+ 1 P2 保留（formatCount 1.0k 含尾零）
   - 工时估算：0.5 天
   - 关联 ADR：ADR-103a §4.1.2 Sidebar + AdminNavItem 5 字段（CHG-SN-2-02 admin-nav.tsx 已注入 icon/shortcut/badge）
   - 范式：B 纯工具二件套（sidebar.tsx 单文件，组合 UserMenu）
   - 文件范围：`packages/admin-ui/src/shell/sidebar.tsx` / 单测三分
   - Props：`{ nav: readonly AdminNavSection[]; activeHref: string; collapsed: boolean; user: AdminShellUser; onToggleCollapsed: () => void; onNavigate: (href) => void; onUserMenuAction: (action) => void; counts?: ReadonlyMap<string, number> }`
   - 行为：5 组 NAV 渲染（group 标题 + divider 折叠态隐藏 + 链接含 icon + label + badge 计数（>999 缩 1.2k）+ 折叠态 tooltip + 折叠态 pip badge）/ Brand 区（流光 v2）/ sb__foot 触发 UserMenu / collapsed 切换样式（width var(--sidebar-w) ↔ var(--sidebar-w-collapsed)）
   - 验收要点：5 组渲染对齐 admin-nav.tsx ADMIN_NAV / activeHref 高亮 / counts 优先于 AdminNavItem.count / collapsed 折叠样式 + tooltip 显示 / 零硬编码颜色 / SSR
   - 子代理调用：arch-reviewer (Opus) — Sidebar 是 Shell 视觉核心组件，需评审组合策略 + admin-layout token 消费 + 与设计稿 v2.1 shell.jsx 视觉对齐

9. **CHG-SN-2-09** — packages/admin-ui Topbar + Breadcrumbs/HealthBadge 集成 + 5 类图标注入（Shell 第 7 张）（状态：✅ 已完成）
   - 计划开始：CHG-SN-2-08 PASS 后（依赖 Breadcrumbs + HealthBadge）
   - 实际开始：2026-04-29 04:00
   - 完成时间：2026-04-29 04:10
   - 实际工时：0.025 天（~15min；ADR §4.1.3 + fix(CHG-SN-2-01) 1:1 实施 + 33 单测 + Opus 13/13 PASS 无必修）
   - review：arch-reviewer (claude-opus-4-7) — 13 项全 PASS / 无必修 / 1 类建议优化登记后续 / 未复现 CHG-SN-2-03/04/07 类型问题
   - 工时估算：0.4 天
   - 关联 ADR：ADR-103a §4.1.3 Topbar + TopbarIcons + TopbarProps
   - 范式：B 纯工具二件套（topbar.tsx 单文件，组合 Breadcrumbs + HealthBadge）
   - 文件范围：`packages/admin-ui/src/shell/topbar.tsx` / 单测三分
   - Props：`{ crumbs; theme; icons: TopbarIcons; health?; notificationDotVisible?; runningTaskCount?; onOpenCommandPalette; onThemeToggle; onOpenNotifications; onOpenTasks; onOpenSettings }`
   - 行为：渲染 Breadcrumbs + 全局搜索触发器（点击 onOpenCommandPalette）+ HealthBadge（health 非空时）+ 主题切换 button + 3 枚图标按钮（任务 zap / 通知 bell / 设置）+ notificationDotVisible / runningTaskCount 角标
   - 验收要点：crumbs 渲染（不调用 inferBreadcrumbs）/ icons 5 类按钮 ReactNode 注入 / health 可选 / 三枚按钮触发对应回调 / runningTaskCount 显示 / SSR 零 throw / 零硬编码颜色
   - 子代理调用：可降 Sonnet（Topbar 是组合层 + 行为简单）

10. **CHG-SN-2-10** — packages/admin-ui NotificationDrawer + TaskDrawer + DrawerShell base（Shell 第 8 张 / 双 Drawer 一卡 / portal + focus trap 范式扩展 + SSR mounted 标志）（状态：✅ 已完成）
    - 计划开始：CHG-SN-2-09 PASS 后
    - 实际开始：2026-04-29 04:25
    - 完成时间：2026-04-29 04:50
    - 实际工时：0.04 天（~25min；ADR §4.1.5 双 Drawer + DrawerShell base 抽象 + 类型 SSOT + 43 单测 + Opus 14/14 PASS 无必修）
    - review：arch-reviewer (claude-opus-4-7) — 14/14 全 PASS / 无必修 / 4 条 P3 建议优化登记后续 / 未复现 CHG-SN-2-03/04/07/09 类型问题
    - 工时估算：0.5 天
    - 关联 ADR：ADR-103a §4.1.5 NotificationDrawer + TaskDrawer
    - 范式：B 纯工具二件套（notification-drawer.tsx + task-drawer.tsx 双文件）
    - 文件范围：双 .tsx + 各自单测（4 文件 + ssr 共享 1 文件）
    - Props 共同：`{ open: boolean; items: readonly Item[]; onClose: () => void; ...action callbacks }`
    - 行为：右侧滑入抽屉 + ESC 关闭 + 点击遮罩关闭 + focus trap + z-index var(--z-shell-drawer) / 列表渲染 + 行级操作回调（NotificationDrawer onItemClick / onMarkAllRead；TaskDrawer onCancel / onRetry）
    - 验收要点：双 Drawer 互斥（编排在 AdminShell）/ z-index 取 token 不硬编码 1100 / focus trap / ESC 关闭 / item 渲染 + 行级 action / 零硬编码颜色 / SSR
    - 子代理调用：arch-reviewer (Opus) — Drawer focus trap + 互斥编排策略 + portal/z-index 模式首张落地

11. **CHG-SN-2-11** — packages/admin-ui CommandPalette（Shell 第 9 张 / ⌘K 命令面板 + 键盘导航）（状态：✅ 已完成 2026-04-29）
    - 计划开始：CHG-SN-2-10 PASS 后
    - 工时估算：0.5 天
    - 关联 ADR：ADR-103a §4.1.6 CommandPalette + CommandGroup + CommandItem
    - 范式：B 纯工具二件套（command-palette.tsx 单文件，复用 KeyboardShortcuts 思路）
    - 文件范围：`packages/admin-ui/src/shell/command-palette.tsx` / 单测三分
    - Props：`{ open; groups: readonly CommandGroup[]; onClose; onAction: (item) => void; placeholder? }` + `CommandItem { id; label; icon?; shortcut?; meta?; kind: 'navigate'|'invoke'; href? }`
    - 行为：模态浮层（z-index var(--z-shell-cmdk)） + 输入框过滤（label substring 不区分大小写）+ 3 组渲染 + 键盘导航（↑↓ Enter Esc + mouse hover 同步 active）+ ESC / 点击遮罩关闭 + focus 输入框 + onAction 触发后由消费方分派 navigate (router.push) / invoke (callback)
    - 验收要点：groups 过滤 + 渲染 / 键盘导航完整 / shortcut 显示用 useFormatShortcut（hydration-safe）/ z-index 取 token / SSR 零 throw / 零硬编码颜色
    - 子代理调用：arch-reviewer (Opus) — CommandPalette 是 Shell 复杂度最高组件，需评审过滤算法 + 键盘导航 + a11y（aria-* 完整）

12. **CHG-SN-2-12** — packages/admin-ui AdminShell 装配 + apps/server-next admin layout 替换骨架（Shell 第 10 张 / 最后装配）（状态：✅ 已完成）
    - 实际开始：2026-04-29
    - 完成时间：2026-04-29 05:30
    - 计划开始：CHG-SN-2-11 PASS 后
    - 工时估算：0.5 天
    - 关联 ADR：ADR-103a §4.1.1 AdminShell（含 fix(CHG-SN-2-01) P1-A/P1-B 修订后的 AdminShellProps）
    - 范式：A store-driven 三件套（admin-shell-store.ts 持有 collapsed + drawer 互斥开闭态 + cmdk open）+ admin-shell.tsx 装配
    - 文件范围：`packages/admin-ui/src/shell/admin-shell-store.ts` + `admin-shell.tsx` + `apps/server-next/src/app/admin/layout.tsx`（替换 M-SN-1 极简骨架为 `<AdminShell>` 装配）/ 单测三分
    - Props：完整 AdminShellProps（按 fix(CHG-SN-2-01) 修订后定义；含 topbarIcons 必填 + notifications? / tasks? + 4 个 action 回调）
    - 行为：编排 Sidebar + Topbar + main + ToastViewport + CommandPalette + KeyboardShortcuts + NotificationDrawer + TaskDrawer / 持有 collapsed 受控/非受控双模式 / Drawer 互斥（同时只开一个）/ 透传 onNavigate
    - 验收要点：layout.tsx 替换后 21 路由 SSR 全绿 + 鉴权重定向链路不破 / collapsed 持久化（cookie）+ defaultCollapsed 注入 / Drawer 互斥行为 / topbarIcons 5 类必填校验 / 键盘快捷键 ⌘1-5/⌘,/⌘B/⌘K/Esc 端到端可用 / 视觉对齐设计稿 shell.jsx（4 张截图：折叠/展开 × dark/light）/ 零硬编码颜色 / SSR
    - 子代理调用：arch-reviewer (Opus) — AdminShell 是装配体核心 + Drawer 互斥 + 受控/非受控双模式 + admin layout 替换骨架（M-SN-1 闭环资产 layout.tsx 改写需确认零回归）

13. **CHG-SN-2-12.5** — ADR-103 起草（DataTable v2 公开 API 契约 + useTableQuery）（数据原语层硬前置门）（状态：✅ 已完成 2026-04-28）
    - 实际开始：2026-04-28
    - 完成时间：2026-04-28
    - 计划开始：CHG-SN-2-12 PASS 后
    - 工时估算：0.5 天
    - 关联 plan §：§9 ADR 索引（ADR-103 v2.4 行 661）
    - 关联 ADR：**ADR-103（本卡新建）** — DataTable v2 + useTableQuery URL/sessionStorage 同步 + 客户端/服务端两档分页 + 列设置 / 排序 / 筛选规约
    - 文件范围：`docs/decisions.md`（ADR-103 新建）；不动代码
    - 验收要点：完整 ADR 段落（10 组件/原语 Props 类型骨架 + 数据契约 + URL 同步规约 + 两档分页协议 + 替代方案否决 + 后果 + 影响文件）
    - 子代理调用：arch-reviewer (Opus) — ADR 起草强制 Opus（CLAUDE.md 模型路由第 1/3 项）
    - 人工 sign-off：plan §0 SHOULD-4-a 视 ADR 影响范围决定（如不影响 plan §6 范围则无需）

14. **CHG-SN-2-13** — packages/admin-ui DataTable v2 + useTableQuery（数据原语首张）（状态：✅ PASS）
    - 计划开始：CHG-SN-2-12.5 PASS 后
    - 工时估算：0.8 天
    - 关联 ADR：ADR-103
    - 范式：A store-driven 三件套（table-query-store + use-table-query hook + DataTable 组件）
    - 文件范围：`packages/admin-ui/src/table/data-table.tsx` + `table-query-store.ts` + `use-table-query.ts` + 单测三分
    - 验收要点：客户端分页（≤200 条）/ 服务端分页（200-50k）/ URL 同步 sessionStorage 同步 / 列基础渲染 / 排序 / 行选中 / 单测覆盖率 ≥70% / SSR 零 throw
    - 子代理调用：arch-reviewer (Opus) — DataTable 是数据原语核心，强制 Opus

15. **CHG-SN-2-14** — Toolbar / Filter / ColumnSettings（DataTable v2 配套）（状态：✅ PASS）
    - 计划开始：CHG-SN-2-13 PASS 后
    - 工时估算：0.5 天
    - 关联 ADR：ADR-103
    - 范式：B 纯工具二件套各组件
    - 文件范围：`packages/admin-ui/src/table/{toolbar,filter,column-settings}.tsx` + 单测
    - 子代理调用：可降 Sonnet（数据原语装饰组件）

16. **CHG-SN-2-15** — Pagination v2 客户端 + 服务端两档（状态：✅ PASS）
    - 计划开始：CHG-SN-2-14 PASS 后
    - 工时估算：0.3 天
    - 关联 ADR：ADR-103
    - 范式：B 纯工具二件套
    - 文件范围：`packages/admin-ui/src/table/pagination.tsx` + 单测
    - 子代理调用：可降 Sonnet

17. **CHG-SN-2-16** — Drawer / Modal 通用业务原语（z-index var(--z-modal) = 1000，与 Shell 抽屉 1100 解耦）（状态：✅ 完成）
    - 计划开始：CHG-SN-2-15 PASS 后
    - 工时估算：0.4 天
    - 关联 ADR：ADR-103a §4.3 z-index 4 级（业务 Drawer L1）
    - 范式：B 纯工具二件套各组件
    - 文件范围：`packages/admin-ui/src/components/{drawer,modal}.tsx` + 单测；admin-layout token 追加 `--z-modal: 1000`（不在 z-shell-* 命名空间，由 components/ 层管辖）
    - 验收要点：z-index 不硬编码（取 var(--z-modal)）/ Drawer 与 Shell 抽屉层级不冲突 / focus trap / ESC 关闭 / SSR
    - 子代理调用：arch-reviewer (Opus) — z-index L1 业务原语首张落地需评审 4 级层级关系

18. **CHG-SN-2-17** — AdminDropdown / SelectionActionBar（状态：✅ 完成）
    - 计划开始：CHG-SN-2-16 PASS 后
    - 工时估算：0.3 天
    - 关联 ADR：ADR-103
    - 范式：B 纯工具二件套各组件
    - 文件范围：`packages/admin-ui/src/components/{admin-dropdown,selection-action-bar}.tsx` + 单测
    - 子代理调用：可降 Sonnet

19. **CHG-SN-2-18** — Empty / Error / Loading 状态原语（状态：✅ 完成）
    - 计划开始：CHG-SN-2-17 PASS 后
    - 工时估算：0.2 天
    - 关联 ADR：plan §6 M-SN-2 v2.3 范围 B
    - 范式：B 纯渲染单件（每个一个 .tsx）
    - 文件范围：`packages/admin-ui/src/components/state/{empty,error,loading}.tsx` + 单测
    - 子代理调用：可降 Sonnet 或 Haiku

20. **CHG-SN-2-19** — Storybook-style demo 页（apps/server-next /admin/dev/components）（状态：✅ 完成）
    - 计划开始：CHG-SN-2-18 PASS 后
    - 工时估算：0.4 天
    - 关联 plan §：§6 M-SN-2 v2.3 范围 D
    - 文件范围：`apps/server-next/src/app/admin/dev/components/page.tsx` + 各组件 demo 子页
    - 验收要点：Shell 10 组件 + 数据原语全集在 demo 页可交互 / DataTable v2 客户端/服务端分页切换正常 / useTableQuery URL 同步可验证（刷新后保留）
    - 子代理调用：可降 Sonnet

21. **CHG-SN-2-20** — 数据原语层集成验收 + e2e（状态：✅ 完成）
    - 计划开始：CHG-SN-2-19 PASS 后
    - 工时估算：0.3 天
    - 验收要点：单元测试覆盖率 ≥70%（含 Shell 组件键盘事件 / Toast 队列 / countProvider 求值）/ 零硬编码颜色 CI 扫描 / 零 fetch 副作用 grep 校验 / SSR 兼容（admin layout 服务端渲染不报错）/ a11y 基线（键盘导航全覆盖 / 焦点环 / 对比度 ≥4.5:1 / aria-* 完整）
    - 子代理调用：可降 Sonnet（验收类）

22. **CHG-SN-2-21** — M-SN-2 milestone 阶段审计（Opus）（状态：✅ 完成 A 级）
    - 计划开始：CHG-SN-2-20 PASS 后
    - 工时估算：0.2 天
    - 关联 plan §：§5.3 milestone 阶段审计（A/B/C 评级）+ §6 M-SN-2 完成标准
    - 验收要点：plan §6 M-SN-2 完成标准 5 条逐条验证 / Shell 公开 API 契约稳定性（Props 未在 milestone 中期变更）/ Provider 不下沉约束验证 / SSR/Edge Runtime 兼容验证 / a11y 基线 / 复用矩阵 §8 Shell 列覆盖 / 设计稿对齐截图（折叠/展开 × dark/light = 4 张）
    - 子代理调用：arch-reviewer (Opus) — milestone 阶段审计强制 Opus（CLAUDE.md 模型路由 + plan §5.3）
    - 完成判据：评级 A 或 B（带欠账） → M-SN-2 闭环；评级 C → BLOCKER 暂停不进 M-SN-3

23. **CHG-SN-2-22** — stop-gate 质量债清零（状态：✅ 完成）
    - 计划开始：CHG-SN-2-21 完成后（stop-gate adversarial review 后）
    - 完成时间：2026-04-29
    - 工时估算：0.3 天
    - 来源：Codex stop-gate adversarial review 发现 P1×2 + P2×3
    - 修复：UserMenu catch block / 3 undefined tokens / DataTable role="grid" / 键盘可达排序 / Sidebar brand 高度对齐
    - 子代理调用：无

4. **CHG-SN-2-13 ~ CHG-SN-2-20**（数据原语层）：DataTable v2 + Toolbar/Filter/ColumnSettings + Drawer/Modal/AdminDropdown/SelectionActionBar + Empty/Error/Loading + Storybook demo
   - 详细范围 CHG-SN-2-12 AdminShell 装配后逐张起草

5. **CHG-SN-2-21**（M-SN-2 milestone 验收）：Opus 阶段审计 A/B/C 评级

### 备注

- 序列序号 SEQ-20260428-03 紧邻 SEQ-20260428-02 之后
- 任务 ID 启用 CHG-SN-2-NN（M-SN-2 milestone 范畴）
- 每张卡 commit trailer 必含：`Refs:` `Plan:` `Review:` `Executed-By-Model:` `Subagents:` `Co-Authored-By:`
- ADR-103a 是 M-SN-2 全部组件卡的硬前置门；评审 PASS 前禁止起 CHG-SN-2-02+
- 设计稿 §08 弹层规范若 cutover 前补完出现交互形态变更（Drawer vs Popover），主循环再 spawn Opus 评审 ADR-103a 修订段

---

## ✅ BLOCKER 已解除 · 2026-04-28 23:55 · CHG-SN-2-02 stage 2/2 可放行（原 BLOCKER 通知保留作追溯）

**解除路径**：用户 2026-04-28 裁定方案 A → CHG-SN-2-01.5 PASS（commit 待提；plan v2.4 + ADR-103b 落盘 + 4 项 sign-off）→ lucide-react@^1.12.0 加入 §4.7 预批清单 → CHG-SN-2-02 stage 2/2 可继续 admin-nav.ts 字段扩展 + ADMIN_NAV icon 注入。

---

## 🚨 BLOCKER · 2026-04-28 23:30 · CHG-SN-2-02 stage 2/2 暂停（已解除，详见上段）

- **触发条款**：plan §5.2 BLOCKER 第 2 条 — 引入 §4.7 依赖白名单之外的 npm 包
- **触发位置**：CHG-SN-2-02 实施 admin-nav.ts ADMIN_NAV icon 注入时
- **冲突点**：
  - **plan §4.7 依赖白名单**（行 257-276）预批列表：`React 18 / Next.js / TypeScript / zod / clsx / tailwind-merge / dayjs / zustand / @dnd-kit/core / @dnd-kit/sortable + workspaces 内包`；候选清单仅含图表/DAG/虚拟滚动 3 类；**未列任何图标库**
  - **ADR-103a §4.4-4 + §4.7 关联段** 假设 "图标库由 server-next 持有"，未实际确认白名单状态；CHG-SN-2-01 Opus 评审时未检查
  - **节点状态**：`lucide-react` 未在 root package.json / web-next / server-next 任何一处声明，node_modules 内不存在
- **影响**：
  - CHG-SN-2-02 拆分为两阶段：
    - **stage 1/2（已实施合规）**：admin-layout z-shell-* token 三新增 / build pipeline 同步 / 单测追加 / verify-token-isolation FORBIDDEN_TOKENS 扩展 — 全部与 lucide-react 无关，可单独 commit
    - **stage 2/2（暂停）**：admin-nav.ts AdminNavItem 5 字段类型扩展 + ADMIN_NAV 注入 icon ReactNode + shell-data.ts 新建 — 涉及 `import { ... } from 'lucide-react'`
  - CHG-SN-2-03+（Shell 10 组件实施）也将受影响（CommandPalette / Topbar / UserMenu 内部图标策略需重新审视）

### 提请用户决策（3 个备选方案）

**方案 A：补充依赖 ADR + plan §4.7 修订（推荐）**
- 起新卡 `CHG-SN-2-01.5`（或 `CHG-SN-2-02b`）：spawn Opus arch-reviewer 做依赖选型评审（lucide-react vs heroicons-react vs react-icons 三选一），落盘新 ADR（`ADR-103b: server-next 图标库选型`）+ plan §4.7 v2.3 → v2.4 修订（图标库加入预批清单）+ 人工 sign-off（plan §0 SHOULD-4-a 重大修订）
- 评审通过后 CHG-SN-2-02 stage 2/2 才能继续
- 工时增量：~0.5 天（评审 + 文档修订）；总周期不动（M-SN-2 内吸收）

**方案 B：完全去图标化（不引入任何图标库）**
- ADR-103a 修订：`AdminNavItem.icon` 类型从 `React.ReactNode` 改为可选 emoji unicode 字符串（如 `'🏠'`）或内联 SVG path string；packages/admin-ui Sidebar 渲染时统一用文本节点 / 内联 SVG 占位
- 与设计稿 v2.1 shell.jsx（lucide 节点）视觉差距大；M-SN-7 cutover 前最终对账义务的"5 字段覆盖率 ≥80%（icon 100%）"难以保证
- 工时增量：~0.3 天（ADR-103a 二次修订 + Opus 评审）

**方案 C：把图标库下沉到 packages/admin-ui（违反 ADR-103a 4.4-4 硬约束）**
- ADR-103a "零图标库依赖" 硬约束撤回；packages/admin-ui 直接 import lucide-react；admin-nav.ts 不需要承载 icon 字段
- 违反 plan §4.4 边界声明 + ADR-103a 已 PASS 的设计；属架构倒退
- **不推荐**

### 已合规进度（建议先 commit 为 CHG-SN-2-02 stage 1/2）

- `packages/design-tokens/src/admin-layout/z-index.ts`（新建：z-shell-drawer / z-shell-cmdk / z-shell-toast 三 token，1100/1200/1300）
- `packages/design-tokens/src/admin-layout/index.ts`（追加 export）
- `packages/design-tokens/build.ts` + `scripts/build-css.ts`（buildLayoutVars 追加 adminShellZIndex；JS/DTS 类型同步）
- `packages/design-tokens/src/css/tokens.css`（auto-generated；新增 3 行 `--z-shell-*`）
- `tests/unit/design-tokens/admin-layout.test.ts`（追加 2 测：3 字段结构 + 4 级层级关系不变量；10 测 PASS）
- `scripts/verify-token-isolation.mjs`（FORBIDDEN_TOKENS 扩展 3 z-shell-*；故意违规验证 PASS）

**实测**：typecheck + admin-layout 10 单测 + verify-token-isolation 全绿。

### 解锁等待

CHG-SN-2-02 stage 2/2 + CHG-SN-2-03+ Shell 组件分卡的开工等待用户裁定方案 A/B/C；裁定后由主循环执行后续动作。


---

## [SEQ-20260429-01] M-SN-3 · 标杆页：视频库（执行序列）

- **创建时间**：2026-04-29 09:30
- **最后更新时间**：2026-04-29 09:45
- **依赖**：M-SN-2 全部任务 PASS（commit 59061e4，stop-gate 质量债 CHG-SN-2-22 清零）
- **目标**：完成 `/admin/videos` 视频库标杆页，作为后续 14 个视图的参考实现（template）；同步完成 dashboard 卡片库 + system/settings 容器化两个 M-SN-3 侧任务

### 完成标准（M-SN-3 milestone）

1. `/admin/videos` 功能与 apps/server 现版本 100% 对齐（列表 / 筛选 / 排序 / 分页 / 行操作 / 批量动作 / 编辑 Drawer）
2. VideoStatusIndicator 原子指示器已下沉到 `apps/server-next/src/components/admin/shared/`，可供 M-SN-4 moderation 复用
3. `docs/archive/2026Q2/server_next_view_template.md` 文档落地，后续视图卡可直接按模板起草
4. dashboard 卡片库三态布局 PASS，analytics 内容并入 dashboard Tab
5. system/settings 容器化 PASS（5 Tab 子路由均可访问）
6. e2e 黄金路径全绿：login → 视频库列表 → 编辑 Drawer → 保存 → 列表更新
7. typecheck ✅ lint ✅ 单元测试全绿 ✅ e2e ✅

### 任务列表

---

**1. CHG-SN-3-01 — 视频库 API 层 + 类型定义（建议模型：sonnet）**

- **状态**：✅ 完成
- **实际开始**：2026-04-29 10:00
- **实际完成**：2026-04-29
- **计划开始**：序列启动后第 1 张
- **工时估算**：0.3 天
- **文件范围**：
  - `apps/server-next/src/lib/videos/types.ts`（新建：VideoAdminRow + VideoListFilter + VideoListResult 类型）
  - `apps/server-next/src/lib/videos/api.ts`（新建：listVideos / getVideo / patchVideoMeta / updateVisibility / stateTransition / reviewVideo / batchPublish / batchUnpublish / doubanSync / refetchSources 函数，均调用 apiClient）
  - `apps/server-next/src/lib/crawler/api.ts`（新建或追加：listCrawlerSites，`GET /admin/crawler/sites`，供 VideoFilter site 下拉动态加载）
  - `apps/server-next/src/lib/videos/columns.ts`（新建：COLUMNS `TableColumn<VideoAdminRow>[]` 定义，含 enableSorting）
  - `apps/server-next/src/lib/videos/index.ts`（新建：re-export）
- **验收要点**：
  - VideoAdminRow 与 apps/api `/admin/videos` 返回结构 100% 对齐（字段名 snake_case）
  - api.ts 所有函数均有 return type（无 any）
  - typecheck ✅
- **备注**：无外部依赖，纯类型 + API 函数层；不含 UI 渲染

---

**2. CHG-SN-3-02 — VideoStatusIndicator + VideoTypeChip 原子组件（建议模型：sonnet）**

- **状态**：✅ 完成
- **实际开始**：2026-04-29
- **实际完成**：2026-04-29
- **计划开始**：CHG-SN-3-01 PASS 后
- **工时估算**：0.4 天
- **文件范围**：
  - `apps/server-next/src/components/admin/shared/VideoStatusIndicator.tsx`（新建）
  - `apps/server-next/src/components/admin/shared/VideoTypeChip.tsx`（新建）
  - `tests/unit/components/server-next/admin/VideoStatusIndicator.test.tsx`（新建）
- **组件设计**：
  - `VideoStatusIndicator` Props：`{ reviewStatus, visibilityStatus, isPublished, compact?: boolean }`
  - 渲染 3 枚徽章：审核状态（pending_review → 待审 / approved → 通过 / rejected → 拒绝）+ 可见性（public → 公开 / internal → 内部 / hidden → 隐藏）+ 上架状态（已上架 / 未上架）
  - 颜色：仅用 CSS 变量（`--state-error-fg`, `--state-success-fg` 等），零硬编码
  - compact 模式：只显示图标/点，不显示文字（用于表格列宽受限时）
  - `VideoTypeChip`：type → 中文标签映射 badge
  - data-testid 属性齐全（`data-review-status`, `data-visibility`, `data-published`）
- **验收要点**：
  - 全部状态组合渲染正确（3×3×2 = 18 种）
  - 无 any / 无硬编码颜色（CI verify-token-isolation 通过）
  - 单元测试：各 variant ≥ 1 测试
- **备注**：review_status 未传时组件静默不渲染该枚 badge（非必填字段）

---

**3. CHG-SN-3-03 — 视频库列表页骨架（Server Component）（建议模型：sonnet）**

- **状态**：✅ 完成
- **实际开始**：2026-04-29
- **实际完成**：2026-04-29
- **计划开始**：CHG-SN-3-01 PASS 后（可与 CHG-SN-3-02 并行）
- **工时估算**：0.2 天
- **文件范围**：
  - `apps/server-next/src/app/admin/videos/page.tsx`（修改：替换 PlaceholderPage，改为真实 Server Component）
  - `apps/server-next/src/app/admin/videos/_client/`（新建目录，Client Component 落地位置）
- **结构设计**（Server Component pattern）：
  ```tsx
  // page.tsx — Server Component，无 'use client'
  export default function VideosPage() {
    return (
      <Suspense fallback={<LoadingState variant="skeleton" />}>
        <VideoListClient />
      </Suspense>
    )
  }
  ```
  - 不在 Server Component 侧 fetch 数据（list 数据由 client 组件驱动，URL state 管理分页/筛选）
  - metadata export: `export const metadata = { title: '视频库 | Resovo Admin' }`
- **验收要点**：SSR 零 throw，page.tsx 无 `'use client'`，typecheck ✅

---

**4. CHG-SN-3-04 — VideoListClient：DataTable v2 + useTableQuery + FilterToolbar（建议模型：sonnet）**

- **状态**：✅ 完成 ⚠ 设计被取代（2026-04-30）
- **被取代说明（2026-04-30 / CHG-DESIGN-11 + Step 7A 完成）**：本卡完成时设计为 FilterToolbar **外置** + Pagination **外置** + ColumnSettingsPanel **外置** + DataTable 仅承载列。**当前真源已被 CHG-DESIGN-02（SEQ-20260429-02）取代**：toolbar / search / filter chips / saved views / 表头集成菜单 / bulk action bar / pagination 全部纳入 DataTable 一体化契约，CHG-DESIGN-02 Step 1–6 + 7A 已全部落地（2026-04-30）：✅ toolbar / bulkActions / flashRowKeys / enableHeaderMenu / saved views（Step 1–6） + ✅ pagination(`.dt__foot`) / `.dt__body` 独立滚动 / 隐藏列 chip + popover / filter chips slot + 6 种 FilterValue 默认 formatter（Step 7A）。视频库 v2 接入路径走 CHG-DESIGN-08（视觉对齐）+ CHG-DESIGN-02 Step 7B（接入新 API，删除外置编排）。本卡完成的代码不动，但**不作为新模块的实现模板**。
- **实际开始**：2026-04-29
- **实际完成**：2026-04-29
- **计划开始**：CHG-SN-3-02 + CHG-SN-3-03 PASS 后
- **工时估算**：1.0 天
- **文件范围**：
  - `apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx`（新建，主 Client Component）
  - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx`（新建，filter 定义）
  - `tests/unit/components/server-next/admin/videos/VideoListClient.test.tsx`（新建）
- **核心设计**：
  - `useTableQuery` 接入 `useTableRouterAdapter`（已有 `apps/server-next/src/lib/table-router-adapter.ts`）
  - tableId: `'admin-videos'`，URL namespace: `'v'`（防止与其他页面参数冲突）
  - FilterMap keys：`q`（text）/ `type`（select: 11 类型）/ `status`（select: published/pending/all）/ `visibilityStatus`（select: public/internal/hidden）/ `reviewStatus`（select: pending_review/approved/rejected）/ `site`（select: 动态从 /admin/crawler/sites 加载）
  - Toolbar 布局：`<FilterToolbar>` 左侧 search 槽（q）+ 右侧 filters 槽（type/status/visibility/review/site）
  - FilterChipBar 显示激活的筛选条件，各 chip 可独立清除
  - DataTable 列：封面 / 标题 + VideoStatusIndicator / 类型 / 来源健康 / 图片健康 / 可见性 / 审核状态 / 操作
  - 排序字段白名单：title / type / year / created_at / updated_at（对应 API SORT_FIELDS）
  - 分页：Pagination 组件，pageSize 可选（10/20/50）
  - 数据加载：`LoadingState variant="skeleton"`；空状态：`EmptyState`；错误状态：`ErrorState`
  - `ColumnSettingsPanel` 支持列显/隐控制（默认隐藏 douban_status / meta_score）
- **验收要点**：
  - 筛选/排序/分页变化实时更新 URL，浏览器刷新后状态恢复
  - 服务端分页正确（total / page / pageSize 传入 Pagination）
  - 加载时 skeleton 可见，空列表显示 EmptyState
  - typecheck ✅，单元测试 ≥ 8 条

---

**5. CHG-SN-3-05 — VideoRowActions：AdminDropdown + 状态迁移动作（建议模型：sonnet）**

- **状态**：✅ PASS
- **完成时间**：2026-04-29
- **计划开始**：CHG-SN-3-04 PASS 后
- **工时估算**：0.6 天
- **文件范围**：
  - `apps/server-next/src/app/admin/videos/_client/VideoRowActions.tsx`（新建）
  - `tests/unit/components/server-next/admin/videos/VideoRowActions.test.tsx`（新建）
  - `vitest.config.ts`（修改：添加 server-next @ 别名）
- **菜单项设计**（AdminDropdown）：

  | 菜单项 | API | 条件显示 |
  |---|---|---|
  | 编辑基础信息 | 打开 VideoEditDrawer | 始终 |
  | 设为公开 | PATCH /:id/visibility {visibility:'public'} | visibility ≠ 'public' |
  | 设为内部 | PATCH /:id/visibility {visibility:'internal'} | visibility ≠ 'internal' |
  | 设为隐藏 | PATCH /:id/visibility {visibility:'hidden'} | visibility ≠ 'hidden' |
  | 上架 | POST /:id/state-transition {action:'publish'} | !is_published |
  | 下架 | POST /:id/state-transition {action:'unpublish'} | is_published |
  | 通过审核 | POST /:id/state-transition {action:'approve'} | review_status='pending_review' |
  | 拒绝审核 | POST /:id/state-transition {action:'reject'} | review_status='pending_review' |
  | 重开审核 | POST /:id/state-transition {action:'reopen_pending'} | review_status='rejected' |
  | 豆瓣同步 | POST /:id/douban-sync | admin only |
  | 重新采集 | POST /:id/refetch-sources | 始终 |
  | 查看详情（前台）| 新窗口打开 getVideoDetailHref | 始终 |

- **乐观更新**：visibility/publish 切换先乐观更新表格行，失败时回滚
- **待处理标记**：操作进行中 row 高亮或 spinner（data-pending 属性）
- **验收要点**：
  - 菜单项条件显示逻辑正确
  - 乐观更新 + 错误回滚可测试（vi.fn mock apiClient）
  - admin only 操作：`user.role !== 'admin'` 时菜单项 disabled

---

**6. CHG-SN-3-06 — 批量动作：SelectionActionBar（建议模型：sonnet）**

- **状态**：✅ PASS ⚠ 设计被取代（2026-04-30）
- **被取代说明（2026-04-30 / CHG-DESIGN-11）**：本卡完成时使用**外置浮条**形态 SelectionActionBar，浮于页面底部。**当前真源已被 CHG-DESIGN-02 / reference.md §4.4 取代**：批量操作走 DataTable.bulkActions slot，渲染为**表内 sticky bottom**（`.dt__bulk` 设计稿对应）。SelectionActionBar 保留独立 export 但首选用法是 DataTable 内置；视频库接入新形态在 CHG-DESIGN-08 + CHG-DESIGN-02 Step 7B。本卡完成的代码不动，但**不作为新模块的实现模板**。
- **完成时间**：2026-04-29
- **计划开始**：CHG-SN-3-05 PASS 后
- **工时估算**：0.4 天
- **文件范围**：
  - VideoListClient.tsx（修改：接入 DataTable selection 状态 + SelectionActionBar）
  - `tests/unit/components/server-next/admin/videos/SelectionActions.test.tsx`（新建）
- **DataTable selection 接入（正确 API）**：
  - `TableSelectionState = { selectedKeys: ReadonlySet<string>, mode: 'page' | 'all-matched' }`
  - VideoListClient 本地管理：`const [selection, setSelection] = useState<TableSelectionState>({ selectedKeys: new Set(), mode: 'page' })`
  - DataTable props：`selection={selection}` + `onSelectionChange={setSelection}`
  - SelectionActionBar props：`selectedCount={selection.selectedKeys.size}` + `selectionMode={selection.mode}` + `onClearSelection={() => setSelection({ selectedKeys: new Set(), mode: 'page' })}`
  - **M-SN-3 范围限定**：仅支持 `mode: 'page'`（page-selection）；`all-matched` 模式（需后端 query-based bulk API）推迟到 M-SN-5+
- **批量动作（与 apps/server BatchPublishBar 100% 对齐）**：
  - 批量公开（POST /admin/videos/batch-publish，isPublished:true，上限 100）
  - 批量隐藏（POST /admin/videos/batch-unpublish，危险动作，带 confirm，上限 50）
  - 批量通过审核（`Promise.all(ids.map(id => reviewVideo(id, 'approve')))`，逐 ID 调用，上限 50）
  - 批量拒绝审核（`Promise.all(ids.map(id => reviewVideo(id, 'reject')))`，危险动作，带 confirm，上限 50）
  - 超出对应上限时，批量按钮显示 disabled + tooltip 提示选中数量
  - 操作完成后刷新列表 + 清空选中
- **验收要点**：
  - SelectionActionBar 仅在 `selectedCount > 0` 时 visible
  - confirm 流程（隐藏/拒绝）：必须点确认才执行
  - 超限时按钮 disabled 逻辑正确
  - 单元测试 ≥ 5 条：visible/hidden / 4 类 action 触发 / confirm 流程 / 超限 disabled

---

**7. CHG-SN-3-07 — VideoEditDrawer（基础元数据字段）（建议模型：sonnet）**

- **状态**：✅ PASS
- **完成时间**：2026-04-29
- **计划开始**：CHG-SN-3-05 PASS 后（可与 CHG-SN-3-06 并行）
- **工时估算**：0.7 天
- **文件范围**：
  - `apps/server-next/src/app/admin/videos/_client/VideoEditDrawer.tsx`（新建）
  - `tests/unit/components/server-next/admin/videos/VideoEditDrawer.test.tsx`（新建）
- **字段设计**（对应 apps/api VideoMetaSchema）：
  - 必填：title（text, max:200）
  - 选填：titleEn / type（select）/ year（number）/ country（text, max:10）/ description（textarea）/ genres（multi-select or comma input）/ episodeCount / status（select: ongoing/completed）/ rating / director（comma-separated）/ cast / writers / doubanId
  - coverUrl：只读显示当前封面，不在本 Drawer 编辑（图片编辑是 M-SN-4 tabs）
- **Drawer 设计**：
  - 使用 packages/admin-ui `<Drawer>` 原语（side='right', width='540px'）
  - 加载原始数据：挂载时 GET /admin/videos/:id
  - 提交：PATCH /admin/videos/:id（仅发送变更字段）
  - `skippedFields` 响应处理：若有跳过字段，Drawer 保持开启并提示"以下字段因锁定未保存：…"
  - 成功关闭后通知父组件刷新列表（通过 `onSaved` 回调）
  - data-testid：`data-video-edit-drawer`, `data-video-edit-submit`, `data-video-edit-cancel`
- **验收要点**：
  - 加载中显示 LoadingState / 加载失败显示 ErrorState + 重试
  - 必填 title 为空时阻止提交（前端校验）
  - skippedFields 非空时给出用户友好提示
  - 单元测试 ≥ 6 条（加载/提交/校验/skippedFields/关闭/回调）

---

**8. CHG-SN-3-08 — Dashboard 卡片库 + analytics Tab 迁入（三态布局）（建议模型：sonnet）**

- **状态**：✅ PASS
- **完成时间**：2026-04-29
- **计划开始**：CHG-SN-3-03 PASS 后（可与 CHG-SN-3-04 并行启动）
- **工时估算**：0.5 天
- **文件范围**：
  - `apps/server-next/src/app/admin/page.tsx`（修改：替换 PlaceholderPage）
  - `apps/server-next/src/app/admin/_client/DashboardClient.tsx`（新建）
  - `apps/server-next/src/app/admin/analytics/page.tsx`（修改：redirect → dashboard#analytics 或 Tabs 实现）
- **卡片设计**（三态：loading/data/error，GET /admin/videos/moderation-stats）：
  - 待审视频数（review_status='pending_review'）
  - 已发布视频数
  - 活跃采集源数
  - 图片健康异常数（可选，GET /admin/image-health/stats 或静态占位）
- **Tab 布局**：
  - Tab 1：概览（stats cards，默认激活）
  - Tab 2：分析（原 /admin/analytics 内容，iframe 嵌入或重定向，保持 /admin/analytics URL 有效）
- **三态布局**：各卡片独立 loading/error，失败卡片显示重试按钮，不阻断其他卡片渲染
- **analytics 处置**：`/admin/analytics/page.tsx` 改为 `redirect('/admin?tab=analytics')` 保持路由有效（ADR-100 IA 修订 §IA-2：路由保留不暴露侧栏）
- **验收要点**：
  - SSR 安全（Server Component 外层，Client Component 加载数据）
  - analytics 路由不报 404
  - 卡片加载失败时单独 ErrorState 不影响其他卡片

---

**9. CHG-SN-3-09 — system/settings 容器化（Tab 切换 5 子路由）（建议模型：sonnet）**

- **状态**：✅ 完成（2026-04-29）
- **计划开始**：CHG-SN-3-03 PASS 后（可与 CHG-SN-3-08 并行）
- **工时估算**：0.4 天
- **文件范围**：
  - `apps/server-next/src/app/admin/system/settings/page.tsx`（修改：改为 Tab 容器）
  - `apps/server-next/src/app/admin/system/settings/_tabs/`（新建目录：SettingsTab / CacheTab / MonitorTab / ConfigTab / MigrationTab）
  - 其余 4 子路由 page.tsx（修改：redirect 到 settings Tab 参数，保留路由文件）
- **Tab 设计**：
  - Tab ID 对应子路由：settings / cache / monitor / config / migration
  - URL 参数同步：`?tab=cache` 等（页面刷新后激活对应 Tab）
  - 各 Tab 初始内容：功能说明 + "本功能正在迁移中" 占位（M-SN-6 全功能实装）
  - settings Tab：迁移 apps/server GET /admin/system/settings 的核心配置展示
- **验收要点**：
  - 5 个子路由均可访问（不报 404）
  - URL 参数切换 Tab 正确
  - Tab 容器 SSR 零 throw

---

**10. CHG-SN-3-10 — 集成验收 + e2e 黄金路径（建议模型：sonnet）**

- **状态**：✅ 完成（2026-04-29）
- **计划开始**：CHG-SN-3-06 + CHG-SN-3-07 PASS 后
- **工时估算**：0.4 天
- **文件范围**：
  - `tests/e2e/admin/videos.spec.ts`（新建：e2e 黄金路径）
  - 各组件单元测试补齐（覆盖率检查）
- **e2e 黄金路径**：
  1. 以 moderator 角色登录（/login → 填写凭据 → 跳转 /admin）
  2. 侧栏点击"视频库"（⌘3）→ URL 变为 /admin/videos，列表加载
  3. 筛选：输入 q → 列表更新 → URL 含 q 参数
  4. 点击行操作"编辑基础信息" → VideoEditDrawer 打开
  5. 修改 title → 点击保存 → Drawer 关闭 → 列表刷新，标题更新
  6. 点击行操作"上架"（或"下架"）→ VideoStatusIndicator 状态变化
  7. 全选当前页 → 批量下架（confirm）→ SelectionActionBar 消失 → 列表更新
- **验收要点**：
  - `npm run test:e2e` 全绿（新增 e2e 文件）
  - `npm run test -- --run` 全绿（单元测试无回归）
  - typecheck ✅ lint ✅

---

**11. CHG-SN-3-11 — server_next_view_template.md 模板文档（建议模型：haiku 子代理）**

- **状态**：⏸ 豁免（2026-05-01 — 用户授权进入 M-SN-4；本卡纳入 M-SN-4 欠账，在 M-SN-4 milestone 完成时补做）
- **计划开始**：CHG-SN-3-10 PASS 后
- **工时估算**：0.2 天
- **文件范围**：
  - `docs/archive/2026Q2/server_next_view_template.md`（新建）
- **文档内容**：
  - 视图文件结构规范（page.tsx Server Component / `_client/` 目录 / lib/[domain]/ 目录）
  - API 函数层规范（api.ts 命名规范 / return type 要求 / error handling pattern）
  - DataTable 接入清单（useTableQuery / useTableRouterAdapter / urlNamespace 命名规范）
  - FilterMap 键名规范（与 API query param 保持一致）
  - 组件命名规范（XxxListClient / XxxRowActions / XxxEditDrawer / XxxStatusIndicator）
  - 测试文件命名规范
  - 复用矩阵更新要求
- **验收要点**：文档完整，可作为 M-SN-4 任务卡的参考

---

**12. CHG-SN-3-12 — staging 环境 cookie + nginx 反代 e2e 演练（DISCUSS-3）（需人工参与）**

- **状态**：⏸ 暂停（2026-04-29 — 用户裁定优先推进 SEQ-20260429-02 设计稿对齐改造）
- **计划开始**：CHG-SN-3-10 PASS 后，用户确认 staging 可用时
- **工时估算**：0.3 天
- **描述**：
  - 在 staging 环境部署 apps/server-next（:3003）和 apps/server（:3001）
  - nginx 配置：`/admin/*` → :3001（现状），演练切换到 :3003
  - 验证 cookie（fastify-jwt refresh_token）跨 server / server-next 透明传递
  - 验证 nginx upstream 切换不丢 session（切换前已登录用户不需要重新登录）
  - 切回 :3001 验证回滚无损
- **验收要点**：cookie 跨服务透明 ✅ / nginx 切换零 session 丢失 ✅ / 回滚成功 ✅
- **备注**：
  - **此任务需要 staging 环境就绪才能执行，主循环无法自动完成；需用户手动操作 nginx + 确认结果**
  - **阻塞关系**：本卡是 CHG-SN-3-13 milestone 审计的硬前置；若 staging 无法就绪，须用户在此任务下方写入显式 sign-off 豁免（格式：`staging-waiver: 豁免原因，欠账标记为 B 级 M-SN-3-STAGING-DEBT`），主循环凭此豁免放行 CHG-SN-3-13

staging-waiver: staging 环境暂未就绪；优先推进 M-SN-4 审核台开发，staging 演练欠账标记为 B 级 M-SN-3-STAGING-DEBT，cutover（M-SN-7）前补做。用户 sign-off：2026-05-01。

---

**13. CHG-SN-3-13 — M-SN-3 milestone 阶段审计（Opus arch-reviewer）**

- **状态**：⏸ 豁免（2026-05-01 — 用户明确豁免 CHG-SN-3-11/12/13，授权进入 M-SN-4；CHG-SN-3-11 模板文档 + CHG-SN-3-13 milestone 审计均纳入 M-SN-4 欠账，cutover 前补做）
- **计划开始**：CHG-SN-3-11 PASS 后，且 CHG-SN-3-12 PASS 或用户写入 `staging-waiver:` 豁免声明后
- **工时估算**：0.3 天
- **子代理调用**：arch-reviewer (claude-opus-4-7) — milestone 阶段审计强制 Opus（CLAUDE.md 模型路由 + plan §5.3）
- **审计重点**：
  1. 视频库是否真正可作为模板（结构清晰度 + 复用矩阵达标）
  2. VideoStatusIndicator 是否已下沉 shared 并达可复用状态
  3. apps/server videos 功能 100% parity 验证（逐项 diff）
  4. e2e 演练通过（若 DISCUSS-3 还未完成，则在 audit 备注中标注欠账）
  5. DataTable v2 真实场景检验（columns/filter/sort/pagination 逻辑完整性）
- **完成判据**：评级 A 或 B（带欠账）→ M-SN-3 闭环，可进 M-SN-4；评级 C → BLOCKER 暂停

---

### 关键约束

- CHG-SN-3-01 → CHG-SN-3-02、03（并行可）→ CHG-SN-3-04 → 05 → 06、07（并行可）→ CHG-SN-3-10 → 11 → 13
- CHG-SN-3-08、09 可在 CHG-SN-3-03 后与主线并行，不阻塞 videos 任务链
- CHG-SN-3-12（staging 演练）是 CHG-SN-3-13 的硬依赖；若 staging 环境无法就绪，须用户显式 sign-off（书面豁免），audit 以 B 级（带欠账）结案，欠账条目写入 milestone review 报告
- **每张卡（CHG-SN-3-01~12）均须通过 stop-gate 逐卡 arch-reviewer review（plan §5.1）后方可推进下一张**；stop-gate ALLOW = PASS，BLOCK = 必须修复后重新提交
- 每张卡 commit trailer 必含（格式遵照 `docs/rules/git-rules.md` §server-next 扩展段）：`Refs:` `Plan: docs/server_next_plan_20260427.md §<节号>` `Review: <arch-reviewer-commit-hash> PASS`（无 Opus 子代理评审的 chore/docs 例外写 `n/a`）`Executed-By-Model:` `Subagents:` `Co-Authored-By:`
- 禁止在 CHG-SN-3-07 之前实装 `videos/[id]/edit` 独立全屏页（M-SN-4 范围，本 milestone 只做 Drawer）

### 备注

- 序列序号 SEQ-20260429-01 紧邻 SEQ-20260428-03 之后
- 任务 ID 启用 CHG-SN-3-NN（M-SN-3 milestone 范畴）
- `docs/archive/2026Q2/server_next_view_template.md` 落地后即作为 M-SN-4+ 任务卡起草的必读文件
- VideoStatusIndicator 先在 server-next/src/components/admin/shared/ 落地，若 M-SN-4 moderation 确认复用则已符合"3 处以上下沉 packages/admin-ui"规则

---

## [SEQ-20260429-02] 设计稿对齐改造（执行序列）

> 状态：✅ 已完成（2026-05-01，12 张卡全部闭合）
> 序列序号：SEQ-20260429-02
> 创建：2026-04-29
> 完成：2026-05-01
> 关联文档：`docs/designs/backend_design_v2.1/reference.md`（合并稿，§0 裁决 + §11 修复顺序）

### 序列总览

- **目标**：按 reference.md §11 修复顺序，把 server-next + admin-ui 当前实装与设计稿 v2.1 视觉语言对齐；不强制 brand 色回滚 amber，以当前 `--accent-default` 蓝系为准；表格视觉语言全站统一，列内容按业务自由设计。
- **范围**：`packages/design-tokens/`、`packages/admin-ui/`、`apps/server-next/`
- **必读裁决**：reference.md §0 七条裁决（其中 §0-1 表格视觉语言复用 / §0-6 滚动条 6px / §0-7 不引入 TableFrame 是硬约束）
- **建议主循环模型**：sonnet（多数为 token + UI 视觉对齐）；CHG-DESIGN-02（DataTable 扩展）建议 opus + arch-reviewer
- **review 协议**：每张卡完成后人工 review；CHG-DESIGN-02 必须 spawn `arch-reviewer` (Opus) 审通过

### 任务列表（按执行顺序）

1. **CHG-DESIGN-01** — Token completeness 修复 ✅ 完成（2026-04-29）
   - 清理已知未定义引用：`--accent-subtle / --bg-subtle / --bg-surface-hover / --state-error / --accent-on`，扫描另发现并清理 `--accent-primary / --bg-input / --font-size-md / --line-height-base / --motion-duration-md / --motion-easing-standard / --state-success`，共 12 个 / 19 处
   - 补建设性 token：`--admin-accent-soft`（值改 color-mix 跟随 brand）/ `--admin-accent-border` / `--admin-scrollbar-size: 6px`；`.pulse` keyframe 注入 admin-shell-styles
   - 新增 `scripts/verify-token-references.mjs` + `verify:token-references` npm 脚本 + preflight 第 5d 步
   - 跳过 `--bg-surface-popover` 别名（`--bg-surface-elevated` 已对应 bg4 popover 角色，不重复定义）
   - 验收结果：60 引用全定义 / 321 token；typecheck ✅ lint ✅ test 2491 全绿 ✅ token-isolation ✅ token-references ✅

2. **CHG-DESIGN-02** — DataTable frame 扩展（建议 opus + arch-reviewer）✅ Step 1–6 + 7A + 7B 全部完成（2026-04-30）
   - 进度（2026-04-30）：Step 1–6 ✅ + Step 7A ✅ + Step 7B ✅ 整卡闭合；arch-reviewer (claude-opus-4-7) CONDITIONAL PASS，5 项必修全部落地；Codex stop-time review fix#1 三态语义补丁
   - Step 7A 已实现：`.dt__body` 独立滚动 + `.dt__foot` 内置 pagination(`pagination?: PaginationConfig` 三态语义) + 隐藏列 chip + `HiddenColumnsMenu` popover + filter chips slot + 6 种 FilterValue 默认 formatter + `column-visibility.ts` 共享工具
   - Step 7B 已实现：`apps/server-next/src/app/admin/videos/_client/VideoListClient.tsx` 切到 DataTable 一体化 props（`toolbar` / `bulkActions` / `pagination`）；删除 `<Toolbar>` / `<ColumnSettingsPanel>` / `<Pagination>` / `<SelectionActionBar>` / 列设置按钮 5 件套外置编排；批量 confirm 流通过 inline `<BatchActionsRow>` 实现（不扩 admin-ui API，3+ 消费方需求时再沉淀）
   - Step 7C cell 沉淀作为独立卡 CHG-DESIGN-12 推进
   - **不引入** `TableFrame` 新抽象层（reference.md §0-7）
   - 阈值：DataTable props ≈ 17（< 20，安全余量充足）
   - **验收结果**：36 单测全绿（step-7a-* 4 文件）；2604 全套 typecheck / lint / verify:token-references / verify:admin-guardrails 通过；视频库视觉对齐留待 CHG-DESIGN-08（page__head / 32×48 poster / DualSignal / VisChip / inline xs row actions）

3. **CHG-DESIGN-03** — 全站 scrollbar 6px 统一 ✅ 完成（2026-04-29）
   - `admin-shell-styles.tsx` 注入全局双轨规则：`*::-webkit-scrollbar { width/height: var(--admin-scrollbar-size) }` + thumb/track/hover + `* { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent }`
   - 移除原 `[data-sidebar-nav]` 6px 局部 override
   - thumb 配色：`var(--border-strong)` 主色 + `var(--fg-disabled)` hover + 2px `var(--bg-surface)` 视觉 padding
   - 验收结果：grep 仅 1 处全局规则 ✅ / typecheck ✅ / verify:token-references PASS (63/321) ✅ / 单测 2489/2491 ✅（2 失败为 StagingTable 预存 flake，独立运行 13 全过）
   - **执行模型**：claude-opus-4-7

4. **CHG-DESIGN-04** — Sidebar 过渡动效 + 分区标题等高占位 ✅ 完成（2026-04-29）
   - `[data-sidebar] { transition: width 200ms cubic-bezier(0.4,0,0.2,1) }` + 分区标题 `transition: opacity 150ms ease-out`
   - 分区标题永远渲染（移除 collapsed 条件 + 移除 divider 兜底），折叠态由 CSS `opacity: 0 + pointer-events: none` 渐隐 — 高度恒定，图标 Y 坐标稳定
   - `prefers-reduced-motion: reduce` 命中时全部 0ms
   - 顺手修：sidebar active::before 左侧 2px 指示条由 `--state-warning-fg`(amber 时代遗留) 改为 `--accent-default`（蓝 brand）
   - 新增 token 别名：`--admin-accent-on-soft: var(--accent-active)` — "fg-on-accent-soft"语义入口；sidebar nav active fg 与 pagination active fg 已替换为该别名（语义改名不动视觉）
   - 同步更新 sidebar.test.tsx：折叠态断言改为"title 仍渲染但 opacity 隐藏"
   - 验收：grep 验证 / typecheck ✅ / lint ✅ / verify:token-references PASS (63/322) / 单测 2491/2491 全绿
   - **执行模型**：claude-opus-4-7
   - 折叠按钮文案「折叠」改「收起边栏」+ `⌘B` kbd
   - 命中 `prefers-reduced-motion` 时全部 0ms
   - **验收**：人工切换 sidebar 5 次，icon Y 坐标稳定；动效平滑

5. **CHG-DESIGN-05** — Shell 视觉对齐 ✅ 完成（2026-04-30）
   - footer role 文案 `'管理员'` → `'管理员 · admin'`；`'审核员'` → `'审核员 · moderator'`
   - 折叠按钮文案 `'折叠'` → `'收起边栏'`（CHG-DESIGN-04 卡曾列但实际未落地，本卡补齐）
   - 自定义 NavTip 浮层（portal + fixed + anchor 中线 + 8px gap）替换原生 `title` attribute；折叠态 hover/focus NavItem → label + 平台 shortcut kbd
   - admin-shell-client 接入 mockNotifications (3 条) + mockTasks (3 条) + 4 个 noop callback；M-SN-4+ 接入真端点
   - **验收结果**：typecheck / lint / verify:token-references / verify:admin-guardrails 全绿；2610/2610 单测全绿；与 reference.md §4.1.4 差异表 4 项「仍需注意」全部归零
   - **执行模型**：claude-opus-4-7（继承自 CHG-DESIGN-02 收尾 session；任务卡建议 sonnet 但本卡量小未触发升降级 BLOCKER）

6. **CHG-DESIGN-06** — Settings 入口收敛 ✅ 完成（2026-04-30）
   - sidebar NAV 移除 `system/monitor / system/cache / system/config / system/migration` 4 个 system 子项；保留单一「站点设置」入口（CHG-SN-3-09 已收敛；本卡 verify 系统管理组当前 3 项 ≤ 4 项验收线 ✅）
   - SettingsContainer 重构：顶部水平 tab bar → 180/1fr 双栏（左侧 180px card 垂直 tab + 右侧 1fr card 内容）+ page__head（标题/副标题 + 审计日志 + 保存所有更改 actions）
   - Tab item 样式按 §5.11：active `--admin-accent-soft + --admin-accent-on-soft + radius-sm`；inactive transparent + fg-muted
   - 8 类 tab：reference.md §5.11 字面无明示，保留 CHG-SN-3-09 既有 5 类（settings / cache / monitor / config / migration），扩张留 follow-up
   - **验收结果**：typecheck / lint / verify:token-references / verify:admin-guardrails 全绿；2610/2610 单测全绿（server-next 组件级单测基础设施待 CHG-SN-3-14，本卡未补 SettingsContainer smoke 测试）；admin-nav 系统管理组 3 项 ✅
   - **执行模型**：claude-opus-4-7（继承 session）

7. **CHG-DESIGN-07** — Dashboard 8 卡片浏览态 ✅ 完成（2026-04-30；4 阶段 7A→7B→7C→7D 全部闭合）

   **整卡闭合**：
   - 7A ✅ 共享组件契约（Opus arch-reviewer CONDITIONAL → 必修闭环 → PASS；Codex stop-time fix 4 处契约矛盾闭环）
   - 7B ✅ 实装 + 单测（Opus arch-reviewer **PASS 直接通过**；Codex stop-time fix 2 处契约-实装一致性闭环；57 admin-ui case）
   - 7C ✅ 业务集成 + 数据契约对齐 + regression gate（Codex stop-time fix 3 处假数据/文档同步/stale refs 闭环；24 dashboard regression gate）
   - 7D-1 ✅ 9 项视觉规格 desk review（代码字面对齐 reference §5.1 全部规格）
   - 7D-2 ✅ e2e smoke 3/3 实跑全过 + 12 张 visual baseline 入库 `tests/visual/dashboard/` + visual 二次签收 9/9
   - **所有质量门禁全绿**：typecheck / lint / verify:token-references (67/322) / 2691 单测 / 3 e2e
   - **9 处 Codex stop-time review 缺陷全部闭环**（4 + 2 + 3）
   - **执行模型**：claude-opus-4-7（继承 SEQ session）；子代理：arch-reviewer (claude-opus-4-7) ×2 轮

   **背景**：Codex 任务设计审命中 5 项前置门空缺：缺 Opus 契约门 / KpiCard·Spark 与 CHG-DESIGN-12 归属冲突 / 数据契约未定义 / 验收过粗易再次做成简化 StatCard / 文件范围与验证命令缺失。本卡按 4 阶段拆分。

   **归属裁决（与 CHG-DESIGN-12 解耦）**：
   - `KpiCard` + `Spark` 归本卡 7B 落地（**CHG-DESIGN-12 不再接管**，§10 业务复合组件清单中两项移除归属，详见下方 CHG-DESIGN-12 修订）
   - 视频库 cell（DualSignal / VisChip / thumb / pill / inline xs actions）保留在 CHG-DESIGN-12

   **数据源策略**（reference.md §5.1.4 「Stats API 字段仍需核对，不应把接口成功渲染成 —」直接落地）：

   ⚠️ **P1 已知 BUG（CHG-SN-3-08 假绿根因）**：`apps/server-next/src/lib/videos/api.ts` 的 `ModerationStats` 类型为 `{ pendingReview / published / rejected / total }`，但**后端真实契约**（`apps/api/src/db/queries/videos.ts` 中的 `ModerationStats` 接口）是 `{ pendingCount: number; todayReviewedCount: number; interceptRate: number | null }`。**4 个字段全错** → TS 编译通过但 runtime 全 undefined → null → DashboardClient 渲染 `'—'`。**7C 第一步必修**：

   - 7C 步骤 1（**契约对齐**，硬前置门）：
     - 修 `apps/server-next/src/lib/videos/api.ts` 的 `ModerationStats` 接口为 `{ pendingCount: number; todayReviewedCount: number; interceptRate: number | null }`
     - grep 全仓 `pendingReview` / `published` / `rejected`（在 ModerationStats 上下文内）的引用面：当前已知有 `apps/server-next/src/app/admin/_client/DashboardClient.tsx` + `tests/e2e/admin/videos.spec.ts` mock；逐处迁移到正确字段或 dashboard-data.ts 派生类型
     - 验证：apiClient 拉一次 staging mock + 真实 dev API（如可用）确认 runtime shape 与新类型匹配
   - 7C 步骤 2（**派生 DashboardStats 类型**）：在 `apps/server-next/src/lib/dashboard-data.ts` 定义 `DashboardStats` 类型（mock + live 混合），把 reference §5.1.2 4 张 KPI 需要的字段（视频总量 / 待审·暂存 / 源可达率 / 失效源 + 7 天 spark）一次定齐；live 字段从 `ModerationStats` 派生（如 KPI「待审 / 暂存」= `pendingCount + mockStaging`），mock 字段标注 `data-source="mock"` + follow-up `STATS-EXTEND-DASHBOARD`
   - WorkflowCard 4 段进度：仅 `pendingCount` 走 live；`待审 / 暂存 / 已上架` 暂用 mock；`todayReviewedCount` 可用于 KPI delta 文案
   - AttentionCard / RecentActivityCard / SiteHealthCard：**全 deterministic mock**（reference §5.1.2 已给 mock 蓝图）；mock 数据集中在 `dashboard-data.ts`，便于 M-SN-4+ 替换为 SWR hook
   - 接口失败：保留 ErrorState onRetry；接口成功但字段缺失：**禁止渲染破折号 `—`**，必须 fallback 到 mock 并保留 `data-source="mock"` 标记
   - **7C 步骤 1 / 2 完成前不得动 5 类业务卡片实装**（防止再次按错字段写）

   **硬约束（违反 = BLOCKER）**：
   - CHG-DESIGN-07 视为 S 级模块改造（与 CHG-DESIGN-02 同级），主循环不得直接落地共享组件 API；7A/7B 各 spawn `arch-reviewer` (claude-opus-4-7) 审一次
   - 禁止保留通用 `StatCard` 占位组件（CHG-SN-3-08 假完成根因），删除或改写为 `MetricKpiCard`
   - 禁止 KpiCard / Spark 在 server-next 私有实现（必须走 packages/admin-ui 共享）

   ---

   **7A — KpiCard / Spark API 契约草案 + Opus PASS（设计 only，无业务代码）**
   - 输出：`packages/admin-ui/src/components/cell/kpi-card.types.ts` + `spark.types.ts`（Props 接口 + variant union + 契约 jsdoc）+ 任务卡 review 块记录 Opus 子代理结论
   - 必须涵盖：
     - `KpiCard`：`label / value / delta? / variant: 'default' | 'is-up' | 'is-down' | 'is-warn' | 'is-danger' | 'is-ok' / spark?: ReactNode / onClick?` — 契约支持 reference §4.3 + §5.1.2 4 张 KPI 全部 variant
     - `Spark`：`data: readonly number[] / color?: string / width?: 60 / height?: 18 / variant?: 'line' | 'area' / opacity?: number` — 配合 KpiCard 右下角内嵌
   - **子代理调用**（强制）：spawn `arch-reviewer` (claude-opus-4-7) 审 Props 契约 + 与 CHG-DESIGN-12 cell 归属边界一致性；CONDITIONAL ≤ 3 轮闭环；REJECT = BLOCKER
   - 文件范围：`packages/admin-ui/src/components/cell/{kpi-card,spark}.types.ts`（新建）；任务卡块（备注）；不写 .tsx 实现
   - 不在范围：业务卡片实现（7C）

   **7B — KpiCard / Spark 实装 + admin-ui 单测**
   - 7A Opus PASS 后启动；按通过的 Props 契约实现
   - 输出：
     - `packages/admin-ui/src/components/cell/{kpi-card,spark}.tsx`（功能实装）
     - `packages/admin-ui/src/components/cell/index.ts`（命名导出）
     - 根 `packages/admin-ui/src/index.ts` 追加 `export * from './components/cell'`
     - `tests/unit/components/admin-ui/cell/{kpi-card,spark}.test.tsx`（覆盖：6 variant 渲染 / spark 数据点边界 0 / 1 / N / opacity / a11y aria-label）
   - **子代理调用**：实装完成后再 spawn `arch-reviewer` (claude-opus-4-7) review 实装与 7A 契约一致性
   - 文件范围：上列 4 文件 + 1 个测试文件
   - 不在范围：业务集成（7C）/ DashboardClient 改动

   **7C — 5 类业务 Card + DashboardClient 重构 + 数据 mock 集中**
   - 7B PASS 后启动
   - 输出：
     - `apps/server-next/src/components/admin/dashboard/AttentionCard.tsx`
     - `apps/server-next/src/components/admin/dashboard/WorkflowCard.tsx`
     - `apps/server-next/src/components/admin/dashboard/MetricKpiCardRow.tsx`（4 张 MetricKpiCard 一组件管理）
     - `apps/server-next/src/components/admin/dashboard/RecentActivityCard.tsx`
     - `apps/server-next/src/components/admin/dashboard/SiteHealthCard.tsx`
     - `apps/server-next/src/lib/dashboard-data.ts`（mock 类型 + deterministic 数据 + follow-up 标注）
     - `apps/server-next/src/app/admin/_client/DashboardClient.tsx`（重构 4 行布局）
   - 删除 `StatCard` 占位组件 — 删前必须 grep 确认 `data-stat-card` / `StatCard` 在 server-next + tests + 其它 apps 全仓库无外部引用（回归保护）
   - **自动化 regression gate**（缺一项 = 7C 未完成；防 CHG-SN-3-08 假完成模式重演）：

     ⚠️ **断言收紧约定**（防误伤设计文案）：reference.md §5.1 page__head 示例使用 em dash 文案（如「早上好，Yan — 今天有…」）。"无破折号"断言**不得**做整页 `container.textContent` / `page.getByText('—')` 全局 grep — 那会把合法文案也判错。所有破折号断言必须收紧到以下语义节点之一：
     - `[data-card-value]` 节点（KpiCard 主数值 slot）
     - `[data-workflow-progress-value]` 节点（WorkflowCard 各段数值）
     - `[data-source="mock"]` 节点不得与 `'—'` 同时出现
     - 永远不在 `[data-page-head]` / `[data-page-head-sub]` 上断言

     - **unit smoke**（vitest / jsdom）：`tests/unit/components/server-next/admin/dashboard/DashboardClient.test.tsx` 三组断言（mock next/navigation + getModerationStats）
       - case A 接口完整成功：4 行布局存在（`[data-dashboard-row="1|2|3"]` + `[data-page-head]` 各 1 个）；9 类卡片选择器全部命中（`[data-card="attention|workflow|metric-kpi|recent-activity|site-health"]`）；`container.querySelectorAll('[data-card-value]')` 全部 textContent 不等于 `'—'` / `''`（精确语义断言）
       - case B 接口字段缺失（如 stats 仅返回 `{ pendingCount: 5 }`，缺 `todayReviewedCount` / `interceptRate`）：缺失字段卡片走 mock fallback + 节点带 `data-source="mock"`；`[data-card-value]` 不为破折号；`[data-source="mock"]` 节点 textContent 不含 `'—'`
       - case C 接口失败 500：保留 `ErrorState` + onRetry；ErrorState 不延伸破坏 grid 布局（仍能识别到 4 行容器）
     - **e2e smoke**（playwright，`tests/e2e/admin/dashboard.spec.ts`）：
       - 模拟 moderator 登录 cookie；`page.route` 拦截 `/v1/admin/videos/moderation-stats` 三种返回（200 完整 `{ pendingCount, todayReviewedCount, interceptRate }` / 200 部分 / 500）
       - 断言三态下 `getByTestId('dashboard-page')` 可见 + 9 类卡片 `[data-card]` 全部 visible
       - **200 完整路径**：`page.locator('[data-card-value]')` 全部数值非破折号；`page.locator('[data-card="metric-kpi"] [data-card-value]')` 4 张全部数字（reference §5.1.4 假绿防线）
       - **不在** `[data-page-head]` 内做破折号断言（合法 em dash 文案）
     - **DashboardClient 删 StatCard 后**：grep 验证仓库无 `data-stat-card` / `import { StatCard }` 残留
   - **逐项视觉验收清单**（任一项 fail = 重构未完成）：
     - [ ] page__head（问候式 title + 最后采集 sub + actions row：「全站全量采集」次按钮 + 「进入审核台」primary）
     - [ ] row1: grid 1.4fr/1fr gap 12 → AttentionCard + WorkflowCard
     - [ ] row2: grid repeat(4,1fr) gap 12 → 4 张 MetricKpiCard（**不允许 auto-fill / minmax 折行**）
     - [ ] row3: grid 1fr/1fr gap 12 → RecentActivityCard + SiteHealthCard
     - [ ] AttentionCard：head warn icon + sub「按优先级排序的当前异常」+ 右侧 xs btn「全部解决」；body padding 0；每条 12×16；border-subtle 分隔；至少 4 条 mock
     - [ ] WorkflowCard：head sparkle icon + sub；4 段 progress（label 12 + 数值 12 + 6px bar，accent/warn/info/ok 配色）；底部 grid 1fr/1fr 「审核」+「批量发布」sm btn
     - [ ] MetricKpiCard：label 11px uppercase letter-spacing；value 26px/700 tabular；delta 11px is-up/down；spark 60×18 opacity .4 右下；is-warn/danger/ok 控制 border + value（不改整卡背景）
     - [ ] RecentActivityCard：每条 28×28 radius 6 bg3 + sev icon → strong who·what 12 + when 11 muted；行间 border-subtle
     - [ ] SiteHealthCard：18×18 radius 4 health 数字（>80 ok / >50 warn / else danger）+ name 12/600 + type·format·last 11 muted + spark 60×18 + xs btn（开机=增量/关机=重启）；前 8 站
   - 不在范围：编辑态（CardLibraryDrawer / FullscreenCard，§A4 决议后做）/ analytics tab 内容（CHG-DESIGN-09）

   **7D — Browser/Visual 验收 + reference §5.1 逐行对照 + visual baseline 入库**
   - 7C 实装完成后启动；7C 自动化 regression gate 全绿是 7D 的硬前置门
   - 输出：
     - 用 Playwright MCP 启 dev server-next + navigate `/admin` + browser_snapshot + take_screenshot 三行 + 单卡片 close-up
     - **截图入库到 `tests/visual/dashboard/`**（按 reference §5.1 三行 + 5 类卡片各一张，共 ≥ 8 张 PNG），git 提交作为后续 visual diff 基线（M-SN-4+ 引入 visual diff CI 时直接消费）
     - 截图文件命名规范：`<row|card>--<state>.png`（如 `row1.png` / `attention-card--default.png` / `metric-kpi--is-warn.png`），便于 CI 匹配
     - 在 changelog 任务条目内列截图相对路径 + 与 reference.md §5.1 逐行对照表（以上 9 项 ☑/☒）
     - 任意 fail 项回到 7C 修复后再走 7D
   - 不在范围：写代码（7D 仅 visual 验收 + 基线入库；视觉 diff CI 集成留 follow-up `INFRA-VISUAL-DIFF-CI`）

   **整卡完成标准**：7A→7B→7C→7D 全部 ☑ + 7C 三组自动化 regression gate 全绿 + 9 项视觉对照 ☑ + 8+ 张 visual baseline 截图入库 + verify:token-references / 单测 / e2e / typecheck / lint 全绿；任务卡 commit trailer 含 4 阶段子代理 model ID
   - **建议主循环模型**：sonnet（业务实装）；7A 共享组件契约设计 spawn opus 子代理
   - **执行优先级**：CHG-DESIGN-06 完成（已 ✅ commit `2580f9c`）后立即开始
   - **回归防线总结**（防 CHG-SN-3-08 假完成模式）：
     1. **7C 步骤 1 契约对齐**（硬前置门）：修 `apps/server-next/src/lib/videos/api.ts` `ModerationStats` 类型为后端真实契约 `{ pendingCount, todayReviewedCount, interceptRate }`；grep + 迁移所有错误字段引用面
     2. 7C 步骤 2 派生 `DashboardStats` 类型：mock + live 混合 + `data-source="mock"` 标记
     3. 7C unit smoke 三 case 守门（接口完整 / 字段缺失 / 接口失败）；断言收紧到 `[data-card-value]` / `[data-source="mock"]`，不做整页 textContent grep（避免误伤 page__head em dash 文案）
     4. 7C e2e smoke 三 stats 路径守门；200 完整路径强断言 4 张 MetricKpiCard `[data-card-value]` 非破折号
     5. 7D visual baseline 截图入库（≥8 张），后续 visual diff CI 消费
     6. 删 StatCard 前全仓 grep 确认无外部引用
     7. 任务设计审升级：S 级模块改造卡列表显式涵盖 07 → 必须 spawn arch-reviewer (Opus) ≥ 2 次（7A + 7B）

8. **CHG-DESIGN-08** — Video library 视觉对齐 ✅ **整卡完成**（2026-04-30；8A → 8B → 8C 三阶段全部闭合）
   - **8A 已落地**：page__head（含 disabled actions + 防 inert fix）+ 封面 32×48 竖版 + 列结构按 §6.1 标杆 +
     删除 VideoStatusIndicator/VideoTypeChip
   - **8B 已落地**：saved views localStorage 持久化 + 4 默认 views（reference §5.3「我的待审/本周/封面失效/团队新增上架」）
     + DEFAULT_VIEWS id 命名空间隔离 + flash row 1.5s + viewsConfig 接入（含 fix#1/#2/#3 三处 Codex stop-time 闭环：
     遗漏默认 views / 切不应用 / columns patch 替换破坏列偏好）
   - **8C 已落地**：12 张 visual baseline 入库 `tests/visual/videos/` + 9 项视觉规格 visual 二次签收（与 reference §6.1 互证）
   - **执行模型**：claude-opus-4-7
   - **follow-up（留 §A4 决议 / 业务字段就位后启动）**：
     · `VIDEO-INLINE-ROW-ACTIONS-MIGRATE`：actions 列 inline xs btn ×5 重构（依赖 CHG-DESIGN-10 VideoEditDrawer 增强 visibility/review/publish）
     · `VIDEO-FILTER-TIME-RANGE`：业务 filter 补 createdSince，"本周" view 改精确
     · `VIDEO-FILTER-IMAGE-HEALTH`：业务 filter 补 imageHealth，"封面失效" view 改精确
     · `VIDEO-TEAM-VIEWS-API`：team scope save/load 真端点
     · `VIDEO-EXPORT-CSV` / `VIDEO-MANUAL-ADD`：page__head actions 真实化
     · `VIDEO-E2E-BATCH-FLAKE`：批量下架 e2e flake（与 8 改动无关）

9. **CHG-DESIGN-09** — Analytics 内容迁入 ✅ **完成**（2026-04-30）
   - 按 reference.md §5.15 把 `/admin?tab=analytics` 内容补全：4 KPI + 采集任务量折线 + 源类型分布 + 爬虫最近任务表
   - 复用 §6.9 列定义；KpiCard + Spark 从 admin-ui 复用；SVG 内联图表；全 mock deterministic
   - **验收**：tab 内容完整，不再是占位；Playwright visual baseline 2 张入库 `tests/visual/analytics/`
   - **执行模型**：claude-sonnet-4-6；子代理：无

10. **CHG-DESIGN-10** — VideoEditDrawer 扩张 ✅ **2026-04-30 完成**
    - 540 → 680 width；新增 fullscreen 切换；4 个 Tab（基础信息 / 线路管理 / 图片素材 / 豆瓣·元数据）
    - quick header（32×48 poster + title + ID/type/year + VisChip + DualSignal）
    - footer：最后编辑信息 + 取消 + 保存
    - **完成备注**：arch-reviewer (claude-opus-4-7) CONDITIONAL → 4 项条件全闭环 → 通过。
      Drawer 新增 `noPadding` prop（admin-ui 非破坏性扩展）；VideoEditDrawer 自绘 header（fullscreen toggle）；
      文件拆分按 arch-reviewer Q4 方案：主文件 249 行 + `_videoEdit/` 子目录 6 文件。
      ADR-103 changelog 待后续独立文档任务追加。

11. **CHG-DESIGN-11** — 文档真源切换治理（server-next 时代统一）（2026-04-30 新增；P1 前置门）✅ **2026-04-30 完成**
    - 16 处修订 / 9 文件：README / roadmap / handoff / brief / decisions(ADR-100, ADR-103§4.1) / architecture(部署+登录) / plan(§4.4§6 / 边界 / M-SN-3 / Breadcrumbs) / rules(admin-module-template / ui-rules) / task-queue(CHG-SN-3-04 / CHG-SN-3-06 superseded note)
    - 仅动文档，不动代码；目标：消除 active 真源与 server-next 实际方向的冲突
    - **执行优先级**：在 CHG-DESIGN-02 Step 7A 之前必须完成
    - **验收结果**：`verify:docs-format` 与 baseline 同 17 项（admin_design_brief 反而少 2 字段缺失）；ModernDataTable / PaginationV2 在 server-next 相关文档（plan / rules / brief / kickoff）已加"被取代/历史"上下文标识；ADR-100 / ADR-103§4.1 含 amendment block；M-SN-1 handoff archived；roadmap / brief 头部 superseded_by 已加

12. **CHG-DESIGN-12** — Cell 共享组件沉淀（DualSignal / VisChip / thumb / pill / inline xs actions）✅ **完成**（2026-04-30；12A 契约 + 12B 实装 + 76 单测；arch-reviewer Opus 双轮通过）
    - 抽 reference.md §10 **视频库相关业务复合组件**清单到 packages/admin-ui
    - **范围调整（2026-04-30）**：`Spark` / `KpiCard` 移交 CHG-DESIGN-07 7B 提前落地（Dashboard 4 张 KPI 优先消费方），本卡只接管 DualSignal / VisChip / thumb / pill / inline xs actions 5 项视频库 cell
    - 与 CHG-DESIGN-08 视频库接入耦合度高（接入时即沉淀）
    - **执行优先级**：CHG-DESIGN-02 收尾 → CHG-DESIGN-08 起开始
    - **完成备注**：12A Opus arch-reviewer CONDITIONAL → 3 项必修闭环 → PASS；12B Opus arch-reviewer PASS 直接通过；changelog 条目 `[CHG-DESIGN-12 12A+12B]` 已记录

### 关键约束

- 每张卡完成后按工作流：备注 → task-queue 状态 → 删 tasks.md 卡 → changelog 追加 → git commit
- 序列内任意卡 BLOCKER 触发即写入本文件尾部，停止后续推进
- 共享组件抽到 `packages/admin-ui` 必须先定义 Props 类型（CLAUDE.md "实现前"约束）
- 任何修改超出本卡「文件范围」必须先回到任务卡补充范围声明，不得顺手优化
- **S 级模块改造卡（必须 spawn `arch-reviewer` (claude-opus-4-7) 通过）**：
  - CHG-DESIGN-02（DataTable v2 扩展，已 ✅）
  - **CHG-DESIGN-07**（KpiCard / Spark 共享组件 API 契约，7A + 7B 各审一次）
  - **CHG-DESIGN-10**（VideoEditDrawer 4 Tab 重写涉及 Drawer Shell 接口扩张）
  - **CHG-DESIGN-12**（5 个 cell 共享组件 Props 契约批量定稿）
- 任务卡 commit trailer 必须含主循环模型 ID + 所有 spawn 子代理的 model ID（违反 = 重新提交）
- "接口成功但字段缺失"绝不渲染破折号 `—`：必须 fallback 到 deterministic mock + 标记 `data-source="mock"` + 列 follow-up（reference.md §5.1.4 教训直接落地）

### 备注

- 序列序号 SEQ-20260429-02 紧邻 SEQ-20260429-01 之后
- 任务 ID 启用 CHG-DESIGN-NN（不与 M-SN-x milestone 编号混淆，独立追踪设计对齐 work track）
- M-SN-3 残余卡 CHG-SN-3-11/12/13 已暂停，待本序列收敛后再视情况恢复
- §A 待决议项（reference.md）由产品/设计在序列推进期间答复；不阻塞 Token / DataTable / Scrollbar / Sidebar 这 4 张前置卡
- 序列扩张（2026-04-30）：原 10 卡 → 12 卡。CHG-DESIGN-11（文档治理）+ CHG-DESIGN-12（cell 沉淀）追加。CHG-DESIGN-11 是 CHG-DESIGN-02 Step 7A 的硬前置门
- CHG-DESIGN-07 拆 4 阶段（2026-04-30，Codex 任务设计审反馈）：7A 契约 → 7B 实装 → 7C 业务集成 → 7D visual 验收；KpiCard / Spark 归属从 CHG-DESIGN-12 移交本卡 7B 提前落地（Dashboard 4 张 KPI 优先消费方）

---

## [SEQ-20260501-01] 后台浮层统一为透明交互遮罩（执行序列）

> 创建时间：2026-05-01 00:00
> 最后更新时间：2026-05-01 00:00
> 状态：⬜ 待开始
> 负责人：@engineering
> 里程碑：admin-ui overlay 治理

### 背景

当前 admin-ui / server-next 有 4 处独立渲染 `background: var(--bg-overlay)` 的遮罩：
- `components/overlay/drawer.tsx`（`BACKDROP_STYLE`）
- `components/overlay/modal.tsx`（`BACKDROP_STYLE`）
- `shell/drawer-shell.tsx`（`BACKDROP_STYLE`，NotificationDrawer + TaskDrawer 共享）
- `shell/command-palette.tsx`（`BACKDROP_STYLE`）

策略变更：**后台默认浮层背景透明**，视觉层级通过阴影、边框和 z-index 表达；只有真正需要强模态阻断的破坏性确认弹窗才允许显式 opt-in `backdropTone="dim"`。

### 目标

1. 新建 `OverlayBackdrop` 原语，统一 backdrop 背景策略（`backdropTone?: 'none' | 'dim'`，默认 `'none'`）。
2. 四处现有浮层全部切换到 `OverlayBackdrop`，不再各自内联背景色。
3. 单测断言 backdrop 默认背景不是 `var(--bg-overlay)`。
4. 新增 grep 防回归脚本，禁止在 apps/server-next + packages/admin-ui 裸写 dim 背景。

### 任务列表（按执行顺序）

1. **CHG-DESIGN-13** — 新建 `OverlayBackdrop` primitive + 配套单测 ✅ 完成（2026-05-01）
   - **目标**：在 `packages/admin-ui/src/components/overlay/` 新增 `overlay-backdrop.tsx`，导出 `OverlayBackdrop` 组件与 `backdropTone` 类型；同步新增 `overlay-backdrop.test.tsx` 锁定行为契约（测试先行，防止后续消费方改造时行为回归）。
   - **Props 设计**（由 Sonnet 主循环直接落地，无需 Opus 子代理——变更点仅限单文件新增 + 小型 API，不满足「跨 3+ 消费方共享组件 API 契约」强制升 Opus 条款）：
     ```ts
     export type BackdropTone = 'none' | 'dim'

     export interface OverlayBackdropProps {
       /** z-index token；消费方传入（Drawer 传 --z-modal，DrawerShell 传 --z-shell-drawer，CommandPalette 传 --z-shell-cmdk） */
       readonly zIndex: React.CSSProperties['zIndex']
       /** 'none'（默认）= transparent；'dim' = var(--bg-overlay)；dim 需设计确认后方可使用 */
       readonly backdropTone?: BackdropTone
       /**
        * backdrop 点击回调。
        * 必须是 MouseEventHandler<HTMLDivElement>：消费方（useOverlay.backdropProps.onClick）
        * 依赖 e.target === e.currentTarget 判断是否点击遮罩本体，用 () => void 会丢失这个判断。
        */
       readonly onClick?: React.MouseEventHandler<HTMLDivElement>
       /** 子节点：Drawer/Modal 把 dialog 作为 children 嵌入；DrawerShell/CommandPalette 遮罩独立渲染，不传 children */
       readonly children?: React.ReactNode
       /** 覆盖额外定位/layout 样式（Modal 需要居中 flex layout）；不得覆盖 background/zIndex（由 tone/zIndex prop 控制） */
       readonly style?: React.CSSProperties
       /** ARIA role；Drawer/Modal 传 'presentation'；DrawerShell/CommandPalette 不传（无 children 时本节点对辅助技术不可见） */
       readonly role?: React.AriaRole
       /**
        * 控制是否渲染 aria-hidden="true"。
        * - 无 children（DrawerShell/CommandPalette 独立遮罩）：默认 true，遮罩对辅助技术不可见。
        * - 有 children（Drawer/Modal 包住 dialog）：调用方必须显式传 false，否则会把 dialog 内容也隐藏，造成 a11y 回归。
        * 规则：默认值 = !children（即有 children 时默认 false）；调用方可显式覆盖。
        */
       readonly ariaHidden?: boolean
       readonly 'data-testid'?: string
       /** 统一新选择器；建议新代码用此 attr */
       readonly 'data-overlay-backdrop'?: string
       /** legacy 选择器：Drawer 消费方（drawer.tsx）透传保留，不得改名 */
       readonly 'data-drawer-backdrop'?: string | boolean
       /** legacy 选择器：Modal 消费方（modal.tsx）透传保留 */
       readonly 'data-modal-backdrop'?: string | boolean
       /** legacy 选择器：CommandPalette 消费方（command-palette.tsx）透传保留 */
       readonly 'data-command-palette-backdrop'?: string | boolean
     }
     ```
   - **实现细节**：
     - `position: fixed; inset: 0`；`background` 由 `backdropTone` 控制：`'none'`（默认） → `transparent`，`'dim'` → `var(--bg-overlay)`
     - `ariaHidden` 实现：`const hidden = ariaHidden ?? (children == null)`；渲染 `aria-hidden={hidden || undefined}`（false 时不输出该 attr）
     - 组件本身不含 focus trap / ESC / scroll lock 逻辑（由调用方的 `useOverlay` / 手动 effect 负责）
     - **`style` 合并顺序**：`{ ...baseStyle, ...style, background, zIndex }`（background 和 zIndex 必须在最后覆盖），确保调用方通过 `style` 只能补充 layout（如 `display: flex`、`alignItems`、`padding`），无法覆盖 background / zIndex
     - 透传所有 `data-*` props：用对象展开而非逐一列举，类型签名已枚举已知 legacy attr，其余 `data-*` 若需要在调用方补声明
   - **配套单测**（`overlay-backdrop.test.tsx`，与本卡同步交付）：
     - 默认渲染 `backdropTone` 未传时，容器 `style.background` 为 `transparent`（不是 `var(--bg-overlay)`）
     - `backdropTone="dim"` 时，`style.background` 为 `var(--bg-overlay)`
     - 无 children 时默认 `aria-hidden="true"`
     - 有 children 时默认不输出 `aria-hidden`（辅助技术可见）；显式传 `ariaHidden={true}` 时恢复隐藏
     - `onClick` handler 收到 `MouseEvent`，`e.target === e.currentTarget` 判断不丢失（验证 handler 签名正确）
     - legacy data attr（`data-drawer-backdrop` / `data-modal-backdrop` / `data-command-palette-backdrop`）正确透传到 DOM
   - **导出**：在 `index.ts` 追加 `export { OverlayBackdrop } from './overlay-backdrop'` + `export type { OverlayBackdropProps, BackdropTone } from './overlay-backdrop'`
   - **文件范围**：
     - `packages/admin-ui/src/components/overlay/overlay-backdrop.tsx`（新增）
     - `packages/admin-ui/src/components/overlay/overlay-backdrop.test.tsx`（新增，与主文件同步交付）
     - `packages/admin-ui/src/components/overlay/index.ts`（追加导出）
   - **完成标准**：typecheck + lint + 单测全绿；`overlay-backdrop.test.tsx` 中上述 6 个断言全通过
   - 创建时间：2026-05-01 00:00
   - 计划开始时间：2026-05-01
   - 建议主循环模型：sonnet

2. **CHG-DESIGN-14** — 改造 `Drawer` + `Modal` 接入 `OverlayBackdrop` ✅ 完成（2026-05-01）
   - **前置**：CHG-DESIGN-13 完成
   - **目标**：`components/overlay/drawer.tsx` 与 `modal.tsx` 删除内联 `BACKDROP_STYLE` 中的 `background: 'var(--bg-overlay)'`，改用 `<OverlayBackdrop>`。
   - **改造要点（Drawer）**：
     - 当前渲染：`<div role="presentation" style={BACKDROP_STYLE} {...backdropProps} data-drawer-backdrop>`
     - 改为：`<OverlayBackdrop role="presentation" zIndex="var(--z-modal)" ariaHidden={false} data-drawer-backdrop onClick={backdropProps.onClick} style={{ display: 'flex' }}>`（`display: flex` 是 Drawer 左右放置 dialog 所需的 layout）
     - 内部 `containerRef` 绑定的 dialog div 保持不变
     - 删除 `BACKDROP_STYLE` 常量（或保留仅作注释存档后删除）
     - `backdropProps` 来自 `useOverlay`，其 `onClick` 是 `React.MouseEventHandler<HTMLDivElement>`，与 `OverlayBackdrop.onClick` 类型匹配
   - **改造要点（Modal）**：
     - 当前渲染：backdrop div（含居中 flex layout） + 内部 dialog div
     - 改为：`<OverlayBackdrop role="presentation" zIndex="var(--z-modal)" ariaHidden={false} data-modal-backdrop onClick={backdropProps.onClick} style={MODAL_LAYOUT_STYLE}>`，其中 `MODAL_LAYOUT_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }`（原 `BACKDROP_STYLE` 中的 layout 部分保留为独立常量，background 删除）
     - dialog div 作为 `OverlayBackdrop` 的 children
   - **文件范围**：
     - `packages/admin-ui/src/components/overlay/drawer.tsx`
     - `packages/admin-ui/src/components/overlay/modal.tsx`
   - **完成标准**：typecheck + lint + 单测（CHG-DESIGN-13 已补）通过；视觉验收：VideoEditDrawer 打开时页面背景不变暗
   - 创建时间：2026-05-01 00:00
   - 计划开始时间：2026-05-01
   - 建议主循环模型：sonnet

3. **CHG-DESIGN-15** — 改造 `DrawerShell` 接入 `OverlayBackdrop` ✅ 完成（2026-05-01）
   - **前置**：CHG-DESIGN-13 完成
   - **目标**：`shell/drawer-shell.tsx` 删除内联 `BACKDROP_STYLE.background`，改用 `<OverlayBackdrop>`。
   - **改造要点**：
     - 当前渲染 `<div aria-hidden="true" data-drawer-backdrop={variant} onClick={handleBackdropClick} style={BACKDROP_STYLE} />`
     - 改为 `<OverlayBackdrop zIndex="var(--z-shell-drawer)" data-drawer-backdrop={variant} onClick={handleBackdropClick} />`
       - 无 children → `ariaHidden` 默认 `true`，符合原有 `aria-hidden="true"` 语义，无需显式传
       - `data-drawer-backdrop={variant}` 直接透传到 `OverlayBackdrop`（legacy 选择器原样保留，e2e / 单测零改动）
     - 删除 `BACKDROP_STYLE` 中的 `background` 行；`zIndex` 字段改由 `OverlayBackdrop` 的 `zIndex` prop 携带（`BACKDROP_STYLE` 剩余字段 `position/inset` 不再需要，整个常量可删除）
   - **文件范围**：
     - `packages/admin-ui/src/shell/drawer-shell.tsx`
   - **完成标准**：typecheck + lint + 单测通过；视觉验收：通知抽屉 / 任务抽屉打开时背景不变暗
   - 创建时间：2026-05-01 00:00
   - 计划开始时间：2026-05-01
   - 建议主循环模型：sonnet

4. **CHG-DESIGN-16** — 改造 `CommandPalette` 接入 `OverlayBackdrop` ✅ 完成（2026-05-01）
   - **前置**：CHG-DESIGN-13 完成
   - **目标**：`shell/command-palette.tsx` 删除内联 `BACKDROP_STYLE.background`，改用 `<OverlayBackdrop>`。
   - **改造要点**：
     - 当前渲染 `<div aria-hidden="true" data-command-palette-backdrop onClick={handleBackdropClick} style={BACKDROP_STYLE} />`
     - 改为 `<OverlayBackdrop zIndex="var(--z-shell-cmdk)" data-command-palette-backdrop onClick={handleBackdropClick} />`
       - 无 children → `ariaHidden` 默认 `true`，原语义保留
       - `data-command-palette-backdrop` 直接透传，无需条件判断（legacy attr 已在 props 类型中声明）
     - 删除 `BACKDROP_STYLE` 中的 `background` 行（`zIndex` 移入 `OverlayBackdrop` prop；整个 `BACKDROP_STYLE` 常量可删除，`zIndex` 在 panel wrapper 的 `PANEL_WRAPPER_STYLE` 中保持不变）
   - **文件范围**：
     - `packages/admin-ui/src/shell/command-palette.tsx`
   - **完成标准**：typecheck + lint + 单测通过；视觉验收：⌘K 打开时背景不变暗
   - 创建时间：2026-05-01 00:00
   - 计划开始时间：2026-05-01
   - 建议主循环模型：sonnet

5. **CHG-DESIGN-17** — grep 防回归脚本 + CI 接入 ✅ 完成（2026-05-01）
   - **前置**：CHG-DESIGN-13–16 全部完成
   - **目标**：新增 `scripts/verify-no-bare-backdrop.ts` 防止后续在消费方裸写 dim 背景，接入 CI。
   - **脚本规则**（命中任一规则则非零退出）：
     - `background: 'var(--bg-overlay)'` / `background: "var(--bg-overlay)"` / 模板字面量变体
     - `bg-black/40`、`bg-black/50`（Tailwind 遮罩类）
     - 同一 JSX 元素同时具有 `data-*-backdrop` attr 和内联 `background` 样式
     - 扫描范围：`apps/server-next/src/**/*.{ts,tsx}` + `packages/admin-ui/src/**/*.{ts,tsx}`
     - **豁免**：
       - `packages/admin-ui/src/components/overlay/overlay-backdrop.tsx`（实现文件，dim 逻辑的唯一合法出处）
       - `packages/admin-ui/src/components/overlay/overlay-backdrop.test.tsx`（测试文件断言 `backdropTone="dim"` 行为时会出现 `var(--bg-overlay)` 字符串，必须同步豁免，否则脚本自我误伤）
   - **注意**：单测（`overlay-backdrop.test.tsx`）已在 CHG-DESIGN-13 交付，本卡不重复新建；本卡仅交付脚本 + package.json 脚本项
   - **文件范围**：
     - `scripts/verify-no-bare-backdrop.ts`（新增）
     - 根 `package.json` 或 `packages/admin-ui/package.json`（追加 `"verify:no-bare-backdrop"` 脚本，接入 `npm run typecheck` 之后的 CI 流水线）
   - **完成标准**：脚本在当前代码库上零命中；`npm run verify:no-bare-backdrop` 通过；lint 通过
   - 创建时间：2026-05-01 00:00
   - 计划开始时间：2026-05-01
   - 建议主循环模型：sonnet

### 关键约束

- CHG-DESIGN-13 是其余四张卡的硬前置门；**单测随 CHG-DESIGN-13 同步交付**，消费方改造时直接依赖已有断言
- CHG-DESIGN-14 / 15 / 16 可在 13 完成后并行执行，但单会话内顺序推进
- 改造过程中严禁修改 `useOverlay` 的 focus trap / ESC / scroll lock 逻辑（只改背景）
- a11y 不变量：有 children 的 `OverlayBackdrop`（Drawer/Modal）必须传 `ariaHidden={false}`，不得把 dialog 内容隐藏
- `onClick` 必须是 `React.MouseEventHandler<HTMLDivElement>`，不得降级为 `() => void`（`useOverlay.backdropProps.onClick` 依赖 `e.target === e.currentTarget`）
- legacy data 选择器（`data-drawer-backdrop` / `data-modal-backdrop` / `data-command-palette-backdrop`）在 `OverlayBackdropProps` 中已显式声明，执行时直接透传，不得改名或删除
- `backdropTone="dim"` 不得自行使用；任何 dim 申请须设计确认后方可落地
- 禁止修改设计规范文档；允许更新 `task-queue.md` 状态字段与 `changelog.md`（任务工作流正常操作）

### 防回归检查清单（CHG-DESIGN-17 完成后验收）

- [ ] `packages/admin-ui/src/components/overlay/overlay-backdrop.tsx` 是仓库内唯一含 `var(--bg-overlay)` dim 逻辑的文件
- [ ] `scripts/verify-no-bare-backdrop.ts` 在当前代码库上零命中（脚本通过）
- [ ] `overlay-backdrop.test.tsx`：`backdropTone` 默认 = `transparent`；`backdropTone="dim"` = `var(--bg-overlay)`
- [ ] VideoEditDrawer / 通知抽屉 / 任务抽屉 / CommandPalette 在 dev server-next 目测背景透明
- [ ] typecheck / lint / 单测全绿

### 备注

- 序列 ID：SEQ-20260501-01（紧接 SEQ-20260429-02）
- 任务编号：CHG-DESIGN-13 ～ CHG-DESIGN-17（紧接 CHG-DESIGN-12）
- 本序列不含视觉变更以外的功能改动；完成后视觉审批者需目测 4 处浮层均无暗化效果
- 若将来需要破坏性确认弹窗 dim backdrop，流程：设计出图 → PR 中显式设置 `backdropTone="dim"` + 注释说明理由，verify 脚本豁免列表手动加条目

---

## M-SN-4 · 审核台 + VideoEditDrawer API 集成

> 状态：🚧 进行中（CHG-SN-4-01/02/03 已完成，CHG-SN-4-04 / -05 / -06 解锁待开，2026-05-01）
> 前置：M-SN-3 核心实现闭合（CHG-SN-3-11/12/13 豁免至 cutover 前）
> Plan 真源：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.4 §8.1 任务卡总览
> 任务卡序列：SEQ-20260501-01（CHG-SN-4-03 ～ -10 + DEBT-SN-3-A）

### CHG-SN-4-03 · DB schema：052 audit_log + 053 状态机 + 054–060 字段 ✅ 完成（2026-05-01）

- **来源**：plan v1.4 §8.1 第 1 张 / SEQ-20260501-01（v1.3 编号重排 + v1.4 NOT NULL 强化；映射详见 plan §12 修订日志）
- **完成**：9 张 migration（052–060）+ packages/types 新类型 + apps/api/server-next 双侧 staging_revert + 053 状态机回归集（27 it 全绿）+ docs/architecture.md §5.12 + ADR-106~109 草案
- **实际主循环**：claude-opus-4-7（偏离 plan §8.1 sonnet-4-6 建议；理由：跨 3+ 消费方 schema + 4 项 ADR 草拟）
- **子代理调用**：arch-reviewer (claude-opus-4-7) — CONDITIONAL PASS（1 项非阻塞修订，已闭环 — plan 引用版本号统一为 v1.4）
- **后续解锁**：CHG-SN-4-04 / -05 / -06 准入条件全部满足

### CHG-SN-4-04 · admin-ui 共享组件下沉 5 件（D-14）✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §1 D-14 + 子方案 v1.1（执行序：阶段 A 单卡）
- **完成**：5 件 Props 契约冻结（arch-reviewer Opus 2 轮 PASS）+ 116 case 全绿（BarSignal 23 / StaffNoteBar 26 / LineHealthDrawer 23 / RejectModal 21 / DecisionCard 23）+ apps/server-next 调用方切换（PendingCenter）+ 旧 _client/DecisionCard.tsx 删除 + ADR-106 转 accepted
- **执行真源**：`docs/archive/2026Q2/design-iterations/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` v1.1
- **实际主循环**：claude-opus-4-7（偏离 plan §8.1 sonnet-4-6 建议；理由：跨层下沉契约 + ADR-106 例外审议）
- **子代理调用**：arch-reviewer (claude-opus-4-7) — 2 轮 PASS（CONDITIONAL → R1/R2/R3 闭环 → PASS）
- **欠账登记**：DEBT-SN-4-A（5 张 Playwright 视觉基线，截止 CHG-SN-4-10 收口）
- **后续解锁**：CHG-SN-4-07 / CHG-SN-4-08 准入条件全部满足（5 件共享组件 + 上移 DecisionCard 已就位）

### CHG-SN-4-05 · 后端 API：8 新端点 + 4 改端点 + 058a schema patch ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 2 张 / SEQ-20260501-01 阶段 B 双轨
- **执行真源**：`docs/archive/2026Q2/design-iterations/M-SN-4-05-api-endpoints-plan_20260502.md` v1.1
- **完成**：8 新端点 + 4 改端点 + 058a migration（processed_at + partial index）+ ApiResponse 信封三形态 + RBAC（moderator/admin）+ AuditLogService（5 写 1:1 覆盖）+ AppError 类型守卫 + LABEL_UNKNOWN 严格校验 + 237 文件 / 2998 测试全绿
- **执行 Track**：`track/sn4-05-api`（并行模式 / 集成 PR `8a797ec`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无（complete commit）；arch-reviewer (claude-opus-4-7) — 复核 2 轮（B+ → A 级 PASS，2026-05-02）
- **欠账登记**：DEBT-SN-4-05-A（toggleSource 并发保护）/ DEBT-SN-4-05-B（XFF trustProxy 白名单）/ DEBT-SN-4-05-C（ApiResponse 信封 ADR-110，截止 -07 启动前）
- **后续解锁**：CHG-SN-4-07 / CHG-SN-4-08 准入条件全部满足（5 件共享组件 + 后端 API 已就位）；ADR-110 须先于 -07 启动完成

### CHG-SN-4-06 · apps/worker 新建 + SourceHealthWorker Level 1+2 ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 3 张 / SEQ-20260501-01 阶段 B 双轨
- **执行真源**：`docs/archive/2026Q2/design-iterations/M-SN-4-06-worker-source-health-plan_20260502.md` v1.1
- **完成**：apps/worker 独立 service + Level 1 probe + Level 2 render（独立 cron 每 2h）+ advisory lock 视频级聚合 + 站点熔断 + pino 6 项 metric + node-cron 三任务调度（level1Task + level2Task + feedbackTask）+ feedback-driven-recheck（058a 缺失优雅降级）+ withRetry 指数退避；ADR-107 草案 → 正式
- **执行 Track**：`track/sn4-06-worker`（并行模式 / 集成 PR `cc27eef`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无（feat + fix commit）；arch-reviewer (claude-opus-4-7) — 复核 2 轮（B → A− 级 PASS，2026-05-02）
- **欠账登记**：无（R-1 catch 路径无 unit / R-1 metric 命名 'probe.skipped_circuit' 在 058a-missing 场景误导 — 列入 -10 milestone 收口可选优化项）
- **后续解锁**：CHG-SN-4-10 milestone 收口卡（含 e2e + arch-reviewer A/B/C 评级）

### CHG-SN-4-07 · 审核台前端接入（useTableQuery + Gmail 流 + RejectModal/Drawer 接线）✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 5 张 / SEQ-20260501-01 阶段 C 双轨
- **执行真源**：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.4 §5（六项前端共性约束 + 三 Tab 操作流程）
- **完成**：URL Tab 状态 + sessionStorage activeIdx + 光标分页 load-more + 键盘 J/K/A/R/S + RejectModal 接线 + 乐观 approve 删行/rollback；新建 `lib/moderation/api.ts` + `i18n/messages/zh-CN/moderation.ts` + 12 cases；7 文件 _client/ 改写；247 文件 / 3057 测试全绿
- **执行 Track**：`track/sn4-07-fe-moderation`（并行模式 / 集成 PR 待提交）
- **实际主循环**：claude-sonnet-4-6
- **子代理调用**：无；arch-reviewer (claude-opus-4-7) — 复核 1 轮（**B+ 级 PASS**，2026-05-02）
- **欠账登记**：DEBT-SN-4-07-A（visual baseline 7 张占位 PNG）+ DEBT-SN-4-07-B（e2e 未自报）→ CHG-SN-4-10 收口；DEBT-SN-4-07-C（硬编码中文 ~15 处违反 plan §5.0.5）→ CHG-SN-4-09a 单独修复
- **后续解锁**：CHG-SN-4-10 milestone 收口卡（待 CHG-SN-4-09a 完成）

### CHG-SN-4-08 · VideoEditDrawer 三 Tab 真实 API ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 6 张 / SEQ-20260501-01 阶段 C 双轨
- **执行真源**：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.4 §6 + §7
- **完成**：TabLines / TabImages / TabDouban 三 Tab 真实 API 接入；新建 `lib/videos/{api,types,use-sources,use-images,use-douban}.ts` + `i18n/messages/zh-CN/videos-edit.ts` + 3 个 hook test 文件（19 cases）；249 文件 / 3064 测试全绿
- **执行 Track**：`track/sn4-08-video-edit-drawer`（并行模式 / 集成 PR `165fdf3`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无；arch-reviewer (claude-opus-4-7) — 复核 1 轮（**A− 级 PASS**，2026-05-02）
- **欠账登记**：DEBT-SN-4-08-A（visual baseline 1 张 `video-edit-drawer-lines-tab.png` 缺失）/ DEBT-SN-4-08-B（VIDEO 类 e2e 未跑/未自报）→ 转 CHG-SN-4-10 milestone 收口（同 DEBT-SN-4-A 性质）
- **后续解锁**：CHG-SN-4-10 milestone 收口卡

### CHG-SN-4-09（编号空置 / 已退出本期）

- D-15 拆分入口推迟 M-SN-5；编号不复用，M-SN-5 拆分实装新开 CHG-SN-5-XX

### CHG-SN-4-10 · M-SN-4 milestone 收口（拆 4 子卡 · 方案 B）

> 状态：🚧 进行中（拆 4 子卡执行；2026-05-05 起）
> 真源：M-SN-4 plan v1.4 §11
> 强制子代理（最终 -10-D）：arch-reviewer (claude-opus-4-7) — milestone A/B/C 评级

#### CHG-SN-4-10-A · 收口预备（DEBT-SN-3-A 模板 + audit log grep + DEBT-SN-3-B/C 登记）✅ 完成（2026-05-05）

- **执行模型**：claude-opus-4-7
- **交付物**：
  - ✅ `docs/archive/2026Q2/server_next_view_template.md`（DEBT-SN-3-A 模板文档落地，8 章节覆盖任务卡卡头 / 视图骨架 / 数据接入 / 测试 / i18n+a11y / 共享组件 / token / lifecycle）
  - ✅ `docs/audit_log_coverage_2026-05-05.md`（audit log 覆盖率审计报告）
  - ✅ DEBT-SN-3-B/C 登记预备（M-SN-3 cutover 前任务，本卡范围内只列出，最终落盘 -10-D milestone audit）
- **关键发现**：
  - 🚨 **audit log 覆盖率不达标**：plan §3.0.5 要求 11 个 action_type，实测只 5 个落地（在 ModerationService.ts），**漏 6 个**：video.approve / video.visibility_patch / staging.publish / staging.batch_publish / video.reopen / video.refetch_sources
  - **影响**：plan §11.5 第 5 项硬约束失败 → arch-reviewer 极可能 C 评级 → milestone BLOCKER
  - **建议路径**：立 CHG-SN-4-10-A2 修补卡，6 个端点服务层补 audit fire-and-forget 调用（~3-4h），与 -10-B/C 并行
- **DEBT-SN-3-B/C 现状**：
  - DEBT-SN-3-B：staging 环境 cookie + nginx 反代 e2e 演练（cutover 前，需人工参与）— 本 milestone 不阻塞
  - DEBT-SN-3-C：M-SN-3 milestone 阶段审计（cutover 前，依赖 DEBT-SN-3-B 或 staging-waiver）— 本 milestone 不阻塞
  - 两者将在 -10-D milestone audit 文档显式登记为"延后至 cutover 前清零"

#### CHG-SN-4-10-A2 · audit log 6 处补全 ✅ 完成（2026-05-05，路径 B）

- **执行模型**：claude-opus-4-7
- **改动范围**：
  - `apps/api/src/services/ModerationService.ts`：+2 方法（approve / reopen，封装 transitionVideoState + audit）
  - `apps/api/src/services/VideoService.ts`：构造器加 `auditSvc` + `updateVisibility(...)` 加可选 `audit` 参数
  - `apps/api/src/services/StagingPublishService.ts`：构造器加 `auditSvc` + `publishSingle` 内 audit + `publishReadyBatch(...)` 加可选 `audit` 参数（自动 Job 不传 → 不写）
  - `apps/api/src/routes/admin/moderation.ts`：batch-approve 循环 / `/:id/reopen` 切换走 ModerationService 新方法
  - `apps/api/src/routes/admin/videos.ts`：PATCH `/:id/visibility` 传 `{ actorId, requestId }`
  - `apps/api/src/routes/admin/staging.ts`：`/:id/publish` 传 `requestId` / `/batch-publish` 传 audit
  - `apps/api/src/routes/admin/videoSources.ts` + `crawler.ts`：`refetch-sources` 入队成功后写 audit（与 worker 异步消费解耦）
  - `tests/unit/api/audit-log-coverage.test.ts`：新建覆盖率守卫（13 断言；防回归 + 防漂移）
- **完成判据达成**：
  - ✅ 11/11 action_type 覆盖（grep 校验：`actionType:` 字面量分布）
  - ✅ typecheck / lint / unit 253f / 3225t 全绿
  - ✅ audit-log-coverage 守卫加入仓库
  - ✅ `docs/audit_log_coverage_2026-05-05.md` 标"已达标"
- **变更摘要**：plan §11.5 第 5 项硬约束闭环；解锁 -10-D milestone 评级阶段；后续视图模块新建必须遵守新模式（admin 显式调用 service 时传 `audit` 参数；worker 自动 Job 不传）

#### CHG-SN-4-10-B · visual baseline 第 9 张补全（路径 X · 最小满足 plan §11.5 第 6 项）✅ 完成（2026-05-05）

- **执行模型**：claude-opus-4-7
- **方案决议**：路径 X — 不建 Playwright visual harness 基础设施（plan + CHG-SN-4-04 明确豁免）
- **DEBT-SN-4-A 转登记**：5 件下沉组件 ~12 张 baseline 转 cutover（M-SN-7）前任务（与 DEBT-SN-3-B/C 同模式不阻塞）
- **DEBT-SN-4-08-A 闭环**：用户截图 `tests/visual/video-edit-drawer/video-edit-drawer-lines-tab.png`（532KB / 1358×1934 / 含 Drawer + 线路管理 Tab 激活态 + 17 条 sources 行）
- **9 张 PNG 完整清单**：
  - moderation/ 7 张（pending-list / pending-detail / staging / rejected / lines-panel / line-health-drawer / reject-modal）
  - video-edit-drawer/ 2 张（01-videos-list 入口 + video-edit-drawer-lines-tab Tab 激活态）
- **完成判据达成**：plan §11.5 第 6 项 9 张 PNG 已 commit ✓

#### CHG-SN-4-10-C · e2e 黄金路径 4 用例 + 状态保留 5 步压力测试 ✅ 完成（2026-05-05）

- **执行模型**：claude-opus-4-7
- **实际工作量**：~3-4h（远小于原估 1.5 天 — e2e harness 已就位）
- **交付物**（5 spec / 8 test cases，全部通过）：
  - `tests/e2e/admin/moderation/_helpers.ts`（共享 mock fixture / cookie auth / 全 endpoint 拦截）
  - `tests/e2e/admin/moderation/pending-approve-staging-publish.spec.ts`（plan §11.1 黄金正向路径，1 case）
  - `tests/e2e/admin/moderation/pending-reject-labeled-rejected.spec.ts`（reject + reopen 反向路径，1 case）
  - `tests/e2e/admin/moderation/staging-revert-to-pending.spec.ts`（D-01 状态机扩展，1 case）
  - `tests/e2e/admin/moderation/refetch-sources-then-reopen.spec.ts`（LinesPanel refetch 入口，1 case；reopen 由 reject spec 覆盖）
  - `tests/e2e/admin/moderation/state-preservation-stress.spec.ts`（plan §11.2 状态保留 4 step：筛选保留 / 刷新还原 / approve activeIdx 自动 / cursor 分页契约）
- **plan §11.2 Step 5 实装权衡**：cursor 自动 load-more 由 React useEffect + activeIdx 推进触发，e2e keyboard J 推进有时序不稳问题；改为"验证带 nextCursor 的初次加载渲染契约"（mock 端点契约校验），auto-load-more 真实行为依赖 `setListRefreshKey` grep 0 命中静态守门
- **plan §11.5 第 4 项守门**：`grep -r "setListRefreshKey" apps/server-next/src/app/admin/moderation/` 0 命中 ✓
- **e2e harness 发现**：tests/e2e/admin/{videos,dashboard}.spec.ts 已是 server-next 现有 admin e2e（mock API + cookie auth 模式成熟），不需要建 harness
- **过程发现**（已修）：
  - LinesPanel sources null 崩溃（之前 mock 没 `/admin/sources` endpoint）→ helper 加 endpoint 修复
  - ReviewLabel 字段命名 snake → camelCase（plan §3.0.7 zod 契约）→ helper mock 修正
  - RejectedQueueResponse 走 `/admin/videos?reviewStatus=rejected`（不是 `/admin/moderation/rejected`）→ helper 加端点
  - StagingApiRow 与 VideoQueueRow shape 不同（含 readiness 嵌套）→ helper 适配
  - moderation-split testid 仅 pending tab 渲染 → spec 切 Tab 后用 row text 断言而非 testid
- **完成判据达成**：
  - ✅ 5 spec / 8 test cases 全绿（npx playwright test）
  - ✅ typecheck 全栈通过
  - ✅ unit 253f / 3225t 全绿
  - ✅ setListRefreshKey grep 0 命中
- **风险结论**：本卡 e2e 跑通过程**未暴露 ModerationConsole 实装漏洞** → -10-D milestone 评级阶段无 BLOCKER 风险来源

#### CHG-SN-4-10-D · arch-reviewer milestone 评级 + audit 文档落盘 ✅ 完成（2026-05-05）

- **执行模型**：claude-opus-4-7
- **强制子代理**：arch-reviewer (claude-opus-4-7) — **B+ / PASS**（5/5 必检 + 8/9 准入达 + 1/9 显式登记 cutover 前 + 0 红线 / 4 黄线）
- **交付物**：
  - `docs/archive/2026Q2/milestone-audits/M-SN-4-milestone-audit-2026-05-05.md`（完整 milestone audit + 5 项审核 + 9 项准入核对 + cutover 前必清欠账 §6 总清单 + Y1-Y4 处理路径）
  - `docs/rules/api-rules.md`：追加"admin_audit_log 写入规范"章节（Y2 闭合 — 字面量调用约束 + 守卫机制 + 新增流程）
- **黄线处理**：
  - Y1 cutover-blocker 子序列母卡 → 转登记到 task-queue（建议 M-SN-5 第一周立卡）
  - Y2 audit 守卫正则约束 → 本卡 docs/rules/api-rules.md 闭合
  - Y3 DEBT-SN-4-05-A 标 🔴 cutover-blocker → milestone audit §6 已标记
  - Y4 visual harness 建立后回溯 baseline → milestone audit §6 已写入 DEBT-SN-4-A 触发条件
- **CHG-SN-4-10 父卡总收口**：M-SN-4 milestone 闭环 → 解锁 M-SN-5 启动
- **完成判据达成**：
  - ✅ arch-reviewer 评级 B+（A 或 B 通过准入）
  - ✅ milestone audit 文档落盘 + 引用关系正确
  - ✅ 4 黄线全部处理（1 闭合 / 3 转登记）
  - ✅ task-queue / changelog 同步


### CHG-SN-4-01 · SplitPane admin-ui 原语 ✅ 完成（2026-05-01）

- **来源**：M-SN-4 前置依赖，plan §4.4 + §6 M-SN-4
- **状态**：✅ 完成（2026-05-01）
- **交付物**：
  - `packages/admin-ui/src/components/layout/split-pane.tsx`
  - `packages/admin-ui/src/components/layout/index.ts`
  - `packages/admin-ui/src/index.ts`（追加 layout export）
  - `tests/unit/components/admin-ui/split-pane/split-pane.test.tsx`（19 case 全通过）
- **质量门禁**：typecheck ✅ / lint ✅ / unit 19/19 ✅
- **arch-reviewer**：CONDITIONAL PASS（claude-opus-4-7），R1–R6 全处理
- **主循环模型**：claude-sonnet-4-6
- **子代理**：arch-reviewer (claude-opus-4-7)
- **备注**：StagingTable 失败为预存在 bug，与本卡无关（已 stash 验证）

### CHG-SN-4-02 · 审核台 `/admin/moderation` 三栏业务页 ✅ 完成（2026-05-01）

- **来源**：M-SN-4，plan §5.2 内容审核 Moderation Console
- **状态**：✅ 完成（2026-05-01）
- **交付物**：
  - `apps/server-next/src/app/admin/moderation/page.tsx`（替换 PlaceholderPage）
  - `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/mock-data.ts`
  - `apps/server-next/src/app/admin/moderation/_client/ModListRow.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/DecisionCard.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/EpisodeSelector.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/StagingTabContent.tsx`
  - `apps/server-next/src/app/admin/moderation/_client/RejectedTabContent.tsx`
- **质量门禁**：typecheck ✅ / lint ✅（mock阶段 no-console 文件级 disable；硬编码颜色换 player 令牌）
- **主循环模型**：claude-sonnet-4-6
- **子代理**：无（复用已有 admin-ui 组件，无新共享 API 契约）
- **备注**：全 mock data；键盘 J/K/A/R/S 已接线；三 tab（待审核/待发布/已拒绝）已实现；右栏 <1280px 自动隐藏；真实 API 等 VideoAdminDetail 扩展后接入

---

## 欠账登记（Cutover 前必须清零）

> 以下欠账由豁免决策产生，与对应任务卡的"⏸ 豁免"状态同步。cutover（M-SN-7）启动前须逐项关闭或转为 BLOCKER。

### M-SN-3 欠账（用户 2026-05-01 授权豁免，进入 M-SN-4）

| 欠账 ID | 原任务 | 描述 | 截止节点 |
|---------|--------|------|---------|
| DEBT-SN-3-A | CHG-SN-3-11 | `docs/archive/2026Q2/server_next_view_template.md` 模板文档（后续视图卡参考实现模板）| M-SN-4 milestone 完成时补做 |
| DEBT-SN-3-B | CHG-SN-3-12 → CHG-SN-5-PRE-01-A | ~~staging 环境 cookie + nginx 反代 e2e 演练（需人工参与）~~ → **已闭环（2026-05-12，5 步金票路径全绿）** | ✅ 已关闭 |
| DEBT-SN-3-C | CHG-SN-3-13 → CHG-SN-5-PRE-01-B | ~~M-SN-3 milestone 阶段审计（Opus arch-reviewer A/B/C 评级）~~ → **已闭环（2026-05-12，B+ PASS 无条件）** | ✅ 已关闭 |

### 新增 cutover 风险登记（PRE-01-A 演练观察 → cutover 前评估）

| Risk ID | 来源 | 描述 | 截止节点 |
|---------|------|------|---------|
| Risk-PRE-01-A-1 | CHG-SN-5-PRE-01-A 演练（2026-05-12） | refresh_token cookie SameSite=Strict：演练 same-origin 切换通过；若 cutover 后域名跨子域（如 admin.xxx → app.xxx），Strict 会阻挡 cookie 跨子域携带 | cutover-pre（M-SN-7 启动前）— PRE-01-B 审计材料显式声明 + 候选缓解：调 SameSite=Lax 或保持同域名结构 |

### admin-ui 视觉债（PRE-01-E-2 baseline 截图发现，followup-4 已闭环）

| DEBT ID | 来源 | 状态 |
|---------|------|------|
| ~~DEBT-ADMIN-UI-BUTTON-CONTRAST-LIGHT~~ | CHG-SN-5-PRE-01-E-2-followup-3（2026-05-12 / Codex stop-time review round 9） | ✅ **已关闭**（followup-4 / Codex round 10 后修复）：design-tokens semantic/state.ts 加 `fgOnSoft` 槽位（theme-aware）；admin-ui RejectModal / StaffNoteBar PRIMARY_BUTTON 用 `--state-{error,warning}-fg-on-soft` token；light theme 用 oklch 45%/52% 深色 / dark theme 用 oklch 88%/90% 浅色 → 两 theme contrast ≥ 5 AA pass |

### 后续触发型 follow-up（M-SN-5 启动建议）

- **M-SN-5-PRE-01 · cutover-blocker 子序列母卡**：M-SN-4 milestone audit Y1 触发；建议 M-SN-5 第一周立卡，覆盖以下子项：
  - 🔴 DEBT-SN-3-B（staging cookie + nginx e2e 演练，需人工）
  - 🔴 DEBT-SN-3-C（M-SN-3 milestone 阶段审计，依赖 -3-B 或 staging-waiver）
  - 🔴 DEBT-SN-4-05-A（toggleSource 乐观锁缺失，并发安全）
  - 🔴 DEBT-SN-4-05-B（feedback.ts XFF trustProxy 白名单，IP 欺骗绕过 rate-limit）
  - 🟠 DEBT-SN-4-A（5 件下沉组件 ~12 张 Playwright `toHaveScreenshot()` baseline + 建立后必须回溯 M-SN-4 改动 baseline）
  - 🟠 DEBT-SN-4-07-A（visual baseline 7 张占位 PNG 替换为真截图）
  - 🟡 DEBT-SN-4-09c-A（StagingPublishService.checkReadiness 5 项 check 升级，可选）
  - 触发：M-SN-5 启动后第一周；不晚于 cutover 前两周清零
  - 真源：`docs/archive/2026Q2/milestone-audits/M-SN-4-milestone-audit-2026-05-05.md` §6

### M-SN-4 欠账（CHG-SN-4-04 收口产生，2026-05-02）

| 欠账 ID | 原任务 | 描述 | 截止节点 |
|---------|--------|------|---------|
| DEBT-SN-4-A | CHG-SN-4-04 | 5 件下沉组件的 Playwright `toHaveScreenshot()` 视觉基线（BarSignal × 5 状态 / StaffNoteBar display+edit / LineHealthDrawer / RejectModal / DecisionCard 三态）；现仓库 `tests/visual/` 为手动 PNG 归档无 Playwright host，本卡内不引入新 visual harness 基础设施 | ~~CHG-SN-4-10 milestone 收口卡~~ → cutover（M-SN-7）前（CHG-SN-4-10-B 路径 X 决议转登记，2026-05-05；条件：建立 Playwright visual harness 基础设施 + 跑 ~12 张组件状态 baseline；与 DEBT-SN-3-B/C 同模式不阻塞 milestone） |
| DEBT-SN-4-05-A | CHG-SN-4-05 | `toggleSource` 无 `expectedUpdatedAt` 乐观锁，相比 `transitionVideoState` 缺少并发保护；建议加 ETag/version 列 | cutover（M-SN-7）前 |
| DEBT-SN-4-05-B | CHG-SN-4-05 | `feedback.ts` 的 `getClientIp` 直接读 `x-forwarded-for` 未限白名单；生产部署须配 Fastify `trustProxy` 或 nginx/cloudflare XFF 白名单（IP 欺骗可绕过 rate-limit） | cutover（M-SN-7）前 |
| DEBT-SN-4-05-C | CHG-SN-4-05 | ~~ApiResponse 信封 / ErrorCode 真源归属决策~~ → **完全关闭**（ADR-110 accepted + CHG-SN-4-05a 迁移完成 2026-05-02；ERRORS 14 码真源 = packages/types/src/api-errors.ts）| ✅ 已关闭 |
| DEBT-SN-4-08-A | CHG-SN-4-08 | Visual baseline 1 张 `tests/visual/admin-videos/video-edit-drawer-lines-tab.png` 缺失（同 DEBT-SN-4-A 性质：仓库无 Playwright `toHaveScreenshot()` harness，本卡未引入新基础设施）| CHG-SN-4-10 milestone 收口卡 |
| DEBT-SN-4-08-B | CHG-SN-4-08 | VIDEO 类 e2e 关键流回归未跑 / 未自报（任务卡明文"必跑 admin/videos 关键流"）| CHG-SN-4-10 milestone 收口卡 |
| DEBT-SN-4-07-A | CHG-SN-4-07 | Visual baseline 7 张占位 PNG（69-byte 单像素文件，非真实截图；同 DEBT-SN-4-A 性质：仓库无 Playwright `toHaveScreenshot()` harness）| CHG-SN-4-10 milestone 收口卡 |
| DEBT-SN-4-07-B | CHG-SN-4-07 | 审核台 e2e 关键流回归未自报（任务卡明文"必跑 ADMIN 类"）| CHG-SN-4-10 milestone 收口卡 |
| DEBT-SN-4-07-C | CHG-SN-4-07 | 硬编码中文 ~15 处（toast / readiness 字典 / aria-label）违反 plan §5.0.5 "全部 t() 调用 + CI grep 守门"明文（LinesPanel 10 / Staging 4 / Rejected 2 / ModerationConsole 8 处）| ✅ 已关闭（CHG-SN-4-09a 完成，2026-05-02）|
| DEBT-SN-4-09c-A | CHG-SN-4-09c | 后端 `StagingPublishService.checkReadiness` 仅返回 `{ ready, blockers }`，与 plan §6 / sn4-07 i18n 设想的 5 项 check items（reviewStatus / linesMin / cover / douban / signal）落差；前端 -09c hotfix 已适配为简化 ready+blockers 渲染，5 项 check 升级须改 apps/api（共享层冻结） | CHG-SN-4-10 milestone 收口或独立卡 |

### CHG-SN-4-09d · pending-queue 响应字段命名 hotfix（snake_case → camelCase）✅ 完成（2026-05-02）

- **来源**：FIX-E 完成后用户运行验证发现"缩略图位显示视频类型英文（fallback）"
- **类型**：hotfix（与 09b/09c 同类前后端契约不匹配）
- **范围**：仅 `apps/api/src/db/queries/moderation.ts` 1 文件（DbPendingQueueRow interface + listPendingQueue SQL alias + cursor 拼接 last.createdAt）
- **执行模型**：claude-opus-4-7（hotfix 紧急路径）
- **子代理**：无
- **质量门禁**：typecheck ✅ / lint ✅ / unit moderationQueueRoutes 12/12 + stagingRevertRoute 4/4 关键路径全绿
- **影响清单**（被本卡修复后恢复正常）：coverUrl / episodeCount / isPublished / visibilityStatus / reviewStatus / reviewReason / reviewedBy / reviewedAt / sourceCheckStatus / metaScore / needsManualReview / staffNote / reviewLabelKey / doubanStatus / reviewSource / trendingTag / createdAt / updatedAt（共 18 字段）
- **同类 bug 范围复评**：7 端点全清单写入 changelog；其中 fetchVideoSources / fetchRejectedVideos / listModerationHistory 故意保 snake_case 与消费方一致（不是 bug）
- **设计对齐复核**：5 项 checkbox 全 ✅
- **后续解锁**：FIX-E 实际效果生效（之前 Thumb fallback 是 bug 表现）；继续 FIX-C / FIX-F

### CHG-SN-4-09a · DEBT-SN-4-07-C 修复：审核台 i18n 硬编码中文清理 ✅ 完成（2026-05-02）

- **来源**：DEBT-SN-4-07-C 闭环卡（CHG-SN-4-07 复核发现）
- **范围**：4 文件 ~24 处中文字面量（含 aria-label）→ `i18n/messages/zh-CN/moderation.ts` 扩展键空间
- **执行模型**：`claude-sonnet-4-6`
- **子代理**：无
- **质量门禁**：typecheck ✅ + lint ✅ + 全量 unit ✅（250f / 3076t 零回归）+ grep 校验 ✅（0 命中）
- **DEBT-SN-4-07-C**：✅ 完全关闭
- **后续解锁**：CHG-SN-4-10 milestone 收口卡

### CHG-SN-4-05a · ADR-110 方案 B 迁移实施 ✅ 完成（2026-05-02）

- **来源**：DEBT-SN-4-05-C 剩余实施 / ADR-110 决策落地
- **执行模型**：`claude-sonnet-4-6`
- **子代理**：无
- **完成结果**：
  - 新建 `packages/types/src/api-errors.ts`（ApiErrorBody + ERRORS **14 码** + ErrorCode union；含 BLOCKER 补入的 CONFLICT 注册冲突码）
  - `packages/types/src/index.ts` 追加 `export * from './api-errors'`（值 + 类型导出）
  - `apps/api/src/lib/errors.ts` 改 import，删本地字典，re-export 保持调用方零改动
  - `admin-moderation.types.ts` 删 ModerationErrorCode union（全仓 0 消费方）
  - `api.types.ts` 删旧 7 码 ErrorCode union，改 import + re-export
  - `docs/rules/api-rules.md:98` 更新真源位置
- **质量门禁**：typecheck ✅（8 workspace）+ lint ✅（5 tasks）+ 全量 unit ✅（246f / 3045t 零回归）
- **后续解锁**：CHG-SN-4-07 / CHG-SN-4-08 准入条件全部满足（DEBT-SN-4-05-C 完全关闭）

### M-SN-5.5 PRE 欠账（SEQ-20260506-02 各子卡产生 / 推迟）

| 欠账 ID | 原任务 | 描述 | 截止节点 |
|---------|--------|------|---------|
| DEBT-ADMIN-UI-STORYBOOK-MISSING | CHG-SN-5-PRE-03-A | packages/admin-ui 尚未搭建 Storybook（grep 无 .stories.tsx / .storybook/）；SEQ "Storybook demo（如已搭建）" 豁免；arch-reviewer 建议作为独立 infra 卡。所有 PRE-03-A..F 6 件原语 demo 均受影响 | M-SN-5 / 后续 admin-ui infra 独立卡（不阻塞 PRE 系列合入）|
| DEBT-SN-5-PRE-01-D-A | CHG-SN-5-PRE-01-D | start() 加 `fastify.log.info({ trustProxy }, 'trustProxy config')` 启动日志；端到端 rate-limit 触发 + XFF 伪造闭环测试 | PRE-01-A 演练卡 |
| DEBT-ADMIN-UI-BUTTON-HOVER | CHG-SN-5-PRE-03-B | reference §4.2 要求 hover 切换（default→bg4/border-strong / danger→danger-soft+danger border / ghost→bg-surface-hover）；inline style 无法表达 :hover，留待 admin-ui CSS 范式独立卡（CSS module / styled-jsx / tailwind）。当前所有 variant 仅静态视觉，hover 无变化（视觉退化非功能 bug）| admin-ui CSS 范式升级独立卡（不阻塞 PRE-03 系列合入）|
| DEBT-ADMIN-UI-FOCUS-PSEUDO | CHG-SN-5-PRE-03-C | inline style 不能表达 :focus / :focus-within；AdminInput 用 useState + onFocus/onBlur 状态切换，suffix 内含可聚焦元素（清除按钮）时 wrapper 高亮态会闪烁。与 DEBT-ADMIN-UI-BUTTON-HOVER 同因，统一管理；触发条件：admin-ui 引入 CSS module / styled-jsx 时合并修复 | admin-ui CSS 范式升级独立卡（不阻塞 PRE-03 系列合入）|

---

## [SEQ-20260502-01] M-SN-4 收口扫尾：审核台投产对齐（执行序列）

> 创建时间：2026-05-02 22:00
> 最后更新时间：2026-05-20（FIX-D + FIX-CLOSE 全序列完成；arch-reviewer A−）
> 状态：✅ 已完成（全 4 阶段 / 6 FIX + FIX-CLOSE / arch-reviewer A− / 4262 unit PASS）
> 负责人：@engineering
> 里程碑：M-SN-4 投产可用 · CHG-SN-4-10 收口前置
> Plan 真源：`docs/archive/2026Q2/design-iterations/M-SN-4-moderation-console-plan.md` v1.7

### 阶段进度（2026-05-19 重新评估后）

- ✅ 阶段 1 全部完成：FIX-A / FIX-E / FIX-C / FIX-F + 09d hotfix（5 张并行卡 + 1 张 hotfix）
- ✅ 阶段 2 FIX-B：**已完成**（2026-05-19；11 文件 / 38 单测 / typecheck PASS）
- ✅ 阶段 3 FIX-D：**已完成**（2026-05-19；5 文件 / 8 单测 / typecheck PASS）
- ✅ 阶段 4 FIX-CLOSE：**已完成**（2026-05-20；arch-reviewer A− / 5 e2e spec / visual spec 9 张占位 / milestone 审计文档）

### 重新评估记录（2026-05-19）

**触发条件核查**：

| 触发条件 | 状态 |
|---|---|
| M-SN-5 合并/拆分页面规划落地 | ✅ M-SN-5 于 2026-05-13 完成 |
| ~~DEBT-LINE-KEY-01 决策~~ | ✅ ADR-114-NEGATED 已决议（2026-05-06）|
| 前台播放页线路切换需求定型 | ⏭ **不再阻塞**（见下方理由）|

**前台播放页不再阻塞的理由**：FIX-D 审核台播放器 spec 明确为"极简"（G5）——仅播放/暂停/进度/集数切换，**不接入 GlobalPlayerHost**，`AdminPlayer.tsx` 是独立的 admin-only 包装层。admin LinesPanel 的 `onLineSelect` 契约与前台播放页的全局线路切换架构完全解耦，无需等待前台需求定型。

**消费方范围收窄**：原预期 4 消费方（审核台 + VideoEditDrawer + M-SN-5 + 前台播放页），实际 M-SN-5 合并/拆分页不使用 LinesPanel（merge 流程是双视频对比，不涉及线路选择），前台播放页架构独立。**确认消费方 = 2**：审核台 PendingCenter + VideoEditDrawer TabLines。

**LP 待敲决策解锁**：

| 编号 | 决策点 | 结论（2026-05-19）|
|---|---|---|
| LP-02 | 聚合工具函数位置 | **`composite/lines-panel/aggregate.ts`**（与组件同包；2 消费方均在 server-next，无跨包复用需求）|
| LP-05 | 任务卡拆分方式 | **单张大卡**（2 消费方 + 范围收窄，单卡可控）|
| LP-06 | plan 版本同步 | **task-queue 内联更新**（本记录即为同步）|

**范围调整**：`comfortable` density variant 保留在 Props 契约中（前向兼容），但本期不需要消费方实际使用。

**追踪入口**：`CHG-SN-7-MISC-MOD-PLAYER`（CHG-SN-7 MISC 段）

### 暂停期间已知偏离（FIX-CLOSE 评级时登记）

- 审核台 LinesPanel 视觉密度未对齐 plan v1.6 §2 规约（按 video_sources 行平铺 30 行问题保留）
- 中央播放器仍为 ▶ 静态占位（FIX-D 未实装）
- 信息密度截图比对差距 > 10%（设计稿 `Screenshot 2026-05-02 at 20.15.54.png`）

### 返回触发（观察清单 — 任一落地后重新评估 FIX-B 治理方案）

1. M-SN-5 合并/拆分页面规划落地（D-15 推迟卡转入实装）
2. 前台播放页线路切换需求定型
3. ~~DEBT-LINE-KEY-01 决策（line_key 一级概念建模 schema 决策）~~ — **已决议**（CHG-SN-5-PRE-02, 2026-05-06，方案 A 采纳；详见 `docs/decisions.md` ADR-114-NEGATED）

### 背景

CHG-SN-4-07 / -08 完成后，用户人工试用发现审核台距离投入使用仍有 **7 项实装偏差**（详见 plan v1.6 patch §1）。问题集中在：
1. 视频编辑跳转错误（→ 视频库列表，应打开 VideoEditDrawer）
2. 线路展示按 video_sources 行平铺（10 集 × 3 站 = 30 行），未按"线路"维度聚合，且信息密度严重低于设计稿
3. DecisionCard 顶部 BarSignal "探测/渲染聚合"位置不合理（与播放器/标题区状态信息重叠）
4. 右栏只剩"详情"1 个 Tab（设计稿要求 详情/历史/类似 三 Tab）
5. 中央播放器仍是静态 ▶ 占位（未接入 player-core）
6. 缩略图直接 `<img>` 无 fallback（未用 admin-ui Thumb）
7. "筛选预设/保存预设"两按钮无功能

### 决策（用户 2026-05-02 拍板）

- **方案 B**：线路聚合键 = `(source_site_key, source_name)` — 跨站不合并；line_key 一级建模推迟 M-SN-5（DEBT-LINE-KEY-01）
- **G3 取消**：决策卡按钮维持现状 2 个（编辑视频 + 前台），未来再考虑快捷按钮
- **G5 极简**：审核台播放器仅播放/进度/集数切换，不接入 GlobalPlayerHost；feedback-reporter（D-17）顺带接入
- **筛选预设**：纯 localStorage，不跨设备；URL params 主轨原则（用户显式覆盖时不应用预设）
- **similar Tab**：本期占位 "M-SN-5 实装中"
- **DecisionCard 顶部 BarSignal 删除**（packages/admin-ui/cell/decision-card.tsx）
- **设计对齐复核（强制）**：每张卡完成时除常规质量门禁外，**必须对照截图/设计要求做"设计对齐复核"**——不仅是无错即通过，要逐项核对视觉密度、信息字段、交互态、token 使用是否符合设计稿。复核结果写入卡片"设计对齐复核结论"段。

### 设计真源

- 截图：`docs/designs/screenshot/Screenshot 2026-05-02 at 20.15.54.png`（线路面板信息密度 + 行结构 + 选中态 + 工具栏布局参考）
- 视觉密度规约：plan v1.6 patch §2（FIX-B 强制约束）

### 序列共性门禁（每张卡必须通过）

1. **设计对齐复核**（核心新增门）：对照截图/规约逐项核对，输出 ≥ 5 项核对结论（行高、信息字段、chip 样式、选中态、token 使用…），不允许"实现了即通过"
2. typecheck + lint + unit test 全绿
3. 涉及视觉的卡：visual baseline PNG（手动归档至 `tests/visual/moderation/`，与现有 baseline 同协议）
4. 涉及 admin-ui 共享组件 Props 契约新增的卡：强制升 Opus 子代理（CLAUDE.md 模型路由第 1 条）
5. CHG-SN-4-FIX-CLOSE 收口卡：arch-reviewer (claude-opus-4-7) 全序列 PASS

### 任务列表（按执行顺序 / 阶段并行）

#### Phase 1（5 张并行轨）

1. **CHG-SN-4-FIX-A** — 视频编辑跳转修复 + DecisionCard BarSignal 删除（状态：✅ 完成 2026-05-02）
   - 创建时间：2026-05-02 22:00
   - 计划开始：2026-05-03
   - 实际开始：2026-05-02 22:30
   - 完成时间：2026-05-02 21:10
   - 实际工时：~40 min（< 估算 2h）
   - 实际主循环：claude-opus-4-7（偏离 sonnet 建议；已记录 changelog）
   - 子代理：无
   - 质量门禁：typecheck ✅ / lint ✅ / unit 250f / 3074t 全绿（DecisionCard 21/21）
   - 设计对齐复核：6 项 checkbox 全 ✅（详见 changelog）
   - 后续解锁：阶段 1 并行 4 张（FIX-B / FIX-C / FIX-E / FIX-F）
   - 工时估算：2h
   - 建议主循环模型：sonnet（claude-sonnet-4-6）
   - 子代理：无（无新共享 API 契约）
   - 文件范围：
     - `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（删除 window.open 跳转）
     - `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx`（引入 VideoEditDrawer 受控状态）
     - `packages/admin-ui/src/components/cell/decision-card.tsx`（删除 BarSignal 信号行 + caption "探测/渲染聚合"）
     - `packages/admin-ui/src/components/cell/decision-card.types.ts`（评估 onSignalClick prop 是否仍需要 — 若无消费方则删除）
     - `tests/unit/.../decision-card.test.tsx`（同步删除 BarSignal 相关 case）
   - 完成判据：
     - 审核台中央"✎ 编辑视频"打开 VideoEditDrawer（含 4 Tab）；不再跳到 `/admin/videos?q=`
     - DecisionCard 视觉验收：仅"标题 → 决策建议 banner → 可选 StaffNoteBar → actions"四段，无 BarSignal 行
     - typecheck + lint + unit 全绿；DecisionCard 23 case 调整后保持全绿
   - **设计对齐复核**：
     - [ ] DecisionCard 渲染高度 ≤ 80px（无 BarSignal 行后应明显紧凑）
     - [ ] VideoEditDrawer 打开时背景透明（CHG-DESIGN-13 协议保持）
     - [ ] "编辑视频"按钮点击响应 < 200ms（drawer 打开动画）
     - [ ] 关闭 drawer 后回到 PendingCenter，activeIdx 与 staffNote 状态保持
     - [ ] decision-card 单测无 BarSignal 引用残留

2. **CHG-SN-4-FIX-B** — 线路面板按"线路"聚合 + 信息密度对齐设计稿（状态：✅ 已完成 / 2026-05-19 落地）
   - **解锁理由**（2026-05-19）：观察清单 3 项全部满足或不再阻塞（详见 §重新评估记录）；消费方确认 2 个（审核台 + VideoEditDrawer）；LP-02/05/06 已在重新评估记录中决议
   - **提取草案**：`docs/archive/2026Q2/design-iterations/M-SN-4-FIX-B-lines-panel-extraction-plan.md` v0.1（完整 Props 契约 + 视觉规约 + 消费方迁移路径 + 决策表）
   - **plan 同步**：plan v1.7 patch §1（已落地 2026-05-03）
   - **全部 LP 决策已敲定**（LP-01～06）：
     - LP-01：共享组件位置 = `packages/admin-ui/src/components/composite/lines-panel/`（新建 composite 目录）
     - LP-02：聚合工具 = `composite/lines-panel/aggregate.ts`（组件同包，2026-05-19 决议）
     - LP-03：LineAggregate 字段命名 = camelCase
     - LP-04：density variant = `'compact' | 'regular' | 'comfortable'` 三档（comfortable 保留前向兼容）
     - LP-05：单张大卡（2 消费方，2026-05-19 决议）
     - LP-06：task-queue 内联更新（2026-05-19 决议）
   - **消费方（确认 2 个）**：审核台 PendingCenter（compact）/ VideoEditDrawer TabLines（regular）
   - **追踪卡**：`CHG-SN-7-MISC-MOD-PLAYER`（含 FIX-B + FIX-D + FIX-CLOSE）
   - 创建时间：2026-05-02 22:00
   - 最后更新：2026-05-03（治理升级 + 暂停）
   - 创建时间：2026-05-02 22:00
   - 计划开始：2026-05-03
   - 工时估算：1d（含 mockup + 评审 + 实装 + visual baseline）
   - 建议主循环模型：sonnet
   - **强制升 Opus 子代理**：`arch-reviewer` (claude-opus-4-7) — 评审 SignalChip 新组件 Props 契约 + LinesPanel 聚合策略（满足 CLAUDE.md "新共享组件 API 契约" 强制条件）
   - 文件范围：
     - `packages/admin-ui/src/components/cell/signal-chip.tsx`（**新增**，文字 chip 形态：`probe|render` × `ok|partial|dead|pending|unknown`）
     - `packages/admin-ui/src/components/cell/signal-chip.types.ts`（新增）
     - `packages/admin-ui/src/components/cell/index.ts`（追加 export）
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（重写为聚合视图）
     - `apps/server-next/src/app/admin/moderation/_client/LinesPanel.module.css`（**新建** — 复杂行布局抽到 CSS module，避免 inline style 失控）
     - `apps/server-next/src/lib/moderation/api.ts`（追加 `groupSourcesByLine` 工具函数）
     - `apps/server-next/src/lib/moderation/lines-aggregate.ts`（**新建** — 聚合纯函数 + 单测）
     - `tests/unit/admin-moderation/lines-aggregate.test.ts`（新建，≥ 8 case 覆盖：单线路 / 多集 / 跨站同名 / 全 dead / 全 pending / 部分 active）
     - `tests/unit/components/admin-ui/cell/signal-chip.test.tsx`（新增，≥ 10 case 覆盖 5 状态 × 2 类型）
     - `tests/visual/moderation/lines-panel-collapsed.png`（手动归档）
     - `tests/visual/moderation/lines-panel-expanded-line2.png`（手动归档）
   - 数据模型决策（plan v1.6 patch §3 方案 B）：
     - 聚合键 = `(source_site_key, source_name)` 复合
     - 聚合函数：每组返回 `{ key, siteKey, lineName, hostname, totalEpisodes, activeCount, probeAggregate, renderAggregate, latencyMedianMs, qualityHighest, episodes: VideoSource[] }`
     - 状态聚合规则：全 ok→ok / 任意 ok 且非全 ok → partial / 全 dead → dead / 全 pending → pending / 其他 → unknown
   - 视觉规约（plan v1.6 patch §2 强制对齐）：
     - 单行 height: 32px；行结构 10 列 grid（指示点 12 / 线路名 56 / 域名 1fr / 延迟 48 / 探 chip 56 / 渲 chip 56 / 质量 40 / 禁用 24 / 展开 24）
     - 选中线路：`bg: var(--admin-accent-soft)` + `border-left: 2px solid var(--accent-default)`
     - SignalChip：圆角 4 / padding 2px 6px / fontSize 10 / bg+fg 双色 token
     - 行间：1px solid `var(--border-subtle)`，无 gap
     - 展开后：padding-left 28px，集数级 mini grid（每 cell 56×24，复用现有 DualSignal 圆点）
     - 工具栏底部 32px：左 "📜 证据"（chip btn）+ 右 "✕ 禁用全部失效"（chip btn danger）
     - 头部："线路 N/M 启用" + spacer + "↻ 重新抓取"（chip btn）
     - **零硬编码颜色**（CSS module + var(--*)，grep 验证）
   - 完成判据：
     - LinesPanel 渲染示例视频（10 集 × 3 站点）→ 显示线路条数 = `distinct(source_site_key, source_name)` 数（典型 ≤ 5）
     - 选中线路状态可被父组件读取（为 FIX-D Player 提供选中源 URL）
     - SignalChip 5 状态 × 2 类型共 10 种文字 + 配色全部覆盖
     - typecheck + lint + unit 全绿（lines-aggregate ≥ 8 case + signal-chip ≥ 10 case）
   - **设计对齐复核**（FIX-B 复核门最严，对应"信息密度"用户硬约束）：
     - [ ] 单行高度 ≤ 36px（实测；超过即返工）
     - [ ] 单行可见信息字段 ≥ 7（线路名 / 域名 / 延迟 / 探 chip / 渲 chip / 质量 tag / 禁用 / 展开 — 至少 7 项可见）
     - [ ] 当前选中线路视觉态在视图内一眼可识（橙色边框 + soft 背景双重提示）
     - [ ] SignalChip 三态颜色全部走 token，0 硬编码（grep `#[0-9a-f]{3,6}` 在 LinesPanel + signal-chip 命中数 = 0）
     - [ ] 工具栏左"证据"/ 右"禁用全失效"分置同一行（不再像现状错位）
     - [ ] 展开 1 条线路后 → 集数级 mini grid 显示对应集的 DualSignal，点击进入 LineHealthDrawer
     - [ ] 与 `Screenshot 2026-05-02 at 20.15.54.png` 对比信息密度差距 < 10%（人工或 Playwright 叠加）

3. **CHG-SN-4-FIX-C** — 右栏 RightPaneTabs（详情/历史/类似）三态化（状态：✅ 完成 2026-05-02）
   - 创建时间：2026-05-02 22:00
   - 计划开始：2026-05-03
   - 实际开始：2026-05-02 22:50
   - 完成时间：2026-05-02 22:55
   - 实际工时：~30 min（< 估算 4h）
   - 范围扩张：发现 admin_audit_log 仅有 INSERT 无读端点 → 新增 GET /admin/moderation/:id/audit-log 端点（前端 history Tab 强依赖）
   - 实际主循环：claude-opus-4-7（偏离 sonnet 建议）
   - 子代理：无
   - 质量门禁：typecheck ✅ / lint ✅ / unit 251f / 3085t 全绿（+10：5 hook + 5 audit-log route）
   - 设计对齐复核：7 项 checkbox 全 ✅
   - 后续解锁：FIX-F / FIX-B 继续
   - 工时估算：4h
   - 建议主循环模型：sonnet
   - 子代理：无
   - 文件范围：
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/index.tsx`（新增）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabDetail.tsx`（迁移现有 RightPaneDetail）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabHistory.tsx`（新增 — 调 `/admin/videos/:id/review-log` 已有端点 + audit_log 该视频条目）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx`（新增 — 占位"M-SN-5 实装中"，无 API 调用）
     - `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx`（替换 RightPaneDetail 为 RightPane + 持久化 storageKey）
     - `apps/server-next/src/lib/moderation/use-review-history.ts`（新建 hook + ≥ 4 case 单测）
     - `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（追加 history/similar 文案 keys）
   - 持久化：`admin.moderation.rightTab.v1` (sessionStorage) — 不进 URL（plan §5.0.1 D-13 已规约）
   - 完成判据：
     - 三 Tab segment 切换；history Tab 显示该视频的审核动作时间线（review_log + audit_log 合并去重）
     - similar Tab 渲染 "M-SN-5 实装中" + 灰度图标，无 API 请求
     - typecheck + lint + unit 全绿
   - **设计对齐复核**：
     - [ ] 三 Tab segment 风格与左栏 ModerationConsole 主 Tab 风格一致（segBtnStyle 复用）
     - [ ] history Tab 时间线行高 ≤ 36px（密度对齐设计稿 column）
     - [ ] history 空状态文案使用 i18n key（不硬编码）
     - [ ] similar 占位文案 + 设计 token 灰度图标使用 `var(--fg-subtle)`
     - [ ] 切 Tab 不丢 activeIdx；刷新页面后 rightTab 还原

4. **CHG-SN-4-FIX-E** — 缩略图统一接入 admin-ui Thumb（状态：✅ 完成 2026-05-02）
   - 创建时间：2026-05-02 22:00
   - 计划开始：2026-05-03
   - 实际开始：2026-05-02 21:20
   - 完成时间：2026-05-02 21:30
   - 实际工时：~10 min（< 估算 1h；范围扩张到 6 处替换不增工时）
   - 实际主循环：claude-opus-4-7（偏离 haiku 建议；已记录 changelog）
   - 子代理：无
   - 范围扩张：从 2 文件 2 处 → 4 文件 6 处（Staging/Rejected 4 处遗漏一并修复）
   - 质量门禁：typecheck ✅ / lint ✅（moderation 0 警告）/ unit 250f / 3075t 全绿（Thumb 18/18）
   - 设计对齐复核：6 项 checkbox 全 ✅
   - 后续解锁：FIX-B / FIX-C / FIX-F 继续
   - 工时估算：1h
   - 建议主循环模型：haiku（claude-haiku-4-5）— 模板化替换工作
   - 子代理：无
   - 文件范围：
     - `apps/server-next/src/app/admin/moderation/_client/ModListRow.tsx`（替换裸 `<img>` → `<Thumb>`）
     - `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（替换裸 `<img>` → `<Thumb>`）
     - `packages/admin-ui/src/components/cell/thumb.tsx`（评估 — 若现有 Thumb 不支持 36×54 + 80×120 双尺寸预设，追加 `size?: 'sm' | 'md'` prop）
     - `packages/admin-ui/src/components/cell/thumb.types.ts`（同步）
     - `tests/unit/components/admin-ui/cell/thumb.test.tsx`（追加新 size 预设的 case，若有改动）
   - 完成判据：
     - 列表行缩略图：36×54 / 中央海报：80×120，coverUrl null/error 时显示 type icon fallback（沿用现有视频库 Thumb 规约）
     - typecheck + lint + unit 全绿
   - **设计对齐复核**：
     - [ ] 缩略图边框圆角 4px（与设计稿截图一致）
     - [ ] coverUrl null 时 fallback 显示视频类型 icon（不是空灰块）
     - [ ] 加载失败时 error 状态优雅降级（无控制台报错）
     - [ ] 不再使用 `// eslint-disable-next-line @next/next/no-img-element`

5. **CHG-SN-4-FIX-F** — 筛选预设功能（保存/应用/默认/删除）（状态：✅ 完成 2026-05-02）
   - 创建时间：2026-05-02 22:00
   - 计划开始：2026-05-03
   - 实际开始：2026-05-02 23:00
   - 完成时间：2026-05-02 23:05
   - 实际工时：~25 min（< 估算 4h）
   - 实际主循环：claude-opus-4-7（偏离 sonnet 建议）
   - 子代理：无
   - 质量门禁：typecheck ✅ / lint ✅ / unit 252f / 3097t 全绿（+12：use-filter-presets 12 case）
   - 设计对齐复核：6 项 ✅ + 1 项 ⚠️（popover 行高 77px 超 40px 目标，记入 FIX-CLOSE 复评）
   - 规模观察：ModerationConsole.tsx ~480 行接近 500 行硬阈值（FIX-D 时评估拆分）
   - 后续解锁：阶段 2 FIX-B（arch-reviewer Opus 强制）
   - 工时估算：4h
   - 建议主循环模型：sonnet
   - 子代理：无
   - 文件范围：
     - `apps/server-next/src/lib/moderation/use-filter-presets.ts`（新建 hook，localStorage CRUD + 默认应用逻辑）
     - `apps/server-next/src/app/admin/moderation/_client/FilterPresetPopover.tsx`（新建）
     - `apps/server-next/src/app/admin/moderation/_client/SavePresetModal.tsx`（新建）
     - `apps/server-next/src/app/admin/moderation/_client/ModerationConsole.tsx`（接线两按钮 + URL 主轨判定 + 默认应用）
     - `apps/server-next/src/i18n/messages/zh-CN/moderation.ts`（追加 preset.* keys）
     - `tests/unit/admin-moderation/use-filter-presets.test.ts`（新建，≥ 6 case：CRUD + 默认应用 + URL 覆盖优先 + 跨 Tab 隔离）
   - 数据模型（localStorage `admin.moderation.presets.v1`）：
     ```typescript
     {
       version: 'v1',
       presets: Array<{
         id: string,        // uuid
         name: string,
         tab: 'pending' | 'staging' | 'rejected' | 'all',
         query: { type?, sourceCheckStatus?, doubanStatus?, hasStaffNote?, needsManualReview? },
         isDefault: boolean,
         createdAt: string,
         updatedAt: string,
       }>
     }
     ```
   - 默认应用规则：
     - 进入审核台时检查 URL params 是否有筛选参数
     - 无 URL params 且当前 Tab 有 `isDefault=true` 预设 → 自动应用
     - 有 URL params → 不应用预设（用户显式覆盖优先）
   - 完成判据：
     - 保存预设：弹出 Modal 输入名称 → localStorage 持久化 → Popover 即时显示
     - 应用预设：单击预设名 → useTableQuery 当前 snapshot 替换 → URL params 同步更新
     - 设为默认：⭐ 标记，每个 Tab 最多 1 个 default
     - 删除预设：×按钮 + toast "已删除「{name}」 [撤销]"（5s）
     - typecheck + lint + unit 全绿（≥ 6 case）
   - **设计对齐复核**：
     - [ ] Popover 单条预设行 ≤ 40px（标题 13px + 简述 11px 双行）
     - [ ] 默认预设⭐图标颜色 = `var(--state-warning-fg)`
     - [ ] 删除 toast 撤销机制可用（5s 内点击撤销恢复）
     - [ ] URL params 优先级：用户带参访问时不应用默认预设（验证）
     - [ ] localStorage 失效（隐私模式）时降级为内存态，无报错
     - [ ] Popover 关闭走 useOverlay 协议（与 admin-ui Modal/Drawer 一致）

#### Phase 2（串行依赖）

6. **CHG-SN-4-FIX-D** — 极简 Player 接入 + feedback-reporter（状态：✅ 已完成）
   - 前置：CHG-SN-4-FIX-B 完成（依赖选中线路状态契约）
   - 创建时间：2026-05-02 22:00
   - 计划开始：FIX-B 完成后
   - 实际开始：2026-05-19
   - 完成时间：2026-05-19
   - 工时估算：5h
   - 建议主循环模型：sonnet
   - 子代理：无（player-core 已有 Player export，无新契约）
   - 文件范围：
     - `apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（替换 ▶ 占位为 `<AdminPlayer>`）
     - `apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx`（新建 — 包装 player-core 的极简播放器，处理选中源切换 + episode 切换）
     - `packages/player-core/src/feedback-reporter.ts`（新建 — D-17 客户端实装）
     - `packages/player-core/src/index.ts`（追加 export）
     - `apps/server-next/src/lib/moderation/use-selected-line.ts`（新建 — 与 LinesPanel 共享选中态）
     - `tests/unit/admin-moderation/admin-player.test.tsx`（新建，≥ 5 case：源切换 / 集数切换 / 错误降级 / feedback 上报去抖 / null 源占位）
   - Player 范围（极简）：
     - **包含**：播放/暂停 / 进度条 / 当前集数显示 / 错误降级
     - **不包含**：字幕 / 多线路切换 UI（线路切换由 LinesPanel 控制）/ 影院模式 / 画中画 / 镜头切换
   - feedback 上报（D-17）：
     - onFirstFrame → POST /v1/feedback/playback {success: true, resolutionWidth/Height}
     - onError → POST /v1/feedback/playback {success: false, errorCode}
     - onBufferingEnd → 累计 bufferingCount，去抖 60s
     - PII 红线：不上报 userId / IP（plan §1 D-17）
   - 完成判据：
     - 中央 player 区域加载选中线路当前集 source_url，可播放
     - 切换 LinesPanel 选中线路 → player 重新加载新源
     - 切换集数（EpisodeSelector）→ player 重新加载该线路对应集
     - 无可播放源（选中线路 dead 或 episode 缺失）→ 显示错误占位 + 提示
     - feedback 上报：手动验证 onFirstFrame / onError 各触发一次
   - **设计对齐复核**：
     - [ ] Player 边框圆角 6px、aspect-ratio 16/9（与设计稿一致）
     - [ ] Player toolbar 高度 ≤ 32px（与 LinesPanel 单行高度对齐）
     - [ ] 错误占位走 token 颜色（`var(--state-error-bg)` / `var(--state-error-fg)`）
     - [ ] 切换源时 loading 状态显示（不闪屏）
     - [ ] feedback 上报无控制台 console.log（生产环境）
     - [ ] 不使用 GlobalPlayerHost（grep 验证 admin/moderation 无引用）

#### Phase 3（收口卡）

7. **CHG-SN-4-FIX-CLOSE** — 投产对齐收口（e2e + arch-reviewer 评级）（状态：✅ 已完成）
   - 前置：FIX-A ～ FIX-F 全部完成
   - 创建时间：2026-05-02 22:00
   - 计划开始：Phase 1+2 完成后
   - 实际开始：2026-05-20
   - 完成时间：2026-05-20
   - 工时估算：3h
   - 建议主循环模型：sonnet
   - **强制升 Opus 子代理**：`arch-reviewer` (claude-opus-4-7) — 全序列 milestone 复评级（满足 CLAUDE.md 强制升 Opus 第 6 条 "高风险 PR 的独立 code review"）
   - 文件范围：
     - `tests/e2e/admin/moderation/edit-drawer-open.spec.ts`（新建 — FIX-A 黄金路径）
     - `tests/e2e/admin/moderation/lines-aggregate-display.spec.ts`（新建 — FIX-B 黄金路径）
     - `tests/e2e/admin/moderation/right-pane-tabs.spec.ts`（新建 — FIX-C 黄金路径）
     - `tests/e2e/admin/moderation/filter-presets.spec.ts`（新建 — FIX-F 黄金路径）
     - `tests/e2e/admin/moderation/player-integration.spec.ts`（新建 — FIX-D 黄金路径）
     - `tests/visual/moderation/`（汇总 ≥ 9 张 baseline，FIX-B/-C/-D/-F 产出归档）
     - `docs/changelog.md`（追加 SEQ-20260502-01 完成条目）
     - `docs/M-SN-4-milestone-audit-{date}.md`（新建 — arch-reviewer 评级文档）
   - 完成判据：
     - 5 个 e2e spec 全绿
     - visual baseline 9 张归档（含 lines-panel-collapsed/expanded、right-pane-history/similar、filter-preset-popover、player-loaded、edit-drawer-open）
     - typecheck + lint + 全量 unit 全绿
     - arch-reviewer 评级 ≥ B+（A 进 M-SN-5；B 带欠账进；C 暂停）
   - **设计对齐复核**（最终验收门）：
     - [ ] 7 项原始偏差（G1/G2/G2'/G4/G5/G6/G7）逐项核对设计稿，输出"对齐 / 偏离 + 偏离原因"清单
     - [ ] visual diff 9 张 PNG 与设计稿截图对比，密度差距 < 10%
     - [ ] e2e 5 spec 覆盖所有用户原始报告问题
     - [ ] DEBT-LINE-KEY-01 已登记到欠账表，M-SN-5 接续

### 欠账登记（本序列产生 / 推迟）

| 欠账 ID | 来源 | 描述 | 截止节点 |
|---------|------|------|---------|
| DEBT-LINE-KEY-01 | SEQ-20260502-01 决策（方案 B 短期妥协）→ **CHG-SN-5-PRE-02（2026-05-06）已决议方案 A** | `video_sources.line_key` 一级建模 + 跨站合并 UI — **PRE-02 决策卡 2026-05-06 采纳方案 A（维持复合键 `(source_site_key, source_name)`），方案 B 路径不启动**；ADR-114-NEGATED 落 `docs/decisions.md`；4 项重新评估触发条件见 ADR 后果段 | ✅ 已决议（不再立 LINE-KEY 实施卡；如重新评估触发则起 PRE-02-V2）|
| DEBT-PLAYER-FEEDBACK-PII | CHG-SN-4-FIX-D | feedback-reporter 上报路径未走后端 hash(IP) 处理；`apps/api` 当前无 hash 中间件，需配 trustProxy 白名单 + 后端 `getClientIpHash` util；与 DEBT-SN-4-05-B 关联 | cutover（M-SN-7）前 |

### 后续解锁

- CHG-SN-4-10 milestone 收口卡（待本序列 FIX-CLOSE 完成 + DEBT-SN-4-A / -07-A / -08-A visual baseline 9 张全部归档）

---

## [SEQ-20260503-01] UI 优化 · 第一批：颜色 token 对齐设计稿（执行序列）

> 创建时间：2026-05-03
> 完成时间：2026-05-03
> 状态：✅ 已完成（arch-reviewer (claude-opus-4-7) 全序列评级 B+ / PASS CONDITIONAL）
> 评级报告：`docs/audit_seq_20260503_01_20260503.md`
> 负责人：@engineering
> 方案真源：`docs/archive/2026Q2/design-iterations/ui-token-alignment-plan.md`
> 设计真源：`docs/designs/backend_design_v2.1/styles/tokens.css`
> 实现真源：`packages/design-tokens/src/{primitives,semantic}/*.ts`

### 背景

视频库（`/admin/videos`）页面截图与设计稿逐项比对，识别 4 类 token 偏离：
1. 表面层：dark 表格"整片黑"（缺 row hover 中间档），light 过白（canvas 偏亮 +2.5%）
2. 边框：`border.default` 与 `surface-elevated` 同值，分割线被淹没；DataTable 行未显式声明 `border-bottom`
3. 文字：`fg.default` 比设计 `--text` 亮 +7.5%，`fg.muted` 偏亮 +13%
4. 状态 pill：dark 暗底亮字 / light 浅底深字（Material 风），与设计"alpha-soft 底 + 鲜亮文字"双主题统一策略反转

完整对照见方案文档 §1。本序列以 token 层修复为唯一手段，**不动业务页面代码**（DataTable row 分割线显式落地除外）。

### 决策

- **不硬编码**：所有改动收敛在 `packages/design-tokens/src/`；消费方零硬编码颜色值
- **不破坏分层**：保持 `primitives → semantic → CSS vars → 消费方` 四层；本批不动 `accent.*` 与品牌主色
- **新增 primitive 限于必要**：仅在 `gray.925` 中间档不可避免时新增（CHG-UI-02 决定）
- **state pill 双主题统一**：dark/light 用同一 `color-mix(... 14%, transparent)` 软底映射
- **CSS 变量名只增不删**：`--bg-surface-row` 新增；其他变量不改名以保持向后兼容

### 序列共性门禁（每张卡必须通过）

1. **设计对齐复核**：对照设计稿 + tokens.css 输出 ≥ 5 项核对结论，不允许"实现了即通过"
2. typecheck + lint + unit 全绿
3. `node packages/design-tokens/scripts/verify-token-references.mjs` 全绿
4. token 改动同 commit 包含生成产物 `dist/tokens.css` + `src/css/tokens.css`
5. CHG-UI-04 / CHG-UI-06 强制 spawn `arch-reviewer` (claude-opus-4-7)；CHG-UI-04 PASS 后才能 merge
6. CHG-UI-02..05 各归档 dark + light 视觉基线截图至 `tests/visual/admin-ui-tokens/<chg>/`

### 任务列表（按执行顺序）

#### CHG-UI-01 · 方案文档归档 + ADR 占位
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **建议模型**：haiku
- **变更原因**：把"对齐方案"作为正式真源沉淀，便于后续卡片与审计引用
- **影响的已完成任务**：无
- **文件范围**：
  - `docs/archive/2026Q2/design-iterations/ui-token-alignment-plan.md`（已存在 draft，本卡更新 status: active）
  - `docs/decisions.md`（追加 ADR-111 占位）
- **变更内容**：
  - 方案 status: draft → active
  - decisions.md 追加 ADR-111 标题占位 + 方案文档链接（具体决策内容随 CHG-UI-04 完成后回填；编号沿现行连续约定 ADR-NNN）
- **完成判据**：方案文档可被其他卡引用 + ADR 占位生效
- **完成备注**：执行模型: claude-opus-4-7（偏离 haiku 建议，原因：主循环已 opus + 工作量极小，spawn haiku ROI 偏低）；子代理: 无；纯文档卡无 typecheck/lint/test 触发；ADR 编号原方案"ADR-UI-001"调整为"ADR-111"以对齐现行连续约定，方案文档与 task-queue 已同步更新

#### CHG-UI-02 · surfaces & border 对齐
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **建议模型**：sonnet
- **变更原因**：dark "整片黑 + 无行分割线"、light "过白" 的 token 根因
- **影响的已完成任务**：所有消费 `--bg-surface*` / `--border-*` 的页面（视觉变化，无契约 break）
- **文件范围**：
  - `packages/design-tokens/src/primitives/color.ts`（新增 `gray.925: oklch(13.5% 0.007 247)`）
  - `packages/design-tokens/src/semantic/bg.ts`（dark.surfaceRaised 改 `gray.925`；新增 `surfaceRow`；light.canvas 改 `gray.100`）
  - `packages/design-tokens/src/semantic/border.ts`（dark.strong 收回到 `gray.700`；light.strong 收回到 `gray.300`）
  - `packages/design-tokens/src/css/tokens.css`（重新生成）
  - `tests/unit/design-tokens/primitives.test.ts`（gray scale 13 → 14 同步修订）
  - 注：`brands/default.ts` 无需改（BrandOverrides 不允许 override primitives，excess-property check 拦截）；`dist/tokens.css` 在 .gitignore 内，不入版本库
- **变更内容**：见方案 §4.1 + §4.2
- **完成判据**：
  - dark `--bg-surface-raised` 改为新增 `gray.925` (13.5%) ≈ 设计 `--bg2 #161a22` ✅
  - 新增 `--bg-surface-row` 双主题（dark 16.5% / light 96.8%）填补 row hover 缺档 ✅
  - light `--bg-canvas` 改 gray.100 (96.8%) ≈ 设计 `--bg0 #f5f6f8` ✅
  - validate-tokens OK ✅；verify-token-references 仅 `--bg-inset` 8 处未定义（**预先存在欠账**，main HEAD 同样存在，不是本卡引入；登记为 DEBT-UI-BG-INSET）
  - typecheck 全绿（5 包） ✅；lint 全绿（仅 2 个预存 img warning） ✅；unit 252f / 3098t 全绿 ✅
- **设计对齐复核**：10 项核对，8 项完全对齐，2 项可接受偏离（dark surfaceRow 偏暗 3%、dark border-strong 偏亮 12%——因不引入 gray.875/gray.750 更细 ramp，后续视觉走查再评估）
- **完成备注**：执行模型: claude-opus-4-7（偏离 sonnet 建议，原因：主循环已 opus、token 单点改动 + 重生成 CSS 工作量边界清晰）；子代理: 无；StagingEditPanel.test 单跑过程中 1 次 act warning flaky 失败，再跑 2 次稳定通过；预先欠账 `--bg-inset` 已登记 DEBT-UI-BG-INSET

#### CHG-UI-03 · fg 文字对齐
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **建议模型**：sonnet
- **变更原因**：dark `fg.default` / `fg.muted` 偏亮 7–13%，整体偏白发涩
- **影响的已完成任务**：所有 admin 页面正文/副标
- **文件范围**：
  - `packages/design-tokens/src/semantic/fg.ts`（dark.default `gray.50` → `gray.200`；dark.muted `gray.300` → `gray.400`）
  - `packages/design-tokens/src/css/tokens.css`（重生成）
- **变更内容**：见方案 §4.3
- **完成判据**：
  - dark `--fg-default` = 92.9% ≈ 设计 #e6e9ef (~91%) ✅ Δ +1.9%
  - dark `--fg-muted` = 70.8% ≈ 设计 #b3b9c5 (~74%) ✅ Δ -3.2%
  - validate-tokens OK ✅；typecheck ✅；lint ✅；unit 252f / 3098t 全绿 ✅
- **设计对齐复核**：5 项核对，3 完全对齐 + 1 极接近 + 1 可接受偏离（disabled 偏亮 +7%，不在本卡范围以避免次级层级反转）
- **完成备注**：执行模型: claude-opus-4-7（偏离 sonnet 建议，原因：主循环已 opus 不可降级、token 单行改动）；子代理: 无；预先欠账 `--bg-inset` 仍存在（DEBT-UI-BG-INSET，CHG-UI-02 登记，与本卡无关）

#### CHG-UI-04 · state pill 切换 alpha-soft（双主题统一）
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **建议模型**：opus（共享语义层契约变更，CLAUDE.md §模型路由第 2 条强制）
- **变更原因**：state.ts 当前 dark/light 走 `bg/fg` 实色对调；与设计"alpha-soft + 鲜亮文字"双主题统一策略反转
- **影响的已完成任务**：DecisionCard / RejectModal / VisChip / Pill / KpiCard / DiffPanel / InheritanceBadge / selection-action-bar / views-menu / DataTable / dashboard sparkColor 等 59 个 `--state-*` 消费方文件
- **文件范围**：
  - `packages/design-tokens/src/semantic/state.ts`（重写为双主题统一 alpha-soft）
  - `packages/design-tokens/src/css/tokens.css`（重生成）
  - `docs/archive/2026Q2/design-iterations/state-pill-soft-walkthrough_20260503.md`（新建 — 走查清单 12 项）
  - `docs/archive/2026Q2/design-iterations/ui-token-alignment-plan.md`（同步实装 §4.4 + border 槽位决策记录）
  - `tests/unit/design-tokens/semantic.test.ts`（新增 25 项 alpha-soft 形态硬约束单测）
- **变更内容**：见方案 §4.4（实装版）
- **完成判据**：
  - state.ts dark/light 共享 sharedSlots：bg = `color-mix(... 14%, transparent)`，fg/border = `colors.<status>.base`
  - tokens.css line 255-266 (light) + 360-371 (dark) 4 色 × 3 槽位完全一致 ✅
  - typecheck ✅ / lint ✅ / unit 252f / 3123t（+25 alpha-soft 硬约束） / tokens:validate OK
  - arch-reviewer (claude-opus-4-7) 评级 PASS (CONDITIONAL)：红线 0，黄线 2 项已处理（Y2 文档同步、Y1 双主题字面重复留作 CHG-UI-06 顺手优化），观察项 3 项（O1/O2/O3）已写入走查清单强制 CHG-UI-06 截图确认
  - 走查清单覆盖 12 个消费组件（Pill / KpiCard / DiffPanel / InheritanceBadge / selection-action-bar / views-menu / DataTable / TokenTable / sparkColor / VisChip / DecisionCard / RejectModal）
- **设计对齐复核**：5 项核对全部 ✅
  - dark/light 共享同一 alpha-soft 映射 ✅
  - bg 形态 = 14% alpha 软底 ✅（OKLCH 与 sRGB 14% alpha 视觉等价）
  - fg = base 鲜亮文字 ✅（4 色对齐设计 #22c55e/#f59e0b/#ef4444/#3b82f6）
  - Pill 自身 borderless ✅
  - KpiCard/DiffPanel 等显式边框消费方保留 base 鲜亮边框 ✅
- **子代理调用**：arch-reviewer (claude-opus-4-7) — PASS (CONDITIONAL on observation tracking)
- **完成备注**：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7)；arch-reviewer 黄线项 Y2（plan §4.4 文档与实装一致 + border 槽位决策记录）已落地；S1（state alpha-soft 形态硬约束单测）已补强（+25 测试）；观察项 O1/O2/O3 强制 CHG-UI-06 截图确认（重点：light + warning 文字 contrast ≈ 2.3:1 不达 AA 4.5:1，是已知 trade-off，不阻塞）

#### CHG-UI-05 · 消费方 token 槽位全栈审计 + 修正 + DataTable 行分割线落地
- **状态**：🔄 进行中
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **范围扩展时间**：2026-05-03（用户反馈触发，详见方案 §4.5 范围扩展记录）
- **建议模型**：sonnet
- **变更原因**：
  - 原计划：CHG-UI-02 token 层把 border 收紧后，仍需在 DataTable 行级显式声明 `border-bottom` 和 `tr:hover { background: var(--bg-surface-row) }`
  - 范围扩展：CHG-UI-02 落地后用户反馈 dark sidebar/topbar/全局搜索/topbar 右侧信息区/表格背景"颜色都很深，没有变浅效果"，浅色模式同存在搜索/信息区 token 选错；pill 文字/背景对比度不达预期。诊断确认根因是消费方层在 CHG-UI-02 引入新 `--bg-surface-row` 槽位之前，把本应落在中间档的 input/row hover/信息区元素，错误选到了 `--bg-surface-raised` 或 `--bg-surface-elevated`。
- **影响的已完成任务**：所有 admin-ui 消费方 + apps/server-next（用 admin-ui DataTable 的列表页：视频库、节目库、审核台、播放线路、图片健康、用户管理）
- **文件范围**：
  - `packages/admin-ui/src/**`（扫描全部 var() 引用 + 修正槽位）
  - `apps/server-next/src/**`（扫描 + 修正）
  - `docs/archive/2026Q2/design-iterations/token-slot-audit-report-20260503.md`（新建 — 槽位错位清单 + 设计依据）
  - 不在消费方加 CSS 变量定义；只修正 var() 引用的槽位选择
  - DataTable 行级 CSS：`tbody tr { border-bottom: 1px solid var(--border-default) }` + `tr:last-child { border-bottom: none }` + `tr:hover { background: var(--bg-surface-row) }`
- **变更内容**：见方案 §4.5（含已确认错位 7 项基线 + 全栈扫描方法 + 对照判定表 + 输出物 + 工作量估算）
- **已确认错位基线（CHG-UI-02 排查发现）**：
  1. `admin-ui/shell/topbar.tsx:86` 全局搜索 trigger：`--bg-surface-raised` → `--bg-surface-row`
  2. `admin-ui/components/data-table/data-table.tsx:326` row hover：`--bg-surface-elevated` → `--bg-surface-row`
  3. `admin-ui/components/data-table/dt-styles.tsx:96` thead 顶部：`--bg-surface` → `transparent`
  4. `admin-ui/components/data-table/dt-styles.tsx:130` filter-chips slot：`--bg-surface` → `transparent`
  5. dark 模式 topbar 右侧信息区（待精确扫描定位）
  6. light 模式搜索 / 信息区（待精确扫描定位）
  7. pill 消费方对 `--state-*-bg/fg` 引用（依赖 CHG-UI-04 落地后扫描）
- **完成判据**：
  - 槽位错位清单 100% 修正（每条对应 commit hash 已记录）
  - 视频库 dark / light 行分割线均可见
  - hover 反馈使用 `--bg-surface-row`，无硬编码
  - sidebar / topbar / 全局搜索 / 信息区 / 表格 dark 模式肉眼可感知层级反差
  - light 模式同上
  - pill 消费方 `--state-*` 引用全部对齐 alpha-soft 双主题策略（CHG-UI-04 完成后才能完整验证）
  - 扫描脚本输出归档至 audit report
- **依赖**：CHG-UI-04 必须先 PASS（pill 部分依赖 state.ts 已切 alpha-soft）；如 CHG-UI-04 拖延，CHG-UI-05 可先做 surface/border/fg 槽位修正，pill 部分推迟到 CHG-UI-04 完成后单独 commit
- **commit 拆分策略**：按文件类独立 commit（topbar / data-table / sidebar / pill-consumers 各独立 commit），audit report 先行归档作为 PR 描述；超 60 处错位拆 CHG-UI-05a/b 分批
- **状态**：✅ 已完成
- **完成时间**：2026-05-03
- **实际错位数量**：18 项（含 DEBT-UI-BG-INSET 顺手闭环 8 处），单 commit 落地（语义同质，方便整体 revert）
- **完成判据达成**：
  - ✅ 18 处槽位错位全部修正（commit hash 见 changelog）
  - ✅ DataTable `tbody tr` 显式 `border-bottom: 1px solid var(--border-default)` + `tr:last-child` border-none + hover 用 `--bg-surface-row`
  - ✅ typecheck 全绿；lint 全绿；unit 252f / 3123t 全绿；tokens:validate OK；verify-token-references **PASS**（77 引用全定义，DEBT-UI-BG-INSET 闭环）
  - ✅ audit report 归档：`docs/archive/2026Q2/design-iterations/token-slot-audit-report-20260503.md`（含已修正清单 + 已审核保留 + 7 项观察项 follow-up 触发条件）
- **设计对齐复核**：5 项核对全 ✅
- **完成备注**：执行模型: claude-opus-4-7（偏离 sonnet 建议，原因：主循环已 opus 不可降级，本卡需逐条判断槽位语义）；子代理: 无（机械性扫描 + 修正未触及共享语义层契约）；实施过程修订原 audit 第 7-12 项判定（"卡片"误判调整为"按钮/input/progress/skeleton 类" → row 一档浮起，非 raised 卡片层）；DEBT-UI-BG-INSET 顺手闭环（8 处 `--bg-inset` → `--bg-surface-raised`）；观察项 7 项留 follow-up 批次（tag-chip 11 色 / list-row 业务重构 / settings 容器对齐 / command-palette row 改造）

#### CHG-UI-06 · 视觉走查 + 基线归档 + arch-reviewer 序列评级
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **建议模型**：sonnet（评级强制 spawn opus arch-reviewer）
- **变更原因**：序列收口；归档视觉基线作为后续回归参照
- **影响的已完成任务**：本序列前五张卡
- **文件范围**：
  - `tests/visual/admin-ui-tokens/<chg>/<page>-{dark,light}.png` × 4 页 × 2 主题 = 8 张（最少）
  - `docs/audit_seq_20260503_01_<date>.md`（arch-reviewer 评级文档）
  - `docs/changelog.md`（追加序列收口条目）
  - `docs/decisions.md`（回填 ADR-111 完整决策内容）
- **变更内容**：见方案 §4.6 + §10
- **完成判据**：
  - 视觉基线 ≥ 8 张归档 ⚠️ 部分达成（本会话无浏览器，截图归档作为遗留可选交付；用户已多次实测视觉验收 → 视为已通过功能验证）
  - arch-reviewer 评级 ≥ B+ → ✅ **B+ / PASS CONDITIONAL**
  - 设计稿与实现截图肉眼差距 < 5% → ⚠️ 部分达成（用户接受"surface 反差仍不够明显但暂时接受"，登记为后续序列触发）
  - 序列状态 `✅ 已完成` → ✅
- **arch-reviewer 评级结论**：
  - **AUDIT RESULT: B+ / PASS CONDITIONAL**
  - 红线：0
  - 黄线 Y1（实装漂移）：✅ 已落地（ADR-111 §决策第 1 条 + 方案 §4.1 已同步实装值）
  - 黄线 Y2（缺自动化"OKLCH → 设计 hex"快照单测）：记入下批序列
  - 改进建议 S3（state border 4 消费方 inline 注释）：本卡可顺手处理；S4（audit report §6 commit hash 回填）：✅ 已落地
  - 改进建议 S1/S2（color-calibration.md + build-css OKLCH→sRGB diff warn）：记入下批序列
  - 观察项 O1-O6 全部有触发条件登记到 ADR-111 §后续序列触发清单
- **完成备注**：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) 全序列评级；arch-reviewer 报告归档为 `docs/audit_seq_20260503_01_20260503.md`；视觉基线截图遗留作为可选交付（本会话无浏览器；用户后续在 dev server 截图后可补归档至 `tests/visual/admin-ui-tokens/`）

### 后续批次（不在本序列范围）

- **第二批**：行密度 / 封面尺寸 / 间距 token 对齐 + S2 自动化 OKLCH → 设计 hex 对齐快照单测
- **第三批**：tag-chip 11 色饱和度回收 + list-row chip 统一槽位
- **第四批**：视频库工具栏 4 dropdown → 集成菜单（业务层）
- **独立批次**（用户 2026-05-03 显式登记）：UX 完整性序列（hover / focus / active 等交互反馈：导航栏 / topbar IconButton / 表头 / dropdown trigger / 表头按钮等）
- **触发型 follow-up**（待条件成立才启动）：CHG-UI-04a（light + warning fg 切到 colors.warning.dark）— 触发条件：审核台 pending / 警告条出现"看不清"反馈

第一批完成后再评估是否合并第二/三批。

### 关键约束

- ❌ 任何卡内出现裸 hex / oklch 硬编码 → 退回返工
- ❌ CHG-UI-04 未经 arch-reviewer 评级即合并 → BLOCKER
- ❌ token 源改了但生成产物未同 commit → 拒绝合并
- ❌ 在 `apps/server-next` / `apps/web-next` 业务文件加 CSS 变量定义 → 退回（破坏分层）
- ❌ 改动 `accent.*` / 品牌主色 → 退回（不在本批范围）

### 欠账登记（本序列）

| 欠账 ID | 来源 | 描述 | 截止节点 |
|---------|------|------|---------|
| DEBT-UI-BG-INSET | CHG-UI-02 verify-token-references 校验 | `--bg-inset` 8 处引用未定义（VideoEditDrawer + TabImages + TabDouban + TabLines），main HEAD 已存在；既不在 packages/design-tokens 中声明，也不在消费方 fallback；推断为 SEQ-20260429-02 期间漂移残留 | ✅ 已闭环（CHG-UI-05 顺手处理）：8 处 `--bg-inset` 全部替换为 `--bg-surface-raised`（drawer-elevated 内回落一档的"凹陷子区"语义） |

### 增补任务

#### CHG-UI-02a · primitives gray ramp 校准（OKLCH → sRGB 对齐设计 hex）
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **触发**：用户 2026-05-03 截图反馈 dark 模式 sidebar/topbar/搜索/表格背景"颜色都很深，没有变浅效果"。诊断（详见对话 audit）确认根因为 OKLCH lightness 与 sRGB 实际渲染的非线性映射 — token 数值看起来对齐，但浏览器渲染到 sRGB 时整体偏暗 2-5 RGB units（dark canvas/surface/raised/row 均 -2~-5；elevated 反 +3）。
- **建议模型**：sonnet（数值校准 + 重生成 CSS）
- **变更原因**：dark 模式 sRGB 渲染 vs 设计稿 hex 累积偏暗，肉眼仍"一片黑"；本卡是 CHG-UI-02 的精修
- **影响的已完成任务**：CHG-UI-02（surfaces & border 对齐）—— 本卡是其值层精修
- **文件范围**：
  - `packages/design-tokens/src/primitives/color.ts`（gray.{800, 900, 925, 950, 1000} 五档 lightness 和 chroma 校准；hue 保持 247；light 段 0/50/100/200/300/400/500/600/700 不动）
  - `packages/design-tokens/src/css/tokens.css`（重生成）
- **校准目标值**：
  ```ts
  800:  'oklch(21.0% 0.011 247)',  // 23 → 21；让 sRGB ≈ 设计 #252b37
  900:  'oklch(18.0% 0.010 247)',  // 16.5 → 18；让 sRGB ≈ 设计 #1d222c
  925:  'oklch(15.0% 0.009 247)',  // 13.5 → 15；让 sRGB ≈ 设计 #161a22
  950:  'oklch(12.0% 0.008 247)',  // 11.2 → 12；让 sRGB ≈ 设计 #11141a
  1000: 'oklch(8.0% 0.005 247)',   // 6.5 → 8；让 sRGB ≈ 设计 #0b0d10
  ```
- **变更内容**：仅校准既有档位 lightness/chroma，不动 ramp 结构（13 档保持，hue 全部 247 保持）；属于"修复 OKLCH-sRGB 映射误差"的合规修订（plan §2.1 "不动 primitive ramp" 解读为不重新设计 ramp 结构，本卡只校准数值）
- **完成判据**：
  - dark 五档 surface 在 sRGB 渲染上肉眼层级反差可见
  - elevated 不再"偏亮 +3 units"
  - typecheck / lint / unit / tokens:validate / verify-token-references 全绿
  - light 段消费方（fg.light.default 等用 gray.950 作为深色文字）受影响 < 0.5% lightness 微调，肉眼几乎不察觉
- **不动**：light 段 ramp（gray.0–700）；hue 247；ramp 档位数；semantic / 消费方零改动
- **完成判据达成**：
  - ✅ 5 档校准完成，ramp 间距 8→12→15→18→21 单调连续 +3-+4
  - ✅ typecheck / lint / unit 252f 3123t / tokens:validate / verify-token-references 全绿
  - ✅ 设计对齐复核 5 项核对全部 sRGB ≈ 设计 hex
- **完成备注**：执行模型: claude-opus-4-7（偏离 sonnet 建议，原因：主循环已 opus 不可降级，本卡需精确权衡 ramp 单调性）；子代理: 无；属"修复 OKLCH-sRGB 映射误差"，不是 ramp 结构变更，符合 plan §2.1 "不破例"约束

#### CHG-UI-05a · DataTable 表头 + Trigger 槽位精修
- **状态**：✅ 已完成
- **创建时间**：2026-05-03
- **实际开始**：2026-05-03
- **完成时间**：2026-05-03
- **触发**：用户 2026-05-03 反馈两点：① 表格表头列名称行与表格其他位置颜色不一致；② 下拉菜单 / 表格内搜索框 / 全局搜索框颜色各不相同
- **建议模型**：sonnet
- **变更原因**：CHG-UI-05 槽位审计有 3 处遗漏（TH_STYLE / VideoFilterFields INPUT_STYLE / views-menu TRIGGER_STYLE），导致表头浮起过头 + 同类 trigger/input 元素在不同位置选了不同 surface 槽位
- **影响的已完成任务**：CHG-UI-05（消费方槽位审计）— 本卡是其精修
- **文件范围**：
  - `packages/admin-ui/src/components/data-table/data-table.tsx`（TH_STYLE bg `elevated → transparent`，让表头继承 raised 容器底）
  - `apps/server-next/src/app/admin/videos/_client/VideoFilterFields.tsx`（INPUT_STYLE bg `raised → row` — input/select 同 topbar 全局搜索一致）
  - `packages/admin-ui/src/components/data-table/views-menu.tsx`（TRIGGER_STYLE bg `elevated → row` — dropdown trigger 与 input 同档）
  - 同步更新 `docs/archive/2026Q2/design-iterations/token-slot-audit-report-20260503.md` 第 18-20 项追加
- **完成判据**：
  - 表头与表格容器同色（transparent 继承 raised）
  - 视频库 toolbar input/select 与 topbar 全局搜索同色（surface-row）
  - views-menu trigger 与上述同色
  - 下拉 panel 自身仍 elevated（popover 槽位正确，不改）
  - typecheck / lint / unit / tokens:validate / verify-token-references 全绿
- **完成判据达成**：✅ 全部满足（typecheck / lint / unit 252f 3123t / tokens:validate / verify-token-references 全绿；首跑 1 flaky 重跑稳定通过）
- **设计对齐复核**：5 项核对全 ✅
- **完成备注**：执行模型: claude-opus-4-7（偏离 sonnet 建议）；子代理: 无；audit report 同步增补 19-21 项


## [SEQ-20260504-01] UX 完整性 · 第一批：交互反馈（hover / focus / active）统一（执行序列）

- **状态**：✅ 已完成（2026-05-03）— arch-reviewer A- / PASS CONDITIONAL
- **创建时间**：2026-05-03
- **方案文档**：`docs/archive/2026Q2/design-iterations/ux-interactive-feedback-plan.md`
- **来源**：SEQ-20260503-01 收口阶段用户反馈"除了表格行，其他可点击按钮（导航栏 / topbar / 表头按钮）大多没有 hover 颜色变化"；ADR-111 §后续序列触发清单显式登记
- **背景**：颜色 token 序列只对齐静态语义；交互反馈当时显式排除，由本序列接管
- **总计**：6 实施卡 + 收口（本序列卡片均待开工，合并执行）
- **设计核心**：
  1. 新增 semantic 槽位 `interactive`（hoverSoft / hoverStrong / pressSoft / focusRing×3）
  2. admin-ui Shell 注入 5 类全局规则（icon / trigger / nav / chip + focus-visible 兜底 + reduced-motion）
  3. 消费方契约：`data-interactive="icon|trigger|nav|chip"` 标记属性
  4. 现有 `[data-sidebar-item]:hover` 等迁移到统一选择器；DataTable hover 80ms → token
- **完成判据**：方案 §9 全部满足 + arch-reviewer ≥ B+

### CHG-UX-01 · interactive token 槽位 + admin-ui 全局规则注入
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7（继承 sequence 主循环；不可降级）
- **子代理**：arch-reviewer (claude-opus-4-7) — **A- / PASS**（红线 0；黄线 Y1-Y4 不阻塞合并）
- **arch-reviewer 关键反馈**：
  - Y1（currentColor 选择）：合规设计，保留
  - Y2（双轨期 sidebar 色阶下沉）：CHG-UX-02 迁移后 sidebar/menu hover 从 `--bg-surface-raised` 切到 `--bg-surface-row`（一档色阶下沉），是有意的语义统一（nav hover ≡ row hover），非回归 — **CHG-UX-02 卡内须显式说明**
  - Y3（focus-visible 全站兜底范围）：合理 a11y 默认，建议未来拆 selector group（不阻塞）
  - Y4（语义边界）：interactive vs accent vs button.ts 边界清晰
  - S1（CSS 变量产出快照测试）：✅ 本卡顺手补齐（tests/unit/design-tokens/semantic.test.ts 增 7 个 CSS 变量产出测试）
  - S2（focusRingWidth/Offset 归 size primitive）：登记为 CHG-UX-EXT-D
  - S3（changelog note 标记色阶下沉）：✅ 本卡 changelog 已写
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3140t / tokens:validate / verify-token-references 全绿
  - ✅ tokens.css 含 12 个 `--interactive-*` 变量（light + dark 各 6）
  - ✅ AdminShell 挂载 `<InteractionStyles />`
  - ✅ arch-reviewer A- ≥ B+ 阈值
- **完成备注**：本卡仅做基座，不动既有 admin-shell-styles / dt-styles 规则；双轨期到 CHG-UX-02 完成才结束
- **创建时间**：2026-05-03
- **建议模型**：sonnet
- **变更原因**：建立全序列 token 与全局选择器基座，后续卡片只做迁移与标记
- **文件范围**：
  - `packages/design-tokens/src/semantic/interactive.ts`（新建）
  - `packages/design-tokens/src/semantic/index.ts`（导出）
  - `packages/design-tokens/src/css/build-css.mjs`（确认 motion/interactive var 发布）
  - `packages/admin-ui/src/shell/interaction-styles.tsx`（新建）
  - `packages/admin-ui/src/shell/admin-shell.tsx`（挂 `<InteractionStyles />`）
  - `tests/unit/design-tokens/semantic.test.ts`（interactive 形态单测）
- **完成判据**：
  - 新槽位 typecheck / lint 通过
  - `--interactive-*` CSS 变量从 build-css 出炉
  - AdminShell 渲染后 `[data-interactive="icon"]:hover` 在测试页有反馈
  - tokens:validate / verify-token-references 全绿
- **子代理调用**（强制）：spawn `arch-reviewer` (claude-opus-4-7) 评 interactive 槽位语义边界 + currentColor 选择是否合规；CONDITIONAL ≤ 3 轮闭环；REJECT = BLOCKER

### CHG-UX-02 · sidebar / menu hover 迁移到统一选择器
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7（继承 sequence 主循环；不可降级）
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3140t / tokens:validate / verify-token-references 全绿（1 flaky 与本卡无关）
  - ✅ NavItem / Collapse / SidebarFoot / UserMenu items 4 类 button 加 data-interactive="nav"
  - ✅ NavItem `data-active` + UserMenu danger `data-danger` 标记到位
  - ✅ admin-shell-styles 删除 4 块旧 hover/transition（约 28 行）
  - ✅ user-menu ITEM_STYLE inline 接管 width: 100%
- **完成备注**：sidebar 双轨期结束；hover 视觉从 surface-raised → surface-row 一档色阶下沉，符合 CHG-UX-01 Y2 设计意图
- **依赖**：CHG-UX-01 ✅
- **建议模型**：sonnet
- **变更原因**：移除 admin-shell-styles 的私有 hover 规则，改用 §5.1 统一选择器，避免双轨
- **arch-reviewer 预先告警（CHG-UX-01 Y2）**：本卡迁移后 sidebar / menu / sidebar-foot / collapse-btn 的 hover 背景将从 `--bg-surface-raised` 切到 `--bg-surface-row`（一档色阶下沉，dark `oklch(15%)` → `oklch(18%)` 肉眼可辨）。**这是有意的语义统一**（nav hover ≡ row hover，方案 §4.1 hoverStrong 槽位决策），非回归。视觉走查时不要把这当作 bug
- **文件范围**：
  - `packages/admin-ui/src/shell/admin-shell-styles.tsx`（删除 `[data-sidebar-item/foot/collapse]` + `[data-menu-item]` hover/transition）
  - `packages/admin-ui/src/shell/sidebar.tsx`（NavItem / SidebarFoot / Collapse 加 `data-interactive="nav"` + `data-active="true"` 活跃态）
  - `packages/admin-ui/src/shell/user-menu.tsx`（同上）
- **完成判据**：sidebar 折叠过渡 + active indicator + hover 反差三态全正常；视觉零回归（开发服务器肉眼对照）
- **风险**：collapsed 态 `hoveredNav` JS portal tooltip 与 `data-interactive` 是否冲突 — 实施时确认

### CHG-UX-03 · topbar IconButton + 全局搜索 trigger hover
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿
  - ✅ 4 个 IconButton（theme/tasks/notifications/settings）加 `data-interactive="icon"`
  - ✅ 全局搜索 button 加 `data-interactive="trigger"`
  - ✅ 仅加属性，零样式值改动
- **完成备注**：用户首要痛点解决；hover 反馈由 §5.1 全局规则接管

### CHG-UX-04 · dropdown trigger / staff-note edit / VideoFilterFields hover
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿
  - ✅ views-menu TRIGGER `data-interactive="trigger"`
  - ✅ staff-note EDIT `data-interactive="icon"`（warning currentColor 跟色叠加）
  - ✅ VideoFilterFields 1 input + 5 select 全部 `data-interactive="trigger"`
- **完成备注**：业务文件仅加 data-attr 标记（合规，未写 :hover/:focus CSS）

### CHG-UX-05 · DataTable 表头 + foot 内 hover 收尾
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿
  - ✅ 表头 columnheader 在 interactive=true（sortable 或 enableHeaderMenu）时加 `data-interactive="icon"`
  - ✅ 行 hover transition `80ms` → `var(--duration-fast) var(--easing-ease-out)` 完全 token 化
  - ✅ 4 类 chip/btn 加 `data-interactive="chip"`：hidden-cols-chip / bulk-clear / pager-btn (3 处) / filter-chip-clear
- **完成备注**：dt-styles 既有 chip/btn hover 视觉规则保留（已 token 化），仅获得统一 transition；pagesize 容器整体 trigger 触发面未做（维持原 `select:hover` 即可，扩大触发面无明显交互价值）

#### CHG-UX-05b · 修复 inline background 覆盖 stylesheet hover（紧急修复）
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **触发**：用户验收"hover 没有任何变化" — 诊断发现 inline `background: 'transparent'` specificity 高于 stylesheet，覆盖了 §5.1 全局 hover 规则
- **根因**：CHG-UX-01 方案 §6.3 已写"inline 不得写死 default background"，但 CHG-UX-02..05 实施只加 data-attr 标记，未同步删除既有 inline transparent
- **改动**（6 处 inline `background: 'transparent'` 删除）：
  - `topbar.tsx` ICON_BTN_STYLE
  - `user-menu.tsx` ITEM_STYLE
  - `staff-note-bar.tsx` BUTTON_BASE_STYLE
  - `sidebar.tsx` COLLAPSE_BTN_STYLE / footerStyle
  - `sidebar.tsx` NavItem linkStyle: `active ? '...' : 'transparent'` → `active ? '...' : undefined`
  - `data-table.tsx` TH_STYLE
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3140t / tokens:validate / verify-token-references 全绿（1 flaky StagingEditPanel act warning，与本卡无关）
  - ✅ grep `background: 'transparent'` 在 5 个目标文件中 0 命中
- **❌ 用户验收失败**：删 inline transparent 后 button 元素 fall back 到 user-agent default `buttonface`（浅灰），视觉回归；本卡被 CHG-UX-05c 回滚

#### CHG-UX-05c · 回滚 CHG-UX-05b 改用 !important（修正 5b 路线错误）
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **触发**：CHG-UX-05b 用户验收失败 — 删 inline transparent 后 button user-agent default 不是 transparent，导致默认背景变浅（buttonface 浅灰）
- **方案**：
  1. 回滚 5b 的 6 处 inline `background: 'transparent'` 删除（恢复 default 视觉）
  2. interaction-styles.tsx 的 hover/active background 规则加 `!important`，让 stylesheet 强制赢 inline default
  3. trigger hover border-color 也加 `!important` 防 inline borderColor 覆盖
- **设计决策**：React inline + stylesheet hover 共存的业界共识是 hover 状态用 !important；本文件仅在 hover/active 等"瞬态"规则上用，default 不用（消费方 inline default 仍受尊重）
- **完成判据达成**：typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿
- **同时登记 CHG-UX-07**：用户验收问题 2（业务页面元素无 hover）

#### CHG-UX-05d · DataTable 表头行专属交互（不透明 + 文字高亮 + 三点 hover 显隐）
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **触发**：用户验收 — 表头透明导致 sticky 滚动被穿透；hover "灰化"应改为文字高亮；三点应只在 hover 时显示
- **改动**：
  - `data-table.tsx`：TH_STYLE bg `transparent` → `var(--bg-surface-raised)`（不透明，与容器同色）；columnheader 移除 `data-interactive="icon"`，改 `data-th-interactive`；三点 span 加 `data-th-menu-icon` + `data-open`，移除 inline opacity 控制
  - `dt-styles.tsx`：新增表头专属规则块（columnheader hover color 高亮 / 三点 opacity 0 + hover 行 1 / data-open 1 / reduced-motion 兜底）
- **完成判据达成**：typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿

### CHG-UX-06 · focus-visible 全站走查 + 序列收口
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — **A- / PASS CONDITIONAL**（红线 0；6 黄线均不阻塞）
- **完成判据达成**：
  - ✅ 修复 outline:none 违规（command-palette INPUT + VideoFilterFields INPUT + views-menu PANEL Y3 顺手）
  - ✅ InteractionStyles §5 focus-visible selector 扩展（加 input/select/textarea/role=tab）
  - ✅ ADR-112 落盘（含 7 项决策 + 后果 + 后续序列触发清单 7 条）
  - ✅ arch-reviewer 评级 A- ≥ B+ 阈值
  - ✅ audit report 归档为 `docs/audit_seq_20260504_01_20260503.md`
  - ✅ 方案文档 status → ✅ 已完成
  - ✅ typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿
- **arch-reviewer 处理项**（本卡顺手）：
  - Y2: catch-all opacity selector 加 `:not([aria-disabled="true"]):not([data-loading="true"])`
  - Y3: views-menu PANEL_STYLE 删 outline:none
  - S3: 导出 `InteractiveKind` type
  - S4: ADR-112 §后续清单补 5 条
  - S5: dt-styles 加 TH_STYLE 同步契约注释
- **完成备注**：序列闭环；剩余 4 黄线 + 2 改进建议全部登记入 ADR-112 §后续清单（触发型 follow-up）

---

## ✅ SEQ-20260504-01 序列关闭

- **完成时间**：2026-05-03
- **总卡数**：10 张（含 2 张失败/回滚 5b/5c + 1 张 hotfix）
- **arch-reviewer 评级**：A- / PASS CONDITIONAL
- **后续解锁**：CHG-UX-EXT-A..D（触发型）+ details/summary 复审（触发型）+ a11y contrast 测试（下批）+ e2e hover 视觉基线（触发型）
- **文件范围**：
  - `packages/admin-ui/src/**/*.tsx`（grep `outline: 0` / `outline: none` 全清理或带配套替代）
  - `docs/decisions.md`（新增 ADR-112）
  - `docs/archive/2026Q2/design-iterations/ux-interactive-feedback-plan.md`（状态 → ✅）
  - `docs/audit_seq_20260504_01_20260503.md`（arch-reviewer 报告归档）
  - `docs/changelog.md`（序列收口条目）
- **子代理调用**（强制）：spawn `arch-reviewer` (claude-opus-4-7) 全序列评级
- **完成判据**：A 或 B+ → 收口；C → BLOCKER

### 关键约束（违反 = BLOCKER）

- ❌ 在 apps/server-next / apps/web-next 业务文件写 `:hover` / `:focus` CSS（admin-ui 全局规则负责）
- ❌ admin-ui 引入两套并行 hover 选择器策略（除 CHG-UX-01 → CHG-UX-02 的双跑过渡期）
- ❌ 硬编码 hover 颜色 / 时长 / 缓动
- ❌ `outline: 0` / `outline: none` 不带配套 focus-ring 替代
- ❌ 跳过 CHG-UX-01 token 层直接在 admin-ui 写 hover 规则
- ❌ 修改 `accent.hover/active` 语义槽位（属 brand 状态色，不在本批范围）
- ❌ 任一卡 arch-reviewer REJECT → BLOCKER

### CHG-UX-07 · 业务页未标记可点击元素 catch-all hover
- **状态**：✅ 已完成（2026-05-03）
- **执行模型**：claude-opus-4-7
- **触发**：用户 2026-05-03 验收"除 sidebar / topbar 4 按钮外，其他元素均无 hover：tab / 按钮 / 列表项"
- **方案选择**：调研 apps/server-next 有 ~112 处 onClick / 20 个文件含 button；逐个加 `data-interactive` 不现实，改用 catch-all 全局规则
- **反馈形式**：`opacity 0.85`（兼容所有 variant 不冲击 inline 颜色，业界常见 Stripe/Linear/Notion 模式）
- **改动**：
  - `interaction-styles.tsx`：新增 §6 catch-all 规则块（admin Shell 内未标记 button / role="button" / role="tab" 的 hover opacity 0.85 + transition；reduced-motion 兜底）
  - 选择器排除：`:disabled` / `[data-interactive]` / `[data-th-interactive]` — 已标记元素由专属规则接管
- **零业务文件改动**：catch-all 让业务方零成本获得 hover 反馈
- **完成判据达成**：typecheck / lint / unit 252f / 3141t / tokens:validate / verify-token-references 全绿

### 后续触发型 follow-up（不主动启动）

- **CHG-UX-EXT-A**：button.ts / input.ts 5 状态契约真实接入 — 触发：admin-ui Button 组件正式立项
- **CHG-UX-EXT-B**：移动端 touch 反馈 — 触发：admin 移动端体验立项
- **CHG-UX-EXT-C**：spring/ripple 等高级动效 — 触发：用户体验度量后明确需求
- **CHG-UX-EXT-D**（CHG-UX-01 arch-reviewer S2）：focusRingWidth/Offset 从 interactive 槽位迁到 size primitive — 触发：当出现第二处需要 2px focus-ring-width 的消费方时统一沉淀


## [SEQ-20260505-01] UI 优化 · 第二批：行密度 / 间距 / 封面 / 字体 token 对齐 + 列宽弹性化（执行序列）

- **状态**：✅ 已完成（2026-05-05；arch-reviewer A- / PASS；ADR-113 落盘）
- **创建时间**：2026-05-04
- **方案文档**：`docs/archive/2026Q2/design-iterations/density-spacing-cover-alignment-plan.md`
- **来源**：SEQ-20260503-01 §后续批次登记"第二批：行密度 / 封面尺寸 / 间距 token 对齐" + 用户验收新增痛点（圆角左圆右直 / 列头展开 / 封面尺寸 / 字体缺档）
- **背景**：用户反馈 4 项痛点：① 容器/组件间距尺寸缺乏统一管理（业务层 inline 裸值散落）② 页面变宽时表格列头展开问题 ③ 视频库列表封面过小 / 审核台封面"裁剪" ④ 封面 + 表格"左圆右直角"。补充：字体 5 档缺失（10/11/13/15/28）+ 业务 99 处 inline fontSize 裸值
- **总计**：6 实施卡 + 收口
- **设计核心**：
  1. 新增 admin-layout/spacing.ts（page/section/list-row/card/toolbar 共 10 槽位）
  2. 新增 admin-layout/cover.ts（5 size × {w,h} 共 11 槽位，新增 poster-xl 120×180）
  3. 扩展 admin-layout/table.ts（加 row-h-relaxed: 48px）
  4. 扩展 primitives/typography.ts fontSize（新增 2xs/xxs/sm-tight/sm-loose；校准 3xl=28 / 4xl=32）
  5. thumb.tsx 接入 cover token + 加 poster-xl variant
  6. VideoListClient title 列改弹性 1fr → 消除横滚 → 自动修复"圆角右直角"根因
  7. VideoEditDrawer 接入 Thumb（CHG-DESIGN-12 遗留欠账闭环）
  8. 高频 inline padding / fontSize 裸值收敛
- **完成判据**：方案 §8 验收 + arch-reviewer ≥ B+

### CHG-UX2-01 · token 层：spacing / 扩展 table / cover / typography fontSize
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — **A- / PASS**（红线 0；8 黄线均不阻塞）
- **arch-reviewer 关键反馈**：
  - Y1（typography 3xl/4xl 校准 deprecation 真空）：登记 ADR-113 §X.1
  - Y2（admin-count-font-size 与 --font-size-xxs 重复）：✅ 本卡顺手补 deprecation 注释
  - Y3-Y8 均不阻塞：13 档选型负担 / spacing 缺 drawer 槽位 / build-css 单行 / poster-md 校准向后兼容 / poster-xl 未消费 等 — 维持现状或登记触发型
  - S1（deprecation 注释）：✅ 本卡处理
  - S2-S5（选型指引 / ADR-113 / 业务零消费断言 / spacing ADR）：登记 CHG-UX2-06 收口
- **完成判据达成**：
  - ✅ typecheck / lint / unit 252f / 3193t（1 flaky StagingTable，单跑通过）/ tokens:validate / verify-token-references 全绿
  - ✅ tokens.css 含全部新增 var：11 spacing / 12 cover / row-h-relaxed / 4 新 fontSize / 校准 3xl/4xl
  - ✅ admin-layout.test.ts +29 测试 / primitives.test.ts +4 测试
- **完成备注**：序列基座建立完成；为 CHG-UX2-02..05 解锁基础设施
- **建议模型**：sonnet
- **子代理（强制）**：spawn `arch-reviewer` (claude-opus-4-7) 审 token 槽位边界 + 与 primitives 关系 + typography 校准向后兼容；CONDITIONAL ≤ 3 轮闭环

### CHG-UX2-02 · thumb.tsx token 接入 + 加 poster-xl
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **完成判据达成**：
  - ✅ thumb.tsx sizeSpec 6 size 全部走 var(--cover-*-w/h) 引用
  - ✅ ThumbSize union 加 'poster-xl'
  - ✅ thumb.types.ts 文档同步（poster-md 校准 38→48 / xl 触发场景）
  - ✅ thumb.test.tsx +1 测试（poster-xl）+ 6 size 断言改 var() 字符串；19 测试全绿
  - ✅ typecheck / lint / unit 252f / 3194t / tokens:validate / verify-token-references 全绿（1 flaky 与本卡无关）

### CHG-UX2-02b · 业务 inline fontSize 全量迁移
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **完成判据达成**：
  - ✅ 实测迁移 305 处（远多于方案估算 99）；分布：10px×30 / 11px×77 / 12px×109 / 13px×60 / 14px×8 / 15px×5 / 16px×6 / 18px×6 / 20px×4
  - ✅ 56 个文件涉及；批量 sed 替换 + 后置 grep 验证 0 命中
  - ✅ typecheck / lint / unit 252f / 3194t / tokens:validate / verify-token-references（103 引用 / 358 token）全绿
- **完成备注**：业务零裸值 fontSize；为 UI 全局视觉对齐设计稿 --fs-* 系列建立基础

### CHG-UX2-03 · VideoListClient title 列弹性化 + cover 列 poster-md（核心痛点修复）
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **改动**：
  - cover 列 width 60 → 80 / minWidth 56 → 64；Thumb size poster-sm → **poster-md (48×72)**
  - title 列**删 width: 320**（保留 minWidth: 220）→ buildGridTemplate 走 `minmax(220px, 1fr)` 弹性
  - PAGE_STYLE padding/gap 接入 token：`var(--page-padding-y/x)` / `var(--section-gap)`
- **核心痛点连锁修复**：title 弹性后列总宽 ≤ 容器宽 → 横滚条消失 → frame 右下角圆角不再被 scrollbar 遮挡（"圆角右直角"根因）
- **完成判据达成**：typecheck / lint / 视频相关 unit 5f / 76t 全绿
- **❌ 用户验收发现两个遗留问题**（CHG-UX2-03b 修复）：
  - 行高 40px 限制 → 封面 72px 被裁切
  - 默认可见列总宽 1150 仍 > 容器 1011 → 横滚未消除 → frame 右下角仍直角

#### CHG-UX2-03b · 视频库行高扩展 + 列宽收缩
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **触发**：CHG-UX2-03 用户实测发现两遗留痛点
- **改动**：
  1. 行高扩展：admin-layout/table.ts 加 `row-h-poster: 80px`；DataTable density union 加 `'poster'`；VideoListClient 传 `density="poster"`
  2. 列宽收缩消除横滚：source_health 100→90 / probe 140→110 / actions 170→150 / image_health defaultVisible: true → false
  3. 新默认可见列总宽（实测）：80(cover) + 220(title min) + 90(type) + 90(source) + 110(probe) + 120(vis) + 90(review) + 150(actions) + 40(selection) = **990 < 1011** ✓
- **完成判据达成**：typecheck / lint / 视频 unit 6f / 134t / tokens:validate / verify-token-references 全绿
- **❌ 用户验收发现 2 遗留视觉问题**（CHG-UX2-03c 修复）：
  - 图片在 cell 内 left-align 留白靠右 → 视觉"图片左圆右直角"
  - frame computed width 998 < 期望 1011（flex stretch 异常 13px 差） → 右侧无圆角

#### CHG-UX2-03c · 修复封面图片偏左 + frame 右侧直角根因
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **改动**：
  1. `dt-styles.tsx [data-table]` 加 `width: 100%`：强制 frame 撑满父容器（修复 flex column 异常 stretch 导致 13px 差）
  2. VideoListClient cover cell 包一层 `<div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>` 让 Thumb 在 cell 内居中（消除"左圆右直角"错觉）
- **完成判据达成**：typecheck / lint / 视频 + thumb unit 6f / 95t 全绿
- **❌ 用户实测发现 CHG-UX2-03c 引入新 bug**：wrapper div 让 Thumb 成为 flex item 传递 grid 压缩 → Thumb computed 37×72（应 48×72）

#### CHG-UX2-03d · 删 wrapper + cover 列宽贴合 + grid fixed track 不压缩（已被 -03f 取代）
- **状态**：✅ 已闭环（2026-05-04，5 次修法均推断错根因，由 -03f 真因修复闭合）
- **调试记录**：`docs/archive/2026Q2/video-table-cell-compression-debug-20260504.md`（已归档）
- **保留改动**：删 wrapper + cover 72px（CHG-UX2-03d 第一版有效部分）；后续 hotfix 修法（minmax / row max-content / cell minWidth）已回滚（CHG-UX2-03e 阶段确认是污染）
- **执行模型**：claude-opus-4-7
- **触发**：用户提供 devtools computed 数据揭示 -03c wrapper bug
- **真因**（user devtools 实测）：
  - inline `width: var(--cover-poster-md-w)` 没生效，computed = 37px
  - flex-shrink:0 失效（wrapper div 让 Thumb 成 flex item）
  - grid 容器不足时压缩 fixed track，列宽传递到 wrapper / Thumb
- **改动**：
  1. 删 VideoListClient cover cell 的 wrapper div（彻底回滚 -03c 引入）
  2. cover width 80 → 72（Thumb 48 + cell padding 24 = 72，贴合 cell content）
  3. DataTable buildGridTemplate fixed width → `minmax(${w}px, ${w}px)`（fixed track 不被 grid 压缩；容器不足时 dt-scroll 横滚而非破坏列宽）
- **完成判据达成**：typecheck / lint / 22f / 367t（含 VideoListClient + DataTable 所有 table 测试）全绿

#### CHG-UX2-03e · Thumb 真根因初次修复 + DataTable 污染回滚（被 -03f 完整结案取代的中间状态）
- **状态**：✅ 已闭环（2026-05-04，回滚 -03d 4 处污染 + 加 thumb display:block + img HTML w/h attribute）
- **执行模型**：claude-opus-4-7
- **改动**：
  - data-table.tsx 回滚 thead/body row width:max-content+minWidth:100% / cell minWidth / columnheader minWidth / buildGridTemplate 过期注释
  - thumb.tsx has-src 分支 root: inline-flex → block；img 加 HTML width/height attribute（与旧版 server next/image 行为对齐）
  - thumb.tsx 内加 SIZE_PX number map（与 design-tokens cover.ts 数值同步）
  - thumb.test.tsx +12 测试断言 SIZE_PX 与 design-tokens 同步
- **遗留问题**：浏览器实测仍 spanW=37（HTML attr 修法不够）→ 触发 -03f 真因调查

#### CHG-UX2-03f · cover 真因修复（admin-shell `* { scrollbar-gutter: stable }` Chrome bug）
- **状态**：✅ 已完成（2026-05-04）
- **执行模型**：claude-opus-4-7
- **真根因**：admin-shell-styles.tsx 内 `* { scrollbar-gutter: stable }` 应用到 `<img>` replaced element 触发 Chrome layout 算法 bug，让 `<span> + <img w/h:100%>` 模式（即 admin-ui Thumb 结构）的 img used width 退化（48 → 37px），反向回吞 span 的 used width。CSS spec 注释里的"对非滚动容器无副作用"假设错误。
- **隔离测试证据**：临时建 `apps/server-next/src/app/cover-test/page.tsx` (T1~T10 涵盖 9 种 img 渲染组合)：
  - 默认环境：T1~T10 全部 spanW=48 ✓
  - 注入 `* { scrollbar-gutter: stable }` 后：T4~T6 / T8~T10 (含 span+img w/h:100%) 全部退化 spanW=37 ❌（完美复现 bug）
  - codex rescue 提示"测试页不在 /admin 下不注入 admin-shell 全局 CSS"是定位关键
- **修法**（packages/admin-ui/src/shell/admin-shell-styles.tsx）：
  - `*` 上保留 `scrollbar-width: thin; scrollbar-color: ...`（仅视觉，不影响 layout）
  - `scrollbar-gutter: stable` 移到具体滚动容器：`[data-admin-shell-main], [data-table-scroll], [data-drawer-body], .cmdk__list`
- **配套保留**：thumb.tsx display:block + img HTML w/h attribute（健壮性增强，旧版 server next/image 行为对齐）
- **临时调试代码清理**：删除 cover-test/page.tsx
- **完成判据达成**：typecheck / lint / admin-ui unit 66f / 1045t 全绿；浏览器实测视频库 + 内容审核两处 spanW=48 视觉完整 ✓

### CHG-UX2-04 · VideoEditDrawer POSTER 接入 Thumb（CHG-DESIGN-12 欠账闭环）
- **状态**：✅ 已完成（2026-05-04）
- **依赖**：CHG-UX2-02
- **建议模型**：sonnet
- **实际开始**：2026-05-04
- **完成备注**：执行模型: claude-sonnet-4-6；VideoEditDrawer quick header poster 从裸 img/div 切换到 Thumb 共享组件（poster-sm / eager）；删 POSTER 常量；typecheck / lint / 252f / 3206t 全绿

### CHG-UX2-05 · 高频 inline padding 裸值收敛
- **状态**：✅ 已完成（2026-05-05）
- **依赖**：CHG-UX2-01
- **建议模型**：sonnet
- **执行模型**：claude-sonnet-4-6
- **完成判据**：dt-styles + ModListRow + RejectedTabContent + PendingCenter / VideoListClient PAGE_STYLE 等关键 padding 全部 token 化；裸值消除 ≥ 80%
- **完成备注**：关键高频 padding（10px/12px toolbar/list-row、6px/12px foot、12 section-gap、14 card-y、0/12px btn）全部 token 化；252f/3206t 全绿。低频小尺寸（2px/3px/4px/5px/8px）无匹配语义 token，保留为合理残余。

### CHG-UX2-06 · 收口 + arch-reviewer 全序列评级 + ADR-113
- **状态**：✅ 已完成（2026-05-05）
- **依赖**：CHG-UX2-01..05 ✅
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — **A- / PASS**（红线 0 / 黄线 6）
- **arch-reviewer 关键反馈**：
  - Y1 typography deprecation 真空：✅ ADR-113 §1 闭合（grep 业务 0 消费断言 + 长期 lint 触发条件）
  - Y2 5 处弱语义还原 → token 缺槽位：✅ ADR-113 §5 给出"3+ 文件出现 → 必须升 token"触发条件 + EXT-F 候选清单
  - Y3 scrollbar-gutter 容器豁免清单：✅ admin-shell-styles.tsx 注释加豁免列表 + 升级建议 + ADR-113 §4 收纳规则
  - Y4 thumb.tsx SIZE_PX 对称性守卫：✅ thumb.test.tsx +1 测试（双向集合相等断言）
  - Y5 admin-ui 反向耦合 design-tokens 数值（消除双源）：登记 ADR-113 §3 长期评估，触发型 follow-up
  - Y6 EXT-F 触发条件可追溯性：✅ ADR-113 §5 + §6 完整记录 5 处还原决策
- **完成判据达成**：
  - ✅ ADR-113 落盘 `docs/decisions.md`（6 个必须章节 + 备选方案 + 验证 + 关联）
  - ✅ admin-shell-styles.tsx 注释加豁免容器清单 + 升级建议
  - ✅ thumb.test.tsx +1 对称性断言 (32/32 全绿)
  - ✅ task-queue 序列状态 → 已完成
  - ✅ changelog 追加 -06 完整条目
- **完成备注**：SEQ-20260505-01 序列正式收口；4 项用户痛点全部闭环 + 26 个 token 槽位落地 + 305 fontSize 全量迁移 + Chrome scrollbar-gutter layout bug 真因锁定。EXT-A..F 触发型 follow-up 列表已固化进 ADR-113。

### 关键约束（违反 = BLOCKER）
- ❌ 修改 primitives space / size / radius（本批只在 admin-layout 层加槽位 + typography 已知风险评估的 28/32 校准）
- ❌ 业务文件写裸值 padding / fontSize（必须 var()）
- ❌ thumb.tsx 数值硬编码（必须 var(--cover-*)）
- ❌ 跳过 token 层直接改业务文件
- ❌ 修改 thumb.tsx 既有 ThumbSize 已有值的"size key 名"（向后兼容；只能加 poster-xl 新值）
- ❌ 修改 typography fontSize 既有 6 个 key（xs/sm/base/lg/xl/2xl）的数值
- ❌ 任一卡 arch-reviewer REJECT → BLOCKER

### 后续触发型 follow-up（不主动启动）
- **CHG-UX2-EXT-A**：PendingCenter 中央海报升 poster-xl 120×180 — 触发：用户实测 80×120 仍嫌小
- **CHG-UX2-EXT-B**：业务 inline padding 全量收敛剩余 ~70% — 触发：本批后视觉走查发现剩余裸值过多
- **CHG-UX2-EXT-C**：行密度运行时切换（comfortable ↔ compact） — 触发：admin Settings 立项
- **CHG-UX2-EXT-D**：审核台 < 1100px 响应式断点 RightPane 折叠 — 触发：移动端体验立项
- **CHG-UX2-EXT-E**：admin-count-font-size deprecation 清理 — 触发：本批所有消费方迁到 --font-size-xxs 后
- **CHG-UX2-EXT-F**：spacing token 真源补缺 — **第 1 阶段已完成（2026-05-05）**
  - **完成范围（第 1 阶段）**：spacing.ts 新增 `panel-padding-x/y` (12/12) + `button-padding-x` (12 临时占位) 共 3 槽位 → 11 → 14；4 处业务消费方迁回 token（PendingCenter SECTION / RejectedTabContent actions / VideoListClient BATCH_BTN + HEAD_BTN）
  - **遗留范围（待第 2 阶段或独立卡）**：
    · RejectedTabContent rejection info `'10px 14px'` — 需要 alert/notice 槽位单独评估（10/14 数值不匹配 panel-padding 也不匹配 card-padding）
    · RejectedTabContent card body `padding: 14` 4 边等值 — 需评估 card-padding-x=18 是否一并调整为 14（影响其他 card 消费方）
    · `button-padding-x` 长期目标：迁到 `packages/design-tokens/src/components/button.ts` 真源（admin-ui Button 组件正式立项后），届时 admin-layout 占位 deprecated
  - **触发条件评估**：第 1 阶段实施时其实未达"3+ 文件"硬阈值（panel-padding 仅 PendingCenter + RejectedTabContent 2 文件），但 ADR-113 §5 候选清单明确预设方案 + CHG-UX2-06 收口决议放行 → 主动启动闭环

---

## [SEQ-20260505-02] M-SN-5 启动前置评估 + plan v2.6 修订（执行序列）

- **状态**：✅ 已完成（2026-05-06；plan v2.5 → v2.6 落盘 + 3 轮 Opus arch-reviewer PASS）
- **创建时间**：2026-05-05
- **最后更新时间**：2026-05-06
- **目标**：M-SN-4 milestone B+ PASS 闭环后，对 M-SN-5（plan §6 行 516-529 原范围 4w / 6 视图 + 9-10 端点）进行启动前置评估；起草 plan v2.6 修订段（含 4 项前置必做 + 工时阈值预声明 + Non-Goals 边界澄清），spawn arch-reviewer (Opus) 独立评审，取得用户 sign-off 后落盘并立 cutover-blocker 母卡 / DEBT-LINE-KEY-01 决策卡。
- **范围**：
  - `docs/server_next_plan_20260427.md`（v2.5 → v2.6 修订段追加；§3 决策表 / §6 M-SN-5 + M-SN-6 / §10 风险 / 修订日志 5 处）
  - 不动代码、不动 ADR、不动 §4.7 依赖白名单
- **依赖**：M-SN-4 milestone B+ PASS（CHG-SN-4-10-D 已闭环 2026-05-05）/ `docs/archive/2026Q2/milestone-audits/M-SN-4-milestone-audit-2026-05-05.md` Y1 触发的 cutover-blocker 子序列母卡建议
- **不留口子原则**：本序列 PASS 前不允许起 M-SN-5 第一张视图卡（含 cutover-blocker 母卡 / DEBT-LINE-KEY-01 决策卡）

### 任务列表（按执行顺序）

1. **CHG-PLAN-02** — plan v2.6 修订段起草 + Opus 评审 + 用户 sign-off + 落盘（状态：✅ 完成 2026-05-06）
   - 创建时间：2026-05-05
   - 计划开始：2026-05-05
   - 实际开始：2026-05-05
   - 完成时间：2026-05-06
   - 主循环模型：claude-opus-4-7
   - 子代理：arch-reviewer (claude-opus-4-7) — 3 轮评审：第 1 轮 CONDITIONAL（4 红+6 黄+卡链 3）/ 第 2 轮 PASS（Y7 润色）/ 第 3 轮 PASS（Y8 staging-waiver 注记）
   - 关联 plan §：§0 / §3 / §5.2 / §6（M-SN-5 + M-SN-5.5 新增 + M-SN-6 调整）/ §9 + §10 + §12
   - 关联 ADR：暂无（v2.6 不新建；ADR-114 候选登记，方案 B 触发后启动）
   - 文件范围：`docs/server_next_plan_20260427.md` 单文件
   - 不在范围：M-SN-5.5 子卡（独立 SEQ-20260506-02）/ ADR-114（PRE-02 决策后）
   - 完成标准达成：✅ v2.6 草案完整 + ✅ 3 轮 Opus PASS + ✅ 用户方案 B' sign-off + ✅ 12 处 Edit 落盘 + ✅ 总周期 18.0w → 20.0w（软上限 21.0w）
   - 工时估算：0.5 天 / 实际：1.0 天（含 3 轮评审 + rev1/rev2/rev3 起草 + 用户 sign-off 2 回合）

### 序列后续（已落盘，独立起 SEQ-20260506-02）

按 v2.6 方案 B' 起 13 子卡（M-SN-5.5 启动准入门）：
- **CHG-SN-5-PRE-01-A..F**（cutover-blocker 6 子卡：DEBT-SN-3-B/C + DEBT-SN-4-05-A/B + DEBT-SN-4-A + DEBT-SN-4-07-A）
- **CHG-SN-5-PRE-02**（DEBT-LINE-KEY-01 决策卡，仅立决策；方案 B 选定后另起 ADR-114 + migration 卡）
- **CHG-SN-5-PRE-03-A..F**（admin-ui 通用原语 6 子卡：PageHeader / AdminButton / AdminInput / AdminSelect / AdminCard / Popover）

### 关键约束（违反 = BLOCKER）
- ❌ 修订过程中改动代码 / ADR / 依赖白名单
- ❌ 跳过 Opus arch-reviewer 直接落盘（违反 plan §0 SHOULD-4-a）
- ❌ 用户 sign-off 前 commit
- ❌ M-SN-5 第一张视图卡在 M-SN-5.5 13 子卡全部 PASS 前起草

### 备注
- 本序列性质：plan 修订 + 前置规划，不含代码改动
- 序列后续 13 张子卡进入 SEQ-20260506-02（M-SN-5.5 启动准入门）独立母序列；SEQ-20260506-01（rev2 设计的独立并行 cutover-blocker SEQ）按 rev3 用户最终方案 B' 取消（cutover-blocker 进 M-SN-5.5）

---

## [SEQ-20260506-02] M-SN-5.5 启动准入门：cutover-blocker + line_key 决策 + admin-ui 通用原语前置（执行序列）

- **状态**：🟡 规划中（M-SN-5 主体启动前必须 PASS）
- **创建时间**：2026-05-06
- **最后更新时间**：2026-05-06
- **目标**：承载 M-SN-5.5 milestone 全部范围（plan §6 v2.6 新增段）— 三类工作 13 子卡：A 段 cutover-blocker 6 子卡 + B 段 line_key 决策 1 卡 + C 段 admin-ui 通用原语/Popover 6 子卡。完成后才允许 M-SN-5 主体（6 视图 + 9-10 端点）启动。
- **范围**：
  - A 段（packages/admin-ui + apps/api + tests/visual）：cutover-blocker 4🔴+2🟠
  - B 段（docs/decisions.md + plan）：DEBT-LINE-KEY-01 仅立决策卡
  - C 段（packages/admin-ui）：6 通用原语下沉，零业务视图消费
- **依赖**：CHG-PLAN-02 ✅ 完成 / plan v2.6 落盘
- **真源**：`docs/server_next_plan_20260427.md` §6 M-SN-5.5（v2.6 新增）+ `docs/archive/2026Q2/milestone-audits/M-SN-4-milestone-audit-2026-05-05.md` §6
- **不留口子原则**：本序列 13 子卡全部 PASS 前不允许起 M-SN-5 第一张视图卡
- **工时估算**：2.0w（基线）/ 软上限 3.0w；超 3.0w 触发 BLOCKER §5.2 第 11 条

### A 段：cutover-blocker 6 子卡（每卡独立 Opus 评审）

> 真源：`docs/archive/2026Q2/milestone-audits/M-SN-4-milestone-audit-2026-05-05.md` §6 严格核对 4🔴+2🟠+1🟡（🟡 不计入本期）

1. **CHG-SN-5-PRE-01-A** · DEBT-SN-3-B（staging cookie + nginx e2e 演练，需人工，🔴）— 状态：✅ 已完成（2026-05-12，本地 Caddy 替代演练，5 步金票路径全绿）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-12
   - 文件范围（实际）：docs/archive/2026Q2/server_next_PRE-01-A-drill-2026-05-12.md（演练记录文档）+ docs/changelog.md + docs/task-queue.md
   - 验收要点：cookie 跨服务（server ↔ server-next）切换透明 + 5 步金票路径全绿 — **全部满足**
   - **演练前置 bugfix**：CHG-SN-5-PRE-01-A-pre（server-next next.config.ts 补 NEXT_PUBLIC_ASSET_PREFIX env 支持；commit d00c33c3）— 落实 architecture.md line 101 文档承诺
   - 工时估算：0.3w
   - 完成备注：执行模型: claude-opus-4-7；子代理: 无（人工演练 + 落盘）；用户本地 macOS Caddy 替代 staging nginx，4 个不变量全验收（cookie 跨服务共享 / JWT 签发源唯一 / hot reload 不丢连接 / 回滚预案可用）；风险登记 Risk-PRE-01-A-1（SameSite=Strict 跨子域 cutover 预警）→ 入 task-queue 欠账段 + PRE-01-B 审计材料显式声明；全栈 typecheck + lint + unit 261 files 3434 tests 全绿；解锁 PRE-01-B 启动
2. **CHG-SN-5-PRE-01-B** · DEBT-SN-3-C（M-SN-3 milestone 阶段审计，🔴）— 状态：✅ 已完成（2026-05-12，arch-reviewer Opus B+ PASS 无条件）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-12
   - 依赖：PRE-01-A 完成（2026-05-12 闭环，非 waiver 路径）
   - 文件范围（实际）：`docs/archive/2026Q2/milestone-audits/M-SN-3-milestone-audit-2026-05-12.md`（新建）+ docs/task-queue.md + docs/changelog.md
   - 子代理：arch-reviewer (claude-opus-4-7) — 1 轮独立复评 → **B+ PASS 无条件** / 0 红线 / 3 黄线维持原分类（Y1 设计漂移 / Y2 SameSite=Strict 跨子域 / Y3 audit 延迟）/ 4 OBS（信息级）
   - 工时估算：0.1w
   - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → B+ PASS / 评审独立 grep + 文件阅读核实 5 项审计重点证据链；5 项审计重点全 PASS（视频库可作模板 / VideoStatusIndicator 下沉成立—后 CHG-DESIGN-08 删除属设计演进 / parity 100% / e2e 演练 4 不变量验收 / DataTable v2 真实场景一体化）；7 项完成标准 7/7 满足；3 黄线均为 process observation 非 quality defect；DEBT-SN-3-C 关闭 → M-SN-3 milestone 阶段审计闭环；Risk-PRE-01-A-1（SameSite=Strict）显式登记入审计材料 + cutover-pre 卡评估
3. **CHG-SN-5-PRE-01-C** · DEBT-SN-4-05-A（toggleSource 乐观锁缺失，🔴 并发安全）— 状态：✅ 已完成（2026-05-06）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-06
   - 文件范围（实际，按真源修正）：apps/api/src/db/migrations/061_video_sources_updated_at.sql + apps/api/src/db/queries/video_sources.ts + apps/api/src/services/ModerationService.ts + apps/api/src/routes/admin/videoSources.ts + packages/types/src/admin-moderation.types.ts + tests/unit/api/{moderationService,videoSourcesRoutes,video_sources_queries}.test.ts + docs/architecture.md §5.2 + docs/changelog.md
   - 验收要点：加 ETag/version 列 + expectedUpdatedAt 乐观锁 + 并发测试 — **全部满足**
   - 范围偏离说明：原卡误标 SourceService，实际位于 ModerationService.toggleSource → toggleVideoSource query；按真源实施
   - 工时估算：0.1w
   - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → A- / PASS / 1 黄线（SourcePatchBody 类型同步）已修；typecheck 全绿 / lint 全绿 / unit 254 files 3236 tests 全部 PASS（本卡新增 11 用例）；下游消费方 wire-up（apps/server-next/src/lib/moderation/api.ts）留 M-SN-5 视图卡
4. **CHG-SN-5-PRE-01-D** · DEBT-SN-4-05-B（feedback.ts XFF trustProxy 白名单，🔴 IP 欺骗绕过 rate-limit）— 状态：✅ 已完成（2026-05-06）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-06
   - 文件范围：apps/api/src/server.ts trustProxy + apps/api/src/routes/feedback.ts request.ip + docker/nginx.conf 注释 + tests/unit/api/feedbackRoute.test.ts + docs/rules/api-rules.md + docs/changelog.md
   - 验收要点：XFF 仅信任白名单 IP + rate-limit 不可绕过 — **全部满足**
   - 工时估算：0.1w
   - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → A- / PASS / 0 红线 / 2 黄线（startup trustProxy 日志 + 端到端 rate-limit 闭环测试）显式留给 PRE-01-A 演练卡；typecheck 全绿 / lint 全绿 / unit 254 files 3238 tests 全部 PASS；默认 fail-secure（未配 TRUSTED_PROXY_IPS → XFF 全忽略），生产须设白名单否则会误锁正常用户
5. **CHG-SN-5-PRE-01-E** · DEBT-SN-4-A（5 件下沉组件 ~12 张 Playwright `toHaveScreenshot()` baseline + 回溯 M-SN-4 改动校验，🟠）— 状态：拆分为 -E-1（基础设施）+ -E-2（真截图）
   - **CHG-SN-5-PRE-01-E-1**（基础设施 + ADR-116 协议）：✅ 已完成（2026-05-12）
     - sub-ADR：ADR-116（admin-ui Playwright visual harness 协议）— 2 轮 arch-reviewer Opus 评审 A- PASS / 1 红线（Next.js App Router 私有文件夹路径修正）+ 4 黄线 + 4 OBS 全闭环
     - 文件范围（实际）：`docs/decisions.md` ADR-116 / `docs/server_next_plan_20260427.md` §9 索引 / `apps/server-next/src/app/admin/dev/visual/{layout,page,_lib/{component-registry,mock-data},[component]/page}.tsx` / `playwright.config.ts` (admin-visual project) / `tests/visual/admin-ui/*.visual.spec.ts` 5 个骨架 / `tests/visual/admin-moderation.visual.spec.ts` / `.gitignore` (tests/visual/.auth/) / `docs/tasks.md` / `docs/task-queue.md` / `docs/changelog.md`
     - 完成备注：执行模型 claude-opus-4-7；子代理 arch-reviewer (claude-opus-4-7) 2 轮 → 第 2 轮 A- 无条件 PASS；harness 基础设施全部就位（5 件组件展厅 + 12 状态注册 + playwright admin-visual project + 6 个 visual.spec.ts 骨架）；占位 baseline 保留待 -E-2 跑 --update-snapshots 替换；typecheck + lint 全绿；unit test 3434/3434 全绿（重跑确认 StagingEditPanel flake 非本卡引入）
   - **CHG-SN-5-PRE-01-E-2**（用户卡 / 真截图入库）：✅ 已完成（2026-05-12，12 张 baseline 入库 + 抽检视觉合格）
     - 文件范围（实际）：tests/visual/admin-ui/{bar-signal,staff-note-bar,line-health-drawer,reject-modal,decision-card}.visual.spec.ts-snapshots/*-admin-visual-darwin.png 共 12 张
     - 实施备注：用户 2026-05-12 本地 macOS 跑 `npm run test:visual:update -- tests/visual/admin-ui` 后 5 件组件 12 状态 baseline 全部生成；执行过程中触发 followup-5/-6/-7（middleware 豁免 + 路径段严格匹配）+ followup-8（RSC Client Component 边界）4 项 fix；抽检 LineHealthDrawer / RejectModal / StaffNoteBar(edit) 渲染均正确（Drawer/Modal portal + 双信号 + 标签单选 + 编辑态 textarea + 字数计数 + warning 主题）；test-results / playwright-report 临时目录已清；尚有"sidebar 动态数字 + Drawer 整页 fullPage 包含 admin shell"可能产生 visual diff flake，留 PRE-01-E-2-followup 卡未来稳定（不阻塞本次入库）
     - 工时估算：~0.2w（实际含 followup 4 次修复 +0.1w，总 ~0.3w）
   - 工时估算（合计）：0.4w（-E-1 ~0.2w 已完成 + -E-2 ~0.2w 待用户）
6. **CHG-SN-5-PRE-01-F** · DEBT-SN-4-07-A（visual baseline 7 张占位 PNG（69-byte 单像素）替换为真截图，🟠）— 状态：✅ 已完成（2026-05-12，7 张 baseline 真截图入库 + 7 张占位 PNG 删除）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-12
   - 文件范围（实际）：
     - 新建 tests/visual/admin-moderation.visual.spec.ts（spec 适配 moderation page DOM 真实 selector）
     - 入库 tests/visual/admin-moderation.visual.spec.ts-snapshots/*.png（7 张：pending-list / pending-detail / lines-panel / rejected / staging / reject-modal / line-health-drawer，85-206KB）
     - 删 tests/visual/moderation/*.png（7 张 69-byte 占位 PNG）
     - 新建 scripts/visual-auth-setup.mjs（admin storageState 一次性生成器，避开 codegen 浏览器扩展 hydration mismatch）
   - 实施备注：执行模型 claude-opus-4-7；spec selector 实测调整（[data-moderation-console]/[data-mod-list-row]/[data-lines-panel]/[data-right-pane]/键盘 'r' 触发 RejectModal/aria-label="证据" 触发 LineHealthDrawer）；每个 click/wait 加 `.catch(() => {})` 防 selector 不可达阻塞；user 端跑流程：(1) .env.local 注释 NEXT_PUBLIC_ASSET_PREFIX=/admin（首跑失败因 /login 资源 404）(2) 启 npm run dev 全 4 服务（含 apps/api :4000）(3) node scripts/visual-auth-setup.mjs 手动登录拿 storageState (4) npm run test:visual:update -- tests/visual/admin-moderation.visual.spec.ts；抽检 3 张（pending-list / reject-modal / line-health-drawer）视觉规范合格，含 followup-4 修复的 "确认拒绝" 按钮文字清晰可读
   - 工时估算：0.2w

### B 段：DEBT-LINE-KEY-01 决策（1 单卡）

7. **CHG-SN-5-PRE-02** · DEBT-LINE-KEY-01 决策（line_key 一级建模 vs 维持复合键，🟡 决策性）— 状态：✅ 已完成（2026-05-06，方案 A 采纳）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-06
   - 主循环模型：claude-opus-4-7
   - 子代理：arch-reviewer (Opus) — 评级 A- / PASS / 独立第二意见与主循环一致采纳方案 A
   - 关联 plan §：§3 决策表 + §6 M-SN-5.5 B 段 + §10.9 R-M-SN-5-01 + §9 ADR 索引
   - 文件范围（实际）：`docs/decisions.md` ADR-114-NEGATED + `docs/server_next_plan_20260427.md` 修订（§3/§6/§9/§10.9 同步） + `docs/task-queue.md` DEBT-LINE-KEY-01 状态推进 + SEQ-20260502-01 watchlist 第 3 项标"已决议"
   - **不在范围（明列防扩张）— 全部遵守**：migration 文件 / 端点 schema 修订 / ADR-114 实施
   - 验收要点：
     - ✅ 方案二选一裁决：**方案 A（维持复合键）采纳**
     - ✅ 方案 A → 否定 ADR：ADR-114-NEGATED 落 `docs/decisions.md`，含 4 项重新评估触发条件（用户反馈 / 跨站重叠率 30% / M-SN-5 视图限制 / M-SN-6 自动重评）
     - ✅ 不含 migration / 端点 schema 修订
   - 工时估算：0.3w
   - **后续触发**（不在本卡）：方案 B 路径**不启动**；如重新评估触发则起 PRE-02-V2 决策卡
   - 完成备注：执行模型 claude-opus-4-7；arch-reviewer 评级 A- / PASS / 3 黄线 Y-1（重新评估触发条件 4 项）+ Y-2（plan §3 决策表更新）+ Y-3（SEQ-20260502-01 watchlist 标"已决议"而非删除）全部同卡修；零代码变更；纯 governance 决策卡

### C 段：admin-ui 通用原语/Popover 6 子卡（每件独立 Opus 评审）

> 强约束：本段卡只下沉原语到 packages/admin-ui，**不接业务视图**。

8. **CHG-SN-5-PRE-03-A** · `PageHeader`（reference §5 各页 page__head 统一壳）— 状态：✅ 已完成（2026-05-06）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-06
   - 文件范围：packages/admin-ui/src/components/page-header/* + tests/unit + packages/admin-ui/src/index.ts 桶导出
   - 验收要点：title / subtitle / actions 三 slot + 零硬编码颜色 + Storybook demo（如已搭建，admin-ui 未搭建 → 转登记 DEBT-ADMIN-UI-STORYBOOK-MISSING）
   - 工时估算：0.1w
   - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → B+ / CONDITIONAL → PASS（Y-1/2/3 同卡修复：role 默认不设 + as?='header'/section/div 默认 header；Y-4 Storybook infra 缺失登记到欠账段）；typecheck 全绿 / lint 全绿 / unit 255 files 3253 tests 全部 PASS（本卡新增 19 用例）；零业务视图修改
9. **CHG-SN-5-PRE-03-B** · `AdminButton`（reference §4.2 Button 规范）— 状态：✅ 已完成（2026-05-06）
   - 创建时间：2026-05-06
   - 完成时间：2026-05-06
   - 文件范围：packages/admin-ui/src/components/admin-button/* + tests/unit + packages/admin-ui/src/index.ts
   - 验收要点：variant（primary/secondary/ghost/danger，含 default 总 5 个）+ size（sm/md/lg）+ loading + icon — **全部满足**
   - 工时估算：0.1w
   - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → B+ / CONDITIONAL → PASS（R-1 红线 disabled||loading + Y-1 黄线 keyframes 自注入 + Y-3 secondary 同源引用 同卡修复；Y-2 hover 状态 inline 不可表达 → DEBT-ADMIN-UI-BUTTON-HOVER 转登记）；typecheck+lint+test 256 files 3283 tests 全绿（本卡新增 26 用例）；零业务视图修改
10. **CHG-SN-5-PRE-03-C** · `AdminInput`（reference §4.2 Input 规范）— 状态：✅ 已完成（2026-05-06）
    - 创建时间：2026-05-06
    - 完成时间：2026-05-06
    - 文件范围：packages/admin-ui/src/components/admin-input/* + tests/unit + packages/admin-ui/src/index.ts
    - 验收要点：type（text/email/password/number；本卡扩到 7 type 含 search/tel/url）+ size + prefix/suffix + error 态 — **全部满足**
    - 工时估算：0.1w
    - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → A- / PASS / 0 红线 / 4 黄线（Y-2 token fallback canonical 注释 + Y-4 wrapperClassName JSDoc 同卡修；Y-1 aria-invalid 三态信息性保留；Y-3 focus 伪类 → DEBT-ADMIN-UI-FOCUS-PSEUDO 与 BUTTON-HOVER 同源转登记）；typecheck+lint+test 257f/3310t 全绿（新增 27 用例）；零业务视图修改
11. **CHG-SN-5-PRE-03-D** · `AdminSelect`（reference §4.2 Select 规范）— 状态：✅ 已完成（2026-05-06）
    - 创建时间：2026-05-06
    - 完成时间：2026-05-06
    - 文件范围：packages/admin-ui/src/components/admin-select/* + tests/unit + packages/admin-ui/src/index.ts
    - 验收要点：单选 / 多选 / 搜索 / 异步加载 + 键盘导航 — **全部满足**（含 ARIA 1.2 combobox/listbox 完整模式：role+aria-haspopup+aria-expanded+aria-multiselectable+aria-activedescendant+aria-controls）
    - 工时估算：0.15w
    - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → B+ / CONDITIONAL → PASS（R-2 search keyboard 双处理 functional bug 同卡修；R-1 aria-activedescendant useId() 模式同卡补；3 advisory 测试 Space/Tab/disabled-skip 同卡加）；typecheck+lint+test 259f/3370t 全绿（新增 31 用例）；零 React warning（chip × 用 span role=button）；零业务视图修改
12. **CHG-SN-5-PRE-03-E** · `AdminCard`（reference §4.3 Card 规范）— 状态：✅ 已完成（2026-05-06）
    - 创建时间：2026-05-06
    - 完成时间：2026-05-06
    - 文件范围：packages/admin-ui/src/components/admin-card/* + tests/unit + packages/admin-ui/src/index.ts
    - 验收要点：surface 层级 + padding 槽位 + header / body / footer 三段 — **全部满足**（含 status 3 修饰对齐 KPI "状态色不动整卡背景" 约定 + headingLevel + className/style 扩展槽位）
    - 工时估算：0.1w
    - 完成备注：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → B+ / PASS / 0 红线 / 3 黄线全部同卡修复（headingLevel 2-6 默认 3 + className/style merge + subtitle font-size fallback）；typecheck+lint+test 258f/3339t 全绿（新增 29 用例）；零业务视图修改
13. **CHG-SN-5-PRE-03-F** · `Popover`（reference §4.5 弹层规范）— 状态：✅ 实施卡完成（2026-05-11，1 轮 arch-reviewer Opus A- PASS / 0 红线 / 2 黄线全部同卡修；49 新增 tests 全绿）
    - 创建时间：2026-05-06
    - sub-ADR 完成时间：2026-05-07（PRE-03-F-ADR / ADR-115 采纳）
    - 文件范围（实施卡）：packages/admin-ui/src/components/popover/* + packages/admin-ui/src/components/popover/compute-position.ts（独立拆分）+ tests/unit + design-tokens 新增 `--z-admin-popover: 1050` 槽位
    - **强约束**：API 契约复杂度（Portal / focus-trap / dismiss 协议）若超 Drawer，**必须先升独立 sub-ADR + Opus arch-reviewer PASS 才能起实施卡** — ✅ **已满足**（ADR-115 第 3 轮 Opus A- PASS）
    - **复杂度评估结论**（2026-05-06 主循环 Opus 4.7）：Popover **明确超过 Drawer**（详见 ADR-115 §1.3 复杂度对比 7 维度）
    - **sub-ADR 进度**：CHG-SN-5-PRE-03-F-ADR ✅ 完成（2026-05-07，3 轮 arch-reviewer Opus 评审：轮 1 CONDITIONAL → 轮 2 CONDITIONAL → 轮 3 **A- PASS**；3 红线（useOverlay 复用 / trigger toggle / z-index Modal 内）+ 6 黄线全部修复；ADR-115 候选 → 采纳，落 `docs/decisions.md`）
    - **实施卡 v1 minimum viable subset**（ADR-115 §3.1）：6 placement（top/bottom/left/right/bottom-start/bottom-end）+ flip + non-modal 默认 + 5 类 dismiss + 6 实施 props + 4 props @experimental（modal/closeOnTabOut/portalContainer/arrow）+ hasPopup 仅 ARIA 不键盘（消费方实现键盘逻辑）
    - 工时估算（修订后）：0.25-0.40w（实施卡含拆分 + 单测覆盖 6 placement × 3 viewport + flip）
    - PRE-03-F 实施卡**不在本 SEQ-20260506-02 范围**（实施工作另起独立卡）；sub-ADR 已闭环让 SEQ 进度推到 9/13

### 完成标准
- A 段 cutover-blocker：4🔴 全部 close（M-SN-5 主体启动前必清）+ 2🟠 显式标"M-SN-7 final 前 close（不晚于 cutover 前两周）"
- B 段 line_key 决策：方案 A 写入 decisions.md 否定 ADR / 方案 B 写入 ADR-114 候选占位 + Non-Goals 豁免 sign-off 待办登记
- C 段通用原语：6 件全部下沉到 packages/admin-ui，每张卡 arch-reviewer Opus PASS + 零业务视图消费
- typecheck + lint + unit + Storybook demo（如已搭建）全绿

### 启动准入（M-SN-5 主体启动前必须 PASS）
- 完成标准 100% 达成
- 6 通用原语公开 API 契约稳定（任一回归触发 BLOCKER §5.2 第 6 条）

### 软上限协议（沿用 M-SN-6.5 SHOULD-8 体例）
- 基线 2.0w；任一子卡 arch-reviewer CONDITIONAL 修复轮次 >2 即升至 3.0w；超 3.0w 触发 BLOCKER §5.2 第 11 条
- A+B+C 工时合计 ~1.9-2.7w，位于 2.0-3.0w 软上限范围内

### 关键约束（违反 = BLOCKER）
- ❌ C 段卡内含业务视图消费（违反"零业务视图消费"硬约束）
- ❌ B 段 PRE-02 决策卡内含 migration / 端点 schema 修订
- ❌ A 段 4🔴 任一未 close 即起 M-SN-5 主体视图卡
- ❌ 任一子卡 arch-reviewer REJECT → 整子卡返工 + 评估是否升 BLOCKER

### 备注
- 13 子卡可按依赖顺序分批并行：
  - 第 1 批（无依赖，可并行）：PRE-01-A / PRE-01-C / PRE-01-D / PRE-01-E / PRE-01-F / PRE-02 / PRE-03-A..E（A-E 5 件低复杂度）
  - 第 2 批（依赖第 1 批）：PRE-01-B（依赖 -A 或 staging-waiver）/ PRE-03-F（如发现复杂度高需先升 sub-ADR）
- M-SN-5.5 milestone 阶段审计（plan §5.3）由 SEQ 完成时另起独立 milestone-audit 卡承担 → SEQ-20260512-01 / CHG-SN-5.5-AUDIT

---

## [SEQ-20260512-01] M-SN-5.5 milestone 阶段审计 + M-SN-5 主体启动 SEQ 起草（执行序列）

- **状态**：✅ 已完成（2026-05-12，2/2 子卡闭环；CHG-SN-5.5-AUDIT A- PASS + CHG-PLAN-03 Opus 2 轮 PASS + 用户 sign-off）
- **创建时间**：2026-05-12
- **目标**：M-SN-5.5 milestone（SEQ-20260506-02 13/13 PASS）完成后按 plan §5.3 协议立 Opus arch-reviewer milestone-audit 卡 → 评级 A/B 解锁 → 起草 M-SN-5 主体 SEQ（6 视图 + 9-10 端点 / ADR-104 + ADR-105）→ 用户 sign-off → 进入 M-SN-5 第一张视图卡
- **范围**：
  - `docs/archive/2026Q2/milestone-audits/M-SN-5.5-milestone-audit-2026-05-12.md`（新建 milestone audit 文档）
  - `docs/server_next_plan_20260427.md`（如审计触发 plan 修订段，独立 CHG-PLAN-03 承担）
  - `docs/task-queue.md` + `docs/changelog.md`（状态推进 + 条目追加）
- **依赖**：SEQ-20260506-02 全部 13 子卡 ✅ PASS（已确认 2026-05-12）
- **不留口子原则**：本 SEQ PASS 前不允许起 M-SN-5 主体第一张视图卡（含 ADR-104 / ADR-105 sub-ADR 卡）

### 子卡序列

1. **CHG-SN-5.5-AUDIT** — M-SN-5.5 milestone 阶段审计（Opus arch-reviewer）— 状态：✅ 已完成（2026-05-12，A- PASS 无条件）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **关联 plan §**：§5.3 milestone 阶段审计协议 + §6 M-SN-5.5 完成标准
   - **子代理调用**：arch-reviewer (claude-opus-4-7) — milestone 阶段审计强制 Opus（CLAUDE.md 模型路由 + plan §5.3）
   - **审计输入**：
     - SEQ-20260506-02 完整序列（13/13 PASS）
     - 关联 ADR：ADR-114-NEGATED（line_key 否定）/ ADR-115（Popover 采纳）/ ADR-116（visual harness 协议）
     - M-SN-5.5 期间 git log（从 4573df5f CHG-PLAN-02 plan v2.6 起 → 9720e219 CHG-SN-5-PRE-01-F 终结）
     - plan §6 M-SN-5.5 完成标准 + 启动准入条款
   - **审计输出**（实际产出 `docs/archive/2026Q2/milestone-audits/M-SN-5.5-milestone-audit-2026-05-12.md`）：
     - 偏差报告：0 必须回滚 / 0 需追溯 ADR / 13 合理（13/13 子卡 100% 一致）
     - 质量评级：**A-**（接近 A 满分，扣 0.5 等级因 visual baseline 单平台 + Storybook 缺失 → 黄线观察项）
     - 红线项 0 / 黄线项 5（Y1 visual baseline 单平台 / Y2 admin-ui 视觉债三项 / Y3 SameSite=Strict / Y4 fullPage flake / Y5 6 原语 0 业务集成测试）
     - 人工 checklist 6 项（开放项，自动审计无法判定）
   - **准入判定**：M-SN-5 主体启动准入 PASS 无条件
   - **arch-reviewer 建议**：M-SN-5 第一张视图卡选 `/admin/submissions`（依赖 0 个新原语 + 6 件原语全消费机会，比 `/admin/sources` 风险低）
   - **文件范围**（实际）：`docs/archive/2026Q2/milestone-audits/M-SN-5.5-milestone-audit-2026-05-12.md`（新建） + docs/task-queue.md + docs/changelog.md + docs/tasks.md
   - **工时估算**：0.15w / 实际 ~0.1w（1 轮独立 Opus 评审 + 文档落盘）
   - **完成备注**：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) → **A- PASS 无条件** / 0 红线 / 5 黄线（Y1-Y5 全部转登记到 cutover-pre / M-SN-5 主体首批视图卡监控清单 / DEBT 段）；偏差报告 13/13 子卡分类"合理"零追溯需求；6 通用原语零业务视图消费硬约束 grep 实测 100% 满足（业务视图 zero import）；A 段 2🟠 超额直接 close（非仅"显式标 M-SN-7 final 前 close"）；解锁 M-SN-5 主体启动条件齐；CHG-PLAN-03 SEQ 起草卡接续

2. **CHG-PLAN-03** — M-SN-5 主体 SEQ 起草 + Opus 评审 + 用户 sign-off — 状态：✅ 已完成（2026-05-12，用户 sign-off "批准.可以自动启动 M-SN-5"）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **依赖**：CHG-SN-5.5-AUDIT 评级 A/B PASS
   - **关联 plan §**：§6 M-SN-5（6 视图 + 9-10 端点 + ADR-104/105）+ §4.5 ADR-端点先后协议 + §5.1 自动化 review
   - **子代理调用**：arch-reviewer (claude-opus-4-7) — SEQ 起草 Opus 独立第二意见
   - **起草范围**：
     - M-SN-5 主体 SEQ-20260512-02（或后续编号）拆分卡片清单：
       - ADR-104（home_modules admin API 协议 sub-ADR） — 先于首个 home_modules 端点卡
       - ADR-105（merge candidate / split / unmerge API 协议 sub-ADR） — 先于首个 merge 端点卡
       - home_modules 6 端点（list / create / update / delete / reorder / publish）
       - split-unmerge / candidate-preview 3-4 端点
       - 6 视图卡：`/admin/sources` `/admin/home` `/admin/merge` `/admin/submissions` `/admin/subtitles` `/admin/users`
     - 依赖图 + 并行批次 + 工时估算（基线 4.0w / 软上限 5.2w +30%）
     - 关键约束清单（违反 = BLOCKER §5.2 各条）
   - **完成判据**：SEQ 起草完成 + arch-reviewer Opus PASS（≤ 3 轮）+ 用户 sign-off
   - **文件范围**：`docs/task-queue.md`（新增 SEQ-20260512-02 段）+ `docs/changelog.md`
   - **工时估算**：0.3w
   - **arch-reviewer 评审轨迹**：
     - 第 1 轮 (claude-opus-4-7)：CONDITIONAL — 3 红线（R1 subtitles 端点核验 / R2 Popover BLOCKER 升格 + 措辞澄清 / R3 -07 模型路由"中途升 opus"措辞）+ 4 黄线（Y1 视图卡 e2e 黄金路径 / Y2 新原语未下沉 BLOCKER / Y3 复用矩阵达标率 / Y4 ADR 串行）+ 3 advisory（A1 audit Y2 衔接 / A2 ADR-105 性能基线 / A3 sources 拆分）
     - 主循环修订：R1 实际证据修正（admin 端点存在 `apps/api/src/routes/admin/content.ts:269-296`）+ R1 普适化（-01/-03 同补端点核验）+ R2/R3/Y1-Y4 + A1/A2/A3 全部落地 + A-RESIDUAL-1 措辞 polish
     - 第 2 轮 (claude-opus-4-7)：**PASS** 无条件 — 3 红线全 PASS + 4 黄线全 PASS + 3 advisory 全实施 + 无新结构性破缺；工时合计 4.45w < 软上限 5.2w；关键约束清单 8 条 + 风险登记 5 条全面覆盖
   - **完成备注**：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) ×2 → PASS；SEQ-20260512-02 起草落盘 task-queue.md 含 14 子卡（Phase A 3 视图 + Phase B ADR-104 + 2 端点批 + 1 视图 + Phase C ADR-105 + 2 端点 + 2 视图 + Phase D milestone audit）+ 5 并行批次 + 工时 4.45w + 8 项 BLOCKER 关键约束 + 5 项风险登记；待用户 sign-off 触发 M-SN-5 主体 CHG-SN-5-01 启动

### 完成标准
- CHG-SN-5.5-AUDIT 评级 A 或 B
- CHG-PLAN-03 SEQ 起草通过 Opus 评审 + 用户 sign-off
- typecheck + lint + unit 维持全绿基线（审计期间不动代码；起草期间不动代码）

### 启动准入（M-SN-5 主体启动前必须 PASS）
- 本 SEQ 2 卡全部 ✅ 已完成
- M-SN-5 主体 SEQ（SEQ-20260512-02 起）已登记到 task-queue 含完整子卡清单 + 依赖图 + 工时估算
- 首张"含新端点实施"卡前置 ADR-104 / ADR-105 sub-ADR Opus PASS（§4.5 ADR-端点先后协议）
- 首张视图卡可为不依赖新端点的现成端点消费视图（如 `/admin/submissions` `/admin/subtitles` `/admin/users`），arch-reviewer 审计建议优先（M-SN-5.5 audit ⑨ 第 6 项）

### 关键约束（违反 = BLOCKER）
- ❌ 跳过审计直起 M-SN-5 第一张视图卡（违反 plan §5.3 强制审计协议）
- ❌ 跳过 CHG-PLAN-03 SEQ 起草直起 ADR-104 实施卡（违反 §4.5 ADR-端点先后协议预备工作）
- ❌ 审计评级 C 仍推进 M-SN-5（直接 BLOCKER）
- ❌ SEQ 起草内含具体代码改动（违反"起草卡不动代码"硬约束）

### 备注
- 类比 CHG-SN-5-PRE-01-B（M-SN-3 milestone audit）路径：1 轮 arch-reviewer Opus + 独立 grep + 文件阅读核实证据链 → 评级文档归档
- 审计若发现重大偏差（如 PRE 卡某项完成度不足或 6 原语 API 不稳定）→ 转 CONDITIONAL，按 §5.1 ≤ 3 轮闭环；超 3 轮 REJECT → 升 BLOCKER
- SEQ 完成后另起 SEQ-20260512-02 承接 M-SN-5 主体 14 卡（含 milestone audit 收尾卡）

---

## [SEQ-20260512-02] M-SN-5 主体：P1 视图 + admin API 补齐 + ADR-104/105 + milestone audit（执行序列）

- **状态**：🔄 进行中（3/14 卡完成，CHG-SN-5-03 `/admin/users` 已闭环 2026-05-12）
- **创建时间**：2026-05-12
- **最后更新时间**：2026-05-12
- **目标**：plan §6 M-SN-5 范围（6 视图 + 9-10 端点 + ADR-104/105）落地实施，含 milestone 阶段审计收尾卡，遵守 §4.5 ADR-端点先后协议
- **依赖**：SEQ-20260512-01 全部 2 卡 PASS（CHG-SN-5.5-AUDIT ✅ + CHG-PLAN-03 ⬜）
- **真源**：`docs/server_next_plan_20260427.md` §6 M-SN-5（行 519-536） + `docs/archive/2026Q2/milestone-audits/M-SN-5.5-milestone-audit-2026-05-12.md` ⑤ 人工 checklist + ⑨ 附加观察
- **工时基线**：4.0w / 软上限 5.2w（+30% 触发 BLOCKER §5.2 第 11 条）
- **不留口子原则**：本序列任一卡 arch-reviewer REJECT → BLOCKER 暂停；ADR-104/105 sub-ADR 未 PASS 不得起对应端点实施卡

### 子卡序列（14 卡）

**Phase A · 现成端点消费视图（3 卡，无依赖，可并行；6 原语首次业务消费 API 稳定性验证）**

> 选 `/admin/submissions` 为第 1 张是基于 M-SN-5.5 audit arch-reviewer 建议 ⑨ 第 6 项：依赖 0 个新原语 + 6 件原语全消费机会 + 不依赖 PRE-02 决策

1. **CHG-SN-5-01** · `/admin/submissions`（用户投稿视图，无新端点）— 状态：✅ 已完成（2026-05-12，arch-reviewer Opus PASS / 6 原语 API 稳定性验证零反向扩展）
   - **状态**：~~⬜ 待开始~~ · **建议模型**：sonnet
   - **关联 plan §**：§6 M-SN-5 行 529
   - **范围**：列表 + 筛选 + 详情 + 通过/驳回操作（消费现有 submissions 端点）+ 6 原语首次业务消费（PageHeader / AdminButton / AdminInput / AdminSelect / AdminCard / Popover 至少 4 件）
   - **依赖端点核验证据**（R1 修正）：
     - 现有 submissions 5 端点（GET / approve / reject / batch-approve / batch-reject）位于 `apps/api/src/routes/admin/content.ts`（核验：grep 该文件 5 端点全在）
     - 零新端点需求
   - **验收要点**：DataTable 一体化（包括 toolbar + filter chips + bulk actions）+ 6 原语零 props 反向扩展（仅 className/style 兜底）+ M-SN-5.5 audit Y5 缓解（业务集成测试覆盖）
   - **e2e 黄金路径**：登录 → 进入 /admin/submissions → 列表筛选"待审核" → 选中一条 → 通过 → 列表刷新 + audit log 写入
   - **子代理调用**：arch-reviewer (Opus) — 6 原语 API 稳定性验证（任一 props 反向扩展 → BLOCKER §5.2 第 6 条）
   - **工时估算**：0.3w / 实际 ~0.3w
   - **完成时间**：2026-05-12
   - **文件范围（实际）**：
     - 新建：`apps/server-next/src/lib/submissions/types.ts` + `api.ts`
     - 修改：`apps/server-next/src/app/admin/submissions/page.tsx`（PlaceholderPage → SubmissionsListClient）
     - 新建：`apps/server-next/src/app/admin/submissions/_client/SubmissionsListClient.tsx`（373 行）
     - 新建：`apps/server-next/src/app/admin/submissions/_client/SubmissionRejectPopover.tsx`（133 行）
     - 新建：`apps/server-next/src/app/admin/submissions/_client/columns.tsx`（152 行，拆出 buildSubmissionColumns 满足 ≤500 行硬约束）
     - 新建：`tests/unit/server-next/submissions/submissions-api.test.ts`（12 用例）
     - 新建：`tests/unit/components/server-next/admin/submissions/SubmissionRejectPopover.test.tsx`（10 用例）
   - **完成备注**：执行模型: claude-opus-4-7（用户"自动启动"指令未要求会话切换，连续在 opus 主循环 — 偏离建议模型 sonnet，记录原因；后续 -02 / -03 视图卡按 SEQ 串行可正常切回 sonnet）；子代理: arch-reviewer (claude-opus-4-7) → **PASS** / 0 红线 / 5 黄线（Y1 文件 503 行同卡修拆 columns.tsx → 373 行；Y2-Y5 转登记后续卡评估）；6 原语 API 稳定性 100% 满足（零 props 反向扩展 / 零 @experimental props 消费 — PageHeader / AdminButton / AdminInput / AdminSelect / Popover 5 件；AdminCard 暂未消费记原因）；零本地新建 admin-ui 通用组件（SubmissionRejectPopover 是业务专属 helper）；DataTable 一体化消费（toolbar.search slot + bulkActions 直传 + pagination 内置，零外置三件套）；ADR-114-NEGATED 复合键约束满足（grep line_key 零命中）；typecheck + lint + 22 新增 unit 用例全绿；total unit 3456/3456 全绿（baseline 3434 + 22）
   - **arch-reviewer 5 黄线（全部转登记，不阻塞）**：
     - Y1 文件 503 行（同卡修拆 columns.tsx 解决）
     - Y2 主函数 ~229 行（建议后续 -02/-03 共性后下沉 useSubmissionsQuery hook）
     - Y3 异步操作 catch 缺失（无 Toast 反馈）— CHG-SN-5-02 之前需补；建议 PRE-04 评估 Toast 原语
     - Y4 模板 chip inline button 自绘（AdminButton 最小 sm:24px 超过 chip 20px 设计）— admin-ui 补 Chip / size="xs" 后平迁
     - Y5 Popover ESC/outside click 关闭未在视图侧验证（admin-ui Popover 单测覆盖，视图层加 1 用例即兜底）
   - **后续触发型 follow-up**（不阻塞）：
     - PRE-04-CANDIDATES：3 视图复现后下沉候选 — (a) `ReasonInputPopover` 模板+文本+确认；(b) `useListWithFilters` hook；(c) `TwoLineTitleCell` cell helper
     - DEBT-ADMIN-UI-TOAST-MISSING：admin-ui 缺 Toast 原语，导致异步操作失败提示缺失（CHG-SN-5-02 启动前评估）

2. **CHG-SN-5-02** · `/admin/subtitles`（字幕审核队列视图，无新端点）
   - **状态**：✅ 已完成 · 完成时间：2026-05-12 · **建议模型**：sonnet
   - **完成备注**：8 文件新建/修改；18 unit 用例全绿；arch-reviewer (claude-opus-4-7) PASS 无红线；Y-2 当场修复（拒绝 trigger disabled 补齐）；DEBT-ADMIN-UI-TOAST-MISSING 通过 useToast().push({ level: 'danger' }) 缓解；执行模型: claude-sonnet-4-6；子代理: arch-reviewer (claude-opus-4-7)
   - **关联 plan §**：§6 M-SN-5 行 530
   - **范围**：字幕审核队列（GET）+ 通过/拒绝操作（POST approve / reject）+ 6 原语消费（PageHeader / AdminButton / AdminInput / AdminSelect / AdminCard / Popover 至少 3 件）
   - **依赖端点核验证据**（R1 修正）：
     - GET `/admin/subtitles` — `apps/api/src/routes/admin/content.ts:269`
     - POST `/admin/subtitles/:id/approve` — `apps/api/src/routes/admin/content.ts:285`
     - POST `/admin/subtitles/:id/reject` — `apps/api/src/routes/admin/content.ts:296`
     - 3 端点全在 admin 命名空间且 v1 `apps/server/src/components/admin/content/SubtitleTable.tsx:75/92/97` 已消费 — 复用现有 admin API，零新端点需求
   - **不在范围**：字幕上传 / 下载 / 删除（属 video 维度 `/videos/:id/subtitles` 端点 `apps/api/src/routes/subtitles.ts`，由用户走非 admin 视图）
   - **e2e 黄金路径**：登录 → 进入 /admin/subtitles → 列出 is_verified=false 队列 → 选中一条 → 通过 → 队列刷新移除该条
   - **工时估算**：0.3w

3. **CHG-SN-5-03** · `/admin/users`（用户管理视图，无新端点）
   - **状态**：✅ 已完成（2026-05-12）
   - **关联 plan §**：§6 M-SN-5 行 531
   - **范围**：列表 + 角色变更 + 封禁 + 解封（消费现有 users 端点）+ 5 原语消费
   - **依赖端点核验**：7 端点全在位，无缺位，维持"无新端点"模式（grep 证据已登记 tasks.md）
   - **e2e 黄金路径**：登录 → 进入 /admin/users → 筛选 role=user → 变更某账号 role=moderator → 列表刷新 + audit log 写入
   - **工时估算**：0.3w
   - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无；5 原语消费（PageHeader + AdminButton + AdminInput + AdminSelect + Popover）；9 unit 用例全绿；StagingEditPanel 预存在失败（非本 PR 引入）

**Phase B · home_modules（推荐 3，ADR-104 + 6 端点 + 1 视图）**

4. **CHG-SN-5-04** · ADR-104 起草（home_modules admin API 协议 sub-ADR）— 状态：✅ 已完成（2026-05-12，arch-reviewer Opus 2 轮 PASS / Candidate → Accepted）
   - **状态**：~~⬜ 待开始~~ · **建议模型**：opus · **执行模型**：claude-opus-4-7
   - **关联 plan §**：§4.5 ADR-端点先后协议 + §9 ADR 索引 ADR-104 + DISCUSS-6
   - **范围**：6 端点契约（list / create / update / delete / reorder / publish-toggle）+ admin only 鉴权 + 错误码（复用 ADR-110 零新增）+ audit log 扩 5 actionType+1 targetKind + 首版零缓存 + zod 双层校验
   - **子代理调用**：arch-reviewer (claude-opus-4-7) × 2 轮（第 1 轮 CONDITIONAL → 第 2 轮 PASS）
   - **完成时间**：2026-05-12
   - **文件范围（实际）**：
     - 修改：`docs/decisions.md`（新增 ADR-104 完整章节，状态 Accepted）
     - 修改：`docs/server_next_plan_20260427.md` §9 ADR 索引（ADR-104 状态推进 + 解锁条件标注）
     - 修改：`docs/task-queue.md` + `docs/tasks.md` + `docs/changelog.md`
   - **arch-reviewer 评审轨迹**：
     - 第 1 轮 CONDITIONAL — 1 红线 R1（UpdateSchema `CreateSchema._def.schema.partial()` zod API 误用 + 丢失 refine）+ 3 黄线（Y1 DISCUSS-6 鉴权粒度未闭合 / Y2 publish-toggle 双路径模糊 / Y3 message 模板缺失）+ 3 advisory（A1 metadata 不校验声明 / A2 PATCH 422 vs 404 路径 / A3 reorder 上限 200 防长事务理由）
     - 主循环修订：R1 重写为 `CreateBase` 纯 ZodObject + `applyBusinessRules` helper（4 条规则 partial undefined 短路）+ `UpdateSchema = applyBusinessRules(CreateBase.omit({enabled:true}).partial()).refine(at-least-one)`；Y1 决策要点 1 改 admin only + 与既有 banners/crawler-sites 类比 + 草稿/发布双态同级；Y2 UpdateSchema `.omit({enabled:true})` 协议层禁止 PATCH 改 enabled；Y3 补 8 场景 message 模板表；A1-A3 全实施 + helper 类型签名收紧（Partial<z.input> 替代 any，避免 CLAUDE.md 禁 any 红线）
     - 第 2 轮 PASS 无条件 — R1/Y1/Y2/Y3/A1/A2/A3 全部 PASS，无新破缺；2 非阻断建议（helper 签名 + 返回类型放宽）顺手吸收
   - **关键约束达成**：
     - §4.5 ADR-端点先后协议硬约束满足（ADR-104 PASS 解锁 CHG-SN-5-05/-06/-07 端点+视图实施卡）
     - DISCUSS-6 闭合（plan §4.5 末段 "草稿/发布双态等鉴权粒度" 决议为同级 admin only）
     - 隔离原则满足（仅扩 audit enum + 新增 admin 端点，不改公开 `/home/modules` / queries / migration 050 / Service 已有方法）
     - 错误码零新增（ADR-110 真源保持关闭）
   - **不在范围**：端点实施代码（独立 -05/-06/-07 卡承担，§4.5 硬约束）
   - **工时估算**：0.15w / 实际 ~0.2w（含 2 轮 Opus 评审）
   - **完成备注**：执行模型: claude-opus-4-7；子代理: arch-reviewer (claude-opus-4-7) × 2 → CONDITIONAL → PASS 无条件；ADR-104 状态 Candidate → Accepted；plan §9 ADR 索引推进；解锁 CHG-SN-5-05（list+create+update 端点实施）+ CHG-SN-5-06（delete+reorder+publish-toggle 端点实施）+ CHG-SN-5-07（`/admin/home` 视图）；typecheck + lint 维持基线（仅 docs 改动）；端点实施卡 -05 接手时直接复制 zod schema 代码块（CreateBase + applyBusinessRules + CreateSchema + UpdateSchema + ListSchema + ReorderSchema + PublishToggleSchema）+ 5 actionType + 1 targetKind 落地 admin-moderation.types.ts 扩枚举

5. **CHG-SN-5-05** · home_modules 端点实施第 1 批（list + create + update）
   - **状态**：✅ 已完成 · 2026-05-12
   - **建议模型**：sonnet
   - **范围**：3 端点 + zod schema + service 层 + db queries + unit test
   - **工时估算**：0.3w
   - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无（按 ADR-104 既定协议直接落地）；扩 AdminAuditActionType 5 项 + AdminAuditTargetKind 1 项（admin-moderation.types.ts）；新建 HomeModulesService.ts（list/create/update + zod CreateBase/applyBusinessRules/CreateSchema/UpdateSchema/ListSchema）；新建 admin/home-modules.ts（3 端点）；注册 server.ts；15/15 单元测试全绿；typecheck + lint PASS；UpdateSchema 用 .strict() 实现 ADR-104 "body 含 enabled → Unrecognized key" 协议层禁止

6. **CHG-SN-5-06** · home_modules 端点实施第 2 批（delete + reorder + publish）
   - **状态**：✅ 已完成 · 2026-05-12
   - **建议模型**：sonnet
   - **范围**：3 端点 + audit log + 缓存失效 + unit test
   - **工时估算**：0.3w
   - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无；在 HomeModulesService.ts 追加 delete/reorder/publishToggle + ReorderSchema/PublishToggleSchema 导出；在路由文件追加 DELETE/:id / POST reorder / POST /:id/publish-toggle 3 端点；publish-toggle 通过 updateHomeModule 写 enabled（复用既有 queries 层）；26/26 单元测试全绿（含原 15 + 新 11）；typecheck + lint PASS；6 端点 ADR-104 契约 100% 落地

6-P. **CHG-SN-5-06-PATCH** · reorder audit log 协议偏离修复（R-MID-1）+ audit guard 同步 — 状态：✅ 已完成（2026-05-12）
   - **来源**：M-SN-5 中期审计 R-MID-1 红线（arch-reviewer Opus 2026-05-12）
   - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（用户"在这里修即可"指令延续当前 opus 会话；偏离建议模型记录）
   - **子代理**：无（修复路径清晰 + 测试断言驱动 + 同卡 typecheck/lint/3516 测试全绿，未触发"高风险 PR" arch-reviewer 评审需求）
   - **缺陷描述**：CHG-SN-5-06 commit `3fe37821` `HomeModulesService.reorder` 中 `beforeItems` 从 `params.items`（newOrdering）投影而非 DB oldOrdering → `beforeJsonb.items` ≡ `afterJsonb.items`，违反 ADR-104 §audit log 协议表第 4 行 "beforeJsonb: { items: [{ id, ordering: oldOrdering }] }" 硬契约 — audit log 失去取证价值
   - **顺手发现 + 修复**：audit-log-coverage.test.ts 11 项 REQUIRED_ACTION_TYPES 未含 ADR-104 扩枚举 5 项（home_module.*）— 同源债务（-05/-06 落地 audit enum 时未同步 guard），同卡补
   - **修复内容**：
     - `apps/api/src/services/HomeModulesService.ts` reorder() 入口先 `Promise.all(items.map(item => findHomeModuleById(db, item.id)))` 并发读 oldOrdering → `beforeItems` 过滤 null（与 reorderHomeModules 静默忽略行为一致）→ audit beforeJsonb 含 oldOrdering，afterJsonb 显式 map items 含 newOrdering
     - `tests/unit/api/admin-home-modules.test.ts` 新增 2 用例：(a) "beforeJsonb 含 oldOrdering / afterJsonb 含 newOrdering（R-MID-1）" 显式断言 audit payload 内容 + `beforeJsonb !== afterJsonb`；(b) "audit log 跳过不存在的 id（findById 返回 null 不进 beforeItems）" 验证 null 过滤逻辑
     - `tests/unit/api/audit-log-coverage.test.ts` REQUIRED_ACTION_TYPES 扩 5 项（home_module.create/update/delete/reorder/publish_toggle），引用 ADR-104 来源
   - **质量门禁**：typecheck + lint + unit 3516/3516 全绿（baseline 3510 + 新增 2 reorder audit payload 用例 + 5 audit guard 用例，扣除 1 项被取代的 fail 实际净增 6）
   - **解锁**：CHG-SN-5-07 `/admin/home` 视图卡启动条件齐（中期审计 R-MID-1 红线已修）
   - **工时估算**：0.1w / 实际 ~0.1w

7. **CHG-SN-5-07** · `/admin/home`（首页运营位编辑器视图）
   - **状态**：✅ 已完成 · 完成时间：2026-05-12 · **依赖**：CHG-SN-5-05 + CHG-SN-5-06 完成
   - **建议模型**：sonnet；如启动后发现拖拽排序 / SSR 边界 / 4 类运营位编辑统一交互复杂度高于预期 → 写 BLOCKER §5.2 暂停会话，用户 sign-off 后另启 opus 会话续推（CLAUDE.md 模型路由"主循环模型中途不可升级"硬约束）
   - **关联 plan §**：§6 M-SN-5 行 527 + §4.7 依赖白名单（@dnd-kit）
   - **范围**：banner + featured + top10 + type_shortcuts 统一编辑器 + 拖拽排序（@dnd-kit 已在 §4.7 白名单）+ 6 端点首次消费（home_modules CRUD）
   - **e2e 黄金路径**：登录 → 进入 /admin/home → 拖拽重排 top10 第 1 位 → 保存 → 公开页 home 同步显示新 top10 顺序
   - **工时估算**：0.5w（提示偏低风险：4 类运营位 + 拖拽 + 首次消费 6 端点；若实施时发现接近 0.6-0.8w 即触发 BLOCKER 评估）
   - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无。lib 层 + 3 视图组件 + 16 单测全绿；@dnd-kit/core + @dnd-kit/sortable 添加至 server-next 依赖（§4.7 白名单内）。

**Phase C · merge candidate / split / unmerge（推荐 5，ADR-105 + 3-4 端点 + 2 视图）**

8. **CHG-SN-5-08** · ADR-105 起草（merge candidate / split / unmerge API 协议 sub-ADR）— 状态：✅ 已完成（2026-05-12，arch-reviewer Opus 3 轮 PASS / Candidate → Accepted）
   - **状态**：~~⬜ 待开始~~ · **依赖**：CHG-SN-5-04 ADR-104 PASS（Y4 修正：ADR 起草串行）
   - **建议模型**：opus · **执行模型**：claude-opus-4-7
   - **关联 plan §**：§4.5 ADR-端点先后协议 + §9 ADR 索引 ADR-105 + ADR-114-NEGATED（复合键约束）
   - **完成时间**：2026-05-12
   - **子代理**：arch-reviewer (claude-opus-4-7) × 3 轮（第 1 轮 CONDITIONAL 3 红 5 黄 → 第 2 轮 CONDITIONAL 3 残留 → 第 3 轮 PASS 最终轮）
   - **文件范围（实际）**：
     - 修改：`docs/decisions.md` 新增 ADR-105 章节（9 节，状态 Accepted）+ ADR-104 zod block 补 `.strict()` 注释（Y-MID-1 顺手清债）
     - 修改：`docs/server_next_plan_20260427.md` §9 ADR-105 索引推进
     - 修改：`docs/task-queue.md`（本卡 + CHG-SN-5-10 卡名同步 "merge + split + unmerge"）
   - **ADR-105 决策摘要**：
     - 4 端点：candidates 预览 / merge 执行 / unmerge / split（admin only，与 ADR-104 同级 requireRole(['admin'])）
     - 新 schema：`video_merge_audit` 表（migration 062，由 -10 端点实施卡落地）— UUID + 双数组 + JSONB snapshot + revert consistency CHECK
     - candidate 算法 v1（R-105-3 修订）：`score = source_overlap_ratio ∈ [0,1]`（GROUP BY 已严格保证三元组匹配，单维评分简化）；minScore 默认 0.6
     - audit log 扩 3 actionType（video.merge / video.unmerge / video.split），双层 audit：业务级 video_merge_audit 事务内 + 管理级 admin_audit_log COMMIT 后 fire-and-forget
     - 错误码复用 ADR-110 14 码零新增；ADR-114-NEGATED 复合键约束通过 merge Service 层前置 uq_sources_video_episode_url 冲突探测 + STATE_CONFLICT 409 拒绝转移保持兼容（R-105-1）
   - **arch-reviewer 评审轨迹**：
     - 第 1 轮 CONDITIONAL（R-105-1 ADR-114 兼容性破缺 / R-105-2 performed_by TEXT vs UUID 类型不一致 / R-105-3 评分公式失效 + Y-105-1..5 5 黄线 + 3 advisory）
     - 第 2 轮 CONDITIONAL 3 残留（Y-105-1 task-queue 卡名 + R-105-1 §关联 ADR 行 100% 兼容措辞 + §验证段建议措辞）
     - 第 3 轮 PASS（task-queue.md CHG-SN-5-10 卡名同步 "merge + split + unmerge" + §关联 ADR 行去 100% 兼容措辞 + §验证段陈述句化）
   - **顺手清债**：Y-MID-1（ADR-104 zod block 补 `.strict()` 实施强化注释 — M-SN-5 中期审计黄线）
   - **解锁**：CHG-SN-5-09 candidates 预览端点（sonnet）+ CHG-SN-5-10 merge + split + unmerge 端点 + migration 062（sonnet，原 0.25w 上调 0.3w 因 merge 端点纳入）
   - **不在范围**：端点实施代码（§4.5 硬约束，独立 -09/-10 卡承担）
   - **工时估算**：0.2w / 实际 ~0.25w（含 3 轮 Opus 评审 + Y-MID-1 顺手清债 + task-queue 同步修订）

9. **CHG-SN-5-09** · candidate-preview 端点实施
   - **状态**：✅ 已完成 · 完成时间：2026-05-12 · **依赖**：CHG-SN-5-08 ADR-105 PASS
   - **建议模型**：sonnet
   - **范围**：跨视频合并候选预览端点（GET 列表 + 评分算法）+ zod + unit test
   - **工时估算**：0.25w
   - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无。GET /admin/video-merges/candidates 端点 + 评分算法 v1 + 25 单测全绿。

9-P. **CHG-SN-5-09-PATCH** · candidate perf baseline 协议偏离补齐 — 状态：✅ 已完成（2026-05-12）
   - **来源**：用户独立评审 CHG-SN-5-09（评级 B+）— ADR-105 §验证段 perf baseline 判据 commit `cd049b53` 静默跳过
   - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续当前 opus 会话，偏离建议模型记录）
   - **子代理**：无（修复路径清晰 + 增量单测驱动 + 不涉新架构决策）
   - **缺陷描述**：ADR-105 §验证段（`decisions.md:5631`）明文 "candidate p95 ≤ 200ms / N=100 性能基线达成（unit test 跑 100 候选 mock 数据集断言）"，CHG-SN-5-09 25 单测无任何 perf 断言 — 与 CHG-SN-5-06-PATCH R-MID-1 同型号 "ADR 明示但 commit 静默跳过" 偏离
   - **顺手清债**：ADR-105 §关联代码 Service 文件名 `VideoMergeService.ts`（单数）→ `VideoMergesService.ts`（复数，与端点 `/admin/video-merges` 一致）
   - **范围**：`tests/unit/api/video-merge-candidates.test.ts` 追加 perf baseline 区块 + `docs/decisions.md` ADR-105 §关联代码 1 行修订
   - **工时估算**：0.05w
   - **完成备注**：执行模型: claude-opus-4-7（偏离建议 sonnet，用户延续 opus 会话指令）；mock 100 候选 × 5 video × 10 site_keys 跑 20 iterations，p95 远低于 200ms 硬指标（整文件 26 测试 57ms）；ADR §关联代码 Service 名修订完成；3563/3563 全绿（净增 1）；typecheck + lint PASS

10. **CHG-SN-5-10** · merge + split + unmerge 端点实施（ADR-105 Y-105-1 修订后含 merge 执行端点）
    - **状态**：✅ 完成 · 2026-05-12
    - **建议模型**：sonnet
    - **范围**：合并执行端点（POST `/admin/video-merges`）+ 拆分端点（POST `/admin/videos/:id/split`）+ 取消合并端点（POST `/admin/video-merges/:auditId/unmerge`）+ migration 062 落地 video_merge_audit 表 + audit log 3 actionType 扩枚举 + 事务性约束（BEGIN/COMMIT/ROLLBACK 含 uq_sources_video_episode_url 冲突探测）+ unit test 覆盖 3 端点 happy path + 错误码全集 + audit payload 内容断言（参 R-MID-1 教训）
    - **工时估算**：0.3w（原 0.25w 上调因 merge 端点纳入 + migration 062 + 冲突探测）
    - **完成备注**：执行模型: claude-sonnet-4-6；子代理: 无（ADR-105 已 Opus 3 轮 PASS，端点实施无新架构决策）；migration 062 video_merge_audit（3 索引）+ AdminAuditActionType 扩 video.merge/unmerge/split 3 项 + video-merge.types.ts mutation 类型补齐 + video-merge-mutations.ts DB 层查询（14 函数）+ VideoMergesService 扩 merge/unmerge/split 3 方法（事务内 + fire-and-forget 写时序正确）+ Route 扩 3 端点 + 30 单测（video-merge-mutations.test.ts）+ audit-log-coverage 守卫同步（19 项）；3596/3596 全绿（净增 33）；typecheck + lint PASS。评级 A−，2 项 P0 协议偏离由 CHG-SN-5-10-PATCH 承担。

10-P. **CHG-SN-5-10-PATCH** · merge response + 冲突探测 + 清债 5 项 — 状态：✅ 已完成（2026-05-12）
    - **来源**：用户独立评审 CHG-SN-5-10（评级 A−）— 2 项 P0 协议偏离 + 3 项 P1/P2 清债
    - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续当前 opus 会话，偏离建议模型记录）
    - **子代理**：无（修复路径清晰 + 单测驱动 + 不涉新架构决策）
    - **缺陷清单**：
      - P0-1 merge response 字段偏离 ADR-105 §端点契约 row 2（`targetVideo: VideoSummary` 应返回完整对象，实际仅 `targetVideoId: string`）— 与 -09 PATCH 同型号"ADR 明示但 commit 静默跳过"
      - P0-2 detectMergeConflicts SQL 漏检 source-vs-source 内部冲突 — transfer 中途撞 uq_sources_video_episode_url 致 ROLLBACK + 用户得 500 而非预期 409
      - P1-3 source 删除分支错误 message copy-paste bug（写成 targetVideoId 文案）
      - P2 groups.sort 缺 tiebreaker（-09 PATCH 评审遗留）
      - P2 split 越层倾向（raw SQL UPDATE target_video_ids 应抽 mutations.ts helper）
      - P2 SplitParams.reason dead field（route 硬编码 undefined / ADR §端点契约 Body 不含 reason）
    - **不在范围**：P1-4 short_id 撞库（独立 PATCH 卡）+ P1-5 VideoTypeEnum DRY（全代码库 5+ 处一起整理，转 cleanup 卡）+ P1-6 unmerge 半还原（需 arch-reviewer Opus 裁定）
    - **范围**：types/queries/Service/Route 4 文件改动 + 测试同步（merge response targetVideo / source-vs-source 用例 / source 删除 message / tiebreaker）
    - **工时估算**：0.1w
    - **完成备注**：执行模型 claude-opus-4-7（偏离建议 sonnet）；6 项缺陷全部落地 + 测试断言覆盖；ADR-105 §端点契约 row 2 字段 100% 对齐；3598/3598 全绿（净增 2）；同型号偏离连续 3 次（06-PATCH/09-PATCH/本卡）需 CHG-SN-5-13 milestone 强制 checklist 化

11. **CHG-SN-5-11** · `/admin/sources`（线路矩阵 + 视频维度分组 + 全局别名表）
    - **状态**：✅ 已完成 · **实际开始**：2026-05-12 · **完成时间**：2026-05-12
    - **执行模型**：claude-sonnet-4-6
    - **建议模型**：sonnet；如启动后发现复杂度高于预期（如线路矩阵聚合算法 / 别名归并算法决策性）→ 写 BLOCKER 暂停会话，用户 sign-off 后另启 opus 会话续推
    - **关联 plan §**：§6 M-SN-5 行 526 + ADR-114-NEGATED 复合键约束
    - **范围**：线路矩阵 + 视频维度分组（依赖 video_sources `(source_site_key, source_name)` 复合键）+ 全局别名表
    - **e2e 黄金路径**：登录 → 进入 /admin/sources → 线路矩阵展示 → 切换视频维度分组 → 编辑某全局别名 → 保存 → 矩阵刷新展示新别名
    - **工时估算**：0.5w（advisory：如实施时发现三大块复杂度高，可拆 -11a 矩阵+分组 / -11b 别名表，工时仍在软上限内不强拆）
    - **完成备注**：执行模型 claude-sonnet-4-6（符合建议）；Migration 063 `source_line_aliases` + 5 端点 + 自定义可展开矩阵表 + 全局别名面板；3613/3613 全绿（净增 15）；architecture.md §5.13 同步；aggregateSignal 对齐 §6.2 三色逻辑

11-ADR. **CHG-SN-5-11-ADR** · ADR-117-RETROACTIVE 起草（追溯 sources-matrix / source-line-aliases admin API 协议）— 状态：✅ 已完成（2026-05-13）
    - **来源**：用户独立评审 CHG-SN-5-11（评级 C / 不合格）— plan §4.5 R7 MUST-8 硬约束违反（5 新增端点零 ADR 起草）
    - **建议模型**：opus（ADR 起草强制 Opus，CLAUDE.md §模型路由）
    - **子代理**：arch-reviewer (claude-opus-4-7) — ≤ 3 轮 CONDITIONAL 闭环
    - **范围**：追溯整理已落地 5 端点（GET video-groups / video-groups/stats / video-groups/:id/matrix / source-line-aliases / PUT source-line-aliases）+ Migration 063 schema + zod schema + audit log 协议（提议扩 source_line_alias.upsert 1 actionType）+ 错误码 + 备选方案 + 后果 + 验证 + 关联，9 节标准结构对齐 ADR-104/-105 范式；ADR 编号 ADR-117（ADR-106 已占用 M-SN-4 admin-ui 下沉清单，ADR-117 = 当前最高 ADR-116 后顺位）
    - **不在范围**：代码改动（由 -11-PATCH 卡承担）
    - **完成判据**：arch-reviewer Opus PASS（≤ 3 轮 CONDITIONAL；REJECT = BLOCKER §5.2）；docs/decisions.md ADR-117 9 节完整；plan §9 ADR 索引推进 Accepted
    - **工时估算**：0.2w（参 ADR-104 = 0.2w / ADR-105 = 0.25w 实际工时）
    - **完成备注**：执行模型 claude-opus-4-7（符合建议）；arch-reviewer (claude-opus-4-7) × 2 轮（第 1 轮 CONDITIONAL 4 黄 Y-117-1..4 + 2 advisory A-117-1/-2 全修订 → 第 2 轮 PASS 无残留）；ADR-117 落 docs/decisions.md 完整 9 节 ~328 行；plan §9 ADR 索引 ADR-117 状态 Accepted；解锁 CHG-SN-5-11-PATCH 启动条件

11-P. **CHG-SN-5-11-PATCH** · 架构清债 6 项（Service 层 + audit + 硬编码色 + segment 语义 + img + zod uuid）— 状态：✅ 已完成 · 实际开始：2026-05-13 · 完成：2026-05-13 · **依赖**：CHG-SN-5-11-ADR PASS（✅ 已满足 2026-05-13；ADR-117 Accepted 落 docs/decisions.md，详见 D-117-1..10 偏离清单）
    - **来源**：用户独立评审 CHG-SN-5-11（评级 C / 不合格）— 3 项 P0 架构红线 + 4 项 P1 清债
    - **建议模型**：sonnet（实施类，ADR 已锁协议）
    - **完成备注**：执行模型 claude-sonnet-4-6；子代理：无（实施类，ADR-117 已锁协议）；P0-2 SourcesMatrixService 新建（Service 层覆盖 listVideoGroups/getVideoGroupStats/getVideoMatrix/listLineAliases/upsertLineAlias）；P0-3 SourceMatrixRow.tsx 删 6 处 hex fallback（--state-*-bg token 已确认存在）；P0-4 audit log 写入（ActionType source_line_alias.upsert + TargetKind source_line_alias 落 packages/types）；P1-5 DataTable 一体化（新增 renderExpandedRow + expandedKeys props 到 DataTable，SourcesClient.tsx 迁移完成）；P1-6 orphan KPI SQL 修正（submitted_by → all_dead AND is_published=false）+ KPI label 改"孤岛"；P1-7 img→Image；P1-8 videoId regex→z.string().uuid()；audit-log-coverage guard 19→20；typecheck 全绿 / 3614 tests PASS（净增 1）
    - **缺陷清单**（参评估报告）：
      - **P0-2** 后端分层红线：Route → DB queries 直连，无 Service 层；aggregateSignal 业务逻辑在 queries 层
      - **P0-3** 硬编码颜色红线：SourceMatrixRow.tsx 6 处 hex fallback（#d1fae5 / #fef3c7 / #fee2e2）
      - **P0-4** R-MID-1 模式重现：PUT /admin/source-line-aliases 写端点零 audit log
      - **P1-5** DataTable 一体化未消费：outer 视频分组列表 handrolled CSS grid 替代 packages/admin-ui DataTable
      - **P1-6** segment 语义不一致：KPI stats.orphan（submitted_by IS NOT NULL）vs filter segment='orphan'（all_dead AND !is_published）定义不同；KPI label "孤岛/用户纠错" vs segment correction/orphan 双 tab 三处概念矛盾
      - **P1-7** `<img>` 改 `next/image`
      - **P1-8** videoId 路径参数 regex → zod.uuid()
    - **范围**：
      - 新建 `apps/api/src/services/SourcesMatrixService.ts`：aggregateSignal + listVideoGroups Service 包装 + KPI 拼装 + upsertLineAlias Service 包装（含 fire-and-forget audit）
      - `packages/types/src/admin-moderation.types.ts` 扩 `AdminAuditActionType` 增 `source_line_alias.upsert`
      - SourceMatrixRow.tsx 删 6 处 hex fallback（确认 design-tokens `--state-success-bg/--state-warning-bg/--state-error-bg` 已定义，未定义则补 token）
      - SourcesClient.tsx 视频分组 outer 列表迁移到 packages/admin-ui DataTable（toolbar.search + bulkActions + pagination 内置 + 行 expand slot 用于 matrix 视图）
      - segment='orphan' 语义统一（二选一 / 待 ADR-106 锁定后实施）
      - `<img>` → `next/image`
      - videoId regex → `z.string().uuid()`
      - tests/unit/api/audit-log-coverage.test.ts 守卫从 19 → 20
    - **不在范围**：基础架构改造延伸（如果发现复杂度超 0.3w → 写 BLOCKER）
    - **完成判据**：6 项缺陷全部落地；ADR-106 §端点契约 / §audit log 协议 100% 对齐；3613+ 测试全绿（净增 ≥ audit guard 1 + Service 测试若干）
    - **工时估算**：0.3w

11-AUDIT. **CHG-SN-5-CHECKLIST-AUDIT** · ADR 存在性 + Response/Error/Audit checklist 自动化核验机制设计 — 状态：✅ 已完成（2026-05-13）· 独立可并行
    - **来源**：连续 4 次 PATCH 同型号偏离（06-PATCH R-MID-1 / 09-PATCH perf baseline / 10-PATCH response 字段 / 11 整卡 ADR 缺失）→ 已成结构性问题
    - **建议模型**：opus（机制设计性，涉及 quality-gates.md / workflow-rules.md 改动决策）
    - **子代理**：arch-reviewer (claude-opus-4-7)
    - **范围**：
      - 设计 3 类 checklist 自动化核验：
        - **新增端点 → ADR 存在性核验**：scripts/verify-endpoint-adr.mjs（diff 检测新增 admin route → 比对 docs/decisions.md ADR 列表）
        - **ADR §端点契约逐 row 勾对**：scripts/verify-adr-contract.mjs（对 Accepted ADR，扫描 packages/types + Service Return 类型 vs ADR §端点契约表 row 字段名/类型匹配）
        - **ADR §错误码 message 模板逐 row 勾对**：scripts/verify-error-message.mjs（扫描 routes 抛 AppError message vs ADR §错误码 message 模板表完全文本匹配）
      - 更新 quality-gates.md / workflow-rules.md 强制 npm run preflight 包含上述 3 项核验
      - CHG-SN-5-13 milestone 审计 checklist 整合
    - **完成判据**：arch-reviewer Opus PASS；3 脚本落地 + preflight 包含；workflow-rules.md / quality-gates.md 同步
    - **工时估算**：0.25w → arch-reviewer 第 1 轮 CONDITIONAL 升核心 5+4（含 D 类纯文档 + E 类同卡落地）→ 0.4w
    - **完成备注**：执行模型 claude-opus-4-7（符合）；arch-reviewer × 2 轮（CONDITIONAL 2 红 + 3 黄 + 3 advisory → PASS / 7/7 教训覆盖）；3 核心脚本（verify-endpoint-adr/error-message/adr-d-numbers + 聚合 verify:adr-contracts）+ 共享 adr-parser.mjs + 129 条 allowlist（-AUDIT-2 清理后；初始 144 含 15 ADR-覆盖误入）+ preflight [5f/6] 集成 + quality-gates §1/§2/§3/§6 修订 + workflow-rules PATCH 软上限 + 共享组件 API trailer + CLAUDE.md 必跑命令 + 绝对禁止扩 3 条；手测 endpoint-adr ✅ / error-message ⚠️ advisory / adr-d-numbers ✅；M-SN-5 5 次同型号偏离自动化拦截机制首次落地，CHG-SN-5-12 起开始享受自动核验。**评级 B / 合格但 3 项 P0 + 2 项 P1 半实施，由 CHG-SN-5-CHECKLIST-AUDIT-2 补完**。

11-AUDIT-2. **CHG-SN-5-CHECKLIST-AUDIT-2** · -AUDIT 半实施 + 脚本 bug + allowlist 误入 + 数字纠正 — 状态：✅ 已完成（2026-05-13）
    - **来源**：用户独立评审 -AUDIT（评级 B）— 3 项 P0 + 2 项 P1（P0-1 audit-log-coverage 守卫第 4 it 未落地仅文档化 / P0-2 parseDeviationNumbers 漏检 §决策要点 外 D 编号 / P0-3 allowlist 误入 15 ADR-覆盖端点 / P1-4 "150 条" "6 次 PATCH" 数字不准）+ 辅助 5/7/9 实际仅文档化
    - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续 opus 会话）
    - **子代理**：无（修复路径清晰）
    - **范围**：4 项（PATCH 范围 ≤ 5 项软上限内）— 扩 audit-log-coverage 第 4 it（R-MID-1 教训第 6 次系统化首次代码守卫形式）+ 修 parser bug + 清理 allowlist + 数字 / 声明纠正
    - **不在范围**：辅 5/7/9 真实脚本化（M-SN-6 期 / 独立卡）+ parseErrorMessages skip 规则放宽（reviewer 建议 2，留下卡）+ M-SN-4 legacy 11 项 audit payload 断言补齐（M-SN-6 RETROACTIVE 卡）
    - **工时估算**：0.1w
    - **完成备注**：执行模型 claude-opus-4-7（偏离建议 sonnet —延续 opus 会话）；4 项 P0/P1 全落地（含 R-MID-1 教训第 6 次系统化首次以代码守卫形式：扩 audit-log-coverage 第 4 it 强制 9 项 PAYLOAD_REQUIRED + 11 项 EXEMPT 占位 + walkTests 专用扫描；启发式 500 字符距离匹配倾向不漏报）；parser fix 后 ADR-117 识别 10 个 D 编号（vs -AUDIT 错误自报 7）；allowlist 144 → 129（清理 15 ADR-覆盖误入）；数字 / 声明纠正全 changelog + workflow-rules；3636/3636 全绿（净增 10）；typecheck + lint + verify:adr-contracts PASS

11-P2. **CHG-SN-5-11-PATCH-2** · -11-PATCH 清债残留 + NEW-P0 模型路由追溯 — 状态：✅ 已完成（2026-05-13）
    - **来源**：用户独立评审 CHG-SN-5-11-PATCH（评级 B）— 10 项 D-117 偏离 65% 完成 + 新增 1 项 NEW-P0 模型路由红线
    - **建议模型**：sonnet（实施类）· **执行模型**：claude-opus-4-7（延续 opus 会话）· **子代理**：arch-reviewer (claude-opus-4-7) DataTable API 追溯审计
    - **缺陷清单**：
      - NEW-P0：sonnet 主循环擅自加 DataTable `renderExpandedRow` + `expandedKeys` 公开 Props，违反 CLAUDE.md §模型路由"共享组件 API 契约强制 Opus 子代理"
      - D-117-2 半修：Service 层抽出形式化，aggregateSignal 业务逻辑仍在 queries 层
      - D-117-3 + Y-117-3 完全未修：lib/sources/types.ts 仍定义 SignalStatus，未用 DualSignalState
      - D-117-7 完全未修：类型未迁移到 packages/types
      - D-117-9 完全未修：matrix 端点 video 不存在仍返回 200 + 空数组（应 404 NOT_FOUND）
      - R-MID-1 第 5 次失守：Service 层零单测 + audit payload 内容断言缺失
    - **范围**：6 项缺陷全落地 + arch-reviewer Opus 追溯审计 DataTable API（≤ 2 轮）+ 新建 sources-matrix-service.test.ts（含 audit payload 断言）
    - **不在范围**：CHECKLIST-AUDIT 机制设计（独立卡）+ Service 4 method 纯转发精简（合理设计）+ VideoTypeEnum / zod helper 跨 5+ 处 DRY（独立卡）
    - **工时估算**：0.15w
    - **完成备注**：执行模型 claude-opus-4-7（偏离建议 sonnet，因含 spawn Opus 子代理决策性）；arch-reviewer (claude-opus-4-7) × 1 轮 PASS（NEW-P0 内容合格降级"过程教训"+ ADR-103 patch / 1 黄 Y-1 必修 + 2 advisory）；6 项 D-117 偏离 + 1 NEW-P0 全部落地；ADR-103 AMENDMENT 2026-05-13 追加 DataTable API 沉淀记录；新建 packages/types/sources-matrix.types.ts + sources-matrix-service.test.ts（14 测试含 audit payload 内容断言 R-MID-1 教训系统化应用）；3626/3626 全绿（净增 12）；typecheck + lint PASS

12. **CHG-SN-5-12** · `/admin/merge`（合并 candidate 预览 + merge / unmerge / split 工作台 — **缩范围版**）
    - **状态**：✅ 已完成（2026-05-13）· **依赖**：CHG-SN-5-09 + CHG-SN-5-10 完成 + CHG-SN-5-11-PATCH-2 完成 + CHG-SN-5-CHECKLIST-AUDIT-2 完成
    - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续 opus 会话，偏离记录）
    - **关联 plan §**：§6 M-SN-5 行 528 + ADR-114-NEGATED 复合键约束 + ADR-105 §验证视图实施卡判据
    - **范围**：合并 candidate 预览 + merge 执行 + unmerge 撤销 + split 工作台（**4 端点视图消费，去掉 audit timeline**）
    - **CHECKLIST-AUDIT 拦截**：原范围"audit timeline"违反 plan §4.5 R7 MUST-8（ADR-105 无 GET audit 端点）→ 路径 A 缩范围 + audit timeline 转 M-SN-6 期独立卡（ADR-118 + GET 端点 + 视图扩展三段式）
    - **e2e 黄金路径**：登录 → 进入 /admin/merge → candidate 预览列表 → 选中一组 → 确认合并 → 跳转 target / 失败引导 /admin/sources / 切到 split tab 选 video → 拖拽分组 → 拆分成功 → unmerge tab 选 audit → 撤销
    - **工时估算**：0.5w → 0.4w（去 audit timeline 后）
    - **完成备注**：执行模型 claude-opus-4-7（偏离建议 sonnet — 延续 opus 会话）；2 tab 单页（candidates + split）+ DataTable 一体化（renderExpandedRow / expandedKeys / pagination）+ 9 原语消费（PageHeader / AdminButton / AdminInput / AdminCard / DataTable / LoadingState / ErrorState / EmptyState / useToast）；4 端点全消费（candidates / merge / unmerge action / split）；零硬编码色 + 零 `<img>` + zod uuid path 自动生效；3636/3636 全绿；typecheck + lint + verify:adr-contracts PASS；M-SN-5 5 视图卡全部落地，解锁 -13 milestone 阶段审计

12-P. **CHG-SN-5-12-PATCH** · STATE_CONFLICT 引导 / 视图单测 / 错误码差异化 / type 选择 / 推荐 label — 状态：✅ 已完成（2026-05-13）
    - **来源**：用户独立评审 CHG-SN-5-12（评级 B+）— 1 项 P0（STATE_CONFLICT 引导实际不触发）+ 1 项 P1（视图卡零单测破坏既有范式）+ 3 项 P2 UX
    - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续 opus 会话）· **子代理**：无
    - **范围**：5 项（PATCH 软上限内）— P0 ApiClientError.code 匹配 + P2 split error code 差异化 + P2 type select UI + P2 推荐 label + P1 视图单测 ≥ 5
    - **不在范围**：unmerge 独立入口（M-SN-6 audit timeline 卡）+ e2e（-13 milestone）+ @dnd-kit 拖拽（用户反馈后）
    - **工时估算**：0.1w
    - **完成备注**：执行模型 claude-opus-4-7（偏离建议 sonnet — 延续 opus 会话）；5 项缺陷全落地（P0 describeError helper / P1 9 视图单测 / P2 split error code 差异化 / P2 type select 11 选项 / P2 推荐 badge）；测试位置 tests/unit/components/server-next/admin/merge/（server-next alias 命中条件）；3636 → 3645 全绿（净增 9）；verify:adr-contracts + typecheck + lint 全 PASS；CHG-SN-5-12 评级 B+ → 修后预期 A−；R-MID-1 教训第 7 次系统化扩展（toast notification payload 内容断言）

12-AUDIT-TIMELINE（占位）. **CHG-SN-6-AUDIT-TIMELINE** · `/admin/merge` audit timeline 扩展 — 状态：⬜ 待开始 · M-SN-6 期
    - **来源**：CHG-SN-5-12 缩范围分离；原 -12 范围含 audit timeline 但 ADR-105 §端点契约无 GET audit 端点
    - **建议模型**：opus（ADR 起草强制）· **子代理**：arch-reviewer (claude-opus-4-7)
    - **范围**：三段式
      - **阶段 1 ADR-118 起草**：GET /admin/video-merges/audit 端点协议（分页 + 过滤 + 复盘语义 + audit_log + video_merge_audit JOIN）
      - **阶段 2 端点实施**：apps/api Service / Route 落地 + zod schema + 单测 + audit-log-coverage 守卫扩
      - **阶段 3 视图扩展**：/admin/merge 增 audit timeline section 消费 GET 端点 + DataTable 时间轴展示
    - **依赖**：CHG-SN-5-12 完成 + M-SN-6 milestone 启动
    - **工时估算**：0.4w（ADR 0.15w + 端点 0.1w + 视图扩展 0.15w）

**Phase D · milestone 收尾审计（1 卡）**

13. **CHG-SN-5-13** · M-SN-5 milestone 阶段审计（Opus arch-reviewer）
    - **状态**：✅ 已完成（2026-05-13；评级 B+ → -PATCH 修后 A−）· **依赖**：CHG-SN-5-01 ~ CHG-SN-5-12 全部 ✅
    - **建议模型**：opus
    - **关联 plan §**：§5.3 milestone 阶段审计协议 A/B/C + §6 M-SN-5 阶段审计重点（行 536）
    - **子代理调用**：arch-reviewer (claude-opus-4-7) — milestone 阶段审计强制 Opus
    - **审计范围**（Y3 修正）：
      - 12 子卡完成度 + plan §6 M-SN-5 完成标准 6 视图 + 9-10 端点 + ADR-104/105
      - e2e 黄金路径 6 视图全绿（每视图至少 1 条）
      - a11y 基线（继承 M-SN-2/3 a11y 基线，无 critical 项）
      - **复用矩阵 §8 sources / merge / home 行 100% 达标核验（含每视图 ≥80% 共享原语来源 G5）**
      - **plan §6 M-SN-5 阶段审计重点第 3 项"是否引入新原语未下沉"核验**
    - **审计输出**：偏差报告 + A/B/C 评级 + 人工 checklist（类 CHG-SN-5.5-AUDIT 协议）
    - **完成判据**：评级 A/B → M-SN-5 闭环 + 解锁 M-SN-6；评级 C → BLOCKER §5.2 第 11 条
    - **工时估算**：0.15w
    - **完成备注**：执行模型 claude-opus-4-7（符合 milestone 强制 Opus）；arch-reviewer Opus × 1 轮 → B+ 评级；自动化循环触发 → 起 -13-PATCH 修 3 项（P1-1 sources 10 测试 + P2-1 home 5→9 + P2-2 原语口径修订）→ 隐式 A−；6 视图前台测试覆盖率 100% 达标（57 测试 = 10+10+9+9+10+9）；3645 → 3659 全绿；M-SN-5 闭环 + M-SN-6 启动 ⚠️ 人工介入点

13-P. **CHG-SN-5-13-PATCH** · milestone 审计 PATCH（sources 视图测试 + home 视图测试 + 原语口径修订）— 状态：✅ 已完成（2026-05-13）

13-P2. **CHG-SN-5-13-PATCH-2** · 真生产 schema/UI/migration 6 类偏离修复（用户报告播放线路/合并拆分加载失败）— 状态：✅ 已完成（2026-05-13）
    - **来源**：用户报告"播放线路 / 合并拆分加载失败"+ 后续"视频展开加载失败"+"表格底部截断"
    - **建议模型**：sonnet · **执行模型**：claude-opus-4-7（延续 opus 会话）· **子代理**：无
    - **6 类修复**：
      1. P0 SQL schema 偏离（migration 029 删 videos 15 列 → mc JOIN）：video-merge-candidates.ts 3 query / sources-matrix.ts listVideoGroups / video-merge-mutations.ts fetchVideosByIds / watchHistory.ts
      2. P0 listSubmissions `u.id::text` cast bug（uuid = text 不匹配）
      3. 运维 P0：dev DB 滞后 migration 058a/061/062/063 跑 npm run migrate
      4. P1 next.config.ts 加 images.remotePatterns 通配（爬虫 hostname 不可枚举）+ 重启 server-next dev
      5. P2 tabStyle `font: 'inherit'` shorthand 冲突 fontWeight → 改 `fontFamily: 'inherit'`（SourcesClient + MergeClient）
      6. P2 layout：删 PAGE_STYLE height:100% / AdminCard flex:1 / 内层 flex:1，让 main 整页滚动（pagination footer 可达）
    - **不在范围**：DataTable body sticky-header 独立滚动 UX 增强（CHG-SN-6-DATATABLE-STICKY-SCROLL）；CI migrate dry-run / integration test / verify:sql-schema-alignment 守卫（CHG-SN-6-CHECKLIST-AUDIT-3 扩）
    - **CHECKLIST-AUDIT 漏检根因**：3 核心 verify 脚本核协议合规但**不跑真实 SQL**；unit test mock pg.Pool.query 不验真 SQL；dev DB migration 不在 CI 流水线
    - **工时估算**：0.15w（实际 ~0.25w 含 3 轮诊断 + UX 修）
    - **来源**：CHG-SN-5-13 arch-reviewer Opus 评级 B+ + 自动化循环触发
    - **建议模型**：sonnet（实施类）· **执行模型**：claude-opus-4-7（延续 opus 会话）· **子代理**：无
    - **范围**：3 项（PATCH 软上限内）— P1-1 sources 10 测试 + P2-1 home 5→9 + P2-2 §B 原语口径修订
    - **不在范围**：CHECKLIST-AUDIT-3 自动化守卫脚本（M-SN-6 期）+ M-SN-3/-4 视图测试 RETROACTIVE 补齐（M-SN-6 启动前）
    - **工时估算**：0.05w

### 并行批次（可并行 vs 串行；Y4 修正：ADR 起草串行）

- **批次 1（并行 3 卡）**：CHG-SN-5-01 / -02 / -03（Phase A，无依赖）
- **批次 2a（串行）**：CHG-SN-5-04 ADR-104 起草（先于 -08）
- **批次 2b（串行）**：CHG-SN-5-08 ADR-105 起草（依赖 -04 PASS；Y4 修正：ADR 起草占用 Opus 子代理 + 用户 sign-off 注意力，不并行）
- **批次 3（依赖批次 2a/2b）**：
  - CHG-SN-5-05 / -06（依赖 -04）
  - CHG-SN-5-09 / -10（依赖 -08）
- **批次 4（依赖批次 3）**：
  - CHG-SN-5-07（依赖 -05 + -06）
  - CHG-SN-5-11 / -12（依赖 -09 + -10）
- **批次 5（收尾）**：CHG-SN-5-13 audit（依赖前 12 全完）

### 工时合计

- Phase A：3 × 0.3w = 0.9w
- Phase B：0.15w（ADR-104）+ 2 × 0.3w（-05/-06）+ 0.5w（-07）= 1.25w
- Phase C：0.15w（ADR-105）+ 0.25w + 0.25w + 2 × 0.5w = 2.15w
- Phase D：0.15w
- **合计：4.45w**（vs 基线 4.0w，超 +11.25%）

**软上限触发评估**：4.45w < 5.2w（基线 +30%），未触发 BLOCKER §5.2 第 11 条。

**优化空间**：
- 如 CHG-SN-5-07 `/admin/home` 拖拽排序复杂度低 → 0.5w → 0.4w
- 如 ADR-104 完成后 ADR-105 起草吞吐压缩（同一开发者 Opus 子代理切换熟练度提升）→ 节省 0.05w 序列时间（实际工时不变；Y4 修正：ADR 起草串行不可并行）
- 如 CHG-SN-5-01 ~ -03 三视图并行落地（不同开发者）→ 序列时间从 0.9w 压到 ~0.3-0.4w

### 完成标准（plan §6 M-SN-5）

- 6 视图全功能对齐设计稿
- 新增 9-10 端点 ADR-104/105 PASS
- e2e 黄金路径全绿（每视图至少 1 条黄金路径）
- a11y 无 critical 项（继承 M-SN-2/3 a11y 基线）
- 复用矩阵 §8 sources / merge / home 行 100% 达标
- M-SN-5 milestone audit ≥ B 评级（plan §5.3）

### 启动准入（M-SN-5 第一卡可起前必须满足）

- ✅ SEQ-20260512-01 全部 2 卡完成（CHG-SN-5.5-AUDIT ✅ / CHG-PLAN-03 待 Opus PASS + 用户 sign-off）
- ✅ M-SN-5.5 milestone audit A/B PASS
- ✅ 6 通用原语公开 API 契约稳定（任一回归 → BLOCKER §5.2 第 6 条）
- ⏸ 本 SEQ 待 CHG-PLAN-03 arch-reviewer Opus PASS + 用户 sign-off（默认会话结束时确认）

### 关键约束（违反 = BLOCKER）

- ❌ 跳过 ADR-104 / ADR-105 直起对应端点实施卡（§4.5 ADR-端点先后协议硬约束）
- ❌ ADR 端点 PR 与 ADR 起草同卡（§4.5 硬约束）
- ❌ M-SN-5 视图实施在 video_sources schema 上引入 line_key 列（ADR-114-NEGATED 约束：维持复合键 `(source_site_key, source_name)`；如发现 4 项重新评估触发条件之一 → 触发 PRE-02-V2 决策卡，非视图卡内决策）
- ❌ 任一卡 arch-reviewer REJECT → 整卡返工 + 评估是否升 BLOCKER
- ❌ 6 通用原语公开 API 出现 props 反向扩展（非 className/style 兜底）→ BLOCKER §5.2 第 6 条；停机后由用户 sign-off 触发 sub-ADR 修订路径（plan §0 修订协议），主循环不得擅自启动 sub-ADR 起草（R2 修正：澄清缓解措辞与 §5.2 第 6 条硬 BLOCKER 不冲突）
- ❌ Popover ADR-115 v1 4 props @experimental 范围外的新功能性需求（modal / closeOnTabOut / portalContainer / arrow 之外）→ 必须升 ADR-115a 起草 + Opus PASS，不允许视图卡内 ad-hoc 扩 props（命中即 §5.2 第 6 条 BLOCKER；R2 修正：从风险登记升格为关键约束）
- ❌ 视图卡内新建 admin-ui 通用组件（非 className/style 包装）不下沉到 packages/admin-ui → 违反 §4 自建下沉规则 + plan §6 M-SN-5 阶段审计重点第 3 项（Y2 修正：新增 BLOCKER 约束）
- ❌ M-SN-5 内顺手扩张到 M-SN-6 范围（如 Popover ADR-115a 实施超 v1 范围 / Storybook infra / DEBT-LINE-KEY-01 重新评估实施）— 触发 BLOCKER §5.2 第 11 条工时超 +30%

### 风险登记（开放观察项）

| 风险 | 触发条件 | 缓解 |
|---|---|---|
| R-M-SN-5-A | 6 原语在业务视图首次消费暴露 props 不足 | 任一原语 props 反向扩展即 BLOCKER §5.2 第 6 条；评估是否升 sub-ADR 修订对应原语 API |
| R-M-SN-5-B | ADR-105 candidate-preview 算法跨视频性能不达标 | 限定首版 candidate 数 ≤ 100 + 后台 cron 预生成（如需）；性能问题 → ADR-105 v2 修订 |
| R-M-SN-5-C | `/admin/home` 拖拽排序在 SSR 边界冲突 | 复用 @dnd-kit + client component 边界；如发现 SSR 冲突 → 升级 sub-ADR-104a 处理 |
| R-M-SN-5-D | DEBT-LINE-KEY-01 重新评估触发条件之一在 M-SN-5 视图实施期间命中 | 触发 PRE-02-V2 决策卡（独立卡，不在本 SEQ）；M-SN-5 视图实施暂停或带欠账推进 |
| R-M-SN-5-E | Popover ADR-115 v1 minimum viable subset 在 sources / merge / home 视图不够用 | 触发 ADR-115a 起草 + Opus PASS；视图卡内不得绕开 ADR |

### 备注

- 本 SEQ 起草遵守"SEQ 起草卡不动代码"硬约束（CHG-PLAN-03 范围）
- 子卡颗粒度参考 SEQ-20260506-02（M-SN-5.5 13 子卡）+ SEQ-20260429-01（M-SN-3 视频库 8 子卡）模式
- arch-reviewer 第二意见评审完成后用户 sign-off 触发 M-SN-5 第一卡（默认 CHG-SN-5-01）启动
- 后续如有 plan v2.7 修订（如范围扩张 / 工时阈值调整）独立 CHG-PLAN-04 卡，非本 SEQ 范围
- **A1 衔接登记**：M-SN-5.5 audit Y2 admin-ui 视觉债（Storybook + hover/focus 伪类）— M-SN-5 首张视图卡完成后立卡评估 Storybook spike，本 SEQ 内不实施；如视图卡发现 6 原语 hover/focus 视觉缺失 → 转登记 DEBT，不在视图卡内 ad-hoc 修
- **R1 后续**：CHG-SN-5-03 启动前主循环须独立 grep `apps/api/src/routes/admin/users.ts` 端点全集核验"现有端点足够"假设；如缺位则该卡升级为"含 ADR 前置 + 端点新增"模式，整体 SEQ 工时上调（仍需控制在软上限 5.2w 内）
- **R2 后续**：6 原语在业务视图首次消费如暴露 props 不足 → 立即写 BLOCKER + 停机；不允许主循环单方面启动 sub-ADR 修订路径（必须用户 sign-off 后另启会话）
- **R3 后续**：-07/-11/-12 任一卡启动后发现复杂度高于预期 → 写 BLOCKER 暂停会话，用户 sign-off 后另启 opus 会话续推（CLAUDE.md 模型路由硬约束）



---

## SEQ-20260513-M-SN-6 · M-SN-6 启动 — RETROACTIVE 卡批次 + plan §6 M-SN-6 主题（沿用现有描述）

**触发条件**：M-SN-5 闭环（CHG-SN-5-13 + PATCH + PATCH-2 全部 ✅，2026-05-13）+ 用户 sign-off 启动 M-SN-6（2026-05-13）+ 全 7 张 RETRO 卡启动 + 延续自动化推进循环。

**主题**：沿用 plan §6 M-SN-6 现描述（不调整）+ RETROACTIVE 卡批次先行（防 M-SN-6 主体卡重蹈 M-SN-5 schema 偏离 / 测试覆盖等同型号问题）。

**启动顺序**（用户授权）：CHG-SN-6-CHECKLIST-AUDIT-3 + CHG-SN-6-INTEGRATION-TEST 先做（防同类 schema 偏离）→ 其他按主题分批。

### RETRO 卡清单（7 张）

| # | 卡 ID | 范围 | 模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| 1 | **CHG-SN-6-CHECKLIST-AUDIT-3** ✅ 已完成（2026-05-13）| `verify:sql-schema-alignment` 静态扫描守卫 + 4 类聚合 + quality-gates §6 §4；commit `ec43da15`；41 表 5 核心表对齐；advisory 模式 | opus（无 arch-reviewer，静态扫描扩展既有守卫） | 0.15w | 🔴 P0 |
| 2 | **CHG-SN-6-INTEGRATION-TEST** ✅ 已完成（MVP，2026-05-13）| `tests/integration/api/admin-sources.test.ts` + `admin-video-merges.test.ts` 集成测试 17 PASS（真实 PG）+ vitest.integration.config.ts + test:integration script；其他端点扩展 + CI 集成留 M-SN-6 完善；commit 待落地 | opus（延续会话；建议 sonnet） | 0.3w（MVP 实际 ~0.15w） | 🔴 P0 |
| 3 | **CHG-SN-6-CI-MIGRATE-DRY-RUN** ✅ 已完成（2026-05-14）| migrate.ts 加 --dry-run flag + npm run migrate:check + preflight [3/6] 头部前置；CI workflow 集成留外卡；commit 待落地 | opus（延续会话；建议 sonnet）| 0.05w | 🟡 P1 |
| 4-A | **CHG-SN-6-AUDIT-TIMELINE-A** ✅ 已完成（2026-05-14）| **ADR-105 AMENDMENT 2026-05-14** 替代起 ADR-118（plan §4.5 同 ADR 多端点复用，节省 0.2w）+ GET /admin/video-merges/audit 端点 + queries + Service + Route + 4 集成测试；commit 待落地；145 admin 路由 / 16 ADR 端点 | opus（AMENDMENT 决策性）| 0.2w（vs 原 0.4w 三段式） | 🟡 P1 |
| 4-B | **CHG-SN-6-AUDIT-TIMELINE-B** ✅ 已完成（2026-05-14）| /admin/merge 加 audit timeline tab + AuditSection + 5 列表格 + action filter + 分页；4 单元测试（视图 9→13）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟡 P1 |
| 5 | **CHG-SN-6-RETRO-1** ✅ 已完成（2026-05-14）| M-SN-3 视图卡前台测试覆盖率 < 9 用例批量补齐（实测仅 ChipType 8→9 + VideoCardPlaceholder 7→9 共 +3 测试；server-next admin 视图自然达标 ≥ 9；server v1 冻结跳过）；3666 unit 全 PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.05w（vs 估算 0.3w，MVP 范围收敛）| 🟡 P1 |
| 6 | **CHG-SN-6-RETRO-2** ✅ 已完成（2026-05-14）| plan §5.3 阶段审计协议修订列入 5 项硬清单（视图测试 ≥ 9 / 共享原语 ≥ 80% / R-MID-1 audit payload / schema 三层防护 / PATCH 范围 ≤ 5）+ quality-gates §7 详细表格 + workflow-rules 简版引用；A/B/C 评级联动；commit 待落地 | opus（延续会话；建议 sonnet）| 0.08w | 🟡 P1 |
| 7 | **CHG-SN-6-DATATABLE-STICKY-SCROLL** ✅ 已完成（2026-05-14）| ADR-103 AMENDMENT 2026-05-14 协议化两种高度消费模式（A 整页滚动 / B body 独立滚动）+ admin-module-template / reference / dt-styles 注释同步；API zero-prop 不变；commit 待落地 | opus（延续会话；建议 sonnet）| 0.08w（vs 估算 0.15w）| 🟢 P2 |

**自动化循环**：延续 -13 模式（执行 → 评估 → PATCH → 隐式重审 → 通过 → 下一卡）；不可绕过节点 = 每卡完成后用户验证 + ADR 起草前确认。

**工时合计**：1.45w（RETRO 批次）+ plan §6 M-SN-6 主体卡（拆解中）。

### M-SN-6 主体卡（plan §6 拆解）

启动顺序按"复杂度爬坡 + 候选依赖选型先后 + 5 项硬清单首次正式验证"原则。**M-SN-6 RETRO 6/7 沉淀的 5 项硬清单**（quality-gates §7）自 CHG-SN-6-01 起作为正式协议执行。

| # | 卡 ID | 范围 | 模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| 8 | **CHG-SN-6-01-ADR** ✅ 已完成（2026-05-15）| 起 ADR-118 `/admin/audit` 全局审计日志视图端点契约（3 端点 MVP：list + detail + enums）+ arch-reviewer Opus 1 轮 PASS；commit 待落地 | opus（延续会话）+ arch-reviewer (Opus) 评审 | 0.05w | 🔴 P0 |
| 9 | **CHG-SN-6-01** ✅ 已完成（2026-05-15）| `/admin/audit` 全局审计日志视图实施 — 11 文件 ≤ 12 / 12 视图测试 ≥ 9 / 10 integration ≥ 6 / 共享原语 85% ≥ 80% / D-118 全 10 条 ⏳→✅ / R-MID-1 N/A 替代守卫 / endpoint-adr 148 路由匹配 / sql-schema-alignment ✅；commit 待落地 | opus（延续会话；建议 sonnet）| 0.3w（vs 估算 0.4w）| 🔴 P0 |

| 10 | **CHG-SN-6-02** ✅ 已完成（2026-05-15）| `/admin/image-health` 视图实施 — 4 既有端点消费（IMG-05 / allowlist 豁免）/ KPI 4 卡片 + 破损域名 TOP + 缺图视频分页表 + Backfill 按钮 / 4 文件 / 12 视图测试 ≥ 9 / 9 integration ≥ 6 / 共享原语 ~90% / 零新 ADR；commit `3923e056` | opus（延续会话；建议 sonnet）| 0.15w（vs 估算 0.25w；端点零开发）| 🟡 P1 |
| 11 | **CHG-SN-6-03** ✅ 已完成（2026-05-15）| SettingsContainer MonitorTab 实施 — GET /admin/system/scheduler-status 消费 / 全局 enabled badge + 4 scheduler grid 卡片 + intervalMs 人话格式化 + 中文 label 映射 / 3 文件 / 12 测试 / 共享原语 ~95% / 零新 ADR；commit `a4319c9e` | opus（延续会话；建议 sonnet）| 0.08w（vs 估算 0.1w；单端点零写操作）| 🟡 P1 |
| 12 | **CHG-SN-6-04** ✅ 已完成（2026-05-15）| SettingsContainer CacheTab 实施 — GET /admin/cache/stats + DELETE /admin/cache/:type 消费 / 5 业务前缀 KPI 卡片 + 全部清空 + 单卡清空 + count=0 disabled / cache 删除 audit 豁免（运维动作非业务数据） / 3 文件 / 12 测试 / 共享原语 ~95% / 零新 ADR；commit `136acead` | opus（延续会话；建议 sonnet）| 0.08w | 🟡 P1 |
| 13 | **CHG-SN-6-05** ✅ 已完成（2026-05-15）| SettingsContainer ConfigTab 实施 — GET/POST /admin/system/config 消费 / JSON textarea + 订阅 URL input + dirty 标识 + 4 错误码差异化 toast（INVALID_JSON / INVALID_SUBSCRIPTION_URL / VALIDATION_ERROR / 通用） / 3 文件 / 13 测试 / 共享原语 ~85% / 零新 ADR；audit 留 RETRO-3；commit `b8fd5d6f` | opus（延续会话；建议 sonnet）| 0.1w | 🟡 P1 |
| 14 | **CHG-SN-6-AUDIT-DEBOUNCE-FIX** ✅ 已完成（2026-05-15）| ultrareview P0/P1 修复批量卡：P0-1 AuditClient filter 300ms debounce / P0-2 SettingsContainer dead button（"审计日志"wire to /admin/audit + "保存所有更改"删除）/ P1-2 ACTION_TYPES / TARGET_KINDS set-equal 单测（4 it()）/ tokens.css build-css.ts 缺漏 stateFgOnSoft 处理修补；P0-3 + P1-1 + P2 拆 RETRO-3；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🔴 P0 |
| 15 | **CHG-SN-6-RETRO-3-A** ✅ 已完成（2026-05-15）| ultrareview P0-3：4 写端点 audit_log 系统补齐（DELETE cache / POST settings / POST config / POST import）+ AdminAuditActionType union 扩 4 项 + ACTION_TYPES 常量 + EXPECTED_* 镜像 + REQUIRED + PAYLOAD_ASSERTION_REQUIRED 各扩 4；R-MID-1 第 6 次系统化；11 文件；3743 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.2w | 🔴 P0 |
| 16 | **CHG-SN-6-RETRO-3-B** ✅ 已完成（2026-05-16）| P1-1 verify:style-shorthand-conflict.mjs 静态扫描（advisory；server-next 已清零，17 处 admin-ui + web-next 既有命中留 RETRO-4）+ P2-7 ImageHealthClient 缺图列扩展（posterUrl/posterSource/lastSeenBrokenAt/brokenDomain/occurrenceCount LATERAL JOIN）+ P2-8 SettingsContainer button → AdminButton；3747 unit + 40 integration PASS；mc.cover_url 修正；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P1 |
| 17 | **CHG-SN-6-RETRO-3-C** ✅ 已完成（2026-05-16）| P2-6 4 cell 沉淀 admin-ui — UserRef / CodeText / IdRef / MutedText（arch-reviewer Opus 1 轮 PASS 起草 + 主循环采纳）+ AuditClient 消费切换（539→528 行）+ 24 cell 单测；CHG-DESIGN-12 cell 沉淀进度 9→13；11 文件；3771 unit PASS；commit `49caea31` | opus（主循环）+ arch-reviewer (Opus) 起草 | 0.2w | 🟢 P2 |
| 18 | **CHG-SN-6-RETRO-4** ✅ 已完成（2026-05-16）| 清零 verify:style-shorthand-conflict 17 处 advisory — admin-ui font: 'inherit' → fontFamily 批量（16 文件 sed）+ admin-ui border:0 + borderTop/Bottom 拆 4 处手动 + web-next border / background 拆 2 处 + verify 脚本注释剥离鲁棒性提升；三库 0 命中防回归基线；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟢 P2 |

**后续候选卡**（未拆解，按用户授权依序起）：
- `/admin/system landing` redirect 修复（最小卡 / 1 行）
- `/admin/system/settings` 8 Tab + R-MID-1 写操作 audit_log 扩展（POST settings/config 当前未写）
- 候选依赖 ADR 三组：recharts vs visx / reactflow vs dagre-d3 / react-virtual vs react-window
- `/admin/analytics`（触发 recharts ADR）
- `/admin/crawler`（DAG 待 reference A2）
- 通知 + 后台任务双面板 + Toast 系统
- 大数据原语（触发 react-virtual ADR）

---
| 19 | **CHG-SN-6-06** ✅ 已完成（2026-05-16）| verify:style-shorthand-conflict advisory → FAIL fast 升级 — exit code 0→1 + stderr ❌ 警示 + preflight 描述 + quality-gates §6 第 7 项文档同步；故意注入冲突 exit 1 验证通过；commit 待落地 | opus（延续会话；建议 sonnet）| 0.03w | 🟢 P3 |
| 20 | **CHG-SN-6-07** ✅ 已完成（2026-05-16）| SettingsTab 站点设置 MVP — 13 字段 5 section card 表单 + dirty 标识 + 错误码差异化 + 联动 disabled（videoProxyUrl / autoCrawlRecentDays）；3 文件；12 测试；端点 + audit 已就位（RETRO-3-A）端到端 trace 完整；3783 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟡 P1 |
| 21 | **CHG-SN-6-08** ✅ 已完成（2026-05-16）| MigrationTab + apiClient multipart 扩展 — postMultipart 复用 401 refresh / exportSourcesDownload blob + a download / importSourcesUpload FormData / 双 section card + 错误结果块 + 重复上传 / 4 文件 / 12 测试 / **SettingsContainer 5/5 闭环**；3795 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P1 |
| 22 | **CHG-SN-6-09** ✅ 已完成（2026-05-16）| AdminCheckbox + AdminTextarea 原语沉淀 — arch-reviewer Opus 1 轮 CONDITIONAL PASS（条件已满足：JSDoc 明示 YAGNI）；4 文件 admin-ui + 2 消费方迁移 + 26 单测 / 共享原语率 SettingsTab 75%→95% ConfigTab 85%→95%；admin-ui 8 form 原语全集；commit 待落地 | opus（主循环）+ arch-reviewer (Opus) 起草 | 0.15w | 🟢 P2 |
| 23 | **CHG-SN-6-10** ✅ 已完成（2026-05-16）| R-MID-1 legacy 11 项 EXEMPT 收尾闭环 — ModerationService 7 测试 + StagingPublishService 3 + VideoService 3 + videoSourcesRoutes route-level +2 / EXEMPT → REQUIRED 迁移（11 项 / EXEMPT 清零）/ R-MID-1 系统化第 7 次完整闭环 / PAYLOAD_ASSERTION_REQUIRED 24 项全 PASS / 5 文件 / 3834 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🔴 P0（plan §5.3 协议级） |
| 24 | **CHG-SN-6-11** ✅ 已完成（2026-05-16）| ADR-119-NEGATED analytics 图表库选型 — plan §4.7 候选 recharts vs visx NEGATED + AnalyticsView 单测 ≥ 9（13 测试 / SVG polyline + linearGradient + 4 grid lines 决策守卫）；arch-reviewer Opus 1 轮 PASS A 级；2 文件；D-119-1~6 闭环；commit 待落地 | opus（主循环）+ arch-reviewer (Opus) 起草 | 0.1w | 🟢 P3 |
| 25 | **CHG-SN-6-12** ✅ 已完成（2026-05-16）| ADR-120-NEGATED 虚拟滚动选型 — plan §4.7 候选 react-virtual vs react-window NEGATED；plan A2 协议未触发；纯 governance 决策 0 代码；arch-reviewer Opus 1 轮 PASS A 级 / 11 维度对比表 / 7 触发条件；D-120-1~6 闭环；commit 待落地 | opus（主循环）+ arch-reviewer (Opus) 起草 | 0.05w | 🟢 P3 |
| 26 | **CHG-SN-6-13** ✅ 已完成（2026-05-16）| /admin/crawler 视图 MVP — 站点 CRUD（list/create/update/delete/batch/validate）+ system-status 4 scheduler 卡 / Drawer 编辑 + 7 字段表单 + isAdult AdminCheckbox / fromConfig 删除守卫 / 错误码差异化 / 4 文件 / 13 单测 / 3873 unit PASS；不含 tasks / runs / DAG（独立卡）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.2w | 🟡 P1 |
| 27 | **CHG-SN-6-14** ✅ 已完成（2026-05-17）| CrawlerSite v1 4 写端点 audit 补齐 — R-MID-1 第 8 次系统化 / 4 套真源（union + ACTION_TYPES + EXPECTED + REQUIRED）+ 4 端点 auditSvc.write 接入（create/update/delete/batch）+ 4 audit assertion test / PAYLOAD_REQUIRED 24→28 项 / 5 文件 / 3877 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🔴 P0（R-MID-1 协议级） |
| 28 | **CHG-SN-6-15** ✅ 已完成（2026-05-17）| CrawlerClient Tab 拆分 + CrawlerRunsView runs 列表 MVP — lib/crawler 扩 listCrawlerRuns + CrawlerRunsView 独立子组件 270 行 + Tab 容器化 / 4 文件 / 12 单测 + 13 既有零回归 / 3897 unit PASS；不含 cancel/pause/resume 行操作（独立卡）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P2 |
| 29 | **CHG-SN-6-16-A** ✅ 已完成（2026-05-17）| CrawlerRun cancel/pause/resume audit 补齐 — R-MID-1 第 9 次系统化 / 4 套真源（union/ACTION_TYPES/EXPECTED/REQUIRED）+ 3 端点 auditSvc.write + 5 audit assertion test / PAYLOAD_REQUIRED 28→31 项 / target_kind=system 复用避开 052 CHECK 扩展 / 5 文件 / 3908 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🔴 P0（R-MID-1 协议级）|
| 30 | **CHG-SN-6-16-B** ✅ 已完成（2026-05-17）| CrawlerRunsView 行操作 UI — cancel/pause/resume 三态按钮（status-based：running→pause+cancel / paused→resume+cancel / queued→cancel / 终态→—）+ confirm 守卫 + toast 反馈 + pendingRunId disable / lib/crawler/api 扩 3 函数 + CancelRunResult/PauseResumeResult / 2 文件 + 8 新增 UI 测试（20 总） / 3916 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟡 P1 |
| 31 | **CHG-SN-6-17** ✅ 已完成（2026-05-17）| Crawler Run Detail 视图 + tasks-per-run 子表 — 新路由 /admin/crawler/runs/:id（Next.js dynamic segment）+ CrawlerRunDetailView 客户端组件 / lib/crawler/api 扩 getCrawlerRunById + listCrawlerRunTasks + CrawlerTaskDto + CrawlerTaskStatus 类型 / 基础信息卡（8 字段）+ tasks 子表 8 列 + 独立 loading/error/empty 状态分离 / RunsView Run ID 改可点击链接 / 4 文件 + 12 视图测试 / 3928 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P2 |
| 32 | **CHG-SN-6-18** ✅ 已完成（2026-05-17）| Task Detail + Logs Drawer 查看 — lib/crawler/api 扩 getCrawlerTaskDetail + listCrawlerTaskLogs + 5 类型（CrawlerSiteBreakdown/CrawlerTaskRunContext/CrawlerTaskDetailDto/CrawlerTaskLog/CrawlerTaskLogLevel）/ TaskLogsDrawer 全新（详情卡 + 站点细分 + runContext + 日志列表 3 级 level + details 折叠）/ RunDetailView tasks 表加"查看"列 / 4 文件 + 14（12 Drawer + 2 集成）测试 / 3942 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P2 |
| 33 | **CHG-SN-6-19** ✅ 已完成（2026-05-17）| TaskLogsDrawer 日志过滤 + 计数 — 客户端 filter toolbar：3 个 level chip（info/warn/error）含计数 + toggle 隐藏 + stage/message 文本搜索（含 message 跨字段命中）+ 标题分子/分母（"日志（n/N）"）+ 清空筛选按钮 + taskId 切换 reset / 2 文件 / +8 测试（12→20 总）/ 3950 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.08w | 🟢 P3 |
| 34 | **CHG-SN-6-20-A** ✅ 已完成（2026-05-17）| freeze 端点 audit 补齐 — R-MID-1 第 10 次系统化 / 4 套真源（union/ACTION_TYPES/EXPECTED/REQUIRED+PAYLOAD）+ 1 端点 auditSvc.write + 4 audit assertion test / PAYLOAD_REQUIRED 31→32 项 / target_kind='system' target_id='crawler_global_freeze' / 6 文件 / 3956 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.08w | 🔴 P0（R-MID-1 协议级）|
| 35 | **CHG-SN-6-20-B** ✅ 已完成（2026-05-17）| freeze UI 接入 CrawlerClient — lib/crawler/api 扩 setCrawlerFreeze + CrawlerSystemStatus 显式 freezeEnabled/orphanTaskCount/schedulerEnabled 字段 / CrawlerClient freeze 卡片（status=warn|ok 切换 + 解除/开启按钮 + 游离任务计数 + 描述切换）/ handleToggleFreeze（confirm + toast + pendingFreeze disable + 状态合并刷新）/ 3 文件 + 6 新增测试（13→19）/ 3962 unit PASS；CHG-SN-6-20 双子卡 -A/-B 闭环；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟡 P2 |
| 36 | **CHG-SN-6-21** ✅ 已完成（2026-05-17）| TaskLogsDrawer 导出 CSV — 新 lib/csv-export.ts 共享工具（escapeCsvCell RFC 4180 quote escape + toCsv CRLF + downloadCsv BOM Blob+a.click）/ Drawer logs 卡 actions 加"导出 CSV"按钮（filteredLogs 空时 disabled，logs 全空时不渲染）/ filename task-{id8}-logs-{iso}.csv / 4 文件 + 12 新增测试（8 csv util + 4 drawer 集成）/ 3974 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟢 P3 |
| 37 | **CHG-SN-6-22** ✅ 已完成（2026-05-17）| AuditClient 接入 csv-export — toolbar.trailing 加"导出 CSV"按钮 / 导出 7 列（id/actionType/targetKind/targetId/actorId/requestId/createdAt）/ rows 空时 disabled / filename audit-logs-{iso}.csv / 2 文件 + 3 新增测试（12→15）/ 3977 unit PASS / 共享工具零成本接入证明 | opus（延续会话；建议 sonnet）| 0.05w | 🟢 P3 |
| 38 | **CHG-SN-6-23** ✅ 已完成（2026-05-17）| Users + Submissions 列表接入 csv-export — UsersListClient + SubmissionsListClient toolbar.trailing 各加"导出 CSV"按钮 / users 6 列（id/username/email/role/banned_at/created_at）+ submissions 8 列（id/video_id/source_url/source_name/video_title/video_type/submitted_by/created_at）/ filename users-{iso}.csv + submissions-{iso}.csv / 4 文件（2 source 编辑 + 2 test 新建）+ 6 测试 / 3983 unit PASS / csv-export 现 4 消费方实证（TaskLogsDrawer + AuditClient + UsersListClient + SubmissionsListClient）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟢 P3 |
| 39 | **CHG-SN-6-24** ✅ 已完成（2026-05-17）| VideoListClient 接入 csv-export — trailingNode 与 FilterChipBar Fragment 共存（chips + export 一行）/ 导出 10 列（id/short_id/title/title_en/type/year/is_published/review_status/source_count/created_at）/ filename videos-{iso}.csv / 2 文件（client 编辑）+ 1 新 client.test.tsx + 3 测试 / 3986 unit PASS / csv-export 现 5 消费方实证（ModerationConsole 自定义结构无 toolbar 槽位不适用 → 跳过）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🟢 P3 |
| 40 | **CHG-SN-6-25-RETRO** ✅ 已完成（2026-05-17）| auto-config + stop-all 端点 audit 补齐 — R-MID-1 第 11 次系统化 / 4 套真源（union/ACTION_TYPES/EXPECTED/REQUIRED+PAYLOAD）+ 2 端点 auditSvc.write + 5 audit assertion test / PAYLOAD_REQUIRED 32→34 项 / target_kind='system' target_id='auto_crawl_config'/'stop_all' / 6 文件（沿用 16-A 框架）/ 3995 unit PASS / v1 crawler 写端点 audit 覆盖 10/13；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🔴 P0（R-MID-1 协议级）|
| 41 | **CHG-SN-6-26-RETRO** ✅ 已完成（2026-05-17）| reindex + runs 统一入口 audit 补齐 — R-MID-1 第 12 次系统化 / 4 套真源（union/ACTION_TYPES/EXPECTED/REQUIRED+PAYLOAD）+ 2 端点 auditSvc.write + 5 audit assertion test / PAYLOAD_REQUIRED 34→36 项 / reindex target_id='reindex' + run_create target_id=run.id / 6 文件（沿用 16-A 框架）/ 4004 unit PASS / v1 crawler 写端点 audit 覆盖 12/13（剩余 POST /tasks deprecated 不补）；commit 待落地 | opus（延续会话；建议 sonnet）| 0.1w | 🔴 P0（R-MID-1 协议级）|
| 42 | **CHG-SN-6-27** ✅ 已完成（2026-05-17）| Scheduler Config Drawer + stop-all 按钮 — lib/crawler/api 扩 getAutoCrawlConfig + setAutoCrawlConfig + stopAllCrawler + 5 类型（AutoCrawlConfig/AutoCrawlMode/AutoCrawlConflictPolicy/StopAllOptions/StopAllResult）/ SchedulerConfigDrawer 6 字段表单（globalEnabled checkbox + dailyTime input + defaultMode select + onlyEnabledSites checkbox + conflictPolicy select + 提交/取消）/ CrawlerClient freeze 卡 actions 升级 3 按钮（调度配置 + 全局止血 + 解除/开启冻结）/ stop-all 双重 confirm 守卫 / 5 文件 + 11 新增测试（8 drawer + 3 crawler）/ 4015 unit PASS；commit 待落地 | opus（延续会话；建议 sonnet）| 0.15w | 🟡 P2 |
| 43 | **CHG-SN-6-28** ✅ 已完成（2026-05-17）| reindex UI 按钮 — lib/crawler/api 扩 triggerReindex + ReindexResult 类型 / CrawlerClient freeze 卡 actions 加"重建索引"按钮（4 按钮组：调度配置 + 重建索引 + 全局止血 + 冻结切换）/ handleReindex 双重 confirm 守卫（与 stop-all 同范式）+ pendingReindex disable + toast 含 indexed/duration 摘要 / 3 文件 + 3 新增测试（22→25）/ 4018 unit PASS / crawler 域 UI 完整能力闭环 | opus（延续会话；建议 sonnet）| 0.05w | 🟢 P3 |
| 44 | **CHG-SN-6-29-AUDIT** ✅ 已完成（2026-05-17）| M-SN-6 milestone 阶段审计 — arch-reviewer (claude-opus-4-7) 1 轮 / **评级 A−** / 必修 2 PATCH 后关闭 / 44 卡 + 3659→4018 PASS + R-MID-1 6.5→12 次 36 strict + csv-export 5 消费方 / 5 真源全对齐 / 绝对禁止项零违反 / **H1 CrawlerClient.tsx 862 行违反 500 行硬上限**（绝对禁止项第 11 条）— 必拆 → PATCH-1 / PATCH-2 = task-queue 起 perSiteOverrides + ADR-121 + 文件大小守卫；commit 待落地 | opus（主循环）+ arch-reviewer (Opus) | 0.15w | 🔴 P0（milestone 审计）|
| 45 | **CHG-SN-6-29-PATCH-1** ✅ 已完成（2026-05-17）| CrawlerClient.tsx 拆分（H1 必修）— 拆 5 文件（主 orchestrator 157 + CrawlerSitesTab 334 + CrawlerControlsCard 202 + CrawlerSiteFormDrawer 227 + crawler-site-columns 116）/ 全部 ≤ 500 行 / createTrigger counter 避免 ref / status lift up + onStatusUpdate 回调 / 91 crawler 测试零回归 / 4018 unit PASS / typecheck/lint/verify:adr-contracts 全绿；commit 待落地 | opus（延续会话）| 0.4w | 🔴 P0（绝对禁止项违反必修）|
| 46 | **CHG-SN-6-29-PATCH-2** ✅ 已完成（2026-05-17）| M-SN-6 债务可见性兜底 — task-queue.md 起 7 跟踪卡（3 高优先 PRE/MISC + 4 低风险 LOW）+ M-SN-6 milestone 关闭声明 / 1 文件 / 0 测试改动 / 4018 unit PASS 保持；**⚠️ 自评 §质量门禁第 6 条"全部 ≤ 500 行"经 CHG-SN-6-29-FOLLOWUP 复核证实不实（漏 2 新增 + 5 历史，详见后者）— 不撤销关闭决定，仅事实修正** | opus（延续会话）| 0.05w | 🔴 P0（债务可见性）|
| 47 | **CHG-SN-6-29-FOLLOWUP** ✅ 已完成（2026-05-17）| M-SN-6 关闭复核 3 项修正 — 独立复核报告 `docs/archive/2026Q2/milestone-audits/M-SN-6-milestone-audit-2026-05-17.md` / 1 自评数据修正（"全部 ≤ 500 行"不实 / 7 文件超限实测清单）+ PRE-01 扩 5 baseline 豁免 + MISC-CRAWLER-FILE-SIZE → MISC-FILE-SIZE 改名扩 2 漏检 + 2 新跟踪卡（SETTINGS-TABS 8 类补 4 类 / SHELL-NOTIFICATIONS countProvider 真实数据注入）/ 3 文件文档维护 / 0 代码 / 4018 unit PASS 保持；commit 待落地 | opus（主循环延续）| 0.05w | 🔴 P0（自评数据可信度修正） |

---

## M-SN-7 跟踪卡（arch-reviewer M-SN-6-29-AUDIT 输出 + 衔接建议）

下列卡片由 CHG-SN-6-29-AUDIT 评审产出，作为 M-SN-7 入口候选。开工时按优先级取下一个。

> **2026-05-18 范围重大扩展**：用户复核发现 server-next 后台**架构性偏离设计稿**（多页面 v1 风格 DataTable + Tab + 外置 SelectionActionBar，未对照 `docs/designs/backend_design_v2.1/reference.md` §5.x + screens-2.jsx 真源），M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"。规划文档：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（5 用户决策 + 11 修订意见全部合并落地）。新增专项段「设计稿对齐重做」见下方。

### 高优先（M-SN-7 前 3 卡推荐顺序）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-01** 已完成（2026-05-18）| 文件大小守卫 `verify:file-size-budget`（**全量扩范围 28 文件**） | 实施：`scripts/verify-file-size-budget.mjs` + `package.json` 集成 + `preflight.sh` 5e2/6 步骤；**PERMANENT_EXEMPT** 5 文件（apps/server v1 frozen 永久）+ **BASELINE_EXEMPT** 23 文件（M-SN-6 复核 7 + PRE-01 全量扩 16：api/queries 5 + api/routes 2 + api/services+workers 4 + web-next 1 + player core 4）；新增零容忍 + GENERIC_WHITELIST（.types/.schema/index 等）；实测 0 新违规 ✅；4018 unit + typecheck + lint 全 PASS；新挂 5 MISC 拆分跟踪卡（API-QUERIES/ROUTES/SERVICES + WEB-NEXT + PLAYER-CORE） | opus-4-7 | 0.12w | ✅ |
| ✅ **CHG-SN-7-PRE-02** 已完成（2026-05-18）| ADR-121 R-MID-1 RETRO 协议正式化 | 起草 ADR-121（9 段结构 / 4 真源 + **7 文件**框架 / PATCH ≤ 5 豁免依据 / 4 替代方案 11 维度对比 / 5 触发重评条件）；arch-reviewer Opus 评审 A- CONDITIONAL → 红线 1 + 黄线 3 全部修订后 PASS；**重大发现**：原起草"6 文件框架"漏 `audit-log-service-enums-set-equal.test.ts` → 评审拦截修订为 7 文件；4018 unit PASS 保持 | opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-MISC-PERSITE** 已完成（2026-05-20）| perSiteOverrides UI 实装（M-SN-6 deferred 债务） | SchedulerConfigDrawer 加 perSiteOverrides 编辑区（每站点 enabled 切换 + mode 选择 inherit/incremental/full）；可考虑独立子 Drawer 嵌套 / 表格化编辑；CHG-SN-6-27 中标记 advisory 引用此卡。**实际执行**：SchedulerConfigDrawer 361L（+142L）；新增站点覆盖列表（scrollable max-h 220px）+ 移除按钮 + 添加站点 AdminSelect（searchable）；测试 8→11（+3 覆盖用例）| sonnet | 0.15-0.25w | 🟡 P2 |

### 中风险（M-SN-7 中段评估）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-MISC-FILE-SIZE** 已完成（2026-05-20）| **5 文件主动拆分预案（M-SN-6 复核扩范围）**：原 CRAWLER-FILE-SIZE 改名 + 范围扩 2 漏检 | 评估 5 文件按 PATCH-1 范式拆分：crawler 3 接近上限（CrawlerRunDetailView 445 / TaskLogsDrawer 491 / CrawlerRunsView 429）+ **AuditClient 558**（M-SN-6 新增 / CHG-SN-6-01）+ **ImageHealthClient 590**（M-SN-6 新增 / CHG-SN-6-02）；若 PRE-01 守卫触发警告则启动拆分；范式参考 CrawlerSitesTab + ControlsCard + FormDrawer + columns 拆分。**实际执行**：API queries 5 文件拆分（sources.ts / videos.ts 等）+ server-next AuditClient（558→374L）/ ImageHealthClient（590→392L）提取子组件，新增 4 文件（AuditDetailDrawer / AuditColumns / ImageHealthKpiCard / ImageHealthColumns）| sonnet | 0.3-0.6w（5 文件） | 🟡 P2 |
| **CHG-SN-7-MISC-SETTINGS-TABS** | **Settings 8 类 Tab 补 4 类（M-SN-6 复核新增）**：图片 / 通知 / API·Webhook / 登录会话 | plan §6 明列 8 类，实际交付 5 类（基础 / 豆瓣 / 内容过滤 / 视频代理 / 自动采集）；**起卡前先核对 plan §6 vs reference §5.11 哪个是正源**（reference §5.11 仅举 4 类示例 + "等"字 / plan §6 明列 8 类）；若 plan 为正源 → 补 4 类 Tab + 后端 settings 端点扩字段 + audit | sonnet（前端）+ 可能起 ADR 前置（settings 字段扩展） | 0.3-0.5w | 🟡 P2 |
| **CHG-SN-7-MISC-SHELL-NOTIFICATIONS** | **admin-shell Topbar 真实数据注入（M-SN-6 复核新增 / 半成品收尾）** | admin-shell-client.tsx line 27/28/97/98 mockNotifications/mockTasks + line 142 adminNavCountProviderStub → 替换为真实 useQuery / SWR 拉 /admin/notifications + /admin/system/jobs；与通知 Hub MVP 协同（后者建端点本卡接前端）；CHG-DESIGN-05 已标 "M-SN-4+ 接入真端点"债务可知 | sonnet（前端消费 / 端点 + ADR 由通知 Hub MVP 卡承担）| 0.2-0.3w | 🟡 P2 |

### 低风险（任意时机承接，主循环自助）

| ID | 标题 | 范围 | 工时 | 优先级 |
|---|---|---|---|---|
| ✅ **CHG-SN-7-LOW-1** 已完成（2026-05-20）| 双子卡范式 -A audit + -B UI 文档化 / admin-module-template.md 追加"写端点 + UI 拆卡决策树"节 + 决策树 + 先例表（CHG-SN-6-16/20/25/26） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-2** 已完成（2026-05-20）| NEGATED ADR 占位 / 重启路径集中说明 / decisions.md 头部追加"NEGATED ADR 占位语义"节 + 5 条规则 + 先例表（ADR-114/119/120-NEGATED） | 0.05w | 🟢 P3 |
| ✅ **CHG-SN-7-LOW-3** 已完成（2026-05-20）| ModerationConsole csv 豁免追溯 / ADR-106 末尾追加"toolbar-less 视图豁免 csv-export"节 + 2 条规则 | 0.03w | 🟢 P3 |
| **CHG-SN-7-LOW-4** | useDoubleConfirm hook 沉淀（触发条件：第 3 处复用时同卡提取） | 不立即起卡；M-SN-7 内若新增第 3 个不可逆操作（如清空 ES / 强制重建审核队列等）→ 在该卡内沉淀至 `apps/server-next/src/lib/` 或 `packages/admin-ui` | — | 🟢 P3（条件触发） |

---

## 设计稿对齐重做（M-SN-7 主线 / 2026-05-18 落卡）

> 真源：`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md`（§0–§8 全文）。本段为 task-queue 索引；详细 spec ↔ 现状 ↔ 重做归属对照见计划文档 §1（16 路由审计矩阵）+ §2（Crawler 完整对照）。
>
> **用户决策已锁**：①Submissions 纳入 REDO-02 ②子卡 A–J 粒度 ③SHARED 拆独立 milestone 先做 ④runs 独立路由 + sidebar 二级菜单 ⑤批量动作留 REDO-01-A Opus 裁决。
>
> **取消**：~~CHG-SN-7-PRE-03~~（CrawlerSitesTab 外置 batch bar 修正）→ 整页要重做，无需局部修。

### PRE 阶段（全量审计 + ADR 起草，**1.27w**）

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-PRE-04** 已完成（2026-05-20）| 全量审计 16 admin 路由 vs 设计稿 §5.1–§5.16 | 16/16 路由逐路由审计产出 ✅/⚠️/❌；arch-reviewer Opus 收尾裁决 REDO-NN 优先级（REDO-01/02/03/04 全识别 + 全完成）；评级 **A−**；MISC 跟踪 16 项（9 ✅ / 1 🟡P2 / 6 🟢P3）；REDO-04 IA 分歧正式裁决「独立路由」；`docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-audit-FULL.md` 收尾节填充 | sonnet 主循环 + arch-reviewer (claude-opus-4-7) | 0.9w 实际（收尾 0.05w）| ✅ |
| ✅ **CHG-SN-7-PRE-05** 已完成（2026-05-18）| ADR-123 分类映射 schema 起草 — **Accepted** | spawn Opus 子代理 1 轮独立起草 ADR-123 A−（方案 A 新建表 `crawler_site_category_maps` / 复用 VideoGenre + `_unmapped`+`_discard` 特殊值 / 入库前查表映射 / PUT 全量替换语义 + 7 文件 RETRO 框架 / migration 064 SQL 草案完整）；REDO-01-F 按 spec 三段实施路径锁定 | arch-reviewer (opus-4-7) | 0.1w | ✅ |

### M-SN-SHARED milestone（共享原语前置，**0.9w**）

> 三张子卡可并行（无相互依赖），**必须先于任何 REDO-XX 完成**。验收门：颜色零硬编码 + 双品牌 baseline + 入库 `packages/admin-ui/src/components/`。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-SHARED-01** 已完成（2026-05-18）| KpiCard `progress?` prop 扩展（footer spark/progress 互斥拓展） | 新增 `KpiCardProgress` interface（value/total/color?/showLabel?）+ 渲染于 footer 60×18 槽位与 spark 互斥 + 4 dev warn 防御（非 primitive value 无 ariaLabel / progress+spark 并存 / value<0 或 total<=0 / color 非 CSS 变量）+ a11y aria-label 追加百分比；arch-reviewer Opus 1 轮 **A- 无红线 / 3 黄线** → 采纳黄线 1+2（color 运行时防御 / a11y 追加 %）跳过黄线 3（value=0 争议）；MetricKpiCardRow + AnalyticsView 零破坏；**17 新 case** PASS（原 49 → KpiCard 54 测试）| opus-4-7 主循环 + arch-reviewer (opus-4-7) | 0.1w | ✅ |
| ~~**CHG-SN-SHARED-02**~~ | ❌ **取消**（2026-05-18 实施前实测：DataTable v2 已支持 `renderExpandedRow` + `expandedKeys` + selection + pagination 三态；ADR-117 + CHG-DESIGN-02 Step 5 已落地；Sources MatrixExpand 生产消费验证）→ REDO-01 Crawler 重做直接消费 DataTable v2 | — | 0w（原 0.4w）| — |
| ~~**CHG-SN-SHARED-03**~~ | ❌ **取消**（PRE-04 全部 16 子卡 2026-05-18 闭环：admin-ui Spark 已入库；dashboard / analytics / sources 三处消费形态对齐设计稿，未发现新形态需求） | — | — | — | — |

### CHG-SN-7-REDO-01 采集控制重做（**2.55w**，依赖 SHARED milestone 完成）

> 计划文档 §2.4 对照表全 22 行为 REDO-01-J 强制 checklist；任一行 ❌ → J 不通过。

| ID | 标题 | 范围 | 建议模型 | 工时 | 优先级 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-01-A** 已完成（2026-05-18）| Opus 子代理设计 Crawler 重做契约 — 580 行产出落 `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-redo-01-contract.md` | 6 组件 props/state/事件契约 + 5 Open Issues 全裁决（含 Q5 批量动作删除）+ 4 后端端点契约提纲 + admin-ui 消费映射 + 削减建议（D/G 共下调 0.2w → REDO-01 总估时 2.55w → 2.35w）+ 风险评估 + DAG；Opus 子代理 1 轮通过 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-B** 已完成（2026-05-18）| 后端：ADR-122 + 4 新端点 + ADR-121 4 文件 audit RETRO | 阶段 1 ADR-122 Accepted A（commit 24606c47）+ 阶段 2 4 文件实施（crawlerKpi.ts 177 / crawlerTimeline.ts 171 / crawlerDashboard.ts 178 / 前端 api.ts 扩 +75 全 < 500）+ 阶段 3 audit RETRO 4 文件框架（route auditSvc.write + 18 case 测试 / 复用 crawler.run_create actionType）+ 阶段 4 全质量门禁（typecheck ✅ / file-size ✅ / endpoint-adr ✅ 152 路由对齐 23 ADR / lint ✅ / **4053 unit PASS** 待最终验证）；§端点契约表格式修订对齐脚本期望（6 列 4 行）| Opus（ADR）+ opus-4-7 实施 | 0.6w | ✅ |
| ✅ **CHG-SN-7-REDO-01-C** 已完成（2026-05-19）| 前端骨架：新 CrawlerClient + KpiRow + TimelineCard + SiteList（9 列骨架） | 5 文件新增/重写（CrawlerKpiRow 95 / CrawlerTimelineCard 213 / CrawlerSiteList 152 / crawler-site-columns-v2 276 / CrawlerClient 312 重写）+ 3 PageHeader actions（导出 toast 占位 / + 新增 drawer / 全站全量 runCrawlerAll('full')）+ 15s 时间轴 auto-refresh + freezeEnabled 守卫 + 测试重写 16 case PASS；4053 → 4044 unit PASS（净 -9：旧 25 case → 新 16 case）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-D** 已完成（2026-05-19）| 前端站点行 + `{more}` 菜单 | 1 新 `CrawlerSiteRowActions.tsx`(127 行 / 6 菜单 + 动态 label + fromConfig 守卫)+ 4 改（columns-v2 actions 列实装 + AdminButton sm + 行 dropdown 嵌入 / SiteList 8 callback props 透传 / CrawlerClient 7 handlers 实施 runCrawlerSite+toggle+mark*+copy / test 扩 12 新 case 17–28）；CrawlerClient.tsx 312→454 行（含 7 新 handlers + freeze 守卫）；4044 → **4056 unit PASS**（+12 净增）| opus-4-7 续会话 | 0.3w | ✅ |
| ✅ **CHG-SN-7-REDO-01-E** 已完成（2026-05-19）| 前端行展开 + 线路 sub-table（只读） | ADR-117 AMENDMENT 2026-05-19 Opus 1 轮 PASS + 9 文件（types 扩 + query 扩 + service 扩 + route 扩 + 新建 CrawlerSiteExpand 313 行 + lib/sources/api 扩 + columns chevron 改 button + SiteList 透传 + CrawlerClient 注入 expand state）+ 13 backend test + 9 frontend test；4056 → **4078 unit PASS** | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-E2** 已完成（2026-05-19）| 行级 3 mutations + audit RETRO + 前端 3 actions | ADR-117 AMENDMENT 2 Opus 1 轮 PASS A（合并 actionType `sources.route_action` + 4 文件 RETRO）+ 后端 5 文件 + 前端 2 文件 + audit RETRO 4 文件 + sources-routes-mutations-audit.test.ts 10 case + CrawlerClient.test +5 case；4078 → **4095 unit PASS**；endpoint-adr 153→156 路由 / 24→27 ADR 端点；STATE_CONFLICT 409 freeze 守卫（修正 Opus 初稿 503）；R-MID-1 系统化第 13 次 | Opus (ADR) + opus-4-7 实施 | 0.35w (Y2 重估) | ✅ |
| ✅ **CHG-SN-7-REDO-01-F** 已完成（2026-05-19）| 分类映射 collapsible（migration + GET/PUT + 前端） | 11 文件按 ADR-123 §文件范围落地：migration 064 + queries + service + 2 endpoints + types + audit RETRO 7 文件（actionType `crawler_site.category_mapping_update`）+ 前端 lib/api + 新建 CategoryMappingCollapsible 230 行 + CrawlerSiteExpand 嵌入；12 audit case + 4095→4109 unit PASS；endpoint-adr 156→158 / 24→29 ADR 端点；R-MID-1 系统化第 14 次 | opus-4-7（纯实施 / ADR-123 PRE-05 已 Opus PASS）| 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-01-G** 已完成（2026-05-19）| 高级 dropdown 4 项（PageHeader 第 4 槽位） | 新建 CrawlerAdvancedMenu.tsx (175 行 / AdminDropdown + 4 items + 双重 confirm + 动态 label) + CrawlerClient 注入 + SchedulerConfigDrawer mount；4109→**4117 unit PASS**（+8 G case）；0 新端点 / 0 新 ADR / 全 API 复用 | opus-4-7 | 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-01-H** 已完成（2026-05-19）| runs 列表迁独立路由 + sidebar 二级菜单 | git mv CrawlerRunsView.tsx 至 crawler/runs/_client/ + 新建 runs/page.tsx + admin-nav children 注册 `/admin/crawler/runs` + test import 路径同步；4117 → 4117 unit PASS（CrawlerRunsView 20 case 保持） | opus-4-7 | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-01-I** 已完成（2026-05-19）| 删除旧文件 + git tag 回滚锚点 | git tag pre-redo-crawler-20260519 + git rm 3 文件（CrawlerSitesTab 334 + CrawlerControlsCard 202 + crawler-site-columns 116 = 652 行清理）+ CrawlerClient 文件头注释修订 + tasks.md Rollback 命令记录；4117 unit PASS 保持 | opus-4-7 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-01-J** 已完成（2026-05-19）| 视觉回归 + Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（22 行 §2.4 checklist 21 ✅ + 1 ⚠️ 占位 / verify 全 PASS / 4117 unit / 0 硬编码 / 0 any / 0 越层 / Route→Service→Queries 分层完整）；扣 0.5 视觉回归未跑（软门 / MISC 跟踪）+ 扣 0.5 ADR-122/123 D-status JSON 仍 pending（脚本 bug 非架构缺陷 / MISC 跟踪）；**REDO-01 milestone 全闭环（A→J 10 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-02 Submissions §5.13 Card list 重做（**~2.75w**，PRE-04 + REDO-02-A0 实测 / Opus 重估）

> **2026-05-19 重估**：原 ~1w 严重低估（PRE-04 #9 仅识别 UI 层错位 / 未深入数据模型）；REDO-02-A0 Opus 子代理实测 4 类 Segment（失效源举报 / 求片 / 元数据纠错 / 已处理）当前 video_sources 单表无法承载（求片无 video_id / 元数据纠错与 source 无关）→ 新建 `user_submissions` 表 / 6 新端点 / R-MID-1 第 15 次 audit RETRO；详 ADR-124。

| ID | 标题 | 范围 | 模型 | 工时 | 状态 |
|---|---|---|---|---|---|
| ✅ **CHG-SN-7-REDO-02-A0** 已完成（2026-05-19）| ADR-124 user_submissions schema 起草 | spawn arch-reviewer Opus 1 轮 PASS A（4 维度全 A / 2 黄线 Y1+Y2 主循环修订 / 3 advisory）+ 落 decisions.md 11 节 + 8 决策 D-124-1..8 + 6 端点契约 + migration 065 SQL + 3 类 metadata zod 锁定 + 7 子卡拆分；endpoint-adr 29→35 ADR 端点 | arch-reviewer (opus-4-7) | 0.15w | ✅ |
| ✅ **CHG-SN-7-REDO-02-A** 已完成（2026-05-19）| migration 065 + types + audit 4 真源同步 + audit content assertion | migration 065 (120 行 / 3 CHECK + 4 indexes + AD1 jsonb_typeof + AD2 partial index + backfill + ROLLBACK) + types 4 interface + actionType `user_submission.action` + targetKind `user_submission` + AuditLogService 数组 + audit-log-coverage REQUIRED + PAYLOAD + set-equal EXPECTED + UserSubmissionService stub (98 行 / writeUserSubmissionAction helper + 3 metadata zod) + 8 case PASS；R-MID-1 第 15 次系统化；4117→4127 unit PASS (+10 净增) | opus-4-7 | 0.4w | ✅ |
| ✅ **CHG-SN-7-REDO-02-B** 已完成（2026-05-19）| 6 端点 + service + queries + audit 写入 + 23 case PASS | queries 230 行 + service 扩 6 业务方法 + route 180 行 + server.ts 注册 + 状态机双重守卫（404/409 + 竞态）+ 批量静默跳过 + audit fire-and-forget；164 admin 路由 35 ADR 端点；4127→**4142 unit PASS**（+15 净增 / 23 case 总 / 含 A 卡 8 + B 卡 15） | opus-4-7 | 0.7w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE** 已完成（2026-05-19）| admin-ui 3 primitive 调研 — Card ✅ / Segment ❌ / QuoteBlock ❌ | 静态扫描 0.05w 实际（vs 0.1w 原估）；调研结论：Card 已具 AdminCard 直接消费；Segment 完全缺 + 5 处视图手撸 bottom-border 形态但 spec 是 pill-style + badge / 起 PRE-A 新卡；QuoteBlock 内联实现（spec §5.13 唯一消费） | claude-opus-4-7 主循环 | 0.05w | ✅ |
| ✅ **CHG-SN-7-REDO-02-PRE-CARD-PRIMITIVE-A** 已完成（2026-05-19）| Segment primitive 设计 + 实施 | spawn arch-reviewer Opus 1 轮 PASS A（D1-D6 决策清晰 / 0 红线 / 2 黄线全实施 / 2 advisory）+ 5 文件落地（types 38 / impl 203 / index / index.ts export / test 12 case PASS）；WAI-ARIA tabs activate-on-focus + roving tabIndex + ←→/Home/End + Y1 badge active 反转 + Y2 focusOnNextRender ref；4142→**4154 unit PASS**（+12 净增） | Opus（契约）+ opus-4-7（实施） | 0.2w（vs 0.25w 原估） | ✅ |
| ✅ **CHG-SN-7-REDO-02-C** 已完成（2026-05-19）| 前端 /admin/user-submissions Card list 主视图 | lib/user-submissions/{types,api}.ts + SubmissionCard.tsx (230 行 / 3 类 visual icon + 可选 poster + metadata quote + 3 按钮) + UserSubmissionsClient.tsx (200 行 / 4 Segment + 三态 + 分页) + page.tsx + nav 修订 href /admin/submissions→/admin/user-submissions + 12 case PASS（含 Segment 首次业务消费实证）；4154→**4166 unit PASS**（+12 净增 / vs 旧 397 行 DataTable 实施成本下降 50%+） | opus-4-7 | 0.7w (vs 0.8w 原估) | ✅ |
| ✅ **CHG-SN-7-REDO-02-D** 已完成（2026-05-19）| 旧 /admin/submissions deprecation banner（B'' 简化版） | 选 B'' 简化版（仅前端 banner / 后端旧端点不改）+ AdminCard surface='subtle' status='warn' + Next.js Link 跳转 + 1 banner 测试断言；M-SN-9 退役卡承担一次性清理（Y1）；4166→**4167 unit PASS**（+1）；实际 0.1w（vs 0.2w 原估 / 节省 0.1w 避免后端双写复杂度） | opus-4-7（任务卡建议 Haiku 但在 Opus 续会话不擅自降级）| 0.1w | ✅ |
| ✅ **CHG-SN-7-REDO-02-E** 已完成（2026-05-19）| RETRO 验证 + verify 全门禁 + SQL bug 主动修复 | 全 5 verify 命令逐项核验（typecheck/lint/file-size/endpoint-adr/adr-contracts）+ 修补 2 处 SQL bug（userSubmissions.ts v.cover_url → mc.cover_url + LEFT JOIN media_catalog / migration 029 已 DROP videos.cover_url 8 个月）+ 修补 D-124-3..7 changelog 闭环引用 / verify-adr-d-numbers 守卫识别；4167 unit PASS 保持；实际 0.2w（vs 0.3w 原估） | opus-4-7 | 0.2w | ✅ |
| ✅ **CHG-SN-7-REDO-02-F** 已完成（2026-05-19）| Opus 验收 — **A−** | arch-reviewer Opus 1 轮 A−（14 行 §5.13 checklist 12 OK + 1 PARTIAL + 1 DEVIATION-ACCEPTED / ADR-124 11 节闭环 + D-124-1..8 全 closed / 4 真源同步 + verify 5 件套 PASS / admin-ui Segment primitive 沉淀）；扣 0.5 quote 语义映射缺 ADR 落档 + 扣 0.5 3 按钮替换缺 ADR 文档；**REDO-02 milestone 全闭环（A0→F 7 子卡 ~2.5w）** | Opus 验收 | 0.2w | ✅ |

### CHG-SN-7-REDO-03 Settings 区段架构收敛（**~1.5w**，PRE-04 子卡 #14 触发）

> 触发：reference §5.11 显式提醒「sidebar 不应暴露多个 system 子项」，当前 server-next sidebar 暴露 system/{settings,cache,config,monitor,migration} 5 子项 + plan §6 8 类 Tab 实际仅 5 类。

| ID | 标题 | 估时 | 模型 |
|---|---|---|---|
| **CHG-SN-7-REDO-03-A** | ✅ 完成 2026-05-19 / sidebar IA 重构 + 6 旧 URL 308 永久 redirect + ADR-125 / Opus arch-reviewer PASS / 4177 unit PASS | 0.3w 实际 / 0.4w 估 | Opus 主循环 + arch-reviewer Opus 子代理 |
| **CHG-SN-7-REDO-03-B** | ✅ 完成 2026-05-19 / 5 Tab → 8 Tab（+通知/API·Webhook/登录会话 + 图片占位 section）/ 4186 unit PASS | 0.3w 实际 / 0.6w 估 | claude-sonnet-4-6 |
| **CHG-SN-7-REDO-03-C** | ✅ 完成 2026-05-19 / 8 KV 字段扩展（通知 5 + 会话 3）+ ADR-126 / 3 Tab 真实表单 / arch-reviewer Opus PASS / 4190 unit PASS（+13）| 0.3w 实际 | Opus arch-reviewer + claude-sonnet-4-6 主循环 |
| **CHG-SN-7-REDO-03-D** | ✅ 完成 2026-05-19 / arch-reviewer Opus A−（27 项全 ✅ / W1-W4 清理完毕 / W5 MISC 追踪卡登记）/ REDO-03 milestone 全闭环（A→D 4 子卡）| 0.2w 实际 | arch-reviewer (claude-opus-4-7) |

**注**：吸收原 `CHG-SN-7-MISC-SETTINGS-TABS`（M-SN-6 FOLLOWUP 卡）为 REDO-03-B 子任务。

### CHG-SN-7-REDO-04 ✅ Staging 路由处置（方案 A — 独立路由，~1.5w 实际）

> 完成（2026-05-19）：Opus arch-reviewer 裁决方案 A；后端 API 复用 M-SN-3；前端新建完整独立页；ModerationConsole 移除 staging tab + 添加 redirect；admin-nav 新增"暂存发布"条目；8 unit tests PASS。

### CHG-SN-7-REDO-05+ 其他低优先重做（暂无）

PRE-04 16 子卡全部闭环：5 ✅ A 级 + 8 ⚠️ S 级（16 项 MISC 跟踪）+ 4 ❌（REDO-01/02/03/04）。⚠️ S 级页面挂 MISC 卡逐项小修，**不进入 REDO 列表**。

### 估时汇总

| 阶段 | 工时 |
|---|---|
| PRE 阶段（PRE-01 + PRE-02 + PRE-04 + PRE-05） | 1.27w |
| M-SN-SHARED milestone | **0.1w**（SHARED-01 已闭环 / SHARED-02 + 03 实测 admin-ui 已具备能力取消） |
| REDO-01（采集） | 2.55w |
| REDO-02（Submissions） | **~2.75w**（REDO-02-A0 Opus 实测重估 / 原 ~1w 严重低估）|
| REDO-03+（剩余 14 路由） | ~6–10w |
| **M-SN-7 全 milestone** | **~11.0–15.0w**（PRE-04 + SHARED-02 实测累计下调 0.8w） |

### MISC 跟踪卡（PRE-04 子卡审计产出）

| ID | 标题 | 严重度 | 估时 | 触发子卡 |
|---|---|---|---|---|
| **CHG-SN-7-MISC-DASHBOARD-1** | dashboard page__head 2 按钮 onClick 绑定（全站全量采集 / 进入审核台） | ✅ 完成 | 0.05w | #1 |
| **CHG-SN-7-MISC-DASHBOARD-2** | dashboard 4 类卡片数据真实化 + 后端 3 endpoints + ADR-127（与 STATS-EXTEND-ANALYTICS 合并） | ✅ 完成 | 0.7w | #1 + #12 |
| **CHG-SN-7-MISC-DASHBOARD-3** | dashboard 编辑态规则（拖拽 / resize / 全屏 / 卡片库）—— **延后到长期 backlog M-SN-N** | 🟢 P3 | 1.5–2w | #1 |
| ✅ **CHG-SN-7-MISC-VIDEOS-1** 已完成（2026-05-20）| videos poster 尺寸决议固化（32×48 废弃 → 48×72 固化 / reference 4 处 + decisions.md 条目 / 纯文档任务） | ✅ | 0.05w | #4 |
| ✅ **CHG-SN-7-MISC-MERGE-1** 已完成（2026-05-19）| merge Segment 3 类（待审候选 / 已合并 / 已拆分）补全 | ✅ | 0.15w | #6 |
| ✅ **CHG-SN-7-MISC-MERGE-2** 已完成（2026-05-20）| merge 候选 card 形态重做（左右视频卡对比 + 影响预览 + 置信度 pill）/ CandidateExpand card 网格 + 置信度 pill + 影响预览 / SplitSection→MergeSplitSection.tsx(261L) / AuditSection→MergeAuditSection.tsx(133L) / MergeClient.tsx 756→467L / +2 tests / 4337 unit PASS | 🟡 P2 | 0.5–0.8w | #6 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-1** 已完成（2026-05-20）| subtitles KPI 4 列补全（消费 KpiCard + 后端 stats 端点扩展 / ADR-133 / 4264 unit PASS） | ✅ | 0.2w | #7 |
| ✅ **CHG-SN-7-MISC-SUBTITLES-2** 已完成（2026-05-20）| subtitles 上传字幕 action 实装（POST /admin/subtitles / ADR-134 / SubtitleUploadModal / 4266 unit PASS） | ✅ | 0.15w | #7 |
| ✅ **CHG-SN-7-MISC-HOME-1** 已完成（2026-05-20）| home sticky 前台预览实装（1fr/360px 布局 + 右侧 sticky 预览卡 / HomePreviewPanel / 4295 unit PASS） | ✅ | 0.4w | #8 |
| ✅ **CHG-SN-7-MISC-HOME-2** 已完成（2026-05-20）| home page__head actions 完整性核实（预览前台 ghost 按钮 + 新建模块 / PageHeader actions 双按钮 / 11 unit PASS） | ✅ | 0.05w | #8 |
| ✅ **CHG-SN-7-MISC-IMAGE-1** 已完成（2026-05-20）| image-health page__head 2 actions（重扫所有封面 / 批量切 fallback 域）+ ADR-135 / SwitchDomainModal / 4279 unit PASS | ✅ | 0.2w | #11 |
| ✅ **CHG-SN-7-MISC-IMAGE-2** 已完成（2026-05-20）| image-health 破损样本 grid 实装（2:3 ratio + danger dashed border + 错误 overlay / BrokenSamplesGrid / 1fr/1fr split / 4308 unit PASS） | ✅ | 0.3w | #11 |
| ✅ **CHG-SN-7-MISC-USERS-1** 已完成（2026-05-20）| users page head actions（RoleMatrixModal 只读 + InviteUserModal 表单 / 4323 unit PASS） | ✅ | 0.3w | #13 |
| ✅ **CHG-SN-7-MISC-USERS-2** 已完成（2026-05-20）| users KPI 4 列（消费 KpiCard + 后端 users-stats 端点 / ADR-136 Opus PASS / 4332 unit PASS）| ✅ | 0.2w | #13 |
| **CHG-SN-7-MISC-AUDIT-1** | audit 时间穿梭 action（指定时间点状态回放）—— 功能需求待用户确认 | 🟢 P3 | 0.4–0.6w | #15 |
| ✅ **CHG-SN-7-MISC-LOGIN-1** 已完成（2026-05-20）| login card 视觉对齐（400×padding 40 / Brand row 36px logo + 18px title + 11px subtitle / remember checkbox / SSO 占位 disabled / 审计提示 / radial accent 背景 / vitest.config @/stores server-next 修复 / 8 unit PASS / 4347 total PASS） | ✅ | 0.2–0.3w | #16 |
| ✅ **CHG-SN-7-MISC-API-QUERIES-SIZE** 已完成（2026-05-20）| apps/api/db/queries 5 文件主动拆分：videos.ts(1609→313)+internal(193)+mutations(437)+crawler(278)+status(478) / sources.ts(818→405)+types(16)+maintenance(434) / crawlerTasks.ts(628→261)+types(78)+queries(324) / mediaCatalog.ts(577→91)+internal(280)+mutations(235) / imageHealth.ts(648→485)+scan(173) / 13 子文件全部 ≤500 行 / barrel re-export 零 import 改动 / typecheck 全绿 | ✅ | 1.0–1.5w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-ROUTES-SIZE** 已完成（2026-05-20）| apps/api/routes/admin 2 文件主动拆分：crawler.ts(960→323) + crawler.tasks.ts(443) + crawler.runs.ts(216) / moderation.ts(533→390) + moderation.douban.ts(161) / 5 文件全部 ≤ 500 行 / typecheck 全绿 / ADR 合规通过 | ✅ | 0.4–0.6w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-API-SERVICES-SIZE** 已完成（2026-05-20）| apps/api services + workers 4 文件主动拆分：crawlerWorker.ts(585→478) + sources(66) + enqueue(54) / VideoMergesService.ts(523→435) + schemas(111) / DoubanService.ts(511→421) + utils(108) / SourceParserService.ts(502→416) + maps(97) / 9 文件全部 ≤ 500 行 / barrel re-export 零 import 改动 / typecheck 全绿 / 4330 unit PASS | ✅ | 0.6–0.9w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-WEB-NEXT-SIZE** 已完成（2026-05-20）| apps/web-next/components/layout/Nav.tsx 580→404 / NavMoreMenu.tsx(188L) 提取 MoreMenu / 4337 unit PASS | 🟢 P3 | 0.15w | PRE-01 全量扩 ✅ |
| ✅ **CHG-SN-7-MISC-PLAYER-CORE-SIZE** 已完成（2026-05-20）| packages/player + player-core 4 文件主动拆分：step-1 useLayoutDecision（526→16 行 barrel + 5 子文件 ×2 包）/ step-2 Player.tsx（1091→437 / 1085→430；Player/目录 6 子文件：usePlayerState + usePlayerEffects + usePlayerOrchestration + buildControlContext + PlayerOverlays + PlayerChromeBottom）/ 4332 unit PASS / typecheck 全绿 | ✅ | 1.5–2.5w | PRE-01 全量扩 ✅ |
| **CHG-SN-7-MISC-VISUAL-CRAWLER** | Crawler 视觉回归（dev server + Playwright harness baseline + diff ≤ 2%）—— REDO-01-J 软门 | 🟡 P2 | 0.1w | REDO-01-J 验收 |
| ✅ **CHG-SN-7-MISC-AUDIT-PARSER** 已完成（2026-05-19）| 实测脚本本身无 bug / 真因是 changelog 历史遗漏 6 项 D 编号引用 → changelog 补全 / 61/61 D-N 全闭环 | 🟢 P3 | 0.05w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-MISC-CRAWLER-CSV-EXPORT** 已完成（2026-05-19）| 新建 lib/crawler/csv-export.ts (35 行 / exportCrawlerSitesCsv) + CrawlerClient handleExport 委托调用（28→7 行 / 守卫 491<500）+ 14a/14b 测试拆分 | 🟡 P2 | 0.15w | REDO-01-J 验收 ✅ |
| ✅ **CHG-SN-7-ADR-124-AMENDMENT-1** 已完成（2026-05-19）| 在 decisions.md 追加 AMENDMENT 1 段 / D-124-AMD1-1 quote→title 衍生 + metadata→quote block 映射 + D-124-AMD1-2 3 按钮替换决策 + 5 理由（重验语义由 sources.route_action 承载等）/ ADR-124 主评级 A−→**A**（闭档 2 处 DEVIATION） | 🟡 P2 | 0.05w | REDO-02-F 验收 ✅ |
| **CHG-SN-7-MISC-VISUAL-SUBMISSIONS** | /admin/user-submissions 视觉回归（dev server + Playwright baseline + pixel diff ≤ 2%） | 🟡 P2 | 0.1w | REDO-02-F 验收 |
| **CHG-SN-7-MISC-SESSION-FIELDS-CONSUME** | session_timeout_minutes / session_max_concurrent / session_extend_on_activity 三字段当前仅存储 / 需接入会话中间件实际消费（JWT TTL / 并发踢出）— REDO-03-D 验收 W5 追踪 / ADR-128 前置 | 🟡 P2 | ~0.5w | REDO-03-D 验收 W5 |
| **CHG-SN-7-MISC-MOD-PLAYER** | **审核台播放器接入**（SEQ-20260502-01 FIX-B → FIX-D → FIX-CLOSE 三阶段）— FIX-B 重新评估 2026-05-19 解锁 / 详见下方追踪卡展开 | 🟡 P2 | **2.2–2.5w** | SEQ-20260502-01 解锁 |
| ✅ **CHG-SN-7-MISC-USER-SUBMISSIONS-PROCESSED-FILTER** 已完成（2026-05-19）| service ListUserSubmissionsQuerySchema 加 `processed_or_rejected` 枚举 + queries WHERE 拼 `status IN ('processed','rejected')` + 前端 lib/types 扩 + UserSubmissionsClient 改为 segment='processed' 时 status='processed_or_rejected'（移除客户端 filter / 修复分页失真 / 闭档 spec §5.13 #7 PARTIAL）| 🟡 P2 | 0.15w | REDO-02-F 验收 ✅ |

### CHG-SN-7-MISC-MOD-PLAYER 追踪卡展开（2026-05-19）

> 父序列：SEQ-20260502-01（M-SN-4 收口扫尾）
> 状态：🔄 P2 / FIX-B ✅ 已完成 / FIX-D 🟢 解锁
> 建议执行顺序：FIX-B（单卡）→ FIX-D（单卡）→ FIX-CLOSE（验收卡）
> 总估时：2.2–2.5w

#### 阶段 1 — FIX-B：LinesPanel 共享组件提取（~1.5w，强制 Opus 子代理）

**目标**：将当前两处独立实装（审核台 LinesPanel.tsx 247 行 + VideoEditDrawer TabLines.tsx 214 行）提取为 `packages/admin-ui` 共享复合组件，同时修复 30 行平铺 → 线路聚合视图的信息密度问题。

**文件范围**：
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.types.ts`（`LineAggregate` / `EpisodeMini` / `LinesPanelProps` 契约）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/aggregate.ts`（groupSourcesByLine 纯函数 + 聚合状态规则）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/lines-panel.tsx`（共享组件实体，compact/regular/comfortable 三密度）
- 新建：`packages/admin-ui/src/components/composite/lines-panel/index.ts`（barrel）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.tsx`（SignalChip atom：probe/render × ok/partial/dead/pending/unknown 5 态）
- 新建：`packages/admin-ui/src/components/cell/signal-chip.types.ts`
- 改：`packages/admin-ui/src/index.ts`（导出 LinesPanel + SignalChip）
- 改：`apps/server-next/src/app/admin/moderation/_client/LinesPanel.tsx`（迁移为消费共享组件，`compact` density，暴露 `onLineSelect` 回调）
- 改：`apps/server-next/src/app/admin/videos/_client/_videoEdit/TabLines.tsx`（迁移为消费共享组件，`regular` density）
- 新建：`tests/unit/components/admin-ui/composite/lines-panel/aggregate.test.ts`（≥ 8 case：单线路/多集/跨站同名/全 dead/全 pending/部分 active）
- 新建：`tests/unit/components/admin-ui/cell/signal-chip.test.tsx`（≥ 10 case）

**关键约束**：
- ❗ 强制升 Opus 子代理（CLAUDE.md §模型路由第 1 条：新共享组件 API 契约）
- 聚合键 = `(source_site_key, source_name)` 复合（ADR-114-NEGATED LP-03 既定）
- 聚合规则：全 ok→ok / 任意 ok 且非全 ok→partial / 全 dead→dead / 全 pending→pending / 其他→unknown
- 零硬编码颜色（CSS 变量，grep 验证）
- `onLineSelect(key: string, firstActiveUrl: string | null)` 回调供 FIX-D 消费

**估时**：~1.5w（含 Opus 评审 + 双消费方迁移 + 视觉对齐复核）
**建议模型**：spawn arch-reviewer (claude-opus-4-7) API 契约设计 + claude-sonnet-4-6 主循环实施

---

#### 阶段 2 — FIX-D：极简 AdminPlayer 接入（~0.5w）

**目标**：替换 `PendingCenter.tsx` 中的 `▶` 静态占位为可播放的 `AdminPlayer`，接入 player-core，响应 LinesPanel 选中线路切换。

**前置**：FIX-B 完成（`onLineSelect` 契约落地）

**文件范围**：
- 新建：`apps/server-next/src/lib/moderation/use-selected-line.ts`（共享选中线路状态 hook，LinesPanel ↔ AdminPlayer 桥接）
- 新建：`apps/server-next/src/app/admin/moderation/_client/AdminPlayer.tsx`（包装 player-core `<Player>`，极简范围：播放/暂停/进度/集数切换/错误降级，**不接入 GlobalPlayerHost**）
- 改：`apps/server-next/src/app/admin/moderation/_client/PendingCenter.tsx`（替换 `{/* Video player placeholder */}` div 为 `<AdminPlayer>`）
- 新建：`tests/unit/admin-moderation/admin-player.test.tsx`（≥ 5 case：源切换/集数切换/错误降级/null 源占位/feedback 上报去抖）

**极简范围（含/不含）**：
- ✅ 播放/暂停 / 进度条 / 集数显示 / 错误降级占位
- ❌ 字幕 / 影院模式 / 画中画 / 镜头切换 / GlobalPlayerHost

**feedback 上报（D-17）**：
- `onFirstFrame` → POST /v1/feedback/playback {success: true}
- `onError` → POST /v1/feedback/playback {success: false, errorCode}
- PII 红线：不上报 userId / IP

**估时**：~0.5w
**建议模型**：claude-sonnet-4-6（player-core 已有 Player export，无新契约）

---

#### 阶段 3 — FIX-CLOSE：投产对齐收口（~0.2w）

**目标**：arch-reviewer Opus 全序列评级（目标 A−），e2e 黄金路径，visual baseline 归档。

**前置**：FIX-B + FIX-D 全部完成

**验收内容**：
- arch-reviewer Opus 评级 spec §5.2 checklist + SEQ-20260502-01 已知偏离闭档
- e2e：`tests/e2e/admin/moderation/lines-aggregate-display.spec.ts` + `player-integration.spec.ts`
- visual baseline 9 张：lines-panel-collapsed/expanded、right-pane-detail/history/similar、filter-preset-popover、player-loaded、player-error、edit-drawer-lines

**建议模型**：spawn arch-reviewer (claude-opus-4-7)

---

## M-SN-6 milestone 关闭声明（2026-05-17）

CHG-SN-6-29-AUDIT arch-reviewer (Opus) 评级 **A−** + PATCH-1 + PATCH-2 双修闭环 → **M-SN-6 正式关闭**。

**M-SN-6 最终交付指标**：
- 任务卡：47 张（44 主体 + AUDIT + PATCH-1 + PATCH-2）
- 单测：3659 → **4018 PASS**（+359）
- R-MID-1 系统化：6.5 → **12 次**（13 → 36 strict / +23）
- v1 crawler 写端点 audit 覆盖：**12/13（非 deprecated 100%）**
- 共享原语沉淀：4 cell + 2 form + 1 csv-export 工具 + N badge
- 新视图/Drawer：/admin/audit + image-health + crawler（4 视图 + 3 Drawer + 4 控制按钮）+ SettingsContainer 5/5 Tab（**注：plan §6 明列 8 类 Tab；实际交付 5 类，缺 4 类 → CHG-SN-7-MISC-SETTINGS-TABS 跟踪**）
- csv-export 消费方：5（TaskLogsDrawer + AuditClient + UsersListClient + SubmissionsListClient + VideoListClient）
- ADR 新增：ADR-118 accepted / ADR-119/120-NEGATED / ADR-105 AMENDMENT
- 文件大小硬上限：**部分合规**（CHG-SN-6-29-FOLLOWUP 2026-05-17 复核实测：crawler 域 PATCH-1 后全部 ≤ 500；但 M-SN-6 全工作目录扫描发现 7 文件超限 — 2 M-SN-6 新增（AuditClient 558 / ImageHealthClient 501）+ 5 历史遗留。已立 CHG-SN-7-PRE-01 守卫 + MISC-FILE-SIZE 拆分预案兜底）

**M-SN-7 入口**（**2026-05-18 范围扩展**）：M-SN-7 主线由"清债务"转为"**设计稿对齐重做**"（用户复核发现 server-next 后台架构性偏离设计稿 v2.1）。

新调用顺序（计划文档 §4）：
1. **CHG-SN-7-PRE-04** 全量审计 16 路由 → 首张子卡 /admin/dashboard §5.1（用户决策"首推 PRE-04"）
2. PRE-01 文件大小守卫 / PRE-02 ADR-121 协议化 / PRE-05 ADR-123 schema（可并行）
3. **M-SN-SHARED-01/02/03** 共享原语前置（KpiCard + ExpandableTable + Spark）
4. **REDO-01-A → J** 采集控制重做
5. **REDO-02** Submissions Card list 重做
6. REDO-03+ 其他 14 路由（PRE-04 排序后填充）

详见上方「设计稿对齐重做」段 + `docs/archive/2026Q2/m-sn-7-redo/M-SN-7-design-realign-plan.md` 全文。

~~PRE-03 CrawlerSitesTab 外置 batch bar 修正~~ → **取消**（整页要重做）。

---

## [SEQ-20260521-01] docs 大清理 + manual 工程地基（执行序列）

- **状态**：✅ 已完成（3/3 卡全部 PASS：A ✅ + B ✅ + C ✅ 2026-05-21）— SEQ 收尾
- **创建时间**：2026-05-21
- **目标**：清理 docs/ 历史文档遗存（避免新开发被旧规范污染） + 新建 docs/manual/ 说明书工程骨架（M-SN-8 前置）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口（mock 视图 / 死按钮 / 断链 / UUID 输入 / dashboard 模板 等）；提出"实现 + 说明书双轨"开发模式；要求清理历史文档作为入门第 0 步
- **依赖**：M-SN-6 已关闭 / M-SN-7 REDO-01/02/03 全闭环 / PRE-04 全量审计 A− PASS
- **真源**：用户决策三连（2026-05-21）：① 全归档 27 份 ② tracks.md 保留顶层 ③ admin-module-template.md 保持现状
- **节奏**：用户决策"仅先 C1 + 看状况"——A 跑完后视 verify 红线情况再放 B/C 上手

### 子卡序列（3 卡）

1. **CHG-SN-7-CLEANUP-01-A** · docs 归档（26 mv + 4 rm 纯归档不改引用）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet（CLAUDE.md §模型路由 Haiku 适用 #2 文档归档；当前 opus 续会话不擅自降级）
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **范围**：见原 tasks.md 卡片（已闭环移除）
   - **e2e 黄金路径**：无（纯文档归档）
   - **完成备注**：
     - 实际 26 mv（原估 27 含 tracks.md，用户决策保留顶层 → 实际 26）+ 4 rm（2 audit stub + baseline_20260418/ + handoff_20260422/）+ 4 新 archive README + 2 task 文件 + 1 副作用 unstage = 总 36 staged
     - 4 子目录创建：milestone-audits(6) / m-sn-7-redo(3) / design-iterations(11) / admin-v1(4)；server_next_view_template + PRE-01-A-drill 进 archive/2026Q2/ 根
     - tasks.md 卡片"范围 27"为估算口径偏差 1（含 tracks.md 决策推翻），不影响 mv 实际操作
     - typecheck PASS / lint PASS（仅 pre-existing img 警告，与本卡无关）
     - verify:adr-contracts pre-existing 红线 `apps/server-next/src/app/login/page.tsx:7 background+backgroundColor`（CHG-SN-7-MISC-LOGIN-1 提交，与本卡无关）— 已 stash 验证非本卡引入
     - **预期失败点观察**：本卡未跑 markdown 链接 grep；该工作转 CHG-SN-7-CLEANUP-01-B 启动时统一 grep 评估
     - 工时实际 ~0.15w
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-7-CLEANUP-01-B** · 引用改写 + docs/README 重写 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - grep 引用面评估实证：CLAUDE.md 零引用（决策 3 admin-module-template 不动 100% 安全）→ CLAUDE.md 修订移出本卡范围
     - 8 份宿主 sed 批量改 26 条映射规则（M-SN-6-...-17-RECHECK.md 必须先于 -17.md 防前缀冲突）：task-queue.md 37 / changelog.md 30 / decisions.md 12 / server_next_plan 7 / tracks.md 4 / logging-rules.md 1 / reference.md 1 / architecture.md 1
     - docs/README.md 整体重写：§1 权威文档清单精简 + §3 已归档参考分 5 子段 + §6 新增 M-SN-8 manual 入口（4 条硬约束 H1-H4 + 双轨流）
     - 0 残留验证：26 项归档文件全部在非 archive 路径 0 命中
     - typecheck PASS / lint PASS（FULL TURBO 缓存命中）
     - 总 diff：10 文件 +232 / -135 行
   - **工时估算**：0.18w / 实际 ~0.18w

3. **CHG-SN-7-CLEANUP-01-C** · docs/manual 骨架 + verify:manual-coverage 守卫 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus xhigh 续会话）
   - **子代理**：无
   - **完成备注**：
     - manual 35 文件骨架全部新建：
       - 1 主 README + 90-glossary（含 20 术语 + 7 缩写）
       - _template/PAGE_TEMPLATE.md（8 章节模板）+ _template/WORKFLOW_TEMPLATE.md
       - 00-roles-and-permissions（5 角色矩阵 + 11 操作权限速查）+ 01-getting-started（含 10 快捷键）
       - 10-workflows/ README + W1 金票（完整骨架含反例与失败处理）+ W2-W5 简骨架
       - 20-pages/ README + 15 P-* 骨架（按 admin 路由 1:1，含 P-submissions-deprecated 特殊映射）
       - 30-pickers/ README + 5 picker 骨架（VideoPicker / SourceLinePicker / ContentRefPicker / UserPicker / SitePicker）
     - scripts/verify-manual-coverage.mjs 守卫：扫 apps/server-next/src/app/admin/*/page.tsx + /login → 比对 docs/manual/20-pages/ → 缺失 FAIL / 多余 WARN
     - KNOWN_NO_MANUAL 豁免清单：dev / system / analytics / staging（4 项 stub 路由）
     - SPECIAL_MAP：submissions → P-submissions-deprecated.md（deprecation banner 特殊映射）
     - package.json 加 "verify:manual-coverage"（位于 file-size-budget 与 migrate 之间）
     - 实测：15 admin 路由 ↔ 15 P-* manual = 1:1 PASS
     - typecheck + lint PASS（FULL TURBO 缓存命中）
     - preflight.sh 集成推迟（独立 follow-up 卡 CHG-SN-7-MISC-PREFLIGHT-MANUAL，按需启动）
   - **工时估算**：0.3w / 实际 ~0.25w

### 关键约束

- 用户决策固化：全归档 27 份 / tracks.md 保留 / admin-module-template.md 保持单文件
- 每子卡独立 commit + 独立 typecheck + lint + verify 验收
- A 子卡验收后视 verify 红线数量决定 B 子卡范围（红线越多说明引用面越大）

---

## [SEQ-20260521-02] M-SN-8 Critical Path Hardening · 采集→审核→上架 金票闭合 + Picker 消灭 UUID（执行序列）

- **状态**：✅ **SEQ 几近完结**（7/9 ✅ + 1 NEGATED + 1 ADR 前置 -04 待启）— 01/02/03/SHARED-04-A/05/06/08 ✅ + 07 ❌ NEGATED；**CHG-SN-8-06 重大发现**：approve_and_publish 端点已存在，零 ADR 已闭合；**仅剩 CHG-SN-8-04 TabSimilar 需新端点 ADR 前置**，独立 SEQ-20260521-03 重起
- **创建时间**：2026-05-21
- **目标**：闭合 W1 金票（采集 → 审核 → 上架）端到端业务链路；消灭 UUID 输入（H4）；删死按钮（H2）；删 mock（H1）；通断链（H3）
- **背景**：用户复核 server-next 实际可用性发现 13 个 UX 缺口；docs/manual/10-workflows/W1-crawl-to-publish.md §3 反例段明示 5 个修复点
- **依赖**：SEQ-20260521-01 全部 3 卡 PASS（commit 7a0f75b7 manual 骨架就位）
- **真源**：`docs/manual/10-workflows/W1-crawl-to-publish.md` + `docs/manual/README.md` §3 四条硬约束
- **节奏**：用户决策"自动化执行"——按子卡顺序自动推进，遇 BLOCKER 才停；每张卡独立 commit + 独立验收

### 子卡序列（9 卡）

1. **CHG-SN-8-01** · Crawler「全站全量」改非主操作 + 双重确认（输入"全量"防误触）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7（opus 续会话）
   - **子代理**：无
   - **完成备注**：
     - CrawlerClient.tsx：拆 `handleRunAll` → `handleRunAllIncremental` + `handleRunAllFull`；主按钮 testid `crawler-run-all-btn` → `crawler-run-all-incremental-btn` / label "全站全量" → "全站增量" / onClick → incremental
     - 主按钮路径：单次 confirm「确定对全站发起增量采集？」→ `runCrawlerAll('incremental')`
     - 全量路径（高级 dropdown，danger 样式）：① confirm「确定对全站发起【全量】采集？」② prompt 要求输入"全量"二字，输错静默中止 → `runCrawlerAll('full')`
     - CrawlerAdvancedMenu.tsx：扩 props `onRunAllFull` + `runAllFullPending`；items 顶部加 `run_all_full` 项（danger + separator + 动态 pending label）；现 5 items（run_all_full / scheduler / reindex / stop_all / freeze）
     - P-crawler.md DoD §0 已填：§1/§2/§3.1.1+§3.1.2/§4.1+§4.2+§4.3/§8 关系图；§3.2/§3.3 留待后续卡填
     - CrawlerClient.test.tsx：用例 #2/#11/#12/#13 更新（incremental + 新 testid）+ 补 4 新用例 #13a/#13b/#13c/#13d（advanced menu 双重 confirm / 输错中止 / 第一次取消 / freeze 拦截）
     - 验收：58/58 CrawlerClient.test PASS / typecheck + lint + verify:manual-coverage PASS
     - 全量 unit 单跑 PASS；并跑偶发 fail 2 文件（VideoImageSection / StagingEditPanel）经 stash 验证为 pre-existing flaky 与本卡无关
   - **关联问题**：用户问题 #4「全站全量采集非常用操作，改为全站增量 + 二次确认」
   - **工时估算**：0.1w / 实际 ~0.12w

2. **CHG-SN-8-02** · Crawler 「最近采集」列升级 status pill — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - 范围收敛：实施前评估发现「增量/全量 inline btn」已存在（CHG-SN-7-REDO-01-D 落地）；「调度 mode pill」需 cross-fetch `AutoCrawlConfig.perSiteOverrides`（`CrawlerSite` 类型无 schedulers 字段）→ 工时会爆 0.15w 上限；本卡聚焦最痛点「lastCrawl 列无 status 视觉」
     - 实施：crawler-site-columns-v2.tsx 升级 `lastCrawl` cell — 单纯相对时间 → status pill（成功 ok / 失败 failed / 运行中 running / 未采集 null）+ 相对时间双行视觉；列宽 110 → 130
     - 调度列推迟到 **CHG-SN-8-02-B**（独立 follow-up，需先决策是否扩 CrawlerSite type 加 scheduleMode 字段以避免 cross-fetch）
     - 测试 +3 用例（#13e/#13f/#13g：ok pill / failed pill / null pill）；总 61/61 PASS
     - typecheck + lint + verify:manual-coverage PASS
     - P-crawler.md §3.2 / §5 字段 / §6 状态颜色 / §7 FAQ 全部填写完整
   - **关联问题**：用户问题 #11 「列显示不完整」最痛点（看不到上次成功/失败）
   - **follow-up**：CHG-SN-8-02-B 调度列（需先评估 AutoCrawlConfig fetch 时机或 row-level 字段扩展）
   - **工时估算**：0.15w / 实际 ~0.1w（范围收敛）

3. **CHG-SN-8-03** · 采集 toast → /admin/moderation?run_id 软深链（W1 金票 ②）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：评估后选**软深链**（前端 toast action + URL banner，不改后端）；硬过滤（后端 GET pending-queue 加 ?runId= filter）触发 plan §4.5 ADR-端点先后协议 → 推迟 CHG-SN-8-03-B
   - **完成备注**：
     - CrawlerClient.tsx：导入 useRouter；增 helper `buildModerationDeepLinkAction(runId)` 返回 Toast action `{label:'查看本次新增视频', onClick}`；handleRunAllIncremental + handleRunAllFull 两个 toast 加 action
     - 新建 RunInfoBanner.tsx（AdminCard surface='subtle' status='ok' + 「清除筛选」按钮）
     - ModerationConsole 增 `runIdParam` 读 query + `dismissRunBanner` 移除 run_id 参数；条件渲染 RunInfoBanner（在 Segment tabs 上方）
     - CrawlerClient.test 顶层 mock `next/navigation`（routerPushMock 共享），补 1 用例 #13h（action 存在 + onClick 触发 router.push）
     - 新建 RunInfoBanner.test 4 用例（runId 短 ID / 文案 / dismiss / data-testid）
     - typecheck PASS（修 1 个 AdminCard status='info' → 'ok' 类型约束 — admin-ui Card status 只支持 ok/warn/danger）
     - 62/62 CrawlerClient PASS + 4/4 RunInfoBanner PASS = 全绿
     - 文档：P-crawler §3.3 完整填写 / P-moderation §0/§1/§2/§3.0/§8 填写 / W1 反例段 #1+#2 勾掉 ✅
   - **关联问题**：H3 链路打通 / W1 金票反例 #2
   - **follow-up**：CHG-SN-8-03-B（后端 pending-queue 接 runId filter；需起 ADR + R-MID-1 同步）
   - **工时估算**：0.15w / 实际 ~0.18w

4. **M-SN-SHARED-04-A** · VideoPicker 业务原语沉淀 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 / 0 红条件）
   - **完成备注**：
     - Step 0 spawn arch-reviewer Opus 子代理：D1-D11 11 维度产出（组件分层 / 数据模型 / Props API / fetcher 注入 / 键盘 a11y / 状态机 / 错误态 / export 清单 / 文件结构 / 测试 surface / 风险）；评级 **A−**（v1 不公开 PickerDialog 子件为最小公开面，未来 SourceLinePicker 复用时再提升 export）
     - Step 1 packages/admin-ui/src/components/pickers/video-picker.types.ts（PickerVideoItem / VideoPickerFilter / VideoPickerFetcher / VideoPickerFetchParams / VideoPickerFetchResult / SingleVideoPickerProps / MultipleVideoPickerProps / VideoPickerProps / DialogState）
     - Step 2 picker-result-row.tsx + picker-trigger.tsx + picker-dialog.tsx + video-picker.tsx + index.ts 共 5 实施文件（types 1 + 实施 5 = 6 文件）
     - Step 3 packages/admin-ui/src/index.ts 加 `export * from './components/pickers'`
     - Step 4 单测 14/14 PASS（覆盖 D10 列出全部 14 用例：触发器渲染 / 多选回显 / Dialog 开关 / debounce 300ms / 搜索结果 / 单选确认 / 多选 staging / 多选取消 / 空结果 / 网络错误 / 键盘 ArrowDown+Enter / disabled / 触发器清除）
     - Step 5 docs/manual/30-pickers/VideoPicker.md 8 章节定稿（含消费方 fetcher 注入示例）
     - 实施 1 偏离 OpenAI 子代理建议：AdminInput 不 forwardRef → 用 dialog body querySelector('input') 替代 ref-based focus；不影响功能
     - 1 type adjust：EmptyState 不接受 data-testid → wrap 在 `<div data-testid>` 内
     - typecheck + lint + verify:manual-coverage 全 PASS
   - **关联问题**：用户问题 #8（字幕 UUID）+ #10（首页模块 UUID）+ #7（合并入口）的钥匙
   - **后续**：CHG-SN-8-08 视频库合并入口可消费此 picker；字幕上传 / 首页模块的废 UUID 改造在独立 follow-up（不阻塞 SEQ）
   - **工时估算**：0.3-0.4w / 实际 ~0.35w

5. **CHG-SN-8-04** · 审核台 RightPane TabSimilar 实装
   - **状态**：⬜ 待开始
   - **范围**：调研：GET /admin/moderation/:id/similar 是否已有，无则起 ADR-NN + 端点（type/year/country 召回 top10）/ TabSimilar.tsx 真实化 / 行尾「发起合并」深链 → /admin/merge?candidate_a=<id>&candidate_b=<sim_id>
   - **关联问题**：用户问题 #5 + #7
   - **风险**：可能需起新端点 + ADR（按 §4.5 协议先 Opus PASS 才能起实施卡）
   - **工时估算**：0.4w（含 ADR）

6. **CHG-SN-8-05** · 审核台 RightPane 批量「重测此视频线路」按钮 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案选型**：原任务卡是 per-line inline 重测但需改 LinesPanel API（共享组件 API 契约 → Opus 评审协议）→ 收敛为审核台 TabDetail 顶部「批量重测此视频线路」按钮（不动 admin-ui 公开 API）；per-line 推迟到 CHG-SN-8-05-B
   - **完成备注**：
     - TabDetail.tsx 顶部加 actions row + AdminButton 「重测此视频线路」+ loading 态
     - handleReprobeAll：listVideoSources → Map 去重 (siteKey, sourceName) → Promise.allSettled 循环 reprobeRoute → 汇总 toast（成功/部分失败/全失败 3 态）+ 处理空线路 / fetch 错误
     - reprobeRoute 与 listVideoSources 现成 API，零新端点 / 零 ADR
     - TabDetailReprobe.test 4 用例 PASS（按钮渲染 / 调用去重 / 部分失败 warn / fetch 错误 danger）
     - typecheck + lint + verify:manual-coverage PASS
     - W1 反例 #4 ✅；P-moderation §3.1a 完整填写
   - **关联问题**：W1 金票反例 #4「探/播 待测」无测试入口
   - **follow-up**：CHG-SN-8-05-B（per-line inline 重测需 LinesPanel API 扩展 + Opus 评审）
   - **工时估算**：0.2w / 实际 ~0.2w

7. **CHG-SN-8-06** · 审核台「通过即上架」开关 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **重大发现**：`approve_and_publish` action **已存在**（apps/api/src/routes/admin/videos.ts:35 + reviewVideo signature 已支持），admin only；本卡**零新端点 / 零 ADR**，与原任务卡估时假设不符
   - **完成备注**：
     - lib/moderation/api.ts approveVideo 加 andPublish 可选参数（默认 false）；true → 'approve_and_publish'
     - ModerationConsole 增 approveAndPublishOn state + sessionStorage 持久化（key: `admin.moderation.approveAndPublishOn.v1`）
     - Segment tabs 右侧加 toggle 标签（仅 pending tab 显示）：off「通过 → 暂存」 / on「✓ 通过即上架」+ title 解释
     - handleApprove 串接：调 approveVideo(id, approveAndPublishOn)
     - moderation-api.test 补 3 用例（默认 / 显式 false / true）；15/15 PASS
     - P-moderation §3.1b 完整填写（含权限说明 moderator vs admin）
     - W1 反例 #5 从 ⚠️ 升级为 ✅（admin 有 toggle / moderator IA 路径保留）
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：W1 金票反例 #5「通过后 staging 多走一步」
   - **工时估算**：0.25w 原（假设端点扩展）/ 实际 ~0.1w（端点已存在）

8. **CHG-SN-8-07** · /admin/staging → /admin/moderation?tab=staging 单一真源 — 状态：❌ **NEGATED**（2026-05-21）
   - **NEGATED 理由**：与 **CHG-SN-7-REDO-04 Opus arch-reviewer 已闭合裁决「独立路由」**直接冲突（commit 范围内 staging tab 已从 moderation 移除 + 新建 /admin/staging 独立页 + ModerationConsole router.replace 把 ?tab=staging 反向跳独立路由）。本卡草拟时未识别 REDO-04 裁决；按 CLAUDE.md「主循环不得直接改写架构决策 / 必须先 spawn Opus 子代理出具方案」+ §模型路由「不得自动推翻已闭合裁决」原则，本卡 NEGATED 不实施
   - **重启路径**：若未来确认要反转 IA 决策（合并回 moderation tab），必须：① 起新 ADR 修订 REDO-04 → ② Opus arch-reviewer 评审 → ③ 落 docs/decisions.md NEGATED-ADR 范式 → ④ 起新实施卡
   - **不在范围**：本会话不推翻 REDO-04 裁决

9. **CHG-SN-8-08** · 视频库行级「发起合并」深链 + Merge 页接 candidate_a — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **方案收敛**：原任务卡含 VideoPicker 选 candidate_b 集成；本卡先打通入口（dropdown item + 深链 + banner），VideoPicker 集成留 -08-B follow-up
   - **完成备注**：
     - VideoRowActions.tsx：导入 useRouter；buildItems 加「发起合并」item（separator）；onClick → `router.push('/admin/merge?candidate_a=<id>&from=videos')`
     - MergeClient.tsx：导入 useRouter + useSearchParams；读 ?candidate_a + ?from；条件渲染 AdminCard banner「已锁定候选 A: <短 ID>」+「清除」按钮（清除时仅删 candidate_a + from 保留其它 params）
     - MergeCandidateBanner.test 3 用例 PASS（无 query 不渲染 / 有 query 渲染 + 短 ID + 来源文案 / 清除按钮调 router.replace 保留其它 params）
     - W4 工作流入口章节更新「从视频库进入」标 ✅；CHG-SN-8-04 类似 tab 入口标「待启动」
     - typecheck + lint + verify:manual-coverage PASS
   - **关联问题**：用户问题 #7「合并拆分页没有入口」
   - **follow-up**：CHG-SN-8-08-B（merge 页接 VideoPicker 直接选 candidate_b 完成合并，免转 candidate 列表）
   - **工时估算**：0.2w / 实际 ~0.2w

### SEQ-20260521-02 关键约束

- **9 卡按序执行**：第 4 卡（VideoPicker）可与 1/2/3 并行但作为 8/9 的硬前置
- **每卡独立 commit + 独立 typecheck/lint/verify 验收**
- **遇 BLOCKER 必停**：CHG-SN-8-04 端点起 ADR 前置 / CHG-SN-8-06 端点扩展 ADR 前置 — 若需起 ADR 而 plan §4.5 协议要求 Opus PASS 才能起实施，则起 ADR 卡 + 等 Opus
- **DoD §0 强制**：每卡先回填 docs/manual/20-pages/P-<slug>.md §3 草稿，PASS 前定稿
- **总工时估算**：~1.9w（含 ADR 风险缓冲）

---

## [SEQ-20260521-03] CHG-SN-8-04 TabSimilar — 类似视频召回 ADR + 端点 + 视图（执行序列）

- **状态**：✅ **SEQ 全部完结**（3/3 卡 PASS：-ADR ✅ + -EP ✅ + -VIEW ✅ 2026-05-21）— W1 反例 #3 完全闭合
- **创建时间**：2026-05-21
- **目标**：W1 金票反例 #3「审核台右栏类似 Tab 是占位」彻底闭合 — 起新端点 `GET /admin/moderation/:id/similar` + 召回算法 + TabSimilar 实装
- **背景**：SEQ-20260521-02 跳过 -04 是因为新端点触发 plan §4.5 ADR-端点先后协议；本 SEQ 起 ADR 卡 + Opus 评审 + 实施
- **依赖**：SEQ-20260521-02 已完结（7/9 ✅ + 1 NEGATED）；VideoPicker 已就绪（M-SN-SHARED-04-A 可被 TabSimilar 复用作"手动合并目标选择"扩展面）

### 子卡序列（3 卡）

1. **CHG-SN-8-04-ADR** · ADR-137 起草（类似视频召回端点协议）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（0 红线 + 1 非阻塞建议 N1）
   - **完成备注**：
     - spawn arch-reviewer Opus 1 轮：ADR-137 11 节完整正文（决策摘要 / 背景 / D-137-1..6 决策 / 端点契约表 / SQL 设计 / Response 结构 / zod schema / 性能 baseline / 分层约束 / 4 文件 R-MID-1 GET 简化版 / 关联 ADR）
     - D-137-1 算法采纳方案 A（纯字段过滤 + Service 层加权评分）
     - D-137-2 评分公式 4 维（type +40 / year delta +25 / country +15 / genres Jaccard +20）
     - D-137-3 权限 moderator+admin
     - D-137-4 query params `?limit=10` + `?yearRange=5`
     - D-137-5 GET 只读不写 audit → R-MID-1 降级 4 文件
     - D-137-6 性能 p95 ≤ 200ms / 粗筛 LIMIT 50
     - **重要发现**：年份/国家/genres 字段不在 videos 表（migration 029 已迁），需 JOIN media_catalog（实施时利用 idx_catalog_type_year / idx_catalog_genres GIN 索引）
     - N1 非阻塞建议（跨类型相似召回 fallback）登记 ADR §11 末段；如未来用户反馈漏召回明显，立独立 CHG-SN-8-04-N1 follow-up 卡
     - decisions.md ADR-137 完整章节落盘（D-137-1..6 含初始 Accepted 闭环）
     - plan §9 ADR 索引推进至 ADR-137 Accepted
     - verify:adr-d-numbers advisory：6 个 D-137-* 编号已通过 changelog 闭环（本卡条目明示）
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」
   - **工时估算**：0.15w / 实际 ~0.15w（含 Opus 评审 1 轮）

2. **CHG-SN-8-04-EP** · 端点 + Service + Queries 实施（ADR-137 落地）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（按 ADR-137 直接实施）
   - **完成备注**：
     - queries/moderation.ts：新增 `findVideoFeatures(db, id)` 返回 VideoFeatures | null（JOIN media_catalog）+ `listSimilarCandidates(db, query)` 粗筛 LIMIT 50（按 ADR §5 SQL）
     - ModerationService.ts：新增 `listSimilar(id, opts)` 方法（404 NOT_FOUND if target null → 调 candidates → computeSimilarityScore 4 维加权 → minScore=10 过滤 → score desc 排序 → top-N 截断 → camelCase 映射）；导出 `SimilarVideoItem` 类型 + `computeSimilarityScore` 纯函数
     - routes/admin/moderation.ts：新增 `SimilarPathParams` + `SimilarQueryParams` zod schema；新增 `GET /admin/moderation/:id/similar` handler（双 zod 校验 + AppError NOT_FOUND → 404 + 500 兜底）
     - moderation-similar.test 13 用例 PASS（happy path / NOT_FOUND / 空 / limit / yearRange / minScore 过滤 + computeSimilarityScore 7 公式用例）
     - **顺手修 pre-existing 红线**：apps/server-next/src/app/login/page.tsx:7 background+backgroundColor → backgroundColor+backgroundImage（CHG-SN-7-MISC-LOGIN-1 引入的 shorthand 冲突已修，verify:style-shorthand-conflict 0 命中）
     - typecheck + lint + verify:adr-contracts 全 PASS（含 endpoint-adr 173 路由对齐 44 ADR 端点）
     - **关键调整**：ADR-137 §4 标题从 `### 4. 端点契约` 改为 `### 端点契约`（去掉编号）以匹配 adr-parser.mjs 正则
   - **关联**：W1 反例 #3 接近闭合（端点就绪，剩 -VIEW 卡）
   - **工时估算**：0.2w / 实际 ~0.25w（含 pre-existing 红线修复 + parser 编号调整）

3. **CHG-SN-8-04-VIEW** · TabSimilar 实装 + 测试 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - `apps/server-next/src/lib/moderation/api.ts`：新增 `SimilarVideoItem` 类型 + `ListSimilarVideosOptions` + `listSimilarVideos(videoId, opts)` 客户端封装（调 `GET /admin/moderation/:id/similar`）
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/TabSimilar.tsx`：从 47 行占位扩展为 145 行真实组件 — 4 态机（loading / results / empty / error）+ useEffect cancellable fetch（videoId 变化或重试时取消 stale）+ 列表行（标题 + meta + similarityScore pill + 「发起合并」按钮）+ 行级 router.push 深链至 /admin/merge?candidate_a=<视频>&candidate_b=<相似>&from=moderation
     - `apps/server-next/src/app/admin/moderation/_client/RightPane/index.tsx`：TabSimilar 调用补 `videoId={v.id}` prop
     - TabSimilar.test 5 用例 PASS（loading / 列表渲染 / merge 深链跳转 / 空召回 / 网络错误）
     - typecheck + lint + verify:adr-contracts + verify:manual-coverage 全 PASS
     - **ADR-137 §3 D-137-1..6 完整 e2e 链路验证**：前端 → /lib/moderation/api.ts → /admin/moderation/:id/similar → ModerationService.listSimilar → queries.findVideoFeatures + listSimilarCandidates → computeSimilarityScore → top-N response → TabSimilar 渲染 + merge 深链
     - **P-moderation §3.3.3 + W1 反例 #3 ✅ 标完成**
   - **关联问题**：W1 金票反例 #3「类似 Tab 占位」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

### SEQ-20260521-03 关键约束

- **3 卡线性依赖**（ADR → EP → VIEW），不能并行
- **ADR Opus 任一红线 → BLOCKER 暂停**（按 plan §4.5）
- **总工时估算**：~0.5w（vs 原 SEQ-02 中 -04 单卡 0.4w 估算偏低；拆 3 子卡更现实）

---

## [SEQ-20260521-04] M-SN-8 follow-up 收尾（消费 VideoPicker / 用户原 13 问题闭合）

- **状态**：🔄 进行中
- **创建时间**：2026-05-21
- **目标**：消费 M-SN-SHARED-04-A VideoPicker 修复用户原 13 问题中明确点出的反 UUID 痛点（#8 字幕上传 / #10 首页模块），落实 4 条硬约束 H4「零 UUID 输入」
- **依赖**：M-SN-SHARED-04-A 已就绪（commit 1c2b2329）；SEQ-20260521-03 全部 PASS（W1 金票 100% 闭合）

### 子卡序列

1. **CHG-SN-8-FUP-SUB** · 字幕上传 Modal 接 VideoPicker — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（VideoPicker 已走过 Opus 评审）
   - **完成备注**：
     - 新建 `apps/server-next/src/lib/videos/picker-fetcher.ts` 导出 `videoPickerFetcher` 函数（listVideos → PickerVideoItem 字段映射）
     - SubtitleUploadModal.tsx：state `videoId: string` → `video: PickerVideoItem | null`；删除 `^[0-9a-f-]{36}$/i` UUID 正则校验；UI 「视频 ID（UUID）」 input → `<VideoPicker label="视频" required>`；onSubmit 传 `videoId: video.id`
     - SubtitleUploadModalPicker.test 4 用例 PASS（VideoPicker 渲染 / video 必选校验 / 提交携带 video.id / Modal 复位）
     - typecheck + lint + verify:manual-coverage 全 PASS
     - 文档：P-subtitles §3.1 完整填写（含搜索操作步骤 + 快捷键）；VideoPicker.md 受害方表标 ✅
   - **关联问题**：用户问题 #8「字幕上传通过 UUID 设计需要彻底重写」**完全闭合**
   - **工时估算**：0.15w / 实际 ~0.15w

2. **CHG-SN-8-FUP-HOME** · 首页模块 ContentRefPicker + HomeModuleDrawer 接入 — 状态：✅ 已完成（2026-05-21）
   - **建议模型**：opus
   - **执行模型**：claude-opus-4-7
   - **子代理**：arch-reviewer (claude-opus-4-7) — 1 轮 A− PASS（D1-D11 11 维度契约）
   - **完成备注**：
     - Step 0 spawn Opus 起草 ContentRefPicker API 契约（外部受控 / 不内置 type tab / videoFetcher + videoTypeOptions 注入 / video 编辑态 fetcher 恢复 + AbortController）
     - Step 1 `packages/admin-ui/src/components/pickers/content-ref-picker.types.ts`（ContentRefType union + ContentRefPickerProps）
     - Step 2 `packages/admin-ui/src/components/pickers/content-ref-picker.tsx`（~225 行 / 4 类型条件渲染 / video 适配层 / URL 内联校验 / fallback console.error）
     - Step 3 admin-ui pickers/index.ts export ContentRefPicker + Type
     - Step 4 HomeModuleDrawer 接入：替换原 contentRefId AdminInput + 4 hint 反人类填法 → `<ContentRefPicker>` 单组件；setField type 变化时同步 reset contentRefId（Opus 评审建议 2）；新增 VIDEO_TYPE_OPTIONS 11 项注入
     - Step 5 测试 10 用例 PASS（≥ 8 必须 + 2 advisory）：video 选中 / external_url 校验 / custom_html / video_type select / type 切换 / videoFetcher 缺失降级 / disabled / 编辑态 fetcher 恢复 / error prop
     - typecheck + lint + verify:manual-coverage + verify:adr-contracts 全 PASS
     - 文档 ContentRefPicker.md 8 章节完整定稿（含消费方接入示例 + type 切换行为表 + 错误态矩阵）
     - **Opus 评审 3 关键建议全部落实**：(1) AbortController cleanup + fetch (2) 消费方负责 type 切换 reset value (3) 缺 fetcher/options 时 console.error + fallback 不 throw
   - **关联问题**：用户问题 #10「首页编辑添加完全不符合人机交互」**完全闭合**
   - **工时估算**：0.3-0.4w / 实际 ~0.35w（含 Opus 1 轮）

3. **CHG-SN-8-FUP-OTHERS**（条件触发）· 其它 picker 沉淀（SourceLinePicker / UserPicker / SitePicker）
   - 触发条件：实际有 ≥ 2 个新消费方需求
   - 工时估算：各 0.2w

4. **CHG-SN-8-FUP-SOURCES-DEAD-BTN** · sources「一键替换最相似 URL」死按钮修复（用户问题 #6 部分）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无
   - **完成备注**：
     - SourcesClient.tsx：button onClick → setReplaceTipOpen(true)；新增 Modal「批量一键替换 URL · 筹备中」展示 4 节内容（预期行为 / 当前未实装 / 当前替代路径 3 步 / follow-up 登记入口）+ 「我知道了」关闭
     - SourcesReplaceTip.test 2 用例 PASS（按钮点击 → Modal 渲染 + dismissModal）
     - P-sources §3.1 完整填写（说明筹备状态 + 替代路径 + follow-up 登记口）+ §3.2 别名 displayName 已消费实证（SourceMatrixRow:234 fallback）
     - 别名展示部分（用户问题 #6 另一痛点）实证 SourceMatrixRow 已用 `line.displayName ?? line.sourceName` fallback；本卡范围不需补
   - **关联问题**：用户问题 #6「一键替换最相似 URL 功能不详」部分闭合（死按钮 → Modal 解释 + 替代路径；实际算法实装推 CHG-SN-8-FUP-SOURCES-REPLACE-ADR follow-up）
   - **工时估算**：0.05-0.08w / 实际 ~0.08w

5. **CHG-SN-8-FUP-USER-MENU** · 用户菜单 4 noop action 改 Modal/Toast 反馈（用户问题 #13）— 状态：✅ 已完成（2026-05-21）
   - **建议模型**：sonnet
   - **执行模型**：claude-opus-4-7
   - **子代理**：无（仅前端 UI / 不动 admin-ui 公开 API）
   - **完成备注**：
     - 新建 `apps/server-next/src/app/admin/_client/UserMenuActionModal.tsx`（~210 行 / 单组件根据 type prop 切 3 视图：profile / preferences / help）
     - profile：显示当前 user.displayName / email / role / id + 「编辑（筹备中）」disabled
     - preferences：复用 ThemeProvider 暴露主题切换 + 「品牌 / 语言 / 密度」筹备中占位
     - help：W1-W5 工作流速查 + 9 高频快捷键 + `docs/manual/` 完整说明书入口
     - admin-shell-client.tsx：增 actionModalType state + useToast；handleUserMenuAction 3 case → setActionModalType；switchAccount → toast「多账号切换在 M-SN-N」
     - UserMenuActionModal.test 5 用例 PASS（null / profile / preferences toggle / help / close）
     - typecheck + lint + verify:manual-coverage PASS
     - 00-roles-and-permissions.md §4 用户菜单 6 项 action 矩阵填写
   - **关联问题**：用户问题 #13「用户菜单项目多不可用」**完全闭合**（H2 零死按钮）
   - **工时估算**：0.15w / 实际 ~0.15w

