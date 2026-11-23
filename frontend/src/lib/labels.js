// Price label (sticker) generation: PDF via jsPDF (works offline, bundled).
import { jsPDF } from "jspdf";
import { rupiah } from "./format";

export const LABEL_SIZES = {
  kecil: { key: "kecil", name: "Kecil", w: 50, h: 25, shop: 5.5, title: 7.5, meta: 6, price: 14 },
  sedang: { key: "sedang", name: "Sedang", w: 64, h: 34, shop: 6.5, title: 9, meta: 7, price: 18 },
  besar: { key: "besar", name: "Besar", w: 90, h: 50, shop: 8, title: 12, meta: 9, price: 26 },
};

export const PAGE = { w: 210, h: 297, margin: 8, gap: 3 };

export function gridFor(size) {
  const cols = Math.max(1, Math.floor((PAGE.w - 2 * PAGE.margin + PAGE.gap) / (size.w + PAGE.gap)));
  const rows = Math.max(1, Math.floor((PAGE.h - 2 * PAGE.margin + PAGE.gap) / (size.h + PAGE.gap)));
  return { cols, rows, perPage: cols * rows };
}

/** Expand items into a flat list of labels according to copies map {id: n}. */
export function expandLabels(items, copies) {
  const out = [];
  items.forEach((it) => {
    const n = Math.max(1, Math.min(99, Number(copies[it.id]) || 1));
    for (let i = 0; i < n; i++) out.push(it);
  });
  return out;
}

export function labelMetaLine(it) {
  return [it.partCode, it.size ? `Uk. ${it.size}` : ""].filter(Boolean).join("  •  ");
}

const PT = 0.3528; // mm per pt

export function buildLabelsPdf(labels, sizeKey, { shopName, showShop = true, showCompat = false } = {}) {
  const size = LABEL_SIZES[sizeKey] || LABEL_SIZES.sedang;
  const { cols, perPage } = gridFor(size);
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pad = Math.max(2, size.h * 0.08);

  labels.forEach((it, idx) => {
    if (idx > 0 && idx % perPage === 0) doc.addPage();
    const pos = idx % perPage;
    const c = pos % cols;
    const r = Math.floor(pos / cols);
    const x = PAGE.margin + c * (size.w + PAGE.gap);
    const y = PAGE.margin + r * (size.h + PAGE.gap);

    doc.setDrawColor(40, 40, 40);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, size.w, size.h, 1.8, 1.8, "S");
    // accent strip
    doc.setFillColor(245, 158, 11);
    doc.rect(x + 0.15, y + 0.15, 1.6, size.h - 0.3, "F");

    const innerX = x + pad + 1.2;
    const innerW = size.w - pad * 2 - 1.2;
    let cy = y + pad;

    if (showShop && shopName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size.shop);
      doc.setTextColor(110, 110, 110);
      cy += size.shop * PT;
      doc.text(doc.splitTextToSize(shopName.toUpperCase(), innerW)[0], innerX, cy);
      cy += 0.8;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(size.title);
    doc.setTextColor(15, 15, 15);
    const nameLines = doc.splitTextToSize(it.name || "", innerW).slice(0, 2);
    nameLines.forEach((ln) => {
      cy += size.title * PT * 1.05;
      doc.text(ln, innerX, cy);
    });

    const meta = labelMetaLine(it);
    if (meta) {
      doc.setFont("courier", "bold");
      doc.setFontSize(size.meta);
      doc.setTextColor(60, 60, 60);
      cy += size.meta * PT * 1.25;
      doc.text(doc.splitTextToSize(meta, innerW)[0], innerX, cy);
    }
    if (showCompat && it.compatibility) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(size.meta);
      doc.setTextColor(90, 90, 90);
      cy += size.meta * PT * 1.2;
      doc.text(doc.splitTextToSize(it.compatibility, innerW)[0], innerX, cy);
    }

    // price at bottom
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size.price);
    doc.setTextColor(0, 0, 0);
    const priceY = y + size.h - pad;
    doc.text(rupiah(it.sellPrice), innerX, priceY);
  });

  return doc;
}

export function labelsFileName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `label-harga-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pdf`;
}
