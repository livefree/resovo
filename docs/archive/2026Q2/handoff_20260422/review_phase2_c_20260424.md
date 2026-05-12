# REVIEW-C 审计报告

日期：2026-04-24
审计模型：arch-reviewer（claude-opus-4-6）
覆盖范围：HANDOFF-25 / 26 / 30

## 总结

**NEED_FIX** — 11 项中 9 项 PASS，1 项 NEED_FIX（第 9 项硬编码颜色），1 项含非阻塞 NIT。HANDOFF-30 范围内的 `PlayerShell.tsx` 出现 2 处硬编码颜色字面量（`'black'` 与 `white`），HANDOFF-26 范围内的 `SettingsDrawer.tsx` 出现 1 处内联 oklch 字面量阴影色，违反 CLAUDE.md「硬编码颜色值（必须用 CSS 变量）」绝对禁止项。P0 修复后 Phase 2 Close 可继续。

修复记录（2026-04-24）：P0 三项已在审计同日修复，REVIEW-C 最终结论升为 **PASS**。

---

## 逐项结论

### 1. MiniPlayer locale 来源
**结论：PASS**

`MiniPlayer.tsx` L31–32：`const params = useParams()` + `const locale = (params.locale as string) ?? 'zh-CN'`。L132 `router.push(\`/${locale}/watch/${hostOrigin.slug}\`)` 使用 `useParams()` 派生的 locale，无硬编码字符串字面量。`'zh-CN'` 仅作 SSR 兜底默认值，符合 ui-rules。

### 2. hover chip prefers-reduced-motion + motion-scale 驱动
**结论：PASS**

`globals.css` `.mini-player-return-chip` 规则：`transition: opacity calc(150ms * var(--motion-scale, 1)) ease;`，`@media (prefers-reduced-motion: reduce)` 区块用 `!important` 强制 `transition: none`。`--motion-scale` 定义在 `:root { --motion-scale: 1; }`，SettingsDrawer 滑块写入 0/1/1.5；`calc(150ms * 0) = 0ms` 等效关闭过渡。两路径均正确。

### 3. MiniPlayer 无假播放控件
**结论：PASS**

`MiniPlayer.tsx` 全文（330 行）未出现 `currentTime` / `duration` / `isPlaying` / `video.play` / `video.pause`。`usePlayerStore` 仅订阅 `shortId / hostOrigin / geometry / takeoverActive / setGeometry / setHostMode / closeHost`，与「视觉壳，Phase 3 接真实播放」契约一致。

### 4. SettingsDrawer z-index 层级
**结论：PASS**

`globals.css` token 定义：`--z-tabbar: 40`、`--z-mini-player: 50`、`--z-full-player: 70`、`--z-overlay: 80`。`--z-overlay (80) > --z-mini-player (50)` 严格大于，抽屉打开时正确遮挡 MiniPlayer。

**NIT（不阻塞）**：`MiniPlayer.tsx` L157 `zIndex: 'var(--z-mini-player, 48)'`，fallback 值 `48` 与 token 定义 `50` 不一致。token 已在 `:root` 注册，fallback 实际不生效；建议下一轮改为 `50` 或移除 fallback。

### 5. Footer 浏览链接数据来源
**结论：PASS**

`Footer.tsx` L8 `import { ALL_CATEGORIES, MAIN_TYPE_PARAMS } from '@/lib/categories'`，分类链接由 `ALL_CATEGORIES.filter(...)` 动态生成，与 Nav.tsx 同源。无内联硬编码分类数组。

### 6. Footer 链接 locale 前缀
**结论：PASS**

浏览分类链接 `href={\`/${locale}/${cat.typeParam}\`}` 含 locale 前缀。帮助列 / 关于列使用 `href="#"` 占位锚点，非裸内部路径。未发现漏 locale 的内部链接。

### 7. SettingsDrawer localStorage SSR 安全性
**结论：PASS**

