import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts';
import { Upload, Wand2, RotateCcw, Minus, Beaker, ArrowRight, Activity, Crop, Scissors, Maximize2, Pipette, Download, Ban, RotateCw, FileDown, Layers, Sigma } from 'lucide-react';
import { decodeFile } from '@/lib/emsa/imageIO';
import { bilinear, buildWorkBuffer, findGelROI, columnProfile, smooth, findPeaks, laneProfile, alsBaseline, integrateBox, rollingBallBackground } from '@/lib/emsa/imageProcessing';
import { nelderMead, fitBinding, bootstrapKd } from '@/lib/emsa/curveFit';
import { fmt } from '@/lib/emsa/format';
import { SectionHead } from './SectionHead';
import { ImageOverlay } from './ImageOverlay';
import { CiSpinner } from './CiSpinner';
import { QCPlot } from './QCPlot';

export function AnalyzerApp({ onAddToOverlay, onAddToTriplicate }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [origDisplaySrc, setOrigDisplaySrc] = useState(null); // 8-bit source for rotation
  const [baseSignal, setBaseSignal] = useState(null);         // high-precision signal at 0°
  const [rotation, setRotation] = useState(0);                // straighten angle, adjustable anytime
  const [loadError, setLoadError] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [roi, setRoi] = useState(null);
  const [cropRect, setCropRect] = useState(null);   // destructive crop window (straightened full-frame coords); null = full frame
  const [lanes, setLanes] = useState([]);
  const [laneWidth, setLaneWidth] = useState(50);
  const [bands, setBands] = useState(null);
  const [concs, setConcs] = useState([]);
  const [concUnit, setConcUnit] = useState("nM");
  const [fitModel, setFitModel] = useState("hill"); // 'hyperbolic' | 'hill' | 'quadratic'
  const [normFit, setNormFit] = useState(true); // display specific binding normalised 0→1 (vs raw with offset)
  const [dnaConc, setDnaConc] = useState(""); // [DNA] substrate, experiment-wide, for tight-binding
  const [toolMode, setToolMode] = useState(null);   // null | 'crop' (destructive) | 'emsa' (ROI) | 'exclude'
  const [bgSubtract, setBgSubtract] = useState(true);   // per-lane ALS background subtraction (on by default, applied to rolling-ball residual)
  const [bgLambda, setBgLambda] = useState(1e5);        // ALS smoothness/stiffness
  const [bgAsym, setBgAsym] = useState(0.01);           // ALS asymmetry (peak rejection)
  const [rbOn, setRbOn] = useState(true);               // global rolling-ball (paraboloid) subtraction (on by default)
  const [rbRadius, setRbRadius] = useState(100);        // rolling-ball radius (px), live slider value
  const [rbRadiusApplied, setRbRadiusApplied] = useState(100); // debounced radius that drives the heavy recompute
  const [qcLane, setQcLane] = useState(null);           // lane index shown in the background QC panel
  const [excludeRegions, setExcludeRegions] = useState([]);
  const [labelOffsetBound, setLabelOffsetBound] = useState(0); // px offset for bound label in export
  const fileInputRef = useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    setLoadError(null);
    try {
      const { displayUrl, baseSig } = await decodeFile(file);
      setOrigDisplaySrc(displayUrl);
      setBaseSignal(baseSig);
      setRotation(0);
      setLanes([]);
      setBands(null);
      setConcs([]);
      setExcludeRegions([]);
      setQcLane(null);
      setToolMode(null);
      setCropRect(null);
      // Build the full-frame working buffer (θ=0 → identity). EMSA area defaults to the
      // auto-detected gel ROI — a sub-rectangle, NOT the whole image.
      const built = await buildWorkBuffer(baseSig, displayUrl, 0);
      setImgSrc(built.displayUrl);
      setSignalData({ sig: built.workSig, W: built.W, H: built.H });
      setRoi(
        built.workSig
          ? findGelROI(built.workSig, built.W, built.H)
          : { x: 0, y: 0, w: built.W, h: built.H }
      );
    } catch (err) {
      setLoadError(err.message || "Could not read this image.");
    }
  };

  // Rebuild the straightened working buffer from the untouched original at `deg`, optionally
  // cropped to `cr`. A sequence token guards against out-of-order async completions.
  //   resetPlacements=false → rotation fine-tune: keep EMSA area / lanes / bands / curve
  //                           (buffer dims unchanged, so placements stay valid).
  //   resetPlacements=true  → crop / reset-crop: buffer dims change, so re-default the EMSA
  //                           area and clear all placements (they were in the old coords).
  const buildSeqRef = useRef(0);
  const cleanupRef = useRef(null); // deferred-compute timer id for the async Kd CI
  const rebuildView = useCallback(async (deg, cr, { resetPlacements } = {}) => {
    if (!origDisplaySrc || !baseSignal) return;
    const seq = ++buildSeqRef.current;
    setLoadError(null);
    try {
      const built = await buildWorkBuffer(baseSignal, origDisplaySrc, deg, cr);
      if (seq !== buildSeqRef.current) return; // a newer rebuild superseded this one
      setImgSrc(built.displayUrl);
      setSignalData({ sig: built.workSig, W: built.W, H: built.H });
      if (resetPlacements) {
        setRoi(
          built.workSig
            ? findGelROI(built.workSig, built.W, built.H)
            : { x: 0, y: 0, w: built.W, h: built.H }
        );
        setLanes([]);
        setBands(null);
        setExcludeRegions([]);
        setQcLane(null);
      }
    } catch (err) {
      if (seq === buildSeqRef.current) setLoadError(err.message || "Failed to build view");
    }
  }, [origDisplaySrc, baseSignal]);

  // Fine-tune rotation at ANY time — re-straightens the current (full or cropped) window,
  // KEEPING the EMSA area, lanes, bands, and curve (buffer dimensions are unchanged).
  const applyRotation = useCallback((deg) => {
    setRotation(deg);
    rebuildView(deg, cropRect, { resetPlacements: false });
  }, [rebuildView, cropRect]);

  // ---- Destructive crop: discard everything outside the drawn window and ZOOM the view to
  // it. The rect arrives in straightened full-frame coords (the crop tool always draws on the
  // un-cropped full frame — see enterCropMode). Clamp to the original frame, store, rebuild
  // (zoom), and reset placements (coordinate system changed). ----
  const applyCropRect = useCallback((rect) => {
    if (!baseSignal) return;
    const W0 = baseSignal.W, H0 = baseSignal.H;
    const x = Math.max(0, Math.min(W0 - 1, rect.x));
    const y = Math.max(0, Math.min(H0 - 1, rect.y));
    const w = Math.min(rect.w, W0 - x);
    const h = Math.min(rect.h, H0 - y);
    if (w < 10 || h < 10) { setToolMode(null); return; }
    const cr = { x, y, w, h };
    setCropRect(cr);
    setToolMode(null);
    rebuildView(rotation, cr, { resetPlacements: true });
  }, [baseSignal, rotation, rebuildView]);

  // Restore the full frame (baseSignal is retained, so the crop is fully recoverable).
  const resetCrop = useCallback(() => {
    setCropRect(null);
    setToolMode(null);
    rebuildView(rotation, null, { resetPlacements: true });
  }, [rotation, rebuildView]);

  // Enter the crop tool. The crop rect must be drawn in full-frame coords, so if a crop is
  // already active we first restore the full frame ("briefly show the un-cropped view"),
  // then arm the draw capture. Clicking again while armed cancels.
  const enterCropMode = useCallback(() => {
    if (toolMode === 'crop') { setToolMode(null); return; }
    if (cropRect) {
      setCropRect(null);
      rebuildView(rotation, null, { resetPlacements: true });
    }
    setToolMode('crop');
  }, [toolMode, cropRect, rotation, rebuildView]);

  const autoDetectLanes = useCallback(() => {
    if (!signalData || !signalData.sig || !roi) return;
    const prof = columnProfile(signalData.sig, signalData.W, roi);
    const sm = smooth(prof, Math.max(2, Math.round(roi.w / 200)));
    const sorted = Array.from(sm).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const prominence = Math.max(0.01, (max - med) * 0.15);
    const minDist = Math.max(8, Math.round(roi.w / 30));
    const peaks = findPeaks(sm, { minProminence: prominence, minDist });

    let lw = 40;
    if (peaks.length >= 2) {
      const dists = [];
      for (let i = 1; i < peaks.length; i++) dists.push(peaks[i].x - peaks[i - 1].x);
      dists.sort((a, b) => a - b);
      const md = dists[Math.floor(dists.length / 2)];
      lw = Math.max(10, Math.min(roi.w / 2, md * 0.7));
    } else {
      lw = Math.max(10, roi.w / 8);
    }
    setLaneWidth(Math.round(lw));
    setLanes(peaks.map((p, i) => ({ x: roi.x + p.x, label: `L${i + 1}` })));
    setConcs((prev) => peaks.map((_, i) => prev[i] ?? ""));
  }, [signalData, roi]);

  const autoDetectBands = useCallback(() => {
    if (!signalData || !signalData.sig || !roi || lanes.length === 0) return;
    const W = signalData.W;
    const sig = signalData.sig;
    const prof = new Float32Array(roi.h);
    let nCols = 0;
    for (const l of lanes) {
      const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
      const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));
      for (let dy = 0; dy < roi.h; dy++) {
        let s = 0;
        const y = roi.y + dy;
        for (let x = x1; x < x2; x++) s += sig[y * W + x];
        prof[dy] += s;
      }
      nCols += x2 - x1;
    }
    for (let i = 0; i < prof.length; i++) prof[i] /= Math.max(1, nCols);
    const sm = smooth(prof, Math.max(2, Math.round(roi.h / 100)));
    const sorted = Array.from(sm).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const prominence = Math.max(0.005, (max - med) * 0.1);
    const minDist = Math.max(8, Math.round(roi.h / 25));
    const peaks = findPeaks(sm, { minProminence: prominence, minDist });
    if (peaks.length < 1) return;
    const sortedByProm = peaks.slice().sort((a, b) => b.prom - a.prom);
    const top = sortedByProm.slice(0, Math.min(4, sortedByProm.length));
    top.sort((a, b) => a.x - b.x);
    let bP, fP;
    if (top.length === 1) {
      fP = top[0];
      bP = { x: Math.round(roi.h * 0.1), y: 0, prom: 0 };
    } else {
      bP = top[0];
      fP = top[top.length - 1];
    }
    function halfWidth(peak) {
      const half = peak.y / 2;
      let l = peak.x;
      while (l > 0 && sm[l] > half) l--;
      let r = peak.x;
      while (r < sm.length - 1 && sm[r] > half) r++;
      return Math.max(4, Math.round((r - l) / 2));
    }
    const hwB = halfWidth(bP);
    const hwF = halfWidth(fP);
    setBands({
      boundY1: roi.y + Math.max(0, bP.x - hwB),
      boundY2: roi.y + Math.min(roi.h, bP.x + hwB),
      freeY1:  roi.y + Math.max(0, fP.x - hwF),
      freeY2:  roi.y + Math.min(roi.h, fP.x + hwF),
    });
  }, [signalData, roi, lanes, laneWidth]);

  // ---- EMSA area: a sub-rectangle of the working image defining the region of interest for
  // quantification. Drawn directly on the (full, straightened) working image, so it's in
  // working coords. Does NOT crop/zoom the view or rebuild the buffer, and does NOT alter
  // existing lanes/bands — it only constrains auto-detect. ----
  const applyEmsaArea = useCallback((rect) => {
    if (!signalData) return;
    const newRoi = {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      w: Math.min(rect.w, signalData.W - rect.x),
      h: Math.min(rect.h, signalData.H - rect.y),
    };
    setRoi(newRoi);
    setToolMode(null);
    // ROI is only an auto-detect aid; existing lanes/bands are intentionally left untouched.
  }, [signalData]);

  // ---- Background region: store rect; quant uses it for flat per-pixel subtraction ----
  // ---- Exclusion regions: artefacts (bubbles, fingerprints) voided from quant ----
  // Stored in image (signal) coordinates. Multiple allowed.
  const onExcludeCommit = useCallback((rect) => {
    setExcludeRegions((rs) => [...rs, rect]);
    setToolMode(null);
  }, []);

  const removeExclude = useCallback((i) => {
    setExcludeRegions((rs) => rs.filter((_, j) => j !== i));
  }, []);

  // Auto-detection is intentionally NOT triggered automatically (neither on upload nor
  // after crop) — the rule-based guesses are mediocre and the user generally prefers
  // to crop first and place lanes by hand. Detection now runs ONLY on button click.

  // Clear lanes/bands/concs but KEEP the gel image — for a second EMSA on the same gel.
  const resetLanes = () => {
    setLanes([]);
    setBands(null);
    setConcs([]);
    setExcludeRegions([]);
    setToolMode(null);
    setQcLane(null);
  };

  // Debounce the heavy rolling-ball recompute: the slider (rbRadius) updates instantly,
  // but the full-gel paraboloid only recomputes ~250ms after the radius stops changing.
  useEffect(() => {
    const t = setTimeout(() => setRbRadiusApplied(rbRadius), 250);
    return () => clearTimeout(t);
  }, [rbRadius]);

  // Global rolling-ball (paraboloid) background, recomputed only when the image or the
  // rolling-ball settings change — NOT on every lane/band tweak.
  const rbBackground = useMemo(() => {
    if (!rbOn || !signalData || !signalData.sig) return null;
    return rollingBallBackground(signalData.sig, signalData.W, signalData.H, rbRadiusApplied);
  }, [rbOn, rbRadiusApplied, signalData]);

  // Working signal after the optional global background subtraction. The per-lane ALS then
  // operates on THIS residual (so the two stages compose without double-counting).
  const correctedSig = useMemo(() => {
    if (!signalData || !signalData.sig) return null;
    if (!rbBackground) return signalData.sig;
    const s = signalData.sig, out = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s[i] - rbBackground[i];
    return out;
  }, [signalData, rbBackground]);

  const quant = useMemo(() => {
    if (!signalData || !correctedSig || !bands || lanes.length === 0 || !roi) return null;
    const W = signalData.W;
    const sig = correctedSig;

    // Pixel-level exclusion test: true if (x,y) falls inside any voided artefact box.
    // Returns null (skipped entirely) when there are no exclusions, so the hot loops
    // pay nothing in the common case.
    const isExcluded = excludeRegions.length === 0
      ? null
      : (x, y) => {
          for (const r of excludeRegions) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
          }
          return false;
        };

    const lambda = bgSubtract ? bgLambda : 0;

    return lanes.map((l) => {
      const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
      const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));

      // Per-lane vertical profile → ALS baseline running under the bands. When background
      // subtraction is off, the baseline is identically zero (raw integration).
      const { rowSum, counts, mean } = laneProfile(sig, W, roi, x1, x2, isExcluded);
      const baseline = bgSubtract
        ? alsBaseline(mean, lambda, bgAsym, 10)
        : new Float64Array(mean.length); // zeros

      const bTop = Math.min(bands.boundY1, bands.boundY2);
      const bBot = Math.max(bands.boundY1, bands.boundY2);
      const fTop = Math.min(bands.freeY1, bands.freeY2);
      const fBot = Math.max(bands.freeY1, bands.freeY2);
      const Ib = integrateBox(rowSum, counts, baseline, roi.y, bTop, bBot);
      const If = integrateBox(rowSum, counts, baseline, roi.y, fTop, fBot);

      // Keep the signed nets in the table (useful QC), but compute the fraction from the
      // non-negative parts: a negative net just means "below baseline = none here", so
      // f = bound⁺/(bound⁺+free⁺) is mathematically pinned to [0,1] by construction.
      const bNet = Ib.net;
      const fNet = If.net;
      const total = bNet + fNet;
      const bPos = Math.max(0, bNet);
      const fPos = Math.max(0, fNet);
      const denom = bPos + fPos;
      const fbound = denom > 0 ? bPos / denom : 0;
      return {
        label: l.label,
        bound: bNet,
        free: fNet,
        total,
        fbound,
      };
    });
  }, [signalData, correctedSig, bands, lanes, laneWidth, roi, excludeRegions, bgSubtract, bgLambda, bgAsym]);

  // Data for the per-lane background QC panel (the selected lane's density trace, the ALS
  // baseline fit under it, the pre-rolling-ball trace for reference, and the band windows).
  const qcData = useMemo(() => {
    if (qcLane == null || !signalData || !correctedSig || !roi || !lanes[qcLane]) return null;
    const W = signalData.W;
    const l = lanes[qcLane];
    const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
    const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));
    const isExcluded = excludeRegions.length === 0
      ? null
      : (x, y) => {
          for (const r of excludeRegions) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
          }
          return false;
        };
    const corr = laneProfile(correctedSig, W, roi, x1, x2, isExcluded);
    const baseline = bgSubtract
      ? alsBaseline(corr.mean, bgLambda, bgAsym, 10)
      : new Float64Array(corr.mean.length);
    const rawMean = rbBackground
      ? laneProfile(signalData.sig, W, roi, x1, x2, isExcluded).mean
      : null;
    const toRange = (a, b) => [
      Math.max(0, Math.round(Math.min(a, b)) - roi.y),
      Math.min(roi.h, Math.round(Math.max(a, b)) - roi.y),
    ];
    return {
      label: l.label,
      h: roi.h,
      mean: corr.mean,
      rawMean,
      baseline,
      bound: bands ? toRange(bands.boundY1, bands.boundY2) : null,
      free: bands ? toRange(bands.freeY1, bands.freeY2) : null,
    };
  }, [qcLane, signalData, correctedSig, rbBackground, roi, lanes, laneWidth, bgSubtract, bgLambda, bgAsym, excludeRegions, bands]);

  const fit = useMemo(() => {
    if (!quant) return null;
    const xs = concs.map((c) => parseFloat(c));
    const ys = quant.map((q) => q.fbound);
    if (xs.filter(Number.isFinite).length < 3) return null;
    return fitBinding(xs, ys, { model: fitModel, D: parseFloat(dnaConc) });
  }, [quant, concs, fitModel, dnaConc]);

  // 95% bootstrap CI for Kd (single-gel fit uncertainty). Computed ASYNCHRONOUSLY and
  // debounced so it never blocks typing: the curve/Kd update instantly (cheap memo above),
  // while the ~500 bootstrap refits run ~500 ms after edits stop, with a spinner. (A Web
  // Worker would be truly jank-free but blob/data-URL workers are blocked in the sandbox.)
  const [fitCI, setFitCI] = useState(null);
  const [ciStatus, setCiStatus] = useState("idle"); // 'idle' | 'computing' | 'done' | 'na'
  useEffect(() => {
    if (!quant) { setFitCI(null); setCiStatus("idle"); return; }
    const xs = concs.map((c) => parseFloat(c));
    const ys = quant.map((q) => q.fbound);
    if (xs.filter(Number.isFinite).length < 4) { setFitCI(null); setCiStatus("na"); return; }
    setCiStatus("computing");
    let cancelled = false;
    const debounce = setTimeout(() => {
      // defer one more tick so the spinner paints before the blocking compute
      const run = setTimeout(() => {
        if (cancelled) return;
        const ci = bootstrapKd(xs, ys, { model: fitModel, D: parseFloat(dnaConc) }, 500);
        if (cancelled) return;
        setFitCI(ci);
        setCiStatus(ci ? "done" : "na");
      }, 0);
      cleanupRef.current = run;
    }, 500);
    return () => { cancelled = true; clearTimeout(debounce); clearTimeout(cleanupRef.current); };
  }, [quant, concs, fitModel, dnaConc]);

  const chartPoints = useMemo(() => {
    if (!quant) return [];
    return quant.map((q, i) => ({
      x: parseFloat(concs[i]),
      y: q.fbound,
      label: q.label,
    }));
  }, [quant, concs]);

  const fitCurve = useMemo(() => {
    if (!fit) return [];
    const finiteX = chartPoints.map((d) => d.x).filter((x) => Number.isFinite(x) && x > 0);
    if (finiteX.length === 0) return [];
    const minX = Math.min(...finiteX) * 0.3;
    const maxX = Math.max(...finiteX) * 3;
    const lo = Math.log10(Math.max(1e-6, minX));
    const hi = Math.log10(Math.max(maxX, lo + 0.1));
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const x = Math.pow(10, lo + ((hi - lo) * i) / 100);
      pts.push({ x, fit: normFit ? fit.shape(x) : fit.model(x) });
    }
    return pts;
  }, [fit, chartPoints, normFit]);

  // Prism-style zero: a no-protein control can't sit on a log axis, so place it one
  // data-step left of the smallest real concentration and label that tick "0".
  // Presentation only — the fit and curve are unchanged.
  const zeroPlot = useMemo(() => {
    if (!fit) return null;
    const pos = chartPoints.filter((d) => Number.isFinite(d.x) && d.x > 0).sort((a, b) => a.x - b.x);
    const zero = chartPoints.find((d) => Number.isFinite(d.x) && d.x === 0);
    if (!zero || pos.length === 0) return null;
    const minPos = pos[0].x;
    // Place the "0" marker (no-protein control) at the concentration where the
    // displayed curve reaches 1% binding — i.e. the left edge of the meaningful
    // range. Labelled "0" but positioned so the plot doesn't waste a decade of
    // empty space on the left. Curve is monotonic, so bisect for shape/model = 0.01.
    const fn = normFit ? fit.shape : fit.model;
    const target = normFit ? 0.01 : fit.bottom + 0.01 * Math.max(1e-9, fit.Bmax - fit.bottom);
    let loX = minPos, hiX = minPos, guard = 0;
    // bracket the root: search down if minPos is already >1%, up if it's <1%
    if (fn(minPos) > target) { while (fn(loX) > target && loX > 1e-6 && guard++ < 80) loX /= 1.5; }
    else { while (fn(hiX) < target && guard++ < 80) hiX *= 1.5; }
    for (let i = 0; i < 80; i++) {
      const mid = Math.sqrt(loX * hiX);
      if (fn(mid) > target) hiX = mid; else loX = mid;
    }
    const x01 = Math.max(1e-6, Math.sqrt(loX * hiX));
    return { pseudoX: x01, y: zero.y, label: zero.label, minPos };
  }, [fit, chartPoints, normFit]);

  const mergedChart = useMemo(() => {
    const span = fit ? Math.max(1e-9, fit.Bmax - fit.bottom) : 1;
    const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null);
    const yT = (y) => clamp01(normFit && fit ? (y - fit.bottom) / span : y);
    const pts = [...fitCurve.map((p) => ({ ...p, fit: clamp01(p.fit) }))];
    for (const p of chartPoints) {
      if (!Number.isFinite(p.x) || p.x <= 0) continue;
      pts.push({ x: p.x, y: yT(p.y), label: p.label });
    }
    if (zeroPlot) pts.push({ x: zeroPlot.pseudoX, y: yT(zeroPlot.y), label: zeroPlot.label });
    return pts.sort((a, b) => a.x - b.x);
  }, [fitCurve, chartPoints, fit, normFit, zeroPlot]);

  // Decade ticks across the data range; the x01 anchor is added as the "0" tick.
  const xTicks = useMemo(() => {
    const xs = chartPoints.map((p) => p.x).filter((x) => Number.isFinite(x) && x > 0);
    if (!xs.length) return undefined;
    const lo = zeroPlot ? zeroPlot.pseudoX : Math.min(...xs);
    const maxReal = Math.max(...xs);
    const ticks = [];
    for (let k = Math.ceil(Math.log10(lo)); k <= Math.ceil(Math.log10(maxReal)); k++) {
      const t = Math.pow(10, k);
      if (t > lo * 1.0001) ticks.push(t);  // keep decades clear of the "0" anchor
    }
    return zeroPlot ? [zeroPlot.pseudoX, ...ticks] : ticks;
  }, [chartPoints, zeroPlot]);

  // ---- Quant table CSV download ----
  const buildCSV = useCallback(() => {
    if (!quant) return null;
    const rows = [["lane", `[protein]_${concUnit}`, "bound", "free", "total", "fraction_bound"]];
    quant.forEach((q, i) =>
      rows.push([q.label, concs[i] ?? "", q.bound, q.free, q.total, q.fbound])
    );
    if (fit) {
      rows.push([]);
      rows.push(["# model", fitModel]);
      rows.push(["# Kd", fit.Kd, concUnit]);
      if (fitCI) {
        rows.push(["# Kd_CI95_low", fitCI.kdLo, concUnit]);
        rows.push(["# Kd_CI95_high", fitCI.kdHi, concUnit]);
        rows.push(["# Kd_CI_note", "single-gel fit bootstrap; not replicate reproducibility"]);
      }
      rows.push(["# top_Bmax", fit.Bmax]);
      rows.push(["# bottom_baseline", fit.bottom]);
      if (fitModel === "hill") rows.push(["# Hill_n", fit.n]);
      if (fitModel === "quadratic") rows.push(["# DNA_substrate", dnaConc, concUnit]);
      rows.push(["# R2", fit.r2]);
    }
    return rows
      .map((r) =>
        r
          .map((c) => {
            const s = c == null ? "" : String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
  }, [quant, concs, concUnit, fit, fitCI, fitModel, dnaConc]);

  // ---- CSV download (uses buildCSV) ----
  const exportCSV = useCallback(() => {
    const csv = buildCSV();
    if (!csv) return;
    // data: URL (blob: is blocked in the sandboxed iframe)
    const reader = new FileReader();
    reader.onload = (e) => {
      const a = document.createElement("a");
      a.href = e.target.result;
      a.download = "emsa-quantification.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };
    reader.readAsDataURL(new Blob([csv], { type: "text/csv" }));
  }, [buildCSV]);

  // ---- Push current result straight into the Overlay tab (no download round-trip) ----
  const [overlaySent, setOverlaySent] = useState(false);
  const addToOverlay = useCallback(() => {
    const csv = buildCSV();
    if (!csv || !onAddToOverlay) return;
    onAddToOverlay(csv);
    setOverlaySent(true);
    setTimeout(() => setOverlaySent(false), 1800);
  }, [buildCSV, onAddToOverlay]);

  // ---- Push current result straight into the Triplicate tab (as one replicate) ----
  const [triplicateSent, setTriplicateSent] = useState(false);
  const addToTriplicate = useCallback(() => {
    const csv = buildCSV();
    if (!csv || !onAddToTriplicate) return;
    onAddToTriplicate(csv);
    setTriplicateSent(true);
    setTimeout(() => setTriplicateSent(false), 1800);
  }, [buildCSV, onAddToTriplicate]);

  // ---- Gel download ----
  const exportGelPNG = useCallback(() => {
    if (!imgSrc || !roi || lanes.length === 0) return;
    const im = new Image();
    im.onload = () => {
      const DPR = 2;
      const TOP = 52;
      const LEFT = 20;
      const RIGHT = 170;  // room for band labels on the right
      const BOTTOM = 20;

      const gelW = roi.w;
      const gelH = roi.h;
      const cw = gelW + LEFT + RIGHT;
      const ch = gelH + TOP + BOTTOM;

      const canvas = document.createElement('canvas');
      canvas.width = cw * DPR;
      canvas.height = ch * DPR;
      const ctx = canvas.getContext('2d');
      ctx.scale(DPR, DPR);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);

      // Gel image
      ctx.drawImage(im, roi.x, roi.y, gelW, gelH, LEFT, TOP, gelW, gelH);

      // 1 pt border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(LEFT, TOP, gelW, gelH);

      // Header: "[Protein] (nM)" centred above gel
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`[Protein] (${concUnit})`, LEFT + gelW / 2, 15);

      // Concentration values above each lane — bold
      ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
      lanes.forEach((l, i) => {
        const xC = LEFT + (l.x - roi.x);
        const v = concs[i];
        ctx.fillText((v === '' || v == null) ? '—' : String(v), xC, 38);
      });

      // Band labels on the right with a short leader line, only if bands are defined
      if (bands) {
        const labelX = LEFT + gelW + 14;
        const tickX  = LEFT + gelW + 4;
        const lineEnd = LEFT + gelW;

        // Midpoints in canvas y-coords
        const bMid = TOP + ((Math.min(bands.boundY1, bands.boundY2) + Math.max(bands.boundY1, bands.boundY2)) / 2 - roi.y) + labelOffsetBound;
        const fMid = TOP + ((Math.min(bands.freeY1,  bands.freeY2)  + Math.max(bands.freeY1,  bands.freeY2))  / 2 - roi.y);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;

        // Bound label
        ctx.beginPath();
        ctx.moveTo(lineEnd, bMid);
        ctx.lineTo(tickX, bMid);
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('DNA–protein complex', labelX, bMid);

        // Free label
        ctx.beginPath();
        ctx.moveTo(lineEnd, fMid);
        ctx.lineTo(tickX, fMid);
        ctx.stroke();
        ctx.fillText('Free DNA', labelX, fMid);
      }

      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const a = document.createElement('a');
          a.href = e.target.result;
          a.download = 'emsa-gel.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    im.src = imgSrc;
  }, [imgSrc, roi, lanes, concs, concUnit, bands, labelOffsetBound]);

  // ---- Binding curve download: draw directly to canvas, no SVG conversion ----
  const exportChartPNG = useCallback(() => {
    if (!fit || chartPoints.length === 0) return;
    const DPR = 2;
    const W = 720, H = 460;
    const PAD = { top: 60, right: 36, bottom: 70, left: 80 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const finiteX = chartPoints.map((d) => d.x).filter((x) => Number.isFinite(x) && x > 0);
    if (finiteX.length === 0) return;
    const minReal = Math.min(...finiteX);
    const xMax = Math.max(...finiteX) * 3;
    // Zero-protein control placed at x01: the conc where the displayed curve hits 1% binding.
    const zeroCtrl = chartPoints.find((d) => Number.isFinite(d.x) && d.x === 0);
    let pseudoZeroX = null;
    if (zeroCtrl) {
      const fn = normFit ? fit.shape : fit.model;
      const target = normFit ? 0.01 : fit.bottom + 0.01 * Math.max(1e-9, fit.Bmax - fit.bottom);
      let loX = minReal, hiX = minReal, guard = 0;
      if (fn(minReal) > target) { while (fn(loX) > target && loX > 1e-6 && guard++ < 80) loX /= 1.5; }
      else { while (fn(hiX) < target && guard++ < 80) hiX *= 1.5; }
      for (let i = 0; i < 80; i++) { const mid = Math.sqrt(loX * hiX); if (fn(mid) > target) hiX = mid; else loX = mid; }
      pseudoZeroX = Math.max(1e-6, Math.sqrt(loX * hiX));
    }
    const xMin = pseudoZeroX ? pseudoZeroX : minReal * 0.3;
    let lo = Math.log10(Math.max(1e-6, xMin));
    const hi = Math.log10(Math.max(xMax, lo + 0.1));
    const xToPx = (x) => PAD.left + ((Math.log10(x) - lo) / (hi - lo)) * plotW;
    const span = Math.max(1e-9, fit.Bmax - fit.bottom);
    const yT = (y) => (normFit ? (y - fit.bottom) / span : y);
    const yMax = normFit ? 1.05 : Math.max(1.05, fit.Bmax * 1.1);
    const yToPx = (y) => PAD.top + plotH - (y / yMax) * plotH;

    const canvas = document.createElement('canvas');
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    // Background — cream paper
    ctx.fillStyle = '#f9f4e9';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#1a1816';
    ctx.font = 'bold italic 20px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Binding isotherm', PAD.left, 32);
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#4a453d';
    ctx.fillText('fraction bound vs. [protein]', PAD.left, 48);

    // Plot area background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(PAD.left, PAD.top, plotW, plotH);

    // Y-axis gridlines + ticks
    ctx.strokeStyle = 'rgba(26,24,22,0.10)';
    ctx.lineWidth = 0.5;
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#1a1816';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = 0; y <= 1.0; y += 0.2) {
      if (y > yMax + 0.01) break;
      const py = yToPx(y);
      ctx.strokeStyle = 'rgba(26,24,22,0.10)';
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + plotW, py); ctx.stroke();
      // tick mark
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left - 5, py); ctx.lineTo(PAD.left, py); ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.fillText(y.toFixed(1), PAD.left - 10, py);
    }

    // X-axis: label at 1×, 2×, 5× per decade to cover the full experimental range
    const logLo = Math.floor(lo);
    const logHi = Math.ceil(hi);
    const labelMultipliers = [1, 2, 5];
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let k = logLo; k <= logHi; k++) {
      for (const m of labelMultipliers) {
        const xVal = m * Math.pow(10, k);
        const lv = Math.log10(xVal);
        if (lv < lo - 0.01 || lv > hi + 0.01) continue;
        if (pseudoZeroX && xVal <= pseudoZeroX * 1.0001) continue;  // "0" anchor owns the left edge
        const px = xToPx(xVal);
        if (px < PAD.left - 1 || px > PAD.left + plotW + 1) continue;

        // Vertical gridline
        ctx.strokeStyle = m === 1 ? 'rgba(26,24,22,0.14)' : 'rgba(26,24,22,0.07)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, PAD.top + plotH); ctx.stroke();

        // Tick
        ctx.strokeStyle = '#1a1816';
        ctx.lineWidth = m === 1 ? 1.25 : 0.75;
        ctx.beginPath(); ctx.moveTo(px, PAD.top + plotH); ctx.lineTo(px, PAD.top + plotH + 5); ctx.stroke();

        // Label — show 1× always; show 2× and 5× only if they won't overlap (enough space)
        const skipLabel = m !== 1 && plotW / ((logHi - logLo + 1) * 3) < 24;
        if (!skipLabel) {
          ctx.fillStyle = m === 1 ? '#1a1816' : '#4a453d';
          ctx.font = m === 1 ? 'bold 11px Helvetica, Arial, sans-serif' : '11px Helvetica, Arial, sans-serif';
          const label = xVal >= 1000 ? `${xVal / 1000}k` : xVal >= 1 ? String(xVal) : xVal.toString();
          ctx.fillText(label, px, PAD.top + plotH + 9);
        }
      }
    }

    // Plot frame
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    // Kd reference line (vertical)
    if (fit.Kd > 0 && Math.log10(fit.Kd) >= lo && Math.log10(fit.Kd) <= hi) {
      const kx = xToPx(fit.Kd);
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(kx, PAD.top);
      ctx.lineTo(kx, PAD.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Kd = ${fmt(fit.Kd, 3)} ${concUnit}`, kx + 6, PAD.top + 6);
    }

    // half-max horizontal reference
    const halfY = yToPx(normFit ? 0.5 : fit.bottom + span / 2);
    ctx.strokeStyle = 'rgba(26,24,22,0.30)';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, halfY);
    ctx.lineTo(PAD.left + plotW, halfY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fit curve
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 200; i++) {
      const x = Math.pow(10, lo + ((hi - lo) * i) / 200);
      const y = normFit ? fit.shape(x) : fit.model(x);
      const px = xToPx(x);
      const py = yToPx(y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 1;
    for (const p of chartPoints) {
      if (!Number.isFinite(p.x) || p.x <= 0) continue;
      const px = xToPx(p.x);
      const py = yToPx(yT(p.y));
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Decorative zero-protein control: "0" tick + label at the left edge, plus its data point.
    if (pseudoZeroX && zeroCtrl) {
      const zpx = xToPx(pseudoZeroX);
      // tick mark
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(zpx, PAD.top + plotH); ctx.lineTo(zpx, PAD.top + plotH + 5); ctx.stroke();
      // "0" label
      ctx.fillStyle = '#1a1816';
      ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('0', zpx, PAD.top + plotH + 9);
      // zero-control data point
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1;
      const zpy = yToPx(yT(zeroCtrl.y));
      ctx.beginPath();
      ctx.arc(zpx, zpy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Axis titles
    ctx.fillStyle = '#1a1816';
    ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`[Protein] (${concUnit})  ·  log scale`, PAD.left + plotW / 2, H - 18);
    ctx.save();
    ctx.translate(18, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(normFit ? 'specific binding (normalised)' : 'fraction bound', 0, 0);
    ctx.restore();

    // Stats footer
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#1a1816';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const modelLabel = fitModel === "hill" ? `Hill n = ${fmt(fit.n, 2)}`
      : fitModel === "quadratic" ? "tight-binding" : "hyperbolic";
    const stats = `Kd = ${fmt(fit.Kd, 3)} ${concUnit}  ·  top = ${fmt(fit.Bmax, 3)}  ·  bottom = ${fmt(fit.bottom, 3)}  ·  R² = ${fmt(fit.r2, 3)}  ·  ${modelLabel}`;
    ctx.fillText(stats, W - PAD.right, 32);
    if (fitCI) {
      ctx.font = '10px Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#57534e';
      ctx.fillText(`Kd 95% CI [${fmt(fitCI.kdLo, 3)}, ${fmt(fitCI.kdHi, 3)}] ${concUnit} · single-gel fit`, W - PAD.right, 46);
    }

    // Download via data: URL
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const a = document.createElement('a');
        a.href = e.target.result;
        a.download = 'emsa-binding-curve.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  }, [fit, chartPoints, concUnit, fitModel, normFit, fitCI]);

  const reset = () => {
    setImgSrc(null);
    setOrigDisplaySrc(null);
    setBaseSignal(null);
    setRotation(0);
    setLoadError(null);
    setSignalData(null);
    setRoi(null);
    setLanes([]);
    setBands(null);
    setConcs([]);
    setExcludeRegions([]);
    setQcLane(null);
    setToolMode(null);
  };

  const removeLane = (i) => {
    setLanes((ls) =>
      ls.filter((_, j) => j !== i).map((l, k) => ({ ...l, label: `L${k + 1}` }))
    );
    setConcs((cs) => cs.filter((_, j) => j !== i));
  };

  const stepDone = {
    1: !!imgSrc,
    2: lanes.length > 0 && !!bands,
    3: concs.filter((c) => c !== "" && c != null).length >= 3,
    4: !!fit,
  };

  /* ============================================================== */

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --paper: #f4ede0;
  --paper-2: #ebe1cb;
  --paper-3: #f9f4e9;
  --ink: #1a1816;
  --ink-2: #4a453d;
  --muted: #8a8275;
  --accent: #b91c1c;
  --accent-2: #15803d;
  --rule: rgba(26,24,22,0.18);
}

.app-root {
  background: var(--paper);
  color: var(--ink);
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 400;
  min-height: 100vh;
  position: relative;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(26,24,22,0.025) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(26,24,22,0.02) 0%, transparent 60%);
}
.app-root::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  opacity:0.35; mix-blend-mode:multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.09 0 0 0 0 0.08 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  z-index:0;
}

.container { max-width: 1180px; margin: 0 auto; padding: 40px 32px; position: relative; z-index: 1; }

/* Masthead */
.masthead { border-bottom: 2px solid var(--ink); padding-bottom: 16px; display: flex; align-items: flex-end; justify-content: space-between; }
.masthead .small-caps { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); margin-bottom: 4px; font-feature-settings: "smcp"; }
.masthead h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 64px; line-height: 0.95; margin: 0; color: var(--ink); }
.masthead h1 em { font-style: italic; }
.masthead .tag { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 24px; color: var(--ink-2); margin-top: 4px; }
.masthead .meta { text-align: right; }
.masthead .date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2); letter-spacing: 0.15em; }
.masthead .meta-tag { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 16px; color: var(--ink-2); margin-top: 4px; }

/* Steps */
.steps { display: flex; align-items: center; gap: 22px; margin-top: 16px; color: var(--ink-2); font-size: 14px; }
.step { display: flex; align-items: center; gap: 8px; }
.step-num { display: inline-block; width: 22px; height: 22px; line-height: 22px; border: 1px solid var(--ink); border-radius: 50%; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink); background: var(--paper); }
.step-num.active { background: var(--ink); color: var(--paper); }
.steps .arr { opacity: 0.4; }
.steps .spacer { flex: 1; }

/* Section */
.section { margin-bottom: 40px; }
.section-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.section-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.2em; color: var(--ink-2); }
.section-title { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; font-size: 26px; color: var(--ink); margin: 0; line-height: 1; }
.section-sub { font-size: 13px; color: var(--muted); letter-spacing: 0.02em; margin-left: 4px; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font-size: 13px; font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; transition: all 120ms ease; line-height: 1; }
.btn:hover { background: var(--ink); color: var(--paper); }
.btn-primary { background: var(--ink); color: var(--paper); }
.btn-primary:hover { background: var(--accent); border-color: var(--accent); }
.btn-ghost { border-color: transparent; }
.btn-ghost:hover { border-color: var(--ink); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn:disabled:hover { background: var(--paper); color: var(--ink); border-color: var(--ink); }
.btn-full { width: 100%; justify-content: center; }
.btn-tiny { padding: 2px 6px; }

/* Inputs */
.input { background: var(--paper-3); border: 1px solid var(--ink); padding: 5px 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
.input:focus { border-color: var(--accent); }
.select { background: var(--paper-3); border: 1px solid var(--ink); padding: 5px 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink); outline: none; box-sizing: border-box; }

/* Drop zone */
.drop { border: 2px dashed var(--ink); padding: 60px; text-align: center; cursor: pointer; transition: all 150ms ease; background: repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(26,24,22,0.03) 12px, rgba(26,24,22,0.03) 24px); }
.drop:hover { background: var(--paper-2); border-color: var(--accent); }
.drop-title { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: var(--ink); }
.drop-sub { font-size: 13px; color: var(--ink-2); margin-top: 8px; }

/* Aside panel */
.panel { border: 1px solid var(--ink); background: var(--paper-3); padding: 16px; }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--rule); }
.small-caps { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); font-feature-settings: "smcp"; }
.lane-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; border-bottom: 1px solid var(--rule); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.lane-row:last-child { border-bottom: 0; }
.lane-list { max-height: 180px; overflow: auto; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.muted-text { color: var(--muted); }
.tip { font-size: 11px; color: var(--muted); margin-top: 8px; font-style: italic; line-height: 1.4; }
.pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border: 1px solid var(--ink); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.pill-bound { color: var(--accent); border-color: var(--accent); }
.pill-free { color: var(--accent-2); border-color: var(--accent-2); }

/* Table */
table.t { width: 100%; border-collapse: collapse; }
table.t th, table.t td { padding: 6px 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: left; border-bottom: 1px solid var(--rule); }
table.t th { font-weight: 500; color: var(--ink-2); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; }

/* Stats */
.stat { border: 1px solid var(--ink); padding: 14px 16px; background: var(--paper-3); }
.stat .label { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); }
.stat .value { font-family: 'Instrument Serif', serif; font-size: 28px; line-height: 1.1; margin-top: 4px; color: var(--ink); }
.stat .value .unit { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-2); margin-left: 6px; }

/* Image */
.img-wrap { position: relative; width: 100%; user-select: none; border: 1px solid var(--ink); background: var(--paper-2); }
.img-base { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.img-svg { position: absolute; inset: 0; overflow: visible; }

/* Layouts */
.row-2 { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
.row-2-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cols-3-stat { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.conc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.span-all { grid-column: 1 / -1; }
.flex-center { display: flex; align-items: center; gap: 12px; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-baseline { display: flex; align-items: baseline; justify-content: space-between; }
.mb-3 { margin-bottom: 12px; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.gap-2 { gap: 8px; }

/* Three callouts on upload */
.callouts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; }
.callout { border-left: 2px solid var(--ink); padding-left: 12px; }
.callout .num { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-2); letter-spacing: 0.18em; }
.callout .head { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 18px; line-height: 1.2; }
.callout .body { color: var(--ink-2); font-size: 13px; margin-top: 4px; line-height: 1.4; }

.controls-stack > * + * { margin-top: 8px; }
.range { width: 100%; accent-color: var(--ink); }

.chart-card { margin-top: 24px; border: 1px solid var(--ink); background: var(--paper-3); padding: 16px; }
.chart-title { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 22px; line-height: 1; }

.checkbox-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.checkbox-label input { accent-color: var(--ink); }

footer.app-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--ink); display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; color: var(--ink-2); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
footer.app-footer .fin { font-family: 'Instrument Serif', serif; font-style: italic; }
footer.app-footer .footer-left { display: flex; flex-direction: column; gap: 5px; }
footer.app-footer .footer-about, footer.app-footer .footer-cite { font-size: 11px; color: var(--ink-2); opacity: 0.85; }
footer.app-footer .footer-about a { color: var(--accent); text-decoration: none; }
footer.app-footer .footer-about a:hover { text-decoration: underline; }
footer.app-footer .fin { align-self: flex-end; }

@media (max-width: 900px) {
  .row-2 { grid-template-columns: 1fr; }
  .row-2-eq { grid-template-columns: 1fr; }
  .callouts { grid-template-columns: 1fr; }
  .cols-3-stat { grid-template-columns: 1fr 1fr; }
  .masthead h1 { font-size: 44px; }
}
      `}</style>

      <div className="app-root">
        <div className="container">
          {/* Masthead */}
          <header>
            <div className="masthead">
              <div>
                <div className="small-caps">electrophoretic mobility shift assay · vol. i</div>
                <h1>Bound <em>&amp;</em> Free</h1>
                <div className="tag">a binding-curve workbench</div>
              </div>
              <div className="meta">
                <div className="date">v1.16</div>
                <div className="meta-tag">Kd by least-squares</div>
              </div>
            </div>
            <div className="steps">
              <span className="step"><span className={"step-num " + (stepDone[1] ? "active" : "")}>1</span> Upload</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[2] ? "active" : "")}>2</span> Confirm regions</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[3] ? "active" : "")}>3</span> Concentrations</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[4] ? "active" : "")}>4</span> Fit</span>
              <span className="spacer" />
              {imgSrc && (
                <button className="btn btn-ghost" onClick={reset}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </header>

          {/* ---------- Upload ---------- */}
          {!imgSrc && (
            <section className="section" style={{ marginTop: 32 }}>
              <SectionHead num="01" title="Provide a gel image" subtitle="JPEG, PNG, or 16-bit TIFF" />
              <div
                className="drop"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
              >
                <Upload size={28} style={{ color: "var(--ink-2)", marginBottom: 12 }} />
                <div className="drop-title">Drop your gel image here</div>
                <div className="drop-sub">JPEG · PNG — bands should appear dark on a light background</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.tif,.tiff"
                  style={{ display: "none" }}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
              {loadError && (
                <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  ⚠ {loadError}
                </div>
              )}
              <div className="callouts">
                {[
                  ["01", "We invert luminance", "so dark bands become positive signal. 16-bit TIFF is read at full depth for the cleanest faint-band quantification."],
                  ["02", "Crop, then place by hand", "rotate first if lanes are tilted, draw the crop region, then add lanes by hand (buttons or double-click). Nothing is placed for you on upload."],
                  ["03", "Per-lane background", "a smooth ALS baseline is fit under each lane and subtracted before integrating density. f bound = bound / (bound + free)."],
                ].map(([n, t, d]) => (
                  <div className="callout" key={n}>
                    <div className="num">¶{n}</div>
                    <div className="head">{t}</div>
                    <div className="body">{d}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------- Image + region editor ---------- */}
          {imgSrc && (
            <>
              <section className="section" style={{ marginTop: 32 }}>
                <SectionHead num="02" title="Confirm the regions" subtitle="drag handles to adjust · double-click to add a lane" />
                <div className="row-2">
                  <ImageOverlay
                    imgSrc={imgSrc}
                    imgW={signalData?.W ?? 0}
                    imgH={signalData?.H ?? 0}
                    lanes={lanes}
                    setLanes={setLanes}
                    laneWidth={laneWidth}
                    bands={bands}
                    setBands={setBands}
                    roi={roi}
                    toolMode={toolMode}
                    onCropCommit={applyCropRect}
                    onEmsaCommit={applyEmsaArea}
                    excludeRegions={excludeRegions}
                    onExcludeCommit={onExcludeCommit}
                  />
                  <aside>
                    <div className="panel">
                      <div className="small-caps mb-3">orientation</div>
                      <div style={{ marginBottom: 8 }}>
                        <div className="flex-between" style={{ marginBottom: 4 }}>
                          <label className="small-caps">
                            <RotateCw size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                            rotate · {rotation.toFixed(1)}°
                          </label>
                          {rotation !== 0 && (
                            <button className="btn btn-ghost btn-tiny" onClick={() => applyRotation(0)} title="Reset to 0°">×</button>
                          )}
                        </div>
                        <input
                          type="range"
                          min="-15" max="15" step="0.1"
                          value={rotation}
                          disabled={!imgSrc}
                          onChange={(e) => setRotation(parseFloat(e.target.value))}
                          onPointerUp={(e) => applyRotation(parseFloat(e.target.value))}
                          onKeyUp={(e) => applyRotation(parseFloat(e.target.value))}
                          className="range"
                        />
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                          straightens the image — fine-tune any time, even after placing lanes
                        </div>
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 12 }}>tools</div>
                      <div className="controls-stack">
                        <button
                          className={`btn btn-full${toolMode === 'crop' ? ' btn-primary' : ''}`}
                          onClick={enterCropMode}
                          disabled={!imgSrc}
                          title="Drag a box to crop the image: everything outside is discarded and the view zooms to the selection (recoverable via Reset crop)"
                        >
                          <Scissors size={13} /> {toolMode === 'crop' ? 'Drawing crop…' : cropRect ? 'Re-crop image' : 'Crop image'}
                        </button>
                        {cropRect && (
                          <button className="btn btn-ghost btn-full" onClick={resetCrop} title="Restore the full uncropped frame">
                            <Maximize2 size={13} /> Reset crop (full frame)
                          </button>
                        )}
                        <button
                          className={`btn btn-full${toolMode === 'emsa' ? ' btn-primary' : ''}`}
                          onClick={() => setToolMode((t) => (t === 'emsa' ? null : 'emsa'))}
                          title="Drag a box on the gel to define the EMSA area of interest (analysis ROI — does not crop or zoom the image)"
                        >
                          <Crop size={13} /> {toolMode === 'emsa' ? 'Drawing EMSA area…' : 'Draw EMSA area'}
                        </button>
                        <button
                          className={`btn btn-full${toolMode === 'exclude' ? ' btn-primary' : ''}`}
                          onClick={() => setToolMode((t) => (t === 'exclude' ? null : 'exclude'))}
                          title="Drag a box around an imaging artefact (bubble, fingerprint) to void it from quantification"
                        >
                          <Ban size={13} /> {toolMode === 'exclude' ? 'Drawing exclusion…' : 'Draw exclusion region'}
                        </button>
                        {excludeRegions.length > 0 && (
                          <div className="lane-list" style={{ marginTop: 4 }}>
                            {excludeRegions.map((r, i) => (
                              <div className="lane-row" key={i}>
                                <span>
                                  EXCL {i + 1}{" "}
                                  <span className="muted-text">
                                    {Math.round(r.w)}×{Math.round(r.h)} @ {Math.round(r.x)},{Math.round(r.y)}
                                  </span>
                                </span>
                                <button className="btn btn-ghost btn-tiny" onClick={() => removeExclude(i)} title="Remove exclusion">
                                  <Minus size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>lane detection</div>
                      <div className="controls-stack">
                        <button className="btn btn-primary btn-full" onClick={autoDetectLanes} disabled={!signalData?.sig}>
                          <Wand2 size={13} /> Detect lanes
                        </button>
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>band detection</div>
                      <div className="controls-stack">
                        <button className="btn btn-primary btn-full" onClick={autoDetectBands} disabled={lanes.length === 0 || !signalData?.sig}>
                          <Wand2 size={13} /> Detect bands
                        </button>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <label className="small-caps" style={{ display: "block", marginBottom: 4 }}>
                          lane width · {laneWidth}px
                        </label>
                        <input
                          type="range"
                          min="8"
                          max={Math.max(80, Math.round((roi?.w ?? 200) / 4))}
                          value={laneWidth}
                          onChange={(e) => setLaneWidth(parseInt(e.target.value))}
                          className="range"
                        />
                      </div>

                      <div className="small-caps mb-2" style={{ marginTop: 16 }}>
                        lanes ({lanes.length})
                      </div>
                      <div className="lane-list">
                        {lanes.map((l, i) => (
                          <div className="lane-row" key={i}>
                            <span>
                              {l.label}{" "}
                              <span className="muted-text">@ {Math.round(l.x)}</span>
                            </span>
                            <span style={{ display: "flex", gap: 2 }}>
                              <button
                                className={`btn btn-ghost btn-tiny${qcLane === i ? ' btn-primary' : ''}`}
                                onClick={() => setQcLane((q) => (q === i ? null : i))}
                                title="Show this lane's background trace + baseline"
                              >
                                <Activity size={12} />
                              </button>
                              <button className="btn btn-ghost btn-tiny" onClick={() => { if (qcLane === i) setQcLane(null); removeLane(i); }} title="Remove lane">
                                <Minus size={12} />
                              </button>
                            </span>
                          </div>
                        ))}
                        {lanes.length === 0 && (
                          <div style={{ padding: 8 }} className="muted-text">No lanes yet</div>
                        )}
                      </div>

                      <div className="tip">Tip: double-click anywhere on the image to add a lane.</div>

                      {bands && (
                        <>
                          <div className="small-caps" style={{ marginTop: 16, marginBottom: 8 }}>band regions</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            <div className="flex-between" style={{ marginBottom: 4 }}>
                              <span className="pill pill-bound">bound</span>
                              <span>y: {Math.round(bands.boundY1)}–{Math.round(bands.boundY2)}</span>
                            </div>
                            <div className="flex-between">
                              <span className="pill pill-free">free</span>
                              <span>y: {Math.round(bands.freeY1)}–{Math.round(bands.freeY2)}</span>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>background</div>
                      <div className="controls-stack">
                        <button
                          className={`btn btn-full${rbOn ? ' btn-primary' : ''}`}
                          onClick={() => setRbOn((v) => !v)}
                          title="Sliding-paraboloid rolling ball over the whole gel (Sternberg/ImageJ-style). Removes 2-D illumination & staining gradients before any per-lane step."
                        >
                          <Activity size={13} /> {rbOn ? 'Rolling ball (global): ON' : 'Rolling ball (global): OFF'}
                        </button>
                      </div>
                      {rbOn && (
                        <div style={{ marginTop: 8 }}>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">ball radius</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {rbRadius}px
                            </span>
                          </div>
                          <input
                            type="range" min="10" max="300" step="2"
                            value={rbRadius}
                            onChange={(e) => setRbRadius(parseInt(e.target.value))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                            larger = flatter background (keep ≳ widest band). recomputes the whole gel.
                          </div>
                        </div>
                      )}

                      <div className="controls-stack" style={{ marginTop: 10 }}>
                        <button
                          className={`btn btn-full${bgSubtract ? ' btn-primary' : ''}`}
                          onClick={() => setBgSubtract((v) => !v)}
                          title={rbOn
                            ? "Per-lane ALS baseline, fit on the rolling-ball residual (cleans up whatever the ball left)"
                            : "Fit a smooth ALS baseline under each lane's density profile and subtract it before integrating"}
                        >
                          <Activity size={13} /> {bgSubtract ? `Per-lane ALS${rbOn ? ' (on residual)' : ''}: ON` : 'Per-lane ALS: OFF'}
                        </button>
                      </div>
                      {bgSubtract && (
                        <div style={{ marginTop: 8 }}>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">smoothness λ</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {bgLambda.toExponential(0)}
                            </span>
                          </div>
                          <input
                            type="range" min="2" max="8" step="0.1"
                            value={Math.log10(bgLambda)}
                            onChange={(e) => setBgLambda(Math.pow(10, parseFloat(e.target.value)))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                            higher = straighter baseline · lower = follows local dips
                          </div>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">asymmetry p</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {bgAsym.toFixed(3)}
                            </span>
                          </div>
                          <input
                            type="range" min="-3" max="-1" step="0.05"
                            value={Math.log10(bgAsym)}
                            onChange={(e) => setBgAsym(Math.pow(10, parseFloat(e.target.value)))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                            lower = ignore peaks harder (baseline hugs valleys)
                          </div>
                        </div>
                      )}

                      {qcData && (
                        <div style={{ marginTop: 10, padding: 8, border: '1px solid var(--rule)', borderRadius: 4 }}>
                          <div className="flex-between" style={{ marginBottom: 6 }}>
                            <span className="small-caps">bg trace · {qcData.label}</span>
                            <button className="btn btn-ghost btn-tiny" onClick={() => setQcLane(null)} title="Close">
                              <Minus size={12} />
                            </button>
                          </div>
                          <QCPlot data={qcData} />
                          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: 'var(--ink)' }}>━ density</span>{"  "}
                            <span style={{ color: '#2563eb' }}>┅ ALS baseline</span>
                            {qcData.rawMean && <>{"  "}<span style={{ color: 'var(--muted)' }}>━ pre-ball</span></>}
                            <br />
                            <span style={{ color: 'var(--accent)' }}>▮ bound</span>{"  "}
                            <span style={{ color: 'var(--accent-2)' }}>▮ free</span> windows · baseline should sit just under the trace between bands
                          </div>
                        </div>
                      )}

                      {(lanes.length > 0 || bands || excludeRegions.length > 0) && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
                          <button
                            className="btn btn-ghost btn-full"
                            onClick={resetLanes}
                            title="Clear lanes, bands and concentrations — keep the gel image"
                          >
                            <RotateCcw size={13} /> Reset lanes & bands
                          </button>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                            for a second EMSA on the same image
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </section>

              {/* ---------- Concentrations ---------- */}
              {lanes.length > 0 && (
                <section className="section">
                  <SectionHead num="03" title="Enter protein concentrations" subtitle="the lane with [P] = 0 anchors the no-protein control" />
                  <div className="panel">
                    <div className="flex-center" style={{ marginBottom: 12 }}>
                      <span className="small-caps">unit</span>
                      <select className="select" value={concUnit} onChange={(e) => setConcUnit(e.target.value)}>
                        {["pM", "nM", "µM", "mM"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <span className="small-caps" style={{ marginLeft: 20 }}>[DNA] substrate</span>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        placeholder="—"
                        value={dnaConc}
                        onChange={(e) => setDnaConc(e.target.value)}
                        title="Total probe/DNA concentration (experiment-wide). Required for the tight-binding fit; reliable Kd needs [DNA] ≤ Kd/10 for the hyperbolic model."
                      />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)" }}>{concUnit}</span>
                      <div style={{ flex: 1 }} />
                    </div>
                    <div className="conc-grid">
                      {lanes.map((l, i) => (
                        <div key={i}>
                          <div className="small-caps mb-2">{l.label}</div>
                          <input
                            className="input"
                            placeholder="0"
                            value={concs[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConcs((cs) => {
                                const out = cs.slice();
                                while (out.length < lanes.length) out.push("");
                                out[i] = v;
                                return out;
                              });
                            }}
                          />
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                            {concUnit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ---------- Quantification + Fit ---------- */}
              {quant && (
                <section className="section">
                  <div className="flex-baseline" style={{ marginBottom: 14 }}>
                    <SectionHead
                      num="04"
                      title="Quantification & binding fit"
                      subtitle={
                        fitModel === "hill" ? "Hill: f = b + (top−b)·[P]ⁿ/(Kdⁿ+[P]ⁿ)"
                        : fitModel === "quadratic" ? "tight-binding: b + (top−b)·θ(P,[D],Kd) — corrects ligand depletion when [DNA] ≳ Kd"
                        : "hyperbolic: f = b + (top−b)·[P]/(Kd+[P])"
                      }
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      <button
                        className="btn"
                        onClick={exportGelPNG}
                        disabled={!imgSrc || lanes.length === 0}
                        title="Download clean gel PNG"
                      >
                        <Download size={13} /> Download gel
                      </button>
                      <button
                        className="btn"
                        onClick={exportCSV}
                        disabled={!quant}
                        title="Download per-lane quantification + fit summary as CSV"
                      >
                        <FileDown size={13} /> Download CSV
                      </button>
                      <button
                        className="btn"
                        onClick={addToOverlay}
                        disabled={!quant || !fit}
                        title="Add this binding curve to the Overlay tab"
                      >
                        <Layers size={13} /> {overlaySent ? "Added ✓" : "Add to overlay"}
                      </button>
                      <button
                        className="btn"
                        onClick={addToTriplicate}
                        disabled={!quant || !fit}
                        title="Add this binding curve to the Triplicate tab as one replicate"
                      >
                        <Sigma size={13} /> {triplicateSent ? "Added ✓" : "Add to triplicate"}
                      </button>
                      {bands && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>complex label</span>
                          <button className="btn btn-ghost" style={{ padding: '2px 7px', minWidth: 0 }}
                            onClick={() => setLabelOffsetBound((v) => v - 5)} title="Move label up">↑</button>
                          <button className="btn btn-ghost" style={{ padding: '2px 7px', minWidth: 0 }}
                            onClick={() => setLabelOffsetBound((v) => v + 5)} title="Move label down">↓</button>
                          {labelOffsetBound !== 0 && (
                            <button className="btn btn-ghost" style={{ padding: '2px 6px', minWidth: 0, fontSize: 10 }}
                              onClick={() => setLabelOffsetBound(0)} title="Reset offset">×</button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="row-2-eq">
                    <div className="panel" style={{ padding: 0 }}>
                      <div className="panel-head">
                        <Beaker size={13} />
                        <span className="small-caps">per-lane density</span>
                      </div>
                      <div style={{ overflow: "auto", maxHeight: 320 }}>
                        <table className="t">
                          <thead>
                            <tr>
                              <th>lane</th>
                              <th>[P] {concUnit}</th>
                              <th>bound</th>
                              <th>free</th>
                              <th>f<sub>bound</sub></th>
                            </tr>
                          </thead>
                          <tbody>
                            {quant.map((q, i) => (
                              <tr key={i}>
                                <td>{q.label}</td>
                                <td>{concs[i] === "" || concs[i] == null ? "—" : concs[i]}</td>
                                <td style={{ color: "var(--accent)" }}>{fmt(q.bound, 2)}</td>
                                <td style={{ color: "var(--accent-2)" }}>{fmt(q.free, 2)}</td>
                                <td>{fmt(q.fbound, 3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <div className="flex-center mb-3" style={{ gap: 8 }}>
                        <Activity size={13} />
                        <span className="small-caps">fit result</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {[["hill", "Hill"], ["hyperbolic", "Hyperbolic"], ["quadratic", "Tight-binding"]].map(([v, lab]) => (
                            <label key={v} className="checkbox-label" title={
                              v === "quadratic" ? "Corrects for ligand depletion — needs [DNA] substrate" : ""
                            }>
                              <input
                                type="radio"
                                name="fitmodel"
                                checked={fitModel === v}
                                onChange={() => setFitModel(v)}
                              />
                              {lab}
                            </label>
                          ))}
                        </div>
                      </div>
                      {!fit && (
                        <div className="panel" style={{ fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>
                          {fitModel === "quadratic" && !(parseFloat(dnaConc) > 0)
                            ? "Tight-binding needs the [DNA] substrate concentration — enter it in §03 above."
                            : "Provide at least 3 lanes with numeric concentrations to fit a binding curve."}
                        </div>
                      )}
                      {fit && (
                        <div className="cols-3-stat">
                          <div className="stat">
                            <div className="label">Kd</div>
                            <div className="value">
                              {fmt(fit.Kd, 3)}<span className="unit">{concUnit}</span>
                            </div>
                          </div>
                          <div className="stat">
                            <div className="label">Kd 95% CI <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· fit, single gel</span></div>
                            <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {ciStatus === "computing" && <CiSpinner />}
                              {ciStatus === "computing" && <span style={{ fontSize: 12, color: 'var(--muted)' }}>estimating…</span>}
                              {ciStatus === "done" && fitCI && (
                                <span style={{ fontSize: 15 }}>[{fmt(fitCI.kdLo, 3)}, {fmt(fitCI.kdHi, 3)}]</span>
                              )}
                              {ciStatus === "na" && <span style={{ fontSize: 12, color: 'var(--muted)' }}>≥ 4 points needed</span>}
                            </div>
                          </div>
                          <div className="stat">
                            <div className="label">Bmax (top)</div>
                            <div className="value">{fmt(fit.Bmax, 3)}{fit.Bmax >= 0.999 && <span className="unit">capped</span>}</div>
                          </div>
                          <div className="stat">
                            <div className="label">baseline</div>
                            <div className="value">{fmt(fit.bottom, 3)}</div>
                          </div>
                          {fitModel === "hill" && (
                            <div className="stat">
                              <div className="label">Hill n</div>
                              <div className="value">{fmt(fit.n, 2)}</div>
                            </div>
                          )}
                          <div className="stat span-all">
                            <div className="label">goodness of fit · R²</div>
                            <div className="value">
                              {fmt(fit.r2, 4)}
                              <span className="unit">
                                {fit.r2 > 0.95 ? "excellent" : fit.r2 > 0.85 ? "good" : "weak"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {fit && (() => {
                        const maxX = Math.max(...concs.map((c) => parseFloat(c)).filter((x) => Number.isFinite(x) && x > 0), 0);
                        const wideCI = fitCI && (fitCI.kdHi - fitCI.kdLo) > fitCI.kd; // interval wider than Kd
                        const lowSat = fit.Kd > 0 && maxX > 0 && maxX < 10 * fit.Kd;
                        if (!wideCI && !lowSat) return null;
                        return (
                          <div className="panel" style={{ fontSize: 12, color: "var(--accent)", fontStyle: "italic", marginTop: 10 }}>
                            ⚠ Kd is poorly constrained{lowSat ? ` — top point (${fmt(maxX, 2)} ${concUnit}) is below ~10×Kd, so saturation isn't reached` : " — the bootstrap CI is wider than Kd itself"}. The Kd/plateau trade-off means this value is uncertain; extend the titration to higher [protein] for a reliable fit.
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {fit && (
                    <div className="chart-card">
                      <div className="flex-baseline" style={{ marginBottom: 8 }}>
                        <div>
                          <div className="chart-title">Binding isotherm</div>
                          <div className="small-caps">fraction bound vs. [protein]</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            className={`btn btn-ghost${normFit ? ' btn-primary' : ''}`}
                            onClick={() => setNormFit((v) => !v)}
                            style={{ padding: '4px 10px' }}
                            title="Normalised: plot specific binding (f − baseline)/(top − baseline), 0→1. Raw: plot f_bound with the fitted baseline offset. Kd is identical either way."
                          >
                            {normFit ? 'Normalised 0→1' : 'Raw f_bound'}
                          </button>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-2)" }}>
                            n = {chartPoints.filter((d) => Number.isFinite(d.x) && d.x > 0).length} points
                          </span>
                          <button
                            className="btn btn-ghost"
                            onClick={exportChartPNG}
                            title="Download binding curve as PNG"
                            style={{ padding: '4px 10px' }}
                          >
                            <Download size={12} /> Download curve
                          </button>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 360 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={mergedChart} margin={{ top: 16, right: 24, bottom: 36, left: 12 }}>
                            <CartesianGrid stroke="rgba(26,24,22,0.08)" strokeDasharray="2 4" />
                            <XAxis
                              type="number"
                              dataKey="x"
                              scale="log"
                              domain={[zeroPlot ? zeroPlot.pseudoX : "auto", "auto"]}
                              ticks={xTicks}
                              tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }}
                              stroke="var(--ink)"
                              tickFormatter={(v) => {
                                if (zeroPlot && Math.abs(v - zeroPlot.pseudoX) <= zeroPlot.pseudoX * 1e-6) return "0";
                                if (v >= 1000) return `${v / 1000}k`;
                                if (v < 0.01) return v.toExponential(0);
                                return String(v);
                              }}
                              label={{
                                value: `[Protein] (${concUnit})`,
                                position: "insideBottom",
                                offset: -22,
                                style: { fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 14, fill: "var(--ink)" },
                              }}
                            />
                            <YAxis
                              domain={[0, 1]}
                              allowDataOverflow={true}
                              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                              tickFormatter={(v) => v.toFixed(1)}
                              tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }}
                              stroke="var(--ink)"
                              label={{
                                value: normFit ? "Specific binding (norm.)" : "Fraction bound",
                                angle: -90,
                                position: "insideLeft",
                                style: { fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 14, fill: "var(--ink)", textAnchor: "middle" },
                              }}
                            />
                            <Tooltip
                              contentStyle={{ background: "var(--paper)", border: "1px solid var(--ink)", fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--ink)" }}
                              formatter={(v, name) => [Number.isFinite(v) ? v.toFixed(4) : v, name === "fit" ? "model" : "f bound"]}
                              labelFormatter={(v) => (zeroPlot && Math.abs(v - zeroPlot.pseudoX) <= zeroPlot.pseudoX * 1e-6) ? `[P] = 0 ${concUnit}` : `[P] = ${Number.isFinite(v) ? v.toPrecision(3) : v} ${concUnit}`}
                            />
                            <ReferenceLine
                              x={fit.Kd}
                              stroke="var(--accent)"
                              strokeDasharray="4 3"
                              label={{
                                value: `Kd = ${fmt(fit.Kd, 3)} ${concUnit}`,
                                position: "top",
                                fill: "var(--accent)",
                                fontFamily: "JetBrains Mono",
                                fontSize: 11,
                              }}
                            />
                            <ReferenceLine y={normFit ? 0.5 : fit.bottom + (fit.Bmax - fit.bottom) / 2} stroke="var(--ink-2)" strokeOpacity={0.3} strokeDasharray="2 4" />
                            <Line type="monotone" dataKey="fit" stroke="var(--ink)" strokeWidth={1.6} dot={false} isAnimationActive={false} name="fit" />
                            <Scatter
                              dataKey="y"
                              fill="var(--accent)"
                              line={false}
                              shape={(props) => {
                                const { cx, cy } = props;
                                if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
                                return (
                                  <circle cx={cx} cy={cy} r={5} fill="var(--paper-3)" stroke="var(--accent)" strokeWidth={2} />
                                );
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", fontStyle: "italic", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                        {normFit
                          ? `Normalised specific binding (f − baseline)/(top − baseline) · baseline = ${fmt(fit.bottom, 3)}, top = ${fmt(fit.Bmax, 3)} · Kd unaffected by normalisation`
                          : `Raw fraction bound · fitted baseline = ${fmt(fit.bottom, 3)} at [P]=0 · top constrained ≤ 1`}
                        {" · "}Nelder–Mead fit · log X · zero-protein control shown at left (0), included in fit
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          <footer className="app-footer">
            <div className="footer-left">
              <span>BOUND &amp; FREE — a binding-curve workbench</span>
              <span className="footer-about">
                A binding-curve workbench for EMSA Kd estimation · MIT-licensed ·{" "}
                <a href="https://github.com/lucaskuhlen-source/emsa-analyser" target="_blank" rel="noopener noreferrer">GitHub</a>
              </span>
              <span className="footer-cite">Cite: Kuhlen, L. (2026). Bound &amp; Free. emsa-analyzer.com</span>
            </div>
            <span className="fin">fin.</span>
          </footer>
        </div>
      </div>
    </>
  );
}

