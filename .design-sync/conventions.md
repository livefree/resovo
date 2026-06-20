# @resovo/admin-ui — 使用约定（后台管理组件库）

国际化视频资源聚合平台 Resovo 的**后台管理**组件库。深色优先、信息密集的运营/审核界面。所有组件已挂在 `window.ResovoAdminUI.*`，从 `'@resovo/admin-ui'` 导入即可。

## 包裹与初始化：无需 Provider

**不要包任何 Provider。** 本库刻意零 `BrandProvider` / `ThemeProvider` —— 组件直接读 `:root` 上的 CSS 变量。只要绑定的 `styles.css`（已 `@import` 全部 token）被加载，组件即正确出样。无根 wrapper、无 context 依赖、无主题对象。

- **主题**：默认浅色；深色在任一祖先元素加 `data-theme="dark"`（CSS 变量随之切换，组件无需改 props）。
- **图标**：零图标库依赖。需要图标的 props（`leftIcon` / `rightIcon` / `illustration` 等）由你注入 `ReactNode`（自绘 SVG 或任意图标库元素）。

## 样式惯用法：用 props，不用 class

**本库无任何 utility class、无 className 样式体系。** 表达设计意图的方式有二：

1. **组件层 —— 通过语义 props**（这是主路径）：
   - 视觉变体：`<AdminButton variant="primary|secondary|default|ghost|danger" size="sm|md|lg">`
   - 状态色：`<AdminCard status="ok|warn|danger">`、`<KpiCard variant="default|is-ok|is-warn|is-danger">`、`<Pill variant=…>`、cell 类用 `probeState` / `renderState` 等枚举
   - 表单态：`<AdminInput error size=…>`、`<AdminSelect multiple error>`
2. **你的布局 glue —— 内联 style + CSS 变量**（组件之间的排布）：用 `var(--*)` token，绝不写死颜色/间距。

**Token family（真实变量名，定义在绑定的 `styles.css` 闭包内）：**

| 用途 | 变量 |
|---|---|
| 背景 | `--bg-canvas` `--bg-surface` `--bg-surface-raised` `--bg-surface-row` `--bg-surface-sunken` |
| 前景文字 | `--fg-default` `--fg-muted` `--fg-subtle` `--fg-on-accent` `--fg-disabled` |
| 边框 | `--border-default` `--border-strong` `--border-subtle` `--border-focus` |
| 强调（品牌蓝） | `--accent-default` `--accent-hover` `--accent-muted` `--accent-fg` |
| 状态色 | `--state-{success,warning,error}-{bg,fg,border}` |
| 间距 / 圆角 | `--space-1…--space-16` `--radius-{sm,md,lg,full}` |
| 字号 / 字体 | `--font-size-{xs,sm,base,lg}` `--font-family-sans` `--font-family-mono` |
| 阴影 / 层级 | `--shadow-{sm,md,lg}` `--z-{dropdown,sticky,overlay,modal,popover,toast}` |

> 颜色用 `oklch()`，明暗两套值已按 `data-theme` 自动切换 —— 你只引用语义变量即可，永远不要硬编码十六进制色。

## 真源在哪

- **样式真值**：绑定的 `styles.css` 及其 `@import`（`tokens/tokens.css` 全量 token + `tokens/_ds-sync-aliases.css` 别名层）。改样式前先读它确认变量名。
- **组件 API**：每个组件的 `<Name>.d.ts`（props 契约）+ `<Name>.prompt.md`（用法 + 示例）。复合组件（DataTable / KpiCard / DecisionCard / MetadataStatusPanel）的结构化入参务必按 `.d.ts` 给全字段，缺字段会塌陷。

## 一个惯用组合示例

```tsx
import { AdminCard, AdminButton, KpiCard, Spark } from '@resovo/admin-ui'

// 组件用 props 表达视觉；外层排布用内联 style + token 变量
function ReviewPanel() {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-4)', padding: 'var(--space-6)', background: 'var(--bg-canvas)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
        <KpiCard label="待审视频" value="484" variant="is-warn"
          delta={{ text: '较昨日 +18', direction: 'flat' }}
          spark={<Spark data={[40, 44, 41, 47, 46, 48]} color="var(--state-warning-fg)" />} />
      </div>
      <AdminCard status="ok">
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <AdminButton variant="ghost">取消</AdminButton>
          <AdminButton variant="primary">通过</AdminButton>
          <AdminButton variant="danger">拒绝</AdminButton>
        </div>
      </AdminCard>
    </div>
  )
}
```
