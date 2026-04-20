/**
 * _patch.ts — BrandOverrides 深度 patch 工具（纯函数，无副作用）
 * REG-M1-04: 供前端 working-copy 和 service 写回前剪枝复用
 */

type PlainObject = Record<string, unknown>

function isPlainObject(val: unknown): val is PlainObject {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * setPath — 深度设置 dot-separated 路径的叶值
 * e.g. setPath({}, 'semantic.bg.light.canvas', '#fff') → { semantic: { bg: { light: { canvas: '#fff' } } } }
 */
export function setPath(obj: PlainObject, path: string, value: unknown): PlainObject {
  const keys = path.split('.')
  const result = deepClone(obj)

  let cur: PlainObject = result
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!
    if (!isPlainObject(cur[key])) {
      cur[key] = {}
    }
    cur = cur[key] as PlainObject
  }
  const lastKey = keys[keys.length - 1]!
  cur[lastKey] = value

  return result
}

/**
 * unsetPath — 深度删除 dot-separated 路径，并剪枝空父节点
 */
export function unsetPath(obj: PlainObject, path: string): PlainObject {
  const keys = path.split('.')
  const result = deepClone(obj)
  unsetInPlace(result, keys, 0)
  return result
}

function unsetInPlace(obj: PlainObject, keys: string[], depth: number): boolean {
  if (depth === keys.length - 1) {
    delete obj[keys[depth]!]
    return Object.keys(obj).length === 0
  }
  const key = keys[depth]!
  const child = obj[key]
  if (!isPlainObject(child)) return Object.keys(obj).length === 0
  const childEmpty = unsetInPlace(child, keys, depth + 1)
  if (childEmpty) delete obj[key]
  return Object.keys(obj).length === 0
}

/**
 * pruneEmpty — 递归删除空对象节点
 */
export function pruneEmpty(obj: PlainObject): PlainObject {
  const result: PlainObject = {}
  for (const [key, value] of Object.entries(obj)) {
    if (isPlainObject(value)) {
      const pruned = pruneEmpty(value)
      if (Object.keys(pruned).length > 0) {
        result[key] = pruned
      }
    } else if (value !== undefined) {
      result[key] = value
    }
  }
  return result
}

function deepClone(obj: PlainObject): PlainObject {
  return JSON.parse(JSON.stringify(obj)) as PlainObject
}
