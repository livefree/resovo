import { type SeekDirection } from "../types";
import s from "../Player.module.css";

/** Seek overlay animation — mirrors ytp-seek-overlay */
export function SeekOverlay({
  direction,
  seconds,
}: {
  direction: SeekDirection;
  seconds: number;
}) {
  return (
    <div className={s.ytpSeekOverlay} data-layer="4" aria-hidden="true">
      <div
        className={`${s.ytpSeekOverlayAnimation} ${s.ytpSeekBack} ${direction === "back" ? s.ytpSeekVisible : ""}`}
      >
        <div className={s.ytpSeekOverlayArrow}>
          <svg viewBox="0 0 22 32" width="22" height="24" aria-hidden="true">
            <path
              d="M 18 4 L 6 16 L 18 28"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <div className={s.ytpSeekOverlayArrow}>
          <svg viewBox="0 0 22 32" width="22" height="24" aria-hidden="true">
            <path
              d="M 18 4 L 6 16 L 18 28"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <div className={s.ytpSeekDuration}>{seconds}s</div>
      </div>
      <div
        className={`${s.ytpSeekOverlayAnimation} ${s.ytpSeekForward} ${direction === "forward" ? s.ytpSeekVisible : ""}`}
      >
        <div className={s.ytpSeekDuration}>{seconds}s</div>
        <div className={s.ytpSeekOverlayArrow}>
          <svg viewBox="0 0 22 32" width="22" height="24" aria-hidden="true">
            <path
              d="M 4 4 L 16 16 L 4 28"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
        <div className={s.ytpSeekOverlayArrow}>
          <svg viewBox="0 0 22 32" width="22" height="24" aria-hidden="true">
            <path
              d="M 4 4 L 16 16 L 4 28"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
