/**
 * scripts/create-admin.ts — 创建初始管理员账号
 *
 * 用法：npm run create:admin
 * 仅供本地开发使用，不得暴露为 API 接口
 */

import readline from 'readline'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

// ── 工具函数 ──────────────────────────────────────────────────────

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve))
}

function promptPassword(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question)
    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    if (stdin.setRawMode) stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    let password = ''
    function onData(char: string) {
      if (char === '\n' || char === '\r' || char === '\u0003') {
        stdin.setRawMode?.(wasRaw ?? false)
        stdin.pause()
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(password)
      } else if (char === '\u007f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        password += char
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

// ── 主流程 ────────────────────────────────────────────────────────

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 未设置，请确认 .env.local 已正确配置')
    process.exit(1)
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log('\n=== Resovo 管理员账号创建工具 ===\n')

  let username: string
  let email: string
  let password: string

  try {
    username = (await prompt(rl, '用户名（3-20 位字母数字下划线）：')).trim()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      console.error('❌ 用户名格式不正确（3-20 位字母数字下划线）')
      rl.close()
      process.exit(1)
    }

    email = (await prompt(rl, '邮箱：')).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error('❌ 邮箱格式不正确')
      rl.close()
      process.exit(1)
    }

    rl.close()

    password = await promptPassword('密码（至少 8 位）：')
    if (password.length < 8) {
      console.error('❌ 密码至少需要 8 位')
      process.exit(1)
    }
  } catch (err) {
    rl.close()
    throw err
  }

  const db = new Pool({ connectionString: databaseUrl })

  try {
    // 检查邮箱是否已存在
    const existing = await db.query(
      `SELECT id, role FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    )

    if (existing.rows.length > 0) {
      const row = existing.rows[0] as { id: string; role: string }
      if (row.role === 'admin') {
        console.log(`\n⚠️  该邮箱已存在且已是 admin 账号（id: ${row.id}），无需重复创建。`)
      } else {
        console.log(`\n⚠️  该邮箱已存在（id: ${row.id}，role: ${row.role}），未做修改。`)
        console.log('    如需升级为 admin，请在数据库中手动执行：')
        console.log(`    UPDATE users SET role = 'admin' WHERE id = '${row.id}';`)
      }
      process.exit(0)
    }

    // 检查用户名是否已存在
    const existingUsername = await db.query(
      `SELECT id FROM users WHERE username = $1 AND deleted_at IS NULL`,
      [username]
    )
    if (existingUsername.rows.length > 0) {
      console.error(`\n❌ 用户名 "${username}" 已被使用，请选择其他用户名`)
      process.exit(1)
    }

    // bcrypt 哈希密码（cost=10 用于生产环境）
    const passwordHash = await bcrypt.hash(password, 10)

    // 创建 admin 账号
    const result = await db.query(
      `INSERT INTO users (username, email, password_hash, role, locale)
       VALUES ($1, $2, $3, 'admin', 'en')
       RETURNING id, username, email, role, created_at`,
      [username, email, passwordHash]
    )

    const user = result.rows[0] as {
      id: string
      username: string
      email: string
      role: string
      created_at: string
    }

    console.log('\n✅ 管理员账号创建成功！')
    console.log(`   ID       : ${user.id}`)
    console.log(`   用户名   : ${user.username}`)
    console.log(`   邮箱     : ${user.email}`)
    console.log(`   角色     : ${user.role}`)
    console.log(`   创建时间 : ${user.created_at}`)
    console.log('\n现在可以访问 http://localhost:3000/admin 并使用此账号登录。\n')
  } finally {
    await db.end()
  }
}

main().catch((err: unknown) => {
  console.error('❌ 创建失败：', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
