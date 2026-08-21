import { buildProfessionalTrifilar, buildTrifilarReferenceLayout } from "@/lib/professionalTrifilarLibrary";
import { clipText, formatNumber } from "@/lib/professionalPanelBoardLibrary";

const CAD_BLUE = "#2737d8";
const CAD_INK = "#111827";
const CAD_FAINT = "#d9def0";
const CAD_YELLOW = "#f6e88a";

function Text({
  x,
  y,
  children,
  size = 9,
  weight = 500,
  color = CAD_INK,
  anchor = "start",
  family = "Arial, Helvetica, sans-serif",
  transform,
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={size}
      fontWeight={weight}
      textAnchor={anchor}
      fontFamily={family}
      transform={transform}
    >
      {children}
    </text>
  );
}

const line = (x1, y1, x2, y2, width = 1.35, color = CAD_BLUE, extra = {}) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} {...extra} />
);

function wrapText(value, maxChars = 64, maxLines = 2) {
  const words = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  const lines = [];

  words.forEach((word) => {
    if (lines.length === 0) {
      lines.push(word);
      return;
    }

    const current = lines[lines.length - 1] || "";
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxChars) {
      lines[lines.length - 1] = next;
      return;
    }

    if (lines.length < maxLines) {
      lines.push(word);
      return;
    }

    lines[lines.length - 1] = clipText(`${lines[lines.length - 1]} ${word}`, maxChars);
  });

  return lines.slice(0, maxLines);
}

function splitPanels(data) {
  return [
    { title: "QDLF", subtitle: data.panelName.toUpperCase().slice(0, 18), circuits: data.visibleCircuits, indexOffset: 0 },
  ];
}

function CircuitLoadBox({ x, y, row, side }) {
  if (row.reserve) {
    return (
      <Text x={x} y={y + 3} size={7.1} weight={700} color={CAD_BLUE} anchor={side === "left" ? "end" : "start"} family="Courier New, monospace">
        Reserva
      </Text>
    );
  }

  const label = clipText(row.label, 43);
  const anchor = side === "left" ? "end" : "start";
  const textX = side === "left" ? x : x;

  return (
    <g>
      <Text x={textX} y={y - 2} size={6.45} weight={700} color={CAD_BLUE} anchor={anchor} family="Courier New, monospace">
        {label}
      </Text>
      {row.circuit?.powerW >= 7000 && (
        <Text x={textX} y={y + 8} size={6.05} weight={700} color={CAD_BLUE} anchor={anchor} family="Courier New, monospace">
          {`${Math.round(row.circuit.powerW).toLocaleString("pt-BR")} W`}
        </Text>
      )}
    </g>
  );
}

function BreakerSymbol({ x, y, side, amp = 16, reserve = false }) {
  const dir = side === "left" ? -1 : 1;
  const switchX = x + dir * 20;

  if (reserve) {
    return (
      <g>
        {line(switchX - dir * 7, y, switchX + dir * 9, y, 0.82, "#a9b1c2", { strokeDasharray: "3 2" })}
        <circle cx={switchX + dir * 11} cy={y} r="1.8" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.7" />
      </g>
    );
  }

  return (
    <g>
      <Text x={switchX} y={y - 10} size={6.7} weight={700} color={CAD_BLUE} anchor="middle" family="Courier New, monospace">
        {amp}A
      </Text>
      <circle cx={switchX - dir * 13} cy={y} r="2.5" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.95" />
      <circle cx={switchX + dir * 13} cy={y} r="2.5" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.95" />
      <path
        d={`M ${switchX - dir * 10.5} ${y - 0.8} Q ${switchX} ${y - 13} ${switchX + dir * 10.5} ${y - 0.8}`}
        fill="none"
        stroke={CAD_BLUE}
        strokeWidth="0.95"
      />
    </g>
  );
}

