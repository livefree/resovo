import s from "../Player.module.css";

/** Bezel — center icon flash for play/pause (mirrors ytp-bezel) */
export function Bezel({ visible, paused }: { visible: boolean; paused: boolean }) {
  return (
    <div
      className={`${s.ytpBezel} ${visible ? s.ytpBezelVisible : ""}`}
      data-layer="4"
      aria-hidden="true"
    >
      {paused ? (
        <svg viewBox="0 0 36 36" width="36" height="36">
          <path d="M 10 8 L 10 28 L 28 18 Z" fill="white" />
        </svg>
      ) : (
        <svg viewBox="0 0 36 36" width="36" height="36">
          <rect x="9" y="8" width="6" height="20" rx="2" fill="white" />
          <rect x="21" y="8" width="6" height="20" rx="2" fill="white" />
        </svg>
      )}
    </div>
  );
}
