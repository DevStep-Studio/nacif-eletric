import React from "react";
import { motion } from "framer-motion";

/**
 * BrandLoadingScreen
 * 
 * Componente oficial de loading do Nacif Energy com estética sofisticada,
 * anéis duplos de rotação na cor da marca (#00d8b8), símbolo central animado
 * e barra de progresso com varredura luminosa.
 */
export default function BrandLoadingScreen({
  message = "Carregando módulo Nacif Energy...",
  subtitle = "Preparando recursos e dados do sistema",
  fullScreen = false,
  className = "",
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-6 text-center select-none ${
        fullScreen
          ? "fixed inset-0 z-50 bg-[#FAFCFC]/95 backdrop-blur-md"
          : "min-h-[60vh] w-full"
      } ${className}`}
    >
      <div className="relative flex items-center justify-center mb-5">
        {/* Glow de fundo turquesa suave */}
        <div className="absolute -inset-4 rounded-full bg-gradient-to-tr from-[#00d8b8]/20 via-[#00d8b8]/10 to-transparent blur-xl animate-pulse" />

        {/* Anéis de Alta Precisão & Órbita */}
        <div className="relative w-20 h-20 sm:w-22 sm:h-22 flex items-center justify-center">
          {/* Anel Externo Primário */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00d8b8] border-r-[#00d8b8]/40"
          />

          {/* Anel Secundário Contra-rotativo */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-1.5 rounded-full border border-transparent border-b-[#00bda1]/60 border-l-[#00d8b8]/25"
          />

          {/* Emblema Central com o Símbolo Oficial Nacif Energy */}
          <motion.div
            animate={{ scale: [0.97, 1.03, 0.97] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-white shadow-[0_4px_20px_rgba(0,216,184,0.18)] border border-slate-100/90 flex items-center justify-center p-2.5"
          >
            <img
              src="/favicon.png"
              alt="Nacif Energy"
              className="w-full h-full object-contain"
            />
          </motion.div>
        </div>
      </div>

      {/* Identidade e Mensagem */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center space-y-1.5 max-w-sm"
      >
        <div className="flex items-center gap-1.5 text-[11px] font-black tracking-wider uppercase text-slate-800">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00d8b8] animate-ping" />
          <span>NACIF ENERGY</span>
        </div>

        <p className="text-sm font-bold text-slate-700">
          {message}
        </p>

        {subtitle && (
          <p className="text-xs text-slate-400 font-medium">
            {subtitle}
          </p>
        )}

        {/* Linha Shimmer com Varredura Fluida */}
        <div className="mt-3 w-32 h-1 bg-slate-100 rounded-full overflow-hidden relative">
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            className="w-1/2 h-full bg-gradient-to-r from-transparent via-[#00d8b8] to-transparent rounded-full"
          />
        </div>
      </motion.div>
    </div>
  );
}
