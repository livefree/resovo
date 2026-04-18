import type { Rule } from 'eslint'

// Exempted file patterns: token definition sources and build artifacts
const EXEMPT_PATTERNS = [
  /packages[/\\]design-tokens[/\\]src[/\\]primitives[/\\]color/,
  /[/\\]dist[/\\]/,
  /[/\\]\.next[/\\]/,
  /[/\\]node_modules[/\\]/,
]

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/i
const COLOR_FN_RE = /^(rgb|rgba|hsl|hsla|oklch|color)\s*\(/i

function isColorValue(value: string): boolean {
  const v = value.trim()
  return HEX_RE.test(v) || COLOR_FN_RE.test(v)
}

function detectFormat(value: string): string {
  const v = value.trim()
  if (HEX_RE.test(v)) return 'hex'
  if (/^rgba?\s*\(/i.test(v)) return 'rgb/rgba'
  if (/^hsla?\s*\(/i.test(v)) return 'hsl/hsla'
  if (/^oklch\s*\(/i.test(v)) return 'oklch'
  if (/^color\s*\(/i.test(v)) return 'color()'
  return 'color value'
}

export const noHardcodedColor: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded color values; use CSS variables (var(--token-name)) instead',
      category: 'Design System',
      recommended: true,
    },
    messages: {
      noHardcodedColor:
        'Hardcoded {{format}} "{{value}}" detected. Use a CSS variable (e.g. var(--color-brand-primary)) instead. ' +
        'Disable with: // eslint-disable-next-line resovo/no-hardcoded-color -- 待 M1 迁移',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    if (EXEMPT_PATTERNS.some((re) => re.test(filename))) return {}

    return {
      Literal(node) {
        if (typeof node.value !== 'string') return
        if (!isColorValue(node.value)) return
        context.report({
          node,
          messageId: 'noHardcodedColor',
          data: {
            format: detectFormat(node.value),
            value: node.value,
          },
        })
      },
    }
  },
}
