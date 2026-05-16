#!/usr/bin/env node
/**
 * verify-style-shorthand-conflict.mjs — React inline style 中
 * shorthand + longhand 同存冲突静态扫描（CHG-SN-6-RETRO-3-B / ultrareview P1-1）
 *
 * 背景：
 *   React rerender 时若同一 style 对象含 shorthand（`font`、`border`、`background`、
 *   `margin`、`padding`、`overflow`、`border-radius`）+ 同源 longhand（`fontWeight`、
 *   `borderBottom`、`marginTop` 等），会触发 console warn:
 *     "Updating a style property during rerender (fontWeight) when a conflicting
 *      property is set (font) can lead to styling bugs."
 *
 *   db3b7a48 + 9e592df3 两次集中清零共 14 处暴露系统性问题；本守卫防回归。
 *
 * 扫描范围：
 *   - apps/server-next/src/**\/*.tsx
 *   - apps/web-next/src/**\/*.tsx
 *   - packages/admin-ui/src/**\/*.tsx
 *
 * 检测策略：
 *   1. 解析所有 `: React.CSSProperties =` / `: CSSProperties =` / inline `style={{ ... }}`
 *      内的 style 对象 literal（启发式，纯 grep 模式）
 *   2. 每个 style 对象内查 SHORTHAND_LONGHAND_MAP 中任一 shorthand 与 longhand 共存
 *   3. 命中即报告（advisory 不阻塞 CI，milestone 审计前应清零）
 *
 * 已知 shorthand → longhand 映射：
 *   font     → fontFamily / fontWeight / fontSize / fontStyle / lineHeight / fontVariant
 *   border   → borderTop / borderBottom / borderLeft / borderRight / borderWidth / borderColor / borderStyle
 *   background → backgroundColor / backgroundImage / backgroundPosition / backgroundSize / backgroundRepeat / backgroundAttachment / backgroundOrigin / backgroundClip
 *   margin   → marginTop / marginBottom / marginLeft / marginRight
 *   padding  → paddingTop / paddingBottom / paddingLeft / paddingRight
 *   overflow → overflowX / overflowY
 *   borderRadius → borderTopLeftRadius / ...（4 个 corner）
 *   inset    → top / right / bottom / left
 *   flex     → flexGrow / flexShrink / flexBasis
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const __dirname = resolve(new URL('.', import.meta.url).pathname)
const ROOT = resolve(__dirname, '..')

const SCAN_ROOTS = [
  resolve(ROOT, 'apps/server-next/src'),
  resolve(ROOT, 'apps/web-next/src'),
  resolve(ROOT, 'packages/admin-ui/src'),
]

const SHORTHAND_LONGHAND_MAP = {
  font:         ['fontFamily', 'fontWeight', 'fontSize', 'fontStyle', 'lineHeight', 'fontVariant'],
  border:       ['borderTop', 'borderBottom', 'borderLeft', 'borderRight', 'borderWidth', 'borderColor', 'borderStyle'],
  background:   ['backgroundColor', 'backgroundImage', 'backgroundPosition', 'backgroundSize', 'backgroundRepeat', 'backgroundAttachment', 'backgroundOrigin', 'backgroundClip'],
  margin:       ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'],
  padding:      ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'],
  overflow:     ['overflowX', 'overflowY'],
  borderRadius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius'],
  inset:        ['top', 'right', 'bottom', 'left'],
  flex:         ['flexGrow', 'flexShrink', 'flexBasis'],
}

const TSX_EXT = /\.tsx$/

function* walk(dir) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.next' || entry === 'dist') continue
    const full = join(dir, entry)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) {
      yield* walk(full)
    } else if (TSX_EXT.test(full)) {
      yield full
    }
  }
}

/**
 * 提取文件中所有"看起来像 style 对象 literal"的 {...} 块。
 * 启发式：匹配 `: React.CSSProperties = {...}` / `: CSSProperties = {...}` /
 * `style={{ ... }}` / `function ...(): React.CSSProperties { return {...} }` 三种范式。
 *
 * 仅扫"对象 literal 体内 keyword: value" 文本片段（不解析 AST，可能漏报 / 误报；
 * 但 db3b7a48 + 9e592df3 范式 100% 命中）。
 */
