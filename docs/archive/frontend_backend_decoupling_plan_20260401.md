# Resovo — 前后台彻底解耦实施方案（2026-04-01）

> status: archived
> owner: @engineering
> scope: frontend/admin/backend decoupling and independent deployment
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-04-02
> reviewed_by: AI engineering review
> decisions_confirmed: 2026-04-02

---

## 1. 背景与问题

当前项目虽然在运行上已是 Next.js（3000）+ Fastify（4000）双进程，但代码层仍存在跨层引用，导致前台与后台管理功能无法真正独立演进与部署。

典型耦合点（现状）：

1. 前端页面直接依赖后端实现（Service/DB）。
2. 前端组件与 `api/routes`、`api/services` 类型直接绑定。
3. 后端 service 反向依赖 route 类型，边界方向混乱。

这会造成：

1. 后端内部重构会直接打断前端构建。
2. 前台与后台无法实现独立发布节奏。
3. 后续拆域名、拆项目、拆权限体系成本上升。

---

## 2. 本次目标（必须达成）

1. 将后台管理系统打造为独立控制面板（独立入口、独立部署、独立发布）。
2. 前台作为流量入口，保留公开内容浏览/搜索/播放能力，不承载后台入口。
3. 前台与后台后端业务彻底隔离，前台后端可分离部署。
4. 完成以下产品策略调整：
   - 隐藏前台用户功能：删除前端登录入口，播放页隐藏弹幕模块。
   - 现有登录界面迁移为后台管理入口（管理员登录）。

---

## 3. 非目标（本期不做）

1. 不在本期重建用户体系（注册、普通用户登录、用户中心等）。
2. 不在本期迁移数据库到多库（仍可单库，多 schema/多表域）。
3. 不要求一次性物理拆仓；允许先单仓解耦、后续再拆为多仓。

---

## 4. 目标架构（解耦后）

### 4.1 运行拓扑

1. `public-web`（前台站点）
   - 域名：`www.resovo.tv`
   - 职责：公开内容流量入口（首页/搜索/详情/播放）
   - 不提供登录入口、不提供后台管理入口

2. `admin-console`（后台控制台）
   - 域名：`admin.resovo.tv`
   - 职责：管理员登录、内容治理、采集控制、系统监控
   - 独立部署、独立构建、独立发布

3. `api-core`（业务 API）
   - 域名：`api.resovo.tv`
   - 统一承载业务接口，按命名空间隔离：
     - `/v1/public/*`（前台可用）
     - `/v1/admin/*`（仅后台可用）

### 4.2 代码边界（强约束）

1. 前台代码禁止直接 import `src/api/**`。
2. 后台前端代码禁止直接 import `src/api/**` 实现层。
3. 共享契约仅允许从 `src/types/contracts/**`（后续可迁 `packages/contracts`）引用。
4. 后端层级方向固定为：`routes -> services -> db`，禁止 `services -> routes`。

### 4.3 鉴权边界

1. 管理登录仅存在于 `admin-console`。
2. 管理 token/cookie 的作用域限定 `admin.resovo.tv` 与 `api.resovo.tv`（最小权限策略）。
3. `public-web` 默认匿名访问，不再依赖用户登录态。

---

## 5. 目标目录演进（建议）

短期（单仓）：

1. `apps/public-web`：前台 Next.js
2. `apps/admin-console`：后台 Next.js
3. `services/api-core`：Fastify API
4. `packages/contracts`：前后端共享类型与 schema（zod/openapi）

若本期不做目录迁移，至少先完成逻辑隔离：

1. 新增 `src/types/contracts/v1/`（**审核修订**：明确版本路径，`@/types/index.ts` 保留为前台专用导出层，不重导出后台 contracts 类型）。
2. 清理 `src/app|src/components|src/lib` 对 `src/api/**` 的直接依赖。

---

## 6. 功能调整方案（按需求）

### 6.1 隐藏前台用户功能

