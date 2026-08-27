export default function CodeForm({
  email,
  title,
  description,
  submitLabel,
  extraFields,
  onSubmit,
  onResend,
  saving,
  error,
  info,
}) {
  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-3">
      <div>
        <label className="label">Código enviado para</label>
        <p className="rounded-2xl border border-white/10 bg-night-950/70 px-4 py-3 text-sm text-emerald-100">
          {email}
        </p>
      </div>
      <div>
        <label className="label">Código de 6 dígitos</label>
        <input
          name="code"
          className="field tracking-[0.4em] text-center text-lg"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          minLength={6}
          pattern="[0-9]{6}"
          required
          autoFocus
        />
      </div>
      {extraFields}
      {info && <p className="text-sm text-lime">{info}</p>}
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <button className="btn-primary" disabled={saving}>
        {saving ? "Validando..." : submitLabel}
      </button>
      <button
        type="button"
        className="btn-ghost w-full"
        disabled={saving}
        onClick={onResend}
      >
        Reenviar código
      </button>
      <p className="text-center text-xs text-emerald-100/60">{description}</p>
    </form>
  );
}
