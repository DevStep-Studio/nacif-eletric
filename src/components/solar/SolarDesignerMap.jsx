import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Pane, Polygon, Polyline, TileLayer, ZoomControl, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { Move3D } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_SOLAR_MAP_CENTER,
  DEFAULT_SOLAR_MAP_ZOOM,
  buildPanelPolygons,
  distanceMeters,
  edgeRotationDegrees,
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
        label: `${distance.toFixed(distance >= 10 ? 2 : 1)}m`,
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
        html: `<span style="transform: rotate(${item.rotation}deg)">${item.label}</span>`,
        iconSize: [72, 18],
        iconAnchor: [36, 9],
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
      color: "#f3ce67",
      fillColor: "#d8cfb9",
      fillOpacity: 0.3,
      opacity: 0.96,
      pane: "overlayPane",
      pmIgnore: false,
      weight: 1.8,
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
  className = "h-[520px]",
  designerMode = false,
  editorMode = "select",
  fitRoofRequest = 0,
  panelPolygons: controlledPanelPolygons,
  onEditorModeChange,
  onRoofChange,
  onViewportChange,
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

        <Pane name="solar-panels-pane" style={{ zIndex: 440, pointerEvents: "none" }}>
          {panelPolygons.map((panel, index) => (
            <Polygon
              key={`panel-${index}`}
              positions={toLeafletPositions(panel)}
              interactive={false}
              pmIgnore
              pathOptions={{
                color: "#a8c5ed",
                className: "solar-panel-shape",
                fillColor: "#16458f",
                fillOpacity: 0.97,
                opacity: 0.82,
                weight: 0.5,
              }}
            />
          ))}
          {panelCellLines.length > 0 && (
            <Polyline
              positions={panelCellLines}
              interactive={false}
              pmIgnore
              pathOptions={{
                color: "#93b9eb",
                className: "solar-panel-cell-lines",
                opacity: 0.28,
                weight: 0.3,
              }}
            />
          )}
        </Pane>
      </MapContainer>

      <div className="pointer-events-none absolute bottom-0 right-4 z-[500] rounded-t-[2px] bg-white/75 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#334155]">
        Leaflet · Imagens © Esri
      </div>

      {showBadges && (
        <div className="pointer-events-none absolute left-4 top-4 z-[500] flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
          <Badge className="rounded-lg bg-white/95 px-3 py-1 text-slate-900 shadow">
            <Move3D className="mr-1 h-3.5 w-3.5 text-[#00d8b8]" />
            Area solar
          </Badge>
          <Badge className="rounded-lg bg-white/95 px-3 py-1 text-slate-900 shadow">
            {sizing.panelCount} modulos · {sizing.dcPowerKw.toFixed(2)} kWp
          </Badge>
        </div>
      )}

      {showMiniMap && (
        <div className="absolute bottom-4 right-4 z-[500] hidden h-[158px] w-[270px] overflow-hidden rounded-[3px] border-2 border-[#1c2c45] bg-slate-900 shadow-[0_18px_48px_rgba(0,0,0,0.38)] xl:block">
          <MapContainer
            center={initialCenter}
            zoom={Math.max(15, mapZoom - 2)}
            attributionControl={false}
            boxZoom={false}
            className="solar-designer-mini-map h-full w-full"
            doubleClickZoom={false}
            dragging={false}
            keyboard={false}
            scrollWheelZoom={false}
            touchZoom={false}
            zoomControl={false}
          >
            <TileLayer url={SATELLITE_TILE_URL} maxNativeZoom={19} maxZoom={22} />
            <ViewportController center={mapCenter} zoom={Math.max(15, mapZoom - 2)} />
            <Polygon
              positions={toLeafletPositions(roofPolygon)}
              interactive={false}
              pathOptions={{ color: "#ffffff", fillColor: "#d9d3c3", fillOpacity: 0.24, opacity: 0.95, weight: 1.25 }}
            />
          </MapContainer>
        </div>
      )}

    </div>
  );
}
