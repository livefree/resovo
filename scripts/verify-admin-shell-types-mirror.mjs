#!/usr/bin/env node
/**
 * verify-admin-shell-types-mirror.mjs — admin-shell 类型双源镜像 drift 守卫
 *
 * ADR-152 + ADR-155 D-155-2 / EP-2 N1-EP2-3
 *
 * 守卫：
 *   packages/admin-ui/src/shell/types.ts 与 packages/types/src/admin-shell.types.ts
 *   双源镜像保持严格同步（NotificationItem ↔ AdminNotificationItem / TaskItem ↔ AdminTaskItem）。
 *
 * 镜像规则：
 *   - 字段名 + 类型签名完全一致（差异仅在 interface 名前缀 'Admin'）
 *   - admin-ui 是 UI Shell SSOT（消费方 import NotificationItem / TaskItem）；
 *     packages/types 是后端 API SSOT 镜像（避免后端反向依赖 admin-ui）。
 *
 * drift 表现：
 *   - 某源新增字段但另一源缺失
 *   - 字段类型签名不一致
 *   - 字段可选性（?）不一致
 *
 * 退出码：0 = 通过；1 = drift 检出（阻塞 CI）；2 = 脚本错误
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const UI_TYPES = join(ROOT, 'packages/admin-ui/src/shell/types.ts')
const API_TYPES = join(ROOT, 'packages/types/src/admin-shell.types.ts')

const MIRRORS = [
  { uiName: 'NotificationItem', apiName: 'AdminNotificationItem' },
  { uiName: 'TaskItem',         apiName: 'AdminTaskItem' },
]

/**
 * 抽取 interface 字段（字段名 + 类型签名 / 不含注释）
 *
 * 输入：'export interface Foo {\n  /** 注释 *\/\n  readonly id: string\n  ...\n}'
 * 输出：Map<fieldName, normalizedTypeSignature>
 *
 * 规则：
 *   - 字段名以 readonly 可选；可选标记 `?` 包含在 fieldName 中（'id?' / 'id'）
 *   - 类型签名规范化：移除前缀空白 + 行尾分号
 *   - 多行类型签名：合并为单行（移除换行 + 多余空格）
 */
function extractInterfaceFields(source, interfaceName) {
  const re = new RegExp(`(?:export\\s+)?interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm')
  const match = source.match(re)
  if (!match) return null
  const body = match[1]
  const fields = new Map()

  // 移除单行 + 多行注释
  const noComments = body
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 多行 /* */
    .replace(/\/\/.*$/gm, '')           // 单行 //

  // 字段匹配：'  readonly id: string' 或 '  id?: number'
  // 字段名: [readonly] name[?]
  // 类型: : ... (到行尾或下一字段)
  const fieldRe = /^\s*(?:readonly\s+)?([a-zA-Z_$][\w$]*)(\??)\s*:\s*([^;\n]+?)\s*;?\s*$/gm
  let m
  while ((m = fieldRe.exec(noComments)) !== null) {
    const [, name, optional, typeSig] = m
    const key = optional ? `${name}?` : name
    const normalizedType = typeSig.trim().replace(/\s+/g, ' ')
    fields.set(key, normalizedType)
  }
  return fields
}

function compareFields(uiFields, apiFields, mirror) {
  const drifts = []
  const uiKeys = new Set(uiFields.keys())
  const apiKeys = new Set(apiFields.keys())

  // ui 有 / api 缺
  for (const key of uiKeys) {
    if (!apiKeys.has(key)) {
      drifts.push({
        kind: 'missing_in_api',
        mirror: mirror.apiName,
        field: key,
        uiType: uiFields.get(key),
      })
    }
  }
  // api 有 / ui 缺
  for (const key of apiKeys) {
    if (!uiKeys.has(key)) {
      drifts.push({
        kind: 'missing_in_ui',
        mirror: mirror.uiName,
        field: key,
        apiType: apiFields.get(key),
      })
    }
  }
  // 同字段类型不一致
  for (const key of uiKeys) {
    if (!apiKeys.has(key)) continue
    const uiType = uiFields.get(key)
    const apiType = apiFields.get(key)
    if (uiType !== apiType) {
      drifts.push({
        kind: 'type_mismatch',
        field: key,
        uiType,
        apiType,
        uiName: mirror.uiName,
        apiName: mirror.apiName,
      })
    }
  }
  return drifts
}

function main() {
  let uiSrc, apiSrc
  try {
    uiSrc = readFileSync(UI_TYPES, 'utf8')
    apiSrc = readFileSync(API_TYPES, 'utf8')
  } catch (e) {
    console.error(`✗ 读取源文件失败: ${e.message}`)
    process.exit(2)
  }

  let totalDrifts = 0
  const allDrifts = []

  for (const mirror of MIRRORS) {
    const uiFields = extractInterfaceFields(uiSrc, mirror.uiName)
    const apiFields = extractInterfaceFields(apiSrc, mirror.apiName)

    if (!uiFields) {
      console.error(`✗ 无法在 ${UI_TYPES} 找到 interface ${mirror.uiName}`)
      process.exit(2)
    }
    if (!apiFields) {
      console.error(`✗ 无法在 ${API_TYPES} 找到 interface ${mirror.apiName}`)
      process.exit(2)
    }

    const drifts = compareFields(uiFields, apiFields, mirror)
    if (drifts.length > 0) {
      totalDrifts += drifts.length
      allDrifts.push({ mirror, drifts, uiFields, apiFields })
    }
  }

  if (totalDrifts === 0) {
    console.log(`✅ verify-admin-shell-types-mirror: ${MIRRORS.length} 对双源镜像全部对齐（NotificationItem ↔ AdminNotificationItem / TaskItem ↔ AdminTaskItem）`)
    process.exit(0)
  }

  console.error(`\n✗ verify-admin-shell-types-mirror: 检出 ${totalDrifts} 处 drift\n`)
  for (const { mirror, drifts } of allDrifts) {
    console.error(`  ${mirror.uiName} (admin-ui) ↔ ${mirror.apiName} (types):`)
    for (const d of drifts) {
      if (d.kind === 'missing_in_api') {
        console.error(`    - api 缺字段: ${d.field} (ui: ${d.uiType})`)
      } else if (d.kind === 'missing_in_ui') {
        console.error(`    - ui 缺字段: ${d.field} (api: ${d.apiType})`)
      } else if (d.kind === 'type_mismatch') {
        console.error(`    - 类型不一致 ${d.field}:`)
        console.error(`        ui:  ${d.uiType}`)
        console.error(`        api: ${d.apiType}`)
      }
    }
  }
  console.error(`\n修复路径：`)
  console.error(`  双源镜像必须同步修改：packages/admin-ui/src/shell/types.ts 与 packages/types/src/admin-shell.types.ts`)
  console.error(`  - admin-ui 是 UI Shell SSOT（消费方直接 import）`)
  console.error(`  - packages/types 是后端 API SSOT 镜像（避免后端反向依赖 admin-ui）`)
  process.exit(1)
}

main()
