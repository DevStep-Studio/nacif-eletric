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
import { geocodeAddress, suggestRoofContour } from "@/lib/solarAiServices";
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
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Download,
  FileText,
  Flame,
  Grid,
  Grid2X2,
  Home,
  Info,
  Layers,
  Loader2,
  Map as MapIcon,
  MapPin,
  Maximize2,
  MousePointer2,
  Pencil,
  PiggyBank,
  Plus,
  Printer,
  Redo2,
  Rotate3d,
  RotateCw,
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

const DEFAULT_OBSTACLE_PRESET = OBSTACLE_PRESETS[0];

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
  
  // Se preencher automaticamente estiver ativo, usa a capacidade máxima física
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
  const [viewMode, setViewMode] = useState("map"); // "map" | "3d" | "shadows" | "irradiation"
  const [editorMode, setEditorMode] = useState("select");
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
  const [viewportRequest, setViewportRequest] = useState(0);
  const [selectedObstacleId, setSelectedObstacleId] = useState(null);
  const [activeRailTab, setActiveRailTab] = useState("modules"); // "info" | "roof" | "modules" | "strings" | "inverters" | "reports"
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [positioningOpen, setPositioningOpen] = useState(true);
  const [groupParamsOpen, setGroupParamsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [pendingObstaclePreset, setPendingObstaclePreset] = useState(null);

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
    if (!pendingObstaclePreset || !latlng) return;
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
    setSelectedObstacleId(newObstacle.id);
    setActiveRailTab("roof");
    setPendingObstaclePreset(null);
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
    if (selectedObstacleId === id) {
      setSelectedObstacleId(null);
    }
    toast({ title: "Obstáculo removido" });
  };

  const handlePrint = () => {
    try {
      printExecutiveSolarReport(reportProject, config, visualSizing);
      toast({ title: "Impressão iniciada", description: "Relatório executivo enviado para impressão." });
    } catch (err) {
      toast({ title: "Erro ao imprimir", description: err.message, variant: "destructive" });
    }
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
      toast({ title: "Projeto salvo", description: "Configurações e layout atualizados com sucesso." });
    } catch {
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptLayout = () => {
    saveConfig();
    toast({
      title: "Arranjo aceito com sucesso",
      description: `${visualSizing.panelCount} módulos posicionados com potência de ${visualSizing.dcPowerKw.toFixed(2)} kWp.`,
    });
  };

  if (!project) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasRoof = normalizeRoofPolygon(config.roof_polygon).length >= 3 && config.roof_defined !== false;
  const currentPreset = getModulePreset(config.module_preset_id || config.module_model);

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-[#070c14] font-inter text-slate-100 antialiased select-none">
      {/* 1. Header Profissional (DESIGNER NACIF SOLUTIONS) */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#0d1522] px-3 z-30">
        <div className="flex items-center gap-3">
          {/* Logo & Marca */}
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-600 text-white font-black text-xs shadow-md">
              N
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-black tracking-wider text-white">DESIGNER</span>
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-tight">NACIF SOLUTIONS</span>
            </div>
          </div>

          {/* Abas do Design / Estado */}
          <div className="flex items-center gap-1.5 bg-slate-950/60 p-0.5 rounded-lg border border-white/10">
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold text-white">
              <Grid className="h-3 w-3 text-cyan-400" /> Design 1
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-white/70">
              {visualSizing.panelCount} Módulos
            </span>
          </div>

          {/* Busca de Endereço / CEP no Mapa */}
          <form onSubmit={handleSearchAddress} className="relative hidden md:flex items-center">
            <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-cyan-400" />
            <Input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Buscar endereço ou CEP..."
              className="h-7 w-60 lg:w-72 rounded-lg border-white/10 bg-slate-950/80 pl-8 pr-7 text-xs font-medium text-white placeholder:text-white/40 focus:border-cyan-400"
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

        {/* Lado Direito do Header: Salvo, Undo, Redo, 2D/3D e Ações */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 mr-1">
            <Check className="h-3 w-3 stroke-[3]" /> Salvo
          </div>

          <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={undoRoofChange}
              disabled={!roofHistoryState.canUndo}
              className="h-7 w-7 flex items-center justify-center rounded text-white/60 hover:text-white disabled:opacity-25 transition"
              title="Desfazer"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redoRoofChange}
              disabled={!roofHistoryState.canRedo}
              className="h-7 w-7 flex items-center justify-center rounded text-white/60 hover:text-white disabled:opacity-25 transition"
              title="Refazer"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Toggle 2D / 3D */}
          <div className="flex items-center gap-0.5 bg-slate-950/80 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                viewMode === "map" ? "bg-cyan-500 text-slate-950 font-black shadow" : "text-white/60 hover:text-white"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                viewMode === "3d" ? "bg-cyan-500 text-slate-950 font-black shadow" : "text-white/60 hover:text-white"
              }`}
            >
              3D
            </button>
          </div>

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
                Diagrama Elétrico & Strings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("memorial")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Memorial Descritivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("bom")} className="text-xs font-medium text-white/90 hover:bg-white/10 cursor-pointer rounded-lg px-2.5 py-1.5">
                Lista de Materiais (BOM)
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

      {/* 2. Área Central: Rail de Ícones Esquerdo + Sidebar Inspetor + Canvas */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Rail Vertical Esquerdo de Ferramentas / Modos */}
        <div className="w-12 shrink-0 flex flex-col items-center justify-between border-r border-white/10 bg-[#0a111e] py-3 z-20">
          <div className="flex flex-col items-center gap-2">
            {[
              { id: "info", icon: Info, label: "Informações" },
              { id: "camera", icon: Camera, label: "Captura" },
              { id: "roof", icon: Box, label: "Estrutura do Telhado" },
              { id: "modules", icon: Grid, label: "Módulos FV", isPrimary: true },
              { id: "strings", icon: Zap, label: "Strings Elétricas" },
              { id: "inverters", icon: Layers, label: "Inversores" },
              { id: "reports", icon: FileText, label: "Relatórios" },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeRailTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    setActiveRailTab(item.id);
                    setSidebarOpen(true);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                    item.isPrimary && isActive
                      ? "bg-red-600 text-white shadow-lg"
                      : isActive
                      ? "bg-white/15 text-white"
                      : "text-white/40 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => setReportsOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 hover:bg-white/5 hover:text-white transition"
              title="Compartilhar / Exportar"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sidebar Inspetor (Passo 3 & 4: MÓDULOS FV & POSICIONAMENTO) */}
        {sidebarOpen && (
          <aside className="w-80 shrink-0 flex flex-col border-r border-white/10 bg-[#0d1522] overflow-hidden z-10 animate-in slide-in-from-left duration-200">
            {/* Header da Sidebar com botão de fechar « */}
            <div className="flex h-10 items-center justify-between border-b border-white/10 px-3 bg-slate-950/40">
              <span className="text-xs font-black uppercase tracking-wider text-white">
                {activeRailTab === "modules" ? "Módulos FV & Arranjo" : activeRailTab === "roof" ? "Água do Telhado" : "Propriedades"}
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:bg-white/10 hover:text-white transition"
                title="Recolher painel"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo Rolável do Inspetor */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Seção 1: Seleção de Módulos FV */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-black uppercase tracking-wider text-white/70">
                  MÓDULOS FV
                </Label>
                <select
                  value={config.module_preset_id}
                  onChange={(e) => updateConfig("module_preset_id", e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-slate-950 px-2.5 py-2 text-xs font-bold text-white focus:border-cyan-400 focus:outline-none"
                >
                  {MODULE_CATALOG.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seção 2: Posicionamento (Accordion) */}
              <div className="rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPositioningOpen(!positioningOpen)}
                  className="w-full flex items-center justify-between p-3 text-left font-black text-xs uppercase tracking-wider text-white hover:bg-white/5 transition"
                >
                  <span>POSICIONAMENTO</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${positioningOpen ? "rotate-180" : ""}`} />
                </button>

                {positioningOpen && (
                  <div className="p-3 pt-0 space-y-4 border-t border-white/5">
                    {/* Estrutura de Fixação: 3 Ícones */}
                    <div className="space-y-1.5 pt-2">
                      <Label className="text-[10px] font-bold text-white/60">Estrutura de Fixação</Label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "coplanar", label: "Coplanar", symbol: "— /" },
                          { id: "triangle", label: "Triângulo", symbol: "◺" },
                          { id: "shed", label: "Shed / L-O", symbol: "/\\" },
                        ].map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => updateConfig("structure_type", st.id)}
                            className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center transition ${
                              config.structure_type === st.id
                                ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black shadow-sm"
                                : "border-white/10 bg-slate-900/60 text-white/60 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <span className="text-sm font-black mb-0.5">{st.symbol}</span>
                            <span className="text-[9px] font-bold leading-tight">{st.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Orientação: Paisagem vs Retrato */}
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-white/60">Orientação</Label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateConfig("module_orientation", "horizontal")}
                          className={`flex items-center justify-center gap-2 py-2 px-2 rounded-lg border text-xs font-bold transition ${
                            config.module_orientation === "horizontal"
                              ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black shadow-sm"
                              : "border-white/10 bg-slate-900/60 text-white/60 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="h-3 w-5 border border-current rounded-sm flex items-center justify-center">
                            <span className="h-1.5 w-3 bg-current/40" />
                          </div>
                          <span>Paisagem</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateConfig("module_orientation", "vertical")}
                          className={`flex items-center justify-center gap-2 py-2 px-2 rounded-lg border text-xs font-bold transition ${
                            config.module_orientation === "vertical"
                              ? "border-cyan-400 bg-cyan-950/60 text-cyan-200 font-black shadow-sm"
                              : "border-white/10 bg-slate-900/60 text-white/60 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="h-5 w-3 border border-current rounded-sm flex items-center justify-center">
                            <span className="h-3 w-1.5 bg-current/40" />
                          </div>
                          <span>Retrato</span>
                        </button>
                      </div>
                    </div>

                    {/* Grade de 6 Parâmetros Numéricos (Azimute, Inclinação, Linhas/Mesa, Altura, Espaçamentos) */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Azimute *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={config.roof_rotation_deg}
                          onChange={(e) => updateConfig("roof_rotation_deg", parseFloat(e.target.value) || 0)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Inclinação *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={config.roof_pitch_deg}
                          onChange={(e) => updateConfig("roof_pitch_deg", parseFloat(e.target.value) || 0)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Linhas por Mesa *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={config.rows_per_table || 1}
                          onChange={(e) => updateConfig("rows_per_table", parseInt(e.target.value, 10) || 1)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Altura da Base *</Label>
                        <Input
                          type="number"
                          value={config.base_height_cm || 0}
                          onChange={(e) => updateConfig("base_height_cm", parseInt(e.target.value, 10) || 0)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Espaçamento colunas *</Label>
                        <Input
                          type="number"
                          value={config.column_gap_cm || 0}
                          onChange={(e) => updateConfig("column_gap_cm", parseInt(e.target.value, 10) || 0)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Espaçamento linhas *</Label>
                        <Input
                          type="number"
                          value={config.row_gap_cm || 0}
                          onChange={(e) => updateConfig("row_gap_cm", parseInt(e.target.value, 10) || 0)}
                          className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950 text-xs font-bold text-white focus:border-cyan-400"
                        />
                      </div>
                    </div>

                    {/* Switch: PREENCHER SUPERFÍCIE AUTOMATICAMENTE */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-black uppercase text-white tracking-wider">
                          PREENCHER SUPERFÍCIE AUTOMATICAMENTE
                        </span>
                        <span className="text-[10px] text-white/50">
                          Preenche a água com a densidade máxima
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
              </div>

              {/* Seção 3: Parâmetros do Grupo (Accordion) */}
              <div className="rounded-xl border border-white/10 bg-slate-950/50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setGroupParamsOpen(!groupParamsOpen)}
                  className="w-full flex items-center justify-between p-3 text-left font-black text-xs uppercase tracking-wider text-white hover:bg-white/5 transition"
                >
                  <span>PARÂMETROS DO GRUPO</span>
                  <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${groupParamsOpen ? "rotate-180" : ""}`} />
                </button>

                {groupParamsOpen && (
                  <div className="p-3 pt-0 space-y-3 border-t border-white/5">
                    <div className="pt-2">
                      <Label className="text-[10px] font-bold text-white/60">Inversor Selecionado</Label>
                      <Input
                        value={`${config.inverter_manufacturer || "Growatt"} · ${config.inverter_model || "MIN 5000TL-X"} (${config.inverter_kw} kW)`}
                        readOnly
                        className="mt-1 h-8 rounded-lg border-white/10 bg-slate-950/70 text-xs font-bold text-cyan-300"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Tensão CA</Label>
                        <select
                          value={config.ac_voltage}
                          onChange={(e) => updateConfig("ac_voltage", Number(e.target.value))}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                        >
                          <option value={127}>127 V</option>
                          <option value={220}>220 V</option>
                          <option value={380}>380 V</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-[10px] font-bold text-white/60">Alimentação</Label>
                        <select
                          value={config.ac_supply_type}
                          onChange={(e) => updateConfig("ac_supply_type", e.target.value)}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs font-bold text-white"
                        >
                          <option value="Monofásico">Monofásico</option>
                          <option value="Bifásico">Bifásico</option>
                          <option value="Trifásico">Trifásico</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ações Inferiores da Sidebar: CANCELAR & ACEITAR */}
            <div className="p-3 border-t border-white/10 bg-slate-950/80 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={undoRoofChange}
                className="h-9 rounded-lg border-white/15 bg-white/5 text-xs font-black text-white hover:bg-white/10 uppercase tracking-wider"
              >
                CANCELAR
              </Button>
              <Button
                type="button"
                onClick={handleAcceptLayout}
                className="h-9 rounded-lg bg-cyan-500 text-xs font-black text-slate-950 hover:bg-cyan-400 shadow-sm uppercase tracking-wider"
              >
                ACEITAR
              </Button>
            </div>
          </aside>
        )}

        {/* Botão flutuante para reabrir Sidebar caso esteja fechada */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-16 left-14 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/90 text-white shadow-xl backdrop-blur-md hover:bg-slate-800 transition"
            title="Abrir Inspetor"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Canvas Central (Mapa 2D ou Vista 3D) */}
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
              onAlignToEdge={handleAlignToEdge}
              onToggle3D={() => setViewMode("3d")}
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
                setActiveRailTab("roof");
                setSidebarOpen(true);
              }}
              onRemoveObstacle={handleRemoveObstacle}
              onMapClick={handleMapClick}
            />
          )}

          {pendingObstaclePreset && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[500] flex justify-center">
              <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-rose-400/60 bg-slate-900/95 px-4 py-2 text-xs font-bold text-rose-200 shadow-2xl backdrop-blur">
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