1. 前端删除登录入口：
   - Header/Nav 移除“登录/注册/个人中心”入口。
   - 公开页面中所有用户态入口置灰或下线。

2. 播放页面隐藏弹幕模块：
   - 播放页不渲染 `DanmakuBar`（UI 隐藏）。
   - 弹幕相关请求停止触发（避免无效 API 调用）。
   - 保留后端弹幕 API 但不在前台暴露，作为后续用户功能恢复储备。

3. 普通用户认证相关页面处理：
   - `/auth/login`、`/auth/register` 在前台下线。
   - 返回 404 或重定向到首页（按 SEO 策略择一）。

### 6.2 登录界面迁移至后台管理入口

1. 管理登录页面统一为：`admin.resovo.tv/login`。
2. 现有登录表单组件复用，但文案与权限语义改为“管理员登录”。
3. 登录成功后跳转 `admin.resovo.tv/admin`（或 `/dashboard`）。
4. 原前台登录路由保留短期 301/302 过渡到后台登录页（过渡期 2-4 周）。

---

## 7. 分阶段实施计划

## Phase 0（当天可启动）：冻结耦合面

1. 新增 ESLint 规则：禁止 `src/app|src/components|src/lib|src/stores` import `@/api/**`。
   - **⚠️ 审核修订**：初始以 **warn 模式**运行（不阻断构建），同步产出违规清单；Phase 1 修复完毕后升级为 error。原因：`AdminAnalyticsDashboard.tsx`、`CacheManager.tsx` 等已存在违规引用，直接设 error 会即时破坏构建。
2. 建立耦合清单与整改优先级（admin analytics/cache 链路优先）。
3. 建立过渡开关：`NEXT_PUBLIC_ENABLE_USER_FEATURES=false`（默认关闭）。

交付物：

1. lint warn 规则生效，不阻断构建。
2. 耦合清单文档化（违规文件清单 + 修复优先级）。

## Phase 1：契约抽离与依赖纠偏

1. 抽离类型：
   - `AnalyticsData`、`CacheStat`、`CacheType` 从 `src/api/**` 迁移到 `src/types/contracts/admin/**`。
2. 改造引用：
   - 前端仅引用 contracts，不再引用 `src/api/routes|services`。
3. 后端反向依赖修复：
   - `AnalyticsService` 不再 import route 类型，改用 contracts 类型。

交付物：

1. 前端零 `@/api/**` 直接引用（类型与实现都不允许）。
2. typecheck/lint/test 通过。

## Phase 2：管理端入口重构

1. 新增后台登录入口路由（当前单仓内新建 `/admin/login`，独立域名绑定推迟至 Phase 4）。
   - **⚠️ 审核修订**：Phase 2 目标是路由逻辑独立，不要求域名独立。`admin.resovo.tv` 绑定在 Phase 4 完成，二者解耦，避免依赖倒置。
2. 前台移除登录入口和注册入口。
3. 管理态鉴权链路仅在 `/admin/**` 路径下生效。
4. 前台旧登录路由返回 404（**已确认**：不跳转首页）。

交付物：

1. `/admin/login` 独立可用，后台登录链路完整。
2. 前台无用户登录可见入口。

## Phase 3：前台用户能力下线

1. 播放页隐藏 Danmaku UI 与交互。
2. 前台移除用户态 store 的强依赖（按需保留最小兼容代码）。
3. 清理无用 API 客户端方法（用户注册/登录/用户资料）。

交付物：

1. 前台路径全量检查不出现用户入口。
2. 播放流程稳定，无弹幕调用。

## Phase 4：独立部署与发布流水线

1. 分离构建产物：
   - `public-web` 单独 CI/CD
   - `admin-console` 单独 CI/CD
   - `api-core` 单独 CI/CD
2. 环境变量拆分：
   - 前台仅保留 public API 与站点配置。
   - 后台保留 admin API、鉴权、运维变量。
