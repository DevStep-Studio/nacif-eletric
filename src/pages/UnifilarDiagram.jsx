import { useState, useEffect, useRef } from "react";
import { jsPDF } from "jspdf";
import ProfessionalBoardSheetSVG from "@/components/ProfessionalBoardSheetSVG";
import QgbtDiagramSheetSVG from "@/components/QgbtDiagramSheetSVG";
import { useSearchParams } from "react-router-dom";
import { backend } from "@/api/backendClient";
import { calcProjectMetrics, autoBalancePhases } from "@/lib/electricalEngine";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Download,
  ZoomIn,
  ZoomOut,
  Printer,
  ChevronDown,
  Upload,
  Plus,
  Grid,
  Save,
  RefreshCw,
  Zap,
  ShieldCheck,
  Settings,
  HelpCircle,
  FileText,
  Sparkles,
  Check,
  LayoutGrid,
  Calculator,
  Copy,
  Maximize2,
  Redo2,
  Trash2,
  Undo2
} from "lucide-react";
import { openSVGPrint, PAPER_SIZES } from "@/lib/printUtils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import PageHeader from "@/components/PageHeader";
import { DEFAULT_LOGO_URL } from "@/lib/brandingDefaults";
import { useToast } from "@/components/ui/use-toast";

// ─── Paleta CAD (para o visualizador legado se usado) ─────────────────────────
const CAD_BG   = "#fdfdfc";
const CAD_LINE = "#1e293b";
const CAD_SUB  = "#475569";
const CAD_GRID = "#e7e7e4";
const PH = { A: "#111827", B: "#dc2626", C: "#8b4513", ABC: "#005188" };
const PH_FILL = { A: "#f8fafc", B: "#fef2f2", C: "#fdf8f6", ABC: "#EEF7FC" };
const N_CLR = "#00d8b8";
const PE_CLR = "#16a34a";
const GEN_CLR = "#005188";

const safeFileName = (value) => String(value || "projeto")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9_-]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 80) || "projeto";

const CIRC_W = 156;
const CIRC_H = 138;
const COL_GAP = 22;
const ROW_GAP = 46;
const COLS    = 3;
const FLOW_NODE_WIDTH = 240;
const FLOW_NODE_HEIGHT = 90;
const MAX_HISTORY = 40;

// ─── Símbolos Legados (Mantidos para o modo de Visualização CAD) ────────────────
function SymBreaker({ x, y, poles, current, curve, color = CAD_LINE, label = "" }) {
  return (
    <g>
      <rect x={x - 14} y={y - 22} width={28} height={44} rx="3" fill="white" stroke={color} strokeWidth="1.8" />
      <line x1={x} y1={y - 22} x2={x} y2={y - 10} stroke={color} strokeWidth="1.8" />
      <line x1={x - 7} y1={y - 10} x2={x + 7} y2={y - 2} stroke={color} strokeWidth="1.8" />
      <line x1={x} y1={y - 2} x2={x} y2={y + 22} stroke={color} strokeWidth="1.8" />
      <path d={`M${x - 6},${y + 8} Q${x},${y + 3} ${x + 6},${y + 8}`} fill="none" stroke={color} strokeWidth="1.2" />
      <text x={x} y={y + 38} fill={color} fontSize="9" textAnchor="middle" fontWeight="bold">{poles}P {current}A/{curve}</text>
      {label && <text x={x} y={y + 51} fill={color} fontSize="8.5" textAnchor="middle" fontWeight="bold">{label}</text>}
    </g>
  );
}

function SymDR({ x, y, poles, current }) {
  const c = "#005188";
  return (
    <g>
      <rect x={x - 14} y={y - 24} width={28} height={48} rx="3" fill="white" stroke={c} strokeWidth="1.8" />
      <text x={x} y={y - 10} fill={c} fontSize="9"   textAnchor="middle" fontWeight="bold">DR</text>
      <text x={x} y={y + 1}  fill={c} fontSize="7.5" textAnchor="middle">{poles}P {current}A</text>
      <text x={x} y={y + 12} fill={c} fontSize="7"   textAnchor="middle">30mA</text>
      <line x1={x} y1={y + 24} x2={x} y2={y + 34} stroke={c} strokeWidth="1.8" />
    </g>
  );
}

function SymDPS({ x, y }) {
  const c = "#00d8b8";
  return (
    <g>
      <rect x={x - 16} y={y - 18} width="32" height="36" rx="3" fill="white" stroke={c} strokeWidth="1.8" />
      <polygon points={`${x},${y - 12} ${x + 6},${y + 2} ${x + 2},${y + 2} ${x + 4},${y + 14} ${x - 4},${y} ${x},${y}`} fill={c} />
      <text x={x} y={y + 28} fill={c} fontSize="8" textAnchor="middle" fontWeight="bold">DPS II</text>
    </g>
  );
}

function SymGround({ x, y }) {
  return (
    <g>
      <line x1={x} y1={y}     x2={x}     y2={y + 10} stroke={PE_CLR} strokeWidth="2" />
      <line x1={x - 12} y1={y + 10} x2={x + 12} y2={y + 10} stroke={PE_CLR} strokeWidth="2.5" />
      <line x1={x - 7}  y1={y + 15} x2={x + 7}  y2={y + 15} stroke={PE_CLR} strokeWidth="2" />
      <line x1={x - 2}  y1={y + 20} x2={x + 2}  y2={y + 20} stroke={PE_CLR} strokeWidth="1.5" />
    </g>
  );
}

function ConductorColorKey({ x, y }) {
  const items = [
    ["FA", "Preto", PH.A],
    ["FB", "Vermelho", PH.B],
    ["FC", "Marrom", PH.C],
    ["N", "Azul", N_CLR],
    ["PE", "Verde", PE_CLR],
  ];

  return (
    <g>
      <rect x={x} y={y} width="232" height="52" rx="5" fill="white" stroke={CAD_GRID} strokeWidth="1" />
      <text x={x + 10} y={y + 14} fill={CAD_LINE} fontSize="7.2" fontWeight="900">CORES DOS CONDUTORES</text>
      {items.map(([code, label, color], index) => {
        const xx = x + 10 + index * 43;
        return (
          <g key={code}>
            <line x1={xx} y1={y + 29} x2={xx + 26} y2={y + 29} stroke={color} strokeWidth="3" />
            <text x={xx} y={y + 43} fill={CAD_SUB} fontSize="6.6" fontWeight="800">{code}</text>
            <text x={xx + 14} y={y + 43} fill={CAD_SUB} fontSize="6.2">{label}</text>
          </g>
        );
      })}
    </g>
  );
}

function DrawingTitleBlock({ x, y, w, h, project, metrics, circuits, supply, voltage }) {
  const client = project?.client_name || project?.client || project?.customer || "—";
  const address = project?.address || project?.project_address || "—";
  const rev = project?.revision || "01/2026";
  const totalKw = (metrics?.totalPower / 1000 || 0).toFixed(2);
  const cells = [
    { label: "PROJETO", value: project?.name || "Projeto", width: 0.24 },
    { label: "CLIENTE", value: client, width: 0.22 },
    { label: "ENDEREÇO", value: address, width: 0.30 },
    { label: "REV.", value: rev, width: 0.10 },
    { label: "CIRCUITOS", value: String(circuits.length), width: 0.07 },
    { label: "POTÊNCIA", value: `${totalKw} kW`, width: 0.07 },
  ];
  let cursor = x;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill="white" stroke={CAD_LINE} strokeWidth="0.8" />
      <rect x={x} y={y + h - 18} width={w} height="18" fill="#f8fafc" />
      {cells.map((cell, index) => {
        const cw = w * cell.width;
        const node = (
          <g key={cell.label}>
            {index > 0 && <line x1={cursor} y1={y} x2={cursor} y2={y + h - 18} stroke={CAD_GRID} strokeWidth="0.8" />}
            <text x={cursor + 6} y={y + 13} fill={CAD_SUB} fontSize="7.2" fontWeight="900">{cell.label}</text>
            <text x={cursor + 6} y={y + 27} fill={CAD_LINE} fontSize="8.2" fontWeight="900">{String(cell.value).slice(0, 34)}</text>
          </g>
        );
        cursor += cw;
        return node;
      })}
      <text x={x + w / 2} y={y + h - 6} fill={CAD_SUB} fontSize="7.4" textAnchor="middle">
        NACIF Solutions Eletric · Diagrama Unifilar · NBR 5410:2004 · IEC 60617 · IEC 60445 · Gerado automaticamente
      </text>
      <text x={x + w - 8} y={y + h - 6} fill={CAD_SUB} fontSize="7.2" textAnchor="end">
        {supply} · {voltage}V
      </text>
    </g>
  );
}

function CircuitBox({ x, y, circuit, num }) {
  const ph    = circuit.phase || "A";
  const color = PH[ph[0]] || PH.A;
  const fill  = PH_FILL[ph[0]] || PH_FILL.A;
  const vdOk  = circuit.voltage_drop_ok !== false;
  const poles = circuit.breaker_poles ||
    (circuit.supply_type === "Trifásico" ? 3 :
     circuit.supply_type === "Bifásico" || (circuit.phase && circuit.phase.length === 2) ? 2 : 1);

  return (
    <g>
      <rect x={x + 2} y={y + 2} width={CIRC_W} height={CIRC_H} rx="5" fill={CAD_GRID} />
      <rect x={x} y={y} width={CIRC_W} height={CIRC_H} rx="5" fill="white" stroke={color} strokeWidth="1.6" />
      <rect x={x} y={y} width={CIRC_W} height="24" rx="5" fill={fill} />
      <rect x={x} y={y + 17} width={CIRC_W} height="7" fill={fill} />
      <text x={x + CIRC_W / 2} y={y + 16} fill={color} fontSize="9" textAnchor="middle" fontWeight="800">
        C{String(num).padStart(2, "0")} · Fase {ph}
      </text>
      <text x={x + 8} y={y + 38} fill={CAD_LINE} fontSize="10" fontWeight="800">{(circuit.name || "Circuito").slice(0, 18)}</text>
      <text x={x + 8} y={y + 50} fill={CAD_SUB}  fontSize="7.5">{(circuit.type || circuit.circuit_type || "Circuito final").slice(0, 24)}</text>
      <line x1={x + 8} y1={y + 57} x2={x + CIRC_W - 8} y2={y + 57} stroke={CAD_GRID} strokeWidth="1" />

      <text x={x + 8} y={y + 69} fill={CAD_SUB} fontSize="6.6" fontWeight="700">TENSÃO</text>
      <text x={x + 72} y={y + 69} fill={CAD_SUB} fontSize="6.6" fontWeight="700">POTÊNCIA</text>
      <text x={x + 8} y={y + 80} fill={color} fontSize="8.2" fontWeight="800">{circuit.voltage}V · {circuit.supply_type || "Mono"}</text>
      <text x={x + 72} y={y + 80} fill={CAD_LINE} fontSize="8.2" fontWeight="800">{circuit.power_w} W</text>

      <text x={x + 8} y={y + 94} fill={CAD_SUB} fontSize="6.6" fontWeight="700">PROTEÇÃO</text>
      <text x={x + 72} y={y + 94} fill={CAD_SUB} fontSize="6.6" fontWeight="700">CONDUTOR</text>
      <text x={x + 8} y={y + 105} fill={CAD_LINE} fontSize="8.2" fontWeight="800">{poles}P {circuit.breaker_a}A/{circuit.breaker_curve||"B"}</text>
      <text x={x + 72} y={y + 105} fill={CAD_LINE} fontSize="8.2" fontWeight="800">{circuit.wire_gauge} · {circuit.length_m||15}m</text>

      <text x={x + 8} y={y + 119} fill={vdOk ? "#00d8b8" : "#dc2626"} fontSize="7.2" fontWeight="800">
        ΔU {circuit.voltage_drop_pct}% {vdOk ? "OK" : "REVISAR"}
      </text>
      <text x={x + 72} y={y + 119} fill={CAD_SUB} fontSize="7.2" fontWeight="700">
        I {circuit.project_current_a}A · Ic {circuit.breaking_capacity_ka||6}kA
      </text>
      {circuit.needs_dr && (
        <rect x={x + 8} y={y + 124} width="28" height="10" rx="2" fill="#EEF7FC" stroke="#005188" strokeWidth="0.8" />
      )}
      {circuit.needs_dr && (
        <text x={x + 22} y={y + 132} fill="#005188" fontSize="6.7" textAnchor="middle" fontWeight="800">DR</text>
      )}
      <rect x={x + (circuit.needs_dr ? 40 : 8)} y={y + 124} width="30" height="10" rx="2"
        fill="#E6F2FA" stroke="#00d8b8" strokeWidth="0.8" />
      <text x={x + (circuit.needs_dr ? 55 : 23)} y={y + 132} fill="#00d8b8" fontSize="6.7" textAnchor="middle" fontWeight="800">DPS</text>
      <line x1={x + CIRC_W / 2} y1={y} x2={x + CIRC_W / 2} y2={y - 12} stroke={color} strokeWidth="2" />
    </g>
  );
}

