import { useCallback, useMemo, useState } from "react";
import SolarDesignerMap from "@/components/solar/SolarDesignerMap";
import {
  normalizeRoofPolygon,
  serializeRoofPolygon,
  getRoofMetricsFromPolygon,
} from "@/lib/solarDesignerGeometry";
import { getEffectivePanelCount, getRoofPhysicalLayout } from "@/lib/solarWizardState";
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Home,
  Info,
  Layers,
  Maximize2,
  Pencil,
  RotateCw,
  Square,
  Trash2,
} from "lucide-react";

const TOOLS = [
  { mode: "select", icon: Home, label: "Navegar" },
  { mode: "draw-polygon", icon: Home, label: "Desenhar contorno" },
  { mode: "draw-rectangle", icon: Square, label: "Desenhar retângulo" },
  { mode: "edit", icon: Pencil, label: "Editar vértices", requiresRoof: true },
  { mode: "rotate", icon: RotateCw, label: "Girar telhado", requiresRoof: true },
];

export default function StepTelhado({ state, onChange }) {
  const [editorMode, setEditorMode] = useState(state.roof_defined ? "select" : "draw-polygon");
  const [fitRequest, setFitRequest] = useState(0);

  const hasRoof = normalizeRoofPolygon(state.roof_polygon).length >= 3 && state.roof_defined !== false;
  const roofLayout = useMemo(() => getRoofPhysicalLayout(state), [state]);
  const { panelCount, physicalCapacity, requested, fits } = useMemo(() => getEffectivePanelCount(state), [state]);
  const visiblePanels = useMemo(() => roofLayout.panels.slice(0, panelCount), [roofLayout.panels, panelCount]);

  const handleRoofChange = useCallback((positions) => {
    const normalized = serializeRoofPolygon(normalizeRoofPolygon(positions));
    if (normalized.length < 3) {
      onChange({ roof_defined: false, roof_polygon: [] });
      return;
    }
    const metrics = getRoofMetricsFromPolygon(normalized, state);
    onChange({
      roof_defined: true,
      roof_polygon: normalized,
      roof_width_m: Math.round(metrics.widthM * 10) / 10,
      roof_height_m: Math.round(metrics.heightM * 10) / 10,
      roof_area_m2: Math.round(metrics.areaM2 * 10) / 10,
      roof_rotation_deg: Math.round(metrics.rotationDeg * 10) / 10,
      map_center_lat: metrics.center.lat,
      map_center_lng: metrics.center.lng,
    });
  }, [onChange, state]);

  const clearRoof = () => {
    onChange({ roof_defined: false, roof_polygon: [] });
    setEditorMode("draw-polygon");
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ferramentas do Telhado */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {TOOLS.map(({ mode, icon: Icon, label, requiresRoof }) => (
            <button
              key={mode}
              type="button"
              title={label}
              disabled={requiresRoof && !hasRoof}
              onClick={() => setEditorMode(mode)}
              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-extrabold transition ${
                editorMode === mode
                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                  : "border-transparent text-slate-600 hover:bg-slate-100"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFitRequest((n) => n + 1)}
            disabled={!hasRoof}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Maximize2 className="h-3.5 w-3.5" /> Enquadrar
          </button>
          <button
            type="button"
            onClick={clearRoof}
            disabled={!hasRoof}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-extrabold text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
      </div>

      {/* Canvas do Telhado sobre o Mapa Satélite */}
      <div className="relative h-[430px] overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <SolarDesignerMap
          className="h-full w-full"
          config={state}
          sizing={{ panelCount, dcPowerKw: (panelCount * state.module_wp) / 1000 }}
          editorMode={editorMode}
          fitRoofRequest={fitRequest}
          panelPolygons={visiblePanels}
          showBadges={false}
          showMeasurements
          onEditorModeChange={setEditorMode}
          onRoofChange={handleRoofChange}
          onViewportChange={({ center, zoom }) => onChange({ map_center_lat: center.lat, map_center_lng: center.lng, map_zoom: zoom })}
        />
      </div>

      {/* Feedback de Validação e Capacidade do Telhado */}
      <div className={`flex items-start gap-2.5 rounded-2xl border p-4 text-xs font-bold ${
        !hasRoof
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : fits
          ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
          : "border-amber-300 bg-amber-50 text-amber-900"
      }`}>
        {!hasRoof ? (
          <>
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="leading-relaxed">
              Desenhe o contorno do telhado sobre a imagem de satélite (clicando nos 4 cantos da água) para validar o arranjo físico e a capacidade de módulos.
            </span>
          </>
        ) : fits ? (
          <>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span className="leading-relaxed">
              Área de {state.roof_area_m2.toFixed(1).replace(".", ",")} m² comporta com folga os {requested} módulos solicitados (capacidade física máxima: {physicalCapacity} módulos).
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span className="leading-relaxed">
              A área desenhada de {state.roof_area_m2.toFixed(1).replace(".", ",")} m² comporta no máximo {physicalCapacity} dos {requested} módulos solicitados. Amplie o contorno ou ajuste a quantidade na etapa Equipamentos.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
