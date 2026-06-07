'use client'

/**
 * use-home-draft.ts — 画布草稿生命周期 hook（CHG-HOME-DRAFT-PUBLISH-B / ADR-185 D-185-2.1）
 *
 * UI 形态裁定（D-185-6.1 实施级推演）：**编辑即自动保存草稿**——画布每次配置
 * 变更立即 PUT 整页草稿（与既有画布"每操作即持久化"交互粒度一致，无丢失编辑
 * 风险），「保存草稿」不设独立按钮；显式动作 = 「发布」「丢弃草稿」。
 *
 * 首次编辑惰性建稿：无草稿时从三真源装配整页 config（draft-assembly 分页聚合
 * 至 total——**含 banner-slot 冻结存量行**，publish 全量替换语义下缺装配即被删除；
 * 不完整/超上限显式失败，CHG-HOME-DRAFT-PUBLISH-B-FIX 防静默截断）。
 * mutate 串行化（链式 promise）防会话内 PUT 竞态。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getHomeDraft,
  saveHomeDraft,
  discardHomeDraft,
  publishHomeDraft,
} from './api'
import { assembleBaseConfig } from './draft-assembly'
import type { HomeConfigDraft, HomeDraftStaleness, HomePageConfig } from './types'

export interface UseHomeDraftResult {
  /** null = 无草稿（画布预览发布态）；非 null = 草稿态（preview draft=true） */
  readonly draft: HomeConfigDraft | null
  readonly staleness: HomeDraftStaleness | null
  /** 初始 GET 进行中 */
  readonly loading: boolean
  /** PUT/发布/丢弃进行中 */
  readonly busy: boolean
  /** 配置变异 → PUT 草稿（无草稿先装配整页底座，首次编辑惰性建稿） */
  readonly mutateConfig: (mutator: (config: HomePageConfig) => HomePageConfig) => Promise<void>
  readonly publish: (note?: string) => Promise<{ versionNo: number }>
  readonly discard: () => Promise<void>
  /** 重读草稿 + 双信号（发布/丢弃后内部已自动调用） */
  readonly reload: () => Promise<void>
}

export function useHomeDraft(): UseHomeDraftResult {
  const [draft, setDraft] = useState<HomeConfigDraft | null>(null)
  const [staleness, setStaleness] = useState<HomeDraftStaleness | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  // mutate 串行链（会话内 PUT 顺序保证）；draftRef 供链内闭包读最新草稿
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const draftRef = useRef<HomeConfigDraft | null>(null)
  draftRef.current = draft

  const reload = useCallback(async () => {
    const result = await getHomeDraft()
    setDraft(result.draft)
    setStaleness(result.staleness)
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await getHomeDraft()
        if (cancelled) return
        setDraft(result.draft)
        setStaleness(result.staleness)
      } catch {
        // 初始读失败 → 按无草稿降级（画布维持发布态预览可用；后续编辑会重试 PUT）
        if (!cancelled) {
          setDraft(null)
          setStaleness(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const mutateConfig = useCallback(
    (mutator: (config: HomePageConfig) => HomePageConfig) => {
      const run = async () => {
        setBusy(true)
        try {
          const base = draftRef.current?.config ?? (await assembleBaseConfig())
          const saved = await saveHomeDraft(mutator(base))
          setDraft(saved)
        } finally {
          setBusy(false)
        }
      }
      // 串行化：前序失败不阻断后续（catch 吞前序错误仅作链推进，错误已在前序调用方上抛）
      const next = chainRef.current.then(run, run)
      chainRef.current = next.catch(() => undefined)
      return next
    },
    [],
  )

  const publish = useCallback(async (note?: string) => {
    setBusy(true)
    try {
      const result = await publishHomeDraft(note)
      await reload() // 发布事务删草稿 → 回到发布态
      return result
    } finally {
      setBusy(false)
    }
  }, [reload])

  const discard = useCallback(async () => {
    setBusy(true)
    try {
      await discardHomeDraft()
      await reload()
    } finally {
      setBusy(false)
    }
  }, [reload])

  return { draft, staleness, loading, busy, mutateConfig, publish, discard, reload }
}
