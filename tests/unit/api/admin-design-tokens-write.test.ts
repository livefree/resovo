/**
 * tests/unit/api/admin-design-tokens-write.test.ts
 * REG-M1-04: DesignTokensService 写回路径单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DesignTokensService,
  DesignTokensWriteDisabledError,
  DesignTokensConflictError,
  DesignTokensValidationError,
} from '../../../apps/api/src/services/DesignTokensService'

// ── mock db ────────────────────────────────────────────────────

const mockBrand = {
  id: 'brand-uuid-1',
  slug: 'resovo',
  name: 'Resovo',
  overrides: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-04-19T10:00:00.000Z'),
}

vi.mock('../../../apps/api/src/db/queries/brands', () => ({
  getBrandBySlug: vi.fn((_db: unknown, _slug: string) => Promise.resolve(mockBrand)),
  listBrands: vi.fn(() => Promise.resolve([mockBrand])),
  updateBrandOverridesIfUnchanged: vi.fn(),
}))

import * as brandsQueries from '../../../apps/api/src/db/queries/brands'

const mockQ = brandsQueries as {
  updateBrandOverridesIfUnchanged: ReturnType<typeof vi.fn>
}

// ── helpers ────────────────────────────────────────────────────

function makeService(overrideEnv?: Record<string, string>) {
  const fsMock = {
    readFile: vi.fn().mockResolvedValue('/* original */'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined),
  }

  const svc = new DesignTokensService({} as never, {
    db: {} as never,
    readEnv: () => overrideEnv ?? {},
    repoRoot: '/fake/repo',
    runBuildFn: vi.fn(),
  })

  // inject fs mock via prototype manipulation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = Object.getPrototypeOf(svc) as any
  void proto
  return { svc, fsMock }
}

describe('DesignTokensService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── 生产只读 ────────────────────────────────────────────────

  it('production NODE_ENV → 抛 DesignTokensWriteDisabledError', async () => {
    const svc = new DesignTokensService({} as never, {
      db: {} as never,
      readEnv: () => ({ NODE_ENV: 'production' }),
      repoRoot: '/fake/repo',
      runBuildFn: vi.fn(),
    })
    await expect(svc.updateBrand('resovo', {
      overrides: {},
      expectedUpdatedAt: new Date(),
    })).rejects.toThrow(DesignTokensWriteDisabledError)
  })

  it('DESIGN_TOKENS_WRITE_DISABLED 非空 → 抛 DesignTokensWriteDisabledError', async () => {
    const svc = new DesignTokensService({} as never, {
      db: {} as never,
      readEnv: () => ({ DESIGN_TOKENS_WRITE_DISABLED: '1' }),
      repoRoot: '/fake/repo',
      runBuildFn: vi.fn(),
    })
    await expect(svc.updateBrand('resovo', {
      overrides: {},
      expectedUpdatedAt: new Date(),
    })).rejects.toThrow(DesignTokensWriteDisabledError)
  })

  // ── 校验失败 ────────────────────────────────────────────────

  it('primitive 键（colors）→ 抛 DesignTokensValidationError', async () => {
    const svc = new DesignTokensService({} as never, {
      db: {} as never,
      readEnv: () => ({}),
      repoRoot: '/fake/repo',
      runBuildFn: vi.fn(),
    })
    await expect(svc.updateBrand('resovo', {
      overrides: { colors: { red: '#ff0000' } },
      expectedUpdatedAt: new Date(),
    })).rejects.toThrow(DesignTokensValidationError)
  })

  it('非法 semantic 键 → 抛 DesignTokensValidationError', async () => {
    const svc = new DesignTokensService({} as never, {
      db: {} as never,
      readEnv: () => ({}),
      repoRoot: '/fake/repo',
      runBuildFn: vi.fn(),
    })
    await expect(svc.updateBrand('resovo', {
      overrides: { semantic: { invalid_key: {} } },
      expectedUpdatedAt: new Date(),
    })).rejects.toThrow(DesignTokensValidationError)
  })

  // ── 乐观锁冲突 ─────────────────────────────────────────────

  it('updateBrandOverridesIfUnchanged 返回 null → 抛 DesignTokensConflictError', async () => {
    mockQ.updateBrandOverridesIfUnchanged.mockResolvedValueOnce(null)

    const svc = new DesignTokensService({} as never, {
      db: {} as never,
      readEnv: () => ({}),
      repoRoot: '/fake/repo',
      runBuildFn: vi.fn(),
    })
    await expect(svc.updateBrand('resovo', {
      overrides: { semantic: { bg: { light: { canvas: '#fff' } } } },
      expectedUpdatedAt: new Date('2026-04-19T10:00:00.000Z'),
    })).rejects.toThrow(DesignTokensConflictError)
  })

  // ── getBrand ────────────────────────────────────────────────

  it('getBrand 返回已知 slug 的 brand', async () => {
    const svc = new DesignTokensService({} as never, { db: {} as never })
    const result = await svc.getBrand('resovo')
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('resovo')
  })
})
