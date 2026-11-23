import React from "react";
import { numberId, parseNumber } from "../lib/format";

export const MoneyInput = ({ value, onChange, placeholder = "0", testid, id, autoFocus, accent = "cyan" }) => {
  const display = value ? numberId(value) : "";
  const ring = accent === "amber" ? "focus-within:ring-amber-400/70" : "focus-within:ring-cyan-400/70";
  return (
    <div
      className={`flex h-14 items-center rounded-xl border border-slate-700 bg-[#0B1220] px-4 focus-within:ring-2 ${ring} transition-shadow`}
    >
      <span className="mr-2 text-base font-semibold text-slate-400">Rp</span>
      <input
        id={id}
        data-testid={testid}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={display}
        placeholder={placeholder}
        onChange={(e) => onChange(parseNumber(e.target.value))}
        className="tabular font-display w-full bg-transparent text-xl font-semibold text-slate-100 outline-none placeholder:text-slate-600"
      />
    </div>
  );
};
