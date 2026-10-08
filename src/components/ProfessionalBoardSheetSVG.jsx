import {
  buildProfessionalPanelBoardSheets,
  clipText,
  formatNumber,
} from "@/lib/professionalPanelBoardLibrary";

const phaseColor = (colors, phase) => ({
  A: colors.phaseA,
  B: colors.phaseB,
  C: colors.phaseC,
  N: colors.neutral,
  PE: colors.earth,
}[phase] || colors.ink);

const phasePower = (circuit, phase) => (
  circuit.phaseSet?.includes(phase) ? Math.round(circuit.powerW || 0) : ""
);

function Text({
  x,
  y,
  children,
  size = 9,
  weight = 500,
  color = "#111827",
  anchor = "start",
  family = "Inter, Arial, Helvetica, sans-serif",
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

function SectionTitle({ x, y, w, title, subtitle, colors }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="24" rx="3" fill={colors.blueDark} />
      <Text x={x + 10} y={y + 16} size={9} weight={800} color="#ffffff">
        {title}
      </Text>
      {subtitle && (
        <Text x={x + w - 10} y={y + 16} size={7.2} weight={700} color="#d8eefb" anchor="end">
          {subtitle}
        </Text>
      )}
    </g>
  );
}

function DeviceBlock({ x, y, w, h = 34, title, value, color, sub }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill="#ffffff" stroke={color} strokeWidth="1.1" />
      <rect x={x} y={y} width="7" height={h} rx="3" fill={color} />
      <Text x={x + 16} y={y + 14} size={8.5} weight={800} color={color}>
        {title}
      </Text>
      <Text x={x + w - 10} y={y + 14} size={8.5} weight={800} color="#111827" anchor="end">
        {value}
      </Text>
      {sub && (
        <Text x={x + 16} y={y + 27} size={6.6} weight={600} color="#5f6b7a">
          {sub}
        </Text>
      )}
    </g>
  );
}

function TableCell({
  x,
  y,
  w,
  h,
  children,
  colors,
  align = "center",
  fill = "#ffffff",
  weight = 600,
  size = 6.8,
  color,
}) {
  const textX = align === "left" ? x + 5 : align === "right" ? x + w - 5 : x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={colors.faint} strokeWidth="0.55" />
      <Text
        x={textX}
        y={y + h / 2 + size / 3}
        size={size}
        weight={weight}
        color={color || colors.ink}
        anchor={align === "left" ? "start" : align === "right" ? "end" : "middle"}
      >
        {children}
      </Text>
    </g>
  );
}

function Header({ data, sheet }) {
  const { colors } = data;
  const sheetNum = sheet ? `Folha ${sheet.sheetIndex} de ${sheet.totalSheets}` : "Folha 01 de 01";
  const sheetTitle = sheet?.title || data.title;
  const sheetSubtitle = sheet?.subtitle || "NBR 5410 · Diagrama unifilar · Quadro de cargas · Balanceamento e memória";

  return (
    <g>
      <rect x="24" y="24" width="1141" height="58" fill="#ffffff" stroke={colors.ink} strokeWidth="0.8" />
      <rect x="24" y="24" width="12" height="58" fill={colors.blue} />
      <Text x="48" y="47" size={16} weight={900} color={colors.ink}>
        {sheetTitle}
      </Text>
      <Text x="48" y="66" size={8.5} weight={700} color={colors.muted}>
        {sheetSubtitle} · {sheetNum}
      </Text>
      <Text x="848" y="44" size={10} weight={900} color={colors.blue} anchor="end">
        {clipText(data.panelName.toUpperCase(), 38)}
      </Text>
      <Text x="848" y="64" size={7.8} weight={700} color={colors.muted} anchor="end">
        {data.system.label} · {data.project?.voltage || 220}V · {data.circuits.length} circuito(s) total
      </Text>
      <rect x="882" y="36" width="90" height="30" rx="4" fill={colors.blueDark} />
      <Text x="927" y="56" size={12} weight={900} color="#ffffff" anchor="middle">
        VOLT AI
      </Text>
      <Text x="1148" y="44" size={8.5} weight={900} color={colors.ink} anchor="end">
        {sheet?.sheetCode || data.drawingCode}
      </Text>
      <Text x="1148" y="64" size={7.4} weight={700} color={colors.muted} anchor="end">
        {data.revision} · {data.date}
      </Text>
    </g>
  );
}

function TitleBlock({ data, sheet, x = 438, y = 720, w = 705, h = 86 }) {
  const { colors } = data;
  const metaW = Math.min(180, w * 0.26);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={colors.ink} strokeWidth="0.8" />
      <rect x={x} y={y} width={w - metaW} height="24" fill={colors.soft} stroke={colors.faint} strokeWidth="0.6" />
      <Text x={x + 12} y={y + 16} size={8.5} weight={900} color={colors.ink}>
        {clipText(sheet?.title || data.title, 56)}
      </Text>
      <rect x={x + w - metaW} y={y} width={metaW} height={h} fill="#ffffff" stroke={colors.ink} strokeWidth="0.6" />
      <line x1={x + w - metaW} y1={y + 28} x2={x + w} y2={y + 28} stroke={colors.faint} strokeWidth="0.6" />
      <line x1={x + w - metaW} y1={y + 56} x2={x + w} y2={y + 56} stroke={colors.faint} strokeWidth="0.6" />
      <Text x={x + w - metaW + 10} y={y + 13} size={6.5} weight={900} color={colors.muted}>
        PRANCHA
      </Text>
      <Text x={x + w - 12} y={y + 19} size={12} weight={900} color={colors.ink} anchor="end">
        {sheet?.sheetCode || data.drawingCode}
      </Text>
      <Text x={x + w - metaW + 10} y={y + 42} size={6.5} weight={900} color={colors.muted}>
        FOLHA / REV.
      </Text>
      <Text x={x + w - 12} y={y + 47} size={9} weight={900} color={colors.ink} anchor="end">
        {sheet ? `${sheet.sheetIndex}/${sheet.totalSheets}` : "01/01"} · {data.revision}
      </Text>
      <Text x={x + w - metaW + 10} y={y + 70} size={6.5} weight={900} color={colors.muted}>
        DATA
      </Text>
      <Text x={x + w - 12} y={y + 75} size={9} weight={900} color={colors.ink} anchor="end">
        {data.date}
      </Text>

      {data.titleRows.map(([label, value], index) => {
        const rowY = y + 28 + index * 10.5;
        return (
          <g key={label}>
            <Text x={x + 12} y={rowY} size={5.9} weight={900} color={colors.muted}>
              {label}
            </Text>
            <Text x={x + 98} y={rowY} size={6.4} weight={700} color={colors.ink}>
              {clipText(value, 60)}
            </Text>
          </g>
        );
      })}
    </g>
  );
}

