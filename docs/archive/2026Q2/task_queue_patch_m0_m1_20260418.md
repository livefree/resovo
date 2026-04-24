# Resovo — M0 + M1 Task Queue 补丁（2026-04-18）

> status: archived
> owner: @planning
> scope: 全面重写方向落地，M0（前置基线）+ M1（设计系统基石）原子任务队列
> source_of_truth: no
> target_file: `docs/task-queue.md`
> supersedes: none
> superseded_by: docs/task-queue.md
> append_only: yes（按 workflow-rules 尾部追加）
> last_reviewed: 2026-04-24

---

## 一、应用方式

把本补丁「二、序列补丁内容」整段追加到 `docs/task-queue.md` 尾部。追加后整体结构为：

- 现有已完成 / 进行中序列保持不变
- 新增 2 个序列：`SEQ-20260418-M0`、`SEQ-20260418-M1`
- M0 / M1 分别对应 Phase 0 / Phase 1，每个 Phase 完成后按 git-rules 合并 `main` 并输出 PHASE COMPLETE 通知

执行约束：

- 每张卡「建议模型」字段由人工在 `--model` 参数中落实，AI 不得擅自切换
- 每张卡完成时必须同步填写「执行模型」「子代理调用」（见 `model_routing_patch_20260418.md`）
- M0 全部 5 张卡完成 + 合并 main 后，才能开始 M1 任何一张卡

---

## 二、模型分布速查

| 里程碑 | 任务数 | opus | sonnet | haiku |
|--------|-------:|-----:|-------:|------:|
| M0 前置基线 | 5 | 2 | 2 | 1 |
| M1 设计系统基石 | 14 | 6 | 8 | 0 |
| **合计** | **19** | **8** | **10** | **1** |

M1 无 haiku 任务——Token 层所有改动均属于「新增字段结构与引用规则」强制 opus 触发器范畴，或需精确控制构建产物一致性的 sonnet 任务，无模板化机械任务。

---

## 三、序列补丁内容（以下为追加到 task-queue.md 的内容）

---

## SEQ-20260418-M0 — 前置基线

- 序列状态：⬜ 待开始
- Phase：Phase 0 — 前置基线
- 创建时间：2026-04-18
- 包含任务数：5
- 依赖：无
- 完成条件：全部 5 张任务卡 `✅ 已完成` + 合并 main + PHASE COMPLETE 通知落盘
- 建议启动顺序：BASELINE-01 → BASELINE-02 → BASELINE-03 → BASELINE-04 → BASELINE-05（01 与 02 可并行，其余串行）

### 任务卡片

#### BASELINE-01 — 关键路径 E2E 回归基线建档
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：无
- **文件范围**：
  - 新增 `docs/baseline_20260418/critical_paths.md`
  - 新增 `docs/baseline_20260418/screenshots/*.png`（6 张）
  - 新增 `docs/baseline_20260418/timings.json`
- **变更内容**：
  - 在 dev 分支执行一次完整 `npm run test:e2e`，确保通过基线
  - 归档 6 条关键路径的 before 截图与耗时：断点续播 / 线路切换 / 影院模式 / 字幕开关 / 登录 / 搜索
  - `critical_paths.md` 描述每条路径的前置条件、关键 DOM 节点、断言点，作为 M2–M5 重写期间回滚判据
  - `timings.json` 含 p50 / p95 / max（单位 ms），数据来源 Playwright tracing
- **验收**：
  - 6 条路径截图齐全（命名 `<path>_before.png`）
  - `timings.json` 三个百分位指标完整
  - 文档均 `git add`（截图二进制纳入版本控制）
  - `npm run test:e2e` 全绿
- **完成备注**：_（AI 填写）_

#### BASELINE-02 — SSR/SEO 风险登记表与降级策略 ADR
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：无
- **文件范围**：
  - 新增 `docs/risk_register_rewrite_20260418.md`
  - 追加 `docs/decisions.md` — ADR-030（SSR / SEO / 边缘函数降级策略）
