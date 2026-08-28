import { brl, formatDate, km, monthLabel } from "./format.js";

const TIPOS = {
  combustivel: "Combustível",
  alimentacao: "Alimentação",
  lavagem: "Lavagem",
  imprevisto: "Imprevisto",
  outro: "Outro",
};

export function tipoVariavel(type) {
  return TIPOS[type] || type || "Gasto";
}

export function buildMonthSummaryText({ userName, year, month, dash, eficiencia }) {
  const periodo = monthLabel(year, month);
  const r = dash?.realizado || {};
  const p = dash?.progresso || {};
  const e = eficiencia || dash?.eficiencia || {};
  const c = dash?.combustivel || {};
  const m = dash?.metas || {};
  const linhas = [
    `*Fechamento — ${periodo}*`,
    userName ? `Motorista: ${userName}` : "",
    "",
    `Faturamento: ${brl(r.faturamento_uber)}`,
    `Gastos fixos pagos: ${brl(r.gastos_fixos_pagos)}`,
    `Gastos fixos pendentes: ${brl(r.gastos_fixos_pendentes)}`,
    `Gastos variáveis: ${brl(r.gastos_variaveis)}`,
    `Gastos totais: ${brl(r.gastos_totais)}`,
    `Lucro líquido: ${brl(r.lucro_liquido)}`,
    "",
    `Km rodados: ${km(r.km_total)}`,
    r.horas_total ? `Horas lançadas: ${Number(r.horas_total).toLocaleString("pt-BR")} h` : "",
    e.rs_por_km != null ? `Rendimento: ${brl(e.rs_por_km)}/km` : "",
    e.rs_por_hora != null ? `Rendimento: ${brl(e.rs_por_hora)}/h` : "",
    c.km_per_liter != null
      ? `Consumo: ${Number(c.km_per_liter).toLocaleString("pt-BR")} km/l`
      : "",
    c.rs_per_km != null ? `Combustível: ${brl(c.rs_per_km)}/km` : "",
    m.provisao_descanso > 0 ? `Provisão 13º/férias: ${brl(m.provisao_descanso)}` : "",
    m.folgas_aplicadas > 0
      ? `Dias trabalhados: ${m.dias_trabalhados_mes} (${m.dias_calendario} − ${m.folgas_aplicadas} folga${
          m.folgas_aplicadas === 1 ? "" : "s"
        })`
      : "",
    p.contas_pagas != null
      ? `Contas: ${p.contas_pagas} pagas · ${p.contas_pendentes} pendentes`
      : "",
    "",
    "_Resumo gerado no app Gestão Financeira_",
  ];
  return linhas.filter((line) => line != null).join("\n");
}

function csvCell(value) {
  const raw = value == null ? "" : String(value);
  if (/[;"\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildMonthCsv({ ganhos, fixos, variaveis }) {
  const header = ["Data", "Tipo", "Descrição", "Valor (R$)", "Km", "Horas", "Litros", "Odômetro"];
  const rows = [header];

  const ganhosOrdenados = [...(ganhos || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  for (const item of ganhosOrdenados) {
    rows.push([
      formatDate(item.date),
      "Ganho",
      item.notes || "Faturamento do dia",
      Number(item.gross_amount || 0).toFixed(2).replace(".", ","),
      item.km_driven || "",
      item.hours_worked ?? "",
      "",
      "",
    ]);
  }

  for (const item of fixos || []) {
    rows.push([
      item.due_date ? formatDate(item.due_date) : "",
      item.paid ? "Gasto fixo (pago)" : "Gasto fixo (pendente)",
      item.name || "",
      Number(item.amount || 0).toFixed(2).replace(".", ","),
      "",
      "",
      "",
      "",
    ]);
  }

  const varsOrdenados = [...(variaveis || [])].sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  for (const item of varsOrdenados) {
    rows.push([
      formatDate(item.date),
      "Gasto variável",
      [tipoVariavel(item.type), item.description].filter(Boolean).join(" — "),
      Number(item.amount || 0).toFixed(2).replace(".", ","),
      item.km_since_last || "",
      "",
      item.liters || "",
      item.odometer_km || "",
    ]);
  }

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
