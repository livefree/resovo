/**
 * auth.ts — 认证路由
 * POST /auth/register   注册
 * POST /auth/login      登录
 * POST /auth/refresh    刷新 Access Token
 * POST /auth/logout     登出
 *
 * ADR-003: refresh_token 通过 HttpOnly Cookie 传递，不出现在响应 body
 */

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

import { db } from '@/api/lib/postgres'
import { redis } from '@/api/lib/redis'
import { UserService, ConflictError, UnauthorizedError } from '@/api/services/UserService'

// Cookie 名称（统一管理）
const REFRESH_COOKIE = 'refresh_token'

// Cookie 选项（ADR-003）
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60, // 7 天，单位秒
  path: '/',
}

// ── Zod Schema ───────────────────────────────────────────────────

const RegisterSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(8),
  locale: z.string().optional(),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// ── 路由注册 ─────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance) {
  const userService = new UserService(db, redis)

  // ── POST /auth/register ──────────────────────────────────────
  fastify.post('/auth/register', async (request, reply) => {
    const parsed = RegisterSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }

    try {
      const { user, accessToken, refreshToken } = await userService.register(parsed.data)
      reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)
      return reply.code(201).send({ data: { user, accessToken } })
    } catch (error) {
      if (error instanceof ConflictError) {
        return reply.code(422).send({
          error: { code: 'CONFLICT', message: error.message, status: 422 },
        })
      }
      request.log.error({ error }, 'register failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '注册失败，请稍后重试', status: 500 },
      })
    }
  })

  // ── POST /auth/login ─────────────────────────────────────────
  fastify.post('/auth/login', async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.errors[0]?.message ?? '参数错误',
          status: 422,
        },
      })
    }

    try {
      const { user, accessToken, refreshToken } = await userService.login(
        parsed.data.email,
        parsed.data.password
      )
      reply.setCookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS)
      return reply.send({ data: { user, accessToken } })
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: error.message, status: 401 },
        })
      }
      request.log.error({ error }, 'login failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '登录失败，请稍后重试', status: 500 },
      })
    }
  })

  // ── POST /auth/refresh ───────────────────────────────────────
  fastify.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE]
    if (!refreshToken) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: '未找到 refresh token', status: 401 },
      })
    }

    try {
      const { accessToken } = await userService.refresh(refreshToken)
      return reply.send({ data: { accessToken } })
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: error.message, status: 401 },
        })
      }
      request.log.error({ error }, 'refresh failed')
      return reply.code(500).send({
        error: { code: 'INTERNAL_ERROR', message: '刷新失败，请稍后重试', status: 500 },
      })
    }
  })

  // ── POST /auth/logout ────────────────────────────────────────
  fastify.post('/auth/logout', async (request, reply) => {
    const refreshToken = request.cookies[REFRESH_COOKIE]

    if (refreshToken) {
      try {
        await userService.logout(refreshToken)
      } catch (error) {
        request.log.error({ error }, 'logout blacklist failed')
      }
    }

    // 无论如何都清除 Cookie
    reply.clearCookie(REFRESH_COOKIE, { path: '/' })
    return reply.code(204).send()
  })
}
