import React from "react";

const actionStyles =
  "[&_a]:!h-10 [&_a]:!min-w-0 [&_a]:!justify-center [&_a]:!rounded-xl [&_a]:!px-3.5 [&_a]:!text-xs [&_a]:!font-bold [&_a]:!leading-none " +
  "[&_button]:!h-10 [&_button]:!min-w-0 [&_button]:!justify-center [&_button]:!rounded-xl [&_button]:!px-3.5 [&_button]:!text-xs [&_button]:!font-bold [&_button]:!leading-none " +
  "[&_label]:!h-10 [&_label]:!min-w-0 [&_label]:!justify-center [&_label]:!rounded-xl [&_label]:!px-3.5 [&_label]:!text-xs [&_label]:!font-bold " +
  "[&_svg]:!h-4 [&_svg]:!w-4 [&_img]:!h-5 [&>span]:!h-10 [&>span]:!min-w-12 [&>span]:!rounded-xl [&>span]:!px-2.5 [&>span]:!text-xs";

export default function PageHeader({ icon: Icon, title, subtitle, actions, actionsPlacement = "below", badge, children }) {
  const actionsRight = actions && actionsPlacement === "right";

  return (
    <header className="w-full space-y-3.5">
      <div className={`flex min-w-0 gap-3.5 ${actionsRight ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "flex-col sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="flex min-w-0 items-start gap-3.5 sm:items-center">
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#BCEFE0] bg-[#DDFCF0] text-[#006F51] shadow-xs">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="max-w-full break-words [overflow-wrap:anywhere] text-2xl font-extrabold leading-tight tracking-tight text-[#101828] sm:text-[28px]">
                {title}
              </h1>
              {badge && (
                <span className="inline-flex items-center rounded-full border border-[#BCEFE0] bg-[#DDFCF0] px-2.5 py-0.5 text-[11px] font-bold text-[#006F51]">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium leading-relaxed text-[#64748B] sm:text-sm">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && (
          <div className={`flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end ${actionStyles}`}>
            {actions}
          </div>
        )}
      </div>

      {children && (
        <div className="flex min-w-0 flex-col gap-2.5 lg:flex-row lg:items-center [&_[role=combobox]]:!h-10 [&_[role=combobox]]:!rounded-xl [&_[role=combobox]]:!border-[#E5EBF1] [&_[role=combobox]]:!text-xs [&_[role=combobox]]:!font-semibold [&_input]:!h-10 [&_input]:!rounded-xl [&_input]:!border-[#E5EBF1] [&_input]:!text-xs [&_button]:!h-10 [&_button]:!text-xs [&_button]:!font-bold">
          {children}
        </div>
      )}
    </header>
  );
}
