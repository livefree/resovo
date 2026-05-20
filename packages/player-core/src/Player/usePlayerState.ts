import { useId, useRef, useState } from "react";
import { useThumbnails } from "../hooks/useThumbnails";
import type { SubtitleTrack, Panel, SeekDirection, LoadingState } from "../types";

export interface PlayerStateInitProps {
  initialVolume: number;
  startTime: number | undefined;
  defaultTheaterMode: boolean;
  activeEpisodeIndex: number;
  subtitles: SubtitleTrack[];
  thumbnailTrack: string | undefined;
}

export function usePlayerState({
  initialVolume,
  startTime,
  defaultTheaterMode,
  activeEpisodeIndex,
  subtitles,
  thumbnailTrack,
}: PlayerStateInitProps) {
  const playerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoplayContextRef = useRef<"implicit" | "user-initiated">("implicit");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const episodesButtonRef = useRef<HTMLButtonElement>(null);
  const prevOpenPanelRef = useRef<Panel | null>(null);
  const prevEpisodesOpenRef = useRef(false);

  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const speedPanelRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime ?? 0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [volume, setVolume] = useState(initialVolume);
  const [prevVolume, setPrevVolume] = useState(initialVolume);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeVisible, setVolumeVisible] = useState(false);
  const volumeTimeoutRef = useRef<number | null>(null);

  const [playbackRate, setPlaybackRate] = useState(1);

  const [activeSubId, setActiveSubId] = useState<string | null>(
    subtitles.find((sub) => sub.default)?.id ?? null,
  );
  const [subtitleCue, setSubtitleCue] = useState("");

  const [isTheater, setIsTheater] = useState(defaultTheaterMode);

  const [seekDir, setSeekDir] = useState<SeekDirection>(null);
  const seekTimerRef = useRef<number | null>(null);

  const [bezelVisible, setBezelVisible] = useState(false);
  const [bezelPaused, setBezelPaused] = useState(true);
  const bezelTimerRef = useRef<number | null>(null);

  const [showUnmute, setShowUnmute] = useState(false);

  const [videoHeight, setVideoHeight] = useState(0);

  const progressRailRef = useRef<HTMLDivElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const { getThumbnailAt } = useThumbnails(thumbnailTrack);

  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] = useState(activeEpisodeIndex);
  const episodesPanelRef = useRef<HTMLDivElement>(null);

  const [showRemaining, setShowRemaining] = useState(false);

  const sliderId = useId();
  const settingsPanelId = useId();
  const speedPanelId = useId();
  const episodesPanelId = useId();

  const doSeekRef = useRef<(delta: number, dir?: SeekDirection) => void>(() => {});

  return {
    playerRef,
    videoRef,
    autoplayContextRef,
    settingsButtonRef,
    speedButtonRef,
    episodesButtonRef,
    prevOpenPanelRef,
    prevEpisodesOpenRef,
    openPanel,
    setOpenPanel,
    settingsPanelRef,
    speedPanelRef,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    buffered,
    setBuffered,
    loadingState,
    setLoadingState,
    error,
    setError,
    volume,
    setVolume,
    prevVolume,
    setPrevVolume,
    isMuted,
    setIsMuted,
    volumeVisible,
    setVolumeVisible,
    volumeTimeoutRef,
    playbackRate,
    setPlaybackRate,
    activeSubId,
    setActiveSubId,
    subtitleCue,
    setSubtitleCue,
    isTheater,
    setIsTheater,
    seekDir,
    setSeekDir,
    seekTimerRef,
    bezelVisible,
    setBezelVisible,
    bezelPaused,
    setBezelPaused,
    bezelTimerRef,
    showUnmute,
    setShowUnmute,
    videoHeight,
    setVideoHeight,
    progressRailRef,
    progressContainerRef,
    getThumbnailAt,
    isEpisodesOpen,
    setIsEpisodesOpen,
    focusedEpisodeIndex,
    setFocusedEpisodeIndex,
    episodesPanelRef,
    showRemaining,
    setShowRemaining,
    sliderId,
    settingsPanelId,
    speedPanelId,
    episodesPanelId,
    doSeekRef,
  };
}

export type PlayerState = ReturnType<typeof usePlayerState>;
