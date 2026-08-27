import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import GoalBanner from "../components/GoalBanner.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, formatDate, km, todayISO } from "../utils/format.js";

export default function Ganhos() {
  const { year, month } = useMonth();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState({
    date: todayISO(),
    gross_amount: "",
    km_driven: "",
    notes: "",
  });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const rows = await api.ganhos.list(year, month);
    setLista(rows);
    const hoje = rows.find((item) => item.date === todayISO());
    if (hoje) {
      setStatus(hoje);
      setForm({
        date: hoje.date,
        gross_amount: String(hoje.gross_amount),
        km_driven: String(hoje.km_driven || ""),
        notes: hoje.notes || "",
      });
    } else {
      const metas = await api.metas.calculo(year, month);
      setStatus({
        gross_amount: 0,
        meta_diaria: metas.meta_bruta_diaria,
        faltam: metas.meta_bruta_diaria,
        atingida: false,
        progresso_pct: 0,
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
    try {
      const saved = await api.ganhos.save({
        date: form.date,
        gross_amount: Number(form.gross_amount || 0),
        km_driven: Number(form.km_driven || 0),
        notes: form.notes || null,
      });
      setStatus(saved);
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Valor bruto (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
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
              type="number"
              min="0"
              step="0.1"
              className="field"
              placeholder="0"
              value={form.km_driven}
              onChange={(e) => setForm({ ...form, km_driven: e.target.value })}
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
                  {km(item.km_driven)} · {item.atingida ? "Meta atingida" : `Faltam ${brl(item.faltam)}`}
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
