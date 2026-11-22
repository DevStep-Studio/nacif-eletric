import React from "react";

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export function formatProjectStatusLabel(status) {
  if (!status) return "Planejamento";
  const norm = normalizeText(status).replace(/-/g, "_");

  if (norm.includes("concluid")) return "Concluído";
  if (norm.includes("aprovad")) return "Aprovado";
  if (norm.includes("andamento")) return "Em andamento";
  if (norm.includes("planejamento")) return "Planejamento";
  if (norm.includes("espera") || norm.includes("pendent")) return "Pendente revisão";
  if (norm.includes("analise")) return "Em análise";
  if (norm.includes("arquivad")) return "Arquivado";
  if (norm.includes("cancelad")) return "Cancelado";
  if (norm.includes("rascunho") || norm.includes("draft")) return "Rascunho";

  const cleaned = String(status).replace(/_/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function getProjectStatusConfig(status) {
  const norm = normalizeText(status).replace(/-/g, "_");

  if (norm.includes("concluid") || norm.includes("aprovad")) {
    return {
      label: norm.includes("aprovad") ? "Aprovado" : "Concluído",
      badgeStyle: "bg-[#DDFCF0] text-[#006F51] border-[#B2F5DA]",
      dotStyle: "bg-[#00D98A]",
      ping: false,
    };
  }

  if (norm.includes("andamento")) {
    return {
      label: "Em andamento",
      badgeStyle: "bg-[#DDFCF0] text-[#006F51] border-[#A7F3D0]",
      dotStyle: "bg-[#00D98A]",
      ping: true,
    };
  }

  if (norm.includes("planejamento")) {
    return {
      label: "Planejamento",
      badgeStyle: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
      dotStyle: "bg-[#3B82F6]",
      ping: false,
    };
  }

  if (norm.includes("espera") || norm.includes("pendent") || norm.includes("analise")) {
    return {
      label: norm.includes("analise") ? "Em análise" : "Pendente revisão",
      badgeStyle: "bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]",
      dotStyle: "bg-[#F59E0B]",
      ping: false,
    };
  }

  if (norm.includes("arquivad") || norm.includes("cancelad")) {
    return {
      label: norm.includes("cancelad") ? "Cancelado" : "Arquivado",
      badgeStyle: "bg-slate-100 text-slate-500 border-slate-200",
      dotStyle: "bg-slate-400",
      ping: false,
    };
  }

  return {
    label: formatProjectStatusLabel(status),
    badgeStyle: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
    dotStyle: "bg-[#3B82F6]",
    ping: false,
  };
}

export default function ProjectStatusBadge({
  status,
  size = "md",
  className = "",
}) {
  const config = getProjectStatusConfig(status);

  const sizeStyles = {
    sm: "px-2.5 py-0.5 text-[11px] gap-1.5 rounded-full",
    md: "px-3 py-1 text-xs gap-1.5 rounded-full",
    lg: "px-3.5 py-1.5 text-xs gap-2 rounded-full",
  }[size] || "px-3 py-1 text-xs gap-1.5 rounded-full";

  return (
    <span
      className={`inline-flex items-center font-semibold tracking-tight border select-none transition-all ${config.badgeStyle} ${sizeStyles} ${className}`}
    >
      <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
        {config.ping && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${config.dotStyle}`}
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
