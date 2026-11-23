import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "./ui/drawer";
import { ScanLine, ChevronRight, Tag, Bike, Boxes, AlertTriangle, X, Ruler } from "lucide-react";
import { rupiah, calcProfit, percent } from "../lib/format";
import { useBlobUrl, useSettings } from "../lib/hooks";
import { isLowStock } from "../lib/db";
import { evidenceLabel } from "../lib/match";
import { Masked, EyeToggle } from "./Masked";
import { ItemThumb } from "./ItemThumb";

export const PriceOverlay = ({ open, onOpenChange, item, candidates = [], onPickCandidate, onScanAgain, sourceLabel, evidence }) => {
  const navigate = useNavigate();
  const [shown, setShown] = useState(false);
  const settings = useSettings();
  const url = useBlobUrl(item?.photo);
  useEffect(() => {
    if (open) setShown(false);
  }, [open, item?.id]);
  if (!item) return null;
  const { profit, margin } = calcProfit(item.costPrice, item.sellPrice);
  const low = isLowStock(item, settings.lowStockThreshold);
  const compat = (item.compatibility || "").split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-testid="scan-result-overlay"
        className="mx-auto max-w-[480px] border-slate-700 bg-[#111A2E] text-slate-100 max-h-[94vh]"
      >
        <DrawerTitle className="sr-only">{item.name}</DrawerTitle>
        <DrawerDescription className="sr-only">Detail harga barang</DrawerDescription>
        <div className="overflow-y-auto no-scrollbar px-4 pb-5">
          <div className="relative mt-3 overflow-hidden rounded-2xl border border-slate-700 bg-[#0B1220]">
            {url ? (
              <img src={url} alt={item.name} className="h-60 w-full object-cover" data-testid="overlay-photo" />
            ) : (
              <div className="flex h-40 items-center justify-center text-slate-600">Tidak ada foto</div>
            )}
            {sourceLabel && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950">
                <ScanLine className="h-3.5 w-3.5" /> {sourceLabel}
              </span>
            )}
            {item.isSample ? (
              <span className="absolute right-3 top-3 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-amber-400 border border-amber-500/50">
                Contoh
              </span>
            ) : null}
            <button
              type="button"
              data-testid="overlay-close-button"
              onClick={() => onOpenChange(false)}
              className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-slate-200 border border-slate-700 active:scale-95"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {evidence && evidenceLabel(evidence) && (
            <div data-testid="overlay-evidence" className="mt-3 rounded-lg border border-slate-700 bg-[#0B1220] px-3 py-2 text-xs font-medium text-cyan-300">
              Alasan cocok: {evidenceLabel(evidence)}
            </div>
          )}
          <div className="mt-4">
            <h2 data-testid="overlay-item-name" className="font-display text-2xl font-semibold leading-tight text-white">
              {item.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.partCode && (
                <span data-testid="overlay-part-code" className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 font-mono text-sm font-semibold text-cyan-300">
                  <Tag className="h-3.5 w-3.5" /> {item.partCode}
                </span>
              )}
              {item.size && (
                <span data-testid="overlay-size" className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 font-mono text-sm font-semibold text-amber-300">
                  <Ruler className="h-3.5 w-3.5" /> {item.size} mm
                </span>
              )}
              {item.brand && <span className="rounded-md bg-slate-800 px-2.5 py-1 text-sm font-medium text-slate-300">{item.brand}</span>}
            </div>
            {compat.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="overlay-compat">
                <Bike className="h-4 w-4 text-slate-400" />
                {compat.map((c) => (
                  <span key={c} className="rounded-full border border-slate-700 bg-[#0B1220] px-3 py-1 text-xs font-medium text-slate-200">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-amber-500/40 bg-[#0B1220] p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Harga Jual</div>
            <div data-testid="overlay-sell-price" className="tabular font-display mt-1 text-5xl font-bold tracking-tight text-white">
              {rupiah(item.sellPrice)}
            </div>
            {item.stock !== null && item.stock !== undefined && (
              <div className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${low ? "bg-amber-500/15 text-amber-300 border border-amber-500/50" : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"}`} data-testid="overlay-stock">
                {low ? <AlertTriangle className="h-4 w-4" /> : <Boxes className="h-4 w-4" />}
                Stok: {item.stock} {low ? "• Menipis" : ""}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-700 bg-[#1E293B] p-3" data-testid="overlay-cost-section">
            <div className="grid flex-1 grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Modal</div>
                <Masked shown={shown} testid="overlay-cost-price" className="text-base font-semibold text-slate-200">
                  {rupiah(item.costPrice)}
                </Masked>
              </div>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Untung</div>
                <Masked shown={shown} testid="overlay-profit" className={`text-base font-semibold ${profit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {rupiah(profit)} <span className="text-xs text-slate-400">({percent(margin)})</span>
                </Masked>
              </div>
            </div>
            <EyeToggle shown={shown} onToggle={() => setShown((s) => !s)} testid="overlay-cost-eye-toggle" label={false} className="h-12 w-12 justify-center px-0" />
          </div>

          {candidates.length > 0 && (
            <div className="mt-5" data-testid="overlay-candidates">
              <div className="mb-2 text-sm font-medium text-slate-400">Bukan ini? Pilih yang benar (akan diingat):</div>
              <div className="flex flex-col gap-2">
                {candidates.map((c) => (
                  <button
                    key={c.item.id}
                    type="button"
                    data-testid={`overlay-candidate-${c.item.id}`}
                    onClick={() => onPickCandidate && onPickCandidate(c)}
                    className="flex min-h-[60px] items-center gap-3 rounded-xl border border-slate-700 bg-[#1E293B] p-2 text-left transition-colors duration-150 hover:border-cyan-500/50 active:scale-[0.99]"
                  >
                    <ItemThumb blob={c.item.photo} className="h-12 w-12" iconSize="h-5 w-5" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-100">{c.item.name}</div>
                      <div className="truncate font-mono text-xs text-slate-400">{[c.item.partCode, c.item.size].filter(Boolean).join(" • ") || "-"}</div>
                    </div>
                    <span className="tabular text-xs font-semibold text-cyan-300">{Math.round(c.score * 100)}%</span>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="overlay-detail-button"
              onClick={() => {
                onOpenChange(false);
                navigate(`/barang/${item.id}`);
              }}
              className="min-h-[56px] rounded-xl border border-slate-600 bg-[#1E293B] font-semibold text-slate-100 transition-colors duration-150 hover:bg-slate-700 active:scale-[0.98]"
            >
              Detail / Edit
            </button>
            <button
              type="button"
              data-testid="overlay-scan-again-button"
              onClick={() => (onScanAgain ? onScanAgain() : onOpenChange(false))}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-cyan-500 font-bold text-slate-950 transition-colors duration-150 hover:bg-cyan-400 active:scale-[0.98]"
            >
              <ScanLine className="h-5 w-5" /> {onScanAgain ? "Scan Lagi" : "Tutup"}
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
