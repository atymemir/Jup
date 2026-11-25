// Match the existing database limit; no schema change is needed for clearer photos.
export const PORTRAIT_MAX_BYTES = 160000;
export const PORTRAIT_MAX_EDGE = 1536;

/** @param {number} width @param {number} height @param {number} maxEdge */
export function portraitDimensions(width, height, maxEdge = PORTRAIT_MAX_EDGE) {
  if (
    ![width, height, maxEdge].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error("Invalid portrait dimensions.");
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Keep the complete image and prefer detail to a low-quality, fixed-size thumbnail.
 * @param {number} width @param {number} height
 * @param {(size: {width: number; height: number}, quality: number) => Promise<Blob>} encode
 */
export async function encodePortrait(width, height, encode) {
  let edge = Math.min(PORTRAIT_MAX_EDGE, Math.max(width, height));
  for (;;) {
    const size = portraitDimensions(width, height, edge);
    for (const quality of [0.9, 0.82, 0.74]) {
      const result = await encode(size, quality);
      if (
        result.type === "image/jpeg" &&
        result.size >= 64 &&
        result.size <= PORTRAIT_MAX_BYTES
      )
        return result;
    }
    if (edge <= 256) throw new Error("Photo cannot fit the upload limit.");
    edge = Math.max(256, Math.floor(edge * 0.8));
  }
}
