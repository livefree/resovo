# Resovo Lint 规则手册

> 创建日期：2026-04-18
> 来源任务：BASELINE-03

---

## 插件：`eslint-plugin-resovo`

源码位置：`tools/eslint-plugin-resovo/`  
Vitest 测试：`tests/unit/eslint-plugin/no-hardcoded-color.test.ts`

---

## 规则：`resovo/no-hardcoded-color`

### 目的

禁止在 TypeScript / React 代码中硬编码颜色值。所有颜色必须通过 CSS 变量（`var(--token-name)`）引用，确保主题切换与设计系统 Token 的一致性。

### 覆盖的颜色格式

| 格式 | 示例 |
|------|------|
| Hex 3 位 | `#fff`, `#abc` |
| Hex 4 位（含 alpha） | `#ffff`, `#abc8` |
| Hex 6 位 | `#ffffff`, `#1a2b3c` |
| Hex 8 位（含 alpha） | `#ffffff80`, `#1a2b3cff` |
| `rgb()` | `rgb(0, 0, 0)` |
| `rgba()` | `rgba(255, 255, 255, 0.5)` |
| `hsl()` | `hsl(200, 50%, 50%)` |
| `hsla()` | `hsla(200, 50%, 50%, 0.8)` |
| `oklch()` | `oklch(0.7 0.15 200)` |
| `color()` | `color(srgb 0.5 0.5 0.5)` |

### Severity

- **当前（M0–M1）**：`warn` — 不阻断 commit，方便存量代码迁移
- **升级计划**：TOKEN-13（M1 设计 Token 完整落地）完成后由后续任务升级为 `error`

### 豁免文件

以下路径的文件不触发规则：

| 路径模式 | 原因 |
|---------|------|
| `packages/design-tokens/src/primitives/color.ts` | Token 原始色值定义文件，必须硬编码 |
| `**/dist/**` | 构建产物，不检查 |
| `**/.next/**` | Next.js 构建产物 |
| `**/node_modules/**` | 第三方代码 |
| `tools/eslint-plugin-resovo/**` | 插件自身源码 |

### 临时豁免注释格式

```typescript
// eslint-disable-next-line resovo/no-hardcoded-color -- 待 M1 迁移
const overlay = "rgba(0, 0, 0, 0.7)"
```

- `--` 之后**必须**注明豁免理由，禁止空豁免
- 在 TOKEN-13 完成后，扫描所有 `待 M1 迁移` 注释并替换为正确的 Token 引用

### 正确用法

```typescript
// ✅ 正确：使用 CSS 变量
const style = { color: 'var(--color-text-primary)' }

// ✅ 正确：Tailwind CSS 类（通过设计系统 Token 桥接）
<div className="text-brand-primary bg-surface-overlay">

// ❌ 错误：硬编码颜色
const style = { color: '#fff' }
const style = { background: 'rgba(0,0,0,0.7)' }
```

### 存量警告

截至 BASELINE-03（2026-04-18），`@resovo/web` 存在以下硬编码颜色（均为 warn）：

| 文件 | 行号 | 值 |
|-----|-----|-----|
| `PlayerShell.tsx` | 330 | `#000` |
| `PlayerShell.tsx` | 362 | `rgba(255,255,255,0.5)` |
| （其他播放器相关文件） | — | `rgba(0,0,0,0.6~0.7)`, `#ffffff`, `#000000` |

待 M1 TOKEN-13 完成后统一迁移。

---

## 升级计划

| 里程碑 | 动作 |
|-------|------|
| TOKEN-13（M1） | 设计 Token CSS 变量完整输出；自动扫描存量 `待 M1 迁移` 注释并替换 |
| M1 完成后 | 将 `resovo/no-hardcoded-color` 从 `warn` 升级为 `error` |
| M3+（播放器重写） | 播放器内所有硬编码颜色必须替换为 Token，作为 M3 验收条件之一 |
