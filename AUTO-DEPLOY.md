# Auto-Deploy ? 3 Pilihan

## Pilihan 1 (TERMUDAH): Klik dua kali `deploy.bat`

Setiap kali selesai mengubah kode:

1. Klik dua kali **`deploy.bat`** di folder `Bengkel`
2. Tunggu ?2 menit
3. Selesai ? https://bengkel-wawan.pages.dev sudah diperbarui

Script ini otomatis: build frontend ? deploy ke Cloudflare Pages.

Tidak perlu GitHub, tidak perlu token, tidak perlu setting apa pun.

---

## Pilihan 2: Hubungkan repo di Cloudflare Dashboard (auto-deploy tiap push)

Ini yang Anda minta ? setiap `git push` otomatis deploy. Perlu 2 menit setup sekali saja.

### Langkah

1. Buka https://dash.cloudflare.com ? login
2. Menu kiri: **Workers & Pages**
3. Klik tab **Create** ? **Pages** ? **Connect to Git**
4. Klik **Connect GitHub** ? izinkan Cloudflare akses repo
   - Pilih **Only select repositories** ? centang `bengkel-wawan`
5. Pilih repo `bengkel-wawan` ? **Begin setup**
6. Isi:

   | Kolom | Nilai |
   |---|---|
   | Project name | `bengkel-wawan` |
   | Production branch | `main` |
   | Framework preset | `Create React App` |
   | Build command | `yarn build` |
   | Build output directory | `build` |
   | **Root directory** | **`frontend`** |

7. **Environment variables** (klik Add variable):
   - `REACT_APP_BACKEND_URL` = `https://backend-phi-ashen-16.vercel.app`
   - `CI` = `false`
   - `GENERATE_SOURCEMAP` = `false`
   - `NODE_VERSION` = `20`

8. Klik **Save and Deploy**

Setelah itu, setiap `git push` ke `main` ? Cloudflare otomatis build & deploy.

> **Catatan:** project `bengkel-wawan` yang sekarang adalah tipe *Direct Uploads*
> (dibuat lewat CLI), jadi tidak bisa diubah ke Git. Saat Connect to Git,
> Cloudflare akan menawarkan nama baru ? gunakan `bengkel-wawan` (akan
> menggantikan) atau `bengkel-wawan-git` (URL baru).

---

## Pilihan 3: GitHub Actions (butuh token dengan scope `workflow`)

File workflow sudah disiapkan di `$env:TEMP\deploy.yml.bak`. Untuk mengaktifkan:

### 1. Buat token GitHub baru dengan scope `workflow`

https://github.com/settings/tokens ? **Generate new token (classic)**
- Centang: **`repo`** DAN **`workflow`**
- Copy token

### 2. Push file workflow

```powershell
cd "c:\Stiawan Dev\Project Perpus\Bengkel"
Copy-Item "$env:TEMP\deploy.yml.bak" ".github\workflows\deploy.yml"
git add .github/workflows/deploy.yml
git commit -m "ci: aktifkan auto-deploy GitHub Actions"
git push
```

### 3. Pasang 3 secret

https://github.com/devilatifa-dl/bengkel-wawan/settings/secrets/actions

| Secret | Nilai |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://backend-phi-ashen-16.vercel.app` |
| `CLOUDFLARE_ACCOUNT_ID` | `06dfeb33b7618eab835141adf0253beb` |
| `CLOUDFLARE_API_TOKEN` | Buat di https://dash.cloudflare.com/profile/api-tokens ? template **Edit Cloudflare Workers** ? hapus policy Zone ? pastikan **Cloudflare Pages: Edit** tercentang |

---

## Perbandingan

| | Pilihan 1 (deploy.bat) | Pilihan 2 (Dashboard) | Pilihan 3 (Actions) |
|---|---|---|---|
| Setup | 0 menit | 2 menit | 10 menit |
| Auto tiap push | ? manual klik | ? | ? |
| Butuh token workflow | ? | ? | ? |
| Butuh login browser | ? | ? | ? |
| Bisa dari HP | ? | ? | ? |

**Rekomendasi:** pakai **Pilihan 1** sekarang (langsung jalan), lalu **Pilihan 2** saat ada waktu ? keduanya bisa aktif bersamaan.
