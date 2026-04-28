#!/usr/bin/env node
/**
 * verify-server-next-isolation.mjs — CI 兜底脚本（plan §4.6 / ADR-100）
 *
 * 用 TypeScript Compiler API（已有 typescript devDep，无新依赖）静态扫描
 * apps/server-next/src/ 全部 .ts/.tsx 文件，检测 ImportDeclaration 的 module
 * specifier 是否命中跨 apps 边界违规。
 *
 * 守卫范围：
 *   - 禁止 import from 'apps/server/**'、'../../server/**'
 *   - 禁止 import from 'apps/web/**'、'../../web/**'（apps/web M-SN-0 已删）
 *   - 禁止 import from 'apps/web-next/src/**'、'../../web-next/src/**'
 *
 * ESLint no-restricted-imports 是第一道闸；本脚本是 CI 兜底（覆盖 ESLint 漏掉
 * 的边角，例如 dynamic import 字面量、type-only import 在 ESLint 配置失效时仍能拦截）。
 *
 * 退出码：0 = 通过；1 = 命中违规并打印清单；2 = 脚本执行错误。
 *
 * 使用：
 *   node scripts/verify-server-next-isolation.mjs
 *   npm run verify:server-next-isolation
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SCAN_DIR = resolve(ROOT, 'apps/server-next/src')

/**
 * 违规 patterns（按 plan §4.6 字面 + ADR-100 架构约束）
 * 每条 pattern 是 RegExp，匹配整个 module specifier 字符串
 */
const FORBIDDEN_PATTERNS = [
  {
    pattern: /(^|\/)apps\/server(\/|$)/,
    reason: 'server-next 不得引用 apps/server（M-SN-7 cutover 后退役）',
  },
  {
    pattern: /(^|\/)apps\/web(\/|$)(?!next)/,
    reason: 'apps/web 已退役（M-SN-0 R11 删除）',
  },
  {
    pattern: /(^|\/)apps\/web-next\/src(\/|$)/,
    reason: '共享应走 packages/*（plan §4.4 / §4.6 ESLint 边界）',
  },
  // 相对路径跨 apps（防 ../../web-next/src 等绕过）
  {
    pattern: /\.\.\/\.\.\/server(\/|$)/,
    reason: 'server-next 相对路径跨 apps 引用 server 被禁止（plan §4.6）',
  },
  {
    pattern: /\.\.\/\.\.\/web(\/|$)(?!next)/,
    reason: 'apps/web 已退役（M-SN-0 R11）',
  },
  {
    pattern: /\.\.\/\.\.\/web-next\/src(\/|$)/,
    reason: '共享应走 packages/*（plan §4.4 / §4.6）',
  },
]

/**
 * 检查单个 module specifier 是否命中违规
 * @returns {string | null} 违规理由或 null
 */
function checkSpecifier(specifier) {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(specifier)) return reason
  }
  return null
}

/**
 * 用 TS Compiler API 解析单文件，遍历所有 import 形态：
 *   - import x from 'foo'
 *   - import { x } from 'foo'
 *   - import 'foo'
 *   - export { x } from 'foo'
 *   - dynamic: import('foo')
 *   - require('foo')
 */
function scanFile(filePath, content) {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
  const violations = []

  function getLine(node) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  }

  function visit(node) {
    // import / export 声明
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const spec = node.moduleSpecifier.text
      const reason = checkSpecifier(spec)
      if (reason) violations.push({ file: filePath, line: getLine(node), specifier: spec, reason })
    }
    // dynamic import('...')
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const spec = node.arguments[0].text
      const reason = checkSpecifier(spec)
      if (reason) violations.push({ file: filePath, line: getLine(node), specifier: spec, reason })
    }
    // require('...')
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const spec = node.arguments[0].text
      const reason = checkSpecifier(spec)
      if (reason) violations.push({ file: filePath, line: getLine(node), specifier: spec, reason })
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return violations
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx)$/.test(name)) yield p
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
    console.log(`[verify-server-next-isolation] OK: 扫描 ${scanned} 文件，0 违规`)
    process.exit(0)
  }

  console.error(`[verify-server-next-isolation] FAIL: 扫描 ${scanned} 文件，${allViolations.length} 违规：\n`)
  for (const v of allViolations) {
    const rel = v.file.replace(`${ROOT}/`, '')
    console.error(`  ${rel}:${v.line}`)
    console.error(`    import: '${v.specifier}'`)
    console.error(`    reason: ${v.reason}\n`)
  }
  process.exit(1)
}

try {
  main()
} catch (err) {
  console.error('[verify-server-next-isolation] 脚本执行错误：', err)
  process.exit(2)
}
