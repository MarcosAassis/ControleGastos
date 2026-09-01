import { useEffect, useMemo, useState } from "react";
import { Palmtree } from "lucide-react";
import { api } from "../api.js";
import ProgressBar from "../components/ProgressBar.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, monthLabel } from "../utils/format.js";
import { diasAposFolgas, montarProvisao } from "../utils/provisao.js";
import { intFieldProps, moneyFieldProps, parseAmount } from "../utils/validate.js";

export default function Metas() {
  const { year, month } = useMonth();
  const [config, setConfig] = useState({
    monthly_net_profit: "",
    monthly_contingency: "",
    include_13th: false,
    vacation_days_year: "0",
    planned_rest_days: "0",
    checkpoint_amount: "",
    checkpoint_day: "",
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
      include_13th: Boolean(cfg.include_13th),
      vacation_days_year: String(cfg.vacation_days_year ?? 0),
      planned_rest_days: String(cfg.planned_rest_days ?? 0),
      checkpoint_amount: cfg.checkpoint_amount ? String(cfg.checkpoint_amount) : "",
      checkpoint_day: cfg.checkpoint_day ? String(cfg.checkpoint_day) : "",
    });
    setIsCustom(Boolean(cfg.is_custom));
    setCalc(metas);
  };

  useEffect(() => {
    setMessage("");
    load().catch(console.error);
  }, [year, month]);

  const preview = useMemo(() => {
    const lucro = Number(config.monthly_net_profit || 0);
    const reserva = Number(config.monthly_contingency || 0);
    const fixos = calc?.gastos_fixos_mensal || 0;
    const diasCal = calc?.dias_calendario ?? calc?.dias_trabalhados_mes ?? 0;
    const prov = montarProvisao(
      lucro,
      config.include_13th,
      config.vacation_days_year,
      calc?.dias_por_semana || 5,
    );
    const { dias, aplicadas } = diasAposFolgas(diasCal, config.planned_rest_days);
    const total = fixos + lucro + reserva + prov.provisao_descanso;
    const diaria = dias ? total / dias : 0;
    const checkpointAmount = Number(config.checkpoint_amount || 0);
    const checkpointDay = Math.round(Number(config.checkpoint_day || 0));
    const marco = calc?.marco;
    const sameDeadline = Boolean(
      marco?.ativo && checkpointAmount > 0 && checkpointDay > 0 && marco.dia === checkpointDay,
    );
    const faltamMarco = sameDeadline
      ? Math.max(checkpointAmount - Number(marco.realizado || 0), 0)
      : 0;
    const diariaRitmo =
      sameDeadline && marco.cobrando && marco.dias_restantes
        ? faltamMarco / marco.dias_restantes
        : null;
    return {
      ...prov,
      dias,
      aplicadas,
      diasCal,
      total,
      diaria,
      checkpointAmount,
      checkpointDay,
      diariaRitmo,
    };
  }, [config, calc]);

  const handleSave = async (saveAsDefault = false) => {
    const lucro = parseAmount(config.monthly_net_profit, { label: "lucro líquido" });
    const reserva = parseAmount(config.monthly_contingency, { label: "reserva" });
    const ferias = parseAmount(config.vacation_days_year, { max: 60, label: "dias de férias" });
    const folgas = parseAmount(config.planned_rest_days, { max: 20, label: "folgas" });
    const checkpointAmount = parseAmount(config.checkpoint_amount, { label: "meta até o dia" });
    const checkpointDay = parseAmount(config.checkpoint_day, { max: 31, label: "dia do prazo" });
    if (!lucro.ok || !reserva.ok || !ferias.ok || !folgas.ok || !checkpointAmount.ok || !checkpointDay.ok) {
      setMessage(
        lucro.error ||
          reserva.error ||
          ferias.error ||
          folgas.error ||
          checkpointAmount.error ||
          checkpointDay.error,
      );
      return;
    }
    const dia = Math.round(checkpointDay.value);
    if (checkpointAmount.value > 0 && dia <= 0) {
      setMessage("Informe o dia do mês para essa meta.");
      return;
    }
    if (dia > 0 && checkpointAmount.value <= 0) {
      setMessage("Informe o valor da meta até esse dia.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.metas.saveConfig(
        {
          monthly_net_profit: lucro.value,
          monthly_contingency: reserva.value,
          include_13th: Boolean(config.include_13th),
          vacation_days_year: Math.round(ferias.value),
          planned_rest_days: Math.round(folgas.value),
          checkpoint_amount: checkpointAmount.value,
          checkpoint_day: dia,
          year,
          month,
          save_as_default: saveAsDefault,
        },
        year,
        month,
      );
      await load();
    } catch {
      /* toast global */
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
    } catch {
      /* toast global */
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
            {...moneyFieldProps}
            className="field"
            placeholder="Ex.: 4000"
            value={config.monthly_net_profit}
            onChange={(e) => setConfig({ ...config, monthly_net_profit: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Reserva de imprevistos</label>
          <input
            {...moneyFieldProps}
            className="field"
            placeholder="Manutenção, pneu, óleo"
            value={config.monthly_contingency}
            onChange={(e) => setConfig({ ...config, monthly_contingency: e.target.value })}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
          <div>
            <h3 className="font-display font-semibold">Meta até um dia do mês</h3>
            <p className="mt-1 text-sm text-emerald-100/70">
              Essa diária entra no lugar da meta do mês até o dia escolhido — não soma as duas.
              Depois do prazo, o que ainda faltar no mês é dividido pelos dias de rua que restarem.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Faturar até o prazo (R$)</label>
              <input
                {...moneyFieldProps}
                className="field"
                placeholder="Ex.: 2500"
                value={config.checkpoint_amount}
                onChange={(e) => setConfig({ ...config, checkpoint_amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Dia do mês</label>
              <input
                {...intFieldProps}
                min="0"
                max="31"
                className="field"
                placeholder="Ex.: 15"
                value={config.checkpoint_day}
                onChange={(e) => setConfig({ ...config, checkpoint_day: e.target.value })}
              />
            </div>
          </div>
          {preview.diariaRitmo != null && (
            <p className="text-sm">
              Ritmo agora:{" "}
              <span className="font-display font-bold">{brl(preview.diariaRitmo)}</span>
              /dia até o dia {preview.checkpointDay}
              {Number(preview.diaria) > 0 ? (
                <span className="text-emerald-100/60">
                  {" "}
                  · depois do prazo o mês é recalculado
                </span>
              ) : null}
            </p>
          )}
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

      <section className="card space-y-4">
        <div className="flex items-start gap-2">
          <Palmtree size={18} className="mt-0.5 shrink-0 text-lime" />
          <div>
            <h2 className="font-display font-semibold">Folgas e férias remuneradas</h2>
            <p className="text-sm text-emerald-100/70">
              Guarda uma fatia do lucro para 13º e férias, e sobe a meta diária se você
              planejar mais descanso neste mês.
            </p>
          </div>
        </div>

        <button
          type="button"
          className={`w-full rounded-xl py-2.5 text-sm font-bold ${
            config.include_13th ? "bg-lime text-night-950" : "bg-white/5 text-emerald-100"
          }`}
          onClick={() => setConfig({ ...config, include_13th: !config.include_13th })}
        >
          {config.include_13th ? "13º incluído na reserva" : "Incluir 13º na reserva mensal"}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Dias de férias no ano</label>
            <input
              {...intFieldProps}
              max="60"
              className="field"
              placeholder="30"
              value={config.vacation_days_year}
              onChange={(e) => setConfig({ ...config, vacation_days_year: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Folgas extras neste mês</label>
            <input
              {...intFieldProps}
              max="20"
              className="field"
              placeholder="0"
              value={config.planned_rest_days}
              onChange={(e) => setConfig({ ...config, planned_rest_days: e.target.value })}
            />
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-3 text-sm space-y-1.5">
          <p className="flex justify-between gap-3">
            <span className="text-emerald-100/70">Provisão 13º</span>
            <span className="font-bold">{brl(preview.provisao_13)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-emerald-100/70">Provisão férias (+1/3)</span>
            <span className="font-bold">{brl(preview.provisao_ferias)}</span>
          </p>
          <p className="flex justify-between gap-3">
            <span className="text-emerald-100/70">A guardar no mês</span>
            <span className="font-bold text-lime">{brl(preview.provisao_descanso)}</span>
          </p>
          <p className="flex justify-between gap-3 pt-1 text-xs text-emerald-100/60">
            <span>
              {preview.diasCal} dias no calendário
              {preview.aplicadas ? ` − ${preview.aplicadas} folga(s)` : ""}
            </span>
            <span>{preview.dias} dia(s) para trabalhar</span>
          </p>
          <p className="flex justify-between gap-3 pt-1">
            <span className="text-emerald-100/70">Meta diária recálculada</span>
            <span className="font-display text-lg font-bold">{brl(preview.diaria)}</span>
          </p>
        </div>
        <p className="text-xs text-emerald-100/50">
          13º = lucro ÷ 12. Férias = lucro × (dias de férias ÷ dias úteis do ano) × 4/3.
          Toque em salvar para aplicar no painel.
        </p>
        <button className="btn-primary" type="button" disabled={saving} onClick={() => handleSave(false)}>
          {saving ? "Salvando..." : "Aplicar folgas e provisão"}
        </button>
      </section>

      {calc && (
        <>
          <section className="card space-y-3">
            <p className="text-xs text-emerald-200/70">Fórmula</p>
            <p className="text-sm leading-relaxed text-emerald-50/90">
              Gastos fixos ({brl(calc.gastos_fixos_mensal)}) + lucro líquido ({brl(calc.lucro_liquido_alvo)})
              + reserva ({brl(calc.reserva_imprevistos)})
              {Number(calc.provisao_descanso) > 0
                ? ` + provisão 13º/férias (${brl(calc.provisao_descanso)})`
                : ""}{" "}
              = {brl(calc.total_necessario)}. Esse total é dividido por {calc.dias_trabalhados_mes}{" "}
              dias trabalhados no mês
              {Number(calc.folgas_aplicadas) > 0
                ? ` (${calc.dias_calendario} no calendário − ${calc.folgas_aplicadas} folga${
                    calc.folgas_aplicadas === 1 ? "" : "s"
                  })`
                : ""}
              .
            </p>
            <ProgressBar value={100} />
          </section>

          <div className="grid grid-cols-2 gap-3">
            <GoalCard title="Bruto mensal" value={brl(calc.meta_bruta_mensal)} highlight />
            <GoalCard title="Bruto semanal" value={brl(calc.meta_bruta_semanal)} />
            <GoalCard
              title={calc.marco?.cobrando ? "Diária no ritmo" : "Bruto diário"}
              value={brl(calc.meta_bruta_diaria)}
              highlight
            />
            <GoalCard title="Por hora" value={brl(calc.meta_por_hora)} />
          </div>
          {calc.marco?.cobrando && (
            <p className="text-sm text-emerald-100/70">
              Até o dia {calc.marco.dia} vale só esta diária. Depois o mês é recalculado com o que
              faltar.
            </p>
          )}
          {calc.marco?.recalculando_mes && (
            <p className="text-sm text-emerald-100/70">
              Prazo encerrado. A diária agora é o que falta na meta do mês, dividido pelos dias que
              restam.
            </p>
          )}

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
