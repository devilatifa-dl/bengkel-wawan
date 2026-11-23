# Bengkel & Toko Sparepart Motor ? PWA Offline

**Live:** https://bengkel-wawan.pages.dev


Aplikasi bengkel & toko sparepart motor yang berjalan **100% offline** di HP.
Semua data (barang, foto, riwayat harga, pengaturan) disimpan di **IndexedDB browser** ? tidak ada server, tidak ada API key, tidak ada biaya bulanan.

## Fitur
- **Scan Barang**: kamera belakang / galeri ? OCR (Tesseract.js) + pengenalan foto (TensorFlow.js MobileNet) ? harga jual langsung tampil
- **Harga Modal & Untung** disembunyikan di balik ikon mata
- **Cetak Label Harga**: 3 ukuran (50x25, 64x34, 90x50 mm) ? Cetak atau Unduh PDF
- **Backup / Restore JSON** untuk memindahkan data antar HP
- **PWA installable**: "Tambah ke Layar Utama", jalan tanpa internet

## Teknologi
| Bagian | Teknologi |
|---|---|
| UI | React 19, Tailwind CSS, shadcn/ui, lucide-react |
| Database lokal | Dexie 4 (IndexedDB) |
| OCR offline | tesseract.js 5 (model di-host sendiri) |
| AI foto offline | TensorFlow.js 4 + MobileNet v2 |
| PDF label | jsPDF |
| PWA | manifest.json + service worker sendiri |

## Menjalankan lokal
```bash
cd frontend
cp .env.example .env
yarn install
yarn start          # http://localhost:3000
```

Build produksi:
```bash
yarn build          # hasil di frontend/build
```

## Deploy gratis permanen ? Cloudflare Pages
1. Buka https://dash.cloudflare.com ? **Workers & Pages** ? **Create** ? **Pages** ? **Connect to Git**
2. Pilih repository GitHub project ini
3. Isi konfigurasi build:
   - **Framework preset**: `Create React App`
   - **Build command**: `yarn build`
   - **Build output directory**: `build`
   - **Root directory**: `frontend`
4. Klik **Save and Deploy**

Cloudflare Pages gratis tanpa batas bandwidth dan mendukung HTTPS (wajib untuk kamera & service worker).

### Deploy manual (tanpa Git)
```bash
cd frontend
yarn build
npx wrangler pages deploy build --project-name bengkel-wawan
```

## Struktur
```
Bengkel/
??? frontend/          # aplikasi PWA (satu-satunya bagian yang di-deploy)
?   ??? public/        # ikon, model AI (18 MB), service worker, _redirects, _headers
?   ??? src/           # lib/ (db, ai, match, labels, backup), pages/, components/
??? backend/           # template FastAPI ? TIDAK dipakai fitur aplikasi
??? scripts/           # generator ikon & gambar contoh
??? PROJECT_CONTEXT.md # dokumentasi teknis lengkap
```

## Catatan penting
- **Data ada di HP masing-masing.** Pindah HP / ganti browser ? gunakan **Pengaturan ? Export Backup**, lalu **Restore** di HP baru.
- Kamera hanya aktif di **HTTPS** atau `localhost`.
- Folder `backend/` hanya template dan tidak diperlukan untuk menjalankan aplikasi.
