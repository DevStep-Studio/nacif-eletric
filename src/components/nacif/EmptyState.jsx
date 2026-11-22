import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
  secondaryLabel,
  secondaryTo,
  onSecondary,
  className = "",
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#00D98A]/45 bg-[#F6F9FC]/70 px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#DDFCF0] text-[#006F51]">
          <Icon className="h-6 w-6" />
        </div>
      )}
      {title && <h3 className="text-base font-extrabold text-[#101828]">{title}</h3>}
      {description && (
        <p className="mt-1.5 max-w-md text-xs font-medium leading-relaxed text-[#64748B]">
          {description}
        </p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && (
            actionTo ? (
              <Button
                asChild
                className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-bold text-[#031923] hover:bg-[#00C47C]"
              >
                <Link to={actionTo}>{actionLabel}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onAction}
                className="h-9 rounded-xl bg-[#00D98A] px-4 text-xs font-bold text-[#031923] hover:bg-[#00C47C]"
              >
                {actionLabel}
              </Button>
            )
          )}
          {secondaryLabel && (
            secondaryTo ? (
              <Button
                asChild
                variant="outline"
                className="h-9 rounded-xl border-[#E5EBF1] bg-white px-4 text-xs font-semibold text-[#101828] hover:bg-[#F6F9FC]"
              >
                <Link to={secondaryTo}>{secondaryLabel}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onSecondary}
                className="h-9 rounded-xl border-[#E5EBF1] bg-white px-4 text-xs font-semibold text-[#101828] hover:bg-[#F6F9FC]"
              >
                {secondaryLabel}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
