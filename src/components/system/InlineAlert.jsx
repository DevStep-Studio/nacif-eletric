import React from "react";
import { Info, AlertTriangle, AlertCircle, CheckCircle2, X } from "lucide-react";

export default function InlineAlert({
  type = "info", // "info" | "warning" | "error" | "success"
  title = null,
  children,
  action = null,
  onDismiss = null,
  className = "",
}) {
  const styles = {
    info: {
      container: "bg-[#F8FAFC] border-[#E2E8F0] text-[#334155]",
      icon: Info,
      iconColor: "text-[#00d8b8]",
    },
    warning: {
      container: "bg-amber-50/70 border-amber-200 text-amber-900",
      icon: AlertTriangle,
      iconColor: "text-amber-600",
    },
    error: {
      container: "bg-red-50/70 border-red-200 text-red-900",
      icon: AlertCircle,
      iconColor: "text-red-600",
    },
    success: {
      container: "bg-emerald-50/70 border-emerald-200 text-emerald-900",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
    },
  }[type] || {
    container: "bg-slate-50 border-slate-200 text-slate-800",
    icon: Info,
    iconColor: "text-slate-500",
  };

  const Icon = styles.icon;

  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-xs leading-relaxed ${styles.container} ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${styles.iconColor}`} />
        <div className="min-w-0 space-y-0.5">
          {title && <p className="font-bold text-[#0F172A]">{title}</p>}
          <div className="text-[11px] sm:text-xs font-medium">{children}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] transition"
            aria-label="Fechar aviso"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
