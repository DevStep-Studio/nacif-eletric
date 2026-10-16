/**
 * Gerenciador de Persistência para Avisos e Erros (Issues)
 * Suporte a IndexedDB nativo (sem limite de 5MB do LocalStorage)
 * Fallback para LocalStorage e eventos em tempo real
 */

const DB_NAME = "nacif_issues_db";
const DB_VERSION = 1;
const STORE_ISSUES = "issues";
const STORE_ATTACHMENTS = "issue_attachments";
const LOCAL_ISSUES_BACKUP_KEY = "nacif_issues_backup_v1";

export const ISSUES_CHANGED_EVENT = "nacif:issues-changed";

let dbPromise = null;

function getIndexedDB() {
  if (typeof window === "undefined" || !window.indexedDB) {
    return null;
  }
  return window.indexedDB;
}

function openIssuesDb() {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = idb.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_ISSUES)) {
          const issueStore = db.createObjectStore(STORE_ISSUES, { keyPath: "id" });
          issueStore.createIndex("protocol", "protocol", { unique: true });
          issueStore.createIndex("user_id", "user_id", { unique: false });
          issueStore.createIndex("status", "status", { unique: false });
          issueStore.createIndex("created_date", "created_date", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          db.createObjectStore(STORE_ATTACHMENTS, { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onerror = (err) => {
        console.warn("[IndexedDB Issues] Falha ao abrir banco:", err);
        resolve(null);
      };
    } catch (e) {
      console.warn("[IndexedDB Issues] Exceção ao abrir banco:", e);
      resolve(null);
    }
  });

  return dbPromise;
}

// Fallback no LocalStorage
function readBackupIssues() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ISSUES_BACKUP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeBackupIssues(issues) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    // Sanitiza anexos pesados para backup leve no LocalStorage
    const lightweight = (issues || []).map((iss) => ({
      ...iss,
      attachments: (iss.attachments || []).map((att) => ({
        id: att.id,
        name: att.name,
        size: att.size,
        type: att.type,
      })),
    }));
    window.localStorage.setItem(LOCAL_ISSUES_BACKUP_KEY, JSON.stringify(lightweight.slice(0, 100)));
  } catch (err) {
    console.warn("[Issues LocalStorage Backup] Quota excedida:", err);
  }
}

function notifyChange(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ISSUES_CHANGED_EVENT, { detail }));
  }
}

/**
 * Gera protocolo sequencial legível no formato #ERR-YYYY-XXXX
 */
export function generateProtocol(existingIssues = []) {
  const year = new Date().getFullYear();
  const yearPrefix = `#ERR-${year}-`;
  
  let maxSeq = 0;
  for (const item of existingIssues) {
    if (item?.protocol && item.protocol.startsWith(yearPrefix)) {
      const seqStr = item.protocol.replace(yearPrefix, "");
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  }

  const nextSeq = maxSeq + 1;
  return `${yearPrefix}${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Lista todos os relatos salvos no IndexedDB (ou fallback)
 */
export async function getAllIssues() {
  const db = await openIssuesDb();
  if (!db) {
    return readBackupIssues();
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_ISSUES], "readonly");
      const store = tx.objectStore(STORE_ISSUES);
      const req = store.getAll();

      req.onsuccess = () => {
        const results = req.result || [];
        if (results.length === 0) {
          // Se IDB está vazio, tenta recuperar do backup LocalStorage
          const backup = readBackupIssues();
          if (backup.length > 0) {
            // Repopula IDB
            saveMultipleIssues(backup).catch(() => {});
            return resolve(backup);
          }
        }
        resolve(results);
      };

      req.onerror = () => {
        resolve(readBackupIssues());
      };
    } catch {
      resolve(readBackupIssues());
    }
  });
}

/**
 * Salva múltiplos relatos (usado para migração/sync)
 */
export async function saveMultipleIssues(issues) {
  const db = await openIssuesDb();
  writeBackupIssues(issues);

  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_ISSUES], "readwrite");
      const store = tx.objectStore(STORE_ISSUES);
      for (const iss of issues) {
        store.put(iss);
      }
      tx.oncomplete = () => {
        notifyChange({ count: issues.length });
        resolve(true);
      };
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Salva ou atualiza um relato individual
 */
export async function saveIssue(issue) {
  if (!issue || !issue.id) return false;

  const currentIssues = await getAllIssues();
  const index = currentIssues.findIndex((i) => i.id === issue.id);
  const nextIssues = [...currentIssues];

  if (index >= 0) {
    nextIssues[index] = { ...nextIssues[index], ...issue, updated_date: new Date().toISOString() };
  } else {
    nextIssues.unshift(issue);
  }

  writeBackupIssues(nextIssues);

  const db = await openIssuesDb();
  if (db) {
    try {
      const tx = db.transaction([STORE_ISSUES], "readwrite");
      const store = tx.objectStore(STORE_ISSUES);
      store.put(index >= 0 ? nextIssues[index] : issue);
    } catch (err) {
      console.warn("[saveIssue IDB Error]", err);
    }
  }

  notifyChange({ issueId: issue.id, action: index >= 0 ? "update" : "create" });
  return index >= 0 ? nextIssues[index] : issue;
}

/**
 * Busca um relato por ID
 */
export async function getIssueById(id) {
  if (!id) return null;
  const db = await openIssuesDb();
  if (!db) {
    const list = readBackupIssues();
    return list.find((i) => i.id === id) || null;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_ISSUES], "readonly");
      const store = tx.objectStore(STORE_ISSUES);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => {
        const list = readBackupIssues();
        resolve(list.find((i) => i.id === id) || null);
      };
    } catch {
      const list = readBackupIssues();
      resolve(list.find((i) => i.id === id) || null);
    }
  });
}

/**
 * Remove um relato
 */
export async function deleteIssue(id) {
  if (!id) return false;
  const currentIssues = await getAllIssues();
  const nextIssues = currentIssues.filter((i) => i.id !== id);
  writeBackupIssues(nextIssues);

  const db = await openIssuesDb();
  if (db) {
    try {
      const tx = db.transaction([STORE_ISSUES], "readwrite");
      const store = tx.objectStore(STORE_ISSUES);
      store.delete(id);
    } catch (e) {
      console.warn("[deleteIssue IDB Error]", e);
    }
  }

  notifyChange({ issueId: id, action: "delete" });
  return true;
}
