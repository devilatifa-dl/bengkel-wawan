import React from "react";
import { ChevronRight, AlertTriangle } from "lucide-react";
import { ItemThumb } from "./ItemThumb";
import { rupiah } from "../lib/format";

export const ItemCard = ({ item, low, onClick, testid = "inventory-item-card", right }) => (
  <button
    type="button"
    data-testid={testid}
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-2xl border bg-[#1E293B] p-3 text-left transition-colors duration-150 hover:bg-[#233148] active:scale-[0.99] ${
      low ? "border-amber-500/60 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_8px_24px_rgba(245,158,11,0.08)]" : "border-slate-700/70"
    }`}
  >
    <ItemThumb blob={item.photo} className="h-[68px] w-[68px]" rounded="rounded-xl" />
    <div className="min-w-0 flex-1">
      <div className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-100">{item.name}</div>
      <div className="mt-0.5 flex items-center gap-2">
        <span className="truncate font-mono text-xs text-cyan-300/90">{item.partCode || "—"}</span>
        {item.size ? <span data-testid="item-card-size" className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-amber-300">{item.size}</span> : null}
        {item.isSample ? (
          <span data-testid="example-item-badge" className="shrink-0 rounded-full border border-amber-500/50 px-2 py-0.5 text-[10px] font-semibold leading-none text-amber-400">
            Contoh
          </span>
        ) : null}
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-400">
        {[item.brand, item.compatibility].filter(Boolean).join(" • ") || "—"}
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      {right || (
        <>
          <span className="tabular font-display text-base font-bold text-white">{rupiah(item.sellPrice)}</span>
          {item.stock !== null && item.stock !== undefined ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                low ? "bg-amber-500/15 text-amber-300" : "bg-slate-800 text-slate-300"
              }`}
            >
              {low && <AlertTriangle className="h-3 w-3" />}Stok {item.stock}
            </span>
          ) : (
            <span className="text-[11px] text-slate-500">Stok —</span>
          )}
        </>
      )}
    </div>
    <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
  </button>
);
