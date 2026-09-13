import collectionManifest from '../../assets/collections/mobile/collection-manifest.json';

export const DEFAULT_DONE_VISUAL_ID = 'done';
const configuredSummonChance = Number(collectionManifest?.summonChance);
export const SUMMON_CHANCE = Number.isFinite(configuredSummonChance)
  && configuredSummonChance >= 0
  && configuredSummonChance <= 1
  ? configuredSummonChance
  : 0;

const collectionAssets = [...new Map(
  (Array.isArray(collectionManifest?.files) ? collectionManifest.files : [])
    .filter((asset) => (
      typeof asset?.assetId === 'string'
      && typeof asset?.file === 'string'
    ))
    .map((asset) => [asset.assetId, {
      assetId: asset.assetId,
      file: asset.file,
    }]),
).values()];
const collectionAssetIds = new Set(collectionAssets.map((asset) => asset.assetId));

export function normalizeDoneVisualId(value) {
  const visualId = typeof value === 'string' ? value.trim() : '';
  if (visualId === DEFAULT_DONE_VISUAL_ID || collectionAssetIds.has(visualId)) {
    return visualId;
  }
  return null;
}

export function chooseDoneVisualId(random = Math.random) {
  if (collectionAssets.length === 0 || random() >= SUMMON_CHANCE) {
    return DEFAULT_DONE_VISUAL_ID;
  }

  const randomIndex = Math.min(
    Math.floor(Math.max(random(), 0) * collectionAssets.length),
    collectionAssets.length - 1,
  );
  return collectionAssets[randomIndex].assetId;
}

export function getDoneCollectionPath(visualId) {
  const normalizedVisualId = normalizeDoneVisualId(visualId);
  return normalizedVisualId && normalizedVisualId !== DEFAULT_DONE_VISUAL_ID
    ? `/api/collection-assets/${normalizedVisualId}.webp`
    : null;
}

export function getCollectionDoneVisualIds() {
  return collectionAssets.map((asset) => asset.assetId);
}
