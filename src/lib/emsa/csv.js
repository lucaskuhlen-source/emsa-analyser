export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/);
  const rows = [];
  let header = null, kdLo = null, kdHi = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      const c = line.replace(/^#\s*/, "").split(",");
      const key = (c[0] || "").trim().toLowerCase();
      if (key === "kd_ci95_low") kdLo = parseFloat(c[1]);
      else if (key === "kd_ci95_high") kdHi = parseFloat(c[1]);
      continue;
    }
    if (!line) continue;
    const cols = line.split(",");
    if (!header) { header = cols.map((c) => c.trim().toLowerCase()); continue; }
    const rec = {};
    header.forEach((h, i) => { rec[h] = cols[i]; });
    rows.push(rec);
  }
  if (!header) return null;
  const xKey = header.find((h) => h.includes("protein") || h.includes("conc") || h.includes("nm"));
  const yKey = header.find((h) => h.includes("fraction"));
  if (!xKey || !yKey) return null;
  const xs = [], ys = [];
  for (const r of rows) {
    const x = parseFloat(r[xKey]);
    const y = parseFloat(r[yKey]);
    if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 3) return null;
  return { xs, ys, kdLo: Number.isFinite(kdLo) ? kdLo : null, kdHi: Number.isFinite(kdHi) ? kdHi : null };
}
