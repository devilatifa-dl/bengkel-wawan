// On-device AI: Tesseract.js OCR + TensorFlow.js MobileNet visual embeddings.
// All model files are self-hosted under /public/models so they work 100% offline.
import { createWorker } from "tesseract.js";
import { tokenize, parseSizes, guessPartCodeFromText } from "./match";

const ORIGIN = typeof window !== "undefined" ? window.location.origin : "";

let ocrWorkersPromise = null;
let mobilenetPromise = null;
let tfRef = null;

function makeWorker(psm) {
  return createWorker("eng", 1, {
    workerPath: `${ORIGIN}/models/tesseract/worker.min.js`,
    corePath: `${ORIGIN}/models/tesseract`,
    langPath: `${ORIGIN}/models/tesseract`,
    gzip: true,
    workerBlobURL: false,
  }).then(async (w) => {
    await w.setParameters({ tessedit_pageseg_mode: psm, preserve_interword_spaces: "1" });
    return w;
  });
}

/**
 * Two OCR workers running in parallel with different page-segmentation modes:
 *  - PSM 3  (auto layout)  -> reads label lines in order (best for packaging labels)
 *  - PSM 11 (sparse text)  -> catches scattered words / codes the first pass misses
 * Their results are merged for higher accuracy.
 */
export function getOcrWorkers() {
  if (!ocrWorkersPromise) {
    ocrWorkersPromise = Promise.all([makeWorker("3"), makeWorker("11")]).catch((e) => {
      ocrWorkersPromise = null;
      throw e;
    });
  }
  return ocrWorkersPromise;
}
// backward compat
export const getOcrWorker = getOcrWorkers;

export async function loadVisionModel() {
  if (!mobilenetPromise) {
    mobilenetPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      tfRef = tf;
      try {
        await tf.setBackend("webgl");
      } catch (e) {
        await tf.setBackend("cpu");
      }
      await tf.ready();
      const mobilenet = await import("@tensorflow-models/mobilenet");
      const model = await mobilenet.load({
        version: 2,
        alpha: 0.5,
        modelUrl: `${ORIGIN}/models/mobilenet/model.json`,
      });
      const z = tf.zeros([224, 224, 3]);
      const e = model.infer(z, true);
      await e.data();
      e.dispose();
      z.dispose();
      return model;
    })().catch((e) => {
      mobilenetPromise = null;
      throw e;
    });
  }
  return mobilenetPromise;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function toImageEl(source) {
  if (typeof source === "string") return loadImage(source);
  if (source instanceof Blob) {
    const url = URL.createObjectURL(source);
    try {
      return await loadImage(url);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
  }
  return source; // canvas / img element
}

/** Returns L2-normalised embedding (1280 dims). */
export async function computeEmbedding(source) {
  const model = await loadVisionModel();
  const el = await toImageEl(source);
  const tf = tfRef;
  const vec = tf.tidy(() => {
    const t = tf.browser.fromPixels(el);
    const resized = tf.image.resizeBilinear(t, [224, 224]);
    const emb = model.infer(resized, true).flatten();
    return emb.div(emb.norm().add(1e-8));
  });
  const data = await vec.data();
  vec.dispose();
  return Array.from(data);
}

export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Preprocess for OCR: grayscale + contrast, scaled so the long side is ~2000px
 * (small label text on phone photos is upscaled -> much better recognition).
 */
async function prepForOcr(source) {
  const el = await toImageEl(source);
  const w0 = el.naturalWidth || el.width;
  const h0 = el.naturalHeight || el.height;
  const scale = Math.min(2, 2000 / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * scale);
  c.height = Math.round(h0 * scale);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = "grayscale(1) contrast(1.35)";
  ctx.drawImage(el, 0, 0, c.width, c.height);
  return c;
}

/** Run OCR (2 passes in parallel, merged). Returns { text, tokens, sizes, code, confidence } */
export async function runOcr(source) {
  const workers = await getOcrWorkers();
  const canvas = await prepForOcr(source);
  const results = await Promise.all(workers.map((w) => w.recognize(canvas).then((r) => r.data).catch(() => null)));
  const ok = results.filter(Boolean);
  const text = ok.map((d) => (d.text || "").trim()).join("\n");
  const confidence = ok.length ? Math.max(...ok.map((d) => d.confidence || 0)) : 0;
  const tokens = tokenize(text).slice(0, 80);
  const sizes = parseSizes(text);
  const code = guessPartCodeFromText(text, tokens);
  return { text, tokens, sizes, code, confidence };
}

export function guessPartCode(tokens) {
  return guessPartCodeFromText("", tokens);
}
