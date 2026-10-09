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
  moveVertex,
  normalizeRoofPolygon,
} from "@/lib/solarDesignerGeometry";

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

// Cores realistas de silício fotovoltaico mono-PERC com micro-variação óptica sutil
export const PHOTOVOLTAIC_BASE_COLORS = [
  "#112136", // Deep mono-PERC obsidian navy
  "#14263d", // Rich marine photovoltaic
  "#0f1e31", // Deep dark silicon
  "#162a43", // Technical mono-crystalline blue
  "#122238", // Classic mono-PERC
  "#152840", // Deep blue-gray silicon
];

function toLeafletPositions(points) {
  return normalizeRoofPolygon(points).map((point) => [point.lat, point.lng]);
}

function interpolateLatLng(start, end, ratio) {
  return {
    lat: start.lat + (end.lat - start.lat) * ratio,
    lng: start.lng + (end.lng - start.lng) * ratio,
  };
}

/**
 * Gera as divisões internas realistas das células fotovoltaicas (half-cell matrix).
 * Identifica dinamicamente o eixo maior do módulo (comprimento) e traça a linha divisória
 * central longitudinal do half-cut e as divisões transversais das células com LOD.
 */
function buildRealisticPanelCellLines(panel, zoomLevel, highDetail = false) {
  if (!Array.isArray(panel) || panel.length < 4) return { primary: [] };
  const [p0, p1, p2, p3] = panel;

  // Distância aproximada ao quadrado para determinar eixo longo vs curto (orientação)
  const d01 = Math.pow(p1.lat - p0.lat, 2) + Math.pow(p1.lng - p0.lng, 2);
  const d12 = Math.pow(p2.lat - p1.lat, 2) + Math.pow(p2.lng - p1.lng, 2);

  const primary = [];

  if (d12 >= d01) {
    // Orientação Vertical / Retrato (arestas 0-3 e 1-2 são mais longas)
    // 1. Linha central longitudinal do half-cut
    primary.push([interpolateLatLng(p0, p1, 0.5), interpolateLatLng(p3, p2, 0.5)]);

    // 2. Divisores transversais de células (6 linhas = 5 divisórias)
    const rows = 6;
    for (let i = 1; i < rows; i++) {
      const ratio = i / rows;
      primary.push([interpolateLatLng(p0, p3, ratio), interpolateLatLng(p1, p2, ratio)]);
    }

    // 3. Detalhes finos de busbars para zoom próximo (zoom >= 20)
    if (highDetail) {
      primary.push([interpolateLatLng(p0, p1, 0.25), interpolateLatLng(p3, p2, 0.25)]);
      primary.push([interpolateLatLng(p0, p1, 0.75), interpolateLatLng(p3, p2, 0.75)]);
    }
  } else {
    // Orientação Horizontal / Paisagem (arestas 0-1 e 3-2 são mais longas)
    // 1. Linha central longitudinal do half-cut
    primary.push([interpolateLatLng(p0, p3, 0.5), interpolateLatLng(p1, p2, 0.5)]);

    // 2. Divisores transversais de células (6 colunas = 5 divisórias)
    const cols = 6;
    for (let i = 1; i < cols; i++) {
      const ratio = i / cols;
      primary.push([interpolateLatLng(p0, p1, ratio), interpolateLatLng(p3, p2, ratio)]);
    }

    // 3. Detalhes finos de busbars para zoom próximo (zoom >= 20)
    if (highDetail) {
      primary.push([interpolateLatLng(p0, p3, 0.25), interpolateLatLng(p1, p2, 0.25)]);
      primary.push([interpolateLatLng(p0, p3, 0.75), interpolateLatLng(p1, p2, 0.75)]);
    }
  }

  return { primary };
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
            ? "bg-white/95 text-slate-900 border-2 border-[#00d8b8]"
            : "bg-white/80 text-slate-600 border border-slate-300"
        } px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap backdrop-blur-sm" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
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
            <div class="flex h-4 w-4 items-center justify-center rounded-full bg-[#00d8b8] text-slate-950 shadow-md border border-white transform hover:scale-125 transition-all">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <div class="absolute bottom-full mb-1.5 opacity-0 group-hover:opacity-100 whitespace-nowrap rounded-md bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#009b84] border border-[#00d8b8] shadow-xl backdrop-blur-md pointer-events-none transition-all scale-95 group-hover:scale-100 flex items-center gap-1 z-50">
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
              ? "bg-slate-900 text-white border-2 border-[#00d8b8] shadow-lg scale-105"
              : "bg-white/95 text-slate-800 border border-slate-300 hover:border-[#00d8b8] hover:scale-105"
          } px-2.5 py-1 rounded-md text-[11px] font-bold shadow-md backdrop-blur-md whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 transition-all">
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

