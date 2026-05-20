import { useMemo } from "react";
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
} from "../../utils/format";
import type {
  UseLayoutDecisionParams,
  LayoutDecision,
  LayoutMode,
  ControlId,
  ViewportBand,
  LayoutProfile,
  InteractionPolicy,
  ChromePolicy,
  ChromeVisibilityPolicy,
  PanelSizingMode,
} from "./types";
import {
  DESKTOP_COLLAPSED_WIDTH,
  DESKTOP_COMPACT_WIDTH,
  DESKTOP_MEDIUM_WIDTH,
  SHORT_HEIGHT,
} from "./types";
import {
  createDesktopDefaultSlots,
  createTabletTouchSlots,
  createPhoneTouchSlots,
  createFullscreenPointerSlots,
  createFullscreenTouchSlots,
  cloneSlots,
} from "./slotFactories";
import { applyDesktopCollapsePolicy } from "./collapsePolicy";
import { useViewportSignals } from "./useViewportSignals";

export function useLayoutDecision({
  episodesCount,
  hasEpisodes,
  hasNext,
  isFullscreen,
  isTheater,
  playerRef,
}: UseLayoutDecisionParams): LayoutDecision {
  const { isCoarsePointer, viewport, windowIsPortrait } = useViewportSignals(playerRef);

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

export type {
  LayoutMode,
  ControlId,
  ControlSlot,
  PanelPlacement,
  LayoutProfile,
  ViewportBand,
  InteractionPolicy,
  ChromePolicy,
  ChromeVisibilityPolicy,
  PanelSizingMode,
  LayoutDecision,
  UseLayoutDecisionParams,
} from "./types";