function UnifilarSVG({ project, metrics }) {
  const circuits = metrics?.circuits || autoBalancePhases(project?.circuits || []);
  const generalBreaker = metrics?.generalBreaker || 40;
  const supply  = project?.supply_type || "Monofásico";
  const voltage = project?.voltage || 220;
  const W = 1189;
  const H = 841;
  const LEFT_SPLIT = 444;
  const RIGHT_TITLE_X = 910;
  const TABLE_X = 455;
  const TABLE_Y = 138;
  const TABLE_W = 720;
  const ROW_H = 9;
  const title = supply === "Trifásico" ? "QUADRO GERAL DE BAIXA TENSÃO" : "QUADRO DE FORÇA E ILUMINAÇÃO";
  const hasPolyphaseCircuits = circuits.some((c) =>
    c.supply_type === "Trifásico" ||
    c.supply_type === "Bifásico" ||
    String(c.phase || "").length > 1
  );
  const phaseNames = supply === "Trifásico" || hasPolyphaseCircuits
    ? ["R", "S", "T", "N", "PE"]
    : supply === "Bifásico"
      ? ["R", "S", "N", "PE"]
      : ["F", "N", "PE"];
  const busBaseX = 214;
  const busSpacing = phaseNames.length >= 5 ? 30 : 34;
  const busXs = phaseNames.map((_, i) => busBaseX + (i - (phaseNames.length - 1) / 2) * busSpacing);
  const feederPhaseCount = supply === "Trifásico" || hasPolyphaseCircuits ? 3 : supply === "Bifásico" ? 2 : 1;
  const feederGauge = (current) => {
    if (current <= 50) return 10;
    if (current <= 70) return 16;
    if (current <= 100) return 25;
    if (current <= 150) return 35;
    if (current <= 200) return 50;
    if (current <= 250) return 70;
    if (current <= 320) return 95;
    return 120;
  };
  const feeder = feederGauge(metrics?.generalCurrent || generalBreaker);
  const tableWidths = [34, 140, 44, 37, 42, 36, 46, 52, 44, 54, 44, 44, 44, 35];
  const tableHeaders = ["Circuito", "Descrição", "Pva (W)", "V", "In(A)", "Fc", "Iaj(A)", "Disjuntor", "Queda", "Condutor", "Fase A", "Fase B", "Fase C", "Esp."];
  const phasePower = (c, ph) => (c.phase || "").includes(ph) ? Math.round(c.power_w || 0) : "";
  const totalKva = ((metrics?.totalPower || 0) / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mainCurrent = Math.round(metrics?.generalCurrent || 0);
  const panelName = (project?.panel_name || project?.name || "QUADRO").toUpperCase();
  const client = project?.client_name || "CLIENTE";
  const address = project?.address || "ENDEREÇO DA OBRA";
  const normalizedCircuitName = (circuit, index) => (
    `C${String(index + 1).padStart(2, "0")}F-${String(circuit.phase || "A").replace("ABC", "ABC")} - ${(circuit.name || circuit.type || "CIRCUITO").toUpperCase()}`
  );

  const CellText = ({ children, x, y, w, align = "center", color = CAD_LINE, weight = "normal", size = 5.8 }) => (
    <text
      x={align === "left" ? x + 3 : align === "right" ? x + w - 3 : x + w / 2}
      y={y}
      fill={color}
      fontSize={size}
      fontWeight={weight}
      textAnchor={align === "left" ? "start" : align === "right" ? "end" : "middle"}
    >
      {children}
    </text>
  );

  const BreakerSide = ({ x, y, amp, side = "right", color = "#ff5cff" }) => {
    const dir = side === "right" ? 1 : -1;
    return (
      <g>
        <path d={`M ${x} ${y} h ${dir * 8} q ${dir * 6} -7 ${dir * 16} 0 h ${dir * 8}`} fill="none" stroke={color} strokeWidth="0.8" />
        <circle cx={x} cy={y} r="1.6" fill="#00c826" />
        <text x={x + dir * 39} y={y + 2.2} fill="#5c66ff" fontSize="6.2" textAnchor={side === "right" ? "start" : "end"} fontWeight="700">{amp || 16}A</text>
      </g>
    );
  };

  const BusbarDiagram = () => {
    const top = 248;
    const bottom = 720;
    const left = 18;
    const right = LEFT_SPLIT - 14;
    const minVisibleRows = 14;
    const displayRows = [
      ...circuits.slice(0, 28).map((circuit) => ({ type: "circuit", circuit })),
      ...Array.from({ length: Math.max(0, minVisibleRows - Math.min(circuits.length, 28)) }, (_, index) => ({
        type: "reserve",
        label: `Reserva ${index + 1}`,
      })),
    ].slice(0, 28);
    const branchStart = top + 88;
    const spacing = Math.min(30, Math.max(12, (bottom - branchStart - 36) / Math.max(displayRows.length - 1, 1)));
    const sideLabelLeft = phaseNames.length >= 5 ? "R/S/T" : phaseNames[0];
    const sideLabelRight = phaseNames.includes("PE") ? "N / PE" : phaseNames[phaseNames.length - 1];
    const phaseIndexFor = (phase = "A") => {
      if ((phase.includes("B") || phase.includes("S")) && feederPhaseCount >= 2) return 1;
      if ((phase.includes("C") || phase.includes("T")) && feederPhaseCount >= 3) return 2;
      return 0;
    };

    return (
      <g>
        <text x={(left + right) / 2} y="136" fill="#000" fontSize="13" textAnchor="middle" fontWeight="700">{title} - {panelName.slice(0, 24)}</text>
        <text x={(left + right) / 2} y="167" fill="#000" fontSize="10.5" textAnchor="middle">{feeder}mm²</text>

        {Array.from({ length: Math.max(1, feederPhaseCount) }).map((_, i) => (
          <g key={`entrada-${i}`}>
            <rect x={busXs[i] - 5} y="184" width="10" height="38" fill="white" stroke="#9ca3af" strokeWidth="0.55" />
            <line x1={busXs[i]} y1="222" x2={busXs[i]} y2={top - 18} stroke="#9ca3af" strokeWidth="0.45" />
          </g>
        ))}
        {phaseNames.includes("N") && (
          <rect x={busXs[phaseNames.indexOf("N")] - 5} y="184" width="10" height="38" fill="white" stroke="#9ca3af" strokeWidth="0.55" />
        )}
        {phaseNames.map((name, i) => (
          <g key={name}>
            <text x={busXs[i]} y="202" fill="#000" fontSize={name.length > 1 ? "10.5" : "13"} textAnchor="middle">{name}</text>
            <line x1={busXs[i]} y1={top} x2={busXs[i]} y2={bottom} stroke={name === "PE" ? "#16a34a" : name === "N" ? "#9ca3af" : "#9ca3af"} strokeWidth={name === "PE" ? "0.65" : "0.48"} />
          </g>
        ))}
        <line x1={busXs[0] - 28} y1={bottom} x2={busXs[busXs.length - 1] + 28} y2={bottom} stroke="#000" strokeWidth="0.75" />
        <text x="94" y="216" fill="#000" fontSize="11.5" textAnchor="end">{sideLabelLeft}</text>
        <text x="122" y="216" fill="#000" fontSize="9">{feeder}mm²</text>
        <text x={right - 120} y="216" fill="#000" fontSize="11.5">{sideLabelRight}</text>
        <text x={right - 78} y="216" fill="#000" fontSize="9">{feeder}mm²</text>

        {Array.from({ length: feederPhaseCount }).map((_, phaseIndex) => {
          const yy = top + 34 + phaseIndex * 13;
          return (
            <g key={phaseIndex}>
              <line x1="88" y1={yy} x2={busXs[phaseIndex]} y2={yy} stroke="#9ca3af" strokeWidth="0.45" />
              <circle cx="88" cy={yy} r="1.8" fill="#00c826" />
              <circle cx={busXs[phaseIndex]} cy={yy} r="1.8" fill="#00c826" />
              <text x="106" y={yy + 1.7} fill="#ff0000" fontSize="6" fontWeight="700">275V/20kA</text>
              <circle cx="146" cy={yy} r="4.3" fill="white" stroke="#ff0000" strokeWidth="0.8" />
              <text x="146" y={yy + 2.1} fill="#ff0000" fontSize="5.2" textAnchor="middle" fontWeight="800">II</text>
            </g>
          );
        })}

        {Array.from({ length: feederPhaseCount }).map((_, i) => (
          <ellipse key={i} cx={busXs[i]} cy={top - 20} rx="8" ry="3.2" fill="none" stroke="#ff5cff" strokeWidth="0.7" />
        ))}
        <text x={busXs[Math.max(0, feederPhaseCount - 1)] + 26} y={top - 18} fill="#ff5cff" fontSize="5.8">{generalBreaker}A</text>

        {displayRows.map((rowData, index) => {
          const circuit = rowData.circuit;
          const side = index % 2 === 0 ? "left" : "right";
          const yy = branchStart + index * spacing;
          const phaseIndex = rowData.type === "circuit" ? phaseIndexFor(circuit.phase) : 0;
          const bx = busXs[phaseIndex];
          const outX = side === "left" ? busXs[0] - 62 : busXs[busXs.length - 1] + 62;
          const labelX = side === "left" ? left + 8 : right - 8;
          const label = rowData.type === "circuit" ? normalizedCircuitName(circuit, index) : rowData.label;
          return (
            <g key={`${rowData.type}-${circuit?.name || rowData.label}-${index}`}>
              <line
                x1={bx}
                y1={yy}
                x2={outX}
                y2={yy}
                stroke={rowData.type === "circuit" ? "#a3a8b0" : "#d1d5db"}
                strokeWidth={rowData.type === "circuit" ? "0.48" : "0.36"}
                strokeDasharray={rowData.type === "circuit" ? undefined : "4 3"}
              />
              <circle
                cx={bx}
                cy={yy}
                r={rowData.type === "circuit" ? "1.75" : "1.45"}
                fill={rowData.type === "circuit" ? "#00c826" : "#f8fafc"}
                stroke={rowData.type === "circuit" ? "none" : "#c7cbd1"}
                strokeWidth="0.4"
              />
              <circle
                cx={outX}
                cy={yy}
                r={rowData.type === "circuit" ? "1.75" : "1.45"}
                fill={rowData.type === "circuit" ? "#00c826" : "#f8fafc"}
                stroke={rowData.type === "circuit" ? "none" : "#c7cbd1"}
                strokeWidth="0.4"
              />
              {rowData.type === "circuit" && (
                <BreakerSide x={outX} y={yy} amp={circuit.breaker_a} side={side === "left" ? "left" : "right"} />
              )}
              <text
                x={labelX}
                y={yy - 4.8}
                fill={rowData.type === "circuit" ? "#4f5cff" : "#8b93a1"}
                fontSize={rowData.type === "circuit" ? "6.2" : "5.6"}
                fontFamily="'Courier New', monospace"
                textAnchor={side === "left" ? "start" : "end"}
              >
                {label.slice(0, 52)}
              </text>
            </g>
          );
        })}

        {circuits.length > 28 && (
          <text x={(left + right) / 2} y={bottom - 22} fill="#ff0000" fontSize="7" textAnchor="middle">
            {circuits.length - 28} circuito(s) adicionais listados na planilha
          </text>
        )}
        <text x={(left + right) / 2} y="732" fill="#000" fontSize="10" textAnchor="middle">
          MEMÓRIA DE CÁLCULO - {panelName.slice(0, 32)}
        </text>
      </g>
    );
  };

  const DimensioningTable = () => (
    <g>
      <rect x={TABLE_X} y={TABLE_Y - 17} width={TABLE_W} height="10" fill="#00a8d7" stroke="#000" strokeWidth="0.38" />
      <text x={TABLE_X + TABLE_W / 2} y={TABLE_Y - 9.8} fill="#000" fontSize="6.2" textAnchor="middle" fontWeight="800">
        Planilha de dimensionamento de carga do quadro - {panelName.slice(0, 48)}
      </text>
      <rect x={TABLE_X} y={TABLE_Y - 7} width={TABLE_W} height={ROW_H} fill="#f5f5f5" stroke="#000" strokeWidth="0.38" />
      {tableHeaders.map((header, i) => {
        const x = TABLE_X + tableWidths.slice(0, i).reduce((sum, item) => sum + item, 0);
        return (
            <g key={header}>
              <rect x={x} y={TABLE_Y - 7} width={tableWidths[i]} height={ROW_H} fill="none" stroke="#000" strokeWidth="0.38" />
              <CellText x={x} y={TABLE_Y - 1.1} w={tableWidths[i]} weight="700">{header}</CellText>
            </g>
        );
      })}

      {circuits.slice(0, 23).map((c, rowIndex) => {
        const y = TABLE_Y + 2 + rowIndex * ROW_H;
        const values = [
          `C${String(rowIndex + 1).padStart(2, "0")}`,
          (c.name || c.type || "Circuito").toUpperCase().slice(0, 34),
          Math.round(c.power_w || 0),
          c.voltage || voltage,
          Number(c.project_current_a || 0).toFixed(1),
          Number(c.group_factor || 1).toFixed(2),
          Number(c.corrected_current_a || 0).toFixed(1),
          `${c.breaker_a || 16}A`,
          `${Number(c.voltage_drop_pct || 0).toFixed(1)}%`,
          c.wire_gauge || "2.5mm²",
          phasePower(c, "A"),
          phasePower(c, "B"),
          phasePower(c, "C"),
          c.din_modules || 1,
        ];
        return (
          <g key={`${c.name}-${rowIndex}-table`}>
            {values.map((value, i) => {
              const x = TABLE_X + tableWidths.slice(0, i).reduce((sum, item) => sum + item, 0);
              const isBreakerAlert = i === 7 && Number(c.breaker_a || 0) >= 40;
              const isPhaseValue = i >= 10 && i <= 12 && value !== "";
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={tableWidths[i]}
                    height={ROW_H}
                    fill={isBreakerAlert ? "#ff0000" : isPhaseValue ? "#ffff00" : "white"}
                    stroke="#000"
                    strokeWidth="0.34"
                  />
                  <CellText x={x} y={y + 5.9} w={tableWidths[i]} color="#000" weight={isBreakerAlert ? "700" : "normal"} align={i === 1 ? "left" : "center"}>
                    {value}
                  </CellText>
                </g>
              );
            })}
          </g>
        );
      })}

      {Array.from({ length: Math.max(0, 28 - Math.min(circuits.length, 23)) }).map((_, index) => {
        const y = TABLE_Y + 2 + (Math.min(circuits.length, 23) + index) * ROW_H;
        return (
          <g key={`blank-${index}`}>
            <rect x={TABLE_X} y={y} width={TABLE_W} height={ROW_H} fill="white" stroke="#000" strokeWidth="0.25" />
            {tableWidths.slice(1).reduce((acc, width, i) => {
              const x = TABLE_X + tableWidths.slice(0, i + 1).reduce((sum, item) => sum + item, 0);
              acc.push(<line key={i} x1={x} y1={y} x2={x} y2={y + ROW_H} stroke="#000" strokeWidth="0.2" />);
              return acc;
            }, [])}
          </g>
        );
      })}

      <rect x={TABLE_X + 388} y={TABLE_Y + 2 + 29 * ROW_H} width="118" height={ROW_H} fill="#00a8d7" stroke="#000" strokeWidth="0.35" />
      <text x={TABLE_X + 447} y={TABLE_Y + 2 + 29 * ROW_H + 5.9} fill="#000" fontSize="5.8" textAnchor="middle" fontWeight="700">Balanceamento</text>
      {["A", "B", "C"].map((ph, i) => (
        <g key={ph}>
          <rect x={TABLE_X + 506 + i * 44} y={TABLE_Y + 2 + 29 * ROW_H} width="44" height={ROW_H} fill="#ffff00" stroke="#000" strokeWidth="0.35" />
          <text x={TABLE_X + 528 + i * 44} y={TABLE_Y + 2 + 29 * ROW_H + 5.9} fill="#ff0000" fontSize="5.8" textAnchor="middle" fontWeight="700">
            {Number(metrics?.phaseLoad?.[ph] || 0).toFixed(1)}
          </text>
        </g>
      ))}

      <rect x={TABLE_X + 348} y="388" width="210" height="62" fill="white" stroke="#000" strokeWidth="0.35" />
      {[
        ["Cálculo por demanda", "Total", `${Math.round(metrics?.totalPower || 0)} W`],
        ["Demanda ajustada", "Painel", `${totalKva} kVA`],
        ["Corrente geral", "Projeto", `${mainCurrent} A`],
        ["Cabo de alimentação", "Quadro", `${feeder}mm²`],
      ].map((row, i) => (
        <g key={row[0]}>
          <rect x={TABLE_X + 348} y={388 + i * 15.5} width="102" height="15.5" fill={i === 0 ? "#ffff00" : "white"} stroke="#000" strokeWidth="0.25" />
          <rect x={TABLE_X + 450} y={388 + i * 15.5} width="50" height="15.5" fill={i === 0 ? "#ffff00" : "white"} stroke="#000" strokeWidth="0.25" />
          <rect x={TABLE_X + 500} y={388 + i * 15.5} width="58" height="15.5" fill={i === 0 ? "#ffff00" : "white"} stroke="#000" strokeWidth="0.25" />
          <text x={TABLE_X + 353} y={398 + i * 15.5} fill="#000" fontSize="5.7" fontWeight={i === 0 ? "800" : "600"}>{row[0]}</text>
          <text x={TABLE_X + 475} y={398 + i * 15.5} fill="#000" fontSize="5.7" textAnchor="middle">{row[1]}</text>
          <text x={TABLE_X + 552} y={398 + i * 15.5} fill="#000" fontSize="5.7" textAnchor="end" fontWeight="700">{row[2]}</text>
        </g>
      ))}
    </g>
  );

  const Characteristics = () => {
    const conductorPe = Math.max(10, Math.round(feeder / 2));
    const rows = [
      ["ORIGEM:", panelName],
      ["CARGA INSTALADA:", `${totalKva} kVA`],
      ["TENSÃO NOMINAL:", `${supply.toUpperCase()} ${voltage}V`],
      ["CORRENTE NOMINAL:", `${mainCurrent}A`],
      ["PROTEÇÃO GERAL:", `DISJUNTOR TERMOMAG. ${supply === "Trifásico" ? "TRIPOLAR" : "BIPOLAR"} DE ${generalBreaker}A`],
      ["BARRAMENTO:", `${supply === "Trifásico" ? "3F+N+T" : supply === "Bifásico" ? "2F+N+T" : "F+N+T"} DE ${Math.max(80, generalBreaker)}A`],
      ["CONDUTORES:", `FASES - #${feeder}mm2 XLPE OU HPE`],
      ["", `NEUTRO - #${feeder}mm2 XLPE OU HPE`],
      ["", `TERRA - #${conductorPe}mm2 XLPE OU HPE`],
      ["QUADRO:", `DIN - ${metrics?.panelSize || 24} MÓDULOS`],
    ];
    return (
      <g fontFamily="'Courier New', monospace" fill="#ff0000">
        <text x="475" y="585" fontSize="16">CARACTERÍSTICAS:</text>
        {rows.map(([label, value], i) => (
          <g key={`${label}-${i}`}>
            {label && <text x="475" y={612 + i * 17} fontSize="12.5">{label}</text>}
            <text x="615" y={612 + i * 17} fontSize="12.5">{String(value).slice(0, 50)}</text>
          </g>
        ))}
      </g>
    );
  };

  const Notes = () => (
    <g>
      <rect x="455" y="380" width="330" height="112" fill="white" stroke="#000" strokeWidth="0.35" />
      <text x="463" y="394" fill="#000" fontSize="7.5" fontWeight="700">NOTAS TÉCNICAS</text>
      {[
        "1. Condutores dimensionados conforme NBR 5410:2004.",
        "2. Iluminação: seção mínima 1,5mm²; tomadas/TUE/força: mínima 2,5mm².",
        "3. Validar Icu/Icn, método de instalação e temperatura ambiente em obra.",
        "4. Executar identificação, ensaios e inspeção antes da energização.",
      ].map((note, i) => (
        <text key={note} x="463" y={412 + i * 14} fill="#000" fontSize="6.4">{note}</text>
      ))}
      {(metrics?.validations || []).slice(0, 3).map((item, i) => (
        <text key={i} x="463" y={474 + i * 8} fill="#ff0000" fontSize="5.8">{String(item.msg).slice(0, 92)}</text>
      ))}
    </g>
  );

  const TitleBlockCad = () => {
    const x = RIGHT_TITLE_X;
    const y = 535;
    const w = W - x - 6;
    const rows = [
      { h: 23, label: "00", value: new Date().toLocaleDateString("pt-BR"), extra: "EMISSÃO INICIAL" },
      { h: 42, label: "CLIENTE:", value: client },
      { h: 48, label: "PROJETISTA:", value: "VOLT AI / ENGENHARIA" },
      { h: 44, label: "NOME DO PROJETO:", value: project?.name || "PROJETO ELÉTRICO" },
      { h: 46, label: "DISCIPLINA / SUB-DISCIPLINA:", value: "SISTEMA DE INSTALAÇÕES ELÉTRICAS" },
      { h: 54, label: "TÍTULO DO DESENHO:", value: "DIAGRAMA E MEMÓRIA DE CÁLCULO DO QUADRO" },
      { h: 34, label: "RESPONSÁVEL DO PROJETO:", value: "ENGENHEIRO ELETRICISTA" },
      { h: 26, label: "DATA:", value: "ESCALA: SEM ESCALA", extra: "PRANCHA / REVISÃO:" },
    ];
    let cy = y;
    return (
      <g>
        <rect x={x} y={y} width={w} height={H - y - 17} fill="white" stroke="#000" strokeWidth="0.65" />
        {rows.map((row, index) => {
          const rowY = rows.slice(0, index).reduce((sum, item) => sum + item.h, y);
          if (row.extra && !row.label.includes(":")) {
            return (
              <g key={index}>
                <rect x={x} y={rowY} width={w} height={row.h} fill="white" stroke="#000" strokeWidth="0.35" />
                {[0, 1, 2].map((cell) => (
                  <g key={cell}>
                    {cell > 0 && <line x1={x + (w / 3) * cell} y1={rowY} x2={x + (w / 3) * cell} y2={rowY + row.h} stroke="#000" strokeWidth="0.3" />}
                  </g>
                ))}
                <text x={x + 8} y={rowY + 14} fill="#000" fontSize="6">{row.label}</text>
                <text x={x + w / 3 + 8} y={rowY + 14} fill="#000" fontSize="6">{row.value}</text>
                <text x={x + (w / 3) * 2 + 8} y={rowY + 14} fill="#000" fontSize="6">{row.extra}</text>
              </g>
            );
          }
          return (
            <g key={index}>
              <rect x={x} y={rowY} width={w} height={row.h} fill="white" stroke="#000" strokeWidth="0.35" />
              <text x={x + 6} y={rowY + 9} fill="#000" fontSize="6" fontWeight="700">{row.label}</text>
              <text x={x + 6} y={rowY + 25} fill="#000" fontSize={row.label === "TÍTULO DO DESENHO:" ? "9" : "8"}>{String(row.value).slice(0, 42)}</text>
              {row.extra && <text x={x + w - 8} y={rowY + 9} fill="#000" fontSize="6" textAnchor="end">{row.extra}</text>}
            </g>
          );
        })}
        <text x={x + 6} y={H - 25} fill="#000" fontSize="5.5">{new Date().toLocaleDateString("pt-BR")}</text>
        <text x={x + 90} y={H - 25} fill="#000" fontSize="5.5">SEM ESCALA</text>
        <text x={x + w - 42} y={H - 21} fill="#000" fontSize="22" fontWeight="400">201/R00</text>
      </g>
    );
  };

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "'Arial Narrow','Helvetica Neue',Arial,sans-serif", background: "#ffffff", display: "block" }}>
      <rect width={W} height={H} fill="#ffffff" />
      <rect x="6" y="55" width={W - 12} height={H - 72} fill="none" stroke="#000" strokeWidth="0.75" />
      <line x1={LEFT_SPLIT} y1="55" x2={LEFT_SPLIT} y2={H - 17} stroke="#000" strokeWidth="0.55" />
      <line x1={LEFT_SPLIT} y1="535" x2={W - 6} y2="535" stroke="#000" strokeWidth="0.55" />
      <line x1={RIGHT_TITLE_X} y1="535" x2={RIGHT_TITLE_X} y2={H - 17} stroke="#000" strokeWidth="0.55" />

      <BusbarDiagram />
      <DimensioningTable />
      <Notes />
      <Characteristics />
      <TitleBlockCad />
      <text x="12" y={H - 8} fill="#8a8a8a" fontSize="5.8">
        Arquivo gerado automaticamente. Revisar e validar por profissional habilitado antes de emissão.
      </text>
    </svg>
  );
}

