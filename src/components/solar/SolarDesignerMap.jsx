import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import {
  AlertTriangle,
  Box,
  Check,
  Compass,
  Crosshair,
  Flame,
  Grid,
  Layers,
  Maximize2,
  Minus,
  MousePointer,
  Move3D,
  Pencil,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  ShieldAlert,
  Sparkles,
  Square,
  Sun,
  Trash2,
  Undo2,
  X,
  Zap,
} from "lucide-react";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  buildPanelPolygons,
  distanceMeters,
  edgeRotationDegrees,
  getAzimuthWithCardinal,
  getMapCenterFromConfig,
  getPolygonCentroid,
  getPolygonEdges,
  getRoofMetricsFromPolygon,
  getRoofPolygonFromConfig,
  normalizeRoofPolygon,
} from "@/lib/solarDesignerGeometry";

const SATELLITE_TILE_URL = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
const SATELLITE_ATTRIBUTION = "Google Maps Satélite";

const ROOF_LAYER_OPTIONS = {
  allowSelfIntersection: false,
  snappable: true,
  snapDistance: 12,
};

// Cores das strings no modo elétrico
export const STRING_COLORS = [
  { stroke: "#38bdf8", fill: "#0284c7", border: "#7dd3fc", name: "String 1" },
  { stroke: "#34d399", fill: "#059669", border: "#6ee7b7", name: "String 2" },
  { stroke: "#fbbf24", fill: "#d97706", border: "#fde68a", name: "String 3" },
  { stroke: "#c084fc", fill: "#9333ea", border: "#e9d5ff", name: "String 4" },
  { stroke: "#f472b6", fill: "#db2777", border: "#fbcfe8", name: "String 5" },
  { stroke: "#60a5fa", fill: "#2563eb", border: "#bfdbfe", name: "String 6" },
];

function toLeafletPositions(points) {
  return normalizeRoofPolygon(points).map((point) => [point.lat, point.lng]);
}

function extractLayerPositions(layer) {
  if (!layer?.getLatLngs) return [];
  const latLngs = layer.getLatLngs();
  const ring = Array.isArray(latLngs?.[0]) ? latLngs[0] : latLngs;

  return (ring || [])
    .map((point) => ({ lat: Number(point.lat), lng: Number(point.lng) }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
}

function interpolateLatLng(start, end, ratio) {
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

function buildPanelCellLines(panel) {
  if (!Array.isArray(panel) || panel.length < 4) return [];
  const [topLeft, topRight, bottomRight, bottomLeft] = panel;

  return [
    [interpolateLatLng(topLeft, bottomLeft, 1 / 3), interpolateLatLng(topRight, bottomRight, 1 / 3)],
    [interpolateLatLng(topLeft, bottomLeft, 2 / 3), interpolateLatLng(topRight, bottomRight, 2 / 3)],
    [interpolateLatLng(topLeft, topRight, 1 / 2), interpolateLatLng(bottomLeft, bottomRight, 1 / 2)],
  ];
}

function ViewportController({ center, zoom, viewportRequest = 0 }) {
  const map = useMap();
  const lastRequestRef = useRef(viewportRequest);

  useEffect(() => {
    if (viewportRequest && viewportRequest !== lastRequestRef.current) {
      lastRequestRef.current = viewportRequest;
      map.flyTo([center.lat, center.lng], zoom || map.getZoom(), { animate: true, duration: 0.8 });
    }
  }, [center, map, zoom, viewportRequest]);

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 100);
    return () => window.clearTimeout(id);
  }, [map]);

  return null;
}

