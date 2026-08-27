import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";

function formatWhen(iso) {
  if (!iso) return "Ainda não sincronizou";
  return new Date(iso).toLocaleString("pt-BR");
}

export default function Uber() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api.uber
      .status()
      .then(setStatus)
      .catch((err) => setError(err.message));

  useEffect(() => {
    if (params.get("ok")) setInfo("Conta Uber conectada.");
    if (params.get("erro") === "negado") setError("Você recusou a autorização na Uber.");
    if (params.get("erro") === "falha") setError("Não foi possível concluir a conexão com a Uber.");
    if (params.get("erro") === "sem_codigo") setError("A Uber não devolveu o código de autorização.");
    load();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const data = await api.uber.connect();
      window.location.assign(data.authorize_url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    try {
      await api.uber.disconnect();
      await load();
      setInfo("Conta Uber desconectada.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!status && !error) {
    return <p className="pt-10 text-center text-emerald-100/60">Carregando integração...</p>;
  }

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
          Integração
        </p>
        <h1 className="font-display text-2xl font-bold">
          {connected ? "Uber conectada ✅" : "Conectar Uber"}
        </h1>
        <p className="text-sm text-emerald-100/70">
          {connected
            ? "Sua conta Uber está ligada a este aplicativo. Os tokens ficam só no servidor."
            : "Conecte sua conta Uber para importar automaticamente seus ganhos e corridas."}
        </p>
        {status?.mock && (
          <p className="rounded-2xl bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            Modo MOCK ativo: a Uber real não é chamada. Use isso para testar o fluxo de conexão.
          </p>
        )}
      </section>

      {connected ? (
        <section className="card space-y-3">
          <div>
            <p className="label">Motorista</p>
            <p className="font-display text-lg font-bold">{status.driver_name || "Nome não informado"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-emerald-100/60">Status</p>
              <p className="font-semibold capitalize">{status.activation_status || status.status}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3">
              <p className="text-emerald-100/60">Última sincronização</p>
              <p className="font-semibold">{formatWhen(status.last_sync_at)}</p>
            </div>
          </div>
          {info && <p className="text-sm text-lime">{info}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button type="button" className="btn-ghost w-full" disabled>
            Sincronizar agora (próxima etapa)
          </button>
          <button type="button" className="btn-ghost w-full" onClick={disconnect} disabled={busy}>
            {busy ? "Desconectando..." : "Desconectar Uber"}
          </button>
        </section>
      ) : (
        <section className="card space-y-3">
          {info && <p className="text-sm text-lime">{info}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" type="button" onClick={connect} disabled={busy}>
            {busy ? "Abrindo Uber..." : "🚗 Conectar conta Uber"}
          </button>
        </section>
      )}

      <Link to="/" className="block text-center text-sm font-semibold text-lime">
        Voltar ao início
      </Link>
    </div>
  );
}
