import { useEffect, useState } from "react";
import { api } from "../api.js";
import ProgressBar from "../components/ProgressBar.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl } from "../utils/format.js";

export default function Metas() {
  const { year, month } = useMonth();
  const [config, setConfig] = useState({
    monthly_net_profit: "",
    monthly_contingency: "",
  });
  const [calc, setCalc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [cfg, metas] = await Promise.all([api.metas.config(), api.metas.calculo(year, month)]);
    setConfig({
      monthly_net_profit: String(cfg.monthly_net_profit || ""),
      monthly_contingency: String(cfg.monthly_contingency || ""),
    });
    setCalc(metas);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [year, month]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await api.metas.saveConfig({
        monthly_net_profit: Number(config.monthly_net_profit || 0),
        monthly_contingency: Number(config.monthly_contingency || 0),
      });
      await load();
      setMessage("Metas atualizadas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-display font-semibold">O que você precisa no mês</h2>
        <div>
          <label className="label">Meta de lucro líquido</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="field"
            placeholder="Ex.: 4000"
            value={config.monthly_net_profit}
            onChange={(e) => setConfig({ ...config, monthly_net_profit: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Reserva de imprevistos</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="field"
            placeholder="Manutenção, pneu, óleo"
            value={config.monthly_contingency}
            onChange={(e) => setConfig({ ...config, monthly_contingency: e.target.value })}
          />
        </div>
        <button className="btn-primary" disabled={saving}>
          {saving ? "Calculando..." : "Recalcular metas"}
        </button>
        {message && <p className="text-sm text-lime">{message}</p>}
      </form>

      {calc && (
        <>
          <section className="card space-y-3">
            <p className="text-xs text-emerald-200/70">Fórmula</p>
            <p className="text-sm leading-relaxed text-emerald-50/90">
              Gastos fixos ({brl(calc.gastos_fixos_mensal)}) + lucro líquido ({brl(calc.lucro_liquido_alvo)}) +
              reserva ({brl(calc.reserva_imprevistos)}) = {brl(calc.total_necessario)}.
              Esse total é dividido por {calc.dias_trabalhados_mes} dias trabalhados no mês.
            </p>
            <ProgressBar value={100} />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <GoalCard title="Bruto mensal" value={brl(calc.meta_bruta_mensal)} highlight />
            <GoalCard title="Bruto semanal" value={brl(calc.meta_bruta_semanal)} />
            <GoalCard title="Bruto diário" value={brl(calc.meta_bruta_diaria)} highlight />
            <GoalCard title="Por hora" value={brl(calc.meta_por_hora)} />
          </div>

          <section className="card">
            <p className="text-xs text-emerald-200/70">Custo fixo por dia rodado</p>
            <p className="font-display text-2xl font-bold">{brl(calc.custo_fixo_diario)}</p>
            <p className="mt-1 text-sm text-emerald-100/70">
              Valor mínimo só para cobrir a estrutura, sem lucro nem reserva.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function GoalCard({ title, value, highlight }) {
  return (
    <article className={`card ${highlight ? "border-lime/40 shadow-glow" : ""}`}>
      <p className="text-xs text-emerald-200/70">{title}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </article>
  );
}
