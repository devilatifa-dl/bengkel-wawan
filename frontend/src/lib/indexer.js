// Background visual indexer: computes AI embeddings for items that have a photo but no embedding.
import { db } from "./db";
import { computeEmbedding, runOcr } from "./ai";

let running = false;
const listeners = new Set();
let state = { pending: 0, done: 0, running: false };

function emit() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function subscribeIndexer(fn) {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
}

export async function runIndexer() {
  if (running) return;
  running = true;
  try {
    const todo = await db.items.filter((it) => !!it.photo && (!it.embedding || !it.ocrAt)).primaryKeys();
    state = { pending: todo.length, done: 0, running: todo.length > 0 };
    emit();
    for (const id of todo) {
      const it = await db.items.get(id);
      if (!it || !it.photo || (it.embedding && it.ocrAt)) continue;
      try {
        const patch = {};
        if (!it.embedding) patch.embedding = await computeEmbedding(it.photo);
        if (!it.ocrAt) {
          const o = await runOcr(it.photo);
          patch.ocrTokens = o.tokens;
          patch.ocrSizes = o.sizes;
          patch.ocrAt = Date.now();
        }
        await db.items.update(id, patch);
      } catch (e) {
        // model unavailable — stop silently, will retry next launch
        break;
      }
      state.done += 1;
      emit();
      await new Promise((r) => setTimeout(r, 30));
    }
  } finally {
    running = false;
    state.running = false;
    emit();
  }
}
