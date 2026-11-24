import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import ItemForm from "./pages/ItemForm";
import ItemDetail from "./pages/ItemDetail";
import Settings from "./pages/Settings";
import Scan from "./pages/Scan";
import Labels from "./pages/Labels";
import { BottomNav } from "./components/BottomNav";
import { seedIfNeeded } from "./lib/seed";
import { prepareAll } from "./lib/aiStatus";
import { runIndexer } from "./lib/indexer";
import { syncNow, syncEnabled } from "./lib/sync";

function Shell() {
  const loc = useLocation();
  const fullScreen = loc.pathname.startsWith("/scan") || loc.pathname === "/cari";
  const isForm = loc.pathname === "/barang/baru" || loc.pathname.endsWith("/edit") || loc.pathname === "/label";
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="min-h-screen bg-[#0B1220]">
      <div className="relative mx-auto min-h-screen max-w-[480px] bg-[#0F172A] shadow-[0_0_60px_rgba(0,0,0,0.5)]">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/barang" element={<Inventory />} />
          <Route path="/barang/baru" element={<ItemForm />} />
          <Route path="/barang/:id" element={<ItemDetail />} />
          <Route path="/barang/:id/edit" element={<ItemForm />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="/label" element={<Labels />} />
          <Route path="/scan" element={<Scan initialMode="camera" />} />
          <Route path="/cari" element={<Scan initialMode="manual" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {!fullScreen && !isForm && <BottomNav />}
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await seedIfNeeded().catch(() => {});
      // Load on-device AI in the background, then index item photos for visual matching
      const start = () => {
        if (cancelled) return;
        prepareAll().then(() => runIndexer());
      };
      if ("requestIdleCallback" in window) window.requestIdleCallback(start, { timeout: 2500 });
      else setTimeout(start, 1200);

      // Sinkron antar perangkat: tarik perubahan saat aplikasi dibuka,
      // lalu ulangi berkala dan setiap kali koneksi kembali.
      if (syncEnabled()) {
        const run = () => { if (!cancelled) syncNow(); };
        setTimeout(run, 1500);
        const timer = setInterval(run, 30000);
        window.addEventListener("online", run);
        window.addEventListener("focus", run);
        return () => {
          clearInterval(timer);
          window.removeEventListener("online", run);
          window.removeEventListener("focus", run);
        };
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <Shell />
      <Toaster theme="dark" position="top-center" richColors closeButton toastOptions={{ style: { background: "#1E293B", border: "1px solid #334155", color: "#E5E7EB" } }} />
    </BrowserRouter>
  );
}