function MainBreaker({ busXs, y, amp }) {
  const magenta = "#ff4fe3";
  return (
    <g>
      <Text x={busXs[busXs.length - 1] + 30} y={y + 6} size={6.6} weight={700} color={magenta} family="Courier New, monospace">
        {amp}
      </Text>
      {busXs.map((x, index) => (
        <g key={x}>
          <circle cx={x} cy={y} r="2" fill="#ffffff" stroke={magenta} strokeWidth="0.9" />
          <circle cx={x} cy={y + 18} r="2" fill="#ffffff" stroke={magenta} strokeWidth="0.9" />
          <path d={`M ${x - 2} ${y + 1} Q ${x + 16} ${y + 10} ${x + 2} ${y + 18}`} fill="none" stroke={magenta} strokeWidth="0.9" />
          {index < busXs.length - 1 && line(x, y + 18, busXs[index + 1], y + 18, 0.8, magenta)}
        </g>
      ))}
    </g>
  );
}

function SurgeProtection({ x, y, busXs, layout }) {
  const terminalX = x - 76;

  return (
    <g>
      <rect x={terminalX - 6} y={y - 52} width="12" height="34" fill="#ffffff" stroke="#6b7280" strokeWidth="0.6" />
      <Text x={terminalX - 15} y={y - 18} size={12} weight={600} color={CAD_INK} anchor="end">
        T
      </Text>
      <Text x={terminalX + 12} y={y - 18} size={12} weight={500} color={CAD_INK}>
        {layout.feederGaugeLabel}
      </Text>
      {busXs.map((busX, index) => {
        const yy = y + index * 14;
        return (
          <g key={busX}>
            {line(terminalX, yy, busX, yy, 0.85, "#9ca3af")}
            <circle cx={terminalX} cy={yy} r="2" fill="#22c55e" />
            <circle cx={busX} cy={yy} r="2" fill="#22c55e" />
            <Text x={busX - 34} y={yy - 2} size={4.8} weight={900} color="#ff1717" anchor="end" family="Courier New, monospace">
              {layout.surgeLabel}
            </Text>
            <circle cx={busX - 25} cy={yy - 1} r="4.5" fill="#ffffff" stroke="#ff1717" strokeWidth="0.8" />
            <Text x={busX - 25} y={yy + 1.4} size={4.5} weight={900} color="#ff1717" anchor="middle" family="Courier New, monospace">
              I
            </Text>
          </g>
        );
      })}
    </g>
  );
}

function CircuitBranch({ row, side, y, busXsByCode, labelX }) {
  const connectedCodes = row.reserve
    ? [row.phase]
    : (row.circuit?.phaseSet || [row.phase])
        .map((p) => {
          if (p === "A") return "R";
          if (p === "B") return "S";
          if (p === "C") return "T";
          return p;
        })
        .filter((code) => busXsByCode[code] !== undefined);

  if (connectedCodes.length === 0) {
    connectedCodes.push(row.phase);
  }

  const connectedXs = connectedCodes.map((code) => busXsByCode[code]);
  const primaryBusX = busXsByCode[row.phase] || Object.values(busXsByCode)[0];
  const labelEdgeX = side === "left" ? labelX + 14 : labelX - 14;

  const lineStart = side === "left" ? labelEdgeX : Math.min(...connectedXs);
  const lineEnd = side === "left" ? Math.max(...connectedXs) : labelEdgeX;
  const breakerAnchor = side === "left" ? primaryBusX - 22 : primaryBusX + 22;

  return (
    <g>
      <CircuitLoadBox x={labelX} y={y} row={row} side={side} />
      {line(lineStart, y, lineEnd, y, 0.85, "#9ca3af")}
      <BreakerSymbol x={breakerAnchor} y={y} side={side} amp={row.breaker} reserve={row.reserve} />
      {connectedXs.map((busX, index) => (
        <circle key={index} cx={busX} cy={y} r="2" fill="#22c55e" />
      ))}
    </g>
  );
}

