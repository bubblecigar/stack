import { buildTreeLayout } from './treeLayout';

function card(id, childIds = [], parentIds = [], extra = {}) {
  return {
    childIds,
    id,
    index: id,
    parentIds,
    text: id,
    ...extra,
  };
}

describe('buildTreeLayout', () => {
  it('places treasure roots after normal roots', () => {
    const layout = buildTreeLayout([
      card('treasure', [], [], { isTreasureCard: true }),
      card('normal'),
    ]);

    expect(layout.positionedCards.map((entry) => entry.card.id)).toEqual([
      'normal',
      'treasure',
    ]);
  });

  it('marks descendants inside a collapsed node as collapsed stacked', () => {
    const layout = buildTreeLayout([
      card('root', ['child']),
      card('child', [], ['root']),
    ], new Set(['root']));

    const rootEntry = layout.positionedCards.find((entry) => entry.card.id === 'root');
    const childEntry = layout.positionedCards.find((entry) => entry.card.id === 'child');

    expect(rootEntry.isCollapsedStacked).toBe(false);
    expect(childEntry.isCollapsedStacked).toBe(true);
    expect(childEntry.left).toBe(rootEntry.left);
    expect(childEntry.top).toBe(rootEntry.top);
  });

  it('places disconnected cards after reachable root trees', () => {
    const layout = buildTreeLayout([
      card('root', ['child']),
      card('child', [], ['root']),
      card('orphan-child', [], ['missing-parent']),
    ]);

    expect(layout.positionedCards.map((entry) => entry.card.id)).toEqual([
      'root',
      'child',
      'orphan-child',
    ]);
  });
});
