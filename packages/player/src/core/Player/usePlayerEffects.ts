import { useEffect } from "react";
import type { SubtitleTrack } from "../types";
import type { PlayerState } from "./usePlayerState";

export function usePlayerEffects(
  state: PlayerState,
  subtitles: SubtitleTrack[],
  hasSettingsContent: boolean,
): void {
  const {
    videoRef,
    volume, isMuted, playbackRate,
    activeSubId,
    openPanel, setOpenPanel,
    isEpisodesOpen, setIsEpisodesOpen,
    setVolume, setIsMuted, setShowUnmute, setSubtitleCue,
    settingsPanelRef, speedPanelRef, episodesPanelRef,
    settingsButtonRef, speedButtonRef, episodesButtonRef,
    prevOpenPanelRef, prevEpisodesOpenRef,
    focusedEpisodeIndex,
  } = state;

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
}
