import {
  createMathKeyboardKey,
  getActiveMathKeyboardKeys,
  MATH_KEYBOARD_GRID_SIZE,
  moveMathKeyboardKey,
  normalizeMathKeyboardKeys,
  RESERVED_MATH_KEYBOARD_SLOT_INDICES,
  serializeMathKeyboardKeys,
  updateMathKeyboardKeyAt,
} from './mathKeyboardConfig';

describe('math keyboard store', () => {
  it('starts with locked system keys when no config exists', () => {
    const keys = normalizeMathKeyboardKeys(null);

    expect(keys).toHaveLength(MATH_KEYBOARD_GRID_SIZE);
    expect(keys.slice(0, MATH_KEYBOARD_GRID_SIZE - 5).every((key) => key.isEmpty)).toBe(true);
    expect(keys.slice(-5)).toEqual([
      expect.objectContaining({
        insert: ' ',
        isSystem: true,
        label: 'space',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 5,
        systemKeyId: 'space',
      }),
      expect.objectContaining({
        insert: '\n',
        isSystem: true,
        label: 'enter',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 4,
        systemKeyId: 'newline',
      }),
      expect.objectContaining({
        action: 'delete',
        isSystem: true,
        label: 'delete',
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 3,
        systemKeyId: 'delete',
      }),
      expect.objectContaining({
        isReserved: true,
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 2,
      }),
      expect.objectContaining({
        isReserved: true,
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 1,
      }),
    ]);
    expect(getActiveMathKeyboardKeys(keys)).toHaveLength(3);
  });

  it('migrates existing string keys into the first grid slots', () => {
    const keys = normalizeMathKeyboardKeys(['≡', ' mod ']);

    expect(keys).toHaveLength(MATH_KEYBOARD_GRID_SIZE);
    expect(keys.slice(0, 2)).toEqual([
      {
        id: 'math-key-slot-0',
        isEmpty: false,
        insert: '≡',
        label: '≡',
        slotIndex: 0,
      },
      {
        id: 'math-key-slot-1',
        isEmpty: false,
        insert: 'mod',
        label: 'mod',
        slotIndex: 1,
      },
    ]);
    expect(keys[2].isEmpty).toBe(true);
    expect(keys.slice(-5, -2).every((key) => key.isSystem)).toBe(true);
    expect(keys.slice(-2).every((key) => key.isReserved)).toBe(true);
  });

  it('keeps separate label and insert values', () => {
    expect(normalizeMathKeyboardKeys([
      {
        id: 'mod-key',
        label: 'mod',
        insert: ' (mod n)',
      },
    ])[0]).toEqual(
      {
        id: 'math-key-slot-0',
        insert: '(mod n)',
        isEmpty: false,
        label: 'mod',
        slotIndex: 0,
      },
    );
  });

  it('creates a new key from user text', () => {
    const key = createMathKeyboardKey(' = ');

    expect(key).toEqual(expect.objectContaining({
      insert: '=',
      label: '=',
    }));
    expect(key.id).toMatch(/^math-key-/);
  });

  it('allows duplicate key labels without duplicate slot ids', () => {
    const keys = normalizeMathKeyboardKeys(['=', '=']);

    expect(keys[0]).toEqual(expect.objectContaining({
      id: 'math-key-slot-0',
      insert: '=',
      label: '=',
      slotIndex: 0,
    }));
    expect(keys[1]).toEqual(expect.objectContaining({
      id: 'math-key-slot-1',
      insert: '=',
      label: '=',
      slotIndex: 1,
    }));
  });

  it('preserves sparse configured slots without duplicate generated ids', () => {
    const keys = normalizeMathKeyboardKeys([
      {
        insert: '≡',
        label: '≡',
        slotIndex: 24,
      },
    ]);

    expect(keys[24]).toEqual({
      id: 'math-key-slot-24',
      insert: '≡',
      isEmpty: false,
      label: '≡',
      slotIndex: 24,
    });
    expect(new Set(keys.map((key) => `${key.id}-${key.slotIndex}`)).size)
      .toBe(MATH_KEYBOARD_GRID_SIZE);
  });

  it('serializes only non-empty slots for storage', () => {
    const keys = normalizeMathKeyboardKeys([
      {
        insert: '≡',
        label: '≡',
        slotIndex: 24,
      },
    ]);

    expect(serializeMathKeyboardKeys(keys)).toEqual([
      {
        insert: '≡',
        label: '≡',
        slotIndex: 24,
      },
      {
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 5,
        systemKeyId: 'space',
      },
      {
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 4,
        systemKeyId: 'newline',
      },
      {
        slotIndex: MATH_KEYBOARD_GRID_SIZE - 3,
        systemKeyId: 'delete',
      },
    ]);
  });

  it('updates and clears a grid slot', () => {
    const updatedKeys = updateMathKeyboardKeyAt([], 4, '≅');
    expect(updatedKeys[4]).toEqual({
      id: 'math-key-slot-4',
      insert: '≅',
      isEmpty: false,
      label: '≅',
      slotIndex: 4,
    });

    const clearedKeys = updateMathKeyboardKeyAt(updatedKeys, 4, '');
    expect(clearedKeys[4]).toEqual({
      id: 'math-key-slot-4',
      insert: '',
      isEmpty: true,
      label: '',
      slotIndex: 4,
    });
  });

  it('does not edit locked system keys', () => {
    const updatedKeys = updateMathKeyboardKeyAt([], MATH_KEYBOARD_GRID_SIZE - 5, 'x');

    expect(updatedKeys[MATH_KEYBOARD_GRID_SIZE - 5]).toEqual(
      expect.objectContaining({
        isSystem: true,
        label: 'space',
        systemKeyId: 'space',
      }),
    );
  });

  it('moves locked system keys by swapping slots', () => {
    const keys = normalizeMathKeyboardKeys([
      {
        insert: '≡',
        label: '≡',
        slotIndex: 4,
      },
    ]);
    const movedKeys = moveMathKeyboardKey(keys, MATH_KEYBOARD_GRID_SIZE - 5, 4);

    expect(movedKeys[4]).toEqual(expect.objectContaining({
      isSystem: true,
      label: 'space',
      slotIndex: 4,
      systemKeyId: 'space',
    }));
    expect(movedKeys[MATH_KEYBOARD_GRID_SIZE - 5]).toEqual({
      id: `math-key-slot-${MATH_KEYBOARD_GRID_SIZE - 5}`,
      insert: '≡',
      isEmpty: false,
      label: '≡',
      slotIndex: MATH_KEYBOARD_GRID_SIZE - 5,
    });
  });

  it('does not edit or move into reserved cells', () => {
    const [firstReservedSlotIndex] = RESERVED_MATH_KEYBOARD_SLOT_INDICES;
    const editedKeys = updateMathKeyboardKeyAt([], firstReservedSlotIndex, 'x');

    expect(editedKeys[firstReservedSlotIndex]).toEqual(expect.objectContaining({
      isReserved: true,
      slotIndex: firstReservedSlotIndex,
    }));

    const movedKeys = moveMathKeyboardKey(editedKeys, MATH_KEYBOARD_GRID_SIZE - 5, firstReservedSlotIndex);

    expect(movedKeys[MATH_KEYBOARD_GRID_SIZE - 5]).toEqual(expect.objectContaining({
      isSystem: true,
      label: 'space',
      systemKeyId: 'space',
    }));
    expect(movedKeys[firstReservedSlotIndex]).toEqual(expect.objectContaining({
      isReserved: true,
    }));
  });
});
