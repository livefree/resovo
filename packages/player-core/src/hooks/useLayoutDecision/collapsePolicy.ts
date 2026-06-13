import type { ControlSlot, ControlId, LayoutProfile } from "./types";
import { ensureControlInSlot, removeControl } from "./slotFactories";

export function applyDesktopCollapsePolicy({
  slots,
  profile,
  hasEpisodes,
}: {
  profile: LayoutProfile;
  hasEpisodes: boolean;
  slots: Record<ControlSlot, ControlId[]>;
}) {
  if (profile === "default") return slots;

  const promoteCompactControls = () => {
    ensureControlInSlot(slots, "speed", "top-right");
    ensureControlInSlot(slots, "settings", "top-right");
    if (hasEpisodes) {
      ensureControlInSlot(slots, "episodes", "top-right");
    }
  };

  if (profile === "short-height") {
    removeControl(slots, "chapter");
    removeControl(slots, "theater");
    promoteCompactControls();
    return slots;
  }

  // PLAYER-11：音量控件静止态仅扬声器图标（hover 才展开滑块），任何桌面宽度都不缺空间，
  // 不随 compact/medium/narrow 折叠移除（修复 ≤960px 桌面播放器音量键消失）。
  removeControl(slots, "chapter");
  promoteCompactControls();

  if (profile === "narrow-width") {
    removeControl(slots, "theater");
    removeControl(slots, "airplay");
    removeControl(slots, "pip");
  }

  return slots;
}
