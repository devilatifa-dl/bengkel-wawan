import React from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { Home, Package, Settings, ScanLine, Search } from "lucide-react";

function Tab({ to, icon: Icon, label, testid, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      data-testid={testid}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center gap-1 min-h-[56px] rounded-xl transition-colors duration-150 active:scale-[0.97] ${
          isActive ? "text-cyan-400" : "text-slate-400 hover:text-slate-200"
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
          <span className="text-[11px] font-medium leading-none">{label}</span>
          <span className={`h-1 w-5 rounded-full ${isActive ? "bg-cyan-400" : "bg-transparent"}`} />
        </>
      )}
    </NavLink>
  );
}

export const BottomNav = () => {
  const navigate = useNavigate();
  const loc = useLocation();
  const scanActive = loc.pathname.startsWith("/scan");
  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-[480px] border-t border-slate-700/70 bg-[#0B1220]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        <Tab to="/" end icon={Home} label="Beranda" testid="bottom-nav-beranda-tab" />
        <Tab to="/barang" icon={Package} label="Daftar Barang" testid="bottom-nav-daftar-barang-tab" />
        <div className="flex justify-center">
          <button
            type="button"
            data-testid="bottom-nav-scan-fab"
            aria-label="Scan Kamera"
            onClick={() => navigate("/scan")}
            className={`-mt-9 flex h-[72px] w-[72px] flex-col items-center justify-center rounded-full border-4 border-[#0F172A] bg-amber-500 text-slate-950 shadow-[0_18px_50px_rgba(0,0,0,0.55)] transition-colors duration-150 hover:bg-amber-400 active:scale-95 ${
              scanActive ? "" : "pulse-ring"
            }`}
          >
            <ScanLine className="h-7 w-7" strokeWidth={2.4} />
            <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide">Scan</span>
          </button>
        </div>
        <Tab to="/cari" icon={Search} label="Cari Cepat" testid="bottom-nav-cari-tab" />
        <Tab to="/pengaturan" icon={Settings} label="Pengaturan" testid="bottom-nav-pengaturan-tab" />
      </div>
    </nav>
  );
};
