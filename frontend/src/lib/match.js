// Text + visual matching engine for the scanner.
// Designed for real packaging labels where many products share the same label
// template (e.g. Zunagawa seals): the score is driven by the DISTINCTIVE evidence
// (part code, size, rare words), template words shared by many items count little,
// and contradicting evidence (different part code / size) is penalised.

const STOP = new Set([
  "THE", "AND", "FOR", "WITH", "MADE", "IN", "OF", "TO", "NO", "PT", "LTD", "CO", "AS", "BY",
  "PART", "PARTS", "GENUINE", "ORIGINAL", "INDONESIA", "QTY", "PCS", "SET", "NU", "DESC", "SIZE",
  "JAMINAN", "KUALITAS", "SPECIALIST", "QUALITY", "TYPE", "PC", "UNIT",
]);

const CANON = { O: "0", Q: "0", D: "0", I: "1", L: "1", T: "7", Z: "2", S: "5", B: "8", G: "6" };

export function canon(s) {
  let out = "";
  for (const ch of s) out += CANON[ch] || ch;
  return out;
}

function lev(a, b, max = 99) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prev = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[lb];
}

const hasDigit = (s) => /\d/.test(s);
const hasAlpha = (s) => /[A-Z]/.test(s);

/** Similarity of two tokens 0..1 (0 = not similar enough). */
export function tokenSim(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (Math.min(la, lb) < 4) return 0;
  const digits = hasDigit(a) || hasDigit(b);
  const x = digits ? canon(a) : a;
  const y = digits ? canon(b) : b;
  if (x === y) return 0.97;
  // OCR often reads only part of a long word ("ELLING" of "VERSNELLING")
  if (!digits && Math.min(la, lb) >= 5) {
    const [s, l] = la < lb ? [x, y] : [y, x];
    if (l.includes(s)) return 0.8;
  }
  const maxLen = Math.max(la, lb);
  const allowed = Math.floor(maxLen * 0.25);
  const d = lev(x, y, allowed);
  if (d > allowed) return 0;
  const sim = 1 - d / maxLen;
  return sim >= 0.75 ? sim : 0;
}

