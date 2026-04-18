# UI 规则冲突收口清单（2026-03-27）

> status: archived
> owner: @engineering
> scope: reconcile ui-rules and frontend/admin ui governance plan
> source_of_truth: no
> supersedes: none
> superseded_by: none
> last_reviewed: 2026-03-27

## 1. 目的

本文件用于解决以下两份文档之间的层级和执行冲突：

1. `docs/rules/ui-rules.md`
2. `docs/frontend_admin_ui_governance_plan_20260327.md`

目标不是保留双重指令，而是明确：

1. 当前执行应以谁为准
2. 哪些规则保留
3. 哪些规则升级
4. 哪些内容只是未来治理方向，尚未进入执行层

---

## 2. 当前唯一优先级

在本轮收口完成前，执行优先级如下：

1. `CLAUDE.md`
2. `docs/rules/ui-rules.md`
3. `docs/frontend_admin_ui_governance_plan_20260327.md`

解释：

1. `ui-rules.md` 是当前直接约束前端实现的规则文件，应视为“现行执行规则”。
2. `frontend_admin_ui_governance_plan_20260327.md` 是上位治理方案，负责定义未来的统一目标和迁移方向。
3. 治理总纲中的规则，只有在被并入 `ui-rules.md` 或 `CLAUDE.md` 后，才视为正式执行规则。

结论：

1. 当前开发若遇到冲突，先按 `ui-rules.md` 执行。
2. 当前治理工作应以“把治理总纲收敛进规则层”为第一优先级，而不是直接开始全面实现。

---

## 3. 冲突与收口结论

## 3.1 适用范围冲突

### 现状

1. `ui-rules.md` 标题为“前端组件规范”，适用范围写的是 `src/components/`、`src/app/` 所有前端文件。
2. 新治理总纲要求前台与后台共用同一套 UI 基线、基础组件和页面模式。

### 冲突

`ui-rules.md` 的命名和范围表达偏“前台前端”，无法清晰覆盖后台和系统页。

### 收口结论

1. 短期：继续把 `ui-rules.md` 当作现行前端规则使用。
2. 中期：将 `ui-rules.md` 升级为“前后台共享 UI 实现规则”，或拆成：
   - `docs/rules/ui-foundations.md`
   - `docs/rules/ui-implementation-rules.md`

## 3.2 颜色体系层级冲突

### 现状

1. `ui-rules.md` 当前只定义了少量 CSS 变量：`--background`、`--secondary`、`--foreground`、`--muted-foreground`、`--border`、`--accent`、`--accent-foreground`、`--gold`。
2. 新治理总纲要求使用三层 token：global、semantic、component。

### 冲突

当前规则足以限制“不要硬编码”，但不足以支撑系统级统一，也缺少语义状态色和组件 token 层。

### 收口结论

1. 保留 `ui-rules.md` 中“禁止硬编码颜色”的现行规则。
2. 将“三层 token”视为下一轮必须正式并入的升级项。
3. 在 token 体系正式落地前，不强制要求页面直接改用新命名，但禁止继续新增硬编码视觉值。

## 3.3 交互规则完整度冲突

### 现状

1. `ui-rules.md` 只对播放器浮层、国际化、响应式、性能做了局部规范。
2. 新治理总纲新增了更完整的交互规则：focus、disabled、loading、error、empty、destructive action、toast 文案、状态命名。

### 冲突

不是规则互相否定，而是现行规则明显不完整。

### 收口结论

1. `ui-rules.md` 的现有具体规则继续有效。
2. 新治理总纲中关于基础交互、状态命名、反馈方式的部分，应被视为下一轮并表目标。
3. 在并表前，这些条目属于“推荐治理方向”，不是硬性执行规则。

## 3.4 组件出口约束冲突

### 现状

1. `ui-rules.md` 目前没有明确规定“页面只能从统一 primitives / patterns 出口导入”。
2. 新治理总纲要求建立 `design-system/primitives` 和 `design-system/patterns` 唯一出口。

