# Panduan Deploy Gratis Permanen ? Cloudflare Pages

> **Status: SUDAH LIVE** ? https://bengkel-wawan.pages.dev
> Project Cloudflare Pages: `bengkel-wawan` (akun latifadevii@gmail.com)
> Deploy berikutnya cukup: `cd frontend && yarn build && npx wrangler pages deploy build --project-name bengkel-wawan`

Aplikasi ini **tidak butuh server, database, atau API key**. Semua data tersimpan di HP pengguna (IndexedDB).
Artinya cukup hosting statis ? **gratis selamanya**.

---

## Kenapa Cloudflare Pages?

| | Cloudflare Pages | Netlify | Vercel |
|---|---|---|---|
| Bandwidth gratis | **Tanpa batas** | 100 GB/bulan | 100 GB/bulan |
| Build gratis | 500/bulan | 300 menit/bulan | 100 GB-jam |
| Ukuran file | 25 MB/file | 25 MB/file | 25 MB/file |
| HTTPS | Ya | Ya | Ya |
| Domain kustom | Ya | Ya | Ya |

Model AI kita 18 MB (7 file terbesar 4,2 MB) ? aman di semua platform, tapi Cloudflare paling lega karena bandwidth tanpa batas.

---

## Cara 1 ? Lewat Dashboard (paling mudah, tanpa terminal)

### Langkah 1: Push ke GitHub
```bash
cd "c:\Stiawan Dev\Project Perpus\Bengkel"
git remote add origin https://github.com/USERNAME/bengkel-wawan.git
git branch -M main
git push -u origin main
```

### Langkah 2: Hubungkan ke Cloudflare
1. Buka https://dash.cloudflare.com ? daftar gratis (cukup email)
2. Menu kiri: **Workers & Pages** ? tombol **Create**
3. Tab **Pages** ? **Connect to Git**
4. Izinkan Cloudflare akses GitHub ? pilih repo `bengkel-wawan`
5. Isi konfigurasi build:

   | Kolom | Nilai |
   |---|---|
   | Project name | `bengkel-wawan` |
   | Production branch | `main` |
   | Framework preset | `Create React App` |
   | Build command | `yarn build` |
   | Build output directory | `build` |
   | Root directory | `frontend` |

6. **Environment variables** (opsional):
   - `CI` = `false`
   - `GENERATE_SOURCEMAP` = `false`
   - `NODE_VERSION` = `20`

7. Klik **Save and Deploy** ? tunggu 2?4 menit

### Langkah 3: Selesai
URL otomatis: `https://bengkel-wawan.pages.dev`

Bisa diganti domain sendiri (gratis) di tab **Custom domains**.

---

## Cara 2 ? Lewat Terminal (wrangler)

```bash
cd "c:\Stiawan Dev\Project Perpus\Bengkel\frontend"
yarn build
npx wrangler pages deploy build --project-name bengkel-wawan
```

Pertama kali akan diminta login browser (gratis). Setelah itu deploy berikutnya cukup satu perintah.

---

## Setelah Deploy ? Wajib Dilakukan

### 1. Buka di HP dan pasang
- Buka URL di **Chrome Android**
- Menu ? ? **Instal aplikasi** / **Tambahkan ke Layar utama**
- Ikon muncul di home screen, aplikasi jalan seperti app native

### 2. Tunggu AI siap (sekali saja)
Saat pertama dibuka, aplikasi mengunduh & menyimpan model AI (~18 MB) ke cache HP.
Status di **Pengaturan ? Status Offline & Kamera AI** harus:
- Mode offline (Service Worker) ? aktif
- Model AI tersimpan di HP ? aktif
- AI pengenal foto ? Aktif
- AI pembaca teks ? Aktif

Setelah itu **bisa dipakai tanpa internet sama sekali**.

### 3. Hapus data contoh
**Pengaturan ? Data Contoh ? Hapus Semua Data Contoh**, lalu mulai isi barang asli.

### 4. Backup rutin
**Pengaturan ? Export Backup (JSON)** setiap minggu.
Data hanya ada di HP ? kalau HP hilang tanpa backup, data hilang.

---

## Penting: Data Ada di HP, Bukan di Server

| Yang perlu dipahami | Penjelasan |
|---|---|
| Ganti HP | Export Backup di HP lama ? Import di HP baru |
| Ganti browser | Data tidak pindah otomatis (IndexedDB per-browser) |
| Hapus data browser | Data ikut hilang ? selalu backup |
| Mode Incognito | Data hilang saat tab ditutup |
| Buka di laptop & HP | Dua database terpisah, tidak sinkron |

Ini konsekuensi dari desain **offline-first tanpa server** ? imbalannya: gratis selamanya, cepat, dan tetap jalan tanpa internet.

---

## Alternatif Hosting Gratis Lain

### Netlify
1. https://app.netlify.com ? **Add new site** ? **Import an existing project**
2. Pilih repo GitHub
3. Build command: `yarn build` ? Publish directory: `frontend/build`
4. Deploy

### Vercel
1. https://vercel.com/new ? import repo
2. **Root Directory**: `frontend`
3. Framework: Create React App (otomatis terdeteksi)
4. Deploy

### GitHub Pages
```bash
cd frontend
# tambahkan "homepage": "https://USERNAME.github.io/bengkel-wawan" di package.json
yarn build
npx gh-pages -d build
```

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Build gagal: `Cannot find module` | Pastikan **Root directory** = `frontend`, bukan root repo |
| Kamera tidak muncul | Wajib HTTPS. `localhost` juga boleh. HTTP biasa tidak bisa |
| Halaman 404 saat refresh | File `public/_redirects` harus ada di output build |
| AI lambat pertama kali | Normal ? mengunduh 18 MB model. Berikutnya instan dari cache |
| Service worker tidak aktif | Buka via HTTPS, tunggu 10 detik, refresh sekali |
| Data hilang setelah update | Data di IndexedDB tidak terhapus oleh deploy baru. Kecuali user hapus data browser |
