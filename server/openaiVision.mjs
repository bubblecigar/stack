import scanTree from './scanTree.cjs';

const DEFAULT_SCAN_MODEL = 'gpt-5.6-luna';
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;
const MAX_SCAN_PROMPT_LENGTH = 4_000;
const DEFAULT_SCAN_TIMEOUT_MS = 120_000;
const { SCAN_TREE_SCHEMA, normalizeScanTreeResult } = scanTree;

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeImageInput(body) {
  const imageBase64 = typeof body?.imageBase64 === 'string'
    ? body.imageBase64.trim()
    : '';
  const mimeType = typeof body?.mimeType === 'string' && body.mimeType.trim()
    ? body.mimeType.trim()
    : 'image/jpeg';

  if (!imageBase64) {
    throw createHttpError(400, 'Image is required.');
  }

  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw createHttpError(413, 'Image is too large.');
  }

  if (!/^image\/(jpeg|jpg|png|webp)$/i.test(mimeType)) {
    throw createHttpError(400, 'Unsupported image type.');
  }

  return {
    imageUrl: `data:${mimeType};base64,${imageBase64}`,
  };
}

function normalizePrompt(value) {
  const prompt = value == null
    ? ''
    : String(value).trim().slice(0, MAX_SCAN_PROMPT_LENGTH);
  if (!prompt) {
    throw createHttpError(400, 'Prompt is required.');
  }

  return prompt;
}

function readResponseText(result) {
  if (typeof result?.output_text === 'string') {
    return result.output_text;
  }

  return (Array.isArray(result?.output) ? result.output : [])
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .map((content) => content?.text || '')
    .join('\n');
}

function readResponseRefusal(result) {
  return (Array.isArray(result?.output) ? result.output : [])
    .flatMap((item) => (Array.isArray(item?.content) ? item.content : []))
    .find((content) => content?.type === 'refusal')
    ?.refusal;
}

export async function scanImageToCards(body, options = {}) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createHttpError(503, 'OpenAI API key is not configured.');
  }

  const { imageUrl } = normalizeImageInput(body);
  const prompt = normalizePrompt(body?.prompt);
  const model = options.model || process.env.OPENAI_SCAN_MODEL || DEFAULT_SCAN_MODEL;
  const request = options.fetchImpl || fetch;
  const timeoutMs = Number(options.timeoutMs || process.env.OPENAI_SCAN_TIMEOUT_MS)
    || DEFAULT_SCAN_TIMEOUT_MS;
  const signal = options.signal || AbortSignal.timeout(timeoutMs);

  let response;
  try {
    response = await request('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: prompt,
              },
              {
                type: 'input_image',
                image_url: imageUrl,
                detail: 'original',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'scan_card_tree',
            schema: SCAN_TREE_SCHEMA,
            strict: true,
          },
        },
      }),
    });
  } catch (error) {
    if (signal.aborted) {
      throw createHttpError(504, 'OpenAI scan timed out.');
    }
    throw error;
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      response.status,
      result?.error?.message || 'OpenAI scan request failed.',
    );
  }

  if (result?.status === 'incomplete') {
    throw createHttpError(502, 'OpenAI returned an incomplete scan result.');
  }

  if (readResponseRefusal(result)) {
    throw createHttpError(422, 'OpenAI could not process this image.');
  }

  const responseText = readResponseText(result);
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw createHttpError(502, 'OpenAI returned an invalid scan result.');
  }

  let scanTreeResult;
  try {
    scanTreeResult = normalizeScanTreeResult(parsed);
  } catch (error) {
    throw createHttpError(502, `OpenAI returned an invalid card tree: ${error.message}`);
  }

  return {
    ...scanTreeResult,
    model,
  };
}