`readMotionIndex()` 首行 `if (typeof window === 'undefined') return 1` 守卫；`applyMotionScale()` 首行同守卫。两函数均在 `useEffect` 或 onChange 处理器内调用，纯客户端上下文。模块顶层无 localStorage 副作用，SSR 安全。

### 8. --motion-scale 变量挂载位置
**结论：PASS**

`globals.css` 定义在 `:root { --motion-scale: 1; }`；`SettingsDrawer.tsx` L34 写入 `document.documentElement.style.setProperty('--motion-scale', String(val))`，目标为 `<html>` 即 `:root`。定义位置与写入目标一致。

### 9. 硬编码颜色零遗漏（HANDOFF-19~26 + HANDOFF-30 范围）
**结论：NEED_FIX → 已修复**

发现 3 处违规（均已于 2026-04-24 修复）：

| 文件 | 行号 | 违规内容 | 修复方案 |
|------|------|---------|---------|
| `PlayerShell.tsx` | L365 | `background: 'black'` | 改用 `var(--player-video-area-bg)` token |
| `PlayerShell.tsx` | L400 | `color: 'color-mix(in oklch, white 50%, transparent)'` | 改用 `var(--player-no-source-fg)` token |
| `SettingsDrawer.tsx` | L111 | `boxShadow: '-8px 0 32px oklch(0% 0 0 / 0.12)'` | 改用 `var(--shadow-drawer)` token |

三个 token 已在 `globals.css` 中新增：
- `--player-video-area-bg: oklch(0% 0 0)`
- `--player-no-source-fg: oklch(100% 0 0 / 0.5)`
- `--shadow-drawer: -8px 0 32px oklch(0% 0 0 / 0.12)`

其余所有被检文件（`playerShell.layout.ts` / `MiniPlayer.tsx` / `Footer.tsx` / `FeaturedRow.tsx` / `TopTenRow.tsx` / `CategoryShortcutsClient.tsx` / `BrowseGrid.tsx` / `DetailHero.tsx` / `EpisodePicker.tsx` / `RelatedVideos.tsx` / `VideoDetailClient.tsx`）均全部使用 `var(--*)` 或 `transparent`，无违规。

**超范围 NIT**：`SearchPage.tsx` L135 引用 `var(--gold)`，但 globals.css 未定义该 token，运行时降级为未定义（可能透明或 inherit）。建议 HANDOFF-23 后续 cleanup 补 token 定义或改用 `--accent-default`（不阻塞本次）。

### 10. any 类型零遗漏
**结论：PASS**

审计范围内所有 TSX/TS 文件均无 `: any` / `as any` / `<any>`。`as string` / `as Parameters<typeof t>[0]` 等均断言到具体类型，合规。

### 11. VideoCardWide.tsx @deprecated 注释
**结论：PASS**

`VideoCardWide.tsx` L1：`/** @deprecated 全站已统一为竖版卡片（VideoCard 2:3），此组件保留但不得新引用 */`。审计范围内 14 个文件 import 语句均未出现 `VideoCardWide`。

---

## 需修复项清单

| 优先级 | 文件 | 问题 | 状态 |
|--------|------|------|------|
| P0 | `PlayerShell.tsx` | `background: 'black'` 硬编码 | ✅ 已修复 |
| P0 | `PlayerShell.tsx` | `white` 命名颜色字面量 | ✅ 已修复 |
| P0 | `SettingsDrawer.tsx` | `oklch(0% 0 0 / 0.12)` 内联阴影 | ✅ 已修复 |
| NIT | `MiniPlayer.tsx` | `var(--z-mini-player, 48)` fallback 与 token 不一致 | 下一轮清理 |
| NIT | `SearchPage.tsx` | `var(--gold)` 引用未定义 token | HANDOFF-23 cleanup |

---

## 阻塞判定

**REVIEW-C PASS** — P0 三项已于 2026-04-24 修复，全部 11 项审计结论通过，Phase 2 Close 可执行。
