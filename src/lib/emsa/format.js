export const fmt = (x, d = 3) => {
  if (!Number.isFinite(x)) return "—";
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) return x.toExponential(d);
  return x.toFixed(d);
};

export const PALETTE = ["#b91c1c", "#2b6cb0", "#15803d", "#8e44ad", "#d68910", "#16a3a3", "#7d5a3c", "#c2387a"];
export const nameFromFile = (fn) => {
  const m = fn.replace(/\.csv$/i, "").match(/_([A-Za-z0-9]+)$/);
  return m ? m[1] : fn.replace(/\.csv$/i, "");
};
export const fmtKd = (k) => (k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2));
export const legendLabel = (c) => {
  const ci = c.kdLo != null && c.kdHi != null ? ` (${fmtKd(c.kdLo)}\u2013${fmtKd(c.kdHi)})` : "";
  return `${c.name}  (Kd ${fmtKd(c.fit.Kd)} nM${ci})`;
};
export const byKd = (arr) => [...arr].sort((a, b) => a.fit.Kd - b.fit.Kd);
