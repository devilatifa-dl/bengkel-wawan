# Auto-Deploy — Setiap `git push` Langsung Online

Auto-deploy **sudah aktif** lewat integrasi Git Vercel. Tidak ada langkah manual lagi.

## Cara pakai

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

Selesai. Dalam ~1–3 menit perubahan langsung tampil di:

| Bagian | URL produksi |
|---|---|
| Aplikasi (frontend) | https://bengkel-umber.vercel.app |
| API (backend) | https://backend-phi-ashen-16.vercel.app |

## Cara kerjanya

Repo GitHub `devilatifa-dl/bengkel-wawan` terhubung ke **dua** project Vercel:

| Project Vercel | Root directory | Yang di-deploy |
|---|---|---|
| `bengkel` | `frontend` | Aplikasi React (PWA) |
| `backend` | `backend` | API FastAPI |

Setiap push ke branch `main` memicu build di kedua project secara otomatis.

### Konfigurasi frontend (project `bengkel`)
- Framework: none
- Install: `yarn install --network-timeout 600000`
- Build: `CI=false yarn build`
- Output: `build`
- Env: `REACT_APP_BACKEND_URL`, `CI=false`, `GENERATE_SOURCEMAP=false`, `NODE_VERSION=20`

### Konfigurasi backend (project `backend`)
- Framework: none
- Root directory: `backend`
- Entry: `backend/api/index.py` → `backend/server.py`
- Env: `MONGO_URL`, `DB_NAME=bengkel`, `CORS_ORIGINS`

## Memantau hasil deploy

- Dashboard: https://vercel.com/latifadevii-2722/bengkel
- Atau lewat CLI: `vercel ls bengkel`

Kalau build gagal, Vercel tetap menyajikan versi terakhir yang sukses — aplikasi tidak mati.

## Deploy manual (cadangan)

Kalau perlu deploy tanpa lewat Git:

```bat
deploy.bat
```

Script ini build frontend lalu upload ke Cloudflare Pages (`bengkel-wawan.pages.dev`).
Berguna kalau Vercel sedang bermasalah.

## Catatan

- Cloudflare Pages (`bengkel-wawan.pages.dev`) masih ada sebagai cermin, tapi **tidak**
  auto-deploy karena bertipe Direct Uploads. Vercel yang jadi jalur utama.
- Jangan commit file `.env` — sudah masuk `.gitignore`. Variabel produksi diatur di
  dashboard Vercel.
