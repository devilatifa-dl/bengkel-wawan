# PROJECT_CONTEXT — Bengkel & Toko Sparepart Motor (Offline PWA)

Dokumen ini dibuat untuk melanjutkan proyek di workspace baru. Snapshot dibuat: 23 Nov 2026.

## 1. Fungsi aplikasi
Progressive Web App (bisa di-install ke HP via "Tambah ke Layar Utama") untuk bengkel & toko sparepart motor.
Berjalan **100% offline**. Semua data (barang, foto, riwayat harga, riwayat scan, pengaturan) disimpan **di browser HP (IndexedDB)**, bukan di server.

Alur inti: **Scan Barang** (kamera belakang / foto galeri) → AI di HP membaca teks label (OCR) + mengenali foto → cocokkan dengan stok lokal → tampil **Harga Jual besar**; Harga Modal & Untung disembunyikan (ikon mata). Jika tidak ketemu → "Tambah Sebagai Barang Baru" dengan foto, kode part, dan ukuran terisi otomatis.

## 2. Teknologi
| Bagian | Teknologi |
|---|---|
| Frontend | React 19 (CRA + craco), Tailwind CSS, shadcn/ui (Radix), lucide-react, sonner, vaul (drawer), react-router-dom 7 |
| Database lokal | IndexedDB via **Dexie 4** + dexie-react-hooks (`src/lib/db.js`) |
| OCR offline | **tesseract.js 5** — worker/core/`eng.traineddata.gz` di-host sendiri di `frontend/public/models/tesseract/` |
| AI foto offline | **TensorFlow.js 4** + `@tensorflow-models/mobilenet` (MobileNet v2 0.5) — model di `frontend/public/models/mobilenet/` |
| PDF label | **jsPDF** (`src/lib/labels.js`) |
| PWA | `public/manifest.json` + Service Worker buatan sendiri `public/sw.js` (cache shell + model AI) |
| Font | @fontsource/space-grotesk (di-bundle, tanpa CDN) |
| Backend | FastAPI template (`backend/server.py`) + MongoDB (motor). **Tidak dipakai oleh fitur aplikasi.** |

## 3. Fitur yang sudah selesai
- PWA installable + offline penuh (service worker `v1.2.0`, cache `models-v2` untuk ~19 MB file AI).
- Dashboard (Beranda): Total Jenis Barang, Potensi Keuntungan & Nilai Stok (disamarkan), Stok Menipis, Terakhir Dicek, banner pasang aplikasi.
- Scan Kamera AI: kamera belakang (getUserMedia) + lampu kilat (jika didukung) + galeri. OCR 2 lintasan paralel (PSM 3 + PSM 11, gambar di-upscale ~2000px) + embedding MobileNet.
- Mesin pencocokan `src/lib/match.js` (perbaikan bug "Seal As Kickstarter tampil Seal As Versnelling"):
  - bobot IDF (kata template yang sama di banyak label bernilai kecil),
  - kode part fuzzy tahan salah-baca OCR (O/0, S/5, Z/2, …),
  - deteksi ukuran (mis. `16 X 28 X 7`, `11,6 X 22 X 7`), penalti jika kode/ukuran berbeda,
  - jalur cepat foto hanya bila foto benar-benar unik + verifikasi teks di latar belakang (koreksi otomatis),
  - panel **"Pilih barang yang benar"** saat ambigu; pilihan user dipelajari (`learnFromScan`).
  - Teks label dari foto barang disimpan (`ocrTokens`, `ocrSizes`) saat simpan + indexer latar belakang (`src/lib/indexer.js`).
