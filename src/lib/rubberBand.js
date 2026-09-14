export function getRubberBandDistance(
  distance,
  maximumDistance = 1000,
  resistance = 0.9,
) {
  if (!Number.isFinite(distance) || distance === 0) {
    return 0;
  }

  const magnitude = Math.abs(distance);
  const resistedMagnitude = maximumDistance * (
    1 - (1 / ((magnitude * resistance / maximumDistance) + 1))
  );

  return Math.sign(distance) * resistedMagnitude;
}
