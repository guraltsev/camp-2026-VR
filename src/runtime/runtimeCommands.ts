export type RuntimeCommand =
  | { readonly kind: "reload-world" }
  | { readonly kind: "change-world"; readonly worldId: string }
  | { readonly kind: "set-debug-overlay"; readonly enabled: boolean };
