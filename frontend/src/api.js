async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Não foi possível concluir a operação.");
  }
  return data;
}

const qs = (year, month) => `ano=${year}&mes=${month}`;

export const api = {
  dashboard: (y, m) => request(`/api/dashboard?${qs(y, m)}`),
  rotina: {
    get: (y, m) => request(`/api/rotina?${qs(y, m)}`),
    save: (body, y, m) =>
      request(`/api/rotina?${qs(y, m)}`, { method: "PUT", body: JSON.stringify(body) }),
    toggleDia: (isoDate) =>
      request("/api/rotina/dia", {
        method: "PATCH",
        body: JSON.stringify({ date: isoDate }),
      }),
  },
  metas: {
    config: () => request("/api/metas/config"),
    saveConfig: (body) =>
      request("/api/metas/config", { method: "PUT", body: JSON.stringify(body) }),
    calculo: (y, m) => request(`/api/metas/calculo?${qs(y, m)}`),
  },
  gastosFixos: {
    list: (y, m) => request(`/api/gastos-fixos?${qs(y, m)}`),
    create: (body, y, m) =>
      request(`/api/gastos-fixos?${qs(y, m)}`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    update: (id, body, y, m) =>
      request(`/api/gastos-fixos/${id}?${qs(y, m)}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    remove: (id) => request(`/api/gastos-fixos/${id}`, { method: "DELETE" }),
    pagar: (id, body) =>
      request(`/api/gastos-fixos/${id}/pagamento`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  gastosVariaveis: {
    list: (y, m) => request(`/api/gastos-variaveis?${qs(y, m)}`),
    create: (body) =>
      request("/api/gastos-variaveis", { method: "POST", body: JSON.stringify(body) }),
    remove: (id) => request(`/api/gastos-variaveis/${id}`, { method: "DELETE" }),
  },
  ganhos: {
    list: (y, m) => request(`/api/ganhos?${qs(y, m)}`),
    save: (body) => request("/api/ganhos", { method: "POST", body: JSON.stringify(body) }),
    remove: (id) => request(`/api/ganhos/${id}`, { method: "DELETE" }),
  },
};
