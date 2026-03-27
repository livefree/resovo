import type { Metadata } from 'next'
import { FooterInfoPage } from '@/components/layout/FooterInfoPage'

export const metadata: Metadata = {
  title: 'Privacy Policy - Resovo',
}

export default function PrivacyPage() {
  return (
    <FooterInfoPage
      title="Privacy Policy"
      subtitle="隐私政策模板页面"
      updatedAt="2026-03-27"
      sections={[
        {
          title: 'Information We Collect',
          paragraphs: [
            '我们可能收集与服务运行直接相关的基础信息，例如账户标识、会话信息与必要的日志数据。',
            '我们不会主动收集与服务目的无关的敏感个人信息。',
          ],
        },
        {
          title: 'How We Use Information',
          paragraphs: [
            '收集的信息仅用于账号认证、服务稳定性保障、问题排查与体验优化。',
            '我们不会将你的个人数据出售给第三方。',
          ],
        },
        {
          title: 'Data Security & Retention',
          paragraphs: [
            '我们采取合理的技术与管理措施来保护数据安全，并按最小必要原则保留数据。',
            '当数据不再用于既定目的时，我们会根据合规与运维要求进行删除或匿名化处理。',
          ],
        },
      ]}
    />
  )
}
