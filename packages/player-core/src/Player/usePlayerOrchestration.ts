import { useSystemIntegrations } from "../hooks/useSystemIntegrations";
import { useLayoutDecision } from "../hooks/useLayoutDecision";
import { useChromeVisibility } from "../hooks/useChromeVisibility";
import { useProgressInteractions } from "../hooks/useProgressInteractions";
import { useSourceLoader } from "../hooks/useSourceLoader";
import { usePlayerActions } from "../hooks/usePlayerActions";
import { useGestureControls } from "../hooks/useGestureControls";
import { buildOverlayEntries, useOverlayManager } from "../hooks/useOverlayManager";
import { useInputRouter } from "../hooks/useInputRouter";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { resolveQualityHeight } from "../utils/format";
import type { QualityLevel, SubtitleTrack, Chapter, PlayerErrorEvent } from "../types";
import type { PlayerState } from "./usePlayerState";

export interface OrchestrationProps {
  src?: string;
  qualities: QualityLevel[];
  activeQualityId?: string;
  onQualityChange?: (id: string) => void;
  subtitles: SubtitleTrack[];
  title?: string;
  author?: string;
  poster?: string;
  chapters: Chapter[];
  onNext?: () => void;
  episodes?: Array<{ title?: string }>;
  activeEpisodeIndex: number;
  onEpisodeChange?: (index: number) => void;
  onTheaterChange?: (isTheater: boolean) => void;
  startTime?: number;
  autoplay: boolean;
  keepControlsVisible: boolean;
  thumbnailTrack?: string;
  // CHG-SN-9-PLAYER-ERROR / arch-reviewer Opus 评审：错误回调 + 默认 UI 抑制
  onError?: (event: PlayerErrorEvent) => void;
  suppressDefaultErrorUI?: boolean;
}

