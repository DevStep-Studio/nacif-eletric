import React from "react";

/**
 * Normaliza qualquer texto removendo acentos e convertendo para minúsculas
 */
const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

/**
 * Retorna o rótulo legível e formal em Português
 */
export function formatProjectStatusLabel(status) {
  if (!status) return "Rascunho";
  const norm = normalizeText(status).replace(/-/g, "_");

  if (norm.includes("concluid")) return "Concluído";
  if (norm.includes("aprovad")) return "Aprovado";
  if (norm.includes("andamento")) return "Em andamento";
  if (norm.includes("espera") || norm.includes("pendent")) return "Pendente revisão";
  if (norm.includes("analise")) return "Em análise";
  if (norm.includes("arquivad")) return "Arquivado";
  if (norm.includes("cancelad")) return "Cancelado";
  if (norm.includes("rascunho") || norm.includes("draft")) return "Rascunho";

  // Fallback: remove underscores e capitaliza
  const cleaned = String(status).replace(/_/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Retorna a paleta visual refinada de cada status
 */
export function getProjectStatusConfig(status) {
  const norm = normalizeText(status).replace(/-/g, "_");

  if (norm.includes("concluid") || norm.includes("aprovad")) {
    return {
      label: norm.includes("aprovad") ? "Aprovado" : "Concluído",
      badgeStyle: "bg-emerald-50/90 text-emerald-800 border-emerald-200/90 shadow-[0_1px_2px_rgba(16,185,129,0.06)]",
      dotStyle: "bg-emerald-500",
      ping: false,
    };
  }

  if (norm.includes("andamento")) {
    return {
      label: "Em andamento",
      badgeStyle: "bg-[#E8FCF8] text-[#007a68] border-[#BCEEE5] shadow-[0_1px_2px_rgba(0,216,184,0.08)]",
      dotStyle: "bg-[#00d8b8]",
      ping: true,
    };
  }

  if (norm.includes("espera") || norm.includes("pendent") || norm.includes("analise")) {
    return {
      label: norm.includes("analise") ? "Em análise" : "Pendente revisão",
      badgeStyle: "bg-amber-50/90 text-amber-800 border-amber-200/90 shadow-[0_1px_2px_rgba(245,158,11,0.06)]",
      dotStyle: "bg-amber-500",
      ping: false,
    };
  }

  if (norm.includes("arquivad") || norm.includes("cancelad")) {
    return {
      label: norm.includes("cancelad") ? "Cancelado" : "Arquivado",
      badgeStyle: "bg-slate-50 text-slate-500 border-slate-200/80",
      dotStyle: "bg-slate-400",
      ping: false,
    };
  }

  // Padrão / Rascunho
  return {
    label: formatProjectStatusLabel(status),
    badgeStyle: "bg-slate-100/80 text-slate-700 border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
    dotStyle: "bg-slate-400",
    ping: false,
  };
}

/**
 * Componente oficial de Tag/Badge de Status de Projetos
 * - Substitui strings cruas como `em_andamento` por rótulos humanos ("Em andamento")
 * - Inclui ponto luminoso indicador com micro-pulso para projetos ativos
 * - Tipografia nítida e proporção equilibrada
 */
export default function ProjectStatusBadge({
  status,
  size = "md",
  className = "",
}) {
  const config = getProjectStatusConfig(status);

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1 rounded-full",
    md: "px-2.5 py-1 text-[11px] gap-1.5 rounded-full",
    lg: "px-3 py-1.5 text-xs gap-2 rounded-full",
  }[size] || "px-2.5 py-1 text-[11px] gap-1.5 rounded-full";

  return (
    <span
      className={`inline-flex items-center font-bold tracking-tight border select-none transition-all ${config.badgeStyle} ${sizeStyles} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        {config.ping && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping ${config.dotStyle}`}
          />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${config.dotStyle}`}
        />
      </span>
      <span className="leading-none whitespace-nowrap">{config.label}</span>
    </span>
  );
}
