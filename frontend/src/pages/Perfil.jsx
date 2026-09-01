import { useEffect, useMemo, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import PixQr from "../components/PixQr.jsx";
import { api } from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { moneyFieldProps, parseAmount } from "../utils/validate.js";
import { PIX_KEY_TYPES, buildPixPayload, pixKeyError, sanitizePixKey } from "../utils/pix.js";

export default function Perfil() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({
    pix_key: "",
    pix_key_type: "cpf",
    pix_name: "",
    pix_city: "",
  });
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setForm({
      pix_key: user.pix_key || "",
      pix_key_type: user.pix_key_type || "cpf",
      pix_name: user.pix_name || user.name || "",
      pix_city: user.pix_city || "",
    });
  }, [user]);

  const key = sanitizePixKey(form.pix_key_type, form.pix_key);
  const merchant = form.pix_name || user?.name || "";
  const openPayload = useMemo(
    () =>
      key
        ? buildPixPayload({
            key,
            name: merchant,
            city: form.pix_city,
          })
        : "",
    [key, merchant, form.pix_city],
  );
  const valuedPayload = useMemo(() => {
    const parsed = parseAmount(amount, { min: 0.01, label: "valor" });
    if (!key || !parsed.ok) return "";
    return buildPixPayload({
      key,
      name: merchant,
      city: form.pix_city,
      amount: parsed.value,
    });
  }, [key, merchant, form.pix_city, amount]);

  const savePix = async (event) => {
    event.preventDefault();
    const cleaned = sanitizePixKey(form.pix_key_type, form.pix_key);
    const keyErr = pixKeyError(form.pix_key_type, cleaned);
    if (keyErr) {
      setError(keyErr);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await api.auth.savePix({
        pix_key: cleaned,
        pix_key_type: form.pix_key_type,
        pix_name: form.pix_name,
        pix_city: form.pix_city,
      });
      setUser(saved);
    } catch {
      /* toast global */
    } finally {
      setSaving(false);
    }
  };

  const copy = async (payload, kind) => {
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o código e copie na mão.");
    }
  };

  return (
    <div className="space-y-4">
      <section className="card space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">Perfil</p>
        <h2 className="font-display text-lg font-semibold">{user?.name}</h2>
        <p className="text-sm text-emerald-100/70">{user?.email}</p>
      </section>

      <form onSubmit={savePix} className="card space-y-3">
        <div className="flex items-start gap-2">
          <QrCode size={18} className="mt-0.5 shrink-0 text-lime" />
          <div>
            <h2 className="font-display font-semibold">PIX para receber</h2>
            <p className="text-sm text-emerald-100/70">
              Salve sua chave uma vez. O QR aberto fica pronto para qualquer valor; o outro você
              gera na hora com o valor combinado.
            </p>
          </div>
        </div>

        <div>
          <label className="label">Tipo da chave</label>
          <select
            className="field"
            value={form.pix_key_type}
            onChange={(e) => setForm({ ...form, pix_key_type: e.target.value, pix_key: "" })}
          >
            {PIX_KEY_TYPES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Chave PIX</label>
          <input
            className="field"
            value={form.pix_key}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
            placeholder={
              form.pix_key_type === "email"
                ? "email@exemplo.com"
                : form.pix_key_type === "phone"
                  ? "(11) 99999-9999"
                  : form.pix_key_type === "evp"
                    ? "chave-aleatoria"
                    : "Somente números"
            }
            required
          />
        </div>
        <div>
          <label className="label">Nome no comprovante</label>
          <input
            className="field"
            maxLength={25}
            value={form.pix_name}
            onChange={(e) => setForm({ ...form, pix_name: e.target.value })}
            placeholder="Como aparece no PIX"
          />
        </div>
        <div>
          <label className="label">Cidade</label>
          <input
            className="field"
            maxLength={15}
            value={form.pix_city}
            onChange={(e) => setForm({ ...form, pix_city: e.target.value })}
            placeholder="São Paulo"
          />
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar chave PIX"}
        </button>
      </form>

      {openPayload ? (
        <>
          <section className="card space-y-3">
            <h3 className="font-display font-semibold">QR aberto — sempre reutilizável</h3>
            <p className="text-sm text-emerald-100/70">
              Sem valor fixo. Quem pagar informa o valor no banco.
            </p>
            <PixQr payload={openPayload} />
            <button
              type="button"
              className="btn-ghost flex w-full items-center justify-center gap-2"
              onClick={() => copy(openPayload, "open")}
            >
              <Copy size={16} />
              {copied === "open" ? "Copiado" : "Copiar PIX (sem valor)"}
            </button>
          </section>

          <section className="card space-y-3">
            <h3 className="font-display font-semibold">QR com valor</h3>
            <p className="text-sm text-emerald-100/70">
              Use quando já combinou o valor. O QR muda a cada valor novo.
            </p>
            <div>
              <label className="label">Valor (R$)</label>
              <input
                {...moneyFieldProps}
                className="field"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            {valuedPayload ? (
              <>
                <PixQr payload={valuedPayload} />
                <button
                  type="button"
                  className="btn-ghost flex w-full items-center justify-center gap-2"
                  onClick={() => copy(valuedPayload, "value")}
                >
                  <Copy size={16} />
                  {copied === "value" ? "Copiado" : "Copiar PIX com valor"}
                </button>
              </>
            ) : (
              <p className="text-sm text-emerald-100/50">Digite um valor para gerar o QR.</p>
            )}
          </section>
        </>
      ) : (
        <p className="card text-sm text-emerald-100/70">
          Salve a chave PIX para gerar os QR Codes.
        </p>
      )}
    </div>
  );
}
