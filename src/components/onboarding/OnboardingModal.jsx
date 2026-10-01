import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  Compass,
  Cpu,
  Factory,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  HardHat,
  Home,
  Loader2,
  Plus,
  ScanLine,
  Sparkles,
  User,
  Wrench,
  Zap,
} from "lucide-react";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const PROFILES = [
  { id: "engineer", label: "Engenheiro eletricista", icon: HardHat },
  { id: "technician", label: "Técnico / Eletricista", icon: Wrench },
  { id: "designer", label: "Projetista", icon: Compass },
  { id: "company", label: "Empresa de Engenharia / Instalação", icon: Building2 },
  { id: "student", label: "Estudante", icon: GraduationCap },
  { id: "other", label: "Outro", icon: User },
];

const GOALS = [
  { id: "new_project", label: "Criar um projeto elétrico do zero", desc: "Fluxo guiado com planta, circuitos e quadro", icon: Plus, target: "/projects/new" },
  { id: "import_plan", label: "Importar uma planta baixa", desc: "Carregar imagem ou DWG no editor", icon: Zap, target: "/planta-ia" },
  { id: "scan_ai", label: "Digitalizar uma planta com IA", desc: "Reconhecimento de paredes e pontos", icon: ScanLine, target: "/scanner" },
  { id: "explore", label: "Apenas explorar o sistema", desc: "Acessar o Dashboard e as ferramentas", icon: Compass, target: "/" },
];

const PROJECT_TYPES = [
  { id: "residential", label: "Residencial", desc: "Casas unifamiliares e apartamentos", icon: Home },
  { id: "commercial", label: "Comercial", desc: "Salas, lojas e escritórios", icon: Building2 },
  { id: "industrial", label: "Industrial", desc: "Galpões e indústrias de pequeno/médio porte", icon: Factory },
  { id: "condo", label: "Condomínios", desc: "Edifícios e loteamentos", icon: Building2 },
];

