const KEY_ETANOL = "uber_financas_preco_etanol";
const KEY_GASOLINA = "uber_financas_preco_gasolina";

export function loadFuelPrices() {
  return {
    etanol: localStorage.getItem(KEY_ETANOL) || "",
    gasolina: localStorage.getItem(KEY_GASOLINA) || "",
  };
}

export function saveFuelPrices(etanol, gasolina) {
  localStorage.setItem(KEY_ETANOL, String(etanol ?? ""));
  localStorage.setItem(KEY_GASOLINA, String(gasolina ?? ""));
}

/** Etanol vale a pena se o preço for menor que 70% da gasolina. */
export function compararEtanolGasolina(etanol, gasolina) {
  const e = Number(etanol);
  const g = Number(gasolina);
  if (!e || !g || e <= 0 || g <= 0) {
    return { ratio: null, pct: null, vantajoso: null };
  }
  const ratio = e / g;
  return {
    ratio,
    pct: ratio * 100,
    vantajoso: ratio < 0.7 ? "etanol" : "gasolina",
  };
}
