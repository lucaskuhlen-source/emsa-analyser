import { useState, useRef } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { fmtKd, legendLabel, byKd } from '@/lib/emsa/format';

export const OVERLAY_CSS = `
.ov-root { max-width: 1180px; margin: 0 auto; padding: 28px 32px 80px; position: relative; z-index: 1; font-family: 'IBM Plex Sans', sans-serif; color: var(--ink); }
.ov-root .ov-h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 40px; line-height: 1; margin: 0 0 4px; color: var(--ink); }
.ov-sub { color: var(--ink-2); font-size: 13px; margin: 0 0 22px; max-width: 700px; line-height: 1.5; }
.ov-panel { background: var(--paper-3); border: 1px solid var(--rule); border-radius: 10px; }
.ov-drop { padding: 26px; border: 1.5px dashed var(--rule); border-radius: 10px; text-align: center; color: var(--ink-2); font-size: 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.ov-drop.hot { border-color: var(--accent); background: var(--paper-2); color: var(--accent); }
.ov-grid { display: grid; grid-template-columns: 340px 1fr; gap: 18px; margin-top: 18px; align-items: start; }
@media (max-width: 880px) { .ov-grid { grid-template-columns: 1fr; } }
.ov-crow { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--rule); }
.ov-crow:last-child { border-bottom: none; }
.ov-swatch { width: 13px; height: 13px; border-radius: 3px; flex: none; }
.ov-crow input[type=text] { border: 1px solid transparent; background: transparent; font: inherit; font-size: 13px; padding: 3px 5px; border-radius: 5px; width: 100%; color: var(--ink); }
.ov-crow input[type=text]:hover { border-color: var(--rule); }
.ov-crow input[type=text]:focus { outline: none; border-color: var(--accent); background: var(--paper); }
.ov-kd { font-size: 12px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.ov-rm { border: none; background: none; color: var(--ink-2); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }
.ov-rm:hover { color: var(--accent); }
.ov-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 0 10px 10px; }
.ov-act { border: 1px solid var(--rule); background: var(--paper); padding: 7px 13px; border-radius: 7px; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink); }
.ov-act:hover { border-color: var(--accent); color: var(--accent); }
.ov-err { color: var(--accent); font-size: 12px; padding: 6px 2px; font-family: 'JetBrains Mono', monospace; }
.ov-hd { padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--ink-2); border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: .04em; }
`;

