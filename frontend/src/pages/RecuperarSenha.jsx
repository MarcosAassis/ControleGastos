import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import CodeForm from "../components/CodeForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function RecuperarSenha() {
  const { user, forgotPassword, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("email");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [saving, setSaving] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const requestCode = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await forgotPassword(email);
      setStep("code");
      setInfo("Se este e-mail estiver cadastrado, enviamos um código.");
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
    const data = new FormData(event.currentTarget);
    try {
      await resetPassword({
        email,
        code: data.get("code"),
        password: data.get("password"),
      });
      navigate("/login", { replace: true });
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
      await forgotPassword(email);
      setInfo("Se este e-mail estiver cadastrado, enviamos um novo código.");
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
      <h1 className="mt-2 font-display text-3xl font-bold">Recuperar senha</h1>
      <p className="mt-2 text-sm text-emerald-100/70">
        {step === "email"
          ? "Informe o e-mail da conta para receber um código."
          : "Digite o código e escolha uma nova senha."}
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="card mt-6 space-y-3">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="field"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Enviando..." : "Enviar código"}
          </button>
        </form>
      ) : (
        <CodeForm
          email={email}
          description="Olhe a caixa de entrada e o spam. O código vale por 10 minutos."
          submitLabel="Salvar nova senha"
          onSubmit={confirm}
          onResend={resend}
          saving={saving}
          error={error}
          info={info}
          extraFields={
            <div>
              <label className="label">Nova senha</label>
              <input
                name="password"
                type="password"
                className="field"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>
          }
        />
      )}

      <p className="mt-6 text-center text-sm text-emerald-100/70">
        Lembrou a senha?{" "}
        <Link to="/login" className="font-bold text-lime">
          Entrar
        </Link>
      </p>
    </div>
  );
}
