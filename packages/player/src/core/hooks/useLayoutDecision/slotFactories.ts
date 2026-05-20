import type { ControlId, ControlSlot } from "./types";

export function createDesktopDefaultSlots(hasEpisodes: boolean, hasNext: boolean) {
  const bottomLeft: ControlId[] = ["play"];
  if (hasNext) bottomLeft.push("next");
  if (hasEpisodes) bottomLeft.push("episodes");
  bottomLeft.push("volume", "time", "chapter");

  return {
    "top-left": ["title"],
    "top-right": [],
    "bottom-left": bottomLeft,
    "bottom-right": ["subtitles", "speed", "settings", "theater", "airplay", "pip", "fullscreen"],
    "center-overlay": [],
    "edge-left": [],
    "edge-right": [],
  } satisfies Record<ControlSlot, ControlId[]>;
}

export function createTabletTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
  return {
    "top-left": ["title"],
    "top-right": [
      ...(hasEpisodes ? (["episodes"] as ControlId[]) : []),
      "speed",
      "settings",
      "subtitles",
    ],
    "bottom-left": ["play", ...(hasNext ? (["next"] as ControlId[]) : []), "time"],
    "bottom-right": ["fullscreen"],
    "center-overlay": [],
    "edge-left": [],
    "edge-right": [],
  } satisfies Record<ControlSlot, ControlId[]>;
}

export function createPhoneTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
  return {
    "top-left": ["title"],
    "top-right": (["settings", "speed", "airplay", "pip"] as ControlId[]),
    "bottom-left": ["play", ...(hasNext ? (["next"] as ControlId[]) : []), "time"],
    "bottom-right": [
      ...(hasEpisodes ? (["episodes"] as ControlId[]) : []),
      "fullscreen",
    ],
    "center-overlay": [],
    "edge-left": [],
    "edge-right": [],
  } satisfies Record<ControlSlot, ControlId[]>;
}

export function createFullscreenPointerSlots(hasEpisodes: boolean, hasNext: boolean) {
  const bottomLeft: ControlId[] = ["play"];
  if (hasNext) bottomLeft.push("next");
  if (hasEpisodes) bottomLeft.push("episodes");
  bottomLeft.push("volume", "time", "chapter");

  return {
    "top-left": ["title"],
    "top-right": (["airplay", "pip"] as ControlId[]),
    "bottom-left": bottomLeft,
    "bottom-right": (["subtitles", "speed", "settings", "fullscreen"] as ControlId[]),
    "center-overlay": [],
    "edge-left": [],
    "edge-right": [],
  } satisfies Record<ControlSlot, ControlId[]>;
}

export function createFullscreenTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
  const bottomLeft: ControlId[] = ["play"];
  if (hasNext) bottomLeft.push("next");
  bottomLeft.push("time");
  if (hasEpisodes) bottomLeft.push("episodes");

  return {
    "top-left": ["title"],
    "top-right": (["settings", "speed", "airplay", "pip"] as ControlId[]),
    "bottom-left": bottomLeft,
    "bottom-right": (["fullscreen"] as ControlId[]),
    "center-overlay": [],
    "edge-left": [],
    "edge-right": [],
  } satisfies Record<ControlSlot, ControlId[]>;
}

export function cloneSlots(
  slots: Record<ControlSlot, ControlId[]>,
): Record<ControlSlot, ControlId[]> {
  return Object.fromEntries(
    Object.entries(slots).map(([slot, controls]) => [slot, [...controls]]),
  ) as Record<ControlSlot, ControlId[]>;
}

export function removeControl(
  slots: Record<ControlSlot, ControlId[]>,
  control: ControlId,
) {
  Object.keys(slots).forEach((slot) => {
    const typedSlot = slot as ControlSlot;
    slots[typedSlot] = slots[typedSlot].filter((value) => value !== control);
  });
}

export function ensureControlInSlot(
  slots: Record<ControlSlot, ControlId[]>,
  control: ControlId,
  slot: ControlSlot,
) {
  removeControl(slots, control);
  slots[slot].push(control);
}
