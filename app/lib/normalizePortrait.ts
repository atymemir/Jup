import { encodePortrait } from "./portrait.mjs";

export async function normalizePhoto(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 12 * 1024 * 1024
  )
    throw Error("Выберите JPG, PNG или WebP размером до 12 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 0;
    const context = canvas.getContext("2d");
    if (!context) throw Error();
    const photo = await encodePortrait(
      image.naturalWidth,
      image.naturalHeight,
      async (size, quality) => {
        if (canvas.width !== size.width || canvas.height !== size.height) {
          canvas.width = size.width;
          canvas.height = size.height;
          context.imageSmoothingQuality = "high";
          context.fillStyle = "#fff";
          context.fillRect(0, 0, size.width, size.height);
          context.drawImage(image, 0, 0, size.width, size.height);
        }
        return new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (blob) =>
              blob
                ? resolve(blob)
                : reject(new Error("Image encoding failed.")),
            "image/jpeg",
            quality,
          ),
        );
      },
    );
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error());
      reader.onerror = () => reject(new Error());
      reader.readAsDataURL(photo);
    });
  } catch {
    throw Error("Фото не удалось открыть. Попробуйте другой файл.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
