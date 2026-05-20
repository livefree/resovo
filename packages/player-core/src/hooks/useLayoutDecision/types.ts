import type { RefObject } from "react";

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

export type UseLayoutDecisionParams = {
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

export const DESKTOP_COLLAPSED_WIDTH = 560;
export const DESKTOP_COMPACT_WIDTH = 760;
export const DESKTOP_MEDIUM_WIDTH = 960;
export const SHORT_HEIGHT = 460;
