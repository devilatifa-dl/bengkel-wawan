# Auto-Deploy — Setiap `git push` Langsung Online

Auto-deploy **sudah aktif** lewat integrasi Git Vercel.

## Cara pakai

```bash
git add -A
git commit -m "pesan perubahan"
git push
```

Selesai. Dalam ~2–4 menit perubahan langsung tampil di
**https://bengkel-umber.vercel.app**

## Cara kerjanya

Repo GitHub `devilatifa-dl/bengkel-wawan` terhubung ke **satu** project Vercel
bernama `bengkel`. Satu project itu melayani dua hal sekaligus:

| Path | Dilayani oleh |
|---|---|
| `/` dan halaman lain | React build dari `frontend/build` |
| `/api/*` | FastAPI dari `api/index.py` → `backend/server.py` |
| `/models/*`, `/static/*` | aset statis |

Karena satu domain, frontend memanggil API lewat path relatif (`/api/...`).
Tidak ada CORS dan tidak ada variabel `REACT_APP_BACKEND_URL`.

### Konfigurasi project Vercel

| Setelan | Nilai |
|---|---|
| Root Directory | *(kosong — root repo)* |
| Framework Preset | Other |
| Install Command | `cd frontend && yarn install --network-timeout 600000` |
| Build Command | `cd frontend && CI=false yarn build` |
| Output Directory | `frontend/build` |

Semua nilai di atas berasal dari `vercel.json` di root repo.

### Environment Variables

| Variabel | Nilai |
|---|---|
| `MONGO_URL` | connection string MongoDB Atlas |
| `DB_NAME` | `bengkel` |
| `CORS_ORIGINS` | `*` |
| `CI` | `false` |
| `GENERATE_SOURCEMAP` | `false` |
| `NODE_VERSION` | `20` |

`requirements.txt` di root dipakai Vercel untuk memasang dependensi Python.

## Memantau hasil deploy

- Dashboard: https://vercel.com/latifadevii-2722/bengkel
- CLI: `vercel ls bengkel`
- Log fungsi: `vercel logs --deployment <url>`

Kalau build gagal, Vercel tetap menyajikan versi terakhir yang sukses —
aplikasi tidak mati.

## Deploy manual (cadangan)

```bat
deploy.bat
```

Script ini build frontend lalu upload ke Cloudflare Pages
(`bengkel-wawan.pages.dev`). Berguna kalau Vercel sedang bermasalah, tapi
situs Cloudflare itu **tidak** punya API sinkronisasi.

## Catatan

- Jangan commit `.env` — sudah masuk `.gitignore`.
- Cloudflare Pages (`bengkel-wawan.pages.dev`) hanya cermin statis, tidak
  auto-deploy karena bertipe Direct Uploads.