export function OverlayApp({ curves, ingestFiles, rename, remove, err }) {
  const [hot, setHot] = useState(false);
  const inputRef = useRef(null);
  const chartRef = useRef(null);

  const positives = curves.flatMap((c) => c.xs.filter((x) => x > 0));
  const xmin = positives.length ? Math.min(...positives) : 1;
  const xmax = positives.length ? Math.max(...positives) : 1000;
  const lo = Math.log10(xmin * 0.6), hi = Math.log10(xmax * 1.4);
  const N = 140;
  const norm = (c, y) => {
    const span = c.fit.Bmax - c.fit.bottom;
    return span > 1e-9 ? (y - c.fit.bottom) / span : y;
  };
  const lineData = [];
  for (let i = 0; i <= N; i++) {
    const x = Math.pow(10, lo + (hi - lo) * (i / N));
    const row = { x };
    curves.forEach((c) => { row["c" + c.id] = norm(c, c.fit.model(x)); });
    lineData.push(row);
  }
  const ptData = curves.flatMap((c) =>
    c.xs.map((x, i) => (x > 0 ? { x, ["p" + c.id]: norm(c, c.ys[i]) } : null)).filter(Boolean)
  );
  const ticks = (() => {
    const t = [];
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
      [1, 2, 5].forEach((m) => {
        const v = m * Math.pow(10, e);
        if (v >= Math.pow(10, lo) && v <= Math.pow(10, hi)) t.push(v);
      });
    }
    return t;
  })();

  const exportPng = () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const w = svg.clientWidth || 760, h = svg.clientHeight || 460;
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const lpad = 16, rowH = 20, sw = 13, gap = 8;
      const rows = byKd(curves).map((c) => ({ label: legendLabel(c), color: c.color }));
      const legendH = rows.length ? lpad + rows.length * rowH + 6 : 0;
      const cv = document.createElement("canvas");
      cv.width = w * scale;
      cv.height = (h + legendH) * scale;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#f9f4e9";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.textBaseline = "middle";
      ctx.font = "600 13px 'IBM Plex Sans', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      rows.forEach((r, i) => {
        const y = h + lpad + i * rowH;
        ctx.fillStyle = r.color;
        ctx.fillRect(lpad, y - sw / 2, sw, sw);
        ctx.fillStyle = "#1a1816";
        ctx.fillText(r.label, lpad + sw + gap, y + 1);
      });
      cv.toBlob((b) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const a = document.createElement("a");
          a.href = e.target.result;
          a.download = "emsa_overlay.png";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        reader.readAsDataURL(b);
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  return (
    <div className="ov-root">
      <style>{OVERLAY_CSS}</style>
      <h1 className="ov-h1">EMSA Overlay</h1>
      <p className="ov-sub">
        Overlay multiple EMSA titrations on one normalised axis. Each curve is Hill-fit and scaled
        between its own fitted baseline (0) and plateau (1). Use &ldquo;Add to overlay&rdquo; on the
        analysis tab, or drop exported CSVs below.
      </p>
      <div
        className={"ov-drop" + (hot ? " hot" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); ingestFiles(e.dataTransfer.files); }}
      >
        Drop EMSA quantification CSVs here, or click to choose
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          style={{ display: "none" }}
          onChange={(e) => ingestFiles(e.target.files)}
        />
      </div>
      {err && <div className="ov-err">{err}</div>}
      {curves.length > 0 && (
        <div className="ov-grid">
          <div className="ov-panel">
            <div className="ov-hd">Curves</div>
            {curves.map((c) => (
              <div className="ov-crow" key={c.id}>
                <span className="ov-swatch" style={{ background: c.color }} />
                <input type="text" value={c.name} onChange={(e) => rename(c.id, e.target.value)} />
                <span className="ov-kd">K<sub>d</sub> {fmtKd(c.fit.Kd)} nM</span>
                <button className="ov-rm" title="Remove" onClick={() => remove(c.id)}>&times;</button>
              </div>
            ))}
          </div>
          <div className="ov-panel" style={{ padding: "10px 8px 4px" }}>
            <div ref={chartRef} style={{ width: "100%", height: 460 }}>
              <ResponsiveContainer>
                <ComposedChart margin={{ top: 16, right: 24, bottom: 44, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="log"
                    domain={[Math.pow(10, lo), Math.pow(10, hi)]}
                    ticks={ticks}
                    allowDuplicatedCategory={false}
                    tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(+v.toPrecision(2)))}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "[protein]  (nM)", position: "insideBottom", offset: -22, fontSize: 13, fill: "var(--ink)" }}
                  />
                  <YAxis
                    domain={[-0.05, 1.08]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "fraction bound (normalised)", angle: -90, position: "insideLeft", offset: 14, fontSize: 13, fill: "var(--ink)", style: { textAnchor: "middle" } }}
                  />
                  <Tooltip
                    formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)}
                    labelFormatter={(v) => `[protein] ${(+v).toPrecision(3)} nM`}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    payload={byKd(curves).map((c) => ({ value: legendLabel(c), type: "line", color: c.color }))}
                  />
                  {curves.map((c) => (
                    <Line key={"l" + c.id} data={lineData} dataKey={"c" + c.id} type="monotone" stroke={c.color} strokeWidth={2} dot={false} isAnimationActive={false} name={c.name} />
                  ))}
                  {curves.map((c) => (
                    <Scatter key={"s" + c.id} data={ptData} dataKey={"p" + c.id} fill={c.color} isAnimationActive={false} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="ov-toolbar">
              <button className="ov-act" onClick={exportPng}>Export PNG</button>
              <span className="ov-kd" style={{ marginLeft: "auto" }}>
                {curves.length} curve{curves.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
