import React, { useState } from "react";
import { toast } from "sonner";
import { Plus, X, RotateCcw } from "lucide-react";
import { setSetting } from "../lib/db";

/** Manage a list of quick-pick options (brands / motorcycles) stored in settings. */
export const OptionsEditor = ({ settingKey, options, defaults, placeholder, testid, emptyText }) => {
  const [value, setValue] = useState("");
  const list = options || [];

  const add = async () => {
    const v = value.trim().replace(/\s+/g, " ");
    if (!v) return;
    if (list.some((o) => o.toLowerCase() === v.toLowerCase())) {
      toast.info(`“${v}” sudah ada`);
      return;
    }
    await setSetting(settingKey, [...list, v]);
    setValue("");
    toast.success(`“${v}” ditambahkan`);
  };

  const remove = async (o) => {
    await setSetting(settingKey, list.filter((x) => x !== o));
  };

  const reset = async () => {
    await setSetting(settingKey, [...defaults]);
    toast.success("Daftar dikembalikan ke bawaan");
  };

  return (
    <div data-testid={testid}>
      <div className="flex gap-2">
        <input
          data-testid={`${testid}-input`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 rounded-xl border border-slate-700 bg-[#0B1220] px-4 text-base text-slate-100 outline-none placeholder:text-slate-600 focus:ring-2 focus:ring-cyan-400/70"
        />
        <button
          type="button"
          data-testid={`${testid}-add`}
          onClick={add}
          disabled={!value.trim()}
          className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-cyan-500 px-4 font-bold text-slate-950 transition-colors duration-150 hover:bg-cyan-400 active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-5 w-5" /> Tambah
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" data-testid={`${testid}-list`}>
        {list.map((o) => (
          <span key={o} className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-slate-700 bg-[#0B1220] pl-3 pr-1 text-sm font-medium text-slate-200">
            {o}
            <button
              type="button"
              data-testid={`${testid}-remove-${o.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => remove(o)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-500/15 hover:text-red-400"
              aria-label={`Hapus ${o}`}
            >
              <X className="h-4 w-4" />
            </button>
          </span>
        ))}
        {list.length === 0 && <span className="text-sm text-slate-500">{emptyText}</span>}
      </div>
      <button type="button" data-testid={`${testid}-reset`} onClick={reset} className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-200">
        <RotateCcw className="h-4 w-4" /> Kembalikan daftar bawaan
      </button>
    </div>
  );
};
