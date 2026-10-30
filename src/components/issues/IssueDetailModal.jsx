import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  Eye,
  Lock,
  MessageSquare,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { isAdminUser } from "@/lib/professionalAccess";
import { backend } from "@/api/backendClient";

const STATUS_CONFIG = {
  recebido: {
    label: "Recebido",
    badgeClass: "bg-slate-100 text-slate-800 border-slate-200",
    dotClass: "bg-slate-400",
  },
  em_analise: {
    label: "Em análise",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
    dotClass: "bg-blue-500",
  },
  em_correcao: {
    label: "Em correção",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
    dotClass: "bg-amber-500",
  },
  resolvido: {
    label: "Resolvido",
    badgeClass: "bg-[#E8FCF8] text-[#009b84] border-[#00d8b8]/30",
    dotClass: "bg-[#00d8b8]",
  },
  encerrado: {
    label: "Encerrado",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
    dotClass: "bg-gray-400",
  },
};

const PRIORITY_CONFIG = {
  baixa: { label: "Baixa", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
  media: { label: "Média", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
  alta: { label: "Alta", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  critica: { label: "Crítica", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
};

export default function IssueDetailModal({ open, onOpenChange, issue, onIssueUpdated }) {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [activeIssue, setActiveIssue] = useState(issue);
  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Controles de Admin
  const [selectedStatus, setSelectedStatus] = useState(issue?.status || "recebido");
  const [selectedPriority, setSelectedPriority] = useState(issue?.priority || "media");
  const [adminResponseText, setAdminResponseText] = useState("");
  const [internalNotesText, setInternalNotesText] = useState(issue?.internal_notes || "");
  const [savingAdminChanges, setSavingAdminChanges] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState("");

  // Visualização de imagem em lightbox
  const [zoomedImage, setZoomedImage] = useState(null);
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    if (issue) {
      setActiveIssue(issue);
      setSelectedStatus(issue.status || "recebido");
      setSelectedPriority(issue.priority || "media");
      setInternalNotesText(issue.internal_notes || "");
      setAdminResponseText("");
      setAdminSuccessMsg("");

      // Marca como lido pelo usuário ou admin
      backend.entities.Issue.markAsRead(issue.id, !isAdmin).catch(() => {});
    }
  }, [issue, isAdmin]);

  if (!activeIssue) return null;

  const statusInfo = STATUS_CONFIG[activeIssue.status] || STATUS_CONFIG.recebido;
  const priorityInfo = PRIORITY_CONFIG[activeIssue.priority] || PRIORITY_CONFIG.media;

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

  // Enviar comentário / informação complementar
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const updated = await backend.entities.Issue.addComment(activeIssue.id, {
        message: commentText.trim(),
        is_internal: Boolean(isInternalComment && isAdmin),
      });
      setActiveIssue(updated);
      setCommentText("");
      setIsInternalComment(false);
      if (onIssueUpdated) onIssueUpdated(updated);
    } catch (err) {
      console.error("Erro ao adicionar comentário:", err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // Salvar alterações de status/prioridade pelo Administrador
  const handleSaveAdminStatus = async () => {
    setSavingAdminChanges(true);
    setAdminSuccessMsg("");

    try {
      const updated = await backend.entities.Issue.updateStatusAndPriority(activeIssue.id, {
        status: selectedStatus,
        priority: selectedPriority,
        admin_response: adminResponseText.trim(),
        internal_notes: internalNotesText,
      });

      setActiveIssue(updated);
      setAdminResponseText("");
      setAdminSuccessMsg("Status e observações atualizados com sucesso!");
      setTimeout(() => setAdminSuccessMsg(""), 4000);
      if (onIssueUpdated) onIssueUpdated(updated);
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    } finally {
      setSavingAdminChanges(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border-[#E2E8F0] bg-white p-6 shadow-2xl">
          {/* Cabeçalho */}
          <div className="space-y-3 border-b border-[#F1F5F9] pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-[#0F172A] bg-[#F1F5F9] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                  {activeIssue.protocol}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dotClass}`} />
                  {statusInfo.label}
                </span>

                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${priorityInfo.badgeClass}`}
                >
                  Prioridade: {priorityInfo.label}
                </span>
              </div>

              <div className="text-right text-[11px] font-semibold text-[#64748B]">
                Aberto em: {formatDate(activeIssue.created_date)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {activeIssue.type === "erro" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                    <AlertOctagon className="h-3.5 w-3.5" /> Erro
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5" /> Aviso
                  </span>
                )}
                <span className="text-xs font-bold text-[#64748B] bg-slate-100 px-2 py-0.5 rounded-md">
                  Módulo: {activeIssue.module}
                </span>
                {activeIssue.user_name && (
                  <span className="text-xs text-[#64748B]">
                    Por: <strong className="text-[#0F172A]">{activeIssue.user_name}</strong>
                  </span>
                )}
              </div>
              <h2 className="text-lg font-extrabold text-[#0F172A] leading-snug">
                {activeIssue.title}
              </h2>
            </div>
          </div>

          {/* Conteúdo Principal */}
          <div className="space-y-6 pt-2">
            {/* Descrição do Problema */}
            <div className="space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B]">
                Descrição do Problema
              </h3>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-xs font-medium text-[#0F172A] whitespace-pre-wrap leading-relaxed">
                {activeIssue.description}
              </div>
            </div>

            {/* Como Reproduzir & Resultados Esperados/Encontrados */}
            {(activeIssue.steps_to_reproduce || activeIssue.expected_result || activeIssue.actual_result) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeIssue.steps_to_reproduce && (
                  <div className="sm:col-span-2 space-y-1">
                    <p className="text-[11px] font-bold text-[#64748B]">Passos para reproduzir:</p>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#334155] whitespace-pre-wrap">
                      {activeIssue.steps_to_reproduce}
                    </div>
                  </div>
                )}

                {activeIssue.expected_result && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-[#64748B]">Resultado esperado:</p>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#334155]">
                      {activeIssue.expected_result}
                    </div>
                  </div>
                )}

                {activeIssue.actual_result && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-[#64748B]">Resultado encontrado:</p>
                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#334155]">
                      {activeIssue.actual_result}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Anexos Enviados */}
            {activeIssue.attachments && activeIssue.attachments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B]">
                  Anexos ({activeIssue.attachments.length})
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {activeIssue.attachments.map((att) => (
                    <div
                      key={att.id}
                      onClick={() => setZoomedImage(att)}
                      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[#E2E8F0] bg-white p-1 hover:border-[#00d8b8] transition-all"
                    >
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="h-28 w-full object-cover rounded-lg group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                        <Eye className="h-5 w-5 text-white" />
                      </div>
                      <p className="mt-1 truncate text-[10px] font-bold text-[#0F172A] px-1">
                        {att.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Informações Técnicas Coletadas */}
            {activeIssue.technical_info && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs">
                <button
                  type="button"
                  onClick={() => setShowTechDetails(!showTechDetails)}
                  className="w-full flex items-center justify-between text-left font-bold text-[#0F172A] hover:text-[#009b84]"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#00d8b8]" />
                    <span>Informações Técnicas do Ambiente</span>
                  </div>
                  {showTechDetails ? (
                    <ChevronUp className="h-4 w-4 text-[#64748B]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#64748B]" />
                  )}
                </button>

                {showTechDetails && (
                  <div className="mt-3 pt-3 border-t border-[#E2E8F0] grid grid-cols-2 gap-2 text-[11px] font-mono text-[#475467]">
                    <p><strong>Navegador:</strong> {activeIssue.technical_info.browser || "N/A"}</p>
                    <p><strong>Sistema Operacional:</strong> {activeIssue.technical_info.os || "N/A"}</p>
                    <p><strong>Rota:</strong> {activeIssue.technical_info.route || "/"}</p>
                    <p><strong>Resolução:</strong> {activeIssue.technical_info.screen_resolution || "N/A"}</p>
                    <p><strong>Versão App:</strong> {activeIssue.technical_info.app_version || "1.4.0"}</p>
                    <p><strong>Horário:</strong> {formatDate(activeIssue.technical_info.timestamp)}</p>
                  </div>
                )}
              </div>
            )}

            {/* Linha do Tempo de Atualizações */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#00d8b8]" />
                Linha do Tempo e Evolução do Atendimento
              </h3>

              <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#E2E8F0]">
                {activeIssue.timeline && activeIssue.timeline.map((event, idx) => (
                  <div key={event.id || idx} className="relative">
                    <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-white bg-[#00d8b8] shadow-sm" />
                    <div>
                      <p className="text-xs font-bold text-[#0F172A]">{event.title}</p>
                      <p className="text-[11px] text-[#64748B]">{event.details}</p>
                      <span className="text-[10px] text-[#94A3B8]">
                        {formatDate(event.timestamp)} • {event.actor_name} ({event.actor_role === "admin" ? "Equipe Nacif" : "Usuário"})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interações e Respostas da Equipe */}
            <div className="space-y-3 border-t border-[#F1F5F9] pt-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[#00d8b8]" />
                Respostas e Mensagens
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {activeIssue.comments && activeIssue.comments.filter((c) => !c.is_internal || isAdmin).length > 0 ? (
                  activeIssue.comments
                    .filter((c) => !c.is_internal || isAdmin)
                    .map((comm) => (
                      <div
                        key={comm.id}
                        className={`rounded-xl p-3 text-xs space-y-1 border ${
                          comm.is_internal
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : comm.author_role === "admin"
                            ? "bg-[#E8FCF8] border-[#00d8b8]/30 text-[#0F172A]"
                            : "bg-[#F8FAFC] border-[#E2E8F0] text-[#0F172A]"
                        }`}
                      >
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-extrabold flex items-center gap-1">
                            {comm.is_internal && <Lock className="h-3 w-3 text-amber-600" />}
                            {comm.author_name}
                            {comm.author_role === "admin" && (
                              <span className="rounded bg-[#0F172A] text-white px-1 py-0.2 text-[9px]">
                                Equipe Técnica
                              </span>
                            )}
                            {comm.is_internal && (
                              <span className="rounded bg-amber-200 text-amber-800 px-1 py-0.2 text-[9px]">
                                Nota Interna
                              </span>
                            )}
                          </span>
                          <span className="text-[#64748B]">{formatDate(comm.created_date)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{comm.message}</p>
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-[#94A3B8] italic">
                    Nenhuma mensagem adicional registrada até o momento.
                  </p>
                )}
              </div>

              {/* Formulário de Adicionar Comentário pelo Usuário ou Equipe */}
              <form onSubmit={handleAddComment} className="space-y-2 pt-2">
                <Textarea
                  rows={2}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    isAdmin
                      ? "Escreva uma resposta oficial ou observação..."
                      : "Acrescente informações complementares ao seu relato..."
                  }
                  className="rounded-xl text-xs border-[#CBD5E1] focus-visible:ring-[#00d8b8]"
                />

                <div className="flex justify-between items-center">
                  {isAdmin ? (
                    <label className="flex items-center gap-1.5 text-xs text-[#64748B] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternalComment}
                        onChange={(e) => setIsInternalComment(e.target.checked)}
                        className="rounded border-[#CBD5E1] text-[#00d8b8] focus:ring-[#00d8b8]"
                      />
                      <span>Observação interna (visível apenas para admins)</span>
                    </label>
                  ) : <div />}

                  <Button
                    type="submit"
                    disabled={submittingComment || !commentText.trim()}
                    className="h-8 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-[#0F172A] font-extrabold text-xs px-4 gap-1.5 shadow-sm"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Enviar Mensagem
                  </Button>
                </div>
              </form>
            </div>

            {/* Painel Administrativo de Gestão (Visível apenas para Administradores) */}
            {isAdmin && (
              <div className="rounded-2xl border border-[#00d8b8]/30 bg-[#F0FDFB] p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-[#00d8b8]/20 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-[#009b84]" />
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#0F172A]">
                      Gerenciamento Administrativo
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-[#009b84] bg-white px-2 py-0.5 rounded-full border border-[#00d8b8]/30">
                    Acesso Restrito
                  </span>
                </div>

                {adminSuccessMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs font-bold text-emerald-800">
                    {adminSuccessMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0F172A]">Alterar Status:</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A]"
                    >
                      <option value="recebido">Recebido</option>
                      <option value="em_analise">Em análise</option>
                      <option value="em_correcao">Em correção</option>
                      <option value="resolvido">Resolvido</option>
                      <option value="encerrado">Encerrado</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-[#0F172A]">Definir Prioridade:</label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => setSelectedPriority(e.target.value)}
                      className="h-9 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-xs font-semibold text-[#0F172A]"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Resposta Oficial da Equipe (notifica o usuário):
                  </label>
                  <Textarea
                    rows={2}
                    value={adminResponseText}
                    onChange={(e) => setAdminResponseText(e.target.value)}
                    placeholder="Ex: Identificamos a causa do desalinhamento e a correção será lançada na versão 1.4.1..."
                    className="rounded-xl text-xs border-[#CBD5E1] bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Notas Internas da Equipe (oculto para o usuário):
                  </label>
                  <Textarea
                    rows={2}
                    value={internalNotesText}
                    onChange={(e) => setInternalNotesText(e.target.value)}
                    placeholder="Anotações para a equipe técnica sobre logs, PRs ou branch de correção..."
                    className="rounded-xl text-xs border-[#CBD5E1] bg-white"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    onClick={handleSaveAdminStatus}
                    disabled={savingAdminChanges}
                    className="h-9 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-extrabold text-xs px-5 shadow-sm"
                  >
                    {savingAdminChanges ? "Salvando alterações..." : "Salvar Atualizações"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox / Zoom do Anexo */}
      {zoomedImage && (
        <Dialog open={Boolean(zoomedImage)} onOpenChange={() => setZoomedImage(null)}>
          <DialogContent className="max-w-4xl p-2 bg-black/90 border-0 rounded-2xl flex flex-col items-center justify-center">
            <div className="flex justify-between items-center w-full px-4 py-2 text-white">
              <span className="text-xs font-bold">{zoomedImage.name}</span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="text-white hover:text-[#00d8b8]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={zoomedImage.dataUrl}
              alt={zoomedImage.name}
              className="max-h-[80vh] w-auto object-contain rounded-lg"
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
