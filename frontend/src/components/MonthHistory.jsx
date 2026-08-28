import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "../api.js";
import { brl, formatDate, km, monthLabel, todayISO } from "../utils/format.js";
import HistoryCalendar from "./HistoryCalendar.jsx";

export default function MonthHistory({ year, month, onClose }) {
  const [days, setDays] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(todayISO());

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .historico(year, month)
      .then((data) => {
        setDays(data.dias || []);
        const inMonth = (data.dias || []).some((item) => item.date === todayISO());
        setSelected(inMonth ? todayISO() : `${year}-${String(month).padStart(2, "0")}-01`);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [year, month]);

  const day = useMemo(
    () => days.find((item) => item.date === selected) || null,
    [days, selected]
  );

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night-950/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center">
      <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-night-900">
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
              Histórico
            </p>
            <h2 className="font-display text-xl font-bold capitalize">{monthLabel(year, month)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-emerald-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 pb-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-emerald-100/60">Carregando calendário...</p>
          ) : error ? (
            <p className="card text-sm text-rose-300">{error}</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-emerald-100/60">
                Toque em um dia para ver ganhos e gastos. Ponto verde = ganho, amarelo = gasto.
              </p>
              <HistoryCalendar
                year={year}
                month={month}
                days={days}
                selected={selected}
                onSelect={setSelected}
              />

              {day && (
                <section className="card mt-4 space-y-3">
                  <h3 className="font-display font-semibold">{formatDate(day.date)}</h3>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <Mini label="Ganhos" value={brl(day.ganhos)} tone="text-lime" />
                    <Mini label="Gastos" value={brl(day.gastos)} tone="text-amber-300" />
                    <Mini
                      label="Saldo"
                      value={brl(day.lucro)}
                      tone={day.lucro >= 0 ? "text-lime" : "text-rose-300"}
                    />
                  </div>
                  {day.km > 0 && (
                    <p className="text-xs text-emerald-100/60">{km(day.km)} rodados</p>
                  )}
                  {day.lancamentos.length === 0 ? (
                    <p className="text-sm text-emerald-100/60">Nenhum lançamento neste dia.</p>
                  ) : (
                    <ul className="space-y-2">
                      {day.lancamentos.map((item, index) => (
                        <li
                          key={`${item.kind}-${index}`}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <span className="text-emerald-100/80">{item.title}</span>
                          <span
                            className={item.kind === "ganho" ? "font-bold text-lime" : "font-bold text-amber-300"}
                          >
                            {item.kind === "ganho" ? "+" : "−"} {brl(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white/5 p-2">
      <p className="text-[10px] uppercase tracking-wide text-emerald-200/60">{label}</p>
      <p className={`mt-1 text-xs font-bold ${tone}`}>{value}</p>
    </div>
  );
}
