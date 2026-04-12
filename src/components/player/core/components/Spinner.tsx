import s from "../Player.module.css";

/** Spinner — mirrors ytp-spinner */
export function Spinner({
  visible,
  state,
}: {
  visible: boolean;
  state: "idle" | "initial" | "buffering";
}) {
  if (!visible) return null;
  const label = state === "buffering" ? "Buffering video" : "Loading video";
  return (
    <div
      className={s.ytpSpinner}
      data-layer="4"
      data-loading-state={state}
      aria-label={label}
      role="status"
      aria-live="polite"
    >
      <div className={s.ytpSpinnerContainer}>
        <div className={s.ytpSpinnerRotator}>
          <div className={s.ytpSpinnerLeft}>
            <div className={s.ytpSpinnerCircle} />
          </div>
          <div className={s.ytpSpinnerRight}>
            <div className={s.ytpSpinnerCircle} />
          </div>
        </div>
      </div>
      <span className={s.ytpSpinnerLabel}>
        {state === "buffering" ? "Buffering..." : "Loading..."}
      </span>
    </div>
  );
}
