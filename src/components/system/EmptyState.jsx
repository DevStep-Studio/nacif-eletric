import { Link } from "react-router-dom";
import { FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EmptyState({
  icon: Icon = FolderOpen,
  title = "Nenhum item encontrado",
  description = "Comece criando seu primeiro registro para visualizá-lo aqui.",
  actionLabel = "Criar novo",
  actionTo = null,
  onAction = null,
  secondaryActionLabel = null,
  secondaryActionTo = null,
  onSecondaryAction = null,
  className = "",
  compact = false,
}) {
  return (
    <div
      className={`mx-auto flex w-full flex-col items-center justify-center text-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white ${
        compact ? "p-6" : "p-10 sm:p-12"
      } ${className}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#0f4f49] mb-4">
        <Icon className="h-6 w-6 text-[#00d8b8]" />
      </div>

      <h3 className="text-base font-extrabold text-[#0F172A] mb-1.5">
        {title}
      </h3>

      <p className="text-xs sm:text-sm font-medium text-[#64748B] max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionTo ? (
              <Button asChild className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-4 shadow-sm">
                <Link to={actionTo}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {actionLabel}
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onAction}
                className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-4 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                {actionLabel}
              </Button>
            )
          )}

          {secondaryActionLabel && (
            secondaryActionTo ? (
              <Button asChild variant="outline" className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-4">
                <Link to={secondaryActionTo}>{secondaryActionLabel}</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={onSecondaryAction}
                className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#64748B] hover:text-[#0F172A] px-4"
              >
                {secondaryActionLabel}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
