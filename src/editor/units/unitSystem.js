export const INTERNAL_UNIT = "mm";

export const UNIT_DEFINITIONS = {
  mm: { id: "mm", label: "Milimetros", mmFactor: 1, precision: 0 },
  cm: { id: "cm", label: "Centimetros", mmFactor: 10, precision: 1 },
  m: { id: "m", label: "Metros", mmFactor: 1000, precision: 2 },
};

export const DEFAULT_UNIT_SETTINGS = {
  documentUnit: "mm",
  displayUnit: "m",
  decimalPrecision: 2,
  gridSizeMm: 100,
  gridSubdivisions: 5,
  printScale: "1:50",
};

export const DEFAULT_PX_PER_METER = 50;
export const MIN_PX_PER_METER = 20;
export const MAX_PX_PER_METER = 200;

export const normalizePxPerMeter = (value, fallback = DEFAULT_PX_PER_METER) => {
  const numeric = Number(value);
  const next = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(MIN_PX_PER_METER, Math.min(MAX_PX_PER_METER, next));
};

export const normalizeUnit = (unit, fallback = "m") => (
  UNIT_DEFINITIONS[unit] ? unit : fallback
);

export const normalizeUnitSettings = (settings = {}) => ({
  ...DEFAULT_UNIT_SETTINGS,
  ...settings,
  documentUnit: normalizeUnit(settings.documentUnit, DEFAULT_UNIT_SETTINGS.documentUnit),
  displayUnit: normalizeUnit(settings.displayUnit, DEFAULT_UNIT_SETTINGS.displayUnit),
  decimalPrecision: Math.max(0, Math.min(4, Number(settings.decimalPrecision ?? DEFAULT_UNIT_SETTINGS.decimalPrecision))),
  gridSizeMm: Math.max(1, Number(settings.gridSizeMm) || DEFAULT_UNIT_SETTINGS.gridSizeMm),
  gridSubdivisions: Math.max(1, Math.min(20, Number(settings.gridSubdivisions) || DEFAULT_UNIT_SETTINGS.gridSubdivisions)),
});

export const toMillimeters = (value, unit = "m") => {
  const definition = UNIT_DEFINITIONS[normalizeUnit(unit)];
  return (Number(value) || 0) * definition.mmFactor;
};

export const fromMillimeters = (valueMm, unit = "m") => {
  const definition = UNIT_DEFINITIONS[normalizeUnit(unit)];
  return (Number(valueMm) || 0) / definition.mmFactor;
};

export const designPxToMillimeters = (valuePx, pxPerMeter = DEFAULT_PX_PER_METER) => (
  (Number(valuePx) || 0) * (1000 / normalizePxPerMeter(pxPerMeter))
);

export const millimetersToDesignPx = (valueMm, pxPerMeter = DEFAULT_PX_PER_METER) => (
  (Number(valueMm) || 0) / (1000 / normalizePxPerMeter(pxPerMeter))
);

export const formatMillimeters = (valueMm, unit = "m", precision = UNIT_DEFINITIONS[normalizeUnit(unit)].precision) => {
  const normalizedUnit = normalizeUnit(unit);
  const value = fromMillimeters(valueMm, normalizedUnit);
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })} ${normalizedUnit}`;
};

export const formatDesignDistance = (valuePx, pxPerMeter = DEFAULT_PX_PER_METER, unit = "m", precision) => (
  formatMillimeters(designPxToMillimeters(valuePx, pxPerMeter), unit, precision)
);
