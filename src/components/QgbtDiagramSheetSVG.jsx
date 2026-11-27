import {
  PANEL_COLORS,
  PANEL_SHEET,
  clipText,
  feederGaugeByCurrent,
  formatNumber,
} from "@/lib/professionalPanelBoardLibrary";
import { selectBreaker } from "@/lib/electricalEngine";

const MAGENTA = "#c026d3";
const NODE_GREEN = "#00b85c";
const CAD_LINE = "#475569";
const HEAVY_LINE = "#0f172a";

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const phaseColor = (phase) => ({
  A: PANEL_COLORS.phaseA,
  B: PANEL_COLORS.phaseB,
  C: PANEL_COLORS.phaseC,
  N: PANEL_COLORS.neutral,
  PE: PANEL_COLORS.earth,
}[phase] || CAD_LINE);

function Text({
  x,
  y,
  children,
  size = 8,
  weight = 600,
  color = "#111827",
  anchor = "start",
  family = "Arial, Helvetica, sans-serif",
}) {
  return (
    <text x={x} y={y} fill={color} fontSize={size} fontWeight={weight} textAnchor={anchor} fontFamily={family}>
      {children}
    </text>
  );
}

function allComponents(layout) {
  return (layout?.rails || [])
    .flatMap((rail) => rail.components || [])
    .filter((component) => component && component.type !== "spacer");
}

function getBoardGeneralBreaker(board = {}, project = {}) {
  const components = allComponents(board.layout);
  const general =
    components.find((component) => component.type === "breaker" && component.isGeneral) ||
    components.find((component) => component.type === "breaker");
  const supply = board.supply_type || project.supply_type || "Trifásico";
  const defaultPoles = supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 1;

  return {
    current: asNumber(general?.current || general?.breaker_a, 40),
    poles: asNumber(general?.poles, defaultPoles),
    curve: general?.curve || "C",
    phase: general?.phase || (supply === "Trifásico" ? "ABC" : supply === "Bifásico" ? "AB" : "A"),
    supply,
  };
}

function feederFromComponent(component, index, sourceBoard, project) {
  const breaker = getBoardGeneralBreaker(sourceBoard || {}, project);
  return {
    id: component.id || `qgbt-feeder-${index}`,
    name: component.sourceBoardName || sourceBoard?.name || component.label || `QD-${String(index + 1).padStart(2, "0")}`,
    location: sourceBoard?.location || "Distribuição",
    current: asNumber(component.current, breaker.current),
    poles: asNumber(component.poles, breaker.poles),
    curve: component.curve || breaker.curve,
    phase: component.phase || breaker.phase,
    supply: sourceBoard?.supply_type || breaker.supply,
  };
}

export function buildQgbtFeeders(project = {}) {
  const boards = Array.isArray(project.panel_boards) ? project.panel_boards : [];
  const qgbtBoard = boards.find((board) => board.type === "qgbt");
  const sourceBoards = boards.filter((board) => board.type !== "qgbt");
  const qgbtFeeders = allComponents(qgbtBoard?.layout).filter(
    (component) =>
      component.type === "breaker" &&
      (component.isQgbtFeeder || String(component.id || "").startsWith("qgbt_feed"))
  );

  if (qgbtFeeders.length > 0) {
    return qgbtFeeders.map((component, index) => {
      const sourceBoard =
        sourceBoards.find((board) => board.id === component.sourceBoardId) ||
        sourceBoards.find((board) =>
          String(component.label || "").toLowerCase().includes(String(board.name || "").toLowerCase())
        ) ||
        sourceBoards[index];
      return feederFromComponent(component, index, sourceBoard, project);
    });
  }

  if (sourceBoards.length > 0) {
    return sourceBoards.map((board, index) => {
      const breaker = getBoardGeneralBreaker(board, project);
      return {
        id: board.id || `board-${index}`,
        name: board.name || `QD-${String(index + 1).padStart(2, "0")}`,
        location: board.location || "Distribuição",
        current: breaker.current,
        poles: breaker.poles,
        curve: breaker.curve,
        phase: breaker.phase,
        supply: board.supply_type || breaker.supply,
      };
    });
  }

  const circuits = Array.isArray(project.circuits) ? project.circuits : [];
  return circuits.slice(0, 10).map((circuit, index) => ({
    id: circuit.id || `circuit-${index}`,
    name: circuit.name || `Circuito ${index + 1}`,
    location: circuit.type || "Circuito final",
    current: asNumber(circuit.breaker_a, 16),
    poles: asNumber(
      circuit.breaker_poles,
      circuit.supply_type === "Trifásico" ? 3 : circuit.supply_type === "Bifásico" ? 2 : 1
    ),
    curve: circuit.breaker_curve || "B",
    phase: circuit.phase || "A",
    supply: circuit.supply_type || project.supply_type || "Monofásico",
  }));
}

