import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TagLayer } from '@/components/primitives/media/TagLayer'
import { videoCardToTagProps } from '@/lib/tag-mapping'
import type { TagLayerProps } from '@/types/tag'

function renderTag(props: TagLayerProps) {
  return render(
    <div style={{ position: 'relative' }}>
      <TagLayer {...props} />
    </div>,
  )
}

describe('TagLayer', () => {
  describe('lifecycle 标签', () => {
    it('ongoing 显示"连载中"', () => {
      renderTag({ lifecycle: 'ongoing' })
      expect(screen.getByText('连载中')).toBeTruthy()
    })

    it('completed 显示"已完结"', () => {
      renderTag({ lifecycle: 'completed' })
      expect(screen.getByText('已完结')).toBeTruthy()
    })

    it('无 lifecycle 时不渲染左上块', () => {
      renderTag({ rating: { source: 'douban', value: 8.0 } })
      expect(screen.queryByText('连载中')).toBeNull()
      expect(screen.queryByText('已完结')).toBeNull()
    })
  })

  describe('trending 标签', () => {
    it('hot 显示"热门"', () => {
      renderTag({ trending: 'hot' })
      expect(screen.getByText('热门')).toBeTruthy()
    })

    it('editors_pick 显示"编辑推荐"', () => {
      renderTag({ trending: 'editors_pick' })
      expect(screen.getByText('编辑推荐')).toBeTruthy()
    })
  })

  describe('lifecycle + trending 同屏', () => {
    it('各最多 1 个，同时渲染时两者都出现在左上区', () => {
      renderTag({ lifecycle: 'ongoing', trending: 'hot' })
      expect(screen.getByText('连载中')).toBeTruthy()
      expect(screen.getByText('热门')).toBeTruthy()
    })
  })

  describe('spec 标签', () => {
    it('spec 数组最多显示 2 个', () => {
      renderTag({ specs: ['4k', 'hdr', 'dolby'] })
      expect(screen.getByText('4K')).toBeTruthy()
      expect(screen.getByText('HDR')).toBeTruthy()
      // 第 3 个不渲染
      expect(screen.queryByText('杜比')).toBeNull()
    })

    it('空 specs 数组不渲染右下块', () => {
      const { container } = renderTag({ specs: [] })
      expect(container.querySelector('.bottom-2')).toBeNull()
    })

    it('subtitled 显示"中字"', () => {
      renderTag({ specs: ['subtitled'] })
      expect(screen.getByText('中字')).toBeTruthy()
    })
  })

  describe('rating 标签', () => {
    it('渲染评分值，格式为"★ X.X"', () => {
      renderTag({ rating: { source: 'douban', value: 8.3 } })
      expect(screen.getByText('★ 8.3')).toBeTruthy()
    })

    it('无 rating 时不渲染右上块', () => {
      renderTag({ lifecycle: 'ongoing' })
      expect(screen.queryByText(/★/)).toBeNull()
    })

    it('rating 整数值保留一位小数', () => {
      renderTag({ rating: { source: 'imdb', value: 9 } })
      expect(screen.getByText('★ 9.0')).toBeTruthy()
    })
  })

  describe('空 props', () => {
    it('无任何 props 时不渲染任何可见内容', () => {
      const { container } = renderTag({})
      expect(container.firstChild?.childNodes.length).toBe(0)
    })
  })

  describe('无障碍', () => {
    it('所有标签区块均为 aria-hidden', () => {
      const { container } = renderTag({
        lifecycle: 'ongoing',
        trending: 'hot',
        specs: ['4k'],
        rating: { source: 'douban', value: 8.0 },
      })
      const visibleDivs = container.querySelectorAll('[aria-hidden="true"]')
      expect(visibleDivs.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('videoCardToTagProps 映射集成', () => {
    it('有字幕语言时派生 subtitled spec', () => {
      const props = videoCardToTagProps({
        status: 'ongoing',
        rating: null,
        subtitleLangs: ['zh-CN'],
      })
      renderTag(props)
      expect(screen.getByText('连载中')).toBeTruthy()
      expect(screen.getByText('中字')).toBeTruthy()
    })

    it('无字幕语言时不渲染 spec 区块', () => {
      const props = videoCardToTagProps({
        status: 'completed',
        rating: 8.5,
        subtitleLangs: [],
      })
      renderTag(props)
      expect(screen.queryByText('中字')).toBeNull()
      expect(screen.getByText('★ 8.5')).toBeTruthy()
    })

    it('trending 字段不存在时不渲染 trending 标签', () => {
      const props = videoCardToTagProps({
        status: 'ongoing',
        rating: null,
        subtitleLangs: [],
      })
      expect(props.trending).toBeUndefined()
    })
  })
})
