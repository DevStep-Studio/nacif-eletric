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
} from "@/lib/solarReportGenerator";

const REPORT_CARDS = [
  {
    id: "site_plan",
    title: "Planta de implantação",
    desc: "Layout dos módulos, cotas, inclinação, azimute e rosa dos ventos.",
    icon: Layers,
    fn: generateSitePlanReport,
    filename: "01_Planta_Implantacao_Solar.pdf",
  },
  {
    id: "electrical",
    title: "Diagrama elétrico solar",
    desc: "Arranjo das strings, tensões CC, inversor e proteções CA integradas.",
    icon: Zap,
    fn: generateElectricalDiagramReport,
    filename: "02_Diagrama_Eletrico_Solar.pdf",
  },
  {
    id: "memorial",
    title: "Memorial descritivo",
    desc: "Especificações técnicas, normas NBR 16690/5410 e premissas de projeto.",
    icon: FileText,
    fn: generateTechnicalMemorialReport,
    filename: "03_Memorial_Descritivo_Solar.pdf",
  },
  {
    id: "bom",
    title: "Lista de materiais",
    desc: "Quantitativo detalhado de módulos, inversor, cabos, conectores e fixação.",
    icon: FileSpreadsheet,
    fn: generateBillOfMaterialsReport,
    filename: "04_Lista_Materiais_Solar.pdf",
  },
  {
    id: "simulation",
    title: "Simulação de geração",
    desc: "Previsão mensal e anual em kWh, perdas estimadas e irradiação HSP.",
    icon: Sun,
    fn: generateGenerationSimulationReport,
    filename: "05_Simulacao_Geracao_Solar.pdf",
  },
  {
    id: "proposal",
    title: "Proposta comercial",
    desc: "Apresentação executiva para cliente com payback, ROI e economia de 25 anos.",
    icon: Receipt,
    fn: generateCommercialProposalReport,
    filename: "06_Proposta_Comercial_Solar.pdf",
  },
];

export default function SolarReportsDialog({ open, onOpenChange, project, config, sizing }) {
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState(null);

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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
            <Download className="h-5 w-5 text-primary" />
            Relatórios Profissionais Fotovoltaicos
          </DialogTitle>
          <p className="text-xs font-semibold text-muted-foreground">
            Exporte os relatórios técnicos e comerciais completos em PDF com a identidade visual do seu projeto.
          </p>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          {REPORT_CARDS.map((report) => {
            const Icon = report.icon;
            const isDownloading = downloadingId === report.id;
            return (
              <div
                key={report.id}
                className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-foreground">{report.title}</p>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground leading-relaxed">{report.desc}</p>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isDownloading}
                    onClick={() => handleDownload(report)}
                    className="h-8 text-xs font-bold"
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-3.5 w-3.5" />
                    )}
                    Baixar PDF
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            type="button"
            disabled={downloadingId === "all"}
            onClick={handleDownloadAll}
            className="font-bold bg-primary text-primary-foreground"
          >
            {downloadingId === "all" ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Baixar Pacote Completo (6 PDFs)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
