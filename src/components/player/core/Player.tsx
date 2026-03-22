"use client";

/**
 * YTPlayer — built from YouTube's DOM architecture
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
  type CSSProperties,
  useCallback,
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
  formatRate,
  SEEK_STEP,
  VOLUME_STEP,
  SPEED_STEP,
  SPEED_PRESETS,
  CHROME_HIDE_DELAY,
  IMMERSIVE_HIDE_DELAY,
  SEEK_OVERLAY_DURATION,
  DOUBLE_TAP_THRESHOLD,
  EPISODES_COLS_SMALL,
  EPISODES_COLS_LARGE,
  EPISODES_COLS_THRESHOLD,
  THUMB_CLAMP_PX,
} from "./utils/format";
import { useThumbnails } from "./hooks/useThumbnails";
import { Spinner } from "./components/Spinner";
import { SeekOverlay } from "./components/SeekOverlay";
import { Bezel } from "./components/Bezel";
import { YtpButton } from "./components/Button";
import {
  PlayIcon,
  PauseIcon,
  MuteIcon,
  VolumeIcon,
  SettingsIcon,
  SubtitlesIcon,
  TheaterIcon,
  FullscreenIcon,
  PipIcon,
  NextIcon,
  AirPlayIcon,
  EpisodesIcon,
} from "./components/icons";

// ─── Main Component ───────────────────────────────────────────────────────────

export function YTPlayer({
  src,
  qualities = [],
  activeQualityId,
  onQualityChange,
  subtitles = [],
  poster,
  title,
  author,
  chapters = [],
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

  // ── Panels ─────────────────────────────────────────────────────────────────
  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime ?? 0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const chromeTimerRef = useRef<number | null>(null);

  // ── Seek animation (layer 4) ───────────────────────────────────────────────
  const [seekDir, setSeekDir] = useState<SeekDirection>(null);
  const seekTimerRef = useRef<number | null>(null);

  // ── Bezel (center play/pause flash) ───────────────────────────────────────
  const [bezelVisible, setBezelVisible] = useState(false);
  const [bezelPaused, setBezelPaused] = useState(true);
  const bezelTimerRef = useRef<number | null>(null);

  // ── Muted-autoplay state (shown when autoplay+sound was blocked) ───────────
  const [showUnmute, setShowUnmute] = useState(false);

  // ── Double-tap detection (mobile) ─────────────────────────────────────────
  const tapTimerRef = useRef<number | null>(null);
  const tapCountRef = useRef(0);
  const tapXRef = useRef(0);

  // ── Progress hover tooltip ────────────────────────────────────────────────
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const progressRailRef = useRef<HTMLDivElement>(null);
  const { getThumbnailAt } = useThumbnails(thumbnailTrack);
  const progressContainerRef = useRef<HTMLDivElement>(null);

  // ── Progress bar touch scrubbing ──────────────────────────────────────────
  const progressScrubActiveRef = useRef(false);
  const progressScrubTimeRef = useRef<number | null>(null);
  const [isProgressScrubbing, setIsProgressScrubbing] = useState(false);

  // ── Screen Wake Lock ──────────────────────────────────────────────────────
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // ── AirPlay ───────────────────────────────────────────────────────────────
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);

  // ── Episodes panel ────────────────────────────────────────────────────────
  const [isEpisodesOpen, setIsEpisodesOpen] = useState(false);
  const [focusedEpisodeIndex, setFocusedEpisodeIndex] =
    useState(activeEpisodeIndex);
  const episodesPanelRef = useRef<HTMLDivElement>(null);

  // ── Touch gesture state ────────────────────────────────────────────────────
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const touchGestureRef = useRef<"seek" | "volume" | "none" | null>(null);
  const [touchSeekDelta, setTouchSeekDelta] = useState<number | null>(null);

  // ── HLS.js instance (for non-native HLS browsers) ─────────────────────────
  const hlsRef = useRef<import("hls.js").default | null>(null);
  const [showRemaining, setShowRemaining] = useState(false);

  const sliderId = useId();

  // ─── Computed values ───────────────────────────────────────────────────────
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const activeChapter = useMemo(() => {
    if (!chapters.length) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      if (ch && currentTime >= ch.startTime) return ch;
    }
    return null;
  }, [chapters, currentTime]);

  // Chapter shown in the progress-bar hover tooltip — uses hoverTime (cursor
  // position), not currentTime, so it reflects where the user is pointing.
  const hoverChapter = useMemo(() => {
    if (!chapters.length || hoverTime === null) return null;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const ch = chapters[i];
      if (ch && hoverTime >= ch.startTime) return ch;
    }
    return null;
  }, [chapters, hoverTime]);

  const isImmersive = isTheater || isFullscreen;

  // Episodes: adaptive column count (≤12 → 4 cols, >12 → 6 cols)
  const hasEpisodes = (episodes?.length ?? 0) > 0;
  const episodesCols =
    (episodes?.length ?? 0) > EPISODES_COLS_THRESHOLD
      ? EPISODES_COLS_LARGE
      : EPISODES_COLS_SMALL;

  // ─── Chrome auto-hide ──────────────────────────────────────────────────────
  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    setCursorHidden(false);
    if (keepControlsVisible) return;
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(
      () => {
        // Keep chrome visible while any panel (settings or episodes) is open
        if (openPanel || isEpisodesOpen) return;
        setChromeVisible(false);
        if (isImmersive) setCursorHidden(true);
      },
      isImmersive ? IMMERSIVE_HIDE_DELAY : CHROME_HIDE_DELAY,
    );
  }, [isImmersive, openPanel, isEpisodesOpen, keepControlsVisible]);

  // Keep chrome pinned while any panel is open; restart hide-timer when all panels close
  useEffect(() => {
    if (openPanel || isEpisodesOpen) {
      setChromeVisible(true);
      if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    } else {
      revealChrome();
    }
  }, [openPanel, isEpisodesOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Fullscreen sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Standard API + webkit prefix (iOS uses webkitfullscreenchange on <video>)
      const isFull =
        !!document.fullscreenElement ||
        !!(document as unknown as { webkitFullscreenElement: Element | null })
          .webkitFullscreenElement;
      setIsFullscreen(isFull);

      // Attempt landscape lock / unlock on supported browsers (Android Chrome, etc.)
      // screen.orientation.lock is not in all TS lib targets; use type assertion.
      type OrientationExt = ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      const orient = screen.orientation as OrientationExt | undefined;
      if (orient && typeof orient.lock === "function") {
        if (isFull) {
          orient.lock("landscape").catch(() => {
            // Gracefully ignore: browser may not allow orientation lock
          });
        } else {
          orient.unlock();
        }
      }
    };

    // iOS-specific: webkitEnterFullscreen fires events on the <video> element
    const handleVideoFullBegin = () => setIsFullscreen(true);
    const handleVideoFullEnd = () => {
      setIsFullscreen(false);
      (screen.orientation as ScreenOrientation | undefined)?.unlock();

    };

    const vid = videoRef.current;
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    vid?.addEventListener("webkitbeginfullscreen", handleVideoFullBegin);
    vid?.addEventListener("webkitendfullscreen", handleVideoFullEnd);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      vid?.removeEventListener("webkitbeginfullscreen", handleVideoFullBegin);
      vid?.removeEventListener("webkitendfullscreen", handleVideoFullEnd);
    };
  }, []);

  // ─── AirPlay: detect support + set attribute ───────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // x-webkit-airplay="allow" opt-in for iOS Safari AirPlay routing
    v.setAttribute("x-webkit-airplay", "allow");
    // Check for webkitShowPlaybackTargetPicker (Safari-only AirPlay API)
    setAirPlayAvailable(
      typeof (
        v as unknown as { webkitShowPlaybackTargetPicker?: unknown }
      ).webkitShowPlaybackTargetPicker === "function",
    );
  }, []);

  // ─── Media Session: metadata ───────────────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title ?? "",
      artist: author ?? "",
      artwork: poster ? [{ src: poster }] : undefined,
    });
  }, [title, author, poster]);

  // ─── Media Session: action handlers ───────────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      [
        "play",
        () => {
          videoRef.current
            ?.play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        },
      ],
      [
        "pause",
        () => {
          videoRef.current?.pause();
          setIsPlaying(false);
        },
      ],
      [
        "seekforward",
        (d) => {
          doSeek(d.seekOffset ?? SEEK_STEP, "forward");
        },
      ],
      [
        "seekbackward",
        (d) => {
          doSeek(-(d.seekOffset ?? SEEK_STEP), "back");
        },
      ],
      [
        "seekto",
        (d) => {
          const v = videoRef.current;
          if (d.seekTime != null && v && isFinite(v.duration)) {
            v.currentTime = d.seekTime;
            setCurrentTime(d.seekTime);
          }
        },
      ],
      ...(onNext
        ? ([["nexttrack", onNext]] as [
            MediaSessionAction,
            MediaSessionActionHandler,
          ][])
        : []),
    ];
    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action may not be supported in all browsers
      }
    });
    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (_e) {
          // Action unsupported in this browser; ignore
        }
      });
    };
  }, [onNext]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Media Session: playback state sync ───────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  // ─── Media Session: position state sync ───────────────────────────────────
  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        // position must be ≤ duration; clamp to be safe
        position: Math.min(currentTime, duration),
      });
    } catch {
      // setPositionState not supported in all browsers
    }
  }, [currentTime, duration, playbackRate]);

  // ─── Screen Wake Lock: acquire / release ──────────────────────────────────
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    if (isPlaying) {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => {
          // Permission denied or not supported
        });
    } else {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isPlaying]);

  // ─── Screen Wake Lock: re-acquire after tab becomes visible ───────────────
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        isPlaying &&
        !wakeLockRef.current
      ) {
        navigator.wakeLock
          .request("screen")
          .then((sentinel) => {
            wakeLockRef.current = sentinel;
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying]);

  // ─── Video source loading ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setError(null);
    setIsLoading(true);
    setCurrentTime(startTime ?? 0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    video.pause();

    // Destroy any previous HLS instance before switching source
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const doPlay = () => {
      if (startTime) video.currentTime = startTime;
      if (autoplay) {
        video
          .play()
          .then(() => setIsPlaying(true))
          .catch(() => {
            // Autoplay with sound blocked — retry muted (both iOS and desktop)
            video.muted = true;
            setIsMuted(true);
            video
              .play()
              .then(() => {
                setIsPlaying(true);
                setShowUnmute(true); // prompt user to unmute
              })
              .catch(() => {}); // still blocked (low-power mode etc.); ignore
          });
      }
    };

    const isHls = src.includes(".m3u8");
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    if (isHls && !nativeHls) {
      // Non-Safari browser: use HLS.js for m3u8 streams
      import("hls.js").then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          // Unlikely, but fall back to direct assignment
          video.src = src;
          video.load();
          doPlay();
          return;
        }
        const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 90 });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, doPlay);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError("视频加载失败，请检查网络或刷新重试");
        });
      });
    } else {
      // Safari (native HLS) or non-HLS source
      video.src = src;
      video.load();
      doPlay();
    }
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── HLS cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  // ─── Volume & rate sync ────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = isMuted;
  }, [volume, isMuted]);

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

  // ─── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag       = (document.activeElement as HTMLElement)?.tagName;
      const inputType = (document.activeElement as HTMLInputElement)?.type;
      // Block shortcuts when typing in text fields, but allow them when the
      // volume slider (type="range") is focused so M / arrows keep working.
      if (tag === "TEXTAREA" || (tag === "INPUT" && inputType !== "range")) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // ── Episodes panel keyboard intercept (captures all keys when open) ──────
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
            setFocusedEpisodeIndex((i) =>
              Math.min(i + episodesCols, total - 1),
            );
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
            e.preventDefault(); // block all other shortcuts while panel is open
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
          setPlaybackRate((r) => clamp(r - SPEED_STEP, 0.25, 2));
          break;
        case "]":
          e.preventDefault();
          setPlaybackRate((r) => clamp(r + SPEED_STEP, 0.25, 2));
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [volume, isMuted, prevVolume, subtitles, activeSubId, onNext, isEpisodesOpen, focusedEpisodeIndex, episodes, activeEpisodeIndex, onEpisodeChange, hasEpisodes, episodesCols]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Outside-click to close panels ────────────────────────────────────────
  useEffect(() => {
    if (!openPanel) return;
    const onDown = (e: MouseEvent) => {
      if (!settingsPanelRef.current?.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [openPanel]);

  // ─── Outside-click to close episodes panel ─────────────────────────────────
  useEffect(() => {
    if (!isEpisodesOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Exclude the Episodes button itself — its onClick handles the toggle
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

  // ─── Actions ───────────────────────────────────────────────────────────────
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
    const direction = dir ?? (delta > 0 ? "forward" : "back");
    showSeekOverlay(direction);
  }

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
    bezelTimerRef.current = window.setTimeout(
      () => setBezelVisible(false),
      500,
    );
  }

  function changeVolume(next: number) {
    const safe = clamp(next, 0, 1);
    setVolume(safe);
    setIsMuted(safe <= 0.001);
    if (safe > 0) setPrevVolume(safe);
    revealVolumeSlider();
    revealChrome();
  }

  function toggleMute() {
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

  function revealVolumeSlider() {
    setVolumeVisible(true);
    if (volumeTimeoutRef.current) window.clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = window.setTimeout(
      () => setVolumeVisible(false),
      1500,
    );
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
      // Exit: standard → webkit prefix fallback
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else {
        (
          document as unknown as {
            webkitExitFullscreen?: () => void;
          }
        ).webkitExitFullscreen?.();
      }
    } else {
      // Enter: standard API first; on iOS Safari it throws, so fall back to
      // video.webkitEnterFullscreen() which triggers the native iOS player.
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {
          // Likely iOS Safari — fall back to native video fullscreen
          (
            vid as unknown as {
              webkitEnterFullscreen?: () => void;
            }
          )?.webkitEnterFullscreen?.();
        });
      } else {
        (
          vid as unknown as {
            webkitEnterFullscreen?: () => void;
          }
        )?.webkitEnterFullscreen?.();
      }
    }
    revealChrome();
  }

  function toggleTheater() {
    setIsTheater((v) => {
      onTheaterChange?.(!v);
      return !v;
    });
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

  function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      v.requestPictureInPicture?.();
    }
  }

  // ─── Touch handlers ────────────────────────────────────────────────────────
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0]?.clientX ?? 0,
      y: e.touches[0]?.clientY ?? 0,
      time: Date.now(),
    };
    touchGestureRef.current = null;
    tapXRef.current = e.touches[0]?.clientX ?? 0;
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (!touchGestureRef.current) {
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
        touchGestureRef.current = "seek";
      } else if (Math.abs(dy) > 12) {
        const rect = playerRef.current?.getBoundingClientRect();
        touchGestureRef.current =
          rect && touch.clientX > rect.left + rect.width / 2
            ? "volume"
            : "none";
      }
    }

    if (touchGestureRef.current === "seek") {
      const delta = clamp(dx / 8, -120, 120);
      setTouchSeekDelta(delta);
      e.preventDefault();
    }

    if (touchGestureRef.current === "volume") {
      changeVolume(volume - dy / 150);
      touchStartRef.current = {
        ...touchStartRef.current,
        y: touch.clientY,
      };
    }
  }

  function handleTouchEnd() {
    if (touchGestureRef.current === "seek" && touchSeekDelta !== null) {
      doSeek(touchSeekDelta, touchSeekDelta > 0 ? "forward" : "back");
      setTouchSeekDelta(null);
    }
    touchStartRef.current = null;
    touchGestureRef.current = null;
  }

  // ─── Gesture layer click (single/double tap) ───────────────────────────────
  function handleGestureClick(e: React.MouseEvent) {
    // On touch devices: if controls are hidden, the first tap should only
    // reveal chrome without toggling play. This prevents accidental play/pause
    // when the user is simply trying to see the controls.
    if (!chromeVisible && !keepControlsVisible) {
      revealChrome();
      return;
    }

    tapCountRef.current += 1;
    tapXRef.current = e.clientX;

    if (tapCountRef.current === 1) {
      tapTimerRef.current = window.setTimeout(() => {
        tapCountRef.current = 0;
        togglePlay();
      }, DOUBLE_TAP_THRESHOLD);
    } else {
      if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
      tapCountRef.current = 0;
      const rect = playerRef.current?.getBoundingClientRect();
      if (rect) {
        const isRight = tapXRef.current > rect.left + rect.width / 2;
        doSeek(isRight ? SEEK_STEP : -SEEK_STEP, isRight ? "forward" : "back");
      }
    }
  }

  // ─── Progress bar hover ────────────────────────────────────────────────────
  function handleProgressHover(e: React.MouseEvent) {
    const rail = progressRailRef.current;
    if (!rail || !duration) return;
    const rect = rail.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    setHoverTime(ratio * duration);
    setHoverX(e.clientX - rect.left);
  }

  // ─── Progress bar scrubbing (mouse + touch) ────────────────────────────────
  function updateProgressScrub(clientX: number) {
    const rail = progressRailRef.current;
    if (!rail || !duration) return;
    const rect = rail.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const scrubTime = ratio * duration;
    progressScrubTimeRef.current = scrubTime;
    setHoverTime(scrubTime);
    setHoverX(clientX - rect.left);
  }

  function handleProgressTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    if (!touch) return;
    progressScrubActiveRef.current = true;
    setIsProgressScrubbing(true);
    revealChrome();
    updateProgressScrub(touch.clientX);
  }

  function handleProgressTouchMove(e: React.TouchEvent) {
    if (!progressScrubActiveRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    updateProgressScrub(touch.clientX);
  }

  function handleProgressTouchEnd() {
    if (!progressScrubActiveRef.current) return;
    progressScrubActiveRef.current = false;
    setIsProgressScrubbing(false);
    const scrubTime = progressScrubTimeRef.current;
    progressScrubTimeRef.current = null;
    const v = videoRef.current;
    if (scrubTime !== null && v && isFinite(v.duration) && v.duration > 0) {
      v.currentTime = scrubTime;
      setCurrentTime(scrubTime);
      revealChrome();
    }
    setHoverTime(null);
  }

  // Mouse-drag scrubbing via Pointer Events API.
  // setPointerCapture keeps events flowing to the rail even when the cursor
  // moves outside the element, mirroring the touch handler behaviour above.
  function handleProgressPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    progressScrubActiveRef.current = true;
    setIsProgressScrubbing(true);
    revealChrome();
    updateProgressScrub(e.clientX);
  }

  function handleProgressPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !progressScrubActiveRef.current) return;
    updateProgressScrub(e.clientX);
  }

  function handleProgressPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || !progressScrubActiveRef.current) return;
    progressScrubActiveRef.current = false;
    setIsProgressScrubbing(false);
    const scrubTime = progressScrubTimeRef.current;
    progressScrubTimeRef.current = null;
    const v = videoRef.current;
    if (scrubTime !== null && v && isFinite(v.duration) && v.duration > 0) {
      v.currentTime = scrubTime;
      setCurrentTime(scrubTime);
      revealChrome();
    }
  }

  // ─── AirPlay ───────────────────────────────────────────────────────────────
  function triggerAirPlay() {
    const v = videoRef.current;
    if (!v) return;
    (
      v as unknown as { webkitShowPlaybackTargetPicker?: () => void }
    ).webkitShowPlaybackTargetPicker?.();
  }

  // ─── Chapter markers ──────────────────────────────────────────────────────
  const chapterMarkers = useMemo(() => {
    if (!chapters.length || !duration) return [];
    return chapters.slice(1).map((ch) => ({
      title: ch.title,
      pct: (ch.startTime / duration) * 100,
    }));
  }, [chapters, duration]);

  // ─── Scrubber display position (preview during touch scrub) ──────────────
  // During touch scrubbing hoverTime holds the preview position; use it so the
  // scrubber thumb and played bar follow the finger, not the media clock.
  const displayPct =
    isProgressScrubbing && hoverTime !== null && duration > 0
      ? (hoverTime / duration) * 100
      : progressPct;

  // ─── Render ────────────────────────────────────────────────────────────────
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

  const effectiveVolume = isMuted ? 0 : volume;

  return (
    <div
      ref={playerRef}
      className={playerClass}
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
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration);
            setIsLoading(false);
            if (startTime) v.currentTime = startTime;
          }}
          onTimeUpdate={(e) => {
            const v = e.currentTarget;
            setCurrentTime(v.currentTime);
            onTimeUpdate?.(v.currentTime, v.duration);
          }}
          onProgress={(e) => {
            const b = e.currentTarget.buffered;
            if (b.length > 0) setBuffered(b.end(b.length - 1));
          }}
          onWaiting={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          onError={() => {
            setError("Video failed to load. Please try again.");
            setIsLoading(false);
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
      {(title || author) && (
        <div className={s.ytpChromeTop} data-layer="1">
          <div className={s.ytpTitle}>
            <div className={s.ytpTitleText}>
              {title && <span className={s.ytpTitleLink}>{title}</span>}
              {author && <div className={s.ytpTitleSubtext}>{author}</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── Layer 2: muted-autoplay unmute prompt ─────────────────────────── */}
      {showUnmute && (
        <div className={s.ytpUnmutePrompt} data-layer="2">
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
      <Spinner visible={isLoading} />

      {/* ── Layer 4: seek overlay animation ──────────────────────────────── */}
      <SeekOverlay direction={seekDir} seconds={SEEK_STEP} />

      {/* ── Layer 4: bezel (center flash) ────────────────────────────────── */}
      <Bezel visible={bezelVisible} paused={bezelPaused} />

      {/* ── Layer 4: touch seek indicator ────────────────────────────────── */}
      {touchSeekDelta !== null && (
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
      {error && (
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
                setError(null);
                if (videoRef.current && src) {
                  if (hlsRef.current) {
                    // HLS mode: restart loading from beginning
                    hlsRef.current.startLoad(-1);
                  } else {
                    videoRef.current.src = src;
                    videoRef.current.load();
                  }
                }
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Layer 4: subtitle cue ─────────────────────────────────────────── */}
      {subtitleCue && activeSubId && (
        <div
          className={`${s.ytpCaptionsWindow} ${chromeVisible ? s.ytpCaptionsWindowAbove : ""}`}
          data-layer="4"
          aria-live="polite"
        >
          <span
            className={s.ytpCaptionSegment}
            dangerouslySetInnerHTML={{ __html: subtitleCue }}
          />
        </div>
      )}

      {/* ── Layer 5: episodes panel (bottom-left, desktop only) ───────────── */}
      {isEpisodesOpen && hasEpisodes && (
        <div
          ref={episodesPanelRef}
          className={s.ytpEpisodesPanel}
          data-layer="5"
          role="dialog"
          aria-label="Episodes"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            className={s.ytpEpisodesGrid}
            role="listbox"
            style={
              { "--_ep-cols": episodesCols } as CSSProperties
            }
          >
            {episodes!.map((_, i) => (
              <button
                key={i}
                role="option"
                aria-selected={i === activeEpisodeIndex}
                className={`${s.ytpEpisodeItem}${i === activeEpisodeIndex ? ` ${s.ytpEpisodeActive}` : ""}${i === focusedEpisodeIndex ? ` ${s.ytpEpisodeFocused}` : ""}`}
                data-ep-focused={i === focusedEpisodeIndex ? "" : undefined}
                onClick={() => {
                  onEpisodeChange?.(i);
                  setIsEpisodesOpen(false);
                }}
                onMouseEnter={() => setFocusedEpisodeIndex(i)}
              >
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Layer 5: settings panel ───────────────────────────────────────── */}
      {openPanel && (
        <div
          ref={settingsPanelRef}
          className={`${s.ytpSettingsMenu} ${s.ytpPopup}`}
          data-layer="5"
          role="dialog"
          aria-label="Settings"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className={s.ytpFocusTrap} tabIndex={0} />
          <div className={s.ytpPanelMenu} role="menu">
            {/* Main settings panel */}
            {openPanel === "settings" && (
              <>
                {qualities.length > 0 && (
                  <div
                    className={s.ytpMenuItem}
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setOpenPanel("quality")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setOpenPanel("quality")
                    }
                  >
                    <span className={s.ytpMenuItemLabel}>Quality</span>
                    <span className={s.ytpMenuItemValue}>
                      {qualities.find((q) => q.id === activeQualityId)?.label ??
                        "Auto"}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      className={s.ytpMenuChevron}
                    >
                      <path
                        d="M9.71 18.71l-1.42-1.42 5.3-5.29-5.3-5.29 1.42-1.42 6.7 6.71z"
                        fill="white"
                      />
                    </svg>
                  </div>
                )}
                {subtitles.length > 0 && (
                  <div
                    className={s.ytpMenuItem}
                    role="menuitem"
                    tabIndex={0}
                    onClick={() => setOpenPanel("subtitles")}
                    onKeyDown={(e) =>
                      e.key === "Enter" && setOpenPanel("subtitles")
                    }
                  >
                    <span className={s.ytpMenuItemLabel}>Subtitles/CC</span>
                    <span className={s.ytpMenuItemValue}>
                      {activeSubId
                        ? subtitles.find((sub) => sub.id === activeSubId)?.label
                        : "Off"}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      className={s.ytpMenuChevron}
                    >
                      <path
                        d="M9.71 18.71l-1.42-1.42 5.3-5.29-5.3-5.29 1.42-1.42 6.7 6.71z"
                        fill="white"
                      />
                    </svg>
                  </div>
                )}
                <div
                  className={s.ytpMenuItem}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setOpenPanel("speed")}
                  onKeyDown={(e) => e.key === "Enter" && setOpenPanel("speed")}
                >
                  <span className={s.ytpMenuItemLabel}>Playback speed</span>
                  <span className={s.ytpMenuItemValue}>
                    {formatRate(playbackRate)}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    className={s.ytpMenuChevron}
                  >
                    <path
                      d="M9.71 18.71l-1.42-1.42 5.3-5.29-5.3-5.29 1.42-1.42 6.7 6.71z"
                      fill="white"
                    />
                  </svg>
                </div>
              </>
            )}

            {/* Quality sub-panel */}
            {openPanel === "quality" && (
              <>
                <div
                  className={s.ytpMenuHeader}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setOpenPanel("settings")}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setOpenPanel("settings")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    className={s.ytpMenuBack}
                  >
                    <path
                      d="M14.29 5.29L12.88 3.88 5.76 11l7.12 7.12 1.41-1.41L8.58 11z"
                      fill="white"
                    />
                  </svg>
                  <span>Quality</span>
                </div>
                {qualities.map((q) => (
                  <div
                    key={q.id}
                    className={`${s.ytpMenuItem} ${q.id === activeQualityId ? s.ytpMenuItemActive : ""}`}
                    role="menuitemradio"
                    aria-checked={q.id === activeQualityId}
                    tabIndex={0}
                    onClick={() => {
                      onQualityChange?.(q.id);
                      setOpenPanel("settings");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (onQualityChange?.(q.id), setOpenPanel("settings"))
                    }
                  >
                    {q.id === activeQualityId && (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                        className={s.ytpMenuCheck}
                      >
                        <path
                          d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                          fill="white"
                        />
                      </svg>
                    )}
                    <span className={s.ytpMenuItemLabel}>{q.label}</span>
                  </div>
                ))}
              </>
            )}

            {/* Subtitles sub-panel */}
            {openPanel === "subtitles" && (
              <>
                <div
                  className={s.ytpMenuHeader}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setOpenPanel("settings")}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setOpenPanel("settings")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    className={s.ytpMenuBack}
                  >
                    <path
                      d="M14.29 5.29L12.88 3.88 5.76 11l7.12 7.12 1.41-1.41L8.58 11z"
                      fill="white"
                    />
                  </svg>
                  <span>Subtitles/CC</span>
                </div>
                <div
                  className={`${s.ytpMenuItem} ${!activeSubId ? s.ytpMenuItemActive : ""}`}
                  role="menuitemradio"
                  aria-checked={!activeSubId}
                  tabIndex={0}
                  onClick={() => {
                    setActiveSubId(null);
                    setOpenPanel("settings");
                  }}
                  onKeyDown={(e) =>
                    e.key === "Enter" &&
                    (setActiveSubId(null), setOpenPanel("settings"))
                  }
                >
                  {!activeSubId && (
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                      className={s.ytpMenuCheck}
                    >
                      <path
                        d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                        fill="white"
                      />
                    </svg>
                  )}
                  <span className={s.ytpMenuItemLabel}>Off</span>
                </div>
                {subtitles.map((sub) => (
                  <div
                    key={sub.id}
                    className={`${s.ytpMenuItem} ${sub.id === activeSubId ? s.ytpMenuItemActive : ""}`}
                    role="menuitemradio"
                    aria-checked={sub.id === activeSubId}
                    tabIndex={0}
                    onClick={() => {
                      setActiveSubId(sub.id);
                      setOpenPanel("settings");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (setActiveSubId(sub.id), setOpenPanel("settings"))
                    }
                  >
                    {sub.id === activeSubId && (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                        className={s.ytpMenuCheck}
                      >
                        <path
                          d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                          fill="white"
                        />
                      </svg>
                    )}
                    <span className={s.ytpMenuItemLabel}>{sub.label}</span>
                  </div>
                ))}
              </>
            )}

            {/* Speed sub-panel */}
            {openPanel === "speed" && (
              <>
                <div
                  className={s.ytpMenuHeader}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => setOpenPanel("settings")}
                  onKeyDown={(e) =>
                    e.key === "Enter" && setOpenPanel("settings")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    aria-hidden="true"
                    className={s.ytpMenuBack}
                  >
                    <path
                      d="M14.29 5.29L12.88 3.88 5.76 11l7.12 7.12 1.41-1.41L8.58 11z"
                      fill="white"
                    />
                  </svg>
                  <span>Playback speed</span>
                </div>
                {SPEED_PRESETS.map((rate) => (
                  <div
                    key={rate}
                    className={`${s.ytpMenuItem} ${Math.abs(playbackRate - rate) < 0.01 ? s.ytpMenuItemActive : ""}`}
                    role="menuitemradio"
                    aria-checked={Math.abs(playbackRate - rate) < 0.01}
                    tabIndex={0}
                    onClick={() => {
                      setPlaybackRate(rate);
                      setOpenPanel("settings");
                    }}
                    onKeyDown={(e) =>
                      e.key === "Enter" &&
                      (setPlaybackRate(rate), setOpenPanel("settings"))
                    }
                  >
                    {Math.abs(playbackRate - rate) < 0.01 && (
                      <svg
                        viewBox="0 0 24 24"
                        width="16"
                        height="16"
                        aria-hidden="true"
                        className={s.ytpMenuCheck}
                      >
                        <path
                          d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                          fill="white"
                        />
                      </svg>
                    )}
                    <span className={s.ytpMenuItemLabel}>
                      {formatRate(rate)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
          <div className={s.ytpFocusTrap} tabIndex={0} />
        </div>
      )}

      {/* ── Layer 9: gradient bottom ──────────────────────────────────────── */}
      <div className={s.ytpGradientBottom} data-layer="9" aria-hidden="true" />

      {/* ── Layer 3: gesture layer (click / touch) ────────────────────────── */}
      <div
        className={s.ytpGestureLayer}
        data-layer="3"
        aria-hidden="true"
        onClick={handleGestureClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* ── Layer 9: chrome bottom ────────────────────────────────────────── */}
      <div className={s.ytpChromeBottom} data-layer="9">
        {/* ── Progress bar container ──────────────────────────────────────── */}
        <div
          ref={progressContainerRef}
          className={`${s.ytpProgressBarContainer} ${isProgressScrubbing ? s.ytpProgressBarScrubbing : ""}`}
          data-ytp-component="progress-bar"
          onTouchStart={handleProgressTouchStart}
          onTouchMove={handleProgressTouchMove}
          onTouchEnd={handleProgressTouchEnd}
        >
          <div
            ref={progressRailRef}
            className={s.ytpProgressBar}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={handleProgressPointerUp}
            onPointerCancel={handleProgressPointerUp}
            onMouseMove={handleProgressHover}
            onMouseLeave={() => {
              if (!progressScrubActiveRef.current) setHoverTime(null);
            }}
            onClick={(e) => {
              // Skip if a pointer-drag just ended (pointerUp already seeked)
              if (progressScrubActiveRef.current) return;
              const rect = progressRailRef.current?.getBoundingClientRect();
              if (!rect) return;
              seekToPercent(clamp((e.clientX - rect.left) / rect.width, 0, 1));
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") doSeek(-SEEK_STEP);
              if (e.key === "ArrowRight") doSeek(SEEK_STEP);
            }}
          >
            <div className={s.ytpChaptersContainer}>
              <div className={s.ytpChapterHoverContainer}>
                <div className={s.ytpProgressBarPadding} />
                <div className={s.ytpProgressList}>
                  {/* Buffered */}
                  <div
                    className={s.ytpLoadProgress}
                    style={{ transform: `scaleX(${bufferedPct / 100})` }}
                  />
                  {/* Played — follows finger during touch scrubbing */}
                  <div
                    className={s.ytpPlayProgress}
                    style={{ transform: `scaleX(${displayPct / 100})` }}
                  />
                  {/* Hover ghost */}
                  {hoverTime !== null && (
                    <div
                      className={s.ytpHoverProgress}
                      style={{
                        transform: `scaleX(${hoverX / (progressRailRef.current?.clientWidth ?? 1)})`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Chapter markers */}
            {chapterMarkers.map((ch) => (
              <div
                key={ch.title}
                className={s.ytpChapterMarker}
                style={{ left: `${ch.pct}%` }}
                title={ch.title}
              />
            ))}

            {/* Scrubber thumb — follows finger during touch scrubbing */}
            <div
              className={s.ytpScrubberContainer}
              style={{ left: `${displayPct}%` }}
            >
              <div className={s.ytpScrubberButton} />
            </div>

            {/* Hover time tooltip (+ optional thumbnail) */}
            {hoverTime !== null && (() => {
              const thumb = getThumbnailAt(hoverTime);
              const railW = progressRailRef.current?.clientWidth ?? 300;
              const clampPx = thumb ? THUMB_CLAMP_PX : 40;
              return (
                <div
                  className={s.ytpProgressTooltipWrap}
                  style={{ left: `${clamp(hoverX, clampPx, railW - clampPx)}px` }}
                >
                  {thumb && (
                    <div className={s.ytpThumbnailPreview}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumb.url}
                        className={s.ytpThumbnailImg}
                        alt=""
                        draggable={false}
                        style={
                          thumb.x !== undefined
                            ? {
                                objectFit: "none",
                                objectPosition: `-${thumb.x}px -${thumb.y}px`,
                                width: thumb.w,
                                height: thumb.h,
                              }
                            : undefined
                        }
                      />
                    </div>
                  )}
                  <div className={s.ytpTooltipProgressBar}>
                    <div className={s.ytpTooltipProgressText}>
                      {formatTime(hoverTime)}
                    </div>
                    {hoverChapter && (
                      <div className={s.ytpTooltipChapterTitle}>
                        {hoverChapter.title}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── Controls ───────────────────────────────────────────────────── */}
        <div className={s.ytpChromeControls}>
          {/* Left controls */}
          <div className={s.ytpLeftControls}>
            {/* Play/Pause */}
            <YtpButton
              tooltip={isPlaying ? "Pause (K)" : "Play (K)"}
              onClick={togglePlay}
              ariaLabel={isPlaying ? "Pause" : "Play"}
              className={s.ytpPlayButton}
              data-ytp-component="play-btn"
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </YtpButton>

            {/* ── Next + Episodes group ─────────────────────────────────── */}
            {(onNext || hasEpisodes) && (
              <div className={s.ytpNextEpisodesGroup}>
                {/* Next — only shown when caller provides onNext */}
                {onNext && (
                  <YtpButton
                    tooltip="Next (SHIFT+N)"
                    ariaLabel="Next"
                    onClick={onNext}
                    className={s.ytpNextButton}
                    data-ytp-component="next-btn"
                  >
                    <NextIcon />
                  </YtpButton>
                )}
                {/* Episodes — slide wrapper mirrors the volume-slider reveal mechanism */}
                {hasEpisodes && (
                  <div
                    className={`${s.ytpEpisodesSlide}${onNext && !isEpisodesOpen ? ` ${s.ytpEpisodesReveal}` : ""}`}
                  >
                    <YtpButton
                      tooltip="Episodes (E)"
                      ariaLabel="Episodes"
                      onClick={() =>
                        setIsEpisodesOpen((v) => {
                          if (!v) setFocusedEpisodeIndex(activeEpisodeIndex);
                          return !v;
                        })
                      }
                      className={s.ytpEpisodesButton}
                      data-ytp-component="episodes-btn"
                    >
                      <EpisodesIcon />
                    </YtpButton>
                  </div>
                )}
              </div>
            )}

            {/* Volume area — CSS hides on pointer:coarse (mobile system handles volume) */}
            <span
              className={`${s.ytpVolumeArea} ${volumeVisible ? s.ytpVolumeAreaExpanded : ""}`}
              data-ytp-component="volume-area"
            >
              <div className={s.ytpMuteButton}>
                <YtpButton
                  tooltip={isMuted ? "Unmute (M)" : "Mute (M)"}
                  onClick={toggleMute}
                  onMouseEnter={revealVolumeSlider}
                >
                  {isMuted || volume <= 0.001 ? (
                    <MuteIcon />
                  ) : (
                    <VolumeIcon volume={volume} />
                  )}
                </YtpButton>
              </div>
              <div
                className={s.ytpVolumePanel}
                role="slider"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(effectiveVolume * 100)}
                aria-valuetext={`${Math.round(effectiveVolume * 100)}% volume`}
                onMouseEnter={revealVolumeSlider}
              >
                <div className={s.ytpVolumeSlider}>
                  <input
                    id={sliderId}
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={effectiveVolume}
                    className={s.ytpVolumeInput}
                    onChange={(e) =>
                      changeVolume(Number(e.currentTarget.value))
                    }
                    aria-label="Volume"
                  />
                  <div
                    className={s.ytpVolumeSliderFill}
                    style={{ width: `${effectiveVolume * 100}%` }}
                  />
                  <div
                    className={s.ytpVolumeSliderHandle}
                    style={{ left: `${effectiveVolume * 100}%` }}
                  />
                </div>
              </div>
            </span>

            {/* Time display — click to toggle elapsed / remaining */}
            <div
              className={s.ytpTimeDisplay}
              onClick={() => setShowRemaining((v) => !v)}
              title={showRemaining ? "Show elapsed time" : "Show remaining time"}
              data-ytp-component="time-display"
            >
              <div className={s.ytpTimeWrapper}>
                <div className={s.ytpTimeContents}>
                  <span className={s.ytpTimeCurrent}>
                    {showRemaining
                      ? `-${formatTime(duration - currentTime)}`
                      : formatTime(currentTime)}
                  </span>
                  <span className={s.ytpTimeSeparator}> / </span>
                  <span className={s.ytpTimeDuration}>
                    {formatTime(duration)}
                  </span>
                </div>
              </div>
            </div>

            {/* Chapter title */}
            {activeChapter && (
              <div className={s.ytpChapterContainer}>
                <button
                  className={s.ytpChapterTitle}
                  type="button"
                  aria-label="Chapter"
                >
                  <span className={s.ytpChapterTitlePrefix} aria-hidden="true">
                    •
                  </span>
                  <span className={s.ytpChapterTitleContent}>
                    {activeChapter.title}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Right controls */}
          <div className={s.ytpRightControls} data-ytp-component="right-controls">
            <div className={s.ytpRightControlsLeft}>
              {/* Subtitles */}
              {subtitles.length > 0 && (
                <YtpButton
                  tooltip="Subtitles/closed captions (C)"
                  onClick={cycleSubtitles}
                  ariaPressed={!!activeSubId}
                >
                  <SubtitlesIcon active={!!activeSubId} />
                </YtpButton>
              )}

              {/* Settings */}
              <YtpButton
                tooltip="Settings"
                onClick={() => setOpenPanel((p) => (p ? null : "settings"))}
                ariaPressed={!!openPanel}
                className={openPanel ? s.ytpSettingsButtonActive : ""}
              >
                <SettingsIcon />
              </YtpButton>
            </div>

            <div className={s.ytpRightControlsRight}>
              {/* Theater mode — hidden in fullscreen and on touch devices (CSS) */}
              {!isFullscreen && (
                <YtpButton
                  tooltip={isTheater ? "Default view (T)" : "Theater mode (T)"}
                  onClick={toggleTheater}
                  ariaPressed={isTheater}
                  className={s.ytpTheaterButton}
                >
                  <TheaterIcon active={isTheater} />
                </YtpButton>
              )}

              {/* AirPlay — iOS Safari only */}
              {airPlayAvailable && (
                <YtpButton tooltip="AirPlay" onClick={triggerAirPlay}>
                  <AirPlayIcon />
                </YtpButton>
              )}

              {/* PiP */}
              {"pictureInPictureEnabled" in document && (
                <YtpButton tooltip="Picture-in-picture" onClick={togglePip}>
                  <PipIcon />
                </YtpButton>
              )}

              {/* Fullscreen */}
              <YtpButton
                tooltip={
                  isFullscreen ? "Exit full screen (F)" : "Full screen (F)"
                }
                onClick={toggleFullscreen}
                ariaPressed={isFullscreen}
              >
                <FullscreenIcon active={isFullscreen} />
              </YtpButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
