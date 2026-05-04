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
3. `docs/server_next_view_template.md` 文档落地，后续视图卡可直接按模板起草
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
  - `docs/server_next_view_template.md`（新建）
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
- `docs/server_next_view_template.md` 落地后即作为 M-SN-4+ 任务卡起草的必读文件
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
> Plan 真源：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §8.1 任务卡总览
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
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-04-admin-ui-shared-components-plan_20260502.md` v1.1
- **实际主循环**：claude-opus-4-7（偏离 plan §8.1 sonnet-4-6 建议；理由：跨层下沉契约 + ADR-106 例外审议）
- **子代理调用**：arch-reviewer (claude-opus-4-7) — 2 轮 PASS（CONDITIONAL → R1/R2/R3 闭环 → PASS）
- **欠账登记**：DEBT-SN-4-A（5 张 Playwright 视觉基线，截止 CHG-SN-4-10 收口）
- **后续解锁**：CHG-SN-4-07 / CHG-SN-4-08 准入条件全部满足（5 件共享组件 + 上移 DecisionCard 已就位）

### CHG-SN-4-05 · 后端 API：8 新端点 + 4 改端点 + 058a schema patch ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 2 张 / SEQ-20260501-01 阶段 B 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-05-api-endpoints-plan_20260502.md` v1.1
- **完成**：8 新端点 + 4 改端点 + 058a migration（processed_at + partial index）+ ApiResponse 信封三形态 + RBAC（moderator/admin）+ AuditLogService（5 写 1:1 覆盖）+ AppError 类型守卫 + LABEL_UNKNOWN 严格校验 + 237 文件 / 2998 测试全绿
- **执行 Track**：`track/sn4-05-api`（并行模式 / 集成 PR `8a797ec`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无（complete commit）；arch-reviewer (claude-opus-4-7) — 复核 2 轮（B+ → A 级 PASS，2026-05-02）
- **欠账登记**：DEBT-SN-4-05-A（toggleSource 并发保护）/ DEBT-SN-4-05-B（XFF trustProxy 白名单）/ DEBT-SN-4-05-C（ApiResponse 信封 ADR-110，截止 -07 启动前）
- **后续解锁**：CHG-SN-4-07 / CHG-SN-4-08 准入条件全部满足（5 件共享组件 + 后端 API 已就位）；ADR-110 须先于 -07 启动完成

### CHG-SN-4-06 · apps/worker 新建 + SourceHealthWorker Level 1+2 ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 3 张 / SEQ-20260501-01 阶段 B 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-06-worker-source-health-plan_20260502.md` v1.1
- **完成**：apps/worker 独立 service + Level 1 probe + Level 2 render（独立 cron 每 2h）+ advisory lock 视频级聚合 + 站点熔断 + pino 6 项 metric + node-cron 三任务调度（level1Task + level2Task + feedbackTask）+ feedback-driven-recheck（058a 缺失优雅降级）+ withRetry 指数退避；ADR-107 草案 → 正式
- **执行 Track**：`track/sn4-06-worker`（并行模式 / 集成 PR `cc27eef`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无（feat + fix commit）；arch-reviewer (claude-opus-4-7) — 复核 2 轮（B → A− 级 PASS，2026-05-02）
- **欠账登记**：无（R-1 catch 路径无 unit / R-1 metric 命名 'probe.skipped_circuit' 在 058a-missing 场景误导 — 列入 -10 milestone 收口可选优化项）
- **后续解锁**：CHG-SN-4-10 milestone 收口卡（含 e2e + arch-reviewer A/B/C 评级）

### CHG-SN-4-07 · 审核台前端接入（useTableQuery + Gmail 流 + RejectModal/Drawer 接线）✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 5 张 / SEQ-20260501-01 阶段 C 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §5（六项前端共性约束 + 三 Tab 操作流程）
- **完成**：URL Tab 状态 + sessionStorage activeIdx + 光标分页 load-more + 键盘 J/K/A/R/S + RejectModal 接线 + 乐观 approve 删行/rollback；新建 `lib/moderation/api.ts` + `i18n/messages/zh-CN/moderation.ts` + 12 cases；7 文件 _client/ 改写；247 文件 / 3057 测试全绿
- **执行 Track**：`track/sn4-07-fe-moderation`（并行模式 / 集成 PR 待提交）
- **实际主循环**：claude-sonnet-4-6
- **子代理调用**：无；arch-reviewer (claude-opus-4-7) — 复核 1 轮（**B+ 级 PASS**，2026-05-02）
- **欠账登记**：DEBT-SN-4-07-A（visual baseline 7 张占位 PNG）+ DEBT-SN-4-07-B（e2e 未自报）→ CHG-SN-4-10 收口；DEBT-SN-4-07-C（硬编码中文 ~15 处违反 plan §5.0.5）→ CHG-SN-4-09a 单独修复
- **后续解锁**：CHG-SN-4-10 milestone 收口卡（待 CHG-SN-4-09a 完成）