function ConductorLegend({ x, y, w = 370, h = 95, colors }) {
  const items = [
    { code: "FA", label: "Fase A", color: colors.phaseA, name: "Preto" },
    { code: "FB", label: "Fase B", color: colors.phaseB, name: "Vermelho" },
    { code: "FC", label: "Fase C", color: colors.phaseC, name: "Marrom" },
    { code: "N", label: "Neutro", color: colors.neutral, name: "Azul-claro" },
    { code: "PE", label: "Proteção", color: colors.earth, name: "Verde / Amarelo" },
  ];

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 12} y={y + 18} size={8.5} weight={900} color={colors.ink}>
        IDENTIFICAÇÃO DE CONDUTORES (NBR 5410 / IEC 60445)
      </Text>
      {items.map((item, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const ix = x + 14 + col * (w / 3);
        const iy = y + 36 + row * 26;
        return (
          <g key={item.code}>
            <line x1={ix} y1={iy} x2={ix + 24} y2={iy} stroke={item.color} strokeWidth="3" />
            <circle cx={ix + 12} cy={iy} r="2.5" fill="#ffffff" stroke={item.color} strokeWidth="1" />
            <Text x={ix + 30} y={iy + 3} size={7.5} weight={900} color={item.color}>
              {item.code}
            </Text>
            <Text x={ix + 30} y={iy + 13} size={6.2} weight={600} color={colors.muted}>
              {item.name}
            </Text>
          </g>
        );
      })}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COMBINED SHEET (QUADROS PEQUENOS <= 12 CIRCUITOS)
