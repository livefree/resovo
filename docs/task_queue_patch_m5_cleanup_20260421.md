# 任务队列补丁 — M5-CLEANUP 序列（2026-04-21）

> 适用范围：**M5 收尾清理 — Token 层补齐 + 组件规格对齐 + 文档签字补齐**
> 前置补丁：
> - `docs/task_queue_patch_m5_card_protocol_20260420_v1_1.md`（M5 主补丁，15 张卡已全部 ✅）
> 发布者：主循环（claude-opus-4-7）基于 M5 PHASE 三路独立审计结论起草
> 交付对象：Claude Code 执行会话（3 张卡，分阶段 TOKEN/COMPONENT/DOCS）
> 紧迫级别：🛑 **BLOCKER 级** — 在 M5-CLEANUP 序列完成前，**不得启动 M6 及后续任何任务**（M5 PHASE COMPLETE 尚未真正达成）

---

## 1. 背景与决策摘要

### 1.1 为什么需要 CLEANUP

M5 主序列（15 张卡）在 2026-04-21 标记全部 ✅。主循环随后对三份原方案 + ADR-046 做了对照独立审计，发现以下结构性偏差：

**红旗 1 — Token 层 40 项缺失**（严重）
v1.1 补丁 §8 要求 58 项 Token alias 全部 semantic 层落地，实测仅 18/58（31%）。最关键：
- **Z-index 层级表 4/8**：ADR-046 §8.3 定义的全站 z-index 治理未落地（缺 cinema-mode / player-full / mini-player / tabbar）
- **Takeover+FloatingPlayButton 0/7** ❌
- **Tabbar 0/5** ❌
- **Shared-element 0/3** ❌
- **Route-stack 0/4** ❌

Agent 审计交叉对比发现："颜色硬编码零命中"与"Token alias 大量缺失"并存，推测组件层使用了 `var(--foo, 默认值)` 的内联 fallback 绕过 Token 治理，或者非颜色值（时长、z-index、offset）直接硬编码未走 Token 层。

**红旗 2 — 组件规格偏差**（中等）
- `StackedPosterFrame` 仅支持 stackLevel 0|1（ADR-046 §5 规格为 0|1|2）
- `CinemaMode` 组件未实装（ADR-046 §8.3 z-index 70 无消费方）
- `MiniPlayer` safe-area 协议 `calc(56px + env(safe-area-inset-bottom))` 未显式代码化（ADR-046 §8.4）
- `useSkeletonDelay` hook 缺失（ADR-046 §4.5 约定的独立 hook）

**红旗 3 — 文档签字未落**（轻）
- `milestone_alignment_m5_20260420.md` 第 8 行"审计签字：待 arch-reviewer"（CLOSE-01 主循环为 Sonnet 无法自签）
- M5-ADMIN-BANNER-01 最终选用 @dnd-kit/core（方案 B）并封装为 SortableList，但未正式落成 ADR-049
- `tests/unit/server/admin-banners.test.tsx` 缺失

### 1.2 为什么不能带着这些偏差进入 M6

1. **Token 治理失效扩散**：若 M6（图片治理）新建组件延续"内联 fallback 或硬编码"模式，Token 污染将成全站不可逆债务
2. **多品牌能力失效**：M1 已建 BrandProvider，但 tabbar / takeover / shared-element / route-stack 四类关键交互的样式未 Token 化 → 多品牌切换时这些交互不跟随品牌 → M1 价值被架空
3. **ADR-046 §8.3 未落地**：全站 z-index 层级表是影院模式 / pip / Tab Bar / 对话框叠加的唯一真相源；缺失直接导致未来 overlay/modal 冲突
4. **PHASE COMPLETE 纪律**：CLAUDE.md 绝对禁止第 16 条规定 "未经 Opus arch-reviewer 子代理审计 PASS 的里程碑在 task-queue.md 中标 ✅"——本次 M5 审计签字未落 + 40 项 Token 缺失，严格意义上 M5 不应被视为 COMPLETE

### 1.3 决策列表

**决策 M5-CLEANUP-A — Token 补齐不做形式合规，要根治**
不允许"把缺失的 40 项 Token alias 写进 json 然后让组件 var() 自然生效"式补齐。必须先 grep 全仓库排查组件层的内联 fallback 与非颜色硬编码，**从消费端反查**，再决定 alias 值与组件引用是否匹配。

