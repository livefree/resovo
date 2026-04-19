import { useCallback, useRef, useState } from "react";
import { clamp } from "../utils/format";

interface UseProgressInteractionsParams {
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  progressRailRef: React.RefObject<HTMLDivElement | null>;
  revealChrome: () => void;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
}

export function useProgressInteractions({
  duration,
  videoRef,
  progressRailRef,
  revealChrome,
  setCurrentTime,
}: UseProgressInteractionsParams) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const [isProgressScrubbing, setIsProgressScrubbing] = useState(false);
  const progressScrubActiveRef = useRef(false);
  const progressScrubTimeRef = useRef<number | null>(null);

  const updateProgressScrub = useCallback(
    (clientX: number) => {
      const rail = progressRailRef.current;
      if (!rail || !duration) return;
      const rect = rail.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
      const scrubTime = ratio * duration;
      progressScrubTimeRef.current = scrubTime;
      setHoverTime(scrubTime);
      setHoverX(clientX - rect.left);
    },
    [duration, progressRailRef],
  );

  const commitScrub = useCallback(() => {
    const scrubTime = progressScrubTimeRef.current;
    progressScrubTimeRef.current = null;
    const video = videoRef.current;

    if (scrubTime !== null && video && isFinite(video.duration) && video.duration > 0) {
      video.currentTime = scrubTime;
      setCurrentTime(scrubTime);
      revealChrome();
    }
  }, [revealChrome, setCurrentTime, videoRef]);

  const handleProgressHover = useCallback(
    (e: React.MouseEvent) => {
      const rail = progressRailRef.current;
      if (!rail || !duration) return;
      const rect = rail.getBoundingClientRect();
      const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      setHoverTime(ratio * duration);
      setHoverX(e.clientX - rect.left);
    },
    [duration, progressRailRef],
  );

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      progressScrubActiveRef.current = true;
      setIsProgressScrubbing(true);
      revealChrome();
      updateProgressScrub(touch.clientX);
    },
    [revealChrome, updateProgressScrub],
  );

  const handleProgressTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!progressScrubActiveRef.current) return;
      const touch = e.touches[0];
      if (!touch) return;
      updateProgressScrub(touch.clientX);
    },
    [updateProgressScrub],
  );

  const handleProgressTouchEnd = useCallback(() => {
    if (!progressScrubActiveRef.current) return;
    progressScrubActiveRef.current = false;
    setIsProgressScrubbing(false);
    commitScrub();
    setHoverTime(null);
  }, [commitScrub]);

  const handleProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      progressScrubActiveRef.current = true;
      setIsProgressScrubbing(true);
      revealChrome();
      updateProgressScrub(e.clientX);
    },
    [revealChrome, updateProgressScrub],
  );

  const handleProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || !progressScrubActiveRef.current) return;
      updateProgressScrub(e.clientX);
    },
    [updateProgressScrub],
  );

  const handleProgressPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || !progressScrubActiveRef.current) return;
      progressScrubActiveRef.current = false;
      setIsProgressScrubbing(false);
      commitScrub();
    },
    [commitScrub],
  );

  const handleProgressMouseLeave = useCallback(() => {
    if (!progressScrubActiveRef.current) setHoverTime(null);
  }, []);

  return {
    hoverTime,
    hoverX,
    isProgressScrubbing,
    progressScrubActiveRef,
    handleProgressHover,
    handleProgressTouchStart,
    handleProgressTouchMove,
    handleProgressTouchEnd,
    handleProgressPointerDown,
    handleProgressPointerMove,
    handleProgressPointerUp,
    handleProgressMouseLeave,
  };
}
