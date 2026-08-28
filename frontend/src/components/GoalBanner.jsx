import { CheckCircle2, CircleAlert } from "lucide-react";
import { brl } from "../utils/format.js";
import ProgressBar from "./ProgressBar.jsx";

export default function GoalBanner({ ganho, meta, faltam, atingida, progresso }) {
  if (!Number(meta)) return null;
  return (
    <section
      className={`card ${
        atingida ? "goal-hit border-lime/40 shadow-glow" : "border-amber-300/20"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/70">
            Meta do dia
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{brl(ganho)}</p>
          <p className="text-sm text-emerald-100/70">de {brl(meta)}</p>
        </div>
        {atingida ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-lime/15 px-3 py-1 text-xs font-bold text-lime">
            <CheckCircle2 size={14} /> Meta atingida
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">
            <CircleAlert size={14} /> Em andamento
          </span>
        )}
      </div>
      <ProgressBar value={progresso} tone={atingida ? "lime" : "amber"} />
      <p className="mt-3 text-sm font-medium">
        {atingida
          ? "Parabéns, a meta do dia foi fechada."
          : `Faltam ${brl(faltam)} para fechar a meta do dia.`}
      </p>
    </section>
  );
}
