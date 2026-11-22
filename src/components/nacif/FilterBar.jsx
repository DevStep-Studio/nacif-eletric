import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FilterBar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  tabs = [],
  activeTab,
  onTabChange,
  rightSlot = null,
  className = "",
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border border-[#E5EBF1] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => {
          const active = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange?.(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                active
                  ? "bg-[#031923] text-white shadow-xs"
                  : "text-[#64748B] hover:bg-[#F6F9FC] hover:text-[#101828]"
              )}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums",
                    active ? "bg-[#00D98A] text-[#031923]" : "bg-[#F1F5F9] text-[#64748B]"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {typeof onSearchChange === "function" && (
          <div className="relative flex-1 sm:w-60 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] pl-8.5 pr-8 text-xs font-medium text-[#101828] placeholder:text-[#94A3B8] focus:border-[#00D98A] focus:bg-white focus:outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#101828]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
        {rightSlot}
      </div>
    </div>
  );
}
