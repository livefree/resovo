import { useCallback, useEffect } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import s from "../Player.module.css";
import type {
  PanelPlacement,
  PanelSizingMode,
  ViewportBand,
} from "../hooks/useLayoutDecision";
import type { Panel, QualityLevel, SubtitleTrack } from "../types";
import { qualityDescription } from "../utils/format";
import { MenuBackIcon, MenuCheckIcon, MenuChevronIcon } from "./icons";

type SettingsPanelProps = {
  activeQualityId?: string;
  activeSubId: string | null;
  panelId: string;
  onOpenPanel: (panel: Panel) => void;
  onRequestClose: () => void;
  onQualityChange?: (id: string) => void;
  onSubtitleChange: (subtitleId: string | null) => void;
  openPanel: Panel;
  panelRef: RefObject<HTMLDivElement | null>;
  panelSizingMode: PanelSizingMode;
  placement: PanelPlacement;
  viewportBand: ViewportBand;
  qualities: QualityLevel[];
  subtitles: SubtitleTrack[];
  resolvedQualityHeight?: number | null;
};

type MenuItemProps = {
  children: ReactNode;
  className?: string;
  onActivate: () => void;
  role?: string;
  tabIndex?: number;
  ariaChecked?: boolean;
};

function MenuItem({
  ariaChecked,
  children,
  className = "",
  onActivate,
  role = "menuitem",
  tabIndex = 0,
}: MenuItemProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onActivate();
    }
  };

  return (
    <div
      className={`${s.ytpMenuItem} ${className}`.trim()}
      role={role}
      tabIndex={tabIndex}
      aria-checked={ariaChecked}
      onClick={onActivate}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function MenuHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <div
      className={s.ytpMenuHeader}
      role="menuitem"
      tabIndex={0}
      onClick={onBack}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onBack();
        }
      }}
    >
      <MenuBackIcon className={s.ytpMenuBack} />
      <span>{label}</span>
    </div>
  );
}