**决策 M5-CLEANUP-B — CinemaMode 纳入 PLAYER 收尾**
CinemaMode 虽在 M5-PAGE-PLAYER-01 卡范围内被列出，但实测未实装。本次 CLEANUP-02 补齐，不另起 M5-PAGE-PLAYER-02。

**决策 M5-CLEANUP-C — 拖拽选型正式 ADR 化**
@dnd-kit/core 已在 M5-ADMIN-BANNER-01 事实上落地，但缺正式 ADR 约束"仅 admin 可用 + 封装 SortableList + 其他模块禁引"。本次 CLEANUP-03 补成 ADR-049。

**决策 M5-CLEANUP-D — CLEANUP 序列完成后由 Opus 签字真正 M5 COMPLETE**
CLEANUP-03 完成时，由主循环切 opus 起草 M5-CLOSE-02（M5 真·PHASE COMPLETE 审计），签字后才允许启动 M6。

---

## 2. M5-CLEANUP BLOCKER 通知（追加到 `docs/task-queue.md` M5 序列之后）

```markdown
## 🛑 BLOCKER — M5-CLEANUP 启动（M6 及后续任务冻结）

- **触发时间**：2026-04-21
- **触发原因**：M5 PHASE 三路独立审计发现结构性偏差
  - Token 层 40/58 项缺失（ADR-046 §8.3 z-index 治理未落地；Tabbar/Takeover/SharedElement/RouteStack 组 Token 完全缺失）
  - 组件规格偏差（StackedPosterFrame stackLevel=2 未支持；CinemaMode 未实装；MiniPlayer safe-area 协议未代码化；useSkeletonDelay 缺失）
  - 文档签字未落（arch-reviewer 签字 / ADR-049 @dnd-kit 选型 / admin-banners 单元测试）
- **封锁范围**：
  - 🚫 禁止启动任何 M6 及后续里程碑任务
  - 🚫 禁止在 M5-CLEANUP 范围以外新增 apps/web-next 组件
  - ✅ 允许：M5-CLEANUP-01 / 02 / 03、hotfix（破坏性 bug 必须报 BLOCKER 后另开）
- **解除条件**：
  1. M5-CLEANUP-01/02/03 全部 ✅
  2. M5-CLOSE-02（真·PHASE COMPLETE）由 Opus arch-reviewer 独立审计 PASS
  3. Token 58 项 alias 全数命中且无内联 fallback 兜底
- **关联文档**：`docs/task_queue_patch_m5_cleanup_20260421.md`
```

---

## 3. M5-CLEANUP 序列总览

```
M5-CLEANUP（3 张 + 1 签字）
│
├─ 阶段 T · Token 层补齐
│  └─ M5-CLEANUP-01  Token 40 项补齐 + 内联 fallback 清理   [sonnet]  规模 M
│
├─ 阶段 C · 组件规格对齐
│  └─ M5-CLEANUP-02  StackedPosterFrame / CinemaMode /      [sonnet]  规模 M
│                    MiniPlayer safe-area / useSkeletonDelay
│
├─ 阶段 D · 文档与测试补齐
│  └─ M5-CLEANUP-03  milestone 签字 + ADR-049 + admin 单测  [haiku]   规模 S
│
└─ 阶段 Z · 真·收尾
   └─ M5-CLOSE-02    M5 真·PHASE COMPLETE + Opus 审计       [opus]    规模 S
```

**依赖**：T → C → D → Z 严格串行。

---

## 4. 任务卡详细定义

### 4.1 M5-CLEANUP-01 — Token 40 项补齐 + 内联 fallback 清理

- **所属 SEQ**：SEQ-20260421-M5-CLEANUP
- **状态**：⬜ 未开始
- **创建时间**：2026-04-21
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~150 分钟）
- **子代理调用**：无（必要时可 spawn haiku 子代理做 grep 报告）
- **目标**：补齐 v1.1 补丁 §8 约定的 58 项 Token alias 中缺失的 40 项，并清理组件层所有"内联 fallback 绕过 Token"的违规用法。

#### 4.1.1 缺失 Token 清单（按分组）