// ─────────────────────────────────────────────────────────────────────────────
function CombinedPanelDiagram({ data, sheet }) {
  const { colors } = data;
  const x = 44;
  const y = 104;
  const w = 370;
  const h = 696;
  const center = x + w / 2;
  const busTop = y + 265;
  const branchRows = sheet.branchRows || data.branchRows;
  
  const branchCount = Math.max(branchRows.length, 1);
  const branchGap = Math.min(32, Math.max(22, (h - 320) / branchCount));
  const busBottom = busTop + 35 + branchCount * branchGap;

  const phaseXs = data.system.phaseLabels.map((_, index) => (
    center + (index - (data.system.phaseLabels.length - 1) / 2) * 22
  ));
  const phaseCodesByIndex = data.system.phaseLabels.map((label) => {
    if (label === "R" || label === "F") return "A";
    if (label === "S") return "B";
    if (label === "T") return "C";
    return label;
  });
  const branchStart = busTop + 42;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffffff" stroke={colors.ink} strokeWidth="0.75" />
      <SectionTitle
        x={x}
        y={y}
        w={w}
        title="DIAGRAMA DO QUADRO"
        subtitle={`${data.panelSize} DIN · reserva ${data.reserveModules}`}
        colors={colors}
      />

      <Text x={center} y={y + 52} size={12} weight={900} color={colors.ink} anchor="middle">
        {clipText(data.panelName.toUpperCase(), 34)}
      </Text>
      <Text x={center} y={y + 68} size={7.5} weight={700} color={colors.muted} anchor="middle">
        Alimentador Cu {data.feederGauge}mm² · Barramento {data.system.busbar}
      </Text>

      {/* Cadeia de Proteção Geral Dinâmica (Disjuntor Geral, DPS, IDR/DR) */}
      {(() => {
        const blocks = [];
        if (data.hasGeneralBreaker !== false && data.generalBreaker > 0) {
          blocks.push({
            id: "gen_brk",
            yTop: y + 96,
            yBottom: y + 130,
            render: () => (
              <DeviceBlock
                key="gen_brk"
                x={x + 64}
                y={y + 96}
                w={242}
                title="DISJUNTOR GERAL"
                value={`${data.generalPoles || data.system.generalPoles}P ${data.generalBreaker}A`}
                color={colors.blue}
                sub={`Corrente de projeto ${formatNumber(data.generalCurrent, 1)}A`}
              />
            ),
          });
        }
        if (data.dpsCount > 0) {
          blocks.push({
            id: "dps",
            yTop: y + 152,
            yBottom: y + 186,
            render: () => (
              <DeviceBlock
                key="dps"
                x={x + 64}
                y={y + 152}
                w={242}
                title="DPS CLASSE II"
                value={`${data.dpsCount} polo(s)`}
                color={colors.red}
                sub={data.dpsDeviceCount ? `${data.dpsDeviceCount} dispositivo(s) no quadro` : "Proteção contra surtos no QD"}
              />
            ),
          });
        }
        if (data.drDeviceCount > 0) {
          blocks.push({
            id: "dr",
            yTop: y + 208,
            yBottom: y + 242,
            render: () => (
              <DeviceBlock
                key="dr"
                x={x + 64}
                y={y + 208}
                w={242}
                title="IDR / DR"
                value={`${data.drDeviceCount} disp. · ${data.drCount} circ.`}
                color={colors.blueDark}
                sub="30mA para áreas molhadas e tomadas aplicáveis"
              />
            ),
          });
        }

        const lines = [];
        if (blocks.length === 0) {
          lines.push(<line key="line-feed-bus" x1={center} y1={y + 78} x2={center} y2={busTop} stroke={colors.ink} strokeWidth="1.3" />);
        } else {
          // Line to first block
          lines.push(<line key="line-feed-first" x1={center} y1={y + 78} x2={center} y2={blocks[0].yTop} stroke={colors.ink} strokeWidth="1.3" />);
          // Lines between blocks
          for (let i = 0; i < blocks.length - 1; i++) {
            lines.push(
              <line
                key={`line-block-${i}`}
                x1={center}
                y1={blocks[i].yBottom}
                x2={center}
                y2={blocks[i + 1].yTop}
                stroke={colors.ink}
                strokeWidth="1.3"
              />
            );
          }
          // Line from last block to busbar
          lines.push(
            <line
              key="line-last-bus"
              x1={center}
              y1={blocks[blocks.length - 1].yBottom}
              x2={center}
              y2={busTop}
              stroke={colors.ink}
              strokeWidth="1.3"
            />
          );
        }

        return (
          <g key="protection-chain">
            {lines}
            {blocks.map((b) => b.render())}
          </g>
        );
      })()}

      <rect x={x + 54} y={busTop - 18} width={w - 108} height="22" rx="4" fill={colors.soft} stroke={colors.faint} strokeWidth="0.8" />
      <Text x={center} y={busTop - 4} size={7.8} weight={900} color={colors.ink} anchor="middle">
        BARRAMENTOS DE DISTRIBUIÇÃO
      </Text>

      {data.system.phaseLabels.map((label, index) => {
        const phaseCode = phaseCodesByIndex[index];
        const color = phaseColor(colors, phaseCode);
        return (
          <g key={label}>
            <line x1={phaseXs[index]} y1={busTop + 8} x2={phaseXs[index]} y2={busBottom} stroke={color} strokeWidth={label === "PE" ? "1.7" : "1.2"} />
            <circle cx={phaseXs[index]} cy={busTop + 16} r="4" fill="#ffffff" stroke={color} strokeWidth="1" />
            <Text x={phaseXs[index]} y={busTop + 18.5} size={5.6} weight={900} color={color} anchor="middle">
              {label}
            </Text>
          </g>
        );
      })}

      {branchRows.map((row, index) => {
        const isCircuit = row.type === "circuit";
        const circuit = row.circuit;
        const yy = branchStart + index * branchGap;
        const side = index % 2 === 0 ? "left" : "right";
        
        const phaseSet = isCircuit ? [...new Set(circuit.phaseSet || ["A"])] : ["A"];
        const phaseConnections = phaseSet.map((phase, phaseIndex) => {
          const idx = phaseCodesByIndex.findIndex((item) => item === phase);
          return {
            phase,
            x: phaseXs[Math.max(0, idx)],
            offsetY: (phaseIndex - (phaseSet.length - 1) / 2) * 5.2,
          };
        });

        const outX = side === "left" ? x + 56 : x + w - 56;
        const labelX = side === "left" ? x + 12 : x + w - 12;
        const color = isCircuit ? phaseColor(colors, circuit.phaseSet?.[0]) : "#a5adb8";
        const label = isCircuit
          ? `${circuit.id} · ${clipText(circuit.description, 20)} · ${circuit.breaker}A`
          : row.label;
        const bundleHalfHeight = isCircuit ? ((phaseSet.length - 1) * 5.2) / 2 : 0;
        const labelY = isCircuit ? yy - bundleHalfHeight - 7.5 : yy - 4.5;
        const breakerPathFor = (lineY) => side === "left"
          ? `M ${outX} ${lineY} h -10 q -8 -8 -20 0 h -8`
          : `M ${outX} ${lineY} h 10 q 8 -8 20 0 h 8`;

        return (
          <g key={`${row.type}-${index}`}>
            {isCircuit && phaseSet.length > 1 && (
              <line
                x1={outX}
                y1={yy - bundleHalfHeight}
                x2={outX}
                y2={yy + bundleHalfHeight}
                stroke={color}
                strokeWidth="0.9"
              />
            )}
            {phaseConnections.map((connection, pIdx) => {
              const lineY = yy + (isCircuit ? connection.offsetY : 0);
              const lineColor = isCircuit ? phaseColor(colors, connection.phase) : "#cfd6df";
              const dotColor = isCircuit ? phaseColor(colors, connection.phase) : "#a5adb8";
              return (
                <g key={`phase-line-${pIdx}`}>
                  <line
                    x1={connection.x}
                    y1={lineY}
                    x2={outX}
                    y2={lineY}
                    stroke={lineColor}
                    strokeWidth={isCircuit ? "1" : "0.75"}
                    strokeDasharray={isCircuit ? undefined : "4 4"}
                  />
                  <circle cx={connection.x} cy={lineY} r="2.4" fill="#ffffff" stroke={dotColor} strokeWidth="1" />
                  <circle cx={outX} cy={lineY} r="2.4" fill="#ffffff" stroke={isCircuit ? dotColor : color} strokeWidth="1" />
                  {isCircuit && (
                    <path
                      d={breakerPathFor(lineY)}
                      fill="none"
                      stroke={colors.red}
                      strokeWidth="0.9"
                    />
                  )}
                </g>
              );
            })}

            <Text
              x={labelX}
              y={labelY}
              size={6.2}
              weight={isCircuit ? 800 : 700}
              color={isCircuit ? colors.blue : "#8b95a3"}
              anchor={side === "left" ? "start" : "end"}
            >
              {label}
            </Text>
          </g>
        );
      })}

      <Text x={center} y={y + h - 14} size={8.5} weight={800} color={colors.ink} anchor="middle">
        MEMÓRIA DE CÁLCULO - {clipText(data.projectName.toUpperCase(), 34)}
      </Text>
    </g>
  );
}