function inferSystem(project, feeders) {
  const supply = project?.supply_type || "Trifásico";
  const hasTri =
    supply === "Trifásico" ||
    feeders.some((feeder) => feeder.poles >= 3 || feeder.phase === "ABC");
  const hasBi =
    supply === "Bifásico" ||
    feeders.some((feeder) => feeder.poles === 2 || String(feeder.phase || "").length === 2);

  if (hasTri) {
    return {
      label: "Trifásico",
      phaseLabels: ["R", "S", "T", "N", "PE"],
      phaseCodes: ["A", "B", "C"],
      busbar: "3F+N+PE",
    };
  }
  if (hasBi) {
    return {
      label: "Bifásico",
      phaseLabels: ["R", "S", "N", "PE"],
      phaseCodes: ["A", "B"],
      busbar: "2F+N+PE",
    };
  }
  return {
    label: "Monofásico",
    phaseLabels: ["F", "N", "PE"],
    phaseCodes: ["A"],
    busbar: "F+N+PE",
  };
}

function feederPhaseCodes(feeder, system) {
  if (feeder.supply === "Trifásico" || feeder.phase === "ABC" || feeder.poles >= 3) return ["A", "B", "C"];
  if (feeder.supply === "Bifásico" || feeder.phase === "AB" || feeder.poles === 2) return ["A", "B"];
  return [system.phaseCodes[0] || "A"];
}

function BreakerStack({ x, y, current, curve = "C", phases, side = "right", title = "" }) {
  const dir = side === "right" ? 1 : -1;
  const gap = 12;
  const firstY = y - ((phases.length - 1) * gap) / 2;
  const centerArcX = x + dir * 19;

  return (
    <g>
      <rect
        x={centerArcX - 24}
        y={firstY - 22}
        width="48"
        height="13"
        rx="3"
        fill="#fdf4ff"
        stroke="#f0abfc"
        strokeWidth="0.6"
      />
      <Text x={centerArcX} y={firstY - 13} size={7.8} weight={800} color={MAGENTA} anchor="middle">
        {title ? `${title} ` : ""}{current}A/{curve}
      </Text>
      {phases.map((phase, index) => {
        const lineY = firstY + index * gap;
        return (
          <g key={`${phase}-${index}`}>
            <circle cx={x} cy={lineY} r="2.4" fill="#ffffff" stroke={MAGENTA} strokeWidth="0.9" />
            <path
              d={`M ${x + dir * 2.4} ${lineY} h ${dir * 8} q ${dir * 7} -9 ${dir * 17} 0 h ${dir * 8}`}
              fill="none"
              stroke={MAGENTA}
              strokeWidth="1.1"
            />
            <circle cx={x + dir * 35.4} cy={lineY} r="2.4" fill="#ffffff" stroke={MAGENTA} strokeWidth="0.9" />
          </g>
        );
      })}
    </g>
  );
}

function CurrentTransformer({ x, y, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="6.8" fill="#ffffff" stroke="#0f172a" strokeWidth="1.7" />
      <Text
        x={x}
        y={y + 16}
        size={6.8}
        weight={800}
        color={MAGENTA}
        anchor="middle"
        family="'Courier New', monospace"
      >
        {label}
      </Text>
    </g>
  );
}

function MeterBlock({ x, y, title = "MULTIMEDIDOR", subtitle = "DE ENERGIA", label, badge = "", w = 152, h = 66 }) {
  return (
    <g>
      <rect x={x + 2} y={y + 2} width={w} height={h} rx="4" fill="#e2e8f0" />
      <rect x={x} y={y} width={w} height={h} rx="4" fill="#ffffff" stroke="#0f172a" strokeWidth="0.9" />
      <rect x={x} y={y} width={w} height="16" rx="4" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
      <Text x={x + w / 2} y={y + 11.5} size={7.2} weight={900} color="#0f172a" anchor="middle">
        {clipText(title, 22).toUpperCase()}
      </Text>
      <Text x={x + w / 2} y={y + 30} size={7.6} weight={800} color="#334155" anchor="middle">
        {clipText(subtitle, 24).toUpperCase()}
      </Text>
      <Text x={x + w / 2} y={y + 44} size={8} weight={900} color="#006F51" anchor="middle">
        {clipText(label || "DISTRIBUIÇÃO", 20).toUpperCase()}
      </Text>
      {badge && (
        <Text x={x + w / 2} y={y + 57} size={6.8} weight={700} color="#64748b" anchor="middle">
          {clipText(badge, 24)}
        </Text>
      )}
    </g>
  );
}

