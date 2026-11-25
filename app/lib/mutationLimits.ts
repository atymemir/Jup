export const MAX_MUTATION_BODY = 300000;
export function mutationBodyLimit(action: unknown, data: unknown) {
  // A valid JPEG plus education/certificates and multibyte text need headroom.
  if (action === "save_profile") return MAX_MUTATION_BODY;
  const imageUpload =
    action === "platform" &&
    data !== null &&
    typeof data === "object" &&
    "action" in data &&
    data.action === "organization_save";
  return imageUpload ? 225000 : 16000;
}
