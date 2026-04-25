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
}

// ─── Internal types ───────────────────────────────────────────────────────────

export type SeekDirection = "forward" | "back" | null;
export type Panel = "settings" | "quality" | "subtitles" | "speed" | null;
