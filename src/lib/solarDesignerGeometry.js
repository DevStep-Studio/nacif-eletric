export const DEFAULT_SOLAR_MAP_CENTER = { lat: -23.55052, lng: -46.63331 };
export const DEFAULT_SOLAR_MAP_ZOOM = 20;
export const SOLAR_MODULE_WIDTH_M = 1.14;
export const SOLAR_MODULE_HEIGHT_M = 2.4;

const METERS_PER_DEGREE_LAT = 111_320;
const COORD_PRECISION = 10_000_000;

export const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const roundCoordinate = (value) => Math.round(Number(value) * COORD_PRECISION) / COORD_PRECISION;

export function normalizeLatLng(point) {
  if (Array.isArray(point) && point.length >= 2) {
    const lat = Number(point[0]);
    const lng = Number(point[1]);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  if (point && typeof point === "object") {
    const lat = Number(point.lat ?? point.latitude);
    const lng = Number(point.lng ?? point.lon ?? point.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  return null;
}

export function normalizeRoofPolygon(raw) {
  if (!raw) return [];

  if (raw.type === "Polygon" && Array.isArray(raw.coordinates?.[0])) {
    return raw.coordinates[0]
      .map((coordinate) => normalizeLatLng([coordinate[1], coordinate[0]]))
      .filter(Boolean);
  }

  if (!Array.isArray(raw)) return [];

  return raw.map(normalizeLatLng).filter(Boolean);
}

export function serializeRoofPolygon(points) {
  return normalizeRoofPolygon(points).map((point) => ({
    lat: roundCoordinate(point.lat),
    lng: roundCoordinate(point.lng),
  }));
}

export function getMapCenterFromConfig(config = {}) {
  const lat = Number(config.map_center_lat);
  const lng = Number(config.map_center_lng);

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  return DEFAULT_SOLAR_MAP_CENTER;
}

export function getPolygonCentroid(points) {
  const normalized = normalizeRoofPolygon(points);
  if (!normalized.length) return null;

  const sum = normalized.reduce(
    (acc, point) => ({ lat: acc.lat + point.lat, lng: acc.lng + point.lng }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: sum.lat / normalized.length,
    lng: sum.lng / normalized.length,
  };
}

export function getPolygonAreaSquareMeters(points) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 3) return 0;

  const origin = getPolygonCentroid(polygon) || DEFAULT_SOLAR_MAP_CENTER;
  const localPoints = polygon.map((point) => latLngToMeters(point, origin));
  const twiceArea = localPoints.reduce((sum, point, index) => {
    const next = localPoints[(index + 1) % localPoints.length];
    return sum + point.east * next.north - next.east * point.north;
  }, 0);

  return Math.abs(twiceArea) / 2;
}

export function getRoofCenterFromConfig(config = {}) {
  return getPolygonCentroid(config.roof_polygon) || getMapCenterFromConfig(config);
}

function longitudeMeterFactor(lat) {
  return Math.max(0.000001, METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));
}

export function latLngToMeters(point, origin) {
  return {
    east: (point.lng - origin.lng) * longitudeMeterFactor(origin.lat),
    north: (point.lat - origin.lat) * METERS_PER_DEGREE_LAT,
  };
}

export function metersToLatLng(origin, eastMeters, northMeters) {
  return {
    lat: origin.lat + northMeters / METERS_PER_DEGREE_LAT,
    lng: origin.lng + eastMeters / longitudeMeterFactor(origin.lat),
  };
}

export function rotateMeters(east, north, rotationDeg) {
  const radians = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    east: east * cos - north * sin,
    north: east * sin + north * cos,
  };
}

export function normalizeRotationDeg(value) {
  let rotation = finiteNumber(value, 0);
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;
  return rotation;
}

export function buildRoofPolygon(center, widthM, heightM, rotationDeg = 0) {
  const safeCenter = normalizeLatLng(center) || DEFAULT_SOLAR_MAP_CENTER;
  const width = Math.max(0.5, finiteNumber(widthM, 9));
  const height = Math.max(0.5, finiteNumber(heightM, 6));
  const rotation = normalizeRotationDeg(rotationDeg);
  const corners = [
    [-width / 2, height / 2],
    [width / 2, height / 2],
    [width / 2, -height / 2],
    [-width / 2, -height / 2],
  ];

  return corners.map(([east, north]) => {
    const rotated = rotateMeters(east, north, rotation);
    return metersToLatLng(safeCenter, rotated.east, rotated.north);
  });
}