3. 灰度发布：先 admin-console，后 public-web。

交付物：

1. 前台、后台、API 可独立回滚。
2. 任一服务发布失败不阻塞其它服务上线。

---

## 8. 接口与网关策略

1. API 分域 + 分前缀：
   - `public-web` 只允许访问 `/v1/public/*`。
   - `admin-console` 才允许访问 `/v1/admin/*`。
2. 网关/WAF 层限制：
   - `/v1/admin/*` 默认拒绝跨域来源为 `www.resovo.tv`。
3. OpenAPI 输出拆分：`public-openapi.json` 与 `admin-openapi.json`。

---

## 9. 数据与权限策略

1. 用户域数据不删除，仅前台入口隐藏（为后续恢复留资产）。
2. admin 角色与权限体系保持。
3. 审计日志增强：所有后台登录与关键操作记录 `operator_id + ip + ua + trace_id`。

---

## 10. 测试与验收标准

### 10.1 结构验收

1. `public-web` 代码扫描无 `@/api/**` 引用。
2. contracts 成为唯一共享边界。
3. 后端无 `services -> routes` 反向依赖。

### 10.2 功能验收

1. 前台首页/搜索/详情/播放可正常访问。
2. 前台无登录入口、无注册入口、播放页无弹幕模块。
3. `admin.resovo.tv/login` 可登录并进入后台。

### 10.3 部署验收

1. 单独部署 `admin-console` 不影响 `public-web`。
2. 单独部署 `public-web` 不影响 `admin-console`。
3. API 独立扩缩容与回滚可执行。

---

## 11. 风险与回滚

主要风险：

1. 路由迁移期间出现登录态失效或重定向循环。
2. 前台隐藏用户能力后，旧链接产生 404 峰值。
3. contracts 抽离初期类型漂移导致前后端不一致。

回滚策略：

1. 保留 `LEGACY_AUTH_ENTRY=true` 开关，紧急时恢复旧登录入口。
2. 弹幕模块通过 `ENABLE_DANMAKU` 开关灰度下线。
3. contracts 变更必须走版本化（至少按目录版本 `v1` 管理）。

---

## 12. 执行清单（可直接建任务）

1. DEC-01：新增“禁止前端 import `@/api/**`” lint 规则。
2. DEC-02：抽离 `AnalyticsData` 到 contracts。
3. DEC-03：抽离 `CacheStat/CacheType` 到 contracts。
4. DEC-04：修复 `AnalyticsService` 反向依赖 route 类型。
5. DEC-05：下线前台登录/注册入口。
6. DEC-06：播放页隐藏弹幕模块并停止请求。
7. DEC-07：新增后台独立登录入口与跳转链路。
8. DEC-08：前台旧登录路由重定向策略上线。
9. DEC-09：拆分 CI/CD（public/admin/api）。**[Phase 4 子任务索引，不参与 Phase 0-3 排期]**
10. DEC-10：完成独立部署演练与回滚演练。**[Phase 4 子任务索引，不参与 Phase 0-3 排期]**

---

## 13. 决策确认项（已全部确认，2026-04-02）

1. ✅ 前台旧登录路由返回 **404**（不跳转首页）。
2. ✅ 后台入口**不对外公开**，仅运营内部访问；robots.txt 屏蔽 `/admin/**`，任何公开页面不出现后台入口链接。
3. ✅ 用户功能**暂无恢复计划**，用户域数据保留但不设恢复时间窗；前台入口下线后用户数据仅作储备，不删除。

---

## 14. 完成定义（DoD）

满足以下全部条件才算“前后台彻底解耦完成”：

1. 前台构建、后台构建、API 构建三者互不依赖对方源码实现。
2. 前台代码库不再出现后台实现引用。
3. 管理登录入口仅存在于后台域名。
4. 前台用户入口与弹幕模块已下线。
5. 三套服务可独立部署、独立回滚、独立监控。

