import { useEffect, useState } from "react";
import {
  CreditCard,
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  FileText,
  Search,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMMERCIAL_PLANS, PLAN_COMPARISON_ROWS, getPlanByCode } from "@/lib/subscriptionPlans";

export default function AdminSubscriptionManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSubTab, setActiveSubTab] = useState("overview");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      if (backend?.subscriptions?.listAllUsers) {
        const list = await backend.subscriptions.listAllUsers();
        setUsers(Array.isArray(list) ? list : []);
      } else if (backend?.entities?.User?.list) {
        const list = await backend.entities.User.list();
        setUsers(Array.isArray(list) ? list : []);
      }
    } catch (e) {
      console.warn("Erro ao carregar usuários no AdminSubscriptionManager:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateUserPlan = async (userId, planCode) => {
    setFeedbackMessage("");
    try {
      if (backend?.subscriptions?.adminUpdateUserPlan) {
        await backend.subscriptions.adminUpdateUserPlan(userId, { plan: planCode });
      } else {
        await backend.entities.User.update(userId, { plan: planCode });
      }
      setFeedbackMessage("Plano do usuário atualizado com sucesso!");
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, plan: planCode, plan_code: planCode } : u)),
      );
      setTimeout(() => setFeedbackMessage(""), 4000);
    } catch (err) {
      setFeedbackMessage(err.message || "Erro ao atualizar plano.");
    }
  };

  const handleDecideAcademic = async (userId, decision) => {
    setFeedbackMessage("");
    try {
      if (backend?.subscriptions?.adminDecideAcademic) {
        await backend.subscriptions.adminDecideAcademic(userId, decision);
      } else {
        const sixMonthsAhead = new Date();
        sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
        await backend.entities.User.update(userId, {
          academic_status: decision === "approve" ? "approved" : "rejected",
          academic_valid_until: decision === "approve" ? sixMonthsAhead.toISOString() : null,
          academic_reviewed_at: new Date().toISOString(),
        });
      }
      setFeedbackMessage(
        decision === "approve"
          ? "Vínculo acadêmico aprovado com validade de 6 meses!"
          : "Solicitação acadêmica recusada.",
      );
      loadData();
      setTimeout(() => setFeedbackMessage(""), 4000);
    } catch (err) {
      setFeedbackMessage(err.message || "Erro ao processar solicitação.");
    }
  };

  // Estatísticas calculadas
  const planCounts = {
    estudante: 0,
    eletrico: 0,
    solar: 0,
    completo: 0,
    legado: 0,
  };

  let pendingAcademicCount = 0;
  let estimatedMrr = 0;

  users.forEach((u) => {
    const raw = u.plan || u.plan_code || "free";
    const plan = getPlanByCode(raw);
    if (plan.code === "estudante") {
      planCounts.estudante += 1;
      estimatedMrr += 99.99;
    } else if (plan.code === "eletrico") {
      planCounts.eletrico += 1;
      estimatedMrr += 149.90;
    } else if (plan.code === "solar") {
      planCounts.solar += 1;
      estimatedMrr += 149.90;
    } else if (plan.code === "completo") {
      planCounts.completo += 1;
      estimatedMrr += 210.00;
    } else {
      planCounts.legado += 1;
      if (raw === "professional" || raw === "profissional") estimatedMrr += 49;
      if (raw === "engineering" || raw === "engenharia") estimatedMrr += 99;
    }

    if (u.academic_status === "pending_review") {
      pendingAcademicCount += 1;
    }
  });

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.plan?.toLowerCase().includes(q) ||
      u.academic_institution?.toLowerCase().includes(q)
    );
  });

  const pendingStudents = users.filter(
    (u) => u.academic_status === "pending_review" || u.plan === "estudante",
  );

  return (
    <div className="space-y-6">
      {feedbackMessage && (
        <div className="flex items-center gap-2 rounded-[10px] border border-[#BCEEE5] bg-[#F7FBFE] p-3 text-sm font-semibold text-[#0f4f49]">
          <CheckCircle2 className="h-4 w-4 text-[#00d8b8]" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Indicadores Comerciais */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-[12px] border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">Receita Estimada (MRR)</span>
            <DollarSign className="h-4 w-4 text-[#00d8b8]" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#101828]">
            R$ {estimatedMrr.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-[#667085]">Base ativa de assinaturas</p>
        </div>

        <div className="rounded-[12px] border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">Nacif Completo</span>
            <Badge className="bg-[#E8FCF8] text-[#0f4f49] hover:bg-[#E8FCF8]">Mais completo</Badge>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#101828]">{planCounts.completo}</p>
          <p className="mt-1 text-xs text-[#667085]">Clientes no plano topo</p>
        </div>

        <div className="rounded-[12px] border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">Elétrico & Solar</span>
            <CreditCard className="h-4 w-4 text-[#00d8b8]" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#101828]">
            {planCounts.eletrico + planCounts.solar}
          </p>
          <p className="mt-1 text-xs text-[#667085]">
            {planCounts.eletrico} Elétrico • {planCounts.solar} Solar
          </p>
        </div>

        <div className="rounded-[12px] border border-[#E4E7EC] bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#667085]">Estudantes</span>
            <GraduationCap className="h-4 w-4 text-[#00d8b8]" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-[#101828]">
            {planCounts.estudante}
            {pendingAcademicCount > 0 && (
              <span className="ml-2 text-xs font-bold text-amber-600">({pendingAcademicCount} pendentes)</span>
            )}
          </p>
          <p className="mt-1 text-xs text-[#667085]">Planos acadêmicos ativos</p>
        </div>
      </div>

      {/* Sub-abas de Navegação Administrativa */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAECF0] pb-3">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={activeSubTab === "overview" ? "default" : "outline"}
            onClick={() => setActiveSubTab("overview")}
            className={`h-9 rounded-[8px] text-xs font-extrabold ${activeSubTab === "overview" ? "bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1]" : "border-[#D0D5DD] text-[#344054]"}`}
          >
            Assinaturas de Usuários ({users.length})
          </Button>

          <Button
            type="button"
            variant={activeSubTab === "students" ? "default" : "outline"}
            onClick={() => setActiveSubTab("students")}
            className={`h-9 rounded-[8px] text-xs font-extrabold ${activeSubTab === "students" ? "bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1]" : "border-[#D0D5DD] text-[#344054]"}`}
          >
            Validação de Estudantes
            {pendingAcademicCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] text-white">
                {pendingAcademicCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant={activeSubTab === "plans" ? "default" : "outline"}
            onClick={() => setActiveSubTab("plans")}
            className={`h-9 rounded-[8px] text-xs font-extrabold ${activeSubTab === "plans" ? "bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1]" : "border-[#D0D5DD] text-[#344054]"}`}
          >
            Tabela de Preços e Limites Oficiais
          </Button>
        </div>

        {activeSubTab === "overview" && (
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#98A2B3]" />
            <Input
              placeholder="Buscar por nome, e-mail..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-[8px] border-[#D0D5DD]"
            />
          </div>
        )}
      </div>

      {/* Conteúdo: Sub-aba Assinaturas de Usuários */}
      {activeSubTab === "overview" && (
        <div className="overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
                <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Usuário</TableHead>
                <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Plano Atribuído</TableHead>
                <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Ciclo</TableHead>
                <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Elegibilidade Acadêmica</TableHead>
                <TableHead className="text-xs font-extrabold uppercase text-[#667085] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-[#667085]">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const planObj = getPlanByCode(u.plan || u.plan_code || "free");
                  return (
                    <TableRow key={u.id} className="hover:bg-[#F9FAFB]">
                      <TableCell className="py-3">
                        <p className="font-extrabold text-[#101828] text-sm">{u.full_name || u.email}</p>
                        <p className="text-xs text-[#667085]">{u.email}</p>
                      </TableCell>
                      <TableCell className="py-3">
                        <Select
                          value={planObj.code}
                          onValueChange={(val) => handleUpdateUserPlan(u.id, val)}
                        >
                          <SelectTrigger className="h-8 w-44 rounded-[6px] text-xs font-bold border-[#D0D5DD]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="estudante">Nacif Estudante</SelectItem>
                            <SelectItem value="eletrico">Nacif Elétrico</SelectItem>
                            <SelectItem value="solar">Nacif Solar</SelectItem>
                            <SelectItem value="completo">Nacif Completo</SelectItem>
                            <SelectItem value="free">Gratuito (Legado)</SelectItem>
                            <SelectItem value="professional">Profissional (Legado)</SelectItem>
                            <SelectItem value="engineering">Engenharia (Legado)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="py-3 text-xs font-medium text-[#344054]">
                        {u.subscription_cycle === "annual" ? "Anual (-30%)" : "Mensal"}
                      </TableCell>
                      <TableCell className="py-3">
                        {u.academic_status === "approved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px]">
                            Aprovado
                          </Badge>
                        ) : u.academic_status === "pending_review" ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[11px]">
                            Análise pendente
                          </Badge>
                        ) : u.academic_status === "rejected" ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[11px]">
                            Recusado
                          </Badge>
                        ) : (
                          <span className="text-xs text-[#98A2B3]">Não aplicável</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleUpdateUserPlan(u.id, "completo")}
                          className="h-7 text-xs font-bold text-[#00d8b8] hover:bg-[#E8FCF8]"
                        >
                          Conceder Completo
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Conteúdo: Sub-aba Validação de Estudantes */}
      {activeSubTab === "students" && (
        <div className="space-y-4">
          <div className="rounded-[10px] border border-[#EAECF0] bg-[#F9FAFB] p-4 text-xs font-medium text-[#667085]">
            <p className="font-extrabold text-[#101828]">Diretrizes de Validação Acadêmica:</p>
            <p className="mt-1">
              Verifique se o comprovante emitido pela instituição de ensino possui matrícula ativa em cursos de Engenharia Elétrica, Engenharia de Energia ou Eletrotécnica. A aprovação concede 6 meses de validade automática.
            </p>
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Estudante</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Instituição / Curso</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Comprovante</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Status</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085] text-right">Decisão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-[#667085]">
                      Nenhuma solicitação de comprovação acadêmica pendente.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingStudents.map((st) => (
                    <TableRow key={st.id} className="hover:bg-[#F9FAFB]">
                      <TableCell className="py-3">
                        <p className="font-extrabold text-[#101828] text-sm">{st.full_name || st.email}</p>
                        <p className="text-xs text-[#667085]">{st.email}</p>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-[#344054]">
                        <p className="font-bold">{st.academic_institution || "Instituição não informada"}</p>
                        <p className="text-[#667085]">{st.academic_course || "Curso não informado"}</p>
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        {st.academic_document_name || st.academic_document_url ? (
                          <a
                            href={st.academic_document_url || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 font-bold text-[#00d8b8] underline"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            {st.academic_document_name || "Visualizar Documento"}
                          </a>
                        ) : (
                          <span className="text-[#98A2B3]">Sem anexo</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3">
                        {st.academic_status === "approved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[11px]">
                            Aprovado
                          </Badge>
                        ) : st.academic_status === "rejected" ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 text-[11px]">
                            Recusado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[11px]">
                            Aguardando Análise
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleDecideAcademic(st.id, "approve")}
                            className="h-8 rounded-[6px] bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1] text-xs font-extrabold px-3"
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            Aprovar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDecideAcademic(st.id, "reject")}
                            className="h-8 rounded-[6px] border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold px-2.5"
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Recusar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Conteúdo: Sub-aba Tabela de Preços e Limites Oficiais */}
      {activeSubTab === "plans" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {COMMERCIAL_PLANS.map((plan) => (
              <div
                key={plan.code}
                className="rounded-[12px] border border-[#E4E7EC] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#101828]">{plan.name}</h4>
                  {plan.highlightBadge && (
                    <Badge className="bg-[#E8FCF8] text-[#0f4f49] hover:bg-[#E8FCF8] text-[10px]">
                      {plan.highlightBadge}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xl font-extrabold text-[#101828]">
                  R$ {plan.monthlyPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-[#667085]">/mês</span>
                </p>
                <p className="mt-1 text-xs text-[#667085]">
                  {plan.hasAnnualOption
                    ? `Anual: R$ ${plan.annualPrice?.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (-30%)`
                    : "Apenas contratação mensal"}
                </p>
                <div className="mt-3 border-t border-[#EAECF0] pt-2 text-xs text-[#475467] space-y-1">
                  <p>• Projetos: {plan.limits.projects === Number.POSITIVE_INFINITY ? "Ilimitado" : plan.limits.projects}</p>
                  <p>• Armazenamento: {plan.limits.storageMb >= 1000 ? `${plan.limits.storageMb / 1000} GB` : `${plan.limits.storageMb} MB`}</p>
                  <p>• Membros: {plan.limits.teamMembers}</p>
                  <p>• Exportações: {plan.limits.exports === Number.POSITIVE_INFINITY ? "Ilimitado" : plan.limits.exports}</p>
                  <p>• IA: {plan.limits.aiScans}/mês</p>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[12px] border border-[#E4E7EC] bg-white mt-6">
            <div className="border-b border-[#EAECF0] bg-[#F9FAFB] p-4">
              <h4 className="text-sm font-extrabold text-[#101828]">Matriz Comparativa Oficial</h4>
              <p className="text-xs text-[#667085]">Configuração centralizada que alimenta o sistema e as barreiras de acesso.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Recurso</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Estudante</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Elétrico</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Solar</TableHead>
                  <TableHead className="text-xs font-extrabold uppercase text-[#667085]">Completo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PLAN_COMPARISON_ROWS.map((row) => (
                  <TableRow key={row.key} className="hover:bg-[#F9FAFB]">
                    <TableCell className="py-2.5 text-xs font-bold text-[#101828]">
                      {row.label}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-[#344054]">{row.values.estudante}</TableCell>
                    <TableCell className="py-2.5 text-xs text-[#344054]">{row.values.eletrico}</TableCell>
                    <TableCell className="py-2.5 text-xs text-[#344054]">{row.values.solar}</TableCell>
                    <TableCell className="py-2.5 text-xs font-bold text-[#0f4f49]">{row.values.completo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
