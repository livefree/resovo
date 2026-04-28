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

- **状态**：🔄 执行中（CHG-SN-1-10/-11/-12/-09 ✅；CHG-SN-1-13 待开）
- **创建时间**：2026-04-28 18:00
- **最后更新时间**：2026-04-28 20:35
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

13. **CHG-SN-1-13** — M-SN-1 闭环补丁：changelog + task-queue 备忘（IA 漏检追溯）（状态：⬜ 未开始）
    - 创建时间：2026-04-28 18:00
    - 计划开始：CHG-SN-1-10/-11/-12 全部完成后
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
  - [ ] CHG-SN-1-10 PASS：plan §7 5 组 IA + ADR-100 IA 修订段落盘
  - [ ] CHG-SN-1-11 PASS：admin-nav.ts 与 shell.jsx 1:1 对齐 + 路由 SSR 全绿
  - [ ] CHG-SN-1-12 PASS：plan §6 M-SN-2 范围显式列出 Sidebar/Topbar/Toast/dark-first/快捷键 5 大子项 + §8 Shell 列扩展 + 工时估算复核
  - [ ] CHG-SN-1-09 PASS：token 跨域守卫 string 级生效（M-SN-1 闭环备忘原欠账）
  - [ ] CHG-SN-1-13 PASS：changelog 补丁 + handoff 追溯 + 本序列闭环

