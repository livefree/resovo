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
 */

import { useMemo } from "react";
import s from "./Player.module.css";
import { type PlayerProps } from "./types";
import { resolveQualityHeight } from "./utils/format";
import { usePlayerState } from "./Player/usePlayerState";
import { usePlayerEffects } from "./Player/usePlayerEffects";
import { usePlayerOrchestration } from "./Player/usePlayerOrchestration";
import { buildControlContext } from "./Player/buildControlContext";
import { PlayerOverlays } from "./Player/PlayerOverlays";
import { PlayerChromeBottom } from "./Player/PlayerChromeBottom";
import { ControlSlot } from "./components/ControlSlot";

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
  onError,
  suppressDefaultErrorUI = false,
}: PlayerProps) {
  const state = usePlayerState({
    initialVolume,
    startTime,
    defaultTheaterMode,
    activeEpisodeIndex,
    subtitles,
    thumbnailTrack,
  });

  const orch = usePlayerOrchestration(
    {
      src, qualities, activeQualityId, onQualityChange,
      subtitles, title, author, poster, chapters, onNext,
      episodes, activeEpisodeIndex, onEpisodeChange, onTheaterChange,
      startTime, autoplay, keepControlsVisible, thumbnailTrack,
      onError, suppressDefaultErrorUI,
    },
    state,
  );

  usePlayerEffects(state, subtitles, orch.hasSettingsContent);

  const {
    playerRef, videoRef,
    currentTime, setCurrentTime, duration, setDuration,
    buffered, setBuffered, loadingState, setLoadingState,
    error, setError, isPlaying, setIsPlaying,
    isMuted, setIsMuted, setShowUnmute,
    videoHeight, setVideoHeight,
    seekDir, bezelPaused, showUnmute,
    openPanel, setOpenPanel,
    isEpisodesOpen, setIsEpisodesOpen,
    episodesPanelRef, settingsPanelRef, speedPanelRef,
    episodesPanelId, settingsPanelId, speedPanelId,
    activeSubId, setActiveSubId,
    subtitleCue, showRemaining, setShowRemaining,
    sliderId, volume, playbackRate,
    volumeVisible, setPlaybackRate,
    prevVolume, setPrevVolume, setVolume, setVolumeVisible,
    focusedEpisodeIndex, setFocusedEpisodeIndex,
    progressRailRef, progressContainerRef,
    getThumbnailAt,
    settingsButtonRef, speedButtonRef, episodesButtonRef,
  } = state;

  const {
    isFullscreen, airPlayAvailable,
    hasEpisodes, hasNext, hasSettingsContent,
    layoutDecision, chromeVisible, cursorHidden, revealChrome,
    hoverTime, hoverX, isProgressScrubbing, progressScrubActiveRef,
    handleProgressHover, handleProgressTouchStart, handleProgressTouchMove,
    handleProgressTouchEnd, handleProgressPointerDown, handleProgressPointerMove,
    handleProgressPointerUp, handleProgressMouseLeave,
    retrySourceLoad, togglePlay, doSeek, changeVolume, toggleMute,
    revealVolumeSlider, toggleFullscreen, toggleTheater, cycleSubtitles,
    handleProgressClick, togglePip, triggerAirPlay, handleEpisodeChange,
    touchSeekDelta, handleTouchStart, handleTouchMove, handleTouchEnd, handleGestureClick,
    blocksGestures, overlayLayout, topOverlay, isOverlayVisible, inputRouter,
  } = orch;

  const activeQualityLabel = qualities.find((q) => q.id === activeQualityId)?.label ?? null;
  const resolvedQualityHeight = resolveQualityHeight(activeQualityLabel, videoHeight);
  const showQualityBadge =
    resolvedQualityHeight !== null && layoutDecision.panels.sizingMode === "stable";
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const displayPct =
    isProgressScrubbing && hoverTime !== null && duration > 0
      ? (hoverTime / duration) * 100
      : progressPct;

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

  const chapterMarkers = useMemo(() => {
    if (!chapters.length || !duration) return [];
    return chapters.slice(1).map((ch) => ({
      title: ch.title,
      pct: (ch.startTime / duration) * 100,
    }));
  }, [chapters, duration]);

  const toggleEpisodes = () =>
    setIsEpisodesOpen((value) => {
      if (!value) setFocusedEpisodeIndex(activeEpisodeIndex);
      return !value;
    });

  const {
    controlCtx, topControlsGap, topRightControls,
    playControl, showTimeAboveProgress, bottomLeftControls,
    bottomRightControls, centerOverlayControls, edgeRightControls,
    showCenterTouchControls, hasTopInteractiveControls,
    showNextEpisodesGroup, nextControl, episodesControl,
  } = buildControlContext({
    isPlaying, isFullscreen, isTheater: layoutDecision.mode === "fullscreen-immersive" ? false : state.isTheater,
    currentTime, duration, showRemaining, setShowRemaining,
    isMuted, volume, volumeVisible, sliderId, playbackRate,
    openPanel, setOpenPanel, settingsPanelId, speedPanelId, episodesPanelId,
    hasSettingsContent, subtitles, activeSubId, activeChapter,
    hasEpisodes, hasNext, isEpisodesOpen, airPlayAvailable,
    settingsButtonRef, speedButtonRef, episodesButtonRef,
    layoutDecision,
    togglePlay, toggleMute, changeVolume, toggleFullscreen,
    toggleTheater: () => toggleTheater(), toggleEpisodes,
    togglePip, cycleSubtitles, triggerAirPlay, revealVolumeSlider,
    handleProgressClick, onNext,
  });

  const playerClass = [
    s.moviePlayer,
    s.ytpTransparent,
    isPlaying ? s.playingMode : s.pausedMode,
    chromeVisible || keepControlsVisible ? "" : s.ytpAutohide,
    state.isTheater ? s.ytpTheater : "",
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
      data-chrome-pause-behavior={layoutDecision.chromeVisibilityPolicy.pausedBehavior}
      data-chrome-hide-delay={String(layoutDecision.chromeVisibilityPolicy.hideDelayMs)}
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
            setLoadingState((value) => (value === "initial" ? value : "buffering"))
          }
          onCanPlay={() => setLoadingState("idle")}
          onError={() => {
            if (isManagedHlsSource) return;
            setError("Video failed to load. Please try again.");
            setLoadingState("idle");
            // CHG-SN-9-PLAYER-ERROR / Opus 评审：native onError 触发外部 onError
            // src 为错误发生时刻快照（消费方不应字符串匹配做 dead 标记 / 见 PlayerErrorEvent.src jsdoc）
            onError?.({ code: "native_media_failed", src: src ?? null, fatal: true });
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

      {/* ── Layers 4 + 5: overlays, panels, touch controls ───────────────── */}
      <PlayerOverlays
        layoutDecision={layoutDecision}
        overlayLayout={overlayLayout}
        isOverlayVisible={isOverlayVisible}
        seekDir={seekDir}
        touchSeekDelta={touchSeekDelta}
        bezelPaused={bezelPaused}
        loadingState={loadingState}
        currentTime={currentTime}
        duration={duration}
        error={error}
        retrySourceLoad={retrySourceLoad}
        subtitleCue={subtitleCue}
        activeSubId={activeSubId}
        videoRef={videoRef}
        setIsMuted={setIsMuted}
        setShowUnmute={setShowUnmute}
        episodesPanelRef={episodesPanelRef}
        episodesPanelId={episodesPanelId}
        episodes={episodes}
        isEpisodesOpen={isEpisodesOpen}
        activeEpisodeIndex={activeEpisodeIndex}
        focusedEpisodeIndex={focusedEpisodeIndex}
        handleEpisodeChange={handleEpisodeChange}
        setFocusedEpisodeIndex={setFocusedEpisodeIndex}
        setIsEpisodesOpen={setIsEpisodesOpen}
        settingsPanelRef={settingsPanelRef}
        settingsPanelId={settingsPanelId}
        openPanel={openPanel}
        setOpenPanel={setOpenPanel}
        qualities={qualities}
        activeQualityId={activeQualityId}
        onQualityChange={onQualityChange}
        subtitles={subtitles}
        setActiveSubId={setActiveSubId}
        resolvedQualityHeight={resolvedQualityHeight}
        speedPanelRef={speedPanelRef}
        speedPanelId={speedPanelId}
        playbackRate={playbackRate}
        setPlaybackRate={setPlaybackRate}
        centerOverlayControls={centerOverlayControls}
        edgeRightControls={edgeRightControls}
        showCenterTouchControls={showCenterTouchControls}
        isPlaying={isPlaying}
        hasNext={hasNext}
        togglePlay={togglePlay}
        onNext={onNext}
      />

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

      {/* ── Layer 9: gradient bottom ──────────────────────────────────────── */}
      <div className={s.ytpGradientBottom} data-layer="9" aria-hidden="true" />

      {/* ── Layer 9: chrome bottom ────────────────────────────────────────── */}
      <PlayerChromeBottom
        showTimeAboveProgress={showTimeAboveProgress}
        controlCtx={controlCtx}
        progressContainerRef={progressContainerRef}
        progressRailRef={progressRailRef}
        progressScrubActiveRef={progressScrubActiveRef}
        isProgressScrubbing={isProgressScrubbing}
        duration={duration}
        currentTime={currentTime}
        bufferedPct={bufferedPct}
        displayPct={displayPct}
        hoverTime={hoverTime}
        hoverX={hoverX}
        hoverChapterTitle={hoverChapter?.title}
        chapterMarkers={chapterMarkers}
        getThumbnailAt={getThumbnailAt}
        handleProgressPointerDown={handleProgressPointerDown}
        handleProgressPointerMove={handleProgressPointerMove}
        handleProgressPointerUp={handleProgressPointerUp}
        handleProgressHover={handleProgressHover}
        handleProgressMouseLeave={handleProgressMouseLeave}
        handleProgressTouchStart={handleProgressTouchStart}
        handleProgressTouchMove={handleProgressTouchMove}
        handleProgressTouchEnd={handleProgressTouchEnd}
        handleProgressClick={handleProgressClick}
        doSeek={doSeek}
        playControl={playControl}
        showNextEpisodesGroup={showNextEpisodesGroup}
        nextControl={nextControl}
        episodesControl={episodesControl}
        bottomLeftControls={bottomLeftControls}
        showQualityBadge={showQualityBadge}
        resolvedQualityHeight={resolvedQualityHeight}
        bottomRightControls={bottomRightControls}
      />
    </div>
  );
}
