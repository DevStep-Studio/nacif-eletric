import { cn } from "@/lib/utils";

/**
 * Cabeçalho padronizado das páginas internas no padrão visual sólido da Home (sem gradientes).
 */
export default function InternalPageHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  actions,
  className = "",
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E5FBF2] text-[#006B50]">
            <Icon className="h-5 w-5 stroke-[2.1]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[21px] sm:text-[22px] font-extrabold tracking-tight text-[#101828] leading-tight">
              {title}
            </h1>
            {badge && (
              <span className="inline-flex items-center rounded-md border border-[#BEEAD2] bg-[#E5FBF2] px-2.5 py-0.5 text-[11px] font-bold text-[#006B50]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-0.5 text-xs font-medium leading-relaxed text-[#64748B]">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