export function getRoofPolygonFromConfig(config = {}) {
  const polygon = normalizeRoofPolygon(config.roof_polygon);
  if (polygon.length >= 3) return polygon;

  if (config.roof_defined === false) return [];

  return buildRoofPolygon(
    getRoofCenterFromConfig(config),
    config.roof_width_m,
    config.roof_height_m,
    config.roof_rotation_deg
  );
}

export function distanceMeters(a, b) {
  const origin = getPolygonCentroid([a, b]) || DEFAULT_SOLAR_MAP_CENTER;
  const start = latLngToMeters(a, origin);
  const end = latLngToMeters(b, origin);
  return Math.hypot(end.east - start.east, end.north - start.north);
}

export function edgeRotationDegrees(a, b) {
  const origin = normalizeLatLng(a) || DEFAULT_SOLAR_MAP_CENTER;
  const start = latLngToMeters(a, origin);
  const end = latLngToMeters(b, origin);
  return normalizeRotationDeg((Math.atan2(end.north - start.north, end.east - start.east) * 180) / Math.PI);
}

export function getDominantRoofRotation(points, fallbackRotation = 0) {
  const polygon = normalizeRoofPolygon(points);
  if (polygon.length < 2) return normalizeRotationDeg(fallbackRotation);

  let longestEdge = null;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const length = distanceMeters(start, end);

    if (!longestEdge || length > longestEdge.length) {
      longestEdge = { start, end, length };
    }
  }

  if (!longestEdge || longestEdge.length < 0.5) return normalizeRotationDeg(fallbackRotation);

  let rotation = edgeRotationDegrees(longestEdge.start, longestEdge.end);
  if (rotation > 90) rotation -= 180;
  if (rotation < -90) rotation += 180;

  return normalizeRotationDeg(rotation);
}

export function getRoofMetricsFromPolygon(points, fallback = {}) {
  const polygon = normalizeRoofPolygon(points);
  const center = getPolygonCentroid(polygon) || getRoofCenterFromConfig(fallback);
  const fallbackWidth = Math.max(0.5, finiteNumber(fallback.roof_width_m, 9));
  const fallbackHeight = Math.max(0.5, finiteNumber(fallback.roof_height_m, 6));

  if (polygon.length < 3) {
    return {
      center,
      widthM: fallbackWidth,
      heightM: fallbackHeight,
      areaM2: fallbackWidth * fallbackHeight,
      rotationDeg: normalizeRotationDeg(fallback.roof_rotation_deg),
    };
  }

  const rotationDeg = getDominantRoofRotation(polygon, fallback.roof_rotation_deg);

  const localPoints = polygon.map((point) => {
    const meters = latLngToMeters(point, center);
    return rotateMeters(meters.east, meters.north, -rotationDeg);
  });

  const eastValues = localPoints.map((point) => point.east);
  const northValues = localPoints.map((point) => point.north);
  const widthM = Math.max(0.5, Math.max(...eastValues) - Math.min(...eastValues));
  const heightM = Math.max(0.5, Math.max(...northValues) - Math.min(...northValues));

  return {
    center,
    widthM,
    heightM,
    areaM2: getPolygonAreaSquareMeters(polygon),
    rotationDeg,
  };
}

function pointInPolygon(point, polygon) {
  let inside = false;

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint.north > point.north) !== (previousPoint.north > point.north))
      && (point.east < ((previousPoint.east - currentPoint.east) * (point.north - currentPoint.north)) / (previousPoint.north - currentPoint.north || 1e-9) + currentPoint.east);

    if (intersects) inside = !inside;
  }

  return inside;
}

function distanceToSegment(point, start, end) {
  const segmentEast = end.east - start.east;
  const segmentNorth = end.north - start.north;
  const segmentLengthSq = segmentEast * segmentEast + segmentNorth * segmentNorth;

  if (!segmentLengthSq) return Math.hypot(point.east - start.east, point.north - start.north);

  const t = Math.max(0, Math.min(1, ((point.east - start.east) * segmentEast + (point.north - start.north) * segmentNorth) / segmentLengthSq));
  const projected = {
    east: start.east + t * segmentEast,
    north: start.north + t * segmentNorth,
  };

  return Math.hypot(point.east - projected.east, point.north - projected.north);
}

