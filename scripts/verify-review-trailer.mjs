#!/usr/bin/env node
/**
 * verify-review-trailer.mjs — 高危产物 commit 强制评审 trailer 核验
 * （审查规范改进 P0 / 对应「评估·短板 #1：绝对禁止 / 必须 与实际牙齿不对称」）
 *
 * 背景：
 *   CLAUDE.md §绝对禁止 + git-rules.md §Commit trailers + workflow-rules.md
 *   §"共享组件 API 改动 → Opus trailer 核验" 已规定：改 ADR 或共享组件公开
 *   Props 契约的 commit 必须带 `Subagents: arch-reviewer (...)`（或 M-SN 期
 *   `Review: <hash> PASS`）trailer。但此前无脚本背书，纯靠会话自觉——正是
 *   06→11-PATCH「ADR 明示却静默跳过」5 次同型号偏离的同类风险。本守卫为该
 *   既有规则补齐 enforcement，不创造新规则。
 *
 * 触发（高精度，低误报）：commit diff 命中任一即「需评审」：
 *   - docs/decisions.md 变更（ADR 新增 / 修订）
 *   - packages/admin-ui/src/**\/types.ts 变更（共享组件公开 Props 契约真源）
 *   - packages/admin-ui/src/**\/*.tsx 内 `interface/type *Props` 块的字段增删改（含声明变更 / 整文件增删）
 *
 * 判据：上述 commit 的 message 必须含以下任一 trailer：
 *   - `Subagents:` 值含 `arch-reviewer` 且为 Opus（`arch-reviewer (claude-opus-...)`；CLAUDE.md §绝对禁止 + workflow-rules §共享组件 API 强制 Opus）
 *   - `Review:` 值为实际 `PASS`（arch-reviewer/Opus 的 PASS 记录；非 PASS / FAIL / BLOCK / pending / n-a 一律不计）
 *
 * 用法：
 *   node scripts/verify-review-trailer.mjs                      # 核验 HEAD 单个 commit
 *   node scripts/verify-review-trailer.mjs --base origin/main   # 核验 origin/main..HEAD 全部 commit（CI / pre-push 推荐）
 *   node scripts/verify-review-trailer.mjs --range A..B         # 核验任意区间
 *   node scripts/verify-review-trailer.mjs --strict             # 命中即退出码 1（观察期清零后升 FAIL fast）
 *
 * 退出码：0 = 通过 / advisory 警告；1 = --strict 下命中违规；2 = 脚本执行错误。
 */
import { execFileSync } from 'node:child_process'

function git(args) {
  return execFileSync('git', args, { encoding: 'utf-8' }).trim()
}

function parseArgs(argv) {
  const opts = { strict: false, range: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--strict') opts.strict = true
    else if (a === '--base') opts.range = `${argv[++i]}..HEAD`
    else if (a === '--range') opts.range = argv[++i]
  }
  return opts
}

function commitsInScope(range) {
  // 跳过 merge commit（多父，diff 语义不适用）
  const out = range
    ? git(['log', '--no-merges', '--format=%H', range])
    : git(['log', '--no-merges', '-1', '--format=%H', 'HEAD'])
  return out ? out.split('\n').filter(Boolean) : []
}

function changedFiles(sha) {
  const out = git(['diff-tree', '--no-commit-id', '--name-only', '-r', sha])
  return out ? out.split('\n').filter(Boolean) : []
}

const ADMIN_UI_TYPES = /^packages\/admin-ui\/src\/.*types\.ts$/
const ADMIN_UI_TSX = /^packages\/admin-ui\/src\/.*\.tsx$/
const PROPS_DECL_LINE = /\b(?:export\s+)?(?:interface|type)\s+\w*Props\b/

/** 求源文件中所有 `*Props` interface/type 块的 [起, 止] 行号区间（1-based，含边界；
 *  容忍声明跨行：泛型约束 / extends / 联合类型换行至 `{` 前；`;` 收尾且无 `{` 视为非块型 type 别名） */
function propsBlockLineRanges(content) {
  const lines = content.split('\n')
  const ranges = []
  for (let i = 0; i < lines.length; i++) {
    if (!PROPS_DECL_LINE.test(lines[i])) continue
    // 从声明行向后找块起始 `{`（最多前瞻 12 行）；若在 `{` 前以 `;` 收尾 → 非块型（type 别名）
    let openLine = -1
    let endLine = -1
    for (let k = i; k < lines.length && k <= i + 12; k++) {
      if (lines[k].includes('{')) { openLine = k; break }
      if (/;\s*$/.test(lines[k])) { endLine = k; break }
    }
    if (openLine === -1) {
      // 非块型：声明行（含跨行至 `;`）整体作为区间，捕获其增删改
      ranges.push([i + 1, (endLine === -1 ? i : endLine) + 1])
      continue
    }
    // 从块起始 `{` 起花括号配平；区间起点回到声明行 i，覆盖多行声明头
    let depth = 0
    let j = openLine
    for (; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      if (depth <= 0) break
    }
    ranges.push([i + 1, Math.min(j, lines.length - 1) + 1])
    i = j
  }
  return ranges
}

/** 解析 unified diff hunk 头取改动行区间；side '+' 取新文件侧、'-' 取旧文件侧 */
function changedLineRanges(patch, side) {
  const ranges = []
  for (const m of patch.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = side === '+' ? parseInt(m[3], 10) : parseInt(m[1], 10)
    const rawCount = side === '+' ? m[4] : m[2]
    const count = rawCount === undefined ? 1 : parseInt(rawCount, 10)
    if (count > 0) ranges.push([start, start + count - 1])
  }
  return ranges
}

