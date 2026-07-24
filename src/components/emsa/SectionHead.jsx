export function SectionHead({ num, title, subtitle }) {
  return (
    <div className="section-head">
      <span className="section-num">§{num}</span>
      <h3 className="section-title">{title}</h3>
      {subtitle && <span className="section-sub">— {subtitle}</span>}
    </div>
  );
}
