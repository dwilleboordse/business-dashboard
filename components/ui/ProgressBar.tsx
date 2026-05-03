export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const color =
    clamped >= 0.66 ? "bg-good" :
    clamped >= 0.33 ? "bg-warn" : "bg-bad";
  return (
    <div className="w-full h-2 bg-panel2 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function StatusDot({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  const color =
    clamped >= 0.66 ? "bg-good" :
    clamped >= 0.33 ? "bg-warn" : "bg-bad";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}
