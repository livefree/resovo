import { ButtonHTMLAttributes, ReactNode } from "react";
import s from "../Player.module.css";

type YtpButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tooltip: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  children: ReactNode;
};

/** YtpButton — control bar button with three-layer visual model:
 *  Layer 1 (::before): background contrast backdrop
 *  Layer 2 (::after):  hover / active overlay
 *  Layer 3 (content):  SVG icon + tooltip span
 */
export function YtpButton({
  tooltip,
  onClick,
  onMouseEnter,
  ariaLabel,
  className = "",
  ariaPressed,
  children,
  ...rest
}: YtpButtonProps) {
  return (
    <button
      type="button"
      className={`${s.ytpButton} ${className}`}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={ariaLabel ?? tooltip}
      aria-pressed={ariaPressed}
      {...rest}
    >
      {children}
      <span className={s.ytpTooltip} aria-hidden="true">{tooltip}</span>
    </button>
  );
}
