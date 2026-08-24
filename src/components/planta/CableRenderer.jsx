import { useRef } from "react";
import { Circle, Group, Line, Arrow, Rect, Text } from "react-konva";
import {
  DEFAULT_CONDUIT_DIAMETER,
  cablePath,
  normalizeCableInstallationMode,
  normalizeConduitDiameter,
  normalizeRouteSystem,
} from "@/lib/manualCableEditor";

const pctToPx = (value, total) => (Number(value || 0) / 100) * total;

const cablePointToPx = (point, dimensions) => ({
  x: pctToPx(point.x, dimensions.width),
  y: pctToPx(point.y, dimensions.height),
});

const compactPoints = (points = []) => {
  const compacted = [];
  points.forEach((point) => {
    const previous = compacted[compacted.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 0.75) return;
    compacted.push(point);
  });
  return compacted;
};

const orthogonalPoints = (points = []) => {
  if (points.length < 2) return points;
  const routed = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    const start = routed[routed.length - 1];
    const end = points[index];
    if (Math.abs(start.x - end.x) < 1 || Math.abs(start.y - end.y) < 1) {
      routed.push(end);
      continue;
    }
    routed.push({ x: end.x, y: start.y }, end);
  }
  return compactPoints(routed);
};

const renderableCablePoints = (cable, dimensions, rawPath = cablePath(cable)) => {
  const rawPoints = rawPath.map((point) => cablePointToPx(point, dimensions));
  if (cable.routingMode === "orthogonal") return orthogonalPoints(rawPoints);
  return rawPoints;
};

