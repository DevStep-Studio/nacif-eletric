import { Link } from "react-router-dom";
import { Lock, Zap, Sun, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { canAccessModule } from "@/lib/subscriptionPlans";

export default function ModuleAccessGate({ children, moduleKey, moduleTitle, immersive = false }) {
  const { user } = useAuth();
  const access = canAccessModule(user, moduleKey);

  if (access.allowed) {
    return <>{children}</>;
  }

  const isSolar = moduleKey === "solar" || moduleKey === "solar_3d" || moduleKey === "solar_project";
  const isElectrical =
    moduleKey === "plant" ||
    moduleKey === "panel" ||
    moduleKey === "unifilar" ||
    moduleKey === "circuit_editor" ||
    moduleKey === "phase_balance" ||
    moduleKey === "memorial";
  const isAi = moduleKey === "scanner" || moduleKey === "ai_assistant";

  const targetPlanName = access.primaryPlanName || (isSolar ? "Nacif Solar" : "Nacif Elétrico");
  const targetPlanPrice = access.primaryPlanPrice || "R$ 149,90/mês";

  const electricalHighlights = [
    "Editor completo de plantas elétricas prediais e residenciais (NBR 5410)",
    "Criação, balanceamento de fases e montagem de quadros de distribuição",
    "Diagramas unifilares e trifilares automáticos com memorial descritivo",
  ];

  const solarHighlights = [
    "Dimensionamento fotovoltaico por consumo e irradiação solar (NBR 16690)",
    "Layout de módulos 2D/3D sobre telhados e arranjo de strings/MPPTs",
    "Memorial solar técnico, diagramas e orçamento de infraestrutura CA (BOM)",
  ];

  const aiHighlights = [
    "Leitura assistida de faturas de energia e extração de histórico de consumo",
    "Auditoria normativa automática contra NBR 5410 e NBR 16690",
    "Sugestões inteligentes de condutores, proteções e arranjos técnicos",
  ];

  const highlights = isSolar ? solarHighlights : isAi ? aiHighlights : electricalHighlights;

  return (
    <div
      className={`relative flex min-h-[calc(100vh-5rem)] w-full items-center justify-center p-4 sm:p-6 md:p-10 ${
        immersive ? "bg-[#0B1321]" : "bg-slate-50/70"
      }`}
    >
      <div className="mx-auto w-full max-w-3xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_20px_50px_rgba(14,23,38,0.12)]">
          {/* Top Banner Escuro Executivo com Acentos de Marca */}
          <div className="relative overflow-hidden bg-[#0E1726] px-6 py-8 text-white sm:px-10 sm:py-10">
            {/* Gradientes decorativos de iluminação */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#00D8B8]/15 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-[#0D3B82]/40 blur-3xl" />

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Badge de Norma Técnica */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-[11px] font-bold tracking-wide text-[#00D8B8] backdrop-blur-md">
                {isSolar ? (
                  <>
                    <Sun className="h-3.5 w-3.5" />
                    <span>ABNT NBR 16690 · GERAÇÃO DISTRIBUÍDA</span>
                  </>
                ) : isAi ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>INTELIGÊNCIA ARTIFICIAL NACIF</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    <span>ABNT NBR 5410 · INSTALAÇÕES ELÉTRICAS</span>
                  </>
                )}
              </div>

              {/* Ícone de Cadeado em Emblema */}
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D3B82] to-[#0E1726] border border-[#00D8B8]/30 shadow-[0_0_24px_rgba(0,216,184,0.25)]">
                <Lock className="h-8 w-8 text-[#00D8B8]" />
              </div>

              {/* Título de Bloqueio com Nome do Módulo */}
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {moduleTitle || "Recurso Exclusivo para Assinantes"}
              </h1>
              <p className="mt-2 max-w-xl text-sm font-medium text-slate-300">
                {access.message ||
                  "Para utilizar este módulo técnico em conformidade com as normas vigentes, é necessário possuir uma assinatura ativa."}
              </p>
            </div>
          </div>

          {/* Conteúdo Informativo & Detalhamento da Assinatura */}
          <div className="space-y-6 p-6 sm:p-10">
            {/* O que este módulo inclui */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                O que este módulo entrega no seu projeto
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {highlights.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-left"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00D8B8]" />
                    <span className="text-xs font-semibold leading-relaxed text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Card de Destaque do Plano Recomendado */}
            <div className="rounded-2xl border-2 border-[#00D8B8]/30 bg-gradient-to-br from-teal-50/40 via-white to-slate-50/60 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-[#00D8B8]/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-800">
                    Plano Recomendado
                  </div>
                  <h2 className="mt-1 text-lg font-black text-slate-900">{targetPlanName}</h2>
                  <p className="text-xs font-medium text-slate-600">
                    Acesso completo ao módulo técnico, exportação de pranchas e relatórios técnicos.
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <span className="text-2xl font-black text-slate-900">{targetPlanPrice}</span>
                  <span className="block text-[11px] font-semibold text-slate-500">ou com desconto no ciclo anual</span>
                </div>
              </div>
            </div>

            {/* Ações / Botões de CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs text-slate-500 font-medium text-center sm:text-left">
                Seus projetos criados continuam salvos e acessíveis no painel.
              </p>
              <div className="flex w-full sm:w-auto items-center gap-2">
                <Button
                  asChild
                  variant="outline"
                  className="w-full sm:w-auto h-11 rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  <Link to="/subscription">Ver todos os planos</Link>
                </Button>
                <Button
                  asChild
                  className="w-full sm:w-auto h-11 rounded-xl bg-[#00D8B8] hover:bg-[#00c5a7] active:bg-[#00b397] font-extrabold text-slate-950 shadow-[0_4px_14px_rgba(0,216,184,0.3)] transition-all"
                >
                  <Link to="/subscription" className="flex items-center gap-2">
                    <span>Desbloquear Acesso</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Rodapé com garantia de conformidade */}
            <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100 text-slate-400 text-[11px] font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-600" />
              <span>Plataforma homologada em conformidade com as normas ABNT NBR 5410 e NBR 16690</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
