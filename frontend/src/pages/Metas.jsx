import { useEffect, useState } from "react";
import { api } from "../api.js";
import ProgressBar from "../components/ProgressBar.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, monthLabel } from "../utils/format.js";

export default function Metas() {
  const { year, month } = useMonth();
  const [config, setConfig] = useState({
    monthly_net_profit: "",
    monthly_contingency: "",
  });
  const [isCustom, setIsCustom] = useState(false);
  const [calc, setCalc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const [cfg, metas] = await Promise.all([
      api.metas.config(year, month),
      api.metas.calculo(year, month),
    ]);
    setConfig({
      monthly_net_profit: String(cfg.monthly_net_profit || ""),
      monthly_contingency: String(cfg.monthly_contingency || ""),
    });
    setIsCustom(Boolean(cfg.is_custom));
    setCalc(metas);
  };

  useEffect(() => {
    setMessage("");
    load().catch(console.error);
  }, [year, month]);

  const handleSave = async (saveAsDefault = false) => {
    setSaving(true);
    setMessage("");
    try {
      await api.metas.saveConfig(
        {
          monthly_net_profit: Number(config.monthly_net_profit || 0),
          monthly_contingency: Number(config.monthly_contingency || 0),
          year,
          month,
          save_as_default: saveAsDefault,
        },
        year,
        month
      );
      await load();
      setMessage(
        saveAsDefault
          ? "Meta padrão atualizada para todos os meses."
          : `Metas de ${monthLabel(year, month)} salvas com sucesso.`
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage("");
    try {
      await api.metas.resetConfig(year, month);
      await load();
      setMessage(`Meta padrão restaurada para ${monthLabel(year, month)}.`);
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    handleSave(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-semibold">
            Metas de {monthLabel(year, month)}
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isCustom
                ? "border border-lime/30 bg-lime/20 text-lime"
                : "bg-white/10 text-emerald-200/80"
            }`}
          >
            {isCustom ? "✨ Meta exclusiva deste mês" : "⚙️ Meta padrão global"}
          </span>
        </div>

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

        <div className="flex flex-col gap-2.5 pt-1">
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? "Calculando..." : `Salvar metas para ${monthLabel(year, month)}`}
          </button>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleSave(true)}
              className="btn-ghost px-3 py-2 text-xs hover:border-lime/40"
              disabled={saving}
              title="Aplica este valor como padrão para todos os meses"
            >
              Definir como padrão para todos os meses
            </button>
            {isCustom && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-300 hover:underline"
                disabled={saving}
              >
                Restaurar padrão
              </button>
            )}
          </div>
        </div>

        {message && <p className="text-sm font-medium text-lime">{message}</p>}
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

