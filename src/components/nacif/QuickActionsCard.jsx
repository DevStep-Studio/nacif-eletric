import { Link } from "react-router-dom";
import { BookOpen, Calculator, GitBranch, LayoutGrid, Zap } from "lucide-react";

export default function QuickActionsCard({ activeProjectId = null }) {
  const unifilarPath = activeProjectId ? `/unifilar?project=${activeProjectId}` : "/unifilar";
  const plantaPath = activeProjectId ? `/planta-ia?project=${activeProjectId}` : "/planta-ia";

  const tiles = [
    {
      title: "Planta elétrica",
      subtitle: "Desenhe e posicione cargas",
      to: plantaPath,
      icon: LayoutGrid,
      bg: "bg-[#E8FDF3] hover:bg-[#DCFBE9]",
      border: "border-[#C7F3DE]",
      iconBg: "bg-[#00D98A]/24 text-[#007A52]",
    },
    {
      title: "Calculadora",
      subtitle: "Dimensionamentos rápidos",
      to: "/calculator",
      icon: Calculator,
      bg: "bg-[#F4F0FF] hover:bg-[#ECE6FE]",
      border: "border-[#E1D8FE]",
      iconBg: "bg-[#6D4AE8]/16 text-[#5B4AE8]",
    },
    {
      title: "Diagrama unifilar",
      subtitle: "Gere seu diagrama",
      to: unifilarPath,
      icon: GitBranch,
      bg: "bg-[#EDF5FF] hover:bg-[#E1EEFE]",
      border: "border-[#CFE3FE]",
      iconBg: "bg-[#3B82F6]/16 text-[#2563EB]",
    },
    {
      title: "Consultar NBR",
      subtitle: "Acesse normas técnicas",
      to: "/nbr-library",
      icon: BookOpen,
      bg: "bg-[#FFF8E6] hover:bg-[#FEF1CF]",
      border: "border-[#FDE4B4]",
      iconBg: "bg-[#F59E0B]/22 text-[#B45309]",
    },
  ];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="mb-2 flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#00A86B]" />
        <h3 className="text-[14px] font-bold text-[#101828]">Ações rápidas</h3>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.title}
              to={tile.to}
              className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-all duration-150 ${tile.bg} ${tile.border}`}
            >
              <span
                className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${tile.iconBg}`}
              >
                <Icon className="h-4 w-4 stroke-[2.1]" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11.5px] font-bold text-[#101828] leading-tight">{tile.title}</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-[#64748B] leading-tight">
                  {tile.subtitle}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