### 冲突

仓库当前并不存在完整的统一出口，因此如果直接把该条当成硬规则，会造成规则先于实现。

### 收口结论

1. 当前不能把“必须从 `@/design-system/primitives` 导入”当作现行规则。
2. 现阶段正确规则应是：
   - 禁止新增绕过现有 shared 组件的并行基础控件
   - 新的统一出口建立后，再升级为强制 import 边界规则

## 3.5 页面模式组件化冲突

### 现状

1. `ui-rules.md` 没有定义页面模式层。
2. 新治理总纲要求组件化页面骨架，例如 `ListPageShell`、`DetailSection`、`SettingsPageShell`。

### 冲突

这是治理层新增要求，不是当前仓库已有事实。

### 收口结论

1. 当前不能要求所有页面立即使用页面模式组件。
2. 这应作为迁移目标写入实施计划，而非立即当作验收门槛。
3. 新页面若属于高频模式，应优先抽象成模式组件，而不是继续页面内散写。

## 3.6 “下一步建议”冲突

### 现状

1. 新治理总纲原版本提出的下一步包括创建 `design-system/tokens` 与 `design-system/primitives` 目录骨架。
2. 当前执行上，`ui-rules.md` 与治理总纲尚未并表，直接开始搭建 design system 会让“规则层”和“实现层”继续分离。

### 冲突

执行顺序前后倒置。

### 收口结论

唯一正确顺序应为：

1. 先做规则冲突收口
2. 再明确唯一执行规则
3. 再创建 design system 骨架
4. 再开始样板页迁移

---

## 4. 保留、升级、延后清单

## 4.1 立即保留为现行规则

以下规则继续立即生效：

1. 禁止硬编码颜色
2. 使用 CSS 变量表达主题基础
3. `cn()` 合并 `className`
4. `next-intl` 国际化规则
5. 响应式断点规则
6. 图片、虚拟滚动、懒加载等性能规则
7. 播放器组件特殊规则
8. 后台表格规范仍以 `CLAUDE.md` 为准

## 4.2 必须升级进规则层

以下内容应在下一轮升级为正式规则：

1. token 三层结构
2. 语义状态色体系
3. 状态命名字典
4. loading / error / empty / disabled 统一规则
5. destructive action 分级确认
6. 页面模式层约束
7. 唯一组件出口与 import 边界规则

## 4.3 暂不作为硬规则

以下内容暂时只能作为实施目标，不立即硬性要求：

1. 所有页面必须使用 `design-system/primitives`
2. 所有页面必须使用 `design-system/patterns`
3. 所有旧页面立即迁移到统一页面模式

---

## 5. 唯一执行顺序

后续应统一按以下顺序执行：

1. 收口规则层：更新 `ui-rules.md`，吸收治理总纲中已经可以执行的部分
2. 明确边界：哪些仍是目标、哪些已是规则
3. 建立 design system 骨架：tokens / primitives / patterns
4. 选择样板页迁移
5. 加入 lint / import-boundary / review-checklist
6. 分阶段推广到前台、后台、系统页

---

## 6. 建议的文档收口动作

1. 更新 `docs/rules/ui-rules.md`
   - 明确其为当前 UI 实现规则
   - 增加与治理总纲的关系说明
2. 更新 `docs/frontend_admin_ui_governance_plan_20260327.md`
   - 将“下一步建议”改为先收口规则，再启动 design system
3. 未来再决定是否拆出：
   - `ui-foundations`
   - `ui-implementation-rules`

---

## 7. 本轮结论

如果你在“规则文件”和“治理总纲”之间看到不一致，应按以下方式理解：

1. `ui-rules.md` 决定现在怎么写
2. `frontend_admin_ui_governance_plan_20260327.md` 决定未来要收敛成什么样
3. 本文件决定二者如何收口，以及收口前谁优先

因此，当前你应该听的是：

1. 实现时，听 `ui-rules.md`
2. 治理时，听本文件定义的收口顺序

