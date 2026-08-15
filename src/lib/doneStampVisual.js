import collectionManifest from '../../assets/collections/mobile/collection-manifest.json';

export const DEFAULT_DONE_VISUAL_ID = 'done';
export const MONSTER_HATCH_CHANCE = 0.1;
const MONSTER_VISUAL_ID_PATTERN = /^monster-[a-f0-9]{16}$/;

const monsterAssets = [...new Map(
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

export function normalizeDoneVisualId(value) {
  const visualId = typeof value === 'string' ? value.trim() : '';
  if (visualId === DEFAULT_DONE_VISUAL_ID || MONSTER_VISUAL_ID_PATTERN.test(visualId)) {
    return visualId;
  }
  return null;
}

export function chooseDoneVisualId(random = Math.random) {
  if (monsterAssets.length === 0 || random() >= MONSTER_HATCH_CHANCE) {
    return DEFAULT_DONE_VISUAL_ID;
  }

  const randomIndex = Math.min(
    Math.floor(Math.max(random(), 0) * monsterAssets.length),
    monsterAssets.length - 1,
  );
  return monsterAssets[randomIndex].assetId;
}

export function getDoneMonsterPath(visualId) {
  const normalizedVisualId = normalizeDoneVisualId(visualId);
  return normalizedVisualId && normalizedVisualId !== DEFAULT_DONE_VISUAL_ID
    ? `/api/monster-stamps/${normalizedVisualId}.webp`
    : null;
}

export function getMonsterDoneVisualIds() {
  return monsterAssets.map((asset) => asset.assetId);
}
