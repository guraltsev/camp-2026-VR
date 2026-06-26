export const scenePalettePanelPixelSize = 0.00144;
export const scenePalettePanelWidthPixels = 980;
export const scenePalettePanelHeightPixels = 760;
export const scenePalettePanelBorderRadiusPixels = 28;

export const scenePalettePanelWidthMeters = scenePalettePanelWidthPixels * scenePalettePanelPixelSize;
export const scenePalettePanelHeightMeters = scenePalettePanelHeightPixels * scenePalettePanelPixelSize;
export const scenePalettePanelBorderRadiusMeters = scenePalettePanelBorderRadiusPixels * scenePalettePanelPixelSize;

const scenePalettePanelHalfWidthMeters = scenePalettePanelWidthMeters * 0.5;
const scenePalettePanelHalfHeightMeters = scenePalettePanelHeightMeters * 0.5;
const scenePaletteCornerCenterX = scenePalettePanelHalfWidthMeters - scenePalettePanelBorderRadiusMeters;
const scenePaletteCornerCenterY = scenePalettePanelHalfHeightMeters - scenePalettePanelBorderRadiusMeters;

export function clampScenePaletteLocalPoint(
  x: number,
  y: number,
): { readonly x: number; readonly y: number } {
  const clampedX = clamp(x, -scenePalettePanelHalfWidthMeters, scenePalettePanelHalfWidthMeters);
  const clampedY = clamp(y, -scenePalettePanelHalfHeightMeters, scenePalettePanelHalfHeightMeters);
  const absoluteX = Math.abs(clampedX);
  const absoluteY = Math.abs(clampedY);

  if (
    absoluteX <= scenePaletteCornerCenterX
    || absoluteY <= scenePaletteCornerCenterY
    || scenePalettePanelBorderRadiusMeters <= 0
  ) {
    return { x: clampedX, y: clampedY };
  }

  const offsetX = absoluteX - scenePaletteCornerCenterX;
  const offsetY = absoluteY - scenePaletteCornerCenterY;
  const offsetLength = Math.hypot(offsetX, offsetY);

  if (offsetLength <= scenePalettePanelBorderRadiusMeters || offsetLength <= 1e-9) {
    return { x: clampedX, y: clampedY };
  }

  const scale = scenePalettePanelBorderRadiusMeters / offsetLength;
  return {
    x: Math.sign(clampedX) * (scenePaletteCornerCenterX + offsetX * scale),
    y: Math.sign(clampedY) * (scenePaletteCornerCenterY + offsetY * scale),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
