import { z } from "zod";

import { normalizeCableRoutes } from "../../lib/manualCableEditor.js";
import { createDefaultLayerState, normalizeLayerState } from "../layers/defaultLayers.js";
import { DEFAULT_SNAP_SETTINGS, normalizeSnapSettings } from "../snapping/snapEngine.js";
import {
  DEFAULT_PX_PER_METER,
  normalizePxPerMeter,
  normalizeUnitSettings,
} from "../units/unitSystem.js";

export const CURRENT_PLANT_SCHEMA_VERSION = 1;

export const BaseEntitySchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().optional(),
  layerId: z.string().optional(),
  rotation: z.number().optional(),
  locked: z.boolean().optional(),
  visible: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
}).passthrough();

export const PlantDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1).default(CURRENT_PLANT_SCHEMA_VERSION),
  imageUrl: z.string().nullable().optional(),
  imageLayout: z.unknown().nullable().optional(),
  importedFileName: z.string().optional(),
  importStatus: z.string().optional(),
  importedPlanElements: z.object({
    lines: z.array(z.unknown()).default([]),
    texts: z.array(z.unknown()).default([]),
  }).default({ lines: [], texts: [] }),
  points: z.array(BaseEntitySchema).default([]),
  rooms: z.array(BaseEntitySchema).default([]),
  walls: z.array(BaseEntitySchema).default([]),
  openings: z.array(BaseEntitySchema).default([]),
  roomLabels: z.array(BaseEntitySchema).default([]),
  routes: z.array(z.unknown()).default([]),
  scalePxPerMeter: z.number().optional(),
  showWallDimensions: z.boolean().optional(),
  showDeviceDimensions: z.boolean().optional(),
  unitSettings: z.record(z.unknown()).optional(),
  layers: z.record(z.unknown()).optional(),
  snapSettings: z.record(z.unknown()).optional(),
  viewport: z.record(z.unknown()).optional(),
}).passthrough();

export const createEmptyPlantDocument = ({ scalePxPerMeter = DEFAULT_PX_PER_METER } = {}) => ({
  schemaVersion: CURRENT_PLANT_SCHEMA_VERSION,
  imageUrl: null,
  imageLayout: null,
  importedFileName: "",
  importStatus: "",
  importedPlanElements: { lines: [], texts: [] },
  points: [],
  rooms: [],
  walls: [],
  openings: [],
  roomLabels: [],
  routes: [],
  scalePxPerMeter: normalizePxPerMeter(scalePxPerMeter),
  showWallDimensions: true,
  showDeviceDimensions: false,
  unitSettings: normalizeUnitSettings(),
  layers: createDefaultLayerState(),
  snapSettings: normalizeSnapSettings(DEFAULT_SNAP_SETTINGS),
  viewport: { zoom: 1, pan: { x: 0, y: 0 } },
});

const normalizeWall = (wall = {}) => {
  const thicknessCm = Math.max(8, Math.min(35, Number(wall.thicknessCm) || 15));
  return {
    ...wall,
    layerId: wall.layerId || "walls",
    locked: Boolean(wall.locked),
    visible: wall.visible !== false,
    metadata: wall.metadata || {},
    thicknessCm,
    thickness: Math.max(3, Math.min(14, Number(wall.thickness) || thicknessCm * 0.4)),
  };
};

const normalizeEntityArray = (items = [], layerId = "") => (
  (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    ...(layerId && !item.layerId ? { layerId } : {}),
    locked: Boolean(item.locked),
    visible: item.visible !== false,
    metadata: item.metadata || {},
  }))
);

export const normalizePlantDocument = (design, { defaultScalePxPerMeter = DEFAULT_PX_PER_METER } = {}) => {
  if (!design || typeof design !== "object") return createEmptyPlantDocument({ scalePxPerMeter: defaultScalePxPerMeter });
  const parsed = PlantDocumentSchema.safeParse(design);
  const source = parsed.success ? parsed.data : { ...design };
  const scalePxPerMeter = normalizePxPerMeter(
    source.scalePxPerMeter || source.pxPerMeter || source.scale,
    defaultScalePxPerMeter,
  );
  return {
    ...createEmptyPlantDocument({ scalePxPerMeter }),
    ...source,
    schemaVersion: CURRENT_PLANT_SCHEMA_VERSION,
    importedPlanElements: source.importedPlanElements || { lines: [], texts: [] },
    points: normalizeEntityArray(source.points, "electrical"),
    rooms: normalizeEntityArray(source.rooms, "rooms"),
    walls: (Array.isArray(source.walls) ? source.walls : []).map(normalizeWall),
    openings: normalizeEntityArray(source.openings, "openings"),
    roomLabels: normalizeEntityArray(source.roomLabels, "texts"),
    routes: normalizeCableRoutes(source.routes || []),
    scalePxPerMeter,
    showWallDimensions: source.showWallDimensions !== false,
    showDeviceDimensions: source.showDeviceDimensions === true,
    unitSettings: normalizeUnitSettings(source.unitSettings),
    layers: normalizeLayerState(source.layers),
    snapSettings: normalizeSnapSettings(source.snapSettings),
    viewport: source.viewport || { zoom: 1, pan: { x: 0, y: 0 } },
  };
};
