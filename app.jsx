import React from "react";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import {
  Upload,
  Wand2,
  RotateCcw,
  Minus,
  Beaker,
  ArrowRight,
  Activity,
  Crop,
  Scissors,
  Maximize2,
  Pipette,
  Download,
  Ban,
  RotateCw,
  FileDown,
} from "lucide-react";

/* ----------------------------------------------------------------------------
   TIFF SUPPORT TEMPORARILY REMOVED (vendored UTIF.js block cut while we rework
   rotation). To re-enable: paste the UTIF block back here and restore the TIFF
   branch in decodeFile(). The block is saved as utif_vendored.js.
   ---------------------------------------------------------------------------- */


/* ====================================================================
   Image processing primitives
   ==================================================================== */

function imageToSignal(img) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const sig = new Float32Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sig[p] = (255 - L) / 255;
  }
  return { sig, W, H };
}

// Promisified image loader from a data: URL.
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Image failed to load"));
    im.src = src;
  });
}

// Decode an uploaded file into a display URL (8-bit, for <img>) plus a high-precision
// signal ({sig,W,H}). JPEG/PNG go through the canvas (8-bit). TIFF is decoded by the
// vendored UTIF: display via toRGBA8→PNG, but the SIGNAL is built from the RAW samples
// at full bit depth (16-bit linear preserved), which is the whole reason to use TIFF.
async function decodeFile(file) {
  const name = (file.name || "").toLowerCase();
  const isTiff = name.endsWith(".tif") || name.endsWith(".tiff");

  if (isTiff) {
    // TIFF temporarily disabled — the UTIF decoder block was cut during the rotation
    // rework. Re-enable by pasting the UTIF block back (see utif_vendored.js) and
    // restoring the decode branch that was here.
    throw new Error("TIFF support is temporarily disabled — please use JPEG or PNG for now.");
  }

  // JPEG / PNG path — data: URL + 8-bit canvas signal.
  const displayUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
  const im = await loadImage(displayUrl);
  let baseSig;
  try { baseSig = imageToSignal(im); }
  catch (e) { baseSig = { sig: null, W: im.naturalWidth, H: im.naturalHeight }; }
  return { displayUrl, baseSig };
}

// Bilinear sample of the float signal at sub-pixel (x,y). Outside the image returns 0
// (empty background reads as no signal, consistent with the dark-band-positive convention).
function bilinear(sig, W, H, x, y) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = sig[y0 * W + x0], b = sig[y0 * W + x1];
  const c = sig[y1 * W + x0], d = sig[y1 * W + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

// Straighten the original image at angle `deg` (rotation pivot = original image centre)
// and optionally CROP to `cropRect` (a sub-rectangle in straightened full-frame coords).
//
// - cropRect null  → v8 behaviour: full-frame straighten into a W×H buffer (view never
//   zooms; the EMSA area is a separate sub-rect ROI).
// - cropRect set   → straighten + sample ONLY that window into a cropRect.w×cropRect.h
//   buffer (a destructive, zooming crop). Because the rotation field is the same full
//   straightened frame in both cases, we just window the identical sub-rect out of both
//   the float signal and the display canvas, so signal and display stay aligned. The crop
//   is a window into the straightened frame, so re-straightening (rotation) about the
//   image centre keeps the same window valid for small angle tweaks.
//
// Signal is bilinear-resampled from the float baseSignal (preserves 16-bit/TIFF depth);
// the display is a canvas rotate of the 8-bit original.
async function buildWorkBuffer(baseSignal, origDisplaySrc, deg, cropRect = null) {
  const { sig, W, H } = baseSignal;
  const cx = W / 2, cy = H / 2;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);

  const outW = cropRect ? cropRect.w : W;
  const outH = cropRect ? cropRect.h : H;
  const ox0 = cropRect ? cropRect.x : 0; // window origin in straightened full-frame coords
  const oy0 = cropRect ? cropRect.y : 0;

  // ---- Signal: bilinear resample from the float base signal ----
  let workSig = null;
  if (sig) {
    workSig = new Float32Array(outW * outH);
    for (let v = 0; v < outH; v++) {
      const dv = (oy0 + v) - cy; // straightened-frame row offset from centre
      for (let u = 0; u < outW; u++) {
        const du = (ox0 + u) - cx;
        const ox = cx + du * cos - dv * sin;
        const oy = cy + du * sin + dv * cos;
        workSig[v * outW + u] = bilinear(sig, W, H, ox, oy);
      }
    }
  }

  // ---- Display: canvas rotate (-a straightens) of the 8-bit original ----
  const im = await loadImage(origDisplaySrc);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.translate(cx, cy);
  ctx.rotate(-a);
  ctx.translate(-cx, -cy);
  ctx.drawImage(im, 0, 0);

  let displayUrl;
  if (cropRect) {
    // Window the identical sub-rect out of the straightened display canvas.
    const cc = document.createElement("canvas");
    cc.width = outW; cc.height = outH;
    const cctx = cc.getContext("2d");
    cctx.drawImage(c, ox0, oy0, outW, outH, 0, 0, outW, outH);
    displayUrl = cc.toDataURL("image/png");
  } else {
    displayUrl = c.toDataURL("image/png");
  }

  return { displayUrl, workSig, W: outW, H: outH };
}