// ─── UTILS DO EDITOR DE FLUXO INTERATIVO ──────────────────────────────────────────
const getConnectorPoints = (fromNode, toNode) => {
  const w = FLOW_NODE_WIDTH, h = FLOW_NODE_HEIGHT;
  if (!fromNode || !toNode) return { startX: 0, startY: 0, endX: 0, endY: 0 };

  const fromX = Number(fromNode.x) || 0;
  const fromY = Number(fromNode.y) || 0;
  const toX = Number(toNode.x) || 0;
  const toY = Number(toNode.y) || 0;

  const fromCenterX = fromX + w / 2;
  const fromCenterY = fromY + h / 2;
  const toCenterX = toX + w / 2;
  const toCenterY = toY + h / 2;
  
  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;
  
  let startX = fromX + w;
  let startY = fromY + h / 2;
  let endX = toX;
  let endY = toY + h / 2;
  
  if (Math.abs(dx) < 80) {
    if (dy > 0) {
      startX = fromX + w / 2;
      startY = fromY + h;
      endX = toX + w / 2;
      endY = toY;
    } else {
      startX = fromX + w / 2;
      startY = fromY;
      endX = toX + w / 2;
      endY = toY + h;
    }
  } else if (dx > 0) {
    if (dy > 80) {
      startX = fromX + w / 2;
      startY = fromY + h;
      endX = toX;
      endY = toY + h / 2;
    } else if (dy < -80) {
      startX = fromX + w / 2;
      startY = fromY;
      endX = toX;
      endY = toY + h / 2;
    } else {
      startX = fromX + w;
      startY = fromY + h / 2;
      endX = toX;
      endY = toY + h / 2;
    }
  } else {
    if (dy > 80) {
      startX = fromX + w / 2;
      startY = fromY + h;
      endX = toX + w;
      endY = toY + h / 2;
    } else if (dy < -80) {
      startX = fromX + w / 2;
      startY = fromY;
      endX = toX + w;
      endY = toY + h / 2;
    } else {
      startX = fromX;
      startY = fromY + h / 2;
      endX = toX + w;
      endY = toY + h / 2;
    }
  }
  
  return { startX, startY, endX, endY };
};

