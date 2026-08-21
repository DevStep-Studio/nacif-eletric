export const MIN_VIEWPORT_ZOOM = 0.35;
export const MAX_VIEWPORT_ZOOM = 3.6;

export const clampZoom = (zoom, min = MIN_VIEWPORT_ZOOM, max = MAX_VIEWPORT_ZOOM) => (
  Math.max(min, Math.min(max, Number(zoom) || 1))
);

export const screenToDesignPoint = ({ screen, viewport, scale, contentOffset = { x: 0, y: 0 } }) => ({
  x: ((Number(screen.x) || 0) - (Number(viewport.x) || 0)) / Math.max(0.05, Number(scale) || 1) - (Number(contentOffset.x) || 0),
  y: ((Number(screen.y) || 0) - (Number(viewport.y) || 0)) / Math.max(0.05, Number(scale) || 1) - (Number(contentOffset.y) || 0),
});

export const zoomAtPoint = ({
  pointer,
  zoom,
  zoomFactor,
  baseScale,
  stageWidth,
  stageHeight,
  designWidth,
  designHeight,
  viewport,
  minZoom = MIN_VIEWPORT_ZOOM,
  maxZoom = MAX_VIEWPORT_ZOOM,
}) => {
  const currentScale = Math.max(0.05, Number(baseScale) * Number(zoom || 1));
  const nextZoom = clampZoom((Number(zoom) || 1) * Number(zoomFactor || 1), minZoom, maxZoom);
  const nextScale = Math.max(0.05, Number(baseScale) * nextZoom);
  const designPoint = {
    x: ((Number(pointer.x) || 0) - (Number(viewport.x) || 0)) / currentScale,
    y: ((Number(pointer.y) || 0) - (Number(viewport.y) || 0)) / currentScale,
  };
  const nextViewportBase = {
    x: ((Number(stageWidth) || 0) - (Number(designWidth) || 0) * nextScale) / 2,
    y: ((Number(stageHeight) || 0) - (Number(designHeight) || 0) * nextScale) / 2,
  };
  return {
    zoom: nextZoom,
    pan: {
      x: (Number(pointer.x) || 0) - designPoint.x * nextScale - nextViewportBase.x,
      y: (Number(pointer.y) || 0) - designPoint.y * nextScale - nextViewportBase.y,
    },
  };
};
