const MAX_KEY_LABEL_LENGTH = 32;
const MAX_KEY_INSERT_LENGTH = 200;
export const MATH_KEYBOARD_GRID_COLUMNS = 7;
export const MATH_KEYBOARD_GRID_ROWS = 6;
export const MATH_KEYBOARD_GRID_SIZE = MATH_KEYBOARD_GRID_COLUMNS * MATH_KEYBOARD_GRID_ROWS;

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

function createEmptyMathKeyboardSlot(index) {
  return {
    id: `math-key-slot-${index}`,
    insert: '',
    isEmpty: true,
    label: '',
    slotIndex: index,
  };
}

function normalizeSlotIndex(rawKey, fallbackIndex) {
  const explicitSlotIndex = Number(rawKey?.slotIndex);
  if (Number.isInteger(explicitSlotIndex)) {
    return explicitSlotIndex;
  }

  const idMatch = typeof rawKey?.id === 'string'
    ? rawKey.id.match(/^math-key-slot-(\d+)$/)
    : null;
  if (idMatch) {
    return Number(idMatch[1]);
  }

  return fallbackIndex;
}

export function normalizeMathKeyboardKeys(rawKeys) {
  const normalizedKeys = Array.from(
    { length: MATH_KEYBOARD_GRID_SIZE },
    (_, index) => createEmptyMathKeyboardSlot(index),
  );

  (Array.isArray(rawKeys) ? rawKeys : []).forEach((rawKey, fallbackIndex) => {
    const rawLabel = typeof rawKey === 'object' && rawKey !== null
      ? rawKey.label
      : rawKey;
    const rawInsert = typeof rawKey === 'object' && rawKey !== null
      ? rawKey.insert ?? rawKey.label
      : rawKey;
    const label = normalizeText(rawLabel, MAX_KEY_LABEL_LENGTH);
    const insert = normalizeText(rawInsert, MAX_KEY_INSERT_LENGTH);
    const slotIndex = normalizeSlotIndex(rawKey, fallbackIndex);

    if (
      !label
      || !insert
      || slotIndex < 0
      || slotIndex >= MATH_KEYBOARD_GRID_SIZE
    ) {
      return;
    }

    normalizedKeys[slotIndex] = {
      id: `math-key-slot-${slotIndex}`,
      insert,
      isEmpty: false,
      label,
      slotIndex,
    };
  });

  return normalizedKeys;
}

export function getActiveMathKeyboardKeys(keys = []) {
  return normalizeMathKeyboardKeys(keys).filter((key) => !key.isEmpty);
}

export function serializeMathKeyboardKeys(keys = []) {
  return getActiveMathKeyboardKeys(keys).map((key) => ({
    insert: key.insert,
    label: key.label,
    slotIndex: key.slotIndex,
  }));
}

export function updateMathKeyboardKeyAt(keys = [], index, value) {
  if (index < 0 || index >= MATH_KEYBOARD_GRID_SIZE) {
    return normalizeMathKeyboardKeys(keys);
  }

  const normalizedKeys = normalizeMathKeyboardKeys(keys);
  const label = normalizeText(value, MAX_KEY_LABEL_LENGTH);
  const insert = normalizeText(value, MAX_KEY_INSERT_LENGTH);

  normalizedKeys[index] = label && insert
    ? {
      id: `math-key-slot-${index}`,
      insert,
      isEmpty: false,
      label,
      slotIndex: index,
    }
    : createEmptyMathKeyboardSlot(index);

  return normalizedKeys;
}
