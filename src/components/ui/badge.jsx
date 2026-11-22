import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#DDFCF0] text-[#006F51] hover:bg-[#c5f9e5]",
        secondary:
          "border-[#E5EBF1] bg-[#F6F9FC] text-[#101828] hover:bg-slate-100",
        destructive:
          "border-red-200 bg-red-50 text-[#EF4444] hover:bg-red-100",
        ai:
          "border-[#5B4AE8]/25 bg-[#5B4AE8]/10 text-[#5B4AE8] hover:bg-[#5B4AE8]/15",
        outline: "border-[#E5EBF1] text-[#101828] bg-white",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
