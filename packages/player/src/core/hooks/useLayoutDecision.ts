import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  CHROME_HIDE_DELAY,
  EPISODES_COLS_COMPACT,
  EPISODES_COLS_LARGE,
  EPISODES_COLS_MEDIUM,
  EPISODES_COLS_NARROW,
  EPISODES_COLS_SMALL,
  EPISODES_COLS_THRESHOLD,
  EPISODES_PANEL_HEIGHT_COMPACT,
  EPISODES_PANEL_HEIGHT_DEFAULT,
  EPISODES_PANEL_HEIGHT_NARROW,
  IMMERSIVE_HIDE_DELAY,
  TOUCH_CHROME_HIDE_DELAY,
} from "../utils/format";

export type LayoutMode =
  | "desktop-default"
  | "desktop-compact"
  | "mobile-portrait"
  | "mobile-landscape"
  | "fullscreen-immersive";

export type ControlId =
  | "title"
  | "play"
  | "next"
  | "episodes"
  | "volume"
  | "time"
  | "chapter"
  | "subtitles"
  | "speed"
  | "settings"
  | "theater"
  | "airplay"
  | "pip"
  | "fullscreen";

export type ControlSlot =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center-overlay"
  | "edge-left"
  | "edge-right";

export type PanelPlacement = "bottom-left" | "bottom-right" | "top-right";
export type LayoutProfile =
  | "default"
  | "short-height"
  | "compact-width"
  | "medium-width"
  | "narrow-width";
export type ViewportBand =
  | "wide"
  | "medium"
  | "compact"
  | "narrow"
  | "phone-portrait";
export type InteractionPolicy = "desktop-pointer" | "tablet-touch" | "phone-touch";
export type ChromePolicy =
  | "hover-autohide"
  | "touch-autohide"
  | "touch-persistent-paused";
export interface ChromeVisibilityPolicy {
  hideCursorOnAutohide: boolean;
  hideDelayMs: number;
  id: ChromePolicy;
  pausedBehavior: "autohide" | "persistent";
}
export type PanelSizingMode = "compact" | "stable";

type UseLayoutDecisionParams = {
  episodesCount: number;
  hasEpisodes: boolean;
  hasNext: boolean;
  isFullscreen: boolean;
  isTheater: boolean;
  playerRef: RefObject<HTMLDivElement | null>;
};

export type LayoutDecision = {
  chromePolicy: ChromePolicy;
  chromeVisibilityPolicy: ChromeVisibilityPolicy;
  compactPanels: boolean;
  constraints: {
    height: "short" | "tall";
    width: "compact" | "medium" | "narrow" | "wide";
  };
  density: "collapsed" | "comfortable" | "condensed";
  hiddenControls: ControlId[];
  interactionPolicy: InteractionPolicy;
  mode: LayoutMode;
  profile: LayoutProfile;
  viewportBand: ViewportBand;
  placements: {
    episodesPanel: PanelPlacement;
    speedPanel: PanelPlacement;
    settingsPanel: PanelPlacement;
  };
  panels: {
    episodes: {
      cols: number;
      maxHeight: string;
    };
    sizingMode: PanelSizingMode;
    speed: {
      showButtonIcon: boolean;
    };
  };
  slots: Record<ControlSlot, ControlId[]>;
};

const DESKTOP_COLLAPSED_WIDTH = 560;
const DESKTOP_COMPACT_WIDTH = 760;
const DESKTOP_MEDIUM_WIDTH = 960;
const SHORT_HEIGHT = 460;

