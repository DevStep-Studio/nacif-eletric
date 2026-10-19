import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator as CalcIcon,
  Zap,
  Cable,
  Layers,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ArrowRightLeft,
  Plus,
  Trash2,
  FolderOpen,
  Info,
  Sparkles,
  Activity,
  FileCheck,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import {
  dimensionCircuitNBR5410,
  calcVoltageDrop,
  calcConduitOccupation,
  convertElectricalUnits,
  calculateProjectDemand,
  calcNominalCurrent,
  selectBreaker,
  selectDrRating,
  selectFeederCable,
  WIRE_TABLE,
  WIRE_TABLE_ALUMINUM,
  CONDUIT_SIZES,
  getDefaultDemandFactor,
  METHOD_COL,
} from "@/lib/electricalEngine";

const CIRCUIT_TYPE_OPTIONS = [
  "Tomadas de Uso Geral",
  "Tomadas de Uso Específico",
  "Iluminação",
  "Chuveiro",
  "Forno",
  "Ar Condicionado",
  "Motor",
  "Bomba Hidráulica",
  "Carregador Veicular",
  "Alimentador de Subquadro",
];

const INSTALL_METHODS = Object.keys(METHOD_COL);

export default function CalculatorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "dimensioning";

  const handleTabChange = (newTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", newTab);
      return next;
    });
  };

  // ─── Integração com Projetos e Circuitos Reais ──────────────────────────────
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(() => (
    searchParams.get("project")
    || (typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : "")
    || ""
  ));
  const [projectCircuits, setProjectCircuits] = useState([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState("");

  useEffect(() => {
    let cancelled = false;
    backend.entities.Project.list("-updated_date", 100)
      .then((list) => {
        if (cancelled) return;
        const safe = Array.isArray(list) ? list : [];
        setProjects(safe);
        if (!selectedProjectId && safe.length > 0) {
          const stored = typeof window !== "undefined" ? window.localStorage.getItem("voltai_active_project_id") : null;
          const target = safe.find((p) => p.id === stored) || safe[0];
          if (target?.id) setSelectedProjectId(target.id);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setProjectCircuits([]);
      return;
    }
    let cancelled = false;
    backend.entities.Project.get(selectedProjectId)
      .then((proj) => {
        if (cancelled || !proj) return;
        if (Array.isArray(proj.circuits)) {
          setProjectCircuits(proj.circuits);
        } else {
          backend.entities.Circuit.filter({ project_id: selectedProjectId })
            .then((list) => {
              if (!cancelled && Array.isArray(list)) setProjectCircuits(list);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedProjectId]);

  // ─── ABA 1: DIMENSIONAMENTO NBR 5410 ─────────────────────────────────────────
  const [dimForm, setDimForm] = useState({
    name: "Circuito 1",
    type: "Tomadas de Uso Geral",
    power: 2200,
    power_unit: "W",
    voltage: 220,
    supply_type: "Monofásico",
    power_factor: 0.92,
    efficiency: 1.0,
    demand_factor: 0.70,
    length_m: 15,
    install_method: "Eletroduto Embutido em Parede",
    material: "Cobre",
    insulation: "PVC",
    temp_ambient: 30,
    group_count: 1,
    max_drop_pct: 4.0,
    manual_breaker_a: "",
  });

  // Atualiza automaticamente o fator de demanda padrão e fp ao mudar o tipo
  const handleTypeChange = (newType) => {
    const defaultDf = getDefaultDemandFactor(newType);
    const norm = String(newType).toLowerCase();
    const defaultFp = (norm.includes("chuveiro") || norm.includes("forno") || norm.includes("resistiv"))
      ? 1.0
      : (norm.includes("motor") || norm.includes("ar condicionado"))
        ? 0.85
        : (norm.includes("ilumin") ? 0.92 : 0.92);

    setDimForm((prev) => ({
      ...prev,
      type: newType,
      demand_factor: defaultDf,
      power_factor: defaultFp,
    }));
  };

  // Importa dados de um circuito real do projeto ativo
  const handleImportCircuit = (circId) => {
    setSelectedCircuitId(circId);
    const c = projectCircuits.find((item) => String(item.id) === String(circId));
    if (!c) return;
    setDimForm((prev) => ({
      ...prev,
      name: c.name || "Circuito Importado",
      type: c.type || "Tomadas de Uso Geral",
      power: Number(c.power_w) || Number(c.power) || 2200,
      power_unit: c.power_unit || "W",
      voltage: Number(c.voltage) || 220,
      supply_type: c.supply_type || "Monofásico",
      power_factor: Number(c.power_factor) || 0.92,
      efficiency: Number(c.efficiency) || 1.0,
      demand_factor: Number(c.demand_factor) || getDefaultDemandFactor(c.type, c.name),
      length_m: Number(c.length_m) || 15,
      install_method: c.install_method || "Eletroduto Embutido em Parede",
      temp_ambient: Number(c.temp_ambient) || 30,
      group_count: Number(c.group_count) || 1,
      manual_breaker_a: c.manual_breaker ? String(c.breaker_a || "") : "",
    }));
  };

  const dimResult = useMemo(() => {
    return dimensionCircuitNBR5410({
      power: Math.max(0, Number(dimForm.power) || 0),
      power_unit: dimForm.power_unit,
      voltage: Math.max(1, Number(dimForm.voltage) || 220),
      supply_type: dimForm.supply_type,
      type: dimForm.type,
      power_factor: Math.min(1.0, Math.max(0.1, Number(dimForm.power_factor) || 0.92)),
      efficiency: Math.min(1.0, Math.max(0.1, Number(dimForm.efficiency) || 1.0)),
      demand_factor: Number(dimForm.demand_factor) > 0 ? Number(dimForm.demand_factor) : 1.0,
      length_m: Math.max(0.5, Number(dimForm.length_m) || 1),
      install_method: dimForm.install_method,
      material: dimForm.material,
      insulation: dimForm.insulation,
      temp_ambient: Number(dimForm.temp_ambient) || 30,
      group_count: Math.max(1, Number(dimForm.group_count) || 1),
      max_drop_pct: Number(dimForm.max_drop_pct) || 4.0,
      manual_breaker_a: dimForm.manual_breaker_a ? Number(dimForm.manual_breaker_a) : null,
    });
  }, [dimForm]);

  // ─── ABA 2: QUEDA DE TENSÃO ──────────────────────────────────────────────────
  const [vdForm, setVdForm] = useState({
    inputMode: "current", // "current" | "power"
    current_a: 16,
    power: 3500,
    voltage: 220,
    supply_type: "Monofásico",
    power_factor: 0.92,
    wire_gauge: "2.5mm²",
    length_m: 25,
    material: "Cobre",
    max_drop_pct: 4.0,
  });

  const vdResult = useMemo(() => {
    const currentVal = vdForm.inputMode === "current"
      ? Number(vdForm.current_a) || 0
      : null;

    return calcVoltageDrop(
      vdForm.inputMode === "power" ? Number(vdForm.power) || 0 : null,
      Number(vdForm.voltage) || 220,
      vdForm.supply_type,
      Number(vdForm.length_m) || 1,
      vdForm.wire_gauge,
      Number(vdForm.power_factor) || 0.92,
      {
        current: currentVal,
        material: vdForm.material,
        max_drop_pct: Number(vdForm.max_drop_pct) || 4.0,
      }
    );
  }, [vdForm]);

  // Sugestão de bitola caso a queda exceda o limite
  const suggestedVdWire = useMemo(() => {
    if (vdResult.ok) return null;
    const table = vdForm.material === "Alumínio" ? WIRE_TABLE_ALUMINUM : WIRE_TABLE;
    return table.find((w) => {
      const test = calcVoltageDrop(
        vdForm.inputMode === "power" ? Number(vdForm.power) || 0 : null,
        Number(vdForm.voltage) || 220,
        vdForm.supply_type,
        Number(vdForm.length_m) || 1,
        w.gauge,
        Number(vdForm.power_factor) || 0.92,
        {
          current: vdForm.inputMode === "current" ? Number(vdForm.current_a) || 0 : null,
          material: vdForm.material,
          max_drop_pct: Number(vdForm.max_drop_pct) || 4.0,
        }
      );
      return test.ok;
    });
  }, [vdResult, vdForm]);

  // ─── ABA 3: TAXA DE OCUPAÇÃO DE ELETRODUTOS ──────────────────────────────────
  const [conduitCables, setConduitCables] = useState([
    { id: "1", gauge: "2.5mm²", area: 2.5, count: 3 },
    { id: "2", gauge: "1.5mm²", area: 1.5, count: 2 },
  ]);
  const [customConduitDn, setCustomConduitDn] = useState("auto");

  const addConduitCable = () => {
    setConduitCables((prev) => [
      ...prev,
      { id: String(Date.now()), gauge: "2.5mm²", area: 2.5, count: 1 },
    ]);
  };

  const removeConduitCable = (id) => {
    setConduitCables((prev) => prev.filter((c) => c.id !== id));
  };

  const updateConduitCable = (id, field, value) => {
    setConduitCables((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (field === "gauge") {
          const areaNum = Number(String(value).replace(/[^\d.]/g, "")) || 2.5;
          return { ...c, gauge: value, area: areaNum };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const conduitResult = useMemo(() => {
    return calcConduitOccupation(
      conduitCables,
      customConduitDn === "auto" ? null : Number(customConduitDn)
    );
  }, [conduitCables, customConduitDn]);

  // ─── ABA 4: CONVERSOR DE UNIDADES E GRANDEZAS ────────────────────────────────
  const [convForm, setConvForm] = useState({
    value: 5,
    unit: "kW",
    voltage: 220,
    supply_type: "Monofásico",
    power_factor: 0.92,
    efficiency: 0.88,
  });

  const convResult = useMemo(() => {
    return convertElectricalUnits({
      value: Number(convForm.value) || 0,
      fromUnit: convForm.unit,
      power_factor: Number(convForm.power_factor) || 0.92,
      efficiency: Number(convForm.efficiency) || 1.0,
      voltage: Number(convForm.voltage) || 220,
      supply_type: convForm.supply_type,
    });
  }, [convForm]);

  // ─── ABA 5: DEMANDA E PROTEÇÃO GERAL ─────────────────────────────────────────
  const [demandLoads, setDemandLoads] = useState([
    { id: "1", name: "Iluminação Geral", type: "Iluminação", power_w: 1200, demand_factor: 1.0 },
    { id: "2", name: "Tomadas Gerais (TUG)", type: "Tomadas de Uso Geral", power_w: 4400, demand_factor: 0.70 },
    { id: "3", name: "Chuveiro Elétrico", type: "Chuveiro", power_w: 5500, demand_factor: 1.0 },
    { id: "4", name: "Ar Condicionado", type: "Ar Condicionado", power_w: 1800, demand_factor: 0.85 },
  ]);

  const addDemandLoad = () => {
    setDemandLoads((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Carga ${prev.length + 1}`,
        type: "Tomadas de Uso Específico",
        power_w: 2000,
        demand_factor: 0.80,
      },
    ]);
  };

  const removeDemandLoad = (id) => {
    setDemandLoads((prev) => prev.filter((l) => l.id !== id));
  };

  const updateDemandLoad = (id, field, value) => {
    setDemandLoads((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        if (field === "type") {
          return { ...l, type: value, demand_factor: getDefaultDemandFactor(value) };
        }
        return { ...l, [field]: value };
      })
    );
  };

  const demandMetrics = useMemo(() => {
    const metrics = calculateProjectDemand(demandLoads);
    const supply = dimForm.supply_type;
    const voltage = dimForm.voltage;
    const generalCurrent = calcNominalCurrent(metrics.demand_power_w, voltage, supply, 0.92);
    const breaker = selectBreaker(generalCurrent);
    const dr = selectDrRating(breaker || 40);
    const feeder = selectFeederCable(breaker || generalCurrent, "Eletroduto Embutido em Parede", 30, 1);

    return {
      ...metrics,
      generalCurrent,
      breaker,
      dr,
      feeder,
    };
  }, [demandLoads, dimForm.supply_type, dimForm.voltage]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 px-4 sm:px-6">
      <PageHeader
        icon={CalcIcon}
        title="Calculadora Elétrica Profissional"
        subtitle="Dimensionamento completo de condutores, eletrodutos, queda de tensão e proteções conforme ABNT NBR 5410."
      />

      {/* Seletor de Projeto e Circuito Ativo */}
      <div className="p-4 rounded-xl bg-card border border-border/50 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="w-5 h-5 text-[#00d8b8]" />
          <div>
            <p className="text-xs text-muted-foreground font-medium">Projeto Conectado</p>
            <Select value={selectedProjectId} onValueChange={(id) => setSelectedProjectId(id)}>
              <SelectTrigger className="w-[260px] h-9 mt-1 bg-background text-sm">
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name || "Projeto Sem Título"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projectCircuits.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Importar Circuito:</span>
            <Select value={selectedCircuitId} onValueChange={handleImportCircuit}>
              <SelectTrigger className="w-[240px] h-9 bg-background text-sm">
                <SelectValue placeholder="Carregar parâmetros..." />
              </SelectTrigger>
              <SelectContent>
                {projectCircuits.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name || `Circuito ${c.id}`} ({c.power_w || c.power}W)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Tabs Principais */}
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto p-1 bg-muted/60 rounded-xl gap-1">
          <TabsTrigger value="dimensioning" className="py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5">
            <Cable className="w-4 h-4 text-[#00d8b8]" />
            <span>Dimensionamento</span>
          </TabsTrigger>
          <TabsTrigger value="voltage-drop" className="py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Queda de Tensão</span>
          </TabsTrigger>
          <TabsTrigger value="conduit" className="py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>Eletrodutos (40%)</span>
          </TabsTrigger>
          <TabsTrigger value="converter" className="py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4 text-purple-400" />
            <span>Grandezas & W/VA</span>
          </TabsTrigger>
          <TabsTrigger value="demand" className="py-2.5 text-xs sm:text-sm flex items-center justify-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Demanda & Geral</span>
          </TabsTrigger>
        </TabsList>

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: DIMENSIONAMENTO INTEGRADO NBR 5410                                     */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="dimensioning" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Formulário de Parâmetros */}
            <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Cable className="w-5 h-5 text-[#00d8b8]" />
                  <h3 className="font-semibold text-base">Parâmetros do Circuito</h3>
                </div>
                <Badge variant="outline" className="text-xs border-[#00d8b8]/30 text-[#00d8b8]">
                  NBR 5410:2004
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label className="text-xs">Tipo de Carga / Aplicação</Label>
                  <Select value={dimForm.type} onValueChange={handleTypeChange}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CIRCUIT_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Potência</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-9 mt-1"
                    value={dimForm.power}
                    onChange={(e) => setDimForm({ ...dimForm, power: Math.max(0, Number(e.target.value)) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Unidade</Label>
                  <Select
                    value={dimForm.power_unit}
                    onValueChange={(u) => setDimForm({ ...dimForm, power_unit: u })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W">Watts (W)</SelectItem>
                      <SelectItem value="kW">Quilowatts (kW)</SelectItem>
                      <SelectItem value="VA">Volt-Ampères (VA)</SelectItem>
                      <SelectItem value="kVA">Quilovolt-Ampères (kVA)</SelectItem>
                      <SelectItem value="cv">Cavalo-Vapor (cv)</SelectItem>
                      <SelectItem value="HP">Horsepower (HP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Tensão (V)</Label>
                  <Select
                    value={String(dimForm.voltage)}
                    onValueChange={(v) => setDimForm({ ...dimForm, voltage: Number(v) })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="127">127 V</SelectItem>
                      <SelectItem value="220">220 V</SelectItem>
                      <SelectItem value="380">380 V</SelectItem>
                      <SelectItem value="440">440 V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Alimentação</Label>
                  <Select
                    value={dimForm.supply_type}
                    onValueChange={(s) => setDimForm({ ...dimForm, supply_type: s })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monofásico">Monofásico (F+N)</SelectItem>
                      <SelectItem value="Bifásico">Bifásico (F+F)</SelectItem>
                      <SelectItem value="Trifásico">Trifásico (3F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Fator de Potência (cos φ)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="1.0"
                    className="h-9 mt-1"
                    value={dimForm.power_factor}
                    onChange={(e) => setDimForm({ ...dimForm, power_factor: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Fator de Demanda (FD)</Label>
                  <Input
                    type="number"
                    step="0.05"
                    min="0.1"
                    max="1.0"
                    className="h-9 mt-1"
                    value={dimForm.demand_factor}
                    onChange={(e) => setDimForm({ ...dimForm, demand_factor: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Comprimento (m)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    className="h-9 mt-1"
                    value={dimForm.length_m}
                    onChange={(e) => setDimForm({ ...dimForm, length_m: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Material do Cabo</Label>
                  <Select
                    value={dimForm.material}
                    onValueChange={(m) => setDimForm({ ...dimForm, material: m })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cobre">Cobre (Padrão NBR 5410)</SelectItem>
                      <SelectItem value="Alumínio">Alumínio (≥16mm²)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2">
                  <Label className="text-xs">Método de Instalação</Label>
                  <Select
                    value={dimForm.install_method}
                    onValueChange={(m) => setDimForm({ ...dimForm, install_method: m })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INSTALL_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{m} ({METHOD_COL[m]})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Temp. Ambiente (°C)</Label>
                  <Select
                    value={String(dimForm.temp_ambient)}
                    onValueChange={(t) => setDimForm({ ...dimForm, temp_ambient: Number(t) })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 °C (Ft = 1.06)</SelectItem>
                      <SelectItem value="30">30 °C (Ft = 1.00 - Padrão)</SelectItem>
                      <SelectItem value="35">35 °C (Ft = 0.94)</SelectItem>
                      <SelectItem value="40">40 °C (Ft = 0.87)</SelectItem>
                      <SelectItem value="45">45 °C (Ft = 0.79)</SelectItem>
                      <SelectItem value="50">50 °C (Ft = 0.71)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Circuitos Agrupados (Fg)</Label>
                  <Select
                    value={String(dimForm.group_count)}
                    onValueChange={(g) => setDimForm({ ...dimForm, group_count: Number(g) })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 circuito (Fg = 1.00)</SelectItem>
                      <SelectItem value="2">2 circuitos (Fg = 0.80)</SelectItem>
                      <SelectItem value="3">3 circuitos (Fg = 0.70)</SelectItem>
                      <SelectItem value="4">4 circuitos (Fg = 0.65)</SelectItem>
                      <SelectItem value="5">5 circuitos (Fg = 0.60)</SelectItem>
                      <SelectItem value="6">6 circuitos (Fg = 0.57)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Resultados Técnicos e Conformidade NBR 5410 */}
            <div className="lg:col-span-7 space-y-4">
              {/* Banner de Status Normativo */}
              <div
                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  dimResult.warnings.length === 0 && dimResult.voltage_drop.ok && dimResult.breaker.isCoordinationOk
                    ? "bg-[#00d8b8]/10 border-[#00d8b8]/30 text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-400"
                }`}
              >
                {dimResult.warnings.length === 0 && dimResult.voltage_drop.ok && dimResult.breaker.isCoordinationOk ? (
                  <CheckCircle2 className="w-5 h-5 text-[#00d8b8] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-semibold text-sm">
                    {dimResult.warnings.length === 0 && dimResult.voltage_drop.ok && dimResult.breaker.isCoordinationOk
                      ? "Dimensionamento Plenamente Aprovado Conforme NBR 5410"
                      : "Atenção: Ressalvas de Conformidade Normativa Identificadas"}
                  </p>
                  <p className="text-xs text-muted-foreground">{dimResult.statusMessage}</p>
                  {dimResult.warnings.length > 0 && (
                    <ul className="text-xs text-red-400/90 list-disc list-inside space-y-0.5 pt-1">
                      {dimResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Cards de Grandezas e Dimensionamento */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Corrente de Projeto (Ib)
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">{dimResult.project_current_a} A</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {dimResult.corrected_current_a} A corrigida (I'b)
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Cable className="w-3.5 h-3.5 text-[#00d8b8]" /> Condutor Fase
                  </p>
                  <p className="text-xl font-bold text-[#00d8b8] mt-1">{dimResult.wire.gauge}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Iz = {dimResult.wire.iz} A ({dimResult.wire.material})
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Disjuntor (In)
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">
                    {dimResult.breaker.current} A ({dimResult.breaker.poles}P / Curva {dimResult.breaker.curve})
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Icu: {dimResult.breaker.breaking_capacity_ka} kA
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-cyan-400" /> Queda de Tensão (ΔU)
                  </p>
                  <p className={`text-xl font-bold mt-1 ${dimResult.voltage_drop.ok ? "text-foreground" : "text-red-400"}`}>
                    {dimResult.voltage_drop.drop_pct}% ({dimResult.voltage_drop.drop_v} V)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Limite: {dimResult.voltage_drop.limit_pct}% · {dimResult.voltage_drop.ok ? "Aprovado" : "Reprovado"}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-purple-400" /> Condutores N e PE
                  </p>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    N: {dimResult.neutral.gauge} · PE: {dimResult.protection.gauge}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    NBR 5410 Tab. 48 & 58
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" /> Eletroduto
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">{dimResult.conduit.selectedConduit.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Ocupação: {dimResult.conduit.actualFillPct}% (Max: {dimResult.conduit.maxFillPct}%)
                  </p>
                </div>
              </div>

              {/* Coordenação de Proteção NBR 5410 */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1 text-muted-foreground">
                    <FileCheck className="w-4 h-4 text-[#00d8b8]" /> Coordenação de Sobrecarga (NBR 5410 item 5.3.4):
                  </span>
                  <Badge variant="outline" className={dimResult.breaker.isCoordinationOk ? "text-[#00d8b8] border-[#00d8b8]/30" : "text-red-400 border-red-500/30"}>
                    {dimResult.breaker.isCoordinationOk ? "Ib ≤ In ≤ Iz (OK)" : "Violada"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs font-mono bg-background p-2.5 rounded-lg border border-border/40">
                  <span>Ib = {dimResult.project_current_a} A</span>
                  <span className="text-muted-foreground">≤</span>
                  <span className="font-bold text-[#00d8b8]">In = {dimResult.breaker.current} A</span>
                  <span className="text-muted-foreground">≤</span>
                  <span>Iz = {dimResult.wire.iz} A</span>
                </div>
              </div>

              {/* Memória de Cálculo e Premissas Transparentes */}
              <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Info className="w-4 h-4 text-[#00d8b8]" /> Premissas e Fórmulas Aplicadas
                </div>
                <div className="text-xs space-y-1.5 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Corrente: </strong>
                    {dimForm.supply_type === "Trifásico"
                      ? `I = P / (√3 · V · cosφ) = ${dimResult.demand_power_w}W / (1.732 · ${dimForm.voltage}V · ${dimResult.power_factor}) = ${dimResult.project_current_a}A`
                      : `I = P / (V · cosφ) = ${dimResult.demand_power_w}W / (${dimForm.voltage}V · ${dimResult.power_factor}) = ${dimResult.project_current_a}A`}
                  </p>
                  <p>
                    <strong className="text-foreground">Fatores de Correção: </strong>
                    Ft (temp {dimForm.temp_ambient}°C) = {dimResult.ft} · Fg ({dimForm.group_count} agrupados) = {dimResult.fg} → Fator Total = {dimResult.f_tot}
                  </p>
                  <p>
                    <strong className="text-foreground">Queda de Tensão: </strong>
                    ΔU = ({dimForm.supply_type === "Trifásico" ? "√3" : "2"} · I · R · L) / V = {dimResult.voltage_drop.drop_v} V ({dimResult.voltage_drop.drop_pct}%)
                  </p>
                  <p>
                    <strong className="text-foreground">Dispositivos Adicionais: </strong>
                    IDR 30mA: {dimResult.needs_dr ? "Obrigatório (área molhada / tomadas)" : "Opcional"} · DPS Classe II: Previsto no QGBT.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: QUEDA DE TENSÃO PARAMÉTRICA                                            */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="voltage-drop" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-base">Cálculo de Queda de Tensão</h3>
                </div>
                <Badge variant="outline" className="text-xs border-amber-400/30 text-amber-400">
                  NBR 5410 item 6.2.7
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs">Modo de Entrada</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={vdForm.inputMode === "current" ? "default" : "outline"}
                      onClick={() => setVdForm({ ...vdForm, inputMode: "current" })}
                    >
                      Por Corrente (A)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={vdForm.inputMode === "power" ? "default" : "outline"}
                      onClick={() => setVdForm({ ...vdForm, inputMode: "power" })}
                    >
                      Por Potência (W)
                    </Button>
                  </div>
                </div>

                {vdForm.inputMode === "current" ? (
                  <div>
                    <Label className="text-xs">Corrente de Linha (A)</Label>
                    <Input
                      type="number"
                      min="0.1"
                      className="h-9 mt-1"
                      value={vdForm.current_a}
                      onChange={(e) => setVdForm({ ...vdForm, current_a: Math.max(0, Number(e.target.value)) })}
                    />
                  </div>
                ) : (
                  <div>
                    <Label className="text-xs">Potência Ativa (W)</Label>
                    <Input
                      type="number"
                      min="1"
                      className="h-9 mt-1"
                      value={vdForm.power}
                      onChange={(e) => setVdForm({ ...vdForm, power: Math.max(0, Number(e.target.value)) })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Tensão (V)</Label>
                    <Select
                      value={String(vdForm.voltage)}
                      onValueChange={(v) => setVdForm({ ...vdForm, voltage: Number(v) })}
                    >
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="127">127 V</SelectItem>
                        <SelectItem value="220">220 V</SelectItem>
                        <SelectItem value="380">380 V</SelectItem>
                        <SelectItem value="440">440 V</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Alimentação</Label>
                    <Select
                      value={vdForm.supply_type}
                      onValueChange={(s) => setVdForm({ ...vdForm, supply_type: s })}
                    >
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monofásico">Monofásico (F+N)</SelectItem>
                        <SelectItem value="Bifásico">Bifásico (F+F)</SelectItem>
                        <SelectItem value="Trifásico">Trifásico (3F)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Seção do Condutor</Label>
                    <Select
                      value={vdForm.wire_gauge}
                      onValueChange={(g) => setVdForm({ ...vdForm, wire_gauge: g })}
                    >
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WIRE_TABLE.map((w) => (
                          <SelectItem key={w.gauge} value={w.gauge}>{w.gauge}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Material</Label>
                    <Select
                      value={vdForm.material}
                      onValueChange={(m) => setVdForm({ ...vdForm, material: m })}
                    >
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cobre">Cobre</SelectItem>
                        <SelectItem value="Alumínio">Alumínio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Comprimento do Circuito (m)</Label>
                    <Input
                      type="number"
                      min="1"
                      className="h-9 mt-1"
                      value={vdForm.length_m}
                      onChange={(e) => setVdForm({ ...vdForm, length_m: Math.max(1, Number(e.target.value)) })}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Limite Admissível (%)</Label>
                    <Select
                      value={String(vdForm.max_drop_pct)}
                      onValueChange={(l) => setVdForm({ ...vdForm, max_drop_pct: Number(l) })}
                    >
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2.0% (Alimentador principal)</SelectItem>
                        <SelectItem value="4">4.0% (Circuito terminal NBR 5410)</SelectItem>
                        <SelectItem value="5">5.0% (Total da instalação)</SelectItem>
                        <SelectItem value="7">7.0% (Gerador / Transformador próprio)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Resultado e Indicador Visual */}
            <div className="lg:col-span-7 space-y-4">
              <div
                className={`p-6 rounded-2xl border ${
                  vdResult.ok
                    ? "bg-[#00d8b8]/10 border-[#00d8b8]/30"
                    : "bg-red-500/10 border-red-500/30"
                } space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {vdResult.ok ? (
                      <CheckCircle2 className="w-6 h-6 text-[#00d8b8]" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-lg text-foreground">
                        Queda de Tensão: {vdResult.drop_pct}%
                      </h4>
                      <p className="text-xs text-muted-foreground">{vdResult.statusMessage}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={vdResult.ok ? "text-[#00d8b8] border-[#00d8b8]/30" : "text-red-400 border-red-500/30"}>
                    {vdResult.ok ? "APROVADO" : "REPROVADO"}
                  </Badge>
                </div>

                {/* Barra de Progresso do Limite */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Queda Calculada: {vdResult.drop_pct}%</span>
                    <span>Limite: {vdResult.limit_pct}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        vdResult.drop_pct <= vdResult.limit_pct * 0.8
                          ? "bg-[#00d8b8]"
                          : vdResult.drop_pct <= vdResult.limit_pct
                            ? "bg-amber-400"
                            : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (vdResult.drop_pct / vdResult.limit_pct) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {suggestedVdWire && (
                  <div className="p-3 bg-card rounded-xl border border-amber-400/30 flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                    <p className="text-xs text-amber-300">
                      <strong>Recomendação técnica:</strong> Eleve a seção para{" "}
                      <strong>{suggestedVdWire.gauge}</strong> para atender ao critério de queda de tensão.
                    </p>
                  </div>
                )}
              </div>

              {/* Métricas Detalhadas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Queda em Volts (ΔU)</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{vdResult.drop_v} V</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Tensão Final na Carga</p>
                  <p className="text-2xl font-bold text-[#00d8b8] mt-1">{vdResult.voltage_final} V</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Perda Joule (Cabos)</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{vdResult.power_loss_w} W</p>
                </div>
              </div>

              {/* Fórmula Aplicada */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Fórmula Técnica Utilizada:</p>
                <p className="font-mono bg-background p-2 rounded border border-border/40">
                  {vdForm.supply_type === "Trifásico"
                    ? "ΔU = [√3 · I · (R·cosφ + X·sinφ) · L / V] × 100%"
                    : "ΔU = [2 · I · (R·cosφ + X·sinφ) · L / V] × 100%"}
                </p>
                <p>
                  Resistência dos condutores corrigida para a temperatura de operação a 70°C ({vdResult.resistance_ohm_per_km} Ω/km).
                  Fator de loop: {vdResult.factor} ({vdForm.supply_type}).
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: TAXA DE OCUPAÇÃO DE ELETRODUTOS                                         */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="conduit" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-semibold text-base">Condutores no Eletroduto</h3>
                </div>
                <Button size="sm" variant="outline" onClick={addConduitCable} className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Cabo
                </Button>
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {conduitCables.map((item) => (
                  <div key={item.id} className="p-3 bg-muted/40 rounded-xl border border-border/40 flex items-center justify-between gap-3">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <div>
                        <Label className="text-[11px]">Bitola do Condutor</Label>
                        <Select
                          value={item.gauge}
                          onValueChange={(val) => updateConduitCable(item.id, "gauge", val)}
                        >
                          <SelectTrigger className="h-8 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {WIRE_TABLE.map((w) => (
                              <SelectItem key={w.gauge} value={w.gauge}>{w.gauge}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-[11px]">Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          max="30"
                          className="h-8 mt-0.5 text-xs"
                          value={item.count}
                          onChange={(e) => updateConduitCable(item.id, "count", Math.max(1, Number(e.target.value)))}
                        />
                      </div>
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      onClick={() => removeConduitCable(item.id)}
                      disabled={conduitCables.length <= 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border/50">
                <Label className="text-xs">Diâmetro do Eletroduto para Teste</Label>
                <Select value={customConduitDn} onValueChange={setCustomConduitDn}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automático (Recomendação NBR 5410)</SelectItem>
                    {CONDUIT_SIZES.map((c) => (
                      <SelectItem key={c.dn} value={String(c.dn)}>
                        {c.name} (DN {c.dn} - Área útil: {c.internalArea} mm²)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Resultado da Ocupação NBR 5410 */}
            <div className="lg:col-span-6 space-y-4">
              <div
                className={`p-6 rounded-2xl border ${
                  conduitResult.ok
                    ? "bg-[#00d8b8]/10 border-[#00d8b8]/30"
                    : "bg-red-500/10 border-red-500/30"
                } space-y-4`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {conduitResult.ok ? (
                      <CheckCircle2 className="w-6 h-6 text-[#00d8b8]" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <h4 className="font-bold text-lg text-foreground">
                        Eletroduto: {conduitResult.selectedConduit.name} (DN {conduitResult.selectedConduit.dn})
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Taxa de Ocupação: <strong>{conduitResult.actualFillPct}%</strong> (Limite Máx: {conduitResult.maxFillPct}%)
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={conduitResult.ok ? "text-[#00d8b8] border-[#00d8b8]/30" : "text-red-400 border-red-500/30"}>
                    {conduitResult.ok ? "CONFORME" : "SATURADO"}
                  </Badge>
                </div>

                {/* Barra de Ocupação */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Ocupação dos Condutores: {conduitResult.actualFillPct}%</span>
                    <span>Limite NBR 5410: {conduitResult.maxFillPct}%</span>
                  </div>
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        conduitResult.actualFillPct <= conduitResult.maxFillPct
                          ? "bg-[#00d8b8]"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${Math.min(100, (conduitResult.actualFillPct / conduitResult.maxFillPct) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Informações Técnicas Detalhadas */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Total de Cabos</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{conduitResult.totalConductorCount}</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Área Total dos Cabos</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{conduitResult.totalCableArea} mm²</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Eletroduto Indicado</p>
                  <p className="text-2xl font-bold text-[#00d8b8] mt-1">{conduitResult.recommendedConduit.name}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Regra Normativa ABNT NBR 5410 item 6.2.11.1:</p>
                <p>• <strong>1 condutor:</strong> taxa máxima de ocupação = 53% da área interna do eletroduto.</p>
                <p>• <strong>2 condutores:</strong> taxa máxima de ocupação = 31% da área interna do eletroduto.</p>
                <p>• <strong>3 ou mais condutores:</strong> taxa máxima de ocupação = 40% da área interna do eletroduto.</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: CONVERSOR DE POTÊNCIAS E GRANDEZAS                                     */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="converter" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <ArrowRightLeft className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-base">Conversão de Grandezas Elétricas</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Valor da Potência</Label>
                  <Input
                    type="number"
                    min="0"
                    className="h-9 mt-1"
                    value={convForm.value}
                    onChange={(e) => setConvForm({ ...convForm, value: Math.max(0, Number(e.target.value)) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Unidade de Origem</Label>
                  <Select
                    value={convForm.unit}
                    onValueChange={(u) => setConvForm({ ...convForm, unit: u })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="W">Watts (W)</SelectItem>
                      <SelectItem value="kW">Quilowatts (kW)</SelectItem>
                      <SelectItem value="VA">Volt-Ampères (VA)</SelectItem>
                      <SelectItem value="kVA">Quilovolt-Ampères (kVA)</SelectItem>
                      <SelectItem value="cv">Cavalo-Vapor (cv)</SelectItem>
                      <SelectItem value="HP">Horsepower (HP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Fator de Potência (cos φ)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="1.0"
                    className="h-9 mt-1"
                    value={convForm.power_factor}
                    onChange={(e) => setConvForm({ ...convForm, power_factor: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Rendimento do Motor (η)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="1.0"
                    className="h-9 mt-1"
                    value={convForm.efficiency}
                    onChange={(e) => setConvForm({ ...convForm, efficiency: Number(e.target.value) })}
                  />
                </div>

                <div>
                  <Label className="text-xs">Tensão (V)</Label>
                  <Select
                    value={String(convForm.voltage)}
                    onValueChange={(v) => setConvForm({ ...convForm, voltage: Number(v) })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="127">127 V</SelectItem>
                      <SelectItem value="220">220 V</SelectItem>
                      <SelectItem value="380">380 V</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Alimentação</Label>
                  <Select
                    value={convForm.supply_type}
                    onValueChange={(s) => setConvForm({ ...convForm, supply_type: s })}
                  >
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monofásico">Monofásico</SelectItem>
                      <SelectItem value="Bifásico">Bifásico</SelectItem>
                      <SelectItem value="Trifásico">Trifásico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Quadro de Equivalências */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Potência Ativa (P)</p>
                  <p className="text-2xl font-bold text-[#00d8b8] mt-1">{convResult.kw} kW</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{convResult.w} W</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Potência Aparente (S)</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{convResult.kva} kVA</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{convResult.va} VA</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Potência Reativa (Q)</p>
                  <p className="text-2xl font-bold text-purple-400 mt-1">{convResult.kvar} kVAr</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{convResult.var} VAr</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Potência Mecânica (cv)</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{convResult.cv} cv</p>
                  <p className="text-xs text-muted-foreground mt-0.5">1 cv = 735.5 W</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Potência Mecânica (HP)</p>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{convResult.hp} HP</p>
                  <p className="text-xs text-muted-foreground mt-0.5">1 HP = 745.7 W</p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border/50">
                  <p className="text-xs text-muted-foreground">Corrente Resultante</p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{convResult.current_a} A</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {convForm.voltage}V · {convForm.supply_type}
                  </p>
                </div>
              </div>

              {/* Relações Matemáticas Fundamentais */}
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">Triângulo das Potências:</p>
                <p>• <strong>Potência Aparente:</strong> S = P / cosφ = √(P² + Q²)</p>
                <p>• <strong>Potência Reativa:</strong> Q = √(S² - P²) = S · sinφ</p>
                <p>• <strong>Potência Mecânica:</strong> P_eletrica = P_mecanica / η (rendimento do motor)</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        {/* TAB 5: DEMANDA E PROTEÇÃO GERAL                                               */}
        {/* ═════════════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="demand" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 rounded-2xl bg-card border border-border/50 space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-base">Cargas Cadastradas da Instalação</h3>
                </div>
                <Button size="sm" variant="outline" onClick={addDemandLoad} className="h-8 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Carga
                </Button>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {demandLoads.map((load) => (
                  <div key={load.id} className="p-3.5 bg-muted/30 rounded-xl border border-border/40 grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-4">
                      <Label className="text-[11px]">Nome da Carga</Label>
                      <Input
                        className="h-8 mt-0.5 text-xs"
                        value={load.name}
                        onChange={(e) => updateDemandLoad(load.id, "name", e.target.value)}
                      />
                    </div>

                    <div className="col-span-3">
                      <Label className="text-[11px]">Tipo / Grupo</Label>
                      <Select
                        value={load.type}
                        onValueChange={(val) => updateDemandLoad(load.id, "type", val)}
                      >
                        <SelectTrigger className="h-8 mt-0.5 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CIRCUIT_TYPE_OPTIONS.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <Label className="text-[11px]">Potência (W)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="h-8 mt-0.5 text-xs"
                        value={load.power_w}
                        onChange={(e) => updateDemandLoad(load.id, "power_w", Math.max(0, Number(e.target.value)))}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label className="text-[11px]">F. Demanda</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0.1"
                        max="1.0"
                        className="h-8 mt-0.5 text-xs"
                        value={load.demand_factor}
                        onChange={(e) => updateDemandLoad(load.id, "demand_factor", Number(e.target.value))}
                      />
                    </div>

                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => removeDemandLoad(load.id)}
                        disabled={demandLoads.length <= 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo da Demanda e Dimensionamento Geral */}
            <div className="lg:col-span-5 space-y-4">
              <div className="p-6 rounded-2xl bg-card border border-border/50 space-y-4">
                <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                  <ShieldCheck className="w-5 h-5 text-[#00d8b8]" />
                  <h4 className="font-semibold text-base">Resultado Geral da Entrada</h4>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-muted/40 rounded-xl border border-border/40">
                    <p className="text-xs text-muted-foreground">Potência Instalada</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {Math.round(demandMetrics.installed_power_w / 1000 * 10) / 10} kW
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {demandMetrics.installed_power_w} W
                    </p>
                  </div>

                  <div className="p-3.5 bg-muted/40 rounded-xl border border-border/40">
                    <p className="text-xs text-muted-foreground">Demanda Máxima Estimada</p>
                    <p className="text-xl font-bold text-[#00d8b8] mt-1">
                      {Math.round(demandMetrics.demand_power_w / 1000 * 10) / 10} kW
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Fator Médio: {Math.round(demandMetrics.demand_factor * 100)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Corrente Geral de Demanda:</span>
                    <span className="font-bold text-foreground">{demandMetrics.generalCurrent} A</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Disjuntor Geral Recomendado:</span>
                    <span className="font-bold text-[#00d8b8]">{demandMetrics.breaker} A</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">IDR Geral (30mA):</span>
                    <span className="font-bold text-foreground">{demandMetrics.dr} A</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cabo Alimentador Geral:</span>
                    <span className="font-bold text-foreground">{demandMetrics.feeder.gauge} (Iz = {demandMetrics.feeder.iz} A)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
