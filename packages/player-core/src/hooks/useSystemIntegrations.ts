import { useEffect, useRef, useState } from "react";
import { SEEK_STEP } from "../utils/format";

interface UseSystemIntegrationsParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  title?: string;
  author?: string;
  poster?: string;
  onNext?: () => void;
  isPlaying: boolean;
  duration: number;
  playbackRate: number;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  doSeek: (delta: number, dir?: "forward" | "back") => void;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useSystemIntegrations({
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
  doSeek,
  setIsPlaying,
}: UseSystemIntegrationsParams) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull =
        !!document.fullscreenElement ||
        !!(document as unknown as { webkitFullscreenElement: Element | null })
          .webkitFullscreenElement;
      setIsFullscreen(isFull);

      type OrientationExt = ScreenOrientation & {
        lock?: (o: string) => Promise<void>;
      };
      const orient = screen.orientation as OrientationExt | undefined;
      if (orient && typeof orient.lock === "function") {
        if (isFull) {
          orient.lock("landscape").catch(() => {});
        } else {
          orient.unlock();
        }
      }
    };

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
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      vid?.removeEventListener("webkitbeginfullscreen", handleVideoFullBegin);
      vid?.removeEventListener("webkitendfullscreen", handleVideoFullEnd);
    };
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("x-webkit-airplay", "allow");
    setAirPlayAvailable(
      typeof (
        video as unknown as { webkitShowPlaybackTargetPicker?: unknown }
      ).webkitShowPlaybackTargetPicker === "function",
    );
  }, [videoRef]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title ?? "",
      artist: author ?? "",
      artwork: poster ? [{ src: poster }] : undefined,
    });
  }, [author, poster, title]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlers: [MediaSessionAction, MediaSessionActionHandler | null][] = [
      [
        "play",
        () => {
          videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {});
        },
      ],
      [
        "pause",
        () => {
          videoRef.current?.pause();
          setIsPlaying(false);
        },
      ],
      ["seekforward", (d) => doSeek(d.seekOffset ?? SEEK_STEP, "forward")],
      ["seekbackward", (d) => doSeek(-(d.seekOffset ?? SEEK_STEP), "back")],
      [
        "seekto",
        (d) => {
          const video = videoRef.current;
          if (d.seekTime != null && video && isFinite(video.duration)) {
            video.currentTime = d.seekTime;
            setCurrentTime(d.seekTime);
          }
        },
      ],
      ...(onNext
        ? ([["nexttrack", onNext]] as [MediaSessionAction, MediaSessionActionHandler][])
        : []),
    ];

    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action may not be supported in all browsers.
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // Action cleanup may not be supported in all browsers.
        }
      });
    };
  }, [doSeek, onNext, setCurrentTime, setIsPlaying, videoRef]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // setPositionState is not supported in all browsers.
    }
  }, [currentTime, duration, playbackRate]);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    if (isPlaying) {
      const wakeLockRequest = navigator.wakeLock.request("screen");
      if (wakeLockRequest && typeof wakeLockRequest.then === "function") {
        wakeLockRequest
          .then((sentinel) => {
            wakeLockRef.current = sentinel;
          })
          .catch(() => {});
      }
    } else {
      const wakeLock = wakeLockRef.current;
      wakeLock?.release()?.catch(() => {});
      wakeLockRef.current = null;
    }

    return () => {
      const wakeLock = wakeLockRef.current;
      wakeLock?.release()?.catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        isPlaying &&
        !wakeLockRef.current
      ) {
        const wakeLockRequest = navigator.wakeLock.request("screen");
        if (wakeLockRequest && typeof wakeLockRequest.then === "function") {
          wakeLockRequest
            .then((sentinel) => {
              wakeLockRef.current = sentinel;
            })
            .catch(() => {});
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isPlaying]);

  return { isFullscreen, airPlayAvailable };
}
