import { CategoryPageContent } from '../[type]/page'

export default async function AnimePage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  return CategoryPageContent({ locale, type: 'anime' })
}
