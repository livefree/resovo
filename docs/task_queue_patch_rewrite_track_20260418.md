# Resovo — 重写期应用并行路线补丁（apps/*-next/）（2026-04-18）

> status: patch
> owner: @planning
> scope: (1) 新增 SEQ-20260418-RW-SETUP 任务链（3 张卡，M1 完后启动）；(2) M2 起里程碑任务模板改版；(3) apps/*-next/ 目录约定；(4) middleware 路由切分协议（ADR-035）；(5) M6 末目录 rename 协议
> target_files: `docs/task-queue.md`、`docs/rules/workflow-rules.md`、`docs/architecture.md`、（RW-SETUP 执行时）`package.json`、`tsconfig.json`、`playwright.config.ts`、`scripts/test-guarded.ts`、`scripts/verify-baseline.ts`
> append_only: yes（task-queue.md 追加 RW-SETUP 序列；workflow-rules 追加「重写期目录约定」章节）
> last_reviewed: 2026-04-18
> trigger_reason: 前端「重构后出现大量错误」+ M2–M6 将整体重写前端三应用；原地改 apps/web/ 的半新半旧中间态已被证明不可控。采纳 apps/web-next/ 并行路线，旧应用保持生产可用，新应用逐里程碑搭建，M6 末目录 rename。本补丁规定路线的目录约定、路由切分、E2E 生长协议、里程碑任务模板

---

## 一、决策要点

1. **目录并行**：新建 `apps/web-next/`、`apps/admin-next/`、`apps/server-next/`，与旧 `apps/web/`、`apps/admin/`、`apps/server/` 同时存在
2. **路由切分**：Next.js middleware 按 ALLOWLIST 把已迁移路由转发到 -next/，其他路由继续走旧应用（ADR-035 细化）
3. **E2E 并行**：新增 `tests/e2e-next/` 目录与对应 playwright project，新 spec 与新组件同步生长
4. **里程碑级删除**：每个 milestone（M2 homepage、M3 player、M4 auth、M5 弹幕+search、M6 admin）完成时同步删除旧 suite + 旧组件对应路由 + middleware ALLOWLIST 追加
5. **M6 末目录 rename**：`git mv apps/web-next apps/web`（以及 admin-next、server-next）

---

## 二、目录结构与阶段模型

### 2.1 最终目录结构（M1 完成 + RW-SETUP 完成后）

```
apps/
  web/              # 旧前端，只读（除部署配置 / deprecation 标注外不接受业务改动）
  web-next/         # 新前端，M2 起逐块生长
  admin/            # 旧后台，只读
  admin-next/       # 新后台，M6 启动
  server/           # 旧 Next.js server，只读
  server-next/      # 新 server，触发时机观察 web-next 稳定后
  api/              # 后端 API，不变（1007 unit 覆盖稳定）

packages/
  design-tokens/    # M1 产出，web-next / admin-next 消费
  player/           # 核心播放器，M3 时被 web-next 消费
  types/            # 共享类型，双侧消费

tests/
  e2e/              # 旧 E2E，LEGACY SNAPSHOT，M2–M6 逐块删除
  e2e-next/         # 新 E2E，与 apps/*-next/ 对齐
  unit/             # 单元测试，独立于重写节奏
```

### 2.2 阶段模型

```
M1      │ packages/design-tokens/ 完成（TOKEN-01..06）
        │ apps/web-next/ 尚未创建
        │
RW-SETUP│ apps/web-next/ scaffold + middleware 路由切分协议 + tests/e2e-next/ + playwright project
        │ 可与 M1 TOKEN-01..06 并行推进
        │
M2      │ apps/web-next/app/[locale]/page.tsx（homepage）
        │ middleware ALLOWLIST 追加 /、/en、/zh、...
        │ 删除：apps/web/src/app/[locale]/page.tsx、apps/web/src/components/HomePage/
        │ 删除：tests/e2e/homepage.spec.ts（+ known_failing 对应 6 条）
        │ 新增：tests/e2e-next/homepage.spec.ts
        │
M3      │ apps/web-next/ player 页 + middleware 接管 /watch/*、/movie/*
        │ 删除：旧 player 实现 + tests/e2e/player.spec.ts（+ known_failing 对应 7 条）
        │ player core 移到 packages/player/ 保留
        │
M4      │ apps/web-next/ auth 页 + middleware 接管 /auth/login、/auth/register、...
        │ 删除：旧 auth + tests/e2e/auth.spec.ts（+ known_failing 对应 15 条）
        │
M5      │ 弹幕（DanmakuBar）在 apps/web-next/ 重新接入；search 页迁移
        │ 删除：tests/e2e/search.spec.ts（+ known_failing 对应 2 条）
        │
M6      │ apps/admin-next/ 全量迁移；middleware 接管 /admin/*
        │ 删除：apps/admin/ + apps/web/ + apps/server/ 全部
        │ 删除：tests/e2e/admin*.spec.ts、publish-flow.spec.ts、video-governance.spec.ts（+ known_failing 对应 24 条）
        │
M6-RENAME │ git mv apps/web-next apps/web（以及 admin-next、server-next）
          │ workflow-rules §重写期基线例外 自动失效，恢复单调收敛协议
          │ 启用 docs/known_failing_tests_phase1.md（基于 post-rename apps/web/）
```

---

## 三、SEQ-20260418-RW-SETUP 任务序列

### 序列头

- 序列状态：⬜ 待开始
- Phase：M1 与 M2 之间的并行里程碑
- 创建时间：2026-04-18
- 包含任务数：3
- 依赖：M1 TOKEN-03 以上完成（至少基础 token 可消费）
- 可否并行：**可以与 M1 TOKEN-01..06 并行**（物理文件无重叠；共享文件冲突遵循 M0.5 并行协议）
- 串行约束：RW-SETUP-01 → RW-SETUP-02 → RW-SETUP-03
- 完成条件：3 张卡 ✅ 已完成 + 合并 main + M2 可立即启动

### 任务卡片

#### RW-SETUP-01 — apps/web-next/ Next.js 14 App Router scaffold

- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：M1 TOKEN-03 以上
- **文件范围**：
  - 新增 `apps/web-next/`（全部，目录从 0 搭建）
  - 修改根 `package.json`（workspaces 追加 `"apps/web-next"`）
  - 修改根 `tsconfig.json`（paths 追加 `@web-next/*`）
  - 新增 `apps/web-next/README.md`（声明目录用途 + 与 apps/web/ 关系）
- **变更内容**：
  - `npx create-next-app@latest apps/web-next --app --typescript --tailwind --no-eslint`（或等价手工搭建，遵守项目既有 eslint/prettier 配置）
  - 接入 `packages/design-tokens`（作为 CSS 变量 import，不硬编码颜色）
  - 接入 `packages/types`（统一类型入口 `@/types`）
  - 配置 i18n（与旧 apps/web/ 的 locale 列表一致：en / zh-CN / ...）
  - 增加占位路由 `app/[locale]/next-placeholder/page.tsx`，内容为一个 design-token 颜色验证页（证明 token 链路通）
  - 配置 dev port：3001（旧 apps/web/ 用 3000）
  - **本卡不**实现任何业务路由（homepage 等留给 M2）
- **验收**：
  - `npm run dev --workspace=apps/web-next` 启动成功
  - 访问 `http://localhost:3001/en/next-placeholder` 返回 200 且显示 token 颜色
  - `npm run typecheck` 包含 apps/web-next/ 且通过
  - `npm run lint` 通过
  - design-tokens 引用链路可见（placeholder 页至少引用一个 token）
  - 根 `package.json` workspaces、`tsconfig.json` paths 更新正确
- **完成备注**：_（AI 填写：必须记录 Next.js 版本、choose scaffold cli 输出、port 配置 commit hash）_

#### RW-SETUP-02 — middleware 路由切分协议 + ADR-035

- **状态**：⬜ 待开始
- **建议模型**：opus（架构决策：影响 M2–M6 所有里程碑 cutover）
- **创建时间**：2026-04-18
- **依赖**：RW-SETUP-01
- **文件范围**：
  - 新增 `apps/web-next/src/middleware.ts`
  - 新增 `apps/web-next/src/config/rewrite-allowlist.ts`（ALLOWLIST 单一真源）
  - 修改部署配置（Vercel / Nginx / 本地 dev reverse-proxy）
  - 追加 `docs/decisions.md` — **ADR-035（路由切分协议）**
  - 更新 `docs/architecture.md`（新增「重写期路由拓扑」章节）
- **变更内容**：
  - **spawn Opus 子代理**评估两方案：
    - **方案 A**（部署层切分）：Nginx / Vercel edge 按 ALLOWLIST 把命中路由转到 apps/web-next/，未命中转 apps/web/。优势：性能无损；劣势：与 dev 环境行为不一致
    - **方案 B**（Next.js middleware 切分）：apps/web-next/ 的 middleware 检测路由，未接管的 307 redirect 到 apps/web/（dev）或不同子域（prod）。优势：dev/prod 一致；劣势：多一次 roundtrip
  - ADR-035 必须含：
    - 决策方案（A/B/A+B 组合）
    - 路由切换粒度（page 级 or route-group 级 or prefix 级）
    - ALLOWLIST 数据结构（数组 + 通配符 or 精确匹配）
    - dev 环境工作流（同时启两个 port / 反代配置）
    - prod cutover 流程（部署步骤 + 灰度 + 回滚）
    - 回滚机制（移除 ALLOWLIST 条目即恢复旧路由）
  - 实现 middleware 或等价部署配置
  - ALLOWLIST 初始为空（`export const REWRITE_ALLOWLIST: string[] = []`）
  - 每个里程碑完成时 append 一条，由里程碑任务卡执行
- **验收**：
  - ADR-035 写入 decisions.md，紧接 ADR-034 排序
  - 空 ALLOWLIST 下，访问 `http://localhost:3000/en` 由旧 apps/web/ 服务，未发生意外重定向
  - 临时把 `/next-placeholder` 加入 ALLOWLIST 测试，该路由切到 apps/web-next/（3001 端口或反代路径）
  - 回滚路径（移除 ALLOWLIST 条目 → 路由回到 apps/web/）本地可复现
  - 架构文档「重写期路由拓扑」章节含一张 ASCII 或 mermaid 拓扑图
- **完成备注**：_（AI 填写：必须记录 Opus 子代理模型 ID、ADR-035 commit hash、选择方案的核心理由）_

#### RW-SETUP-03 — tests/e2e-next/ + playwright project + test-guarded 扩展

- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：RW-SETUP-01、RW-SETUP-02
- **文件范围**：
  - 新增 `tests/e2e-next/`（目录 + README.md 声明用途）
  - 新增 `tests/e2e-next/smoke.spec.ts`（最小 smoke test，访问 next-placeholder 验证 200）
  - 修改 `playwright.config.ts`（追加 project `web-next-chromium`）
  - 修改 `scripts/test-guarded.ts`（E2E 模式时支持三个 project；隔离清单按 `e2e::` vs `e2e-next::` 前缀分桶）
  - 修改 `scripts/verify-baseline.ts`（coverage-report 支持两个 E2E project 并列）
- **变更内容**：
  - `playwright.config.ts` project 列表更新为：
    - `web-chromium`（保留，指向 apps/web/ port 3000，legacy 回归）
    - `admin-chromium`（保留）
    - `web-next-chromium`（新增，指向 apps/web-next/ port 3001）
  - `tests/e2e-next/README.md` 声明：
    - 所有 M2 起新组件的 E2E 测试都落在本目录
    - 命名约定：`<component>.spec.ts`（与旧 e2e/ 同名，因不在同目录不冲突）
    - 与 apps/web-next/ 一一对应
  - `scripts/test-guarded.ts` 更新：
    - collectE2EFailures 按 project 分桶，生成 test_id 前缀：`e2e::`（旧）/ `e2e-next::`（新）
    - 隔离清单 diff 按前缀分桶比较
    - 重写期例外下允许「旧前缀条目消失 + 新前缀条目出现」为合法
  - `scripts/verify-baseline.ts --coverage-report` 更新：
    - 接受「两个 project 合并」的 suite 列表
    - 每个 suite 标注 project 归属
- **验收**：
  - `npx playwright test --project=web-next-chromium` 绿（smoke.spec.ts 通过）
  - `npm run test:guarded:e2e` 下三个 project 同时跑，输出合并 diff 报告
  - 模拟 smoke 新失败 → `test:guarded:e2e` 退出码 1
  - 模拟旧 suite 条目与新 suite 条目同时变化 → test-guarded 正确分类
  - coverage-report 显示两个 E2E project 与对应 suite 清单
- **完成备注**：_（AI 填写：必须记录 playwright 版本、三 project 配置 commit hash、test-guarded 扩展前后对比）_

---

## 四、M2 起里程碑任务模板改版

重写里程碑（M2–M6）的任务卡**必须**包含以下字段：

```markdown
#### <TASK-ID> — <任务名>
- 状态 / 建议模型 / 创建时间 / 依赖 / 子任务
- **目录目标**：apps/web-next/ 或 apps/admin-next/（必选其一，**不得**为 apps/web/ / apps/admin/）
- **文件范围**：
  - 新增：apps/web-next/... 或 apps/admin-next/...
  - 删除：apps/web/... 或 apps/admin/...（与新增**同一 commit**）
  - 删除：tests/e2e/<suite>.spec.ts
  - 新增：tests/e2e-next/<suite>.spec.ts（与新组件同步）
  - 修改：apps/web-next/src/config/rewrite-allowlist.ts（追加对应路由）
- **E2E 生存规则**：本卡完成后旧 suite 整份删除；新 suite 纳入 playwright web-next-chromium project
- **隔离清单操作**：known_failing_tests_phase0.md 中对应 suite 条目全部删除；新 suite 首次采集失败按 Phase 基线测试条款逐条处置
- **路由切分操作**：middleware ALLOWLIST 追加对应路由 prefix（与组件同 commit）
- **回滚条件**：新组件上线 48 小时内关键路径 error rate > 基线 + X%，ALLOWLIST 回退该路由
- **完成备注**：_（AI 填写：含旧 suite 删除数、known_failing 删除行号、ALLOWLIST 变更 diff）_
```

### 4.1 M2 起点卡骨架（示例）

```markdown
#### M2-HOMEPAGE-01 — apps/web-next/ homepage 路由实现
- 状态：⬜ 待开始
- 建议模型：sonnet（Opus 在首页组件 API 设计若涉及新 props 契约时介入）
- 创建时间：<填入日期>
- 依赖：M1 TOKEN-06 完成、RW-SETUP-03 完成
- 目录目标：apps/web-next/
- 文件范围：
  - 新增：apps/web-next/app/[locale]/page.tsx
  - 新增：apps/web-next/src/components/HomePage/*（首页组件树）
  - 删除：apps/web/src/app/[locale]/page.tsx
  - 删除：apps/web/src/components/HomePage/*
  - 删除：tests/e2e/homepage.spec.ts（14 test, 6 失败）
  - 新增：tests/e2e-next/homepage.spec.ts（按新组件 testid 重写）
  - 修改：apps/web-next/src/config/rewrite-allowlist.ts 追加 `/`、`/en`、`/zh-CN`
  - 修改：docs/known_failing_tests_phase0.md 删除对应 6 条 homepage 条目
- E2E 生存规则：tests/e2e/homepage.spec.ts 整份删除
- 路由切分操作：ALLOWLIST 追加首页 locale 前缀
- 验收：
  - apps/web-next/ 新 homepage 能访问并渲染（包含 design-token 样式）
  - tests/e2e-next/homepage.spec.ts 在 web-next-chromium 通过率 100%
  - 访问 http://prod-url/en 由新 homepage 服务
  - known_failing 清单对应 6 条消失
  - test:guarded:all 通过
```

### 4.2 后续里程碑骨架（M3–M6）

仅列出关键差异，完整卡片由里程碑启动时撰写：

| 里程碑 | 目录目标 | 路由 ALLOWLIST 追加 | 旧 suite 删除 | known_failing 删除数 |
|--------|---------|-------------------|---------------|-------------------|
| M3 player | apps/web-next/ | `/watch/*`、`/movie/*` | tests/e2e/player.spec.ts | 7 条 |
| M4 auth | apps/web-next/ | `/auth/*` | tests/e2e/auth.spec.ts | 15 条 |
| M5 search+弹幕 | apps/web-next/ | `/search` | tests/e2e/search.spec.ts | 2 条 |
| M6 admin | apps/admin-next/ | `/admin/*` | tests/e2e/admin*.spec.ts、publish-flow、video-governance | 24 条 |

M6 完成时 known_failing_tests_phase0.md 剩余条目为 0，自然终结。

---

## 五、旧代码删除时机与规则

### 5.1 删除时机

每个里程碑完成时，与新组件**同一 commit** 内删除旧组件。禁止「保留为备份」—— git 历史即备份。

### 5.2 删除范围映射

| 里程碑 | 删除路径 |
|--------|---------|
| M2 homepage | `apps/web/src/app/[locale]/page.tsx`、`apps/web/src/components/HomePage/`、旧 homepage 依赖的 layout 片段 |
| M3 player | `apps/web/src/app/[locale]/{watch,movie}/`、`apps/web/src/components/Player/`（core 已迁至 packages/player/） |
| M4 auth | `apps/web/src/app/[locale]/auth/`、`apps/web/src/components/Auth/` |
| M5 search+弹幕 | `apps/web/src/app/[locale]/search/`、弹幕相关组件 |
| M6 admin + 剩余 | `apps/admin/` 全部、`apps/web/` 剩余、`apps/server/` 全部（若已被 -next 完全接管） |

### 5.3 共享层保留与迁移

下列即使在旧 apps/web/ 内，也必须在对应里程碑删除前迁移：

- **shared component**（`apps/web/src/components/shared/*`）→ M2 起首个需要它的里程碑将其迁移到 `apps/web-next/src/components/shared/`，旧路径标 deprecated
- **lib**（`apps/web/src/lib/*`）→ 通用部分迁入 `packages/types` 或新建 `packages/common`
- **ADR 中记录的决策**（如 `apps/web/src/lib/url-builder/`）→ 迁移后 ADR 附录更新

**禁止**：在 apps/web-next/ 内 import apps/web/ 的任何模块（破坏并行隔离）。每个里程碑完成前核验 `grep -r "apps/web/" apps/web-next/` 无命中。

---

## 六、M6 末目录 rename 协议

M6 全部里程碑完成（所有路由已被 -next/ 接管，旧 apps/web/ / admin/ / server/ 已全部删除）后，新增一张收尾卡：

### M6-RENAME-01 — 目录 rename + 协议失效

- **状态**：⬜ 待开始（M6 完成后创建）
- **建议模型**：sonnet
- **依赖**：M6 所有业务卡完成 + apps/web/、apps/admin/、apps/server/ 目录已删除（`git ls-files apps/web` 空）
- **文件范围**：
  - `git mv apps/web-next apps/web`
  - `git mv apps/admin-next apps/admin`
  - `git mv apps/server-next apps/server`（若已创建）
  - 修改根 `package.json` workspaces
  - 修改根 `tsconfig.json` paths（`@web-next/*` → `@web/*`）
  - 修改 `playwright.config.ts`（`web-next-chromium` project 改回 `web-chromium`，port 3001 → 3000）
  - 修改 `scripts/test-guarded.ts`（移除前缀分桶逻辑，恢复单 E2E project 路径）
  - 修改部署配置（移除 ALLOWLIST 与 route split，直接指向新 apps/web/）
  - 修改 `docs/rules/workflow-rules.md`（移除或标注作废「重写期测试基线例外」「重写期目录约定」）
  - 启用 `docs/known_failing_tests_phase1.md`（基于 post-rename apps/web/ 重新采集基线）
- **验收**：
  - `npm run typecheck` 通过
  - `npm run test:e2e` 通过（project 名统一 web-chromium）
  - `git log --follow apps/web/app/[locale]/page.tsx` 能追溯到 M2 时期创建 commit
  - 部署切换无停机（ALLOWLIST 移除即生效，路由已全部在新 apps/web/）
  - workflow-rules 两条重写期条款已失效
  - known_failing_tests_phase1.md 已生成并采集到重新稳态下的基线
- **完成备注**：_（AI 填写：必须记录 rename commit hash、典型文件的 git log --follow 输出、部署切换时间点）_

---

## 七、workflow-rules 追加：重写期目录约定章节

### 7.1 插入位置

在 workflow-rules.md 「重写期测试基线例外」（补丁 #1 §3.2 插入）之后，追加：

### 7.2 章节内容

```markdown
## 重写期目录约定

自 2026-04-18 起至 M6 完成期间，应用目录遵循双并行约定：

1. **新代码去向**：所有 M2 起的业务改动必须落入 `apps/*-next/`，**禁止**修改 `apps/web/`、`apps/admin/`、`apps/server/`（除路由切分配置与 deprecation 标注外）
2. **路由切分协议**：`apps/web-next/src/config/rewrite-allowlist.ts` 是旧/新路由切换的**单一真源**（ADR-035）
3. **E2E 目录约定**：旧 E2E 在 `tests/e2e/`（LEGACY SNAPSHOT，逐块删除）；新 E2E 在 `tests/e2e-next/`；test-guarded 按 project 区分
4. **M6 末目录 rename**：`apps/*-next → apps/*`（M6-RENAME-01 专门处理），本条约定随之失效

### 禁止

- ❌ 在 `apps/web/` 内新增业务组件 / 修复旧组件 testid（旧代码冻结）
- ❌ 在 `apps/web-next/` 内 import `apps/web/` 的任何模块（破坏并行隔离）
- ❌ 跳过 middleware ALLOWLIST 直接从 apps/web/ link 到 apps/web-next/ 页面
- ❌ 在 `tests/e2e/` 下新增测试（新测试全部去 `tests/e2e-next/`）
- ❌ 拖延旧代码删除（里程碑完成必须同 commit 删旧 + 加新）

### 衔接

本章节与「重写期测试基线例外」联动生效、联动失效。M6-RENAME-01 完成时两条同步标注作废，项目恢复单目录单基线稳态。
```

---

## 八、与 M1 的并行执行约束

- **RW-SETUP-01..03 可与 M1 TOKEN-01..06 并行**（物理文件无重叠）
- **共享文件冲突**（package.json workspaces / tsconfig paths）遵循 M0.5 补丁 §5.3 并行协议：
  - 任一会话写入前 `git pull --rebase`
  - 写入后立即 commit + push + 通知对方
- **TOKEN-07 起必须等 RW-SETUP 完成**（因 TOKEN-07 需要应用端 UI 消费验证）
- **M2 启动条件**：
  - M1 TOKEN-01..06 全部 ✅
  - RW-SETUP-01..03 全部 ✅
  - Phase 0.5 闭幕修订已落盘（补丁 #1 §5）

---

## 九、风险与降级

### 9.1 主要风险

| 风险 | 缓解 |
|------|------|
| middleware 路由切分在 prod 环境失败 | RW-SETUP-02 强制 Opus 审阅；prod cutover 前 staging 全量验证；每个 ALLOWLIST 追加都附回滚步骤 |
| apps/web-next/ 与 apps/web/ 共享 i18n / cookie / 域名产生 state 污染 | RW-SETUP-01 强制同 locale 列表；cookie path 统一；ADR-035 明示边界 |
| 旧组件 shared 层被新应用 import 导致「删不掉」 | §5.3 强制迁移协议；每个 milestone 完成前核验 `grep apps/web apps/web-next` 无命中 |
| 并行两份 app 部署成本翻倍 | 单实例多 worker 或 Vercel 单 deployment 多 project；成本可控 |
| design-tokens 在 apps/web-next/ 与 apps/web/ 版本漂移 | M1 完成后冻结 token 版本；apps/web/ **不**更新 token 消费（其命运是被删除） |

### 9.2 降级方案

若 RW-SETUP-02 opus 审阅判定路由切分在现有部署基础设施不可行：

- **方案 γ**（大爆炸式）：apps/*-next/ 在 M2–M6 期间**仅 staging 可见**，M6 末直接 `rm -rf apps/web/ && git mv apps/web-next apps/web` 一次性切换
- 代价：M2–M5 期间新代码无法生产上线，用户体验改进推迟至 M6
- 节奏拉长但架构清晰度最高

降级决定写入 `docs/changelog.md` + ADR-035 备注。

---

## 十、执行顺序摘要

| 步骤 | 任务 | 模型 | 依赖 | 可并行于 |
|------|------|------|------|---------|
| 1 | 落盘本补丁（追加到 task-queue.md） | haiku | — | — |
| 2 | M1 TOKEN-01..06 | 按 M1 原卡 | — | RW-SETUP-01..03 |
| 3 | RW-SETUP-01 scaffold | sonnet | TOKEN-03+ | 其他 M1 卡 |
| 4 | RW-SETUP-02 路由协议 + ADR-035 | opus | RW-SETUP-01 | 其他 M1 卡 |
| 5 | RW-SETUP-03 E2E project | sonnet | RW-SETUP-02 | TOKEN-07 之前 |
| 6 | M2-HOMEPAGE-01 | sonnet | M1 完成 + RW-SETUP 完成 | — |
| ... | M3 / M4 / M5 / M6 | 按模板 | 前一里程碑 | — |
| N | M6-RENAME-01 | sonnet | M6 全部业务卡 | — |

---

## 十一、本补丁的自我校验

本补丁产出前也经过了补丁 #1 §3.1 确立的「Phase 独立审计员条款」思路 —— 虽然不是 Phase 关闭点，但涉及 M2–M6 所有里程碑的目录形态决定，建议在 RW-SETUP-02（opus 路由协议 ADR）环节顺带由 opus 子代理独立评审本补丁整体路线，产出 review 归档到 `docs/architecture_review_apps_next_20260418.md`。评审未通过前本补丁视为 draft。
