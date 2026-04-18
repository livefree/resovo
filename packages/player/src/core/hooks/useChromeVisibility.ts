import { useCallback, useEffect, useRef, useState } from "react";
import type { ChromeVisibilityPolicy } from "./useLayoutDecision";

interface UseChromeVisibilityParams {
  chromeVisibilityPolicy: ChromeVisibilityPolicy;
  isPlaying: boolean;
  openPanel: string | null;
  isEpisodesOpen: boolean;
  keepControlsVisible: boolean;
}

export function useChromeVisibility({
  chromeVisibilityPolicy,
  isPlaying,
  openPanel,
  isEpisodesOpen,
  keepControlsVisible,
}: UseChromeVisibilityParams) {
  const [chromeVisible, setChromeVisible] = useState(true);
  const [cursorHidden, setCursorHidden] = useState(false);
  const chromeTimerRef = useRef<number | null>(null);

  const revealChrome = useCallback(() => {
    setChromeVisible(true);
    setCursorHidden(false);
    if (keepControlsVisible) return;
    if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = window.setTimeout(
      () => {
        if (openPanel || isEpisodesOpen) return;
        setChromeVisible(false);
        if (chromeVisibilityPolicy.hideCursorOnAutohide) setCursorHidden(true);
      },
      chromeVisibilityPolicy.hideDelayMs,
    );
  }, [chromeVisibilityPolicy, isEpisodesOpen, keepControlsVisible, openPanel]);

  useEffect(() => {
    if (openPanel || isEpisodesOpen) {
      setChromeVisible(true);
      setCursorHidden(false);
      if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    } else if (keepControlsVisible) {
      setChromeVisible(true);
      setCursorHidden(false);
      if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    } else if (
      chromeVisibilityPolicy.pausedBehavior === "persistent" &&
      !isPlaying
    ) {
      setChromeVisible(true);
      setCursorHidden(false);
      if (chromeTimerRef.current) window.clearTimeout(chromeTimerRef.current);
    } else {
      revealChrome();
    }
  }, [
    chromeVisibilityPolicy.pausedBehavior,
    isEpisodesOpen,
    isPlaying,
    keepControlsVisible,
    openPanel,
    revealChrome,
  ]);

  return { chromeVisible, cursorHidden, revealChrome };
}