function DistributionBoard({ panel, data, x, y, w, h, labelNumber }) {
  const layout = buildTrifilarReferenceLayout(data, { maxRows: 17 });
  const busCodes = layout.phaseOrder;
  const top = y + 76;
  const bottom = y + h - 58;
  const centerX = x + w / 2;
  const busGap = 17;
  const busXs = busCodes.map((_, index) => centerX + (index - (busCodes.length - 1) / 2) * busGap);
  const busXsByCode = Object.fromEntries(busCodes.map((code, index) => [code, busXs[index]]));
  const rows = layout.rows;
  const branchTop = top + 108;
  const branchGap = Math.min(29, Math.max(22, (bottom - branchTop - 26) / Math.max(rows.length - 1, 1)));
  const labelLeftX = x + 182;
  const labelRightX = x + w - 182;

  return (
    <g>
      <Text x={centerX} y={y + 8} size={12} weight={500} color={CAD_INK} anchor="middle">
        {layout.title}
      </Text>
      <Text x={centerX} y={y + 34} size={11} weight={500} color={CAD_INK} anchor="middle">
        {layout.feederGaugeLabel}
      </Text>

      {busCodes.map((code, index) => (
        <g key={code}>
          <Text x={busXs[index]} y={top - 6} size={12} weight={500} color={CAD_INK} anchor="middle">
            {code}
          </Text>
          {line(busXs[index], top, busXs[index], bottom, 0.85, "#6b7280")}
        </g>
      ))}

      <rect x={centerX + 100} y={top} width="12" height="34" fill="#ffffff" stroke="#6b7280" strokeWidth="0.6" />
      <Text x={centerX + 88} y={top + 28} size={12} weight={600} color={CAD_INK} anchor="end">
        N
      </Text>
      <Text x={centerX + 118} y={top + 28} size={12} weight={500} color={CAD_INK}>
        {layout.feederGaugeLabel}
      </Text>

      <MainBreaker busXs={busXs} y={top + 24} amp={layout.mainBreakerLabel} />
      <SurgeProtection x={centerX} y={top + 62} busXs={busXs} layout={layout} />

      {rows.map((row, index) => {
        const side = row.side;
        const branchY = branchTop + index * branchGap;
        const labelX = side === "left" ? labelLeftX : labelRightX;
        return (
          <CircuitBranch
            key={`${panel.title}-${row.key}`}
            row={row}
            side={side}
            y={branchY}
            busXsByCode={busXsByCode}
            labelX={labelX}
          />
        );
      })}

      {panel.circuits.length === 0 && (
        <Text x={centerX} y={y + h / 2} size={10} weight={600} color="#64748b" anchor="middle">
          Sem circuitos cadastrados
        </Text>
      )}

      {layout.hiddenRows > 0 && (
        <Text x={centerX} y={bottom + 18} size={6.6} weight={700} color={CAD_BLUE} anchor="middle" family="Courier New, monospace">
          +{layout.hiddenRows} circuito(s) listados no quadro de cargas
        </Text>
      )}

      {line(centerX - 54, bottom + 6, centerX + 54, bottom + 6, 0.85, CAD_INK)}
      <Text x={centerX} y={bottom + 24} size={9} weight={500} color={CAD_INK} anchor="middle">
        {layout.subtitle}
      </Text>

      {labelNumber && (
        <g>
          <circle cx={x + 12} cy={y + h + 34} r="10" fill="#ffffff" stroke={CAD_YELLOW} strokeWidth="1.4" />
          <Text x={x + 12} y={y + h + 38} size={8.8} weight={700} color={CAD_INK} anchor="middle">
            {labelNumber}
          </Text>
          <Text x={x + 28} y={y + h + 38} size={9.5} weight={700} color={CAD_INK}>
            Diagrama Trifilar
          </Text>
          {line(x + 142, y + h + 38, x + 292, y + h + 38, 1.2, CAD_YELLOW)}
        </g>
      )}
    </g>
  );
}

function SectionBar({ x, y, w, title, right }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="16" fill="#f8fafc" stroke={CAD_INK} strokeWidth="0.45" />
      <rect x={x} y={y} width="4" height="16" fill={CAD_BLUE} />
      <Text x={x + 10} y={y + 11} size={6.25} weight={900} color={CAD_INK}>
        {title}
      </Text>
      {right && (
        <Text x={x + w - 8} y={y + 11} size={5.45} weight={800} color="#475569" anchor="end">
          {right}
        </Text>
      )}
    </g>
  );
}

