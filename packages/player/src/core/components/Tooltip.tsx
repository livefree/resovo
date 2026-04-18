import { CSSProperties } from "react";
import s from "../Player.module.css";

/** Global tooltip singleton — mirrors ytp-tooltip behaviour */
export function Tooltip({
  text,
  visible,
  style,
}: {
  text: string;
  visible: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${s.ytpTooltip} ${visible ? s.ytpTooltipVisible : ""}`}
      role="tooltip"
      aria-hidden={!visible}
      style={style}
    >
      <div className={s.ytpTooltipText}>{text}</div>
    </div>
  );
}
