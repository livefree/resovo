/**
 * _diff.ts — BrandOverrides diff 计算 + commit message 生成（纯函数）
 * REG-M1-04: 供 DiffPanel 和前端 working-copy 状态计算
 */

import { flattenOverrides } from './_paths'
import type { FlatOverrides } from './_paths'

export interface FieldDiff {
  readonly path: string
  readonly oldValue?: string
  readonly newValue?: string
  readonly type: 'added' | 'changed' | 'removed'
}

export interface OverridesDiff {
  readonly added: FieldDiff[]
  readonly changed: FieldDiff[]
  readonly removed: FieldDiff[]
  readonly totalChanges: number
}

/**
 * diffOverrides — 比较两个 BrandOverrides 对象，产出结构化 diff
 */
export function diffOverrides(baseline: unknown, working: unknown): OverridesDiff {
  const flatBaseline: FlatOverrides = flattenOverrides(baseline)
  const flatWorking: FlatOverrides = flattenOverrides(working)

  const allKeys = new Set([...Object.keys(flatBaseline), ...Object.keys(flatWorking)])
  const added: FieldDiff[] = []
  const changed: FieldDiff[] = []
  const removed: FieldDiff[] = []

  for (const path of allKeys) {
    const oldValue = flatBaseline[path]
    const newValue = flatWorking[path]
    if (oldValue === undefined && newValue !== undefined) {
      added.push({ path, newValue, type: 'added' })
    } else if (oldValue !== undefined && newValue === undefined) {
      removed.push({ path, oldValue, type: 'removed' })
    } else if (oldValue !== newValue) {
      changed.push({ path, oldValue, newValue, type: 'changed' })
    }
  }

  return { added, changed, removed, totalChanges: added.length + changed.length + removed.length }
}

/**
 * buildCommitMessage — 从 diff 结果生成默认 commit message
 */
export function buildCommitMessage(diff: OverridesDiff, slug: string): string {
  const { added, changed, removed, totalChanges } = diff
  if (totalChanges === 0) return `tokens(${slug}): no changes`

  const verbs: string[] = []
  if (added.length > 0) verbs.push('added')
  if (changed.length > 0) verbs.push('updated')
  if (removed.length > 0) verbs.push('removed')

  const verb = verbs.length === 1 ? verbs[0]! : 'touched'
  const allPaths = [...added, ...changed, ...removed].map((d) => d.path)
  const scopes = topScopes(allPaths, 3)
  const scopeStr = scopes.length > 0 ? ` [${scopes.join(', ')}]` : ''
  return `tokens(${slug}): ${verb} ${totalChanges} field(s)${scopeStr}`
}

function topScopes(paths: string[], limit: number): string[] {
  const counts = new Map<string, number>()
  for (const path of paths) {
    const parts = path.split('.')
    const scope = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] ?? path
    counts.set(scope, (counts.get(scope) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([scope]) => scope)
}
