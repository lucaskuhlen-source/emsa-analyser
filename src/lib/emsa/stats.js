// Replicate statistics for the Triplicate tab: aggregate independent binding-curve
// fits of the SAME interaction into one Kd with a cross-replicate confidence interval.
// Kd is treated as log-normal (geometric mean, CI built in log space); reproducibility
// is reported as an arithmetic %CV. See TriplicateApp for how these feed the UI.

// two-sided 95% t, indexed by degrees of freedom (n-1). n=3 -> df=2 -> 4.303.
export const T95 = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
  7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179,
};
export const tVal = (n) => T95[n - 1] ?? 1.96;

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export const sampSD = (a, m) => Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));

// Normalised 0->1 Hill shape (shared by the aggregate curve in the chart).
export const shapeHill = (x, K, n) => Math.pow(x, n) / (Math.pow(K, n) + Math.pow(x, n));

// Aggregate across replicate fits. Kd is treated as log-normal (geometric mean,
// CI built in log space); reproducibility reported as arithmetic %CV.
export function aggregate(reps) {
  const kds = reps.map((r) => r.fit.Kd).filter((k) => Number.isFinite(k) && k > 0);
  const n = kds.length;
  if (n < 1) return null;
  const arithKd = mean(kds);
  const kdMin = Math.min(...kds), kdMax = Math.max(...kds);
  const logs = kds.map(Math.log);
  const meanLn = mean(logs);
  const geoKd = Math.exp(meanLn);
  let ciLo = null, ciHi = null, cvPct = null;
  if (n >= 2) {
    const sdLn = sampSD(logs, meanLn);
    const semLn = sdLn / Math.sqrt(n);
    const t = tVal(n);
    ciLo = Math.exp(meanLn - t * semLn);
    ciHi = Math.exp(meanLn + t * semLn);
    const sdArith = sampSD(kds, arithKd);
    cvPct = 100 * sdArith / arithKd;
  }
  const ns = reps.map((r) => r.fit.n).filter(Number.isFinite);
  const nMean = ns.length ? mean(ns) : 1;
  const nSD = ns.length >= 2 ? sampSD(ns, nMean) : 0;
  return { n, geoKd, arithKd, ciLo, ciHi, cvPct, kdMin, kdMax, nMean, nSD };
}

// Do the replicates share a concentration grid? If so, return per-point
// normalised mean +/- SEM (across replicates). Tolerance is relative (2%).
export function sharedGrid(reps) {
  if (reps.length < 2) return { matched: false };
  const sorted = reps.map((r) => r.xs.map((x, i) => [x, r.ys[i]])
    .filter(([x, y]) => x > 0 && Number.isFinite(y))
    .sort((a, b) => a[0] - b[0]));
  const len = sorted[0].length;
  if (!sorted.every((p) => p.length === len) || len === 0) return { matched: false };
  const grid = sorted[0].map((p) => p[0]);
  const tol = 0.02;
  for (const p of sorted)
    for (let i = 0; i < len; i++) {
      const rel = Math.abs(p[i][0] - grid[i]) / Math.max(grid[i], 1e-9);
      if (rel > tol) return { matched: false };
    }
  const norm = (r, y) => {
    const span = r.fit.Bmax - r.fit.bottom;
    return span > 1e-9 ? (y - r.fit.bottom) / span : y;
  };
  const meanPts = grid.map((x, i) => {
    const ysN = reps.map((r, ri) => norm(r, sorted[ri][i][1]));
    const m = mean(ysN);
    const sd = sampSD(ysN, m);
    const sem = sd / Math.sqrt(ysN.length);
    return { x, mean: m, sem, n: ysN.length };
  });
  return { matched: true, grid, meanPts };
}
