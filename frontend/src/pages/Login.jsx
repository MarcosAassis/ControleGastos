import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import CodeForm from "../components/CodeForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function emailOk(value) {
  const email = String(value || "").trim();
  return email.includes("@") && email.includes(".");
}

export default function Login() {
  const { user, login, requestLoginCode, confirmLoginCode } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("password");
  const [form, setForm] = useState({ email: "", password: "", remember_me: true });
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submitPassword = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await login(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const sendCodeTo = async (email) => {
    if (!emailOk(email)) {
      setMode("code");
      setCodeSent(false);
      setError("Informe o e-mail da conta para receber o código.");
      return;
    }
    setMode("code");
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await requestLoginCode(email);
      setCodeSent(true);
      setInfo("Enviamos um código de 6 dígitos para o e-mail informado.");
    } catch (err) {
      setCodeSent(false);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmCode = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    const code = new FormData(event.currentTarget).get("code");
    try {
      await confirmLoginCode({ email: form.email, code, remember_me: form.remember_me });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    await sendCodeTo(form.email);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
        Motorista Uber
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-emerald-100/70">
        Acesse sua gestão de metas, gastos e ganhos.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-night-800 p-1">
        <button
          type="button"
          className={`rounded-xl py-2 text-sm font-bold ${
            mode === "password" ? "bg-lime text-night-950" : "text-emerald-100/70"
          }`}
          onClick={() => {
            setMode("password");
            setCodeSent(false);
            setError("");
            setInfo("");
          }}
        >
          Senha
        </button>
        <button
          type="button"
          className={`rounded-xl py-2 text-sm font-bold ${
            mode === "code" ? "bg-lime text-night-950" : "text-emerald-100/70"
          }`}
          disabled={saving}
          onClick={() => sendCodeTo(form.email)}
        >
          Código no e-mail
        </button>
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="card mt-4 space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="field"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Senha</label>
            <input
              type="password"
              className="field"
              autoComplete="current-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-emerald-100/90 select-none">
            <input
              type="checkbox"
              checked={form.remember_me}
              onChange={(e) => setForm({ ...form, remember_me: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-night-950 text-lime focus:ring-lime focus:ring-offset-0"
            />
            <span>Mantenha-me conectado</span>
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Entrando..." : "Entrar"}
          </button>
          <p className="text-center text-sm">
            <Link to="/recuperar-senha" className="font-semibold text-lime">
              Esqueci a senha
            </Link>
          </p>
        </form>
      ) : codeSent ? (
        <CodeForm
          email={form.email}
          description="Olhe a caixa de entrada e o spam. O código vale por 10 minutos."
          submitLabel="Entrar"
          onSubmit={confirmCode}
          onResend={resend}
          saving={saving}
          error={error}
          info={info}
          extraFields={
            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-emerald-100/90 select-none">
              <input
                type="checkbox"
                checked={form.remember_me}
                onChange={(e) => setForm({ ...form, remember_me: e.target.checked })}
                className="h-4 w-4 rounded border-white/20 bg-night-950 text-lime focus:ring-lime focus:ring-offset-0"
              />
              <span>Mantenha-me conectado</span>
            </label>
          }
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            sendCodeTo(form.email);
          }}
          className="card mt-4 space-y-3"
        >
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="field"
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              autoFocus
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-emerald-100/90 select-none">
            <input
              type="checkbox"
              checked={form.remember_me}
              onChange={(e) => setForm({ ...form, remember_me: e.target.checked })}
              className="h-4 w-4 rounded border-white/20 bg-night-950 text-lime focus:ring-lime focus:ring-offset-0"
            />
            <span>Mantenha-me conectado</span>
          </label>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Enviando..." : "Enviar código"}
          </button>
        </form>
      )}

      {mode === "code" && codeSent && (
        <button
          type="button"
          className="mt-4 text-center text-sm font-semibold text-lime"
          onClick={() => {
            setCodeSent(false);
            setError("");
            setInfo("");
          }}
        >
          Usar outro e-mail
        </button>
      )}

      <p className="mt-6 text-center text-sm text-emerald-100/70">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-bold text-lime">
          Criar usuário
        </Link>
      </p>
    </div>
  );
}
