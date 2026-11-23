export function mutationBodyLimit(action: unknown, data: unknown) {
  const imageUpload = action === "save_profile" ||
    (action === "platform" && data !== null && typeof data === "object" &&
      "action" in data && data.action === "organization_save");
  return imageUpload ? 225000 : 16000;
}
