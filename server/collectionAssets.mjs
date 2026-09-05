import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { collectionAssets } from './collectionManifest.mjs';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const collectionAssetDirectory = join(projectDirectory, 'assets', 'collections', 'mobile');
const collectionAssetFiles = new Set(collectionAssets.map((asset) => asset.file));

function createNotFoundError() {
  const error = new Error('Collection asset not found.');
  error.status = 404;
  return error;
}

export function resolveCollectionAssetPath(fileName) {
  if (!collectionAssetFiles.has(fileName)) {
    throw createNotFoundError();
  }

  const filePath = resolve(collectionAssetDirectory, fileName);
  if (!filePath.startsWith(`${collectionAssetDirectory}/`)) {
    throw createNotFoundError();
  }
  return filePath;
}

export async function serveCollectionAsset(response, fileName) {
  const filePath = resolveCollectionAssetPath(fileName);
  const fileStat = await stat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') {
      throw createNotFoundError();
    }
    throw error;
  });

  response.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Length': fileStat.size,
    'Content-Type': 'image/webp',
  });
  await pipeline(createReadStream(filePath), response);
}
