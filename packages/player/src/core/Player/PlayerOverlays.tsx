"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import s from "../Player.module.css";
import type { QualityLevel, SubtitleTrack, Panel, SeekDirection, LoadingState } from "../types";
import type { LayoutDecision } from "../hooks/useLayoutDecision";
import type { OverlayLayoutContract, OverlayKind } from "../hooks/useOverlayManager";
import { Spinner } from "../components/Spinner";
import { SeekOverlay } from "../components/SeekOverlay";
import { Bezel } from "../components/Bezel";
import { EpisodesPanel } from "../components/EpisodesPanel";
import { SettingsPanel } from "../components/SettingsPanel";
import { SpeedPanel } from "../components/SpeedPanel";
import { ControlSlot } from "../components/ControlSlot";
import { MuteIcon, PlayIcon, PauseIcon, NextIcon } from "../components/icons";
import { clamp, formatTime, SEEK_STEP } from "../utils/format";

export interface PlayerOverlaysProps {
  layoutDecision: LayoutDecision;
  overlayLayout: OverlayLayoutContract;
  isOverlayVisible: (kind: OverlayKind) => boolean;

  seekDir: SeekDirection;
  touchSeekDelta: number | null;
  bezelPaused: boolean;
  loadingState: LoadingState;
  currentTime: number;
  duration: number;
  error: string | null;
  retrySourceLoad: () => void;
  subtitleCue: string;
  activeSubId: string | null;

  videoRef: RefObject<HTMLVideoElement | null>;
  setIsMuted: Dispatch<SetStateAction<boolean>>;
  setShowUnmute: Dispatch<SetStateAction<boolean>>;

  episodesPanelRef: RefObject<HTMLDivElement | null>;
  episodesPanelId: string;
  episodes?: Array<{ title?: string }>;
  isEpisodesOpen: boolean;
  activeEpisodeIndex: number;
  focusedEpisodeIndex: number;
  handleEpisodeChange: (index: number) => void;
  setFocusedEpisodeIndex: Dispatch<SetStateAction<number>>;
  setIsEpisodesOpen: Dispatch<SetStateAction<boolean>>;

  settingsPanelRef: RefObject<HTMLDivElement | null>;
  settingsPanelId: string;
  openPanel: Panel;
  setOpenPanel: Dispatch<SetStateAction<Panel>>;
  qualities: QualityLevel[];
  activeQualityId?: string;
  onQualityChange?: (id: string) => void;
  subtitles: SubtitleTrack[];
  setActiveSubId: Dispatch<SetStateAction<string | null>>;
  resolvedQualityHeight: number | null;

  speedPanelRef: RefObject<HTMLDivElement | null>;
  speedPanelId: string;
  playbackRate: number;
  setPlaybackRate: Dispatch<SetStateAction<number>>;

  centerOverlayControls: ReactNode[];
  edgeRightControls: ReactNode[];
  showCenterTouchControls: boolean;
  isPlaying: boolean;
  hasNext: boolean;
  togglePlay: () => void;
  onNext?: () => void;
}

export function PlayerOverlays({
  layoutDecision,
  overlayLayout,
  isOverlayVisible,
  seekDir,
  touchSeekDelta,
  bezelPaused,
  loadingState,
  currentTime,
  duration,
  error,
  retrySourceLoad,
  subtitleCue,
  activeSubId,
  videoRef,
  setIsMuted,
  setShowUnmute,
  episodesPanelRef,
  episodesPanelId,
  episodes,
  isEpisodesOpen,
  activeEpisodeIndex,
  focusedEpisodeIndex,
  handleEpisodeChange,
  setFocusedEpisodeIndex,
  setIsEpisodesOpen,
  settingsPanelRef,
  settingsPanelId,
  openPanel,
  setOpenPanel,
  qualities,
  activeQualityId,
  onQualityChange,
  subtitles,
  setActiveSubId,
  resolvedQualityHeight,
  speedPanelRef,
  speedPanelId,
  playbackRate,
  setPlaybackRate,
  centerOverlayControls,
  edgeRightControls,
  showCenterTouchControls,
  isPlaying,
  hasNext,
  togglePlay,
  onNext,
}: PlayerOverlaysProps) {
  return (
    <>
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
            <button className={s.ytpErrorRetry} onClick={retrySourceLoad}>
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

      {/* ── Mobile: center play/next overlay ─────────────────────────────── */}
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
    </>
  );
}
