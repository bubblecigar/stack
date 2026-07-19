import { buildPreviewCards, PREVIEW_CARD_ID } from './previewCards';

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

    const previewCards = buildPreviewCards(cards, 0, 'child');
    const root = previewCards.find((entry) => entry.id === 'root');
    const preview = previewCards.find((entry) => entry.id === PREVIEW_CARD_ID);

    expect(root.childIds).toEqual([PREVIEW_CARD_ID]);
    expect(preview.parentIds).toEqual(['root']);
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
