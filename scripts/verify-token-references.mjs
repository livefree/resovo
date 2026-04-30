#!/usr/bin/env node

/**
 * verify-token-references.mjs — token completeness 校验（CHG-DESIGN-01 / SEQ-20260429-02）
 *
 * 目的：扫描 packages/admin-ui 与 apps/server-next 源码中的 `var(--xxx)` 引用，
 *       与 @resovo/design-tokens 输出的 CSS 变量定义做 diff；
 *       任一未定义引用 → 退出码 1，CI 卡门。
 *
 * 真源：docs/designs/backend_design_v2.1/reference.md §3.6（Tokens 诊断 + 补全）
 *
 * 限制：本脚本不做 token 命名层校验（命名是否合规由 ADR-102 + arch-reviewer 把关）。
 * 也不校验 fallback 值（var(--x, default) 中的 default）。
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const TOKEN_CSS_PATHS = [
  'packages/design-tokens/dist/tokens.css',
  'packages/design-tokens/src/css/tokens.css',
]

const CONSUMER_DIRS = [
  'packages/admin-ui/src',
  'apps/server-next/src',
]

const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx|css|scss)$/

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function collectDefinedTokens() {
  const defined = new Set()
  for (const p of TOKEN_CSS_PATHS) {
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf8')
    // 仅匹配定义形式：行首空白 + --name :
    const re = /^\s*(--[a-z][a-z0-9-]+)\s*:/gm
    let m
    while ((m = re.exec(content)) !== null) defined.add(m[1])
  }
  return defined
}

function listConsumerFiles() {
  const out = sh(`rg --files ${CONSUMER_DIRS.join(' ')}`)
  return out
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && SOURCE_EXT_RE.test(s))
}

function collectUsedTokens(files) {
  const used = new Map() // token -> [{file, line}]
  // 匹配 var(--name) 任意位置；忽略 fallback 第二参（var(--x, ...)）
  const re = /var\(\s*(--[a-z][a-z0-9-]+)\s*[,)]/g
  for (const file of files) {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = content.split('\n')
    lines.forEach((line, idx) => {
      // 跳过纯注释行（最弱启发式：// 起始 或 /* ... */ 整行）
      const trimmed = line.trim()
      if (trimmed.startsWith('//') || trimmed.startsWith('* ') || trimmed.startsWith('*/')) return
      let m
      // 重置 lastIndex
      const r = new RegExp(re.source, 'g')
      while ((m = r.exec(line)) !== null) {
        const tok = m[1]
        const arr = used.get(tok) ?? []
        arr.push({ file, line: idx + 1 })
        used.set(tok, arr)
      }
    })
  }
  return used
}

function main() {
  const defined = collectDefinedTokens()
  if (defined.size === 0) {
    console.error('[verify-token-references] 未找到 token 定义文件，先 npm run build -w @resovo/design-tokens')
    process.exit(2)
  }
  const files = listConsumerFiles()
  const used = collectUsedTokens(files)
  const undefinedRefs = []
  for (const [tok, refs] of used) {
    if (!defined.has(tok)) undefinedRefs.push({ tok, refs })
  }

  if (undefinedRefs.length === 0) {
    console.log(`[verify-token-references] PASS — ${used.size} 个引用全部已定义（${defined.size} 个 token）`)
    process.exit(0)
  }

  console.error('[verify-token-references] FAIL — 发现未定义 token 引用：')
  for (const { tok, refs } of undefinedRefs) {
    console.error(`  ${tok}:`)
    for (const { file, line } of refs.slice(0, 10)) {
      console.error(`    ${file}:${line}`)
    }
    if (refs.length > 10) console.error(`    ... +${refs.length - 10} more`)
  }
  console.error('')
  console.error('修复方法：替换为已定义 token，或在 packages/design-tokens 补建并 npm run build。')
  console.error('参考：docs/designs/backend_design_v2.1/reference.md §3.6')
  process.exit(1)
}

main()
