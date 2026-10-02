import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Sparkles, Wrench, X } from "lucide-react";

export default function SystemBanner({
  id = "default-system-banner",
  type = "info", // "info" | "warning" | "error" | "maintenance" | "success"
  message,
  actionLabel = "Saiba mais",
  actionTo = null,
  onAction = null,
  dismissible = true,
  className = "",
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(`banner_dismissed_${id}`) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed || !message) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(`banner_dismissed_${id}`, "true");
    } catch {}
  };

  const config = {
    info: {
      bg: "bg-[#0F172A] text-white",
      icon: Info,
      iconColor: "text-[#00d8b8]",
      btnClass: "bg-white/10 hover:bg-white/20 text-white",
    },
    warning: {
      bg: "bg-amber-600 text-white",
      icon: AlertTriangle,
      iconColor: "text-amber-200",
      btnClass: "bg-black/20 hover:bg-black/30 text-white",
    },
    maintenance: {
      bg: "bg-[#0f4f49] text-white",
      icon: Wrench,
      iconColor: "text-[#00d8b8]",
      btnClass: "bg-white/10 hover:bg-white/20 text-white",
    },
    error: {
      bg: "bg-red-600 text-white",
      icon: AlertCircle,
      iconColor: "text-red-200",
      btnClass: "bg-black/20 hover:bg-black/30 text-white",
    },
    success: {
      bg: "bg-emerald-700 text-white",
      icon: CheckCircle2,
      iconColor: "text-emerald-200",
      btnClass: "bg-white/10 hover:bg-white/20 text-white",
    },
  }[type] || {
    bg: "bg-[#0F172A] text-white",
    icon: Info,
    iconColor: "text-[#00d8b8]",
    btnClass: "bg-white/10 hover:bg-white/20 text-white",
  };

  const Icon = config.icon;

  return (
    <div className={`relative flex min-w-0 items-center justify-between gap-3 px-4 py-2 text-xs font-bold shadow-xs ${config.bg} ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0 mx-auto">
        <Icon className={`h-4 w-4 shrink-0 ${config.iconColor}`} />
        <span className="truncate text-xs font-medium">{message}</span>
        {actionTo && (
          <Link
            to={actionTo}
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold transition ${config.btnClass}`}
          >
            {actionLabel}
          </Link>
        )}
        {onAction && !actionTo && (
          <button
            type="button"
            onClick={onAction}
            className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-extrabold transition ${config.btnClass}`}
          >
            {actionLabel}
          </button>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 text-white/70 hover:text-white transition shrink-0"
          aria-label="Dispensar aviso"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
