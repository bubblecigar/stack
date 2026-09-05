import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCollectionAssetPath } from './collectionAssets.mjs';

test('accepts manifest-listed monster and food assets', () => {
  assert.match(
    resolveCollectionAssetPath('monster-626c03f45fafd12a.webp'),
    /assets\/collections\/mobile\/monster-626c03f45fafd12a\.webp$/,
  );
  assert.match(
    resolveCollectionAssetPath('food-04f5ad5288f12b51.webp'),
    /assets\/collections\/mobile\/food-04f5ad5288f12b51\.webp$/,
  );
});

test('rejects files outside the manifest and path traversal', () => {
  assert.throws(() => resolveCollectionAssetPath('../monster-626c03f45fafd12a.webp'));
  assert.throws(() => resolveCollectionAssetPath('anything.webp'));
});
