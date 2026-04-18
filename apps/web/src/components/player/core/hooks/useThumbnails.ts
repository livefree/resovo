"use client";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThumbnailCue {
  startTime: number;
  endTime: number;
  /** Resolved absolute image URL */
  url: string;
  /** Sprite-sheet crop region (present when VTT uses #xywh fragment) */
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

// ─── VTT parsing helpers ──────────────────────────────────────────────────────

/** Parse HH:MM:SS.mmm or MM:SS.mmm → seconds */
function parseVttTime(raw: string): number {
  const parts = raw.trim().split(":").map(Number) as [number?, number?, number?];
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parts[0] ?? 0;
}

/**
 * Parse a WebVTT thumbnail track file.
 * Supports:
 *   • Sprite sheets  — "sprite.jpg#xywh=x,y,w,h"
 *   • Individual images — "frame_000.jpg"
 * Relative URLs are resolved against the VTT file's own URL.
 */
function parseVttThumbnails(text: string, vttUrl: string): ThumbnailCue[] {
  const base = new URL(vttUrl, typeof location !== "undefined" ? location.href : "http://localhost");
  const cues: ThumbnailCue[] = [];

  // Split on blank lines to get cue blocks
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);

  for (const block of blocks) {
    const lines = block
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const timeLine = lines.find((l) => l.includes("-->"));
    // URL line: not a timing line, not "WEBVTT", not a pure cue number
    const urlLine = lines.find(
      (l) =>
        l !== timeLine &&
        !l.startsWith("WEBVTT") &&
        !l.startsWith("NOTE") &&
        !/^\d+$/.test(l),
    );

    if (!timeLine || !urlLine) continue;

    const parts = timeLine.split("-->").map((s) => s.trim());
    const startRaw = parts[0] ?? "";
    const endRaw = parts[1] ?? startRaw;
    const rawUrl = urlLine.trim();

    // Strip #xywh fragment before URL resolution
    const hashIdx = rawUrl.indexOf("#xywh=");
    const imgPath = hashIdx >= 0 ? rawUrl.slice(0, hashIdx) : rawUrl;
    const xywh = hashIdx >= 0 ? rawUrl.slice(hashIdx + 6) : null;

    let url: string;
    try {
      url = new URL(imgPath, base).href;
    } catch {
      continue; // skip malformed URLs
    }

    const cue: ThumbnailCue = {
      startTime: parseVttTime(startRaw),
      endTime: parseVttTime(endRaw),
      url,
    };

    if (xywh) {
      const xywhParts = xywh.split(",").map(Number);
      const x = xywhParts[0] ?? 0;
      const y = xywhParts[1] ?? 0;
      const w = xywhParts[2] ?? 0;
      const h = xywhParts[3] ?? 0;
      if (Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0) {
        cue.x = x;
        cue.y = y;
        cue.w = w;
        cue.h = h;
      }
    }

    cues.push(cue);
  }

  return cues.sort((a, b) => a.startTime - b.startTime);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Fetches and parses a WebVTT thumbnail track in the background.
 *
 * Network strategy:
 *   • Fetches once per `trackSrc`; AbortController cancels stale requests on
 *     src change or unmount.
 *   • All errors (network, parse, 404) are caught silently — getThumbnailAt
 *     returns null, tooltip degrades gracefully to time + chapter only.
 *   • Sprite-sheet images are loaded lazily by the browser as their URLs
 *     appear in CSS/JSX; HTTP caching prevents re-fetching the same sheet.
 *   • Zero impact on video playback: no shared resources, no timers.
 */
export function useThumbnails(trackSrc: string | undefined) {
  const [cues, setCues] = useState<ThumbnailCue[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!trackSrc) {
      setCues([]);
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch(trackSrc, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((text) => setCues(parseVttThumbnails(text, trackSrc)))
      .catch(() => {
        // Graceful degradation: thumbnails simply won't appear
      });

    return () => {
      ctrl.abort();
    };
  }, [trackSrc]);

  /** O(n) binary-search-like lookup returning the cue that covers `time`. */
  const getThumbnailAt = useCallback(
    (time: number): ThumbnailCue | null => {
      if (!cues.length) return null;
      for (let i = cues.length - 1; i >= 0; i--) {
        if (time >= (cues[i]?.startTime ?? Infinity)) return cues[i] ?? null;
      }
      return null;
    },
    [cues],
  );

  return { getThumbnailAt };
}
