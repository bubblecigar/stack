import {
  getActiveMathKeyboardKeys,
  MATH_KEYBOARD_GRID_SIZE,
  moveMathKeyboardKey,
  normalizeMathKeyboardKeys,
  RESERVED_MATH_KEYBOARD_SLOT_INDICES,
  serializeMathKeyboardKeys,
} from './mathKeyboardConfig';

describe('math keyboard store', () => {
  it('starts with the camera key centered in the bottom row', () => {
    const keys = normalizeMathKeyboardKeys(null);

    expect(keys).toHaveLength(MATH_KEYBOARD_GRID_SIZE);
    expect(keys[MATH_KEYBOARD_GRID_SIZE - 4]).toEqual(expect.objectContaining({
      action: 'camera',
      isSystem: true,
      label: 'camera',
      slotIndex: MATH_KEYBOARD_GRID_SIZE - 4,
      systemKeyId: 'camera',
    }));
    expect(getActiveMathKeyboardKeys(keys)).toHaveLength(1);
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

  it('drops retired keys and centers the camera when migrating a legacy layout', () => {
    const serializedKeys = serializeMathKeyboardKeys(normalizeMathKeyboardKeys([
      { slotIndex: 4, systemKeyId: 'camera' },
      { slotIndex: 38, systemKeyId: 'space' },
      { slotIndex: 39, systemKeyId: 'newline' },
      { slotIndex: 40, systemKeyId: 'delete' },
    ]));

    expect(serializedKeys).toEqual([
      { slotIndex: MATH_KEYBOARD_GRID_SIZE - 4, systemKeyId: 'camera' },
    ]);
  });

  it('moves system keys into empty slots but not reserved slots', () => {
    const sourceIndex = MATH_KEYBOARD_GRID_SIZE - 4;
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