function DpsSymbol({ x, y, label = "DPS CLASSE II · 275V / 20kA" }) {
  return (
    <g>
      <line x1={x - 86} y1={y} x2={x + 86} y2={y} stroke={NODE_GREEN} strokeWidth="1.2" />
      <circle cx={x - 86} cy={y} r="3.6" fill="#ffffff" stroke={NODE_GREEN} strokeWidth="1.8" />
      <circle cx={x + 86} cy={y} r="3.6" fill="#ffffff" stroke={NODE_GREEN} strokeWidth="1.8" />
      <circle cx={x} cy={y} r="11" fill="#ffffff" stroke="#dc2626" strokeWidth="2.2" />
      <line x1={x - 3.8} y1={y - 11} x2={x - 3.8} y2={y + 11} stroke="#dc2626" strokeWidth="1.8" />
      <line x1={x + 3.8} y1={y - 11} x2={x + 3.8} y2={y + 11} stroke="#dc2626" strokeWidth="1.8" />
      <rect x={x - 74} y={y - 26} width="148" height="12" rx="3" fill="#fef2f2" stroke="#fecaca" strokeWidth="0.6" />
      <Text x={x} y={y - 17.5} size={7.4} weight={900} color="#dc2626" anchor="middle">
        {label}
      </Text>
    </g>
  );
}

function FeederBranch({ feeder, index, side, y, phaseXs, phaseMap, system }) {
  const phases = feederPhaseCodes(feeder, system);
  const lineGap = 12;
  const firstLineY = y - ((phases.length - 1) * lineGap) / 2;
  const dir = side === "right" ? 1 : -1;

  // Coordenadas padronizadas e contidas 100% dentro das margens da prancha (48..1141)
  const breakerX = side === "right" ? 710 : 480;
  const breakerEndX = breakerX + dir * 35.4;
  const meterW = 156;
  const meterH = 66;
  const meterX = side === "right" ? 980 : 52;
  const outX = side === "right" ? meterX : meterX + meterW;
  const tcStartX = side === "right" ? 865 : 325;
  const showMeter = index < 6 && phases.length >= 1;
  const gauge = feederGaugeByCurrent(feeder.current);

  return (
    <g>
      {phases.map((phase, phaseIndex) => {
        const lineY = firstLineY + phaseIndex * lineGap;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        return (
          <g key={`${feeder.id}-${phase}`}>
            <line x1={busX} y1={lineY} x2={breakerX} y2={lineY} stroke={CAD_LINE} strokeWidth="0.8" />
            <line x1={breakerEndX} y1={lineY} x2={outX} y2={lineY} stroke={CAD_LINE} strokeWidth="0.8" />
            <circle cx={busX} cy={lineY} r="2.8" fill={NODE_GREEN} />
            <circle cx={outX} cy={lineY} r="2.8" fill={NODE_GREEN} />
          </g>
        );
      })}

      <BreakerStack
        x={breakerX}
        y={y}
        current={feeder.current}
        curve={feeder.curve || "C"}
        phases={phases}
        side={side}
      />

      {/* Especificação do Cabo Alimentador sobre o trecho horizontal */}
      <Text
        x={(breakerEndX + outX) / 2}
        y={firstLineY - 8}
        size={7.2}
        weight={800}
        color="#334155"
        anchor="middle"
      >
        {`#${gauge}mm² (${feeder.poles}P · ${feeder.supply})`}
      </Text>

      {/* Transformadores de Corrente (TCs) posicionados sem colisão no trecho intermediário */}
      {showMeter &&
        phases.slice(0, 3).map((phase, phaseIndex) => {
          const lineY = firstLineY + phaseIndex * lineGap;
          const tcX = tcStartX + dir * (phaseIndex * 18);
          return (
            <g key={`tc-${feeder.id}-${phase}`}>
              <CurrentTransformer x={tcX} y={lineY} label={`TC${phaseIndex + 1}`} />
            </g>
          );
        })}

      {/* Bloco do Quadro / Multimedidor Destino contido na margem segura */}
      <MeterBlock
        x={meterX}
        y={y - meterH / 2}
        title={feeder.name || `QD-${String(index + 1).padStart(2, "0")}`}
        subtitle="QUADRO & MEDIÇÃO"
        label={feeder.location || "Distribuição"}
        badge={`DJ ${feeder.current}A · Curva ${feeder.curve || "C"} · #${gauge}mm²`}
        w={meterW}
        h={meterH}
      />
    </g>
  );
}

