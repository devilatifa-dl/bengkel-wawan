"""API sinkronisasi Bengkel & Toko Sparepart Motor.

Aplikasi tetap offline-first: data utama disimpan di IndexedDB HP/laptop.
Endpoint di sini hanya menyimpan salinan terpusat agar beberapa perangkat
(HP + laptop) melihat data yang sama.

Dua konsep terpisah:
- `updatedAt` (epoch ms dari perangkat) dipakai untuk last-write-wins.
- `seq` (nomor urut dari server) dipakai sebagai cursor tarik data.

Memakai `updatedAt` sebagai cursor bermasalah karena jam HP dan laptop bisa
berbeda: item dari HP yang jamnya lebih lambat akan punya `updatedAt` kecil
dan terlewat selamanya. `seq` selalu naik di server sehingga tidak mungkin
ada perubahan yang terlewat.

Item yang dihapus memakai soft delete (`deleted: true`) agar penghapusan
ikut tersinkron ke perangkat lain.
"""
import os
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ.get("MONGO_URL", "")
DB_NAME = os.environ.get("DB_NAME", "bengkel")

client: Optional[AsyncIOMotorClient] = None
db = None
if MONGO_URL:
    client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=8000)
    db = client[DB_NAME]

logger = logging.getLogger("bengkel")

SEQ_ID = "items"


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


async def next_seq(count: int = 1) -> int:
    """Ambil blok nomor urut baru. Selalu naik, tidak pernah mundur."""
    doc = await db.counters.find_one_and_update(
        {"_id": SEQ_ID},
        {"$inc": {"value": count}},
        upsert=True,
        return_document=True,
    )
    return int(doc["value"])


async def backfill_seq() -> None:
    """Beri `seq` pada dokumen lama yang belum punya, urut berdasarkan updatedAt."""
    missing = await db.items.count_documents({"seq": {"$exists": False}})
    if not missing:
        return
    rows = await db.items.find({"seq": {"$exists": False}}, {"_id": 1}).sort("updatedAt", 1).to_list(5000)
    if not rows:
        return
    start = await next_seq(len(rows))
    base = start - len(rows)
    for i, row in enumerate(rows):
        await db.items.update_one({"_id": row["_id"]}, {"$set": {"seq": base + i + 1}})
    logger.info("Backfill seq untuk %s item lama", len(rows))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if db is not None:
        try:
            await db.items.create_index("id", unique=True)
            await db.items.create_index("updatedAt")
            await db.items.create_index("seq")
            await db.settings.create_index("key", unique=True)
            await backfill_seq()
            logger.info("Index siap pada database %s", DB_NAME)
        except Exception as exc:  # jangan gagalkan boot karena index
            logger.error("Gagal membuat index: %s", exc)
    yield
    if client is not None:
        client.close()


app = FastAPI(title="Bengkel Sparepart Sync API", lifespan=lifespan)
api = APIRouter(prefix="/api")


class ItemIn(BaseModel):
    id: Any  # Dexie memakai angka; disimpan sebagai string
    name: str = ""
    partCode: str = ""
    brand: str = ""
    size: str = ""
    compatibility: str = ""
    costPrice: float = 0
    sellPrice: float = 0
    stock: Optional[float] = None
    photo: Optional[str] = None          # data URL (base64) atau null
    ocrTokens: Optional[List[str]] = None
    ocrSizes: Optional[List[List[float]]] = None
    ocrAt: Optional[int] = None
    isSample: int = 0
    createdAt: Optional[int] = None
    lastCheckedAt: Optional[int] = None
    updatedAt: int = 0
    deleted: bool = False


class PushIn(BaseModel):
    items: List[ItemIn] = Field(default_factory=list)
    settings: Dict[str, Any] = Field(default_factory=dict)


def require_db():
    if db is None:
        raise HTTPException(503, "Database belum dikonfigurasi (MONGO_URL kosong)")


def norm_code(value: Any) -> str:
    return "".join(str(value or "").upper().split())


def norm_name(value: Any) -> str:
    return " ".join(str(value or "").upper().split())


def twin_key(doc: Dict[str, Any]) -> str:
    """Kunci identitas barang: kode part + nama + merek.

    Ketiganya dibutuhkan supaya tidak salah menggabungkan barang berbeda:
    - "Ban Dalam 17/250" vs "Ban Luar Trial 17/250" (nama beda)
    - "Membran/Kran Bensin 2006" merek Kinto vs Macho (merek beda)
    """
    name = norm_name(doc.get("name"))
    if not name:
        return ""
    code = norm_code(doc.get("partCode"))
    brand = norm_name(doc.get("brand"))
    return f"{code}|{name}|{brand}"