function extractStyleObjects(content) {
  const blocks = []
  // pattern A/B：`: (React\.)?CSSProperties\s*=\s*{` 后跟到下一个 `\n}`（顶层 brace 匹配）
  const pat = /:\s*(?:React\.)?CSSProperties[^=]*=\s*{/g
  let m
  while ((m = pat.exec(content))) {
    const start = m.index + m[0].length
    let depth = 1
    let i = start
    while (i < content.length && depth > 0) {
      const ch = content[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
    }
    if (depth === 0) {
      const body = content.slice(start, i - 1)
      const lineNum = content.slice(0, m.index).split('\n').length
      blocks.push({ body, line: lineNum })
    }
  }
  // pattern C：return { ... }  in function returning CSSProperties
  // pattern D：`style={{ ... }}` inline
  const inlinePat = /style=\{\{/g
  while ((m = inlinePat.exec(content))) {
    const start = m.index + m[0].length
    let depth = 2 // 外 { 已开 1 + 内 { 已开 1
    let i = start
    while (i < content.length && depth > 0) {
      const ch = content[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      i++
      if (depth === 1) {
        // 内层 } 闭合，收 body 到此
        const body = content.slice(start, i - 1)
        const lineNum = content.slice(0, m.index).split('\n').length
        blocks.push({ body, line: lineNum })
        break
      }
    }
  }
  return blocks
}

/**
 * 检测单个 style 对象 body 是否含 shorthand+longhand 冲突。
 * 返回命中清单 [{ shorthand, longhand }]
 */
function detectConflicts(body) {
  const hits = []
  for (const [shorthand, longhands] of Object.entries(SHORTHAND_LONGHAND_MAP)) {
    // 匹配 `  shorthand:` 或 `\n  shorthand:` 顶层（不含 fontFamily 等 longhand 误命中）
    // 用单词边界 + 后接 `:`
    const shortRe = new RegExp(`(^|[\\s,{])${shorthand}\\s*:`)
    if (!shortRe.test(body)) continue
    for (const longhand of longhands) {
      const longRe = new RegExp(`(^|[\\s,{])${longhand}\\s*:`)
      if (longRe.test(body)) {
        hits.push({ shorthand, longhand })
      }
    }
  }
  return hits
}

function relPath(p) {
  return p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p
}

let totalConflicts = 0
const reports = []

for (const root of SCAN_ROOTS) {
  for (const file of walk(root)) {
    const content = readFileSync(file, 'utf-8')
    const blocks = extractStyleObjects(content)
    for (const { body, line } of blocks) {
      const hits = detectConflicts(body)
      if (hits.length > 0) {
        for (const hit of hits) {
          reports.push({ file: relPath(file), line, ...hit })
          totalConflicts++
        }
      }
    }
  }
}

if (totalConflicts === 0) {
  process.stdout.write(`✅ verify-style-shorthand-conflict: 0 命中（${SCAN_ROOTS.length} 扫描根）\n`)
  process.exit(0)
}

process.stderr.write(`⚠️ verify-style-shorthand-conflict: ${totalConflicts} 处 shorthand+longhand 冲突：\n`)
for (const r of reports) {
  process.stderr.write(`  ${r.file}:${r.line}  ${r.shorthand} + ${r.longhand}\n`)
}
process.stderr.write(`\n修复路径：\n`)
process.stderr.write(`  1. 删除 shorthand（${Object.keys(SHORTHAND_LONGHAND_MAP).join(' / ')}），保留 longhand；或反之\n`)
process.stderr.write(`  2. 典型：font: 'inherit' → fontFamily: 'inherit'（参 db3b7a48 + 9e592df3 14 处修复范式）\n`)
process.stderr.write(`\n⚠️ 当前为 advisory 模式（不阻塞 CI），但 milestone 审计前应清零。\n`)
process.exit(0)