export function SettingsPanel({
  activeQualityId,
  activeSubId,
  panelId,
  onOpenPanel,
  onRequestClose,
  onQualityChange,
  onSubtitleChange,
  openPanel,
  panelRef,
  panelSizingMode,
  placement,
  viewportBand,
  qualities,
  subtitles,
  resolvedQualityHeight,
}: SettingsPanelProps) {
  const activeQualityLabel =
    qualities.find((quality) => quality.id === activeQualityId)?.label ?? "Auto";
  const activeSubtitleLabel = activeSubId
    ? (subtitles.find((subtitle) => subtitle.id === activeSubId)?.label ?? "Off")
    : "Off";

  const getFocusableItems = useCallback(
    () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"], [role="menuitemradio"]',
        ) ?? [],
      ),
    [panelRef],
  );

  const focusItemAt = useCallback(
    (index: number) => {
      const items = getFocusableItems();
      if (!items.length) return;
      items[(index + items.length) % items.length]?.focus();
    },
    [getFocusableItems],
  );

  useEffect(() => {
    if (!openPanel) return;
    focusItemAt(0);
  }, [focusItemAt, openPanel]);

  if (!openPanel || openPanel === "speed") return null;

  return (
    <div
      ref={panelRef}
      id={panelId}
      className={`${s.ytpSettingsMenu} ${s.ytpPanelSurface} ${s.ytpPopup}`}
      data-layer="5"
      data-panel-height="content-driven"
      data-panel-sizing={panelSizingMode}
      data-placement={placement}
      data-viewport-band={viewportBand}
      role="dialog"
      aria-label="Settings"
      aria-modal="false"
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => event.stopPropagation()}
      onKeyDown={(event) => {
        const items = getFocusableItems();
        const currentIndex = items.findIndex((item) => item === document.activeElement);

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onRequestClose();
          return;
        }

        if (!items.length) return;

        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          focusItemAt(currentIndex + (event.shiftKey ? -1 : 1));
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          focusItemAt(currentIndex + 1);
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          focusItemAt(currentIndex - 1);
          return;
        }

        if (event.key === "Home") {
          event.preventDefault();
          event.stopPropagation();
          focusItemAt(0);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          event.stopPropagation();
          focusItemAt(items.length - 1);
        }
      }}
    >
      <div
        className={s.ytpFocusTrap}
        tabIndex={0}
        onFocus={() => focusItemAt(-1)}
      />
      <div className={s.ytpPanelScroller}>
        <div className={s.ytpPanelMenu} role="menu">
          {openPanel === "settings" && (
            <>
              {qualities.length > 0 && (
                <MenuItem onActivate={() => onOpenPanel("quality")}>
                  <span className={s.ytpMenuItemLabel}>Quality</span>
                  <span className={s.ytpMenuItemValue}>{activeQualityLabel}</span>
                  <MenuChevronIcon className={s.ytpMenuChevron} />
                </MenuItem>
              )}
              {subtitles.length > 0 && (
                <MenuItem onActivate={() => onOpenPanel("subtitles")}>
                  <span className={s.ytpMenuItemLabel}>Subtitles/CC</span>
                  <span className={s.ytpMenuItemValue}>{activeSubtitleLabel}</span>
                  <MenuChevronIcon className={s.ytpMenuChevron} />
                </MenuItem>
              )}
              {resolvedQualityHeight != null && (
                <div className={s.ytpMenuInfoRow}>
                  <span className={s.ytpMenuInfoLabel}>Resolution</span>
                  <span className={s.ytpMenuInfoValue}>
                    {qualityDescription(resolvedQualityHeight)}
                  </span>
                </div>
              )}
            </>
          )}

          {openPanel === "quality" && (
            <>
              <MenuHeader label="Quality" onBack={() => onOpenPanel("settings")} />
              {qualities.map((quality) => (
                <MenuItem
                  key={quality.id}
                  className={
                    quality.id === activeQualityId ? s.ytpMenuItemActive : ""
                  }
                  role="menuitemradio"
                  ariaChecked={quality.id === activeQualityId}
                  onActivate={() => {
                    onQualityChange?.(quality.id);
                    onOpenPanel("settings");
                  }}
                >
                  {quality.id === activeQualityId && (
                    <MenuCheckIcon className={s.ytpMenuCheck} />
                  )}
                  <span className={s.ytpMenuItemLabel}>{quality.label}</span>
                </MenuItem>
              ))}
            </>
          )}

          {openPanel === "subtitles" && (
            <>
              <MenuHeader label="Subtitles/CC" onBack={() => onOpenPanel("settings")} />
              <MenuItem
                className={!activeSubId ? s.ytpMenuItemActive : ""}
                role="menuitemradio"
                ariaChecked={!activeSubId}
                onActivate={() => {
                  onSubtitleChange(null);
                  onOpenPanel("settings");
                }}
              >
                {!activeSubId && <MenuCheckIcon className={s.ytpMenuCheck} />}
                <span className={s.ytpMenuItemLabel}>Off</span>
              </MenuItem>
              {subtitles.map((subtitle) => (
                <MenuItem
                  key={subtitle.id}
                  className={
                    subtitle.id === activeSubId ? s.ytpMenuItemActive : ""
                  }
                  role="menuitemradio"
                  ariaChecked={subtitle.id === activeSubId}
                  onActivate={() => {
                    onSubtitleChange(subtitle.id);
                    onOpenPanel("settings");
                  }}
                >
                  {subtitle.id === activeSubId && (
                    <MenuCheckIcon className={s.ytpMenuCheck} />
                  )}
                  <span className={s.ytpMenuItemLabel}>{subtitle.label}</span>
                </MenuItem>
              ))}
            </>
          )}
        </div>
      </div>
      <div
        className={s.ytpFocusTrap}
        tabIndex={0}
        onFocus={() => focusItemAt(0)}
      />
    </div>
  );
}
