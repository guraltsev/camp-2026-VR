export function publicAssetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}assets/${path.replace(/^\/+/, "")}`;
}
