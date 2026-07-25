import { constrainAddRelation } from './cardInsertion';

describe('constrainAddRelation', () => {
  it('maps right and down insertion to a child in child-only mode', () => {
    expect(constrainAddRelation('child', true)).toBe('child');
    expect(constrainAddRelation('nextSibling', true)).toBe('child');
  });

  it('blocks left and up insertion in child-only mode', () => {
    expect(constrainAddRelation('parent', true)).toBeNull();
    expect(constrainAddRelation('previousSibling', true)).toBeNull();
  });

  it('preserves all relations for regular cards', () => {
    expect(constrainAddRelation('nextSibling')).toBe('nextSibling');
    expect(constrainAddRelation('parent')).toBe('parent');
  });
});