- Cari Manual: nama / kode / merk / kecocokan motor / ukuran, chip motor.
- Kartu Harga (overlay): foto, nama, kode, ukuran, merk, kecocokan, Harga Jual besar, Modal/Untung di balik ikon mata, alasan cocok, kandidat lain.
- Form barang: foto (kamera/galeri, dikompres 1024px), Nama, Kode Part, **Ukuran** (Dalam × Luar × Tebal, otomatis muncul untuk seal/karet/o-ring/bearing), Merk, Kecocokan Motor (chip), Harga Modal/Jual (format Rp), kalkulator Untung & Margin realtime, Stok opsional, auto-isi kode/ukuran dari OCR foto.
- Detail barang: stok +/-, riwayat harga, hapus, cetak label.
- **Cetak Label Harga** (`/label`): 3 ukuran (50×25, 64×34, 90×50 mm, A4), jumlah salinan, nama toko/kecocokan opsional, **Cetak** (window.print) & **Unduh PDF** (jsPDF), Bagikan PDF.
- Pengaturan: nama toko, batas stok menipis global (default 3), **daftar Merk & Motor bisa ditambah/dihapus**, Backup JSON (export / bagikan), Restore (ganti / gabung), hapus data contoh, hapus semua data, status offline & AI.
- 6 data contoh bertanda "Contoh" (gambar sampel di `public/samples/`, dibuat oleh `scripts/gen_assets.py`).

## 4. Struktur proyek
```
/app
├── PROJECT_CONTEXT.md        ← dokumen ini
├── plan.md                   ← rencana & status fase
├── design_guidelines.md      ← panduan desain (warna #0F172A/#1E293B/#06B6D4/#F59E0B)
├── scripts/gen_assets.py     ← generator ikon PWA & gambar contoh (Pillow)
├── test_reports/             ← hasil uji otomatis (iteration_1..3.json)
├── backend/                  ← FastAPI template (server.py, requirements.txt, .env.example)
└── frontend/
    ├── package.json, yarn.lock, craco.config.js, tailwind.config.js, jsconfig.json, components.json
    ├── plugins/health-check/          (plugin dev bawaan template)
    ├── public/
    │   ├── index.html, manifest.json, sw.js, favicon.png
    │   ├── icons/      (ikon PWA 192/512/maskable/apple)
    │   ├── samples/    (6 gambar data contoh)
    │   └── models/
    │       ├── tesseract/  (worker.min.js, tesseract-core-*-lstm.wasm.js, eng.traineddata.gz)
    │       └── mobilenet/  (model.json + 2 shard .bin)
    └── src/
        ├── index.js, index.css (tema + CSS cetak), App.js (routing + seed + warmup AI)
        ├── lib/   ai.js, match.js, db.js, seed.js, indexer.js, backup.js, labels.js,
        │          image.js, format.js, pwa.js, aiStatus.js, draft.js, hooks.js, utils.js
        ├── components/  BottomNav, PageHeader, PriceOverlay, ItemCard, ItemThumb, MoneyInput,
        │                Masked, SizeInput, OptionsEditor, ui/ (shadcn)
        └── pages/  Dashboard, Scan, Inventory, ItemForm, ItemDetail, Labels, Settings
```
Rute: `/` Beranda • `/scan` Kamera AI • `/cari` Cari manual • `/barang` Daftar • `/barang/baru` • `/barang/:id` • `/barang/:id/edit` • `/label` • `/pengaturan`.

Skema IndexedDB (Dexie, db `bengkel_sparepart_db`, versi 1):
- `items`: `++id, name, partCode, brand, updatedAt, lastCheckedAt, isSample` (+ field non-index: size, compatibility, costPrice, sellPrice, stock, photo(Blob), embedding, ocrTokens, ocrSizes, ocrAt, createdAt)
- `priceHistory`: `++id, itemId, at` • `scanHistory`: `++id, itemId, at` • `settings`: `key` (shopName, lowStockThreshold, brandOptions, motorOptions, seeded, lastBackupAt)

## 5. Integrasi
- **Tidak ada integrasi pihak ketiga / API key.** Tidak ada login. Semua AI berjalan di perangkat (Tesseract.js + TensorFlow.js), file model di-host sendiri.
- Skrip analitik bawaan Emergent (`assets.emergent.sh`, posthog) ada di `public/index.html`; aman dihapus bila pindah platform.

