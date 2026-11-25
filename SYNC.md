# Sinkronisasi Antar Perangkat

Data tetap **offline-first**: IndexedDB di HP/laptop adalah sumber utama.
Server hanya menyimpan salinan agar semua perangkat melihat isi yang sama.

## Alur

```
HP (IndexedDB)  ──push──►  Vercel Function (FastAPI)  ──►  MongoDB Atlas
      ▲                │                                        (database `bengkel`)
      └──pull────────┘
```

Frontend dan API berada di **domain yang sama** (`bengkel-umber.vercel.app`),
jadi tidak ada CORS dan tidak perlu variabel `REACT_APP_BACKEND_URL`.

## Kapan sinkron berjalan

| Pemicu | Keterangan |
|---|---|
| Aplikasi dibuka | 1,2 detik setelah halaman siap |
| Setiap 15 detik | Selama aplikasi terbuka |
| Setelah simpan barang | Langsung, tanpa menunggu timer |
| Koneksi kembali online | Event `online` |
| Tab kembali aktif | Event `focus` dan `visibilitychange` |
| Tombol **Sinkronkan Sekarang** | Di halaman Pengaturan |

## Endpoint

| Endpoint | Fungsi |
|---|---|
| `GET /api/health` | Cek koneksi database |
| `GET /api/sync/pull?since=<seq>` | Ambil item yang berubah setelah `seq` |
| `POST /api/sync/push` | Kirim perubahan lokal |
| `GET /api/sync/stats` | Jumlah barang di server |

## Dua konsep waktu yang berbeda

Ini bagian paling penting dan pernah jadi sumber bug.

| Field | Sumber | Dipakai untuk |
|---|---|---|
| `updatedAt` | jam perangkat (epoch ms) | menentukan data mana yang menang (last-write-wins) |
| `seq` | nomor urut dari server | cursor tarik data |

**Kenapa cursor tidak memakai `updatedAt`?**
Jam HP dan laptop bisa berbeda beberapa menit. Kalau HP menyimpan barang dengan
`updatedAt` 10:00 sementara laptop sudah menarik data sampai 10:05, barang itu
tidak akan pernah tertarik — hilang selamanya.

`seq` selalu naik di server, jadi setiap perubahan pasti terlihat oleh perangkat
lain pada tarikan berikutnya, berapa pun jam perangkatnya.

## Penghapusan

Hapus barang memakai **soft delete** (`deleted: true`). Baris tetap ada di server
agar penghapusan ikut tersinkron. Semua halaman memakai `liveItems()` sehingga
barang terhapus tidak tampil.

## Barang contoh

Seed 6 barang contoh hanya berjalan bila **server belum punya data**. Tanpa aturan
ini setiap perangkat baru (HP, laptop, browser lain) menanam 6 contoh lalu
mengirimnya ke server sehingga daftar menumpuk duplikat.

## Batasan

- Foto dikirim sebagai data URL base64. Batas body request Vercel 4,5 MB, jadi
  foto sudah dikompres di sisi klien sebelum disimpan.
- Tarik data dibatasi 500 item per request; klien mengulang otomatis bila
  `more: true`.
- Konflik antar perangkat diselesaikan dengan last-write-wins, bukan merge per
  field. Hindari mengedit barang yang sama di dua perangkat bersamaan.
