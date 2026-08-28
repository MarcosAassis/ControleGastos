import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "../api.js";
import EmptyState from "../components/EmptyState.jsx";
import FuelCard from "../components/FuelCard.jsx";
import FuelComparator from "../components/FuelComparator.jsx";
import { useMonth } from "../context/MonthContext.jsx";
import { brl, formatDate, todayISO } from "../utils/format.js";
import { moneyFieldProps, parseAmount, parseOptionalAmount } from "../utils/validate.js";

const emptyFill = {
  date: todayISO(),
  description: "",
  amount: "",
  liters: "",
  odometer_km: "",
  fuel_kind: "gasolina",
};

export default function Combustivel() {
  const { year, month } = useMonth();
  const [fills, setFills] = useState([]);
  const [consumo, setConsumo] = useState(null);
  const [form, setForm] = useState(emptyFill);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [vars, dash] = await Promise.all([
      api.gastosVariaveis.list(year, month),
      api.dashboard(year, month),
    ]);
    setFills((vars || []).filter((item) => (item.type || "").toLowerCase() === "combustivel"));
    setConsumo(dash.combustivel);
  };

  useEffect(() => {
    load().catch(console.error);
  }, [year, month]);

  const precoLitro = useMemo(() => {
    const amount = Number(String(form.amount).replace(",", "."));
    const liters = Number(String(form.liters).replace(",", "."));
    if (!amount || !liters || amount <= 0 || liters <= 0) return null;
    return amount / liters;
  }, [form.amount, form.liters]);

  const submit = async (event) => {
    event.preventDefault();
    const amount = parseAmount(form.amount, { required: true, min: 0.01, label: "valor" });
    const liters = parseOptionalAmount(form.liters, { label: "litros" });
    const odometer = parseOptionalAmount(form.odometer_km, { label: "odômetro" });
    if (!amount.ok || !liters.ok || !odometer.ok) {
      setError(amount.error || liters.error || odometer.error);
      return;
    }
    if (!form.date) {
      setError("Informe a data do abastecimento.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.gastosVariaveis.create(
        {
          date: form.date,
          type: "combustivel",
          description: form.description,
          amount: amount.value,
          liters: liters.value,
          odometer_km: odometer.value,
          fuel_kind: form.fuel_kind,
        },
        { okMessage: "Abastecimento lançado." },
      );
      setForm({ ...emptyFill, date: todayISO() });
      await load();
    } catch {
      /* toast global */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="card">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
          Combustível do mês
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-lime">
          {brl(consumo?.gasto || 0)}
        </p>
        <p className="mt-1 text-sm text-emerald-100/70">
          Lance o abastecimento com litros e odômetro para ver km/l e R$/km.
        </p>
      </section>

      <FuelCard consumo={consumo} alwaysShow />

      <form onSubmit={submit} className="card space-y-3">
        <h2 className="font-display font-semibold">Novo abastecimento</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "gasolina", label: "Gasolina" },
            { id: "etanol", label: "Etanol" },
          ].map((kind) => (
            <button
              type="button"
              key={kind.id}
              className={`rounded-xl py-2.5 text-sm font-bold ${
                form.fuel_kind === kind.id ? "bg-lime text-night-950" : "bg-white/5"
              }`}
              onClick={() => setForm({ ...form, fuel_kind: kind.id })}
            >
              {kind.label}
            </button>
          ))}
        </div>
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
        <div>
          <label className="label">Valor pago (R$)</label>
          <input
            {...moneyFieldProps}
            className="field"
            placeholder="0,00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Litros</label>
            <input
              {...moneyFieldProps}
              className="field"
              placeholder="Opcional"
              value={form.liters}
              onChange={(e) => setForm({ ...form, liters: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Odômetro (km)</label>
            <input
              {...moneyFieldProps}
              step="0.1"
              className="field"
              placeholder="Opcional"
              value={form.odometer_km}
              onChange={(e) => setForm({ ...form, odometer_km: e.target.value })}
            />
          </div>
        </div>
        {precoLitro != null && (
          <p className="rounded-2xl bg-lime/10 px-3 py-2 text-sm">
            Preço deste abastecimento:{" "}
            <span className="font-bold text-lime">{brl(precoLitro)}/L</span>
          </p>
        )}
        <div>
          <label className="label">Posto ou observação</label>
          <input
            className="field"
            placeholder="Opcional"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {error && <p className="field-error">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Salvando..." : "Lançar abastecimento"}
        </button>
      </form>

      <FuelComparator />

      <section className="space-y-3">
        <h2 className="font-display font-semibold">Abastecimentos do mês</h2>
        {fills.length === 0 ? (
          <EmptyState
            title="Nenhum abastecimento"
            text="Registre o valor do posto. Litros e odômetro melhoram o cálculo de km/l."
          />
        ) : (
          fills.map((item) => (
            <article key={item.id} className="card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{item.description || labelKind(item.fuel_kind)}</p>
                <p className="text-xs text-emerald-100/60">
                  {formatDate(item.date)}
                  {item.fuel_kind ? ` · ${labelKind(item.fuel_kind)}` : ""}
                  {item.liters ? ` · ${Number(item.liters).toLocaleString("pt-BR")} L` : ""}
                  {item.odometer_km
                    ? ` · ${Number(item.odometer_km).toLocaleString("pt-BR")} km`
                    : ""}
                </p>
                {(item.price_per_liter || item.km_per_liter || item.rs_per_km) && (
                  <p className="mt-1 text-xs text-emerald-100/70">
                    {item.price_per_liter != null ? `${brl(item.price_per_liter)}/L` : ""}
                    {item.km_per_liter
                      ? ` · ${Number(item.km_per_liter).toLocaleString("pt-BR")} km/l`
                      : ""}
                    {item.rs_per_km != null ? ` · ${brl(item.rs_per_km)}/km` : ""}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
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
      </section>
    </div>
  );
}

function labelKind(kind) {
  if (kind === "etanol") return "Etanol";
  if (kind === "gasolina") return "Gasolina";
  return "Combustível";
}
