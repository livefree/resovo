'use client'

import useEmblaCarousel from 'embla-carousel-react'
import { useCallback, useEffect } from 'react'
import { SafeImage } from '@/components/media'
import { KenBurnsLayer } from './KenBurnsLayer'
import type { LocalizedBannerCard } from '@resovo/types'

interface BannerCarouselMobileProps {
  banners: LocalizedBannerCard[]
  activeIndex: number
  onSelect: (index: number) => void
}

/**
 * 移动端 Banner 轮播（embla-carousel），5:6 比例，手势 swipe。
 * 选中 index 变化时通知父组件更新 --banner-accent 色。
 */
export function BannerCarouselMobile({ banners, activeIndex, onSelect }: BannerCarouselMobileProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false })

  // 外部 activeIndex 变化时同步滚到对应 slide
  useEffect(() => {
    if (!emblaApi) return
    if (emblaApi.selectedScrollSnap() !== activeIndex) {
      emblaApi.scrollTo(activeIndex, false)
    }
  }, [emblaApi, activeIndex])

  // 用户 swipe 后通知父组件
  const handleSelect = useCallback(() => {
    if (!emblaApi) return
    onSelect(emblaApi.selectedScrollSnap())
  }, [emblaApi, onSelect])

  useEffect(() => {
    if (!emblaApi) return
    emblaApi.on('select', handleSelect)
    return () => { emblaApi.off('select', handleSelect) }
  }, [emblaApi, handleSelect])

  return (
    <div
      ref={emblaRef}
      className="overflow-hidden w-full"
      style={{ aspectRatio: '5/6' }}
      data-testid="banner-carousel-mobile"
    >
      <div className="flex h-full">
        {banners.map((banner, i) => (
          <div
            key={banner.id}
            className="relative shrink-0 w-full h-full overflow-hidden"
          >
            <KenBurnsLayer direction={(i % 2) as 0 | 1}>
              <SafeImage
                src={banner.imageUrl}
                alt={banner.title}
                width={600}
                height={720}
                priority={i === 0}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', aspectRatio: 'unset' }}
                imgClassName="object-cover"
                fallback={{ seed: banner.id }}
              />
            </KenBurnsLayer>
            {/* 渐变叠层 */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
          </div>
        ))}
      </div>
    </div>
  )
}
