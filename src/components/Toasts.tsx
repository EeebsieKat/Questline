import { useApp } from "../lib/store";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

export function Toasts() {
  const toasts = useApp((s) => s.toasts);
  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="panel-surface rounded-xl px-3.5 py-2.5 text-sm shadow-xl flex items-center gap-2 fade-in max-w-sm"
        >
          {t.kind === "success" ? (
            <CheckCircle2 size={15} className="text-lime-400 shrink-0" />
          ) : t.kind === "error" ? (
            <AlertTriangle size={15} className="text-red-400 shrink-0" />
          ) : (
            <Info size={15} className="text-accent2 shrink-0" />
          )}
          <span className="text-ink">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
