#!/usr/bin/env node
/**
 * verify-script-doc-sync.mjs — verify:* 门禁脚本 ↔ 文档枚举漂移检测
 * （审查规范改进 P1b / 对应「评估·短板 #6：单一真源原则自相矛盾，§6 脚本枚举已漂移」）
 *
 * 背景：
 *   verify:adr-contracts 聚合的门禁脚本集合是「现行真源」，但其成员在
 *   docs/rules/quality-gates.md §6 与 scripts/preflight.sh [5f/6] 两处被人工
 *   枚举，已观察到漂移（package.json 已含 enum-ssot / admin-shell-types-mirror
 *   等而 §6 未同步记载）。本守卫以 package.json 为权威，反向核验两份文档枚举：
 *     1. adr-contracts 成员未被 preflight.sh / quality-gates §6 记载 → 漂移
 *     2. 文档引用 verify:<name> 但 package.json 已无此脚本 → stale 引用
 *
 * 退出码：0 = 通过 / advisory 警告；2 = 脚本错误。（不阻塞 CI）
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PKG = join(ROOT, 'package.json')
const PREFLIGHT = join(ROOT, 'scripts/preflight.sh')
const QUALITY_GATES = join(ROOT, 'docs/rules/quality-gates.md')

/** 解析 verify:adr-contracts 命令串，抽出 scripts/verify-*.mjs → 反查对应 npm script 名 */
function aggregateMembers(scripts) {
  const cmd = scripts['verify:adr-contracts'] ?? ''
  const fileToName = new Map()
  for (const [name, c] of Object.entries(scripts)) {
    if (!name.startsWith('verify:')) continue
    const matches = [...(c || '').matchAll(/scripts\/(verify-[\w-]+)\.mjs/g)]
    // 仅单脚本 npm 项可定义 file→name 映射；跳过聚合命令（如 verify:adr-contracts 自身）
    if (matches.length === 1) fileToName.set(matches[0][1], name)
  }
  const members = []
  for (const m of cmd.matchAll(/scripts\/(verify-[\w-]+)\.mjs/g)) {
    members.push(fileToName.get(m[1]) ?? `(${m[1]})`)
  }
  return [...new Set(members)]
}

function main() {
  const pkg = JSON.parse(readFileSync(PKG, 'utf-8'))
  const scripts = pkg.scripts ?? {}
  const members = aggregateMembers(scripts)
  const preflightText = readFileSync(PREFLIGHT, 'utf-8')
  const qgText = readFileSync(QUALITY_GATES, 'utf-8')

  const warnings = []

  // 1. adr-contracts 成员 → 应在 preflight.sh 与 quality-gates §6 均有记载
  for (const name of members) {
    if (!preflightText.includes(name)) {
      warnings.push(`verify:adr-contracts 含 ${name}，但 scripts/preflight.sh [5f/6] 未列出`)
    }
    if (!qgText.includes(name)) {
      warnings.push(`verify:adr-contracts 含 ${name}，但 docs/rules/quality-gates.md §6 未记载`)
    }
  }

  // 2. 反向：文档出现 verify:<name> 字面但 package.json 已无此脚本 → stale 引用
  const pkgVerifySet = new Set(Object.keys(scripts).filter((k) => k.startsWith('verify:')))
  const docRefs = new Set()
  for (const text of [preflightText, qgText]) {
    for (const m of text.matchAll(/\bverify:[\w-]+/g)) docRefs.add(m[0])
  }
  for (const ref of docRefs) {
    if (!pkgVerifySet.has(ref)) {
      warnings.push(`文档引用 ${ref} 但 package.json 无此脚本（stale / 已重命名）`)
    }
  }

  console.log(`verify:adr-contracts 当前成员（package.json 权威，共 ${members.length}）：`)
  for (const name of members) console.log(`  - ${name}`)

  if (warnings.length > 0) {
    console.warn(`\n⚠️ verify-script-doc-sync: ${warnings.length} 处脚本 ↔ 文档漂移：`)
    for (const w of warnings) console.warn(`  - ${w}`)
    console.warn('\n修复：同步 docs/rules/quality-gates.md §6 与 scripts/preflight.sh [5f/6] 的脚本枚举至 package.json 真源。')
    console.warn('⚠️ 当前为 advisory（不阻塞）。')
  } else {
    console.log('\n✅ verify-script-doc-sync: verify:adr-contracts 成员与 preflight.sh / quality-gates §6 枚举一致。')
  }
  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('verify-script-doc-sync 脚本执行错误：', err)
  process.exit(2)
}
