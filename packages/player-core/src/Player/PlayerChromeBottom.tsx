"use client";

import type { PointerEvent, MouseEvent, TouchEvent, ReactNode, RefObject } from "react";
import s from "../Player.module.css";
import type { ControlRenderContext } from "../controls/ControlRenderer";
import { renderControl } from "../controls/ControlRenderer";
import { ProgressBar } from "../components/ProgressBar";
import { ControlSlot } from "../components/ControlSlot";
import { qualityBadgeLabel } from "../utils/format";
import type { ThumbnailCue } from "../hooks/useThumbnails";

export interface ChapterMarker {
  title: string;
  pct: number;
}

export interface PlayerChromeBottomProps {
  showTimeAboveProgress: boolean;
  controlCtx: ControlRenderContext;

  progressContainerRef: RefObject<HTMLDivElement | null>;
  progressRailRef: RefObject<HTMLDivElement | null>;
  progressScrubActiveRef: RefObject<boolean>;
  isProgressScrubbing: boolean;
  duration: number;
  currentTime: number;
  bufferedPct: number;
  displayPct: number;
  hoverTime: number | null;
  hoverX: number | null;
  hoverChapterTitle?: string;
  chapterMarkers: ChapterMarker[];
  getThumbnailAt: (time: number) => ThumbnailCue | null;
  handleProgressPointerDown: (e: PointerEvent<HTMLDivElement>) => void;
  handleProgressPointerMove: (e: PointerEvent<HTMLDivElement>) => void;
  handleProgressPointerUp: (e: PointerEvent<HTMLDivElement>) => void;
  handleProgressHover: (e: MouseEvent<HTMLDivElement>) => void;
  handleProgressMouseLeave: () => void;
  handleProgressTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
  handleProgressTouchMove: (e: TouchEvent<HTMLDivElement>) => void;
  handleProgressTouchEnd: (e: TouchEvent<HTMLDivElement>) => void;
  handleProgressClick: (e: MouseEvent<HTMLDivElement>) => void;
  doSeek: (delta: number) => void;

  playControl: ReactNode;
  showNextEpisodesGroup: boolean;
  nextControl: ReactNode;
  episodesControl: ReactNode;
  bottomLeftControls: ReactNode[];
  showQualityBadge: boolean;
  resolvedQualityHeight: number | null;
  bottomRightControls: ReactNode[];
}

export function PlayerChromeBottom({
  showTimeAboveProgress,
  controlCtx,
  progressContainerRef,
  progressRailRef,
  progressScrubActiveRef,
  isProgressScrubbing,
  duration,
  currentTime,
  bufferedPct,
  displayPct,
  hoverTime,
  hoverX,
  hoverChapterTitle,
  chapterMarkers,
  getThumbnailAt,
  handleProgressPointerDown,
  handleProgressPointerMove,
  handleProgressPointerUp,
  handleProgressHover,
  handleProgressMouseLeave,
  handleProgressTouchStart,
  handleProgressTouchMove,
  handleProgressTouchEnd,
  handleProgressClick,
  doSeek,
  playControl,
  showNextEpisodesGroup,
  nextControl,
  episodesControl,
  bottomLeftControls,
  showQualityBadge,
  resolvedQualityHeight,
  bottomRightControls,
}: PlayerChromeBottomProps) {
  return (
    <div className={s.ytpChromeBottom} data-layer="9">
      {showTimeAboveProgress && (
        <div className={s.ytpTimeAboveProgress}>
          {renderControl("time", controlCtx)}
        </div>
      )}
      <ProgressBar
        progressContainerRef={progressContainerRef}
        progressRailRef={progressRailRef}
        progressScrubActiveRef={progressScrubActiveRef}
        isScrubbing={isProgressScrubbing}
        duration={duration}
        currentTime={currentTime}
        bufferedPct={bufferedPct}
        displayPct={displayPct}
        hoverTime={hoverTime}
        hoverX={hoverX ?? 0}
        hoverChapterTitle={hoverChapterTitle}
        chapterMarkers={chapterMarkers}
        getThumbnailAt={getThumbnailAt}
        handlePointerDown={handleProgressPointerDown}
        handlePointerMove={handleProgressPointerMove}
        handlePointerUp={handleProgressPointerUp}
        handleProgressHover={handleProgressHover}
        handleMouseLeave={handleProgressMouseLeave}
        handleProgressTouchStart={handleProgressTouchStart}
        handleProgressTouchMove={handleProgressTouchMove}
        handleProgressTouchEnd={handleProgressTouchEnd}
        handleProgressClick={handleProgressClick}
        onSeekStep={doSeek}
      />
      <div className={s.ytpChromeControls}>
        <ControlSlot className={s.ytpLeftControls} slot="bottom-left">
          {playControl}
          {showNextEpisodesGroup && (
            <div
              className={s.ytpNextEpisodesGroup}
              data-ytp-component="next-episodes-group"
            >
              {nextControl}
              {episodesControl}
            </div>
          )}
          {bottomLeftControls}
        </ControlSlot>
        <div className={s.ytpChromeControlsRight}>
          {showQualityBadge && resolvedQualityHeight !== null && (
            <div className={s.ytpQualityBadge} aria-hidden="true">
              {qualityBadgeLabel(resolvedQualityHeight)}
            </div>
          )}
          <ControlSlot className={s.ytpRightControls} slot="bottom-right">
            {bottomRightControls}
          </ControlSlot>
        </div>
      </div>
    </div>
  );
}
