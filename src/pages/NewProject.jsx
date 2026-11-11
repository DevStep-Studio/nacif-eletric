import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, ArrowLeft, ArrowRight, Lock, Plus, Sun, Zap } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { canAccessModule, checkProjectCreationAllowed, resolveEffectiveSubscription } from "@/lib/subscriptionPlans";
import PageHeader from "@/components/PageHeader";
import SolarProjectWizard from "@/components/solar/wizard/SolarProjectWizard";

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const effectiveSub = resolveEffectiveSubscription(user);
  const defaultDiscipline = effectiveSub.plan.code === "solar" ? "Solar" : "Instalações Elétricas";

  const electricalAccess = useMemo(() => canAccessModule(user, "plant"), [user]);
  const solarAccess = useMemo(() => canAccessModule(user, "solar"), [user]);

  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    city: "",
    project_type: defaultDiscipline,
    voltage: 220,
    supply_type: "Monofásico",
  });
  const [projectsCount, setProjectsCount] = useState(0);

  useEffect(() => {
    backend.entities.Project.list().then((list) => {
      if (Array.isArray(list)) {
        setProjectsCount(list.filter((p) => p.status !== "Arquivado").length);
      }
    }).catch(() => {});
  }, []);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const currentAccess = form.project_type === "Solar" ? solarAccess : electricalAccess;

  const handleSave = async () => {
    if (!form.name.trim()) {
      setErrorMsg("O nome do projeto é obrigatório.");
      return;
    }

    const access = checkProjectCreationAllowed(user, projectsCount, form.project_type);
    if (!access.allowed) {
      setErrorMsg(access.reason || "Você precisa de uma assinatura ativa para criar projetos nesta disciplina.");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      const project = await backend.entities.Project.create({
        ...form,
        name: form.name.trim(),
        client_name: form.client_name.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
      });
      navigate(`/circuit-editor?project=${project.id}`);
    } catch (err) {
      console.error("Erro ao criar projeto:", err);
      setErrorMsg(err?.message || "Não foi possível criar o projeto. Tente novamente.");
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20 crud-tab-enter">
      <PageHeader
        icon={Plus}
        title="Novo Projeto"
        subtitle="Selecione a disciplina e cadastre os parâmetros técnicos de dimensionamento."
        actions={
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl font-extrabold border-slate-200 text-slate-700 hover:bg-slate-50"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar
          </Button>
        }
      />

      {/* Seletor Superior Inovador & Minimalista de Disciplina */}
      <div className="mx-auto w-full max-w-4xl">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              value: "Instalações Elétricas",
              label: "Instalações Elétricas",
              tag: "NBR 5410",
              description: "Quadros de distribuição, circuitos, proteções e diagrama unifilar.",
              icon: Zap,
              access: electricalAccess,
              planBadge: "Nacif Elétrico",
            },
            {
              value: "Solar",
              label: "Projeto Solar Fotovoltaico",
              tag: "Geração Distribuída",
              description: "Leitura de conta por IA, dimensionamento, telhado 3D e memorial.",
              icon: Sun,
              access: solarAccess,
              planBadge: "Nacif Solar",
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = form.project_type === item.value;
            const isLocked = !item.access.allowed;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setForm({ ...form, project_type: item.value })}
                className={`group relative flex items-start justify-between rounded-2xl p-4 text-left transition-all duration-200 cursor-pointer ${
                  active
                    ? "border-2 border-[#00d8b8] bg-white shadow-[0_2px_10px_rgba(0,216,184,0.08)]"
                    : "border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/50 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                }`}
              >
                <div className="flex items-start gap-3.5 pr-2">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors ${
                      active
                        ? "bg-[#00d8b8] text-white"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className={`text-sm font-black transition-colors ${active ? "text-slate-900" : "text-slate-700 group-hover:text-slate-900"}`}>
                        {item.label}
                      </p>
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-600">
                        {item.tag}
                      </span>
                      {isLocked && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">
                          <Lock className="h-2.5 w-2.5" />
                          {item.planBadge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Indicador de Seleção Minimalista */}
                <span
                  className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                    active
                      ? "border-[#00d8b8] bg-[#00d8b8]"
                      : "border-slate-300 bg-white group-hover:border-slate-400"
                  }`}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alerta de Recurso Bloqueado para usuários sem o plano correspondente */}
      {!currentAccess.allowed && (
        <div className="mx-auto w-full max-w-4xl rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/50 p-4 text-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm mt-0.5">
                <Lock className="h-4 w-4" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-800">
                    {form.project_type === "Solar" ? "ABNT NBR 16690 · Energia Solar" : "ABNT NBR 5410 · Instalações Elétricas"}
                  </span>
                  <span className="rounded bg-amber-200/80 px-1.5 py-0.5 text-[9px] font-black text-amber-900">
                    Assinatura Obrigatória
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-600 leading-relaxed max-w-2xl">
                  {currentAccess.message}
                </p>
              </div>
            </div>

            <Button
              asChild
              size="sm"
              className="shrink-0 h-9 rounded-xl bg-[#00D8B8] hover:bg-[#00c5a7] active:bg-[#00b397] text-slate-950 font-black text-xs shadow-[0_2px_8px_rgba(0,216,184,0.25)]"
            >
              <Link to="/subscription" className="flex items-center gap-1.5">
                <span>Assinar Plano</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      )}

      {form.project_type === "Solar" ? (
        !solarAccess.allowed ? (
          <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0E1726] border border-[#00D8B8]/30 text-[#00D8B8] shadow-md">
              <Sun className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-black text-slate-900">Módulo Fotovoltaico (NBR 16690) Bloqueado</h2>
              <p className="text-xs font-medium text-slate-600 max-w-md mx-auto">
                Para criar projetos fotovoltaicos, leitura de contas por IA, telhado 3D e memorial descritivo solar, ative o plano Nacif Solar ou Nacif Completo.
              </p>
            </div>
            <div className="pt-2">
              <Button asChild className="h-11 rounded-xl bg-[#00D8B8] hover:bg-[#00c5a7] text-slate-950 font-extrabold px-6 shadow-md">
                <Link to="/subscription" className="flex items-center gap-2">
                  <span>Ativar Plano Solar</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <SolarProjectWizard />
          </div>
        )
      ) : (
        <div className="mx-auto w-full max-w-2xl space-y-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-bold text-red-700 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{errorMsg}</span>
              </div>
              {(errorMsg.toLowerCase().includes("upgrade") || errorMsg.toLowerCase().includes("plano") || errorMsg.toLowerCase().includes("assinatura")) && (
                <div className="pt-1">
                  <Button asChild size="sm" className="h-8 rounded-[6px] bg-[#00d8b8] text-[#0f172a] hover:bg-[#00bda1] font-extrabold text-xs">
                    <Link to="/subscription">Ver planos disponíveis</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Nome do Projeto *</Label>
            <Input
              placeholder="Ex: Residência João Silva"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 font-medium"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Cliente</Label>
              <Input
                placeholder="Nome do cliente"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className="h-11 font-medium"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Cidade / UF</Label>
              <Input
                placeholder="Ex: Belo Horizonte - MG"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="h-11 font-medium"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Endereço</Label>
            <Input
              placeholder="Endereço da obra"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="h-11 font-medium"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Tensão (V)</Label>
              <Select value={String(form.voltage)} onValueChange={(v) => setForm({ ...form, voltage: Number(v) })}>
                <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="127">127V</SelectItem>
                  <SelectItem value="220">220V</SelectItem>
                  <SelectItem value="380">380V</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-foreground">Alimentação</Label>
              <Select value={form.supply_type} onValueChange={(v) => setForm({ ...form, supply_type: v })}>
                <SelectTrigger className="h-11 font-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Monofásico">Monofásico</SelectItem>
                  <SelectItem value="Bifásico">Bifásico</SelectItem>
                  <SelectItem value="Trifásico">Trifásico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {electricalAccess.allowed ? (
            <Button
              onClick={handleSave}
              disabled={!form.name || saving}
              className="w-full h-12 text-sm font-black bg-primary text-primary-foreground shadow-md hover:bg-primary/90 rounded-xl"
            >
              {saving ? "Salvando..." : "Criar Projeto e Abrir Editor"}
            </Button>
          ) : (
            <Button
              asChild
              className="w-full h-12 text-sm font-black bg-[#00D8B8] hover:bg-[#00c5a7] text-slate-950 shadow-md rounded-xl"
            >
              <Link to="/subscription" className="flex items-center justify-center gap-2">
                <Lock className="h-4 w-4" />
                <span>Assinar Nacif Elétrico para Criar Projeto</span>
              </Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
