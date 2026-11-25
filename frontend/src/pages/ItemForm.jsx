import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Camera, Image as ImageIcon, Minus, Plus, Loader2, TrendingUp, Percent, AlertTriangle, Trash2, Save, Sparkles, Ruler, Settings2 } from "lucide-react";
import { OptionsEditor } from "../components/OptionsEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { db, saveItem, findDuplicate, SIZE_KEYWORDS, DEFAULT_BRANDS, DEFAULT_MOTORS } from "../lib/db";
import { compressImage } from "../lib/image";
import { computeEmbedding, runOcr } from "../lib/ai";
import { formatSize } from "../lib/match";
import { takeDraft } from "../lib/draft";
import { calcProfit, rupiah, percent } from "../lib/format";
import { useBlobUrl, useSettings } from "../lib/hooks";
import { syncNow } from "../lib/sync";
import { SizeInput } from "../components/SizeInput";
import { PageHeader } from "../components/PageHeader";
import { MoneyInput } from "../components/MoneyInput";
import { Switch } from "../components/ui/switch";


function Field({ label, hint, children, htmlFor, manage, onManage }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-200">
          {label} {hint && <span className="font-normal text-slate-500">{hint}</span>}
        </label>
        {manage && (
          <button type="button" onClick={onManage} data-testid={`${manage}-manage-link`} className="inline-flex min-h-[36px] items-center gap-1 px-1 text-xs font-semibold text-cyan-400">
            <Settings2 className="h-3.5 w-3.5" /> Kelola daftar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-xl border border-slate-700 bg-[#0B1220] px-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-400/70 transition-shadow";

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
}

export default function ItemForm() {
  const { id } = useParams();
  const editId = id ? Number(id) : null;
  const navigate = useNavigate();
  const settings = useSettings();
  const BRANDS = settings.brandOptions || [];
  const MOTORS = settings.motorOptions || [];
  const [showSize, setShowSize] = useState(false);
  const [manageKey, setManageKey] = useState(null);
  const camRef = useRef(null);
  const galRef = useRef(null);
  const [loaded, setLoaded] = useState(!editId);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [embedding, setEmbedding] = useState(null);
  const [ocr, setOcr] = useState(null); // { tokens, sizes, at }
  const [ocrBusy, setOcrBusy] = useState(false);
  const ocrPromiseRef = useRef(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [fromScan, setFromScan] = useState(false);
  const [f, setF] = useState({ name: "", partCode: "", size: "", brand: "", compatibility: "", costPrice: 0, sellPrice: 0 });
  const [trackStock, setTrackStock] = useState(true);
  const [stock, setStock] = useState(1);
  const [errors, setErrors] = useState({});
  const photoUrl = useBlobUrl(photo);

  useEffect(() => {
    (async () => {
      if (editId) {
        const it = await db.items.get(editId);
        if (!it) {
          toast.error("Barang tidak ditemukan");
          navigate("/barang", { replace: true });
          return;
        }
        setF({ name: it.name, partCode: it.partCode || "", size: it.size || "", brand: it.brand || "", compatibility: it.compatibility || "", costPrice: it.costPrice || 0, sellPrice: it.sellPrice || 0 });
        setPhoto(it.photo || null);
        if (it.ocrAt) setOcr({ tokens: it.ocrTokens || [], sizes: it.ocrSizes || [], at: it.ocrAt });
        setEmbedding(it.embedding || null);
        const has = it.stock !== null && it.stock !== undefined;
        setTrackStock(has);
        setStock(has ? it.stock : 1);
        setLoaded(true);
      } else {
        const d = takeDraft();
        if (d) {
          setFromScan(!!d.photo);
          if (d.photo) {
            setPhoto(d.photo);
            setPhotoChanged(true);
          }
          if (d.embedding) setEmbedding(d.embedding);
          setF((s) => ({ ...s, partCode: d.partCode || "", name: d.nameGuess || "", size: d.size || "" }));
          if (d.ocrTokens) setOcr({ tokens: d.ocrTokens, sizes: d.ocrSizes || [], at: Date.now() });
        }
      }
    })();
  }, [editId, navigate]);

  const set = (k) => (e) => {
    const v = e && e.target ? e.target.value : e;
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: null }));
  };

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const blob = await compressImage(file, 1024, 0.78);
      setPhoto(blob);
      setEmbedding(null);
      setOcr(null);
      setPhotoChanged(true);
      // read the label on the ORIGINAL (full-res) photo: remembered for scan matching + auto-fill
      setOcrBusy(true);
      const big = await compressImage(file, 2000, 0.9).catch(() => blob);
      const p = runOcr(big)
        .then((o) => {
          const res = { tokens: o.tokens, sizes: o.sizes, code: o.code, at: Date.now() };
          setOcr(res);
          setF((s) => ({
            ...s,
            partCode: s.partCode || o.code || "",
            size: s.size || (o.sizes[0] ? formatSize(o.sizes[0]) : ""),
          }));
          if (o.code || o.sizes[0]) toast.success("Kode / ukuran terbaca dari foto label — silakan cek");
          return res;
        })
        .catch(() => null)
        .finally(() => setOcrBusy(false));
      ocrPromiseRef.current = p;
      toast.success(`Foto dikompres (${Math.round(blob.size / 1024)} KB)`);
    } catch (err) {
      toast.error("Gagal membaca foto");
    }
  };

  const toggleMotor = (m) => {
    const list = f.compatibility.split(",").map((s) => s.trim()).filter(Boolean);
    const idx = list.findIndex((x) => x.toLowerCase() === m.toLowerCase());
    if (idx >= 0) list.splice(idx, 1);
    else list.push(m);
    setF((s) => ({ ...s, compatibility: list.join(", ") }));
  };

  const { profit, margin } = calcProfit(f.costPrice, f.sellPrice);
  const loss = f.sellPrice > 0 && profit < 0;

  const submit = async (e) => {
    e && e.preventDefault();
    const er = {};
    if (!f.name.trim()) er.name = "Nama barang wajib diisi";
    if (!f.sellPrice) er.sellPrice = "Harga jual wajib diisi";
    setErrors(er);
    if (Object.keys(er).length) {
      toast.error(Object.values(er)[0]);
      return;
    }
    setSaving(true);
    try {
      let emb = embedding;
      if (photo && (!emb || (photoChanged && !fromScan))) {
        try {
          emb = await withTimeout(computeEmbedding(photo), 25000);
        } catch (err) {
          emb = null; // background indexer will retry later
        }
      }
      if (!photo) emb = null;
      let o = ocr;
      if (!o && ocrPromiseRef.current) o = await withTimeout(ocrPromiseRef.current, 20000).catch(() => null);
      // OCR may finish after the user tapped save: apply its auto-fill too (only to empty fields)
      const fill = {};
      if (o && !f.partCode && o.code) fill.partCode = o.code;
      if (o && !f.size && o.sizes && o.sizes[0]) fill.size = formatSize(o.sizes[0]);
      const payload = {
        ...f,
        ...fill,
        photo,
        embedding: emb,
        stock: trackStock ? stock : null,
        ocrTokens: photo && o ? o.tokens : null,
        ocrSizes: photo && o ? o.sizes : null,
        ocrAt: photo && o ? o.at : null,
      };
      // Cegah barang ganda: kode part sama, atau nama sama bila kode part kosong.
      const dup = await findDuplicate(payload, editId);
      if (dup) {
        setSaving(false);
        toast.error(`Barang sudah ada: "${dup.name}". Buka barang itu untuk mengubah stok/harga.`);
        navigate(`/barang/${dup.id}`, { replace: true });
        return;
      }
      const newId = await saveItem(payload, editId);
      toast.success(editId ? "Perubahan disimpan" : "Barang baru tersimpan");
      // Kirim segera ke server supaya perangkat lain langsung melihatnya.
      syncNow().catch(() => {});
      navigate(`/barang/${newId}`, { replace: true });
    } catch (err) {
      toast.error("Gagal menyimpan: " + (err?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }

  const motorList = f.compatibility.split(",").map((s) => s.trim().toLowerCase());

  return (
    <div data-testid="product-form-page" className="pb-[calc(120px+env(safe-area-inset-bottom))]">
      <PageHeader back title={editId ? "Edit Barang" : "Tambah Barang Baru"} subtitle={fromScan ? "Foto & kode dari hasil scan sudah terisi" : "Data tersimpan offline di HP"} />
      <form onSubmit={submit} className="flex flex-col gap-5 px-4 pt-4 sm:px-6 lg:px-8">
        {/* Photo */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-slate-200">Foto Produk</span>
          <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-[#0B1220]" data-testid="product-form-photo-preview">
            {photoUrl ? (
              <img src={photoUrl} alt="Foto produk" className="h-56 w-full object-cover" />
            ) : (
              <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-500">
                <Camera className="h-10 w-10" />
                <span className="text-sm">Belum ada foto</span>
              </div>
            )}
            {photoUrl && (
              <button
                type="button"
                data-testid="product-form-remove-photo"
                onClick={() => {
                  setPhoto(null);
                  setEmbedding(null);
                  setOcr(null);
                  setPhotoChanged(true);
                }}
                className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-red-400"
                aria-label="Hapus foto"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            )}
            {photoUrl && (
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-cyan-300 border border-slate-700">
                {ocrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {ocrBusy ? "Membaca teks label…" : ocr ? `Label terbaca (${ocr.tokens.length} kata) • dipakai AI scan` : "Dipakai AI untuk pencocokan foto"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" data-testid="product-form-camera-button" onClick={() => camRef.current.click()} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 bg-[#1E293B] font-semibold text-slate-100 active:scale-[0.98]">
              <Camera className="h-5 w-5 text-cyan-400" /> Kamera
            </button>
            <button type="button" data-testid="product-form-gallery-button" onClick={() => galRef.current.click()} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 bg-[#1E293B] font-semibold text-slate-100 active:scale-[0.98]">
              <ImageIcon className="h-5 w-5 text-cyan-400" /> Galeri
            </button>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="product-form-camera-input" onChange={onFile} />
          <input ref={galRef} type="file" accept="image/*" className="hidden" data-testid="product-form-photo-input" onChange={onFile} />
        </div>

        <Field label="Nama Barang" htmlFor="f-name">
          <input id="f-name" data-testid="product-form-name-input" value={f.name} onChange={set("name")} placeholder="cth. Kampas Rem Depan" className={`${inputCls} ${errors.name ? "border-red-500" : ""}`} />
          {errors.name && <span className="text-xs text-red-400">{errors.name}</span>}
        </Field>

        <Field label="Kode Part / Nomor Seri" hint="(opsional)" htmlFor="f-code">
          <input id="f-code" data-testid="product-form-code-input" value={f.partCode} onChange={(e) => set("partCode")(e.target.value.toUpperCase())} placeholder="cth. 06455-KVB-305" className={`${inputCls} font-mono uppercase placeholder:normal-case`} autoCapitalize="characters" />
        </Field>

        {showSize || f.size || SIZE_KEYWORDS.test(f.name) ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-[#111A2E] p-4" data-testid="product-form-size-section">
            <div className="mb-3 flex items-center gap-2">
              <Ruler className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-semibold text-slate-200">Ukuran</span>
              <span className="text-xs text-slate-500">(seal / karet / o-ring / bearing)</span>
            </div>
            <SizeInput value={f.size} onChange={(v) => setF((s) => ({ ...s, size: v }))} />
          </div>
        ) : (
          <button type="button" data-testid="product-form-show-size" onClick={() => setShowSize(true)} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600 text-sm font-semibold text-slate-300 active:scale-[0.99]">
            <Ruler className="h-4 w-4 text-cyan-400" /> Tambah Ukuran (untuk seal / karet)
          </button>
        )}

        <Field label="Merk" htmlFor="f-brand" manage="product-form-brand" onManage={() => setManageKey("brandOptions")}>
          <input id="f-brand" data-testid="product-form-brand-input" value={f.brand} onChange={set("brand")} placeholder="cth. Honda AHM, Yamaha YGP, Federal" className={inputCls} />
          <div className="flex flex-wrap gap-2">
            {BRANDS.map((b) => (
              <button key={b} type="button" data-testid={`product-form-brand-chip-${b.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => setF((s) => ({ ...s, brand: b }))} className={`min-h-[38px] shrink-0 rounded-full border px-3 text-sm font-medium ${f.brand === b ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#1E293B] text-slate-300"}`}>
                {b}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Kecocokan Motor" htmlFor="f-compat" manage="product-form-motor" onManage={() => setManageKey("motorOptions")}>
          <input id="f-compat" data-testid="product-form-compat-input" value={f.compatibility} onChange={set("compatibility")} placeholder="cth. Vario 125, Vario 150" className={inputCls} />
          <div className="flex flex-wrap gap-2">
            {MOTORS.map((m) => {
              const on = motorList.includes(m.toLowerCase());
              return (
                <button key={m} type="button" data-testid={`product-form-motor-chip-${m.toLowerCase().replace(/\s+/g, "-")}`} onClick={() => toggleMotor(m)} className={`min-h-[38px] rounded-full border px-3 text-sm font-medium ${on ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#1E293B] text-slate-300"}`}>
                  {m}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4">
          <Field label="Harga Modal" htmlFor="f-cost">
            <MoneyInput id="f-cost" testid="product-form-cost-input" value={f.costPrice} onChange={set("costPrice")} />
          </Field>
          <Field label="Harga Jual" htmlFor="f-sell">
            <MoneyInput id="f-sell" testid="product-form-sell-input" value={f.sellPrice} onChange={set("sellPrice")} accent="amber" />
            {errors.sellPrice && <span className="text-xs text-red-400">{errors.sellPrice}</span>}
          </Field>
        </div>

        <div data-testid="profit-calculator" className={`rounded-2xl border p-4 ${loss ? "border-red-500/50 bg-red-500/5" : "border-emerald-500/30 bg-[#0B1220]"}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Kalkulator Untung Otomatis</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[#1E293B] p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400"><TrendingUp className="h-3.5 w-3.5" /> Keuntungan</div>
              <div data-testid="profit-calculator-profit" className={`tabular font-display mt-1 text-xl font-bold ${loss ? "text-red-400" : "text-emerald-400"}`}>{rupiah(profit)}</div>
            </div>
            <div className="rounded-xl bg-[#1E293B] p-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-400"><Percent className="h-3.5 w-3.5" /> Margin</div>
              <div data-testid="profit-calculator-margin" className={`tabular font-display mt-1 text-xl font-bold ${loss ? "text-red-400" : "text-cyan-300"}`}>{percent(margin)}</div>
            </div>
          </div>
          {loss && (
            <div className="mt-3 flex items-center gap-2 text-sm text-red-300" data-testid="profit-calculator-loss-warning">
              <AlertTriangle className="h-4 w-4" /> Harga jual lebih rendah dari modal (rugi)
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-500">Margin = keuntungan ÷ harga jual</p>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-[#1E293B] p-4" data-testid="product-form-stock-section">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-200">Stok</div>
              <div className="text-xs text-slate-400">Opsional — matikan jika tidak ingin menghitung stok</div>
            </div>
            <Switch data-testid="product-form-track-stock-switch" checked={trackStock} onCheckedChange={setTrackStock} className="data-[state=checked]:bg-cyan-500" />
          </div>
          {trackStock && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" data-testid="product-form-stock-minus" onClick={() => setStock((s) => Math.max(0, s - 1))} className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Kurangi stok">
                <Minus className="h-6 w-6" />
              </button>
              <input data-testid="product-form-stock-input" inputMode="numeric" value={stock} onChange={(e) => setStock(Math.max(0, parseInt(e.target.value.replace(/\D/g, "") || "0", 10)))} className="tabular font-display h-14 w-full rounded-xl border border-slate-700 bg-[#0B1220] text-center text-2xl font-bold text-white outline-none focus:ring-2 focus:ring-cyan-400/70" />
              <button type="button" data-testid="product-form-stock-plus" onClick={() => setStock((s) => s + 1)} className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Tambah stok">
                <Plus className="h-6 w-6" />
              </button>
            </div>
          )}
        </div>
      </form>

      <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full border-t border-slate-700 bg-[#0B1220] px-4 pt-3 sm:px-6 lg:px-8" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <button
          type="button"
          data-testid="product-form-save-button"
          onClick={submit}
          disabled={saving}
          className="inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-lg font-bold text-slate-950 transition-colors duration-150 hover:bg-amber-400 active:scale-[0.99] disabled:opacity-70"
        >
          {saving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
          {saving ? "Menyimpan & menyiapkan AI…" : "Simpan Barang"}
        </button>
      </div>
      <Dialog open={!!manageKey} onOpenChange={(o) => !o && setManageKey(null)}>
        <DialogContent className="max-w-[420px] border-slate-700 bg-[#1E293B] text-slate-100" data-testid="product-form-manage-dialog">
          <DialogHeader>
            <DialogTitle>{manageKey === "brandOptions" ? "Kelola Daftar Merk" : "Kelola Daftar Motor"}</DialogTitle>
            <DialogDescription className="text-slate-400">Pilihan ini muncul sebagai tombol cepat. Data form Anda tidak hilang.</DialogDescription>
          </DialogHeader>
          {manageKey && (
            <OptionsEditor
              settingKey={manageKey}
              options={settings[manageKey]}
              defaults={manageKey === "brandOptions" ? DEFAULT_BRANDS : DEFAULT_MOTORS}
              placeholder={manageKey === "brandOptions" ? "cth. Daytona" : "cth. Vario 160"}
              testid="form-options-editor"
              emptyText="Belum ada pilihan"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
