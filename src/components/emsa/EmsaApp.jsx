import { useState, useRef, useCallback, useEffect } from 'react';
import { Beaker, Layers, Sigma, Info } from 'lucide-react';
import { fitBinding } from '@/lib/emsa/curveFit';
import { PALETTE, nameFromFile } from '@/lib/emsa/format';
import { parseCsv } from '@/lib/emsa/csv';
import { AnalyzerApp } from './AnalyzerApp';
import { OverlayApp } from './OverlayApp';
import { TriplicateApp } from './TriplicateApp';

const TABBAR_CSS = `
.emsa-shell { background: var(--paper); min-height: 100vh; }
.emsa-tabbar { max-width: 1180px; margin: 0 auto; padding: 20px 32px 0; display: flex; gap: 8px; position: relative; z-index: 2; }
.emsa-tab { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; padding: 9px 16px; border: 1px solid var(--rule); border-bottom: none; border-radius: 7px 7px 0 0; background: var(--paper-3); color: var(--ink-2); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background .12s, color .12s; }
.emsa-tab:hover { color: var(--ink); }
.emsa-tab.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.emsa-tab .ct { font-family: 'JetBrains Mono', monospace; font-size: 10px; background: var(--accent); color: #fff; border-radius: 10px; padding: 1px 7px; line-height: 1.4; }
.emsa-info { align-self: center; display: inline-flex; align-items: center; justify-content: center; width: 23px; height: 23px; margin-left: 10px; padding: 0; border: 1px solid var(--rule); border-radius: 50%; background: var(--paper-3); color: var(--ink-2); cursor: pointer; transition: color .12s, border-color .12s; }
.emsa-info:hover, .emsa-info.open { color: var(--accent); border-color: var(--accent); }
/* Anchored to the tab bar (not the button) so it can never overflow the content column. */
.emsa-help { position: absolute; top: 100%; left: 32px; right: 32px; max-width: 640px; z-index: 30; margin-top: 6px; padding: 18px 20px 16px; background: var(--paper); border: 1px solid var(--ink); border-radius: 10px; box-shadow: 0 14px 38px rgba(26,24,22,0.18); font-family: 'IBM Plex Sans', sans-serif; color: var(--ink); }
.emsa-help h4 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 21px; margin: 0 0 2px; }
.emsa-help .lead { font-size: 12.5px; color: var(--ink-2); line-height: 1.55; margin: 0 0 12px; }
.emsa-help ol { margin: 0; padding-left: 17px; }
.emsa-help li { font-size: 12.5px; line-height: 1.6; margin-bottom: 9px; }
.emsa-help li b { font-weight: 600; }
.emsa-help .k { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: var(--paper-2); border: 1px solid var(--rule); border-radius: 4px; padding: 0 4px; }
.emsa-help .foot { margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--rule); font-size: 11.5px; color: var(--ink-2); line-height: 1.6; }
.emsa-help-x { position: absolute; top: 9px; right: 11px; border: none; background: none; color: var(--ink-2); font-size: 17px; line-height: 1; cursor: pointer; padding: 2px 5px; }
.emsa-help-x:hover { color: var(--accent); }
`;

