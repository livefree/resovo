"use client";

/**
 * Player — built from YouTube's DOM architecture
 *
 * Layer system (mirrors data-layer="N"):
 *   0  html5-video-container      <video>
 *   1  gradient-top + chrome-top  title bar
 *   2  unmute popup               muted-autoplay notice
 *   4  overlays-container         spinner / seek-animation / bezel / error
 *   5  popup-panels               settings / speed / episodes / subtitles
 *   6  settings-menu              sub-panel of (5)
 *   9  gradient-bottom + chrome-bottom  progress-bar + controls
 *
 * Global tooltip singleton mirrors ytp-tooltip (single div, data-attribute driven).
 * Controls split into ytp-left-controls / ytp-right-controls-left / ytp-right-controls-right.
 * Progress bar has three sub-systems: normal track, hover preview, fine-scrubbing.
 * Seek animation uses two independent divs: ytp-seek-overlay-animation-back / forward.
 */

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import s from "./Player.module.css";
import { type PlayerProps, type SeekDirection, type Panel } from "./types";
import {
  clamp,
  formatTime,
  qualityBadgeLabel,
  resolveQualityHeight,
  SEEK_STEP,
} from "./utils/format";
import { useThumbnails } from "./hooks/useThumbnails";
import { useSourceLoader } from "./hooks/useSourceLoader";
import { useProgressInteractions } from "./hooks/useProgressInteractions";
import { useGestureControls } from "./hooks/useGestureControls";
import { useChromeVisibility } from "./hooks/useChromeVisibility";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSystemIntegrations } from "./hooks/useSystemIntegrations";
import { useLayoutDecision } from "./hooks/useLayoutDecision";
import {
  buildOverlayEntries,
  useOverlayManager,
} from "./hooks/useOverlayManager";
import { useInputRouter } from "./hooks/useInputRouter";
import { usePlayerActions } from "./hooks/usePlayerActions";
import {
  renderControl,
  type ControlRenderContext,
} from "./controls/ControlRenderer";
import { Spinner } from "./components/Spinner";
import { SeekOverlay } from "./components/SeekOverlay";
import { Bezel } from "./components/Bezel";
import { EpisodesPanel } from "./components/EpisodesPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { SpeedPanel } from "./components/SpeedPanel";
import { ProgressBar } from "./components/ProgressBar";
import { ControlSlot } from "./components/ControlSlot";
import { MuteIcon, PlayIcon, PauseIcon, NextIcon } from "./components/icons";

type LoadingState = "idle" | "initial" | "buffering";

// ─── Main Component ───────────────────────────────────────────────────────────