function overlaps(ranges, blocks) {
  return ranges.some(([s, e]) => blocks.some(([bs, be]) => s <= be && e >= bs))
}

/** .tsx 本次改动是否触及任一 `*Props` 块（字段增删改 / 声明变更 / 整文件增删，双镜像核验） */
function tsxTouchesProps(sha, file) {
  const patch = git(['show', '--format=', '-U0', sha, '--', file])
  if (!patch) return false
  let newContent = ''
  try { newContent = git(['show', `${sha}:${file}`]) } catch { /* 文件本次被删除，无新镜像 */ }
  if (newContent && overlaps(changedLineRanges(patch, '+'), propsBlockLineRanges(newContent))) return true
  let oldContent = ''
  try { oldContent = git(['show', `${sha}^:${file}`]) } catch { /* 首个 commit / 新增文件，无旧镜像 */ }
  if (oldContent && overlaps(changedLineRanges(patch, '-'), propsBlockLineRanges(oldContent))) return true
  return false
}

function reviewReasons(sha, files) {
  const reasons = []
  if (files.includes('docs/decisions.md')) reasons.push('ADR 变更 (docs/decisions.md)')
  const typesFiles = files.filter((f) => ADMIN_UI_TYPES.test(f))
  if (typesFiles.length > 0) reasons.push(`共享组件 Props 契约 (${typesFiles.join(', ')})`)
  for (const f of files.filter((f) => ADMIN_UI_TSX.test(f))) {
    if (tsxTouchesProps(sha, f)) reasons.push(`共享组件 Props 字段/声明变更 (${f})`)
  }
  return reasons
}

/** trailer 判据：Subagents 含 arch-reviewer 且为 Opus（CLAUDE.md §绝对禁止 + workflow-rules §共享组件 API：
 *  必须 `arch-reviewer (claude-opus-...)`，非 Opus 的 arch-reviewer 不计），或 Review 为实际 PASS
 *  （arch-reviewer/Opus 的 PASS 记录；非 PASS / FAIL / BLOCK / pending / n-a 一律不计）。 */
function trailerSatisfies(body) {
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.+)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'subagents') {
      // 精确取 arch-reviewer 自身括号内的模型再判 Opus，避免与同行其它子代理的模型串扰
      // （如 `arch-reviewer (claude-sonnet-4-6), doc-janitor (claude-opus-4-8)` 不应放行）
      const ar = val.match(/arch-reviewer\s*\(([^)]*)\)/i)
      if (ar && /claude-opus/i.test(ar[1])) return true
    }
    // Review 须为 `<hash> PASS`（git-rules）：大写 PASS verdict + hash 形 token 同存；
    // 小写散文「did not pass」/ 裸 `PASS`（无 hash）/ `pending` / `n/a` 一律不计
    if (key === 'review' && /\bPASS\b/.test(val) && /\b[0-9a-f]{7,40}\b/i.test(val)) return true
  }
  return false
}

function hasReviewTrailer(sha) {
  return trailerSatisfies(git(['log', '-1', '--format=%B', sha]))
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  let commits
  try {
    commits = commitsInScope(opts.range)
  } catch (err) {
    // 浅克隆 / range ref 不存在：跳过而非误判（CI 兼容）
    console.warn('verify-review-trailer: 无法解析 commit 区间（浅克隆或 ref 不存在），跳过。', err.message)
    process.exit(0)
  }

  const violations = []
  for (const sha of commits) {
    const reasons = reviewReasons(sha, changedFiles(sha))
    if (reasons.length === 0) continue
    if (!hasReviewTrailer(sha)) {
      violations.push({ subject: git(['log', '-1', '--format=%h %s', sha]), reasons })
    }
  }

  if (violations.length > 0) {
    const mark = opts.strict ? '❌' : '⚠️'
    console.error(`\n${mark} verify-review-trailer: ${violations.length} 个 commit 触及高危产物但缺 Opus / Review 评审 trailer：\n`)
    for (const v of violations) {
      console.error(`  ${v.subject}`)
      for (const r of v.reasons) console.error(`      ↳ ${r}`)
    }
    console.error('\n判据：上述 commit 须含 `Subagents: arch-reviewer (claude-opus-...)` 或 `Review: <hash> PASS` trailer。')
    console.error('依据：CLAUDE.md §绝对禁止 + §模型路由「强制升 Opus」+ workflow-rules §共享组件 API 改动 Opus trailer 核验。')
    console.error('补救：① 事后 spawn arch-reviewer (Opus) 审 4 维度 → ② git commit --amend 补 trailer（参 workflow-rules §事后追溯路径）。')
    if (opts.strict) process.exit(1)
    console.error('\n⚠️ 当前为 advisory 观察期（不阻塞）；存量清零后以 --strict 升 FAIL fast（参 style-shorthand-conflict CHG-SN-6-06 渐进范式）。')
    process.exit(0)
  }

  console.log(`✅ verify-review-trailer: 受检 ${commits.length} 个 commit，高危产物变更均带评审 trailer（或无高危变更）。`)
  process.exit(0)
}

try {
  main()
} catch (err) {
  console.error('verify-review-trailer 脚本执行错误：', err)
  process.exit(2)
}
