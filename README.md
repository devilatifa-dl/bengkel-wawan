# Bengkel & Toko Sparepart Motor — PWA + Sinkron Antar Perangkat

**Live:** https://bengkel-umber.vercel.app
**Backend:** https://backend-phi-ashen-16.vercel.app/api/health
**Repo:** https://github.com/devilatifa-dl/bengkel-wawan

Aplikasi bengkel & toko sparepart motor yang tetap **jalan offline** di HP, tapi datanya
**tersinkron otomatis** ke server. Barang yang ditambah di HP langsung muncul di laptop,
dan sebaliknya.

## Fitur
- **Scan Barang**: kamera belakang / galeri → OCR (Tesseract.js) + pengenalan foto (TensorFlow.js MobileNet) → harga jual langsung tampil
- **Harga Modal & Untung** disembunyikan di balik ikon mata
- **Cetak Label Harga**: 3 ukuran (50x25, 64x34, 90x50 mm) → Cetak atau Unduh PDF
- **Sinkron Antar Perangkat**: HP ↔ laptop, otomatis tiap 30 detik + tombol manual
- **Backup / Restore JSON** untuk cadangan tambahan
- **PWA installable**: "Tambah ke Layar Utama", jalan tanpa internet

## Teknologi
| Bagian | Teknologi |
|---|---|
| UI | React 19, Tailwind CSS, shadcn/ui, lucide-react |
| Database lokal | Dexie 4 (IndexedDB) — sumber kebenaran, offline-first |
| OCR offline | tesseract.js 5 (model di-host sendiri) |
| AI foto offline | TensorFlow.js 4 + MobileNet v2 |
| PDF label | jsPDF |
| PWA | manifest.json + service worker sendiri |
| Backend | FastAPI + MongoDB Atlas (database `bengkel`) |
| Hosting | Vercel (frontend + backend), auto-deploy tiap `git push` |

## Cara kerja sinkronisasi
1. Semua perubahan disimpan dulu ke IndexedDB — aplikasi tetap responsif walau internet mati.
2. Setiap 30 detik (juga saat app dibuka, saat kembali online, saat tab difokuskan) aplikasi
   menarik perubahan dari server lalu mengirim perubahan lokal.
3. Konflik diselesaikan dengan **last-write-wins** berdasarkan `updatedAt`.
4. Hapus barang memakai **soft delete** (`deleted: true`) supaya penghapusan ikut tersinkron.

Detail lengkap ada di [SYNC.md](./SYNC.md).

## Menjalankan lokal
```bash
cd frontend
cp .env.example .env      # isi REACT_APP_BACKEND_URL
yarn install
yarn start                # http://localhost:3000
```

Backend lokal:
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env      # isi MONGO_URL
python -m uvicorn server:app --host 127.0.0.1 --port 8001
```

## Deploy
Auto-deploy sudah aktif: **setiap `git push` ke `main` otomatis build & deploy** ke Vercel
(frontend dan backend sekaligus). Tidak perlu perintah deploy manual.

Kalau perlu deploy manual (misal darurat), jalankan `deploy.bat`.

Panduan lengkap: [DEPLOY.md](./DEPLOY.md) · [AUTO-DEPLOY.md](./AUTO-DEPLOY.md)

## Struktur
```
Bengkel/
├── frontend/          # aplikasi PWA (React)
│   ├── public/        # ikon, model AI (18 MB), service worker
│   └── src/           # lib/ (db, sync, ai, match, labels, backup), pages/, components/
├── backend/           # API sinkronisasi (FastAPI + MongoDB)
│   ├── server.py      # /api/health, /api/sync/pull, /api/sync/push, /api/sync/stats
│   └── api/index.py   # entry point Vercel
├── scripts/           # generator ikon & gambar contoh
└── PROJECT_CONTEXT.md # dokumentasi teknis lengkap
```

## Catatan penting
- Kamera hanya aktif di **HTTPS** atau `localhost`.
- Data tetap aman di HP walau server mati — aplikasi beralih ke mode offline.
- Database `bengkel` di MongoDB Atlas terpisah dari project perpus.