function pointInPolygonOrBoundary(point, polygon, toleranceM = 0.03) {
  if (pointInPolygon(point, polygon)) return true;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (distanceToSegment(point, start, end) <= toleranceM) return true;
  }

  return false;
}

export function buildPanelPolygons(config = {}, sizing = {}, gapM = 0.08) {
  const roofPolygon = getRoofPolygonFromConfig(config);
  if (roofPolygon.length < 3) return [];

  const center = getPolygonCentroid(roofPolygon) || getRoofCenterFromConfig(config);
  const metrics = getRoofMetricsFromPolygon(roofPolygon, config);
  const panelCount = Math.max(0, Math.min(1200, Math.round(finiteNumber(sizing.panelCount, 0))));
  const moduleWidth = SOLAR_MODULE_WIDTH_M;
  const moduleHeight = SOLAR_MODULE_HEIGHT_M;
  const panelWidth = sizing.orientation === "horizontal" ? moduleHeight : moduleWidth;
  const panelHeight = sizing.orientation === "horizontal" ? moduleWidth : moduleHeight;
  const rotation = getDominantRoofRotation(roofPolygon, config.roof_rotation_deg ?? metrics.rotationDeg);
  const localRoof = roofPolygon.map((point) => {
    const meters = latLngToMeters(point, center);
    return rotateMeters(meters.east, meters.north, -rotation);
  });
  const eastValues = localRoof.map((point) => point.east);
  const northValues = localRoof.map((point) => point.north);
  const minEast = Math.min(...eastValues);
  const maxEast = Math.max(...eastValues);
  const minNorth = Math.min(...northValues);
  const maxNorth = Math.max(...northValues);
  const columnPitch = panelWidth + gapM;
  const rowPitch = panelHeight + gapM;
  const columns = Math.max(1, Math.min(80, Math.ceil((maxEast - minEast) / columnPitch) + 1));
  const rows = Math.max(1, Math.min(80, Math.ceil((maxNorth - minNorth) / rowPitch) + 1));
  const panelCorners = [
    [-panelWidth / 2, panelHeight / 2],
    [panelWidth / 2, panelHeight / 2],
    [panelWidth / 2, -panelHeight / 2],
    [-panelWidth / 2, -panelHeight / 2],
  ];
  const offsetSteps = 8;
  let bestLocalPanels = [];

  for (let offsetRow = 0; offsetRow < offsetSteps; offsetRow += 1) {
    const offsetNorth = (rowPitch * offsetRow) / offsetSteps;

    for (let offsetColumn = 0; offsetColumn < offsetSteps; offsetColumn += 1) {
      const offsetEast = (columnPitch * offsetColumn) / offsetSteps;
      const localPanels = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const centerEast = minEast + panelWidth / 2 - offsetEast + column * columnPitch;
          const centerNorth = maxNorth - panelHeight / 2 + offsetNorth - row * rowPitch;
          const localCorners = panelCorners.map(([east, north]) => ({
            east: centerEast + east,
            north: centerNorth + north,
          }));
          const fitsInsideRoof = [
            { east: centerEast, north: centerNorth },
            ...localCorners,
          ].every((point) => pointInPolygonOrBoundary(point, localRoof));

          if (fitsInsideRoof) localPanels.push(localCorners);
        }
      }

      if (localPanels.length > bestLocalPanels.length) bestLocalPanels = localPanels;
    }
  }

  return bestLocalPanels.slice(0, panelCount).map((localCorners) => (
    localCorners.map((corner) => {
      const rotated = rotateMeters(corner.east, corner.north, rotation);
      return metersToLatLng(center, rotated.east, rotated.north);
    })
  ));
}

export function getBestPanelLayout(config = {}, panelLimit = 1200) {
  const safeLimit = Math.max(0, Math.min(1200, Math.round(finiteNumber(panelLimit, 1200))));
  const requestedOrientation = config.module_orientation || "auto";
  const orientations = requestedOrientation === "auto"
    ? ["vertical", "horizontal"]
    : [requestedOrientation];
  const layouts = orientations.map((orientation) => {
    const panels = buildPanelPolygons(config, { panelCount: safeLimit, orientation });
    return { orientation, panels, panelCount: panels.length };
  });

  return layouts.sort((a, b) => b.panelCount - a.panelCount)[0] || {
    orientation: requestedOrientation === "horizontal" ? "horizontal" : "vertical",
    panels: [],
    panelCount: 0,
  };
}
