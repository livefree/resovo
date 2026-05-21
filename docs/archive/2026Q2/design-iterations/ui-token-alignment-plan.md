# UI Token 对齐设计稿 — 方案文档

> status: active
> owner: @engineering
> scope: SEQ-20260503-01 第一批（颜色/边框/文字/状态 pill 对齐）
> source_of_truth: yes
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-05-03
>
> 本方案对应 `docs/task-queue.md` 中的 **SEQ-20260503-01 UI 优化（第一批：颜色 token 对齐）**。
> 设计真源：`docs/designs/backend_design_v2.1/styles/tokens.css`（Hex 直写，dark/light 双套）。
> 实现真源：`packages/design-tokens/src/{primitives,semantic}/*.ts` → `scripts/build-css.ts` 生成 `dist/tokens.css` & `src/css/tokens.css`。
> 设计稿截图：`docs/designs/screenshot/videos-design.png` vs `videos-implement.png`（视频库列表页）。

---

## 1. 问题定义

通过视频库（/admin/videos）页面截图与设计稿（design-canvas.jsx + tokens.css）逐项比对，识别出 **4 类 token 偏离**：

| 维度 | 现象 | 根因 |
|---|---|---|
| 表面层 | dark 模式表格底色"整片黑"、行无反差；light 模式过白 | 缺 row hover/input 专用层；canvas/surface 亮度梯度与设计不一致 |
| 边框 | 表格行分割线消失 | `border.default` (oklch 23%) 与 `surface-elevated` 同值；DataTable 行级 CSS 未显式声明 `border-bottom` |
| 文字 | 主/次文字偏白发涩 | `fg.default` (oklch 98.5%) 比设计 `--text` (#e6e9ef ≈ 91%) 亮 +7.5%；`fg.muted` 偏亮 +13% |
| 状态 pill | 暗色实底+亮文字（Material 风），与设计"alpha-soft 底 + 鲜亮文字"方向反转 | `state.ts` dark/light 用 `bg/fg` 实色对调，未用 `color-mix(... 14%, transparent)` 软底 |

完整对照表（含 OKLCH ↔ Hex 估算）已记录在 2026-05-03 与用户的差异分析对话中，本文复述结论并下沉为修复方案。

---

## 2. 改动原则（强约束）

按 CLAUDE.md「价值排序」与 ui-rules 制订，违反任一则方案作废重写：

1. **不硬编码颜色值**：所有改动在 `packages/design-tokens/src/` 内完成，消费方零硬编码。新增的 row hover 角色必须有语义名（如 `surfaceRow`），不得写裸 hex / oklch。
2. **不破坏现有分层**：保持「primitives（gray/accent/status ramp） → semantic（bg/fg/border/state） → CSS 变量 → 消费方」四层结构。本期**不动 primitive ramp**（`colors.gray.*` 等不变），只改 semantic 映射和新增语义槽。
3. **dark/light 双主题等价**：state pill 的「alpha-soft + 鲜亮文字」必须两主题用同一映射策略，不再走「dark 暗底亮字 / light 浅底深字」反转。
4. **可回退**：每张卡 commit 独立、可单独 revert；CSS 变量名只增不删（即新增 `--bg-surface-row` 而不是改名 `--bg-surface-elevated`）。
5. **门禁加严**：每张卡完成时除常规 typecheck/lint/unit 外，必须做"设计对齐复核"（见 §6）。

---

## 3. 修复路径概览

```
primitives/color.ts        ← 不动
  ↓
semantic/bg.ts             ← 改：新增 surfaceRow；调整 surfaceRaised/Elevated 映射
semantic/border.ts         ← 改：default 用更暗一档；strong 收紧
semantic/fg.ts             ← 改：default 用 gray.200（91%）替代 gray.50；muted 用 gray.400 替代 gray.300
semantic/state.ts          ← 重写：alpha-soft 双主题统一
  ↓
scripts/build-css.ts       ← 自动重新生成 src/css/tokens.css + dist/tokens.css
  ↓
packages/admin-ui          ← 仅 DataTable 需补 row 显式 border-bottom（CHG-UI-05）
apps/server-next 消费方    ← 零改动（继续读 CSS 变量）
```

---

## 4. 各项详细方案

### 4.1 surfaces 重新映射（CHG-UI-02）

**文件**：`packages/design-tokens/src/semantic/bg.ts`

**改动**：
- `dark.surfaceRaised`：`gray.900` (oklch 16.5%) → `gray.900` 维持，但**新增** `surfaceRow: gray.900`，并将 `surfaceRaised` 映射改为更暗一档以贴近设计 `--bg2 #161a22`
  - 方案：使用 `color-mix(in oklch, gray.900 60%, gray.950 40%)` 构造 9–10% lightness 的中间值，命名 `surfaceRaised`
  - 或新增 primitives `gray.925` = `oklch(13.5% 0.007 247)` 作为中间档（推荐：可控性最好）
- `dark.surfaceElevated`：`gray.800` (23%) → 维持，对应设计 `--bg4`（差距 +6% 在可接受范围）
- 新增槽位 `surfaceRow`：dark = `gray.900` (16.5%) ≈ 设计 `--bg3` (~13%) 偏亮 3%，可接受；light = `gray.100` (96.8%) ≈ 设计 `--bg3 #f1f3f6` ≈ 96%
- `light.canvas`：`gray.50` (98.5%) → `gray.100` (96.8%)，对齐设计 `--bg0 #f5f6f8`

**新增 primitive（可选）**：
若使用 `gray.925`，需在 `primitives/color.ts` 添加：
```ts
925: 'oklch(13.5% 0.007 247)',
```
影响：仅 `gray.925` 一项新增，不动其他档位，向后兼容。

> **CHG-UI-02a 校准实装值（2026-05-03 用户截图反馈触发）**：
>
> 上文 oklch 数值是初稿；CHG-UI-02 落地后用户反馈 dark 模式 sRGB 渲染整体偏暗 2-5 RGB units，肉眼仍"一片黑"。CHG-UI-02a 校准 5 档至最终值（用户视觉验收）：
>
> ```ts
> 800:  oklch(21.0% 0.011 247)   // sRGB ≈ #252b37
> 900:  oklch(18.0% 0.010 247)   // sRGB ≈ #1d222c
> 925:  oklch(15.0% 0.009 247)   // sRGB ≈ #161a22
> 950:  oklch(12.0% 0.008 247)   // sRGB ≈ #11141a
> 1000: oklch(8.0% 0.005 247)    // sRGB ≈ #0b0d10
> ```
>
> ramp 间距 8 → 12 → 15 → 18 → 21（间距 +4/+3/+3/+3 单调递增）。本节代码块仅作历史方向记录，最终落地以 `packages/design-tokens/src/primitives/color.ts` 为真源。

**变更后 dark 映射**（建议落地版）：
```ts
dark: {
  canvas:           gray[1000],   // 6.5%  ≈ #0a0c10 (设计 #0b0d10)
  surface:          gray[950],    // 11.2% ≈ #11151b (设计 #11141a)
  surfaceRaised:    gray[925],    // 13.5% ≈ #161a22 (设计 #161a22) ← 新档
  surfaceRow:       gray[900],    // 16.5% ≈ #1a1f28 (设计 #1d222c)
  surfaceElevated:  gray[800],    // 23.0% ≈ #252b37 (设计 #252b37)
  surfaceSunken:    gray[1000],
  overlay:          color-mix(in oklch, gray[1000] 70%, transparent),
}
```

### 4.2 border 收紧（CHG-UI-02 同卡）

**文件**：`packages/design-tokens/src/semantic/border.ts`

**改动**：
```ts
dark: {
  default: gray[800],   // 23%  → gray[850] 待定（无该档）
                        // 临时方案：保留 gray[800] 但消费方改贴在 surfaceRow (16.5%) 上，反差 +6.5%
  strong:  gray[700],   // 32.8% (替代当前 gray[600] 43.9%) — 收回 11%
  subtle:  gray[900],   // 16.5% → 维持
  focus:   accent[500], // 不动
}
light: {
  default: gray[200],   // 不动（92.9% ≈ 设计 #e3e6ec）
  strong:  gray[300],   // 86.9% (替代当前 gray[400] 70.8%) — 收回 16%
  subtle:  gray[100],   // 不动
  focus:   accent[500], // 不动
}
```

> 备选：若不引入 `gray.850`，`border-default` 维持 `gray[800]` 即可——配合表格容器使用 `surfaceRaised` (gray[925])，分割线反差 +9.5% 已足够明显。

### 4.3 文字回收（CHG-UI-03）

**文件**：`packages/design-tokens/src/semantic/fg.ts`

**改动**：
```ts
dark: {
  default: gray[200],   // 92.9% ≈ #e6e9ef (设计 --text)，替代 gray[50] 98.5%
  muted:   gray[400],   // 70.8% ≈ #b3b9c5 (设计 --text-2)，替代 gray[300] 86.9%
  subtle:  gray[500],   // 不动 (≈ 设计 --muted)
  onAccent:gray[0],
  disabled:gray[600],
}
light: {
  default: gray[950],   // 不动 (#0a0c10 等价 #1a1d23 接近)
  muted:   gray[700],   // 不动
  subtle:  gray[500],   // 不动
  onAccent:gray[0],
  disabled:gray[400],
}
```

### 4.4 state pill 切 alpha-soft（CHG-UI-04）

**文件**：`packages/design-tokens/src/semantic/state.ts`

**改动（重写为双主题统一）**：
```ts
const softMix = (color: string) => `color-mix(in oklch, ${color} 14%, transparent)`

const sharedSlots = {
  success: { bg: softMix(colors.success.base), fg: colors.success.base, border: colors.success.base },
  warning: { bg: softMix(colors.warning.base), fg: colors.warning.base, border: colors.warning.base },
  error:   { bg: softMix(colors.error.base),   fg: colors.error.base,   border: colors.error.base },
  info:    { bg: softMix(colors.info.base),    fg: colors.info.base,    border: colors.info.base },
}

export const state = {
  light: sharedSlots,
  dark:  sharedSlots,
} as const
```

**border 槽位决策记录**（CHG-UI-04 落地时确认）：

`border` 保留 `colors.<status>.base` 而非 `'transparent'` 的折中决策来源——以下消费方依赖事实清单显式读取 `--state-*-border`：

| 消费方 | 文件:行 | 用法 |
|---|---|---|
| KpiCard `is-warn / is-danger / is-ok` | `packages/admin-ui/src/components/cell/kpi-card.tsx:115-117` | 卡片整体 1px 边框 |
| DiffPanel 警告条 | `apps/server/src/components/admin/design-tokens/DiffPanel.tsx:88` | 警告 Banner 1px 边框 |
| InheritanceBadge | `apps/server/src/components/admin/design-tokens/InheritanceBadge.tsx:18` | 徽标 1px 边框 |
| selection-action-bar 删除按钮 | `packages/admin-ui/src/components/data-table/selection-action-bar.tsx:83` | hover 描边 |

`Pill` 自身**不消费** border（仅读 bg/fg + dot 派生 fg），保持 borderless 与设计稿等价。

**未来回收条件**：若上述 4 个消费方任一改为不消费 border，应回到 `transparent` 选项重审，避免决策依据被遗忘后无法 revert。

**视觉效果**：
- dark：14% 绿色 alpha 叠在 `surfaceRow` (#1a1f28) 上 ≈ #1f3a2a 软底 + 鲜亮 #22c55e 文字
- light：14% 绿色 alpha 叠在 `surface` (#ffffff) 上 ≈ #d6f0de 软底 + 鲜亮 #22c55e 文字

**对消费方影响**：所有引用 `--state-success-bg/fg/border` 的组件视觉发生变化。需逐一走查：
- 审核台 DecisionCard / RejectModal
- 视频库 / 节目库 chip 列
- BarSignal、DualSignal、Pill 共享组件

### 4.5 消费方 token 槽位全栈审计 + 修正 + DataTable 行分割线落地（CHG-UI-05）

> **范围扩展记录（2026-05-03 用户反馈）**：原计划仅做 DataTable 行级 CSS；CHG-UI-02 落地后用户反馈 dark 模式 sidebar / topbar / 全局搜索 / topbar 右侧信息区 / 表格背景"颜色都很深，没有变浅效果"，浅色模式同存在搜索 / 信息区 token 选错；pill 文字 / 背景对比度不达预期。诊断（见 §4.5.1）确认根因是**消费方层在 CHG-UI-02 引入新 `--bg-surface-row` 槽位之前，把本应落在中间档的 input / row hover / 信息区元素，错误地选到了 `--bg-surface-raised` 或 `--bg-surface-elevated`**。本卡范围扩展为：扫描全部消费方 var() 引用，对照设计稿槽位语义逐条修正。

#### 4.5.1 已确认错位（基线）

| # | 文件:行 | 当前引用 | 应改为 | 设计依据 |
|---|---|---|---|---|
| 1 | `admin-ui/shell/topbar.tsx:86` | `var(--bg-surface-raised)` | `var(--bg-surface-row)` | 设计 `--bg3` 是 input 槽位 |
| 2 | `admin-ui/components/data-table/data-table.tsx:326` | `var(--bg-surface-elevated)` | `var(--bg-surface-row)` | 设计 `--bg3` 是 row hover 槽位 |
| 3 | `admin-ui/components/data-table/dt-styles.tsx:96` | `var(--bg-surface)` | `transparent` | 表头应继承表格容器底色 |
| 4 | `admin-ui/components/data-table/dt-styles.tsx:130` | `var(--bg-surface)` | `transparent` | filter-chips slot 同上 |
| 5 | dark 模式 topbar 右侧信息区 | 待精确扫描定位 | 据语义评估 | 用户报告 |
| 6 | light 模式搜索 / 信息区 | 待精确扫描定位 | 据语义评估 | 用户报告 |
| 7 | pill 消费方对 `--state-*-bg/fg` 的引用（含潜在硬编码） | 待 CHG-UI-04 落地后精确扫描 | 对齐 alpha-soft 双主题策略 | 用户报告 |

#### 4.5.2 全栈扫描方法

扫描脚本 / 命令：

```bash
# 1. 列出全部 var() 引用（按消费方）
rg -n 'var\(--' packages/admin-ui/src/ apps/server-next/src/ \
  --type-add 'tsx:*.{tsx,ts,css}' --type tsx \
  > /tmp/token-refs.txt

# 2. 按 token 名分组聚合
rg -No 'var\(\s*(--[a-z][a-z0-9-]+)' -r '$1' packages/admin-ui/src/ apps/server-next/src/ \
  --type-add 'tsx:*.{tsx,ts,css}' --type tsx | sort | uniq -c | sort -rn
```

扫描目标 token 类（聚焦本批关心的）：
- `--bg-canvas` / `--bg-surface` / `--bg-surface-raised` / `--bg-surface-row` / `--bg-surface-elevated` / `--bg-surface-sunken`
- `--border-default` / `--border-strong` / `--border-subtle`
- `--fg-default` / `--fg-muted` / `--fg-subtle`
- `--state-{success,warning,error,info}-{bg,fg,border}`

#### 4.5.3 对照判定表（设计稿槽位语义 → 应消费 token）

| 设计槽位 | 用例 | 应消费 token |
|---|---|---|
| `--bg0` page canvas | 整壳最底层 / 主内容区 padding | `--bg-canvas` |
| `--bg1` shell | 侧边栏 / 顶栏 / 浮窗壳 | `--bg-surface` |
| `--bg2` card | 卡片 / 表格容器 / 内容卡 | `--bg-surface-raised` |
| `--bg3` row hover / input | input / row hover / chip 默认底 | `--bg-surface-row` |
| `--bg4` popover | dropdown / popover / modal / drawer | `--bg-surface-elevated` |
| 表头 / 容器内子区 | thead / filter-chips / footer 内层 | `transparent`（继承父） |

#### 4.5.4 输出物

- `docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md`（新建）— 槽位错位清单（每条含：文件:行 / 现引用 / 应引用 / 设计依据 / 修正后 commit hash）
- 修正后所有受扫描的消费方文件
- DataTable 行分割线显式落地：`tbody tr { border-bottom: 1px solid var(--border-default) }` + `tbody tr:last-child { border-bottom: none }` + `tbody tr:hover { background: var(--bg-surface-row) }`（与 #2 错位修正同源）

#### 4.5.5 工作量估算

预估 30–60 处错位，2.5–4 工时（不含 pill 消费方 — pill 部分依赖 CHG-UI-04 完成）。如扫描后错位 > 60 处，拆 CHG-UI-05a / CHG-UI-05b 分批处理。

**不在 server-next / web-next 业务文件加 CSS 变量定义**——仅修正 var() 引用槽位选择。

### 4.6 视觉走查 + 基线归档（CHG-UI-06）

**走查目标页**（dark + light 各一张）：
1. `/admin/videos` 视频库列表
2. `/admin/moderation` 审核台
3. `/admin/sources` 播放线路
4. `/admin/image-health` 图片健康

**视觉基线归档目录**：`tests/visual/admin-ui-tokens/`（新增）

**Storybook 同步**：admin-ui DataTable 与 Pill stories 加 dark/light 切换截图对比。

---

## 5. 任务拆分与编号

| 任务 ID | 标题 | 建议模型 | 文件范围 | 依赖 |
|---|---|---|---|---|
| CHG-UI-01 | 方案文档归档 + ADR 占位 | haiku | `docs/designs/backend_design_v2.1/ui-token-alignment-plan.md`、`docs/decisions.md` | 无 |
| CHG-UI-02 | surfaces & border 对齐 | sonnet | `packages/design-tokens/src/primitives/color.ts`（新增 gray.925）、`semantic/bg.ts`、`semantic/border.ts`、生成产物 `dist/tokens.css` + `src/css/tokens.css` | CHG-UI-01 |
| CHG-UI-03 | fg 文字对齐 | sonnet | `semantic/fg.ts`、生成产物 | CHG-UI-02 |
| CHG-UI-04 | state pill 切换 alpha-soft（双主题统一） | **opus**（共享语义层契约变更） | `semantic/state.ts`、生成产物、消费方走查清单 | CHG-UI-03 |
| CHG-UI-05 | 消费方 token 槽位全栈审计 + 修正 + DataTable 行分割线落地 | sonnet | `packages/admin-ui/src/**`、`apps/server-next/src/**`、`docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md` | CHG-UI-04 |
| CHG-UI-06 | 视觉走查 + 基线归档 + arch-reviewer 评级 | sonnet（评级 spawn opus arch-reviewer） | `tests/visual/admin-ui-tokens/*`、`docs/audit_seq_20260503_01_<date>.md` | CHG-UI-02..05 |

总规模：6 张卡，估算 14–20 工时（CHG-UI-05 范围扩展后上调）。

**模型路由说明**：CHG-UI-04 触动 state.ts 是**跨 3+ 消费方的语义契约变更**（CLAUDE.md §模型路由规则第 2 条），强制 opus 主循环或 spawn opus 子代理出方案。

---

## 6. 共性门禁（每张卡必须通过）

延续 SEQ-20260502-01 的"设计对齐复核"机制：

1. **设计对齐复核**：对照 `docs/designs/screenshot/videos-design.png` + `tokens.css`，输出 ≥ 5 项核对（surface 反差、border 可见性、fg 对比度、pill 软底色、整体灰度梯度），不允许"实现了即通过"。
2. **typecheck + lint + unit**：全绿。
3. **token 引用校验**：`node packages/design-tokens/scripts/verify-token-references.mjs` 全绿（确保未引入未声明变量）。
4. **token 生成同步**：改 TS 源后必须运行 `pnpm --filter @resovo/design-tokens build`（或等价命令），并把生成产物 `dist/tokens.css` + `src/css/tokens.css` 一并 commit。
5. **CHG-UI-04 + CHG-UI-06**：spawn `arch-reviewer` (claude-opus-4-7) 评级，PASS 后 commit。
6. **视觉基线**：CHG-UI-02..05 各自归档 dark + light 截图至 `tests/visual/admin-ui-tokens/<chg>/`，未通过则不得合并。

---

## 7. 风险登记

| 风险 | 缓解 |
|---|---|
| state.ts 重写后所有 admin chip 视觉漂移，可能引发"已通过/待审"等业务态识别困难 | CHG-UI-04 完成时强制 spawn opus arch-reviewer 全量评级；保留两周观察窗口；如业务反馈不可接受，回滚此卡（独立 commit） |
| `gray.925` 新增 primitive 档位，下游 brand override 可能未声明 | 在 `packages/design-tokens/src/brands/default.ts` 同步落 `gray.925`；`scripts/validate-tokens.ts` 加测试 |
| DataTable border-bottom 与最后一行视觉冲突（双线） | `tbody tr:last-child { border-bottom: none }` 保险措施 |
| dark `--fg-default` 收暗后旧截图视觉 diff 失败 | 视觉基线全量重录（在 CHG-UI-06 内统一处理） |
| 与未来 brand override（其他品牌色）冲突 | 本期不动 `accent.*` 与品牌主色，仅动 gray/status/border 中性轴 |
| CHG-UI-05 范围扩展后 commit 体积过大、不可逆性升级 | 强制按文件类拆分 commit（topbar / data-table / sidebar / pill-consumers 各独立 commit）；scan report 先行归档作为 PR 描述；超 60 处错位拆 CHG-UI-05a/b 分批 |
| CHG-UI-05 扫描发现 pill 消费方依赖 CHG-UI-04 已落地的 state token 形态 | CHG-UI-05 启动前确认 CHG-UI-04 已 PASS；如未完成，CHG-UI-05 仅做 surface/border/fg 槽位修正，pill 部分推迟到 CHG-UI-04 完成后追加（独立 commit） |

---

## 8. 与现有序列关系

- **不与 SEQ-20260502-01 冲突**：后者已暂停，本序列改的是 token 层而非业务页面，且本序列不会在 admin/moderation 业务文件上做改动（仅当 CHG-UI-04 走查时被动接受视觉变更）。
- **不与 M-SN-4 收口冲突**：M-SN-4 收口 (CHG-SN-4-10) 还需视觉 baseline 9 张归档；本序列在收口前完成可避免重录基线，建议优先于 SEQ-20260502-01 返回前推进。
- **不与 SEQ-20260429-02 设计稿对齐改造冲突**：那批改的是 admin-ui 一体化 DataTable 组件结构；本批改的是 token 层颜色映射，互不重叠。

---

## 9. 后续衔接（不在本批范围）

- **第二批**：行密度 token（row-h / row-h-compact）、封面尺寸 token、间距 token 与设计稿 `--s-*` 对齐
- **第三批**：表格 chip 11 色（`--tag-chip-*`）饱和度回收（与本期 state alpha-soft 风格统一）
- **第四批**：视频库列表页"工具栏 4 个 dropdown → 集成菜单"结构改造（业务层，不在 token 范围）

待第一批完成后，按改动收敛度评估是否合并第二/三批为同序列。

---

## 10. 验收

序列完成判据：
- 6 张卡全部 ✅
- arch-reviewer 评级 ≥ B+
- 视觉基线 ≥ 8 张归档（4 页 × 2 主题）
- 设计稿截图与实现截图肉眼差距 < 5%（颜色与边框层）
- `docs/designs/backend_design_v2.1/token-slot-audit-report-20260503.md` 全部条目 ✅ 修正（来自 CHG-UI-05 扫描）
- changelog.md 追加完整记录
- 在 `docs/decisions.md` 追加 ADR-111（state pill alpha-soft 双主题统一决策；编号沿现行 ADR-NNN 连续约定，CHG-UI-04 完成时回填正式决策内容）