function CombinedRightColumn({ data, sheet }) {
  const { colors } = data;
  const x = 438;
  const y = 104;
  const totalW = 705;
  const widths = [36, 160, 44, 34, 40, 32, 42, 50, 40, 56, 39, 39, 39, 34];
  const headers = ["Circ.", "Descrição", "Pva", "V", "In", "Fc", "Iaj", "DJ", "ΔU", "Cond.", "FA", "FB", "FC", "DIN"];
  const rowH = 15;
  const headerY = y + 26;
  const bodyY = headerY + rowH;
  const tableRows = sheet.tableRows || data.tableRows;
  const tableHeight = 26 + rowH + tableRows.length * rowH;

  // Seções inferiores ancoradas dinamicamente após a tabela
  const demandY = y + tableHeight + 12;
  const notesY = demandY + 148;
  const titleY = 720;

  const cardW = 108;
  const cardGap = 10;
  const maxLoad = Math.max(data.phaseLoads.A, data.phaseLoads.B, data.phaseLoads.C, 1);

  return (
    <g>
      {/* 1. QUADRO DE CARGAS */}
      <SectionTitle
        x={x}
        y={y}
        w={totalW}
        title="QUADRO DE CARGAS E DIMENSIONAMENTO"
        subtitle={`${formatNumber(data.totalKva, 2)} kVA · ${formatNumber(data.generalCurrent, 1)}A`}
        colors={colors}
      />

      <rect x={x} y={headerY} width={totalW} height={rowH} fill={colors.soft} stroke={colors.faint} strokeWidth="0.7" />
      {headers.map((header, index) => {
        const cx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
        return (
          <TableCell
            key={header}
            x={cx}
            y={headerY}
            w={widths[index]}
            h={rowH}
            colors={colors}
            fill={colors.soft}
            weight={900}
            size={6.2}
          >
            {header}
          </TableCell>
        );
      })}

      {tableRows.map((row, rowIndex) => {
        const values = row.isReserve
          ? [row.id, row.description, "", "", "", "", "", "", "", "", "", "", "", ""]
          : [
              row.id,
              clipText(row.description, 32),
              Math.round(row.powerW),
              row.voltage,
              formatNumber(row.projectCurrent, 1),
              formatNumber(row.groupFactor, 2),
              formatNumber(row.correctedCurrent, 1),
              `${row.breaker}A`,
              `${formatNumber(row.voltageDropPct, 1)}%`,
              row.wireGauge,
              phasePower(row, "A"),
              phasePower(row, "B"),
              phasePower(row, "C"),
              row.dinModules,
            ];

        return (
          <g key={`${row.id}-${rowIndex}`}>
            {values.map((value, index) => {
              const cx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
              const isPhase = index >= 10 && index <= 12 && value !== "";
              const isDropAlert = index === 8 && !row.voltageDropOk;
              const fill = row.isReserve
                ? "#fbfcfe"
                : isDropAlert
                  ? "#fee2e2"
                  : isPhase
                    ? colors.yellow
                    : rowIndex % 2 === 0
                      ? "#ffffff"
                      : "#fbfdff";
              return (
                <TableCell
                  key={`${row.id}-${index}`}
                  x={cx}
                  y={bodyY + rowIndex * rowH}
                  w={widths[index]}
                  h={rowH}
                  colors={colors}
                  fill={fill}
                  align={index === 1 ? "left" : "center"}
                  weight={row.isReserve ? 500 : index === 0 || index === 7 ? 800 : 600}
                  size={index === 1 ? 6.1 : 6.3}
                  color={row.isReserve ? "#94a3b8" : isDropAlert ? colors.red : colors.ink}
                >
                  {value}
                </TableCell>
              );
            })}
          </g>
        );
      })}

      {/* 2. RESUMO EXECUTIVO & BALANCEAMENTO */}
      <SectionTitle x={x} y={demandY} w={totalW} title="RESUMO EXECUTIVO DO QUADRO" subtitle="demanda, proteção e fases" colors={colors} />
      {data.demandRows.map(([label, value], index) => {
        const cx = x + (index % 3) * (cardW + cardGap);
        const cy = demandY + 32 + Math.floor(index / 3) * 50;
        return (
          <g key={label}>
            <rect x={cx} y={cy} width={cardW} height="40" rx="4" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
            <Text x={cx + 8} y={cy + 13} size={6.5} weight={800} color={colors.muted}>
              {label.toUpperCase()}
            </Text>
            <Text x={cx + 8} y={cy + 29} size={8.8} weight={900} color={colors.ink}>
              {value}
            </Text>
          </g>
        );
      })}

      <rect x={x + 364} y={demandY + 32} width="341" height="90" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 378} y={demandY + 48} size={7.8} weight={900} color={colors.ink}>
        BALANCEAMENTO DE FASES
      </Text>
      {["A", "B", "C"].map((phase, index) => {
        const current = data.phaseLoads[phase] || 0;
        const width = Math.max(6, (current / maxLoad) * 200);
        const cy = demandY + 62 + index * 18;
        return (
          <g key={phase}>
            <Text x={x + 378} y={cy + 4} size={7} weight={900} color={phaseColor(colors, phase)}>
              F{phase}
            </Text>
            <rect x={x + 404} y={cy - 4} width="210" height="9" rx="4.5" fill={colors.soft} />
            <rect x={x + 404} y={cy - 4} width={width} height="9" rx="4.5" fill={phaseColor(colors, phase)} opacity="0.85" />
            <Text x={x + 636} y={cy + 4} size={7} weight={800} color={colors.ink}>
              {formatNumber(current, 1)}A
            </Text>
          </g>
        );
      })}
      <Text x={x + 378} y={demandY + 114} size={6.8} weight={800} color={data.imbalancePct > 10 ? colors.red : colors.green}>
        Desequilíbrio: {formatNumber(data.imbalancePct, 0)}%
      </Text>

      {/* 3. NOTAS TÉCNICAS E CARACTERÍSTICAS */}
      <rect x={x} y={notesY} width="380" height="120" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 12} y={notesY + 18} size={8.5} weight={900} color={colors.ink}>
        NOTAS TÉCNICAS
      </Text>
      {data.notes.map((note, index) => (
        <Text key={note} x={x + 14} y={notesY + 36 + index * 18} size={6.6} weight={600} color={colors.ink}>
          {index + 1}. {clipText(note, 88)}
        </Text>
      ))}

      <rect x={x + 394} y={notesY} width="311" height="120" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 406} y={notesY + 18} size={8.5} weight={900} color={colors.ink}>
        CARACTERÍSTICAS DO QD
      </Text>
      {data.characteristicRows.slice(0, 5).map(([label, value], index) => (
        <g key={label}>
          <rect x={x + 406} y={notesY + 28 + index * 16} width="90" height="14" fill={index % 2 ? "#ffffff" : colors.soft} />
          <rect x={x + 498} y={notesY + 28 + index * 16} width="197" height="14" fill={index % 2 ? "#ffffff" : colors.soft} />
          <Text x={x + 410} y={notesY + 38 + index * 16} size={6.2} weight={900} color={colors.muted}>
            {label.toUpperCase()}
          </Text>
          <Text x={x + 504} y={notesY + 38 + index * 16} size={6.2} weight={700} color={colors.ink}>
            {clipText(value, 36)}
          </Text>
        </g>
      ))}

      {/* 4. CARIMBO ABNT */}
      <TitleBlock data={data} sheet={sheet} x={x} y={titleY} w={totalW} h={86} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEDICATED DIAGRAM SHEET (FOLHAS DE DIAGRAMA PARA 13+ CIRCUITOS)
