import { useEffect, useState } from "react";
import WorkCalendar from "../components/WorkCalendar.jsx";
import { api } from "../api.js";
import { useMonth } from "../context/MonthContext.jsx";
import { brl } from "../utils/format.js";

const WEEKDAYS = [
  { id: 0, label: "Seg" },
  { id: 1, label: "Ter" },
  { id: 2, label: "Qua" },
  { id: 3, label: "Qui" },
  { id: 4, label: "Sex" },
  { id: 5, label: "Sáb" },
  { id: 6, label: "Dom" },
];

export default function Rotina() {
  const { year, month } = useMonth();
  const [rotina, setRotina] = useState(null);
  const [hours, setHours] = useState(8);
  const [calc, setCalc] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async (data) => {
    const current = data || (await api.rotina.get(year, month));
    setRotina(current);
    setHours(current.hours_per_day);
    const metas = await api.metas.calculo(year, month);
    setCalc(metas);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [year, month]);

  const saveWeekdays = async (weekdays) => {
    setSaving(true);
    try {
      const saved = await api.rotina.save(
        { weekdays, hours_per_day: hours },
        year,
        month
      );
      await load(saved);
    } catch {
      /* toast global */
    } finally {
      setSaving(false);
    }
  };

  const toggleWeekday = (id) => {
    if (!rotina) return;
    const selected = rotina.weekdays.includes(id)
      ? rotina.weekdays.filter((day) => day !== id)
      : [...rotina.weekdays, id].sort((a, b) => a - b);
    saveWeekdays(selected);
  };

  const toggleDay = async (iso) => {
    setSaving(true);
    try {
      const saved = await api.rotina.toggleDia(iso);
      await load(saved);
    } catch {
      /* toast global */
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    if (!rotina) return;
    setSaving(true);
    try {
      const saved = await api.rotina.save(
        { weekdays: rotina.weekdays, hours_per_day: Number(hours) },
        year,
        month
      );
      await load(saved);
    } catch {
      /* toast global */
    } finally {
      setSaving(false);
    }
  };

  if (!rotina) {
    return <p className="pt-10 text-center text-emerald-100/60">Carregando rotina...</p>;
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Dias que você roda</h2>
          <p className="mt-1 text-sm text-emerald-100/70">
            Marque os dias da semana. Eles aparecem no calendário. Toque em um dia para
            incluir ou tirar só aquele.
          </p>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((item) => {
            const active = rotina.weekdays.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleWeekday(item.id)}
                className={`rounded-2xl py-2.5 text-xs font-bold ${
                  active ? "bg-lime text-night-950" : "bg-white/5 text-emerald-100/60"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <WorkCalendar
          year={year}
          month={month}
          workingDates={rotina.working_dates}
          overrides={rotina.overrides}
          onToggle={toggleDay}
        />

        <div className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-2 text-sm">
          <span className="text-emerald-100/70">Dias neste mês</span>
          <span className="font-bold text-lime">
            {rotina.days_per_month} · {rotina.days_per_week} por semana
          </span>
        </div>
        {saving && <p className="text-xs text-emerald-100/50">Atualizando calendário...</p>}
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold">Horas por dia</label>
          <span className="rounded-full bg-lime/15 px-3 py-1 text-sm font-bold text-lime">
            {hours} h
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={16}
          step={0.5}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          onMouseUp={saveHours}
          onTouchEnd={saveHours}
          className="w-full accent-lime"
        />
      </section>

      {calc && (
        <section className="card space-y-3">
          <h3 className="font-display font-semibold">Impacto nas metas</h3>
          <Row label="Meta bruta mensal" value={brl(calc.meta_bruta_mensal)} />
          <Row label="Meta bruta semanal" value={brl(calc.meta_bruta_semanal)} />
          <Row
            label={
              calc.marco?.cobrando
                ? "Meta diária até o prazo"
                : calc.marco?.recalculando_mes
                  ? "Meta diária do mês (recalculada)"
                  : "Meta bruta diária"
            }
            value={brl(calc.meta_bruta_diaria)}
          />
          <Row label="Meta por hora" value={brl(calc.meta_por_hora)} />
          <Row label="Custo fixo diário" value={brl(calc.custo_fixo_diario)} />
          {Number(calc.provisao_descanso) > 0 && (
            <Row label="Provisão 13º/férias" value={brl(calc.provisao_descanso)} />
          )}
          {Number(calc.folgas_aplicadas) > 0 && (
            <Row
              label="Dias após folgas"
              value={`${calc.dias_trabalhados_mes} (${calc.dias_calendario} − ${calc.folgas_aplicadas})`}
            />
          )}
        </section>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-emerald-100/70">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