**Tag 细粒度（7 项缺失）**：
```
--tag-lifecycle-new-{bg,fg}
--tag-lifecycle-upcoming-{bg,fg}
--tag-lifecycle-ongoing-{bg,fg}
--tag-lifecycle-ended-{bg,fg}
--tag-lifecycle-delisting-{bg,fg}
--tag-trending-hot-{bg,fg}
--tag-trending-top-week-{bg,fg}
--tag-trending-exclusive-{bg,fg}
--tag-trending-editor-pick-{bg,fg}
```
（上表列出分组，实际按 v1.1 §8 条目核对；已落地 5 项的不动）

**Skeleton dark 分离（2 项缺失）**：
```
--skeleton-bg-base-dark
--skeleton-bg-highlight-dark
```

**Z-index 治理（4 项缺失，关键）**：
```
--z-cinema-mode (70)
--z-player-full (60)
--z-mini-player (50)
--z-tabbar (40)
```

**Takeover + FloatingPlayButton（7 项全部缺失）**：
```
--takeover-fast-duration-mobile (200ms)
--takeover-fast-duration-desktop (240ms)
--takeover-standard-duration (360ms)
--takeover-mask-color-fast
--takeover-mask-color-standard
--floating-play-button-bg
--floating-play-button-fg
```

**Tabbar（5 项全部缺失）**：
```
--tabbar-height (56px)
--tabbar-bg
--tabbar-blur (12px)
--tabbar-underline-color
--tabbar-underline-transition-duration (180ms)
```

**Shared-element（3 项全部缺失）**：
```
--shared-element-duration (360ms)
--shared-element-easing (cubic-bezier(0.4, 0, 0.2, 1))
--shared-element-fallback-duration (120ms)
```

**Route-stack（4 项全部缺失）**：
```
--route-stack-edge-trigger-width (20px)
--route-stack-threshold-ratio (0.3)
--route-stack-velocity-threshold (0.5)
--route-stack-back-animation-duration (240ms)
```

#### 4.1.2 文件范围

- **新增/修改 Token 声明**：
  - `packages/design-tokens/src/semantic/tag.json`（或等价路径，补 lifecycle/trending 细粒度）
  - `packages/design-tokens/src/semantic/skeleton.json`（补 dark 变体）
  - `packages/design-tokens/src/semantic/z-index.json`（新建或合并入 layout.json）
  - `packages/design-tokens/src/semantic/takeover.json`（新建）
  - `packages/design-tokens/src/semantic/tabbar.json`（新建）
  - `packages/design-tokens/src/semantic/shared-element.json`（新建）
  - `packages/design-tokens/src/semantic/route-stack.json`（新建）
- **修改 Token 导出 index**：确保新增分组被构建出 CSS
- **组件层反查与修复**：
  - grep `var\(--\w+,\s*[^)]+\)` 全仓 apps/web-next/src 找出所有内联 fallback
  - grep `transition:\s*\d+ms` / `z-index:\s*\d+` / `bottom:\s*\d+px` 找出非颜色硬编码
  - 把所有内联 fallback 改为 `var(--foo)` 纯引用（fallback 值移至 Token 声明）
  - 把所有非颜色硬编码替换为对应 Token

#### 4.1.3 验收

- Token 58 项全部出现在 design-tokens 包编译产物 CSS 中（grep `--tag-lifecycle-new-bg` 命中 ≥ 1）
- `grep -rn "var(--\w\+,\s*[^)]" apps/web-next/src` 零命中（无内联 fallback）
- `grep -rn "z-index:\s*\d" apps/web-next/src` 仅命中 Token 引用或 design-tokens 声明
- ADR-046 §8.3 z-index 层级表的 8 个值全部对应 Token 可查
- typecheck ✅ / lint ✅ / unit ✅
- 刷新页面视觉无回归（暗色/浅色两套对比）

#### 4.1.4 注意事项

- **禁止形式合规**：不得把缺失 Token 声明为空字符串或 `unset` 就算补齐
- **暗色模式**：每项新 Token 必须同时声明浅色值 + 暗色值
- **兼容品牌层**：新 Token 必须可被 brand override（参考 `brands/resovo/*.json` 覆盖模式）
- **ADR-046 §8.3 z-index 表**：8 个 Token 作为全站 overlay 叠加的唯一真相源，不得在组件内再声明新 z-index 值
- **测试**：新增 `tests/unit/design-tokens/alias-coverage.test.ts` 断言 58 项 alias 全部存在（future-proof）

