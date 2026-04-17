import s from "../Player.module.css";

interface HorizontalSliderProps {
  /** CSS module class for the outer track div — controls width, background, border-radius. */
  trackClassName: string;
  min: number;
  max: number;
  step: number;
  value: number;
  ariaLabel: string;
  onChange: (value: number) => void;
  /** Optional id forwarded to the underlying <input> element. */
  id?: string;
}

/**
 * Reusable horizontal range slider.
 *
 * Renders a track container (class provided by caller), a fill bar, a handle
 * dot, and an invisible <input type="range"> that owns the interaction. All
 * visual tokens come from CSS variables shared with the volume slider.
 */
export function HorizontalSlider({
  trackClassName,
  min,
  max,
  step,
  value,
  ariaLabel,
  onChange,
  id,
}: HorizontalSliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div className={trackClassName}>
      <div className={s.ytpHSliderFill} style={{ width: `${pct}%` }} />
      <div className={s.ytpHSliderHandle} style={{ left: `${pct}%` }} />
      <input
        id={id}
        type="range"
        className={s.ytpHSliderInput}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
    </div>
  );
}