function findGelROI(sig, W, H) {
  const sample = [];
  const step = Math.max(1, Math.floor((W * H) / 50000));
  for (let i = 0; i < sig.length; i += step) sample.push(sig[i]);
  sample.sort((a, b) => a - b);
  const p90 = sample[Math.floor(sample.length * 0.9)];
  const thr = Math.max(0.05, p90 * 0.25);

  let xMin = W, xMax = 0, yMin = H, yMax = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (sig[y * W + x] > thr) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (xMax < xMin || yMax < yMin) return { x: 0, y: 0, w: W, h: H };
  const padX = Math.round((xMax - xMin) * 0.04);
  const padY = Math.round((yMax - yMin) * 0.04);
  return {
    x: Math.max(0, xMin - padX),
    y: Math.max(0, yMin - padY),
    w: Math.min(W, xMax + padX) - Math.max(0, xMin - padX),
    h: Math.min(H, yMax + padY) - Math.max(0, yMin - padY),
  };
}

function columnProfile(sig, W, roi) {
  const prof = new Float32Array(roi.w);
  for (let dx = 0; dx < roi.w; dx++) {
    let s = 0;
    const x = roi.x + dx;
    for (let dy = 0; dy < roi.h; dy++) s += sig[(roi.y + dy) * W + x];
    prof[dx] = s / roi.h;
  }
  return prof;
}

function smooth(arr, w) {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = -w; j <= w; j++) {
      const k = i + j;
      if (k >= 0 && k < n) { s += arr[k]; c++; }
    }
    out[i] = s / c;
  }
  return out;
}

function findPeaks(arr, { minProminence = 0.02, minDist = 5 } = {}) {
  const n = arr.length;
  const cands = [];
  for (let i = 1; i < n - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] >= arr[i + 1]) {
      let lMin = arr[i], rMin = arr[i];
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j] > arr[i]) break;
        if (arr[j] < lMin) lMin = arr[j];
      }
      for (let j = i + 1; j < n; j++) {
        if (arr[j] > arr[i]) break;
        if (arr[j] < rMin) rMin = arr[j];
      }
      const prom = arr[i] - Math.max(lMin, rMin);
      if (prom >= minProminence) cands.push({ x: i, y: arr[i], prom });
    }
  }
  cands.sort((a, b) => b.prom - a.prom);
  const kept = [];
  for (const c of cands) {
    if (kept.every((k) => Math.abs(k.x - c.x) >= minDist)) kept.push(c);
  }
  kept.sort((a, b) => a.x - b.x);
  return kept;
}

// ---- Background subtraction: per-lane Asymmetric Least Squares (ALS) baseline ----
//
// We treat each lane as a 1-D vertical density profile (mean signal per row across the
// lane strip) and fit a smooth baseline that runs *under* the bands. ALS (Eilers &
// Boelens 2005) minimises  Σ wᵢ(yᵢ−zᵢ)² + λ Σ(Δ²zᵢ)²  with asymmetric weights:
// points above the current baseline (peaks) get weight p≪1, points below get 1−p, so the
// baseline ignores bands and follows the true background — including a vertical gradient.
// Each iteration solves (W + λ·DᵀD)·z = W·y, a symmetric pentadiagonal system, via a
// banded Cholesky (O(n) per solve). This replaces the old percentile / flat-mean schemes:
// it is robust, needs no user-drawn region, and handles top-to-bottom gradients per lane.

