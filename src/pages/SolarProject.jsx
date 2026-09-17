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
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  SOLAR_MODULE_HEIGHT_M,
  SOLAR_MODULE_WIDTH_M,
  buildRoofPolygon,
  getBestPanelLayout,
  getPolygonAreaSquareMeters,
  getRoofCenterFromConfig,
  getRoofMetricsFromPolygon,
  normalizeRoofPolygon,
  serializeRoofPolygon,
} from "@/lib/solarDesignerGeometry";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Grid2X2,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Layers,
  Loader2,
  Lock,
  MoreVertical,
  MousePointer2,
  Move3D,
  Pencil,
  Redo2,
  RotateCw,
  Save,
  Square,
  Trash2,
  Undo2,
  Unlock,
  UserCircle,
  Zap,
} from "lucide-react";

const defaultSolarConfig = {
  inverter_kw: 5,
  module_wp: 550,
  requested_panel_count: 14,
  roof_area_m2: 45,
  roof_utilization_pct: 75,
  module_width_m: SOLAR_MODULE_WIDTH_M,
  module_height_m: SOLAR_MODULE_HEIGHT_M,
  roof_width_m: 9,
  roof_height_m: 5,
  roof_overlay_x_pct: 52,
  roof_overlay_y_pct: 50,
  roof_overlay_w_pct: 38,
  roof_overlay_h_pct: 28,
  roof_rotation_deg: 0,
  map_center_lat: DEFAULT_SOLAR_MAP_CENTER.lat,
  map_center_lng: DEFAULT_SOLAR_MAP_CENTER.lng,
  map_zoom: DEFAULT_SOLAR_MAP_ZOOM,
  roof_polygon: [],
  roof_defined: false,
  module_orientation: "auto",
  ac_voltage: 220,
  ac_supply_type: "Trifásico",
  layout_note: "",
};

