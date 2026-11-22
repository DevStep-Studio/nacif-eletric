import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function MetricCard({
  icon: Icon,
  iconBg = "bg-[#DDFCF0]",
  iconColor = "text-[#006F51]",
  value,
  label,
  hint,
  delta,
  className = "",
  onClick,
}) {
  const Component = onClick ? "button" : "div";

  const deltaColor =
    delta?.direction === "up"
      ? "bg-[#DDFCF0] text-[#006F51]"
      : delta?.direction === "down"
      ? "bg-red-50 text-[#EF4444]"
      : "bg-[#F6F9FC] text-[#64748B]";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3.5 rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-[0_6px_16px_rgba(3,25,35,0.06)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105",
          iconBg,
          iconColor
        )}
      >
        {Icon && <Icon className="h-5 w-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-lg sm:text-xl font-extrabold tracking-tight text-[#101828] tabular-nums">
            {value}
          </span>

          {delta?.hasComparison && delta?.label ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                deltaColor
              )}
            >
              {delta.direction === "up" ? "↑ " : delta.direction === "down" ? "↓ " : "— "}
              {delta.label}
            </span>
          ) : null}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5">
          <p className="truncate text-xs font-medium text-[#64748B]">{label}</p>
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex h-3.5 w-3.5 shrink-0 cursor-help items-center justify-center rounded-full bg-[#F1F5F9] text-[9px] font-bold text-[#64748B] hover:bg-[#E5EBF1]"
                >
                  ?
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </Component>
  );
}
