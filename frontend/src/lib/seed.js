import { db, getSetting, setSetting, saveItem } from "./db";

const SAMPLES = [
  { key: "kampas-rem", name: "Kampas Rem Depan", partCode: "06455-KVB-305", brand: "Honda AHM", compatibility: "Beat, Vario 110, Scoopy", costPrice: 35000, sellPrice: 55000, stock: 12 },
  { key: "oli-mpx2", name: "Oli Mesin Matic MPX2 0.8L", partCode: "MPX2-08", brand: "AHM Oil", compatibility: "Beat, Vario, Scoopy, Genio", costPrice: 42000, sellPrice: 55000, stock: 24 },
  { key: "busi-ngk", name: "Busi NGK CPR7EA-9", partCode: "CPR7EA-9", brand: "NGK", compatibility: "Beat, Vario, Mio, Supra X 125", costPrice: 15000, sellPrice: 25000, stock: 2 },
  { key: "seal-shock", name: "Seal Shock Depan", partCode: "5TL-F3145-00", size: "26 x 37 x 10.5", brand: "Yamaha YGP", compatibility: "Mio, Mio Sporty, Mio Soul", costPrice: 18000, sellPrice: 30000, stock: 6 },
  { key: "vbelt-vario", name: "V-Belt Vario 125/150", partCode: "23100-K35-V01", brand: "Honda AHM", compatibility: "Vario 125, Vario 150, PCX", costPrice: 95000, sellPrice: 135000, stock: 3 },
  { key: "rantai-federal", name: "Rantai 428H-104L", partCode: "FCC-428H", brand: "Federal", compatibility: "Supra X 125, Revo, Jupiter Z", costPrice: 70000, sellPrice: 98000, stock: 5 },
];

let seeding = null;

export function seedIfNeeded() {
  if (seeding) return seeding;
  seeding = (async () => {
    const seeded = await getSetting("seeded");
    if (seeded) {
      // one-time patch: give the sample seal its size (added in v1.1)
      const seal = await db.items.where("isSample").equals(1).filter((i) => i.partCode === "5TL-F3145-00" && !i.size).first();
      if (seal) await db.items.update(seal.id, { size: "26 x 37 x 10.5" });
      return false;
    }
    const count = await db.items.count();
    if (count > 0) {
      await setSetting("seeded", true);
      return false;
    }
    for (const s of SAMPLES) {
      let photo = null;
      try {
        const res = await fetch(`/samples/${s.key}.jpg`);
        if (res.ok) photo = await res.blob();
      } catch (e) {
        photo = null;
      }
      const { key, ...data } = s;
      await saveItem({ ...data, photo, isSample: true });
    }
    await setSetting("seeded", true);
    return true;
  })();
  return seeding;
}

export async function removeSamples() {
  const samples = await db.items.where("isSample").equals(1).toArray();
  const ids = samples.map((s) => s.id);
  await db.transaction("rw", db.items, db.priceHistory, db.scanHistory, async () => {
    await db.items.bulkDelete(ids);
    await db.priceHistory.where("itemId").anyOf(ids).delete();
    await db.scanHistory.where("itemId").anyOf(ids).delete();
  });
  return ids.length;
}
