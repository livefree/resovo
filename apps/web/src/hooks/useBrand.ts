'use client'

import { useContext } from 'react'
import { BrandContext } from '@/contexts/BrandProvider'
import type { BrandContextValue } from '@/types/brand'

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext)
  if (ctx === null) {
    throw new Error(
      '[useBrand] must be used inside <BrandProvider>. ' +
        'Ensure the consumer is rendered under the Root Layout.',
    )
  }
  return ctx
}
