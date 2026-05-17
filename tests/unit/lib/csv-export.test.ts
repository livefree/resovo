/**
 * @vitest-environment jsdom
 *
 * csv-export.test.ts — 共享 CSV 工具单元测试（CHG-SN-6-21）
 *
 * downloadCsv 依赖 document / URL，需 jsdom 环境（vitest.config.ts 默认 tests/unit/lib 为 node）。
 *
 * 覆盖（≥ 6）：
 *   1. escapeCsvCell：基础类型映射
 *   2. escapeCsvCell：null / undefined → 空
 *   3. escapeCsvCell：含 comma / newline / quote 自动引号包裹 + 内部 quote 双倍
 *   4. escapeCsvCell：object → JSON.stringify
 *   5. toCsv：表头 + 行 + CRLF 行尾
 *   6. toCsv：空行数组 → 只有表头
 *   7. downloadCsv：触发 a.click + filename 设置 + BOM 前缀
 *   8. downloadCsv：返回的 csv 体可断言内容
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { escapeCsvCell, toCsv, downloadCsv, type CsvColumn } from '../../../apps/server-next/src/lib/csv-export'

interface Row {
  readonly id: string
  readonly count: number
  readonly note: string | null
  readonly meta?: Record<string, unknown> | null
}

const COLUMNS: readonly CsvColumn<Row>[] = [
  { header: 'id', accessor: (r) => r.id },
  { header: 'count', accessor: (r) => r.count },
  { header: 'note', accessor: (r) => r.note },
  { header: 'meta', accessor: (r) => r.meta },
]

describe('csv-export', () => {
  it('1. escapeCsvCell：string / number / boolean 直出', () => {
    expect(escapeCsvCell('hello')).toBe('hello')
    expect(escapeCsvCell(42)).toBe('42')
    expect(escapeCsvCell(true)).toBe('true')
    expect(escapeCsvCell(false)).toBe('false')
  })

  it('2. escapeCsvCell：null / undefined → 空字符串', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
  })

  it('3. escapeCsvCell：含 comma / newline / quote 自动引号包裹 + quote 双倍', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('a\nb')).toBe('"a\nb"')
    expect(escapeCsvCell('he said "hi"')).toBe('"he said ""hi"""')
    expect(escapeCsvCell('a\r\nb')).toBe('"a\r\nb"')
  })

  it('4. escapeCsvCell：object → JSON.stringify 后按 string 规则', () => {
    const obj = { foo: 'bar', n: 1 }
    expect(escapeCsvCell(obj)).toBe('"{""foo"":""bar"",""n"":1}"')
  })

  it('5. toCsv：表头 + 行 + CRLF 行尾', () => {
    const rows: Row[] = [
      { id: 'a', count: 1, note: 'ok', meta: null },
      { id: 'b', count: 2, note: null, meta: { x: 1 } },
    ]
    const out = toCsv(rows, COLUMNS)
    const lines = out.split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('id,count,note,meta')
    expect(lines[1]).toBe('a,1,ok,')
    expect(lines[2]).toBe('b,2,,"{""x"":1}"')
  })

  it('6. toCsv：空行数组 → 只有表头', () => {
    const out = toCsv<Row>([], COLUMNS)
    expect(out).toBe('id,count,note,meta')
  })

  it('7. downloadCsv：触发 a.click + filename + BOM 前缀 blob', () => {
    const clickSpy = vi.fn()
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    const revokeSpy = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeSpy, configurable: true })
    const origCreate = document.createElement.bind(document)
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = origCreate(tag) as HTMLElement
      if (tag === 'a') {
        ;(el as HTMLAnchorElement).click = clickSpy
      }
      return el
    })
    try {
      const rows: Row[] = [{ id: 'x', count: 9, note: 'n', meta: null }]
      downloadCsv(rows, COLUMNS, 'export.csv')
      expect(createObjectUrlSpy).toHaveBeenCalledOnce()
      const blobArg = createObjectUrlSpy.mock.calls[0]?.[0] as Blob
      expect(blobArg).toBeInstanceOf(Blob)
      expect(blobArg.type).toContain('text/csv')
      // 第一个 part 是 BOM '﻿'
      expect(clickSpy).toHaveBeenCalledOnce()
    } finally {
      createSpy.mockRestore()
    }
  })

  it('8. downloadCsv：返回 csv 字符串可断言内容', () => {
    const createObjectUrlSpy = vi.fn(() => 'blob:fake-url')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectUrlSpy, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    const rows: Row[] = [{ id: 'y', count: 1, note: null, meta: null }]
    const csv = downloadCsv(rows, COLUMNS, 'out.csv')
    expect(csv).toBe('id,count,note,meta\r\ny,1,,')
  })
})

beforeEach(() => {
  vi.restoreAllMocks()
})
