import React from "react";
import { motion } from "framer-motion";
import brandSymbol from "@/assets/brand-symbol-pure.png";
import { cn } from "@/lib/utils";

/**
 * Minimalist, text-free animated NACIF Energy loading indicator.
 */
export default function BrandLoadingScreen({
  fullScreen = false,
  compact = false,
  className = "",
}) {
  const containerClass = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-[#FAFCFC]/95 backdrop-blur-sm"
    : compact
      ? "flex w-full items-center justify-center py-8"
      : "flex min-h-[60vh] w-full items-center justify-center";

  const ringSize = compact ? "h-12 w-12" : "h-16 w-16";
  const logoSize = compact ? "h-6 w-6" : "h-8 w-8";

  return (
    <div
      role="status"
      aria-label="Carregando"
      className={cn(containerClass, className)}
    >
      <div className={cn("relative flex items-center justify-center", ringSize)}>
        <div className="absolute inset-0 rounded-full border-2 border-slate-200/80" />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.15, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00D8B8] border-r-[#00D8B8]/40"
        />
        <motion.img
          src={brandSymbol}
          alt=""
          animate={{ scale: [0.94, 1.04, 0.94], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className={cn("object-contain select-none pointer-events-none", logoSize)}
        />
      </div>
    </div>
  );
}
