import React from "react";

const actionStyles = "[&_a]:!h-10 [&_a]:!min-w-0 [&_a]:!justify-center [&_a]:!rounded-[11px] [&_a]:!px-3 [&_a]:!text-sm [&_a]:!font-extrabold [&_a]:!leading-none [&_button]:!h-10 [&_button]:!min-w-0 [&_button]:!justify-center [&_button]:!rounded-[11px] [&_button]:!px-3 [&_button]:!text-sm [&_button]:!font-extrabold [&_button]:!leading-none [&_label]:!h-10 [&_label]:!min-w-0 [&_label]:!justify-center [&_label]:!rounded-[11px] [&_label]:!px-3 [&_label]:!text-sm [&_label]:!font-extrabold [&_svg]:!h-4 [&_svg]:!w-4 [&_img]:!h-5 [&>span]:!h-10 [&>span]:!min-w-12 [&>span]:!rounded-[11px] [&>span]:!px-2 [&>span]:!text-xs";

export default function PageHeader({ icon: Icon, title, subtitle, actions, actionsPlacement = "below", children }) {
  const actionsRight = actions && actionsPlacement === "right";

  return (
    <header className="w-full space-y-3">
      <div className={`flex min-w-0 gap-3 ${actionsRight ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "items-start sm:items-center"}`}>
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          {Icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary ring-1 ring-primary/10 sm:h-11 sm:w-11">
              <Icon className="h-[18px] w-[18px]" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="max-w-full break-words [overflow-wrap:anywhere] text-[22px] font-extrabold leading-[1.08] tracking-normal text-[#0f1728] sm:text-[28px] lg:text-[32px]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-semibold leading-4 text-[#687386] sm:text-[13px]">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actionsRight && (
          <div className={`flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end ${actionStyles}`}>
            {actions}
          </div>
        )}
      </div>

      {actions && !actionsRight && (
        <div className={`grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center ${actionStyles}`}>
          {actions}
        </div>
      )}

      {children && (
        <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center [&_[role=combobox]]:!h-10 [&_[role=combobox]]:!rounded-[12px] [&_[role=combobox]]:!text-sm [&_input]:!h-10 [&_input]:!rounded-[12px] [&_input]:!text-sm [&>div]:!rounded-[12px] [&>div]:!text-sm [&>div]:!shadow-none [&_button]:!h-10 [&_button]:!text-sm [&_button]:!font-bold">
          {children}
        </div>
      )}
    </header>
  );
}
