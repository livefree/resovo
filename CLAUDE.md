# Resovo（流光） — Claude Code 工作总纲

Resovo 是国际化视频资源聚合索引平台，本身不托管视频，只提供链接索引服务。

**工作模式：全自动推进。** 除非触发暂停条件，否则完成一个任务后立即开始下一个。

---

## 价值排序（所有决策的根本依据）

1. **正确性与稳定性** — 不引入回归、不破坏关键路径、不绕过测试。
2. **边界与复用** — 模块边界清晰，职责单一，优先复用已有共享组件，不重复实现同功能逻辑。
3. **可扩展性** — 类型、路由、配置、筛选条件可增量扩展，不得写死值。
4. **一致性** — 交互、样式、组件使用与现有实现保持统一。
5. **改动收敛（最后约束）** — 满足 1–4 后，控制改动范围。"最小改动"不是首要目标。

**实现前**：确认输入输出契约、状态归属、依赖方向、与现有模块的关系。新建共享组件前先定义 Props 类型。

**实现后**：回答「此次逻辑是否应沉淀到共享层？」是 → 当前任务内完成沉淀；否 → 完成备注中说明理由。

---

## 任务入口规则

**`docs/tasks.md` 是执行任务的唯一入口**，完整流程见 `docs/rules/workflow-rules.md`。

简述：

1. 先检查 task-queue.md 是否有 `🚨 BLOCKER`，有则停止
2. 读 tasks.md，有进行中任务则继续；为空则从 task-queue.md 按优先级取下一个
3. 写入任务卡片到 tasks.md + 更新 task-queue.md 状态，再开始执行

完成后顺序：填写备注 → 更新 task-queue → 删除 tasks.md 卡片 → 追加 changelog → git commit。

---

## 必跑命令

```bash
npm run typecheck        # 必须通过，有报错不得继续
npm run lint             # 必须通过
npm run test -- --run    # 单元测试，必须全部通过
npm run test:e2e         # PLAYER / AUTH / SEARCH / VIDEO 任务完成后运行
```

测试未通过，不得执行 git commit。

---

## 核心架构约束

**后端分层**：Route → Service → DB queries，不得跨层调用。Route 层不含业务逻辑，UI 层不直接调用 DB queries。

**播放器模块**：GlobalPlayerHost（Portal，挂 #global-player-host-portal）管理 full/mini/pip 三态，状态机定义在 `playerStore.hostMode`（LEGAL_TRANSITIONS 守卫）。core 层（packages/player-core）不写业务逻辑；shell 层（PlayerShell）负责编排（字幕/线路/影院模式）。不得硬编码颜色，必须使用 CSS 变量。关键路径（断点续播、线路切换、影院模式、字幕开关）每次涉及必须回归。

**apps/web-next 核心能力层**（REGRESSION 阶段补齐，ADR-037）：

- BrandProvider + useBrand/useTheme：SSR 安全品牌/主题双 Context（`src/contexts/BrandProvider.tsx`）
- middleware 品牌识别：cookie → header（`src/middleware.ts`，ADR-039）
- PageTransition：View Transitions API 三态降级（`src/components/primitives/page-transition/`）
- SharedElement（noop 合约，M5 实装）+ RouteStack（noop stub，M5 实装）
- SafeImage + FallbackCover + image-loader：四级降级链，颜色零硬编码（`src/components/media/`）
- ScrollRestoration + PrefetchOnHover：跨路由记忆 + hover 预取（`src/components/primitives/`）

**共享组件**：同一 UI 模式 3 处以上必须提取。新建前先确认对应应用的共享层无等价实现：
- 前台 web-next：`apps/web-next/src/components/shared/` + `apps/web-next/src/components/primitives/`
- 后台 server-next（当前真源）：`packages/admin-ui/src/components/` + `packages/admin-ui/src/shell/`
- 后台 server v1（已冻结，仅维护期 bug 修复）：`apps/server/src/components/admin/shared/`

接口设计先于实现。

**后台表格**：
- **server-next**（当前真源，CHG-DESIGN-11 / SEQ-20260429-02）：使用 `packages/admin-ui` 的 `DataTable` 一体化组件（`toolbar` / `bulkActions` / `flashRowKeys` / `pagination` 等内置 props），详见 `docs/designs/backend_design_v2.1/reference.md` §4.4 + `docs/rules/admin-module-template.md` 头部 2026-04-30 修订。**禁止**在 server-next 新模块复用 ModernDataTable / 外置 PaginationV2 / 外置 SelectionActionBar 三件套。
- **server v1**（已冻结）：维持 `ModernDataTable` + `ColumnSettingsPanel` + `AdminDropdown` + `SelectionActionBar` + `PaginationV2` + 服务端排序，详见 `docs/rules/admin-module-template.md` v1 章节。仅维护期 bug 修复使用，不作新模块模板。

---

## 质量门禁

每个任务完成前必须通过质量门禁，完整规则见 `docs/rules/quality-gates.md`：

- 开发前输出：问题理解 / 根因判断 / 方案 / 涉及文件
- 开发后输出：六问自检 + 偏离检测 + [AI-CHECK] 结论块
- 同一模块连续 3 次污染 streak → 强制重构评估

---

## 绝对禁止

