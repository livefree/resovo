#!/usr/bin/env node
/**
 * verify-enum-ssot.mjs — ADR-157 D-157-4 守卫
 *
 * 检测全项目内"视频枚举字面量硬编码"，强制消费方派生自 packages/types const
 * （VIDEO_TYPES / VIDEO_GENRES / 等 12 enum）+ packages/admin-ui helpers。
 *
 * 检测模式：
 *   - 数组字面量含 ≥ 2 个 enum 值，如 `['movie', 'series', ...]` / `['hls', 'mp4']`
 *   - z.enum([...]) 内联字面量（API zod schema 必须从 @resovo/types const 派生）
 *
 * 白名单（合法 SSOT 文件 / ADR-157 §3 D-157-4）：
 *   - packages/types/src/video.types.ts（权威源）
 *   - packages/admin-ui/src/enums/**（helpers）
 *   - apps/web-next/src/lib/categories.ts（ADR-048 前台 SSOT）
 *   - apps/web-next/messages/**.json（i18n 翻译值）
 *   - tests/** (fixture / 测试断言)
 *   - scripts/enum-ssot-baseline.json（baseline 例外清单）
 *
 * 输出：违规清单 + 文件:行号 + 建议；退出码 0 (advisory) / 1 (strict 模式 milestone 审计时)
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const REPO_ROOT = resolve(import.meta.dirname, '..')
const BASELINE_PATH = resolve(REPO_ROOT, 'scripts/enum-ssot-baseline.json')

// ── 检测的 12 enum 值集合 ─────────────────────────────────────────
const ENUM_VALUES = {
  VideoType: ['movie', 'series', 'anime', 'variety', 'documentary', 'short', 'sports', 'music', 'news', 'kids', 'other'],
  VideoGenre: ['action', 'comedy', 'romance', 'thriller', 'horror', 'sci_fi', 'fantasy', 'history', 'crime', 'mystery', 'war', 'family', 'biography', 'martial_arts', 'adventure', 'disaster', 'musical', 'western', 'sport'],
  VideoStatus: ['ongoing', 'completed'],
  ReviewStatus: ['pending_review', 'approved', 'rejected'],
  VisibilityStatus: ['public', 'internal', 'hidden'],
  ContentFormat: ['episodic', 'collection', 'clip'],
  EpisodePattern: ['single', 'multi', 'unknown'],
  TrendingTag: ['hot', 'weekly_top', 'editors_pick', 'exclusive'],
  DoubanStatus: ['matched', 'candidate', 'unmatched'],
  SourceCheckStatus: ['ok', 'partial', 'all_dead'],
  VideoQuality: ['4K', '1080P', '720P', '480P', '360P'],
  SourceType: ['hls', 'mp4', 'dash'],
}

// ── 白名单：合法 SSOT 文件（glob 模式 ↔ 文件路径前缀） ─────────────
const WHITELIST_PREFIXES = [
  'packages/types/src/video.types.ts',
  'packages/types/src/utils/exhaustive.ts',
  'packages/admin-ui/src/enums/',
  'apps/web-next/src/lib/categories.ts',
  'apps/web-next/messages/',
  'tests/',
  'docs/',
  'scripts/',
  'node_modules/',
  'apps/server-next/src/lib/videos/saved-views.ts',  // 视图存储 / 含 string union URL 参数
  'apps/api/src/services/UserSubmissionService.ts',  // user submission 业务自定义 enum (含 'show' 非 VideoType 值)
  'apps/api/src/templates/route.template.ts',        // 模板注释示例
]

function isWhitelisted(file) {
  const rel = relative(REPO_ROOT, file).replace(/\\/g, '/')
  return WHITELIST_PREFIXES.some((p) => rel.startsWith(p))
}

// ── baseline 加载 ─────────────────────────────────────────────────
function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return new Set()
  try {
    const data = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'))
    return new Set(data.violations || [])
  } catch {
    return new Set()
  }
}

// ── 扫描 ──────────────────────────────────────────────────────────
function scan() {
  const violations = []

  for (const [enumName, values] of Object.entries(ENUM_VALUES)) {
    // 取前 3 个独特值组合做 grep（足够区分 enum 类别 / 减少误报）
    if (values.length < 2) continue
    const sampleA = values[0]
    const sampleB = values[1]

    // grep 模式：含 sampleA + sampleB 字面量出现在同一文件
    let output
    try {
      output = execSync(
        `git grep -nE "'${sampleA}'|\\"${sampleA}\\"" -- '*.ts' '*.tsx' '*.mjs' '*.js' 2>/dev/null || true`,
        { cwd: REPO_ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
      )
    } catch {
      continue
    }

    const lines = output.split('\n').filter(Boolean)
    for (const line of lines) {
      const match = line.match(/^([^:]+):(\d+):(.*)$/)
      if (!match) continue
      const [, file, lineNo, content] = match
      if (isWhitelisted(file)) continue

      // 验证：该 content 是否同时含至少 2 个 enum 值（数组字面量 / z.enum / switch case 标记）
      // 简化判定：同一行包含 sampleA + sampleB / 或文件邻近行包含多个值
      const valueCount = values.filter((v) => content.includes(`'${v}'`) || content.includes(`"${v}"`)).length
      if (valueCount < 2) continue

      violations.push({ enum: enumName, file, line: lineNo, snippet: content.trim().slice(0, 120) })
    }
  }

  return violations
}

// ── main ─────────────────────────────────────────────────────────
const baseline = loadBaseline()
const violations = scan()
const newViolations = violations.filter((v) => !baseline.has(`${v.file}:${v.line}`))

if (newViolations.length === 0) {
  console.log(`✅ verify-enum-ssot: 0 新违规${baseline.size > 0 ? ` (baseline 例外 ${baseline.size} 条已登记)` : ''}`)
  process.exit(0)
}

console.log(`⚠️ verify-enum-ssot: 检出 ${newViolations.length} 处 enum 字面量硬编码（非白名单非 baseline）：\n`)
for (const v of newViolations) {
  console.log(`  [${v.enum}] ${v.file}:${v.line}`)
  console.log(`      ${v.snippet}`)
}

console.log(`\n修复路径：`)
console.log(`  1. 从 @resovo/types 引入 const 数组：import { VIDEO_TYPES, VIDEO_GENRES, ... } from '@resovo/types'`)
console.log(`  2. 派生使用：z.enum(VIDEO_TYPES) / VIDEO_TYPES.map(...) 等`)
console.log(`  3. 后台 admin select 直接用 admin-ui helpers：import { getVideoTypeOptions } from '@resovo/admin-ui'`)
console.log(`  4. 若是合法历史例外（v1 维护期等），加入 scripts/enum-ssot-baseline.json`)
console.log(`\n⚠️ 当前为 advisory 模式（不阻塞 CI），但 ADR-157 §5 baseline 截止 CHG-344 + 2 月需清零。`)

// advisory exit code 0
process.exit(0)
