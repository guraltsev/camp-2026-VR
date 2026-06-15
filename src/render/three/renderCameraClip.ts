export const renderCameraNearMeters = 0.03;
export const renderCameraFarMeters = 250;

export function renderCameraDepthRangeRatio(): number {
  return renderCameraFarMeters / renderCameraNearMeters;
}
