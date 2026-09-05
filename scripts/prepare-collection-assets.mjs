import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SUPPORTED_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);
const PIPELINE_VERSION = 1;
const DEFAULTS = {
  contentSize: 680,
  input: 'assets/collections',
  noiseFloor: 6,
  output: 'assets/collections/mobile',
  prefix: 'monster',
  quality: 82,
  size: 768,
};

function printHelp() {
  console.log([
    'Prepare monochrome collection artwork for efficient mobile delivery.',
    '',
    'The source images are preserved. The program extracts pencil/ink darkness',
    'into a transparent alpha channel, removes light checkerboard pixels, trims',
    'the subject, and writes a centered transparent WebP.',
    '',
    'Usage:',
    '  npm run prepare:collections',
    '  npm run prepare:collections -- --input assets/collections --output assets/collections/mobile',
    '',
    'Options:',
    `  --input <dir>          Source directory (default: ${DEFAULTS.input})`,
    `  --output <dir>         Destination directory (default: ${DEFAULTS.output})`,
    `  --size <pixels>        Square output canvas (default: ${DEFAULTS.size})`,
    `  --content-size <px>    Maximum subject bounds (default: ${DEFAULTS.contentSize})`,
    `  --quality <1-100>      WebP visual quality (default: ${DEFAULTS.quality})`,
    `  --noise-floor <0-50>   Remove this lightest percentage of ink (default: ${DEFAULTS.noiseFloor})`,
    `  --prefix <name>        Output filename prefix (default: ${DEFAULTS.prefix})`,
    '  --force                Rebuild files that already exist',
    '  --help                 Show this help',
    '',
    'Requirement: ImageMagick 7 with the `magick` command.',
  ].join('\n'));
}

function readValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parseInteger(value, option, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${option} must be an integer from ${minimum} to ${maximum}.`);
  }
  return number;
}

function parseArgs(args) {
  const options = { ...DEFAULTS, force: false };

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === '--help') {
      options.help = true;
    } else if (option === '--force') {
      options.force = true;
    } else if (option === '--input') {
      options.input = readValue(args, index, option);
      index += 1;
    } else if (option === '--output') {
      options.output = readValue(args, index, option);
      index += 1;
    } else if (option === '--prefix') {
      options.prefix = readValue(args, index, option).replace(/[^a-zA-Z0-9_-]/g, '-');
      index += 1;
    } else if (option === '--size') {
      options.size = parseInteger(readValue(args, index, option), option, 64, 4096);
      index += 1;
    } else if (option === '--content-size') {
      options.contentSize = parseInteger(readValue(args, index, option), option, 32, 4096);
      index += 1;
    } else if (option === '--quality') {
      options.quality = parseInteger(readValue(args, index, option), option, 1, 100);
      index += 1;
    } else if (option === '--noise-floor') {
      options.noiseFloor = parseInteger(readValue(args, index, option), option, 0, 50);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }

  if (options.contentSize > options.size) {
    throw new Error('--content-size cannot be larger than --size.');
  }
  if (!options.prefix) {
    throw new Error('--prefix must contain at least one filename-safe character.');
  }

  return options;
}

async function assertImageMagickAvailable() {
  try {
    await execFileAsync('magick', ['-version']);
  } catch {
    throw new Error('ImageMagick 7 is required. Install it and ensure `magick` is on PATH.');
  }
}

async function getImageSize(path) {
  const { stdout } = await execFileAsync('magick', [
    'identify',
    '-format',
    '%w %h',
    path,
  ]);
  const [width, height] = stdout.trim().split(/\s+/).map(Number);
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`Could not read image dimensions: ${path}`);
  }
  return { height, width };
}

async function prepareImage(sourcePath, outputPath, options, workDirectory) {
  const { height, width } = await getImageSize(sourcePath);
  const maskPath = join(workDirectory, 'mask.png');
  const inkPath = join(workDirectory, 'ink.png');

  // A black pixel becomes fully opaque; white becomes transparent. Removing the
  // lightest alpha values suppresses the baked white/light-gray checkerboard.
  await execFileAsync('magick', [
    sourcePath,
    '-colorspace', 'Gray',
    '-negate',
    '-black-threshold', `${options.noiseFloor}%`,
    maskPath,
  ]);

  await execFileAsync('magick', [
    '-size', `${width}x${height}`,
    'xc:black',
    maskPath,
    '-alpha', 'off',
    '-compose', 'CopyOpacity',
    '-composite',
    inkPath,
  ]);

  await execFileAsync('magick', [
    inkPath,
    '-trim',
    '+repage',
    '-resize', `${options.contentSize}x${options.contentSize}>`,
    '-gravity', 'center',
    '-background', 'none',
    '-extent', `${options.size}x${options.size}`,
    '-define', 'webp:alpha-quality=100',
    '-quality', String(options.quality),
    outputPath,
  ]);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function getAssetId(sourceHash, options) {
  const processingSignature = JSON.stringify({
    contentSize: options.contentSize,
    noiseFloor: options.noiseFloor,
    pipelineVersion: PIPELINE_VERSION,
    quality: options.quality,
    size: options.size,
  });
  const assetHash = createHash('sha256')
    .update(sourceHash)
    .update(processingSignature)
    .digest('hex');
  return `${options.prefix}-${assetHash.slice(0, 16)}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  await assertImageMagickAvailable();

  const inputDirectory = resolve(options.input);
  const outputDirectory = resolve(options.output);
  const directoryEntries = await readdir(inputDirectory, { withFileTypes: true });
  const sourceNames = directoryEntries
    .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (sourceNames.length === 0) {
    throw new Error(`No supported images found in ${inputDirectory}`);
  }

  await mkdir(outputDirectory, { recursive: true });
  const manifestPath = join(outputDirectory, 'collection-manifest.json');
  let summonChance;
  try {
    const existingManifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const configuredSummonChance = Number(existingManifest?.summonChance);
    if (
      Number.isFinite(configuredSummonChance)
      && configuredSummonChance >= 0
      && configuredSummonChance <= 1
    ) {
      summonChance = configuredSummonChance;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
  const workDirectory = await mkdtemp(join(tmpdir(), 'prepare-collection-assets-'));
  const assetBySourceHash = new Map();
  const files = [];

  try {
    for (const sourceName of sourceNames) {
      const sourcePath = join(inputDirectory, sourceName);
      const sourceHash = await sha256(sourcePath);
      let asset = assetBySourceHash.get(sourceHash);

      if (!asset) {
        const assetId = getAssetId(sourceHash, options);
        const outputName = `${assetId}.webp`;
        const outputPath = join(outputDirectory, outputName);

        if (options.force) {
          await rm(outputPath, { force: true });
        }

        try {
          await stat(outputPath);
          console.log(`Reusing ${outputName}`);
        } catch (error) {
          if (error?.code !== 'ENOENT') {
            throw error;
          }
          console.log(`Preparing ${sourceName} -> ${outputName}`);
          await prepareImage(sourcePath, outputPath, options, workDirectory);
        }

        const outputStat = await stat(outputPath);
        asset = {
          assetId,
          bytes: outputStat.size,
          file: outputName,
          height: options.size,
          width: options.size,
        };
        assetBySourceHash.set(sourceHash, asset);
      } else {
        console.log(`Deduplicating ${sourceName} -> ${asset.file}`);
      }

      files.push({
        ...asset,
        source: basename(sourceName),
        sourceSha256: sourceHash,
      });
    }
  } finally {
    await rm(workDirectory, { force: true, recursive: true });
  }

  const manifest = {
    format: 'webp',
    pipelineVersion: PIPELINE_VERSION,
    ...(summonChance === undefined ? {} : { summonChance }),
    settings: {
      contentSize: options.contentSize,
      noiseFloorPercent: options.noiseFloor,
      quality: options.quality,
      size: options.size,
    },
    uniqueAssetCount: assetBySourceHash.size,
    sourceCount: files.length,
    files,
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const sourceBytes = (await Promise.all(sourceNames.map(async (name) => (
    await stat(join(inputDirectory, name))
  )))).reduce((total, file) => total + file.size, 0);
  const outputBytes = [...assetBySourceHash.values()]
    .reduce((total, asset) => total + asset.bytes, 0);
  const savings = sourceBytes > 0 ? Math.round((1 - (outputBytes / sourceBytes)) * 100) : 0;

  console.log(`Wrote ${assetBySourceHash.size} unique assets and ${manifestPath}`);
  console.log(`Unique output size: ${outputBytes} bytes (${savings}% smaller than all sources)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
