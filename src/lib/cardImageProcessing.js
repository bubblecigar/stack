export const CARD_IMAGE_JPEG_QUALITY = 0.75;
export const CARD_IMAGE_MAX_EDGE = 1600;

export function getCardImageResize(width, height, maxEdge = CARD_IMAGE_MAX_EDGE) {
  const normalizedWidth = Number(width);
  const normalizedHeight = Number(height);

  if (
    !Number.isFinite(normalizedWidth)
    || !Number.isFinite(normalizedHeight)
    || normalizedWidth <= 0
    || normalizedHeight <= 0
    || Math.max(normalizedWidth, normalizedHeight) <= maxEdge
  ) {
    return null;
  }

  return normalizedWidth >= normalizedHeight
    ? { height: null, width: maxEdge }
    : { height: maxEdge, width: null };
}