function MeasurementLabels({ roofPolygon }) {
  const edges = useMemo(() => getPolygonEdges(roofPolygon), [roofPolygon]);

  return edges.map((item) => (
    <Marker
      key={item.id}
      position={[item.midpoint.lat, item.midpoint.lng]}
      interactive={false}
      icon={L.divIcon({
        className: "solar-measure-label",
        html: `<span class="bg-slate-950/85 text-white border border-white/30 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-lg whitespace-nowrap backdrop-blur-sm" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
        iconSize: [70, 18],
        iconAnchor: [35, 9],
      })}
    />
  ));
}

function EdgeAlignmentLayer({ roofPolygon, onAlignToEdge }) {
  const edges = useMemo(() => getPolygonEdges(roofPolygon), [roofPolygon]);

  if (edges.length < 2) return null;

  return edges.map((edge) => (
    <Marker
      key={`align-${edge.id}`}
      position={[edge.midpoint.lat, edge.midpoint.lng]}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onAlignToEdge?.(edge.azimuth);
        },
      }}
      icon={L.divIcon({
        className: "solar-edge-align-handle",
        html: `
          <div class="group relative flex items-center justify-center cursor-pointer pointer-events-auto">
            <div class="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 shadow-lg border-2 border-white ring-2 ring-cyan-500/40 transform hover:scale-125 transition-all">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <div class="absolute bottom-full mb-1.5 opacity-90 group-hover:opacity-100 whitespace-nowrap rounded-md bg-slate-950/95 px-2 py-0.5 text-[10px] font-bold text-cyan-200 border border-cyan-400/80 shadow-2xl backdrop-blur-md pointer-events-none transition-all scale-95 group-hover:scale-100 flex items-center gap-1">
              <span>Alinhar módulos (${edge.azimuth}°)</span>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })}
    />
  ));
}

function ArrayCountBadge({ panelPolygons }) {
  const centroid = useMemo(() => {
    if (!panelPolygons.length) return null;
    const allPoints = panelPolygons.flat();
    return getPolygonCentroid(allPoints);
  }, [panelPolygons]);

  if (!centroid || !panelPolygons.length) return null;

  return (
    <Marker
      position={[centroid.lat, centroid.lng]}
      interactive={false}
      icon={L.divIcon({
        className: "solar-array-count-badge",
        html: `
          <div class="bg-slate-950/90 border border-white/25 text-white px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xl backdrop-blur-md whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2">
            <span class="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span>Módulos FV: ${panelPolygons.length}</span>
          </div>
        `,
        iconSize: [0, 0],
      })}
    />
  );
}

function MapViewportEvents({ onViewportChange, onMapClick, isDrawing, onMeasureClick, isMeasuring }) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      onViewportChange?.({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      });
    },
    zoomend() {
      const center = map.getCenter();
      onViewportChange?.({
        center: { lat: center.lat, lng: center.lng },
        zoom: map.getZoom(),
      });
    },
    click(e) {
      if (isMeasuring) {
        onMeasureClick?.(e.latlng);
      } else if (!isDrawing) {
        onMapClick?.(e.latlng);
      }
    },
  });

  return null;
}

function MapFitController({ roofPolygon, request }) {
  const map = useMap();
  const lastRequestRef = useRef(0);

  useEffect(() => {
    if (!request || request === lastRequestRef.current || roofPolygon.length < 3) return;
    lastRequestRef.current = request;
    map.fitBounds(L.latLngBounds(toLeafletPositions(roofPolygon)), {
      animate: true,
      maxZoom: 21,
      padding: [70, 70],
    });
  }, [map, request, roofPolygon]);

  return null;
}