- **变更内容**：
  - 登记 3 项重写期风险并给出量化指标：
    1. GlobalPlayerHost Portal 化对 `/watch/[slug]` SSR 元数据（OG tags、schema.org `VideoObject`）的影响 —— 验证指标：Lighthouse SEO ≥ 基线值
    2. Cookie + middleware 品牌识别对边缘函数冷启动延迟 —— 验证指标：Vercel Edge p95 < 50ms
    3. View Transitions API 在 Safari < 18 的降级 —— 验证指标：feature detection + CSS transition fallback，视觉差异 ≤ 1 帧
  - 每项风险产出字段：触发概率（H/M/L）× 影响等级（H/M/L）× 检测方式 × 预案
  - ADR-030 锁定三项降级策略的选择与不选择的理由
- **验收**：
  - `risk_register_rewrite_20260418.md` 3 项齐全
  - ADR-030 纳入 decisions.md 正常排序（紧接 ADR-029 之后）
  - 与 `docs/decisions_patch_20260418.md` 无内容冲突
- **完成备注**：_（AI 填写）_

#### BASELINE-03 — ESLint `no-hardcoded-color` 自定义规则引入
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：无
- **文件范围**：
  - 新增 `tools/eslint-plugin-resovo/package.json`
  - 新增 `tools/eslint-plugin-resovo/src/rules/no-hardcoded-color.ts`
  - 新增 `tools/eslint-plugin-resovo/src/index.ts`
  - 修改根 `package.json`（workspace 声明 + devDependency）
  - 修改 `apps/web/.eslintrc.*` + `apps/admin/.eslintrc.*`（启用规则，severity = `warn`）
  - 新增 `docs/rules/lint-rules.md`
- **变更内容**：
  - 规则覆盖模式：hex（`#fff`、`#ffffff`、`#ffff` 带 alpha）/ `rgb()` / `rgba()` / `hsl()` / `hsla()` / `oklch()` / 140 个 CSS color keyword，目标文件 `.ts` / `.tsx` / `.css` / `.module.css`
  - 豁免列表：Token 定义源文件 `packages/design-tokens/src/primitives/color.ts`、构建产物目录 `**/dist/**`
  - 初期 severity = `warn`，允许 `// eslint-disable-next-line no-hardcoded-color -- 待 M1 迁移` 临时注释豁免
  - 提供 auto-fix 建议（输出最接近的 Semantic Token 候选），具体匹配规则在 `docs/rules/lint-rules.md` 说明
  - M1 的 TOKEN-13 完成后由后续任务升级为 `error`（本任务不升级）
- **验收**：
  - `npm run lint` 成功执行新规则，输出现有硬编码警告数统计
  - 现有硬编码点全部 `warn`，不阻断 commit
  - `docs/rules/lint-rules.md` 包含规则说明、豁免注释格式、future 升级计划
  - 规则单测（Vitest）覆盖 5 种色值格式
- **完成备注**：_（AI 填写）_

#### BASELINE-04 — 重写期需求冻结通知与 BLOCKER 模板扩展
- **状态**：⬜ 待开始
- **建议模型**：haiku
- **创建时间**：2026-04-18
- **依赖**：BASELINE-02（引用 ADR-030），BASELINE-05（引用 ADR-031）
- **文件范围**：
  - 修改 `docs/rules/workflow-rules.md`（BLOCKER 模板触发条件）
  - 修改 `CLAUDE.md`（「绝对禁止」新增条款）
  - 新增 `docs/freeze_notice_20260418.md`
- **变更内容**：
  - `workflow-rules.md` BLOCKER 触发条件追加一行：「重写阶段（M0–M6）收到与三份方案目标无关的新业务需求」
  - `CLAUDE.md` 「绝对禁止」追加一条：「❌ 重写冻结期（M0–M6）接受与三份方案目标无关的新业务需求——一律写 BLOCKER 暂停，等人工决定」
  - `freeze_notice_20260418.md` 内容：冻结期范围（M0 开始日期至 M6 完成估算日期）、例外（关键 P0 bug 定义）、需求暂存方式（临时记录到 `docs/backlog_freeze_period.md`）
