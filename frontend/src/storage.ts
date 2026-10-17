/**
 * IndexedDB storage for receipts, products, and stock movements.
 * Guest/offline first.
 * Version 2 added products. Version 3 adds stock movements.
 * Upgrades preserve existing receipts and products.
 */

import type { Receipt, Product, StockMovement } from "./types";

const DB_NAME = "receipt-pilot-c";
const DB_VERSION = 3;
const RECEIPTS_STORE = "receipts";
const PRODUCTS_STORE = "products";
const MOVEMENTS_STORE = "stockMovements";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const oldVersion = event.oldVersion;
      if (!db.objectStoreNames.contains(RECEIPTS_STORE)) {
        const store = db.createObjectStore(RECEIPTS_STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("receiptNumber", "receiptNumber", { unique: false });
      }
      if (oldVersion < 2 && !db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: "id" });
        store.createIndex("sku", "sku", { unique: false });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
        store.createIndex("active", "active", { unique: false });
      }
      if (oldVersion < 3 && !db.objectStoreNames.contains(MOVEMENTS_STORE)) {
        const store = db.createObjectStore(MOVEMENTS_STORE, { keyPath: "id" });
        store.createIndex("productId", "productId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECEIPTS_STORE, "readwrite");
    const store = tx.objectStore(RECEIPTS_STORE);
    store.put(receipt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getReceipt(id: string): Promise<Receipt | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECEIPTS_STORE, "readonly");
    const store = tx.objectStore(RECEIPTS_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listReceipts(): Promise<Receipt[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECEIPTS_STORE, "readonly");
    const store = tx.objectStore(RECEIPTS_STORE);
    const index = store.index("updatedAt");
    const req = index.openCursor(null, "prev");
    const results: Receipt[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        results.push(cursor.value as Receipt);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReceipt(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECEIPTS_STORE, "readwrite");
    const store = tx.objectStore(RECEIPTS_STORE);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, "readwrite");
    const store = tx.objectStore(PRODUCTS_STORE);
    store.put(product);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProduct(id: string): Promise<Product | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, "readonly");
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listProducts(includeInactive = false): Promise<Product[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCTS_STORE, "readonly");
    const store = tx.objectStore(PRODUCTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      let results = (req.result as Product[]) || [];
      if (!includeInactive) results = results.filter((p) => p.active);
      results.sort((a, b) => a.name.localeCompare(b.name));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function softDeactivateProduct(id: string): Promise<void> {
  const existing = await getProduct(id);
  if (!existing) return;
  existing.active = false;
  existing.updatedAt = new Date().toISOString();
  await saveProduct(existing);
}

export async function saveMovement(movement: StockMovement): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVEMENTS_STORE, "readwrite");
    const store = tx.objectStore(MOVEMENTS_STORE);
    store.put(movement);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listMovements(productId?: string): Promise<StockMovement[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MOVEMENTS_STORE, "readonly");
    const store = tx.objectStore(MOVEMENTS_STORE);
    const req = productId ? store.index("productId").getAll(productId) : store.getAll();
    req.onsuccess = () => {
      const results = ((req.result as StockMovement[]) || []).slice();
      results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Record a movement and update the product stock in one transaction.
 * Caller must validate first. Returns the updated product.
 */
export async function recordMovementAndUpdateStock(movement: StockMovement, newQty: number): Promise<Product | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([MOVEMENTS_STORE, PRODUCTS_STORE], "readwrite");
    const movements = tx.objectStore(MOVEMENTS_STORE);
    const products = tx.objectStore(PRODUCTS_STORE);
    let updated: Product | null = null;
    const getReq = products.get(movement.productId);
    getReq.onsuccess = () => {
      const product = getReq.result as Product | undefined;
      if (!product) {
        tx.abort();
        return;
      }
      movements.put(movement);
      product.stockQty = newQty;
      product.updatedAt = movement.createdAt;
      products.put(product);
      updated = product;
    };
    getReq.onerror = () => reject(getReq.error);
    tx.oncomplete = () => resolve(updated);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => resolve(null);
  });
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}
