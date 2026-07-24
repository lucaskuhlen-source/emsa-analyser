import { useState, useRef, useCallback } from 'react';
import { Beaker, Layers, Sigma } from 'lucide-react';
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
`;

export function EmsaApp() {
  const [tab, setTab] = useState("analyze");

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