- **验收**：
  - 三份文件 `git add` 后 `git status` 无遗漏
  - `CLAUDE.md` 与 `workflow-rules.md` 的变更相互呼应，无措辞冲突
  - `freeze_notice_20260418.md` 明确 M0–M6 的日期区间（估算即可，后续可更新）
- **完成备注**：_（AI 填写）_

#### BASELINE-05 — 重写共存策略 ADR
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：无
- **文件范围**：
  - 追加 `docs/decisions.md` — ADR-031（重写共存策略）
- **变更内容**：
  - 锁定策略：dev 分支单线推进，**不**开 `redesign/` 子目录，**不**使用 feature flag 双栈
  - 每个 M 里程碑 = 一个 Phase，Phase 内可含多个 commit，Phase 完成后合并 main
  - 无法向前回滚时的 fallback：`git revert` + 在 `changelog.md` 追加 revert 理由
  - 与 `git-rules.md` 分支策略条款对齐（保留 `main` + `dev` 双分支结构不变）
  - 禁止在重写期间把其他与方案无关的需求合并进 dev
- **验收**：
  - ADR-031 纳入 decisions.md 正常排序（紧接 ADR-030）
  - 内容与 git-rules.md 分支策略不矛盾
  - 与 BASELINE-04 freeze_notice 策略一致
- **完成备注**：_（AI 填写）_

---

## SEQ-20260418-M1 — 设计系统基石

- 序列状态：⬜ 待开始
- Phase：Phase 1 — 设计系统基石
- 创建时间：2026-04-18
- 包含任务数：14
- 依赖：SEQ-20260418-M0 全部完成
- 完成条件：全部 14 张任务卡 `✅ 已完成` + 合并 main + PHASE COMPLETE 通知落盘
- 建议启动顺序：严格按下方编号串行（TOKEN-12 可与 TOKEN-10/11 并行，TOKEN-14 可与 TOKEN-13 并行）

### 任务卡片

#### TOKEN-01 — `packages/design-tokens` 目录骨架 + 构建工具选型 ADR
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：M0 全部完成
- **文件范围**：
  - 新增 `packages/design-tokens/package.json`
  - 新增 `packages/design-tokens/tsconfig.json`
  - 新增 `packages/design-tokens/src/index.ts`（空骨架）
  - 修改根 `package.json`（workspaces 声明）
  - 追加 `docs/decisions.md` — ADR-032（Token 构建工具选型）
- **变更内容**：
  - 对比 Style Dictionary v4 / 手写 TS 构建脚本 / Tokens Studio CLI 三方案，记录 ADR-032 并锁定最终选择
  - 建立 monorepo 子包骨架，定义 `package.json` 的 `exports` 字段三路出口：`./css` / `./js` / `./types`
  - 预留 `src/primitives` / `src/semantic` / `src/components` / `src/brands` 四层目录（留空文件占位）
  - `npm install` 后 `packages/design-tokens` 可被 `apps/web` import
- **验收**：
  - `npm run typecheck` 通过
  - `npm run build -w @resovo/design-tokens` 可运行（即使产物为空）
  - ADR-032 决策、理由、架构约束三节完整
- **完成备注**：_（AI 填写）_

#### TOKEN-02 — Primitive 层原子 Token 定义
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TOKEN-01
- **文件范围**：
  - 新增 `packages/design-tokens/src/primitives/color.ts`
  - 新增 `packages/design-tokens/src/primitives/space.ts`
  - 新增 `packages/design-tokens/src/primitives/size.ts`
  - 新增 `packages/design-tokens/src/primitives/radius.ts`
  - 新增 `packages/design-tokens/src/primitives/typography.ts`（size / line-height / weight / family）
  - 新增 `packages/design-tokens/src/primitives/motion.ts`（duration / easing）
  - 新增 `packages/design-tokens/src/primitives/shadow.ts`
  - 新增 `packages/design-tokens/src/primitives/z-index.ts`
  - 新增 `packages/design-tokens/src/primitives/index.ts`（统一导出）
