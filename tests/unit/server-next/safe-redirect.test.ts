import { describe, it, expect } from 'vitest'
import { sanitizeAdminRedirect } from '../../../apps/server-next/src/lib/safe-redirect.ts'

describe('sanitizeAdminRedirect — admin redirect 净化', () => {
  describe('合法白名单输入（保留原值）', () => {
    it('/admin 通过', () => {
      expect(sanitizeAdminRedirect('/admin')).toBe('/admin')
    })

    it('/admin/videos 通过', () => {
      expect(sanitizeAdminRedirect('/admin/videos')).toBe('/admin/videos')
    })

    it('/admin/videos?page=2&q=test 保留 query', () => {
      expect(sanitizeAdminRedirect('/admin/videos?page=2&q=test')).toBe(
        '/admin/videos?page=2&q=test',
      )
    })

    it('/admin?refresh=1 query 形式通过', () => {
      expect(sanitizeAdminRedirect('/admin?refresh=1')).toBe('/admin?refresh=1')
    })

    it('/admin/system/settings 多级路径通过', () => {
      expect(sanitizeAdminRedirect('/admin/system/settings')).toBe('/admin/system/settings')
    })
  })

  describe('open-redirect 攻击向量（fallback /admin）', () => {
    it('null / undefined / 空串 fallback', () => {
      expect(sanitizeAdminRedirect(null)).toBe('/admin')
      expect(sanitizeAdminRedirect(undefined)).toBe('/admin')
      expect(sanitizeAdminRedirect('')).toBe('/admin')
    })

    it('外部协议 URL 拒绝', () => {
      expect(sanitizeAdminRedirect('https://evil.com')).toBe('/admin')
      expect(sanitizeAdminRedirect('http://evil.com/admin')).toBe('/admin')
      expect(sanitizeAdminRedirect('javascript:alert(1)')).toBe('/admin')
      expect(sanitizeAdminRedirect('data:text/html,<script>alert(1)</script>')).toBe('/admin')
    })

    it('protocol-relative `//host` 拒绝', () => {
      expect(sanitizeAdminRedirect('//evil.com')).toBe('/admin')
      expect(sanitizeAdminRedirect('//evil.com/admin')).toBe('/admin')
    })

    it('反斜杠 `\\\\host` 拒绝（防 IE/Edge 历史协议-相对解析）', () => {
      expect(sanitizeAdminRedirect('/\\evil.com')).toBe('/admin')
      expect(sanitizeAdminRedirect('\\\\evil.com')).toBe('/admin')
    })

    it('非 /admin 前缀拒绝', () => {
      expect(sanitizeAdminRedirect('/login')).toBe('/admin')
      expect(sanitizeAdminRedirect('/403')).toBe('/admin')
      expect(sanitizeAdminRedirect('/some-public-page')).toBe('/admin')
    })

    it('不以 / 开头的相对路径拒绝', () => {
      expect(sanitizeAdminRedirect('admin')).toBe('/admin')
      expect(sanitizeAdminRedirect('admin/videos')).toBe('/admin')
      expect(sanitizeAdminRedirect('../admin')).toBe('/admin')
    })

    it('admin 前缀但被欺骗（如 /administrative-evil）拒绝', () => {
      expect(sanitizeAdminRedirect('/administrative-evil')).toBe('/admin')
      expect(sanitizeAdminRedirect('/admin-evil')).toBe('/admin')
    })

    it('控制字符注入拒绝', () => {
      expect(sanitizeAdminRedirect('/admin\nSet-Cookie: x=y')).toBe('/admin')
      expect(sanitizeAdminRedirect('/admin\rfoo')).toBe('/admin')
      expect(sanitizeAdminRedirect('/admin\x00null')).toBe('/admin')
    })
  })
})
