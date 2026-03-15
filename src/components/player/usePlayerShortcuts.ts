/**
 * usePlayerShortcuts.ts — 播放器键盘状态机
 * ADR-011: 优先级从高到低：选集浮层 > 倍速面板 > 输入框聚焦 > 正常播放
 *
 * 快捷键映射（正常模式）：
 *   Space         播放/暂停
 *   ← →           快进/后退 5 秒
 *   ↑ ↓           音量 +/- 5%（episodeOverlay 关闭时）
 *   M             静音切换
 *   C             字幕面板切换
 *   S             倍速面板切换
 *   Shift+N       下一集
 *   T             剧场模式（桌面端）
 *   F             全屏
 *   Esc           关闭所有面板
 */

import { useEffect } from 'react'
import { usePlayerStore } from '@/stores/playerStore'
import type Player from 'video.js/dist/types/player'

interface UsePlayerShortcutsOptions {
  player: Player | null
  episodeCount?: number
  onNextEpisode?: () => void
}

export function usePlayerShortcuts({
  player,
  episodeCount = 1,
  onNextEpisode,
}: UsePlayerShortcutsOptions) {
  const store = usePlayerStore

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement

      // 1. 输入框聚焦时不触发任何快捷键
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const {
        isEpisodePanelOpen,
        isSpeedPanelOpen,
        volume,
        isMuted,
        currentTime,
        duration,
        mode,
        setVolume,
        setMuted,
        setPlaybackSpeed,
        openPanel,
        closePanel,
        closeAllPanels,
        toggleMode,
      } = store.getState()

      // 2. 选集浮层打开：方向键矩阵导航（其他键不响应）
      if (isEpisodePanelOpen) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Escape'].includes(e.key)) {
          // 方向键导航由 EpisodeOverlay 组件自身处理
          // 此处仅拦截 Esc 来关闭
          if (e.key === 'Escape') {
            e.preventDefault()
            closePanel('episode')
          }
        }
        return
      }

      // 3. 倍速面板打开：←→ 调滑条，1-4 选预设（由 SpeedPanel 自身处理）
      if (isSpeedPanelOpen) {
        // SpeedPanel 通过捕获阶段的 event listener 处理，此处不重复处理
        return
      }

      // 4. 正常播放模式
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          if (player) {
            if (player.paused()) {
              void player.play()
            } else {
              player.pause()
            }
          }
          break

        case 'ArrowLeft':
          e.preventDefault()
          if (player) {
            const t = Math.max(0, (player.currentTime() ?? 0) - 5)
            player.currentTime(t)
          }
          break

        case 'ArrowRight':
          e.preventDefault()
          if (player) {
            const t = Math.min(duration, (player.currentTime() ?? 0) + 5)
            player.currentTime(t)
          }
          break

        case 'ArrowUp':
          e.preventDefault()
          if (!isEpisodePanelOpen) {
            const newVol = Math.min(1, volume + 0.05)
            setVolume(newVol)
            player?.volume(newVol)
          }
          break

        case 'ArrowDown':
          e.preventDefault()
          if (!isEpisodePanelOpen) {
            const newVol = Math.max(0, volume - 0.05)
            setVolume(newVol)
            player?.volume(newVol)
          }
          break

        case 'm':
        case 'M':
          e.preventDefault()
          setMuted(!isMuted)
          player?.muted(!isMuted)
          break

        case 'c':
        case 'C':
          e.preventDefault()
          openPanel('cc')
          break

        case 's':
        case 'S':
          e.preventDefault()
          openPanel('speed')
          break

        case 'N':
          // Shift+N → 下一集
          if (e.shiftKey && episodeCount > 1 && onNextEpisode) {
            e.preventDefault()
            onNextEpisode()
          }
          break

        case 't':
        case 'T':
          // 剧场模式（仅桌面端，通过检查屏幕宽度）
          if (window.innerWidth >= 1024) {
            e.preventDefault()
            toggleMode()
          }
          break

        case 'f':
        case 'F':
          e.preventDefault()
          if (player) {
            if (player.isFullscreen()) {
              void player.exitFullscreen()
            } else {
              void player.requestFullscreen()
            }
          }
          break

        case 'Escape':
          e.preventDefault()
          closeAllPanels()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, episodeCount, onNextEpisode])
}
