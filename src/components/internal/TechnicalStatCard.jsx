import { cn } from "@/lib/utils";

const TONE_MAP = {
  default: {
    card: "border-[#E5EBF1] bg-white",
    iconBox: "bg-[#E5FBF2] text-[#006B50]",
    value: "text-[#101828]",
  },
  warning: {
    card: "border-amber-200 bg-white",
    iconBox: "bg-[#FFF3E6] text-amber-700",
    value: "text-[#101828]",
  },
  danger: {
    card: "border-red-200 bg-[#FEF2F2]/40",
    iconBox: "bg-red-50 text-[#EF4444]",
    value: "text-red-700",
  },
};

/**
 * Card compacto de indicador técnico para páginas internas (sem gradientes e sem barras laterais).
 */
export default function TechnicalStatCard({
  icon: Icon,
  label,
  value,
  subtext,
  tone = "default",
  className = "",
}) {
  const styles = TONE_MAP[tone] || TONE_MAP.default;

  return (
    <div
      className={cn(
        "flex h-full min-h-[82px] items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition hover:border-[#CBEAD9]",
        styles.card,
        className
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          styles.iconBox
        )}
      >
        {Icon && <Icon className="h-[18px] w-[18px] stroke-[2.1]" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-[#64748B] leading-tight">
          {label}
        </p>
        <p className={cn("mt-0.5 text-[18px] font-extrabold tracking-tight tabular-nums leading-tight", styles.value)}>
          {value}
        </p>
        {subtext && (
          <p className="mt-1 text-[11px] font-medium text-[#64748B] leading-snug">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
