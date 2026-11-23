# plan.md — Bengkel & Toko Sparepart Motor (Offline PWA)

## 1) Objectives
- Deliver an installable **PWA** (Android/iOS) that works **100% offline** (app shell, DB, images, OCR + vision models cached).
- Local-first inventory with **IndexedDB (Dexie)**: items, images (Blob), scan history, price history, settings.
- Core workflow: **Scan Barang** (rear camera) → OCR + visual match → show **Harga Jual** quickly; allow **Tambah Barang Baru** if not found.
- Mask **Harga Modal/Keuntungan** with **eye icon tap-to-show** (no PIN).
- Low-stock warning uses **one global threshold** (default 3) in Settings.
- Seed app with **example items** (marked “Contoh”, editable/deletable).

---

## 2) Implementation Steps

### Phase 1 — Core POC (isolation, must pass before building full app)
**Goal:** prove offline camera → photo → (OCR + visual embedding) → local match works, and assets load offline.

User stories (POC):
1. As a user, I can open **Scan Barang** and see a live rear-camera preview.
2. As a user, I can tap **Capture** and see the captured photo immediately.
3. As a user, I can run **offline OCR** on the photo and see extracted text (kode/merk).
4. As a user, I can run **offline visual matching** and see top-3 candidate items from local DB.
5. As a user, I can enable airplane mode and still do OCR + matching successfully.

Steps:
- Web research (quick best-practice check):
  - Tesseract.js offline bundling (core/worker/lang paths, performance tips).
  - TFJS + MobileNet offline hosting & warmup, embedding similarity search.
- Add local assets in `/public/models/`:
  - Tesseract: `tesseract.min.js`, `worker.min.js`, `eng.traineddata.gz` (and optionally `ind.traineddata.gz` if needed).
  - TFJS: MobileNet model files (graph/model + weights) stored locally.
- Create a POC route/page (`/poc-scan`) with:
  - `getUserMedia` rear camera + capture to canvas.
  - OCR pipeline (Tesseract) returning tokens + confidence.
  - Visual embedding pipeline (TFJS MobileNet) returning vector.
  - Local mini “catalog” (3–10 seeded images) → precomputed embeddings stored in IndexedDB.
  - Matching: combine **text score** (keyword hits for kode/merk) + **cosine similarity** (embedding) → ranked results.
- PWA caching POC:
  - Service worker caches app shell + `/models/**` + seeded sample images.
  - Verify reload offline: models load, OCR runs, embeddings compute.
- Exit criteria: POC stable on mobile viewport; acceptable speed (first load may be slower; subsequent runs fast).

### Phase 2 — V1 App Development (build around proven core)
**Goal:** full offline sparepart manager with scan-to-check-price overlay.

User stories (V1):
1. As a cashier, I can scan an item and instantly see **Harga Jual** in big text.
2. As an owner, I can tap an eye icon to reveal **Harga Modal** and **Keuntungan** when needed.
3. As a staff member, I can add/edit items with photo, kode part, merk, kecocokan motor, prices, and stock.
4. As a user, I can browse/search the item list offline by nama/kode/merk/kecocokan.
5. As a user, I can see low-stock indicators based on a global threshold.

Steps:
- App structure + UI system:
  - Bottom nav (Beranda, Scan Kamera center FAB, Daftar Barang, Pengaturan).
  - Theme: dark automotive palette; mobile-first touch targets.
- Data layer (Dexie):
  - Tables: `items`, `itemImages`, `priceHistory`, `scanHistory`, `settings`.
  - Settings: `lowStockThreshold` default 3.
  - Seed “Contoh” items on first run (flag `isSample=true`).
- Item CRUD:
  - Add/Edit form: photo capture/gallery + compression, fields, profit calculator realtime, optional stock.
  - Price history append on price changes.
