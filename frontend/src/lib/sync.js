// Sinkronisasi antar perangkat (HP <-> laptop).
// Data tetap disimpan di IndexedDB (offline-first). Modul ini mengirim perubahan
// ke server dan menarik perubahan dari perangkat lain.
import { db, getAllSettings } from "./db";
import { blobToBase64, base64ToBlob } from "./image";

// Kosong = pakai origin yang sama (frontend & backend satu domain di Vercel).
// Ini menghindari CORS dan tidak butuh variabel build.
const API = (process.env.REACT_APP_BACKEND_URL || "").replace(/\/$/, "");
const LAST_PULL_KEY = "syncLastPull";
const LAST_PULL_AT_KEY = "syncLastPullAt";
const LAST_PUSH_KEY = "syncLastPush";
const DEVICE_KEY = "syncDeviceId";

export const syncEnabled = () => true;

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch (e) {
      /* biarkan pesan default */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Item lokal -> bentuk yang dikirim ke server (foto jadi data URL). */
async function toWire(item) {
  const { photo, embedding, ...rest } = item;
  return { ...rest, photo: photo ? await blobToBase64(photo) : null };
}

/** Bentuk server -> item lokal (data URL jadi Blob). */
async function fromWire(row) {
  const { serverAt, _id, ...rest } = row;
  let photo = null;
  if (rest.photo && typeof rest.photo === "string" && rest.photo.startsWith("data:")) {
    try {
      photo = await base64ToBlob(rest.photo);
    } catch (e) {
      photo = null;
    }
  }
  return { ...rest, photo, embedding: null };
}

export async function getLastPull() {
  const row = await db.settings.get(LAST_PULL_KEY);
  const value = Number(row?.value) || 0;
  // Versi lama memakai timestamp (epoch ms) sebagai cursor. Cursor sekarang
  // berupa nomor urut server yang jauh lebih kecil, jadi nilai lama harus
  // direset agar tarikan berikutnya tidak melewatkan semua data.
  if (value > 1e12) {
    await setLastPull(0);
    return 0;
  }
  return value;
}

async function setLastPull(ts) {
  await db.settings.put({ key: LAST_PULL_KEY, value: ts });
}

/** Waktu (epoch ms) tarikan terakhir yang berhasil — untuk ditampilkan di Pengaturan. */
export async function getLastPullAt() {
  const row = await db.settings.get(LAST_PULL_AT_KEY);
  return Number(row?.value) || 0;
}

async function setLastPullAt(ts) {
  await db.settings.put({ key: LAST_PULL_AT_KEY, value: ts });
}

export async function getLastPush() {
  const row = await db.settings.get(LAST_PUSH_KEY);
  return Number(row?.value) || 0;
}

async function setLastPush(ts) {
  await db.settings.put({ key: LAST_PUSH_KEY, value: ts });
}

/** Kirim semua item yang berubah sejak sinkron terakhir + pengaturan. */
export async function pushChanges() {
  if (!syncEnabled()) return { applied: 0, skipped: 0, offline: true };
  const since = await getLastPush();
  const dirty = await db.items.where("updatedAt").above(since).toArray();
  const settings = await getAllSettings();
  const payload = {
    items: await Promise.all(dirty.map(toWire)),
    settings: {
      shopName: settings.shopName,
      lowStockThreshold: settings.lowStockThreshold,
      brandOptions: settings.brandOptions,
      motorOptions: settings.motorOptions,
    },
  };
  const res = await api("/api/sync/push", { method: "POST", body: JSON.stringify(payload) });
  // Cursor push hanya maju setelah server menerima. Kalau pengiriman gagal,
  // cursor tidak berubah sehingga item yang sama dicoba lagi pada sinkron
  // berikutnya (mis. HP sempat offline saat menambah barang).
  const newest = dirty.reduce((m, it) => Math.max(m, Number(it.updatedAt || 0)), since);
  await setLastPush(newest);
  return res;
}

/** Tarik perubahan dari perangkat lain lalu simpan ke IndexedDB. */
export async function pullChanges() {
  if (!syncEnabled()) return { items: 0, offline: true };
  const since = await getLastPull();
  let cursor = since;
  let total = 0;
  let guard = 0;
  for (;;) {
    const res = await api(`/api/sync/pull?since=${cursor}`);
    for (const row of res.items || []) {
      const local = await db.items.get(row.id);
      // last-write-wins: jangan timpa perubahan lokal yang lebih baru
      if (local && Number(local.updatedAt || 0) > Number(row.updatedAt || 0)) continue;
      const item = await fromWire(row);
      if (item.deleted) {
        await db.items.delete(item.id);
        await db.priceHistory.where("itemId").equals(item.id).delete();
        await db.scanHistory.where("itemId").equals(item.id).delete();
      } else {
        await db.items.put(item);
      }
      total += 1;
    }
    if (res.settings) {
      for (const [key, value] of Object.entries(res.settings)) {
        if (["shopName", "lowStockThreshold", "brandOptions", "motorOptions"].includes(key)) {
          await db.settings.put({ key, value });
        }
      }
    }
    // Cursor memakai nomor urut server (`seq`), bukan timestamp perangkat.
    // Timestamp bisa berbeda antar HP/laptop sehingga perubahan bisa terlewat.
    if (typeof res.cursor === "number") cursor = Math.max(cursor, res.cursor);
    if (!res.more) break;
    guard += 1;
    if (guard > 40) break;
  }
  await setLastPull(cursor);
  await setLastPullAt(Date.now());
  return { items: total };
}

/** Sinkron penuh: tarik dulu, lalu kirim. */
export async function syncNow() {
  if (!syncEnabled()) return { ok: false, reason: "backend-not-configured" };
  try {
    const pulled = await pullChanges();
    const pushed = await pushChanges();
    return { ok: true, pulled: pulled.items || 0, pushed: pushed.applied || 0, skipped: pushed.skipped || 0 };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function syncStatus() {
  if (!syncEnabled()) return { enabled: false };
  try {
    const res = await api("/api/sync/stats");
    return { enabled: true, online: true, ...res, lastPull: await getLastPullAt() };
  } catch (e) {
    return { enabled: true, online: false, error: e.message, lastPull: await getLastPullAt() };
  }
}