- **变更内容**：
  - OKLCH 调色盘：灰阶 11 阶 + 基础色相 11 阶（design_system_plan 4.2 节锁定的种子结构）
  - 空间 10 阶（4/8/12/16/20/24/32/40/48/64）
  - 尺寸 10 阶（xs…5xl）
  - 圆角 6 阶（none/sm/md/lg/xl/full）
  - 字号 9 阶（xs…5xl）+ 行高 5 阶 + 字重 5 阶 + 字体族（sans / serif / mono）
  - duration 6 阶（instant/fast/base/slow/slower/slowest）+ easing 5 种（linear/in/out/in-out/emphasized）
  - shadow 5 阶（none/sm/md/lg/xl）
  - z-index 9 阶（base/dropdown/sticky/overlay/modal/toast/tooltip/popover/player）
- **验收**：
  - `npm run typecheck` 通过
  - 每个文件导出命名一致（PascalCase 类型 + 常量对象），无裸字符串字面量
  - 单测覆盖调色盘 OKLCH 值合法性（Vitest）
- **完成备注**：_（AI 填写）_

#### TOKEN-03 — Semantic 层语义映射
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TOKEN-02
- **文件范围**：
  - 新增 `packages/design-tokens/src/semantic/bg.ts`（canvas/surface/subtle/muted/inverse）
  - 新增 `packages/design-tokens/src/semantic/fg.ts`（default/muted/subtle/inverse/disabled）
  - 新增 `packages/design-tokens/src/semantic/border.ts`（default/muted/strong/inverse）
  - 新增 `packages/design-tokens/src/semantic/accent.ts`（单种子 → 11 阶脚本推导）
  - 新增 `packages/design-tokens/src/semantic/state.ts`（success/warning/danger/info，各 3 阶）
  - 新增 `packages/design-tokens/src/semantic/surface.ts`（overlay/scrim/highlight）
  - 新增 `packages/design-tokens/src/semantic/index.ts`
  - 新增 `packages/design-tokens/src/semantic/derive-accent.ts`（单种子推导工具函数）
- **变更内容**：
  - 每个语义 Token 定义 light / dark 两组映射（引用 primitives，**不**硬编码）
  - accent 采用单种子色值，通过 `derive-accent.ts` 以 OKLCH 空间算法产出 11 阶（design_system_plan 4.3 节锁定）
  - 所有 semantic Token 的值只允许引用 `primitives.*`，lint 规则校验
- **验收**：
  - `npm run typecheck` 通过
  - `derive-accent.ts` 单测：给定同一种子，light/dark 两套 11 阶输出稳定
  - 检查所有 semantic 值均为 primitives 引用（可写一个脚本校验，纳入 test 套件）
- **完成备注**：_（AI 填写）_

#### TOKEN-04 — Component 层组件 Token 定义
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TOKEN-03
- **文件范围**：
  - 新增 `packages/design-tokens/src/components/button.ts`
  - 新增 `packages/design-tokens/src/components/input.ts`
  - 新增 `packages/design-tokens/src/components/card.ts`
  - 新增 `packages/design-tokens/src/components/tabs.ts`
  - 新增 `packages/design-tokens/src/components/modal.ts`
  - 新增 `packages/design-tokens/src/components/tooltip.ts`
  - 新增 `packages/design-tokens/src/components/table.ts`
  - 新增 `packages/design-tokens/src/components/player.ts`
  - 新增 `packages/design-tokens/src/components/index.ts`
