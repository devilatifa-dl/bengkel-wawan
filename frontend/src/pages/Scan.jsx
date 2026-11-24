import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  X, Camera, Image as ImageIcon, Zap, ZapOff, Search, ScanLine, Loader2, CheckCircle2, AlertCircle,
  PackagePlus, RotateCcw, Cpu, Type, Sparkles,
} from "lucide-react";
import { db, recordCheck, searchItems, isLowStock, learnFromScan, liveItems } from "../lib/db";
import { computeEmbedding, runOcr } from "../lib/ai";
import { rankItems, decide, formatSize, evidenceLabel } from "../lib/match";
import { prepareVision, prepareOcr, subscribeAI } from "../lib/aiStatus";
import { captureVideoFrame, compressImage } from "../lib/image";
import { setDraft } from "../lib/draft";
import { useSettings, useBlobUrl } from "../lib/hooks";
import { PriceOverlay } from "../components/PriceOverlay";
import { ItemCard } from "../components/ItemCard";
import { ItemThumb } from "../components/ItemThumb";
import { Progress } from "../components/ui/progress";


function StepRow({ icon: Icon, label, state, testid }) {
  return (
    <div data-testid={testid} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#0B1220] px-3 py-3">
      <Icon className="h-5 w-5 text-slate-400" />
      <span className="flex-1 text-sm font-medium text-slate-200">{label}</span>
      {state === "run" && <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />}
      {state === "done" && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
      {state === "fail" && <AlertCircle className="h-5 w-5 text-red-400" />}
      {state === "skip" && <span className="text-xs text-slate-500">dilewati</span>}
      {state === "pending" && <span className="h-2 w-2 rounded-full bg-slate-600" />}
    </div>
  );
}

export default function Scan({ initialMode = "camera" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();
  const MOTOR_CHIPS = settings.motorOptions || [];
  const [mode, setMode] = useState(initialMode);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [camState, setCamState] = useState("idle"); // idle|starting|live|denied|error|unsupported
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [phase, setPhase] = useState("live"); // live|analyzing|notfound
  const [shot, setShot] = useState(null); // Blob
  const shotUrl = useBlobUrl(shot);
  const [steps, setSteps] = useState({ vision: "pending", ocr: "pending", match: "pending" });
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { tokens, code, emb, candidates }
  const [overlay, setOverlay] = useState({ open: false, item: null, candidates: [], source: "" });
  const [ai, setAi] = useState({ vision: "idle", ocr: "idle" });
  const [query, setQuery] = useState("");
  const runIdRef = useRef(0);

  const items = useLiveQuery(() => liveItems().toArray(), [], []);

  useEffect(() => subscribeAI(setAi), []);
  useEffect(() => {
    // Pre-load AI as soon as scanner opens (fast scans afterwards)
    prepareVision().catch(() => {});
    prepareOcr().catch(() => {});
  }, []);

  useEffect(() => {
    if (location.pathname === "/cari") setMode("manual");
  }, [location.pathname]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCamState("unsupported");
      return;
    }
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      const caps = track && track.getCapabilities ? track.getCapabilities() : {};
      setTorchSupported(!!caps.torch);
      setCamState("live");
    } catch (e) {
      setCamState(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "denied" : "error");
    }
  }, []);

  useEffect(() => {
    if (mode === "camera" && phase === "live") startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [mode, phase, startCamera, stopCamera]);

  const toggleTorch = async () => {
    const track = streamRef.current && streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] });
      setTorchOn(!torchOn);
    } catch (e) {
      toast.error("Lampu kilat tidak didukung di perangkat ini");
    }
  };

  const openItem = useCallback((item, candidates, source, evidence) => {
    setOverlay({ open: true, item, candidates: candidates || [], source, evidence: evidence || null });
    recordCheck(item.id, source === "Cari Manual" ? "manual" : "kamera").catch(() => {});
    if (navigator.vibrate) navigator.vibrate(40);
  }, []);

  const analyze = useCallback(
    async (blob) => {
      const runId = ++runIdRef.current;
      setShot(blob);
      setPhase("analyzing");
      setResult(null);
      setSteps({ vision: "run", ocr: "run", match: "pending" });
      setProgress(8);
      const all = await liveItems().toArray();

      let emb = null;
      let ocr = null;
      // OCR (2 passes, worker threads) and visual AI run at the same time
      const ocrP = runOcr(blob)
        .then((r) => {
          ocr = r;
          if (runId === runIdRef.current) {
            setSteps((s) => ({ ...s, ocr: "done" }));
            setProgress((p) => Math.max(p, 70));
          }
          return r;
        })
        .catch(() => {
          if (runId === runIdRef.current) setSteps((s) => ({ ...s, ocr: "fail" }));
          return null;
        });
      const visP = computeEmbedding(blob)
        .then((e) => {
          emb = e;
          if (runId === runIdRef.current) {
            setSteps((s) => ({ ...s, vision: "done" }));
            setProgress((p) => Math.max(p, 40));
          }
        })
        .catch(() => {
          if (runId === runIdRef.current) setSteps((s) => ({ ...s, vision: "fail" }));
        });

      await visP;
      if (runId !== runIdRef.current) return;

      // Fast path ONLY when the photo is clearly unique (no look-alike packaging in stock).
      // Look-alike labels (same brand template) always wait for the text reading.
      if (emb) {
        const vr = rankItems(all, { queryEmb: emb });
        const top = vr[0];
        const second = vr[1];
        if (top && top.vis >= 0.93 && (!second || top.vis - second.vis >= 0.12)) {
          setSteps((s) => ({ ...s, match: "done" }));
          setProgress(100);
          setPhase("live");
          openItem(top.item, [], "Cocok via Foto AI", top.evidence);
          // keep reading the label in the background and correct the result if the text disagrees
          const o2 = await ocrP;
          if (runId !== runIdRef.current || !o2) return;
          const r2 = rankItems(all, { queryEmb: emb, tokens: o2.tokens, sizes: o2.sizes });
          const d2 = decide(r2);
          const info2 = { tokens: o2.tokens, sizes: o2.sizes, text: o2.text, code: o2.code, emb };
          setResult(info2);
          if (d2.type === "match" && d2.top.item.id !== top.item.id) {
            toast.info("Dikoreksi berdasarkan teks label", { description: d2.top.item.name });
            openItem(d2.top.item, r2.slice(1, 4).filter((c) => c.score > 0.2), "Cocok via Teks/Kode", d2.top.evidence);
          } else {
            const mine = r2.find((c) => c.item.id === top.item.id);
            setOverlay((ov) =>
              ov.item && ov.item.id === top.item.id
                ? { ...ov, candidates: r2.filter((c) => c.item.id !== top.item.id && c.score > 0.2).slice(0, 3), evidence: mine ? { ...mine.evidence, visual: true } : ov.evidence }
                : ov
            );
          }
          return;
        }
      }

      await ocrP;
      if (runId !== runIdRef.current) return;
      setProgress(90);
      setSteps((s) => ({ ...s, match: "run" }));
      const tokens = ocr ? ocr.tokens : [];
      const sizes = ocr ? ocr.sizes : [];
      const ranked = rankItems(all, { queryEmb: emb, tokens, sizes });
      const d = decide(ranked);
      setSteps((s) => ({ ...s, match: "done" }));
      setProgress(100);
      const scanInfo = {
        tokens,
        sizes,
        text: ocr ? ocr.text : "",
        code: ocr ? ocr.code : "",
        emb,
      };
      if (d.type === "match") {
        setPhase("live");
        const ev = d.top.evidence;
        const how = ev.code || ev.size || d.top.txt >= 0.5 ? "Cocok via Teks/Kode" : "Cocok via Foto AI";
        setResult(scanInfo);
        openItem(d.top.item, ranked.slice(1, 4).filter((c) => c.score > 0.2), how, ev);
        return;
      }
      if (d.type === "choose") {
        setResult({ ...scanInfo, candidates: ranked.filter((c) => c.score >= 0.2).slice(0, 5) });
        setPhase("choose");
        return;
      }
      setResult({ ...scanInfo, candidates: ranked.filter((c) => c.score > 0.15).slice(0, 3) });
      setPhase("notfound");
    },
    [openItem]
  );

  const capture = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      toast.error("Kamera belum siap");
      return;
    }
    // full-resolution frame -> small label text stays readable for OCR
    const blob = await captureVideoFrame(v, 2000);
    if (navigator.vibrate) navigator.vibrate(20);
    analyze(blob);
  };

  const onPickFile = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const blob = await compressImage(f, 2000, 0.9);
    analyze(blob);
  };

  const addAsNew = async () => {
    const photo = shot ? await compressImage(shot, 1024, 0.78) : null;
    const sz = result?.sizes && result.sizes[0] ? formatSize(result.sizes[0]) : "";
    setDraft({
      photo,
      partCode: result?.code || "",
      size: sz,
      embedding: result?.emb || null,
      ocrTokens: result?.tokens || null,
      ocrSizes: result?.sizes || null,
    });
    navigate("/barang/baru", { state: { fromScan: true } });
  };

  const resetScan = () => {
    runIdRef.current++;
    setOverlay((o) => ({ ...o, open: false }));
    setResult(null);
    setShot(null);
    setPhase("live");
    setProgress(0);
  };

  const manualResults = useMemo(() => {
    const base = searchItems(items || [], query);
    return query ? base.slice(0, 40) : [...(items || [])].sort((a, b) => (b.lastCheckedAt || 0) - (a.lastCheckedAt || 0)).slice(0, 20);
  }, [items, query]);

  const aiReady = ai.vision === "ready" && ai.ocr === "ready";
  const aiLoading = ai.vision === "loading" || ai.ocr === "loading";

  return (
    <div data-testid="scan-page" className="fixed inset-0 z-50 mx-auto flex max-w-[480px] flex-col bg-[#05080F]">
      {/* Top bar */}
      <div className="relative z-20 flex items-center gap-2 px-3 pt-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <button
          type="button"
          data-testid="scan-close-button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-[#0F172A] text-slate-100 active:scale-95"
          aria-label="Tutup scanner"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="flex flex-1 rounded-full border border-slate-700 bg-[#0F172A] p-1" data-testid="scan-mode-switch">
          <button
            type="button"
            data-testid="scan-mode-camera"
            onClick={() => {
              setMode("camera");
              resetScan();
            }}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors duration-150 ${
              mode === "camera" ? "bg-cyan-500 text-slate-950" : "text-slate-300"
            }`}
          >
            <Camera className="h-4 w-4" /> Kamera AI
          </button>
          <button
            type="button"
            data-testid="scan-mode-manual"
            onClick={() => setMode("manual")}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors duration-150 ${
              mode === "manual" ? "bg-cyan-500 text-slate-950" : "text-slate-300"
            }`}
          >
            <Search className="h-4 w-4" /> Cari Manual
          </button>
        </div>
        {mode === "camera" && torchSupported && phase === "live" && (
          <button
            type="button"
            data-testid="scan-torch-toggle"
            onClick={toggleTorch}
            className={`flex h-12 w-12 items-center justify-center rounded-full border ${torchOn ? "border-amber-400 bg-amber-500 text-slate-950" : "border-slate-700 bg-[#0F172A] text-slate-100"}`}
            aria-label="Lampu kilat"
          >
            {torchOn ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
          </button>
        )}
      </div>

      {mode === "camera" ? (
        <div className="relative flex flex-1 flex-col">
          {/* Camera / captured view */}
          <div className="relative mx-3 mt-3 flex-1 overflow-hidden rounded-3xl border border-slate-800 bg-black">
            {phase === "live" && (
              <video
                ref={videoRef}
                data-testid="scan-video"
                playsInline
                muted
                autoPlay
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            {phase !== "live" && shotUrl && (
              <img src={shotUrl} alt="Foto scan" data-testid="scan-captured-image" className="absolute inset-0 h-full w-full object-cover" />
            )}

            {/* Viewfinder */}
            {(phase === "live" || phase === "analyzing") && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-[9%] rounded-2xl">
                  {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl"].map((c) => (
                    <span key={c} className={`absolute h-12 w-12 border-cyan-400 ${c}`} />
                  ))}
                  <span className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400" />
                </div>
                {(camState === "live" || phase === "analyzing") && <div className="scan-line" />}
              </div>
            )}

            {/* Status pill */}
            {phase === "live" && (
              <div className="absolute left-1/2 top-3 -translate-x-1/2">
                <span data-testid="scan-ai-status" className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-700 bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {aiReady ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> AI Offline siap
                    </>
                  ) : aiLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" /> Memuat AI di perangkat…
                    </>
                  ) : (
                    <>
                      <Cpu className="h-3.5 w-3.5 text-slate-400" /> AI offline
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Camera states */}
            {phase === "live" && camState !== "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0B1220] p-6 text-center" data-testid="scan-camera-state">
                {camState === "starting" || camState === "idle" ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />
                    <p className="text-sm text-slate-300">Menyalakan kamera belakang…</p>
                  </>
                ) : (
                  <>
                    <Camera className="h-12 w-12 text-slate-500" />
                    <p className="font-display text-lg font-semibold text-white">
                      {camState === "denied" ? "Izin kamera ditolak" : camState === "unsupported" ? "Kamera tidak didukung" : "Kamera tidak tersedia"}
                    </p>
                    <p className="max-w-[280px] text-sm text-slate-400">
                      {camState === "denied"
                        ? "Izinkan akses kamera di pengaturan browser, atau pakai foto dari galeri."
                        : "Gunakan foto dari galeri atau cari barang secara manual."}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" data-testid="scan-retry-camera" onClick={startCamera} className="min-h-[48px] rounded-xl border border-slate-600 px-4 font-semibold text-slate-100">
                        Coba Lagi
                      </button>
                      <button type="button" data-testid="scan-goto-manual" onClick={() => setMode("manual")} className="min-h-[48px] rounded-xl bg-cyan-500 px-4 font-bold text-slate-950">
                        Cari Manual
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom panel */}
          {phase === "live" && (
            <div className="relative z-10 px-4 pb-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <p className="mb-4 text-center text-sm text-slate-400">
                Arahkan ke <span className="font-semibold text-slate-200">barang atau label kemasan</span>, lalu tekan tombol
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  data-testid="scan-gallery-button"
                  onClick={() => fileRef.current && fileRef.current.click()}
                  className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-slate-700 bg-[#0F172A] text-slate-200 active:scale-95"
                  aria-label="Pilih dari galeri"
                >
                  <ImageIcon className="h-6 w-6" />
                  <span className="text-[10px]">Galeri</span>
                </button>
                <button
                  type="button"
                  data-testid="scan-camera-capture-button"
                  onClick={capture}
                  disabled={camState !== "live"}
                  className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-[5px] border-slate-200 bg-amber-500 text-slate-950 shadow-[0_0_0_6px_rgba(245,158,11,0.25)] transition-transform duration-100 active:scale-90 disabled:opacity-40"
                  aria-label="Ambil foto dan scan"
                >
                  <ScanLine className="h-9 w-9" strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  data-testid="scan-switch-manual-button"
                  onClick={() => setMode("manual")}
                  className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl border border-slate-700 bg-[#0F172A] text-slate-200 active:scale-95"
                  aria-label="Cari manual"
                >
                  <Search className="h-6 w-6" />
                  <span className="text-[10px]">Cari</span>
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" data-testid="scan-gallery-input" onChange={onPickFile} />
            </div>
          )}

          {phase === "analyzing" && (
            <div data-testid="scan-analyzing-panel" className="relative z-10 space-y-3 px-4 pb-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-white">Menganalisis foto…</span>
                <span className="tabular text-sm font-semibold text-cyan-300">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-cyan-400" />
              <div className="grid gap-2">
                <StepRow icon={Sparkles} label="Mengenali bentuk barang (AI foto)" state={steps.vision} testid="scan-step-vision" />
                <StepRow icon={Type} label="Membaca teks & kode part" state={steps.ocr} testid="scan-step-ocr" />
                <StepRow icon={Search} label="Mencocokkan dengan stok" state={steps.match} testid="scan-step-match" />
              </div>
              {aiLoading && <p className="text-center text-xs text-amber-300">Pertama kali memuat AI bisa beberapa detik. Selanjutnya jauh lebih cepat.</p>}
              <button type="button" data-testid="scan-cancel-button" onClick={resetScan} className="min-h-[48px] w-full rounded-xl border border-slate-700 font-semibold text-slate-300">
                Batal
              </button>
            </div>
          )}

          {phase === "choose" && result && (
            <div data-testid="scan-choose-panel" className="relative z-10 max-h-[64vh] overflow-y-auto no-scrollbar rounded-t-3xl border-t border-slate-700 bg-[#111A2E] px-4 pb-6 pt-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                  <Search className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">Pilih barang yang benar</h3>
                  <p className="text-sm text-slate-400">Ada beberapa barang mirip. Ketuk yang sesuai — aplikasi akan mengingatnya untuk scan berikutnya.</p>
                </div>
              </div>
              {(result.code || (result.sizes && result.sizes.length > 0)) && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs" data-testid="scan-choose-detected">
                  {result.code && <span className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 font-mono font-semibold text-cyan-300">Kode terbaca: {result.code}</span>}
                  {result.sizes && result.sizes[0] && <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 font-mono font-semibold text-amber-300">Ukuran terbaca: {formatSize(result.sizes[0])}</span>}
                </div>
              )}
              <div className="mt-4 flex flex-col gap-2" data-testid="scan-choose-list">
                {result.candidates.map((c, idx) => (
                  <button
                    key={c.item.id}
                    type="button"
                    data-testid={`scan-choose-item-${c.item.id}`}
                    onClick={() => {
                      learnFromScan(c.item.id, result);
                      openItem(c.item, [], "Dipilih dari kandidat", c.evidence);
                    }}
                    className={`flex min-h-[72px] items-center gap-3 rounded-2xl border p-2.5 text-left active:scale-[0.99] ${idx === 0 ? "border-cyan-500/60 bg-[#13233A]" : "border-slate-700 bg-[#1E293B]"}`}
                  >
                    <ItemThumb blob={c.item.photo} className="h-14 w-14" iconSize="h-6 w-6" />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-sm font-semibold text-slate-100">{c.item.name}</div>
                      <div className="truncate font-mono text-xs text-slate-400">{[c.item.partCode, c.item.size].filter(Boolean).join(" • ") || "-"}</div>
                      <div className="truncate text-[11px] text-cyan-300/90">{evidenceLabel(c.evidence)}</div>
                    </div>
                    <span className="tabular font-display text-sm font-bold text-amber-400">{Math.round(c.score * 100)}%</span>
                  </button>
                ))}
              </div>
              <button type="button" data-testid="scan-choose-add-new" onClick={addAsNew} className="mt-4 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/60 font-bold text-amber-300 active:scale-[0.98]">
                <PackagePlus className="h-5 w-5" /> Tidak ada — Tambah Sebagai Barang Baru
              </button>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" data-testid="scan-choose-retry" onClick={resetScan} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 font-semibold text-slate-100">
                  <RotateCcw className="h-5 w-5" /> Scan Ulang
                </button>
                <button type="button" data-testid="scan-choose-manual" onClick={() => setMode("manual")} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 font-semibold text-slate-100">
                  <Search className="h-5 w-5" /> Cari Manual
                </button>
              </div>
            </div>
          )}

          {phase === "notfound" && result && (
            <div data-testid="scan-not-found-panel" className="relative z-10 max-h-[62vh] overflow-y-auto no-scrollbar rounded-t-3xl border-t border-slate-700 bg-[#111A2E] px-4 pb-6 pt-5" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 24px)" }}>
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display text-xl font-semibold text-white">Barang belum terdaftar</h3>
                  <p className="text-sm text-slate-400">Tidak ada barang yang cocok di database lokal.</p>
                </div>
              </div>

              {result.tokens.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Teks terbaca (ketuk untuk cari)</div>
                  <div className="flex flex-wrap gap-2" data-testid="scan-detected-tokens">
                    {result.tokens.slice(0, 12).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setQuery(t);
                          setMode("manual");
                        }}
                        className={`min-h-[36px] rounded-lg border px-3 font-mono text-sm font-semibold ${t === result.code ? "border-cyan-400 bg-cyan-500/15 text-cyan-300" : "border-slate-700 bg-[#0B1220] text-slate-200"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                data-testid="scan-add-new-item-button"
                onClick={addAsNew}
                className="mt-5 inline-flex min-h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-lg font-bold text-slate-950 transition-colors duration-150 hover:bg-amber-400 active:scale-[0.98]"
              >
                <PackagePlus className="h-6 w-6" /> Tambah Sebagai Barang Baru
              </button>
              {result.code && (
                <p className="mt-2 text-center text-xs text-slate-400">
                  Foto & kode <span className="font-mono font-semibold text-cyan-300">{result.code}</span> otomatis terisi
                </p>
              )}

              {result.candidates.length > 0 && (
                <div className="mt-5">
                  <div className="mb-2 text-sm font-medium text-slate-400">Mungkin maksud Anda:</div>
                  <div className="flex flex-col gap-2" data-testid="scan-candidates">
                    {result.candidates.map((c) => (
                      <button
                        key={c.item.id}
                        type="button"
                        data-testid={`scan-candidate-${c.item.id}`}
                        onClick={() => {
                          learnFromScan(c.item.id, result);
                          openItem(c.item, [], "Dipilih dari kandidat", c.evidence);
                        }}
                        className="flex min-h-[60px] items-center gap-3 rounded-xl border border-slate-700 bg-[#1E293B] p-2 text-left active:scale-[0.99]"
                      >
                        <ItemThumb blob={c.item.photo} className="h-12 w-12" iconSize="h-5 w-5" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-100">{c.item.name}</div>
                          <div className="truncate font-mono text-xs text-slate-400">{c.item.partCode || "-"}</div>
                        </div>
                        <span className="tabular text-xs font-semibold text-slate-400">{Math.round(c.score * 100)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button type="button" data-testid="scan-retry-button" onClick={resetScan} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 font-semibold text-slate-100">
                  <RotateCcw className="h-5 w-5" /> Scan Ulang
                </button>
                <button type="button" data-testid="scan-manual-fallback-button" onClick={() => setMode("manual")} className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-slate-600 font-semibold text-slate-100">
                  <Search className="h-5 w-5" /> Cari Manual
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0F172A]" data-testid="scan-manual-panel">
          <div className="px-4 pt-4">
            <div className="flex h-14 items-center gap-3 rounded-2xl border border-slate-700 bg-[#0B1220] px-4 focus-within:ring-2 focus-within:ring-cyan-400/70">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                data-testid="scan-manual-search-input"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nama, kode part, motor, merk…"
                className="w-full bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
              />
              {query && (
                <button type="button" data-testid="scan-manual-clear" onClick={() => setQuery("")} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-300" aria-label="Hapus pencarian">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="scan-motor-chips">
              {MOTOR_CHIPS.map((m) => (
                <button
                  key={m}
                  type="button"
                  data-testid={`scan-motor-chip-${m.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setQuery(query.toLowerCase() === m.toLowerCase() ? "" : m)}
                  className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 ${
                    query.toLowerCase() === m.toLowerCase() ? "border-cyan-400 bg-cyan-500 text-slate-950" : "border-slate-700 bg-[#1E293B] text-slate-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-500">
              {query ? `${manualResults.length} hasil` : "Terakhir dicek / semua barang"}
            </div>
          </div>
          <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-8 pt-2">
            <div className="flex flex-col gap-2.5" data-testid="scan-manual-results">
              {manualResults.map((it) => (
                <ItemCard
                  key={it.id}
                  item={it}
                  testid={`scan-manual-result-${it.id}`}
                  low={isLowStock(it, settings.lowStockThreshold)}
                  onClick={() => openItem(it, [], "Cari Manual")}
                />
              ))}
              {manualResults.length === 0 && (
                <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-700 p-6 text-center" data-testid="scan-manual-empty">
                  <Search className="h-8 w-8 text-slate-600" />
                  <p className="text-sm text-slate-400">Tidak ditemukan barang untuk “{query}”.</p>
                  <button
                    type="button"
                    data-testid="scan-manual-add-new"
                    onClick={() => {
                      setDraft({ name: "", partCode: /\d/.test(query) ? query.toUpperCase() : "", nameGuess: /\d/.test(query) ? "" : query });
                      navigate("/barang/baru");
                    }}
                    className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-amber-500 px-5 font-bold text-slate-950"
                  >
                    <PackagePlus className="h-5 w-5" /> Tambah Barang Baru
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PriceOverlay
        open={overlay.open}
        onOpenChange={(o) => setOverlay((s) => ({ ...s, open: o }))}
        item={overlay.item ? (items || []).find((i) => i.id === overlay.item.id) || overlay.item : null}
        candidates={overlay.candidates}
        sourceLabel={overlay.source}
        evidence={overlay.evidence}
        onPickCandidate={(c) => {
          if (result) learnFromScan(c.item.id, result);
          openItem(c.item, [], "Dipilih dari kandidat", c.evidence);
        }}
        onScanAgain={() => {
          setOverlay((s) => ({ ...s, open: false }));
          if (mode === "camera") resetScan();
        }}
      />
    </div>
  );
}
