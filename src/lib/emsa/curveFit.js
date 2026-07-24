export function nelderMead(f, x0, opts = {}) {
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

export function fitBinding(xs, ys, { model: modelKind = "hill", D = null, maxIter = 1600 } = {}) {
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
export function bootstrapKd(xs, ys, opts, nBoot = 800) {
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
