import type { ReactNode } from "react";
import type { ControlSlot as ControlSlotName } from "../hooks/useLayoutDecision";
import s from "../Player.module.css";

type ControlSlotProps = {
  children: ReactNode;
  className?: string;
  slot: ControlSlotName;
};

export function ControlSlot({
  children,
  className = "",
  slot,
}: ControlSlotProps) {
  return (
    <div
      className={`${s.ytpControlSlot} ${className}`.trim()}
      data-control-slot={slot}
    >
      {children}
    </div>
  );
}
