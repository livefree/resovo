import { useEffect } from "react";
import {
  SEEK_STEP,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  VOLUME_STEP,
  clamp,
} from "../utils/format";

interface UseKeyboardShortcutsParams {
  volume: number;
  isEpisodesOpen: boolean;
  focusedEpisodeIndex: number;
  episodes?: Array<{ title?: string }>;
  episodesCols: number;
  activeEpisodeIndex: number;
  hasEpisodes: boolean;
  onEpisodeChange?: (index: number) => void;
  onNext?: () => void;
  togglePlay: () => void;
  doSeek: (delta: number) => void;
  changeVolume: (next: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  toggleTheater: () => void;
  cycleSubtitles: () => void;
  setPlaybackRate: React.Dispatch<React.SetStateAction<number>>;
  setFocusedEpisodeIndex: React.Dispatch<React.SetStateAction<number>>;
  setIsEpisodesOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardShortcuts({
  volume,
  isEpisodesOpen,
  focusedEpisodeIndex,
  episodes,
  episodesCols,
  activeEpisodeIndex,
  hasEpisodes,
  onEpisodeChange,
  onNext,
  togglePlay,
  doSeek,
  changeVolume,
  toggleMute,
  toggleFullscreen,
  toggleTheater,
  cycleSubtitles,
  setPlaybackRate,
  setFocusedEpisodeIndex,
  setIsEpisodesOpen,
}: UseKeyboardShortcutsParams) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const inputType = (document.activeElement as HTMLInputElement)?.type;
      if (tag === "TEXTAREA" || (tag === "INPUT" && inputType !== "range")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (isEpisodesOpen && episodes?.length) {
        const total = episodes.length;
        switch (e.key) {
          case "ArrowRight":
            e.preventDefault();
            setFocusedEpisodeIndex((i) => Math.min(i + 1, total - 1));
            return;
          case "ArrowLeft":
            e.preventDefault();
            setFocusedEpisodeIndex((i) => Math.max(i - 1, 0));
            return;
          case "ArrowDown":
            e.preventDefault();
            setFocusedEpisodeIndex((i) => Math.min(i + episodesCols, total - 1));
            return;
          case "ArrowUp":
            e.preventDefault();
            setFocusedEpisodeIndex((i) => Math.max(i - episodesCols, 0));
            return;
          case "Enter":
            e.preventDefault();
            onEpisodeChange?.(focusedEpisodeIndex);
            setIsEpisodesOpen(false);
            return;
          case "Escape":
          case "e":
          case "E":
            e.preventDefault();
            setIsEpisodesOpen(false);
            return;
          default:
            e.preventDefault();
            return;
        }
      }

      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          doSeek(-SEEK_STEP);
          break;
        case "ArrowRight":
          e.preventDefault();
          doSeek(SEEK_STEP);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(volume + VOLUME_STEP);
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(volume - VOLUME_STEP);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "t":
        case "T":
          e.preventDefault();
          toggleTheater();
          break;
        case "c":
        case "C":
          e.preventDefault();
          cycleSubtitles();
          break;
        case "N":
          if (e.shiftKey && onNext) {
            e.preventDefault();
            onNext();
          }
          break;
        case "e":
        case "E":
          if (hasEpisodes) {
            e.preventDefault();
            setIsEpisodesOpen((v) => {
              if (!v) setFocusedEpisodeIndex(activeEpisodeIndex);
              return !v;
            });
          }
          break;
        case "[":
          e.preventDefault();
          setPlaybackRate((r) => clamp(r - SPEED_STEP, SPEED_MIN, SPEED_MAX));
          break;
        case "]":
          e.preventDefault();
          setPlaybackRate((r) => clamp(r + SPEED_STEP, SPEED_MIN, SPEED_MAX));
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    activeEpisodeIndex,
    changeVolume,
    cycleSubtitles,
    doSeek,
    episodes,
    episodesCols,
    focusedEpisodeIndex,
    hasEpisodes,
    isEpisodesOpen,
    onEpisodeChange,
    onNext,
    setFocusedEpisodeIndex,
    setIsEpisodesOpen,
    setPlaybackRate,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    toggleTheater,
    volume,
  ]);
}
