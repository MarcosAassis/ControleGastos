import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import CodeForm from "../components/CodeForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const SUBTITLES = {
  email: "Informe o e-mail da conta para receber um código.",
  code: "Digite o código enviado para o seu e-mail.",
  password: "Defina a nova senha e confirme para concluir.",
};

export default function RecuperarSenha() {
  const { user, forgotPassword, verifyResetCode, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [passwords, setPasswords] = useState({ password: "", password_confirm: "" });
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

  const confirmCode = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setInfo("");
    const code = new FormData(event.currentTarget).get("code");
    try {
      const data = await verifyResetCode({ email, code });
      setResetToken(data.reset_token);
      setStep("password");
      setInfo("Código confirmado. Agora defina a nova senha.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwords.password !== passwords.password_confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    setError("");
    setInfo("");
    try {
      await resetPassword({
        reset_token: resetToken,
        password: passwords.password,
        password_confirm: passwords.password_confirm,
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
      <p className="mt-2 text-sm text-emerald-100/70">{SUBTITLES[step]}</p>

      {step === "email" && (
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
      )}

      {step === "code" && (
        <CodeForm
          email={email}
          description="Olhe a caixa de entrada e o spam. O código vale por 10 minutos."
          submitLabel="Validar código"
          onSubmit={confirmCode}
          onResend={resend}
          saving={saving}
          error={error}
          info={info}
        />
      )}

      {step === "password" && (
        <form onSubmit={savePassword} className="card mt-6 space-y-3">
          <div>
            <label className="label">Nova senha</label>
            <input
              type="password"
              className="field"
              autoComplete="new-password"
              placeholder="Mínimo 6 caracteres"
              value={passwords.password}
              onChange={(e) => setPasswords({ ...passwords, password: e.target.value })}
              required
              minLength={6}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Confirmar senha</label>
            <input
              type="password"
              className="field"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              value={passwords.password_confirm}
              onChange={(e) =>
                setPasswords({ ...passwords, password_confirm: e.target.value })
              }
              required
              minLength={6}
            />
          </div>
          {info && <p className="text-sm text-lime">{info}</p>}
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <button className="btn-primary" disabled={saving}>
            {saving ? "Salvando..." : "Salvar nova senha"}
          </button>
        </form>
      )}

      {step === "code" && (
        <button
          type="button"
          className="mt-4 text-center text-sm font-semibold text-lime"
          onClick={() => {
            setStep("email");
            setError("");
            setInfo("");
          }}
        >
          Voltar e alterar o e-mail
        </button>
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
