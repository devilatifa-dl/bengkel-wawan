import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { ScanLine, Package, TrendingUp, AlertTriangle, Wallet, ChevronRight, WifiOff, Wifi, Sparkles, Loader2, Clock, Download, Info, Plus, Search } from "lucide-react";
import { db, isLowStock, liveItems, getLiveItem } from "../lib/db";
import { rupiah, timeAgo, calcProfit } from "../lib/format";
import { useSettings, useOnline } from "../lib/hooks";
import { subscribeAI } from "../lib/aiStatus";
import { canPromptInstall, onInstallAvailable, promptInstall, isStandalone, isIOS } from "../lib/pwa";
import { Masked, EyeToggle } from "../components/Masked";
import { ItemThumb } from "../components/ItemThumb";
import { PriceOverlay } from "../components/PriceOverlay";

function Stat({ icon: Icon, label, value, accent = "cyan", onClick, testid, children }) {
  const color = accent === "amber" ? "text-amber-400 bg-amber-500/10" : accent === "green" ? "text-emerald-400 bg-emerald-500/10" : "text-cyan-400 bg-cyan-500/10";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      data-testid={testid}
      className="flex min-h-[112px] flex-col justify-between rounded-2xl border border-slate-700/70 bg-[#1E293B] p-4 text-left shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-colors duration-150 hover:border-slate-600 active:scale-[0.99]"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3">
        <div className="text-xs font-medium text-slate-400">{label}</div>
        <div className="tabular font-display mt-0.5 text-xl font-bold text-white">{value}</div>
        {children}
      </div>
    </Comp>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const settings = useSettings();
  const online = useOnline();
  const [shown, setShown] = useState(false);
  const [ai, setAi] = useState({ vision: "idle", ocr: "idle" });
  const [installable, setInstallable] = useState(canPromptInstall());
  const [overlay, setOverlay] = useState({ open: false, item: null });
  useEffect(() => subscribeAI(setAi), []);
  useEffect(() => onInstallAvailable(setInstallable), []);

  const items = useLiveQuery(() => liveItems().toArray(), [], null);
  const recent = useLiveQuery(async () => {
    const rows = await db.scanHistory.orderBy("at").reverse().limit(30).toArray();
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      if (seen.has(r.itemId)) continue;
      seen.add(r.itemId);
      const it = await getLiveItem(r.itemId);
      if (it) out.push({ ...r, item: it });
      if (out.length >= 8) break;
    }
    return out;
  }, [], []);

  const stats = useMemo(() => {
    const list = items || [];
    let potential = 0;
    let stockValue = 0;
    let low = 0;
    let samples = 0;
    list.forEach((it) => {
      const qty = it.stock === null || it.stock === undefined ? 0 : it.stock;
      potential += calcProfit(it.costPrice, it.sellPrice).profit * qty;
      stockValue += (it.costPrice || 0) * qty;
      if (isLowStock(it, settings.lowStockThreshold)) low += 1;
      if (it.isSample) samples += 1;
    });
    return { total: list.length, potential, stockValue, low, samples };
  }, [items, settings.lowStockThreshold]);

  const aiReady = ai.vision === "ready" && ai.ocr === "ready";
  const showInstall = !isStandalone() && (installable || isIOS());

  return (
    <div data-testid="dashboard-page" className="safe-bottom">
      <section className="header-glow relative overflow-hidden px-4 pb-6 sm:px-6 lg:px-8" style={{ paddingTop: "calc(env(safe-area-inset-top) + 20px)" }}>
        <div className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Bengkel & Toko Sparepart</p>
              <h1 data-testid="dashboard-shop-name" className="font-display mt-1 truncate text-3xl font-bold text-white lg:text-4xl">{settings.shopName}</h1>
            </div>
            <span
              data-testid="dashboard-online-status"
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                online ? "border-slate-600 bg-[#0B1220] text-slate-300" : "border-amber-500/60 bg-amber-500/10 text-amber-300"
              }`}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "Online" : "Mode Offline"}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400" data-testid="dashboard-ai-status">
            {aiReady ? <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />}
            {aiReady ? "Kamera AI siap — berjalan 100% di HP" : "Menyiapkan kamera AI di perangkat…"}
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
            <button
              type="button"
              data-testid="dashboard-scan-cta"
              onClick={() => navigate("/scan")}
              className="flex w-full items-center gap-4 rounded-2xl bg-amber-500 p-4 text-left text-slate-950 shadow-[0_18px_50px_rgba(245,158,11,0.18)] transition-colors duration-150 hover:bg-amber-400 active:scale-[0.99] lg:flex-1"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-amber-400">
                <ScanLine className="h-8 w-8" strokeWidth={2.4} />
              </div>
              <div className="flex-1">
                <div className="font-display text-xl font-bold">Scan Barang</div>
                <div className="text-sm font-medium text-slate-900/80">Foto barang / label → harga langsung muncul</div>
              </div>
              <ChevronRight className="h-6 w-6" />
            </button>
            <div className="grid grid-cols-2 gap-3 lg:w-[320px] lg:shrink-0">
              <button type="button" data-testid="dashboard-search-button" onClick={() => navigate("/cari")} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#1E293B] font-semibold text-slate-100 active:scale-[0.98]">
                <Search className="h-5 w-5 text-cyan-400" /> Cari Cepat
              </button>
              <button type="button" data-testid="dashboard-add-button" onClick={() => navigate("/barang/baru")} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#1E293B] font-semibold text-slate-100 active:scale-[0.98]">
                <Plus className="h-5 w-5 text-cyan-400" /> Tambah Barang
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-5 px-4 pt-5 sm:px-6 lg:px-8 lg:pt-6">
        {showInstall && (
          <div data-testid="dashboard-install-banner" className="flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-[#0B1220] p-3">
            <Download className="h-6 w-6 shrink-0 text-cyan-400" />
            <div className="flex-1 text-sm text-slate-300">
              {installable ? "Pasang aplikasi ke layar utama agar bisa dipakai tanpa internet." : "iPhone: ketuk Bagikan → “Tambah ke Layar Utama”."}
            </div>
            {installable && (
              <button type="button" data-testid="dashboard-install-button" onClick={promptInstall} className="min-h-[44px] rounded-lg bg-cyan-500 px-3 text-sm font-bold text-slate-950">
                Pasang
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-white">Ringkasan</h2>
          <EyeToggle shown={shown} onToggle={() => setShown((s) => !s)} testid="dashboard-cost-eye-toggle" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dashboard-stats">
          <Stat icon={Package} label="Total Jenis Barang" value={items ? stats.total : "…"} testid="dashboard-stat-total" onClick={() => navigate("/barang")} />
          <Stat icon={TrendingUp} label="Potensi Keuntungan" accent="green" testid="dashboard-stat-profit" value={<Masked shown={shown}>{rupiah(stats.potential)}</Masked>} />
          <Stat icon={AlertTriangle} label="Stok Menipis" accent="amber" testid="dashboard-stat-low" value={stats.low} onClick={() => navigate("/barang?filter=menipis")}>
            <div className="text-[11px] text-slate-500">batas ≤ {settings.lowStockThreshold}</div>
          </Stat>
          <Stat icon={Wallet} label="Nilai Stok (Modal)" testid="dashboard-stat-stock-value" value={<Masked shown={shown}>{rupiah(stats.stockValue)}</Masked>} />
        </div>

        {stats.samples > 0 && (
          <button type="button" data-testid="dashboard-sample-note" onClick={() => navigate("/pengaturan")} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-amber-500/50 bg-[#0B1220] p-3 text-left">
            <Info className="h-5 w-5 shrink-0 text-amber-400" />
            <span className="flex-1 text-sm text-slate-300">
              Ada <b className="text-amber-300">{stats.samples} barang contoh</b> untuk mencoba fitur. Hapus kapan saja di Pengaturan.
            </span>
            <ChevronRight className="h-5 w-5 text-slate-500" />
          </button>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-white">Terakhir Dicek</h2>
            <button type="button" data-testid="dashboard-see-all" onClick={() => navigate("/barang")} className="min-h-[40px] text-sm font-semibold text-cyan-400">
              Lihat semua
            </button>
          </div>
          {recent && recent.length > 0 ? (
            <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-3" data-testid="dashboard-recent-list">
              {recent.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`dashboard-recent-item-${r.item.id}`}
                  onClick={() => setOverlay({ open: true, item: r.item })}
                  className="flex min-h-[72px] items-center gap-3 rounded-2xl border border-slate-700/70 bg-[#1E293B] p-3 text-left transition-colors duration-150 hover:bg-[#233148] active:scale-[0.99]"
                >
                  <ItemThumb blob={r.item.photo} className="h-12 w-12" iconSize="h-5 w-5" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-100">{r.item.name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Clock className="h-3 w-3" /> {timeAgo(r.at)} • {r.method === "manual" ? "Cari manual" : "Kamera AI"}
                    </div>
                  </div>
                  <span className="tabular font-display text-base font-bold text-amber-400">{rupiah(r.item.sellPrice)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div data-testid="dashboard-recent-empty" className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-700 p-6 text-center">
              <ScanLine className="h-8 w-8 text-slate-600" />
              <p className="text-sm text-slate-400">Belum ada barang yang dicek. Tekan tombol Scan untuk mulai.</p>
            </div>
          )}
        </div>
      </div>

      <PriceOverlay
        open={overlay.open}
        onOpenChange={(o) => setOverlay((s) => ({ ...s, open: o }))}
        item={overlay.item ? (items || []).find((i) => i.id === overlay.item.id) || overlay.item : null}
        sourceLabel="Riwayat"
      />
    </div>
  );
}