function FloatingMapControls({ onFitRoof, hasRoof, onToggle3D }) {
  const map = useMap();

  return (
    <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-900/90 p-1 shadow-2xl backdrop-blur-md text-white">
      <button
        type="button"
        title="Aproximar Zoom (+)"
        onClick={() => map.zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Afastar Zoom (-)"
        onClick={() => map.zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-white"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      {hasRoof && (
        <>
          <span className="h-px w-4 bg-white/15 my-0.5" />
          <button
            type="button"
            title="Enquadrar Telhado"
            onClick={onFitRoof}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-cyan-300"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {onToggle3D && (
        <button
          type="button"
          title="Alternar Vista 3D"
          onClick={onToggle3D}
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-amber-300"
        >
          <Move3D className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function RoofEditorLayer({ positions, mode, onChange, onModeChange }) {
  const map = useMap();
  const layerRef = useRef(null);
  const syncingRef = useRef(false);
  const hasPositions = positions.length >= 3;
  const positionKey = useMemo(
    () => positions.map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join("|"),
    [positions]
  );

  useEffect(() => {
    if (!map.pm) return undefined;

    map.pm.setLang("pt_br");
    map.pm.setGlobalOptions({
      ...ROOF_LAYER_OPTIONS,
      continueDrawing: false,
    });

    const handleCreate = (event) => {
      const createdPositions = extractLayerPositions(event.layer);
      map.removeLayer(event.layer);

      if (createdPositions.length >= 3) {
        onChange?.(createdPositions);
        onModeChange?.("edit");
      }
    };

    map.on("pm:create", handleCreate);

    return () => {
      map.off("pm:create", handleCreate);
      map.pm?.disableDraw();
    };
  }, [map, onChange, onModeChange]);

  useEffect(() => {
    if (!hasPositions) return undefined;

    const emitGeometry = () => {
      if (syncingRef.current) return;
      const nextPositions = extractLayerPositions(layerRef.current);
      if (nextPositions.length >= 3) onChange?.(nextPositions);
    };

    const layer = L.polygon(toLeafletPositions(positions), {
      color: "#00d8b8",
      fillColor: "#00d8b8",
      fillOpacity: 0.16,
      opacity: 0.95,
      pane: "overlayPane",
      pmIgnore: false,
      weight: 2.2,
    }).addTo(map);

    layer.pm.setOptions(ROOF_LAYER_OPTIONS);
    layer.on("pm:edit", emitGeometry);
    layer.on("pm:dragend", emitGeometry);
    layer.on("pm:rotateend", emitGeometry);
    layer.on("pm:scaleend", emitGeometry);

    layerRef.current = layer;

    return () => {
      layer.off("pm:edit", emitGeometry);
      layer.off("pm:dragend", emitGeometry);
      layer.off("pm:rotateend", emitGeometry);
      layer.off("pm:scaleend", emitGeometry);
      layer.removeFrom(map);
      layerRef.current = null;
    };
  }, [hasPositions, map, onChange]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !positions.length) return;

    syncingRef.current = true;
    const wasEnabled = layer.pm.enabled();
    if (wasEnabled) layer.pm.disable();
    layer.setLatLngs(toLeafletPositions(positions));
    if (wasEnabled) layer.pm.enable(ROOF_LAYER_OPTIONS);
    window.requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, [positionKey, positions]);

  useEffect(() => {
    if (!map.pm) return;

    map.pm.disableDraw();
    map.dragging.enable();

    const layer = layerRef.current;
    if (layer) {
      layer.pm.disable();
      layer.pm.disableLayerDrag();
      layer.pm.disableRotate();
    }

    if (mode === "draw-polygon") {
      map.pm.enableDraw("Polygon", ROOF_LAYER_OPTIONS);
    } else if (mode === "draw-rectangle") {
      map.pm.enableDraw("Rectangle", ROOF_LAYER_OPTIONS);
    } else if (mode === "edit" && layer) {
      layer.pm.enable(ROOF_LAYER_OPTIONS);
    } else if (mode === "move" && layer) {
      layer.pm.enableLayerDrag();
    } else if (mode === "rotate" && layer) {
      layer.pm.enableRotate();
    }

    return () => {
      map.pm?.disableDraw();
    };
  }, [hasPositions, map, mode, positionKey]);

  return null;
}

export default function SolarDesignerMap({
  config,
  sizing,
  viewMode = "map", // "map" | "shadows" | "irradiation"
  className = "h-[520px]",
  designerMode = false,
  editorMode = "select",
  fitRoofRequest = 0,
  viewportRequest = 0,
  selectedObstacleId = null,
  selectedModuleIndex = null,
  selectedStringIndex = null,
  electricalMode = false,
  strings = [],
  panelPolygons: controlledPanelPolygons,
  onEditorModeChange,
  onRoofChange,
  onAlignToEdge,
  onViewportChange,
  onFitRoof,
  onToggle3D,
  onUpdateObstacle,
  onSelectObstacle,
  onRemoveObstacle,
  onSelectModule,
  onSelectRoof,
  onMapClick,
  showBadges = true,
  showMeasurements = true,
  showMiniMap = false,
  onViewModeChange,
}) {
  const roofPolygon = useMemo(() => getRoofPolygonFromConfig(config), [config]);
  const generatedPanelPolygons = useMemo(() => buildPanelPolygons(config, sizing), [config, sizing]);
  const panelPolygons = controlledPanelPolygons || generatedPanelPolygons;
  
  // LOD: apenas gera linhas internas de células se quantidade de painéis for moderada (< 120)
  const panelCellLines = useMemo(() => {
    if (panelPolygons.length > 120) return [];
    return panelPolygons.flatMap(buildPanelCellLines).map(toLeafletPositions);
  }, [panelPolygons]);

  const mapCenter = useMemo(() => getMapCenterFromConfig(config), [config]);
  const mapZoom = Math.max(3, Math.min(22, Math.round(Number(config.map_zoom) || DEFAULT_SOLAR_MAP_ZOOM)));
  const initialCenter = useMemo(
    () => [mapCenter?.lat || DEFAULT_SOLAR_MAP_CENTER.lat, mapCenter?.lng || DEFAULT_SOLAR_MAP_CENTER.lng],
    []
  );

  const azimuthInfo = useMemo(() => getAzimuthWithCardinal(config.roof_rotation_deg || 24), [config.roof_rotation_deg]);
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];
  const hasRoof = roofPolygon.length >= 3;
  const isDrawing = editorMode === "draw-polygon" || editorMode === "draw-rectangle";
  const isMeasuring = editorMode === "measure";

  // Estado da ferramenta Régua de medição
  const [measurePoints, setMeasurePoints] = useState([]);
  const measureDistance = useMemo(() => {
    if (measurePoints.length < 2) return null;
    return distanceMeters(measurePoints[0], measurePoints[1]);
  }, [measurePoints]);

  const handleMeasureClick = useCallback((latlng) => {
    setMeasurePoints((prev) => {
      if (prev.length === 0 || prev.length >= 2) {
        return [latlng];
      }
      return [...prev, latlng];
    });
  }, []);

  const roofMetrics = useMemo(() => getRoofMetricsFromPolygon(roofPolygon, config), [roofPolygon, config]);
  const roofArea = roofMetrics.areaM2 || config.roof_area_m2 || 96;
  const panelCount = panelPolygons.length;
  const moduleWp = config.module_wp || 540;
  const dcPowerKw = (panelCount * moduleWp) / 1000;

  // Mapa de índices de string para cada módulo
  const moduleStringMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(strings) || strings.length === 0) return map;
    strings.forEach((str, strIdx) => {
      const start = str.startModule || 1;
      const end = str.endModule || start + (str.moduleCount || 1) - 1;
      for (let i = start; i <= end; i++) {
        map.set(i - 1, { stringIndex: strIdx, stringName: str.name || `String ${strIdx + 1}`, stringId: str.id });
      }
    });
    return map;
  }, [strings]);

  return (
    <div className={`relative overflow-hidden bg-slate-950 select-none ${className}`}>
      {/* Banner Superior de Notificação & Status de Área */}
      <div className="absolute top-3 inset-x-4 z-[500] pointer-events-none flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-1.5 text-xs text-white/90 shadow-2xl backdrop-blur-md">
          <Sun className="h-4 w-4 text-cyan-400" />
          <span className="font-medium hidden md:inline">
            {editorMode === "draw-polygon"
              ? "Clique no mapa para criar os vértices do telhado. Clique no primeiro ponto para fechar."
              : editorMode === "measure"
              ? "Clique em dois pontos para medir a distância real no telhado."
              : "Clique em uma água do telhado ou módulo para inspecionar propriedades."}
          </span>
          <span className="font-medium md:hidden">Editor Fotovoltaico</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {hasRoof && (
            <div
              onClick={() => onSelectRoof?.()}
              className="cursor-pointer flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md hover:bg-slate-800 transition"
              title="Clique para inspecionar esta área"
            >
              <span className="text-white/60">◬ {config.roof_pitch_deg || 0}°</span>
              <span className="h-3 w-px bg-white/15" />
              <span className="text-cyan-300">{Math.round(roofArea)} m²</span>
            </div>
          )}

          {isMeasuring && measureDistance !== null && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/80 px-3 py-1.5 text-xs font-black text-emerald-300 shadow-2xl backdrop-blur-md">
              <Ruler className="h-3.5 w-3.5 text-emerald-400" />
              <span>Distância: {measureDistance.toFixed(2)} m</span>
              <button
                type="button"
                onClick={() => setMeasurePoints([])}
                className="ml-1 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <MapContainer
        attributionControl={false}
        center={initialCenter}
        zoom={mapZoom}
        minZoom={3}
        maxZoom={23}
        zoomControl={false}
        scrollWheelZoom={true}
        doubleClickZoom={editorMode === "select"}
        touchZoom={true}
        className={`solar-designer-map h-full w-full ${designerMode ? "solar-designer-map--edge" : ""}`}
      >
        <TileLayer url={SATELLITE_TILE_URL} attribution={SATELLITE_ATTRIBUTION} maxNativeZoom={19} maxZoom={23} />
        
        <ViewportController center={mapCenter} zoom={mapZoom} viewportRequest={viewportRequest} />
        <MapFitController roofPolygon={roofPolygon} request={fitRoofRequest} />
        <MapViewportEvents
          onViewportChange={onViewportChange}
          onMapClick={onMapClick}
          isDrawing={isDrawing}
          isMeasuring={isMeasuring}
          onMeasureClick={handleMeasureClick}
        />
        <FloatingMapControls onFitRoof={onFitRoof} hasRoof={hasRoof} onToggle3D={onToggle3D} />
        
        <RoofEditorLayer
          positions={roofPolygon}
          mode={editorMode}
          onChange={onRoofChange}
          onModeChange={onEditorModeChange}
        />
        {showMeasurements && <MeasurementLabels roofPolygon={roofPolygon} />}
        {hasRoof && onAlignToEdge && <EdgeAlignmentLayer roofPolygon={roofPolygon} onAlignToEdge={onAlignToEdge} />}
        {panelPolygons.length > 0 && <ArrayCountBadge panelPolygons={panelPolygons} />}

        {/* Camada de Módulos Fotovoltaicos */}
        <Pane name="solar-panels-pane" style={{ zIndex: 440 }}>
          {panelPolygons.map((panel, index) => {
            const isSelected = selectedModuleIndex === index;
            const stringInfo = moduleStringMap.get(index);
            const strIdx = stringInfo?.stringIndex ?? 0;
            const strColor = STRING_COLORS[strIdx % STRING_COLORS.length];
            const isStringActive = selectedStringIndex === null || selectedStringIndex === strIdx;

            let fillColor = viewMode === "irradiation" ? "#00c853" : "#0284c7";
            let strokeColor = "#7dd3fc";
            let opacity = 0.95;
            let fillOpacity = 0.92;

            if (electricalMode || selectedStringIndex !== null) {
              fillColor = strColor.fill;
              strokeColor = strColor.stroke;
              if (!isStringActive) {
                opacity = 0.35;
                fillOpacity = 0.3;
              }
            }

            if (isSelected) {
              strokeColor = "#ffffff";
              fillColor = "#38bdf8";
              opacity = 1;
              fillOpacity = 1;
            }

            return (
              <Polygon
                key={`panel-${index}`}
                positions={toLeafletPositions(panel)}
                interactive={editorMode === "select"}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e);
                    onSelectModule?.(index);
                  },
                }}
                pmIgnore
                pathOptions={{
                  color: strokeColor,
                  className: `solar-panel-shape cursor-pointer transition-all duration-150 ${isSelected ? "ring-2 ring-white" : ""}`,
                  fillColor,
                  fillOpacity,
                  opacity,
                  weight: isSelected ? 2.2 : 0.8,
                }}
              >
                <Tooltip sticky direction="top" className="solar-panel-tooltip">
                  <div className="text-[11px] font-bold">
                    <span className="text-cyan-300">Módulo #{index + 1}</span>
                    <span className="text-white/60 ml-1.5">{moduleWp} Wp</span>
                    {stringInfo && (
                      <div className="text-[10px] text-emerald-300 mt-0.5">
                        {stringInfo.stringName}
                      </div>
                    )}
                  </div>
                </Tooltip>
              </Polygon>
            );
          })}
          
          {panelCellLines.length > 0 && viewMode !== "irradiation" && !electricalMode && (
            <Polyline
              positions={panelCellLines}
              interactive={false}
              pmIgnore
              pathOptions={{
                color: "#e0f2fe",
                className: "solar-panel-cell-lines",
                opacity: 0.45,
                weight: 0.5,
              }}
            />
          )}
        </Pane>

        {/* Camada da Régua / Medição */}
        {isMeasuring && measurePoints.length > 0 && (
          <Pane name="solar-ruler-pane" style={{ zIndex: 460 }}>
            {measurePoints.map((pt, idx) => (
              <Marker
                key={`measure-pt-${idx}`}
                position={[pt.lat, pt.lng]}
                interactive={false}
                icon={L.divIcon({
                  className: "solar-measure-point",
                  html: `<div class="h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2"></div>`,
                  iconSize: [0, 0],
                })}
              />
            ))}
            {measurePoints.length === 2 && (
              <Polyline
                positions={measurePoints.map((p) => [p.lat, p.lng])}
                interactive={false}
                pathOptions={{
                  color: "#10b981",
                  weight: 2.5,
                  dashArray: "6 6",
                }}
              />
            )}
          </Pane>
        )}

        {/* Camada de Obstáculos Interativos */}
        <Pane name="solar-obstacles-pane" style={{ zIndex: 450 }}>
          {obstacles.map((obs) => {
            const isSelected = selectedObstacleId === obs.id;
            return (
              <Circle
                key={`zone-${obs.id}`}
                center={[obs.lat, obs.lng]}
                radius={(obs.radiusM || 1.0) + 0.3}
                pathOptions={{
                  color: isSelected ? "#38bdf8" : "#f43f5e",
                  fillColor: isSelected ? "#38bdf8" : "#f43f5e",
                  fillOpacity: isSelected ? 0.35 : 0.22,
                  weight: isSelected ? 2 : 1.5,
                  dashArray: "4 4",
                }}
              />
            );
          })}
          {obstacles.map((obs) => {
            const isSelected = selectedObstacleId === obs.id;
            return (
              <Marker
                key={`marker-${obs.id}`}
                position={[obs.lat, obs.lng]}
                draggable={!isDrawing}
                eventHandlers={{
                  click: () => onSelectObstacle?.(obs.id),
                  dragend: (e) => {
                    const latLng = e.target.getLatLng();
                    onUpdateObstacle?.(obs.id, { lat: latLng.lat, lng: latLng.lng });
                  },
                }}
                icon={L.divIcon({
                  className: "solar-obstacle-marker",
                  html: `<div class="cursor-grab active:cursor-grabbing flex items-center gap-1.5 rounded-lg border ${
                    isSelected ? "border-sky-400 bg-sky-950 text-sky-200" : "border-rose-500/80 bg-slate-950 text-rose-300"
                  } px-2 py-1 text-[11px] font-bold shadow-xl backdrop-blur -translate-x-1/2 -translate-y-1/2">
                    <span class="h-2 w-2 rounded-full ${isSelected ? "bg-sky-400 animate-ping" : "bg-rose-500"}"></span>
                    <span>${obs.name || "Obstáculo"}</span>
                    <span class="text-[9px] text-white/50">${(obs.radiusM || 1.0).toFixed(1)}m</span>
                  </div>`,
                  iconSize: [0, 0],
                })}
              />
            );
          })}
        </Pane>

        {/* Camada de Mapa de Calor de Irradiação */}
        {viewMode === "irradiation" && roofPolygon.length >= 3 && (
          <Pane name="solar-irradiation-pane" style={{ zIndex: 430, pointerEvents: "none" }}>
            <Polygon
              positions={toLeafletPositions(roofPolygon)}
              interactive={false}
              pathOptions={{
                color: "#f59e0b",
                fillColor: "#f59e0b",
                fillOpacity: 0.35,
                weight: 2,
              }}
            />
          </Pane>
        )}
      </MapContainer>

      {/* Rosa dos Ventos / Compass Overlay Minimalista (Top-Right) */}
      <div className="absolute top-16 right-4 z-[500] flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-md select-none text-white">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute top-0 text-[7px] font-black text-rose-400">N</span>
          <span className="absolute right-0 text-[7px] font-bold text-white/60">L</span>
          <span className="absolute bottom-0 text-[7px] font-bold text-white/60">S</span>
          <span className="absolute left-0 text-[7px] font-bold text-white/60">O</span>
          <div
            className="flex h-5 w-5 items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-4 w-4 text-cyan-400" />
          </div>
        </div>
        <span className="text-[8.5px] font-bold text-cyan-300">{azimuthInfo.formatted}</span>
      </div>

      {/* Miniaturas / Seletor de Camadas Compacto (Bottom-Left) */}
      <div className="absolute bottom-6 left-6 z-[500] flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/15 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => onViewModeChange?.("map")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            viewMode === "map"
              ? "bg-cyan-500 text-slate-950 font-black shadow"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Satélite</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange?.("irradiation")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            viewMode === "irradiation"
              ? "bg-amber-500 text-slate-950 font-black shadow"
              : "text-white/60 hover:text-white"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-400" />
          <span>Irradiação</span>
        </button>
      </div>
    </div>
  );
}
