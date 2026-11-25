# Panduan Deploy

> **Status: SUDAH LIVE** — https://bengkel-umber.vercel.app
> Auto-deploy aktif — lihat [AUTO-DEPLOY.md](./AUTO-DEPLOY.md).

Arsitektur: **offline-first + sinkron**. Data utama di HP (IndexedDB), server
menyimpan salinan supaya HP dan laptop melihat isi yang sama.

---

## Arsitektur

```
HP / Laptop (React PWA)
   │  IndexedDB  ← sumber kebenaran, tetap jalan tanpa internet
   │
   ├── push/pull tiap 15 detik ──► Vercel Function (FastAPI)
   │                                    │
   └── service worker cache           └──► MongoDB Atlas (database `bengkel`)
```

| Komponen | Host | Biaya |
|---|---|---|
| Frontend + API | Vercel — satu project `bengkel` | Gratis |
| Database | MongoDB Atlas M0 | Gratis |
| Model AI (18 MB) | ikut di bundle frontend | Gratis |

---

## Deploy otomatis (jalur utama)

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

Vercel otomatis build & deploy. Selesai.

---

## Deploy manual (cadangan)

### Ke Vercel
```bash
vercel --prod
```

### Frontend ke Cloudflare Pages
```bat
deploy.bat
```
Atau:
```bash
cd frontend
yarn build
npx wrangler pages deploy build --project-name bengkel-wawan
```

Catatan: situs Cloudflare hanya statis — **tidak** punya API sinkronisasi.

---

## Variabel lingkungan

Diatur di dashboard Vercel (Settings → Environment Variables):

| Variabel | Nilai |
|---|---|
| `MONGO_URL` | connection string MongoDB Atlas |
| `DB_NAME` | `bengkel` |
| `CORS_ORIGINS` | `*` |
| `CI` | `false` |
| `GENERATE_SOURCEMAP` | `false` |
| `NODE_VERSION` | `20` |

`REACT_APP_BACKEND_URL` **tidak diperlukan** di produksi karena frontend dan API
berada di domain yang sama. Variabel itu hanya dipakai saat pengembangan lokal.

---

## Setelah deploy — checklist

### 1. Pasang di HP
- Buka https://bengkel-umber.vercel.app di **Chrome Android**
- Menu ⋮ → **Instal aplikasi**
- Ikon muncul di home screen

### 2. Tunggu AI siap (sekali saja)
Model AI (~18 MB) diunduh dan disimpan ke cache. Cek di **Pengaturan**:
- Mode offline (Service Worker) → aktif
- Model AI tersimpan di HP → aktif
- AI pengenal foto → Aktif
- AI pembaca teks → Aktif

### 3. Pastikan sinkronisasi jalan
**Pengaturan → Sinkron Antar Perangkat** harus menampilkan **Terhubung**.
Tekan **Sinkronkan Sekarang** sekali untuk tarik data awal.

### 4. Hapus data contoh
**Pengaturan → Data Contoh → Hapus Semua Data Contoh**, lalu isi barang asli.

### 5. Backup tetap rutin
Sinkronisasi bukan pengganti backup. Lakukan **Pengaturan → Export Backup (JSON)**
secara berkala.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| API 500 `ModuleNotFoundError` | Pastikan `requirements.txt` ada di **root** repo |
| API 404 di semua route | `vercel.json` harus punya rewrite `/api/(.*)` → `/api/index` |
| Panel sinkron "Tidak terhubung" | Cek `/api/health`; pastikan `MONGO_URL` terpasang di Vercel |
| Data tidak muncul di perangkat lain | Tekan **Sinkronkan Sekarang** di kedua perangkat |
| Barang contoh menumpuk duplikat | Seed hanya jalan bila server kosong; hapus duplikat lewat Pengaturan |
| Kamera tidak muncul | Wajib HTTPS atau `localhost` |
| Halaman 404 saat refresh | `vercel.json` harus punya rewrite ke `/index.html` |
| AI lambat pertama kali | Normal — mengunduh 18 MB model. Berikutnya instan dari cache |
| Tampilan lama masih muncul | Service worker cache. Naikkan `VERSION` di `frontend/public/sw.js` |