export function Player({
  src,
  qualities = [],
  activeQualityId,
  onQualityChange,
  subtitles = [],
  poster,
  title,
  author,
  chapters = [],
  onPlay,
  onPause,
  onEnded,
  onTimeUpdate,
  startTime,
  autoplay = false,
  initialVolume = 1,
  defaultTheaterMode = false,
  onNext,
  episodes,
  activeEpisodeIndex = 0,
  onEpisodeChange,
  onTheaterChange,
  style,
  keepControlsVisible = false,
  thumbnailTrack,
}: PlayerProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayContextRef = useRef<"implicit" | "user-initiated">("implicit");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const episodesButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpenPanelRef = useRef<Panel | null>(null);
  const prevEpisodesOpenRef = useRef(false);

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const speedPanelRef = useRef<HTMLDivElement>(null);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime ?? 0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);

  // ── Volume ─────────────────────────────────────────────────────────────────
  const [volume, setVolume] = useState(initialVolume);
  const [prevVolume, setPrevVolume] = useState(initialVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const volumeTimeoutRef = useRef<number | null>(null);

  // ── Speed ──────────────────────────────────────────────────────────────────
  const [playbackRate, setPlaybackRate] = useState(1);

  // ── Subtitles ──────────────────────────────────────────────────────────────
  const [activeSubId, setActiveSubId] = useState<string | null>(
    subtitles.find((sub) => sub.default)?.id ?? null,
  );
  const [subtitleCue, setSubtitleCue] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [isTheater, setIsTheater] = useState(defaultTheaterMode);

  // ── Seek animation (layer 4) ───────────────────────────────────────────────
  const [seekDir, setSeekDir] = useState<SeekDirection>(null);
  const seekTimerRef = useRef<number | null>(null);

  // ── Bezel (center play/pause flash) ───────────────────────────────────────
  const [bezelVisible, setBezelVisible] = useState(false);
  const [bezelPaused, setBezelPaused] = useState(true);
  const bezelTimerRef = useRef<number | null>(null);

  // ── Muted-autoplay state ───────────────────────────────────────────────────
  const [showUnmute, setShowUnmute] = useState(false);

  // ── Video intrinsic size (for auto/adaptive quality display) ──────────────
  const [videoHeight, setVideoHeight] = useState(0);

  const progressRailRef = useRef<HTMLDivElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const { getThumbnailAt } = useThumbnails(thumbnailTrack);

  // ── Episodes panel ─────────────────────────────────────────────────────────
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] =
    useState(activeEpisodeIndex);
  const episodesPanelRef = useRef<HTMLDivElement>(null);

  const [showRemaining, setShowRemaining] = useState(false);

  const sliderId = useId();
  const settingsPanelId = useId();
  const speedPanelId = useId();
  const episodesPanelId = useId();

  // ── doSeek ref: breaks circular dep between useSystemIntegrations and
  //    usePlayerActions (useSystemIntegrations receives a stable wrapper that
  //    always delegates to the latest doSeek produced by usePlayerActions).
  const doSeekRef = useRef<(delta: number, dir?: SeekDirection) => void>(
    () => {},
  );

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
  });

  // ─── Volume & rate sync ────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncVolumeState = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
      if (!video.muted) setShowUnmute(false);
    };

    video.addEventListener("volumechange", syncVolumeState);
    return () => video.removeEventListener("volumechange", syncVolumeState);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  // ─── Subtitles ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const cleanups: (() => void)[] = [];
    Array.from(video.textTracks).forEach((track) => {
      const sub = subtitles.find((st) => st.srclang === track.language);
      if (sub && sub.id === activeSubId) {
        track.mode = "hidden";
        const onCue = () => {
          const cue = track.activeCues?.[0] as VTTCue | undefined;
          setSubtitleCue(cue?.text ?? "");
        };
        track.addEventListener("cuechange", onCue);
        cleanups.push(() => track.removeEventListener("cuechange", onCue));
      } else {
        track.mode = "disabled";
      }
    });
    return () => cleanups.forEach((fn) => fn());
  }, [activeSubId, subtitles]);

  // ─── Outside-click to close panels ────────────────────────────────────────
  useEffect(() => {
    if (!openPanel) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !settingsPanelRef.current?.contains(target) &&
        !speedPanelRef.current?.contains(target) &&
        !target.closest('[data-ytp-component="settings-btn"]') &&
        !target.closest('[data-ytp-component="speed-btn"]')
      ) {
        setOpenPanel(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openPanel]);

  useEffect(() => {
    if (!hasSettingsContent && openPanel === "settings") {
      setOpenPanel(null);
    }
  }, [hasSettingsContent, openPanel]);

  // ─── Outside-click to close episodes panel ─────────────────────────────────
  useEffect(() => {
    if (!isEpisodesOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !episodesPanelRef.current?.contains(target) &&
        !target.closest('[data-ytp-component="episodes-btn"]')
      )
        setIsEpisodesOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [isEpisodesOpen]);

  // ─── Scroll focused episode cell into view ─────────────────────────────────
  useEffect(() => {
    if (!isEpisodesOpen) return;
    episodesPanelRef.current
      ?.querySelector<HTMLElement>("[data-ep-focused]")
      ?.scrollIntoView({ block: "nearest" });
  }, [focusedEpisodeIndex, isEpisodesOpen]);

  useEffect(() => {
    if (prevOpenPanelRef.current && !openPanel) {
      if (prevOpenPanelRef.current === "speed") {
        speedButtonRef.current?.focus();
      } else {
        settingsButtonRef.current?.focus();
      }
    }
    prevOpenPanelRef.current = openPanel;
  }, [openPanel]);

  useEffect(() => {
    if (prevEpisodesOpenRef.current && !isEpisodesOpen) {
      episodesButtonRef.current?.focus();
    }
    prevEpisodesOpenRef.current = isEpisodesOpen;
  }, [isEpisodesOpen]);

  // ─── Computed values ───────────────────────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const activeQualityLabel =
    qualities.find((q) => q.id === activeQualityId)?.label ?? null;
  const resolvedQualityHeight = resolveQualityHeight(activeQualityLabel, videoHeight);
  const showQualityBadge =
    resolvedQualityHeight !== null &&
    layoutDecision.panels.sizingMode === "stable";
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const activeChapter = useMemo(() => {
    if (!chapters.length) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      if (ch && currentTime >= ch.startTime) return ch;
    }
    return null;
  }, [chapters, currentTime]);

  const hoverChapter = useMemo(() => {
    if (!chapters.length || hoverTime === null) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      if (ch && hoverTime >= ch.startTime) return ch;
    }
    return null;
  }, [chapters, hoverTime]);

  // ─── Gesture blocking pre-computation ─────────────────────────────────────
  const gestureBlockingOverlayVisible = buildOverlayEntries({
    chromeVisible,
    loadingState,
    error,
    hasTopChrome:
      (layoutDecision.slots["top-left"].includes("title") && !!(title || author)) ||
      layoutDecision.slots["top-right"].length > 0,
    showBezel: bezelVisible,
    seekVisible: seekDir !== null,
    showTouchSeekIndicator: false,
    showCaptions: !!subtitleCue && !!activeSubId,
    showUnmute,
    openPanel: !!openPanel,
    isEpisodesOpen,
    settingsPlacement: layoutDecision.placements.settingsPanel,
    episodesPlacement: layoutDecision.placements.episodesPanel,
  }).some((entry) => entry.visible && entry.blocksGestures);

  // ─── Actions ───────────────────────────────────────────────────────────────
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

  // Update the doSeek ref so useSystemIntegrations always delegates to the
  // latest doSeek implementation without recreating its effect.
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
    gesturesBlocked: gestureBlockingOverlayVisible,
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
    showCaptions: !!subtitleCue && !!activeSubId,
    showUnmute,
    openPanel: !!openPanel,
    isEpisodesOpen,
    settingsPlacement: layoutDecision.placements.settingsPanel,
    episodesPlacement: layoutDecision.placements.episodesPanel,
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

  // ─── Chapter markers ──────────────────────────────────────────────────────
  const chapterMarkers = useMemo(() => {
    if (!chapters.length || !duration) return [];
    return chapters.slice(1).map((ch) => ({
      title: ch.title,
      pct: (ch.startTime / duration) * 100,
    }));
  }, [chapters, duration]);

  // ─── Scrubber display position ────────────────────────────────────────────
  const displayPct =
    isProgressScrubbing && hoverTime !== null && duration > 0
      ? (hoverTime / duration) * 100
      : progressPct;

  // ─── Render helpers ────────────────────────────────────────────────────────
  const effectiveVolume = isMuted ? 0 : volume;

  const toggleEpisodes = () =>
    setIsEpisodesOpen((value) => {
      if (!value) setFocusedEpisodeIndex(activeEpisodeIndex);
      return !value;
    });

  const topControlsGap =
    layoutDecision.viewportBand === "compact" ||
    layoutDecision.viewportBand === "narrow" ||
    layoutDecision.viewportBand === "phone-portrait"
      ? "10"
      : "8";

  // ─── Control render context ────────────────────────────────────────────────
  const controlCtx: ControlRenderContext = {
    isPlaying,
    isFullscreen,
    isTheater,
    currentTime,
    duration,
    showRemaining,
    setShowRemaining,
    isMuted,
    volume,
    effectiveVolume,
    volumeVisible,
    sliderId,
    playbackRate,
    showSpeedIcon: layoutDecision.panels.speed.showButtonIcon,
    openPanel,
    setOpenPanel,
    settingsPanelId,
    speedPanelId,
    episodesPanelId,
    hasSettingsContent,
    subtitles,
    activeSubId,
    activeChapter,
    hasEpisodes,
    hasNext,
    isEpisodesOpen,
    airPlayAvailable,
    settingsButtonRef,
    speedButtonRef,
    episodesButtonRef,
    slots: layoutDecision.slots,
    togglePlay,
    toggleMute,
    toggleFullscreen,
    toggleTheater,
    toggleEpisodes,
    togglePip,
    cycleSubtitles,
    triggerAirPlay,
    revealVolumeSlider,
    changeVolume,
    handleProgressClick,
    onNext,
  };

  // ─── Slot renders ──────────────────────────────────────────────────────────
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
  const showCenterTouchControls =
    layoutDecision.interactionPolicy !== "desktop-pointer";
  const hasTopInteractiveControls = topRightControls.length > 0;
  const showNextEpisodesGroup =
    bottomLeftSlot.includes("next") || bottomLeftSlot.includes("episodes");
  const nextControl = bottomLeftSlot.includes("next")
    ? renderControl("next", controlCtx)
    : null;
  const episodesControl = bottomLeftSlot.includes("episodes")
    ? renderControl("episodes", controlCtx)
    : null;

  // ─── Player class ─────────────────────────────────────────────────────────
  const playerClass = [
    s.moviePlayer,
    s.ytpTransparent,
    isPlaying ? s.playingMode : s.pausedMode,
    chromeVisible || keepControlsVisible ? "" : s.ytpAutohide,
    isTheater ? s.ytpTheater : "",
    isFullscreen ? s.ytpFullscreen : "",
    cursorHidden ? s.ytpCursorHidden : "",
    openPanel || isEpisodesOpen ? s.ytpAnyPanelOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  const isManagedHlsSource =
    !!src &&
    src.includes(".m3u8") &&
    videoRef.current?.canPlayType("application/vnd.apple.mpegurl") === "";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={playerRef}
      className={playerClass}
      data-layout-mode={layoutDecision.mode}
      data-layout-panels={layoutDecision.compactPanels ? "compact" : "default"}
      data-layout-density={layoutDecision.density}
      data-layout-profile={layoutDecision.profile}
      data-layout-band={layoutDecision.viewportBand}
      data-top-controls-anchor="top"
      data-top-tooltip-placement="below"
      data-top-controls-gap={topControlsGap}
      data-interaction-policy={layoutDecision.interactionPolicy}
      data-chrome-policy={layoutDecision.chromePolicy}
      data-chrome-pause-behavior={
        layoutDecision.chromeVisibilityPolicy.pausedBehavior
      }
      data-chrome-hide-delay={String(
        layoutDecision.chromeVisibilityPolicy.hideDelayMs,
      )}
      data-layout-width={layoutDecision.constraints.width}
      data-layout-height={layoutDecision.constraints.height}
      data-loading-state={loadingState}
      data-overlay-top={topOverlay ?? undefined}
      data-overlay-stack={overlayLayout.stackMode}
      data-overlay-gestures-blocked={blocksGestures ? "true" : "false"}
      data-overlay-caption-placement={overlayLayout.captionPlacement}
      data-overlay-prompt-placement={overlayLayout.promptPlacement}
      data-overlay-layout={`${overlayLayout.stackMode}:${overlayLayout.captionPlacement}:${overlayLayout.promptPlacement}`}
      data-input-device-policy={inputRouter.devicePolicy}
      data-input-zones={inputRouter.zones.join(",")}
      data-top-controls-interactive={hasTopInteractiveControls ? "true" : "false"}
      style={style}
      onPointerMove={revealChrome}
      onPointerEnter={revealChrome}
    >
      {/* ── Layer 0: video container ─────────────────────────────────────── */}
      <div className={s.html5VideoContainer} data-layer="0">
        <video
          ref={videoRef}
          className={s.html5MainVideo}
          playsInline
          poster={poster}
          onPlay={() => {
            setIsPlaying(true);
            setLoadingState("idle");
            onPlay?.();
          }}
          onPlaying={() => {
            setIsPlaying(true);
            setLoadingState("idle");
          }}
          onPause={() => {
            setIsPlaying(false);
            onPause?.();
          }}
          onLoadStart={() => {
            setLoadingState("initial");
            setError(null);
          }}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            setVideoHeight(v.videoHeight);
            if (startTime) v.currentTime = startTime;
          }}
          onResize={(e) => setVideoHeight(e.currentTarget.videoHeight)}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrentTime(v.currentTime);
            onTimeUpdate?.(v.currentTime, v.duration);
          }}
          onProgress={(e) => {
            const b = e.currentTarget.buffered;
            if (b.length > 0) setBuffered(b.end(b.length - 1));
          }}
          onWaiting={() =>
            setLoadingState((value) =>
              value === "initial" ? value : "buffering",
            )
          }
          onCanPlay={() => setLoadingState("idle")}
          onError={() => {
            if (isManagedHlsSource) return;
            setError("Video failed to load. Please try again.");
            setLoadingState("idle");
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        >
          {subtitles.map((sub) => (
            <track
              key={sub.id}
              kind="subtitles"
              label={sub.label}
              srcLang={sub.srclang}
              src={sub.src}
              default={sub.id === activeSubId}
            />
          ))}
        </video>
      </div>

      {/* ── Layer 1: gradient top ─────────────────────────────────────────── */}
      <div className={s.ytpGradientTop} data-layer="1" aria-hidden="true" />

      {/* ── Layer 1: chrome top (title + author) ─────────────────────────── */}
      {(layoutDecision.slots["top-left"].includes("title") && (title || author)) ||
      topRightControls.length > 0 ? (
        <div className={s.ytpChromeTop} data-layer="1">
          {layoutDecision.slots["top-left"].includes("title") && (title || author) && (
            <div className={s.ytpTitle}>
              <div className={s.ytpTitleText}>
                {title && <span className={s.ytpTitleLink}>{title}</span>}
                {author && <div className={s.ytpTitleSubtext}>{author}</div>}
              </div>
            </div>
          )}
          {topRightControls.length > 0 && (
            <ControlSlot slot="top-right">{topRightControls}</ControlSlot>
          )}
        </div>
      ) : null}

      {/* ── Layer 5: muted-autoplay unmute prompt ─────────────────────────── */}
      {isOverlayVisible("unmute-prompt") && (
        <div
          className={[
            s.ytpUnmutePrompt,
            overlayLayout.promptPlacement === "below-top-chrome-right"
              ? s.ytpUnmutePromptBelowTopChrome
              : "",
            overlayLayout.promptPlacement === "below-top-chrome-left"
              ? s.ytpUnmutePromptBelowTopChromeLeft
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-layer="5"
        >
          <button
            className={s.ytpUnmuteButton}
            aria-label="Unmute"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = false;
              setIsMuted(false);
              setShowUnmute(false);
            }}
          >
            <MuteIcon />
            <span className={s.ytpUnmuteLabel}>Tap to unmute</span>
          </button>
        </div>
      )}

      {/* ── Layer 4: spinner ──────────────────────────────────────────────── */}
      <Spinner visible={isOverlayVisible("spinner")} state={loadingState} />

      {/* ── Layer 4: seek overlay animation ──────────────────────────────── */}
      <SeekOverlay
        direction={isOverlayVisible("seek-indicator") ? seekDir : null}
        seconds={SEEK_STEP}
      />

      {/* ── Layer 4: bezel (center flash) ────────────────────────────────── */}
      <Bezel visible={isOverlayVisible("bezel")} paused={bezelPaused} />

      {/* ── Layer 4: touch seek indicator ────────────────────────────────── */}
      {isOverlayVisible("touch-seek") && touchSeekDelta !== null && (
        <div
          className={s.ytpTouchSeekIndicator}
          data-layer="4"
          aria-hidden="true"
        >
          <span className={s.ytpTouchSeekDelta}>
            {touchSeekDelta >= 0 ? "+" : ""}
            {Math.round(touchSeekDelta)}s
          </span>
          <span className={s.ytpTouchSeekTarget}>
            → {formatTime(clamp(currentTime + touchSeekDelta, 0, duration))}
          </span>
        </div>
      )}

      {/* ── Layer 4: error banner ─────────────────────────────────────────── */}
      {isOverlayVisible("error") && error && (
        <div className={s.ytpErrorDisplay} data-layer="4" role="alert">
          <div className={s.ytpErrorContent}>
            <svg viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                fill="white"
              />
            </svg>
            <p>{error}</p>
            <button
              className={s.ytpErrorRetry}
              onClick={() => {
                retrySourceLoad();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Layer 4: subtitle cue ─────────────────────────────────────────── */}
      {isOverlayVisible("captions") && subtitleCue && activeSubId && (
        <div
          className={[
            s.ytpCaptionsWindow,
            overlayLayout.captionPlacement === "above-chrome"
              ? s.ytpCaptionsWindowAbove
              : "",
            overlayLayout.captionPlacement === "raised-for-bottom-overlay"
              ? s.ytpCaptionsWindowRaised
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-layer="4"
          aria-live="polite"
        >
          <span
            className={s.ytpCaptionSegment}
            dangerouslySetInnerHTML={{ __html: subtitleCue }}
          />
        </div>
      )}

      {/* ── Layer 5: episodes panel ───────────────────────────────────────── */}
      <EpisodesPanel
        panelRef={episodesPanelRef}
        panelId={episodesPanelId}
        episodes={episodes}
        isOpen={isEpisodesOpen}
        placement={layoutDecision.placements.episodesPanel}
        viewportBand={layoutDecision.viewportBand}
        panelSizingMode={layoutDecision.panels.sizingMode}
        episodesCols={layoutDecision.panels.episodes.cols}
        maxHeight={layoutDecision.panels.episodes.maxHeight}
        activeEpisodeIndex={activeEpisodeIndex}
        focusedEpisodeIndex={focusedEpisodeIndex}
        onEpisodeChange={handleEpisodeChange}
        onFocusEpisode={setFocusedEpisodeIndex}
        onClose={() => setIsEpisodesOpen(false)}
      />

      {/* ── Layer 5: settings panel ───────────────────────────────────────── */}
      <SettingsPanel
        panelRef={settingsPanelRef}
        panelId={settingsPanelId}
        openPanel={openPanel}
        placement={layoutDecision.placements.settingsPanel}
        viewportBand={layoutDecision.viewportBand}
        panelSizingMode={layoutDecision.panels.sizingMode}
        qualities={qualities}
        activeQualityId={activeQualityId}
        onQualityChange={onQualityChange}
        subtitles={subtitles}
        activeSubId={activeSubId}
        onSubtitleChange={setActiveSubId}
        onOpenPanel={setOpenPanel}
        onRequestClose={() => setOpenPanel(null)}
        resolvedQualityHeight={resolvedQualityHeight}
      />

      {openPanel === "speed" && (
        <SpeedPanel
          panelRef={speedPanelRef}
          panelId={speedPanelId}
          placement={layoutDecision.placements.speedPanel}
          playbackRate={playbackRate}
          viewportBand={layoutDecision.viewportBand}
          panelSizingMode={layoutDecision.panels.sizingMode}
          onPlaybackRateChange={setPlaybackRate}
          onRequestClose={() => setOpenPanel(null)}
        />
      )}

      {centerOverlayControls.length > 0 && (
        <div className={s.ytpCenterControls} data-layer="9">
          <ControlSlot slot="center-overlay">{centerOverlayControls}</ControlSlot>
        </div>
      )}

      {/* ── Mobile: center play/next overlay (circular, no tooltip) ──── */}
      {showCenterTouchControls && (
        <div className={s.ytpCenterTouchArea} aria-hidden="true">
          <button
            className={`${s.ytpCenterTouchBtn} ${s.ytpCenterTouchPlay}`}
            tabIndex={-1}
            onClick={togglePlay}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          {hasNext && (
            <button
              className={`${s.ytpCenterTouchBtn} ${s.ytpCenterTouchNext}`}
              tabIndex={-1}
              onClick={onNext}
            >
              <NextIcon />
            </button>
          )}
        </div>
      )}

      {edgeRightControls.length > 0 && (
        <div className={s.ytpEdgeRight} data-layer="9">
          <ControlSlot slot="edge-right">{edgeRightControls}</ControlSlot>
        </div>
      )}

      {/* ── Layer 9: gradient bottom ──────────────────────────────────────── */}
      <div className={s.ytpGradientBottom} data-layer="9" aria-hidden="true" />

      {/* ── Layer 3: gesture layer (click / touch) ────────────────────────── */}
      <div
        className={s.ytpGestureSurface}
        data-layer="3"
        data-gestures-blocked={inputRouter.gestureSurfaceDisabled ? "true" : "false"}
        data-zone-count={inputRouter.zones.length}
        aria-hidden="true"
        style={
          hasTopInteractiveControls
            ? ({ "--ytp-gesture-top": "52px" } as React.CSSProperties)
            : undefined
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {inputRouter.routes.map((route) => (
          <div
            key={route.zone}
            className={s.ytpGestureZone}
            data-input-route="gesture-zone"
            data-input-zone={route.zone}
            data-input-intent={route.intent}
            data-input-device-policy={route.devicePolicy}
            onClick={() => handleGestureClick(route.intent)}
          />
        ))}
      </div>

      {/* ── Layer 9: chrome bottom ────────────────────────────────────────── */}
      <div className={s.ytpChromeBottom} data-layer="9">
        {/* ── Touch: time display above progress bar ───────────────────────── */}
        {showTimeAboveProgress && (
          <div className={s.ytpTimeAboveProgress}>
            {renderControl("time", controlCtx)}
          </div>
        )}
        {/* ── Progress bar container ──────────────────────────────────────── */}
        <ProgressBar
          progressContainerRef={progressContainerRef}
          progressRailRef={progressRailRef}
          progressScrubActiveRef={progressScrubActiveRef}
          isScrubbing={isProgressScrubbing}
          duration={duration}
          currentTime={currentTime}
          bufferedPct={bufferedPct}
          displayPct={displayPct}
          hoverTime={hoverTime}
          hoverX={hoverX}
          hoverChapterTitle={hoverChapter?.title}
          chapterMarkers={chapterMarkers}
          getThumbnailAt={getThumbnailAt}
          handlePointerDown={handleProgressPointerDown}
          handlePointerMove={handleProgressPointerMove}
          handlePointerUp={handleProgressPointerUp}
          handleProgressHover={handleProgressHover}
          handleMouseLeave={handleProgressMouseLeave}
          handleProgressTouchStart={handleProgressTouchStart}
          handleProgressTouchMove={handleProgressTouchMove}
          handleProgressTouchEnd={handleProgressTouchEnd}
          handleProgressClick={handleProgressClick}
          onSeekStep={doSeek}
        />

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className={s.ytpChromeControls}>
          <ControlSlot className={s.ytpLeftControls} slot="bottom-left">
            {playControl}
            {showNextEpisodesGroup && (
              <div
                className={s.ytpNextEpisodesGroup}
                data-ytp-component="next-episodes-group"
              >
                {nextControl}
                {episodesControl}
              </div>
            )}
            {bottomLeftControls}
          </ControlSlot>

          <div className={s.ytpChromeControlsRight}>
            {showQualityBadge && resolvedQualityHeight !== null && (
              <div className={s.ytpQualityBadge} aria-hidden="true">
                {qualityBadgeLabel(resolvedQualityHeight)}
              </div>
            )}
            <ControlSlot className={s.ytpRightControls} slot="bottom-right">
              {bottomRightControls}
            </ControlSlot>
          </div>
        </div>
      </div>
    </div>
  );
}
