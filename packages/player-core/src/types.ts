import type { CSSProperties } from "react";

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface SubtitleTrack {
  id: string;
  label: string;
  srclang: string;
  src: string;
  default?: boolean;
}

export interface QualityLevel {
  id: string;
  label: string; // e.g. "1080p", "720p", "Auto"
  src: string;
  isHls?: boolean;
}

export interface Chapter {
  title: string;
  startTime: number;
}

export interface PlayerProps {
  /** Direct video URL or HLS .m3u8 */
  src?: string;
  /** Optional list of quality levels shown in settings menu */
  qualities?: QualityLevel[];
  /** Active quality id */
  activeQualityId?: string;
  /** Called when user picks a quality */
  onQualityChange?: (id: string) => void;
  /** WebVTT subtitle tracks */
  subtitles?: SubtitleTrack[];
  /** Video poster image */
  poster?: string;
  /** Title shown in top chrome (layer 1) and immersive overlay */
  title?: string;
  /** Channel / author name */
  author?: string;
  /** Chapters for progress bar markers */
  chapters?: Chapter[];
  /** Called when playback starts (play event) */
  onPlay?: () => void;
  /** Called when playback pauses */
  onPause?: () => void;
  /** Called when playback ends */
  onEnded?: () => void;
  /** Called when user clicks Next or presses Shift+N. When omitted the Next button is hidden. */
  onNext?: () => void;
  /** Episode list; presence enables the Episodes button (desktop) and keyboard shortcut E */
  episodes?: Array<{ title?: string }>;
  /** 0-based index of the currently playing episode (default: 0) */
  activeEpisodeIndex?: number;
  /** Called when the user selects an episode from the panel */
  onEpisodeChange?: (index: number) => void;
  /** Called whenever theater mode is toggled, with the new state */
  onTheaterChange?: (isTheater: boolean) => void;
  /** Called when current time changes, throttled to ~250ms */
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  /** Resume from this timestamp (seconds) */
  startTime?: number;
  /** Autoplay on mount */
  autoplay?: boolean;
  /** Initial volume 0-1 */
  initialVolume?: number;
  /** Enable theater mode by default */
  defaultTheaterMode?: boolean;
  /**
   * Inline styles applied to the player root element.
   * Use to inject CSS custom property overrides for theming:
   * @example style={{ '--ytp-brand-color': '#1a73e8' }}
   */
  style?: CSSProperties & { [key: `--${string}`]: string };
  /** Keep controls always visible; disables auto-hide timer */
  keepControlsVisible?: boolean;
  /**
   * URL to a WebVTT file mapping time ranges to thumbnail images.
   * Supports sprite sheets ("sprite.jpg#xywh=x,y,w,h") and individual frames.
   * When provided, thumbnail previews appear above the time tooltip on hover/scrub.
   * Loading is async and network-safe — degrades gracefully if unavailable.
   */
  thumbnailTrack?: string;
  /**
   * 错误回调（CHG-SN-9-PLAYER-ERROR / ADR-166 扩 controls / arch-reviewer Opus 评审）。
   *
   * 触发位置：原生 video onError / useSourceLoader HLS fatal。
   * 触发后 player-core 内部 `setError(...)` 仍写本地 state 并默认渲染 error overlay；
   * 若设 `suppressDefaultErrorUI=true`，则默认 overlay 跳过，由消费方接管错误 UI。
   *
   * 消费方典型用途：
   *   - AdminPlayer：POST /v1/feedback/playback {success:false, errorCode} 上报失败
   *   - PlayerShell：标 dead-source + 自动切下一线路（注意 R-N-3 不能用 event.src 做匹配键）
   *   - ADR-166 / Wave 4 #4：通过 controls.retry() 在 onError 同 tick 内程序化触发当前 src 重载
   *
   * controls 参数（ADR-166 非破坏性扩展）：
   *   - 既有消费方解构 `(event) => {...}` 不感知第 2 参 / 完全向后兼容
   *   - controls 是 `Object.freeze` 冻结对象 / 字段不得 monkey-patch（Y-166-1）
   *   - 生命周期与本次 onError 调用同 tick；保留外部 ref 异步使用会触发守卫 no-op + dev warn（R-166-2）
   *   - retry() 失败仍会再次触发 onError（含新 controls 实例）；消费方需自行计数防死循环（Y-166-4）
   *   - 默认 overlay 的 Retry 按钮（PlayerOverlays.tsx）与 controls.retry 是同源底层 retrySourceLoad；
   *     suppressDefaultErrorUI=false 时两条路径共存 / 消费方调一次即可（Y-166-5）
   */
  onError?: (event: PlayerErrorEvent, controls: PlayerErrorControls) => void;
  /**
   * 抑制 player-core 默认错误 overlay（CHG-SN-9-PLAYER-ERROR / Opus R-N-2）。
   *
   * 默认 false（保持既有行为：内部渲染"加载失败，请重试" overlay + 阻断手势）。
   * 设 true 时 useOverlayManager 不入栈 error overlay；消费方必须自行渲染错误 UI
   * 否则用户感知"播放失败但无任何提示"。
   *
   * 仅在 `onError` 同时设置时有意义（无 onError 接管 = 用户看不到错误 = 体验破缺）。
   */
  suppressDefaultErrorUI?: boolean;
}