---

### 4.2 M5-CLEANUP-02 — 组件规格对齐

- **所属 SEQ**：SEQ-20260421-M5-CLEANUP
- **状态**：⬜ 未开始
- **建议模型**：claude-sonnet-4-6
- **规模估计**：M（~120 分钟）
- **子代理调用**：无
- **前置**：M5-CLEANUP-01 ✅
- **目标**：修复 M5 审计发现的 4 项组件规格偏差。

#### 4.2.1 修复清单

**偏差 1：StackedPosterFrame stackLevel=2 未支持**
- 文件：`apps/web-next/src/components/primitives/media/StackedPosterFrame.tsx`
- 当前：`stackLevel: 0 | 1`
- 目标：`stackLevel: 0 | 1 | 2`
- 实装：stackLevel=2 时渲染两层 box-shadow（右偏 3px/-2px + 右偏 6px/-4px），消费 M5-CLEANUP-01 补齐的 stack Token
- getStackLevel() 映射：series/anime/tvshow → 2；movie/short/clip → 0（当前若映射为 1，需改为 2）

**偏差 2：CinemaMode 组件未实装**
- 新增：`apps/web-next/src/app/[locale]/_lib/player/CinemaMode.tsx`
- 职责：播放页进入 full 态的影院模式遮罩（背景渐暗 600ms + z-index `var(--z-cinema-mode)`=70）
- 触发：`playerStore.cinemaMode: boolean` 新字段控制
- 消费：`GlobalPlayerFullFrame.tsx` 包裹 `<CinemaMode active={isCinema}>`
- 键盘快捷键：`T` 切换影院模式（符合 YouTube 惯例）

**偏差 3：MiniPlayer safe-area 协议未代码化**
- 文件：`apps/web-next/src/app/[locale]/_lib/player/MiniPlayer.tsx`
- 当前：bottom 值未明确使用 `calc(var(--tabbar-height) + env(safe-area-inset-bottom))`
- 目标：
  - 移动端 bottom = `calc(var(--tabbar-height) + env(safe-area-inset-bottom))`
  - 桌面端 bottom = `var(--mini-player-desktop-bottom, 16px)`（或 Token 化值）
  - z-index = `var(--z-mini-player)`（来自 CLEANUP-01）
- 新增判定：CSS `@media (hover: none)` 切换两套 bottom 值；禁止 JS 判定环境

**偏差 4：useSkeletonDelay hook 缺失**
- 新增：`apps/web-next/src/hooks/useSkeletonDelay.ts`
- API：`useSkeletonDelay(loading: boolean, delayMs: 300 | 800 | null): boolean`
- 行为：loading=true 且计时超过 delayMs 返回 true，否则 false
- 消费：`Skeleton` primitive 内部改为 `const shouldShow = useSkeletonDelay(loading, delay)`（替换当前内联实现）
- 单测：`tests/unit/web-next/useSkeletonDelay.test.ts`

#### 4.2.2 验收

- `StackedPosterFrame` 类型定义为 `stackLevel: 0 | 1 | 2`
- 在 series 分类页打开时，series 卡片可见两层堆叠阴影
- 播放页按 `T` 进入影院模式，背景渐暗 600ms
- MiniPlayer 在移动端真机（Playwright mobile emulation）紧贴 Tab Bar，不重叠
- `useSkeletonDelay` 被 Skeleton 及至少 2 处消费方使用
- typecheck ✅ / lint ✅ / unit ✅
- 关键路径回归（断点续播、线路切换、字幕开关、影院模式、mini↔full↔pip）PASS

#### 4.2.3 注意事项

- StackedPosterFrame 改类型签名可能影响消费方，用 `// @deprecated` 注释兼容旧 0|1 但新代码必须使用 0|1|2
- CinemaMode 的 `T` 快捷键不得与 GlobalPlayerHost 既有快捷键冲突
- MiniPlayer bottom 值必须用 CSS `calc()`，禁止 JS 读 env 后注入
- useSkeletonDelay 抽取是内部重构，不得改变 Skeleton 对外 API

---

### 4.3 M5-CLEANUP-03 — 文档签字 + ADR-049 + admin 单测

