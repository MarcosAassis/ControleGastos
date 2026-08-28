const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

let authToken = localStorage.getItem("uber_financas_token") || "";

export function setAuthToken(token) {
  authToken = token || "";
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem("uber_financas_token");
    localStorage.removeItem("uber_financas_user");
    if (!path.startsWith("/api/auth/")) {
      window.location.assign("/login");
    }
  }
  if (!response.ok) {
    const detail = data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((item) => item.msg || item).join(" ")
          : "Não foi possível concluir a operação.";
    throw new Error(message);
  }
  return data;
}

const qs = (year, month) => `ano=${year}&mes=${month}`;

export const api = {
  auth: {
    register: (body) =>
      request("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    resendRegister: (body) =>
      request("/api/auth/register/resend", { method: "POST", body: JSON.stringify(body) }),
    confirmRegister: (body) =>
      request("/api/auth/register/confirm", { method: "POST", body: JSON.stringify(body) }),
    login: (body) =>
      request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    requestLoginCode: (body) =>
      request("/api/auth/login/code", { method: "POST", body: JSON.stringify(body) }),
    confirmLoginCode: (body) =>
      request("/api/auth/login/confirm", { method: "POST", body: JSON.stringify(body) }),
    forgotPassword: (body) =>
      request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
    verifyResetCode: (body) =>
      request("/api/auth/reset-password/verify", { method: "POST", body: JSON.stringify(body) }),
    resetPassword: (body) =>
      request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
    me: () => request("/api/auth/me"),
  },
  dashboard: (y, m) => request(`/api/dashboard?${qs(y, m)}`),
  historico: (y, m) => request(`/api/dashboard/historico?${qs(y, m)}`),
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
