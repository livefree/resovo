// ─── Constants ────────────────────────────────────────────────────────────────

export const SEEK_STEP = 10; // seconds — keyboard and mobile double-tap
export const VOLUME_STEP = 0.05;
export const SPEED_STEP = 0.05;
export const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
export const CHROME_HIDE_DELAY = 2000; // ms
export const IMMERSIVE_HIDE_DELAY = 3000; // ms
export const SEEK_OVERLAY_DURATION = 600; // ms the seek animation stays visible
export const DOUBLE_TAP_THRESHOLD = 250; // ms for double-tap detection
export const RESUME_EXCLUSION = 30; // seconds — don't resume near start/end
export const EPISODES_COLS_SMALL = 4; // grid columns when ≤ threshold episodes
export const EPISODES_COLS_LARGE = 6; // grid columns when > threshold episodes
export const EPISODES_COLS_THRESHOLD = 12; // episode count breakpoint
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
