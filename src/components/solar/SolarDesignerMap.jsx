import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { AlertTriangle, Compass, Flame, Maximize2, Minus, Move3D, Plus, RotateCw, Sun, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  buildPanelPolygons,
  distanceMeters,
  edgeRotationDegrees,
  getAzimuthWithCardinal,
  getMapCenterFromConfig,
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

function MeasurementLabels({ roofPolygon }) {
  const labels = useMemo(() => {
    const points = normalizeRoofPolygon(roofPolygon);
    if (points.length < 2) return [];

    return points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const distance = distanceMeters(point, next);
      if (distance < 1.2) return null;

      const rawRotation = edgeRotationDegrees(point, next);
      const readableRotation = rawRotation > 90 || rawRotation < -90 ? rawRotation + 180 : rawRotation;
      const midpoint = {
        lat: (point.lat + next.lat) / 2,
        lng: (point.lng + next.lng) / 2,
      };

      return {
        id: `measure-${index}`,
        midpoint,
        rotation: readableRotation,
        label: `${distance.toFixed(distance >= 10 ? 2 : 1)} m`,
      };
    }).filter(Boolean);
  }, [roofPolygon]);

  return labels.map((item) => (
    <Marker
      key={item.id}
      position={[item.midpoint.lat, item.midpoint.lng]}
      interactive={false}
      icon={L.divIcon({
        className: "solar-measure-label",
        html: `<span class="bg-slate-900/90 text-white border border-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-md whitespace-nowrap" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      })}
    />
  ));
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

function FloatingMapControls({ onFitRoof, hasRoof }) {
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
  panelPolygons: controlledPanelPolygons,
  onEditorModeChange,
  onRoofChange,
  onViewportChange,
  onFitRoof,
  onUpdateObstacle,
  onSelectObstacle,
  onRemoveObstacle,
  onMapClick,
  showBadges = true,
  showMeasurements = true,
  showMiniMap = false,
}) {
  const roofPolygon = useMemo(() => getRoofPolygonFromConfig(config), [config]);
  const generatedPanelPolygons = useMemo(() => buildPanelPolygons(config, sizing), [config, sizing]);
  const panelPolygons = controlledPanelPolygons || generatedPanelPolygons;
  const panelCellLines = useMemo(
    () => panelPolygons.flatMap(buildPanelCellLines).map(toLeafletPositions),
    [panelPolygons]
  );
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

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
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
        <MapViewportEvents onViewportChange={onViewportChange} onMapClick={onMapClick} isDrawing={isDrawing} />
        <FloatingMapControls onFitRoof={onFitRoof} hasRoof={hasRoof} />
        
        <RoofEditorLayer
          positions={roofPolygon}
          mode={editorMode}
          onChange={onRoofChange}
          onModeChange={onEditorModeChange}
        />
        {showMeasurements && <MeasurementLabels roofPolygon={roofPolygon} />}

        {/* Camada de Módulos Fotovoltaicos */}
        <Pane name="solar-panels-pane" style={{ zIndex: 440, pointerEvents: "none" }}>
          {panelPolygons.map((panel, index) => (
            <Polygon
              key={`panel-${index}`}
              positions={toLeafletPositions(panel)}
              interactive={false}
              pmIgnore
              pathOptions={{
                color: "#99d1ff",
                className: "solar-panel-shape",
                fillColor: viewMode === "irradiation" ? "#00c853" : "#0d3b82",
                fillOpacity: 0.96,
                opacity: 0.88,
                weight: 0.8,
              }}
            />
          ))}
          {panelCellLines.length > 0 && viewMode !== "irradiation" && (
            <Polyline
              positions={panelCellLines}
              interactive={false}
              pmIgnore
              pathOptions={{
                color: "#93b9eb",
                className: "solar-panel-cell-lines",
                opacity: 0.35,
                weight: 0.4,
              }}
            />
          )}
        </Pane>

        {/* Camada de Obstáculos Interativos (com suporte a arrasto e ajuste) */}
        <Pane name="solar-obstacles-pane" style={{ zIndex: 450 }}>
          {obstacles.map((obs) => {
            const isSelected = selectedObstacleId === obs.id;
            return (
              <Circle
                key={`zone-${obs.id}`}
                center={[obs.lat, obs.lng]}
                radius={(obs.radiusM || 1.0) + 0.3} // Margem de segurança de 0.30m
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

      {/* Rosa dos Ventos / Compass Overlay Minimalista */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col items-center gap-1 rounded-xl border border-white/15 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md select-none text-white">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute top-0 text-[9px] font-black text-rose-400">N</span>
          <span className="absolute right-0 text-[9px] font-bold text-white/60">L</span>
          <span className="absolute bottom-0 text-[9px] font-bold text-white/60">S</span>
          <span className="absolute left-0 text-[9px] font-bold text-white/60">O</span>
          <div
            className="flex h-8 w-8 items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-6 w-6 text-primary" />
          </div>
        </div>
        <span className="text-[10px] font-bold text-primary">{azimuthInfo.formatted}</span>
      </div>

      {/* Trajetória Solar no modo "Sombras" */}
      {viewMode === "shadows" && (
        <div className="pointer-events-none absolute inset-x-8 top-6 z-[500] flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30 shadow-lg backdrop-blur">
            <Sun className="h-3.5 w-3.5" /> 06:00 (Nascente L)
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 shadow-lg animate-pulse">
            <Sun className="h-3.5 w-3.5" /> 12:00 (Zênite Solar)
          </div>
          <div className="flex items-center gap-1.5 rounded-lg bg-slate-900/90 px-3 py-1.5 text-xs font-bold text-amber-300 border border-amber-500/30 shadow-lg backdrop-blur">
            <Sun className="h-3.5 w-3.5" /> 18:00 (Poente O)
          </div>
        </div>
      )}

      {/* Legenda de Irradiação no modo "Irradiação" */}
      {viewMode === "irradiation" && (
        <div className="absolute bottom-6 left-6 z-[500] rounded-xl border border-white/15 bg-slate-900/90 p-3 text-white shadow-2xl backdrop-blur-md">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-white/70 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-400" /> Irradiação anual (kWh/m²)
          </p>
          <div className="space-y-1 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-3.5 rounded bg-[#ef4444]" />
              <span>1.800 (melhor)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-3.5 rounded bg-[#f97316]" />
              <span>1.600</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-3.5 rounded bg-[#eab308]" />
              <span>1.400</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-3.5 rounded bg-[#22c55e]" />
              <span>1.200</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-3.5 rounded bg-[#3b82f6]" />
              <span>1.000 (menor)</span>
            </div>
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="pointer-events-none absolute bottom-0 left-0 z-[500] rounded-tr-md bg-slate-900/80 px-2 py-0.5 text-[9px] font-semibold text-white/50">
        Google Maps Satélite · VOLTAI Solar
      </div>
    </div>
  );
}