export function EmsaApp() {
  const [tab, setTab] = useState("analyze");

  // "How to run an EMSA analysis" popover. Parked at the right-hand end of the tab bar
  // (past Triplicate) but it documents the main analysis workflow, not that tab.
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef(null);
  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setHelpOpen(false); };
    const onDown = (e) => { if (helpRef.current && !helpRef.current.contains(e.target)) setHelpOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [helpOpen]);

  // Overlay tab curves
  const [curves, setCurves] = useState([]); // {id,name,color,xs,ys,fit,kdLo,kdHi}
  const [ovErr, setOvErr] = useState("");
  const idRef = useRef(0);

  // Triplicate tab replicates
  const [reps, setReps] = useState([]); // {id,name,color,xs,ys,fit}
  const [trErr, setTrErr] = useState("");
  const repIdRef = useRef(0);

  const ingestText = useCallback((text, name) => {
    const parsed = parseCsv(text);
    if (!parsed) { setOvErr(`Couldn't read ${name} — need a [protein]/conc column and a fraction_bound column.`); return false; }
    const fit = fitBinding(parsed.xs, parsed.ys, { model: "hill" });
    if (!fit) { setOvErr(`Fit failed for ${name}.`); return false; }
    setOvErr("");
    setCurves((prev) => [
      ...prev,
      { id: idRef.current++, name, color: PALETTE[prev.length % PALETTE.length], ...parsed, fit },
    ]);
    return true;
  }, []);

  const ingestFiles = useCallback((files) => {
    const arr = Array.from(files || []).filter((f) => /\.csv$/i.test(f.name));
    if (!arr.length) { setOvErr("Drop .csv files exported from the EMSA Analyzer."); return; }
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => ingestText(String(reader.result), nameFromFile(file.name));
      reader.readAsText(file);
    });
  }, [ingestText]);

  const addFromAnalyzer = useCallback((csv) => {
    ingestText(csv, "EMSA " + (idRef.current + 1));
  }, [ingestText]);

  const rename = useCallback((id, name) => setCurves((p) => p.map((c) => (c.id === id ? { ...c, name } : c))), []);
  const remove = useCallback((id) => setCurves((p) => p.filter((c) => c.id !== id)), []);

  // ---- Triplicate: same tolerant CSV ingest + Hill fit, kept in its own state ----
  const ingestRepText = useCallback((text, name) => {
    const parsed = parseCsv(text);
    if (!parsed) { setTrErr(`Couldn't read ${name} — need a [protein]/conc column and a fraction_bound column.`); return false; }
    const fit = fitBinding(parsed.xs, parsed.ys, { model: "hill" });
    if (!fit) { setTrErr(`Fit failed for ${name}.`); return false; }
    setTrErr("");
    setReps((prev) => [
      ...prev,
      { id: repIdRef.current++, name, color: PALETTE[prev.length % PALETTE.length], xs: parsed.xs, ys: parsed.ys, fit },
    ]);
    return true;
  }, []);

  const ingestRepFiles = useCallback((files) => {
    const arr = Array.from(files || []).filter((f) => /\.csv$/i.test(f.name));
    if (!arr.length) { setTrErr("Drop .csv files exported from the EMSA Analyzer."); return; }
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => ingestRepText(String(reader.result), nameFromFile(file.name));
      reader.readAsText(file);
    });
  }, [ingestRepText]);

  const addRepFromAnalyzer = useCallback((csv) => {
    ingestRepText(csv, "Rep " + (repIdRef.current + 1));
  }, [ingestRepText]);

  const renameRep = useCallback((id, name) => setReps((p) => p.map((c) => (c.id === id ? { ...c, name } : c))), []);
  const removeRep = useCallback((id) => setReps((p) => p.filter((c) => c.id !== id)), []);

  return (
    <>
      <style>{TABBAR_CSS}</style>
      <div className="emsa-shell">
        <div className="emsa-tabbar">
          <button className={"emsa-tab" + (tab === "analyze" ? " active" : "")} onClick={() => setTab("analyze")}>
            <Beaker size={13} /> EMSA analysis
          </button>
          <button className={"emsa-tab" + (tab === "overlay" ? " active" : "")} onClick={() => setTab("overlay")}>
            <Layers size={13} /> Overlay
            {curves.length > 0 && <span className="ct">{curves.length}</span>}
          </button>
          <button className={"emsa-tab" + (tab === "triplicate" ? " active" : "")} onClick={() => setTab("triplicate")}>
            <Sigma size={13} /> Triplicate
            {reps.length > 0 && <span className="ct">{reps.length}</span>}
          </button>
          <button
            className={"emsa-info" + (helpOpen ? " open" : "")}
            onClick={() => setHelpOpen((v) => !v)}
            aria-expanded={helpOpen}
            aria-label="How to run an EMSA analysis"
            title="How to run an EMSA analysis"
          >
            <Info size={13} />
          </button>

          {helpOpen && (
            <div className="emsa-help" ref={helpRef} role="dialog" aria-label="How to run an EMSA analysis">
              <button className="emsa-help-x" onClick={() => setHelpOpen(false)} aria-label="Close">&times;</button>
              <h4>How to run an EMSA analysis</h4>
              <p className="lead">
                Work down the numbered sections on the analysis tab. Nothing is placed for you on
                upload &mdash; every region is yours to confirm.
              </p>
              <ol>
                <li><b>Load the gel.</b> Drag in a TIFF, PNG or JPEG. Luminance is inverted so dark bands become positive signal; 16-bit TIFFs are read at full depth.</li>
                <li><b>Straighten, then crop.</b> Use the rotate slider if the lanes are tilted &mdash; safe at any time, placements are kept. <span className="k">Crop image</span> discards everything outside the box; <span className="k">Draw EMSA area</span> limits auto-detect without cropping.</li>
                <li><b>Place the lanes.</b> Hit auto-detect, or double-click to add lanes by hand. Set lane width so each box covers its band but not its neighbours.</li>
                <li><b>Set the bound and free windows.</b> Drag the two coloured bands onto the complex and the free probe. Each should span the whole band plus a little flat baseline.</li>
                <li><b>Void any artefacts.</b> <span className="k">Draw exclusion region</span> over bubbles, dust or fingerprints &mdash; those pixels are dropped from the integration.</li>
                <li><b>Check the background.</b> Global rolling-ball and per-lane ALS are both on by default. Open a lane&rsquo;s QC trace and confirm the baseline sits just under the trace between the bands; raise &lambda; for a straighter baseline.</li>
                <li><b>Enter concentrations.</b> Pick the unit, type [protein] per lane, and enter <span className="k">0</span> for the no-protein control. Add [DNA] substrate if you plan to use tight-binding.</li>
                <li><b>Choose the quantification.</b> <span className="k">Bound / total</span> is the default. Switch to <span className="k">Free depletion</span> if binding changes probe fluorescence or the complex smears. Sanity check: the <span className="k">total</span> column should be flat across lanes &mdash; a trend means the label isn&rsquo;t behaving.</li>
                <li><b>Fit and read K<sub>d</sub>.</b> Hill, hyperbolic, or tight-binding (needs [DNA]; corrects ligand depletion). The 95% CI needs at least 4 concentrations. Heed the warning if your top point sits below ~10&times;K<sub>d</sub> &mdash; you haven&rsquo;t saturated.</li>
                <li><b>Export.</b> Download the gel, CSV or curve, or push the fit straight to the Overlay or Triplicate tab.</li>
              </ol>
              <div className="foot">
                Good titration: 8&ndash;12 lanes, 2&ndash;3-fold serial dilution spanning roughly
                0.1&times; to 10&times;K<sub>d</sub>, plus a no-protein lane. Quantifying both ways and
                getting the same K<sub>d</sub> is free evidence that your label is unperturbed.
              </div>
            </div>
          )}
        </div>
        <div style={{ display: tab === "analyze" ? "block" : "none" }}>
          <AnalyzerApp onAddToOverlay={addFromAnalyzer} onAddToTriplicate={addRepFromAnalyzer} />
        </div>
        <div style={{ display: tab === "overlay" ? "block" : "none" }}>
          <OverlayApp curves={curves} ingestFiles={ingestFiles} rename={rename} remove={remove} err={ovErr} />
        </div>
        <div style={{ display: tab === "triplicate" ? "block" : "none" }}>
          <TriplicateApp reps={reps} ingestFiles={ingestRepFiles} rename={renameRep} remove={removeRep} err={trErr} />
        </div>
      </div>
    </>
  );
}
