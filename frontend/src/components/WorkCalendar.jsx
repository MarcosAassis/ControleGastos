import { todayISO } from "../utils/format.js";

const HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildCells(year, month, workingDates) {
  const working = new Set(workingDates);
  const first = new Date(year, month - 1, 1);
  const blanks = first.getDay();
  const total = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: blanks }, () => null);

  for (let day = 1; day <= total; day++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      iso,
      working: working.has(iso),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function WorkCalendar({ year, month, workingDates, overrides = {}, onToggle }) {
  const today = todayISO();
  const cells = buildCells(year, month, workingDates);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-200/50">
        {HEADERS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onToggle(cell.iso)}
              className={`relative flex h-11 items-center justify-center rounded-2xl text-sm font-bold transition active:scale-95 ${
                cell.working
                  ? "bg-lime text-night-950 shadow-glow"
                  : "bg-white/5 text-emerald-100/70"
              } ${cell.iso === today ? "ring-2 ring-white/70" : ""}`}
            >
              {cell.day}
              {overrides[cell.iso] !== undefined && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current opacity-70" />
              )}
            </button>
          ) : (
            <span key={`empty-${index}`} className="h-11" />
          )
        )}
      </div>
    </div>
  );
}