// Build the lane vertical profile: per-row mean over the strip [x1,x2) within the ROI,
// honouring pixel exclusions. Returns row sums, included counts, and means (length roi.h).
function laneProfile(sig, W, roi, x1, x2, isExcluded) {
  const h = roi.h;
  const rowSum = new Float64Array(h);
  const counts = new Int32Array(h);
  const mean = new Float64Array(h);
  for (let dy = 0; dy < h; dy++) {
    const y = roi.y + dy;
    let s = 0, n = 0;
    for (let x = x1; x < x2; x++) {
      if (isExcluded && isExcluded(x, y)) continue;
      s += sig[y * W + x];
      n++;
    }
    rowSum[dy] = s;
    counts[dy] = n;
    mean[dy] = n > 0 ? s / n : NaN;
  }
  // Fill any fully-excluded rows by carrying the nearest valid neighbour so ALS sees a
  // continuous profile (these rows contribute 0 area to integration anyway).
  let last = 0;
  for (let i = 0; i < h; i++) { if (Number.isNaN(mean[i])) mean[i] = last; else last = mean[i]; }
  for (let i = h - 1; i >= 0; i--) { if (mean[i] === 0 && counts[i] === 0 && i + 1 < h) mean[i] = mean[i + 1]; }
  return { rowSum, counts, mean };
}

// Asymmetric Least Squares baseline of a 1-D profile y.
//   lambda — smoothness/stiffness (larger = straighter baseline)
//   p      — asymmetry (smaller = hugs the valleys, ignores peaks more aggressively)
function alsBaseline(y, lambda, p, niter = 10) {
  const n = y.length;
  const z = new Float64Array(n);
  if (n < 3) { for (let i = 0; i < n; i++) z[i] = y[i]; return z; }

  // Second-difference penalty DᵀD as constant lower-banded diagonals (bandwidth 2).
  const dtd0 = new Float64Array(n); // main diagonal
  const dtd1 = new Float64Array(n); // (i, i-1)
  const dtd2 = new Float64Array(n); // (i, i-2)
  for (let k = 0; k < n - 2; k++) {
    dtd0[k] += 1; dtd0[k + 1] += 4; dtd0[k + 2] += 1;
    dtd1[k + 1] += -2; dtd1[k + 2] += -2;
    dtd2[k + 2] += 1;
  }

  const w = new Float64Array(n).fill(1);
  const a0 = new Float64Array(n), a1 = new Float64Array(n), a2 = new Float64Array(n);
  const L0 = new Float64Array(n), L1 = new Float64Array(n), L2 = new Float64Array(n);
  const u = new Float64Array(n), rhs = new Float64Array(n);

  for (let it = 0; it < niter; it++) {
    for (let i = 0; i < n; i++) {
      a0[i] = w[i] + lambda * dtd0[i];
      a1[i] = lambda * dtd1[i];
      a2[i] = lambda * dtd2[i];
      rhs[i] = w[i] * y[i];
    }
    // Banded Cholesky A = L·Lᵀ (L lower, bandwidth 2)
    for (let i = 0; i < n; i++) {
      L2[i] = i >= 2 ? a2[i] / L0[i - 2] : 0;
      L1[i] = i >= 1 ? (a1[i] - (i >= 2 ? L2[i] * L1[i - 1] : 0)) / L0[i - 1] : 0;
      let d = a0[i] - (i >= 1 ? L1[i] * L1[i] : 0) - (i >= 2 ? L2[i] * L2[i] : 0);
      L0[i] = Math.sqrt(d > 1e-12 ? d : 1e-12);
    }
    // Forward: L·u = rhs
    for (let i = 0; i < n; i++) {
      let s = rhs[i];
      if (i >= 1) s -= L1[i] * u[i - 1];
      if (i >= 2) s -= L2[i] * u[i - 2];
      u[i] = s / L0[i];
    }
    // Back: Lᵀ·z = u
    for (let i = n - 1; i >= 0; i--) {
      let s = u[i];
      if (i + 1 < n) s -= L1[i + 1] * z[i + 1];
      if (i + 2 < n) s -= L2[i + 2] * z[i + 2];
      z[i] = s / L0[i];
    }
    // Asymmetric weight update
    for (let i = 0; i < n; i++) w[i] = y[i] > z[i] ? p : (1 - p);
  }
  return z;
}

