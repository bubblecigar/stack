import {
  buildHeldTreePreviewCards,
  buildPreviewCards,
  PREVIEW_CARD_ID,
} from './previewCards';

function card(id, childIds = [], parentIds = []) {
  return {
    childIds,
    id,
    index: id,
    parentIds,
    text: id,
  };
}

describe('buildPreviewCards', () => {
  it('previews unfocused insertions at the first or last root position', () => {
    const cards = [
      { childIds: [], id: 'mission-card', isMissionCard: true, parentIds: [], text: 'Mission' },
      { childIds: [], id: 1, parentIds: [], text: 'Root' },
      { childIds: [], id: 'treasure-card', isTreasureCard: true, parentIds: [], text: 'Treasure' },
    ];

    expect(buildPreviewCards(cards, null, 'parent').map((card) => card.id)).toEqual([
      'mission-card', PREVIEW_CARD_ID, 1, 'treasure-card',
    ]);
    expect(buildPreviewCards(cards, null, 'nextSibling').map((card) => card.id)).toEqual([
      'mission-card', 1, PREVIEW_CARD_ID, 'treasure-card',
    ]);
  });

  it('returns the original cards when there is no preview relation', () => {
    const cards = [card('root')];

    expect(buildPreviewCards(cards, 0, null)).toBe(cards);
  });

  it('inserts a parent preview above the focused card', () => {
    const cards = [
      card('root', ['child']),
      card('child', [], ['root']),
    ];

    const previewCards = buildPreviewCards(cards, 1, 'parent');
    const preview = previewCards.find((entry) => entry.id === PREVIEW_CARD_ID);
    const root = previewCards.find((entry) => entry.id === 'root');
    const child = previewCards.find((entry) => entry.id === 'child');

    expect(preview.childIds).toEqual(['child']);
    expect(preview.parentIds).toEqual(['root']);
    expect(root.childIds).toEqual([PREVIEW_CARD_ID]);
    expect(child.parentIds).toEqual([PREVIEW_CARD_ID]);
  });

  it('inserts a child preview under the focused card', () => {
    const cards = [card('root')];

    const previewCards = buildPreviewCards(cards, 0, 'child', '#DBEAFE');
    const root = previewCards.find((entry) => entry.id === 'root');
    const preview = previewCards.find((entry) => entry.id === PREVIEW_CARD_ID);

    expect(root.childIds).toEqual([PREVIEW_CARD_ID]);
    expect(preview.parentIds).toEqual(['root']);
    expect(preview.backgroundColor).toBe('#DBEAFE');
  });

  it('inserts sibling preview into parent child order', () => {
    const cards = [
      card('root', ['first', 'second']),
      card('first', [], ['root']),
      card('second', [], ['root']),
    ];

    const previewCards = buildPreviewCards(cards, 2, 'previousSibling');
    const root = previewCards.find((entry) => entry.id === 'root');
    const preview = previewCards.find((entry) => entry.id === PREVIEW_CARD_ID);

    expect(root.childIds).toEqual(['first', PREVIEW_CARD_ID, 'second']);
    expect(preview.parentIds).toEqual(['root']);
  });
});

describe('buildHeldTreePreviewCards', () => {
  it('previews a held tree as the parent and appends the target after existing children', () => {
    const visibleCards = [
      card('root', ['target', 'held']),
      card('target', [], ['root']),
    ];
    const heldCards = [
      card('held', ['held-child']),
      card('held-child', [], ['held']),
    ];

    const preview = buildHeldTreePreviewCards(visibleCards, heldCards, 1, 'parent');

    expect(preview.find((entry) => entry.id === 'root').childIds).toEqual(['held']);
    expect(preview.find((entry) => entry.id === 'held')).toMatchObject({
      childIds: ['held-child', 'target'],
      parentIds: ['root'],
    });
    expect(preview.find((entry) => entry.id === 'target').parentIds).toEqual(['held']);
  });

  it('previews a held tree at an unfocused root boundary', () => {
    const visibleCards = [
      { ...card('mission'), isMissionCard: true },
      card('root'),
      { ...card('treasure'), isTreasureCard: true },
    ];
    const heldCards = [card('held')];

    expect(buildHeldTreePreviewCards(
      visibleCards,
      heldCards,
      null,
      'nextSibling',
    ).map((entry) => entry.id)).toEqual([
      'mission', 'root', 'held', 'treasure',
    ]);
  });
});
