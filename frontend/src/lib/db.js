import Dexie from "dexie";

export const db = new Dexie("bengkel_sparepart_db");

db.version(1).stores({
  items: "++id, name, partCode, brand, updatedAt, lastCheckedAt, isSample",
  priceHistory: "++id, itemId, at",
  scanHistory: "++id, itemId, at",
  settings: "key",
});

export const DEFAULT_BRANDS = ["Honda AHM", "Yamaha YGP", "Suzuki SGP", "Federal", "Aspira", "NGK", "Indoparts", "KTC"];
export const DEFAULT_MOTORS = ["Beat", "Vario", "Scoopy", "Genio", "Mio", "NMAX", "Aerox", "Supra X 125", "Revo", "Jupiter Z", "PCX", "Satria FU"];

export const DEFAULT_SETTINGS = {
  shopName: "Bengkel Saya",
  lowStockThreshold: 3,
  seeded: false,
  brandOptions: DEFAULT_BRANDS,
  motorOptions: DEFAULT_MOTORS,
};

export const SIZE_KEYWORDS = /(seal|sil|karet|o-?ring|oring|packing|paking|gasket|bearing|laher)/i;

export async function getSetting(key) {
  const row = await db.settings.get(key);
  return row ? row.value : DEFAULT_SETTINGS[key];
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}

export async function getAllSettings() {
  const rows = await db.settings.toArray();
  const out = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => (out[r.key] = r.value));
  return out;
}

function clean(v) {
  return (v || "").toString().trim();
}

/**
 * Kunci identitas barang: kode part + nama.
 *
 * Butuh keduanya supaya tidak salah menggabungkan barang berbeda yang
 * kebetulan memakai kode sama (mis. "Ban Dalam 17/250" dan
 * "Ban Luar Trial 17/250" adalah dua barang berbeda).
 */
export function itemKey(it) {
  const name = clean(it?.name).toUpperCase().replace(/\s+/g, " ");
  if (!name) return "";
  const code = clean(it?.partCode).toUpperCase().replace(/\s+/g, "");
  return `${code}|${name}`;
}

/**
 * Cari barang lain yang benar-benar sama (kode part + nama sama).
 * Dipakai untuk mencegah barang ganda.
 */
export async function findDuplicate(data, excludeId) {
  const key = itemKey(data);
  if (!key) return null;
  const rows = await db.items.filter((it) => !it.deleted && it.id !== excludeId).toArray();
  return rows.find((it) => itemKey(it) === key) || null;
}

export async function saveItem(data, existingId) {
  const now = Date.now();
  const record = {
    name: clean(data.name),
    partCode: clean(data.partCode).toUpperCase(),
    brand: clean(data.brand),
    size: clean(data.size),
    compatibility: clean(data.compatibility),
    costPrice: Number(data.costPrice) || 0,
    sellPrice: Number(data.sellPrice) || 0,
    stock: data.stock === null || data.stock === undefined || data.stock === "" ? null : Math.max(0, Number(data.stock) || 0),
    photo: data.photo || null,
    embedding: data.embedding || null,
    // text read from the product photo/label (used by the scanner to tell look-alike labels apart)
    ocrTokens: Array.isArray(data.ocrTokens) ? data.ocrTokens : null,
    ocrSizes: Array.isArray(data.ocrSizes) ? data.ocrSizes : null,
    ocrAt: data.ocrAt || null,
    updatedAt: now,
    deleted: false,
  };
  if (existingId) {
    const prev = await db.items.get(existingId);
    await db.items.update(existingId, { ...record, isSample: prev?.isSample ? 1 : 0 });
    if (!prev || prev.costPrice !== record.costPrice || prev.sellPrice !== record.sellPrice) {
      await db.priceHistory.add({ itemId: existingId, costPrice: record.costPrice, sellPrice: record.sellPrice, at: now });
    }
    return existingId;
  }
  const id = await db.items.add({ ...record, isSample: data.isSample ? 1 : 0, createdAt: now, lastCheckedAt: 0 });
  await db.priceHistory.add({ itemId: id, costPrice: record.costPrice, sellPrice: record.sellPrice, at: now });
  return id;
}

export async function deleteItem(id) {
  // Soft delete: baris tetap ada dengan deleted=true agar penghapusan ikut
  // tersinkron ke perangkat lain (lihat lib/sync.js).
  await db.transaction("rw", db.items, db.priceHistory, db.scanHistory, async () => {
    await db.items.update(id, { deleted: true, updatedAt: Date.now() });
    await db.priceHistory.where("itemId").equals(id).delete();
    await db.scanHistory.where("itemId").equals(id).delete();
  });
}

export async function recordCheck(itemId, method) {
  const at = Date.now();
  await db.scanHistory.add({ itemId, method, at });
  await db.items.update(itemId, { lastCheckedAt: at });
}

export async function adjustStock(id, delta) {
  const it = await db.items.get(id);
  if (!it) return;
  const cur = it.stock === null || it.stock === undefined ? 0 : it.stock;
  await db.items.update(id, { stock: Math.max(0, cur + delta), updatedAt: Date.now() });
}

/** Item aktif (belum dihapus). Dipakai semua halaman agar item hasil soft delete tidak tampil. */
export function liveItems() {
  return db.items.filter((it) => !it.deleted);
}

/** Ambil satu item aktif; null bila sudah dihapus. */
export async function getLiveItem(id) {
  const it = await db.items.get(id);
  return it && !it.deleted ? it : null;
}

export function isLowStock(item, threshold) {
  return item && item.stock !== null && item.stock !== undefined && item.stock <= threshold;
}

export function searchItems(items, q) {
  const s = (q || "").toLowerCase().trim();
  if (!s) return items;
  const terms = s.split(/\s+/).filter(Boolean);
  const compact = (x) => (x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return items
    .map((it) => {
      const hay = [it.name, it.partCode, it.brand, it.compatibility, it.size].join(" ").toLowerCase();
      const hayC = compact(hay);
      let score = 0;
      for (const t of terms) {
        const tc = compact(t);
        if (hay.includes(t)) score += 2;
        else if (tc && hayC.includes(tc)) score += 1;
        else return null;
      }
      if ((it.name || "").toLowerCase().startsWith(s)) score += 3;
      if (compact(it.partCode) === compact(s)) score += 5;
      return { it, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.it);
}

/** When the user confirms which item a scan belonged to, remember that label text for next time. */
export async function learnFromScan(itemId, scan) {
  if (!scan) return;
  const it = await db.items.get(itemId);
  if (!it) return;
  const tokens = Array.from(new Set([...(it.ocrTokens || []), ...(scan.tokens || [])])).slice(0, 160);
  const sizes = [...(it.ocrSizes || [])];
  (scan.sizes || []).forEach((sz) => {
    if (!sizes.some((x) => x.join("x") === sz.join("x"))) sizes.push(sz);
  });
  await db.items.update(itemId, { ocrTokens: tokens, ocrSizes: sizes.slice(0, 6), ocrAt: it.ocrAt || Date.now() });
}
