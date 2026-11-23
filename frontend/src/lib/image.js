// Image helpers: compress to JPEG Blob, convert Blob <-> base64

export function loadImgFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      resolve(img);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export function canvasToBlob(canvas, quality = 0.72) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
}

/** Compress any image source (Blob/File/canvas/img) to a JPEG Blob max `max` px. */
export async function compressImage(source, max = 800, quality = 0.72) {
  let el = source;
  if (source instanceof Blob) el = await loadImgFromBlob(source);
  const w0 = el.naturalWidth || el.videoWidth || el.width;
  const h0 = el.naturalHeight || el.videoHeight || el.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * scale);
  c.height = Math.round(h0 * scale);
  const ctx = c.getContext("2d");
  ctx.drawImage(el, 0, 0, c.width, c.height);
  return canvasToBlob(c, quality);
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function base64ToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Capture a frame from a <video> element to a JPEG Blob. */
export async function captureVideoFrame(video, max = 1280) {
  const w0 = video.videoWidth;
  const h0 = video.videoHeight;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement("canvas");
  c.width = Math.round(w0 * scale);
  c.height = Math.round(h0 * scale);
  c.getContext("2d").drawImage(video, 0, 0, c.width, c.height);
  return canvasToBlob(c, 0.85);
}
