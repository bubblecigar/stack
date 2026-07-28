import {
  createMathKeyboardKey,
  normalizeMathKeyboardKeys,
} from './mathKeyboardConfig';

describe('math keyboard store', () => {
  it('starts from an empty keyboard when no config exists', () => {
    expect(normalizeMathKeyboardKeys(null)).toEqual([]);
    expect(normalizeMathKeyboardKeys({})).toEqual([]);
  });

  it('normalizes string keys into label and insert pairs', () => {
    expect(normalizeMathKeyboardKeys(['≡', ' mod '])).toEqual([
      {
        id: 'math-key-0-≡',
        insert: '≡',
        label: '≡',
      },
      {
        id: 'math-key-1-mod',
        insert: 'mod',
        label: 'mod',
      },
    ]);
  });

  it('keeps separate label and insert values', () => {
    expect(normalizeMathKeyboardKeys([
      {
        id: 'mod-key',
        label: 'mod',
        insert: ' (mod n)',
      },
    ])).toEqual([
      {
        id: 'mod-key',
        insert: '(mod n)',
        label: 'mod',
      },
    ]);
  });

  it('creates a new key from user text', () => {
    const key = createMathKeyboardKey(' = ');

    expect(key).toEqual(expect.objectContaining({
      insert: '=',
      label: '=',
    }));
    expect(key.id).toMatch(/^math-key-/);
  });
});
