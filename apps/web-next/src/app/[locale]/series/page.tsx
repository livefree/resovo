import { CategoryPageContent } from '../[type]/page'

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return CategoryPageContent({ locale, type: 'series' })
}