const drawPath = (fromNode, toNode) => {
  const { startX, startY, endX, endY } = getConnectorPoints(fromNode, toNode);
  const dx = endX - startX;
  
  if (Math.abs(dx) < 15) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }
  
  // Se sai do fundo do nó e entra no lado esquerdo do nó seguinte (Curva em L do ID/DPS na referência)
  if (startY > (Number(fromNode?.y) || 0) + 80 && endX < (Number(toNode?.x) || 0) + 10 && dx > 0) {
    return `M ${startX} ${startY} Q ${startX} ${endY}, ${endX} ${endY}`;
  }
  
  // Curva S Padrão
  const ctrlX1 = startX + dx * 0.45;
  const ctrlX2 = endX - dx * 0.45;
  return `M ${startX} ${startY} C ${ctrlX1} ${startY}, ${ctrlX2} ${endY}, ${endX} ${endY}`;
};

// Gerador Automático de Nós e Conexões (NBR 5410)
function generateDefaultNodesAndConnections(proj, projMetrics) {
  const initialNodes = [];
  const initialConnections = [];
  if (!proj) return { nodes: initialNodes, connections: initialConnections };

  const supply = proj.supply_type || "Monofásico";
  const voltage = proj.voltage || 220;

  // 1. Nó de Alimentação Geral
  initialNodes.push({
    id: "node-feed",
    type: "feed",
    x: 80,
    y: 80,
    title: "ENTRADA DE ENERGIA",
    subtitle: `${supply} · ${voltage}V`,
    value: "Rede Distribuidora",
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    accentColor: "#eb5e4a",
    active: true
  });

  // 2. Disjuntor Geral
  const mainBreakerAmps = projMetrics?.generalBreaker || 40;
  initialNodes.push({
    id: "node-general-breaker",
    type: "breaker",
    x: 80,
    y: 200,
    title: "DISJUNTOR GERAL (DJ)",
    subtitle: `${mainBreakerAmps}A / Curva C`,
    value: `${mainBreakerAmps}A`,
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    accentColor: "#00d8b8",
    active: true
  });
  initialConnections.push({
    id: "c-feed-to-breaker",
    from: "node-feed",
    to: "node-general-breaker",
    type: "fase"
  });

  // 3. DPS Geral
  initialNodes.push({
    id: "node-dps",
    type: "dps",
    x: 360,
    y: 80,
    title: "DPS GERAL",
    subtitle: "Classe II · 15kA",
    value: "275V",
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    accentColor: "#dc2626",
    active: true
  });
  initialConnections.push({
    id: "c-breaker-to-dps",
    from: "node-general-breaker",
    to: "node-dps",
    type: "fase"
  });

  // 4. DR Geral
  const drAmps = mainBreakerAmps > 40 ? 63 : 40;
  initialNodes.push({
    id: "node-dr",
    type: "dr",
    x: 80,
    y: 320,
    title: "DR GERAL",
    subtitle: "Diferencial 30mA",
    value: `${drAmps}A`,
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    accentColor: "#005188",
    active: true
  });
  initialConnections.push({
    id: "c-breaker-to-dr",
    from: "node-general-breaker",
    to: "node-dr",
    type: "fase"
  });

  // 5. Barramento Principal
  initialNodes.push({
    id: "node-busbar",
    type: "busbar",
    x: 80,
    y: 440,
    title: "BARRAMENTO PRINCIPAL",
    subtitle: `Distribuição ${supply === "Trifásico" ? "A/B/C" : supply === "Bifásico" ? "A/B" : "A"}`,
    value: "Cobre 80A",
    phase: supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A",
    accentColor: "#eab308",
    active: true
  });
  initialConnections.push({
    id: "c-dr-to-busbar",
    from: "node-dr",
    to: "node-busbar",
    type: "fase"
  });

  // 6. Circuitos Finais do Projeto
  const circuitsList = projMetrics?.circuits || proj?.circuits || [];
  circuitsList.forEach((c, idx) => {
    const cId = `node-circuit-${idx}`;
    const gridCol = idx % 3;
    const gridRow = Math.floor(idx / 3);
    const cX = 360 + gridCol * 280;
    const cY = 260 + gridRow * 130;

    const phColor = c.phase === "A" ? "#00d8b8" : c.phase === "B" ? "#00d8b8" : c.phase === "C" ? "#16a34a" : "#8b5cf6";

    initialNodes.push({
      id: cId,
      type: "circuit",
      x: cX,
      y: cY,
      title: c.name || `Circuito ${idx + 1}`,
      subtitle: `${c.type || 'Tomada'} · ${c.wire_gauge || '2.5mm²'}`,
      value: `${c.breaker_a || 16}A / Curva ${c.breaker_curve || 'B'}`,
      phase: c.phase || "A",
      accentColor: phColor,
      active: true
    });

    initialConnections.push({
      id: `c-busbar-to-circuit-${idx}`,
      from: "node-busbar",
      to: cId,
      type: "fase"
    });
  });

  return { nodes: initialNodes, connections: initialConnections };
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────────
export default function UnifilarDiagram() {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [projects, setProjects]  = useState([]);
  const [selectedId, setSelectedId] = useState(searchParams.get("project") || "");
  const [project, setProject]    = useState(null);
  const [metrics, setMetrics]    = useState(null);
  const [logoUrl, setLogoUrl]    = useState(DEFAULT_LOGO_URL);
  
  // Estados do Editor Interativo
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [editingField, setEditingField] = useState(null); // { nodeId, field }
  const [bgMode, setBgMode] = useState("gray"); // 'gray', 'coral', 'white', 'dark', 'grid'
  const [isSnapToGrid, setIsSnapToGrid] = useState(true);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 50, y: 30 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [activeTab, setActiveTab] = useState("interactive"); // 'interactive', 'unifilar'
  const [diagramModel, setDiagramModel] = useState("standard"); // 'standard', 'qgbt'
  const [historyCount, setHistoryCount] = useState(0);
  const [futureCount, setFutureCount] = useState(0);
  
  // Adicionar conexões interativamente
  const [connectToId, setConnectToId] = useState("");
  const [connectionType, setConnectionType] = useState("fase");

  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const fieldEditSnapshotRef = useRef(null);

  const selectedNode = (nodes || []).find(n => n.id === selectedNodeId);

  // Refs de estado para evitar fechamentos obsoletos no mousemove/mouseup
  const nodesRef = useRef(nodes);
  const connectionsRef = useRef(connections);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);

  const cloneLayout = (layoutNodes = nodesRef.current, layoutConnections = connectionsRef.current) => ({
    nodes: JSON.parse(JSON.stringify(layoutNodes || [])),
    connections: JSON.parse(JSON.stringify(layoutConnections || [])),
  });

  const syncHistoryCounters = () => {
    setHistoryCount(historyRef.current.length);
    setFutureCount(futureRef.current.length);
  };

  const clearHistory = () => {
    historyRef.current = [];
    futureRef.current = [];
    syncHistoryCounters();
  };

  const pushHistory = (snapshot = cloneLayout()) => {
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), snapshot];
    futureRef.current = [];
    syncHistoryCounters();
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target && typeof ev.target.result === "string") {
        setLogoUrl(ev.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  
  useEffect(() => {
    if (!selectedId) return;
    backend.entities.Project.get(selectedId).then(p => {
      setProject(p); 
      const projMetrics = calcProjectMetrics(p);
      setMetrics(projMetrics);
      
      // Carrega o layout do diagrama se houver
      if (p.diagram_layout) {
        try {
          const layout = typeof p.diagram_layout === "string" ? JSON.parse(p.diagram_layout) : p.diagram_layout;
          if (layout && Array.isArray(layout.nodes) && layout.nodes.length > 0) {
            setNodes(layout.nodes);
            setConnections(layout.connections || []);
            clearHistory();
            return;
          }
        } catch (e) {
          console.error("Erro ao ler diagram_layout:", e);
        }
      }
      
      // Se não houver diagrama salvo no banco, nós auto-geramos a partir dos circuitos de forma transparente!
      const defaultLayout = generateDefaultNodesAndConnections(p, projMetrics);
      setNodes(defaultLayout.nodes);
      setConnections(defaultLayout.connections);
      clearHistory();
    });
  }, [selectedId]);

  // Lógica de Salvar no Banco (com suporte a salvamento automático silencioso)
  const handleSaveDiagram = async (currentNodes = nodes, currentConnections = connections, silent = false) => {
    if (!selectedId) return;
    const layoutObj = {
      nodes: currentNodes,
      connections: currentConnections
    };
    try {
      const updated = await backend.entities.Project.update(selectedId, {
        diagram_layout: layoutObj
      });
      setProject(updated);
      if (!silent) {
        toast({
          title: "Salvo com sucesso!",
          description: "O diagrama vetorial interativo foi salvo no banco de dados.",
        });
      }
    } catch {
      if (!silent) {
        toast({
          title: "Erro ao salvar",
          description: "Falha na comunicação com o banco local.",
          variant: "destructive"
        });
      }
    }
  };

  const applyLayoutSnapshot = (snapshot, { save = true } = {}) => {
    setNodes(snapshot.nodes);
    setConnections(snapshot.connections);
    nodesRef.current = snapshot.nodes;
    connectionsRef.current = snapshot.connections;
    if (save) handleSaveDiagram(snapshot.nodes, snapshot.connections, true);
  };

  const commitDiagram = (nextNodes, nextConnections = connections, { save = true, selectId = selectedNodeId } = {}) => {
    pushHistory();
    setNodes(nextNodes);
    setConnections(nextConnections);
    nodesRef.current = nextNodes;
    connectionsRef.current = nextConnections;
    setSelectedNodeId(selectId);
    if (save) handleSaveDiagram(nextNodes, nextConnections, true);
  };

  const getLayoutBounds = (layoutNodes = nodesRef.current) => {
    const validNodes = (layoutNodes || []).filter(n => Number.isFinite(Number(n.x)) && Number.isFinite(Number(n.y)));
    if (validNodes.length === 0) return null;

    const minX = Math.min(...validNodes.map(n => Number(n.x)));
    const minY = Math.min(...validNodes.map(n => Number(n.y)));
    const maxX = Math.max(...validNodes.map(n => Number(n.x) + FLOW_NODE_WIDTH));
    const maxY = Math.max(...validNodes.map(n => Number(n.y) + FLOW_NODE_HEIGHT));

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(maxX - minX, FLOW_NODE_WIDTH),
      height: Math.max(maxY - minY, FLOW_NODE_HEIGHT),
    };
  };

  const handleFitToDiagram = () => {
    const bounds = getLayoutBounds();
    const canvas = canvasRef.current;
    if (!bounds || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const padding = 56;
    const usableWidth = Math.max(rect.width - padding * 2, FLOW_NODE_WIDTH);
    const usableHeight = Math.max(rect.height - padding * 2, FLOW_NODE_HEIGHT);
    const nextScale = Math.min(1.5, Math.max(0.25, Math.min(
      usableWidth / bounds.width,
      usableHeight / bounds.height
    )));

    setScale(Number(nextScale.toFixed(2)));
    setPan({
      x: Math.round((rect.width - bounds.width * nextScale) / 2 - bounds.minX * nextScale),
      y: Math.round((rect.height - bounds.height * nextScale) / 2 - bounds.minY * nextScale),
    });
  };

  const beginNodeFieldEdit = () => {
    if (!fieldEditSnapshotRef.current) {
      fieldEditSnapshotRef.current = cloneLayout();
    }
  };

  const finishNodeFieldEdit = () => {
    const beforeEdit = fieldEditSnapshotRef.current;
    fieldEditSnapshotRef.current = null;

    if (beforeEdit) {
      const afterEdit = cloneLayout();
      if (JSON.stringify(beforeEdit) !== JSON.stringify(afterEdit)) {
        pushHistory(beforeEdit);
      }
    }

    setEditingField(null);
    handleSaveDiagram(nodesRef.current, connectionsRef.current, true);
  };

  const handleUndo = () => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    futureRef.current = [...futureRef.current.slice(-(MAX_HISTORY - 1)), cloneLayout()];
    syncHistoryCounters();
    applyLayoutSnapshot(previous);
    setSelectedNodeId(null);
  };

  const handleRedo = () => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), cloneLayout()];
    syncHistoryCounters();
    applyLayoutSnapshot(next);
    setSelectedNodeId(null);
  };

  // Gerador Automático NBR 5410 a partir de Circuitos
  const handleAutoGenerate = () => {
    if (!project) return;
    const defaultLayout = generateDefaultNodesAndConnections(project, metrics);
    commitDiagram(defaultLayout.nodes, defaultLayout.connections, { selectId: null });
    toast({
      title: "Diagrama Auto-Gerado",
      description: "Importado os circuitos do projeto para nós organizados.",
    });
  };

  // Drag dos Nós (Auto-salva no término)
  const handleNodeMouseDown = (e, node) => {
    if (
      e.target.closest("input") || 
      e.target.closest("button") || 
      e.target.closest("select") || 
      e.target.closest(".editable-text")
    ) {
      return; 
    }
    e.stopPropagation();
    setSelectedNodeId(node.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = Number(node.x) || 0;
    const initialY = Number(node.y) || 0;
    const beforeDrag = cloneLayout();
    let didMove = false;

    const handleMouseMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      let newX = initialX + dx;
      let newY = initialY + dy;

      if (isSnapToGrid) {
        newX = Math.round(newX / 20) * 20;
        newY = Math.round(newY / 20) * 20;
      }

      didMove = newX !== initialX || newY !== initialY;
      const updatedNodes = (nodesRef.current || []).map(n => n.id === node.id ? { ...n, x: newX, y: newY } : n);
      nodesRef.current = updatedNodes;
      setNodes(updatedNodes);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      // Auto-salvar no mouseup do arrasto do nó
      if (didMove) pushHistory(beforeDrag);
      handleSaveDiagram(nodesRef.current, connectionsRef.current, true);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Drag do Canvas (Pan) — Vinculado ao document para maior suavidade
  const handleCanvasMouseDown = (e) => {
    if (e.target.closest(".node-card") || e.target.closest("button") || e.target.closest("select") || e.target.closest(".editable-text")) {
      return;
    }
    e.preventDefault();
    setIsDraggingCanvas(true);
    
    const startX = e.clientX - pan.x;
    const startY = e.clientY - pan.y;

    const handleMouseMove = (moveEvent) => {
      setPan({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY
      });
    };

    const handleMouseUp = () => {
      setIsDraggingCanvas(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // Zoom Dinâmico Centralizado no Cursor (AutoCAD feel)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      setScale(prevScale => {
        const zoomFactor = 1.08;
        let newScale = prevScale;
        if (e.deltaY < 0) {
          newScale = Math.min(3.0, prevScale * zoomFactor);
        } else {
          newScale = Math.max(0.15, prevScale / zoomFactor);
        }
        
        setPan(prevPan => {
          const currentX = (mouseX - prevPan.x) / prevScale;
          const currentY = (mouseY - prevPan.y) / prevScale;
          return {
            x: mouseX - currentX * newScale,
            y: mouseY - currentY * newScale
          };
        });
        
        return newScale;
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Atalhos do teclado do editor.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        document.activeElement && (
          document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.getAttribute("contenteditable") === "true" ||
          document.activeElement.closest("[contenteditable]")
        )
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      const isModifierPressed = e.metaKey || e.ctrlKey;

      if (isModifierPressed && key === "s") {
        e.preventDefault();
        handleSaveDiagram(nodesRef.current, connectionsRef.current);
        return;
      }

      if (isModifierPressed && key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isModifierPressed && key === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (isModifierPressed && key === "d") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDuplicateNode();
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setSelectedNodeId(null);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedNodeId) {
          e.preventDefault();
          handleDeleteNode(selectedNodeId);
          toast({
            title: "Componente excluído",
            description: "O componente selecionado foi removido através do teclado.",
          });
        }
        return;
      }

      const PAN_SPEED = 30;
      const moveStep = e.shiftKey ? 5 : 20;
      if (e.key === "ArrowUp" && selectedNodeId) {
        e.preventDefault();
        moveSelectedNode(0, -moveStep);
      } else if (e.key === "ArrowDown" && selectedNodeId) {
        e.preventDefault();
        moveSelectedNode(0, moveStep);
      } else if (e.key === "ArrowLeft" && selectedNodeId) {
        e.preventDefault();
        moveSelectedNode(-moveStep, 0);
      } else if (e.key === "ArrowRight" && selectedNodeId) {
        e.preventDefault();
        moveSelectedNode(moveStep, 0);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPan(prev => ({ ...prev, y: prev.y + PAN_SPEED }));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPan(prev => ({ ...prev, y: prev.y - PAN_SPEED }));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPan(prev => ({ ...prev, x: prev.x + PAN_SPEED }));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPan(prev => ({ ...prev, x: prev.x - PAN_SPEED }));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedNodeId, nodes, connections]);

  // Modificações de campo do Nós
  const updateNodeField = (nodeId, field, value, { save = false, trackHistory = false } = {}) => {
    const currentNodes = nodesRef.current || [];
    const currentNode = currentNodes.find(n => n.id === nodeId);
    if (!currentNode || currentNode[field] === value) return;

    if (trackHistory) pushHistory(cloneLayout(currentNodes, connectionsRef.current));

    const updated = currentNodes.map(n => n.id === nodeId ? { ...n, [field]: value } : n);
    setNodes(updated);
    nodesRef.current = updated;
    if (save) handleSaveDiagram(updated, connectionsRef.current, true);
  };

  // Excluir nó com auto-salvar
  const handleDeleteNode = (nodeId) => {
    const currentNodes = nodesRef.current || [];
    const currentConnections = connectionsRef.current || [];
    const updatedNodes = currentNodes.filter(n => n.id !== nodeId);
    const updatedConns = currentConnections.filter(c => c.from !== nodeId && c.to !== nodeId);
    commitDiagram(updatedNodes, updatedConns, { selectId: selectedNodeId === nodeId ? null : selectedNodeId });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Adicionar nó filho inline com auto-salvar
  const handleAddChildNode = (parentNode) => {
    const newId = `node-custom-${Date.now()}`;
    const newNode = {
      id: newId,
      type: "circuit",
      x: (Number(parentNode.x) || 0) + 260,
      y: Number(parentNode.y) || 0,
      title: "Inserir subtítulo",
      subtitle: "Inserir dados",
      value: "Ajustar",
      phase: parentNode.phase || "A",
      accentColor: parentNode.accentColor || "#eb5e4a",
      active: true
    };
    const updatedNodes = [...(nodesRef.current || []), newNode];
    const updatedConns = [...(connectionsRef.current || []), {
      id: `conn-custom-${Date.now()}`,
      from: parentNode.id,
      to: newId,
      type: "fase"
    }];
    commitDiagram(updatedNodes, updatedConns, { selectId: newId });
  };

  // Criar nó customizado na barra de ferramentas com auto-salvar
  const handleAddNodeFromToolbox = (type) => {
    const newId = `node-toolbox-${Date.now()}`;
    const defaultData = {
      feed: { title: "ALIMENTAÇÃO", subtitle: "220V Mono", val: "Entrada", clr: "#eb5e4a" },
      breaker: { title: "DISJUNTOR", subtitle: "20A / Curva B", val: "20A", clr: "#00d8b8" },
      dr: { title: "IDR GERAL", subtitle: "Diferencial 30mA", val: "40A", clr: "#005188" },
      dps: { title: "DPS CLASSE II", subtitle: "Surto 15kA", val: "275V", clr: "#dc2626" },
      busbar: { title: "BARRAMENTO", subtitle: "Fases", val: "Cobre", clr: "#eab308" },
      circuit: { title: "CIRCUITO FINAL", subtitle: "Tomada Geral", val: "16A", clr: "#16a34a" },
      annotation: { title: "Nota Técnica", subtitle: "Norma NBR 5410", val: "Texto livre", clr: "#52627a" },
    }[type];

    const newNode = {
      id: newId,
      type,
      x: Math.round(((-pan.x + 100) / scale) / 20) * 20,
      y: Math.round(((-pan.y + 120) / scale) / 20) * 20,
      title: defaultData.title,
      subtitle: defaultData.subtitle,
      value: defaultData.val,
      phase: "A",
      accentColor: defaultData.clr,
      active: true
    };

    const updatedNodes = [...(nodesRef.current || []), newNode];
    commitDiagram(updatedNodes, connectionsRef.current, { selectId: newId });
  };

  // Lógica de Conexão com auto-salvar
  const handleAddConnection = () => {
    if (!selectedNodeId || !connectToId) return;
    const currentConnections = connectionsRef.current || [];
    const exists = currentConnections.some(c => c.from === selectedNodeId && c.to === connectToId);
    if (exists) {
      toast({
        title: "Conexão existente",
        description: "Esses dois nós já estão conectados.",
        variant: "warning"
      });
      return;
    }
    const updatedConns = [...currentConnections, {
      id: `conn-${Date.now()}`,
      from: selectedNodeId,
      to: connectToId,
      type: connectionType
    }];
    commitDiagram(nodesRef.current, updatedConns);
    setConnectToId("");
  };

  // Remover conexão com auto-salvar
  const handleRemoveConnection = (connId) => {
    const updatedConns = (connectionsRef.current || []).filter(c => c.id !== connId);
    commitDiagram(nodesRef.current, updatedConns);
  };

  const handleDuplicateNode = () => {
    const sourceNode = (nodesRef.current || []).find(n => n.id === selectedNodeId);
    if (!sourceNode) return;

    const duplicateId = `node-copy-${Date.now()}`;
    const duplicateNode = {
      ...sourceNode,
      id: duplicateId,
      x: (Number(sourceNode.x) || 0) + 40,
      y: (Number(sourceNode.y) || 0) + 40,
      title: sourceNode.title ? `${sourceNode.title} copia` : "Componente copia",
    };

    commitDiagram([...(nodesRef.current || []), duplicateNode], connectionsRef.current, { selectId: duplicateId });
    toast({
      title: "Componente duplicado",
      description: "A cópia foi adicionada ao lado do componente selecionado.",
    });
  };

  const moveSelectedNode = (dx, dy) => {
    if (!selectedNodeId) return;
    const currentNodes = nodesRef.current || [];
    const targetNode = currentNodes.find(n => n.id === selectedNodeId);
    if (!targetNode) return;

    const updatedNodes = currentNodes.map(n => {
      if (n.id !== selectedNodeId) return n;
      return {
        ...n,
        x: (Number(n.x) || 0) + dx,
        y: (Number(n.y) || 0) + dy,
      };
    });

    commitDiagram(updatedNodes, connectionsRef.current, { selectId: selectedNodeId });
  };

  // Simulação DR Test disparado com auto-salvar
  const handleTestDR = (drNode) => {
    const newActiveState = !drNode.active;
    const currentConnections = connectionsRef.current || [];
    let updatedNodes = (nodesRef.current || []).map(n => n.id === drNode.id ? { ...n, active: newActiveState } : n);
    
    if (!newActiveState) {
      const trippedNodeIds = new Set();
      const queue = [drNode.id];
      
      while (queue.length > 0) {
        const currId = queue.shift();
        trippedNodeIds.add(currId);
        
        const children = currentConnections
          .filter(c => c.from === currId)
          .map(c => c.to);
          
        children.forEach(childId => {
          if (!trippedNodeIds.has(childId)) queue.push(childId);
        });
      }
      
      updatedNodes = updatedNodes.map(n => {
        if (trippedNodeIds.has(n.id) && n.id !== drNode.id) {
          return { ...n, active: false };
        }
        return n;
      });
      
      commitDiagram(updatedNodes, currentConnections, { selectId: drNode.id });

      toast({
        title: "IDR Disparado!",
        description: "Teste do Diferencial Residual simulado. Todos os disjuntores a jusante foram desligados.",
        variant: "destructive"
      });
    } else {
      commitDiagram(updatedNodes, currentConnections, { selectId: drNode.id });
      toast({
        title: "IDR Armado",
        description: "Diferencial Residual pronto para proteção.",
      });
    }
  };

  // Auto-Arrange (Organização BFS técnica em camadas) com auto-salvar
  const handleAutoArrange = () => {
    const currentNodes = nodesRef.current || [];
    const currentConnections = connectionsRef.current || [];
    if (currentNodes.length === 0) return;
    
    const incomingCount = {};
    currentNodes.forEach(n => incomingCount[n.id] = 0);
    currentConnections.forEach(c => {
      if (incomingCount[c.to] !== undefined) incomingCount[c.to]++;
    });
    
    const roots = currentNodes.filter(n => incomingCount[n.id] === 0);
    const levels = {};
    const visited = new Set();
    const queue = roots.map(r => ({ id: r.id, level: 0 }));

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);

      if (!levels[level]) levels[level] = [];
      levels[level].push(id);

      const children = currentConnections.filter(c => c.from === id).map(c => c.to);
      children.forEach(childId => {
        queue.push({ id: childId, level: level + 1 });
      });
    }

    currentNodes.forEach(n => {
      if (!visited.has(n.id)) {
        const maxLevel = Math.max(...Object.keys(levels).map(Number), -1);
        const orphanLevel = maxLevel + 1;
        if (!levels[orphanLevel]) levels[orphanLevel] = [];
        levels[orphanLevel].push(n.id);
      }
    });

    const spacingX = 280;
    const spacingY = 130;
    const newNodes = currentNodes.map(n => ({ ...n }));

    Object.keys(levels).forEach(levelStr => {
      const level = Number(levelStr);
      const nodeIds = levels[level];
      const spacing = spacingY;

      nodeIds.forEach((id, idx) => {
        const target = newNodes.find(n => n.id === id);
        if (target) {
          if (level === 0) {
            target.x = 80;
            target.y = 80 + idx * spacing;
          } else if (level === 1) {
            if (target.type === "dps") {
              target.x = 360;
              target.y = 80;
            } else {
              target.x = 80;
              target.y = 200 + idx * spacing;
            }
          } else if (level === 2 && target.type === "dr") {
            target.x = 80;
            target.y = 320 + idx * spacing;
          } else if (level === 3 && target.type === "busbar") {
            target.x = 80;
            target.y = 440;
          } else {
            const gridCol = idx % 3;
            const gridRow = Math.floor(idx / 3);
            target.x = 360 + gridCol * spacingX;
            target.y = 260 + gridRow * spacing;
          }
        }
      });
    });

    commitDiagram(newNodes, currentConnections);
    toast({
      title: "Cores e Layout Organizados",
      description: "As posições dos componentes foram alinhadas.",
    });
  };

  // Exportar SVG
  const exportInteractiveSVG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `diagrama_interativo_${project?.name || "projeto"}.svg`;
    a.click();
  };

  // Visualizar / Imprimir Legado
  const handlePrintLegacy = (size) => {
    const svg = document.querySelector("#legacy-svg-container svg");
    if (!svg) return;
    const svgContent = new XMLSerializer().serializeToString(svg);
    openSVGPrint({
      svgContent,
      paperSize: size,
      projectName: project?.name,
      logoUrl,
      projectInfo: {
        clientName: project?.client_name,
        address: project?.address,
      },
    });
  };

  const exportLegacySVG = () => {
    const svg = document.querySelector("#legacy-svg-container svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${diagramModel === "qgbt" ? "diagrama_qgbt" : "diagrama_cad"}_${project?.name || "projeto"}.svg`;
    a.click();
  };

  const downloadCurrentSheetPDF = async () => {
    const svg = document.querySelector("#legacy-svg-container svg");
    if (!svg) {
      setActiveTab("unifilar");
      toast({
        title: "Prancha A0 pronta na aba Unifilar",
        description: "Clique novamente em Prancha A0 para baixar o PDF executivo.",
      });
      return;
    }

    try {
      const clone = svg.cloneNode(true);
      clone.setAttribute("width", "1189");
      clone.setAttribute("height", "841");
      clone.setAttribute("viewBox", clone.getAttribute("viewBox") || "0 0 1189 841");
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

      const svgContent = new XMLSerializer().serializeToString(clone);
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [1189, 841],
        compress: true,
      });

      doc.setProperties({
        title: `${project?.name || "Projeto"} - ${diagramModel === "qgbt" ? "Prancha QGBT" : "Prancha A0"}`,
        subject: diagramModel === "qgbt" ? "Diagrama QGBT com alimentadores dos quadros" : "Diagrama unifilar e memoria do quadro",
        creator: "Volt AI",
      });

      await doc.addSvgAsImage(svgContent, 0, 0, 1189, 841, "board-sheet", "FAST");
      doc.save(`${diagramModel === "qgbt" ? "prancha_qgbt" : "prancha_a0"}_${safeFileName(project?.name)}.pdf`);
    } catch (err) {
      console.error("Erro ao exportar prancha A0:", err);
      toast({
        title: "Erro ao gerar PDF",
        description: "Não foi possível converter a prancha atual para PDF.",
        variant: "destructive",
      });
    }
  };

  const px = Number(pan.x) || 0;
  const py = Number(pan.y) || 0;

  return (
    <div className="w-full max-w-none space-y-5 pb-20">
      <PageHeader
        icon={GitBranch}
        title="Diagrama Vetorial — NBR 5410"
        subtitle="Editor de fluxo interativo e visualizador CAD clássico de fiação"
        actions={
          <>
            <Button variant="outline" size="sm" className="h-11 rounded-[12px]" onClick={() => setScale(s => Math.max(0.3, +(s - 0.1).toFixed(2)))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="flex h-11 min-w-16 items-center justify-center rounded-[12px] px-2 text-sm font-extrabold text-[#687386]">
              {Math.round(scale * 100)}%
            </span>
            <Button variant="outline" size="sm" className="h-11 rounded-[12px]" onClick={() => setScale(s => Math.min(2.0, +(s + 0.1).toFixed(2)))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-11 rounded-[12px] px-4 font-extrabold" onClick={() => { setScale(1); setPan({ x: 50, y: 30 }); }}>1:1</Button>
            
            {activeTab === "interactive" ? (
              <Button variant="outline" size="sm" className="h-11 rounded-[12px] px-4 font-extrabold" onClick={exportInteractiveSVG}>
                <Download className="w-4 h-4 mr-2" />SVG
              </Button>
            ) : (
              project && (
                <Button variant="outline" size="sm" className="h-11 rounded-[12px] px-4 font-extrabold" onClick={exportLegacySVG}>
                  <Download className="w-4 h-4 mr-2" />SVG CAD
                </Button>
              )
            )}

            {project && metrics && (
              <Button size="sm" className="h-11 rounded-[12px] px-4 font-extrabold" onClick={downloadCurrentSheetPDF}>
                <Download className="w-4 h-4 mr-2" />Prancha A0
              </Button>
            )}

            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[12px] border border-dashed border-[#BCEEE5] bg-white px-4 text-sm font-extrabold text-[#687386] transition hover:bg-[#F2FFFC]">
              <Upload className="w-4 h-4" />
              <img src={logoUrl || DEFAULT_LOGO_URL} className="h-6 object-contain" alt="Logo" />
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>

            {activeTab !== "interactive" && project && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-11 rounded-[12px] gap-2 px-4 font-extrabold">
                    <Printer className="w-4 h-4" />
                    Imprimir CAD
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {Object.keys(PAPER_SIZES).map(size => (
                    <DropdownMenuItem key={size} onClick={() => handlePrintLegacy(size)}>
                      <Printer className="w-4 h-4 mr-2" />
                      Formato {size}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      >
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        
        {/* Toggle de Modo: Editor Interativo vs. CADs Legados */}
        <div className="flex w-full shrink-0 flex-col gap-1 rounded-[14px] border border-[#BCEEE5] bg-white p-1 text-xs shadow-[0_8px_24px_rgba(15,23,42,0.04)] sm:w-auto sm:flex-row">
          {[
            { id: "interactive", label: "Editor" },
            { id: "unifilar", label: "Unifilar" }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={activeTab === tab.id ? { backgroundColor: "#00d8b8", color: "#ffffff" } : undefined}
              className={`h-9 rounded-[10px] px-4 font-extrabold transition-colors sm:min-w-[112px] ${
                activeTab === tab.id
                  ? "shadow-sm"
                  : "text-[#64748B] hover:bg-[#F2FFFC] hover:text-[#0f1728]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </PageHeader>

      {/* MÉTRICAS GERAIS */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[
            { l: "Potência Total",  v: `${(metrics.totalPower / 1000).toFixed(2)} kW` },
            { l: "Corrente Geral",  v: `${metrics.generalCurrent} A` },
            { l: "Disjuntor Geral", v: `${metrics.generalBreaker} A` },
            { l: "Desequilíbrio",   v: `${metrics.imbalance_pct}%`, alert: metrics.imbalance_pct > 10 },
          ].map(k => (
            <div key={k.l} className={`p-3 rounded-xl bg-card border ${k.alert ? "border-destructive/40" : "border-border/40"}`}>
              <p className="text-muted-foreground">{k.l}</p>
              <p className={`font-bold text-sm mt-0.5 ${k.alert ? "text-destructive" : "text-primary"}`}>{k.v}</p>
            </div>
          ))}
        </div>
      )}

      {project && activeTab === "unifilar" && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[#CDEFE8] bg-white p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)] md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900">Modelo do diagrama</h3>
            <p className="text-xs font-bold text-slate-500">Mantenha o modelo atual ou gere a prancha QGBT com os alimentadores dos quadros.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { id: "standard", label: "Quadro atual", sub: "Modelo existente" },
              { id: "qgbt", label: "QGBT", sub: "Alimentadores e medição" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDiagramModel(item.id)}
                className={`min-w-[190px] rounded-xl border px-4 py-3 text-left transition ${
                  diagramModel === item.id
                    ? "border-primary bg-[#EEF7FC] text-primary shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-[#BCEEE5]"
                }`}
              >
                <span className="block text-sm font-black">{item.label}</span>
                <span className="mt-0.5 block text-[11px] font-bold opacity-75">{item.sub}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!project ? (
        <div className="p-20 rounded-2xl bg-card border border-dashed border-border text-center">
          <GitBranch className="w-14 h-14 mx-auto text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground text-sm">Selecione um projeto para carregar o diagrama</p>
        </div>
      ) : (
        <>
          {activeTab === "interactive" ? (
            /* EDITOR DE FLUXO INTERATIVO */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              
              {/* TOOLBOX ESQUERDA (2 Colunas LG) */}
              <div className="lg:col-span-2 space-y-4 bg-white border border-[#CDEFE8] rounded-2xl p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                  Componentes
                </h3>
                <div className="flex flex-col gap-2">
                  {[
                    { type: "feed", label: "Entrada Rede", clr: "bg-[#eb5e4a]" },
                    { type: "breaker", label: "Disjuntor", clr: "bg-[#00d8b8]" },
                    { type: "dr", label: "Dispositivo DR", clr: "bg-[#005188]" },
                    { type: "dps", label: "Módulo DPS", clr: "bg-[#dc2626]" },
                    { type: "busbar", label: "Barramento", clr: "bg-[#eab308]" },
                    { type: "circuit", label: "Circuito Final", clr: "bg-[#16a34a]" },
                    { type: "annotation", label: "Nota de Texto", clr: "bg-[#52627a]" }
                  ].map(item => (
                    <button
                      key={item.type}
                      onClick={() => handleAddNodeFromToolbox(item.type)}
                      className="w-full flex items-center gap-2.5 text-left text-xs font-bold text-slate-700 px-3 py-2.5 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-[#F2FFFC] transition"
                    >
                      <span className={`w-3 h-3 rounded-full ${item.clr}`} />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Auto-Geração
                  </h3>
                  <Button
                    onClick={handleAutoGenerate}
                    className="w-full h-10 rounded-xl text-xs font-extrabold gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Importar Circuitos
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                    Recria a estrutura NBR 5410 padrão do projeto selecionado.
                  </p>
                </div>
              </div>

              {/* CANVAS CENTRAL (7 Colunas LG) */}
              <div className="lg:col-span-7 flex flex-col gap-3">
                {/* TOOLBAR SUPERIOR DO CANVAS */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#CDEFE8] px-4 py-3 rounded-2xl shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                  {/* Tema de Fundo */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-slate-700">Fundo:</span>
                    <div className="flex items-center gap-1.5">
                      {[
                        { id: "gray", label: "Cinza", color: "bg-[#f1f5f9] border border-gray-300" },
                        { id: "coral", label: "Coral", color: "bg-[#eb5e4a]" },
                        { id: "white", label: "Branco", color: "bg-white border border-gray-200" },
                        { id: "dark", label: "Escuro", color: "bg-[#0f172a]" },
                        { id: "grid", label: "Grade Blue", color: "bg-[#e0f2fe]" }
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setBgMode(t.id)}
                          title={t.label}
                          className={`w-5 h-5 rounded-full ${t.color} ${bgMode === t.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Controles de edição */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={historyCount === 0}
                        onClick={handleUndo}
                        title="Desfazer"
                        className="h-8 w-8 rounded-lg p-0"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={futureCount === 0}
                        onClick={handleRedo}
                        title="Refazer"
                        className="h-8 w-8 rounded-lg p-0"
                      >
                        <Redo2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-extrabold text-slate-700">
                      <input
                        type="checkbox"
                        checked={isSnapToGrid}
                        onChange={(e) => setIsSnapToGrid(e.target.checked)}
                        className="w-4 h-4 accent-primary rounded"
                      />
                      Grade CAD (Snapping)
                    </label>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFitToDiagram}
                      className="h-9 rounded-xl text-xs font-extrabold"
                    >
                      <Maximize2 className="w-3.5 h-3.5 mr-1" />
                      Enquadrar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAutoArrange}
                      className="h-9 rounded-xl text-xs font-extrabold"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" />
                      Auto-Alinhar
                    </Button>
                    
                    <Button
                      onClick={() => handleSaveDiagram()}
                      size="sm"
                      className="h-9 rounded-xl text-xs font-extrabold"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" />
                      Salvar Layout
                    </Button>
                  </div>
                </div>

                {/* AREA DO CANVAS */}
                <div
                  ref={canvasRef}
                  className="relative border border-gray-200 rounded-2xl overflow-hidden w-full h-[600px] shadow-inner select-none transition-colors duration-300"
                  style={{
                    backgroundColor: bgMode === "coral" ? "#eb5e4a" : bgMode === "dark" ? "#0f172a" : bgMode === "gray" ? "#f1f5f9" : "#fdfdfc",
                    backgroundImage: bgMode === "coral"
                      ? "radial-gradient(rgba(255, 255, 255, 0.18) 1.5px, transparent 1.5px)"
                      : bgMode === "dark"
                      ? "radial-gradient(rgba(255, 255, 255, 0.06) 1.5px, transparent 1.5px)"
                      : bgMode === "grid"
                      ? "radial-gradient(#bae6fd 1.5px, transparent 1.5px), radial-gradient(#bae6fd 1.5px, #e0f2fe 1.5px)"
                      : bgMode === "gray"
                      ? "radial-gradient(#cbd5e1 1.5px, transparent 1.5px)"
                      : "radial-gradient(#e2e8f0 1.5px, transparent 1.5px)",
                    backgroundSize: "20px 20px",
                    cursor: isDraggingCanvas ? "grabbing" : "grab"
                  }}
                  onMouseDown={handleCanvasMouseDown}
                >
                  {/* CANVAS INNER CONTAINER (ZOOM & PAN) */}
                  <div
                    style={{
                      transform: `translate(${px}px, ${py}px) scale(${scale})`,
                      transformOrigin: "0 0",
                      width: "3000px",
                      height: "3000px"
                    }}
                  >
                    {/* SVG Connections Canvas */}
                    <svg ref={svgRef} className="absolute inset-0 pointer-events-none w-full h-full">
                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill={bgMode === "coral" ? "white" : bgMode === "dark" ? "#cbd5e1" : "#475569"} />
                        </marker>
                      </defs>
                      {(connections || []).map(conn => {
                        const fromNode = (nodes || []).find(n => n.id === conn.from);
                        const toNode = (nodes || []).find(n => n.id === conn.to);
                        if (!fromNode || !toNode) return null;
                        
                        const pathData = drawPath(fromNode, toNode);
                        const isNodeActive = fromNode.active !== false;

                        return (
                          <path
                            key={conn.id}
                            d={pathData}
                            fill="none"
                            stroke={bgMode === "coral" ? "white" : conn.type === "neutro" ? "#00d8b8" : conn.type === "terra" ? "#16a34a" : bgMode === "dark" ? "#94a3b8" : "#475569"}
                            strokeWidth="2.2"
                            strokeDasharray={conn.type === "neutro" ? "4,4" : "none"}
                            markerEnd="url(#arrow)"
                            opacity={isNodeActive ? 0.85 : 0.3}
                            className="transition-all duration-300"
                          />
                        );
                      })}
                    </svg>

                    {/* Nodes Render Loop */}
                    {(nodes || []).map(node => {
                      const isActive = node.active !== false;
                      const accent = node.accentColor || "#00d8b8";
                      const isSelected = selectedNodeId === node.id;
                      
                      return (
                        <div
                          key={node.id}
                          className={`absolute node-card bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border flex items-center gap-3 select-none hover:shadow-[0_14px_45px_rgba(0,0,0,0.1)] transition-all duration-200 cursor-grab active:cursor-grabbing ${
                            isSelected ? "ring-2 ring-primary border-primary scale-[1.03]" : "border-slate-100"
                          }`}
                          style={{
                            left: Number(node.x) || 0,
                            top: Number(node.y) || 0,
                            width: `${FLOW_NODE_WIDTH}px`,
                            height: `${FLOW_NODE_HEIGHT}px`,
                            opacity: isActive ? 1 : 0.55,
                            borderLeft: `5px solid ${accent}`
                          }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node)}
                        >
                          {/* Inner color block matching reference image */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ml-3"
                            style={{
                              backgroundColor: `${accent}15`,
                              border: `1.5px solid ${accent}40`,
                              color: accent
                            }}
                          >
                            {node.type === "feed" && <Upload className="w-5 h-5" />}
                            {node.type === "breaker" && <GitBranch className="w-5 h-5 rotate-90" />}
                            {node.type === "dr" && <ShieldCheck className="w-5 h-5" />}
                            {node.type === "dps" && <Zap className="w-5 h-5" />}
                            {node.type === "busbar" && <Grid className="w-5 h-5" />}
                            {node.type === "circuit" && <Calculator className="w-5 h-5" />}
                            {node.type === "annotation" && <FileText className="w-5 h-5" />}
                          </div>

                          {/* Text info with Inline Editing support */}
                          <div className="flex-1 min-w-0 pr-6 leading-tight">
                            <div className="h-[18px]">
                              {editingField?.nodeId === node.id && editingField?.field === "title" ? (
                                <input
                                  autoFocus
                                  className="text-xs font-bold text-gray-900 border-b border-primary outline-none w-full bg-transparent p-0"
                                  value={node.title}
                                  onFocus={beginNodeFieldEdit}
                                  onChange={e => updateNodeField(node.id, "title", e.target.value)}
                                  onBlur={finishNodeFieldEdit}
                                  onKeyDown={e => { if (e.key === "Enter") finishNodeFieldEdit(); }}
                                />
                              ) : (
                                <p
                                  className="text-xs font-extrabold text-gray-900 truncate cursor-pointer hover:bg-slate-100 p-0.5 rounded editable-text"
                                  onClick={(e) => { e.stopPropagation(); setEditingField({ nodeId: node.id, field: "title" }); }}
                                >
                                  {node.title || "Inserir..."}
                                </p>
                              )}
                            </div>

                            <div className="h-[14px] mt-0.5">
                              {editingField?.nodeId === node.id && editingField?.field === "subtitle" ? (
                                <input
                                  autoFocus
                                  className="text-[10px] text-gray-500 border-b border-primary outline-none w-full bg-transparent p-0"
                                  value={node.subtitle}
                                  onFocus={beginNodeFieldEdit}
                                  onChange={e => updateNodeField(node.id, "subtitle", e.target.value)}
                                  onBlur={finishNodeFieldEdit}
                                  onKeyDown={e => { if (e.key === "Enter") finishNodeFieldEdit(); }}
                                />
                              ) : (
                                <p
                                  className="text-[10px] text-gray-500 font-semibold truncate cursor-pointer hover:bg-slate-100 p-0.5 rounded editable-text"
                                  onClick={(e) => { e.stopPropagation(); setEditingField({ nodeId: node.id, field: "subtitle" }); }}
                                >
                                  {node.subtitle || "Inserir..."}
                                </p>
                              )}
                            </div>

                            {/* Tags de Apoio / Técnicas */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[8.5px] font-black tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                {node.value || "Parâmetro"}
                              </span>
                              {node.phase && (
                                <span className="text-[8.5px] font-black tracking-wide px-1.5 py-0.5 bg-[#EEF7FC] text-[#00d8b8] rounded">
                                  Fase {node.phase}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Controles do Card */}
                          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
                            {/* Deletar (×) */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteNode(node.id); }}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Excluir componente"
                            >
                              <span className="text-xs font-black">×</span>
                            </button>
                            
                            {/* Sibling connect (+) */}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAddChildNode(node); }}
                              className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition"
                              title="Inserir conectado"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>

                          {/* Simulação DR (botão TEST) */}
                          {node.type === "dr" && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleTestDR(node); }}
                              className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wider transition ${
                                isActive ? "bg-[#005188] text-white hover:bg-[#004270]" : "bg-slate-200 text-slate-500"
                              }`}
                            >
                              T
                            </button>
                          )}

                          {/* Chave ON/OFF dos disjuntores */}
                          {(node.type === "breaker" || node.type === "circuit") && (
                            <button
                              onClick={(e) => { e.stopPropagation(); updateNodeField(node.id, "active", !isActive, { save: true, trackHistory: true }); }}
                              className={`absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-black tracking-wider transition ${
                                isActive ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-red-600 text-white hover:bg-red-700"
                              }`}
                            >
                              {isActive ? "ON" : "OFF"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <p className="text-[11px] text-[#687386] font-semibold flex items-center gap-1.5 justify-center">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" />
                  {(nodes || []).length} componentes · {(connections || []).length} ligações · {isSnapToGrid ? "grade ativa" : "grade livre"}
                </p>
              </div>

              {/* PAINEL DE CONFIGURAÇÕES DIREITA (3 Colunas LG) */}
              <div className="lg:col-span-3 space-y-4 bg-white border border-[#CDEFE8] rounded-2xl p-4 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <Settings className="w-3.5 h-3.5 text-primary" />
                  Propriedades do Nó
                </h3>

                {selectedNode ? (
                  <div className="space-y-4 text-xs font-semibold text-slate-700">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDuplicateNode}
                        className="h-9 rounded-xl text-xs font-extrabold"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Duplicar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleDeleteNode(selectedNode.id)}
                        className="h-9 rounded-xl border-red-200 text-xs font-extrabold text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Excluir
                      </Button>
                    </div>

                    <div>
                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold">Título</p>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-primary font-bold"
                        value={selectedNode.title || ""}
                        onFocus={beginNodeFieldEdit}
                        onChange={e => updateNodeField(selectedNode.id, "title", e.target.value)}
                        onBlur={finishNodeFieldEdit}
                      />
                    </div>

                    <div>
                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold">Subtítulo</p>
                      <input
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-primary"
                        value={selectedNode.subtitle || ""}
                        onFocus={beginNodeFieldEdit}
                        onChange={e => updateNodeField(selectedNode.id, "subtitle", e.target.value)}
                        onBlur={finishNodeFieldEdit}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold">Parâmetro</p>
                        <input
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-primary"
                          value={selectedNode.value || ""}
                          onFocus={beginNodeFieldEdit}
                          onChange={e => updateNodeField(selectedNode.id, "value", e.target.value)}
                          onBlur={finishNodeFieldEdit}
                        />
                      </div>

                      <div>
                        <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold">Fase</p>
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 bg-white"
                          value={selectedNode.phase || "A"}
                          onChange={e => updateNodeField(selectedNode.id, "phase", e.target.value, { save: true, trackHistory: true })}
                        >
                          <option value="A">Fase A</option>
                          <option value="B">Fase B</option>
                          <option value="C">Fase C</option>
                          <option value="AB">Bifásico A/B</option>
                          <option value="BC">Bifásico B/C</option>
                          <option value="ABC">Trifásico A/B/C</option>
                          <option value="N">Neutro (N)</option>
                          <option value="PE">Terra (PE)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="text-slate-500 mb-1 text-[10px] uppercase font-bold">Cor de Destaque</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        {[
                          { val: "#eb5e4a", name: "Coral" },
                          { val: "#00d8b8", name: "Verde padrão" },
                          { val: "#005188", name: "DR Blue" },
                          { val: "#dc2626", name: "Red" },
                          { val: "#eab308", name: "Yellow" },
                          { val: "#16a34a", name: "PE Green" },
                          { val: "#00d8b8", name: "Neutro Blue" },
                          { val: "#52627a", name: "Gray" }
                        ].map(c => (
                          <button
                            key={c.val}
                            onClick={() => updateNodeField(selectedNode.id, "accentColor", c.val, { save: true, trackHistory: true })}
                            className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center"
                            style={{ backgroundColor: c.val }}
                            title={c.name}
                          >
                            {selectedNode.accentColor === c.val && <Check className="w-3.5 h-3.5 text-white" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* CONECTAR CABOS / WIRES */}
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-slate-800 font-black mb-2 text-xs uppercase tracking-wide">
                        Conectar Fiação (a jusante)
                      </p>
                      <div className="space-y-2">
                        <select
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white text-slate-700"
                          value={connectToId}
                          onChange={e => setConnectToId(e.target.value)}
                        >
                          <option value="">-- Selecionar Destino --</option>
                          {nodes
                            .filter(n => n.id !== selectedNode.id)
                            .map(n => (
                              <option key={n.id} value={n.id}>
                                {n.title} ({n.subtitle})
                              </option>
                            ))}
                        </select>

                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { id: "fase", label: "Fase" },
                            { id: "neutro", label: "Neutro" },
                            { id: "terra", label: "Terra" }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setConnectionType(t.id)}
                              className={`py-1 rounded-lg text-[10px] font-bold border ${
                                connectionType === t.id ? 'bg-[#EEF7FC] border-[#00d8b8] text-[#00d8b8]' : 'border-slate-200 text-slate-600'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        <Button
                          onClick={handleAddConnection}
                          disabled={!connectToId}
                          className="w-full h-9 rounded-xl text-xs font-extrabold gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Ligar Condutor
                        </Button>
                      </div>
                    </div>

                    {/* LISTAGEM DE CONEXÕES ATIVAS */}
                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <p className="text-slate-500 text-[10px] uppercase font-bold">Conexões de Saída</p>
                      {connections.filter(c => c.from === selectedNode.id).length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic">Nenhuma saída conectada</p>
                      ) : (
                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                          {connections
                            .filter(c => c.from === selectedNode.id)
                            .map(c => {
                              const destNode = nodes.find(n => n.id === c.to);
                              return (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-[10px]">
                                  <span className="truncate flex-1 font-bold text-slate-700">
                                    → {destNode?.title || "Componente"} ({c.type})
                                  </span>
                                  <button
                                    onClick={() => handleRemoveConnection(c.id)}
                                    className="text-red-500 hover:text-red-700 font-extrabold px-1"
                                  >
                                    Remover
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center text-muted-foreground text-xs italic">
                    Nenhum componente selecionado. Clique em um card para editar suas propriedades.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VISUALIZADORES CAD CLÁSSICOS (TAB CAD UNIFILAR / CAD TRIFILAR) */
            <div
              className="rounded-2xl border border-border/40 overflow-auto relative p-6 bg-slate-50"
              style={{ background: CAD_BG }}
              id="legacy-svg-container"
            >
              <div
                className="mx-auto"
                style={{
                  width: 1189 * scale,
                  height: 841 * scale,
                }}
              >
                <div style={{ width: 1189, height: 841, transformOrigin: "top left", transform: `scale(${scale})` }}>
                  {diagramModel === "qgbt" ? (
                    <QgbtDiagramSheetSVG project={project} metrics={metrics} />
                  ) : (
                    <ProfessionalBoardSheetSVG project={project} metrics={metrics} />
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
