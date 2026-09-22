import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import SolarDesignerMap from "@/components/solar/SolarDesignerMap";
import Solar3DView from "@/components/solar/Solar3DView";
import SolarReportsDialog from "@/components/solar/SolarReportsDialog";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  buildRoofPolygon,
  calculateStringGrouping,
  computeRoofFaceTechnicalAnalysis,
  getAzimuthWithCardinal,
  getBestPanelLayout,
  getPolygonAreaSquareMeters,
  getRoofCenterFromConfig,
  getRoofMetricsFromPolygon,
  normalizeRoofPolygon,
  serializeRoofPolygon,
} from "@/lib/solarDesignerGeometry";
import { estimateAnnualGenerationKwh, estimateAnnualSavingsBrl, estimateSimplePaybackYears } from "@/lib/solarSizing";
import { generateDefaultPanelLayout, getPrimaryPanelBoard, mergeSolarLayoutIntoPrincipal } from "@/lib/electricalEngine";
import { detectRoofObstacles, geocodeAddress, suggestRoofContour } from "@/lib/solarAiServices";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  Bell,
  Box,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Download,
  ExternalLink,
  Flame,
  Grid2X2,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPin,
  MoreVertical,
  MousePointer2,
  Move3D,
  Pencil,
  PiggyBank,
  Plus,
  Redo2,
  Rotate3d,
  RotateCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  Unlock,
  UserCircle,
  Zap,
} from "lucide-react";

