import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Pencil, Trash2, Minus, Plus, Tag, Bike, History, AlertTriangle, Clock, Loader2, Sparkles, Ruler, Printer } from "lucide-react";
import { db, deleteItem, adjustStock, isLowStock, getLiveItem } from "../lib/db";
import { rupiah, calcProfit, percent, dateTime, timeAgo } from "../lib/format";
import { useBlobUrl, useSettings } from "../lib/hooks";
import { PageHeader } from "../components/PageHeader";
import { Masked, EyeToggle } from "../components/Masked";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";

export default function ItemDetail() {
  const { id } = useParams();
  const itemId = Number(id);
  const navigate = useNavigate();
  const settings = useSettings();
  const [shown, setShown] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const item = useLiveQuery(() => getLiveItem(itemId), [itemId], "loading");
  const history = useLiveQuery(() => db.priceHistory.where("itemId").equals(itemId).reverse().sortBy("at"), [itemId], []);
  const checks = useLiveQuery(() => db.scanHistory.where("itemId").equals(itemId).count(), [itemId], 0);
  const url = useBlobUrl(item && item !== "loading" ? item.photo : null);

  if (item === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
      </div>
    );
  }
  if (!item) {
    return (
      <div>
        <PageHeader back title="Barang" />
        <div className="p-8 text-center text-slate-400" data-testid="item-detail-not-found">Barang tidak ditemukan.</div>
      </div>
    );
  }

  const { profit, margin } = calcProfit(item.costPrice, item.sellPrice);
  const low = isLowStock(item, settings.lowStockThreshold);
  const compat = (item.compatibility || "").split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
  const hasStock = item.stock !== null && item.stock !== undefined;

  return (
    <div data-testid="item-detail-page" className="safe-bottom">
      <PageHeader
        back
        title="Detail Barang"
        right={
          <button type="button" data-testid="item-detail-edit-button" onClick={() => navigate(`/barang/${item.id}/edit`)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-cyan-500 px-4 font-bold text-slate-950 active:scale-95">
            <Pencil className="h-4 w-4" /> Edit
          </button>
        }
      />
      <div className="space-y-4 px-4 pt-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-[#0B1220]">
          {url ? <img src={url} alt={item.name} className="h-64 w-full object-cover" data-testid="item-detail-photo" /> : <div className="flex h-40 items-center justify-center text-slate-600">Tidak ada foto</div>}
          {item.isSample ? <span data-testid="example-item-badge" className="absolute right-3 top-3 rounded-full border border-amber-500/50 bg-slate-900 px-3 py-1 text-xs font-semibold text-amber-400">Contoh</span> : null}
          {item.photo && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300" data-testid="item-detail-ai-index">
              <Sparkles className={`h-3.5 w-3.5 ${item.embedding ? "text-cyan-400" : "text-slate-500"}`} /> {item.embedding ? "Siap dikenali kamera AI" : "Menunggu indeks AI"}
            </span>
          )}
        </div>

        <div>
          <h2 data-testid="item-detail-name" className="font-display text-2xl font-semibold text-white">{item.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.partCode && <span className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 font-mono text-sm font-semibold text-cyan-300"><Tag className="h-3.5 w-3.5" />{item.partCode}</span>}
            {item.size && <span data-testid="item-detail-size" className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-sm font-semibold text-amber-300"><Ruler className="h-3.5 w-3.5" />{item.size} mm</span>}
            {item.brand && <span className="rounded-md bg-slate-800 px-2.5 py-1 text-sm text-slate-300">{item.brand}</span>}
          </div>
          {compat.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Bike className="h-4 w-4 text-slate-400" />
              {compat.map((c) => <span key={c} className="rounded-full border border-slate-700 bg-[#0B1220] px-3 py-1 text-xs text-slate-200">{c}</span>)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-[#0B1220] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Harga Jual</div>
          <div data-testid="item-detail-sell-price" className="tabular font-display mt-1 text-5xl font-bold text-white">{rupiah(item.sellPrice)}</div>
        </div>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-[#1E293B] p-4">
          <div className="grid flex-1 grid-cols-3 gap-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Modal</div>
              <Masked shown={shown} testid="item-detail-cost-price" className="text-sm font-semibold text-slate-200">{rupiah(item.costPrice)}</Masked>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Untung</div>
              <Masked shown={shown} testid="item-detail-profit" className={`text-sm font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>{rupiah(profit)}</Masked>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">Margin</div>
              <span data-testid="item-detail-margin" className="tabular font-display text-sm font-semibold text-cyan-300">{shown ? percent(margin) : "••%"}</span>
            </div>
          </div>
          <EyeToggle shown={shown} onToggle={() => setShown((s) => !s)} testid="item-detail-cost-eye-toggle" label={false} className="h-12 w-12 justify-center px-0" />
        </div>

        <div className={`rounded-2xl border p-4 ${low ? "border-amber-500/60 bg-amber-500/5" : "border-slate-700 bg-[#1E293B]"}`} data-testid="item-detail-stock-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-200">Stok</div>
              {low && <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-amber-300" data-testid="item-detail-low-stock"><AlertTriangle className="h-3.5 w-3.5" /> Stok menipis (≤ {settings.lowStockThreshold})</div>}
              {!hasStock && <div className="text-xs text-slate-400">Stok tidak dilacak</div>}
            </div>
            {hasStock ? (
              <div className="flex items-center gap-2">
                <button type="button" data-testid="item-detail-stock-minus" onClick={() => adjustStock(item.id, -1)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Kurangi stok"><Minus className="h-5 w-5" /></button>
                <span data-testid="item-detail-stock-value" className="tabular font-display w-14 text-center text-3xl font-bold text-white">{item.stock}</span>
                <button type="button" data-testid="item-detail-stock-plus" onClick={() => adjustStock(item.id, 1)} className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-600 bg-[#0B1220] text-slate-100 active:scale-95" aria-label="Tambah stok"><Plus className="h-5 w-5" /></button>
              </div>
            ) : (
              <button type="button" data-testid="item-detail-enable-stock" onClick={() => db.items.update(item.id, { stock: 0 })} className="min-h-[44px] rounded-lg border border-slate-600 px-3 text-sm font-semibold text-slate-200">Lacak Stok</button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-[#1E293B] p-4" data-testid="item-detail-price-history">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><History className="h-4 w-4 text-cyan-400" /> Riwayat Harga</div>
          <div className="flex flex-col divide-y divide-slate-700/70">
            {(history || []).map((h, idx) => (
              <div key={h.id} className="flex items-center justify-between py-2.5" data-testid={`price-history-row-${idx}`}>
                <div className="text-xs text-slate-400">{dateTime(h.at)}</div>
                <div className="text-right">
                  <div className="tabular text-sm font-semibold text-white">Jual {rupiah(h.sellPrice)}</div>
                  <div className="tabular text-xs text-slate-400">Modal {shown ? rupiah(h.costPrice) : "Rp ••••••"}</div>
                </div>
              </div>
            ))}
            {(!history || history.length === 0) && <div className="py-2 text-sm text-slate-500">Belum ada riwayat</div>}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="h-3.5 w-3.5" /> Dicek {checks}x{item.lastCheckedAt ? ` • terakhir ${timeAgo(item.lastCheckedAt)}` : ""} • diubah {timeAgo(item.updatedAt)}
        </div>

        <button type="button" data-testid="item-detail-print-label-button" onClick={() => navigate(`/label?ids=${item.id}`)} className="inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border border-slate-600 bg-[#1E293B] font-semibold text-slate-100 active:scale-[0.99]">
          <Printer className="h-5 w-5 text-amber-400" /> Cetak Label Harga
        </button>

        <button type="button" data-testid="item-detail-delete-button" onClick={() => setConfirmDel(true)} className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 font-semibold text-red-400 active:scale-[0.99]">
          <Trash2 className="h-5 w-5" /> Hapus Barang
        </button>
      </div>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent className="max-w-[400px] border-slate-700 bg-[#1E293B] text-slate-100">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus “{item.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">Barang, foto, dan riwayat harganya akan dihapus dari HP ini.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel data-testid="item-delete-cancel" className="min-h-[48px] border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">Batal</AlertDialogCancel>
            <AlertDialogAction
              data-testid="item-delete-confirm"
              className="min-h-[48px] bg-red-500 text-white hover:bg-red-600"
              onClick={async () => {
                await deleteItem(item.id);
                toast.success("Barang dihapus");
                navigate("/barang", { replace: true });
              }}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