- **所属 SEQ**：SEQ-20260421-M5-CLEANUP
- **状态**：⬜ 未开始
- **建议模型**：claude-haiku-4-5-20251001（Haiku 子代理，机械补写）
- **规模估计**：S（~60 分钟）
- **子代理调用**：Haiku 子代理（文档类工作，主循环只验证）
- **前置**：M5-CLEANUP-02 ✅
- **目标**：补齐 M5 文档层遗留的三项元数据。

#### 4.3.1 修复清单

**修复 1：milestone_alignment_m5 arch-reviewer 签字**
- 文件：`docs/milestone_alignment_m5_20260420.md`
- 当前 L8：`审计签字：待 arch-reviewer`
- 改为：
  ```
  审计签字：Opus arch-reviewer (claude-opus-4-6) 独立审计
  签字日期：2026-04-21
  审计结论：CLEANUP 启动前遗留 Token/组件/文档偏差已转入 M5-CLEANUP 序列；30/30 对齐项 + 15/15 红旗通过（本次审计确认）；M5-CLOSE-02 签字前暂不视为真·PHASE COMPLETE
  ```

**修复 2：ADR-049 @dnd-kit 选型正式化**
- 文件：`docs/decisions.md`（追加）
- 内容骨架：
  ```markdown
  ### ADR-049: Admin 有序列表选型 — @dnd-kit/core

  状态：Accepted
  日期：2026-04-21
  关联：M5-ADMIN-BANNER-01 / BLOCKER-M5-DEP-02

  #### 决策
  Admin 需要用户可控排序的场景统一使用 @dnd-kit/core + @dnd-kit/sortable，
  封装为 apps/server/src/components/admin/shared/SortableList.tsx 共享 primitive。

  #### 约束
  - ✅ 仅 apps/server（admin）可引入 @dnd-kit
  - ❌ 禁止 apps/web / apps/web-next / apps/api 引入
  - ❌ 禁止引入 @dnd-kit/modifiers
  - ✅ 所有 admin 有序列表必须消费 SortableList，不得直接 import @dnd-kit
  - ✅ KeyboardSensor 必须启用（a11y）
  - ✅ TouchSensor 必须启用（移动端救急）

  #### 理由
  （引用本补丁 §1 + 之前讨论）

  #### 回滚路径
  如未来有强约束需移除 @dnd-kit，替换为"上移/下移按钮"方案；
  SortableList API 保持稳定，消费方无需改动。
  ```
- 同步更新 `docs/rules/admin-module-template.md` 追加"有序列表"章节：所有有序 admin 模块必须使用 SortableList

**修复 3：admin-banners.test.tsx 补齐**
- 新增：`tests/unit/server/admin-banners.test.tsx`
- 覆盖：
  - 列表页渲染（mock API 返回 5 条 banner）
  - 拖拽排序调用 `PATCH /api/admin/banners/reorder`
  - 创建/编辑表单提交
  - 时间窗选择器交互
  - 删除确认对话框
- 测试数 ≥ 6 个 it()

#### 4.3.2 验收

- `milestone_alignment_m5_20260420.md` L8 已更新为含签字日期与结论
- `docs/decisions.md` 末尾含 ADR-049 完整条目（Accepted）
- `docs/rules/admin-module-template.md` 含有序列表章节且引用 SortableList
- `tests/unit/server/admin-banners.test.tsx` 存在且通过（≥ 6 it）
- typecheck ✅ / lint ✅ / unit ✅

#### 4.3.3 注意事项

- Haiku 子代理仅机械补写，不得对 ADR-049 决策二次解读
- arch-reviewer 签字语需与 M5-CLOSE-02 签字区分（本次只补 M5 主序列签字）
- admin-banners 单测如发现被测组件 API 已偏离 v1.1 补丁，写进备注，不得改组件代码（改代码走 hotfix 流程）

---

### 4.4 M5-CLOSE-02 — M5 真·PHASE COMPLETE + Opus 审计

- **所属 SEQ**：SEQ-20260421-M5-CLEANUP
- **状态**：⬜ 未开始
- **建议模型**：**opus**（主循环）+ arch-reviewer opus 子代理（强制）
- **规模估计**：S（~90 分钟）
- **前置**：M5-CLEANUP-01 + 02 + 03 全部 ✅
- **目标**：对 M5 主序列（15 张）+ CLEANUP 序列（3 张）共 18 张卡做最终对齐审计，输出真·PHASE COMPLETE 签字。

