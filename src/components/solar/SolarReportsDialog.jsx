import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Flame,
  Layers,
  Loader2,
  Printer,
  Receipt,
  Sun,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  generateBillOfMaterialsReport,
  generateCommercialProposalReport,
  generateElectricalDiagramReport,
  generateGenerationSimulationReport,
  generateSitePlanReport,
  generateTechnicalMemorialReport,
  printExecutiveSolarReport,
} from "@/lib/solarReportGenerator";

const REPORT_CARDS = [
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
    title: "Proposta Comercial",
    desc: "Apresentação executiva para cliente com payback, ROI e economia de 25 anos.",
    icon: Receipt,
    fn: generateCommercialProposalReport,
    filename: "06_Proposta_Comercial_Solar.pdf",
  },
];

export default function SolarReportsDialog({ open, onOpenChange, project, config, sizing }) {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState(null);

  const handlePrint = () => {
    try {
      printExecutiveSolarReport(project, config, sizing);
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
      const doc = report.fn(project, config, sizing);
      doc.save(report.filename);
      toast({
        title: "Relatório gerado",
        description: `O arquivo ${report.title} foi baixado em PDF com sucesso.`,
      });
    } catch (error) {
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
        const doc = report.fn(project, config, sizing);
        doc.save(report.filename);
        await new Promise((r) => setTimeout(r, 200));
      }
      toast({
        title: "Todos os relatórios gerados",
        description: "Os 6 relatórios em PDF foram baixados.",
      });
    } catch (error) {
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-white/10 text-white p-6">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg font-black text-white">
                <FileText className="h-5 w-5 text-primary" />
                Relatórios Profissionais Fotovoltaicos
              </DialogTitle>
              <p className="text-xs font-semibold text-white/60 mt-1">
                Gere documentos técnicos de engenharia e propostas executivas em PDF ou imprima diretamente.
              </p>
            </div>
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 shrink-0"
            >
              <Printer className="mr-1.5 h-4 w-4 text-primary" /> Imprimir Relatório
            </Button>
          </div>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {REPORT_CARDS.map((report) => {
            const Icon = report.icon;
            const isDownloading = downloadingId === report.id;
            return (
              <div
                key={report.id}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-primary/50"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-white">{report.title}</p>
                    <p className="mt-1 text-xs text-white/60 leading-relaxed">{report.desc}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDownloading}
                    onClick={() => handleDownload(report)}
                    className="h-8 border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-white rounded-lg"
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-3.5 w-3.5 text-primary" />
                    )}
                    Baixar PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-white/10 flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5"
          >
            Fechar
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handlePrint}
              variant="outline"
              className="border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl"
            >
              <Printer className="mr-1.5 h-4 w-4 text-primary" /> Imprimir
            </Button>
            <Button
              type="button"
              disabled={downloadingId === "all"}
              onClick={handleDownloadAll}
              className="bg-primary text-slate-950 text-xs font-black rounded-xl hover:bg-primary/90"
            >
              {downloadingId === "all" ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              Baixar Todos (6 PDFs)
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
