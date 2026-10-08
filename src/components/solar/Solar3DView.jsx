import React, { useState } from "react";
import { Compass, Rotate3d, Sun, Zap, Layers } from "lucide-react";
import { calculateAzimuth } from "../../lib/solarDesignerGeometry";

export default function Solar3DView({ config, areas = [], sizing, panelPolygons = [] }) {
  const [pitchAngle, setPitchAngle] = useState(config.roof_pitch_deg || 15);
  const [sunTime, setSunTime] = useState(12);
  const [selectedAreaId, setSelectedAreaId] = useState(areas[0]?.id || null);

  const activeAreas = areas.length > 0 ? areas : (config.areas?.length > 0 ? config.areas : []);
  const currentArea = activeAreas.find((a) => a.id === selectedAreaId) || activeAreas[0] || {};
  const currentPolygon = currentArea?.polygon || config.roof_polygon || [];

  const azimuth = calculateAzimuth(currentPolygon);

  // Posição visual do sol (6h a 18h)
  const sunPositionX = ((sunTime - 6) / 12) * 100;
  const sunElevationPct = Math.sin(((sunTime - 6) / 12) * Math.PI) * 100;

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-sky-100 via-sky-50 to-slate-200 overflow-hidden flex flex-col items-center justify-center select-none">
      {/* Barra de Controles 3D Superior (Light Theme) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 p-1.5 rounded-xl text-xs shadow-xl text-slate-800">
        {/* Seletor de Áreas quando houver múltiplas */}
        {activeAreas.length > 1 && (
          <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
            <Layers className="h-3.5 w-3.5 text-[#00d8b8]" />
            {activeAreas.map((area, idx) => (
              <button
                key={area.id}
                type="button"
                onClick={() => setSelectedAreaId(area.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition ${
                  (currentArea.id === area.id)
                    ? "bg-[#00d8b8] text-slate-950 font-black shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {area.name || `Área ${idx + 1}`}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 px-2">
          <Rotate3d className="h-4 w-4 text-[#00d8b8]" />
          <span className="font-bold">Inclinação: {pitchAngle}°</span>
          <input
            type="range"
            min="5"
            max="45"
            value={pitchAngle}
            onChange={(e) => setPitchAngle(Number(e.target.value))}
            className="w-20 accent-[#00d8b8]"
          />
        </div>
        <span className="h-4 w-px bg-slate-200" />
        <div className="flex items-center gap-2 px-2">
          <Sun className="h-4 w-4 text-amber-500" />
          <span className="font-bold">Horário: {String(sunTime).padStart(2, "0")}:00</span>
          <input
            type="range"
            min="6"
            max="18"
            step="1"
            value={sunTime}
            onChange={(e) => setSunTime(Number(e.target.value))}
            className="w-20 accent-amber-500"
          />
        </div>
      </div>

      {/* Rosa dos ventos e Azimute (Light) */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-md border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs shadow-xl">
        <Compass className="h-4 w-4 text-[#00d8b8] animate-pulse" />
        <span className="font-black text-[#009b84]">Azimute: {azimuth.formatted}</span>
      </div>

      {/* Sol e Trajetória 3D */}
      <div className="absolute inset-x-12 top-10 h-36 pointer-events-none">
        <div className="relative w-full h-full">
          <svg className="w-full h-full overflow-visible">
            <path
              d="M 50 120 Q 50% 10 950 120"
              fill="none"
              stroke="rgba(245, 158, 11, 0.4)"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
          </svg>
          <div
            style={{ left: `${sunPositionX}%`, top: `${100 - sunElevationPct}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 transition-all duration-300"
          >
            <div className="h-9 w-9 rounded-full bg-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.9)] flex items-center justify-center animate-pulse">
              <Sun className="h-5 w-5 text-amber-950" />
            </div>
            <span className="text-[10px] font-black bg-white/90 border border-amber-300 px-1.5 py-0.5 rounded text-amber-800 shadow">
              {sunTime}:00
            </span>
          </div>
        </div>
      </div>

      {/* Renderização Isométrica / 3D do Telhado e Módulos */}
      <div
        className="relative transition-transform duration-300 flex items-center justify-center"
        style={{
          transform: `perspective(900px) rotateX(${pitchAngle + 35}deg) rotateZ(${-azimuth.degrees / 2}deg) scale(1.05)`,
        }}
      >
        <div
          style={{
            width: "380px",
            height: "220px",
            boxShadow: "0 30px 60px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.4)",
          }}
          className="relative rounded-2xl bg-gradient-to-tr from-[#a0522d] via-[#b86236] to-[#cd7f32] border-4 border-[#8c4b26]/70 flex flex-wrap content-start p-3.5 gap-1.5 overflow-hidden"
        >
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[repeating-linear-gradient(0deg,#000_0px,#000_4px,transparent_4px,transparent_16px)]" />

          {Array.from({ length: Math.min(36, currentArea?.panelCount || sizing?.panelCount || 21) }).map((_, i) => (
            <div
              key={i}
              className="relative h-12 w-8 rounded-sm bg-gradient-to-b from-[#194b8e] to-[#0c2a54] border border-[#7ca6dc]/70 shadow-md flex flex-col justify-between p-0.5 overflow-hidden group hover:border-[#00d8b8] transition"
              style={{
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
              }}
            >
              <div className="grid grid-cols-2 grid-rows-3 gap-[1px] h-full w-full opacity-75">
                {Array.from({ length: 6 }).map((_, c) => (
                  <div key={c} className="bg-[#1e58a4]/60 rounded-[0.5px]" />
                ))}
              </div>
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />
            </div>
          ))}

          <div
            className="absolute right-5 bottom-5 h-14 w-14 rounded-lg bg-gradient-to-b from-slate-200 to-slate-400 border-2 border-slate-500 shadow-[0_12px_24px_rgba(0,0,0,0.3)] flex flex-col items-center justify-center text-[8px] font-black text-slate-800"
            style={{
              transform: "translateZ(30px)",
            }}
          >
            <span>Caixa</span>
            <span>d'água</span>
          </div>
        </div>
      </div>

      {/* Rodapé Informativo da Visualização 3D (Light) */}
      <div className="absolute bottom-4 inset-x-6 z-20 flex items-center justify-between bg-white/95 backdrop-blur-md border border-slate-200/90 px-4 py-2.5 rounded-xl text-xs shadow-xl text-slate-800">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-bold text-emerald-600">
            <Zap className="h-4 w-4" /> {sizing?.panelCount || 21} Módulos Totais ({activeAreas.length} {activeAreas.length === 1 ? "Área" : "Áreas"})
          </span>
          {activeAreas.length > 1 && (
            <span className="text-slate-500">
              {currentArea.name || "Área"}: <strong className="text-slate-900">{currentArea.panelCount || 0} módulos</strong>
            </span>
          )}
          <span className="text-slate-500">
            Inclinação: <strong className="text-slate-900">{pitchAngle}°</strong>
          </span>
          <span className="text-slate-500">
            Orientação: <strong className="text-slate-900">{azimuth.formatted}</strong>
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">
          Renderização paramétrica isométrica fotovoltaica
        </span>
      </div>
    </div>
  );
}
