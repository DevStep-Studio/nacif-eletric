import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function MetricCard({
  icon: Icon,
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

  const cardInner = (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex h-[62px] w-full items-center gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-3.5 py-2.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-all duration-150 hover:border-[#CBEAD9] hover:shadow-[0_4px_12px_rgba(3,25,35,0.05)]",
        onClick && "cursor-pointer",
        className
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E1FCEF] text-[#00A86B] transition-transform duration-150 group-hover:scale-105">
        {Icon && <Icon className="h-[17px] w-[17px] stroke-[2.1]" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[17px] font-extrabold tracking-tight text-[#101828] tabular-nums leading-tight">
            {value}
          </span>

          {delta?.hasComparison && delta?.label ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                deltaColor
              )}
            >
              {delta.direction === "up" ? "↑ " : delta.direction === "down" ? "↓ " : "— "}
              {delta.label}
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748B] leading-tight">
          {label}
        </p>
      </div>
    </Component>
  );

  if (!hint) return cardInner;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cardInner}</TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}
