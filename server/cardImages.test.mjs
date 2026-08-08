import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';

const databasePath = join(tmpdir(), `papers-card-images-${process.pid}.sqlite`);
const dataDirectory = join(tmpdir(), `papers-card-images-${process.pid}`);
process.env.STACK_DATABASE_PATH = databasePath;
process.env.STACK_DATA_DIR = dataDirectory;

const database = await import('./db.mjs');
const {
  pruneCardImages,
  removeCardImages,
  serveCardImage,
  storeCardImage,
} = await import('./cardImages.mjs');
const user = database.createUser('image-card@example.com', 'test-password').user;

function createUploadRequest(body, mimeType = 'image/jpeg') {
  const request = Readable.from(body);
  request.headers = {
    'content-length': String(body.length),
    'content-type': mimeType,
  };
  request.setTimeout = () => {};
  return request;
}

test.after(() => {
  database.db.close();
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(dataDirectory, { force: true, recursive: true });
});

test('stores, serves, replaces, and removes a user-scoped card image', async () => {
  const firstImage = await storeCardImage(
    createUploadRequest(Buffer.from('first-image')),
    user.id,
    12,
  );
  const firstPath = join(dataDirectory, firstImage.imagePath.replace('/api/', ''));
  assert.equal(firstImage.imagePath.startsWith(`/api/card-images/${user.id}/12-`), true);
  assert.equal(existsSync(firstPath), true);

  const chunks = [];
  const response = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk);
      callback();
    },
  });
  response.writeHead = (status, headers) => {
    response.status = status;
    response.headers = headers;
  };
  await serveCardImage(response, user.id, firstImage.imagePath.split('/').pop());
  assert.equal(response.status, 200);
  assert.equal(response.headers['Content-Type'], 'image/jpeg');
  assert.equal(Buffer.concat(chunks).toString(), 'first-image');

  const secondImage = await storeCardImage(
    createUploadRequest(Buffer.from('second-image')),
    user.id,
    12,
  );
  const secondPath = join(dataDirectory, secondImage.imagePath.replace('/api/', ''));
  assert.equal(existsSync(firstPath), true);
  assert.equal(existsSync(secondPath), true);

  await pruneCardImages(
    user.id,
    [{ imagePath: secondImage.imagePath }],
    { minimumAgeMs: 0 },
  );
  assert.equal(existsSync(firstPath), false);
  assert.equal(existsSync(secondPath), true);

  await removeCardImages(user.id, 12);
  assert.equal(existsSync(secondPath), false);
});

test('rejects unsupported image types', async () => {
  await assert.rejects(
    storeCardImage(createUploadRequest(Buffer.from('image'), 'image/gif'), user.id, 12),
    (error) => error.status === 415,
  );
});