// Integrate one band box against a per-row baseline. yTop/yBot are absolute image rows.
// net = Σ_rows ( rowSum − baseline[row]·includedCount[row] ). Signed (no per-pixel clamp).
function integrateBox(rowSum, counts, baseline, roiY, yTop, yBot) {
  const h = rowSum.length;
  let raw = 0, net = 0, area = 0;
  const d0 = Math.max(0, Math.round(yTop) - roiY);
  const d1 = Math.min(h, Math.round(yBot) - roiY);
  for (let dy = d0; dy < d1; dy++) {
    raw += rowSum[dy];
    area += counts[dy];
    net += rowSum[dy] - baseline[dy] * counts[dy];
  }
  return { raw, net, area };
}

// ---- Global background: sliding-paraboloid rolling ball (Sternberg / ImageJ-style) ----
//
// A paraboloid of curvature c = 1/r² is "rolled" under the intensity surface; the locus of
// its top is the background. Equivalent to a grayscale morphological OPENING with a
// parabolic structuring element. We do it the sliding-paraboloid way: a 1-D parabolic
// opening along every row, then along every column (separable directional passes), which is
// O(W·H) per direction. The 1-D parabolic erosion is the lower envelope of upward parabolas
// f(q)+c(p−q)², computed in linear time by the Felzenszwalb–Huttenlocher algorithm;
// dilation is −erosion(−·), and opening = dilation(erosion(·)). Because an opening never
// exceeds the original, the corrected signal (original − background) is ≥ 0 by construction.
// Handles 2-D illumination/staining gradients that a per-lane 1-D method cannot see.

// 1-D parabolic erosion (lower envelope). Scratch arrays v (Int32 ≥n) and z (Float64 ≥n+1).
function parabErode1D(f, n, c, out, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) {
      const vk = v[k];
      s = ((f[q] + c * q * q) - (f[vk] + c * vk * vk)) / (2 * c * (q - vk));
      if (s <= z[k]) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let p = 0; p < n; p++) {
    while (z[k + 1] < p) k++;
    const vk = v[k];
    out[p] = f[vk] + c * (p - vk) * (p - vk);
  }
}

// 1-D parabolic opening in place on `line` (length n). e/neg are scratch (≥n).
function parabOpenLine(line, n, c, e, neg, v, z) {
  parabErode1D(line, n, c, e, v, z);        // erosion → e
  for (let i = 0; i < n; i++) neg[i] = -e[i];
  parabErode1D(neg, n, c, line, v, z);      // erosion of −e → line
  for (let i = 0; i < n; i++) line[i] = -line[i]; // dilation = −erode(−e); line ← opening
}

// Returns the rolling-ball background as a Float32Array (same layout as sig). radius in px.
function rollingBallBackground(sig, W, H, radius) {
  const c = 1 / (radius * radius);
  const bg = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) bg[i] = sig[i];
  const maxDim = Math.max(W, H);
  const line = new Float64Array(maxDim);
  const e = new Float64Array(maxDim);
  const neg = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);
  for (let y = 0; y < H; y++) {            // along rows (x)
    const base = y * W;
    for (let x = 0; x < W; x++) line[x] = bg[base + x];
    parabOpenLine(line, W, c, e, neg, v, z);
    for (let x = 0; x < W; x++) bg[base + x] = line[x];
  }
  for (let x = 0; x < W; x++) {            // along columns (y)
    for (let y = 0; y < H; y++) line[y] = bg[y * W + x];
    parabOpenLine(line, H, c, e, neg, v, z);
    for (let y = 0; y < H; y++) bg[y * W + x] = line[y];
  }
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = bg[i];
  return out;
}

/* ====================================================================
   Curve fitting
   ==================================================================== */

