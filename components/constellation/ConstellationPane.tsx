/**
 * Contextual constellation pane (SPEC.md §25G).
 * With no objects, show an empty astrolabe-like scaffold and no fake nodes.
 */
export function ConstellationPane() {
  const cx = 200;
  const cy = 200;
  const r = 180;
  const spokes = Array.from({ length: 12 }, (_, i) => {
    const angle = ((-90 + i * 30) * Math.PI) / 180;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  return (
    <aside className="constellation" aria-label="Constellation">
      <h2 className="constellation__title">Constellation</h2>
      <svg
        className="constellation__svg"
        viewBox="0 0 400 400"
        role="img"
        aria-label="Empty constellation."
      >
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" />
        <circle cx={cx} cy={cy} r={r / 2} fill="none" stroke="var(--border)" strokeDasharray="2 4" />
        {spokes.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--border)" strokeOpacity={0.5} />
        ))}
        <circle cx={cx} cy={cy} r={4} fill="var(--muted)" />
      </svg>
    </aside>
  );
}
