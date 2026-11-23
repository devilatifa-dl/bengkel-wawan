// PWA helpers: service worker registration, install prompt, offline status.
let deferredPrompt = null;
const installListeners = new Set();

export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function canPromptInstall() {
  return !!deferredPrompt;
}

export function onInstallAvailable(fn) {
  installListeners.add(fn);
  return () => installListeners.delete(fn);
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach((fn) => fn(false));
  return choice && choice.outcome === "accepted";
}

export function initPWA() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installListeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  });
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
}

export async function getOfflineStatus() {
  const out = { sw: false, modelsCached: false, usage: 0, quota: 0, persisted: false };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      out.sw = !!(reg && reg.active);
    }
    if (window.caches) {
      const keys = await caches.keys();
      for (const k of keys) {
        const c = await caches.open(k);
        const m = await c.match("/models/mobilenet/model.json");
        const t = await c.match("/models/tesseract/eng.traineddata.gz");
        if (m && t) out.modelsCached = true;
      }
    }
    if (navigator.storage && navigator.storage.estimate) {
      const est = await navigator.storage.estimate();
      out.usage = est.usage || 0;
      out.quota = est.quota || 0;
    }
    if (navigator.storage && navigator.storage.persisted) {
      out.persisted = await navigator.storage.persisted();
    }
  } catch (e) {
    // ignore
  }
  return out;
}