function TitleBlock({ project, feeders, system, generalBreaker }) {
  const x = 800;
  const y = 702;
  const w = 345;
  const h = 98;
  const rows = [
    ["CLIENTE", project?.client_name || "Não informado"],
    ["ENDEREÇO", project?.address || project?.city || "Endereço da obra"],
    ["PROJETO", project?.name || "Projeto Elétrico"],
    ["TÍTULO", "DIAGRAMA QGBT - QUADRO GERAL"],
  ];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8" />
      <rect x={x} y={y} width={w} height="20" rx="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
      <Text x={x + 10} y={y + 13.5} size={7.4} weight={900} color="#0f172a">
        CARIMBO TÉCNICO — QGBT
      </Text>
      <Text x={x + w - 10} y={y + 13.5} size={7.2} weight={800} color="#006F51" anchor="end">
        {system.label} · {generalBreaker}A · {feeders.length} alim.
      </Text>
      {rows.map(([label, value], index) => (
        <g key={label}>
          {index > 0 && (
            <line
              x1={x}
              y1={y + 20 + index * 19.5}
              x2={x + w}
              y2={y + 20 + index * 19.5}
              stroke="#cbd5e1"
              strokeWidth="0.5"
            />
          )}
          <Text x={x + 10} y={y + 33 + index * 19.5} size={6.4} weight={900} color="#64748b">
            {label}
          </Text>
          <Text x={x + 76} y={y + 33 + index * 19.5} size={7} weight={700} color="#0f172a">
            {clipText(String(value || "—"), 38)}
          </Text>
        </g>
      ))}
    </g>
  );
}

