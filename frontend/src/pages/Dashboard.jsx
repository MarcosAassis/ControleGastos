import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import EfficiencyCard from "../components/EfficiencyCard.jsx";
import FuelCard from "../components/FuelCard.jsx";
import GoalBanner from "../components/GoalBanner.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import QuickEarningCard from "../components/QuickEarningCard.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { brl, km, pct, todayISO } from "../utils/format.js";

export default function Dashboard() {
  const { year, month } = useMonth();
  const { celebrate } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      const res = await api.dashboard(year, month);
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    setError("");
    loadData();
  }, [year, month]);

  useEffect(() => {
    if (!data?.hoje || !data.progresso || !data.metas) return;
    const dayKey = todayISO();
    const monthKey = `${year}-${month}`;
    const dayHit = Boolean(data.hoje.atingida && data.hoje.tem_lancamento);
    const monthHit =
      Number(data.progresso.meta_mensal_pct) >= 100 && Number(data.metas.meta_bruta_mensal) > 0;
    const dayNew = dayHit && !sessionStorage.getItem(`uber_financas_celeb_day_${dayKey}`);
    const monthNew = monthHit && !sessionStorage.getItem(`uber_financas_celeb_month_${monthKey}`);
    if (dayNew && monthNew) {
      celebrate({
        kind: "month",
        key: monthKey,
        title: "Dia e mês batidos!",
        subtitle: "O faturamento de hoje e o do mês chegaram a 100% da meta.",
      });
      sessionStorage.setItem(`uber_financas_celeb_day_${dayKey}`, "1");
      return;
    }
    if (monthNew) {
      celebrate({
        kind: "month",
        key: monthKey,
        title: "Meta do mês fechada!",
        subtitle: "O faturamento do mês chegou a 100% da meta.",
      });
      return;
    }
    if (dayNew) {
      celebrate({
        kind: "day",
        key: dayKey,
        title: "Meta do dia batida!",
        subtitle: "Parabéns. O faturamento de hoje chegou a 100% da meta.",
      });
    }
  }, [data, year, month, celebrate]);

  if (error) {
    return <p className="card text-sm text-rose-300">{error}</p>;
  }
  if (!data) {
    return <p className="pt-10 text-center text-emerald-100/60">Carregando painel...</p>;
  }

  const { realizado, progresso, metas, hoje = {}, eficiencia, combustivel } = data;
  if (!realizado || !progresso || !metas) {
    return (
      <p className="card text-sm text-rose-300">
        Não foi possível carregar o painel. Entre de novo ou confira se a API está no ar.
      </p>
    );
  }
  const lucroPositivo = realizado.lucro_liquido >= 0;
  const mesAtual =
    year === new Date().getFullYear() && month === new Date().getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* Lançamento Rápido no Topo do Dashboard para fácil acesso */}
      <QuickEarningCard hoje={hoje} metas={metas} onSaved={loadData} />

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

      <EfficiencyCard eficiencia={eficiencia} />
      {mesAtual && hoje?.tem_lancamento && hoje.eficiencia && (
        <EfficiencyCard eficiencia={hoje.eficiencia} titulo="Eficiência de hoje" />
      )}
      <FuelCard consumo={combustivel} />

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold">Meta mensal de faturamento</h2>
          <span className="text-sm font-bold text-lime">{pct(progresso.meta_mensal_pct)}</span>
        </div>
        <ProgressBar value={progresso.meta_mensal_pct} />
        <p className="text-sm text-emerald-100/70">
          {brl(realizado.faturamento_uber)} de {brl(metas.meta_bruta_mensal)}
          {Number(metas.provisao_descanso) > 0
            ? ` · inclui ${brl(metas.provisao_descanso)} de 13º/férias`
            : ""}
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
        <MiniCard
          title="Meta diária"
          value={brl(metas.meta_bruta_diaria)}
          to="/metas"
          hint={
            Number(metas.folgas_aplicadas) > 0
              ? `${metas.dias_trabalhados_mes} dias · ${metas.folgas_aplicadas} folga(s)`
              : null
          }
        />
        <MiniCard title="Custo fixo/dia" value={brl(metas.custo_fixo_diario)} to="/gastos" />
      </section>

      <Link
        to="/relatorio"
        className="card block border-lime/20"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
          Fechamento do mês
        </p>
        <p className="mt-1 font-display text-lg font-bold">Imprimir, WhatsApp ou CSV</p>
        <p className="mt-1 text-sm text-emerald-100/70">
          Relatório consolidado de faturamento, gastos e lucro.
        </p>
      </Link>
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

function MiniCard({ title, value, to, hint }) {
  return (
    <Link to={to} className="card block">
      <p className="text-xs text-emerald-200/70">{title}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-emerald-100/50">{hint}</p> : null}
    </Link>
  );
}
