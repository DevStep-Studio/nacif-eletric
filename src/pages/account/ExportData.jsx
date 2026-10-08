import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SystemPageLayout from "@/components/system/SystemPageLayout";
import { useAuth } from "@/lib/AuthContext";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Download, FileJson, CheckCircle2, ShieldCheck, Database, Loader2 } from "lucide-react";

export default function ExportDataPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exported, setExported] = useState(false);

  useEffect(() => {
    backend.entities.Project.list("-updated_date", 100)
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, []);

  const handleExportJson = () => {
    setLoading(true);
    const exportPayload = {
      export_date: new Date().toISOString(),
      user: {
        id: user?.id,
        email: user?.email,
        full_name: user?.full_name,
        profession: user?.profession || user?.profissao,
        company: user?.company,
        crea: user?.crea,
      },
      projects_count: projects.length,
      projects: projects,
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nacif_electric_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setLoading(false);
    setExported(true);
  };

  return (
    <SystemPageLayout
      title="Exportar Meus Dados & Projetos"
      subtitle="Baixe uma cópia completa dos seus dados cadastrais e projetos elétricos no formato JSON estruturado."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-[#CDEFE8] bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8FCF8] text-[#00d8b8]">
              <FileJson className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A]">
                Arquivo de Portabilidade de Dados (LGPD)
              </h2>
              <p className="text-xs text-[#64748B]">
                Gera um arquivo JSON contendo seu perfil e {projects.length} projeto(s) associado(s).
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-[#F1F5F9] p-3 text-xs text-[#64748B] space-y-1">
            <p className="font-bold text-[#0F172A]">O pacote de exportação inclui:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>Dados cadastrais do perfil profissional (nome, CREA, empresa, telefone).</li>
              <li>Estrutura completa de circuitos elétricos, condutores e quadros.</li>
              <li>Pontos inseridos na planta elétrica e traçado de rotas de eletrodutos.</li>
              <li>Configurações de dimensionamento solar e memórias de cálculo.</li>
            </ul>
          </div>

          {exported && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Download iniciado com sucesso! O arquivo JSON foi salvo no seu dispositivo.</span>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={handleExportJson}
              disabled={loading}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00bda1] text-[#0f4f49] font-black text-xs px-6 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Gerando arquivo...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Baixar Pacote JSON Completo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </SystemPageLayout>
  );
}
