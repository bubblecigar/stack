import {
  createMathKeyboardKey,
  getActiveMathKeyboardKeys,
  MATH_KEYBOARD_GRID_SIZE,
  normalizeMathKeyboardKeys,
  serializeMathKeyboardKeys,
  updateMathKeyboardKeyAt,
} from './mathKeyboardConfig';

describe('math keyboard store', () => {
  it('starts from an empty keyboard when no config exists', () => {
    const keys = normalizeMathKeyboardKeys(null);

    expect(keys).toHaveLength(MATH_KEYBOARD_GRID_SIZE);
    expect(keys.every((key) => key.isEmpty)).toBe(true);
    expect(getActiveMathKeyboardKeys(keys)).toEqual([]);
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
    expect(new Set(keys.map((key) => key.id)).size).toBe(MATH_KEYBOARD_GRID_SIZE);
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
});
