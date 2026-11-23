import React from "react";

function parse(size) {
  const parts = (size || "").split(/\s*[x×*]\s*/i).map((s) => s.replace(/mm/i, "").trim());
  return [parts[0] || "", parts[1] || "", parts[2] || ""];
}

function compose(a, b, c) {
  return [a, b, c].map((s) => s.trim()).filter(Boolean).join(" x ");
}

const boxCls =
  "tabular font-display h-14 w-full rounded-xl border border-slate-700 bg-[#0B1220] px-2 text-center text-xl font-semibold text-white outline-none placeholder:text-slate-600 placeholder:text-base placeholder:font-normal focus:ring-2 focus:ring-cyan-400/70";

/** Seal / rubber size input: Dalam (ID) x Luar (OD) x Tebal, in mm. Stored as "26 x 37 x 10.5". */
export const SizeInput = ({ value, onChange, testid = "product-form-size" }) => {
  const [a, b, c] = parse(value);
  const set = (idx) => (e) => {
    const v = e.target.value.replace(/[^0-9.,]/g, "");
    const next = [a, b, c];
    next[idx] = v;
    onChange(compose(next[0], next[1], next[2]));
  };
  const labels = ["Dalam", "Luar", "Tebal"];
  return (
    <div data-testid={testid}>
      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-1.5">
        {[a, b, c].map((v, i) => (
          <React.Fragment key={labels[i]}>
            <div className="flex flex-col gap-1">
              <span className="text-center text-[11px] font-medium uppercase tracking-wider text-slate-400">{labels[i]}</span>
              <input
                data-testid={`${testid}-${labels[i].toLowerCase()}`}
                inputMode="decimal"
                value={v}
                onChange={set(i)}
                placeholder="mm"
                className={boxCls}
              />
            </div>
            {i < 2 && <span className="pb-4 text-lg font-bold text-slate-500">×</span>}
          </React.Fragment>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {value ? (
          <>
            Tersimpan: <span className="font-mono font-semibold text-cyan-300" data-testid={`${testid}-preview`}>{value} mm</span> — bisa dicari, cth. “{a || "26"}x{b || "37"}”
          </>
        ) : (
          "Diameter dalam × diameter luar × tebal (mm). Kosongkan yang tidak perlu."
        )}
      </p>
    </div>
  );
};
