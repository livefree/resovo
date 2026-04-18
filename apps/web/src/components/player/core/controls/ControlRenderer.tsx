import type { Dispatch, MouseEvent as ReactMouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import s from "../Player.module.css";
import { HorizontalSlider } from "../components/HorizontalSlider";
import type { Panel, SubtitleTrack } from "../types";
import type { ControlId, ControlSlot } from "../hooks/useLayoutDecision";
import { formatRateBadge, formatTime } from "../utils/format";
import { YtpButton } from "../components/Button";
import {
  AirPlayIcon,
  EpisodesIcon,
  FullscreenIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PipIcon,
  PlayIcon,
  SettingsIcon,
  SpeedIcon,
  SubtitlesIcon,
  TheaterIcon,
  VolumeIcon,
} from "../components/icons";

export interface ControlRenderContext {
  // Playback
  isPlaying: boolean;
  isFullscreen: boolean;
  isTheater: boolean;
  // Time
  currentTime: number;
  duration: number;
  showRemaining: boolean;
  setShowRemaining: Dispatch<SetStateAction<boolean>>;
  // Volume
  isMuted: boolean;
  volume: number;
  effectiveVolume: number;
  volumeVisible: boolean;
  sliderId: string;
  // Speed
  playbackRate: number;
  showSpeedIcon: boolean;
  // Panel
  openPanel: Panel;
  setOpenPanel: Dispatch<SetStateAction<Panel>>;
  settingsPanelId: string;
  speedPanelId: string;
  episodesPanelId: string;
  hasSettingsContent: boolean;
  // Subtitles
  subtitles: SubtitleTrack[];
  activeSubId: string | null;
  // Chapter
  activeChapter: { title: string } | null;
  // Episodes / Next
  hasEpisodes: boolean;
  hasNext: boolean;
  isEpisodesOpen: boolean;
  // AirPlay
  airPlayAvailable: boolean;
  // Button refs (for focus-return)
  settingsButtonRef: RefObject<HTMLButtonElement | null>;
  speedButtonRef: RefObject<HTMLButtonElement | null>;
  episodesButtonRef: RefObject<HTMLButtonElement | null>;
  // Layout
  slots: Record<ControlSlot, ControlId[]>;
  // Actions
  togglePlay: () => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  toggleTheater: () => void;
  toggleEpisodes: () => void;
  togglePip: () => void;
  cycleSubtitles: () => void;
  triggerAirPlay: () => void;
  revealVolumeSlider: () => void;
  changeVolume: (next: number) => void;
  handleProgressClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onNext?: () => void;
}

function getTooltipPlacement(
  control: ControlId,
  slots: Record<ControlSlot, ControlId[]>,
): "above" | "below" {
  if (
    slots["top-left"].includes(control) ||
    slots["top-right"].includes(control)
  ) {
    return "below";
  }
  return "above";
}

export function renderControl(
  control: ControlId,
  ctx: ControlRenderContext,
): ReactNode {
  const placement = getTooltipPlacement(control, ctx.slots);

  switch (control) {
    case "play":
      return (
        <YtpButton
          key="play"
          tooltip={ctx.isPlaying ? "Pause (K)" : "Play (K)"}
          tooltipPlacement={placement}
          onClick={ctx.togglePlay}
          ariaLabel={ctx.isPlaying ? "Pause" : "Play"}
          className={s.ytpPlayButton}
          data-ytp-component="play-btn"
        >
          {ctx.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </YtpButton>
      );

    case "next":
      return ctx.hasNext ? (
        <YtpButton
          key="next"
          tooltip="Next (SHIFT+N)"
          tooltipPlacement={placement}
          ariaLabel="Next"
          onClick={ctx.onNext}
          className={s.ytpNextButton}
          data-ytp-component="next-btn"
        >
          <NextIcon />
        </YtpButton>
      ) : null;

    case "episodes": {
      if (!ctx.hasEpisodes) return null;
      const inBottomLeft = ctx.slots["bottom-left"].includes("episodes");
      return (
        <div
          key="episodes"
          className={
            inBottomLeft
              ? `${s.ytpEpisodesSlide}${ctx.hasNext && !ctx.isEpisodesOpen ? ` ${s.ytpEpisodesReveal}` : ""}`
              : ""
          }
        >
          <YtpButton
            tooltip="Episodes (E)"
            tooltipPlacement={placement}
            ariaLabel="Episodes"
            onClick={ctx.toggleEpisodes}
            className={s.ytpEpisodesButton}
            data-ytp-component="episodes-btn"
            ref={ctx.episodesButtonRef}
            aria-haspopup="dialog"
            aria-expanded={ctx.isEpisodesOpen}
            aria-controls={ctx.episodesPanelId}
          >
            <EpisodesIcon />
          </YtpButton>
        </div>
      );
    }

    case "volume":
      return (
        <span
          key="volume"
          className={`${s.ytpVolumeArea} ${ctx.volumeVisible ? s.ytpVolumeAreaExpanded : ""}`}
          data-ytp-component="volume-area"
        >
          <div className={s.ytpMuteButton}>
            <YtpButton
              tooltip={ctx.isMuted ? "Unmute (M)" : "Mute (M)"}
              tooltipPlacement={placement}
              onClick={ctx.toggleMute}
              onMouseEnter={ctx.revealVolumeSlider}
            >
              {ctx.isMuted || ctx.volume <= 0.001 ? (
                <MuteIcon />
              ) : (
                <VolumeIcon volume={ctx.volume} />
              )}
            </YtpButton>
          </div>
          <div
            className={s.ytpVolumePanel}
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(ctx.effectiveVolume * 100)}
            aria-valuetext={`${Math.round(ctx.effectiveVolume * 100)}% volume`}
            onMouseEnter={ctx.revealVolumeSlider}
          >
            <HorizontalSlider
              trackClassName={s.ytpVolumeSlider ?? ""}
              id={ctx.sliderId}
              min={0}
              max={1}
              step={0.01}
              value={ctx.effectiveVolume}
              ariaLabel="Volume"
              onChange={ctx.changeVolume}
            />
          </div>
        </span>
      );

    case "time":
      return (
        <div
          key="time"
          className={s.ytpTimeDisplay}
          onClick={() => ctx.setShowRemaining((v) => !v)}
          title={ctx.showRemaining ? "Show elapsed time" : "Show remaining time"}
          data-ytp-component="time-display"
        >
          <div className={s.ytpTimeWrapper}>
            <div className={s.ytpTimeContents}>
              <span className={s.ytpTimeCurrent}>
                {ctx.showRemaining
                  ? `-${formatTime(ctx.duration - ctx.currentTime)}`
                  : formatTime(ctx.currentTime)}
              </span>
              <span className={s.ytpTimeSeparator}> / </span>
              <span className={s.ytpTimeDuration}>{formatTime(ctx.duration)}</span>
            </div>
          </div>
        </div>
      );

    case "chapter":
      return ctx.activeChapter ? (
        <div key="chapter" className={s.ytpChapterContainer}>
          <button
            className={s.ytpChapterTitle}
            type="button"
            aria-label="Chapter"
          >
            <span className={s.ytpChapterTitlePrefix} aria-hidden="true">
              •
            </span>
            <span className={s.ytpChapterTitleContent}>
              {ctx.activeChapter.title}
            </span>
          </button>
        </div>
      ) : null;

    case "subtitles":
      return ctx.subtitles.length > 0 ? (
        <YtpButton
          key="subtitles"
          tooltip="Subtitles/closed captions (C)"
          tooltipPlacement={placement}
          onClick={ctx.cycleSubtitles}
          ariaPressed={!!ctx.activeSubId}
          data-ytp-component="subtitles-btn"
        >
          <SubtitlesIcon active={!!ctx.activeSubId} />
        </YtpButton>
      ) : null;

    case "settings":
      return (
        <YtpButton
          key="settings"
          tooltip={ctx.hasSettingsContent ? "Settings" : "Settings unavailable"}
          tooltipPlacement={placement}
          onClick={() =>
            ctx.hasSettingsContent
              ? ctx.setOpenPanel((panel) =>
                  panel === "settings" ? null : "settings",
                )
              : undefined
          }
          ariaPressed={ctx.openPanel === "settings"}
          className={[
            ctx.openPanel === "settings" ? s.ytpSettingsButtonActive : "",
            !ctx.hasSettingsContent ? s.ytpButtonDisabled : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-ytp-component="settings-btn"
          ref={ctx.settingsButtonRef}
          aria-haspopup="dialog"
          aria-expanded={ctx.openPanel === "settings"}
          aria-controls={ctx.settingsPanelId}
          disabled={!ctx.hasSettingsContent}
          aria-disabled={!ctx.hasSettingsContent}
        >
          <SettingsIcon />
        </YtpButton>
      );

    case "speed": {
      return (
        <YtpButton
          key="speed"
          tooltip={`Playback speed (${formatRateBadge(ctx.playbackRate)})`}
          tooltipPlacement={placement}
          onClick={() =>
            ctx.setOpenPanel((panel) => (panel === "speed" ? null : "speed"))
          }
          ariaPressed={ctx.openPanel === "speed"}
          ariaLabel={`Playback speed ${formatRateBadge(ctx.playbackRate)}`}
          className={[
            s.ytpSpeedButton,
            ctx.openPanel === "speed" ? s.ytpSettingsButtonActive : "",
          ]
            .filter(Boolean)
            .join(" ")}
          data-ytp-component="speed-btn"
          ref={ctx.speedButtonRef}
          aria-haspopup="dialog"
          aria-expanded={ctx.openPanel === "speed"}
          aria-controls={ctx.speedPanelId}
        >
          {ctx.showSpeedIcon ? <SpeedIcon /> : null}
          <span className={s.ytpSpeedButtonValue}>
            {formatRateBadge(ctx.playbackRate)}
          </span>
        </YtpButton>
      );
    }

    case "theater":
      return (
        <YtpButton
          key="theater"
          tooltip={ctx.isTheater ? "Default view (T)" : "Theater mode (T)"}
          tooltipPlacement={placement}
          onClick={ctx.toggleTheater}
          ariaPressed={ctx.isTheater}
          className={s.ytpTheaterButton}
          data-ytp-component="theater-btn"
        >
          <TheaterIcon active={ctx.isTheater} />
        </YtpButton>
      );

    case "airplay":
      return ctx.airPlayAvailable ? (
        <YtpButton
          key="airplay"
          tooltip="AirPlay"
          tooltipPlacement={placement}
          onClick={ctx.triggerAirPlay}
          data-ytp-component="airplay-btn"
        >
          <AirPlayIcon />
        </YtpButton>
      ) : null;

    case "pip":
      return "pictureInPictureEnabled" in document ? (
        <YtpButton
          key="pip"
          tooltip="Picture-in-picture"
          tooltipPlacement={placement}
          onClick={ctx.togglePip}
          data-ytp-component="pip-btn"
        >
          <PipIcon />
        </YtpButton>
      ) : null;

    case "fullscreen":
      return (
        <YtpButton
          key="fullscreen"
          tooltip={
            ctx.isFullscreen ? "Exit full screen (F)" : "Full screen (F)"
          }
          tooltipPlacement={placement}
          onClick={ctx.toggleFullscreen}
          ariaPressed={ctx.isFullscreen}
          data-ytp-component="fullscreen-btn"
        >
          <FullscreenIcon active={ctx.isFullscreen} />
        </YtpButton>
      );

    case "title":
      return null;

    default:
      return null;
  }
}
