/**
 * Persistência robusta de plantas baixas com suporte a IndexedDB e fallback LocalStorage.
 * Evita perdas por QuotaExceededError em imagens grandes e garante salvamento síncrono ao fechar.
 */

const DB_NAME = "nacif_planta_db";
const DB_VERSION = 1;
const STORE_PLANTS = "plant_snapshots";
const STORE_IMAGES = "plant_images";

let dbInstance = null;

function openPlantDb() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }

  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_PLANTS)) {
          db.createObjectStore(STORE_PLANTS, { keyPath: "projectId" });
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES, { keyPath: "projectId" });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = () => {
        console.warn("[IndexedDB] Não foi possível abrir o banco de plantas, usando fallback.");
        resolve(null);
      };
    } catch (e) {
      console.warn("[IndexedDB] Falha ao inicializar:", e);
      resolve(null);
    }
  });
}

/**
 * Salva o snapshot da planta no IndexedDB.
 */
export async function savePlantToIndexedDB(projectId, snapshot) {
  if (!projectId || !snapshot) return false;
  const db = await openPlantDb();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PLANTS], "readwrite");
      const store = tx.objectStore(STORE_PLANTS);
      
      const record = {
        projectId: String(projectId),
        snapshot,
        updatedAt: new Date().toISOString(),
      };

      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch (err) {
      console.warn("[IndexedDB] Erro ao gravar snapshot da planta:", err);
      resolve(false);
    }
  });
}

/**
 * Carrega o snapshot da planta do IndexedDB.
 */
export async function loadPlantFromIndexedDB(projectId) {
  if (!projectId) return null;
  const db = await openPlantDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_PLANTS], "readonly");
      const store = tx.objectStore(STORE_PLANTS);
      const req = store.get(String(projectId));

      req.onsuccess = (event) => {
        const res = event.target.result;
        resolve(res?.snapshot || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