function createDesktopDefaultSlots(hasEpisodes: boolean, hasNext: boolean) {
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

function createTabletTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
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

function createPhoneTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
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

function createFullscreenPointerSlots(hasEpisodes: boolean, hasNext: boolean) {
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

function createFullscreenTouchSlots(hasEpisodes: boolean, hasNext: boolean) {
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

function cloneSlots(
  slots: Record<ControlSlot, ControlId[]>,
): Record<ControlSlot, ControlId[]> {
  return Object.fromEntries(
    Object.entries(slots).map(([slot, controls]) => [slot, [...controls]]),
  ) as Record<ControlSlot, ControlId[]>;
}

function removeControl(
  slots: Record<ControlSlot, ControlId[]>,
  control: ControlId,
) {
  Object.keys(slots).forEach((slot) => {
    const typedSlot = slot as ControlSlot;
    slots[typedSlot] = slots[typedSlot].filter((value) => value !== control);
  });
}

function ensureControlInSlot(
  slots: Record<ControlSlot, ControlId[]>,
  control: ControlId,
  slot: ControlSlot,
) {
  removeControl(slots, control);
  slots[slot].push(control);
}

function applyDesktopCollapsePolicy({
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

  removeControl(slots, "volume");
  removeControl(slots, "chapter");
  promoteCompactControls();

  if (profile === "narrow-width") {
    removeControl(slots, "theater");
    removeControl(slots, "airplay");
    removeControl(slots, "pip");
  }

  return slots;
}

export function useLayoutDecision({
  episodesCount,
  hasEpisodes,
  hasNext,
  isFullscreen,
  isTheater,
  playerRef,
}: UseLayoutDecisionParams): LayoutDecision {
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean>(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const [windowIsPortrait, setWindowIsPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth <= window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const syncPointerType = () => setIsCoarsePointer(mediaQuery.matches);

    syncPointerType();

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", syncPointerType);
      return () => mediaQuery.removeEventListener("change", syncPointerType);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQuery.addListener?.(syncPointerType);
    return () => legacyMediaQuery.removeListener?.(syncPointerType);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const measureViewport = () => {
      const rect = playerRef.current?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth;
      const height = rect?.height || window.innerHeight;

      setViewport((current) => {
        if (current.width === width && current.height === height) return current;
        return { width, height };
      });

      const portrait = window.innerWidth <= window.innerHeight;
      setWindowIsPortrait((current) => (current === portrait ? current : portrait));
    };

    measureViewport();
    window.addEventListener("resize", measureViewport);

    const observer =
      typeof ResizeObserver !== "undefined" && playerRef.current
        ? new ResizeObserver(measureViewport)
        : null;
    if (observer && playerRef.current) observer.observe(playerRef.current);

    return () => {
      window.removeEventListener("resize", measureViewport);
      observer?.disconnect();
    };
  }, [playerRef]);

  return useMemo(() => {
    let mode: LayoutMode = "desktop-default";
    const widthBand =
      viewport.width > 0 && viewport.width <= DESKTOP_COLLAPSED_WIDTH
        ? "narrow"
        : viewport.width > 0 && viewport.width <= DESKTOP_COMPACT_WIDTH
          ? "compact"
          : viewport.width > 0 && viewport.width <= DESKTOP_MEDIUM_WIDTH
            ? "medium"
            : "wide";
    const heightBand = viewport.height > 0 && viewport.height <= SHORT_HEIGHT ? "short" : "tall";
    const viewportBand: ViewportBand =
      isCoarsePointer && windowIsPortrait && viewport.width > 0 && viewport.width <= DESKTOP_COLLAPSED_WIDTH
        ? "phone-portrait"
        : widthBand;
    const compactPanelBands: ViewportBand[] = ["compact", "narrow", "phone-portrait"];
    let density: LayoutDecision["density"] = "comfortable";
    let profile: LayoutProfile = "default";
    let interactionPolicy: InteractionPolicy = "desktop-pointer";
    let chromePolicy: ChromePolicy = "hover-autohide";
    const isImmersive = isFullscreen || isTheater;

    if (isFullscreen) {
      mode = "fullscreen-immersive";
    } else if (isCoarsePointer) {
      mode = windowIsPortrait ? "mobile-portrait" : "mobile-landscape";
    } else if (viewport.width > 0 && viewport.width <= DESKTOP_COMPACT_WIDTH) {
      mode = "desktop-compact";
    }

    if (isCoarsePointer) {
      interactionPolicy =
        windowIsPortrait && viewport.width <= DESKTOP_COLLAPSED_WIDTH
          ? "phone-touch"
          : "tablet-touch";
      chromePolicy =
        interactionPolicy === "phone-touch"
          ? "touch-persistent-paused"
          : "touch-autohide";
    }

    if (!isCoarsePointer && !isFullscreen) {
      if (widthBand === "narrow") {
        density = "collapsed";
        profile = "narrow-width";
      } else if (widthBand === "compact" || heightBand === "short") {
        density = "condensed";
        profile = widthBand === "compact" ? "compact-width" : "short-height";
      } else if (widthBand === "medium") {
        density = "comfortable";
        profile = "medium-width";
      }
    }

    const baseSlots =
      isFullscreen && !isCoarsePointer
        ? createFullscreenPointerSlots(hasEpisodes, hasNext)
        : isFullscreen && isCoarsePointer
          ? createFullscreenTouchSlots(hasEpisodes, hasNext)
          : interactionPolicy === "tablet-touch"
            ? createTabletTouchSlots(hasEpisodes, hasNext)
            : interactionPolicy === "phone-touch"
              ? createPhoneTouchSlots(hasEpisodes, hasNext)
              : createDesktopDefaultSlots(hasEpisodes, hasNext);
    const slots =
      !isCoarsePointer && !isFullscreen
        ? applyDesktopCollapsePolicy({
            profile,
            hasEpisodes,
            slots: cloneSlots(baseSlots),
          })
        : baseSlots;

    const visibleControls = new Set(
      Object.values(slots).flatMap((slotControls) => slotControls),
    );

    const allControls: ControlId[] = [
      "title",
      "play",
      "next",
      "episodes",
      "volume",
      "time",
      "chapter",
      "subtitles",
      "speed",
      "settings",
      "theater",
      "airplay",
      "pip",
      "fullscreen",
    ];

    const hiddenControls = allControls.filter((control) => {
      if (control === "episodes" && !hasEpisodes) return true;
      if (control === "next" && !hasNext) return true;
      return !visibleControls.has(control);
    });

    const chromeVisibilityPolicy: ChromeVisibilityPolicy = {
      id: chromePolicy,
      hideDelayMs: isImmersive
        ? IMMERSIVE_HIDE_DELAY
        : chromePolicy === "touch-autohide"
          ? TOUCH_CHROME_HIDE_DELAY
          : CHROME_HIDE_DELAY,
      pausedBehavior:
        chromePolicy === "touch-persistent-paused" ? "persistent" : "autohide",
      hideCursorOnAutohide: isImmersive,
    };
    const panelSizingMode: PanelSizingMode = compactPanelBands.includes(viewportBand)
      ? "compact"
      : "stable";
    const speedPolicy = {
      showButtonIcon: !compactPanelBands.includes(viewportBand),
    };
    const episodesCols =
      viewportBand === "phone-portrait" || viewportBand === "narrow"
        ? EPISODES_COLS_NARROW
        : viewportBand === "compact"
          ? EPISODES_COLS_COMPACT
          : viewportBand === "medium"
            ? EPISODES_COLS_MEDIUM
            : episodesCount > EPISODES_COLS_THRESHOLD
              ? EPISODES_COLS_LARGE
              : EPISODES_COLS_SMALL;
    const episodesMaxHeight =
      viewportBand === "phone-portrait" || viewportBand === "narrow"
        ? EPISODES_PANEL_HEIGHT_NARROW
        : viewportBand === "compact"
          ? EPISODES_PANEL_HEIGHT_COMPACT
          : EPISODES_PANEL_HEIGHT_DEFAULT;

    return {
      mode,
      profile,
      viewportBand,
      interactionPolicy,
      chromePolicy,
      chromeVisibilityPolicy,
      hiddenControls,
      density,
      constraints: {
        width: widthBand,
        height: heightBand,
      },
      slots,
      placements: {
        episodesPanel: slots["top-right"].includes("episodes")
          ? "top-right"
          : slots["bottom-right"].includes("episodes")
            ? "bottom-right"
            : "bottom-left",
        speedPanel: slots["top-right"].includes("speed")
          ? "top-right"
          : "bottom-right",
        settingsPanel: slots["top-right"].includes("settings")
          ? "top-right"
          : "bottom-right",
      },
      panels: {
        sizingMode: panelSizingMode,
        speed: speedPolicy,
        episodes: {
          cols: episodesCols,
          maxHeight: episodesMaxHeight,
        },
      },
      compactPanels: density !== "comfortable" || mode !== "desktop-default",
    } satisfies LayoutDecision;
  }, [
    hasEpisodes,
    episodesCount,
    hasNext,
    isCoarsePointer,
    isFullscreen,
    isTheater,
    viewport.height,
    viewport.width,
    windowIsPortrait,
  ]);
}
