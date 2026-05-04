# 视频库 Cover Cell 压缩问题 · 调试记录（暂停）

> 状态：⏸ 暂停（多次修法失败，根因未定位）
> 序列：SEQ-20260505-01 / CHG-UX2-03d
> 创建：2026-05-04
> 最后更新：2026-05-04

---

## §1 问题描述（用户反馈）

视频库 `/admin/videos` 表格 cover 列：
- 封面 Thumb 显示偏左 → cell 右侧空白
- 视觉效果"图片左侧圆角，右侧直角"
- 行高已修复（48×72 不裁切）✅
- frame 4 角圆角已修复 ✅（CHG-UX2-03c width: 100%）

**唯一遗留**：cover cell 内 Thumb width 异常（应 48px，实际渲染 37px）。

---

## §2 用户提供的实测数据（DevTools）

### §2.1 第一次实测（CHG-UX2-03c 后，含 wrapper div）

DOM hover 显示尺寸：
- `<div style="display:flex;justify-content:center;width:100%">` (wrapper) — **45×72**
- `<span data-thumb>` — **48×72**
- `<img>` — **37×72**

Computed 标签：
- `<span data-thumb>` width: **37px**（与 inline `width: var(--cover-poster-md-w)` 期望 48 不符）

Token 验证：
- `--cover-poster-md-w: 48px` ✓ 正确生成（packages/design-tokens/src/css/tokens.css:246）

### §2.2 第二次实测（CHG-UX2-03d 删 wrapper 后）

DOM 结构：
```html
<div role="cell" style="display: flex; align-items: center; padding: 0px 12px;
                        font-size: var(--font-size-sm-tight); color: var(--fg-default);
                        border-bottom: 1px solid var(--border-subtle);
                        overflow: hidden; white-space: nowrap;">
  <span data-thumb="true" data-size="poster-md" data-state="has-src"
        style="width: var(--cover-poster-md-w); height: var(--cover-poster-md-h);
               border-radius: var(--radius-sm); background: var(--bg-surface-elevated);
               overflow: hidden; flex-shrink: 0; display: inline-flex;
               align-items: center; justify-content: center;">
    <img alt="" aria-hidden="true" loading="lazy" src="..."
         style="width: 100%; height: 100%; object-fit: cover; display: block;">
  </span>
</div>
```

Computed：
- `<span data-thumb>` width: **37px**（仍异常）
- `<img>` width: **37px**

### §2.3 第三次实测（CHG-UX2-03d 加 cell minWidth 后）

Computed：
- `<div role="cell">` min-width: **72px** ✓
- `<div role="cell">` width: **61px** ⚠️ **width < min-width**（违反 CSS spec！）
- `<span data-thumb>` width: **37px**

---

## §3 已尝试的修法清单（全部未生效）

| Commit | 修法 | 结果 |
|---|---|---|
| `bf9a3d9` CHG-UX2-03c | cover cell 包 wrapper `<div flex justify-center width:100%>` 让 Thumb 居中 | ❌ wrapper 反而 45px < expected 56；Thumb 仍 37px |
| `30e2cd9` CHG-UX2-03d 第一版 | 删 wrapper + cover width 80→72 + buildGridTemplate fixed → `minmax(w,w)` | ❌ minmax(48px, 48px) 等价 48px，仍被 grid 压缩 |
| `0102bce` CHG-UX2-03d 修订 | 回滚 minmax 单值；thead row + body row 加 `min-width: max-content` | ❌ row min-width: max-content 在 flex 父压缩链下未生效 |
| `fc5d1f5` CHG-UX2-03d 真修复 | cell + columnheader 加 `min-width: ${col.width}px` | ❌ user 实测 cell width 61 < min-width 72（grid 仍压缩 fixed track） |
| `94ef6d4` CHG-UX2-03d 终极 | row 改 `width: max-content` + `minWidth: 100%` | ❌ 仍未恢复（user 反馈"问题依旧没有任何改善"） |

---

## §4 已确认的事实

1. **Token 正确生成**：`--cover-poster-md-w: 48px` 在 `:root` 和 `[data-theme="dark"]` 都有 ✓
2. **inline style 正确**：`<span style="width: var(--cover-poster-md-w);">` 写入 DOM 正确
3. **height 正常**：`<span>` height 72px ✓（同样 var(--cover-poster-md-h) 解析正常）
4. **flex-shrink:0 已设**：inline style 有 `flex-shrink: 0`
5. **frame 圆角 OK**：CHG-UX2-03c 的 `width: 100%` 修好 frame 4 角圆角（user 确认）
6. **关键矛盾**：cell `min-width: 72` 但 `width: 61` — 违反 CSS Spec 的常规理解

---

## §5 推测但未验证的根因

### 候选 1：dt-scroll `min-width: 0` 让 flex 父链压缩传递

`packages/admin-ui/src/components/data-table/dt-styles.tsx`:
```css
[data-table-scroll] {
  flex: 1 1 auto;
  min-width: 0;     /* ← 让 dt-scroll 可被 flex 父压缩 */
  overflow: auto;
  ...
}
```

dt-scroll 在 dt（flex column）内是 flex item。`min-width: 0` 允许 flex 父无限压缩 dt-scroll。dt-scroll 内 row（grid container）跟着被压缩。grid item 即使有 min-width 也无法保证（CSS Grid 算法在容器极度不足时 fallback）。

