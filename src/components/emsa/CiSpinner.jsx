export function CiSpinner() {
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
