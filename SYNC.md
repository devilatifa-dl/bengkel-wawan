# Sinkronisasi Antar Perangkat

Aplikasi ini **tetap offline-first** (data disimpan di IndexedDB perangkat), tetapi juga
mengirim salinan ke server agar **HP dan laptop melihat data yang sama**.

## Cara kerja

```
HP (IndexedDB)  ??push???  API Vercel  ???  MongoDB Atlas (database: bengkel)
      ?                        ?
      ?????????pull?????????????
Laptop (IndexedDB)
```

- **Push**: setiap item yang `updatedAt`-nya lebih baru dari sinkron terakhir dikirim ke server.
- **Pull**: item dari perangkat lain ditarik dan disimpan ke IndexedDB.
- **Konflik**: last-write-wins berdasarkan `updatedAt` (epoch ms). Data yang lebih lama diabaikan.
- **Hapus**: memakai soft delete (`deleted: true`) agar penghapusan ikut tersinkron.
- **Offline**: bila server tidak terjangkau, aplikasi tetap jalan normal. Sinkron dicoba lagi
  setiap 30 detik, saat koneksi kembali, dan saat tab kembali fokus.

## Kapan sinkron berjalan

| Pemicu | Waktu |
|---|---|
| Aplikasi dibuka | 1,5 detik setelah load |
| Berkala | Setiap 30 detik |
| Koneksi kembali | Event `online` |
| Tab kembali aktif | Event `focus` |
| Manual | Pengaturan ? Sinkron Antar Perangkat ? **Sinkronkan Sekarang** |

## Konfigurasi

### Frontend (build-time)
```
REACT_APP_BACKEND_URL=https://<project-backend>.vercel.app
```
Diisi sebagai **GitHub Secret** agar GitHub Actions memakainya saat build.

### Backend (Vercel Environment Variables)
```
MONGO_URL=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
DB_NAME=bengkel
CORS_ORIGINS=*
```

## Endpoint API

| Method | Path | Fungsi |
|---|---|---|
| GET | `/api/health` | Cek koneksi database |
| GET | `/api/sync/pull?since=<ms>` | Ambil item yang berubah setelah `since` + semua pengaturan |
| POST | `/api/sync/push` | Kirim item lokal + pengaturan |
| GET | `/api/sync/stats` | Jumlah item di server |

## Catatan penting

- **Database terpisah**: memakai cluster Atlas yang sama dengan project perpus, tetapi
  `DB_NAME=bengkel` ? data perpus tidak tersentuh.
- **Foto** dikirim sebagai data URL base64. Untuk ratusan barang berfoto, ukuran payload bisa
  besar; sinkron berjalan bertahap (maks 500 item per permintaan).
- **Tanpa login**: siapa pun yang tahu URL API bisa membaca data. Untuk pemakaian pribadi
  ini biasanya cukup, tetapi jangan bagikan URL backend ke publik.
