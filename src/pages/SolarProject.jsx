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
import CustomModuleModal from "@/components/solar/CustomModuleModal";
import { syncSolarToProjectCircuits } from "@/lib/projectUnifiedSync";
import { validateProjectDataForReports } from "@/lib/solarWizardState";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  buildRoofPolygon,
  calculateStringGrouping,
  computeMultiAreaLayouts,
  computeRoofFaceTechnicalAnalysis,
  createDefaultSolarArea,
  getBestPanelLayout,
  getModulePreset,
  getAllModulePresets,
  PANEL_VISUAL_STYLES,
  getMultiAreaAggregateMetrics,
  getPolygonAreaSquareMeters,
  getRoofCenterFromConfig,
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
} from "@/lib/solarReportGenerator";
import { preloadSolarReportImages } from "@/lib/solarLayoutImageRenderer";
import brandLogoEnergy from "@/assets/brand-logo-principal.png";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Compass,
  Copy,
  DollarSign,
  Download,
  Flame,
  Grid,
  Info,
  Layers,
  Loader2,
  MapPin,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  MousePointer,
  Move,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Search,
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
  column_gap_cm: 2,
  row_gap_cm: 2,
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
  const [customModuleModalOpen, setCustomModuleModalOpen] = useState(false);
  const [customModulesRevision, setCustomModulesRevision] = useState(0);
  const [obstacleNudgeStep, setObstacleNudgeStep] = useState(0.5);
  const [searchAddress, setSearchAddress] = useState("");
  const [searchingAddress, setSearchingAddress] = useState(false);
  const cepDebounceRef = useRef(null);
  const [pendingObstaclePreset, setPendingObstaclePreset] = useState(null);
  const [editingAreaNameId, setEditingAreaNameId] = useState(null);
  const [tempAreaName, setTempAreaName] = useState("");
  const [drawingTargetAreaId, setDrawingTargetAreaId] = useState(null);

  // Módulos disponíveis (Catálogo Tier-1 + Personalizados pelo usuário)
  const allAvailableModules = useMemo(
    () => getAllModulePresets(config.custom_modules),
    [config.custom_modules, customModulesRevision]
  );

  // Seleções do Inspector Contextual
  const [selectedEntity, setSelectedEntity] = useState({ type: "none", id: null }); // type: "none" | "roof" | "module" | "string" | "obstacle"
  const [activeInspectorTab, setActiveInspectorTab] = useState("layout"); // "layout" | "electrical" | "mounting" | "advanced"

  // Estado de Auto FV Preview
  const [autoFvPreview, setAutoFvPreview] = useState(null);

  // Estados de Seções do Inspector Contextual e Resumo Inferior
  const [inspectorSections, setInspectorSections] = useState({
    geometry: true,
    modules: true,
    obstacles: false,
    analysis: true,
  });
  const [bottomSummaryExpanded, setBottomSummaryExpanded] = useState(false);
  const [tutorialHelpOpen, setTutorialHelpOpen] = useState(false);

  // Modo Foco (Maximiza tela do mapa, recolhe barras e inspetor)
  const [focusMode, setFocusMode] = useState(false);
  const previousSidebarStateRef = useRef(true);

  const toggleFocusMode = useCallback((desiredState) => {
    setFocusMode((prev) => {
      const next = typeof desiredState === "boolean" ? desiredState : !prev;
      if (next) {
        previousSidebarStateRef.current = sidebarOpen;
        setSidebarOpen(false);
        toast({
          title: "Modo Foco Ativado",
          description: "Painéis e barras recolhidos. Pressione F ou Esc para sair.",
        });
      } else {
        setSidebarOpen(previousSidebarStateRef.current);
        toast({
          title: "Modo Foco Desativado",
          description: "Disposição completa restaurada.",
        });
      }
      return next;
    });
  }, [sidebarOpen, toast]);

  const toggleInspectorSection = (sectionKey) => {
    setInspectorSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

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

  // Pré-renderização em background das imagens com satélite dos prédios para os relatórios
  useEffect(() => {
    if (!reportProject) return;
    const timer = setTimeout(() => {
      preloadSolarReportImages({ project: reportProject, config, sizing: visualSizing });
    }, 800);
    return () => clearTimeout(timer);
  }, [reportProject, config, visualSizing]);

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
  const updateConfig = useCallback((field, value) => {
    setConfig((prevConfig) => {
      const next = { ...prevConfig, [field]: value };
      if (field === "module_preset_id") {
        const p = getModulePreset(value);
        next.module_preset_id = p.id;
        next.module_manufacturer = p.manufacturer;
        next.module_model = p.model;
        next.module_wp = p.wp;
        next.module_width_m = p.widthM;
        next.module_height_m = p.heightM;
      }
      return normalizeSolarConfig(next);
    });
  }, []);

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
            column_gap_cm: config.column_gap_cm ?? 2,
            row_gap_cm: config.row_gap_cm ?? 2,
          },
          1,
          config
        ),
      ];
    }
    return [];
  }, [config]);

  // Atualiza parâmetros da área selecionada (ex: inclinação, azimute, orientação, espaçamento)
  const updateSelectedArea = useCallback((fieldOrUpdates, value) => {
    const updates =
      typeof fieldOrUpdates === "object" && fieldOrUpdates !== null
        ? fieldOrUpdates
        : { [fieldOrUpdates]: value };

    setConfig((prevConfig) => {
      let existing = Array.isArray(prevConfig.areas) && prevConfig.areas.length > 0
        ? [...prevConfig.areas]
        : [];

      if (existing.length === 0 && Array.isArray(prevConfig.roof_polygon) && prevConfig.roof_polygon.length >= 3) {
        existing = [
          createDefaultSolarArea(
            {
              id: "area_1",
              name: "Água 1",
              polygon: prevConfig.roof_polygon,
              roof_rotation_deg: prevConfig.roof_rotation_deg || 0,
              roof_pitch_deg: prevConfig.roof_pitch_deg || 12,
              structure_type: prevConfig.structure_type || "triangle",
              module_orientation: prevConfig.module_orientation || "horizontal",
              auto_fill_surface: prevConfig.auto_fill_surface !== false,
              column_gap_cm: prevConfig.column_gap_cm ?? 2,
              row_gap_cm: prevConfig.row_gap_cm ?? 2,
            },
            1,
            prevConfig
          ),
        ];
      }

      const targetId = selectedAreaId || existing[0]?.id;
      if (!targetId && existing.length === 0) return prevConfig;

      const nextAreas = existing.map((a, idx) => {
        if (a.id !== targetId && (targetId || idx !== 0)) return a;
        const updated = { ...a, ...updates };
        if ("roof_width_m" in updates || "roof_height_m" in updates) {
          updated.roof_area_m2 = round1(Number(updated.roof_width_m || 0) * Number(updated.roof_height_m || 0));
        }
        return normalizeSolarArea(updated, idx + 1, prevConfig);
      });

      const isPrimary = !targetId || targetId === existing[0]?.id;
      const nextConfigObj = {
        ...prevConfig,
        ...(isPrimary ? updates : {}),
        areas: nextAreas,
      };

      if (isPrimary) {
        if ("roof_rotation_deg" in updates) nextConfigObj.roof_rotation_deg = updates.roof_rotation_deg;
        if ("roof_pitch_deg" in updates) nextConfigObj.roof_pitch_deg = updates.roof_pitch_deg;
      }

      const nextConfig = normalizeSolarConfig(nextConfigObj);
      pushAreasHistory(nextAreas);
      return nextConfig;
    });
  }, [selectedAreaId, pushAreasHistory]);

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
    const primary = existingAreas[0];
    const newArea = createDefaultSolarArea(
      {
        id: `area_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: `Água ${newIndex}`,
        polygon: normalizedPositions,
        roof_rotation_deg: primary?.roof_rotation_deg ?? config.roof_rotation_deg ?? 0,
        roof_pitch_deg: primary?.roof_pitch_deg ?? config.roof_pitch_deg ?? 12,
        structure_type: primary?.structure_type ?? config.structure_type ?? "triangle",
        module_orientation: primary?.module_orientation ?? config.module_orientation ?? "horizontal",
        column_gap_cm: primary?.column_gap_cm ?? config.column_gap_cm ?? 2,
        row_gap_cm: primary?.row_gap_cm ?? config.row_gap_cm ?? 2,
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

  // Harmoniza uma área secundária específica com o design e orientação da área principal (Água 1)
  const handleHarmonizeAreaWithPrimary = useCallback((targetAreaId) => {
    const existing = getSafeExistingAreas();
    const primary = existing[0];
    if (!primary || !targetAreaId) return;

    updateSelectedArea({
      roof_rotation_deg: primary.roof_rotation_deg,
      roof_pitch_deg: primary.roof_pitch_deg,
      module_orientation: primary.module_orientation || "horizontal",
      structure_type: primary.structure_type || "triangle",
      column_gap_cm: primary.column_gap_cm ?? 2,
      row_gap_cm: primary.row_gap_cm ?? 2,
    });

    toast({
      title: "Design harmonizado!",
      description: `Painéis alinhados perfeitamente com ${primary.name || "Água 1"}.`,
    });
  }, [getSafeExistingAreas, updateSelectedArea, toast]);

  // Harmoniza todas as áreas do projeto com o design e orientação da área principal (Água 1)
  const handleHarmonizeAllAreas = useCallback(() => {
    const existing = getSafeExistingAreas();
    const primary = existing[0];
    if (!primary || existing.length <= 1) return;

    const harmonized = existing.map((a, idx) => {
      if (idx === 0) return a;
      return {
        ...a,
        roof_rotation_deg: primary.roof_rotation_deg,
        roof_pitch_deg: primary.roof_pitch_deg,
        module_orientation: primary.module_orientation || "horizontal",
        structure_type: primary.structure_type || "triangle",
        column_gap_cm: primary.column_gap_cm ?? 2,
        row_gap_cm: primary.row_gap_cm ?? 2,
      };
    });

    const nextConfig = normalizeSolarConfig({ ...config, areas: harmonized });
    setConfig(nextConfig);
    pushAreasHistory(harmonized);
    toast({
      title: "Todas as áreas harmonizadas!",
      description: `Módulos de todas as águas alinhados com o mesmo design e orientação da ${primary.name || "Água 1"}.`,
    });
  }, [config, getSafeExistingAreas, pushAreasHistory, toast]);

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

  const handleSearchAddress = async (e, overrideQuery) => {
    e?.preventDefault?.();
    if (cepDebounceRef.current) {
      clearTimeout(cepDebounceRef.current);
    }
    const query = (typeof overrideQuery === "string" ? overrideQuery : searchAddress)?.trim();
    if (!query) return;
    setSearchingAddress(true);
    try {
      const results = await geocodeAddress(query);
      if (results.length > 0) {
        const first = results[0];
        const nextLat = Number(first.lat);
        const nextLng = Number(first.lng);

        if (Number.isFinite(nextLat) && Number.isFinite(nextLng)) {
          setConfig((current) => ({
            ...current,
            map_center_lat: nextLat,
            map_center_lng: nextLng,
            map_zoom: 19,
          }));

          if (viewMode === "3d") {
            setViewMode("map");
          }

          const formattedDisplay = first.road
            ? [first.road, first.neighborhood, first.city && first.state ? `${first.city} - ${first.state}` : first.city, first.postcode].filter(Boolean).join(", ")
            : first.display_name;
          setSearchAddress(formattedDisplay || query);

          setProject((current) => {
            if (!current) return current;
            return {
              ...current,
              address: first.road
                ? `${first.road}${first.neighborhood ? ", " + first.neighborhood : ""}`
                : (first.display_name || current.address),
              city: first.city || current.city,
              state: first.state || current.state,
              zip_code: first.postcode || (query.match(/\d{5}-?\d{3}/)?.[0] || current.zip_code),
            };
          });

          setViewportRequest((n) => n + 1);
          toast({
            title: "Endereço localizado",
            description: formattedDisplay || first.display_name,
          });
          return;
        }
      }
      toast({
        title: "Endereço ou CEP não encontrado",
        description: "Não foi possível localizar o endereço ou CEP informado. Tente com outro termo ou número.",
        variant: "destructive",
      });
    } catch (err) {
      toast({
        title: "Erro na pesquisa de endereço",
        description: err.message || "Falha ao consultar CEP ou endereço.",
        variant: "destructive",
      });
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const val = e.target.value;
    setSearchAddress(val);

    if (cepDebounceRef.current) {
      clearTimeout(cepDebounceRef.current);
    }

    // Detecção automática quando o usuário digita ou cola um CEP (8 dígitos)
    const digitsOnly = val.replace(/\D/g, "");
    if (digitsOnly.length === 8) {
      cepDebounceRef.current = setTimeout(() => {
        handleSearchAddress(null, val);
      }, 400);
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
    setInspectorSections((prev) => ({ ...prev, obstacles: true }));
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

  const handleNudgeObstacle = (id, direction, stepMeters = 0.5) => {
    const obs = (config.obstacles || []).find((o) => o.id === id);
    if (!obs) return;
    const latDelta = stepMeters / 111111;
    const lngDelta = stepMeters / (111111 * Math.cos(((obs.lat || 0) * Math.PI) / 180));
    let newLat = obs.lat;
    let newLng = obs.lng;
    if (direction === "up") newLat += latDelta;
    if (direction === "down") newLat -= latDelta;
    if (direction === "left") newLng -= lngDelta;
    if (direction === "right") newLng += lngDelta;
    handleUpdateObstacle(id, { lat: newLat, lng: newLng });
  };

  const handleDuplicateObstacle = (id) => {
    const obs = (config.obstacles || []).find((o) => o.id === id);
    if (!obs) return;
    const newId = `obs_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const latDelta = 0.8 / 111111;
    const lngDelta = 0.8 / (111111 * Math.cos(((obs.lat || 0) * Math.PI) / 180));
    const duplicated = {
      ...obs,
      id: newId,
      name: `${obs.name || "Obstáculo"} (Cópia)`,
      lat: obs.lat + latDelta,
      lng: obs.lng + lngDelta,
    };
    const nextObstacles = [...config.obstacles, duplicated];
    updateConfig("obstacles", nextObstacles);
    setSelectedEntity({ type: "obstacle", id: newId });
    toast({
      title: "Obstáculo duplicado",
      description: "Novo obstáculo criado ao lado para ajuste.",
    });
  };

  const handleRemoveObstacle = (id) => {
    const nextObstacles = config.obstacles.filter((obs) => obs.id !== id);
    updateConfig("obstacles", nextObstacles);
    if (selectedEntity.id === id) {
      setSelectedEntity({ type: "none", id: null });
    }
    toast({ title: "Obstáculo removido" });
  };

  const handleDeleteSelectedModule = (moduleIdx = selectedModuleIdx) => {
    if (moduleIdx === null && selectedEntity?.type === "module") {
      moduleIdx = Number(selectedEntity.id);
    }
    if (moduleIdx === null || !Number.isFinite(moduleIdx)) return;

    if (selectedArea) {
      const currentCount = selectedArea.panelCount || selectedArea.panelPolygons?.length || 0;
      if (currentCount <= 1) {
        toast({
          title: "Não é possível remover o último módulo",
          description: "A área deve conter pelo menos 1 módulo ou ser excluída.",
          variant: "destructive",
        });
        return;
      }
      updateSelectedArea("auto_fill_surface", false);
      updateSelectedArea("requested_panel_count", Math.max(1, currentCount - 1));
    } else {
      const currentCount = config.requested_panel_count || totalPanelCount || 0;
      if (currentCount > 1) {
        updateConfig("auto_fill_surface", false);
        updateConfig("requested_panel_count", Math.max(1, currentCount - 1));
      }
    }
    setSelectedEntity({ type: "none", id: null });
    toast({
      title: "Módulo excluído",
      description: `Módulo #${moduleIdx + 1} removido com sucesso.`,
    });
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
    if (selectedArea) {
      updateSelectedArea({
        auto_fill_surface: true,
        requested_panel_count: autoFvPreview.count,
      });
    } else {
      updateConfig("auto_fill_surface", true);
      updateConfig("requested_panel_count", autoFvPreview.count);
    }
    setAutoFvPreview(null);
    toast({
      title: "Auto FV aplicado com sucesso",
      description: `${autoFvPreview.count} módulos posicionados com ${autoFvPreview.kwp} kWp.`,
    });
  };

  const handleDownloadDirect = async (reportType = "executive") => {
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
        const doc = await generateExecutiveSolarPdf(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "00_Relatorio_Executivo_Completo_Solar.pdf");
      } else if (reportType === "site_plan") {
        const doc = await generateSitePlanReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "01_Planta_Implantacao_Solar.pdf");
      } else if (reportType === "electrical") {
        const doc = await generateElectricalDiagramReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "02_Diagrama_Eletrico_Solar.pdf");
      } else if (reportType === "memorial") {
        const doc = await generateTechnicalMemorialReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "03_Memorial_Descritivo_Solar.pdf");
      } else if (reportType === "bom") {
        const doc = await generateBillOfMaterialsReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "04_Lista_Materiais_Solar.pdf");
      } else if (reportType === "simulation") {
        const doc = await generateGenerationSimulationReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "05_Simulacao_Geracao_Solar.pdf");
      } else if (reportType === "proposal") {
        const doc = await generateCommercialProposalReport(reportProject, config, visualSizing);
        await downloadPdfBlob(doc, "06_Proposta_Comercial_Solar.pdf");
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
        if (editorMode === "draw-polygon" || editorMode === "measure") {
          setEditorMode("select");
          return;
        }
        if (pendingObstaclePreset) {
          setPendingObstaclePreset(null);
          return;
        }
        if (autoFvPreview) {
          setAutoFvPreview(null);
          return;
        }
        if (selectedEntity?.type !== "none") {
          setSelectedEntity({ type: "none", id: null });
          return;
        }
        if (focusMode) {
          toggleFocusMode(false);
          return;
        }
        setEditorMode("select");
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

      if (e.key.toLowerCase() === "f") {
        toggleFocusMode();
        return;
      }

      if (e.key.toLowerCase() === "m") {
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
        } else if (selectedEntity?.type === "module" && selectedEntity?.id !== null) {
          handleDeleteSelectedModule(Number(selectedEntity.id));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undoRoofChange, redoRoofChange, selectedEntity, editorMode, pendingObstaclePreset, autoFvPreview, focusMode, toggleFocusMode, handleTriggerAutoFv, handleDeleteSelectedModule]);

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
  const currentPreset = getModulePreset(
    config.module_preset_id || config.module_model,
    config.custom_modules || []
  );

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
      {/* 1. TOP BAR COMPACTA & PROFISSIONAL (3 GRUPOS FUNCIONAIS) */}
      <header className={`flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-3.5 z-30 shadow-xs transition-all ${focusMode ? "hidden" : ""}`}>
        {/* GRUPO ESQUERDO: IDENTIFICAÇÃO (Voltar, Logo, Nome do Projeto, Estado de Salvamento) */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {/* Voltar */}
          <Link
            to="/projects"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50/70 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            title="Voltar aos Projetos"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
          </Link>

          {/* Logo Oficial Nacif Electric + Badge Solar */}
          <div className="flex items-center gap-2 pr-2.5 border-r border-slate-200 shrink-0">
            <img
              src={brandLogoEnergy}
              alt="NACIF Energy"
              className="h-6 max-w-[116px] object-contain shrink-0"
            />
            <span className="px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/40 rounded-md whitespace-nowrap shrink-0">
              SOLAR
            </span>
          </div>

          {/* Seletor do Projeto com Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 bg-slate-50 hover:bg-slate-100 transition px-2.5 rounded-lg border border-slate-200 text-left whitespace-nowrap shrink-0"
                title="Clique para alternar projeto solar"
              >
                <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] sm:max-w-[160px] xl:max-w-[200px]">
                  {project?.name || "Projeto Solar"}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                <span className="h-3.5 w-px bg-slate-200 mx-0.5 hidden sm:inline shrink-0" />
                <span className="text-[11px] font-bold text-[#009b84] whitespace-nowrap hidden sm:inline shrink-0">
                  {multiAreaLayouts.length} {multiAreaLayouts.length === 1 ? "Área" : "Áreas"} · {visualSizing.panelCount} un
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 max-h-80 overflow-y-auto bg-white border-slate-200 p-1.5 shadow-lg rounded-xl">
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

          {/* Estado de Salvamento (Pill Alinhado h-8) */}
          <div className="flex items-center text-[11px] font-bold whitespace-nowrap shrink-0">
            {saveStatus === "saving" ? (
              <span className="h-8 text-amber-700 border border-amber-200 bg-amber-50 flex items-center gap-1.5 px-2.5 rounded-lg whitespace-nowrap">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" /> Salvando...
              </span>
            ) : saveStatus === "error" ? (
              <span className="h-8 text-rose-700 border border-rose-200 bg-rose-50 flex items-center gap-1.5 px-2.5 rounded-lg whitespace-nowrap">
                <AlertTriangle className="h-3 w-3 shrink-0" /> Erro
              </span>
            ) : (
              <span className="h-8 text-emerald-700 border border-emerald-200 bg-emerald-50 flex items-center gap-1.5 px-2.5 rounded-lg whitespace-nowrap">
                <Check className="h-3 w-3 stroke-[2.5] shrink-0" /> Salvo
              </span>
            )}
          </div>
        </div>

        {/* GRUPO CENTRAL: CONTEXTO (Busca de Endereço, Layout/Elétrica, 2D/3D) */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* Busca de Endereço */}
          <form onSubmit={handleSearchAddress} className="relative flex items-center shrink-0">
            <MapPin className="absolute left-2.5 h-3.5 w-3.5 text-[#00d8b8] pointer-events-none" />
            <Input
              value={searchAddress}
              onChange={handleSearchInputChange}
              placeholder="Buscar endereço ou CEP..."
              className="h-8 w-52 lg:w-64 xl:w-72 rounded-lg border-slate-200 bg-slate-50 pl-8 pr-8 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#00d8b8] focus:bg-white focus:ring-1 focus:ring-[#00d8b8]"
            />
            <button
              type="submit"
              disabled={searchingAddress}
              className="absolute right-2.5 text-slate-400 hover:text-slate-700 transition"
              title="Buscar no mapa"
            >
              {searchingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00d8b8]" /> : <Search className="h-3.5 w-3.5" />}
            </button>
          </form>

          <span className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Navegação Layout / Elétrica */}
          <div className="flex h-8 items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setAppMode("layout")}
              className={`h-full px-3 rounded-md font-bold whitespace-nowrap flex items-center justify-center transition ${
                appMode === "layout" ? "bg-white text-slate-950 font-black shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Layout
            </button>
            <button
              type="button"
              onClick={() => setAppMode("electrical")}
              className={`h-full px-3 rounded-md font-bold whitespace-nowrap flex items-center justify-center transition ${
                appMode === "electrical" ? "bg-white text-slate-950 font-black shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Elétrica
            </button>
          </div>

          {/* Alternância 2D / 3D */}
          <div className="flex h-8 items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0 whitespace-nowrap">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`h-full px-2.5 rounded-md font-bold whitespace-nowrap flex items-center justify-center transition ${
                viewMode === "map" ? "bg-white text-slate-950 font-black shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setViewMode("3d")}
              className={`h-full px-2.5 rounded-md font-bold whitespace-nowrap flex items-center justify-center transition ${
                viewMode === "3d" ? "bg-white text-slate-950 font-black shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              3D
            </button>
          </div>

          <span className="h-5 w-px bg-slate-200 shrink-0" />

          {/* Botão Modo Foco */}
          <button
            type="button"
            onClick={() => toggleFocusMode(true)}
            className="flex h-8 items-center gap-1.5 px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 hover:text-slate-900 transition shadow-2xs whitespace-nowrap shrink-0"
            title="Ativar Modo Foco (F) — Oculta barras para maximizar a área de desenho"
          >
            <Maximize2 className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
            <span className="hidden xl:inline">Modo Foco</span>
          </button>
        </div>

        {/* GRUPO DIREITO: AÇÕES (Dados do Projeto, Relatórios, Salvar, Menu •••) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Botão Dados do Projeto */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setProjectParamsInitialStep(isProjectDataComplete ? "consumo" : (reportValidation.firstMissingStep || "consumo"));
              setProjectParamsOpen(true);
            }}
            className={`h-8 px-3 rounded-lg border text-xs font-bold shadow-xs transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              isProjectDataComplete
                ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                : "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
            }`}
            title={isProjectDataComplete ? "Parâmetros e Dados do Projeto" : "Preencher dados pendentes para relatórios"}
          >
            <Sliders className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
            <span className="hidden sm:inline">Dados do Projeto</span>
            {!isProjectDataComplete ? (
              <span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            )}
          </Button>

          {/* Dropdown de Relatórios */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition whitespace-nowrap shrink-0"
              >
                <Download className="mr-1.5 h-3.5 w-3.5 text-[#009b84] shrink-0" />
                <span>Relatórios</span>
                <ChevronDown className="ml-1 h-3 w-3 text-slate-400 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-white border-slate-200 text-slate-900 p-1.5 shadow-lg rounded-xl">
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

          {/* Menu de Ações Adicionais (•••) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition shadow-xs"
                title="Ações do mapa e telhado"
              >
                <MoreHorizontal className="h-4 w-4 shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 text-slate-900 p-1 shadow-lg rounded-xl text-xs">
              <DropdownMenuItem onClick={() => setFitRoofRequest((n) => n + 1)} className="cursor-pointer hover:bg-slate-100 rounded-md">
                <Maximize2 className="h-3.5 w-3.5 mr-2 text-[#009b84]" /> Centralizar no Mapa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearRoof} className="cursor-pointer hover:bg-rose-50 text-rose-600 rounded-md">
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Limpar Telhado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botão Salvar (Ação Principal) */}
          <Button
            type="button"
            size="sm"
            onClick={saveConfig}
            disabled={saving}
            className="h-8 rounded-lg bg-[#00d8b8] px-3.5 text-xs font-black text-slate-950 hover:bg-[#00c4a7] shadow-xs whitespace-nowrap shrink-0"
          >
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin shrink-0" /> : <Save className="mr-1.5 h-3.5 w-3.5 shrink-0" />}
            Salvar
          </Button>
        </div>
      </header>

      {/* 2. ÁREA CENTRAL: INSPECTOR LATERAL (18-22%) + MAPA / EDITOR (78-82%) */}
      <div className="flex min-h-0 flex-1 overflow-hidden relative">
        {/* Painel Lateral Contextual (Inspector Light) */}
        {sidebarOpen ? (
          <aside className="w-[304px] xl:w-[328px] shrink-0 flex flex-col border-r border-[#E2E8F0] bg-white overflow-hidden z-20 shadow-sm animate-in slide-in-from-left duration-150">
            {/* Header do Inspector Contextual */}
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[#E2E8F0] px-3.5 bg-slate-50/90">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 min-w-0 whitespace-nowrap">
                {multiAreaLayouts.length === 0 ? (
                  <>
                    <Box className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                    <span>Áreas Solares</span>
                    <span className="text-[11px] text-slate-400 font-medium">(0 áreas)</span>
                  </>
                ) : selectedEntity?.type === "roof" && selectedArea ? (
                  <>
                    <Box className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                    <span className="truncate max-w-[190px]">{selectedArea.name || "Área Solar"}</span>
                  </>
                ) : selectedEntity?.type === "module" ? (
                  <>
                    <Grid className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                    <span>Módulo #{selectedModuleIdx !== null ? selectedModuleIdx + 1 : 1}</span>
                  </>
                ) : selectedEntity?.type === "obstacle" ? (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>Obstáculo</span>
                  </>
                ) : (
                  <>
                    <Sliders className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                    <span>Inspetor Solar</span>
                    <span className="text-[11px] text-slate-400 font-medium">({multiAreaLayouts.length} {multiAreaLayouts.length === 1 ? "área" : "áreas"})</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition"
                title="Recolher inspetor lateral"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Conteúdo Rolável do Inspector */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {/* ESTADO 1: NENHUMA ÁREA CADASTRADA (COMPACTO) */}
              {multiAreaLayouts.length === 0 ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2.5 text-center shadow-xs">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-[#009b84] border border-emerald-100">
                      <Pencil className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Nenhum telhado demarcado</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        Desenhe uma área sobre o telhado no mapa para iniciar o dimensionamento e posicionar os módulos.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setEditorMode("draw-polygon")}
                      className="w-full h-8 rounded-md bg-[#00d8b8] hover:bg-[#00c4a7] text-slate-950 font-black text-xs shadow-xs"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1 stroke-[3]" /> Criar área solar
                    </Button>
                  </div>

                  {/* Ajuda Contextual Expansível */}
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <button
                      type="button"
                      onClick={() => setTutorialHelpOpen(!tutorialHelpOpen)}
                      className="w-full flex items-center justify-between p-2.5 text-left text-slate-700 hover:bg-slate-50 transition"
                    >
                      <span className="text-[11px] font-bold flex items-center gap-1.5 text-slate-800">
                        <Info className="h-3.5 w-3.5 text-[#009b84]" /> Como demarcar o telhado?
                      </span>
                      {tutorialHelpOpen ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                    </button>

                    {tutorialHelpOpen && (
                      <div className="px-2.5 pb-2.5 pt-1 space-y-2 text-[11px] text-slate-600 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-100 text-[#009b84] font-bold text-[10px]">1</span>
                          <span>Aproxime o zoom no telhado do imóvel.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-100 text-[#009b84] font-bold text-[10px]">2</span>
                          <span>Clique nos cantos para inserir os vértices.</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-emerald-100 text-[#009b84] font-bold text-[10px]">3</span>
                          <span>Feche clicando no 1º ponto verde ou Enter.</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Informativo do Modo Foco */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <Maximize2 className="h-3.5 w-3.5 text-[#009b84]" /> Modo Foco Panorâmico
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleFocusMode(true)}
                        className="text-[10px] font-black text-[#009b84] hover:text-[#00c4a7] transition"
                      >
                        Ativar Foco (F)
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Recolha barras e painéis durante a demarcação para obter área máxima livre sobre o telhado.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* ESTADO 2: LISTA DE ÁREAS CADASTRADAS (COMPACTA) */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="flex items-center justify-between gap-1.5 px-2.5 py-2 bg-slate-50/90 border-b border-slate-200">
                      <span className="text-[11px] font-black uppercase tracking-wide text-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0">
                        <Layers className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                        <span>Áreas ({multiAreaLayouts.length})</span>
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {multiAreaLayouts.length > 1 && (
                          <button
                            type="button"
                            onClick={handleHarmonizeAllAreas}
                            className="flex h-6 items-center gap-1 px-2 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 hover:border-[#00d8b8] hover:text-[#009b84] hover:bg-[#E6FAF7]/70 rounded-md whitespace-nowrap shrink-0 transition"
                            title="Harmonizar design e alinhamento de todas as águas com a Área 1"
                          >
                            <Sparkles className="h-2.5 w-2.5 text-[#009b84] shrink-0" />
                            <span>Harmonizar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleStartDrawNewArea}
                          className="flex h-6 items-center gap-1 px-2 text-[10px] font-bold text-[#009b84] bg-[#E6FAF7] border border-[#00d8b8]/40 hover:bg-[#d5f7f2] rounded-md whitespace-nowrap shrink-0 transition"
                          title="Demarcar nova área (A)"
                        >
                          <Plus className="h-3 w-3 stroke-[2.5] shrink-0" />
                          <span>Nova Área</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-1 max-h-44 overflow-y-auto">
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
                            className={`group rounded-md border p-1.5 cursor-pointer transition ${
                              isSelected
                                ? "border-[#00d8b8] bg-[#E6FAF7]/60 shadow-xs"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 flex-1 min-w-0 mr-1">
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded text-[9px] font-black ${
                                  isSelected ? "bg-[#00d8b8] text-slate-950" : "bg-slate-100 text-slate-600"
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

                              <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
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

                            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 pl-5 whitespace-nowrap overflow-hidden">
                              <span className="font-bold text-[#009b84]">{area.panelCount || 0} un</span>
                              <span className="text-slate-300">·</span>
                              <span>{area.dcPowerKw ? area.dcPowerKw.toFixed(1) : "0.0"} kWp</span>
                              <span className="text-slate-300">·</span>
                              <span>{Math.round(area.roof_area_m2 || 0)} m²</span>
                              <span className="text-slate-300">·</span>
                              <span>{round1(area.roof_pitch_deg || 0)}°</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ESTADO 3: ÁREA SELECIONADA COM 4 SEÇÕES RECOLHÍVEIS */}
                  {selectedArea && selectedEntity?.type !== "module" && selectedEntity?.type !== "obstacle" && (
                    <div className="space-y-2">
                      {/* 1. SEÇÃO GEOMETRIA */}
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("geometry")}
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition border-b border-slate-100"
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                            <Box className="h-3.5 w-3.5 text-[#009b84] shrink-0" /> Geometria
                          </span>
                          {inspectorSections.geometry ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        </button>

                        {inspectorSections.geometry && (
                          <div className="p-2.5 space-y-2.5 bg-white">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <span className="text-[10px] font-medium text-slate-500 block whitespace-nowrap truncate">Área Projetada (Solo)</span>
                                <span className="text-xs font-black text-slate-900 whitespace-nowrap mt-0.5 block">{(selectedArea.roof_area_m2 || visualSizing.roofArea).toFixed(1)} m²</span>
                              </div>
                              <div className="bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <span className="text-[10px] font-medium text-slate-500 block whitespace-nowrap truncate">Área Real Inclinada</span>
                                <span className="text-xs font-black text-slate-900 whitespace-nowrap mt-0.5 block">
                                  {(
                                    (selectedArea.roof_area_m2 || visualSizing.roofArea) /
                                    Math.max(0.2, Math.cos(((selectedArea.roof_pitch_deg || 12) * Math.PI) / 180))
                                  ).toFixed(1)} m²
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Inclinação (°)</Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={selectedArea.roof_pitch_deg ?? config.roof_pitch_deg ?? 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    updateSelectedArea("roof_pitch_deg", val);
                                  }}
                                  className="mt-1 h-8 rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Azimute (°)</Label>
                                <Input
                                  type="number"
                                  step="0.5"
                                  value={selectedArea.roof_rotation_deg ?? config.roof_rotation_deg ?? 0}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    updateSelectedArea("roof_rotation_deg", val);
                                  }}
                                  className="mt-1 h-8 rounded-md border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                              <button
                                type="button"
                                onClick={() => setEditorMode("edit")}
                                className={`h-8 px-1.5 rounded-md border text-[11px] font-bold whitespace-nowrap flex items-center justify-center gap-1 transition ${
                                  editorMode === "edit"
                                    ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84]"
                                    : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <Pencil className="h-3 w-3 shrink-0" />
                                <span>Vértices</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleRedrawSelectedArea}
                                className="h-8 px-1.5 rounded-md border border-emerald-200 bg-emerald-50/70 text-[11px] font-bold text-[#009b84] hover:bg-emerald-100 whitespace-nowrap flex items-center justify-center gap-1 transition"
                              >
                                <RotateCw className="h-3 w-3 shrink-0" />
                                <span>Redesenhar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setFitRoofRequest((n) => n + 1)}
                                className="h-8 px-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-bold text-slate-700 whitespace-nowrap flex items-center justify-center gap-1 transition"
                              >
                                <Maximize2 className="h-3 w-3 shrink-0" />
                                <span>Focar</span>
                              </button>
                            </div>

                            {multiAreaLayouts.length > 1 && selectedArea.id !== multiAreaLayouts[0]?.id && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleHarmonizeAreaWithPrimary(selectedArea.id)}
                                className="w-full h-8 rounded-md text-[11px] font-bold border-emerald-200 bg-emerald-50/70 text-[#009b84] hover:bg-emerald-100 hover:text-emerald-800 transition flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap"
                                title="Alinhar design, orientação e azimute perfeitamente com a Área 1"
                              >
                                <Sparkles className="h-3 w-3 text-[#009b84] shrink-0" />
                                <span className="truncate">Harmonizar com {multiAreaLayouts[0]?.name || "Água 1"}</span>
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. SEÇÃO MÓDULOS */}
                      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("modules")}
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition border-b border-slate-100"
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 whitespace-nowrap">
                            <Grid className="h-3.5 w-3.5 text-[#009b84] shrink-0" /> Módulos ({selectedArea.panelCount || 0} un)
                          </span>
                          {inspectorSections.modules ? <ChevronUp className="h-3.5 w-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                        </button>

                        {inspectorSections.modules && (
                          <div className="p-2.5 space-y-2.5 bg-white">
                            {/* Modelo do Módulo */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <Label className="text-[10px] font-bold text-slate-600 whitespace-nowrap">Modelo Selecionado</Label>
                                <span className="text-[10px] font-bold text-[#009b84] whitespace-nowrap">{currentPreset.wp} Wp</span>
                              </div>
                              <div className="flex gap-1.5 items-center">
                                <select
                                  value={config.module_preset_id || currentPreset.id}
                                  onChange={(e) => updateConfig("module_preset_id", e.target.value)}
                                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-900 focus:border-[#00d8b8] focus:outline-none truncate"
                                >
                                  {allAvailableModules.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.label || `${m.manufacturer} · ${m.model} (${m.wp}W)`}
                                    </option>
                                  ))}
                                </select>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCustomModuleModalOpen(true)}
                                  className="h-8 px-2.5 rounded-md shrink-0 whitespace-nowrap border-slate-200 hover:border-[#00d8b8] hover:text-[#009b84] text-xs font-bold"
                                  title="Gerenciar catálogo e criar novos módulos"
                                >
                                  <Sliders className="h-3.5 w-3.5 mr-1 shrink-0" /> Modelos
                                </Button>
                              </div>
                            </div>

                            {/* Estilo Visual dos Painéis (100% Customizável) */}
                            <div className="rounded-lg bg-slate-50/90 border border-slate-200 p-2.5 space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1 whitespace-nowrap">
                                  <Sparkles className="h-3 w-3 text-[#009b84] shrink-0" /> Estilo Visual do Painel
                                </Label>
                              </div>
                              <div className="grid grid-cols-2 gap-1.5">
                                {Object.values(PANEL_VISUAL_STYLES).map((st) => {
                                  const isSelected = (config.panel_visual_style || "realistic") === st.id;
                                  const shortStyleLabels = {
                                    realistic: "Ultra Realista",
                                    "full-black": "Full Black",
                                    "classic-blue": "Azul Clássico",
                                    technical: "Técnico CAD",
                                  };
                                  return (
                                    <button
                                      key={st.id}
                                      type="button"
                                      onClick={() => updateConfig("panel_visual_style", st.id)}
                                      title={`${st.name} — ${st.description}`}
                                      className={`h-8 px-2 rounded-md text-left transition border text-[11px] whitespace-nowrap ${
                                        isSelected
                                          ? "border-[#00d8b8] bg-white text-slate-900 font-black shadow-xs ring-1 ring-[#00d8b8]/30"
                                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                          className="h-2.5 w-2.5 rounded-full border border-slate-300 shrink-0"
                                          style={{ backgroundColor: st.siliconColor }}
                                        />
                                        <span className="truncate font-bold">{shortStyleLabels[st.id] || st.name}</span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Slider de Nitidez das Células */}
                              <div>
                                <div className="flex items-center justify-between text-[10px] text-slate-600 mb-0.5">
                                  <span>Nitidez das Células</span>
                                  <span className="font-bold text-[#009b84]">
                                    {Math.round(((config.cell_lines_opacity !== undefined ? Number(config.cell_lines_opacity) : 0.35) * 100))}%
                                  </span>
                                </div>
                                <input
                                  type="range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={config.cell_lines_opacity !== undefined ? Number(config.cell_lines_opacity) : 0.35}
                                  onChange={(e) => updateConfig("cell_lines_opacity", parseFloat(e.target.value))}
                                  className="w-full accent-[#00d8b8] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Orientação */}
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600 mb-1 block whitespace-nowrap">Orientação dos Painéis</Label>
                              <div className="grid grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateSelectedArea("module_orientation", "horizontal");
                                  }}
                                  className={`h-8 rounded-md border text-xs font-bold whitespace-nowrap flex items-center justify-center transition ${
                                    ((selectedArea?.module_orientation || selectedArea?.effectiveOrientation || config.module_orientation) === "horizontal" ||
                                     (selectedArea?.module_orientation || selectedArea?.effectiveOrientation || config.module_orientation) === "landscape")
                                      ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  Paisagem
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    updateSelectedArea("module_orientation", "vertical");
                                  }}
                                  className={`h-8 rounded-md border text-xs font-bold whitespace-nowrap flex items-center justify-center transition ${
                                    ((selectedArea?.module_orientation || selectedArea?.effectiveOrientation || config.module_orientation) === "vertical" ||
                                     (selectedArea?.module_orientation || selectedArea?.effectiveOrientation || config.module_orientation) === "portrait")
                                      ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  Retrato
                                </button>
                              </div>
                            </div>

                            {/* Estrutura de Fixação */}
                            <div>
                              <Label className="text-[10px] font-bold text-slate-600 mb-1 block whitespace-nowrap">Estrutura de Fixação</Label>
                              <div className="grid grid-cols-3 gap-1.5">
                                {[
                                  { id: "coplanar", label: "Coplanar" },
                                  { id: "triangle", label: "Triângulo" },
                                  { id: "shed", label: "Shed" },
                                ].map((st) => (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => {
                                      updateSelectedArea("structure_type", st.id);
                                    }}
                                    className={`h-8 rounded-md border text-center text-[11px] font-bold whitespace-nowrap flex items-center justify-center transition ${
                                      (selectedArea?.structure_type || config.structure_type || "triangle") === st.id
                                        ? "border-[#00d8b8] bg-[#E6FAF7] text-[#009b84] font-black"
                                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                    }`}
                                  >
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Espaçamentos */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] font-bold text-slate-600">Espaç. Colunas (cm)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="50"
                                  step="1"
                                  value={selectedArea?.column_gap_cm !== undefined && selectedArea?.column_gap_cm !== null ? selectedArea.column_gap_cm : (config.column_gap_cm ?? 0)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? 0 : parseInt(raw, 10);
                                    const safeVal = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
                                    updateSelectedArea("column_gap_cm", safeVal);
                                  }}
                                  className="mt-0.5 h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                                />
                              </div>
                              <div>
                                <Label className="text-[10px] font-bold text-slate-600">Espaç. Linhas (cm)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="50"
                                  step="1"
                                  value={selectedArea?.row_gap_cm !== undefined && selectedArea?.row_gap_cm !== null ? selectedArea.row_gap_cm : (config.row_gap_cm ?? 0)}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? 0 : parseInt(raw, 10);
                                    const safeVal = Number.isFinite(val) ? Math.max(0, Math.min(100, val)) : 0;
                                    updateSelectedArea("row_gap_cm", safeVal);
                                  }}
                                  className="mt-0.5 h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                                />
                              </div>
                            </div>

                            {/* Preenchimento Automático */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                              <span className="text-[11px] font-bold text-slate-700">Preenchimento Automático</span>
                              <Switch
                                checked={selectedArea?.auto_fill_surface ?? config.auto_fill_surface ?? true}
                                onCheckedChange={(checked) => {
                                  updateSelectedArea("auto_fill_surface", checked);
                                  if (!checked && !selectedArea?.requested_panel_count) {
                                    updateSelectedArea("requested_panel_count", selectedArea?.panelCount || 1);
                                  }
                                }}
                                className="data-[state=checked]:bg-[#00d8b8]"
                              />
                            </div>

                            {!(selectedArea?.auto_fill_surface ?? config.auto_fill_surface ?? true) && (
                              <div className="pt-1 space-y-1">
                                <div className="flex items-center justify-between">
                                  <Label className="text-[10px] font-bold text-slate-600">Qtd. Módulos no Conjunto</Label>
                                  <span className="text-[10px] font-bold text-emerald-600">
                                    Capacidade: {selectedArea?.metrics?.physicalCapacity || selectedArea?.panelCount || 500} un
                                  </span>
                                </div>
                                <Input
                                  type="number"
                                  min="1"
                                  max={selectedArea?.metrics?.physicalCapacity || 500}
                                  step="1"
                                  value={selectedArea?.requested_panel_count ?? selectedArea?.panelCount ?? 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 1) {
                                      updateSelectedArea("requested_panel_count", val);
                                    }
                                  }}
                                  className="h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-900 focus:border-[#00d8b8]"
                                />
                              </div>
                            )}

                            <Button
                              type="button"
                              onClick={handleTriggerAutoFv}
                              className="w-full h-8 rounded-md bg-[#00d8b8] text-slate-950 font-black text-xs hover:bg-[#00c4a7] shadow-xs whitespace-nowrap"
                            >
                              <Sparkles className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Auto Preencher (Auto FV)
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 3. SEÇÃO OBSTÁCULOS */}
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("obstacles")}
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition border-b border-slate-100"
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Obstáculos ({(config?.obstacles || []).length})
                          </span>
                          {inspectorSections.obstacles ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                        </button>

                        {inspectorSections.obstacles && (
                          <div className="p-2.5 space-y-2 bg-white">
                            {(config?.obstacles || []).length === 0 ? (
                              <p className="text-[11px] text-slate-500 text-center py-1">Nenhum obstáculo demarcado.</p>
                            ) : (
                              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                {(config?.obstacles || []).map((obs) => {
                                  const isSelected = selectedEntity?.type === "obstacle" && selectedEntity.id === obs.id;
                                  return (
                                    <div
                                      key={obs.id}
                                      onClick={() => {
                                        setSelectedEntity({ type: "obstacle", id: obs.id });
                                        setSidebarOpen(true);
                                      }}
                                      className={`group flex items-center justify-between p-2 rounded-lg border transition cursor-pointer ${
                                        isSelected
                                          ? "border-rose-400 bg-rose-50/90 shadow-xs ring-1 ring-rose-400/30"
                                          : "border-slate-200 bg-slate-50 hover:bg-slate-100/90 hover:border-slate-300"
                                      } text-[11px]`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={`h-2 w-2 rounded-full shrink-0 ${isSelected ? "bg-rose-500 animate-pulse" : "bg-rose-400"}`} />
                                        <div className="truncate">
                                          <span className="font-bold text-slate-800 block truncate">{obs.name || "Obstáculo"}</span>
                                          <span className="text-[10px] text-slate-500 font-mono">Raio: {(obs.radiusM || 1.0).toFixed(1)}m</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedEntity({ type: "obstacle", id: obs.id });
                                            setSidebarOpen(true);
                                          }}
                                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition ${
                                            isSelected
                                              ? "bg-rose-600 text-white shadow-xs"
                                              : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                          }`}
                                          title="Editar detalhes do obstáculo"
                                        >
                                          <Pencil className="h-2.5 w-2.5" />
                                          <span>Editar</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveObstacle(obs.id);
                                          }}
                                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition"
                                          title="Excluir obstáculo"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="w-full h-7 text-xs font-bold border-slate-200 hover:bg-slate-50">
                                  <Plus className="h-3 w-3 mr-1" /> Adicionar Obstáculo
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="center" className="w-48 bg-white border-slate-200 text-slate-900 p-1 text-xs shadow-lg rounded-lg">
                                {OBSTACLE_PRESETS.map((obs) => {
                                  const Icon = obs.icon;
                                  return (
                                    <DropdownMenuItem
                                      key={obs.type}
                                      onClick={() => setPendingObstaclePreset(obs)}
                                      className="cursor-pointer hover:bg-slate-100 rounded py-1 px-2 flex items-center gap-2"
                                    >
                                      <Icon className="h-3.5 w-3.5 text-[#009b84]" />
                                      <span>{obs.name}</span>
                                    </DropdownMenuItem>
                                  );
                                })}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        )}
                      </div>

                      {/* 4. SEÇÃO ANÁLISE TÉCNICA */}
                      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
                        <button
                          type="button"
                          onClick={() => toggleInspectorSection("analysis")}
                          className="w-full flex items-center justify-between p-2.5 text-left hover:bg-slate-50 transition border-b border-slate-100"
                        >
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <Zap className="h-3.5 w-3.5 text-[#009b84]" /> Análise da Área
                          </span>
                          {inspectorSections.analysis ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                        </button>

                        {inspectorSections.analysis && (
                          <div className="p-2.5 space-y-1.5 bg-white text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Orientação Solar</span>
                              <span className="font-bold text-[#009b84]">{visualSizing.technicalAnalysis?.azimuth?.formatted || `${selectedArea.roof_rotation_deg || 0}°`}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">HSP Médio Estimado</span>
                              <span className="font-bold text-slate-900">{visualSizing.technicalAnalysis?.effectiveHsp || 4.8} h/dia</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Perdas Orientação/Sombras</span>
                              <span className="font-bold text-amber-600">~{visualSizing.technicalAnalysis?.estimatedLossPct || 8}%</span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                              <span className="text-slate-500">Geração Anual Estimada</span>
                              <span className="font-bold text-emerald-600">
                                ~{(((selectedArea.dcPowerKw || 0) * (visualSizing.technicalAnalysis?.effectiveHsp || 4.8) * 365 * 0.8) / 1000).toFixed(1)} MWh/ano
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CASO: MÓDULO INDIVIDUAL SELECIONADO */}
                  {selectedEntity?.type === "module" && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-xs animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <span className="font-bold text-slate-900">Módulo #{selectedModuleIdx !== null ? selectedModuleIdx + 1 : 1}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedEntity({ type: "none", id: null })}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Modelo</span>
                          <span className="font-bold text-slate-900 truncate max-w-[140px]">{currentPreset.model}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Potência</span>
                          <span className="font-bold text-emerald-600">{currentPreset.wp} Wp</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Dimensões</span>
                          <span className="font-bold text-slate-800">{currentPreset.widthM}m × {currentPreset.heightM}m</span>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAppMode("electrical")}
                        className="w-full h-7 text-xs font-bold border-slate-200"
                      >
                        <Zap className="h-3 w-3 mr-1 text-[#009b84]" /> Ver na Rede Elétrica
                      </Button>
                    </div>
                  )}

                  {/* CASO: OBSTÁCULO INDIVIDUAL SELECIONADO (100% Customizável e Móvel) */}
                  {selectedEntity?.type === "obstacle" && selectedObstacle && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-3 shadow-xs animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedEntity({ type: "none", id: null })}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition"
                            title="Voltar à lista de obstáculos"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                          <span className="text-xs font-black text-slate-900">Editar Obstáculo</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedEntity({ type: "none", id: null })}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition"
                          title="Fechar edição"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Nome do Obstáculo */}
                      <div>
                        <Label className="text-[10px] font-bold text-slate-600">Identificação / Nome</Label>
                        <Input
                          type="text"
                          value={selectedObstacle.name || ""}
                          onChange={(e) => handleUpdateObstacle(selectedObstacle.id, { name: e.target.value })}
                          className="mt-0.5 h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-900"
                          placeholder="Ex: Caixa d'água 1"
                        />
                      </div>

                      {/* Atalhos Rápidos de Tipos de Obstáculos */}
                      <div>
                        <Label className="text-[10px] font-bold text-slate-600 mb-1 block">Tipo de Obstáculo</Label>
                        <div className="grid grid-cols-2 gap-1">
                          {OBSTACLE_PRESETS.map((p) => {
                            const isMatch = selectedObstacle.type === p.type || selectedObstacle.name === p.name;
                            return (
                              <button
                                key={p.type}
                                type="button"
                                onClick={() =>
                                  handleUpdateObstacle(selectedObstacle.id, {
                                    type: p.type,
                                    name: p.name,
                                    radiusM: selectedObstacle.radiusM || p.radius,
                                  })
                                }
                                className={`px-2 py-1 rounded text-[11px] font-bold text-left transition flex items-center gap-1 ${
                                  isMatch
                                    ? "bg-rose-50 border border-rose-300 text-rose-700 font-black"
                                    : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                <span className="truncate">{p.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Raio de Afastamento (m) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <Label className="text-[10px] font-bold text-slate-600">Raio de Afastamento</Label>
                          <span className="text-[11px] font-black text-rose-600">
                            {(selectedObstacle.radiusM || 1.0).toFixed(1)} m
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.2"
                          max="5.0"
                          step="0.1"
                          value={selectedObstacle.radiusM || 1.0}
                          onChange={(e) =>
                            handleUpdateObstacle(selectedObstacle.id, { radiusM: parseFloat(e.target.value) || 1.0 })
                          }
                          className="w-full accent-rose-500 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                        />
                      </div>

                      {/* Movimentação de Precisão (Nudge Controls) */}
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                            <Move className="h-3 w-3 text-slate-500" /> Mover com Precisão
                          </span>
                          <div className="flex items-center gap-1">
                            {[0.2, 0.5, 1.0].map((step) => (
                              <button
                                key={step}
                                type="button"
                                onClick={() => setObstacleNudgeStep(step)}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition ${
                                  obstacleNudgeStep === step
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {step}m
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Botões Direcionais */}
                        <div className="flex flex-col items-center gap-1 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleNudgeObstacle(selectedObstacle.id, "up", obstacleNudgeStep)}
                            className="h-6 w-16 text-[10px] font-bold bg-white hover:bg-slate-100 p-0"
                            title="Mover para o Norte"
                          >
                            ▲ Norte
                          </Button>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgeObstacle(selectedObstacle.id, "left", obstacleNudgeStep)}
                              className="h-6 w-16 text-[10px] font-bold bg-white hover:bg-slate-100 p-0"
                              title="Mover para o Oeste"
                            >
                              ◀ Oeste
                            </Button>
                            <span className="h-5 w-5 rounded-full bg-rose-100 border border-rose-300 flex items-center justify-center text-[9px] font-black text-rose-700">
                              ⦿
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleNudgeObstacle(selectedObstacle.id, "right", obstacleNudgeStep)}
                              className="h-6 w-16 text-[10px] font-bold bg-white hover:bg-slate-100 p-0"
                              title="Mover para o Leste"
                            >
                              Leste ▶
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleNudgeObstacle(selectedObstacle.id, "down", obstacleNudgeStep)}
                            className="h-6 w-16 text-[10px] font-bold bg-white hover:bg-slate-100 p-0"
                            title="Mover para o Sul"
                          >
                            ▼ Sul
                          </Button>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center">
                          Ou arraste diretamente a etiqueta no mapa.
                        </p>
                      </div>

                      {/* Ações: Duplicar e Remover */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateObstacle(selectedObstacle.id)}
                          className="h-7 text-xs font-bold border-slate-200 hover:bg-slate-100"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Duplicar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveObstacle(selectedObstacle.id)}
                          className="h-7 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Remover
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Ações Inferiores do Inspector */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/90 space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setProjectParamsInitialStep("equipamentos");
                  setProjectParamsOpen(true);
                }}
                className="w-full h-8 flex items-center justify-between px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition text-[11px] font-bold whitespace-nowrap"
              >
                <span className="flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-[#009b84] shrink-0" /> Parâmetros do Projeto
                </span>
                <span className="text-[10px] font-semibold text-slate-400">5 Etapas →</span>
              </button>
              <Button
                type="button"
                onClick={handleAcceptLayout}
                className="w-full h-9 rounded-lg bg-[#00d8b8] text-xs font-black text-slate-950 hover:bg-[#00c4a7] shadow-xs uppercase tracking-wider whitespace-nowrap"
              >
                Confirmar Arranjo
              </Button>
            </div>
          </aside>
        ) : (
          /* Botão Flutuante para Reabrir Inspector */
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="absolute top-14 left-3 z-30 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition"
            title="Abrir Inspetor"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}

        {/* Canvas Central (Mapa 2D / 3D) */}
        <main className="relative flex-1 bg-slate-100 overflow-hidden">
          {/* TOOLBAR FLUTUANTE CENTRAL SOBRE O MAPA (CAD LIGHT THEME) */}
          <div className="absolute top-3.5 left-1/2 -translate-x-1/2 z-[500] w-max max-w-[calc(100%-1.5rem)] overflow-x-auto flex items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-1 text-slate-800 shadow-md whitespace-nowrap">
            {/* GRUPO EDIÇÃO */}
            <button
              type="button"
              onClick={() => setEditorMode("select")}
              className={`flex h-8 shrink-0 items-center gap-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                editorMode === "select"
                  ? "bg-[#00d8b8] text-slate-950 font-black shadow-xs"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title="Selecionar e Navegar (V)"
            >
              <MousePointer className="h-3.5 w-3.5 shrink-0" />
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
              className={`flex h-8 shrink-0 items-center gap-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                editorMode === "draw-polygon"
                  ? "bg-[#00d8b8] text-slate-950 font-black shadow-xs"
                  : !hasRoof
                  ? "bg-[#E6FAF7] text-[#009b84] border border-[#00d8b8]/40 hover:bg-[#d5f7f2]"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title={!hasRoof ? "Demarcar Telhado (A)" : "Adicionar Área (A)"}
            >
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{!hasRoof ? "Demarcar Telhado" : "Adicionar Área"}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

            {/* GRUPO SOLAR */}
            <button
              type="button"
              onClick={handleTriggerAutoFv}
              className="flex h-8 shrink-0 items-center gap-1.5 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
              title="Auto Preencher Módulos (Auto FV)"
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="hidden sm:inline">Auto FV</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

            {/* GRUPO AMBIENTE */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 shrink-0 items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition"
                  title="Adicionar Obstáculo"
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span className="hidden sm:inline">Obstáculo</span>
                  <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-48 bg-white border-slate-200 text-slate-900 p-1 text-xs shadow-lg rounded-xl">
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
                      <Icon className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                      <span>{obs.name}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => setCustomModuleModalOpen(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition hover:bg-slate-100 text-slate-700 hover:text-slate-900"
              title="Gerenciar e selecionar modelos de módulos fotovoltaicos"
            >
              <Layers className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
              <span className="hidden md:inline">{currentPreset.wp} Wp</span>
              <span className="hidden xl:inline text-slate-400">·</span>
              <span className="hidden xl:inline text-slate-500 font-medium max-w-[140px] truncate">{currentPreset.model}</span>
            </button>

            <button
              type="button"
              onClick={() => setEditorMode(editorMode === "measure" ? "select" : "measure")}
              className={`flex h-8 shrink-0 items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                editorMode === "measure" ? "bg-amber-400 text-slate-950 font-black shadow-xs" : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title="Régua / Medir Distância (R)"
            >
              <Ruler className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Medir</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

            {/* GRUPO HISTÓRICO */}
            <button
              type="button"
              onClick={undoRoofChange}
              disabled={!roofHistoryState.canUndo}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 transition"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5 shrink-0" />
            </button>
            <button
              type="button"
              onClick={redoRoofChange}
              disabled={!roofHistoryState.canRedo}
              className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 disabled:opacity-30 hover:bg-slate-100 transition"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5 shrink-0" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />

            {/* GRUPO FOCO */}
            <button
              type="button"
              onClick={() => toggleFocusMode(!focusMode)}
              className={`flex h-8 shrink-0 items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                focusMode
                  ? "bg-[#00d8b8] text-slate-950 font-black shadow-xs"
                  : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
              }`}
              title={focusMode ? "Sair do Modo Foco (F ou Esc)" : "Ativar Modo Foco (F) — Maximizar mapa"}
            >
              {focusMode ? <Minimize2 className="h-3.5 w-3.5 shrink-0" /> : <Maximize2 className="h-3.5 w-3.5 shrink-0" />}
              <span className="hidden lg:inline">{focusMode ? "Sair Foco" : "Foco"}</span>
            </button>
          </div>

          {/* BADGE FLUTUANTE DE MODO FOCO ATIVO */}
          {focusMode && (
            <div className="absolute top-3.5 right-3.5 z-[500] flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-800 shadow-sm animate-in fade-in">
              <span className="flex h-2 w-2 rounded-full bg-[#00d8b8]" />
              <span className="text-[11px] font-bold text-slate-700">Modo Foco Ativo</span>
              <button
                type="button"
                onClick={() => toggleFocusMode(false)}
                className="ml-1 flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-800 hover:bg-slate-200 transition"
                title="Sair do Modo Foco (Esc ou F)"
              >
                <Minimize2 className="h-3 w-3" />
                <span>Sair (Esc)</span>
              </button>
            </div>
          )}

          {/* BANNER FLUTUANTE DE PREVIEW DO AUTO FV (CAD LIGHT) */}
          {autoFvPreview && (
            <div className="absolute top-16 inset-x-0 z-[550] flex justify-center pointer-events-none animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-emerald-300 bg-white/95 backdrop-blur-md px-3.5 py-1.5 text-xs text-slate-900 shadow-md whitespace-nowrap">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="whitespace-nowrap">
                  <strong>{autoFvPreview.count} módulos</strong> ({autoFvPreview.kwp} kWp) · Ocupação: {autoFvPreview.occupancy}%
                </span>
                <div className="flex items-center gap-1.5 ml-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyAutoFv}
                    className="h-6 rounded bg-emerald-600 text-white font-bold px-2.5 text-[11px] hover:bg-emerald-700 shadow-xs"
                  >
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setAutoFvPreview(null)}
                    className="h-6 rounded text-slate-500 hover:text-slate-900 text-[11px] hover:bg-slate-100"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* BANNER DE INSTRUÇÃO PARA POSICIONAR OBSTÁCULO (CAD LIGHT) */}
          {pendingObstaclePreset && (
            <div className="pointer-events-none absolute inset-x-0 top-16 z-[550] flex justify-center animate-in slide-in-from-top-2">
              <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-rose-300 bg-white/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-rose-800 shadow-md whitespace-nowrap">
                <ShieldAlert className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                Clique no telhado para posicionar: {pendingObstaclePreset.name}
                <button
                  type="button"
                  onClick={() => setPendingObstaclePreset(null)}
                  className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
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
              onAreaSelect={setSelectedAreaId}
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
              isPlacingObstacle={Boolean(pendingObstaclePreset)}
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
              onSelectRoof={() => {
                setSelectedEntity({ type: "roof", id: selectedArea?.id || "main" });
                setSidebarOpen(true);
              }}
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
                setInspectorSections((prev) => ({ ...prev, obstacles: true }));
              }}
              onSelectModule={(idx) => {
                setSelectedEntity({ type: "module", id: idx });
                setSidebarOpen(true);
              }}
              onRemoveObstacle={handleRemoveObstacle}
              onMapClick={handleMapClick}
            />
          )}

          {/* RESUMO TÉCNICO INFERIOR UNIFICADO (CAD LIGHT THEME) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] w-max max-w-[calc(100%-1.5rem)] flex flex-col items-center pointer-events-auto">
            {/* PAINEL EXPANDIDO DE ANÁLISE TÉCNICA */}
            {bottomSummaryExpanded && (
              <div className="mb-2.5 w-[560px] max-w-[92vw] rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-4 shadow-lg animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-[#009b84]" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                      Dimensionamento Técnico Detalhado
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBottomSummaryExpanded(false)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 rounded"
                    title="Recolher resumo"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Grid de Métricas Expandidas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                  <div className="p-2 rounded border border-slate-100 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Módulos</span>
                    <span className="text-sm font-black text-slate-900">{visualSizing.panelCount} un</span>
                    <span className="block text-[9px] text-slate-400 truncate">{currentPreset.model}</span>
                  </div>
                  <div className="p-2 rounded border border-slate-100 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Potência CC</span>
                    <span className="text-sm font-black text-emerald-600">{visualSizing.dcPowerKw.toFixed(1)} kWp</span>
                    <span className="block text-[9px] text-slate-400">FDI: {visualSizing.dcAcRatio ? `${visualSizing.dcAcRatio.toFixed(2)}x` : "1.15x"}</span>
                  </div>
                  <div className="p-2 rounded border border-slate-100 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Geração Anual</span>
                    <span className="text-sm font-black text-cyan-700">{(visualSizing.annualGenerationKwh / 1000).toFixed(1)} MWh</span>
                    <span className="block text-[9px] text-slate-400">~{Math.round(visualSizing.annualGenerationKwh / 12)} kWh/mês</span>
                  </div>
                  <div className="p-2 rounded border border-slate-100 bg-slate-50">
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Economia Anual</span>
                    <span className="text-sm font-black text-emerald-700">
                      R$ {visualSizing.annualSavingsBrl ? visualSizing.annualSavingsBrl.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "0"}
                    </span>
                    <span className="block text-[9px] text-slate-400">Payback: {visualSizing.paybackYears ? `${visualSizing.paybackYears.toFixed(1)} anos` : "—"}</span>
                  </div>
                </div>

                {/* Gráfico 12 Meses Simulação */}
                <div className="p-2 rounded border border-slate-100 bg-slate-50 mb-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Simulação de Geração Mensal (kWh)</span>
                    <span className="text-[10px] font-bold text-[#009b84]">HSP Médio: {visualSizing.technicalAnalysis?.effectiveHsp || 4.8} h/dia</span>
                  </div>
                  <div className="h-14 flex items-end justify-between gap-1 pt-1">
                    {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"].map((month, idx) => {
                      const weights = [1.08, 1.02, 1.00, 0.92, 0.82, 0.78, 0.80, 0.90, 0.95, 1.04, 1.08, 1.11];
                      const avgMonth = visualSizing.annualGenerationKwh ? visualSizing.annualGenerationKwh / 12 : 300;
                      const monthVal = Math.round(avgMonth * weights[idx]);
                      const maxVal = (avgMonth * 1.25) || 1;
                      const barHeightPct = Math.max(15, Math.min(100, Math.round((monthVal / maxVal) * 100)));
                      return (
                        <div key={month} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className="w-full bg-[#00d8b8] group-hover:bg-[#00bda1] rounded-t transition-all"
                            style={{ height: `${barHeightPct}%` }}
                          />
                          <span className="text-[8px] font-bold text-slate-400">{month[0]}</span>
                          <div className="absolute -top-6 hidden group-hover:flex px-1 py-0.5 rounded bg-slate-900 text-white text-[8px] font-bold whitespace-nowrap z-10 shadow">
                            {month}: {monthVal} kWh
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rodapé do Painel Expandido com Ação */}
                <div className="flex items-center justify-between pt-1">
                  <div className="text-[10px] text-slate-500">
                    Corrente AC: <strong className="text-slate-800">{visualSizing.acCurrent ? `${visualSizing.acCurrent.toFixed(1)}A` : "—"}</strong> · Disjuntor: <strong className="text-slate-800">{visualSizing.breaker ? `${visualSizing.breaker}A` : "—"}</strong>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setProjectParamsInitialStep("consumo");
                      setProjectParamsOpen(true);
                    }}
                    className="h-6 rounded bg-slate-900 text-white text-[10px] font-bold hover:bg-slate-800 px-2"
                  >
                    <Sliders className="h-3 w-3 mr-1 text-[#00d8b8]" /> Parâmetros Completos
                  </Button>
                </div>
              </div>
            )}

            {/* FAIXA COMPACTA (BARRA RESUMO FIXA) */}
            <div className="flex h-9 items-center gap-3 rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md px-3.5 text-slate-800 shadow-md whitespace-nowrap overflow-x-auto max-w-full">
              <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Sun className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500">Módulos:</span>
                <span className="text-xs font-black text-slate-900">{visualSizing.panelCount} un</span>
              </div>

              <div className="h-4 w-px bg-slate-200 shrink-0" />

              <div className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Zap className="h-3.5 w-3.5 text-[#009b84] shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500">Potência:</span>
                <span className="text-xs font-black text-emerald-600">{visualSizing.dcPowerKw.toFixed(1)} kWp</span>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block shrink-0" />

              <div className="hidden sm:flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <Activity className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500">Geração:</span>
                <span className="text-xs font-black text-slate-900">{(visualSizing.annualGenerationKwh / 1000).toFixed(1)} MWh/ano</span>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden lg:block shrink-0" />

              <div className="hidden lg:flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-semibold text-slate-500">Economia:</span>
                <span className="text-xs font-black text-emerald-600">
                  R$ {visualSizing.annualSavingsBrl ? visualSizing.annualSavingsBrl.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "0"}/ano
                </span>
              </div>

              <div className="h-4 w-px bg-slate-200 shrink-0" />

              <button
                type="button"
                onClick={() => setBottomSummaryExpanded(!bottomSummaryExpanded)}
                className="flex h-6 shrink-0 items-center gap-1 rounded-lg bg-slate-100/80 px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-200/80 hover:text-slate-950 whitespace-nowrap transition"
                title={bottomSummaryExpanded ? "Recolher detalhes" : "Expandir análise técnica"}
              >
                <span className="hidden sm:inline">{bottomSummaryExpanded ? "Recolher" : "Detalhes"}</span>
                {bottomSummaryExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronUp className="h-3 w-3 shrink-0" />}
              </button>
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

      {/* Modal de Gerenciamento e Cadastro de Módulos 100% Personalizados */}
      <CustomModuleModal
        open={customModuleModalOpen}
        onOpenChange={setCustomModuleModalOpen}
        currentPresetId={config.module_preset_id || currentPreset.id}
        onSelectModulePreset={(presetId) => {
          updateConfig("module_preset_id", presetId);
          toast({
            title: "Módulo atualizado",
            description: "Geometria e cálculos recalculados com o novo modelo.",
          });
        }}
        onCustomModulesChanged={() => {
          setCustomModulesRevision((r) => r + 1);
        }}
      />
    </div>
  );
}
