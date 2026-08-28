import { useMemo, useState } from "react";
import { Fuel } from "lucide-react";
import { brl } from "../utils/format.js";
import { compararEtanolGasolina, loadFuelPrices, saveFuelPrices } from "../utils/fuel.js";
import { moneyFieldProps } from "../utils/validate.js";

export default function FuelComparator() {
  const saved = loadFuelPrices();
  const [etanol, setEtanol] = useState(saved.etanol);
  const [gasolina, setGasolina] = useState(saved.gasolina);

  const resultado = useMemo(() => compararEtanolGasolina(etanol, gasolina), [etanol, gasolina]);

  const onEtanol = (value) => {
    setEtanol(value);
    saveFuelPrices(value, gasolina);
  };
  const onGasolina = (value) => {
    setGasolina(value);
    saveFuelPrices(etanol, value);
  };

  return (
    <section className="card space-y-3">
      <div className="flex items-start gap-2">
        <Fuel size={18} className="mt-0.5 shrink-0 text-lime" />
        <div>
          <h2 className="font-display font-semibold">Etanol ou gasolina?</h2>
          <p className="text-sm text-emerald-100/70">
            A regra dos 70%: etanol vale se custar menos de 70% da gasolina.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Etanol (R$/L)</label>
          <input
            {...moneyFieldProps}
            step="0.001"
            className="field"
            placeholder="3,49"
            value={etanol}
            onChange={(e) => onEtanol(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Gasolina (R$/L)</label>
          <input
            {...moneyFieldProps}
            step="0.001"
            className="field"
            placeholder="5,19"
            value={gasolina}
            onChange={(e) => onGasolina(e.target.value)}
          />
        </div>
      </div>
      {resultado.vantajoso ? (
        <div
          className={`rounded-2xl p-3 ${
            resultado.vantajoso === "etanol" ? "bg-lime/15" : "bg-amber-400/10"
          }`}
        >
          <p className="text-sm font-bold">
            {resultado.vantajoso === "etanol" ? "Abasteça com etanol" : "Abasteça com gasolina"}
          </p>
          <p className="mt-1 text-xs text-emerald-100/70">
            Etanol está a {resultado.pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do
            preço da gasolina
            {etanol && gasolina
              ? ` (${brl(etanol)} ÷ ${brl(gasolina)}). Corte: 70%.`
              : "."}
          </p>
        </div>
      ) : (
        <p className="text-xs text-emerald-100/60">
          Informe os dois preços do posto da sua região.
        </p>
      )}
    </section>
  );
}