- **变更内容**：
  - 8 个核心组件的 Token 定义（如 `button-primary-bg` → `semantic.accent.600`、`button-primary-fg` → `semantic.fg.inverse`、`button-primary-hover-bg` → `semantic.accent.700`）
  - 每个组件覆盖：size（sm/md/lg）× state（default/hover/active/disabled/focus）
  - player 组件 Token 覆盖 full/mini/pip 三态背景、控制条、进度条、字幕面板
  - 组件 Token 值只允许引用 `semantic.*`，不得跨层引用 primitives
- **验收**：
  - `npm run typecheck` 通过
  - 组件 Token 引用校验脚本通过（只允许 semantic 层）
  - `index.ts` 扁平导出所有组件 namespace
- **完成备注**：_（AI 填写）_

#### TOKEN-05 — Token 构建管线（CSS / JS / Types 三路输出）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-04
- **文件范围**：
  - 新增 `packages/design-tokens/build.ts`（或 Style Dictionary 配置，按 ADR-032 选型）
  - 生成 `packages/design-tokens/dist/tokens.css`
  - 生成 `packages/design-tokens/dist/tokens.js`
  - 生成 `packages/design-tokens/dist/tokens.d.ts`
  - 修改 `packages/design-tokens/package.json`（`build` / `prebuild` / `clean` scripts）
- **变更内容**：
  - 构建管线遍历 primitives / semantic / components 三层
  - CSS 输出：`:root { --color-bg-canvas: oklch(...); }` + `.dark { … }` 两套
  - JS 输出：嵌套对象，便于 React inline style / Storybook
  - TS 类型：生成联合类型（如 `type SemanticBgKey = 'canvas' | 'surface' | …`）供 lint 自动补全使用
  - 增量构建支持（改动某一层只重建受影响输出）
- **验收**：
  - `npm run build -w @resovo/design-tokens` 产出三个文件，大小合理（CSS 未压缩 < 50KB）
  - CI 集成：`npm run typecheck` 在 pre-build 阶段通过
  - 单测覆盖构建脚本的关键转换函数
- **完成备注**：_（AI 填写）_

#### TOKEN-06 — Tailwind 桥接（theme.extend 从 Token 生成）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-05
- **文件范围**：
  - 修改 `apps/web/tailwind.config.ts`
  - 修改 `apps/admin/tailwind.config.ts`
  - 新增 `packages/design-tokens/tailwind-preset.ts`
- **变更内容**：
  - `tailwind-preset.ts` 从 Token 产物读取并生成 `theme.extend.{colors, spacing, fontSize, borderRadius, boxShadow, zIndex, transitionDuration, transitionTimingFunction}`
  - 颜色使用 `var(--color-...)` 方式引用，以便运行时主题切换不重编译
  - 两个 app 的 tailwind.config 替换为 `presets: [designTokensPreset]` + 必要扩展
  - 移除 tailwind.config 中原有的手写 colors 字段
- **验收**：
  - `npm run typecheck` 通过
  - `npm run dev -w apps/web` 启动无警告
  - 回归：页面视觉与 M0 BASELINE-01 截图对比，无显著差异（允许微调）
  - Tailwind IntelliSense 补全新 token 类名
- **完成备注**：_（AI 填写）_

#### TOKEN-07 — Base theme 实现（light / dark）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-06
- **文件范围**：
  - 修改 `apps/web/src/styles/globals.css`（`:root` + `.dark` 规则）
  - 修改 `apps/admin/src/styles/globals.css`
  - 新增 `packages/design-tokens/dist/base-theme.css`（构建产物）
- **变更内容**：
  - 将 Token 产物 CSS 变量注入 `:root` 作为 light 默认，`.dark` 作为 dark override
  - 增加 `color-scheme: light dark` 元素属性（浏览器表单控件配色）
  - 对主题切换动效统一为 `transition: background-color 200ms, color 200ms`
  - 保留 `prefers-color-scheme` 媒体查询作为初始主题 fallback
- **验收**：
  - Light / Dark 模式切换视觉正常
  - `[data-theme="dark"]` 切换动效在 200ms 内完成
  - `npm run lint` 无 `no-hardcoded-color` warn 回归
