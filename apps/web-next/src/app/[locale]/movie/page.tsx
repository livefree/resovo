import { CategoryPageContent } from '../[type]/page'

export default async function MoviePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return CategoryPageContent({ locale, type: 'movie' })
}
