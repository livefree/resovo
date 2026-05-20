import type { Dispatch, MouseEvent as ReactMouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import { renderControl, type ControlRenderContext } from "../controls/ControlRenderer";
import type { Chapter, Panel, SubtitleTrack } from "../types";
import type { LayoutDecision } from "../hooks/useLayoutDecision";

export interface BuildControlContextArgs {
  isPlaying: boolean;
  isFullscreen: boolean;
  isTheater: boolean;
  currentTime: number;
  duration: number;
  showRemaining: boolean;
  setShowRemaining: Dispatch<SetStateAction<boolean>>;
  isMuted: boolean;
  volume: number;
  volumeVisible: boolean;
  sliderId: string;
  playbackRate: number;
  openPanel: Panel;
  setOpenPanel: Dispatch<SetStateAction<Panel>>;
  settingsPanelId: string;
  speedPanelId: string;
  episodesPanelId: string;
  hasSettingsContent: boolean;
  subtitles: SubtitleTrack[];
  activeSubId: string | null;
  activeChapter: Chapter | null;
  hasEpisodes: boolean;
  hasNext: boolean;
  isEpisodesOpen: boolean;
  airPlayAvailable: boolean;
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
  speedButtonRef: RefObject<HTMLButtonElement | null>;
  episodesButtonRef: RefObject<HTMLButtonElement | null>;
  layoutDecision: LayoutDecision;
  togglePlay: () => void;
  toggleMute: () => void;
  changeVolume: (v: number) => void;
  toggleFullscreen: () => void;
  toggleTheater: () => void;
  toggleEpisodes: () => void;
  togglePip: () => void;
  cycleSubtitles: () => void;
  triggerAirPlay: () => void;
  revealVolumeSlider: () => void;
  handleProgressClick: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onNext?: () => void;
}

export interface BuildControlResult {
  controlCtx: ControlRenderContext;
  topControlsGap: string;
  topRightControls: ReactNode[];
  playControl: ReactNode;
  showTimeAboveProgress: boolean;
  bottomLeftControls: ReactNode[];
  bottomRightControls: ReactNode[];
  centerOverlayControls: ReactNode[];
  edgeRightControls: ReactNode[];
  showCenterTouchControls: boolean;
  hasTopInteractiveControls: boolean;
  showNextEpisodesGroup: boolean;
  nextControl: ReactNode;
  episodesControl: ReactNode;
}

export function buildControlContext(args: BuildControlContextArgs): BuildControlResult {
  const { layoutDecision } = args;
  const effectiveVolume = args.isMuted ? 0 : args.volume;

  const controlCtx: ControlRenderContext = {
    isPlaying: args.isPlaying,
    isFullscreen: args.isFullscreen,
    isTheater: args.isTheater,
    currentTime: args.currentTime,
    duration: args.duration,
    showRemaining: args.showRemaining,
    setShowRemaining: args.setShowRemaining,
    isMuted: args.isMuted,
    volume: args.volume,
    effectiveVolume,
    volumeVisible: args.volumeVisible,
    sliderId: args.sliderId,
    playbackRate: args.playbackRate,
    showSpeedIcon: layoutDecision.panels.speed.showButtonIcon,
    openPanel: args.openPanel,
    setOpenPanel: args.setOpenPanel,
    settingsPanelId: args.settingsPanelId,
    speedPanelId: args.speedPanelId,
    episodesPanelId: args.episodesPanelId,
    hasSettingsContent: args.hasSettingsContent,
    subtitles: args.subtitles,
    activeSubId: args.activeSubId,
    activeChapter: args.activeChapter,
    hasEpisodes: args.hasEpisodes,
    hasNext: args.hasNext,
    isEpisodesOpen: args.isEpisodesOpen,
    airPlayAvailable: args.airPlayAvailable,
    settingsButtonRef: args.settingsButtonRef,
    speedButtonRef: args.speedButtonRef,
    episodesButtonRef: args.episodesButtonRef,
    slots: layoutDecision.slots,
    togglePlay: args.togglePlay,
    toggleMute: args.toggleMute,
    changeVolume: args.changeVolume,
    toggleFullscreen: args.toggleFullscreen,
    toggleTheater: args.toggleTheater,
    toggleEpisodes: args.toggleEpisodes,
    togglePip: args.togglePip,
    cycleSubtitles: args.cycleSubtitles,
    triggerAirPlay: args.triggerAirPlay,
    revealVolumeSlider: args.revealVolumeSlider,
    handleProgressClick: args.handleProgressClick,
    onNext: args.onNext,
  };

  const topRightControls = layoutDecision.slots["top-right"]
    .map((c) => renderControl(c, controlCtx))
    .filter(Boolean);
  const bottomLeftSlot = layoutDecision.slots["bottom-left"];
  const playControl = bottomLeftSlot.includes("play")
    ? renderControl("play", controlCtx)
    : null;
  const showTimeAboveProgress =
    layoutDecision.interactionPolicy === "phone-touch" &&
    bottomLeftSlot.includes("time");
  const bottomLeftControls = bottomLeftSlot
    .filter(
      (control) =>
        control !== "play" &&
        control !== "next" &&
        control !== "episodes" &&
        !(showTimeAboveProgress && control === "time"),
    )
    .map((c) => renderControl(c, controlCtx))
    .filter(Boolean);
  const bottomRightControls = layoutDecision.slots["bottom-right"]
    .map((c) => renderControl(c, controlCtx))
    .filter(Boolean);
  const centerOverlayControls = layoutDecision.slots["center-overlay"]
    .map((c) => renderControl(c, controlCtx))
    .filter(Boolean);
  const edgeRightControls = layoutDecision.slots["edge-right"]
    .map((c) => renderControl(c, controlCtx))
    .filter(Boolean);
  const showCenterTouchControls = layoutDecision.interactionPolicy !== "desktop-pointer";
  const hasTopInteractiveControls = topRightControls.length > 0;
  const showNextEpisodesGroup =
    bottomLeftSlot.includes("next") || bottomLeftSlot.includes("episodes");
  const nextControl = bottomLeftSlot.includes("next")
    ? renderControl("next", controlCtx)
    : null;
  const episodesControl = bottomLeftSlot.includes("episodes")
    ? renderControl("episodes", controlCtx)
    : null;
  const topControlsGap =
    layoutDecision.viewportBand === "compact" ||
    layoutDecision.viewportBand === "narrow" ||
    layoutDecision.viewportBand === "phone-portrait"
      ? "10"
      : "8";

  return {
    controlCtx,
    topControlsGap,
    topRightControls,
    playControl,
    showTimeAboveProgress,
    bottomLeftControls,
    bottomRightControls,
    centerOverlayControls,
    edgeRightControls,
    showCenterTouchControls,
    hasTopInteractiveControls,
    showNextEpisodesGroup,
    nextControl,
    episodesControl,
  };
}
