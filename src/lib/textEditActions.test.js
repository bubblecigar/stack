import {
  deleteTextAtSelection,
  insertTextAtSelection,
} from './textEditActions';

describe('text edit actions', () => {
  it('preserves inserted spaces', () => {
    expect(insertTextAtSelection('ab', ' ', { start: 1, end: 1 })).toEqual({
      nextSelection: { start: 2, end: 2 },
      nextValue: 'a b',
    });
  });

  it('preserves inserted line breaks', () => {
    expect(insertTextAtSelection('ab', '\n', { start: 1, end: 1 })).toEqual({
      nextSelection: { start: 2, end: 2 },
      nextValue: 'a\nb',
    });
  });

  it('deletes the previous character without a selection', () => {
    expect(deleteTextAtSelection('abc', { start: 2, end: 2 })).toEqual({
      nextSelection: { start: 1, end: 1 },
      nextValue: 'ac',
    });
  });

  it('deletes selected text', () => {
    expect(deleteTextAtSelection('abc', { start: 0, end: 2 })).toEqual({
      nextSelection: { start: 0, end: 0 },
      nextValue: 'c',
    });
  });
});
