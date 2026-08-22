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

  it('blocks a treasure parent, allows up, and preserves down as child insertion', () => {
    expect(constrainAddRelation('parent', false, true)).toBeNull();
    expect(constrainAddRelation('child', false, true)).toBe('child');
    expect(constrainAddRelation('previousSibling', false, true)).toBe('previousSibling');
    expect(constrainAddRelation('nextSibling', false, true)).toBe('child');
  });
});
