import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  RefObject,
  TouchEvent,
} from "react";
import type { ThumbnailCue } from "../hooks/useThumbnails";
import { SEEK_STEP, THUMB_CLAMP_PX, clamp, formatTime } from "../utils/format";
import s from "../Player.module.css";

type ChapterMarker = {
  pct: number;
  title: string;
};

type ProgressBarProps = {
  bufferedPct: number;
  chapterMarkers: ChapterMarker[];
  currentTime: number;
  displayPct: number;
  duration: number;
  getThumbnailAt: (time: number) => ThumbnailCue | null;
  handleMouseLeave: () => void;
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  handlePointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  handleProgressClick: (event: MouseEvent<HTMLDivElement>) => void;
  handleProgressHover: (event: MouseEvent<HTMLDivElement>) => void;
  handleProgressTouchEnd: (event: TouchEvent<HTMLDivElement>) => void;
  handleProgressTouchMove: (event: TouchEvent<HTMLDivElement>) => void;
  handleProgressTouchStart: (event: TouchEvent<HTMLDivElement>) => void;
  hoverChapterTitle?: string | null;
  hoverTime: number | null;
  hoverX: number;
  isScrubbing: boolean;
  onSeekStep: (delta: number) => void;
  progressContainerRef: RefObject<HTMLDivElement | null>;
  progressRailRef: RefObject<HTMLDivElement | null>;
  progressScrubActiveRef: RefObject<boolean>;
};

export function ProgressBar({
  bufferedPct,
  chapterMarkers,
  currentTime,
  displayPct,
  duration,
  getThumbnailAt,
  handleMouseLeave,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  handleProgressClick,
  handleProgressHover,
  handleProgressTouchEnd,
  handleProgressTouchMove,
  handleProgressTouchStart,
  hoverChapterTitle,
  hoverTime,
  hoverX,
  isScrubbing,
  onSeekStep,
  progressContainerRef,
  progressRailRef,
  progressScrubActiveRef,
}: ProgressBarProps) {
  const tooltip = hoverTime === null ? null : getThumbnailAt(hoverTime);
  const railWidth = progressRailRef.current?.clientWidth ?? 300;
  const clampPx = tooltip ? THUMB_CLAMP_PX : 40;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") onSeekStep(-SEEK_STEP);
    if (event.key === "ArrowRight") onSeekStep(SEEK_STEP);
  };

  return (
    <div
      ref={progressContainerRef}
      className={`${s.ytpProgressBarContainer} ${isScrubbing ? s.ytpProgressBarScrubbing : ""}`}
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseMove={handleProgressHover}
        onMouseLeave={handleMouseLeave}
        onClick={(event) => {
          if (progressScrubActiveRef.current) return;
          handleProgressClick(event);
        }}
        onKeyDown={handleKeyDown}
      >
        <div className={s.ytpChaptersContainer}>
          <div className={s.ytpChapterHoverContainer}>
            <div className={s.ytpProgressBarPadding} />
            <div className={s.ytpProgressList}>
              <div
                className={s.ytpLoadProgress}
                style={{ transform: `scaleX(${bufferedPct / 100})` }}
              />
              <div
                className={s.ytpPlayProgress}
                style={{ transform: `scaleX(${displayPct / 100})` }}
              />
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

        {chapterMarkers.map((chapter) => (
          <div
            key={chapter.title}
            className={s.ytpChapterMarker}
            style={{ left: `${chapter.pct}%` }}
            title={chapter.title}
          />
        ))}

        <div
          className={s.ytpScrubberContainer}
          style={{ left: `${displayPct}%` }}
        >
          <div className={s.ytpScrubberButton} />
        </div>

        {hoverTime !== null && (
          <div
            className={s.ytpProgressTooltipWrap}
            style={{ left: `${clamp(hoverX, clampPx, railWidth - clampPx)}px` }}
          >
            {tooltip && (
              <div className={s.ytpThumbnailPreview}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Thumbnail sprite offsets require a plain img. */}
                <img
                  src={tooltip.url}
                  className={s.ytpThumbnailImg}
                  alt=""
                  draggable={false}
                  style={
                    tooltip.x !== undefined
                      ? {
                          objectFit: "none",
                          objectPosition: `-${tooltip.x}px -${tooltip.y}px`,
                          width: tooltip.w,
                          height: tooltip.h,
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
              {hoverChapterTitle && (
                <div className={s.ytpTooltipChapterTitle}>
                  {hoverChapterTitle}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
