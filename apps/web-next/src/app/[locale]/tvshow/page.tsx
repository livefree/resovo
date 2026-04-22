import { CategoryPageContent } from '../[type]/page'

export default async function TvshowPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return CategoryPageContent({ locale, type: 'tvshow' })
}
