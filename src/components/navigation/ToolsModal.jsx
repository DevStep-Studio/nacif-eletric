import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  Calculator,
  Cpu,
  FileSpreadsheet,
  FileText,
  Flame,
  Layers,
  ScanLine,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const TOOLS_LIST = [
  {
    category: "Cálculos de Engenharia",
    items: [
      { path: "/calculator", icon: Calculator, label: "Calculadora Elétrica", desc: "Queda de tensão, dimensionamento, corrente e demanda." },
      { path: "/calculator?tab=voltage-drop", icon: Zap, label: "Queda de Tensão", desc: "Cálculo percentual conforme comprimento e bitola NBR 5410." },
      { path: "/calculator?tab=conduit", icon: Layers, label: "Taxa de Ocupação de Eletrodutos", desc: "Regra dos 40% e 33% para condutores agrupados." },
    ],
  },
  {
    category: "Inteligência Artificial & Automação",
    items: [
      { path: "/scanner", icon: ScanLine, label: "Scanner IA de Plantas", desc: "Digitalização e vetorização de plantas em imagem/PDF." },
      { path: "/ai-assistant", icon: Sparkles, label: "Assistente IA Técnico", desc: "Tire dúvidas sobre normas NBR e dimensionamento." },
    ],
  },
];

export const LIBRARY_LIST = [
  {
    category: "Normas & Referências",
    items: [
      { path: "/nbr-library", icon: BookOpen, label: "Biblioteca NBR", desc: "Consultas rápidas à NBR 5410, NBR 5419 e NBR 14039." },
      { path: "/components-library", icon: Shield, label: "Biblioteca de Componentes", desc: "Disjuntores DIN, IDRs, DPS e barramentos cadastrados." },
    ],
  },
  {
    category: "Quantitativos & Custos",
    items: [
      { path: "/materials", icon: FileSpreadsheet, label: "Lista de Materiais (BOM)", desc: "Quantitativos de cabos, condutos e quadros elétricos." },
      { path: "/budget", icon: FileText, label: "Composição de Orçamento", desc: "Estimativas financeiras e precificação de projetos." },
    ],
  },
];

export default function ToolsModal({ open, onOpenChange, mode = "tools" }) {
  const isLibrary = mode === "library";
  const list = isLibrary ? LIBRARY_LIST : TOOLS_LIST;
  const title = isLibrary ? "Biblioteca & Normas Técnicas" : "Ferramentas de Engenharia";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-[16px] border-[#E4E7EC] bg-white p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-black text-[#101828] flex items-center gap-2">
            {isLibrary ? <BookOpen className="h-5 w-5 text-[#00d8b8]" /> : <Calculator className="h-5 w-5 text-[#00d8b8]" />}
            {title}
          </DialogTitle>
          <p className="text-xs font-medium text-[#667085]">
            {isLibrary
              ? "Consulte normas da ABNT, listas de materiais e especificações técnicas."
              : "Calculadoras auxiliares e recursos de automação com inteligência artificial."}
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto pr-1">
          {list.map((group) => (
            <div key={group.category} className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#98A2B3]">
                {group.category}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => onOpenChange(false)}
                      className="group flex items-start gap-3 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] p-3 transition hover:border-[#00d8b8]/60 hover:bg-[#E8FCF8]/40 shadow-none"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-[#EAECF0] text-[#00d8b8] group-hover:bg-[#00d8b8] group-hover:text-slate-950 transition">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-extrabold text-[#101828] group-hover:text-[#0f4f49] transition">
                          {item.label}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-4 text-[#667085]">
                          {item.desc}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
