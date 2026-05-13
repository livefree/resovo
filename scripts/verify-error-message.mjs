#!/usr/bin/env node
/**
 * verify-error-message.mjs — ADR §错误码 message 模板逐 row 核验
 * （CHG-SN-5-CHECKLIST-AUDIT 核心 B）
 *
 * 守卫：扫 apps/api/src/services + routes/admin 内 AppError 抛出 message + reply.code
 *      send error message，比对 docs/decisions.md 各 ADR §错误码 message 模板表。
 *
 * 白名单：generic message 如"服务器内部错误"/"参数错误"/"无效请求"/zod 默认 issue
 *
 * 退出码：0 = 通过；1 = 命中违规；2 = 脚本错误
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { splitAdrSections, parseErrorMessages } from './lib/adr-parser.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DECISIONS = join(ROOT, 'docs/decisions.md')

// 白名单 generic message
const GENERIC_WHITELIST = new Set([
  '服务器内部错误',
  '参数错误',
  '无效请求',
  '未授权',
  '禁止访问',
  '资源不存在',
  '请求格式错误',
])

const SCAN_DIRS = [
  join(ROOT, 'apps/api/src/services'),
  join(ROOT, 'apps/api/src/routes/admin'),
]

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* walk(full)
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts')) yield full
  }
}

function collectCodeMessages() {
  const messages = []
  for (const dir of SCAN_DIRS) {
    for (const file of walk(dir)) {
      const src = readFileSync(file, 'utf-8')
      const fileRel = file.replace(ROOT + '/', '')
      // new AppError('CODE', 'message', NNN)
      for (const m of src.matchAll(/new\s+AppError\s*\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g)) {
        messages.push({ msg: m[1], file: fileRel })
      }
      // new AppError('CODE', `template ${var}`, NNN) — 模板字面量略过细节
      // reply.code(NNN).send({ error: { ..., message: 'xxx', ... } })
      for (const m of src.matchAll(/message:\s*['"]([^'"]+)['"]/g)) {
        const msg = m[1]
        if (msg && msg.length > 1) messages.push({ msg, file: fileRel })
      }
    }
  }
  return messages
}

function collectAdrMessages() {
  const sections = splitAdrSections(DECISIONS)
  const messages = new Set()
  for (const adr of sections) {
    for (const m of parseErrorMessages(adr.body)) {
      messages.add(m)
    }
  }
  return messages
}

function tokenize(msg) {
  // 去掉变量插值（${var}）+ trim
  return msg.replace(/\$\{[^}]+\}/g, '').trim()
}

function isPrefixMatch(codeMsg, adrTemplate) {
  // 模板可能含 N / id 占位符；做前缀 ≥ 8 字匹配
  const a = tokenize(codeMsg)
  const b = tokenize(adrTemplate)
  if (a === b) return true
  const prefix = b.slice(0, Math.min(20, b.length / 2))
  return prefix.length > 8 && a.startsWith(prefix)
}

function main() {
  let exitCode = 0
  const codeMessages = collectCodeMessages()
  const adrMessages = collectAdrMessages()

  const unmatched = []
  for (const { msg, file } of codeMessages) {
    if (GENERIC_WHITELIST.has(msg)) continue
    // zod 默认 issue / parsed.error.issues[0]?.message 等动态消息 — grep 不到字面量，已天然跳过
    let matched = false
    for (const template of adrMessages) {
      if (isPrefixMatch(msg, template) || isPrefixMatch(template, msg)) {
        matched = true
        break
      }
    }
    if (!matched) unmatched.push({ msg, file })
  }

  if (unmatched.length > 0) {
    console.error(`\n⚠️ verify-error-message: ${unmatched.length} 条 message 文本未在任何 ADR §错误码 模板表中找到匹配：\n`)
    for (const { msg, file } of unmatched) {
      console.error(`  - "${msg}"  (${file})`)
    }
    console.error('\n修复路径：')
    console.error('  1. 在对应 ADR §错误码 message 模板表追加该 message 行（参 ADR-104/-105/-117 范式）')
    console.error('  2. 或在 scripts/verify-error-message.mjs GENERIC_WHITELIST 加入 generic message')
    console.error('\n⚠️ 当前为 advisory 模式（不阻塞 CI），但 milestone 审计前应清零。')
    // advisory 模式：保持 exitCode = 0 不阻塞 CI（arch-reviewer 第 2 轮建议 1：避免后续误读为死代码）
    // 升级路径：legacy 30+ 路由 message 清零后改为 exitCode = 1 强制 CI 阻塞
  } else {
    console.log(`✅ verify-error-message: ${codeMessages.length} 处 message 字面量全部对齐 ADR §错误码模板（${adrMessages.size} 个模板）`)
  }

  process.exit(exitCode)
}

try {
  main()
} catch (err) {
  console.error('verify-error-message 脚本执行错误：', err)
  process.exit(2)
}