/** Split free text into normalised tokens (keeps codes like 06455-KVB-305, also adds parts). */
export function tokenize(text) {
  const raw = (text || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\-\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  const out = new Set();
  for (const t of raw) {
    const add = (x) => {
      if (x.length < 2 || STOP.has(x)) return;
      if (/^\d+$/.test(x) && x.length < 4) return; // short numbers are sizes/qty, handled separately
      if (x.length >= 4 && !hasDigit(x) && !/[AEIOUY]/.test(x)) return; // OCR garbage like "TTTRR"
      out.add(x);
    };
    add(t);
    if (t.includes("-")) {
      add(t.replace(/-/g, ""));
      t.split("-").forEach(add);
    }
  }
  return Array.from(out);
}

const num = (s) => parseFloat(String(s).replace(",", "."));

/** Find sizes like "16 X 28 X 7", "11,6 x 22 x 7", "17X29X5" -> [[16,28,7], ...] */
export function parseSizes(text) {
  const t = (text || "").replace(/[×*]/g, "x");
  const re = /(\d{1,3}(?:[.,]\d{1,2})?)\s*[xX]\s*(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*[xX]\s*(\d{1,3}(?:[.,]\d{1,2})?))?/g;
  const out = [];
  let m;
  while ((m = re.exec(t))) {
    const arr = [num(m[1]), num(m[2])];
    if (m[3]) arr.push(num(m[3]));
    if (arr.every((n) => n > 0 && n < 400)) out.push(arr);
  }
  return out.slice(0, 6);
}

function sizeCompare(scanSizes, itemSizes) {
  if (!scanSizes.length || !itemSizes.length) return { score: 0, conflict: false };
  let best = 0;
  for (const a of scanSizes) {
    for (const b of itemSizes) {
      if (a[0] === b[0] && a[1] === b[1]) {
        const third = a[2] !== undefined && b[2] !== undefined;
        if (!third) best = Math.max(best, 0.8);
        else if (a[2] === b[2]) best = Math.max(best, 1);
        else best = Math.max(best, 0.5);
      } else if (a[0] === b[0] || a[1] === b[1]) {
        best = Math.max(best, 0.25);
      }
    }
  }
  return { score: best, conflict: best < 0.25 };
}

export function guessPartCodeFromText(text, tokens) {
  const up = (text || "").toUpperCase();
  const m = up.match(/PART\s*(?:NU|NO|NUMBER|NUM)?\s*[.:]*\s*[.:]\s*([A-Z0-9][A-Z0-9-]{3,})/);
  if (m) return m[1].replace(/-+$/, "");
  const list = tokens || tokenize(text);
  const scored = list
    .map((t) => {
      let s = 0;
      if (hasDigit(t) && hasAlpha(t)) s += 3;
      if (t.includes("-")) s += 2 + Math.min(2, t.split("-").length - 2);
      if (t.length >= 5 && t.length <= 20) s += 1;
      if (/^\d+$/.test(t)) s -= 1;
      if (/^\d+X\d+/.test(t)) s -= 5; // sizes
      return { t, s };
    })
    .sort((a, b) => b.s - a.s || b.t.length - a.t.length);
  return scored.length && scored[0].s > 1 ? scored[0].t : "";
}

export function sizesFromItem(item) {
  const out = parseSizes(item.size || "");
  (item.ocrSizes || []).forEach((s) => out.push(s));
  return out;
}

export function formatSize(arr) {
  return arr.map((n) => String(n).replace(".", ",")).join(" x ");
}

function profile(item) {
  const tokens = new Set(tokenize([item.name, item.partCode, item.brand, item.compatibility].join(" ")));
  (item.ocrTokens || []).forEach((t) => tokens.add(t));
  const codes = new Set();
  if (item.partCode) {
    const c = item.partCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c.length >= 4) codes.add(c);
  }
  (item.ocrTokens || []).forEach((t) => {
    const c = t.replace(/-/g, "");
    if (c.length >= 5 && hasDigit(c) && hasAlpha(c)) codes.add(c);
  });
  return { tokens: Array.from(tokens), codes: Array.from(codes), sizes: sizesFromItem(item) };
}

function codeCompare(scanTokens, codes) {
  let best = 0;
  let conflict = false;
  for (const code of codes) {
    const cc = canon(code);
    for (const t of scanTokens) {
      const tt = canon(t.replace(/-/g, ""));
      if (tt.length < 4) continue;
      if (tt === cc) {
        best = 1;
        continue;
      }
      const maxLen = Math.max(tt.length, cc.length);
      if (Math.abs(tt.length - cc.length) <= 2) {
        const d = lev(tt, cc, 3);
        const sim = 1 - d / maxLen;
        if (d <= 1 && maxLen >= 6) best = Math.max(best, 0.85);
        else if (cc.length >= 5 && tt.slice(0, 4) === cc.slice(0, 4) && sim < 0.8) conflict = true;
      }
      // OCR may glue code with neighbouring text ("NUZGOSH12")
      if (cc.length >= 6 && tt.length > cc.length && tt.includes(cc)) best = Math.max(best, 0.9);
    }
  }
  return { score: best, conflict: conflict && best < 0.85 };
}

/**
 * Rank items.
 * @param items [{..., embedding, ocrTokens, ocrSizes}]
 * @param q { queryEmb, tokens, sizes }
 * returns [{ item, score, vis, txt, evidence }]
 */
