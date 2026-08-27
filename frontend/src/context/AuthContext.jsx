import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../api.js";

const AuthContext = createContext(null);
const TOKEN_KEY = "uber_financas_token";
const USER_KEY = "uber_financas_user";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  });
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
        localStorage.setItem(USER_KEY, JSON.stringify(current));
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken("");
        setUser(null);
        setAuthToken("");
      })
      .finally(() => setReady(true));
  }, [token]);

  const value = useMemo(() => {
    const saveSession = (data) => {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setAuthToken(data.access_token);
      setUser(data.user);
      setToken(data.access_token);
    };
    return {
      user,
      ready,
      login: (body) => api.auth.login(body).then(saveSession),
      requestLoginCode: (email) => api.auth.requestLoginCode({ email }),
      confirmLoginCode: (body) => api.auth.confirmLoginCode(body).then(saveSession),
      requestRegister: (body) => api.auth.register(body),
      confirmRegister: (body) => api.auth.confirmRegister(body).then(saveSession),
      resendRegister: (email) => api.auth.resendRegister({ email }),
      forgotPassword: (email) => api.auth.forgotPassword({ email }),
      verifyResetCode: (body) => api.auth.verifyResetCode(body),
      resetPassword: (body) => api.auth.resetPassword(body),
      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
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
