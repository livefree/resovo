import type { Metadata } from 'next'
import { FooterInfoPage } from '@/components/layout/FooterInfoPage'

export const metadata: Metadata = {
  title: 'About - Resovo',
}

export default function AboutPage() {
  return (
    <FooterInfoPage
      title="About Resovo"
      subtitle="关于我们模板页面"
      updatedAt="2026-03-27"
      sections={[
        {
          title: 'Who We Are',
          paragraphs: [
            'Resovo 是一个面向影视内容发现与观看体验优化的产品项目，强调结构清晰与操作高效。',
            '我们持续改进前端交互、内容治理与可维护性，以提供稳定一致的浏览与播放体验。',
          ],
        },
        {
          title: 'What We Build',
          paragraphs: [
            '我们聚焦于内容检索、分类浏览、详情展示与播放链路的体验整合。',
            '在后台侧，我们提供审核、治理、源健康监控等能力，用于保障内容可用性与质量。',
          ],
        },
        {
          title: 'Contact',
          paragraphs: [
            '如需商务合作、版权沟通或问题反馈，请通过官方渠道与我们联系。',
            '我们会在工作日内尽快处理并回复相关请求。',
          ],
        },
      ]}
    />
  )
}
