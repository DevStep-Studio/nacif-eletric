import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { backend } from "@/api/backendClient";
import { auditProjectNBR5410 } from "@/lib/electricalEngine";
import { computeProjectMetricsSafe } from "@/lib/projectAnalytics";
import { DEFAULT_SIZING_PREMISES, estimateAnnualGenerationKwh, sizeFromDesiredPower } from "@/lib/solarSizing";
import { canAccessModule } from "@/lib/subscriptionPlans";
import { useAuth } from "@/lib/AuthContext";

const ACTION_TITLES = {
  loads: "Dimensionamento e Análise de Cargas",
  nbr5410: "Auditoria Técnica NBR 5410",
  solar: "Análise de Sistema Solar Ideal",
};

export default function NacifAIAssistantDialog({
  open,
  onOpenChange,
  mode = "loads",
  project = null,
}) {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState(mode);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiError, setAiError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setActiveMode(mode);
    setAiNote("");
    setAiError("");
  }, [mode, open]);

  const storageKey = useMemo(
    () => `nacif:ia_panel_history:${project?.id || "global"}`,
    [project?.id]
  );

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(storageKey) || "[]");
      setHistory(Array.isArray(saved) ? saved : []);
    } catch {
      setHistory([]);
    }
  }, [open, storageKey]);

  const analysis = useMemo(() => {
    if (!project) {
      return {
        hasProject: false,
        limitations: [
          "Nenhum projeto selecionado. Selecione ou crie um projeto para executar análises determinísticas baseadas em cargas reais.",
        ],
      };
    }

    const safe = computeProjectMetricsSafe(project);
    const metrics = safe?.metrics;
    const audit = safe?.nbrAudit || auditProjectNBR5410(project, metrics || {});
    const circuits = metrics?.circuits || project.circuits || [];
    const hasCircuits = circuits.length > 0;

    // Estimativa solar preliminar somente quando há consumo mensal ou potência solar cadastrada
    const monthlyKwh = Number(
      project.monthly_consumption_kwh ||
      project.solar_config?.monthly_consumption_kwh ||
      0
    );
    const solarKwp = Number(
      project.solar_power_kwp ||
      project.solar_sizing?.installedKwp ||
      project.solar_config?.installed_kwp ||
      0
    );
    let suggestedSolar = null;
    if (solarKwp > 0) {
      suggestedSolar = {
        mode: "existing",
        kwp: solarKwp,
        panelCount: project.solar_sizing?.panelCount || project.solar_config?.panel_count || Math.ceil((solarKwp * 1000) / 550),
        annualKwh: estimateAnnualGenerationKwh(solarKwp, DEFAULT_SIZING_PREMISES),
      };
    } else if (monthlyKwh > 0) {
      const dailyKwh = monthlyKwh / 30;
      const estimatedKwp = dailyKwh / (DEFAULT_SIZING_PREMISES.dailyIrradiationHspKwhM2 * DEFAULT_SIZING_PREMISES.performanceRatio);
      const sized = sizeFromDesiredPower(estimatedKwp, 550);
      suggestedSolar = {
        mode: "consumption_based",
        kwp: Math.round(sized.installedKwp * 100) / 100,
        panelCount: sized.panelCount,
        annualKwh: estimateAnnualGenerationKwh(sized.installedKwp, DEFAULT_SIZING_PREMISES),
        areaM2: Math.round(sized.areaM2 * 10) / 10,
      };
    }

    const limitations = [];
    if (!hasCircuits) {
      limitations.push("O projeto ainda não possui circuitos cadastrados; potências e verificações dependem desses dados.");
    }
    if (activeMode === "nbr5410") {
      limitations.push("Verificação automática cobre critérios de potência, queda de tensão, desequilíbrio e condutores implementados no motor; aprovação definitiva exige RT habilitado.");
    }
    if (activeMode === "solar" && !suggestedSolar) {
      limitations.push("Consumo mensal (kWh/mês) ou sistema fotovoltaico não informado no projeto. Abra o Projeto Solar para dimensionar com base real.");
    }

    return {
      hasProject: true,
      hasCircuits,
      safe,
      metrics,
      audit,
      circuits,
      suggestedSolar,
      monthlyKwh,
      limitations,
    };
  }, [project, activeMode]);

  const canInvokeLLM = useMemo(() => canAccessModule(user, "scanner").allowed, [user]);

  const recordHistoryEntry = (summaryText) => {
    const entry = {
      id: `${Date.now()}`,
      mode: activeMode,
      title: ACTION_TITLES[activeMode],
      projectName: project?.name || "Global",
      summary: summaryText,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    const next = [entry, ...history].slice(0, 6);
    setHistory(next);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
  };

  const handleRunLLMExplanation = async () => {
    if (!project || !canInvokeLLM) return;
    setAiLoading(true);
    setAiError("");
    try {
      const payloadSummary = {
        projectName: project.name,
        supplyType: project.supply_type,
        voltage: project.voltage,
        circuitsCount: analysis.circuits.length,
        installedPowerKw: Math.round((analysis.safe?.installedPowerW || 0) / 10) / 100,
        demandKw: Math.round((analysis.safe?.demandKw || 0) * 100) / 100,
        demandKva: Math.round((analysis.safe?.demandKva || 0) * 100) / 100,
        generalBreakerA: analysis.metrics?.generalBreaker || null,
        nbrScore: analysis.audit?.score ?? null,
        nbrErrors: analysis.audit?.errorCount ?? 0,
        nbrWarnings: analysis.audit?.warnCount ?? 0,
        monthlyConsumptionKwh: analysis.monthlyKwh || null,
        solarKwp: analysis.suggestedSolar?.kwp || null,
      };

      const prompt = [
        `Você é a Nacif IA, assistente técnica da plataforma Nacif Energy.`,
        `Analise SOMENTE os dados reais abaixo sem inventar números ou alterar valores calculados.`,
        `Modo solicitado: ${ACTION_TITLES[activeMode]}.`,
        `Dados do projeto JSON: ${JSON.stringify(payloadSummary)}.`,
        `Forneça: 1) Resumo objetivo do cenário atual; 2) Principais pontos de atenção ou limitações de dados faltantes; 3) Próximas ações práticas dentro do projeto. Máximo 160 palavras em português técnico claro.`,
      ].join("\n");

      const response = await backend.integrations.Core.InvokeLLM({ prompt });
      const text =
        typeof response === "string"
          ? response
          : response?.text || response?.output || response?.answer || JSON.stringify(response);
      setAiNote(text);
      recordHistoryEntry(text.slice(0, 140));
    } catch (err) {
      setAiError(
        err?.message ||
          "Serviço de explicação por IA indisponível no momento. Os cálculos determinísticos acima continuam 100% válidos."
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border-[#E5EBF1] bg-white p-0 shadow-2xl">
        {/* Header roxo-azul exclusivo da identidade Nacif IA */}
        <div className="bg-gradient-to-r from-[#5B4AE8] via-[#4F5CEB] to-[#3B82F6] px-6 py-5 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 text-xs font-bold text-white/85">
              <Sparkles className="h-4 w-4 text-[#00F0A0]" />
              <span>Nacif IA · Análise Técnica Assistida</span>
            </div>
            <DialogTitle className="mt-1 text-lg sm:text-xl font-extrabold text-white">
              {ACTION_TITLES[activeMode]}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/80">
              {project
                ? `Contexto ativo: ${project.name} (${project.supply_type || "Instalação elétrica"})`
                : "Selecione um projeto para análises determinísticas com IA."}
            </DialogDescription>
          </DialogHeader>

          {/* Navegação rápida entre os 3 fluxos */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { id: "loads", label: "Dimensionar cargas", icon: Zap },
              { id: "nbr5410", label: "Auditoria NBR 5410", icon: ShieldAlert },
              { id: "solar", label: "Sistema solar ideal", icon: Sun },
            ].map((tab) => {
              const Icon = tab.icon;
              const isCurrent = activeMode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveMode(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    isCurrent
                      ? "bg-white text-[#101828] shadow-sm"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4 p-6">
          {/* Alerta de Limitações e Escopo */}
          {analysis.limitations?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                Escopo e limitações da análise
              </p>
              {analysis.limitations.map((msg, idx) => (
                <p key={idx} className="leading-relaxed text-amber-800">{msg}</p>
              ))}
            </div>
          )}

          {/* Resultados Determinísticos Reais */}
          {analysis.hasProject && activeMode === "loads" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase text-[#64748B]">Carga Instalada</span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {(analysis.safe.installedPowerW / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase text-[#64748B]">Demanda</span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {analysis.safe.demandKw.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase text-[#64748B]">Potência Aparente</span>
                  <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                    {analysis.safe.demandKva.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kVA
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                  <span className="text-[10px] font-bold uppercase text-[#64748B]">Disjuntor Geral</span>
                  <p className="mt-1 text-base font-extrabold text-[#006F51] tabular-nums">
                    {analysis.metrics?.generalBreaker ? `${analysis.metrics.generalBreaker} A` : "Pendente"}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-xl bg-[#00D98A] text-[#031923] font-bold hover:bg-[#00C47C]">
                  <Link to={`/circuit-editor?project=${project.id}`} onClick={() => onOpenChange(false)}>
                    Abrir Editor de Circuitos <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl border-[#E5EBF1] text-[#101828] font-semibold">
                  <Link to={`/phase-balance?project=${project.id}`} onClick={() => onOpenChange(false)}>
                    Balanceamento de Fases
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {analysis.hasProject && activeMode === "nbr5410" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-[#64748B]">Resultado da Auditoria NBR 5410</p>
                  <p className="text-sm font-extrabold text-[#101828]">{analysis.audit.statusText}</p>
                </div>
                <span className="rounded-full bg-[#DDFCF0] px-3 py-1 text-xs font-extrabold text-[#006F51]">
                  {analysis.audit.score !== null && analysis.audit.score !== undefined
                    ? `${analysis.audit.score}/100 pts`
                    : "Pendente"}
                </span>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {(analysis.audit?.checks || []).map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-2.5 rounded-xl border border-[#E5EBF1] bg-white p-3 text-xs"
                  >
                    {check.status === "pass" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#00D98A]" />
                    ) : (
                      <AlertTriangle
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          check.status === "fail" ? "text-[#EF4444]" : "text-amber-500"
                        }`}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-[#101828]">{check.title}</span>
                        {check.standardRef && (
                          <span className="rounded bg-[#F6F9FC] px-1.5 py-0.5 text-[10px] font-semibold text-[#64748B]">
                            {check.standardRef}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[#64748B] leading-relaxed">{check.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.hasProject && activeMode === "solar" && (
            <div className="space-y-3">
              {analysis.suggestedSolar ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-[#E5EBF1] bg-[#DDFCF0]/45 p-3">
                    <span className="text-[10px] font-bold uppercase text-[#006F51]">Potência Fotovoltaica</span>
                    <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                      {analysis.suggestedSolar.kwp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                    <span className="text-[10px] font-bold uppercase text-[#64748B]">Módulos (550 Wp ref.)</span>
                    <p className="mt-1 text-base font-extrabold text-[#101828] tabular-nums">
                      {analysis.suggestedSolar.panelCount} un
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E5EBF1] bg-[#F6F9FC] p-3">
                    <span className="text-[10px] font-bold uppercase text-[#64748B]">Geração Estimada</span>
                    <p className="mt-1 text-base font-extrabold text-[#006F51] tabular-nums">
                      {analysis.suggestedSolar.annualKwh
                        ? `${Math.round(analysis.suggestedSolar.annualKwh).toLocaleString("pt-BR")} kWh/ano`
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#E5EBF1] bg-[#F6F9FC] p-4 text-xs text-[#64748B]">
                  Este projeto ainda não possui consumo mensal (kWh/mês) ou sistema fotovoltaico dimensionado. Utilize o módulo Projeto Solar para calcular com base na tarifa e irradiação reais.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" className="rounded-xl bg-[#00D98A] text-[#031923] font-bold hover:bg-[#00C47C]">
                  <Link to={`/solar-project?project=${project.id}`} onClick={() => onOpenChange(false)}>
                    Abrir Projeto Solar <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl border-[#E5EBF1] text-[#101828] font-semibold">
                  <Link to="/simulations" onClick={() => onOpenChange(false)}>
                    Ver Simulações
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Bloco de Explicação Opcional via LLM */}
          {analysis.hasProject && (
            <div className="border-t border-[#E5EBF1] pt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#101828]">
                  Explicação técnica assistida (sem alterar dados do projeto)
                </p>
                {canInvokeLLM ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleRunLLMExplanation}
                    disabled={aiLoading}
                    className="h-8 rounded-xl bg-[#5B4AE8] px-3 text-xs font-bold text-white hover:bg-[#4b3bd4]"
                  >
                    {aiLoading ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        Gerar parecer com Nacif IA
                      </>
                    )}
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline" className="h-8 rounded-xl text-xs font-semibold">
                    <Link to="/subscription" onClick={() => onOpenChange(false)}>
                      Desbloquear IA nos Planos
                    </Link>
                  </Button>
                )}
              </div>

              {aiError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-[#EF4444]">
                  {aiError}
                </div>
              )}

              {aiNote && (
                <div className="rounded-xl border border-[#5B4AE8]/25 bg-[#5B4AE8]/5 p-4 text-xs leading-relaxed text-[#101828] whitespace-pre-line">
                  {aiNote}
                </div>
              )}
            </div>
          )}

          {/* Histórico da sessão */}
          {history.length > 0 && (
            <div className="border-t border-[#E5EBF1] pt-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                Histórico desta sessão
              </p>
              <div className="space-y-1.5">
                {history.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-lg bg-[#F6F9FC] px-3 py-2 text-[11px] text-[#64748B]">
                    <span className="font-bold text-[#101828]">{item.title}</span> · {item.timestamp}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
