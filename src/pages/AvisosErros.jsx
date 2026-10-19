import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  MessageSquare,
  Plus,
  Search,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { hasFullSystemAccess, isSuperAdmin } from "@/lib/professionalAccess";
import { backend } from "@/api/backendClient";
import { ISSUES_CHANGED_EVENT } from "@/lib/issuePersistence";
import ReportIssueModal from "@/components/issues/ReportIssueModal";
import IssueDetailModal from "@/components/issues/IssueDetailModal";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os Status" },
  { value: "recebido", label: "Recebido" },
  { value: "em_analise", label: "Em análise" },
  { value: "em_correcao", label: "Em correção" },
  { value: "resolvido", label: "Resolvido" },
  { value: "encerrado", label: "Encerrado" },
];

const TYPE_OPTIONS = [
  { value: "todos", label: "Todos os Tipos" },
  { value: "erro", label: "Apenas Erros" },
  { value: "aviso", label: "Apenas Avisos" },
];

const MODULE_OPTIONS = [
  "Todos os Módulos",
  "Dashboard",
  "Projetos",
  "Planta Elétrica",
  "Quadro Elétrico",
  "Projeto Solar",
  "Diagrama Unifilar",
  "Calculadora",
  "Assistente IA",
  "Biblioteca NBR",
  "Orçamento",
  "Outros",
];

