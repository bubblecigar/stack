import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const projectDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monsterStampDirectory = join(projectDirectory, 'assets', 'collections', 'mobile');
const MONSTER_STAMP_FILE_PATTERN = /^monster-[a-f0-9]{16}\.webp$/;

function createNotFoundError() {
  const error = new Error('Monster stamp not found.');
  error.status = 404;
  return error;
}

export function resolveMonsterStampPath(fileName) {
  if (!MONSTER_STAMP_FILE_PATTERN.test(fileName)) {
    throw createNotFoundError();
  }

  const filePath = resolve(monsterStampDirectory, fileName);
  if (!filePath.startsWith(`${monsterStampDirectory}/`)) {
    throw createNotFoundError();
  }
  return filePath;
}

export async function serveMonsterStamp(response, fileName) {
  const filePath = resolveMonsterStampPath(fileName);
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
