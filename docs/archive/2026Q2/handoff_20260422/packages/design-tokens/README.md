# @resovo/design-tokens

设计 Token 包 — Resovo 全局 CSS 变量 + JS 常量的单一真源。

## 消费方式

```ts
// CSS 变量（在 globals.css 中引入）
import '@resovo/design-tokens/css'

// JS 常量
import { colors, spacing } from '@resovo/design-tokens/js'

// TypeScript 类型
import type { TokenColor } from '@resovo/design-tokens/types'
```

## 目录结构

```
src/
  primitives/   # 原子 Token（颜色、间距、字体等具体值）
  semantic/     # 语义映射（bg-primary → primitives.blue.500 等）
  components/   # 组件级 Token 覆盖
  brands/       # 品牌层覆盖（多品牌场景）
  index.ts      # 主出口（re-export 所有层）
  types.ts      # TypeScript 类型出口

scripts/
  build-css.ts  # CSS 变量文件生成器（tsx scripts/build-css.ts）
```

## 构建

```bash
npm run build -w @resovo/design-tokens   # 生成 src/css/tokens.css
npm run typecheck -w @resovo/design-tokens
```

## 规则

- 禁止在 apps/* 中直接定义 CSS 变量或颜色常量 — 必须通过本包
- CSS 变量名与 JS 常量路径必须同构（由 build-css.ts 统一派生）
- 消费方只能通过 ./css、./js、./types 三个出口导入
