import { todayISO } from "../utils/format.js";

const HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildCells(year, month, byDate) {
  const first = new Date(year, month - 1, 1);
  const blanks = first.getDay();
  const total = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: blanks }, () => null);

  for (let day = 1; day <= total; day++) {
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      day,
      iso,
      temGanho: Boolean(byDate[iso]?.tem_ganho),
      temGasto: Boolean(byDate[iso]?.tem_gasto),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function HistoryCalendar({ year, month, days, selected, onSelect }) {
  const today = todayISO();
  const byDate = Object.fromEntries((days || []).map((item) => [item.date, item]));
  const cells = buildCells(year, month, byDate);

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
              onClick={() => onSelect(cell.iso)}
              className={`relative flex h-11 flex-col items-center justify-center rounded-2xl text-sm font-bold transition active:scale-95 ${
                selected === cell.iso
                  ? "bg-lime text-night-950 shadow-glow"
                  : "bg-white/5 text-emerald-100/80"
              } ${cell.iso === today && selected !== cell.iso ? "ring-2 ring-white/70" : ""}`}
            >
              {cell.day}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {cell.temGanho && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected === cell.iso ? "bg-night-950" : "bg-lime"
                    }`}
                  />
                )}
                {cell.temGasto && (
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      selected === cell.iso ? "bg-night-950/70" : "bg-amber-300"
                    }`}
                  />
                )}
              </span>
            </button>
          ) : (
            <span key={`empty-${index}`} className="h-11" />
          )
        )}
      </div>
    </div>
  );
}
