import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import GoalBanner from "../components/GoalBanner.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { brl, formatDate, km, todayISO } from "../utils/format.js";
import { hoursFieldProps, kmFieldProps, moneyFieldProps, parseAmount, parseOptionalAmount } from "../utils/validate.js";

export default function Ganhos() {
  const { year, month } = useMonth();
  const { celebrate } = useToast();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({
    date: todayISO(),
    gross_amount: "",
    km_driven: "",
    hours_worked: "",
    notes: "",
  });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const [rows, metas] = await Promise.all([
      api.ganhos.list(year, month),
      api.metas.calculo(year, month),
    ]);
    setLista(rows);
    const hoje = rows.find((item) => item.date === todayISO());
    if (hoje) {
      setStatus({ ...hoje, marco: metas.marco });
      setForm({
        date: hoje.date,
        gross_amount: String(hoje.gross_amount),
        km_driven: String(hoje.km_driven || ""),
        hours_worked: hoje.hours_worked !== null && hoje.hours_worked !== undefined ? String(hoje.hours_worked) : "",
        notes: hoje.notes || "",
      });
    } else {
      setStatus({
        gross_amount: 0,
        meta_diaria: metas.meta_bruta_diaria,
        faltam: metas.meta_bruta_diaria,
        atingida: false,
        progresso_pct: 0,
        marco: metas.marco,
      });
    }
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [year, month]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const gross = parseAmount(form.gross_amount, { required: true, label: "faturamento" });
    const kmVal = parseAmount(form.km_driven, { label: "km" });
    const hours = parseOptionalAmount(form.hours_worked, { label: "horas" });
    if (!gross.ok || !kmVal.ok || !hours.ok) {
      setError(gross.error || kmVal.error || hours.error);
      setSaving(false);
      return;
    }
    try {
      const saved = await api.ganhos.save({
        date: form.date,
        gross_amount: gross.value,
        km_driven: kmVal.value,
        hours_worked: hours.value,
        notes: form.notes || null,
      });
      setStatus(saved);
      if (saved.atingida) {
        celebrate({
          kind: "day",
          key: form.date,
          title: "Meta do dia batida!",
          subtitle: "Parabéns. O faturamento deste dia chegou a 100% da meta.",
        });
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    await api.ganhos.remove(id);
    await load();
  };

  return (
    <div className="space-y-4">
      {status && (
        <GoalBanner
          ganho={status.gross_amount || Number(form.gross_amount || 0)}
          meta={status.meta_diaria}
          faltam={status.faltam}
          atingida={status.atingida}
          progresso={status.progresso_pct}
          cobrando={Boolean(status.marco?.cobrando) && form.date === todayISO()}
          prazoDia={status.marco?.dia}
        />
      )}

      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-display font-semibold">Lançar ganhos do dia</h2>
        <div>
          <label className="label">Data</label>
          <input
            type="date"
            className="field"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Valor bruto (R$)</label>
            <input
              {...moneyFieldProps}
              className="field"
              placeholder="0,00"
              value={form.gross_amount}
              onChange={(e) => setForm({ ...form, gross_amount: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Km rodados</label>
            <input
              {...kmFieldProps}
              className="field"
              placeholder="0"
              value={form.km_driven}
              onChange={(e) => setForm({ ...form, km_driven: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Horas trabalhadas</label>
            <input
              {...hoursFieldProps}
              className="field"
              placeholder="Ex: 8"
              value={form.hours_worked}
              onChange={(e) => setForm({ ...form, hours_worked: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="label">Observação</label>
          <input
            className="field"
            placeholder="Opcional"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Salvar ganhos"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display font-semibold">Histórico do mês</h2>
        {lista.length === 0 ? (
          <EmptyState title="Nenhum ganho lançado" text="Registre o valor bruto do dia para acompanhar a meta." />
        ) : (
          lista.map((item) => (
            <article key={item.id} className="card flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-emerald-100/70">{formatDate(item.date)}</p>
                <p className="font-display text-lg font-bold">{brl(item.gross_amount)}</p>
                <p className="text-xs text-emerald-100/60">
                  {km(item.km_driven)}
                  {item.hours_worked ? ` · ${item.hours_worked}h` : ""} · {item.atingida ? "Meta atingida" : `Faltam ${brl(item.faltam)}`}
                </p>
              </div>
              <button type="button" onClick={() => remove(item.id)} className="text-rose-300">
                <Trash2 size={18} />
              </button>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
