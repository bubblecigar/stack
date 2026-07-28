import {
  getHiddenSystemCardIds,
  getVisibleCardsExcludingIds,
} from './systemVisibility';

function card(id, childIds = [], parentIds = []) {
  return {
    childIds,
    id,
    parentIds,
    text: id,
  };
}

describe('system visibility', () => {
  it('hides a soft-removed system root and its subtree', () => {
    const cards = [
      card('mission', ['mission-root']),
      card('mission-root', ['mission-child'], ['mission']),
      card('mission-child', [], ['mission-root']),
      card('normal-root', ['normal-child']),
      card('normal-child', [], ['normal-root']),
      card('treasure', []),
    ];

    const hiddenIds = getHiddenSystemCardIds(cards, ['mission']);
    const visibleCards = getVisibleCardsExcludingIds(cards, hiddenIds);

    expect([...hiddenIds]).toEqual(['mission', 'mission-root', 'mission-child']);
    expect(visibleCards.map((entry) => entry.id)).toEqual([
      'normal-root',
      'normal-child',
      'treasure',
    ]);
  });

  it('removes hidden parent and child references from visible cards', () => {
    const cards = [
      card('mission', ['mission-root']),
      card('mission-root', [], ['mission', 'normal-root']),
      card('normal-root', ['mission-root', 'visible-child']),
      card('visible-child', [], ['normal-root', 'mission-root']),
    ];

    const hiddenIds = getHiddenSystemCardIds(cards, ['mission']);
    const visibleCards = getVisibleCardsExcludingIds(cards, hiddenIds);

    expect(visibleCards).toEqual([
      card('normal-root', ['visible-child']),
      card('visible-child', [], ['normal-root']),
    ]);
  });

  it('does not change cards when a hidden root is missing', () => {
    const cards = [card('normal-root')];
    const hiddenIds = getHiddenSystemCardIds(cards, ['missing-system']);

    expect(hiddenIds.size).toBe(0);
    expect(getVisibleCardsExcludingIds(cards, hiddenIds)).toBe(cards);
  });
});
