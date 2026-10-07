import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import {
  AlertTriangle,
  Compass,
  Flame,
  Grid,
  Layers,
  Maximize2,
  Minus,
  Move3D,
  Plus,
  RotateCw,
  Sun,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
            ? "bg-slate-950/90 text-cyan-200 border border-cyan-400/50"
            : "bg-slate-950/70 text-white/80 border border-white/20"
        } px-1.5 py-0.5 rounded text-[10px] font-bold shadow-lg whitespace-nowrap backdrop-blur-sm" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
        iconSize: [70, 18],
        iconAnchor: [35, 9],
      })}
    />
  ));
}

/**
 * Vértice / Borda de alinhamento com tooltip interativo "Alinhar os módulos a esta borda."
 */
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
            <div class="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/90 text-slate-950 shadow-lg border-2 border-white ring-2 ring-cyan-500/40 transform hover:scale-125 transition-all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </div>
            <div class="absolute bottom-full mb-1.5 opacity-90 group-hover:opacity-100 whitespace-nowrap rounded-md bg-slate-950/95 px-2.5 py-1 text-[11px] font-bold text-cyan-200 border border-cyan-400/80 shadow-2xl backdrop-blur-md pointer-events-none transition-all scale-95 group-hover:scale-100 flex items-center gap-1">
              <span>Alinhar os módulos a esta borda.</span>
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
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
              ? "bg-slate-950/95 border-2 border-cyan-400 text-white shadow-cyan-500/20"
              : "bg-slate-950/80 border border-white/30 text-white/90 hover:border-cyan-300 hover:scale-105"
          } px-2.5 py-1 rounded-md text-[11px] font-bold shadow-xl backdrop-blur-md whitespace-nowrap flex items-center gap-1.5 -translate-x-1/2 -translate-y-1/2 transition-all">
            <span class="h-2 w-2 rounded-full ${isSelected ? "bg-cyan-400 animate-pulse" : "bg-emerald-400"}"></span>
            <span class="${isSelected ? "font-black text-cyan-300" : "font-bold"}">${area.name || "Área"}</span>
            <span class="text-white/40">·</span>
            <span class="text-[10px] text-white/80">${area.panelCount || (area.panelPolygons?.length || 0)} mods</span>
            <span class="text-[10px] text-white/50">(${Math.round(area.roof_area_m2 || 0)}m²)</span>
          </div>
        `,
        iconSize: [0, 0],
      })}
    />
  );
}

function MapViewportEvents({ onViewportChange, onMapClick, isDrawing }) {
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
      if (!isDrawing) {
        onMapClick?.(e.latlng);
      }
    },
  });

  return null;
}

function MapFitController({ areas, selectedArea, request }) {
  const map = useMap();
  const lastRequestRef = useRef(0);

  useEffect(() => {
    if (!request || request === lastRequestRef.current) return;
    lastRequestRef.current = request;

    // Enquadra a área selecionada ou todas as áreas juntas
    let pointsToFit = [];
    if (selectedArea?.polygon?.length >= 3) {
      pointsToFit = toLeafletPositions(selectedArea.polygon);
    } else if (areas?.length > 0) {
      pointsToFit = areas.flatMap((a) => toLeafletPositions(a.polygon || []));
    }

    if (pointsToFit.length >= 3) {
      map.fitBounds(L.latLngBounds(pointsToFit), {
        animate: true,
        maxZoom: 21,
        padding: [70, 70],
      });
    }
  }, [map, request, selectedArea, areas]);

  return null;
}

function FloatingMapControls({ onFitRoof, hasRoof, onToggle3D }) {
  const map = useMap();

  return (
    <div className="absolute bottom-6 right-6 z-[500] flex flex-col items-center gap-1.5 rounded-xl border border-white/15 bg-slate-900/90 p-1 shadow-2xl backdrop-blur-md text-white">
      <button
        type="button"
        title="Aproximar Zoom (+)"
        onClick={() => map.zoomIn()}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-white"
      >
        <Plus className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Afastar Zoom (-)"
        onClick={() => map.zoomOut()}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-white"
      >
        <Minus className="h-4 w-4" />
      </button>
      {hasRoof && (
        <>
          <span className="h-px w-5 bg-white/15 my-0.5" />
          <button
            type="button"
            title="Enquadrar Telhado"
            onClick={onFitRoof}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-cyan-300"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </>
      )}
      {onToggle3D && (
        <button
          type="button"
          title="Alternar Vista 3D"
          onClick={onToggle3D}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 active:bg-white/25 transition text-amber-300"
        >
          <Move3D className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function ActiveAreaEditorLayer({
  positions,
  mode,
  onChange,
  onCreate,
  onModeChange,
}) {
  const map = useMap();
  const layerRef = useRef(null);
  const syncingRef = useRef(false);
  const hasPositions = positions && positions.length >= 3;
  const positionKey = useMemo(
    () => (positions || []).map((point) => `${point.lat.toFixed(7)},${point.lng.toFixed(7)}`).join("|"),
    [positions]
  );

  // Manipulador de criação de nova área (desenhar polígono ou retângulo)
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
        onCreate?.(createdPositions);
        onModeChange?.("select");
      }
    };

    map.on("pm:create", handleCreate);

    return () => {
      map.off("pm:create", handleCreate);
      map.pm?.disableDraw();
    };
  }, [map, onCreate, onModeChange]);

  // Layer Leaflet para a área ativa selecionada
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
      fillOpacity: 0.20,
      opacity: 0.98,
      pane: "overlayPane",
      pmIgnore: false,
      weight: 2.6,
      dashArray: null,
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
    if (!layer || !positions?.length) return;

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
  onMapClick,
  showBadges = true,
  showMeasurements = true,
  showMiniMap = false,
}) {
  // Encontra a área atualmente selecionada
  const selectedArea = useMemo(
    () => areas.find((a) => a.id === selectedAreaId) || areas[0] || null,
    [areas, selectedAreaId]
  );

  const selectedRoofPolygon = useMemo(
    () => selectedArea?.polygon || normalizeRoofPolygon(config.roof_polygon),
    [selectedArea, config.roof_polygon]
  );

  const mapCenter = useMemo(() => getMapCenterFromConfig(config), [config]);
  const mapZoom = Math.max(3, Math.min(22, Math.round(Number(config.map_zoom) || DEFAULT_SOLAR_MAP_ZOOM)));
  const initialCenter = useMemo(
    () => [mapCenter?.lat || DEFAULT_SOLAR_MAP_CENTER.lat, mapCenter?.lng || DEFAULT_SOLAR_MAP_CENTER.lng],
    []
  );

  const activeAzimuth = selectedArea?.roof_rotation_deg ?? config.roof_rotation_deg ?? 24;
  const azimuthInfo = useMemo(() => getAzimuthWithCardinal(activeAzimuth), [activeAzimuth]);
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];
  const hasRoof = (areas.length > 0 && areas.some((a) => a.polygon?.length >= 3)) || selectedRoofPolygon.length >= 3;
  const isDrawing = editorMode === "draw-polygon" || editorMode === "draw-rectangle";

  // Reúne todos os painéis de todas as áreas
  const allAreasPanels = useMemo(() => {
    if (controlledPanelPolygons && controlledPanelPolygons.length > 0) {
      return [{ areaId: selectedArea?.id || "default", isSelected: true, panels: controlledPanelPolygons }];
    }
    return areas.map((a) => ({
      areaId: a.id,
      isSelected: a.id === (selectedArea?.id || selectedAreaId),
      panels: a.panelPolygons || [],
    }));
  }, [areas, controlledPanelPolygons, selectedArea, selectedAreaId]);

  const allPanelsFlat = useMemo(
    () => allAreasPanels.flatMap((group) => group.panels),
    [allAreasPanels]
  );

  const allPanelCellLines = useMemo(
    () => allPanelsFlat.flatMap(buildPanelCellLines).map(toLeafletPositions),
    [allPanelsFlat]
  );

  const totalPanelCount = allPanelsFlat.length;
  const selectedPanelCount = selectedArea?.panelCount || (selectedArea?.panelPolygons?.length || 0);
  const moduleWp = Number(config.module_wp) || 540;
  const totalDcPowerKw = (totalPanelCount * moduleWp) / 1000;
  const selectedDcPowerKw = (selectedPanelCount * moduleWp) / 1000;
  const totalAnnualMwh = totalDcPowerKw * 1.36;

  const totalRoofArea = useMemo(
    () => areas.reduce((sum, a) => sum + (a.roof_area_m2 || 0), 0) || (selectedArea?.roof_area_m2 || 0),
    [areas, selectedArea]
  );

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
      {/* Top Banner de Notificação & Instruções */}
      <div className="absolute top-3 inset-x-4 z-[500] pointer-events-none flex items-center justify-between">
        <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-1.5 text-xs text-white/90 shadow-2xl backdrop-blur-md">
          <Sun className="h-4 w-4 text-cyan-400" />
          {isDrawing ? (
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <span>Demarcando nova área solar: clique nos cantos do telhado para definir o polígono.</span>
              <button
                type="button"
                onClick={() => onEditorModeChange?.("select")}
                className="ml-2 rounded-md bg-white/10 px-2 py-0.5 text-xs text-white hover:bg-white/20 transition"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <span className="font-medium hidden md:inline">
              Clique em qualquer área solar para selecioná-la, configurar painéis ou alinhar à borda.
            </span>
          )}
          {!isDrawing && <span className="font-medium md:hidden">Clique para selecionar área.</span>}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          {/* Seletor Rápido de Áreas */}
          {areas.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-white/10 shadow-2xl backdrop-blur-md">
              {areas.map((a, idx) => {
                const isSelected = a.id === selectedArea?.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelectArea?.(a.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
                      isSelected
                        ? "bg-cyan-500 text-slate-950 font-black shadow"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {a.name || `Área ${idx + 1}`}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md">
            <span className="text-white/60">◬ {selectedArea?.roof_pitch_deg ?? config.roof_pitch_deg ?? 0}°</span>
            <span className="h-3 w-px bg-white/15" />
            <span className="text-cyan-300">{Math.round(totalRoofArea)} m² ({areas.length || 1} áreas)</span>
          </div>

          <button
            type="button"
            onClick={() => onEditorModeChange?.(editorMode === "draw-polygon" ? "select" : "draw-polygon")}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black shadow-2xl backdrop-blur-md transition ${
              isDrawing
                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                : "border-cyan-500/30 bg-cyan-950/80 text-cyan-300 hover:bg-cyan-900/80"
            }`}
          >
            <Plus className="h-3.5 w-3.5 text-cyan-400" />
            <span>+ Adicionar Área</span>
          </button>
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
        <MapFitController areas={areas} selectedArea={selectedArea} request={fitRoofRequest} />
        <MapViewportEvents onViewportChange={onViewportChange} onMapClick={onMapClick} isDrawing={isDrawing} />
        <FloatingMapControls onFitRoof={onFitRoof} hasRoof={hasRoof} onToggle3D={onToggle3D} />

        {/* 1. Camada das Áreas Concluídas Não Selecionadas */}
        {areas
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

        {/* 2. Camada da Área Ativa com Geoman habilitado */}
        <ActiveAreaEditorLayer
          positions={selectedRoofPolygon}
          mode={editorMode}
          onChange={onRoofChange}
          onCreate={onCreateArea}
          onModeChange={onEditorModeChange}
        />

        {/* 3. Badges de Identificação de todas as Áreas */}
        {areas.map((area) => (
          <AreaBadge
            key={`badge-${area.id}`}
            area={area}
            isSelected={area.id === selectedArea?.id}
            onClick={() => onSelectArea?.(area.id)}
          />
        ))}

        {/* 4. Medições de arestas na área ativa */}
        {showMeasurements && selectedRoofPolygon?.length >= 3 && (
          <MeasurementLabels roofPolygon={selectedRoofPolygon} isSelected={true} />
        )}

        {/* 5. Alinhamento de bordas na área ativa */}
        {hasRoof && selectedRoofPolygon?.length >= 3 && onAlignToEdge && (
          <EdgeAlignmentLayer roofPolygon={selectedRoofPolygon} onAlignToEdge={onAlignToEdge} />
        )}

        {/* 6. Camada de Módulos Fotovoltaicos de TODAS as áreas */}
        <Pane name="solar-panels-pane" style={{ zIndex: 440, pointerEvents: "none" }}>
          {allAreasPanels.map((group) =>
            group.panels.map((panel, idx) => (
              <Polygon
                key={`panel-${group.areaId}-${idx}`}
                positions={toLeafletPositions(panel)}
                interactive={false}
                pmIgnore
                pathOptions={{
                  color: group.isSelected ? "#7dd3fc" : "#38bdf8",
                  className: "solar-panel-shape",
                  fillColor: viewMode === "irradiation" ? "#00c853" : group.isSelected ? "#0284c7" : "#0369a1",
                  fillOpacity: group.isSelected ? 0.95 : 0.85,
                  opacity: 0.9,
                  weight: group.isSelected ? 0.9 : 0.7,
                }}
              />
            ))
          )}
          {allPanelCellLines.length > 0 && viewMode !== "irradiation" && (
            <Polyline
              positions={allPanelCellLines}
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

        {/* 7. Camada de Obstáculos Interativos */}
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

        {/* 8. Camada de Mapa de Calor de Irradiação */}
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

      {/* Rosa dos Ventos / Compass Overlay Minimalista */}
      <div className="absolute top-16 right-4 z-[500] flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md select-none text-white">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <span className="absolute top-0 text-[8px] font-black text-rose-400">N</span>
          <span className="absolute right-0 text-[8px] font-bold text-white/60">L</span>
          <span className="absolute bottom-0 text-[8px] font-bold text-white/60">S</span>
          <span className="absolute left-0 text-[8px] font-bold text-white/60">O</span>
          <div
            className="flex h-7 w-7 items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-5 w-5 text-cyan-400" />
          </div>
        </div>
        <span className="text-[9px] font-bold text-cyan-300">{azimuthInfo.formatted}</span>
      </div>

      {/* Miniaturas de Camadas no Canto Inferior Esquerdo (Satélite / Irradiância) */}
      <div className="absolute bottom-6 left-6 z-[500] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {}}
          className="flex flex-col items-center justify-center h-14 w-14 rounded-xl border-2 border-cyan-400/80 bg-slate-900/90 shadow-2xl backdrop-blur p-1 text-[9px] font-black text-white hover:border-cyan-300 transition"
        >
          <Layers className="h-5 w-5 text-cyan-400 mb-0.5" />
          <span>Satélite</span>
        </button>
        <button
          type="button"
          onClick={() => {}}
          className="flex flex-col items-center justify-center h-14 w-14 rounded-xl border border-white/20 bg-slate-900/90 shadow-2xl backdrop-blur p-1 text-[9px] font-bold text-white/80 hover:border-white/50 transition"
        >
          <Flame className="h-5 w-5 text-amber-400 mb-0.5" />
          <span>Irradiância</span>
        </button>
      </div>

      {/* HUD Flutuante Inferior Dark */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-6 rounded-xl border border-white/15 bg-[#0a111e]/95 px-6 py-2.5 text-white shadow-2xl backdrop-blur-md">
        {/* Coluna 1: Módulos FV Total/Facet */}
        <div className="flex flex-col items-center min-w-[130px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">MÓDULOS FV TOTAL/ÁREA</span>
          <span className="text-sm font-black text-white">
            {totalPanelCount} <span className="text-white/40">/ {selectedPanelCount} na ativa</span>
          </span>
          <div className="mt-1 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: totalPanelCount > 0 ? "100%" : "0%" }} />
          </div>
        </div>

        <div className="h-8 w-px bg-white/10" />

        {/* Coluna 2: Potência CC Total/Facet */}
        <div className="flex flex-col items-center min-w-[130px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">POTÊNCIA CC TOTAL</span>
          <span className="text-sm font-black text-white">
            {totalDcPowerKw.toFixed(1)} <span className="text-white/40">kWp ({selectedDcPowerKw.toFixed(1)} kWp ativa)</span>
          </span>
          <div className="mt-1 h-1 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-emerald-400 rounded-full" style={{ width: totalPanelCount > 0 ? "100%" : "0%" }} />
          </div>
        </div>

        <div className="h-8 w-px bg-white/10" />

        {/* Coluna 3: Produção Anual Est. */}
        <div className="flex flex-col items-center min-w-[140px]">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">PRODUÇÃO ANUAL TOTAL</span>
          <span className="text-sm font-black text-cyan-300">
            {totalAnnualMwh.toFixed(2)} MWh/ano
          </span>
        </div>
      </div>
    </div>
  );
}
