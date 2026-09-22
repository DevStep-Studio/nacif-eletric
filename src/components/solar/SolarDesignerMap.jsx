import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { AlertTriangle, Compass, Flame, Move3D, Sun, X } from "lucide-react";
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

const SATELLITE_TILE_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const SATELLITE_ATTRIBUTION = "Tiles &copy; Esri";

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

function ViewportController({ center, zoom }) {
  const map = useMap();
  const lastKeyRef = useRef("");

  useEffect(() => {
    const nextKey = `${center.lat.toFixed(7)}:${center.lng.toFixed(7)}:${zoom}`;
    if (lastKeyRef.current === nextKey) return;

    lastKeyRef.current = nextKey;
    const currentCenter = map.getCenter();
    const centerDelta = Math.abs(currentCenter.lat - center.lat) + Math.abs(currentCenter.lng - center.lng);

    if (centerDelta > 0.00002 || Math.abs(map.getZoom() - zoom) > 1) {
      map.flyTo([center.lat, center.lng], zoom, { animate: false });
    }
  }, [center, map, zoom]);

  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80);
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
        html: `<span class="bg-slate-900/90 text-white border border-white/30 px-1.5 py-0.5 rounded text-[11px] font-black shadow-md whitespace-nowrap" style="transform: rotate(${item.rotation}deg); display: inline-block;">${item.label}</span>`,
        iconSize: [80, 20],
        iconAnchor: [40, 10],
      })}
    />
  ));
}

function MapViewportEvents({ onViewportChange }) {
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
      animate: false,
      maxZoom: 21,
      padding: [70, 70],
    });
  }, [map, request, roofPolygon]);

  return null;
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
      fillOpacity: 0.18,
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
  panelPolygons: controlledPanelPolygons,
  onEditorModeChange,
  onRoofChange,
  onViewportChange,
  onRemoveObstacle,
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
  const mapZoom = Math.max(16, Math.min(22, Math.round(Number(config.map_zoom) || DEFAULT_SOLAR_MAP_ZOOM)));
  const initialCenter = useMemo(
    () => [mapCenter?.lat || DEFAULT_SOLAR_MAP_CENTER.lat, mapCenter?.lng || DEFAULT_SOLAR_MAP_CENTER.lng],
    []
  );

  const azimuthInfo = useMemo(() => getAzimuthWithCardinal(config.roof_rotation_deg || 24), [config.roof_rotation_deg]);
  const obstacles = Array.isArray(config.obstacles) ? config.obstacles : [];

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${className}`}>
      <MapContainer
        attributionControl={false}
        center={initialCenter}
        zoom={mapZoom}
        minZoom={15}
        maxZoom={22}
        zoomControl={false}
        className={`solar-designer-map h-full w-full ${designerMode ? "solar-designer-map--edge" : ""}`}
      >
        <TileLayer url={SATELLITE_TILE_URL} attribution={SATELLITE_ATTRIBUTION} maxNativeZoom={19} maxZoom={22} />
        <ZoomControl position="bottomright" />
        <ViewportController center={mapCenter} zoom={mapZoom} />
        <MapFitController roofPolygon={roofPolygon} request={fitRoofRequest} />
        <MapViewportEvents onViewportChange={onViewportChange} />
        
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

        {/* Camada de Obstáculos Detectados / Cadastrados */}
        <Pane name="solar-obstacles-pane" style={{ zIndex: 450 }}>
          {obstacles.map((obs) => (
            <Circle
              key={obs.id}
              center={[obs.lat, obs.lng]}
              radius={obs.radiusM || 1.0}
              pathOptions={{
                color: "#ef4444",
                fillColor: "#ef4444",
                fillOpacity: 0.45,
                weight: 2,
                dashArray: "3 3",
              }}
            />
          ))}
          {obstacles.map((obs) => (
            <Marker
              key={`marker-${obs.id}`}
              position={[obs.lat, obs.lng]}
              interactive
              icon={L.divIcon({
                className: "solar-obstacle-label",
                html: `<div class="bg-red-950/90 text-red-200 border border-red-500/80 px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1 whitespace-nowrap -translate-x-1/2 -translate-y-1/2">
                  <span>${obs.name || "Obstáculo"}</span>
                </div>`,
                iconSize: [0, 0],
              })}
            />
          ))}
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

      {/* Rosa dos Ventos / Compass Overlay */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col items-center gap-1 rounded-2xl border border-white/20 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-md select-none text-white">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute top-0 text-[10px] font-black text-red-400">N</span>
          <span className="absolute right-0 text-[10px] font-black text-white/70">L</span>
          <span className="absolute bottom-0 text-[10px] font-black text-white/70">S</span>
          <span className="absolute left-0 text-[10px] font-black text-white/70">O</span>
          <div
            className="flex h-10 w-10 items-center justify-center transition-transform duration-500"
            style={{ transform: `rotate(${-azimuthInfo.degrees}deg)` }}
          >
            <Compass className="h-8 w-8 text-primary" />
          </div>
        </div>
        <span className="text-[10px] font-black text-primary">{azimuthInfo.formatted}</span>
      </div>

      {/* Trajetória Solar no modo "Sombras" */}
      {viewMode === "shadows" && (
        <div className="pointer-events-none absolute inset-x-8 top-12 z-[500] flex items-center justify-between">
          <div className="flex items-center gap-1.5 rounded-full bg-amber-950/80 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/40 shadow-lg backdrop-blur">
            <Sun className="h-4 w-4" /> 06:00 (Nascente L)
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-amber-950 shadow-lg animate-pulse">
            <Sun className="h-4 w-4" /> 12:00 (Zênite Solar)
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-950/80 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/40 shadow-lg backdrop-blur">
            <Sun className="h-4 w-4" /> 18:00 (Poente O)
          </div>
        </div>
      )}

      {/* Legenda de Irradiação no modo "Irradiação" */}
      {viewMode === "irradiation" && (
        <div className="absolute bottom-12 left-4 z-[500] rounded-2xl border border-white/20 bg-slate-900/90 p-3 text-white shadow-2xl backdrop-blur-md">
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-amber-400" /> Irradiação anual (kWh/m²)
          </p>
          <div className="space-y-1 text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded bg-[#ef4444]" />
              <span>1.800 (melhor)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded bg-[#f97316]" />
              <span>1.600</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded bg-[#eab308]" />
              <span>1.400</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded bg-[#22c55e]" />
              <span>1.200</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-4 rounded bg-[#3b82f6]" />
              <span>1.000 (menor)</span>
            </div>
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className="pointer-events-none absolute bottom-0 right-4 z-[500] rounded-t-[2px] bg-slate-900/80 px-2 py-0.5 text-[9px] font-semibold text-white/70">
        Leaflet · Imagens © Esri
      </div>
    </div>
  );
}