function FloatingMapControls({ onFitRoof, hasRoof, onToggle3D }) {
  const map = useMap();

  return (
    <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-2xl backdrop-blur-md text-slate-700">
      <button
        type="button"
        title="Aproximar Zoom (+)"
        onClick={() => map.zoomIn()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition text-slate-700"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Afastar Zoom (-)"
        onClick={() => map.zoomOut()}
        className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition text-slate-700"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      {hasRoof && (
        <>
          <span className="h-px w-4 bg-slate-200 my-0.5" />
          <button
            type="button"
            title="Enquadrar Telhado"
            onClick={onFitRoof}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition text-[#009b84]"
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
          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 active:bg-slate-200 transition text-amber-600"
        >
          <Move3D className="h-3.5 w-3.5" />
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
                            ? `<div class="absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white border border-emerald-400 shadow-2xl backdrop-blur pointer-events-none">
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
    if (controlledPanelPolygons && controlledPanelPolygons.length > 0) {
      return [{ areaId: selectedArea?.id || "default", isSelected: true, panels: controlledPanelPolygons }];
    }
    if (areas.length > 0) {
      return areas.map((a) => ({
        areaId: a.id,
        isSelected: a.id === (selectedArea?.id || selectedAreaId),
        panels: a.panelPolygons || [],
      }));
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
  // - Zoom < 17: Sem linhas internas (modo visão geral leve e ultra-rápido)
  // - Zoom 17 a 19: Divisão longitudinal half-cut + 5 linhas transversais de células
  // - Zoom >= 20: Detalhamento completo com matriz de células + busbars secundárias
  const panelCellLines = useMemo(() => {
    if (currentZoom < 17) return [];
    const isLargeArray = allPanelsFlat.length > 250;
    const highDetail = currentZoom >= 20 && !isLargeArray;

    const allLines = [];
    for (let i = 0; i < allPanelsFlat.length; i++) {
      const res = buildRealisticPanelCellLines(allPanelsFlat[i], currentZoom, highDetail);
      if (res.primary && res.primary.length > 0) {
        allLines.push(...res.primary);
      }
    }

    return allLines.map(toLeafletPositions);
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
      {/* Banner Superior Flutuante de Instruções & Ações (Light Theme) */}
      {isDrawing ? (
        <div className="absolute top-3 inset-x-4 z-[500] flex items-center justify-between pointer-events-none animate-in slide-in-from-top-2">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl border border-[#00d8b8]/60 bg-white/95 px-3.5 py-1.5 text-xs text-slate-900 shadow-2xl backdrop-blur-md">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[#00d8b8] animate-ping" />
            <span className="font-bold text-[#009b84]">
              {drawingPoints.length === 0
                ? "Clique no 1º canto do telhado no mapa"
                : drawingPoints.length < 3
                ? `Canto #${drawingPoints.length + 1}: clique no próximo vértice`
                : `Demarcado (${drawingPoints.length} cantos · ~${liveDrawingArea.toFixed(1)} m²)`}
            </span>
            <span className="hidden lg:inline text-slate-500 text-[11px]">
              (Dica: clique no ponto verde #1 ou Enter para fechar)
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {drawingPoints.length >= 3 && (
              <button
                type="button"
                onClick={handleFinishDrawing}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-xs font-black text-white shadow-2xl transition active:scale-95"
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
                <span>Concluir Área ({drawingPoints.length} pts)</span>
              </button>
            )}

            {drawingPoints.length > 0 && (
              <button
                type="button"
                onClick={handleUndoDrawingPoint}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-xl transition"
                title="Desfazer último vértice (Backspace)"
              >
                <Undo2 className="h-3 w-3" />
                <span className="hidden sm:inline">Desfazer</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCancelDrawing}
              className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs font-bold text-rose-700 shadow-xl transition"
              title="Cancelar desenho (Esc)"
            >
              <X className="h-3.5 w-3.5" />
              <span>Cancelar</span>
            </button>
          </div>
        </div>
      ) : (
        /* Banner Superior Padrão de Status com Seletores de Área (Light Theme) */
        <div className="absolute top-3 inset-x-4 z-[500] pointer-events-none flex items-center justify-between">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3.5 py-1.5 text-xs text-slate-800 shadow-xl backdrop-blur-md">
            <Sun className="h-4 w-4 text-[#00d8b8]" />
            <span className="font-medium hidden md:inline">
              {editorMode === "measure"
                ? "Clique em dois pontos para medir a distância real no telhado."
                : "Clique em qualquer área solar para selecioná-la, configurar painéis ou alinhar à borda."}
            </span>
            <span className="font-medium md:hidden">Editor Fotovoltaico</span>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            {/* Seletor Rápido de Áreas */}
            {areas.length > 1 && (
              <div className="flex items-center gap-1 bg-white/95 p-1 rounded-xl border border-slate-200/90 shadow-xl backdrop-blur-md">
                {areas.map((a, idx) => {
                  const isSelected = a.id === selectedArea?.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onSelectArea?.(a.id)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                        isSelected
                          ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      {a.name || `Área ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            )}

            {hasRoof && (
              <div
                onClick={() => onSelectRoof?.()}
                className="cursor-pointer flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-800 shadow-xl backdrop-blur-md hover:bg-slate-50 transition"
                title="Clique para inspecionar esta área"
              >
                <span className="text-slate-500">◬ {selectedArea?.roof_pitch_deg ?? config.roof_pitch_deg ?? 0}°</span>
                <span className="h-3 w-px bg-slate-300" />
                <span className="text-[#009b84]">{Math.round(totalRoofArea)} m² ({areas.length || 1} {areas.length === 1 ? "área" : "áreas"})</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => onEditorModeChange?.(editorMode === "draw-polygon" ? "select" : "draw-polygon")}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-xl backdrop-blur-md transition ${
                isDrawing
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-[#00d8b8]/60 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              <Plus className="h-3.5 w-3.5 text-[#009b84]" />
              <span>+ Adicionar Área</span>
            </button>

            {isMeasuring && measureDistance !== null && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 shadow-xl backdrop-blur-md">
                <Ruler className="h-3.5 w-3.5 text-emerald-600" />
                <span>Distância: {Number(measureDistance || 0).toFixed(2)} m</span>
                <button
                  type="button"
                  onClick={() => setMeasurePoints([])}
                  className="ml-1 hover:text-slate-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
        <FloatingMapControls onFitRoof={onFitRoof} hasRoof={hasRoof} onToggle3D={onToggle3D} />

        {/* 1. Camada das Áreas Concluídas Não Selecionadas */}
        {!isDrawing && areas
          .filter((a) => a.id !== selectedArea?.id && a.polygon?.length >= 3)
          .map((area) => (
            <Polygon
              key={`inactive-area-${area.id}`}
              positions={toLeafletPositions(area.polygon)}
              eventHandlers={{
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onSelectArea?.(area.id);
                },
              }}
              pathOptions={{
                color: "#38bdf8",
                fillColor: "#0284c7",
                fillOpacity: 0.12,
                opacity: 0.75,
                weight: 2,
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

        {/* 4. Badges de Identificação de todas as Áreas */}
        {showBadges && !isDrawing && areas.map((area) => (
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

              // Paleta realista de silício mono-PERC com micro-variação óptica sutil
              const realisticSiliconColor = PHOTOVOLTAIC_BASE_COLORS[(globalIndex * 7 + 3) % PHOTOVOLTAIC_BASE_COLORS.length];

              // Moldura externa de alumínio anodizado escuro / grafite
              let strokeColor = group.isSelected ? "#1e293b" : "#334155";
              let fillColor = viewMode === "irradiation" ? "#00c853" : realisticSiliconColor;
              let opacity = group.isSelected ? 0.98 : 0.88;
              let fillOpacity = group.isSelected ? 0.96 : 0.85;
              let strokeWidth = group.isSelected ? 1.2 : 0.9;

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
                strokeColor = "#00d8b8";
                fillColor = "#1a3b5c";
                strokeWidth = 2.2;
                opacity = 1;
                fillOpacity = 1;
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
          
          {panelCellLines.length > 0 && viewMode !== "irradiation" && !electricalMode && (
            <Polyline
              positions={panelCellLines}
              interactive={false}
              pathOptions={{
                color: "#93c5fd",
                className: "solar-panel-cell-lines",
                opacity: currentZoom >= 20 ? 0.46 : 0.34,
                weight: currentZoom >= 20 ? 0.75 : 0.55,
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
                  } px-2 py-1 text-[11px] font-bold shadow-xl backdrop-blur -translate-x-1/2 -translate-y-1/2">
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

      {/* Rosa dos Ventos / Compass Overlay Minimalista (Top-Right Light) */}
      <div className="absolute top-16 right-4 z-[500] flex flex-col items-center gap-1 rounded-xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-md select-none text-slate-800">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute top-0 text-[7px] font-black text-rose-600">N</span>
          <span className="absolute right-0 text-[7px] font-bold text-slate-400">L</span>
          <span className="absolute bottom-0 text-[7px] font-bold text-slate-400">S</span>
          <span className="absolute left-0 text-[7px] font-bold text-slate-400">O</span>
          <div
            className="flex h-5 w-5 items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-4 w-4 text-[#00d8b8]" />
          </div>
        </div>
        <span className="text-[8.5px] font-bold text-[#009b84]">{azimuthInfo.formatted}</span>
      </div>

      {/* Miniaturas / Seletor de Camadas Compacto (Bottom-Left Light) */}
      <div className="absolute bottom-6 left-6 z-[500] flex items-center gap-1 bg-white/95 p-1 rounded-xl border border-slate-200/90 shadow-2xl backdrop-blur-md">
        <button
          type="button"
          onClick={() => onViewModeChange?.("map")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
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
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
            viewMode === "irradiation"
              ? "bg-amber-400 text-slate-950 font-black shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Flame className="h-3.5 w-3.5 text-amber-500" />
          <span>Irradiação</span>
        </button>
      </div>

      {/* HUD Flutuante Inferior (Light Theme) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-6 rounded-xl border border-slate-200/90 bg-white/95 px-6 py-2.5 text-slate-800 shadow-2xl backdrop-blur-md">
        {/* Coluna 1: Módulos FV Total/Área */}
        <div className="flex flex-col items-center min-w-[130px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">MÓDULOS FV TOTAL/ÁREA</span>
          <span className="text-sm font-black text-slate-900">
            {totalPanelCount} <span className="text-slate-400">/ {selectedPanelCount} na ativa</span>
          </span>
          <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalPanelCount > 0 ? "100%" : "0%" }} />
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        {/* Coluna 2: Potência CC Total/Área */}
        <div className="flex flex-col items-center min-w-[130px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">POTÊNCIA CC TOTAL</span>
          <span className="text-sm font-black text-slate-900">
            {totalDcPowerKw.toFixed(1)} <span className="text-slate-400">kWp ({selectedDcPowerKw.toFixed(1)} kWp ativa)</span>
          </span>
          <div className="mt-1 h-1 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: totalPanelCount > 0 ? "100%" : "0%" }} />
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200" />

        {/* Coluna 3: Produção Anual Est. */}
        <div className="flex flex-col items-center min-w-[140px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">PRODUÇÃO ANUAL TOTAL</span>
          <span className="text-sm font-black text-[#009b84]">
            {totalAnnualMwh.toFixed(2)} MWh/ano
          </span>
        </div>
      </div>
    </div>
  );
}