// ─────────────────────────────────────────────────────────────────────────────
function DedicatedDiagramSheet({ data, sheet }) {
  const { colors } = data;
  const x = 44;
  const y = 104;
  const w = 710;
  const h = 696;
  const center = x + w / 2;
  const isFirst = sheet.isFirstDiagramSheet;

  const busTop = isFirst ? y + 250 : y + 150;
  const branchRows = sheet.branchRows || [];
  const branchCount = Math.max(branchRows.length, 1);
  const branchGap = Math.min(38, Math.max(26, (h - (isFirst ? 300 : 200)) / Math.ceil(branchCount / 2)));
  const busBottom = busTop + 30 + Math.ceil(branchCount / 2) * branchGap;

  const phaseXs = data.system.phaseLabels.map((_, index) => (
    center + (index - (data.system.phaseLabels.length - 1) / 2) * 26
  ));
  const phaseCodesByIndex = data.system.phaseLabels.map((label) => {
    if (label === "R" || label === "F") return "A";
    if (label === "S") return "B";
    if (label === "T") return "C";
    return label;
  });

  const branchStart = busTop + 38;

  // Lado direito (x = 770, w = 373)
  const rightX = 770;
  const rightW = 373;

  return (
    <g>
      {/* ÁREA DO DIAGRAMA PRINCIPAL / CONTINUAÇÃO */}
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#ffffff" stroke={colors.ink} strokeWidth="0.8" />
      <SectionTitle
        x={x}
        y={y}
        w={w}
        title={sheet.title}
        subtitle={`${sheet.subtitle} · ${data.panelSize} DIN`}
        colors={colors}
      />

      {isFirst ? (
        <>
          <Text x={center} y={y + 54} size={14} weight={900} color={colors.ink} anchor="middle">
            {clipText(data.panelName.toUpperCase(), 40)}
          </Text>
          <Text x={center} y={y + 70} size={8.2} weight={700} color={colors.muted} anchor="middle">
            Alimentador Cu {data.feederGauge}mm² · Barramento de Cobre {data.system.busbar} · {data.system.label} {data.project?.voltage || 220}V
          </Text>

          <DeviceBlock
            x={center - 130}
            y={y + 86}
            w={260}
            title="DISJUNTOR GERAL"
            value={`${data.generalPoles || data.system.generalPoles}P ${data.generalBreaker}A`}
            color={colors.blue}
            sub={`Corrente de projeto ${formatNumber(data.generalCurrent, 1)}A`}
          />
          <line x1={center} y1={y + 120} x2={center} y2={y + 138} stroke={colors.ink} strokeWidth="1.3" />

          <DeviceBlock
            x={center - 130}
            y={y + 138}
            w={260}
            title="DPS CLASSE II"
            value={`${data.dpsCount || data.system.phaseCodes.length} polo(s)`}
            color={colors.red}
            sub={data.dpsDeviceCount ? `${data.dpsDeviceCount} dispositivo(s) no quadro` : "Proteção contra surtos transitórios"}
          />

          {data.drDeviceCount > 0 ? (
            <>
              <line x1={center} y1={y + 172} x2={center} y2={y + 190} stroke={colors.ink} strokeWidth="1.3" />
              <DeviceBlock
                x={center - 130}
                y={y + 190}
                w={260}
                title="IDR / DR GERAL"
                value={`${data.drDeviceCount} disp. · ${data.drCount} circ.`}
                color={colors.blueDark}
                sub="Sensibilidade 30mA para proteção contra choques"
              />
              <line x1={center} y1={y + 224} x2={center} y2={busTop} stroke={colors.ink} strokeWidth="1.3" />
            </>
          ) : (
            <line x1={center} y1={y + 172} x2={center} y2={busTop} stroke={colors.ink} strokeWidth="1.3" />
          )}

          <rect x={center - 120} y={busTop - 18} width="240" height="22" rx="4" fill={colors.soft} stroke={colors.faint} strokeWidth="0.8" />
          <Text x={center} y={busTop - 4} size={8} weight={900} color={colors.ink} anchor="middle">
            BARRAMENTOS DE DISTRIBUIÇÃO (R, S, T, N, PE)
          </Text>
        </>
      ) : (
        <>
          <rect x={center - 200} y={y + 40} width="400" height="28" rx="4" fill="#EEF7FC" stroke={colors.blue} strokeWidth="1" />
          <Text x={center} y={y + 58} size={9} weight={900} color={colors.blueDark} anchor="middle">
            ▲ CONTINUAÇÃO DO BARRAMENTO GERAL (FOLHA {String(sheet.sheetIndex - 1).padStart(2, "0")})
          </Text>
          <line x1={center} y1={y + 68} x2={center} y2={busTop} stroke={colors.ink} strokeWidth="1.3" />

          <rect x={center - 120} y={busTop - 18} width="240" height="22" rx="4" fill={colors.soft} stroke={colors.faint} strokeWidth="0.8" />
          <Text x={center} y={busTop - 4} size={8} weight={900} color={colors.ink} anchor="middle">
            BARRAMENTOS — CONTINUAÇÃO
          </Text>
        </>
      )}

      {/* LINHAS DOS BARRAMENTOS */}
      {data.system.phaseLabels.map((label, index) => {
        const phaseCode = phaseCodesByIndex[index];
        const color = phaseColor(colors, phaseCode);
        return (
          <g key={label}>
            <line x1={phaseXs[index]} y1={busTop + 8} x2={phaseXs[index]} y2={busBottom} stroke={color} strokeWidth={label === "PE" ? "2" : "1.4"} />
            <circle cx={phaseXs[index]} cy={busTop + 16} r="4.5" fill="#ffffff" stroke={color} strokeWidth="1.2" />
            <Text x={phaseXs[index]} y={busTop + 19} size={6.2} weight={900} color={color} anchor="middle">
              {label}
            </Text>
          </g>
        );
      })}

      {/* CIRCUITOS / DERIVAÇÕES */}
      {branchRows.map((row, index) => {
        const isCircuit = row.type === "circuit";
        const circuit = row.circuit;
        const rowIndex = Math.floor(index / 2);
        const side = index % 2 === 0 ? "left" : "right";
        const yy = branchStart + rowIndex * branchGap;

        const phaseSet = isCircuit ? [...new Set(circuit.phaseSet || ["A"])] : ["A"];
        const phaseConnections = phaseSet.map((phase, phaseIndex) => {
          const idx = phaseCodesByIndex.findIndex((item) => item === phase);
          return {
            phase,
            x: phaseXs[Math.max(0, idx)],
            offsetY: (phaseIndex - (phaseSet.length - 1) / 2) * 5.5,
          };
        });

        const outX = side === "left" ? x + 80 : x + w - 80;
        const labelX = side === "left" ? x + 16 : x + w - 16;
        const color = isCircuit ? phaseColor(colors, circuit.phaseSet?.[0]) : "#a5adb8";
        const title = isCircuit ? `${circuit.id} · ${clipText(circuit.description, 26)}` : row.label;
        const sub = isCircuit
          ? `${circuit.breaker}A/${circuit.breakerCurve || "B"} · ${circuit.wireGauge} · ΔU ${formatNumber(circuit.voltageDropPct, 1)}%`
          : "Reserva Técnica";

        const bundleHalfHeight = isCircuit ? ((phaseSet.length - 1) * 5.5) / 2 : 0;
        const labelY = yy - 6;
        const subY = yy + 7;
        const breakerPathFor = (lineY) => side === "left"
          ? `M ${outX} ${lineY} h -14 q -10 -10 -26 0 h -10`
          : `M ${outX} ${lineY} h 14 q 10 -10 26 0 h 10`;

        return (
          <g key={`${row.type}-${index}`}>
            {isCircuit && phaseSet.length > 1 && (
              <line
                x1={outX}
                y1={yy - bundleHalfHeight}
                x2={outX}
                y2={yy + bundleHalfHeight}
                stroke={color}
                strokeWidth="1.1"
              />
            )}
            {phaseConnections.map((connection, pIdx) => {
              const lineY = yy + (isCircuit ? connection.offsetY : 0);
              const lineColor = isCircuit ? phaseColor(colors, connection.phase) : "#cfd6df";
              const dotColor = isCircuit ? phaseColor(colors, connection.phase) : "#a5adb8";
              return (
                <g key={`phase-line-${pIdx}`}>
                  <line
                    x1={connection.x}
                    y1={lineY}
                    x2={outX}
                    y2={lineY}
                    stroke={lineColor}
                    strokeWidth={isCircuit ? "1.2" : "0.8"}
                    strokeDasharray={isCircuit ? undefined : "4 4"}
                  />
                  <circle cx={connection.x} cy={lineY} r="2.8" fill="#ffffff" stroke={dotColor} strokeWidth="1.1" />
                  <circle cx={outX} cy={lineY} r="2.8" fill="#ffffff" stroke={isCircuit ? dotColor : color} strokeWidth="1.1" />
                  {isCircuit && (
                    <path
                      d={breakerPathFor(lineY)}
                      fill="none"
                      stroke={colors.red}
                      strokeWidth="1.1"
                    />
                  )}
                </g>
              );
            })}

            <Text
              x={labelX}
              y={labelY}
              size={7.5}
              weight={isCircuit ? 800 : 700}
              color={isCircuit ? colors.ink : "#8b95a3"}
              anchor={side === "left" ? "start" : "end"}
            >
              {title}
            </Text>
            <Text
              x={labelX}
              y={subY}
              size={6.4}
              weight={700}
              color={isCircuit ? colors.muted : "#a5adb8"}
              anchor={side === "left" ? "start" : "end"}
            >
              {sub}
            </Text>
          </g>
        );
      })}

      {/* CONTINUAÇÃO / TERMINAÇÃO */}
      {sheet.nextStartCircuitId ? (
        <g>
          <rect x={center - 180} y={busBottom + 12} width="360" height="26" rx="4" fill="#EEF7FC" stroke={colors.blue} strokeWidth="1" />
          <Text x={center} y={busBottom + 29} size={8.5} weight={900} color={colors.blueDark} anchor="middle">
            ▼ CONTINUA NA FOLHA {String(sheet.sheetIndex + 1).padStart(2, "0")} (CIRCUITOS {sheet.nextStartCircuitId} EM DIANTE)
          </Text>
        </g>
      ) : (
        <line x1={phaseXs[0] - 10} y1={busBottom + 10} x2={phaseXs[phaseXs.length - 1] + 10} y2={busBottom + 10} stroke={colors.ink} strokeWidth="3" />
      )}

      {/* COLUNA LATERAL DIREITA */}
      {/* 1. CARACTERÍSTICAS TÉCNICAS */}
      <rect x={rightX} y={y} width={rightW} height="195" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={rightX + 14} y={y + 20} size={9} weight={900} color={colors.ink}>
        ESPECIFICAÇÕES DO QUADRO DE DISTRIBUIÇÃO
      </Text>
      {data.characteristicRows.map(([label, value], index) => (
        <g key={label}>
          <rect x={rightX + 14} y={y + 32 + index * 22} width="110" height="18" fill={index % 2 ? "#ffffff" : colors.soft} />
          <rect x={rightX + 126} y={y + 32 + index * 22} width={rightW - 140} height="18" fill={index % 2 ? "#ffffff" : colors.soft} />
          <Text x={rightX + 20} y={y + 44 + index * 22} size={6.6} weight={900} color={colors.muted}>
            {label.toUpperCase()}
          </Text>
          <Text x={rightX + 132} y={y + 44 + index * 22} size={6.6} weight={700} color={colors.ink}>
            {clipText(value, 36)}
          </Text>
        </g>
      ))}

      {/* 2. LEGENDA DE CONDUTORES */}
      <ConductorLegend x={rightX} y={y + 208} w={rightW} h={95} colors={colors} />

      {/* 3. NOTAS TÉCNICAS */}
      <rect x={rightX} y={y + 315} width={rightW} height="175" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={rightX + 14} y={y + 335} size={9} weight={900} color={colors.ink}>
        NOTAS DE PROJETO E NORMAS
      </Text>
      {data.notes.map((note, index) => (
        <Text key={note} x={rightX + 14} y={y + 356 + index * 25} size={6.8} weight={600} color={colors.ink}>
          {index + 1}. {clipText(note, 78)}
        </Text>
      ))}

      {/* 4. CARIMBO ABNT */}
      <TitleBlock data={data} sheet={sheet} x={rightX} y={y + 502} w={rightW} h={194} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. DEDICATED LOAD TABLE SHEET (QUADRO DE CARGAS & MEMÓRIA PARA 13+ CIRCUITOS)
// ─────────────────────────────────────────────────────────────────────────────
function DedicatedLoadTableSheet({ data, sheet }) {
  const { colors } = data;
  const x = 44;
  const y = 104;
  const totalW = 1100;
  const widths = [44, 220, 58, 48, 85, 48, 46, 56, 60, 54, 75, 52, 52, 52, 60, 40];
  const headers = [
    "Circ.", "Descrição da Carga", "Pot. (W)", "Tensão", "Tipo Carga", "In (A)",
    "F. Agr.", "Iaj (A)", "Disjuntor", "ΔU (%)", "Condutor", "Fase A", "Fase B", "Fase C", "DR/DPS", "DIN"
  ];
  const rowH = 18;
  const headerY = y + 26;
  const bodyY = headerY + rowH;
  const tableRows = sheet.tableRows || [];
  const tableHeight = 26 + rowH + tableRows.length * rowH;

  const hasSummary = sheet.hasSummary;
  const demandY = y + tableHeight + 14;
  const titleY = 720;

  const cardW = 168;
  const cardGap = 12;
  const maxLoad = Math.max(data.phaseLoads.A, data.phaseLoads.B, data.phaseLoads.C, 1);

  return (
    <g>
      <SectionTitle
        x={x}
        y={y}
        w={totalW}
        title={sheet.title}
        subtitle={`${sheet.subtitle} · ${formatNumber(data.totalKva, 2)} kVA · ${formatNumber(data.generalCurrent, 1)}A`}
        colors={colors}
      />

      <rect x={x} y={headerY} width={totalW} height={rowH} fill={colors.soft} stroke={colors.faint} strokeWidth="0.7" />
      {headers.map((header, index) => {
        const cx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
        return (
          <TableCell
            key={header}
            x={cx}
            y={headerY}
            w={widths[index]}
            h={rowH}
            colors={colors}
            fill={colors.soft}
            weight={900}
            size={6.6}
          >
            {header}
          </TableCell>
        );
      })}

      {tableRows.map((row, rowIndex) => {
        const values = row.isReserve
          ? [row.id, row.description, "", "", "Reserva técnica", "", "", "", "", "", "", "", "", "", "—", ""]
          : [
              row.id,
              clipText(row.description, 40),
              Math.round(row.powerW),
              `${row.voltage}V`,
              clipText(row.type, 18),
              formatNumber(row.projectCurrent, 1),
              formatNumber(row.groupFactor, 2),
              formatNumber(row.correctedCurrent, 1),
              `${row.breaker}A/${row.breakerCurve || "B"}`,
              `${formatNumber(row.voltageDropPct, 1)}%`,
              row.wireGauge,
              phasePower(row, "A"),
              phasePower(row, "B"),
              phasePower(row, "C"),
              row.needsDr ? "DR 30mA" : "—",
              row.dinModules,
            ];

        return (
          <g key={`${row.id}-${rowIndex}`}>
            {values.map((value, index) => {
              const cx = x + widths.slice(0, index).reduce((sum, item) => sum + item, 0);
              const isPhase = index >= 11 && index <= 13 && value !== "";
              const isDropAlert = index === 9 && !row.voltageDropOk;
              const fill = row.isReserve
                ? "#fbfcfe"
                : isDropAlert
                  ? "#fee2e2"
                  : isPhase
                    ? colors.yellow
                    : rowIndex % 2 === 0
                      ? "#ffffff"
                      : "#fbfdff";
              return (
                <TableCell
                  key={`${row.id}-${index}`}
                  x={cx}
                  y={bodyY + rowIndex * rowH}
                  w={widths[index]}
                  h={rowH}
                  colors={colors}
                  fill={fill}
                  align={index === 1 ? "left" : "center"}
                  weight={row.isReserve ? 500 : index === 0 || index === 8 ? 800 : 600}
                  size={index === 1 ? 6.5 : 6.6}
                  color={row.isReserve ? "#94a3b8" : isDropAlert ? colors.red : colors.ink}
                >
                  {value}
                </TableCell>
              );
            })}
          </g>
        );
      })}

      {/* RESUMO EXECUTIVO E BALANCEAMENTO DE FASES (SE ÚLTIMA FOLHA DE TABELA) */}
      {hasSummary && (
        <>
          <SectionTitle x={x} y={demandY} w={totalW} title="RESUMO EXECUTIVO E MEMÓRIA DE CÁLCULO" subtitle="demanda, alimentador e equilíbrio de fases" colors={colors} />

          {/* CARDS DE DEMANDA */}
          {data.demandRows.map(([label, value], index) => {
            const cx = x + (index % 3) * (cardW + cardGap);
            const cy = demandY + 32 + Math.floor(index / 3) * 44;
            return (
              <g key={label}>
                <rect x={cx} y={cy} width={cardW} height="38" rx="4" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
                <Text x={cx + 10} y={cy + 13} size={6.6} weight={800} color={colors.muted}>
                  {label.toUpperCase()}
                </Text>
                <Text x={cx + 10} y={cy + 28} size={9} weight={900} color={colors.ink}>
                  {value}
                </Text>
              </g>
            );
          })}

          {/* BALANCEAMENTO DE FASES */}
          <rect x={x + 550} y={demandY + 32} width="550" height="82" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
          <Text x={x + 566} y={demandY + 48} size={8} weight={900} color={colors.ink}>
            EQUILÍBRIO DE FASES (CORRENTES DE DEMANDA)
          </Text>
          {["A", "B", "C"].map((phase, index) => {
            const current = data.phaseLoads[phase] || 0;
            const width = Math.max(8, (current / maxLoad) * 360);
            const cy = demandY + 62 + index * 16;
            return (
              <g key={phase}>
                <Text x={x + 566} y={cy + 4} size={7.2} weight={900} color={phaseColor(colors, phase)}>
                  Fase {phase}
                </Text>
                <rect x={x + 616} y={cy - 4} width="370" height="8" rx="4" fill={colors.soft} />
                <rect x={x + 616} y={cy - 4} width={width} height="8" rx="4" fill={phaseColor(colors, phase)} opacity="0.85" />
                <Text x={x + 998} y={cy + 4} size={7.2} weight={800} color={colors.ink}>
                  {formatNumber(current, 1)}A
                </Text>
              </g>
            );
          })}
          <Text x={x + 566} y={demandY + 106} size={6.8} weight={800} color={data.imbalancePct > 10 ? colors.red : colors.green}>
            Desequilíbrio entre fases: {formatNumber(data.imbalancePct, 0)}% ({data.imbalancePct <= 10 ? "Conforme NBR 5410" : "Atenção: rebalancear"})
          </Text>
        </>
      )}

      {/* CARIMBO ABNT */}
      <TitleBlock data={data} sheet={sheet} x={x} y={titleY} w={totalW} h={86} />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL EXPORTADO
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfessionalBoardSheetSVG({ project, metrics, sheetIndex = 0 }) {
  const panelData = buildProfessionalPanelBoardSheets(project, metrics);
  const activeSheet = panelData.sheets[sheetIndex] || panelData.sheets[0];
  const { colors, sheet } = panelData;

  return (
    <svg
      width={sheet.width}
      height={sheet.height}
      viewBox={`0 0 ${sheet.width} ${sheet.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        background: "#ffffff",
        display: "block",
      }}
    >
      <rect width={sheet.width} height={sheet.height} fill="#ffffff" />
      <rect x="24" y="24" width="1141" height="793" fill="none" stroke={colors.ink} strokeWidth="0.95" />
      
      {/* CABEÇALHO SUPERIOR DA PRANCHA */}
      <Header data={panelData} sheet={activeSheet} />

      {/* CONTEÚDO DINÂMICO BASEADO NO TIPO DE FOLHA */}
      {activeSheet.sheetType === "combined" && (
        <>
          <CombinedPanelDiagram data={panelData} sheet={activeSheet} />
          <CombinedRightColumn data={panelData} sheet={activeSheet} />
        </>
      )}

      {(activeSheet.sheetType === "diagram" || activeSheet.sheetType === "diagram_continuation") && (
        <DedicatedDiagramSheet data={panelData} sheet={activeSheet} />
      )}

      {(activeSheet.sheetType === "load_table" || activeSheet.sheetType === "load_table_continuation") && (
        <DedicatedLoadTableSheet data={panelData} sheet={activeSheet} />
      )}

      <Text x="44" y="796" size={6.6} weight={700} color={colors.muted}>
        Documento gerado automaticamente conforme NBR 5410:2004 / IEC 60617. Revisar, validar e assinar por profissional habilitado antes da execução.
      </Text>
    </svg>
  );
}
