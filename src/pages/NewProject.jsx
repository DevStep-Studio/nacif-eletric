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

      {/* Seletor Superior de Disciplina: Instalações Elétricas vs Projeto Solar */}
      <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-3 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { value: "Instalações Elétricas", label: "Instalações elétricas", icon: Zap },
            { value: "Solar", label: "Projeto solar", icon: Sun },
          ].map((item) => {
            const Icon = item.icon;
            const active = form.project_type === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setForm({ ...form, project_type: item.value })}
                className={`flex h-14 items-center justify-center gap-3 rounded-xl border-2 text-center transition-all ${
                  active
                    ? "border-primary bg-primary/[0.04] text-primary font-black shadow-sm ring-1 ring-primary/20"
                    : "border-slate-200 bg-white text-slate-600 font-bold hover:border-slate-300 hover:bg-slate-50/60"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    active ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-sm">{item.label}</span>
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
