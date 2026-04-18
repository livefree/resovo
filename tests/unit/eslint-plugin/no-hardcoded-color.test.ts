import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import { noHardcodedColor } from '../../../tools/eslint-plugin-resovo/src/rules/no-hardcoded-color'

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020 } })

describe('resovo/no-hardcoded-color', () => {
  it('flags hex colors', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [],
      invalid: [
        {
          code: 'const c = "#fff"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
        {
          code: 'const c = "#ffffff"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
        {
          code: 'const c = "#1a2b3cff"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
      ],
    })
  })

  it('flags rgb/rgba values', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [],
      invalid: [
        {
          code: 'const c = "rgb(0, 0, 0)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
        {
          code: 'const c = "rgba(255, 255, 255, 0.5)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
      ],
    })
  })

  it('flags hsl/hsla values', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [],
      invalid: [
        {
          code: 'const c = "hsl(200, 50%, 50%)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
        {
          code: 'const c = "hsla(200, 50%, 50%, 0.8)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
      ],
    })
  })

  it('flags oklch values', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [],
      invalid: [
        {
          code: 'const c = "oklch(0.7 0.15 200)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
      ],
    })
  })

  it('flags color() function values', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [],
      invalid: [
        {
          code: 'const c = "color(srgb 0.5 0.5 0.5)"',
          errors: [{ messageId: 'noHardcodedColor' }],
        },
      ],
    })
  })

  it('allows non-color strings', () => {
    ruleTester.run('no-hardcoded-color', noHardcodedColor, {
      valid: [
        { code: 'const c = "var(--color-brand)"' },
        { code: 'const c = "#my-element-id"' },
        { code: 'const c = "hello world"' },
        { code: 'const c = "#123xyz"' },
        { code: 'const c = "background"' },
      ],
      invalid: [],
    })
  })
})
