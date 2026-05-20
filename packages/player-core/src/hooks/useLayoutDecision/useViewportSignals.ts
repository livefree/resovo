import { useEffect, useState } from "react";
import type { RefObject } from "react";

export interface ViewportSignals {
  isCoarsePointer: boolean;
  viewport: { width: number; height: number };
  windowIsPortrait: boolean;
}

export function useViewportSignals(
  playerRef: RefObject<HTMLDivElement | null>,
): ViewportSignals {
  const [isCoarsePointer, setIsCoarsePointer] = useState<boolean>(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return false;
    return window.matchMedia("(pointer: coarse)").matches;
  });
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });
  const [windowIsPortrait, setWindowIsPortrait] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth <= window.innerHeight;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !("matchMedia" in window)) return;

    const mediaQuery = window.matchMedia("(pointer: coarse)");
    const syncPointerType = () => setIsCoarsePointer(mediaQuery.matches);

    syncPointerType();

    if ("addEventListener" in mediaQuery) {
      mediaQuery.addEventListener("change", syncPointerType);
      return () => mediaQuery.removeEventListener("change", syncPointerType);
    }

    const legacyMediaQuery = mediaQuery as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    legacyMediaQuery.addListener?.(syncPointerType);
    return () => legacyMediaQuery.removeListener?.(syncPointerType);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const measureViewport = () => {
      const rect = playerRef.current?.getBoundingClientRect();
      const width = rect?.width || window.innerWidth;
      const height = rect?.height || window.innerHeight;

      setViewport((current) => {
        if (current.width === width && current.height === height) return current;
        return { width, height };
      });

      const portrait = window.innerWidth <= window.innerHeight;
      setWindowIsPortrait((current) => (current === portrait ? current : portrait));
    };

    measureViewport();
    window.addEventListener("resize", measureViewport);

    const observer =
      typeof ResizeObserver !== "undefined" && playerRef.current
        ? new ResizeObserver(measureViewport)
        : null;
    if (observer && playerRef.current) observer.observe(playerRef.current);

    return () => {
      window.removeEventListener("resize", measureViewport);
      observer?.disconnect();
    };
  }, [playerRef]);

  return { isCoarsePointer, viewport, windowIsPortrait };
}
