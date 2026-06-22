export function publicUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export function publicAssetUrl(path: string): string {
  return publicUrl(`assets/${path.replace(/^\/+/, "")}`);
}

export function legacyPublicAssetUrl(path: string): string {
  return publicAssetUrl(`_legacy/${path.replace(/^\/+/, "")}`);
}