## 6. Database & deployment (untuk pemulihan)
### MongoDB
- Backend template membaca `MONGO_URL` dan `DB_NAME` dari `backend/.env` (lihat `backend/.env.example`). Di workspace Emergent, MongoDB berjalan lokal di container.
- **Fitur aplikasi tidak menyimpan data apa pun di MongoDB.** Tidak ada koleksi berisi data bisnis yang perlu dipindahkan. Data pengguna ada di HP masing-masing → amankan lewat **Pengaturan → Export Backup (JSON)** dan pulihkan lewat **Import / Restore Backup**.
- Nilai asli `.env` TIDAK disertakan di ZIP (rahasia/khusus lingkungan).

### Railway
- **Belum ada konfigurasi Railway di proyek ini** (tidak ada railway.json / Procfile / nixpacks.toml). Saat ini aplikasi berjalan di preview Emergent.
- Cara deploy ke Railway (cukup frontend statis, karena aplikasi tidak butuh backend):
  1. Root directory: `frontend`
  2. Build command: `yarn install --frozen-lockfile && yarn build`
  3. Start command: `npx serve -s build -l $PORT` (tambahkan `serve` sebagai dependency, atau gunakan static hosting lain: Netlify/Vercel/Cloudflare Pages dengan output `build`).
  4. Env: `REACT_APP_BACKEND_URL` (boleh URL apa saja; tidak dipakai fitur), `ENABLE_HEALTH_CHECK=false`.
  5. Wajib HTTPS (kamera & service worker hanya jalan di HTTPS).
- Jika ingin ikut men-deploy backend template: service kedua dengan root `backend`, start `uvicorn server:app --host 0.0.0.0 --port $PORT`, env `MONGO_URL`, `DB_NAME`, `CORS_ORIGINS` (pakai plugin MongoDB Railway). Catatan: `requirements.txt` memuat `emergentintegrations` dari index privat Emergent — hapus baris itu bila install gagal (tidak dipakai).

## 7. Status pekerjaan
- Fase 1 (POC OCR + AI foto offline): selesai.
- Fase 2 (aplikasi V1): selesai & teruji (iteration_1: 100%).
- Fase 3a (label harga, ukuran seal, daftar merk/motor): selesai & teruji (iteration_2: 100%).
- Fase 3b (akurasi scan label mirip): diperbaiki; uji iteration_3: 6/6 scan label Zunagawa benar.
- **Catatan terbuka (prioritas rendah)** dari iteration_3: (1) scan gambar contoh `samples/seal-shock.jpg` pernah cocok ke "Kampas Rem Depan" — perlu dicek ulang setelah mesin pencocokan baru; (2) OCR kadang salah baca kode pada foto buram (mis. ZGOSH53) — pencocokan tetap benar via teks/foto lain.
- Belum diuji: kamera langsung di HP sungguhan & cetak ke printer fisik (headless tidak punya kamera/printer).

## 8. Menjalankan di workspace baru
```bash
unzip project-backup.zip -d app && cd app
# Frontend
cd frontend && cp .env.example .env && yarn install && yarn start      # http://localhost:3000
# (opsional) Backend template
cd ../backend && cp .env.example .env && pip install fastapi uvicorn motor python-dotenv && uvicorn server:app --port 8001
# Regenerasi ikon/gambar contoh bila perlu
python3 scripts/gen_assets.py
```
Gunakan **yarn** (bukan npm). Kamera butuh HTTPS atau `localhost`.
File model AI sudah termasuk di `frontend/public/models/`; jika hilang, salin dari `node_modules/tesseract.js/dist/worker.min.js`, `node_modules/tesseract.js-core/*lstm.wasm.js`, unduh `eng.traineddata.gz` (paket @tesseract.js-data/eng 4.0.0_best_int) dan MobileNet v2 050 (tfhub `google/tfjs-model/imagenet/mobilenet_v2_050_224/classification/3/default/1`).

## 9. Ide lanjutan
Tombol "Terjual" (kurangi stok), pencari seal berdasarkan diameter, antrian cetak ulang label saat harga berubah, pengingat backup mingguan.
