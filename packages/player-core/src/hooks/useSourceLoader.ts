import { useCallback, useEffect, useRef } from "react";
import type { PlayerErrorEvent } from "../types";

interface UseSourceLoaderParams {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  autoplayContextRef: React.MutableRefObject<"implicit" | "user-initiated">;
  src?: string;
  startTime?: number;
  autoplay: boolean;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoadingState: React.Dispatch<
    React.SetStateAction<"idle" | "initial" | "buffering">
  >;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  setBuffered: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setIsMuted: React.Dispatch<React.SetStateAction<boolean>>;
  setShowUnmute: React.Dispatch<React.SetStateAction<boolean>>;
  /** CHG-SN-9-PLAYER-ERROR / Opus 评审：HLS fatal 错误时回调（与外部 PlayerProps.onError 同源） */
  onError?: (event: PlayerErrorEvent) => void;
}

export function useSourceLoader({
  videoRef,
  autoplayContextRef,
  src,
  startTime,
  autoplay,
  setError,
  setLoadingState,
  setCurrentTime,
  setDuration,
  setBuffered,
  setIsPlaying,
  setIsMuted,
  setShowUnmute,
  onError,
}: UseSourceLoaderParams) {
  const hlsRef = useRef<import("hls.js").default | null>(null);

  const destroyHls = useCallback(() => {
    if (!hlsRef.current) return;
    hlsRef.current.destroy();
    hlsRef.current = null;
  }, []);

  const doAutoplay = useCallback(
    (video: HTMLVideoElement) => {
      const autoplayContext = autoplayContextRef.current;
      autoplayContextRef.current = "implicit";

      if (startTime) video.currentTime = startTime;
      if (!autoplay) return;

      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          if (autoplayContext === "user-initiated") {
            setIsPlaying(false);
            return;
          }

          // Autoplay with sound blocked — retry muted (both iOS and desktop)
          video.muted = true;
          setIsMuted(true);
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setShowUnmute(true);
            })
            .catch(() => {});
        });
    },
    [
      autoplay,
      autoplayContextRef,
      setIsMuted,
      setIsPlaying,
      setShowUnmute,
      startTime,
    ],
  );

  const loadDirectSource = useCallback(
    (video: HTMLVideoElement, source: string) => {
      video.src = source;
      video.load();
      doAutoplay(video);
    },
    [doAutoplay],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let disposed = false;

    setError(null);
    setLoadingState("initial");
    setCurrentTime(startTime ?? 0);
    setDuration(0);
    setBuffered(0);
    setIsPlaying(false);
    setShowUnmute(false);
    video.pause();
    destroyHls();

    const isHls = src.includes(".m3u8");
    const nativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    if (isHls && !nativeHls) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;

          if (!Hls.isSupported()) {
            loadDirectSource(video, src);
            return;
          }

          const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 90 });
          hlsRef.current = hls;
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (disposed) return;
            doAutoplay(video);
          });
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (disposed || !data.fatal) return;
            setLoadingState("idle");
            setError("视频加载失败，请检查网络或刷新重试");
            // CHG-SN-9-PLAYER-ERROR / Opus 评审：HLS fatal 触发外部 onError
            // src 为错误发生时刻快照（消费方不应字符串匹配做 dead 标记 / 见 PlayerErrorEvent.src jsdoc）
            onError?.({ code: "hls_fatal", src: src ?? null, fatal: true });
          });
        })
        .catch(() => {
          if (disposed) return;
          loadDirectSource(video, src);
        });
    } else {
      loadDirectSource(video, src);
    }

    return () => {
      disposed = true;
      destroyHls();
    };
  }, [
    autoplay,
    destroyHls,
    doAutoplay,
    loadDirectSource,
    setBuffered,
    setCurrentTime,
    setDuration,
    setError,
    setLoadingState,
    setIsPlaying,
    setShowUnmute,
    src,
    startTime,
    videoRef,
    onError,
  ]);

  const retrySourceLoad = useCallback(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    setError(null);
    setLoadingState("initial");
    if (hlsRef.current) {
      hlsRef.current.startLoad(-1);
      return;
    }

    loadDirectSource(video, src);
  }, [loadDirectSource, setError, setLoadingState, src, videoRef]);

  return { retrySourceLoad };
}