export default function CableRenderer({
  cables = [],
  selectedElement,
  dimensions,
  onCableClick,
  onCableDoubleClick,
  onCableDragStart,
  onCableDrag,
  onCableDragEnd,
  onCableLabelDragEnd,
}) {
  const activeDragRef = useRef("");
  const selectedCableId = selectedElement?.type === "route" ? String(selectedElement.id) : "";
  const visibleCables = [...cables]
    .filter((cable) => cable.visible !== false)
    .sort((a, b) => (Number(a.zIndex) || 0) - (Number(b.zIndex) || 0));

  return (
    <Group name="manual-cable-renderer">
      {visibleCables.map((cable) => {
        const rawPath = cablePath(cable);
        const points = renderableCablePoints(cable, dimensions, rawPath);
        if (points.length < 2) return null;
        const flatPoints = points.flatMap((point) => [point.x, point.y]);
        const endpointPoints = [
          rawPath[0],
          rawPath[rawPath.length - 1],
        ]
          .filter(Boolean)
          .map((point) => cablePointToPx(point, dimensions));
        const selected = selectedCableId && String(cable.id) === selectedCableId;
        const systemType = normalizeRouteSystem(cable.systemType || cable.system_type || cable.system || cable.type);
        const stroke = systemType === "telecom"
          ? (cable.color || "#2563eb")
          : (cable.color || "#000000");
        const strokeWidth = Math.max(0.8, Number(cable.thickness) || 1.4);
        const labelFontSize = Math.max(6, Math.min(14, Number(cable.labelFontSize) || 7));
        const labelHeight = Math.max(11, labelFontSize + 4);
        const labelPaddingX = 3;
        const labelColor = cable.labelColor || stroke;
        const renderConduitLabel = ({ x, y, rotation = 0, text }) => {
          const textWidth = Math.max(24, String(text).length * labelFontSize * 0.64 + labelPaddingX * 2);
          const baseX = x;
          const baseY = y;
          const labelDx = Number(cable.labelDx) || 0;
          const labelDy = Number(cable.labelDy) || 0;
          return (
            <Group
              x={baseX + labelDx}
              y={baseY + labelDy}
              rotation={rotation}
              draggable={Boolean(selected && !cable.locked)}
              onMouseDown={(event) => {
                event.cancelBubble = true;
              }}
              onTouchStart={(event) => {
                event.cancelBubble = true;
              }}
              onClick={(event) => {
                event.cancelBubble = true;
                onCableClick?.(cable.id, cable);
              }}
              onTap={(event) => {
                event.cancelBubble = true;
                onCableClick?.(cable.id, cable);
              }}
              onDblClick={(event) => {
                event.cancelBubble = true;
                onCableDoubleClick?.(cable.id, cable);
              }}
              onDblTap={(event) => {
                event.cancelBubble = true;
                onCableDoubleClick?.(cable.id, cable);
              }}
              onDragStart={(event) => {
                event.cancelBubble = true;
                onCableClick?.(cable.id, cable);
              }}
              onDragMove={(event) => {
                event.cancelBubble = true;
              }}
              onDragEnd={(event) => {
                event.cancelBubble = true;
                onCableLabelDragEnd?.(cable.id, {
                  labelDx: event.target.x() - baseX,
                  labelDy: event.target.y() - baseY,
                });
              }}
            >
              <Rect
                x={-textWidth / 2}
                y={-labelHeight / 2}
                width={textWidth}
                height={labelHeight}
                fill="#ffffff"
                stroke={labelColor}
                strokeWidth={0.55}
                cornerRadius={2}
                opacity={0.94}
              />
              <Text
                text={text}
                fontSize={labelFontSize}
                fontFamily="Arial"
                fontStyle="bold"
                fill={labelColor}
                align="center"
                verticalAlign="middle"
                x={-textWidth / 2}
                y={-labelHeight / 2 + (labelHeight - labelFontSize) / 2 - 0.5}
                width={textWidth}
                height={labelHeight}
                padding={0}
              />
            </Group>
          );
        };
        
        const installationMode = normalizeCableInstallationMode(cable.mode);
        const getDashPattern = (mode) => {
          if (mode === "piso") return [8, 6];
          if (mode === "externa") return [12, 6, 2, 6];
          return undefined;
        };
        
        const dashPattern = getDashPattern(installationMode);
        const isSobe = installationMode === "sobe";
        const isDesce = installationMode === "desce";

        const handleClick = (event) => {
          event.cancelBubble = true;
          onCableClick?.(cable.id, cable);
        };
        const handleDoubleClick = (event) => {
          event.cancelBubble = true;
          onCableDoubleClick?.(cable.id, cable);
        };

        return (
          <Group
            key={cable.id}
            name="manual-cable"
            draggable={Boolean(selected && !cable.locked)}
            onDragStart={(event) => {
              activeDragRef.current = String(cable.id);
              event.target.position({ x: 0, y: 0 });
              onCableDragStart?.(cable.id);
            }}
            onDragMove={(event) => {
              const dx = (event.target.x() / dimensions.width) * 100;
              const dy = (event.target.y() / dimensions.height) * 100;
              event.target.position({ x: 0, y: 0 });
              onCableDrag?.(cable.id, dx, dy, { commit: false });
            }}
            onDragEnd={(event) => {
              const dx = (event.target.x() / dimensions.width) * 100;
              const dy = (event.target.y() / dimensions.height) * 100;
              event.target.position({ x: 0, y: 0 });
              if (dx || dy) onCableDrag?.(cable.id, dx, dy, { commit: false });
              onCableDragEnd?.(cable.id);
              if (activeDragRef.current === String(cable.id)) activeDragRef.current = "";
            }}
          >
            <Line
              name="manual-cable-hit"
              points={flatPoints}
              stroke="#ffffff"
              strokeWidth={Math.max(18, strokeWidth + 14)}
              opacity={0.01}
              tension={cable.routingMode === "curved" ? 0.38 : 0}
              lineCap="round"
              lineJoin="round"
              onClick={handleClick}
              onTap={handleClick}
              onDblClick={handleDoubleClick}
              onDblTap={handleDoubleClick}
            />
            {selected && (
              <Line
                points={flatPoints}
                stroke="#00d8b8"
                strokeWidth={strokeWidth + 5}
                opacity={0.13}
                tension={cable.routingMode === "curved" ? 0.38 : 0}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
            <Line
              name="manual-cable-line"
              points={flatPoints}
              stroke={stroke}
              strokeWidth={selected ? strokeWidth + 0.45 : strokeWidth}
              opacity={selected ? 1 : 0.9}
              tension={cable.routingMode === "curved" ? 0.38 : 0}
              lineCap="round"
              lineJoin="round"
              dash={dashPattern}
              onClick={handleClick}
              onTap={handleClick}
              onDblClick={handleDoubleClick}
              onDblTap={handleDoubleClick}
            />

            {(() => {
              const displayGauge = normalizeConduitDiameter(
                cable.conduit_diameter || cable.conduitDiameter || cable.gauge,
                DEFAULT_CONDUIT_DIAMETER,
              );
              if (!displayGauge || displayGauge === "nenhuma") return null;
              let longest = { length: 0, p1: null, p2: null };
              for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                if (dist > longest.length) longest = { length: dist, p1, p2 };
              }
              if (!longest.p1 || longest.length < 10) {
                const pt = points[0] || endpointPoints[0];
                if (!pt) return null;
                return renderConduitLabel({ x: pt.x + 28, y: pt.y, text: displayGauge });
              }
              const { p1, p2 } = longest;
              const cx = (p1.x + p2.x) / 2;
              const cy = (p1.y + p2.y) / 2;
              let angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
              if (angle > 90 || angle <= -90) angle += 180;
              const angleRad = angle * (Math.PI / 180);
              const labelOffset = Number.isFinite(Number(cable.labelOffset)) ? Number(cable.labelOffset) : -10;
              return renderConduitLabel({
                x: cx - Math.sin(angleRad) * labelOffset,
                y: cy + Math.cos(angleRad) * labelOffset,
                rotation: angle,
                text: displayGauge,
              });
            })()}
            {endpointPoints.map((point, index) => {
              const r = Math.max(2.8, strokeWidth + 1.1);
              const isTarget = index === endpointPoints.length - 1;
              
              if (isTarget && isSobe) {
                const rSobe = Math.max(10, strokeWidth + 8);
                return (
                  <Group
                    key={`${cable.id}-endpoint-${index}`}
                    x={point.x}
                    y={point.y}
                    onClick={handleClick}
                    onTap={handleClick}
                    onDblClick={handleDoubleClick}
                    onDblTap={handleDoubleClick}
                  >
                    <Circle radius={rSobe} fill="#ffffff" stroke={stroke} strokeWidth={1.8} opacity={selected ? 1 : 0.95} />
                    <Circle radius={2.5} fill={stroke} />
                    <Arrow points={[rSobe * 0.6, -rSobe * 0.6, rSobe * 0.6 + 12, -rSobe * 0.6 - 12]} pointerLength={6} pointerWidth={6} fill={stroke} stroke={stroke} strokeWidth={1.8} opacity={selected ? 1 : 0.95} />
                  </Group>
                );
              }
              
              if (isTarget && isDesce) {
                const rDesce = Math.max(10, strokeWidth + 8);
                return (
                  <Group
                    key={`${cable.id}-endpoint-${index}`}
                    x={point.x}
                    y={point.y}
                    onClick={handleClick}
                    onTap={handleClick}
                    onDblClick={handleDoubleClick}
                    onDblTap={handleDoubleClick}
                  >
                    <Circle radius={rDesce} fill="#ffffff" stroke={stroke} strokeWidth={1.8} opacity={selected ? 1 : 0.95} />
                    <Line points={[-rDesce*0.65, -rDesce*0.65, rDesce*0.65, rDesce*0.65]} stroke={stroke} strokeWidth={1.6} opacity={selected ? 1 : 0.95} />
                    <Line points={[rDesce*0.65, -rDesce*0.65, -rDesce*0.65, rDesce*0.65]} stroke={stroke} strokeWidth={1.6} opacity={selected ? 1 : 0.95} />
                    <Arrow points={[rDesce * 0.6, rDesce * 0.6, rDesce * 0.6 + 12, rDesce * 0.6 + 12]} pointerLength={6} pointerWidth={6} fill={stroke} stroke={stroke} strokeWidth={1.8} opacity={selected ? 1 : 0.95} />
                  </Group>
                );
              }

              return (
                <Circle
                  key={`${cable.id}-endpoint-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={r}
                  fill="#ffffff"
                  stroke={stroke}
                  strokeWidth={1.2}
                  opacity={selected ? 1 : 0.9}
                  listening={false}
                />
              );
            })}
          </Group>
        );
      })}
    </Group>
  );
}
