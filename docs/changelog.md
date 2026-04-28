# Resovo（流光）— 开发变更记录

> status: active
> owner: @engineering
> scope: completed task change history
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-28

> 本文件仅记录 M-SN（server-next 立项）之后的变更。M0–M6 期间的完整历史已归档至 `docs/archive/changelog/changelog_m0-m6.md`。

每次任务完成后，AI 在此追加一条记录。
格式固定，便于追踪变更历史和排查问题。
追加规则：新记录统一追加到文件尾部，不做头部插入。

---

## 记录格式模板

```
## [TASK-ID] 任务标题
- **完成时间**：YYYY-MM-DD
- **记录时间**：YYYY-MM-DD HH:mm
- **执行模型**：claude-<opus|sonnet|haiku>-<version>（完整 ID，如 claude-sonnet-4-6）
- **子代理**：无 / [subagent-name (claude-xxx-x-x), ...]
- **修改文件**：
  - `path/to/file.ts` — 说明做了什么
  - `path/to/another.ts` — 说明做了什么
- **新增依赖**：（如无则写"无"）
- **数据库变更**：（如无则写"无"）
- **注意事项**：（后续开发需要知道的事情，如无则写"无"）
```

字段约束：
- "执行模型" 必填，必须是完整模型 ID
- "子代理" 必填；本任务未 spawn 任何 Task 工具调用时写 "无"；有则列出每个 subagent 的名称和其对应 model ID
- 历史条目（本补丁应用前的条目）不强制回填，保持原样

---

## [CHG-SN-1-08] M-SN-1 milestone 完成标准验收 + arch-reviewer (Opus) 阶段审计 · **B 级 PASS**

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 04:50
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6, Opus) — milestone 阶段审计 B 级 PASS
- **修改文件**：
  - `docs/server_next_plan_20260427.md`（修改）— §7 视图数字字段 v2.1 对账（21 路由占位枚举）+ 修订日志追加 v2 → v2.1（4+1 层 supersede + 字段对账 + 实际工时 vs 估算 + 节奏校准建议）
  - `docs/server_next_handoff_M-SN-1.md`（新建）— plan §10.8 SHOULD-4-d 要求；含 milestone 摘要 / 三个核心决策点 / M-SN-2 启动前置任务 / 留账清单 / 任务卡指针 / 复盘结论 / ADR 对账 / M-SN-2 启动 checklist
  - `docs/task-queue.md`（修改）— SEQ-20260428-01 状态 → ✅ 已完成；新增 CHG-SN-1-09（M-SN-2 第一卡前置：verify-server-next-isolation 扩展 string 级 token 跨域守卫）
- **新增依赖**：无
- **数据库变更**：无
- **milestone 审计结果**（plan §5.3）：
  - **B 级 PASS** —— 完成标准达成率 90%（5 条 4.5 通过）；0 MUST 阻塞；工时未超
  - 5 条完成标准：dev 通路 ✅ / 27 路由 ⚠️（v2.1 修订为 21 占位）/ typecheck+lint+test ✅ / 视觉回归截图 ⚠️（豁免：net-new 字段）/ admin-ui workspaces ✅
  - 阶段重点 4 项：token 收编 ⚠️（hex 内联留账）/ Provider 协议 ✅ / 0 apps/server 依赖 ✅ / ESLint 边界 ⚠️（string 级守卫待 CHG-SN-1-09）
- **关键风险**（reviewer 排序）：
  1. ESLint string 级守卫缺位（待 CHG-SN-1-09）
  2. Provider 物理副本同源化漂移（M-SN-7 cutover 后处理）
  3. 视觉回归 8 张截图未执行（M-SN-1 期间豁免理由成立；M-SN-7 cutover 前置补做）
- **M-SN-2 启动前置 3 项**：
  - CHG-SN-1-09 string 级守卫扩展（ADR-103 评审硬前置）
  - 视觉回归豁免备忘已落 task-queue
  - handoff 文档已输出
- **回归**：typecheck (7 ws) / lint (4/4) / 1768 tests / verify-server-next-isolation 全绿
- **注意事项**：
  - M-SN-2 启动按 plan §6 原 2.5w 估算执行；CHG-SN-2-08 milestone 审计再回看校准
  - plan §7 v2 → v2.1 修订属"现状对齐"非"决策回流"（plan §0 SHOULD-4-a 合规）
  - dual-signal 内联 hex / Provider 物理副本 / admin-only 子路径细分等留账已在 plan v2.1 + handoff 文档双线索引

