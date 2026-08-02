import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  clearScanJobImage,
  completeScanJobUpload,
  getDataDirectory,
  listScanJobImagePaths,
} from './db.mjs';

const MAX_UPLOAD_BYTES = 8_000_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const STALE_PARTIAL_AGE_MS = 15 * 60 * 1_000;
const uploadDirectory = join(getDataDirectory(), 'scan-uploads');
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getUploadPaths(jobId, mimeType) {
  if (!/^[A-Za-z0-9_-]+$/.test(jobId)) {
    throw createHttpError(400, 'Invalid scan job ID.');
  }

  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) {
    throw createHttpError(415, 'Unsupported image type.');
  }

  const finalPath = resolve(uploadDirectory, `${jobId}.${extension}`);
  if (!finalPath.startsWith(`${resolve(uploadDirectory)}/`)) {
    throw createHttpError(400, 'Invalid scan upload path.');
  }

  return {
    finalPath,
    temporaryPath: `${finalPath}.part`,
  };
}

async function removeFile(path) {
  if (!path) {
    return;
  }

  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function storeScanJobUpload(request, userId, job) {
  if (job.status !== 'uploading') {
    if (job.hasImage || ['queued', 'processing', 'completed'].includes(job.status)) {
      return job;
    }
    throw createHttpError(409, 'Scan job cannot accept an image upload.');
  }

  const mimeType = String(request.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    throw createHttpError(413, 'Image is too large.');
  }

  const { finalPath, temporaryPath } = getUploadPaths(job.id, mimeType);
  await mkdir(uploadDirectory, { recursive: true });
  await removeFile(temporaryPath);

  let imageBytes = 0;
  const byteLimit = new Transform({
    transform(chunk, _encoding, callback) {
      imageBytes += chunk.length;
      if (imageBytes > MAX_UPLOAD_BYTES) {
        callback(createHttpError(413, 'Image is too large.'));
        return;
      }
      callback(null, chunk);
    },
  });

  request.setTimeout(UPLOAD_TIMEOUT_MS, () => {
    request.destroy(createHttpError(408, 'Image upload timed out.'));
  });

  try {
    await pipeline(request, byteLimit, createWriteStream(temporaryPath, { flags: 'wx' }));
    if (imageBytes === 0) {
      throw createHttpError(400, 'Image is required.');
    }
    await rename(temporaryPath, finalPath);
    return completeScanJobUpload(userId, job.id, {
      imageBytes,
      imageMimeType: mimeType,
      imagePath: finalPath,
    });
  } catch (error) {
    await removeFile(temporaryPath).catch(() => {});
    throw error;
  }
}

export async function removeScanJobImage(job) {
  if (!job?.imagePath) {
    return;
  }

  try {
    await removeFile(job.imagePath);
    clearScanJobImage(job.id);
  } catch (error) {
    console.error(`[scan-upload] could not remove ${job.imagePath}`, error);
  }
}

export async function cleanScanUploadDirectory() {
  await mkdir(uploadDirectory, { recursive: true });
  const trackedJobs = listScanJobImagePaths();
  const activePaths = new Set(
    trackedJobs
      .filter((job) => ['queued', 'processing'].includes(job.status))
      .map((job) => resolve(job.imagePath)),
  );

  const fileNames = await readdir(uploadDirectory);
  await Promise.all(fileNames.map(async (fileName) => {
    const path = resolve(uploadDirectory, fileName);
    if (fileName.endsWith('.part')) {
      const fileStat = await stat(path).catch(() => null);
      if (fileStat && Date.now() - fileStat.mtimeMs >= STALE_PARTIAL_AGE_MS) {
        await removeFile(path);
      }
      return;
    }
    if (!activePaths.has(path)) {
      await removeFile(path);
    }
  }));

  trackedJobs
    .filter((job) => !activePaths.has(resolve(job.imagePath)))
    .forEach((job) => clearScanJobImage(job.id));
}
