import { ComposedChart, ResponsiveContainer, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Line } from 'recharts';

export function QCPlot({ data }) {
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