function nelderMead(f, x0, opts = {}) {
  const { maxIter = 800, tol = 1e-9, step = 0.1 } = opts;
  const n = x0.length;
  const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] = p[i] + (p[i] === 0 ? step : Math.abs(p[i]) * step);
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let iter = 0; iter < maxIter; iter++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]);
    vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol) break;
    const cen = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) cen[j] += simplex[i][j];
    for (let j = 0; j < n; j++) cen[j] /= n;
    const xr = cen.map((c, j) => c + alpha * (c - simplex[n][j]));
    const fr = f(xr);
    if (fr < vals[n - 1] && fr >= vals[0]) {
      simplex[n] = xr; vals[n] = fr; continue;
    }
    if (fr < vals[0]) {
      const xe = cen.map((c, j) => c + gamma * (xr[j] - c));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; }
      else { simplex[n] = xr; vals[n] = fr; }
      continue;
    }
    const xc = cen.map((c, j) => c + rho * (simplex[n][j] - c));
    const fc = f(xc);
    if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; continue; }
    for (let i = 1; i <= n; i++) {
      simplex[i] = simplex[0].map((x, j) => x + sigma * (simplex[i][j] - x));
      vals[i] = f(simplex[i]);
    }
  }
  return { x: simplex[0], fx: vals[0] };
}

function fitBinding(xs, ys, { model: modelKind = "hill", D = null, maxIter = 1600 } = {}) {
  const finite = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0);
  if (finite.length < 3) return null;
  const X = finite.map((p) => p[0]);
  const Y = finite.map((p) => p[1]);
  const yMax = Math.max(...Y);
  const yMin = Math.min(...Y);
  const yHalf = (yMin + yMax) / 2;
  let xHalf = X[Math.floor(X.length / 2)] || 1;
  for (let i = 0; i < Y.length; i++) {
    if (Y[i] >= yHalf && X[i] > 0) { xHalf = X[i]; break; }
  }

  const hill = modelKind === "hill";
  const quad = modelKind === "quadratic";
  // Tight-binding requires a known probe/DNA concentration; without it the fit is undefined.
  if (quad && (!Number.isFinite(D) || D <= 0)) return null;

  // Normalised 0→1 binding shape g(x). Quadratic/tight-binding uses the numerically-stable
  // 2[P]/(([P]+[D]+Kd)+sqrt(...)) form (avoids cancellation as [D]→0, reduces to hyperbolic).
  const shape = hill
    ? (x, K, n) => Math.pow(x, n) / (Math.pow(K, n) + Math.pow(x, n))
    : quad
    ? (x, K) => { const s = x + D + K; const disc = Math.max(0, s * s - 4 * x * D); return (2 * x) / (s + Math.sqrt(disc)); }
    : (x, K) => x / (K + x);

  // Parameters: [bottom, top, Kd, (n)]. The curve is bottom + (top−bottom)·g(x).
  //   bottom — apparent signal at [P]=0 (probe behaviour / non-specific), constrained ≥ 0.
  //   top    — true plateau (absolute fraction bound), constrained ≤ 1.
  // Kd comes from the SHAPE and is unaffected by the affine bottom/top, so modelling the
  // offset instead of forcing the curve through 0 (or hand-subtracting it) keeps Kd unbiased.
  const bottom0 = Math.max(0, Math.min(0.9, yMin));
  const top0 = Math.min(1, Math.max(bottom0 + 0.05, yMax));
  const init = hill
    ? [bottom0, top0, Math.max(1e-6, xHalf), 1.0]
    : [bottom0, top0, Math.max(1e-6, xHalf)];

  const clamp = (p) => {
    const bottom = Math.max(0, p[0]);
    let top = Math.min(1, p[1]);
    if (top < bottom) top = bottom;            // span ≥ 0
    const K = Math.abs(p[2]) || 1e-9;          // Kd > 0
    if (hill) return [bottom, top, K, Math.max(0.05, p[3])];
    return [bottom, top, K];
  };
  const evalModel = (x, p) =>
    p[0] + (p[1] - p[0]) * (hill ? shape(x, p[2], p[3]) : shape(x, p[2]));

  // Box-constrained Nelder–Mead: evaluate at the feasible projection of p and penalise the
  // projection distance, so the simplex is pushed back inside { bottom≥0, top≤1, K>0, n>0 }.
  const loss = (praw) => {
    if (praw.some((v) => !Number.isFinite(v))) return 1e9;
    const p = clamp(praw);
    let pen = 0;
    for (let i = 0; i < praw.length; i++) { const d = praw[i] - p[i]; pen += d * d; }
    let s = 0;
    for (let i = 0; i < X.length; i++) { const r = evalModel(X[i], p) - Y[i]; s += r * r; }
    return s + 1e4 * pen;
  };
  const res = nelderMead(loss, init, { maxIter });
  const P = clamp(res.x);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < X.length; i++) {
    const yh = evalModel(X[i], P);
    ssRes += (Y[i] - yh) ** 2;
    ssTot += (Y[i] - meanY) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;
  return {
    bottom: P[0],
    Bmax: P[1],                                   // top (absolute plateau, ≤ 1)
    Kd: P[2],
    n: hill ? P[3] : 1,
    r2,
    model: (x) => evalModel(x, P),                                  // raw fraction bound
    shape: (x) => (hill ? shape(x, P[2], P[3]) : shape(x, P[2])),   // normalised 0→1 (specific binding)
  };
}