const PHASE_COLORS = ["black", "red", "brown"];
const PHASE_LABELS = ["L1", "L2", "L3"];
const PHASE_KEYS = ["A", "B", "C"];

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
    roof_overlay_x_pct: asNumber(merged.roof_overlay_x_pct, defaultSolarConfig.roof_overlay_x_pct),
    roof_overlay_y_pct: asNumber(merged.roof_overlay_y_pct, defaultSolarConfig.roof_overlay_y_pct),
    roof_overlay_w_pct: asNumber(merged.roof_overlay_w_pct, defaultSolarConfig.roof_overlay_w_pct),
    roof_overlay_h_pct: asNumber(merged.roof_overlay_h_pct, defaultSolarConfig.roof_overlay_h_pct),
    roof_rotation_deg: asNumber(merged.roof_rotation_deg, defaultSolarConfig.roof_rotation_deg),
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
  const moduleWidth = SOLAR_MODULE_WIDTH_M;
  const moduleHeight = SOLAR_MODULE_HEIGHT_M;
  const roofWidth = Math.max(0.1, asNumber(config.roof_width_m, defaultSolarConfig.roof_width_m));
  const roofHeight = Math.max(0.1, asNumber(config.roof_height_m, defaultSolarConfig.roof_height_m));
  const usablePct = clamp(asNumber(config.roof_utilization_pct, defaultSolarConfig.roof_utilization_pct), 10, 95);
  const roofArea = Math.max(0, asNumber(config.roof_area_m2, roofWidth * roofHeight));
  const moduleArea = Math.max(0.1, moduleWidth * moduleHeight);
  const usableArea = roofArea * usablePct / 100;
  const areaLimit = Math.max(0, Math.floor(usableArea / moduleArea));
  const inverterLimit = Math.max(1, Math.ceil((inverterKw * 1000 * 1.25) / moduleWp));
  const layoutOptions = [
    {
      orientation: "vertical",
      orientationLabel: "módulos em pé",
      columns: Math.max(1, Math.floor(roofWidth / moduleWidth)),
      rows: Math.max(1, Math.floor(roofHeight / moduleHeight)),
    },
    {
      orientation: "horizontal",
      orientationLabel: "módulos deitados",
      columns: Math.max(1, Math.floor(roofWidth / moduleHeight)),
      rows: Math.max(1, Math.floor(roofHeight / moduleWidth)),
    },
  ].map((item) => ({ ...item, capacity: item.columns * item.rows }));
  const bestLayout = layoutOptions.sort((a, b) => b.capacity - a.capacity)[0];
  const gridLimit = Math.max(0, Math.floor(bestLayout.capacity * usablePct / 100));
  const estimatedPhysicalLimit = Math.max(0, Math.min(areaLimit, gridLimit));
  const hasExactCapacity = Number.isFinite(Number(panelCapacity));
  const physicalLimit = hasExactCapacity
    ? Math.max(0, Math.round(Number(panelCapacity)))
    : estimatedPhysicalLimit;
  const panelCount = Math.min(requestedPanelCount, physicalLimit);
  const dcPowerKw = panelCount * moduleWp / 1000;
  const voltage = Math.max(1, asNumber(config.ac_voltage, defaultSolarConfig.ac_voltage));
  const acCurrent = config.ac_supply_type === "Trifásico"
    ? (inverterKw * 1000) / (Math.sqrt(3) * voltage)
    : (inverterKw * 1000) / voltage;
  const breaker = breakerForCurrent(acCurrent);
  const columns = panelCount > 0 ? Math.max(1, Math.min(bestLayout.columns, panelCount)) : 0;
  const rows = panelCount > 0 ? Math.max(1, Math.ceil(panelCount / columns)) : 0;

  return {
    moduleArea,
    usableArea,
    areaLimit,
    inverterLimit,
    gridLimit,
    physicalLimit,
    requestedPanelCount,
    fitsArea: requestedPanelCount <= physicalLimit,
    missingPanelCount: Math.max(0, requestedPanelCount - physicalLimit),
    panelCount,
    dcPowerKw,
    dcAcRatio: dcPowerKw / inverterKw,
    acCurrent,
    breaker,
    columns,
    rows,
    orientation: bestLayout.orientation,
    orientationLabel: bestLayout.orientationLabel,
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

function buildSolarAcPanelLayout(config, sizing) {
  const ROW_MAX = 18;
  const supply = config.ac_supply_type || "Bifásico";
  const phaseCount = phaseCountForSupply(supply);
  const breakerPoles = polesForSupply(supply);
  const feederGauge = sizing.breaker > 63 ? "16mm²" : sizing.breaker > 40 ? "10mm²" : sizing.breaker > 25 ? "6mm²" : "4mm²";
  const feederBreaker = {
    id: "solar_feeder_breaker",
    type: "breaker",
    label: "DJ ENTRADA CA",
    current: sizing.breaker,
    curve: "C",
    poles: breakerPoles,
    isSolarFeeder: true,
    phase: phaseForSupply(supply),
    supply_type: supply,
    status: "ON",
  };
  const serviceBreaker = {
    id: "solar_service_breaker",
    type: "breaker",
    label: "DJ SAÍDA CA",
    current: sizing.breaker,
    curve: "C",
    poles: breakerPoles,
    isSolarServiceDisconnect: true,
    phase: phaseForSupply(supply),
    supply_type: supply,
    status: "ON",
  };
  const dpsComponents = Array.from({ length: phaseCount }).map((_, index) => ({
    id: `solar_dps_${index}`,
    type: "dps",
    label: `DPS CA ${PHASE_LABELS[index]}`,
    poles: 1,
    phase: PHASE_KEYS[index],
    status: "ON",
    dpsStatus: "OK",
  }));
  const breakerComponent = {
    id: "solar_main_breaker",
    type: "breaker",
    label: "DJ INVERSOR CA",
    current: sizing.breaker,
    curve: "C",
    poles: breakerPoles,
    isGeneral: false,
    phase: phaseForSupply(supply),
    supply_type: supply,
    status: "ON",
  };
  const protectionUsedPoles = [feederBreaker, ...dpsComponents, serviceBreaker]
    .reduce((sum, component) => sum + Number(component.poles || 0), 0);
  const breakerUsedPoles = Number(breakerComponent.poles || 0);
  const protectionComponents = protectionUsedPoles < ROW_MAX
    ? [feederBreaker, ...dpsComponents, serviceBreaker, {
        id: "solar_spacer_protection",
        type: "spacer",
        poles: ROW_MAX - protectionUsedPoles,
        label: "RESERVA TÉCNICA",
      }]
    : [feederBreaker, ...dpsComponents, serviceBreaker];
  const inverterComponents = breakerUsedPoles < ROW_MAX
    ? [breakerComponent, {
        id: "solar_spacer_inverter",
        type: "spacer",
        poles: ROW_MAX - breakerUsedPoles,
        label: "RESERVA",
      }]
    : [breakerComponent];

  const wires = [
    {
      id: "solar_ground_feed",
      color: "green",
      gauge: "10mm²",
      source: "terminal_left_top:0",
      target: "busbar_ground:0",
      label: "10 mm²",
    },
  ];

  dpsComponents.forEach((component, index) => {
    wires.push({
      id: `solar_dps_phase_${index}`,
      color: PHASE_COLORS[index],
      gauge: "6mm²",
      source: `terminal_left_top:${index + 1}`,
      target: `comp:${component.id}:top:0`,
      label: "",
    });
    wires.push({
      id: `solar_dps_ground_${index}`,
      color: "green",
      gauge: "6mm²",
      source: `comp:${component.id}:bottom:0`,
      target: `busbar_ground:${1 + index}`,
      label: "6 mm²",
    });
  });

  if (supply === "Monofásico") {
    wires.push({
      id: "solar_neutral_feed",
      color: "blue",
      gauge: feederGauge,
      source: "busbar_neutral:11",
      target: `comp:${feederBreaker.id}:top:1`,
      label: feederGauge.replace("mm²", " mm²"),
    });
    wires.push({
      id: "solar_neutral_feeder_to_inverter",
      color: "blue",
      gauge: feederGauge,
      source: `comp:${feederBreaker.id}:bottom:1`,
      target: `comp:${breakerComponent.id}:top:1`,
      label: feederGauge.replace("mm²", " mm²"),
    });
    wires.push({
      id: "solar_neutral_load",
      color: "blue",
      gauge: feederGauge,
      source: "comp:solar_main_breaker:bottom:1",
      target: "load_out:solar_inverter:neutral",
      label: feederGauge.replace("mm²", " mm²"),
    });
  }

  for (let index = 0; index < phaseCount; index += 1) {
    wires.push({
      id: `solar_phase_feed_${index}`,
      color: PHASE_COLORS[index],
      gauge: feederGauge,
      source: `terminal_left_top:${index + 1}`,
      target: `comp:${feederBreaker.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_feeder_to_service_${index}`,
      color: PHASE_COLORS[index],
      gauge: feederGauge,
      source: `comp:${feederBreaker.id}:bottom:${index}`,
      target: `comp:${serviceBreaker.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_service_to_inverter_${index}`,
      color: PHASE_COLORS[index],
      gauge: feederGauge,
      source: `comp:${serviceBreaker.id}:bottom:${index}`,
      target: `comp:${breakerComponent.id}:top:${index}`,
      label: "",
    });
    wires.push({
      id: `solar_phase_load_${index}`,
      color: PHASE_COLORS[index],
      gauge: feederGauge,
      source: `comp:solar_main_breaker:bottom:${index}`,
      target: `load_out:solar_inverter:${index}`,
      label: "",
    });
  }

  return {
    rails: [
      {
        id: "rail_1",
        name: "Trilho DIN Superior (Entrada e Proteção CA)",
        components: protectionComponents,
      },
      {
        id: "rail_2",
        name: "Trilho DIN Inferior (Disjuntor do Inversor)",
        components: inverterComponents,
      },
    ],
    wires,
  };
}

export default function SolarProject() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [project, setProject] = useState(null);
  const [config, setConfig] = useState(defaultSolarConfig);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState("select");
  const [roofLocked, setRoofLocked] = useState(false);
  const [fitRoofRequest, setFitRoofRequest] = useState(0);
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
      roofHistoryRef.current = [initialRoof];
      roofHistoryIndexRef.current = 0;
      setRoofHistoryState({ canUndo: false, canRedo: false });
    });
  }, [projectId]);

  const roofPolygonKey = JSON.stringify(config.roof_polygon);
  const roofLayout = useMemo(
    () => getBestPanelLayout(config, 1200),
    [config.module_orientation, roofPolygonKey]
  );
  const sizing = useMemo(
    () => calculateSolar(config, roofLayout.panelCount),
    [config, roofLayout.panelCount]
  );
  const visiblePanelPolygons = useMemo(
    () => roofLayout.panels.slice(0, sizing.panelCount),
    [roofLayout.panels, sizing.panelCount]
  );
  const visualSizing = useMemo(() => {
    const placedPanelCount = visiblePanelPolygons.length;
    const dcPowerKw = placedPanelCount * Math.max(1, asNumber(config.module_wp, defaultSolarConfig.module_wp)) / 1000;

    return {
      ...sizing,
      orientation: roofLayout.orientation,
      orientationLabel: roofLayout.orientation === "horizontal" ? "módulos deitados" : "módulos em pé",
      panelCount: placedPanelCount,
      physicalLimit: roofLayout.panelCount,
      dcPowerKw,
      dcAcRatio: dcPowerKw / Math.max(0.1, asNumber(config.inverter_kw, defaultSolarConfig.inverter_kw)),
    };
  }, [config.inverter_kw, config.module_wp, roofLayout.orientation, roofLayout.panelCount, sizing, visiblePanelPolygons.length]);
  const externalMapUrl = project?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(project.address)}`
    : "";

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
      const widthM = round1(metrics.widthM);
      const heightM = round1(metrics.heightM);

      return normalizeSolarConfig({
        ...current,
        roof_defined: true,
        roof_width_m: widthM,
        roof_height_m: heightM,
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

  const cycleModuleOrientation = useCallback(() => {
    const nextOrientation = config.module_orientation === "auto"
      ? "vertical"
      : config.module_orientation === "vertical" ? "horizontal" : "auto";
    const label = nextOrientation === "auto" ? "automática" : nextOrientation === "vertical" ? "em pé" : "deitada";
    setConfig((current) => normalizeSolarConfig({ ...current, module_orientation: nextOrientation }));
    toast({ title: "Orientação atualizada", description: `Distribuição ${label}.` });
  }, [config.module_orientation, toast]);

  const handleMapViewportChange = useCallback(({ center, zoom }) => {
    setConfig((current) => normalizeSolarConfig({
      ...current,
      map_center_lat: center.lat,
      map_center_lng: center.lng,
      map_zoom: zoom,
    }));
  }, []);


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
      setProject((current) => current ? { ...current, ...payload } : current);
      toast({ title: "Projeto salvo", description: "Área, quantitativo e layout foram atualizados." });
    } catch {
      toast({ title: "Não foi possível salvar", description: "Verifique a conexão e tente novamente.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateSolarBoard = async () => {
    if (!projectId || !project) return;
    setSaving(true);
    try {
      const normalizedConfig = normalizeSolarConfig(config);
      const normalizedLayout = getBestPanelLayout(normalizedConfig, 1200);
      const normalizedSizing = calculateSolar(normalizedConfig, normalizedLayout.panelCount);
      const solarCircuits = buildSolarCircuits(project, normalizedConfig, normalizedSizing);
      const layout = buildSolarAcPanelLayout(normalizedConfig, normalizedSizing);
      const existingBoards = Array.isArray(project.panel_boards) ? project.panel_boards : [];
      const existingSolarBoard = existingBoards.find((board) => board.type === "solar_ac");
      const panelBoards = [
        ...existingBoards.filter((board) => board.type !== "solar_ac"),
        {
          id: existingSolarBoard?.id || `solar_ac_${Date.now()}`,
          name: "QD Solar CA",
          location: "Saída CA do inversor",
          type: "solar_ac",
          supply_type: normalizedConfig.ac_supply_type,
          layout,
        },
      ];
      const payload = {
        project_type: "Solar",
        solar_config: normalizedConfig,
        voltage: normalizedConfig.ac_voltage,
        supply_type: normalizedConfig.ac_supply_type,
        circuits: solarCircuits,
        panel_boards: panelBoards,
        panel_layout: layout,
      };
      await backend.entities.Project.update(projectId, payload);
      setConfig(normalizedConfig);
      setProject({ ...project, ...payload });
    } finally {
      setSaving(false);
    }
  };

  if (!project) {
    return <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/30 border-t-primary" /></div>;
  }

  const showDesignerProjectPanel = false;
  const hasRoof = normalizeRoofPolygon(config.roof_polygon).length >= 3 && config.roof_defined !== false;
  const toggleRoofLock = () => {
    const next = !roofLocked;
    setRoofLocked(next);
    if (next) setEditorMode("select");
    toast({
      title: next ? "Edição bloqueada" : "Edição liberada",
      description: next ? "O contorno e o quantitativo estão protegidos." : "As ferramentas de edição voltaram a funcionar.",
    });
  };
  const fitRoofInView = () => {
    setEditorMode("select");
    setFitRoofRequest((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-[#edf1f7] font-inter text-[#243042]">
      <DesignerTopBar
        hasRoof={hasRoof}
        isLocked={roofLocked}
        panelCount={visualSizing.panelCount}
        saving={saving}
        sizing={visualSizing}
        onClear={clearRoof}
        onFitRoof={fitRoofInView}
        onSave={saveConfig}
        onToggleLock={toggleRoofLock}
      />

      <DesignerToolRibbon
        canRedo={roofHistoryState.canRedo}
        canUndo={roofHistoryState.canUndo}
        editorMode={editorMode}
        hasRoof={hasRoof}
        editingLocked={roofLocked}
        orientation={config.module_orientation}
        onClear={clearRoof}
        onFitRoof={fitRoofInView}
        onModeChange={setEditorMode}
        onOrientationChange={cycleModuleOrientation}
        onRedo={redoRoofChange}
        onUndo={undoRoofChange}
      />

      <div className="flex min-h-0 flex-1 bg-[#172637]">
        {showDesignerProjectPanel && (
          <DesignerProjectPanel
            config={config}
            externalMapUrl={externalMapUrl}
            project={project}
            projectId={projectId}
            saving={saving}
            sizing={visualSizing}
            onGenerateBoard={generateSolarBoard}
            onSave={saveConfig}
            updateConfig={updateConfig}
          />
        )}

        <div className="solar-edge-workspace hidden w-[52px] shrink-0 border-r border-white/5 lg:block" />
        <main className="flex min-w-0 flex-1 overflow-hidden bg-[#172637]">
          <section className="relative min-w-0 flex-1 overflow-hidden">
            <SolarDesignerMap
              className="h-full w-full"
              config={config}
              designerMode
              editorMode={editorMode}
              fitRoofRequest={fitRoofRequest}
              panelPolygons={visiblePanelPolygons}
              showBadges={false}
              showMeasurements={editorMode === "edit"}
              showMiniMap
              sizing={visualSizing}
              onEditorModeChange={setEditorMode}
              onRoofChange={handleRoofGeometryChange}
              onViewportChange={handleMapViewportChange}
            />
            <PanelQuantityCard
              disabled={roofLocked}
              hasRoof={hasRoof}
              sizing={visualSizing}
              onQuantityChange={(value) => updateConfig("requested_panel_count", value)}
            />
            <DesignerStatsHud sizing={visualSizing} />
          </section>
          <aside className="solar-edge-workspace hidden w-[188px] shrink-0 border-l border-white/5 xl:block" />
        </main>
      </div>
    </div>
  );
}

function DesignerTopBar({
  hasRoof,
  isLocked,
  panelCount,
  saving,
  sizing,
  onClear,
  onFitRoof,
  onSave,
  onToggleLock,
}) {
  const fitsArea = hasRoof && sizing.fitsArea;
  const menuContentClass = "z-[140] min-w-[230px] rounded-[6px] border-[#d8e0ea] bg-white p-1.5 text-[#334155] shadow-xl";

  return (
    <header className="flex h-11 shrink-0 items-center bg-[#06296c] text-white shadow-[0_1px_0_rgba(255,255,255,0.16)]">
      <Link to="/projects" className="flex h-full w-12 items-center justify-center border-r border-white/10 text-white/90 hover:bg-white/10">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex h-full w-[205px] shrink-0 items-center gap-3 bg-[#2f457e] px-3 sm:w-[236px] sm:px-4">
        <span className="h-4 w-5 skew-x-[-18deg] rounded-[2px] bg-white" />
        <span className="text-sm font-extrabold">Design 1</span>
        <span className="ml-auto flex items-center gap-1.5 text-sm font-bold text-white/90">
          <Grid2X2 className="h-4 w-4" />
          {panelCount}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Abrir ações do projeto" title="Ações do projeto" className="flex h-7 w-7 items-center justify-center rounded-[3px] text-white/80 hover:bg-white/10 hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuContentClass}>
            <DropdownMenuLabel>Ações do projeto</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSave} disabled={saving}>
              <Save /> Salvar alterações
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onFitRoof} disabled={!hasRoof}>
              <ImageIcon /> Enquadrar telhado
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClear} disabled={!hasRoof || isLocked} className="text-red-600 focus:text-red-700">
              <Trash2 /> Excluir área do telhado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="ml-auto flex h-full items-center gap-2 px-2 text-sm font-bold sm:gap-4 sm:px-4">
        <button type="button" aria-label="Salvar projeto" onClick={onSave} className="inline-flex h-8 items-center gap-1.5 rounded-[3px] px-2.5 text-white transition hover:bg-white/10 disabled:opacity-70" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? "Salvando" : "Salvar"}
        </button>
        <span className="hidden h-6 w-px bg-white/30 sm:block" />
        <button type="button" aria-label={isLocked ? "Liberar edição" : "Bloquear edição"} title={isLocked ? "Liberar edição" : "Bloquear edição"} onClick={onToggleLock} className={`hidden h-8 w-8 items-center justify-center rounded-[3px] hover:bg-white/10 sm:flex ${isLocked ? "bg-white/15 text-amber-200" : "text-white/90"}`}>
          {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Ver notificações do projeto" title="Notificações" className="relative hidden h-8 w-8 items-center justify-center rounded-[3px] text-white/90 hover:bg-white/10 sm:flex">
              <Bell className="h-4 w-4" />
              {hasRoof && !fitsArea && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-amber-300" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuContentClass}>
            <DropdownMenuLabel>Validação do projeto</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-2 py-2 text-xs leading-5 text-[#5f6f82]">
              {!hasRoof ? (
                <p>Desenhe uma área para calcular a capacidade.</p>
              ) : fitsArea ? (
                <p className="font-bold text-emerald-700">Os {sizing.requestedPanelCount} painéis cabem na área delimitada.</p>
              ) : (
                <p className="font-bold text-amber-700">Cabem {sizing.physicalLimit} de {sizing.requestedPanelCount} painéis. Faltam {sizing.missingPanelCount}.</p>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Link to="/settings" aria-label="Abrir configurações do usuário" title="Configurações" className="hidden h-8 w-8 items-center justify-center rounded-[3px] text-white/90 hover:bg-white/10 md:flex">
          <UserCircle className="h-5 w-5" />
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Abrir ajuda" title="Ajuda" className="hidden h-8 w-8 items-center justify-center rounded-[3px] text-white/90 hover:bg-white/10 lg:flex">
              <HelpCircle className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className={menuContentClass}>
            <DropdownMenuLabel>Como usar o editor</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="space-y-1 px-2 py-2 text-xs leading-5 text-[#5f6f82]">
              <p><strong>Casa/quadrado:</strong> desenhar a área.</p>
              <p><strong>Lápis:</strong> ajustar os vértices.</p>
              <p><strong>Setas/giro:</strong> mover ou rotacionar.</p>
              <p><strong>Camadas:</strong> alternar a orientação.</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function DesignerToolRibbon({
  canRedo,
  canUndo,
  editingLocked,
  editorMode,
  hasRoof,
  orientation,
  onClear,
  onFitRoof,
  onModeChange,
  onOrientationChange,
  onRedo,
  onUndo,
}) {
  const tools = [
    { mode: "select", icon: MousePointer2, label: "Navegar no mapa" },
    { mode: "draw-polygon", icon: Home, label: "Desenhar contorno do telhado" },
    { mode: "draw-rectangle", icon: Square, label: "Desenhar telhado retangular" },
    { mode: "edit", icon: Pencil, label: "Editar vértices", requiresRoof: true },
    { mode: "move", icon: Move3D, label: "Mover telhado", requiresRoof: true },
    { mode: "rotate", icon: RotateCw, label: "Girar telhado", requiresRoof: true },
  ];
  const instructions = {
    select: hasRoof ? "Telhado preenchido. Selecione uma ferramenta para ajustar." : "Desenhe o contorno do telhado para posicionar os módulos.",
    "draw-polygon": "Clique nos cantos do telhado e clique no primeiro ponto para concluir.",
    "draw-rectangle": "Clique e arraste sobre o telhado para criar a área retangular.",
    edit: "Arraste os pontos para acompanhar exatamente as bordas do telhado.",
    move: "Arraste o polígono inteiro para reposicioná-lo.",
    rotate: "Use a alça para alinhar o telhado com a imagem de satélite.",
  };
  const orientationLabel = orientation === "vertical"
    ? "Módulos em pé"
    : orientation === "horizontal" ? "Módulos deitados" : "Orientação automática";

  return (
    <div className="flex h-16 shrink-0 items-center border-b border-[#d7dce8] bg-[#f5f7fb] text-[#334155] shadow-[0_1px_8px_rgba(15,23,42,0.08)]">
      <div className="hidden h-full w-[390px] items-center border-r border-[#d7dce8] px-5 text-xs font-semibold leading-5 text-[#45556e] lg:flex">
        {instructions[editorMode] || instructions.select}
      </div>
      <div className="solar-tool-ribbon flex min-w-0 flex-1 items-center gap-3 overflow-x-auto px-3 sm:px-4">
        <div className="flex shrink-0 items-center gap-1.5">
          {tools.map(({ mode, icon: Icon, label, requiresRoof }) => {
            const editsRoof = mode !== "select";
            return (
            <button
              key={mode}
              type="button"
              aria-label={label}
              title={label}
              disabled={(requiresRoof && !hasRoof) || (editingLocked && editsRoof)}
              onClick={() => onModeChange(mode)}
              className={`flex h-10 w-10 items-center justify-center rounded-[4px] border transition ${editorMode === mode ? "border-[#cde4fb] bg-white text-[#268ff5] shadow-[0_3px_10px_rgba(38,143,245,0.12)]" : "border-transparent text-[#5b6576] hover:border-[#e0e6ef] hover:bg-white"} disabled:cursor-not-allowed disabled:opacity-30`}
            >
              <Icon className="h-5 w-5" />
            </button>
            );
          })}
          <button
            type="button"
            aria-label={orientationLabel}
            title={`${orientationLabel}. Clique para alternar.`}
            onClick={onOrientationChange}
            disabled={!hasRoof || editingLocked}
            className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[#5b6576] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Enquadrar telhado"
            title="Enquadrar telhado"
            onClick={onFitRoof}
            disabled={!hasRoof}
            className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[#5b6576] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ImageIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Excluir telhado"
            title="Excluir telhado"
            onClick={onClear}
            disabled={!hasRoof || editingLocked}
            className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[#5b6576] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <span className="mx-2 h-9 w-px bg-[#cbd3e2]" />
          <button type="button" aria-label="Desfazer" title="Desfazer" onClick={onUndo} disabled={!canUndo || editingLocked} className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[#5b6576] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b3bac8]">
            <Undo2 className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Refazer" title="Refazer" onClick={onRedo} disabled={!canRedo || editingLocked} className="flex h-10 w-10 items-center justify-center rounded-[4px] text-[#5b6576] hover:bg-white disabled:cursor-not-allowed disabled:text-[#b3bac8]">
            <Redo2 className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function DesignerProjectPanel({
  config,
  externalMapUrl,
  project,
  projectId,
  saving,
  sizing,
  onGenerateBoard,
  onSave,
  updateConfig,
}) {
  return (
    <aside className="hidden w-[390px] shrink-0 overflow-y-auto border-r border-[#d8dde7] bg-[#f8fafc] shadow-[10px_0_24px_rgba(15,23,42,0.08)] lg:block">
      <PanelSection title="DETALHES DO PROJETO" defaultOpen>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="flex h-11 items-center justify-center gap-2 border-2 border-[#58a6f6] bg-[#e8f3ff] text-xs font-extrabold text-[#4598ea]">
            <Home className="h-5 w-5" />
            Residencial
          </button>
          <button type="button" className="flex h-11 items-center justify-center gap-2 border border-[#dfe4ec] bg-white text-xs font-extrabold text-[#737f91]">
            <Building2 className="h-5 w-5" />
            Comercial
          </button>
        </div>
        <ReadOnlyField label="Nome do Projeto" value={project.name || "Projeto solar"} />
        <ReadOnlyField label="Rua" value={project.address || "Endereco da obra"} />
        <div className="grid grid-cols-[minmax(0,1fr)_110px] gap-4">
          <ReadOnlyField label="Cidade" value={project.city || "Cidade"} />
          <ReadOnlyField label="CEP" value={project.zip_code || "00000-000"} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Pais" value={project.country || "Brazil"} />
          <ReadOnlyField label="Estado" value={project.state || "RJ"} />
        </div>
        <div className="flex items-end gap-2">
          <ReadOnlyField label="Estacao meteorologica" value="Galeao/Rio (CIV/MIL) (5 km)" />
          <button type="button" className="mb-1 flex h-9 w-9 shrink-0 items-center justify-center text-[#7b8494]">
            <ExternalLink className="h-5 w-5" />
          </button>
        </div>
        {externalMapUrl && (
          <a href={externalMapUrl} target="_blank" rel="noreferrer" className="mt-2 flex h-10 items-center justify-center gap-2 rounded-[4px] border border-[#d9e2ee] bg-white text-xs font-extrabold text-[#36506e] shadow-sm">
            <ExternalLink className="h-4 w-4" />
            Visualizar no Google Maps
          </a>
        )}
      </PanelSection>

      <PanelSection title="PARAMETROS DA REDE" aside={`${config.ac_voltage}V · ${config.ac_supply_type}`}>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-[#9aa3b2]">Alimentacao CA</Label>
            <Select value={config.ac_supply_type} onValueChange={(value) => updateConfig("ac_supply_type", value)}>
              <SelectTrigger className="h-10 rounded-[3px] border-[#dbe2ec] bg-white text-sm font-semibold"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Monofásico">Monofásico</SelectItem>
                <SelectItem value="Bifásico">Bifásico</SelectItem>
                <SelectItem value="Trifásico">Trifásico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Tensão CA (V)" value={config.ac_voltage} step="1" onChange={(value) => updateConfig("ac_voltage", value)} />
        </div>
      </PanelSection>

      <PanelSection title="DIMENSIONAMENTO FV" aside={`${sizing.panelCount} modulos`}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantidade de painéis" value={config.requested_panel_count} step="1" onChange={(value) => updateConfig("requested_panel_count", value)} />
          <Field label="Inversor (kW)" value={config.inverter_kw} step="0.5" onChange={(value) => updateConfig("inverter_kw", value)} />
          <Field label="Painel (Wp)" value={config.module_wp} step="10" onChange={(value) => updateConfig("module_wp", value)} />
          <Field label="Telhado largura (m)" value={config.roof_width_m} step="0.5" onChange={(value) => updateConfig("roof_width_m", value)} />
          <Field label="Telhado altura (m)" value={config.roof_height_m} step="0.5" onChange={(value) => updateConfig("roof_height_m", value)} />
          <Field label="Uso do telhado (%)" value={config.roof_utilization_pct} step="5" onChange={(value) => updateConfig("roof_utilization_pct", value)} />
          <Field label="Rotação (graus)" value={config.roof_rotation_deg} step="1" onChange={(value) => updateConfig("roof_rotation_deg", value)} />
        </div>
        <div className="rounded-[4px] border border-[#dbe2ec] bg-[#f8fafc] px-3 py-2 text-xs font-bold text-[#536174]">
          Placa fixa: 2,40 m × 1,14 m ({(SOLAR_MODULE_HEIGHT_M * SOLAR_MODULE_WIDTH_M).toFixed(2).replace(".", ",")} m²)
        </div>
      </PanelSection>

      <PanelSection title="RESULTADOS" aside={`${sizing.dcPowerKw.toFixed(2)} kWp`}>
        <div className="grid gap-2 text-sm">
          <ResultRow label="Módulos FV" value={`${sizing.panelCount} un.`} />
          <ResultRow label="Capacidade da área" value={`${sizing.physicalLimit} un.`} />
          <ResultRow label="Validação" value={sizing.fitsArea ? "Cabe na área" : "Não cabe"} />
          <ResultRow label="Potência CC" value={`${sizing.dcPowerKw.toFixed(2)} kWp`} />
          <ResultRow label="DC / CA" value={`${sizing.dcAcRatio.toFixed(2)}x`} />
          <ResultRow label="Área útil" value={`${sizing.usableArea.toFixed(1)} m²`} />
          <ResultRow label="Disjuntor CA" value={`${sizing.breaker}A · ${polesForSupply(config.ac_supply_type)}P`} />
        </div>
      </PanelSection>

      <div className="sticky bottom-0 grid grid-cols-2 gap-3 border-t border-[#dfe4ec] bg-white/95 p-4 backdrop-blur">
        <Button type="button" variant="outline" className="h-11 rounded-full border-[#5ba9f4] text-xs font-extrabold text-[#4a9bea]" asChild>
          <Link to={`/panel-generator?project=${projectId}`}>
            <Grid2X2 className="h-4 w-4" />
            QUADRO
          </Link>
        </Button>
        <Button type="button" className="h-11 rounded-full bg-[#9fc8f6] text-xs font-extrabold text-white hover:bg-[#78b4f1]" onClick={saving ? undefined : onSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          APLICAR
        </Button>
        <Button type="button" className="col-span-2 h-10 rounded-[4px] bg-[#06296c] text-xs font-extrabold text-white hover:bg-[#08347f]" onClick={onGenerateBoard} disabled={saving}>
          <Grid2X2 className="h-4 w-4" />
          Gerar quadro CA do inversor
        </Button>
      </div>
    </aside>
  );
}

function PanelSection({ title, aside, defaultOpen = false, children }) {
  return (
    <section className="border-b border-[#dfe4ec] bg-white p-5 shadow-[0_1px_5px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-black uppercase tracking-[0.02em] text-[#263346]">{title}</h3>
        <div className="flex items-center gap-2 text-xs font-bold text-[#9aa3b2]">
          {aside}
          <ChevronDown className={`h-4 w-4 ${defaultOpen ? "rotate-180" : ""}`} />
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-[#9aa3b2]">{label}</span>
      <span className="mt-1 block border-b border-[#d8dee8] pb-1 text-base font-semibold uppercase text-[#536174]">
        {value}
      </span>
    </label>
  );
}

function Field({ label, value, step, onChange }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold text-[#9aa3b2]">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        className="h-10 rounded-[3px] border-[#dbe2ec] bg-white text-sm font-semibold text-[#334155]"
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function ResultRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-[#edf1f6] pb-2">
      <span className="font-bold text-[#7b8494]">{label}</span>
      <span className="font-black text-[#263346]">{value}</span>
    </div>
  );
}

function PanelQuantityCard({ disabled = false, hasRoof, sizing, onQuantityChange }) {
  const requested = sizing.requestedPanelCount;
  const capacity = sizing.physicalLimit;
  const fits = hasRoof && sizing.fitsArea;
  const moduleArea = SOLAR_MODULE_HEIGHT_M * SOLAR_MODULE_WIDTH_M;
  const statusClass = !hasRoof
    ? "border-slate-200 bg-white/95 text-slate-700"
    : fits
      ? "border-emerald-300 bg-emerald-50/95 text-emerald-900"
      : "border-amber-300 bg-amber-50/95 text-amber-950";

  return (
    <div className="absolute left-3 top-3 z-[520] w-[min(320px,calc(100%-1.5rem))] rounded-[6px] border bg-white/95 p-3 shadow-[0_14px_38px_rgba(15,23,42,0.22)] backdrop-blur sm:left-4 sm:top-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#66758a]">Quantitativo de painéis</p>
          <p className="mt-1 text-[11px] font-bold text-[#7b8798]">
            Placa fixa 2,40 m × 1,14 m · {moduleArea.toFixed(2).replace(".", ",")} m²
          </p>
        </div>
        <Input
          aria-label="Quantidade de painéis solicitada"
          type="number"
          disabled={disabled}
          min="1"
          max="1200"
          step="1"
          value={requested}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 1) onQuantityChange(value);
          }}
          title={disabled ? "Libere a edição para alterar o quantitativo" : "Quantidade de painéis solicitada"}
          className="h-10 w-[76px] rounded-[4px] border-[#aebed0] bg-white text-center text-base font-black tabular-nums text-[#172b4d] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        />
      </div>

      <div className={`mt-3 flex items-start gap-2 rounded-[4px] border px-3 py-2 ${statusClass}`}>
        {!hasRoof || !fits
          ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
        <div className="min-w-0 text-xs font-bold leading-4">
          {!hasRoof ? (
            <>
              <p className="font-black">Área ainda não definida</p>
              <p className="font-semibold">Desenhe ou carregue o contorno para validar o encaixe.</p>
            </>
          ) : fits ? (
            <>
              <p className="font-black">Cabe na área carregada</p>
              <p className="font-semibold">Solicitados {requested} · capacidade máxima {capacity}.</p>
            </>
          ) : (
            <>
              <p className="font-black">Não cabe na área carregada</p>
              <p className="font-semibold">Cabem {capacity} de {requested}; faltam {sizing.missingPanelCount}.</p>
            </>
          )}
        </div>
      </div>

      {hasRoof && (
        <p className="mt-2 text-[10px] font-bold text-[#7b8798]">
          Área delimitada: {sizing.roofArea.toFixed(1).replace(".", ",")} m² · orientação {sizing.orientation === "horizontal" ? "deitada" : "em pé"}
        </p>
      )}
    </div>
  );
}

function DesignerStatsHud({ sizing }) {
  const productionMwh = sizing.dcPowerKw * 1.32;
  const formatDecimal = (value) => value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-[520] grid w-[min(610px,calc(100%-2rem))] -translate-x-1/2 grid-cols-3 overflow-hidden rounded-[3px] border border-white/15 bg-[#202936]/95 text-white shadow-[0_18px_55px_rgba(0,0,0,0.35)] backdrop-blur-md">
      <HudMetric icon={Grid2X2} label="MÓDULOS FV" shortLabel="MÓDULOS" value={sizing.panelCount.toLocaleString("pt-BR")} unit="módulos" />
      <HudMetric icon={Zap} label="POTÊNCIA CC" shortLabel="POTÊNCIA" value={formatDecimal(sizing.dcPowerKw)} unit="kWp" />
      <HudMetric icon={BarChart3} label="PRODUÇÃO ANUAL" shortLabel="PRODUÇÃO" value={formatDecimal(productionMwh)} unit="MWh" />
    </div>
  );
}

function HudMetric({ icon: Icon, label, shortLabel, unit, value }) {
  return (
    <div className="relative flex min-w-0 items-center justify-center gap-1 border-r border-white/10 px-2 py-3 last:border-r-0 sm:justify-start sm:gap-3 sm:px-5">
      <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-white/[0.08] text-[#72b7ff] sm:flex">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="whitespace-nowrap text-[9px] font-extrabold uppercase text-[#aeb8c7] sm:text-[10px]">
          <span className="sm:hidden">{shortLabel || label}</span>
          <span className="hidden sm:inline">{label}</span>
        </p>
        <p className="mt-0.5 whitespace-nowrap text-sm font-extrabold leading-none tabular-nums text-white sm:text-lg">
          {value} <span className="text-[9px] font-bold text-[#c4ccd8] sm:text-[11px]">{unit}</span>
        </p>
      </div>
      <span className="absolute inset-x-5 bottom-0 h-[3px] bg-[#3ddc97]" />
    </div>
  );
}
