import { useMemo } from "react";

export type OverlayKind =
  | "spinner"
  | "error"
  | "bezel"
  | "seek-indicator"
  | "touch-seek"
  | "captions"
  | "unmute-prompt"
  | "settings"
  | "episodes";

export type OverlayEntry = {
  blocksGestures: boolean;
  interactive: boolean;
  kind: OverlayKind;
  priority: number;
  visible: boolean;
};
export type OverlayCaptionPlacement =
  | "default"
  | "above-chrome"
  | "raised-for-bottom-overlay";
export type OverlayPromptPlacement =
  | "below-top-chrome-left"
  | "below-top-chrome-right"
  | "top-edge-right";
export type OverlayStackMode =
  | "idle"
  | "playback-feedback"
  | "loading"
  | "prompt"
  | "panel"
  | "error";
export interface OverlayLayoutContract {
  captionPlacement: OverlayCaptionPlacement;
  promptPlacement: OverlayPromptPlacement;
  stackMode: OverlayStackMode;
}

type UseOverlayManagerParams = {
  chromeVisible: boolean;
  error: string | null;
  episodesPlacement: "bottom-left" | "bottom-right" | "top-right";
  hasTopChrome: boolean;
  isEpisodesOpen: boolean;
  loadingState: "idle" | "initial" | "buffering";
  openPanel: boolean;
  settingsPlacement: "bottom-left" | "bottom-right" | "top-right";
  seekVisible: boolean;
  showCaptions: boolean;
  showTouchSeekIndicator: boolean;
  showUnmute: boolean;
  showBezel: boolean;
};

const OVERLAY_PRIORITY: Record<OverlayKind, number> = {
  error: 600,
  settings: 520,
  episodes: 510,
  "unmute-prompt": 450,
  spinner: 300,
  captions: 220,
  bezel: 180,
  "touch-seek": 170,
  "seek-indicator": 160,
};

export function buildOverlayEntries({
  error,
  isEpisodesOpen,
  loadingState,
  openPanel,
  seekVisible,
  showCaptions,
  showTouchSeekIndicator,
  showUnmute,
  showBezel,
}: UseOverlayManagerParams): OverlayEntry[] {
  return [
    {
      kind: "spinner",
      visible: loadingState !== "idle",
      interactive: false,
      priority: OVERLAY_PRIORITY.spinner,
      blocksGestures: false,
    },
    {
      kind: "error",
      visible: !!error,
      interactive: true,
      priority: OVERLAY_PRIORITY.error,
      blocksGestures: true,
    },
    {
      kind: "bezel",
      visible: showBezel,
      interactive: false,
      priority: OVERLAY_PRIORITY.bezel,
      blocksGestures: false,
    },
    {
      kind: "seek-indicator",
      visible: seekVisible,
      interactive: false,
      priority: OVERLAY_PRIORITY["seek-indicator"],
      blocksGestures: false,
    },
    {
      kind: "touch-seek",
      visible: showTouchSeekIndicator,
      interactive: false,
      priority: OVERLAY_PRIORITY["touch-seek"],
      blocksGestures: false,
    },
    {
      kind: "captions",
      visible: showCaptions,
      interactive: false,
      priority: OVERLAY_PRIORITY.captions,
      blocksGestures: false,
    },
    {
      kind: "unmute-prompt",
      visible: showUnmute,
      interactive: true,
      priority: OVERLAY_PRIORITY["unmute-prompt"],
      blocksGestures: false,
    },
    {
      kind: "settings",
      visible: openPanel,
      interactive: true,
      priority: OVERLAY_PRIORITY.settings,
      blocksGestures: true,
    },
    {
      kind: "episodes",
      visible: isEpisodesOpen,
      interactive: true,
      priority: OVERLAY_PRIORITY.episodes,
      blocksGestures: true,
    },
  ];
}

export function useOverlayManager(params: UseOverlayManagerParams) {
  return useMemo(() => {
    const entries = buildOverlayEntries(params);
    const entryMap = new Map(entries.map((entry) => [entry.kind, entry]));
    const errorVisible = entryMap.get("error")?.visible ?? false;
    const blockingPanelVisible =
      (entryMap.get("settings")?.visible ?? false) ||
      (entryMap.get("episodes")?.visible ?? false);
    const topPanelVisible =
      (params.openPanel && params.settingsPlacement === "top-right") ||
      (params.isEpisodesOpen && params.episodesPlacement === "top-right");
    const bottomPanelVisible =
      (params.openPanel && params.settingsPlacement === "bottom-right") ||
      (params.isEpisodesOpen && params.episodesPlacement !== "top-right");

    if (errorVisible) {
      for (const kind of [
        "spinner",
        "bezel",
        "seek-indicator",
        "touch-seek",
        "captions",
        "unmute-prompt",
      ] as const) {
        const entry = entryMap.get(kind);
        if (entry) entry.visible = false;
      }
    } else if (blockingPanelVisible) {
      for (const kind of [
        "bezel",
        "seek-indicator",
        "touch-seek",
        "unmute-prompt",
      ] as const) {
        const entry = entryMap.get(kind);
        if (entry) entry.visible = false;
      }
    } else if (entryMap.get("spinner")?.visible) {
      for (const kind of ["bezel", "seek-indicator", "touch-seek"] as const) {
        const entry = entryMap.get(kind);
        if (entry) entry.visible = false;
      }
    }

    const visibleEntries = entries
      .filter((entry) => entry.visible)
      .sort((left, right) => right.priority - left.priority);
    const captionPlacement: OverlayCaptionPlacement = errorVisible
      ? "default"
      : bottomPanelVisible || (entryMap.get("touch-seek")?.visible ?? false)
        ? "raised-for-bottom-overlay"
        : params.chromeVisible
          ? "above-chrome"
          : "default";
    const promptPlacement: OverlayPromptPlacement = topPanelVisible
      ? "below-top-chrome-left"
      : params.hasTopChrome
        ? "below-top-chrome-right"
        : "top-edge-right";
    const stackMode: OverlayStackMode = errorVisible
      ? "error"
      : blockingPanelVisible
        ? "panel"
        : (entryMap.get("unmute-prompt")?.visible ?? false)
          ? "prompt"
          : (entryMap.get("spinner")?.visible ?? false)
            ? "loading"
            : visibleEntries.some((entry) =>
                  ["bezel", "seek-indicator", "touch-seek"].includes(entry.kind),
                )
              ? "playback-feedback"
              : "idle";
    const overlayLayout: OverlayLayoutContract = {
      captionPlacement,
      promptPlacement,
      stackMode,
    };

    return {
      entries,
      overlayLayout,
      visibleEntries,
      interactiveOverlayVisible: visibleEntries.some((entry) => entry.interactive),
      blocksGestures: visibleEntries.some((entry) => entry.blocksGestures),
      topOverlay: visibleEntries[0]?.kind ?? null,
      isVisible: (kind: OverlayKind) =>
        visibleEntries.some((entry) => entry.kind === kind),
    };
  }, [params]);
}
