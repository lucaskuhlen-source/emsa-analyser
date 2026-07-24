import { loadImage } from './imageIO';

export function bilinear(sig, W, H, x, y) {
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
export async function buildWorkBuffer(baseSignal, origDisplaySrc, deg, cropRect = null) {
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

export function findGelROI(sig, W, H) {
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

export function columnProfile(sig, W, roi) {
  const prof = new Float32Array(roi.w);
  for (let dx = 0; dx < roi.w; dx++) {
    let s = 0;
    const x = roi.x + dx;
    for (let dy = 0; dy < roi.h; dy++) s += sig[(roi.y + dy) * W + x];
    prof[dx] = s / roi.h;
  }
  return prof;
}

export function smooth(arr, w) {
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

export function findPeaks(arr, { minProminence = 0.02, minDist = 5 } = {}) {
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
export function laneProfile(sig, W, roi, x1, x2, isExcluded) {
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
export function alsBaseline(y, lambda, p, niter = 10) {
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
export function integrateBox(rowSum, counts, baseline, roiY, yTop, yBot) {
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
export function parabErode1D(f, n, c, out, v, z) {
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
export function parabOpenLine(line, n, c, e, neg, v, z) {
  parabErode1D(line, n, c, e, v, z);        // erosion → e
  for (let i = 0; i < n; i++) neg[i] = -e[i];
  parabErode1D(neg, n, c, line, v, z);      // erosion of −e → line
  for (let i = 0; i < n; i++) line[i] = -line[i]; // dilation = −erode(−e); line ← opening
}

// Returns the rolling-ball background as a Float32Array (same layout as sig). radius in px.
export function rollingBallBackground(sig, W, H, radius) {
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