export function rankItems(items, { queryEmb, tokens = [], sizes = [] }) {
  const profiles = items.map(profile);
  // vocabulary: token -> item indexes
  const vocab = new Map();
  profiles.forEach((p, i) => p.tokens.forEach((t) => {
    if (!vocab.has(t)) vocab.set(t, new Set());
    vocab.get(t).add(i);
  }));
  const vocabKeys = Array.from(vocab.keys());

  // best similarity per (item, scan token)
  const best = items.map(() => new Map());
  const scanTokens = tokens.filter((t) => t.length >= 2);
  for (const t of scanTokens) {
    for (const v of vocabKeys) {
      if (Math.abs(v.length - t.length) > 7) continue;
      const s = tokenSim(t, v);
      if (!s) continue;
      vocab.get(v).forEach((idx) => {
        if ((best[idx].get(t) || 0) < s) best[idx].set(t, s);
      });
    }
  }
  // document frequency -> weight (template words shared by many items weigh little)
  const weight = new Map();
  let totalW = 0;
  for (const t of scanTokens) {
    let df = 0;
    best.forEach((m) => m.has(t) && df++);
    if (df > 0) {
      const w = 1 / df;
      weight.set(t, w);
      totalW += w;
    }
  }

  const out = items.map((item, i) => {
    const p = profiles[i];
    let raw = 0;
    let matchedWords = 0;
    best[i].forEach((s, t) => {
      raw += (weight.get(t) || 0) * s;
      matchedWords++;
    });
    const share = totalW > 0 ? raw / totalW : 0;
    const tok = share * Math.min(1, raw / 2);
    const code = codeCompare(scanTokens, p.codes);
    const size = sizeCompare(sizes, p.sizes);

    let txt = Math.max(code.score, tok);
    if (size.score > 0) txt = txt > 0 ? Math.min(1, txt + 0.3 * size.score) : 0.45 * size.score;
    // an exact part code is more reliable than an OCR-read size (digits are often misread)
    if (size.conflict) txt *= code.score >= 0.85 ? 0.85 : 0.45;
    if (code.conflict) txt *= size.score >= 0.8 ? 0.7 : 0.4;

    const vis = queryEmb && item.embedding ? cosine(queryEmb, item.embedding) : 0;
    const visN = Math.max(0, Math.min(1, (vis - 0.35) / 0.5));
    const hasTextEvidence = totalW > 0 || sizes.length > 0;
    let score = hasTextEvidence ? 0.85 * txt + 0.15 * visN : 0.9 * visN;
    if ((code.conflict && code.score < 0.85) || (size.conflict && code.score < 0.85)) score = Math.min(score, 0.85 * txt + 0.05 * visN);

    return {
      item,
      score: Math.max(0, Math.min(1, score)),
      vis,
      txt,
      evidence: {
        code: code.score >= 0.85,
        size: size.score >= 0.8,
        words: matchedWords,
        share,
        codeConflict: code.conflict,
        sizeConflict: size.conflict,
        visual: visN >= 0.7,
      },
    };
  });
  return out.sort((a, b) => b.score - a.score);
}

function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export const MATCH_THRESHOLD = 0.5;
export const AMBIGUOUS_GAP = 0.12;

/** Decide what the scanner should show. */
export function decide(ranked) {
  const top = ranked[0];
  const second = ranked[1];
  if (!top || top.score < 0.3) return { type: "notfound" };
  const ambiguous = second && second.score >= 0.3 && top.score - second.score < AMBIGUOUS_GAP;
  if (top.score >= MATCH_THRESHOLD && !ambiguous) return { type: "match", top };
  return { type: "choose" };
}

export function evidenceLabel(ev) {
  if (!ev) return "";
  const parts = [];
  if (ev.code) parts.push("Kode cocok");
  if (ev.size) parts.push("Ukuran cocok");
  if (!ev.code && ev.words > 0) parts.push(`${ev.words} kata label cocok`);
  if (ev.visual) parts.push("Foto mirip");
  if (ev.codeConflict) parts.push("Kode beda");
  if (ev.sizeConflict) parts.push("Ukuran beda");
  return parts.join(" • ");
}
