const API_BASE = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function getStoredToken() {
  return (
    localStorage.getItem("uber_financas_token") ||
    sessionStorage.getItem("uber_financas_token") ||
    ""
  );
}

export function clearStoredAuth() {
  localStorage.removeItem("uber_financas_token");
  localStorage.removeItem("uber_financas_user");
  sessionStorage.removeItem("uber_financas_token");
  sessionStorage.removeItem("uber_financas_user");
}

let authToken = getStoredToken();
const getCache = new Map();
let toastHandler = null;

export function setAuthToken(token) {
  authToken = token || "";
}

export function setApiToastHandler(handler) {
  toastHandler = handler;
}

export function invalidateApiCache() {
  getCache.clear();
}

function notify(type, message) {
  if (toastHandler && message) toastHandler({ type, message });
}

function friendlyNetworkError(error) {
  const raw = String(error?.message || error || "");
  if (
    error?.name === "TypeError" ||
    /failed to fetch|networkerror|load failed|network request failed/i.test(raw)
  ) {
    return "Sem conexão no momento. Confira a internet e tente de novo.";
  }
  if (/abort/i.test(raw)) {
    return "A requisição foi interrompida. Tente de novo.";
  }
  return raw || "Não foi possível concluir a operação.";
}

function successMessage(method, path) {
  if (method === "DELETE") {
    if (path.includes("/metas")) return "Meta padrão restaurada.";
    return "Registro removido.";
  }
  if (path.includes("/pagamento")) return "Pagamento atualizado.";
  if (path.includes("/rotina/dia")) return "Dia da rotina atualizado.";
  if (path.includes("/rotina")) return "Rotina salva.";
  if (path.includes("/auth/me")) return "Chave PIX salva.";
  if (path.includes("/ganhos")) return "Ganho salvo.";
  if (path.includes("/gastos-variaveis")) return "Gasto lançado.";
  if (path.includes("/gastos-fixos")) return "Conta salva.";
  return "Salvo com sucesso.";
}

async function request(path, options = {}) {
  const { silent = false, cache = true, okMessage, headers: extraHeaders, ...fetchOptions } = options;
  const method = String(fetchOptions.method || "GET").toUpperCase();
  const isGet = method === "GET";

  if (isGet && cache && getCache.has(path)) {
    return getCache.get(path);
  }

  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch (error) {
    const message = friendlyNetworkError(error);
    if (!silent) notify("error", message);
    throw new Error(message);
  }

  if (response.status === 204) {
    if (!isGet) invalidateApiCache();
    if (!silent && !isGet) notify("success", okMessage || successMessage(method, path));
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : {};

  if (response.status === 401) {
    clearStoredAuth();
    invalidateApiCache();
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
    if (!silent && !isGet && response.status !== 401) notify("error", message);
    throw new Error(message);
  }

  if (!contentType.includes("application/json")) {
    const message =
      "Não foi possível falar com a API. Confira se o backend está no ar e se VITE_API_URL aponta para ele.";
    if (!silent) notify("error", message);
    throw new Error(message);
  }

  if (isGet && cache) {
    getCache.set(path, data);
  } else if (!isGet) {
    invalidateApiCache();
    if (!silent) notify("success", okMessage || successMessage(method, path));
  }

  return data;
}

const qs = (year, month) => `ano=${year}&mes=${month}`;
const silent = { silent: true };

export const api = {
  auth: {
    register: (body) =>
      request("/api/auth/register", { method: "POST", body: JSON.stringify(body), ...silent }),
    resendRegister: (body) =>
      request("/api/auth/register/resend", { method: "POST", body: JSON.stringify(body), ...silent }),
    confirmRegister: (body) =>
      request("/api/auth/register/confirm", { method: "POST", body: JSON.stringify(body), ...silent }),
    login: (body) =>
      request("/api/auth/login", { method: "POST", body: JSON.stringify(body), ...silent }),
    requestLoginCode: (body) =>
      request("/api/auth/login/code", { method: "POST", body: JSON.stringify(body), ...silent }),
    confirmLoginCode: (body) =>
      request("/api/auth/login/confirm", { method: "POST", body: JSON.stringify(body), ...silent }),
    forgotPassword: (body) =>
      request("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body), ...silent }),
    verifyResetCode: (body) =>
      request("/api/auth/reset-password/verify", {
        method: "POST",
        body: JSON.stringify(body),
        ...silent,
      }),
    resetPassword: (body) =>
      request("/api/auth/reset-password", { method: "POST", body: JSON.stringify(body), ...silent }),
    me: () => request("/api/auth/me", silent),
    savePix: (body) =>
      request("/api/auth/me", { method: "PUT", body: JSON.stringify(body), okMessage: "Chave PIX salva." }),
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
    config: (y, m) => request(`/api/metas/config?${qs(y, m)}`),
    saveConfig: (body, y, m) =>
      request(`/api/metas/config?${qs(y, m)}`, { method: "PUT", body: JSON.stringify(body) }),
    resetConfig: (y, m) =>
      request(`/api/metas/config?${qs(y, m)}`, { method: "DELETE" }),
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
    create: (body, extra = {}) =>
      request("/api/gastos-variaveis", { method: "POST", body: JSON.stringify(body), ...extra }),
    remove: (id) => request(`/api/gastos-variaveis/${id}`, { method: "DELETE" }),
  },
  ganhos: {
    list: (y, m) => request(`/api/ganhos?${qs(y, m)}`),
    save: (body) => request("/api/ganhos", { method: "POST", body: JSON.stringify(body) }),
    remove: (id) => request(`/api/ganhos/${id}`, { method: "DELETE" }),
  },
};
