import { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Sparkles, Zap } from "lucide-react";
import { api } from "../api.js";
import { brl, km, todayISO } from "../utils/format.js";

export default function QuickEarningCard({ hoje, metas, onSaved }) {
  const [isOpen, setIsOpen] = useState(!hoje?.tem_lancamento);
  const [grossAmount, setGrossAmount] = useState(
    hoje?.ganho ? String(hoje.ganho) : ""
  );
  const [kmDriven, setKmDriven] = useState(
    hoje?.km ? String(hoje.km) : ""
  );
  const [hoursWorked, setHoursWorked] = useState(
    hoje?.horas !== null && hoje?.horas !== undefined
      ? String(hoje.horas)
      : metas?.horas_por_dia
      ? String(metas.horas_por_dia)
      : "8"
  );
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (hoje?.tem_lancamento) {
      setGrossAmount(hoje.ganho ? String(hoje.ganho) : "");
      setKmDriven(hoje.km ? String(hoje.km) : "");
      if (hoje.horas !== null && hoje.horas !== undefined) {
        setHoursWorked(String(hoje.horas));
      }
    } else if (metas?.horas_por_dia && !hoursWorked) {
      setHoursWorked(String(metas.horas_por_dia));
    }
  }, [hoje, metas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      await api.ganhos.save({
        date: todayISO(),
        gross_amount: Number(grossAmount || 0),
        km_driven: Number(kmDriven || 0),
        hours_worked: hoursWorked !== "" ? Number(hoursWorked) : null,
      });
      setSuccessMsg("Turno de hoje registrado com sucesso!");
      if (onSaved) {
        await onSaved();
      }
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setError(err.message || "Erro ao salvar lançamento rápido.");
    } finally {
      setSaving(false);
    }
  };

  const applyRoutineHours = () => {
    if (metas?.horas_por_dia) {
      setHoursWorked(String(metas.horas_por_dia));
    }
  };

  return (
    <section className="card border-lime/30 bg-gradient-to-b from-night-800 to-night-900 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime/15 text-lime">
            <Zap size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold">Lançamento Rápido</h2>
              {hoje?.tem_lancamento && (
                <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                  <CheckCircle2 size={11} /> Registrado
                </span>
              )}
            </div>
            <p className="text-xs text-emerald-100/70">Fim de turno do dia atual</p>
          </div>
        </div>

        {hoje?.tem_lancamento && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-xs font-semibold text-lime transition hover:text-lime-dim"
          >
            {isOpen ? (
              <>
                Fechar <ChevronUp size={14} />
              </>
            ) : (
              <>
                Editar <ChevronDown size={14} />
              </>
            )}
          </button>
        )}
      </div>

      {/* Resumo compacto quando já preenchido e fechado */}
      {!isOpen && hoje?.tem_lancamento && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/5 p-3 text-sm">
          <div>
            <p className="text-[11px] text-emerald-100/60">Faturamento hoje</p>
            <p className="font-display font-bold text-lime">{brl(hoje.ganho)}</p>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-emerald-100/60">Quilometragem</p>
            <p className="font-bold">{km(hoje.km)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-emerald-100/60">Horas rodadas</p>
            <p className="font-bold">{hoje.horas ? `${hoje.horas} h` : "—"}</p>
          </div>
        </div>
      )}

      {/* Formulário expandido de lançamento rápido */}
      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label text-xs font-medium">Faturamento bruto (R$)</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="field py-2 text-base font-bold text-lime placeholder-emerald-100/30"
                  placeholder="0,00"
                  value={grossAmount}
                  onChange={(e) => setGrossAmount(e.target.value)}
                  required
                  autoFocus={!hoje?.tem_lancamento}
                />
              </div>
            </div>

            <div>
              <label className="label text-xs font-medium">Km rodados</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="field mt-1 py-2 text-sm font-semibold placeholder-emerald-100/30"
                placeholder="Ex: 150"
                value={kmDriven}
                onChange={(e) => setKmDriven(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="label text-xs font-medium">Horas trabalhadas</label>
                {metas?.horas_por_dia && (
                  <button
                    type="button"
                    onClick={applyRoutineHours}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-lime transition hover:underline"
                    title="Preencher com horas da sua rotina padrão"
                  >
                    <Sparkles size={10} /> Sugestão ({metas.horas_por_dia}h)
                  </button>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="field py-2 text-sm font-semibold placeholder-emerald-100/30"
                  placeholder="Ex: 8"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-100/40">
                  <Clock size={13} className="inline mr-0.5 opacity-70" /> h
                </span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}
          {successMsg && (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-lime">
              <CheckCircle2 size={13} /> {successMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="btn-primary flex w-full items-center justify-center gap-2 py-2.5 text-sm font-bold shadow-glow"
          >
            {saving ? (
              "Salvando..."
            ) : hoje?.tem_lancamento ? (
              <>
                <CheckCircle2 size={16} /> Atualizar turno de hoje
              </>
            ) : (
              <>
                <Zap size={16} /> Salvar fim de turno
              </>
            )}
          </button>
        </form>
      )}
    </section>
  );
}
