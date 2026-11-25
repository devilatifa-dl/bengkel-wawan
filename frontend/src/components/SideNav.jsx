import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Home, Package, Settings, ScanLine, Search, Plus, Printer } from "lucide-react";

const links = [
  { to: "/", icon: Home, label: "Beranda", end: true, testid: "sidenav-beranda" },
  { to: "/barang", icon: Package, label: "Daftar Barang", testid: "sidenav-daftar-barang" },
  { to: "/cari", icon: Search, label: "Cari Cepat", testid: "sidenav-cari" },
  { to: "/label", icon: Printer, label: "Label Harga", testid: "sidenav-label" },
  { to: "/pengaturan", icon: Settings, label: "Pengaturan", testid: "sidenav-pengaturan" },
];

/** Navigasi samping khusus layar lebar (desktop/tablet). Disembunyikan di HP. */
export const SideNav = ({ hidden }) => {
  const navigate = useNavigate();
  if (hidden) return null;
  return (
    <aside
      data-testid="side-nav"
      className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-1 border-r border-slate-800/70 bg-[#0B1220] px-3 py-5 lg:flex"
    >
      <div className="px-2 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-400">Bengkel &amp; Toko</p>
        <p className="font-display mt-1 text-lg font-bold text-white">Sparepart Motor</p>
      </div>

      <button
        type="button"
        data-testid="sidenav-scan-button"
        onClick={() => navigate("/scan")}
        className="mb-3 flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-amber-500 font-bold text-slate-950 transition-colors hover:bg-amber-400 active:scale-[0.98]"
      >
        <ScanLine className="h-5 w-5" strokeWidth={2.4} /> Scan Barang
      </button>

      {links.map(({ to, icon: Icon, label, end, testid }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          data-testid={testid}
          className={({ isActive }) =>
            `flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
              isActive ? "bg-cyan-500/15 text-cyan-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
            }`
          }
        >
          <Icon className="h-5 w-5" /> {label}
        </NavLink>
      ))}

      <div className="mt-auto">
        <button
          type="button"
          data-testid="sidenav-add-button"
          onClick={() => navigate("/barang/baru")}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#1E293B] text-sm font-semibold text-slate-100 transition-colors hover:border-slate-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 text-cyan-400" /> Tambah Barang
        </button>
      </div>
    </aside>
  );
};
