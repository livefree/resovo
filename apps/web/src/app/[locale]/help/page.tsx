import type { Metadata } from 'next'
import { FooterInfoPage } from '@/components/layout/FooterInfoPage'

export const metadata: Metadata = {
  title: 'Help - Resovo',
}

export default function HelpPage() {
  return (
    <FooterInfoPage
      title="Help Center"
      subtitle="常见问题与使用说明"
      updatedAt="2026-03-27"
      sections={[
        {
          title: 'Getting Started',
          paragraphs: [
            'Resovo 聚合公开可访问的视频链接。你可以通过首页推荐、分类页或搜索页快速找到内容。',
            '点击卡片中央播放按钮可直接进入播放页，点击卡片其他区域会进入详情页查看简介与信息。',
          ],
        },
        {
          title: 'Playback Issues',
          paragraphs: [
            '如果当前线路无法播放，请在播放页切换到“线路”标签，尝试其他可用源。',
            '若仍无法播放，可稍后重试，或在站内反馈渠道提交问题，我们会优先检查该资源可用性。',
          ],
        },
        {
          title: 'Account & Access',
          paragraphs: [
            '未登录用户可浏览与播放公开内容。登录后可获得更完整的个性化功能与进度体验。',
            '如遇登录异常，请检查邮箱/用户名与密码是否正确，必要时清理浏览器缓存后重试。',
          ],
        },
      ]}
    />
  )
}
