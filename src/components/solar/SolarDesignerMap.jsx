import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
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
  buildRealisticPanelCellLines,
  deleteVertex,
  distanceMeters,
  edgeRotationDegrees,
  getAzimuthWithCardinal,
  getMapCenterFromConfig,
  getPolygonAreaSquareMeters,
  getPolygonCentroid,
  getPolygonEdges,
  getRoofMetricsFromPolygon,
  getRoofPolygonFromConfig,
  insertVertexAtEdge,
  interpolateLatLng,
  moveVertex,
  normalizeRoofPolygon,
  SOLAR_PANEL_THEME,
  PHOTOVOLTAIC_BASE_COLORS,
} from "@/lib/solarDesignerGeometry";

export { SOLAR_PANEL_THEME, PHOTOVOLTAIC_BASE_COLORS };

const SATELLITE_TILE_URL = "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}";
const SATELLITE_ATTRIBUTION = "Google Maps Satélite";

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

function MeasurementLabels({ roofPolygon, isSelected = true }) {
  const edges = useMemo(() => getPolygonEdges(roofPolygon), [roofPolygon]);

  return edges.map((item) => (
    <Marker
      key={`${item.id}-${isSelected ? 'sel' : 'unsel'}`}
      position={[item.midpoint.lat, item.midpoint.lng]}
      interactive={false}
      icon={L.divIcon({
        className: "solar-measure-label",
        html: `<span class="${
          isSelected
            ? "bg-white text-slate-900 border-2 border-[#00d8b8]"
            : "bg-white text-slate-600 border border-slate-300"
        } px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm whitespace-nowrap" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
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
            <div class="flex h-4 w-4 items-center justify-center rounded-full bg-[#00d8b8] text-slate-950 shadow-sm border border-white transform hover:scale-125 transition-all">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <div class="absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 whitespace-nowrap rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-[#009b84] border border-[#00d8b8] shadow-md pointer-events-none transition-all scale-95 group-hover:scale-100 flex items-center gap-1 z-50">
              <span>Alinhar módulos (${edge.azimuth}°)</span>
            </div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })}
    />
  ));
}

/**
 * Badge flutuante de identificação e quantidade de módulos por área
 */
function AreaBadge({ area, isSelected, onClick }) {
  const centroid = useMemo(() => {
    if (area.panelPolygons && area.panelPolygons.length > 0) {
      return getPolygonCentroid(area.panelPolygons.flat());
    }
    return getPolygonCentroid(area.polygon);
  }, [area.polygon, area.panelPolygons]);

  if (!centroid) return null;

  return (
    <Marker
      position={[centroid.lat, centroid.lng]}
      eventHandlers={{
        click: (e) => {
          L.DomEvent.stopPropagation(e);
          onClick?.();
        },
      }}
      icon={L.divIcon({
        className: "solar-area-badge",
        html: `
          <div class="cursor-pointer ${
            isSelected
              ? "bg-slate-900 text-white border-2 border-[#00d8b8] shadow-sm scale-105"
              : "bg-white text-slate-800 border border-slate-300 hover:border-[#00d8b8] hover:scale-105"
          } px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 transition-all">
            <span class="h-2 w-2 rounded-full ${isSelected ? "bg-[#00d8b8] animate-pulse" : "bg-emerald-500"}"></span>
            <span class="${isSelected ? "font-black text-[#00d8b8]" : "font-bold"}">${area.name || "Área"}</span>
            <span class="opacity-40">·</span>
            <span class="text-[10px] opacity-90">${area.panelCount || (area.panelPolygons?.length || 0)} mods</span>
            <span class="text-[10px] opacity-60">(${Math.round(area.roof_area_m2 || 0)}m²)</span>
          </div>
        `,
        iconSize: [0, 0],
      })}
    />
  );
}

function MapViewportEvents({ onViewportChange, onMapClick, isDrawing, onMeasureClick, isMeasuring, onZoomChange }) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onZoomChange?.(zoom);
      onViewportChange?.({
        center: { lat: center.lat, lng: center.lng },
        zoom,
      });
    },
    zoomend() {
      const center = map.getCenter();
      const zoom = map.getZoom();
      onZoomChange?.(zoom);
      onViewportChange?.({
        center: { lat: center.lat, lng: center.lng },
        zoom,
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

function MapFitController({ areas = [], selectedArea, roofPolygon = [], request }) {
  const map = useMap();
  const lastRequestRef = useRef(0);

  useEffect(() => {
    if (!request || request === lastRequestRef.current) return;
    lastRequestRef.current = request;

    // Enquadra a área selecionada ou todas as áreas juntas
    let pointsToFit = [];
    if (selectedArea?.polygon?.length >= 3) {
      pointsToFit = toLeafletPositions(selectedArea.polygon);
    } else if (areas?.length > 0 && areas.some((a) => a.polygon?.length >= 3)) {
      pointsToFit = areas.flatMap((a) => toLeafletPositions(a.polygon || []));
    } else if (roofPolygon?.length >= 3) {
      pointsToFit = toLeafletPositions(roofPolygon);
    }

    if (pointsToFit.length >= 3) {
      map.fitBounds(L.latLngBounds(pointsToFit), {
        animate: true,
        maxZoom: 21,
        padding: [70, 70],
      });
    }
  }, [map, request, selectedArea, areas, roofPolygon]);

  return null;
}

function FloatingMapControls({ onFitRoof, hasRoof, azimuthInfo }) {
  const map = useMap();

  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-sm text-slate-700">
      {azimuthInfo && (
        <div className="flex flex-col items-center p-1 border-b border-slate-100 mb-0.5" title={`Azimute do telhado: ${azimuthInfo.formatted}`}>
          <div
            className="flex h-5 w-5 items-center justify-center transition-transform duration-300"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-4 w-4 text-[#009b84]" />
          </div>
          <span className="text-[8px] font-bold text-slate-500 mt-0.5">{azimuthInfo.cardinal}</span>
        </div>
      )}
      <button
        type="button"
        title="Aproximar Zoom (+)"
        onClick={() => map.zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 active:bg-slate-200 transition text-slate-700"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Afastar Zoom (-)"
        onClick={() => map.zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 active:bg-slate-200 transition text-slate-700"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      {hasRoof && (
        <button
          type="button"
          title="Centralizar no Telhado"
          onClick={onFitRoof}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100 active:bg-slate-200 transition text-[#009b84]"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * Camada de Desenho Interativo Nativo (Zero Plugin Dependency)
 */
function InteractiveRoofDrawingLayer({
  isDrawing,
  drawingPoints,
  onAddPoint,
  onFinish,
  onCancel,
  onUndoPoint,
}) {
  const map = useMap();
  const [mousePos, setMousePos] = useState(null);

  // Manipulador de atalhos de teclado (Esc p/ cancelar, Backspace p/ desfazer, Enter p/ concluir)
  useEffect(() => {
    if (!isDrawing) {
      setMousePos(null);
      return undefined;
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel?.();
      } else if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onUndoPoint?.();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (drawingPoints.length >= 3) {
          onFinish?.();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawing, drawingPoints, onFinish, onCancel, onUndoPoint]);

  useMapEvents({
    click(e) {
      if (!isDrawing) return;

      const clickPt = { lat: e.latlng.lat, lng: e.latlng.lng };

      // Se já temos 3 ou mais pontos e o clique foi muito próximo ao 1º vértice, fecha o polígono!
      if (drawingPoints.length >= 3) {
        const first = drawingPoints[0];
        const distMeters = map.distance([clickPt.lat, clickPt.lng], [first.lat, first.lng]);
        const zoom = map.getZoom();
        const threshold = zoom >= 20 ? 1.8 : zoom >= 18 ? 3.5 : 6.0;
        if (distMeters <= threshold) {
          onFinish?.();
          return;
        }
      }

      onAddPoint?.(clickPt);
    },
    mousemove(e) {
      if (!isDrawing) return;
      setMousePos({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    dblclick(e) {
      if (!isDrawing) return;
      L.DomEvent.stopPropagation(e);
      if (drawingPoints.length >= 3) {
        onFinish?.();
      }
    },
  });

  if (!isDrawing) return null;

  const polylinePositions = drawingPoints.map((p) => [p.lat, p.lng]);
  const lastPoint = drawingPoints[drawingPoints.length - 1];
  const firstPoint = drawingPoints[0];
  const rubberbandPositions = lastPoint && mousePos ? [[lastPoint.lat, lastPoint.lng], [mousePos.lat, mousePos.lng]] : [];
  const closingGuidePositions = firstPoint && mousePos && drawingPoints.length >= 2 ? [[mousePos.lat, mousePos.lng], [firstPoint.lat, firstPoint.lng]] : [];

  const previewPoints = mousePos ? [...drawingPoints, mousePos] : drawingPoints;
  const previewArea = previewPoints.length >= 3 ? getPolygonAreaSquareMeters(previewPoints) : 0;

  return (
    <Pane name="solar-drawing-pane" style={{ zIndex: 600 }}>
      {/* Polígono de preenchimento translúcido durante o desenho */}
      {previewPoints.length >= 3 && (
        <Polygon
          positions={previewPoints.map((p) => [p.lat, p.lng])}
          interactive={false}
          pathOptions={{
            color: "#00f0ff",
            fillColor: "#00f0ff",
            fillOpacity: 0.22,
            weight: 1.5,
            dashArray: "4 4",
          }}
        />
      )}

      {/* Linhas sólidas entre os vértices já demarcados */}
      {polylinePositions.length > 1 && (
        <Polyline
          positions={polylinePositions}
          interactive={false}
          pathOptions={{
            color: "#00f0ff",
            weight: 3,
            opacity: 0.95,
          }}
        />
      )}

      {/* Linha elástica / borracha até o cursor do mouse */}
      {rubberbandPositions.length === 2 && (
        <Polyline
          positions={rubberbandPositions}
          interactive={false}
          pathOptions={{
            color: "#38bdf8",
            weight: 2.2,
            dashArray: "5 5",
            opacity: 0.9,
          }}
        />
      )}

      {/* Linha guia de fechamento para o 1º ponto */}
      {closingGuidePositions.length === 2 && (
        <Polyline
          positions={closingGuidePositions}
          interactive={false}
          pathOptions={{
            color: "#34d399",
            weight: 1.8,
            dashArray: "3 6",
            opacity: 0.65,
          }}
        />
      )}

      {/* Marcadores de cada vértice */}
      {drawingPoints.map((pt, idx) => {
        const isFirst = idx === 0;
        const canClose = isFirst && drawingPoints.length >= 3;

        return (
          <Marker
            key={`draw-pt-${idx}`}
            position={[pt.lat, pt.lng]}
            eventHandlers={{
              click: (e) => {
                L.DomEvent.stopPropagation(e);
                if (canClose) {
                  onFinish?.();
                }
              },
            }}
            icon={L.divIcon({
              className: "solar-draw-vertex-marker",
              html: `
                <div class="group relative flex items-center justify-center cursor-pointer -translate-x-1/2 -translate-y-1/2">
                  ${
                    isFirst
                      ? `<div class="h-6 w-6 rounded-full border-2 border-white ${
                          canClose
                            ? "bg-emerald-500 ring-4 ring-emerald-400/60 animate-pulse scale-110 text-white"
                            : "bg-[#00d8b8] ring-2 ring-[#00d8b8]/40 text-slate-950"
                        } flex items-center justify-center font-black text-[11px] shadow-2xl">
                          ${canClose ? "✓" : "1"}
                        </div>
                        ${
                          canClose
                            ? `<div class="absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white border border-emerald-400 shadow-md pointer-events-none">
                                Clique para fechar (${previewArea.toFixed(1)} m²)
                              </div>`
                            : ""
                        }`
                      : `<div class="h-4 w-4 rounded-full border-2 border-white bg-[#00d8b8] ring-2 ring-[#00d8b8]/40 flex items-center justify-center text-slate-950 font-black text-[9px] shadow-lg">
                          ${idx + 1}
                        </div>`
                  }
                </div>
              `,
              iconSize: [0, 0],
            })}
          />
        );
      })}
    </Pane>
  );
}

/**
 * Camada do Telhado Principal com Edição Interativa de Vértices
 */
function EditableRoofPolygonLayer({
  positions,
  isEditing,
  onSelectRoof,
  onChange,
}) {
  const hasPositions = positions && positions.length >= 3;
  const edges = useMemo(() => (hasPositions ? getPolygonEdges(positions) : []), [positions, hasPositions]);

  if (!hasPositions) return null;

  const handleVertexDragEnd = (index, e) => {
    const latLng = e.target.getLatLng();
    const updated = moveVertex(positions, index, latLng);
    onChange?.(updated);
  };

  const handleAddVertexAtEdge = (edgeIndex) => {
    const updated = insertVertexAtEdge(positions, edgeIndex);
    onChange?.(updated);
  };

  const handleDeleteVertex = (vertexIndex) => {
    if (positions.length <= 3) return;
    const updated = deleteVertex(positions, vertexIndex);
    onChange?.(updated);
  };

  return (
    <Pane name="solar-roof-pane" style={{ zIndex: 430 }}>
      {/* Polígono do telhado */}
      <Polygon
        positions={toLeafletPositions(positions)}
        interactive={true}
        eventHandlers={{
          click: (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectRoof?.();
          },
        }}
        pathOptions={{
          color: "#00d8b8",
          fillColor: "#00d8b8",
          fillOpacity: 0.05,
          opacity: 0.85,
          weight: 1.8,
          dashArray: "4 4",
          className: "cursor-pointer hover:stroke-[#00c4a7] transition-all",
        }}
      />

      {/* Vértices arrastáveis (em modo select ou edit) */}
      {isEditing && (
        <>
          {positions.map((pt, idx) => {
            const latVal = Number.isFinite(Number(pt?.lat)) ? Number(pt.lat) : 0;
            const lngVal = Number.isFinite(Number(pt?.lng)) ? Number(pt.lng) : 0;
            return (
              <Marker
                key={`roof-vert-${idx}-${latVal.toFixed(6)}-${lngVal.toFixed(6)}`}
                position={[latVal, lngVal]}
                draggable={true}
              eventHandlers={{
                dragend: (e) => handleVertexDragEnd(idx, e),
                contextmenu: (e) => {
                  L.DomEvent.stopPropagation(e);
                  handleDeleteVertex(idx);
                },
                dblclick: (e) => {
                  L.DomEvent.stopPropagation(e);
                  handleDeleteVertex(idx);
                },
              }}
              icon={L.divIcon({
                className: "solar-roof-vertex-handle",
                html: `
                  <div class="group relative flex items-center justify-center cursor-move -translate-x-1/2 -translate-y-1/2">
                    <div class="h-4 w-4 rounded-full border-2 border-white bg-[#00d8b8] ring-2 ring-[#00d8b8]/50 shadow-xl transform group-hover:scale-125 transition-all flex items-center justify-center">
                      <div class="h-1.5 w-1.5 rounded-full bg-slate-950"></div>
                    </div>
                    ${
                      positions.length > 3
                        ? `<div class="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-800 border border-[#00d8b8]/60 shadow-xl pointer-events-none transition">
                            Arrastar · 2 cliques p/ excluir
                          </div>`
                        : ""
                    }
                  </div>
                `,
                iconSize: [0, 0],
              })}
            />
          );
        })}

          {/* Marcadores de inserção (+) no ponto médio de cada aresta */}
          {edges.map((edge) => (
            <Marker
              key={`roof-mid-${edge.id}`}
              position={[edge.midpoint.lat, edge.midpoint.lng]}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  handleAddVertexAtEdge(edge.index);
                },
              }}
              icon={L.divIcon({
                className: "solar-roof-midpoint-handle",
                html: `
                  <div class="group relative flex items-center justify-center cursor-pointer -translate-x-1/2 -translate-y-1/2">
                    <div class="h-3.5 w-3.5 rounded-full border border-white bg-white text-[#009b84] ring-1 ring-[#00d8b8]/60 shadow-lg transform hover:scale-125 hover:bg-[#00d8b8] hover:text-slate-950 transition-all flex items-center justify-center font-black text-[10px]">
                      +
                    </div>
                    <div class="opacity-0 group-hover:opacity-100 absolute bottom-full mb-1 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-[#009b84] border border-[#00d8b8]/60 shadow-xl pointer-events-none transition">
                      + Adicionar vértice
                    </div>
                  </div>
                `,
                iconSize: [0, 0],
              })}
            />
          ))}
        </>
      )}
    </Pane>
  );
}

export default function SolarDesignerMap({
  config = {},
  areas = [],
  selectedAreaId = null,
  sizing = {},
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
  onSelectArea,
  onCreateArea,
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
  // Encontra a área atualmente selecionada
  const selectedArea = useMemo(
    () => areas.find((a) => a.id === selectedAreaId) || areas[0] || null,
    [areas, selectedAreaId]
  );

  const selectedRoofPolygon = useMemo(
    () => selectedArea?.polygon || getRoofPolygonFromConfig(config),
    [selectedArea, config]
  );

  // Reúne todos os painéis de todas as áreas
  const allAreasPanels = useMemo(() => {
    if (areas.length > 0) {
      return areas.map((a) => ({
        areaId: a.id,
        isSelected: a.id === (selectedArea?.id || selectedAreaId),
        panels: a.panelPolygons || [],
      }));
    }
    if (controlledPanelPolygons && controlledPanelPolygons.length > 0) {
      return [{ areaId: selectedArea?.id || "default", isSelected: true, panels: controlledPanelPolygons }];
    }
    const generated = buildPanelPolygons(config, sizing);
    return [{ areaId: "default", isSelected: true, panels: generated }];
  }, [areas, controlledPanelPolygons, selectedArea, selectedAreaId, config, sizing]);

  const allPanelsFlat = useMemo(
    () => allAreasPanels.flatMap((group) => group.panels),
    [allAreasPanels]
  );

  const mapCenter = useMemo(() => getMapCenterFromConfig(config), [config]);
  const mapZoom = Math.max(3, Math.min(22, Math.round(Number(config.map_zoom) || DEFAULT_SOLAR_MAP_ZOOM)));
  const [currentZoom, setCurrentZoom] = useState(mapZoom);

  // LOD Dinâmico por Zoom:
  // - Zoom < 16: Sem linhas internas (modo visão geral leve e ultra-rápido)
  // - Zoom 16 a 18: Matriz limpa de células (6 colunas x 6 divisões + meio half-cut)
  // - Zoom >= 19: Matriz detalhada (6 colunas x 12 divisões + half-cut proeminente)
  // - Zoom >= 20: Detalhamento completo incluindo busbars finas
  const { cellLines, halfCutLines, secondaryLines } = useMemo(() => {
    if (currentZoom < 16) {
      return { cellLines: [], halfCutLines: [], secondaryLines: [] };
    }
    const isLargeArray = allPanelsFlat.length > 200;
    const highDetail = currentZoom >= 20 && !isLargeArray;

    const allCell = [];
    const allHalfCut = [];
    const allSecondary = [];

    for (let i = 0; i < allPanelsFlat.length; i++) {
      const res = buildRealisticPanelCellLines(allPanelsFlat[i], currentZoom, highDetail);
      if (res.primary && res.primary.length > 0) {
        allCell.push(...res.primary);
      }
      if (res.halfCut && res.halfCut.length > 0) {
        allHalfCut.push(...res.halfCut);
      }
      if (res.secondary && res.secondary.length > 0) {
        allSecondary.push(...res.secondary);
      }
    }

    return {
      cellLines: allCell.map(toLeafletPositions),
      halfCutLines: allHalfCut.map(toLeafletPositions),
      secondaryLines: allSecondary.map(toLeafletPositions),
    };
  }, [allPanelsFlat, currentZoom]);

  const initialCenter = useMemo(
    () => [mapCenter?.lat || DEFAULT_SOLAR_MAP_CENTER.lat, mapCenter?.lng || DEFAULT_SOLAR_MAP_CENTER.lng],
    []
  );

  const activeAzimuth = selectedArea?.roof_rotation_deg ?? config.roof_rotation_deg ?? 24;
  const azimuthInfo = useMemo(() => getAzimuthWithCardinal(activeAzimuth), [activeAzimuth]);
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];
  const hasRoof = (areas.length > 0 && areas.some((a) => a.polygon?.length >= 3)) || selectedRoofPolygon.length >= 3;
  const isDrawing = editorMode === "draw-polygon" || editorMode === "draw-rectangle";
  const isMeasuring = editorMode === "measure";

  // Estado de desenho interativo
  const [drawingPoints, setDrawingPoints] = useState([]);

  // Limpa pontos ao sair do modo de desenho
  useEffect(() => {
    if (!isDrawing) {
      setDrawingPoints([]);
    }
  }, [isDrawing]);

  const handleAddDrawingPoint = useCallback((point) => {
    setDrawingPoints((prev) => [...prev, point]);
  }, []);

  const handleUndoDrawingPoint = useCallback(() => {
    setDrawingPoints((prev) => prev.slice(0, -1));
  }, []);

  const handleFinishDrawing = useCallback(() => {
    if (drawingPoints.length < 3) return;
    if (onCreateArea) {
      onCreateArea(drawingPoints);
    } else {
      onRoofChange?.(drawingPoints);
    }
    onEditorModeChange?.("select");
    onSelectRoof?.();
    setDrawingPoints([]);
  }, [drawingPoints, onCreateArea, onRoofChange, onEditorModeChange, onSelectRoof]);

  const handleCancelDrawing = useCallback(() => {
    setDrawingPoints([]);
    onEditorModeChange?.("select");
  }, [onEditorModeChange]);

  const liveDrawingArea = useMemo(() => {
    if (drawingPoints.length < 3) return 0;
    return getPolygonAreaSquareMeters(drawingPoints);
  }, [drawingPoints]);

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

  const totalPanelCount = allPanelsFlat.length;
  const selectedPanelCount = selectedArea?.panelCount || (selectedArea?.panelPolygons?.length || 0);
  const moduleWp = Number(config.module_wp) || 540;
  const totalDcPowerKw = (totalPanelCount * moduleWp) / 1000;
  const selectedDcPowerKw = (selectedPanelCount * moduleWp) / 1000;
  const totalAnnualMwh = totalDcPowerKw * 1.36;

  const totalRoofArea = useMemo(
    () => areas.reduce((sum, a) => sum + (a.roof_area_m2 || 0), 0) || (selectedArea?.roof_area_m2 || 0) || (getRoofMetricsFromPolygon(selectedRoofPolygon, config).areaM2 || 0),
    [areas, selectedArea, selectedRoofPolygon, config]
  );

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
    <div className={`relative overflow-hidden bg-slate-100 select-none ${className} ${isDrawing ? "solar-designer-map--drawing" : ""}`}>
      {/* Banner Superior Contextual de Desenho & Medição (Solid CAD Style) */}
      {isDrawing ? (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[550] pointer-events-none animate-in slide-in-from-top-2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-800 shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#00d8b8]" />
            <span className="font-bold text-[#009b84]">
              {drawingPoints.length === 0
                ? "Demarcando telhado: clique no 1º vértice no mapa"
                : drawingPoints.length < 3
                ? `Vértice #${drawingPoints.length + 1}: clique no próximo ponto`
                : `Demarcado (${drawingPoints.length} vértices · ~${liveDrawingArea.toFixed(1)} m²)`}
            </span>

            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-2">
              {drawingPoints.length >= 3 && (
                <button
                  type="button"
                  onClick={handleFinishDrawing}
                  className="flex items-center gap-1 rounded-md bg-[#00d8b8] hover:bg-[#00c4a7] px-2.5 py-1 text-xs font-black text-slate-950 shadow-sm transition"
                >
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Concluir</span>
                </button>
              )}

              {drawingPoints.length > 0 && (
                <button
                  type="button"
                  onClick={handleUndoDrawingPoint}
                  className="flex items-center gap-1 rounded-md border border-slate-200 bg-white hover:bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 shadow-sm transition"
                  title="Desfazer último vértice (Backspace)"
                >
                  <Undo2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Desfazer Ponto</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCancelDrawing}
                className="flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-1 text-xs font-bold text-rose-700 shadow-sm transition"
                title="Cancelar desenho (Esc)"
              >
                <X className="h-3.5 w-3.5" />
                <span>Cancelar</span>
              </button>
            </div>
          </div>
        </div>
      ) : isMeasuring && measureDistance !== null ? (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[550] pointer-events-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm">
          <Ruler className="h-3.5 w-3.5 text-amber-600" />
          <span>Distância medida: {Number(measureDistance || 0).toFixed(2)} m</span>
          <button
            type="button"
            onClick={() => setMeasurePoints([])}
            className="ml-1 text-slate-400 hover:text-slate-700"
            title="Limpar medição"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : null}

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
        className={`solar-designer-map h-full w-full ${isDrawing ? "solar-designer-map--drawing" : ""} ${designerMode ? "solar-designer-map--edge" : ""}`}
      >
        <TileLayer url={SATELLITE_TILE_URL} attribution={SATELLITE_ATTRIBUTION} maxNativeZoom={19} maxZoom={23} />
        
        <ViewportController center={mapCenter} zoom={mapZoom} viewportRequest={viewportRequest} />
        <MapFitController areas={areas} selectedArea={selectedArea} roofPolygon={selectedRoofPolygon} request={fitRoofRequest} />
        <MapViewportEvents
          onViewportChange={onViewportChange}
          onMapClick={onMapClick}
          isDrawing={isDrawing}
          isMeasuring={isMeasuring}
          onMeasureClick={handleMeasureClick}
          onZoomChange={setCurrentZoom}
        />
        <FloatingMapControls onFitRoof={onFitRoof} hasRoof={hasRoof} onToggle3D={onToggle3D} azimuthInfo={azimuthInfo} />

        {/* 1. Camada das Áreas Concluídas Não Selecionadas */}
        {areas
          .filter((a) => a.id !== selectedArea?.id && a.polygon?.length >= 3)
          .map((area) => (
            <Polygon
              key={`inactive-area-${area.id}`}
              positions={toLeafletPositions(area.polygon)}
              eventHandlers={{
                click: (e) => {
                  if (isDrawing) return;
                  L.DomEvent.stopPropagation(e);
                  onSelectArea?.(area.id);
                },
              }}
              pathOptions={{
                color: "#0284c7",
                fillColor: "#0284c7",
                fillOpacity: isDrawing ? 0.08 : 0.16,
                opacity: isDrawing ? 0.5 : 0.85,
                weight: 2,
                dashArray: isDrawing ? "4, 4" : undefined,
              }}
            />
          ))}

        {/* 2. Camada de Desenho Interativo Ativo */}
        <InteractiveRoofDrawingLayer
          isDrawing={isDrawing}
          drawingPoints={drawingPoints}
          onAddPoint={handleAddDrawingPoint}
          onFinish={handleFinishDrawing}
          onCancel={handleCancelDrawing}
          onUndoPoint={handleUndoDrawingPoint}
        />

        {/* 3. Camada do Telhado Selecionado e Edição de Vértices */}
        {!isDrawing && selectedRoofPolygon?.length >= 3 && (
          <EditableRoofPolygonLayer
            positions={selectedRoofPolygon}
            isEditing={editorMode === "edit" || editorMode === "select"}
            onSelectRoof={onSelectRoof}
            onChange={onRoofChange}
          />
        )}
        {isDrawing && selectedRoofPolygon?.length >= 3 && (
          <Polygon
            positions={toLeafletPositions(selectedRoofPolygon)}
            pathOptions={{
              color: "#00d8b8",
              fillColor: "#00d8b8",
              fillOpacity: 0.1,
              opacity: 0.6,
              weight: 2,
              dashArray: "4, 4",
            }}
          />
        )}

        {/* 4. Badges de Identificação de todas as Áreas */}
        {showBadges && areas.map((area) => (
          <AreaBadge
            key={`badge-${area.id}`}
            area={area}
            isSelected={area.id === selectedArea?.id}
            onClick={() => onSelectArea?.(area.id)}
          />
        ))}

        {/* 5. Medições de arestas na área ativa */}
        {showMeasurements && !isDrawing && selectedRoofPolygon?.length >= 3 && (
          <MeasurementLabels roofPolygon={selectedRoofPolygon} isSelected={true} />
        )}

        {/* 6. Alinhamento de bordas na área ativa */}
        {hasRoof && !isDrawing && selectedRoofPolygon?.length >= 3 && onAlignToEdge && (
          <EdgeAlignmentLayer roofPolygon={selectedRoofPolygon} onAlignToEdge={onAlignToEdge} />
        )}

        {/* 7. Camada de Módulos Fotovoltaicos Realistas */}
        <Pane name="solar-panels-pane" style={{ zIndex: 440, pointerEvents: isDrawing ? "none" : "auto" }}>
          {allAreasPanels.map((group) =>
            group.panels.map((panel, idx) => {
              const globalIndex = idx;
              const isSelected = group.isSelected && selectedModuleIndex === globalIndex;
              const stringInfo = moduleStringMap.get(globalIndex);
              const strIdx = stringInfo?.stringIndex ?? 0;
              const strColor = STRING_COLORS[strIdx % STRING_COLORS.length];
              const isStringActive = selectedStringIndex === null || selectedStringIndex === strIdx;

              // Paleta fotovoltaica mono-PERC técnica (#142B46 a #1A3553)
              const realisticSiliconColor = PHOTOVOLTAIC_BASE_COLORS[(globalIndex * 5 + 1) % PHOTOVOLTAIC_BASE_COLORS.length];

              // Moldura externa cinza-azulada discreta (#8B9CAC) ou ciano na seleção ativa (#00d8b8)
              let strokeColor = isSelected ? SOLAR_PANEL_THEME.selectionActive : SOLAR_PANEL_THEME.frame;
              let strokeWidth = isSelected ? 2.0 : 1.1;
              let fillColor = viewMode === "irradiation" ? "#00c853" : realisticSiliconColor;
              let opacity = 1.0;
              let fillOpacity = isSelected ? 0.98 : 0.96;

              if (electricalMode || selectedStringIndex !== null) {
                fillColor = strColor.fill;
                strokeColor = strColor.stroke;
                strokeWidth = 1.4;
                if (!isStringActive) {
                  opacity = 0.35;
                  fillOpacity = 0.3;
                }
              }

              if (isSelected) {
                strokeColor = SOLAR_PANEL_THEME.selectionActive;
                fillColor = SOLAR_PANEL_THEME.selectionActiveDark;
                strokeWidth = 2.0;
                opacity = 1.0;
                fillOpacity = 0.98;
              }

              return (
                <Polygon
                  key={`panel-${group.areaId}-${idx}`}
                  positions={toLeafletPositions(panel)}
                  interactive={editorMode === "select" && !isDrawing}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e);
                      if (group.areaId !== selectedArea?.id) {
                        onSelectArea?.(group.areaId);
                      }
                      onSelectModule?.(globalIndex);
                    },
                  }}
                  pathOptions={{
                    color: strokeColor,
                    className: `solar-panel-shape cursor-pointer transition-all duration-150 ${isSelected ? "solar-panel--selected" : ""}`,
                    fillColor,
                    fillOpacity,
                    opacity,
                    weight: strokeWidth,
                  }}
                >
                  <Tooltip sticky direction="top" className="solar-panel-tooltip">
                    <div className="text-[11px] font-bold">
                      <span className="text-[#00d8b8]">Módulo #{idx + 1}</span>
                      <span className="text-slate-300 ml-1.5">{moduleWp} Wp</span>
                      {stringInfo && (
                        <div className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                          {stringInfo.stringName}
                        </div>
                      )}
                    </div>
                  </Tooltip>
                </Polygon>
              );
            })
          )}
          
          {/* Linhas internas finas das células fotovoltaicas (#45617A com opacidade reduzida) */}
          {cellLines.length > 0 && viewMode !== "irradiation" && !electricalMode && (
            <Polyline
              positions={cellLines}
              interactive={false}
              pathOptions={{
                color: SOLAR_PANEL_THEME.internalLines,
                className: "solar-panel-cell-lines pointer-events-none",
                opacity: currentZoom >= 20 ? 0.6 : 0.46,
                weight: currentZoom >= 20 ? 0.8 : 0.65,
              }}
            />
          )}

          {/* Linha central divisória de corte (Half-Cut gap) */}
          {halfCutLines.length > 0 && viewMode !== "irradiation" && !electricalMode && (
            <Polyline
              positions={halfCutLines}
              interactive={false}
              pathOptions={{
                color: "#5f7e9a",
                className: "solar-panel-half-cut-lines pointer-events-none",
                opacity: currentZoom >= 20 ? 0.72 : 0.55,
                weight: currentZoom >= 20 ? 1.0 : 0.8,
              }}
            />
          )}

          {/* Barramentos secundários finos (busbars) em zoom próximo */}
          {secondaryLines.length > 0 && viewMode !== "irradiation" && !electricalMode && (
            <Polyline
              positions={secondaryLines}
              interactive={false}
              pathOptions={{
                color: "#526e88",
                className: "solar-panel-busbars pointer-events-none",
                opacity: 0.32,
                weight: 0.5,
              }}
            />
          )}
        </Pane>

        {/* 8. Camada da Régua / Medição */}
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

        {/* 9. Camada de Obstáculos Interativos */}
        <Pane name="solar-obstacles-pane" style={{ zIndex: 450, pointerEvents: isDrawing ? "none" : "auto" }}>
          {obstacles.map((obs) => {
            const isSelected = selectedObstacleId === obs.id;
            return (
              <Circle
                key={`zone-${obs.id}`}
                center={[obs.lat, obs.lng]}
                radius={(obs.radiusM || 1.0) + 0.3}
                pathOptions={{
                  color: isSelected ? "#00d8b8" : "#f43f5e",
                  fillColor: isSelected ? "#00d8b8" : "#f43f5e",
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
                    isSelected ? "border-[#00d8b8] bg-white text-[#009b84]" : "border-rose-300 bg-white text-rose-700"
                  } px-2 py-1 text-[11px] font-bold shadow-sm -translate-x-1/2 -translate-y-1/2">
                    <span class="h-2 w-2 rounded-full ${isSelected ? "bg-[#00d8b8] animate-ping" : "bg-rose-500"}"></span>
                    <span>${obs.name || "Obstáculo"}</span>
                    <span class="text-[9px] text-slate-500">${(obs.radiusM || 1.0).toFixed(1)}m</span>
                  </div>`,
                  iconSize: [0, 0],
                })}
              />
            );
          })}
        </Pane>

        {/* 10. Camada de Mapa de Calor de Irradiação */}
        {viewMode === "irradiation" && (
          <Pane name="solar-irradiation-pane" style={{ zIndex: 430, pointerEvents: "none" }}>
            {areas.map((a) => (
              <Polygon
                key={`irrad-${a.id}`}
                positions={toLeafletPositions(a.polygon)}
                interactive={false}
                pathOptions={{
                  color: "#f59e0b",
                  fillColor: "#f59e0b",
                  fillOpacity: 0.35,
                  weight: 2,
                }}
              />
            ))}
          </Pane>
        )}
      </MapContainer>

      {/* Miniaturas / Seletor de Camadas Compacto (Bottom-Left) */}
      <div className="absolute bottom-4 left-4 z-[500] flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
        <button
          type="button"
          onClick={() => onViewModeChange?.("map")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition ${
            viewMode === "map"
              ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Satélite</span>
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange?.("irradiation")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-bold transition ${
            viewMode === "irradiation"
              ? "bg-amber-400 text-slate-950 font-black shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span>Irradiação</span>
        </button>
      </div>
    </div>
  );
}
