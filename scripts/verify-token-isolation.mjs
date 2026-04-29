#!/usr/bin/env node
/**
 * verify-token-isolation.mjs — admin 专属 token 反向跨域守卫（CHG-SN-1-09）
 *
 * 与 verify-server-next-isolation.mjs 互补：
 *   - verify-server-next-isolation.mjs：扫 apps/server-next/src import 路径（禁
 *     止反向引用 apps/server / apps/web-next）
 *   - 本脚本：扫 apps/web-next/src 内 string 字面量（CSS / TSX / TS / SCSS），
 *     检测 admin 专属 CSS 变量 token name 是否被前台消费 — token name
 *     string 级守卫（ADR-102 第 5 层 admin-layout + dual-signal 跨域禁令）
 *
 * 触发：CHG-SN-1-08 milestone 阶段审计 B 级 PASS 备忘明示当前 isolation 守卫是
 * import path 级，ADR-102 跨域禁令本质是 token name string 级；M-SN-1 闭环原欠账
 * （CHG-SN-1-09，SEQ-20260428-02 任务 4 闭环）。
 *
 * 守卫范围（15 个 admin 专属 token name；按 ADR-102 第 5 层声明 + ADR-103a §4.3 z-shell-* 扩展）：
 *   - dual-signal（admin 业务专属语义层）：
 *       --probe / --probe-soft / --render / --render-soft
 *   - admin-layout shell + table + density（cutover 后 apps/admin 生命周期绑定）：
 *       --sidebar-w / --sidebar-w-collapsed / --topbar-h
 *       --row-h / --row-h-compact / --col-min-w
 *       --density-comfortable / --density-compact
 *   - admin-layout z-shell-*（CHG-SN-2-02 新增；ADR-103a §4.3 4 级 z-index 规范）：
 *       --z-shell-drawer / --z-shell-cmdk / --z-shell-toast
 *
 * 设计要点：
 *   1. 反向扫描方向：apps/web-next/src 内任何对上述 token name 的字符串引用
 *      命中即违规（前台 0 消费 admin 专属 token）
 *   2. 字符串级匹配：不依赖 TS 解析，正则扫源码即可（CSS 变量名是 string-level
 *      消费，TS 类型系统看不到）
 *   3. 文件类型：.ts / .tsx / .css / .scss（M-SN-1 当前 web-next 主要消费形态）
 *   4. 误报豁免：本脚本自身位于 /scripts/ 不在 SCAN_DIR (apps/web-next/src) 范围
 *      内，FORBIDDEN_TOKENS 数组天然不会被自我命中
 *
 * 守卫边界（避免误以为本脚本独力承担 dual-signal 全部防线）：
 *   - 本脚本守 token name **string 级**跨域（`var(--probe)` / `--probe` 等字符串引用）
 *   - dual-signal 颜色源 hex 值（如 `#38bdf8` / `#a855f7`）若被前台直接硬编码而非
 *     `var(--probe)` 引用，本脚本无法捕获 → 由 ESLint `no-hardcoded-color` 兜底
 *   - admin-only import path 跨域 → 由 `verify-server-next-isolation.mjs` 兜底
 *   - 三层守卫互补：ESLint（IDE）+ ts-morph import 路径（CI）+ 本脚本 token name string（preflight）
 *
 * 退出码：0 = 通过；1 = 命中违规并打印清单；2 = 脚本执行错误。
 *
 * 使用：
 *   node scripts/verify-token-isolation.mjs
 *   npm run verify:token-isolation
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCAN_DIR = resolve(ROOT, 'apps/web-next/src')

/**
 * admin 专属 token name 清单（ADR-102 第 5 层 admin-layout + dual-signal 跨域禁令）
 *
 * 每个 token name 用 \b 边界保证精确匹配（如 --probe 不会误命中 --probe-foo）；
 * 但 --probe-soft 等带 - 后缀的 token 必须在 --probe 之前匹配（更长优先），
 * 因此清单按字符长度降序排列再编译为单一正则。
 */
