#!/usr/bin/env node

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const V2_SCOPE_DIRS = [
  'src/components/admin/system/crawler-site',
  'src/components/admin/system/config-file',
  'src/components/admin/videos',
  'src/components/admin/users',
  'src/components/admin/sources',
  'src/components/admin/shared',
]

const SOURCE_EXT_RE = /\.(ts|tsx|js|jsx)$/

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim()
}

function parseArgs(argv) {
  const args = new Set(argv)
  return {
    all: args.has('--all'),
    staged: args.has('--staged'),
  }
}

function listScopeFiles() {
  const joined = V2_SCOPE_DIRS.join(' ')
  const out = sh(`rg --files ${joined}`)
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function listChangedFiles(staged) {
  let out = ''
  try {
    out = sh(staged ? 'git diff --name-only --cached' : 'git diff --name-only')
  } catch {
    out = ''
  }
  if (!out) return []
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function inV2Scope(file) {
  return V2_SCOPE_DIRS.some((dir) => file.startsWith(`${dir}/`) || file === dir)
}

function classifyDimension(file) {
  if (!file.startsWith('src/components/admin/')) return null
  if (file.startsWith('src/components/admin/shared/')) return 'shared'

  const isLogicPath =
    file.includes('/hooks/') ||
    file.includes('/utils/') ||
    /\/use[A-Z0-9].*\.(ts|tsx)$/.test(file) ||
    file.endsWith('/types.ts')

  if (isLogicPath) return 'logic'
  return 'ui'
}

function checkSingleDimension(changedFiles) {
  const dimensions = new Set(
    changedFiles
      .map(classifyDimension)
      .filter(Boolean)
  )

  if (dimensions.size <= 1) return []
  return [
    `检测到多维度改动：${Array.from(dimensions).join(', ')}`,
    '规则：单个 PR 只能属于 shared / ui / logic 其中一个维度。',
  ]
}

function checkFileContent(file) {
  if (!SOURCE_EXT_RE.test(file)) return []
  if (!existsSync(file)) return []

  const text = readFileSync(file, 'utf8')
  const issues = []

  if (/\b(?:window\.)?confirm\s*\(/.test(text)) {
    issues.push(`${file}: 禁止直接调用 confirm()，请使用 ConfirmDialog。`)
  }

  if (text.includes('apiClient.delete(') && !text.includes('ConfirmDialog')) {
    issues.push(`${file}: 检测到删除接口调用但未接入 ConfirmDialog 二次确认。`)
  }

  if (/setTimeout\s*\(/.test(text) && /toast/i.test(text) && !text.includes('useAdminToast')) {
    issues.push(`${file}: 检测到 toast + setTimeout，请改为 useAdminToast。`)
  }

  return issues
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  const candidates = opts.all ? listScopeFiles() : listChangedFiles(opts.staged)
  const scopeFiles = candidates.filter((file) => inV2Scope(file))

  if (scopeFiles.length === 0) {
    console.log('verify-admin-guardrails: no in-scope files to check')
    process.exit(0)
  }

  const issues = []
  if (!opts.all) {
    issues.push(...checkSingleDimension(scopeFiles))
  }
  for (const file of scopeFiles) {
    issues.push(...checkFileContent(file))
  }

  if (issues.length > 0) {
    console.error('verify-admin-guardrails failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  console.log(`verify-admin-guardrails passed (${scopeFiles.length} files checked)`)
}

main()
