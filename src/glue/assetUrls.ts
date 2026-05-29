export function publicAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path.replace(/^\/+/, "")}`;
}

export function legacyPublicAssetUrl(path: string): string {
  return publicAssetUrl(`_legacy/${path.replace(/^\/+/, "")}`);
}
