import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Printer, Share2 } from "lucide-react";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, formatDate, km, monthLabel, pct } from "../utils/format.js";
import {
  buildMonthCsv,
  buildMonthSummaryText,
  downloadCsv,
  tipoVariavel,
  whatsappShareUrl,
} from "../utils/report.js";

export default function Relatorio() {
  const { year, month } = useMonth();
  const { user } = useAuth();
  const [dash, setDash] = useState(null);
  const [ganhos, setGanhos] = useState([]);
  const [fixos, setFixos] = useState([]);
  const [variaveis, setVariaveis] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    setError("");
    setInfo("");
    Promise.all([
      api.dashboard(year, month),
      api.ganhos.list(year, month),
      api.gastosFixos.list(year, month),
      api.gastosVariaveis.list(year, month),
    ])
      .then(([painel, listaGanhos, listaFixos, listaVars]) => {
        setDash(painel);
        setGanhos(listaGanhos);
        setFixos(listaFixos);
        setVariaveis(listaVars);
      })
      .catch((err) => setError(err.message));
  }, [year, month]);

  const periodo = monthLabel(year, month);
  const texto = useMemo(
    () =>
      dash
        ? buildMonthSummaryText({
            userName: user?.name,
            year,
            month,
            dash,
            eficiencia: dash.eficiencia,
          })
        : "",
    [dash, user, year, month],
  );

  const shareWhatsApp = async () => {
    setInfo("");
    if (navigator.share) {
      try {
        await navigator.share({ title: `Fechamento ${periodo}`, text: texto });
        return;
      } catch {
        /* cai no WhatsApp */
      }
    }
    window.open(whatsappShareUrl(texto), "_blank", "noopener,noreferrer");
  };

  const exportCsv = () => {
    const slug = `${year}-${String(month).padStart(2, "0")}`;
    downloadCsv(
      `fechamento-${slug}.csv`,
      buildMonthCsv({ ganhos, fixos, variaveis }),
    );
    setInfo("Arquivo CSV baixado. Abra no Excel ou Planilhas.");
  };

  if (error) {
    return <p className="card text-sm text-rose-300">{error}</p>;
  }
  if (!dash) {
    return <p className="pt-10 text-center text-emerald-100/60">Montando fechamento...</p>;
  }

  const { realizado, progresso, metas, eficiencia } = dash;
  const lucroPositivo = Number(realizado.lucro_liquido) >= 0;

  return (
    <div className="space-y-4">
      <section className="no-print space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
            Fechamento mensal
          </p>
          <h2 className="font-display text-2xl font-bold capitalize">{periodo}</h2>
          <p className="mt-1 text-sm text-emerald-100/70">
            Resumo para imprimir, enviar no WhatsApp ou abrir no Excel.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button type="button" className="btn-primary py-3 text-sm" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir / PDF
          </button>
          <button type="button" className="btn-ghost w-full gap-2 py-3 text-sm" onClick={shareWhatsApp}>
            <Share2 size={16} /> WhatsApp
          </button>
          <button type="button" className="btn-ghost w-full gap-2 py-3 text-sm" onClick={exportCsv}>
            <FileSpreadsheet size={16} /> CSV / Excel
          </button>
        </div>
        {info && <p className="text-sm text-lime">{info}</p>}
      </section>

      <article className="print-report card space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
            Motorista Uber
          </p>
          <h3 className="font-display text-xl font-bold">Fechamento de {periodo}</h3>
          <p className="text-sm text-emerald-100/70">{user?.name || "Motorista"}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryBox label="Faturamento" value={brl(realizado.faturamento_uber)} />
          <SummaryBox
            label="Lucro líquido"
            value={brl(realizado.lucro_liquido)}
            tone={lucroPositivo ? "lime" : "rose"}
          />
          <SummaryBox label="Gastos totais" value={brl(realizado.gastos_totais)} />
          <SummaryBox label="Km rodados" value={km(realizado.km_total)} />
        </div>

        <div className="rounded-2xl bg-white/5 p-3 text-sm">
          <p>Gastos fixos pagos: {brl(realizado.gastos_fixos_pagos)}</p>
          <p>Gastos fixos pendentes: {brl(realizado.gastos_fixos_pendentes)}</p>
          <p>Gastos variáveis: {brl(realizado.gastos_variaveis)}</p>
          <p>
            Contas: {progresso.contas_pagas} pagas ({brl(progresso.valor_pago)}) ·{" "}
            {progresso.contas_pendentes} pendentes ({brl(progresso.valor_pendente)})
          </p>
          {metas && (
            <p className="mt-1 text-emerald-100/70">
              Meta de faturamento: {brl(metas.meta_bruta_mensal)} ({pct(progresso.meta_mensal_pct)})
            </p>
          )}
          {metas?.marco?.ativo && (
            <p>
              Meta até o dia {metas.marco.dia}: {brl(metas.marco.realizado)} de {brl(metas.marco.valor)}
              {metas.marco.atingida ? " (atingida)" : metas.marco.vencido ? " (não atingida)" : ""}
            </p>
          )}
          {eficiencia?.rs_por_km != null && <p>Rendimento: {brl(eficiencia.rs_por_km)}/km</p>}
          {eficiencia?.rs_por_hora != null && <p>Rendimento: {brl(eficiencia.rs_por_hora)}/h</p>}
          {dash.combustivel?.km_per_liter != null && (
            <p>
              Consumo: {Number(dash.combustivel.km_per_liter).toLocaleString("pt-BR")} km/l
            </p>
          )}
          {dash.combustivel?.rs_per_km != null && (
            <p>Combustível: {brl(dash.combustivel.rs_per_km)}/km</p>
          )}
          {Number(metas.provisao_descanso) > 0 && (
            <p>Provisão 13º/férias: {brl(metas.provisao_descanso)}</p>
          )}
          {Number(metas.folgas_aplicadas) > 0 && (
            <p>
              Dias trabalhados: {metas.dias_trabalhados_mes} ({metas.dias_calendario} −{" "}
              {metas.folgas_aplicadas} folga{metas.folgas_aplicadas === 1 ? "" : "s"})
            </p>
          )}
        </div>

        <section>
          <h4 className="mb-2 font-display font-semibold">Ganhos</h4>
          {ganhos.length === 0 ? (
            <p className="text-sm text-emerald-100/60">Nenhum ganho neste mês.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {[...ganhos]
                .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                .map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                    <span>
                      {formatDate(item.date)}
                      {item.notes ? ` · ${item.notes}` : ""}
                    </span>
                    <span className="font-semibold text-lime">{brl(item.gross_amount)}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 font-display font-semibold">Gastos fixos</h4>
          {fixos.length === 0 ? (
            <p className="text-sm text-emerald-100/60">Nenhum gasto fixo neste mês.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {fixos.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                  <span>
                    {item.name}
                    {item.paid ? " · pago" : " · pendente"}
                  </span>
                  <span className="font-semibold">{brl(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="mb-2 font-display font-semibold">Gastos variáveis</h4>
          {variaveis.length === 0 ? (
            <p className="text-sm text-emerald-100/60">Nenhum gasto variável neste mês.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {[...variaveis]
                .sort((a, b) => String(a.date).localeCompare(String(b.date)))
                .map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 border-b border-white/5 pb-1.5">
                    <span>
                      {formatDate(item.date)} · {tipoVariavel(item.type)}
                      {item.description ? ` · ${item.description}` : ""}
                    </span>
                    <span className="font-semibold">{brl(item.amount)}</span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}

function SummaryBox({ label, value, tone }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <p className="text-[11px] text-emerald-100/60">{label}</p>
      <p
        className={`mt-1 font-display text-lg font-bold ${
          tone === "rose" ? "text-rose-300" : tone === "lime" ? "text-lime" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
