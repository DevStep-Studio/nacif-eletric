export const DEFAULT_EDITOR_LAYERS = [
  { id: "walls", label: "Paredes", visible: true, locked: false, printable: true, opacity: 1, order: 10 },
  { id: "openings", label: "Portas e janelas", visible: true, locked: false, printable: true, opacity: 1, order: 20 },
  { id: "furniture", label: "Mobiliario", visible: true, locked: false, printable: true, opacity: 1, order: 30 },
  { id: "rooms", label: "Ambientes", visible: true, locked: false, printable: true, opacity: 1, order: 35 },
  { id: "electrical", label: "Eletrica", visible: true, locked: false, printable: true, opacity: 1, order: 40 },
  { id: "lighting", label: "Iluminacao", visible: true, locked: false, printable: true, opacity: 1, order: 50 },
  { id: "outlets", label: "Tomadas", visible: true, locked: false, printable: true, opacity: 1, order: 60 },
  { id: "circuits", label: "Circuitos", visible: true, locked: false, printable: true, opacity: 1, order: 70 },
  { id: "dimensions", label: "Cotas", visible: true, locked: false, printable: true, opacity: 1, order: 80 },
  { id: "texts", label: "Textos", visible: true, locked: false, printable: true, opacity: 1, order: 90 },
  { id: "background", label: "Fundo importado", visible: true, locked: true, printable: true, opacity: 1, order: 0 },
  { id: "guides", label: "Guias", visible: true, locked: false, printable: false, opacity: 1, order: 100 },
  { id: "boards", label: "Quadro", visible: true, locked: false, printable: true, opacity: 1, order: 110 },
  { id: "hiddenCircuits", label: "Circuitos ocultos", visible: false, locked: false, printable: false, opacity: 1, order: 120 },
];

const LEGACY_LAYER_MAP = {
  iluminacao: "lighting",
  tomadas: "outlets",
  forca: "electrical",
  infra: "circuits",
  extra: "electrical",
};

export const createDefaultLayerState = () => (
  Object.fromEntries(DEFAULT_EDITOR_LAYERS.map((layer) => [layer.id, { ...layer }]))
);

export const normalizeLayerState = (input = {}) => {
  const next = createDefaultLayerState();
  Object.entries(input || {}).forEach(([key, value]) => {
    const id = LEGACY_LAYER_MAP[key] || key;
    if (!next[id]) return;
    if (typeof value === "boolean") {
      next[id] = { ...next[id], visible: value };
      return;
    }
    if (value && typeof value === "object") {
      next[id] = {
        ...next[id],
        ...value,
        visible: value.visible !== false,
        locked: Boolean(value.locked),
        printable: value.printable !== false,
        opacity: Math.max(0, Math.min(1, Number(value.opacity ?? next[id].opacity))),
      };
    }
  });
  return next;
};

export const layerVisibilityForLegacyCanvas = (layers = {}) => {
  const normalized = normalizeLayerState(layers);
  return {
    iluminacao: normalized.lighting.visible,
    tomadas: normalized.outlets.visible,
    forca: normalized.electrical.visible,
    infra: normalized.circuits.visible,
    extra: normalized.electrical.visible,
  };
};
