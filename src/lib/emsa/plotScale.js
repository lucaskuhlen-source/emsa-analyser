// Log-X window for the binding isotherm, shared by the on-screen chart and the PNG export.
//
// Two things this has to get right:
//
//  1. The no-protein control. [P] = 0 has no place on a log axis, so it is drawn at a
//     pseudo-x one data-step left of the smallest real concentration and that tick is
//     labelled "0" (Prism's convention). The anchor is derived from the DATA SPACING, not
//     from where the fitted curve crosses some threshold — a curve-derived anchor moves with
//     Kd and can land to the RIGHT of the lowest real points, scrambling the left edge.
//     Deriving it from the spacing makes pseudoX < min([P]) true by construction.
//
//  2. No dead space. Concentrations can't be negative, so empty decades to the left of the
//     titration are wasted plot area.
//
// Returns log10 bounds { lo, hi } plus the pseudo-zero anchor (null when there is no
// zero-protein control), or null if there are no positive concentrations to plot.
export function logXWindow(xs, hasZero) {
  const pos = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (pos.length === 0) return null;
  const minPos = pos[0], maxPos = pos[pos.length - 1];

  // Typical spacing of the titration in log space (a 2-fold series ≈ 0.30 decades). Median,
  // so one irregular step in an otherwise even series doesn't drag the anchor around.
  const gaps = [];
  for (let i = 1; i < pos.length; i++) {
    const g = Math.log10(pos[i] / pos[i - 1]);
    if (g > 1e-6) gaps.push(g);
  }
  gaps.sort((a, b) => a - b);
  const step = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0.3;

  // Clamp: far enough out to read as a separate "0" tick, never a whole empty decade.
  const pseudoX = hasZero ? minPos / Math.pow(10, Math.min(0.55, Math.max(0.22, step))) : null;
  const lo = Math.log10(pseudoX ?? minPos) - (hasZero ? 0.06 : 0.14); // a little air at each end
  const hi = Math.log10(maxPos) + 0.14;
  return { lo, hi, pseudoX, minPos, maxPos };
}

// Tick positions inside the window. Narrow titrations get 1-2-5 subdivisions so a sub-decade
// range isn't left with a single (or no) labelled tick. The pseudo-zero owns the left edge:
// any decade tick that would crowd it is dropped.
export function logXTicks({ lo, hi, pseudoX }) {
  const decades = hi - lo;
  const mults = decades > 2.2 ? [1] : decades > 1.1 ? [1, 3] : [1, 2, 5];
  const ticks = [];
  for (let k = Math.floor(lo); k <= Math.ceil(hi); k++) {
    for (const m of mults) {
      const t = m * Math.pow(10, k);
      const lt = Math.log10(t);
      if (lt < lo || lt > hi) continue;
      if (pseudoX && t <= pseudoX * 1.08) continue;
      ticks.push(t);
    }
  }
  ticks.sort((a, b) => a - b);
  return pseudoX ? [pseudoX, ...ticks] : ticks;
}
