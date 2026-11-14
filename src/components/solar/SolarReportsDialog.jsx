import { authorizePlanExport, stampPdfWithPlanWatermark } from "@/lib/planEnforcement";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Printer,
  Receipt,
  Sliders,
  Sun,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { validateProjectDataForReports } from "@/lib/solarWizardState";
import { buildDetailedSolarBudget } from "@/lib/solarBudgetMath";
import {
  downloadPdfBlob,
  generateBillOfMaterialsReport,
  generateCommercialProposalReport,
  generateElectricalDiagramReport,
  generateExecutiveSolarPdf,
  generateGenerationSimulationReport,
  generateSitePlanReport,
  generateTechnicalMemorialReport,
  printExecutiveSolarReport,
} from "@/lib/solarReportGenerator";
import { preloadSolarReportImages } from "@/lib/solarLayoutImageRenderer";

const REPORT_CARDS = [
  {
    id: "executive",
    title: "Relatório Executivo Completo",
    desc: "Documento consolidado de 2 páginas com capa, KPIs, layout, strings, BOM e retorno financeiro.",
    icon: FileText,
    fn: generateExecutiveSolarPdf,
    filename: "00_Relatorio_Executivo_Completo_Solar.pdf",
    highlight: true,
  },
  {
    id: "site_plan",
    title: "Planta de Implantação",
    desc: "Layout dos módulos, cotas, inclinação, azimute e rosa dos ventos.",
    icon: Layers,
    fn: generateSitePlanReport,
    filename: "01_Planta_Implantacao_Solar.pdf",
  },
  {
    id: "electrical",
    title: "Diagrama Elétrico Solar",
    desc: "Arranjo das strings, tensões CC, inversor e proteções CA integradas.",
    icon: Zap,
    fn: generateElectricalDiagramReport,
    filename: "02_Diagrama_Eletrico_Solar.pdf",
  },
  {
    id: "memorial",
    title: "Memorial Descritivo",
    desc: "Especificações técnicas, normas NBR 16690/5410 e premissas de projeto.",
    icon: FileText,
    fn: generateTechnicalMemorialReport,
    filename: "03_Memorial_Descritivo_Solar.pdf",
  },
  {
    id: "bom",
    title: "Lista de Materiais (BOM)",
    desc: "Quantitativo detalhado de módulos, inversor, cabos, conectores e fixação.",
    icon: FileSpreadsheet,
    fn: generateBillOfMaterialsReport,
    filename: "04_Lista_Materiais_Solar.pdf",
  },
  {
    id: "simulation",
    title: "Simulação de Geração",
    desc: "Previsão mensal e anual em kWh, perdas estimadas e irradiação HSP.",
    icon: Sun,
    fn: generateGenerationSimulationReport,
    filename: "05_Simulacao_Geracao_Solar.pdf",
  },
  {
    id: "proposal",
    title: "Proposta Comercial Completa (9 Págs.)",
    desc: "Modelo NACIF Energy de 9 páginas com capa, preços dos equipamentos, margem, VPL/TIR, fluxo de caixa 25 anos e aceite.",
    icon: Receipt,
    fn: generateCommercialProposalReport,
    filename: "06_Proposta_Comercial_NACIF_Energy.pdf",
  },
];

