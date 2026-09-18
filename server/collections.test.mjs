import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const databasePath = join(tmpdir(), `stack-collections-${process.pid}.sqlite`);
process.env.STACK_DATABASE_PATH = databasePath;

const database = await import('./db.mjs');
const firstUser = database.createUser('collections-one@example.com', 'test-password').user;
const secondUser = database.createUser('collections-two@example.com', 'test-password').user;

test.after(() => {
  database.db.close();
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
});

test('derives user-scoped collections from completion history', () => {
  database.setUserData(firstUser.id, 'treeCompletionCanvas:2026-08-16', {
    nodes: [
      {
        completedAt: 100,
        id: 'done-1',
      },
      {
        completedAt: 150,
        id: 'void-1',
        outcome: 'void',
      },
      {
        completedAt: 200,
        id: 'monster-1',
        monsterVisualId: 'monster-626c03f45fafd12a',
      },
    ],
  });
  database.setUserData(firstUser.id, 'treeCompletionCanvas:2026-08-17', {
    nodes: [
      {
        completedAt: 300,
        collectionVisualId: 'food-04f5ad5288f12b51',
        id: 'collection-2',
      },
    ],
  });
  database.setUserData(secondUser.id, 'treeCompletionCanvas:2026-08-17', {
    nodes: [
      {
        completedAt: 400,
        id: 'other-user-monster',
        monsterVisualId: 'monster-626c03f45fafd12a',
      },
    ],
  });

  const collections = database.listCollections(firstUser.id);
  assert.equal(collections.length, 2);
  assert.deepEqual(collections.map((collection) => collection.itemId), [
    'monster-626c03f45fafd12a',
    'food-04f5ad5288f12b51',
  ]);
  assert.ok(collections.every((collection) => collection.available));
  assert.ok(collections.every((collection) => collection.type === 'collection'));
});

test('consumes a collection once and keeps an audit trail', () => {
  const [collection] = database.listCollections(firstUser.id);
  const consumed = database.consumeCollection(
    firstUser.id,
    collection.id,
    'test-action',
    'target-42',
  );

  assert.equal(consumed.available, false);
  assert.ok(consumed.consumedAt);
  assert.equal(consumed.actionType, 'test-action');
  assert.equal(consumed.actionReference, 'target-42');
  assert.throws(
    () => database.consumeCollection(firstUser.id, collection.id, 'test-action'),
    (error) => error.status === 409,
  );
  assert.throws(
    () => database.consumeCollection(secondUser.id, collection.id, 'test-action'),
    (error) => error.status === 404,
  );
});
