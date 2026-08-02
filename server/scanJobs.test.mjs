import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Readable } from 'node:stream';

const databasePath = join(tmpdir(), `papers-scan-jobs-${process.pid}.sqlite`);
const dataDirectory = join(tmpdir(), `papers-scan-jobs-${process.pid}`);
process.env.STACK_DATABASE_PATH = databasePath;
process.env.STACK_DATA_DIR = dataDirectory;

const database = await import('./db.mjs');
const { scanImageToCards } = await import('./openaiVision.mjs');
const { removeScanJobImage, storeScanJobUpload } = await import('./scanUpload.mjs');
const firstUser = database.createUser('scan-one@example.com', 'test-password').user;
const secondUser = database.createUser('scan-two@example.com', 'test-password').user;

test.after(() => {
  database.db.close();
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(dataDirectory, { force: true, recursive: true });
});

test('scan jobs are idempotent, durable, user-scoped, and acknowledgeable', () => {
  const input = {
    clientRequestId: 'request-1',
    placeholderId: 42,
    request: {
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/jpeg',
      prompt: 'Read this.',
    },
  };
  const created = database.createScanJob(firstUser.id, input);
  const duplicate = database.createScanJob(firstUser.id, input);

  assert.equal(created.id, duplicate.id);
  assert.equal(created.status, 'queued');
  assert.equal(database.listUnacknowledgedScanJobs(secondUser.id).length, 0);

  const claimed = database.claimNextScanJob();
  assert.equal(claimed.id, created.id);
  assert.equal(claimed.attemptCount, 1);
  assert.equal(claimed.request.prompt, 'Read this.');

  database.completeScanJob(claimed.id, {
    title: 'Result',
    nodes: [],
  });
  const completed = database.getScanJob(firstUser.id, claimed.id);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.result.title, 'Result');
  assert.equal(database.getScanJob(secondUser.id, claimed.id), null);

  const acknowledged = database.acknowledgeScanJob(firstUser.id, claimed.id);
  assert.ok(acknowledged.acknowledgedAt);
  assert.equal(database.listUnacknowledgedScanJobs(firstUser.id).length, 0);
});

test('processing jobs return to the queue after a server restart', () => {
  const created = database.createScanJob(firstUser.id, {
    clientRequestId: 'request-2',
    placeholderId: 84,
    request: {
      imageBase64: 'aGVsbG8=',
      mimeType: 'image/jpeg',
      prompt: 'Read this too.',
    },
  });

  const firstClaim = database.claimNextScanJob();
  assert.equal(firstClaim.id, created.id);
  database.requeueInterruptedScanJobs();
  const recoveredClaim = database.claimNextScanJob();
  assert.equal(recoveredClaim.id, created.id);
  assert.equal(recoveredClaim.attemptCount, 2);

  database.failScanJob(recoveredClaim.id, 'Timed out.');
  const failed = database.getScanJob(firstUser.id, recoveredClaim.id);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.error, 'Timed out.');
});

test('binary uploads queue a job and terminal cleanup removes the file', async () => {
  const created = database.createScanJob(firstUser.id, {
    clientRequestId: 'request-3',
    placeholderId: 126,
    request: {
      mimeType: 'image/jpeg',
      prompt: 'Read the uploaded image.',
    },
  });
  assert.equal(created.status, 'uploading');

  const request = Readable.from(Buffer.from('test-image'));
  request.headers = {
    'content-length': '10',
    'content-type': 'image/jpeg',
  };
  request.setTimeout = () => {};
  const uploaded = await storeScanJobUpload(request, firstUser.id, created);
  assert.equal(uploaded.status, 'queued');
  assert.equal(uploaded.imageBytes, 10);

  const claimed = database.claimNextScanJob();
  assert.equal(claimed.id, created.id);
  assert.equal(existsSync(claimed.imagePath), true);
  database.completeScanJob(claimed.id, { title: 'Uploaded result', nodes: [] });
  await removeScanJobImage(claimed);

  assert.equal(existsSync(claimed.imagePath), false);
  assert.equal(database.getScanJob(firstUser.id, claimed.id).hasImage, false);
});

test('OpenAI requests reject when their processing deadline expires', async () => {
  const fetchImpl = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  });
  const keepAlive = setTimeout(() => {}, 50);

  try {
    await assert.rejects(
      scanImageToCards({
        imageBase64: 'aGVsbG8=',
        mimeType: 'image/jpeg',
        prompt: 'Read this.',
      }, {
        apiKey: 'test-key',
        fetchImpl,
        timeoutMs: 5,
      }),
      (error) => error.status === 504 && error.message === 'OpenAI scan timed out.',
    );
  } finally {
    clearTimeout(keepAlive);
  }
});
