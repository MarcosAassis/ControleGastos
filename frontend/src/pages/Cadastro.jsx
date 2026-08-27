import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import CodeForm from "../components/CodeForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Cadastro() {
  const { user, requestRegister, confirmRegister, resendRegister } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [step, setStep] = useState("form");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const requestCode = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await requestRegister(form);
      setStep("code");
      setInfo("Enviamos um código de 6 dígitos para o seu e-mail.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const confirm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    const code = new FormData(event.currentTarget).get("code");
    try {
      await confirmRegister({ email: form.email, code });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resend = async () => {
    setSaving(true);
    setError("");
    try {
      await resendRegister(form.email);
      setInfo("Enviamos um novo código para o seu e-mail.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
        Motorista Uber
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Criar conta</h1>
      <p className="mt-2 text-sm text-emerald-100/70">
        {step === "form"
          ? "Cadastre-se para guardar sua rotina, gastos e metas."
          : "Digite o código que enviamos para confirmar o e-mail."}
      </p>

      {step === "form" ? (
        <form onSubmit={requestCode} className="card mt-6 space-y-3">
          <div>
            <label className="label">Nome</label>
            <input
              className="field"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
            />
          </div>
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
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Enviando código..." : "Enviar código"}
          </button>
        </form>
      ) : (
        <CodeForm
          email={form.email}
          title="Confirmar e-mail"
          description="Olhe a caixa de entrada e o spam. O código vale por 10 minutos."
          submitLabel="Criar conta"
          onSubmit={confirm}
          onResend={resend}
          saving={saving}
          error={error}
          info={info}
        />
      )}

      {step === "code" && (
        <button
          type="button"
          className="mt-4 text-center text-sm font-semibold text-lime"
          onClick={() => {
            setStep("form");
            setError("");
            setInfo("");
          }}
        >
          Voltar e alterar o e-mail
        </button>
      )}

      <p className="mt-6 text-center text-sm text-emerald-100/70">
        Já tem conta?{" "}
        <Link to="/login" className="font-bold text-lime">
          Entrar
        </Link>
      </p>
    </div>
  );
}