// Residual-bootstrap 95% CI for Kd from a SINGLE fit. Resamples the fit residuals with
// replacement onto the fitted curve, refits ~nBoot times, and takes percentiles of the Kd
// distribution. This is a within-gel *fit* uncertainty (how tightly these points pin Kd) —
// NOT replicate/run-to-run reproducibility, which is typically wider. Its most useful read
// is diagnostic: a wide interval means the titration didn't reach saturation (top/Kd trade
// off). Percentile bootstrap → asymmetric, never-negative interval, robust for small n and
// for the boundary-active `top ≤ 1` case where asymptotic SEs misbehave.
function bootstrapKd(xs, ys, opts, nBoot = 800) {
  const base = fitBinding(xs, ys, opts);
  if (!base) return null;
  const pairs = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0);
  const X = pairs.map((p) => p[0]);
  const Y = pairs.map((p) => p[1]);
  const n = X.length;
  if (n < 4) return null; // residual bootstrap is meaningless with too few points
  const fitted = X.map((x) => base.model(x));
  const resid = Y.map((y, i) => y - fitted[i]);
  const fastOpts = { ...opts, maxIter: 500 };

  const kds = [], ns = [], tops = [], bots = [];
  for (let b = 0; b < nBoot; b++) {
    const yb = fitted.map((f) => f + resid[(Math.random() * n) | 0]);
    const fb = fitBinding(X, yb, fastOpts);
    if (fb && Number.isFinite(fb.Kd) && fb.Kd > 0) {
      kds.push(fb.Kd); ns.push(fb.n); tops.push(fb.Bmax); bots.push(fb.bottom);
    }
  }
  if (kds.length < nBoot * 0.5) return null; // fit too unstable to trust a CI

  const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return {
    kd: base.Kd,
    kdLo: pct(kds, 0.025),
    kdHi: pct(kds, 0.975),
    kdMedian: pct(kds, 0.5),
    nLo: pct(ns, 0.025), nHi: pct(ns, 0.975),
    samples: kds.length,
  };
}

/* ====================================================================
   Helpers
   ==================================================================== */

const fmt = (x, d = 3) => {
  if (!Number.isFinite(x)) return "—";
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) return x.toExponential(d);
  return x.toFixed(d);
};

function SectionHead({ num, title, subtitle }) {
  return (
    <div className="section-head">
      <span className="section-num">§{num}</span>
      <h3 className="section-title">{title}</h3>
      {subtitle && <span className="section-sub">— {subtitle}</span>}
    </div>
  );
}

/* ====================================================================
   Image overlay with drag handles
   ==================================================================== */

