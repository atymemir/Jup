/** Fit the complete portrait inside a square, without cropping its edges.
 * @param {number} width @param {number} height @param {number} size
 */
export function portraitBounds(width, height, size = 384) {
  if (
    ![width, height, size].every((value) => Number.isFinite(value) && value > 0)
  )
    throw new Error("Invalid portrait dimensions.");
  const scale = size / Math.max(width, height);
  const w = width * scale;
  const h = height * scale;
  return { x: (size - w) / 2, y: (size - h) / 2, width: w, height: h };
}