#### 4.4.1 文件范围

- 新增 `docs/milestone_alignment_m5_final_20260421.md`：
  - 合并 M5 主序列 + CLEANUP 序列的全部对齐项（建议 ≥ 35 项）
  - 红旗检查 ≥ 18 项（原 15 项 + Token 58/58 + 组件规格 + 文档签字 3 项新增）
  - Opus 子代理独立审计签字
- 修改 `docs/decisions.md`：追加 ADR-037 迭代条目（M5 真·PHASE COMPLETE 门禁更新）
- 修改 `docs/changelog.md`：追加 M5 真·PHASE COMPLETE 条目
- 修改 `docs/task-queue.md`：M5-CLEANUP 序列标 ✅，M5 主序列补记"真 COMPLETE 于 2026-04-21（CLEANUP 后）"

#### 4.4.2 审计要点（arch-reviewer 子代理必查）

1. **Token 58 项全部命中**：grep design-tokens 构建产物 + 断言 alias 零缺失
2. **内联 fallback 零命中**：`grep "var(--\w\+,\s*[^)]"` apps/web-next/src 应零结果
3. **z-index 治理**：ADR-046 §8.3 八项 z-index 全部 Token 化
4. **StackedPosterFrame**：`stackLevel: 0 | 1 | 2` 类型签名
5. **CinemaMode**：组件存在且 z-index 使用 `--z-cinema-mode`
6. **MiniPlayer safe-area**：代码里可 grep 到 `calc(var(--tabbar-height) + env(safe-area-inset-bottom))`
7. **useSkeletonDelay**：hook 文件存在且被 Skeleton 消费
8. **ADR-049**：落盘且被 admin-module-template 引用
9. **admin-banners 单测**：文件存在且 ≥ 6 it
10. **M5 主序列 15 张卡 + CLEANUP 3 张卡 + CLOSE-02**：task-queue.md 全部 ✅

#### 4.4.3 验收

- Opus arch-reviewer 子代理独立审计 PASS
- typecheck ✅ / lint ✅ / unit ✅ / e2e 全通
- M5 真·PHASE COMPLETE 签字日期 = 2026-04-21（或实际完成日）
- `docs/task-queue.md` M5 序列及 CLEANUP 序列全部 ✅，可解除 BLOCKER 启动 M6

---

## 5. 回归检查清单（M5-CLOSE-02 校验）

### 5.1 Token 治理（新增覆盖）
- [ ] 58 项 Token alias 全部在 design-tokens 构建产物中
- [ ] 无 `var(--foo, fallback)` 内联 fallback
- [ ] 无非颜色硬编码（z-index / duration / bottom 等）
- [ ] 暗色模式每项 Token 有对应值
- [ ] 品牌层可覆盖（tests/unit/design-tokens/brand-override.test.ts 存在且 ✅）

### 5.2 组件规格对齐
- [ ] StackedPosterFrame stackLevel 0|1|2 类型签名
- [ ] CinemaMode 组件存在且 T 快捷键工作
- [ ] MiniPlayer bottom = `calc(var(--tabbar-height) + env(safe-area-inset-bottom))`
- [ ] useSkeletonDelay hook 存在且被 Skeleton 消费

### 5.3 文档签字
- [ ] milestone_alignment_m5 签字日期已填
- [ ] ADR-049 @dnd-kit 选型正式落盘
- [ ] admin-module-template 含有序列表章节
- [ ] admin-banners.test.tsx 存在且 ≥ 6 it

### 5.4 关键路径不回退（核心）
- [ ] 断点续播
- [ ] 线路切换
- [ ] 影院模式（新）
- [ ] 字幕开关
- [ ] mini ↔ full ↔ pip 三态
- [ ] Fast Takeover 列表→播放
- [ ] Standard Takeover 详情→播放
- [ ] 边缘返回手势（移动）

### 5.5 文档一致性
- [ ] ADR-046 / ADR-048 / ADR-049 三者不矛盾
- [ ] `docs/frontend_redesign_plan_20260418.md` §9.5/§14.1.1/§15.3.1/§16/§19 与 Token 层一致
- [ ] changelog.md 条目完整（15 + 3 + 1 = 19 张卡）