export default function SolarReportsDialog({
  open,
  onOpenChange,
  project,
  config,
  sizing,
  onOpenParameters,
  onOpenBudget,
}) {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState(null);

  const budgetSummary = useMemo(
    () => buildDetailedSolarBudget({ project, config, sizing }),
    [project, config, sizing]
  );

  const validation = useMemo(
    () => validateProjectDataForReports(project, config, sizing),
    [project, config, sizing]
  );

  useEffect(() => {
    if (open && project) {
      preloadSolarReportImages({ project, config, sizing });
    }
  }, [open, project, config, sizing]);

  const handlePrint = async () => {
    try {
      const auth = await authorizePlanExport({ projectId: project?.id, moduleKey: "solar", format: "PRINT", label: "Relatório Solar" });
      if (!auth.allowed) return;
      await printExecutiveSolarReport(project, config, sizing, auth);
      toast({
        title: "Janela de impressão aberta",
        description: "O relatório executivo foi enviado para visualização e impressão.",
      });
    } catch (error) {
      toast({
        title: "Erro ao abrir impressão",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = async (report) => {
    setDownloadingId(report.id);
    try {
      const auth = await authorizePlanExport({ projectId: project?.id, moduleKey: "solar", label: report.title });
      if (!auth.allowed) return;
      const doc = await report.fn(project, config, sizing);
      stampPdfWithPlanWatermark(doc, auth);
      await downloadPdfBlob(doc, report.filename);
      toast({
        title: "Relatório gerado",
        description: `O arquivo ${report.title} foi baixado em PDF com sucesso.`,
      });
    } catch (error) {
      console.error(`Erro ao gerar PDF (${report.id}):`, error);
      toast({
        title: "Erro ao gerar PDF",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingId("all");
    try {
      for (const report of REPORT_CARDS) {
        const auth = await authorizePlanExport({ projectId: project?.id, moduleKey: "solar", label: report.title });
        if (!auth.allowed) return;
        const doc = await report.fn(project, config, sizing);
        stampPdfWithPlanWatermark(doc, auth);
        await downloadPdfBlob(doc, report.filename);
        await new Promise((r) => setTimeout(r, 250));
      }
      toast({
        title: "Todos os relatórios gerados",
        description: "Os relatórios em PDF foram baixados.",
      });
    } catch (error) {
      console.error("Erro no download em lote:", error);
      toast({
        title: "Erro no download em lote",
        description: error?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-component="solar-reports"
        className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-slate-300 text-slate-900 p-6 shadow-2xl rounded-none report-modal"
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                <FileText className="h-5 w-5 text-[#00d8b8]" />
                Relatórios Profissionais Fotovoltaicos
              </DialogTitle>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Gere documentos técnicos de engenharia e propostas executivas em PDF ou imprima diretamente.
              </p>
            </div>
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 bg-[#E6FAF7] hover:bg-[#d5f7f2] text-[#009b84] text-xs font-bold rounded-none border border-[#00d8b8]/40 shrink-0 disabled:opacity-50"
            >
              <Printer className="mr-1.5 h-4 w-4 text-[#00d8b8]" /> Imprimir Relatório
            </Button>
          </div>
        </DialogHeader>

        {/* Faixa Minimalista de Resumo Orçamentário (Equipamentos + Margem) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-slate-50 px-4 py-3 text-xs mt-2">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Equipamentos (Kit CC)</span>
              <span className="font-black text-slate-900">
                {budgetSummary.equipmentTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Margem Aplicada</span>
              <span className="font-black text-[#009b84]">
                {budgetSummary.marginPercent}% (+{budgetSummary.marginBrl.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Proposta Turnkey</span>
              <span className="font-black text-slate-950">
                {budgetSummary.finalTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
          {onOpenBudget && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onOpenBudget}
              className="h-8 rounded-none border-slate-900 bg-white text-xs font-black text-slate-900 hover:bg-slate-100"
            >
              Ajustar Preço & Margem
            </Button>
          )}
        </div>

        {/* ALERTA DE VALIDAÇÃO: Só gera relatório depois de preencher os dados do projeto */}
        {!validation.valid && (
          <div className="rounded-none border border-amber-300 bg-amber-50 p-4 text-xs shadow-sm space-y-2 mt-2">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-black text-amber-950 text-sm">Preencha os dados do projeto antes de emitir relatórios</h4>
                <p className="mt-1 text-xs text-amber-800 leading-relaxed font-semibold">
                  {validation.message}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenParameters?.(validation.firstMissingStep);
                    }}
                    className="h-8 rounded-none bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <Sliders className="h-3.5 w-3.5" /> Preencher Dados do Projeto
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {REPORT_CARDS.map((report) => {
            const Icon = report.icon;
            const isDownloading = downloadingId === report.id;
            return (
              <div
                key={report.id}
                className={`flex flex-col justify-between rounded-none border p-4 transition ${
                  report.highlight
                    ? "border-[#00d8b8] bg-[#E6FAF7]/50 shadow-sm sm:col-span-2"
                    : "border-slate-200 bg-slate-50/70 hover:border-[#00d8b8]/60 hover:bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/30">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-slate-900 flex items-center gap-2">
                      {report.title}
                      {report.highlight && (
                        <span className="rounded-none bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Recomendado
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{report.desc}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDownloading}
                    onClick={() => handleDownload(report)}
                    className="h-8 border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 rounded-none shadow-sm disabled:opacity-50"
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5 text-[#00d8b8]" />
                    )}
                    Baixar PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-200 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-none"
          >
            Fechar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              variant="outline"
              className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-none shadow-sm disabled:opacity-50"
            >
              <Printer className="mr-1.5 h-4 w-4 text-[#00d8b8]" /> Imprimir
            </Button>
            <Button
              type="button"
              disabled={downloadingId === "all"}
              onClick={handleDownloadAll}
              className="bg-[#00d8b8] text-slate-950 text-xs font-black rounded-none hover:bg-[#00c4a7] shadow-sm disabled:opacity-50"
            >
              {downloadingId === "all" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Baixar Todos os PDFs
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
