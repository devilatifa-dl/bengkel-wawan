import React from "react";
import { Eye, EyeOff } from "lucide-react";

/** Shows value or a mask. Parent controls `shown`. */
export const Masked = ({ shown, children, testid, className = "" }) => (
  <span data-testid={testid} className={`tabular font-display ${className}`}>
    {shown ? children : "Rp ••••••"}
  </span>
);

export const EyeToggle = ({ shown, onToggle, testid, label = true, className = "" }) => (
  <button
    type="button"
    data-testid={testid}
    onClick={onToggle}
    aria-label={shown ? "Sembunyikan harga modal" : "Tampilkan harga modal"}
    className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-700 bg-[#0B1220] px-3 text-sm font-medium text-slate-300 transition-colors duration-150 hover:border-cyan-500/60 hover:text-cyan-300 active:scale-[0.97] ${className}`}
  >
    {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
    {label && <span>{shown ? "Sembunyikan" : "Lihat Modal"}</span>}
  </button>
);
