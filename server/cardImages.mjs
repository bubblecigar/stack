import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
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
import { getDataDirectory } from './db.mjs';

const MAX_UPLOAD_BYTES = 8_000_000;
const UPLOAD_TIMEOUT_MS = 120_000;
const imageDirectory = join(getDataDirectory(), 'card-images');
const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const EXTENSION_MIME_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizePositiveInteger(value, label) {
  const normalizedValue = Number(value);
  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw createHttpError(400, `Invalid ${label}.`);
  }
  return normalizedValue;
}

async function removeFile(path) {
  try {
    await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

function getUserDirectory(userId) {
  const normalizedUserId = normalizePositiveInteger(userId, 'user ID');
  return join(imageDirectory, String(normalizedUserId));
}

async function removeOtherCardImages(userDirectory, cardId, keptFileName = null) {
  const fileNames = await readdir(userDirectory).catch((error) => {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  });
  const prefix = `${cardId}-`;

  await Promise.all(fileNames
    .filter((fileName) => fileName.startsWith(prefix) && fileName !== keptFileName)
    .map((fileName) => removeFile(join(userDirectory, fileName))));
}

export async function storeCardImage(request, userId, rawCardId) {
  const cardId = normalizePositiveInteger(rawCardId, 'card ID');
  const mimeType = String(request.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const extension = MIME_EXTENSIONS[mimeType];
  if (!extension) {
    throw createHttpError(415, 'Unsupported image type.');
  }

  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    throw createHttpError(413, 'Image is too large.');
  }

  const normalizedUserId = normalizePositiveInteger(userId, 'user ID');
  const userDirectory = getUserDirectory(normalizedUserId);
  const fileName = `${cardId}-${randomUUID()}.${extension}`;
  const finalPath = resolve(userDirectory, fileName);
  const temporaryPath = `${finalPath}.part`;
  await mkdir(userDirectory, { recursive: true });

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
  } catch (error) {
    await removeFile(temporaryPath).catch(() => {});
    throw error;
  }

  return {
    imageBytes,
    imageMimeType: EXTENSION_MIME_TYPES[extension],
    imagePath: `/api/card-images/${normalizedUserId}/${fileName}`,
  };
}

export async function removeCardImages(userId, rawCardId) {
  const cardId = normalizePositiveInteger(rawCardId, 'card ID');
  await removeOtherCardImages(getUserDirectory(userId), cardId);
}

export async function pruneCardImages(userId, cards, { minimumAgeMs = 60_000 } = {}) {
  const normalizedUserId = normalizePositiveInteger(userId, 'user ID');
  const userDirectory = getUserDirectory(normalizedUserId);
  const referencedFileNames = new Set((Array.isArray(cards) ? cards : [])
    .map((card) => String(card?.imagePath || ''))
    .map((imagePath) => {
      const match = imagePath.match(
        new RegExp(`^/api/card-images/${normalizedUserId}/([^/]+)$`),
      );
      return match?.[1] || null;
    })
    .filter(Boolean));
  const fileNames = await readdir(userDirectory).catch((error) => {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  await Promise.all(fileNames.map(async (fileName) => {
    if (referencedFileNames.has(fileName)) {
      return;
    }

    const filePath = join(userDirectory, fileName);
    const fileStat = await stat(filePath).catch(() => null);
    if (fileStat && Date.now() - fileStat.mtimeMs >= minimumAgeMs) {
      await removeFile(filePath);
    }
  }));
}

export async function serveCardImage(response, rawUserId, fileName) {
  const userDirectory = resolve(getUserDirectory(rawUserId));
  if (!/^\d+-[0-9a-f-]+\.(jpg|png|webp)$/.test(fileName)) {
    throw createHttpError(404, 'Image not found.');
  }

  const imagePath = resolve(userDirectory, fileName);
  if (!imagePath.startsWith(`${userDirectory}/`)) {
    throw createHttpError(404, 'Image not found.');
  }

  const imageStat = await stat(imagePath).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw createHttpError(404, 'Image not found.');
    }
    throw error;
  });
  const extension = fileName.split('.').pop();

  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': imageStat.size,
    'Content-Type': EXTENSION_MIME_TYPES[extension],
  });
  await pipeline(createReadStream(imagePath), response);
}
