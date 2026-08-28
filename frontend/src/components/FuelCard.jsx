import { Link } from "react-router-dom";
import { Droplets, Gauge, Waypoints } from "lucide-react";
import { brl } from "../utils/format.js";

function rate(value, suffix) {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;
}

export default function FuelCard({ consumo, alwaysShow = false, to }) {
  const data = consumo || {};
  if (!Number(data.abastecimentos) && !alwaysShow) return null;

  const temLitros = Number(data.litros) > 0;
  const temKmL = data.km_per_liter != null;
  const temRsKm = data.rs_per_km != null;
  const inner = (
    <>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
          Consumo de combustível
        </p>
        <p className="mt-1 text-sm text-emerald-100/70">
          {Number(data.abastecimentos) || 0} abastecimento
          {Number(data.abastecimentos) === 1 ? "" : "s"} no mês
          {temLitros ? ` · ${rate(data.litros, " L")}` : ""}
          {to ? " · toque para lançar" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={Gauge}
          label="km / litro"
          value={rate(data.km_per_liter, " km/l")}
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
          value={data.rs_per_km != null ? `${brl(data.rs_per_km)}/km` : "—"}
          hint={temRsKm ? "Gasto com combustível ÷ km" : "Falta km ou litros"}
        />
      </div>

      <div className="rounded-2xl bg-white/5 p-3">
        <p className="inline-flex items-center gap-1.5 text-xs text-emerald-100/70">
          <Droplets size={14} /> Gasto no posto
        </p>
        <p className="mt-1 font-display text-lg font-bold">{brl(data.gasto)}</p>
        <p className="mt-0.5 text-[11px] text-emerald-100/50">
          {data.price_per_liter != null
            ? `Média ${brl(data.price_per_liter)}/L`
            : "Informe os litros para ver o preço médio do litro"}
        </p>
      </div>
    </>
  );

  if (to) {
    return (
      <Link to={to} className="card block space-y-3">
        {inner}
      </Link>
    );
  }

  return <section className="card space-y-3">{inner}</section>;
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
