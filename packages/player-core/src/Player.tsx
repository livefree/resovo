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

import { useCallback, useEffect, useMemo, useRef } from "react";
import s from "./Player.module.css";
import { type PlayerProps, type PlayerErrorEvent, type PlayerErrorControls } from "./types";
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

  // ── CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL / ADR-166 ──────────────────────
  // wrappedOnError 拦截 player-core 内部 onError 调用（原生 video / HLS fatal），
  // 把 controls (PlayerErrorControls) 注入第 2 参后转发到外部 props.onError。
  //
  // 实现策略：
  //   - srcRef 实时反映 props.src，让 controls.retry 的"调用时刻 src 仍是触发错误的 src"守卫可读最新值
  //   - retryAttemptRef 计数 per-mount-cycle 重试次数（src 变化重置 0）/ data-retry-attempt 暴露给消费方观测（Y-166-2）
  //   - retrySourceLoadRef 延迟绑定：useSourceLoader 返回 retrySourceLoad 后由 useEffect 同步 ref / 避免 wrappedOnError ↔ orch 循环依赖
  //   - wrappedOnErrorRef.current 由 useEffect 同步：保持 wrappedOnError 闭包始终引用最新 onError / src / retrySourceLoad，
  //     再传给 orch 一个稳定 stub `(e) => wrappedOnErrorRef.current(e)` / OrchestrationProps.onError 签名保持不变
  //   - useSourceLoader.ts / usePlayerOrchestration.ts 类型保持不变（onError: (event) => void）→ PATCH ≤ 5 收敛
  const srcRef = useRef<string | null>(src ?? null);
  useEffect(() => { srcRef.current = src ?? null; }, [src]);

  const retryAttemptRef = useRef(0);
  useEffect(() => { retryAttemptRef.current = 0; }, [src]);

  const retrySourceLoadRef = useRef<() => void>(() => {});
  const wrappedOnErrorRef = useRef<(event: PlayerErrorEvent) => void>(() => {});

  const wrappedOnErrorStub = useCallback((event: PlayerErrorEvent) => {
    wrappedOnErrorRef.current(event);
  }, []);

  const orch = usePlayerOrchestration(
    {
      src, qualities, activeQualityId, onQualityChange,
      subtitles, title, author, poster, chapters, onNext,
      episodes, activeEpisodeIndex, onEpisodeChange, onTheaterChange,
      startTime, autoplay, keepControlsVisible, thumbnailTrack,
      onError: wrappedOnErrorStub, suppressDefaultErrorUI,
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

  // ── CHG-SN-9-PLAYER-ERROR-RETRY-CONTROL / ADR-166 ──────────────────────
  // 同步 retrySourceLoadRef + wrappedOnError 闭包 / 替代 useSourceLoader / orch 类型扩展
  useEffect(() => { retrySourceLoadRef.current = retrySourceLoad; }, [retrySourceLoad]);

  useEffect(() => {
    wrappedOnErrorRef.current = (event: PlayerErrorEvent) => {
      // snapshotSrc = onError 触发时刻的 src（与 event.src 一致 / 显式声明便于守卫读）
      const snapshotSrc = event.src;
      const controls: PlayerErrorControls = Object.freeze({
        retry: () => {
          // R-166-2 守卫：调用时刻 srcRef.current 若已变 → 静默 no-op + dev warn / 防作用于新 src
          if (srcRef.current !== snapshotSrc) {
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn("[player-core] controls.retry() called after src changed; no-op");
            }
            return;
          }
          // Y-166-2：retry 计数自增 + data-retry-attempt 属性暴露给消费方观测
          retryAttemptRef.current += 1;
          const v = videoRef.current;
          if (v) v.setAttribute("data-retry-attempt", String(retryAttemptRef.current));
          // R-166-3 fire-and-forget：retrySourceLoad 自身 void / 不抛错
          retrySourceLoadRef.current();
        },
      });
      onError?.(event, controls);
    };
  }, [onError, videoRef]);

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
            // ADR-166 / Wave 4 #4：走 wrappedOnError stub 转发 / controls 由 wrappedOnErrorRef 同 tick 构造注入
            // src 为错误发生时刻快照（消费方不应字符串匹配做 dead 标记 / 见 PlayerErrorEvent.src jsdoc / R-N-3）
            wrappedOnErrorStub({ code: "native_media_failed", src: src ?? null, fatal: true });
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
