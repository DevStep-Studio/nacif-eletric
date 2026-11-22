import { Download, FolderOpen, HardDrive, LayoutTemplate, Sparkles, Users } from "lucide-react";
import { FEATURE_KEYS } from "@/lib/subscriptionPlans";
import { cn } from "@/lib/utils";

const ICONS = {
  [FEATURE_KEYS.PROJECTS]: FolderOpen,
  [FEATURE_KEYS.STORAGE_MB]: HardDrive,
  [FEATURE_KEYS.TEAM_MEMBERS]: Users,
  [FEATURE_KEYS.EXPORTS]: Download,
  [FEATURE_KEYS.AI_SCANS]: Sparkles,
  [FEATURE_KEYS.CUSTOM_TEMPLATES]: LayoutTemplate,
};

const STATE_CONFIG = {
  normal: {
    badge: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]",
    badgeText: "Normal",
    iconBox: "bg-[#E5FBF2] text-[#006B50]",
    bar: "#00D98A",
  },
  near: {
    badge: "border-amber-200 bg-[#FFF3E6] text-amber-800",
    badgeText: "Próximo do limite",
    iconBox: "bg-[#FFF3E6] text-amber-700",
    bar: "#F59E0B",
  },
  limit: {
    badge: "border-red-200 bg-[#FEF2F2] text-[#EF4444]",
    badgeText: "Limite atingido",
    iconBox: "bg-[#FEF2F2] text-[#EF4444]",
    bar: "#EF4444",
  },
  unlimited: {
    badge: "border-[#BEEAD2] bg-[#E5FBF2] text-[#006B50]",
    badgeText: "Ilimitado",
    iconBox: "bg-[#E5FBF2] text-[#006B50]",
    bar: "#00D98A",
  },
  unavailable: {
    badge: "border-[#E5EBF1] bg-[#F6F9FC] text-[#64748B]",
    badgeText: "Indisponível",
    iconBox: "bg-[#F6F9FC] text-[#64748B]",
    bar: "#CBD5E1",
  },
};

/**
 * Barra limpa de progresso para métricas de consumo (nunca exibe progresso falso para cota zerada).
 */
export function UsageProgress({ percent = 0, barColor = "#00D98A" }) {
  const safePct = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EEF2F6]">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${safePct}%`, backgroundColor: barColor }}
      />
    </div>
  );
}

/**
 * Card compacto de consumo por recurso do plano.
 */
export default function UsageMetricCard({ row, description }) {
  const Icon = ICONS[row.key] || FolderOpen;
  const style = STATE_CONFIG[row.state] || STATE_CONFIG.normal;
  const isUnlimited = row.limit === Number.POSITIVE_INFINITY;
  const isZeroLimit = !isUnlimited && row.limit <= 0;

  return (
    <div
      className={cn(
        "min-w-0 flex flex-col justify-between rounded-2xl border bg-white p-4 transition",
        row.state === "limit"
          ? "border-red-200"
          : row.state === "near"
          ? "border-amber-200"
          : "border-[#E5EBF1]"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", style.iconBox)}>
            <Icon className="h-4 w-4 stroke-[2.1]" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold leading-snug text-[#101828]">{row.label}</p>
            {description && (
              <p className="mt-0.5 text-[11px] font-medium leading-snug text-[#64748B]">
                {description}
              </p>
            )}
          </div>
        </div>

        <span
          className={cn(
            "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap",
            style.badge
          )}
        >
          {style.badgeText}
        </span>
      </div>

      <div className="mt-3.5 space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          {isZeroLimit ? (
            <span className="font-bold text-[#101828] tabular-nums">
              {row.used > 0 ? `${row.usedLabel} em uso` : "Sem uso registrado"}
            </span>
          ) : isUnlimited ? (
            <span className="font-extrabold text-[#101828] tabular-nums">
              {row.usedLabel} {row.used === 1 ? "utilizado" : "utilizados"}
            </span>
          ) : (
            <span className="font-extrabold text-[#101828] tabular-nums">
              {row.usedLabel} <span className="font-semibold text-[#64748B]">de {row.limitLabel}</span>
            </span>
          )}

          <span className="text-[11px] font-semibold text-[#64748B] tabular-nums shrink-0">
            {isZeroLimit
              ? "Sem cota"
              : isUnlimited
              ? "Ilimitado"
              : `${row.percent}%`}
          </span>
        </div>

        <UsageProgress
          percent={isUnlimited ? 100 : isZeroLimit ? 0 : row.percent}
          barColor={isUnlimited ? "#BEEAD2" : style.bar}
        />

        <p className="text-[11px] font-medium leading-relaxed text-[#64748B]">
          {isZeroLimit
            ? row.used > 0
              ? row.key === FEATURE_KEYS.PROJECTS
                ? "Projetos existentes preservados; novas criações exigem plano ativo."
                : "Registros mantidos; ampliação de cota disponível mediante plano."
              : "Disponível mediante contratação de plano."
            : isUnlimited
            ? "Utilização livre sem limite numérico neste plano."
            : row.remaining > 0
            ? `${row.remainingLabel} ${row.key === FEATURE_KEYS.PROJECTS || row.key === FEATURE_KEYS.EXPORTS || row.key === FEATURE_KEYS.AI_SCANS ? "disponíveis" : "livres"}`
            : "Limite da cota atingido neste período"}
        </p>
      </div>
    </div>
  );
}
