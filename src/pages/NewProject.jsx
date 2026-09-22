import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Sun, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import SolarProjectWizard from "@/components/solar/wizard/SolarProjectWizard";

export default function NewProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    project_type: "Solar",
    voltage: 220,
    supply_type: "Monofásico",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const project = await backend.entities.Project.create(form);
      navigate(`/circuit-editor?project=${project.id}`);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
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
            },
            {
              value: "Solar",
              label: "Projeto Solar Fotovoltaico",
              tag: "Geração Distribuída",
              description: "Leitura de conta por IA, dimensionamento, telhado 3D e memorial.",
              icon: Sun,
            },
          ].map((item) => {
            const Icon = item.icon;
            const active = form.project_type === item.value;
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

      {form.project_type === "Solar" ? (
        <div className="mx-auto w-full max-w-4xl">
          <SolarProjectWizard />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl space-y-4 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">Nome do Projeto *</Label>
            <Input
              placeholder="Ex: Residência João Silva"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-11 font-medium"
            />
          </div>
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
          <Button
            onClick={handleSave}
            disabled={!form.name || saving}
            className="w-full h-12 text-sm font-black bg-primary text-primary-foreground shadow-md hover:bg-primary/90 rounded-xl"
          >
            {saving ? "Salvando..." : "Criar Projeto e Abrir Editor"}
          </Button>
        </div>
      )}
    </div>
  );
}
