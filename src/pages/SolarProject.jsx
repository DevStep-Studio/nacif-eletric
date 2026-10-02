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
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import SolarDesignerMap from "@/components/solar/SolarDesignerMap";
import Solar3DView from "@/components/solar/Solar3DView";
import SolarReportsDialog from "@/components/solar/SolarReportsDialog";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  MODULE_CATALOG,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  buildRoofPolygon,
  calculateStringGrouping,
  computeRoofFaceTechnicalAnalysis,
  getBestPanelLayout,
  getModulePreset,
  getPolygonAreaSquareMeters,
  getRoofCenterFromConfig,
  getRoofMetricsFromPolygon,
  normalizeRoofPolygon,
  serializeRoofPolygon,
} from "@/lib/solarDesignerGeometry";
import { estimateAnnualGenerationKwh, estimateAnnualSavingsBrl, estimateSimplePaybackYears } from "@/lib/solarSizing";
import { geocodeAddress } from "@/lib/solarAiServices";
import {
  downloadPdfBlob,
  generateBillOfMaterialsReport,
  generateCommercialProposalReport,
  generateElectricalDiagramReport,
  generateExecutiveSolarPdf,
  generateGenerationSimulationReport,
  generateSitePlanReport,
  generateTechnicalMemorialReport,
  printExecutiveSolarReport,
} from "@/lib/solarReportGenerator";
import {
  ArrowLeft,
  AlertTriangle,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  Flame,
  Grid,
  Info,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  MoreHorizontal,
  MousePointer,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Search,
  Share2,
  ShieldAlert,
  Sliders,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  X,
  Zap,
} from "lucide-react";

const defaultSolarConfig = {
  inverter_kw: 5,
  module_wp: 540,
  module_preset_id: "jinko-540-72hl4",
  module_manufacturer: "Jinko Solar",
  module_model: "JKM540M-72HL4",
  structure_type: "triangle", // "coplanar" | "triangle" | "shed"
  module_orientation: "horizontal", // "horizontal" (paisagem) | "vertical" (retrato)
  auto_fill_surface: true,
  rows_per_table: 1,
  base_height_cm: 0,
  column_gap_cm: 0,
  row_gap_cm: 0,
  requested_panel_count: 28,
  roof_area_m2: 96,
  roof_utilization_pct: 85,
  module_width_m: 1.134,
  module_height_m: 2.278,
  roof_width_m: 20.03,
  roof_height_m: 4.75,
  roof_rotation_deg: 308.61,
  roof_pitch_deg: 12.71,
  map_center_lat: DEFAULT_SOLAR_MAP_CENTER.lat,
  map_center_lng: DEFAULT_SOLAR_MAP_CENTER.lng,
  map_zoom: DEFAULT_SOLAR_MAP_ZOOM,
  roof_polygon: [],
  roof_defined: false,
  obstacles: [],
  layout_strategy: "max_generation",
  ac_voltage: 220,
  ac_supply_type: "Bifásico",
  consumer_unit: "",
  distributor: "",
  inverter_quantity: 1,
  inverter_manufacturer: "Growatt",
  inverter_model: "MIN 5000TL-X",
  connection_point: "Quadro de distribuição principal da unidade consumidora",
  connection_location: "Quadro elétrico principal da unidade consumidora",
  entry_standard_location: "Padrão de entrada da unidade consumidora",
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
const round2 = (value) => Math.round(value * 100) / 100;
const asNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const breakerForCurrent = (current) => {
  const options = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125];
  return options.find((item) => item >= current * 1.25) || 125;
};

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

  const preset = getModulePreset(merged.module_preset_id || merged.module_model || merged.module_wp);

  return {
    ...merged,
    module_preset_id: preset.id,
    module_manufacturer: merged.module_manufacturer || preset.manufacturer,
    module_model: merged.module_model || preset.model,
    module_wp: preset.wp,
    module_width_m: preset.widthM,
    module_height_m: preset.heightM,
    structure_type: ["coplanar", "triangle", "shed"].includes(merged.structure_type) ? merged.structure_type : "triangle",
    module_orientation: ["horizontal", "vertical", "auto"].includes(merged.module_orientation) ? merged.module_orientation : "horizontal",
    auto_fill_surface: merged.auto_fill_surface !== false,
    rows_per_table: Math.max(1, Math.round(asNumber(merged.rows_per_table, 1))),
    base_height_cm: asNumber(merged.base_height_cm, 0),
    column_gap_cm: asNumber(merged.column_gap_cm, 0),
    row_gap_cm: asNumber(merged.row_gap_cm, 0),
    inverter_kw: asNumber(merged.inverter_kw, defaultSolarConfig.inverter_kw),
    roof_area_m2: polygonArea === null
      ? asNumber(merged.roof_area_m2, roofWidth * roofHeight)
      : round1(polygonArea),
    roof_utilization_pct: asNumber(merged.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct),
    requested_panel_count: clamp(
      Math.round(asNumber(merged.requested_panel_count, defaultSolarConfig.requested_panel_count)),
      1,
      1200
    ),
    roof_width_m: roofWidth,
    roof_height_m: roofHeight,
    roof_rotation_deg: round2(asNumber(merged.roof_rotation_deg, defaultSolarConfig.roof_rotation_deg)),
    roof_pitch_deg: round2(asNumber(merged.roof_pitch_deg, defaultSolarConfig.roof_pitch_deg)),
    map_center_lat: asNumber(merged.map_center_lat, defaultSolarConfig.map_center_lat),
    map_center_lng: asNumber(merged.map_center_lng, defaultSolarConfig.map_center_lng),
    map_zoom: clamp(asNumber(merged.map_zoom, defaultSolarConfig.map_zoom), 3, 23),
    roof_polygon: normalizedRoofPolygon,
    roof_defined: hasExplicitRoofState
      ? Boolean(merged.roof_defined) && normalizedRoofPolygon.length >= 3
      : normalizedRoofPolygon.length >= 3,
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
  const roofWidth = Math.max(0.1, asNumber(config.roof_width_m, defaultSolarConfig.roof_width_m));
  const roofHeight = Math.max(0.1, asNumber(config.roof_height_m, defaultSolarConfig.roof_height_m));
  const usablePct = clamp(asNumber(config.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct), 10, 95);
  const roofArea = Math.max(0, asNumber(config.roof_area_m2, roofWidth * roofHeight));
  const moduleArea = (config.module_width_m || SOLAR_MODULE_WIDTH_M) * (config.module_height_m || SOLAR_MODULE_HEIGHT_M);
  const usableArea = roofArea * (usablePct / 100);
  const physicalLimit = Math.max(0, Math.round(Number.isFinite(Number(panelCapacity)) ? Number(panelCapacity) : Math.floor(usableArea / moduleArea)));
  
  const panelCount = config.auto_fill_surface ? physicalLimit : Math.min(asNumber(config.requested_panel_count, physicalLimit), physicalLimit);
  const requestedPanelCount = config.auto_fill_surface ? physicalLimit : clamp(Math.round(asNumber(config.requested_panel_count, physicalLimit)), 1, 1200);
  
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
    fitsArea: true,
    missingPanelCount: 0,
    panelCount,
    dcPowerKw,
    dcAcRatio: dcPowerKw / inverterKw,
    acCurrent,
    breaker,
    roofArea,
    usablePct,
  };
}