const defaultSolarConfig = {
  inverter_kw: 5,
  module_wp: 550,
  requested_panel_count: 21,
  roof_area_m2: 72.4,
  roof_utilization_pct: 80,
  module_width_m: SOLAR_MODULE_WIDTH_M,
  module_height_m: SOLAR_MODULE_HEIGHT_M,
  roof_width_m: 14.67,
  roof_height_m: 4.8,
  roof_rotation_deg: 24,
  roof_pitch_deg: 12,
  map_center_lat: DEFAULT_SOLAR_MAP_CENTER.lat,
  map_center_lng: DEFAULT_SOLAR_MAP_CENTER.lng,
  map_zoom: DEFAULT_SOLAR_MAP_ZOOM,
  roof_polygon: [],
  roof_defined: false,
  module_orientation: "auto",
  obstacles: [],
  layout_strategy: "max_generation",
  ac_voltage: 220,
  ac_supply_type: "Bifásico",
  layout_note: "",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;
const asNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const breakerForCurrent = (current) => {
  const options = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
  return options.find((item) => item >= current * 1.25) || 125;
};

const phaseCountForSupply = (supply) => (supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 1);
const polesForSupply = (supply) => (supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 2);
const phaseForSupply = (supply) => (supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A");

function normalizeSolarConfig(config = {}) {
  const merged = { ...defaultSolarConfig, ...(config || {}) };
  delete merged.layout_fill_mode;
  const normalizedRoofPolygon = serializeRoofPolygon(normalizeRoofPolygon(merged.roof_polygon));
  const hasExplicitRoofState = Object.prototype.hasOwnProperty.call(config || {}, "roof_defined");
  const roofWidth = asNumber(merged.roof_width_m, defaultSolarConfig.roof_width_m);
  const roofHeight = asNumber(merged.roof_height_m, defaultSolarConfig.roof_height_m);
  const polygonArea = normalizedRoofPolygon.length >= 3
    ? getPolygonAreaSquareMeters(normalizedRoofPolygon)
    : null;

  return {
    ...merged,
    inverter_kw: asNumber(merged.inverter_kw, defaultSolarConfig.inverter_kw),
    module_wp: asNumber(merged.module_wp, defaultSolarConfig.module_wp),
    roof_area_m2: polygonArea === null
      ? asNumber(merged.roof_area_m2, roofWidth * roofHeight)
      : round1(polygonArea),
    roof_utilization_pct: asNumber(merged.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct),
    requested_panel_count: clamp(
      Math.round(asNumber(merged.requested_panel_count, defaultSolarConfig.requested_panel_count)),
      1,
      1200
    ),
    module_width_m: SOLAR_MODULE_WIDTH_M,
    module_height_m: SOLAR_MODULE_HEIGHT_M,
    roof_width_m: roofWidth,
    roof_height_m: roofHeight,
    roof_rotation_deg: asNumber(merged.roof_rotation_deg, defaultSolarConfig.roof_rotation_deg),
    roof_pitch_deg: asNumber(merged.roof_pitch_deg, defaultSolarConfig.roof_pitch_deg),
    map_center_lat: asNumber(merged.map_center_lat, defaultSolarConfig.map_center_lat),
    map_center_lng: asNumber(merged.map_center_lng, defaultSolarConfig.map_center_lng),
    map_zoom: clamp(asNumber(merged.map_zoom, defaultSolarConfig.map_zoom), 15, 22),
    roof_polygon: normalizedRoofPolygon,
    roof_defined: hasExplicitRoofState
      ? Boolean(merged.roof_defined) && normalizedRoofPolygon.length >= 3
      : normalizedRoofPolygon.length >= 3,
    module_orientation: ["auto", "vertical", "horizontal"].includes(merged.module_orientation)
      ? merged.module_orientation
      : "auto",
    obstacles: Array.isArray(merged.obstacles) ? merged.obstacles : [],
    layout_strategy: merged.layout_strategy || "max_generation",
    ac_voltage: asNumber(merged.ac_voltage, defaultSolarConfig.ac_voltage),
    ac_supply_type: merged.ac_supply_type || defaultSolarConfig.ac_supply_type,
    layout_note: merged.layout_note || "",
  };
}

function syncRoofPolygonFromDimensions(config) {
  const normalized = normalizeSolarConfig(config);
  const center = getRoofCenterFromConfig(normalized);

  return normalizeSolarConfig({
    ...normalized,
    roof_defined: true,
    roof_polygon: serializeRoofPolygon(buildRoofPolygon(
      center,
      normalized.roof_width_m,
      normalized.roof_height_m,
      normalized.roof_rotation_deg
    )),
  });
}

function calculateSolar(config, panelCapacity = null) {
  const inverterKw = Math.max(0.1, asNumber(config.inverter_kw, defaultSolarConfig.inverter_kw));
  const moduleWp = Math.max(1, asNumber(config.module_wp, defaultSolarConfig.module_wp));
  const requestedPanelCount = clamp(
    Math.round(asNumber(config.requested_panel_count, defaultSolarConfig.requested_panel_count)),
    1,
    1200
  );
  const roofWidth = Math.max(0.1, asNumber(config.roof_width_m, defaultSolarConfig.roof_width_m));
  const roofHeight = Math.max(0.1, asNumber(config.roof_height_m, defaultSolarConfig.roof_height_m));
  const usablePct = clamp(asNumber(config.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct), 10, 95);
  const roofArea = Math.max(0, asNumber(config.roof_area_m2, roofWidth * roofHeight));
  const moduleArea = SOLAR_MODULE_WIDTH_M * SOLAR_MODULE_HEIGHT_M;
  const usableArea = roofArea * (usablePct / 100);
  const physicalLimit = Math.max(0, Math.round(Number.isFinite(Number(panelCapacity)) ? Number(panelCapacity) : Math.floor(usableArea / moduleArea)));
  const panelCount = Math.min(requestedPanelCount, physicalLimit);
  const dcPowerKw = (panelCount * moduleWp) / 1000;
  const voltage = Math.max(1, asNumber(config.ac_voltage, defaultSolarConfig.ac_voltage));
  const acCurrent = config.ac_supply_type === "Trifásico"
    ? (inverterKw * 1000) / (Math.sqrt(3) * voltage)
    : (inverterKw * 1000) / voltage;
  const breaker = breakerForCurrent(acCurrent);

  return {
    moduleArea,
    usableArea,
    physicalLimit,
    requestedPanelCount,
    fitsArea: requestedPanelCount <= physicalLimit,
    missingPanelCount: Math.max(0, requestedPanelCount - physicalLimit),
    panelCount,
    dcPowerKw,
    dcAcRatio: dcPowerKw / inverterKw,
    acCurrent,
    breaker,
    roofArea,
    usablePct,
  };
}

function buildSolarCircuits(project, config, sizing) {
  const poles = polesForSupply(config.ac_supply_type);
  const phase = phaseForSupply(config.ac_supply_type);
  const inverterPower = Math.round(config.inverter_kw * 1000);

  return [
    {
      id: "solar_inverter_ac",
      name: `Inversor Solar ${config.inverter_kw}kW CA`,
      type: "Solar Fotovoltaico CA",
      supply_type: config.ac_supply_type,
      voltage: config.ac_voltage,
      power_w: inverterPower,
      power_factor: 1,
      length_m: 15,
      phase,
      breaker_a: sizing.breaker,
      breaker_poles: poles,
      breaker_curve: "C",
      wire_gauge: sizing.breaker > 40 ? "10mm²" : sizing.breaker > 25 ? "6mm²" : "4mm²",
      needs_dr: false,
      needs_dps: true,
      point_count: 1,
      description: `Saída CA do inversor solar para ${project?.name || "projeto"}`,
    },
    {
      id: "solar_dps_ac",
      name: "DPS CA Fotovoltaico",
      type: "Proteção Solar CA",
      supply_type: config.ac_supply_type,
      voltage: config.ac_voltage,
      power_w: 0,
      power_factor: 1,
      length_m: 3,
      phase,
      breaker_a: 16,
      breaker_poles: phaseCountForSupply(config.ac_supply_type),
      breaker_curve: "C",
      wire_gauge: "6mm²",
      needs_dr: false,
      needs_dps: true,
      point_count: 1,
    },
  ];
}

const STRATEGIES = [
  { id: "max_generation", title: "Máxima geração (padrão)", icon: Sun, desc: "Maximiza a produção anual de energia em MWh." },
  { id: "max_utilization", title: "Máximo aproveitamento", icon: Grid2X2, desc: "Maior densidade e quantidade de módulos na área." },
  { id: "best_aesthetic", title: "Melhor estética", icon: Sparkles, desc: "Alinhamento simétrico e margens limpas nas bordas." },
  { id: "min_cost", title: "Menor custo", icon: PiggyBank, desc: "Menor número de strings e cabeamento otimizado." },
];

export default function SolarProject() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(defaultSolarConfig);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState("map"); // "map" | "3d" | "shadows" | "irradiation"
  const [editorMode, setEditorMode] = useState("select");
  const [roofLocked, setRoofLocked] = useState(false);
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [detectingObstacles, setDetectingObstacles] = useState(false);

  const [roofHistoryState, setRoofHistoryState] = useState({ canUndo: false, canRedo: false });
  const roofHistoryRef = useRef([[]]);
  const roofHistoryIndexRef = useRef(0);

  useEffect(() => {
    if (!projectId) return;
    backend.entities.Project.get(projectId).then((item) => {
      const normalizedConfig = normalizeSolarConfig(item?.solar_config);
      const initialRoof = serializeRoofPolygon(normalizeRoofPolygon(normalizedConfig.roof_polygon));
      setProject(item);
      setConfig(normalizedConfig);
      setSearchAddress(item?.address || "");
      roofHistoryRef.current = [initialRoof];
      roofHistoryIndexRef.current = 0;
      setRoofHistoryState({ canUndo: false, canRedo: false });
    });
  }, [projectId]);

  const roofPolygonKey = JSON.stringify(config.roof_polygon);
  const obstaclesKey = JSON.stringify(config.obstacles);

  const roofLayout = useMemo(
    () => getBestPanelLayout(config, 1200, config.layout_strategy || "max_generation"),
    [config.module_orientation, config.layout_strategy, roofPolygonKey, obstaclesKey]
  );

  const sizing = useMemo(
    () => calculateSolar(config, roofLayout.panelCount),
    [config, roofLayout.panelCount]
  );

  const visiblePanelPolygons = useMemo(
    () => roofLayout.panels.slice(0, sizing.panelCount),
    [roofLayout.panels, sizing.panelCount]
  );

  const annualGenerationKwh = useMemo(
    () => estimateAnnualGenerationKwh(sizing.dcPowerKw) || 15250,
    [sizing.dcPowerKw]
  );

  const annualSavingsBrl = useMemo(
    () => estimateAnnualSavingsBrl(
      annualGenerationKwh,
      project?.consumption?.monthly_consumption_kwh || 842,
      project?.consumption?.tariff_brl_kwh || 0.95
    ) || Math.round(annualGenerationKwh * 0.815),
    [annualGenerationKwh, project]
  );

  const paybackYears = useMemo(
    () => estimateSimplePaybackYears(
      project?.investment_brl || (sizing.dcPowerKw * 1000 * 3.5),
      annualSavingsBrl
    ) || 4.2,
    [project, sizing.dcPowerKw, annualSavingsBrl]
  );

  const strings = useMemo(
    () => calculateStringGrouping(sizing.panelCount, {
      moduleWp: config.module_wp,
      inverterKw: config.inverter_kw,
    }),
    [sizing.panelCount, config.module_wp, config.inverter_kw]
  );

  const technicalAnalysis = useMemo(
    () => computeRoofFaceTechnicalAnalysis(config.roof_polygon, config),
    [config]
  );

  const visualSizing = useMemo(() => ({
    ...sizing,
    annualGenerationKwh,
    annualSavingsBrl,
    paybackYears,
    strings,
    technicalAnalysis,
  }), [sizing, annualGenerationKwh, annualSavingsBrl, paybackYears, strings, technicalAnalysis]);

  const updateConfig = (field, value) => {
    const next = { ...config, [field]: value };
    if (field === "roof_width_m" || field === "roof_height_m") {
      next.roof_area_m2 = round1(Number(next.roof_width_m || 0) * Number(next.roof_height_m || 0));
    }
    if (field === "roof_width_m" || field === "roof_height_m" || field === "roof_rotation_deg") {
      setConfig(syncRoofPolygonFromDimensions(next));
      return;
    }
    setConfig(normalizeSolarConfig(next));
  };

  const applyRoofGeometry = useCallback((positions) => {
    setConfig((current) => {
      const normalizedPositions = serializeRoofPolygon(normalizeRoofPolygon(positions));
      if (normalizedPositions.length < 3) {
        return normalizeSolarConfig({
          ...current,
          roof_defined: false,
          roof_polygon: [],
        });
      }

      const metrics = getRoofMetricsFromPolygon(normalizedPositions, current);
      return normalizeSolarConfig({
        ...current,
        roof_defined: true,
        roof_width_m: round1(metrics.widthM),
        roof_height_m: round1(metrics.heightM),
        roof_area_m2: round1(metrics.areaM2),
        roof_rotation_deg: round1(metrics.rotationDeg),
        map_center_lat: metrics.center.lat,
        map_center_lng: metrics.center.lng,
        roof_polygon: normalizedPositions,
      });
    });
  }, []);

  const syncRoofHistoryState = useCallback(() => {
    const index = roofHistoryIndexRef.current;
    setRoofHistoryState({
      canUndo: index > 0,
      canRedo: index < roofHistoryRef.current.length - 1,
    });
  }, []);

  const handleRoofGeometryChange = useCallback((positions) => {
    const normalizedPositions = serializeRoofPolygon(normalizeRoofPolygon(positions));
    const nextKey = JSON.stringify(normalizedPositions);
    const currentHistory = roofHistoryRef.current;
    const currentKey = JSON.stringify(currentHistory[roofHistoryIndexRef.current] || []);

    if (nextKey !== currentKey) {
      const nextHistory = currentHistory.slice(0, roofHistoryIndexRef.current + 1);
      nextHistory.push(normalizedPositions);
      roofHistoryRef.current = nextHistory.slice(-40);
      roofHistoryIndexRef.current = roofHistoryRef.current.length - 1;
      syncRoofHistoryState();
    }

    applyRoofGeometry(normalizedPositions);
  }, [applyRoofGeometry, syncRoofHistoryState]);

  const undoRoofChange = useCallback(() => {
    if (roofHistoryIndexRef.current <= 0) return;
    roofHistoryIndexRef.current -= 1;
    applyRoofGeometry(roofHistoryRef.current[roofHistoryIndexRef.current]);
    setEditorMode("select");
    syncRoofHistoryState();
    toast({ title: "Alteração desfeita" });
  }, [applyRoofGeometry, syncRoofHistoryState, toast]);

  const redoRoofChange = useCallback(() => {
    if (roofHistoryIndexRef.current >= roofHistoryRef.current.length - 1) return;
    roofHistoryIndexRef.current += 1;
    applyRoofGeometry(roofHistoryRef.current[roofHistoryIndexRef.current]);
    setEditorMode("select");
    syncRoofHistoryState();
    toast({ title: "Alteração refeita" });
  }, [applyRoofGeometry, syncRoofHistoryState, toast]);

  const clearRoof = useCallback(() => {
    handleRoofGeometryChange([]);
    setEditorMode("draw-polygon");
    toast({ title: "Área do telhado removida", description: "Use Desfazer para restaurar o contorno." });
  }, [handleRoofGeometryChange, toast]);

  const handleSearchAddress = async (e) => {
    e?.preventDefault();
    if (!searchAddress?.trim()) return;
    setSearchingAddress(true);
    try {
      const results = await geocodeAddress(searchAddress);
      if (results.length > 0) {
        const first = results[0];
        updateConfig("map_center_lat", first.lat);
        updateConfig("map_center_lng", first.lng);
        updateConfig("map_zoom", 20);
        toast({ title: "Endereço localizado", description: first.display_name });
      } else {
        toast({ title: "Endereço não encontrado", description: "Tente um termo mais específico.", variant: "destructive" });
      }
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleDetectObstacles = async () => {
    setDetectingObstacles(true);
    try {
      const detected = await detectRoofObstacles({
        roofPolygon: config.roof_polygon,
        mapCenter: { lat: config.map_center_lat, lng: config.map_center_lng },
      });
      updateConfig("obstacles", detected);
      toast({
        title: "Obstáculos detectados por IA",
        description: `${detected.length} obstáculos identificados e excluídos da área de instalação.`,
      });
    } catch {
      toast({ title: "Falha na detecção de obstáculos", variant: "destructive" });
    } finally {
      setDetectingObstacles(false);
    }
  };

  const handleAutoSuggestContour = async () => {
    try {
      const contour = await suggestRoofContour({
        mapCenter: { lat: config.map_center_lat, lng: config.map_center_lng },
      });
      handleRoofGeometryChange(contour);
      toast({ title: "Contorno sugerido pela IA", description: "Ajuste os vértices se necessário." });
    } catch {
      toast({ title: "Falha ao sugerir contorno", variant: "destructive" });
    }
  };

  const handleSelectStrategy = (strategyId) => {
    updateConfig("layout_strategy", strategyId);
    toast({
      title: "Estratégia aplicada",
      description: `Layout recalculado com: ${STRATEGIES.find((s) => s.id === strategyId)?.title}.`,
    });
  };

  const saveConfig = async () => {
    if (!projectId) return;
    setSaving(true);
    try {
      const normalizedConfig = normalizeSolarConfig(config);
      const payload = {
        project_type: "Solar",
        solar_config: normalizedConfig,
        voltage: normalizedConfig.ac_voltage,
        supply_type: normalizedConfig.ac_supply_type,
      };
      await backend.entities.Project.update(projectId, payload);
      setConfig(normalizedConfig);
      setProject((current) => (current ? { ...current, ...payload } : current));
      toast({ title: "Projeto salvo", description: "Layout, strings e proteções foram atualizados." });
    } catch {
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasRoof = normalizeRoofPolygon(config.roof_polygon).length >= 3 && config.roof_defined !== false;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#0e1726] font-inter text-white">
      {/* 1. Barra Superior Principal com Busca de Endereço e Abas */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1829] px-4 shadow-md">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
            title="Voltar aos projetos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <form onSubmit={handleSearchAddress} className="relative flex items-center">
            <MapPin className="absolute left-3 h-4 w-4 text-primary" />
            <Input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Buscar endereço no mapa..."
              className="h-9 w-72 sm:w-96 rounded-xl border-white/10 bg-slate-900/80 pl-9 pr-8 text-xs font-semibold text-white placeholder:text-white/40 focus:border-primary"
            />
            <button
              type="submit"
              disabled={searchingAddress}
              className="absolute right-2 text-white/60 hover:text-white"
            >
              {searchingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </form>

          <button
            type="button"
            title="Configurações de visualização"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 text-white/70 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* 2. Alternador de Abas de Visualização (Mapa | 3D | Sombras | Irradiação) */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/90 p-1">
          {[
            { id: "map", label: "Mapa", icon: MapIcon },
            { id: "3d", label: "3D", icon: Rotate3d },
            { id: "shadows", label: "Sombras", icon: Sun },
            { id: "irradiation", label: "Irradiação", icon: Flame },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = viewMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                  active
                    ? "bg-primary text-slate-950 shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Ações Direitas (Salvar, Bloquear, Relatórios) */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReportsOpen(true)}
            className="h-9 rounded-xl border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-primary" /> Relatórios
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={saveConfig}
            disabled={saving}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-black text-slate-950 shadow-md hover:bg-primary/90"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* 3. Barra de Ferramentas / Ribbon Superior */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#121e33] px-4">
        <div className="flex items-center gap-1.5">
          {[
            { mode: "select", icon: MousePointer2, label: "Navegar no mapa" },
            { mode: "draw-polygon", icon: Home, label: "Desenhar contorno livre" },
            { mode: "draw-rectangle", icon: Square, label: "Desenhar retângulo" },
            { mode: "edit", icon: Pencil, label: "Ajustar vértices", reqRoof: true },
            { mode: "rotate", icon: RotateCw, label: "Girar telhado", reqRoof: true },
          ].map((t) => (
            <button
              key={t.mode}
              type="button"
              title={t.label}
              disabled={t.reqRoof && !hasRoof}
              onClick={() => setEditorMode(t.mode)}
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                editorMode === t.mode
                  ? "bg-primary text-slate-950"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              } disabled:opacity-30`}
            >
              <t.icon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t.label}</span>
            </button>
          ))}

          <span className="mx-1 h-5 w-px bg-white/20" />

          <button
            type="button"
            onClick={handleAutoSuggestContour}
            className="flex h-8 items-center gap-1 rounded-lg bg-white/5 px-2.5 text-xs font-bold text-cyan-300 hover:bg-white/15"
          >
            <Sparkles className="h-3.5 w-3.5" /> Contorno IA
          </button>

          <button
            type="button"
            disabled={detectingObstacles}
            onClick={handleDetectObstacles}
            className="flex h-8 items-center gap-1 rounded-lg bg-white/5 px-2.5 text-xs font-bold text-amber-300 hover:bg-white/15"
          >
            {detectingObstacles ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" />
            )}
            Obstáculos IA
          </button>
        </div>

        {/* Menu Dropdown de Simulação de Layout Automático */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary/20 to-cyan-500/20 border border-primary/40 px-3 text-xs font-black text-primary hover:bg-primary/30"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Simular layout automático</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-slate-900 border-white/15 text-white">
            <DropdownMenuLabel className="text-xs font-black text-white/60">
              Estratégias de Otimização
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/10" />
            {STRATEGIES.map((strat) => (
              <DropdownMenuItem
                key={strat.id}
                onClick={() => handleSelectStrategy(strat.id)}
                className="flex flex-col items-start gap-0.5 p-2 focus:bg-primary/20 focus:text-white cursor-pointer"
              >
                <div className="flex items-center gap-1.5 font-black text-xs text-primary">
                  <strat.icon className="h-3.5 w-3.5" /> {strat.title}
                </div>
                <p className="text-[10px] text-white/60 leading-tight">{strat.desc}</p>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 4. Canvas Central + Painel Lateral da Água */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Visualizador Principal (Mapa 2D ou 3D) */}
        <main className="relative flex-1 bg-slate-950">
          {viewMode === "3d" ? (
            <Solar3DView config={config} sizing={visualSizing} panelPolygons={visiblePanelPolygons} />
          ) : (
            <SolarDesignerMap
              className="h-full w-full"
              config={config}
              viewMode={viewMode}
              sizing={visualSizing}
              editorMode={editorMode}
              fitRoofRequest={fitRoofRequest}
              panelPolygons={visiblePanelPolygons}
              showBadges={false}
              showMeasurements
              onEditorModeChange={setEditorMode}
              onRoofChange={handleRoofGeometryChange}
              onViewportChange={({ center, zoom }) => updateConfig("map_center_lat", center.lat)}
            />
          )}
        </main>

        {/* 5. Painel Lateral de Informações da Água (Água 01) */}
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#0d1829] p-4 text-xs font-semibold space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <h3 className="text-sm font-black text-white">Água 01</h3>
            </div>
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-400">
              ✔ Selecionada
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Área total:</span>
              <strong className="text-white">{(config.roof_area_m2 || 72.4).toFixed(1)} m²</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Área utilizável:</span>
              <strong className="text-white">{(visualSizing.usableArea || 58.7).toFixed(1)} m²</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Azimute:</span>
              <strong className="text-cyan-300">{technicalAnalysis.azimuth.formatted}</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Inclinação:</span>
              <strong className="text-white">{config.roof_pitch_deg || 12}°</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Módulos:</span>
              <strong className="text-white">{visualSizing.panelCount} × {config.module_wp} Wp</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Potência:</span>
              <strong className="text-primary">{visualSizing.dcPowerKw.toFixed(2)} kWp</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Geração estimada:</span>
              <strong className="text-emerald-400">{(annualGenerationKwh / 1000).toFixed(2)} MWh/ano</strong>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1.5">
              <span className="text-white/60">Perdas estimadas:</span>
              <strong className="text-amber-400">{technicalAnalysis.estimatedLossPct}%</strong>
            </div>
          </div>

          {/* Agrupamento de Strings */}
          <div className="space-y-2 rounded-xl bg-slate-900/80 border border-white/10 p-3">
            <p className="text-[11px] font-black uppercase text-white/70">Arranjo de Strings</p>
            <div className="space-y-1.5">
              {strings.map((st) => (
                <div key={st.id} className="flex items-center justify-between text-[11px] bg-white/5 px-2 py-1.5 rounded">
                  <span className="font-bold text-cyan-300">{st.name}:</span>
                  <span className="font-semibold text-white/80">Módulos {st.startModule}–{st.endModule} ({st.powerKw}kWp)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ações da Área */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditorMode("edit")}
              className="h-8 border-white/20 bg-white/5 text-xs font-bold text-white hover:bg-white/15"
            >
              <Pencil className="mr-1 h-3 w-3" /> Editar área
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearRoof}
              className="h-8 border-red-500/30 bg-red-950/30 text-xs font-bold text-red-400 hover:bg-red-950/60"
            >
              <Trash2 className="mr-1 h-3 w-3" /> Excluir área
            </Button>
          </div>
        </aside>
      </div>

      {/* 6. Barra Inferior Global de Resultados Integrados (Mockup) */}
      <footer className="h-20 shrink-0 border-t border-white/10 bg-[#07111e] px-4 flex flex-col justify-center">
        <div className="grid grid-cols-2 lg:grid-cols-[1.3fr_1.3fr_1fr] gap-4 items-center">
          {/* Resultados Integrados */}
          <div className="flex items-center gap-4 overflow-x-auto">
            <div>
              <p className="text-base font-black text-primary flex items-center gap-1">
                <Zap className="h-4 w-4" /> {visualSizing.dcPowerKw.toFixed(2)} kWp
              </p>
              <p className="text-[10px] font-bold text-white/50 uppercase">Potência instalada</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-base font-black text-white flex items-center gap-1">
                <Grid2X2 className="h-4 w-4 text-cyan-400" /> {visualSizing.panelCount} Módulos
              </p>
              <p className="text-[10px] font-bold text-white/50 uppercase">Quantidade</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-base font-black text-emerald-400 flex items-center gap-1">
                <Sun className="h-4 w-4" /> {(annualGenerationKwh / 1000).toFixed(2)} MWh/ano
              </p>
              <p className="text-[10px] font-bold text-white/50 uppercase">Geração estimada</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-base font-black text-emerald-400 flex items-center gap-1">
                <PiggyBank className="h-4 w-4" /> R$ {annualSavingsBrl.toLocaleString("pt-BR")}/ano
              </p>
              <p className="text-[10px] font-bold text-white/50 uppercase">Economia estimada</p>
            </div>
          </div>

          {/* Checklist de Integração com o Projeto Elétrico */}
          <div className="hidden lg:grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] font-bold text-white/80 border-l border-r border-white/10 px-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> Circuito CA automático
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> Dimensiona cabos e DPS
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> Integra com QD-01
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> Unifilar e quantitativo
            </span>
          </div>

          {/* Relatórios e Branding VOLTAI */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              onClick={() => setReportsOpen(true)}
              className="h-10 bg-[#00d8b8] text-slate-950 text-xs font-black hover:bg-[#00c4a7]"
            >
              <Download className="mr-1.5 h-4 w-4" /> Relatórios PDF
            </Button>
            <div className="hidden xl:block text-right">
              <p className="text-xs font-black text-primary tracking-wider">⚡ VOLTAI</p>
              <p className="text-[9px] font-bold text-white/40">TUDO EM UM SÓ LUGAR</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Modal de Relatórios Profissionais */}
      <SolarReportsDialog
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        project={project}
        config={config}
        sizing={visualSizing}
      />
    </div>
  );
}
