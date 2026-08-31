import { useState, useEffect, useRef } from "react";
import { backend } from "@/api/backendClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GitBranch, Download } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { calcMainProtection } from "@/lib/electricalEngine";

function DiagramSVG({ project }) {
  const circuits = project?.circuits || [];
  const voltage = project?.voltage || 220;
  const supply = project?.supply_type || "Monofásico";
  const mainProtection = calcMainProtection(project);
  const svgRef = useRef(null);

  const PHASES = supply === "Trifásico" ? ["A", "B", "C"] : supply === "Bifásico" ? ["A", "B"] : ["A"];
  const W = 700;
  const circuitsPerRow = 3;
  const rows = Math.ceil(circuits.length / circuitsPerRow);
  const H = 340 + rows * 120;

  const downloadSVG = () => {
    const svg = svgRef.current;
    const data = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([data], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `diagrama_${project.name}.svg`; a.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadSVG}><Download className="w-4 h-4 mr-2" />Exportar SVG</Button>
      </div>
      <div className="bg-white rounded-2xl p-4 overflow-x-auto border border-border/40">
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
          style={{ fontFamily: "JetBrains Mono, monospace" }}>

          {/* Background */}
          <rect width={W} height={H} fill="#ffffff" rx="12" />

          {/* Title */}
          <text x="20" y="28" fill="#00d8b8" fontSize="13" fontWeight="bold">DIAGRAMA UNIFILAR</text>
          <text x="20" y="44" fill="#4b5563" fontSize="10">{project.name} — {voltage}V {supply}</text>
          <line x1="10" y1="52" x2={W - 10} y2="52" stroke="#e7e7e4" strokeWidth="1" />

          {/* Entrada de Energia */}
          <text x="20" y="78" fill="#6b7280" fontSize="9">ENTRADA</text>
          <rect x="20" y="85" width="80" height="30" rx="4" fill="none" stroke="#00d8b8" strokeWidth="1.5" />
          <text x="60" y="104" fill="#00d8b8" fontSize="10" textAnchor="middle">
            {voltage}V {supply === "Trifásico" ? "3F+N" : supply === "Bifásico" ? "2F+N" : "F+N"}
          </text>

          {/* Fio entrada */}
          <line x1="100" y1="100" x2="140" y2="100" stroke="#00d8b8" strokeWidth="2" />

          {/* DPS */}
          <rect x="140" y="82" width="50" height="36" rx="4" fill="none" stroke="#00d8b8" strokeWidth="1.5" />
          <text x="165" y="96" fill="#00d8b8" fontSize="8" textAnchor="middle">DPS</text>
          <text x="165" y="109" fill="#00d8b8" fontSize="8" textAnchor="middle">Cl.II</text>
          <line x1="190" y1="100" x2="220" y2="100" stroke="#00d8b8" strokeWidth="2" />

          {/* DR Geral */}
          <rect x="220" y="82" width="50" height="36" rx="4" fill="none" stroke="#004E82" strokeWidth="1.5" />
          <text x="245" y="95" fill="#004E82" fontSize="8" textAnchor="middle">IDR {mainProtection.dr.current}A</text>
          <text x="245" y="109" fill="#004E82" fontSize="8" textAnchor="middle">{mainProtection.dr.sensitivity_ma}mA</text>
          <line x1="270" y1="100" x2="310" y2="100" stroke="#00d8b8" strokeWidth="2" />

          {/* Disjuntor Geral */}
          <rect x="310" y="82" width="55" height="36" rx="4" fill="none" stroke="#123D5C" strokeWidth="1.5" />
          <text x="337" y="96" fill="#123D5C" fontSize="8" textAnchor="middle">DJ GERAL</text>
          <text x="337" y="109" fill="#123D5C" fontSize="8" textAnchor="middle">
            {mainProtection.breaker.poles}P {mainProtection.breaker.current}A
          </text>
          <line x1="365" y1="100" x2="400" y2="100" stroke="#00d8b8" strokeWidth="2" />

          {/* Barramento */}
          <rect x="400" y="86" width="15" height="28" rx="2" fill="#E6F2FA" stroke="#00d8b8" strokeWidth="1.5" />
          <text x="407" y="125" fill="#00d8b8" fontSize="8" textAnchor="middle">BUS</text>

          {/* Fases */}
          {PHASES.map((ph, pi) => {
            const phColors = { A: "#00d8b8", B: "#004E82", C: "#123D5C" };
            const fy = 150 + pi * 18;
            return (
              <g key={ph}>
                <text x="425" y={fy + 4} fill={phColors[ph]} fontSize="9">Fase {ph}</text>
                <line x1="407" y1="100" x2="407" y2={fy} stroke={phColors[ph]} strokeWidth="1.5" strokeDasharray="3,2" />
              </g>
            );
          })}

          {/* Circuitos */}
          {circuits.map((c, i) => {
            const col = i % circuitsPerRow;
            const row = Math.floor(i / circuitsPerRow);
            const cx = 50 + col * 220;
            const cy = 230 + row * 110;
            const colors = ["#00d8b8", "#004E82", "#123D5C"];
            const color = colors[i % 3];

            return (
              <g key={i}>
                {/* Linha do barramento ao disjuntor */}
                <line x1="407" y1="100" x2={cx + 25} y2={cy - 20} stroke={color} strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />

                {/* Disjuntor do circuito */}
                <rect x={cx} y={cy - 15} width="50" height="25" rx="3" fill="none" stroke={color} strokeWidth="1.5" />
                <text x={cx + 25} y={cy - 5} fill={color} fontSize="8" textAnchor="middle">{c.breaker || "16A"}</text>
                <text x={cx + 25} y={cy + 6} fill={color} fontSize="7" textAnchor="middle">Curva C</text>

                {/* Linha para carga */}
                <line x1={cx + 25} y1={cy + 10} x2={cx + 25} y2={cy + 35} stroke={color} strokeWidth="1.5" />

                {/* Carga */}
                <rect x={cx - 5} y={cy + 35} width="60" height="32" rx="3" fill="#F4F9FD" stroke={color} strokeWidth="1" />
                <text x={cx + 25} y={cy + 47} fill="#111827" fontSize="7" textAnchor="middle">{c.name?.slice(0, 14) || `C${i + 1}`}</text>
                <text x={cx + 25} y={cy + 58} fill="#4b5563" fontSize="6.5" textAnchor="middle">
                  {c.power_w || 0}W · {c.wire_gauge || "2,5mm²"}
                </text>

                {/* DR individual se necessário */}
                {c.needs_dr && (
                  <g>
                    <rect x={cx + 55} y={cy - 15} width="28" height="18" rx="2" fill="none" stroke="#004E82" strokeWidth="1" />
                    <text x={cx + 69} y={cy - 5} fill="#004E82" fontSize="7" textAnchor="middle">DR</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Barramento Neutro */}
          <rect x="500" y="85" width="60" height="20" rx="2" fill="#f8f8f6" stroke="#123D5C" strokeWidth="1" />
          <text x="530" y="99" fill="#123D5C" fontSize="8" textAnchor="middle">NEUTRO</text>

          {/* Aterramento */}
          <rect x="580" y="85" width="60" height="20" rx="2" fill="#f8f8f6" stroke="#123D5C" strokeWidth="1" />
          <text x="610" y="99" fill="#123D5C" fontSize="8" textAnchor="middle">TERRA</text>
          <line x1="610" y1="105" x2="610" y2="118" stroke="#123D5C" strokeWidth="1.5" />
          <line x1="600" y1="118" x2="620" y2="118" stroke="#123D5C" strokeWidth="2" />
          <line x1="604" y1="122" x2="616" y2="122" stroke="#123D5C" strokeWidth="1.5" />
          <line x1="607" y1="126" x2="613" y2="126" stroke="#123D5C" strokeWidth="1" />

          {/* Legenda */}
          <line x1="20" y1={H - 55} x2={W - 20} y2={H - 55} stroke="#e7e7e4" strokeWidth="1" />
          <text x="20" y={H - 38} fill="#123D5C" fontSize="8">■ Disjuntor (DJ)</text>
          <text x="100" y={H - 38} fill="#004E82" fontSize="8">■ Diferencial Residual (DR)</text>
          <text x="240" y={H - 38} fill="#00d8b8" fontSize="8">■ Dispositivo Proteção Surto (DPS)</text>
          <text x="430" y={H - 38} fill="#123D5C" fontSize="8">■ Aterramento (TN-S)</text>
          <text x="20" y={H - 22} fill="#4b5563" fontSize="7">NACIF Solutions Eletric — Diagrama Unifilar Gerado Automaticamente — NBR 5410:2004</text>
          <text x={W - 20} y={H - 22} fill="#4b5563" fontSize="7" textAnchor="end">Rev. 01 — 2025</text>
        </svg>
      </div>
    </div>
  );
}

export default function Diagram() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState("");
  const [project, setProject] = useState(null);

  useEffect(() => { backend.entities.Project.list().then(setProjects); }, []);
  useEffect(() => { if (selected) backend.entities.Project.get(selected).then(setProject); }, [selected]);

  return (
    <div className="w-full max-w-none space-y-6 pb-20">
      <PageHeader
        icon={GitBranch}
        title="Diagrama Unifilar"
        subtitle="Geração automática conforme NBR 5410"
      >
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="h-12 min-w-0 flex-1 rounded-[14px] border-[#BCEEE5] bg-white text-sm font-bold shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
            <SelectValue placeholder="Selecionar projeto..." />
          </SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
        </Select>
      </PageHeader>

      {!project ? (
        <div className="p-16 rounded-2xl bg-card border border-border/40 text-center">
          <GitBranch className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground text-sm">Selecione um projeto para gerar o diagrama unifilar</p>
        </div>
      ) : (
        <DiagramSVG project={project} />
      )}
    </div>
  );
}
