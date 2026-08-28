import { Droplets, Gauge, Waypoints } from "lucide-react";
import { brl } from "../utils/format.js";

function rate(value, suffix) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

export default function FuelCard({ consumo }) {
  if (!consumo || !Number(consumo.abastecimentos)) return null;

  const temLitros = Number(consumo.litros) > 0;
  const temKmL = consumo.km_per_liter != null;
  const temRsKm = consumo.rs_per_km != null;

  return (
    <section className="card space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
          Consumo de combustível
        </p>
        <p className="mt-1 text-sm text-emerald-100/70">
          {consumo.abastecimentos} abastecimento{consumo.abastecimentos === 1 ? "" : "s"} no mês
          {temLitros ? ` · ${rate(consumo.litros, " L")}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={Gauge}
          label="km / litro"
          value={rate(consumo.km_per_liter, " km/l")}
          hint={
            temKmL
              ? "Km dos ganhos ÷ litros lançados"
              : temLitros
                ? "Lance os km nos ganhos"
                : "Informe os litros no abastecimento"
          }
        />
        <Metric
          icon={Waypoints}
          label="R$ / km"
          value={consumo.rs_per_km != null ? `${brl(consumo.rs_per_km)}/km` : "—"}
          hint={temRsKm ? "Gasto com combustível ÷ km" : "Falta km ou litros"}
        />
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-emerald-100/70">
          <Droplets size={14} /> Gasto no posto
        </p>
        <p className="mt-1 font-display text-lg font-bold">{brl(consumo.gasto)}</p>
        <p className="mt-0.5 text-[11px] text-emerald-100/50">
          {consumo.price_per_liter != null
            ? `Média ${brl(consumo.price_per_liter)}/L`
            : "Informe os litros para ver o preço médio do litro"}
        </p>
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