- **完成备注**：_（AI 填写）_

#### TOKEN-08 — Brand 层架构（数据模型 + DB schema + override 约束）
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TOKEN-07
- **文件范围**：
  - 新增 `packages/design-tokens/src/brands/types.ts`
  - 新增 `packages/design-tokens/src/brands/default.ts`
  - 新增 `apps/server/src/db/migrations/NNNN_create_brands_table.sql`
  - 新增 `apps/server/src/db/queries/brands.ts`
  - 修改 `docs/architecture.md`（brands schema 同步）
- **变更内容**：
  - TypeScript 数据模型：
    ```ts
    type Brand = {
      id: string; name: string;
      overrides: {
        semantic?: Partial<SemanticTokens>;
        components?: Partial<ComponentTokens>;
      };
    };
    ```
  - **架构约束**：brands 只能覆盖 semantic / components，**不得**覆盖 primitives（ADR-022 第三条）
  - DB schema：`brands(id uuid pk, slug text unique, name text, overrides jsonb, created_at, updated_at, deleted_at)`
  - default brand 作为兜底，无 overrides 字段
  - 追加约束到 decisions.md ADR-022 的「架构约束」节（本次不新开 ADR）
- **验收**：
  - `npm run typecheck` 通过
  - migration 双向可运行（up / down）
  - 类型层校验 override 不含 primitives key（通过 TS conditional type 实现，编译期拒绝非法 override）
  - `docs/architecture.md` 新表条目同步
- **完成备注**：_（AI 填写）_

#### TOKEN-09 — BrandProvider + useBrand / useTheme hooks
- **状态**：⬜ 待开始
- **建议模型**：opus
- **创建时间**：2026-04-18
- **依赖**：TOKEN-08
- **文件范围**：
  - 新增 `apps/web/src/contexts/BrandProvider.tsx`
  - 新增 `apps/web/src/hooks/useBrand.ts`
  - 新增 `apps/web/src/hooks/useTheme.ts`
  - 新增 `apps/web/src/types/brand.ts`
  - 追加 `docs/decisions.md` — ADR-033（BrandProvider Props 契约与消费者约束）
- **变更内容**：
  - `BrandProvider` Props：`{ initialBrand: Brand; initialTheme: 'light' | 'dark' | 'system'; children }`
  - `useBrand()` 返回 `{ brand: Brand; setBrand: (id) => void }`
  - `useTheme()` 返回 `{ theme: 'light'|'dark'; resolvedTheme: 'light'|'dark'; setTheme: (t) => void }`
  - SSR 安全：首次渲染值来自 Props（cookie 已在 middleware 阶段解析），客户端切换触发 document.documentElement dataset 更新
  - 订阅模式：Context 内部用 `useSyncExternalStore` 避免不必要 re-render
  - ADR-033 锁定：API 签名、事件语义、消费者不得在 Provider 外读取 document 属性
- **验收**：
  - `npm run typecheck` 通过
  - Vitest 覆盖：Provider 初始值 / setBrand / setTheme / SSR 场景（jsdom 下无 hydration mismatch）
  - ADR-033 纳入 decisions.md
- **完成备注**：_（AI 填写）_

#### TOKEN-10 — Cookie + middleware 品牌 / 主题同步
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-09
- **文件范围**：
  - 新增 `apps/web/src/middleware.ts`（或修改，如已存在）
  - 新增 `apps/web/src/lib/brand-detection.ts`
  - 修改 `apps/web/src/app/[locale]/layout.tsx`（读 header 注入 Provider initial）
- **变更内容**：
  - middleware 读 cookie `resovo-brand` / `resovo-theme` → 校验合法值 → 写入 request header `x-resovo-brand` / `x-resovo-theme`
  - `brand-detection.ts` 作为纯函数封装 cookie 解析与默认值兜底逻辑
  - `layout.tsx` 读 `headers()` 获取 header 值，作为 `<BrandProvider initialBrand={...} initialTheme={...}>` 入参
  - 性能约束：边缘函数 p95 < 50ms（BASELINE-02 ADR-030 指标）
