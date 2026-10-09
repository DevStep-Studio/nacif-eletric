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
import SolarProjectParametersModal from "@/components/solar/SolarProjectParametersModal";
import { syncSolarToProjectCircuits } from "@/lib/projectUnifiedSync";
import { validateProjectDataForReports } from "@/lib/solarWizardState";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  MODULE_CATALOG,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  buildRoofPolygon,
  calculateStringGrouping,
  computeAreaPanels,
  computeMultiAreaLayouts,
  computeRoofFaceTechnicalAnalysis,
  createDefaultSolarArea,
  getAzimuthWithCardinal,
  getBestPanelLayout,
  getModulePreset,
  getMultiAreaAggregateMetrics,
  getPolygonAreaSquareMeters,
  getRoofCenterFromConfig,
  getRoofMetricsFromPolygon,
  normalizeRoofPolygon,
  normalizeSolarArea,
  normalizeSolarAreas,
  round1,
  round2,
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
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import {
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Download,
  Edit2,
  FileText,
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
  Rotate3d,
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
  areas: [],
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
  
  const normalizedAreas = normalizeSolarAreas(merged.areas, merged);
  const legacyPolygon = serializeRoofPolygon(normalizeRoofPolygon(merged.roof_polygon));
  const primaryPolygon = normalizedAreas[0]?.polygon || legacyPolygon;
  const hasExplicitRoofState = Object.prototype.hasOwnProperty.call(config || {}, "roof_defined");
  const roofWidth = asNumber(merged.roof_width_m, defaultSolarConfig.roof_width_m);
  const roofHeight = asNumber(merged.roof_height_m, defaultSolarConfig.roof_height_m);
  
  const totalAreasM2 = normalizedAreas.reduce((sum, a) => sum + (a.roof_area_m2 || 0), 0);
  const polygonArea = totalAreasM2 > 0 ? totalAreasM2 : (primaryPolygon.length >= 3 ? getPolygonAreaSquareMeters(primaryPolygon) : null);

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
    areas: normalizedAreas,
    roof_polygon: primaryPolygon,
    roof_defined: hasExplicitRoofState
      ? Boolean(merged.roof_defined) && (normalizedAreas.length > 0 || primaryPolygon.length >= 3)
      : (normalizedAreas.length > 0 || primaryPolygon.length >= 3),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [allProjects, setAllProjects] = useState([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [config, setConfig] = useState(defaultSolarConfig);
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved"); // "saved" | "saving" | "error"
  const [viewMode, setViewMode] = useState("map"); // "map" | "3d" | "irradiation"
  const [appMode, setAppMode] = useState("layout"); // "layout" | "electrical"
  const [editorMode, setEditorMode] = useState("select"); // "select" | "draw-polygon" | "draw-rectangle" | "edit" | "rotate" | "measure"
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
  const [viewportRequest, setViewportRequest] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [positioningOpen, setPositioningOpen] = useState(true);
  const [areasListOpen, setAreasListOpen] = useState(true);
  const [groupParamsOpen, setGroupParamsOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [projectParamsOpen, setProjectParamsOpen] = useState(false);
  const [projectParamsInitialStep, setProjectParamsInitialStep] = useState("consumo");
  const [searchAddress, setSearchAddress] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [pendingObstaclePreset, setPendingObstaclePreset] = useState(null);
  const [editingAreaNameId, setEditingAreaNameId] = useState(null);
  const [tempAreaName, setTempAreaName] = useState("");
  const [drawingTargetAreaId, setDrawingTargetAreaId] = useState(null);

  // Seleções do Inspector Contextual
  const [selectedEntity, setSelectedEntity] = useState({ type: "none", id: null }); // type: "none" | "roof" | "module" | "string" | "obstacle"
  const [activeInspectorTab, setActiveInspectorTab] = useState("layout"); // "layout" | "electrical" | "mounting" | "advanced"

  // Estado de Auto FV Preview
  const [autoFvPreview, setAutoFvPreview] = useState(null);

  const reportProject = useMemo(() => {
    if (!project) return null;
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

  const loadSolarProject = useCallback(async () => {
    setLoadingProject(true);
    setLoadError(null);
    try {
      let list = [];
      try {
        const fetched = await backend.entities.Project.list("-updated_date", 50);
        if (Array.isArray(fetched)) {
          list = fetched;
          setAllProjects(fetched);
        }
      } catch (listErr) {
        console.warn("Could not list projects for fallback:", listErr);
      }

      const storedActiveId = typeof window !== "undefined"
        ? window.localStorage.getItem("voltai_active_project_id")
        : null;

      let targetProject = null;

      // Caso A: projectId informado na URL
      if (projectId) {
        try {
          targetProject = await backend.entities.Project.get(projectId);
        } catch (getErr) {
          console.warn(`Project ${projectId} not found directly, checking list...`, getErr);
          targetProject = list.find((p) => p.id === projectId) || null;
        }
      }

      // Caso B: projectId não informado ou não encontrado -> verificar ativo salvo
      if (!targetProject && storedActiveId) {
        targetProject = list.find((p) => p.id === storedActiveId) || null;
        if (!targetProject) {
          try {
            targetProject = await backend.entities.Project.get(storedActiveId);
          } catch {}
        }
      }

      // Caso C: buscar qualquer projeto solar existente
      if (!targetProject && list.length > 0) {
        targetProject = list.find((p) => (p.type || p.project_type || "").toLowerCase() === "solar") || list[0];
      }

      // Caso D: nenhum projeto existente -> criar projeto solar inicial
      if (!targetProject) {
        try {
          targetProject = await backend.entities.Project.create({
            name: "Projeto Solar Residencial",
            project_type: "Solar",
            type: "solar",
            status: "em_andamento",
            address: "São Paulo, SP",
            solar_config: defaultSolarConfig,
          });
          setAllProjects([targetProject]);
        } catch (createErr) {
          console.error("Failed to create default solar project:", createErr);
        }
      }

      if (targetProject) {
        const normalizedConfig = normalizeSolarConfig({
          ...(targetProject?.solar_config || {}),
          consumer_unit: targetProject?.solar_config?.consumer_unit
            || targetProject?.consumption?.consumer_unit
            || targetProject?.energy_bill?.installation_code
            || "",
          distributor: targetProject?.solar_config?.distributor
            || targetProject?.consumption?.distributor
            || targetProject?.distributor
            || "",
        });

        setProject(targetProject);
        setConfig(normalizedConfig);
        if (normalizedConfig.areas?.length > 0) {
          setSelectedAreaId(normalizedConfig.areas[0].id);
        }
        setSearchAddress(targetProject?.address || "");
        roofHistoryRef.current = [normalizedConfig.areas];
        roofHistoryIndexRef.current = 0;
        setRoofHistoryState({ canUndo: false, canRedo: false });
        setViewportRequest((n) => n + 1);

        try {
          window.localStorage.setItem("voltai_active_project_id", targetProject.id);
        } catch {}

        if (projectId !== targetProject.id) {
          setSearchParams({ project: targetProject.id }, { replace: true });
        }
        setLoadError(null);
      } else {
        setLoadError("Não foi possível carregar ou inicializar o projeto solar.");
      }
    } catch (err) {
      console.error("Error in loadSolarProject:", err);
      setLoadError(err.message || "Erro ao carregar o projeto solar.");
    } finally {
      setLoadingProject(false);
    }
  }, [projectId, setSearchParams]);

  useEffect(() => {
    loadSolarProject();
  }, [loadSolarProject]);

  const handleCreateNewSolarProject = async () => {
    try {
      setLoadingProject(true);
      const newProj = await backend.entities.Project.create({
        name: `Projeto Solar ${new Date().toLocaleDateString("pt-BR")}`,
        project_type: "Solar",
        type: "solar",
        status: "em_andamento",
        address: "São Paulo, SP",
        solar_config: defaultSolarConfig,
      });
      if (newProj?.id) {
        setAllProjects((prev) => [newProj, ...prev]);
        setSearchParams({ project: newProj.id });
        try { window.localStorage.setItem("voltai_active_project_id", newProj.id); } catch {}
        toast({
          title: "Novo projeto solar criado",
          description: `${newProj.name} iniciado com sucesso.`,
        });
      }
    } catch (err) {
      toast({
        title: "Erro ao criar projeto",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingProject(false);
    }
  };

  // Layouts e painéis calculados para TODAS as áreas de forma independente
  const multiAreaLayouts = useMemo(
    () => computeMultiAreaLayouts(config),
    [config]
  );

  const hasRoof = useMemo(() => {
    return (
      (multiAreaLayouts.length > 0 && multiAreaLayouts.some((a) => a.polygon?.length >= 3)) ||
      (Array.isArray(config.roof_polygon) && config.roof_polygon.length >= 3)
    );
  }, [multiAreaLayouts, config.roof_polygon]);

  // Define a área atualmente selecionada
  const selectedArea = useMemo(() => {
    if (!multiAreaLayouts.length) return null;
    return multiAreaLayouts.find((a) => a.id === selectedAreaId) || multiAreaLayouts[0];
  }, [multiAreaLayouts, selectedAreaId]);

  // Se selectedAreaId ainda não foi definido, sincroniza com a primeira área
  useEffect(() => {
    if (!selectedAreaId && multiAreaLayouts.length > 0) {
      setSelectedAreaId(multiAreaLayouts[0].id);
    }
  }, [multiAreaLayouts, selectedAreaId]);

  // Reúne todos os painéis fotovoltaicos de todas as áreas
  const allVisiblePanelPolygons = useMemo(
    () => multiAreaLayouts.flatMap((a) => a.panelPolygons || []),
    [multiAreaLayouts]
  );

  const aggregateMetrics = useMemo(
    () => getMultiAreaAggregateMetrics(multiAreaLayouts, config),
    [multiAreaLayouts, config]
  );

  const totalPanelCount = aggregateMetrics.totalPanels;
  const totalDcPowerKw = aggregateMetrics.totalDcPowerKw;

  const annualGenerationKwh = useMemo(
    () => estimateAnnualGenerationKwh(totalDcPowerKw) || Math.round(totalDcPowerKw * 1350),
    [totalDcPowerKw]
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
      project?.investment_brl || (totalDcPowerKw * 1000 * 3.5),
      annualSavingsBrl
    ) || 3.8,
    [project, totalDcPowerKw, annualSavingsBrl]
  );

  const strings = useMemo(
    () => calculateStringGrouping(totalPanelCount, {
      moduleWp: config.module_wp,
      inverterKw: config.inverter_kw,
    }),
    [totalPanelCount, config.module_wp, config.inverter_kw]
  );

  const technicalAnalysis = useMemo(
    () => (selectedArea?.polygon ? computeRoofFaceTechnicalAnalysis(selectedArea.polygon, selectedArea) : null),
    [selectedArea]
  );

  const voltage = Math.max(1, asNumber(config.ac_voltage, defaultSolarConfig.ac_voltage));
  const inverterKw = Math.max(0.1, asNumber(config.inverter_kw, defaultSolarConfig.inverter_kw));
  const acCurrent = config.ac_supply_type === "Trifásico"
    ? (inverterKw * 1000) / (Math.sqrt(3) * voltage)
    : (inverterKw * 1000) / voltage;
  const breaker = breakerForCurrent(acCurrent);

  const visualSizing = useMemo(() => ({
    panelCount: totalPanelCount,
    dcPowerKw: totalDcPowerKw,
    dcAcRatio: aggregateMetrics.dcAcRatio,
    acCurrent,
    breaker,
    roofArea: aggregateMetrics.totalAreaM2,
    annualGenerationKwh,
    annualSavingsBrl,
    paybackYears,
    strings,
    technicalAnalysis,
    areas: multiAreaLayouts,
  }), [totalPanelCount, totalDcPowerKw, aggregateMetrics, acCurrent, breaker, annualGenerationKwh, annualSavingsBrl, paybackYears, strings, technicalAnalysis, multiAreaLayouts, selectedArea]);

  const reportValidation = useMemo(
    () => validateProjectDataForReports(reportProject, config, visualSizing),
    [reportProject, config, visualSizing]
  );
  const isProjectDataComplete = reportValidation.valid;

  // Funções de Gerenciamento do Histórico (Undo / Redo)
  const syncRoofHistoryState = useCallback(() => {
    const index = roofHistoryIndexRef.current;
    setRoofHistoryState({
      canUndo: index > 0,
      canRedo: index < roofHistoryRef.current.length - 1,
    });
  }, []);

  const pushAreasHistory = useCallback((nextAreas) => {
    const nextKey = JSON.stringify(nextAreas);
    const currentHistory = roofHistoryRef.current;
    const currentKey = JSON.stringify(currentHistory[roofHistoryIndexRef.current] || []);

    if (nextKey !== currentKey) {
      const nextHistory = currentHistory.slice(0, roofHistoryIndexRef.current + 1);
      nextHistory.push(nextAreas);
      roofHistoryRef.current = nextHistory.slice(-40);
      roofHistoryIndexRef.current = roofHistoryRef.current.length - 1;
      syncRoofHistoryState();
    }
  }, [syncRoofHistoryState]);

  const undoRoofChange = useCallback(() => {
    if (roofHistoryIndexRef.current <= 0) return;
    roofHistoryIndexRef.current -= 1;
    const restoredAreas = roofHistoryRef.current[roofHistoryIndexRef.current];
    setConfig((prev) => normalizeSolarConfig({ ...prev, areas: restoredAreas }));
    setEditorMode("select");
    syncRoofHistoryState();
    toast({ title: "Alteração desfeita" });
  }, [syncRoofHistoryState, toast]);

  const redoRoofChange = useCallback(() => {
    if (roofHistoryIndexRef.current >= roofHistoryRef.current.length - 1) return;
    roofHistoryIndexRef.current += 1;
    const restoredAreas = roofHistoryRef.current[roofHistoryIndexRef.current];
    setConfig((prev) => normalizeSolarConfig({ ...prev, areas: restoredAreas }));
    setEditorMode("select");
    syncRoofHistoryState();
    toast({ title: "Alteração refeita" });
  }, [syncRoofHistoryState, toast]);

  // Atualiza campo global de configuração (ex: inversor, modelo do módulo)
  const updateConfig = (field, value) => {
    const next = { ...config, [field]: value };
    if (field === "module_preset_id") {
      const p = getModulePreset(value);
      next.module_preset_id = p.id;
      next.module_manufacturer = p.manufacturer;
      next.module_model = p.model;
      next.module_wp = p.wp;
      next.module_width_m = p.widthM;
      next.module_height_m = p.heightM;
    }
    setConfig(normalizeSolarConfig(next));
  };

  // Helper para obter com segurança todas as áreas existentes
  const getSafeExistingAreas = useCallback(() => {
    if (Array.isArray(config.areas) && config.areas.length > 0) {
      return config.areas;
    }
    if (Array.isArray(config.roof_polygon) && config.roof_polygon.length >= 3) {
      return [
        createDefaultSolarArea(
          {
            id: "area_1",
            name: "Água 1",
            polygon: config.roof_polygon,
            roof_rotation_deg: config.roof_rotation_deg || 0,
            roof_pitch_deg: config.roof_pitch_deg || 12,
            structure_type: config.structure_type || "triangle",
            module_orientation: config.module_orientation || "horizontal",
            auto_fill_surface: config.auto_fill_surface !== false,
          },
          1,
          config
        ),
      ];
    }
    return [];
  }, [config]);

  // Atualiza parâmetros da área selecionada (ex: inclinação, azimute, orientação, espaçamento)
  const updateSelectedArea = (field, value) => {
    if (!selectedArea) return;
    const targetId = selectedArea.id;
    const existing = getSafeExistingAreas();

    const nextAreas = existing.map((a) => {
      if (a.id !== targetId) return a;
      const updated = { ...a, [field]: value };
      if (field === "roof_width_m" || field === "roof_height_m") {
        updated.roof_area_m2 = round1(Number(updated.roof_width_m || 0) * Number(updated.roof_height_m || 0));
      }
      return normalizeSolarArea(updated, 1, config);
    });

    const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
    setConfig(nextConfig);
    pushAreasHistory(nextAreas);
  };

  // Ação de alinhar os módulos à borda da área ativa
  const handleAlignToEdge = useCallback((azimuthAngle) => {
    if (!selectedArea) return;
    updateSelectedArea("roof_rotation_deg", round2(azimuthAngle));
    toast({
      title: "Módulos alinhados à borda",
      description: `Azimute da ${selectedArea.name} ajustado para ${round2(azimuthAngle)}°.`,
    });
  }, [selectedArea, toast]);

  // Criação ou redesenho de área solar demarcada pelo usuário no mapa
  const handleCreateArea = useCallback((createdPositions) => {
    const normalizedPositions = serializeRoofPolygon(normalizeRoofPolygon(createdPositions));
    if (normalizedPositions.length < 3) return;

    const existingAreas = getSafeExistingAreas();

    // Se estava em modo de redesenho da área atual
    if (drawingTargetAreaId) {
      const nextAreas = existingAreas.map((a) => {
        if (a.id !== drawingTargetAreaId) return a;
        return createDefaultSolarArea(
          {
            ...a,
            polygon: normalizedPositions,
          },
          1,
          config
        );
      });
      const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
      setConfig(nextConfig);
      setSelectedAreaId(drawingTargetAreaId);
      setSelectedEntity({ type: "roof", id: drawingTargetAreaId });
      setEditorMode("select");
      setDrawingTargetAreaId(null);
      pushAreasHistory(nextAreas);
      toast({
        title: "Água do telhado atualizada!",
        description: "Geometria redesenhada com sucesso.",
      });
      return;
    }

    // Criação de NOVA ÁGUA adicional (quantas o usuário quiser)
    const newIndex = existingAreas.length + 1;
    const newArea = createDefaultSolarArea(
      {
        id: `area_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `Água ${newIndex}`,
        polygon: normalizedPositions,
        roof_rotation_deg: config.roof_rotation_deg || 0,
        roof_pitch_deg: config.roof_pitch_deg || 12,
        structure_type: config.structure_type || "triangle",
        module_orientation: config.module_orientation || "horizontal",
        auto_fill_surface: true,
      },
      newIndex,
      config
    );

    const nextAreas = [...existingAreas, newArea];
    const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
    setConfig(nextConfig);
    setSelectedAreaId(newArea.id);
    setSelectedEntity({ type: "roof", id: newArea.id });
    setEditorMode("select");
    setDrawingTargetAreaId(null);
    setSidebarOpen(true);
    pushAreasHistory(nextAreas);

    toast({
      title: "Água do telhado adicionada!",
      description: `${newArea.name} demarcada com sucesso (${newArea.roof_area_m2} m²).`,
    });
  }, [config, drawingTargetAreaId, getSafeExistingAreas, pushAreasHistory, toast]);

  // Alteração de vértices na área ativa
  const handleRoofGeometryChange = useCallback((positions) => {
    if (!selectedArea) return;
    const normalizedPositions = serializeRoofPolygon(normalizeRoofPolygon(positions));
    const existingAreas = getSafeExistingAreas();

    const nextAreas = existingAreas.map((a) => {
      if (a.id !== selectedArea.id) return a;
      return createDefaultSolarArea(
        {
          ...a,
          polygon: normalizedPositions,
        },
        1,
        config
      );
    });

    const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
    setConfig(nextConfig);
    pushAreasHistory(nextAreas);
  }, [config, selectedArea, getSafeExistingAreas, pushAreasHistory]);

  // Duplicação de área solar
  const handleDuplicateArea = (areaId) => {
    const source = config.areas.find((a) => a.id === areaId);
    if (!source) return;

    const newIndex = config.areas.length + 1;
    const cloned = createDefaultSolarArea(
      {
        ...source,
        id: `area_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `${source.name} (Cópia)`,
      },
      newIndex,
      config
    );

    const nextAreas = [...config.areas, cloned];
    const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
    setConfig(nextConfig);
    setSelectedAreaId(cloned.id);
    pushAreasHistory(nextAreas);

    toast({
      title: "Área duplicada",
      description: `${cloned.name} criada com sucesso.`,
    });
  };

  // Exclusão de área solar
  const handleDeleteArea = (areaId) => {
    const target = config.areas.find((a) => a.id === areaId);
    if (!target) return;

    const nextAreas = config.areas.filter((a) => a.id !== areaId);
    const nextConfig = normalizeSolarConfig({ ...config, areas: nextAreas });
    setConfig(nextConfig);

    if (selectedAreaId === areaId) {
      setSelectedAreaId(nextAreas[0]?.id || null);
    }
    pushAreasHistory(nextAreas);

    toast({
      title: "Área removida",
      description: `${target.name} e seus módulos foram removidos.`,
    });
  };



  const clearRoof = useCallback(() => {
    handleRoofGeometryChange([]);
    setSelectedEntity({ type: "none", id: null });
  }, [handleRoofGeometryChange]);

  // Selecionar área específica
  const handleSelectArea = useCallback((areaId) => {
    setSelectedAreaId(areaId);
    setSelectedEntity({ type: "roof", id: areaId });
    setSidebarOpen(true);
    setEditorMode("select");
  }, []);

  // Iniciar demarcação de nova água do telhado
  const handleStartDrawNewArea = useCallback(() => {
    setDrawingTargetAreaId(null);
    setEditorMode("draw-polygon");
    setSidebarOpen(true);
    toast({
      title: "Adicionar Nova Água de Telhado",
      description: "Clique no mapa de satélite para definir os vértices da nova água do telhado.",
    });
  }, [toast]);

  // Redesenhar a água do telhado atualmente selecionada
  const handleRedrawSelectedArea = useCallback(() => {
    if (!selectedArea) return;
    setDrawingTargetAreaId(selectedArea.id);
    setEditorMode("draw-polygon");
    toast({
      title: `Redesenhar ${selectedArea.name || "Água"}`,
      description: "Clique no mapa para redefinir os vértices desta água do telhado.",
    });
  }, [selectedArea, toast]);

  // Renomeação de área
  const handleSaveAreaName = (areaId) => {
    if (!tempAreaName.trim()) {
      setEditingAreaNameId(null);
      return;
    }
    const nextAreas = config.areas.map((a) =>
      a.id === areaId ? { ...a, name: tempAreaName.trim() } : a
    );
    setConfig(normalizeSolarConfig({ ...config, areas: nextAreas }));
    setEditingAreaNameId(null);
    setTempAreaName("");
    pushAreasHistory(nextAreas);
    toast({ title: "Nome atualizado" });
  };

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
    if (!hasRoof) {
      setEditorMode("draw-polygon");
      toast({
        title: "Demarque o telhado primeiro",
        description: "Clique no mapa para demarcar os cantos da água do telhado antes de gerar o Auto FV.",
      });
      return;
    }
    const bestLayout = getBestPanelLayout(config, 1200, "max_generation");
    const count = bestLayout.panelCount;
    const kwp = (count * (config.module_wp || 540)) / 1000;
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
    if (!reportValidation.valid) {
      toast({
        title: "Preencha os dados do projeto primeiro",
        description: reportValidation.message,
        variant: "destructive",
      });
      setProjectParamsInitialStep(reportValidation.firstMissingStep || "consumo");
      setProjectParamsOpen(true);
      return;
    }

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
    const activeId = projectId || project?.id;
    if (!activeId) return;
    setSaving(true);
    setSaveStatus("saving");
    try {
      const normalizedConfig = normalizeSolarConfig(config);
      
      // Sincronizar automaticamente o inversor com os circuitos do projeto e o quadro elétrico DIN
      const solarSync = syncSolarToProjectCircuits({
        ...(project || {}),
        solar_config: normalizedConfig,
      }, normalizedConfig);

      const payload = {
        project_type: "Solar",
        solar_config: normalizedConfig,
        voltage: normalizedConfig.ac_voltage,
        supply_type: normalizedConfig.ac_supply_type,
        circuits: solarSync.project.circuits,
        panel_boards: solarSync.project.panel_boards,
        panel_layout: solarSync.project.panel_layout,
        consumption: {
          ...(project?.consumption || {}),
          consumer_unit: normalizedConfig.consumer_unit || project?.consumption?.consumer_unit || "",
          distributor: normalizedConfig.distributor || project?.consumption?.distributor || "",
        },
      };
      await backend.entities.Project.update(activeId, payload);
      setConfig(normalizedConfig);
      setProject((current) => (current ? { ...current, ...payload } : current));
      setSaveStatus("saved");
      toast({
        title: "Projeto salvo com sucesso",
        description: `${normalizedConfig.areas.length} áreas solares salvas com ${totalPanelCount} módulos instalados (${visualSizing.dcPowerKw.toFixed(1)} kWp).`,
      });
    } catch {
      setSaveStatus("error");
      toast({ title: "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptLayout = () => {
    saveConfig();
    toast({
      title: "Arranjo aceito com sucesso",
      description: `${visualSizing.panelCount} módulos posicionados em ${multiAreaLayouts.length} áreas com potência de ${visualSizing.dcPowerKw.toFixed(2)} kWp.`,
    });
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
        if (selectedEntity?.type === "obstacle" && selectedEntity?.id) {
          handleRemoveObstacle(selectedEntity.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoRoofChange, redoRoofChange, selectedEntity]);

  if (loadingProject && !project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#070c14] text-white p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00d8b8]/10 text-[#00d8b8] ring-1 ring-[#00d8b8]/20 animate-pulse">
            <Sun className="h-7 w-7 text-[#00d8b8] animate-spin" style={{ animationDuration: "4s" }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Carregando Designer Solar</h3>
            <p className="text-xs text-slate-400 mt-1">Sincronizando arranjo fotovoltaico e coordenadas...</p>
          </div>
          <Loader2 className="h-5 w-5 animate-spin text-[#00d8b8]" />
          <Link
            to="/projects"
            className="text-xs text-slate-400 hover:text-white transition mt-2 underline"
          >
            Voltar aos Projetos
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] text-slate-900 p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200">
            <Sun className="h-7 w-7 text-amber-500" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-slate-900">Projeto Solar Não Encontrado</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              {loadError || "O projeto solicitado não foi localizado no seu dispositivo. Você pode iniciar um novo projeto solar ou escolher um projeto existente."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button
              type="button"
              onClick={handleCreateNewSolarProject}
              className="h-10 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-slate-950 font-black text-xs px-4 shadow-sm"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Criar Projeto Solar
            </Button>
            <Button asChild variant="outline" className="h-10 rounded-xl border-slate-200 text-xs font-bold text-slate-700">
              <Link to="/projects">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Ver Meus Projetos
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const hasAnyRoof = hasRoof;
  const currentPreset = getModulePreset(config.module_preset_id || config.module_model);

  // Elemento selecionado para o Inspector
  const selectedObstacle = selectedEntity?.type === "obstacle"
    ? (config?.obstacles || []).find((o) => o.id === selectedEntity.id)
    : null;

  const selectedModuleIdx = selectedEntity?.type === "module" ? Number(selectedEntity.id) : null;
  const selectedString = selectedEntity?.type === "string"
    ? strings.find((s) => s.id === selectedEntity.id)
    : null;

  return (
    <div className="fixed inset-0 z-[45] flex flex-col overflow-hidden bg-[#F8FAFC] font-inter text-slate-900 antialiased select-none">
      {/* 1. TOP BAR COMPACTA & PROFISSIONAL (NACIF LIGHT THEME) */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-3.5 z-30 shadow-sm">
        <div className="flex items-center gap-2.5">
          {/* Link Voltar / Branding */}
          <Link
            to="/projects"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition pr-2.5 border-r border-slate-200"
            title="Voltar aos Projetos"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Logo Oficial Nacif Electric + Badge Solar */}
          <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
            <img
              src={DEFAULT_LOGO_URL}
              alt="Nacif Electric"
              className="h-6 max-w-[130px] object-contain"
            />
            <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/40 rounded-md">
              SOLAR
            </span>
          </div>

          {/* Seletor & Badge do Projeto com Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/90 transition px-2.5 py-1 rounded-lg border border-slate-200 text-left"
                title="Clique para alternar projeto solar"
              >
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] md:max-w-[180px]">
                  {project?.name || "Projeto Solar"}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-500 shrink-0" />
                <span className="h-3 w-px bg-slate-300 mx-0.5" />
                <span className="text-[11px] font-extrabold text-[#009b84] whitespace-nowrap">
                  {multiAreaLayouts.length} {multiAreaLayouts.length === 1 ? "Área" : "Áreas"} · {visualSizing.panelCount} Módulos
                </span>
                <span className="text-[10px] text-slate-500 font-medium hidden sm:inline whitespace-nowrap">
                  ({visualSizing.dcPowerKw.toFixed(1)} kWp)
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto bg-white border-slate-200 p-1.5 shadow-2xl rounded-xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-2 py-1">
                Seus Projetos
              </DropdownMenuLabel>
              {allProjects.map((p) => {
                const isCurrent = p.id === project?.id;
                return (
                  <DropdownMenuItem
                    key={p.id}
                    onClick={() => {
                      if (p.id !== project?.id) {
                        setSearchParams({ project: p.id });
                      }
                    }}
                    className={`text-xs cursor-pointer rounded-lg px-2.5 py-1.5 flex items-center justify-between ${
                      isCurrent
                        ? "bg-[#E6FAF7] font-bold text-[#009b84]"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="truncate">{p.name || "Sem título"}</span>
                    {isCurrent && <Check className="h-3.5 w-3.5 text-[#00d8b8] shrink-0 ml-1" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem
                onClick={handleCreateNewSolarProject}
                className="text-xs font-bold text-[#009b84] hover:bg-[#E6FAF7] cursor-pointer rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Novo Projeto Solar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Busca de Endereço / CEP */}
          <form onSubmit={handleSearchAddress} className="relative hidden lg:flex items-center">
            <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-[#00d8b8]" />
            <Input
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Buscar endereço ou CEP..."
              className="h-7 w-56 xl:w-72 rounded-lg border-slate-200 bg-slate-50 pl-8 pr-7 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#00d8b8] focus:ring-1 focus:ring-[#00d8b8]"
            />
            <button
              type="submit"
              disabled={searchingAddress}
              className="absolute right-2 text-slate-400 hover:text-slate-700 transition"
            >
              {searchingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </button>
          </form>
        </div>

        {/* Lado Direito do Header: Status, Modos, Desfazer/Refazer, Relatórios e Salvar */}
        <div className="flex items-center gap-2">
          {/* Status Discreto de Salvamento */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border border-slate-200 mr-0.5">
            {saveStatus === "saving" ? (
              <span className="text-amber-700 border-amber-200 bg-amber-50 flex items-center gap-1 px-1.5 py-0.5 rounded">
                <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
              </span>
            ) : saveStatus === "error" ? (
              <span className="text-rose-700 border-rose-200 bg-rose-50 flex items-center gap-1 px-1.5 py-0.5 rounded">
                <AlertTriangle className="h-3 w-3" /> Erro ao salvar
              </span>
            ) : (
              <span className="text-emerald-700 border-emerald-200 bg-emerald-50 flex items-center gap-1 px-1.5 py-0.5 rounded">
                <Check className="h-3 w-3 stroke-[3]" /> Salvo
              </span>
            )}
          </div>

          {/* Modo Layout vs Elétrica */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setAppMode("layout")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                appMode === "layout" ? "bg-white text-slate-950 font-black shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Layout
            </button>
            <button
              type="button"
              onClick={() => setAppMode("electrical")}
              className={`px-2.5 py-1 text-xs font-bold rounded transition ${
                appMode === "electrical" ? "bg-white text-slate-950 font-black shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Elétrica
            </button>
          </div>

          {/* Toggle 2D / 3D */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`px-2 py-1 text-xs font-bold rounded transition ${
                viewMode === "map" ? "bg-white text-slate-950 font-black shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`px-2 py-1 text-xs font-bold rounded transition ${
                viewMode === "3d" ? "bg-white text-slate-950 font-black shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3D
            </button>
          </div>

          {/* Botão Parâmetros & Dados do Projeto */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setProjectParamsInitialStep(isProjectDataComplete ? "consumo" : (reportValidation.firstMissingStep || "consumo"));
              setProjectParamsOpen(true);
            }}
            className={`h-7 rounded-lg border text-xs font-bold shadow-sm transition flex items-center gap-1.5 ${
              isProjectDataComplete
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                : "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100 ring-1 ring-amber-400/40"
            }`}
            title={isProjectDataComplete ? "Parâmetros e Dados do Projeto" : "Preencher dados pendentes para relatórios"}
          >
            <Sliders className="h-3 w-3 text-[#00d8b8]" />
            <span>Dados do Projeto</span>
            {!isProjectDataComplete ? (
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            ) : (
              <Check className="h-3 w-3 text-emerald-600" />
            )}
          </Button>

          {/* Dropdown de Relatórios */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={`h-7 rounded-lg border text-xs font-bold shadow-sm transition ${
                  isProjectDataComplete
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                }`}
              >
                <Download className="mr-1 h-3 w-3 text-[#00d8b8]" /> Relatórios <ChevronDown className="ml-1 h-3 w-3 text-slate-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white border-slate-200 text-slate-900 p-1.5 shadow-2xl rounded-xl">
              <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                Documentos Técnicos PDF
              </DropdownMenuLabel>
              {!isProjectDataComplete && (
                <div
                  onClick={() => {
                    setProjectParamsInitialStep(reportValidation.firstMissingStep || "consumo");
                    setProjectParamsOpen(true);
                  }}
                  className="mx-1 my-1 p-2 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-[11px] font-semibold cursor-pointer hover:bg-amber-100 transition"
                >
                  <p className="font-bold flex items-center gap-1 text-amber-950">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Dados incompletos
                  </p>
                  <p className="text-[10px] text-amber-800 mt-0.5">Preencha os dados do projeto para gerar relatórios.</p>
                </div>
              )}
              <DropdownMenuItem
                onClick={() => handleDownloadDirect("executive")}
                className="text-xs font-bold text-[#009b84] hover:bg-[#E6FAF7] cursor-pointer rounded-lg px-2.5 py-2"
              >
                <Download className="mr-2 h-4 w-4 text-[#00d8b8]" /> Relatório Executivo Completo
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => handleDownloadDirect("site_plan")} className="text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5">
                Planta de Implantação ({multiAreaLayouts.length} {multiAreaLayouts.length === 1 ? "Área" : "Áreas"})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("electrical")} className="text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5">
                Diagrama Unifilar & Strings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("memorial")} className="text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5">
                Memorial Descritivo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("bom")} className="text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5">
                Lista de Materiais (BOM)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDirect("simulation")} className="text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5">
                Simulação de Geração Anual
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem
                onClick={() => setReportsOpen(true)}
                className="text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer rounded-lg px-2.5 py-1.5 flex items-center justify-between"
              >
                <span>Central de Relatórios...</span>
                <Layers className="h-3.5 w-3.5 text-[#00d8b8]" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Menu Secundário (•••) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-sm"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 text-slate-900 p-1 shadow-2xl rounded-xl text-xs">
              <DropdownMenuItem onClick={() => setFitRoofRequest((n) => n + 1)} className="cursor-pointer hover:bg-slate-100 rounded-md">
                <Maximize2 className="h-3.5 w-3.5 mr-2 text-[#00d8b8]" /> Centralizar no Mapa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearRoof} className="cursor-pointer hover:bg-rose-50 text-rose-600 rounded-md">
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
            className="h-7 rounded-lg bg-[#00d8b8] px-3 text-xs font-black text-slate-950 hover:bg-[#00c4a7] shadow-sm"
          >
            {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: INSPECTOR LATERAL (18-22%) + MAPA / EDITOR (78-82%) */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Painel Lateral Contextual (Inspector Light) */}
        {sidebarOpen ? (
          <aside className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-[#E2E8F0] bg-white overflow-hidden z-20 animate-in slide-in-from-left duration-200 shadow-sm">
            {/* Header do Inspector Contextual */}
            <div className="flex h-10 items-center justify-between border-b border-[#E2E8F0] px-3 bg-slate-50/80">
              <span className="text-xs font-black uppercase tracking-wider text-[#0f4f49] flex items-center gap-1.5">
                {selectedEntity?.type === "roof" ? (
                  <>
                    <Box className="h-3.5 w-3.5 text-[#00d8b8]" /> {selectedArea?.name || "Área do Telhado"}
                  </>
                ) : selectedEntity?.type === "module" ? (
                  <>
                    <Grid className="h-3.5 w-3.5 text-[#00d8b8]" /> Módulo #{selectedModuleIdx !== null ? selectedModuleIdx + 1 : 1}
                  </>
                ) : selectedEntity?.type === "string" ? (
                  <>
                    <Zap className="h-3.5 w-3.5 text-[#00d8b8]" /> {selectedString?.name || "String"}
                  </>
                ) : selectedEntity?.type === "obstacle" ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Obstáculo
                  </>
                ) : (
                  <>
                    <Sliders className="h-3.5 w-3.5 text-[#00d8b8]" /> Inspetor Solar ({multiAreaLayouts.length} {multiAreaLayouts.length === 1 ? "Área" : "Áreas"})
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/70 hover:text-slate-900 transition"
                title="Recolher painel (Modo Foco)"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo Rolável do Inspector Contextual */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
              {/* Seletor Rápido de Águas do Telhado em Abas */}
              {multiAreaLayouts.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-2 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-[#009b84]" /> Águas do Telhado ({multiAreaLayouts.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleStartDrawNewArea}
                      className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-[#009b84] hover:bg-[#E6FAF7] rounded-md transition"
                      title="Demarcar outra água de telhado"
                    >
                      <Plus className="h-3 w-3 stroke-[3]" /> Nova Água
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {multiAreaLayouts.map((area, idx) => {
                      const isSelected = area.id === selectedArea?.id;
                      return (
                        <button
                          key={area.id}
                          type="button"
                          onClick={() => handleSelectArea(area.id)}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            isSelected
                              ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm ring-1 ring-[#00d8b8]"
                              : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
                          }`}
                          title={`${area.name || `Água ${idx + 1}`} · ${area.panelCount || 0} módulos (${Math.round(area.roof_area_m2 || 0)} m²)`}
                        >
                          <span className="truncate">{area.name || `Água ${idx + 1}`}</span>
                          <span className="text-[10px] opacity-80 font-bold ml-1">
                            {area.panelCount || 0} un
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Seção 1: GERENCIAMENTO DE MÚLTIPLAS ÁREAS SOLARES */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-2.5 bg-slate-100/70 border-b border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Box className="h-4 w-4 text-[#009b84]" />
                    <span className="font-black text-[11px] uppercase tracking-wider text-slate-800">
                      ÁREAS SOLARES ({multiAreaLayouts.length})
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartDrawNewArea}
                    className="h-6 rounded-md bg-[#00d8b8] px-2 text-[10px] font-black text-slate-950 hover:bg-[#00c4a7] shadow-sm"
                  >
                    <Plus className="mr-0.5 h-3 w-3 stroke-[3]" /> Nova Área
                  </Button>
                </div>

                <div className="p-2 space-y-1.5 max-h-52 overflow-y-auto">
                  {multiAreaLayouts.map((area, idx) => {
                    const isSelected = area.id === selectedArea?.id;
                    const isEditingName = editingAreaNameId === area.id;

                    return (
                      <div
                        key={area.id}
                        onClick={() => {
                          setSelectedAreaId(area.id);
                          setSelectedEntity({ type: "roof", id: area.id });
                        }}
                        className={`group relative rounded-lg border p-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-[#00d8b8] bg-[#E6FAF7] shadow-sm ring-1 ring-[#00d8b8]/30"
                            : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 flex-1 mr-1 min-w-0">
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-black ${
                              isSelected ? "bg-[#00d8b8] text-slate-950" : "bg-slate-200 text-slate-700"
                            }`}>
                              {idx + 1}
                            </span>
                            {isEditingName ? (
                              <div className="flex items-center gap-1 flex-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={tempAreaName}
                                  onChange={(e) => setTempAreaName(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleSaveAreaName(area.id)}
                                  className="h-6 text-xs bg-white text-slate-900 border-[#00d8b8] px-1.5"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveAreaName(area.id)}
                                  className="h-6 w-6 flex items-center justify-center rounded bg-[#00d8b8] text-slate-950 font-bold"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <span className={`font-bold text-xs truncate ${isSelected ? "text-[#007f6c]" : "text-slate-800"}`}>
                                {area.name || `Área ${idx + 1}`}
                              </span>
                            )}
                          </div>

                          {/* Ações da Área: Renomear, Duplicar, Excluir */}
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAreaNameId(area.id);
                                setTempAreaName(area.name);
                              }}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                              title="Renomear área"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateArea(area.id)}
                              className="h-5 w-5 flex items-center justify-center rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800"
                              title="Duplicar área"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            {multiAreaLayouts.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteArea(area.id)}
                                className="h-5 w-5 flex items-center justify-center rounded hover:bg-rose-100 text-rose-500 hover:text-rose-700"
                                title="Excluir área"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Métricas da área */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                          <span className="font-bold text-[#009b84]">{area.panelCount || 0} mód.</span>
                          <span>•</span>
                          <span>{area.dcPowerKw ? area.dcPowerKw.toFixed(1) : 0} kWp</span>
                          <span>•</span>
                          <span>{Math.round(area.roof_area_m2 || 0)} m²</span>
                          <span>•</span>
                          <span>{area.roof_pitch_deg || 0}°</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CASO 1: ÁREA DO TELHADO SELECIONADA */}
              {selectedEntity.type === "roof" && selectedArea && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Área Útil</span>
                      <span className="font-black text-slate-900">{(selectedArea.roof_area_m2 || visualSizing.roofArea).toFixed(1)} m²</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Azimute</span>
                      <span className="font-black text-[#009b84]">{selectedArea.roof_rotation_deg || 0}°</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Inclinação</span>
                      <span className="font-black text-slate-900">{selectedArea.roof_pitch_deg || 0}°</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Módulos Instalados</span>
                      <span className="font-black text-emerald-600">{selectedArea.panelCount || 0} un</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Potência CC</span>
                      <span className="font-black text-slate-900">{(selectedArea.dcPowerKw || 0).toFixed(2)} kWp</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      onClick={handleTriggerAutoFv}
                      className="w-full h-8 rounded-lg bg-[#00d8b8] text-slate-950 font-black text-xs hover:bg-[#00c4a7] shadow-sm"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Auto Preencher Módulos
                    </Button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditorMode("edit")}
                        className="h-8 rounded-lg border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Pencil className="h-3 w-3 mr-1" /> Vértices
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRedrawSelectedArea}
                        className="h-8 rounded-lg border-slate-200 bg-[#E6FAF7] text-[#009b84] font-bold text-xs hover:bg-[#d5f7f2]"
                      >
                        <RotateCw className="h-3 w-3 mr-1" /> Redesenhar
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFitRoofRequest((n) => n + 1)}
                      className="w-full h-7 rounded-lg border-slate-200 bg-white text-slate-700 font-medium text-xs hover:bg-slate-50 hover:text-slate-900"
                    >
                      <Maximize2 className="h-3 w-3 mr-1" /> Centralizar no Telhado
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO 2: MÓDULO SELECIONADO */}
              {selectedEntity?.type === "module" && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Identificador</span>
                      <span className="font-black text-[#009b84]">Módulo #{selectedModuleIdx !== null ? selectedModuleIdx + 1 : 1}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Modelo</span>
                      <span className="font-bold text-slate-900 truncate max-w-[140px]">{currentPreset.model}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Potência</span>
                      <span className="font-black text-emerald-600">{currentPreset.wp} Wp</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Dimensões</span>
                      <span className="font-bold text-slate-900">{currentPreset.widthM}m × {currentPreset.heightM}m</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Orientação</span>
                      <span className="font-bold text-slate-900 capitalize">{config.module_orientation === "horizontal" ? "Paisagem" : "Retrato"}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAppMode("electrical")}
                      className="w-full h-8 rounded-lg border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50"
                    >
                      <Zap className="h-3.5 w-3.5 mr-1.5 text-[#00d8b8]" /> Ver String Elétrica
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedEntity({ type: "none", id: null })}
                      className="w-full h-7 rounded-lg text-slate-500 hover:text-slate-900 text-xs hover:bg-slate-100"
                    >
                      Fechar Seleção
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO 3: OBSTÁCULO SELECIONADO */}
              {selectedEntity?.type === "obstacle" && selectedObstacle && (
                <div className="space-y-3 animate-in fade-in">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Nome</span>
                      <span className="font-black text-rose-600">{selectedObstacle.name}</span>
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-600">Raio de Afastamento (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0.2"
                        max="10"
                        value={selectedObstacle.radiusM || 1.0}
                        onChange={(e) => handleUpdateObstacle(selectedObstacle.id, { radiusM: parseFloat(e.target.value) || 1.0 })}
                        className="mt-1 h-8 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-rose-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => handleRemoveObstacle(selectedObstacle.id)}
                      className="w-full h-8 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remover Obstáculo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedEntity({ type: "none", id: null })}
                      className="w-full h-7 rounded-lg text-slate-500 hover:text-slate-900 text-xs hover:bg-slate-100"
                    >
                      Fechar
                    </Button>
                  </div>
                </div>
              )}

              {/* CASO DEFAULT / CONFIGURAÇÕES GERAIS */}
              {selectedEntity.type !== "obstacle" && selectedEntity.type !== "module" && (
                <div className="space-y-3.5">
                  {!hasRoof ? (
                    <div className="space-y-3.5 animate-in fade-in">
                      <div className="rounded-xl border border-[#00d8b8]/30 bg-gradient-to-b from-[#E6FAF7]/60 to-slate-50 p-4 text-center space-y-3 shadow-sm">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00d8b8]/10 border border-[#00d8b8]/30 text-[#009b84] shadow-inner">
                          <Pencil className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Nenhuma Área Demarcada</h4>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                            Demarque a água do telhado no mapa por satélite para iniciar o dimensionamento e posicionar os módulos fotovoltaicos.
                          </p>
                        </div>
                        <Button
                          type="button"
                          onClick={() => setEditorMode("draw-polygon")}
                          className="w-full h-9 rounded-xl bg-[#00d8b8] hover:bg-[#00c4a7] text-slate-950 font-black text-xs shadow-md shadow-[#00d8b8]/20 active:scale-95 transition-all"
                        >
                          <Plus className="h-4 w-4 mr-1.5 stroke-[3]" /> Demarcar Telhado
                        </Button>
                      </div>

                      <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Passo a Passo Rápido</div>
                        <div className="space-y-1.5 text-[11px] text-slate-700">
                          <div className="flex items-start gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E6FAF7] text-[#009b84] font-bold text-[10px]">1</span>
                            <span>Aproxime o zoom no telhado do imóvel.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E6FAF7] text-[#009b84] font-bold text-[10px]">2</span>
                            <span>Clique em <strong>Demarcar Telhado</strong>.</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E6FAF7] text-[#009b84] font-bold text-[10px]">3</span>
                            <span>Clique nos cantos e feche no 1º ponto verde.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Seletor Compacto do Módulo FV */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-1.5 shadow-sm">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                            MÓDULO FOTOVOLTAICO
                          </Label>
                          <span className="text-[10px] font-bold text-[#009b84] bg-[#E6FAF7] px-1.5 py-0.5 rounded border border-[#00d8b8]/30">
                            {currentPreset.wp} Wp
                          </span>
                        </div>
                        <select
                          value={config.module_preset_id}
                          onChange={(e) => updateConfig("module_preset_id", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-900 focus:border-[#00d8b8] focus:outline-none shadow-sm"
                        >
                          {MODULE_CATALOG.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <span>{currentPreset.widthM}m × {currentPreset.heightM}m</span>
                          <span>{currentPreset.manufacturer}</span>
                        </div>
                      </div>

                      {/* 4 Seções em Abas Compactas */}
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
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
                                ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                                : "text-slate-600 hover:text-slate-900"
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
                            <Label className="text-[10px] font-bold text-slate-600">Orientação dos Módulos</Label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedArea) updateSelectedArea("module_orientation", "horizontal");
                                  updateConfig("module_orientation", "horizontal");
                                }}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                                  (selectedArea ? selectedArea.module_orientation : config.module_orientation) === "horizontal"
                                    ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                              >
                                <span>Paisagem</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedArea) updateSelectedArea("module_orientation", "vertical");
                                  updateConfig("module_orientation", "vertical");
                                }}
                                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                                  (selectedArea ? selectedArea.module_orientation : config.module_orientation) === "vertical"
                                    ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                    : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                }`}
                              >
                                <span>Retrato</span>
                              </button>
                            </div>
                          </div>

                          {/* Estrutura de Fixação */}
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-600">Estrutura de Fixação</Label>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { id: "coplanar", label: "Coplanar" },
                                { id: "triangle", label: "Triângulo" },
                                { id: "shed", label: "Shed" },
                              ].map((st) => (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    if (selectedArea) updateSelectedArea("structure_type", st.id);
                                    updateConfig("structure_type", st.id);
                                  }}
                                  className={`py-1.5 rounded-lg border text-center text-xs transition ${
                                    (selectedArea ? selectedArea.structure_type : config.structure_type) === st.id
                                      ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                      : "border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50"
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
                              <Label className="text-[10px] font-bold text-slate-600">Espaç. Colunas (cm)</Label>
                              <Input
                                type="number"
                                value={(selectedArea ? selectedArea.column_gap_cm : config.column_gap_cm) || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  if (selectedArea) updateSelectedArea("column_gap_cm", val);
                                  updateConfig("column_gap_cm", val);
                                }}
                                className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600">Espaç. Linhas (cm)</Label>
                              <Input
                                type="number"
                                value={(selectedArea ? selectedArea.row_gap_cm : config.row_gap_cm) || 0}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10) || 0;
                                  if (selectedArea) updateSelectedArea("row_gap_cm", val);
                                  updateConfig("row_gap_cm", val);
                                }}
                                className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                              />
                            </div>
                          </div>

                          {/* Switch Preenchimento Automático */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <div className="flex flex-col">
                              <span className="text-[10.5px] font-black uppercase text-slate-800 tracking-wider">
                                Preencher Área
                              </span>
                              <span className="text-[9.5px] text-slate-500">
                                Máxima ocupação válida
                              </span>
                            </div>
                            <Switch
                              checked={(selectedArea ? selectedArea.auto_fill_surface : config.auto_fill_surface) ?? true}
                              onCheckedChange={(checked) => {
                                if (selectedArea) updateSelectedArea("auto_fill_surface", checked);
                                updateConfig("auto_fill_surface", checked);
                              }}
                              className="data-[state=checked]:bg-[#00d8b8]"
                            />
                          </div>

                          {selectedArea && !selectedArea.auto_fill_surface && (
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600">Módulos Desejados nesta Área</Label>
                              <Input
                                type="number"
                                min="1"
                                max="1200"
                                value={selectedArea.requested_panel_count || 14}
                                onChange={(e) => updateSelectedArea("requested_panel_count", parseInt(e.target.value, 10) || 1)}
                                className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* CONTEÚDO DA ABA: ELÉTRICA */}
                      {activeInspectorTab === "electrical" && (
                        <div className="space-y-3 animate-in fade-in">
                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2 shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Inversor</span>
                              <span className="font-bold text-[#009b84]">{config.inverter_manufacturer} · {config.inverter_kw} kW</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Tensão / Rede</span>
                              <span className="font-bold text-slate-900">{config.ac_voltage}V ({config.ac_supply_type})</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Corrente CA Est.</span>
                              <span className="font-bold text-slate-900">{visualSizing.acCurrent.toFixed(1)} A</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Disjuntor Sugerido</span>
                              <span className="font-black text-emerald-600">{visualSizing.breaker} A</span>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-600">Strings Dimensionadas</Label>
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                              {strings.map((str) => (
                                <div
                                  key={str.id}
                                  className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white text-[11px] shadow-sm"
                                >
                                  <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full bg-[#00d8b8]" />
                                    <span className="font-bold text-slate-900">{str.name}</span>
                                  </div>
                                  <span className="text-slate-500 font-medium">{str.moduleCount} mód. · {str.vocV}V</span>
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
                              <Label className="text-[10px] font-bold text-slate-600">Azimute (°)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={(selectedArea ? selectedArea.roof_rotation_deg : config.roof_rotation_deg) || 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (selectedArea) updateSelectedArea("roof_rotation_deg", val);
                                  updateConfig("roof_rotation_deg", val);
                                }}
                                className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600">Inclinação (°)</Label>
                              <Input
                                type="number"
                                step="0.1"
                                value={(selectedArea ? selectedArea.roof_pitch_deg : config.roof_pitch_deg) || 0}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (selectedArea) updateSelectedArea("roof_pitch_deg", val);
                                  updateConfig("roof_pitch_deg", val);
                                }}
                                className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-1.5 text-[11px] shadow-sm">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Orientação Solar</span>
                              <span className="font-bold text-[#009b84]">{visualSizing.technicalAnalysis.azimuth.formatted}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">HSP Efetivo</span>
                              <span className="font-bold text-slate-900">{visualSizing.technicalAnalysis.effectiveHsp} h/dia</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Perdas Orientação/Sombras</span>
                              <span className="font-bold text-amber-600">~{visualSizing.technicalAnalysis.estimatedLossPct}%</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* CONTEÚDO DA ABA: AVANÇADO */}
                      {activeInspectorTab === "advanced" && (
                        <div className="space-y-3 animate-in fade-in">
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">Ponto de Conexão Elétrico</Label>
                            <Input
                              value={config.connection_point}
                              onChange={(e) => updateConfig("connection_point", e.target.value)}
                              className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs text-slate-900 focus:border-[#00d8b8]"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] font-bold text-slate-600">Local Padrão de Entrada</Label>
                            <Input
                              value={config.entry_standard_location}
                              onChange={(e) => updateConfig("entry_standard_location", e.target.value)}
                              className="mt-0.5 h-7 rounded-lg border-slate-200 bg-white text-xs text-slate-900 focus:border-[#00d8b8]"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Atalho para os Parâmetros e Passo a Passo do Projeto */}
            <div className="px-3 py-2 border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => {
                  setProjectParamsInitialStep("equipamentos");
                  setProjectParamsOpen(true);
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-[#E6FAF7] hover:border-[#00d8b8] p-2.5 transition text-left group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-800 flex items-center gap-1.5 group-hover:text-[#007f6c]">
                    <Sliders className="h-3.5 w-3.5 text-[#00d8b8]" /> Parâmetros do Projeto
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-[#007f6c]">
                    5 Etapas →
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Inversor, módulos, consumo e memorial descritivo.
                </p>
              </button>
            </div>

            {/* Ações Inferiores da Sidebar */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/90 grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={undoRoofChange}
                disabled={!roofHistoryState.canUndo}
                className="h-8 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 uppercase tracking-wider"
              >
                DESFAZER
              </Button>
              <Button
                type="button"
                onClick={handleAcceptLayout}
                className="h-8 rounded-lg bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00c4a7] shadow-sm uppercase tracking-wider"
              >
                ACEITAR
              </Button>
            </div>
          </aside>
        ) : (
          /* Botão Flutuante para Reabrir Inspector */
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-14 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white/95 text-slate-700 shadow-xl backdrop-blur-md hover:bg-slate-50 hover:text-slate-900 transition"
            title="Abrir Inspetor"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Canvas Central (Mapa 2D / 3D) */}
        <main className="relative flex-1 bg-slate-100 overflow-hidden">
          {/* TOOLBAR FLUTUANTE CENTRAL SOBRE O MAPA (LIGHT THEME) */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1 text-slate-800 shadow-2xl backdrop-blur-md">
            <button
              type="button"
              onClick={() => setEditorMode("select")}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                editorMode === "select" ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm" : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title="Selecionar / Navegar (V)"
            >
              <MousePointer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Selecionar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (editorMode === "draw-polygon") {
                  setEditorMode("select");
                } else {
                  handleStartDrawNewArea();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                editorMode === "draw-polygon"
                  ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                  : !hasRoof
                  ? "bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/40 hover:bg-[#d5f7f2]"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title={!hasRoof ? "Demarcar Área do Telhado (A)" : "Adicionar Nova Água de Telhado (A)"}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{!hasRoof ? "Demarcar Telhado" : "Área"}</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerAutoFv}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              title="Auto Preencher Módulos (F)"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Auto FV</span>
            </button>

            {/* Dropdown de Obstáculos */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                  title="Adicionar Obstáculo"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Obstáculo</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 bg-white border-slate-200 text-slate-900 p-1 text-xs shadow-2xl rounded-xl">
                <DropdownMenuLabel className="text-[10px] font-black uppercase text-slate-400 px-2 py-1">
                  Posicionar no Telhado
                </DropdownMenuLabel>
                {OBSTACLE_PRESETS.map((obs) => {
                  const Icon = obs.icon;
                  return (
                    <DropdownMenuItem
                      key={obs.type}
                      onClick={() => setPendingObstaclePreset(obs)}
                      className="cursor-pointer hover:bg-slate-100 rounded-md py-1.5 px-2 flex items-center gap-2 text-slate-700 hover:text-slate-900"
                    >
                      <Icon className="h-3.5 w-3.5 text-[#00d8b8]" />
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
                editorMode === "measure" ? "bg-amber-400 text-slate-950 font-black shadow-sm" : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title="Régua / Medir Distância (R)"
            >
              <Ruler className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Medir</span>
            </button>

            <span className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Desfazer / Refazer */}
            <button
              type="button"
              onClick={undoRoofChange}
              disabled={!roofHistoryState.canUndo}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 transition"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={redoRoofChange}
              disabled={!roofHistoryState.canRedo}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 transition"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* BANNER FLUTUANTE DE PREVIEW DO AUTO FV (LIGHT) */}
          {autoFvPreview && (
            <div className="absolute top-16 inset-x-0 z-[550] flex justify-center pointer-events-none animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-300 bg-white/95 px-4 py-2 text-xs text-slate-900 shadow-2xl backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                <span>
                  <strong>{autoFvPreview.count} módulos</strong> ({autoFvPreview.kwp} kWp) · Ocupação: {autoFvPreview.occupancy}%
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyAutoFv}
                    className="h-6 rounded-md bg-emerald-500 text-white font-black px-2.5 text-[11px] hover:bg-emerald-600 shadow-sm"
                  >
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAutoFvPreview(null)}
                    className="h-6 rounded-md text-slate-500 hover:text-slate-900 text-[11px] hover:bg-slate-100"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BANNER DE INSTRUÇÃO PARA POSICIONAR OBSTÁCULO (LIGHT) */}
          {pendingObstaclePreset && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[550] flex justify-center animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-rose-300 bg-white/95 px-4 py-2 text-xs font-bold text-rose-800 shadow-2xl backdrop-blur-md">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
                Clique no telhado para posicionar: {pendingObstaclePreset.name}
                <button
                  type="button"
                  onClick={() => setPendingObstaclePreset(null)}
                  className="ml-1 rounded-lg p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Renderizador 2D ou 3D */}
          {viewMode === "3d" ? (
            <Solar3DView
              config={config}
              areas={multiAreaLayouts}
              sizing={visualSizing}
              panelPolygons={allVisiblePanelPolygons}
            />
          ) : (
            <SolarDesignerMap
              className="h-full w-full"
              config={config}
              areas={multiAreaLayouts}
              selectedAreaId={selectedAreaId}
              viewMode={viewMode}
              sizing={visualSizing}
              editorMode={editorMode}
              fitRoofRequest={fitRoofRequest}
              viewportRequest={viewportRequest}
              selectedObstacleId={selectedEntity?.type === "obstacle" ? selectedEntity.id : null}
              selectedModuleIndex={selectedModuleIdx}
              electricalMode={appMode === "electrical"}
              strings={strings}
              showBadges={true}
              showMeasurements
              onEditorModeChange={setEditorMode}
              onSelectArea={handleSelectArea}
              onSelectRoof={() => setSelectedEntity({ type: "roof", id: selectedArea?.id })}
              onCreateArea={handleCreateArea}
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

          {/* 3. RESUMO INFERIOR COMPACTO (NACIF LIGHT HUD) */}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-4 md:gap-6 rounded-2xl border border-slate-200/90 bg-white/95 px-5 md:px-7 py-2.5 text-slate-900 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">MÓDULOS FV</span>
              <span className="text-xs md:text-sm font-black text-slate-900">
                {visualSizing.panelCount} <span className="text-slate-400 text-[10px] font-semibold">un</span>
              </span>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">POTÊNCIA CC</span>
              <span className="text-xs md:text-sm font-black text-slate-900">
                {visualSizing.dcPowerKw.toFixed(1)} <span className="text-slate-400 text-[10px] font-semibold">kWp</span>
              </span>
            </div>

            <div className="h-6 w-px bg-slate-200" />

            <div className="flex flex-col items-center">
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">GERAÇÃO ANUAL</span>
              <span className="text-xs md:text-sm font-black text-[#009b84]">
                {(annualGenerationKwh / 1000).toFixed(1)} <span className="text-[#009b84]/70 text-[10px] font-semibold">MWh/ano</span>
              </span>
            </div>

            <div className="h-6 w-px bg-slate-200 hidden sm:flex" />

            <div className="flex flex-col items-center hidden sm:flex">
              <span className="text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400">ECONOMIA ESTIMADA</span>
              <span className="text-xs md:text-sm font-black text-emerald-600">
                R$ {annualSavingsBrl.toLocaleString("pt-BR")}<span className="text-emerald-600/70 text-[10px] font-semibold">/ano</span>
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
        onOpenParameters={(step) => {
          setProjectParamsInitialStep(step || "consumo");
          setProjectParamsOpen(true);
        }}
      />

      {/* Modal / Passo a Passo Completo dos Parâmetros do Projeto (Consumo, Equipamentos, Memorial, etc.) */}
      <SolarProjectParametersModal
        open={projectParamsOpen}
        onOpenChange={setProjectParamsOpen}
        project={project}
        config={config}
        sizing={visualSizing}
        initialStep={projectParamsInitialStep}
        onSave={async (updatedProjectPayload, updatedConfigPatch) => {
          const nextConfig = normalizeSolarConfig({ ...config, ...updatedConfigPatch });
          setConfig(nextConfig);
          const activeId = projectId || project?.id;
          if (activeId) {
            try {
              const solarSync = syncSolarToProjectCircuits({
                ...(project || {}),
                ...updatedProjectPayload,
                solar_config: nextConfig,
              }, nextConfig);
              const payloadWithSync = {
                ...updatedProjectPayload,
                solar_config: nextConfig,
                circuits: solarSync.project.circuits,
                panel_boards: solarSync.project.panel_boards,
                panel_layout: solarSync.project.panel_layout,
              };
              const updated = await backend.entities.Project.update(activeId, payloadWithSync);
              setProject(updated);
            } catch (err) {
              console.error("Erro ao salvar projeto:", err);
            }
          }
        }}
      />
    </div>
  );
}
