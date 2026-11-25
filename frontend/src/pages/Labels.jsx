import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Printer, FileDown, Share2, Search, X, Check, Minus, Plus, Loader2, Tags } from "lucide-react";
import { db, searchItems, liveItems } from "../lib/db";
import { rupiah } from "../lib/format";
import { useSettings } from "../lib/hooks";
import { LABEL_SIZES, gridFor, expandLabels, buildLabelsPdf, labelsFileName, labelMetaLine, PAGE } from "../lib/labels";
import { PageHeader } from "../components/PageHeader";
import { ItemThumb } from "../components/ItemThumb";
import { Switch } from "../components/ui/switch";

/** One sticker drawn in real millimetres (used for preview + print). */
export const LabelSticker = ({ item, size, shopName, showShop, showCompat, testid }) => {
  const pad = Math.max(2, size.h * 0.08);
  return (
    <div
      data-testid={testid}
      style={{
        width: `${size.w}mm`,
        height: `${size.h}mm`,
        padding: `${pad}mm ${pad}mm ${pad}mm ${pad + 1.2}mm`,
        border: "0.3mm solid #282828",
        borderRadius: "1.8mm",
        background: "#fff",
        color: "#0f0f0f",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Helvetica, Arial, sans-serif",
        breakInside: "avoid",
      }}
    >
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "1.6mm", background: "#F59E0B" }} />
      {showShop && shopName && (
        <div style={{ fontSize: `${size.shop}pt`, color: "#6e6e6e", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.15 }}>{shopName}</div>
      )}
      <div style={{ fontSize: `${size.title}pt`, fontWeight: 700, lineHeight: 1.1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: "0.4mm" }}>{item.name}</div>
      {labelMetaLine(item) && (
        <div style={{ fontSize: `${size.meta}pt`, fontFamily: "Courier New, monospace", fontWeight: 700, color: "#3c3c3c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: "0.5mm" }}>{labelMetaLine(item)}</div>
      )}
      {showCompat && item.compatibility && (
        <div style={{ fontSize: `${size.meta}pt`, color: "#5a5a5a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.compatibility}</div>
      )}
      <div style={{ marginTop: "auto", fontSize: `${size.price}pt`, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em" }}>{rupiah(item.sellPrice)}</div>
    </div>
  );
};

export default function Labels() {
  const [params] = useSearchParams();
  const settings = useSettings();
  const items = useLiveQuery(() => liveItems().toArray(), [], null);
  const [selected, setSelected] = useState({}); // id -> copies
  const [q, setQ] = useState("");
  const [sizeKey, setSizeKey] = useState("sedang");
  const [showShop, setShowShop] = useState(true);
  const [showCompat, setShowCompat] = useState(false);
  const [busy, setBusy] = useState("");
  const [initDone, setInitDone] = useState(false);

  useEffect(() => {
    if (initDone || !items) return;
    const ids = (params.get("ids") || "").split(",").map(Number).filter(Boolean);
    if (ids.length) {
      const next = {};
      ids.forEach((id) => items.some((i) => i.id === id) && (next[id] = 1));
      setSelected(next);
    }
    setInitDone(true);
  }, [items, params, initDone]);

  const size = LABEL_SIZES[sizeKey];
  const grid = gridFor(size);
  const list = useMemo(() => {
    const base = searchItems(items || [], q);
    return q ? base : [...base].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [items, q]);
  const chosen = useMemo(() => (items || []).filter((i) => selected[i.id]).sort((a, b) => a.name.localeCompare(b.name, "id")), [items, selected]);
  const labels = useMemo(() => expandLabels(chosen, selected), [chosen, selected]);
  const pages = Math.ceil(labels.length / grid.perPage) || 0;
  const previewItem = chosen[0] || (items && items[0]) || { name: "Nama Barang", partCode: "KODE-PART", sellPrice: 15000 };

  const toggle = (id) =>
    setSelected((s) => {
      const n = { ...s };
      if (n[id]) delete n[id];
      else n[id] = 1;
      return n;
    });
  const setCopies = (id, v) => setSelected((s) => ({ ...s, [id]: Math.max(1, Math.min(99, v)) }));
  const allSelected = list.length > 0 && list.every((i) => selected[i.id]);
  const selectAll = () =>
    setSelected((s) => {
      const n = { ...s };
      if (allSelected) list.forEach((i) => delete n[i.id]);
      else list.forEach((i) => (n[i.id] = n[i.id] || 1));
      return n;
    });

  const opts = { shopName: settings.shopName, showShop, showCompat };

  const downloadPdf = async () => {
    if (!labels.length) return toast.error("Pilih minimal 1 barang");
    setBusy("pdf");
    try {
      const doc = buildLabelsPdf(labels, sizeKey, opts);
      doc.save(labelsFileName());
      toast.success(`PDF diunduh: ${labels.length} label • ${pages} halaman A4`);
    } catch (e) {
      toast.error("Gagal membuat PDF");
    } finally {
      setBusy("");
    }
  };

  const sharePdf = async () => {
    if (!labels.length) return toast.error("Pilih minimal 1 barang");
    setBusy("share");
    try {
      const doc = buildLabelsPdf(labels, sizeKey, opts);
      const file = new File([doc.output("blob")], labelsFileName(), { type: "application/pdf" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Label Harga" });
      } else {
        doc.save(labelsFileName());
      }
    } catch (e) {
      if (e && e.name !== "AbortError") toast.error("Gagal membagikan PDF");
    } finally {
      setBusy("");
    }
  };

  const print = () => {
    if (!labels.length) return toast.error("Pilih minimal 1 barang");
    setTimeout(() => window.print(), 50);
  };

  const pageChunks = [];
  for (let i = 0; i < labels.length; i += grid.perPage) pageChunks.push(labels.slice(i, i + grid.perPage));

  return (
    <div data-testid="labels-page" className="pb-[calc(170px+env(safe-area-inset-bottom))]">
      <div className="no-print">
        <PageHeader back title="Cetak Label Harga" subtitle="Stiker harga untuk rak • kertas A4" />
        <div className="space-y-4 px-4 pt-4 sm:px-6 lg:px-8">
          {/* Options */}
          <section className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4" data-testid="labels-options">
            <div className="mb-2 text-sm font-semibold text-slate-200">Ukuran Label</div>
            <div className="grid grid-cols-3 gap-2" data-testid="labels-size-options">
              {Object.values(LABEL_SIZES).map((s) => {
                const g = gridFor(s);
                const on = sizeKey === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    data-testid={`labels-size-${s.key}`}
                    onClick={() => setSizeKey(s.key)}
                    className={`flex min-h-[72px] flex-col items-center justify-center rounded-xl border px-1 text-center transition-colors duration-150 ${on ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#0B1220] text-slate-200"}`}
                  >
                    <span className="text-sm font-bold">{s.name}</span>
                    <span className={`tabular text-[11px] ${on ? "text-slate-900" : "text-slate-400"}`}>{s.w}×{s.h} mm</span>
                    <span className={`text-[10px] ${on ? "text-slate-900" : "text-slate-500"}`}>{g.perPage}/hal A4</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">Tampilkan nama toko</span>
              <Switch data-testid="labels-show-shop-switch" checked={showShop} onCheckedChange={setShowShop} className="data-[state=checked]:bg-cyan-500" />
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-slate-300">Tampilkan kecocokan motor</span>
              <Switch data-testid="labels-show-compat-switch" checked={showCompat} onCheckedChange={setShowCompat} className="data-[state=checked]:bg-cyan-500" />
            </div>
          </section>

          {/* Preview */}
          <section className="rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Pratinjau</span>
              <span className="text-xs text-slate-500">ukuran asli saat dicetak</span>
            </div>
            <div className="flex items-center justify-center overflow-hidden rounded-xl bg-[#e5e7eb] p-4" data-testid="labels-preview">
              <div style={{ transform: sizeKey === "besar" ? "scale(0.9)" : "none", transformOrigin: "center" }}>
                <LabelSticker item={previewItem} size={size} {...opts} testid="labels-preview-sticker" />
              </div>
            </div>
          </section>

          {/* Item picker */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-base font-semibold text-white">Pilih Barang</span>
              <button type="button" data-testid="labels-select-all" onClick={selectAll} className="min-h-[40px] text-sm font-semibold text-cyan-400">
                {allSelected ? "Batalkan semua" : `Pilih semua (${list.length})`}
              </button>
            </div>
            <div className="mb-3 flex h-12 items-center gap-3 rounded-xl border border-slate-700 bg-[#0B1220] px-4 focus-within:ring-2 focus-within:ring-cyan-400/70">
              <Search className="h-5 w-5 text-slate-400" />
              <input data-testid="labels-search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari barang…" className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500" />
              {q && (
                <button type="button" onClick={() => setQ("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300" aria-label="Hapus">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2" data-testid="labels-item-list">
              {!items && <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-400" />}
              {list.map((it) => {
                const on = !!selected[it.id];
                return (
                  <div key={it.id} className={`flex items-center gap-3 rounded-2xl border p-2.5 transition-colors duration-150 ${on ? "border-cyan-500/60 bg-[#13233A]" : "border-slate-700/70 bg-[#1E293B]"}`}>
                    <button type="button" data-testid={`labels-item-toggle-${it.id}`} onClick={() => toggle(it.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${on ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-600"}`}>{on && <Check className="h-5 w-5" strokeWidth={3} />}</span>
                      <ItemThumb blob={it.photo} className="h-11 w-11" iconSize="h-5 w-5" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-100">{it.name}</span>
                        <span className="tabular block text-xs text-amber-400">{rupiah(it.sellPrice)}</span>
                      </span>
                    </button>
                    {on && (
                      <div className="flex shrink-0 items-center gap-1" data-testid={`labels-copies-${it.id}`}>
                        <button type="button" data-testid={`labels-copies-minus-${it.id}`} onClick={() => setCopies(it.id, selected[it.id] - 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Kurangi">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span data-testid={`labels-copies-value-${it.id}`} className="tabular w-8 text-center text-base font-bold text-white">{selected[it.id]}</span>
                        <button type="button" data-testid={`labels-copies-plus-${it.id}`} onClick={() => setCopies(it.id, selected[it.id] + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Tambah">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {items && list.length === 0 && <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Tidak ada barang.</div>}
            </div>
          </section>
        </div>

        {/* Action bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full border-t border-slate-700 bg-[#0B1220] px-4 pt-3 lg:hidden" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-300" data-testid="labels-summary">
            <Tags className="h-4 w-4 text-amber-400" />
            {labels.length ? (
              <span>
                <b className="text-white">{labels.length}</b> label dari {chosen.length} barang • {pages} halaman A4
              </span>
            ) : (
              <span className="text-slate-500">Belum ada barang dipilih</span>
            )}
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <button type="button" data-testid="labels-download-pdf-button" onClick={downloadPdf} disabled={!labels.length || !!busy} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-amber-500 font-bold text-slate-950 transition-colors duration-150 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-50">
              {busy === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileDown className="h-5 w-5" />} Unduh PDF
            </button>
            <button type="button" data-testid="labels-print-button" onClick={print} disabled={!labels.length || !!busy} className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-cyan-500 font-bold text-slate-950 transition-colors duration-150 hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-50">
              <Printer className="h-5 w-5" /> Cetak
            </button>
            {typeof navigator !== "undefined" && navigator.canShare && (
              <button type="button" data-testid="labels-share-pdf-button" onClick={sharePdf} disabled={!labels.length || !!busy} className="flex min-h-[56px] w-14 items-center justify-center rounded-xl border border-slate-600 text-slate-100 active:scale-95 disabled:opacity-50" aria-label="Bagikan PDF">
                {busy === "share" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Print-only sheet (A4, real mm) */}
      <div className="print-area" data-testid="labels-print-area" aria-hidden="true">
        {pageChunks.map((chunk, pi) => (
          <div
            key={pi}
            className="print-page"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${grid.cols}, ${size.w}mm)`,
              gridAutoRows: `${size.h}mm`,
              gap: `${PAGE.gap}mm`,
              padding: `${PAGE.margin}mm`,
            }}
          >
            {chunk.map((it, i) => (
              <LabelSticker key={`${pi}-${i}`} item={it} size={size} {...opts} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
