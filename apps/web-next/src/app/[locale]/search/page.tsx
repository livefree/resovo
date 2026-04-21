import { Suspense } from 'react'
import { SearchCircularReveal } from '@/components/search/SearchCircularReveal'
import { SearchPage } from './_components/SearchPage'

export default function SearchRoute() {
  return (
    <SearchCircularReveal>
      <Suspense fallback={<SearchPage.Skeleton />}>
        <SearchPage />
      </Suspense>
    </SearchCircularReveal>
  )
}
