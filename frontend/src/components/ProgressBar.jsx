export default function ProgressBar({ value, tone = "lime" }) {
  const width = Math.min(Math.max(Number(value) || 0, 0), 100);
  const colors = {
    lime: "bg-lime",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
  };

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colors[tone]}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