const FORBIDDEN_TOKENS = [
  // dual-signal soft（4 字符长尾，先于 --probe / --render）
  '--probe-soft',
  '--render-soft',
  // admin-layout（按字符长度降序，避免 --row-h 提前命中 --row-h-compact 的前缀）
  '--sidebar-w-collapsed',
  '--density-comfortable',
  '--density-compact',
  '--row-h-compact',
  '--sidebar-w',
  '--col-min-w',
  '--topbar-h',
  '--row-h',
  // admin-layout z-shell-*（CHG-SN-2-02 / ADR-103a §4.3）
  '--z-shell-drawer',
  '--z-shell-cmdk',
  '--z-shell-toast',
  // admin-layout surfaces（fix(CHG-SN-2-12)#vs）：admin 专属视觉 token，前台禁用
  '--admin-count-font-size',
  '--admin-input-radius',
  '--admin-danger-soft',
  '--admin-accent-soft',
  '--admin-avatar-bg',
  '--admin-warn-soft',
  // admin-layout z-index business（CHG-SN-2-13）：业务 Drawer/Modal + AdminDropdown z-index
  '--z-admin-dropdown',
  '--z-modal',
  // dual-signal base（最短，放最后）
  '--probe',
  '--render',
]

/**
 * 编译为单一正则：每个 token name 用 \b 词边界（避免 --row-h 命中 --row-h-compact 的子串），
 * 配合 alternation；按长度降序写入即可让最长匹配优先（JS regex alternation 短路）。
 *
 * 注意：CSS 变量名包含 -，\b 词边界对 - 视作非词字符。所以在 token name 后补 (?![-_a-zA-Z0-9])
 * 锚点（负向前瞻），而前缀 -- 已天然不会与字母数字相邻（除非源文件出现非常 weird 的字符串拼接）。
 */
const TOKEN_PATTERN = new RegExp(
  '(' +
    FORBIDDEN_TOKENS
      .map((t) => t.replace(/[-]/g, '\\-'))
      .join('|') +
    ')(?![-_a-zA-Z0-9])',
  'g',
)

const SCAN_EXTS = /\.(ts|tsx|css|scss)$/i

/**
 * 扫描单文件，返回违规清单（按行号 + 列号 + 命中字符串）
 */
function scanFile(filePath, content) {
  const violations = []
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    TOKEN_PATTERN.lastIndex = 0
    let m
    while ((m = TOKEN_PATTERN.exec(line)) !== null) {
      violations.push({
        file: filePath,
        line: i + 1,
        col: m.index + 1,
        token: m[1],
        snippet: line.trim().slice(0, 120),
      })
    }
  }
  return violations
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (SCAN_EXTS.test(name)) yield p
  }
}

function main() {
  const allViolations = []
  let scanned = 0

  for (const filePath of walk(SCAN_DIR)) {
    const content = readFileSync(filePath, 'utf-8')
    const violations = scanFile(filePath, content)
    allViolations.push(...violations)
    scanned++
  }

  if (allViolations.length === 0) {
    console.log(
      `[verify-token-isolation] OK: 扫描 ${scanned} 文件（apps/web-next/src），`
        + `0 admin 专属 token 跨域消费`,
    )
    process.exit(0)
  }

  console.error(
    `[verify-token-isolation] FAIL: 扫描 ${scanned} 文件（apps/web-next/src），`
      + `${allViolations.length} 处 admin 专属 token 跨域消费违规：\n`,
  )
  for (const v of allViolations) {
    const rel = v.file.replace(`${ROOT}/`, '')
    console.error(`  ${rel}:${v.line}:${v.col}`)
    console.error(`    token: ${v.token}`)
    console.error(`    snippet: ${v.snippet}\n`)
  }
  console.error(
    'admin 专属 token（dual-signal + admin-layout）由 ADR-102 第 5 层声明，'
      + 'apps/web-next 不得消费。\n'
      + '若需共享 token，请在 packages/design-tokens 提升到 base/semantic 层（须 ADR 评审）。',
  )
  process.exit(1)
}

try {
  main()
} catch (err) {
  console.error('[verify-token-isolation] 脚本执行错误：', err)
  process.exit(2)
}
