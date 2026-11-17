"use client";

import { useEffect, useRef, useSyncExternalStore, type CSSProperties } from "react";
import "./login-mosaic.css";

/**
 * "Ashlar" — the CALENDAR. login mosaic.
 * 6x8 grid of hand-designed geometric tiles (viewBox 600x800, 100px cells).
 * Motion: staggered entrance (CSS), diagonal rotational waves + circle pulses
 * (Live), electric-blue tiles periodically lit, click-to-rotate with a
 * neighbor ripple, magnetic cursor proximity. All motion is disabled under
 * prefers-reduced-motion. Decorative: aria-hidden; controls are real buttons.
 */

type TileKind = "arc" | "pill" | "leaf" | "square" | "circle";

type TileState = {
  el: SVGGraphicsElement;
  row: number;
  col: number;
  kind: TileKind;
  electric: boolean;
  cx: number;
  cy: number;
  rot: number;
  baseScale: number;
  hoverScale: number;
  tx: number;
  ty: number;
};

export function LoginMosaic() {
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<TileState[]>([]);
  const waveStepRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const waveRef = useRef<(forceFull?: boolean) => void>(() => {});

  /* Live preference tracked via matchMedia (server snapshot: no-preference → motion allowed). */
  const reducedMotion = useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  // Ambient motion is always on (unless reduced-motion); no user control.
  const liveOn = !reducedMotion;

  /* Build the tile model once + wire interactions. */
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const tiles: TileState[] = Array.from(
      wrapper.querySelectorAll<SVGGraphicsElement>("[data-kind]"),
    ).map((el) => {
      const row = Number(el.dataset.row ?? 0);
      const col = Number(el.dataset.col ?? 0);
      return {
        el,
        row,
        col,
        kind: (el.dataset.kind as TileKind) ?? "arc",
        electric: el.dataset.electric === "true",
        cx: col * 100 + 50,
        cy: row * 100 + 50,
        rot: 0,
        baseScale: 1,
        hoverScale: 1,
        tx: 0,
        ty: 0,
      };
    });
    tilesRef.current = tiles;

    const timers = timersRef.current;
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    const applyTile = (tile: TileState) => {
      const scale = tile.baseScale * tile.hoverScale;
      tile.el.style.transform = `translate(${tile.tx.toFixed(2)}px, ${tile.ty.toFixed(2)}px) rotate(${tile.rot}deg) scale(${scale.toFixed(4)})`;
    };

    const lightElectric = (tile: TileState) => {
      if (!tile.electric) return;
      tile.el.classList.add("lm-electric-lit");
      later(() => tile.el.classList.remove("lm-electric-lit"), 950);
    };

    /* Diagonal cascade wave — arcs/pills rotate ±90° by diagonal parity,
       leaf/square +90°, circles breathe. Full = every group at once (Shuffle). */
    const runWave = (forceFull = false) => {
      waveStepRef.current = (waveStepRef.current + 1) % 6;
      const waveStep = waveStepRef.current;

      for (const tile of tiles) {
        const diagonalOrder = tile.row + tile.col;
        const group = diagonalOrder % 5;
        const isActive = forceFull || group === waveStep || group === (waveStep + 1) % 5;
        if (!isActive) continue;

        const staggerMs = (diagonalOrder % 3) * 140;
        later(() => {
          if (tile.kind === "circle") {
            tile.baseScale = 1.12;
            applyTile(tile);
            later(() => {
              tile.baseScale = 1;
              applyTile(tile);
            }, 700);
          } else {
            const direction =
              tile.kind === "arc" || tile.kind === "pill"
                ? (tile.row + tile.col) % 2 === 0
                  ? 90
                  : -90
                : 90;
            tile.rot += direction;
            applyTile(tile);
          }
          lightElectric(tile);
        }, staggerMs);
      }
    };
    waveRef.current = runWave;

    /* Tactile click: rotate the tile, ripple to immediate neighbors. */
    const onTileClick = (event: Event) => {
      const target = (event.target as Element).closest<SVGGraphicsElement>("[data-kind]");
      if (!target) return;
      const tile = tiles.find((t) => t.el === target);
      if (!tile) return;

      tile.rot += 90;
      applyTile(tile);
      lightElectric(tile);

      for (const other of tiles) {
        const dist = Math.hypot(other.row - tile.row, other.col - tile.col);
        if (dist > 1.2 || other === tile) continue;
        later(() => {
          other.rot += (other.row + other.col) % 2 === 0 ? 90 : -90;
          applyTile(other);
        }, 120);
      }
    };
    wrapper.addEventListener("click", onTileClick);

    /* Magnetic cursor proximity (skipped entirely under reduced motion). */
    const stage = stageRef.current;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let rafId = 0;
    let pointer: { x: number; y: number } | null = null;

    const updateCursorField = () => {
      rafId = 0;
      if (!pointer) return;
      const radius = 175;
      for (const tile of tiles) {
        const dx = tile.cx - pointer.x;
        const dy = tile.cy - pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius && dist > 0.01) {
          const falloff = 1 - dist / radius;
          const eased = falloff * falloff;
          tile.tx = (dx / dist) * eased * 6;
          tile.ty = (dy / dist) * eased * 6;
          tile.hoverScale = 1 - eased * 0.045;
        } else {
          tile.tx = 0;
          tile.ty = 0;
          tile.hoverScale = 1;
        }
        applyTile(tile);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (mq.matches) return;
      const rect = wrapper.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer = {
        x: ((event.clientX - rect.left) / rect.width) * 600,
        y: ((event.clientY - rect.top) / rect.height) * 800,
      };
      if (!rafId) rafId = window.requestAnimationFrame(updateCursorField);
    };
    const onMouseLeave = () => {
      pointer = null;
      for (const tile of tiles) {
        tile.tx = 0;
        tile.ty = 0;
        tile.hoverScale = 1;
        applyTile(tile);
      }
    };

    stage?.addEventListener("mousemove", onMouseMove);
    stage?.addEventListener("mouseleave", onMouseLeave);

    return () => {
      wrapper.removeEventListener("click", onTileClick);
      stage?.removeEventListener("mousemove", onMouseMove);
      stage?.removeEventListener("mouseleave", onMouseLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current = [];
      waveRef.current = () => {};
    };
    // mount-once wiring (tiles are static; wave is stored on a ref)
  }, []);

  /* Live loop — periodic diagonal waves while enabled and visible. */
  useEffect(() => {
    if (!liveOn) return;

    const kickoff = window.setTimeout(() => waveRef.current(false), 1000);
    const interval = window.setInterval(() => {
      if (!document.hidden) waveRef.current(false);
    }, 3800);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(interval);
    };
  }, [liveOn]);

  return (
    <div ref={stageRef} className="lm-stage">
      {/* Artwork — decorative */}
      <div ref={wrapperRef} className="lm-wrapper" aria-hidden="true">
        <svg
          className="lm-svg"
          viewBox="0 0 600 800"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="presentation"
        >
          <defs>
            {/* Architectural blueprint texture for focal tiles */}
            <pattern id="timeGridFine" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M 12 0 L 0 0 0 12" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* ==================== ROW 1 (y: 0..100) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "60ms" } as CSSProperties} data-row="0" data-col="0" data-kind="arc" d="M100 100 H0 A100 100 0 0 1 100 0 Z" fill="#D9E8F7" />
          <g className="lm-tile" style={{ "--tile-delay": "92ms" } as CSSProperties} data-row="0" data-col="1" data-kind="arc" data-electric="true">
            <path d="M100 100 V0 A100 100 0 0 1 200 100 Z" fill="#0066CC" />
            <path d="M100 100 V0 A100 100 0 0 1 200 100 Z" fill="url(#timeGridFine)" />
            <line x1="138" y1="7" x2="193" y2="100" stroke="#FFFFFF" strokeWidth="4" strokeOpacity="0.75" />
            <line x1="158" y1="42" x2="188" y2="25" stroke="#FFFFFF" strokeWidth="3" strokeOpacity="0.75" />
          </g>
          <path className="lm-tile" style={{ "--tile-delay": "124ms" } as CSSProperties} data-row="0" data-col="2" data-kind="arc" d="M300 100 H200 A100 100 0 0 1 300 0 Z" fill="#E5E5EA" />
          <path className="lm-tile" style={{ "--tile-delay": "156ms" } as CSSProperties} data-row="0" data-col="3" data-kind="leaf" d="M300 0 A100 100 0 0 1 400 100 A100 100 0 0 1 300 0 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
          <g className="lm-tile" style={{ "--tile-delay": "188ms" } as CSSProperties} data-row="0" data-col="4" data-kind="arc">
            <path d="M400 100 V0 A100 100 0 0 1 500 100 Z" fill="#424245" />
            <path d="M400 12 A88 88 0 0 1 488 100" stroke="#FFFFFF" strokeWidth="4" strokeOpacity="0.85" fill="none" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "220ms" } as CSSProperties} data-row="0" data-col="5" data-kind="arc">
            <path d="M500 100 V0 A100 100 0 0 1 600 100 Z" fill="#1D1D1F" />
            <path d="M500 100 V0 A100 100 0 0 1 600 100 Z" fill="url(#timeGridFine)" />
          </g>

          {/* ==================== ROW 2 (y: 100..200) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "108ms" } as CSSProperties} data-row="1" data-col="0" data-kind="arc" d="M100 100 V200 A100 100 0 0 1 0 100 Z" fill="#D9E8F7" />
          <path className="lm-tile" style={{ "--tile-delay": "140ms" } as CSSProperties} data-row="1" data-col="1" data-kind="arc" d="M100 100 H200 A100 100 0 0 1 100 200 Z" fill="#D9E8F7" />
          <path className="lm-tile" style={{ "--tile-delay": "172ms" } as CSSProperties} data-row="1" data-col="2" data-kind="arc" d="M200 100 H300 A100 100 0 0 1 200 200 Z" fill="#D2D2D7" />
          <circle className="lm-tile" style={{ "--tile-delay": "204ms" } as CSSProperties} data-row="1" data-col="3" data-kind="circle" cx="350" cy="150" r="48" fill="#E6F0FA" />
          <g className="lm-tile" style={{ "--tile-delay": "236ms" } as CSSProperties} data-row="1" data-col="4" data-kind="square">
            <rect x="400" y="100" width="100" height="100" fill="#424245" />
            <path d="M488 100 Q496 150 488 200" stroke="#FFFFFF" strokeWidth="4" strokeOpacity="0.85" fill="none" />
            <path d="M400 120 L500 105" stroke="#0066CC" strokeWidth="3" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "268ms" } as CSSProperties} data-row="1" data-col="5" data-kind="arc">
            <path d="M500 100 H600 A100 100 0 0 1 500 200 Z" fill="#1D1D1F" />
            <line x1="500" y1="158" x2="582" y2="146" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
          </g>

          {/* ==================== ROW 3 (y: 200..300) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "156ms" } as CSSProperties} data-row="2" data-col="0" data-kind="arc" d="M100 200 V300 A100 100 0 0 1 0 200 Z" fill="#D2D2D7" />
          <g className="lm-tile" style={{ "--tile-delay": "188ms" } as CSSProperties} data-row="2" data-col="1" data-kind="pill" data-electric="true">
            <path d="M100 300 V250 A50 50 0 0 1 200 250 V300 Z" fill="#0066CC" />
            <line x1="100" y1="224" x2="200" y2="206" stroke="#FFFFFF" strokeWidth="3.5" strokeOpacity="0.85" />
          </g>
          <path className="lm-tile" style={{ "--tile-delay": "220ms" } as CSSProperties} data-row="2" data-col="2" data-kind="arc" d="M200 200 H300 A100 100 0 0 1 200 300 Z" fill="#E5E5EA" />
          <path className="lm-tile" style={{ "--tile-delay": "252ms" } as CSSProperties} data-row="2" data-col="3" data-kind="arc" d="M400 300 H300 A100 100 0 0 1 400 200 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
          <path className="lm-tile" style={{ "--tile-delay": "284ms" } as CSSProperties} data-row="2" data-col="4" data-kind="arc" d="M400 300 V200 A100 100 0 0 1 500 300 Z" fill="#D2D2D7" />
          <path className="lm-tile" style={{ "--tile-delay": "316ms" } as CSSProperties} data-row="2" data-col="5" data-kind="arc" d="M600 200 V300 A100 100 0 0 1 500 200 Z" fill="#1D1D1F" />

          {/* ==================== ROW 4 (y: 300..400) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "204ms" } as CSSProperties} data-row="3" data-col="0" data-kind="arc" d="M100 300 V400 A100 100 0 0 1 0 300 Z" fill="#E6F0FA" />
          <g className="lm-tile" style={{ "--tile-delay": "236ms" } as CSSProperties} data-row="3" data-col="1" data-kind="arc" data-electric="true">
            <path d="M200 300 V400 A100 100 0 0 1 100 300 Z" fill="#0066CC" />
            <path d="M200 300 V400 A100 100 0 0 1 100 300 Z" fill="url(#timeGridFine)" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "268ms" } as CSSProperties} data-row="3" data-col="2" data-kind="circle" data-electric="true">
            <circle cx="250" cy="350" r="49" fill="#005BB5" />
            <circle cx="250" cy="350" r="49" fill="url(#timeGridFine)" />
          </g>
          <path className="lm-tile" style={{ "--tile-delay": "300ms" } as CSSProperties} data-row="3" data-col="3" data-kind="arc" d="M300 300 H400 A100 100 0 0 1 300 400 Z" fill="#D2D2D7" />
          <circle className="lm-tile" style={{ "--tile-delay": "332ms" } as CSSProperties} data-row="3" data-col="4" data-kind="circle" cx="450" cy="350" r="48" fill="#D9E8F7" />
          <path className="lm-tile" style={{ "--tile-delay": "364ms" } as CSSProperties} data-row="3" data-col="5" data-kind="arc" d="M500 400 V300 A100 100 0 0 1 600 400 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />

          {/* ==================== ROW 5 (y: 400..500) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "252ms" } as CSSProperties} data-row="4" data-col="0" data-kind="arc" d="M100 400 V500 A100 100 0 0 1 0 400 Z" fill="#D2D2D7" />
          <circle className="lm-tile" style={{ "--tile-delay": "284ms" } as CSSProperties} data-row="4" data-col="1" data-kind="circle" cx="150" cy="450" r="48" fill="#D2D2D7" />
          <path className="lm-tile" style={{ "--tile-delay": "316ms" } as CSSProperties} data-row="4" data-col="2" data-kind="pill" d="M200 400 H300 V450 A50 50 0 0 1 200 450 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
          <path className="lm-tile" style={{ "--tile-delay": "348ms" } as CSSProperties} data-row="4" data-col="3" data-kind="leaf" d="M400 400 A100 100 0 0 1 300 500 A100 100 0 0 1 400 400 Z" fill="#E5E5EA" />
          <path className="lm-tile" style={{ "--tile-delay": "380ms" } as CSSProperties} data-row="4" data-col="4" data-kind="arc" d="M400 500 V400 A100 100 0 0 1 500 500 Z" fill="#D2D2D7" />
          <g className="lm-tile" style={{ "--tile-delay": "412ms" } as CSSProperties} data-row="4" data-col="5" data-kind="arc" data-electric="true">
            <path d="M600 500 H500 A100 100 0 0 1 600 400 Z" fill="#0066CC" />
            <path d="M600 500 H500 A100 100 0 0 1 600 400 Z" fill="url(#timeGridFine)" />
            <line x1="518" y1="455" x2="600" y2="455" stroke="#FFFFFF" strokeWidth="2.5" strokeOpacity="0.7" />
          </g>

          {/* ==================== ROW 6 (y: 500..600) ==================== */}
          <path className="lm-tile" style={{ "--tile-delay": "300ms" } as CSSProperties} data-row="5" data-col="0" data-kind="arc" d="M100 600 H0 A100 100 0 0 1 100 500 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
          <g className="lm-tile" style={{ "--tile-delay": "332ms" } as CSSProperties} data-row="5" data-col="1" data-kind="square">
            <rect x="100" y="500" width="100" height="100" fill="#424245" />
            <rect x="100" y="500" width="100" height="100" fill="url(#timeGridFine)" />
          </g>
          <path className="lm-tile" style={{ "--tile-delay": "364ms" } as CSSProperties} data-row="5" data-col="2" data-kind="arc" d="M300 500 V600 A100 100 0 0 1 200 500 Z" fill="#D9E8F7" />
          <path className="lm-tile" style={{ "--tile-delay": "396ms" } as CSSProperties} data-row="5" data-col="3" data-kind="arc" d="M300 600 V500 A100 100 0 0 1 400 600 Z" fill="#D2D2D7" />
          <g className="lm-tile" style={{ "--tile-delay": "428ms" } as CSSProperties} data-row="5" data-col="4" data-kind="arc" data-electric="true">
            <path d="M500 600 H400 A100 100 0 0 1 500 500 Z" fill="#0066CC" />
            <line x1="422" y1="538" x2="495" y2="600" stroke="#FFFFFF" strokeWidth="3.5" strokeOpacity="0.85" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "460ms" } as CSSProperties} data-row="5" data-col="5" data-kind="arc" data-electric="true">
            <path d="M500 600 V500 A100 100 0 0 1 600 600 Z" fill="#0066CC" />
            <path d="M500 600 V500 A100 100 0 0 1 600 600 Z" fill="url(#timeGridFine)" />
          </g>

          {/* ==================== ROW 7 (y: 600..700) ==================== */}
          <g className="lm-tile" style={{ "--tile-delay": "348ms" } as CSSProperties} data-row="6" data-col="0" data-kind="circle">
            <circle cx="50" cy="650" r="49" fill="#424245" />
            <circle cx="50" cy="650" r="49" fill="url(#timeGridFine)" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "380ms" } as CSSProperties} data-row="6" data-col="1" data-kind="arc">
            <path d="M200 700 H100 A100 100 0 0 1 200 600 Z" fill="#1D1D1F" />
            <line x1="112" y1="686" x2="195" y2="640" stroke="#0066CC" strokeWidth="3.5" />
          </g>
          <path className="lm-tile" style={{ "--tile-delay": "412ms" } as CSSProperties} data-row="6" data-col="2" data-kind="arc" d="M300 700 H200 A100 100 0 0 1 300 600 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
          <path className="lm-tile" style={{ "--tile-delay": "444ms" } as CSSProperties} data-row="6" data-col="3" data-kind="arc" d="M400 600 V700 A100 100 0 0 1 300 600 Z" fill="#D2D2D7" />
          <path className="lm-tile" style={{ "--tile-delay": "476ms" } as CSSProperties} data-row="6" data-col="4" data-kind="arc" d="M400 600 H500 A100 100 0 0 1 400 700 Z" fill="#D2D2D7" />
          <circle className="lm-tile" style={{ "--tile-delay": "508ms" } as CSSProperties} data-row="6" data-col="5" data-kind="circle" cx="550" cy="650" r="48" fill="#E5E5EA" />

          {/* ==================== ROW 8 (y: 700..800) ==================== */}
          <g className="lm-tile" style={{ "--tile-delay": "396ms" } as CSSProperties} data-row="7" data-col="0" data-kind="arc">
            <path d="M0 700 H100 A100 100 0 0 1 0 800 Z" fill="#1D1D1F" />
            <line x1="0" y1="744" x2="88" y2="700" stroke="#FFFFFF" strokeWidth="3.5" strokeOpacity="0.85" />
          </g>
          <g className="lm-tile" style={{ "--tile-delay": "428ms" } as CSSProperties} data-row="7" data-col="1" data-kind="arc">
            <path d="M100 700 H200 A100 100 0 0 1 100 800 Z" fill="#424245" />
            <path d="M100 700 H200 A100 100 0 0 1 100 800 Z" fill="url(#timeGridFine)" />
          </g>
          <circle className="lm-tile" style={{ "--tile-delay": "460ms" } as CSSProperties} data-row="7" data-col="2" data-kind="circle" cx="250" cy="750" r="48" fill="#E5E5EA" />
          <path className="lm-tile" style={{ "--tile-delay": "492ms" } as CSSProperties} data-row="7" data-col="3" data-kind="arc" d="M400 700 V800 A100 100 0 0 1 300 700 Z" fill="#D9E8F7" />
          <path className="lm-tile" style={{ "--tile-delay": "524ms" } as CSSProperties} data-row="7" data-col="4" data-kind="arc" d="M500 700 V800 A100 100 0 0 1 400 700 Z" fill="#E6F0FA" />
          <path className="lm-tile" style={{ "--tile-delay": "556ms" } as CSSProperties} data-row="7" data-col="5" data-kind="pill" d="M500 800 V750 A50 50 0 0 1 600 750 V800 Z" fill="#FFFFFF" stroke="rgba(29,29,31,0.28)" strokeWidth="1.5" />
        </svg>
      </div>

    </div>
  );
}
