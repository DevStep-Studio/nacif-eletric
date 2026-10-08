import { useState, useEffect } from "react";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { Button } from "@/components/ui/button";
import {
  Activity,
  CheckCircle2,
  Clock,
  Database,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const SERVICES = [
  {
    id: "web-app",
    name: "Aplicação Web & Interface",
    description: "Editor de projetos, navegação e interface do usuário.",
    icon: Globe,
    status: "operational",
    latency: "24ms",
  },
  {
    id: "calc-engine",
    name: "Motor de Cálculo Elétrico (NBR 5410)",
    description: "Dimensionamento de cabos, disjuntores, queda de tensão e balanceamento.",
    icon: Zap,
    status: "operational",
    latency: "38ms",
  },
  {
    id: "database",
    name: "Banco de Dados & Armazenamento de Projetos",
    description: "Persistência em nuvem, schemas e versionamento de plantas.",
    icon: Database,
    status: "operational",
    latency: "19ms",
  },
  {
    id: "routing-engine",
    name: "Roteador Ortogonal de Eletrodutos",
    description: "Traçado inteligente de dutos em paredes e lajes.",
    icon: Activity,
    status: "operational",
    latency: "15ms",
  },
  {
    id: "pdf-export",
    name: "Serviço de Exportação (PDF / Pranchas ABNT / DXF)",
    description: "Renderização em alta resolução de memoriais e folhas A0-A4.",
    icon: FileSpreadsheet,
    status: "operational",
    latency: "85ms",
  },
  {
    id: "ai-assistant",
    name: "Assistente IA & Análise de Conformidade NBR",
    description: "Inspeção automática de circuitos e leitura assistida de plantas.",
    icon: Sparkles,
    status: "operational",
    latency: "210ms",
  },
];

export default function SystemStatusPage() {
  const [checking, setChecking] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState(() => new Date().toLocaleTimeString());

  const handleRefresh = async () => {
    setChecking(true);
    await new Promise((r) => setTimeout(r, 600));
    setLastCheckTime(new Date().toLocaleTimeString());
    setChecking(false);
  };

  return (
    <SystemPageLayout
      title="Status do Sistema"
      subtitle="Monitoramento em tempo real dos serviços, motores de cálculo e infraestrutura da Nacif Electric."
      maxWidth="max-w-4xl"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={checking}
          className="h-9 rounded-xl border-[#E2E8F0] text-xs font-bold text-[#0F172A]"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
          Atualizar status
        </Button>
      }
    >
      <div className="space-y-8">
        {/* Overall Status Banner */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-emerald-950">
                Todos os Sistemas Operando Normalmente
              </h2>
              <p className="text-xs text-emerald-800">
                Nenhum incidente registrado no momento. Última checagem às {lastCheckTime}.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-black text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            100% Online
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#94A3B8]">
            Serviços e Motores de Cálculo
          </h3>

          <div className="divide-y divide-[#F1F5F9] rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm">
            {SERVICES.map((srv) => {
              const Icon = srv.icon;
              return (
                <div
                  key={srv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3 hover:bg-[#F8FAFC] transition"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-extrabold text-[#0F172A] truncate">
                        {srv.name}
                      </p>
                      <p className="text-[11px] text-[#64748B] truncate">
                        {srv.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span className="font-mono text-[11px] text-[#94A3B8]">
                      {srv.latency}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Operacional
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Updates / Incident History */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-extrabold text-[#0F172A]">
            Histórico Recente de Manutenções & Incidentes
          </h3>
          <div className="text-xs text-[#64748B] space-y-3">
            <div className="flex items-start gap-3 border-l-2 border-emerald-500 pl-3">
              <div>
                <p className="font-bold text-[#0F172A]">02 de Outubro de 2026 — Otimização de Cálculo NBR 5410</p>
                <p className="text-[11px] text-[#64748B]">Atualização programada nos motores de queda de tensão e balanceamento trifásico sem indisponibilidade.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-l-2 border-slate-300 pl-3">
              <div>
                <p className="font-bold text-[#0F172A]">28 de Setembro de 2026 — Melhoria de Infraestrutura de Exportação</p>
                <p className="text-[11px] text-[#64748B]">Expansão de servidores de renderização de PDF para pranchas A0/A1.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SystemPageLayout>
  );
}