// ─── Error events (CHG-SN-9-PLAYER-ERROR / arch-reviewer Opus A- → A) ────────

/**
 * Player error code (union open-set；Opus R-N-1：仅含有真实触发点的成员；
 * 未来增量扩成员是非破坏性变更，消费方 exhaustive switch 会在 typecheck 提醒)。
 *
 * - `native_media_failed`：原生 `<video>` 元素 onError（无法加载 / 解码失败）
 * - `hls_fatal`：HLS fatal 错误（useSourceLoader 内 hls.js Events.ERROR + data.fatal=true）
 * - `unknown`：防御性兜底（Opus Y-N-3 / 正常路径不应触发；Sentry 上报后扩 code 枚举）
 *
 * 故意不含 `hls_manifest_failed` / `hls_fragment_failed` 等细分 — useSourceLoader
 * 现状只在 fatal 时透出，留死位会污染 union 演进（Opus R-N-1）。
 */
export type PlayerErrorCode = "native_media_failed" | "hls_fatal" | "unknown";

/**
 * 错误事件 payload（外部 onError 回调参数）。
 *
 * 与 PlayerProps 其他扁平回调（onTimeUpdate 等）签名不一致是有意的（Opus Y-N-2）：
 * 错误事件需要携带结构化元数据（code / fatal / src）以支撑消费方分流决策，
 * 而 onTimeUpdate ~4Hz 高频调用避免对象分配开销保留扁平签名。
 */
/**
 * 错误恢复命令面（CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL / ADR-166 / Wave 4 #4 / arch-reviewer Opus 评审）。
 *
 * 仅在 `onError` 回调第 2 参提供；生命周期与本次 onError 调用同 tick。
 * 对象被 `Object.freeze`；消费方不得修改其字段（Y-166-1）。
 *
 * 设计判据（vs 方案 B useImperativeHandle ref，详 ADR-166 §3 评估表）：
 *   - 与 player-core 既有 7 个声明式回调（onPlay/onPause/onTimeUpdate/onEnded/onTheaterChange/onNext/onError）范式同构
 *   - 不破坏 React 单向数据流 / 不引入命令式 ref 入口污染 mental model
 *   - time-to-impact：与 onError 触发同 tick 同步可调（断网恢复 first-class 需求）
 *   - 扩展性：随错误恢复语义增长（如未来 reloadFromKeyframe）/ 不与 pause/seek/setVolume 命令面混淆
 */
export interface PlayerErrorControls {
  /**
   * 重新加载触发此次错误的 source（hls.startLoad(-1) / video.load()）。
   *
   * 时序合法性（ADR-166 R-166-2 / Codex stop-time review FIX-1 双层守卫）：
   *   - **合法**：在 onError 回调体内**同步**调用 = 必然作用于触发错误的 src
   *   - **第 1 层守卫 active 标志**：onError 同步返回后（含 async onError 返回 Promise 那一刻）
   *     controls 进入冻结期；后续任何调用（`await` 后 / `setTimeout` 后 / 外部 ref 持有）
   *     = 静默 no-op + dev `console.warn`（防 controls.retry 生命周期外溢破缺契约）
   *   - **第 2 层守卫 srcRef 比对**：即便理论上仍 active，若 props.src 已变（极少数同 tick
   *     setState 同步切 src 场景）= 同上 no-op + dev warn（异步切线竞态兜底）
   *
   * 失败再次触发 onError（Y-166-4）：retry 后若再次 fatal，onError 会再次调用并携带**新** controls 实例；
   * 消费方需自行计数防死循环（建议 ≤ 1 次本地 retry 后切线 / 见 PlayerShell -EP 子卡实施）。
   *
   * 签名约束（ADR-166 R-166-3 fire-and-forget）：
   *   - 返回 `void` / 不抛错 / 不返回 Promise
   *   - 消费方不应 await retry() 或将其链入 Promise 链
   */
  readonly retry: () => void;
}

export interface PlayerErrorEvent {
  /** 错误分类（见 PlayerErrorCode） */
  readonly code: PlayerErrorCode;
  /**
   * 错误发生时刻 Player 内部 `props.src` 的快照（Opus R-N-3 / 不可信语义警告）。
   *
   * **重要**：消费方做 dead-source 标记时**不应**用此字段做匹配键（不应字符串比对 src URL）。
   * 切集 / 切源会触发 Player 整组件 unmount/remount，onError 到达消费方时
   * 消费方可能已切到新 src，再用 event.src 标 dead 会把新切的源误标 / 雪崩式标 dead。
   *
   * 正确做法：消费方自己持有 `sourceId` / `lineKey`，在 onError 回调中关联自身 state。
   */
  readonly src: string | null;
  /**
   * 是否不可恢复（fatal）。
   *
   * - `true`：消费方应切换源 / 隐藏播放器（native_media_failed / hls_fatal）
   * - `false`：可恢复 → 等待 player-core 自愈（当前 code 集均为 fatal=true / 未来非 fatal 成员加入时用）
   */
  readonly fatal: boolean;
}

// ─── Internal types ───────────────────────────────────────────────────────────

export type SeekDirection = "forward" | "back" | null;
export type Panel = "settings" | "quality" | "subtitles" | "speed" | null;
export type LoadingState = "idle" | "initial" | "buffering";
