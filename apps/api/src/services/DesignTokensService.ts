/**
 * DesignTokensService.ts — Token 后台写回编排（REG-M1-04 / ADR-043）
 *
 * 依赖注入：{ db, readEnv, execBuild, repoRoot } 使所有分支在单元级别可测。
 * 写回顺序：assertWriteAllowed → validate → db CAS → backup → writeFile → build
 *           失败路径：restore backup + 抛 BuildError（DB 已更新，CSS 未重建，下次重新 build）
 */

import { execFileSync } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pool } from 'pg'
import * as brandsQueries from '@/api/db/queries/brands'
import type { Brand, BrandOverrides } from '@/api/db/queries/brands'

// ── 常量 ────────────────────────────────────────────────────────

const PRIMITIVE_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'colors', 'space', 'radius', 'typography', 'shadow', 'motion', 'size', 'zIndex',
])

const SEMANTIC_ALLOWED: ReadonlySet<string> = new Set([
  'bg', 'fg', 'border', 'accent', 'surface', 'state',
])

const COMPONENT_ALLOWED: ReadonlySet<string> = new Set([
  'button', 'card', 'input', 'modal', 'player', 'table', 'tabs', 'tooltip',
])

const MAX_HISTORY = 3

// ── 오류 클래스 ────────────────────────────────────────────────

export class DesignTokensWriteDisabledError extends Error {
  readonly code = 'DESIGN_TOKENS_WRITE_DISABLED'
  constructor() {
    super('Token 后台写回在生产环境已禁用')
  }
}

export class DesignTokensConflictError extends Error {
  readonly code = 'DESIGN_TOKENS_CONFLICT'
  constructor() {
    super('Token 版本冲突，请刷新后重试（expectedUpdatedAt 不匹配）')
  }
}

export class DesignTokensValidationError extends Error {
  readonly code = 'DESIGN_TOKENS_VALIDATION'
  constructor(readonly details: string[]) {
    super(`Token 校验失败：\n${details.map((d) => `  ${d}`).join('\n')}`)
  }
}

export class DesignTokensBuildError extends Error {
  readonly code = 'DESIGN_TOKENS_BUILD'
  constructor(readonly stderr: string) {
    super(`Token CSS 构建失败，FS 已回滚`)
  }
}

// ── 校验 ─────────────────────────────────────────────────────

function validateOverrides(input: unknown): BrandOverrides {
  if (input === null || input === undefined) return {}
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new DesignTokensValidationError(['BrandOverrides 必须是 plain object'])
  }

  const errors: string[] = []
  const overrides = input as Record<string, unknown>

  for (const key of Object.keys(overrides)) {
    if (PRIMITIVE_FORBIDDEN_KEYS.has(key)) {
      errors.push(`primitive 键 "${key}" 禁止写入 BrandOverrides（ADR-022）`)
    }
  }

  if (errors.length > 0) throw new DesignTokensValidationError(errors)

  const semantic = overrides['semantic']
  if (semantic !== null && semantic !== undefined) {
    if (typeof semantic !== 'object' || Array.isArray(semantic)) {
      errors.push('semantic 必须是 plain object')
    } else {
      for (const key of Object.keys(semantic as Record<string, unknown>)) {
        if (!SEMANTIC_ALLOWED.has(key)) {
          errors.push(`semantic.${key} 不是合法 semantic override 键`)
        }
      }
    }
  }

  const component = overrides['component']
  if (component !== null && component !== undefined) {
    if (typeof component !== 'object' || Array.isArray(component)) {
      errors.push('component 必须是 plain object')
    } else {
      for (const key of Object.keys(component as Record<string, unknown>)) {
        if (!COMPONENT_ALLOWED.has(key)) {
          errors.push(`component.${key} 不是合法 component override 键`)
        }
      }
    }
  }

  if (errors.length > 0) throw new DesignTokensValidationError(errors)
  return overrides as BrandOverrides
}

// ── 文件路径 ──────────────────────────────────────────────────

function brandFilePath(slug: string, repoRoot: string): string {
  const filename = slug === 'resovo' ? 'default.ts' : `${slug}.ts`
  return resolve(repoRoot, 'packages/design-tokens/src/brands', filename)
}

