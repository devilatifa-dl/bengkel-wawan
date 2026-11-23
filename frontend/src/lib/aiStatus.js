// Tracks loading state of on-device AI models for UI indicators.
import { loadVisionModel, getOcrWorker } from "./ai";

let status = { vision: "idle", ocr: "idle" };
const subs = new Set();
function emit() {
  subs.forEach((f) => f({ ...status }));
}
export function subscribeAI(fn) {
  subs.add(fn);
  fn({ ...status });
  return () => subs.delete(fn);
}
export function getAIStatus() {
  return { ...status };
}

export function prepareVision() {
  if (status.vision === "idle" || status.vision === "error") {
    status.vision = "loading";
    emit();
  }
  return loadVisionModel()
    .then((m) => {
      status.vision = "ready";
      emit();
      return m;
    })
    .catch((e) => {
      status.vision = "error";
      emit();
      throw e;
    });
}

export function prepareOcr() {
  if (status.ocr === "idle" || status.ocr === "error") {
    status.ocr = "loading";
    emit();
  }
  return getOcrWorker()
    .then((w) => {
      status.ocr = "ready";
      emit();
      return w;
    })
    .catch((e) => {
      status.ocr = "error";
      emit();
      throw e;
    });
}

export function prepareAll() {
  return Promise.allSettled([prepareVision(), prepareOcr()]);
}
