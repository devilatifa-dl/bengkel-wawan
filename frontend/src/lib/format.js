const nf = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function rupiah(n) {
  const v = Math.round(Number(n) || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}Rp ${nf.format(Math.abs(v))}`;
}

export function numberId(n) {
  return nf.format(Math.round(Number(n) || 0));
}

export function parseNumber(str) {
  const digits = (str || "").toString().replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function calcProfit(cost, sell) {
  const c = Number(cost) || 0;
  const s = Number(sell) || 0;
  const profit = s - c;
  const margin = s > 0 ? (profit / s) * 100 : 0;
  return { profit, margin };
}

export function percent(n) {
  const v = Number(n) || 0;
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
}

export function timeAgo(ts) {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(ts).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function dateTime(ts) {
  return new Date(ts).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