---

## [CHG-SN-1-07] ESLint no-restricted-imports 边界 + verify-server-next-isolation 兜底脚本

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 04:25
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS（6/6 子项 ✅）
- **修改文件**：
  - `apps/server-next/.eslintrc.cjs`（新建）— extends `next/core-web-vitals` + `no-restricted-imports` 三组 patterns（apps/server/** / apps/web/** / apps/web-next/src/**），与 plan §4.6 字面对齐
  - `scripts/verify-server-next-isolation.mjs`（新建，176 行）— TypeScript Compiler API（已有 typescript devDep）AST 扫描；覆盖 4 种 import 形态（import / export from / dynamic import / require）；6 条 forbidden patterns（绝对路径 + 相对路径跨 apps）；退出码 0/1/2 三档
  - `package.json`（修改）— scripts 追加 `verify:server-next-isolation`
  - `scripts/preflight.sh`（修改）— 在 [5/6] Lint 与 [6/6] 测试之间追加 [5b/6] verify-server-next-isolation
- **新增依赖**：无（typescript 已是 devDep；avoid ts-morph 新依赖 ~10MB）
- **数据库变更**：无
- **故意违规自测**（4 种形态全部捕获）：
  - `import 'apps/server/src/admin'` → 命中 reason 1
  - `import '../../web-next/src/components/Foo'` → 命中 reason 3
  - `require('apps/web/old-stuff')` → 命中 reason 2
  - `await import('../../server/utils')` → 命中 reason 4
  - exit code: 1
- **OK 路径**：扫描 server-next 34 文件，0 违规，exit 0
- **简化偏离**（reviewer 判定合理）：
  - 用 TypeScript Compiler API 替代 ts-morph（已有 dep，无 ~10MB 新依赖）
  - 静态 AST 覆盖足以满足 plan §4.6 "模块图遍历"实质意图；递归依赖链分析留 M-SN-3+
  - 原计划 `node:fs/promises.glob` 在 Node v20.19.6 不可用，改用手动 fs.readdirSync 递归
- **ADR-102 闭环**：dual-signal + admin-layout 跨域消费禁令的"编译期守卫"承诺至此落实（CHG-SN-1-03 / CHG-SN-1-04 留账闭环）
- **回归**：typecheck (7 ws) / lint (4/4) / 1768 tests 全绿
- **注意事项**：
  - server-next 业务卡新增文件须经过本守卫；如需例外（极少数 type-only 跨 apps 引用），先 BLOCKER 上报
  - `apps/web` regex `(?!next)` lookahead 是双保险，实际逻辑由 `(\/|$)` 已排除 `apps/web-next`

---

## [CHG-SN-1-06] server-next apiClient + 鉴权层 + login 实装

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 04:10
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 CONDITIONAL（1 MUST + 1 SHOULD）→ 二轮 PASS
- **修改文件**：
  - `apps/server-next/src/lib/api-client.ts`（新建）— apiClient 物理副本（与 web-next 同构简化版，credentials: 'include'）+ ApiClientError 类
  - `apps/server-next/src/lib/auth/index.ts`（新建）— Cookie 名常量 + UserRole（**直接 import @resovo/types**，避免幽灵角色）+ parseUserRole + canAccessAdmin（null 守卫包装）
  - `apps/server-next/src/middleware.ts`（修改）— 追加 /admin/** 鉴权拦截（refresh_token + user_role 双因素）；未登录 redirect /login?from=（含 query string）；user role redirect /403
  - `apps/server-next/src/app/login/LoginForm.tsx`（新建）— 客户端表单（'use client'）；POST /v1/auth/login → router.push(from || /admin)
  - `apps/server-next/src/app/login/page.tsx`（修改）— Suspense 包裹 LoginForm
- **新增依赖**：无（@resovo/types 是 workspace 内部包）
- **数据库变更**：无
- **smoke 验证**：
  - 未登录 /admin → 307 → /login?from=%2Fadmin
  - /admin/videos?page=2&q=test 未登录 → 307 → /login?from=%2Fadmin%2Fvideos%3Fpage%3D2%26q%3Dtest（query 保留）
  - user_role=user → 307 → /403
  - user_role=editor → 307 → /login（不合法 role 视为未登录，fail-safe）
  - user_role=moderator/admin → 200
  - /403 + /login 无 auth 200
- **首轮 reviewer MUST 修复**：UserRole 单一真源 → @resovo/types（删本地定义，去 'editor' 幽灵角色）
- **首轮 reviewer SHOULD 修复**：redirect from 参数保留 query string（middleware loginUrl.search 清空后再 set from = pathname + search）
- **简化偏离**（reviewer 判定合理）：
  - 不引入 zustand authStore（M-SN-3 业务卡再决定）
  - admin-only 子路径细分（/admin/users / /admin/crawler / /admin/analytics 仅 admin）推后 M-SN-2+
  - 真 e2e 登录测试推后（需 apps/api 在跑）；本卡仅 path smoke
- **回归**：typecheck (7 ws) / lint (4/4) / 1768 tests 全绿；server-next 0 import apps/web-next
- **注意事项**：
  - access token 不在客户端持久化（cookie 自动管理）；M-SN-3 业务卡如需主动持有再引入 zustand
  - 'editor' role fail-safe → /login（设计选择：未知 role = 未登录，非"已登录无权"）

---

## [CHG-SN-1-05] server-next 路由骨架（IA v0 占位 / 19 路由按 plan §7 文字清单）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 03:55
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS（7/7 子项 ✅）
- **修改文件**（25 文件 = 22 page.tsx + layout.tsx + admin-nav.ts + PlaceholderPage.tsx）：
  - `apps/server-next/src/lib/admin-nav.ts`（新建）— IA 路由树常量（4 区段 / 13 顶层 + 5 system 子）+ flattenAdminRoutes 工具；头部注释记录与 plan §7 数据不一致的偏离
  - `apps/server-next/src/components/PlaceholderPage.tsx`（新建）— 路由占位通用组件（title/milestone/note）
  - `apps/server-next/src/app/admin/layout.tsx`（新建）— 极简 admin shell（CSS Grid sidebar+topbar+main，消费 `--sidebar-w / --topbar-h` admin-layout token）
  - `apps/server-next/src/app/admin/page.tsx`（修改）— dashboard 转 PlaceholderPage 形态
  - 13 admin 顶层占位：moderation / videos / sources / merge / subtitles / image-health / crawler / home / submissions / analytics / users / audit / system landing
  - 5 admin/system 子：settings / cache / monitor / config / migration（按 plan §7 文字清单）
  - `apps/server-next/src/app/login/page.tsx`（新建）
  - `apps/server-next/src/app/403/page.tsx` + `apps/server-next/src/app/not-found.tsx`（错误页）
- **新增依赖**：无
- **数据库变更**：无
- **关键发现**：plan §7 数据不一致 — 文字清单列 20 路由（13 顶层 + 5 system 子 + 1 编辑子 + 1 login）但视图数行 549 写"顶层 21 / 总 27"。本卡按文字清单落 19 路由（defer videos/[id]/edit 至 M-SN-4），偏离记录在 admin-nav.ts 头部 + 留 CHG-SN-1-08 修订 plan §7 数字字段
- **任务卡草稿偏离**：completion 字段曾列 design-tokens/banners/api-keys/cron/cache 五 system 子，本卡按 plan §7 真源落 settings/cache/monitor/config/migration
- **smoke 验证**：22 路由全部 SSR 200（含 /admin/system landing + /login + /403）；不存在路径返回 404
- **回归**：typecheck (7 ws) / lint (4/4) / 1768 tests 全绿
- **注意事项**：
  - admin layout 用 inline style + CSS variables；M-SN-2 起步下沉 packages/admin-ui 时替换为正式组件
  - PlaceholderPage 在 server-next 本地，M-SN-2 视复用情况决定是否下沉
  - CHG-SN-1-08 阶段审计时需修订 plan §7 数字字段或补漏视图，统一对账

---

## [CHG-SN-1-04] server-next BrandProvider / ThemeProvider 移植 + admin-layout token 接入

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 03:45
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS（6/6 子项 ✅，0 MUST 偏差）
- **修改文件**：
  - `apps/server-next/src/types/brand.ts`（新建）— Brand / Theme / Context 类型副本，与 apps/web-next 同构（物理副本，非跨 apps import）
  - `apps/server-next/src/lib/brand-detection.ts`（新建）— 纯函数工具副本；DEFAULT_THEME 改为 'dark'（plan §4.3 / ADR-102 dark-first）
  - `apps/server-next/src/contexts/BrandProvider.tsx`（新建）— Provider 副本，API 与 web-next 同构；admin 单品牌简化（setBrand 不 fetch /api/brands）+ 去 logger.client（CHG-SN-1-06 补回）+ resolveTheme SSR fallback 改 'dark'
  - `apps/server-next/src/middleware.ts`（新建）— admin 简版 cookie → header（无 next-intl，单语言 zh-CN）
  - `apps/server-next/src/app/globals.css`（新建）— `@import '@resovo/design-tokens/css'` + html/body 基础样式（color-scheme: dark）
  - `apps/server-next/src/app/layout.tsx`（修改）— RootLayout 包裹 BrandProvider；从 cookies/headers 读 initialBrand/initialTheme；`<html data-brand data-theme>` 服务端预设避免 hydration mismatch；引入 globals.css
  - `apps/server-next/package.json`（修改）— deps 追加 @resovo/design-tokens
  - `apps/server-next/tsconfig.json`（修改）— paths 追加 @resovo/design-tokens
  - `package-lock.json`（npm install 自然产物）
- **新增依赖**：无（@resovo/design-tokens 是 workspace 内部包）
- **数据库变更**：无
- **smoke 验证**：
  - :3003 /admin 返回 200；HTML 含 `data-brand="resovo"` + `data-theme="dark"`
  - middleware response headers 含 `x-resovo-brand: resovo` + `x-resovo-theme: dark`
  - Next.js 编译后 layout.css 注入 `--sidebar-w / --topbar-h / --row-h / --dual-signal-probe / --bg-canvas / --fg-default` 全部 admin-layout + dual-signal 变量
  - dev log 0 hydration warning
- **三处合理简化偏离**（reviewer PASS）：
  - DEFAULT_THEME 改 'dark'（dark-first）
  - setBrand 不 fetch 远程（admin 单品牌内部工具）
  - 去 logger.client 依赖（CHG-SN-1-06 接入时无缝补回）
- **回归**：typecheck（7 workspaces）/ lint (4/4) / 1768 tests 全绿
- **注意事项**：
  - ADR-102 跨域消费禁令编译期守卫（ESLint + ts-morph）推迟到 CHG-SN-1-07 处理
  - light 主题不接入 M-SN-1（不阻塞 cutover；SSR fallback 已默认 dark）

---

## [CHG-SN-1-03] packages/design-tokens 4+1 层结构（admin-layout 新增 + dual-signal 收编）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 03:05
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6, Opus) — 首轮 PASS（3 SHOULD 不阻塞）
- **关键事件**：摸现状触发 BLOCKER（design-tokens 是 4 层成熟系统，与 ADR-102 假设的 3 层轻量包不符）→ 用户裁定 A 方案 → ADR-102 patch + plan §4.3 同步
- **修改文件**：
  - `docs/decisions.md`（ADR-102 行 ~2178-2210 新增"修订记录 · 与 design-tokens 现状对齐"段；关联段补 ADR-038/039）
  - `docs/server_next_plan_20260427.md` §4.3（"3 层"→"4+1 层"目录树 + 收编路径表 + 修订前置说明）
  - `docs/architecture.md` §17a（新增；4+1 层结构表 + v2.1 → packages 字段映射 + 跨域禁令 + build pipeline 变更）
  - `packages/design-tokens/src/semantic/dual-signal.ts`（新建；light/dark × probe/render + soft；hex 内联 v2.1 设计稿原值，文件头明示偏离与续编出口）
  - `packages/design-tokens/src/admin-layout/{shell,table,density,index}.ts`（新建顶层目录；sidebar-w / topbar-h / row-h / col-min-w / density-* 共 8 字段）
  - `packages/design-tokens/src/semantic/index.ts`（追加 dualSignal 导出）
  - `packages/design-tokens/src/index.ts`（顶级导出追加 admin-layout）
  - `packages/design-tokens/build.ts`（buildSemanticVars 加 dual-signal source；buildLayoutVars 末尾追加 admin-layout 三组；buildJs/buildDts 顶层导出 adminLayout）
  - `packages/design-tokens/scripts/build-css.ts`（同步追加 dual-signal + admin-layout）
  - `packages/design-tokens/src/css/tokens.css`（auto-generated；新增 16 行 = 8 dual-signal × light/dark + 8 admin-layout 主题无关）
  - `tests/unit/design-tokens/admin-layout.test.ts`（新建，8 tests pass）
- **新增依赖**：无
- **数据库变更**：无
- **跨域消费验证**：
  - `grep -rn "dual-signal|--probe|--render|--sidebar-w|--topbar-h|--row-h|--col-min-w|--density-" apps/web-next/src/` → 0 命中
  - server-next 当前 0 消费（M-SN-1-04+ 接入）
- **回归**：typecheck / lint / 1768 tests（150 files + 新 8 tests）全绿
- **SHOULD 留账（CHG-SN-1-07 处理）**：dual-signal + admin-layout 跨域消费的 ESLint `no-restricted-imports` + ts-morph CI 兜底脚本（`scripts/verify-server-next-isolation.mjs`）
- **注意事项**：
  - dual-signal hex 内联是 admin 业务专属语义层简化偏离（不污染 primitives oklch 调色），未来如需纳入 primitives 颜色层须 ADR 续编
  - 4+1 层结构 supersede ADR-102 原"3 层"措辞，不触发 ADR-022/023/032/038/039 级联 supersede
  - admin-layout 第三层与 server-next（cutover 后 apps/admin）生命周期绑定

---

## [CHG-SN-1-02] apps/server-next Next.js 空壳 + workspaces 追加 + dev :3003 起服

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 02:45
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS
- **修改文件**：
  - `apps/server-next/package.json`（新建）— @resovo/server-next@0.1.0 / dev:3003 / 极简 deps（next/react/react-dom + admin-ui + types）
  - `apps/server-next/next.config.ts`（新建）— reactStrictMode only，无 next-intl，无 image loader（M-SN-1 后续卡视需要扩展）
  - `apps/server-next/tsconfig.json`（新建）— 沿用 web-next 模板 + paths 仅 admin-ui/types
  - `apps/server-next/src/app/layout.tsx`（新建）— 最小 RootLayout，html lang="zh-CN"
  - `apps/server-next/src/app/page.tsx`（新建）— `redirect('/admin')`
  - `apps/server-next/src/app/admin/page.tsx`（新建）— dashboard 占位 "Hello server-next"
  - `package.json`（修改）— workspaces 字母序追加 apps/server-next；scripts 加 dev:server-next；typecheck 串联
  - `scripts/dev.mjs`（修改）— tasks 数组追加 server-next（apps/server-next:3003，bright magenta 配色）
  - `package-lock.json`（npm install 自然产物）
- **新增依赖**：无（next/react/react-dom 已存在 root；admin-ui/types 是 workspace 内部包）
- **数据库变更**：无
- **计划外偏离**（3 处全部 reviewer 判定合理）：
  - 不创建 `.eslintrc.json`：与 apps/server / apps/web-next 一致依赖 next lint 默认配置
  - 不改 `docker/docker-compose.dev.yml`：仅 nginx 容器，三进程在 host 跑，无"添加 service"对应；nginx upstream 切流是 M-SN-7 cutover (ADR-101) 工作
  - `next.config.ts` 而非 `.mjs`：与 web-next/server 模板一致
- **smoke 验证**：
  - `npm run dev:server-next` 起服 :3003 成功
  - `/admin/` → 308 → `/admin` 200，body 含 "Hello server-next"
  - `/` → 307 → `/admin`
  - typecheck / lint (4/4) / 1760 tests 全绿
- **注意事项**：
  - design-tokens 接入 / Provider 移植 / 27 路由 / apiClient 留待 CHG-SN-1-03~06
  - admin-ui workspace 已在 deps 列出，确保 M-SN-2 业务原语下沉时 import 立即可用

---

## [CHG-SN-1-01] packages/admin-ui 空骨架 + workspaces 追加

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 02:30
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS
- **修改文件**：
  - `packages/admin-ui/package.json`（新建）— @resovo/admin-ui@0.1.0 / private / main src/index.ts / exports + devDependencies typescript
  - `packages/admin-ui/tsconfig.json`（新建）— 沿用 packages/types 模板 + jsx: preserve + src/**/*.tsx include（M-SN-2 React 组件准备）
  - `packages/admin-ui/src/index.ts`（新建）— 仅 `export {};` 占位
  - `package.json`（修改）— workspaces 追加 `packages/admin-ui`（字母序）
  - `package-lock.json`（npm install 自然产物）
- **新增依赖**：无（仅 devDependencies typescript: "*"，已存在于 root）
- **数据库变更**：无
- **注意事项**：
  - admin-ui 当前为空骨架，禁止在 M-SN-1 内部塞业务组件（M-SN-2 起步）
  - tsconfig 提前配 jsx: preserve 是 reviewer 判定合理的微扩展（不阻塞任何后续）
  - M-SN-1 后续卡（02–08）按序列计划继续

---
