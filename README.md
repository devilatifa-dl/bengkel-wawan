# Bengkel & Toko Sparepart Motor — PWA + Sinkron Antar Perangkat

**Live:** https://bengkel-umber.vercel.app
**Repo:** https://github.com/devilatifa-dl/bengkel-wawan

Aplikasi bengkel & toko sparepart motor yang tetap **jalan offline** di HP, tapi
datanya **tersinkron otomatis** ke server. Barang yang ditambah di HP langsung
muncul di laptop, dan sebaliknya.

## Fitur
- **Scan Barang**: kamera belakang / galeri → OCR (Tesseract.js) + pengenalan foto (TensorFlow.js MobileNet) → harga jual langsung tampil
- **Harga Modal & Untung** disembunyikan di balik ikon mata
- **Cetak Label Harga**: 3 ukuran (50x25, 64x34, 90x50 mm) → Cetak atau Unduh PDF
- **Sinkron Antar Perangkat**: HP ↔ laptop, otomatis tiap 15 detik + tombol manual
- **Backup / Restore JSON** untuk cadangan tambahan
- **PWA installable**: "Tambah ke Layar Utama", jalan tanpa internet
- **Tampilan adaptif**: sidebar di desktop, bottom-nav di HP

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
| Hosting | Vercel — satu project untuk frontend + API, auto-deploy tiap `git push` |

## Cara kerja sinkronisasi
1. Semua perubahan disimpan dulu ke IndexedDB — aplikasi tetap responsif walau internet mati.
2. Setiap 15 detik (juga saat app dibuka, setelah simpan barang, saat kembali online,
   saat tab difokuskan) aplikasi menarik perubahan dari server lalu mengirim perubahan lokal.
3. Konflik diselesaikan dengan **last-write-wins** berdasarkan `updatedAt`.
4. Cursor tarik data memakai **nomor urut server (`seq`)**, bukan timestamp perangkat,
   sehingga jam HP dan laptop yang berbeda tidak membuat data terlewat.
5. Hapus barang memakai **soft delete** (`deleted: true`) supaya penghapusan ikut tersinkron.

Detail lengkap ada di [SYNC.md](./SYNC.md).

## Menjalankan lokal
```bash
cd frontend
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

Untuk pengembangan lokal, jalankan frontend dengan proxy ke backend atau isi
`REACT_APP_BACKEND_URL=http://127.0.0.1:8001` di `frontend/.env`.
Di produksi variabel itu **tidak dipakai** karena API satu domain.

## Deploy
Auto-deploy sudah aktif: **setiap `git push` ke `main` otomatis build & deploy**
ke Vercel. Tidak perlu perintah deploy manual.

Kalau perlu deploy manual (misal darurat), jalankan `deploy.bat`.

Panduan lengkap: [DEPLOY.md](./DEPLOY.md) · [AUTO-DEPLOY.md](./AUTO-DEPLOY.md)

## Struktur
```
Bengkel/
├── api/index.py       # entry point Vercel → backend/server.py
├── backend/           # API sinkronisasi (FastAPI + MongoDB)
│   └── server.py      # /api/health, /api/sync/pull, /api/sync/push, /api/sync/stats
├── frontend/          # aplikasi PWA (React)
│   ├── public/        # ikon, model AI (18 MB), service worker
│   └── src/           # lib/ (db, sync, ai, match, labels, backup), pages/, components/
├── vercel.json        # konfigurasi build + rewrite
├── requirements.txt   # dependensi Python untuk Vercel
└── scripts/           # generator ikon & gambar contoh
```

## Catatan penting
- Kamera hanya aktif di **HTTPS** atau `localhost`.
- Data tetap aman di HP walau server mati — aplikasi beralih ke mode offline.
- Database `bengkel` di MongoDB Atlas terpisah dari project perpus.
