import { useRef, useState } from "react";
import { backend } from "@/api/backendClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileText,
  Home,
  Loader2,
  Ruler,
  UploadCloud,
  Zap,
} from "lucide-react";

const ENTRY_METHODS = [
  {
    key: "bill",
    title: "Conta de energia",
    badge: "Recomendado",
    icon: FileText,
    description: "Envie a conta em PDF, JPG ou PNG e confira os dados extraídos.",
  },
  {
    key: "power",
    title: "Potência desejada",
    icon: Zap,
    description: "Informe a potência alvo do sistema (ex: 11,55 kWp).",
  },
  {
    key: "area",
    title: "Área disponível",
    icon: Ruler,
    description: "Use a área do telhado disponível para dimensionar.",
  },
];

function EntryMethodCard({ method, active, onSelect }) {
  const Icon = method.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(method.key)}
      className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition ${
        active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-white hover:border-primary/40"
      }`}
    >
      {method.badge && (
        <span className="absolute right-3 top-3 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-700">
          {method.badge}
        </span>
      )}
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-extrabold text-foreground">{method.title}</p>
      <p className="text-xs font-semibold leading-4 text-muted-foreground">{method.description}</p>
    </button>
  );
}

function BillUploadPanel({ state, onChange }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      onChange({ bill_reading_status: "unavailable", bill_reading_message: "Formato não suportado. Envie PDF, JPG ou PNG." });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      onChange({ bill_reading_status: "unavailable", bill_reading_message: "Arquivo maior que 15MB. Envie um arquivo menor." });
      return;
    }

    setUploading(true);
    onChange({ bill_file_name: file.name, bill_reading_status: "uploading", bill_reading_message: "" });
    try {
      const { file_url } = await backend.integrations.Core.UploadFile({ file });
      onChange({ bill_file_url: file_url, bill_reading_status: "reading" });

      try {
        await backend.integrations.Core.InvokeLLM({
          prompt: "Extraia do arquivo de conta de energia: titular, endereço, distribuidora, classe/modalidade tarifária, consumo mensal (kWh), tarifa (R$/kWh) e demanda contratada (kW), quando presentes. Não invente valores ausentes.",
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              holder_name: { type: "string" },
              address: { type: "string" },
              distributor: { type: "string" },
              tariff_class: { type: "string" },
              monthly_consumption_kwh: { type: "number" },
              tariff_brl_kwh: { type: "number" },
              contracted_demand_kw: { type: "number" },
            },
          },
        });
        // Este caminho só é alcançado quando o backend de IA (não incluído neste
        // repositório) estiver disponível — hoje ele responde 501 em modo local.
        onChange({ bill_reading_status: "done" });
      } catch (aiError) {
        onChange({
          bill_reading_status: "unavailable",
          bill_reading_message: aiError?.message?.includes("backend")
            ? "Leitura automática indisponível: este ambiente roda em modo local, sem o backend de IA. O arquivo foi enviado e fica anexado ao projeto — preencha os dados manualmente abaixo."
            : "Não foi possível ler a conta automaticamente. Preencha os dados manualmente abaixo.",
        });
      }
    } catch {
      onChange({ bill_reading_status: "unavailable", bill_reading_message: "Falha ao enviar o arquivo. Tente novamente." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/jpg,image/png"
        className="hidden"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-border bg-white py-6 text-center hover:border-primary/50 disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-primary" />}
        <span className="text-sm font-bold text-foreground">
          {state.bill_file_name || "Clique para enviar a conta de energia"}
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">PDF, JPG ou PNG até 15MB</span>
      </button>

      {state.bill_reading_status === "reading" && (
        <p className="flex items-center gap-2 text-xs font-bold text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo dados da conta...
        </p>
      )}
      {state.bill_reading_status === "done" && (
        <p className="flex items-center gap-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" /> Dados extraídos com sucesso. Confira nas próximas etapas.
        </p>
      )}
      {state.bill_reading_status === "unavailable" && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {state.bill_reading_message}
        </p>
      )}

      {state.bill_reading_status !== "done" && (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <Label className="text-xs font-bold">Potência desejada (kWp) — preenchimento manual</Label>
          <Input
            type="number"
            min="0.5"
            step="0.05"
            value={state.desired_power_kwp}
            onChange={(event) => onChange({ desired_power_kwp: Number(event.target.value) })}
          />
        </div>
      )}
    </div>
  );
}

export default function StepDadosProjeto({ state, onChange }) {
  const setField = (field, value) => onChange({ [field]: value });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do projeto *</Label>
          <Input placeholder="Ex: Residência João Silva" value={state.name} onChange={(e) => setField("name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Input placeholder="Nome do cliente" value={state.client_name} onChange={(e) => setField("client_name", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { value: "Residencial", icon: Home },
          { value: "Comercial", icon: Building2 },
        ].map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setField("installation_type", value)}
            className={`flex items-center justify-center gap-2 rounded-lg border-2 py-2.5 text-sm font-extrabold transition ${
              state.installation_type === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-white text-muted-foreground"
            }`}
          >
            <Icon className="h-4 w-4" /> {value}
          </button>
        ))}
      </div>

      <div>
        <p className="mb-2 text-sm font-extrabold text-foreground">Como deseja iniciar o projeto?</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {ENTRY_METHODS.map((method) => (
            <EntryMethodCard key={method.key} method={method} active={state.entry_method === method.key} onSelect={(key) => setField("entry_method", key)} />
          ))}
        </div>
      </div>

      {state.entry_method === "bill" && (
        <BillUploadPanel state={state} onChange={onChange} />
      )}

      {state.entry_method === "power" && (
        <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Potência desejada (kWp)</Label>
            <Input type="number" min="0.5" step="0.05" value={state.desired_power_kwp} onChange={(e) => setField("desired_power_kwp", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Potência do módulo (Wp)</Label>
            <Input type="number" min="300" step="10" value={state.module_wp} onChange={(e) => setField("module_wp", Number(e.target.value))} />
          </div>
        </div>
      )}

      {state.entry_method === "area" && (
        <div className="grid gap-3 rounded-xl border border-border bg-white p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Área disponível (m²)</Label>
            <Input type="number" min="4" step="1" value={state.available_area_m2} onChange={(e) => setField("available_area_m2", Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Potência do módulo (Wp)</Label>
            <Input type="number" min="300" step="10" value={state.module_wp} onChange={(e) => setField("module_wp", Number(e.target.value))} />
          </div>
        </div>
      )}

      <div className="grid gap-4 rounded-xl border border-border bg-white p-4 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-extrabold text-foreground">Modo do sistema</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { value: "on-grid", label: "On-grid" },
              { value: "off-grid", label: "Off-grid" },
              { value: "hibrido", label: "Híbrido" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setField("system_mode", option.value)}
                className={`rounded-lg border-2 py-2 text-xs font-extrabold transition ${
                  state.system_mode === option.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:justify-center">
          <Label className="text-xs font-bold">Incluir bateria?</Label>
          <Switch checked={state.has_battery} onCheckedChange={(checked) => setField("has_battery", checked)} />
        </div>
      </div>
    </div>
  );
}
