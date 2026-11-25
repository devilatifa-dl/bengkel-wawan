import React, { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  Store, AlertTriangle, ListPlus, Printer, ChevronRight, Bike, BadgeCheck, Minus, Plus, Download, Upload, Share2, ShieldCheck, Cpu, HardDrive, RefreshCw, Smartphone, Trash2, Sparkles, Loader2, CheckCircle2, XCircle, PackageX, Info,
} from "lucide-react";
import { db, setSetting, DEFAULT_BRANDS, DEFAULT_MOTORS, liveItems } from "../lib/db";
import { syncEnabled, syncNow, syncStatus } from "../lib/sync";
import { OptionsEditor } from "../components/OptionsEditor";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../lib/hooks";
import { exportBackup, shareBackup, parseBackup, restoreBackup, wipeAll } from "../lib/backup";
import { removeSamples } from "../lib/seed";
import { runIndexer, subscribeIndexer } from "../lib/indexer";
import { prepareAll, subscribeAI } from "../lib/aiStatus";
import { getOfflineStatus, canPromptInstall, onInstallAvailable, promptInstall, isStandalone, isIOS } from "../lib/pwa";
import { PageHeader } from "../components/PageHeader";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";

function Section({ icon: Icon, title, children, testid, accent = "text-cyan-400", id }) {
  return (
    <section id={id} data-testid={testid} className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-5 w-5 ${accent}`} />
        <h2 className="font-display text-base font-semibold text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function StatusRow({ ok, label, detail, loading, testid }) {
  return (
    <div className="flex items-center gap-3 py-2" data-testid={testid}>
      {loading ? <Loader2 className="h-5 w-5 animate-spin text-amber-400" /> : ok ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-slate-500" />}
      <div className="flex-1">
        <div className="text-sm font-medium text-slate-200">{label}</div>
        {detail && <div className="text-xs text-slate-400">{detail}</div>}
      </div>
    </div>
  );
}

const btn = "inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150 active:scale-[0.99] disabled:opacity-60";

function fmtBytes(b) {
  if (!b) return "0 MB";
  return `${(b / (1024 * 1024)).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

export default function Settings() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState("");
  const [busy, setBusy] = useState("");
  const [sync, setSync] = useState(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [pending, setPending] = useState(null); // parsed backup awaiting confirm
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmSamples, setConfirmSamples] = useState(false);
  const [offline, setOffline] = useState(null);
  const [ai, setAi] = useState({ vision: "idle", ocr: "idle" });
  const [idx, setIdx] = useState({ pending: 0, done: 0, running: false });
  const [installable, setInstallable] = useState(canPromptInstall());
  const fileRef = useRef(null);
  const counts = useLiveQuery(async () => {
    const all = await liveItems().toArray();
    return {
      items: all.length,
      samples: all.filter((i) => i.isSample).length,
      withPhoto: all.filter((i) => i.photo).length,
      indexed: all.filter((i) => i.photo && i.embedding).length,
    };
  }, [], { items: 0, samples: 0, withPhoto: 0, indexed: 0 });

  const refreshSync = async () => { if (syncEnabled()) setSync(await syncStatus()); };
  const doSync = async () => {
    setSyncBusy(true); setSyncMsg("");
    const r = await syncNow();
    setSyncMsg(r.ok ? `Berhasil: ${r.pulled} ditarik, ${r.pushed} dikirim` : `Gagal: ${r.reason}`);
    await refreshSync();
    setSyncBusy(false);
  };
  useEffect(() => { refreshSync(); }, []);

  useEffect(() => setShopName(settings.shopName || ""), [settings.shopName]);
  useEffect(() => subscribeAI(setAi), []);
  useEffect(() => subscribeIndexer(setIdx), []);
  useEffect(() => onInstallAvailable(setInstallable), []);
  useEffect(() => {
    let alive = true;
    const load = () => getOfflineStatus().then((s) => alive && setOffline(s));
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const saveName = async () => {
    const v = shopName.trim() || "Bengkel Saya";
    if (v === settings.shopName) return;
    await setSetting("shopName", v);
    toast.success("Nama toko disimpan");
  };

  const setThreshold = (v) => setSetting("lowStockThreshold", Math.max(0, Math.min(999, v)));

  const doExport = async () => {
    setBusy("export");
    try {
      const r = await exportBackup();
      toast.success(`Backup tersimpan: ${r.name}`, { description: `${r.count} barang • ${fmtBytes(r.size)}` });
      await setSetting("lastBackupAt", Date.now());
    } catch (e) {
      toast.error("Gagal membuat backup");
    } finally {
      setBusy("");
    }
  };

  const doShare = async () => {
    setBusy("share");
    try {
      const ok = await shareBackup();
      if (!ok) toast.info("Berbagi file tidak didukung, gunakan Export JSON");
      else await setSetting("lastBackupAt", Date.now());
    } catch (e) {
      if (e && e.name !== "AbortError") toast.error("Gagal membagikan backup");
    } finally {
      setBusy("");
    }
  };

  const onImportFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const text = await f.text();
      const data = parseBackup(text);
      setPending({ data, name: f.name });
    } catch (err) {
      toast.error(err.message || "File tidak valid");
    }
  };

  const doRestore = async (mode) => {
    if (!pending) return;
    setBusy("import");
    try {
      const n = await restoreBackup(pending.data, mode);
      toast.success(mode === "replace" ? `Data dipulihkan: ${n} barang` : `${n} barang ditambahkan`);
      setPending(null);
      setTimeout(() => runIndexer(), 300);
    } catch (e) {
      toast.error("Gagal memulihkan: " + (e?.message || ""));
    } finally {
      setBusy("");
    }
  };

  const lastBackup = settings.lastBackupAt;

  return (
    <div data-testid="settings-page" className="safe-bottom">
      <PageHeader title="Pengaturan" subtitle="Backup, stok, dan status offline" />
      <div className="space-y-4 px-4 pt-4 sm:px-6 lg:px-8">
        <Section icon={Store} title="Profil Toko" testid="settings-shop-section">
          <label htmlFor="shop-name" className="mb-2 block text-sm text-slate-400">Nama Toko / Bengkel</label>
          <input
            id="shop-name"
            data-testid="settings-shop-name-input"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            className="h-14 w-full rounded-xl border border-slate-700 bg-[#0B1220] px-4 text-base text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400/70"
          />
        </Section>

        <Section icon={AlertTriangle} title="Peringatan Stok Menipis" testid="settings-stock-section" accent="text-amber-400">
          <p className="mb-3 text-sm text-slate-400">Barang ditandai menipis jika stok sama dengan atau kurang dari:</p>
          <div className="flex items-center gap-3">
            <button type="button" data-testid="settings-threshold-minus" onClick={() => setThreshold((settings.lowStockThreshold || 0) - 1)} className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Kurangi">
              <Minus className="h-6 w-6" />
            </button>
            <div className="flex-1 text-center">
              <span data-testid="settings-threshold-value" className="tabular font-display text-4xl font-bold text-amber-400">{settings.lowStockThreshold}</span>
              <span className="ml-1 text-sm text-slate-400">pcs</span>
            </div>
            <button type="button" data-testid="settings-threshold-plus" onClick={() => setThreshold((settings.lowStockThreshold || 0) + 1)} className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Tambah">
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </Section>

        <Section icon={ListPlus} title="Pilihan Cepat Merk & Motor" testid="settings-options-section" id="pilihan-cepat">
          <p className="mb-4 text-sm text-slate-400">Tambah atau hapus tombol cepat yang muncul di form barang, filter Daftar Barang, dan pencarian.</p>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <BadgeCheck className="h-4 w-4 text-cyan-400" /> Daftar Merk
          </div>
          <OptionsEditor settingKey="brandOptions" options={settings.brandOptions} defaults={DEFAULT_BRANDS} placeholder="cth. Daytona, Kitaco" testid="settings-brand-options" emptyText="Belum ada merk" />
          <div className="my-4 h-px bg-slate-700/70" />
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
            <Bike className="h-4 w-4 text-cyan-400" /> Daftar Kecocokan Motor
          </div>
          <OptionsEditor settingKey="motorOptions" options={settings.motorOptions} defaults={DEFAULT_MOTORS} placeholder="cth. Vario 160, XMAX" testid="settings-motor-options" emptyText="Belum ada motor" />
        </Section>

        <button type="button" data-testid="settings-labels-link" onClick={() => navigate("/label")} className="flex w-full items-center gap-3 rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4 text-left active:scale-[0.99]">
          <Printer className="h-5 w-5 text-amber-400" />
          <span className="flex-1">
            <span className="block font-display text-base font-semibold text-white">Cetak Label Harga</span>
            <span className="block text-sm text-slate-400">Stiker harga untuk rak — cetak langsung atau unduh PDF</span>
          </span>
          <ChevronRight className="h-5 w-5 text-slate-500" />
        </button>

        <Section icon={ShieldCheck} title="Backup & Restore" testid="settings-backup-restore">
          <p className="mb-3 text-sm text-slate-400">
            Simpan seluruh data (barang, foto, riwayat harga) ke file JSON di memori HP. {lastBackup ? `Backup terakhir: ${new Date(lastBackup).toLocaleString("id-ID")}.` : "Belum pernah backup."}
          </p>
          <div className="grid gap-3">
            <button type="button" data-testid="settings-export-json-button" onClick={doExport} disabled={!!busy} className={`${btn} bg-cyan-500 text-slate-950 hover:bg-cyan-400`}>
              {busy === "export" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Export Backup (JSON)
            </button>
            {typeof navigator !== "undefined" && navigator.canShare && (
              <button type="button" data-testid="settings-share-json-button" onClick={doShare} disabled={!!busy} className={`${btn} border border-slate-600 bg-[#0B1220] text-slate-100 hover:bg-slate-800`}>
                {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Bagikan Backup (WA / Drive)
              </button>
            )}
            <button type="button" data-testid="settings-import-json-button" onClick={() => fileRef.current.click()} disabled={!!busy} className={`${btn} border border-slate-600 bg-[#0B1220] text-slate-100 hover:bg-slate-800`}>
              {busy === "import" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />} Import / Restore Backup
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" data-testid="settings-import-json-input" onChange={onImportFile} />
          </div>
          <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> File backup tidak dienkripsi dan berisi harga modal. Simpan di tempat aman.
          </p>
        </Section>

        <Section icon={RefreshCw} title="Sinkron Antar Perangkat" testid="settings-sync-section">
          <p className="mb-3 text-sm text-slate-400">
            Data tetap tersimpan di perangkat ini (bisa dipakai offline), lalu dikirim ke server agar HP dan laptop
            melihat isi yang sama.
          </p>
          <div className="divide-y divide-slate-700/60">
            <StatusRow testid="settings-sync-online" ok={sync?.online} loading={syncBusy} label="Koneksi server" detail={sync?.online ? "Terhubung" : sync?.error || "Tidak terhubung"} />
            <StatusRow testid="settings-sync-items" ok={sync?.online} label="Data di server" detail={sync?.online ? `${sync.items ?? 0} barang` : "?"} />
            <StatusRow testid="settings-sync-last" ok={!!sync?.lastPull} label="Sinkron terakhir" detail={sync?.lastPull ? new Date(sync.lastPull).toLocaleString("id-ID") : "Belum pernah"} />
          </div>
          <button type="button" data-testid="settings-sync-now-button" onClick={doSync} disabled={syncBusy} className={`${btn} mt-3 bg-cyan-500 text-slate-950 hover:bg-cyan-400`}>
            {syncBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />} Sinkronkan Sekarang
          </button>
          {syncMsg && <p className="mt-2 text-xs text-slate-400" data-testid="settings-sync-message">{syncMsg}</p>}
        </Section>

        <Section icon={Cpu} title="Status Offline & Kamera AI" testid="settings-offline-section">
          <div className="divide-y divide-slate-700/60">
            <StatusRow testid="settings-status-sw" ok={offline?.sw} label="Mode offline (Service Worker)" detail={offline?.sw ? "Aplikasi bisa dibuka tanpa internet" : "Belum aktif — buka ulang aplikasi sekali saat online"} />
            <StatusRow testid="settings-status-models" ok={offline?.modelsCached} label="Model AI tersimpan di HP" detail={offline?.modelsCached ? "Pengenal foto & pembaca teks siap offline" : "Sedang diunduh saat pertama kali online"} />
            <StatusRow testid="settings-status-vision" ok={ai.vision === "ready"} loading={ai.vision === "loading"} label="AI pengenal foto" detail={ai.vision === "error" ? "Gagal dimuat" : ai.vision === "ready" ? "Aktif" : ai.vision === "loading" ? "Memuat…" : "Belum dimuat"} />
            <StatusRow testid="settings-status-ocr" ok={ai.ocr === "ready"} loading={ai.ocr === "loading"} label="AI pembaca teks / kode part" detail={ai.ocr === "error" ? "Gagal dimuat" : ai.ocr === "ready" ? "Aktif" : ai.ocr === "loading" ? "Memuat…" : "Belum dimuat"} />
            <StatusRow
              testid="settings-status-index"
              ok={counts.withPhoto === counts.indexed}
              loading={idx.running}
              label={`Foto terindeks AI: ${counts.indexed}/${counts.withPhoto}`}
              detail={idx.running ? `Mengindeks… ${idx.done}/${idx.pending}` : "Foto barang dipakai untuk pencocokan tanpa barcode"}
            />
            <div className="flex items-center gap-3 py-2" data-testid="settings-status-storage">
              <HardDrive className="h-5 w-5 text-slate-400" />
              <div className="flex-1 text-sm text-slate-300">
                Penyimpanan: {fmtBytes(offline?.usage)} terpakai {offline?.persisted ? "• dilindungi" : ""}
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="settings-prepare-ai-button"
            onClick={async () => {
              await prepareAll();
              runIndexer();
            }}
            className={`${btn} mt-3 border border-slate-600 bg-[#0B1220] text-slate-100 hover:bg-slate-800`}
          >
            <Sparkles className="h-5 w-5 text-cyan-400" /> Siapkan AI & Indeks Foto Sekarang
          </button>
        </Section>

        <Section icon={Smartphone} title="Pasang di HP" testid="settings-install-section">
          {isStandalone() ? (
            <p className="text-sm text-emerald-300">Aplikasi sudah terpasang di layar utama.</p>
          ) : installable ? (
            <button type="button" data-testid="settings-install-button" onClick={promptInstall} className={`${btn} bg-amber-500 text-slate-950 hover:bg-amber-400`}>
              <Smartphone className="h-5 w-5" /> Pasang Aplikasi
            </button>
          ) : (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300" data-testid="settings-install-steps">
              {isIOS() ? (
                <>
                  <li>Buka di Safari, ketuk tombol <b>Bagikan</b>.</li>
                  <li>Pilih <b>Tambah ke Layar Utama</b>.</li>
                </>
              ) : (
                <>
                  <li>Buka menu browser (⋮) di Chrome.</li>
                  <li>Pilih <b>Instal aplikasi</b> / <b>Tambahkan ke Layar utama</b>.</li>
                </>
              )}
            </ol>
          )}
        </Section>

        <Section icon={PackageX} title="Data Contoh" testid="settings-samples-section" accent="text-amber-400">
          <p className="mb-3 text-sm text-slate-400">{counts.samples > 0 ? `${counts.samples} barang bertanda “Contoh” untuk mencoba fitur.` : "Tidak ada data contoh."}</p>
          <button type="button" data-testid="settings-remove-samples-button" disabled={counts.samples === 0} onClick={() => setConfirmSamples(true)} className={`${btn} border border-amber-500/50 bg-[#0B1220] text-amber-300 hover:bg-amber-500/10`}>
            <Trash2 className="h-5 w-5" /> Hapus Semua Data Contoh
          </button>
        </Section>

        <Section icon={Trash2} title="Zona Bahaya" testid="settings-danger-section" accent="text-red-400">
          <button type="button" data-testid="settings-wipe-button" onClick={() => setConfirmWipe(true)} className={`${btn} border border-red-500/50 bg-[#0B1220] text-red-400 hover:bg-red-500/10`}>
            <Trash2 className="h-5 w-5" /> Hapus Semua Data
          </button>
        </Section>

        <p className="pb-2 text-center text-xs text-slate-600">Bengkel & Toko Sparepart Motor • v1.0 • {counts.items} barang • data hanya di HP ini</p>
      </div>

      {/* Restore confirm */}
      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent className="max-w-[400px] border-slate-700 bg-[#1E293B] text-slate-100" data-testid="settings-restore-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Pulihkan backup?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {pending ? `${pending.name} • ${pending.data.items.length} barang • dibuat ${new Date(pending.data.exportedAt).toLocaleString("id-ID")}` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <button type="button" data-testid="settings-restore-replace" disabled={busy === "import"} onClick={() => doRestore("replace")} className={`${btn} bg-cyan-500 text-slate-950`}>
              Ganti Semua Data
            </button>
            <button type="button" data-testid="settings-restore-merge" disabled={busy === "import"} onClick={() => doRestore("merge")} className={`${btn} border border-slate-600 text-slate-100`}>
              Gabungkan dengan Data Sekarang
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="settings-restore-cancel" className="min-h-[48px] w-full border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">Batal</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmSamples} onOpenChange={setConfirmSamples}>
        <AlertDialogContent className="max-w-[400px] border-slate-700 bg-[#1E293B] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus semua data contoh?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Hanya barang bertanda “Contoh” yang dihapus. Barang Anda tetap aman.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-[48px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">Batal</AlertDialogCancel>
            <AlertDialogAction
              data-testid="settings-remove-samples-confirm"
              className="min-h-[48px] bg-amber-500 text-slate-950 hover:bg-amber-400"
              onClick={async () => {
                const n = await removeSamples();
                toast.success(`${n} barang contoh dihapus`);
              }}
            >
              Hapus Contoh
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmWipe} onOpenChange={setConfirmWipe}>
        <AlertDialogContent className="max-w-[400px] border-slate-700 bg-[#1E293B] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEMUA data?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Semua barang, foto, dan riwayat akan hilang dari HP ini. Buat backup dulu jika perlu.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="min-h-[48px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">Batal</AlertDialogCancel>
            <AlertDialogAction
              data-testid="settings-wipe-confirm"
              className="min-h-[48px] bg-red-500 text-white hover:bg-red-600"
              onClick={async () => {
                await wipeAll();
                toast.success("Semua data dihapus");
              }}
            >
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