- ❌ schema 变更不同步 `docs/architecture.md`
- ❌ 引入技术栈以外的新依赖（触发 BLOCKER）
- ❌ 越层调用（Route 含业务逻辑 / UI 直接调 DB）
- ❌ 使用 `any` 类型
- ❌ 空的 catch 块 `catch (e) {}`
- ❌ 硬编码颜色值（必须用 CSS 变量）
- ❌ 测试未通过执行 git commit
- ❌ 跳过 tasks.md 直接修改 task-queue.md 状态
- ❌ 未写任务卡片就开始执行代码
- ❌ 修改任务「文件范围」以外的文件（哪怕顺手优化）
- ❌ 修改 `docs/` 规范文件（除非任务明确标注"更新文档"）
- ❌ 删除或重命名现有 API 路径
- ❌ 在未登录请求路径中访问 `users` 表
- ❌ docs/ 下新文档不执行 `git add`（审计类文档必须纳入版本控制）
- ❌ "最小改动"作为首要依据——未满足价值排序 1–4 时不得以改动范围小绕过架构约束
- ❌ 函数超 80 行非声明性 / 嵌套 3 层 / 多独立逻辑阶段，不先拆分就继续写
- ❌ 文件超 500 行非声明性 / 导出 2+ 主要概念，不先拆分就继续写

---

## 规范文件索引

开始编写代码前，根据任务类型读取对应规范：

| 任务类型     | 规范文件                              | 触发关键词                                                                     |
| ------------ | ------------------------------------- | ------------------------------------------------------------------------------ |
| 所有代码任务 | `docs/rules/code-style.md`            | 任何 TS/TSX 文件改动                                                           |
| 前端组件任务 | `docs/rules/ui-rules.md`              | 组件、CSS 变量、主题、国际化、响应式、Portal、播放器                           |
| API 接口任务 | `docs/rules/api-rules.md`             | Route、Fastify、zod、分页、响应格式、认证中间件                                |
| 数据库任务   | `docs/rules/db-rules.md`              | migration、SQL、query、schema、索引、软删除、事务                              |
| 测试编写     | `docs/rules/test-rules.md`            | Vitest、Playwright、test、spec、覆盖率                                         |
| 后台模块（v1） | `docs/rules/admin-module-template.md` | apps/server v1 维护：ModernDataTable、AdminDropdown、列表页（仅维护期）        |
| 后台模块（v2） | `docs/designs/backend_design_v2.1/reference.md` §4.4 + §10 | server-next 新模块：DataTable 一体化、admin-ui shell、cell 复合组件 |
| 任务工作流   | `docs/rules/workflow-rules.md`        | 开工、选任务、BLOCKER、PHASE COMPLETE                                          |
| Git 提交     | `docs/rules/git-rules.md`             | commit、branch、merge、TASK-ID                                                 |
| 质量门禁     | `docs/rules/quality-gates.md`         | 任务完成前、六问、AI-CHECK、偏离检测                                           |
| 日志相关任务 | `docs/rules/logging-rules.md`         | logger / log / 日志 / pino / request_id / worker job / PII redact / client-log |

---

## 模型路由规则

### 主循环模型选择

- **默认主循环**：`claude-sonnet-4-6`
- 每个任务卡（tasks.md / task-queue.md）的"建议模型"字段指定启动主循环模型（`opus` / `sonnet` / `haiku`）
- 会话启动时人工按照建议传 `--model <完整 ID>`（映射表见 `docs/model_routing_patch_20260418.md` 第 3 节）
- **主循环模型中途不可升级**：执行中发现任务难度高于预期时，必须写 BLOCKER 停止会话，不得擅自 spawn Opus 子代理替主循环做最终决策

### 强制升 Opus 子代理的情形

主循环在以下工作前必须通过 Task 工具 spawn Opus 子代理完成决策后再落地：

1. 定义新的共享组件 API 契约（Props 类型、事件签名、生命周期）
2. 设计跨 3+ 消费方的 schema / migration 字段
3. 撰写即将成为 ADR 的决策文档
4. 重构播放器 core / shell 层的接口
5. 设计 Token 层新增字段的结构与引用规则
6. 高风险 PR 的独立 code review（调用 `arch-reviewer` 预设子代理）

调用模板：

    Task(subagent_type: "arch-reviewer", model: "claude-opus-4-6",
         prompt: "<独立设计任务，自带完整上下文>")

主循环拿到子代理输出后按其结论实施，子代理的模型 ID 必须记入 tasks.md 卡片的"子代理调用"字段。

### 强制降 Haiku 子代理的情形

以下工作应 spawn Haiku 子代理节省成本：

1. 机械性 docstring / typo 修正
2. 文档归档 / 文件移动 / README 索引更新
3. 统一 import 顺序、格式化任务
4. 读取并提取特定文件的结构化信息（纯读不改）
5. 追加模板化 changelog / ADR 条目

### 不得自动切换的情形

1. 任务执行中发现难度高于预期 → 写 BLOCKER，不得继续
2. 主循环直接改写架构决策 → 必须先 spawn Opus 子代理出具方案
3. Sonnet 主循环在未调 Opus 子代理的情况下直接产出新 ADR → 禁止

### 审计要求

每个任务完成时必须记录：

- 主循环模型 ID（完整形式，如 `claude-sonnet-4-6`）
- 本任务中 spawn 的所有子代理及其模型 ID
- 上述信息写入 tasks.md 卡片的"执行模型"与"子代理调用"字段，并同步到 changelog.md 条目和 commit trailer

---

**架构决策**：以下情形必须先查阅 `docs/decisions.md`：播放器架构、视频源处理、搜索方案、认证机制、DB schema 变更、URL 结构设计。

**统一类型入口**：`import type { Video, User, SearchParams, ApiResponse } from '@/types'`

**统一 API 客户端**：`import { apiClient } from '@/lib/api-client'`（前端不得直接使用 fetch）

**文件模板**：新建文件优先使用 `apps/web/src/components/templates/`、`apps/server/src/components/templates/` 和 `apps/api/src/templates/` 下的模板，详见 `TEMPLATES.md`。
