import type { Metadata } from 'next'
import { FooterInfoPage } from '@/components/layout/FooterInfoPage'

export const metadata: Metadata = {
  title: 'DMCA - Resovo',
}

export default function DmcaPage() {
  return (
    <FooterInfoPage
      title="DMCA Notice"
      subtitle="版权投诉与处理模板页面"
      updatedAt="2026-03-27"
      sections={[
        {
          title: 'Copyright Statement',
          paragraphs: [
            'Resovo 仅提供对公开可访问资源的索引，不直接托管视频文件。',
            '如你认为某内容侵犯版权，请按下方流程提交通知，我们会在核验后及时处理。',
          ],
        },
        {
          title: 'How to Submit a Takedown Request',
          paragraphs: [
            '请提供权利人身份信息、侵权内容的明确定位信息、权利证明以及联系方式。',
            '请确保你的通知真实、完整且可验证，以便我们高效完成处理流程。',
          ],
        },
        {
          title: 'Review Process',
          paragraphs: [
            '我们会在收到有效通知后尽快核查并采取必要措施，包括下架、屏蔽或进一步沟通确认。',
            '对重复侵权或恶意提交，我们保留依据规则限制访问与账号处置的权利。',
          ],
        },
      ]}
    />
  )
}
