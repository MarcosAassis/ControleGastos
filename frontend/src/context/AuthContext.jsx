import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearStoredAuth, getStoredToken, setAuthToken } from "../api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "uber_financas_token";
const USER_KEY = "uber_financas_user";
const STORAGE_TYPE_KEY = "uber_financas_storage_type";

function getStorage() {
  const type = localStorage.getItem(STORAGE_TYPE_KEY) || sessionStorage.getItem(STORAGE_TYPE_KEY);
  return type === "session" ? sessionStorage : localStorage;
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getStoredToken());
  const [user, setUser] = useState(() => getStoredUser());
  const [ready, setReady] = useState(!token);

  useEffect(() => {
    setAuthToken(token);
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }
    api.auth
      .me()
      .then((current) => {
        setUser(current);
        const storage = getStorage();
        storage.setItem(USER_KEY, JSON.stringify(current));
      })
      .catch(() => {
        clearStoredAuth();
        localStorage.removeItem(STORAGE_TYPE_KEY);
        sessionStorage.removeItem(STORAGE_TYPE_KEY);
        setToken("");
        setUser(null);
        setAuthToken("");
      })
      .finally(() => setReady(true));
  }, [token]);

  const value = useMemo(() => {
    const saveSession = (data, rememberMe = true) => {
      if (!data?.access_token || !data.user) {
        throw new Error("A API não devolveu uma sessão válida. Tente entrar de novo.");
      }
      clearStoredAuth();
      localStorage.removeItem(STORAGE_TYPE_KEY);
      sessionStorage.removeItem(STORAGE_TYPE_KEY);

      const targetStorage = rememberMe ? localStorage : sessionStorage;
      targetStorage.setItem(TOKEN_KEY, data.access_token);
      targetStorage.setItem(USER_KEY, JSON.stringify(data.user));
      targetStorage.setItem(STORAGE_TYPE_KEY, rememberMe ? "local" : "session");

      setAuthToken(data.access_token);
      setUser(data.user);
      setToken(data.access_token);
    };

    return {
      user,
      ready,
      login: (body) => {
        const rememberMe = body?.remember_me !== false;
        return api.auth.login(body).then((data) => saveSession(data, rememberMe));
      },
      requestLoginCode: (email) => api.auth.requestLoginCode({ email }),
      confirmLoginCode: (body) => {
        const rememberMe = body?.remember_me !== false;
        return api.auth.confirmLoginCode(body).then((data) => saveSession(data, rememberMe));
      },
      requestRegister: (body) => api.auth.register(body),
      confirmRegister: (body) => {
        const rememberMe = body?.remember_me !== false;
        return api.auth.confirmRegister(body).then((data) => saveSession(data, rememberMe));
      },
      resendRegister: (email) => api.auth.resendRegister({ email }),
      forgotPassword: (email) => api.auth.forgotPassword({ email }),
      verifyResetCode: (body) => api.auth.verifyResetCode(body),
      resetPassword: (body) => api.auth.resetPassword(body),
      logout: () => {
        clearStoredAuth();
        localStorage.removeItem(STORAGE_TYPE_KEY);
        sessionStorage.removeItem(STORAGE_TYPE_KEY);
        setAuthToken("");
        setToken("");
        setUser(null);
      },
    };
  }, [user, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de AuthProvider");
  return ctx;
}
