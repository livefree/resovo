import type { Dispatch, MouseEvent as ReactMouseEvent, SetStateAction } from "react";
import { clamp, SEEK_OVERLAY_DURATION } from "../utils/format";
import type { Panel, SeekDirection, SubtitleTrack } from "../types";

interface UsePlayerActionsParams {
  // DOM refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playerRef: React.RefObject<HTMLDivElement | null>;
  progressRailRef: React.RefObject<HTMLDivElement | null>;
  // Timer refs (mutable)
  volumeTimeoutRef: { current: number | null };
  seekTimerRef: { current: number | null };
  bezelTimerRef: { current: number | null };
  autoplayContextRef: { current: "implicit" | "user-initiated" };
  // State values needed by actions
  isTheater: boolean;
  volume: number;
  prevVolume: number;
  isMuted: boolean;
  subtitles: SubtitleTrack[];
  activeSubId: string | null;
  // Setters
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  setVolume: Dispatch<SetStateAction<number>>;
  setPrevVolume: Dispatch<SetStateAction<number>>;
  setIsMuted: Dispatch<SetStateAction<boolean>>;
  setVolumeVisible: Dispatch<SetStateAction<boolean>>;
  setIsTheater: Dispatch<SetStateAction<boolean>>;
  setOpenPanel: Dispatch<SetStateAction<Panel>>;
  setSeekDir: Dispatch<SetStateAction<SeekDirection>>;
  setBezelVisible: Dispatch<SetStateAction<boolean>>;
  setBezelPaused: Dispatch<SetStateAction<boolean>>;
  setShowUnmute: Dispatch<SetStateAction<boolean>>;
  setActiveSubId: Dispatch<SetStateAction<string | null>>;
  // Prop callbacks
  onTheaterChange?: (value: boolean) => void;
  onEpisodeChange?: (index: number) => void;
  // Chrome
  revealChrome: () => void;
}

export function usePlayerActions({
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
}: UsePlayerActionsParams) {
  function showSeekOverlay(dir: SeekDirection) {
    setSeekDir(dir);
    if (seekTimerRef.current) window.clearTimeout(seekTimerRef.current);
    seekTimerRef.current = window.setTimeout(
      () => setSeekDir(null),
      SEEK_OVERLAY_DURATION,
    );
  }

  function flashBezel(paused: boolean) {
    setBezelPaused(paused);
    setBezelVisible(true);
    if (bezelTimerRef.current) window.clearTimeout(bezelTimerRef.current);
    bezelTimerRef.current = window.setTimeout(() => setBezelVisible(false), 500);
  }

  function revealVolumeSlider() {
    setVolumeVisible(true);
    if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = window.setTimeout(
      () => setVolumeVisible(false),
      1500,
    );
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    revealChrome();
    if (v.paused) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
      flashBezel(false);
    } else {
      v.pause();
      setIsPlaying(false);
      flashBezel(true);
    }
  }

  function doSeek(delta: number, dir?: SeekDirection) {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const next = clamp(v.currentTime + delta, 0, v.duration);
    v.currentTime = next;
    setCurrentTime(next);
    revealChrome();
    showSeekOverlay(dir ?? (delta > 0 ? "forward" : "back"));
  }

  function changeVolume(next: number) {
    const safe = clamp(next, 0, 1);
    setVolume(safe);
    setIsMuted(safe <= 0.001);
    setShowUnmute(false);
    if (safe > 0) setPrevVolume(safe);
    revealVolumeSlider();
    revealChrome();
  }

  function toggleMute() {
    setShowUnmute(false);
    if (isMuted || volume <= 0.001) {
      const restored = prevVolume > 0.05 ? prevVolume : 0.65;
      setIsMuted(false);
      setVolume(restored);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
    }
    revealVolumeSlider();
    revealChrome();
  }

  function toggleFullscreen() {
    const el = playerRef.current;
    const vid = videoRef.current;
    if (!el) return;

    const isCurrentlyFull =
      document.fullscreenElement === el ||
      (document as unknown as { webkitFullscreenElement: Element | null })
        .webkitFullscreenElement === el ||
      (vid as unknown as { webkitDisplayingFullscreen?: boolean })
        ?.webkitDisplayingFullscreen;

    if (isCurrentlyFull) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        (
          document as unknown as { webkitExitFullscreen?: () => void }
        ).webkitExitFullscreen?.();
      }
    } else {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          (
            vid as unknown as { webkitEnterFullscreen?: () => void }
          )?.webkitEnterFullscreen?.();
        });
      } else {
        (
          vid as unknown as { webkitEnterFullscreen?: () => void }
        )?.webkitEnterFullscreen?.();
      }
    }
    revealChrome();
  }

  function toggleTheater() {
    const newTheater = !isTheater;
    setIsTheater(newTheater);
    onTheaterChange?.(newTheater);
    setOpenPanel(null);
    revealChrome();
  }

  function cycleSubtitles() {
    if (!subtitles.length) return;
    if (!activeSubId) {
      setActiveSubId(subtitles[0]?.id ?? null);
    } else {
      const idx = subtitles.findIndex((sub) => sub.id === activeSubId);
      setActiveSubId(
        idx >= subtitles.length - 1 ? null : (subtitles[idx + 1]?.id ?? null),
      );
    }
  }

  function seekToPercent(pct: number) {
    const v = videoRef.current;
    if (!v || !isFinite(v.duration)) return;
    const next = pct * v.duration;
    v.currentTime = next;
    setCurrentTime(next);
    revealChrome();
  }

  function handleProgressClick(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = progressRailRef.current?.getBoundingClientRect();
    if (!rect) return;
    seekToPercent(clamp((event.clientX - rect.left) / rect.width, 0, 1));
  }

  function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      v.requestPictureInPicture?.();
    }
  }

  function triggerAirPlay() {
    const v = videoRef.current;
    if (!v) return;
    (
      v as unknown as { webkitShowPlaybackTargetPicker?: () => void }
    ).webkitShowPlaybackTargetPicker?.();
  }

  function handleEpisodeChange(nextIndex: number) {
    autoplayContextRef.current = "user-initiated";
    onEpisodeChange?.(nextIndex);
  }

  return {
    togglePlay,
    doSeek,
    changeVolume,
    toggleMute,
    revealVolumeSlider,
    toggleFullscreen,
    toggleTheater,
    cycleSubtitles,
    seekToPercent,
    handleProgressClick,
    togglePip,
    triggerAirPlay,
    handleEpisodeChange,
  };
}