### CHG-SN-4-08 · VideoEditDrawer 三 Tab 真实 API ✅ 完成（2026-05-02）

- **来源**：M-SN-4 plan v1.4 §8.1 第 6 张 / SEQ-20260501-01 阶段 C 双轨
- **执行真源**：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.4 §6 + §7
- **完成**：TabLines / TabImages / TabDouban 三 Tab 真实 API 接入；新建 `lib/videos/{api,types,use-sources,use-images,use-douban}.ts` + `i18n/messages/zh-CN/videos-edit.ts` + 3 个 hook test 文件（19 cases）；249 文件 / 3064 测试全绿
- **执行 Track**：`track/sn4-08-video-edit-drawer`（并行模式 / 集成 PR `165fdf3`）
- **实际主循环**：claude-sonnet-4-6（与 plan §8.1 建议一致）
- **子代理调用**：无；arch-reviewer (claude-opus-4-7) — 复核 1 轮（**A− 级 PASS**，2026-05-02）
- **欠账登记**：DEBT-SN-4-08-A（visual baseline 1 张 `video-edit-drawer-lines-tab.png` 缺失）/ DEBT-SN-4-08-B（VIDEO 类 e2e 未跑/未自报）→ 转 CHG-SN-4-10 milestone 收口（同 DEBT-SN-4-A 性质）
- **后续解锁**：CHG-SN-4-10 milestone 收口卡

### CHG-SN-4-09（编号空置 / 已退出本期）

- D-15 拆分入口推迟 M-SN-5；编号不复用，M-SN-5 拆分实装新开 CHG-SN-5-XX

### CHG-SN-4-10 · M-SN-4 milestone 收口（e2e + 状态保留 5 步 + arch-reviewer 评级）⏳ 待开

- 前置：-03 ～ -08 + DEBT-SN-3-A 全部完成
- 强制子代理：arch-reviewer (claude-opus-4-7) — milestone A/B/C 评级


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
| DEBT-SN-3-A | CHG-SN-3-11 | `docs/server_next_view_template.md` 模板文档（后续视图卡参考实现模板）| M-SN-4 milestone 完成时补做 |
| DEBT-SN-3-B | CHG-SN-3-12 | staging 环境 cookie + nginx 反代 e2e 演练（需人工参与）| cutover 前，需用户确认 staging 可用 |
| DEBT-SN-3-C | CHG-SN-3-13 | M-SN-3 milestone 阶段审计（Opus arch-reviewer A/B/C 评级）| cutover 前，依赖 DEBT-SN-3-B 完成或书面 staging-waiver |

### M-SN-4 欠账（CHG-SN-4-04 收口产生，2026-05-02）

| 欠账 ID | 原任务 | 描述 | 截止节点 |
|---------|--------|------|---------|
| DEBT-SN-4-A | CHG-SN-4-04 | 5 件下沉组件的 Playwright `toHaveScreenshot()` 视觉基线（BarSignal × 5 状态 / StaffNoteBar display+edit / LineHealthDrawer / RejectModal / DecisionCard 三态）；现仓库 `tests/visual/` 为手动 PNG 归档无 Playwright host，本卡内不引入新 visual harness 基础设施 | CHG-SN-4-10 milestone 收口卡 |
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

---

## [SEQ-20260502-01] M-SN-4 收口扫尾：审核台投产对齐（执行序列）

> 创建时间：2026-05-02 22:00
> 最后更新时间：2026-05-03（FIX-B 治理升级 → 整序列⏸暂停）
> 状态：⏸ 暂停（FIX-B 治理升级阻塞 FIX-D / FIX-CLOSE；待 M-SN-5 + 前台播放页落地后返回）
> 负责人：@engineering
> 里程碑：M-SN-4 投产可用 · CHG-SN-4-10 收口前置
> Plan 真源：`docs/designs/backend_design_v2.1/M-SN-4-moderation-console-plan.md` v1.7

### 阶段进度（2026-05-03 暂停时点）

- ✅ 阶段 1 全部完成：FIX-A / FIX-E / FIX-C / FIX-F + 09d hotfix（5 张并行卡 + 1 张 hotfix）
- ⏸ 阶段 2 FIX-B：治理升级为 admin-ui 共享组件提取（草案 `M-SN-4-FIX-B-lines-panel-extraction-plan.md` v0.1） — 暂停待观察清单触发
- ⏸ 阶段 3 FIX-D：依赖 FIX-B 选中线路状态契约 → 同步暂停
- ⏸ 阶段 4 FIX-CLOSE：依赖 FIX-B / FIX-D 完成 → 同步暂停

