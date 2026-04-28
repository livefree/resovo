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

## [CHG-SN-1-FIX-01] codex P1×2 修复（apiClient token 内存态 + from 净化）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 05:15
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-6) — 首轮 PASS
- **触发**：M-SN-1 闭环后 codex review 提出 2 条 P1：(1) apiClient 无 access token 内存态 → M-SN-2 接入 /admin/* 必 401；(2) LoginForm `from` 未净化 → 登录后可能跳外部 URL
- **修改文件**：
  - `apps/server-next/package.json`（修改）— deps 追加 zustand（ADR-100 预批沿用，apps/server 已用）
  - `apps/server-next/src/stores/authStore.ts`（新建）— 精简版 zustand store + persist；user/accessToken/isLoggedIn；只持久化 user+isLoggedIn（ADR-003）
  - `apps/server-next/src/lib/api-client.ts`（重写）— 注入 Bearer token + 401 自动 refresh + retry（_isRetry 防循环 / refreshPromise 防并发）；refresh 失败 → handleUnauthorized → store.logout + 跳 /login（保留 from）
  - `apps/server-next/src/lib/safe-redirect.ts`（新建）— sanitizeAdminRedirect 函数（5 条规则：非空 / 控制字符+反斜杠拒绝 / 单 `/` 开头但非 `//` / `/admin` 前缀白名单 / fallback `/admin`）
  - `apps/server-next/src/app/login/LoginForm.tsx`（修改）— callbackUrl 走 sanitizeAdminRedirect；登录成功 useAuthStore.login(user, accessToken)；apiClient.post 传 skipAuth: true
  - `tests/unit/server-next/safe-redirect.test.ts`（新建，13 tests）— 5 合法白名单 + 8 OWASP 攻击向量
- **新增依赖**：无新引入（zustand 已是技术栈内，apps/server / apps/web-next 都在用，ADR-100"沿用 zustand"）
- **数据库变更**：无
- **回归**：typecheck (7 ws) / lint (4/4) / verify-server-next-isolation (36 文件 0 违规) / 1781 tests (1768 + 13 new) 全绿
- **OWASP open-redirect 防护覆盖**（safe-redirect 单测 13/13 PASS）：
  - 协议 URL：https / http / javascript: / data: → fallback /admin
  - protocol-relative：`//host` → fallback
  - 反斜杠绕过：`/\\evil.com` / `\\\\evil.com` → fallback
  - 前缀欺骗：`/administrative-evil` / `/admin-evil` → fallback
  - 控制字符注入：`\\n` Set-Cookie / `\\r` / `\\x00` → fallback
  - 非 admin 路径：`/login` / `/403` / 公开页 → fallback
  - 相对路径：`admin` / `../admin` → fallback
- **401 refresh + retry 链路**：
  - 内存有 token：直接走 Bearer
  - 内存无 token（页面刷新）/ 过期 → 401 → tryRefresh（HttpOnly cookie）→ setAccessToken → retry 一次
  - refresh 失败 → handleUnauthorized → store.logout + window.location.assign(/login?from=<sanitized>)
- **注意事项**：
  - tryRestoreSession 主动恢复未实装（M-SN-3 业务卡按需启用；当前 401-driven 已覆盖）
  - apps/api `authenticate` 插件仅接受 Bearer token，无 cookie 兼容性问题
  - reviewer 判定 PASS 0 MUST 偏差

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

## [CHG-SN-1-10] plan §7 IA tree 与设计稿 v2.1 shell.jsx 对账修订 + ADR-100 IA 修订段（v0 → v1）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 18:40
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — IA 决策强制 Opus，独立审计 4 项偏离并裁决
- **触发**：M-SN-1 闭环（B 级 PASS）后人工对 :3003 实测发现 admin-nav.ts（CHG-SN-1-05 落地）与设计稿 v2.1 shell.jsx 在命名/分组/暴露策略 4 项偏离，且 plan §7 自身亦偏离设计稿；M-SN-2 启动前必须闭环（SEQ-20260428-02 任务 1/4）
- **修改文件**：
  - `docs/server_next_plan_20260427.md`：
    - 顶部元信息（version v2 → v2.2 / generated_at 加 v2.1/v2.2）
    - §7 IA tree fenced code block（行 519-560）重写为 5 组结构 + hidden 隐藏组 + IA v1 修订点说明
    - §7 视图数表（行 563-587）新增"侧栏暴露数"列；保持 21 路由占位总数 / 侧栏暴露 13 顶层 → 10 项链接
    - §10.7 设计稿大改应急追加 IA v1 修订完成勾项 + cutover 对账义务交叉引用 ADR-100
    - 末尾追加修订日志 v2.1 → v2.2 段（4 项决策一览 + 后续卡链 + 元信息）
  - `docs/decisions.md`：
    - ADR-100 末尾追加 "IA 修订段（v0 → v1，2026-04-28）" 完整段落（4 项决策表 / 影响范围 / 不变约束 / 剩余差异 / cutover 对账义务 / 关联卡）
- **4 项决策**（Opus arch-reviewer 裁决）：
  - **IA-1** dashboard label "工作台" → **"管理台站"**（设计稿 shell.jsx:12 + info.md §01/§03 显式声明）
  - **IA-2** analytics 路由保留，**侧栏不暴露**；M-SN-3 起内容并入 dashboard 内部 Tab/卡片库（不变约束禁止删 URL）
  - **IA-3** home + submissions **独立成"首页运营"组**（从系统管理剥离；shell.jsx:22-25 显式分组）
  - **IA-4** system 5 子（settings/cache/monitor/config/migration）侧栏只暴露 **"站点设置"（⌘,）**；其余 4 子路由保留作 settings 容器 Tab（M-SN-3 实装容器化）
- **不变约束**：URL slug 不动（plan §5.2 BLOCKER 第 8 条仍生效）/ 路由占位文件不删 / 不引入 M-SN-1 已闭环资产返工 / Resovo 价值排序顺序不变
- **新增依赖**：无（纯 docs 改动）
- **数据库变更**：无
- **回归**：typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests（152 files）全绿
- **后续卡链**（SEQ-20260428-02 task 2-5）：
  - CHG-SN-1-11：admin-nav.ts ADMIN_NAV 常量改写 + 5 个 hidden 路由文件 head 注释
  - CHG-SN-1-12：plan §6 M-SN-2 范围补列 admin-ui Shell 组件
  - CHG-SN-1-09：token 跨域守卫 string 级（M-SN-1 闭环原欠账）
  - CHG-SN-1-13：changelog + handoff 补丁（IA 漏检追溯）
- **剩余差异**（cutover 前最终对账义务，详见 ADR-100 IA 修订段 → 剩余差异）：
  - icon 字段缺失（M-SN-2 Sidebar 组件下沉补）
  - shortcut 字段缺失（M-SN-2 同步补）
  - count / type 角标 provider 接口（M-SN-2 设计）
- **注意事项**：
  - admin-nav.ts 实施在 CHG-SN-1-11，本卡仅落 plan/ADR 文本（不动代码）
  - hidden 5 路由文件物理保留，head 注释由 CHG-SN-1-11 补
  - cutover（M-SN-7）前置义务：拉取设计稿最新版本 shell.jsx，三方 diff 后对每条偏离做"采纳/拒绝并立 ADR"裁决，写入 manual_qa_m_sn_7_*.md IA 章节

---

## [CHG-SN-1-11] admin-nav.ts IA v1 实施 + 5 个 hidden 路由 head 注释（CHG-SN-1-05 偏离闭环）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 19:15
- **执行模型**：claude-opus-4-7（沿用本会话主循环未切换；任务建议模型 sonnet 因数据修订无架构决策）
- **子代理**：无（CHG-SN-1-10 Opus 评审已固化 4 项决策与常量值，本卡纯实施）
- **触发**：CHG-SN-1-10（commit da1dafa）落盘 plan §7 v2.2 + ADR-100 IA 修订段后，按 ADR-100 IA 修订段第 4 节"修订后 admin-nav.ts ADMIN_NAV 常量值"实施代码层面修订
- **修改文件**：
  - `apps/server-next/src/lib/admin-nav.ts`（重写）：
    - 头注释从 IA v0 改为 IA v1；新增真源链（shell.jsx → ADR-100 → plan §7 v2.2）+ 4 项决策摘要 + 侧栏暴露策略说明
    - ADMIN_NAV 常量重排为 5 组（运营中心 / 内容资产 / 首页运营 / 采集中心 / 系统管理）
    - dashboard label "工作台" → "管理台站"
    - 系统管理组从 6 项（首页编辑/用户投稿/数据看板/用户管理/审计日志/系统父项 5 子）缩减为 3 项（用户管理/站点设置/审计日志）
    - 首页编辑 + 用户投稿 上移独立成"首页运营"组
    - analytics 项删除（路由保留但侧栏不暴露）
    - system 父项删除 children；侧栏只暴露"站点设置"指向 `/admin/system/settings`
    - flattenAdminRoutes 函数保持不变（向后兼容；children 字段虽未使用但保留 type 签名以兼容未来扩展）
  - `apps/server-next/src/app/admin/page.tsx`：dashboard PlaceholderPage title "工作台 · Dashboard" → "管理台站 · Dashboard"；milestone 文案补 M-SN-3 承接 analytics 内容说明
  - `apps/server-next/src/app/not-found.tsx`：链接文案"返回工作台" → "返回管理台站"；说明文案"IA v0" → "IA v1"
  - `apps/server-next/src/app/admin/analytics/page.tsx`：head 注释加 hidden in IA v1（IA-2）+ M-SN-3 内容并入 dashboard 说明；title 后缀加 "· hidden in IA v1"
  - `apps/server-next/src/app/admin/system/cache/page.tsx`：head 注释加 hidden in IA v1（IA-4）+ M-SN-3 改造为 settings 容器 Tab 面板说明
  - `apps/server-next/src/app/admin/system/monitor/page.tsx`：同上
  - `apps/server-next/src/app/admin/system/config/page.tsx`：同上
  - `apps/server-next/src/app/admin/system/migration/page.tsx`：同上
- **新增依赖**：无
- **数据库变更**：无
- **验收实测**：
  - admin-nav.ts ADMIN_NAV 5 组结构与 ADR-100 IA 修订段第 4 节常量值 1:1 对照（7 个 admin-nav 暴露项 + system/settings 1 项 = 10 项侧栏链接、9 顶层 + 1 system 子）
  - "工作台" UI 文案 0 命中（admin-nav.ts:30 注释中的修订记录有意保留作审计追溯；属 IA-1 决策的"WHY 非显然"注释）
  - 21 路由全部 SSR 通过（19 admin 路由 307→/login 鉴权重定向 / /login + /403 各 200）
  - typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests（152 files）全绿
- **不变约束验证**：
  - 路由 URL 0 改动（grep `apps/server-next/src/app` 路径树未变）
  - 5 个 hidden 路由文件物理保留
  - layout.tsx DOM 结构未改（仍极简骨架，brand / 折叠 / 用户菜单 等待 M-SN-2 admin-ui Shell 下沉）
  - M-SN-1 闭环资产（token / Provider / apiClient / 鉴权层）零改动
- **注意事项**：
  - 视觉层面侧栏渲染需登录后用户实测；CLI 鉴权重定向遮蔽了 layout 渲染输出，已通过 typecheck + admin-nav.ts 与 ADR-100 IA 修订段常量值 1:1 对照间接验证
  - children 字段当前 ADMIN_NAV 内 0 使用（system 父项已被替换为站点设置单项），但 AdminNavItem 类型保留 children 以兼容 M-SN-3 后续扩展（如 settings 容器内的子 Tab 路由树）；如 M-SN-2 Sidebar 组件下沉后确认不需要 children 字段，由 ADR 流程裁决移除
  - 5 个 hidden 路由的 PlaceholderPage title 后缀加 "· hidden in IA v1" 是显式标注，便于直链访问的运维同学识别（M-SN-3 改造 Tab 容器后该标注按需移除）
  - `/admin/system` landing 页（page.tsx 物理存在）当前仍为 PlaceholderPage；侧栏不再有"系统"父项指向它；M-SN-3 阶段改 redirect 到 `/admin/system/settings`（防止裸访问产生孤儿页）— 已记入 ADR-100 IA 修订段"影响范围 / M-SN-3 落地任务"

---

## [CHG-SN-1-12] plan §6 M-SN-2 范围扩列 admin-ui Shell + §8 复用矩阵 admin-layout 列拆分（v2.2 → v2.3）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 19:55
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — Shell 公开 API 契约决策强制 Opus（CLAUDE.md 模型路由第 1/3 项）
- **人工 sign-off**：用户 2026-04-28 接受 4 项决策（Q1-Q4 全部确认）— 触发 plan §0 SHOULD-4-a 重大修订协议
- **触发**：M-SN-2 启动前发现 plan §6 M-SN-2 范围未列 Shell 编排层组件（10 个），与 layout.tsx 注释口径"完整 shell 下沉到 packages/admin-ui Shell"+ ADR-100 IA 修订段"剩余差异 → M-SN-2 处理"声明形成口径冲突。SEQ-20260428-02 任务 3/4
- **修改文件**：
  - `docs/server_next_plan_20260427.md`：
    - 顶部元信息（version v2.2 → v2.3 / generated_at 加 v2.3）
    - §3 决策表新增"M-SN-2 范围扩列 Shell"行
    - §6 M-SN-2 范围（行 404-419）重写为 A/B/C/D 四块结构（Shell 10 组件 + 数据原语沿用 + 公开 API 契约前置 + 演示页）；工时 2.5w → 3w（+20%，未触发 BLOCKER 11）
    - §6 工时表（M-SN-2 列 2.5 → 3.0；累计 5.0 → 5.5；后续累计列全部 +0.5；总周期 17.5w → 18.0w）
    - §6 总周期声明（17.5 周 → 18.0 周）
    - §8 复用矩阵 admin-layout 列拆为 admin-layout token + Shell 两列；19 admin/* 视图 Shell 列 ✅；login 不进 Shell；system 4 子标"（settings 容器内）"
    - §9 ADR 索引：ADR-103 拆为 ADR-103（DataTable v2 API 契约）+ ADR-103a（Shell 公开 API 契约 — 新增）
    - 末尾追加修订日志 v2.2 → v2.3 段（4 项决策一览 + 后续卡链 + 元信息）
- **4 项决策**（Opus arch-reviewer 裁决 + 用户 sign-off）：
  - **Shell-1** 10 组件公开导出（AdminShell / Sidebar / Topbar / UserMenu / NotificationDrawer / TaskDrawer / CommandPalette / ToastViewport+useToast / HealthBadge / Breadcrumbs / KeyboardShortcuts）+ Props 类型骨架固化
  - **Shell-2** AdminNavItem 5 字段扩展（icon: ReactNode / count + AdminNavCountProvider 接口 / badge: 'info'|'warn'|'danger' / shortcut: 'mod+x' 规范化 / children）；不引入 id（href 已唯一）
  - **Shell-3** 工时方案 B：2.5w → 3w（+20%）；保持单 milestone（不拆 M-SN-2.5）；总周期 17.5w → 18.0w
  - **Shell-4** §8 复用矩阵 admin-layout 列拆为 admin-layout token + Shell 两列
- **不变约束**：Provider 不下沉（packages/admin-ui 零 BrandProvider/ThemeProvider 声明，ToastViewport 用 zustand 单例非 Context）/ Edge Runtime 兼容 / 零硬编码颜色 / URL slug 不动 / M-SN-1 闭环资产零返工
- **新增依赖**：无（zustand 已在白名单 / lucide-react 由 server-next 应用层 import；packages/admin-ui 零图标库依赖）
- **数据库变更**：无
- **回归**：typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests（152 files）全绿
- **后续卡链**（M-SN-2 启动后）：
  - CHG-SN-2-01：ADR-103a 起草（Shell 公开 API 契约 + AdminNavItem 5 字段扩展协议 + 4 级 z-index 规范）— Opus 评审 PASS 是 M-SN-2 第一张组件卡前置
  - CHG-SN-2-02：admin-nav.ts 5 字段扩展 + ADMIN_NAV 改写注入 icon / shortcut
  - CHG-SN-2-03 ~ CHG-SN-2-12：Shell 10 组件分卡实施（依赖序：ToastViewport → KeyboardShortcuts → Breadcrumbs → HealthBadge → UserMenu → Sidebar → Topbar → 双 Drawer → CommandPalette → AdminShell 装配）
  - CHG-SN-2-13 ~ CHG-SN-2-20：数据原语层（DataTable v2 + 5 原语 + Storybook demo）
  - CHG-SN-2-21：M-SN-2 milestone Opus 阶段审计
- **风险与对账义务**（详见 Opus 评审第 7 段 + ADR-103a 草案）：
  - shell.jsx 设计稿 §08 弹层规范仍在补完，ADR-103a 起草前主循环再拉一次设计稿对账（避免交互形态变更：Drawer vs Popover）
  - "切换账号"菜单项设为可选（server-next 鉴权层不支持多账号；undefined 时菜单项隐藏）
  - 4 级 z-index 规范（业务 Drawer < Shell 抽屉 < CmdK < Toast）由 admin-layout token 第 5 层提供 z-shell-drawer / z-shell-cmdk / z-shell-toast 三个变量（ADR-103a 内显式声明）
  - cutover（M-SN-7）前最终对账义务（manual_qa_m_sn_7_*.md "Shell API 契约对账"章节）：ADMIN_NAV 5 字段视觉 1:1 / 键盘快捷键 Mac+非 Mac 双平台验证 / Shell 零硬编码颜色 grep / Provider 不下沉 grep
- **注意事项**：
  - 本卡仅修订 plan，不实施代码（Shell 组件实施在 M-SN-2 起步）
  - ADR-103a 是 M-SN-2 第一张组件卡的硬前置门，不构成本卡留账
  - M-SN-2 第一张组件卡前主循环须再拉一次设计稿 v2.x 最新版做对账（与 ADR-100 IA 修订段 cutover 对账义务呼应）
  - Shell 列在矩阵中为 19 项 ✅（admin/* 全覆盖）；login 独立 layout 仅消费 ToastViewport（ToastViewport 设计为可独立引入，不依赖 AdminShell）
  - system 4 子（cache/monitor/config/migration）通过 settings 容器间接消费 Shell（M-SN-3 容器化时落地）

---

## [CHG-SN-1-09] verify-token-isolation 反向跨域守卫（admin 专属 token name string 级，M-SN-1 闭环原欠账）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 20:35
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — 12 token 清单 / 正则安全性 / 三层守卫闭环 / ADR-103a 评审前置门 PASS
- **触发**：CHG-SN-1-08 milestone 阶段审计 B 级 PASS 备忘明示当前 isolation 守卫是 import path 级，ADR-102 跨域禁令本质是 token name string 级；M-SN-1 闭环原欠账 → SEQ-20260428-02 任务 4 闭环
- **修改文件**：
  - `scripts/verify-token-isolation.mjs`（新建）— admin 专属 token name 反向扫描守卫脚本：
    - 12 个 token name（dual-signal 4 + admin-layout 8）按字符长度降序写入正则，alternation 短路保证最长匹配优先
    - 词边界负向前瞻 `(?![-_a-zA-Z0-9])` 防止前缀短匹配吃掉长 token / 误命中长 token 子串
    - 扫描 apps/web-next/src 内 .ts/.tsx/.css/.scss 文件（152 文件）
    - FAIL 输出含相对路径 + 行号 + 列号 + token 名 + snippet（120 字符）+ 修复指引（提示走 packages/design-tokens base/semantic 升级路径）
    - 自我引用豁免：脚本位于 /scripts/ 不在 SCAN_DIR，FORBIDDEN_TOKENS 数组天然不会被自我命中
    - 守卫边界声明：本脚本守 token name string 级；hex 颜色源由 ESLint no-hardcoded-color 兜底；import path 跨域由 verify-server-next-isolation.mjs 兜底（三层互补）
  - `package.json`（修改）— scripts 追加 `verify:token-isolation`
  - `scripts/preflight.sh`（修改）— [5c/6] 新增 admin 专属 token 反向跨域守卫步骤，与 [5b/6] verify-server-next-isolation 同级
- **守卫的 12 个 admin 专属 token name**（按 ADR-102 第 5 层声明 + CHG-SN-1-08 备忘清单 + Opus 评审验证 1:1 对齐 packages/design-tokens 实装）：
  - **dual-signal**（admin 业务专属语义层）：`--probe` / `--probe-soft` / `--render` / `--render-soft`
  - **admin-layout**（cutover 后 apps/admin 生命周期绑定）：`--sidebar-w` / `--sidebar-w-collapsed` / `--topbar-h` / `--row-h` / `--row-h-compact` / `--col-min-w` / `--density-comfortable` / `--density-compact`
- **新增依赖**：无（纯 Node 内置 fs / path / url，无 TS 编译器依赖；本守卫是 string 级而非 AST 级）
- **数据库变更**：无
- **实测验收**：
  - 当前 apps/web-next/src 152 个 .ts/.tsx/.css/.scss 文件扫描 → 0 命中（ADR-102 第 5 层禁令首次具备 string 级运行时证据）
  - 故意制造 3 处违规（`var(--probe)` / `var(--sidebar-w-collapsed)` / `var(--row-h-compact)`）→ 脚本报错全部捕获；最长匹配优先验证通过（`--sidebar-w-collapsed` 不被 `--sidebar-w` 提前命中；`--row-h-compact` 不被 `--row-h` 提前命中）
  - typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests（152 files）全绿
- **三层守卫闭环**（首次完整建立，符合 ADR-102 跨域禁令完整守卫要求）：
  1. **ESLint `no-restricted-imports`**（IDE / 编译期）— admin-only 包/路径禁用提示
  2. **`verify-server-next-isolation.mjs`**（CI / preflight [5b/6]）— ts-morph 级 import path 守卫，扫 apps/server-next/src
  3. **`verify-token-isolation.mjs`**（CI / preflight [5c/6]）— string 级 token name 反向守卫，扫 apps/web-next/src
- **后续优化登记**（Opus 评审建议非阻断，登记为后续卡处理）：
  - M-SN-2 落地 packages/admin-ui 后增加"反向断言"：admin-layout token 必须至少在 server-next 或 admin-ui 中被消费一次（防止"声明了但无人用"的 dead token 沉淀）
  - `walk()` 函数对点开头文件名的扫描行为（当前一并跳过；未来若 web-next 引入点开头源文件需细化为"仅对目录跳过"）
- **注意事项**：
  - 本卡是 ADR-103 / ADR-103a Opus 评审的硬前置门：M-SN-1 闭环原欠账已偿，**M-SN-2 第一张组件卡（CHG-SN-2-01 ADR-103a Opus 评审）可放行开工**（Opus 评审签字 PASS）
  - 守卫边界已在脚本头部注释显式声明（dual-signal 颜色源 hex 值由 ESLint no-hardcoded-color 兜底，本脚本不重复覆盖）
  - 集成到 preflight 而非 npm run lint 流水线：与 verify-server-next-isolation 同等模式（npm run lint 是 turbo workspace 级 lint，root-level 守卫脚本由 preflight 统一调度，避免破坏 turbo cache）

---

## [CHG-SN-1-13] M-SN-1 闭环补丁：handoff IA 修订追溯 + task-queue 序列闭环 + 截图归档（SEQ-20260428-02 收尾）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 21:00
- **执行模型**：claude-opus-4-7（沿用本会话主循环）
- **子代理**：doc-janitor (claude-haiku-4-5) — 纯文档归档 / 索引更新（CLAUDE.md "强制降 Haiku 子代理"第 1/2/5 条）
- **触发**：SEQ-20260428-02 任务 4/4 收尾；CHG-SN-1-10/-11/-12/-09 全部 PASS（commit da1dafa / 15b3bf7 / 1e6bbb1 / 8975a50）后的"不留口子"闭环签字
- **修改文件**：
  - `docs/server_next_handoff_M-SN-1.md`：新增 §9 "IA 修订追溯（SEQ-20260428-02 闭环，2026-04-28）"段（行 176~238），含触发 / 闭环序列 / 4 项裁决 / plan v2.1 → v2.3 修订履历 / 三层守卫闭环 / 后续 milestone 影响 / 关联文件索引 / 视觉证据（2 张截图）
  - `docs/task-queue.md`：
    - 行 359 M-SN-1 闭环备忘段补"经 SEQ-20260428-02 闭环（2026-04-28）"标记
    - 行 390-396 SEQ-20260428-02 序列状态从 🔄 执行中 → ✅ 已完成；新增"完成时间"+"闭环签字"字段
    - 行 532-536 "不留口子检查清单" 5 项全部勾选 [x]
  - `docs/designs/screenshot/Design_Screenshot 2026-04-28 at 12.31.18.png`（git add 纳入版本控制 — 设计稿 IA 视觉证据）
  - `docs/designs/screenshot/Implement_Screenshot 2026-04-28 at 12.37.00.png`（git add 纳入版本控制 — CHG-SN-1-05 落地实测视觉证据，记录修订前的偏离状态）
- **新增依赖**：无
- **数据库变更**：无
- **回归**：typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests 全绿
- **SEQ-20260428-02 整体闭环签字**：
  - **5 张卡全部 PASS**：CHG-SN-1-10（plan §7 IA v0 → v1 + ADR-100 IA 修订段）/ CHG-SN-1-11（admin-nav.ts 实施）/ CHG-SN-1-12（plan §6 M-SN-2 Shell 扩列 + 总周期 17.5w → 18.0w）/ CHG-SN-1-09（token name string 级守卫）/ CHG-SN-1-13（本卡）
  - **plan 修订**：v2.1 → v2.3（v2.2 = IA tree；v2.3 = M-SN-2 范围扩列 Shell + 总周期 17.5w → 18.0w）
  - **ADR**：ADR-100 IA 修订段（v0 → v1）落盘；ADR-103a（Shell 公开 API 契约 — 新增）登记为 M-SN-2 第一张组件卡硬前置门
  - **三层守卫**：ESLint no-restricted-imports（IDE）+ verify-server-next-isolation（CI/import path）+ verify-token-isolation（CI/token name string）首次完整建立
  - **M-SN-1 原欠账已偿**：token name string 级守卫从 CHG-SN-1-08 备忘记录到 CHG-SN-1-09 落地，闭环
- **M-SN-2 放行声明**：
  - **第一张组件卡（CHG-SN-2-01 ADR-103a Opus 评审）可放行开工**
  - 不留口子检查清单 5/5 全部勾选 [x]
  - 后续 M-SN-2 任务卡按 plan §6 v2.3 范围（A Shell 编排层 + B 数据原语层 + C 公开 API 契约前置 + D 演示页 / 工时 3w）执行
- **注意事项**：
  - 截图（2 张 PNG）作为 IA 漏检追溯的人工实测视觉证据，纳入版本控制（CLAUDE.md "审计类文档必须纳入版本控制"）
  - 本卡是 SEQ-20260428-02 序列的最后一张卡；序列闭环后 task-queue 中本序列段终结，后续工作由新序列承接
  - cutover（M-SN-7）前的最终 IA 对账义务（详见 ADR-100 IA 修订段 / plan §10.7 / handoff §9）仍待 M-SN-7 任务卡执行；本卡仅闭合 M-SN-1 阶段欠账

---

## [CHG-SN-2-01] ADR-103a 起草（packages/admin-ui Shell 公开 API 契约 + AdminNavItem 5 字段扩展协议 + 4 级 z-index 规范）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 22:30
- **执行模型**：claude-opus-4-7
- **子代理**：arch-reviewer (claude-opus-4-7) — ADR 起草强制 Opus（CLAUDE.md 模型路由第 1/3 条）
- **触发**：M-SN-2 第一阶段启动；CHG-SN-1-12 plan v2.3 修订 + ADR-100 IA 修订段"剩余差异 → M-SN-2 处理"承诺兑现；M-SN-2 全部 Shell 组件卡（CHG-SN-2-02 ~ CHG-SN-2-12）的硬前置门
- **修改文件**：
  - `docs/decisions.md`：末尾追加 ADR-103a 完整段落（约 380 行 markdown / 含 10 组件 Props 类型骨架 + AdminNavItem 5 字段扩展协议 + 4 级 z-index 规范 + 7 项替代方案否决 + 后果分析 + 影响文件清单 + 关联）
- **ADR-103a 核心决策**：
  - **Shell 10 组件公开导出**（packages/admin-ui/src/shell/）：AdminShell / Sidebar / Topbar / UserMenu / NotificationDrawer / TaskDrawer / CommandPalette / ToastViewport+useToast / HealthBadge / Breadcrumbs / KeyboardShortcuts；每个组件 Props 全 readonly + `on<Verb>` 事件命名 + union 收敛字面量值域
  - **AdminNavItem 5 字段扩展**：icon: ReactNode（直注，packages/admin-ui 零图标库依赖）/ count: number 静态 + AdminNavCountProvider 运行时（runtime 优先）/ badge: 'info'|'warn'|'danger' union / shortcut: 'mod+x' 规范化字符串（formatShortcut 渲染期映射 ⌘/Ctrl）/ children 保留
  - **4 级 z-index 规范**（具体数值首次落定，100 步进留扩展空隙）：L1 业务 Drawer 1000（components/ 层）/ L2 Shell 抽屉 1100（--z-shell-drawer）/ L3 CmdK 1200（--z-shell-cmdk）/ L4 Toast 1300（--z-shell-toast）；admin-layout token 第 5 层新增 3 子项
  - **4 项硬约束**：Provider 不下沉（zustand 单例 store） / Edge Runtime 兼容（顶层零 window/document/fetch/Cookie/localStorage） / 零硬编码颜色 / 零图标库依赖
  - **cutover 前最终对账义务**：与 ADR-100 IA 修订段呼应；`manual_qa_m_sn_7_*.md` Shell 章节须做 4 张截图对照（折叠/展开 × dark/light）+ AdminNavItem 5 字段覆盖率 ≥80% 验证 + 4 级 z-index 实战层级链验证
- **7 项替代方案已否决**（含理由）：
  - A1 引入 id 字段（双源风险）
  - A2 icon 收 string 名（违反零图标库依赖 / Provider 不下沉）
  - A3 ToastViewport 用 Context Provider（违反 §4.4 + AdminShell 之外独立挂载需求）
  - A4 shortcut 收平台特定字符串（双源 + 跨平台漂移）
  - A5 Shell 内直接 import next/navigation（耦合 + 丧失 Storybook 兼容）
  - A6 z-index 10 步进（步进过窄无中间层扩展空隙）
  - A7 z-index 全部进 admin-layout 命名空间（违反 4+1 层职责划分）
- **新增依赖**：无（纯 docs 改动；zustand 已在 §4.7 白名单）
- **数据库变更**：无
- **回归**：typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests 全绿
- **后续卡链**（SEQ-20260428-03 task 2-N，待逐张起草）：
  - **CHG-SN-2-02**（M-SN-2 第一张组件卡，本 ADR PASS 后即可放行）：admin-nav.ts 5 字段扩展 + ADMIN_NAV 注入 icon/shortcut/badge + admin-layout z-shell-* token 三新增 + verify-token-isolation FORBIDDEN_TOKENS 扩展
  - **CHG-SN-2-03 ~ CHG-SN-2-12**（Shell 10 组件分卡实施，依赖序：ToastViewport → KeyboardShortcuts → Breadcrumbs → HealthBadge → UserMenu → Sidebar → Topbar → 双 Drawer → CommandPalette → AdminShell 装配 + admin layout 替换骨架）
  - **CHG-SN-2-13 ~ CHG-SN-2-20**（数据原语层：DataTable v2 + 5 原语 + Storybook demo）
  - **CHG-SN-2-21**（M-SN-2 milestone 阶段审计）
- **关联 ADR**：ADR-100 IA 修订段（IA-1/2/3/4 决策的剩余差异承接）/ ADR-101（cutover）/ ADR-102 v2.1（admin-layout 第 5 层 + token 字段新增按修订段硬约束 2 — milestone 报备而非 ADR）/ ADR-103（DataTable v2 公开 API 契约 — 同 milestone 平行）
- **关联 plan**：§6 M-SN-2 v2.3 / §4.4 / §4.7 / §4.5 ADR-端点先后协议精神延伸 / §8 复用矩阵 v2.3 / §9 ADR 索引
- **人工 sign-off**：用户 2026-04-28 接受 plan v2.3 4 项决策（CHG-SN-1-12 决议）时已涵盖本 ADR 范围，不再单独取签
- **注意事项**：
  - 本 ADR 是 M-SN-2 全部 Shell 组件卡的硬前置门，已 Opus 评审 PASS；CHG-SN-2-02 起步无阻塞
  - Shell 组件 Props TypeScript 类型骨架可直接复制为 .tsx stub（M-SN-2 各分卡填充 Body）
  - z-index 4 级具体数值（1000/1100/1200/1300）首次落定，业务 Modal/Drawer/Dropdown 在 M-SN-2 数据原语层落地时 cross-check（建议数值：业务 Drawer 1000 / Modal 1000 / AdminDropdown 980）
  - icon ReactNode 直注的副作用：admin-nav.ts 不再纯 JSON 序列化；如未来 RSC payload 显式传 NAV 数据通过 wire 给 client，需另起 ADR 设计 icon 名 → ReactNode 客户端解析层（M-SN-2 不触发）
  - countProvider 同步求值：server-next 应用层须用 RSC/SWR 提前准备 ReadonlyMap；后端实时性需走客户端轮询 / WebSocket（本 ADR 不规定刷新机制，由 M-SN-3+ 业务卡决定）

---

## [fix(CHG-SN-2-01)] ADR-103a 文档质量补强（2 处 P1 契约缺口 + 2 处 P2 口径矛盾）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 23:05
- **执行模型**：claude-opus-4-7
- **子代理**：无（4 处修订均为已识别问题的精确修订，无新决策含量；CHG-SN-2-01 Opus 评审已固化整体架构）
- **触发**：用户复审 CHG-SN-2-01 ADR-103a 文本时识别 4 处契约缺口/口径矛盾，CHG-SN-2-02 起步前必须闭合
- **修改文件**：
  - `docs/decisions.md` ADR-103a 段落（4 处精确修订 + 末尾追加"修订记录 / 2026-04-28 fix(CHG-SN-2-01)"段说明 4 处变更）
- **4 处修订**：
  - **P1-A**（4.1.3 Topbar）：TopbarProps 新增必填 `icons: TopbarIcons`（5 类按钮图标 ReactNode 插槽 — search / theme / notifications / tasks / settings）；新增 `TopbarIcons` 接口导出 + 增段说明 Sidebar/UserMenu 内部图标用内联 SVG 自持，唯有 Topbar 5 类业务图标必须由消费方注入。闭合"零图标库依赖（ADR 4.4-4）"约束与 Topbar 三枚图标渲染需求的契约缺口
  - **P1-B**（4.1.1 AdminShell）：AdminShellProps 新增 `topbarIcons: TopbarIcons`（透传 Topbar）+ `notifications? / tasks?` 数据 + 4 个 action 回调（`onNotificationItemClick? / onMarkAllNotificationsRead? / onCancelTask? / onRetryTask?`）；职责段补"编排 NotificationDrawer + TaskDrawer + Drawer 互斥开闭态"；不做段补"不获取通知/任务数据（消费方 SWR/RSC 注入）"。闭合 AdminShell 编排双 Drawer 时无法通过 props 注入 items 的契约缺口
  - **P2-A**（4.2 AdminNavItem.count）：注释从"静态计数（编译期注入）；运行时优先于 countProvider 的返回"改为"静态计数（编译期回退值）；AdminShellProps.countProvider 的 runtime 返回值优先于本字段"，与 5 字段语义说明表 + plan v2.3 + AdminShellProps.countProvider 注释保持一致
  - **P2-B**（4.1.1 AdminShell + 4.1.3 Topbar）：AdminShell 选定"不做面包屑推断"语义统一。AdminShellProps.crumbs 注释 + activeHref 注释修订；Topbar 4.1.3 职责段补"按 crumbs prop 直接渲染，本组件不调用 inferBreadcrumbs"+ 不做段补"不调用 inferBreadcrumbs"。Breadcrumbs helper（4.1.9）保留为独立可调用工具函数（消费方按需调用），与 AdminShell 解耦
- **新增依赖**：无
- **数据库变更**：无
- **回归**：typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ 1781 unit tests 全绿
- **不变约束**：架构决策（10 组件清单 / 5 字段扩展 / 4 级 z-index / 4 项硬约束）零变更；后续卡链不动；ADR-103a 仍是 M-SN-2 全部 Shell 组件卡的硬前置门
- **后续影响**：CHG-SN-2-02 起步可放行（按修订后的 ADR-103a §4.2 / §4.3 实施）；CHG-SN-2-12 AdminShell 装配时按修订后的 AdminShellProps 注入 topbarIcons + notifications + tasks + 4 个 action 回调
- **注意事项**：
  - 本卡是 ADR 文本质量补强，不是架构修订；commit type 用 `fix` 而非 `chg`（与 plan §0 SHOULD-4-a 重大修订协议无关，无须人工 sign-off）
  - HealthBadge dot 颜色由 HealthSnapshot.*.status 驱动 semantic.status token，不属 icon 注入范畴（与 TopbarIcons 解耦）
  - Sidebar 折叠 chevron + UserMenu 菜单项 icon 用内联 SVG 在 packages/admin-ui 自持（零依赖矢量），不通过 prop 注入 — 这是有意的边界划分，仅 Topbar 5 类业务图标因与设计稿语义强相关必须由消费方注入

---

## [CHG-SN-2-02 · stage 1/2] admin-layout z-shell-* token 三新增 + verify-token-isolation 守卫扩展（ADR-103a §4.3 实施）

- **完成时间**：2026-04-28
- **记录时间**：2026-04-28 23:35
- **执行模型**：claude-opus-4-7
- **子代理**：无（按 ADR-103a §4.3 1:1 实施；CHG-SN-2-01 Opus 评审已固化 token 结构 + 数值 + 引用规则；本卡纯实施 + 单测验证）
- **触发**：CHG-SN-2-02 任务执行中识别 plan §5.2 BLOCKER 第 2 条（lucide-react 不在 §4.7 依赖白名单），任务拆为 stage 1/2（z-index 部分独立合规）+ stage 2/2（BLOCKER 暂停等用户裁定方案 A 解锁）
- **修改文件**：
  - `packages/design-tokens/src/admin-layout/z-index.ts`（新建）— admin shell z-index 4 级层叠规范 token：z-shell-drawer 1100 / z-shell-cmdk 1200 / z-shell-toast 1300；导出 `adminShellZIndex` 常量 + `AdminShellZIndexToken` 类型；header 注释含 ADR-103a §4.3 引用 + 4 级层级不变量声明 + 跨域消费禁令交叉引用
  - `packages/design-tokens/src/admin-layout/index.ts`（修改）— 桶导出追加 `adminShellZIndex` + `AdminShellZIndexToken`
  - `packages/design-tokens/build.ts`（修改）— buildLayoutVars 追加 `adminShellZIndex` 到 admin-layout 组（与 adminShell/adminTable/adminDensity 同级）；buildJs adminLayout 字段追加 adminShellZIndex；buildDts 类型描述追加
  - `packages/design-tokens/scripts/build-css.ts`（修改）— admin-layout 段同步追加 adminShellZIndex（保持 build.ts / build-css.ts 双脚本同步）
  - `packages/design-tokens/src/css/tokens.css`（auto-generated）— 新增 3 行：`--z-shell-drawer: 1100;` / `--z-shell-cmdk: 1200;` / `--z-shell-toast: 1300;`
  - `tests/unit/design-tokens/admin-layout.test.ts`（修改）— 追加 2 测：(1) `adminShellZIndex exposes 3 z-shell-* fields`（结构断言）+ (2) `4-tier ordering: drawer < cmdk < toast`（不变量断言：1100 < 1200 < 1300 且 drawer > 1000 业务 Drawer 层）；admin-layout 单测从 8 → 10 全 PASS
  - `scripts/verify-token-isolation.mjs`（修改）— FORBIDDEN_TOKENS 数组追加 `--z-shell-drawer` / `--z-shell-cmdk` / `--z-shell-toast` 三 token；header 注释更新守卫范围从 12 → 15 个 admin 专属 token；JSDoc 新增 admin-layout z-shell-* 段说明
  - `docs/task-queue.md`（修改）— SEQ-20260428-03 任务 2 状态置 `🟠 PARTIAL · stage 1/2 已完成 / stage 2/2 BLOCKER 暂停`；尾部追加完整 BLOCKER 通知（触发条款 + 已实施部分 + 3 个备选方案 A/B/C + 子决策 C1/C2）
  - `docs/tasks.md`（修改）— CHG-SN-2-02 卡片状态同步 PARTIAL
- **新增依赖**：无（zustand 已在白名单；本 stage 不涉及 lucide-react）
- **数据库变更**：无
- **实测验收**：
  - typecheck（5/5 packages）/ lint（4/4 cached FULL TURBO）/ vitest 1783 tests（152 files；原 1781 + 新增 2 z-shell-* 测）全绿
  - admin-layout 单测从 8 → 10：3 字段结构 + 4 级层级关系不变量（drawer 1100 < cmdk 1200 < toast 1300 + drawer > 1000 业务 Drawer 层）双断言
  - verify-token-isolation 实测：当前 152 文件 0 命中（原 12 token 守卫无回归）；故意制造 3 处违规（`var(--z-shell-drawer)` / `var(--z-shell-cmdk)` / `var(--z-shell-toast)`）→ 脚本 3/3 全部捕获（含行号 + 列号 + token 名 + snippet）
  - tokens.css auto-generated 新增 3 行精确符合 ADR-103a §4.3 数值规范（1100/1200/1300 整数，100 步进）
- **不变约束验证**：
  - 4 级 z-index 层级关系硬编码（drawer < cmdk < toast；drawer > 1000 业务 Drawer 层）由单测断言锁定
  - admin-layout 命名空间收敛（不污染 components/ 层 z-modal 业务 Drawer 范畴）
  - apps/web-next 0 消费（verify-token-isolation 守卫扩展生效）
  - M-SN-1 闭环资产（token / Provider / apiClient / 鉴权层）零返工
- **触发的 BLOCKER 详情**：
  - CHG-SN-2-02 stage 2/2（admin-nav.ts 5 字段类型扩展 + ADMIN_NAV 注入 icon ReactNode + shell-data.ts）依赖 `import { ... } from 'lucide-react'`，但 `lucide-react` 不在 plan §4.7 依赖白名单（行 261-272 预批 + 候选清单），且 root/web-next/server-next 任何 package.json 未声明
  - 已写 BLOCKER 通知到 task-queue.md 尾部（触发条款 + 已实施部分 + 3 个备选方案 + 子决策）
  - 用户裁定：方案 A（补充依赖 ADR + plan §4.7 修订）+ 子决策 C1（先 commit stage 1/2）；本卡为 C1 子决策的落地
- **后续动作**（按方案 A）：
  - 起新卡 **CHG-SN-2-01.5**（或 CHG-SN-2-02b）：spawn Opus arch-reviewer 做图标库选型评审（lucide-react vs heroicons-react vs react-icons 三选一），落盘 ADR-103b（server-next 图标库选型）+ plan §4.7 v2.3 → v2.4 修订（图标库加入预批清单）+ 人工 sign-off（plan §0 SHOULD-4-a 重大修订）
  - PASS 后继续 CHG-SN-2-02 stage 2/2（admin-nav.ts + shell-data.ts + ADMIN_NAV icon 注入）
- **注意事项**：
  - z-index 4 级具体数值（1000/1100/1200/1300）已落定，业务 Modal/Drawer/AdminDropdown 在 M-SN-2 数据原语层落地时（CHG-SN-2-13+）按 ADR-103a §4.3 cross-check 不变量
  - tokens.css 是 auto-generated 产物，未来如修改请通过 build.ts / build-css.ts 同步两份脚本（ADR-102 v2.1 双脚本同步约定）
  - ADR-102 v2.1 修订段硬约束 2：admin-layout 第 5 层 token 字段新增是 milestone 报备而非 ADR；本卡新增 3 字段属合规扩展，无须独立 ADR
  - 本卡是 CHG-SN-2-02 的 stage 1/2；stage 2/2 解锁后 admin-nav.ts + shell-data.ts 由 stage 2/2 commit 完成；CHG-SN-2-02 整卡完成签字在 stage 2/2 末尾
