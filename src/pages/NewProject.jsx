import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Sun, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { SOLAR_MODULE_HEIGHT_M, SOLAR_MODULE_WIDTH_M } from "@/lib/solarDesignerGeometry";

export default function NewProject() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    address: "",
    project_type: "Instalações Elétricas",
    voltage: 220,
    supply_type: "Monofásico",
    solar_config: {
      inverter_kw: 5,
      module_wp: 550,
      requested_panel_count: 14,
      roof_area_m2: 45,
      roof_utilization_pct: 75,
      module_width_m: SOLAR_MODULE_WIDTH_M,
      module_height_m: SOLAR_MODULE_HEIGHT_M,
      roof_width_m: 9,
      roof_height_m: 5,
      ac_voltage: 220,
      ac_supply_type: "Bifásico",
    },
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const payload = form.project_type === "Solar"
      ? { ...form, voltage: form.solar_config.ac_voltage, supply_type: form.solar_config.ac_supply_type }
      : form;
    const project = await backend.entities.Project.create(payload);
    navigate(form.project_type === "Solar" ? `/solar-project?project=${project.id}` : `/circuit-editor?project=${project.id}`);
  };

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={Plus}
        title="Novo Projeto"
        subtitle="Cadastre os dados iniciais para dimensionamento, quadro e documentação."
        actions={
          <Button type="button" variant="outline" className="h-11 rounded-[12px] font-extrabold" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />Voltar
          </Button>
        }
      />

      <div className="mx-auto w-full max-w-2xl space-y-4 p-6 rounded-2xl bg-card border border-border/50">
        <div className="grid gap-3 sm:grid-cols-2">
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
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border bg-white hover:border-primary/40"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-extrabold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <Label>Nome do Projeto *</Label>
          <Input placeholder="Ex: Residência João Silva" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Input placeholder="Nome do cliente" value={form.client_name} onChange={e => setForm({...form, client_name: e.target.value})} />
        </div>
        <div className="space-y-2">
          <Label>Endereço</Label>
          <Input placeholder="Endereço da obra" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tensão (V)</Label>
            <Select value={String(form.voltage)} onValueChange={v => setForm({...form, voltage: Number(v)})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="127">127V</SelectItem>
                <SelectItem value="220">220V</SelectItem>
                <SelectItem value="380">380V</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Alimentação</Label>
            <Select value={form.supply_type} onValueChange={v => setForm({...form, supply_type: v})}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monofásico">Monofásico</SelectItem>
                <SelectItem value="Bifásico">Bifásico</SelectItem>
                <SelectItem value="Trifásico">Trifásico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {form.project_type === "Solar" && (
          <div className="grid gap-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Potência do inversor (kW)</Label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={form.solar_config.inverter_kw}
                onChange={(e) => setForm({ ...form, solar_config: { ...form.solar_config, inverter_kw: Number(e.target.value) } })}
              />
            </div>
            <div className="space-y-2">
              <Label>Potência do painel (Wp)</Label>
              <Input
                type="number"
                min="300"
                step="10"
                value={form.solar_config.module_wp}
                onChange={(e) => setForm({ ...form, solar_config: { ...form.solar_config, module_wp: Number(e.target.value) } })}
              />
            </div>
            <div className="space-y-2">
              <Label>Quantidade de painéis</Label>
              <Input
                type="number"
                min="1"
                max="1200"
                step="1"
                value={form.solar_config.requested_panel_count}
                onChange={(e) => setForm({ ...form, solar_config: { ...form.solar_config, requested_panel_count: Number(e.target.value) } })}
              />
            </div>
            <div className="space-y-2">
              <Label>Largura estimada do telhado (m)</Label>
              <Input
                type="number"
                min="1"
                step="0.5"
                value={form.solar_config.roof_width_m}
                onChange={(e) => setForm({ ...form, solar_config: { ...form.solar_config, roof_width_m: Number(e.target.value), roof_area_m2: Number(e.target.value) * form.solar_config.roof_height_m } })}
              />
            </div>
            <div className="space-y-2">
              <Label>Altura estimada do telhado (m)</Label>
              <Input
                type="number"
                min="1"
                step="0.5"
                value={form.solar_config.roof_height_m}
                onChange={(e) => setForm({ ...form, solar_config: { ...form.solar_config, roof_height_m: Number(e.target.value), roof_area_m2: form.solar_config.roof_width_m * Number(e.target.value) } })}
              />
            </div>
          </div>
        )}
        <Button onClick={handleSave} disabled={!form.name || saving} className="w-full">
          {saving ? "Salvando..." : "Criar Projeto"}
        </Button>
      </div>
    </div>
  );
}
