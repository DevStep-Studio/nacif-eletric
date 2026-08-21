const fs = require('fs');
const content = fs.readFileSync('src/pages/PanelGenerator.jsx', 'utf8');

// I will just use regex to replace from startComponentDrag to handleSvgPointerUp
const regex = /(const startComponentDrag = [\s\S]*?const handleSvgPointerMove = \(event\) => \{)[\s\S]*?(const handleSvgPointerUp = \(event\) => \{)/;

const newMove = `
    const point = getSvgCursorPoint(event);
    if (point) setHoverCoords({ x: Math.round(point.x), y: Math.round(point.y) });

    if (wireRoutePointDrag && point) {
      updateWireRoutePoint(wireRoutePointDrag.wireId, wireRoutePointDrag.index, point, { persist: false });
      return;
    }

    if (textDrag && point) {
      if (textDrag.infraId) {
        updateInfrastructure(textDrag.infraId, { x: point.x - textDrag.offsetX, y: point.y - textDrag.offsetY }, { persist: false });
      } else {
        updateWireLabelMeta(textDrag.wireId, { x: point.x - textDrag.offsetX, y: point.y - textDrag.offsetY }, { persist: false });
      }
      return;
    }

    if (wireEndpointDrag) {
      setHoveredPinId(findNearestConnectionPin(point)?.id || "");
      if (point) setEndpointDragCoords({ x: point.x, y: point.y });
      return;
    }

    if (componentDrag && point) {
      setComponentDrag((current) => {
        if (!current) return current;
        const active = current.active || Math.hypot(point.x - current.startX, point.y - current.startY) > 8;
        return { ...current, active, x: point.x, y: point.y };
      });
    }
  };

  `;

const match = content.match(regex);
if (match) {
  const newContent = content.replace(regex, match[1] + newMove + match[2]);
  fs.writeFileSync('src/pages/PanelGenerator.jsx', newContent);
  console.log("Fixed handleSvgPointerMove");
} else {
  console.log("Could not find regex match");
}
