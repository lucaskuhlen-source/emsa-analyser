import { useState, useRef, useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ErrorBar } from 'recharts';
import { fmtKd } from '@/lib/emsa/format';
import { aggregate, sharedGrid, shapeHill, tVal } from '@/lib/emsa/stats';

// Aggregate colour for the mean fit / mean±SEM points — deliberately distinct from the
// shared replicate PALETTE so it reads clearly over the faint per-replicate guides.
const AGG = "#2b6cb0";

const TRIPLICATE_CSS = `
.tr-root { max-width: 1180px; margin: 0 auto; padding: 28px 32px 80px; position: relative; z-index: 1; font-family: 'IBM Plex Sans', sans-serif; color: var(--ink); }
.tr-root .tr-h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 40px; line-height: 1; margin: 0 0 4px; color: var(--ink); }
.tr-sub { color: var(--ink-2); font-size: 13px; margin: 0 0 22px; max-width: 720px; line-height: 1.5; }
.tr-panel { background: var(--paper-3); border: 1px solid var(--rule); border-radius: 10px; }
.tr-drop { padding: 26px; border: 1.5px dashed var(--rule); border-radius: 10px; text-align: center; color: var(--ink-2); font-size: 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.tr-drop.hot { border-color: var(--accent); background: var(--paper-2); color: var(--accent); }
.tr-grid { display: grid; grid-template-columns: 360px 1fr; gap: 18px; margin-top: 18px; align-items: start; }
@media (max-width: 880px) { .tr-grid { grid-template-columns: 1fr; } }
.tr-crow { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--rule); }
.tr-crow:last-child { border-bottom: none; }
.tr-swatch { width: 13px; height: 13px; border-radius: 3px; flex: none; }
.tr-crow input[type=text] { border: 1px solid transparent; background: transparent; font: inherit; font-size: 13px; padding: 3px 5px; border-radius: 5px; width: 100%; color: var(--ink); }
.tr-crow input[type=text]:hover { border-color: var(--rule); }
.tr-crow input[type=text]:focus { outline: none; border-color: var(--accent); background: var(--paper); }
.tr-kd { font-size: 12px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.tr-rm { border: none; background: none; color: var(--ink-2); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }
.tr-rm:hover { color: var(--accent); }
.tr-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 0 10px 10px; }
.tr-act { border: 1px solid var(--rule); background: var(--paper); padding: 7px 13px; border-radius: 7px; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink); }
.tr-act:hover { border-color: var(--accent); color: var(--accent); }
.tr-err { color: var(--accent); font-size: 12px; padding: 6px 2px; font-family: 'JetBrains Mono', monospace; }
.tr-hd { padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--ink-2); border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: .04em; }
.tr-sum { padding: 14px 14px 16px; }
.tr-big { font-size: 15px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; font-family: 'JetBrains Mono', monospace; }
.tr-ci { color: var(--ink-2); font-size: 13px; font-variant-numeric: tabular-nums; margin-top: 2px; font-family: 'JetBrains Mono', monospace; }
.tr-metrics { display: flex; gap: 20px; margin-top: 12px; flex-wrap: wrap; }
.tr-metric .v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.tr-metric .l { font-size: 11px; color: var(--ink-2); text-transform: uppercase; letter-spacing: .04em; }
.tr-badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-2); margin-left: 8px; vertical-align: 2px; text-transform: none; letter-spacing: 0; }
.tr-badge.match { color: #2d8659; border-color: #bfe3ce; background: #f0f8f3; }
.tr-badge.nomatch { color: #b9770e; border-color: #f0dcb0; background: #fbf5e8; }
.tr-note { font-size: 12px; color: var(--ink-2); padding: 0 14px 14px; line-height: 1.5; }
.tr-tbl { width: 100%; border-collapse: collapse; font-size: 12px; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.tr-tbl th { text-align: right; font-weight: 600; color: var(--ink-2); padding: 6px 10px; border-bottom: 1px solid var(--rule); }
.tr-tbl th:first-child, .tr-tbl td:first-child { text-align: left; }
.tr-tbl td { padding: 6px 10px; border-bottom: 1px solid var(--rule); }
.tr-tbl tr:last-child td { border-bottom: none; }
.tr-hint { color: var(--ink-2); font-size: 13px; padding: 16px; text-align: center; }
`;

