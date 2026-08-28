import { Gauge, Timer, Waypoints } from "lucide-react";
import { brl } from "../utils/format.js";

const BADGES = {
  excelente: {
    label: "Excelente",
    className: "bg-lime/15 text-lime",
  },
  media: {
    label: "Na média",
    className: "bg-amber-400/15 text-amber-300",
  },
  abaixo: {
    label: "Abaixo do ideal",
    className: "bg-rose-400/15 text-rose-300",
  },
};

function rate(value, suffix) {
  if (value === null || value === undefined) return "—";
  return `${brl(value)}${suffix}`;
}

export default function EfficiencyCard({ eficiencia, titulo = "Eficiência do mês" }) {
  if (!eficiencia) return null;

  const badge = BADGES[eficiencia.badge];
  const temHoras = Number(eficiencia.horas_total) > 0;
  const temKm = eficiencia.rs_por_km !== null && eficiencia.rs_por_km !== undefined;
  const pct = eficiencia.comparacao_hora_pct;
  const barTone =
    eficiencia.badge === "excelente" ? "lime" : eficiencia.badge === "media" ? "amber" : "rose";

  return (
    <section className="card space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
            {titulo}
          </p>
          <p className="mt-1 text-sm text-emerald-100/70">
            Rendimento real comparado com a meta por hora da rotina.
          </p>
        </div>
        {badge && (
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={Waypoints}
          label="R$ / km"
          value={rate(eficiencia.rs_por_km, "/km")}
          hint={temKm ? "Faturamento ÷ km rodados" : "Lance km no turno"}
        />
        <Metric
          icon={Timer}
          label="R$ / hora"
          value={rate(eficiencia.rs_por_hora, "/h")}
          hint={temHoras ? "Faturamento ÷ horas lançadas" : "Lance as horas do turno"}
        />
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-emerald-100/70">
            <Gauge size={14} /> Meta por hora
          </p>
          <p className="text-sm font-bold">{brl(eficiencia.meta_por_hora)}/h</p>
        </div>
        {pct !== null && pct !== undefined ? (
          <>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  barTone === "lime"
                    ? "bg-lime"
                    : barTone === "amber"
                      ? "bg-amber-400"
                      : "bg-rose-400"
                }`}
                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-emerald-100/70">
              {pct >= 100
                ? `Você está ${Math.round(pct)}% da meta por hora.`
                : `Faltam ${Math.round(100 - Math.min(pct, 100))}% para a meta por hora.`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-xs text-emerald-100/60">
            Informe horas nos ganhos para comparar com a meta.
          </p>
        )}
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="inline-flex items-center gap-1.5 text-[11px] text-emerald-100/60">
        <Icon size={13} /> {label}
      </p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
      <p className="mt-0.5 text-[11px] text-emerald-100/50">{hint}</p>
    </div>
  );
}