function SummaryBand({ x, y, w, items }) {
  const gap = 5;
  const cellW = (w - gap * (items.length - 1)) / items.length;

  return (
    <g>
      {items.map(([label, value, sub], index) => {
        const xx = x + index * (cellW + gap);
        return (
          <g key={label}>
            <rect x={xx} y={y} width={cellW} height="40" fill="#ffffff" stroke={CAD_INK} strokeWidth="0.45" />
            <rect x={xx} y={y} width={cellW} height="4" fill={CAD_BLUE} />
            <Text x={xx + 6} y={y + 14} size={5.3} weight={800} color="#475569">
              {label}
            </Text>
            <Text x={xx + 6} y={y + 27} size={8.2} weight={900} color={CAD_INK}>
              {value}
            </Text>
            {sub && (
              <Text x={xx + cellW - 6} y={y + 34.5} size={4.65} weight={800} color="#64748b" anchor="end">
                {sub}
              </Text>
            )}
          </g>
        );
      })}
    </g>
  );
}

function TechnicalMatrix({ x, y, w, rows, rowH = 14 }) {
  const labelW = 52;
  const valueW = 116;
  const labelW2 = 54;
  const valueW2 = w - labelW - valueW - labelW2;

  return (
    <g>
      {rows.map(([labelA, valueA, labelB, valueB], index) => {
        const yy = y + index * rowH;
        const fill = index % 2 === 0 ? "#ffffff" : "#fbfcff";
        const cells = [
          [x, labelW, labelA, true],
          [x + labelW, valueW, valueA, false],
          [x + labelW + valueW, labelW2, labelB, true],
          [x + labelW + valueW + labelW2, valueW2, valueB, false],
        ];

        return (
          <g key={`${labelA}-${labelB}`}>
            {cells.map(([xx, cw, text, isLabel]) => (
              <g key={`${labelA}-${labelB}-${xx}`}>
                <rect x={xx} y={yy} width={cw} height={rowH} fill={fill} stroke={CAD_FAINT} strokeWidth="0.45" />
                <Text x={xx + 4} y={yy + 9.4} size={isLabel ? 5.05 : 5.35} weight={isLabel ? 900 : 700} color={isLabel ? "#334155" : CAD_INK}>
                  {clipText(text, isLabel ? 13 : Math.max(12, Math.floor(cw / 4.2)))}
                </Text>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function CircuitSummaryTable({ x, y, w, circuits }) {
  const headers = ["CIRC.", "DESCRIÇÃO", "ALIM.", "DJ", "COND.", "ΔV"];
  const widths = [30, 112, 42, 38, 60, w - 30 - 112 - 42 - 38 - 60];
  const rowH = 12.6;
  const rows = circuits.slice(0, 6);

  return (
    <g>
      {headers.map((header, index) => {
        const xx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
        return (
          <g key={header}>
            <rect x={xx} y={y} width={widths[index]} height={rowH} fill="#f8fafc" stroke={CAD_INK} strokeWidth="0.45" />
            <Text x={xx + widths[index] / 2} y={y + 8.65} size={4.9} weight={900} color={CAD_INK} anchor="middle">
              {header}
            </Text>
          </g>
        );
      })}
      {rows.map((circuit, rowIndex) => {
        const values = [
          circuit.id,
          clipText(circuit.description, 20),
          circuit.supplyLabel,
          `${circuit.breaker}A`,
          clipText(circuit.wireGauge, 14),
          `${formatNumber(circuit.voltageDropPct, 1)}%`,
        ];
        return values.map((value, index) => {
          const xx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
          const yy = y + rowH + rowIndex * rowH;
          const fill = rowIndex % 2 === 0 ? "#ffffff" : "#fbfcff";
          return (
            <g key={`${circuit.id}-${index}`}>
              <rect x={xx} y={yy} width={widths[index]} height={rowH} fill={fill} stroke={CAD_FAINT} strokeWidth="0.55" />
              <Text
                x={index === 1 ? xx + 4 : xx + widths[index] / 2}
                y={yy + 8.55}
                size={5.05}
                weight={index === 0 ? 800 : 600}
                color={CAD_INK}
                anchor={index === 1 ? "start" : "middle"}
              >
                {value}
              </Text>
            </g>
          );
        });
      })}
      {circuits.length > rows.length && (
        <Text x={x + w} y={y + rowH + rows.length * rowH + 8.5} size={5.15} weight={800} color="#475569" anchor="end">
          +{circuits.length - rows.length} circuito(s) no quadro de cargas
        </Text>
      )}
    </g>
  );
}

function LegendGlyph({ x, y, code }) {
  if (code === "F") {
    return (
      <g>
        {line(x, y, x + 27, y, 1.7, CAD_INK)}
        <circle cx={x + 27} cy={y} r="2.1" fill="#ffffff" stroke={CAD_INK} strokeWidth="0.8" />
      </g>
    );
  }
  if (code === "N") return line(x, y, x + 29, y, 1.7, "#00d8b8");
  if (code === "PE") {
    return (
      <g>
        {line(x, y, x + 29, y, 1.7, "#16a34a")}
        {line(x + 23, y, x + 23, y + 7, 1.1, "#16a34a")}
        {line(x + 18, y + 7, x + 28, y + 7, 1, "#16a34a")}
      </g>
    );
  }
  if (code === "DJ") {
    return (
      <g>
        <circle cx={x + 4} cy={y} r="2.4" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.8" />
        <circle cx={x + 27} cy={y} r="2.4" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.8" />
        <path d={`M ${x + 6.5} ${y - 0.8} Q ${x + 15} ${y - 12} ${x + 24.5} ${y - 0.8}`} fill="none" stroke={CAD_BLUE} strokeWidth="0.9" />
      </g>
    );
  }
  if (code === "DPS") {
    return (
      <g>
        <rect x={x + 8} y={y - 8} width="16" height="16" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.8" />
        <path d={`M ${x + 17} ${y - 6} L ${x + 12} ${y + 1} H ${x + 16} L ${x + 13} ${y + 8} L ${x + 21} ${y - 1} H ${x + 17} Z`} fill={CAD_BLUE} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x + 7} y={y - 7} width="18" height="14" fill="#ffffff" stroke={CAD_BLUE} strokeWidth="0.8" />
      <Text x={x + 16} y={y + 2.6} size={5.2} weight={900} color={CAD_BLUE} anchor="middle">
        DR
      </Text>
    </g>
  );
}

function ConductorLegend({ x, y, w }) {
  const items = [
    ["F", "Fase", "preto/vermelho/marrom"],
    ["N", "Neutro", "azul-claro"],
    ["PE", "Proteção", "verde/verde-amarelo"],
    ["DJ", "Disjuntor", "curva B/C/D"],
    ["DPS", "DPS II", "curto ao PE"],
    ["DR", "DR/IDR", "30mA aplicável"],
  ];
  const columnGap = 8;
  const columnW = (w - columnGap) / 2;
  const rowH = 18;

  return (
    <g>
      {items.map(([code, label, desc], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const xx = x + column * (columnW + columnGap);
        const yy = y + row * rowH;
        return (
          <g key={code}>
            <rect x={xx} y={yy - 2} width={columnW} height={rowH} fill={row % 2 === 0 ? "#ffffff" : "#fbfcff"} stroke={CAD_FAINT} strokeWidth="0.4" />
            <LegendGlyph x={xx + 6} y={yy + 7} code={code} />
            <Text x={xx + 43} y={yy + 6.4} size={5.3} weight={900} color={CAD_INK}>
              {label}
            </Text>
            <Text x={xx + 43} y={yy + 14} size={4.65} weight={700} color="#475569">
              {clipText(desc, 23)}
            </Text>
          </g>
        );
      })}
    </g>
  );
}

function NoteRows({ x, y, w, notes }) {
  const maxChars = Math.max(58, Math.floor(w / 4.9));
  const rowH = 15.5;

  return (
    <g>
      {notes.map((note, index) => {
        const yy = y + index * rowH;
        const lines = wrapText(note, maxChars, 1);
        return (
          <g key={note}>
            <rect x={x} y={yy - 9.4} width="10" height="10" fill="#ffffff" stroke={CAD_INK} strokeWidth="0.45" />
            <Text x={x + 5} y={yy - 1.7} size={4.4} weight={900} color={CAD_INK} anchor="middle">
              {index + 1}
            </Text>
            {lines.map((lineText, lineIndex) => (
              <Text key={`${note}-${lineIndex}`} x={x + 15} y={yy - 1.4 + lineIndex * 7.1} size={4.8} weight={700} color={CAD_INK}>
                {lineText}
              </Text>
            ))}
          </g>
        );
      })}
    </g>
  );
}

function TechnicalInfoPanel({ data, x, y, w, h }) {
  const matrixRows = [
    ["Quadro", data.panelName.toUpperCase(), "Sistema", data.system.label],
    ["Tensão", data.lineVoltage, "Entrada", data.feederLabel],
    ["Barram.", `${data.system.busbar} · ${Math.max(80, data.generalBreaker)}A`, "DIN", `${data.panelSize} mod. / res. ${data.reserveModules}`],
    ["DPS", `Classe II · ${Math.max(1, data.system.phaseCodes.length)} polo(s)`, "DR/IDR", data.drCount ? `30mA · ${data.drCount} circ.` : "prever uso"],
    ["Icc ref.", `${data.generalBreaker > 40 ? "≥ 6" : "≥ 3"} kA no QD`, "Terra", "PE separado do N"],
  ];
  const notes = [
    "Conferir Icu/Icn dos disjuntores com a corrente de curto-circuito local.",
    "Validar queda de tensão, método de instalação, temperatura e agrupamento em obra.",
    "Identificar circuitos no quadro e executar ensaios antes da energização.",
    "Cores e identificação conforme IEC 60445 e práticas da NBR 5410.",
  ];
  const sectionX = x + 12;
  const sectionW = w - 24;
  const demandKva = data.totalPower / 1000;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={CAD_INK} strokeWidth="0.9" />
      <rect x={x} y={y} width={w} height="36" fill="#ffffff" stroke={CAD_INK} strokeWidth="0.45" />
      <rect x={x} y={y} width="6" height="36" fill={CAD_BLUE} />
      <Text x={x + 15} y={y + 16} size={8.4} weight={900} color={CAD_INK}>
        QUADRO DE DADOS - DIAGRAMA TRIFILAR
      </Text>
      <Text x={x + 15} y={y + 28} size={5.4} weight={800} color="#475569">
        Memorial técnico, proteções e legenda de condutores
      </Text>
      <Text x={x + w - 12} y={y + 16} size={5.7} weight={900} color={CAD_INK} anchor="end">
        {data.drawingCode}
      </Text>
      <Text x={x + w - 12} y={y + 28} size={5.1} weight={800} color="#475569" anchor="end">
        REV. {data.revision}
      </Text>

      <SummaryBand
        x={sectionX}
        y={y + 48}
        w={sectionW}
        items={[
          ["DEMANDA", `${formatNumber(demandKva, 2)} kW`, "P total"],
          ["CORRENTE", `${formatNumber(data.generalCurrent, 1)} A`, "I projeto"],
          ["DJ GERAL", `${data.system.generalPoles}P ${data.generalBreaker}A`, "curva C"],
        ]}
      />

      <SectionBar x={sectionX} y={y + 101} w={sectionW} title="DADOS DE DIMENSIONAMENTO E PROTEÇÃO" right="NBR 5410" />
      <TechnicalMatrix x={sectionX} y={y + 117} w={sectionW} rows={matrixRows} />

      <SectionBar x={sectionX} y={y + 205} w={sectionW} title="PLANILHA RESUMIDA DOS CIRCUITOS" right={`${data.visibleCircuits.length} listados`} />
      <CircuitSummaryTable x={sectionX} y={y + 224} w={sectionW} circuits={data.visibleCircuits} />

      <SectionBar x={sectionX} y={y + 350} w={sectionW} title="LEGENDA EXECUTIVA" right="IEC 60445" />
      <ConductorLegend x={x + 14} y={y + 374} w={w - 28} />

      <SectionBar x={sectionX} y={y + 465} w={sectionW} title="CRITÉRIOS DE EMISSÃO" right={data.date} />
      <NoteRows x={x + 15} y={y + 491} w={w - 30} notes={notes} />

      <rect x={sectionX} y={y + h - 26} width={sectionW} height="15" fill="#fbfcff" stroke={CAD_FAINT} strokeWidth="0.45" />
      <Text x={sectionX + 7} y={y + h - 15.7} size={4.95} weight={800} color="#475569">
        Documento técnico automático. Conferência final por profissional habilitado antes da emissão.
      </Text>
    </g>
  );
}

function TitleBlock({ data }) {
  const x = 640;
  const y = 704;
  const w = 486;
  const h = 105;
  const rows = [
    ["DISCIPLINA:", "Eletrotécnica e Instalações Elétricas"],
    ["CLIENTE:", data.client],
    ["PROJETO:", data.projectName],
    ["DESENHO:", "Diagrama Trifilar"],
    ["SISTEMA:", `${data.system.label} · ${data.lineVoltage}`],
  ];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={CAD_INK} strokeWidth="0.8" />
      {rows.map(([label, value], index) => {
        const rowY = y + index * 18;
        return (
          <g key={label}>
            {index > 0 && line(x, rowY, x + w, rowY, 0.45, CAD_INK)}
            <Text x={x + 8} y={rowY + 12} size={5.8} weight={700} color={CAD_INK}>
              {label}
            </Text>
            <Text x={x + 92} y={rowY + 12} size={6.5} weight={700} color={CAD_INK}>
              {clipText(value, 46)}
            </Text>
          </g>
        );
      })}
      {line(x + w - 96, y, x + w - 96, y + h, 0.55, CAD_INK)}
      <Text x={x + w - 48} y={y + 48} size={18} weight={700} color={CAD_INK} anchor="middle">
        XX
      </Text>
      <Text x={x + w - 48} y={y + 70} size={6.2} weight={700} color={CAD_INK} anchor="middle">
        {data.drawingCode}
      </Text>
      <Text x={x + w - 48} y={y + 86} size={5.8} weight={700} color={CAD_INK} anchor="middle">
        {data.date}
      </Text>
    </g>
  );
}

function SheetFooter({ data }) {
  return (
    <g>
      <TitleBlock data={data} />
      <Text x="68" y="792" size={6.4} weight={600} color="#64748b">
        Condutores e proteções calculados automaticamente. Validar em obra por profissional habilitado antes da emissão.
      </Text>
    </g>
  );
}

export default function ProfessionalTrifilarSheetSVG({ project, metrics }) {
  const data = buildProfessionalTrifilar(project, metrics);
  const panels = splitPanels(data);
  const showTechnicalPanel = Boolean(project?.show_trifilar_technical_panel);
  const panelLayout = [
    { x: 70, y: 66, w: 1048, h: 625 },
  ];

  return (
    <svg
      width={data.sheet.width}
      height={data.sheet.height}
      viewBox={`0 0 ${data.sheet.width} ${data.sheet.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "Arial, Helvetica, sans-serif", background: "#ffffff", display: "block" }}
    >
      <rect width={data.sheet.width} height={data.sheet.height} fill="#ffffff" />
      <rect x="38" y="24" width="1114" height="792" fill="none" stroke={CAD_INK} strokeWidth="2.2" />
      <Text x="594" y="54" size={16} weight={700} color={CAD_INK} anchor="middle">
        {clipText(data.projectName.toUpperCase(), 42)}
      </Text>

      {panels.map((panel, index) => (
        <DistributionBoard
          key={panel.title}
          panel={panel}
          data={data}
          {...panelLayout[index]}
          labelNumber={index === 0 ? 4 : null}
        />
      ))}

      {showTechnicalPanel && (
        <TechnicalInfoPanel data={data} x={740} y={90} w={370} h={590} />
      )}

      {data.hiddenCircuits > 0 && (
        <Text x="594" y="684" size={8} weight={700} color={CAD_INK} anchor="middle">
          +{data.hiddenCircuits} circuito(s) adicionais listados no quadro de cargas
        </Text>
      )}

      <SheetFooter data={data} />
    </svg>
  );
}
