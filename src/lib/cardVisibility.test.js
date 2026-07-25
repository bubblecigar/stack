import { getDailyVisibleCards } from './cardVisibility';

function card(id, childIds = [], parentIds = [], extra = {}) {
  return {
    childIds,
    id,
    parentIds,
    text: id,
    ...extra,
  };
}

describe('getDailyVisibleCards', () => {
  it('removes an adopted mission root and its complete subtree for the day', () => {
    const now = new Date(2026, 6, 25, 12, 0, 0).getTime();
    const cards = [
      card('mission', ['adopted-root', 'available-root']),
      card('adopted-root', ['adopted-child'], ['mission'], { lastAdoptedAt: now }),
      card('adopted-child', [], ['adopted-root']),
      card('available-root', [], ['mission']),
      card('copied-user-root'),
    ];

    const visibleCards = getDailyVisibleCards(cards, 'mission', now);

    expect(visibleCards.map((entry) => entry.id)).toEqual([
      'mission',
      'available-root',
      'copied-user-root',
    ]);
    expect(visibleCards[0].childIds).toEqual(['available-root']);
  });

  it('restores the mission subtree on a later day', () => {
    const adoptedAt = new Date(2026, 6, 25, 12, 0, 0).getTime();
    const nextDay = new Date(2026, 6, 26, 12, 0, 0).getTime();
    const cards = [
      card('mission', ['root']),
      card('root', [], ['mission'], { lastAdoptedAt: adoptedAt }),
    ];

    expect(getDailyVisibleCards(cards, 'mission', nextDay)).toBe(cards);
  });
});
