import {
  getActiveMathKeyboardKeys,
  MATH_KEYBOARD_GRID_SIZE,
  moveMathKeyboardKey,
  normalizeMathKeyboardKeys,
  RESERVED_MATH_KEYBOARD_SLOT_INDICES,
  serializeMathKeyboardKeys,
} from './mathKeyboardConfig';

describe('math keyboard store', () => {
  it('starts with the five system keys when no config exists', () => {
    const keys = normalizeMathKeyboardKeys(null);

    expect(keys).toHaveLength(MATH_KEYBOARD_GRID_SIZE);
    expect(keys.slice(0, MATH_KEYBOARD_GRID_SIZE - 6).every((key) => key.isEmpty)).toBe(true);
    expect(keys.slice(-6)).toEqual([
      expect.objectContaining({
        action: 'openKeyboard',
        isSystem: true,
        label: 'keyboard',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 6,
        systemKeyId: 'keyboard',
      }),
      expect.objectContaining({
        action: 'camera',
        isSystem: true,
        label: 'camera',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 5,
        systemKeyId: 'camera',
      }),
      expect.objectContaining({
        insert: ' ',
        isSystem: true,
        label: 'space',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 4,
        systemKeyId: 'space',
      }),
      expect.objectContaining({
        insert: '\n',
        isSystem: true,
        label: 'enter',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 3,
        systemKeyId: 'newline',
      }),
      expect.objectContaining({
        action: 'delete',
        isSystem: true,
        label: 'delete',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 2,
        systemKeyId: 'delete',
      }),
      expect.objectContaining({
        isReserved: true,
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 1,
      }),
    ]);
    expect(getActiveMathKeyboardKeys(keys)).toHaveLength(5);
  });

  it('drops legacy user-defined keys while preserving configured system keys', () => {
    const keys = normalizeMathKeyboardKeys([
      '≡',
      {
        insert: ' (mod n)',
        label: 'mod',
        slotIndex: 4,
      },
      {
        slotIndex: 12,
        systemKeyId: 'camera',
      },
    ]);

    expect(keys[0].isEmpty).toBe(true);
    expect(keys[4].isEmpty).toBe(true);
    expect(keys[12]).toEqual(expect.objectContaining({
      isSystem: true,
      slotIndex: 12,
      systemKeyId: 'camera',
    }));
    expect(getActiveMathKeyboardKeys(keys).every((key) => key.isSystem)).toBe(true);
  });

  it('serializes system keys only', () => {
    const serializedKeys = serializeMathKeyboardKeys(normalizeMathKeyboardKeys([
      { insert: '≡', label: '≡', slotIndex: 24 },
      { slotIndex: 4, systemKeyId: 'keyboard' },
    ]));

    expect(serializedKeys).toHaveLength(5);
    expect(serializedKeys).toEqual(expect.arrayContaining([
      { slotIndex: 4, systemKeyId: 'keyboard' },
    ]));
    expect(serializedKeys.every((key) => (
      typeof key.systemKeyId === 'string'
      && !Object.hasOwn(key, 'label')
      && !Object.hasOwn(key, 'insert')
    ))).toBe(true);
  });

  it('moves system keys into empty slots but not reserved slots', () => {
    const sourceIndex = MATH_KEYBOARD_GRID_SIZE - 5;
    const movedKeys = moveMathKeyboardKey([], sourceIndex, 4);

    expect(movedKeys[4]).toEqual(expect.objectContaining({
      isSystem: true,
      slotIndex: 4,
      systemKeyId: 'camera',
    }));
    expect(movedKeys[sourceIndex].isEmpty).toBe(true);

    const [reservedSlotIndex] = RESERVED_MATH_KEYBOARD_SLOT_INDICES;
    const reservedMove = moveMathKeyboardKey(movedKeys, 4, reservedSlotIndex);
    expect(reservedMove[4]).toEqual(expect.objectContaining({
      isSystem: true,
      systemKeyId: 'camera',
    }));
    expect(reservedMove[reservedSlotIndex].isReserved).toBe(true);
  });
});
