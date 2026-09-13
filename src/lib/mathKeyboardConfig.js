export const MATH_KEYBOARD_GRID_COLUMNS = 7;
export const MATH_KEYBOARD_GRID_ROWS = 6;
export const MATH_KEYBOARD_GRID_SIZE = MATH_KEYBOARD_GRID_COLUMNS * MATH_KEYBOARD_GRID_ROWS;
export const RESERVED_MATH_KEYBOARD_SLOT_INDICES = [
  MATH_KEYBOARD_GRID_SIZE - 1,
];
const RESERVED_MATH_KEYBOARD_SLOT_SET = new Set(RESERVED_MATH_KEYBOARD_SLOT_INDICES);
const RETIRED_MATH_KEY_IDS = new Set(['keyboard', 'space', 'newline', 'delete']);
const CENTER_BOTTOM_MATH_KEYBOARD_SLOT_INDEX = (
  ((MATH_KEYBOARD_GRID_ROWS - 1) * MATH_KEYBOARD_GRID_COLUMNS)
  + Math.floor(MATH_KEYBOARD_GRID_COLUMNS / 2)
);
export const SYSTEM_MATH_KEY_DEFINITIONS = [
  {
    action: 'camera',
    defaultSlotIndex: CENTER_BOTTOM_MATH_KEYBOARD_SLOT_INDEX,
    insert: '',
    label: 'camera',
    systemKeyId: 'camera',
  },
];

const SYSTEM_MATH_KEY_BY_ID = new Map(
  SYSTEM_MATH_KEY_DEFINITIONS.map((definition) => [definition.systemKeyId, definition]),
);

function createEmptyMathKeyboardSlot(index) {
  return {
    id: `math-key-slot-${index}`,
    insert: '',
    isEmpty: true,
    label: '',
    slotIndex: index,
  };
}

function createReservedMathKeyboardSlot(index) {
  return {
    id: `math-key-reserved-slot-${index}`,
    insert: '',
    isEmpty: true,
    isReserved: true,
    label: '',
    slotIndex: index,
  };
}

function createSystemMathKeyboardSlot(definition, index) {
  return {
    action: definition.action,
    id: `math-key-system-${definition.systemKeyId}`,
    insert: definition.insert,
    isEmpty: false,
    isSystem: true,
    label: definition.label,
    slotIndex: index,
    systemKeyId: definition.systemKeyId,
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

function isValidMathKeyboardSlotIndex(index) {
  return index >= 0
    && index < MATH_KEYBOARD_GRID_SIZE
    && !RESERVED_MATH_KEYBOARD_SLOT_SET.has(index);
}

export function normalizeMathKeyboardKeys(rawKeys) {
  const normalizedKeys = Array.from(
    { length: MATH_KEYBOARD_GRID_SIZE },
    (_, index) => (RESERVED_MATH_KEYBOARD_SLOT_SET.has(index)
      ? createReservedMathKeyboardSlot(index)
      : createEmptyMathKeyboardSlot(index)),
  );
  const placedSystemKeyIds = new Set();
  const pendingKeys = [];
  const hasRetiredKeys = (Array.isArray(rawKeys) ? rawKeys : []).some(
    (rawKey) => RETIRED_MATH_KEY_IDS.has(rawKey?.systemKeyId),
  );

  (Array.isArray(rawKeys) ? rawKeys : []).forEach((rawKey, fallbackIndex) => {
    const systemDefinition = typeof rawKey === 'object' && rawKey !== null
      ? SYSTEM_MATH_KEY_BY_ID.get(rawKey.systemKeyId)
      : null;
    const systemSlotIndex = hasRetiredKeys && systemDefinition?.systemKeyId === 'camera'
      ? systemDefinition.defaultSlotIndex
      : normalizeSlotIndex(rawKey, fallbackIndex);

    if (
      systemDefinition
      && !placedSystemKeyIds.has(systemDefinition.systemKeyId)
      && isValidMathKeyboardSlotIndex(systemSlotIndex)
      && normalizedKeys[systemSlotIndex].isEmpty
    ) {
      normalizedKeys[systemSlotIndex] = createSystemMathKeyboardSlot(
        systemDefinition,
        systemSlotIndex,
      );
      placedSystemKeyIds.add(systemDefinition.systemKeyId);
      return;
    }

    if (systemDefinition) {
      pendingKeys.push({
        definition: systemDefinition,
      });
    }
  });

  pendingKeys.forEach((pendingKey) => {
    const slotIndex = normalizedKeys.findIndex((key) => key.isEmpty && !key.isReserved);
    if (slotIndex < 0) {
      return;
    }

    if (placedSystemKeyIds.has(pendingKey.definition.systemKeyId)) {
      return;
    }

    normalizedKeys[slotIndex] = createSystemMathKeyboardSlot(pendingKey.definition, slotIndex);
    placedSystemKeyIds.add(pendingKey.definition.systemKeyId);
  });

  SYSTEM_MATH_KEY_DEFINITIONS.forEach((definition) => {
    if (placedSystemKeyIds.has(definition.systemKeyId)) {
      return;
    }

    const defaultSlot = normalizedKeys[definition.defaultSlotIndex];
    const slotIndex = defaultSlot?.isEmpty
      ? definition.defaultSlotIndex
      : normalizedKeys.findIndex((key) => key.isEmpty && !key.isReserved);

    if (slotIndex < 0) {
      return;
    }

    normalizedKeys[slotIndex] = createSystemMathKeyboardSlot(definition, slotIndex);
    placedSystemKeyIds.add(definition.systemKeyId);
  });

  return normalizedKeys;
}

export function getActiveMathKeyboardKeys(keys = []) {
  return normalizeMathKeyboardKeys(keys).filter((key) => !key.isEmpty);
}

export function serializeMathKeyboardKeys(keys = []) {
  return getActiveMathKeyboardKeys(keys).map((key) => ({
    systemKeyId: key.systemKeyId,
    slotIndex: key.slotIndex,
  }));
}

function withSlotIndex(key, slotIndex) {
  if (key.isEmpty) {
    return RESERVED_MATH_KEYBOARD_SLOT_SET.has(slotIndex)
      ? createReservedMathKeyboardSlot(slotIndex)
      : createEmptyMathKeyboardSlot(slotIndex);
  }

  if (key.isSystem) {
    return createSystemMathKeyboardSlot(
      SYSTEM_MATH_KEY_BY_ID.get(key.systemKeyId),
      slotIndex,
    );
  }

  return createEmptyMathKeyboardSlot(slotIndex);
}

export function moveMathKeyboardKey(keys = [], sourceIndex, targetIndex) {
  const normalizedKeys = normalizeMathKeyboardKeys(keys);

  if (
    sourceIndex < 0
    || sourceIndex >= MATH_KEYBOARD_GRID_SIZE
    || targetIndex < 0
    || targetIndex >= MATH_KEYBOARD_GRID_SIZE
    || sourceIndex === targetIndex
    || normalizedKeys[sourceIndex]?.isEmpty
    || normalizedKeys[targetIndex]?.isReserved
  ) {
    return normalizedKeys;
  }

  const nextKeys = [...normalizedKeys];
  const sourceKey = normalizedKeys[sourceIndex];
  const targetKey = normalizedKeys[targetIndex];
  nextKeys[targetIndex] = withSlotIndex(sourceKey, targetIndex);
  nextKeys[sourceIndex] = withSlotIndex(targetKey, sourceIndex);

  return nextKeys;
}
