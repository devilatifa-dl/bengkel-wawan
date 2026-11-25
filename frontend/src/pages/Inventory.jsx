import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Search, Plus, X, PackageOpen, ArrowDownUp, Printer } from "lucide-react";
import { db, isLowStock, searchItems, liveItems } from "../lib/db";
import { useSettings } from "../lib/hooks";
import { ItemCard } from "../components/ItemCard";
import { PageHeader } from "../components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";


export default function Inventory() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const settings = useSettings();
  const FILTERS = [
    { key: "semua", label: "Semua" },
    { key: "menipis", label: "Stok Menipis" },
    ...(settings.motorOptions || []).map((m) => ({ key: m.toLowerCase(), label: m })),
  ];
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("terbaru");
  const filter = params.get("filter") || "semua";
  const items = useLiveQuery(() => liveItems().toArray(), [], null);

  const list = useMemo(() => {
    if (!items) return [];
    let out = searchItems(items, q);
    if (filter === "menipis") out = out.filter((it) => isLowStock(it, settings.lowStockThreshold));
    else if (filter !== "semua") out = out.filter((it) => (it.compatibility || "").toLowerCase().includes(filter) || (it.name || "").toLowerCase().includes(filter));
    if (!q) {
      const s = [...out];
      if (sort === "terbaru") s.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      if (sort === "nama") s.sort((a, b) => a.name.localeCompare(b.name, "id"));
      if (sort === "harga") s.sort((a, b) => (b.sellPrice || 0) - (a.sellPrice || 0));
      if (sort === "stok") s.sort((a, b) => (a.stock ?? 1e9) - (b.stock ?? 1e9));
      return s;
    }
    return out;
  }, [items, q, filter, sort, settings.lowStockThreshold]);

  const setFilter = (k) => {
    if (k === "semua") params.delete("filter");
    else params.set("filter", k);
    setParams(params, { replace: true });
  };

  return (
    <div data-testid="inventory-page" className="safe-bottom">
      <PageHeader
        title="Daftar Barang"
        subtitle={items ? `${items.length} jenis barang tersimpan di HP` : "Memuat…"}
        right={
          <button type="button" data-testid="inventory-print-labels-button" onClick={() => navigate("/label")} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-600 bg-[#1E293B] px-3 text-sm font-semibold text-slate-100 active:scale-95">
            <Printer className="h-4 w-4 text-amber-400" /> Label Harga
          </button>
        }
      />
      <div className="sticky top-[64px] z-20 space-y-3 border-b border-slate-800 bg-[#0F172A] px-4 pb-3 pt-3 sm:px-6 lg:px-8">
        <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-700 bg-[#0B1220] px-4 focus-within:ring-2 focus-within:ring-cyan-400/70">
          <Search className="h-5 w-5 text-slate-400" />
          <input
            data-testid="inventory-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama / kode part / motor…"
            className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
          />
          {q && (
            <button type="button" data-testid="inventory-search-clear" onClick={() => setQ("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-300" aria-label="Hapus">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="no-scrollbar -ml-4 flex flex-1 gap-2 overflow-x-auto pl-4" data-testid="inventory-filter-chips">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                data-testid={`inventory-filter-${f.key.replace(/\s+/g, "-")}`}
                onClick={() => setFilter(f.key)}
                className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ${
                  filter === f.key
                    ? f.key === "menipis"
                      ? "border-amber-400 bg-amber-500 text-slate-950"
                      : "border-cyan-400 bg-cyan-500 text-slate-950"
                    : "border-slate-700 bg-[#1E293B] text-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger data-testid="inventory-sort-select" className="h-10 w-[46px] shrink-0 justify-center rounded-full border-slate-700 bg-[#1E293B] px-0 text-slate-200 [&>svg:last-child]:hidden" aria-label="Urutkan">
              <ArrowDownUp className="h-4 w-4" />
              <span className="sr-only"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent className="border-slate-700 bg-[#1E293B] text-slate-100">
              <SelectItem value="terbaru" data-testid="sort-terbaru">Terbaru diubah</SelectItem>
              <SelectItem value="nama" data-testid="sort-nama">Nama A–Z</SelectItem>
              <SelectItem value="harga" data-testid="sort-harga">Harga jual tertinggi</SelectItem>
              <SelectItem value="stok" data-testid="sort-stok">Stok paling sedikit</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-4 sm:px-6 lg:grid lg:grid-cols-2 lg:gap-3 lg:px-8" data-testid="inventory-list">
        {!items &&
          [0, 1, 2, 3].map((i) => <div key={i} className="shimmer h-[92px] rounded-2xl" />)}
        {items &&
          list.map((it) => (
            <ItemCard key={it.id} item={it} low={isLowStock(it, settings.lowStockThreshold)} testid={`inventory-item-card-${it.id}`} onClick={() => navigate(`/barang/${it.id}`)} />
          ))}
        {items && list.length === 0 && (
          <div data-testid="inventory-empty" className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <PackageOpen className="h-10 w-10 text-slate-600" />
            <p className="font-display text-lg font-semibold text-white">{items.length === 0 ? "Belum ada barang" : "Tidak ada yang cocok"}</p>
            <p className="text-sm text-slate-400">{items.length === 0 ? "Tambahkan barang pertama Anda, atau scan barang dengan kamera." : "Coba kata kunci lain atau ubah filter."}</p>
            <button type="button" data-testid="inventory-empty-add" onClick={() => navigate("/barang/baru")} className="mt-1 inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-amber-500 px-5 font-bold text-slate-950">
              <Plus className="h-5 w-5" /> Tambah Barang
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        data-testid="inventory-add-fab"
        onClick={() => navigate("/barang/baru")}
        className="fixed z-30 inline-flex h-14 items-center gap-2 rounded-full bg-cyan-500 px-5 font-bold text-slate-950 shadow-[0_18px_50px_rgba(0,0,0,0.55)] transition-colors duration-150 hover:bg-cyan-400 active:scale-95 lg:hidden"
        style={{ bottom: "calc(104px + env(safe-area-inset-bottom))", right: "16px" }}
      >
        <Plus className="h-6 w-6" /> Tambah
      </button>
    </div>
  );
}