**未验证**：删 dt-scroll `min-width: 0` 后行为如何？是否引发 main 横滚副作用？

### 候选 2：CSS Grid 算法对 grid item min-width 的处理偏差

CSS Grid Level 1 spec：grid track sizing 算法 step 4 "Maximum/Minimum size of a grid item" 计算 grid item min-content / min-width 用于 track sizing。但若 grid container 的 available space < sum(track min-sizes)，浏览器会 **额外压缩**。

**未验证**：是否 Chrome / Safari / Firefox 实现差异？user 用什么浏览器？

### 候选 3：max-content / min-width: max-content 不传递跨 flex 容器边界

CSS spec：`max-content` 在 flex item 内可能解析为 0（取决于 main-axis vs cross-axis）。

**未验证**：dt-scroll 是 flex item（main-axis vertical 在 dt 内），其内 row 用 max-content 是否解析正常？

### 候选 4：Next.js dev server 缓存 packages/admin-ui transpiled 输出

Next.js 在 monorepo 中可能缓存 `transpilePackages` 输出。即使代码改了，浏览器可能拿到旧版本。

**未验证**：user 是否 `rm -rf apps/server-next/.next` + 重启 dev？

### 候选 5：`white-space: nowrap` 在 cell 上对 flex item 的特殊作用

cell inline style 有 `white-space: nowrap`。某些浏览器在 nowrap + flex 容器 + inline-flex 子项的组合下，flex 算法处理 min-width 异常。

**未验证**：删 cell 的 `white-space: nowrap` 是否修复？

---

## §6 当前 git 状态

最近 commits：

```
94ef6d4 fix(CHG-UX2-03d): row width: max-content 终极修复 grid 压缩
fc5d1f5 fix(CHG-UX2-03d): grid item min-width 真修复 fixed track 压缩
0102bce fix(CHG-UX2-03d): row min-width: max-content 真修复 grid 压缩
30e2cd9 fix(CHG-UX2-03d): 删 wrapper + cover 列宽贴合 + grid fixed track 不压缩
bf9a3d9 fix(CHG-UX2-03c): 修复封面图片偏左 + frame 右侧直角根因
e162325 fix(CHG-UX2-03b): 视频库行高扩展 + 列宽收缩
0e23b57 chg(CHG-UX2-03): VideoListClient title 列弹性化 + cover poster-md
```

当前生效改动：
- ✅ wrapper div 已删（DOM 干净）
- ✅ cover width 72（贴合 Thumb 48 + cell padding 24）
- ⚠️ row + cell 加了多个 min-width / width: max-content（无效但保留）
- ⚠️ DataTable cell + columnheader 加了 minWidth 内联（无效但保留）

**保留 vs 回滚**：当前状态没有视觉副作用（除 Thumb 仍异常），保留改动方便后续调试时不重做。

---

## §7 建议的下一步调研方向（优先级排序）

### P0：dev server 缓存验证

1. user 终端 `Ctrl+C` 停 dev
2. `rm -rf apps/server-next/.next`
3. `npm run dev`
4. 浏览器 `Cmd+Shift+R` hard reload
5. 重新 inspect cell + span computed style
6. 如果还有问题 → 进入 P1

### P1：浏览器层验证

直接在 DevTools console 执行：

```js
const span = document.querySelector('[data-thumb]')
console.log('inline width:', span.style.width)
console.log('computed width:', getComputedStyle(span).width)
console.log('cssVar:', getComputedStyle(document.documentElement).getPropertyValue('--cover-poster-md-w'))
```

如果 cssVar 返回 `48px` 但 computed width 不是 `48px` → 浏览器 layout 算法压缩问题
如果 cssVar 返回空 → CSS variable 未注入

### P2：删 dt-scroll 的 `min-width: 0` 实验

修改 `packages/admin-ui/src/components/data-table/dt-styles.tsx`：

```css
[data-table-scroll] {
  flex: 1 1 auto;
  /* min-width: 0; ← 注释掉这行 */
  overflow: auto;
  ...
}
```

观察是否 main 横滚 + cell 不压缩？如果 cell 恢复 → 根因确认 ✓
副作用：可能让 main 出现横滚（page 级体验差），需评估接受。

### P3：用 `<table>` 真实 HTML 表格替代 div grid

如果 grid 算法在 flex 父压缩链下不可控，改回原生 `<table>` HTML（CSS table-layout: fixed）会让浏览器用 table layout 算法（更稳定）。

工作量大（DataTable 重构），保留为最后手段。

### P4：调研其他 admin-ui 表格实例

检查 `apps/server` 旧 ModernDataTable / 其他模块是否有相同 cover 列 + grid 压缩问题。如果都有 → 系统性问题；如果只视频库有 → 局部 bug。

---

## §8 暂停原因

- 5 次修法均未生效
- user 实测数据出现"cell width < min-width"违反 CSS spec 现象
- 推测候选 5 个，无明确证据指向单一根因
- 继续盲调代价高（每次都要 user 验证 dev server）

**等待**：user 决定继续投入调研或转向其他任务。

---

## §9 引用

- 用户反馈对话：本次会话 2026-05-04（多轮）
- DevTools 数据：见 §2
- CSS Grid spec: <https://www.w3.org/TR/css-grid-1/#track-sizing>
- 相关任务卡：CHG-UX2-03 / 03b / 03c / 03d（多次失败）
- 序列方案：`docs/designs/backend_design_v2.1/density-spacing-cover-alignment-plan.md`
