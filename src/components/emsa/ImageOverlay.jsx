import { useEffect, useRef, useState } from 'react';

export function ImageOverlay({
  imgSrc, imgW, imgH, lanes, setLanes, laneWidth, bands, setBands, roi,
  toolMode, onCropCommit, onEmsaCommit,
  excludeRegions, onExcludeCommit,
}) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [boxW, setBoxW] = useState(800);
  // Tool-mode drawing state — separate from `drag` so it never affects the existing handlers
  const [drawing, setDrawing] = useState(null); // { x0, y0, x1, y1 }

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => {
      for (const e of es) setBoxW(Math.floor(e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = imgW > 0 ? boxW / imgW : 1;
  const boxH = imgH * scale;

  function clientToImg(e) {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  const onDown = (kind, idx) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ kind, idx });
  };

  const onMove = (e) => {
    if (!drag) return;
    const p = clientToImg(e);
    if (drag.kind === "lane") {
      setLanes((ls) => {
        const out = ls.slice();
        out[drag.idx] = { ...out[drag.idx], x: Math.max(0, Math.min(imgW, p.x)) };
        return out;
      });
    } else if (drag.kind === "bandY") {
      setBands((b) => ({ ...b, [drag.idx]: Math.max(0, Math.min(imgH, p.y)) }));
    }
  };

  const onUp = () => setDrag(null);

  // Keep a handle drag alive even when the cursor leaves the image bounds (e.g. moving a
  // lane far up/down or a band boundary far left/right). Listeners live on window only
  // while a drag is active, and releasing anywhere ends it.
  useEffect(() => {
    if (!drag) return;
    const move = (e) => onMove(e);
    const up = () => onUp();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [drag]);

  const onDoubleClick = (e) => {
    if (drag) return;
    const p = clientToImg(e);
    setLanes((ls) =>
      [...ls, { x: p.x, label: `L${ls.length + 1}` }]
        .sort((a, b) => a.x - b.x)
        .map((l, i) => ({ ...l, label: `L${i + 1}` }))
    );
  };

  // ----- Tool-mode drawing (crop / bg) — completely separate from handle dragging -----
  // These handlers are attached to a transparent SVG <rect> that ONLY exists when
  // toolMode is set, so they cannot interfere with band/lane handle clicks.
  const onDrawDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = clientToImg(e);
    setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onDrawMove = (e) => {
    if (!drawing) return;
    const p = clientToImg(e);
    setDrawing((d) => ({ ...d, x1: p.x, y1: p.y }));
  };
  const onDrawUp = () => {
    if (!drawing) return;
    const x = Math.round(Math.min(drawing.x0, drawing.x1));
    const y = Math.round(Math.min(drawing.y0, drawing.y1));
    const w = Math.round(Math.abs(drawing.x1 - drawing.x0));
    const h = Math.round(Math.abs(drawing.y1 - drawing.y0));
    setDrawing(null);
    if (w < 5 || h < 5) return;
    if (toolMode === 'crop') onCropCommit({ x, y, w, h });
    else if (toolMode === 'emsa') onEmsaCommit({ x, y, w, h });
    else if (toolMode === 'exclude') onExcludeCommit({ x, y, w, h });
  };

  return (
    <div
      ref={wrapRef}
      className="img-wrap"
      style={{ height: boxH }}
      onDoubleClick={onDoubleClick}
      title="Double-click empty area to add a lane"
    >
      <img src={imgSrc} alt="gel" draggable={false} className="img-base" />
      <svg
        width={boxW}
        height={boxH}
        viewBox={`0 0 ${imgW} ${imgH}`}
        className="img-svg"
      >
        <defs>
          <pattern id="exclHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="rgba(124,45,18,0.10)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(124,45,18,0.55)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {roi && (
          <rect
            x={roi.x} y={roi.y} width={roi.w} height={roi.h}
            fill="none" stroke="var(--ink)" strokeOpacity="0.25"
            strokeDasharray="6 4" strokeWidth={Math.max(1, 2 / scale)}
          />
        )}

        {bands && roi && (
          <>
            <rect
              x={roi.x} y={Math.min(bands.boundY1, bands.boundY2)}
              width={roi.w}
              height={Math.abs(bands.boundY2 - bands.boundY1)}
              fill="var(--accent)" fillOpacity="0.10"
              stroke="var(--accent)" strokeOpacity="0.55"
              strokeWidth={Math.max(1, 1.5 / scale)}
            />
            <rect
              x={roi.x} y={Math.min(bands.freeY1, bands.freeY2)}
              width={roi.w}
              height={Math.abs(bands.freeY2 - bands.freeY1)}
              fill="var(--accent-2)" fillOpacity="0.10"
              stroke="var(--accent-2)" strokeOpacity="0.55"
              strokeWidth={Math.max(1, 1.5 / scale)}
            />
            {[
              ["boundY1", "var(--accent)", "BOUND ↑"],
              ["boundY2", "var(--accent)", "BOUND ↓"],
              ["freeY1", "var(--accent-2)", "FREE ↑"],
              ["freeY2", "var(--accent-2)", "FREE ↓"],
            ].map(([key, color, label]) => (
              <g key={key}>
                <line
                  x1={roi.x} y1={bands[key]}
                  x2={roi.x + roi.w} y2={bands[key]}
                  stroke={color}
                  strokeWidth={Math.max(1, 2 / scale)}
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={onDown("bandY", key)}
                />
                <rect
                  x={roi.x + roi.w + 4 / scale}
                  y={bands[key] - 9 / scale}
                  width={84 / scale}
                  height={18 / scale}
                  fill="var(--paper)"
                  stroke={color}
                  strokeWidth={Math.max(0.5, 1 / scale)}
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={onDown("bandY", key)}
                />
                <text
                  x={roi.x + roi.w + 10 / scale}
                  y={bands[key] + 4 / scale}
                  fontSize={11 / scale}
                  fill={color}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ cursor: "ns-resize", userSelect: "none" }}
                  onMouseDown={onDown("bandY", key)}
                >
                  {label}
                </text>
              </g>
            ))}
          </>
        )}

        {lanes.map((l, i) => {
          const x1 = l.x - laneWidth / 2;
          const ry = roi?.y ?? 0;
          const rh = roi?.h ?? imgH;
          return (
            <g key={i}>
              <rect
                x={x1} y={ry} width={laneWidth} height={rh}
                fill="var(--ink)" fillOpacity="0.04"
                stroke="var(--ink)" strokeOpacity="0.5"
                strokeWidth={Math.max(0.5, 1 / scale)}
                pointerEvents="none"
              />
              <line
                x1={l.x} y1={ry} x2={l.x} y2={ry + rh}
                stroke="var(--ink)" strokeOpacity="0.7"
                strokeWidth={Math.max(0.5, 1.5 / scale)}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
              <circle
                cx={l.x} cy={ry - 14 / scale}
                r={9 / scale}
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth={Math.max(0.5, 1.2 / scale)}
                style={{ cursor: "ew-resize" }}
                onMouseDown={onDown("lane", i)}
              />
              <text
                x={l.x} y={ry - 11 / scale}
                fontSize={10 / scale}
                textAnchor="middle"
                fill="var(--ink)"
                fontFamily="JetBrains Mono, monospace"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {l.label}
              </text>
            </g>
          );
        })}

        {/* Excluded regions — imaging artefacts (bubbles, fingerprints) voided from quant.
            Always visible, never interactive. Hatched to read as "cut out". */}
        {excludeRegions && excludeRegions.length > 0 && (
          <g pointerEvents="none">
            {excludeRegions.map((r, i) => (
              <g key={i}>
                <rect
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  fill="url(#exclHatch)" stroke="#7c2d12"
                  strokeWidth={Math.max(1, 1.5 / scale)} strokeDasharray="4 3"
                />
                <text x={r.x + 4} y={r.y + 13} fontSize={Math.max(9, 12 / scale)}
                      fill="#7c2d12" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                  EXCL{excludeRegions.length > 1 ? ` ${i + 1}` : ''}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Tool-mode capture rect — only exists when drawing a crop or bg region.
            When toolMode is null (default), this isn't rendered, so band/lane handles work normally. */}
        {toolMode && (
          <rect
            x={0} y={0} width={imgW} height={imgH}
            fill="rgba(0,0,0,0)"
            pointerEvents="all"
            style={{ cursor: 'crosshair' }}
            onMouseDown={onDrawDown}
            onMouseMove={onDrawMove}
            onMouseUp={onDrawUp}
            onMouseLeave={onDrawUp}
          />
        )}

        {/* Live drawing preview — non-interactive */}
        {drawing && (
          <rect
            x={Math.min(drawing.x0, drawing.x1)}
            y={Math.min(drawing.y0, drawing.y1)}
            width={Math.abs(drawing.x1 - drawing.x0)}
            height={Math.abs(drawing.y1 - drawing.y0)}
            fill={toolMode === 'exclude' ? 'rgba(124,45,18,0.18)' : toolMode === 'crop' ? 'rgba(37,99,235,0.12)' : 'rgba(26,24,22,0.12)'}
            stroke={toolMode === 'exclude' ? '#7c2d12' : toolMode === 'crop' ? '#2563eb' : '#1a1816'}
            strokeWidth={Math.max(1.5, 2 / scale)}
            strokeDasharray="5 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

