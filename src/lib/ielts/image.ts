// Preparing a learner's own Task 1 image for marking.
//
// Everything happens in the browser: the file is downscaled to the size the
// vision model reads best, then sent as base64 with the response. Nothing is
// stored on a server.

export interface PreparedImage {
  /** For <img src>. */
  dataUrl: string;
  /** Base64 payload without the data: prefix — what the API route forwards. */
  data: string;
  mediaType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  width: number;
  height: number;
  bytes: number;
  name: string;
}

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
/** Long edge the model reads at full detail; larger costs tokens without helping. */
const MAX_EDGE = 1568;
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
/** Base64 grows the payload by ~4/3; keep well inside the route's limit. */
const MAX_ENCODED_BYTES = 2.4 * 1024 * 1024;

export class ImageError extends Error {}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("That file could not be opened as an image."));
    img.src = url;
  });
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ImageError("That file could not be read."));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscale to MAX_EDGE and keep PNG (crisp chart text) unless that is heavy,
 * in which case fall back to high-quality JPEG.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
    throw new ImageError("Use a PNG, JPEG, WebP or GIF image — a screenshot of the chart works well.");
  }
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError("That image is larger than 12 MB. Try a screenshot or a smaller export.");

  const original = await readAsDataUrl(file);
  const img = await loadImage(original);
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageError("This browser could not process the image.");
  // Charts are usually on white; flatten transparency so nothing goes black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let mediaType: PreparedImage["mediaType"] = "image/png";
  let dataUrl = canvas.toDataURL("image/png");
  if (dataUrl.length > MAX_ENCODED_BYTES) {
    mediaType = "image/jpeg";
    dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  }
  if (dataUrl.length > MAX_ENCODED_BYTES) dataUrl = canvas.toDataURL("image/jpeg", 0.75);
  if (dataUrl.length > MAX_ENCODED_BYTES) throw new ImageError("That image is too detailed to send. Crop it to just the chart and try again.");

  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { dataUrl, data, mediaType, width, height, bytes: Math.round((data.length * 3) / 4), name: file.name };
}

/** The first image on a clipboard paste, if there is one. */
export function imageFromClipboard(items: DataTransferItemList | null): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}
