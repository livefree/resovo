/**
 * _paths.ts — flatten / unflatten 工具（纯函数）
 * REG-M1-04: 供前端 diff 和 TokenEditor 状态管理
 */

type PlainObject = Record<string, unknown>

function isPlainObject(val: unknown): val is PlainObject {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export type FlatOverrides = Record<string, string>

/**
 * flattenOverrides — 将嵌套 object 展平为 { 'semantic.bg.light.canvas': '#fff' }
 */
export function flattenOverrides(obj: unknown, prefix = ''): FlatOverrides {
  const out: FlatOverrides = {}
  if (!isPlainObject(obj)) return out
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(value)) {
      Object.assign(out, flattenOverrides(value, path))
    } else if (typeof value === 'string' || typeof value === 'number') {
      out[path] = String(value)
    }
  }
  return out
}

/**
 * unflattenOverrides — 将展平对象还原为嵌套 object
 */
export function unflattenOverrides(flat: FlatOverrides): PlainObject {
  const out: PlainObject = {}
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split('.')
    let cur: PlainObject = out
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!
      if (!isPlainObject(cur[key])) cur[key] = {}
      cur = cur[key] as PlainObject
    }
    cur[keys[keys.length - 1]!] = value
  }
  return out
}
