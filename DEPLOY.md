# Panduan Deploy

> **Status: SUDAH LIVE**
> - Aplikasi: https://bengkel-umber.vercel.app
> - API: https://backend-phi-ashen-16.vercel.app
> - Repo: https://github.com/devilatifa-dl/bengkel-wawan
>
> Auto-deploy aktif — lihat [AUTO-DEPLOY.md](./AUTO-DEPLOY.md).

Arsitektur: **offline-first + sinkron**. Data utama di HP (IndexedDB), server hanya
menyimpan salinan supaya HP dan laptop melihat isi yang sama.

---

## Arsitektur

```
HP / Laptop (React PWA)
   │  IndexedDB  ← sumber kebenaran, tetap jalan tanpa internet
   │
   ├── push/pull tiap 30 detik ──► Vercel Function (FastAPI)
   │                                    │
   └── service worker cache           └──► MongoDB Atlas (database `bengkel`)
```

| Komponen | Host | Biaya |
|---|---|---|
| Frontend (React PWA) | Vercel — project `bengkel` | Gratis |
| Backend (FastAPI) | Vercel — project `backend` | Gratis |
| Database | MongoDB Atlas M0 | Gratis |
| Model AI (18 MB) | ikut di bundle frontend | Gratis |

---

## Deploy otomatis (jalur utama)

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

Vercel otomatis build & deploy frontend dan backend. Selesai.

---

## Deploy manual (cadangan)

### Frontend ke Vercel
```bash
cd frontend
yarn build
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

### Backend ke Vercel
```bash
cd backend
vercel --prod
```

---

## Variabel lingkungan

### Frontend (`frontend/.env` lokal, atau dashboard Vercel)
| Variabel | Nilai |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://backend-phi-ashen-16.vercel.app` |
| `CI` | `false` |
| `GENERATE_SOURCEMAP` | `false` |
| `NODE_VERSION` | `20` |

`REACT_APP_BACKEND_URL` dibaca **saat build**. Kalau kosong, sinkronisasi mati dan
aplikasi jadi offline-only.

### Backend (`backend/.env` lokal, atau dashboard Vercel)
| Variabel | Nilai |
|---|---|
| `MONGO_URL` | connection string MongoDB Atlas |
| `DB_NAME` | `bengkel` |
| `CORS_ORIGINS` | `*` atau domain frontend |

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
| Build gagal `Cannot find module` | Root directory harus `frontend` (project `bengkel`) atau `backend` (project `backend`) |
| Panel sinkron menampilkan "Tidak terhubung" | Cek `REACT_APP_BACKEND_URL` sudah diisi saat build; cek `/api/health` backend |
| Backend 404 di semua route | Pastikan `framework` project Vercel = none, bukan `fastapi` |
| Backend 500 `FUNCTION_INVOCATION_FAILED` | Root directory project `backend` harus `backend`, bukan kosong |
| Kamera tidak muncul | Wajib HTTPS atau `localhost` |
| Halaman 404 saat refresh | `frontend/vercel.json` harus punya rewrite ke `/index.html` |
| AI lambat pertama kali | Normal — mengunduh 18 MB model. Berikutnya instan dari cache |
| Data tidak muncul di perangkat lain | Tekan **Sinkronkan Sekarang** di kedua perangkat |
