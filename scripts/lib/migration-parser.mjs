#!/usr/bin/env node
/**
 * migration-parser.mjs — 解析 apps/api/src/db/migrations/*.sql 算出每表当前 schema
 * （CHG-SN-6-CHECKLIST-AUDIT-3 / RETRO 1/7）
 *
 * 仅识别顶层语句模式（不做完整 SQL parser）：
 *   - CREATE TABLE [IF NOT EXISTS] <table> ( <col> <type>, ... )
 *   - ALTER TABLE <table> ADD COLUMN [IF NOT EXISTS] <col> <type>
 *   - ALTER TABLE <table> DROP COLUMN [IF EXISTS] <col>
 *
 * 不识别（advisory pass）：
 *   - 复杂的多 ALTER 子句（按出现顺序逐个识别）
 *   - 视图 / 索引 / 触发器
 *   - 注释内的字面量（粗略剥离 -- 单行注释）
 */

import { readFileSync, readdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const MIGRATIONS_DIR = join(ROOT, 'apps/api/src/db/migrations')

/** 去除单行 SQL 注释 */
function stripComments(sql) {
  return sql.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n')
}

/**
 * 解析单个 migration SQL，返回 mutations 顺序列表：
 *   { kind: 'create', table, columns: Set<string> }
 *   { kind: 'add', table, column }
 *   { kind: 'drop', table, column }
 *   { kind: 'rename', table, oldColumn, newColumn }  // 简化暂不识别
 */
function parseMigration(sql) {
  const clean = stripComments(sql)
  const mutations = []

  // CREATE TABLE [IF NOT EXISTS] <table> ( ... )
  const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+(\w+)\s*\(([^;]+?)\)\s*;/gis
  for (const m of clean.matchAll(createRe)) {
    const table = m[1]
    const body = m[2]
    const columns = new Set()
    // 提取每个列定义的列名（首词），跳过 PRIMARY KEY / CONSTRAINT / CHECK 顶层
    for (const line of body.split(',')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // 跳过约束行
      if (/^(PRIMARY\s+KEY|CONSTRAINT|CHECK|UNIQUE|FOREIGN\s+KEY|EXCLUDE)\b/i.test(trimmed)) continue
      // 列名 = 首个标识符（支持双引号）
      const colMatch = trimmed.match(/^"?([a-z_][a-z_0-9]*)"?\s+/i)
      if (colMatch) columns.add(colMatch[1])
    }
    mutations.push({ kind: 'create', table, columns })
  }

  // ALTER TABLE <table> ADD COLUMN [IF NOT EXISTS] <col>
  const addRe = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"?(\w+)"?/gi
  for (const m of clean.matchAll(addRe)) {
    mutations.push({ kind: 'add', table: m[1], column: m[2] })
  }

  // ALTER TABLE <table> RENAME COLUMN <old> TO <new>
  const renameRe = /ALTER\s+TABLE\s+(\w+)\s+RENAME\s+COLUMN\s+"?(\w+)"?\s+TO\s+"?(\w+)"?/gi
  for (const m of clean.matchAll(renameRe)) {
    mutations.push({ kind: 'rename', table: m[1], oldColumn: m[2], newColumn: m[3] })
  }

  // ALTER TABLE <table> ... DROP COLUMN [IF EXISTS] <col>（多 DROP 子句支持）
  // 简化：先匹配 ALTER TABLE <table> 块，再在块内 grep DROP COLUMN
  const blockRe = /ALTER\s+TABLE\s+(\w+)([\s\S]+?);/gi
  for (const m of clean.matchAll(blockRe)) {
    const table = m[1]
    const block = m[2]
    const dropRe = /DROP\s+COLUMN(?:\s+IF\s+EXISTS)?\s+"?(\w+)"?/gi
    for (const dm of block.matchAll(dropRe)) {
      mutations.push({ kind: 'drop', table, column: dm[1] })
    }
    // 同块内补 ADD COLUMN（如多列 ADD）
    const addInBlockRe = /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+"?(\w+)"?/gi
    for (const am of block.matchAll(addInBlockRe)) {
      // 已被外层 addRe 抓取的不重复（addRe 仅匹配 ALTER TABLE ... ADD COLUMN 直接结构）
      if (!mutations.some((mt) => mt.kind === 'add' && mt.table === table && mt.column === am[1])) {
        mutations.push({ kind: 'add', table, column: am[1] })
      }
    }
  }

  return mutations
}

/**
 * 应用 migration 全集，返回 Map<table, Set<column>>
 */
export function buildSchemaSnapshot() {
  const entries = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()  // 文件名字典序

  const schema = new Map()
  for (const file of entries) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8')
    const mutations = parseMigration(sql)
    for (const m of mutations) {
      if (m.kind === 'create') {
        if (!schema.has(m.table)) schema.set(m.table, new Set())
        for (const c of m.columns) schema.get(m.table).add(c)
      } else if (m.kind === 'add') {
        if (!schema.has(m.table)) schema.set(m.table, new Set())
        schema.get(m.table).add(m.column)
      } else if (m.kind === 'drop') {
        schema.get(m.table)?.delete(m.column)
      } else if (m.kind === 'rename') {
        const tableSchema = schema.get(m.table)
        if (tableSchema && tableSchema.has(m.oldColumn)) {
          tableSchema.delete(m.oldColumn)
          tableSchema.add(m.newColumn)
        } else if (tableSchema) {
          // 旧列名不在 schema（被先 DROP 过 / 解析漏）→ 仅 ADD 新列
          tableSchema.add(m.newColumn)
        }
      }
    }
  }
  return schema
}