const STATUS_BADGES = {
  recebido: {
    label: "Recebido",
    className: "bg-slate-100 text-slate-800 border-slate-200",
    dot: "bg-slate-400",
  },
  em_analise: {
    label: "Em análise",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  em_correcao: {
    label: "Em correção",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  resolvido: {
    label: "Resolvido",
    className: "bg-[#E8FCF8] text-[#009b84] border-[#00d8b8]/30",
    dot: "bg-[#00d8b8]",
  },
  encerrado: {
    label: "Encerrado",
    className: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  },
};

export default function AvisosErros() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = Boolean(hasFullSystemAccess(user) || user?.role === "admin" || user?.role === "super_admin" || isSuperAdmin(user) || user?.email === "admin@nacif.com" || user?.email === "grc22.09@hotmail.com");

  // Estado das abas (Meus Relatos / Painel Admin)
  const [activeTab, setActiveTab] = useState(isAdmin ? "admin" : "user");
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [moduleFilter, setModuleFilter] = useState("Todos os Módulos");
  const [sortOrder, setSortOrder] = useState("desc"); // "desc" (mais recentes) ou "asc"

  // Modais
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Carrega lista de relatos
  const fetchIssues = async () => {
    setLoading(true);
    try {
      const data = await backend.entities.Issue.list({
        userOnly: activeTab === "user",
        sortBy: sortOrder === "desc" ? "-created_date" : "created_date",
      });
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao carregar relatos:", err);
      setIssues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [activeTab, sortOrder]);

  // Listener para eventos de atualização de relatos
  useEffect(() => {
    const handleIssuesChanged = () => {
      fetchIssues();
    };

    window.addEventListener(ISSUES_CHANGED_EVENT, handleIssuesChanged);
    return () => window.removeEventListener(ISSUES_CHANGED_EVENT, handleIssuesChanged);
  }, [activeTab, sortOrder]);

  // Abertura automática por query param (?issue=id)
  useEffect(() => {
    const issueIdFromUrl = searchParams.get("issue");
    if (issueIdFromUrl) {
      backend.entities.Issue.get(issueIdFromUrl)
        .then((found) => {
          if (found) {
            setSelectedIssue(found);
            setDetailModalOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const total = issues.length;
    const recebidos = issues.filter((i) => i.status === "recebido").length;
    const emAnalise = issues.filter((i) => i.status === "em_analise").length;
    const emCorrecao = issues.filter((i) => i.status === "em_correcao").length;
    const resolvidos = issues.filter((i) => i.status === "resolvido").length;
    return { total, recebidos, emAnalise, emCorrecao, resolvidos };
  }, [issues]);

  // Filtragem local refinada
  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = issue.title?.toLowerCase().includes(q);
        const matchesProtocol = issue.protocol?.toLowerCase().includes(q);
        const matchesModule = issue.module?.toLowerCase().includes(q);
        const matchesUser = issue.user_name?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesProtocol && !matchesModule && !matchesUser) {
          return false;
        }
      }

      // Filtro Status
      if (statusFilter !== "todos" && issue.status !== statusFilter) {
        return false;
      }

      // Filtro Tipo
      if (typeFilter !== "todos" && issue.type !== typeFilter) {
        return false;
      }

      // Filtro Módulo
      if (moduleFilter !== "Todos os Módulos" && issue.module !== moduleFilter) {
        return false;
      }

      return true;
    });
  }, [issues, searchQuery, statusFilter, typeFilter, moduleFilter]);

  const handleOpenDetail = (issue) => {
    setSelectedIssue(issue);
    setDetailModalOpen(true);
    setSearchParams({ issue: issue.id });
  };

  const handleCloseDetail = (open) => {
    setDetailModalOpen(open);
    if (!open) {
      searchParams.delete("issue");
      setSearchParams(searchParams);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return "-";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 font-sans">
      {/* Container Principal */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8 space-y-6">
        {/* Cabeçalho da Página */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E2E8F0] pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
              Avisos e Erros
            </h1>
            <p className="text-xs sm:text-sm text-[#64748B] max-w-2xl">
              Encontrou algum problema no sistema? Informe nossa equipe e acompanhe a resolução.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-black text-xs px-5 shadow-sm gap-2"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              Reportar problema
            </Button>
          </div>
        </div>

        {/* Abas para Administradores (Meus Relatos / Painel Administrativo) */}
        {isAdmin && (
          <div className="flex border-b border-[#E2E8F0] gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "admin"
                  ? "border-[#00d8b8] text-[#0F172A]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <ShieldAlert className="h-4 w-4 text-[#009b84]" />
              Painel Administrativo
              <span className="rounded-md bg-[#E8FCF8] text-[#009b84] px-1.5 py-0.5 text-[10px] font-black">
                {issues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("user")}
              className={`pb-3 text-xs font-black transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "user"
                  ? "border-[#00d8b8] text-[#0F172A]"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              Meus Relatos
            </button>
          </div>
        )}

        {/* Cards de Métricas / Resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-[#64748B]">Total Registrado</p>
            <p className="text-xl font-black text-[#0F172A]">{stats.total}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-slate-600">Recebidos</p>
            <p className="text-xl font-black text-slate-800">{stats.recebidos}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-blue-600">Em Análise</p>
            <p className="text-xl font-black text-blue-700">{stats.emAnalise}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1">
            <p className="text-[11px] font-bold text-amber-600">Em Correção</p>
            <p className="text-xl font-black text-amber-700">{stats.emCorrecao}</p>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-1 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-[#009b84]">Resolvidos</p>
            <p className="text-xl font-black text-[#009b84]">{stats.resolvidos}</p>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Campo de Busca */}
            <div className="sm:col-span-4 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#94A3B8]" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, protocolo ou módulo..."
                className="h-9 pl-9 rounded-xl text-xs font-medium border-[#CBD5E1] focus-visible:ring-[#00d8b8]"
              />
            </div>

            {/* Filtro Status */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00d8b8]"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Tipo */}
            <div className="sm:col-span-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00d8b8]"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Módulo */}
            <div className="sm:col-span-3">
              <select
                value={moduleFilter}
                onChange={(e) => setModuleFilter(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#00d8b8]"
              >
                {MODULE_OPTIONS.map((mod) => (
                  <option key={mod} value={mod}>
                    {mod}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#64748B] pt-1">
            <span>
              Exibindo <strong>{filteredIssues.length}</strong> de{" "}
              <strong>{issues.length}</strong> relato(s)
            </span>

            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
              className="flex items-center gap-1 font-bold text-[#0F172A] hover:text-[#009b84]"
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortOrder === "desc" ? "Mais recentes primeiro" : "Mais antigos primeiro"}
            </button>
          </div>
        </div>

        {/* Lista de Relatos */}
        {loading ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center text-xs text-[#64748B]">
            Carregando relatos...
          </div>
        ) : filteredIssues.length === 0 ? (
          // Estado Vazio Elegante
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F1F5F9] text-[#64748B] mx-auto">
              <CheckCircle2 className="h-6 w-6 text-[#00d8b8]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-[#0F172A]">
                Nenhum problema reportado até o momento.
              </h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                {searchQuery || statusFilter !== "todos" || typeFilter !== "todos" || moduleFilter !== "Todos os Módulos"
                  ? "Nenhum resultado corresponde aos filtros aplicados. Tente ajustar os termos da pesquisa."
                  : "Todos os módulos estão operando normalmente. Caso encontre alguma falha, envie seu relato."}
              </p>
            </div>

            <Button
              type="button"
              onClick={() => setReportModalOpen(true)}
              className="h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-black text-xs px-5 shadow-sm"
            >
              + Reportar problema
            </Button>
          </div>
        ) : (
          // Tabela / Cards de Relatos
          <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-sm divide-y divide-[#F1F5F9]">
            {filteredIssues.map((item) => {
              const statusCfg = STATUS_BADGES[item.status] || STATUS_BADGES.recebido;
              const hasUnread = (activeTab === "user" && item.unread_user) || (activeTab === "admin" && item.unread_admin);

              return (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className="group p-4 hover:bg-[#F8FAFC] transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-black text-[#0F172A] bg-[#F1F5F9] px-2 py-0.5 rounded-md border border-[#E2E8F0]">
                        {item.protocol}
                      </span>

                      {item.type === "erro" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          <AlertOctagon className="h-3 w-3" /> Erro
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                          <AlertTriangle className="h-3 w-3" /> Aviso
                        </span>
                      )}

                      <span className="text-[11px] font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-md">
                        {item.module}
                      </span>

                      {hasUnread && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#009b84] bg-[#E8FCF8] px-2 py-0.5 rounded-full">
                          Nova atualização
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[#0F172A] group-hover:text-[#009b84] transition-colors truncate">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#64748B]">
                      <span>Aberto: {formatDate(item.created_date)}</span>
                      <span>•</span>
                      <span>Atualizado: {formatDate(item.updated_date)}</span>
                      {isAdmin && activeTab === "admin" && item.user_name && (
                        <>
                          <span>•</span>
                          <span>Por: <strong>{item.user_name}</strong></span>
                        </>
                      )}
                      {item.comments && item.comments.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-bold text-[#0F172A]">
                            <MessageSquare className="h-3 w-3 text-[#00d8b8]" />
                            {item.comments.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.className}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl text-xs font-bold border-[#CBD5E1] text-[#0F172A] group-hover:border-[#00d8b8]"
                    >
                      Ver detalhes
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Criação de Relato */}
      <ReportIssueModal
        open={reportModalOpen}
        onOpenChange={setReportModalOpen}
        onIssueCreated={(newIssue) => {
          fetchIssues();
          setSelectedIssue(newIssue);
          setDetailModalOpen(true);
        }}
      />

      {/* Modal de Detalhes e Acompanhamento */}
      <IssueDetailModal
        open={detailModalOpen}
        onOpenChange={handleCloseDetail}
        issue={selectedIssue}
        onIssueUpdated={() => fetchIssues()}
      />
    </div>
  );
}
