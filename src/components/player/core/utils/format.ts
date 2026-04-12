// ─── Constants ────────────────────────────────────────────────────────────────

export const SEEK_STEP = 10; // seconds — keyboard and mobile double-tap
export const VOLUME_STEP = 0.05;
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 2;
export const SPEED_STEP = 0.05;
export const SPEED_PRESETS = [0.5, 1, 1.5, 2];
export const CHROME_HIDE_DELAY = 2000; // ms
export const TOUCH_CHROME_HIDE_DELAY = 3200; // ms for touch-autohide layouts
export const IMMERSIVE_HIDE_DELAY = 3000; // ms
export const SEEK_OVERLAY_DURATION = 600; // ms the seek animation stays visible
export const DOUBLE_TAP_THRESHOLD = 250; // ms for double-tap detection
export const RESUME_EXCLUSION = 30; // seconds — don't resume near start/end
export const EPISODES_COLS_SMALL = 4; // grid columns when ≤ threshold episodes
export const EPISODES_COLS_LARGE = 6; // grid columns when > threshold episodes
export const EPISODES_COLS_THRESHOLD = 12; // episode count breakpoint
export const EPISODES_COLS_MEDIUM = 5; // medium desktop widths
export const EPISODES_COLS_COMPACT = 4; // compact desktop widths
export const EPISODES_COLS_NARROW = 3; // narrow widths / small panels
export const EPISODES_PANEL_HEIGHT_DEFAULT = "260px";
export const EPISODES_PANEL_HEIGHT_COMPACT = "220px";
export const EPISODES_PANEL_HEIGHT_NARROW = "196px";
export const THUMB_CLAMP_PX = 80; // px inset from rail edge for thumbnail tooltip

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const secs = Math.floor(totalSeconds);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const sec = secs % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function formatRate(rate: number): string {
  return rate === 1 ? "Normal" : `${rate.toFixed(2).replace(/\.?0+$/, "")}x`;
}

export function formatRateBadge(rate: number): string {
  return `${rate.toFixed(2)}x`;
}

// ─── Quality label helpers ─────────────────────────────────────────────────────

/** Parse numeric pixel height from a quality label string.
 *  "1080p" → 1080 | "4K" → 2160 | "720p HDR" → 720 | "Auto" → null */
function parseResolutionHeight(label: string): number | null {
  const lower = label.trim().toLowerCase();
  if (lower === "8k") return 4320;
  if (lower === "4k") return 2160;
  if (lower === "2k") return 1440;
  const match = label.match(/^(\d+)p/i);
  if (match?.[1]) return parseInt(match[1], 10);
  return null;
}

/** Resolve the display height from the active quality label, falling back to
 *  the video element's intrinsic height (useful for auto/adaptive streams). */
export function resolveQualityHeight(
  activeLabel: string | null | undefined,
  videoHeight: number,
): number | null {
  if (activeLabel) {
    const parsed = parseResolutionHeight(activeLabel);
    if (parsed !== null) return parsed;
  }
  return videoHeight > 0 ? videoHeight : null;
}

/** Short badge label shown in the control bar: "4K", "1080p", "720p" … */
export function qualityBadgeLabel(height: number): string {
  if (height >= 4320) return "8K";
  if (height >= 2160) return "4K";
  return `${height}p`;
}

/** Descriptive label for tooltips and the settings info row. */
export function qualityDescription(height: number): string {
  if (height >= 4320) return "4320p · 8K Ultra HD";
  if (height >= 2160) return "2160p · 4K UHD";
  if (height >= 1440) return "1440p · QHD";
  if (height >= 1080) return "1080p · Full HD";
  if (height >= 720) return "720p · HD";
  if (height >= 480) return "480p · SD";
  return `${height}p`;
}
