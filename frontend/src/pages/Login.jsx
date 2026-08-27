import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event) => {
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

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-lime">
        Motorista Uber
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold">Entrar</h1>
      <p className="mt-2 text-sm text-emerald-100/70">
        Acesse sua gestão de metas, gastos e ganhos.
      </p>

      <form onSubmit={submit} className="card mt-6 space-y-3">
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
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn-primary" disabled={saving}>
          {saving ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-emerald-100/70">
        Ainda não tem conta?{" "}
        <Link to="/cadastro" className="font-bold text-lime">
          Criar usuário
        </Link>
      </p>
    </div>
  );
}