export function usePlayerOrchestration(props: OrchestrationProps, state: PlayerState) {
  const {
    playerRef, videoRef, autoplayContextRef,
    volumeTimeoutRef, seekTimerRef, bezelTimerRef, progressRailRef,
    doSeekRef,
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    buffered: _buffered, setBuffered,
    loadingState, setLoadingState,
    error, setError,
    volume, prevVolume, isMuted,
    setVolume, setPrevVolume, setIsMuted, setVolumeVisible,
    isTheater, setIsTheater,
    openPanel, setOpenPanel,
    seekDir, setSeekDir,
    setBezelVisible, setBezelPaused,
    showUnmute, setShowUnmute,
    videoHeight,
    isEpisodesOpen, setIsEpisodesOpen,
    focusedEpisodeIndex, setFocusedEpisodeIndex,
    activeSubId, setActiveSubId,
    playbackRate, setPlaybackRate,
    bezelVisible, bezelPaused,
  } = state;

  const {
    src, qualities, activeQualityId, onQualityChange,
    subtitles, title, author, poster, chapters, onNext,
    episodes, activeEpisodeIndex, onEpisodeChange, onTheaterChange,
    startTime, autoplay, keepControlsVisible,
  } = props;

  const { isFullscreen, airPlayAvailable } = useSystemIntegrations({
    videoRef,
    title,
    author,
    poster,
    onNext,
    isPlaying,
    duration,
    playbackRate,
    currentTime,
    setCurrentTime,
    doSeek: (delta, dir) => doSeekRef.current(delta, dir),
    setIsPlaying,
  });

  const hasEpisodes = (episodes?.length ?? 0) > 0;
  const hasNext = !!onNext;
  const hasSettingsContent =
    qualities.length > 0 ||
    subtitles.length > 0 ||
    resolveQualityHeight(
      qualities.find((q) => q.id === activeQualityId)?.label ?? null,
      videoHeight,
    ) !== null;

  const layoutDecision = useLayoutDecision({
    playerRef,
    isFullscreen,
    isTheater,
    episodesCount: episodes?.length ?? 0,
    hasEpisodes,
    hasNext,
  });

  const { chromeVisible, cursorHidden, revealChrome } = useChromeVisibility({
    chromeVisibilityPolicy: layoutDecision.chromeVisibilityPolicy,
    isPlaying,
    openPanel,
    isEpisodesOpen,
    keepControlsVisible,
  });

  const {
    hoverTime,
    hoverX,
    isProgressScrubbing,
    progressScrubActiveRef,
    handleProgressHover,
    handleProgressTouchStart,
    handleProgressTouchMove,
    handleProgressTouchEnd,
    handleProgressPointerDown,
    handleProgressPointerMove,
    handleProgressPointerUp,
    handleProgressMouseLeave,
  } = useProgressInteractions({
    duration,
    videoRef,
    progressRailRef,
    revealChrome,
    setCurrentTime,
  });

  const { retrySourceLoad } = useSourceLoader({
    videoRef,
    autoplayContextRef,
    src,
    startTime,
    autoplay,
    setError,
    setLoadingState,
    setCurrentTime,
    setDuration,
    setBuffered,
    setIsPlaying,
    setIsMuted,
    setShowUnmute,
    onError: props.onError,
  });

  const {
    togglePlay,
    doSeek,
    changeVolume,
    toggleMute,
    revealVolumeSlider,
    toggleFullscreen,
    toggleTheater,
    cycleSubtitles,
    handleProgressClick,
    togglePip,
    triggerAirPlay,
    handleEpisodeChange,
  } = usePlayerActions({
    videoRef,
    playerRef,
    progressRailRef,
    volumeTimeoutRef,
    seekTimerRef,
    bezelTimerRef,
    autoplayContextRef,
    isTheater,
    volume,
    prevVolume,
    isMuted,
    subtitles,
    activeSubId,
    setIsPlaying,
    setCurrentTime,
    setVolume,
    setPrevVolume,
    setIsMuted,
    setVolumeVisible,
    setIsTheater,
    setOpenPanel,
    setSeekDir,
    setBezelVisible,
    setBezelPaused,
    setShowUnmute,
    setActiveSubId,
    onTheaterChange,
    onEpisodeChange,
    revealChrome,
  });

  doSeekRef.current = doSeek;

  const {
    touchSeekDelta,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleGestureClick,
  } = useGestureControls({
    allowVolumeGesture: !layoutDecision.mode.startsWith("mobile"),
    playerRef,
    gesturesBlocked: buildOverlayEntries({
      chromeVisible,
      loadingState,
      error,
      hasTopChrome:
        (layoutDecision.slots["top-left"].includes("title") && !!(title || author)) ||
        layoutDecision.slots["top-right"].length > 0,
      showBezel: bezelVisible,
      seekVisible: seekDir !== null,
      showTouchSeekIndicator: false,
      showCaptions: !!state.subtitleCue && !!activeSubId,
      showUnmute,
      openPanel: !!openPanel,
      isEpisodesOpen,
      settingsPlacement: layoutDecision.placements.settingsPanel,
      episodesPlacement: layoutDecision.placements.episodesPanel,
    }).some((entry) => entry.visible && entry.blocksGestures),
    revealChrome,
    togglePlay,
    changeVolume,
    doSeek,
    volume,
  });

  const {
    blocksGestures,
    overlayLayout,
    topOverlay,
    isVisible: isOverlayVisible,
  } = useOverlayManager({
    chromeVisible,
    loadingState,
    error,
    hasTopChrome:
      (layoutDecision.slots["top-left"].includes("title") && !!(title || author)) ||
      layoutDecision.slots["top-right"].length > 0,
    showBezel: bezelVisible,
    seekVisible: seekDir !== null,
    showTouchSeekIndicator: touchSeekDelta !== null,
    showCaptions: !!state.subtitleCue && !!activeSubId,
    showUnmute,
    openPanel: !!openPanel,
    isEpisodesOpen,
    settingsPlacement: layoutDecision.placements.settingsPanel,
    episodesPlacement: layoutDecision.placements.episodesPanel,
    suppressDefaultErrorUI: props.suppressDefaultErrorUI,
  });

  const inputRouter = useInputRouter({
    blocksGestures,
    chromeVisible,
    interactionPolicy: layoutDecision.interactionPolicy,
    keepControlsVisible,
  });

  useKeyboardShortcuts({
    volume,
    isEpisodesOpen,
    focusedEpisodeIndex,
    episodes,
    episodesCols: layoutDecision.panels.episodes.cols,
    activeEpisodeIndex,
    hasEpisodes,
    onEpisodeChange,
    onNext,
    togglePlay,
    doSeek: (delta) => doSeek(delta),
    changeVolume,
    toggleMute,
    toggleFullscreen,
    toggleTheater,
    cycleSubtitles,
    setPlaybackRate,
    setFocusedEpisodeIndex,
    setIsEpisodesOpen,
  });

  return {
    isFullscreen,
    airPlayAvailable,
    hasEpisodes,
    hasNext,
    hasSettingsContent,
    layoutDecision,
    chromeVisible,
    cursorHidden,
    revealChrome,
    hoverTime,
    hoverX,
    isProgressScrubbing,
    progressScrubActiveRef,
    handleProgressHover,
    handleProgressTouchStart,
    handleProgressTouchMove,
    handleProgressTouchEnd,
    handleProgressPointerDown,
    handleProgressPointerMove,
    handleProgressPointerUp,
    handleProgressMouseLeave,
    retrySourceLoad,
    togglePlay,
    doSeek,
    changeVolume,
    toggleMute,
    revealVolumeSlider,
    toggleFullscreen,
    toggleTheater,
    cycleSubtitles,
    handleProgressClick,
    togglePip,
    triggerAirPlay,
    handleEpisodeChange,
    touchSeekDelta,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleGestureClick,
    blocksGestures,
    overlayLayout,
    topOverlay,
    isOverlayVisible,
    inputRouter,
  };
}

export type PlayerOrchestration = ReturnType<typeof usePlayerOrchestration>;
