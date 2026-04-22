import { Suspense } from 'react'
import { SearchCircularReveal } from '@/components/search/SearchCircularReveal'
import { SearchPage, SearchPageSkeleton } from './_components/SearchPage'

export default function SearchRoute() {
  return (
    <SearchCircularReveal>
      <Suspense fallback={<SearchPageSkeleton />}>
        <SearchPage />
      </Suspense>
    </SearchCircularReveal>
  )
}
