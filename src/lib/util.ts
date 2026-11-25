// Small shared helpers.

export function uid(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function throttle<T extends (...a: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: any[] | null = null;
  return ((...args: any[]) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    } else {
      pending = args;
      if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          last = Date.now();
          if (pending) fn(...pending);
          pending = null;
        }, ms - (now - last));
      }
    }
  }) as T;
}

export function downloadFile(name: string, content: string, mime = "application/json") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Downscale an image file so its data URL stays under ~`maxBytes`. */
export async function compressImage(file: File, maxBytes = 780_000, maxDim = 1600): Promise<string> {
  const dataUrl = await fileToDataURL(file);
  if (dataUrl.length < maxBytes && file.type !== "image/svg+xml") return dataUrl;
  const img = new Image();
  img.src = dataUrl;
  await img.decode().catch(() => undefined);
  if (!img.width || !img.height) return dataUrl; // svg or broken — keep as-is
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, width, height);
  let q = 0.85;
  let out = canvas.toDataURL("image/jpeg", q);
  while (out.length > maxBytes && q > 0.4) {
    q -= 0.12;
    out = canvas.toDataURL("image/jpeg", q);
  }
  return out;
}

export function randomRot(): number {
  return Math.round((Math.random() * 5 - 2.5) * 10) / 10;
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  return Promise.resolve();
}
