'use client'

import { useContext } from 'react'
import { ThemeContext } from '@/contexts/BrandProvider'
import type { ThemeContextValue } from '@/types/brand'

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error(
      '[useTheme] must be used inside <BrandProvider>. ' +
        'Ensure the consumer is rendered under the Root Layout.',
    )
  }
  return ctx
}
