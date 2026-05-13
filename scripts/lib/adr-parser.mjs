#!/usr/bin/env node
/**
 * adr-parser.mjs — ADR markdown 解析共享模块（CHG-SN-5-CHECKLIST-AUDIT / A-CHECKLIST-2）
 *
 * 职责：解析 docs/decisions.md 内 ADR 章节 + §端点契约表 + §错误码表 + §决策要点 D-N 编号
 * 给 verify-endpoint-adr / verify-error-message / verify-adr-d-numbers 三脚本共用。
 *
 * 设计原则（A-CHECKLIST-1 修订路径）：当前 markdown table 容忍；长期可迁移结构化 YAML / JSON。
 */

import { readFileSync } from 'node:fs'

/**
 * 切分 ADR 章节，返回 [{ id, title, body }]
 * 识别 `## ADR-NNN` 或 `## ADR-NNN-SUFFIX` 标题
 */
export function splitAdrSections(decisionsPath) {
  const content = readFileSync(decisionsPath, 'utf-8')
  const lines = content.split('\n')
  const sections = []
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^##\s+(ADR-[0-9a-zA-Z-]+)[:：]?\s*(.*)$/)
    if (m) {
      if (current) sections.push(current)
      current = { id: m[1], title: m[2], body: [], startLine: i + 1 }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)
  return sections.map((s) => ({ ...s, body: s.body.join('\n') }))
}

/**
 * 在 ADR body 内查找指定段（如 "端点契约" / "错误码" / "决策要点"），返回该段原文
 */
function findSubsection(body, sectionName) {
  // 匹配 ### 标题；\b 对中文不匹配，故不用 word boundary
  const headerRe = new RegExp(`^###\\s+${sectionName}(?:\\s|$|（)`, 'm')
  const start = body.search(headerRe)
  if (start < 0) return ''
  const rest = body.slice(start)
  // 找下一个 ### 标题作为结束
  const nextHeader = rest.slice(1).search(/^###\s+/m)
  return nextHeader < 0 ? rest : rest.slice(0, nextHeader + 1)
}

/**
 * 解析 §端点契约 markdown table，返回 [{ method, path, responseFields }]
 * 端点契约表格式（ADR-104/-105/-117 范式）：
 * | # | 方法 | 路径 | 用途 | Request | Response | 错误码 | ...
 */
export function parseEndpointContract(adrBody) {
  const section = findSubsection(adrBody, '端点契约')
  if (!section) return []
  const rows = []
  const tableLines = section.split('\n').filter((l) => l.startsWith('|'))
  if (tableLines.length < 3) return rows // need header + separator + ≥1 row
  for (const line of tableLines.slice(2)) {
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (cells.length < 6) continue
    const method = cells[1]?.toUpperCase()
    const pathRaw = cells[2]
    const response = cells[5] ?? ''
    if (!method || !pathRaw) continue
    // path 在 markdown 表格里被 `code` 包裹
    const pathMatch = pathRaw.match(/`([^`]+)`/)
    const path = pathMatch ? pathMatch[1] : pathRaw
    // 提取 Response 字段：如 "200 `{ data: { auditId, targetVideo: VideoSummary } }`"
    const fieldMatches = [...response.matchAll(/`\{([^`]+)\}`/g)]
    const responseFields = fieldMatches
      .flatMap((m) => m[1].split(/[,:]/).map((s) => s.trim()))
      .filter((s) => s && /^[a-zA-Z_][\w]*$/.test(s))
    rows.push({ method, path, response, responseFields })
  }
  return rows
}

/**
 * 解析 §错误码 message 模板表
 * 表格式：| 场景 | message 模板 |
 */
export function parseErrorMessages(adrBody) {
  const section = findSubsection(adrBody, '错误码')
  if (!section) return []
  const messages = []
  const tableLines = section.split('\n').filter((l) => l.startsWith('|'))
  for (const line of tableLines) {
    // 提取所有 backtick-quoted 字符串
    for (const m of line.matchAll(/`'([^']+)'`|`"([^"]+)"`/g)) {
      const msg = m[1] ?? m[2]
      if (msg && msg.length > 1 && !msg.includes(':')) {
        messages.push(msg)
      }
    }
  }
  return messages
}

/**
 * 解析 ADR 内 D-NNN-N 偏离编号（搜全 ADR body，覆盖 §决策要点 / §端点契约 / §错误码 等多段）
 * 匹配 "D-117-1 PUT 鉴权" / "（D-117-2）" / "**当前实施偏离（D-117-7）**" 等
 *
 * CHG-SN-5-CHECKLIST-AUDIT-2 P0-2 修订：原仅搜 §决策要点 段，但 ADR 写作时 D 编号
 * 散布多段（如 ADR-117 D-117-7/-8/-9 写在 §端点契约 / §错误码 段），改全 body 搜。
 *
 * @param adrBody ADR 章节正文
 * @param adrId    ADR 标识（如 'ADR-117'）；若提供，仅返回 D-NNN-N 中 NNN 与 ADR 编号匹配的项
 *                 （避免 ADR-103 body 引用 D-117-N 时误归属为 ADR-103 own 偏离）
 */
export function parseDeviationNumbers(adrBody, adrId) {
  const numbers = new Set()
  // 提取 ADR 数字编号（如 'ADR-117' → '117'）
  let ownNumber = null
  if (adrId) {
    const m = adrId.match(/^ADR-(\d+)/)
    if (m) ownNumber = m[1]
  }
  for (const m of adrBody.matchAll(/D-(\d+)-(\d+)/g)) {
    if (ownNumber && m[1] !== ownNumber) continue  // 跳过非本 ADR own 的 D 编号
    numbers.add(`D-${m[1]}-${m[2]}`)
  }
  return [...numbers].sort()
}

/**
 * 解析 changelog.md 内已闭环的 D-N 编号
 * 单一真源（Y-CHECKLIST-1 修订）：以 changelog "D-NNN-N" 出现为权威
 */
export function parseChangelogDeviations(changelogPath) {
  const content = readFileSync(changelogPath, 'utf-8')
  const numbers = new Set()
  for (const m of content.matchAll(/D-(\d+)-(\d+)/g)) {
    numbers.add(`D-${m[1]}-${m[2]}`)
  }
  return [...numbers].sort()
}
