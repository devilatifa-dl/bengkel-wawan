# Langkah Deploy Sinkronisasi (Sisa)

Kode sinkronisasi **sudah selesai dan teruji lokal**. Yang tersisa hanya deploy
backend ke Vercel + pasang 3 secret GitHub.

## Status saat ini

| Bagian | Status |
|---|---|
| Backend sync (FastAPI) | ? Selesai, teruji lokal |
| Frontend sync layer | ? Selesai, teruji 2 perangkat |
| Database Atlas `bengkel` | ? Terhubung |
| Deploy backend ke Vercel | ? Perlu login Vercel |
| Auto-deploy GitHub Actions | ? Perlu 3 secret |

## Langkah 1 ? Deploy backend ke Vercel

```powershell
cd "c:\Stiawan Dev\Project Perpus\Bengkel"
npx vercel login          # login lewat browser
npx vercel --prod         # deploy, ikuti pertanyaan
```

Saat ditanya:
- Set up and deploy? **Y**
- Which scope? pilih akun Anda
- Link to existing project? **N**
- Project name: **bengkel-wawan-api**
- Directory: **./** (tekan Enter)
- Override settings? **N**

Setelah selesai, catat URL-nya, misal `https://bengkel-wawan-api.vercel.app`.

### Pasang environment variable di Vercel

Dashboard Vercel ? project `bengkel-wawan-api` ? **Settings** ? **Environment Variables**:

| Name | Value |
|---|---|
| `MONGO_URL` | `mongodb+srv://perpusapp:...@perpussmansa.q3ojygj.mongodb.net/?retryWrites=true&w=majority` |
| `DB_NAME` | `bengkel` |
| `CORS_ORIGINS` | `*` |

Lalu **Redeploy** (Deployments ? ? ? Redeploy).

### Uji backend

```powershell
curl https://bengkel-wawan-api.vercel.app/api/health
# {"ok":true,"db":"bengkel","ts":...}
```

## Langkah 2 ? Pasang 3 secret GitHub

Buka https://github.com/devilatifa-dl/bengkel-wawan/settings/secrets/actions

| Secret | Nilai | Cara dapat |
|---|---|---|
| `REACT_APP_BACKEND_URL` | `https://bengkel-wawan-api.vercel.app` | URL dari Langkah 1 |
| `CLOUDFLARE_API_TOKEN` | token API | Lihat di bawah |
| `CLOUDFLARE_ACCOUNT_ID` | `06dfeb33b7618eab835141adf0253beb` | Sudah diketahui |

### Membuat CLOUDFLARE_API_TOKEN

1. https://dash.cloudflare.com/profile/api-tokens
2. **Create Token** ? template **Edit Cloudflare Workers**
3. Hapus policy "Zone" (tidak perlu domain)
4. Pastikan **Cloudflare Pages: Edit** tercentang
5. **Continue to summary** ? **Create Token**
6. Copy token ? tempel sebagai secret `CLOUDFLARE_API_TOKEN`

## Langkah 3 ? Push & verifikasi auto-deploy

```powershell
cd "c:\Stiawan Dev\Project Perpus\Bengkel"
git push origin main
```

Buka https://github.com/devilatifa-latest/bengkel-wawan/actions ? workflow
"Deploy ke Cloudflare Pages" akan berjalan otomatis (?3 menit).

Setelah sukses, setiap `git push` ke `main` akan otomatis build & deploy.

## Langkah 4 ? Uji sinkronisasi di produksi

1. Buka https://bengkel-wawan.pages.dev di **laptop**
2. Pengaturan ? Sinkron Antar Perangkat ? harus **Terhubung**
3. Tambah 1 barang di laptop
4. Buka URL yang sama di **HP** ? barang muncul otomatis (tunggu ?30 detik)

## Cara kerja sinkronisasi

```
HP (IndexedDB)  ??push???  Vercel API  ???  MongoDB Atlas (db: bengkel)
      ?                        ?
      ?????????pull?????????????
Laptop (IndexedDB)
```

- **Offline tetap jalan** ? data disimpan lokal dulu
- **Konflik**: last-write-wins berdasarkan `updatedAt`
- **Hapus**: soft delete agar ikut tersinkron
- **Pemicu sync**: buka aplikasi, tiap 30 detik, saat online, saat tab fokus, tombol manual

## Troubleshooting

| Masalah | Solusi |
|---|---|
| Panel sync bilang "Belum aktif" | `REACT_APP_BACKEND_URL` belum diisi saat build |
| "Tidak terhubung" | Cek `/api/health` backend; pastikan `MONGO_URL` benar |
| Data tidak muncul di perangkat lain | Tekan **Sinkronkan Sekarang** di kedua perangkat |
| GitHub Actions gagal | Cek 3 secret sudah terpasang |
| Deploy Cloudflare 403 | Token tidak punya izin **Cloudflare Pages: Edit** |