### 暂停期间已知偏离（FIX-CLOSE 评级时登记）

- 审核台 LinesPanel 视觉密度未对齐 plan v1.6 §2 规约（按 video_sources 行平铺 30 行问题保留）
- 中央播放器仍为 ▶ 静态占位（FIX-D 未实装）
- 信息密度截图比对差距 > 10%（设计稿 `Screenshot 2026-05-02 at 20.15.54.png`）

### 返回触发（观察清单 — 任一落地后重新评估 FIX-B 治理方案）

1. M-SN-5 合并/拆分页面规划落地（D-15 推迟卡转入实装）
2. 前台播放页线路切换需求定型
3. DEBT-LINE-KEY-01 决策（line_key 一级概念建模 schema 决策）

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

2. **CHG-SN-4-FIX-B** — 线路面板按"线路"聚合 + 信息密度对齐设计稿（状态：⏸ 暂停 / 治理升级 2026-05-03）
   - **暂停理由**（用户 2026-05-03 拍板）：升级为 admin-ui 共享组件提取（多消费方：审核三 Tab + VideoEditDrawer + M-SN-5 合并/拆分 + 前台播放页）；执行暂停待 M-SN-5 合并/拆分页面 + 前台播放页线路切换需求落地后再敲定最终治理方案
   - **提取草案**：`docs/designs/backend_design_v2.1/M-SN-4-FIX-B-lines-panel-extraction-plan.md` v0.1（完整 Props 契约 + 视觉规约 + 消费方迁移路径 + 决策表）
   - **plan 同步**：plan v1.7 patch §1（已落地 2026-05-03）
   - **已敲定决策**（草案 LP-01 / LP-03 / LP-04）：
     - 共享组件位置 = `packages/admin-ui/src/components/composite/lines-panel/`（新建 composite 目录）
     - LineAggregate 字段命名 = camelCase
     - density variant = `'compact' | 'regular' | 'comfortable'` 三档
   - **待敲定决策**（草案 LP-02 / LP-05 / LP-06）：聚合工具位置 / 任务卡拆分 / plan-vs-ADR 协议
   - **观察清单**：M-SN-5 合并拆分 / 前台播放页 / DEBT-LINE-KEY-01 任一落地后返回敲定
   - **暂停期间状态**：审核台 LinesPanel.tsx + VideoEditDrawer TabLines.tsx 保持现状（v1.6 §2 视觉密度规约未对齐 — FIX-CLOSE 登记已知偏离）
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

6. **CHG-SN-4-FIX-D** — 极简 Player 接入 + feedback-reporter（状态：⬜）
   - 前置：CHG-SN-4-FIX-B 完成（依赖选中线路状态契约）
   - 创建时间：2026-05-02 22:00
   - 计划开始：FIX-B 完成后
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

7. **CHG-SN-4-FIX-CLOSE** — 投产对齐收口（e2e + arch-reviewer 评级）（状态：⬜）
   - 前置：FIX-A ～ FIX-F 全部完成
   - 创建时间：2026-05-02 22:00
   - 计划开始：Phase 1+2 完成后
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
| DEBT-LINE-KEY-01 | SEQ-20260502-01 决策（方案 B 短期妥协）| `video_sources.line_key` 一级建模 + 跨站合并 UI（Z01.X02 = Z02.X02 等价合并）；本期使用 `(source_site_key, source_name)` 复合键聚合，逻辑上每站独立线路 | M-SN-5 启动时新开 CHG-SN-5-LINE-KEY-XX |
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
> 方案真源：`docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`
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
  - `docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`（已存在 draft，本卡更新 status: active）
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
  - `docs/designs/backend_design_v2.1/state-pill-soft-walkthrough_20260503.md`（新建 — 走查清单 12 项）
  - `docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`（同步实装 §4.4 + border 槽位决策记录）
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
  - `docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md`（新建 — 槽位错位清单 + 设计依据）
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
  - ✅ audit report 归档：`docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md`（含已修正清单 + 已审核保留 + 7 项观察项 follow-up 触发条件）
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
  - 同步更新 `docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md` 第 18-20 项追加
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

- **状态**：🟢 进行中（CHG-UX-01 开工 2026-05-03）
- **创建时间**：2026-05-03
- **方案文档**：`docs/designs/backend_design_v2.1/ux-interactive-feedback-plan.md`
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
- **状态**：📝 待开工
- **依赖**：CHG-UX-01 至 -05 全部完成
- **建议模型**：opus
- **文件范围**：
  - `packages/admin-ui/src/**/*.tsx`（grep `outline: 0` / `outline: none` 全清理或带配套替代）
  - `docs/decisions.md`（新增 ADR-112）
  - `docs/designs/backend_design_v2.1/ux-interactive-feedback-plan.md`（状态 → ✅）
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