export default function SolarProject() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(defaultSolarConfig);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "error"
  const [viewMode, setViewMode] = useState("map"); // "map" | "3d" | "irradiation"
  const [appMode, setAppMode] = useState("layout"); // "layout" | "electrical"
  const [editorMode, setEditorMode] = useState("select"); // "select" | "draw-polygon" | "draw-rectangle" | "edit" | "rotate" | "measure"
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
  const [viewportRequest, setViewportRequest] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [pendingObstaclePreset, setPendingObstaclePreset] = useState(null);

  // Seleções do Inspector Contextual
  const [selectedEntity, setSelectedEntity] = useState({ type: "none", id: null }); // type: "none" | "roof" | "module" | "string" | "obstacle"
  const [activeInspectorTab, setActiveInspectorTab] = useState("layout"); // "layout" | "electrical" | "mounting" | "advanced"

  // Estado de Auto FV Preview
  const [autoFvPreview, setAutoFvPreview] = useState(null);

  const reportProject = useMemo(() => {
    if (!project) return project;
    const currentResponsible = project.technical_responsible || {};
    return {
      ...project,
      technical_responsible: {
        ...currentResponsible,
        name: currentResponsible.name || currentResponsible.full_name || user?.full_name || user?.name || "",
        crea: currentResponsible.crea || user?.crea || "",
        company: currentResponsible.company || user?.company || "",
      },
    };
  }, [project, user]);

  const [roofHistoryState, setRoofHistoryState] = useState({ canUndo: false, canRedo: false });
  const roofHistoryRef = useRef([[]]);
  const roofHistoryIndexRef = useRef(0);

  useEffect(() => {
    if (!projectId) return;
    backend.entities.Project.get(projectId).then((item) => {
      const normalizedConfig = normalizeSolarConfig({
        ...(item?.solar_config || {}),
        consumer_unit: item?.solar_config?.consumer_unit
          || item?.consumption?.consumer_unit
          || item?.energy_bill?.installation_code
          || "",
        distributor: item?.solar_config?.distributor || item?.consumption?.distributor || item?.distributor || "",
      });
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
    [
      config.module_orientation,
      config.module_preset_id,
      config.structure_type,
      config.roof_rotation_deg,
      config.column_gap_cm,
      config.row_gap_cm,
      config.layout_strategy,
      roofPolygonKey,
      obstaclesKey,
    ]
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
    () => estimateAnnualGenerationKwh(sizing.dcPowerKw) || 20950,
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
    ) || 3.8,
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
    if (field === "module_preset_id") {
      const p = getModulePreset(value);
      next.module_preset_id = p.id;
      next.module_manufacturer = p.manufacturer;
      next.module_model = p.model;
      next.module_wp = p.wp;
      next.module_width_m = p.widthM;
      next.module_height_m = p.heightM;
    }
    if (field === "roof_width_m" || field === "roof_height_m" || field === "roof_rotation_deg") {
      setConfig(syncRoofPolygonFromDimensions(next));
      return;
    }
    setConfig(normalizeSolarConfig(next));
  };

  const handleAlignToEdge = useCallback((azimuthAngle) => {
    updateConfig("roof_rotation_deg", round2(azimuthAngle));
    toast({
      title: "Módulos alinhados à borda",
      description: `Azimute ajustado automaticamente para ${round2(azimuthAngle)}°.`,
    });
  }, [toast]);

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
        roof_rotation_deg: round2(metrics.rotationDeg),
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
    setSelectedEntity({ type: "none", id: null });
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
        toast({ title: "Endereço não encontrado", description: "Tente um termo ou CEP mais específico.", variant: "destructive" });
      }
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleMapClick = (latlng) => {
    if (!pendingObstaclePreset || !latlng) {
      if (editorMode === "select" && selectedEntity.type !== "none") {
        setSelectedEntity({ type: "none", id: null });
      }
      return;
    }
    const preset = pendingObstaclePreset;

    const newObstacle = {
      id: `obs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: preset.type,
      name: preset.name,
      lat: latlng.lat,
      lng: latlng.lng,
      radiusM: preset.radius,
      excludeArea: true,
    };

    const nextObstacles = [...config.obstacles, newObstacle];
    updateConfig("obstacles", nextObstacles);
    setSelectedEntity({ type: "obstacle", id: newObstacle.id });
    setPendingObstaclePreset(null);
    setSidebarOpen(true);
    toast({
      title: "Obstáculo adicionado",
      description: `${preset.name} posicionado no telhado.`,
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
    if (selectedEntity.id === id) {
      setSelectedEntity({ type: "none", id: null });
    }
    toast({ title: "Obstáculo removido" });
  };

  // Gatilho de Auto FV com Preview
  const handleTriggerAutoFv = () => {
    const bestLayout = getBestPanelLayout(config, 1200, "max_generation");
    const count = bestLayout.panelCount;
    const kwp = (count * config.module_wp) / 1000;
    const occupancy = config.roof_utilization_pct || 85;

    setAutoFvPreview({
      count,
      kwp: round2(kwp),
      occupancy,
    });
  };

  const handleApplyAutoFv = () => {
    if (!autoFvPreview) return;
    updateConfig("auto_fill_surface", true);
    updateConfig("requested_panel_count", autoFvPreview.count);
    setAutoFvPreview(null);
    toast({
      title: "Auto FV aplicado com sucesso",
      description: `${autoFvPreview.count} módulos posicionados com ${autoFvPreview.kwp} kWp.`,
    });
  };

  const handleDownloadDirect = (reportType = "executive") => {
    try {
      if (reportType === "executive") {
        const doc = generateExecutiveSolarPdf(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "00_Relatorio_Executivo_Completo_Solar.pdf");
      } else if (reportType === "site_plan") {
        const doc = generateSitePlanReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "01_Planta_Implantacao_Solar.pdf");
      } else if (reportType === "electrical") {
        const doc = generateElectricalDiagramReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "02_Diagrama_Eletrico_Solar.pdf");
      } else if (reportType === "memorial") {
        const doc = generateTechnicalMemorialReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "03_Memorial_Descritivo_Solar.pdf");
      } else if (reportType === "bom") {
        const doc = generateBillOfMaterialsReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "04_Lista_Materiais_Solar.pdf");
      } else if (reportType === "simulation") {
        const doc = generateGenerationSimulationReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "05_Simulacao_Geracao_Solar.pdf");
      } else if (reportType === "proposal") {
        const doc = generateCommercialProposalReport(reportProject, config, visualSizing);
        downloadPdfBlob(doc, "06_Proposta_Comercial_Solar.pdf");
      }
      toast({
        title: "Download concluído",
        description: "O relatório PDF foi gerado e baixado com sucesso.",
      });
    } catch (err) {
      toast({
        title: "Erro ao gerar PDF",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const saveConfig = async () => {
    if (!projectId) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const normalizedConfig = normalizeSolarConfig(config);
      const payload = {
        project_type: "Solar",
        solar_config: normalizedConfig,
        voltage: normalizedConfig.ac_voltage,
        supply_type: normalizedConfig.ac_supply_type,
        consumption: {
          ...(project?.consumption || {}),
          consumer_unit: normalizedConfig.consumer_unit || project?.consumption?.consumer_unit || "",
          distributor: normalizedConfig.distributor || project?.consumption?.distributor || "",
        },
      };
      await backend.entities.Project.update(projectId, payload);
      setConfig(normalizedConfig);
      setProject((current) => (current ? { ...current, ...payload } : current));
      setSaveStatus("saved");
      toast({ title: "Projeto salvo", description: "Configurações e layout atualizados com sucesso." });
    } catch {
      setSaveStatus("error");
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Atalhos de teclado profissionais (V, A, F, M, R, Esc, Undo, Redo, Del)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoRoofChange();
        else undoRoofChange();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoRoofChange();
        return;
      }

      if (e.key === "Escape") {
        setEditorMode("select");
        setSelectedEntity({ type: "none", id: null });
        setPendingObstaclePreset(null);
        setAutoFvPreview(null);
        return;
      }

      if (e.key.toLowerCase() === "v") {
        setEditorMode("select");
        return;
      }

      if (e.key.toLowerCase() === "a") {
        setEditorMode("draw-polygon");
        return;
      }

      if (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "m") {
        handleTriggerAutoFv();
        return;
      }

      if (e.key.toLowerCase() === "r") {
        setEditorMode("measure");
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEntity.type === "obstacle" && selectedEntity.id) {
          handleRemoveObstacle(selectedEntity.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoRoofChange, redoRoofChange, selectedEntity]);

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasRoof = normalizeRoofPolygon(config.roof_polygon).length >= 3 && config.roof_defined !== false;
  const currentPreset = getModulePreset(config.module_preset_id || config.module_model);

  // Elemento selecionado para o Inspector
  const selectedObstacle = selectedEntity.type === "obstacle"
    ? config.obstacles.find((o) => o.id === selectedEntity.id)
    : null;

  const selectedModuleIdx = selectedEntity.type === "module" ? Number(selectedEntity.id) : null;
  const selectedString = selectedEntity.type === "string"
    ? strings.find((s) => s.id === selectedEntity.id)
    : null;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-[#070c14] font-inter text-slate-100 antialiased select-none">
      {/* 1. TOP BAR COMPACTA & PROFISSIONAL */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1522] px-3 z-30">
        <div className="flex items-center gap-2.5">
          {/* Link Voltar / Branding */}
          <Link
            to="/projects"
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition pr-2 border-r border-white/10"
            title="Voltar aos Projetos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-2 pr-2.5 border-r border-white/10">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-white font-black text-xs shadow-sm">
              N
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-black tracking-wider text-white">SOLAR</span>
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-tight">PRO</span>
            </div>
          </div>

          {/* Badge do Projeto / Design */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 px-2 py-0.5 rounded-lg border border-white/10">
            <span className="text-xs font-black text-white truncate max-w-[140px] md:max-w-[200px]">
              {project.name || "Projeto Solar"}
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="text-[11px] font-extrabold text-cyan-400">
              {visualSizing.panelCount} Módulos
            </span>
            <span className="text-[10px] text-white/50">
              ({visualSizing.dcPowerKw.toFixed(1)} kWp)
            </span>
          </div>

          {/* Busca de Endereço / CEP */}
          <form onSubmit={handleSearchAddress} className="relative hidden lg:flex items-center">
            <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-cyan-400" />
            <Input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Buscar endereço ou CEP..."
              className="h-7 w-56 xl:w-72 rounded-lg border-white/10 bg-slate-950/80 pl-8 pr-7 text-xs font-medium text-white placeholder:text-white/40 focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={searchingAddress}
              className="absolute right-2 text-white/50 hover:text-white transition"
            >
              {searchingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </button>
          </form>
        </div>

        {/* Lado Direito do Header: Status, Modos, Desfazer/Refazer, Relatórios e Salvar */}
        <div className="flex items-center gap-2">
          {/* Status Discreto de Salvamento */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border mr-0.5">
            {saveStatus === "saving" ? (
              <span className="text-amber-400 border-amber-500/20 bg-amber-500/10 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
              </span>
            ) : saveStatus === "error" ? (
              <span className="text-rose-400 border-rose-500/20 bg-rose-500/10 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Erro ao salvar
              </span>
            ) : (
              <span className="text-emerald-400 border-emerald-500/20 bg-emerald-500/10 flex items-center gap-1">
                <Check className="h-3 w-3 stroke-[3]" /> Salvo
              </span>
            )}
          </div>

          {/* Modo Layout vs Elétrica */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setAppMode("layout")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                appMode === "layout" ? "bg-cyan-500 text-slate-950 font-black shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Layout
            </button>
            <button
              type="button"
              onClick={() => setAppMode("electrical")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                appMode === "electrical" ? "bg-cyan-500 text-slate-950 font-black shadow" : "text-white/60 hover:text-white"
              }`}
            >
              Elétrica
            </button>
          </div>

          {/* Toggle 2D / 3D */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`px-2 py-1 text-xs font-bold rounded transition ${
                viewMode === "map" ? "bg-slate-700 text-white font-black" : "text-white/60 hover:text-white"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`px-2 py-1 text-xs font-bold rounded transition ${
                viewMode === "3d" ? "bg-slate-700 text-white font-black" : "text-white/60 hover:text-white"
              }`}
            >
              3D
            </button>
          </div>

          {/* Dropdown de Relatórios */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 rounded-lg border-white/10 bg-white/5 text-xs font-bold text-white hover:bg-white/10"
              >
                <Download className="mr-1 h-3 w-3 text-cyan-400" /> Relatórios <ChevronDown className="ml-1 h-3 w-3 text-white/50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-slate-900 border-white/10 text-white p-1.5 shadow-xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase text-white/50 px-2 py-1">
                Documentos Técnicos PDF
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => handleDownloadDirect("executive")}
                className="text-xs font-bold text-cyan-300 hover:bg-cyan-500/10 cursor-pointer rounded-lg px-2.5 py-2"
              >
                <Download className="mr-2 h-4 w-4 text-cyan-400" /> Relatório Executivo Completo
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={() => handleDownloadDirect("site_plan")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Planta de Implantação
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("electrical")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Diagrama Unifilar & Strings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("memorial")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Memorial Descritivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("bom")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Lista de Materiais (BOM)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("simulation")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Simulação de Geração Anual
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                onClick={() => setReportsOpen(true)}
                className="text-xs font-bold text-white hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5 flex items-center justify-between"
              >
                <span>Central de Relatórios...</span>
                <Layers className="h-3.5 w-3.5 text-cyan-400" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Menu Secundário (•••) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-slate-900 border-white/10 text-white p-1 shadow-xl text-xs">
              <DropdownMenuItem onClick={() => setFitRoofRequest((n) => n + 1)} className="cursor-pointer hover:bg-white/10 rounded-md">
                <Maximize2 className="h-3.5 w-3.5 mr-2 text-cyan-400" /> Centralizar no Mapa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearRoof} className="cursor-pointer hover:bg-red-500/20 text-red-400 rounded-md">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Limpar Telhado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botão Salvar */}
          <Button
            type="button"
            size="sm"
            onClick={saveConfig}
            disabled={saving}
            className="h-7 rounded-lg bg-cyan-500 px-3 text-xs font-black text-slate-950 hover:bg-cyan-400 shadow-sm"
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: INSPECTOR LATERAL (18-22%) + MAPA / EDITOR (78-82%) */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Painel Lateral Contextual (Inspector) */}
        {sidebarOpen ? (
          <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-white/10 bg-[#0d1522] overflow-hidden z-20 animate-in slide-in-from-left duration-200">
            {/* Header do Inspector Contextual */}
            <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 bg-slate-950/60">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                {selectedEntity.type === "roof" ? (
                  <>
                    <Box className="h-3.5 w-3.5 text-cyan-400" /> Água do Telhado
                  </>
                ) : selectedEntity.type === "module" ? (
                  <>
                    <Grid className="h-3.5 w-3.5 text-cyan-400" /> Módulo #{selectedModuleIdx + 1}
                  </>
                ) : selectedEntity.type === "string" ? (
                  <>
                    <Zap className="h-3.5 w-3.5 text-cyan-400" /> {selectedString?.name || "String"}
                  </>
                ) : selectedEntity.type === "obstacle" ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-400" /> Obstáculo
                  </>
                ) : (
                  <>
                    <Sliders className="h-3.5 w-3.5 text-cyan-400" /> Inspetor Solar
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Recolher painel (Modo Foco)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo Rolável do Inspector Contextual */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs">
              {/* CASO 1: ÁREA DO TELHADO SELECIONADA */}
              {selectedEntity.type === "roof" && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Área Útil</span>
                      <span className="font-black text-white">{visualSizing.roofArea.toFixed(1)} m²</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Azimute</span>
                      <span className="font-black text-cyan-300">{visualSizing.technicalAnalysis.azimuth.formatted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Inclinação</span>
                      <span className="font-black text-white">{config.roof_pitch_deg}°</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Módulos Instalados</span>
                      <span className="font-black text-emerald-400">{visualSizing.panelCount} un</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Potência CC</span>
                      <span className="font-black text-white">{visualSizing.dcPowerKw.toFixed(2)} kWp</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      onClick={handleTriggerAutoFv}
                      className="w-full h-8 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs hover:bg-cyan-400"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Auto Preencher Módulos
                    </Button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditorMode("edit")}
                        className="h-8 rounded-lg border-white/15 bg-white/5 text-white font-bold text-xs"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Vértices
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFitRoofRequest((n) => n + 1)}
                        className="h-8 rounded-lg border-white/15 bg-white/5 text-white font-bold text-xs"
                      >
                        <Maximize2 className="h-3 w-3 mr-1" /> Centralizar
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedEntity({ type: "none", id: null })}
                      className="w-full h-7 rounded-lg text-white/50 hover:text-white text-xs"
                    >
                      Ver Configurações Gerais
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO 2: MÓDULO SELECIONADO */}
              {selectedEntity.type === "module" && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Identificador</span>
                      <span className="font-black text-cyan-300">Módulo #{selectedModuleIdx + 1}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Modelo</span>
                      <span className="font-bold text-white truncate max-w-[140px]">{currentPreset.model}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Potência</span>
                      <span className="font-black text-emerald-400">{currentPreset.wp} Wp</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Dimensões</span>
                      <span className="font-bold text-white">{currentPreset.widthM}m × {currentPreset.heightM}m</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Orientação</span>
                      <span className="font-bold text-white capitalize">{config.module_orientation === "horizontal" ? "Paisagem" : "Retrato"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAppMode("electrical")}
                      className="w-full h-8 rounded-lg border-white/15 bg-white/5 text-white font-bold text-xs"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5 text-cyan-400" /> Ver String Elétrica
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedEntity({ type: "none", id: null })}
                      className="w-full h-7 rounded-lg text-white/50 hover:text-white text-xs"
                    >
                      Fechar Seleção
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO 3: OBSTÁCULO SELECIONADO */}
              {selectedEntity.type === "obstacle" && selectedObstacle && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Nome</span>
                      <span className="font-black text-rose-300">{selectedObstacle.name}</span>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-white/60">Raio de Afastamento (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.2"
                        max="10"
                        value={selectedObstacle.radiusM || 1.0}
                        onChange={(e) => handleUpdateObstacle(selectedObstacle.id, { radiusM: parseFloat(e.target.value) || 1.0 })}
                        className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-rose-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleRemoveObstacle(selectedObstacle.id)}
                      className="w-full h-8 rounded-lg font-bold text-xs"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover Obstáculo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedEntity({ type: "none", id: null })}
                      className="w-full h-7 rounded-lg text-white/50 hover:text-white text-xs"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO DEFAULT: NADA SELECIONADO -> INSPECTOR GERAL */}
              {selectedEntity.type === "none" && (
                <div className="space-y-4">
                  {/* Seletor Compacto do Módulo FV */}
                  <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase tracking-wider text-white/70">
                        MÓDULO FOTOVOLTAICO
                      </Label>
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/20">
                        {currentPreset.wp} Wp
                      </span>
                    </div>
                    <select
                      value={config.module_preset_id}
                      onChange={(e) => updateConfig("module_preset_id", e.target.value)}
                      className="w-full rounded-lg border border-white/15 bg-slate-900 px-2 py-1.5 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                    >
                      {MODULE_CATALOG.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
                      <span>{currentPreset.widthM}m × {currentPreset.heightM}m</span>
                      <span>{currentPreset.manufacturer}</span>
                    </div>
                  </div>

                  {/* 4 Seções em Abas Compactas */}
                  <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-white/10 text-[11px] font-bold">
                    {[
                      { id: "layout", label: "Layout" },
                      { id: "electrical", label: "Elétrica" },
                      { id: "mounting", label: "Montagem" },
                      { id: "advanced", label: "Avançado" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveInspectorTab(tab.id)}
                        className={`flex-1 py-1 rounded-md transition text-center ${
                          activeInspectorTab === tab.id
                            ? "bg-cyan-500 text-slate-950 font-black shadow"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* CONTEÚDO DA ABA: LAYOUT */}
                  {activeInspectorTab === "layout" && (
                    <div className="space-y-3.5 animate-in fade-in">
                      {/* Orientação Paisagem vs Retrato */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-white/60">Orientação</Label>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateConfig("module_orientation", "horizontal")}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                              config.module_orientation === "horizontal"
                                ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black"
                                : "border-white/10 bg-slate-900/60 text-white/60 hover:text-white"
                            }`}
                          >
                            <span>Paisagem</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateConfig("module_orientation", "vertical")}
                            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                              config.module_orientation === "vertical"
                                ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black"
                                : "border-white/10 bg-slate-900/60 text-white/60 hover:text-white"
                            }`}
                          >
                            <span>Retrato</span>
                          </button>
                        </div>
                      </div>

                      {/* Estrutura de Fixação */}
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-white/60">Estrutura de Fixação</Label>
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: "coplanar", label: "Coplanar" },
                            { id: "triangle", label: "Triângulo" },
                            { id: "shed", label: "Shed" },
                          ].map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => updateConfig("structure_type", st.id)}
                              className={`py-1.5 rounded-lg border text-center text-xs transition ${
                                config.structure_type === st.id
                                  ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black"
                                  : "border-white/10 bg-slate-900/60 text-white/60 hover:text-white"
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Espaçamentos e Linhas */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-white/60">Espaç. Colunas (cm)</Label>
                          <Input
                            type="number"
                            value={config.column_gap_cm || 0}
                            onChange={(e) => updateConfig("column_gap_cm", parseInt(e.target.value, 10) || 0)}
                            className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-white/60">Espaç. Linhas (cm)</Label>
                          <Input
                            type="number"
                            value={config.row_gap_cm || 0}
                            onChange={(e) => updateConfig("row_gap_cm", parseInt(e.target.value, 10) || 0)}
                            className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white"
                          />
                        </div>
                      </div>

                      {/* Switch Preenchimento Automático */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/10">
                        <div className="flex flex-col">
                          <span className="text-[10.5px] font-black uppercase text-white tracking-wider">
                            Preencher Área
                          </span>
                          <span className="text-[9.5px] text-white/50">
                            Máxima ocupação válida
                          </span>
                        </div>
                        <Switch
                          checked={config.auto_fill_surface}
                          onCheckedChange={(checked) => updateConfig("auto_fill_surface", checked)}
                          className="data-[state=checked]:bg-cyan-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* CONTEÚDO DA ABA: ELÉTRICA */}
                  {activeInspectorTab === "electrical" && (
                    <div className="space-y-3 animate-in fade-in">
                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Inversor</span>
                          <span className="font-bold text-cyan-300">{config.inverter_manufacturer} · {config.inverter_kw} kW</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Tensão / Rede</span>
                          <span className="font-bold text-white">{config.ac_voltage}V ({config.ac_supply_type})</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Corrente CA Est.</span>
                          <span className="font-bold text-white">{visualSizing.acCurrent.toFixed(1)} A</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Disjuntor Sugerido</span>
                          <span className="font-black text-emerald-400">{visualSizing.breaker} A</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-white/60">Strings Dimensionadas</Label>
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {strings.map((str, idx) => (
                            <div
                              key={str.id}
                              className="flex items-center justify-between p-2 rounded-lg border border-white/10 bg-slate-950/40 text-[11px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                                <span className="font-bold text-white">{str.name}</span>
                              </div>
                              <span className="text-white/70">{str.moduleCount} mód. · {str.vocV}V</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CONTEÚDO DA ABA: MONTAGEM */}
                  {activeInspectorTab === "mounting" && (
                    <div className="space-y-3 animate-in fade-in">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] font-bold text-white/60">Azimute (°)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={config.roof_rotation_deg}
                            onChange={(e) => updateConfig("roof_rotation_deg", parseFloat(e.target.value) || 0)}
                            className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] font-bold text-white/60">Inclinação (°)</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={config.roof_pitch_deg}
                            onChange={(e) => updateConfig("roof_pitch_deg", parseFloat(e.target.value) || 0)}
                            className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white"
                          />
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/60 p-2.5 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Orientação Solar</span>
                          <span className="font-bold text-cyan-300">{visualSizing.technicalAnalysis.azimuth.formatted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">HSP Efetivo</span>
                          <span className="font-bold text-white">{visualSizing.technicalAnalysis.effectiveHsp} h/dia</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/60">Perdas Orientação/Sombras</span>
                          <span className="font-bold text-amber-400">~{visualSizing.technicalAnalysis.estimatedLossPct}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CONTEÚDO DA ABA: AVANÇADO */}
                  {activeInspectorTab === "advanced" && (
                    <div className="space-y-3 animate-in fade-in">
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Ponto de Conexão Elétrico</Label>
                        <Input
                          value={config.connection_point}
                          onChange={(e) => updateConfig("connection_point", e.target.value)}
                          className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Local Padrão de Entrada</Label>
                        <Input
                          value={config.entry_standard_location}
                          onChange={(e) => updateConfig("entry_standard_location", e.target.value)}
                          className="mt-0.5 h-7 rounded-lg border-white/10 bg-slate-950 text-xs text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        ) : (
          /* Botão Flutuante para Reabrir Inspector */
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-14 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/90 text-white shadow-xl backdrop-blur-md hover:bg-slate-800 transition"
            title="Abrir Inspetor"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Canvas Central (Mapa 2D / 3D) */}
        <main className="relative flex-1 bg-slate-950 overflow-hidden">
          {/* TOOLBAR FLUTUANTE CENTRAL SOBRE O MAPA */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-1 rounded-xl border border-white/15 bg-slate-900/95 p-1 text-white shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setEditorMode("select")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                editorMode === "select" ? "bg-cyan-500 text-slate-950 font-black shadow" : "hover:bg-white/10 text-white/70 hover:text-white"
              }`}
              title="Selecionar / Navegar (V)"
            >
              <MousePointer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Selecionar</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorMode("draw-polygon")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                editorMode === "draw-polygon" ? "bg-cyan-500 text-slate-950 font-black shadow" : "hover:bg-white/10 text-white/70 hover:text-white"
              }`}
              title="Desenhar Área Solar (A)"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Área</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerAutoFv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
              title="Auto Preencher Módulos (F)"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Auto FV</span>
            </button>

            {/* Dropdown de Obstáculos */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-white/10 text-white/70 hover:text-white transition"
                  title="Adicionar Obstáculo"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Obstáculo</span>
                  <ChevronDown className="h-3 w-3 text-white/40" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 bg-slate-900 border-white/10 text-white p-1 text-xs shadow-xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-white/50 px-2 py-1">
                  Posicionar no Telhado
                </DropdownMenuLabel>
                {OBSTACLE_PRESETS.map((obs) => {
                  const Icon = obs.icon;
                  return (
                    <DropdownMenuItem
                      key={obs.type}
                      onClick={() => setPendingObstaclePreset(obs)}
                      className="cursor-pointer hover:bg-white/10 rounded-md py-1.5 px-2 flex items-center gap-2"
                    >
                      <Icon className="h-3.5 w-3.5 text-cyan-400" />
                      <span>{obs.name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Ferramenta Régua */}
            <button
              type="button"
              onClick={() => setEditorMode(editorMode === "measure" ? "select" : "measure")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                editorMode === "measure" ? "bg-amber-500 text-slate-950 font-black shadow" : "hover:bg-white/10 text-white/70 hover:text-white"
              }`}
              title="Régua / Medir Distância (R)"
            >
              <Ruler className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Medir</span>
            </button>

            <span className="h-4 w-px bg-white/15 mx-0.5" />

            {/* Desfazer / Refazer */}
            <button
              type="button"
              onClick={undoRoofChange}
              disabled={!roofHistoryState.canUndo}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white disabled:opacity-20 hover:bg-white/10 transition"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redoRoofChange}
              disabled={!roofHistoryState.canRedo}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-white/70 hover:text-white disabled:opacity-20 hover:bg-white/10 transition"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* BANNER FLUTUANTE DE PREVIEW DO AUTO FV */}
          {autoFvPreview && (
            <div className="absolute top-16 inset-x-0 z-[550] flex justify-center pointer-events-none animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-500/50 bg-slate-900/95 px-4 py-2 text-xs text-white shadow-2xl backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
                <span>
                  <strong>{autoFvPreview.count} módulos</strong> ({autoFvPreview.kwp} kWp) · Ocupação: {autoFvPreview.occupancy}%
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyAutoFv}
                    className="h-6 rounded-md bg-emerald-500 text-slate-950 font-black px-2.5 text-[11px] hover:bg-emerald-400"
                  >
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAutoFvPreview(null)}
                    className="h-6 rounded-md text-white/60 hover:text-white text-[11px]"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BANNER DE INSTRUÇÃO PARA POSICIONAR OBSTÁCULO */}
          {pendingObstaclePreset && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[550] flex justify-center animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-rose-400/60 bg-slate-900/95 px-4 py-2 text-xs font-bold text-rose-200 shadow-2xl backdrop-blur">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                Clique no telhado para posicionar: {pendingObstaclePreset.name}
                <button
                  type="button"
                  onClick={() => setPendingObstaclePreset(null)}
                  className="ml-1 rounded-lg p-0.5 text-white/50 hover:bg-white/10 hover:text-white transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Renderizador 2D ou 3D */}
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
              selectedObstacleId={selectedEntity.type === "obstacle" ? selectedEntity.id : null}
              selectedModuleIndex={selectedModuleIdx}
              electricalMode={appMode === "electrical"}
              strings={strings}
              panelPolygons={visiblePanelPolygons}
              showBadges={false}
              showMeasurements
              onEditorModeChange={setEditorMode}
              onRoofChange={handleRoofGeometryChange}
              onAlignToEdge={handleAlignToEdge}
              onToggle3D={() => setViewMode("3d")}
              onViewModeChange={setViewMode}
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
                setSelectedEntity({ type: "obstacle", id });
                setSidebarOpen(true);
              }}
              onSelectModule={(idx) => {
                setSelectedEntity({ type: "module", id: idx });
                setSidebarOpen(true);
              }}
              onSelectRoof={() => {
                setSelectedEntity({ type: "roof", id: "main" });
                setSidebarOpen(true);
              }}
              onRemoveObstacle={handleRemoveObstacle}
              onMapClick={handleMapClick}
            />
          )}

          {/* 3. RESUMO INFERIOR COMPACTO (DARK HUD) */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-4 md:gap-6 rounded-xl border border-white/15 bg-[#0a111e]/95 px-4 md:px-6 py-2 text-white shadow-2xl backdrop-blur-md">
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/50">MÓDULOS FV</span>
              <span className="text-xs md:text-sm font-black text-white">
                {visualSizing.panelCount} <span className="text-white/40 text-[10px]">un</span>
              </span>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/50">POTÊNCIA CC</span>
              <span className="text-xs md:text-sm font-black text-white">
                {visualSizing.dcPowerKw.toFixed(1)} <span className="text-white/40 text-[10px]">kWp</span>
              </span>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/50">GERAÇÃO ANUAL</span>
              <span className="text-xs md:text-sm font-black text-cyan-300">
                {(annualGenerationKwh / 1000).toFixed(1)} <span className="text-cyan-400/60 text-[10px]">MWh/ano</span>
              </span>
            </div>

            <div className="h-6 w-px bg-white/10 hidden sm:flex" />

            <div className="flex flex-col items-center hidden sm:flex">
              <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/50">ECONOMIA ESTIMADA</span>
              <span className="text-xs md:text-sm font-black text-emerald-400">
                R$ {annualSavingsBrl.toLocaleString("pt-BR")}<span className="text-emerald-500/60 text-[10px]">/ano</span>
              </span>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Relatórios Profissionais */}
      <SolarReportsDialog
        open={reportsOpen}
        onOpenChange={setReportsOpen}
        project={reportProject}
        config={config}
        sizing={visualSizing}
      />
    </div>
  );
}