export default function OnboardingModal({ user, open, onComplete }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState("engineer");
  const [goal, setGoal] = useState("new_project");
  const [projectType, setProjectType] = useState("residential");
  const [mode, setMode] = useState("guided"); // "guided" | "free"
  const [saving, setSaving] = useState(false);

  const handleFinish = async () => {
    setSaving(true);
    try {
      const selectedGoalObj = GOALS.find((g) => g.id === goal);
      const targetUrl = selectedGoalObj?.target || "/";

      await backend.auth.updateMe({
        onboarding_completed: true,
        onboarding_profile: profile,
        onboarding_goal: goal,
        onboarding_project_type: projectType,
        onboarding_mode: mode,
        guided_mode: mode === "guided",
      });

      onComplete?.();
      navigate(targetUrl);
    } catch (err) {
      console.error("Erro ao salvar onboarding:", err);
      onComplete?.();
      navigate("/");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="max-w-xl overflow-hidden rounded-[16px] border-[#E4E7EC] bg-white p-0 shadow-2xl sm:max-w-xl">
        {/* Barra de Progresso Superior do Onboarding */}
        <div className="h-1.5 w-full bg-[#EAECF0]">
          <div
            className="h-full bg-[#00d8b8] transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* TELA 1: Boas-vindas */}
          {step === 1 && (
            <div className="text-center py-4 space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E8FCF8] text-[#00d8b8] shadow-sm ring-1 ring-[#00d8b8]/30">
                <Zap className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-[#101828]">
                  Bem-vindo ao Nacif Electric ⚡
                </h2>
                <p className="text-sm font-medium text-[#667085] max-w-md mx-auto">
                  Vamos configurar seu espaço de trabalho de engenharia elétrica. Leva menos de 1 minuto.
                </p>
              </div>

              <div className="pt-4">
                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  className="h-11 rounded-xl bg-[#00d8b8] px-8 text-sm font-black text-slate-950 hover:bg-[#00d8b8]/90 shadow-md"
                >
                  Começar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* TELA 2: Perfil */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#00d8b8]">Etapa 1 de 4</p>
                <h3 className="text-xl font-black text-[#101828] mt-1">Como você utiliza o Nacif Electric?</h3>
                <p className="text-xs font-medium text-[#667085] mt-0.5">Selecione a opção que melhor descreve sua atuação.</p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROFILES.map((p) => {
                  const Icon = p.icon;
                  const isSelected = profile === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfile(p.id)}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] ring-2 ring-[#00d8b8]/30 font-bold"
                          : "border-[#EAECF0] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-[#00d8b8] text-slate-950" : "bg-[#F2F4F7] text-[#475467]"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-bold leading-tight">{p.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EAECF0]">
                <button type="button" onClick={() => setStep(1)} className="text-xs font-bold text-[#667085] hover:text-[#101828]">
                  Voltar
                </button>
                <Button type="button" onClick={() => setStep(3)} className="h-10 rounded-xl bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
                  Próximo
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* TELA 3: Primeiro Objetivo */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#00d8b8]">Etapa 2 de 4</p>
                <h3 className="text-xl font-black text-[#101828] mt-1">O que você deseja fazer primeiro?</h3>
                <p className="text-xs font-medium text-[#667085] mt-0.5">Vamos te direcionar logo após o término da configuração.</p>
              </div>

              <div className="space-y-2">
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const isSelected = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGoal(g.id)}
                      className={`w-full flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] ring-2 ring-[#00d8b8]/30"
                          : "border-[#EAECF0] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-[#00d8b8] text-slate-950" : "bg-[#F2F4F7] text-[#475467]"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-[#101828]">{g.label}</p>
                          <p className="truncate text-[11px] font-medium text-[#667085]">{g.desc}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-[#00d8b8] stroke-[3]" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EAECF0]">
                <button type="button" onClick={() => setStep(2)} className="text-xs font-bold text-[#667085] hover:text-[#101828]">
                  Voltar
                </button>
                <Button type="button" onClick={() => setStep(4)} className="h-10 rounded-xl bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
                  Próximo
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* TELA 4: Tipo de Projeto */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#00d8b8]">Etapa 3 de 4</p>
                <h3 className="text-xl font-black text-[#101828] mt-1">Que tipo de projeto você mais desenvolve?</h3>
                <p className="text-xs font-medium text-[#667085] mt-0.5">Isso nos ajuda a sugerir padrões e tabelas NBR adequadas.</p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROJECT_TYPES.map((pt) => {
                  const Icon = pt.icon;
                  const isSelected = projectType === pt.id;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setProjectType(pt.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition ${
                        isSelected
                          ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] ring-2 ring-[#00d8b8]/30"
                          : "border-[#EAECF0] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isSelected ? "bg-[#00d8b8] text-slate-950" : "bg-[#F2F4F7] text-[#475467]"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#101828]">{pt.label}</p>
                        <p className="text-[11px] font-medium text-[#667085] leading-tight mt-0.5">{pt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EAECF0]">
                <button type="button" onClick={() => setStep(3)} className="text-xs font-bold text-[#667085] hover:text-[#101828]">
                  Voltar
                </button>
                <Button type="button" onClick={() => setStep(5)} className="h-10 rounded-xl bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90">
                  Próximo
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* TELA 5: Modo Guiado vs Livre */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-[#00d8b8]">Etapa 4 de 4</p>
                <h3 className="text-xl font-black text-[#101828] mt-1">Como prefere utilizar o sistema?</h3>
                <p className="text-xs font-medium text-[#667085] mt-0.5">Você poderá alterar essa preferência a qualquer momento nas configurações.</p>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMode("guided")}
                  className={`w-full flex items-start gap-3.5 rounded-xl border p-4 text-left transition ${
                    mode === "guided"
                      ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] ring-2 ring-[#00d8b8]/30"
                      : "border-[#EAECF0] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${mode === "guided" ? "border-[#00d8b8] bg-[#00d8b8]" : "border-[#D0D5DD]"}`}>
                    {mode === "guided" && <span className="h-2 w-2 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#101828] flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-[#00d8b8]" /> Modo Guiado (Recomendado)
                    </p>
                    <p className="mt-1 text-xs font-medium text-[#667085] leading-relaxed">
                      O Nacif mostra visualmente a sequência lógica do projeto e recomenda o próximo passo em cada etapa (Planta → Pontos → Circuitos → Quadro → Diagrama).
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("free")}
                  className={`w-full flex items-start gap-3.5 rounded-xl border p-4 text-left transition ${
                    mode === "free"
                      ? "border-[#00d8b8] bg-[#E8FCF8] text-[#0f4f49] ring-2 ring-[#00d8b8]/30"
                      : "border-[#EAECF0] bg-white text-[#344054] hover:bg-[#F9FAFB]"
                  }`}
                >
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${mode === "free" ? "border-[#00d8b8] bg-[#00d8b8]" : "border-[#D0D5DD]"}`}>
                    {mode === "free" && <span className="h-2 w-2 rounded-full bg-slate-950" />}
                  </span>
                  <div>
                    <p className="text-sm font-black text-[#101828]">Modo Livre</p>
                    <p className="mt-1 text-xs font-medium text-[#667085] leading-relaxed">
                      Tenho experiência e desejo navegar livremente entre todas as ferramentas sem sugestões contextuais de fluxo.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#EAECF0]">
                <button type="button" onClick={() => setStep(4)} className="text-xs font-bold text-[#667085] hover:text-[#101828]">
                  Voltar
                </button>
                <Button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="h-10 rounded-xl bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00d8b8]/90 shadow-sm px-6"
                >
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4 stroke-[3]" />}
                  Concluir e Acessar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