function historyDir(repoRoot: string): string {
  return resolve(repoRoot, 'packages/design-tokens/.history')
}

// ── 文件内容生成 ─────────────────────────────────────────────

function generateBrandFileContent(slug: string, overrides: BrandOverrides): string {
  const isDefault = slug === 'resovo'
  const overridesJson = JSON.stringify(overrides, null, 2)
  if (isDefault) {
    return [
      '/**',
      ' * brand 文件命名约定（REG-M1-04-PREP）：',
      ' *   - 默认品牌固定使用此文件，slug=\'resovo\'，不新建 resovo.ts',
      ' *   - 多品牌时在此目录添加 <slug>.ts，导出实现了 BrandOverrides 的对象',
      ' *   - BrandOverrides 写回时以 overrides 字段 patch 到 defaultBrandOverrides',
      ' *   - 禁止覆盖 primitive 顶层键（TS excess-property check 在编译期拦截）',
      ' */',
      "import type { Brand, BrandOverrides } from './types.js'",
      '',
      "export const DEFAULT_BRAND_SLUG = 'resovo' as const",
      "export const DEFAULT_BRAND_NAME = 'Resovo' as const",
      '',
      `export const defaultBrandOverrides: BrandOverrides = Object.freeze(${overridesJson})`,
      '',
      'export const defaultBrand: Brand = Object.freeze({',
      "  id: '00000000-0000-0000-0000-000000000000',",
      '  slug: DEFAULT_BRAND_SLUG,',
      '  name: DEFAULT_BRAND_NAME,',
      '  overrides: defaultBrandOverrides,',
      '  createdAt: new Date(0),',
      '  updatedAt: new Date(0),',
      '})',
      '',
    ].join('\n')
  }
  const exportName = `${slug.replace(/-/g, '_')}BrandOverrides`
  return [
    "import type { BrandOverrides } from './types.js'",
    '',
    `export const ${exportName}: BrandOverrides = Object.freeze(${overridesJson})`,
    '',
  ].join('\n')
}

// ── 历史版本管理 ─────────────────────────────────────────────

async function saveHistory(
  dir: string,
  slug: string,
  overrides: BrandOverrides,
  commitMessage: string,
): Promise<string> {
  await fsp.mkdir(dir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 19)
  const id = `${slug}-${ts}Z`
  const file = resolve(dir, `${id}.json`)
  await fsp.writeFile(file, JSON.stringify({ timestamp: new Date().toISOString(), slug, commitMessage, overrides }, null, 2))

  // 保留最新 MAX_HISTORY 份
  const all = (await fsp.readdir(dir))
    .filter((f) => f.startsWith(`${slug}-`) && f.endsWith('.json'))
    .sort()
    .reverse()
  for (const old of all.slice(MAX_HISTORY)) {
    await fsp.unlink(resolve(dir, old)).catch(() => undefined)
  }
  return id
}

// ── 服务类 ──────────────────────────────────────────────────

interface DesignTokensServiceDeps {
  db: Pool
  readEnv?: () => { NODE_ENV?: string; DESIGN_TOKENS_WRITE_DISABLED?: string }
  repoRoot?: string
  runBuildFn?: (repoRoot: string) => void
}

interface UpdateBrandInput {
  overrides: unknown
  expectedUpdatedAt: Date
  commitMessage?: string
}

interface ResolvedBrandData {
  brand: Brand
  overrideMap: Record<string, 'base' | 'brand-override'>
  cssBuiltAt?: string
  historyId?: string
}

export class DesignTokensService {
  private readonly readEnv: () => { NODE_ENV?: string; DESIGN_TOKENS_WRITE_DISABLED?: string }
  private readonly repoRoot: string
  private readonly runBuildFn: (repoRoot: string) => void

