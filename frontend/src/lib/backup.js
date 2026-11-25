import { db, getAllSettings } from "./db";
import { blobToBase64, base64ToBlob } from "./image";

export const BACKUP_APP = "bengkel-sparepart-motor";

export async function buildBackup() {
  const [items, priceHistory, scanHistory, settings] = await Promise.all([
    db.items.toArray(),
    db.priceHistory.toArray(),
    db.scanHistory.toArray(),
    getAllSettings(),
  ]);
  const outItems = [];
  for (const it of items) {
    const { embedding, photo, ...rest } = it;
    outItems.push({ ...rest, photo: photo ? await blobToBase64(photo) : null });
  }
  return {
    app: BACKUP_APP,
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {
      shopName: settings.shopName,
      lowStockThreshold: settings.lowStockThreshold,
      brandOptions: settings.brandOptions,
      motorOptions: settings.motorOptions,
    },
    items: outItems,
    priceHistory,
    scanHistory,
  };
}

export function backupFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `backup-bengkel-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export async function exportBackup() {
  const data = await buildBackup();
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: "application/json" });
  const name = backupFileName();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { name, count: data.items.length, size: blob.size, blob };
}

export async function shareBackup() {
  const data = await buildBackup();
  const name = backupFileName();
  const file = new File([JSON.stringify(data)], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Backup Data Bengkel" });
    return true;
  }
  return false;
}

export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error("File bukan JSON yang valid.");
  }
  if (!data || data.app !== BACKUP_APP || !Array.isArray(data.items)) {
    throw new Error("File ini bukan backup dari aplikasi Bengkel & Toko Sparepart.");
  }
  return data;
}

/** Kunci identitas barang: kode part + nama + merek (lihat lib/db.js itemKey). */
export function itemKey(it) {
  const name = (it?.name || "").toString().trim().toUpperCase().replace(/\s+/g, " ");
  if (!name) return "";
  const code = (it?.partCode || "").toString().trim().toUpperCase().replace(/\s+/g, "");
  const brand = (it?.brand || "").toString().trim().toUpperCase().replace(/\s+/g, " ");
  return `${code}|${name}|${brand}`;
}

/** mode: 'replace' | 'merge' */
export async function restoreBackup(data, mode = "replace") {
  const items = [];
  for (const it of data.items) {
    let photo = null;
    if (it.photo && typeof it.photo === "string" && it.photo.startsWith("data:")) {
      try {
        photo = await base64ToBlob(it.photo);
      } catch (e) {
        photo = null;
      }
    }
    items.push({ ...it, photo, embedding: null });
  }
  const idMap = {};
  let added = 0;
  let updated = 0;
  let skipped = 0;
  await db.transaction("rw", db.items, db.priceHistory, db.scanHistory, db.settings, async () => {
    if (mode === "replace") {
      await db.items.clear();
      await db.priceHistory.clear();
      await db.scanHistory.clear();
    }
    // Peta barang yang sudah ada supaya restore tidak membuat duplikat.
    const existing = new Map();
    if (mode === "merge") {
      for (const row of await db.items.toArray()) {
        const k = itemKey(row);
        if (k && !existing.has(k)) existing.set(k, row);
      }
    }
    for (const it of items) {
      const { id: oldId, ...rest } = it;
      const key = itemKey(rest);
      const hit = key ? existing.get(key) : null;
      if (hit) {
        // Sudah ada: perbarui hanya bila data backup lebih baru.
        const incomingAt = Number(rest.updatedAt || 0);
        const localAt = Number(hit.updatedAt || 0);
        if (incomingAt > localAt) {
          await db.items.update(hit.id, { ...rest, isSample: rest.isSample ? 1 : 0, updatedAt: incomingAt });
          updated += 1;
        } else {
          skipped += 1;
        }
        idMap[oldId] = hit.id;
        continue;
      }
      const newId = await db.items.add({ ...rest, isSample: rest.isSample ? 1 : 0 });
      if (key) existing.set(key, { ...rest, id: newId });
      idMap[oldId] = newId;
      added += 1;
    }
    for (const ph of data.priceHistory || []) {
      const { id, itemId, ...rest } = ph;
      if (idMap[itemId]) await db.priceHistory.add({ ...rest, itemId: idMap[itemId] });
    }
    for (const sh of data.scanHistory || []) {
      const { id, itemId, ...rest } = sh;
      if (idMap[itemId]) await db.scanHistory.add({ ...rest, itemId: idMap[itemId] });
    }
    if (data.settings && mode === "replace") {
      if (data.settings.shopName) await db.settings.put({ key: "shopName", value: data.settings.shopName });
      if (data.settings.lowStockThreshold !== undefined)
        await db.settings.put({ key: "lowStockThreshold", value: Number(data.settings.lowStockThreshold) || 0 });
    }
    if (data.settings) {
      // quick-pick lists: replace -> take backup's list; merge -> union
      for (const key of ["brandOptions", "motorOptions"]) {
        const incoming = Array.isArray(data.settings[key]) ? data.settings[key] : null;
        if (!incoming) continue;
        if (mode === "replace") {
          await db.settings.put({ key, value: incoming });
        } else {
          const row = await db.settings.get(key);
          const cur = row ? row.value : null;
          if (cur) {
            const merged = [...cur];
            incoming.forEach((o) => {
              if (!merged.some((m) => m.toLowerCase() === String(o).toLowerCase())) merged.push(o);
            });
            await db.settings.put({ key, value: merged });
          } else {
            await db.settings.put({ key, value: incoming });
          }
        }
      }
    }
    await db.settings.put({ key: "seeded", value: true });
  });
  return { total: items.length, added, updated, skipped };
}

export async function wipeAll() {
  await db.transaction("rw", db.items, db.priceHistory, db.scanHistory, db.settings, async () => {
    await db.items.clear();
    await db.priceHistory.clear();
    await db.scanHistory.clear();
    await db.settings.put({ key: "seeded", value: true });
  });
}
