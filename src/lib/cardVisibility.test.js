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

  it('does not restore an adopted mission subtree before the 04:30 boundary', () => {
    const adoptedAt = new Date(2026, 6, 25, 23, 0, 0).getTime();
    const beforeBoundary = new Date(2026, 6, 26, 4, 29, 59).getTime();
    const atBoundary = new Date(2026, 6, 26, 4, 30, 0).getTime();
    const cards = [
      card('mission', ['root']),
      card('root', [], ['mission'], { lastAdoptedAt: adoptedAt }),
    ];

    expect(getDailyVisibleCards(cards, 'mission', beforeBoundary)).toHaveLength(1);
    expect(getDailyVisibleCards(cards, 'mission', atBoundary)).toBe(cards);
  });
});