- Scan Kamera:
  - Mode 1: capture → OCR + visual match → result overlay.
  - Mode 2: quick manual search (typeahead) + select to show price overlay.
  - “Tidak ditemukan” → one-tap **Tambah Sebagai Barang Baru** (prefill photo + extracted kode).
- Price overlay:
  - Show photo + name + kode + kecocokan.
  - Harga Jual large; Harga Modal & Keuntungan masked with eye toggle.
- Dashboard (Beranda):
  - Total jenis barang, potensi keuntungan (sum (jual-modal)*stok), recent scans.
- Offline hardening:
  - Ensure service worker caches app shell + models + UI assets.
  - Graceful handling when camera permission denied (fallback to manual search).
- Phase-end testing: run 1 E2E pass (install PWA, offline scan, add item, edit price, low-stock).

### Phase 3 — More Features / Polish
User stories (enhancements):
1. As a user, I can export a **backup JSON** with one tap.
2. As a user, I can restore from JSON and keep all items/photos/history.
3. As a user, I can bulk-import items from a template JSON.
4. As a user, I can tune scan sensitivity (OCR weight vs visual weight) for better matching.
5. As a user, I can manage sample items (remove all “Contoh” in one action).

Steps:
- Backup/Restore:
  - Export: items + settings + histories; include images as Base64 (or Blob->Base64) for portability.
  - Import: validate schema, merge/replace options.
- Performance:
  - Precompute embeddings on item save; lazy compute for legacy items.
  - Add model warmup and progress indicators.
- QA pass + regression tests focusing on offline + data integrity.
- Phase-end testing: 1 E2E pass including restore scenario.

### Phase 4 — Future (optional)
- Advanced filters (motor type chips), printable price labels, multi-device sync (would break 100% offline), roles/PIN (if requested later).

---

## Status
- Phase 1 POC: DONE (Tesseract OCR + MobileNet v2 embeddings self-hosted in /public/models, SW caches them; offline scan verified via Playwright offline mode).
- Phase 2 V1: BUILT (Dashboard, Scan camera+manual, Inventory, Form w/ profit calc, Detail w/ price history, Settings w/ backup/restore JSON, sample items). Backup/restore pulled into V1. Testing in progress.

- Phase 3a: DONE — Price label printing (print + PDF via jsPDF, 3 sizes, copies), Ukuran field for seal/karet (Dalam x Luar x Tebal, searchable, on labels), custom brand/motor quick-pick lists in Settings (+ in-form dialog), included in backup. Tested (iteration_2: 100%).

- Phase 3b: Scan accuracy fix (user bug: Seal As Kickstarter scanned -> showed Seal As Versnelling). New lib/match.js (distinctive-token IDF weighting, fuzzy OCR-tolerant codes, size parsing + conflict penalties), 2-pass OCR (PSM3+PSM11, 2000px), item label OCR stored (ocrTokens/ocrSizes) on save + background indexer, visual fast-path only for unique look, background text verification/correction, 'Pilih barang yang benar' chooser + learning. Fixtures in /app/tests/fixtures. Testing in progress.

## 3) Next Actions (immediate)
1. Add local model assets folders (`/public/models/tesseract`, `/public/models/tfjs-mobilenet`) and wire loaders to use only local URLs.
2. Implement `/poc-scan` with camera capture + OCR + embedding extraction.
3. Implement Dexie mini catalog + embedding storage + combined scoring.
4. Add service worker caching for model assets; verify airplane-mode success.
5. Only after POC passes: scaffold nav + pages and integrate POC module into Scan Kamera tab.

---

## 4) Success Criteria
- POC: In airplane mode, user can capture photo, OCR runs, visual matching returns ranked candidates from local DB.
- V1: Fully offline installable PWA; CRUD works; Scan flow shows price overlay; modal/profit masked via eye toggle; low-stock uses global threshold.
- Data safety: Backup export/import round-trip preserves items + photos + histories.
- Usability: Mobile-first UI, fast enough for shop use (repeat scans feel responsive), clear empty/error states.
