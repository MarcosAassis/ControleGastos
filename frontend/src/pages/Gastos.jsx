import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, formatDate, maskDateBR, parseDateBR, todayISO } from "../utils/format.js";

const SUGESTOES_FIXAS = [
  { name: "Aluguel", category: "casa" },
  { name: "Água", category: "casa" },
  { name: "Luz", category: "casa" },
  { name: "Internet", category: "casa" },
  { name: "Parcela do carro", category: "uber" },
  { name: "Seguro", category: "uber" },
  { name: "Celular", category: "casa" },
  { name: "MEI", category: "uber" },
];

const TIPOS_VARIAVEIS = [
  { id: "combustivel", label: "Combustível" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "lavagem", label: "Lavagem" },
  { id: "imprevisto", label: "Imprevisto" },
  { id: "outro", label: "Outro" },
];

export default function Gastos() {
  const { year, month } = useMonth();
  const [tab, setTab] = useState("fixos");
  const [fixos, setFixos] = useState([]);
  const [variaveis, setVariaveis] = useState([]);
  const [metas, setMetas] = useState(null);
  const [fixoForm, setFixoForm] = useState({
    name: "",
    amount: "",
    category: "casa",
    due_date: "",
  });
  const [dateError, setDateError] = useState("");
  const [varForm, setVarForm] = useState({
    date: todayISO(),
    type: "combustivel",
    description: "",
    amount: "",
  });

  const load = async () => {
    const [fixed, vars, calc] = await Promise.all([
      api.gastosFixos.list(year, month),
      api.gastosVariaveis.list(year, month),
      api.metas.calculo(year, month),
    ]);
    setFixos(fixed);
    setVariaveis(vars);
    setMetas(calc);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [year, month]);

  const totalFixos = useMemo(
    () => fixos.reduce((acc, item) => acc + Number(item.amount), 0),
    [fixos]
  );
  const totalVariaveis = useMemo(
    () => variaveis.reduce((acc, item) => acc + Number(item.amount), 0),
    [variaveis]
  );

  const addFixo = async (event) => {
    event.preventDefault();
    const dueDateISO = fixoForm.due_date ? parseDateBR(fixoForm.due_date) : null;
    if (fixoForm.due_date && !dueDateISO) {
      setDateError("Use a data no formato dd/mm/aaaa.");
      return;
    }
    setDateError("");
    await api.gastosFixos.create(
      {
        name: fixoForm.name,
        amount: Number(fixoForm.amount),
        category: fixoForm.category,
        due_date: dueDateISO,
      },
      year,
      month
    );
    setFixoForm({ name: "", amount: "", category: "casa", due_date: "" });
    await load();
  };

  const addVariavel = async (event) => {
    event.preventDefault();
    await api.gastosVariaveis.create({
      ...varForm,
      amount: Number(varForm.amount),
    });
    setVarForm({ date: todayISO(), type: "combustivel", description: "", amount: "" });
    await load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-night-800 p-1">
        <button
          className={`rounded-xl py-2 text-sm font-bold ${tab === "fixos" ? "bg-lime text-night-950" : "text-emerald-100/70"}`}
          onClick={() => setTab("fixos")}
        >
          Fixos
        </button>
        <button
          className={`rounded-xl py-2 text-sm font-bold ${tab === "variaveis" ? "bg-lime text-night-950" : "text-emerald-100/70"}`}
          onClick={() => setTab("variaveis")}
        >
          Variáveis
        </button>
      </div>

      {tab === "fixos" ? (
        <>
          <section className="card">
            <p className="text-xs text-emerald-200/70">Custo fixo diário</p>
            <p className="font-display text-3xl font-bold text-lime">
              {brl(metas?.custo_fixo_diario || 0)}
            </p>
            <p className="mt-1 text-sm text-emerald-100/70">
              {brl(totalFixos)} por mês ÷ {metas?.dias_trabalhados_mes || 0} dias rodados
            </p>
          </section>

          <form onSubmit={addFixo} className="card space-y-3">
            <h2 className="font-display font-semibold">Nova conta fixa</h2>
            <div className="flex flex-wrap gap-2">
              {SUGESTOES_FIXAS.map((item) => (
                <button
                  type="button"
                  key={item.name}
                  className="rounded-full bg-white/5 px-3 py-1 text-xs"
                  onClick={() =>
                    setFixoForm((prev) => ({ ...prev, name: item.name, category: item.category }))
                  }
                >
                  {item.name}
                </button>
              ))}
            </div>
            <input
              className="field"
              placeholder="Nome da conta"
              value={fixoForm.name}
              onChange={(e) => setFixoForm({ ...fixoForm, name: e.target.value })}
              required
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              placeholder="Valor mensal"
              value={fixoForm.amount}
              onChange={(e) => setFixoForm({ ...fixoForm, amount: e.target.value })}
              required
            />
            <div>
              <label className="label">Vencimento</label>
              <input
                className="field"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                maxLength={10}
                value={fixoForm.due_date}
                onChange={(e) => {
                  setDateError("");
                  setFixoForm({ ...fixoForm, due_date: maskDateBR(e.target.value) });
                }}
              />
              {dateError && <p className="mt-1 text-sm text-rose-300">{dateError}</p>}
            </div>
            <select
              className="field"
              value={fixoForm.category}
              onChange={(e) => setFixoForm({ ...fixoForm, category: e.target.value })}
            >
              <option value="casa">Conta de casa</option>
              <option value="uber">Custo da Uber / carro</option>
            </select>
            <button className="btn-primary">
              <Plus size={18} /> Adicionar
            </button>
          </form>

          {fixos.length === 0 ? (
            <EmptyState title="Sem gastos fixos" text="Cadastre aluguel, parcela, seguro e demais contas mensais." />
          ) : (
            fixos.map((item) => (
              <article key={item.id} className="card flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    api.gastosFixos
                      .pagar(item.id, { year, month, paid: !item.paid })
                      .then(load)
                  }
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    item.paid ? "bg-lime text-night-950" : "bg-white/10 text-emerald-100/40"
                  }`}
                >
                  <Check size={18} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  <p className="text-xs text-emerald-100/60">
                    {item.category === "casa" ? "Casa" : "Uber/carro"}
                    {item.due_date ? ` · vence ${formatDate(item.due_date)}` : ""}
                    {item.paid ? " · paga" : " · pendente"}
                  </p>
                </div>
                <p className="font-bold">{brl(item.amount)}</p>
                <button
                  type="button"
                  className="text-rose-300"
                  onClick={() => api.gastosFixos.remove(item.id).then(load)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))
          )}
        </>
      ) : (
        <>
          <section className="card">
            <p className="text-xs text-emerald-200/70">Gastos variáveis do mês</p>
            <p className="font-display text-3xl font-bold">{brl(totalVariaveis)}</p>
            <p className="mt-1 text-sm text-emerald-100/70">
              Combustível, alimentação, lavagem e imprevistos lançados
            </p>
          </section>

          <form onSubmit={addVariavel} className="card space-y-3">
            <h2 className="font-display font-semibold">Novo gasto variável</h2>
            <div className="flex flex-wrap gap-2">
              {TIPOS_VARIAVEIS.map((tipo) => (
                <button
                  type="button"
                  key={tipo.id}
                  className={`rounded-full px-3 py-1 text-xs ${
                    varForm.type === tipo.id ? "bg-lime text-night-950" : "bg-white/5"
                  }`}
                  onClick={() => setVarForm({ ...varForm, type: tipo.id })}
                >
                  {tipo.label}
                </button>
              ))}
            </div>
            <input
              type="date"
              className="field"
              value={varForm.date}
              onChange={(e) => setVarForm({ ...varForm, date: e.target.value })}
              required
            />
            <input
              className="field"
              placeholder="Descrição"
              value={varForm.description}
              onChange={(e) => setVarForm({ ...varForm, description: e.target.value })}
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="field"
              placeholder="Valor"
              value={varForm.amount}
              onChange={(e) => setVarForm({ ...varForm, amount: e.target.value })}
              required
            />
            <button className="btn-primary">
              <Plus size={18} /> Lançar gasto
            </button>
          </form>

          {variaveis.length === 0 ? (
            <EmptyState
              title="Nenhum gasto variável"
              text="Registre combustível, refeição na rua, lavagem e imprevistos."
            />
          ) : (
            variaveis.map((item) => (
              <article key={item.id} className="card flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.description || labelTipo(item.type)}</p>
                  <p className="text-xs text-emerald-100/60">
                    {formatDate(item.date)} · {labelTipo(item.type)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-bold">{brl(item.amount)}</p>
                  <button
                    type="button"
                    className="text-rose-300"
                    onClick={() => api.gastosVariaveis.remove(item.id).then(load)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))
          )}
        </>
      )}
    </div>
  );
}

function labelTipo(type) {
  return TIPOS_VARIAVEIS.find((item) => item.id === type)?.label || type;
}
