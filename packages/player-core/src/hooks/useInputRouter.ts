import { useMemo } from "react";
import type { InteractionPolicy } from "./useLayoutDecision";

export type InputZone = "left" | "center" | "right";
export type InputIntent = "seek-backward" | "seek-forward" | "toggle-playback" | "reveal-chrome" | "blocked";
export type InputDevicePolicy = "pointer" | "touch-tablet" | "touch-phone";

export type InputRoute = {
  blocksGestures: boolean;
  devicePolicy: InputDevicePolicy;
  intent: InputIntent;
  interactive: boolean;
  kind: "gesture-zone";
  zone: InputZone;
};

type UseInputRouterParams = {
  blocksGestures: boolean;
  chromeVisible: boolean;
  interactionPolicy: InteractionPolicy;
  keepControlsVisible: boolean;
};

export function useInputRouter({
  blocksGestures,
  chromeVisible,
  interactionPolicy,
  keepControlsVisible,
}: UseInputRouterParams) {
  return useMemo(() => {
    const useThreeZones = true;
    const zones: InputZone[] = ["left", "center", "right"];
    const devicePolicy: InputDevicePolicy =
      interactionPolicy === "phone-touch"
        ? "touch-phone"
        : interactionPolicy === "tablet-touch"
          ? "touch-tablet"
          : "pointer";
    const shouldRevealChrome = !chromeVisible && !keepControlsVisible;

    const getIntent = (zone: InputZone): InputIntent => {
      if (blocksGestures) return "blocked";
      if (shouldRevealChrome) return "reveal-chrome";
      if (zone === "left") return "seek-backward";
      if (zone === "right") return "seek-forward";
      return "toggle-playback";
    };

    const routes: InputRoute[] = zones.map((zone) => ({
      kind: "gesture-zone",
      zone,
      intent: getIntent(zone),
      devicePolicy,
      interactive: !blocksGestures,
      blocksGestures,
    }));

    return {
      devicePolicy,
      routes,
      zones,
      useThreeZones,
      gestureSurfaceDisabled: blocksGestures,
    };
  }, [blocksGestures, chromeVisible, interactionPolicy, keepControlsVisible]);
}