export default function QgbtDiagramSheetSVG({ project = {}, metrics = {} }) {
  const feeders = buildQgbtFeeders(project);
  const visibleFeeders = feeders.slice(0, 10);
  const system = inferSystem(project, visibleFeeders);
  const sheet = PANEL_SHEET;
  const phaseLabels = system.phaseLabels;
  const busTop = 140;
  const busBottom = 654;
  const busCenter = 595;
  const busGap = system.phaseCodes.length >= 3 ? 26 : 32;
  const phaseXs = phaseLabels.map((_, index) => busCenter + (index - (phaseLabels.length - 1) / 2) * busGap);
  const phaseMap = phaseLabels.reduce((map, label, index) => {
    const code = label === "R" || label === "F" ? "A" : label === "S" ? "B" : label === "T" ? "C" : label;
    return { ...map, [code]: index };
  }, {});
  const phaseBreakerMax = visibleFeeders.reduce((max, feeder) => Math.max(max, feeder.current), 0);
  const generalBreaker = Math.max(
    40,
    asNumber(metrics?.generalBreaker, selectBreaker(phaseBreakerMax || 63))
  );
  const feederGauge = feederGaugeByCurrent(generalBreaker);
  const peGauge = Math.max(10, Math.round(feederGauge / 2));
  const leftFeeders = visibleFeeders.filter((_, index) => index % 2 === 0);
  const rightFeeders = visibleFeeders.filter((_, index) => index % 2 === 1);
  const branchY = (list, index) =>
    285 + index * Math.min(115, Math.max(84, 340 / Math.max(list.length, 1)));

  return (
    <svg
      width={sheet.width}
      height={sheet.height}
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff", display: "block" }}
    >
      <rect width={sheet.width} height={sheet.height} fill="#ffffff" />
      <rect x="24" y="24" width="1141" height="793" fill="none" stroke="#0f172a" strokeWidth="1" />

      {/* Cabeçalho Padronizado da Prancha QGBT */}
      <rect x="24" y="24" width="1141" height="58" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.8" />
      <Text x="44" y="49" size={16} weight={900} color="#0f172a">
        DIAGRAMA QGBT — QUADRO GERAL DE BAIXA TENSÃO
      </Text>
      <Text x="44" y="67" size={8.2} weight={700} color="#475569">
        Diagrama unifilar de alimentadores dos quadros, proteção geral, TCs e multimedidor totalizador (ABNT NBR 5410)
      </Text>
      <Text x="1145" y="48" size={10} weight={900} color="#0f172a" anchor="end">
        {clipText((project?.name || "Projeto Elétrico").toUpperCase(), 46)}
      </Text>
      <Text x="1145" y="67" size={7.8} weight={700} color="#006F51" anchor="end">
        {system.label} ({system.busbar}) · Geral {generalBreaker}A · Condutor #{feederGauge}mm² · {new Date().toLocaleDateString("pt-BR")}
      </Text>

      {/* DPS Principal no Topo dos Barramentos */}
      <DpsSymbol x={busCenter} y={114} />

      {/* Barramentos Verticais Principais (R, S, T, N, PE) */}
      {phaseLabels.map((label, index) => {
        const phaseCode = label === "R" || label === "F" ? "A" : label === "S" ? "B" : label === "T" ? "C" : label;
        const color = phaseColor(phaseCode);
        return (
          <g key={label}>
            <line
              x1={phaseXs[index]}
              y1={busTop}
              x2={phaseXs[index]}
              y2={busBottom}
              stroke={label === "PE" ? color : CAD_LINE}
              strokeWidth={label === "PE" ? "1.6" : "0.95"}
            />
            <circle cx={phaseXs[index]} cy={busTop + 14} r="5.5" fill="#ffffff" stroke={color} strokeWidth="1.3" />
            <Text x={phaseXs[index]} y={busTop + 16.5} size={6.5} weight={900} color={color} anchor="middle">
              {label}
            </Text>
          </g>
        );
      })}

      {/* Fechamento Inferior dos Barramentos (Acima das Caixas Técnicas, Sem Sobreposição) */}
      <line
        x1={phaseXs[0] - 24}
        y1={busBottom}
        x2={phaseXs[phaseXs.length - 1] + 24}
        y2={busBottom}
        stroke="#0f172a"
        strokeWidth="1.2"
      />
      <rect x={busCenter - 155} y={busBottom + 8} width="310" height="18" rx="4" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.7" />
      <Text x={busCenter} y={busBottom + 20} size={8} weight={900} color="#0f172a" anchor="middle">
        BARRAMENTOS PRINCIPAIS DO QGBT — {system.busbar} (#{feederGauge}mm²)
      </Text>

      {/* Entrada Geral à Esquerda do Topo (Disjuntor Geral Sem Colidir com o Totalizador) */}
      <MeterBlock
        x={230}
        y={152}
        title="ENTRADA DE REDE"
        subtitle="ALIMENTAÇÃO GERAL"
        label={`${system.label} · ${project?.voltage || 220}V`}
        badge={`Cabo #${feederGauge}mm² + PE #${peGauge}mm²`}
        w={152}
        h={64}
      />
      <BreakerStack
        x={480}
        y={184}
        current={generalBreaker}
        curve="C"
        phases={system.phaseCodes}
        side="left"
        title="GERAL"
      />
      {system.phaseCodes.map((phase, index) => {
        const lineY = 184 - ((system.phaseCodes.length - 1) * 12) / 2 + index * 12;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        return (
          <g key={`incoming-${phase}`}>
            <line x1={382} y1={lineY} x2={444.6} y2={lineY} stroke={HEAVY_LINE} strokeWidth="1.2" />
            <line x1={480} y1={lineY} x2={busX} y2={lineY} stroke={HEAVY_LINE} strokeWidth="1.2" />
            <circle cx={busX} cy={lineY} r="3" fill={NODE_GREEN} />
          </g>
        );
      })}

      {/* Multimedidor Totalizador à Direita do Topo (TCs Fora dos Barramentos) */}
      <MeterBlock
        x={790}
        y={152}
        title="MULTIMEDIDOR"
        subtitle="TOTALIZADOR QGBT"
        label="MEDIÇÃO GERAL"
        badge={`TCs de Proteção e Medição`}
        w={156}
        h={64}
      />
      {system.phaseCodes.map((phase, index) => {
        const lineY = 172 + index * 13;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        const tcX = 700 + index * 22;
        return (
          <g key={`tc-total-${phase}`}>
            <line x1={busX} y1={lineY} x2={790} y2={lineY} stroke={HEAVY_LINE} strokeWidth="1.5" />
            <circle cx={busX} cy={lineY} r="2.8" fill={NODE_GREEN} />
            <CurrentTransformer x={tcX} y={lineY} label={`TC${index + 1}`} />
          </g>
        );
      })}

      {/* Ramais Alimentadores (Esquerda e Direita) */}
      {leftFeeders.map((feeder, index) => (
        <FeederBranch
          key={feeder.id}
          feeder={feeder}
          index={index * 2}
          side="left"
          y={branchY(leftFeeders, index)}
          phaseXs={phaseXs}
          phaseMap={phaseMap}
          system={system}
        />
      ))}
      {rightFeeders.map((feeder, index) => (
        <FeederBranch
          key={feeder.id}
          feeder={feeder}
          index={index * 2 + 1}
          side="right"
          y={branchY(rightFeeders, index)}
          phaseXs={phaseXs}
          phaseMap={phaseMap}
          system={system}
        />
      ))}

      {visibleFeeders.length === 0 && (
        <Text x={sheet.width / 2} y="410" size={12} weight={800} color="#64748b" anchor="middle">
          Cadastre quadros ou circuitos no projeto para gerar os ramais alimentadores do QGBT.
        </Text>
      )}

      {feeders.length > visibleFeeders.length && (
        <Text x={busCenter} y={busBottom - 12} size={7.4} weight={800} color="#dc2626" anchor="middle">
          +{feeders.length - visibleFeeders.length} alimentador(es) adicionais listados no memorial.
        </Text>
      )}

      {/* Rodapé Técnico Padronizado em 3 Blocos Alinhados (y = 702, h = 98) */}
      <g>
        <rect x="44" y="702" width="350" height="98" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="44" y="702" width="350" height="20" rx="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
        <Text x="54" y="715.5" size={7.4} weight={900} color="#0f172a">
          RESUMO TÉCNICO DO QGBT
        </Text>
        {[
          ["Alimentadores", `${feeders.length} quadro(s) / ramal(is) ativo(s)`],
          ["Maior proteção", `${phaseBreakerMax || generalBreaker}A`],
          ["Proteção geral", `${generalBreaker}A · Curva C (${system.label})`],
          ["Condutores", `Fases #${feederGauge}mm² · PE #${peGauge}mm² (Cobre)`],
        ].map(([label, value], index) => (
          <g key={label}>
            {index > 0 && (
              <line
                x1="44"
                y1={722 + index * 19.5}
                x2="394"
                y2={722 + index * 19.5}
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
            )}
            <Text x="54" y={735 + index * 19.5} size={6.4} weight={900} color="#64748b">
              {label.toUpperCase()}
            </Text>
            <Text x="164" y={735 + index * 19.5} size={7} weight={700} color="#0f172a">
              {clipText(value, 34)}
            </Text>
          </g>
        ))}
      </g>

      <g>
        <rect x="410" y="702" width="374" height="98" rx="3" fill="#ffffff" stroke="#0f172a" strokeWidth="0.8" />
        <rect x="410" y="702" width="374" height="20" rx="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="0.6" />
        <Text x="420" y="715.5" size={7.4} weight={900} color="#0f172a">
          NOTAS TÉCNICAS E CRITÉRIOS NBR 5410
        </Text>
        {[
          "1. Disjuntores do QGBT protegem os alimentadores individuais de cada quadro.",
          "2. TCs e multimedidores devem seguir o padrão da concessionária local.",
          "3. Confirmar capacidade de interrupção (Icu/Ics) e seletividade na obra.",
          "4. Barramentos de neutro e proteção (PE) isolados e identificados por cor.",
        ].map((note, index) => (
          <Text key={note} x="420" y={737 + index * 15} size={6.5} weight={600} color="#1e293b">
            {note}
          </Text>
        ))}
      </g>

      <TitleBlock project={project} feeders={feeders} system={system} generalBreaker={generalBreaker} />

      <Text x="44" y="811" size={6.2} weight={700} color="#64748b">
        Prancha gerada automaticamente pela plataforma NACIF Energy · ABNT NBR 5410 / IEC 60617.
      </Text>
      <Text x="1145" y="811" size={6.4} weight={900} color="#0f172a" anchor="end">
        PRANCHA QGBT-01 · {formatNumber(feeders.length, 0)} ALIM.
      </Text>
    </svg>
  );
}
