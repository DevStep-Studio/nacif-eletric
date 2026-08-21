import {
  PANEL_COLORS,
  PANEL_SHEET,
  clipText,
  feederGaugeByCurrent,
  formatNumber,
} from "@/lib/professionalPanelBoardLibrary";

const MAGENTA = "#ff38f5";
const NODE_GREEN = "#00cf28";
const CAD_LINE = "#5c626b";
const HEAVY_LINE = "#111111";

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

function Text({ x, y, children, size = 8, weight = 600, color = "#111827", anchor = "start", family = "Arial, Helvetica, sans-serif" }) {
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
  const general = components.find((component) => component.type === "breaker" && component.isGeneral)
    || components.find((component) => component.type === "breaker");
  const supply = board.supply_type || project.supply_type || "Trifásico";
  const defaultPoles = supply === "Trifásico" ? 3 : supply === "Bifásico" ? 2 : 2;

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

function buildQgbtFeeders(project = {}) {
  const boards = Array.isArray(project.panel_boards) ? project.panel_boards : [];
  const qgbtBoard = boards.find((board) => board.type === "qgbt");
  const sourceBoards = boards.filter((board) => board.type !== "qgbt");
  const qgbtFeeders = allComponents(qgbtBoard?.layout).filter((component) => (
    component.type === "breaker" && (component.isQgbtFeeder || String(component.id || "").startsWith("qgbt_feed"))
  ));

  if (qgbtFeeders.length > 0) {
    return qgbtFeeders.map((component, index) => {
      const sourceBoard = sourceBoards.find((board) => board.id === component.sourceBoardId)
        || sourceBoards.find((board) => String(component.label || "").toLowerCase().includes(String(board.name || "").toLowerCase()))
        || sourceBoards[index];
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
    poles: asNumber(circuit.breaker_poles, circuit.supply_type === "Trifásico" ? 3 : circuit.supply_type === "Bifásico" ? 2 : 1),
    curve: circuit.breaker_curve || "B",
    phase: circuit.phase || "A",
    supply: circuit.supply_type || project.supply_type || "Monofásico",
  }));
}

function inferSystem(project, feeders) {
  const supply = project?.supply_type || "Trifásico";
  const hasTri = supply === "Trifásico" || feeders.some((feeder) => feeder.poles >= 3 || feeder.phase === "ABC");
  const hasBi = supply === "Bifásico" || feeders.some((feeder) => feeder.poles === 2 || String(feeder.phase || "").length === 2);

  if (hasTri) return { label: "Trifásico", phaseLabels: ["R", "S", "T", "N", "PE"], phaseCodes: ["A", "B", "C"], busbar: "3F+N+PE" };
  if (hasBi) return { label: "Bifásico", phaseLabels: ["R", "S", "N", "PE"], phaseCodes: ["A", "B"], busbar: "2F+N+PE" };
  return { label: "Monofásico", phaseLabels: ["F", "N", "PE"], phaseCodes: ["A"], busbar: "F+N+PE" };
}

function feederPhaseCodes(feeder, system) {
  if (feeder.supply === "Trifásico" || feeder.phase === "ABC" || feeder.poles >= 3) return ["A", "B", "C"];
  if (feeder.supply === "Bifásico" || feeder.phase === "AB" || feeder.poles === 2) return ["A", "B"];
  return [system.phaseCodes[0] || "A"];
}

function BreakerStack({ x, y, current, phases, side = "right" }) {
  const dir = side === "right" ? 1 : -1;
  const gap = 13;
  const firstY = y - ((phases.length - 1) * gap) / 2;

  return (
    <g>
      <Text x={x + dir * 4} y={firstY - 15} size={10} weight={700} color={MAGENTA} anchor="middle">
        {current}A
      </Text>
      {phases.map((phase, index) => {
        const lineY = firstY + index * gap;
        return (
          <g key={`${phase}-${index}`}>
            <circle cx={x} cy={lineY} r="2.5" fill="#ffffff" stroke={MAGENTA} strokeWidth="0.8" />
            <path
              d={`M ${x + dir * 2.5} ${lineY} h ${dir * 9} q ${dir * 7} -11 ${dir * 18} 0 h ${dir * 9}`}
              fill="none"
              stroke={MAGENTA}
              strokeWidth="0.8"
            />
          </g>
        );
      })}
    </g>
  );
}

function CurrentTransformer({ x, y, label }) {
  return (
    <g>
      <circle cx={x} cy={y} r="9.2" fill="#ffffff" stroke="#000000" strokeWidth="2.2" />
      <Text x={x} y={y + 23} size={8} weight={700} color={MAGENTA} anchor="middle" family="'Courier New', monospace">
        {label}
      </Text>
    </g>
  );
}

function MeterBlock({ x, y, label, w = 116, h = 70 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="#111111" strokeWidth="0.7" />
      <Text x={x + w / 2} y={y + 26} size={8.4} weight={700} color="#111111" anchor="middle">
        MULTIMEDIDOR
      </Text>
      <Text x={x + w / 2} y={y + 40} size={8.4} weight={700} color="#111111" anchor="middle">
        DE ENERGIA
      </Text>
      <Text x={x + w / 2} y={y + 54} size={8.4} weight={700} color="#111111" anchor="middle">
        {clipText(label, 14).toUpperCase()}
      </Text>
    </g>
  );
}

function DpsSymbol({ x, y, label = "275V/20kA" }) {
  return (
    <g>
      <line x1={x - 95} y1={y} x2={x + 95} y2={y} stroke={NODE_GREEN} strokeWidth="1.2" />
      <circle cx={x - 95} cy={y} r="4.2" fill="#ffffff" stroke={NODE_GREEN} strokeWidth="2" />
      <circle cx={x + 95} cy={y} r="4.2" fill="#ffffff" stroke={NODE_GREEN} strokeWidth="2" />
      <circle cx={x} cy={y} r="13" fill="#ffffff" stroke="#ff0000" strokeWidth="2.6" />
      <line x1={x - 4.5} y1={y - 14} x2={x - 4.5} y2={y + 14} stroke="#ff0000" strokeWidth="2" />
      <line x1={x + 4.5} y1={y - 14} x2={x + 4.5} y2={y + 14} stroke="#ff0000" strokeWidth="2" />
      <Text x={x} y={y - 21} size={11} weight={900} color="#ff0000" anchor="middle">
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
  const breakerX = side === "right" ? 872 : 318;
  const outX = side === "right" ? 1086 : 102;
  const labelX = side === "right" ? 1094 : 96;
  const meterX = side === "right" ? 1000 : 48;
  const showMeter = index < 4 && phases.length >= 2;

  return (
    <g>
      {phases.map((phase, phaseIndex) => {
        const lineY = firstLineY + phaseIndex * lineGap;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        return (
          <g key={`${feeder.id}-${phase}`}>
            <line x1={busX} y1={lineY} x2={breakerX} y2={lineY} stroke={CAD_LINE} strokeWidth="0.65" />
            <line x1={breakerX + dir * 38} y1={lineY} x2={outX} y2={lineY} stroke={CAD_LINE} strokeWidth="0.65" />
            <circle cx={busX} cy={lineY} r="3" fill={NODE_GREEN} />
            <circle cx={breakerX} cy={lineY} r="2.7" fill="#ffffff" stroke={MAGENTA} strokeWidth="0.8" />
            <circle cx={outX} cy={lineY} r="3" fill={NODE_GREEN} />
          </g>
        );
      })}

      <BreakerStack x={breakerX} y={y} current={feeder.current} phases={phases} side={side} />
      <Text
        x={labelX}
        y={y + 35}
        size={10}
        weight={600}
        color={MAGENTA}
        anchor={side === "right" ? "start" : "end"}
        family="'Courier New', monospace"
      >
        {clipText(feeder.name.toUpperCase(), 22)}
      </Text>
      <Text
        x={labelX}
        y={y + 49}
        size={7.2}
        weight={600}
        color={MAGENTA}
        anchor={side === "right" ? "start" : "end"}
        family="'Courier New', monospace"
      >
        {clipText(feeder.location.toUpperCase(), 26)}
      </Text>

      {showMeter && (
        <g>
          <MeterBlock x={meterX} y={y - 45} label={feeder.location || feeder.name} />
          {phases.slice(0, 3).map((phase, phaseIndex) => {
            const lineY = firstLineY + phaseIndex * lineGap;
            const tcX = side === "right" ? meterX - 34 : meterX + 150;
            const meterWireX = side === "right" ? meterX : meterX + 116;
            return (
              <g key={`meter-${feeder.id}-${phase}`}>
                <line x1={tcX} y1={lineY} x2={meterWireX} y2={lineY} stroke={HEAVY_LINE} strokeWidth="2.6" />
                <line x1={meterWireX} y1={lineY} x2={meterWireX} y2={y - 22 + phaseIndex * 13} stroke={HEAVY_LINE} strokeWidth="2.6" />
                <CurrentTransformer x={tcX} y={lineY} label={`TC${phaseIndex + 1}`} />
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

function TitleBlock({ project, feeders, system, generalBreaker }) {
  const x = 830;
  const y = 713;
  const w = 326;
  const h = 92;
  const rows = [
    ["CLIENTE", project?.client_name || "Cliente"],
    ["ENDEREÇO", project?.address || "Endereço da obra"],
    ["PROJETO", project?.name || "Projeto"],
    ["TÍTULO", "DIAGRAMA QGBT - QUADRO GERAL"],
  ];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke="#000000" strokeWidth="0.8" />
      <rect x={x} y={y} width={w} height="20" fill="#f8fafc" stroke="#000000" strokeWidth="0.5" />
      <Text x={x + 8} y={y + 14} size={7} weight={900} color="#111111">QGBT</Text>
      <Text x={x + w - 8} y={y + 14} size={7} weight={800} color="#111111" anchor="end">
        {system.label} · {generalBreaker}A · {feeders.length} alimentador(es)
      </Text>
      {rows.map(([label, value], index) => (
        <g key={label}>
          <line x1={x} y1={y + 20 + index * 18} x2={x + w} y2={y + 20 + index * 18} stroke="#000000" strokeWidth="0.35" />
          <Text x={x + 8} y={y + 32 + index * 18} size={5.8} weight={900} color="#111111">{label}</Text>
          <Text x={x + 74} y={y + 32 + index * 18} size={6.4} weight={600} color="#111111">
            {clipText(value, 42)}
          </Text>
        </g>
      ))}
    </g>
  );
}

export default function QgbtDiagramSheetSVG({ project = {}, metrics = {} }) {
  const feeders = buildQgbtFeeders(project);
  const visibleFeeders = feeders.slice(0, 12);
  const system = inferSystem(project, visibleFeeders);
  const sheet = PANEL_SHEET;
  const phaseLabels = system.phaseLabels;
  const busTop = 118;
  const busBottom = 735;
  const busCenter = 595;
  const busGap = system.phaseCodes.length >= 3 ? 28 : 34;
  const phaseXs = phaseLabels.map((_, index) => busCenter + (index - (phaseLabels.length - 1) / 2) * busGap);
  const phaseMap = phaseLabels.reduce((map, label, index) => {
    const code = label === "R" || label === "F" ? "A" : label === "S" ? "B" : label === "T" ? "C" : label;
    return { ...map, [code]: index };
  }, {});
  const phaseBreakerMax = visibleFeeders.reduce((max, feeder) => Math.max(max, feeder.current), 0);
  const mainCurrent = asNumber(metrics?.generalBreaker || metrics?.generalCurrent, phaseBreakerMax || 80);
  const generalBreaker = Math.max(40, Math.ceil(mainCurrent / 10) * 10);
  const feederGauge = feederGaugeByCurrent(generalBreaker);
  const leftFeeders = visibleFeeders.filter((_, index) => index % 2 === 0);
  const rightFeeders = visibleFeeders.filter((_, index) => index % 2 === 1);
  const branchY = (list, index) => 270 + index * Math.min(118, Math.max(82, 405 / Math.max(list.length, 1)));

  return (
    <svg
      width={sheet.width}
      height={sheet.height}
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff", display: "block" }}
    >
      <rect width={sheet.width} height={sheet.height} fill="#ffffff" />
      <rect x="24" y="24" width="1141" height="793" fill="none" stroke="#000000" strokeWidth="0.85" />

      <Text x="48" y="54" size={18} weight={900} color="#111827">
        DIAGRAMA QGBT - QUADRO GERAL DE BAIXA TENSÃO
      </Text>
      <Text x="48" y="74" size={8.6} weight={700} color="#5f6b7a">
        Gerador QGBT com alimentadores dos quadros, TCs, multimedidor totalizador e disjuntores principais
      </Text>
      <Text x="1140" y="54" size={10} weight={900} color="#111827" anchor="end">
        {clipText((project?.name || "Projeto").toUpperCase(), 44)}
      </Text>
      <Text x="1140" y="72" size={7.4} weight={700} color="#5f6b7a" anchor="end">
        {system.busbar} · Alimentador #{feederGauge}mm² · {new Date().toLocaleDateString("pt-BR")}
      </Text>

      <DpsSymbol x={busCenter} y={104} />

      {phaseLabels.map((label, index) => {
        const phaseCode = label === "R" || label === "F" ? "A" : label === "S" ? "B" : label === "T" ? "C" : label;
        const color = phaseColor(phaseCode);
        return (
          <g key={label}>
            <line x1={phaseXs[index]} y1={busTop} x2={phaseXs[index]} y2={busBottom} stroke={label === "PE" ? color : CAD_LINE} strokeWidth={label === "PE" ? "1.5" : "0.75"} />
            <circle cx={phaseXs[index]} cy={busTop + 22} r="4.2" fill="#ffffff" stroke={color} strokeWidth="1.1" />
            <Text x={phaseXs[index]} y={busTop + 24.5} size={6} weight={900} color={color} anchor="middle">
              {label}
            </Text>
          </g>
        );
      })}

      <BreakerStack x={busCenter + 12} y={176} current={generalBreaker} phases={system.phaseCodes} side="right" />
      {system.phaseCodes.map((phase, index) => {
        const lineY = 176 - ((system.phaseCodes.length - 1) * 13) / 2 + index * 13;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        return (
          <g key={`incoming-${phase}`}>
            <line x1={busX} y1={136} x2={busX} y2={lineY} stroke={CAD_LINE} strokeWidth="0.75" />
            <line x1={busX} y1={lineY} x2={busCenter + 12} y2={lineY} stroke={CAD_LINE} strokeWidth="0.75" />
            <circle cx={busX} cy={lineY} r="3" fill={NODE_GREEN} />
          </g>
        );
      })}

      <MeterBlock x={690} y={145} label="TOTALIZADOR" w={150} h={74} />
      {system.phaseCodes.map((phase, index) => {
        const lineY = 164 + index * 18;
        const busX = phaseXs[phaseMap[phase] ?? 0];
        return (
          <g key={`tc-total-${phase}`}>
            <line x1={busX} y1={lineY} x2="690" y2={lineY} stroke={HEAVY_LINE} strokeWidth="2.8" />
            <CurrentTransformer x={busX - 4} y={lineY} label={`TC${index + 1}`} />
          </g>
        );
      })}

      <Text x={busCenter} y={busBottom + 22} size={8.6} weight={900} color="#111827" anchor="middle">
        BARRAMENTOS PRINCIPAIS DO QGBT - {system.busbar}
      </Text>

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
        <Text x={sheet.width / 2} y="390" size={13} weight={800} color="#7c8796" anchor="middle">
          Gere ou cadastre quadros no projeto para preencher os alimentadores do QGBT.
        </Text>
      )}

      {feeders.length > visibleFeeders.length && (
        <Text x="48" y="786" size={7.4} weight={800} color="#dc2626">
          +{feeders.length - visibleFeeders.length} alimentador(es) não exibidos nesta prancha.
        </Text>
      )}

      <g>
        <rect x="48" y="713" width="356" height="92" fill="#ffffff" stroke="#000000" strokeWidth="0.65" />
        <Text x="62" y="734" size={8.5} weight={900} color="#111827">RESUMO DO QGBT</Text>
        {[
          ["Alimentadores", `${feeders.length} disjuntor(es) principais`],
          ["Maior proteção", `${phaseBreakerMax || generalBreaker}A`],
          ["Proteção geral", `${generalBreaker}A · ${system.label}`],
          ["Condutores", `Fases #${feederGauge}mm² · PE #${Math.max(6, Math.round(feederGauge / 2))}mm²`],
        ].map(([label, value], index) => (
          <g key={label}>
            <Text x="62" y={754 + index * 13} size={6.6} weight={900} color="#5f6b7a">{label.toUpperCase()}</Text>
            <Text x="170" y={754 + index * 13} size={6.8} weight={700} color="#111827">{clipText(value, 36)}</Text>
          </g>
        ))}
      </g>

      <g>
        <rect x="430" y="713" width="360" height="92" fill="#ffffff" stroke="#000000" strokeWidth="0.65" />
        <Text x="444" y="734" size={8.5} weight={900} color="#111827">NOTAS TÉCNICAS</Text>
        {[
          "1. Disjuntores do QGBT representam o disjuntor principal de cada quadro alimentado.",
          "2. TCs e multimedidores devem ser confirmados conforme medição e concessionária.",
          "3. Ajustar Icu/Icn, seção dos condutores e seletividade antes da emissão executiva.",
          "4. Diagrama gerado automaticamente para revisão do responsável técnico.",
        ].map((note, index) => (
          <Text key={note} x="444" y={752 + index * 12.5} size={6.3} weight={600} color="#111827">
            {note}
          </Text>
        ))}
      </g>

      <TitleBlock project={project} feeders={feeders} system={system} generalBreaker={generalBreaker} />

      <Text x="48" y="823" size={6.2} weight={700} color="#7c8796">
        Documento gerado automaticamente. Revisar e validar por profissional habilitado antes da emissão.
      </Text>
      <Text x="1148" y="823" size={6.2} weight={900} color="#111827" anchor="end">
        QGBT-301/R00 · {formatNumber(feeders.length, 0)} ALIM.
      </Text>
    </svg>
  );
}
