const MAX_KEY_LABEL_LENGTH = 32;
const MAX_KEY_INSERT_LENGTH = 200;

function normalizeText(value, maxLength) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().slice(0, maxLength);
}

export function createMathKeyboardKey(value) {
  const label = normalizeText(value, MAX_KEY_LABEL_LENGTH);
  const insert = normalizeText(value, MAX_KEY_INSERT_LENGTH);

  if (!label || !insert) {
    return null;
  }

  return {
    id: `math-key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    insert,
    label,
  };
}

export function normalizeMathKeyboardKeys(rawKeys) {
  if (!Array.isArray(rawKeys)) {
    return [];
  }

  return rawKeys
    .map((rawKey, index) => {
      const rawLabel = typeof rawKey === 'object' && rawKey !== null
        ? rawKey.label
        : rawKey;
      const rawInsert = typeof rawKey === 'object' && rawKey !== null
        ? rawKey.insert ?? rawKey.label
        : rawKey;
      const label = normalizeText(rawLabel, MAX_KEY_LABEL_LENGTH);
      const insert = normalizeText(rawInsert, MAX_KEY_INSERT_LENGTH);

      if (!label || !insert) {
        return null;
      }

      return {
        id: normalizeText(rawKey?.id, 40) || `math-key-${index}-${label}`,
        insert,
        label,
      };
    })
    .filter(Boolean);
}