export function TriplicateApp({ reps, ingestFiles, rename, remove, err }) {
  const [hot, setHot] = useState(false);
  const inputRef = useRef(null);
  const chartRef = useRef(null);

  const agg = useMemo(() => (reps.length ? aggregate(reps) : null), [reps]);
  const grid = useMemo(() => sharedGrid(reps), [reps]);
  const matched = grid.matched;

  // shared log x-range across all replicates
  const positives = reps.flatMap((c) => c.xs.filter((x) => x > 0));
  const xmin = positives.length ? Math.min(...positives) : 1;
  const xmax = positives.length ? Math.max(...positives) : 1000;
  const lo = Math.log10(xmin * 0.6), hi = Math.log10(xmax * 1.4);
  const N = 140;
  const norm = (c, y) => {
    const span = c.fit.Bmax - c.fit.bottom;
    return span > 1e-9 ? (y - c.fit.bottom) / span : y;
  };

  // fitted lines: one per replicate, plus an aggregate curve when matched
  const lineData = [];
  for (let i = 0; i <= N; i++) {
    const x = Math.pow(10, lo + (hi - lo) * (i / N));
    const row = { x };
    reps.forEach((c) => { row["c" + c.id] = norm(c, c.fit.model(x)); });
    if (matched && agg) row.magg = shapeHill(x, agg.geoKd, agg.nMean); // normalised [0,1]
    lineData.push(row);
  }
  // per-replicate normalised points (used when grids do NOT match)
  const ptData = reps.flatMap((c) => c.xs.map((x, i) =>
    x > 0 ? { x, ["p" + c.id]: norm(c, c.ys[i]) } : null).filter(Boolean));
  // mean +/- SEM points (used when grids match)
  const meanPtData = matched ? grid.meanPts.map((p) => ({ x: p.x, my: p.mean, sem: p.sem })) : [];

  const ticks = (() => {
    const t = [];
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++)
      [1, 2, 5].forEach((m) => {
        const v = m * Math.pow(10, e);
        if (v >= Math.pow(10, lo) && v <= Math.pow(10, hi)) t.push(v);
      });
    return t;
  })();

  const exportPng = () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg || !agg) return;
    const clone = svg.cloneNode(true);
    const w = svg.clientWidth || 760, h = svg.clientHeight || 460;
    clone.setAttribute("width", w); clone.setAttribute("height", h);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const scale = 3, pad = 16, lineH = 20;
      const l1 = matched
        ? `Kd = ${fmtKd(agg.geoKd)} nM   95% CI ${fmtKd(agg.ciLo)}–${fmtKd(agg.ciHi)}`
        : `Kd = ${fmtKd(agg.geoKd)} nM   range ${fmtKd(agg.kdMin)}–${fmtKd(agg.kdMax)}`;
      const l2 = `n = ${agg.n} replicates` + (agg.cvPct != null ? `   CV = ${agg.cvPct.toFixed(1)}%` : "");
      const footH = pad + 2 * lineH;
      const cv = document.createElement("canvas");
      cv.width = w * scale; cv.height = (h + footH) * scale;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#f9f4e9"; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.textBaseline = "middle"; ctx.fillStyle = "#1a1816";
      ctx.font = "650 14px 'IBM Plex Sans', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      ctx.fillText(l1, pad, h + pad + 2);
      ctx.font = "400 13px 'IBM Plex Sans', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      ctx.fillStyle = "#4a453d";
      ctx.fillText(l2, pad, h + pad + lineH + 2);
      cv.toBlob((b) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const a = document.createElement("a");
          a.href = e.target.result;
          a.download = "emsa_triplicate.png";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        reader.readAsDataURL(b);
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  return (
    <div className="tr-root">
      <style>{TRIPLICATE_CSS}</style>
      <h1 className="tr-h1">EMSA Triplicate</h1>
      <p className="tr-sub">
        Combine replicate titrations of the <em>same</em> interaction. Each replicate is Hill-fit
        independently; the reported K<sub>d</sub> is the geometric mean of the replicate fits, with a
        95% CI built across replicates. When all replicates share a concentration grid, per-point
        mean&nbsp;&plusmn;&nbsp;SEM is shown; otherwise a K<sub>d</sub> range is reported. Use
        &ldquo;Add to triplicate&rdquo; on the analysis tab, or drop exported CSVs below.
      </p>

      <div
        className={"tr-drop" + (hot ? " hot" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); ingestFiles(e.dataTransfer.files); }}
      >
        Drop replicate quantification CSVs here, or click to choose
        <input ref={inputRef} type="file" accept=".csv" multiple style={{ display: "none" }}
          onChange={(e) => ingestFiles(e.target.files)} />
      </div>
      {err && <div className="tr-err">{err}</div>}

      {reps.length > 0 && (
        <div className="tr-grid">
          <div>
            <div className="tr-panel">
              <div className="tr-hd">Replicates</div>
              {reps.map((c) => (
                <div className="tr-crow" key={c.id}>
                  <span className="tr-swatch" style={{ background: c.color }} />
                  <input type="text" value={c.name} onChange={(e) => rename(c.id, e.target.value)} />
                  <span className="tr-kd">K<sub>d</sub> {fmtKd(c.fit.Kd)} nM</span>
                  <button className="tr-rm" title="Remove" onClick={() => remove(c.id)}>&times;</button>
                </div>
              ))}
            </div>

            {agg && (
              <div className="tr-panel" style={{ marginTop: 18 }}>
                <div className="tr-hd">
                  Result
                  <span className={"tr-badge " + (matched ? "match" : "nomatch")}>
                    {matched ? "grids matched" : "grids differ"}
                  </span>
                </div>
                {agg.n < 2 ? (
                  <div className="tr-hint">Add at least one more replicate (3 recommended) to compute replicate statistics.</div>
                ) : (
                  <>
                    <div className="tr-sum">
                      <div className="tr-big">K<sub>d</sub> = {fmtKd(agg.geoKd)} nM</div>
                      <div className="tr-ci">
                        {matched
                          ? <>95% CI  {fmtKd(agg.ciLo)}&ndash;{fmtKd(agg.ciHi)} nM</>
                          : <>range  {fmtKd(agg.kdMin)}&ndash;{fmtKd(agg.kdMax)} nM</>}
                      </div>
                      <div className="tr-metrics">
                        <div className="tr-metric">
                          <div className="v">{agg.cvPct.toFixed(1)}%</div>
                          <div className="l">CV</div>
                        </div>
                        <div className="tr-metric">
                          <div className="v">{agg.n}</div>
                          <div className="l">replicates</div>
                        </div>
                        <div className="tr-metric">
                          <div className="v">{agg.nMean.toFixed(2)}{agg.nSD ? ` ± ${agg.nSD.toFixed(2)}` : ""}</div>
                          <div className="l">Hill n</div>
                        </div>
                      </div>
                    </div>
                    <table className="tr-tbl">
                      <thead><tr><th>Replicate</th><th>K<sub>d</sub> (nM)</th><th>Hill n</th><th>R&sup2;</th></tr></thead>
                      <tbody>
                        {reps.map((c) => (
                          <tr key={c.id}>
                            <td>{c.name}</td>
                            <td>{fmtKd(c.fit.Kd)}</td>
                            <td>{c.fit.n.toFixed(2)}</td>
                            <td>{Number.isFinite(c.fit.r2) ? c.fit.r2.toFixed(3) : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="tr-note">
                      Geometric mean of replicate fits; 95% CI from the t-distribution
                      (df = {agg.n - 1}, t* = {tVal(agg.n).toFixed(3)}) in log space. CV is the
                      arithmetic SD/mean of the replicate K<sub>d</sub> values — a reproducibility
                      measure across gels, not a single-gel fit uncertainty.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="tr-panel" style={{ padding: "10px 8px 4px" }}>
            <div ref={chartRef} style={{ width: "100%", height: 460 }}>
              <ResponsiveContainer>
                <ComposedChart margin={{ top: 16, right: 24, bottom: 44, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeOpacity={0.5} />
                  <XAxis dataKey="x" type="number" scale="log"
                    domain={[Math.pow(10, lo), Math.pow(10, hi)]} ticks={ticks}
                    allowDuplicatedCategory={false}
                    tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(+v.toPrecision(2)))}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "[protein]  (nM)", position: "insideBottom", offset: -22, fontSize: 13, fill: "var(--ink)" }} />
                  <YAxis domain={[-0.05, 1.08]} ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "fraction bound (normalised)", angle: -90, position: "insideLeft", offset: 14, fontSize: 13, fill: "var(--ink)", style: { textAnchor: "middle" } }} />
                  <Tooltip formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)}
                    labelFormatter={(v) => `[protein] ${(+v).toPrecision(3)} nM`} />
                  <Legend verticalAlign="top" height={28} />

                  {/* replicate fitted curves: bold when grids differ, faint guides when matched */}
                  {reps.map((c) => (
                    <Line key={"l" + c.id} data={lineData} dataKey={"c" + c.id} type="monotone"
                      stroke={c.color} strokeWidth={matched ? 1.1 : 2}
                      strokeOpacity={matched ? 0.4 : 1} dot={false} isAnimationActive={false}
                      name={matched ? undefined : c.name} legendType={matched ? "none" : "line"} />
                  ))}

                  {matched ? (
                    <>
                      <Line data={lineData} dataKey="magg" type="monotone" stroke={AGG}
                        strokeWidth={2.5} dot={false} isAnimationActive={false} name="mean fit" />
                      <Scatter data={meanPtData} dataKey="my" fill={AGG} name={"mean ± SEM"}
                        isAnimationActive={false}>
                        <ErrorBar dataKey="sem" width={4} strokeWidth={1.5} stroke={AGG} direction="y" />
                      </Scatter>
                    </>
                  ) : (
                    reps.map((c) => (
                      <Scatter key={"s" + c.id} data={ptData} dataKey={"p" + c.id}
                        fill={c.color} isAnimationActive={false} legendType="none" />
                    ))
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="tr-toolbar">
              <button className="tr-act" onClick={exportPng}>Export PNG</button>
              <span className="tr-kd" style={{ marginLeft: "auto" }}>
                {reps.length} replicate{reps.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
