import {
  buildProfessionalPanelBoard,
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
  const textX = align === "left" ? x + 4 : align === "right" ? x + w - 4 : x + w / 2;
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

function Header({ data }) {
  const { colors } = data;
  return (
    <g>
      <rect x="24" y="24" width="1141" height="58" fill="#ffffff" stroke={colors.ink} strokeWidth="0.8" />
      <rect x="24" y="24" width="12" height="58" fill={colors.blue} />
      <Text x="48" y="47" size={17} weight={900} color={colors.ink}>
        {data.title}
      </Text>
      <Text x="48" y="66" size={8.5} weight={700} color={colors.muted}>
        NBR 5410 · Diagrama unifilar · Quadro de cargas · Balanceamento e memória de cálculo
      </Text>
      <Text x="848" y="44" size={10} weight={900} color={colors.blue} anchor="end">
        {clipText(data.panelName.toUpperCase(), 38)}
      </Text>
      <Text x="848" y="64" size={7.8} weight={700} color={colors.muted} anchor="end">
        {data.system.label} · {data.project?.voltage || 220}V · {data.circuits.length} circuito(s)
      </Text>
      <rect x="882" y="36" width="90" height="30" rx="4" fill={colors.blueDark} />
      <Text x="927" y="56" size={12} weight={900} color="#ffffff" anchor="middle">
        VOLT AI
      </Text>
      <Text x="1148" y="44" size={8} weight={900} color={colors.ink} anchor="end">
        {data.drawingCode}
      </Text>
      <Text x="1148" y="64" size={7.4} weight={700} color={colors.muted} anchor="end">
        {data.revision} · {data.date}
      </Text>
    </g>
  );
}

function PanelDiagram({ data }) {
  const { colors } = data;
  const x = 44;
  const y = 104;
  const w = 370;
  const h = 596;
  const center = x + w / 2;
  const busTop = y + 278;
  const busBottom = y + h - 44;
  const phaseXs = data.system.phaseLabels.map((_, index) => (
    center + (index - (data.system.phaseLabels.length - 1) / 2) * 22
  ));
  const phaseCodesByIndex = data.system.phaseLabels.map((label, index) => {
    if (label === "R" || label === "F") return "A";
    if (label === "S") return "B";
    if (label === "T") return "C";
    return label;
  });
  const branchStart = busTop + 52;
  const branchGap = Math.min(28, Math.max(18, (busBottom - branchStart - 14) / Math.max(data.branchRows.length - 1, 1)));

  const busXForCircuit = (circuit) => {
    const phase = circuit.phaseSet?.[0] || "A";
    const index = phaseCodesByIndex.findIndex((item) => item === phase);
    return phaseXs[Math.max(0, index)];
  };

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

      <Text x={center} y={y + 58} size={13} weight={900} color={colors.ink} anchor="middle">
        {clipText(data.panelName.toUpperCase(), 34)}
      </Text>
      <Text x={center} y={y + 76} size={7.8} weight={700} color={colors.muted} anchor="middle">
        Alimentador Cu {data.feederGauge}mm² · Barramento {data.system.busbar}
      </Text>

      <DeviceBlock
        x={x + 64}
        y={y + 96}
        w={242}
        title="DISJUNTOR GERAL"
        value={`${data.generalPoles || data.system.generalPoles}P ${data.generalBreaker}A`}
        color={colors.blue}
        sub={`Corrente de projeto ${formatNumber(data.generalCurrent, 1)}A`}
      />
      <line x1={center} y1={y + 130} x2={center} y2={y + 152} stroke={colors.ink} strokeWidth="1.3" />

      <DeviceBlock
        x={x + 64}
        y={y + 152}
        w={242}
        title="DPS CLASSE II"
        value={`${data.dpsCount || data.system.phaseCodes.length} polo(s)`}
        color={colors.red}
        sub={data.dpsDeviceCount ? `${data.dpsDeviceCount} dispositivo(s) no quadro` : "Proteção contra surtos no QD"}
      />
      <line x1={center} y1={y + 186} x2={center} y2={y + 208} stroke={colors.ink} strokeWidth="1.3" />

      <DeviceBlock
        x={x + 64}
        y={y + 208}
        w={242}
        title="IDR / DR"
        value={data.drDeviceCount ? `${data.drDeviceCount} disp. · ${data.drCount} circ.` : data.drCount ? `${data.drCount} circuito(s)` : "prever"}
        color={colors.blueDark}
        sub="30mA para áreas molhadas e tomadas aplicáveis"
      />
      <line x1={center} y1={y + 242} x2={center} y2={busTop} stroke={colors.ink} strokeWidth="1.3" />

      <rect x={x + 54} y={busTop - 18} width={w - 108} height="24" rx="4" fill={colors.soft} stroke={colors.faint} strokeWidth="0.8" />
      <Text x={center} y={busTop - 2} size={8} weight={900} color={colors.ink} anchor="middle">
        BARRAMENTOS DE DISTRIBUIÇÃO
      </Text>

      {data.system.phaseLabels.map((label, index) => {
        const phaseCode = phaseCodesByIndex[index];
        const color = phaseColor(colors, phaseCode);
        return (
          <g key={label}>
            <line x1={phaseXs[index]} y1={busTop + 8} x2={phaseXs[index]} y2={busBottom} stroke={color} strokeWidth={label === "PE" ? "1.7" : "1.2"} />
            <circle cx={phaseXs[index]} cy={busTop + 18} r="4" fill="#ffffff" stroke={color} strokeWidth="1" />
            <Text x={phaseXs[index]} y={busTop + 20.5} size={5.6} weight={900} color={color} anchor="middle">
              {label}
            </Text>
          </g>
        );
      })}

      {data.branchRows.map((row, index) => {
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
          ? `${circuit.id} · ${clipText(circuit.description, 25)} · ${circuit.breaker}A`
          : row.label;
        const bundleHalfHeight = isCircuit ? ((phaseSet.length - 1) * 5.2) / 2 : 0;
        const labelY = isCircuit ? yy - bundleHalfHeight - 8.5 : yy - 5.5;
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
                  <circle
                    cx={connection.x}
                    cy={lineY}
                    r="2.6"
                    fill="#ffffff"
                    stroke={dotColor}
                    strokeWidth="1"
                  />
                  <circle
                    cx={outX}
                    cy={lineY}
                    r="2.6"
                    fill="#ffffff"
                    stroke={isCircuit ? dotColor : color}
                    strokeWidth="1"
                  />
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

            {isCircuit && (
              <>
                <Text
                  x={labelX}
                  y={labelY}
                  size={6.2}
                  weight={800}
                  color={colors.blue}
                  anchor={side === "left" ? "start" : "end"}
                >
                  {label}
                </Text>
              </>
            )}
            {!isCircuit && (
              <Text
                x={labelX}
                y={labelY}
                size={5.8}
                weight={700}
                color="#8b95a3"
                anchor={side === "left" ? "start" : "end"}
              >
                {label}
              </Text>
            )}
          </g>
        );
      })}

      {data.hiddenBranches > 0 && (
        <Text x={center} y={busBottom + 24} size={7.2} weight={800} color={colors.red} anchor="middle">
          +{data.hiddenBranches} circuito(s) detalhados apenas no quadro de cargas
        </Text>
      )}

      <Text x={center} y={y + h - 14} size={8.5} weight={800} color={colors.ink} anchor="middle">
        MEMÓRIA DE CÁLCULO - {clipText(data.projectName.toUpperCase(), 34)}
      </Text>
    </g>
  );
}

