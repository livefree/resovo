import { useEffect } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent, RefObject } from "react";
import s from "../Player.module.css";
import type {
  PanelPlacement,
  PanelSizingMode,
  ViewportBand,
} from "../hooks/useLayoutDecision";

type EpisodesPanelProps = {
  activeEpisodeIndex: number;
  episodesCols: number;
  maxHeight: string;
  focusedEpisodeIndex: number;
  isOpen: boolean;
  panelId: string;
  onClose: () => void;
  onEpisodeChange?: (index: number) => void;
  onFocusEpisode: (index: number) => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelSizingMode: PanelSizingMode;
  placement: PanelPlacement;
  viewportBand: ViewportBand;
  episodes?: Array<{ title?: string }>;
};

export function EpisodesPanel({
  activeEpisodeIndex,
  episodes,
  episodesCols,
  maxHeight,
  focusedEpisodeIndex,
  isOpen,
  panelId,
  onClose,
  onEpisodeChange,
  onFocusEpisode,
  panelRef,
  panelSizingMode,
  placement,
  viewportBand,
}: EpisodesPanelProps) {
  const totalEpisodes = episodes?.length ?? 0;

  const focusEpisodeAt = (index: number) => {
    if (!totalEpisodes) return;
    const safeIndex = Math.max(0, Math.min(index, totalEpisodes - 1));
    onFocusEpisode(safeIndex);
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    items[safeIndex]?.focus();
  };

  useEffect(() => {
    if (!isOpen || !episodes?.length) return;
    panelRef.current
      ?.querySelector<HTMLElement>("[data-ep-focused], [role='option']")
      ?.focus();
  }, [episodes?.length, focusedEpisodeIndex, isOpen, panelRef]);

  if (!isOpen || !episodes?.length) return null;

  return (
    <div
      ref={panelRef}
      id={panelId}
      className={`${s.ytpEpisodesPanel} ${s.ytpPanelSurface}`}
      data-layer="5"
      data-panel-height="content-driven"
      data-panel-sizing={panelSizingMode}
      data-placement={placement}
      data-viewport-band={viewportBand}
      role="dialog"
      aria-label="Episodes"
      aria-modal="false"
      style={
        {
          "--_ep-cols": episodesCols,
          "--_ep-max-height": maxHeight,
        } as CSSProperties
      }
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => event.stopPropagation()}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (!totalEpisodes) return;

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          focusEpisodeAt(
            focusedEpisodeIndex + (event.shiftKey ? -1 : 1),
          );
          return;
        }

        if (event.key === "Home") {
          event.preventDefault();
          event.stopPropagation();
          focusEpisodeAt(0);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          event.stopPropagation();
          focusEpisodeAt(totalEpisodes - 1);
          return;
        }

        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          onEpisodeChange?.(focusedEpisodeIndex);
          onClose();
        }
      }}
    >
      <div className={s.ytpPanelScroller}>
        <div
          className={s.ytpEpisodesGrid}
          role="listbox"
        >
          {episodes.map((_, index) => (
            <button
              key={index}
              role="option"
              aria-selected={index === activeEpisodeIndex}
              className={`${s.ytpEpisodeItem}${index === activeEpisodeIndex ? ` ${s.ytpEpisodeActive}` : ""}${index === focusedEpisodeIndex ? ` ${s.ytpEpisodeFocused}` : ""}`}
              data-ep-focused={index === focusedEpisodeIndex ? "" : undefined}
              onClick={() => {
                onEpisodeChange?.(index);
                onClose();
              }}
              onKeyDown={(event) => {
                if (event.key === "Home") {
                  event.preventDefault();
                  event.stopPropagation();
                  focusEpisodeAt(0);
                  return;
                }

                if (event.key === "End") {
                  event.preventDefault();
                  event.stopPropagation();
                  focusEpisodeAt(totalEpisodes - 1);
                  return;
                }

                if (event.key === "Tab") {
                  event.preventDefault();
                  event.stopPropagation();
                  focusEpisodeAt(index + (event.shiftKey ? -1 : 1));
                  return;
                }

                if (event.key === " " || event.key === "Enter") {
                  event.preventDefault();
                  event.stopPropagation();
                  onEpisodeChange?.(index);
                  onClose();
                }
              }}
              onMouseEnter={() => onFocusEpisode(index)}
              onFocus={() => onFocusEpisode(index)}
            >
              {String(index + 1).padStart(2, "0")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
