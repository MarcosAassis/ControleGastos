import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, PartyPopper, X } from "lucide-react";
import { setApiToastHandler } from "../api.js";

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [party, setParty] = useState(null);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((type, message) => {
    const text = String(message || "").trim();
    if (!text) return;
    const id = ++toastId;
    setToasts((list) => [...list.slice(-3), { id, type, message: text }]);
    window.setTimeout(() => dismiss(id), type === "error" ? 5000 : 3200);
  }, [dismiss]);

  const celebrate = useCallback((payload) => {
    const kind = payload?.kind || "day";
    const key = payload?.key || "default";
    const storageKey = `uber_financas_celeb_${kind}_${key}`;
    if (sessionStorage.getItem(storageKey)) return;
    sessionStorage.setItem(storageKey, "1");
    setParty({
      kind,
      title: payload.title,
      subtitle: payload.subtitle,
    });
    window.setTimeout(() => setParty(null), 3800);
  }, []);

  useEffect(() => {
    setApiToastHandler((event) => {
      if (event.type === "success") push("success", event.message);
      if (event.type === "error") push("error", event.message);
    });
    return () => setApiToastHandler(null);
  }, [push]);

  const value = useMemo(
    () => ({
      success: (message) => push("success", message),
      error: (message) => push("error", eventMessage(message)),
      celebrate,
    }),
    [push, celebrate],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 print:hidden">
        {toasts.map((item) => (
          <div
            key={item.id}
            className={`pointer-events-auto flex w-full max-w-lg items-start gap-2 rounded-2xl border px-3 py-3 text-sm shadow-lg ${
              item.type === "error"
                ? "border-rose-400/30 bg-night-800 text-rose-100"
                : "border-lime/30 bg-night-800 text-emerald-50"
            }`}
          >
            {item.type === "error" ? (
              <CircleAlert size={18} className="mt-0.5 shrink-0 text-rose-300" />
            ) : (
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-lime" />
            )}
            <p className="min-w-0 flex-1 font-medium">{item.message}</p>
            <button
              type="button"
              className="text-emerald-100/50"
              onClick={() => dismiss(item.id)}
              aria-label="Fechar aviso"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      {party && <GoalBurst party={party} onClose={() => setParty(null)} />}
    </ToastContext.Provider>
  );
}

function eventMessage(message) {
  return message instanceof Error ? message.message : message;
}

function GoalBurst({ party, onClose }) {
  const bits = Array.from({ length: 18 }, (_, index) => index);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-night-950/55 px-6 print:hidden">
      <div className="celebrate-burst pointer-events-none absolute inset-0 overflow-hidden">
        {bits.map((item) => (
          <span
            key={item}
            className="celebrate-bit"
            style={{
              left: `${6 + (item * 5.2) % 88}%`,
              animationDelay: `${item * 0.04}s`,
              background: item % 3 === 0 ? "#3ddc84" : item % 3 === 1 ? "#fbbf24" : "#34d399",
            }}
          />
        ))}
      </div>
      <div className="celebrate-card relative w-full max-w-sm rounded-3xl border border-lime/40 bg-night-800 p-6 text-center shadow-glow">
        <PartyPopper className="mx-auto text-lime" size={36} />
        <p className="mt-3 font-display text-2xl font-bold">{party.title}</p>
        <p className="mt-2 text-sm text-emerald-100/75">{party.subtitle}</p>
        <button type="button" className="btn-primary mt-5" onClick={onClose}>
          Fechar
        </button>
      </div>
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast precisa estar dentro de ToastProvider");
  return ctx;
}
