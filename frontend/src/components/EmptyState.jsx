export default function EmptyState({ title, text }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 px-4 py-8 text-center">
      <p className="font-display font-semibold">{title}</p>
      <p className="mt-1 text-sm text-emerald-100/60">{text}</p>
    </div>
  );
}
