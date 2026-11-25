import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export const PageHeader = ({ title, subtitle, back, right, testid = "page-header" }) => {
  const navigate = useNavigate();
  return (
    <header data-testid={testid} className="sticky top-0 z-30 border-b border-slate-800 bg-[#0F172A]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex min-h-[64px] items-center gap-2 px-4 sm:px-6 lg:px-8">
        {back && (
          <button
            type="button"
            data-testid="page-back-button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="-ml-2 flex h-12 w-12 items-center justify-center rounded-xl text-slate-200 transition-colors duration-150 hover:bg-slate-800 active:scale-95"
            aria-label="Kembali"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-xl font-semibold text-white">{title}</h1>
          {subtitle && <p className="truncate text-xs text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
};
