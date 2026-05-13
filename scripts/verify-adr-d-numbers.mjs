#!/usr/bin/env node
/**
 * verify-adr-d-numbers.mjs — ADR D-N 编号偏离清单完成度核验
 * （CHG-SN-5-CHECKLIST-AUDIT 核心 C / Y-CHECKLIST-1 修订：以 changelog 为权威）
 *
 * 守卫：
 *   - 解析 docs/decisions.md 各 ADR §决策要点 D-NNN-N 编号
 *   - 权威源 docs/changelog.md "D-NNN-N" 出现作为已闭环标识
 *   - 比对：ADR 列出但 changelog 未闭环的 D 编号 → 警告（不阻塞 CI）
 *   - 产物：docs/audit/adr-d-status.json
 *
 * 退出码：0 = 通过 / 仅有警告；2 = 脚本错误（C 不阻塞 CI）
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  splitAdrSections,
  parseDeviationNumbers,
  parseChangelogDeviations,
} from './lib/adr-parser.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DECISIONS = join(ROOT, 'docs/decisions.md')
const CHANGELOG = join(ROOT, 'docs/changelog.md')
const OUTPUT_DIR = join(ROOT, 'docs/audit')
const OUTPUT_PATH = join(OUTPUT_DIR, 'adr-d-status.json')

function main() {
  const sections = splitAdrSections(DECISIONS)
  const closedSet = new Set(parseChangelogDeviations(CHANGELOG))

  const adrStatus = []
  let pendingTotal = 0
  let closedTotal = 0

  for (const adr of sections) {
    const numbers = parseDeviationNumbers(adr.body, adr.id)
    if (numbers.length === 0) continue
    const closed = numbers.filter((n) => closedSet.has(n))
    const pending = numbers.filter((n) => !closedSet.has(n))
    adrStatus.push({
      adrId: adr.id,
      total: numbers.length,
      closed: closed.length,
      pending,
    })
    closedTotal += closed.length
    pendingTotal += pending.length
  }

  // 写产物 JSON
  try {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  } catch {}
  writeFileSync(OUTPUT_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: { closedTotal, pendingTotal },
    perAdr: adrStatus,
  }, null, 2))

  if (pendingTotal > 0) {
    console.warn(`\n⚠️ verify-adr-d-numbers: ${pendingTotal} 条 D-N 偏离编号未在 changelog.md 闭环（${closedTotal} 已闭环）：`)
    for (const a of adrStatus) {
      if (a.pending.length > 0) {
        console.warn(`  ${a.adrId}: ${a.pending.join(', ')}`)
      }
    }
    console.warn(`\n产物：${OUTPUT_PATH.replace(ROOT + '/', '')}`)
    console.warn('⚠️ 当前为 advisory 模式（不阻塞 CI）；milestone 审计前应 100% 完成。')
  } else {
    console.log(`✅ verify-adr-d-numbers: 全部 ${closedTotal} 条 D-N 偏离编号已在 changelog.md 闭环`)
  }

  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('verify-adr-d-numbers 脚本执行错误：', err)
  process.exit(2)
}