function LoadTable({ data }) {
  const { colors } = data;
  const x = 438;
  const y = 104;
  const widths = [38, 158, 46, 36, 42, 34, 44, 52, 42, 56, 40, 40, 40, 37];
  const headers = ["Circ.", "Descrição", "Pva", "V", "In", "Fc", "Iaj", "DJ", "ΔU", "Cond.", "FA", "FB", "FC", "DIN"];
  const rowH = 14;
  const headerY = y + 26;
  const bodyY = headerY + rowH;
  const totalW = widths.reduce((sum, item) => sum + item, 0);

  return (
    <g>
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

      {data.tableRows.map((row, rowIndex) => {
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

      {data.hiddenCircuits > 0 && (
        <Text x={x + totalW} y={bodyY + data.tableRows.length * rowH + 13} size={7} weight={800} color={colors.red} anchor="end">
          +{data.hiddenCircuits} circuito(s) não exibidos nesta prancha
        </Text>
      )}
    </g>
  );
}

function DemandSummary({ data }) {
  const { colors } = data;
  const x = 438;
  const y = 406;
  const cardW = 108;
  const cardGap = 10;
  const maxLoad = Math.max(data.phaseLoads.A, data.phaseLoads.B, data.phaseLoads.C, 1);

  return (
    <g>
      <SectionTitle x={x} y={y} w="705" title="RESUMO EXECUTIVO DO QUADRO" subtitle="demanda, proteção e fases" colors={colors} />
      {data.demandRows.map(([label, value], index) => {
        const cx = x + (index % 3) * (cardW + cardGap);
        const cy = y + 36 + Math.floor(index / 3) * 54;
        return (
          <g key={label}>
            <rect x={cx} y={cy} width={cardW} height="42" rx="4" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
            <Text x={cx + 8} y={cy + 14} size={6.8} weight={800} color={colors.muted}>
              {label.toUpperCase()}
            </Text>
            <Text x={cx + 8} y={cy + 31} size={9.2} weight={900} color={colors.ink}>
              {value}
            </Text>
          </g>
        );
      })}

      <rect x={x + 374} y={y + 36} width="331" height="96" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 388} y={y + 54} size={8} weight={900} color={colors.ink}>
        BALANCEAMENTO DE FASES
      </Text>
      {["A", "B", "C"].map((phase, index) => {
        const current = data.phaseLoads[phase] || 0;
        const width = Math.max(6, (current / maxLoad) * 198);
        const cy = y + 68 + index * 20;
        return (
          <g key={phase}>
            <Text x={x + 388} y={cy + 5} size={7.2} weight={900} color={phaseColor(colors, phase)}>
              F{phase}
            </Text>
            <rect x={x + 416} y={cy - 4} width="205" height="10" rx="5" fill={colors.soft} />
            <rect x={x + 416} y={cy - 4} width={width} height="10" rx="5" fill={phaseColor(colors, phase)} opacity="0.85" />
            <Text x={x + 636} y={cy + 5} size={7.2} weight={800} color={colors.ink}>
              {formatNumber(current, 1)}A
            </Text>
          </g>
        );
      })}
      <Text x={x + 388} y={y + 124} size={7} weight={800} color={data.imbalancePct > 10 ? colors.red : colors.green}>
        Desequilíbrio: {formatNumber(data.imbalancePct, 0)}%
      </Text>
    </g>
  );
}

function NotesAndCharacteristics({ data }) {
  const { colors } = data;
  const x = 438;
  const y = 558;
  const leftW = 392;
  const rightX = x + leftW + 14;
  const rightW = 299;

  return (
    <g>
      <rect x={x} y={y} width={leftW} height="142" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={x + 12} y={y + 20} size={9} weight={900} color={colors.ink}>
        NOTAS TÉCNICAS
      </Text>
      {data.notes.map((note, index) => (
        <Text key={note} x={x + 14} y={y + 40 + index * 20} size={6.9} weight={600} color={colors.ink}>
          {index + 1}. {clipText(note, 92)}
        </Text>
      ))}
      {data.warnings.length > 0 && (
        <>
          <Text x={x + 14} y={y + 124} size={7} weight={900} color={colors.red}>
            PENDÊNCIAS:
          </Text>
          <Text x={x + 76} y={y + 124} size={6.8} weight={700} color={colors.red}>
            {clipText(data.warnings[0], 82)}
          </Text>
        </>
      )}

      <rect x={rightX} y={y} width={rightW} height="142" rx="5" fill="#ffffff" stroke={colors.faint} strokeWidth="0.8" />
      <Text x={rightX + 12} y={y + 20} size={9} weight={900} color={colors.ink}>
        CARACTERÍSTICAS DO QD
      </Text>
      {data.characteristicRows.map(([label, value], index) => (
        <g key={label}>
          <rect x={rightX + 12} y={y + 31 + index * 15} width="94" height="13" fill={index % 2 ? "#ffffff" : colors.soft} />
          <rect x={rightX + 106} y={y + 31 + index * 15} width={rightW - 118} height="13" fill={index % 2 ? "#ffffff" : colors.soft} />
          <Text x={rightX + 17} y={y + 40 + index * 15} size={6.4} weight={900} color={colors.muted}>
            {label.toUpperCase()}
          </Text>
          <Text x={rightX + 112} y={y + 40 + index * 15} size={6.4} weight={700} color={colors.ink}>
            {clipText(value, 42)}
          </Text>
        </g>
      ))}
    </g>
  );
}

function TitleBlock({ data }) {
  const { colors } = data;
  const x = 438;
  const y = 720;
  const w = 705;
  const h = 86;
  const metaW = 170;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#ffffff" stroke={colors.ink} strokeWidth="0.8" />
      <rect x={x} y={y} width={w - metaW} height="24" fill={colors.soft} stroke={colors.faint} strokeWidth="0.6" />
      <Text x={x + 12} y={y + 16} size={8} weight={900} color={colors.ink}>
        {clipText(data.title, 56)}
      </Text>
      <rect x={x + w - metaW} y={y} width={metaW} height={h} fill="#ffffff" stroke={colors.ink} strokeWidth="0.6" />
      <line x1={x + w - metaW} y1={y + 28} x2={x + w} y2={y + 28} stroke={colors.faint} strokeWidth="0.6" />
      <line x1={x + w - metaW} y1={y + 56} x2={x + w} y2={y + 56} stroke={colors.faint} strokeWidth="0.6" />
      <Text x={x + w - metaW + 10} y={y + 13} size={6.5} weight={900} color={colors.muted}>
        PRANCHA
      </Text>
      <Text x={x + w - 12} y={y + 19} size={13} weight={900} color={colors.ink} anchor="end">
        {data.drawingCode}
      </Text>
      <Text x={x + w - metaW + 10} y={y + 42} size={6.5} weight={900} color={colors.muted}>
        REVISÃO
      </Text>
      <Text x={x + w - 12} y={y + 47} size={10} weight={900} color={colors.ink} anchor="end">
        {data.revision}
      </Text>
      <Text x={x + w - metaW + 10} y={y + 70} size={6.5} weight={900} color={colors.muted}>
        DATA
      </Text>
      <Text x={x + w - 12} y={y + 75} size={9} weight={900} color={colors.ink} anchor="end">
        {data.date}
      </Text>

      {data.titleRows.map(([label, value], index) => {
        const rowY = y + 28 + index * 11;
        return (
          <g key={label}>
            <Text x={x + 12} y={rowY} size={5.9} weight={900} color={colors.muted}>
              {label}
            </Text>
            <Text x={x + 98} y={rowY} size={6.4} weight={700} color={colors.ink}>
              {clipText(value, 68)}
            </Text>
          </g>
        );
      })}
    </g>
  );
}

export default function ProfessionalBoardSheetSVG({ project, metrics }) {
  const data = buildProfessionalPanelBoard(project, metrics);
  const { colors } = data;

  return (
    <svg
      width={data.sheet.width}
      height={data.sheet.height}
      viewBox={`0 0 ${data.sheet.width} ${data.sheet.height}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        fontFamily: "Inter, Arial, Helvetica, sans-serif",
        background: "#ffffff",
        display: "block",
      }}
    >
      <rect width={data.sheet.width} height={data.sheet.height} fill="#ffffff" />
      <rect x="24" y="24" width="1141" height="793" fill="none" stroke={colors.ink} strokeWidth="0.95" />
      <Header data={data} />
      <PanelDiagram data={data} />
      <LoadTable data={data} />
      <DemandSummary data={data} />
      <NotesAndCharacteristics data={data} />
      <TitleBlock data={data} />
      <Text x="44" y="790" size={6.6} weight={700} color={colors.muted}>
        Documento gerado automaticamente. Revisar, validar e assinar por profissional habilitado antes da emissão.
      </Text>
    </svg>
  );
}
