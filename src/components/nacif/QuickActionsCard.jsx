import { Link } from "react-router-dom";
import { BookOpen, Calculator, GitBranch, Plus, Zap } from "lucide-react";

export default function QuickActionsCard({ activeProjectId = null }) {
  const unifilarPath = activeProjectId ? `/unifilar?project=${activeProjectId}` : "/unifilar";

  const tiles = [
    {
      title: "Novo projeto",
      subtitle: "Inicie um projeto do zero",
      to: "/projects/new",
      icon: Plus,
      bg: "bg-[#ECFDF5] hover:bg-[#DDFCF0]",
      border: "border-[#BBEFD7]",
      iconBg: "bg-[#00D98A]/20 text-[#006F51]",
    },
    {
      title: "Calculadora",
      subtitle: "Dimensionamentos rápidos",
      to: "/calculator",
      icon: Calculator,
      bg: "bg-[#F5F3FF] hover:bg-[#EDE9FE]",
      border: "border-[#DDD6FE]",
      iconBg: "bg-[#5B4AE8]/15 text-[#5B4AE8]",
    },
    {
      title: "Diagrama unifilar",
      subtitle: "Gere seu diagrama",
      to: unifilarPath,
      icon: GitBranch,
      bg: "bg-[#EFF6FF] hover:bg-[#DBEAFE]",
      border: "border-[#BFDBFE]",
      iconBg: "bg-[#3B82F6]/15 text-[#2563EB]",
    },
    {
      title: "Consultar NBR",
      subtitle: "Acesse normas técnicas",
      to: "/nbr-library",
      icon: BookOpen,
      bg: "bg-[#FFFBEB] hover:bg-[#FEF3C7]",
      border: "border-[#FDE68A]",
      iconBg: "bg-[#F59E0B]/20 text-[#B45309]",
    },
  ];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E5EBF1] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#00A86B]" />
        <h3 className="text-[14px] font-bold text-[#101828]">Ações rápidas</h3>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.title}
              to={tile.to}
              className={`group flex items-center gap-2.5 rounded-xl border p-2.5 transition-all duration-150 ${tile.bg} ${tile.border}`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${tile.iconBg}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#101828] leading-tight">{tile.title}</p>
                <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#64748B] leading-tight">
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
