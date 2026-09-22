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
import { Slider } from "@/components/ui/slider";
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
import { printExecutiveSolarReport } from "@/lib/solarReportGenerator";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Download,
  Flame,
  Grid2X2,
  HelpCircle,
  Home,
  Info,
  Layers,
  Loader2,
  Lock,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minus,
  MousePointer2,
  Move3D,
  Pencil,
  PiggyBank,
  Plus,
  Printer,
  Redo2,
  Rotate3d,
  RotateCw,
  Save,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
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

const OBSTACLE_PRESETS = [
  { type: "caixa_dagua", name: "Caixa d'água", icon: Box, radius: 1.2 },
  { type: "chamine", name: "Chaminé / Exaustor", icon: Flame, radius: 0.6 },
  { type: "claraboia", name: "Clarabóia / Domus", icon: Square, radius: 0.8 },
  { type: "respiro", name: "Tubulação / Respiro", icon: Layers, radius: 0.4 },
  { type: "antena", name: "Antena / Mastro", icon: Compass, radius: 0.5 },
  { type: "arvore", name: "Árvore / Sombra", icon: Sun, radius: 1.8 },
  { type: "custom", name: "Obstáculo Personalizado", icon: ShieldAlert, radius: 1.0 },
];

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
    map_zoom: clamp(asNumber(merged.map_zoom, defaultSolarConfig.map_zoom), 3, 23),
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
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
  const [viewportRequest, setViewportRequest] = useState(0);
  const [selectedObstacleId, setSelectedObstacleId] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("water"); // "water" | "obstacles" | "pv"
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
      setViewportRequest((n) => n + 1);
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
        setConfig((current) => ({
          ...current,
          map_center_lat: first.lat,
          map_center_lng: first.lng,
          map_zoom: 20,
        }));
        setViewportRequest((n) => n + 1);
        toast({ title: "Endereço localizado", description: first.display_name });
      } else {
        toast({ title: "Endereço não encontrado", description: "Tente um termo mais específico.", variant: "destructive" });
      }
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleAddObstacle = (preset) => {
    const center = getRoofCenterFromConfig(config);
    // Adiciona pequeno deslocamento para não sobrepor se já houver outros
    const existingCount = config.obstacles.length;
    const offsetLat = (existingCount % 3 - 1) * 0.00002;
    const offsetLng = (Math.floor(existingCount / 3) - 1) * 0.00003;

    const newObstacle = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: preset.type,
      name: preset.name,
      lat: center.lat + offsetLat,
      lng: center.lng + offsetLng,
      radiusM: preset.radius,
      excludeArea: true,
    };

    const nextObstacles = [...config.obstacles, newObstacle];
    updateConfig("obstacles", nextObstacles);
    setSelectedObstacleId(newObstacle.id);
    setActiveSidebarTab("obstacles");
    toast({
      title: "Obstáculo adicionado",
      description: `${preset.name} inserido. Você pode arrastá-lo e ajustar o raio na barra lateral.`,
    });
  };

  const handleUpdateObstacle = (id, updates) => {
    const nextObstacles = config.obstacles.map((obs) =>
      obs.id === id ? { ...obs, ...updates } : obs
    );
    updateConfig("obstacles", nextObstacles);
  };

  const handleRemoveObstacle = (id) => {
    const nextObstacles = config.obstacles.filter((obs) => obs.id !== id);
    updateConfig("obstacles", nextObstacles);
    if (selectedObstacleId === id) {
      setSelectedObstacleId(null);
    }
    toast({ title: "Obstáculo removido", description: "Área liberada para instalação de módulos." });
  };

  const handleDetectObstacles = async () => {
    setDetectingObstacles(true);
    try {
      const detected = await detectRoofObstacles({
        roofPolygon: config.roof_polygon,
        mapCenter: { lat: config.map_center_lat, lng: config.map_center_lng },
      });
      updateConfig("obstacles", detected);
      setActiveSidebarTab("obstacles");
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

  const handlePrint = () => {
    try {
      printExecutiveSolarReport(project, config, visualSizing);
      toast({ title: "Impressão iniciada", description: "Relatório executivo enviado para impressão." });
    } catch (err) {
      toast({ title: "Erro ao imprimir", description: err.message, variant: "destructive" });
    }
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
      toast({ title: "Projeto salvo", description: "Layout, obstáculos e proteções atualizados com sucesso." });
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
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#0a0f18] font-inter text-slate-100 antialiased select-none">
      {/* 1. Header Minimalista */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1522] px-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition"
            title="Voltar aos projetos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <form onSubmit={handleSearchAddress} className="relative flex items-center">
            <MapPin className="absolute left-3 h-4 w-4 text-primary" />
            <Input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Buscar endereço ou CEP no mapa..."
              className="h-9 w-64 md:w-80 lg:w-96 rounded-xl border-white/10 bg-slate-950/70 pl-9 pr-8 text-xs font-medium text-white placeholder:text-white/40 focus:border-primary"
            />
            <button
              type="submit"
              disabled={searchingAddress}
              className="absolute right-2 text-white/50 hover:text-white transition"
            >
              {searchingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>

        {/* Alternador de Abas de Visualização */}
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1">
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
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-slate-950 shadow-sm"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Ações Principais do Cabeçalho */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="h-9 rounded-xl border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
            title="Imprimir relatório executivo"
          >
            <Printer className="mr-1.5 h-3.5 w-3.5 text-primary" /> Imprimir
          </Button>

          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setReportsOpen(true)}
            className="h-9 rounded-xl border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
          >
            <Download className="mr-1.5 h-3.5 w-3.5 text-primary" /> Relatórios PDF
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={saveConfig}
            disabled={saving}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-black text-slate-950 hover:bg-primary/90 shadow-sm"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* 2. Ribbon Toolbar de Ferramentas */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f1929] px-4 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {/* Grupo de Ferramentas de Contorno */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/10">
            {[
              { mode: "select", icon: MousePointer2, label: "Navegar" },
              { mode: "draw-polygon", icon: Home, label: "Polígono Livre" },
              { mode: "draw-rectangle", icon: Square, label: "Retângulo" },
              { mode: "edit", icon: Pencil, label: "Vértices", reqRoof: true },
              { mode: "rotate", icon: RotateCw, label: "Girar", reqRoof: true },
            ].map((t) => (
              <button
                key={t.mode}
                type="button"
                title={t.label}
                disabled={t.reqRoof && !hasRoof}
                onClick={() => setEditorMode(t.mode)}
                className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition ${
                  editorMode === t.mode
                    ? "bg-primary text-slate-950 font-black"
                    : "text-white/60 hover:bg-white/10 hover:text-white"
                } disabled:opacity-25`}
              >
                <t.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          <span className="mx-1 h-5 w-px bg-white/10" />

          {/* Ferramenta de Obstáculos (Menu Dropdown + IA) */}
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-bold text-rose-300 hover:bg-slate-900 transition"
                >
                  <Plus className="h-3.5 w-3.5 text-rose-400" />
                  <span>Obstáculo</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 bg-slate-900 border-white/15 text-white">
                <DropdownMenuLabel className="text-[11px] font-bold text-white/50 uppercase">
                  Adicionar Obstáculo no Telhado
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                {OBSTACLE_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <DropdownMenuItem
                      key={preset.type}
                      onClick={() => handleAddObstacle(preset)}
                      className="flex items-center gap-2 p-2 text-xs font-semibold focus:bg-white/10 focus:text-white cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-rose-400" />
                      <span>{preset.name}</span>
                      <span className="ml-auto text-[10px] text-white/40">+{preset.radius}m</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              disabled={detectingObstacles}
              onClick={handleDetectObstacles}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-bold text-amber-300 hover:bg-slate-900 transition"
            >
              {detectingObstacles ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
              )}
              Obstáculos IA
            </button>
          </div>

          <span className="mx-1 h-5 w-px bg-white/10" />

          {/* Automação e IA */}
          <button
            type="button"
            onClick={handleAutoSuggestContour}
            className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-bold text-cyan-300 hover:bg-slate-900 transition"
          >
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Contorno IA
          </button>
        </div>

        {/* Lado Direito do Ribbon: Estratégias de Simulação & Desfazer */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={undoRoofChange}
            disabled={!roofHistoryState.canUndo}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-white/60 hover:text-white disabled:opacity-25 transition"
            title="Desfazer"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={redoRoofChange}
            disabled={!roofHistoryState.canRedo}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-white/60 hover:text-white disabled:opacity-25 transition"
            title="Refazer"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/60 px-3 text-xs font-bold text-primary hover:bg-slate-900 transition"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Simular layout</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-slate-900 border-white/15 text-white">
              <DropdownMenuLabel className="text-[11px] font-bold text-white/50 uppercase">
                Estratégias de Otimização
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              {STRATEGIES.map((strat) => (
                <DropdownMenuItem
                  key={strat.id}
                  onClick={() => handleSelectStrategy(strat.id)}
                  className="flex flex-col items-start gap-0.5 p-2 focus:bg-white/10 focus:text-white cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                    <strat.icon className="h-3.5 w-3.5" /> {strat.title}
                  </div>
                  <p className="text-[10px] text-white/60 leading-tight">{strat.desc}</p>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 3. Canvas Central + Painel Lateral com Abas Descomprimidas */}
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
              viewportRequest={viewportRequest}
              selectedObstacleId={selectedObstacleId}
              panelPolygons={visiblePanelPolygons}
              showBadges={false}
              showMeasurements
              onEditorModeChange={setEditorMode}
              onRoofChange={handleRoofGeometryChange}
              onViewportChange={({ center, zoom }) => {
                setConfig((current) => ({
                  ...current,
                  map_center_lat: center.lat,
                  map_center_lng: center.lng,
                  map_zoom: zoom,
                }));
              }}
              onFitRoof={() => setFitRoofRequest((n) => n + 1)}
              onUpdateObstacle={handleUpdateObstacle}
              onSelectObstacle={(id) => {
                setSelectedObstacleId(id);
                setActiveSidebarTab("obstacles");
              }}
              onRemoveObstacle={handleRemoveObstacle}
            />
          )}
        </main>

        {/* 4. Painel Lateral Organizado com Abas */}
        <aside className="w-80 lg:w-96 shrink-0 flex flex-col border-l border-white/10 bg-[#0d1522] overflow-hidden">
          {/* Seletor de Abas da Sidebar */}
          <div className="grid grid-cols-3 border-b border-white/10 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => setActiveSidebarTab("water")}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
                activeSidebarTab === "water"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-primary" />
              Água 01
            </button>
            <button
              type="button"
              onClick={() => setActiveSidebarTab("obstacles")}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
                activeSidebarTab === "obstacles"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
              Obstáculos ({obstacles.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSidebarTab("pv")}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition ${
                activeSidebarTab === "pv"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <Sliders className="h-3.5 w-3.5 text-cyan-400" />
              Config FV
            </button>
          </div>

          {/* Conteúdo da Aba 1: Água 01 (Métricas e Strings) */}
          {activeSidebarTab === "water" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  <h3 className="text-sm font-black text-white">Água 01 — Telhado</h3>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                  <Check className="h-3 w-3" /> Selecionada
                </span>
              </div>

              <div className="space-y-2 rounded-xl bg-slate-950/60 border border-white/10 p-3">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Área total:</span>
                  <strong className="text-white">{(config.roof_area_m2 || 72.4).toFixed(1)} m²</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Área utilizável:</span>
                  <strong className="text-white">{(visualSizing.usableArea || 58.7).toFixed(1)} m²</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Azimute:</span>
                  <strong className="text-cyan-300">{technicalAnalysis.azimuth.formatted}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Inclinação:</span>
                  <strong className="text-white">{config.roof_pitch_deg || 12}°</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Módulos instalados:</span>
                  <strong className="text-white">{visualSizing.panelCount} × {config.module_wp} Wp</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Potência CC:</span>
                  <strong className="text-primary">{visualSizing.dcPowerKw.toFixed(2)} kWp</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-white/60">Geração estimada:</span>
                  <strong className="text-emerald-400">{(annualGenerationKwh / 1000).toFixed(2)} MWh/ano</strong>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-white/60">Perdas estimadas:</span>
                  <strong className="text-amber-400">{technicalAnalysis.estimatedLossPct}%</strong>
                </div>
              </div>

              {/* Agrupamento de Strings */}
              <div className="space-y-2 rounded-xl bg-slate-950/60 border border-white/10 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/60">Arranjo de Strings CC</p>
                  <span className="text-[10px] text-primary font-bold">{strings.length} Strings</span>
                </div>
                <div className="space-y-1.5">
                  {strings.map((st) => (
                    <div key={st.id} className="flex items-center justify-between text-[11px] bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <span className="font-bold text-cyan-300">{st.name}</span>
                      <span className="text-white/80">Módulos {st.startModule}–{st.endModule} ({st.powerKw} kWp)</span>
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
                  className="h-8 border-white/15 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
                >
                  <Pencil className="mr-1.5 h-3 w-3" /> Editar área
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearRoof}
                  className="h-8 border-rose-500/30 bg-rose-950/30 text-xs font-bold text-rose-400 hover:bg-rose-950/60"
                >
                  <Trash2 className="mr-1.5 h-3 w-3" /> Excluir área
                </Button>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba 2: Obstáculos no Telhado (Adicionar, Arrastar, Ajustar Raio) */}
          {activeSidebarTab === "obstacles" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-sm font-black text-white">Obstáculos no Telhado</h3>
                  <p className="text-[11px] text-white/50">Arraste os marcadores no mapa e ajuste o raio.</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="h-7 px-2.5 bg-rose-500 hover:bg-rose-600 text-slate-950 font-bold text-xs rounded-lg">
                      <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-white/15 text-white">
                    {OBSTACLE_PRESETS.map((preset) => {
                      const Icon = preset.icon;
                      return (
                        <DropdownMenuItem
                          key={preset.type}
                          onClick={() => handleAddObstacle(preset)}
                          className="flex items-center gap-2 p-2 text-xs font-semibold focus:bg-white/10 cursor-pointer"
                        >
                          <Icon className="h-4 w-4 text-rose-400" />
                          <span>{preset.name}</span>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {obstacles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-white/50 space-y-2">
                  <AlertTriangle className="mx-auto h-6 w-6 text-white/30" />
                  <p className="font-semibold">Nenhum obstáculo cadastrado</p>
                  <p className="text-[11px]">Adicione chaminés, caixas d'água ou claraboias para recalcular os módulos ao redor.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {obstacles.map((obs) => {
                    const isSelected = selectedObstacleId === obs.id;
                    return (
                      <div
                        key={obs.id}
                        onClick={() => setSelectedObstacleId(obs.id)}
                        className={`rounded-xl border p-3 transition space-y-2.5 cursor-pointer ${
                          isSelected
                            ? "border-sky-400 bg-sky-950/40 shadow-sm"
                            : "border-white/10 bg-slate-950/60 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                            <strong className="text-white text-xs">{obs.name || "Obstáculo"}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveObstacle(obs.id);
                            }}
                            className="text-white/40 hover:text-rose-400 transition"
                            title="Remover obstáculo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Controle de Raio de Afastamento */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-white/60">Raio de segurança:</span>
                            <strong className="text-sky-300">{(obs.radiusM || 1.0).toFixed(1)} m</strong>
                          </div>
                          <input
                            type="range"
                            min="0.2"
                            max="3.5"
                            step="0.1"
                            value={obs.radiusM || 1.0}
                            onChange={(e) => handleUpdateObstacle(obs.id, { radiusM: parseFloat(e.target.value) })}
                            className="w-full accent-primary h-1 bg-white/10 rounded-lg cursor-pointer"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
                          <span>Posição: {obs.lat.toFixed(5)}, {obs.lng.toFixed(5)}</span>
                          <span className="text-sky-400 font-semibold">Arraste no mapa</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Conteúdo da Aba 3: Configurações do Sistema FV */}
          {activeSidebarTab === "pv" && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="border-b border-white/10 pb-3">
                <h3 className="text-sm font-black text-white">Parâmetros Fotovoltaicos</h3>
                <p className="text-[11px] text-white/50">Ajuste potência, orientação e conexão CA.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold text-white/70">Potência do Módulo (Wp)</Label>
                  <select
                    value={config.module_wp}
                    onChange={(e) => updateConfig("module_wp", Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
                  >
                    {[450, 500, 550, 580, 600, 670, 700].map((wp) => (
                      <option key={wp} value={wp}>{wp} Wp (Half-Cell Monocristalino)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-white/70">Orientação dos Módulos</Label>
                  <select
                    value={config.module_orientation}
                    onChange={(e) => updateConfig("module_orientation", e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
                  >
                    <option value="auto">Automático (Melhor encaixe)</option>
                    <option value="vertical">Retrato (Em pé)</option>
                    <option value="horizontal">Paisagem (Deitado)</option>
                  </select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-white/70">Potência do Inversor (kW)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="1"
                    max="100"
                    value={config.inverter_kw}
                    onChange={(e) => updateConfig("inverter_kw", parseFloat(e.target.value) || 5)}
                    className="mt-1.5 h-9 rounded-xl border-white/10 bg-slate-950 text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-white/70">Alimentação CA do Inversor</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    <select
                      value={config.ac_supply_type}
                      onChange={(e) => updateConfig("ac_supply_type", e.target.value)}
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
                    >
                      <option value="Monofásico">Monofásico</option>
                      <option value="Bifásico">Bifásico</option>
                      <option value="Trifásico">Trifásico</option>
                    </select>
                    <select
                      value={config.ac_voltage}
                      onChange={(e) => updateConfig("ac_voltage", Number(e.target.value))}
                      className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:border-primary focus:outline-none"
                    >
                      <option value={127}>127 V</option>
                      <option value={220}>220 V</option>
                      <option value={380}>380 V</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-white/70">Inclinação do Telhado (°)</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    max="45"
                    value={config.roof_pitch_deg}
                    onChange={(e) => updateConfig("roof_pitch_deg", parseInt(e.target.value, 10) || 12)}
                    className="mt-1.5 h-9 rounded-xl border-white/10 bg-slate-950 text-xs font-bold text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* 5. Rodapé Executivo Descomprimido com Métricas Claras e Verificações */}
      <footer className="h-20 shrink-0 border-t border-white/10 bg-[#080d16] px-6 flex items-center justify-between">
        <div className="flex items-center gap-6 overflow-x-auto">
          <div>
            <p className="text-base font-black text-primary flex items-center gap-1.5">
              <Zap className="h-4 w-4" /> {visualSizing.dcPowerKw.toFixed(2)} kWp
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Potência Instalada</p>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <p className="text-base font-black text-white flex items-center gap-1.5">
              <Grid2X2 className="h-4 w-4 text-cyan-400" /> {visualSizing.panelCount} Módulos
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Quantidade</p>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <p className="text-base font-black text-emerald-400 flex items-center gap-1.5">
              <Sun className="h-4 w-4" /> {(annualGenerationKwh / 1000).toFixed(2)} MWh/ano
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Geração Estimada</p>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <p className="text-base font-black text-emerald-400 flex items-center gap-1.5">
              <PiggyBank className="h-4 w-4" /> R$ {annualSavingsBrl.toLocaleString("pt-BR")}/ano
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Economia Estimada</p>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div>
            <p className="text-base font-black text-cyan-300">
              {paybackYears} anos
            </p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Payback Simples</p>
          </div>
        </div>

        {/* Integração Elétrica com QD-01 e Botões de Impressão */}
        <div className="flex items-center gap-4">
          <div className="hidden xl:flex items-center gap-3 text-[11px] font-bold border-l border-white/10 pl-4 text-white/70">
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> Disjuntor {sizing.breaker}A ({config.ac_supply_type === "Trifásico" ? "3P" : "2P"})
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3 stroke-[3]" /> NBR 16690 / 5410
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="h-10 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-bold"
            >
              <Printer className="mr-1.5 h-4 w-4 text-primary" /> Imprimir
            </Button>
            <Button
              type="button"
              onClick={() => setReportsOpen(true)}
              className="h-10 rounded-xl bg-primary hover:bg-primary/90 text-slate-950 text-xs font-black px-4 shadow-sm"
            >
              <Download className="mr-1.5 h-4 w-4" /> Relatórios PDF
            </Button>
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
