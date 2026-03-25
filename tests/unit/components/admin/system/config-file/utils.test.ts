import { describe, expect, it } from 'vitest'
import {
  normalizeSubscriptionUrl,
  parseJsonToPrettyText,
  validateJsonText,
} from '@/components/admin/system/config-file/utils'

describe('config-file/utils', () => {
  it('validates json text', () => {
    expect(validateJsonText('{}')).toEqual({ ok: true, error: null })
    expect(validateJsonText('')).toEqual({ ok: true, error: null })
    expect(validateJsonText('{bad').ok).toBe(false)
  })

  it('formats json with pretty print', () => {
    expect(parseJsonToPrettyText('{"a":1}')).toBe('{\n  "a": 1\n}')
  })

  it('normalizes subscription url', () => {
    expect(normalizeSubscriptionUrl(' https://example.com/a.json ')).toEqual({
      ok: true,
      value: 'https://example.com/a.json',
      shouldClear: false,
    })
    expect(normalizeSubscriptionUrl('   ')).toEqual({
      ok: true,
      shouldClear: true,
    })
    expect(normalizeSubscriptionUrl('ftp://example.com/a.json').ok).toBe(false)
  })
})
