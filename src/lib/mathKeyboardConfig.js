const MAX_KEY_LABEL_LENGTH = 32;
const MAX_KEY_INSERT_LENGTH = 200;
export const MATH_KEYBOARD_GRID_COLUMNS = 7;
export const MATH_KEYBOARD_GRID_ROWS = 6;
export const MATH_KEYBOARD_GRID_SIZE = MATH_KEYBOARD_GRID_COLUMNS * MATH_KEYBOARD_GRID_ROWS;
export const RESERVED_MATH_KEYBOARD_SLOT_INDICES = [
  MATH_KEYBOARD_GRID_SIZE - 1,
];
const RESERVED_MATH_KEYBOARD_SLOT_SET = new Set(RESERVED_MATH_KEYBOARD_SLOT_INDICES);
export const SYSTEM_MATH_KEY_DEFINITIONS = [
  {
    action: 'openKeyboard',
    defaultSlotIndex: MATH_KEYBOARD_GRID_SIZE - 6,
    insert: '',
    label: 'keyboard',
    systemKeyId: 'keyboard',
  },
  {
    action: 'camera',
    defaultSlotIndex: MATH_KEYBOARD_GRID_SIZE - 5,
    insert: '',
    label: 'camera',
    systemKeyId: 'camera',
  },
  {
    action: 'insert',
    defaultSlotIndex: MATH_KEYBOARD_GRID_SIZE - 4,
    insert: ' ',
    label: 'space',
    systemKeyId: 'space',
  },
  {
    action: 'insert',
    defaultSlotIndex: MATH_KEYBOARD_GRID_SIZE - 3,
    insert: '\n',
    label: 'enter',
    systemKeyId: 'newline',
  },
  {
    action: 'delete',
    defaultSlotIndex: MATH_KEYBOARD_GRID_SIZE - 2,
    insert: '',
    label: 'delete',
    systemKeyId: 'delete',
  },
];

const SYSTEM_MATH_KEY_BY_ID = new Map(
  SYSTEM_MATH_KEY_DEFINITIONS.map((definition) => [definition.systemKeyId, definition]),
);

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

  (Array.isArray(rawKeys) ? rawKeys : []).forEach((rawKey, fallbackIndex) => {
    const systemDefinition = typeof rawKey === 'object' && rawKey !== null
      ? SYSTEM_MATH_KEY_BY_ID.get(rawKey.systemKeyId)
      : null;
    const systemSlotIndex = normalizeSlotIndex(rawKey, fallbackIndex);

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
        type: 'system',
      });
      return;
    }

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
      || !isValidMathKeyboardSlotIndex(slotIndex)
    ) {
      if (label && insert) {
        pendingKeys.push({
          insert,
          label,
          type: 'custom',
        });
      }
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

  pendingKeys.forEach((pendingKey) => {
    const slotIndex = normalizedKeys.findIndex((key) => key.isEmpty && !key.isReserved);
    if (slotIndex < 0) {
      return;
    }

    if (pendingKey.type === 'system') {
      if (placedSystemKeyIds.has(pendingKey.definition.systemKeyId)) {
        return;
      }

      normalizedKeys[slotIndex] = createSystemMathKeyboardSlot(pendingKey.definition, slotIndex);
      placedSystemKeyIds.add(pendingKey.definition.systemKeyId);
      return;
    }

    normalizedKeys[slotIndex] = {
      id: `math-key-slot-${slotIndex}`,
      insert: pendingKey.insert,
      isEmpty: false,
      label: pendingKey.label,
      slotIndex,
    };
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
    ...(key.isSystem ? {
      systemKeyId: key.systemKeyId,
    } : {
      insert: key.insert,
      label: key.label,
    }),
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

  return {
    id: `math-key-slot-${slotIndex}`,
    insert: key.insert,
    isEmpty: false,
    label: key.label,
    slotIndex,
  };
}

export function updateMathKeyboardKeyAt(keys = [], index, value) {
  if (index < 0 || index >= MATH_KEYBOARD_GRID_SIZE) {
    return normalizeMathKeyboardKeys(keys);
  }

  const normalizedKeys = normalizeMathKeyboardKeys(keys);
  if (normalizedKeys[index]?.isSystem || normalizedKeys[index]?.isReserved) {
    return normalizedKeys;
  }

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