function ImageOverlay({
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
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
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

// Small "dots around a circle" spinner shown while the bootstrap Kd CI computes.
function CiSpinner() {
  const dots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    dots.push(
      <circle key={i} cx={9 + 6 * Math.cos(a)} cy={9 + 6 * Math.sin(a)} r={1.4}
        fill="var(--ink)" opacity={0.15 + 0.85 * (i / 8)} />
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-label="computing">
      <g>
        {dots}
        <animateTransform attributeName="transform" type="rotate"
          from="0 9 9" to="360 9 9" dur="0.8s" repeatCount="indefinite" />
      </g>
    </svg>
  );
}

// Per-lane background QC plot: the lane's density trace (corrected), the ALS baseline fit
// under it (dashed blue), the pre-rolling-ball trace for reference (faint, when the ball is
// on), and the bound/free integration windows (shaded). Lets the user judge whether the
// smoothness/asymmetry/radius settings are sensible before trusting the numbers.
function QCPlot({ data }) {
  const { h, mean, rawMean, baseline, bound, free } = data;
  const Wp = 300, Hp = 150, pl = 6, pr = 6, pt = 8, pb = 10;
  const innerW = Wp - pl - pr, innerH = Hp - pt - pb;
  let lo = 0, hi = 1e-6;
  const scan = (arr) => { for (let i = 0; i < arr.length; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; } };
  scan(mean); scan(baseline); if (rawMean) scan(rawMean);
  const sx = (i) => pl + (h <= 1 ? 0 : (i / (h - 1)) * innerW);
  const sy = (val) => pt + innerH - ((val - lo) / (hi - lo)) * innerH;
  const path = (arr) => { let d = ""; for (let i = 0; i < arr.length; i++) d += (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(arr[i]).toFixed(1); return d; };
  const shade = (r, color) => r && r[1] > r[0]
    ? <rect x={sx(r[0])} y={pt} width={Math.max(0, sx(r[1]) - sx(r[0]))} height={innerH} fill={color} fillOpacity="0.12" /> : null;
  return (
    <svg viewBox={`0 0 ${Wp} ${Hp}`} style={{ width: "100%", display: "block", background: "var(--paper-3)", borderRadius: 4 }}>
      {shade(bound, "var(--accent)")}
      {shade(free, "var(--accent-2)")}
      <line x1={pl} y1={sy(0)} x2={Wp - pr} y2={sy(0)} stroke="var(--rule)" strokeWidth="0.5" />
      {rawMean && <path d={path(rawMean)} fill="none" stroke="var(--muted)" strokeWidth="0.8" opacity="0.6" />}
      <path d={path(mean)} fill="none" stroke="var(--ink)" strokeWidth="1.3" />
      <path d={path(baseline)} fill="none" stroke="#2563eb" strokeWidth="1.3" strokeDasharray="3 2" />
    </svg>
  );
}

/* ====================================================================
   Main app
   ==================================================================== */

function App() {
  const [imgSrc, setImgSrc] = useState(null);
  const [origDisplaySrc, setOrigDisplaySrc] = useState(null); // 8-bit source for rotation
  const [baseSignal, setBaseSignal] = useState(null);         // high-precision signal at 0°
  const [rotation, setRotation] = useState(0);                // straighten angle, adjustable anytime
  const [loadError, setLoadError] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [roi, setRoi] = useState(null);
  const [cropRect, setCropRect] = useState(null);   // destructive crop window (straightened full-frame coords); null = full frame
  const [lanes, setLanes] = useState([]);
  const [laneWidth, setLaneWidth] = useState(40);
  const [bands, setBands] = useState(null);
  const [concs, setConcs] = useState([]);
  const [concUnit, setConcUnit] = useState("nM");
  const [fitModel, setFitModel] = useState("hill"); // 'hyperbolic' | 'hill' | 'quadratic'
  const [normFit, setNormFit] = useState(true); // display specific binding normalised 0→1 (vs raw with offset)
  const [dnaConc, setDnaConc] = useState(""); // [DNA] substrate, experiment-wide, for tight-binding
  const [toolMode, setToolMode] = useState(null);   // null | 'crop' (destructive) | 'emsa' (ROI) | 'exclude'
  const [bgSubtract, setBgSubtract] = useState(false);  // per-lane ALS background subtraction (off by default; rolling ball handles most)
  const [bgLambda, setBgLambda] = useState(1e5);        // ALS smoothness/stiffness
  const [bgAsym, setBgAsym] = useState(0.01);           // ALS asymmetry (peak rejection)
  const [rbOn, setRbOn] = useState(true);               // global rolling-ball (paraboloid) subtraction (on by default)
  const [rbRadius, setRbRadius] = useState(60);         // rolling-ball radius (px)
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
  // working coords. Does NOT crop/zoom the view or rebuild the buffer. Lanes outside the new
  // area are dropped; bands are kept only if they fall inside. ----
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
    setLanes((ls) =>
      ls.filter((l) => l.x >= newRoi.x && l.x <= newRoi.x + newRoi.w)
        .map((l, i) => ({ ...l, label: `L${i + 1}` }))
    );
    setBands((b) => {
      if (!b) return null;
      const ys = [b.boundY1, b.boundY2, b.freeY1, b.freeY2];
      const allInside = ys.every((y) => y >= newRoi.y && y <= newRoi.y + newRoi.h);
      return allInside ? b : null;
    });
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

  // Global rolling-ball (paraboloid) background, recomputed only when the image or the
  // rolling-ball settings change — NOT on every lane/band tweak.
  const rbBackground = useMemo(() => {
    if (!rbOn || !signalData || !signalData.sig) return null;
    return rollingBallBackground(signalData.sig, signalData.W, signalData.H, rbRadius);
  }, [rbOn, rbRadius, signalData]);

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

  const mergedChart = useMemo(() => {
    const span = fit ? Math.max(1e-9, fit.Bmax - fit.bottom) : 1;
    const yT = (y) => (normFit && fit ? (y - fit.bottom) / span : y);
    const pts = [...fitCurve.map((p) => ({ ...p }))];
    for (const p of chartPoints) {
      if (!Number.isFinite(p.x) || p.x <= 0) continue;
      pts.push({ x: p.x, y: yT(p.y), label: p.label });
    }
    return pts.sort((a, b) => a.x - b.x);
  }, [fitCurve, chartPoints, fit, normFit]);

  // ---- Quant table CSV download ----
  const exportCSV = useCallback(() => {
    if (!quant) return;
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
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = c == null ? "" : String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
    // data: URL (blob: is blocked in the sandboxed iframe)
    const reader = new FileReader();
    reader.onload = (e) => {
      const a = document.createElement("a");
      a.href = e.target.result;
      a.download = "emsa-quantification.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };
    reader.readAsDataURL(new Blob([csv], { type: "text/csv" }));
  }, [quant, concs, concUnit, fit, fitCI, fitModel, dnaConc]);

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
    const xMin = Math.min(...finiteX) * 0.3;
    const xMax = Math.max(...finiteX) * 3;
    const lo = Math.log10(Math.max(1e-6, xMin));
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

footer.app-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--ink); display: flex; justify-content: space-between; align-items: center; color: var(--ink-2); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
footer.app-footer .fin { font-family: 'Instrument Serif', serif; font-style: italic; }

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
                <div className="date">
                  {new Date()
                    .toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
                    .toUpperCase()}
                </div>
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
              <SectionHead num="01" title="Provide a gel image" subtitle="JPEG or PNG (TIFF support paused)" />
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
                  accept="image/*"
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
                  ["02", "Crop, then place by hand", "rotate first if lanes are tilted, draw the crop region, then add lanes (buttons or double-click). Nothing is auto-placed."],
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
                              domain={["auto", "auto"]}
                              tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }}
                              stroke="var(--ink)"
                              tickFormatter={(v) => v >= 100 || v < 0.01 ? v.toExponential(0) : v}
                              label={{
                                value: `[Protein] (${concUnit})`,
                                position: "insideBottom",
                                offset: -22,
                                style: { fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 14, fill: "var(--ink)" },
                              }}
                            />
                            <YAxis
                              domain={[0, "auto"]}
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
                              labelFormatter={(v) => `[P] = ${Number.isFinite(v) ? v.toPrecision(3) : v} ${concUnit}`}
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
                        {" · "}Nelder–Mead fit · log X · zero-protein control excluded from plot, included in fit
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          <footer className="app-footer">
            <span>BOUND &amp; FREE — a binding-curve workbench</span>
            <span className="fin">fin.</span>
          </footer>
        </div>
      </div>
    </>
  );
}

// ---- standalone mount (added for static/Cloudflare deploy; not part of the component) ----
createRoot(document.getElementById("root")).render(<App />);
