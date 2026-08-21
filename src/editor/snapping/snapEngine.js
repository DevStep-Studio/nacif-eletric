const sameId = (a, b) => String(a) === String(b);

export const DEFAULT_SNAP_SETTINGS = {
  grid: true,
  vertices: true,
  endpoints: true,
  midpoints: true,
  centers: true,
  intersections: false,
  walls: true,
  objects: true,
  angular: true,
  smartGuides: true,
  tolerancePx: 8,
  angularSteps: [0, 15, 30, 45, 60, 90],
};

export const normalizeSnapSettings = (settings = {}) => ({
  ...DEFAULT_SNAP_SETTINGS,
  ...settings,
  tolerancePx: Math.max(2, Math.min(32, Number(settings.tolerancePx) || DEFAULT_SNAP_SETTINGS.tolerancePx)),
  angularSteps: Array.isArray(settings.angularSteps) && settings.angularSteps.length > 0
    ? settings.angularSteps.map(Number).filter(Number.isFinite)
    : DEFAULT_SNAP_SETTINGS.angularSteps,
});

export const snapToleranceToDocument = (tolerancePx = DEFAULT_SNAP_SETTINGS.tolerancePx, viewportScale = 1) => (
  Math.max(0.1, (Number(tolerancePx) || DEFAULT_SNAP_SETTINGS.tolerancePx) / Math.max(0.05, Number(viewportScale) || 1))
);

const nearestReference = (references = [], value, tolerance, exclude = {}) => references
  .filter((reference) => !(reference.type === exclude.type && sameId(reference.id, exclude.id)))
  .map((reference) => ({ ...reference, distance: Math.abs(Number(reference.value) - Number(value)) }))
  .filter((reference) => reference.distance <= tolerance)
  .sort((a, b) => a.distance - b.distance)[0] || null;

export const snapPointToReferences = ({
  point = { x: 0, y: 0 },
  references = { x: [], y: [] },
  viewportScale = 1,
  tolerancePx = DEFAULT_SNAP_SETTINGS.tolerancePx,
  exclude = {},
} = {}) => {
  const tolerance = snapToleranceToDocument(tolerancePx, viewportScale);
  const nearestX = nearestReference(references.x, point?.x, tolerance, exclude);
  const nearestY = nearestReference(references.y, point?.y, tolerance, exclude);
  const snapped = {
    x: nearestX ? nearestX.value : point.x,
    y: nearestY ? nearestY.value : point.y,
  };
  return {
    point: snapped,
    guides: {
      ...snapped,
      snappedX: Boolean(nearestX),
      snappedY: Boolean(nearestY),
      xTarget: nearestX,
      yTarget: nearestY,
    },
  };
};

export const snapPointToGrid = (point, gridSize = 10, enabled = true) => {
  if (!enabled || !gridSize) return point;
  return {
    x: Math.round((Number(point.x) || 0) / gridSize) * gridSize,
    y: Math.round((Number(point.y) || 0) / gridSize) * gridSize,
  };
};

export const applyAngularSnap = (start, end, steps = DEFAULT_SNAP_SETTINGS.angularSteps) => {
  const dx = (Number(end.x) || 0) - (Number(start.x) || 0);
  const dy = (Number(end.y) || 0) - (Number(start.y) || 0);
  const length = Math.hypot(dx, dy);
  if (!length) return end;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const candidates = steps.flatMap((step) => {
    const normalizedStep = Math.max(1, Math.abs(Number(step) || 0));
    const snapped = Math.round(angle / normalizedStep) * normalizedStep;
    return [snapped, snapped + 180, snapped - 180];
  });
  const snappedAngle = candidates
    .map((candidate) => ({ angle: candidate, distance: Math.abs(candidate - angle) }))
    .sort((a, b) => a.distance - b.distance)[0]?.angle ?? angle;
  const radians = snappedAngle * Math.PI / 180;
  return {
    x: start.x + Math.cos(radians) * length,
    y: start.y + Math.sin(radians) * length,
  };
};
