import { useCallback, useRef, useState } from "react";
import { DOUBLE_TAP_THRESHOLD, SEEK_STEP, clamp } from "../utils/format";
import { type SeekDirection } from "../types";
import type { InputIntent } from "./useInputRouter";

interface UseGestureControlsParams {
  allowVolumeGesture: boolean;
  playerRef: React.RefObject<HTMLDivElement | null>;
  gesturesBlocked: boolean;
  revealChrome: () => void;
  togglePlay: () => void;
  changeVolume: (next: number) => void;
  doSeek: (delta: number, dir?: SeekDirection) => void;
  volume: number;
}

export function useGestureControls({
  allowVolumeGesture,
  playerRef,
  gesturesBlocked,
  revealChrome,
  togglePlay,
  changeVolume,
  doSeek,
  volume,
}: UseGestureControlsParams) {
  const tapTimerRef = useRef<number | null>(null);
  const tapCountRef = useRef(0);
  const tapXRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const touchGestureRef = useRef<"seek" | "volume" | "none" | null>(null);
  const [touchSeekDelta, setTouchSeekDelta] = useState<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gesturesBlocked) return;
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0]?.clientX ?? 0,
      y: e.touches[0]?.clientY ?? 0,
      time: Date.now(),
    };
    touchGestureRef.current = null;
    tapXRef.current = e.touches[0]?.clientX ?? 0;
  }, [gesturesBlocked]);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (gesturesBlocked) return;
      if (!touchStartRef.current || e.touches.length !== 1) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;

      if (!touchGestureRef.current) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
          touchGestureRef.current = "seek";
        } else if (allowVolumeGesture && Math.abs(dy) > 12) {
          const rect = playerRef.current?.getBoundingClientRect();
          touchGestureRef.current =
            rect && touch.clientX > rect.left + rect.width / 2
              ? "volume"
              : "none";
        } else if (Math.abs(dy) > 12) {
          touchGestureRef.current = "none";
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
    },
    [allowVolumeGesture, changeVolume, gesturesBlocked, playerRef, volume],
  );

  const handleTouchEnd = useCallback(() => {
    if (gesturesBlocked) return;
    if (touchGestureRef.current === "seek" && touchSeekDelta !== null) {
      doSeek(touchSeekDelta, touchSeekDelta > 0 ? "forward" : "back");
      setTouchSeekDelta(null);
    }
    touchStartRef.current = null;
    touchGestureRef.current = null;
  }, [doSeek, gesturesBlocked, touchSeekDelta]);

  const handleGestureClick = useCallback(
    (intent: InputIntent) => {
      if (gesturesBlocked) return;
      if (intent === "blocked") return;
      if (intent === "reveal-chrome") {
        revealChrome();
        return;
      }

      tapCountRef.current += 1;

      if (tapCountRef.current === 1) {
        tapTimerRef.current = window.setTimeout(() => {
          tapCountRef.current = 0;
          togglePlay();
        }, DOUBLE_TAP_THRESHOLD);
      } else {
        if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
        tapCountRef.current = 0;
        if (intent === "seek-forward" || intent === "seek-backward") {
          const isRight = intent === "seek-forward";
          doSeek(isRight ? SEEK_STEP : -SEEK_STEP, isRight ? "forward" : "back");
        } else {
          togglePlay();
        }
      }
    },
    [
      doSeek,
      gesturesBlocked,
      revealChrome,
      togglePlay,
    ],
  );

  return {
    touchSeekDelta,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleGestureClick,
  };
}
