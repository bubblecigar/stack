import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveMonsterStampPath } from './monsterStamps.mjs';

test('accepts immutable monster asset filenames', () => {
  assert.match(
    resolveMonsterStampPath('monster-626c03f45fafd12a.webp'),
    /assets\/collections\/mobile\/monster-626c03f45fafd12a\.webp$/,
  );
});

test('rejects unknown shapes and path traversal', () => {
  assert.throws(() => resolveMonsterStampPath('../monster-626c03f45fafd12a.webp'));
  assert.throws(() => resolveMonsterStampPath('anything.webp'));
});