async def find_twin(doc: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Cari barang aktif lain yang benar-benar sama (kode part + nama)."""
    key = twin_key(doc)
    if not key:
        return None
    async for row in db.items.find(
        {"deleted": {"$ne": True}, "id": {"$ne": doc["id"]}},
        {"_id": 0, "id": 1, "updatedAt": 1, "partCode": 1, "name": 1, "brand": 1},
    ):
        if twin_key(row) == key:
            return row
    return None


@api.get("/")
async def root():
    return {"message": "API sinkronisasi Bengkel & Toko Sparepart Motor"}


@api.get("/health")
async def health():
    ok = False
    if db is not None:
        try:
            await db.command("ping")
            ok = True
        except Exception:
            ok = False
    return {"ok": ok, "db": DB_NAME if db is not None else None, "ts": now_ms()}


@api.get("/sync/pull")
async def pull(since: int = Query(0, ge=0), limit: int = Query(500, ge=1, le=2000)):
    """Ambil item dengan `seq` > `since` + semua pengaturan.

    `since` adalah nomor urut server, bukan timestamp, sehingga perubahan dari
    perangkat yang jamnya berbeda tetap ikut tertarik.
    """
    require_db()
    rows = (
        await db.items.find({"seq": {"$gt": since}}, {"_id": 0})
        .sort("seq", 1)
        .limit(limit)
        .to_list(limit)
    )
    settings = {}
    async for s in db.settings.find({}, {"_id": 0}):
        settings[s["key"]] = s.get("value")
    return {
        "items": rows,
        "settings": settings,
        "serverTime": now_ms(),
        "cursor": int(rows[-1]["seq"]) if rows else since,
        "more": len(rows) == limit,
    }


@api.post("/sync/push")
async def push(payload: PushIn):
    """Simpan perubahan lokal. Item dengan updatedAt lebih lama diabaikan (last-write-wins)."""
    require_db()
    applied = 0
    skipped = 0
    merged = 0
    for item in payload.items:
        doc = item.model_dump()
        doc["id"] = str(doc.get("id"))
        doc["serverAt"] = now_ms()
        existing = await db.items.find_one({"id": doc["id"]}, {"_id": 0, "updatedAt": 1})
        if existing and int(existing.get("updatedAt") or 0) > int(doc.get("updatedAt") or 0):
            skipped += 1
            continue
        # Pengaman terakhir: kalau perangkat lain sudah punya barang dengan kode
        # part (atau nama) yang sama, jangan buat baris baru. Arahkan ke baris
        # yang sudah ada supaya daftar tidak menumpuk duplikat.
        if not existing and not doc.get("deleted"):
            twin = await find_twin(doc)
            if twin:
                doc["id"] = twin["id"]
                if int(twin.get("updatedAt") or 0) > int(doc.get("updatedAt") or 0):
                    skipped += 1
                    continue
                merged += 1
        # Setiap tulisan yang diterima dapat nomor urut baru supaya perangkat
        # lain pasti melihatnya pada tarikan berikutnya.
        doc["seq"] = await next_seq()
        await db.items.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
        applied += 1
    for key, value in (payload.settings or {}).items():
        await db.settings.update_one({"key": key}, {"$set": {"key": key, "value": value}}, upsert=True)
    return {"applied": applied, "skipped": skipped, "merged": merged, "serverTime": now_ms()}


@api.get("/sync/stats")
async def stats():
    require_db()
    total = await db.items.count_documents({"deleted": {"$ne": True}})
    deleted = await db.items.count_documents({"deleted": True})
    counter = await db.counters.find_one({"_id": SEQ_ID})
    return {
        "items": total,
        "deleted": deleted,
        "cursor": int((counter or {}).get("value") or 0),
        "serverTime": now_ms(),
    }


@api.post("/sync/dedupe")
async def dedupe():
    """Hapus barang ganda yang sudah terlanjur masuk.

    Barang dianggap sama hanya bila **kode part, nama, dan merek** sama. Yang
    dipertahankan adalah baris dengan `updatedAt` terbaru.
    """
    require_db()
    groups: Dict[str, List[Dict[str, Any]]] = {}
    async for row in db.items.find(
        {"deleted": {"$ne": True}}, {"_id": 0, "id": 1, "name": 1, "partCode": 1, "brand": 1, "updatedAt": 1}
    ):
        key = twin_key(row)
        if not key:
            continue
        groups.setdefault(key, []).append(row)

    removed = 0
    for rows in groups.values():
        if len(rows) < 2:
            continue
        rows.sort(key=lambda r: int(r.get("updatedAt") or 0), reverse=True)
        for dup in rows[1:]:
            await db.items.update_one(
                {"id": dup["id"]},
                {"$set": {"deleted": True, "seq": await next_seq(), "serverAt": now_ms()}},
            )
            removed += 1
    return {"removed": removed, "remaining": await db.items.count_documents({"deleted": {"$ne": True}})}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