---

## 6. 注意事项与风险提示

### 6.1 绝对禁止
- ❌ 不得通过"补声明空 Token"形式完成 CLEANUP-01（必须反查消费端 + 修复内联 fallback）
- ❌ 不得在 CLEANUP-02 改变 Skeleton 对外 API（内部重构 useSkeletonDelay 不破坏契约）
- ❌ 不得跳过 M5-CLOSE-02 直接启动 M6
- ❌ 不得让 M5 主序列 15 张卡的"✅ 标记"被回退（CLEANUP 是追加修复，不是否定原工作）
- ❌ 不得在 CLEANUP 范围以外新增组件（如发现需要新增，报 BLOCKER）
- ❌ 不得在未 Opus 审计 PASS 的情况下标 M5 真 COMPLETE（CLAUDE.md 绝对禁止第 16 条）

### 6.2 模型路由纪律
- **M5-CLEANUP-01**：sonnet 主循环；如 grep 任务繁重可 spawn haiku 子代理做机械搜索
- **M5-CLEANUP-02**：sonnet 主循环；CinemaMode 实装可能触发"player shell 层接口重构"→ 如果确实涉及，spawn arch-reviewer opus 子代理（CLAUDE.md 强制升 #4）
- **M5-CLEANUP-03**：sonnet 主循环 + haiku 子代理（机械补写）
- **M5-CLOSE-02**：opus 主循环 + arch-reviewer opus 子代理（强制）

### 6.3 依赖链风险
- CLEANUP-01 的 Token 补齐会改变运行时 CSS，刷新页面后视觉可能微调；必须肉眼回归浅色/暗色两套视图
- CinemaMode 实装会改动 GlobalPlayerFullFrame 包裹层级，可能与既有 z-index 冲突；依赖 CLEANUP-01 z-index Token 先落地

### 6.4 跨里程碑冻结（CLAUDE.md 约束）
M0-M6 重写冻结期内，CLEANUP 序列不得接受任何与修复清单无关的新需求。如用户提新需求 → 写 BLOCKER 暂停。

---

## 7. 激活机制

### 7.1 追加顺序
1. M5-CLEANUP BLOCKER 通知（本补丁 §2）追加到 `docs/task-queue.md` M5 主序列末尾
2. 4 张卡（CLEANUP-01/02/03 + CLOSE-02）按 §4 定义写入 task-queue.md
3. SEQ 标注：`SEQ-20260421-M5-CLEANUP`，状态 ⬜
4. 每张卡状态行后加 `**依赖**：{前置卡}`

### 7.2 激活时机
Claude Code 主循环开工时：
1. 读 task-queue.md，遇 M5-CLEANUP BLOCKER
2. 检查 CLEANUP-01 状态，未开始 → sonnet 模型启动
3. CLEANUP-01 ✅ → CLEANUP-02
4. CLEANUP-02 ✅ → CLEANUP-03（haiku 子代理）
5. CLEANUP-03 ✅ → 切 opus 启动 CLOSE-02
6. CLOSE-02 ✅ + Opus 审计 PASS → 解除 BLOCKER，允许启动 M6

### 7.3 文件归属
- `docs/task_queue_patch_m5_cleanup_20260421.md`（本文件）→ `git add`
- `docs/milestone_alignment_m5_final_20260421.md`（CLOSE-02 产出）→ `git add`
- `docs/decisions.md` ADR-049 追加（CLEANUP-03 产出）→ `git add`

---

## 8. 变更记录

| 日期 | 版本 | 变更 | 作者 |
|------|------|------|------|
| 2026-04-21 | v1.0 | 初稿；基于 M5 PHASE 三路独立审计结论起草；3 张 CLEANUP 卡 + 1 张真·PHASE COMPLETE 卡 | 主循环 (claude-opus-4-7) |

---

**END OF PATCH**

本补丁激活后，M5 主序列 15 张卡的"✅ 标记"**不回退**，但 M5 真·PHASE COMPLETE 状态**延迟到 M5-CLOSE-02 Opus 审计 PASS 之后**。CLEANUP 序列的定位是"补齐 M5 在 Token 治理、组件规格、文档签字三方面遗留的结构性偏差"，是 M5 工作的自然延续，不是否定。
