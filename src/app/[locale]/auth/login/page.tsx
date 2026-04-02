/**
 * /[locale]/auth/login — 已下线
 * DEC-05: 前台登录入口下线，返回 404
 */

import { notFound } from 'next/navigation'

export default function LoginPage() {
  notFound()
}