- **验收**：
  - 本地 `npm run dev` 改 cookie 后刷新页面 brand / theme 正确生效
  - `npm run test:e2e` 含一条 brand 切换测试
  - 部署 preview 后实测 Edge 响应时长 p95 < 50ms（手动验证，记录到完成备注）
- **完成备注**：_（AI 填写）_

#### TOKEN-11 — 首屏无闪烁 blocking script
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-10
- **文件范围**：
  - 修改 `apps/web/src/app/[locale]/layout.tsx`（`<head>` 注入 inline script）
  - 新增 `apps/web/src/lib/theme-init-script.ts`（脚本字符串生成器）
- **变更内容**：
  - `theme-init-script.ts` 导出字符串：同步读 cookie → 设 `<html data-brand="x" data-theme="y">`
  - 脚本注入于 `<head>` 首个子节点，保证 React hydration 之前生效
  - 防 FOUC：脚本内不读取 localStorage（避免主线程阻塞），仅用 cookie
  - 对 `prefers-color-scheme: dark` 做 fallback（cookie 为空时）
- **验收**：
  - Chrome DevTools Performance trace 显示脚本耗时 < 2ms
  - 浏览器强制 dark 偏好 + 无 cookie 场景下首屏无闪烁
  - Lighthouse CLS = 0
- **完成备注**：_（AI 填写）_

