export interface CollisionResult {
  readonly blocked: boolean;
  readonly reason?: "wall" | "floor" | "ceiling" | "forbidden-zone";
}
