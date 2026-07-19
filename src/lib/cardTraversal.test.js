import { buildCardTraversal, moveInTraversal } from './cardTraversal';

function card(id, childIds = [], parentIds = []) {
  return {
    childIds,
    id,
    index: id,
    parentIds,
    text: id,
  };
}

describe('buildCardTraversal', () => {
  const cards = [
    card('root-a', ['a-child-1', 'a-child-2']),
    card('a-child-1', ['a-grandchild'], ['root-a']),
    card('a-child-2', [], ['root-a']),
    card('a-grandchild', [], ['a-child-1']),
    card('root-b'),
  ];

  it('builds depth-first traversal by default', () => {
    expect(buildCardTraversal(cards).map((entry) => entry.id)).toEqual([
      'root-a',
      'a-child-1',
      'a-grandchild',
      'a-child-2',
      'root-b',
    ]);
  });

  it('builds breadth-first traversal when requested', () => {
    expect(buildCardTraversal(cards, 'bfs').map((entry) => entry.id)).toEqual([
      'root-a',
      'root-b',
      'a-child-1',
      'a-child-2',
      'a-grandchild',
    ]);
  });

  it('wraps movement through traversal order', () => {
    expect(moveInTraversal(cards, 'root-b', 'right')?.id).toBe('root-a');
    expect(moveInTraversal(cards, 'root-a', 'left')?.id).toBe('root-b');
  });

  it('falls back to the first traversed card for a missing current card', () => {
    expect(moveInTraversal(cards, 'missing', 'right')?.id).toBe('root-a');
  });
});
