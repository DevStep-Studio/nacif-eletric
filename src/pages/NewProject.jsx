import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, MapPin, Plus, Sun, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { SOLAR_MODULE_HEIGHT_M, SOLAR_MODULE_WIDTH_M } from "@/lib/solarDesignerGeometry";
import { geocodeBrazilianAddress } from "@/lib/geocoding";

const BRAZILIAN_STATES = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PR", label: "PR — Paraná" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "TO", label: "TO — Tocantins" },
];

const formatCep = (value) => {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

export default function NewProject() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    client_name: "",
    zip_code: "",
    address: "",
    address_number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
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
  const [cepStatus, setCepStatus] = useState("idle"); // idle | loading | success | error
  const cepRequestRef = useRef(0);

  useEffect(() => {
    const digits = form.zip_code.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepStatus("idle");
      return undefined;
    }

    const requestId = ++cepRequestRef.current;
    setCepStatus("loading");

    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((res) => res.json())
      .then((data) => {
        if (cepRequestRef.current !== requestId) return;
        if (data?.erro) {
          setCepStatus("error");
          return;
        }
        setForm((prev) => ({
          ...prev,
          address: data.logradouro || prev.address,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
          country: prev.country || "Brasil",
        }));
        setCepStatus("success");
      })
      .catch(() => {
        if (cepRequestRef.current !== requestId) return;
        setCepStatus("error");
      });

    return undefined;
  }, [form.zip_code]);

  const [geoStatus, setGeoStatus] = useState("idle"); // idle | loading | success | error
  const geoRequestRef = useRef(0);

  useEffect(() => {
    const number = form.address_number.trim();
    if (!form.address.trim() || !number || !form.city.trim()) {
      setGeoStatus("idle");
      return undefined;
    }

    const requestId = ++geoRequestRef.current;
    const timer = window.setTimeout(() => {
      setGeoStatus("loading");
      geocodeBrazilianAddress({
        street: form.address,
        number,
        city: form.city,
        state: form.state,
        zipCode: form.zip_code,
      }).then((coords) => {
        if (geoRequestRef.current !== requestId) return;
        if (!coords) {
          setGeoStatus("error");
          return;
        }
        setForm((prev) => ({
          ...prev,
          latitude: coords.lat,
          longitude: coords.lng,
          solar_config: { ...prev.solar_config, map_center_lat: coords.lat, map_center_lng: coords.lng, map_zoom: 19 },
        }));
        setGeoStatus("success");
      }).catch(() => {
        if (geoRequestRef.current !== requestId) return;
        setGeoStatus("error");
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [form.address, form.address_number, form.city, form.state, form.zip_code]);

  const mapUrl = useMemo(() => {
    const fullAddress = [
      form.address,
      form.address_number,
      form.neighborhood,
      form.city,
      form.state,
      form.zip_code,
      form.country,
    ].map((part) => String(part || "").trim()).filter(Boolean).join(", ");

    return fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : "";
  }, [form.address, form.address_number, form.neighborhood, form.city, form.state, form.zip_code, form.country]);

  const handleCepChange = (e) => {
    setForm((prev) => ({ ...prev, zip_code: formatCep(e.target.value) }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = form.project_type === "Solar"
        ? { ...form, voltage: form.solar_config.ac_voltage, supply_type: form.solar_config.ac_supply_type }
        : form;
      const project = await backend.entities.Project.create(payload);
      navigate(form.project_type === "Solar" ? `/solar-project?project=${project.id}` : `/circuit-editor?project=${project.id}`);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Não foi possível criar o projeto",
        description: error?.message || "Tente novamente em instantes.",
      });
    } finally {
      setSaving(false);
    }
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
        <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="space-y-2">
            <Label>CEP</Label>
            <div className="relative max-w-[220px]">
              <Input
                placeholder="00000-000"
                value={form.zip_code}
                onChange={handleCepChange}
                inputMode="numeric"
                maxLength={9}
                className="pr-9"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                {cepStatus === "loading" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {cepStatus === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                {cepStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
              </span>
            </div>
            {cepStatus === "error" ? (
              <p className="text-xs font-medium text-destructive">CEP não encontrado. Preencha o endereço manualmente.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Digite o CEP para preencher rua, bairro, cidade e estado automaticamente.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input placeholder="Rua, avenida..." value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input placeholder="Nº" value={form.address_number} onChange={e => setForm({...form, address_number: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input placeholder="Apto, bloco, casa..." value={form.complement} onChange={e => setForm({...form, complement: e.target.value})} />
            </div>
          </div>

          {geoStatus !== "idle" && (
            <p className={`flex items-center gap-1.5 text-xs font-medium ${geoStatus === "error" ? "text-amber-600" : geoStatus === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
              {geoStatus === "loading" && <><Loader2 className="h-3.5 w-3.5 animate-spin" />Localizando o imóvel no mapa...</>}
              {geoStatus === "success" && <><CheckCircle2 className="h-3.5 w-3.5" />Localização do imóvel confirmada — o mapa do projeto solar abrirá direto no endereço.</>}
              {geoStatus === "error" && <><AlertCircle className="h-3.5 w-3.5" />Não foi possível localizar o imóvel automaticamente. Você pode ajustar a posição no editor do telhado.</>}
            </p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input placeholder="Bairro" value={form.neighborhood} onChange={e => setForm({...form, neighborhood: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input placeholder="Cidade" value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.state} onValueChange={v => setForm({...form, state: v})}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((uf) => (
                    <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Input placeholder="País" value={form.country} onChange={e => setForm({...form, country: e.target.value})} />
            </div>
          </div>

          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white text-xs font-extrabold text-primary shadow-sm transition hover:bg-primary/5"
            >
              <MapPin className="h-4 w-4" />
              Visualizar no Google Maps
            </a>
          )}
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
