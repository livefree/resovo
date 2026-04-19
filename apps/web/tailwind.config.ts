import type { Config } from 'tailwindcss'
import designTokensPreset from '../../packages/design-tokens/tailwind-preset.js'

const config: Config = {
  content: [
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  presets: [designTokensPreset],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