#### TOKEN-12 — Token Playground 页面（dev 环境走查载体）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-07（主题可切换即可启动，不必等 Brand 层，可与 TOKEN-08/09/10/11 并行）
- **文件范围**：
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/page.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/_components/{PrimitivePanel,SemanticPanel,ComponentPanel,BrandSwitcher}.tsx`
  - 新增 `apps/web/src/app/[locale]/__playground/tokens/layout.tsx`（dev-only guard）
- **变更内容**：
  - 三栏布局：Primitive / Semantic / Component 三层 Token 预览
  - 顶部栏：Brand 切换（TOKEN-08 就绪后接入）+ Theme 切换（light / dark / system）
  - Primitive 栏：色块 + OKLCH 数值 + 使用它的 Semantic Token 反查
  - Semantic 栏：实际使用场景示例（按钮 / 卡片 / 表单）
  - Component 栏：每个组件 Token 可视化，点击复制 Token 名
  - `layout.tsx` 在 `process.env.NODE_ENV === 'production'` 时返回 404
- **验收**：
  - dev 环境访问 `/zh/__playground/tokens` 页面渲染正常
  - production build 访问该路径返回 404
  - 切换 brand / theme 所有 token 预览实时更新
- **完成备注**：_（AI 填写）_

#### TOKEN-13 — globals.css 23 个硬编码变量迁移 + ESLint 升级 error
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-07、TOKEN-11
- **文件范围**：
  - 修改 `apps/web/src/styles/globals.css`
  - 修改 `apps/admin/src/styles/globals.css`
  - 修改引用了 23 个原硬编码变量的所有文件（由全文搜索定位）
  - 修改 `apps/web/.eslintrc.*` + `apps/admin/.eslintrc.*`（`no-hardcoded-color` 从 `warn` 升 `error`）
  - 追加 `docs/changelog.md` 迁移记录
- **变更内容**：
  - 逐一映射 23 个硬编码 CSS 变量 → Token 产物 CSS 变量（详细对照表写入 changelog）
  - 全文替换所有引用点（`var(--old-name)` → `var(--new-name)` 或直接 Tailwind 类名）
  - `no-hardcoded-color` 规则从 `warn` 升 `error`，移除所有 `eslint-disable-next-line no-hardcoded-color -- 待 M1 迁移` 注释
  - 覆盖对象：`.ts` / `.tsx` / `.css` / `.module.css` 全部硬编码色值
- **验收**：
  - `npm run lint` 无 warning / error
  - BASELINE-01 的 6 条 E2E 路径截图对比差异 ≤ 视觉阈值（建议 SSIM ≥ 0.98）
  - changelog.md 有完整 23 条对照表
- **完成备注**：_（AI 填写）_

#### TOKEN-14 — 后台 Token 编辑器 MVP（只读预览）
- **状态**：⬜ 待开始
- **建议模型**：sonnet
- **创建时间**：2026-04-18
- **依赖**：TOKEN-09
- **文件范围**：
  - 新增 `apps/admin/src/features/design-tokens/pages/index.tsx`
  - 新增 `apps/admin/src/features/design-tokens/components/TokenTable.tsx`（基于 ModernDataTable）
  - 新增 `apps/admin/src/features/design-tokens/components/LivePreviewFrame.tsx`（iframe 嵌入 Playground）
  - 新增 `apps/admin/src/features/design-tokens/api/tokens-client.ts`
  - 新增 `apps/server/src/routes/admin/design-tokens.ts`（只读 GET 接口）
- **变更内容**：
  - 列表页：左侧 `ModernDataTable` 展示 Brand 列表（brand_id / name / overrides 计数 / updated_at），右侧 `iframe` 嵌入 `/__playground/tokens?brand=X`
  - 列设置面板 / 分页 / 服务端排序按 admin-module-template 规范接入
  - 本里程碑仅实现只读；编辑器（写入）留待 M5+ 推进
  - 路由权限：仅 role = admin 可访问
- **验收**：
  - 登录 admin 访问 `/design-tokens` 列表正常
  - 切换 brand 右侧 iframe 实时刷新
  - 非 admin 访问返回 403
  - `npm run test:e2e` 覆盖列表页渲染 + brand 切换
- **完成备注**：_（AI 填写）_

---

## 四、Phase 边界协议

### Phase 0 完成判定

- BASELINE-01 至 BASELINE-05 全部 `✅ 已完成`
- `dev` 合并到 `main`，commit message：`feat: complete Phase 0 baseline`
- `task-queue.md` 尾部追加 PHASE COMPLETE 通知（模板见 workflow-rules.md）
- 人工执行验收项：
  - [ ] `npm run test:e2e` 全绿
  - [ ] `risk_register_rewrite_20260418.md` 已通读
  - [ ] ESLint `no-hardcoded-color` warn 级别生效

### Phase 1 完成判定

- TOKEN-01 至 TOKEN-14 全部 `✅ 已完成`
- `dev` 合并到 `main`，commit message：`feat: complete Phase 1 design tokens`
- Token Playground 在 dev 环境可用，后台 Token 列表页可用
- 人工执行验收项：
  - [ ] `npm run test -- --run` + `npm run test:e2e` 全绿
  - [ ] BASELINE-01 关键路径视觉回归 SSIM ≥ 0.98
  - [ ] `no-hardcoded-color` 已升级为 error 且 lint 无 violation
  - [ ] 确认开始 Phase 2（M2a 根布局骨架 + GlobalPlayerHost 插槽），回到规划阶段拆分下一批任务卡

---

## 五、后续里程碑预告（供参考，暂不写入 task-queue）

- **Phase 2a** — 根布局骨架 + GlobalPlayerHost 插槽（1.5 周，~5 张卡）
- **Phase 2b + 3 并行** — Header/Footer/Tab Bar/Mega Menu/middleware（~6 张）+ 播放器全局化（~7 张）
- **Phase 4a / 4b** — 图片管线（DB Schema + Job ~4 张；SafeImage + BlurHash ~5 张）
- **Phase 5** — 页面重制（首页 / 详情页 / 播放页 / 搜索页 ~10 张）
- **Phase 6** — 收尾（E2E 回归 + 性能基线 + 文档归档 ~3 张）

合计预估：M2–M6 约 45–55 张原子任务卡。届时在 M1 完成后重新拆分并落盘。
