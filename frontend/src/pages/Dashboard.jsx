import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import GoalBanner from "../components/GoalBanner.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, km, pct } from "../utils/format.js";

export default function Dashboard() {
  const { year, month } = useMonth();
  const [data, setData] = useState(null);
  const [uber, setUber] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    api
      .dashboard(year, month)
      .then(setData)
      .catch((err) => setError(err.message));
    api.uber.status().then(setUber).catch(() => setUber(null));
  }, [year, month]);

  if (error) {
    return <p className="card text-sm text-rose-300">{error}</p>;
  }
  if (!data) {
    return <p className="pt-10 text-center text-emerald-100/60">Carregando painel...</p>;
  }

  const { realizado, progresso, metas, hoje } = data;
  const lucroPositivo = realizado.lucro_liquido >= 0;

  return (
    <div className="space-y-4">
      <Link
        to="/uber"
        className={`card block ${uber?.connected ? "border-lime/30" : "border-lime/50 bg-lime/5"}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-lime">Conta Uber</p>
        <p className="mt-1 font-display text-lg font-bold">
          {uber?.connected ? "Uber conectada ✅" : "Vincular conta Uber"}
        </p>
        <p className="mt-1 text-sm text-emerald-100/70">
          {uber?.connected
            ? uber.driver_name || "Toque para ver o status da conexão."
            : "Toque aqui para autorizar sua conta de motorista."}
        </p>
      </Link>

      <section className="card bg-gradient-to-br from-night-700 to-night-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
          Lucro líquido real
        </p>
        <p className={`mt-1 font-display text-4xl font-bold ${lucroPositivo ? "text-lime" : "text-rose-300"}`}>
          {brl(realizado.lucro_liquido)}
        </p>
        <p className="mt-2 text-sm text-emerald-100/70">
          {brl(realizado.faturamento_uber)} faturados − {brl(realizado.gastos_totais)} em gastos
        </p>
      </section>

      <GoalBanner
        ganho={hoje.ganho}
        meta={hoje.meta_diaria}
        faltam={hoje.faltam}
        atingida={hoje.atingida}
        progresso={hoje.progresso_pct}
      />

      <div className="grid grid-cols-2 gap-3">
        <Metric label="Faturamento" value={brl(realizado.faturamento_uber)} />
        <Metric label="Gastos totais" value={brl(realizado.gastos_totais)} />
        <Metric label="Km rodados" value={km(realizado.km_total)} />
        <Metric label="Dias na rua" value={`${realizado.dias_com_ganho} / ${metas.dias_trabalhados_mes}`} />
      </div>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">Meta mensal de faturamento</h2>
          <span className="text-sm font-bold text-lime">{pct(progresso.meta_mensal_pct)}</span>
        </div>
        <ProgressBar value={progresso.meta_mensal_pct} />
        <p className="text-sm text-emerald-100/70">
          {brl(realizado.faturamento_uber)} de {brl(metas.meta_bruta_mensal)}
        </p>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">Contas do mês</h2>
          <span className="text-sm font-bold">{pct(progresso.pagamentos_pct)}</span>
        </div>
        <ProgressBar
          value={progresso.pagamentos_pct}
          tone={progresso.pagamentos_pct >= 100 ? "lime" : "amber"}
        />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-lime/10 p-3">
            <p className="text-emerald-100/70">Pagas</p>
            <p className="font-bold text-lime">
              {progresso.contas_pagas} · {brl(progresso.valor_pago)}
            </p>
          </div>
          <div className="rounded-2xl bg-amber-400/10 p-3">
            <p className="text-emerald-100/70">Pendentes</p>
            <p className="font-bold text-amber-300">
              {progresso.contas_pendentes} · {brl(progresso.valor_pendente)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <MiniCard title="Meta diária" value={brl(metas.meta_bruta_diaria)} to="/metas" />
        <MiniCard title="Custo fixo/dia" value={brl(metas.custo_fixo_diario)} to="/gastos" />
      </section>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="card">
      <p className="text-xs text-emerald-200/70">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}

function MiniCard({ title, value, to }) {
  return (
    <Link to={to} className="card block">
      <p className="text-xs text-emerald-200/70">{title}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </Link>
  );
}
