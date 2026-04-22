import { notFound } from 'next/navigation'
import { RouteStack } from '@/components/primitives/route-stack'
import { SharedElementProvider } from '@/components/primitives/shared-element'
import { DemoClient } from './DemoClient'

export default function PrimitivesDemoPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <RouteStack>
      <SharedElementProvider>
        <DemoClient />
      </SharedElementProvider>
    </RouteStack>
  )
}
