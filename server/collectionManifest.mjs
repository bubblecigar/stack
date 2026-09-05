import { readFileSync } from 'node:fs';

const manifestUrl = new URL('../assets/collections/mobile/collection-manifest.json', import.meta.url);
const collectionManifest = JSON.parse(readFileSync(manifestUrl, 'utf8'));

export const collectionAssets = (Array.isArray(collectionManifest?.files)
  ? collectionManifest.files
  : [])
  .filter((asset) => (
    typeof asset?.assetId === 'string'
    && typeof asset?.file === 'string'
    && asset.file === `${asset.assetId}.webp`
  ));

const collectionAssetIds = new Set(collectionAssets.map((asset) => asset.assetId));

export function normalizeCollectionAssetId(value) {
  const assetId = typeof value === 'string' ? value.trim() : '';
  return collectionAssetIds.has(assetId) ? assetId : null;
}
