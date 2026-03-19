import s from "../Player.module.css";

/** Spinner — mirrors ytp-spinner */
export function Spinner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className={s.ytpSpinner}
      data-layer="4"
      aria-label="Loading"
      role="status"
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
    </div>
  );
}
