const DEFAULT_SCAN_MODEL = 'gpt-5.6-luna';
const MAX_SCAN_CARDS = 24;
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;

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

function parseJsonObject(text) {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) {
    return null;
  }

  try {
    return JSON.parse(trimmedText);
  } catch {
    const match = trimmedText.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
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

function normalizeScannedCards(value) {
  const rawCards = Array.isArray(value?.cards) ? value.cards : [];

  return rawCards
    .map((card) => {
      const text = typeof card === 'string' ? card : card?.text;
      return String(text || '').trim();
    })
    .filter(Boolean)
    .slice(0, MAX_SCAN_CARDS)
    .map((text) => ({ text }));
}

export async function scanImageToCards(body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createHttpError(503, 'OpenAI API key is not configured.');
  }

  const { imageUrl } = normalizeImageInput(body);
  const model = process.env.OPENAI_SCAN_MODEL || DEFAULT_SCAN_MODEL;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'Extract the visible written content from this image and convert it into task cards.',
                'Return only JSON in this exact shape: {"cards":[{"text":"..."}]}.',
                'Each card should be concise, preserving math notation and line breaks when useful.',
                `Return at most ${MAX_SCAN_CARDS} cards. If no useful text is visible, return {"cards":[]}.`,
              ].join('\n'),
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high',
            },
          ],
        },
      ],
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createHttpError(
      response.status,
      result?.error?.message || 'OpenAI scan request failed.',
    );
  }

  const parsed = parseJsonObject(readResponseText(result));
  return {
    cards: normalizeScannedCards(parsed),
    model,
  };
}