  constructor(private readonly db: Pool, deps: DesignTokensServiceDeps = { db }) {
    this.readEnv = deps.readEnv ?? (() => process.env)
    this.repoRoot = deps.repoRoot ?? resolve(fileURLToPath(import.meta.url), '../../../../../')
    this.runBuildFn = deps.runBuildFn ?? ((root) => {
      execFileSync('tsx', [resolve(root, 'packages/design-tokens/scripts/build-css.ts')], {
        cwd: root,
        encoding: 'utf-8',
        stdio: ['ignore', 'ignore', 'pipe'],
      })
    })
  }

  private assertWriteAllowed(): void {
    const env = this.readEnv()
    if (env.NODE_ENV === 'production' || env.DESIGN_TOKENS_WRITE_DISABLED) {
      throw new DesignTokensWriteDisabledError()
    }
  }

  async getBrand(slug: string): Promise<Brand | null> {
    return brandsQueries.getBrandBySlug(this.db, slug)
  }

  async getBrandResolved(slug: string): Promise<{
    brand: Brand
    overrideMap: Record<string, 'base' | 'brand-override'>
    base: Record<string, string>
  } | null> {
    const brand = await brandsQueries.getBrandBySlug(this.db, slug)
    if (!brand) return null
    const overrides = brand.overrides
    const overrideKeys = new Set<string>()
    flattenKeys(overrides.semantic, 'semantic', overrideKeys)
    flattenKeys(overrides.component, 'component', overrideKeys)
    const overrideMap = Object.fromEntries(
      [...overrideKeys].map((k) => [k, 'brand-override' as const]),
    ) as Record<string, 'base' | 'brand-override'>
    return { brand, overrideMap, base: {} }
  }

  async getBrandOverrideMap(slug: string): Promise<Record<string, 'base' | 'brand-override'>> {
    const result = await this.getBrandResolved(slug)
    return result?.overrideMap ?? {}
  }

  async updateBrand(slug: string, input: UpdateBrandInput): Promise<ResolvedBrandData> {
    this.assertWriteAllowed()

    const overrides = validateOverrides(input.overrides)
    const commitMessage = input.commitMessage ?? `tokens(${slug}): update overrides`

    const brand = await brandsQueries.updateBrandOverridesIfUnchanged(
      this.db, slug, overrides, input.expectedUpdatedAt,
    )
    if (!brand) throw new DesignTokensConflictError()

    const filePath = brandFilePath(slug, this.repoRoot)
    const histDirPath = historyDir(this.repoRoot)
    let originalContent: string | null = null
    let historyId: string | undefined

    try {
      originalContent = await fsp.readFile(filePath, 'utf-8').catch(() => null)
      historyId = await saveHistory(histDirPath, slug, overrides, commitMessage)

      const newContent = generateBrandFileContent(slug, overrides)
      // attempt prettier format (best-effort)
      const formatted = await tryFormatWithPrettier(newContent, filePath)
      const tmpPath = `${filePath}.tmp`
      await fsp.writeFile(tmpPath, formatted)
      await fsp.rename(tmpPath, filePath)

      const builtAt = new Date().toISOString()
      this.runBuildFn(this.repoRoot)

      const overrideMap = await this.getBrandOverrideMap(slug)
      return { brand, overrideMap, cssBuiltAt: builtAt, historyId }
    } catch (err) {
      if (originalContent !== null) {
        await fsp.writeFile(filePath, originalContent).catch(() => undefined)
      }
      if (historyId) {
        await fsp.unlink(resolve(histDirPath, `${historyId}.json`)).catch(() => undefined)
      }
      if (err instanceof DesignTokensBuildError) throw err
      throw new DesignTokensBuildError(err instanceof Error ? err.message : String(err))
    }
  }
}

// ── 工具 ─────────────────────────────────────────────────────

function flattenKeys(node: unknown, prefix: string, out: Set<string>): void {
  if (node === null || node === undefined) return
  if (typeof node === 'string' || typeof node === 'number') {
    out.add(prefix)
    return
  }
  if (typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flattenKeys(value, `${prefix}.${key}`, out)
    }
  }
}

async function tryFormatWithPrettier(source: string, filepath: string): Promise<string> {
  try {
    const prettier = await import('prettier')
    return await prettier.format(source, { parser: 'typescript', filepath })
  } catch {
    return source
  }
}
