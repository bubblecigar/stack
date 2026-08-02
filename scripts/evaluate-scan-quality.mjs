import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanImageToCards } from '../server/openaiVision.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = resolve(projectRoot, 'fixtures/scan-quality');
const manifestPath = resolve(fixtureRoot, 'manifest.json');
const promptConfigPath = resolve(projectRoot, 'src/lib/scanPrompt.json');
const reportDirectory = resolve(projectRoot, 'artifacts');
const DEFAULT_MODELS = ['gpt-5.6-luna', 'gpt-5.6-terra'];

function printHelp() {
  console.log([
    'Compare scan-tree quality across models using local image fixtures.',
    '',
    'Setup: fixtures/scan-quality/README.md',
    'Run:   npm run evaluate:scan',
    '',
    'Optional environment:',
    '  OPENAI_SCAN_EVAL_MODELS=gpt-5.6-luna,gpt-5.6-terra',
  ].join('\n'));
}

function loadLocalEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    return;
  }

  try {
    process.loadEnvFile(resolve(projectRoot, '.env'));
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function getMimeType(imagePath) {
  const extension = extname(imagePath).toLowerCase();
  const mimeTypes = {
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const mimeType = mimeTypes[extension];
  if (!mimeType) {
    throw new Error(`Unsupported fixture image type: ${extension || 'none'}`);
  }
  return mimeType;
}

function measureTree(result, requiredTerms) {
  const nodeById = new Map(result.nodes.map((node) => [node.id, node]));
  const depthById = new Map();

  function getDepth(node) {
    if (depthById.has(node.id)) {
      return depthById.get(node.id);
    }
    const depth = node.parentId === null ? 1 : getDepth(nodeById.get(node.parentId)) + 1;
    depthById.set(node.id, depth);
    return depth;
  }

  const texts = result.nodes.map((node) => node.text);
  const normalizedTexts = texts.map((text) => text.trim().toLocaleLowerCase());
  const uniqueTextCount = new Set(normalizedTexts).size;
  const searchableText = `${result.title}\n${texts.join('\n')}`.toLocaleLowerCase();
  const termCoverage = requiredTerms.map((term) => ({
    found: searchableText.includes(String(term).toLocaleLowerCase()),
    term,
  }));

  return {
    averageCardCharacters: texts.length === 0
      ? 0
      : Math.round(texts.reduce((sum, text) => sum + text.length, 0) / texts.length),
    duplicateTextCount: texts.length - uniqueTextCount,
    kindCounts: result.nodes.reduce((counts, node) => ({
      ...counts,
      [node.kind]: (counts[node.kind] || 0) + 1,
    }), {}),
    longestCardCharacters: texts.reduce((longest, text) => Math.max(longest, text.length), 0),
    maxDepth: result.nodes.reduce((deepest, node) => Math.max(deepest, getDepth(node)), 0),
    nodeCount: result.nodes.length,
    rootCount: result.nodes.filter((node) => node.parentId === null).length,
    requiredTermCoverage: termCoverage,
  };
}

function getModels() {
  const configuredModels = String(process.env.OPENAI_SCAN_EVAL_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return configuredModels.length > 0 ? [...new Set(configuredModels)] : DEFAULT_MODELS;
}

async function evaluateFixture(fixture, model, prompt) {
  const imagePath = resolve(fixtureRoot, fixture.image);
  const image = await readFile(imagePath);
  const startedAt = Date.now();

  try {
    const result = await scanImageToCards({
      imageBase64: image.toString('base64'),
      mimeType: getMimeType(imagePath),
      prompt,
    }, { model });

    return {
      durationMs: Date.now() - startedAt,
      fixtureId: fixture.id,
      metrics: measureTree(result, fixture.requiredTerms || []),
      model,
      result,
      review: {
        hierarchy: null,
        inventedClaims: null,
        omissions: null,
        readability: null,
        notes: '',
      },
      status: 'completed',
    };
  } catch (error) {
    return {
      durationMs: Date.now() - startedAt,
      error: error.message,
      fixtureId: fixture.id,
      model,
      status: 'failed',
    };
  }
}

async function main() {
  if (process.argv.includes('--help')) {
    printHelp();
    return;
  }

  loadLocalEnv();
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error('Create fixtures/scan-quality/manifest.json before running the evaluator.');
    }
    throw error;
  }

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error('The scan quality manifest must contain at least one fixture.');
  }

  const promptConfig = await readJson(promptConfigPath);
  const prompt = promptConfig.lines.join('\n');
  const models = getModels();
  const results = [];

  for (const fixture of manifest) {
    if (!fixture?.id || !fixture?.image) {
      throw new Error('Every fixture requires id and image fields.');
    }

    for (const model of models) {
      console.log(`Evaluating ${fixture.id} with ${model}...`);
      results.push(await evaluateFixture(fixture, model, prompt));
    }
  }

  const report = {
    createdAt: new Date().toISOString(),
    models,
    promptVersion: promptConfig.version,
    results,
  };
  const reportName = `scan-quality-report-${report.createdAt.replace(/[:.]/g, '-')}.json`;
  const reportPath = resolve(reportDirectory, reportName);
  await mkdir(reportDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
